/**
 * Broken Link Checker Service
 * Crawls website to detect broken links, redirects, and external dead links
 * Target: $50-100 per scan, upsell fix service
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');

const logger = createLogger('BrokenLinkService');

class BrokenLinkService {
  /**
   * Check all links on a website
   * @param {string} url - Website URL to scan
   * @param {Object} options - Scan options
   * @returns {Promise<Object>} Link analysis results
   */
  async checkLinks(url, options = {}) {
    logger.info(`Starting link check for: ${url}`);
    const startTime = Date.now();

    const {
      maxPages = 50,        // Limit pages crawled
      maxDepth = 3,         // Limit crawl depth
      followExternal = false // Check external link health
    } = options;

    try {
      const results = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        
        // Set reasonable timeout and viewport
        await page.setViewport({ width: 1920, height: 1080 });
        page.setDefaultNavigationTimeout(30000);
        
        // Track all links found
        const allLinks = new Map();
        const visitedPages = new Set();
        const linkQueue = [{ url, depth: 0 }];
        
        let pagesScanned = 0;
        
        // Crawl pages
        while (linkQueue.length > 0 && pagesScanned < maxPages) {
          const { url: currentUrl, depth } = linkQueue.shift();
          
          if (visitedPages.has(currentUrl) || depth > maxDepth) {
            continue;
          }
          
          visitedPages.add(currentUrl);
          pagesScanned++;
          
          logger.info(`Scanning page ${pagesScanned}/${maxPages}: ${currentUrl}`);
          
          try {
            const response = await page.goto(currentUrl, { 
              waitUntil: 'domcontentloaded',
              timeout: 30000 
            });
            
            // Extract all links on page
            const links = await page.evaluate(() => {
              const anchors = Array.from(document.querySelectorAll('a[href]'));
              return anchors.map(a => ({
                href: a.href,
                text: a.innerText.trim().substring(0, 100),
                rel: a.rel,
                target: a.target
              }));
            });
            
            // Process links
            for (const link of links) {
              if (!link.href || link.href.startsWith('javascript:') || link.href.startsWith('mailto:') || link.href.startsWith('tel:')) {
                continue;
              }
              
              // Store link info
              if (!allLinks.has(link.href)) {
                allLinks.set(link.href, {
                  url: link.href,
                  text: link.text,
                  foundOn: [currentUrl],
                  isInternal: this.isInternalLink(link.href, url),
                  isNoFollow: link.rel.includes('nofollow'),
                  opensInNewTab: link.target === '_blank',
                  status: null,
                  statusCode: null,
                  redirectChain: [],
                  checked: false
                });
              } else {
                allLinks.get(link.href).foundOn.push(currentUrl);
              }
              
              // Add internal links to queue
              if (this.isInternalLink(link.href, url) && depth < maxDepth) {
                linkQueue.push({ url: link.href, depth: depth + 1 });
              }
            }
            
          } catch (error) {
            logger.warn(`Failed to scan page ${currentUrl}:`, error.message);
          }
        }
        
        await page.close();
        return { allLinks, pagesScanned };
      });
      
      // Check link health
      logger.info(`Checking health of ${results.allLinks.size} unique links...`);
      await this.checkLinkHealth(results.allLinks, followExternal);
      
      // Categorize results
      const categorized = this.categorizeLinks(results.allLinks);
      
      const analysisTime = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`Link check completed in ${analysisTime}s`);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        pagesScanned: results.pagesScanned,
        totalLinks: results.allLinks.size,
        summary: {
          broken: categorized.broken.length,
          redirects: categorized.redirects.length,
          working: categorized.working.length,
          external: categorized.external.length,
          notChecked: categorized.notChecked.length
        },
        links: {
          broken: categorized.broken,
          redirects: categorized.redirects,
          working: categorized.working.slice(0, 20), // Limit working links in response
          external: categorized.external.slice(0, 20),
          notChecked: categorized.notChecked
        },
        score: this.calculateLinkScore(categorized),
        grade: this.getGrade(this.calculateLinkScore(categorized)),
        recommendations: this.generateRecommendations(categorized),
        analysisTime
      };
      
    } catch (error) {
      logger.error('Link check failed:', error);
      throw new Error(`Link check failed: ${error.message}`);
    }
  }

  /**
   * Check if link is internal
   * @private
   */
  isInternalLink(linkUrl, baseUrl) {
    try {
      const linkHost = new URL(linkUrl).hostname;
      const baseHost = new URL(baseUrl).hostname;
      return linkHost === baseHost || linkHost === `www.${baseHost}` || baseHost === `www.${linkHost}`;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check health of all links
   * @private
   */
  async checkLinkHealth(allLinks, followExternal) {
    const linkArray = Array.from(allLinks.values());
    
    // Check links in batches to avoid overwhelming server
    const batchSize = 10;
    for (let i = 0; i < linkArray.length; i += batchSize) {
      const batch = linkArray.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (link) => {
        // Skip external links if not following
        if (!link.isInternal && !followExternal) {
          link.status = 'not-checked';
          link.checked = false;
          return;
        }
        
        try {
          const response = await fetch(link.url, { 
            method: 'HEAD',
            redirect: 'manual',
            signal: AbortSignal.timeout(10000)
          });
          
          link.statusCode = response.status;
          link.checked = true;
          
          // Check for redirects
          if (response.status >= 300 && response.status < 400) {
            link.status = 'redirect';
            const redirectLocation = response.headers.get('location');
            if (redirectLocation) {
              link.redirectChain.push(redirectLocation);
              // Could follow redirect chain here if needed
            }
          } else if (response.status >= 200 && response.status < 300) {
            link.status = 'ok';
          } else if (response.status >= 400) {
            link.status = 'broken';
          }
          
        } catch (error) {
          link.status = 'broken';
          link.statusCode = 0;
          link.error = error.message;
          link.checked = true;
        }
      }));
    }
  }

  /**
   * Categorize links by status
   * @private
   */
  categorizeLinks(allLinks) {
    const broken = [];
    const redirects = [];
    const working = [];
    const external = [];
    const notChecked = [];
    
    for (const link of allLinks.values()) {
      if (!link.checked) {
        notChecked.push(link);
      } else if (link.status === 'broken') {
        broken.push(link);
      } else if (link.status === 'redirect') {
        redirects.push(link);
      } else if (link.status === 'ok') {
        if (link.isInternal) {
          working.push(link);
        } else {
          external.push(link);
        }
      }
    }
    
    return { broken, redirects, working, external, notChecked };
  }

  /**
   * Calculate link health score
   * @private
   */
  calculateLinkScore(categorized) {
    const total = categorized.broken.length + categorized.redirects.length + categorized.working.length + categorized.external.length;
    if (total === 0) return 100;
    
    const workingScore = (categorized.working.length / total) * 100;
    const externalScore = (categorized.external.length / total) * 20; // External links contribute less
    const redirectPenalty = (categorized.redirects.length / total) * 10;
    const brokenPenalty = (categorized.broken.length / total) * 50;
    
    const score = Math.max(0, workingScore + externalScore - redirectPenalty - brokenPenalty);
    return Math.round(score);
  }

  /**
   * Get letter grade from score
   * @private
   */
  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    if (score >= 30) return 'D';
    return 'F';
  }

  /**
   * Generate recommendations
   * @private
   */
  generateRecommendations(categorized) {
    const recommendations = [];
    
    if (categorized.broken.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'Broken Links',
        message: `Fix ${categorized.broken.length} broken link${categorized.broken.length > 1 ? 's' : ''}`,
        detail: 'Broken links hurt SEO and user experience. Replace or remove them immediately.',
        impact: 'High - affects SEO rankings and user trust'
      });
    }
    
    if (categorized.redirects.length > 5) {
      recommendations.push({
        priority: 'high',
        category: 'Redirects',
        message: `Update ${categorized.redirects.length} redirect${categorized.redirects.length > 1 ? 's' : ''}`,
        detail: 'Redirect chains slow down page load and waste crawl budget. Update links to point directly to final destination.',
        impact: 'Medium - affects page speed and SEO efficiency'
      });
    }
    
    if (categorized.external.length > categorized.working.length) {
      recommendations.push({
        priority: 'medium',
        category: 'Internal Linking',
        message: 'Add more internal links',
        detail: `You have ${categorized.external.length} external links but only ${categorized.working.length} internal links. Better internal linking improves SEO.`,
        impact: 'Medium - improves content discoverability and SEO'
      });
    }
    
    if (categorized.broken.length === 0 && categorized.redirects.length === 0) {
      recommendations.push({
        priority: 'success',
        category: 'Link Health',
        message: '✅ Perfect link health!',
        detail: 'All your links are working correctly. Keep monitoring regularly.',
        impact: 'Maintain current standards'
      });
    }
    
    return recommendations;
  }
}

module.exports = new BrokenLinkService();
