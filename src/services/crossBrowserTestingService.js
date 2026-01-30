const { createLogger } = require('../utils/logger');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

const logger = createLogger('CrossBrowserTestingService');

/**
 * Cross-Browser Testing Service
 * Tests font rendering and performance across different browsers
 */
class CrossBrowserTestingService {
  constructor() {
    this.supportedBrowsers = ['chrome', 'firefox', 'safari', 'edge'];
    this.testTimeout = 10000; // Reduced from 30s to 10s for faster scans
    this.browserInstances = new Map();
  }

  /**
   * Run comprehensive cross-browser font testing
   */
  async runCrossBrowserTest(url, options = {}) {
    try {
      const results = {
        timestamp: new Date().toISOString(),
        url: url,
        browsers: {},
        comparison: {},
        overallScore: 0,
        recommendations: []
      };

      // Test each browser
      for (const browser of this.supportedBrowsers) {
        try {
          logger.info(`Testing font rendering in ${browser}...`);
          results.browsers[browser] = await this.testBrowser(url, browser, options);
        } catch (error) {
          logger.error(`Error testing ${browser}:`, error);
          results.browsers[browser] = this.getErrorResult(browser, error);
        }
      }

      // Generate comparison analysis
      results.comparison = this.generateComparison(results.browsers);
      results.overallScore = this.calculateOverallScore(results.browsers);
      results.recommendations = this.generateRecommendations(results.browsers, results.comparison);

      return results;

    } catch (error) {
      logger.error('Error in cross-browser testing:', error);
      throw error;
    }
  }

  /**
   * Test font rendering in a specific browser
   */
  async testBrowser(url, browserType, options) {
    const browser = await this.launchBrowser(browserType);
    
    try {
      const page = await browser.newPage();
      
      // Set viewport for consistent testing
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Navigate and wait for fonts to load
      await page.goto(url, { waitUntil: 'networkidle0', timeout: this.testTimeout });
      
      // Wait for fonts to be ready
      await page.evaluateOnNewDocument(() => {
        document.fonts.ready.then(() => {
          window.fontsReady = true;
        });
      });

      await page.waitForFunction(() => window.fontsReady, { timeout: 10000 }).catch(() => {
        logger.warn(`Font loading timeout in ${browserType}`);
      });

      const results = {
        browser: browserType,
        success: true,
        fonts: await this.analyzeFonts(page),
        rendering: await this.analyzeRendering(page),
        performance: await this.analyzePerformance(page),
        compatibility: await this.analyzeCompatibility(page),
        screenshots: await this.takeScreenshots(page, browserType),
        timestamp: new Date().toISOString()
      };

      results.score = this.calculateBrowserScore(results);
      return results;

    } finally {
      if (browser && !options.keepAlive) {
        await browser.close();
      }
    }
  }

  /**
   * Launch browser instance
   */
  async launchBrowser(browserType) {
    // For now, we'll use Puppeteer with Chrome
    // In a real implementation, you'd use browser-specific drivers
    const config = this.getBrowserConfig(browserType);
    
    return await puppeteer.launch(config);
  }

  /**
   * Get browser-specific configuration
   */
  getBrowserConfig(browserType) {
    const configs = {
      chrome: {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--font-render-hinting=none'
        ]
      },
      firefox: {
        // Would use Firefox-specific WebDriver
        headless: true,
        product: 'firefox' // If using puppeteer-firefox
      },
      safari: {
        // Would use Safari WebDriver on macOS
        headless: false // Safari doesn't support headless
      },
      edge: {
        // Would use Edge WebDriver
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    };

    return configs[browserType] || configs.chrome;
  }

