/**
 * Core Web Vitals Report — PDF Renderer
 * Renders all CWV analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[core-web-vitals-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('core-web-vitals', function renderCWV(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;
    var translateImpact = utils.translateImpact || function(v) { return v; };

    var sectionIndex = 1;

    /* =====================================================================
       Normalize data shape — handle _pdf-report.js score normalization
       and compute missing fields the API doesn't return
       ===================================================================== */

    // _pdf-report.js converts numeric data.score to { overall, grade }.
    // Extract the numeric score and grade so the renderer can use them.
    var _rawScore = data.score;
    var _numericScore;
    var _grade;
    if (_rawScore && typeof _rawScore === 'object') {
      _numericScore = _rawScore.overall;
      _grade = data.grade || _rawScore.grade;
    } else {
      _numericScore = (typeof _rawScore === 'number') ? _rawScore : undefined;
      _grade = data.grade;
    }

    // Compute passedCWV on desktop/mobile if not provided by the API.
    // passedCWV = true when all three core vitals (lcp, inp, cls) rate "good".
    function _computePassedCWV(device) {
      if (!device) return undefined;
      if (device.passedCWV !== undefined) return device.passedCWV;
      var lcp = device.lcp;
      var inp = device.inp;
      var cls = device.cls;
      // Need all three present with ratings to determine pass/fail
      if (!lcp || !inp || !cls) return undefined;
      if (!lcp.rating || !inp.rating || !cls.rating) return undefined;
      return lcp.rating === 'good' && inp.rating === 'good' && cls.rating === 'good';
    }

    if (data.desktop) {
      data.desktop.passedCWV = _computePassedCWV(data.desktop);
    }
    if (data.mobile) {
      data.mobile.passedCWV = _computePassedCWV(data.mobile);
    }

    /* =====================================================================
       Shared helpers
       ===================================================================== */

    /** Map a CWV rating string to a renderStatus call */
    function _ratingStatus(rating) {
      if (rating === 'good') return PR.renderStatus('pass', t('reports.cwv.report.cwv.good', 'Good'));
      if (rating === 'needs-improvement') return PR.renderStatus('warn', t('reports.cwv.report.cwv.needsImprovement', 'Needs Improvement'));
      if (rating === 'poor') return PR.renderStatus('fail', t('reports.cwv.report.cwv.poor', 'Poor'));
      return PR.renderStatus('na', rating || '-');
    }

    /** Rating to hex color */
    function _ratingColor(rating) {
      if (rating === 'good') return '#33F52F';
      if (rating === 'needs-improvement') return '#FFCC00';
      if (rating === 'poor') return '#482900';
      return '#6b7280';
    }

    /** Grade letter to hex color (mirrors web UI getGradeColor) */
    function _gradeColor(grade) {
      if (grade === 'A') return '#1AFA35';
      if (grade === 'B') return '#66EB23';
      if (grade === 'C') return '#B2DB12';
      if (grade === 'D') return '#FFCC00';
      if (grade === 'F') return '#8C6600';
      return '#6b7280';
    }

    /** Format a metric display value — prefers displayValue, falls back to value+unit */
    function _metricDisplay(metric) {
      if (!metric) return '-';
      if (metric.displayValue) return metric.displayValue;
      if (metric.value !== undefined && metric.value !== null) {
        return String(metric.value) + (metric.unit ? ' ' + metric.unit : '');
      }
      return '-';
    }

    /** Build metrics cards array from a vitals object */
    function _buildMetricsCards(vitals) {
      var cards = [];
      var keys = [
        { key: 'lcp', label: 'LCP' },
        { key: 'inp', label: 'INP' },
        { key: 'cls', label: 'CLS' },
        { key: 'ttfb', label: 'TTFB' },
        { key: 'fcp', label: 'FCP' }
      ];
      keys.forEach(function (k) {
        var m = vitals[k.key];
        if (m && m.value !== undefined) {
          cards.push({
            value: _metricDisplay(m),
            label: k.label,
            color: _ratingColor(m.rating)
          });
        }
      });
      return cards;
    }

    /** Build a vitals detail table from a device data object (with description column) */
    function _buildVitalsTable(vitals) {
      var rows = [];
      var names = [
        { key: 'lcp', label: t('reports.cwv.report.vitals.lcp', 'Largest Contentful Paint (LCP)') },
        { key: 'inp', label: t('reports.cwv.report.vitals.inp', 'Interaction to Next Paint (INP)') },
        { key: 'cls', label: t('reports.cwv.report.vitals.cls', 'Cumulative Layout Shift (CLS)') },
        { key: 'ttfb', label: t('reports.cwv.report.vitals.ttfb', 'Time to First Byte (TTFB)') },
        { key: 'fcp', label: t('reports.cwv.report.vitals.fcp', 'First Contentful Paint (FCP)') }
      ];
      names.forEach(function (n) {
        var m = vitals[n.key];
        if (!m) return;
        var display = _metricDisplay(m);
        var desc = m.description ? esc(truncate(m.description, 120)) : '';
        rows.push([
          '<strong>' + esc(n.label) + '</strong>' + (desc ? '<br><small style="color:#6b7280;">' + desc + '</small>' : ''),
          esc(display),
          _ratingStatus(m.rating)
        ]);
      });
      return rows;
    }

    /** Build additional metrics table with displayValue, rating and description */
    function _buildAdditionalMetricsTable(additionalMetrics) {
      if (!additionalMetrics || typeof additionalMetrics !== 'object') return '';
      var addKeys = Object.keys(additionalMetrics);
      if (addKeys.length === 0) return '';

      var rows = [];
      addKeys.forEach(function (key) {
        var m = additionalMetrics[key];
        if (typeof m === 'object' && m !== null) {
          var val = _metricDisplay(m);
          var desc = m.description ? esc(truncate(m.description, 120)) : '';
          rows.push([
            '<strong>' + esc(key.toUpperCase()) + '</strong>' + (desc ? '<br><small style="color:#6b7280;">' + desc + '</small>' : ''),
            esc(val),
            m.rating ? _ratingStatus(m.rating) : PR.renderStatus('na', '-')
          ]);
        } else {
          rows.push([
            '<strong>' + esc(key) + '</strong>',
            esc(String(m)),
            PR.renderStatus('na', '-')
          ]);
        }
      });

      return PR.renderTable(
        [
          { label: t('seo.report.table.metric', 'Metric'), width: '40%' },
          { label: t('seo.report.table.value', 'Value'), width: '30%' },
          { label: t('seo.report.table.status', 'Status'), width: '30%' }
        ],
        rows,
        { striped: true }
      );
    }


    /* =====================================================================
       0. Overall Score Banner (NEW — matches web UI score + grade banner)
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-score-banner .pdf-section__content');
      if (!sec) return;

      var score = _numericScore;
      var grade = _grade;
      var issues = data.issues || [];
      var mobile = data.mobile || {};
      var desktop = data.desktop || {};

      if (score === undefined && !grade) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cwv.report.overallScore', 'Overall CWV Score'), score)),
        sec
      );

      var html = '';

      // Score + grade metrics row
      var gradeClr = _gradeColor(grade);
      var metricsRow = [];
      if (score !== undefined) {
        metricsRow.push({ value: String(score) + '/100', label: t('reports.cwv.overallScore', 'Overall CWV Score'), color: gradeClr });
      }
      if (grade) {
        metricsRow.push({ value: grade, label: t('reports.cwv.grade', 'GRADE'), color: gradeClr });
      }
      if (mobile.score !== undefined) {
        metricsRow.push({ value: String(mobile.score) + '/100', label: t('reports.cwv.mobile', 'Mobile') + ' (70%)', color: mobile.score >= 90 ? '#10b981' : mobile.score >= 50 ? '#f59e0b' : '#ef4444' });
      }
      if (desktop.score !== undefined) {
        metricsRow.push({ value: String(desktop.score) + '/100', label: t('reports.cwv.desktop', 'Desktop') + ' (30%)', color: desktop.score >= 90 ? '#10b981' : desktop.score >= 50 ? '#f59e0b' : '#ef4444' });
      }
      if (metricsRow.length > 0) {
        html += PR.renderMetrics(metricsRow);
      }

      // CWV pass / fail callout
      var passedCWV = mobile.passedCWV;
      if (passedCWV !== undefined) {
        if (passedCWV) {
          html += PR.renderCallout(
            t('reports.cwv.passingCwvTitle', 'Passing Core Web Vitals'),
            t('reports.cwv.passingCwv', 'PASSING Core Web Vitals (Good for Google Rankings)'),
            'tip'
          );
        } else {
          html += PR.renderCallout(
            t('reports.cwv.failingCwvTitle', 'Failing Core Web Vitals'),
            t('reports.cwv.failingCwv', 'FAILING Core Web Vitals (May hurt Google Rankings)'),
            'warning'
          );
        }
      }

      // Critical issues alert (matches web UI issues box)
      if (issues.length > 0) {
        html += '<h3 class="pdf-subsection__title" style="color:#ef4444;">' + esc(t('reports.cwv.criticalIssues', 'Critical Issues')) + '</h3>';
        issues.forEach(function (issue) {
          html += PR.renderIssue(typeof issue === 'string' ? issue : (issue.message || issue.title || String(issue)), 'critical');
        });
      }

      sec.innerHTML = html;
    })();


    /* =====================================================================
       1. Desktop Vitals
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-desktop .pdf-section__content');
      var d = data.desktop || {};

      if (!d.lcp && !d.inp && !d.cls && !d.score) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cwv.report.desktop', 'Desktop Vitals'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.desktop', 'Desktop Core Web Vitals measure how real users experience your site on desktop devices. This section presents LCP, INP, CLS, and additional metrics with ratings based on Google\'s published thresholds. Good scores indicate a fast, responsive, and visually stable experience for desktop visitors.')) + '</p>';

      // Metric cards
      var cards = _buildMetricsCards(d);
      if (cards.length > 0) {
        html += PR.renderMetrics(cards);
      }

      // Pass/fail callout
      if (d.passedCWV !== undefined) {
        html += PR.renderCallout(
          d.passedCWV ? t('reports.cwv.allVitalsPassed', 'All Core Web Vitals passed') : t('reports.cwv.someMetricsNeedImprovement', 'Some metrics need improvement'),
          d.passedCWV
            ? t('reports.cwv.report.desktop.passedDesc', 'All desktop Core Web Vitals meet Google\\')
            : t('reports.cwv.report.desktop.failedDesc', 'One or more desktop metrics fall below Google\\'),
          d.passedCWV ? 'tip' : 'warning'
        );
      }

      // Detail table with descriptions
      var rows = _buildVitalsTable(d);
      if (rows.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.desktop.details', 'Metric Details')) + '</h3>';
        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '40%' },
            { label: t('seo.report.table.value', 'Value'), width: '30%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          rows,
          { striped: true }
        );
      }

      // Additional metrics with rating column
      if (d.additionalMetrics) {
        var addHtml = _buildAdditionalMetricsTable(d.additionalMetrics);
        if (addHtml) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.desktop.additionalMetrics', 'Additional Metrics')) + '</h3>';
          html += addHtml;
        }
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       2. Mobile Vitals
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-mobile .pdf-section__content');
      var d = data.mobile || {};

      if (!d.lcp && !d.inp && !d.cls && !d.score) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cwv.report.mobile', 'Mobile Vitals'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.mobile', 'Mobile Core Web Vitals are especially important since Google uses mobile-first indexing. This section presents your mobile LCP, INP, CLS, and additional metrics. Mobile performance often differs significantly from desktop due to slower processors and network conditions. Optimizing for mobile is critical for search rankings.')) + '</p>';

      // Metric cards
      var cards = _buildMetricsCards(d);
      if (cards.length > 0) {
        html += PR.renderMetrics(cards);
      }

      // Pass/fail callout
      if (d.passedCWV !== undefined) {
        html += PR.renderCallout(
          d.passedCWV ? t('reports.cwv.allVitalsPassed', 'All Core Web Vitals passed') : t('reports.cwv.someMetricsNeedImprovement', 'Some metrics need improvement'),
          d.passedCWV
            ? t('reports.cwv.report.mobile.passedDesc', 'All mobile Core Web Vitals meet Google\\')
            : t('reports.cwv.report.mobile.failedDesc', 'One or more mobile metrics fall below Google\\'),
          d.passedCWV ? 'tip' : 'warning'
        );
      }

      // Detail table with descriptions
      var rows = _buildVitalsTable(d);
      if (rows.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.mobile.details', 'Metric Details')) + '</h3>';
        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '40%' },
            { label: t('seo.report.table.value', 'Value'), width: '30%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          rows,
          { striped: true }
        );
      }

      // Additional metrics with rating column
      if (d.additionalMetrics) {
        var addHtml = _buildAdditionalMetricsTable(d.additionalMetrics);
        if (addHtml) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.mobile.additionalMetrics', 'Additional Metrics')) + '</h3>';
          html += addHtml;
        }
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       3. Core Vitals Deep Dive — The Big 3 (NEW)
       Matches web UI renderMetricCard: LCP, INP, CLS side-by-side
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-core-vitals .pdf-section__content');
      if (!sec) return;

      var desktop = data.desktop || {};
      var mobile = data.mobile || {};

      if (!mobile.lcp && !desktop.lcp) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cwv.coreVitalsTitle', "The Big 3: Google's Core Web Vitals"))),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.coreVitals', 'These three metrics are the official Core Web Vitals that Google uses as ranking signals. LCP measures loading performance, INP measures interactivity responsiveness, and CLS measures visual stability. Each metric is shown with mobile (70% weight) and desktop (30% weight) values side by side.')) + '</p>';

      // Build the big-3 comparison table
      var big3 = [
        { key: 'lcp', abbr: 'LCP', name: t('reports.cwv.lcpName', 'Largest Contentful Paint'), category: t('reports.cwv.loadingPerformance', 'Loading Performance') },
        { key: 'inp', abbr: 'INP', name: t('reports.cwv.inpName', 'Interaction to Next Paint'), category: t('reports.cwv.responsiveness', 'Responsiveness') },
        { key: 'cls', abbr: 'CLS', name: t('reports.cwv.clsName', 'Cumulative Layout Shift'), category: t('reports.cwv.visualStability', 'Visual Stability') }
      ];

      var rows = [];
      big3.forEach(function (vital) {
        var mMetric = mobile[vital.key];
        var dMetric = desktop[vital.key];
        if (!mMetric && !dMetric) return;

        var mVal = mMetric ? _metricDisplay(mMetric) : '-';
        var dVal = dMetric ? _metricDisplay(dMetric) : '-';
        var mRating = mMetric ? mMetric.rating : '';
        var dRating = dMetric ? dMetric.rating : '';
        var desc = (mMetric && mMetric.description) ? esc(truncate(mMetric.description, 140)) : '';

        rows.push([
          '<strong>' + esc(vital.abbr) + '</strong><br><small style="color:#6b7280;">' + esc(vital.name) + '</small><br><small style="color:#9ca3af;">' + esc(vital.category) + '</small>',
          esc(mVal) + '<br>' + (mRating ? _ratingStatus(mRating) : ''),
          esc(dVal) + '<br>' + (dRating ? _ratingStatus(dRating) : ''),
          desc ? '<small style="color:#6b7280;">' + desc + '</small>' : ''
        ]);
      });

      if (rows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '22%' },
            { label: t('reports.cwv.mobile', 'Mobile') + ' (70%)', width: '22%' },
            { label: t('reports.cwv.desktop', 'Desktop') + ' (30%)', width: '22%' },
            { label: t('reports.common.description', 'Description'), width: '34%' }
          ],
          rows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       4. Additional Performance Metrics (FCP, SI, TTI) (NEW)
       Matches web UI renderAdditionalMetric section
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-additional-metrics .pdf-section__content');
      if (!sec) return;

      var desktop = data.desktop || {};
      var mobile = data.mobile || {};
      var dAdd = desktop.additionalMetrics || {};
      var mAdd = mobile.additionalMetrics || {};

      var metricKeys = ['fcp', 'si', 'tti', 'tbt'];
      var hasAny = false;
      metricKeys.forEach(function (k) { if (dAdd[k] || mAdd[k]) hasAny = true; });
      if (!hasAny) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cwv.additionalMetricsTitle', 'Additional Performance Metrics'))),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.additionalMetrics', 'Beyond the three Core Web Vitals, these additional metrics provide deeper insight into your page performance. First Contentful Paint (FCP) measures how quickly the first visible content appears, Speed Index (SI) measures how quickly content is visually displayed, and Time to Interactive (TTI) measures when the page becomes fully interactive.')) + '</p>';

      var metricNames = {
        fcp: t('reports.cwv.fcpName', 'First Contentful Paint'),
        si: t('reports.cwv.siName', 'Speed Index'),
        tti: t('reports.cwv.ttiName', 'Time to Interactive'),
        tbt: t('reports.cwv.report.vitals.tbt', 'Total Blocking Time')
      };

      var rows = [];
      metricKeys.forEach(function (key) {
        var mM = mAdd[key];
        var dM = dAdd[key];
        if (!mM && !dM) return;

        var mVal = mM ? _metricDisplay(mM) : '-';
        var dVal = dM ? _metricDisplay(dM) : '-';
        var mRating = (mM && mM.rating) ? _ratingStatus(mM.rating) : '';
        var dRating = (dM && dM.rating) ? _ratingStatus(dM.rating) : '';
        var desc = ((mM && mM.description) || (dM && dM.description)) ? esc(truncate((mM && mM.description) || (dM && dM.description), 120)) : '';

        rows.push([
          '<strong>' + esc(key.toUpperCase()) + '</strong><br><small style="color:#6b7280;">' + esc(metricNames[key] || key) + '</small>',
          esc(mVal) + (mRating ? '<br>' + mRating : ''),
          esc(dVal) + (dRating ? '<br>' + dRating : ''),
          desc ? '<small style="color:#6b7280;">' + desc + '</small>' : ''
        ]);
      });

      if (rows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '22%' },
            { label: t('reports.cwv.mobile', 'Mobile'), width: '22%' },
            { label: t('reports.cwv.desktop', 'Desktop'), width: '22%' },
            { label: t('reports.common.description', 'Description'), width: '34%' }
          ],
          rows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       5. Best Practices & Optimization Guide (NEW)
       Matches web UI renderBestPracticesTable
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-best-practices .pdf-section__content');
      if (!sec) return;

      var desktop = data.desktop || {};
      var mobile = data.mobile || {};

      if (!mobile.lcp && !desktop.lcp) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var avgScore = 0;
      if (mobile.score !== undefined && desktop.score !== undefined) {
        avgScore = Math.round((mobile.score + desktop.score) / 2);
      } else if (mobile.score !== undefined) {
        avgScore = mobile.score;
      } else if (desktop.score !== undefined) {
        avgScore = desktop.score;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cwv.bestPracticesTitle', 'Best Practices & Optimization Guide'), avgScore || undefined)),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.bestPractices', 'This section provides Google\\')) + '</p>';

      // Build the best practices table (mirrors web UI)
      var vitals = [
        {
          key: 'lcp',
          abbr: 'LCP',
          name: t('reports.cwv.lcpName', 'Largest Contentful Paint'),
          thresholds: t('reports.common.good', 'Good') + ': \u2264 2.5s\n' + t('reports.common.needsWork', 'Needs Work') + ': 2.5s - 4.0s\n' + t('reports.common.poor', 'Poor') + ': > 4.0s',
          tips: [
            t('reports.cwv.tips.lcpOptimizeCritical', 'Optimize Critical Resources') + ': ' + t('reports.cwv.tips.lcpOptimizeCriticalDesc', 'Reduce render-blocking JavaScript and CSS. Inline critical CSS and defer non-essential scripts.'),
            t('reports.cwv.tips.lcpImageOptimization', 'Image Optimization') + ': ' + t('reports.cwv.tips.lcpImageOptimizationDesc', 'Compress largest image/video, use modern formats (WebP, AVIF), implement responsive images with srcset.'),
            t('reports.cwv.tips.lcpServerPerformance', 'Server Performance') + ': ' + t('reports.cwv.tips.lcpServerPerformanceDesc', 'Use CDN, enable HTTP/2, implement server-side caching, reduce server response time (TTFB).'),
            t('reports.cwv.tips.lcpResourceHints', 'Resource Hints') + ': ' + t('reports.cwv.tips.lcpResourceHintsDesc', 'Add preload for critical resources, preconnect to required origins, use priority hints for important images.')
          ]
        },
        {
          key: 'inp',
          abbr: 'INP',
          name: t('reports.cwv.inpName', 'Interaction to Next Paint'),
          thresholds: t('reports.common.good', 'Good') + ': \u2264 200ms\n' + t('reports.common.needsWork', 'Needs Work') + ': 200ms - 500ms\n' + t('reports.common.poor', 'Poor') + ': > 500ms',
          tips: [
            t('reports.cwv.tips.inpMinimizeJs', 'Minimize JavaScript') + ': ' + t('reports.cwv.tips.inpMinimizeJsDesc', 'Remove unused code, split bundles, lazy load non-critical JavaScript. Keep main thread under 50ms per task.'),
            t('reports.cwv.tips.inpOptimizeHandlers', 'Optimize Event Handlers') + ': ' + t('reports.cwv.tips.inpOptimizeHandlersDesc', 'Debounce/throttle input handlers, use passive event listeners, avoid synchronous layout calculations.'),
            t('reports.cwv.tips.inpWebWorkers', 'Web Workers') + ': ' + t('reports.cwv.tips.inpWebWorkersDesc', 'Move heavy computations to web workers, use requestIdleCallback for non-urgent tasks.'),
            t('reports.cwv.tips.inpThirdParty', 'Third-Party Scripts') + ': ' + t('reports.cwv.tips.inpThirdPartyDesc', 'Audit and remove unnecessary third-party scripts, load them asynchronously, use facade patterns for heavy widgets.')
          ]
        },
        {
          key: 'cls',
          abbr: 'CLS',
          name: t('reports.cwv.clsName', 'Cumulative Layout Shift'),
          thresholds: t('reports.common.good', 'Good') + ': \u2264 0.1\n' + t('reports.common.needsWork', 'Needs Work') + ': 0.1 - 0.25\n' + t('reports.common.poor', 'Poor') + ': > 0.25',
          tips: [
            t('reports.cwv.tips.clsReserveSpace', 'Reserve Space') + ': ' + t('reports.cwv.tips.clsReserveSpaceDesc', 'Set explicit width/height on images and videos, use CSS aspect-ratio property, reserve space for ads and embeds.'),
            t('reports.cwv.tips.clsFontLoading', 'Font Loading') + ': ' + t('reports.cwv.tips.clsFontLoadingDesc', 'Use font-display: swap, preload critical fonts, avoid invisible text during font load (FOIT).'),
            t('reports.cwv.tips.clsDynamicContent', 'Dynamic Content') + ': ' + t('reports.cwv.tips.clsDynamicContentDesc', 'Never insert content above existing content without user interaction, use transform animations instead of layout-shifting properties.'),
            t('reports.cwv.tips.clsCssBestPractices', 'CSS Best Practices') + ': ' + t('reports.cwv.tips.clsCssBestPracticesDesc', 'Avoid animations on layout properties (width, height, top, left), use transform and opacity instead.')
          ]
        }
      ];

      vitals.forEach(function (vital) {
        var mMetric = mobile[vital.key];
        var dMetric = desktop[vital.key];
        if (!mMetric && !dMetric) return;

        var mVal = mMetric ? _metricDisplay(mMetric) : '-';
        var dVal = dMetric ? _metricDisplay(dMetric) : '-';
        var mR = mMetric ? mMetric.rating : '';
        var dR = dMetric ? dMetric.rating : '';

        // Determine combined status
        var bothGood = mR === 'good' && dR === 'good';
        var eitherGood = mR === 'good' || dR === 'good';
        var statusIcon = bothGood ? 'pass' : eitherGood ? 'warn' : 'fail';
        var statusLabel = bothGood ? t('reports.common.pass', 'Pass') : eitherGood ? t('reports.common.partial', 'Partial') : t('reports.common.fail', 'Fail');

        // Build the vital card
        html += '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem;page-break-inside:avoid;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">';
        html += '<div><strong style="font-size:1.1rem;">' + esc(vital.abbr) + '</strong> <span style="color:#6b7280;">' + esc(vital.name) + '</span></div>';
        html += PR.renderStatus(statusIcon, statusLabel);
        html += '</div>';

        // Thresholds + values row as a table
        var threshLines = vital.thresholds.split('\n');
        var threshHtml = threshLines.map(function (line) { return esc(line); }).join('<br>');

        html += PR.renderTable(
          [
            { label: t('reports.cwv.googleTarget', 'Google Target'), width: '30%' },
            { label: t('reports.cwv.mobile', 'Mobile'), width: '20%' },
            { label: t('reports.cwv.desktop', 'Desktop'), width: '20%' },
            { label: t('reports.common.status', 'Status'), width: '30%' }
          ],
          [
            [
              '<small>' + threshHtml + '</small>',
              '<strong style="color:' + _ratingColor(mR) + ';">' + esc(mVal) + '</strong><br>' + (mR ? _ratingStatus(mR) : ''),
              '<strong style="color:' + _ratingColor(dR) + ';">' + esc(dVal) + '</strong><br>' + (dR ? _ratingStatus(dR) : ''),
              PR.renderStatus(statusIcon, statusLabel)
            ]
          ],
          { striped: false }
        );

        // Optimization tips
        html += '<div style="margin-top:0.75rem;">';
        html += '<strong style="color:#374151;font-size:0.9rem;">' + esc(t('reports.cwv.optimizationRecommendations', 'Optimization Recommendations')) + '</strong>';
        html += '<ol style="margin:0.5rem 0 0 1.25rem;padding:0;color:#4b5563;font-size:0.85rem;line-height:1.6;">';
        vital.tips.forEach(function (tip) {
          html += '<li style="margin-bottom:0.4rem;">' + esc(tip) + '</li>';
        });
        html += '</ol>';
        html += '</div>';
        html += '</div>';
      });

      // Google methodology callout
      html += PR.renderCallout(
        t('reports.cwv.googleMethodology', "Google's Evaluation Methodology"),
        t('reports.cwv.googleMethodologyDesc', 'Google evaluates Core Web Vitals at the 75th percentile of all page loads. This means:') + ' ' +
        t('reports.cwv.mobileWeighting', 'Mobile Weighting') + ': ' +
        t('reports.cwv.mobileWeightingDesc', 'Mobile performance counts for 70% of your overall score because Google uses mobile-first indexing for search rankings.'),
        'tip'
      );

      sec.innerHTML = html;
    })();

    /* =====================================================================
       6. Desktop vs Mobile Comparison
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-comparison .pdf-section__content');
      var comp = data.comparison || {};
      var desktop = data.desktop || {};
      var mobile = data.mobile || {};

      if (!comp && !desktop.lcp && !mobile.lcp) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cwv.report.comparison', 'Desktop vs Mobile'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.comparison', 'This comparison highlights the differences between your desktop and mobile Core Web Vitals scores. Significant gaps between the two may indicate mobile-specific performance issues such as unoptimized images, render-blocking resources, or layout shifts that only occur on smaller viewports.')) + '</p>';

      // Overall score comparison
      if (desktop.score !== undefined || mobile.score !== undefined) {
        html += PR.renderMetrics([
          { value: desktop.score !== undefined ? String(desktop.score) + '/100' : '-', label: t('reports.cwv.report.comparison.desktopScore', 'Desktop Score'), color: desktop.score >= 90 ? '#10b981' : desktop.score >= 50 ? '#f59e0b' : '#ef4444' },
          { value: mobile.score !== undefined ? String(mobile.score) + '/100' : '-', label: t('reports.cwv.report.comparison.mobileScore', 'Mobile Score'), color: mobile.score >= 90 ? '#10b981' : mobile.score >= 50 ? '#f59e0b' : '#ef4444' }
        ]);
      }

      // Build comparison table with progress-bar-like visual
      var metricNames = [
        { key: 'lcp', label: t('reports.cwv.report.vitals.lcp', 'Largest Contentful Paint (LCP)') },
        { key: 'inp', label: t('reports.cwv.report.vitals.inp', 'Interaction to Next Paint (INP)') },
        { key: 'cls', label: t('reports.cwv.report.vitals.cls', 'Cumulative Layout Shift (CLS)') },
        { key: 'ttfb', label: t('reports.cwv.report.vitals.ttfb', 'Time to First Byte (TTFB)') },
        { key: 'fcp', label: t('reports.cwv.report.vitals.fcp', 'First Contentful Paint (FCP)') }
      ];

      var compRows = [];
      metricNames.forEach(function (m) {
        var dMetric = desktop[m.key];
        var mMetric = mobile[m.key];
        if (!dMetric && !mMetric) return;

        var dVal = dMetric ? _metricDisplay(dMetric) : '-';
        var mVal = mMetric ? _metricDisplay(mMetric) : '-';

        compRows.push([
          '<strong>' + esc(m.label) + '</strong>',
          '<span style="color:' + (dMetric ? _ratingColor(dMetric.rating) : '#6b7280') + ';font-weight:600;">' + esc(dVal) + '</span><br>' + (dMetric ? _ratingStatus(dMetric.rating) : ''),
          '<span style="color:' + (mMetric ? _ratingColor(mMetric.rating) : '#6b7280') + ';font-weight:600;">' + esc(mVal) + '</span><br>' + (mMetric ? _ratingStatus(mMetric.rating) : '')
        ]);
      });

      if (compRows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '34%' },
            { label: t('common.desktop', 'Desktop'), width: '33%' },
            { label: t('common.mobile', 'Mobile'), width: '33%' }
          ],
          compRows,
          { striped: true }
        );
      }

      // Render comparison-specific data if provided (context, note)
      if (comp && typeof comp === 'object') {
        // Context & note (from web UI comparison.context / comparison.note)
        if (comp.context || comp.note) {
          html += PR.renderCallout(
            t('reports.cwv.report.comparison.context', 'Comparison Context'),
            (comp.context ? esc(comp.context) : '') + (comp.note ? ' ' + esc(comp.note) : ''),
            'tip'
          );
        }

        // Per-metric comparison details (from web UI comparison.comparison.lcp, etc.)
        if (comp.comparison && typeof comp.comparison === 'object') {
          var compDetailRows = [];
          var compMetrics = Object.keys(comp.comparison);
          compMetrics.forEach(function (metricKey) {
            var cm = comp.comparison[metricKey];
            if (!cm || typeof cm !== 'object') return;
            var parts = [];
            if (cm.percentile) parts.push(esc(cm.percentile));
            if (cm.realWorldImpact) parts.push(esc(cm.realWorldImpact));
            if (cm.assessment) parts.push(esc(cm.assessment));
            if (parts.length > 0) {
              compDetailRows.push([
                '<strong>' + esc(metricKey.toUpperCase()) + '</strong>',
                parts.join(' — ')
              ]);
            }
          });
          if (compDetailRows.length > 0) {
            html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.comparison.percentileAnalysis', 'Percentile Analysis')) + '</h3>';
            html += PR.renderTable(
              [
                { label: t('seo.report.table.metric', 'Metric'), width: '20%' },
                { label: t('reports.cwv.report.comparison.analysis', 'Analysis'), width: '80%' }
              ],
              compDetailRows,
              { striped: true }
            );
          }
        }

        // Flat scalar comparison keys
        var compKeys = Object.keys(comp);
        var extraRows = [];
        compKeys.forEach(function (key) {
          var val = comp[key];
          if (typeof val === 'object' && val !== null) return;
          if (key === 'context' || key === 'note') return;
          extraRows.push([
            '<strong>' + esc(key) + '</strong>',
            esc(String(val))
          ]);
        });
        if (extraRows.length > 0) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.comparison.summary', 'Comparison Summary')) + '</h3>';
          html += PR.renderTable(
            [
              { label: t('seo.report.table.property', 'Property'), width: '50%' },
              { label: t('seo.report.table.value', 'Value'), width: '50%' }
            ],
            extraRows,
            { striped: true }
          );
        }
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       7. Diagnostics
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-diagnostics .pdf-section__content');
      var desktop = data.desktop || {};
      var mobile = data.mobile || {};
      var desktopDiag = desktop.diagnostics || [];
      var mobileDiag = mobile.diagnostics || [];

      if (desktopDiag.length === 0 && mobileDiag.length === 0) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cwv.report.diagnostics', 'Diagnostics'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.diagnostics', 'Diagnostic information provides detailed technical insights into the factors affecting your Core Web Vitals scores. These diagnostics help identify specific elements, resources, or code patterns that contribute to poor performance metrics.')) + '</p>';

      /** Render a diagnostics set as a table for richer display */
      function _renderDiagnostics(diagList, limitCount) {
        var out = '';
        var rows = [];
        diagList.slice(0, limitCount).forEach(function (item) {
          var sev = (item.severity || item.priority || 'medium').toLowerCase();
          var sevBadge = '<span class="pdf-issue__severity pdf-issue__severity--' + sev + '" style="display:inline-block;margin-bottom:0.25rem;">' + esc(translateImpact(item.severity || item.priority || 'info')) + '</span>';

          var title = item.title || item.name || '';
          var desc = item.description ? truncate(item.description, 350) : '';
          var displayVal = item.displayValue || '';
          var score = item.score !== undefined ? item.score : null;

          var detailParts = [];
          if (displayVal) detailParts.push('<em>' + esc(displayVal) + '</em>');
          if (score !== null) detailParts.push(t('reports.common.score', 'Score') + ': ' + esc(String(score)));
          if (item.numericValue) detailParts.push(esc(String(Math.round(item.numericValue))) + (item.numericUnit === 'millisecond' ? ' ms' : ''));

          rows.push([
            sevBadge,
            '<strong>' + esc(title) + '</strong>' +
              (desc ? '<br><small style="color:#6b7280;">' + esc(desc) + '</small>' : ''),
            detailParts.length > 0 ? detailParts.join('<br>') : '-'
          ]);
        });

        if (rows.length > 0) {
          out += PR.renderTable(
            [
              { label: t('reports.common.severity', 'Severity'), width: '12%' },
              { label: t('reports.common.diagnostic', 'Diagnostic'), width: '60%' },
              { label: t('seo.report.table.value', 'Value'), width: '28%' }
            ],
            rows,
            { striped: true }
          );
        }
        return out;
      }

      // Desktop diagnostics
      if (desktopDiag.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.diagnostics.desktop', 'Desktop Diagnostics')) + ' (' + desktopDiag.length + ')</h3>';
        html += _renderDiagnostics(desktopDiag, 20);
      }

      // Mobile diagnostics
      if (mobileDiag.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.diagnostics.mobile', 'Mobile Diagnostics')) + ' (' + mobileDiag.length + ')</h3>';
        html += _renderDiagnostics(mobileDiag, 20);
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       8. Recommendations (enhanced with metric, issue, solution, priority)
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cwv.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.recommendations', 'Based on your Core Web Vitals analysis, these recommendations target the highest-impact improvements for loading speed, interactivity, and visual stability.')) + '</p>';

      // Try enrichedFixes first (for consistency with other analyzers), then fall back to recommendations
      // pdf-export-utility may store enriched fixes as data.enrichedFixes.cwv (array) or data.enrichedFixes (array)
      var recs = null;
      if (data.enrichedFixes) {
        if (Array.isArray(data.enrichedFixes)) {
          recs = data.enrichedFixes;
        } else if (Array.isArray(data.enrichedFixes.cwv)) {
          recs = data.enrichedFixes.cwv;
        }
      }
      if (!recs || recs.length === 0) {
        recs = data.recommendations || [];
      }
      if (recs.length > 0) {
        // Group by priority/severity
        var critical = recs.filter(function (r) { return r.priority === 'critical' || r.severity === 'critical' || r.priority === 'high' || r.severity === 'high'; });
        var medium = recs.filter(function (r) { return r.priority === 'medium' || r.severity === 'medium'; });
        var low = recs.filter(function (r) {
          var p = r.priority || r.severity || '';
          return p === 'low' || (!p && critical.indexOf(r) === -1 && medium.indexOf(r) === -1);
        });

        var groups = [
          { items: critical, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#ef4444', sev: 'critical' },
          { items: medium, label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: '#f59e0b', sev: 'moderate' },
          { items: low, label: t('common.pdf.execSummary.lowPriority', 'Low Priority'), color: '#3b82f6', sev: 'minor' }
        ];

        // Summary metrics
        html += PR.renderMetrics([
          { value: String(recs.length), label: t('reports.cwv.report.recommendations.total', 'Total Recommendations'), color: '#6b7280' },
          { value: String(critical.length), label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#ef4444' },
          { value: String(medium.length), label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: '#f59e0b' },
          { value: String(low.length), label: t('common.pdf.execSummary.lowPriority', 'Low Priority'), color: '#3b82f6' }
        ]);

        groups.forEach(function (group) {
          if (group.items.length === 0) return;
          html += '<h3 class="pdf-subsection__title" style="color:' + group.color + ';">' + esc(group.label) + ' (' + group.items.length + ')</h3>';

          group.items.forEach(function (r) {
            // Build rich recommendation card
            html += '<div class="pdf-rec" style="border-left:4px solid ' + group.color + ';padding:0.75rem 1rem;margin-bottom:0.75rem;background:#f9fafb;border-radius:0 6px 6px 0;page-break-inside:avoid;">';

            // Header: metric + priority badge
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">';
            html += '<strong style="font-size:1rem;color:#111827;">' + esc(r.metric || r.title || '') + '</strong>';
            html += '<span class="pdf-issue__severity pdf-issue__severity--' + group.sev + '">' + esc(translateImpact(r.priority || r.severity || 'info')) + '</span>';
            html += '</div>';

            // Issue (subtitle)
            if (r.issue) {
              html += '<div style="color:#4b5563;margin-bottom:0.4rem;"><strong>' + esc(t('reports.cwv.report.recommendations.issue', 'Issue')) + ':</strong> ' + esc(r.issue) + '</div>';
            }

            // Solution
            if (r.solution) {
              html += '<div style="color:#4b5563;margin-bottom:0.4rem;"><strong>' + esc(t('reports.cwv.report.recommendations.solution', 'Solution')) + ':</strong> ' + esc(r.solution) + '</div>';
            }

            // Description (fallback if no issue/solution)
            if (!r.issue && !r.solution && r.description) {
              html += '<div style="color:#4b5563;">' + esc(r.description) + '</div>';
            }

            // Title as secondary if metric was used as primary
            if (r.metric && r.title && r.metric !== r.title) {
              html += '<div style="color:#6b7280;font-size:0.85rem;margin-top:0.25rem;">' + esc(r.title) + '</div>';
            }

            html += '</div>';
          });
        });
      } else {
        html += PR.renderCallout(
          t('reports.cwv.report.recommendations.noneTitle', 'Excellent Core Web Vitals'),
          t('reports.cwv.report.recommendations.noneBody', 'Your site achieves good scores across all Core Web Vitals. Continue monitoring for regressions as content and traffic patterns change.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* =====================================================================
       9. Understanding Your Scores (NEW — matches web UI)
       ===================================================================== */
    (function () {
      var sec = document.querySelector('#section-understanding .pdf-section__content');
      if (!sec) return;

      var comp = data.comparison || {};

      if (!comp.context && !comp.note && !comp.comparison) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cwv.understandingScoresTitle', 'Understanding Your Scores'))),
        sec
      );

      var html = '';

      // Context and note
      if (comp.context) {
        html += '<p class="pdf-section__intro">' + esc(comp.context) + '</p>';
      }
      if (comp.note) {
        html += '<p style="color:#6b7280;font-size:0.9rem;margin-bottom:1rem;">' + esc(comp.note) + '</p>';
      }

      // Per-metric percentile and real world impact
      if (comp.comparison && typeof comp.comparison === 'object') {
        var percRows = [];
        var percKeys = Object.keys(comp.comparison);
        percKeys.forEach(function (key) {
          var cm = comp.comparison[key];
          if (!cm || typeof cm !== 'object') return;
          var details = [];
          if (cm.percentile) details.push('<strong>' + esc(t('reports.cwv.report.comparison.percentile', 'Percentile')) + ':</strong> ' + esc(cm.percentile));
          if (cm.realWorldImpact) details.push('<strong>' + esc(t('reports.cwv.report.comparison.realWorldImpact', 'Real World Impact')) + ':</strong> ' + esc(cm.realWorldImpact));
          if (cm.assessment) details.push('<strong>' + esc(t('reports.cwv.report.comparison.assessment', 'Assessment')) + ':</strong> ' + esc(cm.assessment));

          if (details.length > 0) {
            percRows.push([
              '<strong>' + esc(key.toUpperCase()) + '</strong>',
              details.join('<br>')
            ]);
          }
        });

        if (percRows.length > 0) {
          html += PR.renderTable(
            [
              { label: t('seo.report.table.metric', 'Metric'), width: '15%' },
              { label: t('reports.cwv.report.comparison.details', 'Details'), width: '85%' }
            ],
            percRows,
            { striped: true }
          );
        }
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

  function _htmlToNode(html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.firstChild;
  }

})(window);
