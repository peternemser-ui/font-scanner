/**
 * Tag Intelligence Controller
 * Handles analytics/tracking tag detection and analysis
 */

const tagAnalyzer = require('../services/tagAnalyzer');
const enhancedFontAnalyzer = require('../services/enhancedFontAnalyzer');
const performanceSnapshotAnalyzer = require('../services/performanceSnapshotAnalyzer');
const crawlerService = require('../services/crawlerService');
const { asyncHandler, ValidationError } = require('../utils/errorHandler');
const { validateUrl, sanitizeUrl, normalizeUrl, testUrlReachability } = require('../utils/validators');
const { createLogger } = require('../utils/logger');
const { getRequestScanStartedAt, attachScanStartedAt } = require('../utils/scanTimestamp');
const { makeReportId } = require('../utils/reportId');
const { ensureReportScreenshot } = require('../utils/reportScreenshot');
const { getAnalyzerKeyOverride } = require('../utils/controllerHelpers');

const logger = createLogger('TagIntelligenceController');

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
 * Tag Intelligence Analysis
 * POST /api/tag-intelligence
 * Detects GTM, GA4, Meta Pixel, TikTok, LinkedIn, Hotjar, etc.
 */
const analyzeTagIntelligence = asyncHandler(async (req, res) => {
  const { url, options = {} } = req.body;
  const { maxPages = 1, maxDepth = 1, includeSitemap = false } = options;

  logger.info(`Tag intelligence analysis requested: ${url}`, { requestId: req.id });

  const reachableUrl = await validateAndPrepareUrl(url, req.id);

  let urlsToAnalyze = [reachableUrl];

  // Multi-page crawl if requested
  if (maxPages > 1) {
    logger.info(`Crawling up to ${maxPages} pages for tag analysis`, { requestId: req.id });
    urlsToAnalyze = await crawlerService.crawl(reachableUrl, {
      maxPages: Math.min(maxPages, 10), // Cap at 10 for tag analysis
      maxDepth: Math.min(maxDepth, 3),
      includeSitemap
    });
  }

  // Analyze tags across all pages
  const pageResults = [];
  const aggregatedTags = new Map();
  const allIssues = [];
  const allDuplicates = [];

  for (const pageUrl of urlsToAnalyze) {
    try {
      const result = await tagAnalyzer.analyzeTags(pageUrl);
      pageResults.push({
        url: pageUrl,
        ...result
      });

      // Aggregate tags
      if (result.tags) {
        result.tags.forEach(tag => {
          const existing = aggregatedTags.get(tag.name);
          if (existing) {
            existing.pagesFound.push(pageUrl);
            existing.instances += tag.instances;
          } else {
            aggregatedTags.set(tag.name, {
              ...tag,
              pagesFound: [pageUrl]
            });
          }
        });
      }

      // Collect issues
      if (result.issues) {
        allIssues.push(...result.issues.map(issue => ({
          ...issue,
          foundOn: pageUrl
        })));
      }

      // Collect duplicates
      if (result.duplicates) {
        allDuplicates.push(...result.duplicates.map(dup => ({
          ...dup,
          foundOn: pageUrl
        })));
      }
    } catch (error) {
      logger.error(`Error analyzing tags for ${pageUrl}: ${error.message}`, { requestId: req.id });
    }
  }

  // Calculate overall health score
  const scores = pageResults.map(r => r.healthScore || 0).filter(s => s > 0);
  const overallHealthScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  // Build summary
  const tagsByCategory = {};
  aggregatedTags.forEach(tag => {
    const category = tag.category || 'other';
    if (!tagsByCategory[category]) {
      tagsByCategory[category] = [];
    }
    tagsByCategory[category].push(tag);
  });

  const response = {
    url: reachableUrl,
    analyzedAt: new Date().toISOString(),
    pagesScanned: urlsToAnalyze.length,
    healthScore: overallHealthScore,
    summary: {
      totalTags: aggregatedTags.size,
      byCategory: Object.fromEntries(
        Object.entries(tagsByCategory).map(([cat, tags]) => [cat, tags.length])
      ),
      issueCount: allIssues.length,
      duplicateCount: allDuplicates.length
    },
    tags: Array.from(aggregatedTags.values()),
    tagsByCategory,
    issues: allIssues,
    duplicates: allDuplicates,
    recommendations: generateTagRecommendations(allIssues, allDuplicates, aggregatedTags),
    pageResults: maxPages > 1 ? pageResults : undefined
  };

  logger.info(`Tag intelligence analysis completed`, {
    requestId: req.id,
    score: overallHealthScore,
    tagsFound: aggregatedTags.size
  });

  const startedAt = getRequestScanStartedAt(req) || new Date().toISOString();
  const analyzerKey = getAnalyzerKeyOverride(req, 'tag-intelligence');
  const reportId = makeReportId({ analyzerKey, normalizedUrl: reachableUrl, startedAtISO: startedAt });
  const screenshotUrl = reportId ? await ensureReportScreenshot({ url: reachableUrl, reportId, requestId: req.id }) : null;

  attachScanStartedAt(response, startedAt);
  if (reportId) response.reportId = reportId;
  if (screenshotUrl) response.screenshotUrl = screenshotUrl;
  res.json(response);
});

