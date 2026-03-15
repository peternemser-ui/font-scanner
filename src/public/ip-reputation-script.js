// IP/Domain Reputation Analyzer JavaScript
// Frontend rendering and API interaction for reputation analysis

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'ip-reputation';

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

/**
 * Translate severity/priority labels from server data
 */
function translateSeverity(severity) {
  const s = (severity || 'medium').toLowerCase();
  return t('reports.common.severity.' + s, severity);
}

function translatePriority(priority) {
  const p = (priority || 'medium').toLowerCase();
  return t('reports.common.severity.' + p, priority);
}

// Function to get analysis steps with current translations
// Called at runtime to ensure i18n is loaded
function getAnalysisSteps() {
  return [
    {
      label: t('loader.resolvingIp', 'Resolving IP and domain info'),
      detail: t('loader.performingDns', 'Performing DNS lookups and IP resolution...')
    },
    {
      label: t('loader.checkingBlacklists', 'Checking 25+ DNS blacklists'),
      detail: t('loader.scanningSpamhaus', 'Scanning Spamhaus, Barracuda, SpamCop, SORBS, and more...')
    },
    {
      label: t('loader.analyzingSslCert', 'Analyzing SSL/TLS certificate'),
      detail: t('loader.verifyingCertificate', 'Verifying certificate validity, expiry, and security...')
    },
    {
      label: t('loader.scanningPorts', 'Scanning security ports'),
      detail: t('loader.checkingServices', 'Checking for exposed services and attack vectors...')
    },
    {
      label: t('loader.testingEmail', 'Testing email deliverability'),
      detail: t('loader.verifyingSpf', 'Verifying SPF, DKIM, DMARC records...')
    },
    {
      label: t('loader.checkingDnsHealth', 'Checking DNS health'),
      detail: t('loader.analyzingRecords', 'Analyzing NS, MX, CAA records and configuration...')
    },
    {
      label: t('loader.queryingThreat', 'Querying threat intelligence'),
      detail: t('loader.scanningThreats', 'Scanning threat databases and security feeds...')
    },
    {
      label: t('loader.generatingReputationReport', 'Generating reputation report'),
      detail: t('loader.compilingFindings', 'Compiling findings and recommendations...')
    }
  ];
}

// Expose displayReputationResults globally EARLY so report-ui.js can find it during billing return
// (function declarations are hoisted, so displayReputationResults exists even though it's defined below)
window.displayReputationResults = displayReputationResults;

let currentResults = null;
// Also expose as window.currentResults for PricingModal to find
Object.defineProperty(window, 'currentResults', {
  get: () => currentResults,
  set: (val) => { currentResults = val; }
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  const analyzeButton = document.getElementById('analyzeButton');
  const urlInput = document.getElementById('urlInput');

  analyzeButton.addEventListener('click', () => analyzeReputation());

  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      analyzeReputation();
    }
  });

  // Check for stored report or auto-start scan
  (async function initFromUrlParams() {
    // Ensure i18n translations are loaded before rendering any report content
    if (window.i18n && typeof window.i18n.init === 'function' && !window.i18n.initialized) {
      try { await window.i18n.init(); } catch (e) { /* i18n will use fallback */ }
    }

    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('report_id') || '';
    const autoUrl = params.get('url') || (typeof window.getUrlParameter === 'function' ? window.getUrlParameter() : '');
    const billingSuccess = params.get('billing_success') === 'true';

    console.log('[IP Reputation] initFromUrlParams starting:', { reportId, autoUrl, billingSuccess });

    // If we have a report_id, set it immediately so hasAccess checks work
    if (reportId) {
      document.body.setAttribute('data-report-id', reportId);
    }

    // Fill URL input if we have a URL
    if (autoUrl) {
      urlInput.value = autoUrl;
    }

    // If returning from billing, wait for billing return processing to complete
    // This ensures the purchase is verified before we try to display the report
    if (billingSuccess && !window.__smBillingReturnComplete) {
      console.log('[IP Reputation] Waiting for billing return processing...');
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
      console.log('[IP Reputation] Billing return processing complete');
      // After billing return, report-ui.js should have displayed the report
      // Show results container if it was hidden
      const resultsDiv = document.getElementById('results');
      if (resultsDiv) resultsDiv.classList.remove('hidden');
      return;
    }

    // Recovery: Check sessionStorage for checkout data when billing params are missing from URL
    // This handles cases where Stripe redirect loses the URL parameters
    const checkoutReportId = sessionStorage.getItem('sm_checkout_report_id');
    const checkoutUrl = sessionStorage.getItem('sm_checkout_url');
    if (checkoutReportId && checkoutUrl && !billingSuccess && !reportId) {
      console.log('[IP Reputation] Found checkout data in sessionStorage, checking if purchase completed...', { checkoutReportId, checkoutUrl });

      // Fetch billing status to verify purchase
      if (window.ProReportBlock?.fetchBillingStatus) {
        await window.ProReportBlock.fetchBillingStatus(true);

        if (window.ProReportBlock.hasAccess(checkoutReportId)) {
          console.log('[IP Reputation] Purchase confirmed! Attempting to load stored report...');
          document.body.setAttribute('data-report-id', checkoutReportId);
          urlInput.value = checkoutUrl;

          // Try to load from database storage
          if (window.ReportStorage) {
            const loaded = await window.ReportStorage.tryLoadAndDisplay(checkoutReportId, displayReputationResults);
            if (loaded) {
              console.log('[IP Reputation] Stored report loaded successfully after recovery');
              const resultsDiv = document.getElementById('results');
              if (resultsDiv) resultsDiv.classList.remove('hidden');
              sessionStorage.removeItem('sm_checkout_url');
              sessionStorage.removeItem('sm_checkout_report_id');
              return;
            }
          }

          // If no stored report, run scan with preserved report ID
          console.log('[IP Reputation] No stored report found, running scan with preserved report ID');
          sessionStorage.removeItem('sm_checkout_url');
          sessionStorage.removeItem('sm_checkout_report_id');
          setTimeout(() => analyzeReputation({ preserveReportId: true }), 500);
          return;
        } else {
          console.log('[IP Reputation] Purchase not confirmed, clearing checkout data');
          sessionStorage.removeItem('sm_checkout_url');
          sessionStorage.removeItem('sm_checkout_report_id');
        }
      }
    }

    // If we have a report_id (not from billing return), try to load the stored report first
    if (reportId && window.ReportStorage) {
      console.log('[IP Reputation] Checking for stored report:', reportId);

      // Fetch billing status to ensure we have access
      if (window.ProReportBlock?.fetchBillingStatus) {
        console.log('[IP Reputation] Fetching billing status for report recall...');
        await window.ProReportBlock.fetchBillingStatus(true);
        console.log('[IP Reputation] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportId));
      }

      const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displayReputationResults);
      if (loaded) {
        console.log('[IP Reputation] Stored report loaded successfully');
        // Show results container
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) resultsDiv.classList.remove('hidden');
        return; // Don't auto-scan
      } else {
        console.log('[IP Reputation] No stored report found or failed to load');

        // If user has purchased this report but no stored data, auto-run scan
        if (autoUrl && window.ProReportBlock?.hasAccess && window.ProReportBlock.hasAccess(reportId)) {
          console.log('[IP Reputation] User has access but no stored report - auto-running scan');
          setTimeout(() => {
            analyzeReputation({ preserveReportId: true });
          }, 500);
          return;
        }
      }
    }

    // Auto-start scan if URL parameter is present and no stored report was loaded
    if (autoUrl && !reportId) {
      setTimeout(() => {
        analyzeReputation();
      }, 500);
    }
  })();

  // Event delegation for CSP-compliant accordion/tab/copy handlers
  document.addEventListener('click', function(e) {
    // Toggle accordion
    const toggleAccordion = e.target.closest('[data-action="toggle-iprep-accordion"]');
    if (toggleAccordion) {
      const accordionId = toggleAccordion.getAttribute('data-accordion-id');
      if (accordionId && typeof toggleIpRepFixAccordion === 'function') {
        toggleIpRepFixAccordion(accordionId);
      }
      return;
    }

    // Switch tab
    const switchTab = e.target.closest('[data-action="switch-iprep-tab"]');
    if (switchTab) {
      const accordionId = switchTab.getAttribute('data-accordion-id');
      const tabName = switchTab.getAttribute('data-tab');
      if (accordionId && tabName && typeof switchIpRepFixTab === 'function') {
        switchIpRepFixTab(accordionId, tabName);
      }
      return;
    }

    // Copy code
    const copyCode = e.target.closest('[data-action="copy-iprep-code"]');
    if (copyCode) {
      const codeId = copyCode.getAttribute('data-code-id');
      if (codeId && typeof copyIpRepCode === 'function') {
        copyIpRepCode(codeId);
      }
      return;
    }
  });
});

// Main analysis function
async function analyzeReputation(options = {}) {
  const input = document.getElementById('urlInput').value.trim();
  const analyzeButton = document.getElementById('analyzeButton');

  if (!input) {
    showError(t('reports.common.pleaseEnterUrl', 'Please enter a valid URL'));
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
      console.log('[IP Reputation] Cleared old report_id for new scan');
    }
  } else {
    console.log('[IP Reputation] Preserving report_id for recovery scan:', document.body.getAttribute('data-report-id'));
  }

  // Update button state
  analyzeButton.disabled = true;
  const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
  buttonText.textContent = t('reports.common.analyzing', 'Analyzing...');

  // Setup UI
  const resultsDiv = document.getElementById('results');
  const errorMessage = document.getElementById('errorMessage');

  // For recalled scans (loaded from storage), report_id would be on the body
  // For new scans, we generate a fresh one
  const preservedReportId = document.body.getAttribute('data-report-id') || '';

  // Clear report metadata from previous scans (but preserve URL-based report_id)
  if (!preservedReportId) {
    document.body.removeAttribute('data-report-id');
  }
  document.body.removeAttribute('data-sm-screenshot-url');
  document.body.removeAttribute('data-sm-scan-started-at');

  resultsDiv.classList.add('hidden');
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
    padding: clamp(0.75rem, 2vw, 1rem);
    background: rgba(var(--accent-primary-rgb), 0.05);
    border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
    border-radius: 6px;
    text-align: center;
    overflow: visible;
  `;
  loaderMessageEl.innerHTML = `
    <div style="overflow-x: auto; overflow-y: visible; -webkit-overflow-scrolling: touch;">
      <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: var(--accent-primary); font-family: monospace; text-shadow: 2px 2px 0px rgba(var(--accent-primary-rgb), 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
    </div>
    <p style="margin: 0.75rem 0 0 0; font-size: clamp(0.75rem, 2.5vw, 0.9rem); color: var(--accent-primary); font-weight: 600; letter-spacing: 0.05em; padding: 0 0.5rem;">
      ${t('loader.checkingIpReputation', 'Checking IP reputation and blocklist status...')}
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(var(--accent-primary-rgb), 0.7); padding: 0 0.5rem;">
      ${t('loader.mayTake15to30Seconds', 'This may take 15-30 seconds')}
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
        60% { color: #8b5cf6; }
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

      /* Hide ASCII art on very small screens */
      @media (max-width: 480px) {
        .ascii-art-responsive {
          display: none;
        }
        #patience-message > div {
          display: none;
        }
        #patience-message p:first-of-type {
          font-size: 1rem !important;
          margin-top: 0 !important;
        }
      }

      /* Further optimize for extra small screens */
      @media (max-width: 375px) {
        #patience-message {
          padding: 0.5rem !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Use getAnalysisSteps() to get translated steps at runtime
  loader.start(getAnalysisSteps(), '🌐 ' + t('loader.analyzingIpReputation', 'IP REPUTATION ANALYZER'), 25);

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

    // Call reputation API
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const response = await fetch('/api/ip-reputation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({ input, scanStartedAt, lang: window.i18n?.getActiveLocale?.() || document.documentElement.lang || 'en' }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.code === 'SCAN_QUOTA_EXCEEDED') {
        const limit = errorData.scansLimit || 10;
        loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
        return;
      }
      throw new Error(errorData.message || errorData.error || t('reports.ipReputation.analysisFailed', 'Reputation analysis failed'));
    }

    const results = await response.json();
    currentResults = results;

    // Set report metadata from API response
    const reportId = results && results.reportId ? String(results.reportId) : '';
    const screenshotUrl = results && results.screenshotUrl ? String(results.screenshotUrl) : '';
    if (reportId) {
      if (window.ReportUI && typeof window.ReportUI.setCurrentReportId === 'function') {
        window.ReportUI.setCurrentReportId(reportId);
      } else {
        document.body.setAttribute('data-report-id', reportId);
      }
    }
    if (screenshotUrl) {
      document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
    }

    // Complete the loader
    loader.complete();

    // Show results after animation completes
    setTimeout(() => {
      displayReputationResults(results);
      resultsDiv.classList.remove('hidden');
      window.__REPORT_READY__ = true;
      window.dispatchEvent(new CustomEvent('scan:completed'));
      window.dispatchEvent(new CustomEvent('report:ready'));
    }, 1000);

  } catch (error) {
    console.error('Reputation analysis error:', error);
    loader.showError(t('reports.ipReputation.analysisFailedWithError', 'Reputation analysis failed: {{error}}', { error: error.message }));
  } finally {
    // Reset button state
    const analyzeButton = document.getElementById('analyzeButton');
    analyzeButton.disabled = false;
    const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
    buttonText.textContent = t('reports.common.analyze', 'Analyze');
  }
}

