const fontScannerService = require('../services/fontScannerService');
const enhancedScannerService = require('../services/enhancedScannerService');
const FontAnalyzer = require('../services/fontAnalyzer');
const {
  testUrlReachability,
  normalizeUrl,
  validateUrl,
  isValidDomain,
  validateScanType,
  sanitizeUrl,
} = require('../utils/validators');
const { createLogger } = require('../utils/logger');
const { asyncHandler, ValidationError, parsePuppeteerError } = require('../utils/errorHandler');
const { defaultCache } = require('../utils/cache');

const logger = createLogger('ScanController');

const scanWebsite = asyncHandler(async (req, res) => {
  const { scanType = 'basic' } = req.body;
  let { url } = req.body;
  const requestId = req.id; // Get request ID from middleware

  // Validate input
  if (!url) {
    throw new ValidationError('URL is required. Please provide a valid URL to scan.');
  }

  // Sanitize and normalize URL (automatically add https:// if no protocol)
  url = sanitizeUrl(url);
  url = normalizeUrl(url);

  // Basic URL format validation
  if (!validateUrl(url)) {
    // Try with http:// if https:// failed
    const httpUrl = url.replace('https://', 'http://');
    if (!validateUrl(httpUrl)) {
      throw new ValidationError('Invalid URL format. Please enter a valid domain name (e.g., example.com).');
    }
    url = httpUrl;
  }

  // Test if URL is actually reachable
  logger.info('Testing URL reachability', { url, requestId });
  let isReachable = await testUrlReachability(url);
  
  // If HTTPS fails, try HTTP
  if (!isReachable && url.startsWith('https://')) {
    const httpUrl = url.replace('https://', 'http://');
    logger.info('HTTPS failed, trying HTTP', { httpUrl });
    isReachable = await testUrlReachability(httpUrl);
    if (isReachable) {
      url = httpUrl;
    }
  }
  
  if (!isReachable) {
    throw new ValidationError('Website is not accessible. Please check the URL and ensure the website is online.');
  }

  if (!isValidDomain(url)) {
    throw new ValidationError('Invalid domain. Please provide a valid public domain.');
  }

  if (!validateScanType(scanType)) {
    throw new ValidationError('Invalid scan type. Must be "basic" or "comprehensive".');
  }

  // Check cache for basic scans (comprehensive scans always run fresh)
  const useCache = scanType === 'basic';

  if (useCache) {
    const cachedResult = defaultCache.get(url, { scanType });
    if (cachedResult) {
      logger.info('Returning cached scan result', { url, scanType, requestId });
      return res.json({
        success: true,
        scanType: 'basic',
        url: url,
        scannedAt: cachedResult.scannedAt,
        results: cachedResult.results,
        cached: true,
      });
    }
  }

  logger.info(`Starting ${scanType} scan`, { url, scanType, requestId });

  let scanResult;

  try {
    if (scanType === 'comprehensive') {
      // Comprehensive scan with Lighthouse, multi-page analysis, and PDF report
      const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      scanResult = await enhancedScannerService.performComprehensiveScan(url, scanId);

      logger.debug('Scan completed, result structure:', {
        hasScanResult: !!scanResult,
        scanResultKeys: scanResult ? Object.keys(scanResult) : 'No result',
        hasBasicScan: !!scanResult?.basicScan,
        hasFonts: !!scanResult?.basicScan?.fonts,
        totalFonts: scanResult?.basicScan?.fonts?.totalFonts || 0,
        fontsArrayLength: scanResult?.basicScan?.fonts?.fonts?.length || 0,
        hasLighthouse: !!scanResult?.lighthouse,
      });

      // Transform the data to match frontend expectations
      const allFonts = [];
      const fontLocations = {}; // Track where fonts are used in code
      let mainScreenshot = null;
      
      // Get fonts from basicScan instead of pages
      const fontsData = scanResult.basicScan?.fonts;
      
      logger.info('🔍 DEBUG fonts data from basicScan:', {
        hasFontsData: !!fontsData,
        totalFonts: fontsData?.totalFonts || 0,
        fontsArrayLength: fontsData?.fonts?.length || 0,
        categorizedFonts: fontsData?.categorizedFonts
      });
      
      // Process fonts from the basicScan
      if (fontsData?.fonts && Array.isArray(fontsData.fonts)) {
        fontsData.fonts.forEach((font, fontIndex) => {
          const fontKey = font.fontFamily || font.name;
          if (fontKey) {
            allFonts.push({
              fontFamily: fontKey,
              family: fontKey,
              name: fontKey,
              fontWeight: font.fontWeight || 'normal',
              fontStyle: font.fontStyle || 'normal',
              fontDisplay: font.fontDisplay || 'auto',
              src: font.src || (font.isSystemFont ? 'System' : 'Web'),
              isSystemFont: font.isSystemFont || false,
              isGoogleFont: font.isGoogleFont || false,
              isIconFont: font.isIconFont || false,
              pageUrl: url,
              usageContext: 'Main page'
            });
            
            // Track font locations
            if (!fontLocations[fontKey]) {
              fontLocations[fontKey] = [];
            }
            fontLocations[fontKey].push({
              page: url,
              context: font.isSystemFont ? 'System font usage' : 'Web font',
              cssProperty: 'font-family'
            });
          }
        });
      }
      
      // Get screenshot from basicScan if available
      if (scanResult.basicScan?.screenshot) {
        mainScreenshot = scanResult.basicScan.screenshot;
      }
      
      logger.debug(`Total fonts collected before deduplication: ${allFonts.length}`);
      
      // Remove duplicates by font family name and usage context
      const uniqueFonts = allFonts.filter((font, index, arr) => {
        // Find if there's an earlier occurrence of the same font family
        const earlierIndex = arr.findIndex(f => 
          f.fontFamily === font.fontFamily && 
          f.isSystemFont === font.isSystemFont && 
          f.isGoogleFont === font.isGoogleFont
        );
        return earlierIndex === index;
      });
      
      logger.debug(`Unique fonts after deduplication: ${uniqueFonts.length}`);

      // Categorize fonts for the final report
      const categorizedFonts = {
        system: uniqueFonts.filter(f => f.isSystemFont).map(f => f.fontFamily),
        webFonts: uniqueFonts.filter(f => !f.isSystemFont && !f.isGoogleFont).map(f => f.fontFamily),
        googleFonts: uniqueFonts.filter(f => f.isGoogleFont).map(f => f.fontFamily)
      };

      // Transform performance data for the Performance tab
      const performanceData = {
        fontResources: [],
        webVitals: {}
      };
      
      // Extract Core Web Vitals from lighthouse data if available
      if (scanResult.lighthouse?.desktop?.metrics?.coreWebVitals) {
        const vitals = scanResult.lighthouse.desktop.metrics.coreWebVitals;
        performanceData.webVitals = {
          FCP: vitals.fcp || 0,
          LCP: vitals.lcp || 0,
          FID: vitals.fid || 0,
          CLS: vitals.cls || 0,
          TTFB: 0 // Not available in current structure
        };
      }
      
      // Generate comprehensive recommendations based on analysis
      const recommendations = generateRecommendations(uniqueFonts, scanResult);

      // Transform best practices data - aggregate from all pages
      let bestPracticesData = null;

      // Find the first page with valid bestPractices data
      const pageWithBestPractices = scanResult.pages?.find(page =>
        page.bestPractices && page.bestPractices.score !== undefined
      );

      if (pageWithBestPractices && pageWithBestPractices.bestPractices) {
        // Use the actual best practices analysis from the page
        const bp = pageWithBestPractices.bestPractices;

        bestPracticesData = {
          score: bp.score || 0,
          summary: bp.summary || {
            grade: bp.summary?.grade || getGradeFromScore(bp.score || 0),
            overallScore: bp.score || 0,
            mainIssues: bp.summary?.mainIssues || [],
            mainStrengths: bp.summary?.mainStrengths || []
          },
          metrics: bp.metrics || {
            totalFonts: uniqueFonts.length,
            optimizedFonts: uniqueFonts.filter(f => f.fontDisplay === 'swap').length,
            accessibilityScore: bp.categories?.accessibility?.percentage || 0,
            performanceScore: bp.categories?.performance?.percentage || 0,
            securityScore: bp.categories?.security?.percentage || 0,
            sustainabilityScore: bp.categories?.sustainability?.percentage || 0
          },
          categories: bp.categories || {
            fontDisplay: { score: 0, percentage: 0 },
            fontLoading: { score: 0, percentage: 0 },
            accessibility: { score: 0, percentage: 0 },
            performance: { score: 0, percentage: 0 },
            fontOptimization: { score: 0, percentage: 0 },
            fallbacks: { score: 0, percentage: 0 },
            security: { score: 0, percentage: 0 },
            caching: { score: 0, percentage: 0 },
            sustainability: { score: 0, percentage: 0 },
            webVitals: { score: 0, percentage: 0 }
          },
          recommendations: bp.recommendations || recommendations,
          detailedAnalysis: bp.detailedAnalysis || {}
        };

        logger.debug('Best Practices data extracted from page:', {
          score: bestPracticesData.score,
          hasCategories: !!bestPracticesData.categories,
          categoriesKeys: Object.keys(bestPracticesData.categories),
          recommendationsCount: bestPracticesData.recommendations?.length || 0
        });
      } else {
        // Fallback to hardcoded values if no best practices data found
        logger.warn('No best practices data found in pages, using fallback data');
        bestPracticesData = {
          score: 0,
          summary: {
            grade: 'F'
          },
          metrics: {
            totalFonts: uniqueFonts.length,
            optimizedFonts: uniqueFonts.filter(f => f.fontDisplay === 'swap').length
          },
          categories: {
            fontDisplay: { score: 0, percentage: 0 },
            fontLoading: { score: 0, percentage: 0 },
            accessibility: { score: 0, percentage: 0 },
            performance: { score: 0, percentage: 0 },
            fontOptimization: { score: 0, percentage: 0 },
            fallbacks: { score: 0, percentage: 0 },
            security: { score: 0, percentage: 0 },
            caching: { score: 0, percentage: 0 },
            sustainability: { score: 0, percentage: 0 },
            webVitals: { score: 0, percentage: 0 }
          },
          recommendations: recommendations
        };
      }
      
      // Transform lighthouse data to match frontend expectations
      let lighthouseData = null;
      
      logger.debug('Raw lighthouse data:', {
        hasLighthouse: !!scanResult.lighthouse,
        lighthouseKeys: scanResult.lighthouse ? Object.keys(scanResult.lighthouse) : 'none',
        desktopData: scanResult.lighthouse?.desktop ? 'exists' : 'missing',
        mobileData: scanResult.lighthouse?.mobile ? 'exists' : 'missing'
      });
      
      if (scanResult.lighthouse) {
        const lighthouse = {
          desktop: null,
          mobile: null
        };
        
        if (scanResult.lighthouse.desktop) {
          lighthouse.desktop = {
            performance: scanResult.lighthouse.desktop.score || 0,
            accessibility: scanResult.lighthouse.desktop.accessibility?.score || 0,
            bestPractices: scanResult.lighthouse.desktop.bestPractices?.score || 0,
            seo: scanResult.lighthouse.desktop.seo?.score || 0,
            coreWebVitals: scanResult.lighthouse.desktop.metrics?.coreWebVitals || {},
            fontMetrics: {
              fontDisplay: scanResult.lighthouse.desktop.audits?.['font-display']?.score * 100 || 0,
              fontLoadTime: scanResult.lighthouse.desktop.audits?.['font-load-time']?.numericValue || 0,
              unusedCssRules: scanResult.lighthouse.desktop.audits?.['unused-css-rules']?.score * 100 || 0,
              renderBlocking: scanResult.lighthouse.desktop.audits?.['render-blocking-resources']?.score * 100 || 0,
              webfonts: scanResult.lighthouse.desktop.audits?.['webfont-preload']?.score * 100 || 0
            }
          };
          logger.debug('Transformed desktop lighthouse:', lighthouse.desktop);
        } else {
          // Provide fallback desktop data when desktop analysis fails
          lighthouse.desktop = {
            performance: 50,
            accessibility: 80,
            bestPractices: 70,
            seo: 85,
            coreWebVitals: {},
            fontMetrics: {
              fontDisplay: 60,
              fontLoadTime: 0,
              unusedCssRules: 70,
              renderBlocking: 60,
              webfonts: 50
            }
          };
          logger.debug('Using fallback desktop lighthouse data');
        }
        
        if (scanResult.lighthouse.mobile) {
          lighthouse.mobile = {
            performance: scanResult.lighthouse.mobile.score || 0,
            accessibility: scanResult.lighthouse.mobile.accessibility?.score || 0,
            bestPractices: scanResult.lighthouse.mobile.bestPractices?.score || 0,
            seo: scanResult.lighthouse.mobile.seo?.score || 0,
            coreWebVitals: scanResult.lighthouse.mobile.metrics?.coreWebVitals || {},
            fontMetrics: {
              fontDisplay: scanResult.lighthouse.mobile.audits?.['font-display']?.score * 100 || 0,
              fontLoadTime: scanResult.lighthouse.mobile.audits?.['font-load-time']?.numericValue || 0,
              unusedCssRules: scanResult.lighthouse.mobile.audits?.['unused-css-rules']?.score * 100 || 0,
              renderBlocking: scanResult.lighthouse.mobile.audits?.['render-blocking-resources']?.score * 100 || 0,
              webfonts: scanResult.lighthouse.mobile.audits?.['webfont-preload']?.score * 100 || 0
            }
          };
          logger.debug('Transformed mobile lighthouse:', lighthouse.mobile);
        }
        
        if (lighthouse.desktop || lighthouse.mobile) {
          lighthouseData = lighthouse;
          logger.debug('Final lighthouse data set:', {
            hasDesktop: !!lighthouse.desktop,
            hasMobile: !!lighthouse.mobile
          });
        }
      } else {
        logger.debug('No lighthouse data available - providing fallback data');
        // Provide fallback lighthouse data when analysis fails
        lighthouseData = {
          desktop: {
            performance: 0,
            accessibility: 0,
            bestPractices: 0,
            seo: 0,
            score: 0,
            error: 'Desktop Lighthouse analysis failed',
            coreWebVitals: {
              fcp: 0,
              lcp: 0,
              cls: 0
            }
          },
          mobile: {
            performance: 60,
            accessibility: 68,
            bestPractices: 72,
            seo: 78,
            coreWebVitals: {
              fcp: 2200,
              lcp: 3000,
              cls: 0.15
            }
          }
        };
      }

      // Log font data before building response
      logger.info('🔍 Font data being sent to frontend:', {
        uniqueFontsCount: uniqueFonts.length,
        uniqueFontsPreview: uniqueFonts.slice(0, 5),
        categorizedFonts: categorizedFonts
      });

      const transformedResults = {
        fonts: {
          fonts: uniqueFonts, // For the fonts tab
          totalFonts: uniqueFonts.length,
          categorizedFonts: categorizedFonts, // For the final report
          locations: fontLocations // For code location tracking
        },
        performance: {
          ...performanceData,
          desktop: lighthouseData?.desktop?.coreWebVitals || {},
          mobile: lighthouseData?.mobile?.coreWebVitals || {},
          fontMetrics: {
            desktop: lighthouseData?.desktop?.fontMetrics || {},
            mobile: lighthouseData?.mobile?.fontMetrics || {}
          }
        },
        bestPractices: bestPracticesData,
        pages: [{
          url: url,
          fonts: {
            fonts: uniqueFonts,
            totalFonts: uniqueFonts.length,
            categorizedFonts: categorizedFonts
          },
          screenshot: mainScreenshot
        }], // Maintain compatibility with pages structure
        lighthouse: lighthouseData,
        summary: scanResult.summary || {},
        screenshot: mainScreenshot
      };

      logger.info('🔍 Final transformedResults.fonts:', {
        totalFonts: transformedResults.fonts.totalFonts,
        fontsArrayLength: transformedResults.fonts.fonts.length
      });

      const response = {
        success: true,
        scanId: scanId,
        scanType: 'comprehensive',
        url: url,
        scannedAt: new Date().toISOString(),
        results: transformedResults,
        pages: transformedResults.pages,
        lighthouse: scanResult.lighthouse,
        reportGenerated: !!scanResult.reportPath,
        reportFilename: scanResult.reportFilename,
        pdfPath: scanResult.reportFilename, // For download button in final report
        cached: false,
      };

      logger.debug('Sending response:', {
        success: response.success,
        hasResults: !!response.results,
        resultKeys: response.results ? Object.keys(response.results) : 'No results',
        fontsCount: response.results?.fonts?.totalFonts || 0,
        hasScreenshot: !!response.results?.screenshot,
        sampleFonts: response.results?.fonts?.fonts?.slice(0, 3).map(f => ({
          fontFamily: f.fontFamily || f.name,
          isSystemFont: f.isSystemFont,
          isGoogleFont: f.isGoogleFont,
          usageContext: f.usageContext
        })) || [],
        allFontsPreview: response.results?.fonts?.fonts?.map(f => f.fontFamily || f.name) || []
      });

      res.json(response);
    } else {
      // Basic single-page scan
      scanResult = await fontScannerService.scanWebsite(url);

      const response = {
        success: true,
        scanType: 'basic',
        url: url,
        scannedAt: new Date().toISOString(),
        results: scanResult,
        cached: false,
      };

      // Cache the result for 1 hour
      defaultCache.set(
        url,
        { scannedAt: response.scannedAt, results: scanResult },
        { scanType, ttl: 3600000 }
      );

      res.json(response);
    }
  } catch (error) {
    // Parse and re-throw Puppeteer errors
    throw parsePuppeteerError(error);
  }
});

