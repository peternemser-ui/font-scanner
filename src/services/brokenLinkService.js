/**
 * Broken Link Checker Service
 * Crawls website to detect broken links, redirects, and external dead links
 * Target: $50-100 per scan, upsell fix service
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');
const { roundTo, formatNumber, formatDuration } = require('../utils/formatHelpers');

const logger = createLogger('BrokenLinkService');

// Generic anchor texts that provide poor SEO value
const GENERIC_ANCHOR_TEXTS = [
  'click here', 'click', 'here', 'read more', 'learn more', 'more', 
  'this', 'link', 'go', 'see more', 'view', 'details', 'info',
  'continue', 'next', 'previous', 'back', 'home', 'page',
  'download', 'get started', 'sign up', 'submit', 'buy now',
  'read article', 'full article', 'read the article'
];

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
            
            // Extract all links on page with enhanced attributes
            const links = await page.evaluate(() => {
              const anchors = Array.from(document.querySelectorAll('a[href]'));
              return anchors.map(a => ({
                href: a.href,
                text: a.innerText.trim().substring(0, 100),
                rel: a.rel || '',
                target: a.target || '',
                title: a.title || '',
                // Check for aria-label as alternative text
                ariaLabel: a.getAttribute('aria-label') || '',
                // Check if link contains only an image
                hasImage: a.querySelector('img') !== null,
                imageAlt: a.querySelector('img')?.alt || ''
              }));
            });
            
            // Process links
            for (const link of links) {
              if (!link.href || link.href.startsWith('javascript:') || link.href.startsWith('mailto:') || link.href.startsWith('tel:')) {
                continue;
              }
              
              // Parse rel attributes
              const relAttrs = this.parseRelAttributes(link.rel);
              
              // Store link info with enhanced data
              if (!allLinks.has(link.href)) {
                allLinks.set(link.href, {
                  url: link.href,
                  text: link.text,
                  title: link.title,
                  ariaLabel: link.ariaLabel,
                  hasImage: link.hasImage,
                  imageAlt: link.imageAlt,
                  foundOn: [currentUrl],
                  isInternal: this.isInternalLink(link.href, url),
                  // Enhanced rel attribute tracking
                  isNoFollow: relAttrs.nofollow,
                  isSponsored: relAttrs.sponsored,
                  isUGC: relAttrs.ugc,
                  hasNoOpener: relAttrs.noopener,
                  hasNoReferrer: relAttrs.noreferrer,
                  relAttributes: link.rel,
                  opensInNewTab: link.target === '_blank',
                  status: null,
                  statusCode: null,
                  redirectChain: [],
                  redirectType: null,
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
      
      // Check link health with enhanced redirect tracking
      logger.info(`Checking health of ${results.allLinks.size} unique links...`);
      await this.checkLinkHealth(results.allLinks, followExternal);
      
      // Categorize results
      const categorized = this.categorizeLinks(results.allLinks);
      
      // Analyze anchor texts
      const anchorAnalysis = this.analyzeAnchorTexts(results.allLinks);
      
      // Analyze link attributes
      const attributeAnalysis = this.analyzeLinkAttributes(results.allLinks);
      
      // Enhanced redirect analysis
      const redirectAnalysis = this.analyzeRedirects(categorized.redirects);

      const analysisTime = formatDuration(Date.now() - startTime, 2);
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
        // NEW: Enhanced analysis sections
        anchorAnalysis,
        attributeAnalysis,
        redirectAnalysis,
        score: this.calculateLinkScore(categorized, anchorAnalysis, attributeAnalysis),
        grade: this.getGrade(this.calculateLinkScore(categorized, anchorAnalysis, attributeAnalysis)),
        recommendations: this.generateRecommendations(categorized, anchorAnalysis, attributeAnalysis, redirectAnalysis),
        analysisTime
      };
      
    } catch (error) {
      logger.error('Link check failed:', error);
      throw new Error(`Link check failed: ${error.message}`);
    }
  }

  /**
   * Parse rel attribute string into object
   * @private
   */
  parseRelAttributes(relString) {
    const rel = (relString || '').toLowerCase();
    return {
      nofollow: rel.includes('nofollow'),
      sponsored: rel.includes('sponsored'),
      ugc: rel.includes('ugc'),
      noopener: rel.includes('noopener'),
      noreferrer: rel.includes('noreferrer')
    };
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
   * Check health of all links with enhanced redirect tracking
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
          // Use HEAD request first, with manual redirect handling
          const response = await fetch(link.url, { 
            method: 'HEAD',
            redirect: 'manual',
            signal: AbortSignal.timeout(10000)
          });
          
          link.statusCode = response.status;
          link.checked = true;
          
          // Check for redirects and follow chain
          if (response.status >= 300 && response.status < 400) {
            link.status = 'redirect';
            link.redirectType = response.status === 301 ? 'permanent' : 
                               response.status === 302 ? 'temporary' :
                               response.status === 307 ? 'temporary-307' :
                               response.status === 308 ? 'permanent-308' : 'other';
            
            const redirectLocation = response.headers.get('location');
            if (redirectLocation) {
              // Resolve relative URLs
              const absoluteUrl = new URL(redirectLocation, link.url).href;
              link.redirectChain.push({
                url: absoluteUrl,
                statusCode: response.status,
                type: link.redirectType
              });
              
              // Follow redirect chain (up to 5 hops)
              await this.followRedirectChain(link, absoluteUrl, 5);
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
   * Follow redirect chain to final destination
   * @private
   */
  async followRedirectChain(link, currentUrl, maxHops) {
    if (maxHops <= 0) {
      link.redirectLoop = true;
      return;
    }
    
    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.status >= 300 && response.status < 400) {
        const nextLocation = response.headers.get('location');
        if (nextLocation) {
          const absoluteUrl = new URL(nextLocation, currentUrl).href;
          
          // Check for redirect loop
          if (link.redirectChain.some(r => r.url === absoluteUrl)) {
            link.redirectLoop = true;
            return;
          }
          
          const redirectType = response.status === 301 ? 'permanent' : 
                              response.status === 302 ? 'temporary' :
                              response.status === 307 ? 'temporary-307' :
                              response.status === 308 ? 'permanent-308' : 'other';
          
          link.redirectChain.push({
            url: absoluteUrl,
            statusCode: response.status,
            type: redirectType
          });
          
          await this.followRedirectChain(link, absoluteUrl, maxHops - 1);
        }
      } else if (response.status >= 200 && response.status < 300) {
        // Final destination reached
        link.finalDestination = currentUrl;
        link.finalStatusCode = response.status;
      } else if (response.status >= 400) {
        // Redirect chain ends in error
        link.redirectEndsInError = true;
        link.finalStatusCode = response.status;
      }
    } catch (error) {
      link.redirectEndsInError = true;
      link.redirectError = error.message;
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
  calculateLinkScore(categorized, anchorAnalysis, attributeAnalysis) {
    const total = categorized.broken.length + categorized.redirects.length + categorized.working.length + categorized.external.length;
    if (total === 0) return 100;
    
    // Base score from link status
    const workingScore = (categorized.working.length / total) * 60;
    const externalScore = (categorized.external.length / total) * 10;
    const redirectPenalty = (categorized.redirects.length / total) * 10;
    const brokenPenalty = (categorized.broken.length / total) * 40;
    
    let baseScore = Math.max(0, workingScore + externalScore - redirectPenalty - brokenPenalty);
    
    // Anchor text quality bonus/penalty (up to ±15 points)
    if (anchorAnalysis) {
      const genericRatio = anchorAnalysis.genericCount / Math.max(1, total);
      const emptyRatio = anchorAnalysis.emptyCount / Math.max(1, total);
      baseScore -= (genericRatio * 10); // Penalty for generic anchors
      baseScore -= (emptyRatio * 5); // Penalty for empty anchors
    }
    
    // Security attributes bonus (up to +15 points)
    if (attributeAnalysis) {
      const externalCount = categorized.external.length;
      if (externalCount > 0) {
        const secureRatio = attributeAnalysis.secureExternalLinks / externalCount;
        baseScore += (secureRatio * 15);
      } else {
        baseScore += 15; // No external links = no security risk
      }
    }

    return roundTo(Math.max(0, Math.min(100, baseScore)), 0);
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
   * Analyze anchor texts for SEO quality
   * @private
   */
  analyzeAnchorTexts(allLinks) {
    const anchors = [];
    let genericCount = 0;
    let emptyCount = 0;
    let descriptiveCount = 0;
    let imageOnlyCount = 0;
    const anchorDistribution = {};
    
    for (const link of allLinks.values()) {
      const text = (link.text || '').toLowerCase().trim();
      const effectiveText = text || link.ariaLabel || link.imageAlt || '';
      
      // Track anchor distribution
      if (effectiveText) {
        anchorDistribution[effectiveText] = (anchorDistribution[effectiveText] || 0) + 1;
      }
      
      // Categorize anchor quality
      if (!effectiveText || effectiveText.length === 0) {
        emptyCount++;
        anchors.push({
          url: link.url,
          text: link.text,
          category: 'empty',
          issue: 'No anchor text, aria-label, or image alt',
          foundOn: link.foundOn[0]
        });
      } else if (GENERIC_ANCHOR_TEXTS.includes(text)) {
        genericCount++;
        anchors.push({
          url: link.url,
          text: link.text,
          category: 'generic',
          issue: `Generic anchor text "${text}" provides poor SEO value`,
          foundOn: link.foundOn[0]
        });
      } else if (link.hasImage && !link.text) {
        imageOnlyCount++;
        if (!link.imageAlt) {
          anchors.push({
            url: link.url,
            text: '[Image link]',
            category: 'image-no-alt',
            issue: 'Image link without alt text',
            foundOn: link.foundOn[0]
          });
        }
      } else {
        descriptiveCount++;
      }
    }
    
    // Find over-used anchors (potential over-optimization)
    const overUsedAnchors = Object.entries(anchorDistribution)
      .filter(([text, count]) => count > 5 && text.length > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([text, count]) => ({ text, count }));
    
    return {
      totalAnchors: allLinks.size,
      genericCount,
      emptyCount,
      descriptiveCount,
      imageOnlyCount,
      overUsedAnchors,
      issues: anchors.slice(0, 50), // Limit issues returned
      qualityScore: roundTo((descriptiveCount / Math.max(1, allLinks.size)) * 100, 0)
    };
  }

  /**
   * Analyze link attributes for security and SEO
   * @private
   */
  analyzeLinkAttributes(allLinks) {
    let nofollowCount = 0;
    let sponsoredCount = 0;
    let ugcCount = 0;
    let newTabCount = 0;
    let secureExternalLinks = 0;
    let insecureExternalLinks = 0;
    const securityIssues = [];
    
    for (const link of allLinks.values()) {
      // Count rel attributes
      if (link.isNoFollow) nofollowCount++;
      if (link.isSponsored) sponsoredCount++;
      if (link.isUGC) ugcCount++;
      if (link.opensInNewTab) newTabCount++;
      
      // Check security for external links opening in new tab
      if (!link.isInternal && link.opensInNewTab) {
        if (link.hasNoOpener || link.hasNoReferrer) {
          secureExternalLinks++;
        } else {
          insecureExternalLinks++;
          securityIssues.push({
            url: link.url,
            issue: 'External link opens in new tab without rel="noopener" or rel="noreferrer"',
            risk: 'Potential tabnabbing vulnerability',
            fix: 'Add rel="noopener noreferrer" to the link',
            foundOn: link.foundOn[0]
          });
        }
      } else if (!link.isInternal && !link.opensInNewTab) {
        // External link not opening in new tab - also a consideration
        secureExternalLinks++; // Not a security issue if same tab
      }
    }
    
    // Calculate followed vs nofollowed ratio for internal links
    const internalLinks = Array.from(allLinks.values()).filter(l => l.isInternal);
    const followedInternal = internalLinks.filter(l => !l.isNoFollow).length;
    const nofollowedInternal = internalLinks.filter(l => l.isNoFollow).length;
    
    return {
      totalLinks: allLinks.size,
      nofollowCount,
      sponsoredCount,
      ugcCount,
      newTabCount,
      secureExternalLinks,
      insecureExternalLinks,
      securityIssues: securityIssues.slice(0, 20),
      internalLinkFlow: {
        followed: followedInternal,
        nofollowed: nofollowedInternal,
        ratio: followedInternal > 0 ?
          formatNumber((followedInternal / (followedInternal + nofollowedInternal)) * 100, 1) + '%' : '100%'
      }
    };
  }

  /**
   * Analyze redirect chains in detail
   * @private
   */
  analyzeRedirects(redirects) {
    const analysis = {
      total: redirects.length,
      permanent301: 0,
      temporary302: 0,
      temporary307: 0,
      permanent308: 0,
      other: 0,
      longChains: [], // Chains > 2 hops
      loops: [],
      endsInError: [],
      chainLengths: {}
    };
    
    for (const link of redirects) {
      // Count redirect types
      switch (link.redirectType) {
        case 'permanent': analysis.permanent301++; break;
        case 'temporary': analysis.temporary302++; break;
        case 'temporary-307': analysis.temporary307++; break;
        case 'permanent-308': analysis.permanent308++; break;
        default: analysis.other++;
      }
      
      // Track chain length
      const chainLength = (link.redirectChain || []).length;
      analysis.chainLengths[chainLength] = (analysis.chainLengths[chainLength] || 0) + 1;
      
      // Flag long chains (> 2 hops)
      if (chainLength > 2) {
        analysis.longChains.push({
          originalUrl: link.url,
          chainLength: chainLength,
          chain: link.redirectChain,
          finalDestination: link.finalDestination
        });
      }
      
      // Flag redirect loops
      if (link.redirectLoop) {
        analysis.loops.push({
          url: link.url,
          chain: link.redirectChain
        });
      }
      
      // Flag redirects ending in error
      if (link.redirectEndsInError) {
        analysis.endsInError.push({
          url: link.url,
          finalStatusCode: link.finalStatusCode,
          error: link.redirectError
        });
      }
    }
    
    return analysis;
  }

  /**
   * Generate recommendations
   * @private
   */
  generateRecommendations(categorized, anchorAnalysis, attributeAnalysis, redirectAnalysis) {
    const recommendations = [];
    
    // Broken links - critical
    if (categorized.broken.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'Broken Links',
        message: `Fix ${categorized.broken.length} broken link${categorized.broken.length > 1 ? 's' : ''}`,
        detail: 'Broken links hurt SEO and user experience. Replace or remove them immediately.',
        impact: 'High - affects SEO rankings and user trust'
      });
    }
    
    // Redirect chain issues
    if (redirectAnalysis && redirectAnalysis.longChains.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'Redirect Chains',
        message: `Fix ${redirectAnalysis.longChains.length} long redirect chain${redirectAnalysis.longChains.length > 1 ? 's' : ''}`,
        detail: 'Redirect chains with more than 2 hops slow down page load and waste crawl budget. Update links to point directly to final destination.',
        impact: 'High - affects page speed and SEO efficiency'
      });
    }
    
    // Redirect loops
    if (redirectAnalysis && redirectAnalysis.loops.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'Redirect Loops',
        message: `Fix ${redirectAnalysis.loops.length} redirect loop${redirectAnalysis.loops.length > 1 ? 's' : ''}`,
        detail: 'Redirect loops prevent pages from loading and cause crawl errors.',
        impact: 'Critical - pages are inaccessible'
      });
    }
    
    // Temporary redirects
    if (redirectAnalysis && (redirectAnalysis.temporary302 + redirectAnalysis.temporary307) > 0) {
      const tempCount = redirectAnalysis.temporary302 + redirectAnalysis.temporary307;
      recommendations.push({
        priority: 'medium',
        category: 'Temporary Redirects',
        message: `Consider converting ${tempCount} temporary redirect${tempCount > 1 ? 's' : ''} to permanent`,
        detail: 'Temporary redirects (302/307) don\'t pass full link equity. If the redirect is permanent, use 301 instead.',
        impact: 'Medium - affects SEO link equity transfer'
      });
    }
    
    // Security issues
    if (attributeAnalysis && attributeAnalysis.insecureExternalLinks > 0) {
      recommendations.push({
        priority: 'high',
        category: 'Link Security',
        message: `Fix ${attributeAnalysis.insecureExternalLinks} insecure external link${attributeAnalysis.insecureExternalLinks > 1 ? 's' : ''}`,
        detail: 'External links opening in new tabs without rel="noopener noreferrer" are vulnerable to tabnabbing attacks.',
        impact: 'High - security vulnerability'
      });
    }
    
    // Generic anchor texts
    if (anchorAnalysis && anchorAnalysis.genericCount > 5) {
      recommendations.push({
        priority: 'medium',
        category: 'Anchor Text',
        message: `Improve ${anchorAnalysis.genericCount} generic anchor text${anchorAnalysis.genericCount > 1 ? 's' : ''}`,
        detail: 'Anchor texts like "click here" and "read more" provide poor SEO value. Use descriptive anchor texts that indicate the link destination.',
        impact: 'Medium - affects keyword relevance signals'
      });
    }
    
    // Empty anchor texts
    if (anchorAnalysis && anchorAnalysis.emptyCount > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'Accessibility',
        message: `Add text to ${anchorAnalysis.emptyCount} empty link${anchorAnalysis.emptyCount > 1 ? 's' : ''}`,
        detail: 'Links without text (or accessible alternatives like aria-label/image alt) are problematic for screen readers and SEO.',
        impact: 'Medium - affects accessibility and SEO'
      });
    }
    
    // Over-used anchors
    if (anchorAnalysis && anchorAnalysis.overUsedAnchors.length > 0) {
      const topAnchors = anchorAnalysis.overUsedAnchors.slice(0, 3).map(a => `"${a.text}"`).join(', ');
      recommendations.push({
        priority: 'low',
        category: 'Anchor Diversity',
        message: 'Diversify your anchor text patterns',
        detail: `Some anchor texts are used frequently: ${topAnchors}. Consider varying anchor text to appear more natural.`,
        impact: 'Low - affects natural link profile'
      });
    }
    
    // Internal linking
    if (categorized.external.length > categorized.working.length) {
      recommendations.push({
        priority: 'medium',
        category: 'Internal Linking',
        message: 'Add more internal links',
        detail: `You have ${categorized.external.length} external links but only ${categorized.working.length} internal links. Better internal linking improves SEO.`,
        impact: 'Medium - improves content discoverability and SEO'
      });
    }
    
    // Nofollow on internal links
    if (attributeAnalysis && attributeAnalysis.internalLinkFlow.nofollowed > 0) {
      recommendations.push({
        priority: 'low',
        category: 'Link Flow',
        message: `Review ${attributeAnalysis.internalLinkFlow.nofollowed} nofollowed internal link${attributeAnalysis.internalLinkFlow.nofollowed > 1 ? 's' : ''}`,
        detail: 'Internal links with nofollow prevent PageRank from flowing to those pages. This is usually unintentional.',
        impact: 'Low - affects internal PageRank distribution'
      });
    }
    
    // Perfect score
    if (categorized.broken.length === 0 && 
        (!redirectAnalysis || (redirectAnalysis.longChains.length === 0 && redirectAnalysis.loops.length === 0)) &&
        (!attributeAnalysis || attributeAnalysis.insecureExternalLinks === 0)) {
      recommendations.push({
        priority: 'success',
        category: 'Link Health',
        message: '✅ Excellent link health!',
        detail: 'No broken links, redirect issues, or security vulnerabilities detected. Keep monitoring regularly.',
        impact: 'Maintain current standards'
      });
    }
    
    return recommendations;
  }
}

module.exports = new BrokenLinkService();
