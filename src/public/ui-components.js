/**
 * Reusable UI Components
 * Progress bars, status chips, metric cards, and other visual elements
 */

class UIComponents {
  /**
   * Create a threshold-based progress bar (e.g., for Core Web Vitals)
   * @param {Object} options - Configuration object
   * @param {string} options.label - Metric label
   * @param {number} options.value - Current value
   * @param {Object} options.thresholds - {good, needsWork, poor} threshold values
   * @param {string} options.unit - Unit of measurement (ms, s, etc.)
   * @param {string} options.format - 'number' or 'time'
   * @returns {HTMLElement}
   */
  static createThresholdBar({ label, value, thresholds, unit = '', format = 'number' }) {
    const container = document.createElement('div');
    container.className = 'threshold-bar-container';

    // Determine status based on thresholds
    let status, statusIcon, statusText;
    if (value <= thresholds.good) {
      status = 'good';
      statusIcon = '✅';
      statusText = 'Good';
    } else if (value <= thresholds.needsWork) {
      status = 'needs-work';
      statusIcon = '⚠️';
      statusText = 'Needs Work';
    } else {
      status = 'poor';
      statusIcon = '❌';
      statusText = 'Critical';
    }

    const percentage = Math.min((value / thresholds.poor) * 100, 100);
    const displayValue = format === 'time' ? this.formatTime(value) : `${value}${unit}`;

    container.innerHTML = `
      <div class="threshold-bar-header">
        <span class="threshold-bar-label">${label}</span>
        <span class="threshold-bar-value ${status}">${displayValue}</span>
      </div>
      <div class="threshold-bar-track">
        <div class="threshold-zone good" style="width: ${(thresholds.good / thresholds.poor) * 100}%"></div>
        <div class="threshold-zone needs-work" style="width: ${((thresholds.needsWork - thresholds.good) / thresholds.poor) * 100}%"></div>
        <div class="threshold-zone poor" style="width: ${((thresholds.poor - thresholds.needsWork) / thresholds.poor) * 100}%"></div>
        <div class="threshold-indicator" style="left: ${Math.min(percentage, 100)}%">
          <div class="threshold-marker ${status}"></div>
        </div>
      </div>
      <div class="threshold-bar-footer">
        <span class="threshold-status ${status}">
          ${statusIcon} ${statusText}
        </span>
        <span class="threshold-target">Target: ≤ ${thresholds.good}${unit}</span>
      </div>
    `;

    return container;
  }

  /**
   * Create a status chip
   * @param {string} status - 'good', 'needs-work', 'critical', 'info'
   * @param {string} text - Display text
   * @returns {HTMLElement}
   */
  static createStatusChip(status, text) {
    const chip = document.createElement('span');
    chip.className = `status-chip status-chip-${status}`;
    
    const icons = {
      good: '✅',
      'needs-work': '⚠️',
      critical: '❌',
      info: 'ℹ️'
    };

    chip.innerHTML = `<span class="chip-icon">${icons[status] || 'ℹ️'}</span> ${text}`;
    return chip;
  }

  /**
   * Create a metric card
   * @param {Object} options - Configuration object
   * @param {string} options.icon - Emoji icon
   * @param {string} options.label - Metric label
   * @param {string|number} options.value - Metric value
   * @param {string} options.subtitle - Optional subtitle
   * @param {string} options.trend - 'up', 'down', 'neutral' (optional)
   * @returns {HTMLElement}
   */
  static createMetricCard({ icon, label, value, subtitle = '', trend = null }) {
    const card = document.createElement('div');
    card.className = 'metric-card';

    const trendIcons = {
      up: '📈',
      down: '📉',
      neutral: '➡️'
    };

    card.innerHTML = `
      <div class="metric-card-icon">${icon}</div>
      <div class="metric-card-content">
        <div class="metric-card-label">${label}</div>
        <div class="metric-card-value">${value}</div>
        ${subtitle ? `<div class="metric-card-subtitle">${subtitle}</div>` : ''}
        ${trend ? `<div class="metric-card-trend trend-${trend}">${trendIcons[trend]} ${trend}</div>` : ''}
      </div>
    `;

    return card;
  }

  /**
   * Create a heat map grid
   * @param {Array} data - Array of {label, value, max} objects
   * @returns {HTMLElement}
   */
  static createHeatMap(data) {
    const container = document.createElement('div');
    container.className = 'heat-map-grid';

    data.forEach(item => {
      const intensity = (item.value / item.max) * 100;
      let heatLevel;
      if (intensity > 75) heatLevel = 'hot';
      else if (intensity > 50) heatLevel = 'warm';
      else if (intensity > 25) heatLevel = 'cool';
      else heatLevel = 'cold';

      const cell = document.createElement('div');
      cell.className = `heat-map-cell heat-${heatLevel}`;
      cell.innerHTML = `
        <div class="heat-map-label">${item.label}</div>
        <div class="heat-map-value">${item.value}</div>
      `;
      cell.title = `${item.label}: ${item.value}/${item.max}`;

      container.appendChild(cell);
    });

    return container;
  }

