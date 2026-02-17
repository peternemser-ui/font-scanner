/**
 * Core Web Vitals Analyzer Frontend
 * Displays Google's ranking factors with actionable insights
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'core-web-vitals';
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

/**
 * Translate CWV rating labels (good, needs-improvement, poor)
 */
function translateCwvRating(rating) {
  const ratingMap = {
    'good': 'reports.cwv.ratings.good',
    'needs-improvement': 'reports.cwv.ratings.needsImprovement',
    'poor': 'reports.cwv.ratings.poor',
    'unknown': 'reports.cwv.ratings.unknown'
  };
  const key = ratingMap[rating];
  const fallback = rating.toUpperCase().replace('-', ' ');
  if (key) {
    return t(key, fallback);
  }
  return fallback;
}

/**
 * Translate CWV metric description from server
 */
function translateCwvMetricDescription(description) {
  const descMap = {
    'Time until the largest text or image is painted': 'reports.cwv.metricDescriptions.lcp',
    'Responsiveness to user interactions': 'reports.cwv.metricDescriptions.inp',
    'Total time the main thread was blocked': 'reports.cwv.metricDescriptions.tbt',
    'Visual stability - unexpected layout shifts': 'reports.cwv.metricDescriptions.cls',
    'Time until first text/image appears': 'reports.cwv.metricDescriptions.fcp',
    'How quickly content is visually displayed': 'reports.cwv.metricDescriptions.si',
    'Time until page is fully interactive': 'reports.cwv.metricDescriptions.tti',
    'Metric information': 'reports.cwv.metricDescriptions.default'
  };
  const key = descMap[description];
  if (key) {
    return t(key, description);
  }
  return description;
}

// Function to get analysis steps with current translations
// Called at runtime to ensure i18n is loaded
function getAnalysisSteps() {
  return [
    {
      label: t('loader.initializingCwv', 'Initializing CWV analysis'),
      detail: t('loader.startingPerformanceMonitor', 'Starting browser performance monitor...')
    },
    {
      label: t('loader.measuringLcp', 'Measuring LCP'),
      detail: t('loader.trackingLcp', 'Tracking largest contentful paint...')
    },
    {
      label: t('loader.measuringFid', 'Measuring FID/INP'),
      detail: t('loader.testingInput', 'Testing input responsiveness...')
    },
    {
      label: t('loader.measuringCls', 'Measuring CLS'),
      detail: t('loader.detectingShifts', 'Detecting layout shifts...')
    },
    {
      label: t('loader.calculatingScores', 'Calculating scores'),
      detail: t('loader.comparingThresholds', 'Comparing against Google thresholds...')
    }
  ];
}

const urlInput = document.getElementById('cwvUrlInput');
const analyzeButton = document.getElementById('cwvAnalyzeButton');
const resultsContainer = document.getElementById('cwvResults');

// Handle Enter key
urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    analyzeButton.click();
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
  const autoUrl = params.get('url') || '';
  const autoScan = params.get('auto_scan') === 'true';
  const billingSuccess = params.get('billing_success') === 'true';

  // If we have a report_id, set it immediately so hasAccess checks work
  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    console.log('[CWV] Set report ID from URL:', reportId);
  }

  // If returning from billing, wait for billing return processing to complete
  if (billingSuccess && !window.__smBillingReturnComplete) {
    console.log('[CWV] Waiting for billing return processing...');

    // CRITICAL: Clear fresh scan flag - user paid for this report
    console.log('[CWV] Billing return detected - clearing fresh scan flag');
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
    console.log('[CWV] Billing return processing complete');
    return;
  }

  // If we have a report_id, try to load the stored report first
  if (reportId && window.ReportStorage) {
    console.log('[CWV] Checking for stored report:', reportId);

    // CRITICAL: Fetch billing status BEFORE displaying the report
    // Force refresh to ensure we have the latest purchase data (e.g., coming from dashboard)
    if (window.ProReportBlock?.fetchBillingStatus) {
      console.log('[CWV] Fetching billing status (force refresh for report recall)...');
      await window.ProReportBlock.fetchBillingStatus(true);
      console.log('[CWV] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportId), 'for reportId:', reportId);
    }

    const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displayResults);
    if (loaded) {
      // Stored report was loaded - fill URL input for context
      if (autoUrl && urlInput) urlInput.value = autoUrl;
      return; // Don't auto-scan
    }
  }

  // No stored report found - pre-fill URL but only auto-scan if explicitly requested
  if (autoUrl && urlInput) {
    urlInput.value = autoUrl;
  }
  // Only auto-scan if explicitly requested with auto_scan=true
  if (autoScan) {
    setTimeout(() => {
      analyzeButton.click();
    }, 500);
  }
})();

// Listen for restore scan results event (after payment return)
window.addEventListener('sm:restoreScanResults', (e) => {
  const { results: restoredResults, url, analyzer } = e.detail || {};
  if (restoredResults && (analyzer?.includes('cwv') || analyzer?.includes('core-web-vitals'))) {
    console.log('[CWV] Restoring scan results after payment');
    if (url && urlInput) {
      urlInput.value = url;
    }
    displayResults(restoredResults);
  }
});

// Store pending URL for resuming after payment
const pendingCWVAnalysisUrl = null;

/**
 * Check if user can run a CWV report (has subscription OR purchased this report)
 * @returns {Promise<boolean>}
 */
async function checkCanRunCWVReport() {
  // CRITICAL: Check for post-payment bypass flag first
  // This allows the scan to run immediately after payment without waiting for billing sync
  if (window.__cwvPaymentBypass) {
    console.log('[CWV] Payment bypass flag detected - allowing access');
    delete window.__cwvPaymentBypass; // Clear the flag after use
    return true;
  }

  // Ensure billing status is fetched
  if (window.ProReportBlock?.fetchBillingStatus) {
    await window.ProReportBlock.fetchBillingStatus();
  }

  // Check if user is a Pro subscriber (any subscription tier)
  if (window.ProReportBlock?.isProSubscriber?.()) {
    console.log('[CWV] User is Pro subscriber, allowing access');
    return true;
  }

  // Check if CWV report type has been purchased
  const reportId = document.body.getAttribute('data-report-id') || '';
  if (reportId && window.ProReportBlock?.isReportPurchased?.(reportId)) {
    console.log('[CWV] Report is purchased, allowing access:', reportId);
    return true;
  }

  // Check for recent payment verification (set after returning from Stripe)
  const params = new URLSearchParams(window.location.search);
  const url = params.get('url') || '';
  if (url) {
    // Use normalized URL + hash for consistent key matching
    const normalizedUrl = window.ReportUI?.normalizeUrlForReportId?.(url) || url;
    const urlHash = window.ReportUI?.hashForStorageKey?.(normalizedUrl) || normalizedUrl.replace(/[^a-z0-9]/gi, '').slice(0, 16);
    const verificationKey = `sm_payment_verified_cwv_${urlHash}`;
    const verificationTime = localStorage.getItem(verificationKey);
    if (verificationTime) {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      if (parseInt(verificationTime, 10) > oneHourAgo) {
        console.log('[CWV] Recent payment verification found for this URL');
        return true;
      }
    }
    // Also check legacy key format for backwards compatibility
    const legacyVerificationKey = 'sm_payment_verified_' + url;
    const legacyVerificationTime = localStorage.getItem(legacyVerificationKey);
    if (legacyVerificationTime) {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      if (parseInt(legacyVerificationTime, 10) > oneHourAgo) {
        console.log('[CWV] Recent payment verification found for this URL (legacy key)');
        return true;
      }
    }
  }

  // Also check localStorage for CWV purchases (with URL-specific key)
  if (url) {
    const normalizedUrl = window.ReportUI?.normalizeUrlForReportId?.(url) || url;
    const urlHash = window.ReportUI?.hashForStorageKey?.(normalizedUrl) || normalizedUrl.replace(/[^a-z0-9]/gi, '').slice(0, 16);
    const purchaseKey = `sm_report_purchased_cwv_${urlHash}`;
    const purchaseTimestamp = localStorage.getItem(purchaseKey);
    if (purchaseTimestamp) {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      if (parseInt(purchaseTimestamp, 10) > oneHourAgo) {
        console.log('[CWV] Recent purchase found for CWV + URL');
        return true;
      }
    }
  }
  // Fallback to legacy key (no URL)
  const legacyPurchaseKey = 'sm_report_purchased_cwv';
  const legacyPurchaseTimestamp = localStorage.getItem(legacyPurchaseKey);
  if (legacyPurchaseTimestamp) {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    if (parseInt(legacyPurchaseTimestamp, 10) > oneHourAgo) {
      console.log('[CWV] Recent purchase found for CWV (legacy key)');
      return true;
    }
  }

  console.log('[CWV] No access found for CWV report');
  return false;
}

