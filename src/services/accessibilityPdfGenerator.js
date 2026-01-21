const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { resolveReportId } = require('../utils/resolveReportId');
const {
  initializePdfGeneration,
  finalizePdfGeneration,
  addPdfHeader,
  addMaterialSectionHeader,
  checkPageBreakNeeded,
  ensureFreshPage,
  heightCalculators,
  getScoreColor,
  getGrade,
  drawScoreSummaryCard,
  drawMetricGrid,
  drawCard
} = require('../utils/pdfHelpers');

const {
  COLORS,
  drawGaugeChart,
  drawBarChart,
  drawPieChart,
  drawComparisonChart,
  drawProgressBar
} = require('../utils/pdfCharts');

const logger = createLogger('AccessibilityPdfGenerator');

/**
 * Accessibility PDF Report Generator - Material Design Edition
 * Creates professional, visually-rich PDF reports for Accessibility analysis
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
   * Generate comprehensive Accessibility PDF report with Material Design
   */
  async generateReport(accessibilityResults) {
    // Use helper to initialize PDF generation
    const { doc, filepath, reportId, stream, filename } = initializePdfGeneration(
      accessibilityResults,
      'accessibility',
      { reportsDir: this.reportsDir }
    );

    try {
      // Material Design header
      addPdfHeader(
        doc,
        'Accessibility Analysis Report',
        accessibilityResults.url,
        'Comprehensive accessibility and WCAG compliance analysis',
        { accentColor: COLORS.secondary } // Teal accent for accessibility
      );

      // Generate report sections with Material Design and charts
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

  /**
   * Executive Summary with Material Design and Charts
   */
  addExecutiveSummary(doc, results) {
    addMaterialSectionHeader(doc, 'Executive Summary', {
      description: 'Overall accessibility score and WCAG compliance',
      accentColor: COLORS.secondary
    });

    const overallScore = results.overallScore || results.accessibilityScore || 0;

    // Component scores for breakdown
    const breakdown = {
      'Perceivable': results.perceivableScore || 0,
      'Operable': results.operableScore || 0,
      'Understandable': results.understandableScore || 0,
      'Robust': results.robustScore || 0
    };

    // Score summary card with gauge chart
    const cardHeight = drawScoreSummaryCard(
      doc,
      overallScore,
      'Accessibility Score',
      breakdown,
      50,
      doc.y
    );

    doc.y += cardHeight;
    doc.moveDown(0.5);

    // WCAG Level Badge
    if (results.wcagLevel) {
      checkPageBreakNeeded(doc, 80);

      const levelColor = results.wcagLevel.includes('AAA') ? COLORS.success :
                        results.wcagLevel.includes('AA') ? COLORS.good :
                        COLORS.warning;

      drawCard(doc, 50, doc.y, 200, 60, {
        backgroundColor: results.wcagLevel.includes('AAA') ? '#E8F5E9' :
                        results.wcagLevel.includes('AA') ? '#F1F8E9' :
                        '#FFF3E0',
        borderColor: levelColor
      });

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text('WCAG Compliance', 70, doc.y + 12);

      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor(levelColor)
         .text(results.wcagLevel, 70, doc.y + 8);

      doc.y += 70;
    }

    // Violation distribution pie chart
    if (results.violations) {
      const violations = results.violations;
      const hasCritical = violations.critical > 0;
      const hasSerious = violations.serious > 0;
      const hasModerate = violations.moderate > 0;
      const hasMinor = violations.minor > 0;
      const hasViolations = hasCritical || hasSerious || hasModerate || hasMinor;

      if (hasViolations) {
        checkPageBreakNeeded(doc, 250);

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text('Violation Distribution', 50, doc.y);

        doc.moveDown(0.5);

        const pieData = [];
        if (violations.critical > 0) {
          pieData.push({
            label: 'Critical',
            value: violations.critical,
            color: COLORS.critical
          });
        }
        if (violations.serious > 0) {
          pieData.push({
            label: 'Serious',
            value: violations.serious,
            color: COLORS.poor
          });
        }
        if (violations.moderate > 0) {
          pieData.push({
            label: 'Moderate',
            value: violations.moderate,
            color: COLORS.warning
          });
        }
        if (violations.minor > 0) {
          pieData.push({
            label: 'Minor',
            value: violations.minor,
            color: COLORS.info
          });
        }

        if (pieData.length > 0) {
          const totalViolations = pieData.reduce((sum, item) => sum + item.value, 0);

          const pieHeight = drawPieChart(
            doc,
            pieData,
            200,
            doc.y + 100,
            {
              radius: 70,
              donutWidth: 25,
              showLegend: true,
              showPercentages: true,
              centerText: totalViolations.toString(),
              centerLabel: 'Total'
            }
          );

          doc.y += pieHeight + 20;
        }
      } else {
        // No violations found
        drawCard(doc, 50, doc.y, 512, 60, {
          backgroundColor: '#E8F5E9',
          borderColor: COLORS.success
        });

        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(COLORS.success)
           .text('✓ No accessibility violations detected', 70, doc.y + 20);

        doc.y += 70;
      }
    }

    // Key metrics grid
    const metrics = [
      {
        label: 'Perceivable',
        value: `${breakdown.Perceivable}/100`,
        color: getScoreColor(breakdown.Perceivable)
      },
      {
        label: 'Operable',
        value: `${breakdown.Operable}/100`,
        color: getScoreColor(breakdown.Operable)
      },
      {
        label: 'Understandable',
        value: `${breakdown.Understandable}/100`,
        color: getScoreColor(breakdown.Understandable)
      },
      {
        label: 'Robust',
        value: `${breakdown.Robust}/100`,
        color: getScoreColor(breakdown.Robust)
      }
    ];

    checkPageBreakNeeded(doc, 120);

    const gridHeight = drawMetricGrid(doc, metrics, 50, doc.y, {
      columns: 4,
      spacing: 15
    });

    doc.y += gridHeight + 20;
    doc.moveDown(1);
  }

  /**
   * WCAG Compliance with Multiple Gauge Charts
   */
  addWCAGCompliance(doc, results) {
    // 4 gauge charts in 2x2 grid need ~500px - start new page if past halfway
    if (doc.y > 300) {
      doc.addPage();
    }
    addMaterialSectionHeader(doc, 'WCAG 2.1 Compliance', {
      description: 'Web Content Accessibility Guidelines assessment',
      accentColor: COLORS.secondary
    });

    const wcagCategories = [
      {
        name: 'Perceivable',
        score: results.perceivableScore || 0,
        description: 'Content must be presentable to users'
      },
      {
        name: 'Operable',
        score: results.operableScore || 0,
        description: 'Interface components must be operable'
      },
      {
        name: 'Understandable',
        score: results.understandableScore || 0,
        description: 'Information must be understandable'
      },
      {
        name: 'Robust',
        score: results.robustScore || 0,
        description: 'Compatible with assistive technologies'
      }
    ];

    // Draw 4 gauge charts (2x2 grid)
    const gaugeStartY = doc.y;
    const gaugeSpacing = 250;
    const rowSpacing = 200;

    // Row 1: Perceivable and Operable
    drawGaugeChart(doc, wcagCategories[0].score, wcagCategories[0].name, 150, gaugeStartY + 80, {
      radius: 60,
      width: 12,
      showValue: true,
      showLabel: true
    });

    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(COLORS.textSecondary)
       .text(wcagCategories[0].description, 90, gaugeStartY + 170, {
         width: 120,
         align: 'center'
       });

    drawGaugeChart(doc, wcagCategories[1].score, wcagCategories[1].name, 400, gaugeStartY + 80, {
      radius: 60,
      width: 12,
      showValue: true,
      showLabel: true
    });

    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(COLORS.textSecondary)
       .text(wcagCategories[1].description, 340, gaugeStartY + 170, {
         width: 120,
         align: 'center'
       });

    // Row 2: Understandable and Robust
    const secondRowY = gaugeStartY + rowSpacing;

    drawGaugeChart(doc, wcagCategories[2].score, wcagCategories[2].name, 150, secondRowY + 80, {
      radius: 60,
      width: 12,
      showValue: true,
      showLabel: true
    });

    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(COLORS.textSecondary)
       .text(wcagCategories[2].description, 90, secondRowY + 170, {
         width: 120,
         align: 'center'
       });

    drawGaugeChart(doc, wcagCategories[3].score, wcagCategories[3].name, 400, secondRowY + 80, {
      radius: 60,
      width: 12,
      showValue: true,
      showLabel: true
    });

    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(COLORS.textSecondary)
       .text(wcagCategories[3].description, 340, secondRowY + 170, {
         width: 120,
         align: 'center'
       });

    doc.y = secondRowY + 220;
    doc.moveDown(1);

    // Bar chart comparing all 4 categories
    checkPageBreakNeeded(doc, 200);

    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('WCAG Principle Comparison', 50, doc.y);

    doc.moveDown(0.5);

    const chartData = wcagCategories.map(cat => ({
      label: cat.name,
      value: cat.score
    }));

    const chartHeight = drawBarChart(
      doc,
      chartData,
      50,
      doc.y,
      {
        width: 512,
        barHeight: 30,
        showValues: true,
        colorScheme: 'score'
      }
    );

    doc.y += chartHeight + 10;
    doc.moveDown(1);
  }

  /**
   * Violations by Severity with Donut Chart
   */
  addViolationsBySeverity(doc, results) {
    if (!results.violationDetails || results.violationDetails.length === 0) {
      return;
    }

    checkPageBreakNeeded(doc, 400);
    addMaterialSectionHeader(doc, 'Violations by Severity', {
      description: 'Identified accessibility issues grouped by impact',
      accentColor: COLORS.error
    });

    // Group violations by severity
    const critical = results.violationDetails.filter(v => v.impact === 'critical');
    const serious = results.violationDetails.filter(v => v.impact === 'serious');
    const moderate = results.violationDetails.filter(v => v.impact === 'moderate');
    const minor = results.violationDetails.filter(v => v.impact === 'minor');

    // Donut chart for severity distribution
    const hasCritical = critical.length > 0;
    const hasSerious = serious.length > 0;
    const hasModerate = moderate.length > 0;
    const hasMinor = minor.length > 0;

    if (hasCritical || hasSerious || hasModerate || hasMinor) {
      const pieData = [];
      if (critical.length > 0) {
        pieData.push({ label: 'Critical', value: critical.length, color: COLORS.critical });
      }
      if (serious.length > 0) {
        pieData.push({ label: 'Serious', value: serious.length, color: COLORS.poor });
      }
      if (moderate.length > 0) {
        pieData.push({ label: 'Moderate', value: moderate.length, color: COLORS.warning });
      }
      if (minor.length > 0) {
        pieData.push({ label: 'Minor', value: minor.length, color: COLORS.info });
      }

      const totalViolations = pieData.reduce((sum, item) => sum + item.value, 0);

      const pieHeight = drawPieChart(
        doc,
        pieData,
        200,
        doc.y + 100,
        {
          radius: 70,
          donutWidth: 25,
          showLegend: true,
          showPercentages: true,
          centerText: totalViolations.toString(),
          centerLabel: 'Issues'
        }
      );

      doc.y += pieHeight + 30;
    }

    // Critical Violations (detailed cards)
    if (critical.length > 0) {
      checkPageBreakNeeded(doc, 150);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.critical)
         .text(`🔴 Critical Violations (${critical.length})`, 50, doc.y);

      doc.moveDown(0.5);

      critical.slice(0, 5).forEach((violation, index) => {
        checkPageBreakNeeded(doc, 110);

        drawCard(doc, 50, doc.y, 512, 95, {
          backgroundColor: '#FFEBEE',
          borderColor: COLORS.critical
        });

        // Impact badge
        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(COLORS.critical)
           .text('CRITICAL', 70, doc.y + 15);

        // Description
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(
             `${index + 1}. ${violation.description || violation.id}`,
             140,
             doc.y - 1,
             { width: 375 }
           );

        // Help text
        if (violation.help) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(violation.help, 70, doc.y + 8, { width: 445 });
        }

        // WCAG tags
        if (violation.wcagTags && violation.wcagTags.length > 0) {
          doc.fontSize(8)
             .fillColor(COLORS.textDisabled)
             .text(`WCAG: ${violation.wcagTags.join(', ')}`, 70, doc.y + 3);
        }

        // Affected elements
        if (violation.nodes && violation.nodes.length > 0) {
          doc.fontSize(8)
             .fillColor(COLORS.info)
             .text(`${violation.nodes.length} affected elements`, 70, doc.y + 3);
        }

        doc.y += 105;
      });

      if (critical.length > 5) {
        doc.fontSize(9)
           .fillColor(COLORS.textSecondary)
           .text(`... and ${critical.length - 5} more critical violations`, 50, doc.y);
      }

      doc.moveDown(1);
    }

    // Serious Violations (cards)
    if (serious.length > 0) {
      checkPageBreakNeeded(doc, 150);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.poor)
         .text(`🟠 Serious Violations (${serious.length})`, 50, doc.y);

      doc.moveDown(0.5);

      serious.slice(0, 5).forEach((violation, index) => {
        checkPageBreakNeeded(doc, 90);

        drawCard(doc, 50, doc.y, 512, 75, {
          backgroundColor: '#FFF3E0',
          borderColor: COLORS.warning
        });

        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(COLORS.poor)
           .text('SERIOUS', 70, doc.y + 12);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(
             `${index + 1}. ${violation.description || violation.id}`,
             130,
             doc.y - 2,
             { width: 385 }
           );

        if (violation.help) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(violation.help.substring(0, 100) + (violation.help.length > 100 ? '...' : ''), 70, doc.y + 5, { width: 445 });
        }

        if (violation.nodes && violation.nodes.length > 0) {
          doc.fontSize(8)
             .fillColor(COLORS.info)
             .text(`${violation.nodes.length} affected elements`, 70, doc.y + 3);
        }

        doc.y += 85;
      });

      if (serious.length > 5) {
        doc.fontSize(9)
           .fillColor(COLORS.textSecondary)
           .text(`... and ${serious.length - 5} more serious violations`, 50, doc.y);
      }

      doc.moveDown(1);
    }

    // Moderate Violations (summary card)
    if (moderate.length > 0) {
      checkPageBreakNeeded(doc, 60);

      drawCard(doc, 50, doc.y, 512, 50, {
        backgroundColor: '#FFF3E0',
        borderColor: COLORS.warning
      });

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.warning)
         .text(`🟡 Moderate Violations: ${moderate.length} issues found`, 70, doc.y + 18);

      doc.y += 60;
    }

    // Minor Violations (count only)
    if (minor.length > 0) {
      checkPageBreakNeeded(doc, 60);

      drawCard(doc, 50, doc.y, 512, 50, {
        backgroundColor: '#E3F2FD',
        borderColor: COLORS.info
      });

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.info)
         .text(`🔵 Minor Violations: ${minor.length} issues found`, 70, doc.y + 18);

      doc.y += 60;
    }
  }

  /**
   * Color Contrast Issues with Progress Bar
   */
  addColorContrastIssues(doc, results) {
    if (!results.colorContrast) {
      return;
    }

    checkPageBreakNeeded(doc, 350);
    addMaterialSectionHeader(doc, 'Color Contrast Analysis', {
      description: 'WCAG color contrast requirements assessment'
    });

    const contrast = results.colorContrast;

    // Summary card
    const passed = contrast.passed || (contrast.issues && contrast.issues.length === 0);

    drawCard(doc, 50, doc.y, 512, 70, {
      backgroundColor: passed ? '#E8F5E9' : '#FFF3E0',
      borderColor: passed ? COLORS.success : COLORS.warning
    });

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(passed ? COLORS.success : COLORS.warning)
       .text(
         passed ? '✓ All Color Contrasts Pass' : '⚠️ Color Contrast Issues Detected',
         70,
         doc.y + 15
       );

    if (!passed && contrast.issues) {
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(
           `${contrast.issues.length} elements fail WCAG contrast requirements`,
           70,
           doc.y + 12
         );
    }

    doc.y += 80;

    // Detailed contrast issues
    if (contrast.issues && contrast.issues.length > 0) {
      doc.moveDown(0.5);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Contrast Failures', 50, doc.y);

      doc.moveDown(0.5);

      contrast.issues.slice(0, 10).forEach((issue, index) => {
        checkPageBreakNeeded(doc, 100);

        drawCard(doc, 50, doc.y, 512, 85);

        // Issue number
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textSecondary)
           .text(`#${index + 1}`, 70, doc.y + 15);

        // Description
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(COLORS.textPrimary)
           .text(issue.description || 'Contrast issue', 100, doc.y - 1, { width: 415 });

        // Color swatches and ratios
        if (issue.foreground && issue.background) {
          // Foreground swatch
          doc.rect(70, doc.y + 10, 30, 20)
             .fillColor(issue.foreground)
             .fill()
             .strokeColor(COLORS.divider)
             .stroke();

          doc.fontSize(8)
             .fillColor(COLORS.textSecondary)
             .text('FG', 72, doc.y + 13);

          // Background swatch
          doc.rect(110, doc.y - 10, 30, 20)
             .fillColor(issue.background)
             .fill()
             .strokeColor(COLORS.divider)
             .stroke();

          doc.fontSize(8)
             .fillColor(COLORS.textSecondary)
             .text('BG', 112, doc.y + 3);

          // Contrast ratio
          if (issue.contrastRatio) {
            doc.fontSize(9)
               .font('Helvetica')
               .fillColor(COLORS.textSecondary)
               .text(
                 `Ratio: ${issue.contrastRatio} (Required: ${issue.requiredRatio || '4.5:1'})`,
                 155,
                 doc.y - 3,
                 { width: 300 }
               );
          }

          // Status
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.error)
             .text('✗ FAIL', 455, doc.y + 1);
        }

        doc.y += 95;
      });

      if (contrast.issues.length > 10) {
        doc.fontSize(9)
           .fillColor(COLORS.textSecondary)
           .text(`... and ${contrast.issues.length - 10} more contrast issues`, 50, doc.y);
      }
    }

    doc.moveDown(1);
  }

  /**
   * ARIA Analysis with Metric Cards
   */
  addARIAAnalysis(doc, results) {
    if (!results.aria) {
      return;
    }

    checkPageBreakNeeded(doc, 250);
    addMaterialSectionHeader(doc, 'ARIA Analysis', {
      description: 'Accessible Rich Internet Applications implementation'
    });

    const aria = results.aria;

    // Metric cards for ARIA elements
    const metrics = [];

    if (aria.landmarks !== undefined) {
      metrics.push({
        label: 'Landmarks',
        value: aria.landmarks.toString(),
        color: aria.landmarks > 0 ? COLORS.success : COLORS.warning,
        sublabel: 'ARIA regions'
      });
    }

    if (aria.labels !== undefined) {
      metrics.push({
        label: 'Labels',
        value: aria.labels.toString(),
        color: aria.labels > 0 ? COLORS.success : COLORS.warning,
        sublabel: 'Labeled elements'
      });
    }

    if (aria.roles !== undefined) {
      metrics.push({
        label: 'Roles',
        value: aria.roles.toString(),
        color: aria.roles > 0 ? COLORS.success : COLORS.warning,
        sublabel: 'ARIA roles'
      });
    }

    if (metrics.length > 0) {
      const gridHeight = drawMetricGrid(doc, metrics, 50, doc.y, {
        columns: 3,
        spacing: 20
      });

      doc.y += gridHeight + 20;
    }

    // ARIA Issues
    if (aria.issues && aria.issues.length > 0) {
      checkPageBreakNeeded(doc, 150);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.warning)
         .text(`⚠️ ARIA Issues (${aria.issues.length})`, 50, doc.y);

      doc.moveDown(0.5);

      aria.issues.slice(0, 5).forEach((issue, index) => {
        checkPageBreakNeeded(doc, 60);

        drawCard(doc, 50, doc.y, 512, 50, {
          backgroundColor: '#FFF3E0',
          borderColor: COLORS.warning
        });

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLORS.textSecondary)
           .text(`${index + 1}. ${issue}`, 70, doc.y + 18, { width: 445 });

        doc.y += 60;
      });

      if (aria.issues.length > 5) {
        doc.fontSize(9)
           .fillColor(COLORS.textSecondary)
           .text(`... and ${aria.issues.length - 5} more ARIA issues`, 50, doc.y);
      }
    }

    doc.moveDown(1);
  }

  /**
   * Desktop vs Mobile Comparison with Charts
   */
  addDesktopMobileComparison(doc, results) {
    if (!results.desktop || !results.mobile) {
      return;
    }

    // Gauge charts + comparison chart need significant space (~450px)
    // If we're past halfway down the page, start fresh
    if (doc.y > 350) {
      doc.addPage();
    }
    addMaterialSectionHeader(doc, 'Desktop vs Mobile Accessibility', {
      description: 'Accessibility metrics across device types'
    });

    // Dual gauge charts
    const desktopScore = results.desktop.accessibilityScore || results.desktop.overallScore || 0;
    const mobileScore = results.mobile.accessibilityScore || results.mobile.overallScore || 0;

    // Desktop gauge
    drawGaugeChart(doc, desktopScore, 'Desktop', 150, doc.y + 80, {
      radius: 60,
      width: 12,
      showValue: true,
      showLabel: true
    });

    // Mobile gauge
    drawGaugeChart(doc, mobileScore, 'Mobile', 400, doc.y - 80, {
      radius: 60,
      width: 12,
      showValue: true,
      showLabel: true
    });

    doc.y += 100;
    doc.moveDown(1);

    // Comparison chart for WCAG principles
    const metrics = [
      {
        label: 'Overall Score',
        value1: desktopScore,
        value2: mobileScore
      },
      {
        label: 'Perceivable',
        value1: results.desktop.perceivableScore || 0,
        value2: results.mobile.perceivableScore || 0
      },
      {
        label: 'Operable',
        value1: results.desktop.operableScore || 0,
        value2: results.mobile.operableScore || 0
      },
      {
        label: 'Understandable',
        value1: results.desktop.understandableScore || 0,
        value2: results.mobile.understandableScore || 0
      },
      {
        label: 'Robust',
        value1: results.desktop.robustScore || 0,
        value2: results.mobile.robustScore || 0
      }
    ];

    checkPageBreakNeeded(doc, 250);

    const comparisonHeight = drawComparisonChart(
      doc,
      metrics,
      50,
      doc.y,
      {
        width: 512,
        height: 200,
        labels: ['Desktop', 'Mobile'],
        colors: [COLORS.primary, COLORS.secondary]
      }
    );

    doc.y += comparisonHeight + 10;

    // Violation comparison
    const desktopCritical = results.desktop.violations?.critical || 0;
    const mobileCritical = results.mobile.violations?.critical || 0;

    if (desktopCritical > 0 || mobileCritical > 0) {
      doc.moveDown(0.5);

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Critical Violations:', 50, doc.y);

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(COLORS.error)
         .text(`Desktop: ${desktopCritical} | Mobile: ${mobileCritical}`, 180, doc.y - 1);
    }

    doc.moveDown(1);
  }

  /**
   * Recommendations with Priority Cards - Full content with fixes
   */
  addRecommendations(doc, results) {
    if (!results.recommendations || results.recommendations.length === 0) {
      return;
    }

    // Start recommendations on new page for clean layout
    doc.addPage();
    addMaterialSectionHeader(doc, 'Accessibility Recommendations', {
      description: 'Prioritized actions to improve accessibility'
    });

    // Group by priority - show all recommendations
    const critical = results.recommendations.filter(r => r.priority === 'critical');
    const important = results.recommendations.filter(r => r.priority === 'important');
    const minor = results.recommendations.filter(r => r.priority === 'minor');

    // Critical Priority
    if (critical.length > 0) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.critical)
         .text('🔴 Critical - Fix Immediately', 50, doc.y);

      doc.moveDown(0.5);

      critical.forEach((rec, index) => {
        // Calculate card height based on content
        const descLines = Math.ceil((rec.description || '').length / 60);
        const solutionLines = rec.solution ? Math.ceil(rec.solution.length / 60) : 0;
        const cardHeight = 55 + (descLines * 12) + (solutionLines * 12) + (rec.wcagReference ? 15 : 0) + (rec.fix ? 25 : 0);
        
        checkPageBreakNeeded(doc, cardHeight + 20);

        drawCard(doc, 50, doc.y, 512, cardHeight, {
          backgroundColor: '#FFEBEE',
          borderColor: COLORS.critical
        });

        const cardStartY = doc.y;

        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(COLORS.critical)
           .text('CRITICAL', 70, cardStartY + 12);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(`${index + 1}. ${rec.title}`, 140, cardStartY + 10, { width: 375 });

        let currentY = cardStartY + 28;

        // Full Description
        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 70, currentY, { width: 445 });
          currentY = doc.y + 6;
        }

        // Full Solution
        if (rec.solution) {
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.info)
             .text('Solution:', 70, currentY);
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.info)
             .text(rec.solution, 120, currentY, { width: 395 });
          currentY = doc.y + 6;
        }

        // Fix/How to fix
        if (rec.fix) {
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.success)
             .text('How to Fix:', 70, currentY);
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.success)
             .text(rec.fix, 130, currentY, { width: 385 });
          currentY = doc.y + 6;
        }

        // WCAG Reference
        if (rec.wcagReference) {
          doc.fontSize(8)
             .fillColor(COLORS.textDisabled)
             .text(`WCAG: ${rec.wcagReference}`, 70, currentY);
        }

        doc.y = cardStartY + cardHeight + 10;
      });

      doc.moveDown(1);
    }

    // Important Priority
    if (important.length > 0) {
      checkPageBreakNeeded(doc, 120);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.poor)
         .text('🟠 Important - Address Soon', 50, doc.y);

      doc.moveDown(0.5);

      important.forEach((rec, index) => {
        const descLines = Math.ceil((rec.description || '').length / 60);
        const solutionLines = rec.solution ? Math.ceil(rec.solution.length / 60) : 0;
        const cardHeight = 50 + (descLines * 12) + (solutionLines * 12) + (rec.fix ? 25 : 0);

        checkPageBreakNeeded(doc, cardHeight + 15);

        drawCard(doc, 50, doc.y, 512, cardHeight, {
          backgroundColor: '#FFF3E0',
          borderColor: COLORS.warning
        });

        const cardStartY = doc.y;

        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(COLORS.poor)
           .text('IMPORTANT', 70, cardStartY + 10);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(`${index + 1}. ${rec.title}`, 150, cardStartY + 8, { width: 365 });

        let currentY = cardStartY + 25;

        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 70, currentY, { width: 445 });
          currentY = doc.y + 5;
        }

        if (rec.solution) {
          doc.fontSize(8)
             .fillColor(COLORS.info)
             .text(`Solution: ${rec.solution}`, 70, currentY, { width: 445 });
          currentY = doc.y + 5;
        }

        if (rec.fix) {
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.success)
             .text('Fix:', 70, currentY);
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.success)
             .text(rec.fix, 95, currentY, { width: 420 });
        }

        doc.y = cardStartY + cardHeight + 8;
      });

      doc.moveDown(1);
    }

    // Minor Priority - Show details instead of just summary
    if (minor.length > 0) {
      checkPageBreakNeeded(doc, 100);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.info)
         .text('🔵 Minor - Enhance When Possible', 50, doc.y);

      doc.moveDown(0.5);

      minor.forEach((rec, index) => {
        const descLines = Math.ceil((rec.description || '').length / 70);
        const neededSpace = 35 + (descLines * 12) + (rec.solution ? 18 : 0);
        
        checkPageBreakNeeded(doc, neededSpace);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(`${index + 1}. ${rec.title}`, 70, doc.y);

        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 80, doc.y + 3, { width: 445 });
        }

        if (rec.solution) {
          doc.fontSize(8)
             .fillColor(COLORS.info)
             .text(`→ ${rec.solution}`, 85, doc.y + 3, { width: 440 });
        }

        doc.moveDown(0.8);
      });
    }
  }
}

// Export singleton
module.exports = new AccessibilityPdfGenerator();
