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
  drawProgressBar,
  drawThresholdChart
} = require('../utils/pdfCharts');

const { formatBytes } = require('../utils/formatHelpers');

const logger = createLogger('PerformancePdfGenerator');

/**
 * Performance PDF Report Generator - Material Design Edition
 * Creates professional, visually-rich PDF reports for Performance analysis
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
   * Generate comprehensive Performance PDF report with Material Design
   */
  async generateReport(performanceResults) {
    // Use helper to initialize PDF generation
    const { doc, filepath, reportId, stream, filename } = initializePdfGeneration(
      performanceResults,
      'performance',
      { reportsDir: this.reportsDir }
    );

    try {
      // Material Design header
      addPdfHeader(
        doc,
        'Performance Analysis Report',
        performanceResults.url,
        'Comprehensive performance and speed analysis',
        { accentColor: COLORS.info } // Blue accent for performance
      );

      // Generate report sections with Material Design and charts
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

  /**
   * Executive Summary with Material Design and Charts
   */
  addExecutiveSummary(doc, results) {
    addMaterialSectionHeader(doc, 'Executive Summary', {
      description: 'Overall performance score and key metrics',
      accentColor: COLORS.info
    });

    const overallScore = results.overallScore || results.performanceScore || 0;

    // Component scores for breakdown
    const breakdown = {
      'FCP': results.fcp?.score || 0,
      'LCP': results.lcp?.score || 0,
      'TBT': results.tbt?.score || 0,
      'CLS': results.cls?.score || 0,
      'Speed Index': results.speedIndex?.score || 0,
      'TTI': results.tti?.score || 0
    };

    // Score summary card with gauge chart
    const cardHeight = drawScoreSummaryCard(
      doc,
      overallScore,
      'Performance Score',
      breakdown,
      50,
      doc.y
    );

    doc.y += cardHeight;
    doc.moveDown(1);

    // Key metrics grid (2x3)
    checkPageBreakNeeded(doc, 150);

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('Core Performance Metrics', 50, doc.y);

    doc.moveDown(0.5);

    const metrics = [
      {
        label: 'FCP',
        value: results.fcp?.displayValue || 'N/A',
        color: getScoreColor(results.fcp?.score || 0),
        sublabel: 'First Contentful Paint'
      },
      {
        label: 'LCP',
        value: results.lcp?.displayValue || 'N/A',
        color: getScoreColor(results.lcp?.score || 0),
        sublabel: 'Largest Contentful Paint'
      },
      {
        label: 'TBT',
        value: results.tbt?.displayValue || 'N/A',
        color: getScoreColor(results.tbt?.score || 0),
        sublabel: 'Total Blocking Time'
      },
      {
        label: 'CLS',
        value: results.cls?.displayValue || 'N/A',
        color: getScoreColor(results.cls?.score || 0),
        sublabel: 'Cumulative Layout Shift'
      },
      {
        label: 'SI',
        value: results.speedIndex?.displayValue || 'N/A',
        color: getScoreColor(results.speedIndex?.score || 0),
        sublabel: 'Speed Index'
      },
      {
        label: 'TTI',
        value: results.tti?.displayValue || 'N/A',
        color: getScoreColor(results.tti?.score || 0),
        sublabel: 'Time to Interactive'
      }
    ];

    // Draw metric grid with 3 columns
    const gridStartY = doc.y;
    const colWidth = 155;
    const rowHeight = 90;

    metrics.forEach((metric, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 50 + (col * (colWidth + 15));
      const y = gridStartY + (row * (rowHeight + 15));

      // Card background
      drawCard(doc, x, y, colWidth, rowHeight);

      // Label
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textSecondary)
         .text(metric.label, x + 15, y + 15);

      // Value
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor(metric.color)
         .text(metric.value, x + 15, y + 35, { width: colWidth - 30 });

      // Sublabel
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(metric.sublabel, x + 15, y + 65, { width: colWidth - 30 });
    });

    doc.y = gridStartY + (2 * (rowHeight + 15));
    doc.moveDown(1);

    // Bar chart comparing all 6 metrics
    checkPageBreakNeeded(doc, 250);

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('Performance Component Comparison', 50, doc.y);

    doc.moveDown(0.5);

    const chartData = Object.entries(breakdown).map(([label, value]) => ({
      label,
      value
    }));

    const chartHeight = drawBarChart(
      doc,
      chartData,
      50,
      doc.y,
      {
        width: 512,
        barHeight: 25,
        showValues: true,
        colorScheme: 'score'
      }
    );

    doc.y += chartHeight + 10;
    doc.moveDown(1);
  }

  /**
   * Core Web Vitals with Threshold Charts
   */
  addCoreWebVitals(doc, results) {
    checkPageBreakNeeded(doc, 400);
    addMaterialSectionHeader(doc, 'Core Web Vitals', {
      description: 'Google\'s key user experience metrics',
      accentColor: COLORS.info
    });

    // Summary card with pass/fail status
    const lcpPass = this.isMetricGood(results.lcp);
    const tbtPass = this.isMetricGood(results.tbt);
    const clsPass = this.isMetricGood(results.cls);
    const allPass = lcpPass && tbtPass && clsPass;

    drawCard(doc, 50, doc.y, 512, 70, {
      backgroundColor: allPass ? '#E8F5E9' : '#FFF3E0',
      borderColor: allPass ? COLORS.success : COLORS.warning
    });

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(allPass ? COLORS.success : COLORS.warning)
       .text(
         allPass ? '✓ All Core Web Vitals Pass' : '⚠️ Some Core Web Vitals Need Improvement',
         70,
         doc.y + 15
       );

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(COLORS.textSecondary)
       .text(
         `LCP: ${lcpPass ? 'Pass' : 'Fail'} | TBT: ${tbtPass ? 'Pass' : 'Fail'} | CLS: ${clsPass ? 'Pass' : 'Fail'}`,
         70,
         doc.y + 12
       );

    doc.y += 80;
    doc.moveDown(1);

    // LCP Threshold Chart
    if (results.lcp) {
      checkPageBreakNeeded(doc, 180);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Largest Contentful Paint (LCP)', 50, doc.y);

      doc.moveDown(0.3);

      const lcpValue = this.parseMetricValue(results.lcp);
      const lcpThresholds = { good: 2.5, poor: 4.0 };

      const thresholdHeight = drawThresholdChart(
        doc,
        {
          label: 'LCP',
          value: lcpValue,
          unit: 's',
          thresholds: lcpThresholds
        },
        50,
        doc.y,
        { width: 512, height: 80 }
      );

      doc.y += thresholdHeight + 10;

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(
           `Score: ${results.lcp.score}/100 | Good: < 2.5s | Needs Improvement: 2.5-4s | Poor: > 4s`,
           50,
           doc.y,
           { width: 512 }
         );

      doc.moveDown(1.5);
    }

    // TBT Threshold Chart
    if (results.tbt) {
      checkPageBreakNeeded(doc, 180);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Total Blocking Time (TBT)', 50, doc.y);

      doc.moveDown(0.3);

      const tbtValue = this.parseMetricValue(results.tbt);
      const tbtThresholds = { good: 200, poor: 600 };

      const thresholdHeight = drawThresholdChart(
        doc,
        {
          label: 'TBT',
          value: tbtValue,
          unit: 'ms',
          thresholds: tbtThresholds
        },
        50,
        doc.y,
        { width: 512, height: 80 }
      );

      doc.y += thresholdHeight + 10;

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(
           `Score: ${results.tbt.score}/100 | Good: < 200ms | Needs Improvement: 200-600ms | Poor: > 600ms`,
           50,
           doc.y,
           { width: 512 }
         );

      doc.moveDown(1.5);
    }

    // CLS Threshold Chart
    if (results.cls) {
      checkPageBreakNeeded(doc, 180);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Cumulative Layout Shift (CLS)', 50, doc.y);

      doc.moveDown(0.3);

      const clsValue = this.parseMetricValue(results.cls);
      const clsThresholds = { good: 0.1, poor: 0.25 };

      const thresholdHeight = drawThresholdChart(
        doc,
        {
          label: 'CLS',
          value: clsValue,
          unit: '',
          thresholds: clsThresholds
        },
        50,
        doc.y,
        { width: 512, height: 80 }
      );

      doc.y += thresholdHeight + 10;

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(
           `Score: ${results.cls.score}/100 | Good: < 0.1 | Needs Improvement: 0.1-0.25 | Poor: > 0.25`,
           50,
           doc.y,
           { width: 512 }
         );

      doc.moveDown(1.5);
    }

    // FCP (not a Core Web Vital but important)
    if (results.fcp) {
      checkPageBreakNeeded(doc, 150);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('First Contentful Paint (FCP)', 50, doc.y);

      doc.moveDown(0.3);

      const fcpValue = this.parseMetricValue(results.fcp);
      const fcpScore = results.fcp.score || 0;

      const progressHeight = drawProgressBar(
        doc,
        fcpScore,
        `${results.fcp.displayValue || fcpValue + 's'} (Good: < 1.8s, Poor: > 3s)`,
        50,
        doc.y,
        {
          width: 512,
          height: 35,
          showPercentage: false,
          color: getScoreColor(fcpScore)
        }
      );

      doc.y += progressHeight + 10;
    }

    doc.moveDown(1);
  }

  /**
   * Performance Metrics with Timeline and Progress Bars
   */
  addPerformanceMetrics(doc, results) {
    checkPageBreakNeeded(doc, 400);
    addMaterialSectionHeader(doc, 'Additional Performance Metrics', {
      description: 'Detailed loading timeline and metrics'
    });

    // Timeline visualization (FCP → FMP → LCP → TTI)
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('Loading Timeline', 50, doc.y);

    doc.moveDown(0.5);

    // Draw timeline
    const timelineY = doc.y;
    const timelineStartX = 80;
    const timelineWidth = 435;

    // Timeline background line
    doc.strokeColor(COLORS.divider)
       .lineWidth(2)
       .moveTo(timelineStartX, timelineY)
       .lineTo(timelineStartX + timelineWidth, timelineY)
       .stroke();

    // Timeline markers
    const markers = [
      { label: 'FCP', value: results.fcp?.displayValue, color: COLORS.success, position: 0.2 },
      { label: 'FMP', value: results.fmp?.displayValue, color: COLORS.good, position: 0.4 },
      { label: 'LCP', value: results.lcp?.displayValue, color: COLORS.warning, position: 0.6 },
      { label: 'TTI', value: results.tti?.displayValue, color: COLORS.info, position: 0.9 }
    ];

    markers.forEach(marker => {
      if (marker.value) {
        const x = timelineStartX + (timelineWidth * marker.position);

        // Marker circle
        doc.circle(x, timelineY, 6)
           .fillColor(marker.color)
           .fill();

        // Label
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor(marker.color)
           .text(marker.label, x - 15, timelineY + 15, { width: 30, align: 'center' });

        // Value
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor(COLORS.textSecondary)
           .text(marker.value, x - 20, timelineY + 30, { width: 40, align: 'center' });
      }
    });

    doc.y = timelineY + 60;
    doc.moveDown(1);

    // Detailed metrics with progress bars
    const detailedMetrics = [
      { name: 'Speed Index', value: results.speedIndex?.displayValue, score: results.speedIndex?.score },
      { name: 'Time to Interactive', value: results.tti?.displayValue, score: results.tti?.score },
      { name: 'First Meaningful Paint', value: results.fmp?.displayValue, score: results.fmp?.score },
      { name: 'Max Potential FID', value: results.maxPotentialFID?.displayValue, score: results.maxPotentialFID?.score }
    ];

    detailedMetrics.forEach(metric => {
      if (metric.value || metric.score !== undefined) {
        checkPageBreakNeeded(doc, 80);

        const score = metric.score || 0;

        drawCard(doc, 50, doc.y, 512, 65);

        // Metric name
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(metric.name, 70, doc.y + 15);

        // Value
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(getScoreColor(score))
           .text(metric.value || 'N/A', 70, doc.y + 8);

        // Progress bar
        const barWidth = 200;
        const barHeight = 8;
        const barX = 280;
        const barY = doc.y - 7;

        // Background
        doc.rect(barX, barY, barWidth, barHeight)
           .fillColor(COLORS.divider)
           .fill();

        // Foreground
        const fillWidth = (score / 100) * barWidth;
        doc.rect(barX, barY, fillWidth, barHeight)
           .fillColor(getScoreColor(score))
           .fill();

        // Score text
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(getScoreColor(score))
           .text(`${score}/100`, barX + barWidth + 10, barY - 2);

        doc.y += 75;
      }
    });

    doc.moveDown(1);
  }

  /**
   * Resource Analysis with Pie Chart
   */
  addResourceAnalysis(doc, results) {
    checkPageBreakNeeded(doc, 450);
    addMaterialSectionHeader(doc, 'Resource Analysis', {
      description: 'Resource breakdown and optimization opportunities'
    });

    if (results.resources) {
      const resources = results.resources;

      // Pie chart for resource distribution
      const hasResources = resources.scripts || resources.stylesheets || resources.images || resources.fonts;

      if (hasResources) {
        // Pie chart needs at least 250px (radius*2 + legend + margins)
        checkPageBreakNeeded(doc, 280);
        
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text('Resource Size Distribution', 50, doc.y);

        doc.moveDown(0.5);

        const pieData = [];

        if (resources.scripts && resources.scripts.size > 0) {
          pieData.push({
            label: 'JavaScript',
            value: resources.scripts.size,
            color: COLORS.warning
          });
        }

        if (resources.stylesheets && resources.stylesheets.size > 0) {
          pieData.push({
            label: 'CSS',
            value: resources.stylesheets.size,
            color: COLORS.info
          });
        }

        if (resources.images && resources.images.size > 0) {
          pieData.push({
            label: 'Images',
            value: resources.images.size,
            color: COLORS.success
          });
        }

        if (resources.fonts && resources.fonts.size > 0) {
          pieData.push({
            label: 'Fonts',
            value: resources.fonts.size,
            color: COLORS.secondary
          });
        }

        if (pieData.length > 0) {
          const totalSize = pieData.reduce((sum, item) => sum + item.value, 0);

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
              centerText: formatBytes(totalSize),
              centerLabel: 'Total'
            }
          );

          doc.y += pieHeight + 30;
        }

        // Bar chart for resource counts and sizes
        // Calculate accurate height: ~4 bars at 30px height + spacing
        const barChartEstimate = 4 * (30 + 8) + 60; // bars + header + margins
        checkPageBreakNeeded(doc, barChartEstimate);

        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text('Resource Breakdown', 50, doc.y);

        doc.moveDown(0.5);

        const barData = [];

        if (resources.scripts) {
          barData.push({
            label: `JavaScript (${resources.scripts.count || 0} files)`,
            value: resources.scripts.size / 1024 // Convert to KB
          });
        }

        if (resources.stylesheets) {
          barData.push({
            label: `CSS (${resources.stylesheets.count || 0} files)`,
            value: resources.stylesheets.size / 1024
          });
        }

        if (resources.images) {
          barData.push({
            label: `Images (${resources.images.count || 0} files)`,
            value: resources.images.size / 1024
          });
        }

        if (resources.fonts) {
          barData.push({
            label: `Fonts (${resources.fonts.count || 0} files)`,
            value: resources.fonts.size / 1024
          });
        }

        if (barData.length > 0) {
          const chartHeight = drawBarChart(
            doc,
            barData,
            50,
            doc.y,
            {
              width: 512,
              barHeight: 30,
              showValues: true,
              colorScheme: 'primary',
              valueFormatter: (val) => `${Math.round(val)} KB`
            }
          );

          doc.y += chartHeight + 10;
        }

        // Total summary
        if (resources.total) {
          doc.moveDown(0.5);

          drawCard(doc, 50, doc.y, 512, 50);

          doc.fontSize(10)
             .font('Helvetica-Bold')
             .fillColor(COLORS.textPrimary)
             .text('Total Resources', 70, doc.y + 18);

          doc.fontSize(14)
             .font('Helvetica-Bold')
             .fillColor(COLORS.info)
             .text(
               `${resources.total.count || 0} files (${formatBytes(resources.total.size || 0)})`,
               300,
               doc.y - 14
             );

          doc.y += 60;
        }
      }
    }

    // Render-blocking resources
    if (results.renderBlockingResources && results.renderBlockingResources.length > 0) {
      checkPageBreakNeeded(doc, 150);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.error)
         .text(`⚠️ Render-Blocking Resources (${results.renderBlockingResources.length})`, 50, doc.y);

      doc.moveDown(0.5);

      const displayCount = Math.min(5, results.renderBlockingResources.length);

      results.renderBlockingResources.slice(0, displayCount).forEach((resource, index) => {
        checkPageBreakNeeded(doc, 60);

        drawCard(doc, 50, doc.y, 512, 45, {
          backgroundColor: '#FFF3E0',
          borderColor: COLORS.warning
        });

        const url = resource.url || resource;
        const displayUrl = url.length > 70 ? url.substring(0, 70) + '...' : url;

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLORS.textSecondary)
           .text(`${index + 1}. ${displayUrl}`, 70, doc.y + 15, { width: 445 });

        doc.y += 55;
      });

      if (results.renderBlockingResources.length > displayCount) {
        doc.fontSize(9)
           .fillColor(COLORS.textSecondary)
           .text(`... and ${results.renderBlockingResources.length - displayCount} more`, 50, doc.y);
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
    addMaterialSectionHeader(doc, 'Desktop vs Mobile Comparison', {
      description: 'Performance metrics across device types'
    });

    // Dual gauge charts
    const desktopScore = results.desktop.performanceScore || results.desktop.overallScore || 0;
    const mobileScore = results.mobile.performanceScore || results.mobile.overallScore || 0;

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

    // Comparison chart for detailed metrics
    const metrics = [
      {
        label: 'Overall Score',
        value1: desktopScore,
        value2: mobileScore
      },
      {
        label: 'FCP',
        value1: results.desktop.fcp?.score || 0,
        value2: results.mobile.fcp?.score || 0
      },
      {
        label: 'LCP',
        value1: results.desktop.lcp?.score || 0,
        value2: results.mobile.lcp?.score || 0
      },
      {
        label: 'TBT',
        value1: results.desktop.tbt?.score || 0,
        value2: results.mobile.tbt?.score || 0
      },
      {
        label: 'CLS',
        value1: results.desktop.cls?.score || 0,
        value2: results.mobile.cls?.score || 0
      },
      {
        label: 'Speed Index',
        value1: results.desktop.speedIndex?.score || 0,
        value2: results.mobile.speedIndex?.score || 0
      }
    ];

    // Comparison chart needs ~280px (6 metrics * 40px row height + legend)
    checkPageBreakNeeded(doc, 280);

    const comparisonHeight = drawComparisonChart(
      doc,
      metrics,
      50,
      doc.y,
      {
        width: 512,
        height: 220,
        labels: ['Desktop', 'Mobile'],
        colors: [COLORS.primary, COLORS.secondary]
      }
    );

    doc.y += comparisonHeight + 10;
    doc.moveDown(1);
  }

  /**
   * Recommendations with Priority Cards - Full content with proper page breaks
   */
  addRecommendations(doc, results) {
    if (!results.recommendations || results.recommendations.length === 0) {
      return;
    }

    // Start recommendations on new page to avoid mid-page breaks
    doc.addPage();
    addMaterialSectionHeader(doc, 'Performance Recommendations', {
      description: 'Prioritized optimizations to improve page speed'
    });

    // Group by priority
    const high = results.recommendations.filter(r => r.priority === 'high');
    const medium = results.recommendations.filter(r => r.priority === 'medium');
    const low = results.recommendations.filter(r => r.priority === 'low');

    // High Priority
    if (high.length > 0) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.error)
         .text('🔴 High Priority', 50, doc.y);

      doc.moveDown(0.5);

      high.forEach((rec, index) => {
        // Calculate card height based on content
        const descLines = Math.ceil((rec.description || '').length / 70);
        const solutionLines = rec.solution ? Math.ceil(rec.solution.length / 70) : 0;
        const cardHeight = 50 + (descLines * 12) + (solutionLines * 12) + (rec.fix ? 40 : 0);
        
        checkPageBreakNeeded(doc, cardHeight + 20);

        drawCard(doc, 50, doc.y, 512, cardHeight, {
          backgroundColor: '#FFEBEE',
          borderColor: COLORS.error
        });

        const cardStartY = doc.y;

        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(COLORS.error)
           .text('HIGH', 70, cardStartY + 12);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(`${index + 1}. ${rec.title}`, 120, cardStartY + 10, { width: 395 });

        let currentY = cardStartY + 28;

        // Full description
        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 70, currentY, { width: 445 });
          currentY = doc.y + 8;
        }

        // Solution
        if (rec.solution) {
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.info)
             .text('Solution:', 70, currentY);
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.info)
             .text(rec.solution, 120, currentY, { width: 395 });
          currentY = doc.y + 8;
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
          currentY = doc.y + 8;
        }

        doc.y = cardStartY + cardHeight + 10;
      });

      doc.moveDown(1);
    }

    // Medium Priority
    if (medium.length > 0) {
      checkPageBreakNeeded(doc, 150);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.warning)
         .text('🟡 Medium Priority', 50, doc.y);

      doc.moveDown(0.5);

      medium.forEach((rec, index) => {
        // Calculate card height based on content
        const descLines = Math.ceil((rec.description || '').length / 70);
        const solutionLines = rec.solution ? Math.ceil(rec.solution.length / 70) : 0;
        const cardHeight = 45 + (descLines * 12) + (solutionLines * 12) + (rec.fix ? 35 : 0);
        
        checkPageBreakNeeded(doc, cardHeight + 15);

        drawCard(doc, 50, doc.y, 512, cardHeight, {
          backgroundColor: '#FFF3E0',
          borderColor: COLORS.warning
        });

        const cardStartY = doc.y;

        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(COLORS.warning)
           .text('MEDIUM', 70, cardStartY + 10);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(`${index + 1}. ${rec.title}`, 130, cardStartY + 8, { width: 385 });

        let currentY = cardStartY + 25;

        // Full description
        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 70, currentY, { width: 445 });
          currentY = doc.y + 6;
        }

        // Solution
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

        // Fix
        if (rec.fix) {
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.success)
             .text('How to Fix:', 70, currentY);
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.success)
             .text(rec.fix, 130, currentY, { width: 385 });
        }

        doc.y = cardStartY + cardHeight + 8;
      });

      doc.moveDown(1);
    }

    // Low Priority - Show full details too
    if (low.length > 0) {
      checkPageBreakNeeded(doc, 150);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.info)
         .text('🔵 Low Priority', 50, doc.y);

      doc.moveDown(0.5);

      low.forEach((rec, index) => {
        const descLines = Math.ceil((rec.description || '').length / 70);
        const cardHeight = 40 + (descLines * 12) + (rec.solution ? 25 : 0);
        
        checkPageBreakNeeded(doc, cardHeight + 15);

        drawCard(doc, 50, doc.y, 512, cardHeight, {
          backgroundColor: '#E3F2FD',
          borderColor: COLORS.info
        });

        const cardStartY = doc.y;

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(`${index + 1}. ${rec.title}`, 70, cardStartY + 10, { width: 445 });

        let currentY = cardStartY + 26;

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
             .text(`→ ${rec.solution}`, 70, currentY, { width: 445 });
        }

        doc.y = cardStartY + cardHeight + 8;
      });
    }
  }

  /**
   * Helper: Parse metric value from displayValue or value
   */
  parseMetricValue(metric) {
    if (!metric) return 0;

    if (metric.value !== undefined) {
      return metric.value;
    }

    if (metric.displayValue) {
      const match = metric.displayValue.match(/[\d.]+/);
      return match ? parseFloat(match[0]) : 0;
    }

    return 0;
  }

  /**
   * Helper: Check if metric is in "good" range
   */
  isMetricGood(metric) {
    if (!metric || metric.score === undefined) return false;
    return metric.score >= 90;
  }
}

// Export singleton
module.exports = new PerformancePdfGenerator();
