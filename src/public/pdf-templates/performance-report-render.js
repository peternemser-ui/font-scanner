/**
 * Performance Report — PDF Renderer
 * Renders all performance analysis sections into the PDF template.
 * Detects mode from data shape: Quick, CWV, or Full.
 *
 * Sections:
 *   1. Core Web Vitals (desktop + mobile + comparison table)
 *   2. Lighthouse Category Scores
 *   3. Dimensional Grades (A-F letter grades)
 *   4. Cross-Browser / Device Comparison
 *   5. Resource Analysis
 *   6. Network Performance
 *   7. Caching & Optimization
 *   8. Recommendations (rich fix cards)
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[performance-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('performance', function renderPerformance(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;

    var sectionIndex = 1;

    // ---- Detect data mode: CWV vs Full Performance ----
    // CWV shape: desktop.lcp is an OBJECT { value, displayValue, score, rating }
    // Full shape: desktop.coreWebVitals.lcp is a STRING like "2.42s"
    var rawDesktop = data.desktop || {};
    var rawMobile = data.mobile || {};
    var isCwvMode = (rawDesktop.lcp && typeof rawDesktop.lcp === 'object' && rawDesktop.lcp.displayValue !== undefined);

    // Save originals for CWV per-metric deep-dives (before normalization overwrites them)
    var cwvOrigDesktop = null;
    var cwvOrigMobile = null;

    // ---- Normalize CWV-mode data into Performance-mode shape ----
    if (isCwvMode) {
      cwvOrigDesktop = rawDesktop;
      cwvOrigMobile = rawMobile;

      // Build normalized coreWebVitals from CWV-mode desktop
      var _normCwv = function (dev) {
        if (!dev) return {};
        var lcpObj = dev.lcp || {};
        var clsObj = dev.cls || {};
        var inpObj = dev.inp || {};
        var add = dev.additionalMetrics || {};
        return {
          score: dev.score || 0,
          lcp: lcpObj.displayValue || ((lcpObj.value || 0) / 1000).toFixed(2) + 's',
          lcpMs: lcpObj.value || 0,
          cls: clsObj.displayValue || String(clsObj.value || 0),
          clsNum: clsObj.value || 0,
          fid: inpObj.displayValue || (inpObj.value || 0) + 'ms',
          fidMs: inpObj.value || 0,
          fcp: add.fcp ? add.fcp.displayValue : undefined,
          ttfb: undefined
        };
      };
      var dCwv = _normCwv(rawDesktop);
      var mCwv = _normCwv(rawMobile);

      // Wrap into Full-mode compatible shape (preserve original lighthouse if present)
      rawDesktop = {
        performanceScore: rawDesktop.score || 0,
        coreWebVitals: dCwv,
        lighthouse: cwvOrigDesktop.lighthouse || {}
      };
      rawMobile = {
        performanceScore: rawMobile.score || 0,
        coreWebVitals: mCwv,
        lighthouse: cwvOrigMobile ? (cwvOrigMobile.lighthouse || {}) : {}
      };

      // Set top-level performanceScore if missing
      if (!data.performanceScore && data.score) {
        data.performanceScore = typeof data.score === 'object' ? data.score.overall : data.score;
      }
    }

    // ---- Extract data sources ----
    var desktop = rawDesktop;
    var mobile = rawMobile;
    var cwv = desktop.coreWebVitals || data.coreWebVitals || {};
    var mobileCwv = mobile.coreWebVitals || {};
    var resources = data.resources || {};
    var network = data.network || {};
    var caching = data.caching || {};
    var desktopLH = desktop.lighthouse || {};
    var mobileLH = mobile.lighthouse || {};

    // Cross-browser data (browsers.desktop / browsers.mobile shape)
    var browsers = data.browsers || {};
    var browserDesktop = browsers.desktop || {};
    var browserMobile = browsers.mobile || {};
    var comparison = data.comparison || {};

    // Dimensional grades
    var dimensionalGrades = data.dimensionalGrades || null;

    /* =====================================================================
       Helper functions
       ===================================================================== */

    /** CWV badge color based on thresholds */
    function cwvColor(metric, value) {
      if (metric === 'lcp') return value <= 2500 ? '#10b981' : value <= 4000 ? '#f59e0b' : '#ef4444';
      if (metric === 'fid' || metric === 'inp') return value <= 200 ? '#10b981' : value <= 500 ? '#f59e0b' : '#ef4444';
      if (metric === 'cls') return value <= 0.1 ? '#10b981' : value <= 0.25 ? '#f59e0b' : '#ef4444';
      if (metric === 'ttfb') return value <= 800 ? '#10b981' : value <= 1800 ? '#f59e0b' : '#ef4444';
      if (metric === 'fcp') return value <= 1800 ? '#10b981' : value <= 3000 ? '#f59e0b' : '#ef4444';
      return '#6b7280';
    }

    /** CWV textual label */
    function cwvLabel(metric, value) {
      var thresholds = {
        lcp: [2500, 4000],
        fid: [100, 300],
        inp: [200, 500],
        cls: [0.1, 0.25],
        ttfb: [800, 1800],
        fcp: [1800, 3000]
      };
      var th = thresholds[metric] || [0, 0];
      if (value <= th[0]) return t('performance.report.cwv.good', 'Good');
      if (value <= th[1]) return t('performance.report.cwv.needsImprovement', 'Needs Improvement');
      return t('performance.report.cwv.poor', 'Poor');
    }

    /** Inline HTML status badge for CWV metric */
    function cwvStatusBadge(metric, value) {
      var color = cwvColor(metric, value);
      var label = cwvLabel(metric, value);
      return '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;color:#fff;background:' + color + ';">' + esc(label) + '</span>';
    }

    /** Like PR.renderMetrics but allows raw HTML in values (for inline badges) */
    function _renderMetricsRaw(metrics) {
      var html = '<div class="pdf-metrics-row">';
      metrics.forEach(function (m) {
        html += '<div class="pdf-metric">' +
          '<div class="pdf-metric__value" style="' + (m.color ? 'color:' + m.color : '') + '">' + String(m.value) + '</div>' +
          '<div class="pdf-metric__label">' + esc(m.label) + '</div>' +
        '</div>';
      });
      html += '</div>';
      return html;
    }

    /** Grade letter to color */
    function gradeColor(grade) {
      if (!grade) return '#6b7280';
      var g = String(grade).charAt(0).toUpperCase();
      if (g === 'A') return '#10b981';
      if (g === 'B') return '#3b82f6';
      if (g === 'C') return '#f59e0b';
      if (g === 'D') return '#f97316';
      return '#ef4444'; // F
    }

    /** Grade assessment text */
    function gradeAssessment(grade) {
      if (!grade) return '';
      var g = String(grade).charAt(0).toUpperCase();
      if (g === 'A') return t('performance.report.gradeAssessment.excellent', 'Excellent');
      if (g === 'B') return t('performance.report.gradeAssessment.good', 'Good');
      if (g === 'C') return t('performance.report.gradeAssessment.fair', 'Needs Improvement');
      if (g === 'D') return t('performance.report.gradeAssessment.poor', 'Poor');
      return t('performance.report.gradeAssessment.critical', 'Critical');
    }

    /** Parse a CWV metric string to ms number */
    function _parseCwvMs(val) {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      var s = String(val).trim();
      if (s.indexOf('ms') !== -1) return parseFloat(s) || 0;
      if (s.indexOf('s') !== -1) return (parseFloat(s) || 0) * 1000;
      return parseFloat(s) || 0;
    }

    /** Build a CWV metric value with inline badge */
    function _cwvValueWithBadge(metric, displayValue, rawMs) {
      return esc(String(displayValue)) + ' ' + cwvStatusBadge(metric, rawMs);
    }

    /* =====================================================================
       1. Core Web Vitals
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-cwv .pdf-section__content');
      if (!cwv.lcp && !cwv.lcpMs && !cwv.score && !mobileCwv.lcp && !mobileCwv.lcpMs) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = cwv.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.coreWebVitals', 'Core Web Vitals'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.cwv', 'Core Web Vitals are Google\'s key metrics for measuring real-world user experience. They focus on loading performance (LCP), interactivity (FID/INP), and visual stability (CLS). Scores are compared against Google\'s thresholds for Good, Needs Improvement, and Poor performance. Meeting the Good thresholds for all three metrics is essential for optimal search rankings.')) + '</p>';

      // ---- Desktop CWV metrics with status badges ----
      html += '<h3 class="pdf-subsection__title">' + esc(t('common.desktop', 'Desktop')) + '</h3>';
      var desktopMetrics = [];
      if (cwv.lcp || cwv.lcpMs) {
        var lcpMs = cwv.lcpMs || parseFloat(cwv.lcp) * 1000 || 0;
        var lcpDisplay = cwv.lcp || (lcpMs / 1000).toFixed(2) + 's';
        desktopMetrics.push({ value: _cwvValueWithBadge('lcp', lcpDisplay, lcpMs), label: 'LCP', color: cwvColor('lcp', lcpMs) });
      }
      if (cwv.fid || cwv.fidMs) {
        var fidVal = cwv.fidMs || parseFloat(cwv.fid) || 0;
        desktopMetrics.push({ value: _cwvValueWithBadge('fid', cwv.fid || cwv.fidMs + 'ms', fidVal), label: 'FID', color: cwvColor('fid', fidVal) });
      }
      if (cwv.cls !== undefined) {
        var clsNum = cwv.clsNum || parseFloat(cwv.cls) || 0;
        desktopMetrics.push({ value: _cwvValueWithBadge('cls', cwv.cls, clsNum), label: 'CLS', color: cwvColor('cls', clsNum) });
      }
      if (cwv.ttfb) {
        var ttfbMs = _parseCwvMs(cwv.ttfb);
        desktopMetrics.push({ value: _cwvValueWithBadge('ttfb', cwv.ttfb, ttfbMs), label: 'TTFB', color: cwvColor('ttfb', ttfbMs) });
      }
      if (cwv.fcp) {
        var fcpMs = _parseCwvMs(cwv.fcp);
        desktopMetrics.push({ value: _cwvValueWithBadge('fcp', cwv.fcp, fcpMs), label: 'FCP', color: cwvColor('fcp', fcpMs) });
      }
      if (desktopMetrics.length > 0) {
        html += _renderMetricsRaw(desktopMetrics);
      }

      // ---- Site Health Score ----
      if (data.siteHealthScore) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.siteHealth', 'Site Health')) + '</h3>';
        html += PR.renderMetrics([
          { value: data.siteHealthScore, label: t('performance.report.siteHealthScore', 'Site Health Score'), color: utils.scoreColor(data.siteHealthScore) }
        ]);
      }

      // ---- Mobile CWV if available ----
      if (mobileCwv.lcp || mobileCwv.lcpMs || mobileCwv.fid || mobileCwv.fidMs || mobileCwv.cls !== undefined) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('common.mobile', 'Mobile')) + '</h3>';
        var mobileMetrics = [];
        if (mobileCwv.lcp || mobileCwv.lcpMs) {
          var mLcpMs = mobileCwv.lcpMs || parseFloat(mobileCwv.lcp) * 1000 || 0;
          var mLcpDisplay = mobileCwv.lcp || (mLcpMs / 1000).toFixed(2) + 's';
          mobileMetrics.push({ value: _cwvValueWithBadge('lcp', mLcpDisplay, mLcpMs), label: 'LCP', color: cwvColor('lcp', mLcpMs) });
        }
        if (mobileCwv.fid || mobileCwv.fidMs) {
          var mFidVal = mobileCwv.fidMs || parseFloat(mobileCwv.fid) || 0;
          mobileMetrics.push({ value: _cwvValueWithBadge('fid', mobileCwv.fid || mobileCwv.fidMs + 'ms', mFidVal), label: 'FID', color: cwvColor('fid', mFidVal) });
        }
        if (mobileCwv.cls !== undefined) {
          var mClsNum = mobileCwv.clsNum || parseFloat(mobileCwv.cls) || 0;
          mobileMetrics.push({ value: _cwvValueWithBadge('cls', mobileCwv.cls, mClsNum), label: 'CLS', color: cwvColor('cls', mClsNum) });
        }
        if (mobileCwv.ttfb) {
          var mTtfbMs = _parseCwvMs(mobileCwv.ttfb);
          mobileMetrics.push({ value: _cwvValueWithBadge('ttfb', mobileCwv.ttfb, mTtfbMs), label: 'TTFB', color: cwvColor('ttfb', mTtfbMs) });
        }
        if (mobileCwv.fcp) {
          var mFcpMs = _parseCwvMs(mobileCwv.fcp);
          mobileMetrics.push({ value: _cwvValueWithBadge('fcp', mobileCwv.fcp, mFcpMs), label: 'FCP', color: cwvColor('fcp', mFcpMs) });
        }
        if (mobileMetrics.length > 0) {
          html += _renderMetricsRaw(mobileMetrics);
        }
      }

      // ---- Desktop vs Mobile CWV Comparison Table ----
      var hasMobileCwv = (mobileCwv.lcp || mobileCwv.lcpMs || mobileCwv.cls !== undefined);
      var hasDesktopCwv = (cwv.lcp || cwv.lcpMs || cwv.cls !== undefined);
      if (hasDesktopCwv && hasMobileCwv) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.cwv.comparisonTitle', 'Desktop vs Mobile CWV Comparison')) + '</h3>';

        // Build row data
        var dLcpMs = cwv.lcpMs || parseFloat(cwv.lcp) * 1000 || 0;
        var mLcpMsC = mobileCwv.lcpMs || parseFloat(mobileCwv.lcp) * 1000 || 0;
        var dFidVal = cwv.fidMs || parseFloat(cwv.fid) || 0;
        var mFidValC = mobileCwv.fidMs || parseFloat(mobileCwv.fid) || 0;
        var dClsNum = cwv.clsNum || parseFloat(cwv.cls) || 0;
        var mClsNumC = mobileCwv.clsNum || parseFloat(mobileCwv.cls) || 0;
        var dTtfbMs = _parseCwvMs(cwv.ttfb);
        var mTtfbMsC = _parseCwvMs(mobileCwv.ttfb);
        var dFcpMs = _parseCwvMs(cwv.fcp);
        var mFcpMsC = _parseCwvMs(mobileCwv.fcp);

        var compRows = [];
        // LCP
        compRows.push([
          '<strong>LCP</strong>',
          esc(cwv.lcp || (dLcpMs / 1000).toFixed(2) + 's') + ' ' + cwvStatusBadge('lcp', dLcpMs),
          esc(mobileCwv.lcp || (mLcpMsC / 1000).toFixed(2) + 's') + ' ' + cwvStatusBadge('lcp', mLcpMsC),
          '&lt; 2.5s'
        ]);
        // FID
        compRows.push([
          '<strong>FID</strong>',
          esc(cwv.fid || dFidVal + 'ms') + ' ' + cwvStatusBadge('fid', dFidVal),
          esc(mobileCwv.fid || mFidValC + 'ms') + ' ' + cwvStatusBadge('fid', mFidValC),
          '&lt; 100ms'
        ]);
        // CLS
        compRows.push([
          '<strong>CLS</strong>',
          esc(String(cwv.cls !== undefined ? cwv.cls : '-')) + ' ' + cwvStatusBadge('cls', dClsNum),
          esc(String(mobileCwv.cls !== undefined ? mobileCwv.cls : '-')) + ' ' + cwvStatusBadge('cls', mClsNumC),
          '&lt; 0.1'
        ]);
        // TTFB
        compRows.push([
          '<strong>TTFB</strong>',
          esc(cwv.ttfb || (dTtfbMs ? dTtfbMs + 'ms' : '-')) + (dTtfbMs ? ' ' + cwvStatusBadge('ttfb', dTtfbMs) : ''),
          esc(mobileCwv.ttfb || (mTtfbMsC ? mTtfbMsC + 'ms' : '-')) + (mTtfbMsC ? ' ' + cwvStatusBadge('ttfb', mTtfbMsC) : ''),
          '&lt; 800ms'
        ]);
        // FCP
        compRows.push([
          '<strong>FCP</strong>',
          esc(cwv.fcp || (dFcpMs ? (dFcpMs / 1000).toFixed(2) + 's' : '-')) + (dFcpMs ? ' ' + cwvStatusBadge('fcp', dFcpMs) : ''),
          esc(mobileCwv.fcp || (mFcpMsC ? (mFcpMsC / 1000).toFixed(2) + 's' : '-')) + (mFcpMsC ? ' ' + cwvStatusBadge('fcp', mFcpMsC) : ''),
          '&lt; 1.8s'
        ]);

        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '15%' },
            { label: t('common.desktop', 'Desktop'), width: '30%' },
            { label: t('common.mobile', 'Mobile'), width: '30%' },
            { label: t('performance.report.cwv.target', 'Target'), width: '15%' }
          ],
          compRows,
          { striped: true }
        );
      }

      // ---- Per-Metric Deep Dives (CWV mode only) ----
      if (isCwvMode && cwvOrigDesktop) {
        // Device Score Overview
        var dDevScore = cwvOrigDesktop.score || desktop.performanceScore || 0;
        var mDevScore = cwvOrigMobile ? (cwvOrigMobile.score || mobile.performanceScore || 0) : 0;
        html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.cwv.deviceScores', 'Device Performance Scores')) + '</h3>';
        var devScoreItems = [
          { value: dDevScore + '/100', label: t('common.desktop', 'Desktop'), color: utils.scoreColor(dDevScore) }
        ];
        if (mDevScore > 0) {
          devScoreItems.push({ value: mDevScore + '/100', label: t('common.mobile', 'Mobile'), color: utils.scoreColor(mDevScore) });
        }
        var perfGapCwv = Math.abs(dDevScore - mDevScore);
        if (perfGapCwv > 0) {
          devScoreItems.push({ value: perfGapCwv + ' pts', label: t('performance.report.cwv.gap', 'Gap'), color: perfGapCwv > 10 ? '#f59e0b' : '#10b981' });
        }
        html += PR.renderMetrics(devScoreItems);

        // Performance gap callout
        if (perfGapCwv > 10) {
          html += PR.renderCallout(
            t('performance.report.crossBrowser.gapWarningTitle', 'Performance Gap Detected'),
            t('performance.report.cwv.gapWarningBody', 'There is a {{gap}} point difference between desktop ({{desktop}}) and mobile ({{mobile}}) performance. Mobile users may experience degraded speed.', { gap: perfGapCwv, desktop: dDevScore, mobile: mDevScore }),
            'warning'
          );
        }

        // LCP Deep Dive
        html += _renderCwvDeepDive(
          'LCP',
          t('performance.report.cwv.lcpFull', 'Largest Contentful Paint'),
          cwvOrigDesktop.lcp,
          cwvOrigMobile ? cwvOrigMobile.lcp : null,
          '\u2264 2.5s', 5000, false,
          t('performance.report.cwv.lcpTip', 'Optimize images (WebP/AVIF, lazy-load below fold), preload hero images, reduce server response time, minimize render-blocking CSS/JS.'),
          t, esc
        );

        // CLS Deep Dive
        html += _renderCwvDeepDive(
          'CLS',
          t('performance.report.cwv.clsFull', 'Cumulative Layout Shift'),
          cwvOrigDesktop.cls,
          cwvOrigMobile ? cwvOrigMobile.cls : null,
          '\u2264 0.1', 0.5, true,
          t('performance.report.cwv.clsTip', 'Set explicit width/height on images and embeds, avoid inserting content above existing content, reserve space for ads and dynamic content.'),
          t, esc
        );

        // INP/TBT Deep Dive
        var origInpD = cwvOrigDesktop.inp || {};
        var origInpM = cwvOrigMobile ? (cwvOrigMobile.inp || {}) : null;
        html += _renderCwvDeepDive(
          'INP/TBT',
          t('performance.report.cwv.inpFull', 'Interaction to Next Paint'),
          origInpD,
          origInpM,
          '\u2264 200ms', 600, false,
          t('performance.report.cwv.inpTip', 'Break up long JavaScript tasks, use web workers for heavy computation, optimize event handlers, reduce main thread work.'),
          t, esc
        );

        // TBT sub-detail if available
        if (origInpD.tbt) {
          html += '<div style="margin-top:4px;padding:8px 12px;background:#f3f4f6;border-radius:6px;font-size:0.78rem;">';
          html += '<strong>TBT (Total Blocking Time):</strong> ';
          html += esc(t('common.desktop', 'Desktop')) + ': <span style="font-weight:700;">' + esc(origInpD.tbt.displayValue || origInpD.tbt.value + 'ms') + '</span>';
          if (origInpM && origInpM.tbt) {
            html += ' \u2014 ' + esc(t('common.mobile', 'Mobile')) + ': <span style="font-weight:700;">' + esc(origInpM.tbt.displayValue || origInpM.tbt.value + 'ms') + '</span>';
          }
          html += '</div>';
        }

        // FCP detail if available
        var addDesktop = cwvOrigDesktop.additionalMetrics || {};
        var addMobile = cwvOrigMobile ? (cwvOrigMobile.additionalMetrics || {}) : {};
        if (addDesktop.fcp || addMobile.fcp) {
          html += _renderCwvDeepDive(
            'FCP',
            t('performance.report.cwv.fcpFull', 'First Contentful Paint'),
            addDesktop.fcp || null,
            addMobile.fcp || null,
            '\u2264 1.8s', 3000, false,
            t('performance.report.cwv.fcpTip', 'Eliminate render-blocking resources, inline critical CSS, preconnect to required origins, reduce server response time.'),
            t, esc
          );
        }

        // Issues
        var cwvIssues = data.issues || [];
        if (cwvIssues.length > 0) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.cwv.issuesTitle', 'Issues Identified')) + '</h3>';
          cwvIssues.forEach(function (issue) {
            var issueText = typeof issue === 'string' ? issue : (issue.message || issue.issue || JSON.stringify(issue));
            var isWarning = (issueText.indexOf('CRITICAL') !== -1 || issueText.indexOf('\u274c') !== -1 || issueText.indexOf('\u26a0') !== -1);
            html += PR.renderCallout('', issueText, isWarning ? 'warning' : 'tip');
          });
        }

        // Field data comparison context
        var fieldComp = data.comparison || {};
        if (fieldComp.context) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.cwv.dataContext', 'Data Context')) + '</h3>';
          html += PR.renderCallout(
            '',
            fieldComp.context + (fieldComp.note ? ' ' + fieldComp.note : ''),
            'tip'
          );
        }
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       2. Lighthouse Category Scores
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-lighthouse .pdf-section__content');
      if (!desktopLH.performance && !mobileLH.performance) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.report.lighthouse.title', 'Lighthouse Category Scores'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.lighthouse', 'Lighthouse provides automated auditing across Performance, Accessibility, Best Practices, and SEO categories. Each category score reflects adherence to web development best practices. This section shows the scores for each Lighthouse audit category as measured during the analysis.')) + '</p>';

      var cats = [
        { key: 'performance', label: t('performance.performanceScore', 'Performance Score') },
        { key: 'accessibility', label: t('accessibility.title', 'Accessibility Analyzer') },
        { key: 'bestPractices', label: t('performance.report.lighthouse.bestPractices', 'Best Practices') },
        { key: 'seo', label: 'SEO' }
      ];

      // Desktop scores
      if (desktopLH.performance !== undefined) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('common.desktop', 'Desktop')) + '</h3>';
        html += '<div class="pdf-score-grid">';
        cats.forEach(function (cat) {
          var val = desktopLH[cat.key];
          if (val === undefined || val === null) return;
          html += '<div class="pdf-score-card">' +
            '<div class="pdf-score-card__label">' + esc(cat.label) + '</div>' +
            '<div class="pdf-score-card__value score-' + scoreClass(val) + '">' + val + '</div>' +
          '</div>';
        });
        html += '</div>';
      }

      // Mobile scores
      if (mobileLH.performance !== undefined) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('common.mobile', 'Mobile')) + '</h3>';
        html += '<div class="pdf-score-grid">';
        cats.forEach(function (cat) {
          var val = mobileLH[cat.key];
          if (val === undefined || val === null) return;
          html += '<div class="pdf-score-card">' +
            '<div class="pdf-score-card__label">' + esc(cat.label) + '</div>' +
            '<div class="pdf-score-card__value score-' + scoreClass(val) + '">' + val + '</div>' +
          '</div>';
        });
        html += '</div>';
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       3. Dimensional Grades (A-F letter grades)
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-dimensional-grades .pdf-section__content');
      if (!dimensionalGrades) {
        sec.parentElement.style.display = 'none';
        return;
      }

      // Check there is at least one grade
      var gradeKeys = Object.keys(dimensionalGrades);
      if (gradeKeys.length === 0) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.report.dimensionalGrades.title', 'Multi-Dimensional Analysis'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.dimensionalGrades', 'This section provides a multi-dimensional view of your site\\')) + '</p>';

      // Dimension label map
      var dimensionLabels = {
        performance: t('performance.report.dimensionalGrades.performance', 'Performance'),
        resources: t('performance.report.dimensionalGrades.resources', 'Resources'),
        caching: t('performance.report.dimensionalGrades.caching', 'Caching'),
        network: t('performance.report.dimensionalGrades.network', 'Network'),
        webVitals: t('performance.report.dimensionalGrades.webVitals', 'Web Vitals')
      };

      // Metric cards for each grade
      var gradeMetrics = [];
      gradeKeys.forEach(function (key) {
        var grade = dimensionalGrades[key];
        gradeMetrics.push({
          value: grade,
          label: dimensionLabels[key] || key,
          color: gradeColor(grade)
        });
      });
      if (gradeMetrics.length > 0) {
        html += PR.renderMetrics(gradeMetrics);
      }

      // Detailed table: Dimension | Grade | Assessment
      var gradeRows = [];
      gradeKeys.forEach(function (key) {
        var grade = dimensionalGrades[key];
        var color = gradeColor(grade);
        gradeRows.push([
          '<strong>' + esc(dimensionLabels[key] || key) + '</strong>',
          '<span style="font-size:1.1rem;font-weight:700;color:' + color + ';">' + esc(grade) + '</span>',
          esc(gradeAssessment(grade))
        ]);
      });

      html += PR.renderTable(
        [
          { label: t('performance.report.dimensionalGrades.dimension', 'Dimension'), width: '35%' },
          { label: t('performance.report.dimensionalGrades.grade', 'Grade'), width: '20%' },
          { label: t('performance.report.dimensionalGrades.assessment', 'Assessment'), width: '45%' }
        ],
        gradeRows,
        { striped: true }
      );

      sec.innerHTML = html;
    })();

    /* =====================================================================
       4. Cross-Browser / Device Comparison
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-cross-browser .pdf-section__content');
      var hasBrowserData = (browserDesktop.performanceScore !== undefined || browserMobile.performanceScore !== undefined);
      if (!hasBrowserData) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.report.crossBrowser.title', 'Cross-Browser / Device Comparison'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.crossBrowser', 'This section compares performance between desktop and mobile environments. Mobile users often experience slower performance due to network conditions and device constraints. Understanding the gap between desktop and mobile helps prioritize optimization efforts for the platform most of your visitors use.')) + '</p>';

      // Desktop vs Mobile overall performance score metrics
      var crossMetrics = [];
      if (browserDesktop.performanceScore !== undefined) {
        crossMetrics.push({ value: browserDesktop.performanceScore, label: t('performance.report.crossBrowser.desktopScore', 'Desktop Score'), color: utils.scoreColor(browserDesktop.performanceScore) });
      }
      if (browserMobile.performanceScore !== undefined) {
        crossMetrics.push({ value: browserMobile.performanceScore, label: t('performance.report.crossBrowser.mobileScore', 'Mobile Score'), color: utils.scoreColor(browserMobile.performanceScore) });
      }
      if (crossMetrics.length > 0) {
        html += PR.renderMetrics(crossMetrics);
      }

      // Side-by-side Lighthouse category comparison table
      var dPerf = browserDesktop.performanceScore;
      var mPerf = browserMobile.performanceScore;
      var dA11y = browserDesktop.accessibilityScore;
      var mA11y = browserMobile.accessibilityScore;
      var dBP = browserDesktop.bestPracticesScore;
      var mBP = browserMobile.bestPracticesScore;
      var dSEO = browserDesktop.seoScore;
      var mSEO = browserMobile.seoScore;

      if (dPerf !== undefined && mPerf !== undefined) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.crossBrowser.lighthouseComparison', 'Lighthouse Category Comparison')) + '</h3>';

        var lhRows = [];
        var lhCats = [
          { label: t('performance.performanceScore', 'Performance Score'), d: dPerf, m: mPerf },
          { label: t('accessibility.title', 'Accessibility Analyzer'), d: dA11y, m: mA11y },
          { label: t('performance.report.lighthouse.bestPractices', 'Best Practices'), d: dBP, m: mBP },
          { label: 'SEO', d: dSEO, m: mSEO }
        ];

        lhCats.forEach(function (cat) {
          if (cat.d === undefined && cat.m === undefined) return;
          var dVal = cat.d !== undefined ? cat.d : '-';
          var mVal = cat.m !== undefined ? cat.m : '-';
          var gap = (typeof cat.d === 'number' && typeof cat.m === 'number') ? Math.abs(cat.d - cat.m) : '-';
          var gapColor = (typeof gap === 'number' && gap > 10) ? '#f59e0b' : '#10b981';
          lhRows.push([
            '<strong>' + esc(cat.label) + '</strong>',
            '<span style="color:' + (typeof cat.d === 'number' ? utils.scoreColor(cat.d) : '#6b7280') + ';font-weight:600;">' + dVal + '</span>',
            '<span style="color:' + (typeof cat.m === 'number' ? utils.scoreColor(cat.m) : '#6b7280') + ';font-weight:600;">' + mVal + '</span>',
            '<span style="color:' + gapColor + ';font-weight:600;">' + gap + '</span>'
          ]);
        });

        html += PR.renderTable(
          [
            { label: t('performance.report.crossBrowser.category', 'Category'), width: '30%' },
            { label: t('common.desktop', 'Desktop'), width: '20%' },
            { label: t('common.mobile', 'Mobile'), width: '20%' },
            { label: t('performance.report.crossBrowser.gap', 'Gap'), width: '15%' }
          ],
          lhRows,
          { striped: true }
        );
      }

      // Performance gap alert callout
      var perfGap = comparison.performanceGap || (typeof dPerf === 'number' && typeof mPerf === 'number' ? Math.abs(dPerf - mPerf) : 0);
      if (perfGap > 10) {
        html += PR.renderCallout(
          t('performance.report.crossBrowser.gapWarningTitle', 'Performance Gap Detected'),
          t('performance.report.crossBrowser.gapWarningBody', '{{gap}} point difference between desktop and mobile performance. Mobile users may have a significantly degraded experience. Prioritize mobile-specific optimizations.', { gap: perfGap }),
          'warning'
        );
      } else if (perfGap > 0) {
        html += PR.renderCallout(
          t('performance.report.crossBrowser.gapTipTitle', 'Consistent Cross-Device Performance'),
          t('performance.report.crossBrowser.gapTipBody', 'The performance gap between desktop and mobile is {{gap}} points, which is within an acceptable range.', { gap: perfGap }),
          'tip'
        );
      }

      // Per-device CWV details
      var bdCwv = (browserDesktop.metrics && browserDesktop.metrics.coreWebVitals) ? browserDesktop.metrics.coreWebVitals : null;
      var bmCwv = (browserMobile.metrics && browserMobile.metrics.coreWebVitals) ? browserMobile.metrics.coreWebVitals : null;

      if (bdCwv || bmCwv) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.crossBrowser.perDeviceCwv', 'Per-Device Core Web Vitals')) + '</h3>';

        var cwvDeviceRows = [];
        var cwvMetricNames = ['lcp', 'fid', 'cls'];
        var cwvMetricLabels = { lcp: 'LCP', fid: 'FID', cls: 'CLS' };

        cwvMetricNames.forEach(function (metricName) {
          var dVal = bdCwv ? (bdCwv[metricName] || '-') : '-';
          var mVal = bmCwv ? (bmCwv[metricName] || '-') : '-';
          var dMs = bdCwv ? _parseCwvMs(bdCwv[metricName]) : 0;
          var mMs = bmCwv ? _parseCwvMs(bmCwv[metricName]) : 0;

          cwvDeviceRows.push([
            '<strong>' + cwvMetricLabels[metricName] + '</strong>',
            esc(String(dVal)) + (dMs > 0 || metricName === 'cls' ? ' ' + cwvStatusBadge(metricName, metricName === 'cls' ? dMs : dMs) : ''),
            esc(String(mVal)) + (mMs > 0 || metricName === 'cls' ? ' ' + cwvStatusBadge(metricName, metricName === 'cls' ? mMs : mMs) : '')
          ]);
        });

        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '20%' },
            { label: t('common.desktop', 'Desktop'), width: '40%' },
            { label: t('common.mobile', 'Mobile'), width: '40%' }
          ],
          cwvDeviceRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       5. Resource Analysis
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-resources .pdf-section__content');
      if (!resources.javascript && !resources.css && !resources.breakdown && !resources.images) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = resources.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.resourceAnalysis', 'Resource Analysis'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.resources', 'Resource analysis examines the composition of your page — scripts, stylesheets, images, fonts, and other assets. Understanding your resource breakdown helps identify optimization opportunities. Reducing the number and size of resources directly improves load times and Core Web Vitals scores.')) + '</p>';

      // Summary metrics
      html += PR.renderMetrics([
        { value: data.totalRequests || 0, label: t('performance.requests', 'Requests') },
        { value: data.pageSize || '-', label: t('performance.pageSize', 'Page Size') },
        { value: data.loadTime || '-', label: t('performance.loadTime', 'Load Time') }
      ]);

      // Resource breakdown table with extended columns
      var types = ['javascript', 'css', 'images', 'fonts', 'other'];
      var totalSize = 0;
      var resEntries = [];

      types.forEach(function (type) {
        var r = resources[type];
        if (!r) return;
        var size = r.size || 0;
        totalSize += size;
        resEntries.push({ type: type, count: r.count || 0, size: size, sizeFormatted: r.sizeFormatted || _formatBytes(size) });
      });

      if (resEntries.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.resources.breakdownHeading', 'Resource Breakdown')) + '</h3>';

        var resRows = [];
        resEntries.forEach(function (entry) {
          var avgSize = entry.count > 0 ? _formatBytes(entry.size / entry.count) : '-';
          var pct = totalSize > 0 ? Math.round((entry.size / totalSize) * 100) + '%' : '0%';
          resRows.push([
            '<strong>' + esc(entry.type.charAt(0).toUpperCase() + entry.type.slice(1)) + '</strong>',
            String(entry.count),
            esc(entry.sizeFormatted),
            esc(avgSize),
            pct
          ]);
        });

        html += PR.renderTable(
          [
            { label: t('performance.report.resources.table.type', 'Type'), width: '20%' },
            { label: t('performance.report.resources.table.count', 'Files'), width: '15%' },
            { label: t('performance.report.resources.table.size', 'Size'), width: '20%' },
            { label: t('performance.report.resources.table.avgSize', 'Avg Size'), width: '20%' },
            { label: t('performance.report.resources.table.pctTotal', '% of Total'), width: '15%' }
          ],
          resRows,
          { striped: true }
        );
      }

      // Optimization tips based on thresholds
      var tips = [];
      if (resources.javascript && resources.javascript.size && resources.javascript.size > 300 * 1024) {
        tips.push(t('performance.report.resources.tips.jsLarge', 'JavaScript exceeds 300KB. Consider code-splitting, tree-shaking, and deferring non-critical scripts.'));
      }
      if (resources.images && resources.images.size && resources.images.size > 1024 * 1024) {
        tips.push(t('performance.report.resources.tips.imagesLarge', 'Images exceed 1MB. Use WebP/AVIF formats, responsive srcset, and lazy loading for below-the-fold images.'));
      }
      if (resources.css && resources.css.size && resources.css.size > 100 * 1024) {
        tips.push(t('performance.report.resources.tips.cssLarge', 'CSS exceeds 100KB. Remove unused styles, inline critical CSS, and defer non-critical stylesheets.'));
      }
      if (resources.fonts && resources.fonts.count && resources.fonts.count > 4) {
        tips.push(t('performance.report.resources.tips.tooManyFonts', 'More than 4 font files detected. Reduce font variants and use font-display: swap.'));
      }

      if (tips.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.resources.optimizationTips', 'Optimization Tips')) + '</h3>';
        tips.forEach(function (tip) {
          html += PR.renderCallout('', tip, 'warning');
        });
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       6. Network Performance
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-network .pdf-section__content');
      if (!network.ttfb && !network.requests && !network.dns) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = network.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.report.network.title', 'Network Performance'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.network', 'Network performance metrics measure how quickly your server responds and delivers content. Time to First Byte (TTFB) indicates server processing speed, while DNS lookup and SSL negotiation times reveal connection overhead. Optimizing these metrics requires attention to both server configuration and network infrastructure.')) + '</p>';

      // Timing table with description column
      var timingItems = [
        { key: 'ttfb', label: t('performance.report.network.ttfb', 'Time To First Byte'), desc: t('performance.report.network.ttfbDesc', 'Time from request to first byte received from server') },
        { key: 'dns', label: t('performance.report.network.dns', 'DNS Lookup'), desc: t('performance.report.network.dnsDesc', 'Time to resolve domain name to IP address') },
        { key: 'ssl', label: t('performance.report.network.ssl', 'SSL Negotiation'), desc: t('performance.report.network.sslDesc', 'Time to establish secure TLS connection') },
        { key: 'connectionTime', label: t('performance.report.network.connection', 'Connection Time'), desc: t('performance.report.network.connectionDesc', 'Time to establish TCP connection') },
        { key: 'domInteractive', label: t('performance.report.network.domInteractive', 'DOM Interactive'), desc: t('performance.report.network.domInteractiveDesc', 'Time until DOM is parsed and ready for interaction') },
        { key: 'domContentLoaded', label: t('performance.report.network.domContentLoaded', 'DOM Content Loaded'), desc: t('performance.report.network.domContentLoadedDesc', 'Time until DOM and deferred scripts are loaded') }
      ];

      var timingRows = [];
      timingItems.forEach(function (item) {
        if (!network[item.key]) return;
        timingRows.push([
          '<strong>' + esc(item.label) + '</strong>',
          esc(item.desc),
          esc(network[item.key])
        ]);
      });

      if (timingRows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '25%' },
            { label: t('performance.report.network.description', 'Description'), width: '45%' },
            { label: t('seo.report.table.value', 'Value'), width: '20%' }
          ],
          timingRows,
          { striped: true }
        );
      }

      // Metrics
      html += PR.renderMetrics([
        { value: network.requests || 0, label: t('performance.requests', 'Requests') },
        { value: network.ttfb || '-', label: 'TTFB' }
      ]);

      // TTFB-based insight callouts
      var ttfbMs = _parseCwvMs(network.ttfb);
      if (ttfbMs > 0) {
        if (ttfbMs < 200) {
          html += PR.renderCallout(
            t('performance.report.network.ttfbExcellentTitle', 'Excellent Server Response'),
            t('performance.report.network.ttfbExcellentBody', 'Your TTFB is under 200ms, indicating excellent server performance and efficient backend processing.'),
            'tip'
          );
        } else if (ttfbMs < 600) {
          html += PR.renderCallout(
            t('performance.report.network.ttfbAcceptableTitle', 'Acceptable Server Response'),
            t('performance.report.network.ttfbAcceptableBody', 'Your TTFB is under 600ms. Consider server-side caching, CDN, or database optimization to bring it under 200ms.'),
            'tip'
          );
        } else {
          html += PR.renderCallout(
            t('performance.report.network.ttfbSlowTitle', 'Slow Server Response'),
            t('performance.report.network.ttfbSlowBody', 'Your TTFB exceeds 600ms. This significantly impacts page load times. Investigate server-side bottlenecks, enable caching, and consider a CDN.'),
            'warning'
          );
        }
      }

      // High request count warning
      var reqCount = network.requests || data.totalRequests || 0;
      if (reqCount > 50) {
        html += PR.renderCallout(
          t('performance.report.network.highRequestsTitle', 'High Request Count'),
          t('performance.report.network.highRequestsBody', 'Your page makes {{count}} requests. Consider bundling assets, removing unused resources, and lazy-loading below-the-fold content to reduce request count below 50.', { count: reqCount }),
          'warning'
        );
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       7. Caching & Optimization
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-caching .pdf-section__content');
      if (!caching.total && !caching.cacheHitRate) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = caching.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.report.caching.title', 'Caching & Optimization'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.caching', 'Effective caching reduces server load and dramatically improves repeat-visit performance. Properly configured cache headers ensure browsers store and reuse static resources. This section evaluates your caching strategy, identifying resources that could benefit from longer cache durations.')) + '</p>';

      // Cache hit rate progress bar
      if (caching.total > 0) {
        html += PR.renderProgress(
          t('performance.report.caching.hitRateLabel', 'Cache Hit Rate'),
          caching.cached || 0, caching.total
        );
      }

      // Metrics
      html += PR.renderMetrics([
        { value: caching.cached || 0, label: t('performance.report.caching.cachedLabel', 'Cached Resources'), color: '#10b981' },
        { value: caching.notCached || 0, label: t('performance.report.caching.notCachedLabel', 'Not Cached'), color: (caching.notCached || 0) > 0 ? '#f59e0b' : '#10b981' },
        { value: caching.cacheHitRate || '0%', label: t('performance.report.caching.hitRateLabel', 'Cache Hit Rate') }
      ]);

      // Cache strategy breakdown table
      if (caching.strategies && Array.isArray(caching.strategies) && caching.strategies.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.caching.strategyBreakdown', 'Cache Strategy Breakdown')) + '</h3>';

        var stratRows = [];
        caching.strategies.forEach(function (s) {
          stratRows.push([
            '<strong>' + esc(s.name || s.type || '-') + '</strong>',
            esc(String(s.count || 0)),
            esc(s.policy || s.cacheControl || '-')
          ]);
        });

        html += PR.renderTable(
          [
            { label: t('performance.report.caching.strategy', 'Strategy'), width: '35%' },
            { label: t('performance.report.resources.table.count', 'Files'), width: '20%' },
            { label: t('performance.report.caching.policy', 'Policy'), width: '45%' }
          ],
          stratRows,
          { striped: true }
        );
      }

      // Performance-based recommendations (4 tiers based on cache hit rate)
      var hitRate = parseFloat(caching.cacheHitRate) || 0;
      if (caching.total > 0) {
        if (hitRate >= 90) {
          html += PR.renderCallout(
            t('performance.report.caching.excellentTitle', 'Excellent Caching'),
            t('performance.report.caching.excellentBody', 'Your cache hit rate of {{rate}}% is excellent. Most resources are served from cache, minimizing server load and improving load times.', { rate: hitRate }),
            'tip'
          );
        } else if (hitRate >= 70) {
          html += PR.renderCallout(
            t('performance.report.caching.goodTitle', 'Good Caching'),
            t('performance.report.caching.goodBody', 'Your cache hit rate of {{rate}}% is good. Consider adding cache headers to the remaining uncached resources to improve further.', { rate: hitRate }),
            'tip'
          );
        } else if (hitRate >= 40) {
          html += PR.renderCallout(
            t('performance.report.caching.fairTitle', 'Caching Needs Improvement'),
            t('performance.report.caching.fairBody', 'Your cache hit rate of {{rate}}% indicates many resources are not being cached. Add Cache-Control headers with appropriate max-age values for static assets.', { rate: hitRate }),
            'warning'
          );
        } else {
          html += PR.renderCallout(
            t('performance.report.caching.poorTitle', 'Poor Caching Strategy'),
            t('performance.report.caching.poorBody', 'Your cache hit rate of {{rate}}% is very low. Most resources are downloaded fresh on every visit, significantly increasing load times. Implement a comprehensive caching strategy.', { rate: hitRate }),
            'warning'
          );
        }
      }

      // Caching best practices list
      html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.caching.bestPracticesTitle', 'Caching Best Practices')) + '</h3>';
      var bestPractices = [
        t('performance.report.caching.bp1', 'Set Cache-Control: public, max-age=31536000 for versioned static assets (JS, CSS, images with hash in filename).'),
        t('performance.report.caching.bp2', 'Use Cache-Control: no-cache for HTML documents to ensure users always get the latest version.'),
        t('performance.report.caching.bp3', 'Enable ETag headers for conditional requests, reducing bandwidth for unchanged resources.'),
        t('performance.report.caching.bp4', 'Use a CDN to cache assets closer to users and reduce server load.')
      ];
      html += '<ul style="padding-left:18px;font-size:0.82rem;line-height:1.7;color:#374151;">';
      bestPractices.forEach(function (bp) {
        html += '<li style="margin-bottom:4px;">' + esc(bp) + '</li>';
      });
      html += '</ul>';

      sec.innerHTML = html;
    })();

    /* =====================================================================
       8. Recommendations — Rich Fix Cards
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.recommendations', 'Based on the performance analysis, these recommendations target the most impactful improvements. Addressing high-priority items first will deliver the greatest gains in load time and Core Web Vitals scores.')) + '</p>';

      // Try enriched fixes first, then generate from metrics, then fall back to simple recs
      // pdf-export-utility stores enriched fixes as data.enrichedFixes.performance (array)
      var richFixes = null;
      if (data.enrichedFixes) {
        if (Array.isArray(data.enrichedFixes)) {
          richFixes = data.enrichedFixes;
        } else if (Array.isArray(data.enrichedFixes.performance)) {
          richFixes = data.enrichedFixes.performance;
        }
      }
      if (!richFixes || richFixes.length === 0) {
        richFixes = _generatePerformanceFixes(data, desktop, mobile, cwv, mobileCwv);
      }

      if (richFixes && richFixes.length > 0) {
        // Map severity to priority group for rendering
        var critical = richFixes.filter(function (r) { return r.severity === 'critical'; });
        var medium = richFixes.filter(function (r) { return r.severity === 'medium'; });
        var low = richFixes.filter(function (r) { return r.severity === 'low'; });
        var groups = [
          { items: critical, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#ef4444', priority: 'critical' },
          { items: medium, label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: '#f59e0b', priority: 'medium' },
          { items: low, label: t('common.pdf.execSummary.lowPriority', 'Low Priority'), color: '#3b82f6', priority: 'low' }
        ];

        groups.forEach(function (group) {
          if (group.items.length === 0) return;
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:' + group.color + ';">&#9679; ' + esc(group.label) + ' (' + group.items.length + ')</div>';
          group.items.forEach(function (r) {
            // Ensure priority is set for _renderRecCard compatibility
            if (!r.priority) r.priority = group.priority;
            html += _renderRecCard(r, group.color, t, esc);
          });
          html += '</div>';
        });
      } else {
        // Fall back to simple recommendations array
        var recs = data.recommendations || [];
        if (recs.length > 0) {
          var criticalRecs = recs.filter(function (r) { return r.priority === 'critical' || r.priority === 'high'; });
          var mediumRecs = recs.filter(function (r) { return r.priority === 'medium'; });
          var lowRecs = recs.filter(function (r) { return !r.priority || r.priority === 'low'; });
          var simpleGroups = [
            { items: criticalRecs, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#ef4444' },
            { items: mediumRecs, label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: '#f59e0b' },
            { items: lowRecs, label: t('common.pdf.execSummary.lowPriority', 'Low Priority'), color: '#3b82f6' }
          ];

          simpleGroups.forEach(function (group) {
            if (group.items.length === 0) return;
            html += '<div class="pdf-recs-group">';
            html += '<div class="pdf-recs-group__title" style="color:' + group.color + ';">&#9679; ' + esc(group.label) + ' (' + group.items.length + ')</div>';
            group.items.forEach(function (r) {
              html += _renderRecCard(r, group.color, t, esc);
            });
            html += '</div>';
          });
        } else {
          html += PR.renderCallout(
            t('performance.report.recommendations.noneTitle', 'Excellent Performance'),
            t('performance.report.recommendations.noneBody', 'Your site performs well across all metrics. Continue monitoring for regressions.'),
            'tip'
          );
        }
      }

      sec.innerHTML = html;
    })();

    // ---- Hide empty sections ----
    document.querySelectorAll('.pdf-section').forEach(function (sec) {
      var content = sec.querySelector('.pdf-section__content');
      if (content && !content.innerHTML.trim()) {
        sec.style.display = 'none';
      }
    });
  });

  /* =========================================================================
     PRIVATE HELPERS (outside register callback, inside IIFE)
     ========================================================================= */

  function _htmlToNode(html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.firstChild;
  }

  function _formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Generate rich performance fix objects from CWV/Lighthouse data.
   * ES5-compatible port of generateFixesData() from performance-fixes-renderer.js.
   * Produces fix objects with title, subtitle, severity, code snippets, steps,
   * resources, summary, impact, and category — matching the web UI detail level.
   *
   * @param {Object} data      Full performance data payload
   * @param {Object} desktop   Normalized desktop data
   * @param {Object} mobile    Normalized mobile data
   * @param {Object} cwv       Desktop coreWebVitals
   * @param {Object} mobileCwv Mobile coreWebVitals
   * @returns {Array} Array of rich fix objects
   */
  function _generatePerformanceFixes(data, desktop, mobile, cwv, mobileCwv) {
    var fixes = [];

    // --- Helper: parse metric value to ms number ---
    function _toMs(val) {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      var s = String(val).trim();
      if (s.indexOf('ms') !== -1) return parseFloat(s) || 0;
      if (s.indexOf('s') !== -1) return (parseFloat(s) || 0) * 1000;
      return parseFloat(s) || 0;
    }

    // --- Helper: pick first valid number from candidates ---
    function _pick(candidates) {
      for (var i = 0; i < candidates.length; i++) {
        var n = _toMs(candidates[i]);
        if (n !== 0 && isFinite(n)) return n;
      }
      return 0;
    }

    // --- Helper: pick CLS (can be 0 legitimately, so check for existence) ---
    function _pickCls(candidates) {
      for (var i = 0; i < candidates.length; i++) {
        var v = candidates[i];
        if (v !== undefined && v !== null && v !== '') {
          var n = parseFloat(v);
          if (isFinite(n)) return n;
        }
      }
      return -1; // sentinel: no data
    }

    // --- Extract metrics from both desktop and mobile ---
    var dCwv = cwv || {};
    var mCwv = mobileCwv || {};
    var dLH = (desktop && desktop.lighthouse) ? desktop.lighthouse : {};
    var mLH = (mobile && mobile.lighthouse) ? mobile.lighthouse : {};

    // Use mobile metrics preferentially (worse case), fall back to desktop
    var mobileLCP = _pick([mCwv.lcpMs, mCwv.lcp, dCwv.lcpMs, dCwv.lcp]);
    var mobileTBT = _pick([mCwv.tbtMs, mCwv.tbt, mCwv.inpMs, mCwv.inp, mCwv.fidMs, mCwv.fid,
                           dCwv.tbtMs, dCwv.tbt, dCwv.inpMs, dCwv.inp, dCwv.fidMs, dCwv.fid]);
    var mobileCLS = _pickCls([mCwv.clsNum, mCwv.cls, dCwv.clsNum, dCwv.cls]);
    var mobilePerf = mLH.performance || dLH.performance || (mobile && mobile.performanceScore) || (desktop && desktop.performanceScore) || 0;
    var accessScore = mLH.accessibility || dLH.accessibility || 0;

    // =================================================================
    // 1. LCP Fix
    // =================================================================
    if (mobileLCP > 2500) {
      var lcpSeverity = mobileLCP > 4000 ? 'critical' : 'medium';
      var lcpDisplay = mCwv.lcp || dCwv.lcp || (mobileLCP / 1000).toFixed(2) + 's';
      var lcpImpact = mobileLCP > 4000 ? '+25 Performance Score' : '+15 Performance Score';

      fixes.push({
        id: 'lcp-optimization',
        severity: lcpSeverity,
        icon: 'lcp',
        title: 'Reduce Largest Contentful Paint (LCP)',
        issue: 'Reduce Largest Contentful Paint (LCP)',
        subtitle: 'Current: ' + lcpDisplay + ' \u2192 Target: <2.5s',
        category: 'Core Web Vitals',
        impact: lcpImpact,
        summary: 'Your LCP is ' + lcpDisplay + ', which is ' +
          (mobileLCP > 4000 ? 'critically slow' : 'slower than recommended') +
          '. LCP measures how long it takes for the largest visible content element\u2014typically a hero image, ' +
          'heading, or background graphic\u2014to finish rendering on screen. This is the metric users most closely ' +
          'associate with perceived load speed, and Google uses it as a direct Core Web Vitals ranking factor. ' +
          'A slow LCP usually indicates that critical resources are not being prioritized, images are uncompressed, ' +
          'or render-blocking scripts are delaying the page paint. Optimizing LCP often yields the single biggest ' +
          'improvement in both user experience and search rankings.',
        problematicCode: '<!-- Typical problematic pattern -->\n' +
          '<img src="/images/hero-original.jpg"\n' +
          '     class="hero-banner"\n' +
          '     alt="Hero banner">\n' +
          '\n' +
          '<!-- Issues detected: -->\n' +
          '<!-- \u2717 Large file size (likely 2-4MB) -->\n' +
          '<!-- \u2717 No responsive images (srcset) -->\n' +
          '<!-- \u2717 No width/height (causes CLS) -->\n' +
          '<!-- \u2717 Not preloaded as LCP element -->',
        fixedCode: '<!-- Optimized solution -->\n' +
          '<link rel="preload"\n' +
          '      as="image"\n' +
          '      href="/images/hero-800.webp"\n' +
          '      fetchpriority="high">\n' +
          '\n' +
          '<img src="/images/hero-800.webp"\n' +
          '     srcset="/images/hero-400.webp 400w,\n' +
          '             /images/hero-800.webp 800w,\n' +
          '             /images/hero-1200.webp 1200w"\n' +
          '     sizes="(max-width: 768px) 100vw, 800px"\n' +
          '     width="1920"\n' +
          '     height="1080"\n' +
          '     loading="eager"\n' +
          '     fetchpriority="high"\n' +
          '     alt="Hero banner">\n' +
          '\n' +
          '<!-- \u2713 WebP format (70-80% smaller) -->\n' +
          '<!-- \u2713 Responsive images for different screens -->\n' +
          '<!-- \u2713 Explicit dimensions (prevents CLS) -->\n' +
          '<!-- \u2713 Preloaded for instant visibility -->',
        resources: [
          { file: 'images/hero.jpg', size: '2.4MB', issue: 'Unoptimized, blocks LCP' },
          { file: 'images/background.png', size: '1.8MB', issue: 'Could use WebP format' }
        ],
        steps: [
          'Identify your LCP element using Chrome DevTools \u2192 Performance \u2192 View Largest Contentful Paint',
          'Convert LCP images to WebP and add <link rel="preload" as="image" fetchpriority="high"> in <head>',
          'Add explicit width and height attributes to prevent layout shift',
          'Set loading="eager" and fetchpriority="high" on the LCP image'
        ]
      });
    }

    // =================================================================
    // 2. TBT / JavaScript Optimization Fix
    // =================================================================
    if (mobileTBT > 200 || mobilePerf < 70) {
      var tbtSeverity = mobileTBT > 600 ? 'critical' : 'medium';
      var tbtDisplay = mobileTBT + 'ms';

      fixes.push({
        id: 'javascript-optimization',
        severity: tbtSeverity,
        icon: 'js',
        title: 'Reduce JavaScript Execution Time',
        issue: 'Reduce JavaScript Execution Time',
        subtitle: 'Total Blocking Time: ' + tbtDisplay + ' \u2192 Target: <200ms',
        category: 'Performance',
        impact: '+20 Performance Score',
        summary: 'Your site has ' + tbtDisplay + ' of Total Blocking Time, meaning the browser\'s main thread ' +
          'is occupied executing JavaScript and cannot respond to user input like clicks, taps, or key presses. ' +
          'This creates a frustrating experience where buttons appear clickable but do nothing, scroll feels ' +
          'janky, and forms seem unresponsive. Total Blocking Time directly measures the cumulative periods ' +
          'during which the main thread is blocked for more than 50 milliseconds, and it is a key component of ' +
          'your Core Web Vitals score. Common causes include large unminified JavaScript bundles, synchronous ' +
          'third-party scripts, and unused library code. Deferring non-critical scripts, removing unused code, ' +
          'and code-splitting large bundles can dramatically reduce blocking time.',
        problematicCode: '<!-- Render-blocking scripts in <head> -->\n' +
          '<script src="/js/jquery-3.6.0.min.js"></script>\n' +
          '<script src="/js/bootstrap.bundle.js"></script>\n' +
          '<script src="/js/animations.js"></script>\n' +
          '<script src="/js/analytics.js"></script>\n' +
          '\n' +
          '<!-- Issues: -->\n' +
          '<!-- \u2717 Blocks HTML parsing -->\n' +
          '<!-- \u2717 Large bundle sizes -->\n' +
          '<!-- \u2717 No code splitting -->\n' +
          '<!-- \u2717 Unnecessary dependencies -->',
        fixedCode: '<!-- Defer non-critical scripts -->\n' +
          '<script src="/js/analytics.js" defer></script>\n' +
          '\n' +
          '<!-- Async for independent scripts -->\n' +
          '<script src="/js/animations.js" async></script>\n' +
          '\n' +
          '<!-- Modern module approach -->\n' +
          '<script type="module">\n' +
          '  // Only load what you need\n' +
          '  import { initCarousel } from \'/js/carousel.js\';\n' +
          '  import { trackEvents } from \'/js/analytics.js\';\n' +
          '\n' +
          '  // Lazy load heavy features\n' +
          '  if (document.querySelector(\'.video-player\')) {\n' +
          '    import(\'/js/video-player.js\');\n' +
          '  }\n' +
          '</script>\n' +
          '\n' +
          '<!-- \u2713 Non-blocking script loading -->\n' +
          '<!-- \u2713 Code splitting by feature -->\n' +
          '<!-- \u2713 Lazy load heavy components -->',
        resources: [
          { file: 'js/vendor.bundle.js', size: '248KB', issue: 'Contains unused libraries' },
          { file: 'js/main.js', size: '156KB', issue: 'Not minified or tree-shaken' }
        ],
        steps: [
          'Add defer or async attributes to all non-critical script tags',
          'Open DevTools \u2192 Coverage tab to find and remove unused JavaScript',
          'Enable minification and gzip/brotli compression on your server'
        ]
      });
    }

    // =================================================================
    // 3. CLS Fix
    // =================================================================
    if (mobileCLS >= 0 && mobileCLS > 0.1) {
      var clsSeverity = mobileCLS > 0.25 ? 'critical' : 'medium';
      var clsDisplay = mobileCLS.toFixed(3);

      fixes.push({
        id: 'cls-layout-shift',
        severity: clsSeverity,
        icon: 'cls',
        title: 'Fix Cumulative Layout Shift (CLS)',
        issue: 'Fix Cumulative Layout Shift (CLS)',
        subtitle: 'Current: ' + clsDisplay + ' \u2192 Target: <0.1',
        category: 'Core Web Vitals',
        impact: '+10 Performance Score',
        summary: 'Your CLS score is ' + clsDisplay + ', indicating unexpected layout shifts that disrupt the ' +
          'user experience. This happens when elements change position after the page initially renders\u2014for ' +
          'example, an image loads without reserved dimensions, a web font swaps in with different metrics, or a ' +
          'dynamic ad banner pushes content down the page. These unexpected shifts are especially frustrating for ' +
          'users who are about to tap a button or read text that suddenly jumps to a different location, often ' +
          'causing accidental clicks. Cumulative Layout Shift is one of Google\'s three Core Web Vitals metrics ' +
          'and directly affects your search rankings. The most effective fixes include adding explicit width and ' +
          'height attributes to images, using font-display: swap, and reserving space for dynamic content.',
        problematicCode: '<!-- Missing dimensions cause shifts -->\n' +
          '<img src="product.jpg" alt="Product">\n' +
          '\n' +
          '<!-- Font loading causes text reflow -->\n' +
          '<style>\n' +
          '  body {\n' +
          '    font-family: \'Custom Font\', sans-serif;\n' +
          '  }\n' +
          '</style>\n' +
          '\n' +
          '<!-- Dynamic content insertion -->\n' +
          '<div id="banner-ad"></div>\n' +
          '<div class="main-content">...</div>\n' +
          '\n' +
          '<!-- Issues: -->\n' +
          '<!-- \u2717 No image dimensions -->\n' +
          '<!-- \u2717 No font-display strategy -->\n' +
          '<!-- \u2717 No space reserved for ads -->',
        fixedCode: '<!-- Reserve space with dimensions -->\n' +
          '<img src="product.jpg"\n' +
          '     alt="Product"\n' +
          '     width="800"\n' +
          '     height="600">\n' +
          '\n' +
          '<!-- Control font loading -->\n' +
          '<style>\n' +
          '  @font-face {\n' +
          '    font-family: \'Custom Font\';\n' +
          '    src: url(\'/fonts/custom.woff2\');\n' +
          '    font-display: swap;\n' +
          '  }\n' +
          '\n' +
          '  body {\n' +
          '    font-family: \'Custom Font\', sans-serif;\n' +
          '  }\n' +
          '</style>\n' +
          '\n' +
          '<!-- Reserve space for dynamic content -->\n' +
          '<div id="banner-ad"\n' +
          '     style="min-height: 250px;\n' +
          '            background: rgba(0,0,0,0.05);">\n' +
          '</div>\n' +
          '<div class="main-content">...</div>\n' +
          '\n' +
          '<!-- \u2713 Explicit dimensions prevent shifts -->\n' +
          '<!-- \u2713 font-display controls loading -->\n' +
          '<!-- \u2713 Reserved space for ads -->',
        resources: [
          { file: 'All images without width/height', size: 'N/A', issue: 'Causes layout shifts' },
          { file: 'Custom web fonts', size: 'N/A', issue: 'No font-display strategy' }
        ],
        steps: [
          'Add width and height attributes to all images and videos',
          'Set font-display: swap on @font-face rules and preload critical fonts',
          'Reserve space for ads/embeds with min-height or aspect-ratio'
        ]
      });
    }

    // =================================================================
    // 4. Image Optimization Fix
    // =================================================================
    if (mobilePerf < 80) {
      fixes.push({
        id: 'image-optimization',
        severity: 'medium',
        icon: 'img',
        title: 'Optimize Images',
        issue: 'Optimize Images',
        subtitle: 'Reduce image file sizes by 60-80%',
        category: 'Performance',
        impact: '+12 Performance Score',
        summary: 'Images typically account for the largest portion of total page weight, often consuming 50-80% ' +
          'of all downloaded bytes. Unoptimized images\u2014those served in older formats like JPEG or PNG, at ' +
          'unnecessarily high resolutions, or without responsive sizing\u2014force visitors to download megabytes ' +
          'of data they may not need. This dramatically increases load time, especially on mobile networks where ' +
          'bandwidth is limited and data may be metered. Modern image formats like WebP and AVIF can reduce file ' +
          'sizes by 60-80% compared to JPEG with no visible quality loss. Combining format optimization with ' +
          'responsive srcset attributes and lazy loading for below-the-fold images typically produces the single ' +
          'largest performance improvement for most websites.',
        problematicCode: '<!-- Unoptimized images -->\n' +
          '<img src="/photos/team-photo.jpg"\n' +
          '     alt="Team photo">\n' +
          '<!-- File size: 3.2MB -->\n' +
          '<!-- Format: JPEG -->\n' +
          '<!-- Resolution: 4000x3000 -->\n' +
          '\n' +
          '<div style="background-image: url(\'/bg/hero.png\')">\n' +
          '  ...\n' +
          '</div>\n' +
          '<!-- File size: 2.8MB -->\n' +
          '<!-- Format: PNG (unnecessary) -->',
        fixedCode: '<!-- Optimized with WebP + responsive -->\n' +
          '<picture>\n' +
          '  <source\n' +
          '    srcset="/photos/team-400.webp 400w,\n' +
          '            /photos/team-800.webp 800w"\n' +
          '    type="image/webp">\n' +
          '  <img src="/photos/team-800.jpg"\n' +
          '       srcset="/photos/team-400.jpg 400w,\n' +
          '               /photos/team-800.jpg 800w"\n' +
          '       sizes="(max-width: 768px) 100vw, 50vw"\n' +
          '       width="800"\n' +
          '       height="600"\n' +
          '       loading="lazy"\n' +
          '       alt="Team photo">\n' +
          '</picture>\n' +
          '<!-- File size: 180KB (WebP) or 320KB (JPEG) -->\n' +
          '<!-- 94% smaller! -->\n' +
          '\n' +
          '<div style="background-image:\n' +
          '     image-set(\n' +
          '       url(\'/bg/hero.webp\') type(\'image/webp\'),\n' +
          '       url(\'/bg/hero.jpg\') type(\'image/jpeg\')\n' +
          '     )">\n' +
          '  ...\n' +
          '</div>\n' +
          '<!-- WebP fallback for backgrounds -->',
        resources: [
          { file: 'images/hero.jpg', size: '3.2MB', issue: 'Could be 180KB as WebP' },
          { file: 'images/gallery/*.jpg', size: '18MB total', issue: '12 unoptimized images' }
        ],
        steps: [
          'Convert images to WebP format using Squoosh, Sharp, or your image CDN',
          'Add srcset with multiple sizes (400w, 800w, 1200w) for responsive delivery',
          'Set loading="lazy" on images below the fold',
          'Add width and height attributes to prevent layout shift'
        ]
      });
    }

    // =================================================================
    // 5. Accessibility Fix
    // =================================================================
    if (accessScore < 85) {
      var a11ySeverity = accessScore < 70 ? 'medium' : 'low';

      fixes.push({
        id: 'accessibility-improvements',
        severity: a11ySeverity,
        icon: 'a11y',
        title: 'Improve Accessibility',
        issue: 'Improve Accessibility',
        subtitle: 'Score: ' + accessScore + '/100 \u2192 Target: >90',
        category: 'Accessibility',
        impact: 'Legal compliance + SEO boost',
        summary: 'Your site\'s accessibility score of ' + accessScore + '/100 indicates that users with ' +
          'disabilities may encounter significant barriers when trying to use your website. Common issues include ' +
          'images without descriptive alt text (which prevents screen reader users from understanding visual ' +
          'content), insufficient color contrast (which makes text unreadable for users with low vision), and form ' +
          'inputs without associated labels (which makes forms unusable with assistive technology). Accessibility ' +
          'is not only an ethical obligation but increasingly a legal requirement under the ADA, Section 508, and ' +
          'the European Accessibility Act. Search engines also factor accessibility into rankings, as many ' +
          'accessibility best practices align with SEO fundamentals like semantic HTML and clear content structure.',
        problematicCode: '<!-- Missing alt text -->\n' +
          '<img src="logo.png">\n' +
          '\n' +
          '<!-- Poor color contrast -->\n' +
          '<button style="color: #ccc;\n' +
          '               background: #ddd;">\n' +
          '  Click me\n' +
          '</button>\n' +
          '\n' +
          '<!-- Non-semantic HTML -->\n' +
          '<div onclick="submit()">Submit</div>\n' +
          '\n' +
          '<!-- Missing labels -->\n' +
          '<input type="text" placeholder="Name">\n' +
          '\n' +
          '<!-- Issues: -->\n' +
          '<!-- \u2717 Screen readers can\'t describe images -->\n' +
          '<!-- \u2717 Low contrast (fails WCAG AA) -->\n' +
          '<!-- \u2717 Not keyboard accessible -->\n' +
          '<!-- \u2717 No associated label -->',
        fixedCode: '<!-- Descriptive alt text -->\n' +
          '<img src="logo.png"\n' +
          '     alt="Company Logo - Site Mechanic">\n' +
          '\n' +
          '<!-- Sufficient contrast (4.5:1) -->\n' +
          '<button style="color: #fff;\n' +
          '               background: #2563eb;">\n' +
          '  Click me\n' +
          '</button>\n' +
          '\n' +
          '<!-- Semantic, keyboard accessible -->\n' +
          '<button type="submit"\n' +
          '        aria-label="Submit form">\n' +
          '  Submit\n' +
          '</button>\n' +
          '\n' +
          '<!-- Proper label association -->\n' +
          '<label for="nameInput">Name:</label>\n' +
          '<input type="text"\n' +
          '       id="nameInput"\n' +
          '       name="name"\n' +
          '       aria-required="true">\n' +
          '\n' +
          '<!-- \u2713 All elements accessible -->\n' +
          '<!-- \u2713 WCAG AA compliant -->\n' +
          '<!-- \u2713 Keyboard navigable -->',
        resources: [],
        steps: [
          'Add descriptive alt text to all images',
          'Ensure color contrast ratio of at least 4.5:1 for text',
          'Use semantic HTML (<button>, <nav>, <main>) instead of <div>',
          'Associate all form inputs with <label> elements'
        ]
      });
    }

    // =================================================================
    // Sort by severity priority: critical > medium > low
    // =================================================================
    var priorityOrder = { critical: 0, medium: 1, low: 2 };
    fixes.sort(function (a, b) {
      return (priorityOrder[a.severity] || 2) - (priorityOrder[b.severity] || 2);
    });

    return fixes;
  }

  /**
   * Render a CWV per-metric deep-dive card with progress bars for desktop/mobile.
   * Shows target threshold, colored progress bars, and an improvement tip.
   *
   * @param {string}  metricLabel  Short label (e.g. "LCP")
   * @param {string}  fullName     Full metric name
   * @param {Object}  dObj         Desktop CWV metric object { value, displayValue, score, rating }
   * @param {Object}  mObj         Mobile CWV metric object (nullable)
   * @param {string}  targetStr    Target threshold display string (e.g. "≤ 2.5s")
   * @param {number}  maxVal       Maximum value for scaling progress bar width
   * @param {boolean} isCls        Whether this is a CLS metric (different formatting)
   * @param {string}  tipText      Improvement tip text
   * @param {Function} t           i18n translation function
   * @param {Function} esc         HTML escape function
   */
  function _renderCwvDeepDive(metricLabel, fullName, dObj, mObj, targetStr, maxVal, isCls, tipText, t, esc) {
    var html = '';
    html += '<h3 class="pdf-subsection__title">' + esc(metricLabel + ' \u2014 ' + fullName) + '</h3>';
    html += '<div style="margin-bottom:8px;font-size:0.82rem;"><strong>' + esc(t('performance.report.cwv.target', 'Target')) + ':</strong> <span style="color:#10b981;font-weight:600;">' + esc(targetStr) + '</span></div>';

    var devices = [
      { label: t('common.desktop', 'Desktop'), obj: dObj },
      { label: t('common.mobile', 'Mobile'), obj: mObj }
    ];

    devices.forEach(function (dev) {
      if (!dev.obj) return;
      var val = dev.obj.value || 0;
      var display = dev.obj.displayValue || (isCls ? String(val) : val + 'ms');
      var rating = String(dev.obj.rating || '').toLowerCase();
      var color = rating === 'good' ? '#10b981' : (rating.indexOf('needs') !== -1 || rating.indexOf('average') !== -1) ? '#f59e0b' : '#ef4444';
      var width = Math.max(5, Math.min(100, Math.round((val / maxVal) * 100)));

      html += '<div style="margin-bottom:10px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
      html += '<span style="font-weight:600;font-size:0.82rem;">' + esc(dev.label) + '</span>';
      html += '<span style="font-weight:700;font-size:0.92rem;color:' + color + ';">' + esc(display) + '</span>';
      html += '</div>';
      html += '<div style="height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;">';
      html += '<div style="height:100%;width:' + width + '%;background:' + color + ';border-radius:999px;"></div>';
      html += '</div></div>';
    });

    html += PR.renderCallout(t('performance.report.cwv.howToImprove', 'How to Improve'), tipText, 'tip');
    return html;
  }

  /**
   * Render a rich recommendation card with all available detail fields.
   * Mirrors the depth of performance-fixes-renderer.js and security PDF
   * fix cards, but adapted for the performance report data shape.
   */
  function _renderRecCard(r, groupColor, t, esc) {
    var html = '<div class="pdf-rec" style="border-left-color:' + groupColor + ';">';
    html += '<div class="pdf-rec__text">';

    // Metric label
    if (r.metric) {
      html += '<span class="pdf-text-muted">[' + esc(r.metric) + ']</span> ';
    }

    // Title (issue or title)
    html += '<strong>' + esc(r.issue || r.title || '') + '</strong>';

    // Solution (italic)
    if (r.solution) {
      html += '<br><em>' + esc(r.solution) + '</em>';
    }

    html += '</div>';

    // Category label (uppercase)
    if (r.category) {
      html += '<div style="margin-top:4px;"><span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;background:rgba(107,114,128,0.1);color:#6b7280;">' + esc(r.category) + '</span></div>';
    }

    // Impact badge (green)
    if (r.impact) {
      html += '<div style="margin-top:4px;"><span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:0.7rem;font-weight:600;color:#fff;background:#10b981;">' + esc(r.impact) + '</span></div>';
    }

    // Subtitle (gray, e.g. "Current: 3.2s -> Target: <2.5s")
    if (r.subtitle) {
      html += '<div style="margin-top:3px;font-size:0.72rem;color:#9ca3af;">' + esc(r.subtitle) + '</div>';
    }

    // Summary / detailed description paragraph
    if (r.summary) {
      html += '<div style="margin-top:6px;font-size:0.78rem;line-height:1.6;color:#4b5563;">' + esc(r.summary) + '</div>';
    }

    // Secondary description
    if (r.description && r.description !== r.summary) {
      html += '<div style="margin-top:4px;font-size:0.75rem;line-height:1.5;color:#6b7280;">' + esc(r.description) + '</div>';
    }

    // Code blocks: Before (problematic) / After (fixed)
    var beforeCode = r.problematicCode || r.snippet || r.code || '';
    var afterCode = r.fixedCode || r.recommendedCode || r.solutionCode || '';

    if (beforeCode || afterCode) {
      html += '<div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">';

      if (beforeCode) {
        html += '<div>';
        html += '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:#ef4444;margin-bottom:2px;">' + esc(t('performance.report.rec.before', 'Before')) + '</div>';
        html += '<pre style="background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:8px;font-size:0.65rem;line-height:1.4;overflow-x:auto;white-space:pre-wrap;word-break:break-word;margin:0;">' + esc(beforeCode) + '</pre>';
        html += '</div>';
      }

      if (afterCode) {
        html += '<div>';
        html += '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:#10b981;margin-bottom:2px;">' + esc(t('performance.report.rec.after', 'After')) + '</div>';
        html += '<pre style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:8px;font-size:0.65rem;line-height:1.4;overflow-x:auto;white-space:pre-wrap;word-break:break-word;margin:0;">' + esc(afterCode) + '</pre>';
        html += '</div>';
      }

      html += '</div>';
    }

    // Resources array: File | Size | Issue table
    if (r.resources && Array.isArray(r.resources) && r.resources.length > 0) {
      html += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(0,0,0,0.06);">';
      html += '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:#6b7280;margin-bottom:4px;">' + esc(t('performance.report.rec.affectedResources', 'Affected Resources')) + '</div>';
      html += '<table style="width:100%;font-size:0.72rem;border-collapse:collapse;">';
      html += '<thead><tr style="background:#f9fafb;">';
      html += '<th style="text-align:left;padding:3px 6px;border-bottom:1px solid #e5e7eb;">' + esc(t('performance.report.rec.file', 'File')) + '</th>';
      html += '<th style="text-align:left;padding:3px 6px;border-bottom:1px solid #e5e7eb;">' + esc(t('performance.report.rec.size', 'Size')) + '</th>';
      html += '<th style="text-align:left;padding:3px 6px;border-bottom:1px solid #e5e7eb;">' + esc(t('performance.report.rec.issue', 'Issue')) + '</th>';
      html += '</tr></thead><tbody>';
      r.resources.forEach(function (res) {
        html += '<tr>';
        html += '<td style="padding:3px 6px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:0.65rem;">' + esc(res.file || res.url || '') + '</td>';
        html += '<td style="padding:3px 6px;border-bottom:1px solid #f3f4f6;">' + esc(res.size || '-') + '</td>';
        html += '<td style="padding:3px 6px;border-bottom:1px solid #f3f4f6;color:#ef4444;">' + esc(res.issue || res.problem || '') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    }

    // Steps array: numbered step-by-step list
    if (r.steps && Array.isArray(r.steps) && r.steps.length > 0) {
      html += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(0,0,0,0.06);">';
      html += '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:#6b7280;margin-bottom:4px;">' + esc(t('performance.report.rec.stepByStep', 'Step-by-Step Fix Guide')) + '</div>';
      html += '<ol style="padding-left:16px;margin:0;font-size:0.75rem;line-height:1.6;color:#374151;">';
      r.steps.forEach(function (step) {
        html += '<li style="margin-bottom:3px;">' + esc(step) + '</li>';
      });
      html += '</ol>';
      html += '</div>';
    }

    html += '</div>'; // end .pdf-rec

    return html;
  }

})(window);
