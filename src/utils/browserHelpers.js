/**
 * Browser Interaction Helper Utilities
 *
 * Consolidates browser automation patterns used across 17+ services:
 * - Timeout wrappers for analysis functions
 * - Bot detection (Cloudflare, CAPTCHA, access denied)
 * - Device profile emulation (mobile, tablet, desktop)
 * - Page navigation with retries and error handling
 *
 * @module utils/browserHelpers
 */

const { createLogger } = require('./logger');
const logger = createLogger('BrowserHelpers');

/**
 * Device profiles for mobile/tablet testing
 * Consolidated from mobileAnalyzerService.js, crossBrowserTestingService.js
 */
const DEVICE_PROFILES = {
  'desktop': {
    name: 'Desktop (1920x1080)',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
    isMobile: false
  },
  'iphone-14': {
    name: 'iPhone 14',
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  },
  'iphone-se': {
    name: 'iPhone SE',
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  },
  'pixel-7': {
    name: 'Pixel 7',
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true
  },
  'galaxy-s23': {
    name: 'Galaxy S23',
    viewport: { width: 360, height: 800 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  },
  'ipad': {
    name: 'iPad',
    viewport: { width: 768, height: 1024 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  },
  'ipad-pro': {
    name: 'iPad Pro',
    viewport: { width: 1024, height: 1366 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  }
};

/**
 * Bot detection patterns
 * Consolidated from seoAnalyzer.js, accessibilityAnalyzerService.js, securityAnalyzerService.js
 */
const BOT_DETECTION_PATTERNS = [
  /cloudflare/i,
  /captcha/i,
  /bot[\s-]?detection/i,
  /access[\s-]?denied/i,
  /checking your browser/i,
  /ray id:/i, // Cloudflare Ray ID
  /ddos[\s-]?protection/i,
  /please verify you are human/i,
  /security check/i
];

/**
 * Execute function with timeout
 *
 * Consolidates the Promise.race timeout pattern found in seoAnalyzer.js,
 * securityAnalyzerService.js, accessibilityAnalyzerService.js
 *
 * @param {Function} asyncFn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMessage - Custom error message on timeout
 * @returns {Promise<*>} Result from asyncFn
 * @throws {Error} If timeout is reached
 *
 * @example
 * const result = await executeWithTimeout(
 *   () => browserPool.execute(async (browser) => { ... }),
 *   35000,
 *   'SEO analysis timed out after 35 seconds'
 * );
 */
async function executeWithTimeout(asyncFn, timeoutMs, errorMessage) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([asyncFn(), timeoutPromise]);
}

/**
 * Detect bot protection on page
 *
 * Consolidates bot detection logic from seoAnalyzer.js, accessibilityAnalyzerService.js
 * Checks response status and page content for bot detection patterns
 *
 * @param {Object} page - Puppeteer page object
 * @param {Object} response - Navigation response object
 * @returns {Promise<Object>} Detection result { isDetected, reason, title }
 *
 * @example
 * const detection = await detectBotProtection(page, response);
 * if (detection.isDetected) {
 *   throw new Error(`Bot protection detected: ${detection.reason}`);
 * }
 */
async function detectBotProtection(page, response) {
  // Check response status
  if (response && (response.status() === 403 || response.status() === 429)) {
    return {
      isDetected: true,
      reason: `Access denied (HTTP ${response.status()})`,
      title: null
    };
  }

  // Check page content for bot detection patterns
  try {
    const pageContent = await page.content();
    const hasPattern = BOT_DETECTION_PATTERNS.some(pattern => pattern.test(pageContent));

    if (hasPattern) {
      // Double-check by looking at page title
      const title = await page.title().catch(() => '');
      const titleIndicators = [
        'attention required',
        'just a moment',
        'access denied',
        'security check',
        'verify you are human'
      ];

      const titleHasIndicator = titleIndicators.some(indicator =>
        title.toLowerCase().includes(indicator)
      );

      if (titleHasIndicator) {
        return {
          isDetected: true,
          reason: 'Bot protection detected in page content and title',
          title
        };
      }

      // Pattern found but title doesn't confirm - log warning but don't fail
      logger.warn('Bot detection pattern found but title does not confirm', { title });
    }

    return {
      isDetected: false,
      reason: null,
      title: null
    };
  } catch (error) {
    logger.warn('Error during bot detection check', { error: error.message });
    return {
      isDetected: false,
      reason: null,
      title: null
    };
  }
}

/**
 * Set device profile on page
 *
 * Consolidates device profile setup from mobileAnalyzerService.js,
 * crossBrowserTestingService.js
 *
 * @param {Object} page - Puppeteer page object
 * @param {string} deviceKey - Device profile key or custom profile object
 * @param {Object} customProfile - Optional custom profile (overrides deviceKey)
 * @returns {Promise<Object>} Applied device profile
 *
 * @example
 * // Use predefined profile
 * await setDeviceProfile(page, 'iphone-14');
 *
 * // Use custom profile
 * await setDeviceProfile(page, null, {
 *   viewport: { width: 375, height: 812 },
 *   userAgent: 'Custom UA'
 * });
 */
async function setDeviceProfile(page, deviceKey = 'desktop', customProfile = null) {
  let profile;

  if (customProfile) {
    profile = customProfile;
  } else if (DEVICE_PROFILES[deviceKey]) {
    profile = DEVICE_PROFILES[deviceKey];
  } else {
    logger.warn(`Unknown device profile: ${deviceKey}, using desktop`, { deviceKey });
    profile = DEVICE_PROFILES.desktop;
  }

  // Set viewport
  if (profile.viewport) {
    await page.setViewport({
      width: profile.viewport.width,
      height: profile.viewport.height,
      deviceScaleFactor: profile.deviceScaleFactor || 1,
      isMobile: profile.isMobile || false,
      hasTouch: profile.hasTouch || false
    });
  }

  // Set user agent
  if (profile.userAgent) {
    await page.setUserAgent(profile.userAgent);
  }

  logger.info('Device profile applied', {
    name: profile.name || 'Custom',
    viewport: profile.viewport,
    isMobile: profile.isMobile
  });

  return profile;
}

/**
 * Navigate to page with retries and error handling
 *
 * Consolidates navigation patterns from multiple services
 * Includes timeout, waitUntil options, and bot detection
 *
 * @param {Object} page - Puppeteer page object
 * @param {string} url - URL to navigate to
 * @param {Object} options - Navigation options
 * @param {number} options.timeout - Navigation timeout (default: 30000)
 * @param {string} options.waitUntil - Wait condition (default: 'domcontentloaded')
 * @param {boolean} options.checkBotProtection - Check for bot protection (default: true)
 * @param {number} options.retries - Number of retries on failure (default: 0)
 * @returns {Promise<Object>} Navigation response
 * @throws {Error} If navigation fails or bot protection detected
 *
 * @example
 * const response = await navigateToPage(page, 'https://example.com', {
 *   timeout: 30000,
 *   waitUntil: 'domcontentloaded',
 *   checkBotProtection: true,
 *   retries: 1
 * });
 */
async function navigateToPage(page, url, options = {}) {
  const {
    timeout = 30000,
    waitUntil = 'domcontentloaded',
    checkBotProtection = true,
    retries = 0
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      logger.info('Navigating to page', { url, attempt: attempt + 1, maxAttempts: retries + 1 });

      const response = await page.goto(url, {
        waitUntil,
        timeout
      });

      logger.info('Navigation completed', {
        url,
        status: response ? response.status() : 'unknown'
      });

      // Check for bot protection if enabled
      if (checkBotProtection) {
        const botDetection = await detectBotProtection(page, response);
        if (botDetection.isDetected) {
          throw new Error(
            `Bot protection detected: ${botDetection.reason}. ` +
            'This website blocks automated analysis. Try a different website or contact the site owner.'
          );
        }
      }

      return response;
    } catch (error) {
      lastError = error;
      logger.warn(`Navigation attempt ${attempt + 1} failed`, {
        url,
        error: error.message,
        willRetry: attempt < retries
      });

      if (attempt < retries) {
        // Wait before retry with exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

/**
 * Wait for page to be ready for analysis
 *
 * Waits for network idle and optionally for specific selectors
 *
 * @param {Object} page - Puppeteer page object
 * @param {Object} options - Wait options
 * @param {number} options.timeout - Wait timeout (default: 10000)
 * @param {string} options.selector - Optional selector to wait for
 * @param {boolean} options.waitForNetworkIdle - Wait for network idle (default: false)
 * @returns {Promise<void>}
 */
async function waitForPageReady(page, options = {}) {
  const {
    timeout = 10000,
    selector = null,
    waitForNetworkIdle = false
  } = options;

  try {
    if (selector) {
      await page.waitForSelector(selector, { timeout });
    }

    if (waitForNetworkIdle) {
      await page.waitForNetworkIdle({ timeout, idleTime: 500 });
    }
  } catch (error) {
    logger.warn('Wait for page ready timed out', {
      timeout,
      selector,
      error: error.message
    });
    // Don't throw - page might still be usable
  }
}

/**
 * Get available device profiles
 *
 * @returns {Object} Map of device profile keys to profiles
 */
function getDeviceProfiles() {
  return { ...DEVICE_PROFILES };
}

/**
 * Get device profile by key
 *
 * @param {string} key - Device profile key
 * @returns {Object|null} Device profile or null if not found
 */
function getDeviceProfile(key) {
  return DEVICE_PROFILES[key] || null;
}

module.exports = {
  // Core functions
  executeWithTimeout,
  detectBotProtection,
  setDeviceProfile,
  navigateToPage,
  waitForPageReady,

  // Device profiles
  getDeviceProfiles,
  getDeviceProfile,
  DEVICE_PROFILES
};
