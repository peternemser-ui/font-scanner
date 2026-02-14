/**
 * Security Report — PDF Renderer
 * Renders all security analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[security-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('security', function renderSecurity(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;
    var translateImpact = utils.translateImpact || function(v) { return v; };

    var sectionIndex = 1;

    /* -----------------------------------------------------------------------
       1. SSL/TLS Certificate
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-ssl .pdf-section__content');
      var d = data.ssl || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('security.sslTlsSecurity', 'SSL/TLS Certificate'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('security.report.sectionIntros.ssl', 'SSL/TLS certificates establish encrypted connections between your server and visitors, protecting data in transit. A valid, properly configured certificate is essential for user trust and search engine rankings. This section evaluates your certificate validity, protocol version, issuer, and expiration status. Modern sites should use TLS 1.2 or higher and ensure certificates are renewed well before expiration.')) + '</p>';

      // SSL Overview table
      html += '<h3 class="pdf-subsection__title">' + esc(t('security.report.ssl.overviewHeading', 'Certificate Details')) + '</h3>';

      var rows = [];
      rows.push([
        esc(t('security.report.ssl.rows.status', 'Certificate Status')),
        d.valid ? PR.renderStatus('pass', t('security.validCertificate', 'Valid')) : PR.renderStatus('fail', t('security.invalidCertificate', 'Invalid'))
      ]);
      rows.push([
        esc(t('security.report.ssl.rows.protocol', 'Protocol')),
        esc(d.protocol || '-')
      ]);
      rows.push([
        esc(t('security.report.ssl.rows.issuer', 'Issuer')),
        esc(d.issuer || '-')
      ]);
      rows.push([
        esc(t('security.report.ssl.rows.validFrom', 'Valid From')),
        esc(d.validFrom || '-')
      ]);
      rows.push([
        esc(t('security.report.ssl.rows.validUntil', 'Valid Until')),
        esc(d.validUntil || '-')
      ]);
      rows.push([
        esc(t('security.report.ssl.rows.daysRemaining', 'Days Remaining')),
        d.daysRemaining !== null && d.daysRemaining !== undefined
          ? '<span style="color:' + (d.daysRemaining > 30 ? '#10b981' : d.daysRemaining > 7 ? '#f59e0b' : '#ef4444') + ';font-weight:600;">' + d.daysRemaining + '</span>'
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
        { value: d.valid ? t('security.validCertificate', 'Valid') : t('security.invalidCertificate', 'Invalid'), label: t('security.report.ssl.rows.status', 'Certificate Status'), color: d.valid ? '#10b981' : '#ef4444' },
        { value: d.protocol || '-', label: t('security.report.ssl.rows.protocol', 'Protocol') },
        { value: d.daysRemaining !== null && d.daysRemaining !== undefined ? d.daysRemaining : '-', label: t('security.report.ssl.rows.daysRemaining', 'Days Remaining') }
      ]);

      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Security Headers
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-headers .pdf-section__content');
      var d = data.headers || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('security.headers', 'Security Headers'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('security.report.sectionIntros.headers', 'HTTP security headers provide an additional layer of protection against common web attacks like XSS, clickjacking, and MIME-type sniffing. These headers instruct browsers on how to handle your content securely. This section checks for six critical security headers recommended by OWASP. Implementing all recommended headers significantly reduces your attack surface.')) + '</p>';

      // Progress bar
      html += PR.renderProgress(
        t('security.report.headers.implementedLabel', 'Headers Implemented'),
        d.implemented || 0, d.total || 6
      );

      // Header details table
      if (d.details) {
        var headerRows = [];
        var headerNames = Object.keys(d.details);
        headerNames.forEach(function (name) {
          var h = d.details[name];
          headerRows.push([
            '<strong>' + esc(name) + '</strong>',
            h.present ? PR.renderStatus('pass', t('security.report.status.present', 'Present')) : PR.renderStatus('fail', t('security.report.status.missing', 'Missing')),
            esc(h.description || ''),
            esc(h.present ? truncate(h.value || '', 60) : h.risk || '')
          ]);
        });

        html += PR.renderTable(
          [
            { label: t('security.report.headers.table.header', 'Header'), width: '25%' },
            { label: t('seo.report.table.status', 'Status'), width: '12%' },
            { label: t('security.report.headers.table.description', 'Description'), width: '33%' },
            { label: t('security.report.headers.table.valueOrRisk', 'Value / Risk'), width: '30%' }
          ],
          headerRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Vulnerabilities & Threats
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-vulnerabilities .pdf-section__content');
      var d = data.vulnerabilities || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('security.vulnerabilities', 'Vulnerabilities & Threats'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('security.report.sectionIntros.vulnerabilities', 'This section identifies potential security vulnerabilities detected during the analysis. Vulnerabilities are categorized by severity level from critical to low. Addressing critical and high-severity issues should be the top priority as they pose the greatest risk to your application and user data. Regular vulnerability assessments help maintain a strong security posture.')) + '</p>';

      // Severity metrics
      html += PR.renderMetrics([
        { value: d.critical || 0, label: t('security.report.vulnerabilities.critical', 'Critical'), color: (d.critical || 0) > 0 ? '#ef4444' : '#10b981' },
        { value: d.high || 0, label: t('security.report.vulnerabilities.high', 'High'), color: (d.high || 0) > 0 ? '#f97316' : '#10b981' },
        { value: d.medium || 0, label: t('security.report.vulnerabilities.medium', 'Medium'), color: (d.medium || 0) > 0 ? '#f59e0b' : '#10b981' },
        { value: d.low || 0, label: t('security.report.vulnerabilities.low', 'Low'), color: (d.low || 0) > 0 ? '#3b82f6' : '#10b981' }
      ]);

      // Issue cards
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('security.report.vulnerabilities.detectedHeading', 'Detected Vulnerabilities')) + '</h3>';
        d.issues.slice(0, 15).forEach(function (issue) {
          var sev = (issue.severity || 'medium').toLowerCase();
          html += '<div class="pdf-issue pdf-issue--' + sev + '">' +
            '<span class="pdf-issue__severity pdf-issue__severity--' + sev + '">' + esc(translateImpact(issue.severity || 'medium')) + '</span>' +
            '<span class="pdf-issue__text"><strong>' + esc(issue.title || '') + '</strong>' +
            (issue.description ? ' — ' + esc(issue.description) : '') + '</span>' +
          '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('security.report.vulnerabilities.noneFoundTitle', 'No Vulnerabilities Detected'),
          t('security.report.vulnerabilities.noneFoundBody', 'No significant vulnerabilities were identified during the analysis.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Cookie Security
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cookies .pdf-section__content');
      var d = data.cookies || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('security.cookies', 'Cookie Security'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('security.report.sectionIntros.cookies', 'Cookies store sensitive data like session tokens and user preferences. Improperly configured cookies can be intercepted, forged, or exploited through cross-site attacks. This section examines each cookie for security flags including HttpOnly, Secure, and SameSite attributes. All cookies handling sensitive data should have these protective flags enabled.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: d.total || 0, label: t('security.report.cookies.totalLabel', 'Total Cookies') },
        { value: d.secure || 0, label: t('security.report.cookies.secureLabel', 'Properly Secured'), color: '#10b981' }
      ]);

      // Progress bar
      if (d.total > 0) {
        html += PR.renderProgress(
          t('security.report.cookies.securedLabel', 'Cookies Secured'),
          d.secure || 0, d.total
        );
      }

      // Cookie table
      if (d.list && d.list.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('security.report.cookies.detailsHeading', 'Cookie Details')) + '</h3>';
        var cookieRows = d.list.slice(0, 20).map(function (c) {
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(c.name, 30)) + '</span>',
            c.httpOnly ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            c.secure ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            esc(c.sameSite || 'None')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('security.report.cookies.table.name', 'Cookie Name'), width: '35%' },
            { label: 'HttpOnly', width: '15%' },
            { label: 'Secure', width: '15%' },
            { label: 'SameSite', width: '15%' }
          ],
          cookieRows,
          { striped: true }
        );
      }

      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Third-Party Scripts
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-thirdparty .pdf-section__content');
      var d = data.thirdPartyScripts || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('security.thirdParty', 'Third-Party Scripts'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('security.report.sectionIntros.thirdParty', 'Third-party scripts introduce external code into your application, creating potential security risks. Each external script should be loaded with Subresource Integrity (SRI) to prevent tampering. This section audits all externally loaded scripts for SRI implementation, HTTPS usage, and loading method. Minimizing third-party dependencies and implementing SRI reduces your exposure to supply-chain attacks.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: d.total || 0, label: t('security.report.thirdParty.totalLabel', 'External Scripts') },
        { value: d.withSRI || 0, label: t('security.report.thirdParty.withSriLabel', 'With SRI'), color: '#10b981' }
      ]);

      // Progress bar
      if (d.total > 0) {
        html += PR.renderProgress(
          t('security.report.thirdParty.sriCoverageLabel', 'SRI Coverage'),
          d.withSRI || 0, d.total
        );
      }

      // Scripts table
      if (d.scripts && d.scripts.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('security.report.thirdParty.detailsHeading', 'Script Details')) + '</h3>';
        var scriptRows = d.scripts.slice(0, 20).map(function (s) {
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(s.url, 60)) + '</span>',
            s.hasSRI ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            s.https ? PR.renderStatus('pass', 'HTTPS') : PR.renderStatus('fail', 'HTTP'),
            esc(s.risk || 'low')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('security.report.thirdParty.table.scriptUrl', 'Script URL'), width: '45%' },
            { label: 'SRI', width: '12%' },
            { label: t('security.report.thirdParty.table.protocol', 'Protocol'), width: '13%' },
            { label: t('security.report.thirdParty.table.risk', 'Risk'), width: '12%' }
          ],
          scriptRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('security.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('security.report.sectionIntros.recommendations', 'Based on the security analysis, this section provides prioritized recommendations to strengthen your site\'s defenses. Each recommendation includes the severity level, potential impact, and actionable steps for implementation. Addressing critical and high-priority items first will provide the greatest improvement to your overall security posture.')) + '</p>';

      var recs = data.recommendations || [];
      if (recs.length > 0) {
        // Group by priority
        var critical = recs.filter(function (r) { return r.priority === 'critical'; });
        var high = recs.filter(function (r) { return r.priority === 'high'; });
        var medium = recs.filter(function (r) { return r.priority === 'medium'; });
        var groups = [
          { items: critical, label: t('common.pdf.execSummary.highPriority', 'Critical'), color: '#ef4444' },
          { items: high, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#f97316' },
          { items: medium, label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: '#f59e0b' }
        ];

        groups.forEach(function (group) {
          if (group.items.length === 0) return;
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:' + group.color + ';">&#9679; ' + group.label + ' (' + group.items.length + ')</div>';
          group.items.forEach(function (r) {
            html += '<div class="pdf-rec" style="border-left-color:' + group.color + ';">' +
              '<div class="pdf-rec__text"><strong>' + esc(r.title || '') + '</strong>' +
              (r.description ? '<br>' + esc(r.description) : '') +
              (r.solution ? '<br><em>' + esc(r.solution) + '</em>' : '') +
              '</div>' +
            '</div>';
          });
          html += '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('security.report.recommendations.noneTitle', 'Strong Security Posture'),
          t('security.report.recommendations.noneBody', 'Your site follows security best practices. Continue monitoring for new vulnerabilities.'),
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
