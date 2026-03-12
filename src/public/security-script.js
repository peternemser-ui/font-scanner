// Security Analyzer JavaScript
// Frontend rendering and API interaction for security analysis

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'security';

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

// Translation helpers for backend data
function translateRiskLevel(risk) {
  if (!risk) return t('reports.security.low', 'Low');
  const riskLower = risk.toLowerCase();
  if (riskLower === 'high') return t('reports.security.high', 'High');
  if (riskLower === 'medium') return t('reports.security.medium', 'Medium');
  if (riskLower === 'low') return t('reports.security.low', 'Low');
  if (riskLower === 'critical') return t('reports.security.critical', 'Critical');
  return risk; // fallback to original if unknown
}

// Cookie issue translations map
function translateCookieIssue(issue) {
  const issueMap = {
    'Missing HttpOnly flag': t('reports.security.cookieIssues.missingHttpOnly', 'Missing HttpOnly flag'),
    'Missing Secure flag': t('reports.security.cookieIssues.missingSecure', 'Missing Secure flag'),
    'Missing SameSite attribute': t('reports.security.cookieIssues.missingSameSite', 'Missing SameSite attribute'),
    'SameSite=None requires Secure': t('reports.security.cookieIssues.sameSiteNoneSecure', 'SameSite=None requires Secure'),
    'Session cookie without HttpOnly': t('reports.security.cookieIssues.sessionNoHttpOnly', 'Session cookie without HttpOnly'),
    'Insecure SameSite value': t('reports.security.cookieIssues.insecureSameSite', 'Insecure SameSite value'),
    'Weak SameSite policy': t('reports.security.cookieIssues.weakSameSite', 'Weak SameSite policy'),
    'No cookies are properly secured': t('reports.security.cookieIssues.noneSecured', 'No cookies are properly secured'),
    'Some cookies are vulnerable to XSS (missing HttpOnly)': t('reports.security.cookieIssues.vulnerableXss', 'Some cookies are vulnerable to XSS (missing HttpOnly)'),
    'Some cookies can be transmitted over HTTP (missing Secure)': t('reports.security.cookieIssues.transmittedHttp', 'Some cookies can be transmitted over HTTP (missing Secure)')
  };
  return issueMap[issue] || issue;
}

// Vulnerability title translations map (server sends English titles)
function translateVulnTitle(title) {
  const titleMap = {
    'Mixed Content Detected': t('reports.security.vulnTitles.mixedContent', 'Mixed Content Detected'),
    'Excessive Inline Scripts': t('reports.security.vulnTitles.excessiveInlineScripts', 'Excessive Inline Scripts'),
    'Insecure Form Submission': t('reports.security.vulnTitles.insecureFormSubmission', 'Insecure Form Submission'),
    'Password Field Configuration': t('reports.security.vulnTitles.passwordFieldConfig', 'Password Field Configuration'),
    'Unsandboxed Iframes': t('reports.security.vulnTitles.unsandboxedIframes', 'Unsandboxed Iframes')
  };
  return titleMap[title] || title;
}

// Vulnerability description translations map
function translateVulnDescription(desc) {
  const descMap = {
    'Update all resources to use HTTPS URLs': t('reports.security.vulnSolutions.updateHttps', 'Update all resources to use HTTPS URLs'),
    'Move scripts to external files and use CSP': t('reports.security.vulnSolutions.moveScripts', 'Move scripts to external files and use CSP'),
    'Update form actions to use HTTPS': t('reports.security.vulnSolutions.updateForms', 'Update form actions to use HTTPS'),
    'Add autocomplete="current-password" or "new-password"': t('reports.security.vulnSolutions.addAutocomplete', 'Add autocomplete="current-password" or "new-password"'),
    'Add sandbox attribute to restrict iframe capabilities': t('reports.security.vulnSolutions.addSandbox', 'Add sandbox attribute to restrict iframe capabilities')
  };
  return descMap[desc] || desc;
}

// SSL issue translations map (server sends English issue strings)
function translateSslIssue(issue) {
  if (!issue) return issue;
  const sslMap = {
    'Certificate expiring very soon - CRITICAL': t('reports.security.sslIssues.expiringCritical', 'Certificate expiring very soon - CRITICAL'),
    'Using outdated TLS protocol': t('reports.security.sslIssues.outdatedTls', 'Using outdated TLS protocol'),
    'No HTTPS - website is not secure': t('reports.security.sslIssues.noHttps', 'No HTTPS - website is not secure'),
    'Failed to analyze SSL certificate': t('reports.security.sslIssues.analysisFailed', 'Failed to analyze SSL certificate')
  };
  // Handle dynamic "Certificate expires in X days" pattern
  const expiresMatch = issue.match(/^Certificate expires in (\d+) days$/);
  if (expiresMatch) {
    return t('reports.security.sslIssues.expiresInDays', 'Certificate expires in {{days}} days', { days: expiresMatch[1] });
  }
  return sslMap[issue] || issue;
}

// Recommendation title translations (reuses fixTitles keys from en.json)
function translateRecTitle(title) {
  const titleMap = {
    'Mixed Content Detected': t('reports.security.fixTitles.mixedContent', 'Mixed Content Detected'),
    'Excessive Inline Scripts': t('reports.security.fixTitles.excessiveInlineScripts', 'Excessive Inline Scripts'),
    'Insecure Form Submission': t('reports.security.fixTitles.insecureFormSubmission', 'Insecure Form Submission'),
    'Password Field Configuration': t('reports.security.fixTitles.passwordFieldConfig', 'Password Field Configuration'),
    'Unsandboxed Iframes': t('reports.security.fixTitles.unsandboxedIframes', 'Unsandboxed Iframes'),
    'Implement HTTPS': t('reports.security.fixTitles.implementHttps', 'Implement HTTPS'),
    'Fix SSL/TLS Issues': t('reports.security.fixTitles.fixSslTlsIssues', 'Fix SSL/TLS Issues'),
    'Implement Content Security Policy': t('reports.security.fixTitles.implementCsp', 'Implement Content Security Policy'),
    'Enable HTTP Strict Transport Security': t('reports.security.fixTitles.enableHsts', 'Enable HTTP Strict Transport Security'),
    'Prevent Clickjacking Attacks': t('reports.security.fixTitles.preventClickjacking', 'Prevent Clickjacking Attacks'),
    'Prevent MIME Sniffing': t('reports.security.fixTitles.preventMimeSniffing', 'Prevent MIME Sniffing'),
    'Improve Cookie Security': t('reports.security.fixTitles.improveCookieSecurity', 'Improve Cookie Security'),
    'Add Subresource Integrity Checks': t('reports.security.fixTitles.addSriChecks', 'Add Subresource Integrity Checks')
  };
  return titleMap[title] || title;
}

// Recommendation description translations (server-generated English descriptions)
function translateRecDescription(desc) {
  if (!desc) return desc;
  const descMap = {
    'Website is not using HTTPS encryption': t('reports.security.recDescriptions.noHttps', 'Website is not using HTTPS encryption'),
    'No CSP header found - site vulnerable to XSS attacks': t('reports.security.recDescriptions.noCsp', 'No CSP header found - site vulnerable to XSS attacks'),
    'HSTS header not present': t('reports.security.recDescriptions.noHsts', 'HSTS header not present'),
    'X-Frame-Options header not set': t('reports.security.recDescriptions.noXFrameOptions', 'X-Frame-Options header not set'),
    'X-Content-Type-Options header missing': t('reports.security.recDescriptions.noXContentType', 'X-Content-Type-Options header missing'),
    'Cookies not properly secured with HttpOnly, Secure, and SameSite flags': t('reports.security.recDescriptions.cookiesNotSecured', 'Cookies not properly secured with HttpOnly, Secure, and SameSite flags')
  };
  if (descMap[desc]) return descMap[desc];
  // Dynamic patterns with counts
  const patterns = [
    { re: /^(\d+) resources loaded over HTTP on HTTPS page$/, key: 'reports.security.recDescriptions.mixedContentCount', fallback: '{{count}} resources loaded over HTTP on HTTPS page' },
    { re: /^(\d+) inline scripts found - increases XSS risk$/, key: 'reports.security.recDescriptions.inlineScriptsCount', fallback: '{{count}} inline scripts found - increases XSS risk' },
    { re: /^(\d+) form\(s\) submitting data over HTTP$/, key: 'reports.security.recDescriptions.insecureFormsCount', fallback: '{{count}} form(s) submitting data over HTTP' },
    { re: /^(\d+) password field\(s\) without autocomplete attribute$/, key: 'reports.security.recDescriptions.passwordFieldsCount', fallback: '{{count}} password field(s) without autocomplete attribute' },
    { re: /^(\d+) iframe\(s\) without sandbox attribute$/, key: 'reports.security.recDescriptions.unsandboxedIframesCount', fallback: '{{count}} iframe(s) without sandbox attribute' },
    { re: /^(\d+) third-party scripts without SRI$/, key: 'reports.security.recDescriptions.sriMissingCount', fallback: '{{count}} third-party scripts without SRI' }
  ];
  for (const p of patterns) {
    const m = desc.match(p.re);
    if (m) return t(p.key, p.fallback, { count: m[1] });
  }
  return desc;
}

// Recommendation impact translations
function translateRecImpact(impact) {
  if (!impact) return '-';
  const impactMap = {
    'All data transmitted in plain text - vulnerable to interception': t('reports.security.recImpacts.plainText', 'All data transmitted in plain text - vulnerable to interception'),
    'Certificate or protocol issues may compromise security': t('reports.security.recImpacts.certIssues', 'Certificate or protocol issues may compromise security'),
    'Attackers can inject malicious scripts': t('reports.security.recImpacts.xssRisk', 'Attackers can inject malicious scripts'),
    'Site vulnerable to protocol downgrade attacks': t('reports.security.recImpacts.downgradeAttack', 'Site vulnerable to protocol downgrade attacks'),
    'Site can be embedded in malicious iframes': t('reports.security.recImpacts.clickjacking', 'Site can be embedded in malicious iframes'),
    'Browsers may misinterpret file types': t('reports.security.recImpacts.mimeSniffing', 'Browsers may misinterpret file types'),
    'Critical security vulnerability': t('reports.security.recImpacts.criticalVuln', 'Critical security vulnerability'),
    'High-severity security issue': t('reports.security.recImpacts.highVuln', 'High-severity security issue'),
    'Cookies vulnerable to XSS and CSRF attacks': t('reports.security.recImpacts.cookieVuln', 'Cookies vulnerable to XSS and CSRF attacks'),
    'Third-party scripts could be compromised': t('reports.security.recImpacts.sriRisk', 'Third-party scripts could be compromised')
  };
  return impactMap[impact] || impact;
}

