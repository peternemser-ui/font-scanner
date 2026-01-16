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
 *   - End document
 *   - Wait for stream finish
 *   - Return result with filename, filepath, reportId
 *
 * @param {Object} doc - PDFDocument instance
 * @param {Object} stream - Write stream
 * @param {string} filename - PDF filename
 * @param {string} filepath - PDF file path
 * @param {string} reportId - Report ID
 * @returns {Promise<Object>} { filename, filepath, reportId }
 *
 * @example
 * return finalizePdfGeneration(doc, stream, filename, filepath, reportId);
 */
function finalizePdfGeneration(doc, stream, filename, filepath, reportId) {
  return new Promise((resolve, reject) => {
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

  // Logo (top right)
  if (showLogo) {
    try {
      const logoPath = path.join(__dirname, '../public/assets/logo-dark.svg');
      if (fs.existsSync(logoPath)) {
        // SVG logo positioned top right
        doc.image(logoPath, 450, currentY, { width: 95 });
      }
    } catch (error) {
      logger.warn('Could not load logo for PDF header:', error.message);
    }
  }

  // Main title (no brackets, clean Material Design)
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
 * Check if page break is needed
 *
 * Consolidates page break check pattern
 *
 * @param {Object} doc - PDFDocument instance
 * @param {number} requiredSpace - Required space in points (default: 150)
 *
 * @example
 * checkPageBreakNeeded(doc, 200);
 */
function checkPageBreakNeeded(doc, requiredSpace = 150) {
  if (doc.y > 700 - requiredSpace) {
    doc.addPage();
  }
}

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
 * Add recommendations section
 *
 * Consolidates recommendations display pattern
 * Groups recommendations by priority
 *
 * @param {Object} doc - PDFDocument instance
 * @param {Array<Object>} recommendations - Recommendations array
 * @param {Object} options - Styling options
 *
 * @example
 * addRecommendationsSection(doc, [
 *   { priority: 'high', message: 'Fix this', actions: ['Do A', 'Do B'] }
 * ]);
 */
function addRecommendationsSection(doc, recommendations, options = {}) {
  const { maxRecommendations = 10 } = options;

  addSectionHeader(doc, '[RECOMMENDATIONS]');

  if (!recommendations || recommendations.length === 0) {
    doc
      .fontSize(10)
      .fillColor('#00ff41')
      .text('> All checks passed! No critical recommendations at this time.', 60, doc.y);
    return;
  }

  const displayRecs = recommendations.slice(0, maxRecommendations);

  displayRecs.forEach((rec, index) => {
    checkPageBreakNeeded(doc);

    // Priority badge
    const priorityColor = rec.priority === 'high' ? '#ff4444' :
                         rec.priority === 'medium' ? '#ffa500' : '#bb86fc';

    doc
      .fontSize(10)
      .fillColor(priorityColor)
      .font('Helvetica-Bold')
      .text(`[${rec.priority?.toUpperCase() || 'INFO'}]`, 60, doc.y, { continued: true })
      .fillColor('#333333')
      .font('Helvetica')
      .text(` ${rec.message || rec.text || rec.recommendation}`, { width: 465 });

    // Actions
    if (rec.actions && rec.actions.length > 0) {
      rec.actions.forEach(action => {
        doc
          .fontSize(9)
          .fillColor('#666666')
          .text(`  • ${action}`, 80, doc.y);
      });
    }

    doc.moveDown();
  });

  if (recommendations.length > maxRecommendations) {
    doc
      .fontSize(9)
      .fillColor('#999999')
      .text(
        `> ${recommendations.length - maxRecommendations} additional recommendations not shown`,
        60,
        doc.y
      );
  }
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
 * @param {Object} options - { accentColor, description, checkPageBreak }
 */
function addMaterialSectionHeader(doc, title, options = {}) {
  const {
    accentColor = COLORS.primary,
    description = null,
    checkPageBreak = true
  } = options;

  if (checkPageBreak) {
    checkPageBreakNeeded(doc, 60);
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

  // Content
  addKeyValue,
  addScoreBadge,
  addBulletList,
  addRecommendationsSection,

  // Utilities
  checkPageBreakNeeded,
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
