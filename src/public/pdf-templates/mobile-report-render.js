/**
 * Mobile Report — PDF Renderer
 * Renders all mobile analysis sections into the PDF template.
 * Matches the richness of the web UI (mobile-analyzer-script.js).
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[mobile-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('mobile', function renderMobile(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;
    var translateImpact = utils.translateImpact || function(v) { return v; };

    var sectionIndex = 1;

    function _htmlToNode(htmlStr) {
      var tpl = document.createElement('template');
      tpl.innerHTML = htmlStr.trim();
      return tpl.content.firstChild;
    }

    /** Safe number formatting (mirrors formatScore in web UI) */
    function _fmtScore(val) {
      var n = Number(val);
      if (!isFinite(n)) return '0';
      return n % 1 === 0 ? String(n) : n.toFixed(1);
    }

    /** Score colour helper */
    function _scoreColor(score) {
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

    // Resolve data sources
    var deviceKeys = Object.keys(data.devices || {});
    var primaryDevice = data.devices[deviceKeys[0]] || {};
    var perfSummary = data.performanceSummary || {};
    var readSummary = data.readabilitySummary || {};
    var a11ySummary = data.accessibilitySummary || {};
    var touchSummary = data.touchTargetsSummary || {};
    var recommendations = data.recommendations || [];

    /* -------------------------------------------------------------------
       Helper: per-device score breakdown table (mirrors web UI bars)
       ------------------------------------------------------------------- */
    function _renderDeviceBreakdown(metricKey, scoreKey, fallbackAvg) {
      var html = '';
      var items = [];
      deviceKeys.forEach(function (key) {
        var dev = data.devices[key];
        if (!dev || dev.error) return;
        var bucket = dev[metricKey];
        if (!bucket || bucket[scoreKey] === undefined) return;
        items.push({ name: dev.device || key, score: Number(bucket[scoreKey]) || 0 });
      });

      if (items.length === 0) return '';

      var scores = items.map(function (i) { return i.score; });
      var avg = scores.reduce(function (s, v) { return s + v; }, 0) / scores.length;
      var min = Math.min.apply(null, scores);
      var max = Math.max.apply(null, scores);

      // Summary metrics row
      html += PR.renderMetrics([
        { value: _fmtScore(avg), label: t('reports.mobile.report.breakdown.avg', 'Average'), color: _scoreColor(avg) },
        { value: _fmtScore(max), label: t('reports.mobile.report.breakdown.best', 'Best'), color: _scoreColor(max) },
        { value: _fmtScore(min), label: t('reports.mobile.report.breakdown.lowest', 'Lowest'), color: _scoreColor(min) }
      ]);

      // Per-device table with progress bars
      var rows = items.map(function (item) {
        var safe = Math.max(0, Math.min(100, item.score));
        var barColor = safe >= 90 ? '#22c55e' : safe >= 70 ? '#eab308' : '#ef4444';
        var bar = '<div style="display:flex;align-items:center;gap:8px;">' +
          '<div style="flex:1;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;">' +
            '<div style="width:' + safe + '%;height:100%;background:' + barColor + ';border-radius:4px;"></div>' +
          '</div>' +
          '<strong>' + _fmtScore(safe) + '</strong>' +
        '</div>';
        return [esc(item.name), bar];
      });

      html += PR.renderTable(
        [
          { label: t('reports.mobile.report.overview.table.device', 'Device'), width: '30%' },
          { label: t('seo.report.table.value', 'Value'), width: '70%' }
        ],
        rows,
        { striped: true }
      );

      // Spread callout
      var spread = max - min;
      if (spread > 0) {
        html += '<p class="pdf-text-muted pdf-text-small" style="margin-top:4px;">' +
          esc(t('reports.mobile.report.breakdown.spread', 'Score spread: {{spread}} points (best {{best}}/100, lowest {{lowest}}/100)', { spread: _fmtScore(spread), best: _fmtScore(max), lowest: _fmtScore(min) })) +
        '</p>';
      }

      return html;
    }


    /* ===================================================================
       1. Mobile Overview
       =================================================================== */
    (function () {
      var sec = document.querySelector('#section-overview .pdf-section__content');
      var score = data.mobileScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.overview', 'Mobile Overview'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.overview', 'Mobile optimization is critical as over 60% of web traffic comes from mobile devices and Google uses mobile-first indexing. This overview presents your aggregate mobile score and key performance indicators across tested device configurations. A strong mobile experience directly impacts search rankings, user engagement, and conversion rates.')) + '</p>';

      // Primary metrics row (matching web UI summary donuts)
      var overviewMetrics = [];
      overviewMetrics.push({
        value: score !== undefined && score !== null ? score : '-',
        label: t('reports.mobile.report.overview.overallScore', 'Overall Score'),
        color: _scoreColor(score)
      });
      overviewMetrics.push({
        value: deviceKeys.length,
        label: t('reports.mobile.report.overview.devicesTested', 'Devices Tested')
      });

      var perfAvg = perfSummary.average !== undefined ? perfSummary.average : (perfSummary.avgScore !== undefined ? perfSummary.avgScore : '-');
      overviewMetrics.push({
        value: perfAvg !== undefined && perfAvg !== null && perfAvg !== '-' ? perfAvg : (primaryDevice.performance ? primaryDevice.performance.score || '-' : '-'),
        label: t('reports.mobile.report.overview.avgPerformance', 'Avg Performance'),
        color: _scoreColor(perfAvg)
      });

      html += PR.renderMetrics(overviewMetrics);

      // Category averages (matching web UI summary donuts: Performance, Readability, Accessibility)
      var catMetrics = [];
      if (readSummary.average !== undefined) {
        catMetrics.push({ value: readSummary.average, label: t('reports.mobile.readability', 'Readability'), color: _scoreColor(readSummary.average) });
      }
      if (a11ySummary.average !== undefined) {
        catMetrics.push({ value: a11ySummary.average, label: t('reports.mobile.accessibility', 'Accessibility'), color: _scoreColor(a11ySummary.average) });
      }
      if (touchSummary.average !== undefined) {
        catMetrics.push({ value: touchSummary.average + '%', label: t('reports.mobile.touchTargets', 'Touch Targets') });
      }
      if (catMetrics.length > 0) {
        html += PR.renderMetrics(catMetrics);
      }

      // Issues / Recommendations summary
      var highIssues = recommendations.filter(function (r) { return r.severity === 'high' || r.severity === 'error'; }).length;
      html += PR.renderMetrics([
        { value: highIssues, label: t('reports.common.issuesFound', 'Issues Found'), color: highIssues > 0 ? '#ef4444' : '#10b981' },
        { value: recommendations.length, label: t('reports.common.recommendations', 'Recommendations') }
      ]);

      // Device summary table (enriched with more columns matching web UI)
      if (deviceKeys.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.overview.deviceSummary', 'Device Summary')) + '</h3>';
        var deviceRows = deviceKeys.map(function (key) {
          var dev = data.devices[key];
          if (dev.error) {
            return [
              '<strong>' + esc(dev.device || key) + '</strong>',
              PR.renderStatus('fail', t('reports.mobile.report.overview.error', 'Error')),
              '-', '-', '-'
            ];
          }
          var perf = dev.performance || {};
          var touch = dev.touchTargets || {};
          var read = dev.readability || {};
          var a11y = dev.accessibility || {};
          return [
            '<strong>' + esc(dev.device || key) + '</strong>',
            perf.score !== undefined && perf.score !== null
              ? '<span class="score-' + scoreClass(perf.score) + '">' + perf.score + '</span>'
              : '-',
            touch.compliancePercentage !== undefined ? touch.compliancePercentage + '%' : (touch.score !== undefined ? String(touch.score) : '-'),
            read.readabilityScore !== undefined ? String(read.readabilityScore) : (read.score !== undefined ? String(read.score) : '-'),
            a11y.a11yScore !== undefined ? String(a11y.a11yScore) : (a11y.score !== undefined ? String(a11y.score) : '-')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.mobile.report.overview.table.device', 'Device'), width: '20%' },
            { label: t('reports.mobile.report.overview.table.performance', 'Performance'), width: '20%' },
            { label: t('reports.mobile.report.overview.table.touchTargets', 'Touch Targets'), width: '20%' },
            { label: t('reports.mobile.report.overview.table.readability', 'Readability'), width: '20%' },
            { label: t('reports.mobile.report.overview.table.accessibility', 'Accessibility'), width: '20%' }
          ],
          deviceRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* ===================================================================
       2. Touch Targets
       =================================================================== */
    (function () {
      var sec = document.querySelector('#section-touch .pdf-section__content');
      var touch = primaryDevice.touchTargets || {};
      var score = touch.score !== undefined ? touch.score : touch.compliancePercentage;

      // Check across all devices for touch data
      var anyTouchData = deviceKeys.some(function (key) {
        var d = data.devices[key];
        return d && !d.error && d.touchTargets;
      });

      if (!touch.total && !touch.issues && !touch.issueDetails && !anyTouchData) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.touchTargets', 'Touch Targets'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.touch', 'Touch target sizing ensures interactive elements are easily tappable on touchscreen devices. Google recommends touch targets be at least 48x48 CSS pixels with adequate spacing. This section identifies elements that are too small or too close together, which can frustrate mobile users and increase error rates.')) + '</p>';

      // Touch target metrics
      // Service returns: total, compliant (count), issues (NUMBER = non-compliant count),
      // issueDetails (ARRAY of issue objects), compliancePercentage
      var nonCompliantCount = touch.nonCompliant || touch.tooSmall || (typeof touch.issues === 'number' ? touch.issues : 0);
      html += PR.renderMetrics([
        { value: touch.total || 0, label: t('reports.mobile.report.touch.totalTargets', 'Total Targets') },
        { value: touch.compliant || 0, label: t('reports.mobile.compliant', 'Compliant'), color: '#10b981' },
        { value: nonCompliantCount, label: t('reports.mobile.nonCompliant', 'Non-compliant'), color: nonCompliantCount > 0 ? '#ef4444' : '#10b981' },
        { value: touch.compliancePercentage !== undefined ? touch.compliancePercentage + '%' : '-', label: t('reports.mobile.report.touch.compliance', 'Compliance'), color: (touch.compliancePercentage || 0) >= 80 ? '#10b981' : '#f59e0b' }
      ]);

      // Progress bar
      if (touch.total > 0) {
        var passing = touch.compliant || ((touch.total || 0) - nonCompliantCount);
        if (passing < 0) passing = 0;
        html += PR.renderProgress(
          t('reports.mobile.report.touch.passingTargets', 'Passing Targets'),
          passing, touch.total
        );
      }

      // Per-device touch target comparison (web UI shows this)
      var touchDeviceRows = [];
      deviceKeys.forEach(function (key) {
        var dev = data.devices[key];
        if (!dev || dev.error || !dev.touchTargets) return;
        var dt = dev.touchTargets;
        var compliance = dt.compliancePercentage !== undefined ? dt.compliancePercentage + '%' : '-';
        var issueCount = typeof dt.issues === 'number' ? dt.issues : (dt.nonCompliant || 0);
        touchDeviceRows.push([
          '<strong>' + esc(dev.device || key) + '</strong>',
          compliance,
          String(issueCount),
          issueCount > 0
            ? PR.renderStatus('warning', t('reports.mobile.report.touch.hasIssues', 'Has Issues'))
            : PR.renderStatus('pass', t('performance.report.cwv.good', 'Good'))
        ]);
      });

      if (touchDeviceRows.length > 1) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.touch.perDevice', 'Per-Device Touch Compliance')) + '</h3>';
        html += PR.renderTable(
          [
            { label: t('reports.mobile.report.overview.table.device', 'Device'), width: '30%' },
            { label: t('reports.mobile.compliant', 'Compliant'), width: '20%' },
            { label: t('reports.mobile.report.touch.undersized', 'Undersized'), width: '20%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          touchDeviceRows,
          { striped: true }
        );
      }

      // Issues table
      // Service returns issueDetails (array of {element, role, text, width, height, minDimension})
      // and issues (number count). Prefer issueDetails array, fall back to issues if it's an array.
      var touchIssueList = Array.isArray(touch.issueDetails) ? touch.issueDetails : (Array.isArray(touch.issues) ? touch.issues : []);
      if (touchIssueList.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.touch.issuesHeading', 'Touch Target Issues')) + '</h3>';
        var issueRows = touchIssueList.slice(0, 20).map(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
          // Build descriptive text from issueDetails fields if no message/title
          if (!text && typeof issue === 'object') {
            var el = issue.element || '';
            var w = issue.width !== undefined ? issue.width : '';
            var h = issue.height !== undefined ? issue.height : '';
            text = el + (issue.text ? ' "' + issue.text + '"' : '') + (w || h ? ' (' + w + 'x' + h + 'px)' : '');
          }
          var severity = typeof issue === 'object' ? (issue.severity || 'warning') : 'warning';
          return [
            '<span class="pdf-issue__severity pdf-issue__severity--' + severity.toLowerCase() + '">' + esc(translateImpact(severity)) + '</span>',
            esc(truncate(text, 100))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.mobile.report.touch.table.severity', 'Severity'), width: '20%' },
            { label: t('reports.mobile.report.touch.table.issue', 'Issue'), width: '80%' }
          ],
          issueRows,
          { striped: true }
        );

        if (touchIssueList.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: touchIssueList.length - 20 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* ===================================================================
       3. Readability
       =================================================================== */
    (function () {
      var sec = document.querySelector('#section-readability .pdf-section__content');
      var read = primaryDevice.readability || {};
      var score = read.readabilityScore || read.score;

      // Check all devices
      var anyReadData = deviceKeys.some(function (key) {
        var d = data.devices[key];
        return d && !d.error && d.readability;
      });

      if (!read.fontSize && !read.totalElements && !read.issues && !anyReadData) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.readability', 'Readability'), readSummary.average || score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.readability', 'Mobile readability encompasses font sizing, line height, contrast, and text layout on small screens. Text that is too small, has poor contrast, or requires horizontal scrolling creates a poor reading experience. This section evaluates your content\'s readability across mobile viewport sizes.')) + '</p>';

      // Readability metrics
      // Service returns: totalElements, smallFontElements, smallFontPercentage,
      // goodLineHeight, goodLineHeightPercentage, readabilityScore
      // Also handle legacy fields: fontSize, lineHeight, contrast
      html += PR.renderMetrics([
        { value: read.readabilityScore !== undefined ? read.readabilityScore : (read.score || '-'), label: t('reports.mobile.report.readability.score', 'Readability Score'), color: _scoreColor(read.readabilityScore || read.score || 0) },
        { value: read.totalElements || '-', label: t('reports.mobile.elementsChecked', 'Elements checked') },
        { value: read.smallFontPercentage !== undefined ? read.smallFontPercentage + '%' : (read.fontSize || '-'), label: read.smallFontPercentage !== undefined ? t('reports.mobile.smallText', 'Small text') : t('reports.mobile.report.readability.fontSize', 'Font Size'), color: read.smallFontPercentage !== undefined ? (read.smallFontPercentage > 20 ? '#ef4444' : '#10b981') : undefined },
        { value: read.goodLineHeightPercentage !== undefined ? read.goodLineHeightPercentage + '%' : (read.lineHeight || '-'), label: read.goodLineHeightPercentage !== undefined ? t('reports.mobile.goodLineHeight', 'Good line height') : t('reports.mobile.report.readability.lineHeight', 'Line Height'), color: read.goodLineHeightPercentage !== undefined ? (read.goodLineHeightPercentage >= 80 ? '#10b981' : '#f59e0b') : undefined }
      ]);

      // Per-device score breakdown (matches web UI bars)
      var devBreakdown = _renderDeviceBreakdown('readability', 'readabilityScore', readSummary.average || 0);
      if (devBreakdown) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.readability.perDevice', 'Per-Device Readability Scores')) + '</h3>';
        html += devBreakdown;
      }

      // Readability details table — works with both service shape and legacy shape
      var readRows = [];
      if (read.totalElements !== undefined) {
        readRows.push([
          esc(t('reports.mobile.report.readability.totalElements', 'Total Elements')),
          '<strong>' + esc(String(read.totalElements)) + '</strong>',
          ''
        ]);
      }
      if (read.smallFontElements !== undefined) {
        var smallPct = read.smallFontPercentage !== undefined ? read.smallFontPercentage : 0;
        readRows.push([
          esc(t('reports.mobile.report.readability.smallFontElements', 'Small Font Elements')),
          '<strong>' + esc(String(read.smallFontElements)) + '</strong> (' + smallPct + '%)',
          smallPct <= 10
            ? PR.renderStatus('pass', t('performance.report.cwv.good', 'Good'))
            : smallPct <= 30
              ? PR.renderStatus('warning', t('performance.report.cwv.needsImprovement', 'Needs Improvement'))
              : PR.renderStatus('fail', t('performance.report.cwv.poor', 'Poor'))
        ]);
      }
      if (read.goodLineHeight !== undefined) {
        var glhPct = read.goodLineHeightPercentage !== undefined ? read.goodLineHeightPercentage : 0;
        readRows.push([
          esc(t('reports.mobile.goodLineHeight', 'Good line height')),
          '<strong>' + esc(String(read.goodLineHeight)) + '</strong> (' + glhPct + '%)',
          glhPct >= 80
            ? PR.renderStatus('pass', t('performance.report.cwv.good', 'Good'))
            : PR.renderStatus('warning', t('performance.report.cwv.needsImprovement', 'Needs Improvement'))
        ]);
      }
      // Legacy fields fallback
      if (read.fontSize && read.totalElements === undefined) {
        readRows.push([
          esc(t('reports.mobile.report.readability.fontSize', 'Font Size')),
          '<strong>' + esc(String(read.fontSize)) + '</strong>',
          parseFloat(read.fontSize) >= 16
            ? PR.renderStatus('pass', t('performance.report.cwv.good', 'Good'))
            : PR.renderStatus('fail', t('reports.mobile.report.readability.tooSmall', 'Too Small'))
        ]);
      }
      if (read.lineHeight && read.goodLineHeight === undefined) {
        readRows.push([
          esc(t('reports.mobile.report.readability.lineHeight', 'Line Height')),
          '<strong>' + esc(String(read.lineHeight)) + '</strong>',
          parseFloat(read.lineHeight) >= 1.4
            ? PR.renderStatus('pass', t('performance.report.cwv.good', 'Good'))
            : PR.renderStatus('warning', t('performance.report.cwv.needsImprovement', 'Needs Improvement'))
        ]);
      }
      if (read.contrast) {
        readRows.push([
          esc(t('reports.mobile.report.readability.contrast', 'Contrast')),
          '<strong>' + esc(String(read.contrast)) + '</strong>',
          parseFloat(read.contrast) >= 4.5
            ? PR.renderStatus('pass', t('performance.report.cwv.good', 'Good'))
            : PR.renderStatus('fail', t('performance.report.cwv.poor', 'Poor'))
        ]);
      }

      if (readRows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '30%' },
            { label: t('seo.report.table.value', 'Value'), width: '35%' },
            { label: t('seo.report.table.status', 'Status'), width: '35%' }
          ],
          readRows,
          { striped: true }
        );
      }

      // Cross-device readability insights (matches web UI extraInsights for readability)
      var readItems = [];
      deviceKeys.forEach(function (key) {
        var dev = data.devices[key];
        if (!dev || dev.error || !dev.readability || !dev.readability.totalElements) return;
        readItems.push({ name: dev.device || key, data: dev.readability });
      });
      if (readItems.length > 0) {
        var avgSmallFont = Math.round(readItems.reduce(function (s, i) { return s + (i.data.smallFontPercentage || 0); }, 0) / readItems.length);
        var avgLineHt = Math.round(readItems.reduce(function (s, i) { return s + (i.data.goodLineHeightPercentage || 0); }, 0) / readItems.length);
        var totalElements = readItems.reduce(function (s, i) { return s + (i.data.totalElements || 0); }, 0);
        var worst = readItems.slice().sort(function (a, b) { return (b.data.smallFontPercentage || 0) - (a.data.smallFontPercentage || 0); })[0];

        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.readability.insights', 'Readability Insights')) + '</h3>';
        html += PR.renderMetrics([
          { value: avgSmallFont + '%', label: t('reports.mobile.smallText', 'Small text'), color: avgSmallFont > 20 ? '#ef4444' : '#10b981' },
          { value: avgLineHt + '%', label: t('reports.mobile.goodLineHeight', 'Good line height'), color: avgLineHt >= 80 ? '#10b981' : '#f59e0b' },
          { value: totalElements, label: t('reports.mobile.elementsChecked', 'Elements checked') }
        ]);

        if (worst) {
          html += PR.renderCallout(
            t('reports.mobile.report.readability.worstDevice', 'Most Small Text'),
            t('reports.mobile.mostSmallTextOn', 'Most small text on') + ': ' + worst.name + ' (' + Math.round(worst.data.smallFontPercentage || 0) + '%)',
            'info'
          );
        }
      }

      // Issues list
      var readIssues = read.issues || [];
      if (readIssues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.readability.issuesHeading', 'Readability Issues')) + '</h3>';
        readIssues.slice(0, 15).forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
          var sev = typeof issue === 'object' ? (issue.severity || 'warning').toLowerCase() : 'warning';
          html += PR.renderIssue(text, sev);
        });
      }

      sec.innerHTML = html;
    })();

    /* ===================================================================
       4. Responsiveness
       =================================================================== */
    (function () {
      var sec = document.querySelector('#section-responsiveness .pdf-section__content');
      var resp = primaryDevice.responsiveness || {};
      var score = resp.score;

      if (!resp.viewport && !resp.issues && !resp.hasResponsiveDesign && resp.mediaQueries === undefined) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.responsiveness', 'Responsiveness'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.responsiveness', 'Responsive design ensures your layout adapts properly across different screen sizes and orientations. This section evaluates viewport configuration, media query usage, and layout behavior to identify issues that may cause content to overflow or display incorrectly on mobile devices.')) + '</p>';

      // Responsiveness details table
      // Service returns: { mediaQueries (NUMBER), hasResponsiveDesign (BOOL), breakpoints (ARRAY) }
      // Also handle legacy fields: viewport, horizontalScroll, contentOverflow
      var respRows = [];
      if (resp.viewport !== undefined) {
        respRows.push([
          esc(t('reports.mobile.report.responsiveness.viewport', 'Viewport Configured')),
          resp.viewport
            ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
            : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
        ]);
      }
      if (resp.hasResponsiveDesign !== undefined) {
        respRows.push([
          esc(t('reports.mobile.report.responsiveness.responsiveDesign', 'Responsive Design')),
          resp.hasResponsiveDesign
            ? PR.renderStatus('pass', t('seo.report.status.detected', 'Detected'))
            : PR.renderStatus('fail', t('reports.mobile.report.responsiveness.noMediaQueries', 'Not Detected'))
        ]);
      }
      if (resp.mediaQueries !== undefined) {
        // mediaQueries is a number (count) from the service, or boolean from legacy
        var mqCount = typeof resp.mediaQueries === 'number' ? resp.mediaQueries : (resp.mediaQueries ? 1 : 0);
        respRows.push([
          esc(t('reports.mobile.report.responsiveness.mediaQueries', 'Media Queries')),
          mqCount > 0
            ? PR.renderStatus('pass', String(mqCount) + ' ' + t('reports.mobile.detected', 'Detected'))
            : PR.renderStatus('warning', t('reports.mobile.report.responsiveness.noMediaQueries', 'Not Detected'))
        ]);
      }
      if (resp.breakpoints && Array.isArray(resp.breakpoints) && resp.breakpoints.length > 0) {
        respRows.push([
          esc(t('reports.mobile.report.responsiveness.breakpoints', 'Breakpoints Found')),
          '<strong>' + esc(String(resp.breakpoints.length)) + '</strong>'
        ]);
      }
      if (resp.horizontalScroll !== undefined) {
        respRows.push([
          esc(t('reports.mobile.report.responsiveness.horizontalScroll', 'Horizontal Scroll')),
          resp.horizontalScroll
            ? PR.renderStatus('fail', t('reports.mobile.report.responsiveness.detected', 'Detected'))
            : PR.renderStatus('pass', t('reports.mobile.report.responsiveness.none', 'None'))
        ]);
      }
      if (resp.contentOverflow !== undefined) {
        respRows.push([
          esc(t('reports.mobile.report.responsiveness.contentOverflow', 'Content Overflow')),
          resp.contentOverflow
            ? PR.renderStatus('fail', t('reports.mobile.report.responsiveness.detected', 'Detected'))
            : PR.renderStatus('pass', t('reports.mobile.report.responsiveness.none', 'None'))
        ]);
      }

      if (respRows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('seo.report.table.property', 'Property'), width: '40%' },
            { label: t('seo.report.table.status', 'Status'), width: '60%' }
          ],
          respRows,
          { striped: true }
        );
      }

      // Issues
      var respIssues = resp.issues || [];
      if (respIssues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.responsiveness.issuesHeading', 'Responsiveness Issues')) + '</h3>';
        respIssues.slice(0, 15).forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
          var sev = typeof issue === 'object' ? (issue.severity || 'medium').toLowerCase() : 'medium';
          html += PR.renderIssue(text, sev);
        });
      } else if (resp.hasResponsiveDesign) {
        html += PR.renderCallout(
          t('reports.mobile.report.responsiveness.allPassTitle', 'Fully Responsive'),
          t('reports.mobile.report.responsiveness.allPassBody', 'Your page adapts correctly to different screen sizes with no responsiveness issues detected.'),
          'tip'
        );
      } else if (resp.hasResponsiveDesign === false) {
        html += PR.renderCallout(
          t('reports.mobile.report.responsiveness.noResponsiveTitle', 'Not Responsive'),
          t('reports.mobile.report.responsiveness.noResponsiveBody', 'No responsive media queries were detected. Consider adding CSS media queries for different screen sizes.'),
          'info'
        );
      }

      sec.innerHTML = html;
    })();

    /* ===================================================================
       5. Viewport & PWA
       =================================================================== */
    (function () {
      var sec = document.querySelector('#section-viewport .pdf-section__content');
      var viewportMeta = primaryDevice.viewportMeta || primaryDevice.viewportMetaTag || {};
      var pwa = primaryDevice.pwaReadiness || {};

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.viewportPwa', 'Viewport & PWA'), viewportMeta.score || pwa.score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.viewport', 'Viewport meta configuration and Progressive Web App (PWA) readiness determine how your site behaves on mobile devices. A properly configured viewport prevents unwanted zooming and scaling. PWA features like a web manifest and service worker enable app-like experiences.')) + '</p>';

      // --- Viewport Meta ---
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.viewport.metaHeading', 'Viewport Meta Configuration')) + '</h3>';

      if (viewportMeta.score !== undefined) {
        html += PR.renderMetrics([
          { value: viewportMeta.score, label: t('reports.mobile.report.viewport.viewportScore', 'Viewport Score'), color: _scoreColor(viewportMeta.score) }
        ]);
      }

      // Service returns: { exists, content, parsed: { width, 'initial-scale', ... }, issues, score }
      var vpParsed = viewportMeta.parsed || {};
      var vpRows = [];
      vpRows.push([
        esc(t('reports.mobile.report.viewport.configured', 'Viewport Configured')),
        (viewportMeta.configured || viewportMeta.present || viewportMeta.exists)
          ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
          : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      var vpWidth = viewportMeta.width || vpParsed['width'] || vpParsed.width;
      if (vpWidth) {
        vpRows.push([
          esc(t('reports.mobile.report.viewport.width', 'Width')),
          '<strong>' + esc(String(vpWidth)) + '</strong>'
        ]);
      }
      var vpInitScale = viewportMeta.initialScale !== undefined ? viewportMeta.initialScale : (vpParsed['initial-scale'] || vpParsed.initialScale);
      if (vpInitScale !== undefined && vpInitScale !== null) {
        vpRows.push([
          esc(t('reports.mobile.report.viewport.initialScale', 'Initial Scale')),
          '<strong>' + esc(String(vpInitScale)) + '</strong>'
        ]);
      }

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '40%' },
          { label: t('seo.report.table.value', 'Value'), width: '60%' }
        ],
        vpRows,
        { striped: true }
      );

      // Viewport content code block (web UI shows this in a code-styled block)
      if (viewportMeta.content) {
        html += '<div class="pdf-fix-card__code-block" style="margin-top:8px;">' +
          '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--good">' +
            esc(t('reports.mobile.content', 'Content')) + '</div>' +
          '<pre class="pdf-fix-card__code-pre">' + esc(viewportMeta.content) + '</pre>' +
        '</div>';
      }

      // Viewport issues (web UI shows these)
      var vpIssues = viewportMeta.issues || [];
      if (vpIssues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.viewport.issuesHeading', 'Viewport Issues')) + '</h3>';
        vpIssues.forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.item || '');
          var sev = typeof issue === 'object' ? (issue.severity || issue.type || 'warning').toLowerCase() : 'warning';
          html += PR.renderIssue(text, sev);
        });
      } else if (viewportMeta.configured || viewportMeta.present || viewportMeta.exists) {
        html += PR.renderCallout(
          t('reports.mobile.noViewportIssues', 'No viewport issues detected'),
          t('reports.mobile.report.viewport.noIssuesBody', 'No viewport issues detected. The viewport meta tag is properly configured.'),
          'tip'
        );
      }

      // --- PWA Readiness ---
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.viewport.pwaHeading', 'PWA Readiness')) + '</h3>';

      html += PR.renderMetrics([
        {
          value: pwa.score !== undefined && pwa.score !== null ? pwa.score : '-',
          label: t('reports.mobile.report.viewport.pwaScore', 'PWA Score'),
          color: _scoreColor(pwa.score || 0)
        }
      ]);

      // Installable check (web UI shows this)
      // Service returns: hasManifest, serviceWorkerRegistered, isHttps, installable, checklist, score
      // Also handle legacy field names: manifest, serviceWorker, https
      var pwaRows = [];
      if (pwa.installable !== undefined) {
        pwaRows.push([
          esc(t('reports.mobile.installable', 'Installable')),
          pwa.installable
            ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
            : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
        ]);
      }
      var hasManifest = pwa.manifest || pwa.hasManifest;
      pwaRows.push([
        esc(t('reports.mobile.report.viewport.manifest', 'Web App Manifest')),
        hasManifest
          ? PR.renderStatus('pass', typeof pwa.manifest === 'string' ? pwa.manifest : t('seo.report.status.yes', 'Yes'))
          : PR.renderStatus('fail', t('reports.mobile.missingStatus', 'Missing'))
      ]);
      var hasServiceWorker = pwa.serviceWorker || pwa.serviceWorkerRegistered;
      pwaRows.push([
        esc(t('reports.mobile.report.viewport.serviceWorker', 'Service Worker')),
        hasServiceWorker
          ? PR.renderStatus('pass', typeof pwa.serviceWorker === 'string' ? pwa.serviceWorker : t('seo.report.status.yes', 'Yes'))
          : PR.renderStatus('fail', t('reports.mobile.notRegistered', 'Not registered'))
      ]);
      var hasHttps = pwa.https || pwa.isHttps;
      pwaRows.push([
        esc(t('reports.mobile.report.viewport.https', 'HTTPS')),
        hasHttps
          ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
          : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '40%' },
          { label: t('seo.report.table.status', 'Status'), width: '60%' }
        ],
        pwaRows,
        { striped: true }
      );

      // PWA checklist (web UI shows this detailed checklist)
      var checklist = pwa.checklist || [];
      if (checklist.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.pwaChecklist', 'PWA Checklist')) + '</h3>';
        var checkRows = checklist.map(function (item) {
          var status = item.status === 'pass' ? 'pass' : 'fail';
          return [
            PR.renderStatus(status, status === 'pass' ? '\u2713' : '\u2717'),
            esc(item.item || item.label || item.name || '')
          ];
        });
        html += PR.renderTable(
          [
            { label: t('seo.report.table.status', 'Status'), width: '15%' },
            { label: t('seo.report.table.property', 'Property'), width: '85%' }
          ],
          checkRows,
          { striped: true }
        );
      }

      // --- Dark Mode Support (expanded, matching web UI detail) ---
      var darkMode = primaryDevice.darkModeSupport || {};
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.darkModeSupport', 'Dark Mode Support')) + '</h3>';

      if (darkMode.score !== undefined) {
        html += PR.renderMetrics([
          { value: darkMode.score, label: t('reports.mobile.report.viewport.darkModeScore', 'Dark Mode Score'), color: _scoreColor(darkMode.score) }
        ]);
      }

      var dmRows = [];
      dmRows.push([
        esc(t('reports.mobile.darkModeSupported', 'Dark Mode Supported')),
        (darkMode.supported || darkMode.detected)
          ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
          : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      if (darkMode.hasMediaQuery !== undefined) {
        dmRows.push([
          esc(t('reports.mobile.prefersColorScheme', 'prefers-color-scheme')),
          darkMode.hasMediaQuery
            ? PR.renderStatus('pass', t('reports.mobile.detected', 'Detected'))
            : PR.renderStatus('fail', t('reports.mobile.notFound', 'Not found'))
        ]);
      }
      if (darkMode.hasColorSchemeMeta !== undefined) {
        dmRows.push([
          esc(t('reports.mobile.colorSchemeMeta', 'color-scheme meta')),
          darkMode.hasColorSchemeMeta
            ? PR.renderStatus('pass', esc(darkMode.colorSchemeValue || t('reports.mobile.present', 'Present')))
            : PR.renderStatus('fail', t('reports.mobile.missingStatus', 'Missing'))
        ]);
      }
      if (darkMode.hasThemeToggle !== undefined) {
        dmRows.push([
          esc(t('reports.mobile.themeToggle', 'Theme Toggle')),
          darkMode.hasThemeToggle
            ? PR.renderStatus('pass', t('reports.mobile.found', 'Found'))
            : PR.renderStatus('fail', t('reports.mobile.notFound', 'Not found'))
        ]);
      }
      if (darkMode.cssVariablesCount !== undefined) {
        dmRows.push([
          esc(t('reports.mobile.cssVariables', 'CSS Variables')),
          '<strong>' + esc(String(darkMode.cssVariablesCount)) + '</strong> ' + esc(t('reports.mobile.defined', 'defined'))
        ]);
      }

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '40%' },
          { label: t('seo.report.table.status', 'Status'), width: '60%' }
        ],
        dmRows,
        { striped: true }
      );

      if (!darkMode.supported && !darkMode.detected) {
        html += PR.renderCallout(
          t('reports.mobile.report.viewport.noDarkModeTitle', 'No Dark Mode'),
          t('reports.mobile.report.viewport.noDarkModeBody', 'Dark mode support was not detected. Consider adding prefers-color-scheme media query support.'),
          'info'
        );
      }

      sec.innerHTML = html;
    })();

    /* ===================================================================
       6. Mobile Accessibility
       =================================================================== */
    (function () {
      var sec = document.querySelector('#section-accessibility .pdf-section__content');
      var a11y = primaryDevice.accessibility || {};
      var score = a11y.a11yScore || a11y.score;

      // Check across all devices
      var anyA11yData = deviceKeys.some(function (key) {
        var d = data.devices[key];
        return d && !d.error && d.accessibility;
      });

      if (!a11y.issues && score === undefined && !anyA11yData) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.accessibility', 'Mobile Accessibility'), a11ySummary.average || score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.accessibility', 'Mobile accessibility focuses on ensuring your site is usable by people with disabilities on mobile devices. This includes touch target accessibility, screen reader compatibility, and gesture-based navigation support. Mobile-specific accessibility issues can affect a significant portion of your mobile audience.')) + '</p>';

      // Score metric
      html += PR.renderMetrics([
        {
          value: a11ySummary.average || score || '-',
          label: t('reports.mobile.report.accessibility.score', 'Accessibility Score'),
          color: _scoreColor(a11ySummary.average || score || 0)
        }
      ]);

      // Per-device breakdown (matches web UI bars)
      var a11yBreakdown = _renderDeviceBreakdown('accessibility', 'a11yScore', a11ySummary.average || 0);
      if (a11yBreakdown) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.accessibility.perDevice', 'Per-Device Accessibility Scores')) + '</h3>';
        html += a11yBreakdown;
      }

      // Cross-device accessibility insights (matches web UI extraInsights)
      var a11yItems = [];
      deviceKeys.forEach(function (key) {
        var dev = data.devices[key];
        if (!dev || dev.error || !dev.accessibility) return;
        a11yItems.push({ name: dev.device || key, data: dev.accessibility });
      });
      if (a11yItems.length > 0) {
        var totalImages = a11yItems.reduce(function (s, i) { return s + (i.data.totalImages || 0); }, 0);
        var missingAlt = a11yItems.reduce(function (s, i) { return s + (i.data.missingAlt || 0); }, 0);
        var headingIssueCount = a11yItems.filter(function (i) { return i.data.headingIssues; }).length;
        var altCoverage = totalImages ? Math.round(((totalImages - missingAlt) / totalImages) * 100) : 0;

        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.accessibility.insights', 'Accessibility Insights')) + '</h3>';
        html += PR.renderMetrics([
          { value: altCoverage + '%', label: t('reports.mobile.altCoverage', 'Alt coverage'), color: altCoverage >= 90 ? '#10b981' : altCoverage >= 70 ? '#f59e0b' : '#ef4444' },
          { value: missingAlt, label: t('reports.mobile.imagesMissingAlt', 'Images missing alt'), color: missingAlt > 0 ? '#ef4444' : '#10b981' },
          { value: headingIssueCount, label: t('reports.mobile.headingIssues', 'Heading issues'), color: headingIssueCount > 0 ? '#f59e0b' : '#10b981' }
        ]);
      }

      // Issues table
      // Service returns no issues array — build from missingAlt/headingIssues if present
      var a11yIssueList = a11y.issues || [];
      if (!Array.isArray(a11yIssueList) || a11yIssueList.length === 0) {
        a11yIssueList = [];
        if (a11y.missingAlt > 0) {
          a11yIssueList.push({ severity: 'error', message: t('reports.mobile.report.accessibility.missingAltIssue', '{{count}} images missing alt text', { count: a11y.missingAlt }) });
        }
        if (a11y.headingIssues) {
          a11yIssueList.push({ severity: 'warning', message: t('reports.mobile.report.accessibility.headingIssue', 'Heading hierarchy has gaps (skipped levels)') });
        }
      }
      if (a11yIssueList.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.accessibility.issuesHeading', 'Accessibility Issues')) + '</h3>';
        var issueRows = a11yIssueList.slice(0, 20).map(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
          var severity = typeof issue === 'object' ? (issue.severity || 'medium') : 'medium';
          return [
            '<span class="pdf-issue__severity pdf-issue__severity--' + severity.toLowerCase() + '">' + esc(translateImpact(severity)) + '</span>',
            esc(truncate(text, 100))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.mobile.report.accessibility.table.severity', 'Severity'), width: '20%' },
            { label: t('reports.mobile.report.accessibility.table.issue', 'Issue'), width: '80%' }
          ],
          issueRows,
          { striped: true }
        );

        if (a11yIssueList.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: a11yIssueList.length - 20 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('reports.mobile.report.accessibility.noneTitle', 'No Accessibility Issues'),
          t('reports.mobile.report.accessibility.noneBody', 'No mobile-specific accessibility issues were detected. Continue following WCAG best practices.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* ===================================================================
       7. Above the Fold
       =================================================================== */
    (function () {
      var sec = document.querySelector('#section-above-fold .pdf-section__content');
      var fold = primaryDevice.aboveTheFold || primaryDevice.aboveTheFoldContent || {};

      if (!fold.criticalContentScore && !fold.score && !fold.hasHeadline) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var foldScore = fold.criticalContentScore || fold.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.aboveTheFold', 'Above the Fold'), foldScore)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.aboveFold', 'Above the fold analysis evaluates the content visible without scrolling on mobile screens. A well-designed above-the-fold area includes a clear headline, hero image, and call-to-action to engage visitors immediately. This section checks for critical content elements and render-blocking resources that delay initial display.')) + '</p>';

      html += PR.renderMetrics([
        { value: foldScore || '-', label: t('reports.mobile.report.aboveFold.score', 'Above Fold Score'), color: _scoreColor(foldScore) }
      ]);

      var foldRows = [];
      if (fold.hasHeadline !== undefined) {
        foldRows.push([
          esc(t('reports.mobile.headlineH1H2', 'Headline (H1/H2)')),
          fold.hasHeadline
            ? PR.renderStatus('pass', t('reports.mobile.present', 'Present'))
            : PR.renderStatus('fail', t('reports.mobile.missingStatus', 'Missing'))
        ]);
      }
      if (fold.hasHeroImage !== undefined) {
        foldRows.push([
          esc(t('reports.mobile.heroImage', 'Hero Image')),
          fold.hasHeroImage
            ? PR.renderStatus('pass', t('reports.mobile.present', 'Present'))
            : PR.renderStatus('fail', t('reports.mobile.missingStatus', 'Missing'))
        ]);
      }
      if (fold.hasCTA !== undefined) {
        foldRows.push([
          esc(t('reports.mobile.callToAction', 'Call-to-Action')),
          fold.hasCTA
            ? PR.renderStatus('pass', t('reports.mobile.found', 'Found'))
            : PR.renderStatus('warning', t('reports.mobile.notDetected', 'Not detected'))
        ]);
      }
      if (fold.imageCount !== undefined) {
        foldRows.push([
          esc(t('reports.mobile.imagesAboveFold', 'Images Above Fold')),
          '<strong>' + esc(String(fold.imageCount)) + '</strong>'
        ]);
      }
      if (fold.visibleElements !== undefined) {
        foldRows.push([
          esc(t('reports.mobile.visibleContent', 'Visible Content')),
          '<strong>' + esc(String(fold.visibleElements)) + '</strong> ' + esc(t('reports.mobile.elements', 'elements'))
        ]);
      }
      if (fold.textElements !== undefined) {
        foldRows.push([
          esc(t('reports.mobile.textElements', 'Text Elements')),
          '<strong>' + esc(String(fold.textElements)) + '</strong>'
        ]);
      }
      if (fold.renderBlockingScripts !== undefined) {
        var rbColor = fold.renderBlockingScripts > 3 ? 'fail' : fold.renderBlockingScripts > 0 ? 'warning' : 'pass';
        foldRows.push([
          esc(t('reports.mobile.renderBlockingScripts', 'Render-blocking Scripts')),
          PR.renderStatus(rbColor, String(fold.renderBlockingScripts))
        ]);
      }

      if (foldRows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('seo.report.table.property', 'Property'), width: '40%' },
            { label: t('seo.report.table.status', 'Status'), width: '60%' }
          ],
          foldRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* ===================================================================
       8. Mobile SEO
       =================================================================== */
    (function () {
      var sec = document.querySelector('#section-mobile-seo .pdf-section__content');
      var seo = primaryDevice.mobileSEO || primaryDevice.mobileSeo || {};

      if (!seo.score && !seo.hasTitle && !seo.canonical) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.mobileSeo', 'Mobile SEO'), seo.score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.mobileSeo', 'Mobile SEO evaluates search engine optimization factors specific to mobile devices. This includes title tag length, meta description, viewport configuration, canonical URLs, structured data, click-to-call links, and heading hierarchy. Proper mobile SEO ensures your site is discoverable and ranks well in mobile search results.')) + '</p>';

      if (seo.score !== undefined) {
        html += PR.renderMetrics([
          { value: seo.score, label: t('reports.mobile.report.mobileSeo.score', 'Mobile SEO Score'), color: _scoreColor(seo.score) }
        ]);
      }

      var seoRows = [];
      if (seo.hasTitle !== undefined) {
        var titleDetail = seo.hasTitle
          ? (seo.titleLength ? seo.titleLength + ' ' + t('reports.mobile.chars', 'chars') : t('reports.mobile.present', 'Present'))
          : t('reports.mobile.missingStatus', 'Missing');
        seoRows.push([
          esc(t('reports.mobile.titleTag', 'Title Tag')),
          seo.hasTitle
            ? PR.renderStatus('pass', titleDetail)
            : PR.renderStatus('fail', titleDetail)
        ]);
      }
      if (seo.hasMetaDescription !== undefined) {
        var descDetail = seo.hasMetaDescription
          ? (seo.descriptionLength ? seo.descriptionLength + ' ' + t('reports.mobile.chars', 'chars') : t('reports.mobile.present', 'Present'))
          : t('reports.mobile.missingStatus', 'Missing');
        seoRows.push([
          esc(t('reports.mobile.metaDescription', 'Meta Description')),
          seo.hasMetaDescription
            ? PR.renderStatus('pass', descDetail)
            : PR.renderStatus('fail', descDetail)
        ]);
      }
      if (seo.hasViewport !== undefined) {
        seoRows.push([
          esc(t('reports.mobile.viewportMeta', 'Viewport Meta')),
          seo.hasViewport
            ? PR.renderStatus('pass', t('reports.mobile.present', 'Present'))
            : PR.renderStatus('fail', t('reports.mobile.missingStatus', 'Missing'))
        ]);
      }
      if (seo.hasCanonical !== undefined) {
        seoRows.push([
          esc(t('reports.mobile.canonicalUrl', 'Canonical URL')),
          seo.hasCanonical
            ? PR.renderStatus('pass', t('reports.mobile.set', 'Set'))
            : PR.renderStatus('warning', t('reports.mobile.missingStatus', 'Missing'))
        ]);
      }
      if (seo.structuredDataCount !== undefined) {
        seoRows.push([
          esc(t('reports.mobile.structuredData', 'Structured Data')),
          '<strong>' + esc(String(seo.structuredDataCount)) + '</strong> ' + esc(t('reports.mobile.schemas', 'schemas'))
        ]);
      }
      if (seo.clickToCallLinks !== undefined) {
        seoRows.push([
          esc(t('reports.mobile.clickToCallLinks', 'Click-to-Call Links')),
          '<strong>' + esc(String(seo.clickToCallLinks)) + '</strong>'
        ]);
      }
      if (seo.h1Count !== undefined) {
        var h1Status = seo.h1Count === 1 ? 'pass' : 'warning';
        var h1Label = seo.h1Count === 1
          ? '1 (' + t('reports.mobile.good', 'good') + ')'
          : seo.h1Count + ' (' + t('reports.mobile.shouldBeOne', 'should be 1') + ')';
        seoRows.push([
          esc(t('reports.mobile.h1Tags', 'H1 Tags')),
          PR.renderStatus(h1Status, h1Label)
        ]);
      }
      // Legacy fields
      if (seo.canonical !== undefined && seo.hasCanonical === undefined) {
        seoRows.push([
          esc(t('reports.mobile.canonicalUrl', 'Canonical URL')),
          seo.canonical
            ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
            : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
        ]);
      }
      if (seo.robotsMeta !== undefined) {
        seoRows.push([
          esc(t('reports.mobile.robotsMeta', 'Robots Meta')),
          seo.robotsMeta
            ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
            : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
        ]);
      }
      if (seo.structuredData !== undefined && seo.structuredDataCount === undefined) {
        seoRows.push([
          esc(t('reports.mobile.structuredData', 'Structured Data')),
          seo.structuredData
            ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
            : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
        ]);
      }

      if (seoRows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('seo.report.table.property', 'Property'), width: '40%' },
            { label: t('seo.report.table.status', 'Status'), width: '60%' }
          ],
          seoRows,
          { striped: true }
        );
      }

      // SEO issues
      var seoIssues = seo.issues || [];
      if (seoIssues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.common.issues', 'issues')) + '</h3>';
        seoIssues.slice(0, 15).forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.item || issue.message || '');
          var sev = typeof issue === 'object' ? (issue.type || issue.severity || 'warning').toLowerCase() : 'warning';
          html += PR.renderIssue(text, sev);
        });
      }

      sec.innerHTML = html;
    })();

    /* ===================================================================
       9. Input Fields
       =================================================================== */
    (function () {
      var sec = document.querySelector('#section-input-fields .pdf-section__content');
      var input = primaryDevice.inputAnalysis || primaryDevice.inputFields || {};

      if (!input.total && !input.score) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.inputFields', 'Input Fields'), input.score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.inputFields', 'Input field analysis evaluates how well form inputs are optimized for mobile devices. Proper input types (email, tel), autocomplete attributes, and associated labels make forms easier and faster to complete on mobile. This section checks for common mobile input optimization issues.')) + '</p>';

      if (input.score !== undefined) {
        html += PR.renderMetrics([
          { value: input.score, label: t('reports.mobile.report.inputFields.score', 'Input Fields Score'), color: _scoreColor(input.score) }
        ]);
      }

      var inputRows = [];
      if (input.total !== undefined) {
        inputRows.push([
          esc(t('reports.mobile.totalInputs', 'Total Inputs')),
          '<strong>' + esc(String(input.total)) + '</strong>'
        ]);
      }
      if (input.emailInputs !== undefined) {
        inputRows.push([
          esc(t('reports.mobile.emailInputs', 'Email Inputs (type=email)')),
          '<strong>' + esc(String(input.emailInputs)) + '</strong>'
        ]);
      }
      if (input.telInputs !== undefined) {
        inputRows.push([
          esc(t('reports.mobile.phoneInputs', 'Phone Inputs (type=tel)')),
          '<strong>' + esc(String(input.telInputs)) + '</strong>'
        ]);
      }
      if (input.autocompleteEnabled !== undefined || input.withAutocomplete !== undefined) {
        inputRows.push([
          esc(t('reports.mobile.autocompleteEnabled', 'Autocomplete Enabled')),
          '<strong>' + esc(String(input.autocompleteEnabled || input.withAutocomplete || 0)) + '</strong>'
        ]);
      }
      if (input.missingLabels !== undefined) {
        inputRows.push([
          esc(t('reports.mobile.missingLabels', 'Missing Labels')),
          input.missingLabels > 0
            ? PR.renderStatus('fail', String(input.missingLabels))
            : PR.renderStatus('pass', '0')
        ]);
      }
      if (input.withLabels !== undefined) {
        inputRows.push([
          esc(t('reports.mobile.withLabels', 'With labels')),
          '<strong>' + esc(String(input.withLabels)) + '</strong>'
        ]);
      }

      if (inputRows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('seo.report.table.property', 'Property'), width: '50%' },
            { label: t('seo.report.table.value', 'Value'), width: '50%' }
          ],
          inputRows,
          { striped: true }
        );
      }

      // Input field issues
      var inputIssues = input.issues || [];
      if (inputIssues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.optimizationSuggestions', 'Optimization Suggestions')) + '</h3>';
        inputIssues.slice(0, 15).forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : ((issue.field ? issue.field + ': ' : '') + (issue.issue || issue.message || ''));
          html += PR.renderIssue(text, 'warning');
        });
      } else if (input.total > 0) {
        html += PR.renderCallout(
          t('reports.mobile.inputFieldsWellOptimized', 'Input fields are well-optimized for mobile'),
          t('reports.mobile.report.inputFields.noIssuesBody', 'Input fields are well-optimized for mobile devices.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* ===================================================================
       10. Performance Metrics (per-device detail)
       =================================================================== */
    (function () {
      var sec = document.querySelector('#section-performance-metrics .pdf-section__content');

      // Check for performance data across devices
      var perfItems = [];
      deviceKeys.forEach(function (key) {
        var dev = data.devices[key];
        if (!dev || dev.error || !dev.performance) return;
        perfItems.push({ name: dev.device || key, data: dev.performance });
      });

      var perfMetrics = primaryDevice.performanceMetrics || {};

      if (perfItems.length === 0 && !perfMetrics.score) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.performanceMetrics', 'Performance Metrics'), perfSummary.average)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.performanceMetrics', 'Performance metrics measure how quickly your site loads and becomes interactive on mobile devices. Key metrics include First Paint, First Contentful Paint, DOM Content Loaded, and full page load time. These measurements are taken on each emulated device to identify performance variations across different mobile profiles.')) + '</p>';

      // Per-device score breakdown (matches web UI bars)
      var perfBreakdown = _renderDeviceBreakdown('performance', 'score', perfSummary.average || 0);
      if (perfBreakdown) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.perfMetrics.perDevice', 'Per-Device Performance Scores')) + '</h3>';
        html += perfBreakdown;
      }

      // Cross-device timing insights (matches web UI extraInsights for performance)
      if (perfItems.length > 0) {
        var avgDom = Math.round(perfItems.reduce(function (s, i) { return s + (i.data.domContentLoaded || 0); }, 0) / perfItems.length);
        var avgLoad = Math.round(perfItems.reduce(function (s, i) { return s + (i.data.loadComplete || 0); }, 0) / perfItems.length);
        var avgFcp = Math.round(perfItems.reduce(function (s, i) { return s + (i.data.firstContentfulPaint || 0); }, 0) / perfItems.length);
        var slowest = perfItems.slice().sort(function (a, b) { return (b.data.loadComplete || 0) - (a.data.loadComplete || 0); })[0];

        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.perfMetrics.timingInsights', 'Timing Insights')) + '</h3>';
        html += PR.renderMetrics([
          { value: avgDom + 'ms', label: t('reports.mobile.avgDomReady', 'Avg DOM ready') },
          { value: avgLoad + 'ms', label: t('reports.mobile.avgLoad', 'Avg load') },
          { value: avgFcp + 'ms', label: t('reports.mobile.avgFcp', 'Avg FCP') }
        ]);

        if (slowest) {
          html += PR.renderCallout(
            t('reports.mobile.slowestLoad', 'Slowest load'),
            slowest.name + ' (' + Math.round(slowest.data.loadComplete || 0) + 'ms)',
            'info'
          );
        }

        // Per-device detailed timing table (matches web UI device-by-device breakdown)
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.perfMetrics.detailedTimings', 'Detailed Per-Device Timings')) + '</h3>';
        var timingRows = perfItems.map(function (item) {
          var d = item.data;
          return [
            '<strong>' + esc(item.name) + '</strong>',
            d.firstPaint ? d.firstPaint + 'ms' : '-',
            d.firstContentfulPaint ? d.firstContentfulPaint + 'ms' : '-',
            d.domContentLoaded ? d.domContentLoaded + 'ms' : '-',
            d.loadComplete ? d.loadComplete + 'ms' : '-'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.mobile.report.overview.table.device', 'Device'), width: '20%' },
            { label: t('reports.mobile.firstPaintLabel', 'First Paint'), width: '20%' },
            { label: t('reports.mobile.firstContentfulPaint', 'First Contentful Paint'), width: '20%' },
            { label: t('reports.mobile.domContentLoadedLabel', 'DOM Content Loaded'), width: '20%' },
            { label: t('reports.mobile.pageLoadComplete', 'Page Load Complete'), width: '20%' }
          ],
          timingRows,
          { striped: true }
        );
      }

      // Legacy performanceMetrics object
      if (perfMetrics.score && perfItems.length === 0) {
        html += PR.renderMetrics([
          { value: perfMetrics.score, label: t('reports.mobile.report.perfMetrics.score', 'Performance Score'), color: _scoreColor(perfMetrics.score) }
        ]);

        var legacyRows = [];
        if (perfMetrics.loadTime) {
          legacyRows.push([esc(t('reports.mobile.loadTimeLabel', 'Load Time')), '<strong>' + esc(String(perfMetrics.loadTime)) + '</strong>']);
        }
        if (perfMetrics.domContentLoaded) {
          legacyRows.push([esc(t('reports.mobile.domContentLoadedLabel', 'DOM Content Loaded')), '<strong>' + esc(String(perfMetrics.domContentLoaded)) + '</strong>']);
        }
        if (perfMetrics.firstPaint) {
          legacyRows.push([esc(t('reports.mobile.firstPaintLabel', 'First Paint')), '<strong>' + esc(String(perfMetrics.firstPaint)) + '</strong>']);
        }
        if (legacyRows.length > 0) {
          html += PR.renderTable(
            [
              { label: t('seo.report.table.metric', 'Metric'), width: '40%' },
              { label: t('seo.report.table.value', 'Value'), width: '60%' }
            ],
            legacyRows,
            { striped: true }
          );
        }
      }

      sec.innerHTML = html;
    })();

    /* ===================================================================
       11. Recommendations (rich fix cards)
       =================================================================== */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.recommendations', 'Based on the mobile analysis, these recommendations target the most impactful improvements for mobile user experience, performance, and accessibility.')) + '</p>';

      if (recommendations.length > 0) {
        html += '<p class="pdf-text-muted" style="margin-bottom:16px;">' +
          esc(t('reports.mobile.mobileFixes', 'Mobile Fixes')) + ' \u2014 ' +
          t('reports.mobile.report.recs.improvementsFound', '{{count}} improvements found', { count: recommendations.length }) +
        '</p>';

        // Normalize severities and sort
        var normalizedRecs = recommendations.map(function (rec, idx) {
          var sev = rec.severity || rec.priority || 'medium';
          if (sev === 'error' || sev === 'critical') sev = 'high';
          if (sev === 'info') sev = 'low';
          return {
            title: rec.title || '',
            description: rec.description || rec.suggestion || '',
            suggestion: rec.suggestion || rec.description || '',
            category: rec.category || t('reports.mobile.mobileOptimization', 'Mobile Optimization'),
            severity: sev,
            impact: rec.impact || '',
            problematicCode: rec.problematicCode || '',
            snippet: rec.snippet || rec.fixedCode || '',
            steps: rec.steps || [],
            resources: rec.resources || [],
            id: idx
          };
        });

        // Sort: high first, then medium, then low
        var severityOrder = { high: 0, medium: 1, low: 2 };
        normalizedRecs.sort(function (a, b) {
          return (severityOrder[a.severity] || 1) - (severityOrder[b.severity] || 1);
        });

        // Render each fix card using the rich format (matching SEO _renderFixCard pattern)
        normalizedRecs.forEach(function (fix) {
          html += _renderMobileFixCard(fix, t, esc);
        });
      } else {
        html += PR.renderCallout(
          t('reports.mobile.report.recommendations.noneTitle', 'Excellent Mobile Experience'),
          t('reports.mobile.report.recommendations.noneBody', 'Your site provides a strong mobile experience. Continue monitoring for regressions as content and features change.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    // Hide empty sections
    document.querySelectorAll('.pdf-section').forEach(function (sec) {
      var content = sec.querySelector('.pdf-section__content');
      if (content && !content.innerHTML.trim()) {
        sec.style.display = 'none';
      }
    });
  });

  /* =========================================================================
     Rich Fix Card Renderer (mirrors SEO _renderFixCard pattern)
     ========================================================================= */
  function _renderMobileFixCard(fix, t, esc) {
    var severityLower = (fix.severity || 'medium').toLowerCase();

    var html = '<div class="pdf-fix-card">';

    // Header
    html += '<div class="pdf-fix-card__header">';
    var severityLabels = {
      high: t('reports.common.severity.high', 'High'),
      medium: t('reports.common.severity.medium', 'Medium'),
      low: t('reports.common.severity.low', 'Low')
    };
    var severityLabel = severityLabels[severityLower] || fix.severity;
    html += '<span class="pdf-fix-card__severity pdf-fix-card__severity--' + severityLower + '">' + esc(severityLabel) + '</span>';
    html += '<span class="pdf-fix-card__title">' + esc(fix.title) + '</span>';
    html += '<span class="pdf-fix-card__category">' + esc(fix.category) + '</span>';
    html += '</div>';

    // Body
    html += '<div class="pdf-fix-card__body">';

    // Description (may be multi-paragraph from suggestion)
    if (fix.description) {
      html += '<div class="pdf-fix-card__description">' + esc(fix.description) + '</div>';
    }

    // Impact statement
    var impact = fix.impact || _getMobileFixImpact(fix, t);
    if (impact) {
      html += '<div class="pdf-fix-card__impact">';
      html += '<strong>' + esc(t('reports.common.fix.expectedImpact', 'Expected Impact')) + ':</strong> ' + esc(impact);
      html += '</div>';
    }

    // Code comparison grid
    var codeExamples = _getMobileFixCode(fix, t);
    var problemCode = fix.problematicCode || codeExamples.problem;
    var solutionCode = fix.snippet || codeExamples.solution;

    if (problemCode || solutionCode) {
      html += '<div class="pdf-fix-card__code-grid">';

      if (problemCode) {
        html += '<div class="pdf-fix-card__code-block">';
        html += '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--bad">' +
          esc(t('reports.common.fix.currentIssue', 'Current Issue')) + '</div>';
        html += '<pre class="pdf-fix-card__code-pre">' + esc(problemCode) + '</pre>';
        html += '</div>';
      }

      if (solutionCode) {
        html += '<div class="pdf-fix-card__code-block">';
        html += '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--good">' +
          esc(t('reports.common.fix.recommendedFix', 'Recommended Fix')) + '</div>';
        html += '<pre class="pdf-fix-card__code-pre">' + esc(solutionCode) + '</pre>';
        html += '</div>';
      }

      html += '</div>'; // end code-grid
    }

    // Step-by-step guide
    var steps = fix.steps && fix.steps.length > 0 ? fix.steps : _getMobileFixSteps(fix, t);
    if (steps.length > 0) {
      html += '<div class="pdf-fix-card__steps">';
      html += '<div class="pdf-fix-card__steps-title">' +
        esc(t('reports.common.fix.stepByStepFix', 'Step-by-Step Fix:')) + '</div>';
      steps.forEach(function (step, idx) {
        html += '<div class="pdf-fix-card__step">';
        html += '<span class="pdf-fix-card__step-num">' + (idx + 1) + '</span>';
        html += '<span>' + esc(step) + '</span>';
        html += '</div>';
      });
      html += '</div>'; // end steps
    }

    // Resources table
    var resources = fix.resources || [];
    if (resources.length > 0) {
      html += '<div style="margin-top:8px;">';
      html += '<strong style="font-size:11px;">' + esc(t('reports.mobile.report.recs.resources', 'Resources')) + '</strong>';
      var resRows = resources.map(function (r) {
        return [
          '<strong>' + esc(r.title || r.name || '') + '</strong>',
          esc(r.description || r.purpose || ''),
          esc(r.url || r.link || '')
        ];
      });
      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '25%' },
          { label: t('reports.mobile.report.recs.description', 'Description'), width: '45%' },
          { label: t('reports.mobile.report.recs.link', 'Link'), width: '30%' }
        ],
        resRows,
        { striped: true }
      );
      html += '</div>';
    }

    html += '</div>'; // end body
    html += '</div>'; // end fix-card

    return html;
  }

  /* =========================================================================
     Code Example Lookup (mirrors getMobileFixCode in web UI)
     ========================================================================= */
  function _getMobileFixCode(fix, t) {
    var codeMap = {
      'Touch targets below WCAG minimum': {
        problem: '/* Current: Touch targets too small */\n.button, .link {\n  padding: 4px 8px;\n  font-size: 12px;\n}\n\n/* Issues: */\n/* ' + String.fromCharCode(0x2717) + ' Touch target smaller than 44' + String.fromCharCode(0x00d7) + '44px */\n/* ' + String.fromCharCode(0x2717) + ' Difficult to tap on mobile devices */\n/* ' + String.fromCharCode(0x2717) + ' Fails WCAG 2.5.5 Target Size */',
        solution: '/* Fixed: Proper touch target sizing */\n.button, .link {\n  min-height: 44px;\n  min-width: 44px;\n  padding: 12px 16px;\n  font-size: 16px;\n}\n\n/* Best practices: */\n/* ' + String.fromCharCode(0x2713) + ' Minimum 44' + String.fromCharCode(0x00d7) + '44px touch targets */\n/* ' + String.fromCharCode(0x2713) + ' 48' + String.fromCharCode(0x00d7) + '48px recommended for primary actions */\n/* ' + String.fromCharCode(0x2713) + ' 8px minimum spacing between targets */'
      },
      'Some text is too small on mobile': {
        problem: '/* Current: Text too small for mobile */\nbody {\n  font-size: 12px;\n}\n\np, span {\n  font-size: 10px;\n  line-height: 1.2;\n}\n\n/* Issues: */\n/* ' + String.fromCharCode(0x2717) + ' Base font under 16px causes zoom on iOS */\n/* ' + String.fromCharCode(0x2717) + ' Poor readability at arm\'s length */',
        solution: '/* Fixed: Mobile-friendly typography */\nbody {\n  font-size: 16px; /* Prevents iOS zoom */\n  -webkit-text-size-adjust: 100%;\n}\n\np, span {\n  font-size: 1rem; /* 16px base */\n  line-height: 1.5;\n}\n\n@media (max-width: 768px) {\n  body { font-size: 16px; }\n  h1 { font-size: 1.75rem; }\n  h2 { font-size: 1.5rem; }\n}'
      },
      'Mobile performance is below recommended': {
        problem: '<!-- Current: Unoptimized resources -->\n<head>\n  <link rel="stylesheet" href="/all-styles.css">\n  <script src="/bundle.js"></script>\n</head>\n\n<img src="/hero.png" width="1920">\n\n<!-- Issues: -->\n<!-- ' + String.fromCharCode(0x2717) + ' Render-blocking resources -->\n<!-- ' + String.fromCharCode(0x2717) + ' Unoptimized images -->\n<!-- ' + String.fromCharCode(0x2717) + ' No lazy loading -->',
        solution: '<!-- Fixed: Optimized for mobile -->\n<head>\n  <link rel="preload" as="image" href="/hero.webp">\n  <link rel="stylesheet" href="/critical.css">\n  <link rel="stylesheet" href="/styles.css"\n        media="print" onload="this.media=\'all\'">\n  <script src="/bundle.js" defer></script>\n</head>\n\n<img src="/hero.webp"\n     srcset="/hero-400.webp 400w, /hero-800.webp 800w"\n     sizes="(max-width: 768px) 100vw, 800px"\n     loading="lazy"\n     decoding="async">'
      },
      'Accessibility issues detected': {
        problem: '<!-- Current: Accessibility issues -->\n<img src="/photo.jpg">\n<div onclick="navigate()">Click here</div>\n<div class="heading">Important Title</div>\n\n<!-- Issues: -->\n<!-- ' + String.fromCharCode(0x2717) + ' Missing alt text on images -->\n<!-- ' + String.fromCharCode(0x2717) + ' Non-semantic clickable elements -->\n<!-- ' + String.fromCharCode(0x2717) + ' Incorrect heading structure -->',
        solution: '<!-- Fixed: Accessible markup -->\n<img src="/photo.jpg"\n     alt="Description of image content">\n\n<button type="button" onclick="navigate()">\n  Navigate to section\n</button>\n\n<h2>Important Title</h2>\n\n<!-- Best practices: -->\n<!-- ' + String.fromCharCode(0x2713) + ' Descriptive alt text -->\n<!-- ' + String.fromCharCode(0x2713) + ' Semantic HTML elements -->\n<!-- ' + String.fromCharCode(0x2713) + ' Proper heading hierarchy -->'
      }
    };

    return codeMap[fix.title] || {
      problem: '/* Current implementation */\n/* Review your ' + (fix.category || 'mobile') + ' setup */\n\n/* Issues detected: */\n/* ' + String.fromCharCode(0x2717) + ' ' + (fix.title || 'Optimization needed') + ' */',
      solution: '/* Recommended implementation */\n/* Apply ' + (fix.category || 'mobile') + ' best practices */\n\n/* Benefits: */\n/* ' + String.fromCharCode(0x2713) + ' Improved mobile experience */\n/* ' + String.fromCharCode(0x2713) + ' Better performance scores */\n/* ' + String.fromCharCode(0x2713) + ' Enhanced usability */'
    };
  }

  /* =========================================================================
     Impact Lookup (mirrors getMobileFixImpact in web UI)
     ========================================================================= */
  function _getMobileFixImpact(fix, t) {
    var impactMap = {
      'Performance': t('reports.mobile.impact.performance', 'Faster page load and improved Core Web Vitals scores'),
      'Readability': t('reports.mobile.impact.readability', 'Better user experience with improved text legibility'),
      'Touch Targets': t('reports.mobile.impact.touchTargets', 'Easier tap interactions for mobile users'),
      'Accessibility': t('reports.mobile.impact.accessibility', 'Better support for users with disabilities and assistive tech'),
      'Viewport': t('reports.mobile.impact.viewport', 'Proper scaling and layout on all device sizes'),
      'PWA': t('reports.mobile.impact.pwa', 'Enhanced mobile experience with app-like features')
    };
    return impactMap[fix.category] || t('reports.mobile.impact.default', 'Improved mobile user experience and engagement');
  }

  /* =========================================================================
     Step-by-Step Lookup (mirrors getMobileFixSteps in web UI)
     ========================================================================= */
  function _getMobileFixSteps(fix, t) {
    var stepsMap = {
      'Mobile performance is below recommended': [
        t('reports.mobile.steps.auditImages', 'Audit images and use modern formats (WebP, AVIF)'),
        t('reports.mobile.steps.minimizeJs', 'Minimize and defer non-critical JavaScript'),
        t('reports.mobile.steps.enableCompression', 'Enable compression and browser caching'),
        t('reports.mobile.steps.useCdn', 'Use a Content Delivery Network (CDN)')
      ],
      'Some text is too small on mobile': [
        t('reports.mobile.steps.setFontSize', 'Set body font-size to at least 16px'),
        t('reports.mobile.steps.useRelativeUnits', 'Use relative units (rem/em) instead of fixed pixels'),
        t('reports.mobile.steps.testOnDevices', 'Test on actual devices at arm\\')
      ],
      'Touch targets below WCAG minimum': [
        t('reports.mobile.steps.increaseButtonSize', 'Increase button/link size to at least 44x44 pixels'),
        t('reports.mobile.steps.addPadding', 'Add padding around interactive elements'),
        t('reports.mobile.steps.ensureSpacing', 'Ensure adequate spacing between tap targets')
      ],
      'Accessibility issues detected': [
        t('reports.mobile.steps.addAltText', 'Add descriptive alt text to all images'),
        t('reports.mobile.steps.ensureHeadingHierarchy', 'Ensure proper heading hierarchy (h1, h2, h3)'),
        t('reports.mobile.steps.checkContrast', 'Check color contrast meets WCAG AA standards (4.5:1)')
      ]
    };
    return stepsMap[fix.title] || [
      t('reports.mobile.steps.reviewImplementation', 'Review current implementation'),
      t('reports.mobile.steps.applyChanges', 'Apply the recommended changes'),
      t('reports.mobile.steps.testMultipleDevices', 'Test on multiple mobile devices'),
      t('reports.mobile.steps.verifyImprovement', 'Verify the improvement')
    ];
  }

})(window);
