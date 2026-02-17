/**
 * Accessibility Analyzer - Frontend Script
 * Handles UI interactions and displays accessibility analysis results
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'accessibility';
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

// Function to get analysis steps with current translations
// Called at runtime to ensure i18n is loaded
function getAnalysisSteps() {
  return [
    {
      label: t('loader.initializingWcag', 'Initializing WCAG audit'),
      detail: t('loader.startingAccessibility', 'Starting accessibility analysis...')
    },
    {
      label: t('loader.checkingColorContrast', 'Checking color contrast'),
      detail: t('loader.testingReadability', 'Testing text readability and WCAG ratios...')
    },
    {
      label: t('loader.testingKeyboard', 'Testing keyboard navigation'),
      detail: t('loader.verifyingTabOrder', 'Verifying tab order and focus management...')
    },
    {
      label: t('loader.analyzingAria', 'Analyzing ARIA attributes'),
      detail: t('loader.checkingSemantics', 'Checking semantic markup and labels...')
    },
    {
      label: t('loader.testingScreenReader', 'Testing screen reader compatibility'),
      detail: t('loader.evaluatingAssistive', 'Evaluating assistive technology support...')
    }
  ];
}

// DOM Elements
const urlInput = document.getElementById('urlInput');
const analyzeButton = document.getElementById('analyzeButton');
const results = document.getElementById('results');
const loadingMessage = document.getElementById('loadingMessage');
const resultsContent = document.getElementById('resultsContent');
const errorMessage = document.getElementById('errorMessage');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// Event Listeners
analyzeButton.addEventListener('click', analyzeAccessibility);
urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyzeAccessibility();
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
    console.log('[Accessibility] Set report ID from URL:', reportId);
  }

  // If returning from billing, wait for billing return processing to complete
  if (billingSuccess && !window.__smBillingReturnComplete) {
    console.log('[Accessibility] Waiting for billing return processing...');
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
    console.log('[Accessibility] Billing return processing complete');
    // Don't return - fall through to load the stored report below
  }

  // If we have a report_id, try to load the stored report first
  if (reportId) {
    console.log('[Accessibility] Checking for stored report:', reportId);

    // CRITICAL: Fetch billing status BEFORE displaying the report
    // Force refresh to ensure we have the latest purchase data (e.g., coming from dashboard)
    if (window.ProReportBlock?.fetchBillingStatus) {
      console.log('[Accessibility] Fetching billing status (force refresh for report recall)...');
      await window.ProReportBlock.fetchBillingStatus(true); // Force refresh
      const hasAccessResult = window.ProReportBlock.hasAccess(reportId);
      console.log('[Accessibility] Billing status fetched, hasAccess:', hasAccessResult, 'for reportId:', reportId);
    }

    let loaded = false;

    // First, try to load from database (ReportStorage)
    if (window.ReportStorage) {
      loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displayAccessibilityResults, {
        expectedAnalyzerType: 'accessibility'
      });
    }

    // If not in database, check sessionStorage for cached results (billing return fallback)
    if (!loaded) {
      // Try new unique key format first
      let cachedResults = null;
      const checkoutKey = sessionStorage.getItem('sm_checkout_key');
      if (checkoutKey && checkoutKey.includes('accessibility')) {
        const raw = sessionStorage.getItem(checkoutKey);
        if (raw) {
          try {
            const data = JSON.parse(raw);
            cachedResults = data.results;
            console.log('[Accessibility] Loading cached results from unique key:', checkoutKey);
          } catch (e) {
            console.warn('[Accessibility] Failed to parse cached results from unique key:', e);
          }
        }
      }
      // Fall back to legacy key
      if (!cachedResults) {
        const legacyResults = sessionStorage.getItem('sm_checkout_results');
        const cachedAnalyzer = sessionStorage.getItem('sm_checkout_analyzer') || '';
        if (legacyResults && cachedAnalyzer.includes('accessibility')) {
          try {
            cachedResults = JSON.parse(legacyResults);
            console.log('[Accessibility] Loading cached results from legacy sessionStorage');
          } catch (e) {
            console.warn('[Accessibility] Failed to parse cached results:', e);
          }
        }
      }

      if (cachedResults) {
        displayAccessibilityResults(cachedResults);
        // Clear after successful display
        if (checkoutKey) {
          sessionStorage.removeItem(checkoutKey);
          sessionStorage.removeItem('sm_checkout_key');
        }
        sessionStorage.removeItem('sm_checkout_results');
        sessionStorage.removeItem('sm_checkout_analyzer');
        loaded = true;
      }
    }

    if (loaded) {
      // Stored report was loaded - fill URL input for context
      if (autoUrl) urlInput.value = autoUrl;
      return; // Don't auto-scan
    }

    // Report not in storage - check if user has paid access (purchased report)
    const hasAccess = window.ProReportBlock?.hasAccess?.(reportId);
    if (hasAccess && autoUrl) {
      // User has paid access but report data isn't saved - show helpful message
      console.log('[Accessibility] Purchased report not in storage, showing regenerate message');
      urlInput.value = autoUrl;

      // Show a message explaining the situation
      const messageDiv = document.createElement('div');
      messageDiv.id = 'sm-report-regenerate-message';
      messageDiv.innerHTML = `
        <div style="
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 16px 20px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div>
            <strong>${t('reports.common.reportNeedsRegeneration', 'Report needs to be regenerated')}</strong><br>
            <span style="font-size: 0.9em; opacity: 0.9;">
              ${t('reports.common.clickAnalyzeToView', 'Click ')}
            </span>
          </div>
        </div>
      `;

      // Insert message before the form
      const formContainer = document.querySelector('.analyzer-form') || urlInput.closest('form') || urlInput.parentElement;
      if (formContainer) {
        formContainer.parentElement.insertBefore(messageDiv, formContainer);
      }

      return;
    }

    // User doesn't have paid access and report not in storage - show unavailable banner
    if (autoUrl) urlInput.value = autoUrl;

    console.log('[Accessibility] Report data unavailable, showing banner:', { reportId, autoUrl });
    if (window.ReportStorage?.showReportUnavailableBanner) {
      window.ReportStorage.showReportUnavailableBanner({
        url: autoUrl || '',
        analyzerType: 'accessibility',
        onRescan: () => {
          analyzeAccessibility();
        }
      });
    }
    return;
  }

  // No stored report found - pre-fill URL but only auto-scan if explicitly requested
  if (autoUrl) {
    urlInput.value = autoUrl;
  }
  // Only auto-scan if explicitly requested with auto_scan=true
  if (autoScan) {
    setTimeout(() => {
      analyzeAccessibility();
    }, 500);
  }
})();

// Listen for restore scan results event (after payment return)
window.addEventListener('sm:restoreScanResults', async (e) => {
  const { results, url, analyzer } = e.detail || {};
  if (results && analyzer?.includes('accessibility')) {
    console.log('[Accessibility] Restoring scan results after payment');
    if (url && urlInput) {
      urlInput.value = url;
    }
    window._a11yFullResults = results;
    window.currentAccessibilityResults = {
      ...results,
      url: results.url || url || urlInput.value.trim()
    };

    // CRITICAL: Fetch billing status BEFORE displaying results so Pro sections unlock correctly
    const reportId = document.body?.getAttribute('data-report-id') || '';
    if (reportId && window.ProReportBlock?.fetchBillingStatus) {
      console.log('[Accessibility] Fetching billing status before display (payment return)...');
      await window.ProReportBlock.fetchBillingStatus(true); // Force refresh
      console.log('[Accessibility] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportId));
    }

    displayAccessibilityResults(results);
  }
});

// Re-render results when language changes
window.addEventListener('languageChanged', () => {
  if (window.SM_IS_SCANNING) return;
  if (window.currentAccessibilityResults) {
    try {
      displayAccessibilityResults(window.currentAccessibilityResults);
    } catch (e) {
      // ignore
    }
  }
});

// Re-render when entitlements arrive/change (handles race conditions
// where sections rendered before billing status was available)
window.addEventListener('entitlements:updated', () => {
  if (window.SM_IS_SCANNING && !window.__smBillingReturnInProgress) return;
  if (window.currentAccessibilityResults) {
    try {
      console.log('[Accessibility] Entitlements updated, re-rendering results');
      displayAccessibilityResults(window.currentAccessibilityResults);
    } catch (e) {
      // ignore
    }
  }
});

// Handle billing re-scan: user returned from Stripe but cached results weren't available
window.addEventListener('sm:billingRescan', (e) => {
  const { reportId: purchasedReportId, url: scanUrl } = e.detail || {};
  const analyzerKey = window.SM_ANALYZER_KEY || '';
  if (!analyzerKey.includes('accessibility')) return; // Not for this analyzer
  console.log('[Accessibility] Billing re-scan requested:', { purchasedReportId, scanUrl });
  window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;
  window.__smBillingRescanHandled = true;
  const urlInput = document.getElementById('urlInput');
  if (scanUrl && urlInput) urlInput.value = scanUrl;
  if (purchasedReportId) document.body.setAttribute('data-report-id', purchasedReportId);
  analyzeAccessibility({ preserveReportId: true, billingRescan: true });
});

/**
 * MEMORY MANAGEMENT: Clean up previous scan data to prevent memory leaks
 * Called before each new scan to free up memory from prior results
 * @param {boolean} preserveReportId - If true, don't clear the report_id (used for billing return re-scans)
 */
function cleanupPreviousScanData(preserveReportId = false) {
  // Clear report metadata from previous scans
  // IMPORTANT: Don't clear report_id when re-scanning after billing return,
  // otherwise the purchased report_id gets lost and replaced with a new one
  if (!preserveReportId) {
    document.body.removeAttribute('data-report-id');
  }
  document.body.removeAttribute('data-sm-screenshot-url');
  document.body.removeAttribute('data-sm-scan-started-at');
  
  // Clear global results cache
  if (window._a11yFullResults) {
    window._a11yFullResults = null;
  }
  
  // Clear results container to free DOM memory
  if (resultsContent) {
    resultsContent.innerHTML = '';
  }
  
  // Remove any dynamically created elements from previous scans
  const regenerateMessage = document.getElementById('sm-report-regenerate-message');
  if (regenerateMessage) {
    regenerateMessage.remove();
  }

  const oldPatienceMessage = document.getElementById('patience-message');
  if (oldPatienceMessage) {
    oldPatienceMessage.remove();
  }
  
  const oldLoadingContainer = document.getElementById('loadingContainer');
  if (oldLoadingContainer) {
    oldLoadingContainer.innerHTML = '';
  }
  
  // Clear any chart instances if Chart.js is being used
  if (window.Chart && Chart.instances) {
    Object.values(Chart.instances).forEach(chart => {
      try { chart.destroy(); } catch (e) { /* ignore */ }
    });
  }
}

/**
 * Main analysis function
 * @param {Object} options - Optional settings
 * @param {boolean} options.preserveReportId - If true, preserve the existing report_id (for billing return re-scans)
 */
async function analyzeAccessibility(options = {}) {
  const { preserveReportId = false, billingRescan = false } = options;
  const url = urlInput.value.trim();

  if (!url) {
    showError(t('reports.common.pleaseEnterUrl', 'Please enter a valid URL'));
    return;
  }

  // NOTE: Auto-preserve is ONLY used when explicitly requested via options.preserveReportId
  // (e.g., sm:billingRescan handler passes preserveReportId: true).
  // Previously, auto-detect logic here caused false positives where stale purchased
  // reportIds from previous scans would grant pro access on fresh unpaid scans.
  const existingReportId = document.body.getAttribute('data-report-id');
  const preservedReportId = preserveReportId ? existingReportId : null;
  if (preservedReportId) {
    console.log('[Accessibility] Preserving purchased report_id:', preservedReportId);
  }

  // MEMORY CLEANUP: Clear previous scan data before starting new scan
  // Pass preserveReportId to keep the purchased report_id during billing return re-scans
  cleanupPreviousScanData(preserveReportId);

  // Update button state
  analyzeButton.disabled = true;
  const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
  buttonText.textContent = t('reports.common.analyzing', 'Analyzing...');

  // Reset UI
  results.classList.add('hidden');
  errorMessage.classList.add('hidden');

  // Create loading container if it doesn't exist
  let loadingContainer = document.getElementById('loadingContainer');
  if (!loadingContainer) {
    loadingContainer = document.createElement('div');
    loadingContainer.id = 'loadingContainer';
    results.parentNode.insertBefore(loadingContainer, results);
  }

  // Initialize the analyzer loader
  const loader = new AnalyzerLoader('loadingContainer');
  
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
      ${t('reports.accessibility.analyzingBothPlatforms', 'Analyzing accessibility across both platforms...')}
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: 0.8rem; color: rgba(var(--accent-primary-rgb), 0.7);">
      ${t('reports.common.mayTake30to60Seconds', 'This may take 30-60 seconds')}
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
  loader.start(getAnalysisSteps(), '♿ ' + t('loader.analyzingAccessibility', 'ACCESSIBILITY ANALYZER'), 20);
  
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

    // Call API
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/accessibility', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, scanStartedAt, lang: window.i18n?.getActiveLocale?.() || document.documentElement.lang || 'en', ...(billingRescan && { billingRescan: true }) })
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.code === 'SCAN_QUOTA_EXCEEDED') {
        const limit = error.scansLimit || 10;
        loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
        return;
      }
      throw new Error(error.message || error.error || t('reports.common.analysisFailed', 'Analysis failed'));
    }

    const data = await response.json();

    // Set report metadata from API response
    // CRITICAL: Use preserved report_id if this is a billing return re-scan
    // The API returns a NEW report_id with new timestamp, but we must keep the purchased one
    const apiReportId = data && data.reportId ? String(data.reportId) : '';
    const reportId = preservedReportId || apiReportId;
    const screenshotUrl = data && data.screenshotUrl ? String(data.screenshotUrl) : '';
    if (reportId) {
      if (preservedReportId) {
        console.log('[Accessibility] Using preserved report_id instead of API response:', reportId);
      }
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
      displayAccessibilityResults(data);
      results.classList.remove('hidden');
      window.__REPORT_READY__ = true;
      window.dispatchEvent(new CustomEvent('report:ready'));
    }, 1000);

  } catch (error) {
    loader.showError(error.message || t('reports.accessibility.failedToAnalyze', 'Failed to analyze accessibility. Please try again.'));
    console.error('Accessibility analysis error:', error);
  } finally {
    // Reset button state
    analyzeButton.disabled = false;
    const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
    buttonText.textContent = t('reports.common.analyze', 'Analyze');
  }
}

