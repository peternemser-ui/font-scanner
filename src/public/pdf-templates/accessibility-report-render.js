/**
 * Accessibility Report — PDF Renderer
 * Renders all accessibility analysis sections into the PDF template.
 * Matches the richness of the web UI (accessibility-script.js).
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

    // Synthesize top-level wcag object for exec summary category breakdown.
    // The API returns wcag data nested under desktop/mobile, but the exec summary
    // looks for data.wcag.score to build category grid cards.
    if (!data.wcag && (desktop.wcag || mobile.wcag)) {
      var dWcagScore = (desktop.wcag && desktop.wcag.score) ? desktop.wcag.score : 0;
      var mWcagScore = (mobile.wcag && mobile.wcag.score) ? mobile.wcag.score : 0;
      var avgWcag = (dWcagScore && mWcagScore) ? Math.round((dWcagScore + mWcagScore) / 2) : (dWcagScore || mWcagScore || 0);
      data.wcag = {
        score: avgWcag,
        criteria: (desktop.wcag && desktop.wcag.criteria) ? desktop.wcag.criteria : ((mobile.wcag && mobile.wcag.criteria) ? mobile.wcag.criteria : {})
      };
    }

    // Score helper for color coding
    function _scoreColor(score) {
      if (score >= 80) return '#10b981';
      if (score >= 65) return '#22c55e';
      if (score >= 50) return '#f59e0b';
      return '#ef4444';
    }

    function _scoreGrade(score) {
      if (score >= 90) return t('accessibility.report.gradeExcellent', 'Excellent');
      if (score >= 70) return t('accessibility.report.gradeGood', 'Good');
      if (score >= 50) return t('accessibility.report.gradeFair', 'Fair');
      return t('accessibility.report.gradePoor', 'Poor');
    }

    function _wcagLevel(score) {
      if (score >= 95) return 'AAA';
      if (score >= 80) return 'AA';
      if (score >= 60) return 'A';
      return 'None';
    }

    // Count helpers
    function _countIssues() {
      // Use the API-provided violationsCount which already sums contrast + keyboard + aria.
      // Previously this triple-counted by adding violationsCount + contrastIssues + individual
      // section issue lengths.
      if (typeof data.violationsCount === 'number') return data.violationsCount;
      // Fallback: sum from individual sections
      var sum = 0;
      if (data.contrast && data.contrast.issues) sum += data.contrast.issues.length;
      if (data.keyboard && data.keyboard.issues) sum += data.keyboard.issues.length;
      if (data.aria && data.aria.issues) sum += data.aria.issues.length;
      return sum;
    }

    function _countRecommendations() {
      return (data.recommendations && data.recommendations.length) ? data.recommendations.length : 0;
    }

    function _countPassedChecks() {
      if (typeof data.bestPracticesCount === 'number') return data.bestPracticesCount;
      if (typeof data.passedChecks === 'number') return data.passedChecks;
      return 0;
    }

    /* -----------------------------------------------------------------------
       1. DESKTOP vs MOBILE COMPARISON
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-comparison .pdf-section__content');
      if (!sec) return;

      var hasComparison = desktop.accessibilityScore || mobile.accessibilityScore;
      if (!hasComparison) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var desktopScore = desktop.accessibilityScore || 0;
      var mobileScore = mobile.accessibilityScore || 0;
      var scoreDiff = Math.abs(desktopScore - mobileScore);

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('accessibility.report.comparison.title', 'Desktop vs Mobile Comparison'))),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('accessibility.report.comparison.intro', 'Accessibility was analyzed on both desktop and mobile platforms. This comparison identifies platform-specific accessibility gaps that may affect different user groups.')) + '</p>';

      // Lighthouse failure notices
      var desktopFailed = desktop.lighthouse && (desktop.lighthouse.failed || (desktop.lighthouse.score === 0 && desktop.lighthouse.error));
      var mobileFailed = mobile.lighthouse && (mobile.lighthouse.failed || (mobile.lighthouse.score === 0 && mobile.lighthouse.error));

      if (desktopFailed || mobileFailed) {
        var failMsg = '';
        if (desktopFailed && mobileFailed) {
          failMsg = t('accessibility.report.comparison.bothTimedOut', 'Both desktop and mobile Lighthouse analyses timed out. Using alternative axe-core metrics.');
        } else if (desktopFailed) {
          failMsg = t('accessibility.report.comparison.desktopTimedOut', 'Desktop Lighthouse analysis timed out. Using alternative axe-core metrics for desktop.');
        } else {
          failMsg = t('accessibility.report.comparison.mobileTimedOut', 'Mobile Lighthouse analysis timed out. Using alternative axe-core metrics for mobile.');
        }
        html += PR.renderCallout(
          t('accessibility.report.comparison.partialAnalysis', 'Partial Analysis'),
          failMsg,
          'warn'
        );
      }

      // Platform score metrics
      html += PR.renderMetrics([
        {
          value: desktopFailed ? 'N/A' : desktopScore,
          label: t('common.desktop', 'Desktop'),
          color: desktopFailed ? '#9ca3af' : _scoreColor(desktopScore)
        },
        {
          value: mobileFailed ? 'N/A' : mobileScore,
          label: t('common.mobile', 'Mobile'),
          color: mobileFailed ? '#9ca3af' : _scoreColor(mobileScore)
        },
        {
          value: (desktopFailed || mobileFailed) ? '-' : (scoreDiff + ' pts'),
          label: t('accessibility.report.comparison.difference', 'Difference'),
          color: scoreDiff > 10 ? '#ef4444' : '#10b981'
        }
      ]);

      // Platform detail table with Lighthouse scores
      var platformRows = [];
      var lighthouseFields = [
        { key: 'accessibility', label: t('accessibility.report.comparison.lhAccessibility', 'Accessibility') },
        { key: 'performance', label: t('accessibility.report.comparison.lhPerformance', 'Performance') },
        { key: 'bestPractices', label: t('accessibility.report.comparison.lhBestPractices', 'Best Practices') },
        { key: 'seo', label: t('accessibility.report.comparison.lhSeo', 'SEO') }
      ];

      var hasLighthouse = (desktop.lighthouse && !desktopFailed) || (mobile.lighthouse && !mobileFailed);
      if (hasLighthouse) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('accessibility.report.comparison.lighthouseScores', 'Lighthouse Scores by Platform')) + '</h3>';

        lighthouseFields.forEach(function (field) {
          var dVal = (!desktopFailed && desktop.lighthouse) ? (desktop.lighthouse[field.key] || 0) : '-';
          var mVal = (!mobileFailed && mobile.lighthouse) ? (mobile.lighthouse[field.key] || 0) : '-';
          var dStatus = (typeof dVal === 'number') ? (dVal >= 80 ? 'pass' : dVal >= 50 ? 'warning' : 'fail') : 'na';
          var mStatus = (typeof mVal === 'number') ? (mVal >= 80 ? 'pass' : mVal >= 50 ? 'warning' : 'fail') : 'na';
          platformRows.push([
            esc(field.label),
            PR.renderStatus(dStatus, String(dVal)),
            PR.renderStatus(mStatus, String(mVal))
          ]);
        });

        html += PR.renderTable(
          [
            { label: t('accessibility.report.comparison.metric', 'Metric'), width: '40%' },
            { label: t('common.desktop', 'Desktop'), width: '30%' },
            { label: t('common.mobile', 'Mobile'), width: '30%' }
          ],
          platformRows,
          { striped: true }
        );
      }

      // Gap callout
      if (!desktopFailed && !mobileFailed) {
        if (scoreDiff > 10) {
          var gapMsg = t('accessibility.report.comparison.gapDescription', 'There is a {{diff}}-point difference between desktop ({{desktop}}) and mobile ({{mobile}}) accessibility scores.', {
            diff: scoreDiff, desktop: desktopScore, mobile: mobileScore
          });
          if (desktopScore > mobileScore) {
            gapMsg += ' ' + t('accessibility.report.comparison.mobileBarriers', 'Mobile users may face additional barriers.');
          } else {
            gapMsg += ' ' + t('accessibility.report.comparison.desktopBarriers', 'Desktop users may face additional barriers.');
          }
          html += PR.renderCallout(
            t('accessibility.report.comparison.gapDetected', 'Accessibility Gap Detected'),
            gapMsg,
            'warn'
          );
        } else {
          html += PR.renderCallout(
            t('accessibility.report.comparison.consistent', 'Consistent Accessibility'),
            t('accessibility.report.comparison.consistentDesc', 'Both platforms scored within {{diff}} points of each other.', { diff: scoreDiff }),
            'tip'
          );
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. WCAG COMPLIANCE LEVELS (A / AA / AAA cards + current status)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-wcag-levels .pdf-section__content');
      if (!sec) return;

      var score = data.accessibilityScore || 0;
      var currentLevel = _wcagLevel(score);

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('accessibility.report.wcagLevels.title', 'WCAG Compliance Levels'))),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('accessibility.report.wcagLevels.intro', 'WCAG 2.1 defines three conformance levels. Level AA is the industry standard required by most accessibility regulations. This section shows your current compliance level and what each level requires.')) + '</p>';

      // Level breakdown table
      var levelRows = [
        [
          '<strong>' + esc(t('accessibility.report.wcagLevels.levelA', 'Level A')) + '</strong>',
          esc(t('accessibility.report.wcagLevels.levelASubtitle', 'Minimum Accessibility')),
          esc(t('accessibility.report.wcagLevels.levelAReqs', 'Text alternatives for images, keyboard accessibility, no seizure-inducing content')),
          '60 - 79',
          PR.renderStatus(currentLevel === 'A' ? 'pass' : (score >= 60 ? 'pass' : 'fail'), currentLevel === 'A' ? t('accessibility.report.wcagLevels.current', 'Current') : (score >= 60 ? t('common.pdf.status.pass', 'Pass') : t('common.pdf.status.fail', 'Fail')))
        ],
        [
          '<strong>' + esc(t('accessibility.report.wcagLevels.levelAA', 'Level AA')) + '</strong>',
          esc(t('accessibility.report.wcagLevels.levelAASubtitle', 'Industry Standard')),
          esc(t('accessibility.report.wcagLevels.levelAAReqs', 'Sufficient color contrast (4.5:1), visible focus indicators, content reflows properly, all Level A requirements')),
          '80 - 94',
          PR.renderStatus(currentLevel === 'AA' ? 'pass' : (score >= 80 ? 'pass' : 'fail'), currentLevel === 'AA' ? t('accessibility.report.wcagLevels.current', 'Current') : (score >= 80 ? t('common.pdf.status.pass', 'Pass') : t('common.pdf.status.fail', 'Fail')))
        ],
        [
          '<strong>' + esc(t('accessibility.report.wcagLevels.levelAAA', 'Level AAA')) + '</strong>',
          esc(t('accessibility.report.wcagLevels.levelAAASubtitle', 'Highest Accessibility')),
          esc(t('accessibility.report.wcagLevels.levelAAAReqs', 'Sign language interpretation, extended audio descriptions, very high contrast (7:1), all Level A & AA requirements')),
          '95 - 100',
          PR.renderStatus(currentLevel === 'AAA' ? 'pass' : (score >= 95 ? 'pass' : 'fail'), currentLevel === 'AAA' ? t('accessibility.report.wcagLevels.current', 'Current') : (score >= 95 ? t('common.pdf.status.pass', 'Pass') : t('common.pdf.status.fail', 'Fail')))
        ]
      ];

      html += PR.renderTable(
        [
          { label: t('accessibility.report.wcagLevels.levelCol', 'Level'), width: '12%' },
          { label: t('accessibility.report.wcagLevels.classCol', 'Classification'), width: '15%' },
          { label: t('accessibility.report.wcagLevels.requirementsCol', 'Key Requirements'), width: '38%' },
          { label: t('accessibility.report.wcagLevels.scoreRange', 'Score Range'), width: '12%' },
          { label: t('seo.report.table.status', 'Status'), width: '13%' }
        ],
        levelRows,
        { striped: true }
      );

      // Current level status callout
      var statusType = currentLevel === 'None' ? 'warn' : 'tip';
      var statusTitle, statusBody;
      if (currentLevel === 'None') {
        statusTitle = t('accessibility.report.wcagLevels.notCompliant', 'Not Compliant');
        statusBody = t('accessibility.report.wcagLevels.notCompliantDesc', 'This website does not meet minimum WCAG accessibility standards. Immediate improvements are needed.');
      } else if (currentLevel === 'A') {
        statusTitle = t('accessibility.report.wcagLevels.meetsA', 'Meets WCAG Level A');
        statusBody = t('accessibility.report.wcagLevels.meetsADesc', 'This website meets minimum accessibility standards but has room for improvement to reach the industry-standard Level AA.');
      } else if (currentLevel === 'AA') {
        statusTitle = t('accessibility.report.wcagLevels.meetsAA', 'Meets WCAG Level AA');
        statusBody = t('accessibility.report.wcagLevels.meetsAADesc', 'This website meets industry-standard accessibility requirements. Consider implementing AAA enhancements for optimal accessibility.');
      } else {
        statusTitle = t('accessibility.report.wcagLevels.meetsAAA', 'Meets WCAG Level AAA');
        statusBody = t('accessibility.report.wcagLevels.meetsAAADesc', 'This website achieves the highest level of accessibility compliance. Excellent work!');
      }
      html += PR.renderCallout(statusTitle, statusBody, statusType);

      // Note callout
      html += PR.renderCallout(
        t('accessibility.report.wcagLevels.noteTitle', 'About WCAG Compliance'),
        t('accessibility.report.wcagLevels.noteBody', 'Level AA is the industry standard. It covers 90% of real user needs without excessive implementation cost. Level AAA is not always feasible for all content types.'),
        'info'
      );

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. WCAG 2.1 COMPLIANCE CRITERIA (Desktop vs Mobile)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-wcag .pdf-section__content');
      var desktopWcag = desktop.wcag || data.wcag || {};
      var mobileWcag = mobile.wcag || {};
      var hasBoth = desktop.wcag && mobile.wcag;
      var score = desktopWcag.score || data.accessibilityScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('accessibility.wcagCompliance', 'WCAG Compliance'), score)),
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

      // Criteria table — Desktop vs Mobile columns when both available
      var dCriteria = desktopWcag.criteria || {};
      var mCriteria = mobileWcag.criteria || {};
      var criteriaKeys = Object.keys(dCriteria);
      if (criteriaKeys.length === 0) {
        criteriaKeys = Object.keys(mCriteria);
      }

      if (criteriaKeys.length > 0) {
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

        if (hasBoth) {
          // Rich Desktop vs Mobile table (matching web UI)
          var criteriaRows = criteriaKeys.map(function (key) {
            var dStatus = dCriteria[key] || 'na';
            var mStatus = mCriteria[key] || 'na';
            return [
              esc(criteriaLabels[key] || key),
              PR.renderStatus(dStatus === 'pass' ? 'pass' : (dStatus === 'fail' ? 'fail' : 'na'),
                dStatus === 'pass' ? t('common.pdf.status.pass', 'Pass') : (dStatus === 'fail' ? t('common.pdf.status.fail', 'Fail') : t('common.pdf.status.na', 'N/A'))),
              PR.renderStatus(mStatus === 'pass' ? 'pass' : (mStatus === 'fail' ? 'fail' : 'na'),
                mStatus === 'pass' ? t('common.pdf.status.pass', 'Pass') : (mStatus === 'fail' ? t('common.pdf.status.fail', 'Fail') : t('common.pdf.status.na', 'N/A')))
            ];
          });

          html += PR.renderTable(
            [
              { label: t('accessibility.report.wcag.table.criterion', 'Success Criterion'), width: '50%' },
              { label: t('common.desktop', 'Desktop'), width: '25%' },
              { label: t('common.mobile', 'Mobile'), width: '25%' }
            ],
            criteriaRows,
            { striped: true }
          );
        } else {
          // Single-column fallback
          var criteriaRows = criteriaKeys.map(function (key) {
            var status = dCriteria[key] || mCriteria[key] || 'na';
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
       4. COLOR CONTRAST
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

      // Platform-agnostic callout (matches web UI)
      html += PR.renderCallout(
        t('accessibility.report.contrast.platformAgnostic', 'Platform-Agnostic Metrics'),
        t('accessibility.report.contrast.platformAgnosticDesc', 'Color contrast ratios are design-based and apply equally to all platforms.'),
        'info'
      );

      // Metrics
      html += PR.renderMetrics([
        { value: d.issuesCount || 0, label: t('accessibility.report.contrast.issuesLabel', 'Contrast Issues'), color: (d.issuesCount || 0) > 0 ? '#ef4444' : '#10b981' }
      ]);

      // Issues table with color and background columns
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('accessibility.report.contrast.detailsHeading', 'Contrast Issues')) + '</h3>';
        var contrastRows = d.issues.slice(0, 15).map(function (issue) {
          var colorSwatch = '';
          if (issue.color || issue.backgroundColor) {
            colorSwatch = '';
            if (issue.color) {
              colorSwatch += '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:' + esc(issue.color) + ';border:1px solid #ddd;vertical-align:middle;margin-right:4px;"></span>';
            }
            if (issue.backgroundColor) {
              colorSwatch += '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:' + esc(issue.backgroundColor) + ';border:1px solid #ddd;vertical-align:middle;"></span>';
            }
          }
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(issue.selector || '', 40)) + '</span>',
            colorSwatch || '-',
            esc(issue.ratio ? issue.ratio.toFixed(2) + ':1' : '-'),
            esc(typeof issue.required === 'number' ? issue.required + ':1' : (issue.required || '4.5:1')),
            PR.renderStatus('fail', t('common.pdf.status.fail', 'Fail'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('accessibility.report.contrast.table.element', 'Element'), width: '30%' },
            { label: t('accessibility.report.contrast.table.colors', 'Colors'), width: '12%' },
            { label: t('accessibility.report.contrast.table.ratio', 'Ratio'), width: '15%' },
            { label: t('accessibility.report.contrast.table.required', 'Required'), width: '15%' },
            { label: t('seo.report.table.status', 'Status'), width: '13%' }
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
       5. KEYBOARD NAVIGATION
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

      // Platform-agnostic callout
      html += PR.renderCallout(
        t('accessibility.report.keyboard.platformAgnostic', 'Platform-Agnostic Metrics'),
        t('accessibility.report.keyboard.platformAgnosticDesc', 'Keyboard navigation patterns apply universally across devices with keyboard input.'),
        'info'
      );

      // Metrics
      html += PR.renderMetrics([
        { value: d.focusableCount || 0, label: t('accessibility.report.keyboard.focusableLabel', 'Focusable Elements') },
        { value: d.tabTraps || 0, label: t('accessibility.report.keyboard.tabTrapsLabel', 'Tab Traps'), color: (d.tabTraps || 0) > 0 ? '#ef4444' : '#10b981' },
        { value: d.missingFocusIndicators || 0, label: t('accessibility.report.keyboard.missingFocusLabel', 'Missing Focus Indicators'), color: (d.missingFocusIndicators || 0) > 0 ? '#f59e0b' : '#10b981' }
      ]);

      // Issues with element selectors (matching web UI richness)
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('accessibility.report.keyboard.issuesHeading', 'Keyboard Issues')) + '</h3>';
        d.issues.forEach(function (issue) {
          var severity = 'warning';
          if (issue.type && issue.type.toLowerCase().indexOf('trap') >= 0) severity = 'critical';
          html += PR.renderIssue(
            (issue.type || t('accessibility.report.keyboard.issueType', 'Keyboard Issue')) +
            (issue.description ? ' — ' + issue.description : '') +
            (issue.element ? ' [' + truncate(issue.element, 60) + ']' : ''),
            severity
          );
        });
      } else {
        html += PR.renderCallout(
          t('accessibility.report.keyboard.allPassTitle', 'No Keyboard Issues'),
          t('accessibility.report.keyboard.allPassBody', 'All interactive elements are keyboard accessible with visible focus indicators.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. ARIA & SEMANTICS
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

      // Platform-agnostic callout
      html += PR.renderCallout(
        t('accessibility.report.aria.platformAgnostic', 'Platform-Agnostic Metrics'),
        t('accessibility.report.aria.platformAgnosticDesc', 'ARIA attributes and semantic HTML apply universally to assistive technologies.'),
        'info'
      );

      // Metrics (4-up grid matching web UI)
      html += PR.renderMetrics([
        { value: d.landmarksCount || 0, label: t('accessibility.report.aria.landmarksLabel', 'Landmarks') },
        { value: d.missingLabels || 0, label: t('accessibility.report.aria.missingLabelsLabel', 'Missing Labels'), color: (d.missingLabels || 0) > 0 ? '#f59e0b' : '#10b981' },
        { value: d.invalidRoles || 0, label: t('accessibility.report.aria.invalidRolesLabel', 'Invalid Roles'), color: (d.invalidRoles || 0) > 0 ? '#ef4444' : '#10b981' },
        { value: d.headingStructure || t('accessibility.report.aria.headingGood', 'Good'), label: t('accessibility.report.aria.headingStructureLabel', 'Heading Structure') }
      ]);

      // Issues table with impact badges (richer than before)
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('accessibility.report.aria.issuesHeading', 'ARIA Issues')) + '</h3>';
        var ariaRows = d.issues.slice(0, 15).map(function (issue) {
          var impactLower = (issue.impact || 'moderate').toLowerCase();
          var impactStatus = impactLower === 'critical' ? 'fail' : (impactLower === 'serious' ? 'warning' : 'info');
          return [
            '<strong>' + esc(issue.type || '') + '</strong>',
            esc(issue.description || ''),
            PR.renderStatus(impactStatus, translateImpact(issue.impact || 'moderate'))
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

        if (d.issues.length > 15) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: d.issues.length - 15 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       7. RECOMMENDATIONS & FIX CARDS (Rich Enriched Fixes)
       Uses the enriched fix pipeline:
         1. data.enrichedFixes (pre-populated by server/client)
         2. Enriched from data.recommendations + A11Y_FIX_TEMPLATES
         3. Synthesized from raw scan issues (contrast, keyboard, aria)
       Each fix card shows: summary paragraph, before/after code blocks,
       resources table, and step-by-step fix guide.
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('accessibility.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('accessibility.report.sectionIntros.recommendations', 'Based on the accessibility audit, this section provides prioritized recommendations to improve your site\'s inclusivity. Each recommendation references the relevant WCAG success criterion and includes practical steps for implementation. Addressing high-priority items first will yield the greatest improvement in accessibility compliance and user experience for people with disabilities.'s inclusivity. Each recommendation references the relevant WCAG success criterion and includes practical steps for implementation. Addressing high-priority items first will yield the greatest improvement in accessibility compliance and user experience for people with disabilities.')) + '</p>';

      // Cross-platform callout (matches web UI)
      html += PR.renderCallout(
        t('accessibility.report.recs.crossPlatform', 'Cross-Platform Recommendations'),
        t('accessibility.report.recs.crossPlatformDesc', 'These accessibility improvements are analyzed based on both desktop and mobile to ensure inclusive design.'),
        'info'
      );

      // Generate enriched fix data from all available sources
      var enrichedFixes = _generateEnrichedA11yFixes(data, t);

      if (enrichedFixes.length > 0) {
        html += '<p class="pdf-text-muted" style="margin-bottom:16px;">' +
          esc(t('accessibility.report.recs.totalCount', '{{count}} improvements found', { count: enrichedFixes.length })) +
        '</p>';

        enrichedFixes.forEach(function (fix) {
          html += _renderA11yFixCard(fix, data, t, esc, truncate);
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

    /* -----------------------------------------------------------------------
       8. SUMMARY FOOTER
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-summary .pdf-section__content');
      if (!sec) return;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('common.pdf.summary', 'Summary'))),
        sec
      );

      var html = '';

      html += PR.renderMetrics([
        { value: _countIssues(), label: t('accessibility.report.summary.issuesFound', 'Issues Found'), color: _countIssues() > 0 ? '#ef4444' : '#10b981' },
        { value: _countRecommendations(), label: t('accessibility.report.summary.recommendations', 'Recommendations'), color: '#3b82f6' },
        { value: _countPassedChecks(), label: t('accessibility.report.summary.checksPassed', 'Checks Passed'), color: '#10b981' }
      ]);

      // Quick stats table (mirrors web UI summary)
      var statsRows = [
        [
          esc(t('accessibility.report.summary.wcagLevel', 'WCAG Level')),
          '<strong>' + esc(data.wcagLevel || _wcagLevel(data.accessibilityScore || 0)) + '</strong>'
        ],
        [
          esc(t('accessibility.report.summary.overallScore', 'Overall Score')),
          '<strong>' + esc(String(data.accessibilityScore || 0)) + '/100</strong>'
        ],
        [
          esc(t('accessibility.report.summary.violations', 'Violations Found')),
          '<strong>' + esc(String(data.violationsCount || 0)) + '</strong>'
        ],
        [
          esc(t('accessibility.report.summary.contrastIssues', 'Contrast Issues')),
          '<strong>' + esc(String(data.contrastIssues || (data.contrast ? data.contrast.issuesCount : 0) || 0)) + '</strong>'
        ],
        [
          esc(t('accessibility.report.summary.bestPractices', 'Best Practices Passed')),
          '<strong>' + esc(String(data.bestPracticesCount || 0)) + '</strong>'
        ]
      ];

      html += PR.renderTable(
        [
          { label: t('common.pdf.metric', 'Metric'), width: '60%' },
          { label: t('common.pdf.value', 'Value'), width: '40%' }
        ],
        statsRows,
        { striped: true }
      );

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

  /* =========================================================================
     ACCESSIBILITY FIX TEMPLATES
     Rich template data for each fix type, mirroring the web UI's
     accessibility-fixes-renderer.js / accessibility-script.js patterns.
     Provides: category, impact, summary, problematicCode, fixedCode,
     steps[], and resources[] for each known accessibility issue type.
     ========================================================================= */
  var A11Y_FIX_TEMPLATES = {
    'contrast': {
      category: 'Color & Visual',
      wcagRef: 'WCAG 2.1 SC 1.4.3',
      impact: '+15 Accessibility Score',
      summary: 'Color contrast failures mean that text and interactive elements do not have sufficient luminance difference from their background. This makes content difficult or impossible to read for users with low vision, color blindness, or those using screens in bright environments. WCAG 2.1 Level AA requires a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text (18pt or 14pt bold). Fixing contrast issues is one of the most impactful and straightforward accessibility improvements.',
      resources: [
        { title: 'WebAIM Contrast Checker', url: 'https://webaim.org/resources/contrastchecker/' },
        { title: 'Coolors Contrast Checker', url: 'https://coolors.co/contrast-checker' },
        { title: 'WCAG 1.4.3 Understanding', url: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html' }
      ]
    },
    'label': {
      category: 'Forms & Inputs',
      wcagRef: 'WCAG 2.1 SC 1.3.1 / 4.1.2',
      impact: '+10 Accessibility Score',
      summary: 'Form inputs without accessible labels are invisible to screen reader users. When a user tabs to an input, the screen reader announces nothing meaningful, making it impossible to understand what information is expected. This affects all users relying on assistive technology and can also impact voice control users who navigate by label text. Every form control must have a programmatically associated label via the <label> element, aria-label, or aria-labelledby attribute.',
      resources: [
        { title: 'WAVE Accessibility Checker', url: 'https://wave.webaim.org/' },
        { title: 'WCAG 4.1.2 Understanding', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
        { title: 'MDN: Labels and Form Controls', url: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/forms/Basic_form_hints' }
      ]
    },
    'focus': {
      category: 'Keyboard & Navigation',
      wcagRef: 'WCAG 2.1 SC 2.4.7',
      impact: '+10 Accessibility Score',
      summary: 'Missing or invisible focus indicators mean that keyboard users cannot see which element is currently active. Many CSS resets remove the default browser outline, and developers often forget to replace it with a custom focus style. This creates an insurmountable barrier for keyboard-only users, including those with motor disabilities who cannot use a mouse. Every interactive element must display a visible focus indicator with a minimum 3:1 contrast ratio against adjacent colors.',
      resources: [
        { title: 'axe DevTools (Chrome)', url: 'https://chrome.google.com/webstore/detail/axe-devtools-web-accessibility/lhdoppojpmngadmnindnejefpokejbdd' },
        { title: 'WCAG 2.4.7 Understanding', url: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html' }
      ]
    },
    'heading': {
      category: 'Document Structure',
      wcagRef: 'WCAG 2.1 SC 1.3.1',
      impact: '+8 Accessibility Score',
      summary: 'An improper heading hierarchy breaks the document outline that screen reader users rely on to navigate and understand page structure. Screen readers provide keyboard shortcuts to jump between headings, making them the primary navigation mechanism for many users. Pages should have exactly one H1 element, and heading levels should never be skipped (e.g., jumping from H2 to H4). Using heading tags purely for visual styling rather than semantic structure also confuses assistive technology.',
      resources: [
        { title: 'HeadingsMap Extension', url: 'https://chrome.google.com/webstore/detail/headingsmap/flbjommegcjonpdmenkdiocclhjacmbi' },
        { title: 'WAVE Accessibility Checker', url: 'https://wave.webaim.org/' },
        { title: 'WCAG 1.3.1 Understanding', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' }
      ]
    },
    'landmark': {
      category: 'Page Structure',
      wcagRef: 'WCAG 2.1 SC 1.3.1 / 2.4.1',
      impact: '+8 Accessibility Score',
      summary: 'Without ARIA landmarks or semantic HTML5 structural elements, screen readers present the entire page as a flat sequence of content. Users must navigate through every element to find the section they need. Landmarks such as <header>, <nav>, <main>, <aside>, and <footer> create navigable regions that allow screen reader users to jump directly to the content they want. This is the equivalent of visual page layout for non-sighted users.',
      resources: [
        { title: 'Landmark Navigation Extension', url: 'https://chrome.google.com/webstore/detail/landmark-navigation-via-k/ddpokpbjopmeeiiolheejjpkonlkklgp' },
        { title: 'WCAG 2.4.1 Understanding', url: 'https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html' },
        { title: 'WAI Landmarks Example', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/HTML5.html' }
      ]
    },
    'mobile': {
      category: 'Mobile Accessibility',
      wcagRef: 'WCAG 2.1 SC 2.5.5 / 1.4.4',
      impact: '+10 Accessibility Score',
      summary: 'A significant gap between desktop and mobile accessibility scores indicates that mobile users face additional barriers. Common issues include touch targets smaller than the 44x44 pixel minimum, text too small to read without zooming, missing viewport meta tag, and insufficient spacing between interactive elements. Mobile accessibility is critical because a large and growing share of users browse exclusively on mobile devices, and these users include those who rely on assistive technology like VoiceOver and TalkBack.',
      resources: [
        { title: 'Google Mobile-Friendly Test', url: 'https://search.google.com/test/mobile-friendly' },
        { title: 'WCAG 2.5.5 Understanding', url: 'https://www.w3.org/WAI/WCAG21/Understanding/target-size.html' }
      ]
    }
  };

  /* =========================================================================
     RICH FIX CARD RENDERER
     Matches the accordion-with-tabs pattern from the web UI:
     - Severity badge with color
     - Category + WCAG reference
     - Rich summary paragraph
     - Impact callout
     - Code comparison (problematic vs recommended)
     - Resources table
     - Step-by-step fix guide
     ========================================================================= */
  function _renderA11yFixCard(fix, fullData, t, esc, truncate) {
    var severityLower = (fix.severity || fix.priority || 'medium').toLowerCase();
    var severityClass = severityLower;
    if (severityClass !== 'high' && severityClass !== 'medium' && severityClass !== 'low' && severityClass !== 'critical') {
      severityClass = 'medium';
    }

    var severityLabels = {
      critical: t('common.pdf.execSummary.criticalPriority', 'Critical'),
      high: t('common.pdf.execSummary.highPriority', 'High Priority'),
      medium: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'),
      low: t('common.pdf.execSummary.lowPriority', 'Low Priority')
    };

    var html = '<div class="pdf-fix-card">';

    // ---- Header: severity badge | title | category ----
    html += '<div class="pdf-fix-card__header">';
    html += '<span class="pdf-fix-card__severity pdf-fix-card__severity--' + severityClass + '">' + esc(severityLabels[severityLower] || fix.severity || fix.priority || 'Medium') + '</span>';
    html += '<span class="pdf-fix-card__title">' + esc(fix.title || '') + '</span>';
    if (fix.category) {
      html += '<span class="pdf-fix-card__category">' + esc(fix.category) + '</span>';
    } else if (fix.wcagReference) {
      html += '<span class="pdf-fix-card__category">' + esc(fix.wcagReference) + '</span>';
    }
    html += '</div>';

    // ---- Body ----
    html += '<div class="pdf-fix-card__body">';

    // Subtitle (WCAG ref or best-practice label)
    var subtitle = fix.subtitle || fix.wcagReference || '';
    if (subtitle) {
      html += '<div style="font-size:0.72rem;color:#6b7280;margin-bottom:6px;">' + esc(subtitle) + '</div>';
    }

    // Rich summary paragraph — prefer multi-paragraph summary when available
    var summary = fix.summary || '';
    if (summary) {
      html += '<div class="pdf-fix-card__description">' + esc(summary) + '</div>';
    } else if (fix.description) {
      html += '<div class="pdf-fix-card__description">' + esc(fix.description) + '</div>';
    }

    // Impact badge
    if (fix.impact) {
      html += '<div class="pdf-fix-card__impact">';
      html += '<strong>' + esc(t('accessibility.report.fixes.impactLabel', 'Expected Impact')) + ':</strong> ' + esc(fix.impact);
      html += '</div>';
    }

    // Impact text (from recommendation data)
    if (fix.impactText && fix.impactText !== fix.impact) {
      html += '<div style="font-size:0.78rem;color:#ef4444;margin-bottom:10px;">';
      html += '<strong>' + esc(t('accessibility.report.fixes.riskImpact', 'Risk Impact')) + ':</strong> ' + esc(fix.impactText);
      html += '</div>';
    }

    // Solution text
    if (fix.solution) {
      html += '<div style="margin:8px 0;padding:8px 12px;background:#f0fdf4;border-left:3px solid #10b981;border-radius:4px;">';
      html += '<strong>' + esc(t('accessibility.report.fixes.solution', 'Solution')) + ':</strong> ' + esc(fix.solution);
      html += '</div>';
    }

    // Code comparison: problematic vs fixed
    var problemCode = fix.problematicCode || fix.problemCode || _getA11yProblemCode(fix, fullData, t);
    var fixedCode = fix.fixedCode || fix.solutionCode || fix.snippet || _getA11ySolutionCode(fix, fullData, t);

    if (problemCode || fixedCode) {
      html += '<div class="pdf-fix-card__code-grid">';

      if (problemCode) {
        html += '<div class="pdf-fix-card__code-block">';
        html += '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--bad">' +
          esc(t('accessibility.report.fixes.currentIssue', 'Current Issue')) + '</div>';
        html += '<pre class="pdf-fix-card__code-pre">' + esc(problemCode) + '</pre>';
        html += '</div>';
      }

      if (fixedCode) {
        html += '<div class="pdf-fix-card__code-block">';
        html += '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--good">' +
          esc(t('accessibility.report.fixes.recommendedFix', 'Recommended Fix')) + '</div>';
        html += '<pre class="pdf-fix-card__code-pre">' + esc(fixedCode) + '</pre>';
        html += '</div>';
      }

      html += '</div>';
    }

    // Step-by-step guide
    var steps = fix.steps || _getA11yFixSteps(fix, fullData, t);
    if (steps && steps.length > 0) {
      html += '<div class="pdf-fix-card__steps">';
      html += '<div class="pdf-fix-card__steps-title">' +
        esc(t('accessibility.report.fixes.stepsTitle', 'Step-by-Step Fix Guide')) + '</div>';
      steps.forEach(function (step, idx) {
        html += '<div class="pdf-fix-card__step">';
        html += '<span class="pdf-fix-card__step-num">' + (idx + 1) + '</span>';
        html += '<span>' + esc(step) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Resources table
    var resources = fix.resources || _getA11yResources(fix, t);
    if (resources && resources.length > 0) {
      html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.06);">';
      html += '<div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;color:#6b7280;margin-bottom:4px;">' +
        esc(t('accessibility.report.fixes.resources', 'Resources & Tools')) + '</div>';
      resources.forEach(function (r) {
        var label = r.title || r.url || '';
        html += '<div style="font-size:0.75rem;color:#2563eb;margin-bottom:2px;">' + esc(label);
        if (r.url && r.url !== label) {
          html += ' <span style="color:#9ca3af;font-size:0.65rem;">(' + esc(r.url) + ')</span>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>'; // body
    html += '</div>'; // fix-card
    return html;
  }

  /* -------------------------------------------------------------------------
     Code generators — mirror the web UI's getA11yProblemCode / getA11ySolutionCode
     ------------------------------------------------------------------------- */
  function _getA11yProblemCode(rec, data, t) {
    var title = (rec.title || '').toLowerCase();

    if (title.indexOf('contrast') >= 0) {
      var issues = (data.contrast && data.contrast.issues) ? data.contrast.issues : [];
      if (issues.length > 0) {
        var examples = [];
        for (var i = 0; i < Math.min(issues.length, 3); i++) {
          var issue = issues[i];
          var sel = issue.selector || 'element';
          var ratio = issue.ratio ? issue.ratio.toFixed(2) : '?';
          var fg = issue.color || '#unknown';
          var bg = issue.backgroundColor || '#unknown';
          examples.push('/* ' + sel + ' */\n/* Contrast ratio: ' + ratio + ':1 (needs 4.5:1) */\ncolor: ' + fg + ';\nbackground: ' + bg + ';');
        }
        return '/* Found ' + issues.length + ' low contrast elements */\n\n' + examples.join('\n\n');
      }
      return '/* Low contrast detected */\n.text-element {\n  color: #888;      /* Too light */\n  background: #ccc; /* Not enough contrast */\n}';
    }

    if (title.indexOf('label') >= 0 || title.indexOf('form') >= 0) {
      return '<!-- Form inputs without accessible labels -->\n<input type="email" name="email">\n<input type="password" name="password">\n<select name="country">...</select>';
    }

    if (title.indexOf('focus') >= 0) {
      return '/* Interactive elements hide focus */\nbutton, a, input {\n  outline: none; /* Hides keyboard focus */\n}\n\n*:focus {\n  outline: 0; /* Removes all focus indicators */\n}';
    }

    if (title.indexOf('heading') >= 0) {
      var hs = (data.aria && data.aria.headingStructure) ? data.aria.headingStructure : '';
      if (hs === 'Missing H1') {
        return '<!-- Page is missing an h1 element -->\n<body>\n  <div class="header">Company Name</div>\n  <h2>Products</h2> <!-- First heading is h2 -->\n</body>';
      }
      return '<!-- Improper heading structure -->\n<div class="title">Page Title</div> <!-- Should be h1 -->\n<div class="subtitle">Section</div> <!-- Should be h2 -->';
    }

    if (title.indexOf('landmark') >= 0) {
      return '<!-- No semantic structure -->\n<body>\n  <div class="header">...</div>\n  <div class="nav">...</div>\n  <div class="content">...</div>\n  <div class="footer">...</div>\n</body>';
    }

    if (title.indexOf('mobile') >= 0) {
      var dScore = (data.desktop && data.desktop.accessibilityScore) ? data.desktop.accessibilityScore : '?';
      var mScore = (data.mobile && data.mobile.accessibilityScore) ? data.mobile.accessibilityScore : '?';
      return '/* Mobile score is lower than desktop */\n/* Desktop: ' + dScore + ' | Mobile: ' + mScore + ' */\n\n.button {\n  padding: 4px 8px; /* Touch target too small */\n}';
    }

    return '';
  }

  function _getA11ySolutionCode(rec, data, t) {
    var title = (rec.title || '').toLowerCase();

    if (title.indexOf('contrast') >= 0) {
      return '/* WCAG AA compliant contrast (4.5:1 minimum) */\n\n.text-element {\n  color: #1a1a1a;\n  background: #ffffff;\n}\n\n:root {\n  --text-primary: #212121;\n  --bg-primary: #ffffff;\n}';
    }

    if (title.indexOf('label') >= 0 || title.indexOf('form') >= 0) {
      return '<!-- Explicit label association -->\n<label for="email">Email</label>\n<input type="email" id="email" name="email">\n\n<!-- ARIA label alternative -->\n<input type="search" aria-label="Search products">';
    }

    if (title.indexOf('focus') >= 0) {
      return '/* Visible focus indicators */\n\n:focus-visible {\n  outline: 3px solid #0066cc;\n  outline-offset: 2px;\n  box-shadow: 0 0 0 4px rgba(0, 102, 204, 0.25);\n}\n\nbutton:focus-visible {\n  box-shadow: 0 0 0 3px #fff, 0 0 0 5px #0066cc;\n}';
    }

    if (title.indexOf('heading') >= 0) {
      return '<!-- Proper heading hierarchy -->\n<h1>Page Title</h1>\n  <h2>Main Section</h2>\n    <h3>Subsection</h3>\n  <h2>Another Section</h2>\n\n<!-- Rules: One h1, no skipped levels -->';
    }

    if (title.indexOf('landmark') >= 0) {
      return '<!-- Semantic HTML5 structure -->\n<header role="banner">\n  <nav role="navigation" aria-label="Main">...</nav>\n</header>\n<main role="main">\n  <article>...</article>\n</main>\n<footer role="contentinfo">...</footer>';
    }

    if (title.indexOf('mobile') >= 0) {
      return '<meta name="viewport" content="width=device-width, initial-scale=1">\n\n/* Minimum touch target size */\nbutton, a, input {\n  min-height: 44px;\n  min-width: 44px;\n  padding: 12px 16px;\n}\n\nhtml { font-size: 16px; }';
    }

    return '';
  }

  function _getA11yFixSteps(rec, data, t) {
    var title = (rec.title || '').toLowerCase();

    if (title.indexOf('contrast') >= 0) {
      var count = (data.contrast && data.contrast.issuesCount) ? data.contrast.issuesCount : 'multiple';
      return [
        t('accessibility.report.fixes.steps.contrast1', 'Open browser DevTools and navigate to the Elements panel'),
        t('accessibility.report.fixes.steps.contrast2', 'Use the Accessibility pane to check color contrast ratios'),
        t('accessibility.report.fixes.steps.contrast3', 'Found {{count}} elements below 4.5:1 contrast ratio', { count: count }),
        t('accessibility.report.fixes.steps.contrast4', 'Use WebAIM Contrast Checker to find compliant color alternatives'),
        t('accessibility.report.fixes.steps.contrast5', 'Update CSS with new color values that meet WCAG AA'),
        t('accessibility.report.fixes.steps.contrast6', 'Test with browser extensions like axe DevTools or WAVE')
      ];
    }

    if (title.indexOf('label') >= 0 || title.indexOf('form') >= 0) {
      return [
        t('accessibility.report.fixes.steps.label1', 'Identify form inputs missing accessible labels'),
        t('accessibility.report.fixes.steps.label2', 'Add a <label> element with matching for/id attributes'),
        t('accessibility.report.fixes.steps.label3', 'If visual labels are not possible, use aria-label'),
        t('accessibility.report.fixes.steps.label4', 'Ensure labels are programmatically associated'),
        t('accessibility.report.fixes.steps.label5', 'Test with a screen reader to verify input purpose is announced')
      ];
    }

    if (title.indexOf('focus') >= 0) {
      return [
        t('accessibility.report.fixes.steps.focus1', 'Remove CSS that hides outlines (outline: none)'),
        t('accessibility.report.fixes.steps.focus2', 'Add :focus-visible styles for keyboard users'),
        t('accessibility.report.fixes.steps.focus3', 'Ensure focus indicator has minimum 3:1 contrast ratio'),
        t('accessibility.report.fixes.steps.focus4', 'Test by tabbing through the page'),
        t('accessibility.report.fixes.steps.focus5', 'Use :focus-visible to distinguish keyboard from mouse focus')
      ];
    }

    if (title.indexOf('heading') >= 0) {
      return [
        t('accessibility.report.fixes.steps.heading1', 'Ensure page has exactly one <h1> element'),
        t('accessibility.report.fixes.steps.heading2', 'Verify headings follow sequential order (h1, h2, h3)'),
        t('accessibility.report.fixes.steps.heading3', 'Do not skip heading levels'),
        t('accessibility.report.fixes.steps.heading4', 'Use headings for document structure, not for styling'),
        t('accessibility.report.fixes.steps.heading5', 'Test with screen reader heading navigation')
      ];
    }

    if (title.indexOf('landmark') >= 0) {
      return [
        t('accessibility.report.fixes.steps.landmark1', 'Replace generic <div> elements with semantic HTML5 elements'),
        t('accessibility.report.fixes.steps.landmark2', 'Use <header>, <nav>, <main>, <aside>, <footer>'),
        t('accessibility.report.fixes.steps.landmark3', 'Use aria-label to differentiate multiple nav elements'),
        t('accessibility.report.fixes.steps.landmark4', 'Test with screen reader landmark navigation'),
        t('accessibility.report.fixes.steps.landmark5', 'Verify all major page sections have appropriate landmarks')
      ];
    }

    if (title.indexOf('mobile') >= 0) {
      return [
        t('accessibility.report.fixes.steps.mobile1', 'Add proper viewport meta tag'),
        t('accessibility.report.fixes.steps.mobile2', 'Audit interactive elements for 44x44px minimum touch target'),
        t('accessibility.report.fixes.steps.mobile3', 'Ensure adequate spacing between clickable elements'),
        t('accessibility.report.fixes.steps.mobile4', 'Test with mobile screen reader (VoiceOver, TalkBack)'),
        t('accessibility.report.fixes.steps.mobile5', 'Verify text is readable without zooming (16px minimum)')
      ];
    }

    // Fallback generic steps
    return [
      t('accessibility.report.fixes.steps.generic1', 'Review the specific WCAG criterion referenced'),
      t('accessibility.report.fixes.steps.generic2', 'Identify all affected elements on the page'),
      t('accessibility.report.fixes.steps.generic3', 'Implement the recommended code fix'),
      t('accessibility.report.fixes.steps.generic4', 'Test with assistive technology'),
      t('accessibility.report.fixes.steps.generic5', 'Validate with automated tools (axe, WAVE, Lighthouse)')
    ];
  }

  /* -------------------------------------------------------------------------
     Generate enriched accessibility fix data from raw scan results.
     Mirrors the security renderer's _generateFixesData pattern:
       1. If data.enrichedFixes is pre-populated, use it directly
       2. Otherwise, enrich data.recommendations with template data
       3. If no recommendations exist, synthesize fixes from raw issues
     Each fix object has: title, subtitle, severity, category, impact,
     summary, description, solution, impactText, problematicCode,
     fixedCode, steps[], resources[]
     ------------------------------------------------------------------------- */
  function _generateEnrichedA11yFixes(data, t) {
    // Priority 1: pre-populated enriched fixes from the server
    // pdf-export-utility stores as data.enrichedFixes.accessibility (array) or data.enrichedFixes (array)
    if (data.enrichedFixes) {
      if (Array.isArray(data.enrichedFixes) && data.enrichedFixes.length > 0) {
        return data.enrichedFixes;
      }
      if (Array.isArray(data.enrichedFixes.accessibility) && data.enrichedFixes.accessibility.length > 0) {
        return data.enrichedFixes.accessibility;
      }
    }

    var fixes = [];
    var priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    // Priority 2: enrich existing recommendations with template data
    var recs = data.recommendations || [];
    if (recs.length > 0) {
      recs.forEach(function (rec) {
        var template = _matchA11yTemplate(rec.title);
        var severity = rec.priority || 'medium';

        fixes.push({
          severity: severity,
          title: rec.title || '',
          subtitle: (template ? template.wcagRef : '') || rec.wcagReference || '',
          category: template ? template.category : 'Accessibility',
          impact: template ? template.impact : (severity === 'high' ? '+15 Accessibility Score' : severity === 'medium' ? '+10 Accessibility Score' : '+5 Accessibility Score'),
          summary: template ? template.summary : '',
          description: rec.description || '',
          solution: rec.solution || '',
          impactText: rec.impact || '',
          problematicCode: rec.problemCode || rec.problematicCode || '',
          fixedCode: rec.solutionCode || rec.snippet || rec.fixedCode || '',
          steps: rec.steps || [],
          resources: (template ? template.resources : []) || [],
          wcagReference: rec.wcagReference || (template ? template.wcagRef : '') || ''
        });
      });
    }

    // Priority 3: synthesize fixes from raw scan issues when no recommendations exist
    if (fixes.length === 0) {
      // Contrast issues
      var contrast = data.contrast || {};
      if ((contrast.issues && contrast.issues.length > 0) || (contrast.issuesCount && contrast.issuesCount > 0)) {
        var contrastTpl = A11Y_FIX_TEMPLATES['contrast'];
        var contrastCount = contrast.issuesCount || (contrast.issues ? contrast.issues.length : 0);
        fixes.push({
          severity: 'high',
          title: t('reports.accessibility.fixTitles.colorContrast', 'Multiple Color Contrast Issues'),
          subtitle: contrastTpl.wcagRef,
          category: contrastTpl.category,
          impact: contrastTpl.impact,
          summary: contrastTpl.summary,
          description: t('accessibility.report.fixes.generated.contrastDesc', '{{count}} elements on the page fail to meet the WCAG AA minimum contrast ratio of 4.5:1 for normal text.', { count: contrastCount }),
          solution: '',
          impactText: '',
          problematicCode: '',
          fixedCode: '',
          steps: [],
          resources: contrastTpl.resources,
          wcagReference: contrastTpl.wcagRef
        });
      }

      // Keyboard / focus issues
      var keyboard = data.keyboard || {};
      if ((keyboard.missingFocusIndicators && keyboard.missingFocusIndicators > 0) || (keyboard.tabTraps && keyboard.tabTraps > 0) || (keyboard.issues && keyboard.issues.length > 0)) {
        var focusTpl = A11Y_FIX_TEMPLATES['focus'];
        fixes.push({
          severity: (keyboard.tabTraps && keyboard.tabTraps > 0) ? 'high' : 'medium',
          title: t('reports.accessibility.fixTitles.focusIndicators', 'Missing Focus Indicators'),
          subtitle: focusTpl.wcagRef,
          category: focusTpl.category,
          impact: focusTpl.impact,
          summary: focusTpl.summary,
          description: t('accessibility.report.fixes.generated.focusDesc', '{{count}} interactive elements lack visible focus indicators for keyboard users.', { count: keyboard.missingFocusIndicators || (keyboard.issues ? keyboard.issues.length : 0) }),
          solution: '',
          impactText: '',
          problematicCode: '',
          fixedCode: '',
          steps: [],
          resources: focusTpl.resources,
          wcagReference: focusTpl.wcagRef
        });
      }

      // ARIA / labels / landmarks issues
      var aria = data.aria || {};
      if ((aria.missingLabels && aria.missingLabels > 0) || (aria.invalidRoles && aria.invalidRoles > 0)) {
        var labelTpl = A11Y_FIX_TEMPLATES['label'];
        fixes.push({
          severity: (aria.missingLabels && aria.missingLabels > 3) ? 'high' : 'medium',
          title: t('reports.accessibility.fixTitles.formLabels', 'Missing Form Labels'),
          subtitle: labelTpl.wcagRef,
          category: labelTpl.category,
          impact: labelTpl.impact,
          summary: labelTpl.summary,
          description: t('accessibility.report.fixes.generated.labelsDesc', '{{count}} form elements are missing accessible labels.', { count: aria.missingLabels || 0 }),
          solution: '',
          impactText: '',
          problematicCode: '',
          fixedCode: '',
          steps: [],
          resources: labelTpl.resources,
          wcagReference: labelTpl.wcagRef
        });
      }

      if (aria.landmarksCount !== undefined && aria.landmarksCount < 3) {
        var landmarkTpl = A11Y_FIX_TEMPLATES['landmark'];
        fixes.push({
          severity: 'medium',
          title: t('reports.accessibility.fixTitles.ariaLandmarks', 'Missing ARIA Landmarks'),
          subtitle: landmarkTpl.wcagRef,
          category: landmarkTpl.category,
          impact: landmarkTpl.impact,
          summary: landmarkTpl.summary,
          description: t('accessibility.report.fixes.generated.landmarksDesc', 'Only {{count}} landmark regions found. Most pages should have at least header, navigation, main, and footer landmarks.', { count: aria.landmarksCount }),
          solution: '',
          impactText: '',
          problematicCode: '',
          fixedCode: '',
          steps: [],
          resources: landmarkTpl.resources,
          wcagReference: landmarkTpl.wcagRef
        });
      }

      var headingStatus = aria.headingStructure || '';
      if (typeof headingStatus === 'string' && headingStatus !== 'Good' && headingStatus !== '') {
        var headingTpl = A11Y_FIX_TEMPLATES['heading'];
        fixes.push({
          severity: 'medium',
          title: t('reports.accessibility.fixTitles.headingStructure', 'Improper Heading Structure'),
          subtitle: headingTpl.wcagRef,
          category: headingTpl.category,
          impact: headingTpl.impact,
          summary: headingTpl.summary,
          description: t('accessibility.report.fixes.generated.headingDesc', 'Heading structure issue detected: {{status}}. Screen reader users rely on heading hierarchy for page navigation.', { status: headingStatus }),
          solution: '',
          impactText: '',
          problematicCode: '',
          fixedCode: '',
          steps: [],
          resources: headingTpl.resources,
          wcagReference: headingTpl.wcagRef
        });
      }

      // Mobile accessibility gap
      var desktopScore = (data.desktop && data.desktop.accessibilityScore) ? data.desktop.accessibilityScore : 0;
      var mobileScore = (data.mobile && data.mobile.accessibilityScore) ? data.mobile.accessibilityScore : 0;
      if (desktopScore && mobileScore && (desktopScore - mobileScore) > 10) {
        var mobileTpl = A11Y_FIX_TEMPLATES['mobile'];
        fixes.push({
          severity: 'medium',
          title: t('reports.accessibility.fixTitles.mobileGap', 'Mobile Accessibility Gap'),
          subtitle: mobileTpl.wcagRef,
          category: mobileTpl.category,
          impact: mobileTpl.impact,
          summary: mobileTpl.summary,
          description: t('accessibility.report.fixes.generated.mobileDesc', 'Mobile accessibility score ({{mobile}}) is {{diff}} points lower than desktop ({{desktop}}).', { mobile: mobileScore, desktop: desktopScore, diff: desktopScore - mobileScore }),
          solution: '',
          impactText: '',
          problematicCode: '',
          fixedCode: '',
          steps: [],
          resources: mobileTpl.resources,
          wcagReference: mobileTpl.wcagRef
        });
      }
    }

    // Sort by severity
    fixes.sort(function (a, b) {
      return (priorityOrder[a.severity] || 3) - (priorityOrder[b.severity] || 3);
    });

    return fixes;
  }

  /** Match a recommendation title to an A11Y_FIX_TEMPLATES entry */
  function _matchA11yTemplate(title) {
    if (!title) return null;
    var titleLower = title.toLowerCase();
    var keys = Object.keys(A11Y_FIX_TEMPLATES);
    for (var i = 0; i < keys.length; i++) {
      if (titleLower.indexOf(keys[i]) !== -1) {
        return A11Y_FIX_TEMPLATES[keys[i]];
      }
    }
    return null;
  }

  /* -------------------------------------------------------------------------
     Resources generator — provides relevant tools and documentation links
     for each accessibility fix type, mirroring getA11yExternalTools()
     from the web UI.
     ------------------------------------------------------------------------- */
  function _getA11yResources(fix, t) {
    var title = (fix.title || '').toLowerCase();
    var resources = [];

    if (title.indexOf('contrast') >= 0 || title.indexOf('color') >= 0) {
      resources.push({ title: 'WebAIM Contrast Checker', url: 'https://webaim.org/resources/contrastchecker/' });
      resources.push({ title: 'Coolors Contrast Checker', url: 'https://coolors.co/contrast-checker' });
      resources.push({ title: 'WCAG 1.4.3 Understanding', url: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html' });
    }

    if (title.indexOf('label') >= 0 || title.indexOf('form') >= 0) {
      resources.push({ title: 'WAVE Accessibility Checker', url: 'https://wave.webaim.org/' });
      resources.push({ title: 'WCAG 4.1.2 Understanding', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' });
    }

    if (title.indexOf('focus') >= 0 || title.indexOf('keyboard') >= 0) {
      resources.push({ title: 'axe DevTools (Chrome)', url: 'https://chrome.google.com/webstore/detail/axe-devtools-web-accessibility/lhdoppojpmngadmnindnejefpokejbdd' });
      resources.push({ title: 'WCAG 2.4.7 Understanding', url: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html' });
    }

    if (title.indexOf('heading') >= 0) {
      resources.push({ title: 'HeadingsMap Extension', url: 'https://chrome.google.com/webstore/detail/headingsmap/flbjommegcjonpdmenkdiocclhjacmbi' });
      resources.push({ title: 'WAVE Accessibility Checker', url: 'https://wave.webaim.org/' });
      resources.push({ title: 'WCAG 1.3.1 Understanding', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' });
    }

    if (title.indexOf('landmark') >= 0 || title.indexOf('aria') >= 0) {
      resources.push({ title: 'Landmark Navigation Extension', url: 'https://chrome.google.com/webstore/detail/landmark-navigation-via-k/ddpokpbjopmeeiiolheejjpkonlkklgp' });
      resources.push({ title: 'WAI Landmarks Example', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/HTML5.html' });
    }

    if (title.indexOf('mobile') >= 0) {
      resources.push({ title: 'Google Mobile-Friendly Test', url: 'https://search.google.com/test/mobile-friendly' });
      resources.push({ title: 'WCAG 2.5.5 Understanding', url: 'https://www.w3.org/WAI/WCAG21/Understanding/target-size.html' });
    }

    // Always include general tools if we have fewer than 2 resources
    if (resources.length < 2) {
      var hasWave = false;
      var hasAxe = false;
      for (var i = 0; i < resources.length; i++) {
        if (resources[i].title.indexOf('WAVE') >= 0) hasWave = true;
        if (resources[i].title.indexOf('axe') >= 0) hasAxe = true;
      }
      if (!hasWave) {
        resources.push({ title: 'WAVE Accessibility Checker', url: 'https://wave.webaim.org/' });
      }
      if (!hasAxe) {
        resources.push({ title: 'axe DevTools (Chrome)', url: 'https://chrome.google.com/webstore/detail/axe-devtools-web-accessibility/lhdoppojpmngadmnindnejefpokejbdd' });
      }
    }

    return resources;
  }

  function _htmlToNode(html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.firstChild;
  }

})(window);