// Recommendation solution translations
function translateRecSolution(solution) {
  if (!solution) return '-';
  const solMap = {
    'Obtain and install an SSL/TLS certificate from a trusted CA': t('reports.security.recSolutions.installSsl', 'Obtain and install an SSL/TLS certificate from a trusted CA'),
    'Update certificate or upgrade TLS protocol version': t('reports.security.recSolutions.upgradeTls', 'Update certificate or upgrade TLS protocol version'),
    'Add Content-Security-Policy header with restrictive directives': t('reports.security.recSolutions.addCsp', 'Add Content-Security-Policy header with restrictive directives'),
    'Add Strict-Transport-Security: max-age=31536000; includeSubDomains': t('reports.security.recSolutions.addHsts', 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains'),
    'Add X-Frame-Options: DENY or SAMEORIGIN': t('reports.security.recSolutions.addXFrameOptions', 'Add X-Frame-Options: DENY or SAMEORIGIN'),
    'Add X-Content-Type-Options: nosniff': t('reports.security.recSolutions.addNosniff', 'Add X-Content-Type-Options: nosniff'),
    'Update all resources to use HTTPS URLs': t('reports.security.vulnSolutions.updateHttps', 'Update all resources to use HTTPS URLs'),
    'Move scripts to external files and use CSP': t('reports.security.vulnSolutions.moveScripts', 'Move scripts to external files and use CSP'),
    'Update form actions to use HTTPS': t('reports.security.vulnSolutions.updateForms', 'Update form actions to use HTTPS'),
    'Add autocomplete="current-password" or "new-password"': t('reports.security.vulnSolutions.addAutocomplete', 'Add autocomplete="current-password" or "new-password"'),
    'Add sandbox attribute to restrict iframe capabilities': t('reports.security.vulnSolutions.addSandbox', 'Add sandbox attribute to restrict iframe capabilities'),
    'Set HttpOnly, Secure, and SameSite=Strict flags on all cookies': t('reports.security.recSolutions.secureCookies', 'Set HttpOnly, Secure, and SameSite=Strict flags on all cookies'),
    'Add integrity and crossorigin attributes to external scripts': t('reports.security.recSolutions.addSri', 'Add integrity and crossorigin attributes to external scripts')
  };
  return solMap[solution] || solution;
}

// Security header description translations
const headerDescriptionKeys = {
  'Content-Security-Policy': 'reports.security.headerDescriptions.csp',
  'Strict-Transport-Security': 'reports.security.headerDescriptions.hsts',
  'X-Frame-Options': 'reports.security.headerDescriptions.xFrameOptions',
  'X-Content-Type-Options': 'reports.security.headerDescriptions.xContentTypeOptions',
  'X-XSS-Protection': 'reports.security.headerDescriptions.xXssProtection',
  'Referrer-Policy': 'reports.security.headerDescriptions.referrerPolicy',
  'Permissions-Policy': 'reports.security.headerDescriptions.permissionsPolicy',
  'Feature-Policy': 'reports.security.headerDescriptions.featurePolicy'
};

const headerRiskKeys = {
  'Content-Security-Policy': 'reports.security.headerRisks.csp',
  'Strict-Transport-Security': 'reports.security.headerRisks.hsts',
  'X-Frame-Options': 'reports.security.headerRisks.xFrameOptions',
  'X-Content-Type-Options': 'reports.security.headerRisks.xContentTypeOptions',
  'X-XSS-Protection': 'reports.security.headerRisks.xXssProtection',
  'Referrer-Policy': 'reports.security.headerRisks.referrerPolicy',
  'Permissions-Policy': 'reports.security.headerRisks.permissionsPolicy',
  'Feature-Policy': 'reports.security.headerRisks.featurePolicy'
};

function translateHeaderDescription(header, fallback) {
  const key = headerDescriptionKeys[header];
  if (key) {
    return t(key, fallback);
  }
  return fallback;
}

function translateHeaderRisk(header, fallback) {
  const key = headerRiskKeys[header];
  if (key) {
    return t(key, fallback);
  }
  return fallback;
}

// Function to get analysis steps with current translations
// Called at runtime to ensure i18n is loaded
function getAnalysisSteps() {
  return [
    {
      label: t('loader.checkingHttps', 'Checking HTTPS configuration'),
      detail: t('loader.verifyingSsl', 'Verifying SSL/TLS certificate and encryption...')
    },
    {
      label: t('loader.analyzingSecurityHeaders', 'Analyzing security headers'),
      detail: t('loader.testingCsp', 'Testing CSP, HSTS, X-Frame-Options...')
    },
    {
      label: t('loader.scanningVulnerabilities', 'Scanning for vulnerabilities'),
      detail: t('loader.checkingOwasp', 'Checking OWASP Top 10 security risks...')
    },
    {
      label: t('loader.testingSslStrength', 'Testing SSL/TLS strength'),
      detail: t('loader.evaluatingCiphers', 'Evaluating cipher suites and protocols...')
    },
    {
      label: t('loader.generatingSecurityReport', 'Generating security report'),
      detail: t('loader.compilingFindings', 'Compiling findings and recommendations...')
    }
  ];
}

let currentResults = null;

/**
 * MEMORY MANAGEMENT: Clean up previous scan data to prevent memory leaks
 * @param {boolean} preserveReportId - If true, don't clear the report_id (used for billing return re-scans)
 */
function cleanupPreviousSecurityData(preserveReportId = false) {
  // Clear report metadata from previous scans
  // IMPORTANT: Don't clear report_id when re-scanning after billing return,
  // otherwise the purchased report_id gets lost and replaced with a new one
  if (!preserveReportId) {
    document.body.removeAttribute('data-report-id');
  }
  document.body.removeAttribute('data-sm-screenshot-url');
  document.body.removeAttribute('data-sm-scan-started-at');
  
  // Clear current results reference
  currentResults = null;
  
  // Clear results container
  const resultsContent = document.getElementById('resultsContent');
  if (resultsContent) {
    resultsContent.innerHTML = '';
  }
  
  // Clear loading container
  const loadingContainer = document.getElementById('loadingContainer');
  if (loadingContainer) {
    loadingContainer.innerHTML = '';
  }
  
  // Remove patience message
  const patienceMessage = document.getElementById('patience-message');
  if (patienceMessage) {
    patienceMessage.remove();
  }
  
  // Destroy any Chart.js instances
  if (window.Chart && Chart.instances) {
    Object.values(Chart.instances).forEach(chart => {
      try { chart.destroy(); } catch (e) { /* ignore */ }
    });
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  // Initialize PageShell for unified page structure
  // Note: Security analyzer has custom scan logic (preserveReportId), so we handle events manually
  const shell = window.PageShell.init('#page-container', {
    pageId: 'security-analyzer',
    pageTitle: t('security.title', 'Security Analyzer'),
    pageDescription: t('security.subtitle', 'SSL, Headers & Vulnerability Scan'),
    pageIntro: t('security.pageIntro', 'This report scans your website for SSL configuration, security headers, cookie policies, and known vulnerabilities. Security gaps put your visitors at risk and erode trust in your brand. Follow the recommendations to harden your defenses and meet modern security standards.'),
    analyzerType: 'security',

    i18n: {
      title: 'security.title',
      subtitle: 'security.subtitle',
      pageIntro: 'security.pageIntro'
    },

    urlInput: {
      placeholder: 'https://example.com',
      label: t('common.websiteUrl', 'Website URL'),
      helperText: t('security.helperText', 'Tests SSL/TLS, security headers (CSP, HSTS, X-Frame-Options), and OWASP-aligned checks.'),
      i18nLabel: 'common.websiteUrl',
      i18nHelper: 'security.helperText'
    },

    scanButton: {
      text: t('common.analyze', 'Analyze'),
      loadingText: t('common.analyzing', 'Analyzing...'),
      i18nText: 'common.analyze'
    },

    // Use standard IDs (no legacy mapping needed)
    legacyIds: {
      urlInput: 'urlInput',
      scanButton: 'analyzeButton',
      results: 'results'
    },

    // CRITICAL: Security analyzer has custom scan logic (preserveReportId, billing return handling)
    // We MUST handle events manually to prevent duplicate scan triggers
    manualEventHandling: true
  });

  // Get element references (PageShell created these with our IDs)
  const analyzeButton = document.getElementById('analyzeButton');
  const urlInput = document.getElementById('urlInput');

  // Attach event listeners for custom scan handling
  analyzeButton.addEventListener('click', () => analyzeSecurity());

  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      analyzeSecurity();
    }
  });

  // Handle URL parameters for report loading and billing return
  (async function initFromUrlParams() {
    // Ensure i18n translations are loaded before rendering any report content
    if (window.i18n && typeof window.i18n.init === 'function' && !window.i18n.initialized) {
      try { await window.i18n.init(); } catch (e) { /* i18n will use fallback */ }
    }

    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('report_id') || '';
    const autoUrl = params.get('url') || (typeof window.getUrlParameter === 'function' ? window.getUrlParameter() : '');
    const autoScan = params.get('auto_scan') === 'true';
    const billingSuccess = params.get('billing_success') === 'true';

    // If we have a report_id, set it immediately so hasAccess checks work
    if (reportId) {
      document.body.setAttribute('data-report-id', reportId);
      console.log('[Security] Set report ID from URL:', reportId);
    }

    // If returning from billing, wait for billing return processing to complete
    if (billingSuccess && !window.__smBillingReturnComplete) {
      console.log('[Security] Waiting for billing return processing...');

      // CRITICAL: Clear fresh scan flag - user paid for this report
      console.log('[Security] Billing return detected - clearing fresh scan flag');
      window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;

      await new Promise((resolve) => {
        if (window.__smBillingReturnComplete) {
          resolve();
          return;
        }
        const handler = () => {
          window.removeEventListener('sm:billingReturnComplete', handler);
          resolve();
        };
        window.addEventListener('sm:billingReturnComplete', handler);
        setTimeout(() => {
          window.removeEventListener('sm:billingReturnComplete', handler);
          resolve();
        }, 5000);
      });
      console.log('[Security] Billing return processing complete');

      // Safety net: if report-ui.js didn't display results and no rescan was triggered,
      // try to load stored report ourselves after a short delay
      setTimeout(async () => {
        if (window.currentSecurityResults || window.__smBillingRescanHandled) {
          return; // Results already displayed or rescan in progress
        }
        console.log('[Security] Billing return fallback: trying to load stored report');
        if (reportId && window.ReportStorage) {
          // Ensure billing status is fresh
          if (window.ProReportBlock?.fetchBillingStatus) {
            await window.ProReportBlock.fetchBillingStatus(true);
          }
          const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displaySecurityResults);
          if (loaded) {
            window.__REPORT_READY__ = true;
            console.log('[Security] Billing return fallback: loaded stored report successfully');
            return;
          }
        }
        // Last resort: if we have a URL, trigger a scan
        if (autoUrl && !window.__smBillingRescanHandled) {
          const input = document.getElementById('urlInput');
          if (input) input.value = autoUrl;
          console.log('[Security] Billing return fallback: triggering re-scan');
          analyzeSecurity({ preserveReportId: true });
        }
      }, 2000);
      return;
    }

    // If we have a report_id, try to load the stored report first
    if (reportId && window.ReportStorage) {
      console.log('[Security] Checking for stored report:', reportId);

      // CRITICAL: Fetch billing status BEFORE displaying the report
      // Force refresh to ensure we have the latest purchase data (e.g., coming from dashboard)
      // Skip in print mode (Puppeteer PDF export) - the server already verified entitlements
      const isPrintMode = params.get('print') === '1';
      if (!isPrintMode && window.ProReportBlock?.fetchBillingStatus) {
        console.log('[Security] Fetching billing status (force refresh for report recall)...');
        await window.ProReportBlock.fetchBillingStatus(true);
        console.log('[Security] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportId), 'for reportId:', reportId);
      }

      const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displaySecurityResults);
      if (loaded) {
        // Stored report was loaded - fill URL input for context
        if (autoUrl) urlInput.value = autoUrl;
        // Signal for Puppeteer PDF export that report content is rendered
        window.__REPORT_READY__ = true;
        return; // Don't auto-scan
      }

      // Report data not found - show unavailable banner
      // Pre-fill URL first so the re-scan button works
      if (autoUrl) urlInput.value = autoUrl;

      console.log('[Security] Report data unavailable, showing banner:', { reportId, autoUrl });
      window.ReportStorage.showReportUnavailableBanner({
        url: autoUrl || '',
        analyzerType: 'security',
        onRescan: () => {
          analyzeSecurity();
        }
      });
      return; // Don't continue - user should click re-scan
    }

    // No report_id - just pre-fill URL if available
    if (autoUrl) {
      urlInput.value = autoUrl;
    }
    // Only auto-scan if explicitly requested with auto_scan=true
    if (autoScan) {
      setTimeout(() => {
        analyzeSecurity();
      }, 500);
    }
  })();

  // Listen for restore scan results event (after payment return)
  window.addEventListener('sm:restoreScanResults', (e) => {
    const { results, url, analyzer } = e.detail || {};
    if (results && analyzer?.includes('security')) {
      console.log('[Security] Restoring scan results after payment - clearing fresh scan flag');
      // Clear fresh scan flag since user paid for this report
      window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;
      if (url && urlInput) {
        urlInput.value = url;
      }
      currentResults = results;
      window.currentSecurityResults = results;
      displaySecurityResults(results);
      window.__REPORT_READY__ = true;
    }
  });

  // Re-render results when language changes
  window.addEventListener('languageChanged', () => {
    if (window.SM_IS_SCANNING) return;
    if (window.currentSecurityResults) {
      try {
        displaySecurityResults(window.currentSecurityResults);
      } catch (e) {
        // ignore
      }
    }
  });

  // Re-render when entitlements arrive/change (handles race conditions
  // where sections rendered before billing status was available)
  window.addEventListener('entitlements:updated', () => {
    if (window.SM_IS_SCANNING && !window.__smBillingReturnInProgress) return;
    if (window.currentSecurityResults) {
      try {
        console.log('[Security] Entitlements updated, re-rendering results');
        displaySecurityResults(window.currentSecurityResults);
      } catch (e) {
        // ignore
      }
    }
  });

  // Handle billing re-scan: user returned from Stripe but cached results weren't available.
  // Re-scan with the purchased reportId preserved so pro sections render unlocked.
  window.addEventListener('sm:billingRescan', (e) => {
    const { reportId: purchasedReportId, url: scanUrl } = e.detail || {};
    console.log('[Security] Billing re-scan requested:', { purchasedReportId, scanUrl });
    window.__smBillingRescanHandled = true;

    // Clear fresh scan flag - user already paid for this report
    window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;

    // Pre-fill URL input
    if (scanUrl) {
      const input = document.getElementById('urlInput');
      if (input) input.value = scanUrl;
    }

    // Ensure the purchased reportId is set on the body so preserveReportId logic picks it up
    if (purchasedReportId) {
      document.body.setAttribute('data-report-id', purchasedReportId);
    }

    // Trigger re-scan with preserveReportId to keep the purchased reportId
    // billingRescan tells the server to skip scan quota decrement
    analyzeSecurity({ preserveReportId: true, billingRescan: true });
  });
});

