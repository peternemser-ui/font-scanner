/**
 * Performance Snapshot Analyzer
 * Lightweight performance analysis without Lighthouse overhead
 */

const cheerio = require('cheerio');
const browserPool = require('../utils/browserPool');
const { roundTo, formatNumber } = require('../utils/formatHelpers');

class PerformanceSnapshotAnalyzer {
  constructor() {
    this.startTime = null;
    this.responseTime = null;
  }

  /**
   * Analyze page performance
   */
  async analyzePerformance(url) {
    try {
      this.startTime = Date.now();

      // Use browser pool to bypass bot protection
      const { html, timing, resourceCounts } = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Track resources loaded
        const resources = {
          scripts: 0,
          stylesheets: 0,
          images: 0,
          fonts: 0,
          other: 0,
          totalBytes: 0
        };
        
        page.on('response', async (response) => {
          try {
            const resourceType = response.request().resourceType();
            const contentLength = parseInt(response.headers()['content-length'] || '0', 10);
            resources.totalBytes += contentLength;
            
            if (resourceType === 'script') resources.scripts++;
            else if (resourceType === 'stylesheet') resources.stylesheets++;
            else if (resourceType === 'image') resources.images++;
            else if (resourceType === 'font') resources.fonts++;
            else resources.other++;
          } catch (e) {
            // Ignore resource tracking errors
          }
        });
        
        const startNav = Date.now();

        // Use domcontentloaded for better compatibility with sites that have continuous network activity
        // This is more forgiving than networkidle2 which can timeout on sites with analytics, chat widgets, etc.
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        // Wait for additional resources to load (but don't require network idle)
        await page.waitForTimeout(3000);

        const responseTime = Date.now() - startNav;
        
        const pageHtml = await page.content();
        
        await page.close();
        
        return { 
          html: pageHtml, 
          timing: { responseTime },
          resourceCounts: resources
        };
      });

      this.responseTime = timing.responseTime;

      const $ = cheerio.load(html);
      const htmlSize = Buffer.byteLength(html, 'utf8');

      const analysis = {
        url,
        analyzedAt: new Date().toISOString(),
        timing: {
          serverResponseTime: this.responseTime,
          ttfb: this.responseTime // Approximate TTFB
        },
        resources: {
          html: {
            size: htmlSize,
            sizeKB: formatNumber(htmlSize / 1024, 2)
          },
          actualCounts: resourceCounts, // Actual counts from Puppeteer network tracking
          renderBlocking: await this.detectRenderBlockingResources($, url),
          css: await this.analyzeCSSResources($, url),
          js: await this.analyzeJSResources($, url),
          images: await this.analyzeImages($, url),
          fonts: await this.analyzeFontResources($, url),
          thirdParty: this.detectThirdPartyResources($, url)
        },
        summary: {},
        issues: [],
        recommendations: [],
        performanceScore: 0
      };

      // Calculate summary
      analysis.summary = this.calculateSummary(analysis);