/**
 * Show payment gate modal for CWV
 */
function showCWVPaymentGate(url) {
  const modalHTML = `
    <div id="cwvPaymentGateModal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--modal-backdrop, rgba(0, 0, 0, 0.85));
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(8px);
    ">
      <div style="
        background: var(--bg-card);
        border: 2px solid var(--color-success, #10b981);
        border-radius: 12px;
        padding: 2.5rem;
        max-width: 500px;
        width: 90%;
        box-shadow: var(--shadow-2xl);
        animation: cwvSlideIn 0.3s ease-out;
      ">
        <div style="text-align: center; margin-bottom: 2rem;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">📊</div>
          <h2 style="color: var(--color-success, #10b981); margin: 0 0 0.5rem 0; font-size: 1.75rem;">Core Web Vitals Report</h2>
          <p style="color: var(--color-text-secondary, #6b7280); margin: 0; font-size: 1rem;">Get detailed CWV analysis including LCP, INP, and CLS metrics for mobile and desktop.</p>
        </div>

        <div style="background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
          <h3 style="color: var(--color-text, #fff); margin: 0 0 1rem 0; font-size: 1.1rem;">What's included:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="color: var(--color-text-secondary, #6b7280); margin-bottom: 0.75rem; padding-left: 1.5rem; position: relative;">
              <span style="position: absolute; left: 0; color: var(--color-success, #10b981);">✓</span>
              Mobile & Desktop CWV metrics
            </li>
            <li style="color: var(--color-text-secondary, #6b7280); margin-bottom: 0.75rem; padding-left: 1.5rem; position: relative;">
              <span style="position: absolute; left: 0; color: var(--color-success, #10b981);">✓</span>
              Google ranking impact analysis
            </li>
            <li style="color: var(--color-text-secondary, #6b7280); margin-bottom: 0.75rem; padding-left: 1.5rem; position: relative;">
              <span style="position: absolute; left: 0; color: var(--color-success, #10b981);">✓</span>
              Detailed metric breakdowns
            </li>
            <li style="color: var(--color-text-secondary, #6b7280); margin-bottom: 0.75rem; padding-left: 1.5rem; position: relative;">
              <span style="position: absolute; left: 0; color: var(--color-success, #10b981);">✓</span>
              Actionable recommendations
            </li>
          </ul>
        </div>

        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1rem;">
            <div style="flex: 1; background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--color-success, #10b981);">$5</div>
              <div style="color: var(--color-text-muted, #6b7280); font-size: 0.75rem;">This report only</div>
            </div>
            <div style="flex: 1; background: var(--color-primary-dim); border: 1px solid var(--color-primary); border-radius: 8px; padding: 1rem;">
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--color-primary);">$30/mo</div>
              <div style="color: var(--color-text-muted, #6b7280); font-size: 0.75rem;">All reports</div>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button id="cwvProceedPaymentBtn" style="
            background: var(--color-success, #10b981);
            border: none;
            color: var(--r-text, #111827);
            padding: 0.875rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 700;
            font-size: 1rem;
          ">
            ${t('reports.common.unlockFor5', 'Unlock for $5')}
          </button>
          <button id="cwvGoProBtn" style="
            background: transparent;
            border: 2px solid var(--color-primary);
            color: var(--color-primary);
            padding: 0.875rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 1rem;
          ">
            ${t('reports.common.goPro30', 'Go Pro — $30/mo')}
          </button>
          <button id="cwvCancelPaymentBtn" style="
            background: transparent;
            border: none;
            color: var(--color-text-muted, #6b7280);
            padding: 0.5rem;
            cursor: pointer;
            font-size: 0.875rem;
          ">
            ${t('nav.cancel', 'Cancel')}
          </button>
        </div>

        <div style="text-align: center; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
          <div style="color: var(--color-text-muted, #6b7280); font-size: 0.8rem; margin-bottom: 0.5rem;">
            🔒 ${t('reports.common.securePayments', 'Secure payments by Stripe')}
          </div>
          <div style="color: var(--color-text-muted, #6b7280); font-size: 0.75rem;">
            ${t('reports.common.proUnlocksAll', 'Pro unlocks all reports. Single purchase unlocks only this scan.')}
          </div>
        </div>
      </div>
    </div>

    <style>
      @keyframes cwvSlideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    </style>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  document.getElementById('cwvCancelPaymentBtn').addEventListener('click', () => {
    document.getElementById('cwvPaymentGateModal').remove();
    analyzeButton.disabled = false;
    analyzeButton.textContent = t('common.analyzeCwv', 'ANALYZE CWV');
  });

  document.getElementById('cwvProceedPaymentBtn').addEventListener('click', () => {
    createCWVPaymentSession(url);
  });

  document.getElementById('cwvGoProBtn').addEventListener('click', () => {
    document.getElementById('cwvPaymentGateModal').remove();
    if (window.PricingModal && typeof window.PricingModal.open === 'function') {
      window.PricingModal.open();
    }
  });
}

/**
 * Create Stripe checkout session for CWV report
 */
async function createCWVPaymentSession(url) {
  const proceedBtn = document.getElementById('cwvProceedPaymentBtn');
  proceedBtn.disabled = true;
  proceedBtn.textContent = t('common.creatingCheckout', 'Creating checkout...');

  try {
    const startedAt = document.body.getAttribute('data-sm-scan-started-at') || window.SM_SCAN_STARTED_AT || '';
    const analyzerKey = 'core-web-vitals';
    const reportId = document.body.getAttribute('data-report-id') ||
      (window.ReportUI && typeof window.ReportUI.makeReportId === 'function'
        ? window.ReportUI.makeReportId({ analyzerKey, normalizedUrl: url, startedAtISO: startedAt })
        : '');

    const params = new URLSearchParams(window.location.search);
    params.delete('session_id');
    params.delete('sessionId');
    params.delete('canceled');
    if (reportId) params.set('reportId', reportId);
    params.set('url', url);
    params.set('report_type', 'cwv');
    params.set('auto_scan', 'true');
    const returnUrl = `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;

    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;  // Include token for tracking even on public endpoint
    }

    // Use authenticated billing endpoint ONLY if logged in AND have reportId
    // Otherwise use public payment endpoint (no reportId required)
    const useAuthEndpoint = token && reportId;
    const endpoint = useAuthEndpoint ? '/api/billing/checkout' : '/api/payment/create-report-payment';
    const payload = useAuthEndpoint ? {
      purchaseType: 'single_report',
      reportId: reportId,
      returnUrl
    } : {
      reportType: 'cwv',
      url: url,
      returnUrl
    };

    console.log('[CWV Payment] Request:', { endpoint, payload, hasToken: !!token, reportId, useAuthEndpoint });
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('[CWV Payment] Response:', { status: response.status, data });
    console.log('[CWV Payment] Full response data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      const errorMsg = data?.error || data?.message || JSON.stringify(data) || 'Failed to create payment session';
      console.error('[CWV Payment] Error:', errorMsg);
      console.error('[CWV Payment] Full error object:', data);
      throw new Error(errorMsg);
    }

    if (!data.checkoutUrl && !data.url) {
      console.error('[CWV Payment] No checkout URL in response:', data);
      throw new Error('Payment session created but no checkout URL received');
    }

    window.location.href = data.checkoutUrl || data.url;

  } catch (error) {
    console.error('[CWV Payment] Exception:', error);
    proceedBtn.disabled = false;
    proceedBtn.textContent = t('reports.common.unlockFor5', 'Unlock for $5');
    alert(t('reports.common.paymentError', 'Payment error: {{message}}', { message: error.message }));
  }
}

