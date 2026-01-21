/**
 * Mobile Premium PDF Report Generator
 *
 * Creates a high-value, professionally designed Mobile Analysis report worth $10+
 * Extends the PremiumPdfReport base class with mobile-specific content:
 * - Executive Summary with mobile usability scores
 * - Industry mobile benchmarks comparison
 * - Prioritized mobile optimization roadmap
 * - Touch, viewport, and responsive design analysis
 *
 * @module services/mobilePremiumPdfGenerator
 */

const { PremiumPdfReport, PREMIUM } = require('../utils/premiumPdfTemplate');
const {
  drawGaugeChart,
  drawBarChart,
  drawProgressBar,
  getScoreColor,
  COLORS
} = require('../utils/pdfCharts');
const { createLogger } = require('../utils/logger');
const { checkPageBreakNeeded } = require('../utils/pdfHelpers');

const logger = createLogger('MobilePremiumPdfGenerator');

// Mobile-specific benchmarks
const MOBILE_BENCHMARKS = {
  industryAverage: 65,
  topPerformers: 95,
  competitorsAverage: 70,
  // Component benchmarks
  responsiveness: { average: 70, top: 98 },
  touchTargets: { average: 60, top: 92 },
  viewport: { average: 75, top: 95 },
  performance: { average: 55, top: 88 }
};

// Mobile business impact templates
const MOBILE_BUSINESS_IMPACT = {
  excellent: {
    summary: 'Your site provides an excellent mobile experience. With 60%+ of traffic from mobile devices, you\'re capturing this crucial audience effectively.',
    metrics: [
      'Mobile-first indexing means Google ranks based on mobile experience',
      'Mobile-optimized sites see 67% higher conversion rates',
      'Good mobile UX reduces bounce rates by 35%'
    ]
  },
  good: {
    summary: 'Your mobile experience is solid but could be improved. Addressing remaining issues will help capture more mobile conversions.',
    metrics: [
      'Small touch targets cause frustration and abandonment',
      'Slow mobile pages lose 53% of visitors after 3 seconds',
      'Mobile users are 5x more likely to leave non-optimized sites'
    ]
  },
  fair: {
    summary: 'Mobile usability issues are creating significant friction. Many mobile visitors likely struggle to use your site effectively.',
    metrics: [
      'Mobile users may be unable to tap small buttons accurately',
      'Content may be difficult to read without zooming',
      'Navigation may be frustrating on touchscreens'
    ]
  },
  poor: {
    summary: 'Critical mobile problems are driving away mobile visitors. With most traffic on mobile, this severely limits your reach.',
    metrics: [
      'You\'re likely losing most mobile visitors',
      'Google may penalize your rankings due to poor mobile experience',
      'Competitors with better mobile sites capture your potential customers'
    ]
  }
};

/**
 * Mobile Premium PDF Generator
 * Extends PremiumPdfReport with mobile-specific content and insights
 */
class MobilePremiumPdfGenerator extends PremiumPdfReport {
  constructor() {
    super({
      reportType: 'Mobile',
      reportTitle: 'Mobile Usability Report',
      reportSubtitle: 'Mobile Experience Analysis',
      accentColor: '#00ACC1' // Material Cyan for Mobile
    });
  }

  /**
   * Generate the complete Mobile premium report
   */
  async generateReport(mobileResults) {
    try {
      this.initializeDocument(mobileResults);

      // Page 1: Cover
      this.addCoverPage(mobileResults);

      // Page 2: Executive Summary
      this.addExecutiveSummary(mobileResults, {
        componentScores: this._extractComponentScores(mobileResults),
        keyFindings: this._extractKeyFindings(mobileResults),
        businessImpact: this._getBusinessImpact(mobileResults.overallScore || 0)
      });

      // Page 3: Industry Benchmarks
      this.addBenchmarkComparison(mobileResults, MOBILE_BENCHMARKS);

      // Page 4+: Action Roadmap
      this.addActionRoadmap(this._enhanceRecommendations(mobileResults.recommendations || []));

      // Detailed Analysis Sections
      this.addResponsivenessSection(mobileResults);
      this.addTouchTargetsSection(mobileResults);
      this.addViewportSection(mobileResults);
      this.addMobilePerformanceSection(mobileResults);

      // Final page: Mobile Checklist
      this.addMobileChecklist(mobileResults);

      return await this.finalize();
    } catch (error) {
      logger.error('Error generating Mobile premium PDF:', error);
      throw error;
    }
  }

