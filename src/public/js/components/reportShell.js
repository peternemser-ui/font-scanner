(function(window) {
  function getScoreColor(score) {
    const stops = [
      [0,'#1A0000'],[5,'#311400'],[10,'#482900'],[15,'#5F3D00'],
      [20,'#765200'],[25,'#8C6600'],[30,'#A37A00'],[35,'#BA8F00'],
      [40,'#D1A300'],[45,'#E8B800'],[50,'#FFCC00'],[55,'#E6D106'],
      [60,'#CCD60C'],[65,'#B2DB12'],[70,'#99E018'],[75,'#80E61E'],
      [80,'#66EB23'],[85,'#4CF029'],[90,'#33F52F'],[95,'#1AFA35'],
      [100,'#00FF3B']
    ];
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    const idx = Math.min(Math.floor(s / 5), 19);
    const [s1, c1] = stops[idx];
    const [, c2] = stops[Math.min(idx + 1, 20)];
    const t = (s - s1) / 5;
    const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const [r1,g1,b1] = p(c1);
    const [r2,g2,b2] = p(c2);
    const r = Math.round(r1+(r2-r1)*t);
    const g = Math.round(g1+(g2-g1)*t);
    const b = Math.round(b1+(b2-b1)*t);
    return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
  }

  function renderDonut(score, label) {
    const safeScore = typeof score === 'number' && !Number.isNaN(score) ? Math.max(0, Math.min(100, score)) : 0;
    const color = getScoreColor(safeScore);
    const circumference = 2 * Math.PI * 75;
    const dash = (safeScore / 100) * circumference;
    const dashOffset = -(circumference * 0.25);
    return `
      <div class="report-shell__summary-card" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;">
        <div class="report-shell__summary-label">${label}</div>
        <svg class="report-shell__donut" viewBox="0 0 180 180" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;">
          <circle cx="90" cy="90" r="75" fill="none" stroke="#e5e7eb" stroke-width="12"></circle>
          <circle cx="90" cy="90" r="75" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${dash} ${circumference}" stroke-dashoffset="${dashOffset}" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;"></circle>
          <text x="90" y="90" text-anchor="middle" dominant-baseline="central" fill="${color}" font-size="36" font-weight="700" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;">${typeof score === 'number' && !Number.isNaN(score) ? safeScore : '—'}</text>
        </svg>
        <div class="report-shell__donut-grade" style="color:${color}; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${typeof score === 'number' && !Number.isNaN(score) ? `${safeScore}/100` : '—'}</div>
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
      performance: 'Performance Analysis',
      security: 'Security Audit',
      seo: 'SEO Analysis',
      accessibility: 'Accessibility Audit',
      fonts: 'Font Analysis'
    };
    const displayTitle = modeTitles[mode] || 'Analysis Results';

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
