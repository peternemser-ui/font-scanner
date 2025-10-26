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

  return await testUrlReachability(normalized);
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

  logger.info(`CRO analysis completed`, { requestId: req.id, score: results.overallScore });
  res.json(results);
});

/**
 * Brand Consistency Analysis
 * POST /api/brand-consistency
 */
const analyzeBrand = asyncHandler(async (req, res) => {
  const { url } = req.body;
  logger.info(`Brand analysis requested: ${url}`, { requestId: req.id });

  const reachableUrl = await validateAndPrepareUrl(url, req.id);
  const results = await brandConsistencyService.analyzeBrand(reachableUrl);

  logger.info(`Brand analysis completed`, { requestId: req.id, score: results.score });
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

  logger.info(`GDPR compliance analysis completed`, { requestId: req.id, score: results.score });
  res.json(results);
});

module.exports = {
  analyzeCRO,
  analyzeBrand,
  analyzeLocalSEO,
  analyzeGDPR
};
