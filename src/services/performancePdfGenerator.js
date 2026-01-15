const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { resolveReportId } = require('../utils/resolveReportId');
const {
  initializePdfGeneration,
  finalizePdfGeneration,
  addPdfHeader,
  addSectionHeader,
  checkPageBreakNeeded,
  getScoreColor,
  getGrade
} = require('../utils/pdfHelpers');
const { formatBytes } = require('../utils/formatHelpers');

const logger = createLogger('PerformancePdfGenerator');

/**
 * Performance PDF Report Generator
 * Creates professional PDF reports for Performance analysis results
 */
class PerformancePdfGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '../../reports');
    this.ensureReportsDir();
  }

  ensureReportsDir() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate comprehensive Performance PDF report
   */
  async generateReport(performanceResults) {
    // Use helper to initialize PDF generation
    const { doc, filepath, reportId, stream, filename } = initializePdfGeneration(
      performanceResults,
      'performance',
      { reportsDir: this.reportsDir }
    );

    try {
      // Use helper for header
      addPdfHeader(
        doc,
        '[PERFORMANCE_ANALYSIS_REPORT]',
        performanceResults.url,
        'comprehensive performance and speed analysis'
      );

      // Generate report sections
      this.addExecutiveSummary(doc, performanceResults);
      this.addCoreWebVitals(doc, performanceResults);
      this.addPerformanceMetrics(doc, performanceResults);
      this.addResourceAnalysis(doc, performanceResults);
      this.addDesktopMobileComparison(doc, performanceResults);
      this.addRecommendations(doc, performanceResults);

      // Use helper to finalize PDF generation
      return finalizePdfGeneration(doc, stream, filename, filepath, reportId);
    } catch (error) {
      logger.error('Error creating Performance PDF:', error);
      throw error;
    }
  }

  // addHeader removed - using pdfHelpers.addPdfHeader() instead

  /**
   * Add executive summary
   */
  addExecutiveSummary(doc, results) {
    checkPageBreakNeeded(doc, 200);
    addSectionHeader(doc, '📊 Executive Summary');

    const overallScore = results.overallScore || results.performanceScore || 0;
    const grade = getGrade(overallScore);
    const color = getScoreColor(overallScore);

    // Overall Score Box
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#333')
      .text('Overall Performance Score:', doc.x, doc.y);
    
    doc
      .fontSize(48)
      .fillColor(color)
      .text(overallScore.toString(), doc.x + 250, doc.y - 20);
    
    doc
      .fontSize(16)
      .fillColor(color)
      .text(grade, doc.x + 250, doc.y + 5);

    doc.moveDown(3);

    // Component Scores
    const components = [
      { name: 'First Contentful Paint', score: results.fcp?.score || 0 },
      { name: 'Largest Contentful Paint', score: results.lcp?.score || 0 },
      { name: 'Total Blocking Time', score: results.tbt?.score || 0 },
      { name: 'Cumulative Layout Shift', score: results.cls?.score || 0 },
      { name: 'Speed Index', score: results.speedIndex?.score || 0 }
    ];

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333').text('Component Breakdown:');
    doc.moveDown(0.5);

    components.forEach(comp => {
      const compColor = getScoreColor(comp.score);
      const compGrade = getGrade(comp.score);
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#555')
        .text(comp.name, doc.x, doc.y, { continued: true })
        .fillColor(compColor)
        .text(` ${comp.score} (${compGrade})`, { align: 'left' });
      
      doc.moveDown(0.5);
    });

    doc.moveDown(1);
  }

  /**
   * Add Core Web Vitals section
   */
  addCoreWebVitals(doc, results) {
    checkPageBreakNeeded(doc, 300);
    addSectionHeader(doc, '⚡ Core Web Vitals');

    // LCP - Largest Contentful Paint
    if (results.lcp) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Largest Contentful Paint (LCP)');
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#555')
        .text(`Value: ${results.lcp.displayValue || results.lcp.value || 'N/A'}`, { indent: 20 })
        .text(`Score: ${results.lcp.score}/100 (${getGrade(results.lcp.score)})`, { indent: 20 })
        .text(`Threshold: Good < 2.5s, Needs Improvement < 4s, Poor > 4s`, { indent: 20 });
      
      doc.moveDown(1);
    }

    // FID/TBT - First Input Delay / Total Blocking Time
    if (results.tbt) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Total Blocking Time (TBT)');
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#555')
        .text(`Value: ${results.tbt.displayValue || results.tbt.value || 'N/A'}`, { indent: 20 })
        .text(`Score: ${results.tbt.score}/100 (${getGrade(results.tbt.score)})`, { indent: 20 })
        .text(`Threshold: Good < 200ms, Needs Improvement < 600ms, Poor > 600ms`, { indent: 20 });
      
      doc.moveDown(1);
    }

    // CLS - Cumulative Layout Shift
    if (results.cls) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Cumulative Layout Shift (CLS)');
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#555')
        .text(`Value: ${results.cls.displayValue || results.cls.value || 'N/A'}`, { indent: 20 })
        .text(`Score: ${results.cls.score}/100 (${getGrade(results.cls.score)})`, { indent: 20 })
        .text(`Threshold: Good < 0.1, Needs Improvement < 0.25, Poor > 0.25`, { indent: 20 });
      
      doc.moveDown(1);
    }

    // FCP - First Contentful Paint
    if (results.fcp) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('First Contentful Paint (FCP)');
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#555')
        .text(`Value: ${results.fcp.displayValue || results.fcp.value || 'N/A'}`, { indent: 20 })
        .text(`Score: ${results.fcp.score}/100 (${getGrade(results.fcp.score)})`, { indent: 20 })
        .text(`Threshold: Good < 1.8s, Needs Improvement < 3s, Poor > 3s`, { indent: 20 });
      
      doc.moveDown(1);
    }

    doc.moveDown(1);
  }

  /**
   * Add Performance Metrics section
   */
  addPerformanceMetrics(doc, results) {
    checkPageBreakNeeded(doc, 250);
    addSectionHeader(doc, '📈 Additional Performance Metrics');

    const metrics = [
      { name: 'Speed Index', value: results.speedIndex?.displayValue, score: results.speedIndex?.score },
      { name: 'Time to Interactive', value: results.tti?.displayValue, score: results.tti?.score },
      { name: 'First Meaningful Paint', value: results.fmp?.displayValue, score: results.fmp?.score },
      { name: 'Max Potential FID', value: results.maxPotentialFID?.displayValue, score: results.maxPotentialFID?.score }
    ];

    metrics.forEach(metric => {
      if (metric.value || metric.score !== undefined) {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(metric.name, { continued: true })
          .font('Helvetica')
          .fillColor('#555')
          .text(`: ${metric.value || 'N/A'} (Score: ${metric.score || 0}/100)`);
        
        doc.moveDown(0.5);
      }
    });

    doc.moveDown(1);
  }

  /**
   * Add Resource Analysis section
   */
  addResourceAnalysis(doc, results) {
    checkPageBreakNeeded(doc, 300);
    addSectionHeader(doc, '📦 Resource Analysis');

    if (results.resources) {
      const resources = results.resources;
      
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Resource Breakdown:');
      
      doc.moveDown(0.5);

      // Scripts
      if (resources.scripts) {
        doc
          .font('Helvetica')
          .fillColor('#555')
          .text(`JavaScript Files: ${resources.scripts.count || 0} (${formatBytes(resources.scripts.size || 0)})`, { indent: 20 });
      }

      // Stylesheets
      if (resources.stylesheets) {
        doc.text(`CSS Files: ${resources.stylesheets.count || 0} (${formatBytes(resources.stylesheets.size || 0)})`, { indent: 20 });
      }

      // Images
      if (resources.images) {
        doc.text(`Images: ${resources.images.count || 0} (${formatBytes(resources.images.size || 0)})`, { indent: 20 });
      }

      // Fonts
      if (resources.fonts) {
        doc.text(`Fonts: ${resources.fonts.count || 0} (${formatBytes(resources.fonts.size || 0)})`, { indent: 20 });
      }

      // Total
      if (resources.total) {
        doc.moveDown(0.5);
        doc
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(`Total Resources: ${resources.total.count || 0} (${formatBytes(resources.total.size || 0)})`, { indent: 20 });
      }

      doc.moveDown(1);
    }

    // Render-blocking resources
    if (results.renderBlockingResources && results.renderBlockingResources.length > 0) {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#ff4444')
        .text('⚠️ Render-Blocking Resources:');
      
      doc.moveDown(0.5);

      results.renderBlockingResources.slice(0, 10).forEach(resource => {
        doc
          .font('Helvetica')
          .fillColor('#555')
          .text(`• ${resource.url || resource}`, { indent: 20 });
        doc.moveDown(0.3);
      });

      if (results.renderBlockingResources.length > 10) {
        doc
          .fillColor('#999')
          .text(`... and ${results.renderBlockingResources.length - 10} more`, { indent: 20 });
      }

      doc.moveDown(1);
    }
  }

  /**
   * Add Desktop vs Mobile Comparison
   */
  addDesktopMobileComparison(doc, results) {
    if (!results.desktop || !results.mobile) {
      return;
    }

    checkPageBreakNeeded(doc, 250);
    addSectionHeader(doc, '📱 Desktop vs Mobile Comparison');

    const metrics = [
      { name: 'Performance Score', desktop: results.desktop.performanceScore, mobile: results.mobile.performanceScore },
      { name: 'FCP', desktop: results.desktop.fcp?.displayValue, mobile: results.mobile.fcp?.displayValue },
      { name: 'LCP', desktop: results.desktop.lcp?.displayValue, mobile: results.mobile.lcp?.displayValue },
      { name: 'TBT', desktop: results.desktop.tbt?.displayValue, mobile: results.mobile.tbt?.displayValue },
      { name: 'CLS', desktop: results.desktop.cls?.displayValue, mobile: results.mobile.cls?.displayValue },
      { name: 'Speed Index', desktop: results.desktop.speedIndex?.displayValue, mobile: results.mobile.speedIndex?.displayValue }
    ];

    doc.fontSize(10).font('Helvetica');

    metrics.forEach(metric => {
      if (metric.desktop !== undefined || metric.mobile !== undefined) {
        doc
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(metric.name, 50, doc.y, { width: 150, continued: true })
          .font('Helvetica')
          .fillColor('#555')
          .text(`Desktop: ${metric.desktop || 'N/A'}`, { width: 150, continued: true })
          .text(`Mobile: ${metric.mobile || 'N/A'}`, { width: 150 });
        
        doc.moveDown(0.5);
      }
    });

    doc.moveDown(1);
  }

  /**
   * Add recommendations section
   */
  addRecommendations(doc, results) {
    if (!results.recommendations || results.recommendations.length === 0) {
      return;
    }

    checkPageBreakNeeded(doc, 200);
    addSectionHeader(doc, '💡 Performance Recommendations');

    // Group by priority
    const high = results.recommendations.filter(r => r.priority === 'high');
    const medium = results.recommendations.filter(r => r.priority === 'medium');
    const low = results.recommendations.filter(r => r.priority === 'low');

    // High Priority
    if (high.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ff4444')
        .text('🔴 HIGH PRIORITY');
      
      doc.moveDown(0.5);

      high.forEach((rec, index) => {
        checkPageBreakNeeded(doc, 80);
        
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(`${index + 1}. ${rec.title}`);
        
        doc
          .font('Helvetica')
          .fillColor('#555')
          .text(rec.description, { indent: 20 });
        
        if (rec.solution) {
          doc
            .fillColor('#666')
            .text(`Solution: ${rec.solution}`, { indent: 20 });
        }

        doc.moveDown(0.5);
      });

      doc.moveDown(1);
    }

    // Medium Priority
    if (medium.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ffa500')
        .text('🟡 MEDIUM PRIORITY');
      
      doc.moveDown(0.5);

      medium.forEach((rec, index) => {
        checkPageBreakNeeded(doc, 80);
        
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(`${index + 1}. ${rec.title}`);
        
        doc
          .font('Helvetica')
          .fillColor('#555')
          .text(rec.description, { indent: 20 });

        doc.moveDown(0.5);
      });

      doc.moveDown(1);
    }

    // Low Priority
    if (low.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#00ccff')
        .text('🔵 LOW PRIORITY');
      
      doc.moveDown(0.5);

      low.slice(0, 5).forEach((rec, index) => {
        checkPageBreakNeeded(doc, 60);
        
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(`${index + 1}. ${rec.title}`);
        
        doc
          .font('Helvetica')
          .fillColor('#555')
          .text(rec.description, { indent: 20 });

        doc.moveDown(0.5);
      });

      if (low.length > 5) {
        doc
          .fillColor('#999')
          .text(`... and ${low.length - 5} more low priority recommendations`);
      }
    }
  }

  // Helper methods removed - now using pdfHelpers and formatHelpers utilities
  // - addSectionHeader → pdfHelpers.addSectionHeader()
  // - checkPageBreak → pdfHelpers.checkPageBreakNeeded()
  // - getScoreColor → pdfHelpers.getScoreColor()
  // - getGrade → pdfHelpers.getGrade()
  // - formatBytes → formatHelpers.formatBytes()
}

// Export singleton
module.exports = new PerformancePdfGenerator();
