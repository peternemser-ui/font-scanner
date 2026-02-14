// GDPR Compliance Scanner Script
// Uses AnalyzerLoader for consistent loading UI

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'gdpr-compliance';
document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);

// Translation helper - evaluates at runtime to ensure i18n is loaded
function t(key, fallback, params = {}) {
  let value = fallback;
  if (window.i18n && typeof window.i18n.t === 'function') {
    const translated = window.i18n.t(key);
    if (translated !== key) {
      value = translated;
    }
  }
  if (params && typeof value === 'string') {
    Object.keys(params).forEach(param => {
      const regex = new RegExp(`\\{\\{?${param}\\}?\\}`, 'g');
      value = value.replace(regex, params[param]);
    });
  }
  return value;
}

// Client-side translation mapping for server-returned English strings
// Maps known risk/recommendation text to i18n keys
function translateRisk(risk) {
  if (!risk) return risk;
  const r = { ...risk };
  const riskMap = {
    'No cookie consent mechanism': 'reports.gdpr.risks.noConsentMechanism',
    'No easy reject option': 'reports.gdpr.risks.noRejectOption',
    'No privacy policy with data collection': 'reports.gdpr.risks.noPrivacyPolicy',
    'Pre-consent tracking cookies': 'reports.gdpr.risks.preConsentCookies',
    'Excessive third-party trackers': 'reports.gdpr.risks.excessiveTrackers',
    'Long-lived cookies detected': 'reports.gdpr.risks.longLivedCookies',
    'No data subject rights information': 'reports.gdpr.risks.noDataRights',
    'No HTTPS encryption': 'reports.gdpr.risks.noHttps',
    'Insecure payment collection': 'reports.gdpr.risks.insecurePayment',
    'Newsletter signup without explicit consent': 'reports.gdpr.risks.newsletterNoConsent',
    'No consent withdrawal instructions': 'reports.gdpr.risks.noConsentWithdrawal',
    'No data retention disclosure': 'reports.gdpr.risks.noDataRetention'
  };
  const detailMap = {
    'Cookie consent banner lacks an equally prominent reject option. GDPR requires consent to be as easy to withdraw as to give.': 'reports.gdpr.risks.noRejectOptionDetail',
    'No visible information about user rights (access, deletion, portability). GDPR requires clear communication of rights.': 'reports.gdpr.risks.noDataRightsDetail',
    'No clear information on how users can withdraw consent or delete their data.': 'reports.gdpr.risks.noConsentWithdrawalDetail',
    'No information about how long data is stored. GDPR Article 13(2)(a) requirement.': 'reports.gdpr.risks.noDataRetentionDetail',
    'Forms collecting data without HTTPS. GDPR Article 32 requires appropriate security measures.': 'reports.gdpr.risks.noHttpsDetail',
    'Credit card data collected without HTTPS. PCI DSS and GDPR violation.': 'reports.gdpr.risks.insecurePaymentDetail'
  };
  const fineMap = {
    'Up to €20 million or 4% of annual global revenue': 'reports.gdpr.risks.fine20m4pct',
    'Up to €10 million or 2% of annual revenue': 'reports.gdpr.risks.fine10m2pct',
    'Potential GDPR/ePrivacy violation': 'reports.gdpr.risks.fineGdprEprivacy',
    'Potential compliance issue': 'reports.gdpr.risks.fineComplianceIssue',
    'GDPR Article 7(3) violation': 'reports.gdpr.risks.fineArt7',
    'Up to €20 million + PCI DSS fines + potential data breach liability': 'reports.gdpr.risks.fine20mPci'
  };
  if (riskMap[r.risk]) r.risk = t(riskMap[r.risk], r.risk);
  if (detailMap[r.detail]) {
    r.detail = t(detailMap[r.detail], r.detail);
  } else if (r.detail) {
    // Handle parameterized detail strings from server
    const paramDetailMap = [
      { pattern: /^(\d+) cookies found but no consent mechanism detected/, key: 'reports.gdpr.risks.noConsentMechanismDetail', extract: (m) => ({ count: m[1] }) },
      { pattern: /^(\d+) analytics\/marketing cookies loaded before user consent/, key: 'reports.gdpr.risks.preConsentCookiesDetail', extract: (m) => ({ count: m[1] }) },
      { pattern: /^(\d+) trackers detected\. This increases/, key: 'reports.gdpr.risks.excessiveTrackersDetail', extract: (m) => ({ count: m[1] }) },
      { pattern: /^(\d+) cookies have expiration over 1 year/, key: 'reports.gdpr.risks.longLivedCookiesDetail', extract: (m) => ({ count: m[1] }) },
      { pattern: /Collecting email addresses without a visible privacy policy/, key: 'reports.gdpr.risks.noPrivacyPolicyDetail', extract: () => ({}) },
      { pattern: /^(\d+) newsletter forms without consent/, key: 'reports.gdpr.risks.newsletterNoConsentDetail', extract: (m) => ({ count: m[1] }) },
      { pattern: /^(\d+) trackers detected\. Ensure/, key: 'reports.gdpr.recs.controlTrackersDetail', extract: (m) => ({ count: m[1] }) }
    ];
    for (const entry of paramDetailMap) {
      const match = r.detail.match(entry.pattern);
      if (match) {
        r.detail = t(entry.key, r.detail, entry.extract(match));
        break;
      }
    }
  }
  if (fineMap[r.fine]) r.fine = t(fineMap[r.fine], r.fine);
  return r;
}

function translateRecommendation(rec) {
  if (!rec) return rec;
  const r = { ...rec };
  const msgMap = {
    'Implement GDPR-compliant cookie consent': 'reports.gdpr.recs.implCookieConsent',
    'Add reject/decline option to cookie banner': 'reports.gdpr.recs.addRejectOption',
    'Add granular consent options': 'reports.gdpr.recs.granularConsent',
    'Add privacy policy': 'reports.gdpr.recs.addPrivacyPolicy',
    'Add dedicated cookie policy': 'reports.gdpr.recs.addCookiePolicy',
    'Control third-party tracker loading': 'reports.gdpr.recs.controlTrackers',
    'Add data subject rights information': 'reports.gdpr.recs.addDataRights',
    'Add privacy contact information': 'reports.gdpr.recs.addPrivacyContact',
    'Consider CCPA compliance': 'reports.gdpr.recs.ccpaCompliance',
    'Implement HTTPS encryption': 'reports.gdpr.recs.implHttps',
    'Add consent checkboxes to newsletter signups': 'reports.gdpr.recs.consentCheckboxes',
    'Add consent withdrawal instructions': 'reports.gdpr.recs.addConsentWithdrawal',
    'Disclose data retention periods': 'reports.gdpr.recs.dataRetention',
    'Disclose international data transfers': 'reports.gdpr.recs.intlDataTransfers',
    'Consider age verification': 'reports.gdpr.recs.ageVerification'
  };
  const detailMap = {
    'Add a cookie consent banner using a compliant solution like Cookiebot, OneTrust, or Iubenda.': 'reports.gdpr.recs.implCookieConsentDetail',
    'Include a visible "Reject All" or "Only Necessary" button that is as prominent as the accept button.': 'reports.gdpr.recs.addRejectOptionDetail',
    'Allow users to select which cookie categories they accept (necessary, functional, analytics, marketing).': 'reports.gdpr.recs.granularConsentDetail',
    'Create and prominently link to a comprehensive privacy policy that explains data collection and processing.': 'reports.gdpr.recs.addPrivacyPolicyDetail',
    'Create a separate cookie policy page explaining what cookies are used and why.': 'reports.gdpr.recs.addCookiePolicyDetail',
    'Explain how users can request access to, correction of, or deletion of their data.': 'reports.gdpr.recs.addDataRightsDetail',
    'Provide a dedicated email or contact method for privacy-related inquiries.': 'reports.gdpr.recs.addPrivacyContactDetail',
    'If serving California residents, add "Do Not Sell My Personal Information" link.': 'reports.gdpr.recs.ccpaComplianceDetail',
    'Secure your website with SSL/TLS certificate. Required for GDPR Article 32 security measures.': 'reports.gdpr.recs.implHttpsDetail',
    'Include unchecked consent checkboxes for newsletter subscriptions. Pre-checked boxes are not valid consent.': 'reports.gdpr.recs.consentCheckboxesDetail',
    'Explain how users can withdraw consent or request data deletion. Should be as easy as giving consent.': 'reports.gdpr.recs.addConsentWithdrawalDetail',
    'Clearly state how long you keep user data and the criteria for determining retention periods.': 'reports.gdpr.recs.dataRetentionDetail',
    'If data is transferred outside the EU/EEA, explain the safeguards in place (Standard Contractual Clauses, etc.).': 'reports.gdpr.recs.intlDataTransfersDetail',
    'GDPR requires parental consent for children under 16 (13-16 depending on country). Consider adding age verification.': 'reports.gdpr.recs.ageVerificationDetail'
  };
  const impactMap = {
    'Required by law - prevents significant fines': 'reports.gdpr.recs.impactRequiredByLaw',
    'GDPR requires equally easy consent withdrawal': 'reports.gdpr.recs.impactEqualWithdrawal',
    'Best practice for GDPR compliance': 'reports.gdpr.recs.impactBestPractice',
    'Legal requirement for all websites collecting data': 'reports.gdpr.recs.impactLegalRequirement',
    'Improves transparency and compliance': 'reports.gdpr.recs.impactTransparency',
    'GDPR requires consent before tracking': 'reports.gdpr.recs.impactConsentBeforeTracking',
    'GDPR Article 12-23 requirement': 'reports.gdpr.recs.impactArt1223',
    'Improves user trust and compliance': 'reports.gdpr.recs.impactUserTrust',
    'Required for businesses serving California users': 'reports.gdpr.recs.impactCalifornia',
    'Essential for data protection and user trust': 'reports.gdpr.recs.impactDataProtection',
    'GDPR requires active, informed consent': 'reports.gdpr.recs.impactActiveConsent',
    'GDPR Article 7(3) requirement': 'reports.gdpr.recs.impactArt73',
    'GDPR Article 13(2)(a) transparency requirement': 'reports.gdpr.recs.impactArt132a',
    'GDPR Chapter V requirement': 'reports.gdpr.recs.impactChapterV',
    'GDPR Article 8 requirement if targeting children': 'reports.gdpr.recs.impactArt8'
  };
  const catMap = {
    'Cookie Consent': 'reports.gdpr.recs.catCookieConsent',
    'Legal Pages': 'reports.gdpr.recs.catLegalPages',
    'Trackers': 'reports.gdpr.recs.catTrackers',
    'Data Rights': 'reports.gdpr.recs.catDataRights',
    'Contact': 'reports.gdpr.recs.catContact',
    'International': 'reports.gdpr.recs.catInternational',
    'Security': 'reports.gdpr.recs.catSecurity',
    'Forms': 'reports.gdpr.recs.catForms',
    'Transparency': 'reports.gdpr.recs.catTransparency',
    'Child Protection': 'reports.gdpr.recs.catChildProtection'
  };
  if (msgMap[r.message]) r.message = t(msgMap[r.message], r.message);
  if (r.title && msgMap[r.title]) r.title = t(msgMap[r.title], r.title);
  if (detailMap[r.detail]) {
    r.detail = t(detailMap[r.detail], r.detail);
  } else if (r.detail) {
    const paramDetailMap = [
      { pattern: /^(\d+) trackers detected\. Ensure/, key: 'reports.gdpr.recs.controlTrackersDetail', extract: (m) => ({ count: m[1] }) }
    ];
    for (const entry of paramDetailMap) {
      const match = r.detail.match(entry.pattern);
      if (match) {
        r.detail = t(entry.key, r.detail, entry.extract(match));
        break;
      }
    }
  }
  if (impactMap[r.impact]) r.impact = t(impactMap[r.impact], r.impact);
  if (catMap[r.category]) r.category = t(catMap[r.category], r.category);
  // Translate priority labels
  const priorityMap = {
    'critical': 'reports.common.severity.critical',
    'high': 'reports.common.severity.high',
    'medium': 'reports.common.severity.medium',
    'low': 'reports.common.severity.low'
  };
  if (priorityMap[r.priority]) r.priorityLabel = t(priorityMap[r.priority], r.priority).toUpperCase();
  else r.priorityLabel = (r.priority || '').toUpperCase();
  return r;
}

