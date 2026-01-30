/**
 * PDF Generation Helper Utilities
 *
 * Consolidates PDF generation boilerplate used across 4 PDF generators:
 * - Document initialization and finalization
 * - Header/footer generation
 * - Section headers and styling
 * - Score badges and metrics
 * - Common formatting utilities
 *
 * Eliminates ~225 lines of duplicated code across PDF generators
 *
 * @module utils/pdfHelpers
 */

const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
const fs = require('fs');
const path = require('path');
const { resolveReportId } = require('./resolveReportId');
const { createLogger } = require('./logger');
const { COLORS, drawGaugeChart } = require('./pdfCharts');

const logger = createLogger('PdfHelpers');

/**
 * Initialize PDF generation
 *
 * Consolidates the pattern:
 *   - Resolve report ID
 *   - Create filename
 *   - Ensure reports directory exists
 *   - Create PDFDocument
 *   - Create write stream
 *
 * @param {Object} results - Analysis results
 * @param {string} analyzerType - Analyzer type (seo, performance, security, accessibility)
 * @param {Object} options - PDF options
 * @returns {Object} { doc, filepath, reportId, stream, filename }
 *
 * @example
 * const { doc, filepath, reportId, stream, filename } =
 *   initializePdfGeneration(results, 'seo');
 */
function initializePdfGeneration(results, analyzerType, options = {}) {
  const reportId = resolveReportId({
    reportId: results?.reportId,
    analyzerKey: results?.analyzerKey || analyzerType,
    url: results?.normalizedUrl || results?.url,
    startedAtISO: results?.scanStartedAt || results?.startedAt || results?.timestamp
  });

  if (!reportId) {
    throw new Error(
      `Missing report identity for ${analyzerType} PDF generation ` +
      '(reportId or url+scanStartedAt+analyzerKey)'
    );
  }

  const filename = `${analyzerType}-analysis-${reportId}.pdf`;
  const reportsDir = options.reportsDir || path.join(__dirname, '../../reports');

  // Ensure reports directory exists
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filepath = path.join(reportsDir, filename);

  logger.info(`Initializing ${analyzerType} PDF report: ${filename}`);

  // Create PDF document (US Letter 8.5" x 11" with white background)
  const doc = new PDFDocument({
    margin: 50,
    size: 'LETTER', // 612 x 792 points
    bufferPages: true,
    ...options.pdfOptions
  });

  // Create write stream
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  return { doc, filepath, reportId, stream, filename };
}

/**
 * Finalize PDF generation
 *
 * Consolidates the pattern:
 *   - Add page numbers to all pages
 *   - End document
 *   - Wait for stream finish
 *   - Return result with filename, filepath, reportId
 *
 * @param {Object} doc - PDFDocument instance
 * @param {Object} stream - Write stream
 * @param {string} filename - PDF filename
 * @param {string} filepath - PDF file path
 * @param {string} reportId - Report ID
 * @param {Object} options - Additional options
 * @param {string} options.reportTitle - Report title for footer
 * @returns {Promise<Object>} { filename, filepath, reportId }
 *
 * @example
 * return finalizePdfGeneration(doc, stream, filename, filepath, reportId, { reportTitle: 'SEO Analysis Report' });
 */
function finalizePdfGeneration(doc, stream, filename, filepath, reportId, options = {}) {
  return new Promise((resolve, reject) => {
    const { reportTitle = 'Analysis Report' } = options;

    // Add page numbers to all pages (requires bufferPages: true)
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);

      // Footer with report title, branding, and page numbers
      const footerY = 760; // Near bottom of US Letter page (792pt)

      // Left: Report title
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#666666')
         .text(reportTitle, 50, footerY, { width: 200, lineBreak: false });

      // Center: Branding
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#dd3838')
         .text('sitemechanic.io', 250, footerY, { width: 112, align: 'center', lineBreak: false });

      // Right: Page numbers
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#333333')
         .text(`${i + 1} / ${pageCount}`, 462, footerY, { width: 100, align: 'right', lineBreak: false });
    }

    doc.end();

    stream.on('finish', () => {
      logger.info(`PDF report generated: ${filename}`);
      resolve({ filename, filepath, reportId });
    });

    stream.on('error', (error) => {
      logger.error('Error generating PDF:', error);
      reject(error);
    });
  });
}

