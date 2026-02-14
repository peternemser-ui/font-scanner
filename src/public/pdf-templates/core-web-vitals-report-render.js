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

    /** Map a CWV rating string to a renderStatus call */
    function _ratingStatus(rating) {
      if (rating === 'good') return PR.renderStatus('pass', t('reports.cwv.report.cwv.good', 'Good'));
      if (rating === 'needs-improvement') return PR.renderStatus('warn', t('reports.cwv.report.cwv.needsImprovement', 'Needs Improvement'));
      if (rating === 'poor') return PR.renderStatus('fail', t('reports.cwv.report.cwv.poor', 'Poor'));
      return PR.renderStatus('na', rating || '-');
    }

    /** Build a metric card row for a single vital */
    function _vitalRow(label, metric) {
      if (!metric) return null;
      var display = metric.value !== undefined && metric.value !== null
        ? String(metric.value) + (metric.unit ? ' ' + metric.unit : '')
        : '-';
      return [
        '<strong>' + esc(label) + '</strong>',
        esc(display),
        _ratingStatus(metric.rating)
      ];
    }

    /** Build metrics cards array from a vitals object */
    function _buildMetricsCards(vitals) {
      var cards = [];
      if (vitals.lcp && vitals.lcp.value !== undefined) {
        cards.push({
          value: String(vitals.lcp.value) + (vitals.lcp.unit ? ' ' + vitals.lcp.unit : ''),
          label: 'LCP',
          color: vitals.lcp.rating === 'good' ? '#10b981' : vitals.lcp.rating === 'poor' ? '#ef4444' : '#f59e0b'
        });
      }
      if (vitals.inp && vitals.inp.value !== undefined) {
        cards.push({
          value: String(vitals.inp.value) + (vitals.inp.unit ? ' ' + vitals.inp.unit : ''),
          label: 'INP',
          color: vitals.inp.rating === 'good' ? '#10b981' : vitals.inp.rating === 'poor' ? '#ef4444' : '#f59e0b'
        });
      }
      if (vitals.cls && vitals.cls.value !== undefined) {
        cards.push({
          value: String(vitals.cls.value) + (vitals.cls.unit ? ' ' + vitals.cls.unit : ''),
          label: 'CLS',
          color: vitals.cls.rating === 'good' ? '#10b981' : vitals.cls.rating === 'poor' ? '#ef4444' : '#f59e0b'
        });
      }
      if (vitals.ttfb && vitals.ttfb.value !== undefined) {
        cards.push({
          value: String(vitals.ttfb.value) + (vitals.ttfb.unit ? ' ' + vitals.ttfb.unit : ''),
          label: 'TTFB',
          color: vitals.ttfb.rating === 'good' ? '#10b981' : vitals.ttfb.rating === 'poor' ? '#ef4444' : '#f59e0b'
        });
      }
      if (vitals.fcp && vitals.fcp.value !== undefined) {
        cards.push({
          value: String(vitals.fcp.value) + (vitals.fcp.unit ? ' ' + vitals.fcp.unit : ''),
          label: 'FCP',
          color: vitals.fcp.rating === 'good' ? '#10b981' : vitals.fcp.rating === 'poor' ? '#ef4444' : '#f59e0b'
        });
      }
      return cards;
    }

    /** Build a vitals table from a device data object */
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
        var row = _vitalRow(n.label, vitals[n.key]);
        if (row) rows.push(row);
      });
      return rows;
    }

    /* -----------------------------------------------------------------------
       1. Desktop Vitals
       ----------------------------------------------------------------------- */
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

      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.desktop', 'Core Web Vitals measure real-world user experience on desktop devices. These metrics — Largest Contentful Paint (LCP), Interaction to Next Paint (INP), and Cumulative Layout Shift (CLS) — are key ranking signals used by Google. This section presents your desktop performance across all five vitals with color-coded ratings based on Google\'s published thresholds.')) + '</p>';

      // Metric cards
      var cards = _buildMetricsCards(d);
      if (cards.length > 0) {
        html += PR.renderMetrics(cards);
      }

      // Detail table
      var rows = _buildVitalsTable(d);
      if (rows.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.desktop.details', 'Metric Details')) + '</h3>';
        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '40%' },
            { label: t('seo.report.table.value', 'Value'), width: '30%' },
            { label: t('seo.report.table.status', 'Rating'), width: '30%' }
          ],
          rows,
          { striped: true }
        );
      }

      // Additional metrics
      if (d.additionalMetrics) {
        var addRows = [];
        var addKeys = Object.keys(d.additionalMetrics);
        if (addKeys.length > 0) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.desktop.additionalMetrics', 'Additional Metrics')) + '</h3>';
          addKeys.forEach(function (key) {
            var m = d.additionalMetrics[key];
            var val = (typeof m === 'object' && m !== null)
              ? (m.value !== undefined ? String(m.value) + (m.unit ? ' ' + m.unit : '') : '-')
              : String(m);
            addRows.push([
              '<strong>' + esc(key) + '</strong>',
              esc(val)
            ]);
          });
          html += PR.renderTable(
            [
              { label: t('seo.report.table.metric', 'Metric'), width: '50%' },
              { label: t('seo.report.table.value', 'Value'), width: '50%' }
            ],
            addRows,
            { striped: true }
          );
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Mobile Vitals
       ----------------------------------------------------------------------- */
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

      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.mobile', 'Mobile performance is critical as the majority of web traffic now comes from mobile devices. Google uses mobile-first indexing, making mobile Core Web Vitals especially important for search rankings. This section presents your mobile performance metrics with the same five vitals. Mobile scores often differ significantly from desktop due to reduced processing power and network variability.')) + '</p>';

      // Metric cards
      var cards = _buildMetricsCards(d);
      if (cards.length > 0) {
        html += PR.renderMetrics(cards);
      }

      // Detail table
      var rows = _buildVitalsTable(d);
      if (rows.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.mobile.details', 'Metric Details')) + '</h3>';
        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '40%' },
            { label: t('seo.report.table.value', 'Value'), width: '30%' },
            { label: t('seo.report.table.status', 'Rating'), width: '30%' }
          ],
          rows,
          { striped: true }
        );
      }

      // Additional metrics
      if (d.additionalMetrics) {
        var addRows = [];
        var addKeys = Object.keys(d.additionalMetrics);
        if (addKeys.length > 0) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.mobile.additionalMetrics', 'Additional Metrics')) + '</h3>';
          addKeys.forEach(function (key) {
            var m = d.additionalMetrics[key];
            var val = (typeof m === 'object' && m !== null)
              ? (m.value !== undefined ? String(m.value) + (m.unit ? ' ' + m.unit : '') : '-')
              : String(m);
            addRows.push([
              '<strong>' + esc(key) + '</strong>',
              esc(val)
            ]);
          });
          html += PR.renderTable(
            [
              { label: t('seo.report.table.metric', 'Metric'), width: '50%' },
              { label: t('seo.report.table.value', 'Value'), width: '50%' }
            ],
            addRows,
            { striped: true }
          );
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Desktop vs Mobile Comparison
       ----------------------------------------------------------------------- */
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

      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.comparison', 'This section provides a side-by-side comparison of your Core Web Vitals between desktop and mobile environments. Significant differences may indicate device-specific optimizations are needed. Ideally, both environments should achieve "Good" ratings across all metrics. Large gaps between desktop and mobile scores often point to responsive design issues, unoptimized images, or excessive JavaScript execution on mobile.')) + '</p>';

      // Build comparison table
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

        var dVal = dMetric
          ? String(dMetric.value !== undefined ? dMetric.value : '-') + (dMetric.unit ? ' ' + dMetric.unit : '')
          : '-';
        var mVal = mMetric
          ? String(mMetric.value !== undefined ? mMetric.value : '-') + (mMetric.unit ? ' ' + mMetric.unit : '')
          : '-';

        compRows.push([
          '<strong>' + esc(m.label) + '</strong>',
          esc(dVal) + ' ' + (dMetric ? _ratingStatus(dMetric.rating) : ''),
          esc(mVal) + ' ' + (mMetric ? _ratingStatus(mMetric.rating) : '')
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

      // Overall score comparison
      if (desktop.score !== undefined || mobile.score !== undefined) {
        html += PR.renderMetrics([
          { value: desktop.score !== undefined ? desktop.score : '-', label: t('reports.cwv.report.comparison.desktopScore', 'Desktop Score'), color: desktop.score >= 90 ? '#10b981' : desktop.score >= 50 ? '#f59e0b' : '#ef4444' },
          { value: mobile.score !== undefined ? mobile.score : '-', label: t('reports.cwv.report.comparison.mobileScore', 'Mobile Score'), color: mobile.score >= 90 ? '#10b981' : mobile.score >= 50 ? '#f59e0b' : '#ef4444' }
        ]);
      }

      // Render comparison-specific data if provided
      if (comp && typeof comp === 'object' && Object.keys(comp).length > 0) {
        var compKeys = Object.keys(comp);
        var extraRows = [];
        compKeys.forEach(function (key) {
          var val = comp[key];
          if (typeof val === 'object' && val !== null) return; // skip nested objects already handled
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

    /* -----------------------------------------------------------------------
       4. Diagnostics
       ----------------------------------------------------------------------- */
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

      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.diagnostics', 'Diagnostics provide detailed technical insights from Lighthouse audits for both desktop and mobile environments. These items highlight specific performance bottlenecks, resource loading issues, and optimization opportunities that affect your Core Web Vitals scores. Addressing these diagnostics can lead to measurable improvements in page load times and user experience.')) + '</p>';

      // Desktop diagnostics
      if (desktopDiag.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.diagnostics.desktop', 'Desktop Diagnostics')) + '</h3>';
        desktopDiag.slice(0, 15).forEach(function (item) {
          var sev = (item.severity || item.priority || 'medium').toLowerCase();
          html += '<div class="pdf-issue pdf-issue--' + sev + '">' +
            '<span class="pdf-issue__severity pdf-issue__severity--' + sev + '">' + esc(translateImpact(item.severity || item.priority || 'info')) + '</span>' +
            '<span class="pdf-issue__text"><strong>' + esc(item.title || item.name || '') + '</strong>' +
            (item.description ? ' — ' + esc(truncate(item.description, 200)) : '') +
            (item.displayValue ? ' <em>(' + esc(item.displayValue) + ')</em>' : '') +
            '</span>' +
          '</div>';
        });
      }

      // Mobile diagnostics
      if (mobileDiag.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cwv.report.diagnostics.mobile', 'Mobile Diagnostics')) + '</h3>';
        mobileDiag.slice(0, 15).forEach(function (item) {
          var sev = (item.severity || item.priority || 'medium').toLowerCase();
          html += '<div class="pdf-issue pdf-issue--' + sev + '">' +
            '<span class="pdf-issue__severity pdf-issue__severity--' + sev + '">' + esc(translateImpact(item.severity || item.priority || 'info')) + '</span>' +
            '<span class="pdf-issue__text"><strong>' + esc(item.title || item.name || '') + '</strong>' +
            (item.description ? ' — ' + esc(truncate(item.description, 200)) : '') +
            (item.displayValue ? ' <em>(' + esc(item.displayValue) + ')</em>' : '') +
            '</span>' +
          '</div>';
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cwv.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cwv.report.sectionIntros.recommendations', 'Based on the Core Web Vitals analysis, this section provides actionable recommendations to improve your site\'s performance across both desktop and mobile. Each recommendation is prioritized by severity and includes the affected area and suggested remediation. Focus on high-priority items first, as they will have the greatest impact on your Core Web Vitals scores and search rankings.')) + '</p>';

      var recs = data.recommendations || [];
      if (recs.length > 0) {
        // Group by priority/severity
        var critical = recs.filter(function (r) { return r.priority === 'critical' || r.severity === 'critical' || r.priority === 'high' || r.severity === 'high'; });
        var medium = recs.filter(function (r) { return r.priority === 'medium' || r.severity === 'medium'; });
        var low = recs.filter(function (r) {
          var p = r.priority || r.severity || '';
          return p === 'low' || (!p && critical.indexOf(r) === -1 && medium.indexOf(r) === -1);
        });

        var groups = [
          { items: critical, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#ef4444' },
          { items: medium, label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: '#f59e0b' },
          { items: low, label: t('common.pdf.execSummary.lowPriority', 'Low Priority'), color: '#3b82f6' }
        ];

        groups.forEach(function (group) {
          if (group.items.length === 0) return;
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:' + group.color + ';">&#9679; ' + group.label + ' (' + group.items.length + ')</div>';
          group.items.forEach(function (r) {
            html += '<div class="pdf-rec" style="border-left-color:' + group.color + ';">' +
              '<div class="pdf-rec__text"><strong>' + esc(r.title || '') + '</strong>' +
              (r.description ? '<br>' + esc(r.description) : '') +
              '</div>' +
            '</div>';
          });
          html += '</div>';
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
