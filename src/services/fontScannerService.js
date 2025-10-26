const { createLogger } = require('../utils/logger');
const browserPool = require('../utils/browserPool');
const FontAnalyzer = require('./fontAnalyzer');
const performanceAnalyzer = require('./performanceAnalyzer');
const bestPracticesAnalyzer = require('./bestPracticesAnalyzer');
const fallbackScannerService = require('./fallbackScannerService');

const logger = createLogger('FontScannerService');

class FontScannerService {
  async scanWebsite(url) {
    // Acquire browser from pool
    const browser = await browserPool.acquire();
    let page = null;

    try {
      page = await browser.newPage();

      // Listen to browser console messages to see FontAnalyzer debug output
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('FontAnalyzer:')) {
          logger.info(`Browser Console: ${text}`);
        }
      });

      // Set user agent and viewport
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1920, height: 1080 });

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
