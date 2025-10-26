/**
 * Competitive Performance Analyzer
 * Fast, Lighthouse-free performance analysis using Puppeteer metrics
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');

const logger = createLogger('CompetitivePerformanceAnalyzer');

class CompetitivePerformanceAnalyzer {
  /**
   * Fast performance analysis without Lighthouse
   * @param {string} url - URL to analyze
   * @returns {Object} Performance score and metrics
   */
  async analyzePerformance(url) {
    const startTime = Date.now();
    logger.info(`Fast performance analysis for: ${url}`);

    try {
      const metrics = await this.collectMetrics(url);
      const score = this.calculateScore(metrics);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`Performance completed in ${duration}s: ${score}`);
      
      return {
        url,
        performanceScore: score,
        desktop: { performanceScore: score },
        mobile: { performanceScore: Math.max(score - 15, 0) }, // Mobile penalty
        metrics,
        duration: `${duration}s`,
        method: 'puppeteer-only'
      };
    } catch (error) {
      logger.error(`Performance analysis failed: ${error.message}`);
      throw error;
    }
  }

  async collectMetrics(url) {
    return browserPool.execute(async (browser) => {
      const page = await browser.newPage();
      const resources = [];
      
      try {
        // Track all resources
        page.on('response', async (response) => {
          try {
            const request = response.request();
            resources.push({
              url: request.url(),
              type: request.resourceType(),
              size: (await response.buffer()).length,
              status: response.status(),
              cached: response.fromCache()
            });
          } catch (e) {
            // Ignore errors from failed resources
          }
        });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

        // Get performance metrics
        const perfMetrics = await page.evaluate(() => {
          const navTiming = performance.getEntriesByType('navigation')[0];
          const paintEntries = performance.getEntriesByType('paint');
          
          return {
            domContentLoaded: navTiming?.domContentLoadedEventEnd || 0,
            loadComplete: navTiming?.loadEventEnd || 0,
            domInteractive: navTiming?.domInteractive || 0,
            firstPaint: paintEntries.find(e => e.name === 'first-paint')?.startTime || 0,
            firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,
            transferSize: navTiming?.transferSize || 0,
            encodedBodySize: navTiming?.encodedBodySize || 0
          };
        });

        await page.close();

        // Aggregate resource metrics
        const totalSize = resources.reduce((sum, r) => sum + r.size, 0);
        const totalRequests = resources.length;
        const cachedResources = resources.filter(r => r.cached).length;
        const imageSize = resources.filter(r => r.type === 'image').reduce((sum, r) => sum + r.size, 0);
        const scriptSize = resources.filter(r => r.type === 'script').reduce((sum, r) => sum + r.size, 0);
        const cssSize = resources.filter(r => r.type === 'stylesheet').reduce((sum, r) => sum + r.size, 0);

        return {
          ...perfMetrics,
          totalSize,
          totalRequests,
          cachedResources,
          cacheRatio: totalRequests > 0 ? (cachedResources / totalRequests) * 100 : 0,
          imageSize,
          scriptSize,
          cssSize
        };
      } catch (error) {
        await page.close();
        throw error;
      }
    });
  }

  calculateScore(metrics) {
    let score = 100;

    // Page size penalty (ideal < 1MB, acceptable < 3MB, poor >= 3MB)
    const sizeMB = metrics.totalSize / (1024 * 1024);
    if (sizeMB > 5) score -= 30;
    else if (sizeMB > 3) score -= 20;
    else if (sizeMB > 1) score -= 10;

    // Request count penalty (ideal < 50, acceptable < 100, poor >= 100)
    if (metrics.totalRequests > 150) score -= 20;
    else if (metrics.totalRequests > 100) score -= 12;
    else if (metrics.totalRequests > 50) score -= 5;

    // Load time penalty (ideal < 2s, acceptable < 4s, poor >= 4s)
    const loadTime = metrics.loadComplete || 0;
    if (loadTime > 5000) score -= 30;
    else if (loadTime > 4000) score -= 20;
    else if (loadTime > 2000) score -= 10;

    // FCP penalty (ideal < 1.8s)
    const fcp = metrics.firstContentfulPaint || 0;
    if (fcp > 3000) score -= 15;
    else if (fcp > 1800) score -= 8;

    // Cache utilization bonus (good caching adds points)
    if (metrics.cacheRatio > 70) score += 5;
    else if (metrics.cacheRatio < 30) score -= 5;

    // Image optimization penalty
    const imageSizeMB = metrics.imageSize / (1024 * 1024);
    if (imageSizeMB > 2) score -= 10;
    else if (imageSizeMB > 1) score -= 5;

    return Math.max(Math.round(score), 0);
  }
}

module.exports = new CompetitivePerformanceAnalyzer();
