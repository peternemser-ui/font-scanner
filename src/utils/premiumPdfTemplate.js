/**
 * Premium PDF Report Template System
 *
 * Creates high-value, professionally designed PDF reports worth $10+
 * Each report includes:
 * - Executive Summary with key metrics and ROI impact
 * - Competitor/Industry Benchmarks comparison
 * - Prioritized Actionable Roadmap with effort/impact ratings
 * - Plain English "What This Means" explanations
 * - Professional visualizations and charts
 *
 * @module utils/premiumPdfTemplate
 */

const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');
const { resolveReportId } = require('./resolveReportId');
const {
  drawGaugeChart,
  drawBarChart,
  drawPieChart,
  drawComparisonChart,
  drawProgressBar,
  drawThresholdChart,
  getScoreColor,
  COLORS
} = require('./pdfCharts');

const logger = createLogger('PremiumPdfTemplate');

// Premium Design Constants
const PREMIUM = {
  // Page dimensions (US Letter)
  PAGE: {
    width: 612,
    height: 792,
    marginTop: 50,
    marginBottom: 50,
    marginLeft: 50,
    marginRight: 50,
    contentWidth: 512,
    // Aliases for premium generators
    MARGIN: 50,
    WIDTH: 612
  },

  // Typography
  FONTS: {
    title: 'Helvetica-Bold',
    heading: 'Helvetica-Bold',
    subheading: 'Helvetica-Bold',
    body: 'Helvetica',
    caption: 'Helvetica',
    emphasis: 'Helvetica-Oblique'
  },

  // Font sizes
  SIZES: {
    heroTitle: 32,
    pageTitle: 24,
    sectionTitle: 16,
    subsectionTitle: 13,
    body: 10,
    small: 9,
    caption: 8,
    tiny: 7
  },

  // Premium color palette
  COLORS: {
    // Brand
    primary: '#1976D2',
    secondary: '#00897B',
    accent: '#DD3838',

    // Scores
    excellent: '#212121',
    good: '#424242',
    fair: '#F9A825',
    poor: '#EF6C00',
    critical: '#C62828',

    // UI
    textPrimary: '#212121',
    textSecondary: '#616161',
    textMuted: '#9E9E9E',
    divider: '#E0E0E0',
    background: '#FAFAFA',
    surface: '#FFFFFF',

    // Priority
    priorityHigh: '#C62828',
    priorityMedium: '#EF6C00',
    priorityLow: '#1976D2'
  },

  // Section backgrounds
  SECTIONS: {
    executive: '#F5F5F5',
    benchmark: '#FAFAFA',
    roadmap: '#FFF8E1',
    details: '#FFFFFF'
  }
};

/**
 * Premium PDF Report Base Class
 * Provides consistent structure and design for all premium reports
 */
class PremiumPdfReport {
  constructor(options = {}) {
    this.reportType = options.reportType || 'Analysis';
    this.reportTitle = options.reportTitle || `${this.reportType} Report`;
    this.reportSubtitle = options.reportSubtitle || 'Premium Analysis';
    this.accentColor = options.accentColor || PREMIUM.COLORS.primary;
    this.reportColor = options.reportColor || PREMIUM.COLORS.primary;
    this.reportsDir = options.reportsDir || path.join(__dirname, '../../reports');

    this.doc = null;
    this.currentPage = 0;
    this.reportId = null;
    this.buffers = [];

    // Make PREMIUM constants accessible via this
    this.PREMIUM = PREMIUM;
  }

  /**
   * Initialize document and return buffers (for premium generators)
   */
  async initDocument() {
    this.buffers = [];

    this.doc = new PDFDocument({
      size: 'letter',
      margins: {
        top: PREMIUM.PAGE.marginTop || 50,
        bottom: PREMIUM.PAGE.marginBottom || 50,
        left: PREMIUM.PAGE.marginLeft || 50,
        right: PREMIUM.PAGE.marginRight || 50
      },
      info: {
        Title: this.reportTitle,
        Author: 'Site Mechanic',
        Subject: `${this.reportType} Analysis Report`,
        Creator: 'Site Mechanic Premium Reports'
      },
      bufferPages: true
    });

    // Collect buffers
    this.doc.on('data', (chunk) => this.buffers.push(chunk));

    this.currentPage = 1;
    return this.doc;
  }

