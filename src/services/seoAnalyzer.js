/**
 * SEO Analyzer Service
 * Comprehensive SEO analysis including meta tags, content, performance, and best practices
 */

const { createLogger } = require('../utils/logger');
const browserPool = require('../utils/browserPool');

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

    const results = await browserPool.execute(async (browser) => {
      const page = await browser.newPage();
      
      try {
  // Use a realistic desktop profile
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Navigate to page with timeout and capture response
        logger.info('Navigating to page', { url });
        const response = await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: this.timeout
        });
        logger.info('Navigation completed', { url, status: response ? response.status() : 'unknown' });

        // Check for bot detection / access denied
        if (response && (response.status() === 403 || response.status() === 429)) {
          throw new Error(`Access denied (${response.status()}). This website uses bot protection and cannot be analyzed.`);
        }

        // Check page content for common bot detection patterns
        const pageContent = await page.content();
        const botDetectionPatterns = [
          /cloudflare/i,
          /captcha/i,
          /bot[\s-]?detection/i,
          /access[\s-]?denied/i,
          /checking your browser/i,
          /ray id:/i // Cloudflare Ray ID
        ];

        const hasBotDetection = botDetectionPatterns.some(pattern => pattern.test(pageContent));
        if (hasBotDetection) {
          // Double-check by looking for title
          const title = await page.title();
          logger.warn('Bot detection patterns found', { url, title });
          if (title.toLowerCase().includes('attention required') || 
              title.toLowerCase().includes('just a moment') ||
              title.toLowerCase().includes('access denied')) {
            throw new Error('Bot protection detected. This website blocks automated analysis. Try a different website or contact the site owner.');
          }
        }

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

    logger.info('SEO analysis completed', { url, score: results.score });
    return results;
  }

  /**
   * Analyze meta tags (title, description, keywords, OG, Twitter cards)
   */
  async analyzeMetaTags(page) {
    logger.info('Analyzing meta tags');

    const metaTags = await page.evaluate(() => {
      const getMetaContent = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.content || element.textContent : null;
      };

      return {
        title: document.title || null,
        titleLength: document.title ? document.title.length : 0,
        description: getMetaContent('meta[name="description"]'),
        descriptionLength: getMetaContent('meta[name="description"]')?.length || 0,
        keywords: getMetaContent('meta[name="keywords"]'),
        robots: getMetaContent('meta[name="robots"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.href || null,
        viewport: getMetaContent('meta[name="viewport"]'),
        
        // Open Graph
        ogTitle: getMetaContent('meta[property="og:title"]'),
        ogDescription: getMetaContent('meta[property="og:description"]'),
        ogImage: getMetaContent('meta[property="og:image"]'),
        ogUrl: getMetaContent('meta[property="og:url"]'),
        ogType: getMetaContent('meta[property="og:type"]'),
        
        // Twitter Cards
        twitterCard: getMetaContent('meta[name="twitter:card"]'),
        twitterTitle: getMetaContent('meta[name="twitter:title"]'),
        twitterDescription: getMetaContent('meta[name="twitter:description"]'),
        twitterImage: getMetaContent('meta[name="twitter:image"]'),
        
        // Additional
        language: document.documentElement.lang || null,
        charset: document.characterSet || null
      };
    });

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

    const score = this.scoreMetaTags(metaTags, issues);

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

    const headings = await page.evaluate(() => {
      const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      
      return {
        h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()),
        h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()),
        h3: Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim()),
        h4: Array.from(document.querySelectorAll('h4')).map(h => h.textContent.trim()),
        h5: Array.from(document.querySelectorAll('h5')).map(h => h.textContent.trim()),
        h6: Array.from(document.querySelectorAll('h6')).map(h => h.textContent.trim()),
        total: headingElements.length,
        hierarchy: Array.from(headingElements).map(h => ({
          level: h.tagName.toLowerCase(),
          text: h.textContent.trim().substring(0, 100)
        }))
      };
    });

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

    const score = this.scoreHeadings(headings, issues);

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

    const score = this.scoreContent(content, issues);

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

    const score = this.scoreImages(images, issues);

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

    const score = this.scoreLinks(links, issues);

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
      await page.waitForTimeout(500); // Allow reflow
      
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

    const score = this.scoreMobileResponsiveness(results, issues);

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
      
      // Calculate max DOM depth
      function getMaxDOMDepth(element) {
        if (!element || !element.children || element.children.length === 0) {
          return 0;
        }
        let maxDepth = 0;
        for (let i = 0; i < element.children.length; i++) {
          const depth = getMaxDOMDepth(element.children[i]);
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
        domDepth: getMaxDOMDepth(document.body)
      };
    });

    const issues = [];
    const recommendations = [];

    // Load time checks
    if (metrics.loadComplete > 3000) {
      issues.push(`Slow page load time (${(metrics.loadComplete / 1000).toFixed(1)}s). Target: < 3s`);
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
    const sizeMB = (metrics.transferSize / 1024 / 1024).toFixed(2);
    if (metrics.transferSize > 3 * 1024 * 1024) {
      issues.push(`Large page size (${sizeMB} MB). Optimize images and resources`);
    }

    const score = this.scorePerformance(metrics, issues);

    return {
      ...metrics,
      loadCompleteSeconds: (metrics.loadComplete / 1000).toFixed(2),
      transferSizeMB: sizeMB,
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

    const score = this.scoreSecurityHeaders(securityHeaders, issues);

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

    const score = this.scoreStructuredData(structuredData, issues);

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

    // Check robots.txt
    try {
      const robotsUrl = new URL('/robots.txt', url).href;
      const robotsResponse = await page.goto(robotsUrl, { waitUntil: 'networkidle2', timeout: 5000 });
      additional.hasRobotsTxt = robotsResponse.status() === 200;
    } catch (e) {
      additional.hasRobotsTxt = false;
    }

    // Check sitemap
    try {
      const sitemapUrl = new URL('/sitemap.xml', url).href;
      const sitemapResponse = await page.goto(sitemapUrl, { waitUntil: 'networkidle2', timeout: 5000 });
      additional.hasSitemap = sitemapResponse.status() === 200;
    } catch (e) {
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

    // Determine grade
    let grade = 'F';
    if (finalScore >= 90) grade = 'A';
    else if (finalScore >= 80) grade = 'B';
    else if (finalScore >= 70) grade = 'C';
    else if (finalScore >= 60) grade = 'D';

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
  scoreMetaTags(meta) {
    let score = 100;
    if (!meta.title) score -= 20;
    if (!meta.description) score -= 20;
    if (meta.titleLength < 30 || meta.titleLength > 60) score -= 10;
    if (meta.descriptionLength < 120 || meta.descriptionLength > 160) score -= 10;
    if (!meta.ogTitle && !meta.ogDescription) score -= 15;
    if (!meta.viewport) score -= 15;
    if (!meta.language) score -= 10;
    return Math.max(0, score);
  }

  scoreHeadings(headings) {
    let score = 100;
    if (headings.h1.length === 0) score -= 30;
    if (headings.h1.length > 1) score -= 20;
    if (headings.total === 0) score -= 40;
    if (headings.total < 3) score -= 10;
    return Math.max(0, score);
  }

  scoreContent(content) {
    let score = 100;
    if (content.wordCount < 300) score -= 30;
    else if (content.wordCount < 600) score -= 10;
    if (content.averageWordsPerSentence > 25) score -= 10;
    if (content.textToHTMLRatio < 0.1) score -= 15;
    return Math.max(0, score);
  }

  scoreImages(images) {
    let score = 100;
    if (images.total > 0) {
      const altRatio = images.withAlt / images.total;
      if (altRatio < 0.5) score -= 40;
      else if (altRatio < 0.8) score -= 20;
      else if (altRatio < 1.0) score -= 10;
    }
    return Math.max(0, score);
  }

  scoreLinks(links) {
    let score = 100;
    if (links.brokenFormat > 0) score -= 20;
    const emptyAnchors = links.links.filter(l => !l.text).length;
    if (emptyAnchors > 0) score -= 15;
    return Math.max(0, score);
  }

  scoreMobileResponsiveness(results) {
    let score = 100;
    const mobileResult = results.find(r => r.viewport === 'Mobile');
    if (mobileResult) {
      if (mobileResult.hasHorizontalScroll) score -= 30;
      if (!mobileResult.hasViewportMeta) score -= 40;
      if (!mobileResult.fontSizeReadable) score -= 10;
    }
    return Math.max(0, score);
  }

  scorePerformance(metrics) {
    let score = 100;
    if (metrics.loadComplete > 5000) score -= 40;
    else if (metrics.loadComplete > 3000) score -= 20;
    else if (metrics.loadComplete > 2000) score -= 10;
    
    if (metrics.domNodes > 2000) score -= 15;
    else if (metrics.domNodes > 1500) score -= 10;
    
    if (metrics.transferSize > 5 * 1024 * 1024) score -= 25;
    else if (metrics.transferSize > 3 * 1024 * 1024) score -= 15;
    
    return Math.max(0, score);
  }

  scoreSecurityHeaders(headers) {
    let score = 100;
    if (!headers.hasHTTPS) score -= 50;
    if (!headers.strictTransportSecurity && headers.hasHTTPS) score -= 15;
    if (!headers.contentSecurityPolicy) score -= 10;
    if (!headers.xFrameOptions) score -= 10;
    if (!headers.xContentTypeOptions) score -= 10;
    return Math.max(0, score);
  }

  scoreStructuredData(data) {
    let score = 100;
    if (!data.hasStructuredData) score -= 40;
    const invalidCount = data.schemas.filter(s => !s.valid).length;
    score -= invalidCount * 20;
    return Math.max(0, score);
  }

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
