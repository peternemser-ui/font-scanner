/**
 * Mobile Analyzer Controller
 * Handles mobile testing requests
 */

const { asyncHandler, ValidationError } = require('../utils/errorHandler');
const { createLogger } = require('../utils/logger');
const { sanitizeUrl, validateUrl, normalizeUrl } = require('../utils/validators');
const mobileAnalyzerService = require('../services/mobileAnalyzerService');

const logger = createLogger('MobileAnalyzerController');

/**
 * POST /api/mobile-analyze
 * Perform comprehensive mobile analysis
 */
const analyzeMobile = asyncHandler(async (req, res) => {
  const { url, options } = req.body;

  // Validate URL
  if (!url) {
    throw new ValidationError('URL is required');
  }

  // Sanitize, normalize (add https:// if missing), then validate
  const sanitized = sanitizeUrl(url);
  const normalized = normalizeUrl(sanitized);
  
  if (!validateUrl(normalized)) {
    throw new ValidationError('Invalid URL format. Please enter a valid URL.');
  }

  logger.info(`Mobile analysis requested: ${normalized}`, {
    requestId: req.id,
    devices: options?.devices?.length || 2
  });

  try {
    const results = await mobileAnalyzerService.analyzeMobile(normalized, {
      devices: options?.devices || ['iphone-14', 'pixel-7'],
      includePerformance: options?.includePerformance !== false,
      includeAccessibility: options?.includeAccessibility !== false,
      includeReadability: options?.includeReadability !== false,
      checkTouchTargets: options?.checkTouchTargets !== false,
      simulateNetwork: options?.simulateNetwork || '4g'
    });

    logger.info(`Mobile analysis complete: ${results.mobileScore}/100`, {
      requestId: req.id,
      score: results.mobileScore
    });

    res.json({
      success: true,
      url: normalized,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Mobile analysis failed: ${error.message}`, {
      requestId: req.id,
      url: normalized
    });
    throw error;
  }
});

module.exports = {
  analyzeMobile
};
