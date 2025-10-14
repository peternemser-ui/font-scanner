const { createLogger } = require('../utils/logger');
const fontScannerService = require('./fontScannerService');
const lighthouseAnalyzer = require('./lighthouseAnalyzer');
const siteDiscovery = require('./siteDiscovery');
const pdfReportGenerator = require('./pdfReportGenerator');

const logger = createLogger('EnhancedScannerService');

class EnhancedScannerService {
  constructor() {
    this.maxConcurrentScans = 3;
  }

  async performComprehensiveScan(baseUrl, options = {}) {
    logger.info(`Starting comprehensive scan for: ${baseUrl}`);

    const scanResults = {
      baseUrl,
      startTime: Date.now(),
      pages: [],
      lighthouse: {
        desktop: null,
        mobile: null,
      },
      summary: {},
      reportPath: null,
    };

    try {
      // Phase 1: Discover pages
      const discoveredPages = await siteDiscovery.discoverPages(baseUrl);
      logger.info(`Phase 1 complete: Discovered ${discoveredPages.length} pages`);

      // Phase 2: Analyze each page with font scanner
      scanResults.pages = await this.scanMultiplePages(discoveredPages);
      logger.info(`Phase 2 complete: Font analysis done for ${scanResults.pages.length} pages`);

      // Phase 3: Lighthouse analysis for desktop and mobile
      scanResults.lighthouse = await this.performLighthouseAnalysis(baseUrl);
      logger.info('Phase 3 complete: Lighthouse analysis done');

      // Phase 4: Generate comprehensive report
      if (options.generatePDF !== false) {
        const reportInfo = await pdfReportGenerator.generateComprehensiveReport(scanResults);
        scanResults.reportPath = reportInfo.filepath;
        scanResults.reportFilename = reportInfo.filename;
        logger.info(`Phase 4 complete: PDF report generated - ${reportInfo.filename}`);
      }

      // Phase 5: Generate summary
      scanResults.summary = this.generateScanSummary(scanResults);
      scanResults.endTime = Date.now();
      scanResults.totalDuration = scanResults.endTime - scanResults.startTime;

      logger.info(`Comprehensive scan completed in ${scanResults.totalDuration}ms`);
      return scanResults;
    } catch (error) {
      logger.error('Comprehensive scan error:', error);
      throw error;
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

  generateScanSummary(scanResults) {
    const summary = {
      totalPages: scanResults.pages.length,
      successfulScans: scanResults.pages.filter((p) => p.success).length,
      failedScans: scanResults.pages.filter((p) => !p.success).length,
      averageLoadTime: 0,
      totalFonts: 0,
      uniqueFonts: new Set(),
      performanceIssues: [],
      accessibilityIssues: [],
      bestPracticesScore: 0,
      recommendations: [],
    };

    // Calculate averages and totals
    const successfulPages = scanResults.pages.filter((p) => p.success);

    if (successfulPages.length > 0) {
      summary.averageLoadTime =
        successfulPages.reduce((sum, page) => sum + (page.performance?.initialLoadTime || 0), 0) /
        successfulPages.length;

      summary.totalFonts = successfulPages.reduce(
        (sum, page) => sum + (page.fonts?.totalFonts || 0),
        0
      );

      // Collect unique fonts
      successfulPages.forEach((page) => {
        if (page.fonts?.fonts) {
          page.fonts.fonts.forEach((font) => summary.uniqueFonts.add(font));
        }
      });

      // Calculate average best practices score
      summary.bestPracticesScore =
        successfulPages.reduce((sum, page) => sum + (page.bestPractices?.score || 0), 0) /
        successfulPages.length;
    }

    // Lighthouse summary
    if (scanResults.lighthouse.desktop) {
      summary.lighthouseDesktop = {
        performance: scanResults.lighthouse.desktop.score,
        accessibility: scanResults.lighthouse.desktop.accessibility?.score || 0,
        bestPractices: scanResults.lighthouse.desktop.bestPractices?.score || 0,
        seo: scanResults.lighthouse.desktop.seo?.score || 0,
      };
    }

    if (scanResults.lighthouse.mobile) {
      summary.lighthouseMobile = {
        performance: scanResults.lighthouse.mobile.score,
        accessibility: scanResults.lighthouse.mobile.accessibility?.score || 0,
        bestPractices: scanResults.lighthouse.mobile.bestPractices?.score || 0,
        seo: scanResults.lighthouse.mobile.seo?.score || 0,
      };
    }

    // Generate high-level recommendations
    summary.recommendations = this.generateHighLevelRecommendations(scanResults);

    // Convert Set to Array for JSON serialization
    summary.uniqueFonts = Array.from(summary.uniqueFonts);

    return summary;
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

  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
}

module.exports = new EnhancedScannerService();