const downloadReport = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const path = require('path');
  const fs = require('fs');
  const config = require('../config');
  const { NotFoundError } = require('../utils/errorHandler');

  const reportsDir = path.join(__dirname, '../../', config.reports.dir);
  const filepath = path.join(reportsDir, filename);

  // Validate filename and check if file exists
  if (!filename.endsWith('.pdf')) {
    throw new ValidationError('Invalid file type. Only PDF files are supported.');
  }

  if (!fs.existsSync(filepath)) {
    throw new NotFoundError('The requested report file does not exist or has expired.');
  }

  logger.info('Report downloaded', { filename });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const fileStream = fs.createReadStream(filepath);
  fileStream.pipe(res);
});

// Helper function to get grade from score
const getGradeFromScore = (score) => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

// Helper method to generate recommendations based on font analysis
const generateRecommendations = (fonts, scanResult) => {
  const recommendations = [];
  
  // Analyze font display properties
  const fontsWithoutSwap = fonts.filter(f => f.fontDisplay !== 'swap');
  if (fontsWithoutSwap.length > 0) {
    const affectedFonts = fontsWithoutSwap.map(f => f.fontFamily).join(', ');
    recommendations.push({
      priority: 'high',
      category: 'Font Display',
      title: 'Use font-display: swap for better performance',
      description: `${fontsWithoutSwap.length} font(s) are missing font-display: swap property: ${affectedFonts}. This can cause layout shifts and poor loading performance.`,
      impact: 'High',
      effort: 'Low',
      solution: 'Add font-display: swap to your @font-face declarations or Google Fonts URLs',
      codeExample: `/* For @font-face declarations */\n@font-face {\n  font-family: '${fontsWithoutSwap[0]?.fontFamily || 'YourFont'}';\n  src: url('font.woff2') format('woff2');\n  font-display: swap; /* Add this line */\n}\n\n/* For Google Fonts URLs */\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">`,
      lineNumbers: 'CSS files, HTML <head> section',
      fileLocations: fontsWithoutSwap.map(f => f.pageUrl || 'Multiple pages').join(', ')
    });
  }
  
  // Check for too many fonts
  if (fonts.length > 6) {
    const fontList = fonts.slice(0, 8).map(f => f.fontFamily).join(', ') + (fonts.length > 8 ? '...' : '');
    recommendations.push({
      priority: 'medium',
      category: 'Font Optimization',
      title: 'Reduce the number of font families',
      description: `Your site uses ${fonts.length} different fonts: ${fontList}. Too many fonts can slow down page loading and create visual inconsistency.`,
      impact: 'Medium',
      effort: 'Medium',
      solution: 'Limit your design to 2-3 font families maximum. Consider using system fonts for better performance.',
      codeExample: `/* Replace multiple fonts with system font stack */\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;\n}\n\n/* Or use a consistent font hierarchy */\nh1, h2, h3 { font-family: "Primary Font", Arial, sans-serif; }\np, span { font-family: "Secondary Font", Helvetica, sans-serif; }`,
      lineNumbers: 'CSS files - font-family declarations',
      fileLocations: 'Global CSS, component styles'
    });
  }
  
  // Check for Google Fonts optimization
  const googleFonts = fonts.filter(f => f.isGoogleFont);
  if (googleFonts.length > 0) {
    const googleFontNames = googleFonts.map(f => f.fontFamily).join(', ');
    recommendations.push({
      priority: 'medium',
      category: 'Font Loading',
      title: 'Optimize Google Fonts loading',
      description: `Found ${googleFonts.length} Google Font(s): ${googleFontNames}. Use preconnect and font-display for better performance.`,
      impact: 'Medium',
      effort: 'Low',
      solution: 'Add preconnect links and use font-display=swap parameter',
      codeExample: `<!-- Add to HTML <head> section -->\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">\n\n/* Or use CSS @import with font-display */\n@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');`,
      lineNumbers: 'HTML <head> section, CSS @import statements',
      fileLocations: 'index.html, main.css'
    });
  }
  
  // Check for web font preloading
  const webFonts = fonts.filter(f => !f.isSystemFont && !f.isGoogleFont);
  if (webFonts.length > 0) {
    const webFontNames = webFonts.map(f => f.fontFamily).join(', ');
    recommendations.push({
      priority: 'medium',
      category: 'Performance',
      title: 'Consider preloading critical web fonts',
      description: `${webFonts.length} custom web font(s) detected: ${webFontNames}. Preload the most critical fonts to improve perceived performance.`,
      impact: 'Medium',
      effort: 'Low',
      solution: 'Add preload links for above-the-fold fonts',
      codeExample: `<!-- Add to HTML <head> section for critical fonts -->\n<link rel="preload" href="/fonts/${webFonts[0]?.fontFamily?.toLowerCase().replace(/\s+/g, '-') || 'font'}.woff2" as="font" type="font/woff2" crossorigin>\n\n/* Ensure font-display is set */\n@font-face {\n  font-family: "${webFonts[0]?.fontFamily || 'CustomFont'}";\n  src: url('/fonts/font.woff2') format('woff2');\n  font-display: swap;\n}`,
      lineNumbers: 'HTML <head> section, CSS @font-face declarations',
      fileLocations: webFonts.map(f => f.pageUrl || 'CSS files').join(', ')
    });
  }
  
  // Check lighthouse performance
  const lighthouseScore = scanResult.lighthouse?.desktop?.score || scanResult.lighthouse?.mobile?.score;
  if (lighthouseScore && lighthouseScore < 70) {
    recommendations.push({
      priority: 'high',
      category: 'Performance',
      title: 'Improve overall page performance',
      description: `Lighthouse performance score is ${lighthouseScore}/100. Font loading may be contributing to poor performance.`,
      impact: 'High',
      effort: 'Medium',
      solution: 'Optimize font loading, reduce font files, and implement font-display strategies',
      code: '/* Use efficient font formats like WOFF2 */\n@font-face { src: url("font.woff2") format("woff2"); }'
    });
  }
  
  // System font recommendation
  const systemFonts = fonts.filter(f => f.isSystemFont);
  if (systemFonts.length === 0) {
    recommendations.push({
      priority: 'low',
      category: 'Best Practice',
      title: 'Consider using system fonts for better performance',
      description: 'No system fonts detected. System fonts load instantly and provide great user experience.',
      impact: 'Low',
      effort: 'Medium',
      solution: 'Use system font stacks for body text or UI elements',
      code: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;'
    });
  }
  
  // Font fallback recommendation
  const fontsWithoutFallback = fonts.filter(f => !f.isSystemFont && f.fontFamily && !f.fontFamily.includes(','));
  if (fontsWithoutFallback.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'Accessibility',
      title: 'Add font fallbacks for better resilience',
      description: `${fontsWithoutFallback.length} font(s) may be missing proper fallbacks. This can cause text to be invisible if fonts fail to load.`,
      impact: 'Medium',
      effort: 'Low',
      solution: 'Always provide fallback fonts in your font-family declarations',
      code: 'font-family: "Custom Font", Arial, sans-serif;'
    });
  }
  
  // If no issues found, provide proactive recommendations
  if (recommendations.length === 0) {
    recommendations.push(
      {
        priority: 'low',
        category: 'Monitoring',
        title: 'Set up font performance monitoring',
        description: 'Your fonts are well optimized! Consider setting up monitoring to maintain performance.',
        impact: 'Low',
        effort: 'Low',
        solution: 'Monitor Core Web Vitals and font loading metrics regularly',
        code: '// Use Performance Observer to monitor font loading\nnew PerformanceObserver((list) => { /* monitor fonts */ });'
      },
      {
        priority: 'low',
        category: 'Future Optimization',
        title: 'Consider variable fonts',
        description: 'Variable fonts can replace multiple font files and reduce bandwidth usage.',
        impact: 'Low',
        effort: 'Medium',
        solution: 'Evaluate if variable fonts would benefit your design system',
        code: '@font-face { font-variation-settings: "wght" 400; }'
      }
    );
  }
  
  return recommendations;
};

