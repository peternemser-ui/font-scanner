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
    var scoreColor = (utils.scoreColor || PR.helpers && PR.helpers.scoreColor) || function (s) {
      if (s >= 80) return '#10b981';
      if (s >= 65) return '#22c55e';
      if (s >= 50) return '#f59e0b';
      return '#ef4444';
    };
    var translateImpact = utils.translateImpact || function(v) { return v; };

    var sectionIndex = 1;

    // Resolve data sources
    var compliance = data.compliance || {};
    var consentQuality = data.consentQuality || {};
    var risks = data.risks || [];
    var recommendations = data.recommendations || [];

    // Computed category scores (matching web UI logic)
    var cookiesData = compliance.cookies || {};
    // The API returns cookies as an object { count, classified: {...}, ... }
    // with individual cookies nested inside classified sub-arrays.
    // Flatten classified cookies into a single list for the Cookie Audit table.
    var cookieList = cookiesData.list || cookiesData.details || [];
    if (cookieList.length === 0 && cookiesData.classified && typeof cookiesData.classified === 'object') {
      var classified = cookiesData.classified;
      Object.keys(classified).forEach(function (catKey) {
        if (Array.isArray(classified[catKey])) {
          classified[catKey].forEach(function (c) {
            cookieList.push(c);
          });
        }
      });
    }
    // Some data shapes store cookies as top-level array; fallback
    if (cookieList.length === 0 && Array.isArray(compliance.cookies)) {
      cookieList = compliance.cookies;
      cookiesData = {};
    }
    var trackersData = compliance.trackers || {};

    // _pdf-report.js normalizes data.score from a number to { overall, grade }.
    // Extract the numeric value for use in computed scores.
    var overallScore = (data.score && typeof data.score === 'object') ? (data.score.overall || 0) : (data.score || 0);
    var cookieCount = cookiesData.count || cookieList.length || 0;
    var cookieScore = cookieCount <= 5 ? 100 : Math.max(0, 100 - (cookieCount - 5) * 5);
    var consentDetected = (compliance.cookieConsent || {}).detected;
    var hasKnownLib = (compliance.cookieConsent || {}).hasKnownLibrary;
    var consentScore = consentDetected ? (hasKnownLib ? 100 : 70) : 0;
    var privacyScore = (compliance.privacyPolicy || {}).hasLink ? 100 : 0;
    var trackerCount = trackersData.count || (trackersData.detected || []).length || 0;
    var trackerScore = trackerCount === 0 ? 100 : Math.max(0, 100 - trackerCount * 10);
    var legalPagesScore = ((compliance.privacyPolicy || {}).hasLink ? 40 : 0) +
      ((compliance.cookiePolicy || {}).hasLink ? 30 : 0) +
      ((compliance.termsOfService || {}).hasLink ? 30 : 0);
    var dataRightsScore = ((compliance.dataSubjectRights || {}).hasInfo ? 60 : 0) +
      ((compliance.dataSubjectRights || {}).hasDPOContact ? 40 : 0);

    function _htmlToNode(htmlStr) {
      var tpl = document.createElement('template');
      tpl.innerHTML = htmlStr.trim();
      return tpl.content.firstChild;
    }

    /** Helper: severity color mapping */
    function _sevColor(sev) {
      var s = (sev || 'medium').toLowerCase();
      if (s === 'critical') return '#ef4444';
      if (s === 'high') return '#f97316';
      if (s === 'medium') return '#f59e0b';
      return '#3b82f6';
    }

    /** Helper: get GDPR code snippet for a recommendation (matches web UI) */
    function _getCodeSnippet(rec) {
      var msg = (rec.message || rec.title || '').toLowerCase();
      var cat = (rec.category || '').toLowerCase();
      var combined = msg + ' ' + cat;

      if (combined.indexOf('data subject') >= 0 || combined.indexOf('rights information') >= 0) {
        return '<!-- Data Subject Rights Section (GDPR Article 15-22) -->\n<section id="your-rights" class="privacy-section">\n  <h2>Your Data Rights</h2>\n  <p>Under GDPR, you have the following rights:</p>\n  <ul>\n    <li>Right of Access (Art. 15)</li>\n    <li>Right to Rectification (Art. 16)</li>\n    <li>Right to Erasure (Art. 17)</li>\n    <li>Right to Data Portability (Art. 20)</li>\n  </ul>\n  <p>Response Time: Within 30 days.</p>\n  <p>Contact: privacy@yourcompany.com</p>\n</section>';
      }
      if (combined.indexOf('privacy contact') >= 0 || combined.indexOf('contact information') >= 0) {
        return '<!-- Privacy Contact Section -->\n<section id="privacy-contact">\n  <h2>Privacy Contact Information</h2>\n  <div class="contact-item">\n    <h3>Data Protection Officer</h3>\n    <p>Email: dpo@yourcompany.com</p>\n  </div>\n  <div class="contact-item">\n    <h3>Privacy Inquiries</h3>\n    <p>Email: privacy@yourcompany.com</p>\n    <p>Response time: Within 48 hours</p>\n  </div>\n</section>';
      }
      if (combined.indexOf('consent withdrawal') >= 0 || combined.indexOf('withdraw consent') >= 0) {
        return '<!-- Consent Withdrawal Section (GDPR Article 7) -->\n<section id="withdraw-consent">\n  <h2>Withdraw Your Consent</h2>\n  <button data-action="open-cookie-settings">\n    Manage Cookies\n  </button>\n  <a href="/unsubscribe">Unsubscribe from emails</a>\n  <a href="/data-request?type=erasure">Delete My Account</a>\n</section>';
      }
      if (combined.indexOf('data retention') >= 0 || combined.indexOf('retention period') >= 0) {
        return '<!-- Data Retention Disclosure (GDPR Article 13/14) -->\n<table class="retention-table">\n  <tr><th>Data Type</th><th>Retention</th><th>Reason</th></tr>\n  <tr><td>Account Info</td><td>Until deletion + 30d</td><td>Service</td></tr>\n  <tr><td>Transaction Records</td><td>7 years</td><td>Legal</td></tr>\n  <tr><td>Analytics</td><td>26 months</td><td>Improvement</td></tr>\n  <tr><td>Server Logs</td><td>90 days</td><td>Security</td></tr>\n</table>';
      }
      if (combined.indexOf('age verification') >= 0 || combined.indexOf('child') >= 0 || combined.indexOf('minor') >= 0) {
        return '<!-- Age Verification (GDPR Article 8) -->\n<section id="age-verification">\n  <h2>Age Verification</h2>\n  <p>Our service is intended for users 16 years or older.\n     If you are under 16, parental consent is required.</p>\n  <div class="age-verification-form">\n    <label>Date of Birth:</label>\n    <input type="date" id="dob" name="dob" required>\n    <button data-action="verify-age">Verify Age</button>\n  </div>\n  <p class="under-age-notice" style="display:none;">\n    <strong>Under 16?</strong>\n    Please ask a parent or guardian to create an account.\n    <a href="/parental-consent">Parental Consent Form</a>\n  </p>\n</section>';
      }
      if (combined.indexOf('cookie consent') >= 0 || combined.indexOf('cookie banner') >= 0) {
        return '<!-- GDPR-Compliant Cookie Consent -->\n<div id="cookie-consent" class="cookie-banner">\n  <h3>We value your privacy</h3>\n  <div class="cookie-categories">\n    <label><input type="checkbox" checked disabled> Essential</label>\n    <label><input type="checkbox" id="analytics"> Analytics</label>\n    <label><input type="checkbox" id="marketing"> Marketing</label>\n  </div>\n  <button data-action="accept-all">Accept All</button>\n  <button data-action="reject-non-essential">Reject All</button>\n  <button data-action="save-preferences">Save Preferences</button>\n</div>';
      }
      if (combined.indexOf('reject') >= 0 || combined.indexOf('decline') >= 0) {
        return '<!-- Equal-prominence Reject button -->\n<div class="cookie-buttons">\n  <button class="btn btn-primary">Accept All</button>\n  <button class="btn btn-secondary">Reject All</button>\n  <button class="btn btn-outline">Customize</button>\n</div>';
      }
      if (combined.indexOf('privacy policy') >= 0) {
        return '<!-- Privacy Policy (GDPR Articles 13-14) -->\n<article class="privacy-policy">\n  <h1>Privacy Policy</h1>\n  <section><h2>1. Data Controller</h2></section>\n  <section><h2>2. Data We Collect</h2></section>\n  <section><h2>3. Legal Basis</h2></section>\n  <section><h2>4. Your Rights</h2></section>\n  <section><h2>5. Data Retention</h2></section>\n</article>';
      }
      if (combined.indexOf('cookie policy') >= 0) {
        return '<!-- Dedicated Cookie Policy -->\n<article class="cookie-policy">\n  <h1>Cookie Policy</h1>\n  <p>This policy explains how we use cookies.</p>\n  <table>\n    <tr><th>Cookie</th><th>Purpose</th><th>Duration</th></tr>\n  </table>\n</article>';
      }
      if (combined.indexOf('tracker') >= 0) {
        return '<!-- Control Tracker Loading -->\n<script>\n  // Only load trackers after consent\n  if (hasConsent("analytics")) {\n    loadScript("https://analytics.example.com/tag.js");\n  }\n  if (hasConsent("marketing")) {\n    loadScript("https://ads.example.com/pixel.js");\n  }\n</script>';
      }
      if (combined.indexOf('https') >= 0 || combined.indexOf('ssl') >= 0) {
        return '# Force HTTPS redirect (Apache .htaccess)\nRewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\n\n# Or Nginx:\nserver {\n  listen 80;\n  return 301 https://$host$request_uri;\n}';
      }
      return rec.detail || rec.description || '';
    }

    /** Helper: get step-by-step fix guide for a recommendation */
    function _getFixSteps(rec) {
      var msg = (rec.message || rec.title || '').toLowerCase();
      var cat = (rec.category || '').toLowerCase();
      var combined = msg + ' ' + cat;

      if (combined.indexOf('data subject') >= 0 || combined.indexOf('rights information') >= 0) {
        return [
          t('reports.gdpr.fixGuide.dataSubjectRights.step1', '<strong>Create a "Your Rights" page</strong> - Add a dedicated page explaining all GDPR rights (access, rectification, erasure, portability, restriction, objection)'),
          t('reports.gdpr.fixGuide.dataSubjectRights.step2', '<strong>Add request forms</strong> - Create online forms for each right type with clear submission process'),
          t('reports.gdpr.fixGuide.dataSubjectRights.step3', '<strong>Set up handling process</strong> - Define internal workflow for responding to requests within 30 days'),
          t('reports.gdpr.fixGuide.dataSubjectRights.step4', '<strong>Train your team</strong> - Ensure staff know how to verify identity and process different request types'),
          t('reports.gdpr.fixGuide.dataSubjectRights.step5', '<strong>Link prominently</strong> - Add links to rights page in footer, privacy policy, and account settings'),
          t('reports.gdpr.fixGuide.dataSubjectRights.step6', '<strong>Document everything</strong> - Keep records of all requests received and how they were handled')
        ];
      }
      if (combined.indexOf('privacy contact') >= 0 || combined.indexOf('contact information') >= 0) {
        return [
          t('reports.gdpr.fixGuide.privacyContact.step1', '<strong>Designate a DPO</strong> - Appoint a Data Protection Officer if required (public authority, large-scale processing, special categories)'),
          t('reports.gdpr.fixGuide.privacyContact.step2', '<strong>Create contact page</strong> - Add dedicated privacy contact section with email, phone, and postal address'),
          t('reports.gdpr.fixGuide.privacyContact.step3', '<strong>Set up privacy email</strong> - Create a dedicated privacy@yourcompany.com inbox monitored daily'),
          t('reports.gdpr.fixGuide.privacyContact.step4', '<strong>Define response SLA</strong> - Commit to responding to privacy inquiries within 48 hours'),
          t('reports.gdpr.fixGuide.privacyContact.step5', '<strong>Add to privacy policy</strong> - Include full contact details in your privacy policy header'),
          t('reports.gdpr.fixGuide.privacyContact.step6', '<strong>Provide escalation path</strong> - List supervisory authority contact for users who want to lodge complaints')
        ];
      }
      if (combined.indexOf('consent withdrawal') >= 0 || combined.indexOf('withdraw consent') >= 0) {
        return [
          t('reports.gdpr.fixGuide.consentWithdrawal.step1', '<strong>Add cookie settings link</strong> - Provide a persistent "Cookie Settings" link in footer to re-open consent dialog'),
          t('reports.gdpr.fixGuide.consentWithdrawal.step2', '<strong>Email unsubscribe</strong> - Include one-click unsubscribe in all marketing emails (not just a preferences link)'),
          t('reports.gdpr.fixGuide.consentWithdrawal.step3', '<strong>Account settings</strong> - Add privacy preferences section in user account with toggle switches'),
          t('reports.gdpr.fixGuide.consentWithdrawal.step4', '<strong>Make it equally easy</strong> - GDPR requires withdrawal to be as easy as giving consent - no dark patterns'),
          t('reports.gdpr.fixGuide.consentWithdrawal.step5', '<strong>Process immediately</strong> - Withdrawal should take effect instantly, not "within 24 hours"'),
          t('reports.gdpr.fixGuide.consentWithdrawal.step6', '<strong>Keep consent records</strong> - Log when consent was given AND when it was withdrawn for compliance')
        ];
      }
      if (combined.indexOf('cookie') >= 0 || combined.indexOf('consent') >= 0) {
        return [
          t('reports.gdpr.fixGuide.cookieConsent.step1', '<strong>Choose a CMP</strong> - Select a GDPR-compliant Consent Management Platform (Cookiebot, OneTrust, etc.)'),
          t('reports.gdpr.fixGuide.cookieConsent.step2', '<strong>Scan your cookies</strong> - Audit all cookies set by your site and categorize them (essential, analytics, marketing)'),
          t('reports.gdpr.fixGuide.cookieConsent.step3', '<strong>Equal prominence</strong> - Show Accept and Reject buttons with equal visual weight - no dark patterns'),
          t('reports.gdpr.fixGuide.cookieConsent.step4', '<strong>Block until consent</strong> - Ensure non-essential cookies are blocked until explicit consent is given'),
          t('reports.gdpr.fixGuide.cookieConsent.step5', '<strong>Granular control</strong> - Allow users to accept/reject by category, not just all-or-nothing'),
          t('reports.gdpr.fixGuide.cookieConsent.step6', '<strong>Test thoroughly</strong> - Use browser DevTools to verify no cookies are set before consent')
        ];
      }
      if (combined.indexOf('privacy policy') >= 0) {
        return [
          t('reports.gdpr.fixGuide.privacyPolicy.step1', '<strong>Use a template</strong> - Start with a GDPR-compliant template and customize for your business'),
          t('reports.gdpr.fixGuide.privacyPolicy.step2', '<strong>Required disclosures</strong> - Include: data controller, DPO contact, data types, legal basis, retention, rights, transfers'),
          t('reports.gdpr.fixGuide.privacyPolicy.step3', '<strong>Plain language</strong> - Write in clear, understandable terms - avoid legal jargon where possible'),
          t('reports.gdpr.fixGuide.privacyPolicy.step4', '<strong>Layered approach</strong> - Provide a summary at top with links to detailed sections below'),
          t('reports.gdpr.fixGuide.privacyPolicy.step5', '<strong>Version control</strong> - Date your policy and keep archives of previous versions'),
          t('reports.gdpr.fixGuide.privacyPolicy.step6', '<strong>Prominent placement</strong> - Link in footer, signup forms, checkout, and consent banner')
        ];
      }
      if (combined.indexOf('tracker') >= 0) {
        return [
          t('reports.gdpr.fixGuide.tracker.step1', '<strong>Audit all scripts</strong> - Use a tool like Ghostery or browser DevTools to identify all third-party trackers'),
          t('reports.gdpr.fixGuide.tracker.step2', '<strong>Document each tracker</strong> - List what data each tracker collects and for what purpose'),
          t('reports.gdpr.fixGuide.tracker.step3', '<strong>Remove unnecessary</strong> - Delete any trackers you don\'t actively use or need'),
          t('reports.gdpr.fixGuide.tracker.step4', '<strong>Implement consent</strong> - Ensure trackers only fire after user consent is given'),
          t('reports.gdpr.fixGuide.tracker.step5', '<strong>Update privacy policy</strong> - List all third-party processors in your privacy policy'),
          t('reports.gdpr.fixGuide.tracker.step6', '<strong>Data Processing Agreements</strong> - Ensure you have DPAs with all third-party tracker providers')
        ];
      }
      if (combined.indexOf('data retention') >= 0 || combined.indexOf('retention period') >= 0) {
        return [
          t('reports.gdpr.fixGuide.dataRetention.step1', '<strong>Audit your data</strong> - List all types of personal data you collect and where it\'s stored'),
          t('reports.gdpr.fixGuide.dataRetention.step2', '<strong>Define retention periods</strong> - Set specific timeframes for each data type based on legal/business need'),
          t('reports.gdpr.fixGuide.dataRetention.step3', '<strong>Document justification</strong> - Record why you need to keep data for the stated period'),
          t('reports.gdpr.fixGuide.dataRetention.step4', '<strong>Implement auto-deletion</strong> - Set up automated processes to delete data when retention expires'),
          t('reports.gdpr.fixGuide.dataRetention.step5', '<strong>Publish retention schedule</strong> - Add a clear table in your privacy policy showing all retention periods'),
          t('reports.gdpr.fixGuide.dataRetention.step6', '<strong>Review annually</strong> - Schedule yearly review of retention periods to ensure they\'re still justified')
        ];
      }
      if (combined.indexOf('age verification') >= 0 || combined.indexOf('child') >= 0 || combined.indexOf('minor') >= 0) {
        return [
          t('reports.gdpr.fixGuide.ageVerification.step1', '<strong>Determine your age threshold</strong> - GDPR default is 16, but varies by country (UK: 13, Germany: 16, etc.)'),
          t('reports.gdpr.fixGuide.ageVerification.step2', '<strong>Add age gate</strong> - Implement age verification before account creation or data collection'),
          t('reports.gdpr.fixGuide.ageVerification.step3', '<strong>Parental consent flow</strong> - Create process for users under threshold to get parent/guardian approval'),
          t('reports.gdpr.fixGuide.ageVerification.step4', '<strong>Verify parental consent</strong> - Implement reasonable method to verify guardian identity'),
          t('reports.gdpr.fixGuide.ageVerification.step5', '<strong>Child-friendly language</strong> - If children can use your service, ensure privacy info is age-appropriate'),
          t('reports.gdpr.fixGuide.ageVerification.step6', '<strong>Special data protection</strong> - Minimize data collection from minors and never use for marketing')
        ];
      }
      if (combined.indexOf('cookie policy') >= 0) {
        return [
          t('reports.gdpr.fixGuide.cookiePolicy.step1', 'Create a dedicated cookie policy page separate from privacy policy'),
          t('reports.gdpr.fixGuide.cookiePolicy.step2', 'List every cookie with name, purpose, duration, and category'),
          t('reports.gdpr.fixGuide.cookiePolicy.step3', 'Distinguish between first-party and third-party cookies'),
          t('reports.gdpr.fixGuide.cookiePolicy.step4', 'Explain which cookies require consent and which are essential'),
          t('reports.gdpr.fixGuide.cookiePolicy.step5', 'Update policy whenever you add or remove cookies'),
          t('reports.gdpr.fixGuide.cookiePolicy.step6', 'Link from consent banner and footer for easy access')
        ];
      }
      if (combined.indexOf('reject') >= 0 || combined.indexOf('decline') >= 0) {
        return [
          t('reports.gdpr.fixGuide.rejectButton.step1', 'Add an explicit Reject or Decline button to cookie banner'),
          t('reports.gdpr.fixGuide.rejectButton.step2', 'Make Reject button equally prominent as Accept - same size and color weight'),
          t('reports.gdpr.fixGuide.rejectButton.step3', 'Ensure Reject blocks all non-essential cookies immediately'),
          t('reports.gdpr.fixGuide.rejectButton.step4', 'Test that rejecting works without requiring additional clicks'),
          t('reports.gdpr.fixGuide.rejectButton.step5', 'Avoid dark patterns - do not hide or minimize the Reject option'),
          t('reports.gdpr.fixGuide.rejectButton.step6', 'Allow users to change their mind later via cookie settings link')
        ];
      }
      if (combined.indexOf('https') >= 0 || combined.indexOf('ssl') >= 0) {
        return [
          t('reports.gdpr.fixGuide.https.step1', 'Obtain SSL certificate from a trusted provider or use free Let\\'),
          t('reports.gdpr.fixGuide.https.step2', 'Install certificate on your web server'),
          t('reports.gdpr.fixGuide.https.step3', 'Configure server to redirect all HTTP traffic to HTTPS'),
          t('reports.gdpr.fixGuide.https.step4', 'Update all internal links to use HTTPS'),
          t('reports.gdpr.fixGuide.https.step5', 'Enable HSTS header to force HTTPS on future visits'),
          t('reports.gdpr.fixGuide.https.step6', 'Test with SSL Labs to verify A+ rating')
        ];
      }
      return [
        t('reports.gdpr.fixGuide.default.step1', '<strong>Identify the gap</strong> - Review exactly what GDPR requirement is not being met'),
        t('reports.gdpr.fixGuide.default.step2', '<strong>Research requirements</strong> - Consult GDPR Articles 12-23 for specific user rights requirements'),
        t('reports.gdpr.fixGuide.default.step3', '<strong>Implement the fix</strong> - Make the necessary changes to your website and processes'),
        t('reports.gdpr.fixGuide.default.step4', '<strong>Document changes</strong> - Keep records of what was changed and when for accountability'),
        t('reports.gdpr.fixGuide.default.step5', '<strong>Test compliance</strong> - Verify the implementation works as expected'),
        t('reports.gdpr.fixGuide.default.step6', '<strong>Schedule review</strong> - Set a reminder to review this compliance area annually')
      ];
    }

    /* -----------------------------------------------------------------------
       1. Cookie Consent
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-consent .pdf-section__content');
      var d = compliance.cookieConsent || {};
      // API does not set d.score; use the computed consentScore instead
      var score = d.score !== undefined ? d.score : consentScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.consent', 'Cookie Consent'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.consent', 'Cookie consent mechanisms are required under GDPR and ePrivacy regulations. A compliant consent banner must be clearly visible, offer granular choices, and not pre-select non-essential cookies. This section evaluates whether a consent management platform is detected and if it meets regulatory requirements.')) + '</p>';

      // Consent overview table
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.consent.overviewHeading', 'Consent Overview')) + '</h3>';

      var rows = [];
      rows.push([
        esc(t('reports.gdpr.report.consent.rows.detected', 'Consent Banner Detected')),
        d.detected ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      rows.push([
        esc(t('reports.gdpr.report.consent.rows.platform', 'Consent Platform')),
        esc(d.platform || d.detectedLibrary || '-')
      ]);
      rows.push([
        esc(t('reports.gdpr.report.consent.rows.hasRejectOption', 'Has Reject Option')),
        d.hasRejectOption ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      rows.push([
        esc(t('reports.gdpr.report.consent.rows.hasGranularOptions', 'Granular Options')),
        (d.hasGranularOptions || d.hasGranularConsent) ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
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
        { value: d.platform || d.detectedLibrary || '-', label: t('reports.gdpr.report.consent.rows.platform', 'Consent Platform') },
        { value: consentScore, label: t('reports.gdpr.report.consent.rows.score', 'Consent Score'), color: scoreColor(consentScore) }
      ]);

      // Missing reject option warning (matches web UI)
      if (!d.hasRejectOption && d.detected) {
        html += PR.renderCallout(
          t('reports.gdpr.missingRejectOption', 'Missing Reject Option'),
          t('reports.gdpr.missingRejectOptionDesc', 'GDPR requires an equally prominent "Reject" or "Decline" button. Users must be able to refuse cookies as easily as accepting them.'),
          'warning'
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
       2. Consent Quality (NEW — matches web UI renderConsentQualityContent)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-consent-quality .pdf-section__content');
      if (!sec) return;

      var qScore = consentQuality.score;
      var hasData = qScore !== undefined || (consentQuality.factors && consentQuality.factors.length > 0);
      if (!hasData) { sec.parentElement.style.display = 'none'; return; }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.sections.consentQuality', 'Cookie Consent Quality'), qScore)),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.consentQuality', 'This section evaluates the quality of your cookie consent implementation against GDPR requirements. Each factor is scored individually, covering banner presence, reject options, granular controls, consent library, and pre-consent cookie blocking.')) + '</p>';

      // Score + Grade + Library metrics
      var consent = compliance.cookieConsent || {};
      html += PR.renderMetrics([
        { value: qScore !== undefined ? qScore : '-', label: t('reports.gdpr.qualityScore', 'Quality Score'), color: scoreColor(qScore || 0) },
        { value: consentQuality.grade || '-', label: t('reports.common.grade', 'Grade'), color: scoreColor(qScore || 0) },
        { value: consent.detectedLibrary || t('reports.common.none', 'None'), label: t('reports.gdpr.consentLibrary', 'Consent Library') }
      ]);

      // Quality Factors table (matches web UI factor list)
      var factors = consentQuality.factors || [];
      if (factors.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.qualityFactors', 'Quality Factors')) + '</h3>';
        var factorRows = factors.map(function (f) {
          var statusLabel = f.status === 'pass' ? t('common.pdf.status.pass', 'Pass') : f.status === 'warn' ? t('common.pdf.status.warning', 'Warning') : t('common.pdf.status.fail', 'Fail');
          var statusType = f.status === 'pass' ? 'pass' : f.status === 'warn' ? 'warning' : 'fail';
          var maxPoints = (f.name || '').indexOf('reject') >= 0 ? 25 : (f.name || '').indexOf('library') >= 0 ? 15 : 20;
          return [
            esc(f.name || ''),
            '<span style="font-weight:600;">' + (f.points || 0) + '/' + maxPoints + '</span>',
            PR.renderStatus(statusType, statusLabel)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.gdpr.report.consentQuality.factor', 'Factor'), width: '50%' },
            { label: t('reports.gdpr.report.consentQuality.points', 'Points'), width: '20%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          factorRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Privacy Policy
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-privacy .pdf-section__content');
      var d = compliance.privacyPolicy || {};
      // API does not set d.score; use the computed privacyScore instead
      var score = d.score !== undefined ? d.score : privacyScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.privacy', 'Privacy Policy'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.privacy', 'A comprehensive privacy policy is a legal requirement under GDPR. It must clearly explain what data you collect, how you use it, who you share it with, and how users can exercise their rights. This section checks for the presence and completeness of your privacy policy.')) + '</p>';

      // Privacy policy overview
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.privacy.overviewHeading', 'Policy Overview')) + '</h3>';

      var rows = [];
      rows.push([
        esc(t('reports.gdpr.report.privacy.rows.found', 'Privacy Policy Found')),
        d.found || d.hasLink ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      var privacyUrl = d.url || (d.links && d.links.length > 0 ? d.links[0] : '');
      rows.push([
        esc(t('reports.gdpr.report.privacy.rows.url', 'Policy URL')),
        privacyUrl ? '<span class="pdf-table__truncate">' + esc(truncate(privacyUrl, 80)) + '</span>' : '-'
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
        { value: (d.found || d.hasLink) ? t('seo.report.status.yes', 'Yes') : t('seo.report.status.no', 'No'), label: t('reports.gdpr.report.privacy.rows.found', 'Privacy Policy Found'), color: (d.found || d.hasLink) ? '#10b981' : '#ef4444' },
        { value: privacyScore, label: t('reports.gdpr.report.privacy.rows.score', 'Policy Score'), color: scoreColor(privacyScore) }
      ]);

      // Keywords found
      var keywords = d.keywords || [];
      if (keywords.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.privacy.keywordsHeading', 'Keywords Found')) + '</h3>';

        html += PR.renderProgress(
          t('reports.gdpr.report.privacy.keywordsCoverage', 'Privacy Keywords Coverage'),
          keywords.length, keywords.length
        );

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

        if (keywords.length > 25) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: keywords.length - 25 }) + '</p>';
        }
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
       4. Cookie Policy
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cookie-policy .pdf-section__content');
      var d = compliance.cookiePolicy || {};
      // API does not set d.score; compute based on hasLink
      var score = d.score !== undefined ? d.score : (d.hasLink ? 100 : 0);

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.cookiePolicy', 'Cookie Policy'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.cookiePolicy', 'A dedicated cookie policy provides detailed information about the cookies your site uses. It should explain each cookie\'s purpose, duration, and whether it\'s essential or optional. This section evaluates your cookie policy\'s presence and completeness.'s purpose, duration, and whether it is first-party or third-party before consent is obtained.')) + '</p>';

      // Cookie policy overview
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.cookiePolicy.overviewHeading', 'Cookie Policy Overview')) + '</h3>';

      var rows = [];
      rows.push([
        esc(t('reports.gdpr.report.cookiePolicy.rows.found', 'Cookie Policy Found')),
        (d.found || d.hasLink) ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
      ]);
      var cookiePolicyUrl = d.url || (d.links && d.links.length > 0 ? d.links[0] : '');
      if (cookiePolicyUrl) {
        rows.push([
          esc(t('reports.gdpr.report.cookiePolicy.rows.url', 'Policy URL')),
          '<span class="pdf-table__truncate">' + esc(truncate(cookiePolicyUrl, 80)) + '</span>'
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
        { value: (d.found || d.hasLink) ? t('seo.report.status.yes', 'Yes') : t('seo.report.status.no', 'No'), label: t('reports.gdpr.report.cookiePolicy.rows.found', 'Cookie Policy Found'), color: (d.found || d.hasLink) ? '#10b981' : '#ef4444' },
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
       5. Legal Pages (NEW — matches web UI renderLegalPagesContent)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-legal-pages .pdf-section__content');
      if (!sec) return;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.sections.legalPages', 'Legal Pages'), legalPagesScore)),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.legalPages', 'This section checks for the presence of essential legal pages required for GDPR compliance: a privacy policy, a cookie policy, and terms of service. Missing legal pages represent significant compliance gaps.')) + '</p>';

      html += PR.renderMetrics([
        { value: legalPagesScore, label: t('reports.gdpr.sections.legalPages', 'Legal Pages'), color: scoreColor(legalPagesScore) }
      ]);

      // Legal pages detection table
      var pages = [
        { key: 'privacyPolicy', label: t('reports.gdpr.legalPages.privacyPolicy', 'Privacy Policy'), required: true },
        { key: 'cookiePolicy', label: t('reports.gdpr.legalPages.cookiePolicy', 'Cookie Policy'), required: false },
        { key: 'termsOfService', label: t('reports.gdpr.legalPages.termsOfService', 'Terms of Service'), required: false }
      ];

      var pageRows = pages.map(function (p) {
        var pd = compliance[p.key] || {};
        var hasLink = pd.hasLink || pd.found;
        return [
          '<strong>' + esc(p.label) + '</strong>' + (p.required ? ' <em style="color:#ef4444;font-size:0.85em;">(' + esc(t('reports.gdpr.required', 'Required')) + ')</em>' : ''),
          hasLink ? PR.renderStatus('pass', t('reports.gdpr.found', 'Found')) : PR.renderStatus('fail', t('reports.gdpr.missing', 'Missing'))
        ];
      });

      html += PR.renderTable(
        [
          { label: t('reports.gdpr.report.legalPages.page', 'Legal Page'), width: '60%' },
          { label: t('seo.report.table.status', 'Status'), width: '40%' }
        ],
        pageRows,
        { striped: true }
      );

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Data Subject Rights (enhanced — DPO + International Compliance)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-rights .pdf-section__content');
      var d = compliance.dataSubjectRights || {};
      // API does not set d.score; use the computed dataRightsScore instead
      var score = d.score !== undefined ? d.score : dataRightsScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.rights', 'Data Subject Rights'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.rights', 'GDPR grants individuals specific rights over their personal data, including access, rectification, erasure, and portability. Your site must provide clear mechanisms for users to exercise these rights. This section checks for the availability of data subject rights mechanisms.')) + '</p>';

      // Rights overview — enhanced with DPO contact (matches web UI)
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.rights.overviewHeading', 'Rights Overview')) + '</h3>';

      var rows = [];
      rows.push([
        esc(t('reports.gdpr.dataRightsInformation', 'Data Rights Information')),
        (d.found || d.hasInfo) ? PR.renderStatus('pass', t('reports.gdpr.found', 'Found')) : PR.renderStatus('fail', t('reports.gdpr.missing', 'Missing'))
      ]);
      rows.push([
        esc(t('reports.gdpr.dpoPrivacyContact', 'DPO/Privacy Contact')),
        d.hasDPOContact ? PR.renderStatus('pass', t('reports.gdpr.found', 'Found')) : PR.renderStatus('warning', t('reports.gdpr.notFound', 'Not Found'))
      ]);

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '50%' },
          { label: t('seo.report.table.status', 'Status'), width: '50%' }
        ],
        rows,
        { striped: true }
      );

      // Metrics
      html += PR.renderMetrics([
        { value: (d.found || d.hasInfo) ? t('seo.report.status.yes', 'Yes') : t('seo.report.status.no', 'No'), label: t('reports.gdpr.dataRightsInformation', 'Data Rights Information'), color: (d.found || d.hasInfo) ? '#10b981' : '#ef4444' },
        { value: d.hasDPOContact ? t('seo.report.status.yes', 'Yes') : t('seo.report.status.no', 'No'), label: t('reports.gdpr.dpoPrivacyContact', 'DPO/Privacy Contact'), color: d.hasDPOContact ? '#10b981' : '#f59e0b' },
        { value: dataRightsScore, label: t('reports.gdpr.sections.dataSubjectRights', 'Data Subject Rights'), color: scoreColor(dataRightsScore) }
      ]);

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

      // International Compliance (matches web UI renderDataRightsContent)
      var intl = compliance.internationalCompliance || {};
      if (intl.gdpr !== undefined || intl.ccpa !== undefined) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.internationalCompliance', 'International Compliance')) + '</h3>';

        var intlRows = [];
        intlRows.push([
          '<strong>' + esc(t('reports.gdpr.gdprEU', 'GDPR (EU)')) + '</strong>',
          intl.gdpr ? PR.renderStatus('pass', t('common.pdf.status.pass', 'Pass')) : PR.renderStatus('fail', t('common.pdf.status.fail', 'Fail'))
        ]);
        intlRows.push([
          '<strong>' + esc(t('reports.gdpr.ccpaCalifornia', 'CCPA (California)')) + '</strong>',
          intl.ccpa ? PR.renderStatus('pass', t('common.pdf.status.pass', 'Pass')) : PR.renderStatus('na', t('reports.common.na', 'N/A'))
        ]);

        html += PR.renderTable(
          [
            { label: t('reports.gdpr.report.intl.framework', 'Framework'), width: '50%' },
            { label: t('seo.report.table.status', 'Status'), width: '50%' }
          ],
          intlRows,
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
       7. Cookie Audit (security attributes)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cookies .pdf-section__content');
      // Use the flattened cookieList built at the top from classified sub-arrays
      var cookies = Array.isArray(compliance.cookies) ? compliance.cookies : cookieList;
      // API returns trackers.detected as array of hostname strings, not objects.
      // Convert to objects for the tracker table renderer.
      var trackersRaw = trackersData.detected || trackersData.list || trackersData.details || [];
      var trackers = trackersRaw.map(function (tr) {
        if (typeof tr === 'string') {
          return { name: tr, domain: tr };
        }
        return tr;
      });

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.cookies', 'Cookie Audit'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.cookies', 'This cookie audit catalogs all cookies and tracking technologies found on your site. Each cookie is classified by purpose, security attributes, and regulatory category. Understanding your cookie landscape is essential for maintaining accurate consent mechanisms and privacy compliance.')) + '</p>';

      // Cookie metrics
      var secureCookies = cookies.filter(function (c) { return c.secure; }).length;
      var httpOnlyCookies = cookies.filter(function (c) { return c.httpOnly; }).length;

      html += PR.renderMetrics([
        { value: cookies.length, label: t('reports.gdpr.report.cookies.totalLabel', 'Total Cookies') },
        { value: secureCookies, label: t('reports.gdpr.report.cookies.secureLabel', 'Secure Cookies'), color: '#10b981' },
        { value: httpOnlyCookies, label: t('reports.gdpr.report.cookies.httpOnlyLabel', 'HttpOnly Cookies'), color: '#3b82f6' },
        { value: trackers.length || trackerCount, label: t('reports.gdpr.report.cookies.trackersLabel', 'Trackers Detected'), color: (trackers.length || trackerCount) > 0 ? '#f59e0b' : '#10b981' }
      ]);

      // Progress bar for secure cookies
      if (cookies.length > 0) {
        html += PR.renderProgress(
          t('reports.gdpr.report.cookies.secureCoverageLabel', 'Secure Cookie Coverage'),
          secureCookies, cookies.length
        );
        html += PR.renderProgress(
          t('reports.gdpr.report.cookies.httpOnlyCoverageLabel', 'HttpOnly Coverage'),
          httpOnlyCookies, cookies.length
        );
      }

      // Cookie details table
      if (cookies.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.cookies.detailsHeading', 'Cookie Details')) + '</h3>';
        var cookieRows = cookies.slice(0, 30).map(function (c) {
          // Handle both expiry (string) and expires (Unix timestamp number)
          var expiryDisplay = c.expiry || '';
          if (!expiryDisplay && c.expires !== undefined) {
            if (c.expires === -1 || c.expires === 0) {
              expiryDisplay = 'Session';
            } else if (typeof c.expires === 'number' && c.expires > 0) {
              try {
                expiryDisplay = new Date(c.expires * 1000).toLocaleDateString();
              } catch (e) {
                expiryDisplay = String(c.expires);
              }
            }
          }
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(c.name, 30)) + '</span>',
            '<span class="pdf-table__truncate">' + esc(truncate(c.domain || '', 25)) + '</span>',
            c.secure ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            c.httpOnly ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            esc(c.sameSite || 'None'),
            esc(expiryDisplay || '-')
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

      // Trackers table (enhanced with vendor/category/purpose — matches web UI)
      if (trackers.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.cookies.trackersHeading', 'Third-Party Trackers')) + '</h3>';
        var trackerRows = trackers.slice(0, 20).map(function (tr) {
          return [
            '<strong>' + esc(tr.name || tr.vendor || '-') + '</strong>',
            esc(tr.type || tr.category || '-'),
            esc(tr.purpose || '-'),
            '<span class="pdf-table__truncate">' + esc(truncate(tr.domain || '', 30)) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.gdpr.report.cookies.table.trackerName', 'Tracker'), width: '25%' },
            { label: t('reports.gdpr.report.cookies.table.trackerType', 'Category'), width: '20%' },
            { label: t('reports.gdpr.report.cookies.table.trackerPurpose', 'Purpose'), width: '25%' },
            { label: t('reports.gdpr.report.cookies.table.trackerDomain', 'Domain'), width: '30%' }
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
       8. Cookie Classification (NEW — matches web UI renderCookieAnalysisContent)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cookie-classification .pdf-section__content');
      if (!sec) return;

      var classified = cookiesData.classified || {};
      var hasClassified = Object.keys(classified).length > 0;
      var hasLifetimeData = cookiesData.sessionCount !== undefined || cookiesData.persistentCount !== undefined;

      if (!hasClassified && !hasLifetimeData) { sec.parentElement.style.display = 'none'; return; }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.cookieClassification', 'Cookie Classification'), cookieScore)),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.cookieClassification', 'Cookies are classified by purpose to help you understand which require consent under GDPR. Only strictly necessary cookies are exempt from consent requirements. All other categories (functional, analytics, marketing, social) require explicit user consent before being set.')) + '</p>';

      // Category breakdown table (matches web UI categories)
      if (hasClassified) {
        var categories = [
          { key: 'necessary', label: t('reports.gdpr.cookies.necessary', 'Necessary'), color: '#10b981' },
          { key: 'functional', label: t('reports.gdpr.cookies.functional', 'Functional'), color: '#3b82f6' },
          { key: 'analytics', label: t('reports.gdpr.cookies.analytics', 'Analytics'), color: '#f59e0b' },
          { key: 'marketing', label: t('reports.gdpr.cookies.marketing', 'Marketing'), color: '#ef4444' },
          { key: 'social', label: t('reports.gdpr.cookies.social', 'Social'), color: '#8b5cf6' },
          { key: 'unknown', label: t('reports.gdpr.cookies.unknown', 'Unknown'), color: '#6b7280' }
        ];

        var metricItems = [];
        categories.forEach(function (cat) {
          var count = (classified[cat.key] || []).length;
          metricItems.push({ value: count, label: cat.label, color: cat.color });
        });
        html += PR.renderMetrics(metricItems);

        var catRows = categories.map(function (cat) {
          var items = classified[cat.key] || [];
          return [
            '<span style="color:' + cat.color + ';font-weight:600;">' + esc(cat.label) + '</span>',
            '<strong>' + items.length + '</strong>',
            esc(cat.key === 'necessary' ? t('reports.gdpr.cookies.necessaryDesc', 'Required for basic site functionality') :
              cat.key === 'functional' ? t('reports.gdpr.cookies.functionalDesc', 'Preferences and settings') :
              cat.key === 'analytics' ? t('reports.gdpr.cookies.analyticsDesc', 'Usage tracking and statistics') :
              cat.key === 'marketing' ? t('reports.gdpr.cookies.marketingDesc', 'Advertising and targeting') :
              cat.key === 'social' ? t('reports.gdpr.cookies.socialDesc', 'Social media integrations') :
              t('reports.gdpr.cookies.unknownDesc', 'Unclassified cookies'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.gdpr.report.cookieClass.category', 'Category'), width: '25%' },
            { label: t('reports.gdpr.report.cookieClass.count', 'Count'), width: '15%' },
            { label: t('reports.gdpr.report.cookieClass.description', 'Description'), width: '60%' }
          ],
          catRows,
          { striped: true }
        );
      }

      // Session/Persistent/Long-lived breakdown (matches web UI)
      if (hasLifetimeData) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.report.cookieClass.lifetimeHeading', 'Cookie Lifetime Breakdown')) + '</h3>';
        html += PR.renderMetrics([
          { value: cookiesData.sessionCount || 0, label: t('reports.gdpr.sessionCookies', 'Session Cookies'), color: '#3b82f6' },
          { value: cookiesData.persistentCount || 0, label: t('reports.gdpr.persistentCookies', 'Persistent Cookies'), color: '#f59e0b' },
          { value: cookiesData.longLivedCount || 0, label: t('reports.gdpr.longLivedCookies', 'Long-lived (>1yr)'), color: (cookiesData.longLivedCount || 0) > 0 ? '#ef4444' : '#10b981' }
        ]);

        if ((cookiesData.longLivedCount || 0) > 0) {
          html += PR.renderCallout(
            t('reports.gdpr.longLivedDetected', 'Long-lived Cookies Detected'),
            t('reports.gdpr.longLivedDetectedDesc', 'GDPR recommends shorter cookie lifespans. Consider if cookies with >1 year expiration are necessary.'),
            'warning'
          );
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       9. Tracker Analysis (NEW — matches web UI renderTrackerAnalysisContent)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-tracker-analysis .pdf-section__content');
      if (!sec) return;

      var trackerClassified = trackersData.classified || {};
      var trackerDetectedList = trackersData.detected || [];
      var hasTrackerData = trackerCount > 0 || Object.keys(trackerClassified).length > 0;

      if (!hasTrackerData) { sec.parentElement.style.display = 'none'; return; }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.sections.trackerAnalysis', 'Tracker Analysis'), trackerScore)),
        sec
      );

      var html = '';
      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.trackerAnalysis', 'Third-party trackers collect user data and require explicit consent under GDPR. This section classifies detected trackers by category and evaluates their impact on user privacy. Reducing unnecessary trackers improves both compliance and page performance.')) + '</p>';

      // Tracker category breakdown (matches web UI categories)
      var trackerCats = [
        { key: 'analytics', label: t('reports.gdpr.trackers.analytics', 'Analytics'), color: '#3b82f6' },
        { key: 'advertising', label: t('reports.gdpr.trackers.advertising', 'Advertising'), color: '#ef4444' },
        { key: 'social', label: t('reports.gdpr.trackers.socialMedia', 'Social Media'), color: '#8b5cf6' },
        { key: 'customer', label: t('reports.gdpr.trackers.customerSupport', 'Customer Support'), color: '#10b981' },
        { key: 'heatmap', label: t('reports.gdpr.trackers.heatmaps', 'Heatmaps/Session Recording'), color: '#f59e0b' }
      ];

      if (Object.keys(trackerClassified).length > 0) {
        var tMetrics = trackerCats.map(function (cat) {
          var items = trackerClassified[cat.key] || [];
          return { value: items.length, label: cat.label, color: cat.color };
        });
        html += PR.renderMetrics(tMetrics);

        var tCatRows = trackerCats.map(function (cat) {
          var items = trackerClassified[cat.key] || [];
          var names = items.map(function (item) {
            return typeof item === 'string' ? item : (item.name || item.vendor || '');
          }).filter(Boolean).slice(0, 5);
          return [
            '<span style="color:' + cat.color + ';font-weight:600;">' + esc(cat.label) + '</span>',
            '<strong>' + items.length + '</strong>',
            names.length > 0 ? esc(names.join(', ')) + (items.length > 5 ? '...' : '') : '-'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.gdpr.report.trackerAnalysis.category', 'Category'), width: '30%' },
            { label: t('reports.gdpr.report.cookieClass.count', 'Count'), width: '15%' },
            { label: t('reports.gdpr.report.trackerAnalysis.trackers', 'Trackers'), width: '55%' }
          ],
          tCatRows,
          { striped: true }
        );
      }

      // Detected tracker names list (matches web UI tag display)
      if (trackerDetectedList.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.gdpr.detectedTrackers', 'Detected Trackers')) + '</h3>';
        var detectedRows = trackerDetectedList.slice(0, 20).map(function (tracker) {
          var name = typeof tracker === 'string' ? tracker : (tracker.name || tracker.vendor || '');
          return [
            '<strong>' + esc(name) + '</strong>',
            PR.renderStatus('warning', t('common.pdf.status.warning', 'Warning'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.gdpr.report.cookies.table.trackerName', 'Tracker'), width: '60%' },
            { label: t('seo.report.table.status', 'Status'), width: '40%' }
          ],
          detectedRows,
          { striped: true }
        );

        if (trackerDetectedList.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: trackerDetectedList.length - 20 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       10. Risk Assessment (enhanced — add detail + fine fields)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-risks .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.risks', 'Risk Assessment'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.risks', 'Risk assessment identifies potential compliance gaps and their severity. High-risk issues may expose your organization to regulatory enforcement action. This section prioritizes risks based on their potential impact and likelihood of regulatory scrutiny.')) + '</p>';

      // Risk severity metrics
      var critical = risks.filter(function (r) { return (r.severity || '').toLowerCase() === 'critical'; });
      var high = risks.filter(function (r) { return (r.severity || '').toLowerCase() === 'high'; });
      var medium = risks.filter(function (r) { return (r.severity || '').toLowerCase() === 'medium'; });
      var low = risks.filter(function (r) {
        var s = (r.severity || '').toLowerCase();
        return s === 'low' || (!s && (r.title || r.risk));
      });

      html += PR.renderMetrics([
        { value: critical.length, label: t('reports.gdpr.report.risks.critical', 'Critical'), color: critical.length > 0 ? '#ef4444' : '#10b981' },
        { value: high.length, label: t('reports.gdpr.report.risks.high', 'High'), color: high.length > 0 ? '#f97316' : '#10b981' },
        { value: medium.length, label: t('reports.gdpr.report.risks.medium', 'Medium'), color: medium.length > 0 ? '#f59e0b' : '#10b981' },
        { value: low.length, label: t('reports.gdpr.report.risks.low', 'Low'), color: low.length > 0 ? '#3b82f6' : '#10b981' }
      ]);

      // Risk cards grouped by severity — enhanced with detail + fine (matches web UI)
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
            var riskTitle = r.title || r.risk || '';
            var riskDetail = r.description || r.detail || '';
            var riskFine = r.fine || '';
            var riskCategory = r.category || '';
            html += '<div class="pdf-issue pdf-issue--' + (r.severity || 'medium').toLowerCase() + '">' +
              '<span class="pdf-issue__severity pdf-issue__severity--' + (r.severity || 'medium').toLowerCase() + '">' + esc(translateImpact(r.severity || 'medium')) + '</span>' +
              '<span class="pdf-issue__text"><strong>' + esc(riskTitle) + '</strong>' +
              (riskDetail ? '<br>' + esc(riskDetail) : '') +
              (riskFine ? '<br><em style="color:#6b7280;font-size:0.85em;">' + esc(t('reports.gdpr.potentialFine', 'Potential Fine:')) + ' ' + esc(riskFine) + '</em>' : '') +
              (riskCategory ? ' <em style="color:#6b7280;font-size:0.85em;">(' + esc(riskCategory) + ')</em>' : '') +
              '</span>' +
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
       11. Recommendations (enhanced — full fix cards with code + steps)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.gdpr.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.gdpr.report.sectionIntros.recommendations', 'Based on the GDPR compliance analysis, these recommendations prioritize the most critical compliance gaps to reduce regulatory risk and improve user privacy.')) + '</p>';

      if (recommendations.length > 0) {
        var recCritical = recommendations.filter(function (r) { return (r.priority || r.severity) === 'critical'; });
        var recHigh = recommendations.filter(function (r) { return (r.priority || r.severity) === 'high'; });
        var recMedium = recommendations.filter(function (r) { return (r.priority || r.severity) === 'medium'; });
        var recLow = recommendations.filter(function (r) {
          var p = r.priority || r.severity;
          return !p || p === 'low';
        });
        var groups = [
          { items: recCritical, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#ef4444', severity: 'critical' },
          { items: recHigh, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#f97316', severity: 'high' },
          { items: recMedium, label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: '#f59e0b', severity: 'medium' },
          { items: recLow, label: t('common.pdf.execSummary.lowPriority', 'Low Priority'), color: '#3b82f6', severity: 'low' }
        ];

        groups.forEach(function (group) {
          if (group.items.length === 0) return;
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:' + group.color + ';">&#9679; ' + group.label + ' (' + group.items.length + ')</div>';
          group.items.forEach(function (r) {
            var sevLower = (r.priority || r.severity || group.severity || 'medium').toLowerCase();
            var recTitle = r.title || r.message || '';
            var recDesc = r.description || r.detail || '';
            var recCategory = r.category || '';
            var recImpact = r.impact || '';

            // Full fix card (matches SEO pdf-fix-card pattern)
            html += '<div class="pdf-fix-card">';

            // Header: severity badge + title + category
            html += '<div class="pdf-fix-card__header">';
            var sevLabel = sevLower === 'critical' ? t('reports.common.severity.critical', 'Critical') :
              sevLower === 'high' ? t('reports.common.severity.high', 'High') :
              sevLower === 'medium' ? t('reports.common.severity.medium', 'Medium') :
              t('reports.common.severity.low', 'Low');
            html += '<span class="pdf-fix-card__severity pdf-fix-card__severity--' + sevLower + '">' + esc(sevLabel) + '</span>';
            html += '<span class="pdf-fix-card__title">' + esc(recTitle) + '</span>';
            if (recCategory) {
              html += '<span class="pdf-fix-card__category">' + esc(recCategory) + '</span>';
            }
            html += '</div>';

            // Body
            html += '<div class="pdf-fix-card__body">';

            // Description
            if (recDesc) {
              html += '<div class="pdf-fix-card__description">' + esc(recDesc) + '</div>';
            }

            // Impact (matches web UI Summary tab impact box)
            if (recImpact) {
              html += '<div class="pdf-fix-card__impact">';
              html += '<strong>' + esc(t('reports.common.fix.expectedImpact', 'Expected Impact')) + ':</strong> ' + esc(recImpact);
              html += '</div>';
            }

            // Code snippet (matches web UI Code tab)
            var codeSnippet = _getCodeSnippet(r);
            if (codeSnippet && codeSnippet !== recDesc) {
              html += '<div class="pdf-fix-card__code-grid">';
              html += '<div class="pdf-fix-card__code-block">';
              html += '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--good">' +
                esc(t('reports.common.recommendedImplementation', 'Recommended Implementation')) + '</div>';
              html += '<pre class="pdf-fix-card__code-pre">' + esc(codeSnippet) + '</pre>';
              html += '</div>';
              html += '</div>';
            }

            // Step-by-step fix guide (matches web UI Fix Guide tab)
            var steps = _getFixSteps(r);
            if (steps.length > 0) {
              html += '<div class="pdf-fix-card__steps">';
              html += '<div class="pdf-fix-card__steps-title">' +
                esc(t('reports.common.fix.stepByStepFix', 'Step-by-Step Fix:')) + '</div>';
              steps.forEach(function (step, idx) {
                // Strip HTML bold tags for PDF text
                var cleanStep = step.replace(/<\/?strong>/g, '');
                html += '<div class="pdf-fix-card__step">';
                html += '<span class="pdf-fix-card__step-num">' + (idx + 1) + '</span>';
                html += '<span>' + esc(cleanStep) + '</span>';
                html += '</div>';
              });
              html += '</div>';
            }

            html += '</div>'; // end body
            html += '</div>'; // end fix-card
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