// Function to get analysis steps with current translations
// Called at runtime to ensure i18n is loaded
function getAnalysisSteps() {
  return [
    { label: t('loader.initializingScan', 'Initializing scan'), detail: t('loader.connectingTarget', 'Connecting to target website...') },
    { label: t('loader.detectingCookies', 'Detecting cookies'), detail: t('loader.scanningCookies', 'Scanning for tracking cookies...') },
    { label: t('loader.findingConsentBanners', 'Finding consent banners'), detail: t('loader.checkingConsent', 'Checking for cookie consent mechanisms...') },
    { label: t('loader.analyzingPrivacyPolicy', 'Analyzing privacy policy'), detail: t('loader.scanningPrivacy', 'Scanning for privacy policy links...') },
    { label: t('loader.checkingTrackers', 'Checking third-party trackers'), detail: t('loader.detectingTracking', 'Detecting analytics and tracking scripts...') },
    { label: t('loader.generatingComplianceReport', 'Generating compliance report'), detail: t('loader.calculatingGdpr', 'Calculating GDPR risk assessment...') }
  ];
}

// Expose displayResults globally EARLY so report-ui.js can find it during billing return
// (function declarations are hoisted, so displayResults exists even though it's defined below)
window.displayResults = displayResults;

document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
});

// Initialize - check for stored report or auto-start scan
(async function initFromUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const reportId = params.get('report_id') || '';
  const autoUrl = params.get('url') || (typeof window.getUrlParameter === 'function' ? window.getUrlParameter() : '');
  const billingSuccess = params.get('billing_success') === 'true';
  const urlInput = document.getElementById('url');

  console.log('[GDPR] initFromUrlParams starting:', { reportId, autoUrl, billingSuccess });

  // If we have a report_id, set it immediately so hasAccess checks work
  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
  }

  // Fill URL input if we have a URL
  if (autoUrl && urlInput) {
    urlInput.value = autoUrl;
  }

  // If returning from billing, wait for billing return processing to complete
  // This ensures the purchase is verified before we try to display the report
  if (billingSuccess && !window.__smBillingReturnComplete) {
    console.log('[GDPR] Waiting for billing return processing...');
    await new Promise(resolve => {
      if (window.__smBillingReturnComplete) {
        resolve();
        return;
      }
      const handler = () => {
        window.removeEventListener('sm:billingReturnComplete', handler);
        resolve();
      };
      window.addEventListener('sm:billingReturnComplete', handler);
      // Timeout fallback in case event is missed
      setTimeout(() => {
        window.removeEventListener('sm:billingReturnComplete', handler);
        resolve();
      }, 5000);
    });
    console.log('[GDPR] Billing return processing complete');
    // After billing return, report-ui.js should have displayed the report
    // Show results container if it was hidden
    const results = document.getElementById('results');
    if (results) results.style.display = 'block';
    return;
  }

  // Recovery: Check sessionStorage for checkout data when billing params are missing from URL
  // This handles cases where Stripe redirect loses the URL parameters
  const checkoutReportId = sessionStorage.getItem('sm_checkout_report_id');
  const checkoutUrl = sessionStorage.getItem('sm_checkout_url');
  if (checkoutReportId && checkoutUrl && !billingSuccess && !reportId) {
    console.log('[GDPR] Found checkout data in sessionStorage, checking if purchase completed...', { checkoutReportId, checkoutUrl });

    // Fetch billing status to verify purchase
    if (window.ProReportBlock?.fetchBillingStatus) {
      await window.ProReportBlock.fetchBillingStatus(true);

      if (window.ProReportBlock.hasAccess(checkoutReportId)) {
        console.log('[GDPR] Purchase confirmed! Attempting to load stored report...');
        document.body.setAttribute('data-report-id', checkoutReportId);
        if (urlInput) urlInput.value = checkoutUrl;

        // Try to load from database storage
        if (window.ReportStorage) {
          const loaded = await window.ReportStorage.tryLoadAndDisplay(checkoutReportId, displayResults);
          if (loaded) {
            console.log('[GDPR] Stored report loaded successfully after recovery');
            const results = document.getElementById('results');
            if (results) results.style.display = 'block';
            sessionStorage.removeItem('sm_checkout_url');
            sessionStorage.removeItem('sm_checkout_report_id');
            return;
          }
        }

        // If no stored report, run scan with preserved report ID
        console.log('[GDPR] No stored report found, running scan with preserved report ID');
        sessionStorage.removeItem('sm_checkout_url');
        sessionStorage.removeItem('sm_checkout_report_id');
        setTimeout(() => analyze({ preserveReportId: true }), 500);
        return;
      } else {
        console.log('[GDPR] Purchase not confirmed, clearing checkout data');
        sessionStorage.removeItem('sm_checkout_url');
        sessionStorage.removeItem('sm_checkout_report_id');
      }
    }
  }

  // If we have a report_id (not from billing return), try to load the stored report first
  if (reportId && window.ReportStorage) {
    console.log('[GDPR] Checking for stored report:', reportId);

    // Fetch billing status to ensure we have access
    if (window.ProReportBlock?.fetchBillingStatus) {
      console.log('[GDPR] Fetching billing status for report recall...');
      await window.ProReportBlock.fetchBillingStatus(true);
      console.log('[GDPR] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportId));
    }

    const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displayResults);
    if (loaded) {
      console.log('[GDPR] Stored report loaded successfully');
      // Show results container
      const results = document.getElementById('results');
      if (results) results.style.display = 'block';
      return; // Don't auto-scan
    } else {
      console.log('[GDPR] No stored report found or failed to load');

      // If user has purchased this report but no stored data, auto-run scan
      if (autoUrl && window.ProReportBlock?.hasAccess && window.ProReportBlock.hasAccess(reportId)) {
        console.log('[GDPR] User has access but no stored report - auto-running scan');
        setTimeout(() => {
          analyze({ preserveReportId: true });
        }, 500);
        return;
      }
    }
  }

  // Auto-start scan if URL parameter is present and no report_id
  if (autoUrl && !reportId) {
    setTimeout(() => {
      analyze();
    }, 500);
  }
})();

// Analysis steps are now defined by getAnalysisSteps() function above

