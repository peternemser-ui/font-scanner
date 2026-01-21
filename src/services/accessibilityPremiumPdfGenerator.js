/**
 * Accessibility Premium PDF Report Generator
 *
 * Creates a high-value, professionally designed Accessibility report worth $10+
 * Extends the PremiumPdfReport base class with accessibility-specific content:
 * - Executive Summary with WCAG compliance status
 * - Industry accessibility benchmarks comparison
 * - Prioritized remediation roadmap
 * - Detailed violation analysis with plain English explanations
 *
 * @module services/accessibilityPremiumPdfGenerator
 */

const { PremiumPdfReport, PREMIUM } = require('../utils/premiumPdfTemplate');
const {
  drawGaugeChart,
  drawBarChart,
  drawPieChart,
  drawProgressBar,
  drawComparisonChart,
  getScoreColor,
  COLORS
} = require('../utils/pdfCharts');
const { createLogger } = require('../utils/logger');
const { checkPageBreakNeeded, drawCard } = require('../utils/pdfHelpers');

const logger = createLogger('AccessibilityPremiumPdfGenerator');

// Accessibility-specific benchmarks
const ACCESSIBILITY_BENCHMARKS = {
  industryAverage: 72,
  topPerformers: 95,
  competitorsAverage: 75,
  // WCAG principle benchmarks
  perceivable: { average: 70, top: 95 },
  operable: { average: 75, top: 92 },
  understandable: { average: 78, top: 94 },
  robust: { average: 68, top: 90 }
};

// Accessibility business impact templates
const ACCESSIBILITY_BUSINESS_IMPACT = {
  excellent: {
    summary: 'Your site is highly accessible. You\'re providing an inclusive experience for all users, including those with disabilities, while reducing legal risk.',
    metrics: [
      '15-20% of the population has some form of disability',
      'Accessible sites see 10-15% higher conversion rates',
      'Reduces risk of ADA/WCAG compliance lawsuits'
    ]
  },
  good: {
    summary: 'Your accessibility is above average with some gaps. Addressing remaining issues will improve experience for users with disabilities.',
    metrics: [
      'Screen reader users may encounter some barriers',
      'Keyboard-only users might face navigation challenges',
      'Color contrast issues affect users with low vision'
    ]
  },
  fair: {
    summary: 'Accessibility issues are creating barriers for users with disabilities. This may also impact your SEO and exposes you to legal risk.',
    metrics: [
      'Significant portion of users cannot access your content',
      'Missing alt text hurts both accessibility and SEO',
      'Web accessibility lawsuits increased 300% in recent years'
    ]
  },
  poor: {
    summary: 'Critical accessibility barriers exclude many users. Immediate remediation is necessary to avoid legal issues and serve all customers.',
    metrics: [
      'Users with disabilities cannot use your site effectively',
      'High risk of ADA compliance litigation',
      'Missing out on $490 billion in disposable income (disability market)'
    ]
  }
};

// WCAG principle descriptions
const WCAG_PRINCIPLES = {
  perceivable: {
    name: 'Perceivable',
    description: 'Information must be presentable to users in ways they can perceive',
    examples: 'Alt text for images, captions for videos, sufficient color contrast'
  },
  operable: {
    name: 'Operable',
    description: 'User interface components must be operable by all users',
    examples: 'Keyboard accessibility, sufficient time limits, no seizure-inducing content'
  },
  understandable: {
    name: 'Understandable',
    description: 'Information and UI operation must be understandable',
    examples: 'Clear labels, consistent navigation, error suggestions'
  },
  robust: {
    name: 'Robust',
    description: 'Content must work with current and future assistive technologies',
    examples: 'Valid HTML, proper ARIA usage, compatible with screen readers'
  }
};

/**
 * Accessibility Premium PDF Generator
 * Extends PremiumPdfReport with accessibility-specific content and insights
 */
class AccessibilityPremiumPdfGenerator extends PremiumPdfReport {
  constructor() {
    super({
      reportType: 'Accessibility',
      reportTitle: 'Accessibility Analysis Report',
      reportSubtitle: 'WCAG Compliance Assessment',
      accentColor: '#00897B' // Material Teal for Accessibility
    });
  }

