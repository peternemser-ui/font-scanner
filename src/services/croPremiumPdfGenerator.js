/**
 * CRO (Conversion Rate Optimization) Premium PDF Report Generator
 *
 * Creates a high-value, professionally designed CRO report worth $10+
 * Extends the PremiumPdfReport base class with CRO-specific content:
 * - Executive Summary with conversion optimization scores
 * - Industry CRO benchmarks comparison
 * - Prioritized conversion optimization roadmap
 * - UX analysis with plain English explanations
 *
 * @module services/croPremiumPdfGenerator
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

const logger = createLogger('CROPremiumPdfGenerator');

// CRO-specific benchmarks
const CRO_BENCHMARKS = {
  industryAverage: 58,
  topPerformers: 88,
  competitorsAverage: 62,
  // Component benchmarks
  cta: { average: 55, top: 85 },
  forms: { average: 60, top: 90 },
  trustSignals: { average: 50, top: 82 },
  userExperience: { average: 65, top: 92 }
};

// CRO business impact templates
const CRO_BUSINESS_IMPACT = {
  excellent: {
    summary: 'Your site is well-optimized for conversions. Clear CTAs, streamlined forms, and strong trust signals create an effective conversion funnel.',
    metrics: [
      'Optimized sites see 200-400% more conversions',
      'Clear CTAs can increase click-through by 371%',
      'Trust signals can boost conversions by 34%'
    ]
  },
  good: {
    summary: 'Your conversion optimization is solid with room for improvement. Addressing the gaps below could significantly increase conversions.',
    metrics: [
      'Form optimization can increase completions by 50%+',
      'Better CTAs could improve click rates by 20-30%',
      'Small UX improvements often yield big conversion gains'
    ]
  },
  fair: {
    summary: 'Conversion barriers are reducing your site\'s effectiveness. Visitors may leave without converting due to friction points.',
    metrics: [
      'Unclear CTAs confuse visitors about next steps',
      'Complex forms have 20-50% abandonment rates',
      'Missing trust signals make visitors hesitant'
    ]
  },
  poor: {
    summary: 'Critical CRO issues are severely limiting conversions. Your site is likely losing most potential customers before they convert.',
    metrics: [
      'You may be losing 50%+ of potential conversions',
      'Friction points are driving visitors to competitors',
      'Immediate CRO improvements could transform results'
    ]
  }
};

/**
 * CRO Premium PDF Generator
 * Extends PremiumPdfReport with CRO-specific content and insights
 */
class CROPremiumPdfGenerator extends PremiumPdfReport {
  constructor() {
    super({
      reportType: 'CRO',
      reportTitle: 'Conversion Optimization Report',
      reportSubtitle: 'Conversion Rate Optimization Analysis',
      accentColor: '#7B1FA2' // Material Purple for CRO
    });
  }

  /**
   * Generate the complete CRO premium report
   */
  async generateReport(croResults) {
    try {
      this.initializeDocument(croResults);

      // Page 1: Cover
      this.addCoverPage(croResults);

      // Page 2: Executive Summary
      this.addExecutiveSummary(croResults, {
        componentScores: this._extractComponentScores(croResults),
        keyFindings: this._extractKeyFindings(croResults),
        businessImpact: this._getBusinessImpact(croResults.overallScore || 0)
      });

      // Page 3: Industry Benchmarks
      this.addBenchmarkComparison(croResults, CRO_BENCHMARKS);

      // Page 4+: Action Roadmap
      this.addActionRoadmap(this._enhanceRecommendations(croResults.recommendations || []));

      // Detailed Analysis Sections
      this.addCTAAnalysisSection(croResults);
      this.addFormAnalysisSection(croResults);
      this.addTrustSignalsSection(croResults);
      this.addUXAnalysisSection(croResults);

      // Final page: Conversion Checklist
      this.addConversionChecklist(croResults);

      return await this.finalize();
    } catch (error) {
      logger.error('Error generating CRO premium PDF:', error);
      throw error;
    }
  }

  /**
   * Override: Extract key stats for cover page
   */
  _extractKeyStats(data) {
    return [
      {
        label: 'CRO Score',
        value: data.overallScore || 0,
        color: getScoreColor(data.overallScore || 0)
      },
      {
        label: 'CTAs Found',
        value: data.ctas?.count || 0,
        color: PREMIUM.COLORS.textPrimary
      },
      {
        label: 'Issues',
        value: data.issues?.length || 0,
        color: (data.issues?.length || 0) > 5 ? PREMIUM.COLORS.critical : PREMIUM.COLORS.excellent
      }
    ];
  }