// Check URL params for billing return and mark purchase
(async function handleCWVBillingReturn() {
  const params = new URLSearchParams(window.location.search);
  const billingSuccess = params.get('billing_success') === 'true';
  const paymentSuccess = params.get('payment') === 'success';
  const sessionId = params.get('session_id') || params.get('sessionId');
  const reportType = params.get('report_type') || params.get('type');
  const autoScan = params.get('auto_scan') === 'true';
  const url = params.get('url');

  if ((billingSuccess || paymentSuccess || sessionId) && (reportType === 'cwv' || reportType === 'core-web-vitals')) {
    console.log('[CWV] Payment successful - setting up bypass and auto-scan');

    // CRITICAL: Clear fresh scan flag - user paid for this report
    console.log('[CWV] Payment detected - clearing fresh scan flag');
    window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;

    // Set a SESSION flag to bypass payment check for this scan
    // This is critical - it allows the immediate scan to proceed
    window.__cwvPaymentBypass = true;
    
    // Mark as purchased with extended cache (1 hour to allow scan to complete)
    // Use URL-specific keys to prevent cache collision between different URLs
    const normalizedUrl = window.ReportUI?.normalizeUrlForReportId?.(url) || url;
    const urlHash = window.ReportUI?.hashForStorageKey?.(normalizedUrl) || (url || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
    localStorage.setItem(`sm_report_purchased_cwv_${urlHash}`, Date.now().toString());
    localStorage.setItem(`sm_payment_verified_cwv_${urlHash}`, Date.now().toString());
    // Also set legacy keys for backwards compatibility
    localStorage.setItem('sm_report_purchased_cwv', Date.now().toString());
    localStorage.setItem('sm_payment_verified_' + (url || ''), Date.now().toString());
    
    // Force clear and refresh billing cache
    if (window.ProReportBlock?.clearBillingCache) {
      console.log('[CWV] Clearing billing cache');
      window.ProReportBlock.clearBillingCache();
    }
    
    // Wait for ProReportBlock to be initialized and fetch billing status
    if (window.ProReportBlock?.fetchBillingStatus) {
      console.log('[CWV] Force fetching billing status after payment');
      await window.ProReportBlock.fetchBillingStatus(true); // Force refresh
    }

    // If auto_scan is requested and we have a URL, trigger the scan
    if (autoScan && url && urlInput && analyzeButton) {
      console.log('[CWV] Auto-triggering scan after payment for:', url);
      urlInput.value = url;
      
      // Wait a bit longer to ensure all systems are ready
      setTimeout(() => {
        console.log('[CWV] Clicking analyze button now');
        analyzeButton.click();
      }, 1000);
    }
  }
})();

analyzeButton.addEventListener('click', async () => {
  const url = urlInput.value.trim();

  if (!url) {
    alert(t('reports.common.pleaseEnterUrl', 'Please enter a valid URL'));
    return;
  }

  // NOTE: Payment gate removed - all scans are FREE to run
  // Pro sections are locked in the results, not before the scan
  // This matches the UX of other analyzers (SEO, Accessibility, etc.)
  console.log('[CWV] Running scan (all scans are free)');

  // CRITICAL: Mark this as a FRESH SCAN that requires payment
  // VERSION: 20260201h - This flag ensures new scans are LOCKED until paid
  console.log('[CWV] NEW SCAN v20260201h: Marking as fresh unpaid scan');
  window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = true;
  window.__SM_CURRENT_SCAN_URL__ = url;

  // Clear any stale billing cache and session markers from previous scans
  if (window.ProReportBlock?.clearBillingCache) {
    window.ProReportBlock.clearBillingCache();
  }
  sessionStorage.removeItem('sm_payment_completed_session');
  sessionStorage.removeItem('sm_purchased_report_id');

  analyzeButton.disabled = true;
  analyzeButton.textContent = t('common.analyzing', 'Analyzing...').toUpperCase();
  resultsContainer.style.display = 'none';

  // Create loading container if it doesn't exist
  let loadingContainer = document.getElementById('loadingContainer');
  if (!loadingContainer) {
    loadingContainer = document.createElement('div');
    loadingContainer.id = 'loadingContainer';
    resultsContainer.parentNode.insertBefore(loadingContainer, resultsContainer);
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
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
    </div>
    <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem; color: var(--accent-primary); font-weight: 600; letter-spacing: 0.05em;">
      Measuring core web vitals...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: 0.8rem; color: rgba(var(--accent-primary-rgb), 0.7);">
      This may take 30-60 seconds
    </p>
  `;

  // Add color cycling style
  const style = document.createElement('style');
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
  
  // Use getAnalysisSteps() to get translated steps at runtime
  loader.start(getAnalysisSteps(), '📊 ' + t('loader.analyzingCwv', 'CORE WEB VITALS ANALYZER'), 15);
  
  // Insert ASCII art after loader starts
  const analyzerLoading = loadingContainer.querySelector('.analyzer-loading');
  if (analyzerLoading) {
    analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
  }

  try {
    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/core-web-vitals', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, scanStartedAt, lang: window.i18n?.getActiveLocale?.() || document.documentElement.lang || 'en', ...(window.__cwvPaymentBypass && { billingRescan: true }) }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.code === 'SCAN_QUOTA_EXCEEDED') {
          const limit = errorData.scansLimit || 10;
          loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
          return;
        }
        errorMessage = errorData.message || errorData.error || errorMessage;
        console.error('[CWV] API error:', { status: response.status, error: errorData });
      } catch (parseErr) {
        console.error('[CWV] API error (non-JSON):', response.status, response.statusText);
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('[CWV] Analysis complete:', { hasDesktop: !!data.desktop, hasMobile: !!data.mobile });

    // Extract and set report metadata from API response
    const apiReportId = data?.reportId || data?.results?.reportId;
    const screenshotUrl = data?.screenshotUrl || data?.results?.screenshotUrl;
    if (apiReportId) {
      document.body.setAttribute('data-report-id', apiReportId);
      console.log('[CWV] Set report ID from API:', apiReportId);
    }
    if (screenshotUrl) {
      document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
      console.log('[CWV] Set screenshot URL from API:', screenshotUrl);
    }

    // Complete the loader
    loader.complete();

    // Fetch billing status before displaying results so Pro/DayPass users see unlocked sections
    if (window.ProReportBlock?.fetchBillingStatus) {
      await window.ProReportBlock.fetchBillingStatus(true);
      if (window.ProReportBlock?.isProSubscriber?.()) {
        console.log('[CWV] Pro/Day Pass user - clearing fresh scan payment flag');
        window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;
      }
    }

    // Show results after animation completes
    setTimeout(() => {
      // Show redirect notice if the page redirected
      if (data.finalUrl) {
        showRedirectNotice(url, data.finalUrl);
      }
      displayResults(data);
      resultsContainer.style.display = 'block';
      window.__REPORT_READY__ = true;
      window.dispatchEvent(new CustomEvent('report:ready'));
    }, 1000);

  } catch (error) {
    console.error('Analysis error:', error);
    showCWVError(error, url, loader);
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = t('common.analyzeCwv', 'ANALYZE CWV');
  }
});

/**
 * Show a redirect notice banner above results
 */
function showRedirectNotice(originalUrl, finalUrl) {
  // Remove any existing notice
  const existing = document.getElementById('cwv-redirect-notice');
  if (existing) existing.remove();

  const notice = document.createElement('div');
  notice.id = 'cwv-redirect-notice';
  notice.style.cssText = `
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #93c5fd;
    font-size: 0.875rem;
  `;
  notice.innerHTML = `
    <span style="font-size: 1.1rem;">&#x21AA;</span>
    <span>${t('scanError.redirectNotice', 'This site redirected from {{originalUrl}} to {{finalUrl}}', { originalUrl, finalUrl })}</span>
  `;
  resultsContainer.parentNode.insertBefore(notice, resultsContainer);
}

/**
 * Rich error state for CWV analysis (matches performance-hub pattern)
 */
function showCWVError(errorOrMessage, inputUrl, loader) {
  const message = typeof errorOrMessage === 'string' ? errorOrMessage : (errorOrMessage && errorOrMessage.message) || '';
  const errorLower = message.toLowerCase();

  // Extract domain from the URL input
  let domain = '';
  let attemptedUrl = '';
  try {
    const raw = (inputUrl || urlInput.value).trim();
    attemptedUrl = raw;
    const parsed = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
    domain = parsed.hostname;
  } catch (_) {
    domain = (inputUrl || urlInput.value).trim() || 'unknown';
    attemptedUrl = domain;
  }

  // Classify the error
  let titleKey = 'analysisFailed';
  let subtitleKey = 'analysisFailedSubtitle';
  let failedStep = 'unknown';
  let chips = null;
  let category = 'generic';

  if (errorLower.includes('execution context was destroyed') ||
      errorLower.includes('navigation') ||
      errorLower.includes('redirect')) {
    category = 'redirect';
    titleKey = 'redirectFailed';
    subtitleKey = 'redirectFailedSubtitle';
    failedStep = 'http';
    chips = { dns: 'ok', tls: 'ok', http: 'fail' };
  } else if (errorLower.includes('notfound') || errorLower.includes('enotfound') ||
      errorLower.includes('dns') || errorLower.includes('getaddrinfo') ||
      errorLower.includes('err_name_not_resolved')) {
    category = 'dns';
    titleKey = 'cantReach';
    subtitleKey = 'subtitle';
    failedStep = 'dns';
    chips = { dns: 'fail', tls: 'unknown', http: 'unknown' };
  } else if (errorLower.includes('network') || errorLower.includes('connection') ||
      errorLower.includes('econnrefused') || errorLower.includes('econnreset')) {
    category = 'connection';
    titleKey = 'connectionFailed';
    subtitleKey = 'connectionSubtitle';
    failedStep = 'tcp';
    chips = { dns: 'ok', tls: 'unknown', http: 'fail' };
  } else if (errorLower.includes('timeout') || errorLower.includes('timed out') ||
      errorLower.includes('too long')) {
    category = 'timeout';
    titleKey = 'timedOut';
    subtitleKey = 'timedOutSubtitle';
    failedStep = 'http';
    chips = { dns: 'ok', tls: 'ok', http: 'fail' };
  } else if (errorLower.includes('bot') || errorLower.includes('cloudflare') ||
      errorLower.includes('captcha') || errorLower.includes('blocked')) {
    category = 'blocked';
    titleKey = 'accessBlocked';
    subtitleKey = 'accessBlockedSubtitle';
    failedStep = 'http';
    chips = { dns: 'ok', tls: 'ok', http: 'fail' };
  } else if (errorLower.includes('ssl') || errorLower.includes('certificate') ||
      errorLower.includes('cert')) {
    category = 'ssl';
    titleKey = 'certIssue';
    subtitleKey = 'certIssueSubtitle';
    failedStep = 'tls';
    chips = { dns: 'ok', tls: 'fail', http: 'unknown' };
  }

  const title = t(`scanError.${titleKey}`, titleKey, { domain });
  const subtitle = t(`scanError.${subtitleKey}`, subtitleKey, { domain });
  const reasonText = message.slice(0, 120);
  const ts = new Date().toISOString();

  // SVG icons
  const globeXIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/><line x1="17" y1="7" x2="7" y2="17"/><line x1="7" y1="7" x2="17" y2="17"/></svg>';
  const chevronIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  const arrowUpRightIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>';

  // Build status chips HTML
  let chipsHtml = '';
  if (chips) {
    const chipEntries = [
      { key: 'dns', label: t('scanError.statusDns', 'DNS'), status: chips.dns },
      { key: 'tls', label: t('scanError.statusTls', 'TLS'), status: chips.tls },
      { key: 'http', label: t('scanError.statusHttp', 'HTTP'), status: chips.http }
    ];
    chipsHtml = '<div class="scan-error-state__chips">' +
      chipEntries.map(c => {
        const statusLabel = t('scanError.status' + c.status.charAt(0).toUpperCase() + c.status.slice(1), c.status);
        return '<span class="scan-error-state__chip scan-error-state__chip--' + c.status + '">' +
          '<span class="scan-error-state__chip-label">' + c.label + '</span> ' + statusLabel +
          '</span>';
      }).join('') +
      '</div>';
  }

  const reasonHtml = reasonText ? '<span class="scan-error-state__reason">' + t('scanError.reason', 'Reason: {{reason}}', { reason: reasonText }) + '</span>' : '';

  // Quick checks list
  const checks = [
    t('scanError.checkSpelling', 'Check spelling (common: .con vs .com)'),
    t('scanError.tryWww', "Try adding or removing 'www'"),
    t('scanError.verifyDns', 'Verify DNS exists (A / AAAA records)'),
    t('scanError.allowlistScanner', "If it's private / staging, allowlist our scanner IP"),
    t('scanError.runLocally', 'If it requires login, run Lighthouse from your browser')
  ];

  const html = `
    <div class="scan-error-state" role="alert" aria-live="polite">
      <div class="scan-error-state__main">
        <div class="scan-error-state__icon-badge">${globeXIcon}</div>
        <h3 class="scan-error-state__title">${title}</h3>
        <p class="scan-error-state__subtitle">${subtitle}</p>
        ${reasonHtml}
        ${chipsHtml}
        <div class="scan-error-state__actions">
          <button type="button" class="scan-error-state__btn-primary" data-action="cwv-edit-url">
            ${t('scanError.editUrl', 'Edit URL')}
          </button>
          <button type="button" class="scan-error-state__btn-secondary" data-action="cwv-try-again">
            ${t('scanError.tryAgain', 'Try again')}
          </button>
          <a class="scan-error-state__btn-tertiary" href="https://${domain}" target="_blank" rel="noopener noreferrer">
            ${t('scanError.openInBrowser', 'Open in browser')} ${arrowUpRightIcon}
          </a>
        </div>
      </div>
      <div class="scan-error-state__sidebar">
        <div>
          <h4 class="scan-error-state__checks-title">${t('scanError.quickChecks', 'Quick checks')}</h4>
          <ul class="scan-error-state__checks">
            ${checks.map(c => '<li class="scan-error-state__check-item"><span class="scan-error-state__check-icon">' + chevronIcon + '</span><span>' + c + '</span></li>').join('')}
          </ul>
        </div>
        <details class="scan-error-state__details">
          <summary>${t('scanError.technicalDetails', 'Technical details')}</summary>
          <div class="scan-error-state__details-body">
            <div class="scan-error-state__details-row">
              <span class="scan-error-state__details-label">${t('scanError.errorCode', 'Error code')}</span>
              <span class="scan-error-state__details-value">${category}</span>
            </div>
            <div class="scan-error-state__details-row">
              <span class="scan-error-state__details-label">${t('scanError.timestamp', 'Timestamp')}</span>
              <span class="scan-error-state__details-value">${ts}</span>
            </div>
            <div class="scan-error-state__details-row">
              <span class="scan-error-state__details-label">${t('scanError.attemptedUrl', 'Attempted URL')}</span>
              <span class="scan-error-state__details-value">${attemptedUrl}</span>
            </div>
            <div class="scan-error-state__details-row">
              <span class="scan-error-state__details-label">${t('scanError.failedStep', 'Failed step')}</span>
              <span class="scan-error-state__details-value">${failedStep}</span>
            </div>
          </div>
        </details>
      </div>
    </div>
  `;

  // Use the loader's error container or fall back to resultsContainer
  if (loader && typeof loader.showError === 'function') {
    // The loader.showError sets up the container; we override with rich HTML
    loader.showError(message);
    // Now replace the loader content with our rich error
    const loadingContainer = document.getElementById('loadingContainer');
    if (loadingContainer) {
      loadingContainer.innerHTML = html;
    }
  } else {
    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
  }

  // Wire up action buttons
  const editBtn = document.querySelector('[data-action="cwv-edit-url"]');
  const retryBtn = document.querySelector('[data-action="cwv-try-again"]');

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      urlInput.focus();
      urlInput.select();
    });
  }
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      analyzeButton.click();
    });
  }
}

async function displayResults(data) {
  // Ensure i18n is loaded before rendering (prevents English fallback on fast stored-report loads)
  if (window.i18n && !window.i18n.initialized) {
    try { await window.i18n.init(); } catch (e) { /* fallback */ }
  }

  // Validate data - ignore cached error responses
  if (!data || data.error || typeof data === 'string') {
    console.warn('[CWV] Ignoring invalid/error data:', data?.error || data);
    const errContainer = document.getElementById('resultsContent') || document.getElementById('results');
    if (errContainer) {
      errContainer.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted,#9ca3af)"><p style="font-size:1.1rem;margin-bottom:0.5rem">Data unavailable</p><p style="font-size:0.9rem">The cached data was invalid or contained an error. Please run a new scan.</p></div>';
    }
    window.__REPORT_READY__ = true;
    window.dispatchEvent(new CustomEvent('report:ready'));
    return;
  }

  // Store results globally for PDF generation and billing return restoration
  window.currentCWVResults = data;

  // Ensure results container is visible (may be hidden if called directly without scan flow)
  const resultsEl = document.getElementById('cwvResults');
  if (resultsEl) {
    resultsEl.style.display = 'block';
  }

  // Check Pro access for gating premium content
  const reportId = document.body.getAttribute('data-report-id') || '';
  const hasProAccess = window.ProReportBlock?.hasAccess?.(reportId) || false;
  console.log('[CWV] displayResults - hasProAccess:', hasProAccess, 'reportId:', reportId);

  // Build screenshot URL for report display
  const screenshotUrl = data.screenshotUrl || document.body.getAttribute('data-sm-screenshot-url') || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');

  const { desktop, mobile, score, grade, recommendations, issues, comparison } = data;

  // Build screenshot HTML
  const screenshotHTML = screenshotUrl ? `
    <div class="screenshot-section" style="margin-bottom: 1.5rem;">
      <h3 style="color: var(--text-primary, #fff); font-size: 1rem; margin: 0 0 0.75rem 0; font-weight: 600;">
        ${t('reports.common.pageScreenshot', 'Page Screenshot')}
      </h3>
      <div class="screenshot-item" style="background: var(--bg-secondary, #1a1a1a); border: 1px solid var(--border-color, #333); border-radius: 8px; overflow: hidden;">
        <img
          src="${screenshotUrl}"
          alt="Screenshot of analyzed page"
          class="screenshot-item__img"
          style="width: 100%; max-height: 300px; object-fit: cover; object-position: top; cursor: pointer; display: block;"
          data-action="open-lightbox"
          data-screenshot-url="${screenshotUrl}"
          data-screenshot-title="Page Screenshot"
          onerror="this.parentElement.innerHTML='<div style=\\'padding: 2rem; text-align: center; color: var(--text-muted, #666);\\'>${t('reports.common.screenshotUnavailable', 'Screenshot unavailable')}</div>'"
        />
      </div>
    </div>
  ` : '';

  resultsContainer.innerHTML = `
    ${screenshotHTML}
    <!-- Overall Score Banner -->
    <div style="
      background: linear-gradient(135deg, ${getGradeColor(grade)}20 0%, ${getGradeColor(grade)}10 100%);
      border: 3px solid ${getGradeColor(grade)};
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      text-align: center;
    ">
      <div style="font-size: 5rem; font-weight: bold; color: ${getGradeColor(grade)}; margin-bottom: 0.5rem;">${score}</div>
      <div style="font-size: 1.5rem; color: var(--r-text-muted, #6B7280); margin-bottom: 0.5rem;">${t('reports.cwv.overallScore', 'Overall CWV Score')}</div>
      <div style="
        display: inline-block;
        padding: 0.5rem 2rem;
        background: ${getGradeColor(grade)};
        color: #000;
        font-size: 2rem;
        font-weight: bold;
        border-radius: 8px;
        margin-bottom: 1rem;
      ">${t('reports.cwv.grade', 'GRADE')}: ${grade}</div>
      <div style="color: var(--r-text-muted, #6B7280); font-size: 1rem; margin-top: 1rem;">
        ${mobile.passedCWV ? '✓ ' + t('reports.cwv.passingCwv', 'PASSING Core Web Vitals (Good for Google Rankings)') : '✗ ' + t('reports.cwv.failingCwv', 'FAILING Core Web Vitals (May hurt Google Rankings)')}
      </div>
    </div>

    <!-- Critical Issues Alert -->
    ${issues.length > 0 ? `
    <div style="
      background: rgba(255, 68, 68, 0.1);
      border-left: 4px solid #ff4444;
      padding: 1.5rem;
      margin-bottom: 2rem;
      border-radius: 8px;
    ">
      <h3 style="color: #ff4444; margin: 0 0 1rem 0;">! ${t('reports.cwv.criticalIssues', 'Critical Issues')}</h3>
      ${issues.map(issue => `<p style="color: var(--r-text-muted, #6B7280); margin: 0.5rem 0;">${issue}</p>`).join('')}
    </div>
    ` : ''}

    <!-- Desktop vs Mobile Comparison -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
      <!-- Mobile (70% weight) -->
      <div style="
        background: rgba(150, 0, 255, 0.1);
        border: 2px solid rgba(150, 0, 255, 0.4);
        border-radius: 12px;
        padding: 1.5rem;
      ">
        <h3 style="color: #9600ff; margin: 0 0 1rem 0; display: flex; align-items: center; justify-content: space-between;">
          <span>M ${t('reports.cwv.mobile', 'Mobile')} (${t('reports.cwv.weight70', '70% weight')})</span>
          <span style="font-size: 2rem;">${mobile.score}/100</span>
        </h3>
        ${renderCWVMetrics(mobile)}
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(150, 0, 255, 0.3);">
          <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0;">
            ${mobile.passedCWV ? '✓ ' + t('reports.cwv.allVitalsPassed', 'All Core Web Vitals passed') : '✗ ' + t('reports.cwv.someMetricsNeedImprovement', 'Some metrics need improvement')}
          </p>
        </div>
      </div>

      <!-- Desktop (30% weight) -->
      <div style="
        background: rgba(0, 150, 255, 0.1);
        border: 2px solid rgba(0, 150, 255, 0.4);
        border-radius: 12px;
        padding: 1.5rem;
      ">
        <h3 style="color: #0096ff; margin: 0 0 1rem 0; display: flex; align-items: center; justify-content: space-between;">
          <span>D ${t('reports.cwv.desktop', 'Desktop')} (${t('reports.cwv.weight30', '30% weight')})</span>
          <span style="font-size: 2rem;">${desktop.score}/100</span>
        </h3>
        ${renderCWVMetrics(desktop)}
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(0, 150, 255, 0.3);">
          <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0;">
            ${desktop.passedCWV ? '✓ ' + t('reports.cwv.allVitalsPassed', 'All Core Web Vitals passed') : '~ ' + t('reports.cwv.someMetricsNeedImprovement', 'Some metrics need improvement')}
          </p>
        </div>
      </div>
    </div>

    <!-- Accordions for detailed analysis -->
    ${createCWVAccordionSection('best-practices', '📋', t('reports.cwv.bestPracticesTitle', 'Best Practices & Optimization Guide'), renderBestPracticesTable(mobile, desktop), Math.round((mobile.score + desktop.score) / 2))}

    ${createCWVAccordionSection('core-vitals', '⚡', t('reports.cwv.coreVitalsTitle', "The Big 3: Google's Core Web Vitals"), `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; padding: 1rem 0;">
        ${renderMetricCard('LCP', t('reports.cwv.lcpName', 'Largest Contentful Paint'), mobile.lcp, desktop.lcp, '⏱️', t('reports.cwv.loadingPerformance', 'Loading Performance'))}
        ${renderMetricCard('INP', t('reports.cwv.inpName', 'Interaction to Next Paint'), mobile.inp, desktop.inp, '👆', t('reports.cwv.responsiveness', 'Responsiveness'))}
        ${renderMetricCard('CLS', t('reports.cwv.clsName', 'Cumulative Layout Shift'), mobile.cls, desktop.cls, '📐', t('reports.cwv.visualStability', 'Visual Stability'))}
      </div>
    `, Math.round((mobile.score + desktop.score) / 2))}

    ${createCWVAccordionSection('additional-metrics', '📊', t('reports.cwv.additionalMetricsTitle', 'Additional Performance Metrics'), `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding: 1rem 0;">
        ${renderAdditionalMetric('FCP', t('reports.cwv.fcpName', 'First Contentful Paint'), mobile.additionalMetrics.fcp, desktop.additionalMetrics.fcp)}
        ${renderAdditionalMetric('SI', t('reports.cwv.siName', 'Speed Index'), mobile.additionalMetrics.si, desktop.additionalMetrics.si)}
        ${renderAdditionalMetric('TTI', t('reports.cwv.ttiName', 'Time to Interactive'), mobile.additionalMetrics.tti, desktop.additionalMetrics.tti)}
      </div>
    `, null)}

    <!-- Recommendations (Pro) -->
    ${recommendations.length > 0 ? createCWVAccordionSection('report-recommendations', '📋', t('reports.cwv.recommendationsTitle', 'Recommendations') + ' <span class="pro-pill">PRO</span>',
      hasProAccess ? `
      <div style="display: grid; gap: 1rem; padding: 1rem 0;">
        ${recommendations.map(rec => `
          <div style="
            background: ${rec.priority === 'critical' ? 'rgba(255, 68, 68, 0.1)' : rec.priority === 'high' ? 'rgba(255, 140, 0, 0.1)' : 'rgba(255, 215, 0, 0.1)'};
            border-left: 4px solid ${rec.priority === 'critical' ? '#ff4444' : rec.priority === 'high' ? '#ff8c00' : '#ffd700'};
            padding: 1.5rem;
            border-radius: 8px;
          ">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
              <h4 style="color: ${rec.priority === 'critical' ? '#ff4444' : rec.priority === 'high' ? '#ff8c00' : '#ffd700'}; margin: 0;">
                ${rec.metric}
              </h4>
              <span style="
                padding: 0.25rem 0.75rem;
                background: ${rec.priority === 'critical' ? '#ff4444' : rec.priority === 'high' ? '#ff8c00' : '#ffd700'};
                color: #000;
                font-size: 0.75rem;
                font-weight: bold;
                border-radius: 4px;
                text-transform: uppercase;
              ">${rec.priority}</span>
            </div>
            <p style="color: var(--r-text-muted, #6B7280); margin: 0 0 0.75rem 0; font-weight: 600;">~ ${rec.issue}</p>
            <p style="color: var(--r-text-muted, #6B7280); margin: 0;">ⓘ ${rec.solution}</p>
          </div>
        `).join('')}
      </div>
    ` : `
      <div style="position: relative; padding: 1.5rem; text-align: center;">
        <div style="filter: blur(4px); opacity: 0.4; pointer-events: none;">
          <div style="background: rgba(255, 140, 0, 0.1); border-left: 4px solid #ff8c00; padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem;">
            <p style="color: var(--r-text-faint, #9CA3AF); margin: 0;">${t('reports.cwv.detailedRecommendationsBlur', 'Detailed performance recommendations...')}</p>
          </div>
          <div style="background: rgba(255, 68, 68, 0.1); border-left: 4px solid #ff4444; padding: 1rem; border-radius: 8px;">
            <p style="color: var(--r-text-faint, #9CA3AF); margin: 0;">${t('reports.cwv.criticalOptimizationsBlur', 'Critical optimization suggestions...')}</p>
          </div>
        </div>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg-primary, #1a1a2e); padding: 1.5rem 2rem; border-radius: 12px; border: 2px solid var(--color-accent, #00ff41); box-shadow: 0 4px 20px rgba(0, 255, 65, 0.3);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔒</div>
          <p style="color: var(--color-text-primary, #e0e0e0); margin: 0 0 1rem 0; font-weight: 600;">${t('reports.cwv.recommendationsAvailable', '{{count}} Recommendation(s) Available', { count: recommendations.length })}</p>
          <button onclick="window.ProReportBlock?.showPurchaseOptions?.('${reportId}', 'core-web-vitals')" style="background: linear-gradient(135deg, #00ff41 0%, #00cc33 100%); color: #000; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 0.9rem;">
            ${t('reports.common.unlockProReport', 'Unlock Pro Report - $5')}
          </button>
        </div>
      </div>
    `, null) : ''}

    ${createCWVAccordionSection('understanding-scores', 'ℹ️', t('reports.cwv.understandingScoresTitle', 'Understanding Your Scores'), `
      <div style="padding: 1rem 0;">
        <p style="color: var(--r-text-muted, #6B7280); margin: 0 0 0.5rem 0;">${comparison.context}</p>
        <p style="color: var(--r-text-muted, #6B7280); margin: 0; font-size: 0.9rem;">${comparison.note}</p>
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(0, 255, 65, 0.2);">
          <p style="color: var(--r-text-muted, #6B7280); margin: 0.5rem 0;"><strong>LCP:</strong> ${comparison.comparison.lcp.percentile} - ${comparison.comparison.lcp.realWorldImpact}</p>
          <p style="color: var(--r-text-muted, #6B7280); margin: 0.5rem 0;"><strong>CLS:</strong> ${comparison.comparison.cls.percentile} - ${comparison.comparison.cls.realWorldImpact}</p>
        </div>
      </div>
    `, null)}

    <!-- PDF Download button removed - monetization disabled -->
  `;

  // Pro Report Block (Export & Share)
  if (window.ProReportBlock && window.ProReportBlock.render) {
    resultsContainer.insertAdjacentHTML('beforeend', window.ProReportBlock.render({
      context: 'core-web-vitals',
      features: ['pdf', 'excel', 'csv', 'share'],
      title: t('reports.common.unlockReport', 'Unlock Report'),
      subtitle: t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.')
    }));
  } else {
    const opts = { context: 'core-web-vitals', features: ['pdf', 'excel', 'csv', 'share'], title: 'Unlock Report', subtitle: 'PDF export, share link, export data, and fix packs for this scan.' };
    const safe = JSON.stringify(opts).replace(/</g, '\\u003c').replace(/"/g, '&quot;');
    resultsContainer.insertAdjacentHTML('beforeend', '<div class="pro-report-block" data-pro-block-pending data-pro-block-options="' + safe + '"></div>');
  }

  // Add click handler for screenshot lightbox
  if (screenshotUrl) {
    const screenshotImg = resultsContainer.querySelector('[data-action="open-lightbox"]');
    if (screenshotImg) {
      screenshotImg.addEventListener('click', () => {
        if (window.ScreenshotLightbox && typeof window.ScreenshotLightbox.open === 'function') {
          window.ScreenshotLightbox.open(screenshotUrl, 'Page Screenshot');
        }
      });
    }
  }

  // Auto-save report if user has access (purchased or Pro)
  const reportIdForSave = document.body.getAttribute('data-report-id') || '';
  if (reportIdForSave && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
    window.ReportStorage.autoSaveIfEligible(reportIdForSave, data, {
      siteUrl: urlInput.value.trim(),
      analyzerType: 'core-web-vitals',
      scannedAt: window.SM_SCAN_STARTED_AT || new Date().toISOString()
    });
  }
}

// Expose display function globally for billing return handler
window.displayCWVResults = displayResults;

function renderCWVMetrics(device) {
  return `
    <div style="display: grid; gap: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: var(--r-text-muted, #6B7280);">LCP</span>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--r-text-muted, #6B7280); font-family: 'Courier New', monospace; font-weight: bold;">${device.lcp.displayValue}</span>
          <span style="font-size: 1.2rem;">${getRatingEmoji(device.lcp.rating)}</span>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: var(--r-text-muted, #6B7280);">INP/FID</span>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--r-text-muted, #6B7280); font-family: 'Courier New', monospace; font-weight: bold;">${device.inp.displayValue}</span>
          <span style="font-size: 1.2rem;">${getRatingEmoji(device.inp.rating)}</span>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: var(--r-text-muted, #6B7280);">CLS</span>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--r-text-muted, #6B7280); font-family: 'Courier New', monospace; font-weight: bold;">${device.cls.value.toFixed(3)}</span>
          <span style="font-size: 1.2rem;">${getRatingEmoji(device.cls.rating)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderMetricCard(abbr, name, mobileMetric, desktopMetric, icon, category) {
  // Determine overall rating based on mobile (70% weight) and desktop (30% weight)
  const mobileRating = mobileMetric.rating || 'unknown';
  const desktopRating = desktopMetric.rating || 'unknown';
  
  // Use mobile rating as primary since it's weighted more heavily
  const primaryRating = mobileRating;
  
  const ratingColor = {
    'good': '#00ff41',
    'needs-improvement': '#ffd700',
    'poor': '#ff4444',
    'unknown': '#808080'
  }[primaryRating];

  const cardId = `metric-card-${abbr.toLowerCase()}`;

  // Add the card HTML
  setTimeout(() => {
    const card = document.getElementById(cardId);
    if (card) {
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-4px)';
        this.style.boxShadow = `0 6px 20px ${ratingColor}50`;
      });
      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'none';
      });
    }
  }, 100);

  return `
    <div id="${cardId}" style="
      background: rgba(0, 0, 0, 0.4);
      border: 2px solid ${ratingColor};
      border-radius: 12px;
      padding: 1.5rem;
      transition: all 0.3s ease;
      cursor: pointer;
    ">
      <div style="font-size: 3rem; text-align: center; margin-bottom: 0.5rem;">${icon}</div>
      <div style="text-align: center; color: ${ratingColor}; font-weight: bold; font-size: 1.2rem; margin-bottom: 0.25rem;">${abbr}</div>
      <div style="text-align: center; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; margin-bottom: 1rem;">${name}</div>
      
      <!-- Mobile and Desktop Values -->
      <div style="margin-bottom: 1rem;">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          padding: 0.5rem;
          background: rgba(150, 0, 255, 0.1);
          border-radius: 6px;
        ">
          <span style="color: #9600ff; font-size: 0.85rem; font-weight: bold;">M Mobile</span>
          <span style="color: var(--r-text-muted, #6B7280); font-family: 'Courier New', monospace; font-weight: bold; font-size: 1.1rem;">
            ${abbr === 'CLS' ? mobileMetric.value.toFixed(3) : (mobileMetric.displayValue || 'N/A')}
          </span>
        </div>
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: rgba(0, 150, 255, 0.1);
          border-radius: 6px;
        ">
          <span style="color: #0096ff; font-size: 0.85rem; font-weight: bold;">D Desktop</span>
          <span style="color: var(--r-text-muted, #6B7280); font-family: 'Courier New', monospace; font-weight: bold; font-size: 1.1rem;">
            ${abbr === 'CLS' ? desktopMetric.value.toFixed(3) : (desktopMetric.displayValue || 'N/A')}
          </span>
        </div>
      </div>
      
      <div style="text-align: center; color: #909090; font-size: 0.8rem; margin-bottom: 0.75rem;">${category}</div>
      <div style="text-align: center; padding: 0.5rem; border: 1px solid ${ratingColor}; border-radius: 6px;">
        <div style="color: ${ratingColor}; font-weight: 600; font-size: 0.9rem;">${translateCwvRating(primaryRating)}</div>
      </div>
      <div style="margin-top: 0.75rem; color: var(--r-text-faint, #9CA3AF); font-size: 0.75rem; line-height: 1.3; text-align: center;">
        ${translateCwvMetricDescription(mobileMetric.description || 'Metric information')}
      </div>
    </div>
  `;
}

function renderAdditionalMetric(abbr, name, mobileMetric, desktopMetric) {
  return `
    <div style="
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(0, 150, 255, 0.3);
      border-radius: 8px;
      padding: 1rem;
    ">
      <div style="color: #0096ff; font-weight: bold; margin-bottom: 0.5rem;">${abbr}</div>
      <div style="color: var(--r-text-muted, #6B7280); font-size: 0.85rem; margin-bottom: 1rem;">${name}</div>
      
      <!-- Mobile Value -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        padding: 0.5rem;
        background: rgba(150, 0, 255, 0.1);
        border-radius: 6px;
      ">
        <span style="color: #9600ff; font-size: 0.8rem; font-weight: bold;">M Mobile</span>
        <span style="color: var(--r-text-muted, #6B7280); font-family: 'Courier New', monospace; font-weight: bold; font-size: 1rem;">
          ${mobileMetric.displayValue}
        </span>
      </div>
      
      <!-- Desktop Value -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        background: rgba(0, 150, 255, 0.1);
        border-radius: 6px;
      ">
        <span style="color: #0096ff; font-size: 0.8rem; font-weight: bold;">D Desktop</span>
        <span style="color: var(--r-text-muted, #6B7280); font-family: 'Courier New', monospace; font-weight: bold; font-size: 1rem;">
          ${desktopMetric.displayValue}
        </span>
      </div>
      
      <div style="color: #909090; font-size: 0.75rem; margin-top: 0.75rem; line-height: 1.3;">
        ${translateCwvMetricDescription(mobileMetric.description)}
      </div>
    </div>
  `;
}

function renderBestPracticesTable(mobile, desktop) {
  return `
    <div style="
      background: rgba(0, 255, 65, 0.05);
      border: 2px solid rgba(0, 255, 65, 0.3);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      overflow-x: auto;
    ">
      <table style="
        width: 100%;
        border-collapse: collapse;
        color: var(--r-text-muted, #6B7280);
        font-size: 0.9rem;
      ">
        <thead>
          <tr style="background: rgba(0, 255, 65, 0.1); border-bottom: 2px solid rgba(0, 255, 65, 0.4);">
            <th style="padding: 1rem; text-align: left; color: #00ff41; font-weight: bold; width: 12%;">${t('reports.common.metric', 'Metric')}</th>
            <th style="padding: 1rem; text-align: left; color: #00ff41; font-weight: bold; width: 15%;">${t('reports.cwv.googleTarget', 'Google Target')}</th>
            <th style="padding: 1rem; text-align: center; color: #9600ff; font-weight: bold; width: 10%;">${t('reports.performance.mobile', 'Mobile')}</th>
            <th style="padding: 1rem; text-align: center; color: #0096ff; font-weight: bold; width: 10%;">${t('reports.performance.desktop', 'Desktop')}</th>
            <th style="padding: 1rem; text-align: center; color: #00ff41; font-weight: bold; width: 8%;">${t('reports.common.status', 'Status')}</th>
            <th style="padding: 1rem; text-align: left; color: #00ff41; font-weight: bold; width: 45%;">${t('reports.cwv.optimizationRecommendations', 'Optimization Recommendations')}</th>
          </tr>
        </thead>
        <tbody>
          <!-- LCP Row -->
          <tr style="border-bottom: 1px solid rgba(0, 255, 65, 0.2);">
            <td style="padding: 1rem; font-weight: bold; color: #ffd700;">
              ${t('reports.cwv.lcp', 'LCP')}<br/>
              <span style="font-size: 0.75rem; color: var(--r-text-muted, #6B7280); font-weight: normal;">${t('reports.cwv.lcpName', 'Largest Contentful Paint')}</span>
            </td>
            <td style="padding: 1rem; color: var(--r-text-muted, #6B7280);">
              <div style="margin-bottom: 0.25rem;"><span style="color: #00ff41;">${t('reports.common.good', 'Good')}:</span> ≤ 2.5s</div>
              <div style="margin-bottom: 0.25rem;"><span style="color: #ffd700;">${t('reports.common.needsWork', 'Needs Work')}:</span> 2.5s - 4.0s</div>
              <div><span style="color: #ff4444;">${t('reports.common.poor', 'Poor')}:</span> > 4.0s</div>
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #9600ff; font-weight: bold;">
              ${mobile.lcp.displayValue || 'N/A'}
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #0096ff; font-weight: bold;">
              ${desktop.lcp.displayValue || 'N/A'}
            </td>
            <td style="padding: 1rem; text-align: center; font-size: 1.5rem;">
              ${mobile.lcp.rating === 'good' && desktop.lcp.rating === 'good' ? '✓' :
                mobile.lcp.rating === 'good' || desktop.lcp.rating === 'good' ? '~' : '✗'}
            </td>
            <td style="padding: 1rem; color: var(--r-text-muted, #6B7280); line-height: 1.6;">
              <div style="margin-bottom: 0.5rem;"><strong style="color: var(--r-text-muted, #6B7280);">1. ${t('reports.cwv.tips.lcpOptimizeCritical', 'Optimize Critical Resources')}:</strong> ${t('reports.cwv.tips.lcpOptimizeCriticalDesc', 'Reduce render-blocking JavaScript and CSS. Inline critical CSS and defer non-essential scripts.')}</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: var(--r-text-muted, #6B7280);">2. ${t('reports.cwv.tips.lcpImageOptimization', 'Image Optimization')}:</strong> ${t('reports.cwv.tips.lcpImageOptimizationDesc', 'Compress largest image/video, use modern formats (WebP, AVIF), implement responsive images with srcset.')}</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: var(--r-text-muted, #6B7280);">3. ${t('reports.cwv.tips.lcpServerPerformance', 'Server Performance')}:</strong> ${t('reports.cwv.tips.lcpServerPerformanceDesc', 'Use CDN, enable HTTP/2, implement server-side caching, reduce server response time (TTFB).')}</div>
              <div><strong style="color: var(--r-text-muted, #6B7280);">4. ${t('reports.cwv.tips.lcpResourceHints', 'Resource Hints')}:</strong> ${t('reports.cwv.tips.lcpResourceHintsDesc', 'Add preload for critical resources, preconnect to required origins, use priority hints for important images.')}</div>
            </td>
          </tr>
          
          <!-- INP/FID Row -->
          <tr style="border-bottom: 1px solid rgba(0, 255, 65, 0.2);">
            <td style="padding: 1rem; font-weight: bold; color: #ffd700;">
              ${t('reports.cwv.inp', 'INP/TBT')}<br/>
              <span style="font-size: 0.75rem; color: var(--r-text-muted, #6B7280); font-weight: normal;">${t('reports.cwv.inpName', 'Interaction to Next Paint')}</span>
            </td>
            <td style="padding: 1rem; color: var(--r-text-muted, #6B7280);">
              <div style="margin-bottom: 0.25rem;"><span style="color: #00ff41;">${t('reports.common.good', 'Good')}:</span> ≤ 200ms</div>
              <div style="margin-bottom: 0.25rem;"><span style="color: #ffd700;">${t('reports.common.needsWork', 'Needs Work')}:</span> 200ms - 500ms</div>
              <div><span style="color: #ff4444;">${t('reports.common.poor', 'Poor')}:</span> > 500ms</div>
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #9600ff; font-weight: bold;">
              ${mobile.inp.displayValue || 'N/A'}
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #0096ff; font-weight: bold;">
              ${desktop.inp.displayValue || 'N/A'}
            </td>
            <td style="padding: 1rem; text-align: center; font-size: 1.5rem;">
              ${mobile.inp.rating === 'good' && desktop.inp.rating === 'good' ? '✓' :
                mobile.inp.rating === 'good' || desktop.inp.rating === 'good' ? '~' : '✗'}
            </td>
            <td style="padding: 1rem; color: var(--r-text-muted, #6B7280); line-height: 1.6;">
              <div style="margin-bottom: 0.5rem;"><strong style="color: var(--r-text-muted, #6B7280);">1. ${t('reports.cwv.tips.inpMinimizeJs', 'Minimize JavaScript')}:</strong> ${t('reports.cwv.tips.inpMinimizeJsDesc', 'Remove unused code, split bundles, lazy load non-critical JavaScript. Keep main thread under 50ms per task.')}</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: var(--r-text-muted, #6B7280);">2. ${t('reports.cwv.tips.inpOptimizeHandlers', 'Optimize Event Handlers')}:</strong> ${t('reports.cwv.tips.inpOptimizeHandlersDesc', 'Debounce/throttle input handlers, use passive event listeners, avoid synchronous layout calculations.')}</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: var(--r-text-muted, #6B7280);">3. ${t('reports.cwv.tips.inpWebWorkers', 'Web Workers')}:</strong> ${t('reports.cwv.tips.inpWebWorkersDesc', 'Move heavy computations to web workers, use requestIdleCallback for non-urgent tasks.')}</div>
              <div><strong style="color: var(--r-text-muted, #6B7280);">4. ${t('reports.cwv.tips.inpThirdParty', 'Third-Party Scripts')}:</strong> ${t('reports.cwv.tips.inpThirdPartyDesc', 'Audit and remove unnecessary third-party scripts, load them asynchronously, use facade patterns for heavy widgets.')}</div>
            </td>
          </tr>
          
          <!-- CLS Row -->
          <tr>
            <td style="padding: 1rem; font-weight: bold; color: #ffd700;">
              ${t('reports.cwv.cls', 'CLS')}<br/>
              <span style="font-size: 0.75rem; color: var(--r-text-muted, #6B7280); font-weight: normal;">${t('reports.cwv.clsName', 'Cumulative Layout Shift')}</span>
            </td>
            <td style="padding: 1rem; color: var(--r-text-muted, #6B7280);">
              <div style="margin-bottom: 0.25rem;"><span style="color: #00ff41;">${t('reports.common.good', 'Good')}:</span> ≤ 0.1</div>
              <div style="margin-bottom: 0.25rem;"><span style="color: #ffd700;">${t('reports.common.needsWork', 'Needs Work')}:</span> 0.1 - 0.25</div>
              <div><span style="color: #ff4444;">${t('reports.common.poor', 'Poor')}:</span> > 0.25</div>
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #9600ff; font-weight: bold;">
              ${mobile.cls.value.toFixed(3)}
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #0096ff; font-weight: bold;">
              ${desktop.cls.value.toFixed(3)}
            </td>
            <td style="padding: 1rem; text-align: center; font-size: 1.5rem;">
              ${mobile.cls.rating === 'good' && desktop.cls.rating === 'good' ? '✓' :
                mobile.cls.rating === 'good' || desktop.cls.rating === 'good' ? '~' : '✗'}
            </td>
            <td style="padding: 1rem; color: var(--r-text-muted, #6B7280); line-height: 1.6;">
              <div style="margin-bottom: 0.5rem;"><strong style="color: var(--r-text-muted, #6B7280);">1. ${t('reports.cwv.tips.clsReserveSpace', 'Reserve Space')}:</strong> ${t('reports.cwv.tips.clsReserveSpaceDesc', 'Set explicit width/height on images and videos, use CSS aspect-ratio property, reserve space for ads and embeds.')}</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: var(--r-text-muted, #6B7280);">2. ${t('reports.cwv.tips.clsFontLoading', 'Font Loading')}:</strong> ${t('reports.cwv.tips.clsFontLoadingDesc', 'Use font-display: swap, preload critical fonts, avoid invisible text during font load (FOIT).')}</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: var(--r-text-muted, #6B7280);">3. ${t('reports.cwv.tips.clsDynamicContent', 'Dynamic Content')}:</strong> ${t('reports.cwv.tips.clsDynamicContentDesc', 'Never insert content above existing content without user interaction, use transform animations instead of layout-shifting properties.')}</div>
              <div><strong style="color: var(--r-text-muted, #6B7280);">4. ${t('reports.cwv.tips.clsCssBestPractices', 'CSS Best Practices')}:</strong> ${t('reports.cwv.tips.clsCssBestPracticesDesc', 'Avoid animations on layout properties (width, height, top, left), use transform and opacity instead.')}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Additional Context -->
      <div style="
        margin-top: 1.5rem;
        padding: 1rem;
        background: rgba(187, 134, 252, 0.08);
        border: 1px solid rgba(187, 134, 252, 0.3);
        border-radius: 8px;
      ">
        <h4 style="color: #bb86fc; margin: 0 0 0.75rem 0; font-size: 1rem;">${t('reports.cwv.googleMethodology', "Google's Evaluation Methodology")}</h4>
        <div style="color: var(--r-text-muted, #6B7280); font-size: 0.85rem; line-height: 1.6;">
          <p style="margin: 0 0 0.5rem 0;">${t('reports.cwv.googleMethodologyDesc', 'Google evaluates Core Web Vitals at the 75th percentile of all page loads. This means:')}</p>
          <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
            <li style="margin: 0.25rem 0;"><strong style="color: #00ff41;">${t('reports.common.good', 'Good')} (${t('reports.cwv.green', 'Green')}):</strong> ${t('reports.cwv.goodThresholdDesc', '75% or more of your users experience the "good" threshold')}</li>
            <li style="margin: 0.25rem 0;"><strong style="color: #ffd700;">${t('reports.common.needsImprovement', 'Needs Improvement')} (${t('reports.cwv.yellow', 'Yellow')}):</strong> ${t('reports.cwv.needsImprovementDesc', 'Between "good" and "poor" thresholds')}</li>
            <li style="margin: 0.25rem 0;"><strong style="color: #ff4444;">${t('reports.common.poor', 'Poor')} (${t('reports.cwv.red', 'Red')}):</strong> ${t('reports.cwv.poorThresholdDesc', '25% or more of your users experience the "poor" threshold')}</li>
          </ul>
          <p style="margin: 0.75rem 0 0 0; padding-top: 0.75rem; border-top: 1px solid rgba(187, 134, 252, 0.2);">
            <strong>${t('reports.cwv.mobileWeighting', 'Mobile Weighting')}:</strong> ${t('reports.cwv.mobileWeightingDesc', 'Mobile performance counts for 70% of your overall score because Google uses mobile-first indexing for search rankings.')}
          </p>
        </div>
      </div>
    </div>
  `;
}

function getGradeColor(grade) {
  switch(grade) {
    case 'A': return '#00ff41';
    case 'B': return '#ffd700';
    case 'C': return '#ff8c00';
    case 'D': return '#ff6b6b';
    case 'F': return '#ff4444';
    default: return '#808080';
  }
}

function getRatingEmoji(rating) {
  if (rating === 'good') return '✓';
  if (rating === 'needs-improvement') return '⚠️';
  return '✗';
}

// Accordion helper functions
function createCWVAccordionSection(id, icon, title, contentHTML, score = null) {
  const scoreHTML = score !== null ? `
    <span class="accordion-badge" style="
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      background: ${score >= 90 ? 'rgba(0, 255, 65, 0.2)' : score >= 70 ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 68, 68, 0.2)'};
      color: ${score >= 90 ? '#00ff41' : score >= 70 ? '#ffd700' : '#ff4444'};
      border: 1px solid ${score >= 90 ? 'rgba(0, 255, 65, 0.4)' : score >= 70 ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 68, 68, 0.4)'};
    ">${score}</span>
  ` : '';

  return `
    <div class="accordion" style="margin-bottom: 0.5rem; border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.03);">
      <div class="accordion-header" data-action="toggle-cwv-accordion" data-accordion-id="${id}" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.875rem 1.25rem;
        cursor: pointer;
        background: transparent;
        transition: all 0.2s ease;
      ">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.25rem;">${icon}</span>
          <span style="font-weight: 600; color: var(--r-text, #111827);">${title}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${scoreHTML}
          <span class="accordion-chevron" style="transition: transform 0.2s ease; color: var(--r-text-faint, #9CA3AF);">▼</span>
        </div>
      </div>
      <div class="accordion-content" id="${id}" style="
        max-height: 0;
        overflow: hidden;
        transition: all 0.3s ease;
        padding: 0 1.25rem;
        border-top: 0px solid rgba(255, 255, 255, 0.1);
      ">
        <div class="accordion-body" style="padding: 0;">${contentHTML}</div>
      </div>
    </div>
  `;
}

function toggleCWVAccordion(accordionId) {
  const content = document.getElementById(accordionId);
  const header = content.previousElementSibling;
  const chevron = header.querySelector('.accordion-chevron');

  if (content.style.maxHeight && content.style.maxHeight !== '0px') {
    // Collapse
    content.style.maxHeight = '0px';
    content.style.padding = '0 1.25rem';
    content.style.borderTopWidth = '0px';
    chevron.style.transform = 'rotate(0deg)';
  } else {
    // Expand
    content.style.maxHeight = content.scrollHeight + 'px';
    content.style.padding = '1rem 1.25rem';
    content.style.borderTopWidth = '1px';
    chevron.style.transform = 'rotate(180deg)';

    // Adjust max-height after content loads (images, etc.)
    setTimeout(() => {
      if (content.style.maxHeight !== '0px') {
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    }, 100);
  }
}

window.toggleCWVAccordion = toggleCWVAccordion;

// Add click event delegation for CWV accordions
document.addEventListener('click', function(e) {
  // Handle accordion header clicks
  const header = e.target.closest('.cwv-accordion-header');
  if (header) {
    const accordion = header.closest('.cwv-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-accordion-id') || accordion.getAttribute('data-fix-id');
      if (fixId && typeof window.toggleCWVAccordion === 'function') {
        window.toggleCWVAccordion(fixId);
      }
    }
  }
});

// Auto-start scan if URL parameter is present
if (typeof window.getUrlParameter === 'function') {
  window.addEventListener('DOMContentLoaded', () => {
    const autoUrl = window.getUrlParameter();
    if (autoUrl) {
      urlInput.value = autoUrl;
      setTimeout(() => {
        analyzeButton.click();
      }, 500);
    }
  });
}