  /**
   * Generate the complete Accessibility premium report
   */
  async generateReport(accessibilityResults) {
    try {
      this.initializeDocument(accessibilityResults);

      // Page 1: Cover
      this.addCoverPage(accessibilityResults);

      // Page 2: Executive Summary
      this.addExecutiveSummary(accessibilityResults, {
        componentScores: this._extractComponentScores(accessibilityResults),
        keyFindings: this._extractKeyFindings(accessibilityResults),
        businessImpact: this._getBusinessImpact(accessibilityResults.overallScore || accessibilityResults.accessibilityScore || 0)
      });

      // Page 3: Industry Benchmarks
      this.addBenchmarkComparison(accessibilityResults, ACCESSIBILITY_BENCHMARKS);

      // Page 4: WCAG Compliance Deep Dive
      this.addWCAGComplianceSection(accessibilityResults);

      // Page 5+: Action Roadmap
      this.addActionRoadmap(this._enhanceRecommendations(accessibilityResults.recommendations || []));

      // Detailed Analysis Sections
      this.addViolationsSection(accessibilityResults);
      this.addColorContrastSection(accessibilityResults);
      this.addARIASection(accessibilityResults);

      // Final page: Compliance Checklist
      this.addComplianceChecklist(accessibilityResults);

      return await this.finalize();
    } catch (error) {
      logger.error('Error generating Accessibility premium PDF:', error);
      throw error;
    }
  }

  /**
   * Override: Extract key stats for cover page
   */
  _extractKeyStats(data) {
    const score = data.overallScore || data.accessibilityScore || 0;
    const violations = data.violations || {};
    const criticalCount = (violations.critical || 0) + (violations.serious || 0);

    return [
      {
        label: 'Accessibility',
        value: score,
        color: getScoreColor(score)
      },
      {
        label: 'WCAG Level',
        value: data.wcagLevel || 'N/A',
        color: data.wcagLevel?.includes('AA') ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.fair
      },
      {
        label: 'Critical Issues',
        value: criticalCount,
        color: criticalCount > 0 ? PREMIUM.COLORS.critical : PREMIUM.COLORS.excellent
      }
    ];
  }

  /**
   * Extract component scores for executive summary
   */
  _extractComponentScores(data) {
    return {
      'Perceivable': data.perceivableScore || 0,
      'Operable': data.operableScore || 0,
      'Understandable': data.understandableScore || 0,
      'Robust': data.robustScore || 0
    };
  }

  /**
   * Extract top issues as key findings
   */
  _extractKeyFindings(data) {
    const findings = [];
    const violations = data.violationDetails || [];

    // Check for critical violations
    const critical = violations.filter(v => v.impact === 'critical');
    const serious = violations.filter(v => v.impact === 'serious');

    if (critical.length > 0) {
      findings.push({
        title: `${critical.length} Critical Accessibility Violations`,
        description: 'These issues completely prevent some users from accessing content.',
        priority: 'high'
      });
    }

    if (serious.length > 0) {
      findings.push({
        title: `${serious.length} Serious Accessibility Issues`,
        description: 'These create significant barriers for users with disabilities.',
        priority: 'high'
      });
    }

    // Check color contrast
    if (data.colorContrast && data.colorContrast.issues?.length > 0) {
      findings.push({
        title: `${data.colorContrast.issues.length} Color Contrast Failures`,
        description: 'Text may be difficult to read for users with low vision.',
        priority: 'medium'
      });
    }

    // Check WCAG level
    if (!data.wcagLevel || !data.wcagLevel.includes('AA')) {
      findings.push({
        title: 'Does Not Meet WCAG 2.1 AA',
        description: 'Your site does not meet the recommended accessibility standard.',
        priority: 'high'
      });
    }

    // Add from recommendations
    const recs = data.recommendations || [];
    const highPriority = recs.filter(r => r.priority === 'critical' || r.priority === 'important');
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
    if (score >= 90) return ACCESSIBILITY_BUSINESS_IMPACT.excellent;
    if (score >= 75) return ACCESSIBILITY_BUSINESS_IMPACT.good;
    if (score >= 55) return ACCESSIBILITY_BUSINESS_IMPACT.fair;
    return ACCESSIBILITY_BUSINESS_IMPACT.poor;
  }

