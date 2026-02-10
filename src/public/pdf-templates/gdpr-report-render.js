/**
 * GDPR Compliance Report — PDF Renderer
 * Renders all GDPR compliance analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[gdpr-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('gdpr', function renderGDPR(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;

    var sectionIndex = 1;

    // Resolve data sources
    var compliance = data.compliance || {};
    var consentQuality = data.consentQuality || {};
    var risks = data.risks || [];
    var recommendations = data.recommendations || [];

    function _htmlToNode(htmlStr) {
      var tpl = document.createElement('template');
      tpl.innerHTML = htmlStr.trim();
      return tpl.content.firstChild;
    }

    /* -----------------------------------------------------------------------
       1. Cookie Consent
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-consent .pdf-section__content');
      var d = compliance.cookieConsent || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.consent', 'Cookie Consent'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.consent', 'Cookie consent mechanisms are a cornerstone of GDPR compliance. This section evaluates whether a consent banner is present, which consent management platform is in use, and whether consent is obtained before setting non-essential cookies. A compliant consent implementation must provide clear choices, avoid pre-checked boxes, and allow users to withdraw consent easily.')) + '</p>';

      // Consent overview table
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.consent.overviewHeading', 'Consent Overview')) + '</h3>';

      var rows = [];
      rows.push([
        esc(t('reports.gdpr.report.consent.rows.detected', 'Consent Banner Detected')),
        d.detected ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      rows.push([
        esc(t('reports.gdpr.report.consent.rows.platform', 'Consent Platform')),
        esc(d.platform || '-')
      ]);
      rows.push([
        esc(t('reports.gdpr.report.consent.rows.score', 'Consent Score')),
        score !== undefined && score !== null
          ? '<span style="color:' + (score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444') + ';font-weight:600;">' + score + '/100</span>'
          : '-'
      ]);

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '35%' },
          { label: t('seo.report.table.value', 'Value'), width: '65%' }
        ],
        rows,
        { striped: true }
      );

      // Metrics
      html += PR.renderMetrics([
        { value: d.detected ? t('seo.report.status.yes', 'Yes') : t('seo.report.status.no', 'No'), label: t('reports.gdpr.report.consent.rows.detected', 'Consent Banner Detected'), color: d.detected ? '#10b981' : '#ef4444' },
        { value: d.platform || '-', label: t('reports.gdpr.report.consent.rows.platform', 'Consent Platform') },
        { value: score !== undefined && score !== null ? score : '-', label: t('reports.gdpr.report.consent.rows.score', 'Consent Score') }
      ]);

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('common.pdf.execSummary.issuesFound', 'Issues Found')) + '</h3>';
        d.issues.forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
          html += PR.renderIssue(text, 'warning');
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Privacy Policy
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-privacy .pdf-section__content');
      var d = compliance.privacyPolicy || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.privacy', 'Privacy Policy'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.privacy', 'A clear and accessible privacy policy is required under GDPR. This section checks whether a privacy policy page exists, evaluates its URL accessibility, and scans for essential keywords and clauses. A compliant privacy policy must describe data collection practices, legal bases for processing, data retention periods, and how users can exercise their rights.')) + '</p>';

      // Privacy policy overview
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.privacy.overviewHeading', 'Policy Overview')) + '</h3>';

      var rows = [];
      rows.push([
        esc(t('reports.gdpr.report.privacy.rows.found', 'Privacy Policy Found')),
        d.found ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      rows.push([
        esc(t('reports.gdpr.report.privacy.rows.url', 'Policy URL')),
        d.url ? '<span class="pdf-table__truncate">' + esc(truncate(d.url, 80)) + '</span>' : '-'
      ]);

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '35%' },
          { label: t('seo.report.table.value', 'Value'), width: '65%' }
        ],
        rows,
        { striped: true }
      );

      // Metrics
      html += PR.renderMetrics([
        { value: d.found ? t('seo.report.status.yes', 'Yes') : t('seo.report.status.no', 'No'), label: t('reports.gdpr.report.privacy.rows.found', 'Privacy Policy Found'), color: d.found ? '#10b981' : '#ef4444' },
        { value: score !== undefined && score !== null ? score : '-', label: t('reports.gdpr.report.privacy.rows.score', 'Policy Score') }
      ]);

      // Keywords found
      var keywords = d.keywords || [];
      if (keywords.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.privacy.keywordsHeading', 'Keywords Found')) + '</h3>';
        var keywordRows = keywords.slice(0, 25).map(function (kw) {
          var kwText = typeof kw === 'string' ? kw : (kw.term || kw.keyword || '');
          return [
            '<strong>' + esc(kwText) + '</strong>',
            PR.renderStatus('pass', t('seo.report.status.detected', 'Detected'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.gdpr.report.privacy.table.keyword', 'Keyword'), width: '60%' },
            { label: t('seo.report.table.status', 'Status'), width: '40%' }
          ],
          keywordRows,
          { striped: true }
        );
      }

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('common.pdf.execSummary.issuesFound', 'Issues Found')) + '</h3>';
        d.issues.forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
          html += PR.renderIssue(text, 'warning');
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Cookie Policy
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cookie-policy .pdf-section__content');
      var d = compliance.cookiePolicy || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.cookiePolicy', 'Cookie Policy'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.cookiePolicy', 'A separate cookie policy provides transparency about which cookies your site uses and why. This section checks for the existence of a dedicated cookie policy page and evaluates its completeness. GDPR requires that users are informed about each cookie\'s purpose, duration, and whether it is first-party or third-party before consent is obtained.')) + '</p>';

      // Cookie policy overview
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.cookiePolicy.overviewHeading', 'Cookie Policy Overview')) + '</h3>';

      var rows = [];
      rows.push([
        esc(t('reports.gdpr.report.cookiePolicy.rows.found', 'Cookie Policy Found')),
        d.found ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      if (d.url) {
        rows.push([
          esc(t('reports.gdpr.report.cookiePolicy.rows.url', 'Policy URL')),
          '<span class="pdf-table__truncate">' + esc(truncate(d.url, 80)) + '</span>'
        ]);
      }

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '35%' },
          { label: t('seo.report.table.value', 'Value'), width: '65%' }
        ],
        rows,
        { striped: true }
      );

      // Metrics
      html += PR.renderMetrics([
        { value: d.found ? t('seo.report.status.yes', 'Yes') : t('seo.report.status.no', 'No'), label: t('reports.gdpr.report.cookiePolicy.rows.found', 'Cookie Policy Found'), color: d.found ? '#10b981' : '#ef4444' },
        { value: score !== undefined && score !== null ? score : '-', label: t('reports.gdpr.report.cookiePolicy.rows.score', 'Policy Score') }
      ]);

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('common.pdf.execSummary.issuesFound', 'Issues Found')) + '</h3>';
        d.issues.forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
          html += PR.renderIssue(text, 'warning');
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Data Subject Rights
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-rights .pdf-section__content');
      var d = compliance.dataSubjectRights || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.rights', 'Data Subject Rights'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.rights', 'GDPR grants individuals specific rights over their personal data, including the right to access, rectify, erase, restrict processing, and data portability. This section evaluates whether your site provides clear mechanisms for users to exercise these rights, such as contact forms, email addresses, or dedicated request portals. Providing easy-to-find rights mechanisms demonstrates compliance and builds user trust.')) + '</p>';

      // Rights overview
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.rights.overviewHeading', 'Rights Overview')) + '</h3>';

      var rows = [];
      rows.push([
        esc(t('reports.gdpr.report.rights.rows.found', 'Rights Information Found')),
        d.found ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '35%' },
          { label: t('seo.report.table.value', 'Value'), width: '65%' }
        ],
        rows,
        { striped: true }
      );

      // Mechanisms found
      var mechanisms = d.mechanisms || [];
      if (mechanisms.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.rights.mechanismsHeading', 'Mechanisms Found')) + '</h3>';

        html += PR.renderProgress(
          t('reports.gdpr.report.rights.mechanismsLabel', 'Rights Mechanisms'),
          mechanisms.length, mechanisms.length
        );

        var mechRows = mechanisms.map(function (mech) {
          var mechText = typeof mech === 'string' ? mech : (mech.name || mech.type || '');
          return [
            '<strong>' + esc(mechText) + '</strong>',
            PR.renderStatus('pass', t('seo.report.status.detected', 'Detected'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.gdpr.report.rights.table.mechanism', 'Mechanism'), width: '60%' },
            { label: t('seo.report.table.status', 'Status'), width: '40%' }
          ],
          mechRows,
          { striped: true }
        );
      }

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('common.pdf.execSummary.issuesFound', 'Issues Found')) + '</h3>';
        d.issues.forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
          html += PR.renderIssue(text, 'warning');
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Cookie Audit
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cookies .pdf-section__content');
      var cookies = compliance.cookies || [];
      var trackers = compliance.trackers || [];

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.cookies', 'Cookie Audit'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.cookies', 'This section provides a detailed audit of all cookies detected on your site, including their security attributes and categorization. Under GDPR, every cookie must be documented, categorized, and disclosed to users before consent is obtained. Cookies should use the Secure flag, HttpOnly attribute where appropriate, and a proper SameSite policy to minimize security risks.')) + '</p>';

      // Cookie metrics
      var secureCookies = cookies.filter(function (c) { return c.secure; }).length;
      var httpOnlyCookies = cookies.filter(function (c) { return c.httpOnly; }).length;

      html += PR.renderMetrics([
        { value: cookies.length, label: t('reports.gdpr.report.cookies.totalLabel', 'Total Cookies') },
        { value: secureCookies, label: t('reports.gdpr.report.cookies.secureLabel', 'Secure Cookies'), color: '#10b981' },
        { value: httpOnlyCookies, label: t('reports.gdpr.report.cookies.httpOnlyLabel', 'HttpOnly Cookies'), color: '#3b82f6' },
        { value: trackers.length, label: t('reports.gdpr.report.cookies.trackersLabel', 'Trackers Detected'), color: trackers.length > 0 ? '#f59e0b' : '#10b981' }
      ]);

      // Progress bar for secure cookies
      if (cookies.length > 0) {
        html += PR.renderProgress(
          t('reports.gdpr.report.cookies.secureCoverageLabel', 'Secure Cookie Coverage'),
          secureCookies, cookies.length
        );
      }

      // Cookie details table
      if (cookies.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.cookies.detailsHeading', 'Cookie Details')) + '</h3>';
        var cookieRows = cookies.slice(0, 30).map(function (c) {
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(c.name, 30)) + '</span>',
            '<span class="pdf-table__truncate">' + esc(truncate(c.domain || '', 25)) + '</span>',
            c.secure ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            c.httpOnly ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            esc(c.sameSite || 'None'),
            esc(c.expiry || '-')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.gdpr.report.cookies.table.name', 'Name'), width: '20%' },
            { label: t('reports.gdpr.report.cookies.table.domain', 'Domain'), width: '18%' },
            { label: 'Secure', width: '10%' },
            { label: 'HttpOnly', width: '10%' },
            { label: 'SameSite', width: '12%' },
            { label: t('reports.gdpr.report.cookies.table.expiry', 'Expiry'), width: '15%' }
          ],
          cookieRows,
          { striped: true }
        );

        if (cookies.length > 30) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: cookies.length - 30 }) + '</p>';
        }
      }

      // Trackers table
      if (trackers.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.cookies.trackersHeading', 'Third-Party Trackers')) + '</h3>';
        var trackerRows = trackers.slice(0, 20).map(function (tr) {
          return [
            '<strong>' + esc(tr.name || '-') + '</strong>',
            esc(tr.type || '-'),
            '<span class="pdf-table__truncate">' + esc(truncate(tr.domain || '', 40)) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.gdpr.report.cookies.table.trackerName', 'Tracker'), width: '30%' },
            { label: t('reports.gdpr.report.cookies.table.trackerType', 'Type'), width: '25%' },
            { label: t('reports.gdpr.report.cookies.table.trackerDomain', 'Domain'), width: '45%' }
          ],
          trackerRows,
          { striped: true }
        );

        if (trackers.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: trackers.length - 20 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Risk Assessment
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-risks .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.risks', 'Risk Assessment'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.risks', 'This section identifies compliance risks detected during the GDPR analysis. Risks are categorized by severity to help prioritize remediation efforts. Addressing critical and high-severity risks should be the immediate priority, as these represent the greatest exposure to regulatory penalties and data breaches. The consent quality assessment provides additional insight into how well your consent implementation meets GDPR requirements.')) + '</p>';

      // Risk severity metrics
      var critical = risks.filter(function (r) { return (r.severity || '').toLowerCase() === 'critical'; });
      var high = risks.filter(function (r) { return (r.severity || '').toLowerCase() === 'high'; });
      var medium = risks.filter(function (r) { return (r.severity || '').toLowerCase() === 'medium'; });
      var low = risks.filter(function (r) {
        var s = (r.severity || '').toLowerCase();
        return s === 'low' || (!s && r.title);
      });

      html += PR.renderMetrics([
        { value: critical.length, label: t('reports.gdpr.report.risks.critical', 'Critical'), color: critical.length > 0 ? '#ef4444' : '#10b981' },
        { value: high.length, label: t('reports.gdpr.report.risks.high', 'High'), color: high.length > 0 ? '#f97316' : '#10b981' },
        { value: medium.length, label: t('reports.gdpr.report.risks.medium', 'Medium'), color: medium.length > 0 ? '#f59e0b' : '#10b981' },
        { value: low.length, label: t('reports.gdpr.report.risks.low', 'Low'), color: low.length > 0 ? '#3b82f6' : '#10b981' }
      ]);

      // Risk cards grouped by severity
      var riskGroups = [
        { items: critical, label: t('reports.gdpr.report.risks.critical', 'Critical'), color: '#ef4444' },
        { items: high, label: t('reports.gdpr.report.risks.high', 'High'), color: '#f97316' },
        { items: medium, label: t('reports.gdpr.report.risks.medium', 'Medium'), color: '#f59e0b' },
        { items: low, label: t('reports.gdpr.report.risks.low', 'Low'), color: '#3b82f6' }
      ];

      var hasRisks = risks.length > 0;
      if (hasRisks) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.risks.detectedHeading', 'Detected Risks')) + '</h3>';
        riskGroups.forEach(function (group) {
          if (group.items.length === 0) return;
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:' + group.color + ';">&#9679; ' + group.label + ' (' + group.items.length + ')</div>';
          group.items.forEach(function (r) {
            html += '<div class="pdf-issue pdf-issue--' + (r.severity || 'medium').toLowerCase() + '">' +
              '<span class="pdf-issue__severity pdf-issue__severity--' + (r.severity || 'medium').toLowerCase() + '">' + esc((r.severity || 'MEDIUM').toUpperCase()) + '</span>' +
              '<span class="pdf-issue__text"><strong>' + esc(r.title || '') + '</strong>' +
              (r.description ? ' — ' + esc(r.description) : '') +
              (r.category ? ' <em>(' + esc(r.category) + ')</em>' : '') + '</span>' +
            '</div>';
          });
          html += '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('reports.gdpr.report.risks.noneFoundTitle', 'No Significant Risks Detected'),
          t('reports.gdpr.report.risks.noneFoundBody', 'No major compliance risks were identified during the analysis.'),
          'tip'
        );
      }

      // Consent quality
      if (consentQuality.score !== undefined || (consentQuality.issues && consentQuality.issues.length > 0) || (consentQuality.strengths && consentQuality.strengths.length > 0)) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.risks.consentQualityHeading', 'Consent Quality')) + '</h3>';

        if (consentQuality.score !== undefined && consentQuality.score !== null) {
          html += PR.renderMetrics([
            { value: consentQuality.score, label: t('reports.gdpr.report.risks.consentQualityScore', 'Consent Quality Score'), color: consentQuality.score >= 80 ? '#10b981' : consentQuality.score >= 50 ? '#f59e0b' : '#ef4444' }
          ]);
        }

        // Strengths
        if (consentQuality.strengths && consentQuality.strengths.length > 0) {
          consentQuality.strengths.forEach(function (strength) {
            var text = typeof strength === 'string' ? strength : (strength.message || strength.title || '');
            html += PR.renderIssue(text, 'pass');
          });
        }

        // Issues
        if (consentQuality.issues && consentQuality.issues.length > 0) {
          consentQuality.issues.forEach(function (issue) {
            var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
            html += PR.renderIssue(text, 'warning');
          });
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       7. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.recommendations', 'Based on the GDPR compliance analysis, this section provides prioritized recommendations to improve your data protection posture. Each recommendation includes the severity level and actionable guidance. Addressing critical and high-priority items first will yield the greatest improvement in compliance and reduce exposure to regulatory penalties.')) + '</p>';

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
          t('reports.gdpr.report.recommendations.noneTitle', 'Strong Compliance Posture'),
          t('reports.gdpr.report.recommendations.noneBody', 'Your site follows GDPR best practices. Continue monitoring for regulatory changes and maintaining your data protection standards.'),
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
