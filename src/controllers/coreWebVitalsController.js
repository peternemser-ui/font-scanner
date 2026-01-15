/**
 * Core Web Vitals Controller
 * Handles HTTP requests for Core Web Vitals analysis
 */

const coreWebVitalsService = require('../services/coreWebVitalsService');
const { createLogger } = require('../utils/logger');
const { ValidationError, asyncHandler } = require('../utils/errorHandler');
const { validateUrl, sanitizeUrl, normalizeUrl, testUrlReachability } = require('../utils/validators');

const {
  getAnalyzerKeyOverride,
  buildReportMetadata,
  attachReportMetadata
} = require('../utils/controllerHelpers');

const logger = createLogger('CoreWebVitalsController');

/**
 * Analyze Core Web Vitals for a URL
 * POST /api/core-web-vitals
 * Body: { url: string }
 */
exports.analyzeCoreWebVitals = asyncHandler(async (req, res) => {
  const { url: rawUrl } = req.body;

  if (!rawUrl) {
    throw new ValidationError('URL is required');
  }

  // Validate and sanitize URL
  let url = sanitizeUrl(rawUrl);
  url = normalizeUrl(url);
  
  if (!validateUrl(url)) {
    throw new ValidationError('Invalid URL format');
  }

  logger.info(`Starting Core Web Vitals analysis for: ${url}`, { requestId: req.id });

  // Test URL reachability (try HTTPS first, fallback to HTTP)
  const isReachable = await testUrlReachability(url);
  
  if (!isReachable) {
    logger.warn(`URL not reachable: ${url}, trying anyway`);
  }
  
  // Perform Core Web Vitals analysis with the validated URL
  const results = await coreWebVitalsService.analyzeCoreWebVitals(url);

  // Attach report metadata (reportId, screenshotUrl, timestamps)
  const analyzerKey = getAnalyzerKeyOverride(req, 'core-web-vitals');
  const metadata = await buildReportMetadata({ req, results, url: url, analyzerKey });
  attachReportMetadata(results, metadata);

  logger.info(`Core Web Vitals analysis completed for: ${url}`, {
    requestId: req.id,
    score: results.score,
    grade: results.grade
  });

  res.json(results);
});
