/**
 * Timeline Visualizations
 * Charts and UI components for displaying scan history
 */

class TimelineVisualizer {
  constructor() {
    this.colors = {
      overall: '#00ff41',
      performance: '#4caf50',
      accessibility: '#00d9ff',
      seo: '#ffd700',
      fonts: '#bb86fc',
      improvement: '#00ff41',
      decline: '#ff6b6b',
      neutral: '#888'
    };
  }

  /**
   * Create a line chart showing score trends over time
   */
  createTrendChart(history, metrics = ['overall', 'performance', 'accessibility', 'seo']) {
    if (!history || history.length === 0) {
      return this.createEmptyState('No historical data available');
    }

    const container = document.createElement('div');
    container.className = 'timeline-chart';
    container.innerHTML = `
      <div class="chart-header">
        <h3>📈 Score Trends</h3>
        <div class="chart-legend">
          ${metrics.map(metric => `
            <span class="legend-item">
              <span class="legend-dot" style="background: ${this.colors[metric]}"></span>
              ${this.capitalize(metric)}
            </span>
          `).join('')}
        </div>
      </div>
      <div class="chart-body">
        <svg class="line-chart" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">
          ${this.renderLineChart(history, metrics)}
        </svg>
      </div>
      <div class="chart-footer">
        <span class="chart-range">Last ${history.length} scans</span>
        <span class="chart-period">${this.formatDateRange(history)}</span>
      </div>
    `;

    return container;
  }

