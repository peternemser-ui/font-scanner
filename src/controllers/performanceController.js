/**
 * Performance Analyzer Controller
 * Handles HTTP requests for performance analysis
 */

const performanceAnalyzerService = require('../services/performanceAnalyzerService');
const crossBrowserLighthouseService = require('../services/crossBrowserLighthouseService');
const { asyncHandler } = require('../utils/errorHandler');
const { createLogger } = require('../utils/logger');
const { attachToResponse } = require('../utils/scanTimestamp');
const {
  getAnalyzerKeyOverride,
  buildReportMetadata,
  attachReportMetadata,
  processUrl
} = require('../utils/controllerHelpers');

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

  // Process URL with HTTP fallback
  const { url: sanitizedUrl, isValid } = await processUrl(url, { allowHttpFallback: true });

  if (!isValid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL format. Please provide a valid HTTP or HTTPS URL.'
    });
  }

  logger.info(`Performance analysis request for: ${sanitizedUrl} (Request ID: ${req.id})`);

  // Perform analysis
  const results = await performanceAnalyzerService.analyzePerformance(sanitizedUrl);

  // Attach report metadata (reportId, screenshotUrl, timestamps)
  const analyzerKey = getAnalyzerKeyOverride(req, 'performance');
  const metadata = await buildReportMetadata({ req, results, url: sanitizedUrl, analyzerKey });

  // Return results with metadata
  res.json(attachToResponse({
    success: true,
    results,
    reportId: metadata.reportId,
    screenshotUrl: metadata.screenshotUrl,
    requestId: req.id
  }, metadata.scanStartedAt));
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

  // Process URL with HTTP fallback
  const { url: sanitizedUrl, isValid } = await processUrl(url, { allowHttpFallback: true });

  if (!isValid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL format. Please provide a valid HTTP or HTTPS URL.'
    });
  }

  logger.info(`Cross-browser analysis request for: ${sanitizedUrl} (Request ID: ${req.id})`, {
    profiles: profiles || ['desktop', 'mobile']
  });

  // Perform cross-browser analysis
  const results = await crossBrowserLighthouseService.runCrossBrowserAnalysis(sanitizedUrl, {
    profiles: profiles || ['desktop', 'mobile']
  });

  // Attach report metadata (reportId, screenshotUrl, timestamps)
  const analyzerKey = getAnalyzerKeyOverride(req, 'performance');
  const metadata = await buildReportMetadata({ req, results, url: sanitizedUrl, analyzerKey });

  // Return results with metadata
  res.json(attachToResponse({
    success: true,
    results,
    reportId: metadata.reportId,
    screenshotUrl: metadata.screenshotUrl,
    requestId: req.id
  }, metadata.scanStartedAt));
});

module.exports = {
  analyzePerformance,
  analyzeCrossBrowser
};