// Display complete reputation results
async function displayReputationResults(data) {
  // Ensure i18n is loaded before rendering (prevents English fallback on fast stored-report loads)
  if (window.i18n && !window.i18n.initialized) {
    try { await window.i18n.init(); } catch (e) { /* fallback */ }
  }

  if (!data || typeof data !== 'object' || typeof data === 'string') { console.error('[IPReputation] displayResults received invalid data:', data); return; }
  const resultsContent = document.getElementById('resultsContent');
  resultsContent.innerHTML = '';

  const reportInput = (data && data.input) || (document.getElementById('urlInput')?.value || '').trim();
  const scanStartedAt = data.scanStartedAt || window.SM_SCAN_STARTED_AT || new Date().toISOString();
  const analyzerKey = window.SM_ANALYZER_KEY || 'ip-reputation';

  // Check for preserved report_id from URL params (recall scan)
  const params = new URLSearchParams(window.location.search);
  const preservedReportId = params.get('report_id') || '';

  // Use preserved report_id if available, otherwise generate new one
  let reportId = preservedReportId || null;
  if (!reportId) {
    if (window.ReportUI && typeof window.ReportUI.makeReportId === 'function') {
      reportId = window.ReportUI.makeReportId({
        analyzerKey,
        normalizedUrl: reportInput,
        startedAtISO: scanStartedAt
      });
    } else if (window.ReportUI && typeof window.ReportUI.computeReportId === 'function') {
      reportId = window.ReportUI.computeReportId(reportInput, scanStartedAt, analyzerKey);
    }
  }

  // Check if report is unlocked (follows SEO pattern - checks both new and legacy billing)
  const isUnlocked = !!(
    // Pro/Day Pass subscribers have global access (no reportId needed)
    (window.ProReportBlock && typeof window.ProReportBlock.isProSubscriber === 'function' && window.ProReportBlock.isProSubscriber()) ||
    (reportId && (
      // purchased single report
      (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function' && window.ProReportBlock.hasAccess(reportId)) ||
      // Legacy CreditsManager
      (window.CreditsManager && (
        (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) ||
        (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId))
      ))
    ))
  );
  console.log('[IP Reputation] isUnlocked check:', { reportId, isUnlocked, hasProReportBlock: !!window.ProReportBlock });

  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    resultsContent.setAttribute('data-sm-report-id', reportId);
  }

  // Build screenshot URL for report display
  const screenshotUrl = data.screenshotUrl || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');
  if (screenshotUrl) {
    document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
  }
  const screenshots = screenshotUrl ? [{ src: screenshotUrl, alt: `Screenshot of ${data.input || data.hostname || reportInput}`, device: '' }] : [];

  // Build summary donuts (matching SEO pattern)
  const summary = [
    { label: t('reports.ipReputation.overall', 'Overall'), score: data.overallScore || 0 },
    { label: t('reports.ipReputation.blacklist', 'Blacklist'), score: data.blacklistScore || 0 },
    { label: t('reports.ipReputation.email', 'Email'), score: data.emailScore || 0 },
    { label: t('reports.ipReputation.sslTls', 'SSL/TLS'), score: data.sslScore || 0 },
    { label: t('reports.ipReputation.dnsHealth', 'DNS Health'), score: data.dnsScore || 0 },
    { label: t('reports.ipReputation.portSecurity', 'Port Security Scan'), score: data.portSecurityScore || 0 }
  ];

  // Build sections array for accordions
  const sections = [];

  // Blacklist Details Section
  if (data.blacklists && data.blacklists.length > 0) {
    const listed = data.blacklists.filter(bl => bl.listed);
    const clean = data.blacklists.filter(bl => !bl.listed);
    const score = Math.round((clean.length / data.blacklists.length) * 100);
    sections.push({
      id: 'blacklist',
      title: t('reports.ipReputation.dnsBlacklistStatus', 'DNS Blacklist Status'),
      scoreTextRight: `${score}/100`,
      contentHTML: createBlacklistContent(data.blacklists)
    });
  }

  // SSL Certificate Section
  if (data.sslCert) {
    sections.push({
      id: 'ssl',
      title: t('reports.ipReputation.sslTlsCertificate', 'SSL/TLS Certificate'),
      scoreTextRight: `${Math.round(data.sslScore || 0)}/100`,
      contentHTML: createSSLContent(data.sslCert, data.sslScore)
    });
  }

  // DNS Health Section
  if (data.dnsHealth) {
    sections.push({
      id: 'dns-health',
      title: t('reports.ipReputation.dnsHealth', 'DNS Health'),
      scoreTextRight: `${Math.round(data.dnsScore || 0)}/100`,
      contentHTML: createDNSHealthContent(data.dnsHealth, data.dnsScore)
    });
  }

  // Email Configuration Section
  if (data.emailConfig) {
    let emailScore = 0;
    if (data.emailConfig.spf?.valid) emailScore += 40;
    if (data.emailConfig.dkim?.valid) emailScore += 30;
    if (data.emailConfig.dmarc?.valid) emailScore += 30;
    sections.push({
      id: 'email-deliverability',
      title: t('reports.ipReputation.emailDeliverability', 'Email Deliverability'),
      scoreTextRight: `${Math.round(emailScore)}/100`,
      contentHTML: createEmailContent(data.emailConfig)
    });
  }

  // Hosting & Network Information Section
  if (data.hostingInfo) {
    sections.push({
      id: 'hosting-network',
      title: t('reports.ipReputation.hostingNetwork', 'Hosting & Network Information'),
      contentHTML: createHostingContent(data.hostingInfo)
    });
  }

  // Threat Intelligence Section
  if (data.threatIntel) {
    let threatScore = 100;
    if (data.threatIntel.hasThreats && data.threatIntel.threats) {
      data.threatIntel.threats.forEach(threat => {
        if (threat.severity === 'critical') threatScore -= 40;
        else if (threat.severity === 'high') threatScore -= 25;
        else if (threat.severity === 'medium') threatScore -= 15;
        else if (threat.severity === 'low') threatScore -= 5;
      });
      threatScore = Math.max(0, threatScore);
    }
    sections.push({
      id: 'threat-intelligence',
      title: t('reports.ipReputation.threatIntelligence', 'Threat Intelligence'),
      scoreTextRight: `${Math.round(threatScore)}/100`,
      contentHTML: createThreatContent(data.threatIntel)
    });
  }

  // Recommendations Section (Pro) - follows SEO pattern with conditional content
  if (data.recommendations && data.recommendations.length > 0) {
    sections.push({
      id: 'report-recommendations',
      title: t('reports.common.reportRecommendations', 'Recommendations & Fixes'),
      isPro: true,
      locked: !isUnlocked,
      context: 'ip-reputation',
      reportId: reportId,
      contentHTML: createRecommendationsContent(data.recommendations)
    });
  }

  // AI Strategic Analysis (Pro)
  sections.push({
    id: 'ai-strategic-analysis',
    title: t('reports.ai.strategicTitle', 'AI Strategic Analysis'),
    isPro: true, locked: !isUnlocked, context: 'ip-reputation', reportId: reportId,
    scoreTextRight: null,
    contentHTML: '<div id="ai-strategic-content">' + (window.AIRecommendations && window.AIRecommendations.renderLoadingAnimation ? window.AIRecommendations.renderLoadingAnimation() : '<div style="padding:1.5rem;text-align:center;color:var(--r-text-muted,#6B7280);">' + t('reports.ai.loading', 'Analyzing your results...') + '</div>') + '</div>'
  });

  // Use ReportContainer.create() for consistent rendering (like SEO)
  if (window.ReportContainer && typeof window.ReportContainer.create === 'function') {
    const reportHTML = window.ReportContainer.create({
      url: data.input || data.hostname || '',
      timestamp: data.timestamp || new Date().toISOString(),
      mode: 'ip-reputation',
      title: t('reports.ipReputation.title', 'IP Reputation Analysis'),
      subtitle: '',
      summary,
      sections,
      screenshots,
      proBlock: true,
      proBlockOptions: {
        context: 'ip-reputation',
        features: ['pdf', 'excel', 'csv', 'share'],
        title: t('reports.common.unlockReport', 'Unlock Report'),
        subtitle: t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.'),
        reportId
      }
    });
    // Wrap in report-scope for proper CSS styling of accordions
    resultsContent.innerHTML = `<div class="report-scope">${reportHTML}</div>`;
  } else {
    // Fallback: manual rendering with report-scope wrapper
    let fallbackHTML = `<div class="report-header"><h1 class="report-header__title">${t('reports.ipReputation.title', 'IP Reputation Analysis')}</h1></div>`;
    sections.forEach(section => {
      if (window.ReportAccordion && window.ReportAccordion.createSection) {
        fallbackHTML += window.ReportAccordion.createSection(section);
      }
    });
    resultsContent.innerHTML = `<div class="report-scope">${fallbackHTML}</div>`;
  }

  // Fetch AI strategic analysis content
  if (window.AIRecommendations) {
    const locale = document.documentElement.lang || (window.i18n && window.i18n.locale) || 'en';
    window.AIRecommendations.fetchAndRender('ai-strategic-content', reportId, 'ip-reputation', data, locale, { skipHeader: true });
  }
  if (window.SelfImprovement) {
    window.SelfImprovement.integrate({ data: data, analyzerType: 'ip-reputation', donutLabels: {}, resultsContent: resultsContent, reportId: reportId });
  }

  // Initialize ReportAccordion interactions
  if (window.ReportAccordion && window.ReportAccordion.initInteractions) {
    window.ReportAccordion.initInteractions();
  }

  if (window.ReportUI && reportId) {
    window.ReportUI.setCurrentReportId(reportId);
  }

  if (window.CreditsManager && reportId) {
    const render = window.CreditsManager.renderPaywallState || window.CreditsManager.updateProUI;
    if (typeof render === 'function') render(reportId);
  }

  // Auto-save report snapshot if user has access (Pro or purchased)
  if (reportId && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
    window.ReportStorage.autoSaveIfEligible(reportId, data, {
      siteUrl: reportInput,
      analyzerType: 'ip-reputation',
      scannedAt: scanStartedAt
    });
  }
}

// Expose displayReputationResults globally so report-ui.js can use it for billing return
window.displayReputationResults = displayReputationResults;