async function analyze(options = {}) {
  const url = document.getElementById('url').value.trim();
  if (!url) {
    alert(t('reports.common.pleaseEnterUrl', 'Please enter a URL'));
    return;
  }

  // If this is a recovery scan (after purchase), preserve the report ID
  // Otherwise, clear old report ID when starting a NEW scan
  if (!options.preserveReportId) {
    document.body.removeAttribute('data-report-id');
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.has('report_id')) {
      currentParams.delete('report_id');
      currentParams.delete('billing_success');
      const cleanUrl = `${window.location.pathname}${currentParams.toString() ? `?${currentParams.toString()}` : ''}`;
      window.history.replaceState({}, document.title, cleanUrl);
      console.log('[GDPR] Cleared old report_id for new scan');
    }
  } else {
    console.log('[GDPR] Preserving report_id for recovery scan:', document.body.getAttribute('data-report-id'));
  }

  const results = document.getElementById('results');
  const btn = document.getElementById('analyzeBtn');

  results.style.display = 'none';
  btn.disabled = true;

  const loader = new AnalyzerLoader('loadingContainer');

  const loaderMessageEl = document.createElement('div');
  loaderMessageEl.id = 'patience-message';
  loaderMessageEl.style.cssText = `
    margin: 0 0 1.5rem 0;
    padding: clamp(0.75rem, 2vw, 1rem);
    background: rgba(var(--accent-primary-rgb), 0.05);
    border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
    border-radius: 6px;
    text-align: center;
    overflow: visible;
  `;
  loaderMessageEl.innerHTML = `
    <p style="margin: 0.75rem 0 0 0; font-size: clamp(0.75rem, 2.5vw, 0.9rem); color: var(--accent-primary); font-weight: 600;">
      ${t('reports.gdpr.loader.scanInProgress', 'GDPR compliance scan in progress...')}
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(var(--accent-primary-rgb), 0.7);">
      ${t('reports.gdpr.loader.mayTake', 'This may take 30-45 seconds')}
    </p>
  `;

  loader.start(getAnalysisSteps(), '🔒 ' + t('loader.analyzingGdpr', 'GDPR COMPLIANCE SCANNER'), 40);

  const loadingContainer = document.getElementById('loadingContainer');
  const analyzerLoading = loadingContainer.querySelector('.analyzer-loading');
  if (analyzerLoading) {
    analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
  }

  try {
    loader.nextStep(1);

    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/gdpr-compliance', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, scanStartedAt })
    });

    loader.nextStep(2);
    loader.nextStep(3);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.code === 'SCAN_QUOTA_EXCEEDED') {
        const limit = errorData.scansLimit || 10;
        loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
        return;
      }
      throw new Error(errorData.message || errorData.error || t('reports.common.analysisFailed', 'Analysis failed'));
    }
    const data = await response.json();

    loader.nextStep(4);
    loader.nextStep(5);
    loader.complete();

    displayResults(data);
    results.style.display = 'block';
    window.__REPORT_READY__ = true;
    window.dispatchEvent(new CustomEvent('report:ready'));

  } catch (error) {
    alert(t('reports.common.error', 'Error: {{message}}', { message: error.message }));
    loader.complete();
  } finally {
    btn.disabled = false;
  }
}

function getScoreColor(score) {
  if (score >= 90) return '#22c55e';  // Excellent: Green
  if (score >= 75) return '#00bcd4';  // Good: Teal
  if (score >= 50) return '#ffa500';  // Needs Work: Orange
  return '#ff4444';                   // Critical: Red
}

function getAccentPrimaryHex() {
  const computed = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-primary')
    .trim();
  if (computed) return computed;

  const isLight = document.body?.classList?.contains('white-theme');
  return isLight ? '#dd3838' : '#5bf4e7';
}

function getGrade(score) {
  if (score >= 90) return t('reports.common.status.excellent', 'Excellent');
  if (score >= 75) return t('reports.common.status.good', 'Good');
  if (score >= 50) return t('reports.common.needsWork', 'Needs Work');
  return t('reports.common.status.critical', 'Critical');
}

function getGradeLetter(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 50) return 'C';
  return 'F';
}