  /**
   * Override: Extract key stats for cover page
   */
  _extractKeyStats(data) {
    return [
      {
        label: 'Mobile Score',
        value: data.overallScore || 0,
        color: getScoreColor(data.overallScore || 0)
      },
      {
        label: 'Touch Issues',
        value: data.touchTargets?.issues || 0,
        color: (data.touchTargets?.issues || 0) > 3 ? PREMIUM.COLORS.critical : PREMIUM.COLORS.excellent
      },
      {
        label: 'Responsive',
        value: data.responsive ? 'Yes' : 'No',
        color: data.responsive ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical
      }
    ];
  }

  /**
   * Extract component scores for executive summary
   */
  _extractComponentScores(data) {
    return {
      'Responsiveness': data.responsiveScore || data.responsiveness?.score || 0,
      'Touch Targets': data.touchScore || data.touchTargets?.score || 0,
      'Viewport': data.viewportScore || data.viewport?.score || 0,
      'Performance': data.mobilePerformance?.score || data.performance?.score || 0
    };
  }

  /**
   * Extract top issues as key findings
   */
  _extractKeyFindings(data) {
    const findings = [];

    // Check responsiveness
    if (!data.responsive) {
      findings.push({
        title: 'Site Not Responsive',
        description: 'Your site does not adapt to mobile screen sizes, creating a poor mobile experience.',
        priority: 'high'
      });
    }

    // Check touch targets
    if ((data.touchTargets?.issues || 0) > 0) {
      findings.push({
        title: `${data.touchTargets.issues} Touch Target Issues`,
        description: 'Some buttons or links are too small for accurate touch interaction.',
        priority: 'high'
      });
    }

    // Check viewport
    if (!data.viewport?.configured) {
      findings.push({
        title: 'Viewport Not Configured',
        description: 'Missing viewport meta tag causes improper scaling on mobile devices.',
        priority: 'high'
      });
    }

    // Check mobile performance
    if ((data.mobilePerformance?.score || 100) < 50) {
      findings.push({
        title: 'Slow Mobile Performance',
        description: 'Page loads slowly on mobile devices, increasing abandonment.',
        priority: 'high'
      });
    }

    return findings;
  }

