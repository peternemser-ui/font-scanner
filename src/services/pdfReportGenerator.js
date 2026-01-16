const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { resolveReportId } = require('../utils/resolveReportId');
const {
  COLORS,
  drawGaugeChart,
  drawBarChart,
  drawPieChart,
  drawComparisonChart,
  drawProgressBar
} = require('../utils/pdfCharts');
const {
  addPdfHeader,
  drawCard,
  drawMetricGrid,
  addMaterialSectionHeader,
  getScoreColor
} = require('../utils/pdfHelpers');

const logger = createLogger('PDFReportGenerator');

class PDFReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '../../reports');
    this.ensureReportsDir();
  }

  async ensureReportsDir() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating reports directory:', error);
    }
  }

  async generateComprehensiveReport(scanResults) {
    const reportId = resolveReportId({
      reportId: scanResults?.reportId,
      analyzerKey: scanResults?.analyzerKey || 'enhanced-fonts',
      url: scanResults?.normalizedUrl || scanResults?.url || scanResults?.baseUrl,
      startedAtISO: scanResults?.scanStartedAt || scanResults?.startedAt || scanResults?.timestamp,
    });

    if (!reportId) {
      throw new Error('Missing report identity for Font PDF generation (reportId or url+scanStartedAt+analyzerKey)');
    }
    const filename = `font-analysis-${reportId}.pdf`;
    const filepath = path.join(this.reportsDir, filename);

    logger.info(`Generating PDF report: ${filename}`);

    // US Letter size (8.5" x 11" = 612 x 792 points) with white background
    const doc = new PDFDocument({
      margin: 50,
      size: 'LETTER',
      bufferPages: true
    });

    // Pipe to file
    const stream = fsSync.createWriteStream(filepath);
    doc.pipe(stream);

    // Generate report content
    await this.addHeader(doc, scanResults.baseUrl);
    await this.addExecutiveSummary(doc, scanResults);
    await this.addDetailedFontAnalysis(doc, scanResults);
    await this.addBestPracticesAnalysis(doc, scanResults);
    await this.addPerformanceMetrics(doc, scanResults);
    await this.addMultiPageAnalysis(doc, scanResults.pages);
    await this.addDesktopMobileComparison(doc, scanResults.lighthouse);
    await this.addSecurityAndCaching(doc, scanResults);
    await this.addAccessibilityDetails(doc, scanResults);
    await this.addWeaknessAnalysis(doc, scanResults);
    await this.addRecommendations(doc, scanResults);
    await this.addAppendix(doc, scanResults);

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        resolve({
          filename,
          filepath,
          reportId,
          size: doc._pageSize,
        });
      });
      stream.on('error', reject);
    });
  }

  async addHeader(doc, baseUrl) {
    // Material Design header
    addPdfHeader(doc, 'Font Analysis Report', baseUrl, 'Comprehensive Font Performance & Optimization Analysis', {
      accentColor: COLORS.secondary,
      startY: 50
    });
  }

  async addExecutiveSummary(doc, scanResults) {
    addMaterialSectionHeader(doc, 'Executive Summary', { accentColor: COLORS.primary });

    const summary = this.calculateExecutiveSummary(scanResults);

    // Overall score gauge chart (center)
    const overallScore = Math.round((summary.fontScore + summary.desktopScore + summary.mobileScore + summary.accessibilityScore) / 4);
    const gaugeHeight = drawGaugeChart(doc, overallScore, 'Overall Performance Score', 297.5, doc.y + 80, {
      radius: 80,
      width: 15,
      showValue: true,
      showLabel: true
    });

    doc.y += gaugeHeight + 30;

    // Metric grid for component scores
    const metrics = [
      { label: 'Font Performance', value: `${summary.fontScore}/100`, color: getScoreColor(summary.fontScore) },
      { label: 'Desktop Score', value: `${summary.desktopScore}/100`, color: getScoreColor(summary.desktopScore) },
      { label: 'Mobile Score', value: `${summary.mobileScore}/100`, color: getScoreColor(summary.mobileScore) },
      { label: 'Accessibility', value: `${summary.accessibilityScore}/100`, color: getScoreColor(summary.accessibilityScore) }
    ];

    const gridHeight = drawMetricGrid(doc, metrics, 50, doc.y, { columns: 4, spacing: 16 });
    doc.y += gridHeight + 30;

    // Bar chart comparing all 4 scores
    const scoreData = [
      { label: 'Font Performance', value: summary.fontScore },
      { label: 'Desktop Score', value: summary.desktopScore },
      { label: 'Mobile Score', value: summary.mobileScore },
      { label: 'Accessibility', value: summary.accessibilityScore }
    ];

    const barHeight = drawBarChart(doc, scoreData, 50, doc.y, {
      width: 512,
      height: 180,
      showValues: true,
      colorScheme: 'score'
    });

    doc.y += barHeight + 30;

    // Key findings in Material cards
    if (summary.keyFindings.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.textPrimary)
         .text('Key Findings', 50, doc.y);
      doc.y += 20;

      summary.keyFindings.forEach((finding, index) => {
        const priority = index === 0 ? 'critical' : 'warning';
        const accentColor = priority === 'critical' ? COLORS.error : COLORS.warning;

        drawCard(doc, 50, doc.y, 512, 50, {
          elevation: 1,
          backgroundColor: COLORS.surface
        });

        // Priority indicator bar
        doc.rect(50, doc.y, 4, 50).fillColor(accentColor).fill();

        doc.fontSize(11).font('Helvetica').fillColor(COLORS.textPrimary)
           .text(finding, 70, doc.y + 18, { width: 460 });

        doc.y += 60;
      });
    }

    doc.addPage();
  }

  async addDetailedFontAnalysis(doc, scanResults) {
    addMaterialSectionHeader(doc, 'Font Analysis', { accentColor: COLORS.secondary });

    const fontData = scanResults.pages?.[0]?.fonts;
    if (!fontData) {
      doc.fillColor(COLORS.error).fontSize(11).text('No font data available', 50, doc.y + 10);
      doc.addPage();
      return;
    }

    // Font Distribution Pie Chart
    const totalFonts = fontData.totalFonts || 0;
    const systemFonts = fontData.categorizedFonts?.system?.length || 0;
    const webFonts = fontData.categorizedFonts?.webFonts?.length || 0;
    const googleFonts = fontData.categorizedFonts?.googleFonts?.length || 0;
    const iconFonts = fontData.categorizedFonts?.iconFonts?.length || 0;

    if (totalFonts > 0) {
      const pieData = [];
      if (systemFonts > 0) pieData.push({ label: 'System Fonts', value: systemFonts, color: COLORS.primary });
      if (webFonts > 0) pieData.push({ label: 'Web Fonts', value: webFonts, color: COLORS.secondary });
      if (googleFonts > 0) pieData.push({ label: 'Google Fonts', value: googleFonts, color: COLORS.info });
      if (iconFonts > 0) pieData.push({ label: 'Icon Fonts', value: iconFonts, color: COLORS.warning });

      const pieHeight = drawPieChart(doc, pieData, 297.5, doc.y + 100, {
        radius: 80,
        donutWidth: 25,
        showLegend: true,
        showPercentages: true
      });

      doc.y += pieHeight + 30;
    }

    // Font Metrics Grid
    const fontMetrics = [
      { label: 'Total Fonts', value: totalFonts.toString(), color: COLORS.primary },
      { label: 'System Fonts', value: systemFonts.toString(), color: COLORS.success },
      { label: 'Web Fonts', value: webFonts.toString(), color: COLORS.secondary },
      { label: 'Google Fonts', value: googleFonts.toString(), color: COLORS.info }
    ];

    const metricsHeight = drawMetricGrid(doc, fontMetrics, 50, doc.y, { columns: 4, spacing: 16 });
    doc.y += metricsHeight + 30;

    // Font Details by Category
    if (fontData.categorizedFonts) {
      Object.entries(fontData.categorizedFonts).forEach(([category, fonts]) => {
        if (fonts && fonts.length > 0) {
          // Category header
          doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textPrimary)
             .text(this.formatCategoryName(category) + ' Fonts', 50, doc.y + 10);
          doc.y += 25;

          // Material card for fonts
          const cardHeight = Math.min(fonts.length * 14 + 30, 100);
          drawCard(doc, 50, doc.y, 512, cardHeight, {
            elevation: 1,
            backgroundColor: COLORS.surface
          });

          fonts.slice(0, 6).forEach((font, index) => {
            doc.fillColor(COLORS.textPrimary).fontSize(9)
               .text(`• ${font}`, 70, doc.y + 15 + (index * 14));
          });

          if (fonts.length > 6) {
            doc.fillColor(COLORS.textSecondary).fontSize(9)
               .text(`... and ${fonts.length - 6} more fonts`, 70, doc.y + 15 + (6 * 14));
          }

          doc.y += cardHeight + 20;
        }
      });
    }

    // Font Loading Performance
    if (fontData.fontLoading) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textPrimary)
         .text('Font Loading Performance', 50, doc.y + 10);
      doc.y += 25;

      if (fontData.fontLoading.supported) {
        const loadTime = fontData.fontLoading.totalLoadTime || 0;
        const loadProgress = Math.min(100, Math.max(0, 100 - (loadTime / 30))); // 0-3000ms scale

        // Progress bar for load time
        const progressHeight = drawProgressBar(doc, loadProgress, `Total Load Time: ${loadTime.toFixed(2)}ms`, 50, doc.y, {
          width: 512,
          height: 30,
          showPercentage: false,
          color: loadTime < 1000 ? COLORS.success : loadTime < 2000 ? COLORS.warning : COLORS.error
        });

        doc.y += progressHeight + 20;

        // Individual font loading details
        if (fontData.fontLoading.fonts && fontData.fontLoading.fonts.length > 0) {
          fontData.fontLoading.fonts.slice(0, 3).forEach((font) => {
            const fontLoadProgress = Math.min(100, Math.max(0, 100 - ((font.loadTime || 0) / 30)));
            const fontProgressHeight = drawProgressBar(
              doc,
              fontLoadProgress,
              `${font.family}: ${(font.loadTime || 0).toFixed(2)}ms`,
              50,
              doc.y,
              {
                width: 512,
                height: 25,
                showPercentage: false,
                color: font.status === 'loaded' ? COLORS.success : COLORS.error
              }
            );
            doc.y += fontProgressHeight + 10;
          });
        }
      } else {
        doc.fillColor(COLORS.error).fontSize(10)
           .text('Font Loading API not supported', 50, doc.y);
      }
    }

    doc.addPage();
  }

  async addBestPracticesAnalysis(doc, scanResults) {
    addMaterialSectionHeader(doc, 'Best Practices Analysis', { accentColor: COLORS.primary });

    const bestPractices = scanResults.pages?.[0]?.bestPractices;
    if (!bestPractices) {
      doc.fillColor(COLORS.error).fontSize(11).text('No best practices data available', 50, doc.y + 10);
      doc.addPage();
      return;
    }

    // Overall Score Gauge
    const overallScore = bestPractices.score || 0;
    const grade = this.getGrade(overallScore);

    const gaugeHeight = drawGaugeChart(doc, overallScore, `Overall Best Practices Score (Grade: ${grade})`, 297.5, doc.y + 80, {
      radius: 80,
      width: 15,
      showValue: true,
      showLabel: true
    });

    doc.y += gaugeHeight + 30;

    // Category Breakdown Bar Chart
    if (bestPractices.categories) {
      const categoryData = Object.entries(bestPractices.categories).map(([category, data]) => ({
        label: this.formatCategoryName(category),
        value: data.percentage || data.score || 0
      }));

      const barHeight = drawBarChart(doc, categoryData, 50, doc.y, {
        width: 512,
        height: categoryData.length * 35 + 20,
        showValues: true,
        colorScheme: 'score'
      });

      doc.y += barHeight + 30;
    }

    // Key Issues and Strengths
    if (bestPractices.summary) {
      if (bestPractices.summary.mainIssues && bestPractices.summary.mainIssues.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.error)
           .text('Critical Issues', 50, doc.y + 10);
        doc.y += 25;

        bestPractices.summary.mainIssues.forEach((issue) => {
          drawCard(doc, 50, doc.y, 512, 40, {
            elevation: 1,
            backgroundColor: COLORS.surface
          });

          doc.rect(50, doc.y, 4, 40).fillColor(COLORS.error).fill();

          doc.fillColor(COLORS.textPrimary).fontSize(10)
             .text(`• ${issue}`, 70, doc.y + 13, { width: 460 });

          doc.y += 50;
        });
      }

      if (bestPractices.summary.mainStrengths && bestPractices.summary.mainStrengths.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.success)
           .text('Strengths', 50, doc.y + 10);
        doc.y += 25;

        bestPractices.summary.mainStrengths.forEach((strength) => {
          drawCard(doc, 50, doc.y, 512, 40, {
            elevation: 1,
            backgroundColor: COLORS.surface
          });

          doc.rect(50, doc.y, 4, 40).fillColor(COLORS.success).fill();

          doc.fillColor(COLORS.textPrimary).fontSize(10)
             .text(`• ${strength}`, 70, doc.y + 13, { width: 460 });

          doc.y += 50;
        });
      }
    }

    doc.addPage();
  }

  async addPerformanceMetrics(doc, scanResults) {
    addMaterialSectionHeader(doc, 'Performance Metrics', { accentColor: COLORS.info });

    const performance = scanResults.pages?.[0]?.performance;
    if (!performance) {
      doc.fillColor(COLORS.textSecondary).fontSize(11).text('No performance data available', 50, doc.y + 10);
      doc.addPage();
      return;
    }

    // Loading Performance Metrics Grid
    const perfMetrics = [];

    if (performance.loadTime) {
      perfMetrics.push({
        label: 'Page Load Time',
        value: `${performance.loadTime}ms`,
        color: performance.loadTime < 3000 ? COLORS.success : COLORS.warning
      });
    }

    if (performance.fontResources) {
      perfMetrics.push({
        label: 'Font Resources',
        value: `${performance.fontResources.length} files`,
        color: COLORS.primary
      });
    }

    if (perfMetrics.length > 0) {
      const metricsHeight = drawMetricGrid(doc, perfMetrics, 50, doc.y, { columns: 2, spacing: 16 });
      doc.y += metricsHeight + 30;
    }

    // Font Resource Details
    if (performance.fontResources && performance.fontResources.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textPrimary)
         .text('Font Resources', 50, doc.y + 10);
      doc.y += 25;

      performance.fontResources.slice(0, 5).forEach(resource => {
        drawCard(doc, 50, doc.y, 512, 50, {
          elevation: 1,
          backgroundColor: COLORS.surface
        });

        const url = resource.url ? resource.url.substring(0, 70) + (resource.url.length > 70 ? '...' : '') : 'Unknown';
        doc.fillColor(COLORS.textPrimary).fontSize(9)
           .text(url, 65, doc.y + 12, { width: 465 });

        if (resource.size) {
          doc.fillColor(COLORS.textSecondary).fontSize(9)
             .text(`Size: ${resource.size} bytes`, 65, doc.y + 28);
        }

        doc.y += 60;
      });
    }

    // Core Metrics
    if (performance.metrics) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textPrimary)
         .text('Core Metrics', 50, doc.y + 10);
      doc.y += 25;

      const metricsData = Object.entries(performance.metrics)
        .filter(([, value]) => typeof value === 'number')
        .map(([metric, value]) => ({
          label: metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          value: value.toFixed(2)
        }));

      if (metricsData.length > 0) {
        const barHeight = drawBarChart(doc, metricsData, 50, doc.y, {
          width: 512,
          height: metricsData.length * 30 + 20,
          showValues: true,
          colorScheme: 'uniform'
        });
        doc.y += barHeight;
      }
    }

    doc.addPage();
  }

  async addSecurityAndCaching(doc, scanResults) {
    addMaterialSectionHeader(doc, 'Security & Caching Analysis', { accentColor: COLORS.warning });

    const bestPractices = scanResults.pages?.[0]?.bestPractices;

    // Security Analysis
    if (bestPractices?.categories?.security) {
      const security = bestPractices.categories.security;
      const securityScore = security.percentage || security.score || 0;

      // Security Score Progress Bar
      const progressHeight = drawProgressBar(doc, securityScore, 'Security Score', 50, doc.y, {
        width: 512,
        height: 35,
        showPercentage: true,
        color: getScoreColor(securityScore)
      });

      doc.y += progressHeight + 30;

      if (security.good && security.good.length > 0) {
        doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.success)
           .text('Security Strengths', 50, doc.y + 10);
        doc.y += 20;

        security.good.forEach(item => {
          drawCard(doc, 50, doc.y, 512, 35, {
            elevation: 1,
            backgroundColor: COLORS.surface
          });

          doc.rect(50, doc.y, 4, 35).fillColor(COLORS.success).fill();
          doc.fillColor(COLORS.textPrimary).fontSize(9)
             .text(`• ${item}`, 70, doc.y + 11, { width: 460 });

          doc.y += 45;
        });
      }

      if (security.issues && security.issues.length > 0) {
        doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.error)
           .text('Security Issues', 50, doc.y + 10);
        doc.y += 20;

        security.issues.forEach(issue => {
          drawCard(doc, 50, doc.y, 512, 35, {
            elevation: 1,
            backgroundColor: COLORS.surface
          });

          doc.rect(50, doc.y, 4, 35).fillColor(COLORS.error).fill();
          doc.fillColor(COLORS.textPrimary).fontSize(9)
             .text(`• ${issue.message || issue}`, 70, doc.y + 11, { width: 460 });

          doc.y += 45;
        });
      }
    }

    // Caching Analysis
    if (bestPractices?.categories?.caching) {
      const caching = bestPractices.categories.caching;
      const cachingScore = caching.percentage || caching.score || 0;

      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textPrimary)
         .text('Caching Performance', 50, doc.y + 20);
      doc.y += 30;

      // Caching Score Progress Bar
      const cachingProgressHeight = drawProgressBar(doc, cachingScore, 'Caching Score', 50, doc.y, {
        width: 512,
        height: 35,
        showPercentage: true,
        color: getScoreColor(cachingScore)
      });

      doc.y += cachingProgressHeight + 30;

      // Caching Metrics
      const cachingMetrics = [];
      if (caching.cacheableResources !== undefined) {
        cachingMetrics.push({ label: 'Cacheable Resources', value: caching.cacheableResources.toString(), color: COLORS.primary });
      }
      if (caching.longTermCaching !== undefined) {
        cachingMetrics.push({ label: 'Long-term Cached', value: caching.longTermCaching.toString(), color: COLORS.secondary });
      }

      if (cachingMetrics.length > 0) {
        const metricsHeight = drawMetricGrid(doc, cachingMetrics, 50, doc.y, { columns: 2, spacing: 16 });
        doc.y += metricsHeight;
      }
    }

    doc.addPage();
  }

  async addAccessibilityDetails(doc, scanResults) {
    addMaterialSectionHeader(doc, 'Accessibility Analysis', { accentColor: COLORS.info });

    const accessibility = scanResults.pages?.[0]?.bestPractices?.categories?.accessibility;
    if (!accessibility) {
      doc.fillColor(COLORS.textSecondary).fontSize(11).text('No accessibility data available', 50, doc.y + 10);
      doc.addPage();
      return;
    }

    // Accessibility Score Gauge
    const a11yScore = accessibility.percentage || accessibility.score || 0;
    const gaugeHeight = drawGaugeChart(doc, a11yScore, 'Accessibility Score', 297.5, doc.y + 80, {
      radius: 80,
      width: 15,
      showValue: true,
      showLabel: true
    });

    doc.y += gaugeHeight + 30;

    // Font Size Analysis
    if (accessibility.minFontSize !== undefined) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textPrimary)
         .text('Font Size Analysis', 50, doc.y + 10);
      doc.y += 25;

      const meetsStandard = accessibility.minFontSize >= 16;
      drawCard(doc, 50, doc.y, 512, 60, {
        elevation: 1,
        backgroundColor: COLORS.surface
      });

      doc.rect(50, doc.y, 4, 60).fillColor(meetsStandard ? COLORS.success : COLORS.error).fill();

      doc.fillColor(COLORS.textPrimary).fontSize(11)
         .text(`Minimum Font Size: ${accessibility.minFontSize}px`, 70, doc.y + 15);

      const statusText = meetsStandard
        ? '✓ Meets accessibility guidelines (16px minimum)'
        : '⚠ Below recommended 16px minimum';
      doc.fillColor(meetsStandard ? COLORS.success : COLORS.error).fontSize(9)
         .text(statusText, 70, doc.y + 35);

      doc.y += 70;
    }

    // Readability Issues
    if (accessibility.readabilityIssues && accessibility.readabilityIssues.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.error)
         .text('Readability Issues', 50, doc.y + 10);
      doc.y += 20;

      accessibility.readabilityIssues.slice(0, 5).forEach(issue => {
        drawCard(doc, 50, doc.y, 512, 35, {
          elevation: 1,
          backgroundColor: COLORS.surface
        });

        doc.rect(50, doc.y, 4, 35).fillColor(COLORS.error).fill();
        doc.fillColor(COLORS.textPrimary).fontSize(9)
           .text(`• ${issue}`, 70, doc.y + 11, { width: 460 });

        doc.y += 45;
      });
    }

    // Good Practices
    if (accessibility.goodPractices && accessibility.goodPractices.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.success)
         .text('Good Practices', 50, doc.y + 10);
      doc.y += 20;

      accessibility.goodPractices.forEach(practice => {
        drawCard(doc, 50, doc.y, 512, 35, {
          elevation: 1,
          backgroundColor: COLORS.surface
        });

        doc.rect(50, doc.y, 4, 35).fillColor(COLORS.success).fill();
        doc.fillColor(COLORS.textPrimary).fontSize(9)
           .text(`• ${practice}`, 70, doc.y + 11, { width: 460 });

        doc.y += 45;
      });
    }

    doc.addPage();
  }

  async addMultiPageAnalysis(doc, pages) {
    addMaterialSectionHeader(doc, 'Multi-Page Analysis', { accentColor: COLORS.secondary });

    doc.fillColor(COLORS.textSecondary).fontSize(11).font('Helvetica')
       .text(`Analyzing ${pages.length} pages across the target domain`, 50, doc.y + 10);

    doc.y += 30;

    pages.forEach((page, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      // Page header
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textPrimary)
         .text(`Page ${index + 1}: ${this.truncateUrl(page.url)}`, 50, doc.y + 10);
      doc.y += 25;

      // Metrics card
      drawCard(doc, 50, doc.y, 512, 100, {
        elevation: 1,
        backgroundColor: COLORS.surface
      });

      const metrics = [
        { label: 'Font Count', value: (page.fonts?.totalFonts || 0).toString() },
        { label: 'Load Time', value: `${page.performance?.initialLoadTime || 0}ms` },
        { label: 'LCP', value: `${Math.round(page.lighthouse?.desktop?.metrics?.coreWebVitals?.lcp || 0)}ms` },
        { label: 'CLS', value: (page.lighthouse?.desktop?.metrics?.coreWebVitals?.cls || 0).toFixed(3) }
      ];

      metrics.forEach((metric, metricIndex) => {
        const yPos = doc.y + 15 + (metricIndex * 20);
        doc.fillColor(COLORS.textSecondary).fontSize(9).text(metric.label + ':', 70, yPos);
        doc.fillColor(COLORS.textPrimary).fontSize(9).font('Helvetica-Bold').text(metric.value, 200, yPos);
        doc.font('Helvetica');
      });

      doc.y += 110;
    });

    doc.addPage();
  }

  async addDesktopMobileComparison(doc, lighthouse) {
    addMaterialSectionHeader(doc, 'Desktop vs Mobile Performance', { accentColor: COLORS.primary });

    if (!lighthouse || !lighthouse.desktop || !lighthouse.mobile) {
      doc.fillColor(COLORS.textSecondary).fontSize(11).text('Lighthouse analysis not available', 50, doc.y + 10);
      doc.addPage();
      return;
    }

    // Dual Gauge Charts (Desktop and Mobile Scores)
    const desktopScore = lighthouse.desktop.score || 0;
    const mobileScore = lighthouse.mobile.score || 0;

    // Desktop Gauge (left)
    drawGaugeChart(doc, desktopScore, 'Desktop Score', 170, doc.y + 80, {
      radius: 70,
      width: 12,
      showValue: true,
      showLabel: true
    });

    // Mobile Gauge (right)
    drawGaugeChart(doc, mobileScore, 'Mobile Score', 425, doc.y - 90, {
      radius: 70,
      width: 12,
      showValue: true,
      showLabel: true
    });

    doc.y += 100;

    // Comparison Chart for Metrics
    const metrics = [
      {
        label: 'Performance Score',
        value1: desktopScore,
        value2: mobileScore
      },
      {
        label: 'FCP',
        value1: Math.round(lighthouse.desktop.metrics?.firstContentfulPaint || 0),
        value2: Math.round(lighthouse.mobile.metrics?.firstContentfulPaint || 0)
      },
      {
        label: 'LCP',
        value1: Math.round(lighthouse.desktop.metrics?.coreWebVitals?.lcp || 0),
        value2: Math.round(lighthouse.mobile.metrics?.coreWebVitals?.lcp || 0)
      }
    ];

    const comparisonHeight = drawComparisonChart(doc, metrics, 50, doc.y, {
      width: 512,
      height: 180,
      labels: ['Desktop', 'Mobile'],
      colors: [COLORS.primary, COLORS.secondary]
    });

    doc.y += comparisonHeight + 30;

    // CLS Comparison (different scale)
    const clsDesktop = lighthouse.desktop.metrics?.coreWebVitals?.cls || 0;
    const clsMobile = lighthouse.mobile.metrics?.coreWebVitals?.cls || 0;

    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textPrimary)
       .text('Cumulative Layout Shift (CLS)', 50, doc.y + 10);
    doc.y += 25;

    const clsMetrics = [
      { label: 'Desktop CLS', value: clsDesktop.toFixed(3), color: getScoreColor(100 - clsDesktop * 100) },
      { label: 'Mobile CLS', value: clsMobile.toFixed(3), color: getScoreColor(100 - clsMobile * 100) }
    ];

    const clsGridHeight = drawMetricGrid(doc, clsMetrics, 50, doc.y, { columns: 2, spacing: 16 });
    doc.y += clsGridHeight;

    doc.addPage();
  }

  async addWeaknessAnalysis(doc, scanResults) {
    addMaterialSectionHeader(doc, 'Comprehensive Weakness Analysis', { accentColor: COLORS.error });

    const weaknesses = this.aggregateWeaknesses(scanResults);

    // Critical issues
    if (weaknesses.critical.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.error)
         .text('Critical Issues', 50, doc.y + 10);
      doc.y += 20;

      weaknesses.critical.forEach((issue) => {
        drawCard(doc, 50, doc.y, 512, 40, {
          elevation: 1,
          backgroundColor: COLORS.surface
        });

        doc.rect(50, doc.y, 4, 40).fillColor(COLORS.error).fill();
        doc.fillColor(COLORS.textPrimary).fontSize(10)
           .text(`• ${issue}`, 70, doc.y + 13, { width: 460 });

        doc.y += 50;
      });
    }

    // High priority issues
    if (weaknesses.high.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.warning)
         .text('High Priority Issues', 50, doc.y + 10);
      doc.y += 20;

      weaknesses.high.forEach((issue) => {
        drawCard(doc, 50, doc.y, 512, 40, {
          elevation: 1,
          backgroundColor: COLORS.surface
        });

        doc.rect(50, doc.y, 4, 40).fillColor(COLORS.warning).fill();
        doc.fillColor(COLORS.textPrimary).fontSize(10)
           .text(`• ${issue}`, 70, doc.y + 13, { width: 460 });

        doc.y += 50;
      });
    }

    // Medium priority issues
    if (weaknesses.medium.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.info)
         .text('Medium Priority Issues', 50, doc.y + 10);
      doc.y += 20;

      weaknesses.medium.forEach((issue) => {
        drawCard(doc, 50, doc.y, 512, 40, {
          elevation: 1,
          backgroundColor: COLORS.surface
        });

        doc.rect(50, doc.y, 4, 40).fillColor(COLORS.info).fill();
        doc.fillColor(COLORS.textPrimary).fontSize(10)
           .text(`• ${issue}`, 70, doc.y + 13, { width: 460 });

        doc.y += 50;
      });
    }

    doc.addPage();
  }

  async addRecommendations(doc, scanResults) {
    addMaterialSectionHeader(doc, 'Recommendations', { accentColor: COLORS.success });

    const recommendations = this.generateRecommendations(scanResults);

    recommendations.forEach((rec, index) => {
      if (doc.y > 650) {
        doc.addPage();
      }

      // Recommendation card
      const cardHeight = rec.impact ? 90 : 70;
      drawCard(doc, 50, doc.y, 512, cardHeight, {
        elevation: 1,
        backgroundColor: COLORS.surface
      });

      // Priority indicator bar (all recommendations are success/info colored)
      doc.rect(50, doc.y, 4, cardHeight).fillColor(COLORS.success).fill();

      // Title
      doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.textPrimary)
         .text(`${index + 1}. ${rec.title}`, 70, doc.y + 15, { width: 460 });

      // Description
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.textSecondary)
         .text(rec.description, 70, doc.y + 35, { width: 460 });

      // Impact
      if (rec.impact) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor(COLORS.success)
           .text(`✓ Expected Impact: ${rec.impact}`, 70, doc.y + 65);
      }

      doc.y += cardHeight + 15;
    });
  }

  async addAppendix(doc, scanResults) {
    doc.addPage();
    addMaterialSectionHeader(doc, 'Technical Appendix', { accentColor: COLORS.textSecondary });

    // Font inventory
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textPrimary)
       .text('Font Inventory', 50, doc.y + 10);
    doc.y += 25;

    if (scanResults.pages && scanResults.pages[0]?.fonts) {
      const fonts = scanResults.pages[0].fonts;

      ['system', 'webFonts', 'googleFonts'].forEach((categoryKey) => {
        const fontList = fonts.categorizedFonts?.[categoryKey] || [];

        if (fontList.length > 0) {
          const categoryName = this.formatCategoryName(categoryKey);

          doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.textSecondary)
             .text(`${categoryName}:`, 50, doc.y + 10);
          doc.y += 20;

          fontList.forEach((font) => {
            doc.fillColor(COLORS.textPrimary).fontSize(9).font('Helvetica')
               .text(`• ${font}`, 70, doc.y + 3);
            doc.moveDown(0.3);
          });

          doc.y += 10;
        }
      });
    }
  }


  calculateExecutiveSummary(scanResults) {
    const summary = {
      fontScore: 50,
      desktopScore: 0,
      mobileScore: 0,
      accessibilityScore: 0,
      keyFindings: [],
    };

    if (scanResults.pages && scanResults.pages.length > 0) {
      const mainPage = scanResults.pages[0];
      summary.fontScore = mainPage.bestPractices?.score || 50;
    }

    if (scanResults.lighthouse) {
      summary.desktopScore = scanResults.lighthouse.desktop?.score || 0;
      summary.mobileScore = scanResults.lighthouse.mobile?.score || 0;
      summary.accessibilityScore = scanResults.lighthouse.desktop?.accessibility?.score || 0;
    }

    // Generate key findings
    if (summary.fontScore < 60) {
      summary.keyFindings.push('Font optimization needs significant improvement');
    }
    if (summary.desktopScore - summary.mobileScore > 20) {
      summary.keyFindings.push('Large performance gap between desktop and mobile');
    }
    if (summary.accessibilityScore < 80) {
      summary.keyFindings.push('Accessibility issues require attention');
    }

    return summary;
  }

  aggregateWeaknesses(scanResults) {
    const weaknesses = { critical: [], high: [], medium: [] };

    // Analyze all pages for weaknesses
    if (scanResults.pages) {
      scanResults.pages.forEach((page) => {
        if (page.lighthouse) {
          // Add Lighthouse issues
          if (page.lighthouse.desktop?.accessibility?.issues) {
            page.lighthouse.desktop.accessibility.issues.forEach((issue) => {
              if (issue.impact === 'high') {
                weaknesses.critical.push(`${issue.title} (Desktop)`);
              } else if (issue.impact === 'medium') {
                weaknesses.high.push(`${issue.title} (Desktop)`);
              }
            });
          }
        }
      });
    }

    return weaknesses;
  }

  generateRecommendations(scanResults) {
    const recommendations = [];

    // Font-specific recommendations
    recommendations.push({
      title: 'Optimize Font Loading Strategy',
      description:
        'Implement font-display: swap for all custom fonts to prevent invisible text during font loading. Consider using preload for critical fonts.',
      impact: 'Reduced First Contentful Paint by 200-500ms',
    });

    recommendations.push({
      title: 'Reduce Font Requests',
      description:
        'Consolidate font variations and consider using variable fonts to reduce the number of font requests.',
      impact: 'Improved loading performance by 15-25%',
    });

    if (scanResults.lighthouse?.desktop?.score < 70) {
      recommendations.push({
        title: 'Improve Core Web Vitals',
        description:
          'Focus on optimizing Largest Contentful Paint and Cumulative Layout Shift through better resource prioritization.',
        impact: 'Better search engine rankings and user experience',
      });
    }

    return recommendations;
  }


  getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  formatCategoryName(category) {
    const categoryNames = {
      fontDisplay: 'Font Display',
      fontLoading: 'Font Loading',
      accessibility: 'Accessibility',
      performance: 'Performance',
      fontOptimization: 'Font Optimization',
      fallbacks: 'Font Fallbacks',
      security: 'Security',
      caching: 'Caching',
      sustainability: 'Sustainability',
      webVitals: 'Web Vitals Impact'
    };
    return categoryNames[category] || category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  truncateUrl(url) {
    if (url.length > 60) {
      return url.substring(0, 57) + '...';
    }
    return url;
  }
}

module.exports = new PDFReportGenerator();
