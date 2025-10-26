const { createLogger } = require('../utils/logger');
const lighthouseAnalyzer = require('./lighthouseAnalyzer');

const logger = createLogger('CrossBrowserLighthouseService');

/**
 * Cross-Browser Lighthouse Service
 * Runs Lighthouse audits across different device profiles (desktop vs mobile)
 * to provide comparative performance analysis
 */
class CrossBrowserLighthouseService {
  constructor() {
    this.profiles = {
      desktop: {
        name: 'Desktop',
        formFactor: 'desktop',
        icon: '🖥️',
        description: 'Desktop Chrome (no throttling)'
      },
      mobile: {
        name: 'Mobile',
        formFactor: 'mobile',
        icon: '📱',
        description: 'Mobile Chrome (4G, 4x CPU throttling)'
      }
    };
  }

  /**
   * Run cross-browser (device profile) comparison
   */
  async runCrossBrowserAnalysis(url, options = {}) {
    const startTime = Date.now();
    logger.info(`Starting cross-browser analysis for: ${url}`);

    try {
      const results = {
        timestamp: new Date().toISOString(),
        url: url,
        browsers: {},
        comparison: {},
        overallScore: 0,
        recommendations: [],
        duration: 0
      };

      // Run analysis for each profile in parallel
      const selectedProfiles = options.profiles || ['desktop', 'mobile'];
      const analysisPromises = selectedProfiles.map(async (profileKey) => {
        const profile = this.profiles[profileKey];
        if (!profile) {
          logger.warn(`Unknown profile: ${profileKey}`);
          return null;
        }

        try {
          logger.info(`Running Lighthouse for ${profile.name}...`);
          const lighthouseResult = await lighthouseAnalyzer.analyzeWithLighthouse(url, {
            formFactor: profile.formFactor
          });

          return {
            profileKey,
            profile,
            result: this.processBrowserResult(lighthouseResult, profile)
          };
        } catch (error) {
          logger.error(`Error analyzing ${profile.name}:`, error);
          return {
            profileKey,
            profile,
            result: this.getErrorResult(profile.name, error)
          };
        }
      });

      const analysisResults = await Promise.all(analysisPromises);

      // Organize results by browser
      analysisResults.filter(r => r !== null).forEach(({ profileKey, result }) => {
        results.browsers[profileKey] = result;
      });

      // Generate comparison analysis
      results.comparison = this.generateComparison(results.browsers);
      results.overallScore = this.calculateOverallScore(results.browsers);
      results.recommendations = this.generateRecommendations(results.browsers, results.comparison);
      results.duration = Date.now() - startTime;

      logger.info(`Cross-browser analysis completed in ${results.duration}ms`, {
        overallScore: results.overallScore,
        browsers: Object.keys(results.browsers).length
      });

      return results;

    } catch (error) {
      logger.error('Error in cross-browser analysis:', error);
      throw error;
    }
  }