function displayResults(data) {
  if (!data || typeof data !== 'object' || typeof data === 'string') { console.error('[GDPR] displayResults received invalid data:', data); return; }
  const results = document.getElementById('results');
  const score = data.score || 0;
  const cookieScore = data.compliance?.cookies?.count <= 5 ? 100 : Math.max(0, 100 - (data.compliance?.cookies?.count - 5) * 5);
  const consentScore = data.compliance?.cookieConsent?.detected ? (data.compliance?.cookieConsent?.hasKnownLibrary ? 100 : 70) : 0;
  const privacyScore = data.compliance?.privacyPolicy?.hasLink ? 100 : 0;
  const trackerScore = data.compliance?.trackers?.count === 0 ? 100 : Math.max(0, 100 - data.compliance?.trackers?.count * 10);
  const consentQuality = data.consentQuality || { score: 0 };

  // Generate report ID for pro features
  const url = document.getElementById('url')?.value || '';
  const scanStartedAt = data.scanStartedAt || window.SM_SCAN_STARTED_AT || new Date().toISOString();
  const analyzerKey = window.SM_ANALYZER_KEY || 'gdpr-compliance';

  // For recalled scans (loaded from storage), report_id would be on the body attribute
  // For new scans, we generate a fresh one (URL params are cleared at start of analyze())
  const preservedReportId = document.body.getAttribute('data-report-id') || '';

  // Use preserved report_id if available (recalled report), otherwise generate new one
  let reportId = preservedReportId || null;
  if (!reportId) {
    if (window.ReportUI && typeof window.ReportUI.makeReportId === 'function') {
      reportId = window.ReportUI.makeReportId({
        analyzerKey,
        normalizedUrl: data.url || url,
        startedAtISO: scanStartedAt
      });
    } else if (window.ReportUI && typeof window.ReportUI.computeReportId === 'function') {
      reportId = window.ReportUI.computeReportId(data.url || url, scanStartedAt, analyzerKey);
    } else {
      reportId = data.reportId || `gdpr_${btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
    }
  }

  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    results.setAttribute('data-sm-report-id', reportId);
    console.log('[GDPR] displayResults set reportId:', reportId);
  } else {
    console.warn('[GDPR] displayResults: No reportId generated!', {
      url: data.url || url,
      scanStartedAt,
      analyzerKey,
      hasReportUI: !!window.ReportUI
    });
  }

  // Set screenshot URL from API response
  const screenshotUrl = data.screenshotUrl || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');
  if (screenshotUrl) {
    document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
  }
  const screenshots = screenshotUrl ? [{ src: screenshotUrl, alt: t('reports.common.screenshotOf', 'Screenshot of {{url}}', { url: data.url || url }), device: '' }] : [];

  // Check if report is unlocked (follows SEO pattern - checks both new and legacy billing)
  const isUnlocked = !!(
    // Pro/Day Pass subscribers have global access (no reportId needed)
    (window.ProReportBlock && typeof window.ProReportBlock.isProSubscriber === 'function' && window.ProReportBlock.isProSubscriber()) ||
    (reportId && (
      // New billing model: purchased single report
      (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function' && window.ProReportBlock.hasAccess(reportId)) ||
      // Legacy CreditsManager
      (window.CreditsManager && (
        (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) ||
        (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId))
      ))
    ))
  );
  console.log('[GDPR] isUnlocked check:', { reportId, isUnlocked, hasProReportBlock: !!window.ProReportBlock });

  // Calculate legal pages score
  const legalPagesScore = (data.compliance?.privacyPolicy?.hasLink ? 40 : 0) +
    (data.compliance?.cookiePolicy?.hasLink ? 30 : 0) +
    (data.compliance?.termsOfService?.hasLink ? 30 : 0);

  // Calculate data rights score
  const dataRightsScore = (data.compliance?.dataSubjectRights?.hasInfo ? 60 : 0) +
    (data.compliance?.dataSubjectRights?.hasDPOContact ? 40 : 0);

  // Build summary donuts (following SEO pattern - use short, consistent labels)
  const summary = [
    { label: t('reports.gdpr.summary.overall', 'Overall'), score: score },
    { label: t('reports.gdpr.summary.consent', 'Consent'), score: consentScore },
    { label: t('reports.gdpr.summary.privacy', 'Privacy'), score: privacyScore },
    { label: t('reports.gdpr.summary.trackers', 'Trackers'), score: trackerScore },
    { label: t('reports.gdpr.summary.legal', 'Legal'), score: legalPagesScore },
    { label: t('reports.gdpr.summary.rights', 'Rights'), score: dataRightsScore }
  ];

  // Build accordion sections array (following SEO pattern)
  const sections = [
    // Cookie Consent Quality Accordion
    {
      id: 'consent-quality',
      title: t('reports.gdpr.sections.consentQuality', 'Cookie Consent Quality'),
      scoreTextRight: `${Math.round(consentQuality.score)}/100`,
      contentHTML: renderConsentQualityContent(data)
    },
    // Cookie Analysis Accordion
    {
      id: 'cookie-analysis',
      title: t('reports.gdpr.sections.cookieAnalysis', 'Cookie Analysis'),
      scoreTextRight: `${Math.round(cookieScore)}/100`,
      contentHTML: renderCookieAnalysisContent(data.compliance?.cookies)
    },
    // Tracker Analysis Accordion
    data.compliance?.trackers ? {
      id: 'tracker-analysis',
      title: t('reports.gdpr.sections.trackerAnalysis', 'Tracker Analysis'),
      scoreTextRight: `${Math.round(trackerScore)}/100`,
      contentHTML: renderTrackerAnalysisContent(data.compliance?.trackers)
    } : null,
    // Legal Pages Accordion
    {
      id: 'legal-pages',
      title: t('reports.gdpr.sections.legalPages', 'Legal Pages'),
      scoreTextRight: `${Math.round(legalPagesScore)}/100`,
      contentHTML: renderLegalPagesContent(data.compliance)
    },
    // Data Rights Accordion
    {
      id: 'data-rights',
      title: t('reports.gdpr.sections.dataSubjectRights', 'Data Subject Rights'),
      scoreTextRight: `${Math.round(dataRightsScore)}/100`,
      contentHTML: renderDataRightsContent(data.compliance)
    },
    // Compliance Risks Accordion
    (data.risks && data.risks.length > 0) ? {
      id: 'risks',
      title: t('reports.gdpr.sections.complianceRisks', 'Compliance Risks') + ` (${data.risks.length})`,
      contentHTML: renderRisksContent(data.risks.map(translateRisk))
    } : null,
    // Report and Recommendations Accordion (Pro) - follows SEO pattern
    (data.recommendations && data.recommendations.length > 0) ? {
      id: 'report-recommendations',
      title: t('reports.gdpr.sections.fixCodeRecommendations', 'Recommendations'),
      isPro: true,
      locked: !isUnlocked,
      context: 'gdpr-compliance',
      reportId: reportId,
      contentHTML: renderGdprProFixes(data.recommendations.map(translateRecommendation))
    } : null
  ].filter(Boolean);

  // Use ReportContainer.create() for consistent rendering (like SEO)
  if (window.ReportContainer && typeof window.ReportContainer.create === 'function') {
    const reportHTML = window.ReportContainer.create({
      url: data.url || url,
      timestamp: data.timestamp || scanStartedAt,
      mode: 'gdpr-compliance',
      title: t('reports.gdpr.title', 'GDPR Compliance Report'),
      subtitle: '',
      summary,
      sections,
      screenshots,
      proBlock: true,
      proBlockOptions: {
        context: 'gdpr-compliance',
        features: ['pdf', 'excel', 'csv', 'share'],
        title: t('reports.common.unlockReport', 'Unlock Report'),
        subtitle: t('reports.common.unlockSubtitle', 'PDF export, share link, export data, and fix packs for this scan.'),
        reportId
      }
    });
    // Wrap in report-scope for proper CSS styling of accordions
    results.innerHTML = `<div class="report-scope">${reportHTML}</div>`;
  } else {
    // Fallback: manual rendering with report-scope wrapper
    let fallbackHTML = `<div class="report-header"><h1 class="report-header__title">${t('reports.gdpr.title', 'GDPR Compliance Report')}</h1></div>`;
    sections.forEach(section => {
      if (window.ReportAccordion && window.ReportAccordion.createSection) {
        fallbackHTML += window.ReportAccordion.createSection(section);
      }
    });
    results.innerHTML = `<div class="report-scope">${fallbackHTML}</div>`;
  }

  // Initialize ReportAccordion interactions
  if (window.ReportAccordion && typeof window.ReportAccordion.initInteractions === 'function') {
    window.ReportAccordion.initInteractions();
  }

  // Update paywall UI
  if (window.ReportUI && reportId) {
    window.ReportUI.setCurrentReportId(reportId);
  }

  if (window.CreditsManager && reportId) {
    const render = window.CreditsManager.renderPaywallState || window.CreditsManager.updateProUI;
    if (typeof render === 'function') render(reportId);
  }

  // If already unlocked, reveal pro content
  if (isUnlocked) {
    revealGdprProContent();
  }

  // Listen for unlock events
  if (!window.__gdprUnlockListenerAttached) {
    window.__gdprUnlockListenerAttached = true;
    window.addEventListener('reportUnlocked', (e) => {
      const unlockedId = e && e.detail ? e.detail.reportId : '';
      if (!unlockedId || unlockedId !== document.body.getAttribute('data-report-id')) return;

      // Replace the Fix Code section body with the full content
      const body = document.querySelector('[data-accordion-body="report-recommendations"]');
      if (body && window.__gdprCurrentData) {
        body.innerHTML = renderGdprProFixes((window.__gdprCurrentData.recommendations || []).map(translateRecommendation));
      }

      revealGdprProContent();

      if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
        window.CreditsManager.renderPaywallState(unlockedId);
      }
    });
  }

  // Store data for unlock handler
  window.__gdprCurrentData = data;

  // Auto-save report snapshot if user has access (Pro or purchased)
  if (reportId && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
    window.ReportStorage.autoSaveIfEligible(reportId, data, {
      siteUrl: data.url || url,
      analyzerType: 'gdpr-compliance',
      scannedAt: scanStartedAt
    });
  }
}

// Expose displayResults globally so report-ui.js can use it for billing return
window.displayResults = displayResults;

/**
 * Reveal pro content when unlocked
 */
function revealGdprProContent() {
  document.querySelectorAll('.report-accordion--locked').forEach(el => {
    el.classList.remove('report-accordion--locked');
  });
  document.querySelectorAll('[data-pro-locked]').forEach(el => {
    el.removeAttribute('data-pro-locked');
  });

  // Remove locked state from Pro Report Blocks (show accent border after unlock)
  document.querySelectorAll('.pro-report-block--locked, .pro-report-block[data-locked]').forEach((block) => {
    block.classList.remove('pro-report-block--locked');
    block.removeAttribute('data-locked');
  });
}

/**
 * Preview content for locked recommendations (follows SEO pattern)
 */
function getGdprRecommendationsPreview(recommendations = []) {
  const critical = recommendations.filter(r => r.priority === 'critical').length;
  const high = recommendations.filter(r => r.priority === 'high').length;
  const medium = recommendations.filter(r => r.priority === 'medium').length;

  const previewItems = [];
  if (critical > 0) previewItems.push(t('reports.gdpr.preview.criticalIssues', '{{count}} critical compliance issues', { count: critical }));
  if (high > 0) previewItems.push(t('reports.gdpr.preview.highPriorityFixes', '{{count}} high-priority fixes', { count: high }));
  if (medium > 0) previewItems.push(t('reports.gdpr.preview.mediumPriorityImprovements', '{{count}} medium-priority improvements', { count: medium }));

  if (previewItems.length === 0) {
    previewItems.push(
      t('reports.gdpr.preview.gdprRecommendations', 'GDPR compliance recommendations'),
      t('reports.gdpr.preview.cookieConsentImprovements', 'Cookie consent improvements'),
      t('reports.gdpr.preview.privacyPolicySuggestions', 'Privacy policy suggestions')
    );
  }

  return `
    <div style="padding: 1rem;">
      <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
        ${t('reports.common.unlockToView', 'Unlock to view:')}
      </p>
      <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary);">
        ${previewItems.slice(0, 3).map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
  `;
}

/**
 * Render GDPR Pro Fixes with accordion-style tabs (follows SEO pattern)
 */
function renderGdprProFixes(recommendations) {
  ensureGdprFixStyles();
  const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
  const sorted = [...recommendations].sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  const fixCount = sorted.length;

  if (fixCount === 0) {
    return `
      <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">✓</span> ${t('reports.gdpr.excellentCompliance', 'Excellent Compliance!')}
        </h3>
        <p style="color: #86efac; margin: 0;">${t('reports.gdpr.excellentComplianceDesc', 'Your site follows GDPR best practices. Keep monitoring for continued compliance.')}</p>
      </div>
    `;
  }

  const improvementsText = fixCount !== 1
    ? t('reports.gdpr.improvementsFoundPlural', '{{count}} improvements found', { count: fixCount })
    : t('reports.gdpr.improvementsFoundSingular', '{{count}} improvement found', { count: fixCount });

  return `
    <div class="gdpr-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">🔍</span> ${t('reports.gdpr.complianceFixes', 'Compliance Fixes')}
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${improvementsText})</span>
      </h3>
      <div class="gdpr-fixes-list">
        ${sorted.map((rec, index) => renderGdprFixAccordion(rec, index)).join('')}
      </div>
    </div>
  `;
}

function renderGdprFixAccordion(rec, index) {
  const accordionId = `gdprfix-${rec.id || index}`;
  const severityColors = {
    critical: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
    high: { bg: 'rgba(255,140,0,0.1)', border: '#ff8c00', color: '#ff8c00', icon: '🟠' },
    medium: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟡' },
    low: { bg: 'rgba(128,128,128,0.1)', border: '#808080', color: '#808080', icon: '🟢' }
  };
  const style = severityColors[rec.priority] || severityColors.medium;
  const category = rec.category || t('reports.gdpr.privacyCompliance', 'Privacy Compliance');

  return `
    <div class="gdpr-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="gdpr-fix-header" data-action="toggle-accordion" data-accordion-id="${accordionId}" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        cursor: pointer;
        transition: background 0.2s;
      ">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.25rem;">${style.icon}</span>
          <div>
            <h4 style="margin: 0; font-size: 1rem; color: #fff;">${rec.message || rec.title}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">${category}</p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            background: ${style.color}20;
            color: ${style.color};
            border: 1px solid ${style.color}40;
          ">${rec.priorityLabel || rec.priority.toUpperCase()}</span>
          <span class="gdpr-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="gdpr-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderGdprFixTabs(rec, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderGdprFixTabs(rec, accordionId) {
  return `
    <div class="gdpr-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="gdpr-fix-tab active" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">${t('reports.common.tabs.summary', 'Summary')}</button>
      <button class="gdpr-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="code" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">${t('reports.common.tabs.code', 'Code')}</button>
      <button class="gdpr-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">${t('reports.common.tabs.fixGuide', 'Fix Guide')}</button>
    </div>

    <!-- Summary Tab -->
    <div class="gdpr-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: #ccc; line-height: 1.7; margin: 0 0 1rem 0;">
        ${rec.detail || rec.description || rec.message}
      </p>
      ${rec.impact ? `
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">${t('reports.common.fix.expectedImpact', 'Expected Impact')}</div>
        <div style="color: #c0c0c0; font-size: 0.9rem;">${rec.impact}</div>
      </div>
      ` : ''}
    </div>

    <!-- Code Tab -->
    <div class="gdpr-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Recommended Action -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">${t('reports.common.recommendedImplementation', 'Recommended Implementation')}</span>
            <button data-action="copy-code" data-copy-target="${accordionId}-action" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">${t('reports.common.copy', 'Copy')}</button>
          </div>
          <pre id="${accordionId}-action" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeHtmlGdpr(getGdprCodeSnippet(rec))}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="gdpr-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">${t('reports.common.fix.stepByStepFix', 'Step-by-Step Fix:')}</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
        ${getGdprDefaultSteps(rec).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
    </div>
  `;
}

function getGdprCodeSnippet(rec) {
  const messageLC = (rec.message || '').toLowerCase();
  const categoryLC = (rec.category || '').toLowerCase();
  const combined = messageLC + ' ' + categoryLC;

  // Data Subject Rights
  if (combined.includes('data subject') || combined.includes('rights information')) {
    return `<!-- Data Subject Rights Section (GDPR Article 15-22) -->
<section id="your-rights" class="privacy-section">
  <h2>Your Data Rights</h2>
  <p>Under GDPR, you have the following rights:</p>

  <div class="rights-grid">
    <div class="right-item">
      <h3>📋 Right of Access (Art. 15)</h3>
      <p>Request a copy of all personal data we hold about you.</p>
      <a href="/data-request?type=access" class="btn">Request My Data</a>
    </div>

    <div class="right-item">
      <h3>✏️ Right to Rectification (Art. 16)</h3>
      <p>Request correction of inaccurate personal data.</p>
      <a href="/data-request?type=rectification" class="btn">Correct My Data</a>
    </div>

    <div class="right-item">
      <h3>🗑️ Right to Erasure (Art. 17)</h3>
      <p>Request deletion of your personal data ("right to be forgotten").</p>
      <a href="/data-request?type=erasure" class="btn">Delete My Data</a>
    </div>

    <div class="right-item">
      <h3>📦 Right to Data Portability (Art. 20)</h3>
      <p>Receive your data in a machine-readable format.</p>
      <a href="/data-request?type=portability" class="btn">Export My Data</a>
    </div>
  </div>

  <p><strong>Response Time:</strong> We will respond within 30 days.</p>
  <p><strong>Contact:</strong> privacy@yourcompany.com</p>
</section>`;
  }

  // Privacy Contact Information
  if (combined.includes('privacy contact') || combined.includes('contact information')) {
    return `<!-- Privacy Contact Section -->
<section id="privacy-contact" class="privacy-section">
  <h2>Privacy Contact Information</h2>

  <div class="contact-details">
    <div class="contact-item">
      <h3>Data Controller</h3>
      <p>Your Company Name Ltd.</p>
      <p>123 Business Street, City, Country</p>
      <p>Registration: Company #12345678</p>
    </div>

    <div class="contact-item">
      <h3>Data Protection Officer</h3>
      <p>Name: [DPO Name]</p>
      <p>Email: dpo@yourcompany.com</p>
      <p>Phone: +1 (555) 123-4567</p>
    </div>

    <div class="contact-item">
      <h3>Privacy Inquiries</h3>
      <p>Email: privacy@yourcompany.com</p>
      <p>Response time: Within 48 hours</p>
      <a href="/privacy-request" class="btn">Submit Privacy Request</a>
    </div>
  </div>

  <h3>Supervisory Authority</h3>
  <p>You have the right to lodge a complaint with your local
     data protection authority if you believe your data
     has been processed unlawfully.</p>
</section>`;
  }

  // Consent Withdrawal
  if (combined.includes('consent withdrawal') || combined.includes('withdraw consent')) {
    return `<!-- Consent Withdrawal Section (GDPR Article 7) -->
<section id="withdraw-consent" class="privacy-section">
  <h2>Withdraw Your Consent</h2>
  <p>You can withdraw consent at any time. This is as easy as
     giving consent in the first place.</p>

  <div class="withdrawal-options">
    <div class="option">
      <h3>🍪 Cookie Preferences</h3>
      <p>Manage your cookie settings at any time:</p>
      <button data-action="open-cookie-settings" class="btn">
        Manage Cookies
      </button>
    </div>

    <div class="option">
      <h3>📧 Marketing Communications</h3>
      <p>Unsubscribe from marketing emails:</p>
      <a href="/unsubscribe" class="btn">Unsubscribe</a>
      <p class="note">Or click "Unsubscribe" at the bottom of any email</p>
    </div>

    <div class="option">
      <h3>🗑️ Delete All My Data</h3>
      <p>Request complete deletion of your account and data:</p>
      <a href="/data-request?type=erasure" class="btn btn-danger">
        Delete My Account
      </a>
    </div>
  </div>

  <p class="legal-note"><strong>Note:</strong> Withdrawing consent does
     not affect the lawfulness of processing based on consent
     before withdrawal.</p>
</section>`;
  }

  // Data Retention
  if (combined.includes('data retention') || combined.includes('retention period')) {
    return `<!-- Data Retention Disclosure (GDPR Article 13/14) -->
<section id="data-retention" class="privacy-section">
  <h2>Data Retention Periods</h2>
  <p>We retain your data only as long as necessary:</p>

  <table class="retention-table">
    <thead>
      <tr>
        <th>Data Type</th>
        <th>Retention Period</th>
        <th>Reason</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Account Information</td>
        <td>Until account deletion + 30 days</td>
        <td>Service provision</td>
      </tr>
      <tr>
        <td>Transaction Records</td>
        <td>7 years</td>
        <td>Legal/tax requirements</td>
      </tr>
      <tr>
        <td>Analytics Data</td>
        <td>26 months</td>
        <td>Service improvement</td>
      </tr>
      <tr>
        <td>Support Tickets</td>
        <td>3 years after resolution</td>
        <td>Quality assurance</td>
      </tr>
      <tr>
        <td>Marketing Consent</td>
        <td>Until withdrawn</td>
        <td>Consent record</td>
      </tr>
      <tr>
        <td>Server Logs</td>
        <td>90 days</td>
        <td>Security monitoring</td>
      </tr>
    </tbody>
  </table>

  <p>After retention periods expire, data is securely deleted
     or anonymized within 30 days.</p>
</section>`;
  }

  // Age Verification
  if (combined.includes('age verification') || combined.includes('child') || combined.includes('minor')) {
    return `<!-- Age Verification (GDPR Article 8 - Child's Consent) -->
<section id="age-verification" class="privacy-section">
  <h2>Age Verification</h2>
  <p>Our service is intended for users 16 years or older.
     If you are under 16, parental consent is required.</p>

  <!-- Age Gate Implementation -->
  <div id="age-gate" class="age-gate-modal">
    <h3>Please Verify Your Age</h3>
    <p>You must be at least 16 years old to use this service.</p>

    <div class="age-verification-form">
      <label>Date of Birth:</label>
      <input type="date" id="dob" name="dob" required>

      <button data-action="verify-age" class="btn">Verify Age</button>
    </div>

    <p class="under-age-notice" style="display:none;">
      <strong>Under 16?</strong>
      Please ask a parent or guardian to create an account
      on your behalf.
      <a href="/parental-consent">Parental Consent Form</a>
    </p>
  </div>

  <script>
  function verifyAge() {
    const dob = new Date(document.getElementById('dob').value);
    const age = Math.floor((Date.now() - dob) / 31557600000);
    if (age >= 16) {
      localStorage.setItem('ageVerified', 'true');
      document.getElementById('age-gate').style.display = 'none';
    } else {
      document.querySelector('.under-age-notice').style.display = 'block';
    }
  }
  </script>
</section>`;
  }

  // Cookie Consent
  if (combined.includes('cookie consent') || combined.includes('cookie banner')) {
    return `<!-- GDPR-Compliant Cookie Consent Banner -->
<div id="cookie-consent" class="cookie-banner">
  <div class="cookie-content">
    <h3>🍪 We value your privacy</h3>
    <p>We use cookies to enhance your experience.
       You can accept all, reject non-essential,
       or customize your preferences.</p>

    <div class="cookie-categories">
      <label><input type="checkbox" checked disabled>
        Essential (required)</label>
      <label><input type="checkbox" id="analytics">
        Analytics</label>
      <label><input type="checkbox" id="marketing">
        Marketing</label>
    </div>

    <div class="cookie-buttons">
      <button data-action="accept-all" class="btn btn-primary">
        Accept All
      </button>
      <button data-action="reject-non-essential" class="btn btn-secondary">
        Reject All
      </button>
      <button data-action="save-preferences" class="btn btn-outline">
        Save Preferences
      </button>
    </div>

    <p class="cookie-links">
      <a href="/cookie-policy">Cookie Policy</a> |
      <a href="/privacy-policy">Privacy Policy</a>
    </p>
  </div>
</div>`;
  }

  // Privacy Policy
  if (combined.includes('privacy policy')) {
    return `<!-- Privacy Policy Structure (GDPR Articles 13-14) -->
<article class="privacy-policy">
  <h1>Privacy Policy</h1>
  <p>Last updated: [DATE]</p>

  <section>
    <h2>1. Data Controller</h2>
    <p>Your Company Ltd., [Address], [Contact]</p>
  </section>

  <section>
    <h2>2. Data We Collect</h2>
    <ul>
      <li>Identity data (name, email)</li>
      <li>Usage data (pages visited, interactions)</li>
      <li>Technical data (IP, browser, device)</li>
    </ul>
  </section>

  <section>
    <h2>3. Legal Basis for Processing</h2>
    <ul>
      <li><strong>Consent:</strong> Marketing communications</li>
      <li><strong>Contract:</strong> Service delivery</li>
      <li><strong>Legitimate Interest:</strong> Analytics, security</li>
    </ul>
  </section>

  <section>
    <h2>4. Your Rights</h2>
    <p>Access, rectification, erasure, portability,
       restriction, objection.</p>
    <p>Contact: privacy@yourcompany.com</p>
  </section>

  <section>
    <h2>5. Data Retention</h2>
    <p>[See retention schedule above]</p>
  </section>
</article>`;
  }

  // Default fallback with helpful info
  return rec.detail || rec.description || t('reports.gdpr.codeSnippet.defaultFallback', `Review and implement the GDPR compliance requirement.

Key considerations:
• Document your data processing activities
• Ensure lawful basis for processing
• Implement appropriate security measures
• Enable user rights (access, deletion, portability)
• Keep records of consent`);
}

function getGdprDefaultSteps(rec) {
  const messageLC = (rec.message || '').toLowerCase();
  const categoryLC = (rec.category || '').toLowerCase();
  const combined = messageLC + ' ' + categoryLC;

  // Data Subject Rights
  if (combined.includes('data subject') || combined.includes('rights information')) {
    return [
      t('reports.gdpr.fixGuide.dataSubjectRights.step1', '<strong>Create a "Your Rights" page</strong> - Add a dedicated page explaining all GDPR rights (access, rectification, erasure, portability, restriction, objection)'),
      t('reports.gdpr.fixGuide.dataSubjectRights.step2', '<strong>Add request forms</strong> - Create online forms for each right type with clear submission process'),
      t('reports.gdpr.fixGuide.dataSubjectRights.step3', '<strong>Set up handling process</strong> - Define internal workflow for responding to requests within 30 days'),
      t('reports.gdpr.fixGuide.dataSubjectRights.step4', '<strong>Train your team</strong> - Ensure staff know how to verify identity and process different request types'),
      t('reports.gdpr.fixGuide.dataSubjectRights.step5', '<strong>Link prominently</strong> - Add links to rights page in footer, privacy policy, and account settings'),
      t('reports.gdpr.fixGuide.dataSubjectRights.step6', '<strong>Document everything</strong> - Keep records of all requests received and how they were handled')
    ];
  }

  // Privacy Contact
  if (combined.includes('privacy contact') || combined.includes('contact information')) {
    return [
      t('reports.gdpr.fixGuide.privacyContact.step1', '<strong>Designate a DPO</strong> - Appoint a Data Protection Officer if required (public authority, large-scale processing, special categories)'),
      t('reports.gdpr.fixGuide.privacyContact.step2', '<strong>Create contact page</strong> - Add dedicated privacy contact section with email, phone, and postal address'),
      t('reports.gdpr.fixGuide.privacyContact.step3', '<strong>Set up privacy email</strong> - Create a dedicated privacy@yourcompany.com inbox monitored daily'),
      t('reports.gdpr.fixGuide.privacyContact.step4', '<strong>Define response SLA</strong> - Commit to responding to privacy inquiries within 48 hours'),
      t('reports.gdpr.fixGuide.privacyContact.step5', '<strong>Add to privacy policy</strong> - Include full contact details in your privacy policy header'),
      t('reports.gdpr.fixGuide.privacyContact.step6', '<strong>Provide escalation path</strong> - List supervisory authority contact for users who want to lodge complaints')
    ];
  }

  // Consent Withdrawal
  if (combined.includes('consent withdrawal') || combined.includes('withdraw consent')) {
    return [
      t('reports.gdpr.fixGuide.consentWithdrawal.step1', '<strong>Add cookie settings link</strong> - Provide a persistent "Cookie Settings" link in footer to re-open consent dialog'),
      t('reports.gdpr.fixGuide.consentWithdrawal.step2', '<strong>Email unsubscribe</strong> - Include one-click unsubscribe in all marketing emails (not just a preferences link)'),
      t('reports.gdpr.fixGuide.consentWithdrawal.step3', '<strong>Account settings</strong> - Add privacy preferences section in user account with toggle switches'),
      t('reports.gdpr.fixGuide.consentWithdrawal.step4', '<strong>Make it equally easy</strong> - GDPR requires withdrawal to be as easy as giving consent - no dark patterns'),
      t('reports.gdpr.fixGuide.consentWithdrawal.step5', '<strong>Process immediately</strong> - Withdrawal should take effect instantly, not "within 24 hours"'),
      t('reports.gdpr.fixGuide.consentWithdrawal.step6', '<strong>Keep consent records</strong> - Log when consent was given AND when it was withdrawn for compliance')
    ];
  }

  // Data Retention
  if (combined.includes('data retention') || combined.includes('retention period')) {
    return [
      t('reports.gdpr.fixGuide.dataRetention.step1', '<strong>Audit your data</strong> - List all types of personal data you collect and where it\'s stored'),
      t('reports.gdpr.fixGuide.dataRetention.step2', '<strong>Define retention periods</strong> - Set specific timeframes for each data type based on legal/business need'),
      t('reports.gdpr.fixGuide.dataRetention.step3', '<strong>Document justification</strong> - Record why you need to keep data for the stated period'),
      t('reports.gdpr.fixGuide.dataRetention.step4', '<strong>Implement auto-deletion</strong> - Set up automated processes to delete data when retention expires'),
      t('reports.gdpr.fixGuide.dataRetention.step5', '<strong>Publish retention schedule</strong> - Add a clear table in your privacy policy showing all retention periods'),
      t('reports.gdpr.fixGuide.dataRetention.step6', '<strong>Review annually</strong> - Schedule yearly review of retention periods to ensure they\'re still justified')
    ];
  }

  // Age Verification
  if (combined.includes('age verification') || combined.includes('child') || combined.includes('minor')) {
    return [
      t('reports.gdpr.fixGuide.ageVerification.step1', '<strong>Determine your age threshold</strong> - GDPR default is 16, but varies by country (UK: 13, Germany: 16, etc.)'),
      t('reports.gdpr.fixGuide.ageVerification.step2', '<strong>Add age gate</strong> - Implement age verification before account creation or data collection'),
      t('reports.gdpr.fixGuide.ageVerification.step3', '<strong>Parental consent flow</strong> - Create process for users under threshold to get parent/guardian approval'),
      t('reports.gdpr.fixGuide.ageVerification.step4', '<strong>Verify parental consent</strong> - Implement reasonable method to verify guardian identity'),
      t('reports.gdpr.fixGuide.ageVerification.step5', '<strong>Child-friendly language</strong> - If children can use your service, ensure privacy info is age-appropriate'),
      t('reports.gdpr.fixGuide.ageVerification.step6', '<strong>Special data protection</strong> - Minimize data collection from minors and never use for marketing')
    ];
  }

  // Cookie Consent
  if (combined.includes('cookie') || combined.includes('consent')) {
    return [
      t('reports.gdpr.fixGuide.cookieConsent.step1', '<strong>Choose a CMP</strong> - Select a GDPR-compliant Consent Management Platform (Cookiebot, OneTrust, etc.)'),
      t('reports.gdpr.fixGuide.cookieConsent.step2', '<strong>Scan your cookies</strong> - Audit all cookies set by your site and categorize them (essential, analytics, marketing)'),
      t('reports.gdpr.fixGuide.cookieConsent.step3', '<strong>Equal prominence</strong> - Show Accept and Reject buttons with equal visual weight - no dark patterns'),
      t('reports.gdpr.fixGuide.cookieConsent.step4', '<strong>Block until consent</strong> - Ensure non-essential cookies are blocked until explicit consent is given'),
      t('reports.gdpr.fixGuide.cookieConsent.step5', '<strong>Granular control</strong> - Allow users to accept/reject by category, not just all-or-nothing'),
      t('reports.gdpr.fixGuide.cookieConsent.step6', '<strong>Test thoroughly</strong> - Use browser DevTools to verify no cookies are set before consent')
    ];
  }

  // Privacy Policy
  if (combined.includes('privacy policy')) {
    return [
      t('reports.gdpr.fixGuide.privacyPolicy.step1', '<strong>Use a template</strong> - Start with a GDPR-compliant template and customize for your business'),
      t('reports.gdpr.fixGuide.privacyPolicy.step2', '<strong>Required disclosures</strong> - Include: data controller, DPO contact, data types, legal basis, retention, rights, transfers'),
      t('reports.gdpr.fixGuide.privacyPolicy.step3', '<strong>Plain language</strong> - Write in clear, understandable terms - avoid legal jargon where possible'),
      t('reports.gdpr.fixGuide.privacyPolicy.step4', '<strong>Layered approach</strong> - Provide a summary at top with links to detailed sections below'),
      t('reports.gdpr.fixGuide.privacyPolicy.step5', '<strong>Version control</strong> - Date your policy and keep archives of previous versions'),
      t('reports.gdpr.fixGuide.privacyPolicy.step6', '<strong>Prominent placement</strong> - Link in footer, signup forms, checkout, and consent banner')
    ];
  }

  // Tracker
  if (combined.includes('tracker')) {
    return [
      t('reports.gdpr.fixGuide.tracker.step1', '<strong>Audit all scripts</strong> - Use a tool like Ghostery or browser DevTools to identify all third-party trackers'),
      t('reports.gdpr.fixGuide.tracker.step2', '<strong>Document each tracker</strong> - List what data each tracker collects and for what purpose'),
      t('reports.gdpr.fixGuide.tracker.step3', '<strong>Remove unnecessary</strong> - Delete any trackers you don\'t actively use or need'),
      t('reports.gdpr.fixGuide.tracker.step4', '<strong>Implement consent</strong> - Ensure trackers only fire after user consent is given'),
      t('reports.gdpr.fixGuide.tracker.step5', '<strong>Update privacy policy</strong> - List all third-party processors in your privacy policy'),
      t('reports.gdpr.fixGuide.tracker.step6', '<strong>Data Processing Agreements</strong> - Ensure you have DPAs with all third-party tracker providers')
    ];
  }

  // Default
  return [
    t('reports.gdpr.fixGuide.default.step1', '<strong>Identify the gap</strong> - Review exactly what GDPR requirement is not being met'),
    t('reports.gdpr.fixGuide.default.step2', '<strong>Research requirements</strong> - Consult GDPR Articles 12-23 for specific user rights requirements'),
    t('reports.gdpr.fixGuide.default.step3', '<strong>Implement the fix</strong> - Make the necessary changes to your website and processes'),
    t('reports.gdpr.fixGuide.default.step4', '<strong>Document changes</strong> - Keep records of what was changed and when for accountability'),
    t('reports.gdpr.fixGuide.default.step5', '<strong>Test compliance</strong> - Verify the implementation works as expected'),
    t('reports.gdpr.fixGuide.default.step6', '<strong>Schedule review</strong> - Set a reminder to review this compliance area annually')
  ];
}

// Toggle accordion
function toggleGdprFixAccordion(accordionId) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);
  const icon = accordion?.querySelector('.gdpr-fix-expand-icon');

  if (!accordion || !content) return;

  const isExpanded = accordion.classList.contains('expanded');

  if (isExpanded) {
    accordion.classList.remove('expanded');
    content.style.maxHeight = '0';
    if (icon) icon.style.transform = 'rotate(0deg)';
  } else {
    accordion.classList.add('expanded');
    content.style.maxHeight = content.scrollHeight + 'px';
    if (icon) icon.style.transform = 'rotate(180deg)';
  }
}

// Switch tabs
function switchGdprFixTab(accordionId, tabName) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;

  const tabs = accordion.querySelectorAll('.gdpr-fix-tab');
  const contents = accordion.querySelectorAll('.gdpr-fix-tab-content');

  tabs.forEach(tab => {
    tab.style.background = 'transparent';
    tab.style.color = '#aaa';
    tab.style.borderColor = 'rgba(255,255,255,0.1)';
    tab.classList.remove('active');
  });
  contents.forEach(content => {
    content.style.display = 'none';
    content.classList.remove('active');
  });

  const activeTab = Array.from(tabs).find(tab => tab.getAttribute('data-tab') === tabName);
  const activeContent = document.getElementById(`${accordionId}-${tabName}`);

  if (activeTab) {
    activeTab.style.background = 'rgba(255,255,255,0.1)';
    activeTab.style.color = '#fff';
    activeTab.style.borderColor = 'rgba(255,255,255,0.2)';
    activeTab.classList.add('active');
  }
  if (activeContent) {
    activeContent.style.display = 'block';
    activeContent.classList.add('active');
  }

  // Update accordion height
  const content = document.getElementById(`${accordionId}-content`);
  if (content && accordion.classList.contains('expanded')) {
    setTimeout(() => {
      content.style.maxHeight = content.scrollHeight + 'px';
    }, 50);
  }
}