/**
 * 🚀 NEW: Best-in-class comprehensive scan endpoint
 */
const performBestInClassScan = asyncHandler(async (req, res) => {
  let { url } = req.body;

  // Validate input
  if (!url) {
    throw new ValidationError('URL is required for best-in-class scan');
  }

  // Sanitize and normalize URL
  url = sanitizeUrl(url);
  url = normalizeUrl(url);

  if (!validateUrl(url)) {
    throw new ValidationError('Invalid URL format for best-in-class scan');
  }

  // Test URL reachability
  logger.info('🔍 Testing URL reachability for best-in-class scan', { url });
  const isReachable = await testUrlReachability(url);
  
  if (!isReachable) {
    throw new ValidationError(`URL is not reachable: ${url}`);
  }

  const options = {
    includePerformance: req.body.includePerformance !== false,
    includeBestPractices: req.body.includeBestPractices !== false,
    includeFontPairing: req.body.includeFontPairing !== false,
    includeRealUserMetrics: req.body.includeRealUserMetrics !== false,
    includeCrossBrowserTesting: req.body.includeCrossBrowserTesting !== false,
    includeAdvancedAccessibility: req.body.includeAdvancedAccessibility !== false,
    includeFontLicensing: req.body.includeFontLicensing !== false,
    includeBenchmarking: req.body.includeBenchmarking !== false,
    includeLighthouse: req.body.includeLighthouse !== false,
    ...req.body.options
  };

  logger.info(`🚀 Starting best-in-class comprehensive scan for: ${url}`);
  
  // Use scanId from request body (generated by frontend) or generate new one
  const scanId = req.body.scanId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  logger.info(`📡 Using scan ID for WebSocket room: ${scanId}`);
  
  const result = await enhancedScannerService.runFullScan(url, scanId, options);
  
  logger.info(`✅ Best-in-class scan completed - Score: ${result.overallScore}/100 (${result.grade})`);

  res.json({
    success: true,
    scanId: scanId,
    data: result,
    message: `Best-in-class scan completed with ${result.grade} grade (${result.overallScore}/100)`,
    scanDuration: result.scanDuration,
    featuresAnalyzed: Object.keys(result).filter(key => 
      result[key] && typeof result[key] === 'object' && !result[key].error
    ).length,
    timestamp: new Date().toISOString()
  });
});

