const { createLogger } = require('../utils/logger');

const logger = createLogger('PerformanceAnalyzer');

class PerformanceAnalyzer {
  async analyzePerformance(page, initialLoadTime) {
    logger.info('Analyzing performance');

    const performanceData = await page.evaluate(() => {
      const perfData = {
        timing: {},
        resources: [],
        fonts: [],
        paintTiming: {},
        navigationTiming: {},
      };

      // Navigation Timing API
      if (performance.timing) {
        const timing = performance.timing;
        perfData.navigationTiming = {
          dns: timing.domainLookupEnd - timing.domainLookupStart,
          connection: timing.connectEnd - timing.connectStart,
          request: timing.responseStart - timing.requestStart,
          response: timing.responseEnd - timing.responseStart,
          domProcessing: timing.domContentLoadedEventStart - timing.responseEnd,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
          total: timing.loadEventEnd - timing.navigationStart,
        };
      }

      // Paint Timing API
      if (performance.getEntriesByType) {
        const paintEntries = performance.getEntriesByType('paint');
        paintEntries.forEach((entry) => {
          perfData.paintTiming[entry.name] = entry.startTime;
        });

        // Resource Timing for fonts
        const resourceEntries = performance.getEntriesByType('resource');
        resourceEntries.forEach((entry) => {
          if (
            entry.name.includes('font') ||
            entry.name.includes('.woff') ||
            entry.name.includes('.woff2') ||
            entry.name.includes('.ttf') ||
            entry.name.includes('.eot') ||
            entry.name.includes('fonts.googleapis.com') ||
            entry.name.includes('fonts.gstatic.com')
          ) {
            perfData.fonts.push({
              url: entry.name,
              duration: entry.duration,
              transferSize: entry.transferSize || 0,
              encodedBodySize: entry.encodedBodySize || 0,
              decodedBodySize: entry.decodedBodySize || 0,
              startTime: entry.startTime,
              responseEnd: entry.responseEnd,
            });
          }

          // Determine resource type
          let resourceType = 'other';
          if (
            entry.name.includes('.woff') ||
            entry.name.includes('.woff2') ||
            entry.name.includes('.ttf') ||
            entry.name.includes('.eot')
          ) {
            resourceType = 'font';
          } else if (entry.name.includes('.css')) {
            resourceType = 'stylesheet';
          } else if (entry.name.includes('.js')) {
            resourceType = 'script';
          } else if (
            entry.name.includes('.png') ||
            entry.name.includes('.jpg') ||
            entry.name.includes('.svg') ||
            entry.name.includes('.gif')
          ) {
            resourceType = 'image';
          }

          perfData.resources.push({
            name: entry.name,
            type: resourceType,
            duration: entry.duration,
            transferSize: entry.transferSize || 0,
            startTime: entry.startTime,
          });
        });
      }

      return perfData;
    });

    // Calculate font-specific metrics
    const fontMetrics = this.calculateFontMetrics(performanceData);

    // Analyze Core Web Vitals impact
    const webVitals = await this.analyzeWebVitals(page);

    return {
      initialLoadTime,
      navigationTiming: performanceData.navigationTiming,
      paintTiming: performanceData.paintTiming,
      fontResources: performanceData.fonts,
      fontMetrics,
      webVitals,
      recommendations: this.generatePerformanceRecommendations(performanceData, fontMetrics),
    };
  }