  /**
   * Render SVG line chart
   */
  renderLineChart(history, metrics) {
    const width = 800;
    const height = 400;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Reverse history for chronological order
    const data = [...history].reverse();
    const points = data.length;

    // Calculate scales
    const xScale = chartWidth / Math.max(1, points - 1);
    const yScale = chartHeight / 100; // 0-100 score range

    let svg = '';

    // Grid lines
    svg += this.renderGridLines(padding, chartWidth, chartHeight);

    // Y-axis labels
    for (let i = 0; i <= 100; i += 20) {
      const y = padding.top + chartHeight - (i * yScale);
      svg += `
        <text x="${padding.left - 10}" y="${y}" 
              class="axis-label" text-anchor="end" 
              dominant-baseline="middle">${i}</text>
      `;
    }

    // Draw lines for each metric
    metrics.forEach(metric => {
      const pathData = data
        .map((scan, index) => {
          const score = scan.scores[metric] || 0;
          const x = padding.left + (index * xScale);
          const y = padding.top + chartHeight - (score * yScale);
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');

      svg += `
        <path 
          d="${pathData}" 
          fill="none" 
          stroke="${this.colors[metric]}" 
          stroke-width="3" 
          stroke-linecap="round"
          stroke-linejoin="round"
          class="chart-line"
          data-metric="${metric}"
        />
      `;

      // Add dots at data points
      data.forEach((scan, index) => {
        const score = scan.scores[metric] || 0;
        const x = padding.left + (index * xScale);
        const y = padding.top + chartHeight - (score * yScale);
        
        svg += `
          <circle 
            cx="${x}" 
            cy="${y}" 
            r="4" 
            fill="${this.colors[metric]}"
            class="chart-dot"
            data-metric="${metric}"
            data-score="${score}"
            data-date="${this.formatDate(scan.timestamp)}"
          >
            <title>${this.capitalize(metric)}: ${score} - ${this.formatDate(scan.timestamp)}</title>
          </circle>
        `;
      });
    });

    // X-axis labels (dates)
    const labelStep = Math.max(1, Math.floor(points / 5));
    data.forEach((scan, index) => {
      if (index % labelStep === 0 || index === points - 1) {
        const x = padding.left + (index * xScale);
        const y = height - 10;
        svg += `
          <text 
            x="${x}" 
            y="${y}" 
            class="axis-label axis-label-date" 
            text-anchor="middle"
            transform="rotate(-45 ${x} ${y})"
          >${this.formatDateShort(scan.timestamp)}</text>
        `;
      }
    });

    return svg;
  }

  /**
   * Render grid lines
   */
  renderGridLines(padding, chartWidth, chartHeight) {
    let svg = '';
    const yScale = chartHeight / 100;

    for (let i = 0; i <= 100; i += 20) {
      const y = padding.top + chartHeight - (i * yScale);
      svg += `
        <line 
          x1="${padding.left}" 
          y1="${y}" 
          x2="${padding.left + chartWidth}" 
          y2="${y}" 
          stroke="rgba(255, 255, 255, 0.1)" 
          stroke-width="1"
          stroke-dasharray="${i === 0 ? '0' : '4 4'}"
        />
      `;
    }

    return svg;
  }

  /**
   * Create comparison panel between current and previous scan
   */
  createComparisonPanel(current, previous) {
    if (!previous) {
      return this.createEmptyState('No previous scan for comparison');
    }

    const improvements = healthTimeline.calculateImprovement(current, previous);
    const timeDiff = current.timestamp - previous.timestamp;

    const container = document.createElement('div');
    container.className = 'comparison-panel';
    container.innerHTML = `
      <div class="comparison-header">
        <h3>📊 vs. Previous Scan</h3>
        <span class="time-since">${this.formatTimeSince(timeDiff)} ago</span>
      </div>
      <div class="comparison-body">
        ${this.renderImprovementCards(improvements)}
      </div>
      <div class="comparison-summary">
        ${this.renderOverallSummary(improvements)}
      </div>
    `;

    return container;
  }

  /**
   * Render improvement cards
   */
  renderImprovementCards(improvements) {
    const scoreKeys = ['overall', 'performance', 'accessibility', 'seo', 'fonts'];
    
    return scoreKeys
      .filter(key => improvements[key])
      .map(key => {
        const imp = improvements[key];
        const isPositive = imp.improved;
        const arrow = isPositive ? '↗' : '↘';
        const color = isPositive ? this.colors.improvement : this.colors.decline;
        
        return `
          <div class="improvement-card ${isPositive ? 'positive' : 'negative'}">
            <div class="improvement-icon">${this.getMetricIcon(key)}</div>
            <div class="improvement-content">
              <div class="improvement-label">${this.capitalize(key)}</div>
              <div class="improvement-values">
                <span class="value-previous">${imp.previous}</span>
                <span class="value-arrow" style="color: ${color}">${arrow}</span>
                <span class="value-current" style="color: ${color}">${imp.current}</span>
              </div>
              <div class="improvement-change" style="color: ${color}">
                ${isPositive ? '+' : ''}${imp.diff} 
                (${isPositive ? '+' : ''}${imp.percentChange}%)
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Render overall summary
   */
  renderOverallSummary(improvements) {
    const changes = Object.values(improvements).filter(imp => !imp.hasOwnProperty('metric_'));
    const improved = changes.filter(imp => imp.improved).length;
    const declined = changes.filter(imp => !imp.improved).length;
    const total = changes.length;

    let message = '';
    let emoji = '';
    
    if (improved > declined) {
      message = `Great progress! ${improved} out of ${total} metrics improved`;
      emoji = '🎉';
    } else if (declined > improved) {
      message = `${declined} metrics declined. Let's optimize!`;
      emoji = '⚠️';
    } else {
      message = `Mixed results. ${improved} improved, ${declined} declined`;
      emoji = '📊';
    }

    return `
      <div class="summary-message">
        <span class="summary-emoji">${emoji}</span>
        <span class="summary-text">${message}</span>
      </div>
    `;
  }

  /**
   * Create radar chart for multi-dimensional comparison
   */
  createRadarChart(current, previous) {
    const container = document.createElement('div');
    container.className = 'radar-chart-container';
    
    const metrics = ['performance', 'accessibility', 'seo', 'fonts'];
    const currentData = metrics.map(m => current.scores[m] || 0);
    const previousData = previous ? metrics.map(m => previous.scores[m] || 0) : null;

    container.innerHTML = `
      <div class="chart-header">
        <h3>🎯 Score Radar</h3>
      </div>
      <div class="chart-body">
        <svg class="radar-chart" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">
          ${this.renderRadar(metrics, currentData, previousData)}
        </svg>
      </div>
    `;

    return container;
  }

  /**
   * Render SVG radar chart
   */
  renderRadar(labels, currentData, previousData) {
    const centerX = 200;
    const centerY = 200;
    const radius = 120;
    const levels = 5;
    const points = labels.length;

    let svg = '';

    // Draw concentric circles
    for (let i = 1; i <= levels; i++) {
      const r = (radius / levels) * i;
      svg += `
        <circle 
          cx="${centerX}" 
          cy="${centerY}" 
          r="${r}" 
          fill="none" 
          stroke="rgba(255, 255, 255, 0.1)" 
          stroke-width="1"
        />
      `;
      
      // Level labels
      if (i === levels) {
        svg += `
          <text 
            x="${centerX + r + 5}" 
            y="${centerY}" 
            class="radar-level-label" 
            dominant-baseline="middle"
          >100</text>
        `;
      }
    }

    // Draw axes
    const angleStep = (Math.PI * 2) / points;
    for (let i = 0; i < points; i++) {
      const angle = angleStep * i - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      svg += `
        <line 
          x1="${centerX}" 
          y1="${centerY}" 
          x2="${x}" 
          y2="${y}" 
          stroke="rgba(255, 255, 255, 0.2)" 
          stroke-width="1"
        />
      `;

      // Labels
      const labelX = centerX + (radius + 30) * Math.cos(angle);
      const labelY = centerY + (radius + 30) * Math.sin(angle);
      svg += `
        <text 
          x="${labelX}" 
          y="${labelY}" 
          class="radar-label" 
          text-anchor="middle"
          dominant-baseline="middle"
        >${this.capitalize(labels[i])}</text>
      `;
    }

    // Draw previous data (if exists)
    if (previousData) {
      const previousPath = this.createRadarPath(centerX, centerY, radius, previousData, angleStep);
      svg += `
        <path 
          d="${previousPath}" 
          fill="rgba(136, 136, 136, 0.2)" 
          stroke="rgba(136, 136, 136, 0.5)" 
          stroke-width="2"
        />
      `;
    }

    // Draw current data
    const currentPath = this.createRadarPath(centerX, centerY, radius, currentData, angleStep);
    svg += `
      <path 
        d="${currentPath}" 
        fill="rgba(0, 255, 65, 0.2)" 
        stroke="${this.colors.overall}" 
        stroke-width="3"
      />
    `;

    // Draw data points
    currentData.forEach((value, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const distance = (value / 100) * radius;
      const x = centerX + distance * Math.cos(angle);
      const y = centerY + distance * Math.sin(angle);
      
      svg += `
        <circle 
          cx="${x}" 
          cy="${y}" 
          r="5" 
          fill="${this.colors.overall}"
        >
          <title>${labels[i]}: ${value}</title>
        </circle>
      `;
    });

    return svg;
  }

  /**
   * Create path data for radar chart
   */
  createRadarPath(centerX, centerY, radius, data, angleStep) {
    const points = data.map((value, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const distance = (value / 100) * radius;
      const x = centerX + distance * Math.cos(angle);
      const y = centerY + distance * Math.sin(angle);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    
    return points.join(' ') + ' Z';
  }

  /**
   * Create timeline overview with recent scans
   */
  createTimelineOverview(history, limit = 5) {
    const recentScans = history.slice(0, limit);
    
    if (recentScans.length === 0) {
      return this.createEmptyState('No scan history available');
    }

    const container = document.createElement('div');
    container.className = 'timeline-overview';
    container.innerHTML = `
      <div class="timeline-header">
        <h3>🕒 Recent Scans</h3>
        <button class="btn-view-all" onclick="healthTimeline.showFullHistory()">
          View All (${history.length})
        </button>
      </div>
      <div class="timeline-list">
        ${recentScans.map((scan, index) => this.renderTimelineItem(scan, index === 0)).join('')}
      </div>
    `;

    return container;
  }

  /**
   * Render individual timeline item
   */
  renderTimelineItem(scan, isCurrent = false) {
    const grade = this.calculateGrade(scan.scores.overall);
    const timeSince = this.formatTimeSince(Date.now() - scan.timestamp);

    return `
      <div class="timeline-item ${isCurrent ? 'current' : ''}">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-date">${this.formatDate(scan.timestamp)}</div>
          <div class="timeline-time-since">${timeSince} ago</div>
          <div class="timeline-scores">
            <div class="score-badge grade-${grade.toLowerCase()}">
              ${scan.scores.overall} <span class="grade">${grade}</span>
            </div>
            <div class="score-breakdown">
              ${Object.entries(scan.scores)
                .filter(([key]) => key !== 'overall')
                .map(([key, value]) => `
                  <span class="mini-score" title="${this.capitalize(key)}: ${value}">
                    ${this.getMetricIcon(key)} ${value}
                  </span>
                `)
                .join('')}
            </div>
          </div>
          ${isCurrent ? '<span class="current-badge">Current</span>' : ''}
        </div>
      </div>
    `;
  }

  /**
   * Create empty state message
   */
  createEmptyState(message) {
    const container = document.createElement('div');
    container.className = 'timeline-empty-state';
    container.innerHTML = `
      <div class="empty-icon">📊</div>
      <div class="empty-message">${message}</div>
      <div class="empty-hint">Run more scans to see trends and comparisons</div>
    `;
    return container;
  }

  /**
   * Helper: Get icon for metric
   */
  getMetricIcon(metric) {
    const icons = {
      overall: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
      performance: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      accessibility: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path d="M17 11h-3v7h-1v-7H8"/><path d="M14 18h-4"/><path d="M12 12v-1a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v1"/></svg>`,
      seo: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
      fonts: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>`
    };
    return icons[metric] || `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
  }

  /**
   * Helper: Capitalize string
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Helper: Format date
   */
  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Helper: Format date (short)
   */
  formatDateShort(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  }

  /**
   * Helper: Format time since
   */
  formatTimeSince(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''}`;
    return `${seconds} sec${seconds !== 1 ? 's' : ''}`;
  }

  /**
   * Helper: Format date range
   */
  formatDateRange(history) {
    if (history.length === 0) return '';
    if (history.length === 1) return this.formatDateShort(history[0].timestamp);
    
    const oldest = history[history.length - 1].timestamp;
    const newest = history[0].timestamp;
    
    return `${this.formatDateShort(oldest)} - ${this.formatDateShort(newest)}`;
  }

  /**
   * Helper: Calculate grade
   */
  calculateGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

// Create singleton instance
const timelineVisualizer = new TimelineVisualizer();

// Export for use in other scripts (both browser and Node.js)
if (typeof window !== 'undefined') {
  window.timelineVisualizer = timelineVisualizer;
  window.TimelineVisualizer = TimelineVisualizer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TimelineVisualizer, timelineVisualizer };
}
