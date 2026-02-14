/**
 * Tag Intelligence Report — PDF Renderer
 * Renders all tag intelligence analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[tag-intelligence-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('tag-intelligence', function renderTagIntelligence(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;

    var sectionIndex = 1;

    // Resolve data — pageResults[0] contains detailed analysis
    var page0 = (data.pageResults && data.pageResults[0]) || {};
    var tags = data.tags || [];
    var summary = data.summary || {};
    var issues = data.issues || [];
    var duplicates = data.duplicates || [];
    var cookies = page0.cookies || data.cookies || {};
    var dataLayer = page0.dataLayer || data.dataLayer || {};
    var thirdPartyScripts = page0.thirdPartyScripts || data.thirdPartyScripts || {};
    var performanceImpact = page0.performanceImpact || data.performanceImpact || {};
    var recommendations = data.recommendations || [];
    var consentMode = page0.consentMode || data.consentMode || {};

    var CATEGORY_LABELS = {
      analytics: t('reports.tagIntelligence.categories.analytics', 'Analytics'),
      advertising: t('reports.tagIntelligence.categories.advertising', 'Advertising'),
      tag_manager: t('reports.tagIntelligence.categories.tagManager', 'Tag Manager'),
      consent: t('reports.tagIntelligence.categories.consent', 'Consent'),
      customer_support: t('reports.tagIntelligence.categories.support', 'Support'),
      marketing: t('reports.tagIntelligence.categories.marketing', 'Marketing'),
      ab_testing: t('reports.tagIntelligence.categories.abTesting', 'A/B Testing'),
      session_recording: t('reports.tagIntelligence.categories.sessionRecording', 'Session Recording'),
      error_monitoring: t('reports.tagIntelligence.categories.errorMonitoring', 'Error Monitoring'),
      cdp: t('reports.tagIntelligence.categories.cdp', 'CDP'),
      social: t('reports.tagIntelligence.categories.social', 'Social'),
      cdn: t('reports.tagIntelligence.categories.cdn', 'CDN'),
      library: t('reports.tagIntelligence.categories.library', 'Library')
    };

    /* -----------------------------------------------------------------------
       1. Tags Overview
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-overview .pdf-section__content');
      var score = data.healthScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.analyticsOverview', 'Tags Overview'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.overview', 'This section provides an overview of all marketing, analytics, and tracking tags detected on your page. A healthy tag implementation uses a tag management system, avoids duplicates, and loads scripts efficiently. Too many tags can slow page performance and create data quality issues. This analysis identifies each tag, its category, and how many instances were found.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: summary.totalTags || tags.length || 0, label: t('reports.tagIntelligence.tagsDetected', 'Tags Detected') },
        { value: Object.keys(summary.byCategory || {}).length || 0, label: t('reports.tagIntelligence.report.overview.categoriesLabel', 'Categories') },
        { value: issues.length || 0, label: t('reports.tagIntelligence.issuesDetected', 'Issues'), color: issues.length > 0 ? '#f59e0b' : '#10b981' },
        { value: duplicates.length || 0, label: t('reports.tagIntelligence.report.overview.duplicatesLabel', 'Duplicates'), color: duplicates.length > 0 ? '#ef4444' : '#10b981' }
      ]);

      // Tags table
      if (tags.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.overview.detectedHeading', 'Detected Tags')) + '</h3>';
        var tagRows = tags.slice(0, 25).map(function (tag) {
          return [
            '<strong>' + esc(tag.name || '-') + '</strong>',
            esc(CATEGORY_LABELS[tag.category] || tag.category || '-'),
            String(tag.instances || 1),
            tag.ids && tag.ids.length > 0 ? '<span class="pdf-table__truncate">' + esc(truncate(tag.ids.join(', '), 40)) + '</span>' : '-'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.overview.table.name', 'Tag Name'), width: '30%' },
            { label: t('reports.tagIntelligence.report.overview.table.category', 'Category'), width: '20%' },
            { label: t('reports.tagIntelligence.report.overview.table.instances', 'Instances'), width: '12%' },
            { label: t('reports.tagIntelligence.report.overview.table.ids', 'IDs'), width: '28%' }
          ],
          tagRows,
          { striped: true }
        );

        if (tags.length > 25) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: tags.length - 25 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Issues Detected
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-issues .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.issuesDetected', 'Issues Detected'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.issues', 'This section highlights implementation issues and conflicts found among your tags. Common problems include duplicate tracking pixels, migration gaps between analytics versions, missing consent management, and conflicting scripts. Each issue includes severity level and a specific recommendation for resolution. Addressing these issues improves data accuracy and site performance.')) + '</p>';

      // Issues
      if (issues.length > 0) {
        var SEVERITY_LABELS = {
          high: t('reports.tagIntelligence.severity.high', 'HIGH'),
          warning: t('reports.tagIntelligence.severity.warning', 'WARNING'),
          info: t('reports.tagIntelligence.severity.info', 'INFO')
        };
        issues.forEach(function (issue) {
          var sev = issue.severity === 'high' ? 'warning' : (issue.severity || 'info');
          var sevLabel = SEVERITY_LABELS[issue.severity] || SEVERITY_LABELS[sev] || (issue.severity || 'info').toUpperCase();
          var msgKey = issue.messageKey ? 'reports.' + issue.messageKey : '';
          var recKey = issue.recommendationKey ? 'reports.' + issue.recommendationKey : '';
          var msg = msgKey ? t(msgKey, issue.message || '', issue.messageParams) : (issue.message || '');
          var rec = recKey ? t(recKey, issue.recommendation || '') : (issue.recommendation || '');
          html += '<div class="pdf-issue pdf-issue--' + sev + '">' +
            '<span class="pdf-issue__severity pdf-issue__severity--' + sev + '">' + esc(sevLabel) + '</span>' +
            '<span class="pdf-issue__text">' + esc(msg) +
            (rec ? '<br><em>' + esc(rec) + '</em>' : '') + '</span>' +
          '</div>';
        });
      }

      // Duplicate warnings
      if (duplicates.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.issues.duplicatesHeading', 'Duplicate Tags')) + '</h3>';
        duplicates.forEach(function (dup) {
          html += '<div class="pdf-issue pdf-issue--warning">' +
            '<span class="pdf-issue__severity pdf-issue__severity--warning">' + esc(t('reports.tagIntelligence.severity.warning', 'WARNING')) + '</span>' +
            '<span class="pdf-issue__text">' + esc(dup.message || (dup.tag + ' (' + dup.count + 'x)')) + '</span>' +
          '</div>';
        });
      }

      if (issues.length === 0 && duplicates.length === 0) {
        html += PR.renderCallout(
          t('reports.tagIntelligence.report.issues.noneTitle', 'No Issues Found'),
          t('reports.tagIntelligence.report.issues.noneBody', 'No implementation issues or conflicts were detected in your tag setup.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Tags by Category
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-categories .pdf-section__content');
      var byCategory = summary.byCategory || {};

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.tagsByCategory', 'Tags by Category'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.categories', 'Tags are organized by functional category to provide a clear picture of your marketing and analytics stack. This breakdown helps identify redundancies, gaps in coverage, and opportunities for consolidation. A well-organized tag infrastructure typically uses one tool per function with clear data ownership. Review each category to ensure every tag serves a specific, non-overlapping purpose.')) + '</p>';

      // Category breakdown table
      var catKeys = Object.keys(byCategory);
      if (catKeys.length > 0) {
        var catRows = catKeys.map(function (cat) {
          var catTags = tags.filter(function (tag) { return tag.category === cat; });
          var tagNames = catTags.map(function (tag) { return tag.name; }).join(', ');
          return [
            '<strong>' + esc(CATEGORY_LABELS[cat] || cat) + '</strong>',
            String(byCategory[cat] || 0),
            '<span class="pdf-table__truncate">' + esc(truncate(tagNames, 60)) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.categories.table.category', 'Category'), width: '25%' },
            { label: t('reports.tagIntelligence.report.categories.table.count', 'Count'), width: '12%' },
            { label: t('reports.tagIntelligence.report.categories.table.tags', 'Tags'), width: '55%' }
          ],
          catRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Script Performance
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-performance .pdf-section__content');
      if (!performanceImpact.score && !performanceImpact.stats) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = performanceImpact.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.scriptPerformanceImpact', 'Script Performance'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.performance', 'Marketing tags and tracking scripts can significantly impact page load performance. Synchronous scripts block rendering while they load, and inline scripts add to the initial HTML payload. This section analyzes script loading methods, identifying blocking scripts that should be converted to async or defer loading. Optimizing script loading can reduce Time to Interactive by hundreds of milliseconds.')) + '</p>';

      // Stats metrics
      var stats = performanceImpact.stats || {};
      html += PR.renderMetrics([
        { value: stats.syncScripts || 0, label: t('reports.tagIntelligence.report.performance.syncLabel', 'Sync (Blocking)'), color: (stats.syncScripts || 0) > 0 ? '#ef4444' : '#10b981' },
        { value: stats.asyncScripts || 0, label: t('reports.tagIntelligence.report.performance.asyncLabel', 'Async'), color: '#10b981' },
        { value: stats.deferScripts || 0, label: t('reports.tagIntelligence.report.performance.deferLabel', 'Defer'), color: '#10b981' },
        { value: stats.inlineScripts || 0, label: t('reports.tagIntelligence.report.performance.inlineLabel', 'Inline') }
      ]);

      // Grade
      if (performanceImpact.grade) {
        html += '<div style="margin:8px 0;">' +
          PR.renderStatus(performanceImpact.grade === 'A' || performanceImpact.grade === 'B' ? 'pass' : 'warning',
            t('common.grade', 'Grade') + ': ' + performanceImpact.grade) +
        '</div>';
      }

      // Performance issues
      if (performanceImpact.issues && performanceImpact.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.performance.issuesHeading', 'Performance Issues')) + '</h3>';
        performanceImpact.issues.forEach(function (issue) {
          html += '<div class="pdf-issue pdf-issue--warning">' +
            '<span class="pdf-issue__text">' + esc(issue.message || '') + '</span>' +
          '</div>';
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Third-Party Scripts
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-thirdparty .pdf-section__content');
      if (!thirdPartyScripts.total && !thirdPartyScripts.scripts) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.thirdPartyScripts', 'Third-Party Scripts'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.thirdParty', 'Third-party scripts are loaded from external domains and include analytics libraries, advertising pixels, and CDN-hosted utilities. Each external script introduces a dependency on another server\'s availability and performance. This section catalogs all third-party scripts by host, category, and loading method. Minimizing third-party dependencies and ensuring proper async loading reduces performance risk.')) + '</p>';

      html += PR.renderMetrics([
        { value: thirdPartyScripts.total || 0, label: t('reports.tagIntelligence.report.thirdParty.totalLabel', 'Third-Party Scripts') }
      ]);

      // Scripts table
      var scripts = thirdPartyScripts.scripts || [];
      if (scripts.length > 0) {
        var scriptRows = scripts.slice(0, 20).map(function (s) {
          return [
            '<strong>' + esc(s.name || '-') + '</strong>',
            '<span class="pdf-table__truncate">' + esc(truncate(s.host || s.src || '', 40)) + '</span>',
            esc(CATEGORY_LABELS[s.category] || s.category || '-'),
            s.async ? t('reports.tagIntelligence.loadingMethod.async', 'async') : s.defer ? t('reports.tagIntelligence.loadingMethod.defer', 'defer') : t('reports.tagIntelligence.loadingMethod.sync', 'sync')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.thirdParty.table.name', 'Name'), width: '25%' },
            { label: t('reports.tagIntelligence.report.thirdParty.table.host', 'Host'), width: '30%' },
            { label: t('reports.tagIntelligence.report.thirdParty.table.category', 'Category'), width: '18%' },
            { label: t('reports.tagIntelligence.report.thirdParty.table.loading', 'Loading'), width: '12%' }
          ],
          scriptRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. DataLayer Analysis
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-datalayer .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.dataLayerAnalysis', 'DataLayer Analysis'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.dataLayer', 'The dataLayer is a JavaScript array used by Google Tag Manager to pass structured data between your website and marketing tags. A well-implemented dataLayer centralizes event tracking and enables consistent measurement across all tags. This section checks for dataLayer presence, event count, and ecommerce implementation. A robust dataLayer is the foundation of accurate marketing analytics.')) + '</p>';

      html += PR.renderMetrics([
        { value: dataLayer.found ? t('seo.report.status.detected', 'Detected') : t('seo.report.status.notDetected', 'Not Detected'), label: 'DataLayer', color: dataLayer.found ? '#10b981' : '#f59e0b' },
        { value: dataLayer.eventCount || 0, label: t('reports.tagIntelligence.report.dataLayer.eventsLabel', 'Events') }
      ]);

      // Ecommerce
      if (dataLayer.ecommerce && dataLayer.ecommerce.detected) {
        html += PR.renderCallout(
          t('reports.tagIntelligence.report.dataLayer.ecommerceTitle', 'Ecommerce Tracking Detected'),
          esc(dataLayer.ecommerce.type || 'GA4 Ecommerce'),
          'tip'
        );
      }

      // Event list
      if (dataLayer.events && dataLayer.events.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.dataLayer.eventsHeading', 'DataLayer Events')) + '</h3>';
        var eventRows = dataLayer.events.slice(0, 20).map(function (evt) {
          return [esc(evt), PR.renderStatus('found', t('seo.report.status.found', 'Found'))];
        });

        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.dataLayer.table.event', 'Event Name'), width: '65%' },
            { label: t('seo.report.table.status', 'Status'), width: '25%' }
          ],
          eventRows,
          { striped: true }
        );
      }

      // Consent mode
      if (consentMode && consentMode.implemented !== undefined) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.consentMode', 'Consent Mode')) + '</h3>';
        html += '<div style="margin:8px 0;">' +
          PR.renderStatus(consentMode.implemented ? 'pass' : 'fail',
            consentMode.implemented
              ? t('reports.tagIntelligence.report.dataLayer.consentImplemented', 'Consent Mode Implemented')
              : t('reports.tagIntelligence.report.dataLayer.consentMissing', 'Consent Mode Not Implemented')) +
        '</div>';
        if (consentMode.recommendation) {
          html += '<p class="pdf-text-muted pdf-text-small">' + esc(consentMode.recommendation) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       7. Cookie Audit
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cookies .pdf-section__content');
      if (!cookies.count && !(cookies.cookies && cookies.cookies.length > 0)) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.cookieAudit', 'Cookie Audit'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.cookies', 'Cookies set by tags and third-party scripts carry privacy and compliance implications. Under GDPR, CCPA, and similar regulations, users must be informed about cookies and in many cases give consent before non-essential cookies are set. This section audits all detected cookies, their vendors, purposes, and security attributes. Understanding your cookie landscape is essential for privacy compliance.')) + '</p>';

      html += PR.renderMetrics([
        { value: cookies.count || 0, label: t('reports.tagIntelligence.report.cookies.totalLabel', 'Total Cookies') }
      ]);

      // Cookie type breakdown
      var cookieSummary = cookies.summary || cookies.types || {};
      if (Object.keys(cookieSummary).length > 0) {
        var typeRows = Object.keys(cookieSummary).map(function (type) {
          return [
            esc(type.charAt(0).toUpperCase() + type.slice(1)),
            String(cookieSummary[type] || 0)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.cookies.table.type', 'Type'), width: '50%' },
            { label: t('reports.tagIntelligence.report.cookies.table.count', 'Count'), width: '25%' }
          ],
          typeRows,
          { striped: true }
        );
      }

      // Cookie details table
      var cookieList = cookies.cookies || [];
      if (cookieList.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.cookies.detailsHeading', 'Cookie Details')) + '</h3>';
        var cookieRows = cookieList.slice(0, 20).map(function (c) {
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(c.name, 25)) + '</span>',
            esc(c.vendor || '-'),
            esc(c.domain || '-'),
            c.hasSecure ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            esc(c.expires || '-')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.cookies.table.name', 'Name'), width: '20%' },
            { label: t('reports.tagIntelligence.report.cookies.table.vendor', 'Vendor'), width: '20%' },
            { label: t('reports.tagIntelligence.report.cookies.table.domain', 'Domain'), width: '18%' },
            { label: t('reports.tagIntelligence.cookieSecure', 'Secure'), width: '10%' },
            { label: t('reports.tagIntelligence.report.cookies.table.expires', 'Expires'), width: '15%' }
          ],
          cookieRows,
          { striped: true }
        );
      }

      // Cookie compliance issues
      if (cookies.issues && cookies.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.cookies.issuesHeading', 'Compliance Issues')) + '</h3>';
        cookies.issues.forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || '');
          html += '<div class="pdf-issue pdf-issue--warning">' +
            '<span class="pdf-issue__text">' + esc(text) + '</span>' +
          '</div>';
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       8. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.report.recommendationsTitle', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.recommendations', 'Based on the tag intelligence analysis, this section provides prioritized recommendations to optimize your tag implementation. Recommendations cover performance optimization, data quality improvement, privacy compliance, and infrastructure consolidation. Implementing these changes will result in faster page loads, more accurate tracking data, and better compliance with privacy regulations.')) + '</p>';

      if (recommendations.length > 0) {
        var high = recommendations.filter(function (r) { return r.priority === 'high'; });
        var medium = recommendations.filter(function (r) { return r.priority === 'medium'; });
        var low = recommendations.filter(function (r) { return !r.priority || r.priority === 'low'; });
        var groups = [
          { items: high, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#ef4444' },
          { items: medium, label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: '#f59e0b' },
          { items: low, label: t('common.pdf.execSummary.lowPriority', 'Low Priority'), color: '#3b82f6' }
        ];

        groups.forEach(function (group) {
          if (group.items.length === 0) return;
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:' + group.color + ';">&#9679; ' + group.label + ' (' + group.items.length + ')</div>';
          group.items.forEach(function (r) {
            var recTitleKey = r.titleKey ? 'reports.' + r.titleKey : '';
            var recDescKey = r.descriptionKey ? 'reports.' + r.descriptionKey : '';
            var recTitle = recTitleKey ? t(recTitleKey, r.title || r.message || '') : (r.title || r.message || '');
            var recDesc = recDescKey ? t(recDescKey, r.description || r.details || '', r.descriptionParams) : (r.description || r.details || '');
            html += '<div class="pdf-rec" style="border-left-color:' + group.color + ';">' +
              '<div class="pdf-rec__text"><strong>' + esc(recTitle) + '</strong>' +
              (recDesc ? '<br>' + esc(recDesc) : '') +
              '</div>' +
            '</div>';
          });
          html += '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('reports.tagIntelligence.report.recommendationsNoneTitle', 'Well-Managed Tag Infrastructure'),
          t('reports.tagIntelligence.report.recommendationsNoneBody', 'Your tag implementation follows best practices. Continue monitoring for new issues.'),
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
