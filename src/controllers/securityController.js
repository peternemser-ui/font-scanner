const securityAnalyzerService = require('../services/securityAnalyzerService');
const { asyncHandler } = require('../utils/errorHandler');
const { normalizeUrl, validateUrl, testUrlReachability } = require('../utils/validators');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SecurityController');

/**
 * Security Analysis Controller
 * Handles /api/security endpoint
 */

/**
 * POST /api/security
 * Comprehensive security audit with SSL/TLS, headers, vulnerabilities, cookies
 */
exports.analyzeSecurity = asyncHandler(async (req, res) => {
  const { url } = req.body;

  // Validate URL
  if (!url) {
    logger.warn('Security analysis request missing URL', { requestId: req.id });
    return res.status(400).json({ error: 'URL is required' });
  }

  // Normalize and validate
  const normalizedUrl = normalizeUrl(url);
  if (!validateUrl(normalizedUrl)) {
    logger.warn('Invalid URL format for security analysis', { url: normalizedUrl, requestId: req.id });
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Test reachability (non-blocking - just log a warning)
  const isReachable = await testUrlReachability(normalizedUrl);
  if (!isReachable) {
    logger.warn('URL reachability test failed, but proceeding with security analysis anyway', { url: normalizedUrl, requestId: req.id });
  }

  logger.info('Starting security analysis', { url: normalizedUrl, requestId: req.id });

  try {
    // Perform comprehensive security analysis
    const results = await securityAnalyzerService.analyzeSecurity(normalizedUrl);

    logger.info('Security analysis completed successfully', {
      url: normalizedUrl,
      requestId: req.id,
      overallScore: results.overallScore,
      owaspCompliance: results.owaspCompliance,
    });

    res.json(results);
  } catch (error) {
    logger.error('Security analysis failed', {
      url: normalizedUrl,
      requestId: req.id,
      error: error.message,
    });

    res.status(500).json({
      error: 'Security analysis failed',
      details: error.message,
    });
  }
});
