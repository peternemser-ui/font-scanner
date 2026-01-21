(function (window) {
  'use strict';

  function getScoreColor(score) {
    if (typeof score !== 'number' || Number.isNaN(score)) return '#9ca3af';
    if (score >= 90) return '#22c55e';  // Green - excellent
    if (score >= 70) return '#f59e0b';  // Orange - needs improvement
    return '#ef4444';                   // Red - poor
  }

  function renderDonut(score, label) {
    const safeScore = typeof score === 'number' && !Number.isNaN(score)
      ? Math.max(0, Math.min(100, score))
      : 0;

    const color = getScoreColor(safeScore);
    const circumference = 2 * Math.PI * 75;
    const dash = (safeScore / 100) * circumference;
    const dashOffset = -(circumference * 0.25);

    return (
      '<div class="report-shell__summary-card" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;">' +
        '<div class="report-shell__summary-label">' + (label || '') + '</div>' +
        '<svg class="report-shell__donut" viewBox="0 0 180 180" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;">' +
          '<circle cx="90" cy="90" r="75" fill="none" stroke="#e5e7eb" stroke-width="12"></circle>' +
          '<circle cx="90" cy="90" r="75" fill="none" stroke="' + color + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + circumference + '" stroke-dashoffset="' + dashOffset + '" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;"></circle>' +
          '<text x="90" y="90" text-anchor="middle" dominant-baseline="central" fill="' + color + '" font-size="36" font-weight="700" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;">' + (typeof score === 'number' && !Number.isNaN(score) ? safeScore : '—') + '</text>' +
        '</svg>' +
        '<div class="report-shell__donut-grade" style="color:' + color + '; -webkit-print-color-adjust: exact; print-color-adjust: exact;">' + (typeof score === 'number' && !Number.isNaN(score) ? (safeScore + '/100') : '—') + '</div>' +
      '</div>'
    );
  }

  function renderReportHeader(opts) {
    const o = opts || {};

    if (window.ReportContainer && typeof window.ReportContainer.renderHeader === 'function') {
      return window.ReportContainer.renderHeader({
        url: o.url,
        timestamp: o.timestamp,
        mode: o.mode,
        title: o.title || 'Analysis Results',
        subtitle: o.badgeText || o.subtitle
      });
    }

    return '';
  }

  function renderSummaryDonuts(items) {
    const list = Array.isArray(items) ? items : [];
    return '<div class="report-shell__summary">' + list.map(function (item) {
      return renderDonut(item.score, item.label);
    }).join('') + '</div>';
  }

  function renderMetricCardGrid(items) {
    const list = Array.isArray(items) ? items : [];
    return '<div class="report-shell__metric-grid">' + list.map(function (item) {
      return item && item.html ? item.html : '';
    }).join('') + '</div>';
  }

  function renderDeviceCard(opts) {
    const o = opts || {};
    return (
      '<div class="report-shell__card">' +
        '<div class="report-shell__card-title">' + (o.icon || '') + ' ' + (o.title || '') + '</div>' +
        (o.topMetricsHTML || '') +
        (o.bottomMetricsHTML || '') +
      '</div>'
    );
  }

  window.ReportShell = window.ReportShell || {
    getScoreColor: getScoreColor,
    renderReportHeader: renderReportHeader,
    renderSummaryDonuts: renderSummaryDonuts,
    renderMetricCardGrid: renderMetricCardGrid,
    renderDeviceCard: renderDeviceCard
  };
})(window);
