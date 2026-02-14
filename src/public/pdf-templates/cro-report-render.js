/**
 * CRO Report — PDF Renderer
 * Renders all Conversion Rate Optimization analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[cro-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('cro', function renderCRO(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;
    var translateImpact = utils.translateImpact || function(v) { return v; };

    var sectionIndex = 1;

    function _htmlToNode(htmlStr) {
      var tpl = document.createElement('template');
      tpl.innerHTML = htmlStr.trim();
      return tpl.content.firstChild;
    }

    // Resolve data sources
    var scores = data.scores || {};
    var analysis = data.analysis || {};
    var quickWins = data.quickWins || [];
    var recommendations = data.recommendations || [];

    /* -----------------------------------------------------------------------
       1. CRO Overview
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-overview .pdf-section__content');
      var score = data.overallScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.overviewTitle', 'CRO Overview'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.overview', 'This section provides an overview of your site\'s conversion rate optimization posture. The analysis evaluates calls to action, form usability, trust signals, and mobile user experience to identify opportunities for improving conversion rates. Each sub-score represents a critical dimension of conversion optimization that directly impacts your site\'s ability to convert visitors into customers.')) + '</p>';

      // Score grid for sub-scores
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.overview.scoresHeading', 'CRO Sub-Scores')) + '</h3>';
      html += '<div class="pdf-score-grid">';

      var subScores = [
        { key: 'cta', label: t('reports.cro.report.sections.cta', 'Calls to Action') },
        { key: 'form', label: t('reports.cro.report.sections.forms', 'Form Analysis') },
        { key: 'trust', label: t('reports.cro.report.sections.trust', 'Trust Signals') },
        { key: 'mobile', label: t('reports.cro.report.sections.mobile', 'Mobile UX') }
      ];

      subScores.forEach(function (sub) {
        var val = scores[sub.key];
        if (val === undefined || val === null) return;
        html += '<div class="pdf-score-card">' +
          '<div class="pdf-score-card__label">' + esc(sub.label) + '</div>' +
          '<div class="pdf-score-card__value score-' + scoreClass(val) + '">' + val + '</div>' +
        '</div>';
      });

      html += '</div>';

      // Overview metrics
      html += PR.renderMetrics([
        { value: scores.overall !== undefined ? scores.overall : (data.overallScore || '-'), label: t('reports.cro.report.overview.overallScore', 'Overall Score'), color: (scores.overall || data.overallScore || 0) >= 70 ? '#10b981' : (scores.overall || data.overallScore || 0) >= 40 ? '#f59e0b' : '#ef4444' },
        { value: scores.cta !== undefined ? scores.cta : '-', label: t('reports.cro.report.sections.cta', 'CTA Score') },
        { value: scores.form !== undefined ? scores.form : '-', label: t('reports.cro.report.sections.forms', 'Form Score') },
        { value: scores.trust !== undefined ? scores.trust : '-', label: t('reports.cro.report.sections.trust', 'Trust Score') }
      ]);

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Calls to Action
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cta .pdf-section__content');
      var d = analysis.ctas || {};
      var score = data.scores.cta;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.cta', 'Calls to Action'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.cta', 'Calls to action (CTAs) are the primary conversion drivers on your page. Effective CTAs use clear, action-oriented language, high-contrast styling, and strategic placement to guide visitors toward desired actions. This section evaluates the CTAs found on your page, analyzing their text, visibility, and potential issues that may reduce click-through rates.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: d.count || 0, label: t('reports.cro.report.cta.totalFound', 'CTAs Found') },
        { value: d.score !== undefined ? d.score : '-', label: t('reports.cro.report.cta.score', 'CTA Score'), color: (d.score || 0) >= 70 ? '#10b981' : (d.score || 0) >= 40 ? '#f59e0b' : '#ef4444' }
      ]);

      // CTAs found table
      var found = d.found || [];
      if (found.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.cta.foundHeading', 'CTAs Detected')) + '</h3>';
        var ctaRows = found.slice(0, 20).map(function (cta) {
          var ctaText = typeof cta === 'string' ? cta : (cta.text || cta.label || '-');
          var ctaType = typeof cta === 'object' && cta.type ? cta.type : '-';
          var ctaLocation = typeof cta === 'object' && cta.location ? cta.location : '-';
          return [
            '<strong>' + esc(truncate(ctaText, 60)) + '</strong>',
            esc(ctaType),
            esc(truncate(ctaLocation, 40))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.cro.report.cta.table.text', 'CTA Text'), width: '45%' },
            { label: t('reports.cro.report.cta.table.type', 'Type'), width: '20%' },
            { label: t('reports.cro.report.cta.table.location', 'Location'), width: '35%' }
          ],
          ctaRows,
          { striped: true }
        );

        if (found.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: found.length - 20 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('reports.cro.report.cta.noneTitle', 'No CTAs Detected'),
          t('reports.cro.report.cta.noneBody', 'No clear calls to action were found on this page. Adding prominent CTAs is critical for conversions.'),
          'warning'
        );
      }

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Form Analysis
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-forms .pdf-section__content');
      var d = analysis.forms || {};
      var score = data.scores.form;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.forms', 'Form Analysis'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.forms', 'Forms are critical conversion touchpoints that directly impact lead generation and user engagement. This section analyzes the forms found on your page, including field counts, input types, and usability issues. Reducing form friction by minimizing required fields, providing clear labels, and implementing inline validation can significantly improve completion rates.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: d.count || 0, label: t('reports.cro.report.forms.totalFound', 'Forms Found') },
        { value: d.score !== undefined ? d.score : '-', label: t('reports.cro.report.forms.score', 'Form Score'), color: (d.score || 0) >= 70 ? '#10b981' : (d.score || 0) >= 40 ? '#f59e0b' : '#ef4444' }
      ]);

      // Forms found table
      var found = d.found || [];
      if (found.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.forms.foundHeading', 'Forms Detected')) + '</h3>';
        var formRows = found.slice(0, 15).map(function (form) {
          var formName = typeof form === 'string' ? form : (form.name || form.id || form.action || '-');
          var fieldCount = typeof form === 'object' && form.fields !== undefined ? form.fields : (typeof form === 'object' && form.fieldCount !== undefined ? form.fieldCount : '-');
          var formType = typeof form === 'object' && form.type ? form.type : '-';
          return [
            '<strong>' + esc(truncate(formName, 50)) + '</strong>',
            esc(String(fieldCount)),
            esc(formType)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.cro.report.forms.table.form', 'Form'), width: '45%' },
            { label: t('reports.cro.report.forms.table.fields', 'Fields'), width: '20%' },
            { label: t('reports.cro.report.forms.table.type', 'Type'), width: '35%' }
          ],
          formRows,
          { striped: true }
        );

        if (found.length > 15) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: found.length - 15 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('reports.cro.report.forms.noneTitle', 'No Forms Detected'),
          t('reports.cro.report.forms.noneBody', 'No forms were found on this page. Consider adding lead capture or contact forms to improve conversions.'),
          'info'
        );
      }

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Trust Signals
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-trust .pdf-section__content');
      var d = analysis.trustSignals || {};
      var score = data.scores.trust;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.trust', 'Trust Signals'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.trust', 'Trust signals are elements that build visitor confidence and reduce anxiety during the conversion process. These include testimonials, security badges, certifications, privacy policies, and social proof indicators. This section identifies the trust-building elements present on your page and highlights gaps that may be causing visitors to hesitate before converting.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: d.count || 0, label: t('reports.cro.report.trust.totalFound', 'Trust Signals Found') },
        { value: d.score !== undefined ? d.score : '-', label: t('reports.cro.report.trust.score', 'Trust Score'), color: (d.score || 0) >= 70 ? '#10b981' : (d.score || 0) >= 40 ? '#f59e0b' : '#ef4444' }
      ]);

      // Trust signals found table
      var found = d.found || [];
      if (found.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.trust.foundHeading', 'Trust Signals Detected')) + '</h3>';
        var trustRows = found.slice(0, 20).map(function (signal) {
          var signalName = typeof signal === 'string' ? signal : (signal.name || signal.text || signal.type || '-');
          var signalType = typeof signal === 'object' && signal.type ? signal.type : '-';
          var signalStatus = typeof signal === 'object' && signal.status ? signal.status : 'found';
          return [
            '<strong>' + esc(truncate(signalName, 60)) + '</strong>',
            esc(signalType),
            PR.renderStatus(signalStatus === 'found' || signalStatus === 'pass' ? 'pass' : 'warning', esc(signalStatus))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.cro.report.trust.table.signal', 'Trust Signal'), width: '45%' },
            { label: t('reports.cro.report.trust.table.type', 'Type'), width: '25%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          trustRows,
          { striped: true }
        );

        if (found.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: found.length - 20 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('reports.cro.report.trust.noneTitle', 'No Trust Signals Detected'),
          t('reports.cro.report.trust.noneBody', 'No trust signals were found on this page. Adding testimonials, security badges, and social proof can significantly improve conversions.'),
          'warning'
        );
      }

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Mobile UX
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-mobile-ux .pdf-section__content');
      var d = analysis.mobileUX || {};
      var score = data.scores.mobile;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.mobile', 'Mobile UX'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.mobileUx', 'Mobile user experience is critical for conversions as over 60% of web traffic comes from mobile devices. Poor mobile UX including small tap targets, horizontal scrolling, and slow-loading elements directly reduces conversion rates. This section identifies mobile-specific usability issues that may be causing visitors to abandon the conversion process on smaller screens.')) + '</p>';

      // Score metric
      html += PR.renderMetrics([
        { value: d.score !== undefined ? d.score : (score !== undefined ? score : '-'), label: t('reports.cro.report.mobileUx.score', 'Mobile UX Score'), color: (d.score || score || 0) >= 70 ? '#10b981' : (d.score || score || 0) >= 40 ? '#f59e0b' : '#ef4444' }
      ]);

      // Mobile UX issues
      var issues = d.issues || [];
      if (issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.mobileUx.issuesHeading', 'Mobile UX Issues')) + '</h3>';
        issues.slice(0, 20).forEach(function (issue) {
          var issueText = typeof issue === 'string' ? issue : (issue.message || issue.title || issue.description || '');
          var sev = typeof issue === 'object' && issue.severity ? issue.severity.toLowerCase() : 'warning';
          html += PR.renderIssue(esc(issueText), sev);
        });

        if (issues.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: issues.length - 20 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('reports.cro.report.mobileUx.noIssuesTitle', 'No Mobile UX Issues'),
          t('reports.cro.report.mobileUx.noIssuesBody', 'No significant mobile UX issues were detected. Your page appears to be well-optimized for mobile conversions.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Quick Wins
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-quick-wins .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.quickWins', 'Quick Wins'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.quickWins', 'Quick wins are high-impact, low-effort improvements that can be implemented rapidly to boost conversion rates. These actionable items are prioritized by expected impact and implementation effort, allowing you to focus on changes that deliver the greatest results with minimal development resources. Addressing these items first provides the fastest path to improved conversions.')) + '</p>';

      if (quickWins.length > 0) {
        // Impact/effort badge colors
        function _badgeColor(level) {
          var l = (level || '').toLowerCase();
          if (l === 'high') return '#ef4444';
          if (l === 'medium') return '#f59e0b';
          if (l === 'low') return '#3b82f6';
          return '#6b7280';
        }

        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.quickWins.tableHeading', 'Identified Quick Wins')) + '</h3>';

        var qwRows = quickWins.slice(0, 20).map(function (qw) {
          var impactLevel = qw.impact || '-';
          var effortLevel = qw.effort || '-';
          return [
            '<strong>' + esc(truncate(qw.title || '', 50)) + '</strong>' +
              (qw.description ? '<br><span class="pdf-text-muted pdf-text-small">' + esc(truncate(qw.description, 80)) + '</span>' : ''),
            '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;color:#fff;background:' + _badgeColor(impactLevel) + ';">' + esc(translateImpact(String(impactLevel))) + '</span>',
            '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;color:#fff;background:' + _badgeColor(effortLevel) + ';">' + esc(translateImpact(String(effortLevel))) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.cro.report.quickWins.table.item', 'Quick Win'), width: '55%' },
            { label: t('reports.cro.report.quickWins.table.impact', 'Impact'), width: '20%' },
            { label: t('reports.cro.report.quickWins.table.effort', 'Effort'), width: '25%' }
          ],
          qwRows,
          { striped: true }
        );

        if (quickWins.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: quickWins.length - 20 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('reports.cro.report.quickWins.noneTitle', 'No Quick Wins Identified'),
          t('reports.cro.report.quickWins.noneBody', 'The analysis did not identify specific quick wins. Review the detailed section recommendations for improvement opportunities.'),
          'info'
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
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.recommendations', 'Based on the complete CRO analysis, this section provides prioritized recommendations to improve your site\'s conversion rate. Each recommendation includes the severity level and a description of the suggested change. Addressing critical and high-priority items first will yield the greatest improvements to your conversion funnel.')) + '</p>';

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
          t('reports.cro.report.recommendations.noneTitle', 'Strong CRO Posture'),
          t('reports.cro.report.recommendations.noneBody', 'Your site follows CRO best practices. Continue monitoring conversion metrics and A/B testing for further optimization.'),
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

  function _renderIssuesList(issues, t) {
    if (!issues || issues.length === 0) return '';
    var html = '<div class="pdf-issues" style="margin-top:12px;">';
    html += '<h4 class="pdf-subsection__title">' + (t('common.pdf.execSummary.issuesFound', 'Issues Found') || 'Issues') + '</h4>';
    issues.forEach(function (issue) {
      var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
      html += '<div class="pdf-issue pdf-issue--warning">' +
        '<span class="pdf-issue__text">' + PdfReport.helpers.esc(text) + '</span>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

})(window);