/**
 * Enhanced Font Analysis
 * POST /api/enhanced-fonts
 * Provider detection, duplicates, unused fonts, font-display issues
 * PLUS original font scanner functionality (performance, best practices, screenshot)
 */
const analyzeEnhancedFonts = asyncHandler(async (req, res) => {
  const { url, options = {} } = req.body;
  const { maxPages = 1, maxDepth = 1, includeSitemap = false, includeFullScan = true } = options;

  logger.info(`Enhanced font analysis requested: ${url}`, { requestId: req.id });

  const reachableUrl = await validateAndPrepareUrl(url, req.id);

  let urlsToAnalyze = [reachableUrl];
  
  // Run the original font scanner service for detailed data (performance, best practices, screenshot)
  let fullScanData = null;
  if (includeFullScan) {
    try {
      const fontScannerService = require('../services/fontScannerService');
      fullScanData = await fontScannerService.scanWebsite(reachableUrl, { singleViewport: false });
      logger.info(`Full font scan completed`, { requestId: req.id });
    } catch (scanError) {
      logger.warn(`Full font scan failed, continuing with enhanced analysis: ${scanError.message}`, { requestId: req.id });
    }
  }

  // Multi-page crawl if requested
  if (maxPages > 1) {
    logger.info(`Crawling up to ${maxPages} pages for font analysis`, { requestId: req.id });
    urlsToAnalyze = await crawlerService.crawl(reachableUrl, {
      maxPages: Math.min(maxPages, 20), // Cap at 20 for font analysis
      maxDepth: Math.min(maxDepth, 3),
      includeSitemap
    });
  }

  // Analyze fonts across all pages
  const pageResults = [];
  const aggregatedProviders = new Map();
  const aggregatedFamilies = new Map();
  const allDuplicates = [];
  const allUnused = [];
  const allDisplayIssues = [];
  const allPreloadIssues = [];

  for (const pageUrl of urlsToAnalyze) {
    try {
      const result = await enhancedFontAnalyzer.analyzeFont(pageUrl);
      pageResults.push({
        url: pageUrl,
        ...result
      });

      // Aggregate providers
      if (result.providers) {
        result.providers.forEach(provider => {
          const existing = aggregatedProviders.get(provider.name);
          if (existing) {
            existing.pagesFound.push(pageUrl);
            provider.families.forEach(f => existing.families.add(f));
          } else {
            aggregatedProviders.set(provider.name, {
              ...provider,
              families: new Set(provider.families),
              pagesFound: [pageUrl]
            });
          }
        });
      }

      // Aggregate families
      if (result.families) {
        result.families.forEach((family, name) => {
          const existing = aggregatedFamilies.get(name);
          if (existing) {
            existing.pagesFound.push(pageUrl);
          } else {
            aggregatedFamilies.set(name, {
              name,
              variants: family.variants || [],
              pagesFound: [pageUrl]
            });
          }
        });
      }

      // Collect issues
      if (result.duplicates) allDuplicates.push(...result.duplicates.map(d => ({ ...d, foundOn: pageUrl })));
      if (result.unused) allUnused.push(...result.unused.map(u => ({ ...u, foundOn: pageUrl })));
      if (result.displayIssues) allDisplayIssues.push(...result.displayIssues.map(d => ({ ...d, foundOn: pageUrl })));
      if (result.preloadIssues) allPreloadIssues.push(...result.preloadIssues.map(p => ({ ...p, foundOn: pageUrl })));

    } catch (error) {
      logger.error(`Error analyzing fonts for ${pageUrl}: ${error.message}`, { requestId: req.id });
    }
  }

  // Calculate overall health score
  const scores = pageResults.map(r => r.healthScore || 0).filter(s => s > 0);
  const overallHealthScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  // Format providers for response
  const providers = Array.from(aggregatedProviders.values()).map(p => ({
    ...p,
    families: Array.from(p.families)
  }));

  const response = {
    url: reachableUrl,
    analyzedAt: new Date().toISOString(),
    pagesScanned: urlsToAnalyze.length,
    healthScore: overallHealthScore,
    summary: {
      totalFamilies: aggregatedFamilies.size,
      totalProviders: providers.length,
      duplicateCount: allDuplicates.length,
      unusedCount: allUnused.length,
      displayIssueCount: allDisplayIssues.length,
      preloadIssueCount: allPreloadIssues.length
    },
    providers,
    families: Array.from(aggregatedFamilies.values()),
    issues: {
      duplicates: allDuplicates,
      unused: allUnused,
      displayIssues: allDisplayIssues,
      preloadIssues: allPreloadIssues
    },
    recommendations: generateFontRecommendations(allDuplicates, allDisplayIssues, allPreloadIssues, providers),
    pageResults: maxPages > 1 ? pageResults : undefined,
    // Include original font scanner data for full functionality
    fullScan: fullScanData ? {
      fonts: fullScanData.fonts,
      performance: fullScanData.performance,
      bestPractices: fullScanData.bestPractices,
      screenshot: fullScanData.screenshot,
      metadata: fullScanData.metadata,
      desktop: fullScanData.desktop,
      mobile: fullScanData.mobile
    } : null
  };

  logger.info(`Enhanced font analysis completed`, {
    requestId: req.id,
    score: overallHealthScore,
    familiesFound: aggregatedFamilies.size,
    hasFullScan: !!fullScanData
  });

  const startedAt = getRequestScanStartedAt(req) || new Date().toISOString();
  const analyzerKey = getAnalyzerKeyOverride(req, 'enhanced-fonts');
  const reportId = makeReportId({ analyzerKey, normalizedUrl: reachableUrl, startedAtISO: startedAt });
  const screenshotUrl = reportId ? await ensureReportScreenshot({ url: reachableUrl, reportId, requestId: req.id }) : null;

  attachScanStartedAt(response, startedAt);
  if (reportId) response.reportId = reportId;
  if (screenshotUrl) response.screenshotUrl = screenshotUrl;
  res.json(response);
});