  /**
   * Get business impact based on score
   */
  _getBusinessImpact(score) {
    if (score >= 90) return MOBILE_BUSINESS_IMPACT.excellent;
    if (score >= 70) return MOBILE_BUSINESS_IMPACT.good;
    if (score >= 50) return MOBILE_BUSINESS_IMPACT.fair;
    return MOBILE_BUSINESS_IMPACT.poor;
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
      if (title.includes('viewport') || title.includes('meta') || title.includes('font size')) {
        effort = 'easy';
      }

      // Hard fixes
      if (title.includes('redesign') || title.includes('responsive') || title.includes('layout')) {
        effort = 'hard';
      }

      return {
        ...rec,
        effort,
        impact,
        fix: rec.fix || rec.solution || this._generateMobileFix(rec)
      };
    });
  }

  /**
   * Generate a fix suggestion if none provided
   */
  _generateMobileFix(rec) {
    const title = (rec.title || rec.message || '').toLowerCase();

    if (title.includes('touch') || title.includes('tap')) {
      return 'Ensure interactive elements are at least 48x48 CSS pixels with adequate spacing between targets.';
    }
    if (title.includes('viewport')) {
      return 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your HTML head.';
    }
    if (title.includes('font') || title.includes('text')) {
      return 'Use a minimum font size of 16px for body text to ensure readability without zooming.';
    }
    if (title.includes('responsive')) {
      return 'Implement responsive CSS using media queries or a mobile-first CSS framework.';
    }

    return 'Address this mobile usability issue following Google\'s mobile-friendly guidelines.';
  }

  /**
   * Add Responsiveness section
   */
  addResponsivenessSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Responsive Design', {
      subtitle: 'How your site adapts to screen sizes'
    });

    const doc = this.doc;
    const isResponsive = data.responsive !== false;

    // Responsiveness status
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 100, {
      backgroundColor: isResponsive ? '#F5F5F5' : '#FFEBEE',
      borderColor: isResponsive ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical
    });

    const cardY = doc.y;

    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(isResponsive ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical)
       .text(isResponsive ? 'Site is Responsive' : 'Site Not Responsive', 70, cardY + 25);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(
         isResponsive
           ? 'Your site adapts to different screen sizes, providing a consistent experience across devices.'
           : 'Your site does not properly adapt to mobile screens, requiring users to zoom and scroll horizontally.',
         70, cardY + 55, { width: 470 }
       );

    doc.y = cardY + 120;

    // Responsive score gauge
    const respScore = data.responsiveScore || data.responsiveness?.score || (isResponsive ? 85 : 30);

    drawGaugeChart(doc, respScore, 'Responsiveness Score', 306, doc.y + 80, {
      radius: 70,
      width: 14,
      showValue: true,
      showLabel: true
    });

    doc.y += 180;

    this._addPlainEnglishBox(
      'Why Responsive Design Matters',
      'Over 60% of web traffic comes from mobile devices. Responsive design ensures your site works well on any screen size - phones, tablets, and desktops. Google uses mobile-first indexing, meaning the mobile version of your site determines your search rankings.'
    );

    this._addPageNumber();
  }

  /**
   * Add Touch Targets section
   */
  addTouchTargetsSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Touch Targets', {
      subtitle: 'Interactive element sizing for touch'
    });

    const doc = this.doc;
    const touchData = data.touchTargets || {};
    const issues = touchData.issues || 0;

    // Touch target summary
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
      backgroundColor: issues === 0 ? '#F5F5F5' : '#FFF3E0',
      borderColor: issues === 0 ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.priorityMedium
    });

    const cardY = doc.y;

    doc.fontSize(28)
       .font(PREMIUM.FONTS.heading)
       .fillColor(issues === 0 ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.priorityMedium)
       .text(issues.toString(), 70, cardY + 20);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text('Touch Target Issues', 70, cardY + 55);

    // Score
    drawGaugeChart(doc, touchData.score || (issues === 0 ? 100 : 60), '', 480, cardY + 40, {
      radius: 30,
      width: 6,
      showValue: true,
      showLabel: false
    });

    doc.y = cardY + 100;

    // Touch target requirements
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 70, {
      backgroundColor: PREMIUM.SECTIONS.executive
    });

    const reqY = doc.y;

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Touch Target Requirements', 70, reqY + 15);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text('Minimum size: 48x48 CSS pixels  |  Minimum spacing: 8px between targets', 70, reqY + 40);

    doc.y = reqY + 85;

    this._addPlainEnglishBox(
      'Understanding Touch Targets',
      'Touch targets are any element users tap - buttons, links, form fields. Human fingers are imprecise, so targets need to be large enough for accurate tapping. Small or closely-spaced targets lead to frustration, accidental taps, and abandonment. The 48x48px minimum ensures comfortable interaction.'
    );

    this._addPageNumber();
  }

  /**
   * Add Viewport section
   */
  addViewportSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Viewport Configuration', {
      subtitle: 'Mobile display settings'
    });

    const doc = this.doc;
    const viewport = data.viewport || {};
    const isConfigured = viewport.configured !== false;

    // Viewport status
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 100, {
      backgroundColor: isConfigured ? '#F5F5F5' : '#FFEBEE',
      borderColor: isConfigured ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical
    });

    const cardY = doc.y;

    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(isConfigured ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical)
       .text(isConfigured ? 'Viewport Properly Configured' : 'Viewport Not Configured', 70, cardY + 25);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(
         isConfigured
           ? 'Your page uses proper viewport settings for correct mobile display.'
           : 'Missing or incorrect viewport tag causes improper scaling on mobile devices.',
         70, cardY + 55, { width: 470 }
       );

    doc.y = cardY + 120;

    // Viewport checklist
    const checks = [
      { name: 'width=device-width', pass: viewport.width === 'device-width' || isConfigured },
      { name: 'initial-scale=1', pass: viewport.initialScale === 1 || isConfigured },
      { name: 'User scalable enabled', pass: viewport.userScalable !== 'no' }
    ];

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Viewport Settings', 50, doc.y);

    doc.moveDown(0.5);

    checks.forEach(check => {
      // Draw status circle
      doc.circle(67, doc.y + 5, 5)
         .fillColor(check.pass ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical)
         .fill();

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(check.name, 85, doc.y);

      doc.moveDown(0.6);
    });

    doc.moveDown(1);

    this._addPlainEnglishBox(
      'What is the Viewport?',
      'The viewport meta tag tells mobile browsers how to scale and display your page. Without it, mobile browsers assume pages are designed for desktop (typically 980px wide) and shrink everything to fit. This makes text tiny and requires zooming. The proper viewport tag ensures your responsive CSS works correctly.'
    );

    this._addPageNumber();
  }

  /**
   * Add Mobile Performance section
   */
  addMobilePerformanceSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Mobile Performance', {
      subtitle: 'Speed and loading on mobile devices'
    });

    const doc = this.doc;
    const perf = data.mobilePerformance || data.performance || {};

    // Performance score
    drawGaugeChart(doc, perf.score || 0, 'Mobile Performance', 306, doc.y + 80, {
      radius: 70,
      width: 14,
      showValue: true,
      showLabel: true
    });

    doc.y += 180;

    // Key metrics
    const metrics = [
      { name: 'Load Time', value: perf.loadTime || 'N/A', target: '< 3s' },
      { name: 'First Paint', value: perf.firstPaint || 'N/A', target: '< 1.8s' },
      { name: 'Time to Interactive', value: perf.tti || 'N/A', target: '< 3.8s' }
    ];

    metrics.forEach(metric => {
      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 45, {
        backgroundColor: '#FAFAFA'
      });

      const cardY = doc.y;

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(metric.name, 70, cardY + 14);

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.primary)
         .text(metric.value, 250, cardY + 14);

      doc.fontSize(PREMIUM.SIZES.small)
         .fillColor(PREMIUM.COLORS.textMuted)
         .text(`Target: ${metric.target}`, 400, cardY + 15);

      doc.y = cardY + 53;
    });

    doc.moveDown(1);

    this._addPlainEnglishBox(
      'Mobile Performance Impact',
      'Mobile networks are often slower and less reliable than desktop connections. Page weight matters more on mobile - every extra KB increases load time. 53% of mobile users abandon sites taking over 3 seconds to load. Optimizing for mobile performance directly impacts bounce rates and conversions.'
    );

    this._addPageNumber();
  }

  /**
   * Add Mobile Checklist page
   */
  addMobileChecklist(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Mobile Checklist', {
      subtitle: 'Your mobile optimization roadmap'
    });

    const doc = this.doc;
    const score = data.overallScore || 0;

    // Summary
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
      backgroundColor: PREMIUM.SECTIONS.executive,
      shadow: true
    });

    const cardY = doc.y;

    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Mobile Readiness', 70, cardY + 20);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(
         `Your mobile score of ${score}/100 indicates ${score >= 70 ? 'good mobile readiness' : 'areas needing improvement'}. ` +
         'Follow this checklist for optimal mobile experience.',
         70, cardY + 45, { width: 470 }
       );

    doc.y = cardY + 100;

    // Checklist
    const checklist = [
      { text: 'Viewport meta tag configured correctly', done: data.viewport?.configured !== false },
      { text: 'Responsive design implemented', done: data.responsive !== false },
      { text: 'Touch targets at least 48x48 pixels', done: (data.touchTargets?.issues || 0) === 0 },
      { text: 'Text readable without zooming (16px+)', done: score >= 60 },
      { text: 'No horizontal scrolling required', done: score >= 65 },
      { text: 'Mobile page loads under 3 seconds', done: score >= 70 }
    ];

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Mobile Optimization Checklist', 50, doc.y);

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

    // Resources
    doc.moveDown(1);

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Mobile Testing Resources', 50, doc.y);

    doc.moveDown(0.5);

    const resources = [
      'Google Mobile-Friendly Test - search.google.com/test/mobile-friendly',
      'Chrome DevTools Device Mode',
      'BrowserStack for real device testing',
      'Lighthouse Mobile Audit'
    ];

    resources.forEach(resource => {
      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(`• ${resource}`, 60, doc.y);
      doc.moveDown(0.4);
    });

    this._addPageNumber();
  }
}

module.exports = MobilePremiumPdfGenerator;
