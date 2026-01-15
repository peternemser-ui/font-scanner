/**
 * SEO Analyzer Service
 * Comprehensive SEO analysis including meta tags, content, performance, and best practices
 */

const { createLogger } = require('../utils/logger');
const browserPool = require('../utils/browserPool');
const { formatDuration, formatBytes } = require('../utils/formatHelpers');
const {
  scoreMetaTags,
  scoreHeadingStructure,
  scoreContentQuality,
  scoreImageAccessibility,
  scoreLinkStructure,
  scoreMobileResponsiveness,
  scorePerformanceMetrics,
  scoreSecurityHeaders,
  scoreStructuredData,
  calculateWeightedScore,
  scoreToGrade
} = require('../utils/scoringHelpers');
const {
  setDeviceProfile,
  detectBotProtection,
  navigateToPage
} = require('../utils/browserHelpers');
const {
  extractMetaTags,
  extractHeadingStructure,
  analyzeContent,
  analyzeImages,
  analyzeLinks,
  extractStructuredData
} = require('../utils/domHelpers');

const logger = createLogger('SEOAnalyzer');

class SEOAnalyzer {
  constructor() {
    this.timeout = 30000; // 30 seconds per analysis
  }

  /**
   * Perform comprehensive SEO analysis
   * @param {string} url - URL to analyze
   * @returns {Promise<Object>} SEO analysis results
   */
  async analyzeSEO(url) {
    logger.info('Starting SEO analysis', { url });

    // Add overall timeout to prevent analysis from hanging indefinitely
    const analysisPromise = browserPool.execute(async (browser) => {
      const page = await browser.newPage();
      
      try {
        // Set desktop device profile
        await setDeviceProfile(page, 'desktop');

        // Navigate to page with bot detection
        const response = await navigateToPage(page, url, {
          timeout: this.timeout,
          waitUntil: 'domcontentloaded',
          checkBotProtection: true,
          retries: 0
        });

        // Run analysis functions that can safely run in parallel
        const [
          metaTags,
          headingStructure,
          contentAnalysis,
          imageAnalysis,
          linkAnalysis,
          structuredData,
          securityHeaders
        ] = await Promise.all([
          this.analyzeMetaTags(page),
          this.analyzeHeadingStructure(page),
          this.analyzeContent(page),
          this.analyzeImages(page),
          this.analyzeLinks(page),
          this.analyzeStructuredData(page),
          this.checkSecurityHeaders(response, url)
        ]);

        // Run functions sequentially that modify page state or navigation
        const mobileResponsive = await this.checkMobileResponsiveness(page);
        const performanceMetrics = await this.analyzePerformance(page);
        const additionalChecks = await this.performAdditionalChecks(page, url);

        // Calculate overall SEO score
        const score = this.calculateSEOScore({
          metaTags,
          headingStructure,
          contentAnalysis,
          imageAnalysis,
          linkAnalysis,
          mobileResponsive,
          performanceMetrics,
          securityHeaders,
          structuredData,
          additionalChecks
        });

        return {
          url,
          timestamp: new Date().toISOString(),
          score,
          metaTags,
          headingStructure,
          contentAnalysis,
          imageAnalysis,
          linkAnalysis,
          mobileResponsive,
          performanceMetrics,
          securityHeaders,
          structuredData,
          additionalChecks
        };

      } finally {
        await page.close();
      }
    });

    // Create timeout promise (35 seconds total for all analysis steps)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('SEO analysis timed out after 35 seconds. The website may be too slow or complex to analyze.'));
      }, 35000);
    });

    // Race between analysis and timeout
    const results = await Promise.race([analysisPromise, timeoutPromise]);

    logger.info('SEO analysis completed', { url, score: results.score });
    return results;
  }

  /**
   * Analyze meta tags (title, description, keywords, OG, Twitter cards)
   */
  async analyzeMetaTags(page) {
    logger.info('Analyzing meta tags');

    // Use domHelper function for meta tag extraction
    const metaTags = await page.evaluate(extractMetaTags);

    // Evaluate meta tag quality
    const issues = [];
    const recommendations = [];

    // Title checks
    if (!metaTags.title) {
      issues.push('Missing page title');
    } else if (metaTags.titleLength < 30) {
      recommendations.push('Title is too short (< 30 chars). Recommended: 50-60 chars');
    } else if (metaTags.titleLength > 60) {
      recommendations.push('Title is too long (> 60 chars). It may be truncated in search results');
    }

    // Description checks
    if (!metaTags.description) {
      issues.push('Missing meta description');
    } else if (metaTags.descriptionLength < 120) {
      recommendations.push('Meta description is too short (< 120 chars). Recommended: 150-160 chars');
    } else if (metaTags.descriptionLength > 160) {
      recommendations.push('Meta description is too long (> 160 chars). It may be truncated');
    }

    // Social media checks
    if (!metaTags.ogTitle && !metaTags.ogDescription) {
      recommendations.push('Add Open Graph tags for better social media sharing');
    }

    if (!metaTags.twitterCard) {
      recommendations.push('Add Twitter Card tags for better Twitter sharing');
    }

    // Technical checks
    if (!metaTags.viewport) {
      issues.push('Missing viewport meta tag (affects mobile usability)');
    }

    if (!metaTags.language) {
      recommendations.push('Add language attribute to <html> tag');
    }

    // Use scoring helper
    const score = scoreMetaTags(metaTags);

    return {
      ...metaTags,
      issues,
      recommendations,
      score,
      passed: issues.length === 0
    };
  }

  /**
   * Analyze heading structure (H1-H6 hierarchy)
   */
  async analyzeHeadingStructure(page) {
    logger.info('Analyzing heading structure');

    // Use domHelper function for heading extraction
    const headings = await page.evaluate(extractHeadingStructure);

    const issues = [];
    const recommendations = [];

    // H1 checks
    if (headings.h1.length === 0) {
      issues.push('No H1 heading found');
    } else if (headings.h1.length > 1) {
      issues.push(`Multiple H1 headings found (${headings.h1.length}). Use only one H1 per page`);
    }

    // Structure checks
    if (headings.total === 0) {
      issues.push('No headings found on page');
    } else if (headings.total < 3) {
      recommendations.push('Consider adding more headings for better content structure');
    }

    // Check for proper hierarchy (H1 → H2 → H3, etc.)
    let lastLevel = 0;
    let hierarchyIssues = false;
    for (const heading of headings.hierarchy) {
      const currentLevel = parseInt(heading.level.replace('h', ''));
      if (currentLevel > lastLevel + 1 && lastLevel !== 0) {
        hierarchyIssues = true;
        break;
      }
      lastLevel = currentLevel;
    }

    if (hierarchyIssues) {
      recommendations.push('Heading hierarchy has gaps (e.g., H1 → H3). Use sequential heading levels');
    }

    // Use scoring helper
    const score = scoreHeadingStructure(headings);

    return {
      ...headings,
      issues,
      recommendations,
      score,
      passed: issues.length === 0
    };
  }

  /**
   * Analyze content quality and readability
   */
  async analyzeContent(page) {
    logger.info('Analyzing content quality');

    const content = await page.evaluate(() => {
      // Get main content (try to exclude nav, footer, etc.)
      const mainContent = document.querySelector('main') || 
                         document.querySelector('[role="main"]') || 
                         document.querySelector('article') || 
                         document.body;

      const text = mainContent.textContent || '';
      const words = text.trim().split(/\s+/).filter(w => w.length > 0);
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      // Count paragraphs
      const paragraphs = mainContent.querySelectorAll('p').length;
      
      // Get all text content
      const allText = document.body.textContent || '';
      
      return {
        wordCount: words.length,
        sentenceCount: sentences.length,
        paragraphCount: paragraphs,
        characterCount: text.length,
        averageWordsPerSentence: sentences.length > 0 ? 
          Math.round(words.length / sentences.length) : 0,
        textToHTMLRatio: allText.length / document.documentElement.outerHTML.length
      };
    });

    const issues = [];
    const recommendations = [];

    // Word count checks
    if (content.wordCount < 300) {
      issues.push('Low word count (< 300 words). Search engines prefer content-rich pages');
    } else if (content.wordCount < 600) {
      recommendations.push('Consider adding more content. Pages with 600+ words tend to rank better');
    }

    // Readability checks
    if (content.averageWordsPerSentence > 25) {
      recommendations.push('Long sentences detected. Consider shorter sentences for better readability');
    }

    // Text-to-HTML ratio
    if (content.textToHTMLRatio < 0.1) {
      recommendations.push('Low text-to-HTML ratio. Too much code relative to content');
    }

    // Use scoring helper
    const score = scoreContentQuality(content);

    return {
      ...content,
      issues,
      recommendations,
      score,
      passed: issues.length === 0
    };
  }

  /**
   * Analyze images (alt text, file size, format)
   */
  async analyzeImages(page) {
    logger.info('Analyzing images');

    const images = await page.evaluate(() => {
      const imgElements = Array.from(document.querySelectorAll('img'));
      
      return {
        total: imgElements.length,
        withAlt: imgElements.filter(img => img.alt && img.alt.trim().length > 0).length,
        withoutAlt: imgElements.filter(img => !img.alt || img.alt.trim().length === 0).length,
        images: imgElements.slice(0, 50).map(img => ({
          src: img.src,
          alt: img.alt || null,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          loading: img.loading || 'eager'
        }))
      };
    });

    const issues = [];
    const recommendations = [];

    // Alt text checks
    if (images.withoutAlt > 0) {
      issues.push(`${images.withoutAlt} image(s) missing alt text (affects accessibility and SEO)`);
    }

    // Lazy loading recommendation
    const eagerImages = images.images.filter(img => img.loading === 'eager').length;
    if (eagerImages > 5) {
      recommendations.push('Consider using lazy loading for images below the fold');
    }

    // Large images check
    const largeImages = images.images.filter(img => 
      (img.width * img.height) > 1920 * 1080
    ).length;
    
    if (largeImages > 0) {
      recommendations.push(`${largeImages} large image(s) detected. Consider optimizing image sizes`);
    }

    // Use scoring helper
    const score = scoreImageAccessibility(images);

    return {
      ...images,
      issues,
      recommendations,
      score,
      passed: issues.length === 0
    };
  }

  /**
   * Analyze internal and external links
   */
  async analyzeLinks(page) {
    logger.info('Analyzing links');

    const links = await page.evaluate(() => {
      const linkElements = Array.from(document.querySelectorAll('a[href]'));
      const currentDomain = window.location.hostname;
      
      const analyzed = linkElements.map(link => {
        const href = link.href;
        const isExternal = !href.includes(currentDomain) && 
                          (href.startsWith('http://') || href.startsWith('https://'));
        
        return {
          href,
          text: link.textContent.trim().substring(0, 100),
          isExternal,
          hasNoFollow: link.rel.includes('nofollow'),
          hasNoOpener: link.rel.includes('noopener'),
          hasNoReferrer: link.rel.includes('noreferrer'),
          target: link.target
        };
      });

      return {
        total: linkElements.length,
        internal: analyzed.filter(l => !l.isExternal).length,
        external: analyzed.filter(l => l.isExternal).length,
        noFollow: analyzed.filter(l => l.hasNoFollow).length,
        brokenFormat: analyzed.filter(l => 
          !l.href || l.href === '#' || l.href.startsWith('javascript:')
        ).length,
        links: analyzed.slice(0, 100)
      };
    });

    const issues = [];
    const recommendations = [];

    // External links without security attributes
    const unsafeExternal = links.links.filter(link => 
      link.isExternal && 
      link.target === '_blank' && 
      (!link.hasNoOpener || !link.hasNoReferrer)
    ).length;

    if (unsafeExternal > 0) {
      recommendations.push(`${unsafeExternal} external link(s) opening in new tab should have rel="noopener noreferrer"`);
    }

    // Link anchor text
    const emptyAnchors = links.links.filter(l => !l.text || l.text.length === 0).length;
    if (emptyAnchors > 0) {
      issues.push(`${emptyAnchors} link(s) with empty anchor text`);
    }

    // Broken format links
    if (links.brokenFormat > 0) {
      recommendations.push(`${links.brokenFormat} link(s) with potentially broken format (href="#" or javascript:)`);
    }

    // Use scoring helper
    const score = scoreLinkStructure(links);

    return {
      ...links,
      issues,
      recommendations,
      score,
      passed: issues.length === 0
    };
  }

  /**
   * Check mobile responsiveness
   */
  async checkMobileResponsiveness(page) {
    logger.info('Checking mobile responsiveness');

    // Test different viewport sizes
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 }
    ];

    const results = [];
    
    for (const viewport of viewports) {
      await page.setViewport({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(100); // Allow reflow
      
      const metrics = await page.evaluate(() => {
        return {
          hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
          hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
          fontSizeReadable: parseFloat(window.getComputedStyle(document.body).fontSize) >= 14
        };
      });

      results.push({
        viewport: viewport.name,
        width: viewport.width,
        ...metrics
      });
    }

    const issues = [];
    const recommendations = [];

    // Check for horizontal scroll on mobile
    const mobileResult = results.find(r => r.viewport === 'Mobile');
    if (mobileResult && mobileResult.hasHorizontalScroll) {
      issues.push('Horizontal scrolling detected on mobile viewport');
    }

    // Check viewport meta
    if (mobileResult && !mobileResult.hasViewportMeta) {
      issues.push('Missing viewport meta tag (critical for mobile responsiveness)');
    }

    // Check font size
    if (mobileResult && !mobileResult.fontSizeReadable) {
      recommendations.push('Font size may be too small on mobile devices');
    }

    // Use scoring helper
    const score = scoreMobileResponsiveness(results);

    return {
      viewports: results,
      issues,
      recommendations,
      score,
      passed: issues.length === 0
    };
  }

  /**
   * Analyze page performance metrics
   */
  async analyzePerformance(page) {
    logger.info('Analyzing performance metrics');

    const metrics = await page.evaluate(() => {
      const perfData = window.performance.timing;
      const navigation = performance.getEntriesByType('navigation')[0] || {};

      // Calculate max DOM depth with stack overflow protection
      function getMaxDOMDepth(element, maxDepthLimit = 50) {
        if (!element || !element.children || element.children.length === 0) {
          return 0;
        }
        let maxDepth = 0;
        for (let i = 0; i < element.children.length; i++) {
          if (maxDepth >= maxDepthLimit) {
            // Prevent infinite recursion on pathological DOMs
            return maxDepthLimit;
          }
          const depth = getMaxDOMDepth(element.children[i], maxDepthLimit);
          if (depth > maxDepth) {
            maxDepth = depth;
          }
        }
        return maxDepth + 1;
      }

      return {
        // Core metrics
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
        loadComplete: perfData.loadEventEnd - perfData.navigationStart,
        firstPaint: navigation.responseStart - navigation.requestStart,

        // Resource counts
        resources: performance.getEntriesByType('resource').length,

        // Page size estimate
        transferSize: performance.getEntriesByType('resource')
          .reduce((sum, r) => sum + (r.transferSize || 0), 0),

        // DOM stats
        domNodes: document.getElementsByTagName('*').length,
        domDepth: getMaxDOMDepth(document.body, 50)
      };
    });

    const issues = [];
    const recommendations = [];

    // Load time checks
    if (metrics.loadComplete > 3000) {
      issues.push(`Slow page load time (${formatDuration(metrics.loadComplete, 1)}). Target: < 3s`);
    } else if (metrics.loadComplete > 2000) {
      recommendations.push('Page load time could be improved');
    }

    // DOM size checks
    if (metrics.domNodes > 1500) {
      recommendations.push(`Large DOM size (${metrics.domNodes} nodes). Consider simplifying`);
    }

    // Resource count
    if (metrics.resources > 100) {
      recommendations.push(`Many resources loaded (${metrics.resources}). Consider bundling/minification`);
    }

    // Transfer size
    const sizeMB = formatBytes(metrics.transferSize);
    if (metrics.transferSize > 3 * 1024 * 1024) {
      issues.push(`Large page size (${sizeMB}). Optimize images and resources`);
    }

    // Use scoring helper
    const score = scorePerformanceMetrics(metrics);

    return {
      ...metrics,
      loadCompleteSeconds: formatDuration(metrics.loadComplete),
      transferSizeMB: formatBytes(metrics.transferSize),
      issues,
      recommendations,
      score,
      passed: issues.length === 0
    };
  }

  /**
   * Check security headers
   */
  async checkSecurityHeaders(response, url) {
    logger.info('Checking security headers');

    const headers = response.headers();

    const securityHeaders = {
      hasHTTPS: url.startsWith('https://'),
      strictTransportSecurity: headers['strict-transport-security'] || null,
      contentSecurityPolicy: headers['content-security-policy'] || null,
      xFrameOptions: headers['x-frame-options'] || null,
      xContentTypeOptions: headers['x-content-type-options'] || null,
      xXSSProtection: headers['x-xss-protection'] || null,
      referrerPolicy: headers['referrer-policy'] || null
    };

    const issues = [];
    const recommendations = [];

    // HTTPS check
    if (!securityHeaders.hasHTTPS) {
      issues.push('Site not using HTTPS (critical for security and SEO)');
    }

    // Security headers
    if (!securityHeaders.strictTransportSecurity && securityHeaders.hasHTTPS) {
      recommendations.push('Add Strict-Transport-Security header (HSTS)');
    }

    if (!securityHeaders.contentSecurityPolicy) {
      recommendations.push('Add Content-Security-Policy header');
    }

    if (!securityHeaders.xFrameOptions) {
      recommendations.push('Add X-Frame-Options header (prevents clickjacking)');
    }

    if (!securityHeaders.xContentTypeOptions) {
      recommendations.push('Add X-Content-Type-Options header');
    }

    // Use scoring helper
    const score = scoreSecurityHeaders(securityHeaders);

    return {
      ...securityHeaders,
      issues,
      recommendations,
      score,
      passed: issues.length === 0
    };
  }

  /**
   * Analyze structured data (Schema.org, JSON-LD)
   */
  async analyzeStructuredData(page) {
    logger.info('Analyzing structured data');

    const structuredData = await page.evaluate(() => {
      const jsonLdScripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      );
      
      const schemas = jsonLdScripts.map(script => {
        try {
          const data = JSON.parse(script.textContent);
          return {
            type: data['@type'] || 'Unknown',
            valid: true,
            data
          };
        } catch (e) {
          return { type: 'Invalid', valid: false, error: e.message };
        }
      });

      return {
        hasStructuredData: schemas.length > 0,
        count: schemas.length,
        types: schemas.map(s => s.type),
        schemas: schemas.slice(0, 10)
      };
    });

    const issues = [];
    const recommendations = [];

    if (!structuredData.hasStructuredData) {
      recommendations.push('Add structured data (Schema.org/JSON-LD) for rich search results');
    }

    const invalidSchemas = structuredData.schemas.filter(s => !s.valid).length;
    if (invalidSchemas > 0) {
      issues.push(`${invalidSchemas} invalid structured data schema(s) found`);
    }

    // Use scoring helper
    const score = scoreStructuredData(structuredData);

    return {
      ...structuredData,
      issues,
      recommendations,
      score,
      passed: issues.length === 0
    };
  }

  /**
   * Perform additional SEO checks
   */
  async performAdditionalChecks(page, url) {
    logger.info('Performing additional SEO checks');

    const additional = await page.evaluate(() => {
      return {
        hasRobotsTxt: null, // Will check via fetch
        hasSitemap: null, // Will check via fetch
        hasFavicon: !!document.querySelector('link[rel*="icon"]'),
        has404Page: null, // Would need separate check
        googleAnalytics: !!document.querySelector('script[src*="google-analytics"]') ||
                        !!document.querySelector('script[src*="gtag"]') ||
                        !!document.querySelector('script[src*="analytics.js"]'),
        socialLinks: {
          facebook: !!document.querySelector('a[href*="facebook.com"]'),
          twitter: !!document.querySelector('a[href*="twitter.com"]') || 
                   !!document.querySelector('a[href*="x.com"]'),
          linkedin: !!document.querySelector('a[href*="linkedin.com"]'),
          instagram: !!document.querySelector('a[href*="instagram.com"]')
        }
      };
    }, url);

    // Check robots.txt and sitemap.xml in parallel using fetch with timeout protection
    try {
      const [robotsExists, sitemapExists] = await page.evaluate(async (baseUrl) => {
        const checkUrl = async (path) => {
          try {
            // Add 5-second timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(new URL(path, baseUrl).href, {
              method: 'HEAD',
              signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response.ok;
          } catch {
            return false;
          }
        };

        return await Promise.all([
          checkUrl('/robots.txt'),
          checkUrl('/sitemap.xml')
        ]);
      }, url);

      additional.hasRobotsTxt = robotsExists;
      additional.hasSitemap = sitemapExists;
    } catch (e) {
      logger.warn('Failed to check robots.txt/sitemap', { error: e.message });
      additional.hasRobotsTxt = false;
      additional.hasSitemap = false;
    }

    const issues = [];
    const recommendations = [];

    if (!additional.hasRobotsTxt) {
      recommendations.push('Add robots.txt file for better crawl control');
    }

    if (!additional.hasSitemap) {
      recommendations.push('Add XML sitemap for better indexing');
    }

    if (!additional.hasFavicon) {
      recommendations.push('Add favicon for better branding');
    }

    if (!additional.googleAnalytics) {
      recommendations.push('Consider adding Google Analytics for traffic insights');
    }

    const score = this.scoreAdditionalChecks(additional, issues);

    return {
      ...additional,
      issues,
      recommendations,
      score,
      passed: issues.length === 0
    };
  }

  /**
   * Calculate overall SEO score
   */
  calculateSEOScore(results) {
    const weights = {
      metaTags: 20,
      headingStructure: 10,
      contentAnalysis: 15,
      imageAnalysis: 10,
      linkAnalysis: 10,
      mobileResponsive: 15,
      performanceMetrics: 10,
      securityHeaders: 5,
      structuredData: 3,
      additionalChecks: 2
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
      if (results[key] && typeof results[key].score === 'number') {
        totalScore += results[key].score * weight;
        totalWeight += weight;
      }
    }

    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    // Use scoring helper for grade
    const grade = scoreToGrade(finalScore);

    return {
      overall: finalScore,
      grade,
      breakdown: Object.keys(weights).reduce((acc, key) => {
        if (results[key] && typeof results[key].score === 'number') {
          acc[key] = {
            score: results[key].score,
            weight: weights[key],
            contribution: Math.round((results[key].score * weights[key]) / totalWeight * 100) / 100
          };
        }
        return acc;
      }, {})
    };
  }

  // Scoring helper methods
  // Most scoring moved to scoringHelpers.js - keeping only SEO-specific ones here

  scoreAdditionalChecks(checks) {
    let score = 100;
    if (!checks.hasRobotsTxt) score -= 20;
    if (!checks.hasSitemap) score -= 25;
    if (!checks.hasFavicon) score -= 15;
    if (!checks.googleAnalytics) score -= 15;
    return Math.max(0, score);
  }
}

// Export singleton instance
module.exports = new SEOAnalyzer();
