/**
 * Performance Report — PDF Renderer
 * Renders all performance analysis sections into the PDF template.
 * Detects mode from data shape: Quick, CWV, or Full.
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

    // Detect data sources
    var desktop = data.desktop || {};
    var mobile = data.mobile || {};
    var cwv = desktop.coreWebVitals || data.coreWebVitals || {};
    var mobileCwv = mobile.coreWebVitals || {};
    var resources = data.resources || {};
    var network = data.network || {};
    var caching = data.caching || {};
    var desktopLH = desktop.lighthouse || {};
    var mobileLH = mobile.lighthouse || {};

    /** CWV badge color */
    function cwvColor(metric, value) {
      if (metric === 'lcp') return value <= 2500 ? '#10b981' : value <= 4000 ? '#f59e0b' : '#ef4444';
      if (metric === 'fid' || metric === 'inp') return value <= 200 ? '#10b981' : value <= 500 ? '#f59e0b' : '#ef4444';
      if (metric === 'cls') return value <= 0.1 ? '#10b981' : value <= 0.25 ? '#f59e0b' : '#ef4444';
      if (metric === 'ttfb') return value <= 800 ? '#10b981' : value <= 1800 ? '#f59e0b' : '#ef4444';
      return '#6b7280';
    }

    function cwvLabel(metric, value) {
      var thresholds = {
        lcp: [2500, 4000], fid: [100, 300], inp: [200, 500], cls: [0.1, 0.25], ttfb: [800, 1800]
      };
      var th = thresholds[metric] || [0, 0];
      if (value <= th[0]) return t('performance.report.cwv.good', 'Good');
      if (value <= th[1]) return t('performance.report.cwv.needsImprovement', 'Needs Improvement');
      return t('performance.report.cwv.poor', 'Poor');
    }

    /* -----------------------------------------------------------------------
       1. Core Web Vitals
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cwv .pdf-section__content');
      if (!cwv.lcp && !cwv.lcpMs && !cwv.score) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = cwv.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.coreWebVitals', 'Core Web Vitals'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.cwv', 'Core Web Vitals are Google\'s key metrics for measuring real-world user experience. They assess loading speed (LCP), interactivity (INP/FID), and visual stability (CLS). These metrics directly influence search rankings through Google\'s page experience signals. This section presents your Core Web Vitals scores for both desktop and mobile, with performance ratings based on Google\'s published thresholds.')) + '</p>';

      // Desktop CWV metrics
      html += '<h3 class="pdf-subsection__title">' + esc(t('common.desktop', 'Desktop')) + '</h3>';
      var desktopMetrics = [];
      if (cwv.lcp || cwv.lcpMs) {
        var lcpMs = cwv.lcpMs || parseFloat(cwv.lcp) * 1000 || 0;
        desktopMetrics.push({ value: cwv.lcp || (lcpMs / 1000).toFixed(2) + 's', label: 'LCP', color: cwvColor('lcp', lcpMs) });
      }
      if (cwv.fid || cwv.fidMs) {
        desktopMetrics.push({ value: cwv.fid || cwv.fidMs + 'ms', label: 'FID', color: cwvColor('fid', cwv.fidMs || parseFloat(cwv.fid) || 0) });
      }
      if (cwv.cls !== undefined) {
        var clsNum = cwv.clsNum || parseFloat(cwv.cls) || 0;
        desktopMetrics.push({ value: cwv.cls, label: 'CLS', color: cwvColor('cls', clsNum) });
      }
      if (cwv.ttfb) {
        desktopMetrics.push({ value: cwv.ttfb, label: 'TTFB' });
      }
      if (cwv.fcp) {
        desktopMetrics.push({ value: cwv.fcp, label: 'FCP' });
      }
      if (desktopMetrics.length > 0) {
        html += PR.renderMetrics(desktopMetrics);
      }

      // Mobile CWV if available
      if (mobileCwv.lcp || mobileCwv.lcpMs) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('common.mobile', 'Mobile')) + '</h3>';
        var mobileMetrics = [];
        if (mobileCwv.lcp || mobileCwv.lcpMs) {
          var mLcpMs = mobileCwv.lcpMs || parseFloat(mobileCwv.lcp) * 1000 || 0;
          mobileMetrics.push({ value: mobileCwv.lcp || (mLcpMs / 1000).toFixed(2) + 's', label: 'LCP', color: cwvColor('lcp', mLcpMs) });
        }
        if (mobileCwv.cls !== undefined) {
          mobileMetrics.push({ value: mobileCwv.cls, label: 'CLS', color: cwvColor('cls', mobileCwv.clsNum || parseFloat(mobileCwv.cls) || 0) });
        }
        if (mobileCwv.fcp) {
          mobileMetrics.push({ value: mobileCwv.fcp, label: 'FCP' });
        }
        if (mobileMetrics.length > 0) {
          html += PR.renderMetrics(mobileMetrics);
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Lighthouse Category Scores
       ----------------------------------------------------------------------- */
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

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.lighthouse', 'Google Lighthouse provides automated auditing across four categories: Performance, Accessibility, Best Practices, and SEO. Scores are calculated from dozens of individual audits weighted by impact. This section presents your Lighthouse scores for both desktop and mobile environments. Scores of 90+ are considered good, 50-89 need improvement, and below 50 are poor.')) + '</p>';

      // Desktop scores
      if (desktopLH.performance !== undefined) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('common.desktop', 'Desktop')) + '</h3>';
        html += '<div class="pdf-score-grid">';
        var desktopCats = [
          { key: 'performance', label: t('performance.performanceScore', 'Performance') },
          { key: 'accessibility', label: t('accessibility.title', 'Accessibility') },
          { key: 'bestPractices', label: t('performance.report.lighthouse.bestPractices', 'Best Practices') },
          { key: 'seo', label: 'SEO' }
        ];
        desktopCats.forEach(function (cat) {
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
        var mobileCats = [
          { key: 'performance', label: t('performance.performanceScore', 'Performance') },
          { key: 'accessibility', label: t('accessibility.title', 'Accessibility') },
          { key: 'bestPractices', label: t('performance.report.lighthouse.bestPractices', 'Best Practices') },
          { key: 'seo', label: 'SEO' }
        ];
        mobileCats.forEach(function (cat) {
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

    /* -----------------------------------------------------------------------
       3. Resource Analysis
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-resources .pdf-section__content');
      if (!resources.javascript && !resources.css && !resources.breakdown) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = resources.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.resourceAnalysis', 'Resource Analysis'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.resources', 'Resource analysis examines all assets loaded by your page, including JavaScript, CSS, images, and fonts. Excessive resources increase load times and bandwidth consumption. This section breaks down resource counts and sizes by type, helping identify optimization opportunities. Reducing unnecessary resources and optimizing asset delivery are among the most effective performance improvements.')) + '</p>';

      // Summary metrics
      html += PR.renderMetrics([
        { value: data.totalRequests || 0, label: t('performance.requests', 'Requests') },
        { value: data.pageSize || '-', label: t('performance.pageSize', 'Page Size') },
        { value: data.loadTime || '-', label: t('performance.loadTime', 'Load Time') }
      ]);

      // Resource breakdown table
      var types = ['javascript', 'css', 'images', 'fonts', 'other'];
      var resRows = [];
      types.forEach(function (type) {
        var r = resources[type];
        if (!r) return;
        resRows.push([
          '<strong>' + esc(type.charAt(0).toUpperCase() + type.slice(1)) + '</strong>',
          String(r.count || 0),
          esc(r.sizeFormatted || _formatBytes(r.size || 0))
        ]);
      });

      if (resRows.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('performance.report.resources.breakdownHeading', 'Resource Breakdown')) + '</h3>';
        html += PR.renderTable(
          [
            { label: t('performance.report.resources.table.type', 'Type'), width: '30%' },
            { label: t('performance.report.resources.table.count', 'Files'), width: '20%' },
            { label: t('performance.report.resources.table.size', 'Size'), width: '25%' }
          ],
          resRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Network Performance
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-network .pdf-section__content');
      if (!network.ttfb && !network.requests) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = network.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.report.network.title', 'Network Performance'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.network', 'Network performance measures the speed of communication between the browser and your server. Time To First Byte (TTFB) is a critical indicator of server responsiveness. This section analyzes connection timing, DNS resolution, SSL negotiation, and DOM processing milestones. Optimizing server response times and connection setup directly improves the user experience for all visitors.')) + '</p>';

      // Timing table
      var timingRows = [];
      if (network.ttfb) timingRows.push([t('performance.report.network.ttfb', 'Time To First Byte'), esc(network.ttfb)]);
      if (network.dns) timingRows.push([t('performance.report.network.dns', 'DNS Lookup'), esc(network.dns)]);
      if (network.ssl) timingRows.push([t('performance.report.network.ssl', 'SSL Negotiation'), esc(network.ssl)]);
      if (network.connectionTime) timingRows.push([t('performance.report.network.connection', 'Connection Time'), esc(network.connectionTime)]);
      if (network.domInteractive) timingRows.push([t('performance.report.network.domInteractive', 'DOM Interactive'), esc(network.domInteractive)]);
      if (network.domContentLoaded) timingRows.push([t('performance.report.network.domContentLoaded', 'DOM Content Loaded'), esc(network.domContentLoaded)]);

      if (timingRows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '50%' },
            { label: t('seo.report.table.value', 'Value'), width: '50%' }
          ],
          timingRows,
          { striped: true }
        );
      }

      // Metrics
      html += PR.renderMetrics([
        { value: network.requests || 0, label: t('performance.requests', 'Total Requests') },
        { value: network.ttfb || '-', label: 'TTFB' }
      ]);

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Caching & Optimization
       ----------------------------------------------------------------------- */
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

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.caching', 'Effective caching reduces server load and dramatically improves page load times for returning visitors. Browser caching stores assets locally so they don\'t need to be re-downloaded on subsequent visits. This section evaluates your cache hit rate, cache control directives, and the proportion of cacheable resources. A well-configured caching strategy can reduce repeat-visit load times by 60-80%.')) + '</p>';

      // Cache hit rate progress
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
        { value: caching.cacheHitRate || '0%', label: t('performance.report.caching.hitRateLabel', 'Hit Rate') }
      ]);

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('performance.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('performance.report.sectionIntros.recommendations', 'Based on the performance analysis, this section provides actionable recommendations to improve your site\'s speed and user experience. Each recommendation includes the affected metric, current issue, and suggested solution. Prioritize high-impact items that affect Core Web Vitals, as these directly influence search rankings and user satisfaction.')) + '</p>';

      var recs = data.recommendations || [];
      if (recs.length > 0) {
        var critical = recs.filter(function (r) { return r.priority === 'critical' || r.priority === 'high'; });
        var medium = recs.filter(function (r) { return r.priority === 'medium'; });
        var low = recs.filter(function (r) { return !r.priority || r.priority === 'low'; });
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
              '<div class="pdf-rec__text">' +
              (r.metric ? '<span class="pdf-text-muted">[' + esc(r.metric) + ']</span> ' : '') +
              '<strong>' + esc(r.issue || r.title || '') + '</strong>' +
              (r.solution ? '<br><em>' + esc(r.solution) + '</em>' : '') +
              '</div>' +
            '</div>';
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

  function _formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

})(window);
