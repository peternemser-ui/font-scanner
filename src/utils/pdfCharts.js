/**
 * PDF Chart Rendering Utilities
 *
 * Provides functions to draw various chart types using PDFKit primitives:
 * - Gauge charts (semi-circle score visualizations)
 * - Bar charts (horizontal comparisons)
 * - Pie/donut charts (distributions)
 * - Comparison charts (grouped bars for desktop vs mobile)
 * - Progress bars (linear indicators)
 * - Threshold charts (zone-based for Core Web Vitals)
 *
 * All charts use Material Design color palette for consistency.
 *
 * @module utils/pdfCharts
 */

// Material Design Color Palette
const COLORS = {
  // Material Blue
  primary: '#1976D2',
  primaryLight: '#63A4FF',
  primaryDark: '#004BA0',

  // Teal (Secondary)
  secondary: '#00897B',
  secondaryLight: '#4EBAAA',
  secondaryDark: '#00675B',

  // Semantic Colors
  success: '#43A047',
  successLight: '#76D275',
  warning: '#FB8C00',
  warningLight: '#FFB547',
  error: '#E53935',
  errorLight: '#FF6F60',
  info: '#1E88E5',

  // Status (for scores)
  excellent: '#43A047',  // 90-100
  good: '#7CB342',       // 80-89
  fair: '#FB8C00',       // 70-79
  poor: '#FF6F00',       // 50-69
  critical: '#E53935',   // 0-49

  // Neutrals
  textPrimary: '#212121',
  textSecondary: '#757575',
  textDisabled: '#BDBDBD',
  divider: '#E0E0E0',
  background: '#FAFAFA',
  surface: '#FFFFFF'
};

/**
 * Get Material Design color based on score
 * @param {number} score - Score (0-100)
 * @returns {string} - Hex color code
 */
function getScoreColor(score) {
  if (score >= 90) return COLORS.excellent;
  if (score >= 80) return COLORS.good;
  if (score >= 70) return COLORS.fair;
  if (score >= 50) return COLORS.poor;
  return COLORS.critical;
}

/**
 * Draw a semi-circle gauge chart for score visualization
 * Perfect for: Overall scores, component scores
 *
 * @param {Object} doc - PDFDocument instance
 * @param {number} score - Score (0-100)
 * @param {string} label - Chart label
 * @param {number} x - X position (center)
 * @param {number} y - Y position (center of the arc, arc draws ABOVE this point)
 * @param {Object} options - { radius, width, showValue, showLabel, showTicks }
 * @returns {number} - Height consumed
 */
function drawGaugeChart(doc, score, label, x, y, options = {}) {
  const {
    radius = 70,
    width = 12,
    showValue = true,
    showLabel = true,
    showTicks = false
  } = options;

  const safeScore = Math.max(0, Math.min(100, score || 0));
  const color = getScoreColor(safeScore);

  // Background arc (light gray) - full semicircle
  doc.save();
  doc.strokeColor(COLORS.divider);
  doc.lineWidth(width);
  doc.arc(x, y, radius, Math.PI, 0, false);
  doc.stroke();
  doc.restore();

  // Foreground arc (colored based on score) - partial based on score
  if (safeScore > 0) {
    doc.save();
    const scoreAngle = Math.PI * (safeScore / 100);
    const endAngle = Math.PI - scoreAngle;
    
    doc.strokeColor(color);
    doc.lineWidth(width);
    doc.arc(x, y, radius, Math.PI, endAngle, false);
    doc.stroke();
    doc.restore();
  }

  // Draw tick marks (optional)
  if (showTicks) {
    doc.save();
    doc.strokeColor(COLORS.textDisabled);
    doc.lineWidth(1);

    for (let tick = 0; tick <= 100; tick += 25) {
      const angle = Math.PI - (Math.PI * tick / 100);
      const innerX = x + (radius - width / 2 - 5) * Math.cos(angle);
      const innerY = y + (radius - width / 2 - 5) * Math.sin(angle);
      const outerX = x + (radius - width / 2 + 3) * Math.cos(angle);
      const outerY = y + (radius - width / 2 + 3) * Math.sin(angle);

      doc.moveTo(innerX, innerY);
      doc.lineTo(outerX, outerY);
      doc.stroke();
    }
    doc.restore();
  }

  // Score value in center of the arc
  if (showValue) {
    const valueY = y - radius / 2; // Position value in the center of the arc area
    
    doc.font('Helvetica-Bold')
       .fontSize(Math.max(18, radius / 2.5))
       .fillColor(color)
       .text(Math.round(safeScore).toString(), x - radius, valueY, {
         width: radius * 2,
         align: 'center'
       });

    doc.font('Helvetica')
       .fontSize(9)
       .fillColor(COLORS.textSecondary)
       .text('/100', x - radius, valueY + Math.max(18, radius / 2.5), {
         width: radius * 2,
         align: 'center'
       });
  }

  // Label below gauge
  if (showLabel && label) {
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor(COLORS.textSecondary)
       .text(label, x - radius - 10, y + 15, {
         width: (radius + 10) * 2,
         align: 'center'
       });
  }

  return radius + 50; // Height consumed (just the bottom half + label)
}