/**
 * Add Table of Contents page
 *
 * Creates a professional TOC with section names and page numbers
 * Call this after all content is added but before finalizePdfGeneration
 *
 * @param {Object} doc - PDFDocument instance
 * @param {Array} sections - Array of { title, page } objects
 * @param {Object} options - Styling options
 *
 * @example
 * addTableOfContents(doc, [
 *   { title: 'Executive Summary', page: 2 },
 *   { title: 'Meta Tags Analysis', page: 3 },
 * ]);
 */
function addTableOfContents(doc, sections, options = {}) {
  const { startPage = 1 } = options;

  // Switch to first page to insert TOC after cover
  doc.switchToPage(startPage);

  // Insert a new page for TOC (we'll add content at a specific position)
  // Note: PDFKit doesn't support inserting pages, so we need to plan TOC page in advance

  doc.fontSize(18)
     .font('Helvetica-Bold')
     .fillColor(COLORS.textPrimary)
     .text('TABLE OF CONTENTS', 50, 50);

  // Red accent bar
  doc.rect(50, 78, 50, 3)
     .fillColor('#dd3838')
     .fill();

  let currentY = 100;

  sections.forEach((section, index) => {
    const num = String(index + 1).padStart(2, '0');

    // Section number and title
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#dd3838')
       .text(`${num}.`, 50, currentY, { continued: true, width: 25 })
       .fillColor(COLORS.textPrimary)
       .text(` ${section.title}`, { continued: true, width: 380 });

    // Dotted line (simulated with periods)
    const titleWidth = doc.widthOfString(`${num}. ${section.title}`);
    const dotsWidth = 450 - titleWidth - 30;
    const dots = '.'.repeat(Math.max(3, Math.floor(dotsWidth / 4)));

    doc.fillColor('#cccccc')
       .text(` ${dots} `, { continued: true, width: dotsWidth });

    // Page number
    doc.fillColor(COLORS.textPrimary)
       .font('Helvetica-Bold')
       .text(`${section.page}`, { width: 30, align: 'right' });

    currentY += 25;

    // Add score if available
    if (section.score !== undefined) {
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(getScoreColor(section.score))
         .text(`Score: ${section.score}/100`, 75, currentY - 5);
      currentY += 15;
    }
  });

  // Note about page numbers
  doc.fontSize(8)
     .font('Helvetica-Oblique')
     .fillColor('#888888')
     .text('Page numbers are based on the final rendered document.', 50, currentY + 20);
}

/**
 * Track sections for automatic TOC generation
 * Call this when adding major sections to track them
 *
 * @param {Object} doc - PDFDocument instance
 * @param {string} title - Section title
 * @param {number} score - Optional section score
 * @returns {Object} Section info with page number
 */
function trackSection(doc, title, score = null) {
  // Initialize tracking array if not exists
  if (!doc._tocSections) {
    doc._tocSections = [];
  }

  const pageNum = doc.bufferedPageRange().start + doc.bufferedPageRange().count;

  const section = {
    title,
    page: pageNum,
    score
  };

  doc._tocSections.push(section);
  return section;
}

/**
 * Get tracked sections for TOC
 *
 * @param {Object} doc - PDFDocument instance
 * @returns {Array} Array of tracked sections
 */
function getTrackedSections(doc) {
  return doc._tocSections || [];
}

/**
 * Add header with branding
 *
 * Consolidates header pattern used across all PDF generators
 * Material Design header with colored accent bar and optional logo
 *
 * @param {Object} doc - PDFDocument instance
 * @param {string} title - Report title (e.g., "SEO Analysis Report")
 * @param {string} url - Website URL
 * @param {string} subtitle - Optional subtitle
 * @param {Object} options - Styling options
 *
 * @example
 * addPdfHeader(doc, 'SEO Analysis Report', 'https://example.com',
 *   'Comprehensive search engine optimization analysis');
 */