/**
 * Performance Snapshot Analysis
 * POST /api/performance-snapshot
 * Quick performance scan without full Lighthouse
 */
const analyzePerformanceSnapshot = asyncHandler(async (req, res) => {
  const { url, options = {} } = req.body;
  const { maxPages = 1, maxDepth = 1 } = options;

  logger.info(`Performance snapshot requested: ${url}`, { requestId: req.id });

  const reachableUrl = await validateAndPrepareUrl(url, req.id);

  let urlsToAnalyze = [reachableUrl];

  // Multi-page crawl if requested
  if (maxPages > 1) {
    urlsToAnalyze = await crawlerService.crawl(reachableUrl, {
      maxPages: Math.min(maxPages, 10),
      maxDepth: Math.min(maxDepth, 2)
    });
  }

  // Analyze performance across all pages
  const pageResults = [];
  const errors = [];

  for (const pageUrl of urlsToAnalyze) {
    try {
      const result = await performanceSnapshotAnalyzer.analyzePerformance(pageUrl);

      // Check if result contains an error
      if (result.error) {
        errors.push({ url: pageUrl, error: result.error });
        logger.error(`Performance analysis failed for ${pageUrl}: ${result.error}`, { requestId: req.id });
      } else {
        pageResults.push({
          url: pageUrl,
          ...result
        });
      }
    } catch (error) {
      errors.push({ url: pageUrl, error: error.message });
      logger.error(`Error analyzing performance for ${pageUrl}: ${error.message}`, { requestId: req.id });
    }
  }

  // If all pages failed, return error response
  if (pageResults.length === 0) {
    const errorMessage = errors[0]?.error || 'Failed to analyze performance';
    logger.error(`All performance analyses failed`, { requestId: req.id, errors });
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: errors
    });
  }

  // Calculate averages
  const avgScore = pageResults.length > 0
    ? Math.round(pageResults.reduce((sum, r) => sum + (r.performanceScore || 0), 0) / pageResults.length)
    : 0;

  const response = {
    url: reachableUrl,
    analyzedAt: new Date().toISOString(),
    pagesScanned: urlsToAnalyze.length,
    performanceScore: avgScore,
    summary: pageResults[0]?.summary || {},
    resources: pageResults[0]?.resources || {},
    issues: pageResults[0]?.issues || [],
    recommendations: pageResults[0]?.recommendations || {},
    pageResults: maxPages > 1 ? pageResults : undefined,
    errors: errors.length > 0 ? errors : undefined
  };

  logger.info(`Performance snapshot completed`, {
    requestId: req.id,
    score: avgScore,
    successfulPages: pageResults.length,
    failedPages: errors.length
  });

  const startedAt = getRequestScanStartedAt(req) || new Date().toISOString();
  const analyzerKey = getAnalyzerKeyOverride(req, 'performance-snapshot');
  const reportId = makeReportId({ analyzerKey, normalizedUrl: reachableUrl, startedAtISO: startedAt });
  const screenshotUrl = reportId ? await ensureReportScreenshot({ url: reachableUrl, reportId, requestId: req.id }) : null;

  attachScanStartedAt(response, startedAt);
  if (reportId) response.reportId = reportId;
  if (screenshotUrl) response.screenshotUrl = screenshotUrl;
  res.json(response);
});