window.toggleGdprFixAccordion = toggleGdprFixAccordion;
window.switchGdprFixTab = switchGdprFixTab;

// Add click event delegation for GDPR fix accordions and tabs
document.addEventListener('click', function(e) {
  // Handle tab clicks first
  const tab = e.target.closest('.gdpr-fix-tab');
  if (tab) {
    const accordion = tab.closest('.gdpr-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      const tabName = tab.getAttribute('data-tab') || 'summary';
      if (fixId && typeof window.switchGdprFixTab === 'function') {
        e.preventDefault();
        e.stopPropagation();
        window.switchGdprFixTab(fixId, tabName);
      }
    }
    return;
  }
  // Handle accordion header clicks
  const header = e.target.closest('.gdpr-fix-header');
  if (header) {
    const accordion = header.closest('.gdpr-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      if (fixId && typeof window.toggleGdprFixAccordion === 'function') {
        window.toggleGdprFixAccordion(fixId);
      }
    }
  }
});

// Copy code
function copyGdprCode(elementId) {
  const codeElement = document.getElementById(elementId);
  if (!codeElement) return;

  const text = codeElement.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = codeElement.parentElement.querySelector('button');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✓ ' + t('common.copied', 'Copied!');
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  });
}

function ensureGdprFixStyles() {
  if (document.getElementById('gdpr-fixes-styles')) return;
  const style = document.createElement('style');
  style.id = 'gdpr-fixes-styles';
  style.textContent = `
    .gdpr-fix-accordion.expanded .gdpr-fix-expand-icon {
      transform: rotate(180deg);
    }
    .gdpr-fix-header:hover {
      background: rgba(255,255,255,0.03);
    }
  `;
  document.head.appendChild(style);
}