function addPdfHeader(doc, title, url, subtitle = null, options = {}) {
  const {
    titleColor = COLORS.textPrimary,
    subtitleColor = COLORS.textSecondary,
    accentColor = COLORS.primary,
    startY = 40,
    showLogo = true
  } = options;

  let currentY = startY;

  // Site Mechanic Logo (top left)
  if (showLogo) {
    try {
      const logoPath = path.join(__dirname, '../public/assets/logo-pdf.svg');
      if (fs.existsSync(logoPath)) {
        const svgContent = fs.readFileSync(logoPath, 'utf8');
        // Render SVG logo in upper left - width ~150px to fit nicely
        SVGtoPDF(doc, svgContent, 50, currentY, { width: 150, height: 23 });
        currentY += 35; // Move down after logo
      }
    } catch (error) {
      logger.warn('Could not load logo for PDF header:', error.message);
    }
  }

  // Main title
  doc
    .fontSize(24)
    .font('Helvetica-Bold')
    .fillColor(titleColor)
    .text(title, 50, currentY);

  currentY += 30;

  // Subtitle
  if (subtitle) {
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor(subtitleColor)
      .text(subtitle, 50, currentY);
    currentY += 20;
  }

  // URL
  doc
    .fontSize(10)
    .fillColor(subtitleColor)
    .text(`Website: ${url}`, 50, currentY);

  // Generated date
  doc
    .fontSize(10)
    .fillColor(subtitleColor)
    .text(`Generated: ${new Date().toLocaleString()}`, 50, currentY + 15);

  currentY += 35;

  // Material Design accent bar (thicker, colored)
  // Full width for US Letter (612 - 100 = 512)
  doc
    .rect(50, currentY, 512, 4)
    .fillColor(accentColor)
    .fill();

  doc.moveDown(4);
}

/**
 * Add section header
 *
 * Consolidates section header pattern
 * Terminal-style section headers with bottom border
 *
 * @param {Object} doc - PDFDocument instance
 * @param {string} title - Section title (e.g., "[EXECUTIVE_SUMMARY]")
 * @param {Object} options - Styling options
 *
 * @example
 * addSectionHeader(doc, '[META_TAGS_ANALYSIS]');
 */
function addSectionHeader(doc, title, options = {}) {
  const {
    fontSize = 16,
    color = '#1a1a1a',
    lineColor = '#cccccc',
    checkPageBreak = true,
    requiredSpace = 100
  } = options;

  if (checkPageBreak) {
    checkPageBreakNeeded(doc, requiredSpace);
  }

  doc
    .fontSize(fontSize)
    .font('Helvetica-Bold')
    .fillColor(color)
    .text(title, 50, doc.y);

  doc
    .strokeColor(lineColor)
    .lineWidth(1)
    .moveTo(50, doc.y + 5)
    .lineTo(545, doc.y + 5)
    .stroke();

  doc.moveDown(1.5);
}

/**
 * Add subsection header
 *
 * Smaller header for subsections within a section
 *
 * @param {Object} doc - PDFDocument instance
 * @param {string} title - Subsection title
 * @param {Object} options - Styling options
 *
 * @example
 * addSubSectionHeader(doc, 'Title Tag');
 */
function addSubSectionHeader(doc, title, options = {}) {
  const { fontSize = 12, color = '#333333', bold = true } = options;

  doc
    .fontSize(fontSize)
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fillColor(color)
    .text(title, 60, doc.y);

  doc.moveDown(0.5);
}

/**
 * Add key-value pair
 *
 * Consolidates key-value display pattern
 *
 * @param {Object} doc - PDFDocument instance
 * @param {string} key - Key label
 * @param {string|number} value - Value
 * @param {Object} options - Styling options
 *
 * @example
 * addKeyValue(doc, 'Load Time', '2.5s');
 * addKeyValue(doc, 'Score', 85, { valueColor: '#00ff41' });
 */
function addKeyValue(doc, key, value, options = {}) {
  const {
    keyColor = '#666666',
    valueColor = '#333333',
    fontSize = 10,
    indent = 70,
    width = 475
  } = options;

  const displayValue = value !== null && value !== undefined ? String(value) : 'N/A';

  doc
    .fontSize(fontSize)
    .fillColor(keyColor)
    .text(`${key}:`, indent, doc.y, { continued: true })
    .fillColor(valueColor)
    .text(` ${displayValue}`, { width });
}

/**
 * Add score badge
 *
 * Consolidates score badge/box pattern with colored score display
 *
 * @param {Object} doc - PDFDocument instance
 * @param {number} score - Score value (0-100)
 * @param {string} label - Label for score
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {Object} options - Styling options
 *
 * @example
 * addScoreBadge(doc, 85, 'Overall Score', 50, doc.y);
 */
