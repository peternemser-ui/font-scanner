/**
 * Mobile Analyzer Controller
 * Handles mobile testing requests
 */

const { asyncHandler, ValidationError } = require('../utils/errorHandler');
const { createLogger } = require('../utils/logger');
const { sanitizeUrl, validateUrl, normalizeUrl } = require('../utils/validators');
const mobileAnalyzerService = require('../services/mobileAnalyzerService');
const { getRequestScanStartedAt, attachToResponse } = require('../utils/scanTimestamp');

const { makeReportId } = require('../utils/reportId');
const { ensureReportScreenshot } = require('../utils/reportScreenshot');
const { getAnalyzerKeyOverride } = require('../utils/controllerHelpers');

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

    const startedAt = getRequestScanStartedAt(req) || results?.startedAt || results?.timestamp || new Date().toISOString();
    const analyzerKey = getAnalyzerKeyOverride(req, 'mobile-analyzer');
    const reportId = makeReportId({ analyzerKey, normalizedUrl: normalized, startedAtISO: startedAt });
    const screenshotUrl = reportId ? await ensureReportScreenshot({ url: normalized, reportId, requestId: req.id }) : null;

    res.json(attachToResponse({
      success: true,
      url: normalized,
      results,
      reportId,
      screenshotUrl,
      timestamp: new Date().toISOString()
    }, startedAt));
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
