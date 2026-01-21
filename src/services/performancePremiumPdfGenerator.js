/**
 * Performance Premium PDF Report Generator
 *
 * Creates a high-value, professionally designed Performance report worth $10+
 * Extends the PremiumPdfReport base class with performance-specific content:
 * - Executive Summary with Core Web Vitals
 * - Industry performance benchmarks comparison
 * - Prioritized optimization roadmap
 * - Detailed analysis with plain English explanations
 *
 * @module services/performancePremiumPdfGenerator
 */

const { PremiumPdfReport, PREMIUM } = require('../utils/premiumPdfTemplate');
const {
  drawGaugeChart,
  drawBarChart,
  drawPieChart,
  drawProgressBar,
  drawComparisonChart,
  drawThresholdChart,
  getScoreColor,
  COLORS
} = require('../utils/pdfCharts');
const { createLogger } = require('../utils/logger');
const { checkPageBreakNeeded, drawCard } = require('../utils/pdfHelpers');
const { formatBytes } = require('../utils/formatHelpers');

const logger = createLogger('PerformancePremiumPdfGenerator');

// Performance-specific benchmarks
const PERFORMANCE_BENCHMARKS = {
  industryAverage: 55,
  topPerformers: 92,
  competitorsAverage: 62,
  // Component benchmarks
  fcp: { average: 58, top: 90 },
  lcp: { average: 52, top: 88 },
  tbt: { average: 60, top: 92 },
  cls: { average: 70, top: 95 },
  speedIndex: { average: 55, top: 85 }
};

// Core Web Vitals thresholds
const CWV_THRESHOLDS = {
  lcp: { good: 2.5, poor: 4.0, unit: 's' },
  fid: { good: 100, poor: 300, unit: 'ms' },
  cls: { good: 0.1, poor: 0.25, unit: '' },
  fcp: { good: 1.8, poor: 3.0, unit: 's' },
  tbt: { good: 200, poor: 600, unit: 'ms' },
  ttfb: { good: 800, poor: 1800, unit: 'ms' }
};

// Performance business impact templates
const PERFORMANCE_BUSINESS_IMPACT = {
  excellent: {
    summary: 'Your site loads exceptionally fast. This provides excellent user experience and likely contributes to higher conversions and better SEO rankings.',
    metrics: [
      'Google rewards fast sites with better search rankings',
      'Users are 24% more likely to stay on fast-loading pages',
      'Fast sites have 70% longer average session duration'
    ]
  },
  good: {
    summary: 'Your performance is above average but there\'s room for improvement. Small optimizations could noticeably improve user experience.',
    metrics: [
      'Each 100ms delay can reduce conversions by 7%',
      'Optimizing images could save seconds of load time',
      'Mobile users are particularly sensitive to speed'
    ]
  },
  fair: {
    summary: 'Your site has performance issues affecting user experience. Slow pages lead to higher bounce rates and lower conversions.',
    metrics: [
      '53% of mobile visitors leave if page takes >3s to load',
      'Slow sites see 38% higher bounce rates',
      'Performance issues are hurting your SEO rankings'
    ]
  },
  poor: {
    summary: 'Critical performance problems are severely impacting user experience. Your slow load times are likely costing you customers.',
    metrics: [
      'You\'re losing visitors before they see your content',
      'Search engines penalize slow websites',
      'Competitors with faster sites capture your potential customers'
    ]
  }
};

/**
 * Performance Premium PDF Generator
 * Extends PremiumPdfReport with performance-specific content and insights
 */
class PerformancePremiumPdfGenerator extends PremiumPdfReport {
  constructor() {
    super({
      reportType: 'Performance',
      reportTitle: 'Performance Analysis Report',
      reportSubtitle: 'Speed & Core Web Vitals Assessment',
      accentColor: '#1565C0' // Material Blue 800 for Performance
    });
  }

