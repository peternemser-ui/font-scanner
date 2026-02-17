/**
 * Site Crawler Report — PDF Renderer
 * Renders all site crawler analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[site-crawler-report-render] PdfReport not loaded');
    return;
  }

  const PR = window.PdfReport;

  PdfReport.register('site-crawler', function renderSiteCrawler(data, utils) {
    const t = utils.t;
    const esc = utils.esc;
    const truncate = utils.truncate;
    const scoreClass = utils.scoreClass;

    let sectionIndex = 1;

    // Resolve data sources
    const results = data.results || {};
    const pages = data.pages || [];
    const issues = data.issues || [];
    const recommendations = data.recommendations || [];
    const statusCodes = results.statusCodes || {};

    function _htmlToNode(htmlStr) {
      const tpl = document.createElement('template');
      tpl.innerHTML = htmlStr.trim();
      return tpl.content.firstChild;
    }

    /** Format milliseconds to a human-readable string */
    function _formatMs(ms) {
      if (ms === undefined || ms === null) return '-';
      if (ms < 1000) return Math.round(ms) + 'ms';
      return (ms / 1000).toFixed(2) + 's';
    }

    /** Status code badge color */
    function _statusColor(code) {
      if (code >= 200 && code < 300) return '#10b981';
      if (code >= 300 && code < 400) return '#f59e0b';
      if (code >= 400 && code < 500) return '#f97316';
      if (code >= 500) return '#ef4444';
      return '#6b7280';
    }

    /** Response time color */
    function _responseTimeColor(ms) {
      if (ms <= 200) return '#10b981';
      if (ms <= 500) return '#f59e0b';
      return '#ef4444';
    }

    /* -----------------------------------------------------------------------
       1. Crawl Overview
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-overview .pdf-section__content');
      const score = data.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.siteCrawler.report.sections.overview', 'Crawl Overview'), score)),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.siteCrawler.report.sectionIntros.overview', 'The crawl overview summarizes the scope and results of the site crawl. It shows how many pages were discovered, the maximum depth reached, and overall crawl performance. Understanding your site\'s crawlable structure helps ensure search engines can efficiently index all your important content.')) + '</p>';

      // Metrics cards
      const totalPages = results.totalPages || 0;
      const discoveredUrls = results.discoveredUrls || 0;
      const depth = results.depth || 0;
      const crawlTime = results.crawlTime || 0;
      const avgResponseTime = results.avgResponseTime || 0;

      html += PR.renderMetrics([
        { value: totalPages, label: t('reports.siteCrawler.report.metrics.totalPages', 'Total Pages') },
        { value: discoveredUrls, label: t('reports.siteCrawler.report.metrics.discoveredUrls', 'Discovered URLs') },
        { value: depth, label: t('reports.siteCrawler.report.metrics.maxDepth', 'Max Depth') },
        { value: _formatMs(crawlTime), label: t('reports.siteCrawler.report.metrics.crawlTime', 'Crawl Time') },
        { value: _formatMs(avgResponseTime), label: t('reports.siteCrawler.report.metrics.avgResponseTime', 'Avg Response Time'), color: _responseTimeColor(avgResponseTime) }
      ]);

      // Status codes overview
      const codeKeys = Object.keys(statusCodes);
      if (codeKeys.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.siteCrawler.report.overview.statusOverview', 'Status Code Overview')) + '</h3>';

        const okCount = statusCodes[200] || 0;
        const redirectCount = (statusCodes[301] || 0) + (statusCodes[302] || 0);
        const errorCount = (statusCodes[404] || 0) + (statusCodes[500] || 0);

        html += PR.renderMetrics([
          { value: okCount, label: t('reports.siteCrawler.report.overview.ok', '2xx OK'), color: '#10b981' },
          { value: redirectCount, label: t('reports.siteCrawler.report.overview.redirects', '3xx Redirects'), color: redirectCount > 0 ? '#f59e0b' : '#10b981' },
          { value: errorCount, label: t('reports.siteCrawler.report.overview.errors', '4xx/5xx Errors'), color: errorCount > 0 ? '#ef4444' : '#10b981' }
        ]);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Pages Crawled
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-pages .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.siteCrawler.report.sections.pages', 'Pages Crawled'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.siteCrawler.report.sectionIntros.pages', 'This section lists all pages discovered during the crawl with their HTTP status codes, titles, and response times. Pages with errors or slow response times may be hurting your search engine visibility and user experience.')) + '</p>';

      if (pages.length > 0) {
        html += PR.renderMetrics([
          { value: pages.length, label: t('reports.siteCrawler.report.pages.totalCrawled', 'Pages Crawled') }
        ]);

        // Pages table (up to 50)
        const pageRows = pages.slice(0, 50).map(function (page) {
          const code = page.statusCode || 0;
          const statusType = code >= 200 && code < 300 ? 'pass' : code >= 300 && code < 400 ? 'review' : 'fail';
          const rtMs = page.responseTime || 0;

          return [
            '<span class="pdf-table__truncate">' + esc(truncate(page.url || '', 60)) + '</span>',
            '<span class="pdf-table__truncate">' + esc(truncate(page.title || '-', 40)) + '</span>',
            PR.renderStatus(statusType, String(code)),
            '<span style="color:' + _responseTimeColor(rtMs) + ';font-weight:600;">' + _formatMs(rtMs) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.siteCrawler.report.pages.table.url', 'URL'), width: '35%' },
            { label: t('reports.siteCrawler.report.pages.table.title', 'Title'), width: '25%' },
            { label: t('reports.siteCrawler.report.pages.table.status', 'Status'), width: '15%' },
            { label: t('reports.siteCrawler.report.pages.table.responseTime', 'Response Time'), width: '15%' }
          ],
          pageRows,
          { striped: true }
        );

        if (pages.length > 50) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: pages.length - 50 }) + '</p>';
        }
      } else {
        html += '<p class="pdf-text-muted">' + esc(t('reports.siteCrawler.report.pages.noData', 'No page data available.')) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Site Structure
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-structure .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.siteCrawler.report.sections.structure', 'Site Structure'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.siteCrawler.report.sectionIntros.structure', 'Site structure analysis examines how your pages are organized and interconnected. A well-structured site has a shallow, logical hierarchy that enables both users and search engines to find content efficiently. Deep or orphaned pages may receive less crawl budget and link equity.')) + '</p>';

      // Depth distribution
      if (pages.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.siteCrawler.report.structure.depthHeading', 'Depth Distribution')) + '</h3>';

        const depthMap = {};
        pages.forEach(function (page) {
          const d = page.depth || 0;
          depthMap[d] = (depthMap[d] || 0) + 1;
        });

        const depthKeys = Object.keys(depthMap).sort(function (a, b) { return Number(a) - Number(b); });
        const depthRows = depthKeys.map(function (d) {
          const count = depthMap[d];
          const pct = pages.length > 0 ? Math.round((count / pages.length) * 100) : 0;
          return [
            '<strong>' + esc(t('reports.siteCrawler.report.structure.depthLevel', 'Depth {{level}}', { level: d })) + '</strong>',
            String(count),
            pct + '%'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.siteCrawler.report.structure.table.depth', 'Depth'), width: '35%' },
            { label: t('reports.siteCrawler.report.structure.table.pages', 'Pages'), width: '25%' },
            { label: t('reports.siteCrawler.report.structure.table.percentage', 'Percentage'), width: '25%' }
          ],
          depthRows,
          { striped: true }
        );

        // Depth progress bars
        depthKeys.forEach(function (d) {
          html += PR.renderProgress(
            t('reports.siteCrawler.report.structure.depthLevel', 'Depth {{level}}', { level: d }),
            depthMap[d], pages.length
          );
        });
      }

      // Status code breakdown
      const codeKeys = Object.keys(statusCodes);
      if (codeKeys.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.siteCrawler.report.structure.statusHeading', 'Status Code Breakdown')) + '</h3>';

        let totalResponses = 0;
        codeKeys.forEach(function (k) { totalResponses += statusCodes[k]; });

        const statusRows = codeKeys.sort().map(function (code) {
          const count = statusCodes[code];
          const pct = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
          const statusType = Number(code) >= 200 && Number(code) < 300 ? 'pass'
            : Number(code) >= 300 && Number(code) < 400 ? 'review'
            : 'fail';
          return [
            PR.renderStatus(statusType, String(code)),
            String(count),
            pct + '%'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.siteCrawler.report.structure.table.statusCode', 'Status Code'), width: '30%' },
            { label: t('reports.siteCrawler.report.structure.table.count', 'Count'), width: '25%' },
            { label: t('reports.siteCrawler.report.structure.table.percentage', 'Percentage'), width: '25%' }
          ],
          statusRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Issues Detected
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-issues .pdf-section__content');
      const issueScore = issues.length === 0 ? 100 : Math.max(0, 100 - (issues.length * 3));

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.siteCrawler.report.sections.issues', 'Issues Detected'), issueScore)),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.siteCrawler.report.sectionIntros.issues', 'Issues detected during the crawl include broken pages, missing titles, duplicate content, and other technical SEO problems. Each issue is categorized by severity to help you prioritize fixes that will have the greatest impact on search performance.')) + '</p>';

      if (issues.length > 0) {
        html += PR.renderMetrics([
          { value: issues.length, label: t('reports.siteCrawler.report.issues.totalIssues', 'Total Issues'), color: '#ef4444' }
        ]);

        // Group by severity
        const critical = issues.filter(function (i) { return i.severity === 'critical'; });
        const high = issues.filter(function (i) { return i.severity === 'high'; });
        const medium = issues.filter(function (i) { return i.severity === 'medium'; });
        const low = issues.filter(function (i) { const s = i.severity; return !s || s === 'low'; });

        const groups = [
          { items: critical, label: t('common.pdf.execSummary.critical', 'Critical'), color: '#ef4444' },
          { items: high, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#f97316' },
          { items: medium, label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: '#f59e0b' },
          { items: low, label: t('common.pdf.execSummary.lowPriority', 'Low Priority'), color: '#3b82f6' }
        ];

        groups.forEach(function (group) {
          if (group.items.length === 0) return;
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:' + group.color + ';">&#9679; ' + group.label + ' (' + group.items.length + ')</div>';
          group.items.forEach(function (issue) {
            html += PR.renderIssue(
              '<strong>' + esc(issue.type || '') + '</strong>' +
              (issue.url ? ' &mdash; <span class="pdf-table__truncate">' + esc(truncate(issue.url, 60)) + '</span>' : '') +
              (issue.message ? '<br>' + esc(issue.message) : ''),
              issue.severity === 'critical' || issue.severity === 'high' ? 'error' : 'warning'
            );
          });
          html += '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('reports.siteCrawler.report.issues.noneTitle', 'No Issues Found'),
          t('reports.siteCrawler.report.issues.noneBody', 'The crawl did not detect any issues. Continue monitoring your site to catch problems early.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Page Performance
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-performance .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.siteCrawler.report.sections.performance', 'Page Performance'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.siteCrawler.report.sectionIntros.performance', 'Page performance across your site reveals patterns in response times and server behavior. Consistently slow pages may indicate server capacity issues or inefficient code. This section highlights the slowest pages and overall response time distribution.')) + '</p>';

      if (pages.length > 0) {
        // Calculate average response time
        let totalRt = 0;
        let rtCount = 0;
        pages.forEach(function (page) {
          if (page.responseTime) {
            totalRt += page.responseTime;
            rtCount++;
          }
        });
        const avgRt = rtCount > 0 ? Math.round(totalRt / rtCount) : 0;
        const avgColor = _responseTimeColor(avgRt);

        html += PR.renderMetrics([
          { value: _formatMs(avgRt), label: t('reports.siteCrawler.report.performance.avgResponseTime', 'Avg Response Time'), color: avgColor },
          { value: rtCount, label: t('reports.siteCrawler.report.performance.pagesAnalyzed', 'Pages Analyzed') }
        ]);

        // Avg response time progress (target: under 500ms)
        if (avgRt > 0) {
          const progressVal = Math.min(avgRt, 1000);
          html += PR.renderProgress(
            t('reports.siteCrawler.report.performance.avgResponseTime', 'Avg Response Time'),
            1000 - progressVal, 1000
          );
        }

        // Slowest pages table (top 10)
        const sortedPages = pages.slice().sort(function (a, b) {
          return (b.responseTime || 0) - (a.responseTime || 0);
        });
        const slowest = sortedPages.slice(0, 10);

        if (slowest.length > 0 && slowest[0].responseTime) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.siteCrawler.report.performance.slowestHeading', 'Slowest Pages')) + '</h3>';

          const slowRows = slowest.map(function (page) {
            const rtMs = page.responseTime || 0;
            return [
              '<span class="pdf-table__truncate">' + esc(truncate(page.url || '', 60)) + '</span>',
              '<span style="color:' + _responseTimeColor(rtMs) + ';font-weight:600;">' + _formatMs(rtMs) + '</span>',
              PR.renderStatus(
                rtMs <= 200 ? 'pass' : rtMs <= 500 ? 'warning' : 'fail',
                rtMs <= 200 ? t('performance.report.cwv.good', 'Good') : rtMs <= 500 ? t('performance.report.cwv.needsImprovement', 'Needs Improvement') : t('performance.report.cwv.poor', 'Poor')
              )
            ];
          });

          html += PR.renderTable(
            [
              { label: t('reports.siteCrawler.report.performance.table.url', 'URL'), width: '50%' },
              { label: t('reports.siteCrawler.report.performance.table.responseTime', 'Response Time'), width: '20%' },
              { label: t('reports.siteCrawler.report.performance.table.rating', 'Rating'), width: '20%' }
            ],
            slowRows,
            { striped: true }
          );
        }
      } else {
        html += '<p class="pdf-text-muted">' + esc(t('reports.siteCrawler.report.performance.noData', 'No performance data available.')) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.siteCrawler.report.sections.recommendations', 'Recommendations'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.siteCrawler.report.sectionIntros.recommendations', 'Based on the site crawl analysis, these recommendations target the most critical structural and technical issues affecting your site\'s search engine crawlability.')) + '</p>';

      if (recommendations.length > 0) {
        // Group by priority/severity
        const critical = recommendations.filter(function (r) { return (r.priority || r.severity) === 'critical'; });
        const high = recommendations.filter(function (r) { return (r.priority || r.severity) === 'high'; });
        const medium = recommendations.filter(function (r) { return (r.priority || r.severity) === 'medium'; });
        const low = recommendations.filter(function (r) { const p = r.priority || r.severity; return !p || p === 'low'; });

        const groups = [
          { items: critical, label: t('common.pdf.execSummary.critical', 'Critical'), color: '#ef4444' },
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
          t('reports.siteCrawler.report.recommendations.noneTitle', 'Healthy Site Structure'),
          t('reports.siteCrawler.report.recommendations.noneBody', 'Your site has a healthy structure with no significant crawl issues. Continue monitoring to maintain site health.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    // Hide empty sections
    document.querySelectorAll('.pdf-section').forEach(function (sec) {
      const content = sec.querySelector('.pdf-section__content');
      if (content && !content.innerHTML.trim()) {
        sec.style.display = 'none';
      }
    });
  });

})(window);