function addScoreBadge(doc, score, label, x, y, options = {}) {
  const {
    width = 512,
    height = 100,
    backgroundColor = '#f5f5f5',
    borderColor = '#cccccc'
  } = options;

  // Background box
  doc
    .rect(x, y, width, height)
    .fillColor(backgroundColor)
    .fill()
    .strokeColor(borderColor)
    .stroke();

  // Label
  doc
    .fillColor('#000000')
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(label, x + 20, y + 20);

  // Score with color
  const scoreColor = getScoreColor(score);
  doc
    .fillColor(scoreColor)
    .fontSize(48)
    .text(`${Math.round(score)}`, x + 20, y + 45);

  doc
    .fillColor('#666666')
    .fontSize(12)
    .text('/100', x + 80, y + 60);

  doc.y = y + height + 10;
}

/**
 * Add bullet list
 *
 * Consolidates bullet list pattern
 *
 * @param {Object} doc - PDFDocument instance
 * @param {Array<string>} items - List items
 * @param {Object} options - Styling options
 *
 * @example
 * addBulletList(doc, ['Item 1', 'Item 2', 'Item 3']);
 */
function addBulletList(doc, items, options = {}) {
  const {
    indent = 70,
    fontSize = 10,
    color = '#333333',
    bullet = '•',
    maxItems = null,
    ellipsis = true
  } = options;

  if (!Array.isArray(items) || items.length === 0) {
    doc
      .fontSize(fontSize)
      .fillColor('#999999')
      .text('No items', indent, doc.y);
    doc.moveDown();
    return;
  }

  const displayItems = maxItems ? items.slice(0, maxItems) : items;

  displayItems.forEach(item => {
    doc
      .fontSize(fontSize)
      .fillColor(color)
      .text(`${bullet} ${item}`, indent, doc.y, { width: 475 });
  });

  if (maxItems && items.length > maxItems && ellipsis) {
    doc
      .fontSize(fontSize - 1)
      .fillColor('#999999')
      .text(`... and ${items.length - maxItems} more`, indent, doc.y);
  }

  doc.moveDown();
}

/**
 * Check if page break is needed - Enhanced version
 *
 * Consolidates page break check pattern with intelligent handling
 * for charts, tables, and sections that shouldn't be split
 *
 * @param {Object} doc - PDFDocument instance
 * @param {number} requiredSpace - Required space in points (default: 150)
 * @param {Object} options - Additional options
 * @param {boolean} options.forceBreak - Force a page break regardless of space
 * @param {string} options.sectionType - Type of section ('chart', 'table', 'recommendation', 'card')
 * @returns {boolean} - True if page was added
 *
 * @example
 * checkPageBreakNeeded(doc, 200);
 * checkPageBreakNeeded(doc, 300, { sectionType: 'chart' });
 */
function checkPageBreakNeeded(doc, requiredSpace = 150, options = {}) {
  const { forceBreak = false, sectionType = null } = options;

  // Page dimensions for US Letter (612 x 792 points)
  const pageHeight = 792;
  const bottomMargin = 50; // Footer space
  const safeZone = pageHeight - bottomMargin;

  // Add extra padding for specific section types
  let adjustedRequired = requiredSpace;
  if (sectionType === 'chart') {
    adjustedRequired = Math.max(requiredSpace, 300); // Charts need more space
  } else if (sectionType === 'gauge-pair') {
    adjustedRequired = Math.max(requiredSpace, 400); // Dual gauges + comparison
  } else if (sectionType === 'table') {
    adjustedRequired = Math.max(requiredSpace, 200); // Tables need consistent space
  } else if (sectionType === 'recommendation') {
    adjustedRequired = Math.max(requiredSpace, 120); // Recommendations with actions
  } else if (sectionType === 'card') {
    adjustedRequired = Math.max(requiredSpace, 150); // Cards should fit completely
  }

  const needsBreak = forceBreak || (doc.y > safeZone - adjustedRequired);

  if (needsBreak) {
    doc.addPage();
    return true;
  }
  return false;
}

/**
 * Ensure content block stays together on same page
 * If block doesn't fit, starts on new page
 *
 * @param {Object} doc - PDFDocument instance
 * @param {number} blockHeight - Height of the content block
 * @param {Function} renderFn - Function to render the block
 */