function escapeHtmlGdpr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderConsentQualityContent(data) {
  const quality = data.consentQuality || { score: 0, factors: [] };
  const consent = data.compliance?.cookieConsent || {};

  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 1rem 0; font-size: 1rem;">&gt;&gt; ${t('reports.gdpr.consentImplementationQuality', 'Consent Implementation Quality')}</h3>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 2rem; font-weight: bold; color: ${getScoreColor(quality.score)};">${quality.score}</div>
          <div style="color: #808080; font-size: 0.85rem;">${t('reports.gdpr.qualityScore', 'Quality Score')}</div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 2rem; font-weight: bold; color: ${getScoreColor(quality.score)};">${quality.grade || t('reports.common.na', 'N/A')}</div>
          <div style="color: #808080; font-size: 0.85rem;">${t('reports.common.grade', 'Grade')}</div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.2rem; font-weight: bold; color: #00d9ff;">${consent.detectedLibrary || t('reports.common.none', 'None')}</div>
          <div style="color: #808080; font-size: 0.85rem;">${t('reports.gdpr.consentLibrary', 'Consent Library')}</div>
        </div>
      </div>

      <h4 style="color: #c0c0c0; margin: 1rem 0 0.75rem 0;">${t('reports.gdpr.qualityFactors', 'Quality Factors')}</h4>
      <div style="display: grid; gap: 0.5rem;">
        ${(quality.factors || []).map(f => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; border-left: 3px solid ${f.status === 'pass' ? 'var(--accent-primary)' : f.status === 'warn' ? '#ffa500' : '#ff4444'};">
            <span style="color: #ffffff;">${f.name}</span>
            <span style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: ${f.status === 'pass' ? 'var(--accent-primary)' : f.status === 'warn' ? '#ffa500' : '#ff4444'}; font-weight: bold;">${f.points}/${f.name.includes('reject') ? 25 : f.name.includes('library') ? 15 : 20}</span>
              <span style="color: ${f.status === 'pass' ? 'var(--accent-primary)' : f.status === 'warn' ? '#ffa500' : '#ff4444'};">${f.status === 'pass' ? '✓' : f.status === 'warn' ? '~' : '✗'}</span>
            </span>
          </div>
        `).join('')}
      </div>

      ${!consent.hasRejectOption && consent.detected ? `
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(255, 68, 68, 0.1); border: 1px solid rgba(255, 68, 68, 0.3); border-radius: 8px;">
          <strong style="color: #ff4444;">${t('reports.gdpr.missingRejectOption', 'Missing Reject Option')}</strong>
          <p style="margin: 0.5rem 0 0 0; color: #c0c0c0; font-size: 0.9rem;">${t('reports.gdpr.missingRejectOptionDesc', 'GDPR requires an equally prominent "Reject" or "Decline" button. Users must be able to refuse cookies as easily as accepting them.')}</p>
        </div>
      ` : ''}
    </div>
  `;
}

function renderCookieAnalysisContent(cookies) {
  if (!cookies) return `<p style="color: #808080;">${t('reports.gdpr.noCookieData', 'No cookie data available')}</p>`;

  const classified = cookies.classified || {};
  const categories = [
    { key: 'necessary', label: t('reports.gdpr.cookies.necessary', 'Necessary'), color: 'var(--accent-primary)', desc: t('reports.gdpr.cookies.necessaryDesc', 'Required for basic site functionality') },
    { key: 'functional', label: t('reports.gdpr.cookies.functional', 'Functional'), color: '#00d9ff', desc: t('reports.gdpr.cookies.functionalDesc', 'Preferences and settings') },
    { key: 'analytics', label: t('reports.gdpr.cookies.analytics', 'Analytics'), color: '#ffa500', desc: t('reports.gdpr.cookies.analyticsDesc', 'Usage tracking and statistics') },
    { key: 'marketing', label: t('reports.gdpr.cookies.marketing', 'Marketing'), color: '#ff4444', desc: t('reports.gdpr.cookies.marketingDesc', 'Advertising and targeting') },
    { key: 'social', label: t('reports.gdpr.cookies.social', 'Social'), color: '#9933ff', desc: t('reports.gdpr.cookies.socialDesc', 'Social media integrations') },
    { key: 'unknown', label: t('reports.gdpr.cookies.unknown', 'Unknown'), color: '#808080', desc: t('reports.gdpr.cookies.unknownDesc', 'Unclassified cookies') }
  ];

  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 1rem 0; font-size: 1rem;">&gt;&gt; ${t('reports.gdpr.cookieClassification', 'Cookie Classification')}</h3>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        ${categories.map(cat => {
          const count = classified[cat.key]?.length || 0;
          return `
            <div style="background: linear-gradient(135deg, ${cat.color}15 0%, ${cat.color}05 100%); border: 1px solid ${cat.color}40; padding: 1rem; border-radius: 8px; text-align: center;">
              <div style="font-size: 2rem; font-weight: bold; color: ${cat.color};">${count}</div>
              <div style="color: #ffffff; font-weight: 600; font-size: 0.9rem;">${cat.label}</div>
              <div style="color: #808080; font-size: 0.75rem; margin-top: 0.25rem;">${cat.desc}</div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #00d9ff;">${cookies.sessionCount || 0}</div>
          <div style="color: #808080; font-size: 0.85rem;">${t('reports.gdpr.sessionCookies', 'Session Cookies')}</div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #ffa500;">${cookies.persistentCount || 0}</div>
          <div style="color: #808080; font-size: 0.85rem;">${t('reports.gdpr.persistentCookies', 'Persistent Cookies')}</div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #ff4444;">${cookies.longLivedCount || 0}</div>
          <div style="color: #808080; font-size: 0.85rem;">${t('reports.gdpr.longLivedCookies', 'Long-lived (>1yr)')}</div>
        </div>
      </div>

      ${cookies.longLivedCount > 0 ? `
        <div style="padding: 1rem; background: rgba(255, 140, 0, 0.1); border: 1px solid rgba(255, 140, 0, 0.3); border-radius: 8px;">
          <strong style="color: #ffa500;">${t('reports.gdpr.longLivedDetected', 'Long-lived Cookies Detected')}</strong>
          <p style="margin: 0.5rem 0 0 0; color: #c0c0c0; font-size: 0.9rem;">${t('reports.gdpr.longLivedDetectedDesc', 'GDPR recommends shorter cookie lifespans. Consider if cookies with >1 year expiration are necessary.')}</p>
        </div>
      ` : ''}
    </div>
  `;
}

function renderTrackerAnalysisContent(trackers) {
  if (!trackers) return `<p style="color: #808080;">${t('reports.gdpr.noTrackerData', 'No tracker data available')}</p>`;

  const classified = trackers.classified || {};
  const categories = [
    { key: 'analytics', label: t('reports.gdpr.trackers.analytics', 'Analytics'), color: '#00d9ff' },
    { key: 'advertising', label: t('reports.gdpr.trackers.advertising', 'Advertising'), color: '#ff4444' },
    { key: 'social', label: t('reports.gdpr.trackers.socialMedia', 'Social Media'), color: '#9933ff' },
    { key: 'customer', label: t('reports.gdpr.trackers.customerSupport', 'Customer Support'), color: 'var(--accent-primary)' },
    { key: 'heatmap', label: t('reports.gdpr.trackers.heatmaps', 'Heatmaps/Session Recording'), color: '#ffa500' }
  ];

  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 1rem 0; font-size: 1rem;">&gt;&gt; ${t('reports.gdpr.thirdPartyTrackers', 'Third-Party Trackers')} (${trackers.count})</h3>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        ${categories.map(cat => {
          const items = classified[cat.key] || [];
          return `
            <div style="background: rgba(0, 0, 0, 0.3); border-left: 3px solid ${cat.color}; padding: 1rem; border-radius: 4px;">
              <div style="color: ${cat.color}; font-weight: 600; margin-bottom: 0.5rem;">${cat.label}</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: #ffffff;">${items.length}</div>
            </div>
          `;
        }).join('')}
      </div>

      ${trackers.detected && trackers.detected.length > 0 ? `
        <h4 style="color: #c0c0c0; margin: 1rem 0 0.75rem 0;">${t('reports.gdpr.detectedTrackers', 'Detected Trackers')}</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${trackers.detected.map(tracker => `
            <span style="background: rgba(255, 140, 0, 0.1); border: 1px solid rgba(255, 140, 0, 0.3); padding: 0.5rem 1rem; border-radius: 4px; font-size: 0.85rem; color: #ffa500;">${tracker}</span>
          `).join('')}
        </div>
      ` : `<p style="color: var(--accent-primary);">${t('reports.gdpr.noTrackersDetected', 'No third-party trackers detected')}</p>`}
    </div>
  `;
}

function renderLegalPagesContent(compliance) {
  const pages = [
    { key: 'privacyPolicy', label: t('reports.gdpr.legalPages.privacyPolicy', 'Privacy Policy'), required: true },
    { key: 'cookiePolicy', label: t('reports.gdpr.legalPages.cookiePolicy', 'Cookie Policy'), required: false },
    { key: 'termsOfService', label: t('reports.gdpr.legalPages.termsOfService', 'Terms of Service'), required: false }
  ];

  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 1rem 0; font-size: 1rem;">&gt;&gt; ${t('reports.gdpr.legalPageDetection', 'Legal Page Detection')}</h3>

      <div style="display: grid; gap: 0.75rem;">
        ${pages.map(p => {
          const data = compliance?.[p.key] || {};
          const hasLink = data.hasLink;
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border-left: 3px solid ${hasLink ? 'var(--accent-primary)' : p.required ? '#ff4444' : '#ffa500'};">
              <div>
                <span style="color: #ffffff; font-weight: 600;">${p.label}</span>
                ${p.required ? `<span style="color: #ff4444; font-size: 0.75rem; margin-left: 0.5rem;">${t('reports.gdpr.required', 'Required')}</span>` : ''}
              </div>
              <span style="color: ${hasLink ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${hasLink ? t('reports.gdpr.found', 'Found') : t('reports.gdpr.missing', 'Missing')}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderDataRightsContent(compliance) {
  const rights = compliance?.dataSubjectRights || {};
  const international = compliance?.internationalCompliance || {};

  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 1rem 0; font-size: 1rem;">&gt;&gt; ${t('reports.gdpr.dataSubjectRightsTitle', 'Data Subject Rights (GDPR Articles 12-23)')}</h3>

      <div style="display: grid; gap: 0.75rem; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border-left: 3px solid ${rights.hasInfo ? 'var(--accent-primary)' : '#ff4444'};">
          <span style="color: #ffffff;">${t('reports.gdpr.dataRightsInformation', 'Data Rights Information')}</span>
          <span style="color: ${rights.hasInfo ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${rights.hasInfo ? t('reports.gdpr.found', 'Found') : t('reports.gdpr.missing', 'Missing')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border-left: 3px solid ${rights.hasDPOContact ? 'var(--accent-primary)' : '#ffa500'};">
          <span style="color: #ffffff;">${t('reports.gdpr.dpoPrivacyContact', 'DPO/Privacy Contact')}</span>
          <span style="color: ${rights.hasDPOContact ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">${rights.hasDPOContact ? t('reports.gdpr.found', 'Found') : t('reports.gdpr.notFound', 'Not Found')}</span>
        </div>
      </div>

      <h4 style="color: #c0c0c0; margin: 1rem 0 0.75rem 0;">${t('reports.gdpr.internationalCompliance', 'International Compliance')}</h4>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; color: ${international.gdpr ? 'var(--accent-primary)' : '#ff4444'};">${international.gdpr ? '✓' : '✗'}</div>
          <div style="color: #ffffff; font-weight: 600;">${t('reports.gdpr.gdprEU', 'GDPR (EU)')}</div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; color: ${international.ccpa ? 'var(--accent-primary)' : '#808080'};">${international.ccpa ? '✓' : '—'}</div>
          <div style="color: #ffffff; font-weight: 600;">${t('reports.gdpr.ccpaCalifornia', 'CCPA (California)')}</div>
        </div>
      </div>
    </div>
  `;
}

