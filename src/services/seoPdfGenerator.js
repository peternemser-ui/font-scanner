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
  trackSection,
  COLORS
} = require('../utils/pdfHelpers');

const {
  drawBarChart,
  drawPieChart,
  drawProgressBar,
  drawGaugeChart
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

    const reportTitle = 'SEO Analysis Report';

    try {
      // Material Design header
      addPdfHeader(
        doc,
        reportTitle,
        seoResults.url,
        'Comprehensive search engine optimization analysis'
      );

      // Add Table of Contents page
      doc.addPage();
      this.addTableOfContents(doc, seoResults);

      // Generate report sections with Material Design
      // Each section is tracked for TOC
      trackSection(doc, 'Executive Summary', seoResults.overallScore);
      this.addExecutiveSummary(doc, seoResults);

      trackSection(doc, 'Meta Tags Analysis', seoResults.metaTags?.score);
      this.addMetaTagsAnalysis(doc, seoResults.metaTags);

      trackSection(doc, 'Headings Structure', seoResults.headings?.score);
      this.addHeadingsStructure(doc, seoResults.headings);

      trackSection(doc, 'Image Analysis', seoResults.images?.summary?.score);
      this.addImageAnalysis(doc, seoResults.images);

      trackSection(doc, 'Content Analysis', seoResults.content?.score);
      this.addContentAnalysis(doc, seoResults.content);

      trackSection(doc, 'Technical SEO', seoResults.technical?.score);
      this.addTechnicalSEO(doc, seoResults.technical);

      trackSection(doc, 'Recommendations');
      this.addRecommendations(doc, seoResults.recommendations);

      return finalizePdfGeneration(doc, stream, filename, filepath, reportId, { reportTitle });
    } catch (error) {
      logger.error('Error creating SEO PDF:', error);
      throw error;
    }
  }

  /**
   * Add Table of Contents
   */
  addTableOfContents(doc, results) {
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('TABLE OF CONTENTS', 50, 50);

    // Red accent bar
    doc.rect(50, 78, 50, 3)
       .fillColor('#dd3838')
       .fill();

    let currentY = 100;

    const sections = [
      { title: 'Executive Summary', score: results.overallScore, page: 3 },
      { title: 'Meta Tags Analysis', score: results.metaTags?.score, page: 3 },
      { title: 'Headings Structure', score: results.headings?.score, page: 4 },
      { title: 'Image Analysis', score: results.images?.summary?.score, page: 5 },
      { title: 'Content Analysis', score: results.content?.score, page: 6 },
      { title: 'Technical SEO', score: results.technical?.score, page: 7 },
      { title: 'Recommendations', page: 8 }
    ];

    sections.forEach((section, index) => {
      const num = String(index + 1).padStart(2, '0');

      // Number in red
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#dd3838')
         .text(`${num}.`, 50, currentY, { continued: false });

      // Title
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor(COLORS.textPrimary)
         .text(section.title, 75, currentY, { continued: false });

      // Dotted line
      const titleWidth = doc.widthOfString(section.title);
      const dotsStartX = 75 + titleWidth + 10;
      const dotsEndX = 480;
      const dotsCount = Math.floor((dotsEndX - dotsStartX) / 5);

      doc.fontSize(11)
         .fillColor('#cccccc')
         .text('.'.repeat(dotsCount), dotsStartX, currentY, { continued: false });

      // Page number
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text(`${section.page}`, 490, currentY, { continued: false });

      // Score badge if available
      if (section.score !== undefined && section.score !== null) {
        const scoreColor = getScoreColor(section.score);
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(scoreColor)
           .text(`[${Math.round(section.score)}/100]`, 515, currentY, { continued: false });
      }

      currentY += 28;
    });

    // Note about page numbers
    doc.fontSize(8)
       .font('Helvetica-Oblique')
       .fillColor('#888888')
       .text('Page numbers are approximate. See footer for exact page reference.', 50, currentY + 30);
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
    // Start on new page if past halfway for clean layout
    if (doc.y > 400) {
      doc.addPage();
    }
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
   * Add image analysis matching the web UI layout
   */
  addImageAnalysis(doc, images) {
    // Start on new page for clean layout
    doc.addPage();
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
    const totalImages = summary.totalImages || 0;
    const withAlt = summary.withAltText || 0;
    const withoutAlt = summary.withoutAltText || totalImages - withAlt;
    const altTextCoverage = totalImages > 0 ? (withAlt / totalImages) * 100 : 0;
    const overallScore = summary.score || Math.round(altTextCoverage);

    // Image Optimization Overview - 3 gauge charts
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('Image Optimization Overview', 50, doc.y);

    doc.moveDown(1);

    // Position gauges - y is the CENTER of the arc (arc draws above this point)
    const gaugeY = doc.y + 60; // Give space for the arc to draw above
    const gaugeRadius = 55;

    // Alt Text Coverage gauge (left)
    drawGaugeChart(doc, altTextCoverage, 'Alt Text Coverage', 130, gaugeY, {
      radius: gaugeRadius,
      width: 12,
      showValue: true,
      showLabel: true
    });

    // Images Found gauge (center) - show count instead of percentage
    drawGaugeChart(doc, 0, 'Images Found', 306, gaugeY, {
      radius: gaugeRadius,
      width: 12,
      showValue: false,
      showLabel: true
    });
    // Draw count in center manually (positioned in the arc)
    const countY = gaugeY - gaugeRadius / 2;
    doc.font('Helvetica-Bold')
       .fontSize(22)
       .fillColor(COLORS.textPrimary)
       .text(totalImages.toString(), 306 - gaugeRadius, countY, { 
         width: gaugeRadius * 2, 
         align: 'center' 
       });

    // Overall Score gauge (right)
    drawGaugeChart(doc, overallScore, 'Overall Score', 482, gaugeY, {
      radius: gaugeRadius,
      width: 12,
      showValue: true,
      showLabel: true
    });

    doc.y = gaugeY + 70; // Move past gauges and labels
    doc.moveDown(1);

    // Image Statistics - Progress bars
    checkPageBreakNeeded(doc, 180);

    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('Image Statistics', 50, doc.y);

    doc.moveDown(0.5);

    // With Alt progress bar
    const withAltPercent = totalImages > 0 ? (withAlt / totalImages) * 100 : 0;
    drawProgressBar(doc, withAltPercent, `With Alt: ${withAlt}`, 50, doc.y, {
      width: 450,
      height: 20,
      showPercentage: false,
      color: COLORS.success
    });
    doc.y += 35;

    // Missing Alt progress bar
    const missingAltPercent = totalImages > 0 ? (withoutAlt / totalImages) * 100 : 0;
    drawProgressBar(doc, missingAltPercent, `Missing Alt: ${withoutAlt}`, 50, doc.y, {
      width: 450,
      height: 20,
      showPercentage: false,
      color: COLORS.error
    });
    doc.y += 35;

    // Total Images progress bar
    drawProgressBar(doc, 100, `Total Images: ${totalImages}`, 50, doc.y, {
      width: 450,
      height: 20,
      showPercentage: false,
      color: COLORS.primary
    });
    doc.y += 35;

    doc.moveDown(1);

    // Image Details table - starts on new page for clean layout
    if (images.details && images.details.length > 0) {
      // Calculate if table needs new page (header + first few rows)
      const tableHeaderHeight = 30;
      const rowHeight = 30;
      const minRowsToShow = 3;
      const neededForTable = tableHeaderHeight + (minRowsToShow * rowHeight) + 40;
      
      // If we can't fit header + at least 3 rows, start new page
      if (doc.y + neededForTable > 700) {
        doc.addPage();
      }

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Image Details', 50, doc.y);

      doc.moveDown(0.5);

      // Table header
      const tableX = 50;
      const colWidths = { url: 150, dimensions: 70, alt: 100, status: 50, rec: 140 };
      let tableY = doc.y;

      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textSecondary);

      doc.text('Image URL', tableX, tableY);
      doc.text('Dimensions', tableX + colWidths.url, tableY);
      doc.text('Alt Text', tableX + colWidths.url + colWidths.dimensions, tableY);
      doc.text('Status', tableX + colWidths.url + colWidths.dimensions + colWidths.alt, tableY);
      doc.text('Recommendation', tableX + colWidths.url + colWidths.dimensions + colWidths.alt + colWidths.status, tableY);

      tableY += 15;

      // Draw separator line
      doc.strokeColor(COLORS.border)
         .lineWidth(0.5)
         .moveTo(tableX, tableY)
         .lineTo(tableX + 510, tableY)
         .stroke();

      tableY += 8;

      // Table rows - check page break before each row
      const displayImages = images.details.slice(0, 15); // Show up to 15 rows

      displayImages.forEach((img, index) => {
        // Check if row will overflow - if so, start new page with header
        if (tableY + rowHeight > 720) {
          doc.addPage();
          tableY = 50;
          
          // Redraw header on new page
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.textSecondary);
          doc.text('Image URL', tableX, tableY);
          doc.text('Dimensions', tableX + colWidths.url, tableY);
          doc.text('Alt Text', tableX + colWidths.url + colWidths.dimensions, tableY);
          doc.text('Status', tableX + colWidths.url + colWidths.dimensions + colWidths.alt, tableY);
          doc.text('Recommendation', tableX + colWidths.url + colWidths.dimensions + colWidths.alt + colWidths.status, tableY);
          tableY += 15;
          doc.strokeColor(COLORS.border)
             .lineWidth(0.5)
             .moveTo(tableX, tableY)
             .lineTo(tableX + 510, tableY)
             .stroke();
          tableY += 8;
        }

        doc.fontSize(7)
           .font('Helvetica')
           .fillColor(COLORS.textPrimary);

        // Image URL (truncated)
        const urlDisplay = img.src ? img.src.substring(0, 25) + (img.src.length > 25 ? '...' : '') : 'Unknown';
        doc.text(urlDisplay, tableX, tableY, { width: colWidths.url - 5 });

        // Dimensions
        const dims = img.dimensions || `${img.width || 0}x${img.height || 0}`;
        doc.text(dims, tableX + colWidths.url, tableY);

        // Alt Text
        const altText = img.alt ? img.alt.substring(0, 15) + (img.alt.length > 15 ? '...' : '') : '✗ Missing';
        doc.fillColor(img.alt ? COLORS.textPrimary : COLORS.error)
           .text(altText, tableX + colWidths.url + colWidths.dimensions, tableY, { width: colWidths.alt - 5 });

        // Status
        doc.fillColor(img.alt ? COLORS.success : COLORS.error)
           .text(img.alt ? 'Pass' : 'Fail', tableX + colWidths.url + colWidths.dimensions + colWidths.alt, tableY);

        // Recommendation
        doc.fillColor(COLORS.textSecondary)
           .text(
             img.alt ? 'Descriptive, helps SEO' : 'Add descriptive alt text for SEO + screen readers',
             tableX + colWidths.url + colWidths.dimensions + colWidths.alt + colWidths.status,
             tableY,
             { width: colWidths.rec - 5 }
           );

        tableY += rowHeight;
      });

      if (images.details.length > 15) {
        doc.fontSize(8)
           .fillColor(COLORS.textSecondary)
           .text(`... and ${images.details.length - 15} more images`, tableX, tableY);
        tableY += 15;
      }

      doc.y = tableY + 10;
    }

    doc.moveDown(1);
  }

  /**
   * Add content analysis with bar chart
   */
  addContentAnalysis(doc, content) {
    // Start on new page for clean layout
    if (doc.y > 350) {
      doc.addPage();
    }
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
    // Start on new page if past halfway
    if (doc.y > 400) {
      doc.addPage();
    }
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
   * Add recommendations with priority grouping - Full content with fixes
   */
  addRecommendations(doc, recommendations) {
    // Start recommendations on new page for clean layout
    doc.addPage();
    addMaterialSectionHeader(doc, 'SEO Recommendations', {
      description: 'Actionable improvements for better SEO'
    });

    if (!recommendations || recommendations.length === 0) {
      doc.fontSize(10)
         .fillColor(COLORS.success)
         .text('✓ Excellent! No critical issues detected.', 60, doc.y);
      return;
    }

    // Group by priority - show all recommendations
    const high = recommendations.filter(r => r.priority === 'high');
    const medium = recommendations.filter(r => r.priority === 'medium');
    const low = recommendations.filter(r => r.priority === 'low');

    // High priority
    if (high.length > 0) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.error)
         .text('🔴 High Priority', 60, doc.y);

      doc.moveDown(0.5);

      high.forEach((rec, index) => {
        // Calculate needed space
        const descLines = Math.ceil((rec.description || '').length / 65);
        const actionsCount = rec.actions ? Math.min(rec.actions.length, 3) : 0;
        const fixLines = rec.fix ? Math.ceil(rec.fix.length / 65) : 0;
        const neededSpace = 40 + (descLines * 12) + (actionsCount * 14) + (fixLines * 12);
        
        checkPageBreakNeeded(doc, neededSpace);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.error)
           .text(`${index + 1}. ${rec.title || rec.message}`, 70, doc.y);

        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 80, doc.y + 3, { width: 465 });
        }

        // Show all actions/fixes
        if (rec.actions && rec.actions.length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.success)
             .text('How to Fix:', 85, doc.y);
          rec.actions.forEach(action => {
            doc.fontSize(8)
               .font('Helvetica')
               .fillColor(COLORS.success)
               .text(`  → ${action}`, 95, doc.y);
          });
        }

        if (rec.fix) {
          doc.moveDown(0.3);
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.success)
             .text('Fix:', 85, doc.y);
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.success)
             .text(rec.fix, 105, doc.y, { width: 440 });
        }

        doc.moveDown(1);
      });

      doc.moveDown(0.5);
    }

    // Medium priority
    if (medium.length > 0) {
      checkPageBreakNeeded(doc, 120);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.warning)
         .text('🟡 Medium Priority', 60, doc.y);

      doc.moveDown(0.5);

      medium.forEach((rec, index) => {
        const descLines = Math.ceil((rec.description || '').length / 65);
        const actionsCount = rec.actions ? Math.min(rec.actions.length, 3) : 0;
        const neededSpace = 35 + (descLines * 12) + (actionsCount * 14);
        
        checkPageBreakNeeded(doc, neededSpace);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.warning)
           .text(`${index + 1}. ${rec.title || rec.message}`, 70, doc.y);

        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 80, doc.y + 3, { width: 465 });
        }

        if (rec.actions && rec.actions.length > 0) {
          doc.moveDown(0.3);
          rec.actions.slice(0, 3).forEach(action => {
            doc.fontSize(8)
               .fillColor(COLORS.info)
               .text(`  → ${action}`, 85, doc.y);
          });
        }

        doc.moveDown(0.8);
      });

      doc.moveDown(0.5);
    }

    // Low priority
    if (low.length > 0) {
      checkPageBreakNeeded(doc, 100);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.info)
         .text('🔵 Low Priority', 60, doc.y);

      doc.moveDown(0.5);

      low.forEach((rec, index) => {
        checkPageBreakNeeded(doc, 40);
        
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLORS.textSecondary)
           .text(`${index + 1}. ${rec.title || rec.message}`, 70, doc.y, { width: 475 });

        if (rec.description) {
          doc.fontSize(8)
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 85, doc.y + 2, { width: 460 });
        }

        doc.moveDown(0.6);
      });
    }
  }
}

module.exports = new SEOPdfGenerator();
