/**
 * Performance Analyzer Service
 * Provides comprehensive website performance analysis using Puppeteer and Lighthouse
 */

const browserPool = require('../utils/browserPool');
const lighthouseAnalyzer = require('./lighthouseAnalyzer');
const { createLogger } = require('../utils/logger');
const logger = createLogger('PerformanceAnalyzer');

class PerformanceAnalyzerService {
  /**
   * Perform comprehensive performance analysis
   * @param {string} url - URL to analyze
   * @returns {Object} Performance analysis results
   */
  async analyzePerformance(url) {
    const startTime = Date.now();
    logger.info(`Starting performance analysis for: ${url}`);

    try {
      // Collect Puppeteer metrics first (always works)
      logger.info('Collecting resource metrics via Puppeteer...');
      const resourceMetrics = await this.collectResourceMetrics(url);
      
      // Try Lighthouse with timeout, fallback if fails
      let desktopLighthouse, mobileLighthouse;
      
      try {
        logger.info('Attempting Lighthouse desktop analysis...');
        desktopLighthouse = await Promise.race([
          lighthouseAnalyzer.analyzeWithLighthouse(url, { formFactor: 'desktop' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Lighthouse timeout')), 30000))
        ]);
      } catch (lhError) {
        logger.warn(`Lighthouse desktop failed, using Puppeteer-only score: ${lhError.message}`);
        desktopLighthouse = this.createPuppeteerFallback(resourceMetrics, 'desktop');
      }
      
      try {
        logger.info('Attempting Lighthouse mobile analysis...');
        mobileLighthouse = await Promise.race([
          lighthouseAnalyzer.analyzeWithLighthouse(url, { formFactor: 'mobile' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Lighthouse timeout')), 30000))
        ]);
      } catch (lhError) {
        logger.warn(`Lighthouse mobile failed, using Puppeteer-only score: ${lhError.message}`);
        mobileLighthouse = this.createPuppeteerFallback(resourceMetrics, 'mobile');
      }

      // Combine and process results
      const results = this.processResults(url, resourceMetrics, desktopLighthouse, mobileLighthouse, startTime);
      
      logger.info(`Performance analysis completed for: ${url} (Desktop: ${results.desktop.performanceScore}, Mobile: ${results.mobile.performanceScore})`);
      return results;

    } catch (error) {
      logger.error(`Performance analysis failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Collect resource loading metrics using Puppeteer
   */
  async collectResourceMetrics(url) {
    return browserPool.execute(async (browser) => {
      const page = await browser.newPage();
      const resources = [];
      const timing = {};
      
      try {
        // Track all network requests
        page.on('response', async (response) => {
          try {
            const request = response.request();
            const resourceType = request.resourceType();
            const url = request.url();
            
            // Get response headers for caching info
            const headers = response.headers();
            const status = response.status();
            
            resources.push({
              url,
              type: resourceType,
              status,
              size: parseInt(headers['content-length'] || 0),
              mimeType: headers['content-type'] || 'unknown',
              cached: !!headers['cache-control'] || !!headers['expires'],
              cacheControl: headers['cache-control'] || null,
              timing: response.timing()
            });
          } catch (err) {
            // Ignore individual resource errors
          }
        });

        // Navigate and wait for load
        const response = await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Get performance timing
        timing.navigation = await page.evaluate(() => {
          const perf = performance.getEntriesByType('navigation')[0];
          return {
            domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
            loadComplete: perf.loadEventEnd - perf.loadEventStart,
            domInteractive: perf.domInteractive - perf.fetchStart,
            ttfb: perf.responseStart - perf.requestStart,
            dns: perf.domainLookupEnd - perf.domainLookupStart,
            tcp: perf.connectEnd - perf.connectStart,
            ssl: perf.secureConnectionStart > 0 ? perf.connectEnd - perf.secureConnectionStart : 0,
            request: perf.responseStart - perf.requestStart,
            response: perf.responseEnd - perf.responseStart,
            domProcessing: perf.domComplete - perf.domLoading,
            totalLoadTime: perf.loadEventEnd - perf.fetchStart
          };
        });

        // Get Core Web Vitals from the page
        timing.webVitals = await page.evaluate(() => {
          return new Promise((resolve) => {
            const vitals = { lcp: null, fid: null, cls: null, fcp: null };
            let clsValue = 0;
            let clsEntries = [];
            
            // LCP
            if (window.PerformanceObserver) {
              try {
                const lcpObserver = new PerformanceObserver((list) => {
                  const entries = list.getEntries();
                  const lastEntry = entries[entries.length - 1];
                  vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
                });
                lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
              } catch (e) {
                // Observer not supported
              }

              // FCP
              try {
                const fcpObserver = new PerformanceObserver((list) => {
                  const entries = list.getEntries();
                  for (const entry of entries) {
                    if (entry.name === 'first-contentful-paint') {
                      vitals.fcp = entry.startTime;
                      break;
                    }
                  }
                });
                fcpObserver.observe({ type: 'paint', buffered: true });
              } catch (e) {
                // Observer not supported
              }

              // CLS - Accumulate all layout shift values
              try {
                const clsObserver = new PerformanceObserver((list) => {
                  for (const entry of list.getEntries()) {
                    // Only count layout shifts without recent user input
                    if (!entry.hadRecentInput) {
                      clsValue += entry.value;
                      clsEntries.push({
                        value: entry.value,
                        time: entry.startTime
                      });
                    }
                  }
                });
                clsObserver.observe({ type: 'layout-shift', buffered: true });
              } catch (e) {
                // Observer not supported
              }
            }

            // Wait longer for metrics to settle, especially CLS
            setTimeout(() => {
              vitals.cls = clsValue;
              vitals.clsEntries = clsEntries.length;
              resolve(vitals);
            }, 3000); // Increased from 2000 to 3000ms for better CLS capture
          });
        });

        // Get page size
        const pageSize = resources.reduce((sum, r) => sum + (r.size || 0), 0);

        return {
          resources,
          timing,
          pageSize,
          status: response.status(),
          url: response.url()
        };

      } finally {
        await page.close();
      }
    });
  }

  /**
   * Create Puppeteer-only fallback when Lighthouse fails
   * Calculate score based on resource metrics
   */
  createPuppeteerFallback(resourceMetrics, formFactor) {
    // Calculate score based on resource size and count
    let score = 100;
    
    const totalSize = resourceMetrics.totalSize || 0;
    const totalRequests = resourceMetrics.totalResources || 0;
    
    // Penalize for large page size (MB)
    const sizeMB = totalSize / (1024 * 1024);
    if (sizeMB > 3) score -= Math.min((sizeMB - 3) * 10, 30);
    
    // Penalize for too many requests
    if (totalRequests > 100) score -= Math.min((totalRequests - 100) * 0.5, 20);
    
    // Penalize for slow load time
    const loadTime = resourceMetrics.timings?.loadComplete || 0;
    if (loadTime > 3000) score -= Math.min((loadTime - 3000) / 200, 25);
    
    // Mobile penalty
    if (formFactor === 'mobile') score -= 10;
    
    score = Math.max(score, 30); // Floor at 30
    
    logger.info(`Puppeteer fallback score for ${formFactor}: ${score} (size: ${sizeMB.toFixed(2)}MB, requests: ${totalRequests}, load: ${loadTime}ms)`);
    
    return {
      formFactor,
      score: Math.round(score),
      performance: Math.round(score),
      accessibility: 50,
      bestPractices: 50,
      seo: 50,
      metrics: {
        firstContentfulPaint: loadTime * 0.6,
        largestContentfulPaint: loadTime * 0.8,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: loadTime * 0.1,
        coreWebVitals: {
          lcp: loadTime * 0.8,
          fid: 100,
          cls: 0.1
        }
      },
      fontAudits: {
        fontDisplay: { score: 0.5, description: 'Using Puppeteer fallback (Lighthouse unavailable)' },
        preloadFonts: { score: 0.5, description: 'Using Puppeteer fallback (Lighthouse unavailable)' }
      },
      opportunities: [],
      diagnostics: [],
      fallback: true
    };
  }

  /**
   * Process and combine all metrics into final results
   */
  processResults(url, resourceMetrics, desktopLighthouse, mobileLighthouse, startTime) {
    const analysisDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Aggregate resources by type
    const resourcesByType = this.aggregateResourcesByType(resourceMetrics.resources);
    
    // Calculate caching metrics
    const cachingMetrics = this.calculateCachingMetrics(resourceMetrics.resources);
    
    // Calculate fallback scores based on resource metrics
    const resourceScore = this.calculateResourceScore(resourcesByType);
    const cachingScore = this.calculateCachingScore(cachingMetrics);
    const networkScore = this.calculateNetworkScore(resourceMetrics.timing);
    
    // Calculate scores for desktop/mobile - use Lighthouse if available, else fallback to resource-based
    const desktopLighthouseScore = desktopLighthouse.performance || desktopLighthouse.score || 0;
    const mobileLighthouseScore = mobileLighthouse.performance || mobileLighthouse.score || 0;
    
    // If Lighthouse failed (score is 0), calculate fallback score from resource metrics
    const desktopPerformanceScore = desktopLighthouseScore > 0 
      ? desktopLighthouseScore 
      : Math.round((resourceScore * 0.4) + (cachingScore * 0.3) + (networkScore * 0.3));
    
    const mobilePerformanceScore = mobileLighthouseScore > 0 
      ? mobileLighthouseScore 
      : Math.round((resourceScore * 0.4) + (cachingScore * 0.3) + (networkScore * 0.3)) - 10; // Mobile typically scores lower
    
    // Extract Core Web Vitals for both desktop and mobile
    const desktopCoreWebVitals = this.extractCoreWebVitals(
      desktopLighthouse.metrics,
      resourceMetrics.timing.webVitals
    );
    
    const mobileCoreWebVitals = this.extractCoreWebVitals(
      mobileLighthouse.metrics,
      null // Mobile uses only Lighthouse data
    );
    
    // Generate recommendations based on both desktop and mobile results
    const recommendations = this.generateRecommendations(
      resourcesByType,
      cachingMetrics,
      desktopLighthouse,
      desktopCoreWebVitals,
      mobileLighthouse,
      mobileCoreWebVitals
    );

    return {
      url,
      timestamp: new Date().toISOString(),
      analysisDuration: `${analysisDuration}s`,
      
      // Overall summary (use desktop as primary)
      performanceScore: Math.round(desktopPerformanceScore),
      loadTime: `${(resourceMetrics.timing.navigation.totalLoadTime / 1000).toFixed(2)}s`,
      pageSize: this.formatBytes(resourceMetrics.pageSize),
      totalRequests: resourceMetrics.resources.length,
      lcp: desktopCoreWebVitals.lcp, // For quick stats display
      usingFallbackScores: desktopLighthouseScore === 0 || mobileLighthouseScore === 0,
      
      // Desktop-specific results
      desktop: {
        performanceScore: Math.round(desktopPerformanceScore),
        lighthouseFailed: desktopLighthouseScore === 0,
        coreWebVitals: {
          score: this.calculateWebVitalsScore(desktopCoreWebVitals),
          ...desktopCoreWebVitals
        },
        lighthouse: {
          performance: desktopLighthouse.performance || desktopLighthouse.score,
          accessibility: desktopLighthouse.accessibility || 0,
          bestPractices: desktopLighthouse.bestPractices || 0,
          seo: desktopLighthouse.seo || 0,
          error: desktopLighthouse.error || null
        }
      },
      
      // Mobile-specific results
      mobile: {
        performanceScore: Math.round(mobilePerformanceScore),
        lighthouseFailed: mobileLighthouseScore === 0,
        coreWebVitals: {
          score: this.calculateWebVitalsScore(mobileCoreWebVitals),
          ...mobileCoreWebVitals
        },
        lighthouse: {
          performance: mobileLighthouse.performance || mobileLighthouse.score,
          accessibility: mobileLighthouse.accessibility || 0,
          bestPractices: mobileLighthouse.bestPractices || 0,
          seo: mobileLighthouse.seo || 0,
          error: mobileLighthouse.error || null
        }
      },
      
      // Shared results (same for both)
      coreWebVitals: {
        score: this.calculateWebVitalsScore(desktopCoreWebVitals),
        ...desktopCoreWebVitals
      },
      
      resources: {
        score: resourceScore,
        ...resourcesByType,
        breakdown: this.createResourceBreakdown(resourcesByType)
      },
      
      network: {
        score: networkScore,
        requests: resourceMetrics.resources.length,
        ttfb: `${Math.round(resourceMetrics.timing.navigation.ttfb)}ms`,
        connectionTime: `${Math.round(resourceMetrics.timing.navigation.tcp)}ms`,
        ssl: `${Math.round(resourceMetrics.timing.navigation.ssl)}ms`,
        dns: `${Math.round(resourceMetrics.timing.navigation.dns)}ms`,
        domInteractive: `${Math.round(resourceMetrics.timing.navigation.domInteractive)}ms`,
        domContentLoaded: `${Math.round(resourceMetrics.timing.navigation.domContentLoaded)}ms`
      },
      
      caching: {
        score: cachingScore,
        ...cachingMetrics
      },
      
      recommendations
    };
  }

  /**
   * Aggregate resources by type
   */
  aggregateResourcesByType(resources) {
    const types = {
      javascript: { size: 0, count: 0, files: [] },
      css: { size: 0, count: 0, files: [] },
      images: { size: 0, count: 0, files: [] },
      fonts: { size: 0, count: 0, files: [] },
      other: { size: 0, count: 0, files: [] }
    };

    resources.forEach(resource => {
      let category = 'other';
      
      if (resource.type === 'script' || resource.mimeType?.includes('javascript')) {
        category = 'javascript';
      } else if (resource.type === 'stylesheet' || resource.mimeType?.includes('css')) {
        category = 'css';
      } else if (resource.type === 'image' || resource.mimeType?.includes('image')) {
        category = 'images';
      } else if (resource.type === 'font' || resource.mimeType?.includes('font') || resource.url.match(/\.(woff2?|ttf|eot|otf)$/i)) {
        category = 'fonts';
      }

      types[category].size += resource.size || 0;
      types[category].count++;
      types[category].files.push({
        url: resource.url,
        size: resource.size || 0,
        cached: resource.cached
      });
    });

    // Format sizes
    Object.keys(types).forEach(key => {
      types[key].sizeFormatted = this.formatBytes(types[key].size);
    });

    return types;
  }

  /**
   * Calculate caching metrics
   */
  calculateCachingMetrics(resources) {
    let cached = 0;
    let notCached = 0;
    const cachingStrategies = {};

    resources.forEach(resource => {
      if (resource.cached) {
        cached++;
        const strategy = resource.cacheControl || 'implicit';
        cachingStrategies[strategy] = (cachingStrategies[strategy] || 0) + 1;
      } else {
        notCached++;
      }
    });

    const total = resources.length;
    const cacheHitRate = total > 0 ? Math.round((cached / total) * 100) : 0;

    return {
      cached,
      notCached,
      total,
      cacheHitRate: `${cacheHitRate}%`,
      cacheHitRateNum: cacheHitRate,
      strategies: cachingStrategies
    };
  }

  /**
   * Extract and normalize Core Web Vitals
   */
  extractCoreWebVitals(lighthouseMetrics, puppeteerVitals) {
    // Prefer Lighthouse metrics, fallback to Puppeteer
    const lcp = lighthouseMetrics?.largestContentfulPaint || puppeteerVitals?.lcp || 0;
    const fcp = lighthouseMetrics?.firstContentfulPaint || puppeteerVitals?.fcp || 0;
    const cls = lighthouseMetrics?.cumulativeLayoutShift || puppeteerVitals?.cls || 0;
    const tbt = lighthouseMetrics?.totalBlockingTime || 0;
    const ttfb = lighthouseMetrics?.timeToFirstByte || 0;

    // Log CLS for debugging
    logger.info('Core Web Vitals extracted:', {
      cls: cls,
      clsSource: lighthouseMetrics?.cumulativeLayoutShift ? 'lighthouse' : 'puppeteer',
      puppeteerCLS: puppeteerVitals?.cls,
      lighthouseCLS: lighthouseMetrics?.cumulativeLayoutShift,
      clsEntries: puppeteerVitals?.clsEntries
    });

    return {
      lcp: `${(lcp / 1000).toFixed(2)}s`,
      lcpMs: Math.round(lcp),
      fid: tbt > 0 ? `${Math.round(tbt)}ms` : '< 100ms',
      fidMs: Math.round(tbt),
      cls: cls > 0 ? cls.toFixed(3) : '0.000',
      clsNum: cls,
      ttfb: ttfb > 0 ? `${Math.round(ttfb)}ms` : 'N/A',
      fcp: `${(fcp / 1000).toFixed(2)}s`
    };
  }

  /**
   * Calculate Web Vitals score
   */
  calculateWebVitalsScore(vitals) {
    let score = 100;
    
    // LCP scoring (Good: <2.5s, Needs improvement: <4s, Poor: >4s)
    if (vitals.lcpMs > 4000) score -= 40;
    else if (vitals.lcpMs > 2500) score -= 20;
    
    // FID/TBT scoring (Good: <100ms, Needs improvement: <300ms, Poor: >300ms)
    if (vitals.fidMs > 300) score -= 30;
    else if (vitals.fidMs > 100) score -= 15;
    
    // CLS scoring (Good: <0.1, Needs improvement: <0.25, Poor: >0.25)
    if (vitals.clsNum > 0.25) score -= 30;
    else if (vitals.clsNum > 0.1) score -= 15;
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate resource optimization score
   */
  calculateResourceScore(resources) {
    let score = 100;
    
    // Penalize large JavaScript bundles
    if (resources.javascript.size > 500000) score -= 20;
    else if (resources.javascript.size > 300000) score -= 10;
    
    // Penalize large CSS
    if (resources.css.size > 150000) score -= 15;
    else if (resources.css.size > 100000) score -= 8;
    
    // Penalize unoptimized images
    if (resources.images.size > 2000000) score -= 20;
    else if (resources.images.size > 1000000) score -= 10;
    
    // Penalize too many requests
    const totalRequests = Object.values(resources).reduce((sum, r) => sum + r.count, 0);
    if (totalRequests > 100) score -= 15;
    else if (totalRequests > 50) score -= 8;
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate caching score
   */
  calculateCachingScore(caching) {
    const hitRate = caching.cacheHitRateNum;
    
    if (hitRate >= 80) return 100;
    if (hitRate >= 70) return 85;
    if (hitRate >= 60) return 70;
    if (hitRate >= 50) return 55;
    if (hitRate >= 40) return 40;
    return Math.max(0, Math.round(hitRate * 0.8));
  }

  /**
   * Calculate network score
   */
  calculateNetworkScore(timing) {
    let score = 100;
    const ttfb = timing.navigation.ttfb;
    const totalTime = timing.navigation.totalLoadTime;
    
    // TTFB scoring
    if (ttfb > 800) score -= 30;
    else if (ttfb > 600) score -= 20;
    else if (ttfb > 400) score -= 10;
    
    // Total load time scoring
    if (totalTime > 5000) score -= 30;
    else if (totalTime > 3000) score -= 15;
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Create resource breakdown for visualization
   */
  createResourceBreakdown(resources) {
    return Object.entries(resources).map(([type, data]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      size: data.size,
      sizeFormatted: data.sizeFormatted,
      count: data.count,
      percentage: 0 // Will be calculated on frontend
    }));
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(resources, caching, desktopLighthouse, desktopVitals, mobileLighthouse, mobileVitals) {
    const recommendations = [];

    // JavaScript optimization
    if (resources.javascript.size > 300000) {
      recommendations.push({
        priority: 'high',
        title: 'Minimize JavaScript',
        description: `Your JavaScript bundle is ${resources.javascript.sizeFormatted}. Consider code splitting, tree shaking, and removing unused dependencies to reduce bundle size.`,
        impact: 'High - Faster initial page load and improved Time to Interactive',
        category: 'javascript'
      });
    }

    // Image optimization
    if (resources.images.size > 1000000) {
      recommendations.push({
        priority: 'high',
        title: 'Optimize Images',
        description: `Images account for ${resources.images.sizeFormatted}. Use next-gen formats (WebP, AVIF), lazy loading, and responsive images with proper sizing.`,
        impact: 'High - Significantly reduces page weight and improves LCP',
        category: 'images'
      });
    }

    // CSS optimization
    if (resources.css.size > 100000) {
      recommendations.push({
        priority: 'medium',
        title: 'Reduce CSS Size',
        description: `CSS files total ${resources.css.sizeFormatted}. Remove unused CSS, minify stylesheets, and consider critical CSS inlining for above-the-fold content.`,
        impact: 'Medium - Faster render-blocking resource loading',
        category: 'css'
      });
    }

    // Caching strategy
    if (caching.cacheHitRateNum < 70) {
      recommendations.push({
        priority: 'high',
        title: 'Improve Caching Strategy',
        description: `Only ${caching.cacheHitRate} of resources are cacheable. Implement proper Cache-Control headers and versioning strategy for static assets.`,
        impact: 'High - Dramatically improves repeat visit performance',
        category: 'caching'
      });
    }

    // LCP optimization - check both desktop and mobile
    const worstLCP = Math.max(desktopVitals.lcpMs || 0, mobileVitals.lcpMs || 0);
    if (worstLCP > 2500) {
      const platform = mobileVitals.lcpMs > desktopVitals.lcpMs ? 'mobile' : 'desktop';
      const lcpValue = platform === 'mobile' ? mobileVitals.lcp : desktopVitals.lcp;
      recommendations.push({
        priority: 'high',
        title: 'Optimize Largest Contentful Paint (LCP)',
        description: `LCP is ${lcpValue} on ${platform}, exceeding the recommended 2.5s threshold. Optimize your largest above-the-fold element (image or text block) by preloading resources and reducing server response time.`,
        impact: 'Critical - Core Web Vital affects Google rankings and user experience',
        category: 'vitals'
      });
    }

    // CLS optimization - check both desktop and mobile
    const worstCLS = Math.max(desktopVitals.clsNum || 0, mobileVitals.clsNum || 0);
    if (worstCLS > 0.1) {
      const platform = mobileVitals.clsNum > desktopVitals.clsNum ? 'mobile' : 'desktop';
      const clsValue = platform === 'mobile' ? mobileVitals.cls : desktopVitals.cls;
      recommendations.push({
        priority: 'medium',
        title: 'Reduce Cumulative Layout Shift (CLS)',
        description: `CLS is ${clsValue} on ${platform}, exceeding the recommended 0.1 threshold. Reserve space for images/ads, use size attributes, and avoid inserting content above existing content.`,
        impact: 'Medium - Core Web Vital affects user experience and rankings',
        category: 'vitals'
      });
    }

    // Mobile-specific performance warning
    if (mobileVitals.performanceScore < desktopVitals.performanceScore - 15) {
      recommendations.push({
        priority: 'high',
        title: 'Significant Mobile Performance Gap',
        description: `Mobile performance (${mobileLighthouse.performance}) is significantly lower than desktop (${desktopLighthouse.performance}). Mobile users may experience poor performance.`,
        impact: 'High - Most users access sites on mobile devices',
        category: 'mobile'
      });
    }

    // Compression
    const uncompressedText = resources.javascript.size + resources.css.size;
    if (uncompressedText > 150000) {
      recommendations.push({
        priority: 'medium',
        title: 'Enable Text Compression',
        description: 'Enable gzip or brotli compression for text-based resources (JavaScript, CSS, HTML, JSON) to reduce transfer size by 70-90%.',
        impact: 'Medium - Reduces bandwidth and speeds up downloads',
        category: 'compression'
      });
    }

    // Too many requests
    const totalRequests = Object.values(resources).reduce((sum, r) => sum + r.count, 0);
    if (totalRequests > 50) {
      recommendations.push({
        priority: 'low',
        title: 'Reduce HTTP Requests',
        description: `Page makes ${totalRequests} HTTP requests. Consider bundling assets, using CSS sprites, and consolidating third-party scripts.`,
        impact: 'Low-Medium - Reduces connection overhead',
        category: 'network'
      });
    }

    // Font optimization
    if (resources.fonts.size > 100000) {
      recommendations.push({
        priority: 'low',
        title: 'Optimize Web Fonts',
        description: `Fonts total ${resources.fonts.sizeFormatted}. Use font-display: swap, subset fonts to required glyphs, and preload critical fonts.`,
        impact: 'Low-Medium - Prevents invisible text and improves perceived performance',
        category: 'fonts'
      });
    }

    return recommendations;
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

// Export singleton instance
module.exports = new PerformanceAnalyzerService();
