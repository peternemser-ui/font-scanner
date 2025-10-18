const { createLogger } = require('../utils/logger');
const fontScannerService = require('./fontScannerService');
const fontAnalyzer = require('./fontAnalyzer');
const performanceAnalyzer = require('./performanceAnalyzer');
const lighthouseAnalyzer = require('./lighthouseAnalyzer');
const bestPracticesAnalyzer = require('./bestPracticesAnalyzer');
const siteDiscovery = require('./siteDiscovery');
const pdfReportGenerator = require('./pdfReportGenerator');
const fontPairingAnalyzer = require('./fontPairingAnalyzer');
const realUserMetricsService = require('./realUserMetricsService');
const crossBrowserTestingService = require('./crossBrowserTestingService');
const advancedAccessibilityAnalyzer = require('./advancedAccessibilityAnalyzer');
const fontLicensingDetector = require('./fontLicensingDetector');
const benchmarkAnalyzer = require('./benchmarkAnalyzer');
const cache = require('../utils/cache');

const logger = createLogger('EnhancedScannerService');

class EnhancedScannerService {
  constructor() {
    this.maxConcurrentScans = 3;
  }

  /**
   * Perform a BEST-IN-CLASS comprehensive scan with all advanced analyzers
   */
  async runFullScan(url, scanId, options = {}) {
    const startTime = Date.now();
    logger.info(`Starting full scan for URL: ${url} with scanId: ${scanId}`);

    // Helper function for broadcasting progress
    const broadcastProgress = (step, message, percentage) => {
      try {
        if (global.broadcastProgress) {
          global.broadcastProgress(scanId, step, message, percentage);
        }
      } catch (error) {
        logger.error('Error broadcasting progress:', error);
      }
    };

    try {
      // Initialize result structure
      const result = {
        timestamp: new Date().toISOString(),
        url: url,
        scanDuration: 0,
        basicScan: null,
        performance: null,
        lighthouse: null,
        bestPractices: null,
        siteStructure: null,
        // NEW: Best-in-class features
        fontPairing: null,
        realUserMetrics: null,
        crossBrowserTesting: null,
        accessibility: null,
        typographyBenchmark: null,
        licenseCompliance: null
      };

      // Step 1: Basic font scan (always first)
      logger.info('🔍 Step 1: Performing basic font scan...');
      broadcastProgress(1, 'Starting basic font scan...', 9);
      result.basicScan = await fontScannerService.scanWebsite(url, options);
      const fontsData = result.basicScan?.fonts?.fonts || [];

      // Step 2: Performance analysis
      if (options.includePerformance !== false) {
        logger.info('⚡ Step 2: Analyzing performance...');
        try {
          result.performance = await performanceAnalyzer.analyzePerformance(url, result.basicScan);
        } catch (error) {
          logger.warn('Performance analysis failed:', error.message);
          result.performance = { error: 'Performance analysis failed', details: error.message };
        }
      }

      // Step 3: Best practices analysis
      if (options.includeBestPractices !== false) {
        logger.info('✅ Step 3: Analyzing best practices...');
        try {
          // Use best practices from basic scan if available, otherwise generate fallback
          if (result.basicScan && result.basicScan.bestPractices) {
            result.bestPractices = result.basicScan.bestPractices;
          } else {
            // Generate fallback best practices analysis
            result.bestPractices = this.generateFallbackBestPractices(result.basicScan?.fonts);
          }
        } catch (error) {
          logger.warn('Best practices analysis failed:', error.message);
          result.bestPractices = this.generateFallbackBestPractices(result.basicScan?.fonts);
        }
      }

      // 🚀 NEW BEST-IN-CLASS FEATURES

      // Step 4: AI-Powered Font Pairing Analysis
      if (options.includeFontPairing !== false) {
        logger.info('🎨 Step 4: Analyzing font pairings with AI...');
        try {
          result.fontPairing = await fontPairingAnalyzer.analyzeFontPairings(fontsData, result.basicScan);
        } catch (error) {
          logger.warn('Font pairing analysis failed:', error.message);
          result.fontPairing = { error: 'Font pairing analysis failed', details: error.message };
        }
      }

      // Step 5: Real User Metrics (RUM)
      if (options.includeRealUserMetrics !== false) {
        logger.info('📊 Step 5: Collecting real user metrics...');
        broadcastProgress('user-metrics', 60, '📊 Collecting Real User Data');
        try {
          result.realUserMetrics = await realUserMetricsService.getRUMSummary(url);
          broadcastProgress('user-metrics', 65, '✅ User Metrics Complete');
        } catch (error) {
          logger.warn('Real user metrics failed:', error.message);
          result.realUserMetrics = { error: 'Real user metrics failed', details: error.message };
          broadcastProgress('user-metrics', 65, '⚠️ User Metrics Failed');
        }
      }

      // Step 6: Cross-Browser Testing
      if (options.includeCrossBrowserTesting !== false) {
        logger.info('🌍 Step 6: Running cross-browser testing...');
        broadcastProgress(6, 'Analyzing cross-browser compatibility...', 55);
        try {
          result.crossBrowserTesting = await crossBrowserTestingService.getCrossBrowserSummary(url);
        } catch (error) {
          logger.warn('Cross-browser testing failed:', error.message);
          result.crossBrowserTesting = { error: 'Cross-browser testing failed', details: error.message };
        }
      }

      // Step 7: Advanced Accessibility Analysis
      if (options.includeAdvancedAccessibility !== false) {
        logger.info('♿ Step 7: Analyzing advanced accessibility...');
        broadcastProgress(7, 'Evaluating accessibility standards...', 64);
        try {
          result.accessibility = await advancedAccessibilityAnalyzer.analyzeAccessibility(fontsData, result.basicScan);
        } catch (error) {
          logger.warn('Advanced accessibility analysis failed:', error.message);
          result.advancedAccessibility = { error: 'Advanced accessibility analysis failed', details: error.message };
        }
      }

      // Step 8: Font Licensing Detection
      if (options.includeFontLicensing !== false) {
        logger.info('⚖️ Step 8: Detecting font licensing...');
        broadcastProgress(8, 'Checking font licensing compliance...', 73);
        try {
          result.licenseCompliance = await fontLicensingDetector.getLicensingSummary(fontsData, url);
        } catch (error) {
          logger.warn('Font licensing detection failed:', error.message);
          result.licenseCompliance = { error: 'Font licensing detection failed', details: error.message };
        }
      }

      // Step 9: Industry Benchmark Analysis
      if (options.includeBenchmarking !== false) {
        logger.info('🏆 Step 9: Running industry benchmark analysis...');
        broadcastProgress(9, 'Benchmarking against industry standards...', 82);
        try {
          result.typographyBenchmark = await benchmarkAnalyzer.evaluateAgainstBenchmarks(result);
        } catch (error) {
          logger.warn('Benchmark analysis failed:', error.message);
          result.typographyBenchmark = { error: 'Benchmark analysis failed', details: error.message };
        }
      }

      // Step 10: Lighthouse analysis (final step for complete metrics)
      if (options.includeLighthouse !== false) {
        logger.info('🏠 Step 10: Running Lighthouse analysis...');
        broadcastProgress(10, 'Running comprehensive Lighthouse analysis...', 91);
        try {
          result.lighthouse = await this.performLighthouseAnalysis(url);
        } catch (error) {
          logger.warn('Lighthouse analysis failed:', error.message);
          result.lighthouse = { 
            desktop: { error: 'Lighthouse desktop analysis failed', details: error.message },
            mobile: { error: 'Lighthouse mobile analysis failed', details: error.message }
          };
        }
      }

      // Step 11: Final Analysis and Scoring
      broadcastProgress(11, 'Generating final analysis and recommendations...', 95);
      
      // Calculate overall score with new features
      result.overallScore = this.calculateBestInClassScore(result);
      result.grade = this.getGradeFromScore(result.overallScore);
      
      // Generate combined recommendations
      result.recommendations = this.generateBestInClassRecommendations(result);

      // Calculate scan duration
      result.scanDuration = Date.now() - startTime;

      // Broadcast completion
      broadcastProgress(11, 'Scan completed successfully!', 100);

      logger.info(`🎉 BEST-IN-CLASS scan completed in ${result.scanDuration}ms`);
      logger.info(`📊 Final Score: ${result.overallScore}/100 (Grade: ${result.grade})`);
      
      return result;

    } catch (error) {
      logger.error('Best-in-class scan failed:', error);
      throw new Error(`Best-in-class scan failed: ${error.message}`);
    }
  }