// Main analysis function
/**
 * @param {Object} options - Optional settings
 * @param {boolean} options.preserveReportId - If true, preserve the existing report_id (for billing return re-scans)
 */
async function analyzeSecurity(options = {}) {
  const { preserveReportId = false, billingRescan = false } = options;
  const url = document.getElementById('urlInput').value.trim();
  const analyzeButton = document.getElementById('analyzeButton');

  if (!url) {
    showError(t('reports.common.pleaseEnterUrl', 'Please enter a valid URL'));
    return;
  }

  // CRITICAL: Mark this as a FRESH SCAN that requires payment
  // VERSION: 20260212a - This flag ensures new scans are LOCKED until paid
  console.log('[Security] NEW SCAN v20260212a: Marking as fresh unpaid scan');
  window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = true;
  window.__SM_CURRENT_SCAN_URL__ = url;

  // NOTE: Auto-preserve is ONLY used when explicitly requested via options.preserveReportId
  // (e.g., sm:billingRescan handler passes preserveReportId: true).
  // Previously, auto-detect logic here caused false positives where stale purchased
  // reportIds from previous scans would grant pro access on fresh unpaid scans.
  const existingReportId = document.body.getAttribute('data-report-id');

  // Clear billing cache and session markers — but KEEP markers if preserving
  // a purchased report (the user just paid and is re-scanning)
  if (window.ProReportBlock?.clearBillingCache) {
    window.ProReportBlock.clearBillingCache();
  }
  if (!preserveReportId) {
    sessionStorage.removeItem('sm_payment_completed_session');
    sessionStorage.removeItem('sm_purchased_report_id');
  } else {
    console.log('[Security] Keeping session markers for post-billing re-scan');
  }

  // CRITICAL: Save the existing report_id BEFORE cleanup if we need to preserve it
  // This is used for billing return re-scans where the purchased report_id must be kept
  const preservedReportId = preserveReportId ? existingReportId : null;
  if (preservedReportId) {
    console.log('[Security] Preserving purchased report_id:', preservedReportId);
  }

  // MEMORY CLEANUP: Clear previous scan data
  // Pass preserveReportId to keep the purchased report_id during billing return re-scans
  cleanupPreviousSecurityData(preserveReportId);

  // Update button state
  analyzeButton.disabled = true;
  const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
  buttonText.textContent = t('common.analyzing', 'Analyzing...');

  // Setup UI
  const resultsDiv = document.getElementById('results');
  const errorMessage = document.getElementById('errorMessage');

  resultsDiv.classList.add('hidden');
  resultsDiv.setAttribute('hidden', '');
  errorMessage.classList.add('hidden');

  // Create loading container if it doesn't exist
  let loadingContainer = document.getElementById('loadingContainer');
  if (!loadingContainer) {
    loadingContainer = document.createElement('div');
    loadingContainer.id = 'loadingContainer';
    resultsDiv.parentNode.insertBefore(loadingContainer, resultsDiv);
  }

  // Initialize the analyzer loader
  const loader = new window.AnalyzerLoaderClass('loadingContainer');
  
  // Add ASCII art patience message
  const loaderMessageEl = document.createElement('div');
  loaderMessageEl.id = 'patience-message';
  loaderMessageEl.style.cssText = `
    margin: 0 0 1.5rem 0;
    padding: 1rem;
    background: rgba(var(--accent-primary-rgb), 0.05);
    border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
    border-radius: 6px;
    text-align: center;
    overflow: visible;
  `;
  loaderMessageEl.innerHTML = `
    <div style="overflow-x: auto; overflow-y: visible;">
      <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: var(--accent-primary); font-family: monospace; text-shadow: 2px 2px 0px rgba(var(--accent-primary-rgb), 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\\\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\\\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
    </div>
    <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem; color: var(--accent-primary); font-weight: 600; letter-spacing: 0.05em;">
      ${t('loader.comprehensiveAnalysisInProgress', 'Comprehensive analysis in progress...')}
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: 0.8rem; color: rgba(var(--accent-primary-rgb), 0.7);">
      ${t('loader.mayTake30To60Seconds', 'This may take 30-60 seconds')}
    </p>
  `;

  // Add color cycling style if not already added
  if (!document.getElementById('ascii-art-style')) {
    const style = document.createElement('style');
    style.id = 'ascii-art-style';
    style.textContent = `
      @keyframes color-cycle {
        0% { color: var(--accent-primary); }
        20% { color: #00ffff; }
        40% { color: #0099ff; }
        60% { color: #9933ff; }
        80% { color: #ff33cc; }
        100% { color: var(--accent-primary); }
      }
      .ascii-art-responsive {
        font-size: clamp(0.35rem, 1.2vw, 0.65rem);
        white-space: pre;
        max-width: 100%;
      }
      #patience-message {
        overflow: visible;
      }
      #patience-message > div {
        -webkit-overflow-scrolling: touch;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Use getAnalysisSteps() to get translated steps at runtime
  loader.start(getAnalysisSteps(), '🔒 ' + t('loader.analyzingSecurity', 'SECURITY ANALYZER'), 15);
  
  // Insert ASCII art message after loader starts
  setTimeout(() => {
    const loadingContainer = document.getElementById('loadingContainer');
    if (loadingContainer && loaderMessageEl) {
      loadingContainer.insertBefore(loaderMessageEl, loadingContainer.firstChild);
    }
  }, 100);

  try {
    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

    // Call security API
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch('/api/security', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, scanStartedAt, lang: window.i18n?.getActiveLocale?.() || document.documentElement.lang || 'en', ...(billingRescan && { billingRescan: true }) }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.code === 'SCAN_QUOTA_EXCEEDED') {
        const limit = errorData.scansLimit || 10;
        loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
        return;
      }
      // Use the detailed error message from server if available
      const errorMsg = errorData.message || errorData.details || errorData.error || t('errors.securityAnalysisFailed', 'Security analysis failed');
      throw new Error(errorMsg);
    }

    const results = await response.json();
    currentResults = results;
    window.currentSecurityResults = results;
    console.log('[Security] API response received:', { hasReportId: !!results?.reportId, hasError: !!results?.error });

    // Set report metadata from API response
    // CRITICAL: Use preserved report_id if this is a billing return re-scan
    // The API returns a NEW report_id with new timestamp, but we must keep the purchased one
    let apiReportId = results && results.reportId ? String(results.reportId) : '';

    // FALLBACK: If API didn't return reportId, compute it client-side
    if (!apiReportId) {
      console.log('[Security] API did not return reportId, computing client-side...');
      const analyzerKey = window.SM_ANALYZER_KEY || 'security';
      const scanStartedAt = window.SM_SCAN_STARTED_AT || new Date().toISOString();
      if (window.ReportUI?.computeReportId) {
        apiReportId = window.ReportUI.computeReportId(url, scanStartedAt, analyzerKey);
        console.log('[Security] Computed reportId:', apiReportId);
      } else if (typeof computeReportId === 'function') {
        apiReportId = computeReportId(url, scanStartedAt, analyzerKey);
        console.log('[Security] Computed reportId (legacy):', apiReportId);
      }
    }

    const reportId = preservedReportId || apiReportId;
    const screenshotUrl = results && results.screenshotUrl ? String(results.screenshotUrl) : '';

    if (reportId) {
      if (preservedReportId) {
        console.log('[Security] Using preserved report_id instead of API response:', reportId);
      } else {
        console.log('[Security] Setting reportId:', reportId);
      }
      if (window.ReportUI && typeof window.ReportUI.setCurrentReportId === 'function') {
        window.ReportUI.setCurrentReportId(reportId);
      } else {
        document.body.setAttribute('data-report-id', reportId);
      }
    } else {
      console.warn('[Security] WARNING: No reportId available - unlock button will not work!');
    }

    if (screenshotUrl) {
      document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
    }

    // Complete the loader
    loader.complete();
    
    // Show results after animation completes
    setTimeout(async () => {
      // Re-fetch billing status before displaying results so Pro/Day Pass sections unlock
      if (window.ProReportBlock?.fetchBillingStatus) {
        try {
          await window.ProReportBlock.fetchBillingStatus(true);
          if (window.ProReportBlock.isProSubscriber?.()) {
            console.log('[Security] Pro/Day Pass user - clearing fresh scan payment flag');
            window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;
          }
          // Also clear if this is a billing re-scan (user already paid for this report)
          if (preserveReportId && reportId) {
            console.log('[Security] Billing re-scan - clearing fresh scan payment flag');
            window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;
          }
        } catch (e) {
          console.warn('[Security] Failed to fetch billing status:', e);
        }
      }
      displaySecurityResults(results);
      resultsDiv.classList.remove('hidden');
      resultsDiv.removeAttribute('hidden');
      window.__REPORT_READY__ = true;
      window.dispatchEvent(new CustomEvent('report:ready', {
        detail: { reportId: apiReportId, url: urlInput.value }
      }));
    }, 1000);

  } catch (error) {
    console.error('Security analysis error:', error);
    // Show more specific error message to help debugging
    let errorMsg = error.message || t('errors.unknownError', 'Unknown error');
    if (errorMsg.includes('429') || errorMsg.includes('Too Many')) {
      errorMsg = t('errors.rateLimitExceeded', 'Rate limit exceeded. Please wait a few minutes and try again.');
    } else if (errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT')) {
      errorMsg = t('errors.requestTimeout', 'The request timed out. The website may be slow or unresponsive.');
    } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
      errorMsg = t('errors.couldNotReach', 'Could not reach the website. Please check the URL is correct.');
    } else if (errorMsg.includes('ECONNREFUSED')) {
      errorMsg = t('errors.connectionRefused', 'Connection refused. The website may be down.');
    }
    loader.showError(`${t('errors.securityAnalysisFailed', 'Security analysis failed')}: ${errorMsg}`);
  } finally {
    // Reset button state
    const analyzeButton = document.getElementById('analyzeButton');
    analyzeButton.disabled = false;
    const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
    buttonText.textContent = t('common.analyze', 'Analyze');
  }
}

// Display complete security results
async function displaySecurityResults(data) {
  // Ensure i18n is loaded before rendering (prevents English fallback on fast stored-report loads)
  if (window.i18n && !window.i18n.initialized) {
    try { await window.i18n.init(); } catch (e) { /* fallback */ }
  }

  // Validate data
  if (!data || typeof data === 'string') {
    console.warn('[Security] Ignoring invalid data:', data);
    return;
  }

  // Handle fallback/error data from server - show partial results with error banner
  if (data.error === true) {
    console.warn('[Security] Server returned error data:', data.errorMessage || 'Unknown error');
    // Don't return - show what we have with an error banner
  }

  // Defensive defaults for sub-objects to prevent crashes on missing data
  data.ssl = data.ssl || { score: 0, valid: false, issuer: 'Unknown', validFrom: '', validUntil: '', daysRemaining: 0, protocol: 'Unknown' };
  data.headers = data.headers || { score: 0, implemented: 0, total: 0, details: [] };
  data.vulnerabilities = data.vulnerabilities || { score: 100, critical: 0, high: 0, medium: 0, low: 0, details: [] };
  data.cookies = data.cookies || { score: 0, secure: 0, total: 0, details: [] };
  data.thirdPartyScripts = data.thirdPartyScripts || { score: 0, withSRI: 0, total: 0, scripts: [] };
  data.overallScore = data.overallScore ?? 0;
  data.owaspCompliance = data.owaspCompliance ?? 0;
  data.recommendations = data.recommendations || [];

  // Ensure results container is visible (may be hidden if called directly without scan flow)
  const resultsDiv = document.getElementById('results');
  if (resultsDiv) {
    resultsDiv.classList.remove('hidden');
    resultsDiv.removeAttribute('hidden');
  }

  let resultsContent = document.getElementById('resultsContent');
  if (!resultsContent) {
    console.warn('[Security] resultsContent element not found - creating fallback');
    // Try to find results container and create resultsContent inside it
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
      resultsContent = document.createElement('div');
      resultsContent.id = 'resultsContent';
      resultsDiv.appendChild(resultsContent);
    } else {
      console.error('[Security] Cannot find results container - PageShell may not have initialized');
      return;
    }
  }
  resultsContent.innerHTML = '';

  // Get URL and timestamp for header
  const url = data.url || document.getElementById('urlInput').value.trim();
  const timestamp = window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString();

  // Consistent Report Header (clean, no redundant badges)
  const reportHeader = window.ReportContainer && window.ReportContainer.renderHeader
    ? window.ReportContainer.renderHeader({
        title: t('reports.security.title', 'Security Analysis Report'),
        url: url,
        timestamp: timestamp,
        mode: 'security',
        showModeBadge: false,
        showModeMeta: false
      })
    : `
      <div class="section" style="margin-bottom: 1.5rem;">
        <h2 style="color: var(--text-primary, #fff); font-size: 1.5rem; margin: 0 0 1rem 0;">${t('reports.security.title', 'Security Analysis Report')}</h2>
        ${url ? `<p style="color: var(--text-muted, #9ca3af); margin: 0.25rem 0; font-size: 0.875rem;">🌐 ${url}</p>` : ''}
        <p style="color: var(--text-muted, #9ca3af); margin: 0.25rem 0; font-size: 0.875rem;">🕒 ${timestamp}</p>
      </div>
    `;

  // Error banner if server returned fallback data
  const errorBanner = data.error ? `
    <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(255, 68, 68, 0.1); border: 2px solid #ff4444; border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span style="font-size: 1.5rem;">⚠️</span>
        <div>
          <strong style="color: #ff4444;">${t('reports.security.analysisIncomplete', 'Analysis Incomplete')}</strong>
          <p style="margin: 0.25rem 0 0 0; color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">
            ${data.errorMessage || t('reports.security.someChecksNotCompleted', 'Some security checks could not be completed. Partial results shown below.')}
          </p>
        </div>
      </div>
    </div>
  ` : '';

  // Page Screenshot section - consistent with other analyzers
  const reportId = document.body.getAttribute('data-report-id');
  const screenshotUrl = data.screenshotUrl || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');

  // Set screenshot URL body attribute for report-ui.js
  if (screenshotUrl) {
    document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
  }

  const pageScreenshotLabel = t('reports.common.pageScreenshot', 'Page Screenshot');
  const screenshotUnavailableLabel = t('reports.common.screenshotUnavailable', 'Screenshot unavailable');
  const screenshotHtml = screenshotUrl ? `
    <div class="screenshot-section" style="margin-bottom: 1.5rem;">
      <h3 style="color: var(--text-primary, #fff); font-size: 1rem; margin: 0 0 0.75rem 0; font-weight: 600;">
        ${pageScreenshotLabel}
      </h3>
      <div class="screenshot-item" style="background: var(--bg-secondary, #1a1a1a); border: 1px solid var(--border-color, #333); border-radius: 8px; overflow: hidden;">
        <img
          src="${screenshotUrl}"
          alt="${t('reports.common.screenshotAlt', 'Screenshot of')} ${url}"
          class="screenshot-item__img"
          style="width: 100%; max-height: 300px; object-fit: cover; object-position: top; cursor: pointer; display: block;"
          data-action="open-lightbox"
          data-screenshot-url="${screenshotUrl}"
          data-screenshot-title="${pageScreenshotLabel}"
        />
      </div>
    </div>
  ` : '';

  // Overall Security Summary with Circular Dials
  const summaryHtml = `
    ${reportHeader}
    ${screenshotHtml}
    ${errorBanner}
    <div class="summary-section security-summary-panel">
      <h2>◈ ${t('reports.security.summary', 'Summary')}</h2>

      ${ReportShell.renderSummaryDonuts([
        { score: data.overallScore, label: t('reports.security.overallSecurityScore', 'Overall Security Score') },
        { score: data.ssl.score, label: t('reports.security.sslTlsSecurity', 'SSL/TLS Security') },
        { score: data.headers.score, label: t('reports.security.headers', 'Security Headers') },
        { score: data.vulnerabilities.score, label: t('reports.security.vulnerabilityStatus', 'Vulnerability Status') }
      ])}

      <!-- Summary Table -->
      <div style="overflow-x: auto; margin-top: 2rem;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(255, 68, 68, 0.3);">
          <thead>
            <tr style="background: rgba(255, 68, 68, 0.1); border-bottom: 2px solid rgba(255, 68, 68, 0.3);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #ff4444;">${t('reports.security.category', 'Category')}</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ff4444;">${t('reports.security.score', 'Score')}</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary);">${t('reports.security.grade', 'Grade')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #ff4444;">${t('reports.security.status', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; font-weight: 500;">◈ ${t('reports.security.sslTlsCertificate', 'SSL/TLS Certificate')}</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.ssl.score)}; font-weight: bold;">${data.ssl.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.ssl.score)}; font-weight: bold;">${getGrade(data.ssl.score)}</td>
              <td style="padding: 0.75rem; color: ${data.ssl.valid ? 'var(--accent-primary)' : '#ff4444'};">${data.ssl.valid ? '✓ ' + t('reports.security.validCertificate', 'Valid Certificate') : '✗ ' + t('reports.security.invalidCertificate', 'Invalid Certificate')}</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; font-weight: 500;">◈ ${t('reports.security.headers', 'Security Headers')}</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.headers.score)}; font-weight: bold;">${data.headers.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.headers.score)}; font-weight: bold;">${getGrade(data.headers.score)}</td>
              <td style="padding: 0.75rem; color: #00ccff;">${t('reports.security.headersImplemented', '{{count}} of {{total}} headers implemented').replace('{{count}}', data.headers.implemented).replace('{{total}}', data.headers.total)}</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; font-weight: 500;">◈ ${t('reports.security.vulnerabilities', 'Vulnerabilities')}</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.vulnerabilities.score)}; font-weight: bold;">${data.vulnerabilities.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.vulnerabilities.score)}; font-weight: bold;">${getGrade(data.vulnerabilities.score)}</td>
              <td style="padding: 0.75rem; color: ${data.vulnerabilities.critical === 0 ? 'var(--accent-primary)' : '#ff4444'};">
                ${data.vulnerabilities.critical || 0} ${t('reports.security.critical', 'Critical')}, ${data.vulnerabilities.high || 0} ${t('reports.security.high', 'High')}, ${data.vulnerabilities.medium || 0} ${t('reports.security.medium', 'Medium')}
              </td>
            </tr>
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; font-weight: 500;">🍪 ${t('reports.security.cookieSecurity', 'Cookie Security')}</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.cookies.score)}; font-weight: bold;">${data.cookies.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.cookies.score)}; font-weight: bold;">${getGrade(data.cookies.score)}</td>
              <td style="padding: 0.75rem; color: #00ccff;">${t('reports.security.cookiesSecured', '{{count}} cookies properly secured').replace('{{count}}', data.cookies.secure + '/' + data.cookies.total)}</td>
            </tr>
            <tr>
              <td style="padding: 0.75rem; font-weight: 500;">◈ ${t('reports.security.thirdPartyScripts', 'Third-Party Scripts')}</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.thirdPartyScripts.score)}; font-weight: bold;">${data.thirdPartyScripts.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.thirdPartyScripts.score)}; font-weight: bold;">${getGrade(data.thirdPartyScripts.score)}</td>
              <td style="padding: 0.75rem; color: #00ccff;">${t('reports.security.scriptsWithSri', '{{count}} scripts with SRI').replace('{{count}}', data.thirdPartyScripts.withSRI + '/' + data.thirdPartyScripts.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- OWASP Compliance Banner -->
      <div style="margin-top: 2rem; padding: 1.25rem; background: linear-gradient(135deg, rgba(255, 68, 68, 0.15), rgba(255, 165, 0, 0.15)); border: 2px solid ${data.owaspCompliance >= 70 ? 'var(--accent-primary)' : '#ff4444'}; border-radius: 8px;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="font-size: 3rem;">${data.owaspCompliance >= 70 ? '✓' : '⚠'}</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 1.1rem; color: var(--r-text, #111827); margin-bottom: 0.5rem;">
              ${t('reports.security.owaspCompliance', 'OWASP Compliance')}
            </div>
            <div style="color: ${data.owaspCompliance >= 70 ? 'var(--accent-primary)' : '#ff4444'}; font-size: 0.95rem;">
              <strong>${data.owaspCompliance}%</strong> ${t('reports.security.owaspControlsImplemented', 'of OWASP Top 10 security controls implemented')}
              ${data.owaspCompliance >= 70 ? '- ' + t('reports.security.goodSecurityPosture', 'Good security posture!') : '- ' + t('reports.security.improvementsNeeded', 'Improvements needed')}
            </div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 2.5rem; font-weight: bold; color: ${data.owaspCompliance >= 70 ? 'var(--accent-primary)' : '#ff4444'};">
              ${data.owaspCompliance}%
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  resultsContent.innerHTML = summaryHtml;

  // Use JS listener instead of inline onerror (CSP blocks script-src-attr)
  const ssImg = resultsContent.querySelector('.screenshot-item__img');
  if (ssImg) {
    ssImg.addEventListener('error', function() {
      this.parentElement.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted, #666);">' + screenshotUnavailableLabel + '</div>';
    });
  }

  // Store results globally for export/share
  window.currentSecurityResults = {
    ...data,
    url: data.url || document.getElementById('urlInput').value.trim()
  };

  // PDF Download Button removed - monetization disabled

  // Desktop vs Mobile Comparison (for Lighthouse security metrics)
  if (data.desktop && data.mobile) {
    const comparisonSection = document.createElement('div');
    comparisonSection.className = 'comparison-section';
    createDesktopMobileComparison(comparisonSection, data.desktop, data.mobile);
    resultsContent.appendChild(comparisonSection);
  }

  // Accordion sections container
  const accordionsContainer = document.createElement('div');
  accordionsContainer.className = 'accordions-container';

  // 1. SSL/TLS Certificate
  createAccordionSection(
    accordionsContainer,
    'ssl-section',
    t('reports.security.sslTlsCertificate', 'SSL/TLS Certificate'),
    () => renderSSLContent(data.ssl),
    data.ssl.score
  );

  // 2. Security Headers
  createAccordionSection(
    accordionsContainer,
    'headers-section',
    t('reports.security.headers', 'Security Headers'),
    () => renderHeadersContent(data.headers),
    data.headers.score
  );

  // 3. Vulnerabilities & Threats
  createAccordionSection(
    accordionsContainer,
    'vulnerabilities-section',
    t('reports.security.vulnerabilitiesThreats', 'Vulnerabilities & Threats'),
    () => renderVulnerabilitiesContent(data.vulnerabilities),
    data.vulnerabilities.score
  );

  // 4. Cookie Security
  createAccordionSection(
    accordionsContainer,
    'cookies-section',
    t('reports.security.cookieSecurity', 'Cookie Security'),
    () => renderCookiesContent(data.cookies),
    data.cookies.score
  );

  // 5. Third-Party Scripts
  createAccordionSection(
    accordionsContainer,
    'thirdparty-section',
    t('reports.security.thirdPartyScripts', 'Third-Party Scripts'),
    () => renderThirdPartyContent(data.thirdPartyScripts),
    data.thirdPartyScripts.score
  );

  // 6. Report and Recommendations (Pro gated)
  createAccordionSection(
    accordionsContainer,
    'report-recommendations',
    t('reports.common.reportRecommendations', 'Recommendations'),
    () => renderRecommendationsContent(data.recommendations, data),
    null,
    {
      isPro: true,
      previewHtml: renderLockedProPreview(t('reports.common.reportRecommendations', 'Recommendations'), [
        t('reports.security.criticalRemediationSteps', 'Critical remediation steps'),
        t('reports.security.owaspAlignedFixes', 'OWASP-aligned fixes')
      ])
    }
  );

  // 7. AI Strategic Analysis (Pro gated)
  createAccordionSection(
    accordionsContainer,
    'ai-strategic-analysis',
    t('reports.ai.strategicTitle', 'AI Strategic Analysis'),
    () => {
      const html = '<div id="ai-strategic-content">' + (window.AIRecommendations && window.AIRecommendations.renderLoadingAnimation ? window.AIRecommendations.renderLoadingAnimation() : '<div style="padding:1.5rem;text-align:center;color:var(--r-text-muted,#6B7280);">' + t('reports.ai.loading', 'Analyzing your results...') + '</div>') + '</div>';
      // Schedule fetch after DOM update (content div needs to be in DOM first)
      setTimeout(() => {
        if (window.AIRecommendations) {
          const locale = document.documentElement.lang || (window.i18n && window.i18n.locale) || 'en';
          const secReportId = document.body.getAttribute('data-report-id') || '';
          window.AIRecommendations.fetchAndRender('ai-strategic-content', secReportId, 'security', data, locale, { skipHeader: true });
        }
      }, 0);
      return html;
    },
    null,
    { isPro: true }
  );

  resultsContent.appendChild(accordionsContainer);
  if (window.SelfImprovement) {
    const secReportId = document.body.getAttribute('data-report-id') || '';
    window.SelfImprovement.integrate({ data: data, analyzerType: 'security', donutLabels: {}, resultsContent: resultsContent, reportId: secReportId });
  }

  // Summary block (SEO-style footer)
  const summaryFooter = document.createElement('div');
  summaryFooter.className = 'section';
  summaryFooter.innerHTML = `
    <h2>${t('reports.common.summary', 'Summary')}</h2>
    <div class="seo-summary">
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-value">${countSecurityIssues(data)}</span>
          <span class="stat-label">${t('reports.common.issuesFound', 'Issues Found')}</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${countSecurityRecommendations(data)}</span>
          <span class="stat-label">${t('reports.common.recommendations', 'Recommendations')}</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${countSecurityPassedChecks(data)}</span>
          <span class="stat-label">${t('reports.common.checksPassed', 'Checks Passed')}</span>
        </div>
      </div>
    </div>
  `;
  resultsContent.appendChild(summaryFooter);

  // Monetization actions (export/share)
  const actionsFooter = document.createElement('div');
  actionsFooter.className = 'section';

  // Use new ProReportBlock component if available
  if (window.ProReportBlock && window.ProReportBlock.render) {
    // Get reportId from body attribute (set by analyzeSecurity after API response)
    const currentReportId = document.body.getAttribute('data-report-id') || '';
    console.log('[Security] Rendering ProReportBlock with reportId:', currentReportId);

    actionsFooter.innerHTML = window.ProReportBlock.render({
      context: 'security',
      features: ['pdf', 'excel', 'csv', 'share'],
      title: t('reports.common.unlockReport', 'Unlock Report'),
      subtitle: t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.'),
      reportId: currentReportId
    });
  } else {
    const opts = { context: 'security', features: ['pdf', 'excel', 'csv', 'share'], title: 'Unlock Report', subtitle: 'PDF export, share link, export data, and fix packs for this scan.' };
    const safe = JSON.stringify(opts).replace(/</g, '\\u003c').replace(/"/g, '&quot;');
    actionsFooter.innerHTML = '<div class="pro-report-block" data-pro-block-pending data-pro-block-options="' + safe + '"></div>';
  }
  resultsContent.appendChild(actionsFooter);

  // Auto-save report if user has access (purchased or Pro)
  const reportIdForSave = document.body.getAttribute('data-report-id') || '';
  if (reportIdForSave && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
    window.ReportStorage.autoSaveIfEligible(reportIdForSave, data, {
      siteUrl: data.url || document.getElementById('urlInput').value.trim(),
      analyzerType: 'security',
      scannedAt: window.SM_SCAN_STARTED_AT || new Date().toISOString()
    });
  }

  // Add click handler for screenshot lightbox
  resultsContent.addEventListener('click', (e) => {
    const openLightbox = e.target.closest('[data-action="open-lightbox"]');
    if (openLightbox) {
      const screenshotUrlForLightbox = openLightbox.getAttribute('data-screenshot-url');
      const screenshotTitle = openLightbox.getAttribute('data-screenshot-title');
      if (screenshotUrlForLightbox && window.ScreenshotLightbox && typeof window.ScreenshotLightbox.open === 'function') {
        window.ScreenshotLightbox.open(screenshotUrlForLightbox, screenshotTitle || t('reports.common.screenshot', 'Screenshot'));
      }
    }
  });
}

// Expose display function globally for billing return handler
window.displaySecurityResults = displaySecurityResults;

// Create desktop vs mobile comparison section
function createDesktopMobileComparison(container, desktop, mobile) {
  // Ensure all fields have safe defaults
  desktop = Object.assign({ securityScore: 0, https: false, csp: false, hsts: false, mixedContent: 0 }, desktop);
  mobile = Object.assign({ securityScore: 0, https: false, csp: false, hsts: false, mixedContent: 0 }, mobile);
  const comparisonHtml = `
    <div class="platform-comparison" style="margin: 2rem 0;">
      <h3 style="margin-bottom: 1.5rem;">${t('reports.security.desktopVsMobileAnalysis', 'Desktop vs Mobile Security Analysis')}</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 1rem;">
        <div style="background: rgba(0, 204, 255, 0.05); border: 2px solid rgba(0, 204, 255, 0.3); border-radius: 8px; padding: 1.5rem;">
          <div style="background: rgba(0, 204, 255, 0.2); padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; text-align: center;">
            <span style="font-size: 1.5rem; margin-right: 0.5rem;">D</span>
            <span style="font-weight: bold; color: #00ccff;">${t('reports.common.desktop', 'Desktop')}</span>
          </div>
          <div class="circular-progress-container" style="margin: 1.5rem 0;">
            <svg class="circular-progress" width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="rgba(0, 0, 0, 0.1)"
                stroke-width="8"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="${getScoreColor(desktop.securityScore)}"
                stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="${(desktop.securityScore / 100) * 326.73} 326.73"
                transform="rotate(-90 60 60)"
              />
              <text
                x="60"
                y="60"
                text-anchor="middle"
                dy="0.35em"
                font-size="2.8rem"
                font-weight="bold"
                fill="var(--r-text, #111827)"
              >
                ${desktop.securityScore}
              </text>
            </svg>
            <div style="text-align: center; margin-top: 0.5rem; font-size: 0.9rem; color: var(--r-text-faint, #9CA3AF);">${t('reports.security.securityScore', 'Security Score')}</div>
          </div>
          <div style="margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--r-surface-2, #F8FAFC); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">HTTPS:</span>
              <span style="color: ${desktop.https ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${desktop.https ? '✓ ' + t('reports.security.enabled', 'Enabled') : '✗ ' + t('reports.security.missing', 'Missing')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--r-surface-2, #F8FAFC); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">${t('reports.security.mixedContent', 'Mixed Content')}:</span>
              <span style="color: ${desktop.mixedContent === 0 ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${desktop.mixedContent} ${t('reports.security.issues', 'issues')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--r-surface-2, #F8FAFC); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">CSP:</span>
              <span style="color: ${desktop.csp ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">${desktop.csp ? '✓ ' + t('reports.security.present', 'Present') : '⚠ ' + t('reports.security.missing', 'Missing')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--r-surface-2, #F8FAFC); border-radius: 4px;">
              <span style="font-weight: 500;">HSTS:</span>
              <span style="color: ${desktop.hsts ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">${desktop.hsts ? '✓ ' + t('reports.security.present', 'Present') : '⚠ ' + t('reports.security.missing', 'Missing')}</span>
            </div>
          </div>
        </div>

        <div style="background: rgba(255, 102, 0, 0.05); border: 2px solid rgba(255, 102, 0, 0.3); border-radius: 8px; padding: 1.5rem;">
          <div style="background: rgba(255, 102, 0, 0.2); padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; text-align: center;">
            <span style="font-size: 1.5rem; margin-right: 0.5rem;">M</span>
            <span style="font-weight: bold; color: #ff6600;">${t('reports.common.mobile', 'Mobile')}</span>
          </div>
          <div class="circular-progress-container" style="margin: 1.5rem 0;">
            <svg class="circular-progress" width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="rgba(0, 0, 0, 0.1)"
                stroke-width="8"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="${getScoreColor(mobile.securityScore)}"
                stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="${(mobile.securityScore / 100) * 326.73} 326.73"
                transform="rotate(-90 60 60)"
              />
              <text
                x="60"
                y="60"
                text-anchor="middle"
                dy="0.35em"
                font-size="2.8rem"
                font-weight="bold"
                fill="var(--r-text, #111827)"
              >
                ${mobile.securityScore}
              </text>
            </svg>
            <div style="text-align: center; margin-top: 0.5rem; font-size: 0.9rem; color: var(--r-text-faint, #9CA3AF);">${t('reports.security.securityScore', 'Security Score')}</div>
          </div>
          <div style="margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--r-surface-2, #F8FAFC); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">HTTPS:</span>
              <span style="color: ${mobile.https ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${mobile.https ? '✓ ' + t('reports.security.enabled', 'Enabled') : '✗ ' + t('reports.security.missing', 'Missing')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--r-surface-2, #F8FAFC); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">${t('reports.security.mixedContent', 'Mixed Content')}:</span>
              <span style="color: ${mobile.mixedContent === 0 ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${mobile.mixedContent} ${t('reports.security.issues', 'issues')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--r-surface-2, #F8FAFC); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">CSP:</span>
              <span style="color: ${mobile.csp ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">${mobile.csp ? '✓ ' + t('reports.security.present', 'Present') : '⚠ ' + t('reports.security.missing', 'Missing')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--r-surface-2, #F8FAFC); border-radius: 4px;">
              <span style="font-weight: 500;">HSTS:</span>
              <span style="color: ${mobile.hsts ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">${mobile.hsts ? '✓ ' + t('reports.security.present', 'Present') : '⚠ ' + t('reports.security.missing', 'Missing')}</span>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top: 1.5rem; padding: 1rem; background: var(--r-surface-2, #F8FAFC); border-radius: 6px; font-size: 0.8rem; color: var(--r-text-faint, #9CA3AF); line-height: 1.6;">
        <p style="margin: 0 0 0.5rem 0;"><strong style="color: #a0a0a0;">CSP (Content Security Policy):</strong> ${t('reports.security.cspDescription', 'CSP (Content Security Policy): A security header that helps prevent XSS attacks')}</p>
        <p style="margin: 0;"><strong style="color: #a0a0a0;">HSTS (HTTP Strict Transport Security):</strong> ${t('reports.security.hstsDescription', 'HSTS (HTTP Strict Transport Security): Forces HTTPS connections')}</p>
      </div>

      ${Math.abs(desktop.securityScore - mobile.securityScore) > 10 ? `
        <div class="warning-message" style="background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); margin-top: 1rem; padding: 1rem; border-radius: 4px;">
          <strong style="color: #ffa500;">~ ${t('reports.security.platformSecurityGap', 'Platform Security Gap')}:</strong>
          ${t('reports.security.pointsDifferenceDetected', '{{count}} point difference detected. Investigate platform-specific issues.', { count: Math.abs(desktop.securityScore - mobile.securityScore) })}
        </div>
      ` : ''}
    </div>
  `;

  container.innerHTML = comparisonHtml;
}

// Create accordion section matching SEO/Accessibility style with optional Pro gating
function createAccordionSection(container, id, displayTitle, contentCreator, score, options = {}) {
  const { isPro = false, previewHtml = '' } = options;
  ensureProStyles();

  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  accordion.setAttribute('data-accordion-id', id);
  if (isPro) {
    accordion.classList.add('pro-section');
    accordion.dataset.pro = 'true';
  }
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  const proBadge = isPro ? '<span class="pro-pill">PRO</span>' : '';
  header.innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 0.5rem;">${displayTitle} ${proBadge}</span>
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      ${score !== null ? `<span style="color: ${getScoreColor(score)}; font-size: 0.9rem;">${score}/100</span>` : ''}
      <span class="accordion-toggle">▼</span>
    </span>
  `;
  
  const content = document.createElement('div');
  content.className = 'accordion-content';
  content.id = `accordion-${id}`;
  
  const contentInner = document.createElement('div');
  contentInner.className = 'accordion-content-inner';
  content.appendChild(contentInner);

  const renderContent = () => {
    const hasPro = !isPro || userHasPro();
    contentInner.innerHTML = ''; // Clear before re-render
    if (isPro && !hasPro) {
      contentInner.innerHTML = previewHtml || renderLockedProPreview(displayTitle, [t('reports.security.securityFixesPreview', 'Security fixes preview'), t('reports.security.owaspRecommendations', 'OWASP-aligned recommendations')]);
      return;
    }
    try {
      const contentHTML = contentCreator();
      if (typeof contentHTML === 'string') {
        contentInner.innerHTML = contentHTML;
      } else if (contentHTML) {
        contentInner.appendChild(contentHTML);
      }
    } catch (err) {
      console.error('[SecurityReport] Error rendering section ' + id + ':', err);
      contentInner.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--r-text-muted,#6B7280);">' + t('reports.common.sectionLoadError', 'This section could not be loaded. Please try refreshing the page.') + '</div>';
    }
  };

  // Add click handler for accordion
  header.addEventListener('click', () => {
    const isExpanded = content.classList.contains('expanded');

    if (isExpanded) {
      // Collapse
      content.classList.remove('expanded');
      header.classList.remove('active');
      header.querySelector('.accordion-toggle').textContent = '▼';
      header.querySelector('.accordion-toggle').classList.remove('rotated');
    } else {
      // For pro sections, always re-check access (handles billing fetch race condition)
      if (isPro || !contentInner.hasChildNodes()) {
        renderContent();
      }

      content.classList.add('expanded');
      header.classList.add('active');
      header.querySelector('.accordion-toggle').textContent = '▲';
      header.querySelector('.accordion-toggle').classList.add('rotated');
    }
  });

  // Listen for pro:unlocked event dispatched by revealProOnlyContent()
  // This re-renders the section with actual content when access is granted post-payment
  if (isPro) {
    contentInner.addEventListener('pro:unlocked', () => {
      console.log('[Security] pro:unlocked event received for section:', id);
      renderContent();
    });
  }

  // Pro sections: eagerly pre-render and auto-expand if user has Pro access
  if (isPro) {
    renderContent();
    // Auto-expand Pro sections for Pro users (no click needed)
    if (userHasPro()) {
      content.classList.add('expanded');
      header.classList.add('active');
      const toggle = header.querySelector('.accordion-toggle');
      if (toggle) {
        toggle.textContent = '▲';
        toggle.classList.add('rotated');
      }
    }
  }

  accordion.appendChild(header);
  accordion.appendChild(content);
  container.appendChild(accordion);
}

// Render SSL/TLS Certificate content
function renderSSLContent(ssl) {
  return `
    <div class="security-section">
      <h4>${t('reports.security.certificateInformation', 'Certificate Information')}</h4>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">${t('reports.security.valid', 'Valid')}:</span>
          <span class="info-value ${ssl.valid ? 'success' : 'error'}">${ssl.valid ? '✓ ' + t('common.yes', 'Yes') : '✗ ' + t('common.no', 'No')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">${t('reports.security.issuer', 'Issuer')}:</span>
          <span class="info-value">${ssl.issuer || t('common.unknown', 'Unknown')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">${t('reports.security.validFrom', 'Valid From')}:</span>
          <span class="info-value">${ssl.validFrom || t('common.notAvailable', 'N/A')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">${t('reports.security.validUntil', 'Valid Until')}:</span>
          <span class="info-value">${ssl.validUntil || t('common.notAvailable', 'N/A')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">${t('reports.security.daysRemaining', 'Days Remaining')}:</span>
          <span class="info-value ${ssl.daysRemaining > 30 ? 'success' : 'warning'}">${ssl.daysRemaining || t('common.notAvailable', 'N/A')} ${t('common.days', 'days')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">${t('reports.security.protocol', 'Protocol')}:</span>
          <span class="info-value">${ssl.protocol || t('common.unknown', 'Unknown')}</span>
        </div>
      </div>

      ${ssl.issues && ssl.issues.length > 0 ? `
        <div class="issues-list" style="margin-top: 1rem;">
          <h5 style="color: #ff4444;">~ ${t('reports.security.certificateIssues', 'Certificate Issues')}:</h5>
          <ul>
            ${ssl.issues.map(issue => `<li style="color: #ff4444;">${translateSslIssue(issue)}</li>`).join('')}
          </ul>
        </div>
      ` : '<p style="color: var(--accent-primary); margin-top: 1rem;">✓ ' + t('reports.security.noSslIssues', 'No SSL/TLS issues detected') + '</p>'}
    </div>
  `;
}

// Render Security Headers content
function renderHeadersContent(headers) {
  return `
    <div class="security-section">
      <h4>${t('reports.security.httpSecurityHeadersAnalysis', 'HTTP Security Headers Analysis')}</h4>
      <p style="margin-bottom: 1.5rem;">${t('reports.security.implemented', 'Implemented')}: ${headers.implemented} ${t('common.of', 'of')} ${headers.total} ${t('reports.security.recommendedHeaders', 'recommended headers')}</p>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
          <thead>
            <tr style="background: rgba(255, 255, 255, 0.05); border-bottom: 2px solid rgba(255, 255, 255, 0.2);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); width: 10%;">${t('reports.security.status', 'Status')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); width: 25%;">${t('reports.security.header', 'Header')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); width: 30%;">${t('reports.security.value', 'Value')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); width: 35%;">${t('reports.security.descriptionRisk', 'Description / Risk')}</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(headers.details).map(([header, info]) => `
              <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); ${!info.present ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${info.present ? 'var(--accent-primary)' : '#ff4444'}; font-size: 1.2rem; font-weight: bold;">
                    ${info.present ? '✓' : '✗'}
                  </span>
                </td>
                <td style="padding: 0.75rem;">
                  <strong style="color: ${info.present ? '#ffffff' : '#ff4444'};">${header}</strong>
                </td>
                <td style="padding: 0.75rem; color: ${info.present ? 'var(--accent-primary)' : '#808080'}; font-family: monospace; font-size: 0.85rem; word-break: break-all;">
                  ${info.value || '<span style="color: var(--r-text-faint, #9CA3AF); font-style: italic;">' + t('reports.security.notSet', 'Not set') + '</span>'}
                </td>
                <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">
                  <div>${translateHeaderDescription(header, info.description)}</div>
                  ${!info.present ? `<div style="color: #ff4444; margin-top: 0.5rem; font-weight: 500;">~ ${t('reports.security.risk', 'Risk')}: ${translateHeaderRisk(header, info.risk)}</div>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Render Vulnerabilities content
function renderVulnerabilitiesContent(vulnerabilities) {
  return `
    <div class="security-section">
      <h4>${t('reports.security.detectedVulnerabilities', 'Detected Vulnerabilities & Threats')}</h4>

      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(255, 255, 255, 0.05); border-bottom: 2px solid rgba(255, 255, 255, 0.1);">
            <th style="text-align: left; padding: 0.75rem; color: #bb86fc; font-weight: 600;">${t('reports.security.severityLevel', 'Severity Level')}</th>
            <th style="text-align: center; padding: 0.75rem; color: #bb86fc; font-weight: 600;">${t('reports.security.count', 'Count')}</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280);">
              <span style="color: #ff4444; font-weight: 600;">● ${t('reports.security.critical', 'Critical')}</span>
            </td>
            <td style="text-align: center; padding: 0.75rem;">
              <span style="color: ${vulnerabilities.critical > 0 ? '#ff4444' : 'var(--accent-primary)'}; font-weight: 700; font-size: 1.1rem;">${vulnerabilities.critical}</span>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280);">
              <span style="color: #ff6b6b; font-weight: 600;">● ${t('reports.security.high', 'High')}</span>
            </td>
            <td style="text-align: center; padding: 0.75rem;">
              <span style="color: ${vulnerabilities.high > 0 ? '#ff6b6b' : 'var(--accent-primary)'}; font-weight: 700; font-size: 1.1rem;">${vulnerabilities.high}</span>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280);">
              <span style="color: #ffa500; font-weight: 600;">● ${t('reports.security.medium', 'Medium')}</span>
            </td>
            <td style="text-align: center; padding: 0.75rem;">
              <span style="color: ${vulnerabilities.medium > 0 ? '#ffa500' : 'var(--accent-primary)'}; font-weight: 700; font-size: 1.1rem;">${vulnerabilities.medium}</span>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280);">
              <span style="color: #00ccff; font-weight: 600;">● ${t('reports.security.low', 'Low')}</span>
            </td>
            <td style="text-align: center; padding: 0.75rem;">
              <span style="color: ${vulnerabilities.low > 0 ? '#00ccff' : 'var(--accent-primary)'}; font-weight: 700; font-size: 1.1rem;">${vulnerabilities.low}</span>
            </td>
          </tr>
        </tbody>
      </table>

      ${vulnerabilities.issues && vulnerabilities.issues.length > 0 ? `
        <div class="vulnerabilities-list">
          ${vulnerabilities.issues.map(issue => `
            <div class="vulnerability-item ${issue.severity}">
              <div class="vuln-header">
                <span class="vuln-severity-badge ${issue.severity}">${translateRiskLevel(issue.severity).toUpperCase()}</span>
                <span class="vuln-title">${translateVulnTitle(issue.title)}</span>
              </div>
              <div class="vuln-description">${issue.description}</div>
              ${issue.cve ? `<div class="vuln-cve">CVE: ${issue.cve}</div>` : ''}
              ${issue.solution ? `<div class="vuln-solution"><strong>${t('reports.security.solution', 'Solution')}:</strong> ${translateVulnDescription(issue.solution)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : `<p style="color: var(--accent-primary); margin-top: 1rem;">✓ ${t('reports.security.noVulnerabilitiesDetected', 'No significant vulnerabilities detected')}</p>`}

      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 4px;">
        <p style="color: #ffa500; margin: 0; font-size: 0.9rem;">
          <strong>◈ ${t('reports.security.owaspReference', 'OWASP Reference: This analysis covers OWASP Top 10 categories')}:</strong> ${t('reports.security.owaspReferenceDesc', 'This analysis covers OWASP Top 10 categories including Injection, Broken Authentication, Sensitive Data Exposure, XML External Entities (XXE), and Security Misconfiguration.')}
        </p>
      </div>
    </div>
  `;
}

// Render Cookie Security content
function renderCookiesContent(cookies) {
  return `
    <div class="security-section">
      <h4>${t('reports.security.cookieSecurityAnalysis', 'Cookie Security Analysis')}</h4>
      <p style="margin-bottom: 1rem;">${t('reports.security.totalCookies', 'Total cookies: {{total}} | Secure cookies: {{secure}}')}: ${cookies.total} | ${t('reports.security.secureCookies', 'Secure cookies')}: ${cookies.secure}</p>

      ${cookies.list && cookies.list.length > 0 ? `
        <div class="cookies-table">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(255, 165, 0, 0.3);">
            <thead>
              <tr style="background: rgba(187, 134, 252, 0.1); border-bottom: 2px solid rgba(187, 134, 252, 0.3);">
                <th style="text-align: left; padding: 0.75rem; font-weight: 600; color: #bb86fc;">${t('reports.security.name', 'Name')}</th>
                <th style="text-align: center; padding: 0.75rem; font-weight: 600; color: #bb86fc; white-space: nowrap;">HttpOnly</th>
                <th style="text-align: center; padding: 0.75rem; font-weight: 600; color: #bb86fc; white-space: nowrap;">Secure</th>
                <th style="text-align: center; padding: 0.75rem; font-weight: 600; color: #bb86fc; white-space: nowrap;">SameSite</th>
                <th style="text-align: left; padding: 0.75rem; font-weight: 600; color: #bb86fc;">${t('reports.security.issues', 'issues')}</th>
              </tr>
            </thead>
            <tbody>
              ${cookies.list.map(cookie => `
                <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); ${(!cookie.httpOnly || !cookie.secure) ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                  <td style="padding: 0.75rem; font-family: 'Courier New', monospace; font-size: 0.9rem; color: #00ccff;">${cookie.name}</td>
                  <td style="text-align: center; padding: 0.75rem;">
                    <span style="color: ${cookie.httpOnly ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold; font-size: 1.1rem;">
                      ${cookie.httpOnly ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="text-align: center; padding: 0.75rem;">
                    <span style="color: ${cookie.secure ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold; font-size: 1.1rem;">
                      ${cookie.secure ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="text-align: center; padding: 0.75rem;">
                    <span style="color: ${cookie.sameSite && cookie.sameSite !== 'Not set' && cookie.sameSite !== 'None' ? 'var(--accent-primary)' : (cookie.sameSite === 'Lax' ? '#ffa500' : '#ff4444')}; font-weight: bold; font-size: 0.9rem;">
                      ${cookie.sameSite || t('reports.security.notSet', 'Not set')}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; color: ${cookie.issues && cookie.issues.length > 0 ? '#ff4444' : '#666'}; font-size: 0.85rem;">
                    ${cookie.issues && cookie.issues.length > 0 ? cookie.issues.map(issue => translateCookieIssue(issue)).join(', ') : t('common.none', 'None')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<p style="padding: 1rem; background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.3); border-radius: 4px; color: var(--accent-primary);">✓ ${t('reports.security.noCookiesDetected', 'No cookies detected')}</p>`}

      ${cookies.issues && cookies.issues.length > 0 ? `
        <div class="cookie-issues" style="margin-top: 1rem;">
          <h5 style="color: #ff4444;">~ ${t('reports.security.cookieSecurityIssues', 'Cookie Security Issues')}:</h5>
          <ul>
            ${cookies.issues.map(issue => `<li style="color: #ff4444;">${translateCookieIssue(issue)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
}

// Render Third-Party Scripts content
function renderThirdPartyContent(thirdParty) {
  return `
    <div class="security-section">
      <h4>${t('reports.security.thirdPartyScriptsAnalysis', 'Third-Party Scripts Analysis')}</h4>
      <p style="margin-bottom: 1.5rem;">
        <strong>${t('reports.security.totalExternalScripts', 'Total external scripts')}:</strong> ${thirdParty.total} |
        <strong>${t('reports.security.withSri', 'With SRI')}:</strong> ${thirdParty.withSRI} |
        <strong>${t('reports.security.coverage', 'Coverage')}:</strong> ${thirdParty.total > 0 ? Math.round((thirdParty.withSRI / thirdParty.total) * 100) : 0}%
      </p>

      ${thirdParty.scripts && thirdParty.scripts.length > 0 ? `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(255, 165, 0, 0.3);">
            <thead>
              <tr style="background: rgba(255, 165, 0, 0.1); border-bottom: 2px solid rgba(255, 165, 0, 0.3);">
                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #ffa500; min-width: 300px;">${t('reports.security.scriptUrl', 'Script URL')}</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ffa500; white-space: nowrap;">SRI</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ffa500; white-space: nowrap;">Async</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ffa500; white-space: nowrap;">HTTPS</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ffa500; white-space: nowrap;">${t('reports.security.riskLevel', 'Risk Level')}</th>
              </tr>
            </thead>
            <tbody>
              ${thirdParty.scripts.map((script) => `
                <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); ${!script.hasSRI ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                  <td style="padding: 0.75rem; word-break: break-all; font-family: 'Courier New', monospace; font-size: 0.85rem; color: #00ccff;">
                    ${script.url}
                  </td>
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="color: ${script.hasSRI ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">
                      ${script.hasSRI ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="color: ${script.async ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">
                      ${script.async ? '✓' : '⚠'}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="color: ${script.https ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">
                      ${script.https ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; text-align: center; font-weight: 600; color: ${
                    script.risk === 'high' ? '#ff4444' :
                    script.risk === 'medium' ? '#ffa500' :
                    script.risk === 'low' ? '#ffff00' : 'var(--accent-primary)'
                  };">
                    ${translateRiskLevel(script.risk)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<p style="padding: 1rem; background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.3); border-radius: 4px; color: var(--accent-primary);">✓ ${t('reports.security.noThirdPartyScripts', 'No third-party scripts detected - Excellent!')}</p>`}

      <div style="margin-top: 1.5rem; padding: 1.25rem; background: rgba(255, 165, 0, 0.1); border: 2px solid rgba(255, 165, 0, 0.3); border-radius: 8px;">
        <h5 style="margin: 0 0 0.75rem 0; color: #ffa500; font-size: 1rem;">
          K ${t('reports.security.sriBestPractices', 'Subresource Integrity (SRI) Best Practices')}
        </h5>
        <ul style="margin: 0; padding-left: 1.5rem; color: #ffa500; font-size: 0.9rem; line-height: 1.6;">
          <li>${t('reports.security.sriHashTampering', 'Use SRI hashes to ensure script integrity hasn\'t been tampered with')}</li>
          <li>${t('reports.security.sriHttpsLoading', 'Always load external resources over HTTPS')}</li>
          <li>${t('reports.security.sriAsyncDefer', 'Use async/defer attributes for non-critical scripts')}</li>
          <li>${t('reports.security.sriAuditDependencies', 'Regularly audit and minimize third-party dependencies')}</li>
        </ul>
      </div>
    </div>
  `;
}

// Render Recommendations content - Now uses the professional card-based renderer
function renderRecommendationsContent(recommendations, results) {
  // Use the new security fixes renderer if available
  if (typeof renderSecurityFixes === 'function') {
    return `
      <div class="security-section">
        ${renderSecurityFixes(recommendations, results)}
      </div>
    `;
  }
  
  // Fallback to simple message if renderer not loaded
  if (!recommendations || recommendations.length === 0) {
    return `
      <div class="security-section">
        <h4>${t('reports.security.securityRecommendations', 'Security Recommendations')}</h4>
        <p style="padding: 1rem; background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.3); border-radius: 4px; color: var(--accent-primary);">
          ✓ ${t('reports.security.noMajorIssues', 'Your security baseline looks strong. Review header and SSL analysis above for further hardening.')}
        </p>
      </div>
    `;
  }

  return `
    <div class="security-section">
      <h4>${t('reports.security.securityRecommendations', 'Security Recommendations')}</h4>
      <p style="margin-bottom: 1rem; color: var(--r-text-faint, #9CA3AF); font-size: 0.9rem;">
        ${t('reports.security.prioritizedImprovements', 'Prioritized security improvements based on OWASP guidelines')}
      </p>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(187, 134, 252, 0.3);">
          <thead>
            <tr style="background: rgba(187, 134, 252, 0.1); border-bottom: 2px solid rgba(187, 134, 252, 0.3);">
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #bb86fc; width: 8%;">${t('reports.security.priority', 'Priority')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #bb86fc; width: 22%;">${t('reports.security.issue', 'Issue')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #bb86fc; width: 25%;">${t('reports.security.description', 'Description')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #bb86fc; width: 20%;">${t('reports.security.impact', 'Impact')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #bb86fc; width: 25%;">${t('reports.security.solution', 'Solution')}</th>
            </tr>
          </thead>
          <tbody>
            ${recommendations.map((rec) => {
              const priorityColor = 
                rec.priority === 'critical' ? '#ff4444' :
                rec.priority === 'high' ? '#ffa500' :
                rec.priority === 'medium' ? '#ffff00' : '#00ccff';
              
              const priorityLabel = 
                rec.priority === 'critical' ? 'H' :
                rec.priority === 'high' ? '●' :
                rec.priority === 'medium' ? 'M' : 'L';

              return `
                <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); ${rec.priority === 'critical' ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="color: ${priorityColor}; font-weight: bold; font-size: 1.1rem; text-transform: uppercase;">
                      ${priorityLabel}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; font-weight: 600; color: #00ccff; font-size: 0.9rem; line-height: 1.4;">
                    ${translateRecTitle(rec.title)}
                    ${rec.owaspRef ? `<br><span style="font-size: 0.75rem; color: #ffa500; font-weight: normal;">OWASP: ${rec.owaspRef}</span>` : ''}
                    ${rec.location ? `<br><span style="font-size: 0.75rem; color: #818cf8; font-weight: normal;">📍 ${rec.location}</span>` : ''}
                  </td>
                  <td style="padding: 0.75rem; font-size: 0.85rem; line-height: 1.4; color: var(--r-text-muted, #6B7280);">
                    ${translateRecDescription(rec.description)}
                  </td>
                  <td style="padding: 0.75rem; font-size: 0.85rem; line-height: 1.4; color: #ff6b6b;">
                    ${translateRecImpact(rec.impact)}
                  </td>
                  <td style="padding: 0.75rem; font-size: 0.85rem; line-height: 1.4; color: var(--accent-primary);">
                    ${translateRecSolution(rec.solution)}
                    ${rec.resources && rec.resources.length > 0 ? `
                      <div style="margin-top: 0.5rem;">
                        ${rec.resources.map(resource => 
                          `<a href="${resource.url}" target="_blank" rel="noopener" style="color: #00ccff; text-decoration: none; font-size: 0.75rem; display: block;">→ ${resource.title}</a>`
                        ).join('')}
                      </div>
                    ` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Open PDF purchase modal
 */
// PDF purchase modal removed - monetization disabled

// Helper: Get status label from score
// Standard: Excellent (90-100), Good (75-89), Needs Work (50-74), Critical (<50)
function getGrade(score) {
  if (score >= 90) return t('reports.security.excellent', 'Excellent');
  if (score >= 75) return t('reports.security.good', 'Good');
  if (score >= 50) return t('reports.security.needsWork', 'Needs Work');
  return t('reports.security.critical', 'Critical');
}

// Alias for clarity
function getStatus(score) {
  return getGrade(score);
}

// Helper: Get score color - Standardized status colors
// Excellent (90-100): Green
// Good (75-89): Teal
// Needs Work (50-74): Orange
// Critical (<50): Red
function getScoreColor(score) {
  const stops = [
    [0,'#E53935'],[5,'#E14127'],[10,'#DD4E1A'],[15,'#DA5B0E'],
    [20,'#D96A06'],[25,'#E07E00'],[30,'#E89200'],[35,'#F0A400'],
    [40,'#F5B300'],[45,'#FAC200'],[50,'#FFD000'],[55,'#FFD600'],
    [60,'#FFDC00'],[65,'#FFE100'],[70,'#F0DD00'],[75,'#D2D400'],
    [80,'#A0C800'],[85,'#6BBD28'],[90,'#38B249'],[95,'#1FAD4F'],
    [100,'#0AA64F']
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

// Counts for summary footer
function countSecurityIssues(results) {
  if (!results) return 0;
  const vulnIssues = (results.vulnerabilities?.issues?.length || 0) +
    (results.vulnerabilities?.critical || 0) +
    (results.vulnerabilities?.high || 0) +
    (results.vulnerabilities?.medium || 0);
  const missingHeaders = Math.max((results.headers?.total || 0) - (results.headers?.implemented || 0), 0);
  const cookieIssues = results.cookies?.issues?.length || 0;
  const thirdPartyRisks = (results.thirdPartyScripts?.scripts || []).filter(s => s.risk === 'high' || s.risk === 'medium').length;
  return vulnIssues + missingHeaders + cookieIssues + thirdPartyRisks;
}

function countSecurityRecommendations(results) {
  return results?.recommendations?.length || 0;
}

function countSecurityPassedChecks(results) {
  if (!results) return 0;
  const headerPass = results.headers?.implemented || 0;
  const cookiePass = results.cookies?.secure || 0;
  const thirdPartyPass = results.thirdPartyScripts?.withSRI || 0;
  return headerPass + cookiePass + thirdPartyPass;
}

// Monetization actions (gated)
function ensureSecurityProAccess() {
  const domain = getCurrentDomain();
  if (userHasPro()) return true;
  safeOpenProPaywall({ domain, context: 'security' });
  return false;
}

async function exportSecurityPDF() {
  // Access check is handled by exportReportPDF() → checkExportAccess() which does
  // both local and async server-verified checks. No sync gate needed here.
  // Use the unified PDF export utility
  if (typeof window.exportReportPDF === 'function') {
    const button = document.querySelector('[data-export="pdf"]');
    await window.exportReportPDF({
      reportType: 'security',
      buttonElement: button
    });
  } else {
    console.error('PDF export utility not loaded');
    alert(t('reports.common.pdfNotAvailable', 'PDF export is not available. Please refresh the page.'));
  }
}

function copySecurityShareLink() {
  if (!ensureSecurityProAccess()) return;
  const targetUrl = window.currentSecurityResults?.url || window.location.href;
  const shareUrl = `${window.location.origin}/security-analyzer.html?url=${encodeURIComponent(targetUrl)}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    alert(t('reports.common.shareLinkCopied', 'Share link copied to clipboard!'));
  });
}

function downloadSecurityCSV() {
  if (!ensureSecurityProAccess()) return;
  const r = window.currentSecurityResults;
  if (!r) return;

  const rows = [
    [t('reports.security.csvMetric', 'Metric'), t('reports.security.csvValue', 'Value')],
    [t('reports.security.overallSecurityScore', 'Overall Security Score'), r.overallScore ?? ''],
    [t('reports.security.sslScore', 'SSL Score'), r.ssl?.score ?? ''],
    [t('reports.security.headersScore', 'Headers Score'), r.headers?.score ?? ''],
    [t('reports.security.vulnerabilityScore', 'Vulnerability Score'), r.vulnerabilities?.score ?? ''],
    [t('reports.security.criticalVulns', 'Critical Vulns'), r.vulnerabilities?.critical ?? 0],
    [t('reports.security.highVulns', 'High Vulns'), r.vulnerabilities?.high ?? 0],
    [t('reports.security.mediumVulns', 'Medium Vulns'), r.vulnerabilities?.medium ?? 0],
    [t('reports.security.missingHeaders', 'Missing Headers'), Math.max((r.headers?.total || 0) - (r.headers?.implemented || 0), 0)],
    [t('reports.common.recommendations', 'Recommendations'), countSecurityRecommendations(r)],
    [t('reports.common.checksPassed', 'Checks Passed'), countSecurityPassedChecks(r)],
    [t('reports.common.url', 'URL'), r.url || '']
  ];

  const csv = rows
    .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = t('reports.security.csvFilename', 'security-report.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Expose export functions to window for onclick handlers
window.exportSecurityPDF = exportSecurityPDF;
window.copySecurityShareLink = copySecurityShareLink;
window.downloadSecurityCSV = downloadSecurityCSV;

// Pro gating helpers
function getCurrentDomain() {
  if (window.ProAccess && typeof window.ProAccess.getCurrentDomain === 'function') {
    return window.ProAccess.getCurrentDomain();
  }
  return window.location.hostname;
}

function userHasPro() {
  const reportId = document.body?.getAttribute('data-report-id') || '';

  // Direct localStorage purchase proof check (most reliable, 24h TTL)
  if (reportId) {
    try {
      const proof = localStorage.getItem('sm_purchased_' + reportId);
      if (proof) {
        const parsed = JSON.parse(proof);
        if (Date.now() - (parsed.ts || 0) < 24 * 60 * 60 * 1000) return true;
      }
    } catch (e) { /* continue to other checks */ }
  }

  if (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function') {
    if (window.ProReportBlock.hasAccess(reportId)) return true;
  }
  if (window.ProAccess && typeof window.ProAccess.hasProAccess === 'function') {
    return window.ProAccess.hasProAccess(getCurrentDomain());
  }
  if (window.ExportGate && window.ExportGate.isPro()) return true;
  return false;
}

function renderLockedProPreview(title = t('reports.common.proContent', 'Pro content'), previewLines = []) {
  const reportId = document.body?.getAttribute('data-report-id') || '';
  if (window.ProReportBlock && typeof window.ProReportBlock.renderUnlockPrompt === 'function') {
    return window.ProReportBlock.renderUnlockPrompt({ context: 'security', reportId });
  }
  // Fallback matching ProReportBlock.renderUnlockPrompt() style
  return `
    <div class="pro-report-block__unlock-prompt" data-locked-overlay>
      <div class="pro-report-block__unlock-header">
        <span class="pro-report-block__unlock-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span>
        <span class="pro-report-block__unlock-text">${t('reports.common.unlockThisReport', 'Unlock this report')}</span>
      </div>
      <div class="pro-report-block__unlock-buttons">
        <button class="pro-report-block__unlock-btn pro-report-block__unlock-btn--primary" data-buy-single-report data-context="security"${reportId ? ` data-report-id="${reportId}"` : ''}>${t('reports.common.unlockFor5', 'Unlock for $5')}</button>
        <button class="pro-report-block__unlock-btn pro-report-block__unlock-btn--secondary" data-open-pricing-modal data-context="security">${t('reports.common.goPro30', 'Go Pro — $30/mo')}</button>
      </div>
      <p class="pro-report-block__unlock-hint">${t('reports.common.proUnlocksAll', 'Pro unlocks all reports. Single purchase unlocks only this scan.')}</p>
    </div>
  `;
}

function safeOpenProPaywall(payload = {}) {
  try {
    if (typeof window.openProPaywall === 'function') {
      window.openProPaywall(payload);
      return true;
    }
    if (window.ProAccess && typeof window.ProAccess.openProPaywall === 'function') {
      window.ProAccess.openProPaywall(payload);
      return true;
    }
    if (window.PricingModal && typeof window.PricingModal.open === 'function') {
      window.PricingModal.open();
      return true;
    }
  } catch (err) {
    return false;
  }

  return false;
}

function ensureProStyles() {
  if (document.getElementById('pro-lock-styles')) return;
  const style = document.createElement('style');
  style.id = 'pro-lock-styles';
  style.textContent = `
    .pro-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(var(--accent-primary-rgb), 0.4);
      background: rgba(var(--accent-primary-rgb), 0.1);
      color: var(--accent-primary);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .pro-locked {
      position: relative;
      border: 1px dashed rgba(var(--accent-primary-rgb), 0.3);
      border-radius: 12px;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.02);
      overflow: hidden;
    }
    .pro-locked__header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    .pro-locked__list {
      margin: 0;
      padding-left: 1.25rem;
      color: var(--r-text-muted, #6B7280);
      font-size: 0.9rem;
    }
    .pro-locked__blur {
      position: absolute;
      inset: 0;
      backdrop-filter: blur(3px);
      background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 60%);
      pointer-events: none;
    }
    .pro-locked__buttons {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    .pro-locked__unlock {
      position: relative;
      padding: 0.55rem 1rem;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .pro-locked__unlock--primary {
      border: none;
      background: linear-gradient(135deg, #5bf4e7, #0AFFEF);
      color: #000;
    }
    .pro-locked__unlock--primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(91, 244, 231, 0.4);
    }
    .pro-locked__unlock--secondary {
      border: 1px solid #5bf4e7;
      background: transparent;
      color: #5bf4e7;
    }
    .pro-locked__unlock--secondary:hover {
      background: rgba(91, 244, 231, 0.1);
    }
  `;
  document.head.appendChild(style);
}

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  const resultsDiv = document.getElementById('results');
  
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  resultsDiv.classList.add('hidden');
  resultsDiv.setAttribute('hidden', '');

  setTimeout(() => {
    errorDiv.classList.add('hidden');
  }, 5000);
}
