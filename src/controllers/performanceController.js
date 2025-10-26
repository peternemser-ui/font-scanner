/**
 * Performance Analyzer Controller
 * Handles HTTP requests for performance analysis
 */

const performanceAnalyzerService = require('../services/performanceAnalyzerService');
const crossBrowserLighthouseService = require('../services/crossBrowserLighthouseService');
const { asyncHandler } = require('../utils/errorHandler');
const { validateUrl, sanitizeUrl, normalizeUrl } = require('../utils/validators');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PerformanceController');

/**
 * Analyze website performance
 * POST /api/performance
 */
const analyzePerformance = asyncHandler(async (req, res) => {
  const { url } = req.body;

  // Validate URL
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required'
    });
  }

  // Sanitize and normalize URL (automatically add https:// if no protocol)
  let sanitizedUrl = sanitizeUrl(url);
  sanitizedUrl = normalizeUrl(sanitizedUrl);
  
  // Basic URL format validation
  const isValid = validateUrl(sanitizedUrl);
  
  if (!isValid) {
    // Try with http:// if https:// failed
    const httpUrl = sanitizedUrl.replace('https://', 'http://');
    if (!validateUrl(httpUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format. Please provide a valid HTTP or HTTPS URL.'
      });
    }
    sanitizedUrl = httpUrl;
  }

  logger.info(`Performance analysis request for: ${sanitizedUrl} (Request ID: ${req.id})`);

  // Perform analysis
  const results = await performanceAnalyzerService.analyzePerformance(sanitizedUrl);

  // Return results
  res.json({
    success: true,
    results,
    requestId: req.id
  });
});

/**
 * Cross-browser performance comparison
 * POST /api/performance/cross-browser
 */
const analyzeCrossBrowser = asyncHandler(async (req, res) => {
  const { url, profiles } = req.body;

  // Validate URL
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required'
    });
  }

  // Sanitize and normalize URL
  let sanitizedUrl = sanitizeUrl(url);
  sanitizedUrl = normalizeUrl(sanitizedUrl);
  
  // Basic URL format validation
  const isValid = validateUrl(sanitizedUrl);
  
  if (!isValid) {
    // Try with http:// if https:// failed
    const httpUrl = sanitizedUrl.replace('https://', 'http://');
    if (!validateUrl(httpUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format. Please provide a valid HTTP or HTTPS URL.'
      });
    }
    sanitizedUrl = httpUrl;
  }

  logger.info(`Cross-browser analysis request for: ${sanitizedUrl} (Request ID: ${req.id})`, {
    profiles: profiles || ['desktop', 'mobile']
  });

  // Perform cross-browser analysis
  const results = await crossBrowserLighthouseService.runCrossBrowserAnalysis(sanitizedUrl, {
    profiles: profiles || ['desktop', 'mobile']
  });

  // Return results
  res.json({
    success: true,
    results,
    requestId: req.id
  });
});

module.exports = {
  analyzePerformance,
  analyzeCrossBrowser
};
