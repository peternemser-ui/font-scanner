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
  getScoreColor,
  getGrade,
  drawScoreSummaryCard,
  drawMetricGrid,
  COLORS
} = require('../utils/pdfHelpers');

const {
  drawBarChart,
  drawPieChart,
  drawProgressBar
} = require('../utils/pdfCharts');

const logger = createLogger('TagIntelligencePdfGenerator');

/**
 * Tag Intelligence PDF Report Generator (Material Design)
 * Creates professional PDF reports for tracking & analytics tag analysis
 */
class TagIntelligencePdfGenerator {
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
   * Generate comprehensive Tag Intelligence PDF report
   */
  async generateReport(tagResults) {
    const { doc, filepath, reportId, stream, filename } = initializePdfGeneration(
      tagResults,
      'tag-intelligence',
      { reportsDir: this.reportsDir }
    );

    try {
      // Material Design header
      addPdfHeader(
        doc,
        'Tracking & Analytics Report',
        tagResults.url,
        'Comprehensive tag detection and compliance analysis'
      );

      // Generate report sections with Material Design
      this.addExecutiveSummary(doc, tagResults);
      this.addTagsByCategory(doc, tagResults);
      this.addTagsDetailed(doc, tagResults.tags);
      this.addIssuesAndDuplicates(doc, tagResults);
      this.addPerformanceImpact(doc, tagResults);
      this.addConsentCompliance(doc, tagResults);
      this.addRecommendations(doc, tagResults.recommendations);

      return finalizePdfGeneration(doc, stream, filename, filepath, reportId);
    } catch (error) {
      logger.error('Error creating Tag Intelligence PDF:', error);
      throw error;
    }
  }

  /**
   * Add executive summary with gauge chart and category breakdown
   */
  addExecutiveSummary(doc, results) {
    addMaterialSectionHeader(doc, 'Executive Summary', {
      description: 'Overall tag health score and key metrics'
    });

    const score = results.healthScore || 0;

    // Build breakdown from category counts
    const breakdown = {};
    if (results.summary?.byCategory) {
      Object.entries(results.summary.byCategory).forEach(([cat, count]) => {
        const label = this.formatCategoryLabel(cat);
        breakdown[label] = Math.min(100, count * 25); // Scale for visual representation
      });
    }

    // Score summary card with gauge chart
    const currentY = doc.y;
    drawScoreSummaryCard(doc, score, 'Tag Health Score', breakdown, 50, currentY);

    doc.moveDown(2);

    // Key metrics grid
    checkPageBreakNeeded(doc, 150);

    const metrics = [
      {
        label: 'Total Tags',
        value: results.summary?.totalTags?.toString() || '0',
        color: COLORS.primary
      },
      {
        label: 'Pages Scanned',
        value: results.pagesScanned?.toString() || '1',
        color: COLORS.info
      },
      {
        label: 'Issues Found',
        value: results.summary?.issueCount?.toString() || '0',
        color: results.summary?.issueCount > 0 ? COLORS.warning : COLORS.success
      },
      {
        label: 'Duplicates',
        value: results.summary?.duplicateCount?.toString() || '0',
        color: results.summary?.duplicateCount > 0 ? COLORS.error : COLORS.success
      }
    ];

    const gridHeight = drawMetricGrid(doc, metrics, 50, doc.y, {
      columns: 4,
      spacing: 10
    });

    doc.y += gridHeight + 20;
    doc.moveDown(2);
  }

  /**
   * Add tags by category with pie chart
   */
  addTagsByCategory(doc, results) {
    checkPageBreakNeeded(doc, 300);
    addMaterialSectionHeader(doc, 'Tags by Category', {
      description: 'Distribution of detected tracking and analytics tags'
    });

    if (!results.summary?.byCategory || Object.keys(results.summary.byCategory).length === 0) {
      doc.fontSize(10)
         .fillColor(COLORS.textDisabled)
         .text('No tags detected', 60, doc.y);
      return;
    }

    const categoryColors = {
      analytics: COLORS.primary,
      advertising: '#f59e0b',
      tag_manager: '#8b5cf6',
      consent: COLORS.success,
      customer_support: '#ec4899',
      marketing: '#ef4444',
      ab_testing: '#8b5cf6',
      session_recording: '#ec4899',
      error_monitoring: '#f97316',
      cdp: '#14b8a6',
      other: COLORS.textSecondary
    };

    // Pie chart for category distribution
    const pieData = Object.entries(results.summary.byCategory).map(([cat, count]) => ({
      label: this.formatCategoryLabel(cat),
      value: count,
      color: categoryColors[cat] || COLORS.textSecondary
    }));

    if (pieData.length > 0) {
      const chartHeight = drawPieChart(doc, pieData, 150, doc.y + 80, {
        radius: 60,
        donutWidth: 20,
        showLegend: true,
        showPercentages: true
      });

      doc.y += chartHeight + 30;
    }

    // Category breakdown as bar chart
    checkPageBreakNeeded(doc, 200);

    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('Category Breakdown', 60, doc.y);

    doc.moveDown(0.5);

    const barData = Object.entries(results.summary.byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({
        label: this.formatCategoryLabel(cat),
        value: count
      }));

    if (barData.length > 0) {
      const maxValue = Math.max(...barData.map(d => d.value));
      const chartHeight = drawBarChart(doc, barData, 60, doc.y, {
        width: 450,
        barHeight: 22,
        showValues: true,
        colorScheme: 'primary',
        maxValue: maxValue > 0 ? maxValue : 1
      });

      doc.y += chartHeight;
    }

    doc.moveDown(2);
  }

