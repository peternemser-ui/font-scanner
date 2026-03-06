/**
 * Competitive Analysis Controller
 * API endpoint for comparing your site against competitors
 * 
 * WARNING: This is a VERY resource-intensive operation
 * - Analyzes 1 + up to 5 competitors = 6 sites total
 * - Each site runs 5 analyzers sequentially (SEO, Security, Accessibility, CWV, Performance)
 * - Total operation can take 5-15 minutes
 * - Heavily rate-limited to prevent system overload
 */

const competitiveAnalysisService = require('../services/competitiveAnalysisService');
const { asyncHandler, ValidationError } = require('../utils/errorHandler');
const { validateUrl, sanitizeUrl, normalizeUrl, testUrlReachability } = require('../utils/validators');
const { createLogger } = require('../utils/logger');
const { isUrlSafe } = require('../utils/ssrfProtection');
const config = require('../config');
const crypto = require('crypto');

const {
  getAnalyzerKeyOverride,
  buildReportMetadata,
  attachReportMetadata
} = require('../utils/controllerHelpers');
const { ensureReportScreenshot } = require('../utils/reportScreenshot');

const logger = createLogger('CompetitiveAnalysisController');

/**
 * Inject Socket.IO instance for real-time progress updates
 * Called by server.js during initialization
 */
function setSocketIO(socketIO) {
  competitiveAnalysisService.setSocketIO(socketIO);
  logger.info('Socket.IO instance injected into competitive analysis controller');
}

/**
 * Analyze your site vs competitors
 * POST /api/competitive-analysis
 * Body: { yourUrl: string, competitorUrls: string[] }
 */