  calculateFontMetrics(performanceData) {
    const fonts = performanceData.fonts;

    if (fonts.length === 0) {
      return {
        totalFontRequests: 0,
        totalFontSize: 0,
        totalFontLoadTime: 0,
        averageFontLoadTime: 0,
        largestFont: null,
        slowestFont: null,
      };
    }

    const totalSize = fonts.reduce((sum, font) => sum + (font.transferSize || 0), 0);
    const totalLoadTime = fonts.reduce((sum, font) => sum + font.duration, 0);
    const averageLoadTime = totalLoadTime / fonts.length;

    const largestFont = fonts.reduce((largest, font) =>
      (font.transferSize || 0) > (largest.transferSize || 0) ? font : largest
    );

    const slowestFont = fonts.reduce((slowest, font) =>
      font.duration > slowest.duration ? font : slowest
    );

    return {
      totalFontRequests: fonts.length,
      totalFontSize: totalSize,
      totalFontLoadTime: totalLoadTime,
      averageFontLoadTime: averageLoadTime,
      largestFont,
      slowestFont,
      fontsBySize: fonts.sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0)),
      fontsByLoadTime: fonts.sort((a, b) => b.duration - a.duration),
    };
  }

  async analyzeWebVitals(page) {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {
          FCP: null,
          LCP: null,
          FID: null,
          CLS: null,
          TTFB: null,
        };

        // First Contentful Paint
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
        if (fcpEntry) {
          vitals.FCP = fcpEntry.startTime;
        }

        // Time to First Byte
        if (performance.timing) {
          vitals.TTFB = performance.timing.responseStart - performance.timing.requestStart;
        }

        // Largest Contentful Paint
        if ('PerformanceObserver' in window) {
          try {
            const lcpObserver = new PerformanceObserver((entryList) => {
              const entries = entryList.getEntries();
              const lastEntry = entries[entries.length - 1];
              vitals.LCP = lastEntry.startTime;
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

            // Cumulative Layout Shift
            let clsValue = 0;
            const clsObserver = new PerformanceObserver((entryList) => {
              for (const entry of entryList.getEntries()) {
                if (!entry.hadRecentInput) {
                  clsValue += entry.value;
                }
              }
              vitals.CLS = clsValue;
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });

            // First Input Delay
            const fidObserver = new PerformanceObserver((entryList) => {
              for (const entry of entryList.getEntries()) {
                vitals.FID = entry.processingStart - entry.startTime;
                break;
              }
            });
            fidObserver.observe({ entryTypes: ['first-input'] });

            setTimeout(() => {
              resolve(vitals);
            }, 3000);
          } catch (e) {
            resolve(vitals);
          }
        } else {
          resolve(vitals);
        }
      });
    });
  }

  generatePerformanceRecommendations(performanceData, fontMetrics) {
    const recommendations = [];

    // Font size recommendations
    if (fontMetrics.totalFontSize > 100000) {
      // > 100KB
      recommendations.push({
        type: 'warning',
        category: 'Font Size',
        message: `Total font size is ${(fontMetrics.totalFontSize / 1024).toFixed(2)}KB. Consider reducing font files or using font subsetting.`,
        priority: 'high',
      });
    }

    // Font request count
    if (fontMetrics.totalFontRequests > 4) {
      recommendations.push({
        type: 'warning',
        category: 'Font Requests',
        message: `${fontMetrics.totalFontRequests} font requests detected. Consider combining fonts or reducing font variations.`,
        priority: 'medium',
      });
    }

    // Font load time
    if (fontMetrics.averageFontLoadTime > 1000) {
      recommendations.push({
        type: 'error',
        category: 'Font Load Time',
        message: `Average font load time is ${fontMetrics.averageFontLoadTime.toFixed(2)}ms. Optimize font delivery and consider font-display strategies.`,
        priority: 'high',
      });
    }

    // Paint timing recommendations
    if (performanceData.paintTiming['first-contentful-paint'] > 2500) {
      recommendations.push({
        type: 'warning',
        category: 'First Contentful Paint',
        message: 'FCP is slower than recommended. Font loading may be blocking rendering.',
        priority: 'high',
      });
    }

    return recommendations;
  }

  getResourceType(url) {
    if (
      url.includes('.woff') ||
      url.includes('.woff2') ||
      url.includes('.ttf') ||
      url.includes('.eot')
    ) {
      return 'font';
    }
    if (url.includes('.css')) {
      return 'stylesheet';
    }
    if (url.includes('.js')) {
      return 'script';
    }
    if (
      url.includes('.png') ||
      url.includes('.jpg') ||
      url.includes('.svg') ||
      url.includes('.gif')
    ) {
      return 'image';
    }
    return 'other';
  }
}

module.exports = new PerformanceAnalyzer();