  /**
   * Add detailed tags list
   */
  addTagsDetailed(doc, tags) {
    checkPageBreakNeeded(doc, 200);
    addMaterialSectionHeader(doc, 'Detected Tags', {
      description: 'Complete list of tracking and analytics tags found'
    });

    if (!tags || tags.length === 0) {
      doc.fontSize(10)
         .fillColor(COLORS.textDisabled)
         .text('No tags detected on this page.', 60, doc.y);
      return;
    }

    // Group tags by category
    const grouped = {};
    tags.forEach(tag => {
      const cat = tag.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(tag);
    });

    Object.entries(grouped).forEach(([category, categoryTags]) => {
      checkPageBreakNeeded(doc, 100);

      // Category header
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(this.getCategoryColor(category))
         .text(this.formatCategoryLabel(category), 60, doc.y);

      doc.moveDown(0.3);

      // Tags in this category
      categoryTags.forEach(tag => {
        checkPageBreakNeeded(doc);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(`• ${tag.name}`, 70, doc.y);

        // Tag details
        const details = [];
        if (tag.instances) details.push(`${tag.instances} instance(s)`);
        if (tag.pagesFound?.length > 1) details.push(`${tag.pagesFound.length} page(s)`);
        if (tag.ids?.length > 0) details.push(`ID: ${tag.ids.slice(0, 2).join(', ')}${tag.ids.length > 2 ? '...' : ''}`);

        if (details.length > 0) {
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(`  ${details.join(' | ')}`, 80, doc.y);
        }

        doc.moveDown(0.5);
      });

      doc.moveDown(0.5);
    });

    doc.moveDown(1);
  }

  /**
   * Add issues and duplicates section
   */
  addIssuesAndDuplicates(doc, results) {
    const hasIssues = results.issues?.length > 0;
    const hasDuplicates = results.duplicates?.length > 0;

    if (!hasIssues && !hasDuplicates) {
      checkPageBreakNeeded(doc, 100);
      addMaterialSectionHeader(doc, 'Issues & Duplicates', {
        description: 'Problems detected with tag implementation'
      });

      doc.fontSize(10)
         .fillColor(COLORS.success)
         .text('✓ No critical issues or duplicates detected.', 60, doc.y);

      doc.moveDown(2);
      return;
    }

    checkPageBreakNeeded(doc, 200);
    addMaterialSectionHeader(doc, 'Issues & Duplicates', {
      description: 'Problems detected with tag implementation'
    });

    // Issues
    if (hasIssues) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.warning)
         .text('Issues Detected', 60, doc.y);

      doc.moveDown(0.5);

      results.issues.slice(0, 10).forEach(issue => {
        checkPageBreakNeeded(doc);

        const severityColor = issue.severity === 'high' ? COLORS.error :
                             issue.severity === 'warning' ? COLORS.warning : COLORS.info;

        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor(severityColor)
           .text(`• ${issue.message}`, 70, doc.y, { width: 475 });

        if (issue.recommendation) {
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(`  → ${issue.recommendation}`, 80, doc.y, { width: 465 });
        }

        doc.moveDown(0.5);
      });

      if (results.issues.length > 10) {
        doc.fontSize(8)
           .fillColor(COLORS.textDisabled)
           .text(`... and ${results.issues.length - 10} more issues`, 70, doc.y);
      }