  /**
   * Process browser result into standardized format
   */
  processBrowserResult(lighthouseResult, profile) {
    return {
      browser: profile.name,
      icon: profile.icon,
      description: profile.description,
      success: !lighthouseResult.error,
      error: lighthouseResult.error || null,
      
      // Core scores
      performanceScore: lighthouseResult.score || 0,
      accessibilityScore: lighthouseResult.accessibility || 0,
      bestPracticesScore: lighthouseResult.bestPractices || 0,
      seoScore: lighthouseResult.seo || 0,
      
      // Performance metrics
      metrics: {
        firstContentfulPaint: lighthouseResult.metrics?.firstContentfulPaint || 0,
        largestContentfulPaint: lighthouseResult.metrics?.largestContentfulPaint || 0,
        cumulativeLayoutShift: lighthouseResult.metrics?.cumulativeLayoutShift || 0,
        totalBlockingTime: lighthouseResult.metrics?.totalBlockingTime || 0,
        speedIndex: lighthouseResult.metrics?.speedIndex || 0,
        coreWebVitals: lighthouseResult.metrics?.coreWebVitals || {}
      },
      
      // Font-specific audits
      fontAudits: lighthouseResult.fontAudits || {},
      
      // Opportunities and diagnostics
      opportunities: lighthouseResult.opportunities || [],
      diagnostics: lighthouseResult.diagnostics || [],
      
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate comparison between device profiles
   */
  generateComparison(browserResults) {
    const comparison = {
      performanceGap: 0,
      performanceVariation: {},
      metricsDifferences: [],
      recommendations: []
    };

    const browsers = Object.keys(browserResults);
    if (browsers.length < 2) {
      return comparison;
    }

    // Compare performance scores
    const perfScores = browsers.map(b => browserResults[b].performanceScore);
    const maxScore = Math.max(...perfScores);
    const minScore = Math.min(...perfScores);
    comparison.performanceGap = maxScore - minScore;

    if (comparison.performanceGap > 20) {
      comparison.recommendations.push({
        type: 'performance-gap',
        severity: 'high',
        message: `Significant performance gap (${comparison.performanceGap} points) between desktop and mobile`,
        action: 'Focus on mobile optimization to improve consistency'
      });
    }

    // Compare Core Web Vitals
    const desktopMetrics = browserResults.desktop?.metrics;
    const mobileMetrics = browserResults.mobile?.metrics;

    if (desktopMetrics && mobileMetrics) {
      // LCP comparison
      const lcpDiff = mobileMetrics.largestContentfulPaint - desktopMetrics.largestContentfulPaint;
      if (lcpDiff > 2000) {
        comparison.metricsDifferences.push({
          metric: 'Largest Contentful Paint',
          difference: lcpDiff,
          severity: lcpDiff > 3000 ? 'high' : 'medium',
          desktop: desktopMetrics.largestContentfulPaint,
          mobile: mobileMetrics.largestContentfulPaint,
          message: `LCP ${(lcpDiff / 1000).toFixed(1)}s slower on mobile`
        });
      }

      // TBT comparison
      const tbtDiff = mobileMetrics.totalBlockingTime - desktopMetrics.totalBlockingTime;
      if (tbtDiff > 200) {
        comparison.metricsDifferences.push({
          metric: 'Total Blocking Time',
          difference: tbtDiff,
          severity: tbtDiff > 500 ? 'high' : 'medium',
          desktop: desktopMetrics.totalBlockingTime,
          mobile: mobileMetrics.totalBlockingTime,
          message: `TBT ${tbtDiff}ms higher on mobile`
        });
      }

      // CLS comparison
      const clsDiff = Math.abs(mobileMetrics.cumulativeLayoutShift - desktopMetrics.cumulativeLayoutShift);
      if (clsDiff > 0.1) {
        comparison.metricsDifferences.push({
          metric: 'Cumulative Layout Shift',
          difference: clsDiff,
          severity: clsDiff > 0.2 ? 'high' : 'medium',
          desktop: desktopMetrics.cumulativeLayoutShift,
          mobile: mobileMetrics.cumulativeLayoutShift,
          message: `CLS differs by ${clsDiff.toFixed(3)} between desktop and mobile`
        });
      }
    }

    return comparison;
  }

  /**
   * Calculate overall cross-browser score
   */
  calculateOverallScore(browserResults) {
    const browsers = Object.keys(browserResults);
    if (browsers.length === 0) return 0;

    // Average performance score across all successful browsers
    const scores = browsers
      .filter(b => browserResults[b].success)
      .map(b => browserResults[b].performanceScore);

    if (scores.length === 0) return 0;

    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Apply penalty for large performance gaps
    const maxGap = Math.max(...scores) - Math.min(...scores);
    const gapPenalty = Math.min(maxGap / 2, 15); // Max 15 point penalty

    return Math.max(0, Math.round(avgScore - gapPenalty));
  }

  /**
   * Generate recommendations based on cross-browser results
   */
  generateRecommendations(browserResults, comparison) {
    const recommendations = [];

    // Check mobile performance
    if (browserResults.mobile && browserResults.mobile.performanceScore < 70) {
      recommendations.push({
        priority: 'high',
        category: 'mobile-performance',
        title: 'Optimize for mobile devices',
        description: `Mobile performance score is ${browserResults.mobile.performanceScore}`,
        actions: [
          'Reduce JavaScript execution time',
          'Optimize images for mobile connections',
          'Implement lazy loading for below-the-fold content',
          'Use responsive images with srcset'
        ]
      });
    }

    // Check desktop performance
    if (browserResults.desktop && browserResults.desktop.performanceScore < 85) {
      recommendations.push({
        priority: 'medium',
        category: 'desktop-performance',
        title: 'Improve desktop performance',
        description: `Desktop performance score is ${browserResults.desktop.performanceScore}`,
        actions: [
          'Minimize main-thread work',
          'Reduce unused JavaScript',
          'Optimize third-party scripts',
          'Implement code splitting'
        ]
      });
    }

    // Performance gap recommendations (from comparison)
    if (comparison.performanceGap > 20) {
      recommendations.push({
        priority: 'high',
        category: 'consistency',
        title: 'Reduce performance gap between devices',
        description: `${comparison.performanceGap} point difference between desktop and mobile`,
        actions: [
          'Profile your site on mobile devices',
          'Reduce mobile-specific bottlenecks',
          'Test with realistic mobile network conditions',
          'Consider adaptive loading strategies'
        ]
      });
    }

    // Core Web Vitals recommendations
    if (comparison.metricsDifferences.length > 0) {
      const highSeverityMetrics = comparison.metricsDifferences.filter(m => m.severity === 'high');
      if (highSeverityMetrics.length > 0) {
        recommendations.push({
          priority: 'high',
          category: 'core-web-vitals',
          title: 'Address Core Web Vitals discrepancies',
          description: `${highSeverityMetrics.length} critical metric(s) differ significantly between devices`,
          actions: highSeverityMetrics.map(m => `Optimize ${m.metric}: ${m.message}`)
        });
      }
    }

    // Font-specific cross-browser recommendations
    const mobileHasFontIssues = browserResults.mobile?.fontAudits?.fontDisplay?.score < 0.5;
    const desktopHasFontIssues = browserResults.desktop?.fontAudits?.fontDisplay?.score < 0.5;

    if (mobileHasFontIssues || desktopHasFontIssues) {
      recommendations.push({
        priority: 'medium',
        category: 'fonts',
        title: 'Optimize font loading strategy',
        description: 'Font loading affecting performance on both desktop and mobile',
        actions: [
          'Use font-display: swap for all web fonts',
          'Preload critical fonts',
          'Subset fonts to reduce file size',
          'Consider system font stacks for faster rendering'
        ]
      });
    }

    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  /**
   * Get error result for failed analysis
   */
  getErrorResult(browserName, error) {
    return {
      browser: browserName,
      success: false,
      error: error.message,
      performanceScore: 0,
      accessibilityScore: 0,
      bestPracticesScore: 0,
      seoScore: 0,
      metrics: {},
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get summary of cross-browser results for dashboard
   */
  getSummary(analysisResults) {
    return {
      overallScore: analysisResults.overallScore,
      testedProfiles: Object.keys(analysisResults.browsers).length,
      performanceGap: analysisResults.comparison.performanceGap,
      topIssues: analysisResults.recommendations.slice(0, 3),
      browserScores: Object.fromEntries(
        Object.entries(analysisResults.browsers).map(([key, data]) => [
          key,
          {
            score: data.performanceScore,
            success: data.success,
            icon: data.icon
          }
        ])
      ),
      duration: analysisResults.duration
    };
  }
}

module.exports = new CrossBrowserLighthouseService();
