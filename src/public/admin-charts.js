/**
 * Admin Dashboard Charts
 * Canvas-based chart rendering for the analytics section.
 * Loaded before admin-script.js — exposes loadAnalytics() globally.
 */

/* ── Palette ──────────────────────────────────────────────── */
var CHART_PALETTE = [
  '#5bf4e7', '#3b82f6', '#a855f7', '#f59e0b',
  '#14b8a6', '#ec4899', '#f97316', '#6366f1',
  '#ef4444', '#84cc16', '#f43f5e', '#DC2626'
];

/* Helper: read a CSS custom property from :root / body */
function _cssVar(name, fallback) {
  var val = getComputedStyle(document.body).getPropertyValue(name);
  return val ? val.trim() : fallback;
}

/* ── Canvas helpers ───────────────────────────────────────── */

function _setupCanvas(canvas, w, h) {
  var dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

function _roundRect(ctx, x, y, w, h, r) {
  if (h <= 0 || w <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function _niceMax(val) {
  if (val <= 0) return 5;
  if (val <= 5) return 5;
  if (val <= 10) return 10;
  var mag = Math.pow(10, Math.floor(Math.log10(val)));
  var r = val / mag;
  if (r <= 1.5) return Math.ceil(1.5 * mag);
  if (r <= 3) return Math.ceil(3 * mag);
  if (r <= 5) return Math.ceil(5 * mag);
  return Math.ceil(10 * mag);
}

function _noData(ctx, w, h, msg) {
  ctx.fillStyle = _cssVar('--admin-chart-nodata', '#444');
  ctx.font = '13px Inter, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg || 'No data yet', w / 2, h / 2);
}

/* ══════════════════════════════════════════════════════════════
   VERTICAL BAR CHART  (scan activity)
   ══════════════════════════════════════════════════════════════ */

function _drawBarChart(id, labels, values, opts) {
  var canvas = document.getElementById(id);
  if (!canvas) return;
  opts = opts || {};

  var w = canvas.parentElement.clientWidth;
  var h = opts.height || 280;
  var ctx = _setupCanvas(canvas, w, h);
  var color = opts.color || CHART_PALETTE[0];

  if (!values.length || values.every(function (v) { return v === 0; })) {
    _noData(ctx, w, h, 'No scan activity yet');
    return;
  }

  var pad = { t: 24, r: 16, b: 44, l: 52 };
  var cw = w - pad.l - pad.r;
  var ch = h - pad.t - pad.b;
  var mx = _niceMax(Math.max.apply(null, values));

  // Grid + Y labels
  var i, gy;
  var gridColor = _cssVar('--admin-chart-grid', 'rgba(255,255,255,0.05)');
  var labelColor = _cssVar('--admin-chart-label', '#555');
  ctx.textBaseline = 'middle';
  for (i = 0; i <= 4; i++) {
    gy = pad.t + (ch / 4) * i;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, gy);
    ctx.lineTo(w - pad.r, gy);
    ctx.stroke();

    ctx.fillStyle = labelColor;
    ctx.font = '11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(mx - (mx / 4) * i), pad.l - 10, gy);
  }

  // Bars
  var slot = cw / values.length;
  var barW = Math.min(slot * 0.6, 36);
  var every = Math.ceil(values.length / 15);

  values.forEach(function (val, idx) {
    var bx = pad.l + slot * idx + (slot - barW) / 2;
    var bh = (val / mx) * ch;
    var by = pad.t + ch - bh;

    var grad = ctx.createLinearGradient(0, by, 0, by + bh);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + '30');
    ctx.fillStyle = grad;
    _roundRect(ctx, bx, by, barW, bh, 3);
    ctx.fill();

    // X label (show every Nth to avoid overlap)
    if (idx % every === 0 || idx === values.length - 1) {
      ctx.fillStyle = labelColor;
      ctx.font = '10px Inter, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(labels[idx], bx + barW / 2, h - pad.b + 8);
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   AREA / LINE CHART  (user registrations)
   ══════════════════════════════════════════════════════════════ */

function _drawAreaChart(id, labels, values, opts) {
  var canvas = document.getElementById(id);
  if (!canvas) return;
  opts = opts || {};

  var w = canvas.parentElement.clientWidth;
  var h = opts.height || 280;
  var ctx = _setupCanvas(canvas, w, h);
  var color = opts.color || CHART_PALETTE[1];

  if (values.length < 2 || values.every(function (v) { return v === 0; })) {
    _noData(ctx, w, h, 'Not enough data');
    return;
  }

  var pad = { t: 24, r: 16, b: 44, l: 52 };
  var cw = w - pad.l - pad.r;
  var ch = h - pad.t - pad.b;
  var mx = _niceMax(Math.max.apply(null, values));

  // Grid + Y labels
  var i, gy;
  var gridColor = _cssVar('--admin-chart-grid', 'rgba(255,255,255,0.05)');
  var labelColor = _cssVar('--admin-chart-label', '#555');
  ctx.textBaseline = 'middle';
  for (i = 0; i <= 4; i++) {
    gy = pad.t + (ch / 4) * i;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, gy);
    ctx.lineTo(w - pad.r, gy);
    ctx.stroke();

    ctx.fillStyle = labelColor;
    ctx.font = '11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(mx - (mx / 4) * i), pad.l - 10, gy);
  }

  // Calculate points
  var step = cw / (values.length - 1);
  var pts = values.map(function (val, idx) {
    return {
      x: pad.l + step * idx,
      y: pad.t + ch - (val / mx) * ch
    };
  });

  // Area fill
  var aGrad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
  aGrad.addColorStop(0, color + '35');
  aGrad.addColorStop(1, color + '05');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pad.t + ch);
  pts.forEach(function (p) { ctx.lineTo(p.x, p.y); });
  ctx.lineTo(pts[pts.length - 1].x, pad.t + ch);
  ctx.closePath();
  ctx.fillStyle = aGrad;
  ctx.fill();

  // Line (smooth bezier)
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (var j = 1; j < pts.length; j++) {
    var cpx = (pts[j - 1].x + pts[j].x) / 2;
    ctx.bezierCurveTo(cpx, pts[j - 1].y, cpx, pts[j].y, pts[j].x, pts[j].y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Dots
  pts.forEach(function (p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = _cssVar('--admin-chart-dot-center', '#0a0a0a');
    ctx.fill();
  });

  // X labels
  var every = Math.ceil(labels.length / 7);
  labels.forEach(function (label, idx) {
    if (idx % every === 0 || idx === labels.length - 1) {
      ctx.fillStyle = labelColor;
      ctx.font = '10px Inter, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, pts[idx].x, h - pad.b + 8);
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   DONUT CHART  (plan distribution)
   ══════════════════════════════════════════════════════════════ */

function _drawDonutChart(id, labels, values, colors) {
  var canvas = document.getElementById(id);
  if (!canvas) return;

  var w = canvas.parentElement.clientWidth;
  var h = 280;
  var ctx = _setupCanvas(canvas, w, h);

  var total = values.reduce(function (a, b) { return a + b; }, 0);
  if (total === 0) {
    _noData(ctx, w, h, 'No users yet');
    return;
  }

  var cx = w / 2;
  var cy = 110;
  var R = Math.min(85, w / 3.5);
  var Ri = R * 0.58;

  // Segments
  var start = -Math.PI / 2;
  values.forEach(function (val, idx) {
    var slice = (val / total) * Math.PI * 2;
    var end = start + slice;
    ctx.beginPath();
    ctx.arc(cx, cy, R, start, end);
    ctx.arc(cx, cy, Ri, end, start, true);
    ctx.closePath();
    ctx.fillStyle = (colors && colors[idx]) || CHART_PALETTE[idx];
    ctx.fill();
    start = end;
  });

  // Center text
  ctx.fillStyle = _cssVar('--admin-text', '#fff');
  ctx.font = 'bold 28px Inter, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 6);
  ctx.fillStyle = _cssVar('--admin-text-faint', '#666');
  ctx.font = '11px Inter, -apple-system, sans-serif';
  ctx.fillText('TOTAL USERS', cx, cy + 14);

  // Legend row
  var legY = cy + R + 24;
  var totalLegW = labels.length * 80;
  var legStartX = (w - totalLegW) / 2;

  labels.forEach(function (label, idx) {
    var lx = legStartX + idx * 80;
    var pct = Math.round((values[idx] / total) * 100);

    ctx.beginPath();
    ctx.arc(lx + 6, legY, 5, 0, Math.PI * 2);
    ctx.fillStyle = (colors && colors[idx]) || CHART_PALETTE[idx];
    ctx.fill();

    ctx.fillStyle = _cssVar('--admin-text-muted', '#999');
    ctx.font = '12px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label + ' ' + pct + '%', lx + 16, legY);
  });
}

/* ══════════════════════════════════════════════════════════════
   HORIZONTAL BAR CHART  (scan types)
   ══════════════════════════════════════════════════════════════ */

function _drawHBarChart(id, labels, values) {
  var canvas = document.getElementById(id);
  if (!canvas) return;

  var w = canvas.parentElement.clientWidth;
  var barH = 28;
  var gap = 8;
  var rows = Math.max(values.length, 1);
  var h = rows * (barH + gap) + 30;
  var ctx = _setupCanvas(canvas, w, h);

  if (!values.length) {
    _noData(ctx, w, Math.max(h, 160), 'No scan results yet');
    return;
  }

  var pad = { l: 140, r: 60 };
  var cw = w - pad.l - pad.r;
  var mx = Math.max.apply(null, values) || 1;

  values.forEach(function (val, idx) {
    var y = 10 + (barH + gap) * idx;
    var bw = (val / mx) * cw;

    // Label
    var displayLabel = labels[idx]
      ? labels[idx].replace(/[_-]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); })
      : 'Unknown';
    ctx.fillStyle = _cssVar('--admin-text-muted', '#aaa');
    ctx.font = '12px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayLabel, pad.l - 14, y + barH / 2);

    // Track background
    ctx.fillStyle = _cssVar('--admin-chart-grid', 'rgba(255,255,255,0.03)');
    _roundRect(ctx, pad.l, y, cw, barH, 4);
    ctx.fill();

    // Bar fill
    var c = CHART_PALETTE[idx % CHART_PALETTE.length];
    var grad = ctx.createLinearGradient(pad.l, 0, pad.l + bw, 0);
    grad.addColorStop(0, c);
    grad.addColorStop(1, c + '70');
    ctx.fillStyle = grad;
    _roundRect(ctx, pad.l, y, Math.max(bw, 4), barH, 4);
    ctx.fill();

    // Value
    ctx.fillStyle = _cssVar('--admin-text-muted', '#888');
    ctx.font = '12px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(val, pad.l + bw + 10, y + barH / 2);
  });
}

/* ══════════════════════════════════════════════════════════════
   DATA LOADING & RENDERING
   ══════════════════════════════════════════════════════════════ */

var _analyticsData = null;

/**
 * Fetch analytics data and render all charts.
 * Called from admin-script.js on load.
 */
async function loadAnalytics() {
  try {
    var response = await fetch('/api/admin/analytics', {
      headers: proManager.getAuthHeaders()
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load analytics');

    _analyticsData = data;
    _renderCharts(data);
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

function _renderCharts(data) {
  // Scan activity bar chart (last 30 days)
  var scan = _fillDays(data.scanActivity, 30);
  _drawBarChart('scanActivityChart', scan.labels, scan.values, { color: _cssVar('--admin-accent', '#5bf4e7') });

  // User registration area chart (last 30 days)
  var users = _fillDays(data.userGrowth, 30);
  _drawAreaChart('userGrowthChart', users.labels, users.values, { color: '#3b82f6' });

  // Plan distribution donut
  var planLabels = data.planDistribution.map(function (p) {
    return p.plan ? p.plan.charAt(0).toUpperCase() + p.plan.slice(1) : 'Other';
  });
  var planValues = data.planDistribution.map(function (p) { return parseInt(p.count, 10) || 0; });
  var planColors = data.planDistribution.map(function (p) {
    if (p.plan === 'pro') return '#a855f7';
    if (p.plan === 'free') return '#6b7280';
    return '#f59e0b';
  });
  _drawDonutChart('planDistChart', planLabels, planValues, planColors);

  // Scan types horizontal bars
  var typeLabels = data.scanTypes.map(function (s) { return s.result_type; });
  var typeValues = data.scanTypes.map(function (s) { return parseInt(s.count, 10) || 0; });
  _drawHBarChart('scanTypesChart', typeLabels, typeValues);
}

/**
 * Fill in missing days with 0 values for a complete N-day series.
 */
function _fillDays(rows, n) {
  var map = {};
  (rows || []).forEach(function (r) { map[r.day] = parseInt(r.count, 10) || 0; });

  var labels = [];
  var values = [];
  var now = new Date();

  for (var i = n - 1; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    var key = d.toISOString().split('T')[0];
    var short = (d.getMonth() + 1) + '/' + d.getDate();
    labels.push(short);
    values.push(map[key] || 0);
  }

  return { labels: labels, values: values };
}

/* ── Resize handler: re-render charts when window changes ──── */
var _chartResizeTimer;
window.addEventListener('resize', function () {
  clearTimeout(_chartResizeTimer);
  _chartResizeTimer = setTimeout(function () {
    if (_analyticsData) _renderCharts(_analyticsData);
  }, 200);
});