const analyzeCompetitors = asyncHandler(async (req, res) => {
  const { yourUrl, competitorUrls } = req.body;

  // Generate unique session ID for WebSocket progress tracking
  const sessionId = crypto.randomUUID();
  
  logger.info(`Competitive analysis requested with sessionId: ${sessionId}`, {
    requestId: req.id,
    sessionId
  });

  // Validate your URL
  if (!yourUrl) {
    throw new ValidationError('Your URL is required');
  }

  const sanitizedYourUrl = sanitizeUrl(yourUrl);
  const normalizedYourUrl = normalizeUrl(sanitizedYourUrl);

  if (!validateUrl(normalizedYourUrl)) {
    throw new ValidationError('Invalid URL format for your site');
  }

  // SSRF protection for your URL
  const yourSsrfCheck = await isUrlSafe(normalizedYourUrl);
  if (!yourSsrfCheck.safe) {
    throw new ValidationError('Invalid domain. Please provide a valid public domain.');
  }

  // Validate competitor URLs
  if (!competitorUrls || !Array.isArray(competitorUrls) || competitorUrls.length === 0) {
    throw new ValidationError('At least one competitor URL is required');
  }

  // Strict limit to prevent system overload
  const maxCompetitors = config.competitiveAnalysis?.maxCompetitors || 5;
  if (competitorUrls.length > maxCompetitors) {
    throw new ValidationError(`Maximum ${maxCompetitors} competitor URLs allowed (system resource protection)`);
  }

  // Sanitize and validate all competitor URLs (with SSRF protection)
  const sanitizedCompetitorUrls = [];
  for (const url of competitorUrls) {
    const sanitized = sanitizeUrl(url);
    const normalized = normalizeUrl(sanitized);
    if (!validateUrl(normalized)) {
      throw new ValidationError(`Invalid competitor URL: ${url}`);
    }
    const compSsrfCheck = await isUrlSafe(normalized);
    if (!compSsrfCheck.safe) {
      throw new ValidationError(`Invalid competitor URL: ${url}`);
    }
    sanitizedCompetitorUrls.push(normalized);
  }

  logger.info(`Competitive analysis requested: ${normalizedYourUrl} vs ${sanitizedCompetitorUrls.length} competitors`, {
    requestId: req.id,
    yourUrl: normalizedYourUrl,
    competitorCount: sanitizedCompetitorUrls.length
  });

  // Test reachability of your URL
  const isYourUrlReachable = await testUrlReachability(normalizedYourUrl);
  if (!isYourUrlReachable) {
    throw new ValidationError(`Your website URL is not reachable: ${normalizedYourUrl}`);
  }

  // Test reachability of competitor URLs
  const reachabilityResults = await Promise.all(
    sanitizedCompetitorUrls.map(async url => ({
      url,
      reachable: await testUrlReachability(url)
    }))
  );

  const reachableCompetitorUrls = reachabilityResults
    .filter(result => result.reachable)
    .map(result => result.url);

  const unreachableCompetitorUrls = reachabilityResults
    .filter(result => !result.reachable)
    .map(result => result.url);

  if (reachableCompetitorUrls.length === 0) {
    throw new ValidationError('None of the competitor URLs are reachable');
  }

  if (unreachableCompetitorUrls.length > 0) {
    logger.warn(`Some competitor URLs were unreachable`, {
      unreachable: unreachableCompetitorUrls
    });
  }

  // Perform competitive analysis with timeout protection
  logger.info(`Starting competitive analysis`, {
    requestId: req.id,
    sessionId,
    sitesCount: 1 + reachableCompetitorUrls.length,
    estimatedTime: '5-15 minutes'
  });

  // Overall timeout for the entire competitive analysis (20 minutes)
  const OVERALL_TIMEOUT = 20 * 60 * 1000; // 20 minutes

  const analysisPromise = competitiveAnalysisService.analyzeCompetitors(
    normalizedYourUrl,
    reachableCompetitorUrls,
    sessionId // Pass sessionId for WebSocket progress updates
  );

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Competitive analysis timed out after 20 minutes. This may indicate system overload.'));
    }, OVERALL_TIMEOUT);
  });

  let results;
  try {
    results = await Promise.race([analysisPromise, timeoutPromise]);
  } catch (error) {
    logger.error(`Competitive analysis failed:`, {
      requestId: req.id,
      error: error.message
    });
    
    // Return partial results if possible, or throw
    throw new Error(`Competitive analysis failed: ${error.message}. The system may be overloaded. Please try again later or reduce the number of competitors.`);
  }

  // Check if we got meaningful results
  const totalSites = 1 + reachableCompetitorUrls.length;
  const successfulSites = results.metadata?.successfulAnalyses || 0;
  const successRate = Math.round((successfulSites / totalSites) * 100);

  logger.info(`Competitive analysis completed`, {
    requestId: req.id,
    overallScore: results.yourSite.scores.overall,
    analysisTime: results.analysisTime,
    successRate: `${successRate}%`,
    circuitBreakerTriggered: results.metadata?.circuitBreakerTriggered
  });

  // Add warning if many analyzers failed
  if (successRate < 50) {
    results.warning = 'Less than 50% of sites were analyzed successfully. Results may be incomplete. System may be under heavy load.';
  }

  // Add performance warning if circuit breaker was triggered
  if (results.metadata?.circuitBreakerTriggered) {
    results.warning = (results.warning || '') + ' Circuit breaker was triggered due to consecutive failures. Some competitors were not analyzed.';
  }

  // Append unreachable competitors so they still appear in the report
  if (unreachableCompetitorUrls.length > 0) {
    for (const url of unreachableCompetitorUrls) {
      results.competitors.push({
        url,
        scores: { seo: 0, performance: 0, accessibility: 0, security: 0, coreWebVitals: 0, overall: 0 },
        details: null,
        grade: 'F',
        error: 'Site was not reachable during pre-flight check'
      });
    }
    // Update metadata counts
    if (results.metadata) {
      results.metadata.totalSitesRequested = 1 + sanitizedCompetitorUrls.length;
      results.metadata.totalSitesAnalyzed = 1 + results.competitors.length;
      results.metadata.failedAnalyses = (results.metadata.failedAnalyses || 0) + unreachableCompetitorUrls.length;
    }
  }

  // Include sessionId in response for frontend WebSocket connection
  results.sessionId = sessionId;

  // Deterministic report identity support
  // Attach report metadata (reportId, screenshotUrl, timestamps)
  const analyzerKey = getAnalyzerKeyOverride(req, 'competitive-analysis');
  const metadata = await buildReportMetadata({ req, results, url: normalizedYourUrl, analyzerKey });
  attachReportMetadata(results, metadata);

  // Capture screenshots for your site and each competitor (best-effort, parallel)
  if (metadata.reportId) {
    const screenshotJobs = [];

    // Your site screenshot (stored as your-site.jpg alongside the main screenshot.jpg)
    screenshotJobs.push(
      ensureReportScreenshot({
        url: normalizedYourUrl,
        reportId: metadata.reportId,
        requestId: req.id,
        filename: 'your-site.jpg'
      }).then(ssUrl => {
        if (results.yourSite) {
          results.yourSite.screenshotUrl = ssUrl;
        }
      })
    );

    // Competitor screenshots
    if (Array.isArray(results.competitors)) {
      results.competitors.forEach((comp, i) => {
        if (comp.url && !comp.error) {
          screenshotJobs.push(
            ensureReportScreenshot({
              url: comp.url,
              reportId: metadata.reportId,
              requestId: req.id,
              filename: `competitor-${i}.jpg`
            }).then(ssUrl => {
              comp.screenshotUrl = ssUrl;
            })
          );
        }
      });
    }

    await Promise.all(screenshotJobs);
  }

  res.json(results);
});

module.exports = {
  analyzeCompetitors,
  setSocketIO
};