  /**
   * Analyze fonts in the browser
   */
  async analyzeFonts(page) {
    return await page.evaluate(() => {
      const fonts = [];
      const elements = document.querySelectorAll('*');
      
      elements.forEach(element => {
        const styles = window.getComputedStyle(element);
        const fontFamily = styles.fontFamily;
        const fontSize = styles.fontSize;
        const fontWeight = styles.fontWeight;
        const fontStyle = styles.fontStyle;
        
        if (fontFamily && fontFamily !== 'inherit') {
          fonts.push({
            family: fontFamily,
            size: fontSize,
            weight: fontWeight,
            style: fontStyle,
            element: element.tagName.toLowerCase(),
            className: element.className,
            text: element.textContent ? element.textContent.substring(0, 50) : ''
          });
        }
      });

      // Get loaded fonts from Font Loading API
      const loadedFonts = [];
      if (document.fonts) {
        document.fonts.forEach(font => {
          loadedFonts.push({
            family: font.family,
            status: font.status,
            weight: font.weight,
            style: font.style,
            stretch: font.stretch
          });
        });
      }

      return {
        usedFonts: fonts,
        loadedFonts: loadedFonts,
        fontCount: new Set(fonts.map(f => f.family)).size,
        loadingStatus: document.fonts ? document.fonts.status : 'unknown'
      };
    });
  }

  /**
   * Analyze font rendering quality
   */
  async analyzeRendering(page) {
    return await page.evaluate(() => {
      const analysis = {
        antialiasing: 'unknown',
        subpixelRendering: 'unknown',
        hinting: 'unknown',
        textSharpness: 'unknown',
        readability: {}
      };

      // Test text rendering by creating test elements
      const testDiv = document.createElement('div');
      testDiv.style.cssText = `
        position: absolute;
        top: -1000px;
        font-family: Arial;
        font-size: 16px;
        line-height: 1.5;
        color: #000;
        background: #fff;
      `;
      testDiv.textContent = 'The quick brown fox jumps over the lazy dog 1234567890';
      document.body.appendChild(testDiv);

      // Measure text metrics
      const rect = testDiv.getBoundingClientRect();
      analysis.readability = {
        width: rect.width,
        height: rect.height,
        lineHeight: window.getComputedStyle(testDiv).lineHeight
      };

      document.body.removeChild(testDiv);

      // Check for font smoothing properties
      const body = document.body;
      const bodyStyles = window.getComputedStyle(body);
      
      analysis.fontSmoothing = {
        webkitFontSmoothing: bodyStyles.webkitFontSmoothing || 'auto',
        mozOsxFontSmoothing: bodyStyles.mozOsxFontSmoothing || 'auto',
        textRendering: bodyStyles.textRendering || 'auto'
      };

      return analysis;
    });
  }

  /**
   * Analyze font performance
   */
  async analyzePerformance(page) {
    const performanceMetrics = await page.evaluate(() => {
      const perfEntries = performance.getEntriesByType('resource');
      const fontEntries = perfEntries.filter(entry => 
        entry.initiatorType === 'css' && 
        (entry.name.includes('.woff') || entry.name.includes('.ttf') || entry.name.includes('.otf'))
      );

      const fontMetrics = fontEntries.map(entry => ({
        name: entry.name,
        loadTime: entry.responseEnd - entry.startTime,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize
      }));

      // Font loading timing
      const fontLoadTiming = {
        totalFonts: fontEntries.length,
        totalLoadTime: fontEntries.reduce((sum, entry) => sum + (entry.responseEnd - entry.startTime), 0),
        averageLoadTime: fontEntries.length > 0 ? 
          fontEntries.reduce((sum, entry) => sum + (entry.responseEnd - entry.startTime), 0) / fontEntries.length : 0,
        totalTransferSize: fontEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)
      };

      return {
        fonts: fontMetrics,
        timing: fontLoadTiming,
        fontLoadingStatus: document.fonts ? document.fonts.status : 'unknown'
      };
    });

    // Add LCP and CLS measurements
    const webVitals = await this.measureWebVitals(page);
    
