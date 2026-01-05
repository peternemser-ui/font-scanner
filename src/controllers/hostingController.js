/**
 * Hosting Analyzer Controller
 * Handles CMS detection and hosting provider recommendations
 */

const { asyncHandler, ValidationError } = require('../utils/errorHandler');
const ipReputationService = require('../services/ipReputationService');
const { createLogger } = require('../utils/logger');
const { sanitizeUrl, normalizeUrl, validateUrl } = require('../utils/validators');

const logger = createLogger('HostingController');

/**
 * Analyze hosting options for a website
 * POST /api/hosting/analyze
 */
const analyzeHosting = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { 
    url, 
    monthlyVisitors, 
    cms: manualCms, 
    storageNeeds, 
    priority,
    region,
    ecommerceLevel,
    requiredFeatures,
    billingPreference
  } = req.body;
  const requestId = req.id || 'unknown';

  logger.info('Hosting analysis requested', { 
    url, 
    manualInputs: { monthlyVisitors, manualCms, storageNeeds, priority, region, ecommerceLevel },
    requestId 
  });

  // Validate input
  if (!url || typeof url !== 'string') {
    throw new ValidationError('Please provide a valid URL or domain name');
  }

  // Sanitize and normalize URL
  const sanitizedUrl = sanitizeUrl(url.trim());
  const normalizedUrl = normalizeUrl(sanitizedUrl);

  // Extract hostname
  let hostname;
  try {
    // Handle both URLs and bare domains
    if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
      const urlObj = new URL(normalizedUrl);
      hostname = urlObj.hostname;
    } else {
      hostname = normalizedUrl.replace(/^www\./, '');
    }
  } catch (e) {
    // If URL parsing fails, treat as bare domain
    hostname = sanitizedUrl.replace(/^www\./, '').split('/')[0];
  }

  if (!hostname) {
    throw new ValidationError('Could not extract hostname from provided URL');
  }

  logger.info('Analyzing hosting for', { hostname, requestId });

  try {
    // Call the CMS and hosting detection service with manual overrides
    const manualOverrides = {
      monthlyVisitors: monthlyVisitors || null,
      cms: manualCms || null,
      storageNeeds: storageNeeds || null,
      priority: priority || 'balanced',
      region: region || null,
      ecommerceLevel: ecommerceLevel || 'none',
      requiredFeatures: requiredFeatures || [],
      billingPreference: billingPreference || 'annual'
    };
    
    const hostingAnalysis = await ipReputationService.detectCMSAndAnalyzeHosting(hostname, manualOverrides);

    const analysisTime = Date.now() - startTime;

    logger.info('Hosting analysis completed', {
      hostname,
      cms: hostingAnalysis.cms?.name,
      currentHost: hostingAnalysis.currentHost?.name,
      trafficTier: hostingAnalysis.trafficTier?.name,
      recommendedCount: hostingAnalysis.recommendedHosts?.length,
      analysisTime,
      requestId,
    });

    // Return the analysis results
    res.json({
      success: true,
      url: normalizedUrl,
      hostname,
      timestamp: new Date().toISOString(),
      analysisTime,
      manualInputsApplied: !!(monthlyVisitors || manualCms || region || ecommerceLevel !== 'none'),
      ...hostingAnalysis,
    });

  } catch (error) {
    logger.error('Hosting analysis failed', {
      hostname,
      error: error.message,
      requestId,
    });

    throw error;
  }
});

/**
 * Get all hosting providers (for browsing without analysis)
 * GET /api/hosting/providers
 */
const getProviders = asyncHandler(async (req, res) => {
  const providers = ipReputationService.getAllHostingProviders();
  
  res.json({
    success: true,
    count: providers.length,
    providers,
  });
});

/**
 * Get providers filtered by CMS type
 * GET /api/hosting/providers/:cmsType
 */
const getProvidersByCMS = asyncHandler(async (req, res) => {
  const { cmsType } = req.params;
  
  const recommendedHosts = ipReputationService.getRecommendedHosts(cmsType);
  const priceComparison = ipReputationService.calculatePriceComparison(recommendedHosts);
  
  res.json({
    success: true,
    cmsType,
    count: recommendedHosts.length,
    priceComparison,
    providers: recommendedHosts,
  });
});

module.exports = {
  analyzeHosting,
  getProviders,
  getProvidersByCMS,
};
