/**
 * Broken Link Checker Controller
 */

const brokenLinkService = require('../services/brokenLinkService');
const { asyncHandler, ValidationError } = require('../utils/errorHandler');
const { validateUrl, sanitizeUrl, normalizeUrl, testUrlReachability } = require('../utils/validators');
const { createLogger } = require('../utils/logger');

const logger = createLogger('BrokenLinkController');

/**
 * Check broken links
 * POST /api/broken-links
 * Body: { url: string, maxPages?: number, maxDepth?: number, followExternal?: boolean }
 */
const checkBrokenLinks = asyncHandler(async (req, res) => {
  const { url, maxPages, maxDepth, followExternal } = req.body;

  if (!url) {
    throw new ValidationError('URL is required');
  }

  const sanitized = sanitizeUrl(url);
  const normalized = normalizeUrl(sanitized);

  if (!validateUrl(normalized)) {
    throw new ValidationError('Invalid URL format');
  }

  logger.info(`Broken link check requested: ${normalized}`, {
    requestId: req.id,
    maxPages,
    maxDepth
  });

  const reachableUrl = await testUrlReachability(normalized);

  const options = {};
  if (maxPages) options.maxPages = Math.min(parseInt(maxPages), 100);
  if (maxDepth) options.maxDepth = Math.min(parseInt(maxDepth), 5);
  if (followExternal !== undefined) options.followExternal = Boolean(followExternal);

  const results = await brokenLinkService.checkLinks(reachableUrl, options);

  logger.info(`Broken link check completed`, {
    requestId: req.id,
    score: results.score,
    broken: results.summary.broken
  });

  res.json(results);
});

module.exports = {
  checkBrokenLinks
};