function renderRisksContent(risks) {
  const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
  const sorted = risks.sort((a, b) => priorityOrder[a.severity] - priorityOrder[b.severity]);

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case 'critical': return t('reports.common.severity.critical', 'Critical');
      case 'high': return t('reports.common.severity.high', 'High');
      case 'medium': return t('reports.common.severity.medium', 'Medium');
      case 'low': return t('reports.common.severity.low', 'Low');
      default: return severity;
    }
  };

  return `
    <div>
      <h3 style="color: #ff4444; margin: 0 0 1rem 0; font-size: 1rem;">&gt;&gt; ${t('reports.gdpr.complianceRisksTitle', 'Compliance Risks')}</h3>

      <div style="display: grid; gap: 1rem;">
        ${sorted.map(risk => `
          <div style="padding: 1.25rem; background: ${risk.severity === 'critical' ? 'rgba(255,68,68,0.15)' : risk.severity === 'high' ? 'rgba(255,140,0,0.15)' : 'rgba(255,215,0,0.1)'}; border-left: 4px solid ${risk.severity === 'critical' ? '#ff4444' : risk.severity === 'high' ? '#ff8c00' : '#ffd700'}; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h4 style="margin: 0; color: ${risk.severity === 'critical' ? '#ff4444' : risk.severity === 'high' ? '#ff8c00' : '#ffd700'};">${risk.risk}</h4>
              <span style="background: ${risk.severity === 'critical' ? '#ff4444' : risk.severity === 'high' ? '#ff8c00' : '#ffd700'}; color: #000; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">${getSeverityLabel(risk.severity)}</span>
            </div>
            <p style="margin: 0 0 0.5rem 0; color: #c0c0c0;">${risk.detail}</p>
            <p style="margin: 0; color: #808080; font-size: 0.85rem; font-style: italic;">${t('reports.gdpr.potentialFine', 'Potential Fine:')} ${risk.fine}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderItem(label, hasIt) {
  return `
    <div style="padding: 0.75rem; background: rgba(255, 255, 255, 0.03); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
      <span>${label}</span>
      <span style="color: ${hasIt ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${hasIt ? '' : ''}</span>
    </div>
  `;
}

function getColor(grade) {
  return { 'A': getAccentPrimaryHex(), 'B': '#ffd700', 'C': '#ff8c00', 'F': '#ff4444' }[grade] || '#888';
}