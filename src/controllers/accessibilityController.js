/**
 * Accessibility Controller
 * Handles HTTP requests for accessibility analysis
 */

const accessibilityAnalyzerService = require('../services/accessibilityAnalyzerService');
const { normalizeUrl, validateUrl } = require('../utils/validators');
const { asyncHandler } = require('../utils/errorHandler');
const { createLogger } = require('../utils/logger');

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

  logger.info(`Accessibility analysis request for: ${normalizedUrl} (Request ID: ${req.id})`);

  // Perform analysis
  const results = await accessibilityAnalyzerService.analyzeAccessibility(normalizedUrl);

  res.json(results);
});