/**
 * Draw horizontal or vertical bar chart
 * Perfect for: Component scores, metric comparisons
 *
 * @param {Object} doc - PDFDocument instance
 * @param {Array} data - [{ label, value, max }]
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {Object} options - { width, barHeight, showValues, colorScheme, maxValue }
 * @returns {number} - Height consumed
 */
function drawBarChart(doc, data, x, y, options = {}) {
  const {
    width = 400,
    barHeight = 22,
    showValues = true,
    colorScheme = 'score', // 'score' | 'uniform' | 'primary'
    maxValue = null
  } = options;

  if (!data || data.length === 0) {
    doc.fontSize(10)
       .fillColor(COLORS.textDisabled)
       .text('No data available', x, y);
    return 20;
  }

  const max = maxValue || Math.max(...data.map(d => d.value || 0), 100);
  const barSpacing = 8;
  const labelWidth = 120;
  const chartWidth = width - labelWidth - 50;

  let currentY = y;

  data.forEach((item) => {
    const value = Math.max(0, item.value || 0);

    // Label
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(COLORS.textPrimary)
       .text(item.label || '', x, currentY + 6, {
         width: labelWidth,
         align: 'left',
         ellipsis: true
       });

    // Background bar (light gray)
    doc.rect(x + labelWidth + 5, currentY, chartWidth, barHeight)
       .fillColor(COLORS.background)
       .fill()
       .strokeColor(COLORS.divider)
       .lineWidth(1)
       .stroke();

    // Foreground bar (colored)
    const barWidth = Math.max(0, (value / max) * chartWidth);
    let color;

    if (colorScheme === 'score') {
      color = getScoreColor(value);
    } else if (colorScheme === 'uniform') {
      color = COLORS.info;
    } else {
      color = COLORS.primary;
    }

    if (barWidth > 0) {
      doc.rect(x + labelWidth + 5, currentY, barWidth, barHeight)
         .fillColor(color)
         .fill();
    }

    // Value label
    if (showValues) {
      const valueText = typeof value === 'number' ? Math.round(value).toString() : value.toString();
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .fillColor(color)
         .text(valueText, x + labelWidth + chartWidth + 10, currentY + 6);
    }

    currentY += barHeight + barSpacing;
  });

  return currentY - y; // Height consumed
}

/**
 * Draw pie or donut chart for distributions
 * Perfect for: Violation breakdown, resource distribution
 *
 * @param {Object} doc - PDFDocument instance
 * @param {Array} data - [{ label, value, color }]
 * @param {number} x - X position (center)
 * @param {number} y - Y position (center)
 * @param {Object} options - { radius, donutWidth, showLegend, showPercentages }
 * @returns {number} - Height consumed
 */
function drawPieChart(doc, data, x, y, options = {}) {
  const {
    radius = 60,
    donutWidth = 20,
    showLegend = true,
    showPercentages = true
  } = options;

  if (!data || data.length === 0) {
    doc.fontSize(10)
       .fillColor(COLORS.textDisabled)
       .text('No data available', x - 50, y);
    return 20;
  }

  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  if (total === 0) {
    doc.fontSize(10)
       .fillColor(COLORS.textDisabled)
       .text('No data available', x - 50, y);
    return 20;
  }

  // Default colors for slices if not provided
  const defaultColors = [
    COLORS.critical,   // Red
    COLORS.warning,    // Orange
    COLORS.fair,       // Light orange
    COLORS.good,       // Light green
    COLORS.primary,    // Blue
    COLORS.secondary   // Teal
  ];

  let currentAngle = -Math.PI / 2; // Start at top (12 o'clock)

  doc.save();

  // Draw slices
  data.forEach((item, index) => {
    const value = item.value || 0;
    const sliceAngle = (value / total) * 2 * Math.PI;
    const color = item.color || defaultColors[index % defaultColors.length];

    // Draw slice
    doc.fillColor(color);
    doc.moveTo(x, y);
    doc.arc(x, y, radius, currentAngle, currentAngle + sliceAngle);
    doc.fill();

    currentAngle += sliceAngle;
  });

  // Draw donut hole (white circle in center)
  const innerRadius = radius - donutWidth;
  doc.circle(x, y, innerRadius)
     .fillColor(COLORS.surface)
     .fill();

  // Draw total count in center
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor(COLORS.textPrimary)
     .text(total.toString(), x - 30, y - 8, {
       width: 60,
       align: 'center'
     });

  doc.restore();

  // Draw legend
  if (showLegend) {
    const legendX = x + radius + 30;
    let legendY = y - (data.length * 18) / 2;

    data.forEach((item, index) => {
      const value = item.value || 0;
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      const color = item.color || defaultColors[index % defaultColors.length];

      // Color box
      doc.rect(legendX, legendY, 10, 10)
         .fillColor(color)
         .fill();

      // Label and value
      const labelText = `${item.label || 'Unknown'}: ${value}`;
      const fullText = showPercentages ? `${labelText} (${percentage}%)` : labelText;

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(COLORS.textPrimary)
         .text(fullText, legendX + 15, legendY, {
           width: 150,
           ellipsis: true
         });

      legendY += 16;
    });
  }

  return Math.max(radius * 2, data.length * 16) + 20; // Height consumed
}