  /**
   * Enhance recommendations with effort/impact ratings
   */
  _enhanceRecommendations(recommendations) {
    return recommendations.map(rec => {
      let effort = 'medium';
      let impact = 'high'; // Accessibility issues generally have high impact

      const title = (rec.title || rec.message || '').toLowerCase();

      // Easy fixes
      if (title.includes('alt') ||
          title.includes('label') ||
          title.includes('lang') ||
          title.includes('title')) {
        effort = 'easy';
      }

      // Hard fixes
      if (title.includes('structure') ||
          title.includes('keyboard') ||
          title.includes('focus') ||
          title.includes('aria')) {
        effort = 'hard';
      }

      // Highest impact
      if (rec.priority === 'critical' ||
          title.includes('critical') ||
          title.includes('screen reader')) {
        impact = 'high';
      }

      return {
        ...rec,
        effort,
        impact,
        fix: rec.fix || rec.solution || this._generateAccessibilityFix(rec)
      };
    });
  }

  /**
   * Generate a fix suggestion if none provided
   */
  _generateAccessibilityFix(rec) {
    const title = (rec.title || rec.message || '').toLowerCase();

    if (title.includes('alt')) {
      return 'Add descriptive alt text that conveys the purpose/content of the image. Use alt="" for decorative images.';
    }
    if (title.includes('contrast')) {
      return 'Increase color contrast to at least 4.5:1 for normal text, 3:1 for large text. Use a contrast checker tool.';
    }
    if (title.includes('label') || title.includes('form')) {
      return 'Add visible labels to all form inputs using <label> elements with for attribute matching input id.';
    }
    if (title.includes('keyboard')) {
      return 'Ensure all interactive elements are keyboard accessible. Add tabindex and keyboard event handlers.';
    }
    if (title.includes('heading')) {
      return 'Use proper heading hierarchy (H1-H6) without skipping levels. Each page should have one H1.';
    }
    if (title.includes('aria')) {
      return 'Review ARIA usage. Ensure roles, states, and properties are used correctly per WAI-ARIA specification.';
    }
    if (title.includes('focus')) {
      return 'Ensure focus indicators are visible. Never remove outline without providing an alternative focus style.';
    }

    return 'Review this issue and implement fixes following WCAG 2.1 guidelines.';
  }

