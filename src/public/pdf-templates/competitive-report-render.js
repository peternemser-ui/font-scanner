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
    var yourDetails = yourSite.details || {};
    var competitors = data.competitors || [];
    var comparison = data.comparison || {};
    var dataRankings = data.rankings || {};
    var insights = data.insights || [];
    var recommendations = data.recommendations || [];

    // Derive gaps, strengthAreas, improvementAreas from the comparison object.
    // The API returns comparison as { seo: { yourScore, avgCompetitor, maxCompetitor, diff, status, ... }, ... }
    // but the renderer sections below expect:
    //   gaps = [{ category, yourScore, bestScore, gap }]
    //   strengthAreas = ['seo', ...]   (categories where status is 'winning')
    //   improvementAreas = ['seo', ...] (categories where status is 'losing')
    var gaps = comparison.gaps || [];
    var strengthAreas = comparison.strengthAreas || [];
    var improvementAreas = comparison.improvementAreas || [];

    // If the API returned per-metric comparison objects instead of pre-built arrays, derive them
    if (gaps.length === 0 && strengthAreas.length === 0 && improvementAreas.length === 0) {
      var compKeys = Object.keys(comparison);
      compKeys.forEach(function (key) {
        var entry = comparison[key];
        if (!entry || typeof entry !== 'object' || !entry.status) return;
        var bestScore = entry.maxCompetitor || 0;
        var yours = entry.yourScore || 0;
        var gapVal = bestScore - yours;
        gaps.push({
          category: key,
          yourScore: yours,
          bestScore: bestScore,
          gap: gapVal > 0 ? gapVal : 0
        });
        if (entry.status === 'winning' || entry.status === 'tied') {
          strengthAreas.push(key);
        } else if (entry.status === 'losing') {
          improvementAreas.push(key);
        }
      });
    }

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
        accessibility: t('reports.competitive.report.categories.accessibility', 'Accessibility'),
        coreWebVitals: t('reports.metrics.coreWebVitals', 'Core Web Vitals'),
        corewebvitals: t('reports.metrics.coreWebVitals', 'Core Web Vitals')
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

    /** Letter grade from score */
    function _scoreGrade(score) {
      if (score >= 90) return 'A+';
      if (score >= 80) return 'A';
      if (score >= 70) return 'B';
      if (score >= 60) return 'C';
      if (score >= 50) return 'D';
      return 'F';
    }

    /** Score color hex */
    function _scoreColor(score) {
      const stops = [
        [0,'#1A0000'],[5,'#311400'],[10,'#482900'],[15,'#5F3D00'],
        [20,'#765200'],[25,'#8C6600'],[30,'#A37A00'],[35,'#BA8F00'],
        [40,'#D1A300'],[45,'#E8B800'],[50,'#FFCC00'],[55,'#E6D106'],
        [60,'#CCD60C'],[65,'#B2DB12'],[70,'#99E018'],[75,'#80E61E'],
        [80,'#66EB23'],[85,'#4CF029'],[90,'#33F52F'],[95,'#1AFA35'],
        [100,'#00FF3B']
      ];
      const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
      const idx = Math.min(Math.floor(s / 5), 19);
      const [s1, c1] = stops[idx];
      const [, c2] = stops[Math.min(idx + 1, 20)];
      const t = (s - s1) / 5;
      const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
      const [r1,g1,b1] = p(c1);
      const [r2,g2,b2] = p(c2);
      const r = Math.round(r1+(r2-r1)*t);
      const g = Math.round(g1+(g2-g1)*t);
      const b = Math.round(b1+(b2-b1)*t);
      return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
    }

    /** Compute competitive stats for a metric */
    function _metricStats(metricKey) {
      var yours = yourScores[metricKey] || 0;
      var compScores = competitors.map(function(c) { return (c.scores || {})[metricKey] || 0; });
      var validScores = compScores.filter(function(s) { return s > 0; });
      var avg = validScores.length > 0 ? Math.round(validScores.reduce(function(a, b) { return a + b; }, 0) / validScores.length) : 0;
      var max = validScores.length > 0 ? Math.max.apply(null, validScores) : 0;
      var isWinning = yours >= max;
      var gap = max - yours;
      var leader = '';
      competitors.forEach(function(c) {
        if ((c.scores || {})[metricKey] === max) {
          leader = c.url || '';
        }
      });
      return { yours: yours, avg: avg, max: max, isWinning: isWinning, gap: gap, leader: leader };
    }

    /** Get action steps for a metric */
    function _getActionSteps(metricKey) {
      var key = (metricKey || '').toLowerCase();
      var stepsMap = {
        performance: [
          t('reports.competitive.action.perf1', 'Run a Lighthouse performance audit to identify specific bottlenecks'),
          t('reports.competitive.action.perf2', 'Optimize images: compress, use WebP format, and implement lazy loading'),
          t('reports.competitive.action.perf3', 'Minimize and bundle JavaScript and CSS files'),
          t('reports.competitive.action.perf4', 'Enable browser caching and use a CDN for static assets'),
          t('reports.competitive.action.perf5', 'Consider server-side optimizations and faster hosting')
        ],
        seo: [
          t('reports.competitive.action.seo1', 'Audit your meta titles and descriptions for all key pages'),
          t('reports.competitive.action.seo2', 'Ensure proper heading hierarchy (H1, H2, H3) on each page'),
          t('reports.competitive.action.seo3', 'Add structured data markup for rich search results'),
          t('reports.competitive.action.seo4', 'Build high-quality backlinks from relevant sites'),
          t('reports.competitive.action.seo5', 'Create fresh, valuable content targeting your keywords')
        ],
        accessibility: [
          t('reports.competitive.action.a11y1', 'Add alt text to all images and meaningful link text'),
          t('reports.competitive.action.a11y2', 'Ensure sufficient color contrast (WCAG AA minimum)'),
          t('reports.competitive.action.a11y3', 'Make all interactive elements keyboard accessible'),
          t('reports.competitive.action.a11y4', 'Add proper ARIA labels and roles where needed'),
          t('reports.competitive.action.a11y5', 'Test with screen readers and accessibility tools')
        ],
        security: [
          t('reports.competitive.action.sec1', 'Implement all recommended security headers (CSP, HSTS, etc.)'),
          t('reports.competitive.action.sec2', 'Ensure all resources load over HTTPS'),
          t('reports.competitive.action.sec3', 'Keep all software and dependencies up to date'),
          t('reports.competitive.action.sec4', 'Implement proper input validation and sanitization'),
          t('reports.competitive.action.sec5', 'Set up regular security scanning and monitoring')
        ],
        corewebvitals: [
          t('reports.competitive.action.cwv1', 'Optimize Largest Contentful Paint (LCP) by preloading key resources'),
          t('reports.competitive.action.cwv2', 'Reduce Cumulative Layout Shift (CLS) by sizing images and embeds'),
          t('reports.competitive.action.cwv3', 'Improve First Input Delay (FID) by breaking up long JavaScript tasks'),
          t('reports.competitive.action.cwv4', 'Use browser caching and efficient cache policies'),
          t('reports.competitive.action.cwv5', 'Monitor Core Web Vitals in Google Search Console')
        ]
      };
      return stepsMap[key] || [
        t('reports.competitive.action.gen1', 'Analyze competitor implementations for best practices'),
        t('reports.competitive.action.gen2', 'Identify specific areas where competitors excel'),
        t('reports.competitive.action.gen3', 'Prioritize quick wins that can close the gap fastest'),
        t('reports.competitive.action.gen4', 'Implement changes incrementally and measure impact'),
        t('reports.competitive.action.gen5', 'Re-run analysis to track improvement')
      ];
    }

    /** Get defensive steps for maintaining lead */
    function _getDefensiveSteps(metricKey) {
      var key = (metricKey || '').toLowerCase();
      var stepsMap = {
        performance: [
          t('reports.competitive.defense.perf1', 'Set up continuous performance monitoring to catch regressions early'),
          t('reports.competitive.defense.perf2', 'Document your performance optimizations so they'),
          t('reports.competitive.defense.perf3', 'Monitor competitor performance to stay ahead of their improvements')
        ],
        seo: [
          t('reports.competitive.defense.seo1', 'Continue producing high-quality, relevant content regularly'),
          t('reports.competitive.defense.seo2', 'Monitor your keyword rankings and react to changes quickly'),
          t('reports.competitive.defense.seo3', 'Keep your technical SEO updated as best practices evolve')
        ],
        accessibility: [
          t('reports.competitive.defense.a11y1', 'Include accessibility testing in your development workflow'),
          t('reports.competitive.defense.a11y2', 'Train your team on accessibility best practices'),
          t('reports.competitive.defense.a11y3', 'Conduct regular audits to catch any regressions')
        ],
        security: [
          t('reports.competitive.defense.sec1', 'Keep all dependencies and software up to date'),
          t('reports.competitive.defense.sec2', 'Conduct regular security audits and penetration testing'),
          t('reports.competitive.defense.sec3', 'Monitor for new vulnerabilities affecting your stack')
        ],
        corewebvitals: [
          t('reports.competitive.defense.cwv1', 'Set up real user monitoring (RUM) to track actual performance'),
          t('reports.competitive.defense.cwv2', 'Monitor Core Web Vitals in Google Search Console regularly'),
          t('reports.competitive.defense.cwv3', 'Test changes in staging to prevent CWV regressions')
        ]
      };
      return stepsMap[key] || [
        t('reports.competitive.defense.gen1', 'Continue monitoring your metrics regularly'),
        t('reports.competitive.defense.gen2', 'Stay informed about industry best practices'),
        t('reports.competitive.defense.gen3', 'React quickly if competitors start catching up')
      ];
    }

    /** Get pro tip for a metric */
    function _getProTip(metricKey) {
      var key = (metricKey || '').toLowerCase();
      var tips = {
        performance: t('reports.competitive.tip.performance', 'Focus on mobile performance first - Google uses mobile-first indexing and most users browse on mobile devices.'),
        seo: t('reports.competitive.tip.seo', 'Quality over quantity - one excellent, in-depth piece of content often outranks many thin pages.'),
        accessibility: t('reports.competitive.tip.accessibility', 'Accessibility improvements often benefit all users, not just those with disabilities. Better UX = better conversions.'),
        security: t('reports.competitive.tip.security', 'Security headers are free to implement but provide significant trust signals and protection.'),
        corewebvitals: t('reports.competitive.tip.coreWebVitals', 'Core Web Vitals are a confirmed Google ranking factor. Improvements here directly impact your search visibility.')
      };
      return tips[key] || t('reports.competitive.tip.generic', 'Start with the highest-impact changes first. Small improvements compound over time to create significant competitive advantages.');
    }

    /** Get gap explanation for a recommendation */
    function _getGapExplanation(rec) {
      var metric = (rec.metric || '').toLowerCase();
      var gap = rec.gap || 0;
      var explanations = {
        performance: t('reports.competitive.gapExp.performance', 'Your site loads {{speed}} slower than top competitors. Users may choose faster alternatives, affecting bounce rates and conversions.'),
        seo: t('reports.competitive.gapExp.seo', 'Competitors have {{degree}} better search visibility. This could mean they'),
        accessibility: t('reports.competitive.gapExp.accessibility', 'Your site is {{degree}} less accessible than competitors. This affects users with disabilities and may have legal implications.'),
        security: t('reports.competitive.gapExp.security', 'Competitors have stronger security measures. Users may trust their sites more, especially for transactions.'),
        corewebvitals: t('reports.competitive.gapExp.coreWebVitals', 'Core Web Vitals affect Google rankings. A {{gap}}-point gap could mean competitors rank higher in search results.')
      };
      return explanations[metric] || t('reports.competitive.gapExp.generic', 'Closing this {{gap}}-point gap would put you on par with or ahead of your top competitors in this area.');
    }

    /* -----------------------------------------------------------------------
       1. Competitive Overview (enriched with executive summary data)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-overview .pdf-section__content');
      var score = yourScores.overall;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.overview', 'Competitive Overview'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.overview', 'This competitive overview compares your site\'s performance against your competitors across key metrics. Understanding where you stand relative to competitors helps prioritize optimization efforts and identify market opportunities.')) + '</p>';

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
            color: _scoreColor(val)
          });
        }
      });

      if (metricsArr.length > 0) {
        html += PR.renderMetrics(metricsArr);
      }

      // Executive summary metrics: rank, grade, wins/losses, avg competitor, gap to leader
      var yourOverall = yourScores.overall || 0;
      var competitorOveralls = [];
      competitors.forEach(function(c) {
        var cs = (c.scores || {}).overall || 0;
        if (cs > 0) competitorOveralls.push(cs);
      });
      var avgCompetitor = competitorOveralls.length > 0 ? Math.round(competitorOveralls.reduce(function(a, b) { return a + b; }, 0) / competitorOveralls.length) : 0;
      var maxCompetitor = competitorOveralls.length > 0 ? Math.max.apply(null, competitorOveralls) : 0;
      var overallRank = (dataRankings.overall && dataRankings.overall.rank) ? dataRankings.overall.rank : '-';
      var totalSites = competitors.length + 1;

      // Count wins/losses across metrics
      var winMetrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
      var winsCount = 0;
      var lossesCount = 0;
      winMetrics.forEach(function(m) {
        var compStatus = comparison[m];
        if (compStatus && compStatus.status === 'winning') winsCount++;
        if (compStatus && compStatus.status === 'losing') lossesCount++;
      });

      // Rank and competitive position metrics
      var gapToLeader = maxCompetitor > yourOverall ? (maxCompetitor - yourOverall) : 0;
      var leadOverField = yourOverall > maxCompetitor ? (yourOverall - maxCompetitor) : 0;

      html += PR.renderMetrics([
        { value: '#' + overallRank + '/' + totalSites, label: t('reports.competitive.report.overview.rank', 'Overall Rank'), color: overallRank === 1 ? '#10b981' : '#f59e0b' },
        { value: yourSite.grade || _scoreGrade(yourOverall), label: t('reports.competitive.report.overview.grade', 'Grade'), color: _scoreColor(yourOverall) },
        { value: winsCount + '/' + winMetrics.length, label: t('reports.competitive.report.overview.categoriesWinning', 'Categories Winning'), color: '#10b981' },
        { value: lossesCount + '/' + winMetrics.length, label: t('reports.competitive.report.overview.categoriesBehind', 'Categories Behind'), color: lossesCount > 0 ? '#ef4444' : '#10b981' }
      ]);

      html += PR.renderMetrics([
        { value: competitors.length, label: t('reports.competitive.report.overview.competitorsAnalyzed', 'Competitors Analyzed') },
        { value: avgCompetitor, label: t('reports.competitive.report.overview.avgCompetitorScore', 'Avg Competitor Score'), color: '#6b7280' },
        { value: gapToLeader > 0 ? '-' + gapToLeader : '+' + leadOverField, label: t('reports.competitive.report.overview.gapToLeader', 'Gap to Leader'), color: gapToLeader > 0 ? '#ef4444' : '#10b981' }
      ]);

      // Priority focus callout
      if (lossesCount > 0) {
        html += PR.renderCallout(
          t('reports.competitive.report.overview.priorityFocus', 'Priority Focus'),
          t('reports.competitive.report.overview.fixWeaknesses', 'You are behind in ' + lossesCount + ' category(ies). Prioritize closing gaps in your weakest areas to improve your overall competitive standing.'),
          'warn'
        );
      } else {
        html += PR.renderCallout(
          t('reports.competitive.report.overview.priorityFocus', 'Priority Focus'),
          t('reports.competitive.report.overview.maintainLead', 'You are leading or competitive in all categories. Focus on maintaining your advantage and monitoring competitor improvements.'),
          'tip'
        );
      }

      // Warning if present
      if (data.warning) {
        html += PR.renderCallout(
          t('reports.common.note', 'Note'),
          esc(data.warning),
          'warn'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Score Rankings (enriched with grades and CWV details)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-rankings .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.rankings', 'Score Rankings'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.rankings', 'Score rankings show how your site compares to competitors across SEO, performance, security, and accessibility categories. Higher rankings indicate competitive advantages, while lower rankings reveal areas where competitors are outperforming you.')) + '</p>';

      // Build comparison table: Site | SEO | Performance | Security | Accessibility | CWV | Overall | Grade
      var categories = ['seo', 'performance', 'security', 'accessibility'];
      var headers = [
        { label: t('reports.competitive.report.rankings.site', 'Site'), width: '22%' }
      ];
      categories.forEach(function (cat) {
        headers.push({ label: _categoryLabel(cat), width: '12%' });
      });
      headers.push({ label: t('reports.metrics.coreWebVitals', 'Core Web Vitals'), width: '10%' });
      headers.push({ label: _categoryLabel('overall'), width: '10%' });
      headers.push({ label: t('reports.competitive.report.rankings.grade', 'Grade'), width: '10%' });

      var rows = [];

      // Your site row (highlighted with bold)
      var yourRow = ['<strong>' + esc(truncate(yourSite.url || '-', 35)) + '</strong>'];
      categories.forEach(function (cat) {
        var val = yourScores[cat];
        if (val !== undefined && val !== null) {
          yourRow.push('<strong><span class="score-' + scoreClass(val) + '">' + val + '</span></strong><br><span style="font-size:0.7rem;color:' + _scoreColor(val) + ';">' + _scoreGrade(val) + '</span>');
        } else {
          yourRow.push('<strong>-</strong>');
        }
      });
      // CWV
      var yourCwv = yourScores.coreWebVitals;
      if (yourCwv !== undefined && yourCwv !== null) {
        var cwvDetail = '';
        if (yourDetails.coreWebVitals && yourDetails.coreWebVitals.metrics) {
          var m = yourDetails.coreWebVitals.metrics;
          cwvDetail = '<br><span style="font-size:0.65rem;color:#6b7280;">LCP: ' + (m.lcp ? (m.lcp / 1000).toFixed(2) + 's' : 'N/A') + '</span>';
        }
        yourRow.push('<strong><span class="score-' + scoreClass(yourCwv) + '">' + yourCwv + '</span></strong>' + cwvDetail);
      } else {
        yourRow.push('<strong>-</strong>');
      }
      // Overall
      var yourOvr = yourScores.overall;
      if (yourOvr !== undefined && yourOvr !== null) {
        yourRow.push('<strong><span class="score-' + scoreClass(yourOvr) + '">' + yourOvr + '</span></strong>');
      } else {
        yourRow.push('<strong>-</strong>');
      }
      // Grade
      yourRow.push('<strong style="color:' + _scoreColor(yourOvr || 0) + ';">' + esc(yourSite.grade || _scoreGrade(yourOvr || 0)) + '</strong>');
      rows.push(yourRow);

      // Competitor rows
      competitors.forEach(function (comp) {
        var compScores = comp.scores || {};
        var compDetails = comp.details || {};
        var compRow = [esc(truncate(comp.url || '-', 35))];
        categories.forEach(function (cat) {
          var val = compScores[cat];
          if (val !== undefined && val !== null) {
            compRow.push('<span class="score-' + scoreClass(val) + '">' + val + '</span><br><span style="font-size:0.7rem;color:' + _scoreColor(val) + ';">' + _scoreGrade(val) + '</span>');
          } else {
            compRow.push('-');
          }
        });
        // CWV
        var compCwv = compScores.coreWebVitals;
        if (compCwv !== undefined && compCwv !== null) {
          var compCwvDetail = '';
          if (compDetails.coreWebVitals && compDetails.coreWebVitals.metrics) {
            var cm = compDetails.coreWebVitals.metrics;
            compCwvDetail = '<br><span style="font-size:0.65rem;color:#6b7280;">LCP: ' + (cm.lcp ? (cm.lcp / 1000).toFixed(2) + 's' : 'N/A') + '</span>';
          }
          compRow.push('<span class="score-' + scoreClass(compCwv) + '">' + compCwv + '</span>' + compCwvDetail);
        } else {
          compRow.push('-');
        }
        // Overall
        var compOvr = compScores.overall;
        if (compOvr !== undefined && compOvr !== null) {
          compRow.push('<span class="score-' + scoreClass(compOvr) + '">' + compOvr + '</span>');
        } else {
          compRow.push('-');
        }
        // Grade
        compRow.push('<span style="color:' + _scoreColor(compOvr || 0) + ';">' + esc(comp.grade || _scoreGrade(compOvr || 0)) + '</span>');
        rows.push(compRow);
      });

      if (rows.length > 0) {
        html += PR.renderTable(headers, rows, { striped: true });
      } else {
        html += '<p class="pdf-text-muted">' + esc(t('reports.competitive.report.rankings.noData', 'No ranking data available.')) + '</p>';
      }

      // Rankings detail table: Metric | Medal | Rank | Status | Recommended Action
      if (dataRankings && Object.keys(dataRankings).length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.competitive.report.rankings.yourRankings', 'Your Rankings by Category')) + '</h3>';

        var rankMetrics = ['overall', 'seo', 'performance', 'coreWebVitals', 'accessibility', 'security'];
        var rankHeaders = [
          { label: t('reports.competitive.report.rankings.metric', 'Metric'), width: '20%' },
          { label: t('reports.competitive.report.rankings.rank', 'Rank'), width: '15%' },
          { label: t('reports.competitive.report.rankings.status', 'Status'), width: '20%' },
          { label: t('reports.competitive.report.rankings.action', 'Recommended Action'), width: '45%' }
        ];

        var rankRows = [];
        rankMetrics.forEach(function(metricKey) {
          var rd = dataRankings[metricKey];
          if (!rd) return;
          var failed = rd.failed || rd.rank === 0 || rd.total === 0;
          var rankDisplay = failed ? '-' : rd.rank + '/' + rd.total;
          var statusStr = 'info';
          var statusLabel = '';
          var recommendation = '';

          if (failed) {
            statusStr = 'fail';
            statusLabel = t('reports.status.failed', 'Failed');
            recommendation = t('reports.competitive.fixAnalysisErrors', 'Fix analysis errors - check site accessibility');
          } else if (rd.rank === 1) {
            statusStr = 'pass';
            statusLabel = t('reports.competitive.leading', 'Leading!');
            recommendation = t('reports.competitive.maintainPosition', 'Maintain position - monitor competitors');
          } else if (rd.rank === 2) {
            statusStr = 'pass';
            statusLabel = t('reports.competitive.strong', 'Strong');
            recommendation = t('reports.competitive.pushToFirst', 'Push to #1 - minor optimizations needed');
          } else if (rd.rank === rd.total) {
            statusStr = 'fail';
            statusLabel = t('reports.competitive.behind', 'Behind');
            recommendation = t('reports.competitive.priorityOverhaul', 'Priority: {{metric}} overhaul required');
          } else {
            statusStr = 'warning';
            statusLabel = t('reports.competitive.competitiveStatus', 'Competitive');
            recommendation = t('reports.competitive.targetImprovements', 'Target {{metric}} improvements for rank gain');
          }

          rankRows.push([
            '<strong>' + esc(_categoryLabel(metricKey)) + '</strong>',
            '<span style="font-weight:600;color:' + (failed ? '#ef4444' : rd.rank === 1 ? '#10b981' : '#f59e0b') + ';">' + esc(rankDisplay) + '</span>',
            PR.renderStatus(statusStr, esc(statusLabel)),
            esc(recommendation)
          ]);
        });

        if (rankRows.length > 0) {
          html += PR.renderTable(rankHeaders, rankRows, { striped: true });
        }
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

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.gaps', 'Performance gaps highlight the specific areas where the difference between your scores and the best competitor scores is largest. Closing these gaps can yield the most significant competitive improvements. This section also identifies your strength areas where you lead the competition.')) + '</p>';

      // Gaps table
      if (gaps.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.competitive.report.gaps.tableHeading', 'Score Gap Analysis')) + '</h3>';

        var gapHeaders = [
          { label: t('reports.competitive.report.gaps.category', 'Category'), width: '20%' },
          { label: t('reports.competitive.report.gaps.yourScore', 'Your Score'), width: '15%' },
          { label: t('reports.competitive.report.gaps.bestScore', 'Best Score'), width: '15%' },
          { label: t('reports.competitive.report.gaps.gap', 'Gap'), width: '15%' },
          { label: t('seo.report.table.status', 'Status'), width: '15%' },
          { label: t('reports.competitive.report.gaps.progress', 'Score Position'), width: '20%' }
        ];

        var gapRows = gaps.map(function (g) {
          var gapVal = g.gap || 0;
          var status = gapVal <= 0 ? 'pass' : (gapVal <= 10 ? 'warning' : 'fail');
          var yourVal = g.yourScore || 0;
          return [
            esc(_categoryLabel(g.category || '')),
            '<span class="score-' + scoreClass(g.yourScore || 0) + '">' + (g.yourScore || 0) + '</span>',
            '<span class="score-' + scoreClass(g.bestScore || 0) + '">' + (g.bestScore || 0) + '</span>',
            '<span style="color:' + (gapVal <= 0 ? '#10b981' : gapVal <= 10 ? '#f59e0b' : '#ef4444') + ';font-weight:600;">' + (gapVal > 0 ? '-' + gapVal : gapVal === 0 ? '0' : '+' + Math.abs(gapVal)) + '</span>',
            PR.renderStatus(status, t('seo.report.status.' + status, status)),
            PR.renderProgress(esc(_categoryLabel(g.category || '')), yourVal, 100, _scoreColor(yourVal))
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
       4. Competitor Profiles (enriched with grades and progress bars)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-competitors .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.competitors', 'Competitor Profiles'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.competitors', 'Competitor profiles provide detailed score breakdowns for each analyzed competitor. Understanding each competitor\'s strengths and weaknesses helps inform your optimization strategy and identify opportunities to differentiate.')) + '</p>';

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
                color: _scoreColor(val)
              });
            }
          });

          if (compMetrics.length > 0) {
            html += PR.renderMetrics(compMetrics);
          }

          // Mini comparison table: Category | Their Score | Your Score | Difference | Status
          var miniHeaders = [
            { label: t('reports.competitive.report.gaps.category', 'Category'), width: '22%' },
            { label: t('reports.competitive.report.competitors.theirScore', 'Their Score'), width: '18%' },
            { label: t('reports.competitive.report.gaps.yourScore', 'Your Score'), width: '18%' },
            { label: t('reports.competitive.report.competitors.difference', 'Difference'), width: '18%' },
            { label: t('seo.report.table.status', 'Status'), width: '12%' },
            { label: t('reports.competitive.report.competitors.grade', 'Grade'), width: '12%' }
          ];

          var miniRows = [];
          cats.forEach(function (cat) {
            var theirs = compScores[cat];
            var yours = yourScores[cat];
            if (theirs === undefined && yours === undefined) return;
            var diff = (yours || 0) - (theirs || 0);
            var statusStr = diff > 0 ? 'pass' : diff < 0 ? 'fail' : 'warning';
            var statusLabel = diff > 0 ? t('reports.competitive.report.competitors.ahead', 'Ahead') : diff < 0 ? t('reports.competitive.report.competitors.behind', 'Behind') : t('reports.competitive.report.competitors.tied', 'Tied');
            miniRows.push([
              esc(_categoryLabel(cat)),
              theirs !== undefined ? '<span class="score-' + scoreClass(theirs) + '">' + theirs + '</span>' : '-',
              yours !== undefined ? '<span class="score-' + scoreClass(yours) + '">' + yours + '</span>' : '-',
              '<span style="color:' + (diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#6b7280') + ';font-weight:600;">' + (diff > 0 ? '+' + diff : diff === 0 ? '0' : String(diff)) + '</span>',
              PR.renderStatus(statusStr, esc(statusLabel)),
              '<span style="color:' + _scoreColor(theirs || 0) + ';font-weight:600;">' + _scoreGrade(theirs || 0) + '</span>'
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
       5. Visual Score Comparison (NEW - matches web UI bar charts)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-visual-comparison .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.visualComparison', 'Visual Score Comparison'))),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.visualComparison', 'Visual bar comparison showing exactly where you stand against each competitor in every category. Sites are ranked within each metric, with your position clearly indicated.')) + '</p>';

      var vizMetrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];

      vizMetrics.forEach(function(metricKey) {
        var stats = _metricStats(metricKey);
        var gapLabel = '';
        if (stats.isWinning) {
          gapLabel = '+' + (stats.yours - stats.max) + ' ' + t('reports.competitive.ahead', 'ahead!');
        } else if (stats.gap > 0) {
          gapLabel = '-' + stats.gap + ' ' + t('reports.competitive.behindLeader', 'behind leader');
        }

        html += '<h3 class="pdf-subsection__title">' + esc(_categoryLabel(metricKey));
        if (gapLabel) {
          html += ' <span style="font-size:0.8rem;font-weight:400;color:' + (stats.isWinning ? '#10b981' : '#ef4444') + ';">(' + esc(gapLabel) + ')</span>';
        }
        html += '</h3>';

        // Build sorted list of all sites for this metric
        var allSites = [{ name: esc(t('reports.competitive.you', 'YOU')), score: stats.yours, isYou: true }];
        competitors.forEach(function(c) {
          allSites.push({
            name: esc(truncate(c.url || '-', 30)),
            score: (c.scores || {})[metricKey] || 0,
            isYou: false
          });
        });
        allSites.sort(function(a, b) { return b.score - a.score; });

        // Render as progress bars
        allSites.forEach(function(site, rank) {
          var barColor = site.isYou ? '#3b82f6' : (rank === 0 ? '#10b981' : '#6b7280');
          var label = (rank === 0 ? '#1 ' : '#' + (rank + 1) + ' ') + site.name;
          html += PR.renderProgress(label, site.score, 100, barColor);
        });

        html += '<div style="margin-bottom:16px;"></div>';
      });

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Competitive Position Summary (NEW - matches web UI stat cards)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-competitive-position .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.competitivePosition', 'Competitive Position Summary'))),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.competitivePosition', 'This section shows your competitive position in each metric category. For each metric, see whether you are winning, losing, or tied, along with the score difference, average competitor score, best competitor score, and your percentile ranking.')) + '</p>';

      // Position metrics from comparison data
      var positionMetrics = Object.keys(comparison);
      if (positionMetrics.length > 0) {
        var posHeaders = [
          { label: t('reports.competitive.report.gaps.category', 'Category'), width: '18%' },
          { label: t('seo.report.table.status', 'Status'), width: '14%' },
          { label: t('reports.competitive.report.position.diff', 'Diff'), width: '12%' },
          { label: t('reports.competitive.report.gaps.yourScore', 'Your Score'), width: '14%' },
          { label: t('reports.competitive.report.position.avgCompetitor', 'Avg Competitor'), width: '14%' },
          { label: t('reports.competitive.report.position.bestCompetitor', 'Best Competitor'), width: '14%' },
          { label: t('reports.competitive.report.position.percentile', 'Percentile'), width: '14%' }
        ];

        var posRows = [];
        positionMetrics.forEach(function(metricKey) {
          var stats = comparison[metricKey];
          if (!stats || typeof stats !== 'object' || !stats.status) return;
          var statusStr = stats.status === 'winning' ? 'pass' : stats.status === 'losing' ? 'fail' : 'warning';
          var statusLabel = stats.status === 'winning' ? t('reports.competitive.winning', 'WINNING') : stats.status === 'tied' ? t('reports.competitive.tied', 'TIED') : t('reports.competitive.losing', 'LOSING');
          var diff = stats.diff || 0;

          posRows.push([
            '<strong>' + esc(_categoryLabel(metricKey)) + '</strong>',
            PR.renderStatus(statusStr, esc(statusLabel)),
            '<span style="color:' + (diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#6b7280') + ';font-weight:600;">' + (diff > 0 ? '+' + diff : String(diff)) + '</span>',
            '<span class="score-' + scoreClass(stats.yourScore || 0) + '">' + (stats.yourScore || 0) + '</span>',
            esc(String(stats.avgCompetitor || 0)),
            esc(String(stats.maxCompetitor || 0)),
            stats.percentile ? esc(stats.percentile + 'th') : '-'
          ]);
        });

        if (posRows.length > 0) {
          html += PR.renderTable(posHeaders, posRows, { striped: true });
        }

        // Per-metric progress bars showing your position
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.competitive.report.position.scoreProgress', 'Score vs Competitors')) + '</h3>';
        positionMetrics.forEach(function(metricKey) {
          var stats = comparison[metricKey];
          if (!stats || typeof stats !== 'object' || !stats.yourScore) return;
          var barColor = stats.status === 'winning' ? '#10b981' : stats.status === 'losing' ? '#ef4444' : '#f59e0b';
          html += PR.renderProgress(_categoryLabel(metricKey) + ' (' + (stats.status || '') + ')', stats.yourScore, 100, barColor);
        });
      } else {
        html += '<p class="pdf-text-muted">' + esc(t('reports.competitive.report.position.noData', 'No competitive position data available.')) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       7. Head-to-Head Battle (NEW - matches web UI detailed analysis)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-head-to-head .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.headToHead', 'Head-to-Head Battle'))),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.headToHead', 'Detailed head-to-head comparison for each metric category. Each metric includes a leaderboard, competitive insight, and actionable steps to either maintain your lead or close the gap.')) + '</p>';

      // Full comparison table (all sites, all metrics + overall + grade)
      var h2hMetrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
      var allSites = [{ name: t('reports.competitive.you', 'YOU'), url: yourSite.url || '-', scores: yourScores, grade: yourSite.grade || _scoreGrade(yourScores.overall || 0), isYou: true }];
      competitors.forEach(function(c) {
        allSites.push({ name: truncate(c.url || '-', 30), url: c.url || '-', scores: c.scores || {}, grade: c.grade || _scoreGrade((c.scores || {}).overall || 0), isYou: false });
      });

      var h2hHeaders = [{ label: t('reports.competitive.report.rankings.site', 'Site'), width: '22%' }];
      h2hMetrics.forEach(function(m) { h2hHeaders.push({ label: _categoryLabel(m), width: '12%' }); });
      h2hHeaders.push({ label: _categoryLabel('overall'), width: '12%' });
      h2hHeaders.push({ label: t('reports.competitive.report.rankings.grade', 'Grade'), width: '10%' });

      var h2hRows = [];
      allSites.forEach(function(site) {
        var row = [site.isYou ? '<strong>' + esc(site.name) + '</strong>' : esc(site.name)];
        h2hMetrics.forEach(function(m) {
          var val = site.scores[m];
          // Find max for this metric
          var maxVal = 0;
          allSites.forEach(function(s) { if ((s.scores[m] || 0) > maxVal) maxVal = s.scores[m] || 0; });
          var isLeader = val === maxVal && val > 0;
          if (val !== undefined && val !== null) {
            row.push((site.isYou ? '<strong>' : '') + '<span class="score-' + scoreClass(val) + '">' + (isLeader ? '* ' : '') + val + '</span>' + (site.isYou ? '</strong>' : ''));
          } else {
            row.push('-');
          }
        });
        var ovr = site.scores.overall || 0;
        row.push((site.isYou ? '<strong>' : '') + '<span class="score-' + scoreClass(ovr) + '">' + ovr + '</span>' + (site.isYou ? '</strong>' : ''));
        row.push('<span style="color:' + _scoreColor(ovr) + ';font-weight:600;">' + esc(site.grade) + '</span>');
        h2hRows.push(row);
      });

      html += PR.renderTable(h2hHeaders, h2hRows, { striped: true });
      html += '<p class="pdf-text-muted pdf-text-small" style="margin-top:4px;">* ' + esc(t('reports.competitive.report.headToHead.leaderIndicator', 'Indicates category leader')) + '</p>';

      // Per-metric detailed analysis
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.competitive.report.headToHead.detailedMetricAnalysis', 'Detailed Metric Analysis')) + '</h3>';

      h2hMetrics.forEach(function(metricKey) {
        var stats = _metricStats(metricKey);
        var statusColor = stats.isWinning ? '#10b981' : '#ef4444';
        var statusLabel = stats.isWinning
          ? t('reports.competitive.report.headToHead.youreLeading', 'You are leading')
          : t('reports.competitive.report.headToHead.pointsBehind', stats.gap + ' points behind ' + truncate(stats.leader, 25));

        // Metric heading with status
        html += '<div style="margin:16px 0 8px 0;padding:10px 14px;background:#f8f9fa;border-left:4px solid ' + statusColor + ';border-radius:4px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<strong>' + esc(_categoryLabel(metricKey)) + '</strong>';
        html += '<span style="background:' + statusColor + ';color:#fff;padding:2px 10px;border-radius:4px;font-size:0.75rem;font-weight:600;">' + esc(stats.isWinning ? t('reports.competitive.winning', 'WINNING') : t('reports.competitive.report.headToHead.opportunity', 'OPPORTUNITY')) + '</span>';
        html += '</div>';
        html += '<div style="font-size:0.85rem;color:#6b7280;margin-top:4px;">' + esc(statusLabel) + '</div>';
        html += '</div>';

        // Score metrics for this category
        html += PR.renderMetrics([
          { value: stats.yours, label: t('reports.competitive.report.gaps.yourScore', 'Your Score'), color: _scoreColor(stats.yours) },
          { value: stats.max, label: t('reports.competitive.report.headToHead.bestCompetitor', 'Best Competitor'), color: '#6b7280' },
          { value: stats.avg, label: t('reports.competitive.report.headToHead.avgCompetitor', 'Avg Competitor'), color: '#6b7280' }
        ]);

        // Leaderboard for this metric
        var leaderboard = [{ name: t('reports.competitive.you', 'YOU'), score: stats.yours, isYou: true }];
        competitors.forEach(function(c) {
          leaderboard.push({ name: truncate(c.url || '-', 30), score: (c.scores || {})[metricKey] || 0, isYou: false });
        });
        leaderboard.sort(function(a, b) { return b.score - a.score; });

        leaderboard.forEach(function(site, rank) {
          var barColor = site.isYou ? '#3b82f6' : (rank === 0 ? '#10b981' : '#94a3b8');
          html += PR.renderProgress('#' + (rank + 1) + ' ' + esc(site.name), site.score, 100, barColor);
        });

        // Competitive insight callout
        if (stats.isWinning) {
          html += PR.renderCallout(
            t('reports.competitive.report.headToHead.competitiveAdvantage', 'Competitive Advantage'),
            t('reports.competitive.report.headToHead.winningInsight', 'You are outperforming all competitors in this category. Focus on maintaining this advantage.'),
            'tip'
          );
        } else {
          html += PR.renderCallout(
            t('reports.competitive.report.headToHead.improvementOpportunity', 'Improvement Opportunity'),
            t('reports.competitive.report.headToHead.losingInsight', 'Closing this gap could significantly improve your competitive position. The leader is setting the benchmark here.'),
            'warn'
          );
        }

        // Action steps
        var steps = stats.isWinning ? _getDefensiveSteps(metricKey) : _getActionSteps(metricKey);
        html += '<div style="margin:8px 0 4px 0;font-weight:600;font-size:0.85rem;">' + esc(stats.isWinning ? t('reports.competitive.report.headToHead.maintainYourLead', 'How to Maintain Your Lead') : t('reports.competitive.report.headToHead.howToCloseGap', 'How to Close the Gap')) + ':</div>';
        html += '<ol style="margin:0 0 8px 0;padding-left:20px;font-size:0.85rem;color:#374151;">';
        steps.forEach(function(step) {
          html += '<li style="margin-bottom:4px;">' + esc(step) + '</li>';
        });
        html += '</ol>';

        // Pro tip
        html += PR.renderCallout(
          t('reports.competitive.proTip', 'Pro Tip'),
          _getProTip(metricKey),
          'tip'
        );
      });

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       8. Strengths & Weaknesses (NEW - matches web UI detailed cards)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-strengths-weaknesses .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.strengthsWeaknesses', 'Competitive Strengths & Weaknesses'))),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.strengthsWeaknesses', 'Based on your competitive analysis, this section identifies where you excel and where you need improvement. Strengths should be maintained, while weaknesses represent the highest-impact improvement opportunities.')) + '</p>';

      // Calculate strengths and weaknesses
      var swMetrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
      var strengths = [];
      var weaknesses = [];

      swMetrics.forEach(function(metricKey) {
        var yours = yourScores[metricKey] || 0;
        var compScores = [];
        competitors.forEach(function(c) {
          compScores.push({ name: truncate(c.url || '-', 30), score: (c.scores || {})[metricKey] || 0 });
        });
        var validScores = compScores.filter(function(s) { return s.score > 0; });
        var maxComp = validScores.length > 0 ? Math.max.apply(null, validScores.map(function(s) { return s.score; })) : 0;
        var avgComp = validScores.length > 0 ? Math.round(validScores.reduce(function(a, s) { return a + s.score; }, 0) / validScores.length) : 0;

        if (yours >= maxComp) {
          strengths.push({
            metric: metricKey,
            score: yours,
            lead: yours - avgComp,
            maxCompetitor: maxComp,
            avgCompetitor: avgComp,
            status: yours > maxComp ? 'dominant' : 'ahead'
          });
        } else if (yours >= avgComp) {
          strengths.push({
            metric: metricKey,
            score: yours,
            lead: yours - avgComp,
            maxCompetitor: maxComp,
            avgCompetitor: avgComp,
            status: 'ahead'
          });
        } else {
          var leaderName = '';
          competitors.forEach(function(c) {
            if (((c.scores || {})[metricKey] || 0) === maxComp) leaderName = truncate(c.url || '-', 30);
          });
          weaknesses.push({
            metric: metricKey,
            score: yours,
            gap: maxComp - yours,
            avgGap: avgComp - yours,
            maxCompetitor: maxComp,
            avgCompetitor: avgComp,
            leader: leaderName
          });
        }
      });

      // Summary stats
      var dominant = strengths.filter(function(s) { return s.status === 'dominant'; }).length;
      var ahead = strengths.filter(function(s) { return s.status === 'ahead'; }).length;

      html += PR.renderMetrics([
        { value: dominant, label: t('reports.competitive.report.sw.categoriesLeading', 'Categories Leading'), color: '#10b981' },
        { value: ahead, label: t('reports.competitive.report.sw.aboveAverage', 'Above Average'), color: '#3b82f6' },
        { value: weaknesses.length, label: t('reports.competitive.report.sw.needImprovement', 'Need Improvement'), color: weaknesses.length > 0 ? '#ef4444' : '#10b981' },
        { value: yourScores.overall || 0, label: t('reports.competitive.report.sw.overallScore', 'Overall Score'), color: _scoreColor(yourScores.overall || 0) }
      ]);

      // Strengths section
      if (strengths.length > 0) {
        html += '<h3 class="pdf-subsection__title" style="color:#10b981;">' + esc(t('reports.competitive.report.sw.yourStrengths', 'Your Competitive Strengths') + ' (' + strengths.length + ')') + '</h3>';

        strengths.forEach(function(s) {
          var isDominant = s.status === 'dominant';
          var sevClass = isDominant ? 'info' : 'info';

          html += '<div class="pdf-issue pdf-issue--' + sevClass + '" style="margin-bottom:12px;">';
          html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">';
          html += '<div style="flex:1;">';
          html += '<strong>' + esc(_categoryLabel(s.metric)) + '</strong>';
          html += '<div style="margin-top:4px;font-size:0.85rem;">' + esc(t('reports.competitive.report.sw.score', 'Score') + ': ' + s.score + ' | +' + s.lead + ' ' + t('reports.competitive.report.sw.aboveAvgLabel', 'above average')) + '</div>';
          html += '</div>';
          html += '<span style="background:' + (isDominant ? '#10b981' : '#3b82f6') + ';color:#fff;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;white-space:nowrap;margin-left:8px;">' + esc(isDominant ? t('reports.competitive.dominant', 'DOMINANT') : t('reports.competitive.aheadStatus', 'AHEAD')) + '</span>';
          html += '</div>';
          html += '</div>';

          // Detail metrics
          html += PR.renderMetrics([
            { value: s.score, label: t('reports.competitive.report.gaps.yourScore', 'Your Score'), color: '#10b981' },
            { value: s.maxCompetitor, label: t('reports.competitive.report.headToHead.bestCompetitor', 'Best Competitor'), color: '#6b7280' },
            { value: '+' + s.lead, label: t('reports.competitive.report.sw.yourLead', 'Your Lead'), color: '#10b981' }
          ]);

          // Defensive steps
          html += '<div style="margin:4px 0;font-weight:600;font-size:0.85rem;">' + esc(t('reports.competitive.report.sw.maintainLead', 'How to Maintain Your Lead')) + ':</div>';
          html += '<ol style="margin:0 0 12px 0;padding-left:20px;font-size:0.85rem;color:#374151;">';
          _getDefensiveSteps(s.metric).forEach(function(step) {
            html += '<li style="margin-bottom:3px;">' + esc(step) + '</li>';
          });
          html += '</ol>';
        });
      }

      // Weaknesses section
      if (weaknesses.length > 0) {
        html += '<h3 class="pdf-subsection__title" style="color:#ef4444;">' + esc(t('reports.competitive.report.sw.areasNeedingImprovement', 'Areas Needing Improvement') + ' (' + weaknesses.length + ')') + '</h3>';

        weaknesses.forEach(function(w) {
          var isUrgent = w.gap > 20;
          var sevClass = isUrgent ? 'critical' : 'warning';

          html += '<div class="pdf-issue pdf-issue--' + sevClass + '" style="margin-bottom:12px;">';
          html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">';
          html += '<div style="flex:1;">';
          html += '<strong>' + esc(_categoryLabel(w.metric)) + '</strong>';
          html += '<div style="margin-top:4px;font-size:0.85rem;">' + esc(t('reports.competitive.report.sw.score', 'Score') + ': ' + w.score + ' | ' + w.gap + ' ' + t('reports.competitive.report.sw.pointsBehind', 'points behind') + ' ' + w.leader) + '</div>';
          html += '</div>';
          html += '<span style="background:' + (isUrgent ? '#ef4444' : '#f59e0b') + ';color:#fff;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;white-space:nowrap;margin-left:8px;">' + esc(isUrgent ? t('reports.competitive.urgent', 'URGENT') : t('reports.competitive.improve', 'IMPROVE')) + '</span>';
          html += '</div>';
          html += '</div>';

          // Detail metrics
          html += PR.renderMetrics([
            { value: w.score, label: t('reports.competitive.report.gaps.yourScore', 'Your Score'), color: '#ef4444' },
            { value: w.maxCompetitor, label: t('reports.competitive.report.sw.leaderScore', 'Leader Score'), color: '#10b981' },
            { value: w.gap, label: t('reports.competitive.report.sw.gapToClose', 'Gap to Close'), color: '#f59e0b' }
          ]);

          // Gap progress bar
          html += PR.renderProgress(
            esc(_categoryLabel(w.metric)),
            w.score,
            100,
            _scoreColor(w.score)
          );

          // Action steps
          html += '<div style="margin:8px 0 4px 0;font-weight:600;font-size:0.85rem;">' + esc(t('reports.competitive.report.sw.actionPlan', 'Action Plan to Close the Gap')) + ':</div>';
          html += '<ol style="margin:0 0 8px 0;padding-left:20px;font-size:0.85rem;color:#374151;">';
          _getActionSteps(w.metric).forEach(function(step) {
            html += '<li style="margin-bottom:3px;">' + esc(step) + '</li>';
          });
          html += '</ol>';

          // Target score callout
          html += PR.renderCallout(
            t('reports.competitive.targetScore', 'Target Score'),
            t('reports.competitive.report.sw.aimFor', 'Aim for') + ' ' + (w.maxCompetitor + 5) + '+ ' + t('reports.competitive.report.sw.toSurpass', 'to surpass the leader and establish yourself as the category leader.'),
            'tip'
          );
        });
      }

      if (strengths.length === 0 && weaknesses.length === 0) {
        html += '<p class="pdf-text-muted">' + esc(t('reports.competitive.report.sw.noData', 'No strengths/weaknesses data available.')) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       9. Strategic Insights (enriched with type-based styling)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-insights .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.insights', 'Strategic Insights'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.insights', 'Strategic insights synthesize the competitive data into actionable intelligence. These insights identify patterns, opportunities, and threats that emerge from the comparative analysis.')) + '</p>';

      if (insights.length > 0) {
        insights.forEach(function (insight) {
          var impact = (insight.impact || 'medium').toLowerCase();
          var impactLabel = translateImpact(impact);
          var insightType = (insight.type || '').toLowerCase();
          var sevClass = (impact === 'high' || impact === 'critical') ? 'critical' : impact === 'medium' ? 'warning' : 'info';

          // Use type to refine severity if available
          if (insightType === 'critical' || insightType === 'warning' || insightType === 'danger') sevClass = 'critical';
          else if (insightType === 'success') sevClass = 'info';

          html += '<div class="pdf-issue pdf-issue--' + sevClass + '" style="margin-bottom:12px;">';
          html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">';
          html += '<div style="flex:1;">';

          // Support both title/description and message/detail field patterns
          var insightTitle = insight.title || insight.message || '';
          var insightBody = insight.description || insight.detail || '';

          html += '<strong>' + esc(insightTitle) + '</strong>';
          if (insightBody) {
            html += '<div style="margin-top:4px;font-size:0.85rem;">' + esc(insightBody) + '</div>';
          }
          if (insight.category) {
            html += '<div class="pdf-text-muted pdf-text-small" style="margin-top:4px;">' + esc(_categoryLabel(insight.category)) + '</div>';
          }
          html += '</div>';
          if (impactLabel) {
            html += '<span style="background:' + _impactColor(impact) + ';color:#fff;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;white-space:nowrap;margin-left:8px;">' + esc(impactLabel) + '</span>';
          }
          html += '</div>';
          html += '</div>';
        });
      } else {
        html += '<p class="pdf-text-muted">' + esc(t('reports.competitive.report.insights.noData', 'No strategic insights available.')) + '</p>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       10. Recommendations (enriched with gap analysis, action steps, impact)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.competitive.report.sections.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.competitive.report.sectionIntros.recommendations', 'Based on the competitive analysis, these recommendations prioritize improvements that will have the greatest impact on your competitive position.')) + '</p>';

      if (recommendations.length > 0) {
        // Sort by priority: high first, then medium, then low
        var sortedRecs = recommendations.slice().sort(function(a, b) {
          var order = { high: 0, critical: 0, medium: 1, low: 2 };
          var pa = (a.priority || a.severity || 'medium').toLowerCase();
          var pb = (b.priority || b.severity || 'medium').toLowerCase();
          return (order[pa] !== undefined ? order[pa] : 1) - (order[pb] !== undefined ? order[pb] : 1);
        });

        sortedRecs.forEach(function (r, idx) {
          var priority = (r.priority || r.severity || 'medium').toLowerCase();
          var priorityColor = priority === 'high' || priority === 'critical' ? '#ef4444' : priority === 'medium' ? '#f59e0b' : '#3b82f6';
          var priorityLabel = priority === 'high' || priority === 'critical' ? t('common.pdf.execSummary.highPriority', 'High Priority') : priority === 'medium' ? t('common.pdf.execSummary.mediumPriority', 'Medium Priority') : t('common.pdf.execSummary.lowPriority', 'Low Priority');
          var sevClass = priority === 'high' || priority === 'critical' ? 'critical' : priority === 'medium' ? 'warning' : 'info';

          var metricName = r.metric ? _categoryLabel(r.metric) : '';
          var recTitle = r.title || '';
          if (!recTitle && r.metric && r.gap) {
            recTitle = t('reports.competitive.report.recs.closeGap', 'Close ' + r.gap + '-point gap in ' + metricName);
          }

          // Recommendation card header
          html += '<div class="pdf-issue pdf-issue--' + sevClass + '" style="margin-bottom:4px;">';
          html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">';
          html += '<div style="flex:1;">';
          html += '<strong>' + esc(recTitle) + '</strong>';

          // Subtitle with competitor comparison
          if (r.topCompetitorName || r.metric) {
            var subtitle = '';
            if (r.topCompetitorName && r.topCompetitorScore !== undefined) {
              subtitle += esc(r.topCompetitorName) + ': ' + r.topCompetitorScore;
            }
            if (r.yourScore !== undefined) {
              subtitle += (subtitle ? ' vs ' + t('reports.competitive.you', 'YOU') + ': ' : t('reports.competitive.report.recs.yourScore', 'Your score') + ': ') + r.yourScore;
            }
            if (subtitle) {
              html += '<div style="margin-top:3px;font-size:0.8rem;color:#6b7280;">' + subtitle + '</div>';
            }
          }

          // Recommendation body / summary
          if (r.recommendation || r.description) {
            html += '<div style="margin-top:6px;font-size:0.85rem;">' + esc(r.recommendation || r.description) + '</div>';
          }
          html += '</div>';
          html += '<span style="background:' + priorityColor + ';color:#fff;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;white-space:nowrap;margin-left:8px;">' + esc(priorityLabel) + '</span>';
          html += '</div>';
          html += '</div>';

          // Gap analysis with score comparison and progress bar
          if (r.yourScore !== undefined && r.topCompetitorScore !== undefined && r.gap) {
            html += '<div style="margin:0 0 8px 0;padding:10px 14px;background:#f8f9fa;border-radius:6px;border:1px solid #e5e7eb;">';
            html += PR.renderMetrics([
              { value: r.yourScore, label: t('reports.competitive.report.gaps.yourScore', 'Your Score'), color: _scoreColor(r.yourScore || 0) },
              { value: r.topCompetitorScore, label: r.topCompetitorName || t('reports.competitive.report.headToHead.bestCompetitor', 'Best Competitor'), color: '#10b981' },
              { value: r.gap, label: t('reports.competitive.report.recs.gapToClose', 'Gap to Close'), color: '#f59e0b' }
            ]);
            // Visual gap bar
            html += PR.renderProgress(
              esc(metricName || recTitle),
              r.yourScore || 0,
              100,
              _scoreColor(r.yourScore || 0)
            );

            // Average competitor context
            if (r.avgCompetitorScore) {
              html += '<div style="font-size:0.8rem;color:#6b7280;margin-top:4px;">' + esc(t('reports.competitive.report.recs.avgCompetitor', 'Average competitor score') + ': ' + r.avgCompetitorScore) + '</div>';
            }
            html += '</div>';

            // What this means explanation
            html += PR.renderCallout(
              t('reports.competitive.whatThisMeans', 'What this means'),
              _getGapExplanation(r),
              'warn'
            );

            // Target score
            html += PR.renderCallout(
              t('reports.competitive.targetScore', 'Target Score'),
              t('reports.competitive.report.recs.aimFor', 'Aim for') + ' ' + ((r.topCompetitorScore || 0) + 5) + '+ ' + t('reports.competitive.report.recs.toSurpass', 'to surpass the leader and establish yourself as the category leader.'),
              'tip'
            );
          }

          // Expected impact
          if (r.impact) {
            html += PR.renderCallout(
              t('reports.competitive.expectedImpact', 'Expected Impact'),
              esc(r.impact),
              'tip'
            );
          }

          // Action steps
          if (r.metric) {
            var steps = _getActionSteps(r.metric);
            html += '<div style="margin:8px 0 4px 0;font-weight:600;font-size:0.85rem;">' + esc(t('reports.competitive.report.recs.actionSteps', 'Action Steps to Close the Gap')) + ':</div>';
            html += '<ol style="margin:0 0 8px 0;padding-left:20px;font-size:0.85rem;color:#374151;">';
            steps.forEach(function(step) {
              html += '<li style="margin-bottom:3px;">' + esc(step) + '</li>';
            });
            html += '</ol>';

            // Pro tip
            html += PR.renderCallout(
              t('reports.competitive.proTip', 'Pro Tip'),
              _getProTip(r.metric),
              'tip'
            );
          }

          html += '<div style="margin-bottom:16px;"></div>';
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
