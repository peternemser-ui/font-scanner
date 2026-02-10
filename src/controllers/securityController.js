const securityAnalyzerService = require('../services/securityAnalyzerService');
const { asyncHandler } = require('../utils/errorHandler');
// validators imported via processUrl from controllerHelpers
const { createLogger } = require('../utils/logger');
const {
  getAnalyzerKeyOverride,
  buildReportMetadata,
  attachReportMetadata,
  processUrl
} = require('../utils/controllerHelpers');

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

  // Process URL with reachability test
  const { url: normalizedUrl, isValid, isReachable } = await processUrl(url, { testReachability: true });

  if (!isValid) {
    logger.warn('Invalid URL format for security analysis', { url: normalizedUrl, requestId: req.id });
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Log warning if unreachable but proceed anyway
  if (isReachable === false) {
    logger.warn('URL reachability test failed, but proceeding with security analysis anyway', { url: normalizedUrl, requestId: req.id });
  }

  logger.info('Starting security analysis', { url: normalizedUrl, requestId: req.id });

  try {
    // Perform comprehensive security analysis
    const results = await securityAnalyzerService.analyzeSecurity(normalizedUrl);

    // Attach report metadata (reportId, screenshotUrl, timestamps)
    const analyzerKey = getAnalyzerKeyOverride(req, 'security');
    const metadata = await buildReportMetadata({ req, results, url: normalizedUrl, analyzerKey });
    attachReportMetadata(results, metadata);

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
      stack: error.stack,
    });

    // Categorize error for better client-side handling
    let errorType = 'unknown';
    let userMessage = error.message;

    if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
      errorType = 'timeout';
      userMessage = 'The security scan timed out. The website may be slow or unresponsive.';
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      errorType = 'dns';
      userMessage = 'Could not resolve the website address. Please check the URL.';
    } else if (error.message.includes('ECONNREFUSED')) {
      errorType = 'connection';
      userMessage = 'Connection refused. The website may be down.';
    } else if (error.message.includes('Browser pool')) {
      errorType = 'browser';
      userMessage = 'Server is busy. Please try again in a moment.';
    }

    res.status(500).json({
      error: 'Security analysis failed',
      errorType,
      details: userMessage,
      technicalDetails: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});
