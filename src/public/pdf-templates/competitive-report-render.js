/**
 * Competitive Analysis Report — PDF Renderer
 * Renders all competitive analysis sections into the PDF template.
 * Registered with PdfReport.register() for the shared engine to invoke.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[competitive-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('competitive', function renderCompetitive(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;
    var translateImpact = utils.translateImpact || function(v) { return v; };

    var sectionIndex = 1;

    // Resolve data sources
    var yourSite = data.yourSite || {};
    var yourScores = yourSite.scores || {};
    var competitors = data.competitors || [];
    var comparison = data.comparison || {};
    var rankings = comparison.rankings || [];
    var gaps = comparison.gaps || [];
    var strengthAreas = comparison.strengthAreas || [];
    var improvementAreas = comparison.improvementAreas || [];
    var insights = data.insights || [];
    var recommendations = data.recommendations || [];

    function _htmlToNode(htmlStr) {
      var tpl = document.createElement('template');
      tpl.innerHTML = htmlStr.trim();
      return tpl.content.firstChild;
    }

    /** Map category key to display label */
    function _categoryLabel(key) {
      var labels = {
        overall: t('reports.competitive.report.categories.overall', 'Overall'),
        seo: t('reports.competitive.report.categories.seo', 'SEO'),
        performance: t('reports.competitive.report.categories.performance', 'Performance'),
        security: t('reports.competitive.report.categories.security', 'Security'),
        accessibility: t('reports.competitive.report.categories.accessibility', 'Accessibility')
      };
      return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
    }

    /** Impact badge color */
    function _impactColor(impact) {
      var imp = (impact || '').toLowerCase();
      if (imp === 'high' || imp === 'critical') return '#ef4444';
      if (imp === 'medium') return '#f59e0b';
      return '#3b82f6';
    }

    /* -----------------------------------------------------------------------
       1. Competitive Overview
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-overview .pdf-section__content');
      var score = yourScores.overall;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.overview', 'Competitive Overview'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.overview', 'This section provides a high-level overview of your site\'s competitive position. Key scores are compared against the analyzed competitors to establish your overall standing. Use these metrics to quickly identify areas where you lead or trail the competition.')) + '</p>';

      // Your site URL callout
      html += PR.renderCallout(
        t('reports.competitive.report.overview.yourSiteLabel', 'Your Site'),
        esc(yourSite.url || '-'),
        'tip'
      );

      // Score categories as metrics
      var scoreCategories = ['overall', 'seo', 'performance', 'security', 'accessibility'];
      var metricsArr = [];
      scoreCategories.forEach(function (cat) {
        var val = yourScores[cat];
        if (val !== undefined && val !== null) {
          metricsArr.push({
            value: val,
            label: _categoryLabel(cat),
            color: val >= 80 ? '#10b981' : val >= 50 ? '#f59e0b' : '#ef4444'
          });
        }
      });

      if (metricsArr.length > 0) {
        html += PR.renderMetrics(metricsArr);
      }

      // Competitor count and position
      var competitorCount = competitors.length;
      html += PR.renderMetrics([
        { value: competitorCount, label: t('reports.competitive.report.overview.competitorsAnalyzed', 'Competitors Analyzed') },
        { value: strengthAreas.length, label: t('reports.competitive.report.overview.strengthAreas', 'Strength Areas'), color: '#10b981' },
        { value: improvementAreas.length, label: t('reports.competitive.report.overview.improvementAreas', 'Improvement Areas'), color: improvementAreas.length > 0 ? '#f59e0b' : '#10b981' }
      ]);

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Score Rankings
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-rankings .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.rankings', 'Score Rankings'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.rankings', 'This table compares your site against each competitor across all major categories. Your site is highlighted in the first row. Scores are color-coded by performance: green for good (80+), amber for moderate (50-79), and red for needs improvement (below 50).')) + '</p>';

      // Build comparison table: Site | Overall | SEO | Performance | Security | Accessibility
      var categories = ['overall', 'seo', 'performance', 'security', 'accessibility'];
      var headers = [
        { label: t('reports.competitive.report.rankings.site', 'Site'), width: '28%' }
      ];
      categories.forEach(function (cat) {
        headers.push({ label: _categoryLabel(cat), width: '14%' });
      });

      var rows = [];

      // Your site row (highlighted with bold)
      var yourRow = ['<strong>' + esc(truncate(yourSite.url || '-', 40)) + '</strong>'];
      categories.forEach(function (cat) {
        var val = yourScores[cat];
        if (val !== undefined && val !== null) {
          yourRow.push('<strong><span class="score-' + scoreClass(val) + '">' + val + '</span></strong>');
        } else {
          yourRow.push('<strong>-</strong>');
        }
      });
      rows.push(yourRow);

      // Competitor rows
      competitors.forEach(function (comp) {
        var compScores = comp.scores || {};
        var compRow = [esc(truncate(comp.url || '-', 40))];
        categories.forEach(function (cat) {
          var val = compScores[cat];
          if (val !== undefined && val !== null) {
            compRow.push('<span class="score-' + scoreClass(val) + '">' + val + '</span>');
          } else {
            compRow.push('-');
          }
        });
        rows.push(compRow);
      });

      if (rows.length > 0) {
        html += PR.renderTable(headers, rows, { striped: true });
      } else {
        html += '<p class="pdf-text-muted">' + esc(t('reports.competitive.report.rankings.noData', 'No ranking data available.')) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Performance Gaps
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-gaps .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.gaps', 'Performance Gaps'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.gaps', 'This section highlights the gaps between your scores and the best competitor scores in each category. Strength areas indicate where you lead the competition, while improvement areas show where you trail. Closing these gaps should be a priority for your optimization strategy.')) + '</p>';

      // Gaps table
      if (gaps.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.competitive.report.gaps.tableHeading', 'Score Gap Analysis')) + '</h3>';

        var gapHeaders = [
          { label: t('reports.competitive.report.gaps.category', 'Category'), width: '25%' },
          { label: t('reports.competitive.report.gaps.yourScore', 'Your Score'), width: '20%' },
          { label: t('reports.competitive.report.gaps.bestScore', 'Best Score'), width: '20%' },
          { label: t('reports.competitive.report.gaps.gap', 'Gap'), width: '20%' },
          { label: t('seo.report.table.status', 'Status'), width: '15%' }
        ];

        var gapRows = gaps.map(function (g) {
          var gapVal = g.gap || 0;
          var status = gapVal <= 0 ? 'pass' : (gapVal <= 10 ? 'warning' : 'fail');
          return [
            esc(_categoryLabel(g.category || '')),
            '<span class="score-' + scoreClass(g.yourScore || 0) + '">' + (g.yourScore || 0) + '</span>',
            '<span class="score-' + scoreClass(g.bestScore || 0) + '">' + (g.bestScore || 0) + '</span>',
            '<span style="color:' + (gapVal <= 0 ? '#10b981' : gapVal <= 10 ? '#f59e0b' : '#ef4444') + ';font-weight:600;">' + (gapVal > 0 ? '-' + gapVal : gapVal === 0 ? '0' : '+' + Math.abs(gapVal)) + '</span>',
            PR.renderStatus(status, t('seo.report.status.' + status, status))
          ];
        });

        html += PR.renderTable(gapHeaders, gapRows, { striped: true });
      }

      // Strength areas badges
      if (strengthAreas.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.competitive.report.gaps.strengthsHeading', 'Strength Areas')) + '</h3>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
        strengthAreas.forEach(function (area) {
          html += PR.renderStatus('pass', esc(_categoryLabel(area)));
        });
        html += '</div>';
      }

      // Improvement areas badges
      if (improvementAreas.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.competitive.report.gaps.improvementsHeading', 'Improvement Areas')) + '</h3>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
        improvementAreas.forEach(function (area) {
          html += PR.renderStatus('warning', esc(_categoryLabel(area)));
        });
        html += '</div>';
      }

      if (gaps.length === 0 && strengthAreas.length === 0 && improvementAreas.length === 0) {
        html += '<p class="pdf-text-muted">' + esc(t('reports.competitive.report.gaps.noData', 'No gap data available.')) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Competitor Profiles
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-competitors .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.competitors', 'Competitor Profiles'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.competitors', 'This section provides a detailed breakdown of each competitor\'s scores across all analyzed categories. Use these profiles to understand the competitive landscape and identify which competitors excel in specific areas. This information helps prioritize where to focus your improvement efforts.')) + '</p>';

      if (competitors.length > 0) {
        competitors.forEach(function (comp, idx) {
          var compScores = comp.scores || {};

          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.competitive.report.competitors.competitorLabel', 'Competitor') + ' ' + (idx + 1) + ': ' + truncate(comp.url || '-', 50)) + '</h3>';

          // Metrics row for this competitor
          var compMetrics = [];
          var cats = ['overall', 'seo', 'performance', 'security', 'accessibility'];
          cats.forEach(function (cat) {
            var val = compScores[cat];
            if (val !== undefined && val !== null) {
              compMetrics.push({
                value: val,
                label: _categoryLabel(cat),
                color: val >= 80 ? '#10b981' : val >= 50 ? '#f59e0b' : '#ef4444'
              });
            }
          });

          if (compMetrics.length > 0) {
            html += PR.renderMetrics(compMetrics);
          }

          // Mini comparison table: Category | Their Score | Your Score | Difference
          var miniHeaders = [
            { label: t('reports.competitive.report.gaps.category', 'Category'), width: '30%' },
            { label: t('reports.competitive.report.competitors.theirScore', 'Their Score'), width: '22%' },
            { label: t('reports.competitive.report.gaps.yourScore', 'Your Score'), width: '22%' },
            { label: t('reports.competitive.report.competitors.difference', 'Difference'), width: '26%' }
          ];

          var miniRows = [];
          cats.forEach(function (cat) {
            var theirs = compScores[cat];
            var yours = yourScores[cat];
            if (theirs === undefined && yours === undefined) return;
            var diff = (yours || 0) - (theirs || 0);
            miniRows.push([
              esc(_categoryLabel(cat)),
              theirs !== undefined ? '<span class="score-' + scoreClass(theirs) + '">' + theirs + '</span>' : '-',
              yours !== undefined ? '<span class="score-' + scoreClass(yours) + '">' + yours + '</span>' : '-',
              '<span style="color:' + (diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#6b7280') + ';font-weight:600;">' + (diff > 0 ? '+' + diff : diff === 0 ? '0' : String(diff)) + '</span>'
            ]);
          });

          if (miniRows.length > 0) {
            html += PR.renderTable(miniHeaders, miniRows, { striped: true });
          }
        });
      } else {
        html += '<p class="pdf-text-muted">' + esc(t('reports.competitive.report.competitors.noData', 'No competitor data available.')) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Strategic Insights
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-insights .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.insights', 'Strategic Insights'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.insights', 'Strategic insights are derived from the competitive analysis to help guide your optimization strategy. Each insight identifies a specific pattern or opportunity with its potential impact. Focus on high-impact insights first to maximize the return on your optimization efforts.')) + '</p>';

      if (insights.length > 0) {
        insights.forEach(function (insight) {
          var impact = (insight.impact || 'medium').toLowerCase();
          var impactLabel = translateImpact(impact);

          html += '<div class="pdf-issue pdf-issue--' + (impact === 'high' || impact === 'critical' ? 'critical' : impact === 'medium' ? 'warning' : 'info') + '" style="margin-bottom:12px;">';
          html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">';
          html += '<div>';
          html += '<strong>' + esc(insight.title || '') + '</strong>';
          if (insight.description) {
            html += '<div style="margin-top:4px;font-size:0.85rem;">' + esc(insight.description) + '</div>';
          }
          if (insight.category) {
            html += '<div class="pdf-text-muted pdf-text-small" style="margin-top:4px;">' + esc(_categoryLabel(insight.category)) + '</div>';
          }
          html += '</div>';
          html += '<span style="background:' + _impactColor(impact) + ';color:#fff;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;white-space:nowrap;margin-left:8px;">' + esc(impactLabel) + '</span>';
          html += '</div>';
          html += '</div>';
        });
      } else {
        html += '<p class="pdf-text-muted">' + esc(t('reports.competitive.report.insights.noData', 'No strategic insights available.')) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.recommendations', 'Based on the competitive analysis, this section provides prioritized recommendations to improve your competitive position. Each recommendation targets a specific area where closing the gap with competitors will yield the greatest benefit. Addressing high-priority items first will deliver the fastest improvement to your overall competitive standing.')) + '</p>';

      if (recommendations.length > 0) {
        // Group by priority/severity
        var critical = recommendations.filter(function (r) { return (r.priority || r.severity || '').toLowerCase() === 'critical' || (r.priority || r.severity || '').toLowerCase() === 'high'; });
        var medium = recommendations.filter(function (r) { return (r.priority || r.severity || '').toLowerCase() === 'medium'; });
        var low = recommendations.filter(function (r) { var p = (r.priority || r.severity || '').toLowerCase(); return !p || p === 'low'; });

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
            html += PR.renderIssue(
              '<strong>' + esc(r.title || '') + '</strong>' +
              (r.description ? '<br>' + esc(r.description) : ''),
              group.color === '#ef4444' ? 'critical' : group.color === '#f59e0b' ? 'warning' : 'info'
            );
          });
          html += '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('reports.competitive.report.recommendations.noneTitle', 'Strong Competitive Position'),
          t('reports.competitive.report.recommendations.noneBody', 'Your site performs well against the analyzed competitors. Continue monitoring to maintain your advantage.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       Hide empty sections
       ----------------------------------------------------------------------- */
    document.querySelectorAll('.pdf-section').forEach(function (sec) {
      var content = sec.querySelector('.pdf-section__content');
      if (content && !content.innerHTML.trim()) {
        sec.style.display = 'none';
      }
    });
  });

})(window);
