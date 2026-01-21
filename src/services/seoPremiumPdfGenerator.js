/**
 * SEO Premium PDF Report Generator
 *
 * Creates a high-value, professionally designed SEO report worth $10+
 * Extends the PremiumPdfReport base class with SEO-specific content:
 * - Executive Summary with SEO component scores
 * - Industry SEO benchmarks comparison
 * - Prioritized SEO action roadmap
 * - Detailed analysis sections with plain English explanations
 *
 * @module services/seoPremiumPdfGenerator
 */

const { PremiumPdfReport, PREMIUM } = require('../utils/premiumPdfTemplate');
const {
  drawGaugeChart,
  drawBarChart,
  drawPieChart,
  drawProgressBar,
  getScoreColor
} = require('../utils/pdfCharts');
const { createLogger } = require('../utils/logger');
const { checkPageBreakNeeded } = require('../utils/pdfHelpers');

const logger = createLogger('SEOPremiumPdfGenerator');

// SEO-specific benchmarks
const SEO_BENCHMARKS = {
  industryAverage: 62,
  topPerformers: 88,
  competitorsAverage: 68,
  // Component benchmarks
  metaTags: { average: 70, top: 95 },
  headings: { average: 65, top: 90 },
  images: { average: 55, top: 85 },
  content: { average: 60, top: 88 },
  technical: { average: 68, top: 92 }
};

// SEO business impact templates
const SEO_BUSINESS_IMPACT = {
  excellent: {
    summary: 'Your site is well-optimized for search engines. You\'re likely capturing organic traffic effectively and ranking well for relevant keywords.',
    metrics: [
      'Higher organic rankings lead to 30-40% more clicks',
      'Well-optimized pages convert 2x better than poorly optimized ones',
      'Strong SEO reduces dependency on paid advertising'
    ]
  },
  good: {
    summary: 'Your SEO foundation is solid but has room for improvement. Addressing the issues below could increase your organic traffic by 15-25%.',
    metrics: [
      'Fixing meta tags can improve CTR by 5-10%',
      'Better headings structure helps Google understand your content',
      'Image optimization can speed up pages and improve rankings'
    ]
  },
  fair: {
    summary: 'Your SEO needs attention. Competitors with better optimization are likely outranking you, costing you potential customers.',
    metrics: [
      'Missing meta descriptions reduce click-through rates by 30%',
      'Poor heading structure confuses search engines',
      'You may be invisible for important keywords'
    ]
  },
  poor: {
    summary: 'Critical SEO issues are severely limiting your search visibility. Immediate action is required to compete in organic search.',
    metrics: [
      'You\'re likely missing 50%+ of potential organic traffic',
      'Search engines may struggle to index your content properly',
      'Competitors are capturing traffic you should be getting'
    ]
  }
};

/**
 * SEO Premium PDF Generator
 * Extends PremiumPdfReport with SEO-specific content and insights
 */
class SEOPremiumPdfGenerator extends PremiumPdfReport {
  constructor() {
    super({
      reportType: 'SEO',
      reportTitle: 'SEO Analysis Report',
      reportSubtitle: 'Search Engine Optimization Premium Analysis',
      accentColor: '#1976D2' // Material Blue for SEO
    });
  }

  /**
   * Generate the complete SEO premium report
   */
  async generateReport(seoResults) {
    try {
      this.initializeDocument(seoResults);

      // Page 1: Cover
      this.addCoverPage(seoResults);

      // Page 2: Executive Summary
      this.addExecutiveSummary(seoResults, {
        componentScores: this._extractComponentScores(seoResults),
        keyFindings: this._extractKeyFindings(seoResults),
        businessImpact: this._getBusinessImpact(seoResults.overallScore || 0)
      });

      // Page 3: Industry Benchmarks
      this.addBenchmarkComparison(seoResults, SEO_BENCHMARKS);

      // Page 4+: Action Roadmap
      this.addActionRoadmap(this._enhanceRecommendations(seoResults.recommendations || []));

      // Detailed Analysis Sections
      this.addMetaTagsSection(seoResults.metaTags);
      this.addHeadingsSection(seoResults.headings);
      this.addImagesSection(seoResults.images);
      this.addContentSection(seoResults.content);
      this.addTechnicalSEOSection(seoResults.technical);

      // Final page: Summary & Next Steps
      this.addNextSteps(seoResults);

      return await this.finalize();
    } catch (error) {
      logger.error('Error generating SEO premium PDF:', error);
      throw error;
    }
  }