/**
 * Multi-Page Crawl
 * POST /api/crawl
 * Crawl site with limits and return discovered pages
 */
const crawlSite = asyncHandler(async (req, res) => {
  const { url, options = {} } = req.body;
  const {
    maxPages = 10,
    maxDepth = 3,
    includeSitemap = true,
    respectRobotsTxt = true
  } = options;

  logger.info(`Site crawl requested: ${url}`, { requestId: req.id, maxPages, maxDepth });

  const reachableUrl = await validateAndPrepareUrl(url, req.id);

  const startTime = Date.now();
  const discoveredUrls = await crawlerService.crawl(reachableUrl, {
    maxPages: Math.min(maxPages, 50), // Cap at 50 for now
    maxDepth: Math.min(maxDepth, 5),
    includeSitemap,
    respectRobotsTxt
  });

  const duration = Date.now() - startTime;

  const response = {
    url: reachableUrl,
    crawledAt: new Date().toISOString(),
    duration: `${(duration / 1000).toFixed(2)}s`,
    options: {
      maxPages: Math.min(maxPages, 50),
      maxDepth: Math.min(maxDepth, 5),
      includeSitemap,
      respectRobotsTxt
    },
    results: {
      pagesDiscovered: discoveredUrls.length,
      pages: discoveredUrls
    }
  };

  logger.info(`Site crawl completed`, {
    requestId: req.id,
    pagesDiscovered: discoveredUrls.length,
    duration
  });

  const startedAt = getRequestScanStartedAt(req) || new Date().toISOString();
  const analyzerKey = getAnalyzerKeyOverride(req, 'site-crawler');
  const reportId = makeReportId({ analyzerKey, normalizedUrl: reachableUrl, startedAtISO: startedAt });
  const screenshotUrl = reportId ? await ensureReportScreenshot({ url: reachableUrl, reportId, requestId: req.id }) : null;

  attachScanStartedAt(response, startedAt);
  if (reportId) response.reportId = reportId;
  if (screenshotUrl) response.screenshotUrl = screenshotUrl;
  res.json(response);
});

