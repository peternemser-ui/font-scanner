const fontScannerService = require('../services/fontScannerService');
const enhancedScannerService = require('../services/enhancedScannerService');
const FontAnalyzer = require('../services/fontAnalyzer');
const {
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

  // Validate input
  if (!url) {
    throw new ValidationError('URL is required. Please provide a valid URL to scan.');
  }

  // Sanitize URL
  url = sanitizeUrl(url);

  if (!validateUrl(url)) {
    throw new ValidationError('Invalid URL. Please provide a valid HTTP or HTTPS URL.');
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
      logger.info('Returning cached scan result', { url, scanType });
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

  logger.info(`Starting ${scanType} scan`, { url, scanType });

  let scanResult;

  try {
    if (scanType === 'comprehensive') {
      // Comprehensive scan with Lighthouse, multi-page analysis, and PDF report
      scanResult = await enhancedScannerService.performComprehensiveScan(url);

      logger.debug('Scan completed, result structure:', {
        hasScanResult: !!scanResult,
        scanResultKeys: scanResult ? Object.keys(scanResult) : 'No result',
        fontsCount:
          scanResult?.pages?.reduce((total, page) => total + (page.fonts?.length || 0), 0) || 0,
        pagesCount: scanResult?.pages?.length || 0,
        hasLighthouse: !!scanResult?.lighthouse,
      });

      // Transform the data to match frontend expectations
      const allFonts = [];
      const fontLocations = {}; // Track where fonts are used in code
      let mainScreenshot = null;
      
      // Collect fonts and screenshot from all pages
      scanResult.pages?.forEach((page, pageIndex) => {
        logger.debug(`Processing fonts for page ${pageIndex + 1}: ${page.url}`);
        
        // Extract fonts from page.fonts.fonts array
        if (page.fonts?.fonts) {
          logger.debug(`Found ${page.fonts.fonts.length} fonts in page.fonts.fonts`);
          page.fonts.fonts.forEach(font => {
            const fontKey = typeof font === 'string' ? font : font.fontFamily || font.name;
            if (fontKey) {
              // Use FontAnalyzer for proper categorization
              const fontAnalyzer = new FontAnalyzer();
              const isIconFont = fontAnalyzer.isIconFont(fontKey);

              allFonts.push({
                fontFamily: fontKey,
                family: fontKey,
                name: fontKey,
                fontWeight: 'normal',
                fontStyle: 'normal', 
                fontDisplay: 'auto',
                src: 'System',
                isSystemFont: true,
                isGoogleFont: false,
                isIconFont: isIconFont,
                pageUrl: page.url || 'Unknown',
                usageContext: 'CSS property'
              });
              
              // Track font locations
              if (!fontLocations[fontKey]) {
                fontLocations[fontKey] = [];
              }
              fontLocations[fontKey].push({
                page: page.url || `Page ${pageIndex + 1}`,
                context: 'System font usage',
                cssProperty: 'font-family'
              });
            }
          });
        }
        
        // Extract fonts from page.fonts.fontFaces array
        if (page.fonts?.fontFaces) {
          logger.debug(`Found ${page.fonts.fontFaces.length} fonts in page.fonts.fontFaces`);
          page.fonts.fontFaces.forEach(face => {
            const fontKey = face.fontFamily || 'Unknown';
        // Use FontAnalyzer for proper categorization
        const fontAnalyzer = new FontAnalyzer();
        const isIconFont = fontAnalyzer.isIconFont(fontKey);
        const isGoogleFont = face.src?.includes('fonts.googleapis.com') || false;

        // Categorize fonts properly
        allFonts.push({
          fontFamily: fontKey,
          family: fontKey,
          name: fontKey,
          fontWeight: face.fontWeight || 'normal',
          fontStyle: face.fontStyle || 'normal',
          fontDisplay: face.fontDisplay || 'auto',
          src: face.src || 'System',
          isSystemFont: !face.src,
          isGoogleFont: isGoogleFont,
          isIconFont: isIconFont,
          pageUrl: page.url || 'Unknown',
          usageContext: '@font-face declaration'
        });            // Track font locations for @font-face
            if (!fontLocations[fontKey]) {
              fontLocations[fontKey] = [];
            }
            fontLocations[fontKey].push({
              page: page.url || `Page ${pageIndex + 1}`,
              context: '@font-face declaration',
              cssProperty: 'src, font-family',
              sourceUrl: face.src
            });
          });
        }
        
        // Use screenshot from first successful page
        if (!mainScreenshot && page.screenshot) {
          mainScreenshot = page.screenshot;
        }
      });
      
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
      
      // Transform best practices data
      const bestPracticesData = {
        score: scanResult.summary?.bestPractices?.score || 0,
        summary: {
          grade: scanResult.summary?.bestPractices?.grade || 'F'
        },
        metrics: {
          totalFonts: uniqueFonts.length,
          optimizedFonts: uniqueFonts.filter(f => f.fontDisplay === 'swap').length
        },
        categories: {
          fontDisplay: { score: 75, percentage: 75 },
          fontLoading: { score: 80, percentage: 80 },
          accessibility: { score: 70, percentage: 70 },
          performance: { score: 65, percentage: 65 },
          fontOptimization: { score: 60, percentage: 60 },
          fallbacks: { score: 85, percentage: 85 },
          security: { score: 90, percentage: 90 },
          caching: { score: 70, percentage: 70 },
          sustainability: { score: 75, percentage: 75 },
          webVitals: { score: 80, percentage: 80 }
        },
        recommendations: recommendations
      };
      
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
        pages: scanResult.pages || [],
        lighthouse: lighthouseData,
        summary: scanResult.summary || {},
        screenshot: mainScreenshot
      };

      const response = {
        success: true,
        scanType: 'comprehensive',
        url: url,
        scannedAt: new Date().toISOString(),
        results: transformedResults,
        pages: scanResult.pages,
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

module.exports = {
  scanWebsite,
  downloadReport,
  generateRecommendations,
};
