/**
 * Accessibility Controller
 * Handles HTTP requests for accessibility analysis
 */

const accessibilityAnalyzerService = require('../services/accessibilityAnalyzerService');
const { normalizeUrl, validateUrl } = require('../utils/validators');
const { isUrlSafe } = require('../utils/ssrfProtection');
const { asyncHandler } = require('../utils/errorHandler');
const { createLogger } = require('../utils/logger');
const {
  getAnalyzerKeyOverride,
  buildReportMetadata,
  attachReportMetadata
} = require('../utils/controllerHelpers');

const logger = createLogger('AccessibilityController');

/**
 * POST /api/accessibility
 * Analyze website accessibility
 */
exports.analyzeAccessibility = asyncHandler(async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Normalize URL (add https:// if missing)
  const normalizedUrl = normalizeUrl(url);

  // Validate URL format
  if (!validateUrl(normalizedUrl)) {
    return res.status(400).json({ error: 'Invalid URL format. Please provide a valid website URL.' });
  }

  // SSRF protection: DNS-resolution-based check
  const ssrfCheck = await isUrlSafe(normalizedUrl);
  if (!ssrfCheck.safe) {
    return res.status(400).json({ error: 'Invalid domain. Please provide a valid public domain.' });
  }

  logger.info(`Accessibility analysis request for: ${normalizedUrl} (Request ID: ${req.id})`);

  // Perform analysis
  const results = await accessibilityAnalyzerService.analyzeAccessibility(normalizedUrl);

  // Attach report metadata (reportId, screenshotUrl, timestamps)
  const analyzerKey = getAnalyzerKeyOverride(req, 'accessibility');
  const metadata = await buildReportMetadata({ req, results, url: normalizedUrl, analyzerKey });
  attachReportMetadata(results, metadata);

  res.json(results);
});
