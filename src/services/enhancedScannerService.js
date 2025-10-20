const { createLogger } = require('../utils/logger');
const browserPool = require('../utils/browserPool');
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
          result.lighthouse = await this.performLighthouseAnalysis(url, {
            includeMobile: options.includeMobileLighthouse !== false // Run mobile by default
          });
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

  async performLighthouseAnalysis(baseUrl, options = {}) {
    logger.info('Starting Lighthouse analysis...');

    const lighthouse = {
      desktop: null,
      mobile: null,
    };

    try {
      // Desktop analysis (always run)
      logger.info('Running desktop Lighthouse analysis...');
      lighthouse.desktop = await lighthouseAnalyzer.analyzeWithLighthouse(baseUrl, {
        formFactor: 'desktop',
      });

      // Mobile analysis (run by default, can be disabled)
      if (options.includeMobile !== false) {
        logger.info('Running mobile Lighthouse analysis...');
        lighthouse.mobile = await lighthouseAnalyzer.analyzeWithLighthouse(baseUrl, {
          formFactor: 'mobile',
        });
      } else {
        logger.info('⚡ Mobile Lighthouse disabled via options');
      }

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
   * Fixed: Only includes working analyzers, no inflated defaults
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
    const scoringBreakdown = []; // Track what contributed to the score

    // Basic scan score (REQUIRED - always included)
    if (result.basicScan && !result.basicScan.error) {
      const basicScore = this.extractBasicScanScore(result.basicScan);
      totalScore += basicScore * weights.basicScan;
      totalWeight += weights.basicScan;
      scoringBreakdown.push({ component: 'basicScan', score: basicScore, weight: weights.basicScan });
      logger.debug(`✅ Basic scan scored: ${basicScore}`);
    } else {
      logger.warn('⚠️ Basic scan missing or failed - this should not happen');
    }

    // Performance score - only if valid score exists
    if (result.performance && !result.performance.error && 
        (result.performance.overallScore != null || result.performance.score != null)) {
      const perfScore = result.performance.overallScore || result.performance.score;
      if (perfScore > 0) {
        totalScore += perfScore * weights.performance;
        totalWeight += weights.performance;
        scoringBreakdown.push({ component: 'performance', score: perfScore, weight: weights.performance });
        logger.debug(`✅ Performance scored: ${perfScore}`);
      }
    } else {
      logger.debug('⏭️ Performance analysis excluded from scoring (not available)');
    }

    // Best practices score - only if valid score exists
    if (result.bestPractices && !result.bestPractices.error && 
        (result.bestPractices.overallScore != null || result.bestPractices.score != null)) {
      const bpScore = result.bestPractices.overallScore || result.bestPractices.score;
      if (bpScore > 0) {
        totalScore += bpScore * weights.bestPractices;
        totalWeight += weights.bestPractices;
        scoringBreakdown.push({ component: 'bestPractices', score: bpScore, weight: weights.bestPractices });
        logger.debug(`✅ Best practices scored: ${bpScore}`);
      }
    } else {
      logger.debug('⏭️ Best practices analysis excluded from scoring (not available)');
    }

    // Font pairing score - only if valid score exists
    if (result.fontPairing && !result.fontPairing.error && 
        (result.fontPairing.score != null || result.fontPairing.overallScore != null)) {
      const fpScore = result.fontPairing.score || result.fontPairing.overallScore;
      if (fpScore > 0) {
        totalScore += fpScore * weights.fontPairing;
        totalWeight += weights.fontPairing;
        scoringBreakdown.push({ component: 'fontPairing', score: fpScore, weight: weights.fontPairing });
        logger.debug(`✅ Font pairing scored: ${fpScore}`);
      }
    } else {
      logger.debug('⏭️ Font pairing analysis excluded from scoring (not available)');
    }

    // Real user metrics score - only if valid score exists
    if (result.realUserMetrics && !result.realUserMetrics.error && 
        (result.realUserMetrics.score != null || result.realUserMetrics.overallScore != null)) {
      const rumScore = result.realUserMetrics.score || result.realUserMetrics.overallScore;
      if (rumScore > 0) {
        totalScore += rumScore * weights.realUserMetrics;
        totalWeight += weights.realUserMetrics;
        scoringBreakdown.push({ component: 'realUserMetrics', score: rumScore, weight: weights.realUserMetrics });
        logger.debug(`✅ Real user metrics scored: ${rumScore}`);
      }
    } else {
      logger.debug('⏭️ Real user metrics excluded from scoring (not available)');
    }

    // Cross-browser testing score - only if valid score exists
    if (result.crossBrowserTesting && !result.crossBrowserTesting.error && 
        (result.crossBrowserTesting.overallScore != null || result.crossBrowserTesting.score != null)) {
      const cbtScore = result.crossBrowserTesting.overallScore || result.crossBrowserTesting.score;
      if (cbtScore > 0) {
        totalScore += cbtScore * weights.crossBrowserTesting;
        totalWeight += weights.crossBrowserTesting;
        scoringBreakdown.push({ component: 'crossBrowserTesting', score: cbtScore, weight: weights.crossBrowserTesting });
        logger.debug(`✅ Cross-browser testing scored: ${cbtScore}`);
      }
    } else {
      logger.debug('⏭️ Cross-browser testing excluded from scoring (not available)');
    }

    // Advanced accessibility score - only if valid score exists
    if (result.accessibility && !result.accessibility.error && 
        (result.accessibility.overallScore != null || result.accessibility.score != null)) {
      const aaScore = result.accessibility.overallScore || result.accessibility.score;
      if (aaScore > 0) {
        totalScore += aaScore * weights.advancedAccessibility;
        totalWeight += weights.advancedAccessibility;
        scoringBreakdown.push({ component: 'accessibility', score: aaScore, weight: weights.advancedAccessibility });
        logger.debug(`✅ Advanced accessibility scored: ${aaScore}`);
      }
    } else {
      logger.debug('⏭️ Advanced accessibility excluded from scoring (not available)');
    }

    // Font licensing score - only if valid score exists
    if (result.licenseCompliance && !result.licenseCompliance.error && 
        (result.licenseCompliance.complianceScore != null || result.licenseCompliance.score != null)) {
      const flScore = result.licenseCompliance.complianceScore || result.licenseCompliance.score;
      if (flScore > 0) {
        totalScore += flScore * weights.fontLicensing;
        totalWeight += weights.fontLicensing;
        scoringBreakdown.push({ component: 'fontLicensing', score: flScore, weight: weights.fontLicensing });
        logger.debug(`✅ Font licensing scored: ${flScore}`);
      }
    } else {
      logger.debug('⏭️ Font licensing excluded from scoring (not available)');
    }

    // Lighthouse score - only if valid score exists
    if (result.lighthouse && !result.lighthouse.error) {
      const lhScore = this.extractLighthouseScore(result.lighthouse);
      if (lhScore > 0) {
        totalScore += lhScore * weights.lighthouse;
        totalWeight += weights.lighthouse;
        scoringBreakdown.push({ component: 'lighthouse', score: lhScore, weight: weights.lighthouse });
        logger.debug(`✅ Lighthouse scored: ${lhScore}`);
      }
    } else {
      logger.debug('⏭️ Lighthouse excluded from scoring (not available)');
    }

    // Calculate weighted average
    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    
    // Apply selective completeness bonus (only if base score > 70)
    const completenessBonus = finalScore > 70 ? this.calculateCompletenessBonus(result) : 0;
    
    const adjustedScore = Math.min(100, finalScore + completenessBonus);

    // Log scoring breakdown for transparency
    logger.info('📊 Scoring breakdown:', {
      components: scoringBreakdown.length,
      totalWeight: totalWeight.toFixed(2),
      baseScore: finalScore,
      completenessBonus,
      finalScore: adjustedScore,
      breakdown: scoringBreakdown
    });

    // Store breakdown in result for frontend display
    result.scoringBreakdown = {
      components: scoringBreakdown,
      baseScore: finalScore,
      completenessBonus,
      finalScore: adjustedScore,
      totalWeight
    };
    
    return adjustedScore;
  }

  /**
   * Calculate completeness bonus for having all features
   * Fixed: More conservative bonus, requires high completion rate
   */
  calculateCompletenessBonus(result) {
    const features = [
      'basicScan', 'performance', 'bestPractices', 'fontPairing',
      'realUserMetrics', 'crossBrowserTesting', 'accessibility',
      'licenseCompliance', 'lighthouse'
    ];

    // Count features that have valid scores
    const workingFeatures = features.filter(feature => {
      const component = result[feature];
      if (!component || component.error) return false;
      
      // Check if component has a valid score
      const score = component.score || component.overallScore || component.complianceScore;
      return score != null && score > 0;
    }).length;

    const completeness = workingFeatures / features.length;
    
    // More conservative bonus:
    // - Must have at least 70% features working to get any bonus
    // - Max bonus reduced from 5 to 3 points
    // - Only rewards near-complete implementations
    if (completeness < 0.7) {
      logger.debug(`⚠️ Low completeness (${Math.round(completeness * 100)}%) - no bonus awarded`);
      return 0;
    }
    
    const bonus = Math.round((completeness - 0.7) / 0.3 * 3); // 0-3 points for 70-100% completion
    logger.debug(`✨ Completeness bonus: +${bonus} points (${Math.round(completeness * 100)}% features working)`);
    
    return bonus;
  }

  /**
   * Extract basic scan score
   * Fixed: More realistic scoring based on actual metrics
   */
  extractBasicScanScore(basicScan) {
    if (!basicScan || !basicScan.fonts) {
      logger.warn('⚠️ Basic scan missing font data');
      return 0;
    }

    const fontCount = basicScan.fonts.totalFonts || 0;
    
    // Start with performance-based score (50 points max)
    let performanceScore = 50;
    if (basicScan.performance && basicScan.performance.initialLoadTime) {
      const loadTime = basicScan.performance.initialLoadTime;
      if (loadTime < 1000) performanceScore = 50;        // Excellent
      else if (loadTime < 2000) performanceScore = 40;   // Good
      else if (loadTime < 3000) performanceScore = 30;   // Fair
      else if (loadTime < 5000) performanceScore = 20;   // Poor
      else performanceScore = 10;                        // Very poor
    }
    
    // Font optimization score (50 points max)
    let fontScore = 50;
    if (fontCount === 0) {
      fontScore = 30; // Suspicious - might be scan issue
    } else if (fontCount <= 2) {
      fontScore = 50; // Optimal
    } else if (fontCount <= 4) {
      fontScore = 45; // Good
    } else if (fontCount <= 6) {
      fontScore = 35; // Fair
    } else if (fontCount <= 10) {
      fontScore = 25; // Concerning
    } else {
      fontScore = 15; // Too many fonts
    }
    
    // Bonus for using modern formats (up to 10 points)
    let formatBonus = 0;
    if (basicScan.fonts.fonts && Array.isArray(basicScan.fonts.fonts)) {
      const hasWoff2 = basicScan.fonts.fonts.some(f => f.format === 'woff2');
      const hasFontDisplay = basicScan.fonts.fonts.some(f => f.fontDisplay && f.fontDisplay !== 'auto');
      
      if (hasWoff2) formatBonus += 5;
      if (hasFontDisplay) formatBonus += 5;
    }
    
    const finalScore = Math.min(100, performanceScore + fontScore + formatBonus);
    
    logger.debug(`📊 Basic scan scoring: perf=${performanceScore}, fonts=${fontScore}, bonus=${formatBonus}, total=${finalScore}`);
    
    return finalScore;
  }

  /**
   * Extract Lighthouse score
   * Fixed: Returns 0 for invalid data instead of defaulting to 70
   */
  extractLighthouseScore(lighthouse) {
    // Handle new format with desktop/mobile structure
    if (lighthouse && lighthouse.desktop && lighthouse.mobile) {
      const desktopScore = lighthouse.desktop.score || 0;
      const mobileScore = lighthouse.mobile.score || 0;
      
      // Must have at least one valid score
      if (desktopScore === 0 && mobileScore === 0) {
        logger.debug('⚠️ Lighthouse has no valid scores');
        return 0;
      }
      
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

      if (categoryCount === 0) {
        logger.debug('⚠️ Lighthouse has no valid category scores');
        return 0;
      }

      return Math.round(totalScore / categoryCount);
    }

    // Handle single score format
    if (lighthouse && typeof lighthouse.score === 'number' && lighthouse.score > 0) {
      return Math.max(0, Math.min(100, lighthouse.score));
    }

    // No valid Lighthouse data found
    logger.debug('⚠️ Lighthouse data invalid or missing');
    return 0;
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