  /**
   * Initialize PDF document with premium settings
   */
  initializeDocument(data) {
    this.reportId = resolveReportId(data, this.reportType.toLowerCase());

    this.doc = new PDFDocument({
      size: 'letter',
      margins: {
        top: PREMIUM.PAGE.marginTop,
        bottom: PREMIUM.PAGE.marginBottom,
        left: PREMIUM.PAGE.marginLeft,
        right: PREMIUM.PAGE.marginRight
      },
      info: {
        Title: this.reportTitle,
        Author: 'Site Mechanic',
        Subject: `${this.reportType} Analysis Report`,
        Creator: 'Site Mechanic Premium Reports'
      }
    });

    this.currentPage = 1;
    return this.doc;
  }

  /**
   * Add premium cover page with hero score
   */
  addCoverPage(data) {
    const doc = this.doc;
    const score = data.overallScore || data.score || 0;

    // Logo
    this._addLogo(50, 40);

    // Accent line
    doc.rect(50, 90, 200, 4)
       .fillColor(this.accentColor)
       .fill();

    // Report type badge
    doc.fontSize(PREMIUM.SIZES.small)
       .font(PREMIUM.FONTS.heading)
       .fillColor(this.accentColor)
       .text('PREMIUM REPORT', 50, 110);

    // Main title
    doc.fontSize(PREMIUM.SIZES.heroTitle)
       .font(PREMIUM.FONTS.title)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text(this.reportTitle, 50, 140, { width: PREMIUM.PAGE.contentWidth });

    // URL analyzed
    if (data.url) {
      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(data.url, 50, doc.y + 10);
    }

    // Date
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.fontSize(PREMIUM.SIZES.small)
       .fillColor(PREMIUM.COLORS.textMuted)
       .text(`Generated: ${date}`, 50, doc.y + 5);

    // Hero score section
    const scoreY = 280;

    // Score background card
    this._drawPremiumCard(50, scoreY, PREMIUM.PAGE.contentWidth, 200, {
      backgroundColor: PREMIUM.SECTIONS.executive,
      shadow: true
    });

    // Large gauge chart
    drawGaugeChart(doc, score, '', 180, scoreY + 100, {
      radius: 80,
      width: 16,
      showValue: true,
      showLabel: false
    });

    // Score interpretation
    const interpretation = this._getScoreInterpretation(score);
    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(getScoreColor(score))
       .text(interpretation.label, 300, scoreY + 50, { width: 230 });

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(interpretation.description, 300, scoreY + 75, { width: 230 });

    // Key stats row
    const statsY = scoreY + 220;
    this._addKeyStats(data, statsY);

    // Value proposition footer
    doc.fontSize(PREMIUM.SIZES.caption)
       .font(PREMIUM.FONTS.emphasis)
       .fillColor(PREMIUM.COLORS.textMuted)
       .text(
         'This premium report includes executive insights, industry benchmarks, and a prioritized action plan.',
         50, 700,
         { width: PREMIUM.PAGE.contentWidth, align: 'center' }
       );

    this._addPageNumber();
  }

