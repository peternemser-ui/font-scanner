/**
 * Mobile Analyzer Service
 * Comprehensive mobile testing suite combining viewport, performance, accessibility, and readability
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');
const { roundTo } = require('../utils/formatHelpers');
const { waitForCloudflareChallenge, detectBotProtection } = require('../utils/browserHelpers');

const logger = createLogger('MobileAnalyzer');

const DEVICE_PROFILES = {
  'iphone-14': {
    name: 'iPhone 14',
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    deviceScaleFactor: 3,
    isMobile: true
  },
  'iphone-15-pro': {
    name: 'iPhone 15 Pro',
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    deviceScaleFactor: 3,
    isMobile: true
  },
  'iphone-se': {
    name: 'iPhone SE',
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    deviceScaleFactor: 2,
    isMobile: true
  },
  'pixel-7': {
    name: 'Pixel 7',
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/108.0.0.0',
    deviceScaleFactor: 2.75,
    isMobile: true
  },
  'pixel-8': {
    name: 'Pixel 8',
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/119.0.0.0',
    deviceScaleFactor: 2.75,
    isMobile: true
  },
  'galaxy-s23': {
    name: 'Galaxy S23',
    viewport: { width: 360, height: 800 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/108.0.0.0',
    deviceScaleFactor: 2,
    isMobile: true
  },
  'galaxy-s24': {
    name: 'Galaxy S24',
    viewport: { width: 360, height: 780 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/119.0.0.0',
    deviceScaleFactor: 2,
    isMobile: true
  },
  'ipad': {
    name: 'iPad',
    viewport: { width: 768, height: 1024 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    deviceScaleFactor: 2,
    isMobile: true
  },
  'ipad-pro': {
    name: 'iPad Pro',
    viewport: { width: 1024, height: 1366 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    deviceScaleFactor: 2,
    isMobile: true
  }
};

class MobileAnalyzerService {
  /**
   * Perform comprehensive mobile analysis
   */
  async analyzeMobile(url, options = {}) {
    const {
      devices = ['iphone-14', 'pixel-7'],
      includePerformance = true,
      includeAccessibility = true,
      includeReadability = true,
      checkTouchTargets = true,
      simulateNetwork = '4g'
    } = options;

    const startTime = Date.now();
    const results = {
      url,
      analyzedAt: new Date().toISOString(),
      devices: {},
      performanceSummary: {},
      accessibilitySummary: {},
      readabilitySummary: {},
      touchTargetsSummary: {},
      recommendations: []
    };

    logger.info(`Starting mobile analysis for ${url}`, {
      devices: devices.length,
      includePerformance,
      includeAccessibility
    });

    // Analyze each device
    for (const deviceKey of devices) {
      if (!DEVICE_PROFILES[deviceKey]) {
        logger.warn(`Unknown device: ${deviceKey}`);
        continue;
      }

      try {
        const deviceResults = await this.analyzeDevice(url, deviceKey, {
          includePerformance,
          includeAccessibility,
          includeReadability,
          checkTouchTargets,
          simulateNetwork
        });

        results.devices[deviceKey] = deviceResults;
      } catch (error) {
        logger.error(`Error analyzing device ${deviceKey}:`, error);
        results.devices[deviceKey] = { error: error.message };
      }
    }

    // Generate summary metrics
    results.performanceSummary = this.generatePerformanceSummary(results.devices);
    results.accessibilitySummary = this.generateAccessibilitySummary(results.devices);
    results.readabilitySummary = this.generateReadabilitySummary(results.devices);
    results.touchTargetsSummary = this.generateTouchTargetsSummary(results.devices);

    // Generate recommendations
    results.recommendations = this.generateRecommendations(results);

    // Overall score
    results.mobileScore = this.calculateMobileScore(results);

    const duration = Date.now() - startTime;
    logger.info(`Mobile analysis complete: ${results.mobileScore}/100`, { duration });

    return results;
  }

  /**
   * Analyze specific device
   */
  async analyzeDevice(url, deviceKey, options) {
    const device = DEVICE_PROFILES[deviceKey];
    const results = {
      device: device.name,
      viewport: device.viewport,
      timestamp: new Date().toISOString()
    };

    return await browserPool.execute(async (browser) => {
      const page = await browser.newPage();
      try {
        // Set device emulation
        await page.emulate({
          viewport: device.viewport,
          userAgent: device.userAgent,
          deviceScaleFactor: device.deviceScaleFactor,
          isMobile: device.isMobile,
          hasTouch: device.isMobile
        });

        // Navigate to page
        const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Check for and wait for Cloudflare challenge to resolve
        const botDetection = await detectBotProtection(page, response);
        if (botDetection.isDetected) {
          logger.info('Bot protection detected, waiting for challenge to resolve...', { device: device.name });
          const resolved = await waitForCloudflareChallenge(page, 8000);
          if (!resolved) {
            logger.warn('Cloudflare challenge did not resolve', { device: device.name, url });
          }
        }

        // Capture screenshot (base64)
        if (options.captureScreenshots !== false) {
          try {
            // Wait a bit for any animations/lazy loading
            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
            
            const screenshotBuffer = await page.screenshot({
              type: 'jpeg',
              quality: 80,
              fullPage: false // Just viewport, not full page
            });
            results.screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
            logger.info(`Screenshot captured for ${device.name}`, { 
              size: roundTo(screenshotBuffer.length / 1024, 0) + 'KB' 
            });
          } catch (screenshotError) {
            logger.warn(`Failed to capture screenshot for ${device.name}:`, screenshotError.message);
            results.screenshot = null;
          }
        }

        // Performance analysis
        if (options.includePerformance) {
          results.performance = await this.analyzePerformance(page);
        }

        // Font metrics
        results.fontMetrics = await this.analyzeFontMetrics(page);

        // Touch targets
        if (options.checkTouchTargets) {
          results.touchTargets = await this.checkTouchTargets(page);
        }

        // Readability
        if (options.includeReadability) {
          results.readability = await this.analyzeReadability(page);
        }

        // Viewport responsiveness
        results.responsiveness = await this.analyzeResponsiveness(page, device.viewport);

        // Accessibility
        if (options.includeAccessibility) {
          results.accessibility = await this.analyzeAccessibility(page);
        }

        // === NEW ADVANCED FEATURES ===
        
        // Viewport Meta Tag Analysis
        results.viewportMeta = await this.analyzeViewportMeta(page);
        
        // PWA Readiness
        results.pwaReadiness = await this.analyzePWAReadiness(page, url);
        
        // Dark Mode Support
        results.darkModeSupport = await this.analyzeDarkMode(page);
        
        // Above the Fold Analysis
        results.aboveTheFold = await this.analyzeAboveTheFold(page, device.viewport);
        
        // Mobile SEO
        results.mobileSEO = await this.analyzeMobileSEO(page);
        
        // Input Field Analysis
        results.inputAnalysis = await this.analyzeInputFields(page);
        
        // Landscape screenshot (portrait/landscape comparison)
        if (options.captureScreenshots !== false) {
          results.landscapeScreenshot = await this.captureLandscapeScreenshot(page, device);
        }

      } finally {
        await page.close();
      }

      return results;
    });
  }

  /**
   * Analyze performance on mobile
   */
  async analyzePerformance(page, url) {
    try {
      // Get navigation timing
      const metrics = await page.evaluate(() => {
        const perfData = window.performance.timing;
        return {
          domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
          loadComplete: perfData.loadEventEnd - perfData.navigationStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
        };
      });

      return {
        domContentLoaded: metrics.domContentLoaded,
        loadComplete: metrics.loadComplete,
        firstPaint: roundTo(metrics.firstPaint, 0),
        firstContentfulPaint: roundTo(metrics.firstContentfulPaint, 0),
        score: this.calculatePerformanceScore(metrics)
      };
    } catch (error) {
      logger.error('Error analyzing performance:', error);
      return { error: error.message };
    }
  }

  /**
   * Analyze fonts on mobile
   */
  async analyzeFontMetrics(page) {
    try {
      const metrics = await page.evaluate(() => {
        const fonts = {};
        const fontFaces = Array.from(document.fonts);
        
        fontFaces.forEach(font => {
          const key = `${font.family}-${font.weight}`;
          if (!fonts[key]) {
            fonts[key] = {
              family: font.family,
              weight: font.weight,
              style: font.style,
              status: font.status
            };
          }
        });

        // Check for font-display strategy
        const styleSheets = Array.from(document.styleSheets);
        const fontDisplayUsage = {
          auto: 0,
          block: 0,
          swap: 0,
          fallback: 0,
          optional: 0,
          none: 0
        };

        styleSheets.forEach(sheet => {
          try {
            const rules = sheet.cssRules;
            rules.forEach(rule => {
              if (rule.style && rule.style.fontDisplay) {
                fontDisplayUsage[rule.style.fontDisplay]++;
              }
            });
          } catch (e) {
            // CORS restrictions
          }
        });

        return {
          totalFonts: fontFaces.length,
          fonts: fonts,
          fontDisplayUsage: fontDisplayUsage
        };
      });

      return metrics;
    } catch (error) {
      logger.error('Error analyzing fonts:', error);
      return { error: error.message };
    }
  }

  /**
   * Check touch target sizes (WCAG 2.5.5)
   */
  async checkTouchTargets(page) {
    try {
      const targets = await page.evaluate(() => {
        const roundTo = (value, decimals = 0) => {
          const factor = Math.pow(10, decimals);
          return Math.round(value * factor) / factor;
        };
        const MIN_SIZE = 44; // WCAG AAA minimum
        const interactive = document.querySelectorAll('button, a, input, textarea, select, [role="button"]');
        const issues = [];
        const compliant = [];

        interactive.forEach((el, idx) => {
          const rect = el.getBoundingClientRect();
          const width = roundTo(rect.width, 0);
          const height = roundTo(rect.height, 0);

          const isCompliant = width >= MIN_SIZE && height >= MIN_SIZE;

          if (!isCompliant) {
            issues.push({
              element: el.tagName,
              role: el.getAttribute('role'),
              text: el.textContent?.substring(0, 30),
              width,
              height,
              minDimension: Math.min(width, height)
            });
          } else {
            compliant.push({ width, height });
          }
        });

        return {
          total: interactive.length,
          compliant: compliant.length,
          issues: issues.length,
          issueDetails: issues,
          compliancePercentage: roundTo((compliant.length / interactive.length) * 100, 0)
        };
      });

      return targets;
    } catch (error) {
      logger.error('Error checking touch targets:', error);
      return { error: error.message };
    }
  }

  /**
   * Analyze readability metrics
   */
  async analyzeReadability(page) {
    try {
      const readability = await page.evaluate(() => {
        const roundTo = (value, decimals = 0) => {
          const factor = Math.pow(10, decimals);
          return Math.round(value * factor) / factor;
        };
        const issues = [];
        const bodyText = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, li');
        let smallFontCount = 0;
        let goodLineHeightCount = 0;
        const contrastIssues = 0;

        bodyText.forEach(el => {
          const styles = window.getComputedStyle(el);
          const fontSize = parseFloat(styles.fontSize);
          const lineHeight = parseFloat(styles.lineHeight);
          const minFontSize = 16; // Recommended minimum

          if (fontSize < minFontSize && el.textContent?.length > 10) {
            smallFontCount++;
          }

          const recommendedLineHeight = fontSize * 1.5;
          if (lineHeight >= recommendedLineHeight) {
            goodLineHeightCount++;
          }
        });

        return {
          totalElements: bodyText.length,
          smallFontElements: smallFontCount,
          smallFontPercentage: roundTo((smallFontCount / bodyText.length) * 100, 0),
          goodLineHeight: goodLineHeightCount,
          goodLineHeightPercentage: roundTo((goodLineHeightCount / bodyText.length) * 100, 0),
          readabilityScore: Math.max(
            0,
            100 -
              roundTo((smallFontCount / Math.max(bodyText.length, 1)) * 60, 0) -
              roundTo(((bodyText.length - goodLineHeightCount) / Math.max(bodyText.length, 1)) * 30, 0)
          )
        };
      });

      return readability;
    } catch (error) {
      logger.error('Error analyzing readability:', error);
      return { error: error.message };
    }
  }

  /**
   * Check responsive design
   */
  async analyzeResponsiveness(page, viewport) {
    try {
      const responsiveness = await page.evaluate((viewportWidth) => {
        const media = Array.from(document.styleSheets)
          .map(sheet => {
            try {
              return Array.from(sheet.cssRules).filter(
                rule => rule.type === 4 // MEDIA_RULE
              ).map(rule => rule.media.mediaText);
            } catch (e) {
              return [];
            }
          })
          .flat();

        return {
          mediaQueries: media.length,
          hasResponsiveDesign: media.length > 0,
          breakpoints: media
        };
      }, viewport.width);

      return responsiveness;
    } catch (error) {
      logger.error('Error analyzing responsiveness:', error);
      return { error: error.message };
    }
  }

  /**
   * Analyze accessibility
   */
  async analyzeAccessibility(page) {
    try {
      const a11y = await page.evaluate(() => {
        const issues = [];

        // Missing alt text
        const images = document.querySelectorAll('img');
        images.forEach(img => {
          if (!img.alt) {
            issues.push({
              type: 'missing-alt',
              element: 'img',
              severity: 'error'
            });
          }
        });

        // Color contrast (simplified placeholder)
        const textElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6');
        const lowContrastCount = 0;

        // Heading hierarchy
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        let headingIssues = false;
        let lastLevel = 0;
        headings.forEach(heading => {
          const level = parseInt(heading.tagName[1]);
          if (level - lastLevel > 1) {
            headingIssues = true;
          }
          lastLevel = level;
        });

        const missingAlt = images.length - Array.from(images).filter(img => img.alt).length;
        const altPenalty = images.length ? (missingAlt / images.length) * 40 : 0;
        const headingPenalty = headingIssues ? 15 : 0;
        const contrastPenalty = lowContrastCount * 5;

        return {
          totalImages: images.length,
          missingAlt,
          headingCount: headings.length,
          headingIssues,
          a11yScore: Math.max(0, 100 - altPenalty - headingPenalty - contrastPenalty)
        };
      });

      return a11y;
    } catch (error) {
      logger.error('Error analyzing accessibility:', error);
      return { error: error.message };
    }
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore(metrics) {
    let score = 100;
    if (metrics.firstContentfulPaint > 3000) score -= 20;
    if (metrics.domContentLoaded > 2000) score -= 15;
    return Math.max(0, score);
  }

  // ============================================
  // NEW ADVANCED MOBILE ANALYSIS METHODS
  // ============================================

  /**
   * Analyze viewport meta tag configuration
   */
  async analyzeViewportMeta(page) {
    try {
      return await page.evaluate(() => {
        const viewport = document.querySelector('meta[name="viewport"]');
        const content = viewport?.content || '';
        
        const parsed = {};
        content.split(',').forEach(part => {
          const [key, value] = part.split('=').map(s => s.trim());
          if (key) parsed[key] = value;
        });

        const issues = [];
        
        if (!viewport) {
          issues.push({ severity: 'error', message: 'No viewport meta tag found' });
        } else {
          if (!parsed['width']) {
            issues.push({ severity: 'warning', message: 'Missing width directive' });
          }
          if (parsed['user-scalable'] === 'no' || parsed['user-scalable'] === '0') {
            issues.push({ severity: 'warning', message: 'Zoom disabled (user-scalable=no) - accessibility concern' });
          }
          if (parsed['maximum-scale'] && parseFloat(parsed['maximum-scale']) < 2) {
            issues.push({ severity: 'warning', message: 'Maximum scale too restrictive (should be ≥2)' });
          }
          if (!parsed['initial-scale']) {
            issues.push({ severity: 'info', message: 'No initial-scale set' });
          }
        }

        return {
          exists: !!viewport,
          content: content,
          parsed: parsed,
          issues: issues,
          score: Math.max(0, 100 - (issues.filter(i => i.severity === 'error').length * 30) - (issues.filter(i => i.severity === 'warning').length * 15))
        };
      });
    } catch (error) {
      logger.error('Error analyzing viewport meta:', error);
      return { error: error.message, score: 0 };
    }
  }

  /**
   * Analyze PWA readiness
   */
  async analyzePWAReadiness(page, url) {
    try {
      const pwa = await page.evaluate(() => {
        const manifest = document.querySelector('link[rel="manifest"]');
        const themeColor = document.querySelector('meta[name="theme-color"]');
        const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
        const serviceWorkerSupported = 'serviceWorker' in navigator;
        
        return {
          hasManifest: !!manifest,
          manifestHref: manifest?.href || null,
          hasThemeColor: !!themeColor,
          themeColor: themeColor?.content || null,
          hasAppleTouchIcon: !!appleTouchIcon,
          appleTouchIconHref: appleTouchIcon?.href || null,
          serviceWorkerSupported: serviceWorkerSupported
        };
      });

      // Check for service worker registration
      let serviceWorkerRegistered = false;
      try {
        serviceWorkerRegistered = await page.evaluate(async () => {
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            return registrations.length > 0;
          }
          return false;
        });
      } catch (e) {
        // Service worker check failed
      }

      // Calculate PWA score
      let score = 0;
      const checklist = [];

      if (pwa.hasManifest) { score += 25; checklist.push({ item: 'Web App Manifest', status: 'pass' }); }
      else { checklist.push({ item: 'Web App Manifest', status: 'fail' }); }

      if (pwa.hasThemeColor) { score += 15; checklist.push({ item: 'Theme Color', status: 'pass' }); }
      else { checklist.push({ item: 'Theme Color', status: 'fail' }); }

      if (pwa.hasAppleTouchIcon) { score += 15; checklist.push({ item: 'Apple Touch Icon', status: 'pass' }); }
      else { checklist.push({ item: 'Apple Touch Icon', status: 'fail' }); }

      if (serviceWorkerRegistered) { score += 30; checklist.push({ item: 'Service Worker', status: 'pass' }); }
      else { checklist.push({ item: 'Service Worker', status: 'fail' }); }

      // HTTPS check
      const isHttps = url.startsWith('https://');
      if (isHttps) { score += 15; checklist.push({ item: 'HTTPS', status: 'pass' }); }
      else { checklist.push({ item: 'HTTPS', status: 'fail' }); }

      return {
        ...pwa,
        serviceWorkerRegistered,
        isHttps,
        checklist,
        score,
        installable: pwa.hasManifest && serviceWorkerRegistered && isHttps
      };
    } catch (error) {
      logger.error('Error analyzing PWA readiness:', error);
      return { error: error.message, score: 0 };
    }
  }

  /**
   * Analyze dark mode support
   */
  async analyzeDarkMode(page) {
    try {
      // Check if site responds to prefers-color-scheme
      const darkModeSupport = await page.evaluate(() => {
        // Check for CSS custom properties that might indicate theming
        const root = document.documentElement;
        const styles = getComputedStyle(root);
        
        // Look for common dark mode indicators
        const darkModeIndicators = [
          '--dark-',
          '--theme-',
          '--color-scheme',
          '--bg-dark',
          '--text-dark'
        ];

        const cssVars = [];
        for (let i = 0; i < styles.length; i++) {
          const prop = styles[i];
          if (prop.startsWith('--')) {
            cssVars.push(prop);
          }
        }

        const hasDarkVars = cssVars.some(v => 
          darkModeIndicators.some(ind => v.includes(ind))
        );

        // Check for color-scheme meta tag
        const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
        
        // Check for prefers-color-scheme media query in stylesheets
        let hasMediaQuery = false;
        try {
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                if (rule.media?.mediaText?.includes('prefers-color-scheme')) {
                  hasMediaQuery = true;
                  break;
                }
              }
            } catch (e) {}
            if (hasMediaQuery) break;
          }
        } catch (e) {}

        // Check for dark mode toggle elements
        const darkToggle = document.querySelector('[class*="dark-mode"], [class*="theme-toggle"], [id*="dark"], [aria-label*="dark"]');

        return {
          hasColorSchemeMeta: !!colorSchemeMeta,
          colorSchemeValue: colorSchemeMeta?.content || null,
          hasMediaQuery: hasMediaQuery,
          hasDarkModeVariables: hasDarkVars,
          hasThemeToggle: !!darkToggle,
          cssVariablesCount: cssVars.length
        };
      });

      // Calculate score
      let score = 0;
      if (darkModeSupport.hasMediaQuery) score += 40;
      if (darkModeSupport.hasColorSchemeMeta) score += 20;
      if (darkModeSupport.hasDarkModeVariables) score += 20;
      if (darkModeSupport.hasThemeToggle) score += 20;

      return {
        ...darkModeSupport,
        score,
        supported: score >= 40
      };
    } catch (error) {
      logger.error('Error analyzing dark mode:', error);
      return { error: error.message, score: 0 };
    }
  }

  /**
   * Analyze above-the-fold content
   */
  async analyzeAboveTheFold(page, viewport) {
    try {
      const atf = await page.evaluate((viewportHeight) => {
        // Get all visible elements above the fold
        const elements = document.body.querySelectorAll('*');
        let textContent = '';
        let imageCount = 0;
        let hasHeroImage = false;
        let hasCTA = false;
        let hasHeadline = false;
        const criticalResources = [];

        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.top < viewportHeight && rect.bottom > 0) {
            // Above the fold
            if (el.tagName === 'IMG') {
              imageCount++;
              if (rect.width > 200 && rect.height > 150) hasHeroImage = true;
            }
            if (el.tagName === 'H1' || el.tagName === 'H2') hasHeadline = true;
            if (el.tagName === 'BUTTON' || el.tagName === 'A') {
              if (el.textContent.match(/buy|get|start|sign|subscribe|learn|try/i)) {
                hasCTA = true;
              }
            }
            if (el.tagName === 'P' || el.tagName.match(/^H[1-6]$/)) {
              textContent += el.textContent.slice(0, 100);
            }
          }
        });

        // Check for render-blocking resources
        const scripts = document.querySelectorAll('script[src]:not([async]):not([defer])');
        const blockingStyles = document.querySelectorAll('link[rel="stylesheet"]');

        return {
          hasHeadline,
          hasHeroImage,
          hasCTA,
          imageCount,
          textPreview: textContent.slice(0, 200),
          renderBlockingScripts: scripts.length,
          stylesheets: blockingStyles.length,
          criticalContentScore: (hasHeadline ? 30 : 0) + (hasHeroImage ? 25 : 0) + (hasCTA ? 25 : 0) + (imageCount > 0 ? 20 : 0)
        };
      }, viewport.height);

      return atf;
    } catch (error) {
      logger.error('Error analyzing above the fold:', error);
      return { error: error.message };
    }
  }

  /**
   * Analyze mobile SEO factors
   */
  async analyzeMobileSEO(page) {
    try {
      const seo = await page.evaluate(() => {
        const issues = [];
        
        // Title tag
        const title = document.querySelector('title');
        const titleLength = title?.textContent?.length || 0;
        if (!title) issues.push({ type: 'error', item: 'Missing title tag' });
        else if (titleLength > 60) issues.push({ type: 'warning', item: 'Title too long (>60 chars)' });
        else if (titleLength < 30) issues.push({ type: 'warning', item: 'Title too short (<30 chars)' });

        // Meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        const descLength = metaDesc?.content?.length || 0;
        if (!metaDesc) issues.push({ type: 'error', item: 'Missing meta description' });
        else if (descLength > 160) issues.push({ type: 'warning', item: 'Meta description too long (>160 chars)' });
        else if (descLength < 70) issues.push({ type: 'warning', item: 'Meta description too short (<70 chars)' });

        // Mobile-specific meta tags
        const viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) issues.push({ type: 'error', item: 'Missing viewport meta tag' });

        // Canonical URL
        const canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) issues.push({ type: 'warning', item: 'Missing canonical URL' });

        // Structured data
        const jsonLd = document.querySelectorAll('script[type="application/ld+json"]');
        
        // Mobile links
        const telLinks = document.querySelectorAll('a[href^="tel:"]');
        const emailLinks = document.querySelectorAll('a[href^="mailto:"]');

        // Font size for mobile
        const bodyFontSize = parseFloat(getComputedStyle(document.body).fontSize);

        // Tap targets already covered elsewhere

        // H1 check
        const h1s = document.querySelectorAll('h1');
        if (h1s.length === 0) issues.push({ type: 'error', item: 'Missing H1 tag' });
        if (h1s.length > 1) issues.push({ type: 'warning', item: 'Multiple H1 tags found' });

        // Images without dimensions
        const imagesWithoutDimensions = Array.from(document.querySelectorAll('img')).filter(
          img => !img.width && !img.height && !img.style.width && !img.style.height
        ).length;
        if (imagesWithoutDimensions > 0) {
          issues.push({ type: 'warning', item: `${imagesWithoutDimensions} images without explicit dimensions (CLS risk)` });
        }

        return {
          hasTitle: !!title,
          titleLength,
          hasMetaDescription: !!metaDesc,
          descriptionLength: descLength,
          hasViewport: !!viewport,
          hasCanonical: !!canonical,
          structuredDataCount: jsonLd.length,
          clickToCallLinks: telLinks.length,
          emailLinks: emailLinks.length,
          bodyFontSize,
          h1Count: h1s.length,
          issues,
          score: Math.max(0, 100 - (issues.filter(i => i.type === 'error').length * 20) - (issues.filter(i => i.type === 'warning').length * 5))
        };
      });

      return seo;
    } catch (error) {
      logger.error('Error analyzing mobile SEO:', error);
      return { error: error.message, score: 0 };
    }
  }

  /**
   * Analyze input field optimization for mobile
   */
  async analyzeInputFields(page) {
    try {
      return await page.evaluate(() => {
        const inputs = document.querySelectorAll('input, textarea, select');
        const analysis = {
          total: inputs.length,
          emailInputs: 0,
          telInputs: 0,
          searchInputs: 0,
          passwordInputs: 0,
          autocompleteEnabled: 0,
          missingLabels: 0,
          inputModeUsed: 0,
          issues: []
        };

        inputs.forEach(input => {
          const type = input.type?.toLowerCase() || 'text';
          const autocomplete = input.autocomplete;
          const inputMode = input.inputMode;
          
          // Count by type
          if (type === 'email') analysis.emailInputs++;
          if (type === 'tel') analysis.telInputs++;
          if (type === 'search') analysis.searchInputs++;
          if (type === 'password') analysis.passwordInputs++;
          
          // Check for autocomplete
          if (autocomplete && autocomplete !== 'off') analysis.autocompleteEnabled++;
          
          // Check for inputmode
          if (inputMode) analysis.inputModeUsed++;

          // Check for labels
          const id = input.id;
          const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
          const hasAriaLabel = !!input.getAttribute('aria-label');
          const hasPlaceholder = !!input.placeholder;
          
          if (!hasLabel && !hasAriaLabel && !hasPlaceholder) {
            analysis.missingLabels++;
          }

          // Check for mobile optimization opportunities
          if (input.name?.match(/email|e-mail/i) && type !== 'email') {
            analysis.issues.push({ field: input.name || 'unnamed', issue: 'Email field should use type="email"' });
          }
          if (input.name?.match(/phone|tel|mobile/i) && type !== 'tel') {
            analysis.issues.push({ field: input.name || 'unnamed', issue: 'Phone field should use type="tel"' });
          }
          if (input.name?.match(/search|query/i) && type !== 'search') {
            analysis.issues.push({ field: input.name || 'unnamed', issue: 'Search field should use type="search"' });
          }
        });

        // Calculate score
        let score = 100;
        if (analysis.missingLabels > 0) score -= Math.min(20, analysis.missingLabels * 5);
        if (analysis.issues.length > 0) score -= Math.min(30, analysis.issues.length * 10);
        if (analysis.total > 0 && analysis.autocompleteEnabled === 0) score -= 10;
        
        analysis.score = Math.max(0, score);
        return analysis;
      });
    } catch (error) {
      logger.error('Error analyzing input fields:', error);
      return { error: error.message, score: 0 };
    }
  }

  /**
   * Capture landscape screenshot
   */
  async captureLandscapeScreenshot(page, device) {
    try {
      // Rotate viewport to landscape
      const landscapeViewport = {
        width: device.viewport.height,
        height: device.viewport.width
      };

      await page.setViewport({
        ...landscapeViewport,
        deviceScaleFactor: device.deviceScaleFactor,
        isMobile: device.isMobile,
        hasTouch: device.isMobile
      });

      // Wait for layout adjustment
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));

      const screenshotBuffer = await page.screenshot({
        type: 'jpeg',
        quality: 75,
        fullPage: false
      });

      // Restore portrait viewport
      await page.setViewport({
        ...device.viewport,
        deviceScaleFactor: device.deviceScaleFactor,
        isMobile: device.isMobile,
        hasTouch: device.isMobile
      });

      return `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
    } catch (error) {
      logger.warn('Failed to capture landscape screenshot:', error.message);
      return null;
    }
  }

  // ============================================
  // END NEW METHODS
  // ============================================

  /**
   * Generate performance summary
   */
  generatePerformanceSummary(devices) {
    const summary = { average: 0, byDevice: {} };
    let totalScore = 0;
    let count = 0;

    Object.entries(devices).forEach(([key, device]) => {
      if (device.performance && typeof device.performance.score === 'number') {
        summary.byDevice[key] = device.performance.score;
        totalScore += device.performance.score;
        count++;
      }
    });

    summary.average = count > 0 ? roundTo(totalScore / count, 0) : 0;
    return summary;
  }

  /**
   * Generate accessibility summary
   */
  generateAccessibilitySummary(devices) {
    const summary = { average: 0, issues: [] };
    let totalScore = 0;
    let count = 0;

    Object.entries(devices).forEach(([key, device]) => {
      if (device.accessibility && typeof device.accessibility.a11yScore === 'number') {
        totalScore += device.accessibility.a11yScore;
        count++;
      }
    });

    summary.average = count > 0 ? roundTo(totalScore / count, 0) : 0;
    return summary;
  }

  /**
   * Generate readability summary
   */
  generateReadabilitySummary(devices) {
    const summary = { average: 0, issues: [] };
    let totalScore = 0;
    let count = 0;

    Object.entries(devices).forEach(([key, device]) => {
      if (device.readability && typeof device.readability.readabilityScore === 'number') {
        totalScore += device.readability.readabilityScore;
        count++;
      }
    });

    summary.average = count > 0 ? roundTo(totalScore / count, 0) : 0;
    return summary;
  }

  /**
   * Generate touch targets summary
   */
  generateTouchTargetsSummary(devices) {
    const summary = { average: 0, issues: [] };
    let totalCompliance = 0;
    let count = 0;

    Object.entries(devices).forEach(([key, device]) => {
      if (device.touchTargets && typeof device.touchTargets.compliancePercentage === 'number') {
        totalCompliance += device.touchTargets.compliancePercentage;
        count++;
        if (device.touchTargets.issueDetails?.length > 0) {
          summary.issues.push(...device.touchTargets.issueDetails);
        }
      }
    });

    summary.average = count > 0 ? roundTo(totalCompliance / count, 0) : 0;
    return summary;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(results) {
    const recommendations = [];

    // Performance recommendations
    if (results.performanceSummary.average < 70) {
      recommendations.push({
        category: 'Performance',
        severity: 'error',
        title: 'Mobile performance is below recommended',
        suggestion: 'Optimize fonts, images, and critical resources for mobile'
      });
    }

    // Readability recommendations
    if (results.readabilitySummary.average < 80) {
      recommendations.push({
        category: 'Readability',
        severity: 'warning',
        title: 'Some text is too small on mobile',
        suggestion: 'Ensure minimum 16px font size for body text'
      });
    }

    // Touch target recommendations
    if (results.touchTargetsSummary.average < 80) {
      recommendations.push({
        category: 'Touch Targets',
        severity: 'error',
        title: 'Touch targets below WCAG minimum',
        suggestion: 'Make interactive elements at least 44x44 pixels'
      });
    }

    // Accessibility recommendations
    if (results.accessibilitySummary.average < 80) {
      recommendations.push({
        category: 'Accessibility',
        severity: 'warning',
        title: 'Accessibility issues detected',
        suggestion: 'Add alt text to images, improve heading hierarchy, fix contrast issues'
      });
    }

    return recommendations;
  }

  /**
   * Calculate overall mobile score
   */
  calculateMobileScore(results) {
    const scores = [
      results.performanceSummary.average * 0.25,
      results.readabilitySummary.average * 0.25,
      results.touchTargetsSummary.average * 0.25,
      results.accessibilitySummary.average * 0.25
    ];

    return roundTo(scores.reduce((a, b) => a + b, 0), 0);
  }
}

module.exports = new MobileAnalyzerService();