  /**
   * Override: Extract key stats for cover page
   */
  _extractKeyStats(data) {
    const metaScore = data.metaTags?.score || 0;
    const contentScore = data.content?.score || 0;
    const issuesCount = data.recommendations?.length || 0;

    return [
      {
        label: 'Overall Score',
        value: data.overallScore || 0,
        color: getScoreColor(data.overallScore || 0)
      },
      {
        label: 'Meta Tags',
        value: metaScore,
        color: getScoreColor(metaScore)
      },
      {
        label: 'Issues Found',
        value: issuesCount,
        color: issuesCount > 5 ? PREMIUM.COLORS.priorityHigh : PREMIUM.COLORS.textPrimary
      }
    ];
  }

  /**
   * Extract component scores for executive summary
   */
  _extractComponentScores(data) {
    return {
      'Meta Tags': data.metaTags?.score || 0,
      'Headings': data.headings?.score || 0,
      'Images': data.images?.score || data.images?.summary?.score || 0,
      'Content': data.content?.score || 0,
      'Technical': data.technical?.score || 0
    };
  }

  /**
   * Extract top issues as key findings
   */
  _extractKeyFindings(data) {
    const findings = [];
    const recs = data.recommendations || [];

    // Get high priority issues first
    const highPriority = recs.filter(r => r.priority === 'high' || r.priority === 'critical');
    const mediumPriority = recs.filter(r => r.priority === 'medium');

    highPriority.slice(0, 3).forEach(rec => {
      findings.push({
        title: rec.title || rec.message,
        description: rec.description,
        priority: 'high'
      });
    });

    mediumPriority.slice(0, 2).forEach(rec => {
      findings.push({
        title: rec.title || rec.message,
        description: rec.description,
        priority: 'medium'
      });
    });

    return findings;
  }

  /**
   * Get business impact based on score
   */
  _getBusinessImpact(score) {
    if (score >= 85) return SEO_BUSINESS_IMPACT.excellent;
    if (score >= 70) return SEO_BUSINESS_IMPACT.good;
    if (score >= 50) return SEO_BUSINESS_IMPACT.fair;
    return SEO_BUSINESS_IMPACT.poor;
  }

  /**
   * Enhance recommendations with effort/impact ratings
   */
  _enhanceRecommendations(recommendations) {
    return recommendations.map(rec => {
      // Determine effort based on type of fix
      let effort = 'medium';
      let impact = 'medium';

      const title = (rec.title || rec.message || '').toLowerCase();

      // Easy fixes
      if (title.includes('meta description') ||
          title.includes('title tag') ||
          title.includes('alt text')) {
        effort = 'easy';
      }

      // Hard fixes
      if (title.includes('structure') ||
          title.includes('redesign') ||
          title.includes('architecture')) {
        effort = 'hard';
      }

      // High impact
      if (title.includes('title') ||
          title.includes('h1') ||
          title.includes('missing') ||
          rec.priority === 'high') {
        impact = 'high';
      }

      // Low impact
      if (rec.priority === 'low' || title.includes('optional')) {
        impact = 'low';
      }

      return {
        ...rec,
        effort,
        impact,
        fix: rec.fix || rec.solution || (rec.actions && rec.actions[0]) || this._generateFix(rec)
      };
    });
  }

  /**
   * Generate a fix suggestion if none provided
   */
  _generateFix(rec) {
    const title = (rec.title || rec.message || '').toLowerCase();

    if (title.includes('title')) {
      return 'Update your page title to be 50-60 characters with your primary keyword near the beginning.';
    }
    if (title.includes('description')) {
      return 'Write a compelling meta description of 150-160 characters that includes your target keyword.';
    }
    if (title.includes('alt')) {
      return 'Add descriptive alt text to all images describing what the image shows.';
    }
    if (title.includes('heading') || title.includes('h1')) {
      return 'Ensure each page has exactly one H1 tag containing your primary keyword.';
    }
    if (title.includes('content') || title.includes('word')) {
      return 'Expand your content to at least 300 words with relevant, valuable information.';
    }

    return 'Review and address this issue to improve your SEO performance.';
  }