  /**
   * Add Executive Summary page
   * The most valuable page - quick overview for busy stakeholders
   */
  addExecutiveSummary(data, options = {}) {
    this.doc.addPage();
    this.currentPage++;

    const doc = this.doc;
    const {
      componentScores = {},
      keyFindings = [],
      businessImpact = null
    } = options;

    // Page header
    this._addSectionHeader('Executive Summary', {
      subtitle: 'Key insights at a glance'
    });

    // Overall score card
    const score = data.overallScore || data.score || 0;
    this._drawPremiumCard(50, doc.y + 10, 200, 120, {
      backgroundColor: PREMIUM.SECTIONS.executive
    });

    const cardY = doc.y + 10;
    drawGaugeChart(doc, score, 'Overall Score', 150, cardY + 70, {
      radius: 50,
      width: 10,
      showValue: true,
      showLabel: true
    });

    // Component breakdown
    if (Object.keys(componentScores).length > 0) {
      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Component Scores', 270, cardY + 15);

      let barY = cardY + 35;
      Object.entries(componentScores).forEach(([label, value]) => {
        this._drawMiniProgressBar(270, barY, 270, label, value);
        barY += 22;
      });
    }

    doc.y = cardY + 140;

    // Key Findings (Top 3-5 issues)
    if (keyFindings.length > 0) {
      doc.moveDown(1);
      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Key Findings', 50, doc.y);

      doc.moveDown(0.5);

      keyFindings.slice(0, 5).forEach((finding, index) => {
        this._addFindingItem(finding, index + 1);
      });
    }

    // Business Impact section
    if (businessImpact) {
      this._addBusinessImpact(businessImpact);
    }

    this._addPageNumber();
  }

  /**
   * Add Industry Benchmark Comparison page
   */
  addBenchmarkComparison(data, benchmarks = {}) {
    this.doc.addPage();
    this.currentPage++;

    const doc = this.doc;

    this._addSectionHeader('Industry Benchmarks', {
      subtitle: 'How you compare to competitors'
    });

    // Benchmark card
    this._drawPremiumCard(50, doc.y + 10, PREMIUM.PAGE.contentWidth, 180, {
      backgroundColor: PREMIUM.SECTIONS.benchmark
    });

    const cardY = doc.y + 10;
    const score = data.overallScore || data.score || 0;

    // Your score vs benchmarks
    const comparisonData = [
      { label: 'Your Score', value: score },
      { label: 'Industry Average', value: benchmarks.industryAverage || 65 },
      { label: 'Top Performers', value: benchmarks.topPerformers || 90 },
      { label: 'Competitors Avg', value: benchmarks.competitorsAverage || 70 }
    ];

    drawBarChart(doc, comparisonData, 70, cardY + 30, {
      width: 450,
      barHeight: 28,
      showValues: true,
      colorScheme: 'score'
    });

    doc.y = cardY + 200;

    // Interpretation
    const percentile = this._calculatePercentile(score, benchmarks.industryAverage || 65);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text(
         `Your ${this.reportType.toLowerCase()} score of ${score} places you in the `,
         50, doc.y,
         { continued: true }
       )
       .font(PREMIUM.FONTS.heading)
       .fillColor(getScoreColor(score))
       .text(`${percentile}th percentile`, { continued: true })
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text(' compared to similar websites.');

    doc.moveDown(1);

    // What this means
    this._addPlainEnglishBox(
      'What This Means For Your Business',
      this._getBenchmarkInterpretation(score, benchmarks)
    );

    this._addPageNumber();
  }

  /**
   * Add Prioritized Action Roadmap
   * The actionable value - what to fix and in what order
   */
  addActionRoadmap(recommendations = []) {
    this.doc.addPage();
    this.currentPage++;

    const doc = this.doc;

    this._addSectionHeader('Action Roadmap', {
      subtitle: 'Prioritized fixes by impact and effort'
    });

    if (!recommendations || recommendations.length === 0) {
      this._drawPremiumCard(50, doc.y + 10, PREMIUM.PAGE.contentWidth, 80, {
        backgroundColor: '#F5F5F5'
      });

      doc.fontSize(PREMIUM.SIZES.sectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.excellent)
         .text('Excellent! No critical issues found.', 70, doc.y + 35);

      this._addPageNumber();
      return;
    }

    // Group by priority
    const priorityGroups = {
      high: recommendations.filter(r => r.priority === 'high' || r.priority === 'critical'),
      medium: recommendations.filter(r => r.priority === 'medium'),
      low: recommendations.filter(r => r.priority === 'low' || r.priority === 'info')
    };

    // Quick wins badge
    const quickWins = recommendations.filter(r =>
      r.effort === 'easy' || r.difficulty === 'easy'
    ).length;

    if (quickWins > 0) {
      this._drawPremiumCard(50, doc.y + 10, PREMIUM.PAGE.contentWidth, 50, {
        backgroundColor: '#F5F5F5',
        borderColor: PREMIUM.COLORS.excellent
      });

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.excellent)
         .text(`${quickWins} Quick Win${quickWins > 1 ? 's' : ''} Available!`, 70, doc.y + 25);

      doc.y += 70;
    } else {
      doc.y += 20;
    }

