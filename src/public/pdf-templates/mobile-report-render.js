/**
 * Mobile Report — PDF Renderer
 * Renders all mobile analysis sections into the PDF template.
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

    var sectionIndex = 1;

    function _htmlToNode(htmlStr) {
      var tpl = document.createElement('template');
      tpl.innerHTML = htmlStr.trim();
      return tpl.content.firstChild;
    }

    // Resolve data sources
    var deviceKeys = Object.keys(data.devices || {});
    var primaryDevice = data.devices[deviceKeys[0]] || {};
    var perfSummary = data.performanceSummary || {};
    var recommendations = data.recommendations || [];

    /* -----------------------------------------------------------------------
       1. Mobile Overview
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-overview .pdf-section__content');
      var score = data.mobileScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.overview', 'Mobile Overview'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.overview', 'This section provides a high-level summary of your site\'s mobile readiness. It covers the overall mobile score, number of devices tested, and average performance across all device profiles. A strong mobile experience is essential as the majority of web traffic now comes from mobile devices.')) + '</p>';

      // Overview metrics
      var overviewMetrics = [];
      overviewMetrics.push({
        value: score !== undefined && score !== null ? score : '-',
        label: t('reports.mobile.report.overview.overallScore', 'Overall Score'),
        color: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
      });
      overviewMetrics.push({
        value: deviceKeys.length,
        label: t('reports.mobile.report.overview.devicesTested', 'Devices Tested')
      });
      overviewMetrics.push({
        value: perfSummary.avgScore !== undefined && perfSummary.avgScore !== null ? perfSummary.avgScore : (primaryDevice.performance ? primaryDevice.performance.score || '-' : '-'),
        label: t('reports.mobile.report.overview.avgPerformance', 'Avg Performance')
      });

      html += PR.renderMetrics(overviewMetrics);

      // Device summary table
      if (deviceKeys.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.overview.deviceSummary', 'Device Summary')) + '</h3>';
        var deviceRows = deviceKeys.map(function (key) {
          var dev = data.devices[key];
          var perf = dev.performance || {};
          return [
            '<strong>' + esc(key) + '</strong>',
            perf.score !== undefined && perf.score !== null
              ? '<span class="score-' + scoreClass(perf.score) + '">' + perf.score + '</span>'
              : '-',
            dev.touchTargets ? String(dev.touchTargets.score || '-') : '-',
            dev.readability ? String(dev.readability.score || '-') : '-'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.mobile.report.overview.table.device', 'Device'), width: '25%' },
            { label: t('reports.mobile.report.overview.table.performance', 'Performance'), width: '25%' },
            { label: t('reports.mobile.report.overview.table.touchTargets', 'Touch Targets'), width: '25%' },
            { label: t('reports.mobile.report.overview.table.readability', 'Readability'), width: '25%' }
          ],
          deviceRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Touch Targets
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-touch .pdf-section__content');
      var touch = primaryDevice.touchTargets || {};
      var score = touch.score;

      if (!touch.total && !touch.issues) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.touchTargets', 'Touch Targets'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.touch', 'Touch target analysis evaluates the size and spacing of interactive elements on your page. Mobile users interact with fingers rather than precise mouse pointers, so buttons and links must be large enough to tap accurately. Google recommends a minimum touch target size of 48x48 CSS pixels with adequate spacing between targets. This section identifies elements that are too small or too close together.')) + '</p>';

      // Touch target metrics
      html += PR.renderMetrics([
        { value: touch.total || 0, label: t('reports.mobile.report.touch.totalTargets', 'Total Targets') },
        { value: touch.tooSmall || 0, label: t('reports.mobile.report.touch.tooSmall', 'Too Small'), color: (touch.tooSmall || 0) > 0 ? '#ef4444' : '#10b981' },
        { value: touch.tooClose || 0, label: t('reports.mobile.report.touch.tooClose', 'Too Close'), color: (touch.tooClose || 0) > 0 ? '#f59e0b' : '#10b981' }
      ]);

      // Progress bar
      if (touch.total > 0) {
        var passing = (touch.total || 0) - (touch.tooSmall || 0) - (touch.tooClose || 0);
        if (passing < 0) passing = 0;
        html += PR.renderProgress(
          t('reports.mobile.report.touch.passingTargets', 'Passing Targets'),
          passing, touch.total
        );
      }

      // Issues table
      var issues = touch.issues || [];
      if (issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.touch.issuesHeading', 'Touch Target Issues')) + '</h3>';
        var issueRows = issues.slice(0, 20).map(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || issue.element || '');
          var severity = typeof issue === 'object' ? (issue.severity || 'medium') : 'medium';
          return [
            '<span class="pdf-issue__severity pdf-issue__severity--' + severity.toLowerCase() + '">' + esc(severity.toUpperCase()) + '</span>',
            esc(truncate(text, 80))
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
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Readability
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-readability .pdf-section__content');
      var read = primaryDevice.readability || {};
      var score = read.score;

      if (!read.fontSize && !read.issues) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.readability', 'Readability'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.readability', 'Readability analysis examines how easily text content can be read on mobile screens. Key factors include font size, line height, and color contrast ratios. Text that is too small or has insufficient contrast forces users to zoom or strain, leading to poor user experience. Google recommends a base font size of at least 16px and WCAG-compliant contrast ratios for all text.')) + '</p>';

      // Readability metrics
      html += PR.renderMetrics([
        { value: read.fontSize || '-', label: t('reports.mobile.report.readability.fontSize', 'Font Size') },
        { value: read.lineHeight || '-', label: t('reports.mobile.report.readability.lineHeight', 'Line Height') },
        { value: read.contrast || '-', label: t('reports.mobile.report.readability.contrast', 'Contrast') }
      ]);

      // Readability details table
      var readRows = [];
      if (read.fontSize) {
        readRows.push([
          esc(t('reports.mobile.report.readability.fontSize', 'Font Size')),
          '<strong>' + esc(String(read.fontSize)) + '</strong>',
          parseFloat(read.fontSize) >= 16
            ? PR.renderStatus('pass', t('performance.report.cwv.good', 'Good'))
            : PR.renderStatus('fail', t('reports.mobile.report.readability.tooSmall', 'Too Small'))
        ]);
      }
      if (read.lineHeight) {
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

      // Issues list
      var issues = read.issues || [];
      if (issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.readability.issuesHeading', 'Readability Issues')) + '</h3>';
        issues.slice(0, 15).forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
          html += '<div class="pdf-issue pdf-issue--warning">' +
            '<span class="pdf-issue__text">' + esc(text) + '</span>' +
          '</div>';
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Responsiveness
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-responsiveness .pdf-section__content');
      var resp = primaryDevice.responsiveness || {};
      var score = resp.score;

      if (!resp.viewport && !resp.issues) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.responsiveness', 'Responsiveness'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.responsiveness', 'Responsiveness measures how well your page adapts to different screen sizes and orientations. A properly responsive site uses viewport configuration and CSS media queries to reflow content for each device. This section checks whether your page has a valid viewport meta tag, uses responsive media queries, and avoids horizontal scrolling or content overflow on smaller screens.')) + '</p>';

      // Responsiveness details table
      var respRows = [];
      if (resp.viewport !== undefined) {
        respRows.push([
          esc(t('reports.mobile.report.responsiveness.viewport', 'Viewport Configured')),
          resp.viewport
            ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
            : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
        ]);
      }
      if (resp.mediaQueries !== undefined) {
        respRows.push([
          esc(t('reports.mobile.report.responsiveness.mediaQueries', 'Media Queries')),
          resp.mediaQueries
            ? PR.renderStatus('pass', t('seo.report.status.detected', 'Detected'))
            : PR.renderStatus('warning', t('reports.mobile.report.responsiveness.noMediaQueries', 'Not Detected'))
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
      var issues = resp.issues || [];
      if (issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.responsiveness.issuesHeading', 'Responsiveness Issues')) + '</h3>';
        issues.slice(0, 15).forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
          var sev = typeof issue === 'object' ? (issue.severity || 'medium').toLowerCase() : 'medium';
          html += '<div class="pdf-issue pdf-issue--' + sev + '">' +
            '<span class="pdf-issue__severity pdf-issue__severity--' + sev + '">' + esc(sev.toUpperCase()) + '</span>' +
            '<span class="pdf-issue__text">' + esc(text) + '</span>' +
          '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('reports.mobile.report.responsiveness.allPassTitle', 'Fully Responsive'),
          t('reports.mobile.report.responsiveness.allPassBody', 'Your page adapts correctly to different screen sizes with no responsiveness issues detected.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Viewport & PWA
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-viewport .pdf-section__content');
      var viewportMeta = primaryDevice.viewportMeta || {};
      var pwa = primaryDevice.pwaReadiness || {};

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.viewportPwa', 'Viewport & PWA'), pwa.score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.viewport', 'The viewport meta tag controls how your page scales on mobile devices. Proper configuration prevents users from needing to pinch-zoom to read content. Progressive Web App (PWA) readiness indicates whether your site can be installed as an app on mobile devices. Key PWA requirements include a web app manifest, service worker, and HTTPS. This section evaluates both viewport configuration and PWA compliance.')) + '</p>';

      // Viewport meta table
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.viewport.metaHeading', 'Viewport Meta Configuration')) + '</h3>';

      var vpRows = [];
      vpRows.push([
        esc(t('reports.mobile.report.viewport.configured', 'Viewport Configured')),
        viewportMeta.configured
          ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
          : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      if (viewportMeta.width) {
        vpRows.push([
          esc(t('reports.mobile.report.viewport.width', 'Width')),
          '<strong>' + esc(String(viewportMeta.width)) + '</strong>'
        ]);
      }
      if (viewportMeta.initialScale !== undefined && viewportMeta.initialScale !== null) {
        vpRows.push([
          esc(t('reports.mobile.report.viewport.initialScale', 'Initial Scale')),
          '<strong>' + esc(String(viewportMeta.initialScale)) + '</strong>'
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

      // PWA Readiness
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.viewport.pwaHeading', 'PWA Readiness')) + '</h3>';

      html += PR.renderMetrics([
        {
          value: pwa.score !== undefined && pwa.score !== null ? pwa.score : '-',
          label: t('reports.mobile.report.viewport.pwaScore', 'PWA Score'),
          color: (pwa.score || 0) >= 80 ? '#10b981' : (pwa.score || 0) >= 50 ? '#f59e0b' : '#ef4444'
        }
      ]);

      var pwaRows = [];
      pwaRows.push([
        esc(t('reports.mobile.report.viewport.manifest', 'Web App Manifest')),
        pwa.manifest
          ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
          : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      pwaRows.push([
        esc(t('reports.mobile.report.viewport.serviceWorker', 'Service Worker')),
        pwa.serviceWorker
          ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
          : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      pwaRows.push([
        esc(t('reports.mobile.report.viewport.https', 'HTTPS')),
        pwa.https
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

      // Dark mode support callout
      var darkMode = primaryDevice.darkModeSupport || {};
      if (darkMode.detected) {
        html += PR.renderCallout(
          t('reports.mobile.report.viewport.darkModeTitle', 'Dark Mode Supported'),
          t('reports.mobile.report.viewport.darkModeBody', 'Dark mode is detected via {{method}}.', { method: darkMode.method || 'unknown' }),
          'tip'
        );
      } else {
        html += PR.renderCallout(
          t('reports.mobile.report.viewport.noDarkModeTitle', 'No Dark Mode'),
          t('reports.mobile.report.viewport.noDarkModeBody', 'Dark mode support was not detected. Consider adding prefers-color-scheme media query support.'),
          'info'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Mobile Accessibility
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-accessibility .pdf-section__content');
      var a11y = primaryDevice.accessibility || {};
      var score = a11y.score;

      if (!a11y.issues && score === undefined) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.accessibility', 'Mobile Accessibility'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.accessibility', 'Mobile accessibility ensures your site is usable by all visitors, including those using assistive technologies on mobile devices. This section highlights accessibility issues specific to mobile usage, such as missing touch labels, inadequate focus indicators, and gesture-dependent interactions without alternatives. Addressing these issues improves usability for all users and ensures compliance with WCAG guidelines.')) + '</p>';

      // Score metric
      html += PR.renderMetrics([
        {
          value: score !== undefined && score !== null ? score : '-',
          label: t('reports.mobile.report.accessibility.score', 'Accessibility Score'),
          color: (score || 0) >= 80 ? '#10b981' : (score || 0) >= 50 ? '#f59e0b' : '#ef4444'
        }
      ]);

      // Issues table
      var issues = a11y.issues || [];
      if (issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.mobile.report.accessibility.issuesHeading', 'Accessibility Issues')) + '</h3>';
        var issueRows = issues.slice(0, 20).map(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
          var severity = typeof issue === 'object' ? (issue.severity || 'medium') : 'medium';
          return [
            '<span class="pdf-issue__severity pdf-issue__severity--' + severity.toLowerCase() + '">' + esc(severity.toUpperCase()) + '</span>',
            esc(truncate(text, 80))
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

        if (issues.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: issues.length - 20 }) + '</p>';
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

    /* -----------------------------------------------------------------------
       7. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.mobile.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.mobile.report.sectionIntros.recommendations', 'Based on the mobile analysis, this section provides prioritized recommendations to improve your site\'s mobile experience. Each recommendation includes the priority level and a description of the suggested change. Addressing high-priority items first will yield the greatest improvements to mobile usability, performance, and search engine rankings.')) + '</p>';

      if (recommendations.length > 0) {
        var critical = recommendations.filter(function (r) { return (r.priority || r.severity) === 'critical'; });
        var high = recommendations.filter(function (r) { return (r.priority || r.severity) === 'high'; });
        var medium = recommendations.filter(function (r) { return (r.priority || r.severity) === 'medium'; });
        var low = recommendations.filter(function (r) {
          var p = r.priority || r.severity;
          return !p || p === 'low';
        });
        var groups = [
          { items: critical, label: t('common.pdf.execSummary.highPriority', 'Critical'), color: '#ef4444' },
          { items: high, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#f97316' },
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

})(window);