  /**
   * Add detailed Meta Tags section
   */
  addMetaTagsSection(metaTags) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Meta Tags Analysis', {
      subtitle: 'How search engines see your page'
    });

    const doc = this.doc;

    if (!metaTags || !metaTags.tags) {
      this._addPlainEnglishBox(
        'No Meta Tags Data',
        'We couldn\'t retrieve meta tag information for this page. This may indicate the page wasn\'t fully loaded or has restricted access.'
      );
      this._addPageNumber();
      return;
    }

    // Title Tag Card
    if (metaTags.tags.title) {
      const title = metaTags.tags.title;
      const titleScore = this._calculateTitleScore(title);

      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 100, {
        backgroundColor: titleScore >= 80 ? '#F5F5F5' : titleScore >= 60 ? '#FFF3E0' : '#FFEBEE'
      });

      const cardY = doc.y;

      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Title Tag', 70, cardY + 15);

      // Mini gauge
      drawGaugeChart(doc, titleScore, '', 500, cardY + 50, {
        radius: 30,
        width: 6,
        showValue: true,
        showLabel: false
      });

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(`"${title.content}"`, 70, cardY + 40, { width: 380 });

      doc.fontSize(PREMIUM.SIZES.small)
         .text(`Length: ${title.length} characters (optimal: 50-60)`, 70, cardY + 75);

      doc.y = cardY + 115;
    }

    // Meta Description Card
    if (metaTags.tags.description) {
      const desc = metaTags.tags.description;
      const descScore = this._calculateDescriptionScore(desc);

      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 110, {
        backgroundColor: descScore >= 80 ? '#F5F5F5' : descScore >= 60 ? '#FFF3E0' : '#FFEBEE'
      });

      const cardY = doc.y;

      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Meta Description', 70, cardY + 15);

      // Mini gauge
      drawGaugeChart(doc, descScore, '', 500, cardY + 55, {
        radius: 30,
        width: 6,
        showValue: true,
        showLabel: false
      });

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(`"${desc.content?.substring(0, 160)}${desc.content?.length > 160 ? '...' : ''}"`, 70, cardY + 40, { width: 380 });

      doc.fontSize(PREMIUM.SIZES.small)
         .text(`Length: ${desc.length} characters (optimal: 150-160)`, 70, cardY + 85);

      doc.y = cardY + 125;
    }

    doc.moveDown(1);

    // Plain English explanation
    this._addPlainEnglishBox(
      'What This Means For You',
      this._getMetaTagsExplanation(metaTags)
    );

    // Open Graph summary
    if (metaTags.openGraph && Object.keys(metaTags.openGraph).length > 0) {
      doc.moveDown(1);

      const ogCount = Object.keys(metaTags.openGraph).length;
      const ogTotal = 8; // Typical OG tags needed
      const ogPercent = Math.min(100, (ogCount / ogTotal) * 100);

      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Social Media Tags (Open Graph)', 50, doc.y);

      doc.moveDown(0.5);

      drawProgressBar(doc, ogPercent, `${ogCount} of ${ogTotal} recommended tags present`, 50, doc.y, {
        width: PREMIUM.PAGE.contentWidth,
        height: 25,
        showPercentage: true
      });

      doc.y += 40;
    }

    this._addPageNumber();
  }

  /**
   * Add detailed Headings section
   */
  addHeadingsSection(headings) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Headings Structure', {
      subtitle: 'Content hierarchy and organization'
    });

    const doc = this.doc;

    if (!headings || !headings.hierarchy) {
      this._addPlainEnglishBox(
        'No Headings Data',
        'We couldn\'t analyze the heading structure. Your page may not have proper heading tags (H1-H6).'
      );
      this._addPageNumber();
      return;
    }

    // Heading distribution chart
    const headingData = [];
    let totalHeadings = 0;

    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
      const count = headings.hierarchy[tag]?.length || 0;
      totalHeadings += count;
      headingData.push({
        label: tag.toUpperCase(),
        value: count
      });
    });

    if (headingData.some(d => d.value > 0)) {
      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Heading Distribution', 50, doc.y);

      doc.moveDown(0.5);

      const chartHeight = drawBarChart(doc, headingData, 50, doc.y, {
        width: PREMIUM.PAGE.contentWidth,
        barHeight: 28,
        showValues: true,
        colorScheme: 'primary'
      });

      doc.y += chartHeight + 20;
    }

    // H1 Analysis (most important for SEO)
    const h1Count = headings.hierarchy.h1?.length || 0;

    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
      backgroundColor: h1Count === 1 ? '#F5F5F5' : h1Count === 0 ? '#FFEBEE' : '#FFF3E0'
    });

    const cardY = doc.y;

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('H1 Tag Analysis', 70, cardY + 15);

    const h1Status = h1Count === 1 ? 'PASS - Exactly one H1' :
                     h1Count === 0 ? 'FAIL - Missing H1 tag' :
                     `WARNING - Multiple H1s (${h1Count} found)`;

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(h1Count === 1 ? PREMIUM.COLORS.excellent : h1Count === 0 ? PREMIUM.COLORS.critical : PREMIUM.COLORS.fair)
       .text(h1Status, 70, cardY + 40);

    if (headings.hierarchy.h1?.[0]) {
      doc.fontSize(PREMIUM.SIZES.small)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(`Content: "${headings.hierarchy.h1[0].text?.substring(0, 80)}..."`, 70, cardY + 55, { width: 450 });
    }

    doc.y = cardY + 95;

    // Plain English explanation
    this._addPlainEnglishBox(
      'Why Headings Matter',
      this._getHeadingsExplanation(headings, h1Count, totalHeadings)
    );

    this._addPageNumber();
  }

  /**
   * Add detailed Images section
   */
  addImagesSection(images) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Image Analysis', {
      subtitle: 'Alt text coverage and optimization'
    });

    const doc = this.doc;

    if (!images || !images.summary) {
      this._addPlainEnglishBox(
        'No Image Data',
        'We couldn\'t analyze images on this page. The page may not contain any images or they may be loaded dynamically.'
      );
      this._addPageNumber();
      return;
    }

    const summary = images.summary;
    const total = summary.totalImages || 0;
    const withAlt = summary.withAltText || 0;
    const withoutAlt = total - withAlt;
    const coverage = total > 0 ? Math.round((withAlt / total) * 100) : 0;

    // Three gauges row
    const gaugeY = doc.y + 70;

    drawGaugeChart(doc, coverage, 'Alt Text Coverage', 130, gaugeY, {
      radius: 55,
      width: 12,
      showValue: true,
      showLabel: true
    });

    drawGaugeChart(doc, summary.score || coverage, 'Image Score', 306, gaugeY, {
      radius: 55,
      width: 12,
      showValue: true,
      showLabel: true
    });

    // Total images (display number instead of percentage)
    drawGaugeChart(doc, 0, 'Images Found', 482, gaugeY, {
      radius: 55,
      width: 12,
      showValue: false,
      showLabel: true
    });

    // Draw count in center
    doc.font(PREMIUM.FONTS.heading)
       .fontSize(22)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text(total.toString(), 482 - 55, gaugeY - 30, { width: 110, align: 'center' });

    doc.y = gaugeY + 80;

    // Statistics cards
    doc.moveDown(1);

    // With alt text card
    this._drawPremiumCard(50, doc.y, 240, 60, {
      backgroundColor: '#F5F5F5'
    });

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.excellent)
       .text(`${withAlt} images with alt text`, 70, doc.y + 20);

    // Missing alt text card
    this._drawPremiumCard(310, doc.y, 252, 60, {
      backgroundColor: withoutAlt > 0 ? '#FFEBEE' : '#F5F5F5'
    });

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.heading)
       .fillColor(withoutAlt > 0 ? PREMIUM.COLORS.critical : PREMIUM.COLORS.excellent)
       .text(withoutAlt > 0 ? `${withoutAlt} images missing alt text` : 'All images have alt text', 330, doc.y + 20);

    doc.y += 80;

    // Plain English explanation
    this._addPlainEnglishBox(
      'What This Means For Your SEO',
      this._getImagesExplanation(total, withAlt, withoutAlt)
    );

    // Sample images needing alt text
    if (images.details && withoutAlt > 0) {
      const missingAlt = images.details.filter(img => !img.alt).slice(0, 5);

      if (missingAlt.length > 0) {
        doc.moveDown(1);

        doc.fontSize(PREMIUM.SIZES.subsectionTitle)
           .font(PREMIUM.FONTS.heading)
           .fillColor(PREMIUM.COLORS.textPrimary)
           .text('Images Needing Alt Text:', 50, doc.y);

        doc.moveDown(0.5);

        missingAlt.forEach((img, i) => {
          const src = img.src ? img.src.substring(0, 60) + (img.src.length > 60 ? '...' : '') : 'Unknown';
          doc.fontSize(PREMIUM.SIZES.small)
             .font(PREMIUM.FONTS.body)
             .fillColor(PREMIUM.COLORS.textSecondary)
             .text(`${i + 1}. ${src}`, 60, doc.y);
          doc.moveDown(0.3);
        });
      }
    }

    this._addPageNumber();
  }

  /**
   * Add detailed Content section
   */
  addContentSection(content) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Content Analysis', {
      subtitle: 'Word count, readability, and keywords'
    });

    const doc = this.doc;

    if (!content) {
      this._addPlainEnglishBox(
        'No Content Data',
        'We couldn\'t analyze the content on this page. The page may have minimal text content.'
      );
      this._addPageNumber();
      return;
    }

    // Content metrics row
    const wordCount = content.wordCount || 0;
    const readability = content.readabilityScore || 0;

    // Word count card
    this._drawPremiumCard(50, doc.y, 160, 100, {
      backgroundColor: wordCount >= 300 ? '#F5F5F5' : wordCount >= 150 ? '#FFF3E0' : '#FFEBEE'
    });

    doc.fontSize(32)
       .font(PREMIUM.FONTS.heading)
       .fillColor(getScoreColor(Math.min(100, (wordCount / 300) * 100)))
       .text(wordCount.toString(), 50, doc.y + 25, { width: 160, align: 'center' });

    doc.fontSize(PREMIUM.SIZES.small)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text('Words', 50, doc.y + 70, { width: 160, align: 'center' });

    // Reading time card
    this._drawPremiumCard(225, doc.y - 100, 160, 100, {
      backgroundColor: '#E3F2FD'
    });

    const readingTime = content.readingTime || `${Math.ceil(wordCount / 200)} min`;
    doc.fontSize(24)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.primary)
       .text(readingTime, 225, doc.y - 75, { width: 160, align: 'center' });

    doc.fontSize(PREMIUM.SIZES.small)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text('Reading Time', 225, doc.y - 30, { width: 160, align: 'center' });

    // Readability card
    this._drawPremiumCard(400, doc.y - 100, 162, 100, {
      backgroundColor: readability >= 60 ? '#F5F5F5' : readability >= 40 ? '#FFF3E0' : '#FFEBEE'
    });

    doc.fontSize(32)
       .font(PREMIUM.FONTS.heading)
       .fillColor(getScoreColor(readability))
       .text(readability.toString(), 400, doc.y - 75, { width: 162, align: 'center' });

    doc.fontSize(PREMIUM.SIZES.small)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text('Readability', 400, doc.y - 30, { width: 162, align: 'center' });

    doc.y += 20;

    // Keywords section
    if (content.keywords && content.keywords.length > 0) {
      doc.moveDown(1);

      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Top Keywords', 50, doc.y);

      doc.moveDown(0.5);

      const keywordData = content.keywords.slice(0, 8).map(kw => ({
        label: kw.word,
        value: kw.count
      }));

      const chartHeight = drawBarChart(doc, keywordData, 50, doc.y, {
        width: PREMIUM.PAGE.contentWidth,
        barHeight: 22,
        showValues: true,
        colorScheme: 'primary'
      });

      doc.y += chartHeight;
    }

    doc.moveDown(1);

    // Plain English explanation
    this._addPlainEnglishBox(
      'Content Quality Assessment',
      this._getContentExplanation(wordCount, readability)
    );

    this._addPageNumber();
  }

  /**
   * Add Technical SEO section
   */
  addTechnicalSEOSection(technical) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Technical SEO', {
      subtitle: 'Implementation and best practices'
    });

    const doc = this.doc;

    if (!technical) {
      this._addPlainEnglishBox(
        'No Technical Data',
        'We couldn\'t analyze technical SEO elements. This may indicate issues with page accessibility.'
      );
      this._addPageNumber();
      return;
    }

    // Technical checklist
    const checks = [
      {
        label: 'Canonical URL',
        value: technical.canonical,
        pass: !!technical.canonical,
        explanation: 'Tells search engines which version of a page to index'
      },
      {
        label: 'Robots Meta',
        value: technical.robots || 'Not set',
        pass: !!technical.robots,
        explanation: 'Controls how search engines crawl and index your page'
      },
      {
        label: 'Viewport Meta',
        value: technical.viewport ? 'Present' : 'Missing',
        pass: !!technical.viewport,
        explanation: 'Required for mobile-friendly pages'
      },
      {
        label: 'Language',
        value: technical.language || 'Not set',
        pass: !!technical.language,
        explanation: 'Helps search engines serve content to the right audience'
      },
      {
        label: 'Charset',
        value: technical.charset || 'Not set',
        pass: !!technical.charset,
        explanation: 'Ensures text displays correctly across browsers'
      }
    ];

    let passCount = 0;

    checks.forEach((check, index) => {
      if (check.pass) passCount++;

      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 60, {
        backgroundColor: check.pass ? '#F5F5F5' : '#FFEBEE',
        borderColor: check.pass ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical
      });

      const cardY = doc.y;

      // Status icon - draw colored circle
      doc.circle(72, cardY + 27, 7)
         .fillColor(check.pass ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical)
         .fill();

      // Label and value
      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(check.label, 90, cardY + 15);

      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(check.value?.toString().substring(0, 50) || 'N/A', 90, cardY + 32, { width: 350 });

      // Explanation
      doc.fontSize(PREMIUM.SIZES.caption)
         .fillColor(PREMIUM.COLORS.textMuted)
         .text(check.explanation, 400, cardY + 22, { width: 150 });

      doc.y = cardY + 70;
    });

    // Summary score
    const techScore = Math.round((passCount / checks.length) * 100);

    doc.moveDown(1);

    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 60, {
      backgroundColor: PREMIUM.SECTIONS.executive
    });

    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(getScoreColor(techScore))
       .text(`Technical SEO Score: ${techScore}/100`, 70, doc.y + 20);

    doc.fontSize(PREMIUM.SIZES.small)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(`${passCount} of ${checks.length} checks passed`, 70, doc.y + 40);

    this._addPageNumber();
  }

  /**
   * Add Next Steps page
   */
  addNextSteps(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Next Steps', {
      subtitle: 'Your SEO improvement roadmap'
    });

    const doc = this.doc;
    const score = data.overallScore || 0;

    // Summary card
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 100, {
      backgroundColor: PREMIUM.SECTIONS.executive,
      shadow: true
    });

    const cardY = doc.y;

    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Your SEO Journey', 70, cardY + 20);

    const improvement = score < 50 ? 'significant' : score < 70 ? 'moderate' : score < 85 ? 'incremental' : 'maintenance';

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(
         `Based on your score of ${score}, we recommend focusing on ${improvement} improvements. ` +
         'Follow the prioritized action roadmap to systematically improve your search visibility.',
         70, cardY + 45, { width: 470 }
       );

    doc.y = cardY + 120;

    // Quick wins section
    const quickWins = (data.recommendations || []).filter(r =>
      r.priority === 'high' &&
      ((r.title || r.message || '').toLowerCase().includes('title') ||
       (r.title || r.message || '').toLowerCase().includes('description') ||
       (r.title || r.message || '').toLowerCase().includes('alt'))
    ).slice(0, 3);

    if (quickWins.length > 0) {
      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.excellent)
         .text('Start With These Quick Wins', 50, doc.y);

      doc.moveDown(0.5);

      quickWins.forEach((win, i) => {
        doc.fontSize(PREMIUM.SIZES.body)
           .font(PREMIUM.FONTS.body)
           .fillColor(PREMIUM.COLORS.textPrimary)
           .text(`${i + 1}. ${win.title || win.message}`, 60, doc.y, { width: 480 });
        doc.moveDown(0.5);
      });

      doc.moveDown(1);
    }

    // Resources section
    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Helpful Resources', 50, doc.y);

    doc.moveDown(0.5);

    const resources = [
      'Google Search Console - Monitor your search performance',
      'Google PageSpeed Insights - Check page loading speed',
      'Mobile-Friendly Test - Verify mobile compatibility',
      'Structured Data Testing Tool - Validate schema markup'
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
         'This premium report was generated by Site Mechanic. ' +
         'For questions or additional analysis, contact support.',
         50, doc.y,
         { width: PREMIUM.PAGE.contentWidth, align: 'center' }
       );

    this._addPageNumber();
  }

  // ========== HELPER METHODS ==========

  _calculateTitleScore(title) {
    let score = 100;
    if (!title.content) return 0;
    if (title.length < 30) score -= 30;
    else if (title.length < 50) score -= 10;
    else if (title.length > 60) score -= 15;
    else if (title.length > 70) score -= 30;
    return Math.max(0, score);
  }

  _calculateDescriptionScore(desc) {
    let score = 100;
    if (!desc.content) return 0;
    if (desc.length < 70) score -= 40;
    else if (desc.length < 120) score -= 20;
    else if (desc.length > 160) score -= 15;
    else if (desc.length > 200) score -= 35;
    return Math.max(0, score);
  }

  _getMetaTagsExplanation(metaTags) {
    const title = metaTags.tags?.title;
    const desc = metaTags.tags?.description;

    const issues = [];

    if (!title?.content) {
      issues.push('Your page is missing a title tag - this is critical for SEO.');
    } else if (title.length < 30 || title.length > 70) {
      issues.push('Your title tag length needs adjustment for optimal display in search results.');
    }

    if (!desc?.content) {
      issues.push('Missing meta description means Google will auto-generate one, which may not represent your page well.');
    } else if (desc.length < 120 || desc.length > 160) {
      issues.push('Your meta description length could be optimized for better search result display.');
    }

    if (issues.length === 0) {
      return 'Your meta tags are well-optimized. They provide search engines with accurate information about your page content, which helps with rankings and click-through rates.';
    }

    return issues.join(' ') + ' These issues can reduce your visibility in search results and lower click-through rates.';
  }

  _getHeadingsExplanation(headings, h1Count, totalHeadings) {
    if (h1Count === 0) {
      return 'Your page is missing an H1 heading tag. This is one of the most important on-page SEO elements. Search engines use the H1 to understand what your page is about. Add a clear, descriptive H1 that includes your target keyword.';
    }

    if (h1Count > 1) {
      return `Your page has ${h1Count} H1 tags, but best practice is to have exactly one. Multiple H1s can confuse search engines about your page\'s main topic. Keep the most important H1 and convert others to H2 or H3 tags.`;
    }

    if (totalHeadings < 3) {
      return 'Your page has minimal heading structure. Adding more subheadings (H2, H3) helps organize your content and signals to search engines what topics you cover. Aim for a clear hierarchy that guides readers through your content.';
    }

    return 'Your heading structure is well-organized. A clear hierarchy helps both users and search engines understand your content. Continue using descriptive headings that include relevant keywords naturally.';
  }

  _getImagesExplanation(total, withAlt, withoutAlt) {
    if (total === 0) {
      return 'No images were found on this page. While not always necessary, images can improve user engagement and provide additional ranking opportunities through image search.';
    }

    if (withoutAlt === 0) {
      return 'Excellent! All your images have alt text. This helps search engines understand your images and improves accessibility for users with screen readers. Your images can now appear in Google Image search results.';
    }

    const percentage = Math.round((withoutAlt / total) * 100);

    if (percentage > 50) {
      return `${withoutAlt} of your ${total} images (${percentage}%) are missing alt text. This significantly hurts your SEO and accessibility. Alt text helps Google understand and index your images, and is essential for users who can\'t see them. Prioritize adding descriptive alt text to all images.`;
    }

    return `${withoutAlt} images are missing alt text. While most of your images are optimized, adding alt text to the remaining images will improve your SEO and ensure full accessibility compliance.`;
  }

  _getContentExplanation(wordCount, readability) {
    const issues = [];

    if (wordCount < 300) {
      issues.push(`Your page has only ${wordCount} words. Search engines typically favor content with at least 300-500 words for informational queries. Consider expanding your content with valuable information.`);
    } else if (wordCount < 500) {
      issues.push('Your content length is adequate but could be expanded for more comprehensive coverage of your topic.');
    }

    if (readability < 50) {
      issues.push('Your content may be difficult to read. Consider using shorter sentences and simpler words to improve readability.');
    }

    if (issues.length === 0) {
      return 'Your content has good length and readability. Continue creating valuable, well-structured content that addresses your audience\'s needs. Consider regularly updating your content to keep it fresh and relevant.';
    }

    return issues.join(' ');
  }
}

module.exports = SEOPremiumPdfGenerator;
