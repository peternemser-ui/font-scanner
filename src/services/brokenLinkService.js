/**
 * Broken Link Checker Service
 * Crawls website to detect broken links, redirects, and external dead links
 * Target: $50-100 per scan, upsell fix service
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');
const { roundTo, formatNumber, formatDuration } = require('../utils/formatHelpers');

const logger = createLogger('BrokenLinkService');

// Generic anchor texts that provide poor SEO value (Set for O(1) lookups)
const GENERIC_ANCHOR_TEXTS = new Set([
  'click here', 'click', 'here', 'read more', 'learn more', 'more',
  'this', 'link', 'go', 'see more', 'view', 'details', 'info',
  'continue', 'next', 'previous', 'back', 'home', 'page',
  'download', 'get started', 'sign up', 'submit', 'buy now',
  'read article', 'full article', 'read the article'
]);

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
        
        // Set realistic user agent to avoid bot detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set extra headers to look like real browser
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br'
        });
        
        // Set reasonable timeout and viewport
        await page.setViewport({ width: 1920, height: 1080 });
        page.setDefaultNavigationTimeout(15000);
        
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
            logger.info(`Navigating to: ${currentUrl}`);
            
            let response;
            let retries = 2;
            
            // Use domcontentloaded for speed, with networkidle2 fallback for JS-heavy sites
            while (retries > 0) {
              try {
                const waitStrategy = retries === 2 ? 'domcontentloaded' : 'networkidle2';
                response = await page.goto(currentUrl, {
                  waitUntil: waitStrategy,
                  timeout: retries === 2 ? 8000 : 12000
                });
                break; // Success
              } catch (navError) {
                retries--;
                if (retries === 0) throw navError;
                logger.warn(`Navigation attempt failed, retrying with networkidle2: ${navError.message}`);
              }
            }

            // Check response status
            const status = response?.status();
            logger.info(`Page response status: ${status}`);

            if (!response || status >= 400) {
              logger.warn(`Page returned error status ${status}, skipping link extraction`);
              continue;
            }

            // Wait for JS rendering on first page (detect JS-heavy sites)
            if (pagesScanned === 1) {
              // Wait for body to have content and give JS time to render
              await page.waitForTimeout(300);

              // Check if page might be JS-rendered (few initial links)
              const initialLinkCount = await page.evaluate(() =>
                document.querySelectorAll('a[href]').length
              );

              if (initialLinkCount < 5) {
                logger.info('Few links found initially, waiting for JS rendering...');
                await page.waitForTimeout(1500);
              }
            }
            
            // Take screenshot for debugging (first page only)
            if (pagesScanned === 1) {
              try {
                await page.screenshot({ path: './reports/debug-screenshot.png', fullPage: false });
                logger.info('Debug screenshot saved to ./reports/debug-screenshot.png');
              } catch (screenshotError) {
                logger.warn('Could not save debug screenshot:', screenshotError.message);
              }
            }
            
            logger.info(`Page loaded successfully: ${currentUrl}`);
            
            // Extract all links on page with enhanced attributes
            const pageContent = await page.content();
            logger.info(`Page HTML length: ${pageContent.length} characters`);
            
            const links = await page.evaluate(() => {
              const anchors = Array.from(document.querySelectorAll('a[href]'));
              const allATags = Array.from(document.getElementsByTagName('a'));
              console.log(`Total <a> tags: ${allATags.length}, with href: ${anchors.length}`);
              
              // Also check for data-href, ng-href, etc.
              const dataHrefLinks = Array.from(document.querySelectorAll('[data-href]'));
              console.log(`Elements with data-href: ${dataHrefLinks.length}`);
              
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
            
            logger.info(`✓ Successfully extracted ${links.length} links from ${currentUrl}`);
            
            if (links.length === 0) {
              logger.warn(`⚠ Warning: No links found on ${currentUrl} - page may be empty or use non-standard navigation`);
            }
            
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
            logger.error(`✗ Failed to scan page ${currentUrl}:`, error.message);
            logger.error(`Error type: ${error.name}, Stack: ${error.stack?.split('\n')[0]}`);
            // Don't count failed pages in pagesScanned
            pagesScanned--;
          }
        }
        
        await page.close();
        
        logger.info(`Crawl complete: ${allLinks.size} unique links found from ${pagesScanned} pages`);
        if (allLinks.size === 0) {
          logger.warn(`WARNING: No links discovered during crawl of ${url}. This may indicate:`);
          logger.warn(`  - Site uses JavaScript to render links (requires waitUntil: 'networkidle0')`);
          logger.warn(`  - Site has no <a> elements with href attributes`);
          logger.warn(`  - Site blocked the crawler/bot`);
          logger.warn(`  - Navigation failed on all pages`);
        }
        
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

    // Separate links to check vs skip
    const linksToCheck = [];
    const linksToSkip = [];

    for (const link of linkArray) {
      if (!link.isInternal && !followExternal) {
        linksToSkip.push(link);
      } else {
        linksToCheck.push(link);
      }
    }

    // Mark skipped links
    for (const link of linksToSkip) {
      link.status = 'not-checked';
      link.checked = false;
    }

    // Deduplicate URLs - check each unique URL only once
    const urlToLinks = new Map();
    for (const link of linksToCheck) {
      if (!urlToLinks.has(link.url)) {
        urlToLinks.set(link.url, []);
      }
      urlToLinks.get(link.url).push(link);
    }

    const uniqueUrls = Array.from(urlToLinks.keys());
    logger.info(`Checking ${uniqueUrls.length} unique URLs (${linksToCheck.length} total links)`);

    // Process all unique URLs with higher concurrency (50 concurrent requests)
    const concurrencyLimit = 50;
    const checkUrl = async (url) => {
      const links = urlToLinks.get(url);
      const primaryLink = links[0];

      try {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(5000)
        });

        const statusCode = response.status;
        let status, redirectType = null;
        const redirectChain = [];

        if (response.status >= 300 && response.status < 400) {
          status = 'redirect';
          redirectType = response.status === 301 ? 'permanent' :
                        response.status === 302 ? 'temporary' :
                        response.status === 307 ? 'temporary-307' :
                        response.status === 308 ? 'permanent-308' : 'other';

          const redirectLocation = response.headers.get('location');
          if (redirectLocation) {
            const absoluteUrl = new URL(redirectLocation, url).href;
            redirectChain.push({
              url: absoluteUrl,
              statusCode: response.status,
              type: redirectType
            });

            // Follow redirect chain (collect all hops in parallel-friendly way)
            await this.followRedirectChainFast(primaryLink, absoluteUrl, 5, redirectChain);
          }
        } else if (response.status >= 200 && response.status < 300) {
          status = 'ok';
        } else {
          status = 'broken';
        }

        // Apply result to all links with this URL
        for (const link of links) {
          link.statusCode = statusCode;
          link.status = status;
          link.redirectType = redirectType;
          link.redirectChain = [...redirectChain];
          link.checked = true;
          if (primaryLink.finalDestination) link.finalDestination = primaryLink.finalDestination;
          if (primaryLink.finalStatusCode) link.finalStatusCode = primaryLink.finalStatusCode;
          if (primaryLink.redirectLoop) link.redirectLoop = primaryLink.redirectLoop;
          if (primaryLink.redirectEndsInError) link.redirectEndsInError = primaryLink.redirectEndsInError;
        }

      } catch (error) {
        for (const link of links) {
          link.status = 'broken';
          link.statusCode = 0;
          link.error = error.message;
          link.checked = true;
        }
      }
    };

    // Process URLs with concurrency limit
    for (let i = 0; i < uniqueUrls.length; i += concurrencyLimit) {
      const batch = uniqueUrls.slice(i, i + concurrencyLimit);
      await Promise.all(batch.map(checkUrl));
    }
  }

  /**
   * Follow redirect chain faster (non-recursive)
   * @private
   */
  async followRedirectChainFast(link, startUrl, maxHops, redirectChain) {
    let currentUrl = startUrl;

    for (let hop = 0; hop < maxHops; hop++) {
      try {
        const response = await fetch(currentUrl, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(3000)
        });

        if (response.status >= 300 && response.status < 400) {
          const nextLocation = response.headers.get('location');
          if (!nextLocation) break;

          const absoluteUrl = new URL(nextLocation, currentUrl).href;

          // Check for redirect loop
          if (redirectChain.some(r => r.url === absoluteUrl)) {
            link.redirectLoop = true;
            return;
          }

          const redirectType = response.status === 301 ? 'permanent' :
                              response.status === 302 ? 'temporary' :
                              response.status === 307 ? 'temporary-307' :
                              response.status === 308 ? 'permanent-308' : 'other';

          redirectChain.push({
            url: absoluteUrl,
            statusCode: response.status,
            type: redirectType
          });

          currentUrl = absoluteUrl;
        } else if (response.status >= 200 && response.status < 300) {
          link.finalDestination = currentUrl;
          link.finalStatusCode = response.status;
          return;
        } else if (response.status >= 400) {
          link.redirectEndsInError = true;
          link.finalStatusCode = response.status;
          return;
        }
      } catch (error) {
        link.redirectEndsInError = true;
        link.redirectError = error.message;
        return;
      }
    }

    // Max hops reached
    if (redirectChain.length >= maxHops) {
      link.redirectLoop = true;
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
    
    // If no links found, return 0 score (not 100)
    if (total === 0) {
      logger.warn('No links found during scan - this may indicate a crawling issue');
      return 0;
    }
    
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
    // Handle zero/null scores explicitly
    if (!score || score === 0) return 'F';
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
    // Use combined analysis for efficiency
    return this.analyzeAllLinks(allLinks).anchorAnalysis;
  }

  /**
   * Analyze link attributes for security and SEO
   * @private
   */
  analyzeLinkAttributes(allLinks) {
    // Use combined analysis for efficiency
    return this.analyzeAllLinks(allLinks).attributeAnalysis;
  }

  /**
   * Combined single-pass analysis for both anchor texts and link attributes
   * @private
   */
  analyzeAllLinks(allLinks) {
    // Return cached result if already computed for this allLinks instance
    if (this._cachedAnalysis && this._cachedAnalysisKey === allLinks) {
      return this._cachedAnalysis;
    }

    // Anchor text tracking
    const anchors = [];
    let genericCount = 0;
    let emptyCount = 0;
    let descriptiveCount = 0;
    let imageOnlyCount = 0;
    const anchorDistribution = {};

    // Attribute tracking
    let nofollowCount = 0;
    let sponsoredCount = 0;
    let ugcCount = 0;
    let newTabCount = 0;
    let secureExternalLinks = 0;
    let insecureExternalLinks = 0;
    const securityIssues = [];

    // Internal link tracking (single pass)
    let followedInternal = 0;
    let nofollowedInternal = 0;

    // Single pass over all links
    for (const link of allLinks.values()) {
      // === Anchor text analysis ===
      const text = (link.text || '').toLowerCase().trim();
      const effectiveText = text || link.ariaLabel || link.imageAlt || '';

      if (effectiveText) {
        anchorDistribution[effectiveText] = (anchorDistribution[effectiveText] || 0) + 1;
      }

      if (!effectiveText || effectiveText.length === 0) {
        emptyCount++;
        if (anchors.length < 50) {
          anchors.push({
            url: link.url,
            text: link.text,
            category: 'empty',
            issue: 'No anchor text, aria-label, or image alt',
            foundOn: link.foundOn[0]
          });
        }
      } else if (GENERIC_ANCHOR_TEXTS.has(text)) {
        genericCount++;
        if (anchors.length < 50) {
          anchors.push({
            url: link.url,
            text: link.text,
            category: 'generic',
            issue: `Generic anchor text "${text}" provides poor SEO value`,
            foundOn: link.foundOn[0]
          });
        }
      } else if (link.hasImage && !link.text) {
        imageOnlyCount++;
        if (!link.imageAlt && anchors.length < 50) {
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

      // === Attribute analysis ===
      if (link.isNoFollow) nofollowCount++;
      if (link.isSponsored) sponsoredCount++;
      if (link.isUGC) ugcCount++;
      if (link.opensInNewTab) newTabCount++;

      // Security check for external links
      if (!link.isInternal && link.opensInNewTab) {
        if (link.hasNoOpener || link.hasNoReferrer) {
          secureExternalLinks++;
        } else {
          insecureExternalLinks++;
          if (securityIssues.length < 20) {
            securityIssues.push({
              url: link.url,
              issue: 'External link opens in new tab without rel="noopener" or rel="noreferrer"',
              risk: 'Potential tabnabbing vulnerability',
              fix: 'Add rel="noopener noreferrer" to the link',
              foundOn: link.foundOn[0]
            });
          }
        }
      } else if (!link.isInternal && !link.opensInNewTab) {
        secureExternalLinks++;
      }

      // Internal link flow (counted in same pass)
      if (link.isInternal) {
        if (link.isNoFollow) {
          nofollowedInternal++;
        } else {
          followedInternal++;
        }
      }
    }

    // Find over-used anchors efficiently (use partial sort for top 10)
    const anchorEntries = Object.entries(anchorDistribution)
      .filter(([text, count]) => count > 5 && text.length > 3);

    // Simple approach: only sort if we have reasonable number of entries
    const overUsedAnchors = anchorEntries.length <= 100
      ? anchorEntries.sort((a, b) => b[1] - a[1]).slice(0, 10).map(([text, count]) => ({ text, count }))
      : this.getTopN(anchorEntries, 10).map(([text, count]) => ({ text, count }));

    const result = {
      anchorAnalysis: {
        totalAnchors: allLinks.size,
        genericCount,
        emptyCount,
        descriptiveCount,
        imageOnlyCount,
        overUsedAnchors,
        issues: anchors,
        qualityScore: roundTo((descriptiveCount / Math.max(1, allLinks.size)) * 100, 0)
      },
      attributeAnalysis: {
        totalLinks: allLinks.size,
        nofollowCount,
        sponsoredCount,
        ugcCount,
        newTabCount,
        secureExternalLinks,
        insecureExternalLinks,
        securityIssues,
        internalLinkFlow: {
          followed: followedInternal,
          nofollowed: nofollowedInternal,
          ratio: followedInternal > 0
            ? formatNumber((followedInternal / (followedInternal + nofollowedInternal)) * 100, 1) + '%'
            : '100%'
        }
      }
    };

    // Cache the result
    this._cachedAnalysis = result;
    this._cachedAnalysisKey = allLinks;

    return result;
  }

  /**
   * Get top N entries by count without full sort (for large arrays)
   * @private
   */
  getTopN(entries, n) {
    if (entries.length <= n) return entries.sort((a, b) => b[1] - a[1]);

    // Use partial selection for better performance on large arrays
    const result = [];
    const copy = [...entries];

    for (let i = 0; i < n && copy.length > 0; i++) {
      let maxIdx = 0;
      for (let j = 1; j < copy.length; j++) {
        if (copy[j][1] > copy[maxIdx][1]) maxIdx = j;
      }
      result.push(copy[maxIdx]);
      copy.splice(maxIdx, 1);
    }

    return result;
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
