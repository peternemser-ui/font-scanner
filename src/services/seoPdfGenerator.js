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

const logger = createLogger('SEOPdfGenerator');

/**
 * SEO PDF Report Generator (Material Design)
 * Creates professional PDF reports with data visualizations
 */
class SEOPdfGenerator {
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
   * Generate comprehensive SEO PDF report
   */
  async generateReport(seoResults) {
    const { doc, filepath, reportId, stream, filename } = initializePdfGeneration(
      seoResults,
      'seo',
      { reportsDir: this.reportsDir }
    );

    try {
      // Material Design header
      addPdfHeader(
        doc,
        'SEO Analysis Report',
        seoResults.url,
        'Comprehensive search engine optimization analysis'
      );

      // Generate report sections with Material Design
      this.addExecutiveSummary(doc, seoResults);
      this.addMetaTagsAnalysis(doc, seoResults.metaTags);
      this.addHeadingsStructure(doc, seoResults.headings);
      this.addImageAnalysis(doc, seoResults.images);
      this.addContentAnalysis(doc, seoResults.content);
      this.addTechnicalSEO(doc, seoResults.technical);
      this.addRecommendations(doc, seoResults.recommendations);

      return finalizePdfGeneration(doc, stream, filename, filepath, reportId);
    } catch (error) {
      logger.error('Error creating SEO PDF:', error);
      throw error;
    }
  }

  /**
   * Add executive summary with gauge chart and component breakdown
   */
  addExecutiveSummary(doc, results) {
    addMaterialSectionHeader(doc, 'Executive Summary', {
      description: 'Overall SEO performance and key metrics'
    });

    const score = results.overallScore || 0;

    // Component scores for breakdown
    const breakdown = {
      metaTags: results.metaTags?.score || 0,
      headings: results.headings?.score || 0,
      images: results.images?.score || 0,
      content: results.content?.score || 0,
      technical: results.technical?.score || 0
    };

    // Score summary card with gauge chart
    const currentY = doc.y;
    drawScoreSummaryCard(doc, score, 'SEO Performance', breakdown, 50, currentY);

    doc.moveDown(2);

    // Bar chart comparing all 5 components
    checkPageBreakNeeded(doc, 200);

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('Component Breakdown', 50, doc.y);

    doc.moveDown(0.5);

    const chartData = [
      { label: 'Meta Tags', value: breakdown.metaTags },
      { label: 'Headings', value: breakdown.headings },
      { label: 'Images', value: breakdown.images },
      { label: 'Content', value: breakdown.content },
      { label: 'Technical', value: breakdown.technical }
    ];

    const chartHeight = drawBarChart(doc, chartData, 50, doc.y, {
      width: 512,
      barHeight: 25,
      showValues: true,
      colorScheme: 'score'
    });

    doc.y += chartHeight;
    doc.moveDown(2);
  }

  /**
   * Add meta tags analysis with progress bar
   */
  addMetaTagsAnalysis(doc, metaTags) {
    checkPageBreakNeeded(doc, 200);
    addMaterialSectionHeader(doc, 'Meta Tags Analysis', {
      description: 'Title, description, and social media tags'
    });

    if (!metaTags || !metaTags.tags) {
      doc.fontSize(10)
         .fillColor(COLORS.textDisabled)
         .text('No meta tags data available', 60, doc.y);
      return;
    }

    // Title tag
    if (metaTags.tags.title) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Title Tag', 60, doc.y);

      doc.moveDown(0.3);

      const titleStatus = metaTags.tags.title.status;
      const titleColor = titleStatus === 'optimal' ? COLORS.success :
                        titleStatus === 'warning' ? COLORS.warning : COLORS.error;

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(`Content: ${metaTags.tags.title.content}`, 70, doc.y, { width: 475 });

      doc.fontSize(9)
         .text(`Length: ${metaTags.tags.title.length} characters`, 70, doc.y + 5);

      doc.fontSize(9)
         .fillColor(titleColor)
         .text(`Status: ${titleStatus}`, 70, doc.y + 5);

      doc.moveDown(1);
    }

    // Description tag
    if (metaTags.tags.description) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Meta Description', 60, doc.y);

      doc.moveDown(0.3);

      const descStatus = metaTags.tags.description.status;
      const descColor = descStatus === 'optimal' ? COLORS.success :
                       descStatus === 'warning' ? COLORS.warning : COLORS.error;

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(`Content: ${metaTags.tags.description.content}`, 70, doc.y, { width: 475 });

      doc.fontSize(9)
         .text(`Length: ${metaTags.tags.description.length} characters`, 70, doc.y + 5);

      doc.fontSize(9)
         .fillColor(descColor)
         .text(`Status: ${descStatus}`, 70, doc.y + 5);

