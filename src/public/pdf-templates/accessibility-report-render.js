/**
 * Accessibility Report — PDF Renderer
 * Renders all accessibility analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[accessibility-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('accessibility', function renderAccessibility(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;
    var translateImpact = utils.translateImpact || function(v) { return v; };
    var translateStatus = utils.translateStatus || function(v) { return v; };

    var sectionIndex = 1;

    // Prefer desktop data, fall back to top-level
    var desktop = data.desktop || {};
    var mobile = data.mobile || {};

    /* -----------------------------------------------------------------------
       1. WCAG 2.1 Compliance
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-wcag .pdf-section__content');
      var wcag = desktop.wcag || data.wcag || {};
      var score = wcag.score || data.accessibilityScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('accessibility.wcagCompliance', 'WCAG 2.1 Compliance'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('accessibility.report.sectionIntros.wcag', 'The Web Content Accessibility Guidelines (WCAG) 2.1 define standards for making web content accessible to people with disabilities. Compliance is measured across four principles: Perceivable, Operable, Understandable, and Robust. This section evaluates your page against key WCAG Level AA success criteria. Meeting these standards ensures your site is usable by the widest possible audience and may be required by law in many jurisdictions.')) + '</p>';

      // WCAG level callout
      html += PR.renderCallout(
        t('accessibility.report.wcag.levelTitle', 'Target Level: WCAG 2.1 AA'),
        t('accessibility.report.wcag.levelBody', 'WCAG Level AA is the standard required by most accessibility regulations worldwide, including ADA, Section 508, and the European Accessibility Act.'),
        'tip'
      );

      // Criteria table
      var criteria = wcag.criteria || {};
      if (Object.keys(criteria).length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('accessibility.report.wcag.criteriaHeading', 'Success Criteria')) + '</h3>';

        var criteriaLabels = {
          nonTextContent: t('accessibility.report.wcag.criteria.nonTextContent', '1.1.1 Non-text Content'),
          infoRelationships: t('accessibility.report.wcag.criteria.infoRelationships', '1.3.1 Info and Relationships'),
          contrastMinimum: t('accessibility.report.wcag.criteria.contrastMinimum', '1.4.3 Contrast (Minimum)'),
          keyboard: t('accessibility.report.wcag.criteria.keyboard', '2.1.1 Keyboard'),
          bypassBlocks: t('accessibility.report.wcag.criteria.bypassBlocks', '2.4.1 Bypass Blocks'),
          pageTitled: t('accessibility.report.wcag.criteria.pageTitled', '2.4.2 Page Titled'),
          focusOrder: t('accessibility.report.wcag.criteria.focusOrder', '2.4.3 Focus Order'),
          languagePage: t('accessibility.report.wcag.criteria.languagePage', '3.1.1 Language of Page'),
          parsing: t('accessibility.report.wcag.criteria.parsing', '4.1.1 Parsing'),
          nameRoleValue: t('accessibility.report.wcag.criteria.nameRoleValue', '4.1.2 Name, Role, Value')
        };

        var criteriaRows = Object.keys(criteria).map(function (key) {
          var status = criteria[key];
          return [
            esc(criteriaLabels[key] || key),
            status === 'pass'
              ? PR.renderStatus('pass', t('common.pdf.status.pass', 'Pass'))
              : PR.renderStatus('fail', t('common.pdf.status.fail', 'Fail'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('accessibility.report.wcag.table.criterion', 'Success Criterion'), width: '65%' },
            { label: t('seo.report.table.status', 'Status'), width: '35%' }
          ],
          criteriaRows,
          { striped: true }
        );
      }

      // Desktop vs Mobile scores
      if (desktop.accessibilityScore || mobile.accessibilityScore) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('accessibility.report.wcag.deviceScoresHeading', 'Device Scores')) + '</h3>';
        html += PR.renderMetrics([
          { value: desktop.accessibilityScore || '-', label: t('common.desktop', 'Desktop'), color: desktop.accessibilityScore >= 80 ? '#10b981' : '#f59e0b' },
          { value: mobile.accessibilityScore || '-', label: t('common.mobile', 'Mobile'), color: (mobile.accessibilityScore || 0) >= 80 ? '#10b981' : '#f59e0b' }
        ]);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Color Contrast
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-contrast .pdf-section__content');
      var d = data.contrast || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('accessibility.colorContrast', 'Color Contrast'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('accessibility.report.sectionIntros.contrast', 'Sufficient color contrast ensures that text and interactive elements are readable by people with low vision or color vision deficiencies. WCAG 2.1 Level AA requires a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text. This section identifies elements that fail to meet these thresholds. Fixing contrast issues is one of the most impactful accessibility improvements you can make.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: d.issuesCount || 0, label: t('accessibility.report.contrast.issuesLabel', 'Contrast Issues'), color: (d.issuesCount || 0) > 0 ? '#ef4444' : '#10b981' }
      ]);

      // Issues table
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('accessibility.report.contrast.detailsHeading', 'Contrast Issues')) + '</h3>';
        var contrastRows = d.issues.slice(0, 15).map(function (issue) {
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(issue.selector || '', 50)) + '</span>',
            esc(issue.ratio ? issue.ratio.toFixed(2) + ':1' : '-'),
            esc(issue.required || '4.5:1'),
            PR.renderStatus('fail', t('common.pdf.status.fail', 'Fail'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('accessibility.report.contrast.table.element', 'Element'), width: '40%' },
            { label: t('accessibility.report.contrast.table.ratio', 'Ratio'), width: '15%' },
            { label: t('accessibility.report.contrast.table.required', 'Required'), width: '15%' },
            { label: t('seo.report.table.status', 'Status'), width: '15%' }
          ],
          contrastRows,
          { striped: true }
        );

        if (d.issues.length > 15) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: d.issues.length - 15 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('accessibility.report.contrast.allPassTitle', 'All Contrast Checks Pass'),
          t('accessibility.report.contrast.allPassBody', 'All text elements meet the minimum contrast ratio requirements.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Keyboard Navigation
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-keyboard .pdf-section__content');
      var d = data.keyboard || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('accessibility.keyboardNav', 'Keyboard Navigation'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('accessibility.report.sectionIntros.keyboard', 'Keyboard accessibility ensures that all interactive elements can be reached and operated using only a keyboard. This is essential for users who cannot use a mouse due to motor disabilities, as well as power users who prefer keyboard navigation. This section checks for focusable elements, tab traps, and visible focus indicators. Every interactive element must be reachable via Tab key and operable via Enter or Space.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: d.focusableCount || 0, label: t('accessibility.report.keyboard.focusableLabel', 'Focusable Elements') },
        { value: d.tabTraps || 0, label: t('accessibility.report.keyboard.tabTrapsLabel', 'Tab Traps'), color: (d.tabTraps || 0) > 0 ? '#ef4444' : '#10b981' },
        { value: d.missingFocusIndicators || 0, label: t('accessibility.report.keyboard.missingFocusLabel', 'Missing Focus Indicators'), color: (d.missingFocusIndicators || 0) > 0 ? '#f59e0b' : '#10b981' }
      ]);

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('accessibility.report.keyboard.issuesHeading', 'Keyboard Issues')) + '</h3>';
        d.issues.forEach(function (issue) {
          html += '<div class="pdf-issue pdf-issue--warning">' +
            '<span class="pdf-issue__text"><strong>' + esc(issue.type || '') + '</strong>' +
            (issue.description ? ' — ' + esc(issue.description) : '') + '</span>' +
          '</div>';
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. ARIA & Semantics
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-aria .pdf-section__content');
      var d = data.aria || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('accessibility.ariaLabels', 'ARIA & Semantics'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('accessibility.report.sectionIntros.aria', 'ARIA (Accessible Rich Internet Applications) attributes and semantic HTML provide the foundation for screen reader accessibility. Proper use of landmarks, labels, roles, and heading structure allows assistive technology to navigate and understand your page. This section checks for ARIA implementation quality, landmark regions, form labels, and heading hierarchy. Incorrect ARIA usage can actually make accessibility worse, so proper implementation is critical.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: d.landmarksCount || 0, label: t('accessibility.report.aria.landmarksLabel', 'Landmarks') },
        { value: d.missingLabels || 0, label: t('accessibility.report.aria.missingLabelsLabel', 'Missing Labels'), color: (d.missingLabels || 0) > 0 ? '#f59e0b' : '#10b981' },
        { value: d.invalidRoles || 0, label: t('accessibility.report.aria.invalidRolesLabel', 'Invalid Roles'), color: (d.invalidRoles || 0) > 0 ? '#ef4444' : '#10b981' }
      ]);

      // Heading structure
      if (d.headingStructure) {
        var hsStatus = d.headingStructure === 'Good' ? 'pass' : 'warning';
        var hsLabel = translateStatus(d.headingStructure) || d.headingStructure;
        html += '<div style="margin:12px 0;">';
        html += PR.renderStatus(hsStatus, t('accessibility.report.aria.headingStructureLabel', 'Heading Structure') + ': ' + hsLabel);
        html += '</div>';
      }

      // Issues table
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('accessibility.report.aria.issuesHeading', 'ARIA Issues')) + '</h3>';
        var ariaRows = d.issues.slice(0, 15).map(function (issue) {
          var impactColor = issue.impact === 'critical' ? '#ef4444' : issue.impact === 'serious' ? '#f97316' : '#f59e0b';
          return [
            esc(issue.type || ''),
            esc(issue.description || ''),
            '<span style="color:' + impactColor + ';font-weight:600;">' + esc(translateImpact(issue.impact || 'moderate')) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('accessibility.report.aria.table.issue', 'Issue'), width: '25%' },
            { label: t('accessibility.report.aria.table.description', 'Description'), width: '50%' },
            { label: t('accessibility.report.aria.table.impact', 'Impact'), width: '15%' }
          ],
          ariaRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('accessibility.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('accessibility.report.sectionIntros.recommendations', 'Based on the accessibility audit, this section provides prioritized recommendations to improve your site\'s inclusivity. Each recommendation references the relevant WCAG success criterion and includes practical steps for implementation. Addressing high-priority items first will yield the greatest improvement in accessibility compliance and user experience for people with disabilities.')) + '</p>';

      var recs = data.recommendations || [];
      if (recs.length > 0) {
        var high = recs.filter(function (r) { return r.priority === 'high'; });
        var medium = recs.filter(function (r) { return r.priority === 'medium'; });
        var low = recs.filter(function (r) { return r.priority === 'low'; });
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
            html += '<div class="pdf-rec" style="border-left-color:' + group.color + ';">' +
              '<div class="pdf-rec__text"><strong>' + esc(r.title || '') + '</strong>' +
              (r.wcagReference ? ' <span class="pdf-text-muted">(' + esc(r.wcagReference) + ')</span>' : '') +
              (r.description ? '<br>' + esc(r.description) : '') +
              (r.solution ? '<br><em>' + esc(r.solution) + '</em>' : '') +
              '</div>' +
            '</div>';
          });
          html += '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('accessibility.report.recommendations.noneTitle', 'Excellent Accessibility'),
          t('accessibility.report.recommendations.noneBody', 'Your site meets accessibility best practices. Continue monitoring for compliance.'),
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