// Helper: Generate tag recommendations
function generateTagRecommendations(issues, duplicates, tags) {
  const recommendations = [];

  // Priority recommendations based on issues
  issues.forEach(issue => {
    if (issue.severity === 'high') {
      recommendations.push({
        priority: 'high',
        title: issue.type === 'compliance' ? 'Add Consent Management' : 'Fix Critical Issue',
        description: issue.message,
        action: issue.recommendation
      });
    }
  });

  // Duplicate recommendations
  if (duplicates.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Remove Duplicate Tags',
      description: `${duplicates.length} duplicate tag(s) detected. This may cause double-tracking.`,
      action: 'Review and remove duplicate implementations'
    });
  }

  // Check for missing consent with analytics
  const hasAnalytics = Array.from(tags.values()).some(t => t.category === 'analytics');
  const hasConsent = Array.from(tags.values()).some(t => t.category === 'consent');
  if (hasAnalytics && !hasConsent) {
    recommendations.push({
      priority: 'high',
      title: 'Implement Consent Management',
      description: 'Analytics tags detected without consent management. Required for GDPR/CCPA compliance.',
      action: 'Add OneTrust, Cookiebot, or similar consent solution'
    });
  }

  // Check for GTM best practices
  const hasGTM = Array.from(tags.values()).some(t => t.name.includes('Tag Manager'));
  if (!hasGTM && tags.size > 3) {
    recommendations.push({
      priority: 'medium',
      title: 'Consider Google Tag Manager',
      description: `${tags.size} tags detected. GTM simplifies tag management and improves performance.`,
      action: 'Migrate tags to Google Tag Manager for easier management'
    });
  }

  return recommendations;
}

// Helper: Generate font recommendations
function generateFontRecommendations(duplicates, displayIssues, preloadIssues, providers) {
  const recommendations = [];

  // Duplicate fonts
  if (duplicates.length > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Remove Duplicate Fonts',
      description: `${duplicates.length} duplicate font(s) detected. This wastes bandwidth.`,
      action: 'Consolidate font declarations to load each family once'
    });
  }

  // font-display issues
  if (displayIssues.length > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Add font-display: swap',
      description: `${displayIssues.length} font(s) missing font-display property. This causes invisible text during load.`,
      action: 'Add font-display: swap to @font-face rules or Google Fonts URL'
    });
  }

  // Preload issues
  if (preloadIssues.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Preload Critical Fonts',
      description: `${preloadIssues.length} font(s) could benefit from preloading.`,
      action: 'Add <link rel="preload" as="font" crossorigin> for critical fonts'
    });
  }

  // Self-hosting recommendation for Google Fonts
  const hasGoogleFonts = providers.some(p => p.name.includes('Google'));
  if (hasGoogleFonts) {
    recommendations.push({
      priority: 'low',
      title: 'Consider Self-Hosting Fonts',
      description: 'Google Fonts detected. Self-hosting gives better control over caching and privacy.',
      action: 'Download fonts and serve from your own domain'
    });
  }

  return recommendations;
}

module.exports = {
  analyzeTagIntelligence,
  analyzeEnhancedFonts,
  analyzePerformanceSnapshot,
  crawlSite
};