// Create Blacklist Details Section
function createBlacklistSection(blacklists) {
  const listed = blacklists.filter(bl => bl.listed);
  const clean = blacklists.filter(bl => !bl.listed);
  
  const score = Math.round((clean.length / blacklists.length) * 100);

  const content = `
    <p style="color: var(--r-text-faint, #9CA3AF); margin-bottom: 1.5rem;">${t('reports.ipReputation.checkedAgainstDatabases', 'Checked against {{count}} major DNSBL databases', { count: blacklists.length })}</p>

    ${listed.length > 0 ? `
      <div style="background: rgba(255, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h3 style="color: #ef4444; margin-top: 0;">⚠️ ${t('reports.ipReputation.listedOnBlacklists', 'Listed on {{count}} Blacklist(s)', { count: listed.length })}</h3>
        <div style="display: grid; gap: 1rem;">
          ${listed.map(bl => `
            <div style="background: var(--r-surface-2, #F8FAFC); padding: 1rem; border-radius: 4px;">
              <div style="font-weight: 600; color: #ef4444; margin-bottom: 0.5rem;">${bl.name}</div>
              <div style="color: var(--r-text, #111827); font-size: 0.9rem;">${bl.description || t('reports.ipReputation.ipDomainListed', 'This IP/domain is listed on this blacklist')}</div>
              ${bl.details ? `<div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; margin-top: 0.5rem;">${bl.details}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 8px; padding: 1.5rem;">
      <h3 style="color: #22c55e; margin-top: 0;">✓ ${t('reports.ipReputation.cleanOnBlacklists', 'Clean on {{count}} Blacklist(s)', { count: clean.length })}</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        ${clean.map(bl => `
          <span style="background: rgba(0, 255, 65, 0.1); border: 1px solid rgba(0, 255, 65, 0.3); padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem; color: #22c55e;">
            ${bl.name}
          </span>
        `).join('')}
      </div>
    </div>
  `;

  return ReportAccordion.createSection({
    id: 'blacklist',
    title: t('reports.ipReputation.dnsBlacklistStatus', 'DNS Blacklist Status'),
    scoreTextRight: `${Math.round(score)}/100`,
    contentHTML: content
  });
}

// Create Email Configuration Section
function createEmailSection(emailConfig) {
  const content = `
    <div style="display: grid; gap: 1.5rem; margin-top: 1.5rem;">
        <!-- SPF Record -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-left: 4px solid ${emailConfig.spf?.valid ? '#22c55e' : '#ef4444'}; padding: 1rem; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="margin: 0; color: var(--r-text, #111827);">${t('reports.ipReputation.spf', 'SPF (Sender Policy Framework)')}</h3>
            <span style="background: ${emailConfig.spf?.valid ? 'rgba(0, 255, 65, 0.2)' : 'rgba(255, 68, 68, 0.2)'}; color: ${emailConfig.spf?.valid ? '#22c55e' : '#ef4444'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
              ${emailConfig.spf?.valid ? t('reports.common.valid', '✓ Valid') : t('reports.common.missingInvalid', '✗ Missing/Invalid')}
            </span>
          </div>
          <div style="color: #cccccc; font-size: 0.9rem; font-family: 'JetBrains Mono', monospace; word-break: break-all;">
            ${emailConfig.spf?.record || t('reports.ipReputation.noSpfRecord', 'No SPF record found')}
          </div>
          ${emailConfig.spf?.issues ? `<div style="color: #ffa500; margin-top: 0.5rem; font-size: 0.85rem;">⚠️ ${emailConfig.spf.issues}</div>` : ''}
        </div>

        <!-- DKIM Record -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-left: 4px solid ${emailConfig.dkim?.valid ? '#22c55e' : '#ffa500'}; padding: 1rem; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="margin: 0; color: var(--r-text, #111827);">${t('reports.ipReputation.dkim', 'DKIM (DomainKeys Identified Mail)')}</h3>
            <span style="background: ${emailConfig.dkim?.valid ? 'rgba(0, 255, 65, 0.2)' : 'rgba(255, 165, 0, 0.2)'}; color: ${emailConfig.dkim?.valid ? '#22c55e' : '#ffa500'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
              ${emailConfig.dkim?.valid ? t('reports.common.configured', '✓ Configured') : t('reports.common.checkRequired', 'ℹ️ Check Required')}
            </span>
          </div>
          <div style="color: #cccccc; font-size: 0.9rem;">
            ${emailConfig.dkim?.status || t('reports.ipReputation.dkimRequiresLookup', 'DKIM requires selector-specific lookup')}
          </div>
        </div>

        <!-- DMARC Record -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-left: 4px solid ${emailConfig.dmarc?.valid ? '#22c55e' : '#ef4444'}; padding: 1rem; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="margin: 0; color: var(--r-text, #111827);">${t('reports.ipReputation.dmarc', 'DMARC (Domain-based Message Authentication)')}</h3>
            <span style="background: ${emailConfig.dmarc?.valid ? 'rgba(0, 255, 65, 0.2)' : 'rgba(255, 68, 68, 0.2)'}; color: ${emailConfig.dmarc?.valid ? '#22c55e' : '#ef4444'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
              ${emailConfig.dmarc?.valid ? t('reports.common.valid', '✓ Valid') : t('reports.common.missingInvalid', '✗ Missing/Invalid')}
            </span>
          </div>
          <div style="color: #cccccc; font-size: 0.9rem; font-family: 'JetBrains Mono', monospace; word-break: break-all;">
            ${emailConfig.dmarc?.record || t('reports.ipReputation.noDmarcRecord', 'No DMARC record found')}
          </div>
          ${emailConfig.dmarc?.policy ? `<div style="color: #06b6d4; margin-top: 0.5rem; font-size: 0.85rem;">${t('reports.ipReputation.policy', 'Policy')}: ${emailConfig.dmarc.policy}</div>` : ''}
        </div>
      </div>
  `;

  // Calculate score based on SPF, DKIM, DMARC validity
  let score = 0;
  if (emailConfig.spf?.valid) score += 40;
  if (emailConfig.dkim?.valid) score += 30;
  if (emailConfig.dmarc?.valid) score += 30;

  return ReportAccordion.createSection({
    id: 'email-deliverability',
    title: t('reports.ipReputation.emailDeliverability', 'Email Deliverability'),
    scoreTextRight: `${Math.round(score)}/100`,
    contentHTML: content
  });
}

// Create Hosting & Network Information Section
function createHostingSection(hostingInfo) {
  const content = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
        <!-- Location Info -->
        <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #22c55e; margin-top: 0;">📍 ${t('reports.ipReputation.location', 'Location')}</h3>
          <div style="display: grid; gap: 0.5rem;">
            <div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.country', 'Country')}:</span> ${hostingInfo.country || t('reports.common.unknown', 'Unknown')} ${hostingInfo.countryCode ? `(${hostingInfo.countryCode})` : ''}</div>
            ${hostingInfo.city ? `<div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.city', 'City')}:</span> ${hostingInfo.city}</div>` : ''}
            ${hostingInfo.region ? `<div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.region', 'Region')}:</span> ${hostingInfo.region}</div>` : ''}
            ${hostingInfo.timezone ? `<div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.timezone', 'Timezone')}:</span> ${hostingInfo.timezone}</div>` : ''}
          </div>
        </div>

        <!-- ISP Info -->
        <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #06b6d4; margin-top: 0;">🔌 ${t('reports.ipReputation.ispHosting', 'ISP/Hosting')}</h3>
          <div style="display: grid; gap: 0.5rem;">
            <div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.provider', 'Provider')}:</span> ${hostingInfo.isp || t('reports.common.unknown', 'Unknown')}</div>
            ${hostingInfo.org ? `<div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.organization', 'Organization')}:</span> ${hostingInfo.org}</div>` : ''}
            ${hostingInfo.asn ? `<div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.asn', 'ASN')}:</span> ${hostingInfo.asn}</div>` : ''}
            ${hostingInfo.asnName ? `<div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.asName', 'AS Name')}:</span> ${hostingInfo.asnName}</div>` : ''}
          </div>
        </div>

        <!-- Network Type -->
        ${hostingInfo.isProxy !== undefined || hostingInfo.isVpn !== undefined || hostingInfo.isTor !== undefined ? `
          <div style="background: rgba(255, 165, 0, 0.05); border: 1px solid rgba(255, 165, 0, 0.2); border-radius: 8px; padding: 1.5rem;">
            <h3 style="color: #ffa500; margin-top: 0;">🔒 ${t('reports.ipReputation.networkType', 'Network Type')}</h3>
            <div style="display: grid; gap: 0.5rem;">
              ${hostingInfo.isProxy !== undefined ? `<div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.proxy', 'Proxy')}:</span> ${hostingInfo.isProxy ? '⚠️ ' + t('reports.common.yes', 'Yes') : '✓ ' + t('reports.common.no', 'No')}</div>` : ''}
              ${hostingInfo.isVpn !== undefined ? `<div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.vpn', 'VPN')}:</span> ${hostingInfo.isVpn ? '⚠️ ' + t('reports.common.yes', 'Yes') : '✓ ' + t('reports.common.no', 'No')}</div>` : ''}
              ${hostingInfo.isTor !== undefined ? `<div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.tor', 'Tor')}:</span> ${hostingInfo.isTor ? '⚠️ ' + t('reports.common.yes', 'Yes') : '✓ ' + t('reports.common.no', 'No')}</div>` : ''}
              ${hostingInfo.isHosting !== undefined ? `<div style="color: var(--r-text, #111827);"><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.hosting', 'Hosting')}:</span> ${hostingInfo.isHosting ? t('reports.common.yes', 'Yes') : t('reports.common.no', 'No')}</div>` : ''}
            </div>
          </div>
        ` : ''}
      </div>
  `;

  return ReportAccordion.createSection({
    id: 'hosting-network',
    title: t('reports.ipReputation.hostingNetwork', 'Hosting & Network Information'),
    contentHTML: content
  });
}

// Create Threat Intelligence Section
function createThreatSection(threatIntel) {
  const content = `
    <div style="background: ${threatIntel.hasThreats ? 'rgba(255, 68, 68, 0.1)' : 'rgba(0, 255, 65, 0.05)'}; border: 2px solid ${threatIntel.hasThreats ? '#ef4444' : 'rgba(0, 255, 65, 0.2)'}; border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: ${threatIntel.hasThreats ? '#ef4444' : '#22c55e'}; margin-top: 0;">
          ${threatIntel.hasThreats ? '⚠️ ' + t('reports.ipReputation.threatsDetected', 'Threats Detected') : '✓ ' + t('reports.ipReputation.noKnownThreats', 'No Known Threats')}
        </h3>

        ${threatIntel.threats && threatIntel.threats.length > 0 ? `
          <div style="display: grid; gap: 1rem; margin-top: 1rem;">
            ${threatIntel.threats.map(threat => `
              <div style="background: var(--r-surface-2, #F8FAFC); padding: 1rem; border-radius: 4px;">
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 0.5rem;">
                  <div style="font-weight: 600; color: var(--r-text, #111827);">${threat.type}</div>
                  <span style="background: ${getSeverityColor(threat.severity)}; color: #000000; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 1rem; text-transform: uppercase;">
                    ${translateSeverity(threat.severity)}
                  </span>
                </div>
                <div style="color: #cccccc; font-size: 0.9rem;">${threat.description}</div>
                ${threat.source ? `<div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; margin-top: 0.5rem;">${t('reports.ipReputation.source', 'Source')}: ${threat.source}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : `
          <p style="color: #22c55e; margin-top: 1rem;">
            ${t('reports.ipReputation.noMaliciousActivity', 'No known malicious activity or security threats associated with this IP/domain.')}
          </p>
        `}

        ${threatIntel.riskLevel ? `
          <div style="margin-top: 1.5rem; padding: 1rem; background: var(--r-surface-2, #F8FAFC); border-radius: 4px;">
            <div style="color: var(--r-text, #111827); font-weight: 600; margin-bottom: 0.5rem;">${t('reports.ipReputation.riskAssessment', 'Risk Assessment')}</div>
            <div style="color: #cccccc;">${t('reports.ipReputation.overallRiskLevel', 'Overall Risk Level')}: <span style="color: ${getRiskColor(threatIntel.riskLevel)}; font-weight: 600;">${translateSeverity(threatIntel.riskLevel)}</span></div>
          </div>
        ` : ''}
      </div>
  `;

  // Calculate score: 100 if no threats, reduce based on severity
  let score = 100;
  if (threatIntel.hasThreats && threatIntel.threats) {
    threatIntel.threats.forEach(threat => {
      if (threat.severity === 'critical') score -= 40;
      else if (threat.severity === 'high') score -= 25;
      else if (threat.severity === 'medium') score -= 15;
      else if (threat.severity === 'low') score -= 5;
    });
    score = Math.max(0, score);
  }

  return ReportAccordion.createSection({
    id: 'threat-intelligence',
    title: t('reports.ipReputation.threatIntelligence', 'Threat Intelligence'),
    scoreTextRight: `${Math.round(score)}/100`,
    contentHTML: content
  });
}

// Create Recommendations Section
function createRecommendationsSection(recommendations, options = {}) {
  const { locked = false, context = 'ip-reputation', reportId = null } = options;
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  const sorted = recommendations.sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  const content = `
    <div style="display: grid; gap: 1rem; margin-top: 1.5rem;">
        ${sorted.map(rec => `
          <div style="background: var(--r-surface-2, #F8FAFC); border-left: 4px solid ${getPriorityColor(rec.priority)}; padding: 1.5rem; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="margin: 0; color: var(--r-text, #111827);">${rec.title}</h3>
              <span style="background: ${getPriorityColor(rec.priority)}; color: #000000; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
                ${translatePriority(rec.priority)}
              </span>
            </div>
            <div style="color: #cccccc; margin-bottom: 1rem;">${rec.description}</div>
            ${rec.action ? `
              <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
                <div style="color: #22c55e; font-weight: 600; margin-bottom: 0.5rem;">${t('reports.common.actionRequired', 'Action Required')}:</div>
                <div style="color: var(--r-text, #111827); font-size: 0.9rem;">${rec.action}</div>
              </div>
            ` : ''}
            ${rec.impact ? `
              <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem;">
                <strong>${t('reports.common.impact', 'Impact')}:</strong> ${rec.impact}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
  `;

  return ReportAccordion.createSection({
    id: 'report-recommendations',
    title: t('reports.common.reportAndRecommendations', 'Recommendations & Fixes'),
    isPro: true,
    locked: locked,
    context: context,
    reportId: reportId,
    contentHTML: content
  });
}

// Utility functions
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

function getAccentPrimaryHex() {
  const computed = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-primary')
    .trim();
  if (computed) return computed;

  const isLight = document.body?.classList?.contains('white-theme');
  return isLight ? '#dd3838' : '#5bf4e7';
}

// Standard: Excellent (90-100), Good (75-89), Needs Work (50-74), Critical (<50)
function getGrade(score) {
  if (score >= 90) return t('reports.common.grades.excellent', 'Excellent');
  if (score >= 75) return t('reports.common.grades.good', 'Good');
  if (score >= 50) return t('reports.common.grades.needsWork', 'Needs Work');
  return t('reports.common.grades.critical', 'Critical');
}

function getStatus(score) {
  return getGrade(score);
}

function getPriorityColor(priority) {
  switch (priority.toLowerCase()) {
    case 'high': return '#ef4444';
    case 'medium': return '#ffa500';
    case 'low': return '#06b6d4';
    default: return '#808080';
  }
}

function getSeverityColor(severity) {
  switch (severity.toLowerCase()) {
    case 'critical': return '#ff0000';
    case 'high': return '#ef4444';
    case 'medium': return '#ffa500';
    case 'low': return '#ffff00';
    default: return '#808080';
  }
}

function getRiskColor(risk) {
  switch (risk.toLowerCase()) {
    case 'critical': return '#ff0000';
    case 'high': return '#ef4444';
    case 'medium': return '#ffa500';
    case 'low': return getAccentPrimaryHex();
    case 'minimal': return getAccentPrimaryHex();
    default: return '#808080';
  }
}

// Content-only helper functions (for use with ReportContainer.create())
function createBlacklistContent(blacklists) {
  const listed = blacklists.filter(bl => bl.listed);
  const clean = blacklists.filter(bl => !bl.listed);

  return `
    <p style="color: var(--text-secondary, #808080); margin-bottom: 1.5rem;">${t('reports.ipReputation.checkedAgainstDatabases', 'Checked against {{count}} major DNSBL databases', { count: blacklists.length })}</p>

    ${listed.length > 0 ? `
      <div style="background: rgba(255, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h3 style="color: #ef4444; margin-top: 0;">⚠️ ${t('reports.ipReputation.listedOnBlacklists', 'Listed on {{count}} Blacklist(s)', { count: listed.length })}</h3>
        <div style="display: grid; gap: 1rem;">
          ${listed.map(bl => `
            <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); padding: 1rem; border-radius: 4px;">
              <div style="font-weight: 600; color: #ef4444; margin-bottom: 0.5rem;">${bl.name}</div>
              <div style="color: var(--text-primary, #ffffff); font-size: 0.9rem;">${bl.description || t('reports.ipReputation.ipDomainListed', 'This IP/domain is listed on this blacklist')}</div>
              ${bl.details ? `<div style="color: var(--text-secondary, #808080); font-size: 0.85rem; margin-top: 0.5rem;">${bl.details}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div style="background: rgba(var(--accent-primary-rgb), 0.05); border: 1px solid rgba(var(--accent-primary-rgb), 0.2); border-radius: 8px; padding: 1.5rem;">
      <h3 style="color: var(--accent-primary); margin-top: 0;">✓ ${t('reports.ipReputation.cleanOnBlacklists', 'Clean on {{count}} Blacklist(s)', { count: clean.length })}</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        ${clean.map(bl => `
          <span style="background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.3); padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem; color: var(--accent-primary);">
            ${bl.name}
          </span>
        `).join('')}
      </div>
    </div>
  `;
}

function createSSLContent(sslCert, sslScore) {
  if (!sslCert) return '';
  const isValid = sslCert.valid;

  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
      <div style="background: ${isValid ? 'rgba(var(--accent-primary-rgb), 0.05)' : 'rgba(255, 68, 68, 0.05)'}; border: 1px solid ${isValid ? 'rgba(var(--accent-primary-rgb), 0.25)' : 'rgba(255, 68, 68, 0.25)'}; border-radius: 8px; padding: 1.5rem; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">${isValid ? '✅' : '❌'}</div>
        <div style="color: ${isValid ? 'var(--accent-primary)' : '#ef4444'}; font-weight: 600; font-size: 1.2rem;">${isValid ? t('reports.ipReputation.validCertificate', 'Valid Certificate') : t('reports.ipReputation.invalidMissing', 'Invalid/Missing')}</div>
        <div style="color: var(--text-secondary, #808080); font-size: 0.9rem; margin-top: 0.5rem;">${t('reports.common.score', 'Score')}: ${sslScore || 0}/100</div>
      </div>

      ${isValid ? `
      <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: #06b6d4; margin-top: 0;">📋 ${t('reports.ipReputation.certificateDetails', 'Certificate Details')}</h3>
        <div style="display: grid; gap: 0.5rem; font-size: 0.9rem;">
          <div><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.issuer', 'Issuer')}:</span> <span style="color: var(--text-primary, #fff);">${sslCert.issuer}</span></div>
          <div><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.subject', 'Subject')}:</span> <span style="color: var(--text-primary, #fff);">${sslCert.subject}</span></div>
          <div><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.protocol', 'Protocol')}:</span> <span style="color: ${sslCert.protocol === 'TLSv1.3' ? 'var(--accent-primary)' : sslCert.protocol === 'TLSv1.2' ? '#06b6d4' : '#ffa500'};">${sslCert.protocol}</span></div>
          <div><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.cipher', 'Cipher')}:</span> <span style="color: var(--text-primary, #fff);">${sslCert.cipher || 'N/A'}</span></div>
        </div>
      </div>

      <div style="background: ${sslCert.daysUntilExpiry > 30 ? 'rgba(var(--accent-primary-rgb), 0.05)' : sslCert.daysUntilExpiry > 14 ? 'rgba(255, 165, 0, 0.05)' : 'rgba(255, 68, 68, 0.05)'}; border: 1px solid ${sslCert.daysUntilExpiry > 30 ? 'rgba(var(--accent-primary-rgb), 0.2)' : sslCert.daysUntilExpiry > 14 ? 'rgba(255, 165, 0, 0.2)' : 'rgba(255, 68, 68, 0.2)'}; border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: ${sslCert.daysUntilExpiry > 30 ? 'var(--accent-primary)' : sslCert.daysUntilExpiry > 14 ? '#ffa500' : '#ef4444'}; margin-top: 0;">⏰ ${t('reports.ipReputation.validityPeriod', 'Validity Period')}</h3>
        <div style="display: grid; gap: 0.5rem; font-size: 0.9rem;">
          <div><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.validFrom', 'Valid From')}:</span> <span style="color: var(--text-primary, #fff);">${new Date(sslCert.validFrom).toLocaleDateString()}</span></div>
          <div><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.validUntil', 'Valid Until')}:</span> <span style="color: var(--text-primary, #fff);">${new Date(sslCert.validTo).toLocaleDateString()}</span></div>
          <div style="margin-top: 0.5rem; padding: 0.5rem; background: var(--bg-tertiary, rgba(0,0,0,0.3)); border-radius: 4px; text-align: center;">
            <span style="font-size: 1.5rem; font-weight: bold; color: ${sslCert.daysUntilExpiry > 30 ? 'var(--accent-primary)' : sslCert.daysUntilExpiry > 14 ? '#ffa500' : '#ef4444'};">${sslCert.daysUntilExpiry}</span>
            <span style="color: var(--text-secondary, #808080);"> ${t('reports.ipReputation.daysRemaining', 'days remaining')}</span>
          </div>
        </div>
      </div>
      ` : `
      <div style="background: rgba(255, 68, 68, 0.05); border: 1px solid rgba(255, 68, 68, 0.2); border-radius: 8px; padding: 1.5rem; grid-column: span 2;">
        <h3 style="color: #ef4444; margin-top: 0;">⚠️ ${t('reports.ipReputation.certificateIssue', 'Certificate Issue')}</h3>
        <p style="color: var(--text-secondary, #cccccc);">${sslCert.error || t('reports.ipReputation.sslCouldNotBeVerified', 'SSL certificate could not be verified')}</p>
      </div>
      `}
    </div>
    ${sslCert.selfSigned ? `
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 4px;">
        <span style="color: #ffa500;">⚠️ ${t('reports.ipReputation.selfSignedCertificate', 'Self-Signed Certificate')}:</span> <span style="color: var(--text-secondary, #cccccc);">${t('reports.ipReputation.selfSignedWarning', 'This certificate is self-signed and will show warnings in browsers.')}</span>
      </div>
    ` : ''}
  `;
}

function createDNSHealthContent(dnsHealth, dnsScore) {
  if (!dnsHealth) return '';

  return `
    <p style="color: var(--text-secondary, #808080); margin-bottom: 1.5rem;">${t('reports.ipReputation.dnsConfigAnalysis', 'DNS configuration and infrastructure analysis')}</p>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
      <div style="background: rgba(var(--accent-primary-rgb), 0.05); border: 1px solid rgba(var(--accent-primary-rgb), 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: var(--accent-primary); margin-top: 0;">📡 ${t('reports.ipReputation.nameservers', 'Nameservers')}</h3>
        ${dnsHealth.nsRecords && dnsHealth.nsRecords.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${dnsHealth.nsRecords.map(ns => `
              <span style="background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.3); padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem; color: var(--accent-primary); font-family: monospace;">
                ${ns}
              </span>
            `).join('')}
          </div>
          <div style="margin-top: 0.75rem; color: ${dnsHealth.nsRecords.length >= 2 ? 'var(--accent-primary)' : '#ffa500'}; font-size: 0.85rem;">
            ${dnsHealth.nsRecords.length >= 2 ? '✓ ' + t('reports.ipReputation.redundancyOk', 'Redundancy: OK') : '⚠️ ' + t('reports.ipReputation.addMoreNameservers', 'Add more nameservers for redundancy')}
          </div>
        ` : '<p style="color: var(--text-secondary, #808080);">' + t('reports.ipReputation.noNsRecords', 'No NS records found') + '</p>'}
      </div>

      <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: #06b6d4; margin-top: 0;">📧 ${t('reports.ipReputation.mailServers', 'Mail Servers (MX)')}</h3>
        ${dnsHealth.mxRecords && dnsHealth.mxRecords.length > 0 ? `
          <div style="display: grid; gap: 0.5rem;">
            ${dnsHealth.mxRecords.slice(0, 5).map(mx => `
              <div style="display: flex; justify-content: space-between; background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); padding: 0.5rem; border-radius: 4px; font-size: 0.85rem;">
                <span style="color: var(--text-primary, #fff); font-family: monospace;">${mx.exchange}</span>
                <span style="color: #06b6d4;">${t('reports.ipReputation.priority', 'Priority')}: ${mx.priority}</span>
              </div>
            `).join('')}
          </div>
        ` : '<p style="color: var(--text-secondary, #808080);">' + t('reports.ipReputation.noMxRecords', 'No MX records found (email may not be configured)') + '</p>'}
      </div>

      <div style="background: rgba(153, 51, 255, 0.05); border: 1px solid rgba(153, 51, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: #8b5cf6; margin-top: 0;">🔐 ${t('reports.ipReputation.caaRecords', 'CAA Records')}</h3>
        ${dnsHealth.hasCAA ? `
          <div style="display: grid; gap: 0.5rem;">
            ${dnsHealth.caaRecords.map(caa => `
              <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); padding: 0.5rem; border-radius: 4px; font-size: 0.85rem; color: var(--text-primary, #fff);">
                ${caa.issue || caa.issuewild || t('reports.ipReputation.caaRecord', 'CAA record')}
              </div>
            `).join('')}
          </div>
          <div style="margin-top: 0.75rem; color: var(--accent-primary); font-size: 0.85rem;">✓ ${t('reports.ipReputation.caaConfigured', 'CAA configured')}</div>
        ` : `
          <p style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.noCaaRecords', 'No CAA records found')}</p>
          <div style="margin-top: 0.75rem; color: #ffa500; font-size: 0.85rem;">⚠️ ${t('reports.ipReputation.considerAddingCaa', 'Consider adding CAA to restrict certificate issuance')}</div>
        `}
      </div>
    </div>

    ${dnsHealth.issues && dnsHealth.issues.length > 0 ? `
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 8px;">
        <h4 style="color: #ffa500; margin: 0 0 0.75rem 0;">⚠️ ${t('reports.ipReputation.dnsIssuesDetected', 'DNS Issues Detected')}</h4>
        <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary, #cccccc);">
          ${dnsHealth.issues.map(issue => `<li style="margin-bottom: 0.5rem;">${issue}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;
}

function createEmailContent(emailConfig) {
  return `
    <div style="display: grid; gap: 1.5rem;">
      <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); border-left: 4px solid ${emailConfig.spf?.valid ? 'var(--accent-primary)' : '#ef4444'}; padding: 1rem; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="margin: 0; color: var(--text-primary, #ffffff);">${t('reports.ipReputation.spf', 'SPF (Sender Policy Framework)')}</h3>
          <span style="background: ${emailConfig.spf?.valid ? 'rgba(var(--accent-primary-rgb), 0.2)' : 'rgba(255, 68, 68, 0.2)'}; color: ${emailConfig.spf?.valid ? 'var(--accent-primary)' : '#ef4444'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
            ${emailConfig.spf?.valid ? t('reports.common.valid', '✓ Valid') : t('reports.common.missingInvalid', '✗ Missing/Invalid')}
          </span>
        </div>
        <div style="color: var(--text-secondary, #cccccc); font-size: 0.9rem; font-family: 'JetBrains Mono', monospace; word-break: break-all;">
          ${emailConfig.spf?.record || t('reports.ipReputation.noSpfRecord', 'No SPF record found')}
        </div>
        ${emailConfig.spf?.issues ? `<div style="color: #ffa500; margin-top: 0.5rem; font-size: 0.85rem;">⚠️ ${emailConfig.spf.issues}</div>` : ''}
      </div>

      <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); border-left: 4px solid ${emailConfig.dkim?.valid ? 'var(--accent-primary)' : '#ffa500'}; padding: 1rem; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="margin: 0; color: var(--text-primary, #ffffff);">${t('reports.ipReputation.dkim', 'DKIM (DomainKeys Identified Mail)')}</h3>
          <span style="background: ${emailConfig.dkim?.valid ? 'rgba(var(--accent-primary-rgb), 0.2)' : 'rgba(255, 165, 0, 0.2)'}; color: ${emailConfig.dkim?.valid ? 'var(--accent-primary)' : '#ffa500'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
            ${emailConfig.dkim?.valid ? t('reports.common.configured', '✓ Configured') : t('reports.common.checkRequired', 'ℹ️ Check Required')}
          </span>
        </div>
        <div style="color: var(--text-secondary, #cccccc); font-size: 0.9rem;">
          ${emailConfig.dkim?.status || t('reports.ipReputation.dkimRequiresLookup', 'DKIM requires selector-specific lookup')}
        </div>
      </div>

      <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); border-left: 4px solid ${emailConfig.dmarc?.valid ? 'var(--accent-primary)' : '#ef4444'}; padding: 1rem; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="margin: 0; color: var(--text-primary, #ffffff);">${t('reports.ipReputation.dmarc', 'DMARC (Domain-based Message Authentication)')}</h3>
          <span style="background: ${emailConfig.dmarc?.valid ? 'rgba(var(--accent-primary-rgb), 0.2)' : 'rgba(255, 68, 68, 0.2)'}; color: ${emailConfig.dmarc?.valid ? 'var(--accent-primary)' : '#ef4444'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
            ${emailConfig.dmarc?.valid ? t('reports.common.valid', '✓ Valid') : t('reports.common.missingInvalid', '✗ Missing/Invalid')}
          </span>
        </div>
        <div style="color: var(--text-secondary, #cccccc); font-size: 0.9rem; font-family: 'JetBrains Mono', monospace; word-break: break-all;">
          ${emailConfig.dmarc?.record || t('reports.ipReputation.noDmarcRecord', 'No DMARC record found')}
        </div>
        ${emailConfig.dmarc?.policy ? `<div style="color: #06b6d4; margin-top: 0.5rem; font-size: 0.85rem;">${t('reports.ipReputation.policy', 'Policy')}: ${emailConfig.dmarc.policy}</div>` : ''}
      </div>
    </div>
  `;
}

function createHostingContent(hostingInfo) {
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
      <div style="background: rgba(var(--accent-primary-rgb), 0.05); border: 1px solid rgba(var(--accent-primary-rgb), 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: var(--accent-primary); margin-top: 0;">📍 ${t('reports.ipReputation.location', 'Location')}</h3>
        <div style="display: grid; gap: 0.5rem;">
          <div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.country', 'Country')}:</span> ${hostingInfo.country || t('reports.common.unknown', 'Unknown')} ${hostingInfo.countryCode ? `(${hostingInfo.countryCode})` : ''}</div>
          ${hostingInfo.city ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.city', 'City')}:</span> ${hostingInfo.city}</div>` : ''}
          ${hostingInfo.region ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.region', 'Region')}:</span> ${hostingInfo.region}</div>` : ''}
          ${hostingInfo.timezone ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.timezone', 'Timezone')}:</span> ${hostingInfo.timezone}</div>` : ''}
        </div>
      </div>

      <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: #06b6d4; margin-top: 0;">🔌 ${t('reports.ipReputation.ispHosting', 'ISP/Hosting')}</h3>
        <div style="display: grid; gap: 0.5rem;">
          <div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.provider', 'Provider')}:</span> ${hostingInfo.isp || t('reports.common.unknown', 'Unknown')}</div>
          ${hostingInfo.org ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.organization', 'Organization')}:</span> ${hostingInfo.org}</div>` : ''}
          ${hostingInfo.asn ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.asn', 'ASN')}:</span> ${hostingInfo.asn}</div>` : ''}
          ${hostingInfo.asnName ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.asName', 'AS Name')}:</span> ${hostingInfo.asnName}</div>` : ''}
        </div>
      </div>

      ${hostingInfo.isProxy !== undefined || hostingInfo.isVpn !== undefined || hostingInfo.isTor !== undefined ? `
        <div style="background: rgba(255, 165, 0, 0.05); border: 1px solid rgba(255, 165, 0, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #ffa500; margin-top: 0;">🔒 ${t('reports.ipReputation.networkType', 'Network Type')}</h3>
          <div style="display: grid; gap: 0.5rem;">
            ${hostingInfo.isProxy !== undefined ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.proxy', 'Proxy')}:</span> ${hostingInfo.isProxy ? '⚠️ ' + t('reports.common.yes', 'Yes') : '✓ ' + t('reports.common.no', 'No')}</div>` : ''}
            ${hostingInfo.isVpn !== undefined ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.vpn', 'VPN')}:</span> ${hostingInfo.isVpn ? '⚠️ ' + t('reports.common.yes', 'Yes') : '✓ ' + t('reports.common.no', 'No')}</div>` : ''}
            ${hostingInfo.isTor !== undefined ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.tor', 'Tor')}:</span> ${hostingInfo.isTor ? '⚠️ ' + t('reports.common.yes', 'Yes') : '✓ ' + t('reports.common.no', 'No')}</div>` : ''}
            ${hostingInfo.isHosting !== undefined ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">${t('reports.ipReputation.hosting', 'Hosting')}:</span> ${hostingInfo.isHosting ? t('reports.common.yes', 'Yes') : t('reports.common.no', 'No')}</div>` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function createThreatContent(threatIntel) {
  return `
    <div style="background: ${threatIntel.hasThreats ? 'rgba(255, 68, 68, 0.1)' : 'rgba(var(--accent-primary-rgb), 0.05)'}; border: 2px solid ${threatIntel.hasThreats ? '#ef4444' : 'rgba(var(--accent-primary-rgb), 0.2)'}; border-radius: 8px; padding: 1.5rem;">
      <h3 style="color: ${threatIntel.hasThreats ? '#ef4444' : 'var(--accent-primary)'}; margin-top: 0;">
        ${threatIntel.hasThreats ? '⚠️ ' + t('reports.ipReputation.threatsDetected', 'Threats Detected') : '✓ ' + t('reports.ipReputation.noKnownThreats', 'No Known Threats')}
      </h3>

      ${threatIntel.threats && threatIntel.threats.length > 0 ? `
        <div style="display: grid; gap: 1rem; margin-top: 1rem;">
          ${threatIntel.threats.map(threat => `
            <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); padding: 1rem; border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="font-weight: 600; color: var(--text-primary, #ffffff);">${threat.type}</div>
                <span style="background: ${getSeverityColor(threat.severity)}; color: #000000; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 1rem;">
                  ${translateSeverity(threat.severity)}
                </span>
              </div>
              <div style="color: var(--text-secondary, #cccccc); font-size: 0.9rem;">${threat.description}</div>
              ${threat.source ? `<div style="color: var(--text-secondary, #808080); font-size: 0.85rem; margin-top: 0.5rem;">${t('reports.ipReputation.source', 'Source')}: ${threat.source}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : `
        <p style="color: var(--accent-primary); margin-top: 1rem;">
          ${t('reports.ipReputation.noMaliciousActivity', 'No known malicious activity or security threats associated with this IP/domain.')}
        </p>
      `}

      ${threatIntel.riskLevel ? `
        <div style="margin-top: 1.5rem; padding: 1rem; background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); border-radius: 4px;">
          <div style="color: var(--text-primary, #ffffff); font-weight: 600; margin-bottom: 0.5rem;">${t('reports.ipReputation.riskAssessment', 'Risk Assessment')}</div>
          <div style="color: var(--text-secondary, #cccccc);">${t('reports.ipReputation.overallRiskLevel', 'Overall Risk Level')}: <span style="color: ${getRiskColor(threatIntel.riskLevel)}; font-weight: 600;">${translateSeverity(threatIntel.riskLevel)}</span></div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render preview content for locked recommendations section
 */
function getRecommendationsPreviewContent(recommendations = []) {
  const high = recommendations.filter(r => r.priority === 'high').length;
  const medium = recommendations.filter(r => r.priority === 'medium').length;
  const low = recommendations.filter(r => r.priority === 'low').length;

  const previewItems = [];
  if (high > 0) previewItems.push(t('reports.common.highPriorityFixes', '{{count}} high-priority fixes', { count: high }));
  if (medium > 0) previewItems.push(t('reports.common.mediumPriorityImprovements', '{{count}} medium-priority improvements', { count: medium }));
  if (low > 0) previewItems.push(t('reports.common.lowPrioritySuggestions', '{{count}} low-priority suggestions', { count: low }));

  if (previewItems.length === 0) {
    previewItems.push(t('reports.common.actionableRecommendations', 'Actionable recommendations'), t('reports.common.priorityBasedFixes', 'Priority-based fixes'));
  }

  return `
    <div style="padding: 1rem;">
      <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
        ${t('reports.common.unlockToView', 'Unlock to view:')}:
      </p>
      <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary);">
        ${previewItems.slice(0, 3).map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
  `;
}

function createRecommendationsContent(recommendations) {
  ensureIpRepFixStyles();
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  const sorted = [...recommendations].sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  const fixCount = sorted.length;

  return `
    <div class="iprep-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">🔍</span> ${t('reports.ipReputation.reputationFixes', 'Reputation Fixes')}
        <span style="font-size: 0.875rem; color: var(--r-text-faint, #9CA3AF); font-weight: normal;">(${t('reports.common.improvementsFound', '{{count}} improvements found', { count: fixCount })})</span>
      </h3>
      <div class="iprep-fixes-list">
        ${sorted.map((rec, index) => renderIpRepFixAccordion(translateRec(rec), index)).join('')}
      </div>
    </div>
  `;
}

function renderIpRepFixAccordion(rec, index) {
  const accordionId = `iprepfix-${rec.id || index}`;
  const severityColors = {
    high: { bg: 'rgba(255,68,68,0.1)', border: '#ef4444', color: '#ef4444', icon: '🔴' },
    medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
    low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
  };
  const style = severityColors[rec.priority] || severityColors.medium;
  const category = rec.category || t('reports.ipReputation.category', 'IP Reputation');

  return `
    <div class="iprep-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="iprep-fix-header" data-action="toggle-iprep-accordion" data-accordion-id="${accordionId}" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: var(--r-text, #111827);">${rec.title}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${category}</p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="
            padding: 0.25rem 0.75rem;
            border-radius: 999px;
            font-size: 0.75rem;
            font-weight: 600;
            background: ${style.color}20;
            color: ${style.color};
            border: 1px solid ${style.color}40;
          ">${translatePriority(rec.priority)}</span>
          <span class="iprep-fix-expand-icon" style="color: var(--r-text-faint, #9CA3AF); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="iprep-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderIpRepFixTabs(rec, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderIpRepFixTabs(rec, accordionId) {
  const summaryData = getIpRepSummaryData(rec);
  const codeExamples = getIpRepCodeExamples(rec);
  const guideData = getIpRepGuideData(rec);

  return `
    <div class="iprep-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); padding-bottom: 0.75rem;">
      <button class="iprep-fix-tab active" data-action="switch-iprep-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: var(--r-text, #111827);
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 ${t('reports.common.tabs.summary', 'Summary')}</button>
      <button class="iprep-fix-tab" data-action="switch-iprep-tab" data-accordion-id="${accordionId}" data-tab="code" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 ${t('reports.common.tabs.code', 'Code')}</button>
      <button class="iprep-fix-tab" data-action="switch-iprep-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">🔧 ${t('reports.common.tabs.fixGuide', 'Fix Guide')}</button>
    </div>

    <!-- Summary Tab -->
    <div class="iprep-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: var(--r-text-muted, #6B7280); line-height: 1.7; margin: 0 0 1rem 0;">
        ${rec.description}
      </p>

      ${summaryData.whyItMatters ? `
      <div style="background: rgba(255,165,0,0.1); border-left: 3px solid #ffa500; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem;">
        <div style="color: #ffa500; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.5rem;">⚠️ ${t('reports.common.whyThisMatters', 'Why This Matters')}</div>
        <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; line-height: 1.6;">${summaryData.whyItMatters}</div>
      </div>
      ` : ''}

      ${summaryData.technicalDetails ? `
      <div style="background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem;">
        <div style="color: #00ccff; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.5rem;">📊 ${t('reports.common.technicalDetails', 'Technical Details')}</div>
        <ul style="margin: 0; padding-left: 1.25rem; color: var(--r-text-muted, #6B7280); font-size: 0.9rem; line-height: 1.6;">
          ${summaryData.technicalDetails.map(detail => `<li style="margin-bottom: 0.25rem;">${detail}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${rec.impact ? `
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #22c55e; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #22c55e; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ ${t('reports.common.fix.expectedImpact', 'Expected Impact')}</div>
        <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${rec.impact}</div>
      </div>
      ` : ''}
    </div>

    <!-- Code Tab -->
    <div class="iprep-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        ${codeExamples.map((example, idx) => `
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid ${example.type === 'recommended' ? 'rgba(0,255,65,0.3)' : example.type === 'warning' ? 'rgba(255,165,0,0.3)' : 'rgba(0,204,255,0.3)'};">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: ${example.type === 'recommended' ? 'rgba(0,255,65,0.1)' : example.type === 'warning' ? 'rgba(255,165,0,0.1)' : 'rgba(0,204,255,0.1)'}; border-bottom: 1px solid ${example.type === 'recommended' ? 'rgba(0,255,65,0.2)' : example.type === 'warning' ? 'rgba(255,165,0,0.2)' : 'rgba(0,204,255,0.2)'};">
            <div>
              <span style="color: ${example.type === 'recommended' ? '#22c55e' : example.type === 'warning' ? '#ffa500' : '#00ccff'}; font-weight: 600; font-size: 0.85rem;">${example.type === 'recommended' ? '✅' : example.type === 'warning' ? '⚠️' : '💡'} ${example.title}</span>
              ${example.subtitle ? `<div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.75rem; margin-top: 0.25rem;">${example.subtitle}</div>` : ''}
            </div>
            <button data-action="copy-iprep-code" data-code-id="${accordionId}-code-${idx}" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: var(--r-text, #111827);
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 ${t('reports.common.copy', 'Copy')}</button>
          </div>
          <pre id="${accordionId}-code-${idx}" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;">${escapeHtmlIpRep(example.code)}</pre>
        </div>
        `).join('')}

        ${codeExamples.length > 0 && codeExamples[0].notes ? `
        <div style="background: rgba(153,51,255,0.1); border-radius: 8px; padding: 1rem; border: 1px solid rgba(153,51,255,0.3);">
          <div style="color: #8b5cf6; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem;">📝 ${t('reports.common.implementationNotes', 'Implementation Notes')}</div>
          <ul style="margin: 0; padding-left: 1.25rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; line-height: 1.6;">
            ${codeExamples[0].notes.map(note => `<li style="margin-bottom: 0.25rem;">${note}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="iprep-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <span style="background: rgba(0,204,255,0.2); color: #00ccff; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
            ${guideData.difficulty || 'INTERMEDIATE'}
          </span>
          <span style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem;">•</span>
          <span style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem;">${guideData.timeEstimate || '15-30 minutes'}</span>
        </div>
        ${guideData.prerequisites ? `
        <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem;">
          <strong style="color: var(--r-text-faint, #9CA3AF);">${t('reports.common.prerequisites', 'Prerequisites')}:</strong> ${guideData.prerequisites}
        </div>
        ` : ''}
      </div>

      <h5 style="margin: 0 0 1rem 0; color: var(--r-text, #111827);">${t('reports.common.stepByStepInstructions', 'Step-by-Step Instructions')}:</h5>
      <div style="display: grid; gap: 1rem;">
        ${guideData.steps.map((step, idx) => `
        <div style="display: flex; gap: 1rem; align-items: flex-start;">
          <div style="flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #00ccff, #8b5cf6); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem; color: var(--r-text, #111827);">${idx + 1}</div>
          <div style="flex: 1;">
            <div style="color: var(--r-text, #111827); font-weight: 600; margin-bottom: 0.25rem;">${step.title}</div>
            <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.9rem; line-height: 1.6;">${step.description}</div>
            ${step.tip ? `<div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(255,165,0,0.1); border-radius: 4px; font-size: 0.85rem; color: #ffa500;">💡 ${step.tip}</div>` : ''}
          </div>
        </div>
        `).join('')}
      </div>

      ${guideData.verificationSteps ? `
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(0,255,65,0.1); border-radius: 8px; border: 1px solid rgba(0,255,65,0.2);">
        <div style="color: #22c55e; font-weight: 600; margin-bottom: 0.75rem;">✓ ${t('reports.common.verificationSteps', 'Verification Steps')}</div>
        <ol style="margin: 0; padding-left: 1.5rem; color: var(--r-text-muted, #6B7280); font-size: 0.9rem; line-height: 1.6;">
          ${guideData.verificationSteps.map(v => `<li style="margin-bottom: 0.25rem;">${v}</li>`).join('')}
        </ol>
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Map recommendation titles to i18n keys
 */
function getRecI18nKey(title) {
  const titleToKey = {
    'Add CAA DNS Records': 'addCaa',
    'Strengthen DMARC Policy': 'strengthenDmarc',
    'Implement DMARC Policy': 'implementDmarc',
    'Configure SPF Record': 'configureSpf',
    'Configure DKIM': 'configureDkim',
    'Fix SSL Certificate': 'fixSslCertificate',
    'Renew SSL Certificate Soon': 'renewCertificate',
    'Add Additional Nameservers': 'addNameservers',
    'Remove from DNS Blacklists': 'removeBlacklist',
    'Close Critical Exposed Ports': 'closePorts',
    'Monitor Reputation Regularly': 'monitorReputation'
  };
  return titleToKey[title] || null;
}

/**
 * Translate recommendation content
 */
function translateRec(rec) {
  const key = getRecI18nKey(rec.title);
  if (!key) return rec;

  const basePath = `reports.ipReputation.recommendations.${key}`;
  return {
    ...rec,
    title: t(`${basePath}.title`, rec.title),
    description: t(`${basePath}.description`, rec.description),
    impact: t(`${basePath}.impact`, rec.impact)
  };
}

/**
 * Get structured summary data for a recommendation
 */
function getIpRepSummaryData(rec) {
  const key = getRecI18nKey(rec.title);
  const basePath = key ? `reports.ipReputation.recommendations.${key}` : null;

  // Fallback summaryMap for non-translated recommendations
  const summaryMap = {
    'Remove from DNS Blacklists': {
      whyItMatters: 'Being blacklisted severely impacts email deliverability - your emails may be rejected or marked as spam. This damages business communication and reputation.',
      technicalDetails: [
        'Blacklists are maintained by anti-spam organizations',
        'IPs get listed due to spam, malware, or poor email practices',
        'Most blacklists have automated delisting after cleanup',
        'Some require manual delisting requests'
      ]
    },
    'Close Critical Exposed Ports': {
      whyItMatters: 'Exposed administrative ports (SSH, databases, etc.) are primary targets for automated attacks. Hackers continuously scan for open ports to exploit.',
      technicalDetails: [
        'Common attack vectors: SSH brute force, database exploits',
        'Port scanners constantly probe for vulnerabilities',
        'Administrative ports should be behind VPN or firewall',
        'Principle of least exposure: only open what\'s needed'
      ]
    },
    'Monitor Reputation Regularly': {
      whyItMatters: 'IP and domain reputation can degrade over time due to spam, security incidents, or being shared with bad actors. Regular monitoring catches issues before they impact deliverability.',
      technicalDetails: [
        'Reputation systems track sending patterns and complaints',
        'Shared IP hosting can affect your reputation',
        'Early detection allows faster remediation',
        'Multiple blacklists and reputation services exist'
      ]
    }
  };

  // Try to get from i18n first
  if (basePath) {
    const whyItMatters = t(`${basePath}.whyItMatters`, '');
    const technicalDetailsRaw = t(`${basePath}.technicalDetails`, null);

    if (whyItMatters) {
      return {
        whyItMatters,
        technicalDetails: Array.isArray(technicalDetailsRaw) ? technicalDetailsRaw : null
      };
    }
  }

  // Fall back to hardcoded values
  return summaryMap[rec.title] || {
    whyItMatters: null,
    technicalDetails: null
  };
}

/**
 * Translate code example metadata (title, subtitle, notes) using i18n
 */
function translateCodeExamples(recKey, examples) {
  if (!recKey) return examples;
  const basePath = `reports.ipReputation.codeExamples.${recKey}`;
  const i18nExamples = t(basePath, null);

  if (!Array.isArray(i18nExamples)) return examples;

  return examples.map((example, idx) => {
    const i18nEx = i18nExamples[idx];
    if (!i18nEx) return example;
    return {
      ...example,
      title: i18nEx.title || example.title,
      subtitle: i18nEx.subtitle || example.subtitle,
      notes: Array.isArray(i18nEx.notes) ? i18nEx.notes : example.notes
    };
  });
}

/**
 * Translate guide data using i18n
 */
function translateGuideData(recKey, guide) {
  if (!recKey) return guide;
  const basePath = `reports.ipReputation.guides.${recKey}`;
  const i18nGuide = t(basePath, null);

  if (!i18nGuide || typeof i18nGuide !== 'object') return guide;

  const translatedSteps = guide.steps.map((step, idx) => {
    const i18nStep = Array.isArray(i18nGuide.steps) ? i18nGuide.steps[idx] : null;
    if (!i18nStep) return step;
    return {
      ...step,
      title: i18nStep.title || step.title,
      description: i18nStep.description || step.description,
      tip: i18nStep.tip !== undefined ? i18nStep.tip : step.tip
    };
  });

  return {
    ...guide,
    difficulty: i18nGuide.difficulty || guide.difficulty,
    timeEstimate: i18nGuide.timeEstimate || guide.timeEstimate,
    prerequisites: i18nGuide.prerequisites || guide.prerequisites,
    steps: translatedSteps,
    verificationSteps: Array.isArray(i18nGuide.verificationSteps) ? i18nGuide.verificationSteps : guide.verificationSteps
  };
}

/**
 * Get code examples for a recommendation
 */
function getIpRepCodeExamples(rec) {
  const codeMap = {
    'Add CAA DNS Records': [
      {
        type: 'recommended',
        title: 'CAA Record for Let\'s Encrypt',
        subtitle: 'Most common free CA - add to DNS zone file',
        code: `; Allow Let's Encrypt to issue certificates
@ IN CAA 0 issue "letsencrypt.org"

; Allow wildcard certificates from Let's Encrypt
@ IN CAA 0 issuewild "letsencrypt.org"

; Receive reports of policy violations (optional)
@ IN CAA 0 iodef "mailto:security@yourdomain.com"`,
        notes: [
          'Replace yourdomain.com with your actual domain',
          'Add multiple issue records if using multiple CAs',
          'Use issuewild to control wildcard certificate issuance',
          'iodef specifies where to send violation reports'
        ]
      },
      {
        type: 'info',
        title: 'CAA for Commercial CAs',
        subtitle: 'Common commercial certificate authorities',
        code: `; DigiCert
@ IN CAA 0 issue "digicert.com"

; Comodo/Sectigo
@ IN CAA 0 issue "comodoca.com"
@ IN CAA 0 issue "sectigo.com"

; GlobalSign
@ IN CAA 0 issue "globalsign.com"

; GoDaddy
@ IN CAA 0 issue "godaddy.com"`
      }
    ],
    'Strengthen DMARC Policy': [
      {
        type: 'warning',
        title: 'Current Policy (Monitor Only)',
        subtitle: 'Your current DMARC record - no enforcement',
        code: `; Current - only monitors, doesn't block
_dmarc IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"`
      },
      {
        type: 'recommended',
        title: 'Recommended: Quarantine Policy',
        subtitle: 'Step 1 - Send failures to spam folder',
        code: `; Quarantine 25% of failures initially
_dmarc IN TXT "v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@yourdomain.com; ruf=mailto:dmarc-forensic@yourdomain.com"

; After monitoring, increase to 100%
_dmarc IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"`,
        notes: [
          'pct=25 applies policy to only 25% of failures initially',
          'Monitor reports for 1-2 weeks before increasing percentage',
          'ruf enables forensic (individual failure) reports',
          'Move to reject policy after quarantine is stable'
        ]
      },
      {
        type: 'recommended',
        title: 'Final Goal: Reject Policy',
        subtitle: 'Step 2 - Block all unauthenticated emails',
        code: `; Full protection - reject all failures
_dmarc IN TXT "v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com; ruf=mailto:dmarc-forensic@yourdomain.com; adkim=s; aspf=s"

; adkim=s and aspf=s require strict alignment`
      }
    ],
    'Implement DMARC Policy': [
      {
        type: 'recommended',
        title: 'Basic DMARC Record',
        subtitle: 'Start with monitoring mode',
        code: `; Add as TXT record at _dmarc.yourdomain.com
_dmarc IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"`,
        notes: [
          'Create a dedicated mailbox or use a DMARC reporting service',
          'Reports are XML format - use free tools to parse them',
          'Monitor for 2-4 weeks before enabling enforcement',
          'Services like Postmark, dmarcian offer free report analysis'
        ]
      },
      {
        type: 'info',
        title: 'Using a DMARC Reporting Service',
        subtitle: 'Easier report analysis with third-party tools',
        code: `; Using dmarcian (free tier available)
_dmarc IN TXT "v=DMARC1; p=none; rua=mailto:your-id@rua.dmarcian.com"

; Using Postmark (free tier available)
_dmarc IN TXT "v=DMARC1; p=none; rua=mailto:your-token@dmarc.postmarkapp.com"`
      }
    ],
    'Configure SPF Record': [
      {
        type: 'recommended',
        title: 'Basic SPF Record',
        subtitle: 'Common email providers included',
        code: `; Basic SPF - adjust to your mail providers
@ IN TXT "v=spf1 include:_spf.google.com include:spf.protection.outlook.com ~all"

; If using custom mail server
@ IN TXT "v=spf1 ip4:YOUR.MAIL.SERVER.IP include:_spf.google.com ~all"`,
        notes: [
          'Replace with your actual mail provider SPF includes',
          'Use ~all (soft fail) initially, then -all (hard fail)',
          'Maximum 10 DNS lookups allowed - flatten if needed',
          'Test with: dig TXT yourdomain.com or mxtoolbox.com/spf.aspx'
        ]
      },
      {
        type: 'info',
        title: 'Common Email Provider SPF Includes',
        subtitle: 'Copy the includes for services you use',
        code: `; Google Workspace
include:_spf.google.com

; Microsoft 365
include:spf.protection.outlook.com

; Amazon SES
include:amazonses.com

; Mailchimp
include:servers.mcsv.net

; SendGrid
include:sendgrid.net

; Mailgun
include:mailgun.org`
      }
    ],
    'Configure DKIM': [
      {
        type: 'recommended',
        title: 'DKIM Setup Overview',
        subtitle: 'DKIM requires mail server configuration',
        code: `; DKIM public key record format (your provider generates this)
selector1._domainkey IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSq...YOUR_PUBLIC_KEY..."

; Example Google Workspace DKIM
google._domainkey IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNA..."`,
        notes: [
          'DKIM keys are generated by your email provider/server',
          'The selector (e.g., "google", "selector1") varies by provider',
          'Add the TXT record your provider gives you to DNS',
          'Verify with: dig TXT selector._domainkey.yourdomain.com'
        ]
      },
      {
        type: 'info',
        title: 'Enable DKIM by Provider',
        subtitle: 'Where to enable DKIM in common providers',
        code: `Google Workspace:
  Admin Console → Apps → Google Workspace → Gmail → Authenticate Email

Microsoft 365:
  Admin Center → Settings → Domains → Select domain → DNS records

Amazon SES:
  SES Console → Verified identities → Select domain → DKIM tab

Mailgun:
  Mailgun Dashboard → Domains → Select domain → DNS Records`
      }
    ],
    'Fix SSL Certificate': [
      {
        type: 'recommended',
        title: 'Install Let\'s Encrypt with Certbot',
        subtitle: 'Free automated SSL for most servers',
        code: `# Install certbot (Ubuntu/Debian)
sudo apt update && sudo apt install certbot python3-certbot-nginx

# For Nginx - automatically configures
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# For Apache
sudo certbot --apache -d yourdomain.com -d www.yourdomain.com

# Auto-renewal test
sudo certbot renew --dry-run`,
        notes: [
          'Certbot handles renewal automatically via cron/systemd',
          'Free certificates valid for 90 days, auto-renewed',
          'Works with most hosting providers and CDNs',
          'For cPanel: use built-in Let\'s Encrypt or AutoSSL'
        ]
      },
      {
        type: 'info',
        title: 'Verify SSL Configuration',
        subtitle: 'Check your SSL setup is correct',
        code: `# Check certificate details
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Check expiry date
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Online tools
# - ssllabs.com/ssltest
# - sslshopper.com/ssl-checker.html`
      }
    ],
    'Remove from DNS Blacklists': [
      {
        type: 'recommended',
        title: 'Check Blacklist Status',
        subtitle: 'Identify which lists you\'re on',
        code: `# Check common blacklists (use online tools)
# mxtoolbox.com/blacklists.aspx
# multirbl.valli.org

# Check Spamhaus directly
dig +short YOUR.IP.reversed.zen.spamhaus.org

# If listed, response will be 127.0.0.x
# No response = not listed`,
        notes: [
          'Most blacklists remove automatically after 1-4 weeks of no spam',
          'Fix the root cause FIRST before requesting removal',
          'Check your server for compromise, open relays, or spam scripts',
          'Review outbound email logs for suspicious activity'
        ]
      },
      {
        type: 'info',
        title: 'Common Blacklist Removal Links',
        subtitle: 'Where to request delisting',
        code: `Spamhaus:
  https://check.spamhaus.org/

Barracuda:
  https://www.barracudacentral.org/lookups/lookup-reputation

SpamCop:
  Auto-expires after 24-48 hours of no reports

SORBS:
  http://www.sorbs.net/lookup.shtml

Invaluement:
  https://www.invaluement.com/removal/`
      }
    ],
    'Close Critical Exposed Ports': [
      {
        type: 'recommended',
        title: 'UFW Firewall Configuration',
        subtitle: 'Simple firewall for Ubuntu/Debian',
        code: `# Enable UFW and set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow only essential ports
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH (consider limiting with 'limit')

# Use rate limiting for SSH
sudo ufw limit 22/tcp

# Enable the firewall
sudo ufw enable

# Check status
sudo ufw status verbose`,
        notes: [
          'Never expose database ports (3306, 5432, 27017) publicly',
          'Use SSH keys instead of passwords',
          'Consider fail2ban for additional brute-force protection',
          'Use a VPN or SSH tunnel for admin access'
        ]
      },
      {
        type: 'info',
        title: 'iptables Configuration',
        subtitle: 'For systems without UFW',
        code: `# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Limit SSH connections (prevent brute force)
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 -j DROP
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Drop everything else
iptables -A INPUT -j DROP`
      }
    ],
    'Monitor Reputation Regularly': [
      {
        type: 'recommended',
        title: 'Set Up Monitoring',
        subtitle: 'Free and paid monitoring options',
        code: `# Free monitoring options:
# - Google Postmaster Tools (for Gmail delivery)
# - Microsoft SNDS (for Outlook delivery)
# - MXToolbox free monitoring (limited)

# DMARC monitoring setup (add to DNS)
_dmarc IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"

# Google Postmaster Tools
# 1. Go to postmaster.google.com
# 2. Add and verify your domain
# 3. Monitor delivery rates and spam reports`,
        notes: [
          'Set up Google Postmaster Tools for Gmail insights',
          'Check blacklists weekly with mxtoolbox.com',
          'DMARC reports show authentication failures',
          'Track email bounce rates in your email platform'
        ]
      }
    ]
  };

  const examples = codeMap[rec.title] || [{
    type: 'recommended',
    title: 'Recommended Action',
    code: rec.action || rec.description
  }];
  const recKey = getRecI18nKey(rec.title);
  return translateCodeExamples(recKey, examples);
}

/**
 * Get comprehensive guide data for a recommendation
 */
function getIpRepGuideData(rec) {
  const guideMap = {
    'Add CAA DNS Records': {
      difficulty: 'BEGINNER',
      timeEstimate: '5-10 minutes',
      prerequisites: 'DNS management access',
      steps: [
        {
          title: 'Identify Your Certificate Authority',
          description: 'Determine which CA(s) issue SSL certificates for your domain. Check your current certificate details or your hosting provider\'s documentation.',
          tip: 'Common CAs: letsencrypt.org, digicert.com, comodoca.com, godaddy.com'
        },
        {
          title: 'Access Your DNS Management',
          description: 'Log in to your domain registrar or DNS provider (e.g., Cloudflare, GoDaddy, Namecheap, AWS Route 53).'
        },
        {
          title: 'Add CAA Record(s)',
          description: 'Create a new CAA record with flag 0, tag "issue", and value set to your CA\'s domain (e.g., "letsencrypt.org").',
          tip: 'If using wildcards, also add an "issuewild" record'
        },
        {
          title: 'Verify the Record',
          description: 'Use dig or an online tool to verify: <code>dig CAA yourdomain.com</code> or check at dnschecker.org'
        }
      ],
      verificationSteps: [
        'Run: dig CAA yourdomain.com (or use mxtoolbox.com/CAA.aspx)',
        'Verify your CA is listed in the output',
        'Try requesting a new certificate to confirm it still works'
      ]
    },
    'Strengthen DMARC Policy': {
      difficulty: 'INTERMEDIATE',
      timeEstimate: '2-4 weeks (gradual rollout)',
      prerequisites: 'SPF and DKIM must be configured first, DMARC monitoring in place',
      steps: [
        {
          title: 'Review Current DMARC Reports',
          description: 'Before strengthening, analyze your DMARC aggregate reports to identify legitimate email sources that might be failing authentication.',
          tip: 'Use free tools like dmarcian.com or Postmark DMARC reports'
        },
        {
          title: 'Fix Authentication Failures',
          description: 'Ensure all legitimate email sources (marketing tools, CRMs, etc.) are properly authenticated with SPF includes and DKIM.'
        },
        {
          title: 'Upgrade to Quarantine (25%)',
          description: 'Update your DMARC record to: p=quarantine; pct=25 - this sends 25% of failing emails to spam.',
          tip: 'Monitor for 1-2 weeks before increasing percentage'
        },
        {
          title: 'Increase to Quarantine (100%)',
          description: 'After successful monitoring, remove the pct tag or set to 100 to quarantine all failures.'
        },
        {
          title: 'Upgrade to Reject Policy',
          description: 'Once quarantine is stable for 2+ weeks, change p=quarantine to p=reject for full protection.'
        }
      ],
      verificationSteps: [
        'Check DMARC record: dig TXT _dmarc.yourdomain.com',
        'Monitor aggregate reports for any legitimate email being blocked',
        'Test by sending emails and checking recipient headers for DMARC pass'
      ]
    },
    'Implement DMARC Policy': {
      difficulty: 'BEGINNER',
      timeEstimate: '15-30 minutes setup, 2-4 weeks monitoring',
      prerequisites: 'SPF record should be configured (DKIM recommended)',
      steps: [
        {
          title: 'Choose a Reporting Email or Service',
          description: 'Decide where DMARC reports will be sent. Use a dedicated mailbox or a free service like dmarcian.com for easier analysis.'
        },
        {
          title: 'Create the DMARC DNS Record',
          description: 'Add a TXT record at _dmarc.yourdomain.com with: "v=DMARC1; p=none; rua=mailto:your-report-email@yourdomain.com"',
          tip: 'Start with p=none to monitor without affecting delivery'
        },
        {
          title: 'Verify the Record',
          description: 'Check that the record is published: dig TXT _dmarc.yourdomain.com'
        },
        {
          title: 'Monitor Reports',
          description: 'Wait 24-48 hours for reports to start arriving. Analyze them to understand your email authentication status.',
          tip: 'Reports are XML - use an online parser or DMARC service to read them'
        }
      ],
      verificationSteps: [
        'Run: dig TXT _dmarc.yourdomain.com',
        'Send a test email to check-auth@verifier.port25.com for instant results',
        'Check that aggregate reports start arriving within 24-48 hours'
      ]
    },
    'Configure SPF Record': {
      difficulty: 'BEGINNER',
      timeEstimate: '15-30 minutes',
      prerequisites: 'DNS management access, list of email sending services',
      steps: [
        {
          title: 'Inventory Your Email Senders',
          description: 'List all services that send email for your domain: your mail server, marketing tools (Mailchimp, SendGrid), CRM, etc.'
        },
        {
          title: 'Gather SPF Includes',
          description: 'Find the SPF include statement for each service. Usually in their documentation under "Email Authentication" or "DNS Setup".',
          tip: 'Google Workspace: include:_spf.google.com, Microsoft 365: include:spf.protection.outlook.com'
        },
        {
          title: 'Create the SPF Record',
          description: 'Add a TXT record at @ (root) with: "v=spf1 [your includes] ~all"',
          tip: 'Use ~all (soft fail) initially, then -all (hard fail) once confirmed working'
        },
        {
          title: 'Verify and Test',
          description: 'Check your SPF record and send test emails to verify they pass SPF checks.'
        }
      ],
      verificationSteps: [
        'Check record: dig TXT yourdomain.com | grep spf',
        'Test at mxtoolbox.com/spf.aspx',
        'Send email to check-auth@verifier.port25.com',
        'Check email headers show "spf=pass"'
      ]
    },
    'Configure DKIM': {
      difficulty: 'INTERMEDIATE',
      timeEstimate: '30-60 minutes',
      prerequisites: 'Access to mail server settings AND DNS management',
      steps: [
        {
          title: 'Enable DKIM in Your Email Service',
          description: 'Go to your email provider\'s admin panel and find DKIM/Email Authentication settings. Enable DKIM signing.',
          tip: 'For Google Workspace: Admin Console → Apps → Gmail → Authenticate Email'
        },
        {
          title: 'Copy the DNS Record',
          description: 'Your email provider will generate a TXT record with your public key. Copy the complete record including the selector.'
        },
        {
          title: 'Add DNS Record',
          description: 'Create a TXT record at [selector]._domainkey.yourdomain.com with the public key value provided.',
          tip: 'The selector is part of the hostname (e.g., "google._domainkey" or "selector1._domainkey")'
        },
        {
          title: 'Verify in Email Provider',
          description: 'Return to your email provider and click "Start Authentication" or "Verify" to confirm the DNS record is detected.'
        },
        {
          title: 'Test Email Signing',
          description: 'Send a test email and check the headers for "dkim=pass" or use an online DKIM validator.'
        }
      ],
      verificationSteps: [
        'Check DNS: dig TXT selector._domainkey.yourdomain.com',
        'Send test email and check headers for "dkim=pass"',
        'Use mail-tester.com for comprehensive email authentication check'
      ]
    },
    'Fix SSL Certificate': {
      difficulty: 'INTERMEDIATE',
      timeEstimate: '15-60 minutes depending on hosting',
      prerequisites: 'Server access (SSH or hosting panel)',
      steps: [
        {
          title: 'Identify the Issue',
          description: 'Use SSL Labs (ssllabs.com/ssltest) to identify the specific certificate problem: expired, wrong domain, self-signed, chain issue.',
          tip: 'This will tell you exactly what\'s wrong and how to fix it'
        },
        {
          title: 'Choose Your Solution',
          description: 'For most cases, Let\'s Encrypt provides free, auto-renewing certificates. For specialized needs, purchase from DigiCert, Comodo, etc.'
        },
        {
          title: 'Install/Renew Certificate',
          description: 'If using Let\'s Encrypt, install certbot and run: sudo certbot --nginx -d yourdomain.com (replace nginx with apache if applicable).'
        },
        {
          title: 'Configure Auto-Renewal',
          description: 'Ensure certificates will auto-renew: sudo certbot renew --dry-run to test the renewal process.'
        },
        {
          title: 'Verify Installation',
          description: 'Test your site in a browser and re-run SSL Labs test to confirm all issues are resolved.'
        }
      ],
      verificationSteps: [
        'Visit your site in a browser - should show padlock with no warnings',
        'Run SSL Labs test again - should show A or A+ rating',
        'Check expiry: echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates'
      ]
    },
    'Remove from DNS Blacklists': {
      difficulty: 'INTERMEDIATE',
      timeEstimate: 'Variable - hours to weeks',
      prerequisites: 'Server access to investigate and fix root cause',
      steps: [
        {
          title: 'Identify All Listings',
          description: 'Use mxtoolbox.com/blacklists.aspx to check all major blacklists and identify where you\'re listed.',
          tip: 'Some listings are more impactful than others - Spamhaus affects the most'
        },
        {
          title: 'Investigate Root Cause',
          description: 'Check server logs, email queues, and outbound traffic for signs of spam or compromise. Common causes: hacked website, open relay, compromised account.',
          tip: 'Look for unusual outbound connections on port 25'
        },
        {
          title: 'Fix the Issue',
          description: 'Clean any malware, close open relays, reset compromised passwords, and implement proper email authentication (SPF/DKIM/DMARC).'
        },
        {
          title: 'Request Delisting',
          description: 'Visit each blacklist\'s removal page. Some auto-expire, others require manual request. Provide evidence of remediation.',
          tip: 'Spamhaus: check.spamhaus.org, Barracuda: barracudacentral.org'
        },
        {
          title: 'Implement Prevention',
          description: 'Set up monitoring, rate limiting on email sending, and regular security scans to prevent reoccurrence.'
        }
      ],
      verificationSteps: [
        'Re-check blacklists at mxtoolbox.com after delisting',
        'Send test emails to Gmail/Outlook and check delivery',
        'Monitor email bounce rates for the next week'
      ]
    },
    'Close Critical Exposed Ports': {
      difficulty: 'INTERMEDIATE',
      timeEstimate: '30-60 minutes',
      prerequisites: 'Server SSH/root access',
      steps: [
        {
          title: 'Audit Open Ports',
          description: 'Run nmap or use an online port scanner to see exactly what\'s exposed: nmap -Pn yourdomain.com',
          tip: 'Compare against what should be exposed (usually just 80, 443, maybe 22)'
        },
        {
          title: 'Identify Unnecessary Services',
          description: 'For each open port, determine if it needs to be publicly accessible. Database ports (3306, 5432), admin panels should NOT be public.'
        },
        {
          title: 'Configure Firewall',
          description: 'Use UFW (Ubuntu/Debian) or firewalld (CentOS/RHEL) to restrict ports. Allow only 80/tcp, 443/tcp, and carefully controlled SSH access.'
        },
        {
          title: 'Secure SSH Access',
          description: 'Use key-based authentication, disable password login, consider changing port or using fail2ban for brute-force protection.'
        },
        {
          title: 'Set Up VPN for Admin Access',
          description: 'For services that need remote access (databases, admin panels), configure a VPN rather than exposing ports directly.'
        }
      ],
      verificationSteps: [
        'Re-scan with nmap to confirm ports are closed',
        'Verify you can still access necessary services',
        'Test SSH access still works (don\'t lock yourself out!)'
      ]
    },
    'Monitor Reputation Regularly': {
      difficulty: 'BEGINNER',
      timeEstimate: '30 minutes setup',
      prerequisites: 'Domain ownership for verification',
      steps: [
        {
          title: 'Set Up Google Postmaster Tools',
          description: 'Visit postmaster.google.com, add your domain, and verify ownership. This shows how Gmail treats your email.',
          tip: 'Verification usually requires adding a DNS record'
        },
        {
          title: 'Set Up Microsoft SNDS',
          description: 'Register at sendersupport.olc.protection.outlook.com for Outlook/Hotmail delivery insights.'
        },
        {
          title: 'Configure DMARC Reporting',
          description: 'Ensure your DMARC record has rua= pointing to an email or DMARC service to receive authentication reports.'
        },
        {
          title: 'Set Up Blacklist Monitoring',
          description: 'Use MXToolbox, HetrixTools, or similar to get email alerts if your IP appears on blacklists.',
          tip: 'Most offer free basic monitoring'
        },
        {
          title: 'Create a Monitoring Schedule',
          description: 'Review Postmaster/SNDS weekly, blacklist alerts immediately, DMARC reports monthly or when issues arise.'
        }
      ],
      verificationSteps: [
        'Confirm Google Postmaster Tools shows your domain as verified',
        'Verify DMARC reports are being received',
        'Test blacklist monitoring by checking alert settings'
      ]
    }
  };

  const guide = guideMap[rec.title] || {
    difficulty: 'INTERMEDIATE',
    timeEstimate: '15-30 minutes',
    prerequisites: 'Administrator access',
    steps: getIpRepDefaultSteps(rec).map((step, idx) => ({
      title: `Step ${idx + 1}`,
      description: step
    })),
    verificationSteps: ['Verify the change was applied correctly', 'Test functionality', 'Monitor for issues']
  };
  const recKey = getRecI18nKey(rec.title);
  return translateGuideData(recKey, guide);
}

function getIpRepDefaultSteps(rec) {
  const stepsMap = {
    'Configure SPF Record': [
      'Log in to your domain registrar or DNS provider',
      'Navigate to DNS management and add a new TXT record',
      'Set the host/name to @ (root domain)',
      'Set the value to: v=spf1 include:_spf.yourprovider.com ~all',
      'Replace yourprovider.com with your email service\'s SPF include',
      'Wait for DNS propagation (up to 48 hours, usually faster)',
      'Test with mxtoolbox.com/spf.aspx or dig TXT yourdomain.com'
    ],
    'Implement DMARC Policy': [
      'Ensure SPF is configured first (DKIM recommended)',
      'Create a TXT record at _dmarc.yourdomain.com',
      'Set initial policy: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com',
      'Monitor aggregate reports for 2-4 weeks',
      'Identify and fix any authentication failures',
      'Upgrade to p=quarantine after monitoring period',
      'Finally upgrade to p=reject for full protection'
    ],
    'Configure DKIM': [
      'Access your email provider\'s admin panel',
      'Find DKIM or Email Authentication settings',
      'Enable DKIM signing for your domain',
      'Copy the DNS TXT record provided (includes public key)',
      'Add the TXT record to your DNS at the specified selector',
      'Return to email provider and verify/authenticate',
      'Test by sending email and checking for dkim=pass in headers'
    ],
    'Add CAA DNS Records': [
      'Identify which Certificate Authority issues your SSL certificates',
      'Access your domain\'s DNS management panel',
      'Add a CAA record with: 0 issue "letsencrypt.org" (or your CA)',
      'Optionally add 0 issuewild for wildcard certificate control',
      'Optionally add 0 iodef mailto:security@yourdomain.com for reports',
      'Verify with: dig CAA yourdomain.com or dnschecker.org'
    ],
    'Strengthen DMARC Policy': [
      'Review current DMARC aggregate reports for authentication issues',
      'Fix any legitimate email sources failing authentication',
      'Update DMARC to p=quarantine; pct=25 (quarantine 25%)',
      'Monitor for 1-2 weeks, checking reports for false positives',
      'Increase to p=quarantine; pct=100 (or remove pct)',
      'After stable operation, upgrade to p=reject',
      'Continue monitoring reports for any issues'
    ],
    'Monitor Reputation Regularly': [
      'Set up Google Postmaster Tools at postmaster.google.com',
      'Register with Microsoft SNDS for Outlook insights',
      'Configure blacklist monitoring with MXToolbox or HetrixTools',
      'Ensure DMARC reports are being received and reviewed',
      'Schedule weekly review of email delivery metrics',
      'Set up alerts for blacklist listings or delivery drops'
    ],
    'Fix SSL Certificate': [
      'Identify the issue using ssllabs.com/ssltest',
      'For most sites, install Let\'s Encrypt via certbot',
      'Run: sudo apt install certbot python3-certbot-nginx',
      'Execute: sudo certbot --nginx -d yourdomain.com',
      'Test auto-renewal: sudo certbot renew --dry-run',
      'Verify with SSL Labs test - should show A or A+ rating'
    ],
    'Renew SSL Certificate Soon': [
      'Check current certificate expiry date',
      'If using Let\'s Encrypt with certbot, run: sudo certbot renew',
      'For manual certificates, purchase renewal from your CA',
      'Install the new certificate on your server',
      'Verify auto-renewal is configured for future renewals',
      'Set calendar reminder 30 days before next expiration'
    ],
    'Remove from DNS Blacklists': [
      'Identify all blacklists where you\'re listed (mxtoolbox.com/blacklists)',
      'Investigate root cause: check logs, email queues, compromised accounts',
      'Fix the underlying issue before requesting removal',
      'Visit each blacklist\'s removal/delisting page',
      'Submit delisting request with evidence of remediation',
      'Implement monitoring to prevent future listings',
      'Follow up on requests that don\'t auto-resolve'
    ],
    'Close Critical Exposed Ports': [
      'Audit current open ports: nmap -Pn yourdomain.com',
      'Identify which services need public access (typically 80, 443)',
      'Install and enable firewall: sudo apt install ufw && sudo ufw enable',
      'Set defaults: sudo ufw default deny incoming',
      'Allow needed ports: sudo ufw allow 80/tcp && sudo ufw allow 443/tcp',
      'Secure SSH: sudo ufw limit 22/tcp',
      'Verify with another port scan'
    ]
  };
  return stepsMap[rec.title] || [
    'Review the current issue and understand its impact',
    'Research the specific fix for your environment',
    'Implement the recommended action',
    'Test to verify the fix is working correctly',
    'Set up monitoring to prevent recurrence',
    'Document the change for future reference'
  ];
}

// Toggle accordion
function toggleIpRepFixAccordion(accordionId) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);
  const icon = accordion?.querySelector('.iprep-fix-expand-icon');

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
function switchIpRepFixTab(accordionId, tabName) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;

  const tabs = accordion.querySelectorAll('.iprep-fix-tab');
  const contents = accordion.querySelectorAll('.iprep-fix-tab-content');

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

// Expose accordion functions to window
window.toggleIpRepFixAccordion = toggleIpRepFixAccordion;
window.switchIpRepFixTab = switchIpRepFixTab;

// NOTE: Event delegation for accordion/tab clicks is handled in DOMContentLoaded (lines 163-194)
// using data-action attributes. Do NOT add duplicate listeners here to avoid double-toggle bug.

// Copy code
function copyIpRepCode(elementId) {
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

function ensureIpRepFixStyles() {
  if (document.getElementById('iprep-fixes-styles')) return;
  const style = document.createElement('style');
  style.id = 'iprep-fixes-styles';
  style.textContent = `
    .iprep-fix-accordion.expanded .iprep-fix-expand-icon {
      transform: rotate(180deg);
    }
    .iprep-fix-header:hover {
      background: rgba(255,255,255,0.03);
    }
  `;
  document.head.appendChild(style);
}

function escapeHtmlIpRep(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Create SSL Certificate Section
function createSSLSection(sslCert, sslScore) {
  if (!sslCert) return '';

  const isValid = sslCert.valid;
  const statusColor = isValid ? 'var(--accent-primary)' : '#ef4444';

  const content = `

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
        <!-- Certificate Status -->
        <div style="background: ${isValid ? 'rgba(var(--accent-primary-rgb), 0.05)' : 'rgba(255, 68, 68, 0.05)'}; border: 1px solid ${isValid ? 'rgba(var(--accent-primary-rgb), 0.25)' : 'rgba(255, 68, 68, 0.25)'}; border-radius: 8px; padding: 1.5rem; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">${isValid ? '✅' : '❌'}</div>
          <div style="color: ${statusColor}; font-weight: 600; font-size: 1.2rem;">${isValid ? t('reports.ipReputation.validCertificate', 'Valid Certificate') : t('reports.ipReputation.invalidMissing', 'Invalid/Missing')}</div>
          <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.9rem; margin-top: 0.5rem;">${t('reports.common.score', 'Score')}: ${sslScore || 0}/100</div>
        </div>

        ${isValid ? `
        <!-- Certificate Details -->
        <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #06b6d4; margin-top: 0;">📋 ${t('reports.ipReputation.certificateDetails', 'Certificate Details')}</h3>
          <div style="display: grid; gap: 0.5rem; font-size: 0.9rem;">
            <div><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.issuer', 'Issuer')}:</span> <span style="color: var(--r-text, #111827);">${sslCert.issuer}</span></div>
            <div><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.subject', 'Subject')}:</span> <span style="color: var(--r-text, #111827);">${sslCert.subject}</span></div>
            <div><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.protocol', 'Protocol')}:</span> <span style="color: ${sslCert.protocol === 'TLSv1.3' ? 'var(--accent-primary)' : sslCert.protocol === 'TLSv1.2' ? '#06b6d4' : '#ffa500'};">${sslCert.protocol}</span></div>
            <div><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.cipher', 'Cipher')}:</span> <span style="color: var(--r-text, #111827);">${sslCert.cipher || 'N/A'}</span></div>
          </div>
        </div>

        <!-- Expiry Info -->
        <div style="background: ${sslCert.daysUntilExpiry > 30 ? 'rgba(var(--accent-primary-rgb), 0.05)' : sslCert.daysUntilExpiry > 14 ? 'rgba(255, 165, 0, 0.05)' : 'rgba(255, 68, 68, 0.05)'}; border: 1px solid ${sslCert.daysUntilExpiry > 30 ? 'rgba(var(--accent-primary-rgb), 0.2)' : sslCert.daysUntilExpiry > 14 ? 'rgba(255, 165, 0, 0.2)' : 'rgba(255, 68, 68, 0.2)'}; border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: ${sslCert.daysUntilExpiry > 30 ? 'var(--accent-primary)' : sslCert.daysUntilExpiry > 14 ? '#ffa500' : '#ef4444'}; margin-top: 0;">⏰ ${t('reports.ipReputation.validityPeriod', 'Validity Period')}</h3>
          <div style="display: grid; gap: 0.5rem; font-size: 0.9rem;">
            <div><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.validFrom', 'Valid From')}:</span> <span style="color: var(--r-text, #111827);">${new Date(sslCert.validFrom).toLocaleDateString()}</span></div>
            <div><span style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.validUntil', 'Valid Until')}:</span> <span style="color: var(--r-text, #111827);">${new Date(sslCert.validTo).toLocaleDateString()}</span></div>
            <div style="margin-top: 0.5rem; padding: 0.5rem; background: var(--r-surface-2, #F8FAFC); border-radius: 4px; text-align: center;">
              <span style="font-size: 1.5rem; font-weight: bold; color: ${sslCert.daysUntilExpiry > 30 ? 'var(--accent-primary)' : sslCert.daysUntilExpiry > 14 ? '#ffa500' : '#ef4444'};">${sslCert.daysUntilExpiry}</span>
              <span style="color: var(--r-text-faint, #9CA3AF);"> ${t('reports.ipReputation.daysRemaining', 'days remaining')}</span>
            </div>
          </div>
        </div>
        ` : `
        <div style="background: rgba(255, 68, 68, 0.05); border: 1px solid rgba(255, 68, 68, 0.2); border-radius: 8px; padding: 1.5rem; grid-column: span 2;">
          <h3 style="color: #ef4444; margin-top: 0;">⚠️ ${t('reports.ipReputation.certificateIssue', 'Certificate Issue')}</h3>
          <p style="color: #cccccc;">${sslCert.error || t('reports.ipReputation.sslCouldNotBeVerified', 'SSL certificate could not be verified')}</p>
        </div>
        `}
      </div>

      ${sslCert.selfSigned ? `
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 4px;">
          <span style="color: #ffa500;">⚠️ ${t('reports.ipReputation.selfSignedCertificate', 'Self-Signed Certificate')}:</span> <span style="color: #cccccc;">${t('reports.ipReputation.selfSignedWarning', 'This certificate is self-signed and will show warnings in browsers.')}</span>
        </div>
      ` : ''}
  `;

  return ReportAccordion.createSection({
    id: 'ssl',
    title: t('reports.ipReputation.sslTlsCertificate', 'SSL/TLS Certificate'),
    scoreTextRight: `${Math.round(sslScore)}/100`,
    contentHTML: content
  });
}

// Create DNS Health Section
function createDNSHealthSection(dnsHealth, dnsScore) {
  if (!dnsHealth) return '';

  const content = `
    <p style="color: var(--r-text-faint, #9CA3AF); margin-bottom: 1.5rem;">${t('reports.ipReputation.dnsConfigAnalysis', 'DNS configuration and infrastructure analysis')}</p>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
        <!-- NS Records -->
        <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #22c55e; margin-top: 0;">📡 ${t('reports.ipReputation.nameservers', 'Nameservers')}</h3>
          ${dnsHealth.nsRecords && dnsHealth.nsRecords.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${dnsHealth.nsRecords.map(ns => `
                <span style="background: rgba(0, 255, 65, 0.1); border: 1px solid rgba(0, 255, 65, 0.3); padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem; color: #22c55e; font-family: monospace;">
                  ${ns}
                </span>
              `).join('')}
            </div>
            <div style="margin-top: 0.75rem; color: ${dnsHealth.nsRecords.length >= 2 ? '#22c55e' : '#ffa500'}; font-size: 0.85rem;">
              ${dnsHealth.nsRecords.length >= 2 ? '✓ ' + t('reports.ipReputation.redundancyOk', 'Redundancy: OK') : '⚠️ ' + t('reports.ipReputation.addMoreNameservers', 'Add more nameservers for redundancy')}
            </div>
          ` : '<p style="color: var(--r-text-faint, #9CA3AF);">' + t('reports.ipReputation.noNsRecords', 'No NS records found') + '</p>'}
        </div>

        <!-- MX Records -->
        <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #06b6d4; margin-top: 0;">📧 ${t('reports.ipReputation.mailServers', 'Mail Servers (MX)')}</h3>
          ${dnsHealth.mxRecords && dnsHealth.mxRecords.length > 0 ? `
            <div style="display: grid; gap: 0.5rem;">
              ${dnsHealth.mxRecords.slice(0, 5).map(mx => `
                <div style="display: flex; justify-content: space-between; background: var(--r-surface-2, #F8FAFC); padding: 0.5rem; border-radius: 4px; font-size: 0.85rem;">
                  <span style="color: var(--r-text, #111827); font-family: monospace;">${mx.exchange}</span>
                  <span style="color: #06b6d4;">${t('reports.ipReputation.priority', 'Priority')}: ${mx.priority}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p style="color: var(--r-text-faint, #9CA3AF);">' + t('reports.ipReputation.noMxRecords', 'No MX records found (email may not be configured)') + '</p>'}
        </div>

        <!-- CAA Records -->
        <div style="background: rgba(153, 51, 255, 0.05); border: 1px solid rgba(153, 51, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #8b5cf6; margin-top: 0;">🔐 ${t('reports.ipReputation.caaRecords', 'CAA Records')}</h3>
          ${dnsHealth.hasCAA ? `
            <div style="display: grid; gap: 0.5rem;">
              ${dnsHealth.caaRecords.map(caa => `
                <div style="background: var(--r-surface-2, #F8FAFC); padding: 0.5rem; border-radius: 4px; font-size: 0.85rem; color: var(--r-text, #111827);">
                  ${caa.issue || caa.issuewild || t('reports.ipReputation.caaRecord', 'CAA record')}
                </div>
              `).join('')}
            </div>
            <div style="margin-top: 0.75rem; color: #22c55e; font-size: 0.85rem;">✓ ${t('reports.ipReputation.caaConfigured', 'CAA configured')}</div>
          ` : `
            <p style="color: var(--r-text-faint, #9CA3AF);">${t('reports.ipReputation.noCaaRecords', 'No CAA records found')}</p>
            <div style="margin-top: 0.75rem; color: #ffa500; font-size: 0.85rem;">⚠️ ${t('reports.ipReputation.considerAddingCaa', 'Consider adding CAA to restrict certificate issuance')}</div>
          `}
        </div>
      </div>

      ${dnsHealth.issues && dnsHealth.issues.length > 0 ? `
        <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 8px;">
          <h4 style="color: #ffa500; margin: 0 0 0.75rem 0;">⚠️ ${t('reports.ipReputation.dnsIssuesDetected', 'DNS Issues Detected')}</h4>
          <ul style="margin: 0; padding-left: 1.5rem; color: #cccccc;">
            ${dnsHealth.issues.map(issue => `<li style="margin-bottom: 0.5rem;">${issue}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
  `;

  return ReportAccordion.createSection({
    id: 'dns-health',
    title: t('reports.ipReputation.dnsHealth', 'DNS Health'),
    scoreTextRight: `${Math.round(dnsScore)}/100`,
    contentHTML: content
  });
}

// Create Port Security Section
function createPortSecuritySection(portScan) {
  if (!portScan || !portScan.scanned) return '';

  const openPorts = portScan.openPorts || [];
  const hasIssues = portScan.securityIssues && portScan.securityIssues.length > 0;

  const content = `
    <p style="color: var(--r-text-faint, #9CA3AF); margin-bottom: 1.5rem;">${t('reports.ipReputation.scanningPorts', 'Scanning common security-sensitive ports for exposure')}</p>

    ${hasIssues ? `
      <div style="background: rgba(255, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h3 style="color: #ef4444; margin-top: 0;">⚠️ ${t('reports.ipReputation.securityIssuesFound', 'Security Issues Found')}</h3>
        <div style="display: grid; gap: 1rem;">
          ${portScan.securityIssues.map(issue => `
            <div style="background: var(--r-surface-2, #F8FAFC); padding: 1rem; border-radius: 4px; border-left: 4px solid ${issue.severity === 'critical' ? '#ff0000' : issue.severity === 'high' ? '#ef4444' : '#ffa500'};">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-weight: 600; color: var(--r-text, #111827);">${t('reports.ipReputation.port', 'Port')} ${issue.port} (${issue.service})</span>
                <span style="background: ${issue.severity === 'critical' ? '#ff0000' : issue.severity === 'high' ? '#ef4444' : '#ffa500'}; color: #000; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
                  ${translateSeverity(issue.severity)}
                </span>
              </div>
              <div style="color: #cccccc; font-size: 0.9rem;">${issue.description}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : `
      <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
        <div style="color: #22c55e; font-weight: 600;">${t('reports.ipReputation.noCriticalExposedServices', 'No Critical Exposed Services')}</div>
        <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.9rem; margin-top: 0.5rem;">${t('reports.ipReputation.noHighRiskPorts', 'No high-risk ports detected as publicly accessible')}</div>
      </div>
    `}

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem;">
      ${openPorts.length > 0 ? openPorts.map(port => `
        <div style="background: rgba(${port.risk === 'critical' ? '255, 0, 0' : port.risk === 'high' ? '255, 68, 68' : port.risk === 'medium' ? '255, 165, 0' : '0, 217, 255'}, 0.1); border: 1px solid rgba(${port.risk === 'critical' ? '255, 0, 0' : port.risk === 'high' ? '255, 68, 68' : port.risk === 'medium' ? '255, 165, 0' : '0, 217, 255'}, 0.3); padding: 0.75rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.25rem; font-weight: bold; color: var(--r-text, #111827);">${port.port}</div>
          <div style="font-size: 0.8rem; color: var(--r-text-faint, #9CA3AF);">${port.name}</div>
          <div style="font-size: 0.7rem; color: #22c55e; margin-top: 0.25rem;">${t('reports.ipReputation.open', 'OPEN')}</div>
        </div>
      `).join('') : `
        <div style="grid-column: span 6; text-align: center; color: var(--r-text-faint, #9CA3AF); padding: 1rem;">
          ${t('reports.ipReputation.noCommonlyAttackedPorts', 'No commonly-attacked ports found open')}
        </div>
      `}
    </div>

    <div style="margin-top: 1rem; padding: 0.75rem; background: var(--r-surface-2, #F8FAFC); border-radius: 4px; font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">
      <strong>${t('reports.ipReputation.scannedPorts', 'Scanned Ports')}:</strong> FTP (21), SSH (22), Telnet (23), SMTP (25), HTTP (80), HTTPS (443), SMB (445), MySQL (3306), RDP (3389), PostgreSQL (5432), Redis (6379), MongoDB (27017)
    </div>
  `;

  // Calculate score: 100 if no issues, otherwise reduce based on severity
  let score = 100;
  if (hasIssues) {
    portScan.securityIssues.forEach(issue => {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'high') score -= 20;
      else if (issue.severity === 'medium') score -= 10;
    });
    score = Math.max(0, score);
  }

  return ReportAccordion.createSection({
    id: 'port-security',
    title: t('reports.ipReputation.portSecurityScan', 'Port Security Scan'),
    scoreTextRight: `${Math.round(score)}/100`,
    contentHTML: content
  });
}

function showError(message) {
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');

  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}

/**
 * Initialize PDF Export for IP Reputation Analyzer
 */
function initIPReputationPDFExport() {
  if (typeof initPDFExport === 'function') {
    initPDFExport({
      contentSelector: '#results, #resultsContent, .results-container',
      buttonSelector: '#exportPdfBtn, .export-pdf-btn, #downloadPdfButton',
      reportSubtitle: t('reports.ipReputation.pdfSubtitle', 'IP Reputation & Security Analysis'),
      urlInputSelector: '#urlInput, input[type="url"], input[type="text"]',
      filename: `ip-reputation-${new Date().toISOString().split('T')[0]}.pdf`
    });
  } else {
  }
}

// Initialize PDF export when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIPReputationPDFExport);
} else {
  initIPReputationPDFExport();
}