      doc.moveDown(1);
    }

    // Duplicates
    if (hasDuplicates) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.error)
         .text('Duplicate Tags', 60, doc.y);

      doc.moveDown(0.5);

      results.duplicates.slice(0, 5).forEach(dup => {
        checkPageBreakNeeded(doc);

        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor(COLORS.error)
           .text(`• ${dup.message || dup.tag || 'Duplicate detected'}`, 70, doc.y, { width: 475 });

        doc.moveDown(0.5);
      });

      if (results.duplicates.length > 5) {
        doc.fontSize(8)
           .fillColor(COLORS.textDisabled)
           .text(`... and ${results.duplicates.length - 5} more duplicates`, 70, doc.y);
      }

      doc.moveDown(1);
    }

    doc.moveDown(1);
  }

  /**
   * Add performance impact section
   */
  addPerformanceImpact(doc, results) {
    const perfData = results.pageResults?.[0]?.performanceImpact;
    if (!perfData) return;

    checkPageBreakNeeded(doc, 200);
    addMaterialSectionHeader(doc, 'Script Performance Impact', {
      description: 'How tracking scripts affect page load'
    });

    // Performance grade
    const gradeColor = perfData.score >= 80 ? COLORS.success :
                       perfData.score >= 60 ? COLORS.warning : COLORS.error;

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(gradeColor)
       .text(`Performance Grade: ${perfData.grade || 'N/A'}`, 60, doc.y);

    doc.moveDown(0.5);

    // Script loading stats
    const stats = perfData.stats || {};
    const scriptMetrics = [
      {
        label: 'Blocking Scripts',
        value: stats.syncScripts?.toString() || '0',
        color: stats.syncScripts > 5 ? COLORS.error : COLORS.success
      },
      {
        label: 'Async Scripts',
        value: stats.asyncScripts?.toString() || '0',
        color: COLORS.success
      },
      {
        label: 'Deferred Scripts',
        value: stats.deferScripts?.toString() || '0',
        color: COLORS.info
      },
      {
        label: 'Inline Scripts',
        value: stats.inlineScripts?.toString() || '0',
        color: COLORS.warning
      }
    ];

    const gridHeight = drawMetricGrid(doc, scriptMetrics, 60, doc.y, {
      columns: 4,
      spacing: 10
    });

    doc.y += gridHeight + 15;

    // Script loading pie chart
    if (stats.asyncScripts || stats.syncScripts || stats.deferScripts || stats.inlineScripts) {
      const pieData = [
        { label: 'Async', value: stats.asyncScripts || 0, color: COLORS.success },
        { label: 'Blocking', value: stats.syncScripts || 0, color: COLORS.error },
        { label: 'Deferred', value: stats.deferScripts || 0, color: COLORS.info },
        { label: 'Inline', value: stats.inlineScripts || 0, color: COLORS.warning }
      ].filter(d => d.value > 0);

      if (pieData.length > 0) {
        const chartHeight = drawPieChart(doc, pieData, 150, doc.y + 60, {
          radius: 50,
          donutWidth: 15,
          showLegend: true,
          showPercentages: true
        });

        doc.y += chartHeight + 20;
      }
    }

    // Performance recommendation
    if (perfData.recommendation) {
      doc.fontSize(9)
         .fillColor(COLORS.textSecondary)
         .text(`💡 ${perfData.recommendation}`, 60, doc.y, { width: 490 });
    }

    doc.moveDown(2);
  }

  /**
   * Add consent compliance section
   */
  addConsentCompliance(doc, results) {
    const consentData = results.pageResults?.[0]?.consentMode;
    const cookieData = results.pageResults?.[0]?.cookies;

    if (!consentData && !cookieData) return;

    checkPageBreakNeeded(doc, 200);
    addMaterialSectionHeader(doc, 'Privacy & Consent', {
      description: 'Consent management and cookie compliance status'
    });

    // Consent mode status
    if (consentData) {
      const statusColor = consentData.implemented ? COLORS.success : COLORS.error;
      const statusIcon = consentData.implemented ? '✓' : '✗';

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(statusColor)
         .text(`${statusIcon} Consent Mode: ${consentData.implemented ? 'Implemented' : 'Not Detected'}`, 60, doc.y);

      if (consentData.recommendation) {
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLORS.textSecondary)
           .text(`→ ${consentData.recommendation}`, 70, doc.y);
      }

      doc.moveDown(1);
    }

    // Cookie compliance
    if (cookieData && cookieData.count > 0) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text(`Cookies Detected: ${cookieData.count}`, 60, doc.y);

      doc.moveDown(0.5);

      // Compliance score progress bar
      const complianceScore = cookieData.complianceScore || 100;
      const progressHeight = drawProgressBar(
        doc,
        complianceScore,
        `Cookie Compliance Score: ${complianceScore}%`,
        60,
        doc.y,
        { width: 400, showPercentage: false }
      );

      doc.y += progressHeight + 10;

      // Cookie breakdown by type
      if (cookieData.summary) {
        const cookieTypes = Object.entries(cookieData.summary)
          .filter(([_, count]) => count > 0)
          .map(([type, count]) => `${this.formatCookieType(type)}: ${count}`)
          .join(' | ');

        if (cookieTypes) {
          doc.fontSize(9)
             .fillColor(COLORS.textSecondary)
             .text(cookieTypes, 60, doc.y);
        }
      }

      // Cookie issues
      if (cookieData.issues?.length > 0) {
        doc.moveDown(0.5);

        cookieData.issues.slice(0, 3).forEach(issue => {
          const issueColor = issue.severity === 'high' ? COLORS.error : COLORS.warning;
          doc.fontSize(9)
             .fillColor(issueColor)
             .text(`⚠ ${issue.message}`, 70, doc.y, { width: 475 });
        });
      }

      doc.moveDown(1);
    }

    doc.moveDown(1);
  }

  /**
   * Add recommendations with priority grouping
   */
  addRecommendations(doc, recommendations) {
    checkPageBreakNeeded(doc, 150);
    addMaterialSectionHeader(doc, 'Recommendations', {
      description: 'Actionable improvements for your tracking setup'
    });

    if (!recommendations || recommendations.length === 0) {
      doc.fontSize(10)
         .fillColor(COLORS.success)
         .text('✓ Excellent! Your tag implementation follows best practices.', 60, doc.y);
      return;
    }

    // Group by priority
    const high = recommendations.filter(r => r.priority === 'high').slice(0, 5);
    const medium = recommendations.filter(r => r.priority === 'medium').slice(0, 5);
    const low = recommendations.filter(r => r.priority === 'low').slice(0, 5);

    // High priority
    if (high.length > 0) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.error)
         .text('🔴 High Priority', 60, doc.y);

      doc.moveDown(0.5);

      high.forEach(rec => {
        checkPageBreakNeeded(doc);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.error)
           .text(`• ${rec.title || rec.message}`, 70, doc.y);

        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 80, doc.y + 3, { width: 465 });
        }

        if (rec.action) {
          doc.fontSize(8)
             .fillColor(COLORS.primary)
             .text(`→ ${rec.action}`, 85, doc.y);
        }

        doc.moveDown(0.8);
      });

      doc.moveDown(1);
    }

    // Medium priority
    if (medium.length > 0) {
      checkPageBreakNeeded(doc, 100);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.warning)
         .text('🟡 Medium Priority', 60, doc.y);

      doc.moveDown(0.5);

      medium.forEach(rec => {
        checkPageBreakNeeded(doc);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.warning)
           .text(`• ${rec.title || rec.message}`, 70, doc.y);

        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 80, doc.y + 3, { width: 465 });
        }

        doc.moveDown(0.8);
      });

      doc.moveDown(1);
    }

    // Low priority
    if (low.length > 0) {
      checkPageBreakNeeded(doc, 100);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.info)
         .text('🔵 Low Priority', 60, doc.y);

      doc.moveDown(0.5);

      low.forEach(rec => {
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLORS.textSecondary)
           .text(`• ${rec.title || rec.message}`, 70, doc.y, { width: 475 });

        doc.moveDown(0.5);
      });
    }
  }

  /**
   * Helper: Format category label
   */
  formatCategoryLabel(category) {
    const labels = {
      analytics: 'Analytics',
      advertising: 'Advertising',
      tag_manager: 'Tag Manager',
      consent: 'Consent',
      customer_support: 'Support',
      marketing: 'Marketing',
      ab_testing: 'A/B Testing',
      session_recording: 'Session Recording',
      error_monitoring: 'Error Monitoring',
      cdp: 'CDP',
      other: 'Other'
    };
    return labels[category] || category;
  }

  /**
   * Helper: Get category color
   */
  getCategoryColor(category) {
    const colors = {
      analytics: COLORS.primary,
      advertising: '#f59e0b',
      tag_manager: '#8b5cf6',
      consent: COLORS.success,
      customer_support: '#ec4899',
      marketing: '#ef4444',
      ab_testing: '#8b5cf6',
      session_recording: '#ec4899',
      error_monitoring: '#f97316',
      cdp: '#14b8a6',
      other: COLORS.textSecondary
    };
    return colors[category] || COLORS.textPrimary;
  }

  /**
   * Helper: Format cookie type
   */
  formatCookieType(type) {
    const labels = {
      necessary: 'Essential',
      analytics: 'Analytics',
      advertising: 'Advertising',
      functional: 'Functional',
      marketing: 'Marketing',
      unknown: 'Unknown'
    };
    return labels[type] || type;
  }
}

module.exports = new TagIntelligencePdfGenerator();
