const { createLogger } = require('../utils/logger');
const browserPool = require('../utils/browserPool');
const FontAnalyzer = require('./fontAnalyzer');
const performanceAnalyzer = require('./performanceAnalyzer');
const bestPracticesAnalyzer = require('./bestPracticesAnalyzer');
const fallbackScannerService = require('./fallbackScannerService');

const logger = createLogger('FontScannerService');

class FontScannerService {
  /**
   * Scan website with both desktop and mobile viewports for comprehensive font analysis
   */
  async scanWebsite(url, options = {}) {
    logger.info(`Starting comprehensive font scan for: ${url}`);

    // If legacy mode or specific viewport requested, use single scan
    if (options.singleViewport || options.viewportType) {
      return this.scanSingleViewport(url, options.viewportType || 'desktop');
    }

    // Modern mode: scan both desktop and mobile
    // Run sequentially to avoid resource contention with Lighthouse
    try {
      logger.info('📱 Scanning desktop viewport...');
      const desktopScan = await this.scanSingleViewport(url, 'desktop');

      logger.info('📱 Scanning mobile viewport...');
      const mobileScan = await this.scanSingleViewport(url, 'mobile');

      return {
        desktop: desktopScan,
        mobile: mobileScan,
        // Keep legacy structure for backwards compatibility
        fonts: desktopScan.fonts,
        performance: desktopScan.performance,
        bestPractices: desktopScan.bestPractices,
        screenshot: desktopScan.screenshot,
        metadata: {
          scannedUrl: url,
          method: 'puppeteer-dual-viewport',
          viewports: {
            desktop: { width: 1920, height: 1080 },
            mobile: { width: 375, height: 667 }
          }
        }
      };
    } catch (error) {
      logger.error('Dual viewport scan failed, falling back to desktop only:', error.message);
      return this.scanSingleViewport(url, 'desktop');
    }
  }

  /**
   * Scan website at a single viewport (desktop or mobile)
   */
  async scanSingleViewport(url, viewportType = 'desktop') {
    // Acquire browser from pool
    const browser = await browserPool.acquire();
    let page = null;

    try {
      page = await browser.newPage();

      // Listen to browser console messages to see FontAnalyzer debug output
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('FontAnalyzer:')) {
          logger.info(`Browser Console [${viewportType}]: ${text}`);
        }
      });

      // Set viewport-specific configuration
      const viewportConfig = viewportType === 'mobile' ? {
        width: 375,
        height: 667,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      } : {
        width: 1920,
        height: 1080,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };

      // Set user agent and viewport
      await page.setUserAgent(viewportConfig.userAgent);
      await page.setViewport(viewportConfig);

      logger.info(`Navigating to: ${url}`);

      // Navigate to the page with optimized timeout handling
      const startTime = Date.now();
      let loadTime = 0;

      try {
        // Try domcontentloaded first (faster)
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000, // 30 seconds
        });
        loadTime = Date.now() - startTime;
        logger.info(`Page loaded with domcontentloaded in ${loadTime}ms`);
      } catch (error) {
        if (error.name === 'TimeoutError') {
          logger.info('Timeout with domcontentloaded, trying load...');
          // Fallback to basic load
          try {
            await page.goto(url, {
              waitUntil: 'load',
              timeout: 45000, // 45 seconds
            });
            loadTime = Date.now() - startTime;
            logger.info(`Page loaded with load in ${loadTime}ms`);
          } catch (finalError) {
            logger.error(`Page load failed for ${url}:`, finalError.message);
            throw new Error(`The website took too long to load. This could be due to slow server response, large resources, or network issues. Please try again later or check if the website is accessible.`);
          }
        } else {
          logger.error(`Page navigation error for ${url}:`, error.message);
          throw new Error(`Failed to access the website: ${error.message}. Please check the URL and try again.`);
        }
      }

      // Wait for fonts to load (reduced wait time)
      try {
        await page.waitForTimeout(1500); // Reduced from 3000ms to 1500ms

        // Try to wait for fonts to be ready
        await page.evaluate(() => {
          if (document.fonts && document.fonts.ready) {
            return document.fonts.ready;
          }
          return Promise.resolve();
        });
      } catch (error) {
        logger.warn('Font loading wait failed:', error.message);
      }

      // Analyze fonts
      const fontAnalyzer = new FontAnalyzer();
      const fontAnalysis = await fontAnalyzer.analyzeFonts(page);

      // Analyze performance
      const performanceAnalysis = await performanceAnalyzer.analyzePerformance(page, loadTime);

      // Analyze best practices
      const bestPracticesAnalysis = await bestPracticesAnalyzer.analyzeBestPractices(
        page,
        fontAnalysis
      );

      // Take screenshot
      const screenshot = await page.screenshot({
        encoding: 'base64',
        fullPage: false,
        type: 'png',
      });

      return {
        fonts: fontAnalysis,
        performance: performanceAnalysis,
        bestPractices: bestPracticesAnalysis,
        screenshot: `data:image/png;base64,${screenshot}`,
        metadata: {
          scannedUrl: url,
          userAgent: await page.evaluate(() => navigator.userAgent),
          viewport: await page.viewport(),
          viewportType: viewportType,
          loadTime: loadTime,
          method: 'puppeteer',
        },
      };
    } catch (error) {
      logger.error('Puppeteer scan failed:', error.message);
      logger.info('Falling back to simple HTTP-based analysis...');

      // Use fallback scanner
      if (page && !page.isClosed()) {
        await page.close();
      }
      
      // Release browser back to pool before fallback
      await browserPool.release(browser);
      
      return await fallbackScannerService.scanWebsite(url);
    } finally {
      // Always close page and release browser
      if (page && !page.isClosed()) {
        await page.close();
      }
      await browserPool.release(browser);
    }
  }
}

// Create singleton instance
const fontScannerService = new FontScannerService();

module.exports = fontScannerService;