function keepTogether(doc, blockHeight, renderFn) {
  if (checkPageBreakNeeded(doc, blockHeight)) {
    // Already on new page
  }
  renderFn();
}

/**
 * Calculate remaining space on current page
 * 
 * @param {Object} doc - PDFDocument instance
 * @returns {number} Available space in points before page break needed
 */
function getRemainingSpace(doc) {
  const pageHeight = 792;
  const bottomMargin = 50;
  const safeZone = pageHeight - bottomMargin;
  return Math.max(0, safeZone - doc.y);
}

/**
 * Ensure a section starts on a fresh page for clean layout
 * Use this for major sections that should never be squeezed at page bottom
 * 
 * @param {Object} doc - PDFDocument instance
 * @param {number} minSpace - Minimum space needed for section header + first content (default: 300)
 */
function ensureFreshPage(doc, minSpace = 300) {
  const remaining = getRemainingSpace(doc);
  if (remaining < minSpace) {
    doc.addPage();
  }
}

/**
 * Height calculator for common PDF components
 * Use these to pre-calculate space needed before rendering
 */
const heightCalculators = {
  /**
   * Calculate bar chart height
   * @param {number} itemCount - Number of bars
   * @param {number} barHeight - Height per bar (default 25)
   * @param {number} spacing - Space between bars (default 8)
   */
  barChart: (itemCount, barHeight = 25, spacing = 8) => {
    return itemCount * (barHeight + spacing) + 40; // +40 for labels/margins
  },

  /**
   * Calculate pie/donut chart height
   * @param {number} radius - Chart radius (default 70)
   * @param {number} legendItems - Number of legend items
   */
  pieChart: (radius = 70, legendItems = 4) => {
    return Math.max(radius * 2, legendItems * 18) + 40; // radius*2 or legend height
  },

  /**
   * Calculate gauge chart height
   * @param {number} radius - Gauge radius (default 60)
   */
  gaugeChart: (radius = 60) => {
    return radius + 80; // radius + labels + margin
  },

  /**
   * Calculate dual gauge section height (2 gauges side by side)
   */
  dualGauges: (radius = 60) => {
    return radius + 100;
  },

  /**
   * Calculate table height
   * @param {number} rowCount - Number of data rows
   * @param {number} rowHeight - Height per row (default 25)
   */
  table: (rowCount, rowHeight = 25) => {
    return 30 + (rowCount * rowHeight) + 20; // header + rows + margin
  },

  /**
   * Calculate recommendation card height based on content
   * @param {string} description - Description text
   * @param {string} solution - Solution text
   * @param {boolean} hasFix - Whether there's a fix section
   */
  recommendationCard: (description = '', solution = '', hasFix = false) => {
    const descLines = Math.ceil(description.length / 70);
    const solLines = solution ? Math.ceil(solution.length / 70) : 0;
    return 50 + (descLines * 12) + (solLines * 12) + (hasFix ? 50 : 0);
  },

  /**
   * Calculate progress bar height
   */
  progressBar: () => 35,

  /**
   * Calculate metric grid height
   * @param {number} itemCount - Number of metrics
   * @param {number} columns - Number of columns
   */
  metricGrid: (itemCount, columns = 4) => {
    const rows = Math.ceil(itemCount / columns);
    return rows * 80 + 20;
  },

  /**
   * Calculate section header height
   */
  sectionHeader: () => 60
};

/**
 * Get score color based on value
 *
 * Consolidates score-to-color mapping
 * Material Design colors: green (excellent), light green (good), orange (fair), red (poor)
 *
 * @param {number} score - Score value (0-100)
 * @returns {string} Hex color code
 *
 * @example
 * const color = getScoreColor(85); // '#7CB342' (good)
 */
function getScoreColor(score) {
  if (score >= 90) return COLORS.excellent; // #43A047 - Green
  if (score >= 80) return COLORS.good;      // #7CB342 - Light green
  if (score >= 70) return COLORS.fair;      // #FB8C00 - Orange
  if (score >= 50) return COLORS.poor;      // #FF6F00 - Dark orange
  return COLORS.critical;                   // #E53935 - Red
}