      // Detect issues
      analysis.issues = this.detectIssues(analysis);

      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis);

      // Calculate performance score
      analysis.performanceScore = this.calculatePerformanceScore(analysis);
      return analysis;

    } catch (error) {
      console.error(`Error analyzing performance for ${url}:`, error.message);

      // Provide user-friendly error messages
      let errorMessage = error.message;
      if (error.message.includes('Navigation timeout') || error.message.includes('timeout')) {
        errorMessage = `The website took too long to load (>60 seconds). This could indicate performance issues or the site may be temporarily slow. Try again later or test a different page.`;
      } else if (error.message.includes('net::ERR_')) {
        errorMessage = `Unable to connect to the website. Please check the URL and try again.`;
      }

      return {
        url,
        error: errorMessage,
        performanceScore: 0
      };
    }
  }

  /**
   * Detect render-blocking resources
   */
  detectRenderBlockingResources($, baseUrl) {
    const blocking = {
      css: [],
      js: [],
      count: 0
    };

    // CSS in <head>
    $('head link[rel="stylesheet"]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        blocking.css.push({
          url: this.resolveUrl(href, baseUrl),
          location: 'head',
          blocking: true
        });
      }
    });

    // Synchronous scripts in <head>
    $('head script[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      const async = $(elem).attr('async') !== undefined;
      const defer = $(elem).attr('defer') !== undefined;

      if (src && !async && !defer) {
        blocking.js.push({
          url: this.resolveUrl(src, baseUrl),
          location: 'head',
          blocking: true
        });
      }
    });

    blocking.count = blocking.css.length + blocking.js.length;

    return blocking;
  }

  /**
   * Analyze CSS resources
   */
  analyzeCSSResources($, baseUrl) {
    const css = {
      files: [],
      inline: [],
      totalFiles: 0,
      totalInline: 0,
      estimatedSizeKB: 0
    };

    // External CSS
    $('link[rel="stylesheet"]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        css.files.push({
          url: this.resolveUrl(href, baseUrl),
          media: $(elem).attr('media') || 'all'
        });
      }
    });

    // Inline CSS
    $('style').each((i, elem) => {
      const content = $(elem).html() || '';
      const sizeBytes = Buffer.byteLength(content, 'utf8');

      css.inline.push({
        index: i,
        sizeBytes,
        sizeKB: formatNumber(sizeBytes / 1024, 2)
      });
    });

    css.totalFiles = css.files.length;
    css.totalInline = css.inline.length;
    css.estimatedSizeKB = css.inline.reduce((sum, s) => sum + parseFloat(s.sizeKB), 0) +
                          (css.files.length * 30); // Estimate 30KB per external CSS

    return css;
  }

  /**
   * Analyze JavaScript resources
   */
  analyzeJSResources($, baseUrl) {
    const js = {
      files: [],
      inline: [],
      async: [],
      defer: [],
      totalFiles: 0,
      totalInline: 0,
      estimatedSizeKB: 0
    };

    // External JS
    $('script[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      const async = $(elem).attr('async') !== undefined;
      const defer = $(elem).attr('defer') !== undefined;

      if (src) {
        const script = {
          url: this.resolveUrl(src, baseUrl),
          async,
          defer,
          location: $(elem).closest('head').length > 0 ? 'head' : 'body'
        };

        js.files.push(script);

        if (async) js.async.push(script);
        if (defer) js.defer.push(script);
      }
    });

    // Inline JS
    $('script:not([src])').each((i, elem) => {
      const content = $(elem).html() || '';
      const sizeBytes = Buffer.byteLength(content, 'utf8');

      js.inline.push({
        index: i,
        sizeBytes,
        sizeKB: formatNumber(sizeBytes / 1024, 2)
      });
    });

    js.totalFiles = js.files.length;
    js.totalInline = js.inline.length;
    js.estimatedSizeKB = js.inline.reduce((sum, s) => sum + parseFloat(s.sizeKB), 0) +
                         (js.files.length * 50); // Estimate 50KB per external JS

    return js;
  }

  /**
   * Analyze images
   */
  analyzeImages($, baseUrl) {
    const images = {
      total: 0,
      withoutAlt: 0,
      lazyLoaded: 0,
      formats: {},
      largest: []
    };

    // Valid image format extensions
    const validFormats = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif', 'ico', 'bmp', 'tiff', 'tif'];

    $('img').each((i, elem) => {
      images.total++;

      const src = $(elem).attr('src');
      const alt = $(elem).attr('alt');
      const loading = $(elem).attr('loading');

      if (!alt) images.withoutAlt++;
      if (loading === 'lazy') images.lazyLoaded++;

      // Detect format - only count valid image extensions
      if (src) {
        const ext = src.split('.').pop().split('?')[0].toLowerCase().substring(0, 10);
        if (validFormats.includes(ext)) {
          images.formats[ext] = (images.formats[ext] || 0) + 1;
        } else {
          // Count dynamic/unknown images as 'dynamic'
          images.formats['dynamic'] = (images.formats['dynamic'] || 0) + 1;
        }
      }
    });

    return images;
  }

  /**
   * Analyze font resources
   */
  async analyzeFontResources($, baseUrl) {
    const fonts = {
      preloaded: 0,
      withoutDisplay: 0,
      providers: new Set(),
      issues: []
    };

    // Check preloads
    $('link[rel="preload"][as="font"]').each(() => {
      fonts.preloaded++;
    });

    // Check Google Fonts
    $('link[href*="fonts.googleapis.com"]').each(() => {
      fonts.providers.add('Google Fonts');
    });

    // Check Adobe Fonts
    $('script[src*="typekit.net"]').each(() => {
      fonts.providers.add('Adobe Fonts');
    });

    // Check @font-face
    $('style').each((i, elem) => {
      const content = $(elem).html() || '';
      const fontFaces = content.match(/@font-face/g);

      if (fontFaces) {
        // Check for missing font-display
        const withoutDisplay = content.match(/@font-face\s*\{[^}]*\}/g)?.filter(ff => {
          return !ff.includes('font-display');
        });

        if (withoutDisplay) {
          fonts.withoutDisplay += withoutDisplay.length;
        }
      }
    });

    if (fonts.withoutDisplay > 0) {
      fonts.issues.push({
        type: 'font-display',
        count: fonts.withoutDisplay,
        severity: 'medium',
        message: `${fonts.withoutDisplay} @font-face declarations missing font-display`
      });
    }

    if (fonts.providers.size > 0 && fonts.preloaded === 0) {
      fonts.issues.push({
        type: 'preload',
        severity: 'medium',
        message: 'Web fonts detected but no font preloads found'
      });
    }

    fonts.providers = Array.from(fonts.providers);

    return fonts;
  }

  /**
   * Detect third-party resources
   */
  detectThirdPartyResources($, baseUrl) {
    const thirdParty = {
      count: 0,
      domains: new Set(),
      categories: {}
    };

    try {
      const baseDomain = new URL(baseUrl).hostname;

      // Check all external resources
      $('script[src], link[href], img[src]').each((i, elem) => {
        const url = $(elem).attr('src') || $(elem).attr('href');

        if (url && url.startsWith('http')) {
          try {
            const resourceDomain = new URL(url).hostname;

            if (resourceDomain !== baseDomain) {
              thirdParty.count++;
              thirdParty.domains.add(resourceDomain);

              // Categorize
              const category = this.categorizeThirdParty(resourceDomain);
              thirdParty.categories[category] = (thirdParty.categories[category] || 0) + 1;
            }
          } catch (error) {
            // Invalid URL
          }
        }
      });

      thirdParty.domains = Array.from(thirdParty.domains);

    } catch (error) {
      console.error('Error detecting third-party resources:', error);
    }

    return thirdParty;
  }

  /**
   * Categorize third-party domain
   */
  categorizeThirdParty(domain) {
    if (domain.includes('google') || domain.includes('gtag') || domain.includes('analytics')) {
      return 'Analytics';
    }
    if (domain.includes('facebook') || domain.includes('doubleclick') || domain.includes('ads')) {
      return 'Advertising';
    }
    if (domain.includes('cdn') || domain.includes('cloudflare') || domain.includes('jsdelivr')) {
      return 'CDN';
    }
    if (domain.includes('font')) {
      return 'Fonts';
    }
    return 'Other';
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(analysis) {
    // Use actual counts from Puppeteer if available
    const actualCounts = analysis.resources.actualCounts || {};
    const totalActualRequests = (actualCounts.scripts || 0) + 
                                 (actualCounts.stylesheets || 0) + 
                                 (actualCounts.images || 0) + 
                                 (actualCounts.fonts || 0) + 
                                 (actualCounts.other || 0) + 1; // +1 for HTML
    
    // Use actual byte count if available, otherwise estimate
    const actualPageWeight = actualCounts.totalBytes > 0 
      ? formatNumber(actualCounts.totalBytes / 1024, 2)
      : parseFloat(analysis.resources.html.sizeKB) +
        analysis.resources.css.estimatedSizeKB +
        analysis.resources.js.estimatedSizeKB +
        (analysis.resources.images.total * 50);

    return {
      totalRequests: totalActualRequests > 1 ? totalActualRequests : 
                     1 + analysis.resources.css.totalFiles +
                     analysis.resources.js.totalFiles +
                     analysis.resources.images.total +
                     analysis.resources.thirdParty.count,

      estimatedPageWeightKB: parseFloat(actualPageWeight),

      renderBlockingCount: analysis.resources.renderBlocking.count,

      thirdPartyRequests: analysis.resources.thirdParty.count,

      serverResponseTime: analysis.timing.serverResponseTime
    };
  }

  /**
   * Detect performance issues
   */
  detectIssues(analysis) {
    const issues = [];

    // Slow server response
    if (analysis.timing.serverResponseTime > 1000) {
      issues.push({
        type: 'server',
        severity: 'high',
        message: `Slow server response time: ${analysis.timing.serverResponseTime}ms`,
        recommendation: 'Optimize server performance or use a CDN'
      });
    }

    // Too many render-blocking resources
    if (analysis.resources.renderBlocking.count > 3) {
      issues.push({
        type: 'render-blocking',
        severity: 'high',
        message: `${analysis.resources.renderBlocking.count} render-blocking resources`,
        recommendation: 'Defer or async non-critical CSS/JS, inline critical CSS'
      });
    }

    // Too many requests
    if (analysis.summary.totalRequests > 100) {
      issues.push({
        type: 'requests',
        severity: 'medium',
        message: `${analysis.summary.totalRequests} total requests`,
        recommendation: 'Reduce HTTP requests through bundling and lazy loading'
      });
    }

    // Large page weight
    if (analysis.summary.estimatedPageWeightKB > 2000) {
      issues.push({
        type: 'page-weight',
        severity: 'medium',
        message: `Large page weight: ${formatNumber(analysis.summary.estimatedPageWeightKB, 0)}KB`,
        recommendation: 'Optimize images, minify CSS/JS, use compression'
      });
    }

    // Too much JavaScript
    if (analysis.resources.js.totalFiles > 10) {
      issues.push({
        type: 'javascript',
        severity: 'medium',
        message: `${analysis.resources.js.totalFiles} JavaScript files`,
        recommendation: 'Bundle JavaScript files and code-split large bundles'
      });
    }

    // Font issues
    analysis.resources.fonts.issues.forEach(issue => {
      issues.push(issue);
    });

    return issues;
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    // Likely causes based on issues
    const likelyCauses = [];

    if (analysis.resources.images.total > 20) {
      likelyCauses.push('Image bloat');
      recommendations.push({
        priority: 'high',
        category: 'images',
        title: 'Optimize Images',
        impact: 'Large performance gains',
        actions: [
          'Use modern formats (WebP, AVIF)',
          'Implement lazy loading',
          'Add responsive images with srcset',
          'Compress images'
        ]
      });
    }

    if (analysis.resources.js.estimatedSizeKB > 500) {
      likelyCauses.push('Heavy JavaScript');
      recommendations.push({
        priority: 'high',
        category: 'javascript',
        title: 'Reduce JavaScript',
        impact: 'Faster parsing and execution',
        actions: [
          'Remove unused JavaScript',
          'Code-split large bundles',
          'Defer non-critical scripts',
          'Use tree-shaking'
        ]
      });
    }

    if (analysis.resources.thirdParty.count > 10) {
      likelyCauses.push('Third-party scripts');
      recommendations.push({
        priority: 'medium',
        category: 'third-party',
        title: 'Optimize Third-Party Scripts',
        impact: 'Reduced blocking time',
        actions: [
          'Load third-party scripts async',
          'Self-host critical resources',
          'Remove unnecessary tracking scripts'
        ]
      });
    }

    if (analysis.resources.renderBlocking.count > 0) {
      recommendations.push({
        priority: 'high',
        category: 'critical-path',
        title: 'Eliminate Render-Blocking Resources',
        impact: 'Faster First Contentful Paint',
        actions: [
          'Inline critical CSS',
          'Defer non-critical CSS',
          'Add async/defer to scripts',
          'Preload key resources'
        ]
      });
    }

    return {
      likelyCauses,
      recommendations
    };
  }

  /**
   * Calculate performance score (0-100)
   */
  calculatePerformanceScore(analysis) {
    let score = 100;

    // Deduct for slow server (max 15 points, starts at 1000ms)
    if (analysis.timing.serverResponseTime > 1000) {
      score -= Math.min(15, (analysis.timing.serverResponseTime - 1000) / 500);
    }

    // Deduct for render-blocking (max 20 points, diminishing returns)
    const renderBlockingCount = analysis.resources.renderBlocking.count || 0;
    if (renderBlockingCount > 3) {
      score -= Math.min(20, Math.log2(renderBlockingCount) * 3);
    }

    // Deduct for too many requests (max 15 points, starts at 100)
    if (analysis.summary.totalRequests > 100) {
      score -= Math.min(15, (analysis.summary.totalRequests - 100) / 30);
    }

    // Deduct for page weight (max 15 points, starts at 2MB)
    if (analysis.summary.estimatedPageWeightKB > 2000) {
      score -= Math.min(15, (analysis.summary.estimatedPageWeightKB - 2000) / 500);
    }

    // Deduct for high-severity issues (max 15 points)
    const highIssues = analysis.issues.filter(i => i.severity === 'high').length;
    score -= Math.min(15, highIssues * 5);

    // Ensure minimum score of 10 if we got valid data
    if (analysis.summary.totalRequests > 0) {
      score = Math.max(10, score);
    }

    return Math.max(0, Math.min(100, roundTo(score, 0)));
  }

  /**
   * Resolve relative URLs
   */
  resolveUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch (error) {
      return url;
    }
  }
}

module.exports = new PerformanceSnapshotAnalyzer();