  /**
   * Extract component scores for executive summary
   */
  _extractComponentScores(data) {
    return {
      'CTAs': data.ctaScore || data.ctas?.score || 0,
      'Forms': data.formScore || data.forms?.score || 0,
      'Trust Signals': data.trustScore || data.trustSignals?.score || 0,
      'UX': data.uxScore || data.userExperience?.score || 0
    };
  }

  /**
   * Extract top issues as key findings
   */
  _extractKeyFindings(data) {
    const findings = [];
    const issues = data.issues || [];

    // Check CTA issues
    if (!data.ctas?.count || data.ctas.count === 0) {
      findings.push({
        title: 'No Clear Call-to-Actions Found',
        description: 'Your page lacks clear CTAs to guide visitors toward conversion.',
        priority: 'high'
      });
    }

    // Check form issues
    if (data.forms?.issues?.length > 0) {
      findings.push({
        title: `${data.forms.issues.length} Form Issues Detected`,
        description: 'Form problems may be causing abandonment and lost conversions.',
        priority: 'high'
      });
    }

    // Check trust signals
    if ((data.trustSignals?.score || 0) < 50) {
      findings.push({
        title: 'Weak Trust Signals',
        description: 'Missing testimonials, security badges, or social proof may hurt conversions.',
        priority: 'medium'
      });
    }

    // Add from issues list
    issues.slice(0, 2).forEach(issue => {
      if (findings.length < 5) {
        findings.push({
          title: issue.title || issue.message,
          description: issue.description,
          priority: issue.priority || 'medium'
        });
      }
    });

    return findings;
  }