  /**
   * Generate the complete Performance premium report
   */
  async generateReport(performanceResults) {
    try {
      this.initializeDocument(performanceResults);

      // Page 1: Cover
      this.addCoverPage(performanceResults);

      // Page 2: Executive Summary
      this.addExecutiveSummary(performanceResults, {
        componentScores: this._extractComponentScores(performanceResults),
        keyFindings: this._extractKeyFindings(performanceResults),
        businessImpact: this._getBusinessImpact(performanceResults.overallScore || performanceResults.performanceScore || 0)
      });

      // Page 3: Industry Benchmarks
      this.addBenchmarkComparison(performanceResults, PERFORMANCE_BENCHMARKS);

      // Page 4: Core Web Vitals Deep Dive
      this.addCoreWebVitalsSection(performanceResults);

      // Page 5+: Action Roadmap
      this.addActionRoadmap(this._enhanceRecommendations(performanceResults.recommendations || []));

      // Detailed Analysis Sections
      this.addLoadingTimelineSection(performanceResults);
      this.addResourceAnalysisSection(performanceResults);

      // Desktop vs Mobile comparison
      if (performanceResults.desktop && performanceResults.mobile) {
        this.addDeviceComparisonSection(performanceResults);
      }

      // Final page: Optimization Checklist
      this.addOptimizationChecklist(performanceResults);

      return await this.finalize();
    } catch (error) {
      logger.error('Error generating Performance premium PDF:', error);
      throw error;
    }
  }

  /**
   * Override: Extract key stats for cover page
   */
  _extractKeyStats(data) {
    const score = data.overallScore || data.performanceScore || 0;
    const lcpScore = data.lcp?.score || 0;
    const clsScore = data.cls?.score || 0;

    // Check Core Web Vitals pass status
    const cwvPass = this._checkCWVPass(data);

    return [
      {
        label: 'Performance',
        value: score,
        color: getScoreColor(score)
      },
      {
        label: 'LCP Score',
        value: lcpScore,
        color: getScoreColor(lcpScore)
      },
      {
        label: 'CWV Status',
        value: cwvPass ? 'PASS' : 'FAIL',
        color: cwvPass ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical
      }
    ];
  }

  /**
   * Check if Core Web Vitals pass
   */
  _checkCWVPass(data) {
    const lcpPass = (data.lcp?.score || 0) >= 90;
    const clsPass = (data.cls?.score || 0) >= 90;
    const tbtPass = (data.tbt?.score || 0) >= 90; // TBT as proxy for FID
    return lcpPass && clsPass && tbtPass;
  }

  /**
   * Extract component scores for executive summary
   */
  _extractComponentScores(data) {
    return {
      'FCP': data.fcp?.score || 0,
      'LCP': data.lcp?.score || 0,
      'TBT': data.tbt?.score || 0,
      'CLS': data.cls?.score || 0,
      'Speed Index': data.speedIndex?.score || 0
    };
  }

  /**
   * Extract top issues as key findings
   */
  _extractKeyFindings(data) {
    const findings = [];

    // Check Core Web Vitals
    if (data.lcp && data.lcp.score < 50) {
      findings.push({
        title: 'Largest Contentful Paint is Poor',
        description: `LCP of ${data.lcp.displayValue || 'N/A'} is above the 4s threshold. Main content loads too slowly.`,
        priority: 'high'
      });
    } else if (data.lcp && data.lcp.score < 90) {
      findings.push({
        title: 'LCP Needs Improvement',
        description: `LCP of ${data.lcp.displayValue || 'N/A'} could be optimized for better user experience.`,
        priority: 'medium'
      });
    }

    if (data.cls && data.cls.score < 50) {
      findings.push({
        title: 'Layout Shift Issues Detected',
        description: `CLS of ${data.cls.displayValue || 'N/A'} indicates visible content is shifting during load.`,
        priority: 'high'
      });
    }

    if (data.tbt && data.tbt.score < 50) {
      findings.push({
        title: 'High Blocking Time',
        description: `TBT of ${data.tbt.displayValue || 'N/A'} means the page is unresponsive during load.`,
        priority: 'high'
      });
    }

    // Add from recommendations
    const recs = data.recommendations || [];
    const highPriority = recs.filter(r => r.priority === 'high');
    highPriority.slice(0, 2).forEach(rec => {
      if (findings.length < 5) {
        findings.push({
          title: rec.title || rec.message,
          description: rec.description,
          priority: 'high'
        });
      }
    });

    return findings;
  }