    // High priority section
    if (priorityGroups.high.length > 0) {
      this._addRoadmapSection('Fix Immediately', priorityGroups.high, 'high');
    }

    // Medium priority section
    if (priorityGroups.medium.length > 0) {
      if (doc.y > 550) {
        this.doc.addPage();
        this.currentPage++;
        doc.y = PREMIUM.PAGE.marginTop;
      }
      this._addRoadmapSection('Address Soon', priorityGroups.medium, 'medium');
    }

    // Low priority section
    if (priorityGroups.low.length > 0) {
      if (doc.y > 550) {
        this.doc.addPage();
        this.currentPage++;
        doc.y = PREMIUM.PAGE.marginTop;
      }
      this._addRoadmapSection('Consider Later', priorityGroups.low, 'low');
    }

    this._addPageNumber();
  }

  /**
   * Add a detailed findings section with charts
   */
  addDetailedFindings(title, data, renderFn) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader(title, {
      subtitle: 'Detailed analysis and metrics'
    });

    // Call custom render function for report-specific content
    if (typeof renderFn === 'function') {
      renderFn(this.doc, data, this);
    }

    this._addPageNumber();
  }

  /**
   * Finalize and save the PDF
   */
  async finalize() {
    const filename = `${this.reportType.toLowerCase()}-premium-${this.reportId}.pdf`;
    const filepath = path.join(this.reportsDir, filename);

    // Ensure directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(filepath);

      stream.on('finish', () => {
        logger.info(`Premium PDF saved: ${filename}`);
        resolve({
          success: true,
          filename,
          filepath,
          reportId: this.reportId,
          pages: this.currentPage
        });
      });

      stream.on('error', reject);

      this.doc.pipe(stream);
      this.doc.end();
    });
  }

  // ========== PRIVATE HELPER METHODS ==========

  _addLogo(x, y) {
    try {
      const logoPath = path.join(__dirname, '../public/assets/logo-pdf.svg');
      if (fs.existsSync(logoPath)) {
        const svgContent = fs.readFileSync(logoPath, 'utf8');
        SVGtoPDF(this.doc, svgContent, x, y, { width: 150, height: 25 });
      } else {
        // Fallback text logo
        this.doc.fontSize(20)
           .font(PREMIUM.FONTS.title)
           .fillColor('#DD3838')
           .text('Site Mechanic', x, y);
      }
    } catch (error) {
      logger.warn('Could not load logo:', error.message);
    }
  }

  _addSectionHeader(title, subtitleOrOptions = {}) {
    const doc = this.doc;

    // Support both string subtitle and options object
    let subtitle, icon;
    if (typeof subtitleOrOptions === 'string') {
      subtitle = subtitleOrOptions;
    } else {
      subtitle = subtitleOrOptions.subtitle;
      icon = subtitleOrOptions.icon;
    }

    // Section header bar
    doc.rect(50, 40, PREMIUM.PAGE.contentWidth, 60)
       .fillColor(this.accentColor || this.reportColor || PREMIUM.COLORS.primary)
       .fillOpacity(0.1)
       .fill()
       .fillOpacity(1);

    // Icon + Title
    const titleText = icon ? `${icon} ${title}` : title;
    doc.fontSize(PREMIUM.SIZES.pageTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text(titleText, 60, 55);

    // Subtitle
    if (subtitle) {
      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(subtitle, 60, 80);
    }

    doc.y = 115;
  }

  /**
   * Add a subsection title at a specific y position
   */
  _addSubsectionTitle(title, y) {
    this.doc.fontSize(PREMIUM.SIZES.subsectionTitle || 13)
       .font(PREMIUM.FONTS.heading)
       .fillColor(this.reportColor || PREMIUM.COLORS.primary)
       .text(title, PREMIUM.PAGE.MARGIN, y);
  }

  /**
   * Check if we need a page break and add one if necessary
   */
  checkPageBreakNeeded(minSpace = 100) {
    if (this.doc.y > PREMIUM.PAGE.height - PREMIUM.PAGE.marginBottom - minSpace) {
      this.doc.addPage();
      this.currentPage++;
      return true;
    }
    return false;
  }

  /**
   * End the document and return buffers (for premium generators using buffer mode)
   * This waits for the document to fully write before returning
   */
  async endDocument() {
    return new Promise((resolve, reject) => {
      const chunks = [];

      this.doc.on('data', (chunk) => chunks.push(chunk));
      this.doc.on('end', () => {
        this.buffers = chunks;
        resolve(chunks);
      });
      this.doc.on('error', reject);

      this.doc.end();
    });
  }

  _drawPremiumCard(x, y, width, height, options = {}) {
    const doc = this.doc;
    const {
      backgroundColor = PREMIUM.COLORS.surface,
      borderColor = PREMIUM.COLORS.divider,
      shadow = false,
      borderRadius = 8
    } = options;

    // Shadow
    if (shadow) {
      doc.rect(x + 2, y + 2, width, height)
         .fillColor('#00000010')
         .fill();
    }

    // Card background
    doc.roundedRect(x, y, width, height, borderRadius)
       .fillColor(backgroundColor)
       .fill();

    // Border
    doc.roundedRect(x, y, width, height, borderRadius)
       .strokeColor(borderColor)
       .lineWidth(1)
       .stroke();
  }

  _addKeyStats(data, y) {
    const doc = this.doc;
    const stats = this._extractKeyStats(data);
    const statWidth = PREMIUM.PAGE.contentWidth / stats.length;

    stats.forEach((stat, index) => {
      const x = 50 + (index * statWidth);

      doc.fontSize(PREMIUM.SIZES.heroTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(stat.color || PREMIUM.COLORS.textPrimary)
         .text(stat.value, x, y, { width: statWidth, align: 'center' });

      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(stat.label, x, y + 35, { width: statWidth, align: 'center' });
    });
  }

  _extractKeyStats(data) {
    // Override in subclass for report-specific stats
    return [
      { label: 'Overall Score', value: data.overallScore || 0, color: getScoreColor(data.overallScore || 0) },
      { label: 'Issues Found', value: data.issuesCount || 0, color: PREMIUM.COLORS.textPrimary },
      { label: 'Passed Checks', value: data.passedCount || 0, color: PREMIUM.COLORS.excellent }
    ];
  }

  _getScoreInterpretation(score) {
    if (score >= 90) {
      return {
        label: 'Excellent',
        description: 'Your site performs exceptionally well. Focus on maintaining this standard.'
      };
    } else if (score >= 80) {
      return {
        label: 'Good',
        description: 'Solid performance with room for optimization. A few improvements can push you to excellent.'
      };
    } else if (score >= 70) {
      return {
        label: 'Fair',
        description: 'Noticeable issues affecting performance. Addressing these will significantly improve results.'
      };
    } else if (score >= 50) {
      return {
        label: 'Needs Work',
        description: 'Multiple issues detected. Prioritize the action roadmap to improve your score.'
      };
    } else {
      return {
        label: 'Critical',
        description: 'Serious issues require immediate attention. Follow the action roadmap urgently.'
      };
    }
  }

  _drawMiniProgressBar(x, y, width, label, value) {
    const doc = this.doc;
    const barHeight = 12;
    const labelWidth = 100;
    const barWidth = width - labelWidth - 40;

    // Label
    doc.fontSize(PREMIUM.SIZES.small)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text(label, x, y + 1, { width: labelWidth });

    // Background
    doc.rect(x + labelWidth, y, barWidth, barHeight)
       .fillColor(PREMIUM.COLORS.divider)
       .fill();

    // Fill
    const fillWidth = (value / 100) * barWidth;
    doc.rect(x + labelWidth, y, fillWidth, barHeight)
       .fillColor(getScoreColor(value))
       .fill();

    // Value
    doc.fontSize(PREMIUM.SIZES.small)
       .font(PREMIUM.FONTS.heading)
       .fillColor(getScoreColor(value))
       .text(`${Math.round(value)}`, x + labelWidth + barWidth + 5, y + 1);
  }

  _addFindingItem(finding, index) {
    const doc = this.doc;
    const priorityColors = {
      high: PREMIUM.COLORS.priorityHigh,
      critical: PREMIUM.COLORS.priorityHigh,
      medium: PREMIUM.COLORS.priorityMedium,
      low: PREMIUM.COLORS.priorityLow
    };

    const color = priorityColors[finding.priority] || PREMIUM.COLORS.textSecondary;

    // Number badge
    doc.circle(60, doc.y + 6, 10)
       .fillColor(color)
       .fill();

    doc.fontSize(PREMIUM.SIZES.small)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.surface)
       .text(index.toString(), 55, doc.y - 4, { width: 10, align: 'center' });

    // Finding text
    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text(finding.title || finding.message, 80, doc.y - 10, { width: 450 });

    if (finding.description) {
      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(finding.description.substring(0, 150) + (finding.description.length > 150 ? '...' : ''), 80, doc.y, { width: 450 });
    }

    doc.moveDown(0.8);
  }

  _addBusinessImpact(impact) {
    const doc = this.doc;

    doc.moveDown(1);

    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 100, {
      backgroundColor: PREMIUM.SECTIONS.roadmap,
      borderColor: PREMIUM.COLORS.priorityMedium
    });

    const cardY = doc.y;

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Business Impact', 70, cardY + 15);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(impact.summary || impact, 70, cardY + 40, { width: 470 });

    doc.y = cardY + 110;
  }

  _calculatePercentile(score, average) {
    // Simple percentile estimation
    if (score >= 95) return 99;
    if (score >= 90) return 95;
    if (score >= average + 15) return 85;
    if (score >= average + 5) return 70;
    if (score >= average) return 55;
    if (score >= average - 10) return 40;
    if (score >= average - 20) return 25;
    return 10;
  }

  _getBenchmarkInterpretation(score, benchmarks) {
    const avg = benchmarks.industryAverage || 65;
    const diff = score - avg;

    if (diff >= 20) {
      return `You're significantly outperforming the industry average by ${diff} points. This is a competitive advantage you should highlight in your marketing.`;
    } else if (diff >= 10) {
      return `You're ahead of most competitors by ${diff} points. Continue these practices to maintain your lead.`;
    } else if (diff >= 0) {
      return `You're performing at or slightly above industry average. Small improvements can help you stand out from competitors.`;
    } else if (diff >= -10) {
      return `You're ${Math.abs(diff)} points below average. This may be costing you customers. The roadmap below shows how to catch up.`;
    } else {
      return `You're significantly behind at ${Math.abs(diff)} points below average. This is likely impacting your business. Immediate action is recommended.`;
    }
  }

  _addPlainEnglishBox(title, content, yPosition = null) {
    const doc = this.doc;
    const y = yPosition !== null ? yPosition : doc.y;

    // Calculate dynamic height based on content
    const contentHeight = Math.max(100, Math.min(150, 60 + (content.length / 3)));

    this._drawPremiumCard(50, y, PREMIUM.PAGE.contentWidth, contentHeight, {
      backgroundColor: '#F5F5F5',
      borderColor: PREMIUM.COLORS.divider
    });

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text(title, 70, y + 15);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(content, 70, y + 40, { width: 470 });

    doc.y = y + contentHeight + 10;
  }

  _addRoadmapSection(title, items, priority) {
    const doc = this.doc;
    const colors = {
      high: { bg: '#FFEBEE', border: PREMIUM.COLORS.priorityHigh, label: 'HIGH' },
      medium: { bg: '#FFF3E0', border: PREMIUM.COLORS.priorityMedium, label: 'MEDIUM' },
      low: { bg: '#E3F2FD', border: PREMIUM.COLORS.priorityLow, label: 'LOW' }
    };

    const style = colors[priority] || colors.medium;

    // Draw priority indicator circle
    doc.circle(60, doc.y + 6, 6)
       .fillColor(style.border)
       .fill();

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(style.border)
       .text(title, 75, doc.y - 6);

    doc.moveDown(0.5);

    items.slice(0, 5).forEach((item, index) => {
      if (doc.y > 680) return; // Don't overflow page

      const cardHeight = this._calculateRoadmapItemHeight(item);

      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, cardHeight, {
        backgroundColor: style.bg,
        borderColor: style.border
      });

      const cardY = doc.y;

      // Title
      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(item.title || item.message, 70, cardY + 12, { width: 400 });

      // Impact/Effort badges
      if (item.impact || item.effort || item.difficulty) {
        let badgeX = 70;
        const badgeY = cardY + 30;

        if (item.impact) {
          this._drawBadge(badgeX, badgeY, `Impact: ${item.impact}`, item.impact);
          badgeX += 80;
        }
        if (item.effort || item.difficulty) {
          const effort = item.effort || item.difficulty;
          this._drawBadge(badgeX, badgeY, `Effort: ${effort}`, effort === 'easy' ? 'low' : effort);
        }
      }

      // Fix/Solution
      if (item.fix || item.solution || (item.actions && item.actions.length > 0)) {
        const fixY = (item.impact || item.effort) ? cardY + 48 : cardY + 30;
        const fixText = item.fix || item.solution || item.actions[0];

        doc.fontSize(PREMIUM.SIZES.small)
           .font(PREMIUM.FONTS.body)
           .fillColor(PREMIUM.COLORS.excellent)
           .text(`→ ${fixText}`, 70, fixY, { width: 450 });
      }

      doc.y = cardY + cardHeight + 8;
    });

    if (items.length > 5) {
      doc.fontSize(PREMIUM.SIZES.small)
         .fillColor(PREMIUM.COLORS.textMuted)
         .text(`+ ${items.length - 5} more items`, 50, doc.y);
      doc.moveDown(0.5);
    }

    doc.moveDown(1);
  }

  _calculateRoadmapItemHeight(item) {
    let height = 30; // Base height for title
    if (item.impact || item.effort || item.difficulty) height += 20;
    if (item.fix || item.solution || (item.actions && item.actions.length > 0)) height += 20;
    return Math.max(height, 50);
  }

  _drawBadge(x, y, text, type) {
    const doc = this.doc;
    const colors = {
      high: PREMIUM.COLORS.priorityHigh,
      medium: PREMIUM.COLORS.priorityMedium,
      low: PREMIUM.COLORS.priorityLow,
      easy: PREMIUM.COLORS.excellent
    };

    const color = colors[type] || PREMIUM.COLORS.textMuted;

    doc.fontSize(PREMIUM.SIZES.tiny)
       .font(PREMIUM.FONTS.heading)
       .fillColor(color)
       .text(text.toUpperCase(), x, y);
  }

  _addPageNumber() {
    const doc = this.doc;

    doc.fontSize(PREMIUM.SIZES.caption)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textMuted)
       .text(
         `Page ${this.currentPage}`,
         50,
         PREMIUM.PAGE.height - 30,
         { width: PREMIUM.PAGE.contentWidth, align: 'center' }
       );
  }
}

// Export both as named exports and attach PREMIUM as static property
PremiumPdfReport.PREMIUM = PREMIUM;
module.exports = {
  PremiumPdfReport,
  PREMIUM,
  default: PremiumPdfReport
};
