const puppeteer = require('puppeteer');
const { createLogger } = require('../utils/logger');
const FontAnalyzer = require('./fontAnalyzer');
const performanceAnalyzer = require('./performanceAnalyzer');
const bestPracticesAnalyzer = require('./bestPracticesAnalyzer');
const fallbackScannerService = require('./fallbackScannerService');

const logger = createLogger('FontScannerService');

class FontScannerService {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
        defaultViewport: { width: 1920, height: 1080 },
        timeout: 120000, // 2 minutes for browser operations
      });
    }
    return this.browser;
  }

  async scanWebsite(url) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    try {
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

      // Navigate to the page with improved timeout handling
      const startTime = Date.now();
      let loadTime = 0;

      try {
        // Try with networkidle2 first (increased timeout)
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 120000, // 2 minutes
        });
        loadTime = Date.now() - startTime;
        logger.info(`Page loaded with networkidle2 in ${loadTime}ms`);
      } catch (error) {
        if (error.name === 'TimeoutError') {
          logger.info('Timeout with networkidle2, trying domcontentloaded...');
          // Fallback to domcontentloaded if networkidle2 times out
          try {
            await page.goto(url, {
              waitUntil: 'domcontentloaded',
              timeout: 90000, // 1.5 minutes
            });
            loadTime = Date.now() - startTime;
            logger.info(`Page loaded with domcontentloaded in ${loadTime}ms`);
          } catch (fallbackError) {
            logger.info('Timeout with domcontentloaded, trying load...');
            // Final fallback to basic load
            try {
              await page.goto(url, {
                waitUntil: 'load',
                timeout: 60000, // 1 minute
              });
              loadTime = Date.now() - startTime;
              logger.info(`Page loaded with basic load in ${loadTime}ms`);
            } catch (finalError) {
              logger.error(`All page load strategies failed for ${url}:`, finalError.message);
              throw new Error(`The website took too long to load. This could be due to slow server response, large resources, or network issues. Please try again later or check if the website is accessible.`);
            }
          }
        } else {
          logger.error(`Page navigation error for ${url}:`, error.message);
          throw new Error(`Failed to access the website: ${error.message}. Please check the URL and try again.`);
        }
      }

      // Wait for additional content to load
      try {
        await page.waitForTimeout(3000);

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
      await page.close();
      return await fallbackScannerService.scanWebsite(url);
    } finally {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Create singleton instance
const fontScannerService = new FontScannerService();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Closing browser...');
  await fontScannerService.closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Closing browser...');
  await fontScannerService.closeBrowser();
  process.exit(0);
});

module.exports = fontScannerService;