  /**
   * Create an actionable recommendation card
   * @param {Object} options - Configuration object
   * @param {string} options.title - Recommendation title
   * @param {string} options.description - Description text
   * @param {string} options.priority - 'high', 'medium', 'low'
   * @param {string} options.action - Action button text
   * @param {Function} options.onClick - Click handler
   * @returns {HTMLElement}
   */
  static createActionCard({ title, description, priority, action, onClick }) {
    const card = document.createElement('div');
    card.className = `action-card action-priority-${priority}`;

    const priorityIcons = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    card.innerHTML = `
      <div class="action-card-header">
        <span class="action-priority">${priorityIcons[priority]} ${priority.toUpperCase()}</span>
      </div>
      <div class="action-card-body">
        <h4 class="action-card-title">${title}</h4>
        <p class="action-card-description">${description}</p>
      </div>
      <div class="action-card-footer">
        <button class="action-card-button">
          ${action} →
        </button>
      </div>
    `;

    const button = card.querySelector('.action-card-button');
    if (onClick) {
      button.addEventListener('click', onClick);
    }

    return card;
  }

  /**
   * Create a comparison badge
   * @param {string} label - Badge label
   * @param {string} value - Badge value
   * @param {boolean} positive - Whether the badge is positive or negative
   * @returns {HTMLElement}
   */
  static createComparisonBadge(label, value, positive = true) {
    const badge = document.createElement('div');
    badge.className = `comparison-badge ${positive ? 'badge-positive' : 'badge-negative'}`;

    badge.innerHTML = `
      <span class="badge-icon">${positive ? '🏆' : '⚡'}</span>
      <div class="badge-content">
        <div class="badge-label">${label}</div>
        <div class="badge-value">${value}</div>
      </div>
    `;

    return badge;
  }

  /**
   * Format time in milliseconds to readable format
   * @param {number} ms - Time in milliseconds
   * @returns {string}
   */
  static formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Create a Core Web Vitals dashboard
   * @param {Object} vitals - {lcp, fid, cls} values
   * @returns {HTMLElement}
   */
  static createCoreWebVitalsDashboard(vitals) {
    const container = document.createElement('div');
    container.className = 'cwv-dashboard';

    // LCP - Largest Contentful Paint
    container.appendChild(this.createThresholdBar({
      label: 'Largest Contentful Paint (LCP)',
      value: vitals.lcp || 0,
      thresholds: { good: 2500, needsWork: 4000, poor: 6000 },
      unit: 'ms',
      format: 'time'
    }));

    // FID - First Input Delay
    container.appendChild(this.createThresholdBar({
      label: 'First Input Delay (FID)',
      value: vitals.fid || 0,
      thresholds: { good: 100, needsWork: 300, poor: 500 },
      unit: 'ms',
      format: 'time'
    }));

    // CLS - Cumulative Layout Shift
    container.appendChild(this.createThresholdBar({
      label: 'Cumulative Layout Shift (CLS)',
      value: vitals.cls || 0,
      thresholds: { good: 0.1, needsWork: 0.25, poor: 0.5 },
      unit: '',
      format: 'number'
    }));

    return container;
  }

  /**
   * Create a score gauge
   * @param {number} score - Score value (0-100)
   * @param {string} label - Label text
   * @returns {HTMLElement}
   */
  static createScoreGauge(score, label) {
    const gauge = document.createElement('div');
    gauge.className = 'score-gauge';

    let color, status;
    if (score >= 90) { color = 'var(--score-excellent)'; status = 'Excellent'; }
    else if (score >= 70) { color = 'var(--score-good)'; status = 'Good'; }
    else if (score >= 50) { color = 'var(--score-fair)'; status = 'Fair'; }
    else { color = 'var(--score-poor)'; status = 'Poor'; }

    gauge.innerHTML = `
      <div class="gauge-container">
        <svg class="gauge-svg" viewBox="0 0 100 100">
          <circle class="gauge-background" cx="50" cy="50" r="45" />
          <circle class="gauge-progress" cx="50" cy="50" r="45" 
                  style="stroke: ${color}; stroke-dashoffset: ${283 - (283 * score) / 100}" />
        </svg>
        <div class="gauge-content">
          <div class="gauge-score">${score}</div>
          <div class="gauge-status">${status}</div>
        </div>
      </div>
      <div class="gauge-label">${label}</div>
    `;

    return gauge;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIComponents;
}
