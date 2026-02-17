(function (window) {
  'use strict';

  // i18n helper
  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const val = window.i18n.t(key);
      return (val === key && fallback) ? fallback : val;
    }
    return fallback || key;
  }

  function getScoreColor(score) {
    const stops = [
      [0,'#E53935'],[5,'#E14127'],[10,'#DD4E1A'],[15,'#DA5B0E'],
      [20,'#D96A06'],[25,'#E07E00'],[30,'#E89200'],[35,'#F0A400'],
      [40,'#F5B300'],[45,'#FAC200'],[50,'#FFD000'],[55,'#FFD600'],
      [60,'#FFDC00'],[65,'#FFE100'],[70,'#F0DD00'],[75,'#D2D400'],
      [80,'#A0C800'],[85,'#6BBD28'],[90,'#38B249'],[95,'#1FAD4F'],
      [100,'#0AA64F']
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
          '<circle class="report-shell__donut-track" cx="90" cy="90" r="75" fill="none" stroke-width="12"></circle>' +
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
        title: o.title || t('reports.common.analysisResults', 'Analysis Results'),
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
