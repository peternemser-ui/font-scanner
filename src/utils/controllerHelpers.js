/**
 * Controller Helper Utilities
 *
 * Consolidates common patterns used across analyzer controllers:
 * - Analyzer key extraction from request body
 * - Report metadata generation (reportId, screenshotUrl, timestamps)
 * - URL processing and validation
 *
 * @module utils/controllerHelpers
 */

const { normalizeUrl, validateUrl, sanitizeUrl, testUrlReachability } = require('./validators');
const { getRequestScanStartedAt, attachScanStartedAt } = require('./scanTimestamp');
const { makeReportId } = require('./reportId');
const { ensureReportScreenshot } = require('./reportScreenshot');

/**
 * Extract analyzer key from request body, falling back to default
 *
 * This function was duplicated 13 times across controllers. Consolidating here
 * ensures consistent behavior and makes it easier to modify if needed.
 *
 * @param {Object} req - Express request object
 * @param {string} fallbackKey - Default analyzer key if not in request body
 * @returns {string} Analyzer key (from request body or fallback)
 *
 * @example
 * const analyzerKey = getAnalyzerKeyOverride(req, 'seo');
 * // If req.body.analyzerKey is 'custom-seo', returns 'custom-seo'
 * // Otherwise returns 'seo'
 */
function getAnalyzerKeyOverride(req, fallbackKey) {
  const fromBody = req && req.body && typeof req.body.analyzerKey === 'string'
    ? req.body.analyzerKey.trim()
    : '';
  return fromBody || fallbackKey;
}

/**
 * Build standard report metadata (reportId, screenshotUrl, scanStartedAt)
 *
 * This consolidates an 8-line pattern that was duplicated 10+ times across controllers.
 * Handles report ID generation, screenshot capture, and timestamp management.
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.req - Express request object
 * @param {Object} options.results - Analysis results object (may contain timestamp)
 * @param {string} options.url - Normalized URL being analyzed
 * @param {string} options.analyzerKey - Analyzer key (e.g., 'seo', 'security', 'accessibility')
 * @returns {Promise<Object>} Metadata object with { reportId, screenshotUrl, scanStartedAt }
 *
 * @example
 * const metadata = await buildReportMetadata({
 *   req,
 *   results,
 *   url: normalizedUrl,
 *   analyzerKey: 'accessibility'
 * });
 * // Returns: { reportId: 'abc123...', screenshotUrl: '/screenshots/...', scanStartedAt: '2025-01-14T...' }
 */
async function buildReportMetadata({ req, results, url, analyzerKey }) {
  // Determine scan start time from multiple possible sources
  const startedAt = getRequestScanStartedAt(req)
    || results?.startedAt
    || results?.timestamp
    || new Date().toISOString();

  // Generate deterministic report ID
  const reportId = makeReportId({
    analyzerKey,
    normalizedUrl: url,
    startedAtISO: startedAt
  });

  // Capture screenshot if report ID exists
  const screenshotUrl = reportId
    ? await ensureReportScreenshot({
        url,
        reportId,
        requestId: req.id
      })
    : null;

  return { reportId, screenshotUrl, scanStartedAt: startedAt };
}

/**
 * Attach report metadata to results object (mutates in place)
 *
 * Helper function to consistently add report metadata to analysis results.
 * Modifies the results object directly to add reportId, screenshotUrl, and timestamp.
 *
 * @param {Object} results - Analysis results object (modified in place)
 * @param {Object} metadata - Metadata object from buildReportMetadata()
 * @param {string} metadata.reportId - Report ID
 * @param {string} metadata.screenshotUrl - Screenshot URL
 * @param {string} metadata.scanStartedAt - ISO timestamp when scan started
 *
 * @example
 * const results = await analyzer.analyze(url);
 * const metadata = await buildReportMetadata({ req, results, url, analyzerKey: 'seo' });
 * attachReportMetadata(results, metadata);
 * // results now has reportId, screenshotUrl, and proper timestamp fields
 */
function attachReportMetadata(results, metadata) {
  attachScanStartedAt(results, metadata.scanStartedAt);
  if (metadata.reportId) {
    results.reportId = metadata.reportId;
  }
  if (metadata.screenshotUrl) {
    results.screenshotUrl = metadata.screenshotUrl;
  }
}

/**
 * Process URL: sanitize, normalize, validate, and optionally test reachability
 *
 * Consolidates 3 different URL validation patterns found across controllers.
 * Provides consistent URL processing with optional HTTP fallback.
 *
 * @param {string} url - Raw URL from request
 * @param {Object} options - Processing options
 * @param {boolean} options.testReachability - Whether to test if URL is reachable (default: false)
 * @param {boolean} options.allowHttpFallback - Allow HTTP if HTTPS fails (default: false)
 * @returns {Promise<Object>} Result object with { url, isValid, isReachable }
 *
 * @example
 * // Simple validation only
 * const result = await processUrl('example.com');
 * // { url: 'https://example.com', isValid: true, isReachable: null }
 *
 * // With reachability test and HTTP fallback
 * const result = await processUrl('example.com', {
 *   testReachability: true,
 *   allowHttpFallback: true
 * });
 * // { url: 'http://example.com', isValid: true, isReachable: true }
 */
async function processUrl(url, { testReachability = false, allowHttpFallback = false } = {}) {
  // Sanitize and normalize
  const sanitized = sanitizeUrl(url);
  let processed = normalizeUrl(sanitized);
  let isValid = validateUrl(processed);

  // Try HTTP fallback if enabled and HTTPS validation failed
  if (!isValid && allowHttpFallback && processed.startsWith('https://')) {
    const httpUrl = processed.replace('https://', 'http://');
    if (validateUrl(httpUrl)) {
      processed = httpUrl;
      isValid = true;
    }
  }

  // Test reachability if requested
  let isReachable = null;
  if (testReachability && isValid) {
    try {
      isReachable = await testUrlReachability(processed);

      // If HTTPS unreachable, try HTTP fallback
      if (!isReachable && allowHttpFallback && processed.startsWith('https://')) {
        const httpUrl = processed.replace('https://', 'http://');
        const httpReachable = await testUrlReachability(httpUrl);
        if (httpReachable) {
          processed = httpUrl;
          isReachable = true;
        }
      }
    } catch (error) {
      isReachable = false;
    }
  }

  return {
    url: processed,
    isValid,
    isReachable
  };
}

module.exports = {
  getAnalyzerKeyOverride,
  buildReportMetadata,
  attachReportMetadata,
  processUrl
};