/**
 * Get grade letter from score
 *
 * Consolidates score-to-grade mapping
 *
 * @param {number} score - Score value (0-100)
 * @returns {string} Grade letter (A-F)
 *
 * @example
 * const grade = getGrade(85); // 'B'
 */
function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Add recommendations section - Enhanced version
 *
 * Displays prioritized recommendations with full details:
 * - Title and description
 * - Actions/steps to fix
 * - Impact information
 * - Implementation difficulty
 *
 * @param {Object} doc - PDFDocument instance
 * @param {Array<Object>} recommendations - Recommendations array
 * @param {Object} options - Styling options
 *
 * @example
 * addRecommendationsSection(doc, [
 *   { priority: 'high', title: 'Fix issue', description: 'Details...', actions: ['Do A', 'Do B'], impact: 'high' }
 * ]);
 */
function addRecommendationsSection(doc, recommendations, options = {}) {
  const {
    showAllRecommendations = true,
    maxRecommendations = 20,
    includeImpact = true,
    includeDifficulty = true
  } = options;

  addMaterialSectionHeader(doc, 'Recommendations', {
    description: 'Prioritized actionable improvements',
    accentColor: COLORS.warning,
    checkPageBreak: true,
    requiredSpace: 200
  });

  if (!recommendations || recommendations.length === 0) {
    drawCard(doc, 50, doc.y, 512, 60, {
      backgroundColor: '#E8F5E9',
      borderColor: COLORS.success
    });

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(COLORS.success)
       .text('All checks passed!', 70, doc.y + 15);

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(COLORS.textSecondary)
       .text('No critical issues detected. Continue monitoring for best results.', 70, doc.y + 10);

    doc.y += 70;
    return;
  }

  // Group by priority
  const high = recommendations.filter(r => r.priority === 'high' || r.priority === 'critical');
  const medium = recommendations.filter(r => r.priority === 'medium');
  const low = recommendations.filter(r => r.priority === 'low' || r.priority === 'info');

  const limit = showAllRecommendations ? recommendations.length : maxRecommendations;
  let rendered = 0;

  // High Priority
  if (high.length > 0) {
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(COLORS.error)
       .text('High Priority', 50, doc.y);

    doc.moveDown(0.5);

    for (const rec of high) {
      if (rendered >= limit) break;
      renderRecommendationCard(doc, rec, 'high', includeImpact, includeDifficulty);
      rendered++;
    }

    doc.moveDown(1);
  }

  // Medium Priority
  if (medium.length > 0 && rendered < limit) {
    checkPageBreakNeeded(doc, 150);

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(COLORS.warning)
       .text('Medium Priority', 50, doc.y);

    doc.moveDown(0.5);

    for (const rec of medium) {
      if (rendered >= limit) break;
      renderRecommendationCard(doc, rec, 'medium', includeImpact, includeDifficulty);
      rendered++;
    }

    doc.moveDown(1);
  }

  // Low Priority
  if (low.length > 0 && rendered < limit) {
    checkPageBreakNeeded(doc, 120);

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(COLORS.info)
       .text('Low Priority / Suggestions', 50, doc.y);

    doc.moveDown(0.5);

    for (const rec of low) {
      if (rendered >= limit) break;
      renderRecommendationCard(doc, rec, 'low', includeImpact, includeDifficulty);
      rendered++;
    }
  }

  // Show count of remaining
  if (!showAllRecommendations && recommendations.length > limit) {
    doc.moveDown(0.5);
    doc.fontSize(9)
       .fillColor(COLORS.textSecondary)
       .text(`+ ${recommendations.length - limit} additional recommendations available in full report`, 50, doc.y);
  }
}

/**
 * Render a single recommendation card with full details
 * @private
 */
