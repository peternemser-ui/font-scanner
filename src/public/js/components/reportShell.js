(function(window) {
  function getScoreColor(score) {
    if (typeof score !== 'number' || Number.isNaN(score)) return '#9ca3af';
    if (score >= 90) return '#22c55e';  // Green - excellent
    if (score >= 70) return '#f59e0b';  // Orange - needs improvement
    return '#ef4444';                   // Red - poor
  }

  function renderDonut(score, label) {
    const safeScore = typeof score === 'number' && !Number.isNaN(score) ? Math.max(0, Math.min(100, score)) : 0;
    const color = getScoreColor(safeScore);
    const circumference = 2 * Math.PI * 75;
    const dash = (safeScore / 100) * circumference;
    return `
      <div class="report-shell__summary-card">
        <div class="report-shell__summary-label">${label}</div>
        <svg class="report-shell__donut" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r="75" fill="none" stroke="var(--donut-track, rgba(255,255,255,0.08))" stroke-width="12"></circle>
          <circle cx="90" cy="90" r="75" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${dash} ${circumference}" transform="rotate(-90 90 90)" style="filter: drop-shadow(0 0 12px ${color}50);"></circle>
          <text x="90" y="90" text-anchor="middle" dy="0.35em" fill="${color}" stroke="rgba(0,0,0,0.65)" stroke-width="2" paint-order="stroke fill">${typeof score === 'number' && !Number.isNaN(score) ? safeScore : '—'}</text>
        </svg>
        <div class="report-shell__donut-grade" style="color:${color};">${typeof score === 'number' && !Number.isNaN(score) ? `${safeScore}/100` : '—'}</div>
      </div>
    `;
  }

  function renderReportHeader(opts) {
    const { title, url, timestamp, badgeText, mode = 'performance' } = opts || {};

    // Delegate to ReportContainer if available (new system)
    if (window.ReportContainer && window.ReportContainer.renderHeader) {
      const modeTitles = {
        full: 'Lighthouse Audit',
        cwv: 'Core Web Vitals',
        quick: 'Quick Scan',
        performance: 'Performance Analysis'
      };
      const modeLabel = modeTitles[mode] || '';
      const isRedundant =
        typeof title === 'string' &&
        title.trim() &&
        modeLabel &&
        title.toLowerCase().includes(modeLabel.toLowerCase());

      return window.ReportContainer.renderHeader({
        url,
        timestamp,
        mode,
        title: title || 'Analysis Results',
        subtitle: isRedundant ? undefined : badgeText,
        showModeBadge: !isRedundant,
        showModeMeta: !isRedundant
      });
    }

    // Fallback: Legacy format with improved labels (no raw debug text)
    const modeTitles = {
      full: 'Lighthouse Audit',
      cwv: 'Core Web Vitals',
      quick: 'Quick Scan',
      performance: 'Performance Analysis'
    };
    const displayTitle = modeTitles[mode] || 'Performance Analysis';

    return `
      <div class="section" style="margin-bottom: 1.5rem;">
        <div style="display: inline-block; padding: 0.375rem 0.875rem; background: var(--color-primary, #00FF9D); color: var(--color-black, #000); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 8px; margin-bottom: 1rem;">${displayTitle}</div>
        <h2 style="color: var(--text-primary, #fff); font-size: 1.5rem; margin: 0 0 1rem 0;">${title || 'Analysis Results'}</h2>
        ${url ? `<p style="color: var(--text-muted, #9ca3af); margin: 0.25rem 0; font-size: 0.875rem;">🌐 ${url}</p>` : ''}
        ${timestamp ? `<p style="color: var(--text-muted, #9ca3af); margin: 0.25rem 0; font-size: 0.875rem;">🕒 ${timestamp}</p>` : ''}
      </div>
    `;
  }

  function renderSummaryDonuts(items) {
    return `
      <div class="report-shell__summary">
        ${items.map(item => renderDonut(item.score, item.label)).join('')}
      </div>
    `;
  }

  function renderMetricCardGrid(items) {
    return `
      <div class="report-shell__metric-grid">
        ${items.map(item => item.html).join('')}
      </div>
    `;
  }

  function renderDeviceCard({ title, icon, topMetricsHTML, bottomMetricsHTML }) {
    return `
      <div class="report-shell__card">
        <div class="report-shell__card-title">${icon || ''} ${title}</div>
        ${topMetricsHTML || ''}
        ${bottomMetricsHTML || ''}
      </div>
    `;
  }

  window.ReportShell = {
    getScoreColor,
    renderReportHeader,
    renderSummaryDonuts,
    renderMetricCardGrid,
    renderDeviceCard
  };
})(window);