      doc.moveDown(1);
    }

    // Open Graph tags progress bar
    if (metaTags.openGraph) {
      const ogTags = Object.keys(metaTags.openGraph).length;
      const ogTotal = 10; // Expected OG tags
      const ogPercentage = (ogTags / ogTotal) * 100;

      doc.moveDown(0.5);

      const progressHeight = drawProgressBar(
        doc,
        ogPercentage,
        `Open Graph Tags: ${ogTags}/${ogTotal} present`,
        60,
        doc.y,
        { width: 400, showPercentage: true }
      );

      doc.y += progressHeight;
      doc.moveDown(1);
    }

    doc.moveDown(1);
  }

  /**
   * Add headings structure with bar chart
   */
  addHeadingsStructure(doc, headings) {
    checkPageBreakNeeded(doc, 250);
    addMaterialSectionHeader(doc, 'Headings Structure', {
      description: 'H1-H6 hierarchy and distribution'
    });

    if (!headings || !headings.hierarchy) {
      doc.fontSize(10)
         .fillColor(COLORS.textDisabled)
         .text('No headings data available', 60, doc.y);
      return;
    }

    // Bar chart showing heading distribution
    const headingData = [];
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
      const count = headings.hierarchy[tag]?.length || 0;
      if (count > 0) {
        headingData.push({
          label: tag.toUpperCase(),
          value: count
        });
      }
    });

    if (headingData.length > 0) {
      const chartHeight = drawBarChart(doc, headingData, 60, doc.y, {
        width: 450,
        barHeight: 22,
        showValues: true,
        colorScheme: 'primary',
        maxValue: Math.max(...headingData.map(d => d.value))
      });

      doc.y += chartHeight;
      doc.moveDown(1);
    }

    // Sample H1 headings
    if (headings.hierarchy.h1 && headings.hierarchy.h1.length > 0) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('H1 Headings:', 60, doc.y);

      doc.moveDown(0.3);

      headings.hierarchy.h1.slice(0, 3).forEach(heading => {
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLORS.textSecondary)
           .text(`• ${heading.text.substring(0, 80)}${heading.text.length > 80 ? '...' : ''}`,
                 70, doc.y, { width: 475 });
      });

      if (headings.hierarchy.h1.length > 3) {
        doc.fontSize(8)
           .fillColor(COLORS.textDisabled)
           .text(`... and ${headings.hierarchy.h1.length - 3} more`, 70, doc.y);
      }

      doc.moveDown(1);
    }

    doc.moveDown(1);
  }

  /**
   * Add image analysis with pie chart
   */
  addImageAnalysis(doc, images) {
    checkPageBreakNeeded(doc, 300);
    addMaterialSectionHeader(doc, 'Image Analysis', {
      description: 'Alt text coverage and optimization'
    });

    if (!images || !images.summary) {
      doc.fontSize(10)
         .fillColor(COLORS.textDisabled)
         .text('No image data available', 60, doc.y);
      return;
    }

    const summary = images.summary;

    // Pie chart for alt text distribution
    if (summary.totalImages > 0) {
      const pieData = [
        {
          label: 'With Alt Text',
          value: summary.withAltText || 0,
          color: COLORS.success
        },
        {
          label: 'Without Alt Text',
          value: summary.withoutAltText || 0,
          color: COLORS.error
        }
      ];

      const chartHeight = drawPieChart(doc, pieData, 150, doc.y + 80, {
        radius: 60,
        donutWidth: 20,
        showLegend: true,
        showPercentages: true
      });

      doc.y += chartHeight + 20;
    }

    // Optimization status
    if (summary.oversized !== undefined) {
      const optimized = summary.totalImages - summary.oversized;
      const optimizedPercentage = summary.totalImages > 0 ?
        (optimized / summary.totalImages) * 100 : 100;

      const progressHeight = drawProgressBar(
        doc,
        optimizedPercentage,
        `Optimized Images: ${optimized}/${summary.totalImages}`,
        60,
        doc.y,
        { width: 400, showPercentage: true }
      );

      doc.y += progressHeight;
      doc.moveDown(1);
    }

    // Sample images without alt text
    if (images.details) {
      const imagesWithoutAlt = images.details.filter(img => !img.alt).slice(0, 3);
      if (imagesWithoutAlt.length > 0) {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text('Images Missing Alt Text:', 60, doc.y);

        doc.moveDown(0.3);

        imagesWithoutAlt.forEach(img => {
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(`• ${img.src.substring(0, 70)}${img.src.length > 70 ? '...' : ''}`,
                   70, doc.y, { width: 475 });
        });

        doc.moveDown(1);
      }
    }

    doc.moveDown(1);
  }

  /**
   * Add content analysis with bar chart
   */
  addContentAnalysis(doc, content) {
    checkPageBreakNeeded(doc, 300);
    addMaterialSectionHeader(doc, 'Content Analysis', {
      description: 'Word count, readability, and keyword usage'
    });

    if (!content) {
      doc.fontSize(10)
         .fillColor(COLORS.textDisabled)
         .text('No content data available', 60, doc.y);
      return;
    }

    // Metric cards
    const metrics = [
      {
        label: 'Word Count',
        value: content.wordCount?.toString() || '0',
        color: content.wordCount >= 300 ? COLORS.success : COLORS.warning
      },
      {
        label: 'Reading Time',
        value: content.readingTime || 'N/A',
        color: COLORS.info
      },
      {
        label: 'Readability',
        value: content.readabilityScore?.toString() || 'N/A',
        color: COLORS.primary
      }
    ];

    const gridHeight = drawMetricGrid(doc, metrics, 50, doc.y, {
      columns: 3,
      spacing: 15
    });

    doc.y += gridHeight + 20;

    // Top keywords bar chart
    if (content.keywords && content.keywords.length > 0) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Top Keywords', 60, doc.y);

      doc.moveDown(0.5);

      const keywordData = content.keywords.slice(0, 10).map(kw => ({
        label: kw.word,
        value: kw.count
      }));

      const chartHeight = drawBarChart(doc, keywordData, 60, doc.y, {
        width: 450,
        barHeight: 20,
        showValues: true,
        colorScheme: 'primary',
        maxValue: Math.max(...keywordData.map(d => d.value))
      });

      doc.y += chartHeight;
    }

    doc.moveDown(2);
  }

  /**
   * Add technical SEO checklist
   */
  addTechnicalSEO(doc, technical) {
    checkPageBreakNeeded(doc, 200);
    addMaterialSectionHeader(doc, 'Technical SEO', {
      description: 'Technical implementation and best practices'
    });

    if (!technical) {
      doc.fontSize(10)
         .fillColor(COLORS.textDisabled)
         .text('No technical SEO data available', 60, doc.y);
      return;
    }

    const items = [
      {
        label: 'Canonical URL',
        value: technical.canonical || 'Not set',
        status: technical.canonical ? 'pass' : 'warning'
      },
      {
        label: 'Robots Meta',
        value: technical.robots || 'Not set',
        status: technical.robots ? 'pass' : 'warning'
      },
      {
        label: 'Viewport Meta',
        value: technical.viewport ? 'Present' : 'Missing',
        status: technical.viewport ? 'pass' : 'fail'
      },
      {
        label: 'Language',
        value: technical.language || 'Not set',
        status: technical.language ? 'pass' : 'warning'
      },
      {
        label: 'Charset',
        value: technical.charset || 'Not set',
        status: technical.charset ? 'pass' : 'warning'
      }
    ];

    items.forEach(item => {
      let statusColor, statusIcon;

      if (item.status === 'pass') {
        statusColor = COLORS.success;
        statusIcon = '✓';
      } else if (item.status === 'warning') {
        statusColor = COLORS.warning;
        statusIcon = '⚠';
      } else {
        statusColor = COLORS.error;
        statusIcon = '✗';
      }

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(COLORS.textPrimary)
         .text(`${statusIcon} ${item.label}:`, 60, doc.y, { continued: true })
         .fillColor(statusColor)
         .text(` ${item.value}`, { width: 400 });

      doc.moveDown(0.5);
    });

    doc.moveDown(1);
  }

  /**
   * Add recommendations with priority grouping
   */
  addRecommendations(doc, recommendations) {
    checkPageBreakNeeded(doc, 150);
    addMaterialSectionHeader(doc, 'Recommendations', {
      description: 'Actionable improvements for better SEO'
    });

    if (!recommendations || recommendations.length === 0) {
      doc.fontSize(10)
         .fillColor(COLORS.success)
         .text('✓ Excellent! No critical issues detected.', 60, doc.y);
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
         .text('High Priority', 60, doc.y);

      doc.moveDown(0.5);

      high.forEach(rec => {
        checkPageBreakNeeded(doc);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.error)
           .text(`• ${rec.title || rec.message}`, 70, doc.y);

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLORS.textSecondary)
           .text(rec.description || '', 80, doc.y + 3, { width: 465 });

        if (rec.actions && rec.actions.length > 0) {
          rec.actions.slice(0, 2).forEach(action => {
            doc.fontSize(8)
               .fillColor(COLORS.textSecondary)
               .text(`  - ${action}`, 85, doc.y);
          });
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
         .text('Medium Priority', 60, doc.y);

      doc.moveDown(0.5);

      medium.forEach(rec => {
        checkPageBreakNeeded(doc);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.warning)
           .text(`• ${rec.title || rec.message}`, 70, doc.y);

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLORS.textSecondary)
           .text(rec.description || '', 80, doc.y + 3, { width: 465 });

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
         .text('Low Priority', 60, doc.y);

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
}

module.exports = new SEOPdfGenerator();
