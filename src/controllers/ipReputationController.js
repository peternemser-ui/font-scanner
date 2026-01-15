const ipReputationService = require('../services/ipReputationService');
const { asyncHandler } = require('../utils/errorHandler');
const { createLogger } = require('../utils/logger');
const { getRequestScanStartedAt, attachScanStartedAt } = require('../utils/scanTimestamp');
const { makeReportId } = require('../utils/reportId');
const { ensureReportScreenshot } = require('../utils/reportScreenshot');
const { getAnalyzerKeyOverride } = require('../utils/controllerHelpers');

const logger = createLogger('IPReputationController');

/**
 * IP/Domain Reputation Controller
 * Handles /api/ip-reputation endpoint
 */

/**
 * POST /api/ip-reputation
 * Comprehensive reputation check for IP addresses and domain names
 * Includes blacklist checking, email deliverability, hosting reputation, and threat intelligence
 */
exports.analyzeIPReputation = asyncHandler(async (req, res) => {
  const { input } = req.body;

  // Validate input
  if (!input) {
    logger.warn('IP reputation analysis request missing input', { requestId: req.id });
    return res.status(400).json({ error: 'IP address or domain name is required' });
  }

  const normalizedInput = input.trim();

  logger.info('Starting IP/domain reputation analysis', { input: normalizedInput, requestId: req.id });

  try {
    // Perform comprehensive reputation analysis
    const results = await ipReputationService.analyzeReputation(normalizedInput);
    const startedAt = getRequestScanStartedAt(req) || new Date().toISOString();
    const analyzerKey = getAnalyzerKeyOverride(req, 'ip-reputation');
    const reportId = makeReportId({ analyzerKey, normalizedUrl: normalizedInput, startedAtISO: startedAt });
    // Screenshot is only meaningful for domains/URLs; skip for plain IPs.
    const screenshotUrl = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalizedInput)
      ? null
      : (reportId ? await ensureReportScreenshot({ url: normalizedInput.startsWith('http') ? normalizedInput : `https://${normalizedInput}`, reportId, requestId: req.id }) : null);

    attachScanStartedAt(results, startedAt);
    if (reportId) results.reportId = reportId;
    if (screenshotUrl) results.screenshotUrl = screenshotUrl;

    logger.info('IP/domain reputation analysis completed successfully', {
      input: normalizedInput,
      requestId: req.id,
      overallScore: results.overallScore,
      blacklistStatus: results.blacklistStatus,
    });

    res.json(results);
  } catch (error) {
    logger.error('IP/domain reputation analysis failed', {
      input: normalizedInput,
      requestId: req.id,
      error: error.message,
    });

    res.status(500).json({
      error: 'IP/domain reputation analysis failed',
      details: error.message,
    });
  }
});