    return {
      ...performanceMetrics,
      webVitals: webVitals,
      score: this.calculatePerformanceScore(performanceMetrics, webVitals)
    };
  }

  /**
   * Analyze browser compatibility
   */
  async analyzeCompatibility(page) {
    return await page.evaluate(() => {
      const compatibility = {
        fontLoadingAPI: typeof document.fonts !== 'undefined',
        fontDisplay: CSS.supports('font-display', 'swap'),
        fontVariationSettings: CSS.supports('font-variation-settings', '"wght" 400'),
        variableFonts: CSS.supports('font-weight', '350'),
        colorFonts: CSS.supports('font-palette', 'normal'),
        fontFeatureSettings: CSS.supports('font-feature-settings', '"liga" 1'),
        textDecorationColor: CSS.supports('text-decoration-color', 'red'),
        textSizeAdjust: CSS.supports('text-size-adjust', '100%')
      };

      // Check for browser-specific features
      const userAgent = navigator.userAgent;
      compatibility.browser = {
        isChrome: userAgent.includes('Chrome'),
        isFirefox: userAgent.includes('Firefox'),
        isSafari: userAgent.includes('Safari') && !userAgent.includes('Chrome'),
        isEdge: userAgent.includes('Edge'),
        version: this.getBrowserVersion(userAgent)
      };

      return compatibility;
    });
  }

  /**
   * Take screenshots for visual comparison
   */
  async takeScreenshots(page, browserType) {
    try {
      // Full page screenshot
      const fullPage = await page.screenshot({
        fullPage: true,
        type: 'png'
      });

      // Screenshots of text-heavy sections
      const textElements = await page.$$('h1, h2, h3, p, article');
      const textScreenshots = [];

      for (let i = 0; i < Math.min(textElements.length, 3); i++) {
        const element = textElements[i];
        const screenshot = await element.screenshot({ type: 'png' });
        textScreenshots.push({
          element: await element.evaluate(el => el.tagName),
          screenshot: screenshot.toString('base64')
        });
      }

      return {
        fullPage: fullPage.toString('base64'),
        textSamples: textScreenshots,
        viewport: await page.viewport()
      };

    } catch (error) {
      logger.warn(`Failed to take screenshots in ${browserType}:`, error);
      return null;
    }
  }

  /**
   * Measure Web Vitals
   */
  async measureWebVitals(page) {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {};
        
        // Simple LCP measurement
        if ('PerformanceObserver' in window) {
          try {
            const observer = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              vitals.lcp = lastEntry.startTime;
            });
            observer.observe({ entryTypes: ['largest-contentful-paint'] });
            
            setTimeout(() => {
              observer.disconnect();
              resolve(vitals);
            }, 3000);
          } catch (error) {
            resolve(vitals);
          }
        } else {
          resolve(vitals);
        }
      });
    });
  }

  /**
   * Generate comparison between browsers
   */
  generateComparison(browserResults) {
    const comparison = {
      consistencyScore: 0,
      differences: [],
      fontSupport: {},
      performanceVariation: {},
      renderingDifferences: []
    };

    const browsers = Object.keys(browserResults);
    if (browsers.length < 2) {
      return comparison;
    }

    // Compare font counts
    const fontCounts = browsers.map(b => browserResults[b].fonts?.fontCount || 0);
    const maxDiff = Math.max(...fontCounts) - Math.min(...fontCounts);
    
    if (maxDiff > 0) {
      comparison.differences.push({
        type: 'font-count',
        description: `Font count varies between browsers (${Math.min(...fontCounts)} - ${Math.max(...fontCounts)})`,
        severity: maxDiff > 2 ? 'high' : 'medium'
      });
    }

    // Compare performance
    const loadTimes = browsers
      .map(b => browserResults[b].performance?.timing?.averageLoadTime || 0)
      .filter(t => t > 0);
    
    if (loadTimes.length > 1) {
      const perfVariation = (Math.max(...loadTimes) - Math.min(...loadTimes)) / Math.min(...loadTimes);
      comparison.performanceVariation.coefficient = perfVariation;
      
      if (perfVariation > 0.5) {
        comparison.differences.push({
          type: 'performance',
          description: `Significant performance variation between browsers (${perfVariation.toFixed(1)}x difference)`,
          severity: 'medium'
        });
      }
    }

    // Calculate consistency score
    const totalDifferences = comparison.differences.length;
    comparison.consistencyScore = Math.max(0, 100 - (totalDifferences * 20));

    return comparison;
  }

  /**
   * Calculate overall cross-browser score
   */
  calculateOverallScore(browserResults) {
    const browsers = Object.keys(browserResults);
    if (browsers.length === 0) return 0;

    const scores = browsers
      .map(b => browserResults[b].score || 0)
      .filter(s => s > 0);

    if (scores.length === 0) return 0;

    // Average of all browser scores
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Penalty for failed browsers
    const failedBrowsers = browsers.length - scores.length;
    const penalty = failedBrowsers * 15;

    return Math.max(0, Math.round(avgScore - penalty));
  }

  /**
   * Calculate individual browser score
   */
  calculateBrowserScore(results) {
    let score = 100;

    // Performance score (40% weight)
    const perfScore = results.performance?.score || 70;
    score = score * 0.6 + perfScore * 0.4;

    // Font loading success (30% weight)
    const fontLoadingSuccess = results.fonts?.loadingStatus === 'loaded' ? 100 : 70;
    score = score * 0.7 + fontLoadingSuccess * 0.3;

    // Compatibility score (20% weight)
    const compatFeatures = Object.values(results.compatibility || {}).filter(v => v === true).length;
    const compatScore = (compatFeatures / 8) * 100; // Assuming 8 features checked
    score = score * 0.8 + compatScore * 0.2;

    // Rendering quality (10% weight)
    const renderingScore = results.rendering ? 85 : 70;
    score = score * 0.9 + renderingScore * 0.1;

    return Math.round(score);
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore(performanceMetrics, webVitals) {
    let score = 100;

    // Font load time
    const avgLoadTime = performanceMetrics.timing?.averageLoadTime || 0;
    if (avgLoadTime > 500) score -= 20;
    else if (avgLoadTime > 300) score -= 10;

    // Total transfer size
    const totalSize = performanceMetrics.timing?.totalTransferSize || 0;
    if (totalSize > 200000) score -= 15; // > 200KB
    else if (totalSize > 100000) score -= 8; // > 100KB

    // LCP impact
    if (webVitals.lcp > 2500) score -= 15;
    else if (webVitals.lcp > 1500) score -= 8;

    return Math.max(0, score);
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(browserResults, comparison) {
    const recommendations = [];

    // Cross-browser consistency recommendations
    if (comparison.consistencyScore < 80) {
      recommendations.push({
        priority: 'high',
        category: 'consistency',
        title: 'Improve cross-browser consistency',
        description: 'Significant differences detected between browsers',
        actions: [
          'Use web-safe font stacks',
          'Implement proper font fallbacks',
          'Test font loading across browsers'
        ]
      });
    }

    // Performance recommendations
    const browsers = Object.keys(browserResults);
    const avgPerformance = browsers.reduce((sum, b) => 
      sum + (browserResults[b].performance?.score || 0), 0) / browsers.length;

    if (avgPerformance < 70) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        title: 'Optimize font loading performance',
        description: 'Font loading is impacting performance across browsers',
        actions: [
          'Implement font preloading',
          'Use font-display: swap',
          'Optimize font file sizes',
          'Enable font compression'
        ]
      });
    }

    // Browser-specific recommendations
    browsers.forEach(browser => {
      const result = browserResults[browser];
      if (result.score < 70) {
        recommendations.push({
          priority: 'medium',
          category: 'browser-specific',
          title: `Optimize for ${browser}`,
          description: `Poor performance detected in ${browser}`,
          actions: [`Review ${browser}-specific font rendering issues`]
        });
      }
    });

    return recommendations;
  }

  /**
   * Get error result for failed browser test
   */
  getErrorResult(browser, error) {
    return {
      browser: browser,
      success: false,
      error: error.message,
      score: 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get summary of cross-browser test results
   */
  async getCrossBrowserSummary(url) {
    try {
      const results = await this.runCrossBrowserTest(url);
      
      return {
        overallScore: results.overallScore,
        testedBrowsers: Object.keys(results.browsers).length,
        consistencyScore: results.comparison.consistencyScore,
        topIssues: results.recommendations.slice(0, 3),
        browserScores: Object.fromEntries(
          Object.entries(results.browsers).map(([browser, data]) => [
            browser, 
            { score: data.score, success: data.success }
          ])
        )
      };
    } catch (error) {
      logger.error('Error generating cross-browser summary:', error);
      return {
        overallScore: 0,
        error: 'Cross-browser testing failed',
        testedBrowsers: 0
      };
    }
  }
}

module.exports = new CrossBrowserTestingService();