/**
 * Animate progress bar
 */
function animateProgress() {
  const stages = [
    { progress: 20, text: t('reports.accessibility.progressLighthouse', 'Running Lighthouse accessibility audit...') },
    { progress: 40, text: t('reports.accessibility.progressContrast', 'Analyzing color contrast ratios...') },
    { progress: 60, text: t('reports.accessibility.progressKeyboard', 'Testing keyboard navigation...') },
    { progress: 80, text: t('reports.accessibility.progressAria', 'Validating ARIA implementation...') },
    { progress: 95, text: t('reports.accessibility.progressCompiling', 'Compiling accessibility report...') }
  ];

  let currentStage = 0;
  const interval = setInterval(() => {
    if (currentStage < stages.length) {
      progressBar.style.width = `${stages[currentStage].progress}%`;
      progressText.textContent = stages[currentStage].text;
      currentStage++;
    } else {
      clearInterval(interval);
      progressBar.style.width = '100%';
      progressText.textContent = t('reports.common.analysisComplete', 'Analysis complete!');
    }
  }, 2000);
}

/**
 * Display accessibility results
 */
async function displayAccessibilityResults(resultData) {
  // Ensure i18n is loaded before rendering (prevents English fallback on fast stored-report loads)
  if (window.i18n && !window.i18n.initialized) {
    try { await window.i18n.init(); } catch (e) { /* fallback */ }
  }

  // Validate data - ignore cached error responses
  if (!resultData || resultData.error || typeof resultData === 'string') {
    console.warn('[Accessibility] Ignoring invalid/error data:', resultData?.error || resultData);
    const errContainer = document.getElementById('resultsContent') || document.getElementById('results');
    if (errContainer) {
      errContainer.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted,#9ca3af)"><p style="font-size:1.1rem;margin-bottom:0.5rem">Data unavailable</p><p style="font-size:0.9rem">The cached data was invalid or contained an error. Please run a new scan.</p></div>';
    }
    window.__REPORT_READY__ = true;
    window.dispatchEvent(new CustomEvent('report:ready'));
    return;
  }

  // Ensure results container is visible (may be hidden if called directly without scan flow)
  const resultsEl = document.getElementById('results');
  if (resultsEl) {
    resultsEl.classList.remove('hidden');
  }

  const container = resultsContent || document.getElementById('resultsContent');
  container.innerHTML = '';

  // Validate that this looks like accessibility data (not security/seo/etc.)
  if (resultData && !resultData.accessibilityScore && !resultData.wcagLevel && !resultData.desktop?.accessibilityScore) {
    // Check if this is actually data from a different analyzer
    if (resultData.securityScore || resultData.owaspCompliance || resultData.score?.overall || resultData.overallScore) {
      console.error('[Accessibility] Wrong report type loaded - data appears to be from a different analyzer:', {
        hasSecurityScore: !!resultData.securityScore,
        hasOwaspCompliance: !!resultData.owaspCompliance,
        hasSeoScore: !!resultData.score?.overall,
        hasOverallScore: !!resultData.overallScore
      });
      container.innerHTML = `
        <div style="
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
        ">
          <h3 style="margin: 0 0 10px 0;">${t('reports.common.reportTypeMismatch', 'Report Type Mismatch')}</h3>
          <p style="margin: 0;">${t('reports.accessibility.wrongReportType', 'The stored report appears to be from a different analyzer. Please run a new accessibility scan.')}</p>
          <button data-action="reload-page" style="
            margin-top: 15px;
            padding: 10px 20px;
            background: white;
            color: #dc2626;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          ">${t('reports.common.runNewScan', 'Run New Scan')}</button>
        </div>
      `;
      return;
    }
  }

  // Use resultData as the results variable for the rest of the function
  const results = resultData;

  // Create report scope wrapper for consistent styling
  const reportScope = document.createElement('div');
  reportScope.className = 'report-scope';

  // Report Title Header using ReportContainer for consistency
  const reportHeader = document.createElement('div');
  const timestamp = new Date().toISOString();
  const displayUrl = results.url || urlInput.value.trim();

  // Use ReportContainer.renderHeader if available, otherwise fallback
  if (window.ReportContainer && window.ReportContainer.renderHeader) {
    reportHeader.innerHTML = window.ReportContainer.renderHeader({
      url: displayUrl,
      timestamp: timestamp,
      mode: 'accessibility',
      title: t('reports.accessibility.title', 'Accessibility Report') + ': ' + t('reports.accessibility.wcagCompliance', 'WCAG Compliance'),
      showModeBadge: false,
      showModeMeta: false
    });
  } else {
    // Fallback header
    reportHeader.innerHTML = `
      <div class="report-header">
        <h1 class="report-header__title">${t('reports.accessibility.title', 'Accessibility Report')}: ${t('reports.accessibility.wcagCompliance', 'WCAG Compliance')}</h1>
        <div class="report-header__meta">
          <span class="meta-item">
            <svg class="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
            <span class="meta-item__text">${displayUrl}</span>
          </span>
          <span class="meta-item">
            <svg class="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span class="meta-item__text">${window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString()}</span>
          </span>
        </div>
      </div>
    `;
  }
  reportScope.appendChild(reportHeader);

  // Page Screenshot Section
  const reportId = document.body.getAttribute('data-report-id') || '';
  const screenshotUrl = results.screenshotUrl || document.body.getAttribute('data-sm-screenshot-url') || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');
  if (screenshotUrl) {
    const screenshotSection = document.createElement('div');
    screenshotSection.className = 'section screenshot-section';
    screenshotSection.innerHTML = `
      <h3 style="color: var(--text-primary, #fff); font-size: 1rem; margin: 0 0 0.75rem 0; font-weight: 600;">
        ${t('reports.common.pageScreenshot', 'Page Screenshot')}
      </h3>
      <div class="screenshot-item" style="background: var(--bg-secondary, #1a1a1a); border: 1px solid var(--border-color, #333); border-radius: 8px; overflow: hidden;">
        <img
          src="${screenshotUrl}"
          alt="${t('reports.common.screenshotOf', 'Screenshot of {{url}}')} ${displayUrl}"
          class="screenshot-item__img"
          style="width: 100%; max-height: 300px; object-fit: cover; object-position: top; cursor: pointer; display: block;"
          data-action="open-lightbox"
          data-screenshot-url="${screenshotUrl}"
          data-screenshot-title="${t('reports.common.pageScreenshot', 'Page Screenshot')}"
          onerror="this.parentElement.innerHTML='<div style=\\'padding: 2rem; text-align: center; color: var(--text-muted, #666);\\'>${t('reports.common.screenshotUnavailable', 'Screenshot unavailable')}</div>'"
        />
      </div>
    `;
    reportScope.appendChild(screenshotSection);

    // Add click handler for screenshot lightbox
    screenshotSection.addEventListener('click', (e) => {
      const openLightbox = e.target.closest('[data-action="open-lightbox"]');
      if (openLightbox) {
        const url = openLightbox.getAttribute('data-screenshot-url');
        const title = openLightbox.getAttribute('data-screenshot-title');
        if (url && window.ScreenshotLightbox && typeof window.ScreenshotLightbox.open === 'function') {
          window.ScreenshotLightbox.open(url, title || t('reports.common.screenshot', 'Screenshot'));
        }
      }
    });
  }

  // Summary Section
  const summary = document.createElement('div');
  summary.className = 'section';
  summary.innerHTML = `
    
    <!-- Performance Score Overview -->
    <div style="
      background: linear-gradient(135deg, rgba(138,43,226,0.05) 0%, rgba(138,43,226,0.02) 100%);
      border: 2px solid ${getAccessibilityColor(results.accessibilityScore)};
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
      box-shadow: 0 4px 20px rgba(138,43,226,0.15);
    ">
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 2rem; align-items: center;">
        <!-- Left: Accessibility Score Circle -->
        <div style="text-align: center;">
          <div style="
            width: 180px;
            height: 180px;
            border-radius: 50%;
            background: #ffffff;
            border: 5px solid ${getAccessibilityColor(results.accessibilityScore)};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 30px ${getAccessibilityColor(results.accessibilityScore)}40, 0 4px 15px rgba(0,0,0,0.2);
          ">
            <div style="
              font-size: 4.5rem;
              font-weight: 900;
              color: #000000;
              line-height: 1;
            ">${results.accessibilityScore ?? 0}</div>
            <div style="
              font-size: 0.9rem;
              color: #666666;
              margin-top: 0.5rem;
              text-transform: uppercase;
              letter-spacing: 2px;
              font-weight: 600;
            ">/ 100</div>
          </div>
          <div style="
            margin-top: 1rem;
            font-size: 1.5rem;
            font-weight: bold;
            color: ${getAccessibilityColor(results.accessibilityScore)};
            text-shadow: 0 0 10px ${getAccessibilityColor(results.accessibilityScore)}80;
          ">${getAccessibilityGrade(results.accessibilityScore)}</div>
        </div>
        
        <!-- Right: Quick Stats -->
        <div>
          <h3 style="color: #bb86fc; margin: 0 0 1rem 0; font-size: 1.35rem;">>> ${t('reports.accessibility.quickStats', 'Quick Stats')}</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: var(--r-text-muted, #6B7280);">${t('reports.accessibility.wcagLevel', 'WCAG Level')}</span>
              <span style="color: #bb86fc; font-weight: bold;">${results.wcagLevel || 'AA'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: var(--r-text-muted, #6B7280);">${t('reports.accessibility.violationsFound', 'Violations Found')}</span>
              <span style="color: ${results.violationsCount > 0 ? '#ff4444' : '#00ff41'}; font-weight: bold;">${results.violationsCount || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: var(--r-text-muted, #6B7280);">${t('reports.accessibility.contrastIssues', 'Contrast Issues')}</span>
              <span style="color: ${results.contrastIssues > 0 ? '#ffa500' : '#00ff41'}; font-weight: bold;">${results.contrastIssues || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
              <span style="color: var(--r-text-muted, #6B7280);">${t('reports.accessibility.bestPractices', 'Best Practices')}</span>
              <span style="color: #bb86fc; font-weight: bold;">${results.bestPracticesCount || 0} ${t('reports.accessibility.passed', 'passed')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  reportScope.appendChild(summary);
  
  // Store results globally for PDF generation/share
  window.currentAccessibilityResults = {
    ...results,
    url: results.url || urlInput.value.trim()
  };

  // Desktop vs Mobile Comparison Section
  if (results.desktop && results.mobile) {
    const comparisonSection = document.createElement('div');
    comparisonSection.className = 'section';
    comparisonSection.innerHTML = createDesktopMobileComparison(results);
    reportScope.appendChild(comparisonSection);
  }

  // WCAG Compliance Levels Section
  const wcagLevelsSection = document.createElement('div');
  wcagLevelsSection.className = 'section';
  wcagLevelsSection.innerHTML = createWCAGLevelsSection(results);
  reportScope.appendChild(wcagLevelsSection);

  // Calculate average scores for accordion headers
  const avgWcagScore = results.desktop?.wcag?.score && results.mobile?.wcag?.score 
    ? Math.round((results.desktop.wcag.score + results.mobile.wcag.score) / 2)
    : (results.desktop?.wcag?.score || results.mobile?.wcag?.score || 0);

  const avgContrastScore = results.contrast?.score || 0;
  const avgKeyboardScore = results.keyboard?.score || 0;
  const avgAriaScore = results.aria?.score || 0;

  // Create accordion sections using ReportAccordion
  const accordionSection = document.createElement('div');
  accordionSection.className = 'accordion-container';

  const accordionHTML = [
    ReportAccordion.createSection({
      id: 'wcag-compliance',
      title: t('reports.accessibility.wcag21Compliance', 'WCAG 2.1 Compliance'),
      scoreTextRight: `${avgWcagScore}/100`,
      contentHTML: renderWCAGContent(results.desktop?.wcag, results.mobile?.wcag)
    }),
    ReportAccordion.createSection({
      id: 'color-contrast',
      title: t('reports.accessibility.colorContrastAnalysis', 'Color Contrast Analysis'),
      scoreTextRight: `${avgContrastScore}/100`,
      contentHTML: renderContrastContent(results.contrast)
    }),
    ReportAccordion.createSection({
      id: 'keyboard-navigation',
      title: t('reports.accessibility.keyboardNav', 'Keyboard Navigation'),
      scoreTextRight: `${avgKeyboardScore}/100`,
      contentHTML: renderKeyboardContent(results.keyboard)
    }),
    ReportAccordion.createSection({
      id: 'aria-implementation',
      title: t('reports.accessibility.ariaSemantics', 'ARIA & Semantics'),
      scoreTextRight: `${avgAriaScore}/100`,
      isPro: true,
      locked: !userHasPro(),
      context: 'accessibility',
      contentHTML: renderARIAContent(results.aria)
    }),
    ReportAccordion.createSection({
      id: 'report-recommendations',
      title: t('reports.common.fixCodeRecommendations', 'Recommendations'),
      isPro: true,
      locked: !userHasPro(),
      context: 'accessibility',
      contentHTML: renderRecommendationsContent(results.recommendations, results)
    })
  ].join('');

  accordionSection.innerHTML = accordionHTML;
  reportScope.appendChild(accordionSection);

  // Initialize ReportAccordion interactions
  ReportAccordion.initInteractions();

  // Summary block (mirror SEO layout)
  const summaryFooter = document.createElement('div');
  summaryFooter.className = 'section';
  summaryFooter.innerHTML = `
    <h2>${t('reports.common.summary', 'Summary')}</h2>
    <div class="seo-summary">
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-value">${countAccessibilityIssues(results)}</span>
          <span class="stat-label">${t('reports.accessibility.issuesFound', 'Issues Found')}</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${countAccessibilityRecommendations(results)}</span>
          <span class="stat-label">${t('reports.common.recommendations', 'Recommendations')}</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${countAccessibilityPassedChecks(results)}</span>
          <span class="stat-label">${t('reports.accessibility.checksPassed', 'Checks Passed')}</span>
        </div>
      </div>
    </div>
  `;
  reportScope.appendChild(summaryFooter);

  // Monetization actions (export/share)
  const actionsFooter = document.createElement('div');
  actionsFooter.className = 'section';

  // Use new ProReportBlock component if available
  if (window.ProReportBlock && window.ProReportBlock.render) {
    actionsFooter.innerHTML = window.ProReportBlock.render({
      context: 'accessibility',
      features: ['pdf', 'excel', 'csv', 'share'],
      title: t('reports.common.unlockReport', 'Unlock Report'),
      subtitle: t('reports.common.unlockSubtitle', 'PDF export, share link, export data, and fix packs for this scan.')
    });
  } else {
    const opts = { context: 'accessibility', features: ['pdf', 'excel', 'csv', 'share'], title: 'Unlock Report', subtitle: 'PDF export, share link, export data, and fix packs for this scan.' };
    const safe = JSON.stringify(opts).replace(/</g, '\\u003c').replace(/"/g, '&quot;');
    actionsFooter.innerHTML = '<div class="pro-report-block" data-pro-block-pending data-pro-block-options="' + safe + '"></div>';
  }
  reportScope.appendChild(actionsFooter);

  // Append the complete report scope to container
  container.appendChild(reportScope);

  // Auto-save report if user has access (purchased or Pro)
  const reportIdForSave = document.body.getAttribute('data-report-id') || '';
  if (reportIdForSave && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
    window.ReportStorage.autoSaveIfEligible(reportIdForSave, results, {
      siteUrl: results.url || urlInput.value.trim(),
      analyzerType: 'accessibility',
      scannedAt: window.SM_SCAN_STARTED_AT || new Date().toISOString()
    });
  }
}

/**
 * Create WCAG Compliance Levels Section
 */
function createWCAGLevelsSection(results) {
  // Determine current WCAG level based on score
  const score = results.accessibilityScore || 0;
  let currentLevel = 'None';
  if (score >= 95) currentLevel = 'AAA';
  else if (score >= 80) currentLevel = 'AA';
  else if (score >= 60) currentLevel = 'A';

  return `
    <h2>${t('reports.accessibility.wcagComplianceLevels', 'WCAG Compliance Levels')}</h2>
    <div class="wcag-section-container" style="padding-left: 1rem;">
      <p style="color: #ffd700; margin-bottom: 1.5rem;">>> ${t('reports.accessibility.understandingWcag', 'Understanding WCAG 2.1 Conformance Levels')}</p>
      
      <div class="wcag-levels-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Level A Card -->
        <div class="wcag-level-card" style="
          background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,215,0,0.05) 100%);
          border: 2px solid ${currentLevel === 'A' ? '#ffd700' : 'rgba(255,215,0,0.3)'};
          border-radius: 12px;
          padding: 1.5rem;
          ${currentLevel === 'A' ? 'box-shadow: 0 0 20px rgba(255,215,0,0.3);' : ''}
        ">
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="
              width: 80px;
              height: 80px;
              margin: 0 auto;
              border-radius: 50%;
              background: #ffffff;
              border: 3px solid #ffd700;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2rem;
              font-weight: 900;
              color: #000000;
              box-shadow: 0 0 15px rgba(255,215,0,0.4), 0 2px 8px rgba(0,0,0,0.15);
            ">A</div>
          </div>
          <h3 style="color: #ffd700; text-align: center; margin: 0 0 1rem 0; font-size: 1.2rem;">
            ${t('reports.accessibility.levelA', 'Level A')}
          </h3>
          <div style="text-align: center; margin-bottom: 1rem;">
            <span style="
              color: #ffd700;
              font-size: 0.9rem;
              padding: 0.3rem 0.8rem;
              border-radius: 4px;
              background: rgba(255,215,0,0.2);
              border: 1px solid rgba(255,215,0,0.4);
            ">${t('reports.accessibility.minimumAccessibility', 'Minimum Accessibility')}</span>
          </div>
          <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem;">
            ${t('reports.accessibility.levelADescription', 'Removes the most critical barriers to access for people with disabilities.')}
          </p>
          <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 6px; padding: 1rem; margin-top: 1rem;">
            <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600;">${t('reports.accessibility.keyRequirements', 'Key Requirements')}:</div>
            <ul style="color: #b0b0b0; font-size: 0.85rem; margin: 0; padding-left: 1.2rem; line-height: 1.8;">
              <li>${t('reports.accessibility.reqTextAlternatives', 'Text alternatives for images')}</li>
              <li>${t('reports.accessibility.reqKeyboardAccessibility', 'Keyboard accessibility')}</li>
              <li>${t('reports.accessibility.reqNoSeizure', 'No seizure-inducing content')}</li>
            </ul>
          </div>
          <div style="margin-top: 1rem; text-align: center; color: var(--r-text-faint, #9CA3AF); font-size: 0.8rem;">
            ◉ ${t('reports.accessibility.score', 'Score')}: 60-79
          </div>
        </div>

        <!-- Level AA Card -->
        <div class="wcag-level-card" style="
          background: linear-gradient(135deg, rgba(0,255,65,0.15) 0%, rgba(0,255,65,0.05) 100%);
          border: 2px solid ${currentLevel === 'AA' ? '#00ff41' : 'rgba(0,255,65,0.3)'};
          border-radius: 12px;
          padding: 1.5rem;
          ${currentLevel === 'AA' ? 'box-shadow: 0 0 20px rgba(0,255,65,0.3);' : ''}
        ">
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="
              width: 80px;
              height: 80px;
              margin: 0 auto;
              border-radius: 50%;
              background: #ffffff;
              border: 3px solid #00ff41;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.8rem;
              font-weight: 900;
              color: #000000;
              box-shadow: 0 0 15px rgba(0,255,65,0.4), 0 2px 8px rgba(0,0,0,0.15);
            ">AA</div>
          </div>
          <h3 style="color: #00ff41; text-align: center; margin: 0 0 1rem 0; font-size: 1.2rem;">
            ${t('reports.accessibility.levelAA', 'Level AA')}
          </h3>
          <div style="text-align: center; margin-bottom: 1rem;">
            <span style="
              color: #00ff41;
              font-size: 0.9rem;
              padding: 0.3rem 0.8rem;
              border-radius: 4px;
              background: rgba(0,255,65,0.2);
              border: 1px solid rgba(0,255,65,0.4);
            ">${t('reports.accessibility.industryStandard', 'Industry Standard')}</span>
          </div>
          <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem;">
            ${t('reports.accessibility.levelAADescription', 'The accepted legal and industry standard (ADA, Section 508, EN 301 549).')}
          </p>
          <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 6px; padding: 1rem; margin-top: 1rem;">
            <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600;">${t('reports.accessibility.keyRequirements', 'Key Requirements')}:</div>
            <ul style="color: #b0b0b0; font-size: 0.85rem; margin: 0; padding-left: 1.2rem; line-height: 1.8;">
              <li>${t('reports.accessibility.reqColorContrast', 'Sufficient color contrast (4.5:1)')}</li>
              <li>${t('reports.accessibility.reqFocusIndicators', 'Visible focus indicators')}</li>
              <li>${t('reports.accessibility.reqContentReflows', 'Content reflows properly')}</li>
              <li>${t('reports.accessibility.reqAllLevelA', 'All Level A requirements')}</li>
            </ul>
          </div>
          <div style="margin-top: 1rem; text-align: center; color: var(--r-text-faint, #9CA3AF); font-size: 0.8rem;">
            ◉ ${t('reports.accessibility.score', 'Score')}: 80-94
          </div>
        </div>

        <!-- Level AAA Card -->
        <div class="wcag-level-card" style="
          background: linear-gradient(135deg, rgba(0,217,255,0.15) 0%, rgba(0,217,255,0.05) 100%);
          border: 2px solid ${currentLevel === 'AAA' ? '#00d9ff' : 'rgba(0,217,255,0.3)'};
          border-radius: 12px;
          padding: 1.5rem;
          ${currentLevel === 'AAA' ? 'box-shadow: 0 0 20px rgba(0,217,255,0.3);' : ''}
        ">
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="
              width: 80px;
              height: 80px;
              margin: 0 auto;
              border-radius: 50%;
              background: #ffffff;
              border: 3px solid #00d9ff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.5rem;
              font-weight: 900;
              color: #000000;
              box-shadow: 0 0 15px rgba(0,217,255,0.4), 0 2px 8px rgba(0,0,0,0.15);
            ">AAA</div>
          </div>
          <h3 style="color: #00d9ff; text-align: center; margin: 0 0 1rem 0; font-size: 1.2rem;">
            ${t('reports.accessibility.levelAAA', 'Level AAA')}
          </h3>
          <div style="text-align: center; margin-bottom: 1rem;">
            <span style="
              color: #00d9ff;
              font-size: 0.9rem;
              padding: 0.3rem 0.8rem;
              border-radius: 4px;
              background: rgba(0,217,255,0.2);
              border: 1px solid rgba(0,217,255,0.4);
            ">${t('reports.accessibility.highestAccessibility', 'Highest Accessibility')}</span>
          </div>
          <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem;">
            ${t('reports.accessibility.levelAAADescription', 'Highest conformance level. Addresses all accessibility requirements.')}
          </p>
          <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 6px; padding: 1rem; margin-top: 1rem;">
            <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600;">${t('reports.accessibility.keyRequirements', 'Key Requirements')}:</div>
            <ul style="color: #b0b0b0; font-size: 0.85rem; margin: 0; padding-left: 1.2rem; line-height: 1.8;">
              <li>${t('reports.accessibility.reqSignLanguage', 'Sign language interpretation')}</li>
              <li>${t('reports.accessibility.reqAudioDescriptions', 'Extended audio descriptions')}</li>
              <li>${t('reports.accessibility.reqHighContrast', 'Very high contrast (7:1)')}</li>
              <li>${t('reports.accessibility.reqAllLevelAAA', 'All Level A & AA requirements')}</li>
            </ul>
          </div>
          <div style="margin-top: 1rem; text-align: center; color: var(--r-text-faint, #9CA3AF); font-size: 0.8rem;">
            ◉ ${t('reports.accessibility.score', 'Score')}: 95-100
          </div>
        </div>
      </div>

      <!-- Current Level Status -->
      <div class="wcag-status-box" style="
        background: linear-gradient(135deg, ${currentLevel === 'AAA' ? 'rgba(0,217,255,0.1)' : currentLevel === 'AA' ? 'rgba(0,255,65,0.1)' : currentLevel === 'A' ? 'rgba(255,215,0,0.1)' : 'rgba(255,68,68,0.1)'} 0%, rgba(0,0,0,0.05) 100%);
        border: 2px solid ${currentLevel === 'AAA' ? '#00d9ff' : currentLevel === 'AA' ? '#00ff41' : currentLevel === 'A' ? '#ffd700' : '#ff4444'};
        border-radius: 12px;
        padding: 1.5rem;
        text-align: center;
        box-shadow: 0 4px 15px ${currentLevel === 'AAA' ? 'rgba(0,217,255,0.2)' : currentLevel === 'AA' ? 'rgba(0,255,65,0.2)' : currentLevel === 'A' ? 'rgba(255,215,0,0.2)' : 'rgba(255,68,68,0.2)'};
      ">
        <h3 style="color: ${currentLevel === 'AAA' ? '#00d9ff' : currentLevel === 'AA' ? '#00ff41' : currentLevel === 'A' ? '#ffd700' : '#ff4444'}; margin: 0 0 1rem 0; font-size: 1.35rem;">
          ${currentLevel === 'None' ? '✗ ' + t('reports.accessibility.notCompliant', 'Not Compliant') : '✓ ' + t('reports.accessibility.meetsWcagLevel', 'Meets WCAG Level {{level}}', {level: currentLevel})}
        </h3>
        <p style="color: var(--r-text-muted, #6B7280); font-size: 1rem; margin: 0;">
          ${currentLevel === 'None' ? t('reports.accessibility.notCompliantDesc', 'This website does not meet minimum WCAG accessibility standards. Immediate improvements are needed.') :
            currentLevel === 'A' ? t('reports.accessibility.levelAStatus', 'This website meets minimum accessibility standards but has room for improvement to reach the industry-standard Level AA.') :
            currentLevel === 'AA' ? t('reports.accessibility.levelAAStatus', 'This website meets industry-standard accessibility requirements. Consider implementing AAA enhancements for optimal accessibility.') :
            t('reports.accessibility.levelAAAStatus', 'This website achieves the highest level of accessibility compliance. Excellent work!')}
        </p>
      </div>

      <div class="wcag-note-box" style="margin-top: 1.5rem; padding: 1rem; background: rgba(138,43,226,0.05); border-radius: 8px; border-left: 3px solid #bb86fc;">
        <p style="color: #bb86fc; font-size: 0.9rem; margin: 0; line-height: 1.6;">
          <strong>ⓘ ${t('reports.common.note', 'Note')}:</strong> ${t('reports.accessibility.wcagNote', 'Level AA is the industry standard—it covers 90% of real user needs without excessive implementation cost. Level AAA is not always feasible for all content types.')}
        </p>
      </div>
    </div>
  `;
}

/**
 * Create Desktop vs Mobile Comparison Section
 */
function createDesktopMobileComparison(results) {
  const desktopScore = results.desktop?.accessibilityScore || 0;
  const mobileScore = results.mobile?.accessibilityScore || 0;
  const scoreDiff = Math.abs(desktopScore - mobileScore);
  
  // Check if Lighthouse failed for either platform
  const desktopFailed = results.desktop?.lighthouse?.failed || (results.desktop?.lighthouse?.score === 0 && results.desktop?.lighthouse?.error);
  const mobileFailed = results.mobile?.lighthouse?.failed || (results.mobile?.lighthouse?.score === 0 && results.mobile?.lighthouse?.error);
  const anyFailed = desktopFailed || mobileFailed;

  return `
    <h2>${t('reports.accessibility.desktopVsMobile', 'Desktop vs Mobile Comparison')}</h2>
    <div style="padding-left: 1rem;">
      <p style="color: #bb86fc; margin-bottom: 1.5rem;">>> ${t('reports.accessibility.analyzedBothPlatforms', 'Analyzed both desktop and mobile for accessibility issues')}</p>
      
      ${anyFailed ? `
        <div style="
          background: rgba(255,165,0,0.1);
          border: 2px solid rgba(255,165,0,0.5);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
          text-align: center;
        ">
          <div style="color: #ffa500; font-size: 1.2rem; margin-bottom: 0.5rem;">~ ${t('reports.accessibility.partialAnalysis', 'Partial Analysis')}</div>
          <p style="color: var(--r-text-muted, #6B7280); margin: 0; font-size: 0.9rem;">
            ${desktopFailed && mobileFailed ? t('reports.accessibility.bothTimedOut', 'Both desktop and mobile Lighthouse analyses timed out.') :
              desktopFailed ? t('reports.accessibility.desktopTimedOut', 'Desktop Lighthouse analysis timed out.') : t('reports.accessibility.mobileTimedOut', 'Mobile Lighthouse analysis timed out.')}
            ${t('reports.accessibility.usingAxeCore', 'Using alternative accessibility metrics from axe-core for affected platform(s).')}
          </p>
        </div>
      ` : ''}
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Desktop Column -->
        <div style="
          background: linear-gradient(135deg, rgba(0,204,255,0.1), rgba(0,102,204,0.05));
          border: 2px solid #00ccff;
          border-radius: 8px;
          padding: 1.5rem;
        ">
          ${createPlatformCard('D ' + t('reports.accessibility.desktop', 'Desktop'), desktopScore, results.desktop, '#00ccff')}
        </div>
        
        <!-- Mobile Column -->
        <div style="
          background: linear-gradient(135deg, rgba(255,102,0,0.1), rgba(255,102,0,0.05));
          border: 2px solid #ff6600;
          border-radius: 8px;
          padding: 1.5rem;
        ">
          ${createPlatformCard('M ' + t('reports.accessibility.mobile', 'Mobile'), mobileScore, results.mobile, '#ff6600')}
        </div>
      </div>
      
      <!-- Accessibility Gap Warning (only show if both analyses succeeded) -->
      ${!anyFailed && scoreDiff > 10 ? `
        <div style="
          background: linear-gradient(135deg, rgba(255,165,0,0.15), rgba(255,68,68,0.15));
          border: 2px solid #ffa500;
          border-radius: 8px;
          padding: 1.5rem;
          margin-top: 1rem;
        ">
          <h4 style="color: #ffa500; margin: 0 0 0.75rem 0; font-size: 1.1rem;">
            ~ ${t('reports.accessibility.accessibilityGapDetected', 'Accessibility Gap Detected')}
          </h4>
          <p style="color: var(--r-text-muted, #6B7280); margin: 0;">
            ${t('reports.accessibility.gapDescription', 'There is a {{diff}}-point difference between desktop ({{desktop}}) and mobile ({{mobile}}) accessibility.', {diff: scoreDiff, desktop: desktopScore, mobile: mobileScore})}
            ${desktopScore > mobileScore ? t('reports.accessibility.mobileBarriers', 'Mobile users may face additional barriers.') : t('reports.accessibility.desktopBarriers', 'Desktop users may face additional barriers.')}
            ${t('reports.accessibility.reviewPlatformIssues', 'Review platform-specific issues in the detailed analysis below.')}
          </p>
        </div>
      ` : !anyFailed ? `
        <div style="
          background: rgba(0,255,65,0.1);
          border: 2px solid #00ff41;
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
        ">
          <p style="color: #00ff41; margin: 0;">
            ✓ ${t('reports.accessibility.consistentAccessibility', 'Consistent Accessibility')} - ${t('reports.accessibility.platformsWithin', 'Both platforms scored within {{diff}} points of each other', {diff: scoreDiff})}
          </p>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Create platform card for comparison
 */
function createPlatformCard(title, score, data, color) {
  // Check if Lighthouse analysis failed
  const lighthouseFailed = data?.lighthouse?.failed || (data?.lighthouse?.score === 0 && data?.lighthouse?.error);
  const lighthouseError = data?.lighthouse?.error || t('reports.common.analysisIncomplete', 'Analysis incomplete');
  
  return `
    <div style="text-align: center; margin-bottom: 1rem;">
      <div style="font-size: 1.5rem; color: ${color}; margin-bottom: 0.5rem;">${title}</div>
      <div style="
        width: 120px;
        height: 120px;
        margin: 0 auto;
        border-radius: 50%;
        background: #ffffff;
        border: 4px solid ${lighthouseFailed ? '#666666' : getAccessibilityColor(score)};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 20px ${lighthouseFailed ? '#66666640' : getAccessibilityColor(score) + '40'}, 0 2px 8px rgba(0,0,0,0.15);
      ">
        ${lighthouseFailed ? `
          <div style="
            font-size: 1.5rem;
            font-weight: 900;
            color: #999999;
            line-height: 1.2;
            text-align: center;
            padding: 0.5rem;
          ">${t('reports.common.notAvailable', 'N/A')}</div>
          <div style="color: #666666; font-size: 0.65rem; margin-top: 0.25rem; font-weight: 600; text-align: center; padding: 0 0.5rem;">
            ${t('reports.common.timeout', 'Timeout')}
          </div>
        ` : `
          <div style="
            font-size: 2.8rem;
            font-weight: 900;
            color: #000000;
            line-height: 1;
          ">${score}</div>
          <div style="color: #666666; font-size: 0.75rem; margin-top: 0.25rem; font-weight: 600;">/ 100</div>
        `}
      </div>
      <div style="
        margin-top: 0.75rem;
        font-weight: bold;
        color: ${lighthouseFailed ? '#999999' : getAccessibilityColor(score)};
      ">${lighthouseFailed ? t('reports.common.analysisFailed', 'Analysis failed') : getAccessibilityGrade(score)}</div>
    </div>
    
    ${lighthouseFailed ? `
      <div style="border-top: 1px solid ${color}40; padding-top: 1rem;">
        <div style="
          background: rgba(255,165,0,0.1);
          border: 1px solid rgba(255,165,0,0.3);
          border-radius: 6px;
          padding: 0.75rem;
          text-align: center;
        ">
          <div style="color: #ffa500; font-size: 1.2rem; margin-bottom: 0.5rem;">⧗</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.85rem; line-height: 1.4;">
            ${t('reports.accessibility.lighthouseTimeout', 'Lighthouse analysis timed out after 45 seconds. This can happen with:')}
          </div>
          <ul style="text-align: left; color: #999999; font-size: 0.8rem; margin: 0.5rem 0 0 1.5rem; padding: 0; line-height: 1.6;">
            <li>${t('reports.accessibility.slowLoading', 'Slow-loading websites')}</li>
            <li>${t('reports.accessibility.heavyJavascript', 'Heavy JavaScript execution')}</li>
            <li>${t('reports.accessibility.antiBotProtection', 'Anti-bot protection')}</li>
            <li>${t('reports.accessibility.ssrDelays', 'Server-side rendering delays')}</li>
          </ul>
          <div style="color: #b0b0b0; font-size: 0.75rem; margin-top: 0.75rem; font-style: italic;">
            ${t('reports.accessibility.usingAxeCoreInstead', 'Using alternative accessibility metrics from axe-core instead')}
          </div>
        </div>
      </div>
    ` : `
      <div style="border-top: 1px solid ${color}40; padding-top: 1rem;">
        <h4 style="color: ${color}; margin: 0 0 0.75rem 0; font-size: 1rem;">${t('reports.accessibility.lighthouseScores', 'Lighthouse Scores')}</h4>
        <div style="display: grid; gap: 0.5rem;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--r-text-muted, #6B7280);">A ${t('reports.accessibility.accessibility', 'Accessibility')}</span>
            <span style="color: ${getAccessibilityColor(data?.lighthouse?.accessibility || 0)}; font-weight: bold;">
              ${data?.lighthouse?.accessibility || 0}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--r-text-muted, #6B7280);">P ${t('reports.accessibility.performance', 'Performance')}</span>
            <span style="color: ${getAccessibilityColor(data?.lighthouse?.performance || 0)}; font-weight: bold;">
              ${data?.lighthouse?.performance || 0}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--r-text-muted, #6B7280);">B ${t('reports.accessibility.bestPracticesLabel', 'Best Practices')}</span>
            <span style="color: ${getAccessibilityColor(data?.lighthouse?.bestPractices || 0)}; font-weight: bold;">
              ${data?.lighthouse?.bestPractices || 0}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--r-text-muted, #6B7280);">S ${t('reports.accessibility.seo', 'SEO')}</span>
            <span style="color: ${getAccessibilityColor(data?.lighthouse?.seo || 0)}; font-weight: bold;">
              ${data?.lighthouse?.seo || 0}
            </span>
          </div>
        </div>
      </div>
    `}
  `;
}

function safeOpenProPaywall(payload = {}) {
  if (typeof window.openProPaywall === 'function') {
    return window.openProPaywall(payload);
  }
  if (window.ProAccess && typeof window.ProAccess.openProPaywall === 'function') {
    return window.ProAccess.openProPaywall(payload);
  }
  if (window.PricingModal && typeof window.PricingModal.open === 'function') {
    return window.PricingModal.open(payload);
  }
  return null;
}

// Pro gating helpers
function getCurrentDomain() {
  if (window.ProAccess && typeof window.ProAccess.getCurrentDomain === 'function') {
    return window.ProAccess.getCurrentDomain();
  }
  return window.location.hostname;
}

function userHasPro() {
  // Check new billing model first (ProReportBlock)
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
  if (window.ExportGate && window.ExportGate.isPro()) {
    return true;
  }
  return false;
}

function renderLockedProPreview(title = '', previewLines = []) {
  const reportId = document.body?.getAttribute('data-report-id') || '';
  const displayTitle = title || t('reports.common.proContent', 'Pro content');
  const lines = previewLines.length ? previewLines : [t('reports.common.recommendationsPreview', 'Recommendations preview'), t('reports.common.codeFixesPreview', 'Code fixes preview')];
  return `
    <div class="pro-locked">
      <div class="pro-locked__header">
        <span class="pro-pill">PRO</span>
        <span>${displayTitle}</span>
      </div>
      <ul class="pro-locked__list">
        ${lines.slice(0, 2).map(line => `<li>${line}</li>`).join('')}
      </ul>
      <div class="pro-locked__blur"></div>
      <div class="pro-locked__buttons">
        <button class="pro-locked__unlock pro-locked__unlock--primary" data-buy-single-report${reportId ? ` data-report-id="${reportId}"` : ''} data-context="fixes">${t('reports.common.unlockFor5', 'Unlock for $5')}</button>
        <button class="pro-locked__unlock pro-locked__unlock--secondary" data-open-pricing-modal${reportId ? ` data-report-id="${reportId}"` : ''} data-context="fixes">${t('reports.common.goPro30', 'Go Pro — $30/mo')}</button>
      </div>
    </div>
  `;
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
      border: 1px solid rgba(0, 255, 65, 0.4);
      background: rgba(0, 255, 65, 0.1);
      color: #00ff41;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .pro-locked {
      position: relative;
      border: 1px dashed rgba(0, 255, 65, 0.3);
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

/**
 * Render WCAG Compliance Content
 */
function renderWCAGContent(desktopWcag, mobileWcag) {
  if (!desktopWcag && !mobileWcag) {
    return '<p style="color: #ff6600;">>>> ' + t('reports.accessibility.wcagDataNotAvailable', 'WCAG compliance data not available') + '</p>';
  }

  // Helper to render criterion row
  const renderCriterionRow = (criterion, desktopStatus, mobileStatus) => {
    const getStatusBadge = (status) => {
      const styles = {
        pass: { color: '#00ff41', icon: '✓', label: t('reports.accessibility.pass', 'Pass') },
        fail: { color: '#ff4444', icon: '✗', label: t('reports.accessibility.fail', 'Fail') },
        warning: { color: '#ffa500', icon: '~', label: t('reports.accessibility.warning', 'Warning') },
        na: { color: '#808080', icon: '–', label: t('reports.common.notAvailable', 'N/A') }
      };
      return styles[status] || styles.na;
    };

    const dBadge = getStatusBadge(desktopStatus);
    const mBadge = getStatusBadge(mobileStatus);

    return `
      <tr>
        <td style="color: #bb86fc;">${criterion}</td>
        <td style="text-align: center;">
          <span style="color: ${dBadge.color}; font-size: 1.2rem;">${dBadge.icon}</span>
        </td>
        <td style="text-align: center;">
          <span style="
            color: ${dBadge.color};
            font-size: 0.85rem;
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            background: ${dBadge.color}20;
          ">${dBadge.label}</span>
        </td>
        <td style="text-align: center;">
          <span style="color: ${mBadge.color}; font-size: 1.2rem;">${mBadge.icon}</span>
        </td>
        <td style="text-align: center;">
          <span style="
            color: ${mBadge.color};
            font-size: 0.85rem;
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            background: ${mBadge.color}20;
          ">${mBadge.label}</span>
        </td>
      </tr>
    `;
  };

  return `
    <div style="padding-left: 1rem;">
      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> ${t('reports.accessibility.wcagComplianceStatus', 'WCAG 2.1 Compliance Status')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1.5rem;">
        ${t('reports.accessibility.wcagAuditDescription', 'Web Content Accessibility Guidelines (WCAG) 2.1 Level AA compliance audit across both platforms.')}
      </p>

      <table class="seo-table" style="width: 100%; margin-bottom: 1.5rem;">
        <thead>
          <tr>
            <th style="text-align: left; width: 40%;">${t('reports.accessibility.successCriterion', 'Success Criterion')}</th>
            <th colspan="2" style="text-align: center; background: rgba(0,204,255,0.1); border-left: 2px solid #00ccff;">
              <span style="color: #00ccff;">D ${t('reports.accessibility.desktop', 'Desktop')}</span>
            </th>
            <th colspan="2" style="text-align: center; background: rgba(255,102,0,0.1); border-left: 2px solid #ff6600;">
              <span style="color: #ff6600;">M ${t('reports.accessibility.mobile', 'Mobile')}</span>
            </th>
          </tr>
          <tr style="font-size: 0.85rem;">
            <th style="border-top: 1px solid #333;"></th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(0,204,255,0.05);">${t('reports.common.result', 'Result')}</th>
            <th style="text-align: center; width: 15%; border-top: 1px solid #333; background: rgba(0,204,255,0.05);">${t('reports.common.status', 'Status')}</th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(255,102,0,0.05);">${t('reports.common.result', 'Result')}</th>
            <th style="text-align: center; width: 15%; border-top: 1px solid #333; background: rgba(255,102,0,0.05);">${t('reports.common.status', 'Status')}</th>
          </tr>
        </thead>
        <tbody>
          ${renderCriterionRow(t('reports.accessibility.report.wcag.criteria.nonTextContent', '1.1.1 Non-text Content'), desktopWcag?.criteria?.nonTextContent || 'pass', mobileWcag?.criteria?.nonTextContent || 'pass')}
          ${renderCriterionRow(t('reports.accessibility.report.wcag.criteria.infoRelationships', '1.3.1 Info and Relationships'), desktopWcag?.criteria?.infoRelationships || 'pass', mobileWcag?.criteria?.infoRelationships || 'pass')}
          ${renderCriterionRow(t('reports.accessibility.report.wcag.criteria.contrastMinimum', '1.4.3 Contrast (Minimum)'), desktopWcag?.criteria?.contrastMinimum || 'pass', mobileWcag?.criteria?.contrastMinimum || 'pass')}
          ${renderCriterionRow(t('reports.accessibility.report.wcag.criteria.keyboard', '2.1.1 Keyboard'), desktopWcag?.criteria?.keyboard || 'pass', mobileWcag?.criteria?.keyboard || 'pass')}
          ${renderCriterionRow(t('reports.accessibility.report.wcag.criteria.bypassBlocks', '2.4.1 Bypass Blocks'), desktopWcag?.criteria?.bypassBlocks || 'pass', mobileWcag?.criteria?.bypassBlocks || 'pass')}
          ${renderCriterionRow(t('reports.accessibility.report.wcag.criteria.pageTitled', '2.4.2 Page Titled'), desktopWcag?.criteria?.pageTitled || 'pass', mobileWcag?.criteria?.pageTitled || 'pass')}
          ${renderCriterionRow(t('reports.accessibility.report.wcag.criteria.focusOrder', '2.4.3 Focus Order'), desktopWcag?.criteria?.focusOrder || 'pass', mobileWcag?.criteria?.focusOrder || 'pass')}
          ${renderCriterionRow(t('reports.accessibility.report.wcag.criteria.languagePage', '3.1.1 Language of Page'), desktopWcag?.criteria?.languagePage || 'pass', mobileWcag?.criteria?.languagePage || 'pass')}
          ${renderCriterionRow(t('reports.accessibility.report.wcag.criteria.parsing', '4.1.1 Parsing'), desktopWcag?.criteria?.parsing || 'pass', mobileWcag?.criteria?.parsing || 'pass')}
          ${renderCriterionRow(t('reports.accessibility.report.wcag.criteria.nameRoleValue', '4.1.2 Name, Role, Value'), desktopWcag?.criteria?.nameRoleValue || 'pass', mobileWcag?.criteria?.nameRoleValue || 'pass')}
        </tbody>
      </table>
      
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(138,43,226,0.05); border-radius: 4px;">
        <h4 style="color: #bb86fc; margin: 0 0 0.5rem 0; font-size: 1rem;">📚 ${t('reports.accessibility.aboutWcag', 'About WCAG 2.1')}</h4>
        <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0;">
          ${t('reports.accessibility.aboutWcagDesc', 'WCAG 2.1 Level AA is the international standard for web accessibility. Meeting these criteria ensures your website is usable by people with disabilities and complies with legal requirements in many jurisdictions.')}
        </p>
      </div>
    </div>
  `;
}

/**
 * Render Color Contrast Content
 */
function renderContrastContent(contrast) {
  if (!contrast) {
    return '<p style="color: #ff6600;">>>> ' + t('reports.accessibility.contrastDataNotAvailable', 'Color contrast data not available') + '</p>';
  }

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>${t('reports.accessibility.platformAgnostic', 'Platform-Agnostic Metrics')}:</strong> ${t('reports.accessibility.contrastAgnosticDesc', 'Color contrast ratios are design-based and apply equally to all platforms.')}
        </p>
      </div>

      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> ${t('reports.accessibility.contrastRatioAnalysis', 'Contrast Ratio Analysis')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1.5rem;">
        ${t('reports.accessibility.wcagContrastRequirement', 'WCAG requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text.')}
        ${t('reports.accessibility.foundIssues', 'Found')} <strong style="color: ${contrast.issuesCount > 0 ? '#ff4444' : '#00ff41'};">${contrast.issuesCount || 0} ${t('reports.accessibility.issues', 'Issues')}</strong>.
      </p>
      
      ${contrast.issues && contrast.issues.length > 0 ? `
        <table class="seo-table" style="width: 100%; margin-bottom: 1.5rem;">
          <thead>
            <tr>
              <th style="text-align: left;">${t('reports.accessibility.element', 'Element')}</th>
              <th style="text-align: center;">${t('reports.accessibility.contrastRatio', 'Contrast Ratio')}</th>
              <th style="text-align: center;">${t('reports.accessibility.required', 'Required')}</th>
              <th style="text-align: center;">${t('reports.common.status', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            ${contrast.issues.slice(0, 10).map(issue => `
              <tr>
                <td style="color: var(--r-text-muted, #6B7280); font-family: monospace; font-size: 0.85rem;">${issue.selector || t('reports.accessibility.unknownElement', 'Unknown element')}</td>
                <td style="text-align: center;">
                  <span style="color: ${issue.ratio < 4.5 ? '#ff4444' : '#ffa500'}; font-weight: bold;">
                    ${issue.ratio?.toFixed(2) || t('reports.common.notAvailable', 'N/A')}:1
                  </span>
                </td>
                <td style="text-align: center; color: var(--r-text-faint, #9CA3AF);">${issue.required || '4.5:1'}</td>
                <td style="text-align: center;">
                  <span style="
                    color: ${issue.ratio >= 4.5 ? '#00ff41' : '#ff4444'};
                    font-size: 0.85rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 3px;
                    background: ${issue.ratio >= 4.5 ? '#00ff4120' : '#ff444420'};
                  ">${issue.ratio >= 4.5 ? t('reports.accessibility.pass', 'Pass') : t('reports.accessibility.fail', 'Fail')}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${contrast.issues.length > 10 ? `
          <p style="color: #ffa500; font-size: 0.9rem; margin-top: 0.5rem;">
            ~ ${t('reports.accessibility.showingOf', 'Showing 10 of {{total}} contrast issues. Review all issues in detailed audit.', {total: contrast.issues.length})}
          </p>
        ` : ''}
      ` : `
        <div style="background: rgba(0,255,65,0.1); border: 2px solid #00ff41; border-radius: 8px; padding: 1.5rem; text-align: center;">
          <p style="color: #00ff41; margin: 0; font-size: 1.1rem;">
            ✓ <strong>${t('reports.accessibility.excellentContrast', 'Excellent Contrast!')}</strong><br>
            ${t('reports.accessibility.allTextMeetsContrast', 'All text elements meet WCAG contrast requirements.')}
          </p>
        </div>
      `}
    </div>
  `;
}

/**
 * Render Keyboard Navigation Content
 */
function renderKeyboardContent(keyboard) {
  if (!keyboard) {
    return '<p style="color: #ff6600;">>>> ' + t('reports.accessibility.keyboardDataNotAvailable', 'Keyboard navigation data not available') + '</p>';
  }

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>${t('reports.accessibility.platformAgnostic', 'Platform-Agnostic Metrics')}:</strong> ${t('reports.accessibility.keyboardAgnosticDesc', 'Keyboard navigation patterns apply universally across devices with keyboard input.')}
        </p>
      </div>

      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> ${t('reports.accessibility.keyboardAccessibility', 'Keyboard accessibility')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1.5rem;">
        ${t('reports.accessibility.keyboardAccessibilityDesc', 'All interactive elements must be accessible via keyboard. Tab order should be logical and focus indicators visible.')}
      </p>

      <div style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; border-left: 4px solid #bb86fc;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--r-text-muted, #6B7280);">T ${t('reports.accessibility.focusableElements', 'Focusable Elements')}</span>
            <span style="color: #bb86fc; font-weight: bold; font-size: 1.2rem;">${keyboard.focusableCount || 0}</span>
          </div>
        </div>

        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; border-left: 4px solid ${keyboard.tabTraps > 0 ? '#ff4444' : '#00ff41'};">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--r-text-muted, #6B7280);">🚫 ${t('reports.accessibility.tabTrapsDetected', 'Tab Traps Detected')}</span>
            <span style="color: ${keyboard.tabTraps > 0 ? '#ff4444' : '#00ff41'}; font-weight: bold; font-size: 1.2rem;">${keyboard.tabTraps || 0}</span>
          </div>
        </div>

        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; border-left: 4px solid ${keyboard.missingFocusIndicators > 0 ? '#ffa500' : '#00ff41'};">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--r-text-muted, #6B7280);">👁️ ${t('reports.accessibility.missingFocusIndicators', 'Missing Focus Indicators')}</span>
            <span style="color: ${keyboard.missingFocusIndicators > 0 ? '#ffa500' : '#00ff41'}; font-weight: bold; font-size: 1.2rem;">${keyboard.missingFocusIndicators || 0}</span>
          </div>
        </div>
      </div>

      ${keyboard.issues && keyboard.issues.length > 0 ? `
        <h4 style="color: #bb86fc; margin: 1.5rem 0 0.75rem 0;">${t('reports.accessibility.keyboardIssuesFound', 'Keyboard Issues Found')}</h4>
        <div style="display: grid; gap: 0.75rem;">
          ${keyboard.issues.map(issue => `
            <div style="background: rgba(255,68,68,0.1); border-left: 3px solid #ff4444; padding: 1rem; border-radius: 4px;">
              <div style="color: #ff4444; font-weight: bold; margin-bottom: 0.25rem;">${issue.type || t('reports.accessibility.keyboardIssue', 'Keyboard Issue')}</div>
              <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${issue.description || t('reports.common.noDescriptionAvailable', 'No description available')}</div>
              ${issue.element ? `<div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; margin-top: 0.25rem; font-family: monospace;">${issue.element}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render ARIA Implementation Content
 */
function renderARIAContent(aria) {
  if (!aria) {
    return '<p style="color: #ff6600;">>>> ' + t('reports.accessibility.ariaDataNotAvailable', 'ARIA implementation data not available') + '</p>';
  }

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>${t('reports.accessibility.platformAgnostic', 'Platform-Agnostic Metrics')}:</strong> ${t('reports.accessibility.ariaAgnosticDesc', 'ARIA attributes and semantic HTML apply universally to assistive technologies.')}
        </p>
      </div>

      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> ${t('reports.accessibility.ariaSemanticHtml', 'ARIA & Semantic HTML')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1.5rem;">
        ${t('reports.accessibility.ariaDescription', 'Proper use of ARIA attributes and semantic HTML elements ensures screen readers can understand and navigate your content.')}
      </p>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: #bb86fc; margin-bottom: 0.5rem;">${aria.landmarksCount || 0}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${t('reports.accessibility.ariaLandmarks', 'ARIA Landmarks')}</div>
        </div>

        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: ${aria.missingLabels > 0 ? '#ff4444' : '#00ff41'}; margin-bottom: 0.5rem;">${aria.missingLabels || 0}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${t('reports.accessibility.missingLabels', 'Missing Labels')}</div>
        </div>

        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: ${aria.invalidRoles > 0 ? '#ffa500' : '#00ff41'}; margin-bottom: 0.5rem;">${aria.invalidRoles || 0}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${t('reports.accessibility.invalidRoles', 'Invalid Roles')}</div>
        </div>

        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: #bb86fc; margin-bottom: 0.5rem;">${aria.headingStructure || t('reports.accessibility.good', 'Good')}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${t('reports.accessibility.headingStructure', 'Heading Structure')}</div>
        </div>
      </div>

      ${aria.issues && aria.issues.length > 0 ? `
        <h4 style="color: #bb86fc; margin: 1.5rem 0 0.75rem 0;">${t('reports.accessibility.ariaIssuesFound', 'ARIA Issues Found')}</h4>
        <table class="seo-table" style="width: 100%;">
          <thead>
            <tr>
              <th style="text-align: left;">${t('reports.accessibility.issueType', 'Issue Type')}</th>
              <th style="text-align: left;">${t('reports.common.description', 'Description')}</th>
              <th style="text-align: center;">${t('reports.accessibility.impact', 'Impact')}</th>
            </tr>
          </thead>
          <tbody>
            ${aria.issues.slice(0, 10).map(issue => `
              <tr>
                <td style="color: #bb86fc; font-weight: bold;">${issue.type || t('reports.accessibility.ariaIssue', 'ARIA Issue')}</td>
                <td style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${issue.description || t('reports.common.noDescription', 'No description')}</td>
                <td style="text-align: center;">
                  <span style="
                    color: ${issue.impact === 'critical' ? '#ff4444' : issue.impact === 'serious' ? '#ffa500' : '#00ccff'};
                    font-size: 0.85rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 3px;
                    background: ${issue.impact === 'critical' ? '#ff444420' : issue.impact === 'serious' ? '#ffa50020' : '#00ccff20'};
                    text-transform: uppercase;
                  ">${issue.impact === 'critical' ? t('reports.accessibility.critical', 'Critical') : issue.impact === 'serious' ? t('reports.accessibility.serious', 'Serious') : t('reports.accessibility.moderate', 'Moderate')}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>
  `;
}

/**
 * Render Recommendations Content - Accordion + Tabs pattern
 */
function renderRecommendationsContent(recommendations, fullResults) {
  ensureA11yFixStyles();

  // Store fullResults for code generation
  window._a11yFullResults = fullResults || {};

  const introSection = `
    <div style="padding-left: 1rem; margin-bottom: 1.5rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(255,165,0,0.1); border-left: 3px solid #ffa500; border-radius: 4px;">
        <p style="color: #ffa500; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>${t('reports.accessibility.crossPlatformRecs', 'Cross-Platform Recommendations')}:</strong> ${t('reports.accessibility.crossPlatformRecsDesc', 'These accessibility improvements are analyzed based on both desktop and mobile to ensure inclusive design.')}
        </p>
      </div>
    </div>
  `;

  if (!recommendations || !recommendations.length) {
    return `
      ${introSection}
      <div style="padding: 2rem; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">✓</div>
        <h3 style="color: #22c55e; margin: 0 0 0.5rem 0;">${t('reports.accessibility.excellentAccessibility', 'Excellent Accessibility!')}</h3>
        <p style="color: var(--r-text-muted, #6B7280);">${t('reports.accessibility.noIssuesFound', 'No critical accessibility issues found. Your site meets WCAG 2.1 guidelines across both desktop and mobile!')}</p>
      </div>
    `;
  }

  // Group by priority
  const high = recommendations.filter(r => r.priority === 'high');
  const medium = recommendations.filter(r => r.priority === 'medium');
  const low = recommendations.filter(r => r.priority === 'low');
  const allFixes = [...high, ...medium, ...low];

  let html = `
    ${introSection}
    <div class="a11y-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">♿</span> ${t('reports.accessibility.accessibilityFixes', 'Accessibility Fixes')}
        <span style="font-size: 0.875rem; color: var(--r-text-faint, #9CA3AF); font-weight: normal;">(${allFixes.length} ${t('reports.accessibility.improvementsFound', '{{count}} improvements found')})</span>
      </h3>
      <div class="a11y-fixes-list">
  `;

  allFixes.forEach((rec, index) => {
    html += renderA11yFixAccordion(rec, index, fullResults);
  });

  html += `</div></div>`;
  return html;
}

function renderA11yFixAccordion(rec, index, fullResults) {
  const accordionId = `a11yfix-${index}`;
  const priorityStyles = {
    high: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴', label: t('reports.common.high', 'High') },
    medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠', label: t('reports.common.medium', 'Medium') },
    low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢', label: t('reports.common.low', 'Low') }
  };
  const style = priorityStyles[rec.priority] || priorityStyles.medium;

  return `
    <div class="a11y-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="a11y-fix-header" data-action="toggle-accordion" data-accordion-id="${accordionId}" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: var(--r-text, #111827);">${(typeof translateA11yFixTitle === 'function' ? translateA11yFixTitle(rec.title) : rec.title) || t('reports.accessibility.accessibilityIssue', 'Accessibility Issue')}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${rec.wcagReference || t('reports.accessibility.wcag21Compliance', 'WCAG 2.1 Compliance')}</p>
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
          ">${style.label}</span>
          <span class="a11y-fix-expand-icon" style="color: var(--r-text-faint, #9CA3AF); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="a11y-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderA11yFixTabs(rec, accordionId, fullResults)}
        </div>
      </div>
    </div>
  `;
}

function renderA11yFixTabs(rec, accordionId, fullResults) {
  return `
    <div class="a11y-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); padding-bottom: 0.75rem;">
      <button class="a11y-fix-tab active" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: var(--r-text, #111827);
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 ${t('reports.common.summary', 'Summary')}</button>
      <button class="a11y-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="code" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 ${t('reports.common.code', 'Code')}</button>
      <button class="a11y-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">🔧 ${t('reports.common.fixGuide', 'Fix Guide')}</button>
    </div>

    <!-- Summary Tab -->
    <div class="a11y-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: var(--r-text-muted, #6B7280); line-height: 1.7; margin: 0 0 1rem 0;">
        ${(typeof translateA11yFixDescription === 'function' ? translateA11yFixDescription(rec.title, rec.description) : rec.description) || t('reports.common.noDescriptionAvailable', 'No description available')}
      </p>
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ ${t('reports.common.expectedImpact', 'Expected Impact')}</div>
        <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${(typeof translateA11yFixImpact === 'function' ? translateA11yFixImpact(rec.title, rec.impact) : rec.impact) || t('reports.accessibility.defaultImpact', 'Improved accessibility and user experience for all users')}</div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="a11y-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Current Issue -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
            <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ ${t('reports.common.currentIssue', 'Current Issue')}</span>
            <button data-action="copy-code" data-copy-target="${accordionId}-problem" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: var(--r-text, #111827);
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 ${t('reports.common.copy', 'Copy')}</button>
          </div>
          <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${escapeHtmlA11y(getA11yProblemCode(rec, fullResults))}</pre>
        </div>

        <!-- Fixed Code -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ ${t('reports.common.recommendedFix', 'Recommended Fix')}</span>
            <button data-action="copy-code" data-copy-target="${accordionId}-solution" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: var(--r-text, #111827);
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 ${t('reports.common.copy', 'Copy')}</button>
          </div>
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${escapeHtmlA11y(getA11ySolutionCode(rec, fullResults))}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="a11y-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--r-text, #111827);">${t('reports.common.stepByStepFix', 'Step-by-Step Fix')}:</h5>
      <ol style="margin: 0 0 1.5rem 0; padding-left: 1.5rem; color: var(--r-text-muted, #6B7280); line-height: 1.8;">
        ${getA11yFixSteps(rec, fullResults).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
      ${getA11yExternalTools(rec)}
    </div>
  `;
}

function toggleA11yFixAccordion(accordionId) {
  const content = document.getElementById(accordionId + '-content');
  const header = content?.previousElementSibling;
  const icon = header?.querySelector('.a11y-fix-expand-icon');
  
  if (!content) return;
  
  const isOpen = content.style.maxHeight && content.style.maxHeight !== '0px';
  
  if (isOpen) {
    content.style.maxHeight = '0';
    if (icon) icon.style.transform = 'rotate(0deg)';
  } else {
    content.style.maxHeight = content.scrollHeight + 'px';
    if (icon) icon.style.transform = 'rotate(180deg)';
  }
}

function switchA11yFixTab(accordionId, tabName) {
  const container = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!container) return;
  
  // Update tab buttons
  container.querySelectorAll('.a11y-fix-tab').forEach(tab => {
    tab.classList.remove('active');
    tab.style.background = 'transparent';
    tab.style.color = '#aaa';
    tab.style.borderColor = 'rgba(255,255,255,0.1)';
  });
  
  // Find clicked tab and activate
  const tabs = container.querySelectorAll('.a11y-fix-tab');
  const tabIndex = tabName === 'summary' ? 0 : tabName === 'code' ? 1 : 2;
  if (tabs[tabIndex]) {
    tabs[tabIndex].classList.add('active');
    tabs[tabIndex].style.background = 'rgba(255,255,255,0.1)';
    tabs[tabIndex].style.color = '#fff';
    tabs[tabIndex].style.borderColor = 'rgba(255,255,255,0.2)';
  }
  
  // Update tab content
  container.querySelectorAll('.a11y-fix-tab-content').forEach(content => {
    content.style.display = 'none';
    content.classList.remove('active');
  });
  
  const activeContent = document.getElementById(`${accordionId}-${tabName}`);
  if (activeContent) {
    activeContent.style.display = 'block';
    activeContent.classList.add('active');
  }
  
  // Recalculate max-height after tab switch
  const accordionContent = document.getElementById(accordionId + '-content');
  if (accordionContent && accordionContent.style.maxHeight !== '0px') {
    accordionContent.style.maxHeight = accordionContent.scrollHeight + 'px';
  }
}

window.toggleA11yFixAccordion = toggleA11yFixAccordion;
window.switchA11yFixTab = switchA11yFixTab;

// Add click event delegation for accessibility fix accordions, tabs, and actions
document.addEventListener('click', function(e) {
  const target = e.target.closest('[data-action]');
  if (target) {
    const action = target.getAttribute('data-action');

    switch (action) {
      case 'reload-page':
        e.preventDefault();
        window.location.reload();
        return;

      case 'export-pdf':
        e.preventDefault();
        if (typeof exportAccessibilityPDF === 'function') exportAccessibilityPDF();
        return;

      case 'copy-share-link':
        e.preventDefault();
        if (typeof copyAccessibilityShareLink === 'function') copyAccessibilityShareLink();
        return;

      case 'download-csv':
        e.preventDefault();
        if (typeof downloadAccessibilityCSV === 'function') downloadAccessibilityCSV();
        return;

      case 'toggle-accordion': {
        const accordionId = target.getAttribute('data-accordion-id');
        if (accordionId && typeof window.toggleA11yFixAccordion === 'function') {
          window.toggleA11yFixAccordion(accordionId);
        }
        return;
      }

      case 'switch-tab': {
        const accordionId = target.getAttribute('data-accordion-id');
        const tabName = target.getAttribute('data-tab');
        if (accordionId && tabName && typeof window.switchA11yFixTab === 'function') {
          e.preventDefault();
          e.stopPropagation();
          window.switchA11yFixTab(accordionId, tabName);
        }
        return;
      }

      case 'copy-code': {
        const copyTarget = target.getAttribute('data-copy-target');
        if (copyTarget) {
          e.preventDefault();
          copyA11yCode(copyTarget, target);
        }
        return;
      }
    }
  }
});

function copyA11yCode(elementId, btn) {
  const el = document.getElementById(elementId);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const targetBtn = btn || document.querySelector(`button[data-copy-target="${elementId}"]`);
    if (targetBtn) {
      const original = targetBtn.textContent;
      targetBtn.textContent = '✓ ' + t('reports.common.copied', 'Copied!');
      setTimeout(() => targetBtn.textContent = original, 2000);
    }
  });
}

function escapeHtmlA11y(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getA11yExternalTools(rec) {
  const title = (rec.title || '').toLowerCase();
  const tools = [];
  
  // Color contrast tools
  if (title.includes('contrast') || title.includes('color')) {
    tools.push({
      name: 'WebAIM Contrast Checker',
      url: 'https://webaim.org/resources/contrastchecker/',
      icon: '🎨'
    });
    tools.push({
      name: 'Coolors Contrast Checker',
      url: 'https://coolors.co/contrast-checker',
      icon: '🖌️'
    });
  }
  
  // Form labels / ARIA
  if (title.includes('label') || title.includes('form') || title.includes('aria')) {
    tools.push({
      name: 'WAVE Accessibility Checker',
      url: 'https://wave.webaim.org/',
      icon: '🌊'
    });
  }
  
  // Keyboard / Focus
  if (title.includes('focus') || title.includes('keyboard')) {
    tools.push({
      name: 'axe DevTools (Chrome)',
      url: 'https://chrome.google.com/webstore/detail/axe-devtools-web-accessibility/lhdoppojpmngadmnindnejefpokejbdd',
      icon: '🔧'
    });
  }
  
  // Heading structure
  if (title.includes('heading')) {
    tools.push({
      name: 'HeadingsMap Extension',
      url: 'https://chrome.google.com/webstore/detail/headingsmap/flbjommegcjonpdmenkdiocclhjacmbi',
      icon: '📑'
    });
    tools.push({
      name: 'WAVE Accessibility Checker',
      url: 'https://wave.webaim.org/',
      icon: '🌊'
    });
  }
  
  // Landmarks
  if (title.includes('landmark')) {
    tools.push({
      name: 'Landmark Navigation Extension',
      url: 'https://chrome.google.com/webstore/detail/landmark-navigation-via-k/ddpokpbjopmeeiiolheejjpkonlkklgp',
      icon: '🗺️'
    });
  }
  
  // Mobile accessibility
  if (title.includes('mobile')) {
    tools.push({
      name: 'Google Mobile-Friendly Test',
      url: 'https://search.google.com/test/mobile-friendly',
      icon: '📱'
    });
  }
  
  // Always include general tools for any accessibility issue
  if (tools.length === 0 || tools.length < 3) {
    if (!tools.find(t => t.name.includes('WAVE'))) {
      tools.push({
        name: 'WAVE Accessibility Checker',
        url: 'https://wave.webaim.org/',
        icon: '🌊'
      });
    }
    if (!tools.find(t => t.name.includes('axe'))) {
      tools.push({
        name: 'axe DevTools (Chrome)',
        url: 'https://chrome.google.com/webstore/detail/axe-devtools-web-accessibility/lhdoppojpmngadmnindnejefpokejbdd',
        icon: '🔧'
      });
    }
  }
  
  if (tools.length === 0) return '';

  const buttonStyle = `
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid rgba(0, 255, 65, 0.3);
    background: rgba(0, 255, 65, 0.1);
    color: #00ff41;
    text-decoration: none;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
  `.replace(/\n\s+/g, ' ').trim();

  return `
    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
      <h5 style="margin: 0 0 0.75rem 0; color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; font-weight: 500;">🔗 ${t('reports.common.externalTestingTools', 'External Testing Tools')}</h5>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        ${tools.map(tool => `
          <a href="${tool.url}" target="_blank" rel="noopener noreferrer" class="a11y-tool-link" style="${buttonStyle}">
            <span>${tool.icon}</span>
            <span>${tool.name}</span>
            <span style="opacity: 0.6;">↗</span>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

function getA11yProblemCode(rec, fullResults) {
  if (rec.problemCode) return rec.problemCode;
  
  const title = (rec.title || '').toLowerCase();
  const results = fullResults || window._a11yFullResults || {};
  
  // Color contrast - use real contrast issues from scan
  if (title.includes('contrast')) {
    const issues = results.contrast?.issues || [];
    if (issues.length > 0) {
      const examples = issues.slice(0, 3).map(issue => {
        const selector = issue.selector || 'element';
        const ratio = issue.ratio ? issue.ratio.toFixed(2) : '?';
        const fg = issue.color || '#unknown';
        const bg = issue.backgroundColor || '#unknown';
        return `/* ${selector} */\n/* Contrast ratio: ${ratio}:1 (needs 4.5:1) */\ncolor: ${fg};\nbackground: ${bg};`;
      }).join('\n\n');
      return `/* Found ${issues.length} low contrast elements */\n\n${examples}`;
    }
    return `/* Low contrast detected */\n.text-element {\n  color: var(--r-text-faint, #9CA3AF);      /* Too light */\n  background: #ccc; /* Not enough contrast */\n}`;
  }
  
  // Missing form labels - use real missing labels from scan
  if (title.includes('label') || title.includes('form')) {
    const labels = results.aria?.missingLabels || [];
    if (labels.length > 0) {
      const examples = labels.slice(0, 3).map(label => {
        const tag = label.tag || label.element || 'input';
        const type = label.type || 'text';
        const name = label.name || label.id || '';
        return `<${tag} type="${type}"${name ? ` name="${name}"` : ''}>`;
      }).join('\n');
      return `<!-- ${labels.length} form elements missing labels -->\n\n${examples}\n\n<!-- Screen readers cannot identify these inputs -->`;
    }
    return `<!-- Form inputs without accessible labels -->\n<input type="email" name="email">\n<input type="password" name="password">\n<select name="country">...</select>`;
  }
  
  // Missing focus indicators - use real data
  if (title.includes('focus')) {
    const missing = results.keyboard?.missingFocusIndicators || [];
    if (missing.length > 0) {
      const examples = missing.slice(0, 3).map(el => {
        const tag = el.tag || 'button';
        return `/* ${tag} has no focus style */\n${tag} { outline: none; }`;
      }).join('\n\n');
      return `/* ${missing.length} elements lack focus indicators */\n\n${examples}`;
    }
    return `/* Interactive elements hide focus */\nbutton, a, input {\n  outline: none; /* ✗ Hides keyboard focus */\n}\n\n/* or */\n*:focus {\n  outline: 0; /* ✗ Removes all focus indicators */\n}`;
  }
  
  // Heading structure
  if (title.includes('heading')) {
    const headingStatus = results.aria?.headingStructure || t('reports.common.unknown', 'Unknown');
    if (headingStatus === 'Missing H1') {
      return `<!-- Page is missing an h1 element -->\n<body>\n  <div class="header">Company Name</div>\n  <h2>Products</h2> <!-- First heading is h2 -->\n  <h3>Category</h3>\n</body>`;
    } else if (headingStatus === 'Skipped Levels') {
      return `<!-- Heading levels are skipped -->\n<h1>Page Title</h1>\n<h4>Subsection</h4> <!-- Skipped h2, h3 -->\n<h2>Another Section</h2>\n<h5>Details</h5> <!-- Skipped h3, h4 -->`;
    }
    return `<!-- Improper heading structure -->\n<div class="title">Page Title</div> <!-- Should be h1 -->\n<div class="subtitle">Section</div> <!-- Should be h2 -->`;
  }
  
  // ARIA landmarks
  if (title.includes('landmark')) {
    return `<!-- No semantic structure -->\n<body>\n  <div class="header">...</div>\n  <div class="nav">...</div>\n  <div class="content">...</div>\n  <div class="sidebar">...</div>\n  <div class="footer">...</div>\n</body>\n\n<!-- Screen readers cannot navigate between sections -->`;
  }
  
  // Mobile accessibility gap
  if (title.includes('mobile')) {
    const desktopScore = results.desktop?.accessibilityScore || '?';
    const mobileScore = results.mobile?.accessibilityScore || '?';
    return `/* Mobile accessibility is ${desktopScore - mobileScore} points lower */\n\n/* Common mobile issues: */\n\n/* Touch targets too small */\n.button {\n  padding: 4px 8px; /* < 44px */\n}\n\n/* Viewport not configured */\n<!-- Missing: <meta name="viewport" ...> -->`;
  }
  
  return `/* Issue: ${rec.title} */\n/* ${rec.description || t('reports.accessibility.currentImplementationNeedsImprovement', 'Current implementation needs improvement')} */`;
}

function getA11ySolutionCode(rec, fullResults) {
  if (rec.solutionCode) return rec.solutionCode;
  
  const title = (rec.title || '').toLowerCase();
  const results = fullResults || window._a11yFullResults || {};
  
  // Color contrast
  if (title.includes('contrast')) {
    return `/* WCAG AA compliant contrast (4.5:1 minimum) */

/* Option 1: Use high-contrast color pairs */
.text-element {
  color: #1a1a1a;      /* Dark text */
  background: #ffffff; /* Light background */
}

/* Option 2: CSS custom properties */
:root {
  --text-primary: #212121;
  --text-secondary: #424242;
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
}

/* Option 3: Check with tools */
/* Use: https://webaim.org/resources/contrastchecker/ */`;
  }
  
  // Missing form labels
  if (title.includes('label') || title.includes('form')) {
    const labels = results.aria?.missingLabels || [];
    const inputName = labels[0]?.name || 'email';
    return `<!-- Option 1: Explicit label association -->
<label for="${inputName}">${inputName.charAt(0).toUpperCase() + inputName.slice(1)}</label>
<input type="text" id="${inputName}" name="${inputName}">

<!-- Option 2: Wrapped label -->
<label>
  Email Address
  <input type="email" name="email">
</label>

<!-- Option 3: ARIA label (when visual label not possible) -->
<input type="search" aria-label="Search products" name="search">

<!-- Option 4: aria-labelledby -->
<span id="emailLabel">Email</span>
<input type="email" aria-labelledby="emailLabel">`;
  }
  
  // Missing focus indicators
  if (title.includes('focus')) {
    return `/* Visible focus indicators for all interactive elements */

/* Option 1: Simple outline */
:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* Option 2: Enhanced focus with fallback */
:focus-visible {
  outline: 3px solid #0066cc;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(0, 102, 204, 0.25);
}

/* Option 3: Custom per-element */
button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px #0066cc;
}

a:focus-visible {
  outline: 2px dashed currentColor;
  outline-offset: 4px;
}`;
  }
  
  // Heading structure
  if (title.includes('heading')) {
    return `<!-- Proper heading hierarchy -->
<body>
  <header>
    <h1>Site Name or Page Title</h1>
  </header>
  
  <main>
    <h2>Main Section</h2>
    <p>Content...</p>
    
    <h3>Subsection</h3>
    <p>More content...</p>
    
    <h2>Another Main Section</h2>
    <h3>Its Subsection</h3>
  </main>
</body>

<!-- Rules:
  - One h1 per page
  - Don't skip levels (h1 → h2 → h3)
  - Use headings for structure, not styling
-->`;
  }
  
  // ARIA landmarks
  if (title.includes('landmark')) {
    return `<!-- Semantic HTML5 structure -->
<body>
  <header role="banner">
    <nav role="navigation" aria-label="Main">
      <!-- Primary navigation -->
    </nav>
  </header>
  
  <main role="main">
    <article>
      <!-- Main content -->
    </article>
    
    <aside role="complementary">
      <!-- Related content -->
    </aside>
  </main>
  
  <footer role="contentinfo">
    <!-- Footer content -->
  </footer>
</body>

<!-- Screen readers can now navigate:
  - "Go to main content"
  - "Go to navigation"
  - "Go to footer"
-->`;
  }
  
  // Mobile accessibility
  if (title.includes('mobile')) {
    return `<!-- Viewport configuration -->
<meta name="viewport" content="width=device-width, initial-scale=1">

/* Minimum touch target size (44x44px) */
button, a, input, select {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px;
}

/* Adequate spacing between targets */
.button-group button {
  margin: 8px;
}

/* Responsive text sizing */
html {
  font-size: 16px; /* Minimum */
}

@media (max-width: 768px) {
  body {
    font-size: 1rem; /* Don't go smaller */
    line-height: 1.5;
  }
}`;
  }
  
  return `/* ${t('reports.common.fixFor', 'Fix for')}: ${rec.title} */\n\n${rec.solution || '/* ' + t('reports.accessibility.implementRecommendedFix', 'Implement the recommended accessibility improvement') + ' */'}`;
}

function getA11yFixSteps(rec, fullResults) {
  if (rec.steps && rec.steps.length) return rec.steps;
  
  const title = (rec.title || '').toLowerCase();
  const results = fullResults || window._a11yFullResults || {};
  
  // Color contrast
  if (title.includes('contrast')) {
    const count = results.contrast?.issuesCount || t('reports.common.multiple', 'multiple');
    return [
      t('reports.accessibility.steps.openDevTools', 'Open browser DevTools and navigate to the Elements panel'),
      t('reports.accessibility.steps.useAccessibilityPane', 'Use the Accessibility pane or '),
      t('reports.accessibility.steps.foundContrastIssues', 'Found {{count}} elements below 4.5:1 contrast ratio', {count}),
      t('reports.accessibility.steps.useWebAIM', 'Use WebAIM Contrast Checker to find compliant color alternatives'),
      t('reports.accessibility.steps.updateCSS', 'Update CSS with new color values that meet WCAG AA (4.5:1 for text)'),
      t('reports.accessibility.steps.testWithExtensions', 'Test with browser extensions like axe DevTools or WAVE')
    ];
  }

  // Form labels
  if (title.includes('label') || title.includes('form')) {
    const count = results.aria?.missingLabels?.length || t('reports.common.some', 'some');
    return [
      t('reports.accessibility.steps.identifyMissingLabels', 'Identify the {{count}} form inputs missing accessible labels', {count}),
      t('reports.accessibility.steps.addLabelElement', 'For each input, add a <label> element with matching for/id attributes'),
      t('reports.accessibility.steps.useAriaLabel', 'If visual labels aren\\'),
      t('reports.accessibility.steps.ensureLabelAssociation', 'Ensure labels are programmatically associated (not just visually positioned)'),
      t('reports.accessibility.steps.testScreenReaderLabels', 'Test with a screen reader: input purpose should be announced')
    ];
  }

  // Focus indicators
  if (title.includes('focus')) {
    const count = results.keyboard?.missingFocusIndicators?.length || t('reports.common.multiple', 'multiple');
    return [
      t('reports.accessibility.steps.foundFocusIssues', 'Found {{count}} interactive elements without visible focus', {count}),
      t('reports.accessibility.steps.removeCSSOutlines', 'Remove any CSS that hides outlines (outline: none, outline: 0)'),
      t('reports.accessibility.steps.addFocusVisible', 'Add :focus-visible styles for keyboard users'),
      t('reports.accessibility.steps.ensureFocusContrast', 'Ensure focus indicator has minimum 3:1 contrast ratio'),
      t('reports.accessibility.steps.testTabbing', 'Test by tabbing through page - focus should always be visible'),
      t('reports.accessibility.steps.considerKeyboardMouse', 'Consider users with both keyboard and mouse (use :focus-visible)')
    ];
  }

  // Heading structure
  if (title.includes('heading')) {
    return [
      t('reports.accessibility.steps.runHeadingCheck', 'Run a heading outline check (browser extensions or DevTools)'),
      t('reports.accessibility.steps.ensureOneH1', 'Ensure page has exactly one <h1> element'),
      t('reports.accessibility.steps.verifyHeadingOrder', 'Verify headings follow sequential order (h1 → h2 → h3)'),
      t('reports.accessibility.steps.dontSkipLevels', 'Don\\'),
      t('reports.accessibility.steps.useHeadingsForStructure', 'Use headings for document structure, not for styling'),
      t('reports.accessibility.steps.testHeadingsList', 'Test with screen reader ')
    ];
  }

  // ARIA landmarks
  if (title.includes('landmark')) {
    return [
      t('reports.accessibility.steps.replaceGenericDivs', 'Replace generic <div> elements with semantic HTML5 elements'),
      t('reports.accessibility.steps.useSemanticElements', 'Use <header>, <nav>, <main>, <aside>, <footer>'),
      t('reports.accessibility.steps.addRoleAttributes', 'Add role attributes for older browser support if needed'),
      t('reports.accessibility.steps.useAriaLabelNav', 'Use aria-label to differentiate multiple nav elements'),
      t('reports.accessibility.steps.testLandmarkNav', 'Test with screen reader landmark navigation (NVDA: D key, JAWS: R key)'),
      t('reports.accessibility.steps.verifyLandmarks', 'Verify all major page sections have appropriate landmarks')
    ];
  }

  // Mobile accessibility
  if (title.includes('mobile')) {
    return [
      t('reports.accessibility.steps.addViewportMeta', 'Add proper viewport meta tag to <head>'),
      t('reports.accessibility.steps.auditTouchTargets', 'Audit all interactive elements for 44x44px minimum touch target'),
      t('reports.accessibility.steps.increasePadding', 'Increase padding on buttons and links for touch'),
      t('reports.accessibility.steps.ensureSpacing', 'Ensure adequate spacing between clickable elements (8px minimum)'),
      t('reports.accessibility.steps.testMobileScreenReader', 'Test with mobile screen reader (VoiceOver, TalkBack)'),
      t('reports.accessibility.steps.verifyTextReadable', 'Verify text is readable without zooming (16px minimum)')
    ];
  }

  return [
    t('reports.accessibility.steps.reviewWCAG', 'Review the specific WCAG criterion: {{criterion}}', {criterion: rec.wcagReference || t('reports.accessibility.relevantGuideline', 'relevant guideline')}),
    t('reports.accessibility.steps.identifyAffected', 'Identify all affected elements on the page'),
    t('reports.accessibility.steps.implementFix', 'Implement the recommended code fix'),
    t('reports.accessibility.steps.testAssistiveTech', 'Test with assistive technology (screen reader, keyboard-only)'),
    t('reports.accessibility.steps.validateTools', 'Validate with automated tools (axe, WAVE, Lighthouse)')
  ];
}

function ensureA11yFixStyles() {
  if (document.getElementById('a11y-fix-styles')) return;
  const style = document.createElement('style');
  style.id = 'a11y-fix-styles';
  style.textContent = `
    .a11y-fix-accordion {
      transition: all 0.2s ease;
    }
    .a11y-fix-accordion:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .a11y-fix-header:hover {
      background: rgba(255,255,255,0.03);
    }
    .a11y-fix-tab {
      transition: all 0.2s ease;
    }
    .a11y-fix-tab:hover:not(.active) {
      background: rgba(255,255,255,0.05) !important;
      color: var(--r-text-muted, #6B7280) !important;
    }
    .a11y-tool-link {
      transition: all 0.2s ease;
    }
    .a11y-tool-link:hover {
      background: rgba(0,255,65,0.2) !important;
      border-color: rgba(0,255,65,0.5) !important;
    }
  `;
  document.head.appendChild(style);
}

// -------- Monetization actions (gated) --------
function ensureAccessibilityProAccess() {
  const reportId = document.body?.getAttribute('data-report-id') || '';
  // Check single report purchase via ProReportBlock (includes Pro, Day Pass, and purchased reports)
  if (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function') {
    if (window.ProReportBlock.hasAccess(reportId)) return true;
  }
  const domain = getCurrentDomain();
  if (window.ProAccess && typeof window.ProAccess.hasProAccess === 'function') {
    if (window.ProAccess.hasProAccess(domain)) return true;
  }
  if (window.ExportGate && window.ExportGate.isPro()) {
    return true;
  }
  safeOpenProPaywall({ domain, context: 'accessibility' });
  return false;
}

async function exportAccessibilityPDF() {
  // Access check is handled by exportReportPDF() → checkExportAccess() which does
  // both local and async server-verified checks. No sync gate needed here.
  const results = window.currentAccessibilityResults;
  if (!results) {
    alert(t('reports.common.noResultsToExport', 'No scan results to export. Run a scan first.'));
    return;
  }

  // Use unified PDF export function (server-side Puppeteer)
  if (typeof window.exportReportPDF === 'function') {
    const button = document.querySelector('[data-export="pdf"]') ||
                   document.querySelector('button[onclick*="exportAccessibilityPDF"]');
    await window.exportReportPDF({
      reportType: 'accessibility',
      buttonElement: button
    });
  } else {
    console.error('PDF export utility not loaded');
    alert(t('reports.common.pdfNotAvailable', 'PDF export is not available. Please refresh the page.'));
  }
}

function copyAccessibilityShareLink() {
  if (!ensureAccessibilityProAccess()) return;
  const targetUrl = window.currentAccessibilityResults?.url || window.location.href;
  const shareUrl = `${window.location.origin}/accessibility-analyzer.html?url=${encodeURIComponent(targetUrl)}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    alert(t('reports.common.shareLinkCopied', 'Share link copied to clipboard!'));
  });
}

function downloadAccessibilityCSV() {
  if (!ensureAccessibilityProAccess()) return;
  const r = window.currentAccessibilityResults;
  if (!r) return;

  const rows = [
    [t('reports.common.metric', 'Metric'), t('reports.common.value', 'Value')],
    [t('reports.common.overallScore', 'Overall Score'), r.accessibilityScore ?? ''],
    [t('reports.accessibility.wcagLevel', 'WCAG Level'), r.wcagLevel || ''],
    [t('reports.accessibility.violationsFound', 'Violations Found'), r.violationsCount ?? 0],
    [t('reports.accessibility.contrastIssues', 'Contrast Issues'), r.contrastIssues ?? r.contrast?.issues?.length ?? 0],
    [t('reports.accessibility.keyboardIssues', 'Keyboard Issues'), r.keyboard?.issues?.length ?? 0],
    [t('reports.accessibility.ariaIssues', 'ARIA Issues'), r.aria?.issues?.length ?? 0],
    [t('reports.common.recommendations', 'Recommendations'), countAccessibilityRecommendations(r)],
    [t('reports.accessibility.checksPassed', 'Checks Passed'), countAccessibilityPassedChecks(r)],
    [t('reports.common.url', 'URL'), r.url || '']
  ];

  const csv = rows
    .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'accessibility-report.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Expose Pro export actions globally for inline handlers
window.exportAccessibilityPDF = exportAccessibilityPDF;
window.copyAccessibilityShareLink = copyAccessibilityShareLink;
window.downloadAccessibilityCSV = downloadAccessibilityCSV;

// Expose display function globally for billing return handler
window.displayAccessibilityResults = displayAccessibilityResults;

function countAccessibilityIssues(results) {
  if (!results) return 0;
  const totals = [
    results.violationsCount || 0,
    results.contrastIssues || 0,
    results.contrast?.issues?.length || 0,
    results.keyboard?.issues?.length || 0,
    results.aria?.issues?.length || 0
  ];
  return totals.reduce((sum, val) => sum + val, 0);
}

function countAccessibilityRecommendations(results) {
  return results?.recommendations?.length || 0;
}

function countAccessibilityPassedChecks(results) {
  if (!results) return 0;
  if (typeof results.bestPracticesCount === 'number') return results.bestPracticesCount;
  if (typeof results.passedChecks === 'number') return results.passedChecks;
  return 0;
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.textContent = `>>> ${t('reports.common.error', 'Error: {{message}}')}: ${message}`;
  errorMessage.classList.remove('hidden');
  results.classList.add('hidden');
}

/**
 * Get accessibility color based on score - Traditional traffic light system
 */
function getAccessibilityColor(score) {
  if (score >= 90) return '#00ff41';  // A: Bright green
  if (score >= 70) return '#ffd700';  // B: Yellow (gold)
  if (score >= 50) return '#ff8c00';  // C: Dark orange
  return '#ff4444';                   // D/F: Red
}

/**
 * Get accessibility grade
 */
function getAccessibilityGrade(score) {
  if (score >= 90) return t('reports.accessibility.excellent', 'Excellent');
  if (score >= 70) return t('reports.accessibility.good', 'Good');
  if (score >= 50) return t('reports.accessibility.fair', 'Fair');
  return t('reports.accessibility.poor', 'Poor');
}

/**
 * Get WCAG level color
 */
function getWCAGLevelColor(level) {
  switch(level) {
    case 'AAA': return '#00d9ff';  // Cyan (highest accessibility)
    case 'AA':  return '#00ff41';  // Green (industry standard)
    case 'A':   return '#ffd700';  // Yellow (minimum)
    default:    return '#ff4444';  // Red (non-compliant)
  }
}

/**
 * Get WCAG level description
 */
function getWCAGLevelDescription(level) {
  switch(level) {
    case 'AAA':
      return t('reports.accessibility.wcagAAADesc', 'Highest Accessibility - Provides the best possible experience for all users, including those with severe disabilities.');
    case 'AA':
      return t('reports.accessibility.wcagAADesc', 'Industry Standard - Meets legal requirements (ADA, Section 508) and ensures content is accessible to most users with disabilities.');
    case 'A':
      return t('reports.accessibility.wcagADesc', 'Minimum Accessibility - Removes the most critical barriers but considered barely accessible.');
    default:
      return t('reports.accessibility.wcagNonCompliant', 'Non-Compliant - Does not meet WCAG standards.');
  }
}

// PDF purchase modal removed - monetization disabled

/**
 * Export Accessibility results as CSV
 */
window.exportAccessibilityCSV = function() {
  const results = window.currentAccessibilityResults;
  if (!results) {
    alert(t('reports.common.noResultsToExport', 'No scan results to export. Run a scan first.'));
    return;
  }

  const rows = [];
  // Header
  rows.push([t('reports.common.category', 'Category'), t('reports.common.item', 'item'), t('reports.common.value', 'Value'), t('reports.common.status', 'Status'), t('reports.accessibility.score', 'Score')]);

  // Overall Score
  rows.push([t('reports.common.overall', 'Overall'), t('reports.accessibility.accessibilityScore', 'Accessibility Score'), '', results.accessibilityScore >= 90 ? t('reports.accessibility.excellent', 'Excellent') : results.accessibilityScore >= 70 ? t('reports.accessibility.good', 'Good') : results.accessibilityScore >= 50 ? t('reports.accessibility.fair', 'Fair') : t('reports.accessibility.poor', 'Poor'), results.accessibilityScore || '']);
  rows.push([t('reports.common.overall', 'Overall'), t('reports.accessibility.wcagLevel', 'WCAG Level'), results.wcagLevel || t('reports.accessibility.notCompliant', 'Not Compliant'), '', '']);

  // Violations
  rows.push([t('reports.accessibility.violations', 'Violations'), t('reports.accessibility.totalViolations', 'Total Violations'), String(results.violationsCount || 0), results.violationsCount === 0 ? t('reports.accessibility.good', 'Good') : t('reports.common.issue', 'issue'), '']);

  // Contrast Issues
  const contrastIssues = results.contrastIssues ?? results.contrast?.issues?.length ?? 0;
  rows.push([t('reports.accessibility.contrast', 'Contrast'), t('reports.accessibility.contrastIssues', 'Contrast Issues'), String(contrastIssues), contrastIssues === 0 ? t('reports.accessibility.good', 'Good') : t('reports.common.issue', 'issue'), results.contrast?.score || '']);

  // Keyboard Accessibility
  const keyboardIssues = results.keyboard?.issues?.length ?? 0;
  rows.push([t('reports.accessibility.keyboard', 'Keyboard'), t('reports.accessibility.keyboardIssues', 'Keyboard Issues'), String(keyboardIssues), keyboardIssues === 0 ? t('reports.accessibility.good', 'Good') : t('reports.common.issue', 'issue'), results.keyboard?.score || '']);

  // ARIA
  const ariaIssues = results.aria?.issues?.length ?? 0;
  rows.push([t('reports.accessibility.aria', 'ARIA'), t('reports.accessibility.ariaIssues', 'ARIA Issues'), String(ariaIssues), ariaIssues === 0 ? t('reports.accessibility.good', 'Good') : t('reports.common.issue', 'issue'), results.aria?.score || '']);

  // Recommendations
  const recommendationsCount = results.recommendations?.length || 0;
  rows.push([t('reports.common.recommendations', 'Recommendations'), t('reports.accessibility.totalRecommendations', 'Total Recommendations'), String(recommendationsCount), '', '']);

  // Passed Checks
  const passedChecks = results.bestPracticesCount || results.passedChecks || 0;
  rows.push([t('reports.accessibility.bestPractices', 'Best Practices'), t('reports.accessibility.passedChecks', 'Passed Checks'), String(passedChecks), '', '']);

  // URL
  rows.push([t('reports.common.info', 'Info'), t('reports.common.scannedUrl', 'Scanned URL'), results.url || '', '', '']);

  // Convert to CSV string
  const csvContent = rows.map(row =>
    row.map(cell => {
      const cellStr = String(cell || '');
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return '"' + cellStr.replace(/"/g, '""') + '"';
      }
      return cellStr;
    }).join(',')
  ).join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const filename = `accessibility-report-${results.url ? new URL(results.url).hostname : 'site'}-${new Date().toISOString().split('T')[0]}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