  /**
   * Get business impact based on score
   */
  _getBusinessImpact(score) {
    if (score >= 90) return PERFORMANCE_BUSINESS_IMPACT.excellent;
    if (score >= 70) return PERFORMANCE_BUSINESS_IMPACT.good;
    if (score >= 50) return PERFORMANCE_BUSINESS_IMPACT.fair;
    return PERFORMANCE_BUSINESS_IMPACT.poor;
  }

  /**
   * Enhance recommendations with effort/impact ratings
   */
  _enhanceRecommendations(recommendations) {
    return recommendations.map(rec => {
      let effort = 'medium';
      let impact = 'high';

      const title = (rec.title || rec.message || '').toLowerCase();

      // Easy fixes
      if (title.includes('compress') ||
          title.includes('minify') ||
          title.includes('cache') ||
          title.includes('lazy')) {
        effort = 'easy';
      }

      // Hard fixes
      if (title.includes('server') ||
          title.includes('cdn') ||
          title.includes('architecture') ||
          title.includes('redesign')) {
        effort = 'hard';
      }

      // Lower impact
      if (title.includes('font') || rec.priority === 'low') {
        impact = 'medium';
      }

      return {
        ...rec,
        effort,
        impact,
        fix: rec.fix || rec.solution || this._generatePerformanceFix(rec)
      };
    });
  }

  /**
   * Generate a fix suggestion if none provided
   */
  _generatePerformanceFix(rec) {
    const title = (rec.title || rec.message || '').toLowerCase();

    if (title.includes('image')) {
      return 'Compress images with tools like ImageOptim or use modern formats like WebP. Implement lazy loading for below-the-fold images.';
    }
    if (title.includes('javascript') || title.includes('script')) {
      return 'Minify JavaScript, remove unused code, and defer non-critical scripts. Consider code splitting for large bundles.';
    }
    if (title.includes('css')) {
      return 'Minify CSS, remove unused styles, and inline critical CSS. Defer non-critical stylesheets.';
    }
    if (title.includes('cache')) {
      return 'Set appropriate Cache-Control headers. Static assets should have long cache times (1 year).';
    }
    if (title.includes('render-blocking')) {
      return 'Defer or async load non-critical JavaScript. Inline critical CSS and defer the rest.';
    }
    if (title.includes('lcp') || title.includes('largest')) {
      return 'Optimize the LCP element (usually hero image or heading). Preload critical resources.';
    }

    return 'Analyze this issue and implement appropriate optimizations based on best practices.';
  }