/**
 * Draw side-by-side comparison chart
 * Perfect for: Desktop vs Mobile, Before vs After
 *
 * @param {Object} doc - PDFDocument instance
 * @param {Array} metrics - [{ label, value1, value2 }]
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {Object} options - { width, barHeight, labels, colors }
 * @returns {number} - Height consumed
 */
function drawComparisonChart(doc, metrics, x, y, options = {}) {
  const {
    width = 400,
    barHeight = 18,
    labels = ['Desktop', 'Mobile'],
    colors = [COLORS.primary, COLORS.secondary],
    maxValue = null
  } = options;

  if (!metrics || metrics.length === 0) {
    doc.fontSize(10)
       .fillColor(COLORS.textDisabled)
       .text('No data available', x, y);
    return 20;
  }

  const max = maxValue || Math.max(
    ...metrics.map(m => Math.max(m.value1 || 0, m.value2 || 0)),
    100
  );

  const labelWidth = 100;
  const chartWidth = width - labelWidth - 50;
  const barSpacing = 4;
  const groupSpacing = 12;

  let currentY = y;

  // Draw legend
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor(colors[0])
     .text(labels[0], x + labelWidth + 5, currentY);

  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor(colors[1])
     .text(labels[1], x + labelWidth + 80, currentY);

  currentY += 20;

  // Draw metrics
  metrics.forEach((metric) => {
    // Metric label
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(COLORS.textPrimary)
       .text(metric.label || '', x, currentY + 4, {
         width: labelWidth,
         align: 'left',
         ellipsis: true
       });

    // First bar (Desktop)
    const value1 = Math.max(0, metric.value1 || 0);
    const barWidth1 = (value1 / max) * chartWidth;

    doc.rect(x + labelWidth + 5, currentY, chartWidth, barHeight)
       .fillColor(COLORS.background)
       .fill()
       .strokeColor(COLORS.divider)
       .lineWidth(1)
       .stroke();

    if (barWidth1 > 0) {
      doc.rect(x + labelWidth + 5, currentY, barWidth1, barHeight)
         .fillColor(colors[0])
         .fill();
    }

    // Value label 1
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .fillColor(colors[0])
       .text(Math.round(value1).toString(), x + labelWidth + chartWidth + 10, currentY + 4);

    currentY += barHeight + barSpacing;

    // Second bar (Mobile)
    const value2 = Math.max(0, metric.value2 || 0);
    const barWidth2 = (value2 / max) * chartWidth;

    doc.rect(x + labelWidth + 5, currentY, chartWidth, barHeight)
       .fillColor(COLORS.background)
       .fill()
       .strokeColor(COLORS.divider)
       .lineWidth(1)
       .stroke();

    if (barWidth2 > 0) {
      doc.rect(x + labelWidth + 5, currentY, barWidth2, barHeight)
         .fillColor(colors[1])
         .fill();
    }

    // Value label 2
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .fillColor(colors[1])
       .text(Math.round(value2).toString(), x + labelWidth + chartWidth + 10, currentY + 4);

    currentY += barHeight + groupSpacing;
  });

  return currentY - y; // Height consumed
}

/**
 * Draw linear progress bar
 * Perfect for: Single metric indicators, implementation status
 *
 * @param {Object} doc - PDFDocument instance
 * @param {number} value - Progress value (0-100)
 * @param {string} label - Label text
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {Object} options - { width, height, showPercentage, color }
 * @returns {number} - Height consumed
 */