function renderRecommendationCard(doc, rec, priority, includeImpact, includeDifficulty) {
  // Calculate card height based on content
  const title = rec.title || rec.message || rec.text || rec.recommendation || 'Recommendation';
  const description = rec.description || '';
  const actions = rec.actions || rec.steps || [];
  const fix = rec.fix || rec.solution || rec.howToFix || '';

  const descLines = Math.ceil(description.length / 70);
  const fixLines = fix ? Math.ceil(fix.length / 70) : 0;
  const actionsHeight = actions.length * 14;

  const cardHeight = 35 + (descLines * 12) + actionsHeight + (fixLines > 0 ? 20 + (fixLines * 12) : 0) + 15;

  checkPageBreakNeeded(doc, cardHeight + 10, { sectionType: 'recommendation' });

  // Card background based on priority
  const bgColors = {
    high: '#FFEBEE',
    medium: '#FFF3E0',
    low: '#E3F2FD'
  };
  const borderColors = {
    high: COLORS.error,
    medium: COLORS.warning,
    low: COLORS.info
  };

  drawCard(doc, 50, doc.y, 512, cardHeight, {
    backgroundColor: bgColors[priority] || bgColors.low,
    borderColor: borderColors[priority] || borderColors.low
  });

  const cardStartY = doc.y;
  let currentY = cardStartY + 12;

  // Priority badge
  doc.fontSize(8)
     .font('Helvetica-Bold')
     .fillColor(borderColors[priority])
     .text(priority.toUpperCase(), 70, currentY);

  // Title
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor(COLORS.textPrimary)
     .text(title, 120, currentY - 2, { width: 405 });

  currentY += 18;

  // Description
  if (description) {
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(COLORS.textSecondary)
       .text(description, 70, currentY, { width: 465 });
    currentY = doc.y + 8;
  }

  // Actions / How to fix
  if (actions.length > 0) {
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .fillColor(COLORS.success)
       .text('How to Fix:', 70, currentY);
    currentY += 12;

    actions.forEach(action => {
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor(COLORS.success)
         .text(`  → ${action}`, 80, currentY, { width: 455 });
      currentY = doc.y + 2;
    });
  } else if (fix) {
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .fillColor(COLORS.success)
       .text('Solution:', 70, currentY);

    doc.fontSize(8)
       .font('Helvetica')
       .fillColor(COLORS.success)
       .text(fix, 120, currentY, { width: 405 });
    currentY = doc.y + 8;
  }

  // Impact and difficulty badges (if available)
  if ((includeImpact && rec.impact) || (includeDifficulty && rec.difficulty)) {
    currentY += 5;
    let badgeX = 70;

    if (includeImpact && rec.impact) {
      const impactColors = { high: COLORS.error, medium: COLORS.warning, low: COLORS.info };
      doc.fontSize(7)
         .fillColor(impactColors[rec.impact] || COLORS.textSecondary)
         .text(`Impact: ${rec.impact.toUpperCase()}`, badgeX, currentY);
      badgeX += 80;
    }

    if (includeDifficulty && rec.difficulty) {
      const difficultyColors = { easy: COLORS.success, medium: COLORS.warning, hard: COLORS.error };
      doc.fontSize(7)
         .fillColor(difficultyColors[rec.difficulty] || COLORS.textSecondary)
         .text(`Effort: ${rec.difficulty.toUpperCase()}`, badgeX, currentY);
    }
  }

  doc.y = cardStartY + cardHeight + 10;
}

/**
 * Draw a Material Design card with subtle shadow/border
 *
 * @param {Object} doc - PDFDocument instance
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Card width
 * @param {number} height - Card height
 * @param {Object} options - { backgroundColor, borderColor, borderWidth }
 */
function drawCard(doc, x, y, width, height, options = {}) {
  const {
    backgroundColor = COLORS.surface,
    borderColor = COLORS.divider,
    borderWidth = 1
  } = options;

  doc.save();

  // Card background
  doc.rect(x, y, width, height)
     .fillColor(backgroundColor)
     .fill();

  // Card border (subtle)
  doc.rect(x, y, width, height)
     .strokeColor(borderColor)
     .lineWidth(borderWidth)
     .stroke();

  doc.restore();
}

/**
 * Draw a score summary card with gauge chart
 * Replaces the old basic score box
 *
 * @param {Object} doc - PDFDocument instance
 * @param {number} score - Overall score
 * @param {string} title - Card title
 * @param {Object} breakdown - Component scores { meta: 85, headings: 90, ... }
 * @param {number} x - X position
 * @param {number} y - Y position
 * @returns {number} - Height consumed
 */