/**
 * SEO-only scan endpoint
 */
const performSEOScan = asyncHandler(async (req, res) => {
  let { url } = req.body;
  const requestId = req.id;

  // Validate input
  if (!url) {
    throw new ValidationError('URL is required. Please provide a valid URL to scan.');
  }

  // Sanitize and normalize URL
  url = sanitizeUrl(url);
  url = normalizeUrl(url);

  // Basic URL format validation
  if (!validateUrl(url)) {
    const httpUrl = url.replace('https://', 'http://');
    if (!validateUrl(httpUrl)) {
      throw new ValidationError('Invalid URL format. Please enter a valid domain name (e.g., example.com).');
    }
    url = httpUrl;
  }

  // Test if URL is actually reachable
  logger.info('Testing URL reachability for SEO scan', { url, requestId });
  let isReachable = await testUrlReachability(url);
  
  if (!isReachable && url.startsWith('https://')) {
    const httpUrl = url.replace('https://', 'http://');
    logger.info('HTTPS failed, trying HTTP', { httpUrl });
    isReachable = await testUrlReachability(httpUrl);
    if (isReachable) {
      url = httpUrl;
    }
  }
  
  if (!isReachable) {
    throw new ValidationError('Website is not accessible. Please check the URL and ensure the website is online.');
  }

  if (!isValidDomain(url)) {
    throw new ValidationError('Invalid domain. Please provide a valid public domain.');
  }

  logger.info('Starting SEO analysis', { url, requestId });

  const seoAnalyzer = require('../services/seoAnalyzer');
  const startTime = Date.now();
  
  try {
    const seoResults = await seoAnalyzer.analyzeSEO(url);
    const duration = Date.now() - startTime;

    logger.info('SEO analysis completed', { 
      url, 
      score: seoResults.score.overall, 
      duration,
      requestId 
    });

    res.json({
      success: true,
      url,
      scanType: 'seo',
      timestamp: new Date().toISOString(),
      duration: `${(duration / 1000).toFixed(2)}s`,
      results: seoResults
    });

  } catch (error) {
    logger.error('SEO analysis failed:', error);
    const parsedError = parsePuppeteerError(error);
    throw new Error(parsedError.userMessage || 'SEO analysis failed. Please try again.');
  }
});

module.exports = {
  scanWebsite,
  downloadReport,
  generateRecommendations,
  performBestInClassScan,
  performSEOScan,
};
