/**
 * Advanced Analyzers Controller
 * Handles CRO, Brand, Local SEO, and GDPR endpoints
 */

const croAnalyzerService = require('../services/croAnalyzerService');
const brandConsistencyService = require('../services/brandConsistencyService');
const localSEOService = require('../services/localSEOService');
const gdprComplianceService = require('../services/gdprComplianceService');
const { asyncHandler, ValidationError } = require('../utils/errorHandler');
const { validateUrl, sanitizeUrl, normalizeUrl, testUrlReachability } = require('../utils/validators');
const { createLogger } = require('../utils/logger');

const {
  getAnalyzerKeyOverride,
  buildReportMetadata,
  attachReportMetadata
} = require('../utils/controllerHelpers');

const logger = createLogger('AdvancedAnalyzersController');

// Helper function for URL validation
const validateAndPrepareUrl = async (url, requestId) => {
  if (!url) {
    throw new ValidationError('URL is required');
  }

  const sanitized = sanitizeUrl(url);
  const normalized = normalizeUrl(sanitized);

  if (!validateUrl(normalized)) {
    throw new ValidationError('Invalid URL format');
  }

  // Test HTTPS first
  let isReachable = await testUrlReachability(normalized);
  if (isReachable) {
    return normalized;
  }

  // If HTTPS failed and URL was auto-normalized to https, try HTTP fallback
  if (normalized.startsWith('https://')) {
    const httpUrl = normalized.replace('https://', 'http://');
    isReachable = await testUrlReachability(httpUrl);
    if (isReachable) {
      logger.info(`HTTPS failed, falling back to HTTP for ${url}`, { requestId });
      return httpUrl;
    }
  }

  throw new ValidationError('URL is not reachable. Please check the address and try again.');
};

/**
 * CRO Analysis
 * POST /api/cro-analysis
 */
const analyzeCRO = asyncHandler(async (req, res) => {
  const { url } = req.body;
  logger.info(`CRO analysis requested: ${url}`, { requestId: req.id });

  const reachableUrl = await validateAndPrepareUrl(url, req.id);
  const results = await croAnalyzerService.analyzeCRO(reachableUrl);
  // Attach report metadata (reportId, screenshotUrl, timestamps)
  const analyzerKey = getAnalyzerKeyOverride(req, 'cro-analysis');
  const metadata = await buildReportMetadata({ req, results, url: reachableUrl, analyzerKey });
  attachReportMetadata(results, metadata);

  logger.info(`CRO analysis completed`, { requestId: req.id, score: results.overallScore });
  res.json(results);
});

/**
 * Brand Consistency Analysis
 * POST /api/brand-consistency
 * Supports multiPage mode for crawling multiple pages
 */
const analyzeBrand = asyncHandler(async (req, res) => {
  const { url, multiPage = false, maxPages = 5 } = req.body;
  logger.info(`Brand analysis requested: ${url}`, { 
    requestId: req.id, 
    multiPage, 
    maxPages: multiPage ? maxPages : 1 
  });

  const reachableUrl = await validateAndPrepareUrl(url, req.id);
  const results = await brandConsistencyService.analyzeBrand(reachableUrl, { 
    multiPage, 
    maxPages: Math.min(maxPages, 10) // Cap at 10 pages max
  });
  // Attach report metadata (reportId, screenshotUrl, timestamps)
  const analyzerKey = getAnalyzerKeyOverride(req, 'brand-consistency');
  const metadata = await buildReportMetadata({ req, results, url: reachableUrl, analyzerKey });
  attachReportMetadata(results, metadata);

  logger.info(`Brand analysis completed`, { 
    requestId: req.id, 
    score: results.score,
    pagesAnalyzed: results.pagesAnalyzed || 1
  });
  res.json(results);
});

/**
 * Local SEO Analysis
 * POST /api/local-seo
 */
const analyzeLocalSEO = asyncHandler(async (req, res) => {
  const { url } = req.body;
  logger.info(`Local SEO analysis requested: ${url}`, { requestId: req.id });

  const reachableUrl = await validateAndPrepareUrl(url, req.id);
  const results = await localSEOService.analyzeLocalSEO(reachableUrl);
  // Attach report metadata (reportId, screenshotUrl, timestamps)
  const analyzerKey = getAnalyzerKeyOverride(req, 'local-seo');
  const metadata = await buildReportMetadata({ req, results, url: reachableUrl, analyzerKey });
  attachReportMetadata(results, metadata);

  logger.info(`Local SEO analysis completed`, { requestId: req.id, score: results.score });
  res.json(results);
});

/**
 * GDPR Compliance Analysis
 * POST /api/gdpr-compliance
 */
const analyzeGDPR = asyncHandler(async (req, res) => {
  const { url } = req.body;
  logger.info(`GDPR compliance analysis requested: ${url}`, { requestId: req.id });

  const reachableUrl = await validateAndPrepareUrl(url, req.id);
  const results = await gdprComplianceService.analyzeCompliance(reachableUrl);
  // Attach report metadata (reportId, screenshotUrl, timestamps)
  const analyzerKey = getAnalyzerKeyOverride(req, 'gdpr-compliance');
  const metadata = await buildReportMetadata({ req, results, url: reachableUrl, analyzerKey });
  attachReportMetadata(results, metadata);

  logger.info(`GDPR compliance analysis completed`, { requestId: req.id, score: results.score });
  res.json(results);
});

module.exports = {
  analyzeCRO,
  analyzeBrand,
  analyzeLocalSEO,
  analyzeGDPR
};