  /**
   * Add Core Web Vitals deep dive section
   */
  addCoreWebVitalsSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Core Web Vitals', {
      subtitle: 'Google\'s essential user experience metrics'
    });

    const doc = this.doc;

    // CWV Status summary
    const cwvPass = this._checkCWVPass(data);

    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
      backgroundColor: cwvPass ? '#F5F5F5' : '#FFEBEE',
      borderColor: cwvPass ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical
    });

    const statusY = doc.y;

    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(cwvPass ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical)
       .text(cwvPass ? 'Core Web Vitals: PASSING' : 'Core Web Vitals: NEEDS WORK', 70, statusY + 25);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(
         cwvPass
           ? 'Your site meets Google\'s Core Web Vitals thresholds for a good user experience.'
           : 'One or more Core Web Vitals are below Google\'s thresholds. This may affect your search rankings.',
         70, statusY + 50, { width: 470 }
       );

    doc.y = statusY + 100;

    // Individual CWV metrics
    const cwvMetrics = [
      {
        name: 'LCP - Largest Contentful Paint',
        description: 'How long until the main content is visible',
        value: data.lcp?.displayValue || 'N/A',
        score: data.lcp?.score || 0,
        threshold: CWV_THRESHOLDS.lcp,
        impact: 'Directly impacts perceived load speed'
      },
      {
        name: 'TBT - Total Blocking Time',
        description: 'How long the page is unresponsive (proxy for FID)',
        value: data.tbt?.displayValue || 'N/A',
        score: data.tbt?.score || 0,
        threshold: CWV_THRESHOLDS.tbt,
        impact: 'Affects interactivity and responsiveness'
      },
      {
        name: 'CLS - Cumulative Layout Shift',
        description: 'How much content moves around during load',
        value: data.cls?.displayValue || 'N/A',
        score: data.cls?.score || 0,
        threshold: CWV_THRESHOLDS.cls,
        impact: 'Causes accidental clicks and frustration'
      }
    ];

    cwvMetrics.forEach(metric => {
      checkPageBreakNeeded(doc, 120);

      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 95, {
        backgroundColor: metric.score >= 90 ? '#F5F5F5' : metric.score >= 50 ? '#FFF3E0' : '#FFEBEE'
      });

      const cardY = doc.y;

      // Metric name
      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(metric.name, 70, cardY + 15);

      // Score gauge (small)
      drawGaugeChart(doc, metric.score, '', 490, cardY + 50, {
        radius: 30,
        width: 6,
        showValue: true,
        showLabel: false
      });

      // Value
      doc.fontSize(PREMIUM.SIZES.sectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(getScoreColor(metric.score))
         .text(metric.value, 70, cardY + 40);

      // Description
      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(metric.description, 70, cardY + 60);

      // Impact
      doc.fontSize(PREMIUM.SIZES.caption)
         .fillColor(PREMIUM.COLORS.textMuted)
         .text(`Impact: ${metric.impact}`, 70, cardY + 75);

      doc.y = cardY + 105;
    });

    // Plain English explanation
    doc.moveDown(0.5);

    this._addPlainEnglishBox(
      'Why Core Web Vitals Matter',
      'Google uses Core Web Vitals as ranking signals. Sites that pass all three metrics get a ranking boost, while poor scores can hurt your position in search results. More importantly, these metrics directly correlate with user satisfaction and conversion rates.'
    );

    this._addPageNumber();
  }

  /**
   * Add Loading Timeline section
   */
  addLoadingTimelineSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Loading Timeline', {
      subtitle: 'How your page loads over time'
    });

    const doc = this.doc;

    // Timeline visualization
    const timelineY = doc.y + 30;
    const timelineX = 80;
    const timelineWidth = 450;

    // Draw timeline base
    doc.strokeColor(PREMIUM.COLORS.divider)
       .lineWidth(3)
       .moveTo(timelineX, timelineY)
       .lineTo(timelineX + timelineWidth, timelineY)
       .stroke();

    // Timeline markers
    const markers = [
      { label: 'TTFB', value: data.ttfb?.displayValue, position: 0.1, color: COLORS.info },
      { label: 'FCP', value: data.fcp?.displayValue, position: 0.25, color: COLORS.success },
      { label: 'SI', value: data.speedIndex?.displayValue, position: 0.5, color: COLORS.good },
      { label: 'LCP', value: data.lcp?.displayValue, position: 0.7, color: COLORS.warning },
      { label: 'TTI', value: data.tti?.displayValue, position: 0.9, color: COLORS.primary }
    ];

    markers.forEach(marker => {
      if (marker.value) {
        const x = timelineX + (timelineWidth * marker.position);

        // Marker dot
        doc.circle(x, timelineY, 8)
           .fillColor(marker.color)
           .fill();

        // Label above
        doc.fontSize(PREMIUM.SIZES.small)
           .font(PREMIUM.FONTS.heading)
           .fillColor(marker.color)
           .text(marker.label, x - 20, timelineY - 25, { width: 40, align: 'center' });

        // Value below
        doc.fontSize(PREMIUM.SIZES.caption)
           .font(PREMIUM.FONTS.body)
           .fillColor(PREMIUM.COLORS.textSecondary)
           .text(marker.value, x - 25, timelineY + 15, { width: 50, align: 'center' });
      }
    });

    doc.y = timelineY + 60;

    // Metric explanations
    const metricExplanations = [
      { abbr: 'TTFB', full: 'Time to First Byte', desc: 'Server response time' },
      { abbr: 'FCP', full: 'First Contentful Paint', desc: 'First visible content' },
      { abbr: 'SI', full: 'Speed Index', desc: 'Visual completeness over time' },
      { abbr: 'LCP', full: 'Largest Contentful Paint', desc: 'Main content visible' },
      { abbr: 'TTI', full: 'Time to Interactive', desc: 'Page fully interactive' }
    ];

    doc.moveDown(1);

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Metric Definitions', 50, doc.y);

    doc.moveDown(0.5);

    metricExplanations.forEach(metric => {
      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(`${metric.abbr}: `, 60, doc.y, { continued: true })
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(`${metric.full} - ${metric.desc}`);
      doc.moveDown(0.3);
    });

    doc.moveDown(1);

    // Speed Index breakdown
    if (data.speedIndex) {
      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 100, {
        backgroundColor: PREMIUM.SECTIONS.executive
      });

      const cardY = doc.y;

      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Speed Index Analysis', 70, cardY + 15);

      drawProgressBar(doc, data.speedIndex.score || 0, '', 70, cardY + 45, {
        width: 400,
        height: 20,
        showPercentage: false
      });

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(
           `Speed Index of ${data.speedIndex.displayValue || 'N/A'} indicates how quickly content is visually displayed. Lower is better.`,
           70, cardY + 75, { width: 450 }
         );

      doc.y = cardY + 115;
    }

    this._addPageNumber();
  }

  /**
   * Add Resource Analysis section
   */
  addResourceAnalysisSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Resource Analysis', {
      subtitle: 'What\'s loading on your page',
      icon: '📦'
    });

    const doc = this.doc;

    if (!data.resources) {
      this._addPlainEnglishBox(
        'No Resource Data',
        'Detailed resource analysis data is not available for this scan.'
      );
      this._addPageNumber();
      return;
    }

    const resources = data.resources;

    // Resource distribution pie chart
    const pieData = [];
    if (resources.scripts?.size > 0) {
      pieData.push({ label: 'JavaScript', value: resources.scripts.size, color: COLORS.warning });
    }
    if (resources.stylesheets?.size > 0) {
      pieData.push({ label: 'CSS', value: resources.stylesheets.size, color: COLORS.info });
    }
    if (resources.images?.size > 0) {
      pieData.push({ label: 'Images', value: resources.images.size, color: COLORS.success });
    }
    if (resources.fonts?.size > 0) {
      pieData.push({ label: 'Fonts', value: resources.fonts.size, color: COLORS.secondary });
    }

    if (pieData.length > 0) {
      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Resource Size Distribution', 50, doc.y);

      doc.moveDown(1);

      const totalSize = pieData.reduce((sum, d) => sum + d.value, 0);

      drawPieChart(doc, pieData, 180, doc.y + 80, {
        radius: 60,
        donutWidth: 20,
        showLegend: true,
        showPercentages: true,
        centerText: formatBytes(totalSize),
        centerLabel: 'Total'
      });

      doc.y += 200;
    }

    // Resource breakdown cards
    const resourceTypes = [
      { name: 'JavaScript', data: resources.scripts, color: COLORS.warning, tip: 'Minify and defer non-critical scripts' },
      { name: 'CSS', data: resources.stylesheets, color: COLORS.info, tip: 'Inline critical CSS, defer the rest' },
      { name: 'Images', data: resources.images, color: COLORS.success, tip: 'Compress and lazy-load images' },
      { name: 'Fonts', data: resources.fonts, color: COLORS.secondary, tip: 'Use font-display: swap' }
    ];

    resourceTypes.forEach(resource => {
      if (resource.data && resource.data.size > 0) {
        this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 55, {
          backgroundColor: '#FAFAFA'
        });

        const cardY = doc.y;

        // Resource name
        doc.fontSize(PREMIUM.SIZES.body)
           .font(PREMIUM.FONTS.heading)
           .fillColor(resource.color)
           .text(resource.name, 70, cardY + 12);

        // Size and count
        doc.fontSize(PREMIUM.SIZES.sectionTitle)
           .font(PREMIUM.FONTS.heading)
           .fillColor(PREMIUM.COLORS.textPrimary)
           .text(formatBytes(resource.data.size), 200, cardY + 10);

        doc.fontSize(PREMIUM.SIZES.small)
           .font(PREMIUM.FONTS.body)
           .fillColor(PREMIUM.COLORS.textMuted)
           .text(`${resource.data.count || 0} files`, 200, cardY + 30);

        // Optimization tip
        doc.fontSize(PREMIUM.SIZES.caption)
           .fillColor(PREMIUM.COLORS.textSecondary)
           .text(`Tip: ${resource.tip}`, 350, cardY + 20, { width: 200 });

        doc.y = cardY + 65;
      }
    });

    // Render-blocking resources warning
    if (data.renderBlockingResources && data.renderBlockingResources.length > 0) {
      doc.moveDown(1);

      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
        backgroundColor: '#FFEBEE',
        borderColor: PREMIUM.COLORS.critical
      });

      const warningY = doc.y;

      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.critical)
         .text(`${data.renderBlockingResources.length} Render-Blocking Resources`, 70, warningY + 15);

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(
           'These resources delay page rendering. Defer or async load scripts, and inline critical CSS.',
           70, warningY + 40, { width: 470 }
         );

      doc.y = warningY + 95;
    }

    this._addPageNumber();
  }

  /**
   * Add Desktop vs Mobile comparison
   */
  addDeviceComparisonSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Desktop vs Mobile', {
      subtitle: 'Performance across device types'
    });

    const doc = this.doc;
    const desktop = data.desktop;
    const mobile = data.mobile;

    const desktopScore = desktop.performanceScore || desktop.overallScore || 0;
    const mobileScore = mobile.performanceScore || mobile.overallScore || 0;

    // Side by side gauges
    drawGaugeChart(doc, desktopScore, 'Desktop', 180, doc.y + 80, {
      radius: 60,
      width: 12,
      showValue: true,
      showLabel: true
    });

    drawGaugeChart(doc, mobileScore, 'Mobile', 430, doc.y, {
      radius: 60,
      width: 12,
      showValue: true,
      showLabel: true
    });

    doc.y += 120;

    // Comparison metrics
    doc.moveDown(1);

    const metrics = [
      { label: 'Overall Score', desktop: desktopScore, mobile: mobileScore },
      { label: 'FCP', desktop: desktop.fcp?.score || 0, mobile: mobile.fcp?.score || 0 },
      { label: 'LCP', desktop: desktop.lcp?.score || 0, mobile: mobile.lcp?.score || 0 },
      { label: 'TBT', desktop: desktop.tbt?.score || 0, mobile: mobile.tbt?.score || 0 },
      { label: 'CLS', desktop: desktop.cls?.score || 0, mobile: mobile.cls?.score || 0 }
    ];

    const compData = metrics.map(m => ({
      label: m.label,
      value1: m.desktop,
      value2: m.mobile
    }));

    drawComparisonChart(doc, compData, 50, doc.y, {
      width: PREMIUM.PAGE.contentWidth,
      height: 180,
      labels: ['Desktop', 'Mobile'],
      colors: [COLORS.primary, COLORS.secondary]
    });

    doc.y += 200;

    // Plain English interpretation
    const scoreDiff = desktopScore - mobileScore;
    let interpretation;

    if (Math.abs(scoreDiff) < 10) {
      interpretation = 'Desktop and mobile performance are similar. Your site provides a consistent experience across devices.';
    } else if (scoreDiff > 0) {
      interpretation = `Mobile is ${scoreDiff} points slower than desktop. Mobile users experience slower load times, which may affect engagement on smartphones and tablets.`;
    } else {
      interpretation = `Mobile actually performs ${Math.abs(scoreDiff)} points better than desktop. This is unusual - consider investigating desktop-specific issues.`;
    }

    this._addPlainEnglishBox(
      'What This Comparison Tells You',
      interpretation + ' Remember that most users browse on mobile devices, so mobile performance is critical for success.'
    );

    this._addPageNumber();
  }

  /**
   * Add Optimization Checklist page
   */
  addOptimizationChecklist(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Optimization Checklist', {
      subtitle: 'Your performance improvement roadmap'
    });

    const doc = this.doc;
    const score = data.overallScore || data.performanceScore || 0;

    // Summary card
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 100, {
      backgroundColor: PREMIUM.SECTIONS.executive,
      shadow: true
    });

    const cardY = doc.y;

    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Performance Summary', 70, cardY + 20);

    const status = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs Work' : 'Critical';

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(
         `Your performance score of ${score} is ${status}. ` +
         'Use this checklist to systematically improve your page speed.',
         70, cardY + 45, { width: 470 }
       );

    doc.y = cardY + 120;

    // Quick wins checklist
    const checklist = [
      { text: 'Compress and optimize images', done: score >= 70 },
      { text: 'Minify JavaScript and CSS', done: score >= 60 },
      { text: 'Enable browser caching', done: score >= 50 },
      { text: 'Eliminate render-blocking resources', done: score >= 70 },
      { text: 'Lazy load images below the fold', done: score >= 80 },
      { text: 'Use a Content Delivery Network (CDN)', done: score >= 85 },
      { text: 'Optimize Core Web Vitals', done: this._checkCWVPass(data) }
    ];

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Performance Checklist', 50, doc.y);

    doc.moveDown(0.5);

    checklist.forEach(item => {
      // Draw status circle
      doc.circle(67, doc.y + 5, 5)
         .fillColor(item.done ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.textMuted)
         .fill();

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(item.done ? PREMIUM.COLORS.textSecondary : PREMIUM.COLORS.textPrimary)
         .text(item.text, 85, doc.y);

      doc.moveDown(0.7);
    });

    // Tools section
    doc.moveDown(1);

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Helpful Tools', 50, doc.y);

    doc.moveDown(0.5);

    const tools = [
      'Google PageSpeed Insights - web.dev/measure',
      'GTmetrix - gtmetrix.com',
      'WebPageTest - webpagetest.org',
      'Chrome DevTools Lighthouse'
    ];

    tools.forEach(tool => {
      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(`• ${tool}`, 60, doc.y);
      doc.moveDown(0.4);
    });

    // Footer
    doc.moveDown(2);

    doc.fontSize(PREMIUM.SIZES.caption)
       .font(PREMIUM.FONTS.emphasis)
       .fillColor(PREMIUM.COLORS.textMuted)
       .text(
         'Performance optimization is an ongoing process. Regular monitoring ensures your site stays fast.',
         50, doc.y,
         { width: PREMIUM.PAGE.contentWidth, align: 'center' }
       );

    this._addPageNumber();
  }
}

module.exports = PerformancePremiumPdfGenerator;