  /**
   * Get business impact based on score
   */
  _getBusinessImpact(score) {
    if (score >= 85) return CRO_BUSINESS_IMPACT.excellent;
    if (score >= 70) return CRO_BUSINESS_IMPACT.good;
    if (score >= 50) return CRO_BUSINESS_IMPACT.fair;
    return CRO_BUSINESS_IMPACT.poor;
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
      if (title.includes('button') || title.includes('color') || title.includes('text')) {
        effort = 'easy';
      }

      // Hard fixes
      if (title.includes('redesign') || title.includes('flow') || title.includes('structure')) {
        effort = 'hard';
      }

      return {
        ...rec,
        effort,
        impact,
        fix: rec.fix || rec.solution || this._generateCROFix(rec)
      };
    });
  }

  /**
   * Generate a fix suggestion if none provided
   */
  _generateCROFix(rec) {
    const title = (rec.title || rec.message || '').toLowerCase();

    if (title.includes('cta') || title.includes('button')) {
      return 'Make CTAs stand out with contrasting colors and action-oriented text like "Get Started" or "Start Free Trial".';
    }
    if (title.includes('form')) {
      return 'Simplify forms by removing unnecessary fields. Use inline validation and clear error messages.';
    }
    if (title.includes('trust')) {
      return 'Add testimonials, security badges, and social proof near conversion points.';
    }

    return 'Review this issue and implement CRO best practices to improve conversions.';
  }

  /**
   * Add CTA Analysis section
   */
  addCTAAnalysisSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Call-to-Action Analysis', {
      subtitle: 'Evaluating your conversion triggers'
    });

    const doc = this.doc;
    const ctas = data.ctas || {};

    // CTA count and score
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 100, {
      backgroundColor: (ctas.score || 0) >= 70 ? '#F5F5F5' : '#FFF3E0'
    });

    const cardY = doc.y;

    doc.fontSize(32)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text((ctas.count || 0).toString(), 70, cardY + 25);

    doc.fontSize(PREMIUM.SIZES.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text('CTAs Detected', 70, cardY + 65);

    // Score gauge
    drawGaugeChart(doc, ctas.score || 0, 'CTA Score', 450, cardY + 50, {
      radius: 40,
      width: 8,
      showValue: true,
      showLabel: true
    });

    doc.y = cardY + 120;

    // CTA Best Practices
    this._addPlainEnglishBox(
      'CTA Best Practices',
      'Effective CTAs use action-oriented language, stand out visually with contrasting colors, and create urgency. Place primary CTAs above the fold and repeat them throughout long pages. Button text should clearly communicate what happens next.'
    );

    this._addPageNumber();
  }

  /**
   * Add Form Analysis section
   */
  addFormAnalysisSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Form Analysis', {
      subtitle: 'Optimizing your conversion forms'
    });

    const doc = this.doc;
    const forms = data.forms || {};

    // Form summary
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
      backgroundColor: PREMIUM.SECTIONS.executive
    });

    const cardY = doc.y;

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Forms Detected', 70, cardY + 20);

    doc.fontSize(28)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.primary)
       .text((forms.count || 0).toString(), 70, cardY + 45);

    if (forms.averageFields) {
      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(`Average ${forms.averageFields} fields per form`, 200, cardY + 50);
    }

    doc.y = cardY + 100;

    // Form optimization tips
    this._addPlainEnglishBox(
      'Form Optimization Tips',
      'Forms are critical conversion points. Reduce fields to the minimum necessary - each additional field can reduce completions by 4%. Use inline validation, provide clear error messages, and never ask for the same information twice. Consider multi-step forms for complex processes.'
    );

    this._addPageNumber();
  }

  /**
   * Add Trust Signals section
   */
  addTrustSignalsSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Trust Signals', {
      subtitle: 'Building visitor confidence'
    });

    const doc = this.doc;
    const trust = data.trustSignals || {};

    // Trust score
    drawGaugeChart(doc, trust.score || 0, 'Trust Score', 306, doc.y + 80, {
      radius: 70,
      width: 14,
      showValue: true,
      showLabel: true
    });

    doc.y += 180;

    // Trust signal checklist
    const signals = [
      { name: 'Testimonials', present: trust.testimonials || false },
      { name: 'Security Badges', present: trust.securityBadges || false },
      { name: 'Social Proof', present: trust.socialProof || false },
      { name: 'Guarantees', present: trust.guarantees || false },
      { name: 'Contact Information', present: trust.contactInfo || false }
    ];

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Trust Signal Checklist', 50, doc.y);

    doc.moveDown(0.5);

    signals.forEach(signal => {
      // Draw status circle
      doc.circle(67, doc.y + 5, 5)
         .fillColor(signal.present ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical)
         .fill();

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(signal.name, 85, doc.y);

      doc.moveDown(0.6);
    });

    doc.moveDown(1);

    this._addPlainEnglishBox(
      'Why Trust Signals Matter',
      'Online visitors can\'t physically interact with your business, so they look for signals that you\'re legitimate and reliable. Testimonials show real customer experiences, security badges reassure about data safety, and guarantees reduce perceived risk. Sites with strong trust signals convert at significantly higher rates.'
    );

    this._addPageNumber();
  }

  /**
   * Add UX Analysis section
   */
  addUXAnalysisSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('User Experience', {
      subtitle: 'Conversion-focused UX assessment'
    });

    const doc = this.doc;

    // UX factors
    const uxFactors = [
      { name: 'Page Load Speed', score: data.performance?.score || 70, impact: 'Critical' },
      { name: 'Mobile Responsiveness', score: data.mobile?.score || 65, impact: 'High' },
      { name: 'Navigation Clarity', score: data.navigation?.score || 60, impact: 'High' },
      { name: 'Visual Hierarchy', score: data.visual?.score || 55, impact: 'Medium' }
    ];

    uxFactors.forEach(factor => {
      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 60, {
        backgroundColor: factor.score >= 70 ? '#F5F5F5' : factor.score >= 50 ? '#FFF3E0' : '#FFEBEE'
      });

      const cardY = doc.y;

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(factor.name, 70, cardY + 15);

      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textMuted)
         .text(`Impact: ${factor.impact}`, 70, cardY + 35);

      drawProgressBar(doc, factor.score, '', 300, cardY + 20, {
        width: 200,
        height: 20,
        showPercentage: true
      });

      doc.y = cardY + 68;
    });

    doc.moveDown(1);

    this._addPlainEnglishBox(
      'UX Impact on Conversions',
      'User experience directly impacts conversions. Slow pages lose 7% conversions per second of delay. Poor mobile experience drives away 60%+ of traffic. Confusing navigation increases bounce rates. Every UX friction point reduces conversions - smooth experiences convert.'
    );

    this._addPageNumber();
  }

  /**
   * Add Conversion Checklist page
   */
  addConversionChecklist(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Conversion Checklist', {
      subtitle: 'Your CRO improvement roadmap'
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
       .text('CRO Summary', 70, cardY + 20);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(
         `Your CRO score of ${score}/100 indicates ${score >= 70 ? 'good' : 'significant'} optimization opportunities. ` +
         'Focus on the checklist below to improve conversions.',
         70, cardY + 45, { width: 470 }
       );

    doc.y = cardY + 100;

    // Checklist
    const checklist = [
      { text: 'Clear, compelling CTAs above the fold', done: score >= 60 },
      { text: 'Streamlined forms with minimal fields', done: score >= 65 },
      { text: 'Trust signals near conversion points', done: score >= 55 },
      { text: 'Fast page load times (<3 seconds)', done: score >= 70 },
      { text: 'Mobile-optimized experience', done: score >= 65 },
      { text: 'Clear value proposition', done: score >= 60 }
    ];

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('CRO Checklist', 50, doc.y);

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

    this._addPageNumber();
  }
}

module.exports = CROPremiumPdfGenerator;
