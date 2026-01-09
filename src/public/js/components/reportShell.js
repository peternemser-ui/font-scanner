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
    const modeLabels = {
      full: 'LIGHTHOUSE_ANALYSIS_RESULTS',
      cwv: 'CORE_WEB_VITALS_RESULTS',
      quick: 'QUICK_SCAN_RESULTS',
      performance: 'PERFORMANCE_ANALYSIS_RESULTS'
    };
    const headerLabel = modeLabels[mode] || 'PERFORMANCE_ANALYSIS_RESULTS';
    
    return `
      <div class="section" style="margin-bottom: 1.5rem;">
        <h2 style="color: var(--text-primary, #fff); font-size: 1.5rem; margin: 0 0 1rem 0;">[${headerLabel}]</h2>
        ${url ? `<p style="color: var(--text-muted, #9ca3af); margin: 0.25rem 0;">>> url: ${url}</p>` : ''}
        ${timestamp ? `<p style="color: var(--text-muted, #9ca3af); margin: 0.25rem 0;">>> timestamp: ${timestamp}</p>` : ''}
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