function drawScoreSummaryCard(doc, score, title, breakdown, x, y) {
  const cardHeight = 200;
  const cardWidth = 512;

  // Draw card background
  drawCard(doc, x, y, cardWidth, cardHeight);

  // Title
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor(COLORS.textPrimary)
     .text(title, x + 20, y + 20);

  // Gauge chart (centered)
  const gaugeX = x + 120;
  const gaugeY = y + 120;
  drawGaugeChart(doc, score, 'Overall Score', gaugeX, gaugeY, {
    radius: 60,
    width: 12,
    showValue: true,
    showLabel: true
  });

  // Component breakdown (right side)
  if (breakdown && Object.keys(breakdown).length > 0) {
    const breakdownX = x + 260;
    let breakdownY = y + 50;

    Object.entries(breakdown).forEach(([key, value]) => {
      const color = getScoreColor(value);
      const label = key.charAt(0).toUpperCase() + key.slice(1);

      // Component name
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(label, breakdownX, breakdownY);

      // Component score
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(color)
         .text(`${Math.round(value)}/100`, breakdownX + 150, breakdownY - 1);

      breakdownY += 20;
    });
  }

  return cardHeight + 20;
}

/**
 * Draw a grid of key metrics (3-4 columns)
 *
 * @param {Object} doc - PDFDocument instance
 * @param {Array} metrics - [{ label, value, color }]
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {Object} options - { columns, spacing }
 * @returns {number} - Height consumed
 */
function drawMetricGrid(doc, metrics, x, y, options = {}) {
  const {
    columns = 3,
    spacing = 15
  } = options;

  if (!metrics || metrics.length === 0) {
    return 0;
  }

  const cardWidth = (512 - (columns - 1) * spacing) / columns;
  const cardHeight = 70;

  let currentX = x;
  let currentY = y;
  let column = 0;

  metrics.forEach((metric) => {
    // Draw card
    drawCard(doc, currentX, currentY, cardWidth, cardHeight);

    // Label
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(COLORS.textSecondary)
       .text(metric.label || '', currentX + 10, currentY + 10, {
         width: cardWidth - 20,
         ellipsis: true
       });

    // Value
    const color = metric.color || COLORS.primary;
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor(color)
       .text(metric.value || '', currentX + 10, currentY + 30, {
         width: cardWidth - 20,
         ellipsis: true
       });

    // Move to next position
    column++;
    if (column >= columns) {
      column = 0;
      currentX = x;
      currentY += cardHeight + spacing;
    } else {
      currentX += cardWidth + spacing;
    }
  });

  // Calculate total height
  const rows = Math.ceil(metrics.length / columns);
  return rows * (cardHeight + spacing);
}

/**
 * Material Design section header with colored accent bar
 * Replaces the old bracketed headers
 *
 * @param {Object} doc - PDFDocument instance
 * @param {string} title - Section title
 * @param {Object} options - { accentColor, description, checkPageBreak, requiredSpace }
 */
function addMaterialSectionHeader(doc, title, options = {}) {
  const {
    accentColor = COLORS.primary,
    description = null,
    checkPageBreak = true,
    requiredSpace = 150 // Increased default to prevent section cut-offs
  } = options;

  if (checkPageBreak) {
    checkPageBreakNeeded(doc, requiredSpace);
  }

  // Colored accent bar (left side)
  doc.rect(50, doc.y, 4, 20)
     .fillColor(accentColor)
     .fill();

  // Section title
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor(COLORS.textPrimary)
     .text(title, 60, doc.y - 20);

  // Description (optional)
  if (description) {
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(COLORS.textSecondary)
       .text(description, 60, doc.y + 5);
    doc.moveDown(1);
  } else {
    doc.moveDown(1.5);
  }
}

module.exports = {
  // Document lifecycle
  initializePdfGeneration,
  finalizePdfGeneration,

  // Structure
  addPdfHeader,
  addSectionHeader,
  addSubSectionHeader,

  // Table of Contents
  addTableOfContents,
  trackSection,
  getTrackedSections,

  // Content
  addKeyValue,
  addScoreBadge,
  addBulletList,
  addRecommendationsSection,

  // Utilities
  checkPageBreakNeeded,
  keepTogether,
  getRemainingSpace,
  ensureFreshPage,
  heightCalculators,
  getScoreColor,
  getGrade,

  // Material Design helpers
  drawCard,
  drawScoreSummaryCard,
  drawMetricGrid,
  addMaterialSectionHeader,

  // Material Design colors
  COLORS
};