function drawProgressBar(doc, value, label, x, y, options = {}) {
  const {
    width = 300,
    height = 16,
    showPercentage = true,
    color = null
  } = options;

  const safeValue = Math.max(0, Math.min(100, value || 0));
  const barColor = color || getScoreColor(safeValue);

  // Label
  if (label) {
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(COLORS.textPrimary)
       .text(label, x, y);
    y += 16;
  }

  // Background track (rounded rectangle)
  const cornerRadius = height / 2;

  doc.save();
  doc.roundedRect(x, y, width, height, cornerRadius)
     .fillColor(COLORS.background)
     .fill()
     .strokeColor(COLORS.divider)
     .lineWidth(1)
     .stroke();

  // Foreground fill
  const fillWidth = (safeValue / 100) * width;

  if (fillWidth > 0) {
    doc.roundedRect(x, y, Math.max(height, fillWidth), height, cornerRadius)
       .fillColor(barColor)
       .fill();
  }

  doc.restore();

  // Percentage label
  if (showPercentage) {
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .fillColor(barColor)
       .text(`${Math.round(safeValue)}%`, x + width + 10, y + 3);
  }

  return height + (label ? 20 : 4); // Height consumed
}

/**
 * Draw threshold-based chart with zones (good/needs improvement/poor)
 * Perfect for: Core Web Vitals (LCP, FCP, CLS)
 *
 * @param {Object} doc - PDFDocument instance
 * @param {Object} metric - { label, value, unit, thresholds: { good, poor } }
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {Object} options - { width, height }
 * @returns {number} - Height consumed
 */
function drawThresholdChart(doc, metric, x, y, options = {}) {
  const {
    width = 400,
    height = 40
  } = options;

  if (!metric || !metric.thresholds) {
    doc.fontSize(10)
       .fillColor(COLORS.textDisabled)
       .text('No threshold data available', x, y);
    return 20;
  }

  const { label, value, unit = '', thresholds } = metric;
  const { good, poor } = thresholds;

  // Determine max value for scale (use poor threshold * 1.5 or value * 1.2, whichever is larger)
  const maxScale = Math.max(poor * 1.5, value * 1.2, poor * 1.5);

  // Calculate zone widths
  const goodWidth = (good / maxScale) * width;
  const needsImprovementWidth = ((poor - good) / maxScale) * width;
  const poorWidth = width - goodWidth - needsImprovementWidth;

  // Label
  if (label) {
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text(label, x, y);
    y += 18;
  }

  doc.save();

  // Draw zones
  let currentX = x;

  // Good zone (green)
  doc.rect(currentX, y, goodWidth, height)
     .fillColor(COLORS.successLight)
     .fillOpacity(0.3)
     .fill()
     .strokeColor(COLORS.success)
     .lineWidth(1)
     .stroke();
  currentX += goodWidth;

  // Needs improvement zone (yellow/orange)
  doc.rect(currentX, y, needsImprovementWidth, height)
     .fillColor(COLORS.warningLight)
     .fillOpacity(0.3)
     .fill()
     .strokeColor(COLORS.warning)
     .lineWidth(1)
     .stroke();
  currentX += needsImprovementWidth;

  // Poor zone (red)
  doc.rect(currentX, y, poorWidth, height)
     .fillColor(COLORS.errorLight)
     .fillOpacity(0.3)
     .fill()
     .strokeColor(COLORS.error)
     .lineWidth(1)
     .stroke();

  doc.restore();

  // Draw value indicator (vertical line)
  const valueX = x + Math.min((value / maxScale) * width, width);

  doc.save();
  doc.strokeColor(COLORS.textPrimary)
     .lineWidth(2)
     .moveTo(valueX, y - 5)
     .lineTo(valueX, y + height + 5)
     .stroke();

  // Value label above indicator
  const valueText = `${value.toFixed(value < 10 ? 2 : 1)}${unit}`;
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor(COLORS.textPrimary)
     .text(valueText, valueX - 20, y - 15, {
       width: 40,
       align: 'center'
     });

  doc.restore();

  // Zone labels below
  const labelY = y + height + 8;

  doc.fontSize(8)
     .font('Helvetica')
     .fillColor(COLORS.success)
     .text(`Good (≤${good}${unit})`, x, labelY, {
       width: goodWidth,
       align: 'center'
     });

  doc.fontSize(8)
     .fillColor(COLORS.warning)
     .text(`Needs Improvement`, x + goodWidth, labelY, {
       width: needsImprovementWidth,
       align: 'center'
     });

  doc.fontSize(8)
     .fillColor(COLORS.error)
     .text(`Poor (>${poor}${unit})`, x + goodWidth + needsImprovementWidth, labelY, {
       width: poorWidth,
       align: 'center'
     });

  return height + 40; // Height consumed (including label and zone labels)
}

module.exports = {
  drawGaugeChart,
  drawBarChart,
  drawPieChart,
  drawComparisonChart,
  drawProgressBar,
  drawThresholdChart,
  getScoreColor,
  COLORS
};