  async scanMultiplePages(urls) {
    const results = [];
    const batches = this.createBatches(urls, this.maxConcurrentScans);

    for (const batch of batches) {
      logger.info(`Scanning batch of ${batch.length} pages...`);

      const batchPromises = batch.map(async (url) => {
        try {
          const result = await fontScannerService.scanWebsite(url);
          return {
            url,
            success: true,
            ...result,
          };
        } catch (error) {
          logger.error(`Failed to scan ${url}:`, error.message);
          return {
            url,
            success: false,
            error: error.message,
            fonts: { totalFonts: 0, fonts: [], categorizedFonts: {} },
            performance: { initialLoadTime: 0 },
            bestPractices: { score: 0, recommendations: [] },
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  async performLighthouseAnalysis(baseUrl) {
    logger.info('Starting Lighthouse analysis...');

    const lighthouse = {
      desktop: null,
      mobile: null,
    };

    try {
      // Desktop analysis
      logger.info('Running desktop Lighthouse analysis...');
      lighthouse.desktop = await lighthouseAnalyzer.analyzeWithLighthouse(baseUrl, {
        formFactor: 'desktop',
      });

      // Mobile analysis
      logger.info('Running mobile Lighthouse analysis...');
      lighthouse.mobile = await lighthouseAnalyzer.analyzeWithLighthouse(baseUrl, {
        formFactor: 'mobile',
      });

      return lighthouse;
    } catch (error) {
      logger.error('Lighthouse analysis error:', error);
      return lighthouse;
    } finally {
      // Clean up Lighthouse Chrome instance
      try {
        await lighthouseAnalyzer.closeLighthouse();
      } catch (cleanupError) {
        logger.warn('Lighthouse cleanup error:', cleanupError);
      }
    }
  }

  /**
   * Calculate best-in-class overall score (0-100)
   */
  calculateBestInClassScore(result) {
    const weights = {
      basicScan: 0.15,           // Core functionality (15%)
      performance: 0.12,         // Performance (12%)
      bestPractices: 0.10,       // Best practices (10%)
      fontPairing: 0.15,         // AI font pairing (15%)
      realUserMetrics: 0.12,     // Real user metrics (12%)
      crossBrowserTesting: 0.10, // Cross-browser (10%)
      advancedAccessibility: 0.13, // Accessibility (13%)
      fontLicensing: 0.08,       // Licensing (8%)
      lighthouse: 0.05           // Lighthouse (5%)
    };

    let totalScore = 0;
    let totalWeight = 0;

    // Basic scan score
    if (result.basicScan && !result.basicScan.error) {
      const basicScore = this.extractBasicScanScore(result.basicScan);
      totalScore += basicScore * weights.basicScan;
      totalWeight += weights.basicScan;
    }

    // Performance score
    if (result.performance && !result.performance.error) {
      const perfScore = result.performance.overallScore || result.performance.score || 70;
      totalScore += perfScore * weights.performance;
      totalWeight += weights.performance;
    }

    // Best practices score
    if (result.bestPractices && !result.bestPractices.error) {
      const bpScore = result.bestPractices.overallScore || result.bestPractices.score || 70;
      totalScore += bpScore * weights.bestPractices;
      totalWeight += weights.bestPractices;
    }

    // Font pairing score
    if (result.fontPairing && !result.fontPairing.error) {
      const fpScore = result.fontPairing.score || result.fontPairing.overallScore || 75;
      totalScore += fpScore * weights.fontPairing;
      totalWeight += weights.fontPairing;
    }

    // Real user metrics score
    if (result.realUserMetrics && !result.realUserMetrics.error) {
      const rumScore = result.realUserMetrics.score || result.realUserMetrics.overallScore || 70;
      totalScore += rumScore * weights.realUserMetrics;
      totalWeight += weights.realUserMetrics;
    }

    // Cross-browser testing score
    if (result.crossBrowserTesting && !result.crossBrowserTesting.error) {
      const cbtScore = result.crossBrowserTesting.overallScore || result.crossBrowserTesting.score || 75;
      totalScore += cbtScore * weights.crossBrowserTesting;
      totalWeight += weights.crossBrowserTesting;
    }

    // Advanced accessibility score
    if (result.advancedAccessibility && !result.advancedAccessibility.error) {
      const aaScore = result.advancedAccessibility.overallScore || result.advancedAccessibility.score || 65;
      totalScore += aaScore * weights.advancedAccessibility;
      totalWeight += weights.advancedAccessibility;
    }

    // Font licensing score
    if (result.fontLicensing && !result.fontLicensing.error) {
      const flScore = result.fontLicensing.complianceScore || result.fontLicensing.score || 80;
      totalScore += flScore * weights.fontLicensing;
      totalWeight += weights.fontLicensing;
    }

    // Lighthouse score
    if (result.lighthouse && !result.lighthouse.error) {
      const lhScore = this.extractLighthouseScore(result.lighthouse);
      totalScore += lhScore * weights.lighthouse;
      totalWeight += weights.lighthouse;
    }

    // Calculate weighted average
    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    
    // Apply bonus for completeness (having all features working)
    const completenessBonus = this.calculateCompletenessBonus(result);
    
    return Math.min(100, finalScore + completenessBonus);
  }

  /**
   * Calculate completeness bonus for having all features
   */
  calculateCompletenessBonus(result) {
    const features = [
      'basicScan', 'performance', 'bestPractices', 'fontPairing',
      'realUserMetrics', 'crossBrowserTesting', 'advancedAccessibility',
      'fontLicensing', 'lighthouse'
    ];

    const workingFeatures = features.filter(feature => 
      result[feature] && !result[feature].error
    ).length;

    const completeness = workingFeatures / features.length;
    
    // Bonus of up to 5 points for feature completeness
    return Math.round(completeness * 5);
  }

  /**
   * Extract basic scan score
   */
  extractBasicScanScore(basicScan) {
    if (basicScan.fonts && basicScan.fonts.totalFonts !== undefined) {
      // Score based on font count and performance
      const fontCount = basicScan.fonts.totalFonts;
      let score = 85; // Base score
      
      if (fontCount > 10) score -= 15;
      else if (fontCount > 6) score -= 10;
      else if (fontCount > 3) score -= 5;
      
      if (basicScan.performance && basicScan.performance.initialLoadTime) {
        const loadTime = basicScan.performance.initialLoadTime;
        if (loadTime > 3000) score -= 10;
        else if (loadTime > 2000) score -= 5;
      }
      
      return Math.max(0, score);
    }
    return 70; // Default score
  }

  /**
   * Extract Lighthouse score
   */
  extractLighthouseScore(lighthouse) {
    // Handle new format with desktop/mobile structure
    if (lighthouse && lighthouse.desktop && lighthouse.mobile) {
      const desktopScore = lighthouse.desktop.score || 0;
      const mobileScore = lighthouse.mobile.score || 0;
      
      // Weight mobile performance more heavily (60% mobile, 40% desktop)
      const weightedScore = Math.round((mobileScore * 0.6) + (desktopScore * 0.4));
      return Math.max(0, Math.min(100, weightedScore));
    }

    // Handle legacy format with lhr.categories
    if (lighthouse && lighthouse.lhr && lighthouse.lhr.categories) {
      const categories = lighthouse.lhr.categories;
      let totalScore = 0;
      let categoryCount = 0;

      ['performance', 'accessibility', 'best-practices', 'seo'].forEach(category => {
        if (categories[category] && categories[category].score !== null) {
          totalScore += categories[category].score * 100;
          categoryCount++;
        }
      });

      return categoryCount > 0 ? Math.round(totalScore / categoryCount) : 70;
    }

    // Handle single score format
    if (lighthouse && typeof lighthouse.score === 'number') {
      return Math.max(0, Math.min(100, lighthouse.score));
    }

    return 70; // Default score
  }

  /**
   * Get grade from score
   */
  getGradeFromScore(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'C-';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Generate best-in-class recommendations
   */
  generateBestInClassRecommendations(result) {
    const recommendations = [];
    const score = result.overallScore;

    // Overall performance recommendations
    if (score < 70) {
      recommendations.push({
        priority: 'critical',
        category: 'overall',
        title: 'Critical improvements needed',
        description: `Overall score (${score}/100) indicates significant issues`,
        impact: 'high',
        actions: [
          'Focus on font optimization and performance',
          'Address accessibility compliance issues',
          'Review font licensing compliance'
        ]
      });
    } else if (score < 85) {
      recommendations.push({
        priority: 'high',
        category: 'overall',
        title: 'Good foundation, optimize for excellence',
        description: `Score (${score}/100) shows good practices with room for improvement`,
        impact: 'medium',
        actions: [
          'Enhance font pairing strategies',
          'Improve cross-browser consistency',
          'Optimize for real user metrics'
        ]
      });
    }

    // Add component-specific recommendations
    this.addComponentRecommendations(recommendations, result.fontPairing, 'font-pairing');
    this.addComponentRecommendations(recommendations, result.realUserMetrics, 'real-user-metrics');
    this.addComponentRecommendations(recommendations, result.crossBrowserTesting, 'cross-browser');
    this.addComponentRecommendations(recommendations, result.advancedAccessibility, 'accessibility');
    this.addComponentRecommendations(recommendations, result.fontLicensing, 'licensing');
    this.addComponentRecommendations(recommendations, result.performance, 'performance');
    this.addComponentRecommendations(recommendations, result.bestPractices, 'best-practices');

    // Best-in-class specific recommendations
    if (score >= 90) {
      recommendations.unshift({
        priority: 'info',
        category: 'excellence',
        title: 'Excellent typography implementation!',
        description: `Outstanding score (${score}/100) demonstrates best-in-class font usage`,
        impact: 'positive',
        actions: [
          'Consider sharing your implementation as a case study',
          'Monitor performance regularly to maintain excellence',
          'Stay updated with latest typography best practices'
        ]
      });
    }

    return recommendations.slice(0, 10); // Limit to top 10 recommendations
  }

  /**
   * Add component-specific recommendations
   */
  addComponentRecommendations(recommendations, component, category) {
    if (component && component.recommendations && Array.isArray(component.recommendations)) {
      component.recommendations.forEach(rec => {
        recommendations.push({
          ...rec,
          category: category,
          source: 'component-analysis'
        });
      });
    }
  }

  generateHighLevelRecommendations(scanResults) {
    const recommendations = [];

    // Font optimization recommendations
    const avgFonts = scanResults.summary?.totalFonts / (scanResults.pages.length || 1);
    if (avgFonts > 6) {
      recommendations.push({
        category: 'Font Optimization',
        priority: 'high',
        title: 'Reduce Font Variations',
        description: `Average of ${avgFonts.toFixed(1)} fonts per page detected. Consider reducing font variations and using system fonts where possible.`,
      });
    }

    // Performance recommendations
    if (scanResults.lighthouse?.mobile?.score < 70) {
      recommendations.push({
        category: 'Mobile Performance',
        priority: 'high',
        title: 'Improve Mobile Performance',
        description: `Mobile Lighthouse score is ${scanResults.lighthouse.mobile.score}. Focus on Core Web Vitals optimization.`,
      });
    }

    // Desktop vs Mobile gap
    if (scanResults.lighthouse?.desktop && scanResults.lighthouse?.mobile) {
      const gap = scanResults.lighthouse.desktop.score - scanResults.lighthouse.mobile.score;
      if (gap > 20) {
        recommendations.push({
          category: 'Cross-Platform',
          priority: 'medium',
          title: 'Bridge Desktop-Mobile Performance Gap',
          description: `${gap} point difference between desktop and mobile performance. Consider mobile-first optimization.`,
        });
      }
    }

    // Accessibility recommendations
    const avgAccessibility = scanResults.lighthouse?.desktop?.accessibility?.score || 0;
    if (avgAccessibility < 80) {
      recommendations.push({
        category: 'Accessibility',
        priority: 'high',
        title: 'Address Accessibility Issues',
        description: `Accessibility score is ${avgAccessibility}. Review font sizes, contrast ratios, and screen reader compatibility.`,
      });
    }

    return recommendations;
  }

  /**
   * Legacy method for backward compatibility
   * Alias for runFullScan
   */
  async performComprehensiveScan(url, options = {}) {
    // For backward compatibility, call the full scan with default options
    return await this.runFullScan(url, 'comprehensive', {
      includePerformance: true,
      includeBestPractices: true,
      includeFontPairing: false, // Don't include advanced features by default
      includeRealUserMetrics: false,
      includeCrossBrowserTesting: false,
      includeAdvancedAccessibility: false,
      includeFontLicensing: false,
      includeBenchmarking: false,
      includeLighthouse: true,
      ...options // Allow overrides
    });
  }

  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Generate fallback best practices analysis when page analysis fails
   */
  generateFallbackBestPractices(fonts) {
    const fontCount = fonts?.fonts?.length || 0;
    const webFonts = fonts?.fonts?.filter(f => !f.isSystemFont) || [];
    const hasWoff2 = webFonts.some(f => f.format === 'woff2');
    const hasFontDisplay = webFonts.some(f => f.fontDisplay && f.fontDisplay !== 'auto');
    
    return {
      score: 75, // Reasonable default score
      categories: {
        fontDisplay: {
          score: hasFontDisplay ? 85 : 60,
          findings: [`Font display strategy: ${hasFontDisplay ? 'Optimized' : 'Could be improved'}`]
        },
        fontLoading: {
          score: hasWoff2 ? 80 : 65,
          findings: [`Format optimization: ${hasWoff2 ? 'WOFF2 detected' : 'Consider WOFF2'}`]
        },
        fontOptimization: {
          score: 70,
          findings: [`${fontCount} fonts detected`, `${webFonts.length} web fonts`]
        },
        accessibility: {
          score: 75,
          findings: ['Accessibility analysis requires page access']
        },
        performance: {
          score: fontCount <= 3 ? 85 : fontCount <= 6 ? 70 : 55,
          findings: [`Font count: ${fontCount} ${fontCount <= 3 ? '(Good)' : fontCount <= 6 ? '(Moderate)' : '(High)'}`]
        }
      },
      recommendations: [
        'Use font-display: swap for better loading performance',
        'Optimize font formats (WOFF2 preferred)',
        'Limit total number of font files',
        'Implement font preloading for critical fonts'
      ],
      summary: `Analyzed ${fontCount} fonts with ${webFonts.length} web fonts. Score: 75/100`
    };
  }
}

module.exports = new EnhancedScannerService();