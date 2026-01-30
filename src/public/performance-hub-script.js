/**
 * Performance Hub Script
 * Unified performance analysis with three modes:
 * - Quick Scan: Fast resource analysis without Lighthouse
 * - Full Analysis: Complete Lighthouse Audit with desktop/mobile
 * - Core Web Vitals: Google ranking metrics focus
 */

document.addEventListener('DOMContentLoaded', () => {
  // Deterministic analyzer key (stable forever). Updated per-mode at scan time.
  window.SM_ANALYZER_KEY = 'speed-ux-quick';
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);

  const urlInput = document.getElementById('urlInput');
  const analyzeButton = document.getElementById('analyzeButton');
  const buttonText = document.getElementById('buttonText');
  const results = document.getElementById('results');
  const resultsContent = document.getElementById('resultsContent');
  const errorMessage = document.getElementById('errorMessage');
  const modeTabs = Array.from(document.querySelectorAll('.tabs__item'));
  const modeIndicator = document.getElementById('selectedMode');
  const modeDescription = document.getElementById('modeDescription');

  async function ensureCreditsManagerLoaded() {
    if (window.CreditsManager) return;
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = '/assets/js/ui.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  async function handleBillingReturnIfPresent() {
    // Prefer the shared handler (ReportUI is included on this page)
    if (window.ReportUI && typeof window.ReportUI.handleBillingReturnIfPresent === 'function') {
      try {
        await window.ReportUI.handleBillingReturnIfPresent();
      } catch (e) {
        // ignore
      }
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || params.get('sessionId');
    if (!sessionId) return;

    try {
      await ensureCreditsManagerLoaded();
      if (!window.CreditsManager) return;

      if (typeof window.CreditsManager.hasPurchaseReceipt === 'function' && window.CreditsManager.hasPurchaseReceipt(sessionId)) {
        params.delete('session_id');
        params.delete('sessionId');
        params.delete('canceled');
        const cleaned = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.replaceState({}, '', cleaned);
        return;
      }

      const verifyResp = await fetch(`/api/billing/verify-session?session_id=${encodeURIComponent(sessionId)}`);
      const verification = await verifyResp.json();

      if (verification && verification.paid === true && verification.purchaseType) {
        const reportIdFromQuery = params.get('reportId') || null;
        const reportId = verification.reportId || reportIdFromQuery;

        if (verification.purchaseType === 'single_report' && reportId) {
          window.CreditsManager.unlockReport(reportId, 'single');
        } else if (verification.purchaseType === 'credit_pack') {
          const creditsToAdd = parseInt(verification.creditsAdded || 0, 10) || 0;
          if (creditsToAdd > 0) window.CreditsManager.addCredits(creditsToAdd);
        }

        if (typeof window.CreditsManager.addPurchaseReceipt === 'function') {
          window.CreditsManager.addPurchaseReceipt(sessionId);
        }

        params.delete('session_id');
        params.delete('sessionId');
        params.delete('canceled');
        const cleaned = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.replaceState({}, '', cleaned);

        // Let existing hub logic re-render from localStorage state
        window.location.reload();
      }
    } catch (e) {

    }
  }

  let currentMode = 'quick';
  let loader = null;
  let pendingAnalysisUrl = null; // Store URL for resuming after payment

  handleBillingReturnIfPresent();

  /**
   * Check if user can run a report (has subscription OR purchased this report type)
   * @param {string} mode - The analysis mode (quick, full, cwv)
   * @returns {Promise<boolean>}
   */
  async function checkCanRunReport(mode) {
    // Quick scan is always free - no payment required
    if (mode === 'quick') {
      console.log('[PerformanceHub] Quick scan is free, allowing access');
      return true;
    }

    // Ensure billing status is fetched
    if (window.ProReportBlock?.fetchBillingStatus) {
      await window.ProReportBlock.fetchBillingStatus();
    }

    // Check if user is a Pro subscriber (any subscription tier)
    if (window.ProReportBlock?.isProSubscriber?.()) {
      console.log('[PerformanceHub] User is Pro subscriber, allowing access');
      return true;
    }

    // Get report type for checking purchase
    const reportType = mode === 'full' ? 'lighthouse' : mode === 'cwv' ? 'cwv' : mode;

    // Check if this specific report type has been purchased
    // For single report purchases, we check against the report type
    const reportId = document.body.getAttribute('data-report-id') || '';
    if (reportId && window.ProReportBlock?.isReportPurchased?.(reportId)) {
      console.log('[PerformanceHub] Report is purchased, allowing access:', reportId);
      return true;
    }

    // Also check localStorage for mode-based purchases (legacy support)
    const purchaseKey = `sm_report_purchased_${reportType}`;
    const purchaseTimestamp = localStorage.getItem(purchaseKey);
    if (purchaseTimestamp) {
      // Check if purchase is within 24 hours (single report validity)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      if (parseInt(purchaseTimestamp, 10) > oneDayAgo) {
        console.log('[PerformanceHub] Recent purchase found for:', reportType);
        return true;
      }
    }

    console.log('[PerformanceHub] No access found for mode:', mode);
    return false;
  }

  /**
   * Handle successful payment - resume the pending analysis
   */
  function onPaymentSuccess(reportType) {
    console.log('[PerformanceHub] Payment successful for:', reportType);

    // Store purchase in localStorage
    const purchaseKey = `sm_report_purchased_${reportType}`;
    localStorage.setItem(purchaseKey, Date.now().toString());

    // Clear billing cache to refresh status
    if (window.ProReportBlock?.clearBillingCache) {
      window.ProReportBlock.clearBillingCache();
    }

    // Resume the analysis if we have a pending URL
    if (pendingAnalysisUrl) {
      urlInput.value = pendingAnalysisUrl;
      pendingAnalysisUrl = null;
      // Small delay to ensure UI is ready
      setTimeout(() => runAnalysis(), 100);
    }
  }

  // Attach shared click handlers for PaidUnlockCard (if loaded on this page)
  if (window.SmEntitlements && typeof window.SmEntitlements.init === 'function') {
    window.SmEntitlements.init();
  }

  // Expose mode switching globally for inline onclick handlers
  function setActiveTab(mode) {
    modeTabs.forEach(t => {
      const isActive = t.dataset.mode === mode;
      t.classList.toggle('tabs__item--active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      t.tabIndex = isActive ? 0 : -1;
    });
  }

  window.setPerformanceMode = function(mode) {
    if (!mode || mode === currentMode) return;
    currentMode = mode;
    setActiveTab(mode);
    updateModeIndicator();

    // Keep analyzer key aligned with the selected mode
    const key = mode === 'quick' ? 'speed-ux-quick' : mode === 'cwv' ? 'speed-ux-cwv' : 'speed-ux-full';
    window.SM_ANALYZER_KEY = key;
    document.body.setAttribute('data-sm-analyzer-key', key);
  };

  // Debug: Check if tabs are found

  // Tab switching is handled by inline script in HTML
  // This external script just reads the active tab at analysis time

  function updateModeIndicator() {
    const modeLabels = {
      'quick': 'Quick scan',
      'cwv': 'Core Web Vitals',
      'full': 'Lighthouse Audit'
    };
    const modeDescriptions = {
      'quick': 'Resource analysis focusing on requests, page weight, blocking assets, and server response time.',
      'cwv': 'Core Web Vitals deep dive: LCP, CLS, INP/TBT with risk flags and pass/fail indicators.',
      'full': 'Complete Lighthouse Audit across Performance, Accessibility, Best Practices, and SEO (desktop + mobile).'
    };
    if (modeIndicator) {
      modeIndicator.textContent = modeLabels[currentMode] || 'Quick scan';
    }
    if (modeDescription) {
      modeDescription.textContent = modeDescriptions[currentMode] || modeDescriptions.quick;
    }
  }

  // Attach tab click handlers (direct binding for reliability)
  modeTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetMode = tab.dataset.mode;
      if (!targetMode) return;
      setPerformanceMode(targetMode);
    });
  });

  // Handle analysis
  analyzeButton.addEventListener('click', runAnalysis);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') runAnalysis();
  });

  // Check for URL in query params
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('url');
  const modeParam = params.get('mode');
  const reportIdParam = params.get('report_id');
  const autoScan = params.get('auto_scan') === 'true';
  const reportTypeParam = params.get('report_type'); // lighthouse, cwv, etc.
  const billingSuccessParam = params.get('billing_success') === 'true';
  const sessionIdParam = params.get('session_id') || params.get('sessionId');

  // If returning from successful payment, mark the report type as purchased
  // This must happen BEFORE mode initialization so checkCanRunReport passes
  if ((billingSuccessParam || sessionIdParam) && reportTypeParam) {
    console.log('[PerformanceHub] Marking report type as purchased after billing return:', reportTypeParam);
    const purchaseKey = `sm_report_purchased_${reportTypeParam}`;
    localStorage.setItem(purchaseKey, Date.now().toString());
    // Also clear billing cache to get fresh status
    if (window.ProReportBlock?.clearBillingCache) {
      window.ProReportBlock.clearBillingCache();
    }
  }

  // Set mode from report_type parameter (from billing return) or mode parameter
  const effectiveMode = reportTypeParam === 'lighthouse' ? 'full' :
                        reportTypeParam === 'cwv' ? 'cwv' :
                        modeParam;

  if (effectiveMode && ['quick', 'full', 'cwv'].includes(effectiveMode)) {
    currentMode = effectiveMode;
    modeTabs.forEach(t => {
      t.classList.remove('tabs__item--active');
      if (t.dataset.mode === effectiveMode) {
        t.classList.add('tabs__item--active');
      }
    });
    updateModeIndicator();
  }

  // Generic display function for loading stored reports
  // Exposed globally for Puppeteer PDF rendering
  window.displayResults = displayResults;
  function displayResults(data) {
    if (!data) return;

    // Validate data structure - check for error responses
    if (data.error || typeof data === 'string') {
      console.error('[PerformanceHub] Cannot display error data:', data);
      displayError(data.error || 'Invalid report data', null);
      return;
    }

    // Get URL from input field or data
    const urlFromInput = urlInput?.value;
    const reportUrl = data.url || urlFromInput || '';

    // Store globally - include URL for PDF export
    window.currentPerformanceResults = { ...data, url: reportUrl };

    // Show results container
    results.classList.remove('hidden');
    resultsContent.innerHTML = '';

    // Determine mode from data if possible and display with error handling
    // Detection logic - check in order of specificity:
    // 1. Full (Lighthouse): has desktop.lighthouse or mobile.lighthouse with category scores
    // 2. CWV: has desktop/mobile with coreWebVitals but NO lighthouse scores
    // 3. Quick: has summary object with totalRequests etc.
    try {
      // Check for results wrapper (API returns { results: {...} })
      const results = data.results || data;

      // Check for Full/Lighthouse structure (lighthouse category scores)
      // Lighthouse data has desktop.lighthouse.performance, accessibility, etc.
      // Key differentiator: lighthouse object with category scores (performance, accessibility, bestPractices, seo)
      const hasLighthouseScores = (obj) => obj?.lighthouse && (
        typeof obj.lighthouse.performance === 'number' ||
        typeof obj.lighthouse.accessibility === 'number' ||
        typeof obj.lighthouse.bestPractices === 'number'
      );
      const hasLighthouseStructure = results.lighthouse ||
                                     hasLighthouseScores(results.desktop) ||
                                     hasLighthouseScores(results.mobile) ||
                                     // Fallback: performanceScore without coreWebVitals suggests Lighthouse
                                     ((results.desktop?.performanceScore !== undefined && !results.desktop?.coreWebVitals?.lcp) ||
                                      (results.mobile?.performanceScore !== undefined && !results.mobile?.coreWebVitals?.lcp));

      // Check for CWV-only structure (coreWebVitals but NO lighthouse scores)
      const hasCWVStructure = (results.desktop?.coreWebVitals || results.mobile?.coreWebVitals) ||
                              (results.cwv || results.lcp || results.cls || results.inp);

      // Route to appropriate display function
      // Lighthouse takes priority because it includes CWV data too
      if (hasLighthouseStructure) {
        console.log('[PerformanceHub] Detected Lighthouse/Full report structure');
        displayFullResults(data);
      } else if (hasCWVStructure) {
        console.log('[PerformanceHub] Detected CWV report structure');
        displayCWVResults(data);
      } else if (results.summary && typeof results.summary === 'object') {
        // Quick results have summary.totalRequests, etc.
        console.log('[PerformanceHub] Detected Quick scan structure');
        displayQuickResults(data);
      } else if (results.desktop || results.mobile) {
        // Fallback: if we have desktop/mobile but couldn't determine type, try CWV
        console.warn('[PerformanceHub] Could not determine report type, trying CWV display');
        displayCWVResults(data);
      } else {
        // Default to quick results as last resort
        console.warn('[PerformanceHub] Unknown data structure, defaulting to quick display');
        displayQuickResults(data);
      }
    } catch (renderError) {
      console.error('[PerformanceHub] Error rendering results:', renderError);
      displayError('Failed to render report. The data may be corrupted.', { error: renderError.message });
    }
  }

  // Check for stored report or auto-start scan
  (async function initFromUrlParams() {
    console.log('[PerformanceHub] initFromUrlParams starting', {
      reportIdParam,
      urlParam,
      hasReportStorage: !!window.ReportStorage,
      hasPuppeteerData: !!window.__PUPPETEER_INJECTED_DATA__
    });

    try {
    // PUPPETEER INJECTION CHECK: If data was injected directly, use it immediately
    if (window.__PUPPETEER_INJECTED_DATA__) {
      console.log('[PerformanceHub] Using Puppeteer-injected data');
      const injectedData = window.__PUPPETEER_INJECTED_DATA__;
      const injectedUrl = window.__PUPPETEER_ANALYZED_URL__ || '';

      // Set the URL input
      if (injectedUrl && urlInput) {
        urlInput.value = injectedUrl;
      }

      // Display the results immediately
      try {
        displayResults(injectedData);
        console.log('[PerformanceHub] Puppeteer-injected data displayed successfully');
        return; // Don't continue with normal init flow
      } catch (e) {
        console.error('[PerformanceHub] Failed to display Puppeteer-injected data:', e);
        // Fall through to normal flow
      }
    }

    const billingSuccess = params.get('billing_success') === 'true';

    // If we have a report_id, set it immediately so hasAccess checks work
    if (reportIdParam) {
      document.body.setAttribute('data-report-id', reportIdParam);
    }

    // If returning from billing, wait for billing return processing to complete
    // This ensures the purchase is verified before we try to display the report
    if (billingSuccess && !window.__smBillingReturnComplete) {
      console.log('[PerformanceHub] Waiting for billing return processing...');
      await new Promise((resolve) => {
        // Check if already complete
        if (window.__smBillingReturnComplete) {
          resolve();
          return;
        }
        // Wait for the event
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
      console.log('[PerformanceHub] Billing return processing complete');

      // CRITICAL: If report-ui.js already displayed results, don't re-display
      // This prevents clearing the screenshot card that was just added
      const resultsContent = document.getElementById('resultsContent');
      if (resultsContent && resultsContent.children.length > 0) {
        console.log('[PerformanceHub] Results already displayed by report-ui.js, skipping duplicate display');
        return;
      }
    }

    // If we have a report_id, try to load the stored report first
    // This handles both dashboard recall AND billing return
    console.log('[PerformanceHub] Checking report_id condition:', { reportIdParam, hasReportStorage: !!window.ReportStorage });
    if (reportIdParam && window.ReportStorage) {
      console.log('[PerformanceHub] Checking for stored report:', reportIdParam);

      // CRITICAL: Fetch billing status BEFORE displaying the report
      // Force refresh to ensure we have the latest purchase data (e.g., coming from dashboard)
      if (window.ProReportBlock?.fetchBillingStatus) {
        console.log('[PerformanceHub] Fetching billing status (force refresh for report recall)...');
        await window.ProReportBlock.fetchBillingStatus(true);
        console.log('[PerformanceHub] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportIdParam), 'for reportId:', reportIdParam);
      } else {
        console.log('[PerformanceHub] ProReportBlock.fetchBillingStatus not available');
      }

      // First try to get the stored report data to extract the URL
      console.log('[PerformanceHub] About to call ReportStorage.loadReport for:', reportIdParam);
      const stored = await window.ReportStorage.loadReport(reportIdParam);
      console.log('[PerformanceHub] ReportStorage.loadReport returned:', stored ? { hasData: !!stored.data, metadata: stored.metadata } : null);
      if (!stored) {
        console.warn('[PerformanceHub] No stored report found in database for:', reportIdParam);
      } else if (!stored.data) {
        console.warn('[PerformanceHub] Stored report has no data:', reportIdParam);
      }
      if (stored && stored.data) {
        // Validate stored data - must have expected structure for one of the modes
        const data = stored.data;
        const results = data.results || data;

        // CWV structure: has desktop/mobile with coreWebVitals, or top-level cwv/lcp/cls/inp
        const isValidCWV = data.desktop || data.mobile || data.cwv || data.lcp || data.cls || data.inp;

        // Lighthouse/Full structure: has lighthouse scores nested in desktop/mobile
        // Check both data.desktop.lighthouse and data.results.desktop.lighthouse patterns
        const hasLighthouseScores = (obj) => obj?.lighthouse && (
          typeof obj.lighthouse.performance === 'number' ||
          typeof obj.lighthouse.accessibility === 'number' ||
          typeof obj.lighthouse.bestPractices === 'number'
        );
        const isValidFull = data.lighthouse ||
                           hasLighthouseScores(data.desktop) ||
                           hasLighthouseScores(data.mobile) ||
                           hasLighthouseScores(results.desktop) ||
                           hasLighthouseScores(results.mobile);

        // Quick structure: has summary object with resource stats
        const isValidQuick = data.summary && typeof data.summary === 'object';
        const hasError = data.error || typeof data === 'string';

        console.log('[PerformanceHub] Data validation:', {
          isValidCWV,
          isValidFull,
          isValidQuick,
          hasError,
          hasDataDesktop: !!data.desktop,
          hasDataMobile: !!data.mobile,
          hasResultsDesktop: !!results?.desktop,
          hasResultsMobile: !!results?.mobile,
          hasDesktopLighthouse: !!data.desktop?.lighthouse || !!results?.desktop?.lighthouse,
          dataKeys: Object.keys(data).slice(0, 10),
          resultsKeys: results ? Object.keys(results).slice(0, 10) : null
        });

        if (hasError || (!isValidCWV && !isValidFull && !isValidQuick)) {
          console.warn('[PerformanceHub] Stored report has invalid data structure, ignoring:', {
            hasError,
            isValidCWV,
            isValidFull,
            isValidQuick,
            dataType: typeof data,
            dataKeys: typeof data === 'object' ? Object.keys(data).slice(0, 10) : null
          });
          // Clean URL to prevent reload loop with bad report
          const cleanParams = new URLSearchParams(window.location.search);
          cleanParams.delete('report_id');
          const cleanedUrl = `${window.location.pathname}${cleanParams.toString() ? `?${cleanParams.toString()}` : ''}`;
          window.history.replaceState({}, '', cleanedUrl);
          // Don't display invalid report, let user run a fresh scan
        } else {
          console.log('[PerformanceHub] Stored report validation passed, preparing to display');
          // Extract URL from stored report metadata or data
          const storedUrl = stored.metadata?.siteUrl || stored.data?.url || urlParam;
          console.log('[PerformanceHub] Using stored URL:', storedUrl);
          if (storedUrl) {
            urlInput.value = storedUrl;
          }

          // CRITICAL: Fetch billing status BEFORE displaying report
          // Force refresh to ensure we have the latest purchase data (e.g., coming from dashboard)
          if (window.ProReportBlock?.fetchBillingStatus) {
            console.log('[PerformanceHub] Fetching billing status for stored report recall...');
            await window.ProReportBlock.fetchBillingStatus(true);
            console.log('[PerformanceHub] Billing status fetched, hasAccess:',
              window.ProReportBlock.hasAccess(reportIdParam), 'for reportId:', reportIdParam);
          }

          // Set screenshot URL from stored data BEFORE displaying
          const storedScreenshotUrl = stored.data?.screenshotUrl || stored.data?.results?.screenshotUrl;
          if (storedScreenshotUrl) {
            document.body.setAttribute('data-sm-screenshot-url', storedScreenshotUrl);
            console.log('[PerformanceHub] Set screenshot URL for stored report:', storedScreenshotUrl);
          } else if (reportIdParam) {
            // Fallback: construct from report ID (screenshot file may exist on disk)
            const fallbackScreenshotUrl = `/reports/${encodeURIComponent(reportIdParam)}/screenshot.jpg`;
            document.body.setAttribute('data-sm-screenshot-url', fallbackScreenshotUrl);
            console.log('[PerformanceHub] Set fallback screenshot URL:', fallbackScreenshotUrl);
          }

          // Display the report with error handling
          try {
            console.log('[PerformanceHub] Calling displayResults with stored data');
            displayResults(stored.data);
            console.log('[PerformanceHub] displayResults completed successfully');
            window.ReportStorage.showStoredReportBanner?.(stored.metadata);
            // Clean URL after successful display so refresh doesn't reload stored report
            const cleanParams = new URLSearchParams(window.location.search);
            cleanParams.delete('report_id');
            const cleanedUrl = `${window.location.pathname}${cleanParams.toString() ? `?${cleanParams.toString()}` : ''}`;
            window.history.replaceState({}, '', cleanedUrl);
            console.log('[PerformanceHub] Report displayed successfully, returning');
            return; // Don't auto-scan - successful display
          } catch (displayError) {
            console.error('[PerformanceHub] Failed to display stored report:', displayError);
            // Clear any partial render
            resultsContent.innerHTML = '';
            results.classList.add('hidden');
            // Clean URL to prevent reload loop with bad report
            const cleanParams = new URLSearchParams(window.location.search);
            cleanParams.delete('report_id');
            const cleanedUrl = `${window.location.pathname}${cleanParams.toString() ? `?${cleanParams.toString()}` : ''}`;
            window.history.replaceState({}, '', cleanedUrl);
            // Continue to allow fresh scan
          }
        }
      }
    } else if (reportIdParam) {
      console.warn('[PerformanceHub] Report ID provided but no ReportStorage available or report not loaded');
    }

    // No stored report found - pre-fill URL but only auto-scan if explicitly requested
    console.log('[PerformanceHub] Reached end of initFromUrlParams, falling through to URL pre-fill', { urlParam, autoScan });
    if (urlParam) {
      urlInput.value = urlParam;
    }
    // Only auto-scan if explicitly requested with auto_scan=true
    if (autoScan) {
      runAnalysis();
    }
    } catch (initError) {
      console.error('[PerformanceHub] CRITICAL ERROR in initFromUrlParams:', initError);
      // Try to at least pre-fill the URL if we have one
      if (urlParam && urlInput) {
        urlInput.value = urlParam;
      }
    }
  })();

  // Initialize active tab from markup or default
  const initiallyActive = modeTabs.find(t => t.classList.contains('tabs__item--active'));
  if (initiallyActive && initiallyActive.dataset.mode) {
    currentMode = initiallyActive.dataset.mode;
  }
  setActiveTab(currentMode);
  updateModeIndicator();

  // Get analysis steps based on mode
  function getAnalysisSteps(mode) {
    switch (mode) {
      case 'quick':
        return [
          { label: 'Connecting to website', detail: 'Establishing connection...' },
          { label: 'Analyzing resources', detail: 'Scanning CSS, JS, images...' },
          { label: 'Calculating metrics', detail: 'Computing performance score...' }
        ];
      case 'full':
        return [
          { label: 'Initializing Lighthouse', detail: 'Preparing analysis engine...' },
          { label: 'Desktop analysis', detail: 'Running desktop performance audit...' },
          { label: 'Mobile analysis', detail: 'Running mobile performance audit...' },
          { label: 'Calculating scores', detail: 'Computing Lighthouse scores...' },
          { label: 'Generating report', detail: 'Compiling comprehensive results...' }
        ];
      case 'cwv':
        return [
          { label: 'Loading page', detail: 'Navigating to website...' },
          { label: 'Measuring LCP', detail: 'Largest Contentful Paint...' },
          { label: 'Measuring CLS', detail: 'Cumulative Layout Shift...' },
          { label: 'Measuring INP', detail: 'Interaction to Next Paint...' },
          { label: 'Calculating score', detail: 'Computing overall CWV grade...' }
        ];
      default:
        return [{ label: 'Analyzing', detail: 'Please wait...' }];
    }
  }

  // Get estimated time for each mode
  function getEstimatedTime(mode) {
    switch (mode) {
      case 'quick': return 10;
      case 'full': return 180;  // 3 minutes - Lighthouse can take 2+ minutes
      case 'cwv': return 30;
      default: return 15;
    }
  }

  // Get title for each mode
  function getLoaderTitle(mode) {
    switch (mode) {
      case 'quick': return 'Quick Scan';
      case 'full': return 'Full Lighthouse Analysis';
      case 'cwv': return 'Core Web Vitals';
      default: return 'Analyzing';
    }
  }

  async function runAnalysis() {
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please enter a valid URL');
      return;
    }

    // ALWAYS read mode from the active tab to ensure we have the correct mode
    const activeTab = document.querySelector('.tabs__item.tabs__item--active');
    if (activeTab && activeTab.dataset.mode) {
      currentMode = activeTab.dataset.mode;
      // Update the mode indicator to reflect the current mode
      updateModeIndicator();
    }

    // ==================== PAYMENT GATE CHECK ====================
    // Check if user can run this report (subscription or purchase required for non-free modes)
    const canRun = await checkCanRunReport(currentMode);
    if (!canRun) {
      console.log('[PerformanceHub] Payment required for mode:', currentMode);
      // Store URL for resuming after payment
      pendingAnalysisUrl = url;
      // Get report type for payment gate
      const reportType = currentMode === 'full' ? 'lighthouse' : currentMode;
      // Show payment gate modal
      showPaymentGate(reportType, url);
      return;
    }
    console.log('[PerformanceHub] Access granted, proceeding with analysis');
    // ==================== END PAYMENT GATE ====================

    // Show loading with AnalyzerLoader
    results.classList.remove('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    analyzeButton.disabled = true;
    buttonText.textContent = 'Analyzing...';

    // Remove any stored report banner from previous session
    const storedReportBanner = document.getElementById('sm-stored-report-banner');
    if (storedReportBanner) {
      storedReportBanner.remove();
    }

    // Initialize AnalyzerLoader
    loader = new AnalyzerLoader('loadingContainer');
    const steps = getAnalysisSteps(currentMode);
    const estimatedTime = getEstimatedTime(currentMode);
    const title = getLoaderTitle(currentMode);
    loader.start(steps, title, estimatedTime);

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
        ${currentMode === 'full' ? 'Full Lighthouse analysis in progress...' : 'Performance analysis in progress...'}
      </p>
      <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(var(--accent-primary-rgb), 0.7); padding: 0 0.5rem;">
        ${currentMode === 'full' ? 'This may take 60-90 seconds' : 'This may take 15-30 seconds'}
      </p>
    `;

    // Add color cycling animation
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
      `;
      document.head.appendChild(style);
    }

    // Insert patience message after loader content
    const analyzerLoading = document.querySelector('#loadingContainer .analyzer-loading');
    if (analyzerLoading) {
      analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
    }

    try {
      let data;

      // Deterministic scan timestamp for report identity
      const scanStartedAt = new Date().toISOString();
      window.SM_SCAN_STARTED_AT = scanStartedAt;
      document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

      // Deterministic analyzer key for this scan - specific to mode type
      const analyzerKey = currentMode === 'quick' ? 'speed-ux-quick' : currentMode === 'cwv' ? 'speed-ux-cwv' : 'speed-ux-full';
      window.SM_ANALYZER_KEY = analyzerKey;
      document.body.setAttribute('data-sm-analyzer-key', analyzerKey);

      // Deterministic reportId for paywall / exports
      // Priority: body attribute > URL params > computed
      const urlParams = new URLSearchParams(window.location.search);
      const reportId =
        document.body.getAttribute('data-report-id') ||
        urlParams.get('report_id') || urlParams.get('reportId') ||
        (window.ReportUI && typeof window.ReportUI.makeReportId === 'function'
          ? window.ReportUI.makeReportId({ analyzerKey, normalizedUrl: url, startedAtISO: scanStartedAt })
          : window.ReportUI && typeof window.ReportUI.computeReportId === 'function'
          ? window.ReportUI.computeReportId(url, scanStartedAt, analyzerKey)
          : '');
      if (reportId) document.body.setAttribute('data-report-id', reportId);

      // CRITICAL: Fetch billing status BEFORE displaying results
      // This ensures ProReportBlock.hasAccess() returns the correct value
      if (window.ProReportBlock?.fetchBillingStatus) {
        console.log('[PerformanceHub] Fetching billing status before display...');
        await window.ProReportBlock.fetchBillingStatus(false); // Don't force refresh, use cache if available
      }

      switch (currentMode) {
        case 'quick':
          data = await runQuickScan(url, scanStartedAt);
          displayQuickResults(data);
          break;
        case 'full':
          data = await runFullAnalysis(url, scanStartedAt);
          displayFullResults(data);
          break;
        case 'cwv':
          data = await runCWVAnalysis(url, scanStartedAt);
          displayCWVResults(data);
          break;
      }

      // Extract and set screenshot URL from API response
      const screenshotUrl = data?.screenshotUrl || data?.results?.screenshotUrl;
      if (screenshotUrl) {
        document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
        console.log('[PerformanceHub] Set screenshot URL:', screenshotUrl);
      }

      // Update report ID from API response if available (more accurate than computed)
      const apiReportId = data?.reportId || data?.results?.reportId;
      if (apiReportId) {
        document.body.setAttribute('data-report-id', apiReportId);
        console.log('[PerformanceHub] Updated report ID from API:', apiReportId);
      }

      // Store the results globally for potential auto-save
      // Include URL for PDF export and other utilities
      window.currentPerformanceResults = { ...data, url };
      console.log('[PerformanceHub] Stored results globally:', {
        mode: currentMode,
        analyzerKey,
        reportId,
        hasData: !!data,
        dataKeys: data ? Object.keys(data).slice(0, 10) : [],
        hasDesktop: !!data?.desktop,
        hasLighthouse: !!data?.desktop?.lighthouse || !!data?.results?.desktop?.lighthouse
      });

      // Auto-save report snapshot if user has access (Pro or purchased)
      if (reportId && data && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
        console.log('[PerformanceHub] Calling autoSaveIfEligible for:', { reportId, analyzerKey });
        window.ReportStorage.autoSaveIfEligible(reportId, data, {
          siteUrl: url,
          analyzerType: analyzerKey,
          scannedAt: scanStartedAt
        });
      } else {
        console.log('[PerformanceHub] Skipping auto-save:', {
          hasReportId: !!reportId,
          hasData: !!data,
          hasReportStorage: !!window.ReportStorage,
          hasAutoSave: typeof window.ReportStorage?.autoSaveIfEligible === 'function'
        });
      }

    } catch (error) {
      showError(error.message);
    } finally {
      analyzeButton.disabled = false;
      buttonText.textContent = 'Analyze';
      if (loader) {
        loader.complete();
      }
    }
  }

  // Quick Scan Mode
  async function runQuickScan(url, scanStartedAt) {
    if (loader) loader.nextStep(0);

    const response = await fetch('/api/performance-snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, scanStartedAt, analyzerKey: window.SM_ANALYZER_KEY })
    });

    if (loader) loader.nextStep(1);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Quick scan failed');
    }

    const data = await response.json();
    if (loader) loader.nextStep(2);
    
    return data;
  }

  // Full Lighthouse Analysis
  async function runFullAnalysis(url, scanStartedAt) {
    if (loader) loader.nextStep(0);

    // Create abort controller with 5 minute timeout for Lighthouse
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

    try {
      const response = await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, scanStartedAt, analyzerKey: window.SM_ANALYZER_KEY }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (loader) loader.nextStep(3);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Full analysis failed');
      }

      const data = await response.json();
      if (loader) loader.nextStep(4);
      
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Analysis timed out after 5 minutes. The website may be too slow or complex. Try Quick scan instead.');
      }
      throw err;
    }
  }

  // Core Web Vitals Analysis
  async function runCWVAnalysis(url, scanStartedAt) {
    if (loader) loader.nextStep(0);

    const response = await fetch('/api/core-web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, scanStartedAt, analyzerKey: window.SM_ANALYZER_KEY })
    });

    if (loader) loader.nextStep(3);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'CWV analysis failed');
    }

    const data = await response.json();
    if (loader) loader.nextStep(4);
    
    return data;
  }

  /**
   * Create a report header with color-coded section and mode indicator
   */
  function createReportHeader(mode, url) {
    const modeConfig = {
      'quick': {
        title: 'Speed & UX Report: Quick Scan',
        icon: '⚡',
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: '#3b82f6'
      },
      'full': {
        title: 'Speed & UX Report: Lighthouse Audit',
        icon: '🔍',
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.1)',
        borderColor: '#8b5cf6'
      },
      'cwv': {
        title: 'Speed & UX Report: Core Web Vitals',
        icon: '📊',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: '#10b981'
      }
    };

    const config = modeConfig[mode] || modeConfig.quick;

    return `
      <div class="report-header" style="
        background: ${config.bgColor};
        border: 2px solid ${config.borderColor};
        border-radius: 12px;
        padding: 1.5rem 2rem;
        margin-bottom: 2rem;
        animation: slideInFromTop 0.5s ease-out;
      ">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <span style="font-size: 2.5rem; line-height: 1;">${config.icon}</span>
            <div>
              <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700; color: ${config.color};">
                ${config.title}
              </h2>
              <p style="margin: 0.25rem 0 0 0; color: rgba(255,255,255,0.7); font-size: 0.9rem;">
                <strong style="color: ${config.color};">URL:</strong> ${url}
              </p>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="
              background: rgba(0,0,0,0.3);
              border: 1px solid ${config.borderColor};
              border-radius: 8px;
              padding: 0.5rem 1rem;
              font-size: 0.85rem;
              color: rgba(255,255,255,0.9);
            ">
              <strong style="color: ${config.color};">Generated:</strong> ${new Date().toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Smooth scroll to results with fade-in animation
   */
  function scrollToResults() {
    // Wait for DOM to update
    setTimeout(() => {
      const resultsElement = document.getElementById('results');
      if (resultsElement) {
        // Fade in animation
        resultsContent.style.opacity = '0';
        resultsContent.style.transform = 'translateY(20px)';
        resultsContent.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';

        // Smooth scroll
        resultsElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        // Trigger fade-in after scroll starts
        setTimeout(() => {
          resultsContent.style.opacity = '1';
          resultsContent.style.transform = 'translateY(0)';
        }, 200);
      }
    }, 100);
  }

  // Display Error
  function displayError(message, details = null) {
    // Check if it's a timeout error and add helpful suggestions
    const isTimeout = message.includes('too long to load') || message.includes('timeout');
    const suggestions = isTimeout ? `
      <div style="margin-top: 1.5rem; text-align: left; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 1rem;">
        <h4 style="color: #60a5fa; margin: 0 0 0.75rem 0; font-size: 0.9rem;">💡 Suggestions:</h4>
        <ul style="color: #93c5fd; margin: 0; padding-left: 1.5rem; font-size: 0.85rem; line-height: 1.6;">
          <li>Wait a few moments and try again</li>
          <li>Test a specific page instead of the homepage</li>
          <li>Check if the website is accessible in your browser</li>
          <li>The site may be experiencing high traffic or server issues</li>
        </ul>
      </div>
    ` : '';

    const html = `
      <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.05)); border: 2px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 2rem; margin: 2rem 0; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
        <h2 style="color: #ef4444; margin: 0 0 1rem 0;">Analysis Failed</h2>
        <p style="color: #fca5a5; margin: 0 0 1rem 0; font-size: 1.1rem;">${message}</p>
        ${suggestions}
        ${details ? `
          <details style="margin-top: 1.5rem; text-align: left; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
            <summary style="cursor: pointer; color: #fca5a5; font-weight: 600; margin-bottom: 0.5rem;">Technical Details</summary>
            <pre style="color: #fca5a5; font-size: 0.85rem; margin: 0.5rem 0 0 0; overflow-x: auto;">${JSON.stringify(details, null, 2)}</pre>
          </details>
        ` : ''}
        <button onclick="location.reload()" style="margin-top: 1.5rem; background: #ef4444; border: none; color: #fff; padding: 0.75rem 2rem; border-radius: 8px; cursor: pointer; font-weight: 600;">
          Try Again
        </button>
      </div>
    `;
    resultsContent.innerHTML = html;
    results.style.display = 'block';
    hidePdfExportButton();
  }

  // Display Quick Scan Results
  function displayQuickResults(data) {
    // Check if data has errors
    if (!data || data.error) {
      displayError(data?.error || 'Failed to analyze performance', data?.details);
      return;
    }

    const summary = data.summary || {};
    const resources = data.resources || {};
    const recommendations = data.recommendations || {};
    const issues = data.issues || [];
    const url = urlInput.value;

    // Log for debugging

    // Calculate metric ratings
    const requestsRating = summary.totalRequests <= 50 ? 'good' : summary.totalRequests <= 100 ? 'average' : 'poor';
    const weightRating = summary.estimatedPageWeightKB <= 1000 ? 'good' : summary.estimatedPageWeightKB <= 3000 ? 'average' : 'poor';
    const blockingRating = summary.renderBlockingCount <= 3 ? 'good' : summary.renderBlockingCount <= 5 ? 'average' : 'poor';
    const responseRating = summary.serverResponseTime <= 500 ? 'good' : summary.serverResponseTime <= 1000 ? 'average' : 'poor';

    const generatedAt = new Date().toLocaleString();
    const ratingColor = (rating) => {
      if (rating === 'good') return '#22c55e';
      if (rating === 'average') return '#f59e0b';
      return '#ef4444';
    };

    const quickScore = normalizeScore(data.performanceScore) ?? computeQuickScoreFromSummary(summary, issues);
    const summaryDonuts = ReportShell.renderSummaryDonuts([
      { label: 'Quick Score', score: quickScore }
    ]);

    const metrics = [
      { label: 'Requests', value: summary.totalRequests ?? '—', color: ratingColor(requestsRating) },
      { label: 'Page Weight', value: formatKB(summary.estimatedPageWeightKB), color: ratingColor(weightRating) },
      { label: 'Blocking', value: summary.renderBlockingCount ?? 0, color: ratingColor(blockingRating) },
      { label: 'Response', value: `${summary.serverResponseTime || 0}ms`, color: ratingColor(responseRating) }
    ];

    const metricsSection = `
      <div class="report-shell__card">
        <div class="report-shell__metric-grid">
          ${metrics.map(m => `
            <div class="metric-card" style="background: var(--bg-tertiary, #1a1a1a); border: 1px solid var(--border-primary, rgba(255,255,255,0.1)); border-radius: 12px; padding: 1.25rem;">
              <div style="font-weight: 700; color: #00ff41; margin-bottom: 0.75rem; font-size: 1.05rem;">${m.label}</div>
              <div style="text-align: center; padding: 0.75rem; background: var(--bg-secondary, #111); border-radius: 8px; color: ${m.color}; font-weight: 700; font-size: 1.25rem;">${m.value}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const issuesContent = recommendations.likelyCauses && recommendations.likelyCauses.length > 0
      ? `
        <div class="report-shell__card">
          ${createInfoBox('error', 'Likely Performance Issues', `
            <ul style="margin: 0; padding-left: 1.5rem; display: grid; gap: 0.5rem;">
              ${recommendations.likelyCauses.map(cause => `<li>${cause}</li>`).join('')}
            </ul>
          `, '🔍')}
        </div>
      `
      : `
        <div class="report-shell__card">
          ${createInfoBox('success', 'No Major Issues Detected', 'Your page resources appear to be well-optimized.', '✓')}
        </div>
      `;

    const resourcesContent = `
      <div class="report-shell__card">
        ${renderResourceAccordions(resources)}
      </div>
    `;

    const scoreNote = quickScore === null
      ? `<div class="report-shell__card">${createInfoBox('info', 'Score unavailable', 'We couldn\'t compute a score from this scan, but the metrics and issues below are still actionable.', 'ℹ️')}</div>`
      : '';

    const accordions = [
      ReportAccordion.createSection({ id: 'quick-metrics', title: 'Key Performance Metrics', scoreTextRight: formatScoreText(quickScore), contentHTML: metricsSection }),
      ReportAccordion.createSection({ id: 'quick-issues', title: 'Likely Performance Issues', scoreTextRight: null, contentHTML: issuesContent }),
      ReportAccordion.createSection({ id: 'quick-resources', title: 'Resource Breakdown', scoreTextRight: null, contentHTML: resourcesContent })
    ].join('');

    const html = `
      ${ReportShell.renderReportHeader({ title: 'Speed & UX Report: Quick Scan', url, timestamp: generatedAt, badgeText: 'Quick Scan', mode: 'quick' })}
      ${summaryDonuts}
      ${scoreNote}
      ${accordions}
    `;

    // Count all issues: explicit issues + likely causes
    const quickIssuesCount =
      (issues?.length || 0) +
      (recommendations.likelyCauses?.length || 0);

    const summaryStats = calculatePerformanceSummary({
      mode: 'quick',
      issues: quickIssuesCount,
      recommendations: recommendations.recommendations?.length || 0,
      checks: countQuickChecks(summary)
    });

    const fullHtml = `
      ${html}
      ${renderPerformanceSummarySection(summaryStats)}
      ${renderPerformanceTakeActionSection(url, 'quick')}
    `;

    resultsContent.innerHTML = `<div class="report-scope">${fullHtml}</div>`;
    window.currentPerformanceHubResults = { mode: 'quick', url, data };
    ReportAccordion.initInteractions();
    showPdfExportButton();
    animateScoreRings();
    scrollToResults();

    if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
      const reportId = document.body.getAttribute('data-report-id') || '';
      if (reportId) window.CreditsManager.renderPaywallState(reportId);
    }
  }

  // Display Full Lighthouse Results
  function displayFullResults(data) {
    // API returns { success, results, requestId } - extract results
    const results = data.results || data;
    const desktopRaw = results.desktop || {};
    const mobileRaw = results.mobile || {};
    // Normalize CWV data for consistent rendering
    const desktop = normalizeCWVDevice(desktopRaw);
    const mobile = normalizeCWVDevice(mobileRaw);
    // Network data is at results level, not per-device
    const network = results.network || {};
    const url = urlInput.value;
    const desktopPerf = normalizeScore(desktop?.lighthouse?.performance ?? desktop.performanceScore);
    const mobilePerf = normalizeScore(mobile?.lighthouse?.performance ?? mobile.performanceScore);
    const perfValues = [desktopPerf, mobilePerf].filter(v => typeof v === 'number' && v > 0);
    const overallPerf = perfValues.length ? Math.round(perfValues.reduce((a, b) => a + b, 0) / perfValues.length) : null;
    const generatedAt = new Date().toLocaleString();
    const summaryDonuts = ReportShell.renderSummaryDonuts([
      { label: 'Performance', score: averageScore(desktopPerf, mobilePerf) },
      { label: 'Accessibility', score: averageScore(desktop?.lighthouse?.accessibility, mobile?.lighthouse?.accessibility) },
      { label: 'Best Practices', score: averageScore(desktop?.lighthouse?.bestPractices, mobile?.lighthouse?.bestPractices) },
      { label: 'SEO', score: averageScore(desktop?.lighthouse?.seo, mobile?.lighthouse?.seo) }
    ]);

    const performanceMetricsContent = renderPerformanceMetricsSection(desktop, mobile, network);
    const cwvContent = renderCoreWebVitalsSection(desktop, mobile);
    const categoryScoresContent = renderCategoryScoresSection(desktop, mobile);
    const opportunitiesContent = renderOpportunitiesSection(results);
    const diagnosticsContent = renderDiagnosticsSection(results);
    const resourcesContent = renderResourceBreakdownSection(results);
    const additionalChecksContent = renderAdditionalChecksSection(results);

    // Count opportunities (performance improvements needed)
    const opportunitiesCount =
      (desktop.opportunities?.length || 0) +
      (mobile.opportunities?.length || 0) +
      (Array.isArray(results.opportunities) ? results.opportunities.length : 0);

    // Count recommendations
    const recommendationsCount =
      (desktop.recommendations?.length || 0) +
      (mobile.recommendations?.length || 0) +
      (Array.isArray(results.recommendations) ? results.recommendations.length : 0);

    // Count diagnostics
    const diagnosticsCount =
      (desktop.diagnostics?.length || 0) +
      (mobile.diagnostics?.length || 0) +
      (Array.isArray(results.diagnostics) ? results.diagnostics.length : 0);

    // Count category-specific issues (accessibility, best practices, SEO)
    const categoryIssuesCount =
      (desktop.accessibilityDetails?.issues?.length || 0) +
      (desktop.bestPracticesDetails?.issues?.length || 0) +
      (desktop.seoDetails?.issues?.length || 0) +
      (mobile.accessibilityDetails?.issues?.length || 0) +
      (mobile.bestPracticesDetails?.issues?.length || 0) +
      (mobile.seoDetails?.issues?.length || 0);

    // Total issues = opportunities + recommendations + diagnostics + category issues
    // These all represent actionable items that need attention
    const issuesCount = opportunitiesCount + recommendationsCount + diagnosticsCount + categoryIssuesCount;

    const proLocked = !userHasPro();
    const topLevelRecs = Array.isArray(results.recommendations) ? results.recommendations : [];
    const topLevelOpps = Array.isArray(results.opportunities) ? results.opportunities : [];
    const desktopForFixes = topLevelRecs.length || topLevelOpps.length
      ? {
          ...desktop,
          recommendations: [...(desktop.recommendations || []), ...topLevelRecs],
          opportunities: [...(desktop.opportunities || []), ...topLevelOpps]
        }
      : desktop;
    const mobileForFixes = {
      ...mobile,
      opportunities: mobile.opportunities || []
    };
    const proContent = `
      ${renderFreeFixBullets(desktopForFixes, mobileForFixes)}
      ${renderFixesToMake(desktopForFixes, mobileForFixes)}
      <div style="margin-top: 1.5rem;">
        <h4 style="margin: 0 0 0.75rem 0;">Opportunities</h4>
        ${opportunitiesContent}
      </div>
      ${proLocked ? renderLockedProPreview('Paid report available', ['Client-ready exports', 'Share link', 'Fix code + recommendations']) : ''}
    `;

    const accordions = [
      ReportAccordion.createSection({ id: 'lh-category-scores', title: 'Category Scores', scoreTextRight: formatScoreText(overallPerf), contentHTML: categoryScoresContent }),
      ReportAccordion.createSection({ id: 'lh-performance-metrics', title: 'Performance Metrics', scoreTextRight: formatScoreText(overallPerf), contentHTML: performanceMetricsContent }),
      ReportAccordion.createSection({ id: 'lh-cwv', title: 'Core Web Vitals', scoreTextRight: formatScoreText(overallPerf), contentHTML: cwvContent }),
      ReportAccordion.createSection({ id: 'lh-resources', title: 'Resource Breakdown', scoreTextRight: null, contentHTML: resourcesContent }),
      ReportAccordion.createSection({ id: 'lh-fixes', title: 'Fix Code + Recommendations', scoreTextRight: null, isPro: true, locked: proLocked, contentHTML: proContent })
    ].join('');

    const summaryStats = calculatePerformanceSummary({
      mode: 'full',
      issues: issuesCount,
      recommendations: recommendationsCount,
      checks: countLighthouseChecks(desktop, mobile)
    });

    const html = `
      ${ReportShell.renderReportHeader({ title: 'Speed & UX Report: Lighthouse Audit', url, timestamp: generatedAt, badgeText: 'Lighthouse', mode: 'full' })}
      ${summaryDonuts}
      ${accordions}
      ${renderPerformanceSummarySection(summaryStats)}
      ${renderPerformanceTakeActionSection(url, 'full')}
    `;

    resultsContent.innerHTML = `<div class="report-scope">${html}</div>`;
    window.currentPerformanceHubResults = { mode: 'full', url, data: results };
    ReportAccordion.initInteractions();
    showPdfExportButton();
    animateScoreRings();
    scrollToResults();

    if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
      const reportId = document.body.getAttribute('data-report-id') || '';
      if (reportId) window.CreditsManager.renderPaywallState(reportId);
    }
  }

  // NOTE: renderFixesToMake() is now defined in performance-fixes-renderer.js
  // The new implementation provides tabbed accordions with detailed code examples
  // and step-by-step fix guides (Option 3 from design proposals)

  function renderFreeFixBullets(desktop, mobile) {
    const recs = [...(desktop.recommendations || []), ...(mobile.recommendations || [])];
    const opps = [...(desktop.opportunities || []), ...(mobile.opportunities || [])];
    const fallback = recs.length ? recs : opps;
    if (!fallback.length) {
      return `
        <div style="margin-bottom: 1rem; color: var(--text-muted, #9ca3af); font-size: 0.95rem;">
          No specific fixes detected. Keep monitoring for changes after code deployments.
        </div>
      `;
    }

    const top = fallback.slice(0, 3);
    return `
      <div style="margin-bottom: 1rem;">
        <div style="color: var(--text-primary, #fff); font-weight: 700; margin-bottom: 0.5rem;">Quick fixes you can start now:</div>
        <ul style="margin: 0; padding-left: 1.1rem; color: var(--text-secondary, #e5e7eb); line-height: 1.6;">
          ${top.map(item => `<li>${item.title || item.recommendation || item.name || item}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function averageScore(a, b) {
    const valid = [a, b].filter(v => typeof v === 'number' && !Number.isNaN(v));
    if (!valid.length) return null;
    return Math.round(valid.reduce((x, y) => x + y, 0) / valid.length);
  }

  function averageScores(values = []) {
    const valid = (values || []).filter(v => typeof v === 'number' && !Number.isNaN(v));
    if (!valid.length) return null;
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  }

  function normalizeScore(raw) {
    if (raw === null || raw === undefined) return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function computeQuickScoreFromSummary(summary = {}, issues = []) {
    const totalRequests = Number(summary.totalRequests);
    const pageWeight = Number(summary.estimatedPageWeightKB);
    const renderBlockingCount = Number(summary.renderBlockingCount);
    const serverResponseTime = Number(summary.serverResponseTime);

    const hasAny =
      Number.isFinite(totalRequests) ||
      Number.isFinite(pageWeight) ||
      Number.isFinite(renderBlockingCount) ||
      Number.isFinite(serverResponseTime);
    if (!hasAny) return null;

    let score = 100;

    if (Number.isFinite(serverResponseTime) && serverResponseTime > 1000) {
      score -= Math.min(15, (serverResponseTime - 1000) / 500);
    }

    if (Number.isFinite(renderBlockingCount)) {
      const n = Math.max(0, renderBlockingCount);
      if (n > 3) score -= Math.min(20, Math.log2(n) * 3);
    }

    if (Number.isFinite(totalRequests) && totalRequests > 100) {
      score -= Math.min(15, (totalRequests - 100) / 30);
    }

    if (Number.isFinite(pageWeight) && pageWeight > 2000) {
      score -= Math.min(15, (pageWeight - 2000) / 500);
    }

    const highIssues = Array.isArray(issues) ? issues.filter(i => i && i.severity === 'high').length : 0;
    score -= Math.min(15, highIssues * 5);

    if (Number.isFinite(totalRequests) && totalRequests > 0) {
      score = Math.max(10, score);
    }

    if (!Number.isFinite(score)) return null;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function formatScoreText(score) {
    if (score === null || score === undefined || Number.isNaN(score)) return '—';
    return `${score}/100`;
  }

  function valueOrDash(val) {
    return val !== undefined && val !== null && val !== '' ? val : '—';
  }

  // Helper to get score color
  function getScoreColor(score) {
    if (typeof score !== 'number' || Number.isNaN(score)) return '#9ca3af';
    if (score >= 90) return '#22c55e';  // Green - excellent
    if (score >= 70) return '#f59e0b';  // Orange - needs improvement
    return '#ef4444';                   // Red - poor
  }

  // Helper to render a score bar with color
  function renderScoreBar(label, score, showValue = true) {
    const numScore = typeof score === 'number' ? score : 0;
    const color = getScoreColor(numScore);
    const width = Math.max(5, numScore);
    return `
      <div class="report-shell__bar-row">
        <span class="report-shell__bar-label" style="min-width: 100px;">${label}</span>
        <div class="report-shell__bar-track">
          <div class="report-shell__bar-fill" style="width:${width}%; background:${color};"></div>
        </div>
        ${showValue ? `<span class="report-shell__bar-value" style="color:${color}; min-width: 50px; text-align: right;">${numScore > 0 ? numScore : '—'}</span>` : ''}
      </div>
    `;
  }

  function renderPerformanceMetricsSection(desktop, mobile, network = {}) {
    const d = desktop.coreWebVitals || {};
    const m = mobile.coreWebVitals || {};
    // Network data comes from results.network (top-level), use for both desktop/mobile display
    const ttfbValue = network.ttfb || d.ttfb || m.ttfb || null;
    const domInteractiveValue = network.domInteractive || null;
    const entries = [
      { label: 'LCP', d: formatMsCompact(d.lcpMs), m: formatMsCompact(m.lcpMs), dVal: d.lcpMs, mVal: m.lcpMs, thresholds: { good: 2500, poor: 4000 }, max: 6000 },
      { label: 'CLS', d: formatCls(d.clsNum), m: formatCls(m.clsNum), dVal: d.clsNum, mVal: m.clsNum, thresholds: { good: 0.1, poor: 0.25 }, max: 0.5, isCls: true },
      { label: 'TBT/FID', d: formatMsCompact(d.inpMs || d.fidMs), m: formatMsCompact(m.inpMs || m.fidMs), dVal: d.inpMs || d.fidMs, mVal: m.inpMs || m.fidMs, thresholds: { good: 200, poor: 500 }, max: 800 },
      { label: 'FCP', d: formatMsCompact(d.fcpMs), m: formatMsCompact(m.fcpMs), dVal: d.fcpMs, mVal: m.fcpMs, thresholds: { good: 1800, poor: 3000 }, max: 5000 },
      { label: 'TTFB', d: valueOrDash(ttfbValue), m: '—', single: true },
      { label: 'DOM Interactive', d: valueOrDash(domInteractiveValue), m: '—', single: true }
    ];

    // Build performance bar chart for core metrics
    const chartMetrics = entries.filter(e => e.thresholds);
    const chartHtml = `
      <div style="margin-bottom: 1.5rem;">
        <div style="font-weight: 700; color: #00ff41; margin-bottom: 0.75rem;">Performance Metrics</div>
        ${chartMetrics.map(e => {
          const worst = Math.max(e.dVal || 0, e.mVal || 0);
          const getColor = (val) => {
            if (val === null || val === undefined) return '#9ca3af';
            if (val <= e.thresholds.good) return '#22c55e';
            if (val <= e.thresholds.poor) return '#f59e0b';
            return '#ef4444';
          };
          const color = getColor(worst);
          const width = Math.min(100, Math.max(5, (worst / e.max) * 100));
          const display = e.isCls ? formatCls(worst) : formatMsCompact(worst);
          return `
            <div class="report-shell__bar-row" style="margin-bottom: 0.5rem;">
              <span class="report-shell__bar-label" style="min-width: 80px;">${e.label}</span>
              <div class="report-shell__bar-track">
                <div class="report-shell__bar-fill" style="width:${width}%; background:${color};"></div>
              </div>
              <span class="report-shell__bar-value" style="color:${color}; min-width: 60px; text-align: right;">${display}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    return `
      <div class="report-shell__card">
        ${chartHtml}
        <div class="report-shell__metric-grid">
          ${entries.map(entry => {
            const dColor = entry.thresholds ? (entry.dVal <= entry.thresholds.good ? '#22c55e' : entry.dVal <= entry.thresholds.poor ? '#f59e0b' : '#ef4444') : 'var(--text-primary, #fff)';
            const mColor = entry.thresholds ? (entry.mVal <= entry.thresholds.good ? '#22c55e' : entry.mVal <= entry.thresholds.poor ? '#f59e0b' : '#ef4444') : 'var(--text-primary, #fff)';
            
            // For single-value metrics (TTFB, DOM Interactive), show centered value
            if (entry.single) {
              return `
              <div class="metric-card" style="background: var(--bg-tertiary, #1a1a1a); border: 1px solid var(--border-primary, rgba(255,255,255,0.1)); border-radius: 12px; padding: 1.25rem;">
                <div style="font-weight: 700; color: #00ff41; margin-bottom: 0.75rem; font-size: 1.1rem;">${entry.label}</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary, #fff); text-align: center; padding: 0.5rem; background: var(--bg-secondary, #111); border-radius: 8px;">${entry.d}</div>
              </div>
              `;
            }
            
            return `
            <div class="metric-card" style="background: var(--bg-tertiary, #1a1a1a); border: 1px solid var(--border-primary, rgba(255,255,255,0.1)); border-radius: 12px; padding: 1.25rem;">
              <div style="font-weight: 700; color: #00ff41; margin-bottom: 1rem; font-size: 1.1rem;">${entry.label}</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="text-align: center; padding: 0.75rem; background: var(--bg-secondary, #111); border-radius: 8px;">
                  <div style="color: var(--text-muted, #9ca3af); font-size: 0.8rem; margin-bottom: 0.35rem;">Desktop</div>
                  <div style="color: ${dColor}; font-weight: 700; font-size: 1.25rem;">${entry.d}</div>
                </div>
                <div style="text-align: center; padding: 0.75rem; background: var(--bg-secondary, #111); border-radius: 8px;">
                  <div style="color: var(--text-muted, #9ca3af); font-size: 0.8rem; margin-bottom: 0.35rem;">Mobile</div>
                  <div style="color: ${mColor}; font-weight: 700; font-size: 1.25rem;">${entry.m}</div>
                </div>
              </div>
            </div>
          `}).join('')}
        </div>
      </div>
    `;
  }

  function renderCategoryScoresSection(desktop, mobile) {
    const d = desktop.lighthouse || {};
    const m = mobile.lighthouse || {};
    const entries = [
      { label: 'Performance', d: d.performance, m: m.performance },
      { label: 'Accessibility', d: d.accessibility, m: m.accessibility },
      { label: 'Best Practices', d: d.bestPractices, m: m.bestPractices },
      { label: 'SEO', d: d.seo, m: m.seo }
    ];
    
    // Build bar chart
    const chartHtml = `
      <div style="margin-bottom: 1.5rem;">
        <div style="font-weight: 700; color: #00ff41; margin-bottom: 0.75rem;">Score Comparison</div>
        ${entries.map(e => {
          const avg = averageScore(e.d, e.m) || 0;
          const color = getScoreColor(avg);
          return `
            <div class="report-shell__bar-row" style="margin-bottom: 0.5rem;">
              <span class="report-shell__bar-label" style="min-width: 110px;">${e.label}</span>
              <div class="report-shell__bar-track">
                <div class="report-shell__bar-fill" style="width:${avg}%; background:${color};"></div>
              </div>
              <span class="report-shell__bar-value" style="color:${color}; min-width: 50px; text-align: right;">${avg || '—'}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
    return `
      <div class="report-shell__card">
        ${chartHtml}
        <div class="report-shell__metric-grid">
          ${entries.map(e => {
            const dColor = getScoreColor(e.d);
            const mColor = getScoreColor(e.m);
            return `
            <div class="metric-card" style="background: var(--bg-tertiary, #1a1a1a); border: 1px solid var(--border-primary, rgba(255,255,255,0.1)); border-radius: 12px; padding: 1.25rem;">
              <div style="font-weight: 700; color: #00ff41; margin-bottom: 1rem; font-size: 1.1rem;">${e.label}</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="text-align: center; padding: 0.75rem; background: var(--bg-secondary, #111); border-radius: 8px;">
                  <div style="color: var(--text-muted, #9ca3af); font-size: 0.8rem; margin-bottom: 0.35rem;">Desktop</div>
                  <div style="color: ${dColor}; font-weight: 700; font-size: 1.25rem;">${valueOrDash(e.d)}</div>
                </div>
                <div style="text-align: center; padding: 0.75rem; background: var(--bg-secondary, #111); border-radius: 8px;">
                  <div style="color: var(--text-muted, #9ca3af); font-size: 0.8rem; margin-bottom: 0.35rem;">Mobile</div>
                  <div style="color: ${mColor}; font-weight: 700; font-size: 1.25rem;">${valueOrDash(e.m)}</div>
                </div>
              </div>
            </div>
          `}).join('')}
        </div>
      </div>
    `;
  }

  function renderCoreWebVitalsSection(desktop, mobile) {
    const d = desktop.coreWebVitals || {};
    const m = mobile.coreWebVitals || {};
    const items = [
      { label: 'LCP', d: formatMsCompact(d.lcpMs), m: formatMsCompact(m.lcpMs), target: '≤ 2.5s', dVal: d.lcpMs, mVal: m.lcpMs, thresholds: { good: 2500, poor: 4000 }, max: 6000 },
      { label: 'CLS', d: formatCls(d.clsNum), m: formatCls(m.clsNum), target: '≤ 0.1', dVal: d.clsNum, mVal: m.clsNum, thresholds: { good: 0.1, poor: 0.25 }, max: 0.5, isCls: true },
      { label: 'INP/TBT', d: formatMsCompact(d.inpMs || d.fidMs), m: formatMsCompact(m.inpMs || m.fidMs), target: '≤ 200ms', dVal: d.inpMs || d.fidMs, mVal: m.inpMs || m.fidMs, thresholds: { good: 200, poor: 500 }, max: 800 },
      { label: 'FCP', d: formatMsCompact(d.fcpMs), m: formatMsCompact(m.fcpMs), target: '≤ 1.8s', dVal: d.fcpMs, mVal: m.fcpMs, thresholds: { good: 1800, poor: 3000 }, max: 5000 }
    ];
    
    // Build CWV bar chart
    const chartHtml = `
      <div style="margin-bottom: 1.5rem;">
        <div style="font-weight: 700; color: #00ff41; margin-bottom: 0.75rem;">Core Web Vitals Overview</div>
        ${items.map(item => {
          const worst = Math.max(item.dVal || 0, item.mVal || 0);
          const getColor = (val) => {
            if (val === null || val === undefined) return '#9ca3af';
            if (val <= item.thresholds.good) return '#22c55e';
            if (val <= item.thresholds.poor) return '#f59e0b';
            return '#ef4444';
          };
          const color = getColor(worst);
          const width = Math.min(100, Math.max(5, (worst / item.max) * 100));
          const display = item.isCls ? formatCls(worst) : formatMsCompact(worst);
          return `
            <div class="report-shell__bar-row" style="margin-bottom: 0.5rem;">
              <span class="report-shell__bar-label" style="min-width: 80px;">${item.label}</span>
              <div class="report-shell__bar-track">
                <div class="report-shell__bar-fill" style="width:${width}%; background:${color};"></div>
              </div>
              <span class="report-shell__bar-value" style="color:${color}; min-width: 60px; text-align: right;">${display}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
    return `
      <div class="report-shell__card">
        ${chartHtml}
        <div class="report-shell__metric-grid">
          ${items.map(item => {
            const getColor = (val) => {
              if (val === null || val === undefined) return 'var(--text-primary, #fff)';
              if (val <= item.thresholds.good) return '#22c55e';
              if (val <= item.thresholds.poor) return '#f59e0b';
              return '#ef4444';
            };
            const dColor = getColor(item.dVal);
            const mColor = getColor(item.mVal);
            return `
            <div class="metric-card" style="background: var(--bg-tertiary, #1a1a1a); border: 1px solid var(--border-primary, rgba(255,255,255,0.1)); border-radius: 12px; padding: 1.25rem;">
              <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <div style="font-weight: 700; color: #00ff41; font-size: 1.1rem;">${item.label}</div>
                <div style="color: var(--text-muted, #9ca3af); font-size: 0.85rem; padding: 0.2rem 0.5rem; background: var(--bg-secondary, #111); border-radius: 4px;">Target: ${item.target}</div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="text-align: center; padding: 0.75rem; background: var(--bg-secondary, #111); border-radius: 8px;">
                  <div style="color: var(--text-muted, #9ca3af); font-size: 0.8rem; margin-bottom: 0.35rem;">Desktop</div>
                  <div style="color: ${dColor}; font-weight: 700; font-size: 1.25rem;">${item.d}</div>
                </div>
                <div style="text-align: center; padding: 0.75rem; background: var(--bg-secondary, #111); border-radius: 8px;">
                  <div style="color: var(--text-muted, #9ca3af); font-size: 0.8rem; margin-bottom: 0.35rem;">Mobile</div>
                  <div style="color: ${mColor}; font-weight: 700; font-size: 1.25rem;">${item.m}</div>
                </div>
              </div>
            </div>
          `}).join('')}
        </div>
      </div>
    `;
  }

  function renderOpportunitiesSection(results) {
    // Try multiple sources for opportunities/recommendations
    const desktopOpp = results.desktop?.opportunities || [];
    const mobileOpp = results.mobile?.opportunities || [];
    const topLevel = results.recommendations || results.opportunities || [];
    const all = [...desktopOpp, ...mobileOpp, ...topLevel];
    if (!all.length) {
      return '<div style="color: var(--text-muted, #9ca3af);">No opportunities reported.</div>';
    }
    return `
      <ul style="margin:0; padding-left:1.1rem; display:grid; gap:0.75rem; color: var(--text-secondary, #e5e7eb);">
        ${all.slice(0, 8).map(op => `
          <li style="line-height: 1.5;">
            <strong style="color: var(--text-primary, #fff);">${op.title || op.name || 'Opportunity'}</strong>
            ${op.priority ? `<span style="display:inline-block; margin-left:0.5rem; padding:0.1rem 0.4rem; border-radius:4px; font-size:0.75rem; background:${op.priority === 'high' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}; color:${op.priority === 'high' ? '#ef4444' : '#f59e0b'};">${op.priority}</span>` : ''}
            ${op.description ? `<div style="color: var(--text-muted, #9ca3af); font-size: 0.9rem; margin-top: 0.25rem;">${op.description}</div>` : ''}
            ${op.impact ? `<div style="color: #00ff41; font-size: 0.85rem; margin-top: 0.25rem;">Impact: ${op.impact}</div>` : ''}
          </li>
        `).join('')}
      </ul>
    `;
  }

  function renderDiagnosticsSection(results) {
    const desktopDiag = results.desktop?.diagnostics || [];
    const mobileDiag = results.mobile?.diagnostics || [];
    const all = [...desktopDiag, ...mobileDiag];
    
    // Add network/caching diagnostics if available
    const network = results.network || {};
    const caching = results.caching || {};
    const diagnosticItems = [];
    
    if (network.ttfb) diagnosticItems.push({ title: 'Time to First Byte', description: network.ttfb });
    if (network.connectionTime) diagnosticItems.push({ title: 'Connection Time', description: network.connectionTime });
    if (caching.cacheHitRate) diagnosticItems.push({ title: 'Cache Hit Rate', description: caching.cacheHitRate });
    if (caching.notCached > 0) diagnosticItems.push({ title: 'Uncached Resources', description: `${caching.notCached} of ${caching.total} resources not cached` });
    
    const combined = [...all, ...diagnosticItems];
    
    if (!combined.length) {
      return '<div style="color: var(--text-muted, #9ca3af);">No diagnostics reported.</div>';
    }
    return `
      <ul style="margin:0; padding-left:1.1rem; display:grid; gap:0.5rem; color: var(--text-secondary, #e5e7eb);">
        ${combined.slice(0, 10).map(d => `<li><strong style="color: var(--text-primary, #fff);">${d.title || d.name || 'Diagnostic'}</strong>${d.description ? ` — ${d.description}` : ''}</li>`).join('')}
      </ul>
    `;
  }

  function renderResourceBreakdownSection(results) {
    const res = results.resourceSummary || results.resources || {};
    const entries = normalizeResourceBreakdown(res);
    if (!entries.length) {
      return '<div style="color: var(--text-muted, #9ca3af);">Resource breakdown not available.</div>';
    }
    const maxVal = Math.max(...entries.map(e => e.value || 0), 1);
    return `
      <div class="report-shell__card">
        ${entries.map(e => `
          <div class="report-shell__bar-row">
            <span class="report-shell__bar-label">${e.label}</span>
            <div class="report-shell__bar-track">
              <div class="report-shell__bar-fill" style="width:${Math.min(100, (e.value / maxVal) * 100)}%;"></div>
            </div>
            <span class="report-shell__bar-value">${e.display}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderAdditionalChecksSection(results) {
    const checks = results.checks || [];
    if (!checks.length) {
      return '<div style="color: var(--text-muted, #9ca3af);">No additional checks available.</div>';
    }
    return `
      <ul style="margin:0; padding-left:1.1rem; display:grid; gap:0.4rem; color: var(--text-secondary, #e5e7eb);">
        ${checks.slice(0, 10).map(ch => `<li style="color: var(--text-primary, #fff);">${ch.title || ch}</li>`).join('')}
      </ul>
    `;
  }

  function normalizeResourceBreakdown(res) {
    const items = [];
    const push = (label, bytes, display) => {
      if (bytes === undefined || bytes === null) return;
      const num = Number(bytes);
      if (Number.isNaN(num)) return;
      items.push({ label, value: num, display: display || `${(num / 1024).toFixed(0)} KB` });
    };
    // Try breakdown array format from API
    if (res.breakdown && Array.isArray(res.breakdown)) {
      res.breakdown.forEach(item => {
        if (item.size > 0 || item.count > 0) {
          push(item.type, item.size, item.sizeFormatted || `${(item.size / 1024).toFixed(0)} KB`);
        }
      });
    }
    // Try common object shapes
    else if (res.bytesByType) {
      Object.entries(res.bytesByType).forEach(([k, v]) => push(k.toUpperCase(), v));
    } else {
      push('JS', res.jsBytes || res.javascript?.size || res.js);
      push('CSS', res.cssBytes || res.css?.size || res.css);
      push('Images', res.imageBytes || res.images?.size || res.images);
      push('Fonts', res.fontBytes || res.fonts?.size || res.fonts);
      push('Other', res.otherBytes || res.other?.size || res.other);
      push('Third-party', res.thirdPartyBytes || res.thirdParty);
    }
    return items;
  }

  function scoreFromCwvValue(dVal, mVal, metric) {
    const pick = (val) => {
      if (val === null || val === undefined || Number.isNaN(val)) return null;
      if (typeof val === 'string' && val.endsWith('s')) {
        const num = parseFloat(val);
        return Number.isNaN(num) ? null : num * 1000;
      }
      return typeof val === 'string' ? parseFloat(val) : val;
    };
    const vals = [pick(dVal), pick(mVal)].filter(v => v !== null);
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (metric === 'cls') {
      if (avg <= 0.1) return 95;
      if (avg <= 0.25) return 70;
      return 40;
    }
    if (metric === 'inp') {
      if (avg <= 200) return 95;
      if (avg <= 400) return 70;
      return 40;
    }
    // lcp / generic ms
    if (avg <= 2500) return 95;
    if (avg <= 4000) return 70;
    return 40;
  }

  function renderCWVOverviewSection(desktop, mobile) {
    const d = desktop.coreWebVitals || {};
    const m = mobile.coreWebVitals || {};
    const chartRows = [
      { label: 'LCP', value: Math.max(d.lcpMs ?? -Infinity, m.lcpMs ?? -Infinity), target: CWV_THRESHOLDS.lcp.target },
      { label: 'CLS', value: Math.max(d.clsNum ?? -Infinity, m.clsNum ?? -Infinity), target: CWV_THRESHOLDS.cls.target, isCls: true },
      { label: 'INP/TBT', value: Math.max(d.inpMs ?? d.fidMs ?? -Infinity, m.inpMs ?? m.fidMs ?? -Infinity), target: CWV_THRESHOLDS.inp.target }
    ];

    const chartHtml = chartRows.map(row => {
      const normalized = row.isCls ? (row.value !== -Infinity ? Math.min(row.value / 0.3, 1) : 0) : (row.value !== -Infinity ? Math.min(row.value / 4000, 1) : 0);
      const width = `${Math.max(6, Math.round(normalized * 100))}%`;
      const display = row.isCls ? formatCls(row.value) : formatMsCompact(row.value);
      const status = getCwvStatus(row.value, row.label === 'LCP' ? 'lcp' : row.label === 'CLS' ? 'cls' : 'inp');
      const barColor = status.tier === 'good' ? '#00ff41' : status.tier === 'warn' ? '#f59e0b' : status.tier === 'fail' ? '#ef4444' : '#00b5ff';
      return `
        <div class="report-shell__bar-row">
          <div class="report-shell__bar-label">${row.label}</div>
          <div class="report-shell__bar-track">
            <div class="report-shell__bar-fill" style="width:${width}; background:${barColor};"></div>
          </div>
          <div class="report-shell__bar-value" style="color:${barColor};">${display}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="report-shell__card">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1rem; margin-bottom:1rem;">
          <div style="background:var(--bg-tertiary, #111b16); border:1px solid var(--border-primary, rgba(255,255,255,0.12)); border-radius:10px; padding:1rem;">
            <div style="font-weight:700; color:#00ff41; margin-bottom:0.5rem;">LCP (Largest Contentful Paint)</div>
            <div style="display:flex; justify-content:space-between; color:var(--text-secondary, #e5e7eb);">
              <span>Desktop: <strong style="color:var(--text-primary, #fff);">${formatMsCompact(d.lcpMs)}</strong></span>
              <span>Mobile: <strong style="color:var(--text-primary, #fff);">${formatMsCompact(m.lcpMs)}</strong></span>
            </div>
            <div style="margin-top:0.35rem; font-size:0.85rem; color:var(--text-muted, #9ca3af);">Target: ${CWV_THRESHOLDS.lcp.target}</div>
          </div>
          <div style="background:var(--bg-tertiary, #111b16); border:1px solid var(--border-primary, rgba(255,255,255,0.12)); border-radius:10px; padding:1rem;">
            <div style="font-weight:700; color:#00ff41; margin-bottom:0.5rem;">CLS (Cumulative Layout Shift)</div>
            <div style="display:flex; justify-content:space-between; color:var(--text-secondary, #e5e7eb);">
              <span>Desktop: <strong style="color:var(--text-primary, #fff);">${formatCls(d.clsNum)}</strong></span>
              <span>Mobile: <strong style="color:var(--text-primary, #fff);">${formatCls(m.clsNum)}</strong></span>
            </div>
            <div style="margin-top:0.35rem; font-size:0.85rem; color:var(--text-muted, #9ca3af);">Target: ${CWV_THRESHOLDS.cls.target}</div>
          </div>
          <div style="background:var(--bg-tertiary, #111b16); border:1px solid var(--border-primary, rgba(255,255,255,0.12)); border-radius:10px; padding:1rem;">
            <div style="font-weight:700; color:#00ff41; margin-bottom:0.5rem;">INP/TBT (Interaction to Next Paint)</div>
            <div style="display:flex; justify-content:space-between; color:var(--text-secondary, #e5e7eb);">
              <span>Desktop: <strong style="color:var(--text-primary, #fff);">${formatMsCompact(d.inpMs || d.fidMs)}</strong></span>
              <span>Mobile: <strong style="color:var(--text-primary, #fff);">${formatMsCompact(m.inpMs || m.fidMs)}</strong></span>
            </div>
            <div style="margin-top:0.35rem; font-size:0.85rem; color:var(--text-muted, #9ca3af);">Target: ${CWV_THRESHOLDS.inp.target}</div>
          </div>
          <div style="background:var(--bg-tertiary, #111b16); border:1px solid var(--border-primary, rgba(255,255,255,0.12)); border-radius:10px; padding:1rem;">
            <div style="font-weight:700; color:#00ff41; margin-bottom:0.5rem;">FCP (First Contentful Paint)</div>
            <div style="display:flex; justify-content:space-between; color:var(--text-secondary, #e5e7eb);">
              <span>Desktop: <strong style="color:var(--text-primary, #fff);">${formatMsCompact(d.fcpMs)}</strong></span>
              <span>Mobile: <strong style="color:var(--text-primary, #fff);">${formatMsCompact(m.fcpMs)}</strong></span>
            </div>
            <div style="margin-top:0.35rem; font-size:0.85rem; color:var(--text-muted, #9ca3af);">Target: ≤ 1.8s</div>
          </div>
        </div>
        <div style="margin-top:1rem;">
          <div style="font-weight:700; color:#00ff41; margin-bottom:0.75rem;">Performance Overview</div>
          ${chartHtml}
        </div>
      </div>
    `;
  }

  function renderCWVDetailSection(metric, desktop, mobile) {
    const thresholds = { LCP: { good: 2500, poor: 4000 }, CLS: { good: 0.1, poor: 0.25 }, INP: { good: 200, poor: 400 } };
    const map = {
      LCP: { d: desktop.coreWebVitals?.lcpMs, m: mobile.coreWebVitals?.lcpMs, target: '≤ 2.5s', max: 5000 },
      CLS: { d: desktop.coreWebVitals?.clsNum, m: mobile.coreWebVitals?.clsNum, target: '≤ 0.1', max: 0.4 },
      INP: { d: desktop.coreWebVitals?.inpMs || desktop.coreWebVitals?.fidMs, m: mobile.coreWebVitals?.inpMs || mobile.coreWebVitals?.fidMs, target: '≤ 200ms', max: 600 }
    };
    const entry = map[metric] || {};
    const th = thresholds[metric] || { good: 0, poor: 1 };
    const getColor = (val) => {
      if (val === null || val === undefined) return '#6b7280';
      if (val <= th.good) return '#00ff41';
      if (val <= th.poor) return '#f59e0b';
      return '#ef4444';
    };
    const getBarWidth = (val, max) => {
      if (val === null || val === undefined || val === -Infinity) return '5%';
      return `${Math.max(5, Math.min(100, (val / max) * 100))}%`;
    };
    const dVal = parseMs(entry.d);
    const mVal = parseMs(entry.m);
    const dColor = getColor(dVal);
    const mColor = getColor(mVal);
    const dDisplay = metric === 'CLS' ? formatCls(dVal) : formatMsCompact(dVal);
    const mDisplay = metric === 'CLS' ? formatCls(mVal) : formatMsCompact(mVal);
    const tips = {
      LCP: 'Optimize images (WebP/AVIF, lazy-load below fold), preload hero images, reduce server response time, minimize render-blocking CSS/JS.',
      CLS: 'Set explicit width/height on images and embeds, avoid inserting content above existing content, reserve space for ads/dynamic content.',
      INP: 'Break up long JavaScript tasks, use web workers for heavy computation, optimize event handlers, reduce main thread work.'
    };
    return `
      <div class="report-shell__card">
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
          <span style="font-weight:700; color:#e5e7eb;">Target:</span>
          <span style="color:#00ff41; font-weight:600;">${entry.target || '—'}</span>
        </div>
        <div style="display:grid; gap:1rem; margin-bottom:1rem;">
          <div style="background:#111b16; border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <span style="font-weight:700; color:#e5e7eb;">Desktop</span>
              <span style="font-weight:800; font-size:1.1rem; color:${dColor};">${dDisplay}</span>
            </div>
            <div style="height:12px; background:rgba(255,255,255,0.08); border-radius:999px; overflow:hidden;">
              <div style="height:100%; width:${getBarWidth(dVal, entry.max)}; background:${dColor}; border-radius:999px; transition:width 0.5s ease;"></div>
            </div>
          </div>
          <div style="background:#111b16; border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <span style="font-weight:700; color:#e5e7eb;">Mobile</span>
              <span style="font-weight:800; font-size:1.1rem; color:${mColor};">${mDisplay}</span>
            </div>
            <div style="height:12px; background:rgba(255,255,255,0.08); border-radius:999px; overflow:hidden;">
              <div style="height:100%; width:${getBarWidth(mVal, entry.max)}; background:${mColor}; border-radius:999px; transition:width 0.5s ease;"></div>
            </div>
          </div>
        </div>
        <div style="background:rgba(0,255,65,0.06); border:1px solid rgba(0,255,65,0.2); border-radius:8px; padding:0.75rem; color:#c7f5d9; font-size:0.9rem;">
          <strong style="color:#00ff41;">💡 How to improve:</strong> ${tips[metric] || 'Optimize render-blocking resources, compress images, and reduce JS long tasks.'}
        </div>
      </div>
    `;
  }

  function renderCWVNotesSection(data) {
    const notes = data.recommendations || [];
    if (!notes.length) {
      return '<div style="color:#9ca3af;">No diagnostics available.</div>';
    }
    return `
      <ul style="margin:0; padding-left:1.1rem; display:grid; gap:0.4rem;">
        ${notes.slice(0, 8).map(n => {
          if (typeof n === 'string') return `<li>${n}</li>`;
          const title = n.title || n.metric || 'Issue';
          const desc = n.description || n.issue || n.detail || '';
          return `<li><strong>${title}</strong>${desc ? ` — <span style="color:#9ca3af;">${desc}</span>` : ''}</li>`;
        }).join('')}
      </ul>
    `;
  }

  function renderLighthouseSummaryCard(url, overallPerf, generatedAt) {
    const statusText = overallPerf >= 90 ? 'Excellent performance' : overallPerf >= 50 ? 'Moderate performance' : 'Needs work';
    return `
      <div class="lh-report-card">
        <div class="lh-report-header">
          <div>
            <div class="lh-report-title">Speed & UX Report: Lighthouse Audit</div>
            <div class="lh-report-meta">URL: ${url}</div>
          </div>
          <div class="lh-report-meta">Generated: ${generatedAt}</div>
        </div>
        <div class="lh-report-score">
          <div class="lh-score-ring">${renderScoreRing(overallPerf, overallPerf, 150)}</div>
          <div class="lh-score-caption">
            <div class="lh-score-subtitle">Combined Desktop & Mobile</div>
            <div class="lh-score-status">${statusText}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderLighthouseDeviceCard(label, icon, data) {
    // Scores are in data.lighthouse, metrics in data.coreWebVitals
    const lighthouse = data.lighthouse || {};
    const scores = {
      performance: normalizeScore(lighthouse.performance ?? data.performanceScore),
      accessibility: normalizeScore(lighthouse.accessibility),
      bestPractices: normalizeScore(lighthouse.bestPractices),
      seo: normalizeScore(lighthouse.seo)
    };
    const cwv = data.coreWebVitals || {};
    const fcpStr = cwv.fcp || '0s';
    const fcpMs = parseFloat(fcpStr) * 1000 || 0;
    const metrics = {
      lcp: cwv.lcpMs || 0,
      lcpDisplay: cwv.lcp || '0s',
      cls: cwv.clsNum || 0,
      clsDisplay: cwv.cls || '0.000',
      tbt: cwv.fidMs || 0,
      tbtDisplay: cwv.fid || '0ms',
      fcp: fcpMs,
      fcpDisplay: fcpStr
    };

    // Determine metric ratings
    const lcpRating = metrics.lcp <= 2500 ? 'good' : metrics.lcp <= 4000 ? 'average' : 'poor';
    const clsRating = metrics.cls <= 0.1 ? 'good' : metrics.cls <= 0.25 ? 'average' : 'poor';
    const tbtRating = metrics.tbt <= 200 ? 'good' : metrics.tbt <= 600 ? 'average' : 'poor';
    const fcpRating = metrics.fcp <= 1800 ? 'good' : metrics.fcp <= 3000 ? 'average' : 'poor';

    return `
      <div class="lh-device-card">
        <div class="lh-device-header">${icon} ${label}</div>
        <div class="lh-metric-grid">
          ${createMetricCard(scores.performance ?? '—', 'Performance', typeof scores.performance === 'number' ? (scores.performance >= 90 ? 'good' : scores.performance >= 50 ? 'average' : 'poor') : 'unknown', '⚡')}
          ${createMetricCard(scores.accessibility ?? '—', 'Accessibility', typeof scores.accessibility === 'number' ? (scores.accessibility >= 90 ? 'good' : scores.accessibility >= 50 ? 'average' : 'poor') : 'unknown', '♿')}
          ${createMetricCard(scores.bestPractices ?? '—', 'Best Practices', typeof scores.bestPractices === 'number' ? (scores.bestPractices >= 90 ? 'good' : scores.bestPractices >= 50 ? 'average' : 'poor') : 'unknown', '✓')}
          ${createMetricCard(scores.seo ?? '—', 'SEO', typeof scores.seo === 'number' ? (scores.seo >= 90 ? 'good' : scores.seo >= 50 ? 'average' : 'poor') : 'unknown', '🔍')}
        </div>
        <div class="lh-metric-grid lh-metric-grid--cwv">
          ${createMetricCard(metrics.lcpDisplay, 'LCP', lcpRating, '🎯')}
          ${createMetricCard(metrics.clsDisplay, 'CLS', clsRating, '📐')}
          ${createMetricCard(metrics.tbtDisplay, 'TBT', tbtRating, '⏱️')}
          ${createMetricCard(metrics.fcpDisplay, 'FCP', fcpRating, '🎨')}
        </div>
      </div>
    `;
  }

  function renderLighthouseResults(data, device) {
    // Scores are in data.lighthouse, metrics in data.coreWebVitals
    const lighthouse = data.lighthouse || {};
    const scores = {
      performance: normalizeScore(lighthouse.performance ?? data.performanceScore),
      accessibility: normalizeScore(lighthouse.accessibility),
      bestPractices: normalizeScore(lighthouse.bestPractices),
      seo: normalizeScore(lighthouse.seo)
    };
    const cwv = data.coreWebVitals || {};
    // API returns formatted strings (lcp: "2.50s") and numeric versions (lcpMs: 2500)
    // Use numeric for ratings, strings for display
    // Parse FCP string to get numeric value (e.g., "1.80s" -> 1800)
    const fcpStr = cwv.fcp || '0s';
    const fcpMs = parseFloat(fcpStr) * 1000 || 0;
    const metrics = {
      lcp: cwv.lcpMs || 0,
      lcpDisplay: cwv.lcp || '0s',
      cls: cwv.clsNum || 0,
      clsDisplay: cwv.cls || '0.000',
      tbt: cwv.fidMs || 0,
      tbtDisplay: cwv.fid || '0ms',
      fcp: fcpMs,
      fcpDisplay: fcpStr
    };

    // Determine metric ratings
    const lcpRating = metrics.lcp <= 2500 ? 'good' : metrics.lcp <= 4000 ? 'average' : 'poor';
    const clsRating = metrics.cls <= 0.1 ? 'good' : metrics.cls <= 0.25 ? 'average' : 'poor';
    const tbtRating = metrics.tbt <= 200 ? 'good' : metrics.tbt <= 600 ? 'average' : 'poor';
    const fcpRating = metrics.fcp <= 1800 ? 'good' : metrics.fcp <= 3000 ? 'average' : 'poor';

    return `
      ${createSectionHeader('Lighthouse Scores', '📊')}
      <div class="score-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        ${createMetricCard(scores.performance, 'Performance', scores.performance >= 90 ? 'good' : scores.performance >= 50 ? 'average' : 'poor', '⚡')}
        ${createMetricCard(scores.accessibility, 'Accessibility', scores.accessibility >= 90 ? 'good' : scores.accessibility >= 50 ? 'average' : 'poor', '♿')}
        ${createMetricCard(scores.bestPractices, 'Best Practices', scores.bestPractices >= 90 ? 'good' : scores.bestPractices >= 50 ? 'average' : 'poor', '✓')}
        ${createMetricCard(scores.seo, 'SEO', scores.seo >= 90 ? 'good' : scores.seo >= 50 ? 'average' : 'poor', '🔍')}
      </div>

      ${createSectionHeader('Core Web Vitals', '⚡')}
      <div class="score-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        ${createMetricCard(metrics.lcpDisplay, 'LCP', lcpRating, '🎯')}
        ${createMetricCard(metrics.clsDisplay, 'CLS', clsRating, '📐')}
        ${createMetricCard(metrics.tbtDisplay, 'TBT', tbtRating, '⏱️')}
        ${createMetricCard(metrics.fcpDisplay, 'FCP', fcpRating, '🎨')}
      </div>

      ${data.recommendations && data.recommendations.length > 0
        ? createInfoBox('info', `💡 Top ${Math.min(5, data.recommendations.length)} Recommendations`, `
            <ul style="margin: 0; padding-left: 1.5rem; display: grid; gap: 0.5rem;">
              ${data.recommendations.slice(0, 5).map(rec => `
                <li>
                  <strong>${rec.title || rec}</strong>
                  ${rec.description ? `<br><span style="color: #93c5fd; font-size: 0.9rem;">${rec.description}</span>` : ''}
                </li>
              `).join('')}
            </ul>
          `)
        : ''
      }
    `;
  }

  // Display Core Web Vitals Results
  function displayCWVResults(data) {
    const desktop = normalizeCWVDevice(data.desktop || {});
    const mobile = normalizeCWVDevice(data.mobile || {});
    const url = urlInput.value;
    const timestamp = new Date().toLocaleString();
    const lcpScore = scoreFromCwvValue(desktop.coreWebVitals?.lcpMs || desktop.coreWebVitals?.lcp, mobile.coreWebVitals?.lcpMs || mobile.coreWebVitals?.lcp, 'lcp');
    const clsScore = scoreFromCwvValue(desktop.coreWebVitals?.cls || desktop.coreWebVitals?.clsNum, mobile.coreWebVitals?.cls || mobile.coreWebVitals?.clsNum, 'cls');
    const inpScore = scoreFromCwvValue(desktop.coreWebVitals?.inpMs || desktop.coreWebVitals?.tbtMs || desktop.coreWebVitals?.fidMs, mobile.coreWebVitals?.inpMs || mobile.coreWebVitals?.tbtMs || mobile.coreWebVitals?.fidMs, 'inp');

    const derivedOverall = averageScores([lcpScore, clsScore, inpScore]);
    const apiOverall = normalizeScore(data.score ?? data.overallScore ?? data.performanceScore);
    const overallScore = apiOverall !== null ? apiOverall : derivedOverall;

    const lcpStatus = getCwvStatus(Math.max(desktop.coreWebVitals.lcpMs ?? -Infinity, mobile.coreWebVitals.lcpMs ?? -Infinity), 'lcp');
    const clsStatus = getCwvStatus(Math.max(desktop.coreWebVitals.clsNum ?? -Infinity, mobile.coreWebVitals.clsNum ?? -Infinity), 'cls');
    const inpStatus = getCwvStatus(Math.max(desktop.coreWebVitals.inpMs ?? -Infinity, mobile.coreWebVitals.inpMs ?? -Infinity), 'inp');
    const riskBanner = renderRiskBanner([
      { ...lcpStatus, metric: 'lcp' },
      { ...clsStatus, metric: 'cls' },
      { ...inpStatus, metric: 'inp' }
    ]);

    const summaryDonuts = ReportShell.renderSummaryDonuts([
      { label: 'LCP', score: lcpScore },
      { label: 'CLS', score: clsScore },
      { label: 'INP/TBT', score: inpScore },
      { label: 'Overall', score: overallScore }
    ]);

    const proLocked = !userHasPro();
    const proContent = `
      ${renderFreeFixBullets(desktop, mobile)}
      ${renderFixesToMake(desktop, mobile)}
      ${proLocked ? renderLockedProPreview('Paid report available', ['Client-ready exports', 'Share link', 'Fix code + recommendations']) : ''}
    `;

    const accordions = [
      ReportAccordion.createSection({ id: 'cwv-overview', title: 'CWV Overview', scoreTextRight: formatScoreText(overallScore), contentHTML: renderCWVOverviewSection(desktop, mobile) }),
      ReportAccordion.createSection({
        id: 'cwv-lcp',
        title: buildMetricHeader({ label: 'LCP Details', desktopValue: desktop.coreWebVitals?.lcpMs, mobileValue: mobile.coreWebVitals?.lcpMs, metric: 'lcp' }),
        scoreTextRight: formatScoreText(lcpScore),
        contentHTML: renderCWVDetailSection('LCP', desktop, mobile)
      }),
      ReportAccordion.createSection({
        id: 'cwv-cls',
        title: buildMetricHeader({ label: 'CLS Details', desktopValue: desktop.coreWebVitals?.clsNum, mobileValue: mobile.coreWebVitals?.clsNum, metric: 'cls' }),
        scoreTextRight: formatScoreText(clsScore),
        contentHTML: renderCWVDetailSection('CLS', desktop, mobile)
      }),
      ReportAccordion.createSection({
        id: 'cwv-inp',
        title: buildMetricHeader({ label: 'INP/TBT Details', desktopValue: desktop.coreWebVitals?.inpMs || desktop.coreWebVitals?.tbtMs, mobileValue: mobile.coreWebVitals?.inpMs || mobile.coreWebVitals?.tbtMs, metric: 'inp' }),
        scoreTextRight: formatScoreText(inpScore),
        contentHTML: renderCWVDetailSection('INP', desktop, mobile)
      }),
      ReportAccordion.createSection({ id: 'cwv-fixes', title: 'Fix Code + Recommendations', scoreTextRight: null, isPro: true, locked: proLocked, contentHTML: proContent })
    ].join('');

    // Count CWV issues: failed metrics + recommendations + opportunities
    const cwvIssuesCount =
      (desktop.recommendations?.length || 0) +
      (mobile.recommendations?.length || 0) +
      (desktop.opportunities?.length || 0) +
      (mobile.opportunities?.length || 0) +
      (data.recommendations?.length || 0) +
      (Array.isArray(data.opportunities) ? data.opportunities.length : 0);

    // Count failed CWV metrics (scores below 90 are issues)
    const failedMetrics = [lcpScore, clsScore, inpScore].filter(s => s !== null && s < 90).length;

    const summaryStats = calculatePerformanceSummary({
      mode: 'cwv',
      issues: cwvIssuesCount + failedMetrics,
      recommendations: data.recommendations?.length || 0,
      checks: countCWVChecks(desktop, mobile)
    });

    const html = `
      ${ReportShell.renderReportHeader({ title: 'Speed & UX Report: Core Web Vitals', url, timestamp, badgeText: 'Core Web Vitals', mode: 'cwv' })}
      ${riskBanner}
      ${summaryDonuts}
      ${accordions}
      ${renderPerformanceSummarySection(summaryStats)}
      ${renderPerformanceTakeActionSection(url, 'cwv')}
    `;

    resultsContent.innerHTML = `<div class="report-scope">${html}</div>`;
    window.currentPerformanceHubResults = { mode: 'cwv', url, data };
    ReportAccordion.initInteractions();
    showPdfExportButton();
    animateScoreRings();
    scrollToResults();
  }

  function renderCWVMetrics(data) {
    // Handle both object format (from API) and raw numbers
    const lcpRaw = data.lcp || data.LCP;
    const clsRaw = data.cls || data.CLS;
    const inpRaw = data.inp || data.INP || data.fid || data.FID;
    
    // Extract value from object if needed
    const lcp = typeof lcpRaw === 'object' ? (lcpRaw?.value || 0) : (lcpRaw || 0);
    const cls = typeof clsRaw === 'object' ? (clsRaw?.value || 0) : (clsRaw || 0);
    const inp = typeof inpRaw === 'object' ? (inpRaw?.value || 0) : (inpRaw || 0);

    return `
      <div class="cwv-metrics" style="display: block;">
        <div class="cwv-metric" style="margin-bottom: 0.5rem;">
          <div class="cwv-metric-header">
            <span class="cwv-metric-name">LCP</span>
            <span class="cwv-metric-badge ${getCWVRating(lcp, 2500, 4000)}">${getCWVLabel(lcp, 2500, 4000)}</span>
          </div>
          <div class="cwv-metric-value">${formatMs(lcp)}</div>
        </div>
        <div class="cwv-metric" style="margin-bottom: 0.5rem;">
          <div class="cwv-metric-header">
            <span class="cwv-metric-name">INP</span>
            <span class="cwv-metric-badge ${getCWVRating(inp, 200, 500)}">${getCWVLabel(inp, 200, 500)}</span>
          </div>
          <div class="cwv-metric-value">${formatMs(inp)}</div>
        </div>
        <div class="cwv-metric">
          <div class="cwv-metric-header">
            <span class="cwv-metric-name">CLS</span>
            <span class="cwv-metric-badge ${getCWVRating(cls, 0.1, 0.25)}">${getCWVLabel(cls, 0.1, 0.25)}</span>
          </div>
          <div class="cwv-metric-value">${Number(cls).toFixed(3)}</div>
        </div>
      </div>
    `;
  }

  function parseMs(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number' && !Number.isNaN(val)) return val;
    if (typeof val === 'string') {
      const v = val.trim().toLowerCase();
      if (v.endsWith('ms')) {
        const n = parseFloat(v.replace('ms', ''));
        return Number.isNaN(n) ? null : n;
      }
      if (v.endsWith('s')) {
        const n = parseFloat(v.replace('s', ''));
        return Number.isNaN(n) ? null : n * 1000;
      }
      const n = parseFloat(v);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }

  function pickNumber(candidates = []) {
    for (const c of candidates) {
      const n = parseMs(c);
      if (n !== null) return n;
    }
    return null;
  }

  function normalizeCWVDevice(device = {}) {
    const cvw = device.coreWebVitals || {};
    const addl = device.additionalMetrics || {};
    
    // LCP - try all possible locations
    const lcpMs = pickNumber([
      cvw.lcpMs, cvw.lcp, 
      device.lcp?.value, device.lcp?.numericValue, device.lcp,
      addl.lcp?.value
    ]);
    
    // CLS - try all possible locations
    const clsNum = pickNumber([
      cvw.clsNum, cvw.cls, 
      device.cls?.value, device.cls?.numericValue, device.cls,
      addl.cls?.value
    ]);
    
    // INP/FID/TBT - try all possible locations
    const inpMs = pickNumber([
      cvw.inpMs, cvw.inp, cvw.fidMs, cvw.fid, cvw.tbt,
      device.inp?.value, device.inp?.numericValue,
      device.fid?.value, device.fid?.numericValue,
      device.inp?.tbt?.value,
      device.inp, device.fid,
      addl.tbt?.value, addl.fid?.value
    ]);
    
    // FCP - try all possible locations
    const fcpMs = pickNumber([
      cvw.fcpMs, cvw.fcp, 
      device.fcp?.value, device.fcp?.numericValue, device.fcp,
      addl.fcp?.value, addl.fcp?.numericValue
    ]);

    const lcpDisplay = device.lcp?.displayValue || cvw.lcpDisplay || (lcpMs !== null ? `${(lcpMs / 1000).toFixed(2)}s` : null);
    const clsDisplay = device.cls?.displayValue || cvw.clsDisplay || (clsNum !== null ? clsNum.toFixed(3) : null);
    const inpDisplay = device.inp?.displayValue || device.fid?.displayValue || cvw.inpDisplay || (inpMs !== null ? `${Math.round(inpMs)}ms` : null);
    const fcpDisplay = device.fcp?.displayValue || addl.fcp?.displayValue || cvw.fcpDisplay || (fcpMs !== null ? `${(fcpMs / 1000).toFixed(2)}s` : null);

    return {
      ...device,
      coreWebVitals: {
        lcpMs,
        lcp: lcpDisplay,
        cls: clsDisplay,
        clsNum,
        inp: inpMs,
        inpMs,
        fid: inpDisplay,
        fidMs: inpMs,
        fcp: fcpDisplay,
        fcpMs
      }
    };
  }

  const CWV_THRESHOLDS = {
    lcp: { good: 2500, poor: 4000, target: '≤ 2.5s' },
    cls: { good: 0.1, poor: 0.25, target: '≤ 0.1' },
    inp: { good: 200, poor: 400, target: '≤ 200ms' }
  };

  function getCwvStatus(value, metric) {
    const thresholds = CWV_THRESHOLDS[metric];
    if (!thresholds || value === null || value === undefined || Number.isNaN(value)) {
      return { tier: 'unknown', label: '—', badge: 'Unknown', tone: '#9ca3af' };
    }
    if (value <= thresholds.good) return { tier: 'good', label: 'Pass', badge: 'Pass', tone: '#00ff41' };
    if (value <= thresholds.poor) return { tier: 'warn', label: 'At risk', badge: 'At risk', tone: '#f59e0b' };
    return { tier: 'fail', label: 'Fail', badge: 'Fail', tone: '#ef4444' };
  }

  function formatMsCompact(ms) {
    if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${Math.round(ms)}ms`;
  }

  function formatCls(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return Number(value).toFixed(3);
  }

  function buildMetricHeader({ label, desktopValue, mobileValue, metric }) {
    const thresholds = CWV_THRESHOLDS[metric];
    const targetText = thresholds?.target || '';
    const worstValue = Math.max(desktopValue ?? -Infinity, mobileValue ?? -Infinity);
    const status = getCwvStatus(worstValue, metric);
    const valueText = metric === 'cls'
      ? `${formatCls(desktopValue)} / ${formatCls(mobileValue)}`
      : `${formatMsCompact(desktopValue)} / ${formatMsCompact(mobileValue)}`;
    return `${label} · ${valueText} · Target ${targetText} (${status.badge})`;
  }

  function renderRiskBanner(statuses) {
    const risky = statuses.filter(s => s && (s.tier === 'warn' || s.tier === 'fail'));
    if (!risky.length) return '';
    const worst = risky.some(s => s.tier === 'fail') ? 'fail' : 'warn';
    const tone = worst === 'fail' ? '#ef4444' : '#f59e0b';
    return `
      <div style="margin: 0 0 1rem 0; padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid ${tone}33; background: ${tone}12; color: ${tone}; font-weight: 700;">
        ${worst === 'fail' ? 'Some metrics are failing: ' : 'Metrics at risk: '}
        ${risky.map(r => r.metric.toUpperCase()).join(', ')} — improve to meet targets.
      </div>
    `;
  }

  function renderResourceAccordions(resources) {
    let html = '';

    // CSS
    if (resources.css) {
      html += `
        <details class="resource-details">
          <summary class="resource-summary">
            <span class="resource-badge resource-css">CSS</span>
            <span style="font-weight: bold;">${resources.css.totalFiles || 0} external, ${resources.css.totalInline || 0} inline</span>
            <span style="font-size: 0.85rem; color: #888;">Estimated: ${formatKB(resources.css.estimatedSizeKB)}</span>
          </summary>
          <div class="resource-details-content">
            ${(resources.css.files || []).length > 0 ? `
              <table class="resource-table">
                <thead><tr><th>URL</th><th>Media</th></tr></thead>
                <tbody>
                  ${(resources.css.files || []).map(f => `
                    <tr><td class="url-cell">${truncateUrl(f.url)}</td><td>${f.media || 'all'}</td></tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p style="color: #888;">No external CSS files</p>'}
          </div>
        </details>
      `;
    }

    // JavaScript
    if (resources.js) {
      html += `
        <details class="resource-details">
          <summary class="resource-summary">
            <span class="resource-badge resource-js">JavaScript</span>
            <span style="font-weight: bold;">${resources.js.totalFiles || 0} external, ${resources.js.totalInline || 0} inline</span>
            <span style="font-size: 0.85rem; color: #888;">Async: ${(resources.js.async || []).length} | Defer: ${(resources.js.defer || []).length}</span>
          </summary>
          <div class="resource-details-content">
            ${(resources.js.files || []).length > 0 ? `
              <table class="resource-table">
                <thead><tr><th>URL</th><th>Async</th><th>Defer</th><th>Location</th></tr></thead>
                <tbody>
                  ${(resources.js.files || []).map(f => `
                    <tr>
                      <td class="url-cell">${truncateUrl(f.url)}</td>
                      <td>${f.async ? '✓' : '—'}</td>
                      <td>${f.defer ? '✓' : '—'}</td>
                      <td>${f.location || 'body'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p style="color: #888;">No external JavaScript files</p>'}
          </div>
        </details>
      `;
    }

    // Images
    if (resources.images) {
      html += `
        <details class="resource-details">
          <summary class="resource-summary">
            <span class="resource-badge resource-image">Images</span>
            <span style="font-weight: bold;">${resources.images.total || 0} images</span>
            <span style="font-size: 0.85rem; color: #888;">Missing alt: ${resources.images.withoutAlt || 0} | Lazy: ${resources.images.lazyLoaded || 0}</span>
          </summary>
          <div class="resource-details-content">
            ${resources.images.formats && Object.keys(resources.images.formats).length > 0 ? `
              <table class="resource-table">
                <thead><tr><th>Format</th><th>Count</th><th>% of Total</th></tr></thead>
                <tbody>
                  ${Object.entries(resources.images.formats)
                    .filter(([format]) => ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif', 'ico', 'dynamic'].includes(format.toLowerCase()))
                    .sort((a, b) => b[1] - a[1])
                    .map(([format, count]) => `
                      <tr>
                        <td style="text-transform: uppercase; font-weight: bold;">${format}</td>
                        <td>${count}</td>
                        <td>${((count / (resources.images.total || 1)) * 100).toFixed(1)}%</td>
                      </tr>
                    `).join('')}
                </tbody>
              </table>
            ` : '<p style="color: #888;">No image format data</p>'}
          </div>
        </details>
      `;
    }

    // Third-Party
    if (resources.thirdParty) {
      html += `
        <details class="resource-details">
          <summary class="resource-summary">
            <span class="resource-badge resource-third-party">Third-Party</span>
            <span style="font-weight: bold;">${resources.thirdParty.count || 0} resources</span>
          </summary>
          <div class="resource-details-content">
            ${resources.thirdParty.categories && Object.keys(resources.thirdParty.categories).length > 0 ? `
              <table class="resource-table">
                <thead><tr><th>Category</th><th>Count</th></tr></thead>
                <tbody>
                  ${Object.entries(resources.thirdParty.categories)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => `<tr><td>${cat}</td><td>${count}</td></tr>`).join('')}
                </tbody>
              </table>
              ${(resources.thirdParty.domains || []).length > 0 ? `
                <div style="margin-top: 1rem;">
                  <strong style="font-size: 0.85rem;">Domains:</strong>
                  <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
                    ${(resources.thirdParty.domains || []).slice(0, 20).map(d => `
                      <span style="background: rgba(236, 72, 153, 0.15); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${d}</span>
                    `).join('')}
                    ${(resources.thirdParty.domains || []).length > 20 ? `<span style="color: #888; font-size: 0.75rem;">+${resources.thirdParty.domains.length - 20} more</span>` : ''}
                  </div>
                </div>
              ` : ''}
            ` : '<p style="color: #888;">No third-party resources detected</p>'}
          </div>
        </details>
      `;
    }

    // Fonts
    if (resources.fonts) {
      html += `
        <details class="resource-details">
          <summary class="resource-summary">
            <span class="resource-badge resource-font">Fonts</span>
            <span style="font-weight: bold;">${resources.fonts.preloaded || 0} preloaded</span>
            <span style="font-size: 0.85rem; color: #888;">Missing font-display: ${resources.fonts.withoutDisplay || 0}</span>
          </summary>
          <div class="resource-details-content">
            ${(resources.fonts.providers || []).length > 0 ? `
              <table class="resource-table">
                <thead><tr><th>Provider</th></tr></thead>
                <tbody>
                  ${(resources.fonts.providers || []).map(p => `<tr><td>${p}</td></tr>`).join('')}
                </tbody>
              </table>
            ` : '<p style="color: #888;">No font providers detected</p>'}
          </div>
        </details>
      `;
    }

    return html;
  }

  // Utility functions
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  // SVG Score Ring Renderer - Creates animated circular progress indicator
  function renderScoreRing(score, displayValue, size = 120) {
    const isValid = typeof score === 'number' && Number.isFinite(score);
    const safeScore = isValid ? score : 0;
    const color = isValid ? getScoreColor(safeScore) : '#9ca3af';
    const radius = (size - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (safeScore / 100) * circumference;
    const glowColor = color + '60';
    
    return `
      <div class="score-ring-container" style="width: ${size}px; height: ${size}px; margin: 0 auto; position: relative;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="score-ring-svg">
          <!-- Background circle - uses CSS var for light/dark mode -->
          <circle 
            class="score-ring-bg"
            cx="${size/2}" cy="${size/2}" r="${radius}"
            fill="var(--score-ring-fill, rgba(0,0,0,0.3))"
            stroke="var(--score-ring-stroke, rgba(255,255,255,0.1))"
            stroke-width="8"
          />
          <!-- Progress circle -->
          <circle 
            class="score-ring-progress"
            cx="${size/2}" cy="${size/2}" r="${radius}"
            fill="none"
            stroke="${color}"
            stroke-width="8"
            stroke-linecap="round"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${circumference}"
            data-target-offset="${strokeDashoffset}"
            transform="rotate(-90 ${size/2} ${size/2})"
            style="filter: drop-shadow(0 0 8px ${glowColor}); transition: stroke-dashoffset 1.5s ease-out;"
          />
        </svg>
        <div class="score-ring-value" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
          <div style="font-size: ${size * 0.3}px; font-weight: bold; color: ${color}; text-shadow: 0 0 10px ${glowColor};">${isValid ? (displayValue || safeScore) : '—'}</div>
        </div>
      </div>
    `;
  }

  // Animate score rings on page load
  function animateScoreRings() {
    setTimeout(() => {
      document.querySelectorAll('.score-ring-progress').forEach(circle => {
        const targetOffset = circle.getAttribute('data-target-offset');
        circle.style.strokeDashoffset = targetOffset;
      });
    }, 100);
  }

  function getMetricColor(value, warnThreshold, badThreshold) {
    if (value === undefined || value === null) return '#888';
    if (value <= warnThreshold) return '#22c55e';
    if (value <= badThreshold) return '#f59e0b';
    return '#ef4444';
  }

  function getCWVRating(value, goodThreshold, poorThreshold) {
    if (value <= goodThreshold) return 'good';
    if (value <= poorThreshold) return 'needs-improvement';
    return 'poor';
  }

  function getCWVLabel(value, goodThreshold, poorThreshold) {
    if (value <= goodThreshold) return 'Good';
    if (value <= poorThreshold) return 'Needs Work';
    return 'Poor';
  }

  function getCWVColor(value, goodThreshold, poorThreshold) {
    if (value <= goodThreshold) return '#22c55e';
    if (value <= poorThreshold) return '#f59e0b';
    return '#ef4444';
  }

  function formatKB(kb) {
    if (!kb) return '0';
    if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
    return Math.round(kb) + ' KB';
  }

  function formatMs(ms) {
    if (!ms) return '0ms';
    if (ms >= 1000) return (ms / 1000).toFixed(2) + 's';
    return Math.round(ms) + 'ms';
  }

  function truncateUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const path = parsed.pathname + parsed.search;
      if (path.length > 60) {
        return parsed.hostname + path.substring(0, 50) + '...';
      }
      return parsed.hostname + path;
    } catch {
      if (url.length > 70) return url.substring(0, 60) + '...';
      return url;
    }
  }

  // Global function to switch modes
  window.switchToMode = function(mode) {
    currentMode = mode;
    modeTabs.forEach(t => {
      t.classList.remove('tabs__item--active');
      if (t.dataset.mode === mode) {
        t.classList.add('tabs__item--active');
      }
    });
    buttonText.textContent = 'Analyze';
    runAnalysis();
  };

  // Show PDF export button after results are displayed
  function showPdfExportButton() {
    const pdfSection = document.getElementById('pdfExportSection');
    if (pdfSection) {
      pdfSection.classList.remove('hidden');
    }
  }

  // Hide PDF export button
  function hidePdfExportButton() {
    const pdfSection = document.getElementById('pdfExportSection');
    if (pdfSection) {
      pdfSection.classList.add('hidden');
    }
  }

  // ==================== STANDARDIZED LAYOUT HELPERS ====================

  /**
   * Create standardized overall score section
   */
  function createScoreSection(title, score, grade, subtitle = '', statusText = '') {
    const colorClass = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
    const statusDefault = score >= 80 ? '✓ Good Performance' : score >= 50 ? '⚠ Needs Improvement' : '✗ Poor Performance';

    return `
      <div style="text-align: center; margin-bottom: 3rem; padding: 2.25rem 2rem 2rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; overflow: visible;">
        <h2 style="margin-bottom: 1.5rem; font-size: 1.5rem;">${title}</h2>
        ${renderScoreRing(score, grade, 140)}
        ${subtitle ? `<p style="margin-top: 1rem; color: #888; font-size: 0.95rem;">${subtitle}</p>` : ''}
        <p style="margin-top: 0.75rem; font-size: 1.05rem; color: ${colorClass}; font-weight: 600;">
          ${statusText || statusDefault}
        </p>
      </div>
    `;
  }

  /**
   * Create standardized metric card
   */
  function createMetricCard(value, label, rating, icon = '') {
    const colors = {
      good: '#22c55e',
      average: '#f59e0b',
      poor: '#ef4444',
      unknown: '#9ca3af'
    };
    const color = colors[rating] || '#888';

    return `
      <div class="metric-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 0.75rem; transition: transform 0.2s;">
        ${icon ? `<div style="font-size: 1.5rem; flex-shrink: 0;">${icon}</div>` : ''}
        <div style="font-size: 1.25rem; font-weight: 700; color: ${color}; white-space: nowrap; flex-shrink: 0;">${value}</div>
        <div class="metric-label" style="color: #888; text-transform: uppercase; font-size: 0.6rem; letter-spacing: 0.3px; font-weight: 600; line-height: 1.2; text-align: right; margin-left: auto;">${label}</div>
      </div>
    `;
  }

  /**
   * Create standardized section header
   */
  function createSectionHeader(title, icon = '') {
    return `
      <h3 style="margin: 2.5rem 0 1.5rem 0; font-size: 1.3rem; display: flex; align-items: center; gap: 0.5rem;">
        ${icon ? `<span style="font-size: 1.5rem;">${icon}</span>` : ''}
        ${title}
      </h3>
    `;
  }

  // Simple accordion helper for Lighthouse sections
  let accordionHandlerAttached = false;
  function attachAccordionHandler() {
    if (accordionHandlerAttached) return;
    accordionHandlerAttached = true;
    document.addEventListener('click', (event) => {
      const header = event.target.closest('[data-accordion-toggle]');
      if (!header) return;
      const targetId = header.getAttribute('data-accordion-toggle');
      const body = document.querySelector(`[data-accordion-body="${targetId}"]`);
      if (!body) return;

      body.classList.toggle('accordion__body--open');
      const chevron = header.querySelector('.accordion__chevron');
      if (chevron) {
        chevron.textContent = body.classList.contains('accordion__body--open') ? '▾' : '▸';
      }
    });
  }

  function createAccordion({ id, title, content, defaultOpen = false, isProLocked = false }) {
    ensureProStyles();
    attachAccordionHandler();
    const locked = isProLocked && !userHasPro();
    const chevron = defaultOpen ? '▾' : '▸';
    return `
      <div class="accordion" data-accordion-id="${id}">
        <button class="accordion__header" type="button" data-accordion-toggle="${id}">
          <div class="accordion__title">${title}</div>
          <div class="accordion__meta">
            ${locked ? '<span class="pro-pill">PRO</span>' : ''}
            <span class="accordion__chevron">${chevron}</span>
          </div>
        </button>
        <div class="accordion__body ${defaultOpen ? 'accordion__body--open' : ''}" data-accordion-body="${id}">
          ${locked ? renderLockedProPreview('Detailed fixes locked', ['Full remediation steps', 'PDF-ready recommendations']) : ''}
          <div class="accordion__body-inner ${locked ? 'is-locked' : ''}">${content}</div>
        </div>
      </div>
    `;
  }

  /**
   * Create standardized info box
   */
  function createInfoBox(type, title, content, icon = '') {
    const configs = {
      success: { bg: 'rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)', border: 'rgba(34, 197, 94, 0.3)', titleColor: '#22c55e', contentColor: '#86efac' },
      warning: { bg: 'rgba(245, 158, 11, 0.1), rgba(234, 179, 8, 0.05)', border: 'rgba(245, 158, 11, 0.3)', titleColor: '#f59e0b', contentColor: '#fbbf24' },
      error: { bg: 'rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.05)', border: 'rgba(239, 68, 68, 0.3)', titleColor: '#ef4444', contentColor: '#fca5a5' },
      info: { bg: 'rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05)', border: 'rgba(59, 130, 246, 0.3)', titleColor: '#3b82f6', contentColor: '#93c5fd' }
    };
    const config = configs[type] || configs.info;

    return `
      <div style="background: linear-gradient(135deg, ${config.bg}); border: 1px solid ${config.border}; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
        <h3 style="color: ${config.titleColor}; margin: 0 0 ${content ? '1rem' : '0'} 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem;">
          ${icon ? `<span style="font-size: 1.25rem;">${icon}</span>` : ''}
          ${title}
        </h3>
        ${content ? `<div style="color: ${config.contentColor}; font-size: 0.95rem; line-height: 1.6;">${content}</div>` : ''}
      </div>
    `;
  }

  /**
   * Create upgrade/next steps section
   */
  function createNextStepsSection(currentMode) {
    const steps = {
      quick: {
        title: 'Want More Detailed Analysis?',
        buttons: [
          { mode: 'full', label: 'Run Full Lighthouse Audit', style: 'primary', icon: '🔍' },
          { mode: 'cwv', label: 'Check Core Web Vitals', style: 'secondary', icon: '📊' }
        ]
      },
      full: {
        title: 'Additional Analysis Options',
        buttons: [
          { mode: 'quick', label: 'Quick Resource Scan', style: 'secondary', icon: '⚡' },
          { mode: 'cwv', label: 'Check Core Web Vitals', style: 'secondary', icon: '📊' }
        ]
      },
      cwv: {
        title: 'Additional Analysis Options',
        buttons: [
          { mode: 'quick', label: 'Quick Resource Scan', style: 'secondary', icon: '⚡' },
          { mode: 'full', label: 'Run Full Lighthouse Audit', style: 'secondary', icon: '🔍' }
        ]
      }
    };

    const config = steps[currentMode] || steps.quick;

    return `
      <div class="no-print" style="text-align: center; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1);">
        <p style="color: #888; margin-bottom: 1.5rem; font-size: 1rem;">${config.title}</p>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          ${config.buttons.map(btn => {
            const isPrimary = btn.style === 'primary';
            return `
              <button onclick="switchToMode('${btn.mode}')" style="
                background: ${isPrimary ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'transparent'};
                border: ${isPrimary ? 'none' : '1px solid rgba(255,255,255,0.2)'};
                color: #fff;
                padding: 0.75rem 2rem;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: transform 0.2s, box-shadow 0.2s;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
              " onmouseover="this.style.transform='translateY(-2px)'; ${isPrimary ? `this.style.boxShadow='0 4px 12px rgba(59,130,246,0.4)'` : ''}" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                <span>${btn.icon}</span>
                ${btn.label}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ==================== PRO + SUMMARY HELPERS ====================

  function ensurePerformanceProAccess() {
    const domain = getCurrentDomain();
    if (userHasPro()) return true;
    if (typeof openProPaywall === 'function') {
      openProPaywall({ domain, context: 'performance' });
      return false;
    }
    // Fallback if paywall script is not present
    alert('Exports and sharing are Pro features. Please sign in with Pro.');
    return false;
  }

  async function exportPerformancePDF() {
    if (!ensurePerformanceProAccess()) return;
    // Use the unified PDF export utility
    if (typeof window.exportReportPDF === 'function') {
      const button = document.querySelector('[data-export="pdf"]');
      await window.exportReportPDF({
        reportType: 'performance',
        buttonElement: button
      });
    } else {
      console.error('PDF export utility not loaded');
      alert('PDF export is not available. Please refresh the page.');
    }
  }

  function copyPerformanceShareLink() {
    if (!ensurePerformanceProAccess()) return;
    const current = window.currentPerformanceHubResults || {};
    const targetUrl = current.url || window.location.href;
    const modeParam = current.mode ? `&mode=${current.mode}` : '';
    const shareUrl = `${window.location.origin}/performance-hub.html?url=${encodeURIComponent(targetUrl)}${modeParam}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Share link copied to clipboard');
    });
  }

  function downloadPerformanceCSV() {
    if (!ensurePerformanceProAccess()) return;
    const current = window.currentPerformanceHubResults || {};
    const mode = current.mode || 'quick';
    const data = current.data || current;

    const rows = [
      ['Mode', mode],
      ['URL', current.url || ''],
      ['Performance Score', data?.performanceScore || data?.score || data?.overallScore || ''],
      ['Pages Scanned', data?.pagesScanned || ''],
      ['Recommendations', (data?.recommendations?.length || data?.recommendations?.recommendations?.length || 0)],
      ['Issues', (data?.issues?.length || 0)]
    ];

    const csv = rows
      .map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'performance-report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function calculatePerformanceSummary({ mode, issues = 0, recommendations = 0, checks = 0 }) {
    return {
      mode,
      issues: Math.max(issues, 0),
      recommendations: Math.max(recommendations, 0),
      checks: Math.max(checks, 0)
    };
  }

  function countQuickChecks(summary) {
    if (!summary) return 0;
    const keys = ['totalRequests', 'estimatedPageWeightKB', 'renderBlockingCount', 'serverResponseTime'];
    return keys.filter(k => summary[k] !== undefined && summary[k] !== null).length;
  }

  function countLighthouseChecks(desktop, mobile) {
    const categories = ['performance', 'accessibility', 'bestPractices', 'seo'];
    const countCategories = (node) => categories.reduce((acc, key) => acc + (node?.lighthouse && node.lighthouse[key] !== undefined ? 1 : 0), 0);
    return countCategories(desktop) + countCategories(mobile);
  }

  function countCWVChecks(desktop, mobile) {
    const metrics = ['lcp', 'cls', 'inp', 'fid', 'tti'];
    const countMetrics = (node) => metrics.filter(key => node && (node[key] !== undefined || node[key.toUpperCase()] !== undefined)).length;
    return countMetrics(desktop) + countMetrics(mobile);
  }

  function renderPerformanceSummaryFooter(stats) {
    ensureProStyles();
    return `
      <div class="summary-footer">
        <div class="summary-footer__pill">Speed & UX</div>
        <div class="summary-footer__stats">
          <div><div class="summary-footer__label">Issues</div><div class="summary-footer__value">${stats.issues}</div></div>
          <div><div class="summary-footer__label">Recommendations</div><div class="summary-footer__value">${stats.recommendations}</div></div>
          <div><div class="summary-footer__label">Checks</div><div class="summary-footer__value">${stats.checks}</div></div>
        </div>
      </div>
    `;
  }

  // Summary section matching SEO layout - [SUMMARY] block after accordions
  function renderPerformanceSummarySection(stats) {
    return `
      <div class="section">
        <h2>Summary</h2>
        <div class="seo-summary">
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-value">${stats.issues}</span>
              <span class="stat-label">Issues Found</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stats.recommendations}</span>
              <span class="stat-label">Recommendations</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stats.checks}</span>
              <span class="stat-label">Checks Passed</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Pro Report Block - Unified export/share section
  function renderPerformanceTakeActionSection(url, mode) {
    function escapeAttr(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function getOrComputeReportId() {
      const startedAt = document.body.getAttribute('data-sm-scan-started-at') || window.SM_SCAN_STARTED_AT || '';
      const analyzerKey = document.body.getAttribute('data-sm-analyzer-key') || window.SM_ANALYZER_KEY || '';

      // Check body attribute first
      const existing = document.body.getAttribute('data-report-id') || '';
      if (existing) return existing;

      // Check URL params (from billing return or dashboard)
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('report_id') || params.get('reportId') || '';
      if (fromUrl) {
        document.body.setAttribute('data-report-id', fromUrl);
        return fromUrl;
      }

      // Compute new reportId as fallback
      const computed =
        window.ReportUI && typeof window.ReportUI.makeReportId === 'function'
          ? window.ReportUI.makeReportId({ analyzerKey, normalizedUrl: url, startedAtISO: startedAt })
          : window.ReportUI && typeof window.ReportUI.computeReportId === 'function'
          ? window.ReportUI.computeReportId(url, startedAt, analyzerKey)
          : '';

      if (computed) document.body.setAttribute('data-report-id', computed);
      return computed;
    }

    function renderPaidUnlockCard(reportId) {
      const encodedUrl = escapeAttr(encodeURIComponent(url || ''));
      const tools = [
        {
          href: `/performance-hub.html?url=${encodedUrl}&mode=cwv`,
          icon: '📊',
          title: 'Core Web Vitals Analyzer',
          description: 'Google ranking metrics: LCP, FID, CLS (~15–30s)',
          note: 'Includes optional paid report export inside this tool'
        },
        {
          href: `/performance-hub.html?url=${encodedUrl}&mode=full`,
          icon: '🔍',
          title: 'Lighthouse Audit',
          description: 'Full Lighthouse run with diagnostics (~2–3 min)',
          note: 'Includes optional paid report export inside this tool'
        },
        {
          href: `/mobile-analyzer.html?url=${encodedUrl}`,
          icon: '📱',
          title: 'Mobile UX Analyzer',
          description: 'Mobile responsiveness and usability testing',
          note: 'Includes optional paid report export inside this tool'
        }
      ];

      return `
        <div class="section">
          <div class="pro-report-block pro-report-block--explore-tools" data-report-id="${escapeAttr(reportId)}">
            <div class="pro-report-block__header">
              <div class="pro-report-block__icon">🧰</div>
              <div class="pro-report-block__text">
                <div class="pro-report-block__title">Explore More Performance Tools</div>
                <p class="pro-report-block__subtitle">Run additional performance and UX analysis with specialized tools (scans are free; report exports are paid)</p>
              </div>
            </div>

            <div class="pro-report-block__actions">
              ${tools
                .map(
                  (tool) => `
                    <a class="pro-report-block__action pro-report-block__action--link" href="${tool.href}">
                      <div class="pro-report-block__action-icon">${tool.icon}</div>
                      <div class="pro-report-block__action-text">
                        <div class="pro-report-block__action-label">${tool.title}</div>
                        <div class="pro-report-block__action-description">${tool.description}</div>
                        <div class="pro-report-block__action-note">${tool.note || ''}</div>
                      </div>
                      <div class="pro-report-block__action-chevron" aria-hidden="true">›</div>
                    </a>
                  `
                )
                .join('')}
            </div>

            <p class="pro-report-block__helper-text">Scans are free to run. Optional paid exports (PDF/share/data) are available inside each tool.</p>
          </div>
        </div>
      `;
    }

    // Render "Continue Analyzing" section with links to other free scans
    function renderContinueAnalyzingSection() {
      const encodedUrl = escapeAttr(encodeURIComponent(url || ''));
      const otherScans = [
        {
          href: `/seo-analyzer.html?url=${encodedUrl}`,
          icon: '🔍',
          title: 'SEO Analysis',
          description: 'Meta tags, headings, structured data, and search optimization'
        },
        {
          href: `/security-analyzer.html?url=${encodedUrl}`,
          icon: '🔒',
          title: 'Security Scan',
          description: 'SSL, security headers, vulnerabilities, and OWASP compliance'
        },
        {
          href: `/accessibility-analyzer.html?url=${encodedUrl}`,
          icon: '♿',
          title: 'Accessibility Audit',
          description: 'WCAG compliance, screen reader compatibility, color contrast'
        },
        {
          href: `/enhanced-fonts.html?url=${encodedUrl}`,
          icon: '🔤',
          title: 'Font Analysis',
          description: 'Font loading performance, web font optimization, typography'
        }
      ];

      return `
        <div class="section" style="margin-top: 1.5rem;">
          <div style="background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.08), rgba(var(--accent-primary-rgb), 0.02)); border: 1px solid rgba(var(--accent-primary-rgb), 0.2); border-radius: 12px; padding: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
              <span style="font-size: 1.5rem;">🚀</span>
              <div>
                <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">Continue Analyzing</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">Get a complete picture of your site's health with these free scans</div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
              ${otherScans.map(scan => `
                <a href="${scan.href}" style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; text-decoration: none; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--accent-primary)'; this.style.background='rgba(var(--accent-primary-rgb), 0.05)';" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.background='rgba(255,255,255,0.03)';">
                  <span style="font-size: 1.5rem;">${scan.icon}</span>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">${scan.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.3;">${scan.description}</div>
                  </div>
                  <span style="color: var(--accent-primary); font-size: 1.25rem;">›</span>
                </a>
              `).join('')}
            </div>

            <p style="margin: 1rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary); text-align: center;">
              All scans are <strong style="color: var(--accent-primary);">free</strong> to run. Get comprehensive insights across all areas of your site.
            </p>
          </div>
        </div>
      `;
    }

    // Get the report ID for this scan
    const reportId = getOrComputeReportId();

    // Render ProReportBlock (Unlock Report section) - only for paid scan modes (CWV, Full)
    function renderUnlockReportSection() {
      // Check if ProReportBlock component is available
      if (window.ProReportBlock && typeof window.ProReportBlock.render === 'function') {
        return window.ProReportBlock.render({
          context: mode === 'cwv' ? 'speed-ux-cwv' : 'speed-ux-full',
          features: ['pdf', 'excel', 'csv', 'share'],
          title: 'Unlock Report',
          subtitle: 'PDF export, share link, export data, and fix packs for this scan.',
          reportId
        });
      }

      // Fallback if ProReportBlock not loaded
      return '';
    }

    // For quick scan: Show CWV & Lighthouse promotion + other free scans
    // Quick scan is FREE - no "Unlock Report" section needed
    if (mode === 'quick') {
      return `
        ${renderPaidUnlockCard(reportId)}
        ${renderContinueAnalyzingSection()}
      `;
    }

    // For CWV and Full modes: Show Unlock Report section + other free scans
    return `
      ${renderUnlockReportSection()}
      ${renderContinueAnalyzingSection()}
    `;
  }

  function renderPerformanceActionFooter(url, mode) {
    ensureProStyles();
    const locked = !userHasPro();
    return `
      <div class="take-action">
        <div class="take-action__header">
          <div>
            <div class="take-action__title">Take Action</div>
            <div class="take-action__subtitle">Export and share results (Pro)</div>
          </div>
          <span class="pro-pill">PRO</span>
        </div>
        <div class="take-action__actions">
          <button class="take-action__btn" ${locked ? '' : ''} onclick="exportPerformancePDF()">Export PDF</button>
          <button class="take-action__btn" onclick="copyPerformanceShareLink()">Share Link</button>
          <button class="take-action__btn" onclick="downloadPerformanceCSV()">Download CSV</button>
        </div>
        ${locked ? renderLockedProPreview('Pro export locked', ['Export PDF', 'Share Link', 'Download CSV']) : ''}
      </div>
    `;
  }

  function renderLockedProPreview(title = 'Pro content', previewLines = []) {
    const lines = previewLines.length ? previewLines : ['Unlock exports', 'Unlock sharing'];
    return `
      <div class="pro-locked">
        <div class="pro-locked__header">
          <span class="pro-pill">PRO</span>
          <span>${title}</span>
        </div>
        <ul class="pro-locked__list">
          ${lines.slice(0, 2).map(line => `<li>${line}</li>`).join('')}
        </ul>
        <div class="pro-locked__blur"></div>
        <div class="pro-locked__buttons">
          <button class="pro-locked__unlock pro-locked__unlock--primary" data-buy-single-report data-context="performance">Unlock for $10</button>
          <button class="pro-locked__unlock pro-locked__unlock--secondary" data-open-pricing-modal data-context="performance">Go Pro — $20/mo</button>
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
        border-radius: 10px;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.02);
        overflow: hidden;
        margin-top: 1rem;
      }
      .pro-locked__header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        color: #c7f5d9;
        margin-bottom: 0.5rem;
      }
      .pro-locked__list {
        margin: 0;
        padding-left: 1.25rem;
        color: #a7a7a7;
        position: relative;
        z-index: 1;
      }
      .pro-locked__blur {
        position: absolute;
        inset: 0;
        backdrop-filter: blur(4px);
        background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%);
        z-index: 0;
      }
      .pro-locked__buttons {
        position: relative;
        z-index: 1;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.75rem;
      }
      .pro-locked__unlock {
        position: relative;
        z-index: 1;
        padding: 0.6rem 1rem;
        border-radius: 6px;
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
      .summary-footer {
        margin: 2rem 0 0 0;
        padding: 1.25rem 1rem;
        border-radius: 10px;
        border: 1px solid rgba(var(--accent-primary-rgb), 0.2);
        background: rgba(var(--accent-primary-rgb), 0.05);
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .summary-footer__pill {
        font-weight: 700;
        color: var(--accent-primary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .summary-footer__stats {
        display: flex;
        gap: 1.5rem;
        flex-wrap: wrap;
      }
      .summary-footer__label {
        font-size: 0.8rem;
        color: #a7a7a7;
      }
      .summary-footer__value {
        font-size: 1.1rem;
        font-weight: 700;
        color: #e6ffe6;
      }
      .take-action {
        margin-top: 1.25rem;
        padding: 1.25rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        background: rgba(255,255,255,0.02);
      }
      .take-action__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }
      .take-action__title {
        font-weight: 700;
      }
      .take-action__subtitle {
        color: #a7a7a7;
        font-size: 0.9rem;
      }
      .take-action__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .take-action__btn {
        background: linear-gradient(135deg, #1f2937, #111827);
        border: 1px solid rgba(0, 255, 65, 0.3);
        color: #e6ffe6;
        padding: 0.65rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
      }
      .lh-report-card {
        background: linear-gradient(135deg, rgba(0,255,65,0.05) 0%, rgba(0,255,65,0.02) 100%);
        border: 1px solid rgba(0,255,65,0.25);
        border-radius: 14px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 4px 16px rgba(0,255,65,0.08);
      }
      .lh-report-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
        color: #c7f5d9;
        font-size: 0.95rem;
      }
      .lh-report-title {
        font-weight: 700;
        font-size: 1.1rem;
        color: #00ff41;
      }
      .lh-report-meta {
        color: #a7a7a7;
        font-size: 0.9rem;
      }
      .lh-report-score {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        flex-wrap: wrap;
      }
      .lh-score-caption {
        color: #e6ffe6;
        font-size: 0.95rem;
      }
      .lh-score-subtitle {
        color: #a7a7a7;
        margin-bottom: 0.35rem;
      }
      .lh-score-status {
        font-weight: 700;
        color: #00ff41;
      }
      .lh-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .lh-device-card {
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 1.25rem;
        box-shadow: 0 2px 10px rgba(0,0,0,0.25);
      }
      .lh-device-header {
        font-weight: 700;
        color: #e6ffe6;
        margin-bottom: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }
      .lh-metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.75rem;
        margin-bottom: 0.75rem;
      }
      .lh-metric-grid--cwv {
        border-top: 1px solid rgba(255,255,255,0.05);
        padding-top: 0.75rem;
      }
      .accordion {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        margin: 1rem 0;
        background: rgba(255,255,255,0.02);
      }
      .accordion__header {
        width: 100%;
        background: transparent;
        border: none;
        color: #e5e7eb;
        padding: 1rem 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        font-weight: 700;
        font-size: 1rem;
      }
      .accordion__title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .accordion__meta {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
      .accordion__chevron {
        font-size: 1rem;
      }
      .accordion__body {
        display: none;
        padding: 0 1.25rem 1.25rem 1.25rem;
      }
      .accordion__body--open {
        display: block;
      }
      .accordion__body-inner.is-locked {
        filter: blur(2px);
        pointer-events: none;
        user-select: none;
      }
    `;
    document.head.appendChild(style);
  }

  function getCurrentDomain() {
    if (window.ProAccess && typeof window.ProAccess.getCurrentDomain === 'function') {
      return window.ProAccess.getCurrentDomain();
    }
    return window.location.hostname;
  }

  function userHasPro() {
    // Check new billing model first (ProReportBlock)
    const reportId = document.body?.getAttribute('data-report-id') || '';
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

  // Expose Pro actions globally for inline handlers
  window.exportPerformancePDF = exportPerformancePDF;
  window.copyPerformanceShareLink = copyPerformanceShareLink;
  window.downloadPerformanceCSV = downloadPerformanceCSV;

  // Expose display functions globally for billing return flow
  window.displayPerformanceResults = displayResults;
  window.displayCWVResults = displayCWVResults;

  // ==================== PAYMENT GATE FUNCTIONS ====================

  /**
   * Check if user has paid for a specific report
   */
  async function checkPaymentStatus(reportType, url) {
    // Check localStorage for payment status
    const paymentKey = `paid_${reportType}_${url}`;
    const paidTimestamp = localStorage.getItem(paymentKey);

    if (paidTimestamp) {
      // Payment is valid for 24 hours
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      if (parseInt(paidTimestamp) > oneDayAgo) {

        return true;
      }
    }

    // Check URL params for payment success
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess = params.get('payment') === 'success';
    const paramReportType = params.get('type');
    const paramUrl = params.get('url');

    if (paymentSuccess && paramReportType === reportType && paramUrl === url) {
      // Store payment in localStorage
      localStorage.setItem(paymentKey, Date.now().toString());

      // Clean up URL params
      window.history.replaceState({}, '', window.location.pathname);

      return true;
    }

    return false;
  }

  /**
   * Show payment gate modal
   */
  function showPaymentGate(reportType, url) {
    const config = {
      cwv: {
        title: 'Core Web Vitals Report',
        icon: '📊',
        description: 'Get detailed Core Web Vitals analysis including LCP, INP, and CLS metrics for both mobile and desktop.',
        features: [
          'Mobile & Desktop CWV metrics',
          'Google ranking impact analysis',
          'Detailed metric breakdowns',
          'Actionable recommendations',
          'Professional PDF export'
        ],
        color: '#10b981'
      },
      lighthouse: {
        title: 'Lighthouse Full Audit',
        icon: '🔍',
        description: 'Complete Lighthouse performance audit with detailed scores and optimization recommendations.',
        features: [
          'Performance, Accessibility, Best Practices scores',
          'Mobile & Desktop analysis',
          'Detailed performance metrics',
          'Specific optimization opportunities',
          'Professional PDF export'
        ],
        color: '#8b5cf6'
      }
    };

    const info = config[reportType];
    const modalHTML = `
      <div id="paymentGateModal" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(8px);
      ">
        <div style="
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          border: 2px solid ${info.color};
          border-radius: 16px;
          padding: 2.5rem;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: slideIn 0.3s ease-out;
        ">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 2rem;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">${info.icon}</div>
            <h2 style="color: ${info.color}; margin: 0 0 0.5rem 0; font-size: 1.75rem;">${info.title}</h2>
            <p style="color: #aaa; margin: 0; font-size: 1rem;">${info.description}</p>
          </div>

          <!-- Features -->
          <div style="background: rgba(255, 255, 255, 0.03); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
            <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">What's included:</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${info.features.map(feature => `
                <li style="color: #ccc; margin-bottom: 0.75rem; padding-left: 1.5rem; position: relative;">
                  <span style="position: absolute; left: 0; color: ${info.color};">✓</span>
                  ${feature}
                </li>
              `).join('')}
            </ul>
          </div>

          <!-- Pricing Options -->
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1rem;">
              <div style="flex: 1; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 1rem;">
                <div style="font-size: 1.5rem; font-weight: bold; color: ${info.color};">$10</div>
                <div style="color: #888; font-size: 0.75rem;">This report only</div>
              </div>
              <div style="flex: 1; background: rgba(91, 244, 231, 0.1); border: 1px solid rgba(91, 244, 231, 0.3); border-radius: 8px; padding: 1rem;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #5bf4e7;">$20/mo</div>
                <div style="color: #888; font-size: 0.75rem;">All reports</div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button id="proceedPaymentBtn" style="
              background: linear-gradient(135deg, ${info.color}, ${info.color}dd);
              border: none;
              color: #fff;
              padding: 0.875rem 1.5rem;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 700;
              font-size: 1rem;
              transition: all 0.2s;
              box-shadow: 0 4px 12px ${info.color}40;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px ${info.color}60'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px ${info.color}40'">
              Unlock for $10
            </button>
            <button id="goProBtn" style="
              background: transparent;
              border: 1px solid #5bf4e7;
              color: #5bf4e7;
              padding: 0.875rem 1.5rem;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
              font-size: 1rem;
              transition: all 0.2s;
            " onmouseover="this.style.background='rgba(91, 244, 231, 0.1)'" onmouseout="this.style.background='transparent'">
              Go Pro — $20/mo
            </button>
            <button id="cancelPaymentBtn" style="
              background: transparent;
              border: none;
              color: #888;
              padding: 0.5rem;
              cursor: pointer;
              font-size: 0.875rem;
            ">
              Cancel
            </button>
          </div>

          <!-- Trust badges -->
          <div style="text-align: center; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="color: #666; font-size: 0.8rem; margin-bottom: 0.5rem;">
              🔒 Secure payment powered by Stripe
            </div>
            <div style="color: #555; font-size: 0.75rem;">
              Pro unlocks all reports • Single purchase unlocks this scan only
            </div>
          </div>
        </div>
      </div>

      <style>
        @keyframes slideIn {
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

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listeners
    document.getElementById('cancelPaymentBtn').addEventListener('click', () => {
      document.getElementById('paymentGateModal').remove();
      analyzeButton.disabled = false;
      buttonText.textContent = 'Analyze';
      if (loader) loader.complete();
    });

    document.getElementById('proceedPaymentBtn').addEventListener('click', () => {
      createPaymentSession(reportType, url);
    });

    // Go Pro button opens pricing modal
    document.getElementById('goProBtn').addEventListener('click', () => {
      document.getElementById('paymentGateModal').remove();
      if (window.PricingModal && typeof window.PricingModal.open === 'function') {
        window.PricingModal.open();
      }
    });
  }

  /**
   * Create Stripe checkout session
   */
  async function createPaymentSession(reportType, url) {
    const proceedBtn = document.getElementById('proceedPaymentBtn');
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Creating checkout...';

    try {
      const startedAt = document.body.getAttribute('data-sm-scan-started-at') || window.SM_SCAN_STARTED_AT || '';
      const analyzerKey = document.body.getAttribute('data-sm-analyzer-key') || window.SM_ANALYZER_KEY || '';
      const reportId =
        document.body.getAttribute('data-report-id') ||
        (window.ReportUI && typeof window.ReportUI.makeReportId === 'function'
          ? window.ReportUI.makeReportId({ analyzerKey, normalizedUrl: url, startedAtISO: startedAt })
          : window.ReportUI && typeof window.ReportUI.computeReportId === 'function'
          ? window.ReportUI.computeReportId(url, startedAt, analyzerKey)
          : '');

      const params = new URLSearchParams(window.location.search);
      params.delete('session_id');
      params.delete('sessionId');
      params.delete('canceled');
      if (reportId) params.set('reportId', reportId);
      // Include URL and report type for resuming analysis after payment
      params.set('url', url);
      params.set('report_type', reportType);
      params.set('auto_scan', 'true'); // Auto-run scan after payment
      const returnUrl = `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;

      // Get auth token for authenticated checkout (check both key names)
      const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          purchaseType: 'single_report',
          reportId: reportId || null,
          returnUrl
        })
      });

      const data = await response.json();

      if (!response.ok || !data.checkoutUrl) {
        throw new Error((data && data.error) || 'Failed to create payment session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.checkoutUrl;

    } catch (error) {
      console.error('Payment error:', error);
      proceedBtn.disabled = false;
      proceedBtn.textContent = 'Unlock for $10';
      alert(`Payment error: ${error.message}`);
    }
  }
});
