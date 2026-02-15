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
    var scoreColor = utils.scoreColor;

    var sectionIndex = 1;

    // Resolve data — pageResults[0] contains detailed analysis
    var page0 = (data.pageResults && data.pageResults[0]) || {};
    var tags = data.tags || [];
    var tagsByCategory = data.tagsByCategory || {};
    var summary = data.summary || {};
    var issues = data.issues || [];
    var duplicates = data.duplicates || [];
    var cookies = page0.cookies || data.cookies || {};
    var dataLayer = page0.dataLayer || data.dataLayer || {};
    var thirdPartyScripts = page0.thirdPartyScripts || data.thirdPartyScripts || {};
    var performanceImpact = page0.performanceImpact || data.performanceImpact || {};
    var recommendations = data.recommendations || [];
    var consentMode = page0.consentMode || data.consentMode || {};
    var waterfall = page0.tagLoadWaterfall || data.tagLoadWaterfall || {};

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

    /** Helper: loading method label for a tag/script */
    function _loadingLabel(item) {
      if (item.async) return t('reports.tagIntelligence.loadingMethod.async', 'async');
      if (item.defer) return t('reports.tagIntelligence.loadingMethod.defer', 'defer');
      if (item.foundInline) return t('reports.tagIntelligence.loadingMethod.inline', 'inline');
      return t('reports.tagIntelligence.loadingMethod.sync', 'sync');
    }

    /** Helper: loading method status type */
    function _loadingStatus(item) {
      if (item.async) return 'pass';
      if (item.defer) return 'pass';
      if (item.foundInline) return 'info';
      return 'fail';
    }

    /* -----------------------------------------------------------------------
       1. Tags Overview
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-overview .pdf-section__content');
      var score = data.healthScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.analyticsOverview', 'Analytics Overview'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.overview', 'This section provides an overview of all marketing, analytics, and tracking tags detected on your page. A healthy tag implementation uses a tag management system, avoids duplicates, and loads scripts efficiently. Too many tags can slow page performance and create data quality issues. This analysis identifies each tag, its category, and how many instances were found.')) + '</p>';

      // Health score progress bar
      if (score !== undefined && score !== null) {
        html += PR.renderProgress(
          t('reports.tagIntelligence.healthScore', 'Tag Health Score'),
          score, 100
        );
      }

      // Metrics
      html += PR.renderMetrics([
        { value: summary.totalTags || tags.length || 0, label: t('reports.tagIntelligence.tagsDetected', 'Tags Detected') },
        { value: Object.keys(summary.byCategory || {}).length || 0, label: t('reports.tagIntelligence.report.overview.categoriesLabel', 'Categories') },
        { value: issues.length || 0, label: t('reports.tagIntelligence.issuesDetected', 'Issues Detected'), color: issues.length > 0 ? '#f59e0b' : '#10b981' },
        { value: duplicates.length || 0, label: t('reports.tagIntelligence.report.overview.duplicatesLabel', 'Duplicates'), color: duplicates.length > 0 ? '#ef4444' : '#10b981' }
      ]);

      // Tags table — enriched with loading method + detection source
      if (tags.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.overview.detectedHeading', 'Detected Tags')) + '</h3>';
        var tagRows = tags.slice(0, 30).map(function (tag) {
          // Detection source indicators
          var detection = [];
          if (tag.foundInline) detection.push(t('reports.tagIntelligence.foundInline', 'Found inline'));
          if (tag.foundScript) detection.push(t('reports.tagIntelligence.foundInScriptSrc', 'Found in script src'));
          var detectionStr = detection.length > 0 ? detection.join(', ') : '-';

          return [
            '<strong>' + esc(tag.name || '-') + '</strong>',
            esc(CATEGORY_LABELS[tag.category] || tag.category || '-'),
            String(tag.instances || 1),
            String(tag.pagesFound ? tag.pagesFound.length : 1),
            PR.renderStatus(_loadingStatus(tag), _loadingLabel(tag)),
            tag.ids && tag.ids.length > 0 ? '<span class="pdf-table__truncate" style="font-family:monospace;font-size:0.85em;">' + esc(truncate(tag.ids.join(', '), 35)) + '</span>' : '-',
            '<span class="pdf-text-small">' + esc(detectionStr) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.overview.table.name', 'Tag Name'), width: '18%' },
            { label: t('reports.tagIntelligence.report.overview.table.category', 'Category'), width: '13%' },
            { label: t('reports.tagIntelligence.report.overview.table.instances', 'Instances'), width: '7%' },
            { label: t('reports.tagIntelligence.pages', 'page(s)'), width: '7%' },
            { label: t('reports.tagIntelligence.report.overview.table.loading', 'Loading'), width: '10%' },
            { label: t('reports.tagIntelligence.report.overview.table.ids', 'IDs'), width: '25%' },
            { label: t('reports.tagIntelligence.report.overview.table.source', 'Source'), width: '12%' }
          ],
          tagRows,
          { striped: true }
        );

        if (tags.length > 30) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: tags.length - 30 }) + '</p>';
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

      // Summary metrics for issues
      if (issues.length > 0 || duplicates.length > 0) {
        var highCount = 0;
        var warnCount = 0;
        var infoCount = 0;
        issues.forEach(function (issue) {
          if (issue.severity === 'high') highCount++;
          else if (issue.severity === 'warning') warnCount++;
          else infoCount++;
        });
        html += PR.renderMetrics([
          { value: issues.length + duplicates.length, label: t('reports.tagIntelligence.totalIssues', 'Total Issues'), color: '#f59e0b' },
          { value: highCount, label: t('reports.tagIntelligence.severity.high', 'HIGH'), color: highCount > 0 ? '#ef4444' : '#10b981' },
          { value: warnCount + duplicates.length, label: t('reports.tagIntelligence.severity.warning', 'WARNING'), color: (warnCount + duplicates.length) > 0 ? '#f59e0b' : '#10b981' },
          { value: infoCount, label: t('reports.tagIntelligence.severity.info', 'INFO'), color: '#3b82f6' }
        ]);
      }

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
          var dupMsg = dup.messageKey ? t('reports.' + dup.messageKey, dup.message || '') : (dup.message || (dup.tag + ' (' + dup.count + 'x)'));
          html += '<div class="pdf-issue pdf-issue--warning">' +
            '<span class="pdf-issue__severity pdf-issue__severity--warning">' + esc(t('reports.tagIntelligence.severity.warning', 'WARNING')) + '</span>' +
            '<span class="pdf-issue__text">' + esc(dupMsg) + '</span>' +
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
       3. Tags by Category — enriched with per-tag detail rows
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

      // Category summary table
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

        // Per-category detailed breakdown (like the web UI shows)
        catKeys.forEach(function (cat) {
          var catTags = tagsByCategory[cat] || tags.filter(function (tag) { return tag.category === cat; });
          if (catTags.length === 0) return;

          html += '<h3 class="pdf-subsection__title">' + esc(CATEGORY_LABELS[cat] || cat) + ' (' + catTags.length + ')</h3>';

          var detailRows = catTags.map(function (tag) {
            var idStr = (tag.ids && tag.ids.length > 0) ? tag.ids.join(', ') : t('reports.common.notAvailable', 'N/A');
            return [
              '<strong>' + esc(tag.name || '-') + '</strong>',
              '<span style="font-family:monospace;font-size:0.85em;">' + esc(truncate(idStr, 40)) + '</span>',
              String(tag.instances || 1)
            ];
          });

          html += PR.renderTable(
            [
              { label: t('reports.tagIntelligence.report.overview.table.name', 'Tag Name'), width: '35%' },
              { label: t('reports.tagIntelligence.report.overview.table.ids', 'IDs'), width: '45%' },
              { label: t('reports.tagIntelligence.report.overview.table.instances', 'Instances'), width: '12%' }
            ],
            detailRows,
            { striped: true }
          );
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Script Performance — enriched with score bar, recommendation,
          severity on issues
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-performance .pdf-section__content');
      if (!performanceImpact.score && !performanceImpact.stats) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = performanceImpact.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.scriptPerformanceImpact', 'Script Performance Impact'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.performance', 'Marketing tags and tracking scripts can significantly impact page load performance. Synchronous scripts block rendering while they load, and inline scripts add to the initial HTML payload. This section analyzes script loading methods, identifying blocking scripts that should be converted to async or defer loading. Optimizing script loading can reduce Time to Interactive by hundreds of milliseconds.')) + '</p>';

      // Performance score progress bar
      if (score !== undefined && score !== null) {
        html += PR.renderProgress(
          t('reports.tagIntelligence.performanceScore', 'Performance Score'),
          score, 100
        );
      }

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

      // Script loading breakdown table
      var totalScripts = (stats.syncScripts || 0) + (stats.asyncScripts || 0) + (stats.deferScripts || 0) + (stats.inlineScripts || 0);
      if (totalScripts > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.performance.breakdownHeading', 'Loading Strategy Breakdown')) + '</h3>';
        var breakdownRows = [];
        if (stats.asyncScripts) {
          breakdownRows.push([
            esc(t('reports.tagIntelligence.report.performance.asyncLabel', 'Async')),
            String(stats.asyncScripts),
            PR.renderStatus('pass', t('reports.tagIntelligence.report.performance.optimal', 'Optimal'))
          ]);
        }
        if (stats.deferScripts) {
          breakdownRows.push([
            esc(t('reports.tagIntelligence.report.performance.deferLabel', 'Defer')),
            String(stats.deferScripts),
            PR.renderStatus('pass', t('reports.tagIntelligence.report.performance.good', 'Good'))
          ]);
        }
        if (stats.syncScripts) {
          breakdownRows.push([
            esc(t('reports.tagIntelligence.report.performance.syncLabel', 'Sync (Blocking)')),
            String(stats.syncScripts),
            PR.renderStatus('fail', t('reports.tagIntelligence.report.performance.blocking', 'Blocking'))
          ]);
        }
        if (stats.inlineScripts) {
          breakdownRows.push([
            esc(t('reports.tagIntelligence.report.performance.inlineLabel', 'Inline')),
            String(stats.inlineScripts),
            PR.renderStatus('info', t('reports.tagIntelligence.report.performance.embedded', 'Embedded'))
          ]);
        }
        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.performance.method', 'Method'), width: '40%' },
            { label: t('reports.tagIntelligence.report.categories.table.count', 'Count'), width: '15%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          breakdownRows,
          { striped: true }
        );
      }

      // Performance issues with severity
      if (performanceImpact.issues && performanceImpact.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.performance.issuesHeading', 'Performance Issues')) + '</h3>';
        performanceImpact.issues.forEach(function (issue) {
          var issueSev = issue.severity === 'warning' ? 'warning' : 'info';
          html += PR.renderIssue(issue.message || '', issueSev);
        });
      }

      // Performance recommendation (shown in web UI)
      if (performanceImpact.recommendation) {
        html += PR.renderCallout(
          t('reports.tagIntelligence.report.performance.recommendationTitle', 'Performance Recommendation'),
          performanceImpact.recommendation,
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Third-Party Scripts — enriched with byCategory breakdown, count,
          size columns
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

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.thirdParty', 'Third-party scripts are loaded from external domains and include analytics libraries, advertising pixels, and CDN-hosted utilities. Each external script introduces a dependency on another server\'s availability and performance. This section catalogs all third-party scripts by host, category, and loading method. Minimizing third-party dependencies and ensuring proper async loading reduces performance risk.'s availability and performance. This section catalogs all third-party scripts by host, category, and loading method. Minimizing third-party dependencies and ensuring proper async loading reduces performance risk.')) + '</p>';

      // Metrics — total + byCategory breakdown
      var byCat = thirdPartyScripts.byCategory || {};
      var catMetrics = [
        { value: thirdPartyScripts.total || 0, label: t('reports.tagIntelligence.report.thirdParty.totalLabel', 'Third-Party Scripts') }
      ];
      Object.keys(byCat).forEach(function (cat) {
        catMetrics.push({
          value: byCat[cat] || 0,
          label: esc(CATEGORY_LABELS[cat] || cat)
        });
      });
      html += PR.renderMetrics(catMetrics);

      // Scripts table with count + size
      var scripts = thirdPartyScripts.scripts || [];
      if (scripts.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.thirdParty.detailHeading', 'Script Details')) + '</h3>';
        var scriptRows = scripts.slice(0, 25).map(function (s) {
          var loadLabel = s.async ? t('reports.tagIntelligence.loadingMethod.async', 'async') : s.defer ? t('reports.tagIntelligence.loadingMethod.defer', 'defer') : t('reports.tagIntelligence.loadingMethod.sync', 'sync');
          var loadStatus = s.async ? 'pass' : s.defer ? 'pass' : 'fail';
          return [
            '<strong>' + esc(s.name || '-') + '</strong>',
            '<span class="pdf-table__truncate">' + esc(truncate(s.host || s.src || '', 30)) + '</span>',
            esc(CATEGORY_LABELS[s.category] || s.category || '-'),
            PR.renderStatus(loadStatus, loadLabel),
            String(s.count || 1),
            esc(s.sizeFormatted || '-')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.thirdParty.table.name', 'Name'), width: '18%' },
            { label: t('reports.tagIntelligence.report.thirdParty.table.host', 'Host'), width: '22%' },
            { label: t('reports.tagIntelligence.report.thirdParty.table.category', 'Category'), width: '15%' },
            { label: t('reports.tagIntelligence.report.thirdParty.table.loading', 'Loading'), width: '12%' },
            { label: t('reports.tagIntelligence.report.thirdParty.table.count', 'Count'), width: '8%' },
            { label: t('reports.tagIntelligence.report.thirdParty.table.size', 'Size'), width: '10%' }
          ],
          scriptRows,
          { striped: true }
        );

        if (scripts.length > 25) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: scripts.length - 25 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Tag Load Waterfall (NEW — matches web UI)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-waterfall .pdf-section__content');
      if (!sec) return;
      var waterfallScripts = waterfall.scripts || [];
      if (waterfallScripts.length === 0) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.tagLoadWaterfall', 'Tag Load Waterfall'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.waterfall', 'The tag load waterfall shows the timing and sequence of script loading on your page. Scripts that load early and block rendering have the greatest performance impact. This visualization helps identify opportunities to defer or async-load scripts to improve page load times.')) + '</p>';

      // Waterfall metrics
      html += PR.renderMetrics([
        { value: (waterfall.totalLoadTime || 0) + 'ms', label: t('reports.tagIntelligence.totalLoadTime', 'Total Load Time'), color: (waterfall.totalLoadTime || 0) > 3000 ? '#ef4444' : '#10b981' },
        { value: waterfall.totalSizeFormatted || '-', label: t('reports.tagIntelligence.totalSize', 'Total Size') },
        { value: waterfall.totalScripts || waterfallScripts.length, label: t('reports.tagIntelligence.scripts', 'scripts') },
        { value: waterfall.blockingCount || 0, label: t('reports.tagIntelligence.blockingScripts', 'Blocking Scripts'), color: (waterfall.blockingCount || 0) > 5 ? '#ef4444' : '#10b981' }
      ]);

      // Waterfall insights
      var insights = waterfall.insights || [];
      if (insights.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.waterfall.insightsHeading', 'Waterfall Insights')) + '</h3>';
        insights.forEach(function (insight) {
          var insightType = insight.type === 'warning' ? 'warning' : (insight.type === 'good' ? 'tip' : 'info');
          if (insight.recommendation) {
            html += PR.renderCallout(
              insight.message || '',
              insight.recommendation,
              insightType
            );
          } else {
            html += PR.renderIssue(insight.message || '', insightType === 'tip' ? 'info' : insightType);
          }
        });
      }

      // Waterfall table — script by script timing
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.waterfall.timingHeading', 'Script Load Timing')) + '</h3>';

      var maxTime = waterfall.totalLoadTime || 1;
      var wfRows = waterfallScripts.slice(0, 25).map(function (script) {
        // Build a text-based timing bar
        var startPct = Math.round(((script.startTime || 0) / maxTime) * 100);
        var widthPct = Math.max(Math.round(((script.duration || 0) / maxTime) * 100), 2);
        var barColor = _waterfallColor(script.category);
        var timingBar = '<div style="position:relative;height:14px;background:#f0f0f0;border-radius:3px;overflow:hidden;">' +
          '<div style="position:absolute;left:' + startPct + '%;width:' + widthPct + '%;height:100%;background:' + barColor + ';border-radius:3px;"></div>' +
          '</div>';

        return [
          '<span class="pdf-table__truncate">' + esc(truncate(script.vendor || script.name || '-', 20)) + '</span>',
          esc(CATEGORY_LABELS[script.category] || script.category || '-'),
          timingBar,
          '<strong>' + (script.duration || 0) + 'ms</strong>',
          esc(script.sizeFormatted || '-')
        ];
      });

      html += PR.renderTable(
        [
          { label: t('reports.tagIntelligence.report.waterfall.table.script', 'Script'), width: '18%' },
          { label: t('reports.tagIntelligence.report.overview.table.category', 'Category'), width: '12%' },
          { label: t('reports.tagIntelligence.report.waterfall.table.timing', 'Timing'), width: '35%' },
          { label: t('reports.tagIntelligence.report.waterfall.table.duration', 'Duration'), width: '10%' },
          { label: t('reports.tagIntelligence.report.thirdParty.table.size', 'Size'), width: '10%' }
        ],
        wfRows,
        { striped: true }
      );

      if (waterfallScripts.length > 25) {
        html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: waterfallScripts.length - 25 }) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       7. DataLayer Analysis — enriched with ecommerce detail
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-datalayer .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.dataLayerAnalysis', 'DataLayer Analysis'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.dataLayer', 'The dataLayer is a JavaScript array used by Google Tag Manager to pass structured data between your website and marketing tags. A well-implemented dataLayer centralizes event tracking and enables consistent measurement across all tags. This section checks for dataLayer presence, event count, and ecommerce implementation. A robust dataLayer is the foundation of accurate marketing analytics.')) + '</p>';

      // DataLayer detection + ecommerce metrics
      var dlMetrics = [
        { value: dataLayer.found ? t('seo.report.status.detected', 'Detected') : t('seo.report.status.notDetected', 'Not detected'), label: 'DataLayer', color: dataLayer.found ? '#10b981' : '#f59e0b' },
        { value: dataLayer.eventCount || 0, label: t('reports.tagIntelligence.report.dataLayer.eventsLabel', 'Events') }
      ];
      // Add ecommerce status to metrics
      if (dataLayer.ecommerce) {
        dlMetrics.push({
          value: dataLayer.ecommerce.detected ? t('seo.report.status.detected', 'Detected') : t('seo.report.status.notDetected', 'Not detected'),
          label: t('reports.tagIntelligence.ecommerceTracking', 'Ecommerce Tracking'),
          color: dataLayer.ecommerce.detected ? '#10b981' : '#6b7280'
        });
      }
      html += PR.renderMetrics(dlMetrics);

      // DataLayer properties table
      if (dataLayer.found) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.dataLayer.propertiesHeading', 'DataLayer Properties')) + '</h3>';
        var propRows = [
          [esc(t('reports.tagIntelligence.report.dataLayer.status', 'Status')), PR.renderStatus(dataLayer.found ? 'pass' : 'fail', dataLayer.found ? t('seo.report.status.detected', 'Detected') : t('seo.report.status.notDetected', 'Not detected'))],
          [esc(t('reports.tagIntelligence.report.dataLayer.eventsLabel', 'Events')), String(dataLayer.eventCount || 0)]
        ];
        if (dataLayer.ecommerce) {
          propRows.push([
            esc(t('reports.tagIntelligence.ecommerceTracking', 'Ecommerce Tracking')),
            dataLayer.ecommerce.detected
              ? PR.renderStatus('pass', esc(dataLayer.ecommerce.type || 'GA4 Ecommerce'))
              : PR.renderStatus('notFound', t('seo.report.status.notDetected', 'Not detected'))
          ]);
        }
        html += PR.renderTable(
          [
            { label: t('seo.report.table.property', 'Property'), width: '35%' },
            { label: t('seo.report.table.value', 'Value'), width: '55%' }
          ],
          propRows,
          { striped: true }
        );
      }

      // Ecommerce callout
      if (dataLayer.ecommerce && dataLayer.ecommerce.detected) {
        html += PR.renderCallout(
          t('reports.tagIntelligence.report.dataLayer.ecommerceTitle', 'Ecommerce Tracking Detected'),
          (dataLayer.ecommerce.type || 'GA4 Ecommerce') + ' — ' + t('reports.tagIntelligence.report.dataLayer.ecommerceBody', 'Ecommerce events are being tracked through the dataLayer, enabling revenue and transaction reporting.'),
          'tip'
        );
      }

      // Event list
      if (dataLayer.events && dataLayer.events.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.dataLayer.eventsHeading', 'DataLayer Events')) + '</h3>';
        var eventRows = dataLayer.events.slice(0, 20).map(function (evt) {
          return [
            '<code style="font-size:0.9em;">' + esc(evt) + '</code>',
            PR.renderStatus('found', t('seo.report.status.found', 'Found'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.dataLayer.table.event', 'Event Name'), width: '65%' },
            { label: t('seo.report.table.status', 'Status'), width: '25%' }
          ],
          eventRows,
          { striped: true }
        );

        if (dataLayer.events.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: dataLayer.events.length - 20 }) + '</p>';
        }
      }

      // Consent mode — enriched with detailed status table
      if (consentMode && consentMode.implemented !== undefined) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.consentMode', 'Consent Mode')) + '</h3>';

        var consentRows = [
          [
            esc(t('reports.tagIntelligence.report.dataLayer.consentStatus', 'Implementation Status')),
            consentMode.implemented
              ? PR.renderStatus('pass', t('reports.tagIntelligence.report.dataLayer.consentImplemented', 'Consent Mode Implemented'))
              : PR.renderStatus('fail', t('reports.tagIntelligence.report.dataLayer.consentMissing', 'Consent Mode Not Implemented'))
          ]
        ];
        if (consentMode.version) {
          consentRows.push([
            esc(t('reports.tagIntelligence.report.dataLayer.consentVersion', 'Version')),
            esc(consentMode.version)
          ]);
        }
        html += PR.renderTable(
          [
            { label: t('seo.report.table.property', 'Property'), width: '35%' },
            { label: t('seo.report.table.value', 'Value'), width: '55%' }
          ],
          consentRows,
          { striped: true }
        );

        if (consentMode.recommendation) {
          html += PR.renderCallout(
            t('reports.tagIntelligence.report.dataLayer.consentRecTitle', 'Consent Mode Recommendation'),
            consentMode.recommendation,
            consentMode.implemented ? 'tip' : 'warning'
          );
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       8. Cookie Audit — enriched with complianceScore, purpose column,
          richer issue cards
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cookies .pdf-section__content');
      if (!cookies.count && !(cookies.cookies && cookies.cookies.length > 0)) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var complianceScore = cookies.complianceScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.tagIntelligence.cookieAudit', 'Cookie Audit'), complianceScore)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.tagIntelligence.report.sectionIntros.cookies', 'Cookies set by tags and third-party scripts carry privacy and compliance implications. Under GDPR, CCPA, and similar regulations, users must be informed about cookies and in many cases give consent before non-essential cookies are set. This section audits all detected cookies, their vendors, purposes, and security attributes. Understanding your cookie landscape is essential for privacy compliance.')) + '</p>';

      // Compliance score progress bar
      if (complianceScore !== undefined && complianceScore !== null) {
        html += PR.renderProgress(
          t('reports.tagIntelligence.complianceScore', 'Compliance Score'),
          complianceScore, 100
        );
      }

      // Cookie metrics including compliance score
      var cookieMetrics = [
        { value: cookies.count || 0, label: t('reports.tagIntelligence.report.cookies.totalLabel', 'Total Cookies') }
      ];
      if (complianceScore !== undefined && complianceScore !== null) {
        cookieMetrics.push({
          value: complianceScore + '/100',
          label: t('reports.tagIntelligence.complianceScore', 'Compliance Score'),
          color: complianceScore >= 80 ? '#10b981' : complianceScore >= 60 ? '#f59e0b' : '#ef4444'
        });
      }
      html += PR.renderMetrics(cookieMetrics);

      // Cookie type breakdown
      var cookieSummary = cookies.summary || cookies.types || {};
      if (Object.keys(cookieSummary).length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.cookies.typeBreakdown', 'Cookie Type Breakdown')) + '</h3>';
        var typeRows = Object.keys(cookieSummary).map(function (type) {
          var typeLabel = _cookieTypeLabel(type, t);
          var count = cookieSummary[type] || 0;
          return [
            '<strong>' + esc(typeLabel) + '</strong>',
            String(count),
            PR.renderProgress('', count, cookies.count || 1)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.cookies.table.type', 'Type'), width: '25%' },
            { label: t('reports.tagIntelligence.report.cookies.table.count', 'Count'), width: '10%' },
            { label: t('reports.tagIntelligence.report.cookies.table.proportion', 'Proportion'), width: '50%' }
          ],
          typeRows,
          { striped: true }
        );
      }

      // Cookie details table — now includes purpose + type columns
      var cookieList = cookies.cookies || [];
      if (cookieList.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.cookies.detailsHeading', 'Cookie Details')) + '</h3>';
        var cookieRows = cookieList.slice(0, 25).map(function (c) {
          var typeLabel = _cookieTypeLabel(c.type, t);
          return [
            '<span class="pdf-table__truncate" style="font-family:monospace;font-size:0.85em;">' + esc(truncate(c.name, 22)) + '</span>',
            esc(typeLabel),
            esc(c.vendor || '-'),
            '<span class="pdf-table__truncate pdf-text-small">' + esc(truncate(c.purpose || '-', 30)) + '</span>',
            esc(c.domain || '-'),
            c.hasSecure ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            esc(c.expires || '-')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.tagIntelligence.report.cookies.table.name', 'Name'), width: '16%' },
            { label: t('reports.tagIntelligence.cookieType', 'Type'), width: '10%' },
            { label: t('reports.tagIntelligence.report.cookies.table.vendor', 'Vendor'), width: '14%' },
            { label: t('reports.tagIntelligence.cookiePurpose', 'Purpose'), width: '18%' },
            { label: t('reports.tagIntelligence.report.cookies.table.domain', 'Domain'), width: '14%' },
            { label: t('reports.tagIntelligence.cookieSecure', 'Secure'), width: '8%' },
            { label: t('reports.tagIntelligence.report.cookies.table.expires', 'Expires'), width: '10%' }
          ],
          cookieRows,
          { striped: true }
        );

        if (cookieList.length > 25) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: cookieList.length - 25 }) + '</p>';
        }
      }

      // Cookie compliance issues — enriched with severity + recommendation
      if (cookies.issues && cookies.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.tagIntelligence.report.cookies.issuesHeading', 'Compliance Issues')) + '</h3>';
        cookies.issues.forEach(function (issue) {
          if (typeof issue === 'string') {
            html += PR.renderIssue(issue, 'warning');
          } else {
            var issueSev = issue.severity === 'high' ? 'warning' : (issue.severity || 'warning');
            var issueMsg = issue.message || '';
            html += '<div class="pdf-issue pdf-issue--' + issueSev + '">' +
              '<span class="pdf-issue__severity pdf-issue__severity--' + issueSev + '">' + esc((issue.severity || 'warning').toUpperCase()) + '</span>' +
              '<span class="pdf-issue__text">' + esc(issueMsg) +
              (issue.recommendation ? '<br><em>' + esc(issue.recommendation) + '</em>' : '') +
              '</span>' +
            '</div>';
          }
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       9. Recommendations — enriched with impact badges,
          description paragraphs, category labels
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
        // Summary metrics
        var highRecs = recommendations.filter(function (r) { return r.priority === 'high'; });
        var medRecs = recommendations.filter(function (r) { return r.priority === 'medium'; });
        var lowRecs = recommendations.filter(function (r) { return !r.priority || r.priority === 'low'; });

        html += PR.renderMetrics([
          { value: recommendations.length, label: t('reports.tagIntelligence.report.recommendations.totalLabel', 'Total Recommendations') },
          { value: highRecs.length, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: highRecs.length > 0 ? '#ef4444' : '#10b981' },
          { value: medRecs.length, label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: medRecs.length > 0 ? '#f59e0b' : '#10b981' },
          { value: lowRecs.length, label: t('common.pdf.execSummary.lowPriority', 'Low Priority'), color: '#3b82f6' }
        ]);

        var groups = [
          { items: highRecs, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#ef4444', sev: 'warning' },
          { items: medRecs, label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: '#f59e0b', sev: 'warn' },
          { items: lowRecs, label: t('common.pdf.execSummary.lowPriority', 'Low Priority'), color: '#3b82f6', sev: 'info' }
        ];

        groups.forEach(function (group) {
          if (group.items.length === 0) return;
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:' + group.color + ';">&#9679; ' + esc(group.label) + ' (' + group.items.length + ')</div>';

          group.items.forEach(function (r) {
            var recTitleKey = r.titleKey ? 'reports.' + r.titleKey : '';
            var recDescKey = r.descriptionKey ? 'reports.' + r.descriptionKey : '';
            var recTitle = recTitleKey ? t(recTitleKey, r.title || r.message || '') : (r.title || r.message || '');
            var recDesc = recDescKey ? t(recDescKey, r.description || r.details || '', r.descriptionParams) : (r.description || r.details || '');

            html += '<div class="pdf-rec" style="border-left-color:' + group.color + ';">';
            html += '<div class="pdf-rec__text">';

            // Impact badge
            if (r.impact) {
              html += '<span class="pdf-status pdf-status--' + (r.impact === 'high' ? 'fail' : r.impact === 'medium' ? 'warn' : 'info') + '" style="margin-right:6px;font-size:0.75em;">' + esc((r.impact || '').toUpperCase()) + ' ' + esc(t('reports.tagIntelligence.report.recommendations.impact', 'IMPACT')) + '</span>';
            }

            // Category badge
            if (r.category) {
              html += '<span class="pdf-status pdf-status--info" style="margin-right:6px;font-size:0.75em;">' + esc(CATEGORY_LABELS[r.category] || r.category) + '</span>';
            }

            html += '<strong>' + esc(recTitle) + '</strong>';

            if (recDesc) {
              html += '<br><span style="color:#6b7280;">' + esc(recDesc) + '</span>';
            }

            // Steps
            if (r.steps && r.steps.length > 0) {
              html += '<div style="margin-top:6px;padding-left:12px;">';
              r.steps.forEach(function (step, idx) {
                html += '<div style="margin-bottom:3px;font-size:0.9em;color:#4b5563;">' + (idx + 1) + '. ' + esc(step) + '</div>';
              });
              html += '</div>';
            }

            // Problematic code / fixed code
            if (r.problematicCode) {
              html += '<div style="margin-top:6px;">';
              html += '<div style="font-size:0.75em;color:#ef4444;font-weight:600;">' + esc(t('reports.tagIntelligence.report.recommendations.problematicCode', 'Problematic Code')) + ':</div>';
              html += '<pre style="background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:6px 8px;font-size:0.8em;overflow:hidden;white-space:pre-wrap;margin:3px 0;">' + esc(truncate(r.problematicCode, 200)) + '</pre>';
              html += '</div>';
            }
            if (r.fixedCode) {
              html += '<div style="margin-top:4px;">';
              html += '<div style="font-size:0.75em;color:#10b981;font-weight:600;">' + esc(t('reports.tagIntelligence.report.recommendations.fixedCode', 'Fixed Code')) + ':</div>';
              html += '<pre style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:6px 8px;font-size:0.8em;overflow:hidden;white-space:pre-wrap;margin:3px 0;">' + esc(truncate(r.fixedCode, 200)) + '</pre>';
              html += '</div>';
            }

            // Resources
            if (r.resources && r.resources.length > 0) {
              html += '<div style="margin-top:6px;font-size:0.85em;">';
              html += '<strong style="color:#6b7280;">' + esc(t('reports.tagIntelligence.report.recommendations.resources', 'Resources')) + ':</strong>';
              r.resources.forEach(function (res) {
                var resTitle = typeof res === 'string' ? res : (res.title || res.url || '');
                var resUrl = typeof res === 'string' ? '' : (res.url || '');
                html += '<div style="color:#3b82f6;margin-left:8px;">';
                if (resUrl) {
                  html += esc(resTitle) + ' (' + esc(truncate(resUrl, 50)) + ')';
                } else {
                  html += esc(resTitle);
                }
                html += '</div>';
              });
              html += '</div>';
            }

            html += '</div></div>';
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

  /** Cookie type label helper */
  function _cookieTypeLabel(type, t) {
    var labels = {
      necessary: t('reports.tagIntelligence.cookieTypes.essential', 'Essential'),
      analytics: t('reports.tagIntelligence.cookieTypes.analytics', 'Analytics'),
      advertising: t('reports.tagIntelligence.cookieTypes.advertising', 'Advertising'),
      functional: t('reports.tagIntelligence.cookieTypes.functional', 'Functional'),
      marketing: t('reports.tagIntelligence.cookieTypes.marketing', 'Marketing'),
      unknown: t('reports.tagIntelligence.cookieTypes.unknown', 'Unknown')
    };
    return labels[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : '-');
  }

  /** Waterfall bar color by category */
  function _waterfallColor(category) {
    var colors = {
      analytics: '#3b82f6',
      advertising: '#f59e0b',
      session_recording: '#ec4899',
      ab_testing: '#8b5cf6',
      consent: '#10b981',
      customer_support: '#06b6d4',
      marketing: '#ef4444',
      error_monitoring: '#f97316',
      cdp: '#14b8a6',
      tag_manager: '#8b5cf6',
      cdn: '#3b82f6',
      library: '#10b981'
    };
    return colors[category] || '#6b7280';
  }

  function _htmlToNode(html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.firstChild;
  }

})(window);
