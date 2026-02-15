/**
 * Broken Links Report — PDF Renderer
 * Renders all broken links analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[broken-links-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('broken-links', function renderBrokenLinks(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;

    var sectionIndex = 1;

    var summary = data.summary || {};
    var links = data.links || {};
    var brokenLinks = links.broken || [];
    var redirectLinks = links.redirects || [];
    var workingLinks = links.working || [];
    var anchorAnalysis = data.anchorAnalysis || {};
    var attributeAnalysis = data.attributeAnalysis || {};
    var redirectAnalysis = data.redirectAnalysis || {};
    var recommendations = data.recommendations || [];

    /* -----------------------------------------------------------------------
       1. Link Summary
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-summary .pdf-section__content');
      var score = data.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brokenLinks.report.sections.summary', 'Link Summary'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brokenLinks.report.sectionIntros.summary', 'This summary provides an overview of all links discovered on your page, categorized by status. Broken links create poor user experiences and waste search engine crawl budget. A healthy link profile has zero broken links, minimal redirects, and a balanced mix of internal and external links.')) + '</p>';

      // Metrics cards
      var total = summary.total || 0;
      var broken = summary.broken || 0;
      var redirects = summary.redirects || 0;
      var working = summary.working || 0;
      var external = summary.external || 0;

      html += PR.renderMetrics([
        { value: total, label: t('reports.brokenLinks.report.metrics.total', 'Total Links') },
        { value: broken, label: t('reports.brokenLinks.report.metrics.broken', 'Broken'), color: broken > 0 ? '#ef4444' : '#10b981' },
        { value: redirects, label: t('reports.brokenLinks.report.metrics.redirects', 'Redirects'), color: redirects > 0 ? '#f59e0b' : '#10b981' },
        { value: working, label: t('reports.brokenLinks.report.metrics.working', 'Working'), color: '#10b981' },
        { value: external, label: t('reports.brokenLinks.report.metrics.external', 'External') }
      ]);

      // Link health progress bar
      if (total > 0) {
        html += PR.renderProgress(
          t('reports.brokenLinks.report.metrics.linkHealth', 'Link Health'),
          working, total
        );
      }

      // Internal vs external breakdown
      var internal = summary.internal || 0;
      if (total > 0 && (internal > 0 || external > 0)) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brokenLinks.report.summary.breakdownHeading', 'Link Breakdown')) + '</h3>';

        html += PR.renderTable(
          [
            { label: t('reports.brokenLinks.report.summary.table.type', 'Type'), width: '40%' },
            { label: t('reports.brokenLinks.report.summary.table.count', 'Count'), width: '30%' },
            { label: t('reports.brokenLinks.report.summary.table.percentage', 'Percentage'), width: '30%' }
          ],
          [
            [
              esc(t('reports.brokenLinks.report.summary.internal', 'Internal Links')),
              String(internal),
              total > 0 ? Math.round((internal / total) * 100) + '%' : '-'
            ],
            [
              esc(t('reports.brokenLinks.report.summary.external', 'External Links')),
              String(external),
              total > 0 ? Math.round((external / total) * 100) + '%' : '-'
            ],
            [
              '<strong>' + esc(t('reports.brokenLinks.report.summary.broken', 'Broken Links')) + '</strong>',
              '<span style="color:#ef4444;font-weight:600;">' + broken + '</span>',
              total > 0 ? Math.round((broken / total) * 100) + '%' : '-'
            ],
            [
              esc(t('reports.brokenLinks.report.summary.redirects', 'Redirects')),
              '<span style="color:#f59e0b;font-weight:600;">' + redirects + '</span>',
              total > 0 ? Math.round((redirects / total) * 100) + '%' : '-'
            ]
          ],
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Broken Links
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-broken .pdf-section__content');
      var score = brokenLinks.length === 0 ? 100 : Math.max(0, 100 - (brokenLinks.length * 5));

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brokenLinks.report.sections.broken', 'Broken Links'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brokenLinks.report.sectionIntros.broken', 'Broken links return HTTP error codes (4xx or 5xx) and lead visitors to dead ends. Each broken link represents a missed opportunity for engagement and can negatively impact your search rankings. This section lists all broken links found with their status codes and source locations.')) + '</p>';

      if (brokenLinks.length > 0) {
        html += PR.renderMetrics([
          { value: brokenLinks.length, label: t('reports.brokenLinks.report.broken.totalBroken', 'Broken Links Found'), color: '#ef4444' }
        ]);

        // Broken links table (up to 50)
        var brokenRows = brokenLinks.slice(0, 50).map(function (link) {
          var statusColor = (link.statusCode >= 500) ? '#ef4444' : '#f97316';
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(link.url || '', 60)) + '</span>',
            '<span style="color:' + statusColor + ';font-weight:600;">' + (link.statusCode || '-') + '</span>',
            '<span class="pdf-table__truncate">' + esc(truncate(link.sourceUrl || '', 40)) + '</span>',
            esc(truncate(link.anchorText || '-', 30))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.brokenLinks.report.broken.table.url', 'URL'), width: '35%' },
            { label: t('reports.brokenLinks.report.broken.table.status', 'Status'), width: '10%' },
            { label: t('reports.brokenLinks.report.broken.table.source', 'Source Page'), width: '30%' },
            { label: t('reports.brokenLinks.report.broken.table.anchor', 'Anchor Text'), width: '25%' }
          ],
          brokenRows,
          { striped: true }
        );

        if (brokenLinks.length > 50) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: brokenLinks.length - 50 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('reports.brokenLinks.report.broken.noneTitle', 'No Broken Links Found'),
          t('reports.brokenLinks.report.broken.noneBody', 'All links on this site returned successful responses. Continue monitoring to catch new issues early.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Redirects
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-redirects .pdf-section__content');
      var score = redirectLinks.length === 0 ? 100 : Math.max(0, 100 - (redirectLinks.length * 2));

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brokenLinks.report.sections.redirects', 'Redirects'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brokenLinks.report.sectionIntros.redirects', 'Redirects add latency to page loads and can create chains that significantly slow navigation. While some redirects are necessary, excessive or chained redirects indicate maintenance issues. This section identifies all redirecting links and their final destinations.')) + '</p>';

      if (redirectLinks.length > 0) {
        html += PR.renderMetrics([
          { value: redirectLinks.length, label: t('reports.brokenLinks.report.redirects.totalRedirects', 'Redirects Found'), color: '#f59e0b' }
        ]);

        // Redirect chain info
        if (redirectAnalysis.chains && redirectAnalysis.chains.length > 0) {
          html += PR.renderIssue(
            t('reports.brokenLinks.report.redirects.chainsWarning', 'Redirect chains detected') + ': ' + redirectAnalysis.chains.length + ' ' + t('reports.brokenLinks.report.redirects.chainsFound', 'chains found'),
            'warning'
          );
        }

        // Redirects table (up to 30)
        var redirectRows = redirectLinks.slice(0, 30).map(function (link) {
          var statusLabel = link.statusCode === 301 ? '301 Permanent' : link.statusCode === 302 ? '302 Temporary' : String(link.statusCode || '-');
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(link.url || '', 50)) + '</span>',
            PR.renderStatus(link.statusCode === 301 ? 'pass' : 'review', statusLabel),
            '<span class="pdf-table__truncate">' + esc(truncate(link.redirectUrl || '', 50)) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.brokenLinks.report.redirects.table.url', 'Original URL'), width: '35%' },
            { label: t('reports.brokenLinks.report.redirects.table.status', 'Status'), width: '18%' },
            { label: t('reports.brokenLinks.report.redirects.table.target', 'Redirect Target'), width: '40%' }
          ],
          redirectRows,
          { striped: true }
        );

        if (redirectLinks.length > 30) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: redirectLinks.length - 30 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('reports.brokenLinks.report.redirects.noneTitle', 'No Redirects Found'),
          t('reports.brokenLinks.report.redirects.noneBody', 'All links resolve directly without redirects. This is optimal for performance and link equity.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Anchor Analysis
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-anchors .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brokenLinks.report.sections.anchors', 'Anchor Analysis'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brokenLinks.report.sectionIntros.anchors', 'Anchor text analysis examines the descriptive text used in your links. Well-crafted anchor text helps both users and search engines understand link destinations. This section evaluates anchor text quality, diversity, and relevance.')) + '</p>';

      if (anchorAnalysis && Object.keys(anchorAnalysis).length > 0) {
        // Metrics
        var anchorMetrics = [];
        if (anchorAnalysis.totalAnchors !== undefined) {
          anchorMetrics.push({ value: anchorAnalysis.totalAnchors, label: t('reports.brokenLinks.report.anchors.totalAnchors', 'Total Anchors') });
        }
        if (anchorAnalysis.emptyAnchors !== undefined) {
          anchorMetrics.push({ value: anchorAnalysis.emptyAnchors, label: t('reports.brokenLinks.report.anchors.emptyAnchors', 'Empty Anchors'), color: anchorAnalysis.emptyAnchors > 0 ? '#f59e0b' : '#10b981' });
        }
        if (anchorAnalysis.genericAnchors !== undefined) {
          anchorMetrics.push({ value: anchorAnalysis.genericAnchors, label: t('reports.brokenLinks.report.anchors.genericAnchors', 'Generic Anchors'), color: anchorAnalysis.genericAnchors > 0 ? '#f59e0b' : '#10b981' });
        }
        if (anchorAnalysis.descriptiveAnchors !== undefined) {
          anchorMetrics.push({ value: anchorAnalysis.descriptiveAnchors, label: t('reports.brokenLinks.report.anchors.descriptiveAnchors', 'Descriptive Anchors'), color: '#10b981' });
        }

        if (anchorMetrics.length > 0) {
          html += PR.renderMetrics(anchorMetrics);
        }

        // Progress bar for descriptive anchors
        if (anchorAnalysis.totalAnchors > 0 && anchorAnalysis.descriptiveAnchors !== undefined) {
          html += PR.renderProgress(
            t('reports.brokenLinks.report.anchors.descriptiveRatio', 'Descriptive Anchor Ratio'),
            anchorAnalysis.descriptiveAnchors || 0, anchorAnalysis.totalAnchors
          );
        }

        // Common anchor texts table
        if (anchorAnalysis.commonTexts && anchorAnalysis.commonTexts.length > 0) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brokenLinks.report.anchors.commonHeading', 'Most Common Anchor Texts')) + '</h3>';

          var anchorRows = anchorAnalysis.commonTexts.slice(0, 15).map(function (item) {
            var textDisplay = item.text || item.anchor || '-';
            var isGeneric = /^(click here|read more|here|learn more|link|more|this)$/i.test(textDisplay);
            return [
              esc(truncate(textDisplay, 50)),
              String(item.count || 0),
              isGeneric
                ? PR.renderStatus('warning', t('reports.brokenLinks.report.anchors.generic', 'Generic'))
                : PR.renderStatus('pass', t('reports.brokenLinks.report.anchors.descriptive', 'Descriptive'))
            ];
          });

          html += PR.renderTable(
            [
              { label: t('reports.brokenLinks.report.anchors.table.text', 'Anchor Text'), width: '50%' },
              { label: t('reports.brokenLinks.report.anchors.table.count', 'Count'), width: '15%' },
              { label: t('reports.brokenLinks.report.anchors.table.quality', 'Quality'), width: '25%' }
            ],
            anchorRows,
            { striped: true }
          );
        }

        // Issues
        if (anchorAnalysis.issues && anchorAnalysis.issues.length > 0) {
          anchorAnalysis.issues.forEach(function (issue) {
            var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
            html += PR.renderIssue(text, 'warning');
          });
        }
      } else {
        html += '<p class="pdf-text-muted">' + esc(t('reports.brokenLinks.report.anchors.noData', 'No anchor text analysis data available.')) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Link Attributes
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-attributes .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brokenLinks.report.sections.attributes', 'Link Attributes'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brokenLinks.report.sectionIntros.attributes', 'Link attributes like rel, target, and nofollow influence how search engines interpret and follow your links. This section analyzes the distribution and usage of link attributes to ensure they align with your SEO strategy.')) + '</p>';

      if (attributeAnalysis && Object.keys(attributeAnalysis).length > 0) {
        // Attribute metrics
        var attrMetrics = [];
        if (attributeAnalysis.nofollowCount !== undefined) {
          attrMetrics.push({ value: attributeAnalysis.nofollowCount, label: 'rel="nofollow"' });
        }
        if (attributeAnalysis.newTabCount !== undefined) {
          attrMetrics.push({ value: attributeAnalysis.newTabCount, label: 'target="_blank"' });
        }
        if (attributeAnalysis.noopenerCount !== undefined) {
          attrMetrics.push({ value: attributeAnalysis.noopenerCount, label: 'rel="noopener"', color: '#10b981' });
        }
        if (attributeAnalysis.sponsoredCount !== undefined) {
          attrMetrics.push({ value: attributeAnalysis.sponsoredCount, label: 'rel="sponsored"' });
        }
        if (attributeAnalysis.ugcCount !== undefined) {
          attrMetrics.push({ value: attributeAnalysis.ugcCount, label: 'rel="ugc"' });
        }

        if (attrMetrics.length > 0) {
          html += PR.renderMetrics(attrMetrics);
        }

        // Attribute breakdown table
        if (attributeAnalysis.breakdown && attributeAnalysis.breakdown.length > 0) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brokenLinks.report.attributes.breakdownHeading', 'Attribute Breakdown')) + '</h3>';

          var attrRows = attributeAnalysis.breakdown.map(function (item) {
            return [
              '<strong>' + esc(item.attribute || '-') + '</strong>',
              String(item.count || 0),
              esc(item.description || '-')
            ];
          });

          html += PR.renderTable(
            [
              { label: t('reports.brokenLinks.report.attributes.table.attribute', 'Attribute'), width: '25%' },
              { label: t('reports.brokenLinks.report.attributes.table.count', 'Count'), width: '15%' },
              { label: t('reports.brokenLinks.report.attributes.table.description', 'Description'), width: '50%' }
            ],
            attrRows,
            { striped: true }
          );
        }

        // Security check for target="_blank" without noopener
        if (attributeAnalysis.unsafeBlankCount !== undefined && attributeAnalysis.unsafeBlankCount > 0) {
          html += PR.renderIssue(
            t('reports.brokenLinks.report.attributes.unsafeBlank', 'Found {{count}} links with target="_blank" missing rel="noopener noreferrer"', { count: attributeAnalysis.unsafeBlankCount }),
            'warning'
          );
        }

        // Issues
        if (attributeAnalysis.issues && attributeAnalysis.issues.length > 0) {
          attributeAnalysis.issues.forEach(function (issue) {
            var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
            html += PR.renderIssue(text, 'warning');
          });
        }
      } else {
        html += '<p class="pdf-text-muted">' + esc(t('reports.brokenLinks.report.attributes.noData', 'No link attribute analysis data available.')) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brokenLinks.report.sections.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brokenLinks.report.sectionIntros.recommendations', 'Based on the broken links analysis, these recommendations prioritize fixing the most impactful link issues to improve user experience and search engine crawling.'s link health. Each recommendation includes the severity level and actionable steps for resolution. Fixing broken links improves user experience, preserves link equity for SEO, and ensures search engine crawlers can efficiently discover all your content.')) + '</p>';

      if (recommendations.length > 0) {
        // Group by priority/severity
        var critical = recommendations.filter(function (r) { return (r.priority || r.severity) === 'critical'; });
        var high = recommendations.filter(function (r) { return (r.priority || r.severity) === 'high'; });
        var medium = recommendations.filter(function (r) { return (r.priority || r.severity) === 'medium'; });
        var low = recommendations.filter(function (r) { var p = r.priority || r.severity; return !p || p === 'low'; });

        var groups = [
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
          t('reports.brokenLinks.report.recommendations.noneTitle', 'Healthy Link Profile'),
          t('reports.brokenLinks.report.recommendations.noneBody', 'Your site has a healthy link profile with no significant issues. Continue monitoring to maintain link health.'),
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
