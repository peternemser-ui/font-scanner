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

const logger = createLogger('AccessibilityPdfGenerator');

/**
 * Accessibility PDF Report Generator
 * Creates professional PDF reports for Accessibility analysis results
 */
class AccessibilityPdfGenerator {
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
   * Generate comprehensive Accessibility PDF report
   */
  async generateReport(accessibilityResults) {
    // Use helper to initialize PDF generation
    const { doc, filepath, reportId, stream, filename } = initializePdfGeneration(
      accessibilityResults,
      'accessibility',
      { reportsDir: this.reportsDir }
    );

    try {
      // Use helper for header
      addPdfHeader(
        doc,
        '[ACCESSIBILITY_ANALYSIS_REPORT]',
        accessibilityResults.url,
        'comprehensive accessibility and WCAG compliance analysis'
      );

      // Generate report sections
      this.addExecutiveSummary(doc, accessibilityResults);
      this.addWCAGCompliance(doc, accessibilityResults);
      this.addViolationsBySeverity(doc, accessibilityResults);
      this.addColorContrastIssues(doc, accessibilityResults);
      this.addARIAAnalysis(doc, accessibilityResults);
      this.addDesktopMobileComparison(doc, accessibilityResults);
      this.addRecommendations(doc, accessibilityResults);

      // Use helper to finalize PDF generation
      return finalizePdfGeneration(doc, stream, filename, filepath, reportId);
    } catch (error) {
      logger.error('Error creating Accessibility PDF:', error);
      throw error;
    }
  }

  // addHeader removed - using pdfHelpers.addPdfHeader() instead

  /**
   * Add executive summary
   */
  addExecutiveSummary(doc, results) {
    checkPageBreakNeeded(doc, 250);
    addSectionHeader(doc, '♿ Executive Summary');

    const overallScore = results.overallScore || results.accessibilityScore || 0;
    const grade = getGrade(overallScore);
    const color = getScoreColor(overallScore);

    // Overall Score Box
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#333')
      .text('Overall Accessibility Score:', doc.x, doc.y);
    
    doc
      .fontSize(48)
      .fillColor(color)
      .text(overallScore.toString(), doc.x + 250, doc.y - 20);
    
    doc
      .fontSize(16)
      .fillColor(color)
      .text(grade, doc.x + 250, doc.y + 5);

    doc.moveDown(3);

    // WCAG Compliance Level
    if (results.wcagLevel) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('WCAG Compliance Level:', { continued: true })
        .font('Helvetica')
        .fillColor('#555')
        .text(` ${results.wcagLevel}`);
      
      doc.moveDown(0.5);
    }

    // Violation Summary
    if (results.violations) {
      const totalViolations = results.violations.critical + results.violations.serious + 
                             results.violations.moderate + results.violations.minor;
      
      doc
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Total Violations:', { continued: true })
        .font('Helvetica')
        .fillColor('#555')
        .text(` ${totalViolations}`);
      
      doc.moveDown(0.5);

      doc
        .font('Helvetica')
        .fillColor('#ff4444')
        .text(`• Critical: ${results.violations.critical}`, { indent: 20 });
      
      doc
        .fillColor('#ff8800')
        .text(`• Serious: ${results.violations.serious}`, { indent: 20 });
      
      doc
        .fillColor('#ffaa00')
        .text(`• Moderate: ${results.violations.moderate}`, { indent: 20 });
      
      doc
        .fillColor('#00ccff')
        .text(`• Minor: ${results.violations.minor}`, { indent: 20 });
    }

