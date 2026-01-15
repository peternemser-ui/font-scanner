/**
 * Competitive Core Web Vitals Analyzer
 * Fast, Lighthouse-free CWV analysis using Puppeteer Performance API
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');
const { roundTo, formatDuration } = require('../utils/formatHelpers');

const logger = createLogger('CompetitiveCWVAnalyzer');

class CompetitiveCoreWebVitalsAnalyzer {
  /**
   * Fast CWV analysis without Lighthouse
   * @param {string} url - URL to analyze
   * @returns {Object} CWV score and metrics
   */
  async analyzeCoreWebVitals(url) {
    const startTime = Date.now();
    logger.info(`Fast CWV analysis for: ${url}`);

    try {
      const metrics = await this.collectMetrics(url);
      const score = this.calculateScore(metrics);
      
      const duration = formatDuration(Date.now() - startTime, 2);
      logger.info(`CWV completed in ${duration}s: ${score}`);
      
      return {
        url,
        score,
        desktop: { score },
        mobile: { score: Math.max(score - 10, 0) }, // Mobile stricter
        metrics,
        duration: `${duration}s`,
        method: 'puppeteer-only'
      };
    } catch (error) {
      logger.error(`CWV analysis failed: ${error.message}`);
      throw error;
    }
  }

  async collectMetrics(url) {
    return browserPool.execute(async (browser) => {
      const page = await browser.newPage();
      
      try {
        // Track performance metrics
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

        // Get Web Vitals using Performance API
        const metrics = await page.evaluate(() => {
          return new Promise((resolve) => {
            const results = {
              lcp: 0,
              fid: 0,
              cls: 0,
              fcp: 0,
              ttfb: 0
            };

            // Get navigation timing
            const navTiming = performance.getEntriesByType('navigation')[0];
            if (navTiming) {
              results.ttfb = navTiming.responseStart - navTiming.requestStart;
              results.fcp = navTiming.domContentLoadedEventStart;
            }

            // Get paint timing
            const paintEntries = performance.getEntriesByType('paint');
            const lcp = paintEntries.find(entry => entry.name === 'largest-contentful-paint');
            const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
            
            if (lcp) results.lcp = lcp.startTime;
            if (fcp) results.fcp = fcp.startTime;

            // CLS estimation (simple heuristic - count layout shifts)
            let clsValue = 0;
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                  clsValue += entry.value;
                }
              }
            });
            
            try {
              observer.observe({ type: 'layout-shift', buffered: true });
            } catch (e) {
              // Layout shift API not supported
            }

            setTimeout(() => {
              results.cls = clsValue;
              observer.disconnect();
              
              // If no LCP detected, estimate from load time
              if (!results.lcp && navTiming) {
                results.lcp = navTiming.loadEventStart;
              }
              
              resolve(results);
            }, 2000); // Wait 2 seconds to collect CLS
          });
        });

        await page.close();
        return metrics;
      } catch (error) {
        await page.close();
        throw error;
      }
    });
  }

  calculateScore(metrics) {
    let score = 100;

    // LCP scoring (Good < 2.5s, Needs Improvement < 4s, Poor >= 4s)
    const lcp = metrics.lcp || 0;
    if (lcp > 4000) score -= 40;
    else if (lcp > 2500) score -= 20;
    else if (lcp > 0) score -= Math.min((lcp / 2500) * 10, 10);

    // FCP scoring (Good < 1.8s, Needs Improvement < 3s, Poor >= 3s)
    const fcp = metrics.fcp || 0;
    if (fcp > 3000) score -= 25;
    else if (fcp > 1800) score -= 12;
    else if (fcp > 0) score -= Math.min((fcp / 1800) * 5, 5);

    // CLS scoring (Good < 0.1, Needs Improvement < 0.25, Poor >= 0.25)
    const cls = metrics.cls || 0;
    if (cls > 0.25) score -= 25;
    else if (cls > 0.1) score -= 12;
    else score -= cls * 50; // Proportional penalty

    // TTFB scoring (Good < 600ms, Poor >= 600ms)
    const ttfb = metrics.ttfb || 0;
    if (ttfb > 1000) score -= 10;
    else if (ttfb > 600) score -= 5;

    return Math.max(roundTo(score, 0), 0);
  }
}

module.exports = new CompetitiveCoreWebVitalsAnalyzer();