  /**
   * Add WCAG Compliance deep dive section
   */
  addWCAGComplianceSection(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('WCAG 2.1 Compliance', {
      subtitle: 'Web Content Accessibility Guidelines assessment',
      icon: '♿'
    });

    const doc = this.doc;

    // WCAG Level badge
    const wcagLevel = data.wcagLevel || 'Not Met';
    const meetsAA = wcagLevel.includes('AA');
    const meetsAAA = wcagLevel.includes('AAA');

    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
      backgroundColor: meetsAAA ? '#F5F5F5' : meetsAA ? '#F5F5F5' : '#FFEBEE',
      borderColor: meetsAAA ? PREMIUM.COLORS.excellent : meetsAA ? PREMIUM.COLORS.good : PREMIUM.COLORS.critical
    });

    const badgeY = doc.y;

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Current WCAG Level:', 70, badgeY + 20);

    doc.fontSize(28)
       .font(PREMIUM.FONTS.heading)
       .fillColor(meetsAA ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical)
       .text(wcagLevel, 250, badgeY + 15);

    doc.fontSize(PREMIUM.SIZES.small)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(
         meetsAA
           ? 'Your site meets the recommended accessibility standard.'
           : 'WCAG 2.1 AA is the recommended minimum standard.',
         70, badgeY + 55, { width: 470 }
       );

    doc.y = badgeY + 100;

    // WCAG Principles (POUR)
    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('WCAG Principles (POUR)', 50, doc.y);

    doc.moveDown(0.5);

    const principles = [
      { key: 'perceivable', score: data.perceivableScore || 0 },
      { key: 'operable', score: data.operableScore || 0 },
      { key: 'understandable', score: data.understandableScore || 0 },
      { key: 'robust', score: data.robustScore || 0 }
    ];

    principles.forEach(principle => {
      const info = WCAG_PRINCIPLES[principle.key];

      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 75, {
        backgroundColor: principle.score >= 90 ? '#F5F5F5' : principle.score >= 70 ? '#FFF3E0' : '#FFEBEE'
      });

      const cardY = doc.y;

      // Principle name
      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(info.name, 70, cardY + 12);

      // Score gauge (small)
      drawGaugeChart(doc, principle.score, '', 490, cardY + 40, {
        radius: 25,
        width: 5,
        showValue: true,
        showLabel: false
      });

      // Description
      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(info.description, 70, cardY + 32, { width: 380 });

      // Examples
      doc.fontSize(PREMIUM.SIZES.caption)
         .fillColor(PREMIUM.COLORS.textMuted)
         .text(`Examples: ${info.examples}`, 70, cardY + 52, { width: 380 });

      doc.y = cardY + 83;
    });

    // Plain English explanation
    doc.moveDown(0.5);

    this._addPlainEnglishBox(
      'What WCAG Compliance Means',
      'WCAG (Web Content Accessibility Guidelines) is the international standard for web accessibility. Level A is minimum, Level AA is recommended for most sites, and Level AAA is the highest standard. Meeting AA ensures your site is usable by people with various disabilities including blindness, low vision, deafness, and motor impairments.'
    );

    this._addPageNumber();
  }

  /**
   * Add Violations section
   */
  addViolationsSection(data) {
    if (!data.violationDetails || data.violationDetails.length === 0) {
      return;
    }

    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Accessibility Violations', {
      subtitle: 'Issues preventing access for some users'
    });

    const doc = this.doc;
    const violations = data.violationDetails;

    // Violation summary by severity
    const critical = violations.filter(v => v.impact === 'critical');
    const serious = violations.filter(v => v.impact === 'serious');
    const moderate = violations.filter(v => v.impact === 'moderate');
    const minor = violations.filter(v => v.impact === 'minor');

    // Summary cards
    const categories = [
      { label: 'Critical', count: critical.length, color: COLORS.critical, bg: '#FFEBEE' },
      { label: 'Serious', count: serious.length, color: COLORS.poor, bg: '#FFF3E0' },
      { label: 'Moderate', count: moderate.length, color: COLORS.warning, bg: '#FFFDE7' },
      { label: 'Minor', count: minor.length, color: COLORS.info, bg: '#E3F2FD' }
    ];

    const cardWidth = 120;
    let cardX = 50;

    categories.forEach(cat => {
      this._drawPremiumCard(cardX, doc.y, cardWidth, 70, {
        backgroundColor: cat.count > 0 ? cat.bg : '#F5F5F5'
      });

      doc.fontSize(28)
         .font(PREMIUM.FONTS.heading)
         .fillColor(cat.count > 0 ? cat.color : PREMIUM.COLORS.textMuted)
         .text(cat.count.toString(), cardX, doc.y + 15, { width: cardWidth, align: 'center' });

      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(cat.label, cardX, doc.y + 50, { width: cardWidth, align: 'center' });

      cardX += cardWidth + 10;
    });

    doc.y += 90;

    // Critical and serious violations detail
    const highImpact = [...critical, ...serious].slice(0, 6);

    if (highImpact.length > 0) {
      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('High Impact Violations', 50, doc.y);

      doc.moveDown(0.5);

      highImpact.forEach((violation, index) => {
        const isCritical = violation.impact === 'critical';

        checkPageBreakNeeded(doc, 90);

        this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
          backgroundColor: isCritical ? '#FFEBEE' : '#FFF3E0',
          borderColor: isCritical ? PREMIUM.COLORS.critical : PREMIUM.COLORS.priorityMedium
        });

        const cardY = doc.y;

        // Impact badge
        doc.fontSize(PREMIUM.SIZES.tiny)
           .font(PREMIUM.FONTS.heading)
           .fillColor(isCritical ? PREMIUM.COLORS.critical : PREMIUM.COLORS.priorityMedium)
           .text(violation.impact?.toUpperCase() || 'ISSUE', 70, cardY + 12);

        // Description
        doc.fontSize(PREMIUM.SIZES.body)
           .font(PREMIUM.FONTS.heading)
           .fillColor(PREMIUM.COLORS.textPrimary)
           .text(violation.description || violation.id, 140, cardY + 10, { width: 400 });

        // Help text
        if (violation.help) {
          doc.fontSize(PREMIUM.SIZES.small)
             .font(PREMIUM.FONTS.body)
             .fillColor(PREMIUM.COLORS.textSecondary)
             .text(violation.help.substring(0, 100) + (violation.help.length > 100 ? '...' : ''), 70, cardY + 35, { width: 470 });
        }

        // WCAG reference and affected elements
        let infoY = cardY + 55;
        if (violation.wcagTags?.length > 0) {
          doc.fontSize(PREMIUM.SIZES.caption)
             .fillColor(PREMIUM.COLORS.textMuted)
             .text(`WCAG: ${violation.wcagTags.slice(0, 3).join(', ')}`, 70, infoY);
        }

        if (violation.nodes?.length > 0) {
          doc.fontSize(PREMIUM.SIZES.caption)
             .fillColor(PREMIUM.COLORS.primary)
             .text(`${violation.nodes.length} affected elements`, 300, infoY);
        }

        doc.y = cardY + 88;
      });
    }

    this._addPageNumber();
  }

  /**
   * Add Color Contrast section
   */
  addColorContrastSection(data) {
    if (!data.colorContrast) return;

    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Color Contrast', {
      subtitle: 'Text readability for users with low vision'
    });

    const doc = this.doc;
    const contrast = data.colorContrast;
    const hasIssues = contrast.issues && contrast.issues.length > 0;

    // Summary card
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
      backgroundColor: hasIssues ? '#FFEBEE' : '#F5F5F5',
      borderColor: hasIssues ? PREMIUM.COLORS.critical : PREMIUM.COLORS.excellent
    });

    const summaryY = doc.y;

    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(hasIssues ? PREMIUM.COLORS.critical : PREMIUM.COLORS.excellent)
       .text(hasIssues ? `${contrast.issues.length} Contrast Failures` : 'All Contrast Checks Pass', 70, summaryY + 20);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(
         hasIssues
           ? 'Text that fails contrast requirements may be difficult or impossible to read for users with low vision.'
           : 'All text meets WCAG color contrast requirements, ensuring readability for users with low vision.',
         70, summaryY + 45, { width: 470 }
       );

    doc.y = summaryY + 100;

    // Contrast requirements explanation
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 70, {
      backgroundColor: PREMIUM.SECTIONS.executive
    });

    const reqY = doc.y;

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('WCAG Contrast Requirements', 70, reqY + 15);

    doc.fontSize(PREMIUM.SIZES.small)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text('Normal text (<18pt): 4.5:1 minimum  |  Large text (≥18pt or 14pt bold): 3:1 minimum', 70, reqY + 40, { width: 450 });

    doc.y = reqY + 85;

    // Show contrast issues
    if (hasIssues) {
      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Failing Elements', 50, doc.y);

      doc.moveDown(0.5);

      contrast.issues.slice(0, 8).forEach((issue, index) => {
        checkPageBreakNeeded(doc, 60);

        this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 50, {
          backgroundColor: '#FFEBEE'
        });

        const cardY = doc.y;

        doc.fontSize(PREMIUM.SIZES.body)
           .font(PREMIUM.FONTS.body)
           .fillColor(PREMIUM.COLORS.textPrimary)
           .text(`${index + 1}. ${issue.description || 'Contrast failure'}`, 70, cardY + 10, { width: 350 });

        if (issue.contrastRatio) {
          doc.fontSize(PREMIUM.SIZES.small)
             .fillColor(PREMIUM.COLORS.critical)
             .text(`Ratio: ${issue.contrastRatio} (need ${issue.requiredRatio || '4.5:1'})`, 70, cardY + 30);
        }

        doc.y = cardY + 58;
      });

      if (contrast.issues.length > 8) {
        doc.fontSize(PREMIUM.SIZES.small)
           .fillColor(PREMIUM.COLORS.textMuted)
           .text(`+ ${contrast.issues.length - 8} more contrast issues`, 50, doc.y);
      }
    }

    // Plain English explanation
    doc.moveDown(1);

    this._addPlainEnglishBox(
      'Why Color Contrast Matters',
      'Poor color contrast makes text difficult or impossible to read for the 300+ million people worldwide with color vision deficiencies or low vision. Good contrast also helps everyone in poor lighting conditions or on low-quality displays.'
    );

    this._addPageNumber();
  }

  /**
   * Add ARIA Analysis section
   */
  addARIASection(data) {
    if (!data.aria) return;

    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('ARIA Implementation', {
      subtitle: 'Assistive technology compatibility',
      icon: '🔊'
    });

    const doc = this.doc;
    const aria = data.aria;

    // ARIA metrics
    const metrics = [
      { label: 'Landmarks', value: aria.landmarks || 0, desc: 'Page regions for navigation' },
      { label: 'Labels', value: aria.labels || 0, desc: 'Accessible names for elements' },
      { label: 'Roles', value: aria.roles || 0, desc: 'Widget types for screen readers' }
    ];

    const cardWidth = 165;
    let cardX = 50;

    metrics.forEach(metric => {
      this._drawPremiumCard(cardX, doc.y, cardWidth, 90, {
        backgroundColor: metric.value > 0 ? '#F5F5F5' : '#FFF3E0'
      });

      doc.fontSize(32)
         .font(PREMIUM.FONTS.heading)
         .fillColor(metric.value > 0 ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.fair)
         .text(metric.value.toString(), cardX, doc.y + 15, { width: cardWidth, align: 'center' });

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(metric.label, cardX, doc.y + 55, { width: cardWidth, align: 'center' });

      doc.fontSize(PREMIUM.SIZES.caption)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textMuted)
         .text(metric.desc, cardX + 10, doc.y + 70, { width: cardWidth - 20, align: 'center' });

      cardX += cardWidth + 10;
    });

    doc.y += 110;

    // ARIA issues
    if (aria.issues && aria.issues.length > 0) {
      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.priorityMedium)
         .text(`ARIA Issues (${aria.issues.length})`, 50, doc.y);

      doc.moveDown(0.5);

      aria.issues.slice(0, 6).forEach((issue, index) => {
        this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 40, {
          backgroundColor: '#FFF3E0'
        });

        doc.fontSize(PREMIUM.SIZES.body)
           .font(PREMIUM.FONTS.body)
           .fillColor(PREMIUM.COLORS.textPrimary)
           .text(`${index + 1}. ${issue}`, 70, doc.y + 12, { width: 470 });

        doc.y += 48;
      });
    }

    // Plain English explanation
    doc.moveDown(1);

    this._addPlainEnglishBox(
      'Understanding ARIA',
      'ARIA (Accessible Rich Internet Applications) provides additional information to screen readers. Landmarks help users navigate, labels identify elements, and roles describe widget types. However, incorrect ARIA can make accessibility worse - the first rule of ARIA is "don\'t use ARIA" if native HTML will work.'
    );

    this._addPageNumber();
  }

  /**
   * Add Compliance Checklist page
   */
  addComplianceChecklist(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Compliance Checklist', {
      subtitle: 'Your accessibility improvement roadmap'
    });

    const doc = this.doc;
    const score = data.overallScore || data.accessibilityScore || 0;

    // Summary card
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 100, {
      backgroundColor: PREMIUM.SECTIONS.executive,
      shadow: true
    });

    const cardY = doc.y;

    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Accessibility Status', 70, cardY + 20);

    const level = data.wcagLevel || 'Below Standards';

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(
         `Your current WCAG level is ${level} with a score of ${score}/100. ` +
         'Use this checklist to systematically improve accessibility.',
         70, cardY + 45, { width: 470 }
       );

    doc.y = cardY + 120;

    // Priority checklist
    const checklist = [
      { text: 'Add alt text to all meaningful images', done: score >= 60 },
      { text: 'Ensure sufficient color contrast (4.5:1)', done: !data.colorContrast?.issues?.length },
      { text: 'Label all form inputs', done: score >= 70 },
      { text: 'Make all interactive elements keyboard accessible', done: score >= 75 },
      { text: 'Use proper heading hierarchy', done: score >= 65 },
      { text: 'Add skip navigation links', done: score >= 80 },
      { text: 'Ensure no WCAG critical violations', done: !(data.violations?.critical > 0) }
    ];

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Accessibility Checklist', 50, doc.y);

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

    // Resources section
    doc.moveDown(1);

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Accessibility Resources', 50, doc.y);

    doc.moveDown(0.5);

    const resources = [
      'WCAG 2.1 Guidelines - w3.org/WAI/WCAG21/quickref/',
      'WebAIM Contrast Checker - webaim.org/resources/contrastchecker/',
      'axe DevTools Browser Extension',
      'NVDA Screen Reader (free) - nvaccess.org'
    ];

    resources.forEach(resource => {
      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(`• ${resource}`, 60, doc.y);
      doc.moveDown(0.4);
    });

    // Footer
    doc.moveDown(2);

    doc.fontSize(PREMIUM.SIZES.caption)
       .font(PREMIUM.FONTS.emphasis)
       .fillColor(PREMIUM.COLORS.textMuted)
       .text(
         'Accessibility benefits everyone. Start with critical issues and work your way through the checklist.',
         50, doc.y,
         { width: PREMIUM.PAGE.contentWidth, align: 'center' }
       );

    this._addPageNumber();
  }
}

module.exports = AccessibilityPremiumPdfGenerator;