    doc.moveDown(1);
  }

  /**
   * Add WCAG Compliance section
   */
  addWCAGCompliance(doc, results) {
    checkPageBreakNeeded(doc, 300);
    addSectionHeader(doc, '✅ WCAG 2.1 Compliance');

    const wcagCategories = [
      { name: 'Perceivable', score: results.perceivableScore || 0, description: 'Content must be presentable to users in ways they can perceive' },
      { name: 'Operable', score: results.operableScore || 0, description: 'Interface components must be operable' },
      { name: 'Understandable', score: results.understandableScore || 0, description: 'Information and UI operation must be understandable' },
      { name: 'Robust', score: results.robustScore || 0, description: 'Content must be robust enough for assistive technologies' }
    ];

    wcagCategories.forEach(category => {
      const color = getScoreColor(category.score);
      const grade = getGrade(category.score);

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text(category.name, { continued: true })
        .font('Helvetica')
        .fillColor(color)
        .text(`: ${category.score}/100 (${grade})`);
      
      doc
        .fontSize(9)
        .fillColor('#666')
        .text(category.description, { indent: 20 });
      
      doc.moveDown(1);
    });

    doc.moveDown(1);
  }

  /**
   * Add Violations by Severity section
   */
  addViolationsBySeverity(doc, results) {
    if (!results.violationDetails || results.violationDetails.length === 0) {
      return;
    }

    checkPageBreakNeeded(doc, 200);
    addSectionHeader(doc, '🚨 Violations by Severity');

    // Group violations by severity
    const critical = results.violationDetails.filter(v => v.impact === 'critical');
    const serious = results.violationDetails.filter(v => v.impact === 'serious');
    const moderate = results.violationDetails.filter(v => v.impact === 'moderate');
    const minor = results.violationDetails.filter(v => v.impact === 'minor');

    // Critical Violations
    if (critical.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ff4444')
        .text('🔴 CRITICAL VIOLATIONS');
      
      doc.moveDown(0.5);

      critical.slice(0, 5).forEach((violation, index) => {
        checkPageBreakNeeded(doc, 100);
        
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(`${index + 1}. ${violation.description || violation.id}`);
        
        if (violation.help) {
          doc
            .font('Helvetica')
            .fillColor('#555')
            .text(`Issue: ${violation.help}`, { indent: 20 });
        }

        if (violation.wcagTags && violation.wcagTags.length > 0) {
          doc
            .fillColor('#666')
            .text(`WCAG: ${violation.wcagTags.join(', ')}`, { indent: 20 });
        }

        if (violation.nodes && violation.nodes.length > 0) {
          doc
            .fillColor('#999')
            .text(`Affected elements: ${violation.nodes.length}`, { indent: 20 });
        }

        doc.moveDown(0.5);
      });

      if (critical.length > 5) {
        doc
          .fillColor('#999')
          .text(`... and ${critical.length - 5} more critical violations`);
      }

      doc.moveDown(1);
    }

    // Serious Violations
    if (serious.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ff8800')
        .text('🟠 SERIOUS VIOLATIONS');
      
      doc.moveDown(0.5);

      serious.slice(0, 5).forEach((violation, index) => {
        checkPageBreakNeeded(doc, 80);
        
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(`${index + 1}. ${violation.description || violation.id}`);
        
        if (violation.help) {
          doc
            .font('Helvetica')
            .fillColor('#555')
            .text(`Issue: ${violation.help}`, { indent: 20 });
        }

        doc.moveDown(0.5);
      });

      if (serious.length > 5) {
        doc
          .fillColor('#999')
          .text(`... and ${serious.length - 5} more serious violations`);
      }

      doc.moveDown(1);
    }

    // Moderate Violations (summary only)
    if (moderate.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ffaa00')
        .text(`🟡 MODERATE VIOLATIONS: ${moderate.length} issues found`);
      
      doc.moveDown(1);
    }

    // Minor Violations (count only)
    if (minor.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#00ccff')
        .text(`🔵 MINOR VIOLATIONS: ${minor.length} issues found`);
      
      doc.moveDown(1);
    }
  }

  /**
   * Add Color Contrast Issues section
   */
  addColorContrastIssues(doc, results) {
    if (!results.colorContrast || results.colorContrast.passed) {
      return;
    }

    checkPageBreakNeeded(doc, 200);
    addSectionHeader(doc, '🎨 Color Contrast Issues');

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#555')
      .text('Color contrast issues detected that may affect users with visual impairments.');
    
    doc.moveDown(1);

    if (results.colorContrast.issues && results.colorContrast.issues.length > 0) {
      doc
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Identified Issues:');
      
      doc.moveDown(0.5);

      results.colorContrast.issues.slice(0, 10).forEach((issue, index) => {
        doc
          .font('Helvetica')
          .fillColor('#555')
          .text(`${index + 1}. ${issue.description || issue}`, { indent: 20 });
        
        if (issue.foreground && issue.background) {
          doc
            .fillColor('#666')
            .text(`Foreground: ${issue.foreground}, Background: ${issue.background}`, { indent: 40 });
        }

        if (issue.contrastRatio) {
          doc
            .fillColor('#999')
            .text(`Contrast ratio: ${issue.contrastRatio} (minimum: ${issue.requiredRatio || '4.5:1'})`, { indent: 40 });
        }

        doc.moveDown(0.5);
      });

      if (results.colorContrast.issues.length > 10) {
        doc
          .fillColor('#999')
          .text(`... and ${results.colorContrast.issues.length - 10} more contrast issues`);
      }
    }

    doc.moveDown(1);
  }

  /**
   * Add ARIA Analysis section
   */
  addARIAAnalysis(doc, results) {
    if (!results.aria) {
      return;
    }

    checkPageBreakNeeded(doc, 200);
    addSectionHeader(doc, '🔊 ARIA (Accessible Rich Internet Applications)');

    const aria = results.aria;

    if (aria.landmarks !== undefined) {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Landmarks:', { continued: true })
        .font('Helvetica')
        .fillColor('#555')
        .text(` ${aria.landmarks} regions identified`);
      
      doc.moveDown(0.5);
    }

    if (aria.labels !== undefined) {
      doc
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Labels:', { continued: true })
        .font('Helvetica')
        .fillColor('#555')
        .text(` ${aria.labels} properly labeled elements`);
      
      doc.moveDown(0.5);
    }

    if (aria.roles !== undefined) {
      doc
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Roles:', { continued: true })
        .font('Helvetica')
        .fillColor('#555')
        .text(` ${aria.roles} ARIA roles defined`);
      
      doc.moveDown(0.5);
    }

    if (aria.issues && aria.issues.length > 0) {
      doc.moveDown(0.5);
      doc
        .font('Helvetica-Bold')
        .fillColor('#ff8800')
        .text('ARIA Issues Found:');
      
      doc.moveDown(0.5);

      aria.issues.slice(0, 5).forEach(issue => {
        doc
          .font('Helvetica')
          .fillColor('#555')
          .text(`• ${issue}`, { indent: 20 });
        doc.moveDown(0.3);
      });

      if (aria.issues.length > 5) {
        doc
          .fillColor('#999')
          .text(`... and ${aria.issues.length - 5} more ARIA issues`, { indent: 20 });
      }
    }

    doc.moveDown(1);
  }

  /**
   * Add Desktop vs Mobile Comparison
   */
  addDesktopMobileComparison(doc, results) {
    if (!results.desktop || !results.mobile) {
      return;
    }

    checkPageBreakNeeded(doc, 200);
    addSectionHeader(doc, '📱 Desktop vs Mobile Accessibility');

    const metrics = [
      { name: 'Accessibility Score', desktop: results.desktop.accessibilityScore, mobile: results.mobile.accessibilityScore },
      { name: 'Critical Violations', desktop: results.desktop.violations?.critical, mobile: results.mobile.violations?.critical },
      { name: 'Serious Violations', desktop: results.desktop.violations?.serious, mobile: results.mobile.violations?.serious },
      { name: 'WCAG Level', desktop: results.desktop.wcagLevel, mobile: results.mobile.wcagLevel }
    ];

    doc.fontSize(10).font('Helvetica');

    metrics.forEach(metric => {
      if (metric.desktop !== undefined || metric.mobile !== undefined) {
        doc
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(metric.name, 50, doc.y, { width: 180, continued: true })
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
    addSectionHeader(doc, '💡 Accessibility Recommendations');

    // Group by priority
    const critical = results.recommendations.filter(r => r.priority === 'critical');
    const important = results.recommendations.filter(r => r.priority === 'important');
    const minor = results.recommendations.filter(r => r.priority === 'minor');

    // Critical Priority
    if (critical.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ff4444')
        .text('🔴 CRITICAL - Fix Immediately');
      
      doc.moveDown(0.5);

      critical.forEach((rec, index) => {
        checkPageBreakNeeded(doc, 100);
        
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

        if (rec.wcagReference) {
          doc
            .fillColor('#999')
            .text(`WCAG: ${rec.wcagReference}`, { indent: 20 });
        }

        doc.moveDown(0.5);
      });

      doc.moveDown(1);
    }

    // Important Priority
    if (important.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ff8800')
        .text('🟠 IMPORTANT - Address Soon');
      
      doc.moveDown(0.5);

      important.slice(0, 5).forEach((rec, index) => {
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

      if (important.length > 5) {
        doc
          .fillColor('#999')
          .text(`... and ${important.length - 5} more important recommendations`);
      }

      doc.moveDown(1);
    }

    // Minor Priority
    if (minor.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#00ccff')
        .text(`🔵 MINOR - Enhance When Possible: ${minor.length} recommendations`);
      
      doc.moveDown(1);
    }
  }

  // Helper methods removed - now using pdfHelpers utilities
  // - addSectionHeader → pdfHelpers.addSectionHeader()
  // - checkPageBreak → pdfHelpers.checkPageBreakNeeded()
  // - getScoreColor → pdfHelpers.getScoreColor()
  // - getGrade → pdfHelpers.getGrade()
}

// Export singleton
module.exports = new AccessibilityPdfGenerator();
