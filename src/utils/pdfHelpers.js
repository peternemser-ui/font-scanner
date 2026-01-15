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

  // Create PDF document
  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
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
 * Terminal-style header with green accent line
 *
 * @param {Object} doc - PDFDocument instance
 * @param {string} title - Report title (e.g., "[SEO_ANALYSIS_REPORT]")
 * @param {string} url - Website URL
 * @param {string} subtitle - Optional subtitle
 * @param {Object} options - Styling options
 *
 * @example
 * addPdfHeader(doc, '[SEO_ANALYSIS_REPORT]', 'https://example.com',
 *   'comprehensive search engine optimization analysis');
 */
function addPdfHeader(doc, title, url, subtitle = null, options = {}) {
  const {
    titleColor = '#1a1a1a',
    subtitleColor = '#666666',
    accentColor = '#00ff41',
    startY = 50
  } = options;

  doc
    .fontSize(28)
    .font('Helvetica-Bold')
    .fillColor(titleColor)
    .text(title, 50, startY);

  if (subtitle) {
    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor(subtitleColor)
      .text(`> ${subtitle}`, 50, startY + 35);
  }

  doc
    .fontSize(12)
    .fillColor(subtitleColor)
    .text(`> url: ${url}`, 50, startY + (subtitle ? 60 : 35));

  doc
    .fontSize(12)
    .fillColor(subtitleColor)
    .text(`> generated: ${new Date().toLocaleString()}`, 50, startY + (subtitle ? 80 : 55));

  // Accent line
  doc
    .strokeColor(accentColor)
    .lineWidth(2)
    .moveTo(50, startY + (subtitle ? 110 : 85))
    .lineTo(545, startY + (subtitle ? 110 : 85))
    .stroke();

  doc.moveDown(3);
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
    width = 495,
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
 * Terminal theme colors: green (good), purple (ok), orange (warning), red (bad)
 *
 * @param {number} score - Score value (0-100)
 * @returns {string} Hex color code
 *
 * @example
 * const color = getScoreColor(85); // '#00ff41' (green)
 */
function getScoreColor(score) {
  if (score >= 90) return '#00ff41'; // Terminal green
  if (score >= 70) return '#bb86fc'; // Purple
  if (score >= 50) return '#ffa500'; // Orange
  return '#ff4444'; // Red
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
  getGrade
};
