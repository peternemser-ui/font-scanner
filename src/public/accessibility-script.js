/**
 * Accessibility Analyzer - Frontend Script
 * Handles UI interactions and displays accessibility analysis results
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'accessibility';
document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);

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
      const cachedResults = sessionStorage.getItem('sm_checkout_results');
      const cachedAnalyzer = sessionStorage.getItem('sm_checkout_analyzer') || '';
      if (cachedResults && cachedAnalyzer.includes('accessibility')) {
        try {
          console.log('[Accessibility] Loading cached results from sessionStorage');
          const results = JSON.parse(cachedResults);
          displayAccessibilityResults(results);
          // Clear after successful display
          sessionStorage.removeItem('sm_checkout_results');
          sessionStorage.removeItem('sm_checkout_analyzer');
          loaded = true;
        } catch (e) {
          console.warn('[Accessibility] Failed to parse cached results:', e);
        }
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
            <strong>Report needs to be regenerated</strong><br>
            <span style="font-size: 0.9em; opacity: 0.9;">
              Click "Analyze" to view your purchased report. It will be saved for instant access next time.
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
window.addEventListener('sm:restoreScanResults', (e) => {
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
    displayAccessibilityResults(results);
  }
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
  let { preserveReportId = false } = options;
  const url = urlInput.value.trim();

  if (!url) {
    showError('Please enter a valid URL');
    return;
  }

  // Auto-detect if we should preserve report_id: if there's an existing one and user has paid access
  const existingReportId = document.body.getAttribute('data-report-id');
  if (!preserveReportId && existingReportId && window.ProReportBlock?.hasAccess?.(existingReportId)) {
    console.log('[Accessibility] Auto-preserving purchased report_id:', existingReportId);
    preserveReportId = true;
  }

  // CRITICAL: Save the existing report_id BEFORE cleanup if we need to preserve it
  // This is used for billing return re-scans where the purchased report_id must be kept
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
  buttonText.textContent = 'Analyzing...';

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
      Analyzing accessibility across both platforms...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: 0.8rem; color: rgba(var(--accent-primary-rgb), 0.7);">
      This may take 30-60 seconds
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
  
  const analysisSteps = [
    {
      label: 'Initializing WCAG audit',
      detail: 'Starting accessibility analysis...'
    },
    {
      label: 'Checking color contrast',
      detail: 'Testing text readability and WCAG ratios...'
    },
    {
      label: 'Testing keyboard navigation',
      detail: 'Verifying tab order and focus management...'
    },
    {
      label: 'Analyzing ARIA attributes',
      detail: 'Checking semantic markup and labels...'
    },
    {
      label: 'Testing screen reader compatibility',
      detail: 'Evaluating assistive technology support...'
    }
  ];

  loader.start(analysisSteps, '[ACCESSIBILITY ANALYZER]', 20);
  
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
    const response = await fetch('/api/accessibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, scanStartedAt })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
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
    }, 1000);

  } catch (error) {
    loader.showError(error.message || 'Failed to analyze accessibility. Please try again.');
    console.error('Accessibility analysis error:', error);
  } finally {
    // Reset button state
    analyzeButton.disabled = false;
    const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
    buttonText.textContent = 'Analyze';
  }
}

/**
 * Animate progress bar
 */
function animateProgress() {
  const stages = [
    { progress: 20, text: 'Running Lighthouse accessibility audit...' },
    { progress: 40, text: 'Analyzing color contrast ratios...' },
    { progress: 60, text: 'Testing keyboard navigation...' },
    { progress: 80, text: 'Validating ARIA implementation...' },
    { progress: 95, text: 'Compiling accessibility report...' }
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
      progressText.textContent = 'Analysis complete!';
    }
  }, 2000);
}

/**
 * Display accessibility results
 */
function displayAccessibilityResults(resultData) {
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
          <h3 style="margin: 0 0 10px 0;">Report Type Mismatch</h3>
          <p style="margin: 0;">The stored report appears to be from a different analyzer. Please run a new accessibility scan.</p>
          <button onclick="window.location.reload()" style="
            margin-top: 15px;
            padding: 10px 20px;
            background: white;
            color: #dc2626;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          ">Run New Scan</button>
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
      title: 'Accessibility Report: WCAG Compliance',
      showModeBadge: false,
      showModeMeta: false
    });
  } else {
    // Fallback header
    reportHeader.innerHTML = `
      <div class="report-header">
        <h1 class="report-header__title">Accessibility Report: WCAG Compliance</h1>
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
            <span class="meta-item__text">${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' })}</span>
          </span>
        </div>
      </div>
    `;
  }
  reportScope.appendChild(reportHeader);

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
          <h3 style="color: #bb86fc; margin: 0 0 1rem 0; font-size: 1.3rem;">>> Quick Stats</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">WCAG Level</span>
              <span style="color: #bb86fc; font-weight: bold;">${results.wcagLevel || 'AA'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Violations Found</span>
              <span style="color: ${results.violationsCount > 0 ? '#ff4444' : '#00ff41'}; font-weight: bold;">${results.violationsCount || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Contrast Issues</span>
              <span style="color: ${results.contrastIssues > 0 ? '#ffa500' : '#00ff41'}; font-weight: bold;">${results.contrastIssues || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
              <span style="color: #c0c0c0;">Best Practices</span>
              <span style="color: #bb86fc; font-weight: bold;">${results.bestPracticesCount || 0} passed</span>
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
      title: 'WCAG 2.1 Compliance',
      scoreTextRight: `${avgWcagScore}/100`,
      contentHTML: renderWCAGContent(results.desktop?.wcag, results.mobile?.wcag)
    }),
    ReportAccordion.createSection({
      id: 'color-contrast',
      title: 'Color Contrast Analysis',
      scoreTextRight: `${avgContrastScore}/100`,
      contentHTML: renderContrastContent(results.contrast)
    }),
    ReportAccordion.createSection({
      id: 'keyboard-navigation',
      title: 'Keyboard Navigation',
      scoreTextRight: `${avgKeyboardScore}/100`,
      contentHTML: renderKeyboardContent(results.keyboard)
    }),
    ReportAccordion.createSection({
      id: 'aria-implementation',
      title: 'ARIA & Semantics',
      scoreTextRight: `${avgAriaScore}/100`,
      isPro: true,
      locked: !userHasPro(),
      context: 'accessibility',
      contentHTML: renderARIAContent(results.aria)
    }),
    ReportAccordion.createSection({
      id: 'report-recommendations',
      title: 'Fix Code + Recommendations',
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
    <h2>Summary</h2>
    <div class="seo-summary">
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-value">${countAccessibilityIssues(results)}</span>
          <span class="stat-label">Issues Found</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${countAccessibilityRecommendations(results)}</span>
          <span class="stat-label">Recommendations</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${countAccessibilityPassedChecks(results)}</span>
          <span class="stat-label">Checks Passed</span>
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
      features: ['pdf', 'csv', 'share'],
      title: 'Unlock Report',
      subtitle: 'PDF export, share link, export data, and fix packs for this scan.'
    });
  } else {
    // Fallback/legacy code
    actionsFooter.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(var(--accent-primary-rgb), 0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--accent-primary); font-weight: 600;">Take Action</span>
          <span style="color: #666; font-size: 0.9rem;">Export or share this accessibility report</span>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button onclick="exportAccessibilityPDF()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid rgba(var(--accent-primary-rgb), 0.4); background: rgba(var(--accent-primary-rgb), 0.1); color: var(--accent-primary); cursor: pointer; font-weight: 600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            PDF Report
          </button>
          <button onclick="copyAccessibilityShareLink()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.05); color: #fff; cursor: pointer; font-weight: 600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share Link
          </button>
          <button onclick="downloadAccessibilityCSV()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.05); color: #fff; cursor: pointer; font-weight: 600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7"/><path d="M3 7h18"/><path d="M10 11h4"/><path d="M10 15h4"/><path d="M6 11h.01"/><path d="M6 15h.01"/><path d="M18 11h.01"/><path d="M18 15h.01"/></svg>
            Export Data
          </button>
        </div>
      </div>
    `;
  }
  reportScope.appendChild(actionsFooter);

  // Append the complete report scope to container
  container.appendChild(reportScope);

  // Auto-save report if user has access (purchased or Pro)
  const reportId = document.body.getAttribute('data-report-id') || '';
  if (reportId && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
    window.ReportStorage.autoSaveIfEligible(reportId, results, {
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
    <h2>WCAG Compliance Levels</h2>
    <div class="wcag-section-container" style="padding-left: 1rem;">
      <p style="color: #ffd700; margin-bottom: 1.5rem;">>> Understanding WCAG 2.1 Conformance Levels</p>
      
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
            Level A
          </h3>
          <div style="text-align: center; margin-bottom: 1rem;">
            <span style="
              color: #ffd700;
              font-size: 0.9rem;
              padding: 0.3rem 0.8rem;
              border-radius: 4px;
              background: rgba(255,215,0,0.2);
              border: 1px solid rgba(255,215,0,0.4);
            ">Minimum Accessibility</span>
          </div>
          <p style="color: #c0c0c0; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem;">
            Removes the most critical barriers to access for people with disabilities. Websites meeting Level A are considered barely accessible.
          </p>
          <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 1rem; margin-top: 1rem;">
            <div style="color: #808080; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600;">Key Requirements:</div>
            <ul style="color: #b0b0b0; font-size: 0.85rem; margin: 0; padding-left: 1.2rem; line-height: 1.8;">
              <li>Text alternatives for images</li>
              <li>Keyboard accessibility</li>
              <li>No seizure-inducing content</li>
            </ul>
          </div>
          <div style="margin-top: 1rem; text-align: center; color: #808080; font-size: 0.8rem;">
            ◉ Score: 60-79
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
            Level AA
          </h3>
          <div style="text-align: center; margin-bottom: 1rem;">
            <span style="
              color: #00ff41;
              font-size: 0.9rem;
              padding: 0.3rem 0.8rem;
              border-radius: 4px;
              background: rgba(0,255,65,0.2);
              border: 1px solid rgba(0,255,65,0.4);
            ">Industry Standard</span>
          </div>
          <p style="color: #c0c0c0; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem;">
            The accepted legal and industry standard (ADA, Section 508, EN 301 549). Ensures content is accessible to most users with disabilities.
          </p>
          <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 1rem; margin-top: 1rem;">
            <div style="color: #808080; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600;">Key Requirements:</div>
            <ul style="color: #b0b0b0; font-size: 0.85rem; margin: 0; padding-left: 1.2rem; line-height: 1.8;">
              <li>Sufficient color contrast (4.5:1)</li>
              <li>Visible focus indicators</li>
              <li>Content reflows properly</li>
              <li>All Level A requirements</li>
            </ul>
          </div>
          <div style="margin-top: 1rem; text-align: center; color: #808080; font-size: 0.8rem;">
            ◉ Score: 80-94
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
            Level AAA
          </h3>
          <div style="text-align: center; margin-bottom: 1rem;">
            <span style="
              color: #00d9ff;
              font-size: 0.9rem;
              padding: 0.3rem 0.8rem;
              border-radius: 4px;
              background: rgba(0,217,255,0.2);
              border: 1px solid rgba(0,217,255,0.4);
            ">Highest Accessibility</span>
          </div>
          <p style="color: #c0c0c0; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem;">
            Highest conformance level. Addresses all accessibility requirements. Required for government and healthcare sites, recommended for public-facing applications.
          </p>
          <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 1rem; margin-top: 1rem;">
            <div style="color: #808080; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600;">Key Requirements:</div>
            <ul style="color: #b0b0b0; font-size: 0.85rem; margin: 0; padding-left: 1.2rem; line-height: 1.8;">
              <li>Sign language interpretation</li>
              <li>Extended audio descriptions</li>
              <li>Very high contrast (7:1)</li>
              <li>All Level A & AA requirements</li>
            </ul>
          </div>
          <div style="margin-top: 1rem; text-align: center; color: #808080; font-size: 0.8rem;">
            ◉ Score: 95-100
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
        <h3 style="color: ${currentLevel === 'AAA' ? '#00d9ff' : currentLevel === 'AA' ? '#00ff41' : currentLevel === 'A' ? '#ffd700' : '#ff4444'}; margin: 0 0 1rem 0; font-size: 1.4rem;">
          ${currentLevel === 'None' ? '✗ Not Compliant' : `✓ Meets WCAG Level ${currentLevel}`}
        </h3>
        <p style="color: #c0c0c0; font-size: 1rem; margin: 0;">
          ${currentLevel === 'None' ? 'This website does not meet minimum WCAG accessibility standards. Immediate improvements are needed.' : 
            currentLevel === 'A' ? 'This website meets minimum accessibility standards but has room for improvement to reach the industry-standard Level AA.' :
            currentLevel === 'AA' ? 'This website meets industry-standard accessibility requirements. Consider implementing AAA enhancements for optimal accessibility.' :
            'This website achieves the highest level of accessibility compliance. Excellent work!'}
        </p>
      </div>

      <div class="wcag-note-box" style="margin-top: 1.5rem; padding: 1rem; background: rgba(138,43,226,0.05); border-radius: 8px; border-left: 3px solid #bb86fc;">
        <p style="color: #bb86fc; font-size: 0.9rem; margin: 0; line-height: 1.6;">
          <strong>ⓘ Note:</strong> Level AA is the industry standard—it covers 90% of real user needs without excessive implementation cost. 
          Level AAA is not always feasible for all content types.
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
    <h2>Desktop vs Mobile Comparison</h2>
    <div style="padding-left: 1rem;">
      <p style="color: #bb86fc; margin-bottom: 1.5rem;">>> Analyzed both desktop and mobile for accessibility issues</p>
      
      ${anyFailed ? `
        <div style="
          background: rgba(255,165,0,0.1);
          border: 2px solid rgba(255,165,0,0.5);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
          text-align: center;
        ">
          <div style="color: #ffa500; font-size: 1.2rem; margin-bottom: 0.5rem;">~ Partial Analysis</div>
          <p style="color: #c0c0c0; margin: 0; font-size: 0.9rem;">
            ${desktopFailed && mobileFailed ? 'Both desktop and mobile Lighthouse analyses timed out.' : 
              desktopFailed ? 'Desktop Lighthouse analysis timed out.' : 'Mobile Lighthouse analysis timed out.'}
            Using alternative accessibility metrics from axe-core for affected platform(s).
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
          ${createPlatformCard('D DESKTOP', desktopScore, results.desktop, '#00ccff')}
        </div>
        
        <!-- Mobile Column -->
        <div style="
          background: linear-gradient(135deg, rgba(255,102,0,0.1), rgba(255,102,0,0.05));
          border: 2px solid #ff6600;
          border-radius: 8px;
          padding: 1.5rem;
        ">
          ${createPlatformCard('M MOBILE', mobileScore, results.mobile, '#ff6600')}
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
            ~ Accessibility Gap Detected
          </h4>
          <p style="color: #c0c0c0; margin: 0;">
            There is a ${scoreDiff}-point difference between desktop (${desktopScore}) and mobile (${mobileScore}) accessibility. 
            ${desktopScore > mobileScore ? 'Mobile users may face additional barriers.' : 'Desktop users may face additional barriers.'}
            Review platform-specific issues in the detailed analysis below.
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
            ✓ Consistent Accessibility - Both platforms scored within ${scoreDiff} points of each other
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
  const lighthouseError = data?.lighthouse?.error || 'Analysis incomplete';
  
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
          ">N/A</div>
          <div style="color: #666666; font-size: 0.65rem; margin-top: 0.25rem; font-weight: 600; text-align: center; padding: 0 0.5rem;">
            Timeout
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
      ">${lighthouseFailed ? 'Analysis Failed' : getAccessibilityGrade(score)}</div>
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
          <div style="color: #c0c0c0; font-size: 0.85rem; line-height: 1.4;">
            Lighthouse analysis timed out after 45 seconds. This can happen with:
          </div>
          <ul style="text-align: left; color: #999999; font-size: 0.8rem; margin: 0.5rem 0 0 1.5rem; padding: 0; line-height: 1.6;">
            <li>Slow-loading websites</li>
            <li>Heavy JavaScript execution</li>
            <li>Anti-bot protection</li>
            <li>Server-side rendering delays</li>
          </ul>
          <div style="color: #b0b0b0; font-size: 0.75rem; margin-top: 0.75rem; font-style: italic;">
            Using alternative accessibility metrics from axe-core instead
          </div>
        </div>
      </div>
    ` : `
      <div style="border-top: 1px solid ${color}40; padding-top: 1rem;">
        <h4 style="color: ${color}; margin: 0 0 0.75rem 0; font-size: 1rem;">Lighthouse Scores</h4>
        <div style="display: grid; gap: 0.5rem;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #c0c0c0;">A Accessibility</span>
            <span style="color: ${getAccessibilityColor(data?.lighthouse?.accessibility || 0)}; font-weight: bold;">
              ${data?.lighthouse?.accessibility || 0}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #c0c0c0;">P Performance</span>
            <span style="color: ${getAccessibilityColor(data?.lighthouse?.performance || 0)}; font-weight: bold;">
              ${data?.lighthouse?.performance || 0}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #c0c0c0;">B Best Practices</span>
            <span style="color: ${getAccessibilityColor(data?.lighthouse?.bestPractices || 0)}; font-weight: bold;">
              ${data?.lighthouse?.bestPractices || 0}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #c0c0c0;">S SEO</span>
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

function renderLockedProPreview(title = 'Pro content', previewLines = []) {
  const lines = previewLines.length ? previewLines : ['Recommendations preview', 'Code fixes preview'];
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
        <button class="pro-locked__unlock pro-locked__unlock--primary" data-buy-single-report data-context="fixes">Unlock for $10</button>
        <button class="pro-locked__unlock pro-locked__unlock--secondary" data-open-pricing-modal data-context="fixes">Go Pro — $20/mo</button>
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
      color: #ccc;
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
    return '<p style="color: #ff6600;">>>> WCAG compliance data not available</p>';
  }

  // Helper to render criterion row
  const renderCriterionRow = (criterion, desktopStatus, mobileStatus) => {
    const getStatusBadge = (status) => {
      const styles = {
        pass: { color: '#00ff41', icon: '✓', label: 'Pass' },
        fail: { color: '#ff4444', icon: '✗', label: 'Fail' },
        warning: { color: '#ffa500', icon: '~', label: 'Warning' },
        na: { color: '#808080', icon: '–', label: 'N/A' }
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
      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> WCAG 2.1 Compliance Status</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        Web Content Accessibility Guidelines (WCAG) 2.1 Level AA compliance audit across both platforms.
      </p>
      
      <table class="seo-table" style="width: 100%; margin-bottom: 1.5rem;">
        <thead>
          <tr>
            <th style="text-align: left; width: 40%;">Success Criterion</th>
            <th colspan="2" style="text-align: center; background: rgba(0,204,255,0.1); border-left: 2px solid #00ccff;">
              <span style="color: #00ccff;">D Desktop</span>
            </th>
            <th colspan="2" style="text-align: center; background: rgba(255,102,0,0.1); border-left: 2px solid #ff6600;">
              <span style="color: #ff6600;">M Mobile</span>
            </th>
          </tr>
          <tr style="font-size: 0.85rem;">
            <th style="border-top: 1px solid #333;"></th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(0,204,255,0.05);">Result</th>
            <th style="text-align: center; width: 15%; border-top: 1px solid #333; background: rgba(0,204,255,0.05);">Status</th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(255,102,0,0.05);">Result</th>
            <th style="text-align: center; width: 15%; border-top: 1px solid #333; background: rgba(255,102,0,0.05);">Status</th>
          </tr>
        </thead>
        <tbody>
          ${renderCriterionRow('1.1.1 Non-text Content', desktopWcag?.criteria?.nonTextContent || 'pass', mobileWcag?.criteria?.nonTextContent || 'pass')}
          ${renderCriterionRow('1.3.1 Info and Relationships', desktopWcag?.criteria?.infoRelationships || 'pass', mobileWcag?.criteria?.infoRelationships || 'pass')}
          ${renderCriterionRow('1.4.3 Contrast (Minimum)', desktopWcag?.criteria?.contrastMinimum || 'pass', mobileWcag?.criteria?.contrastMinimum || 'pass')}
          ${renderCriterionRow('2.1.1 Keyboard', desktopWcag?.criteria?.keyboard || 'pass', mobileWcag?.criteria?.keyboard || 'pass')}
          ${renderCriterionRow('2.4.1 Bypass Blocks', desktopWcag?.criteria?.bypassBlocks || 'pass', mobileWcag?.criteria?.bypassBlocks || 'pass')}
          ${renderCriterionRow('2.4.2 Page Titled', desktopWcag?.criteria?.pageTitled || 'pass', mobileWcag?.criteria?.pageTitled || 'pass')}
          ${renderCriterionRow('2.4.3 Focus Order', desktopWcag?.criteria?.focusOrder || 'pass', mobileWcag?.criteria?.focusOrder || 'pass')}
          ${renderCriterionRow('3.1.1 Language of Page', desktopWcag?.criteria?.languagePage || 'pass', mobileWcag?.criteria?.languagePage || 'pass')}
          ${renderCriterionRow('4.1.1 Parsing', desktopWcag?.criteria?.parsing || 'pass', mobileWcag?.criteria?.parsing || 'pass')}
          ${renderCriterionRow('4.1.2 Name, Role, Value', desktopWcag?.criteria?.nameRoleValue || 'pass', mobileWcag?.criteria?.nameRoleValue || 'pass')}
        </tbody>
      </table>
      
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(138,43,226,0.05); border-radius: 4px;">
        <h4 style="color: #bb86fc; margin: 0 0 0.5rem 0; font-size: 1rem;">📚 About WCAG 2.1</h4>
        <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
          WCAG 2.1 Level AA is the international standard for web accessibility. Meeting these criteria ensures your website 
          is usable by people with disabilities and complies with legal requirements in many jurisdictions.
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
    return '<p style="color: #ff6600;">>>> Color contrast data not available</p>';
  }

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>Platform-Agnostic Metrics:</strong> Color contrast ratios are design-based and apply equally to all platforms.
        </p>
      </div>
      
      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> Contrast Ratio Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        WCAG requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text. 
        Found <strong style="color: ${contrast.issuesCount > 0 ? '#ff4444' : '#00ff41'};">${contrast.issuesCount || 0} issues</strong>.
      </p>
      
      ${contrast.issues && contrast.issues.length > 0 ? `
        <table class="seo-table" style="width: 100%; margin-bottom: 1.5rem;">
          <thead>
            <tr>
              <th style="text-align: left;">Element</th>
              <th style="text-align: center;">Contrast Ratio</th>
              <th style="text-align: center;">Required</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${contrast.issues.slice(0, 10).map(issue => `
              <tr>
                <td style="color: #c0c0c0; font-family: monospace; font-size: 0.85rem;">${issue.selector || 'Unknown element'}</td>
                <td style="text-align: center;">
                  <span style="color: ${issue.ratio < 4.5 ? '#ff4444' : '#ffa500'}; font-weight: bold;">
                    ${issue.ratio?.toFixed(2) || 'N/A'}:1
                  </span>
                </td>
                <td style="text-align: center; color: #808080;">${issue.required || '4.5:1'}</td>
                <td style="text-align: center;">
                  <span style="
                    color: ${issue.ratio >= 4.5 ? '#00ff41' : '#ff4444'};
                    font-size: 0.85rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 3px;
                    background: ${issue.ratio >= 4.5 ? '#00ff4120' : '#ff444420'};
                  ">${issue.ratio >= 4.5 ? 'Pass' : 'Fail'}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${contrast.issues.length > 10 ? `
          <p style="color: #ffa500; font-size: 0.9rem; margin-top: 0.5rem;">
            ~ Showing 10 of ${contrast.issues.length} contrast issues. Review all issues in detailed audit.
          </p>
        ` : ''}
      ` : `
        <div style="background: rgba(0,255,65,0.1); border: 2px solid #00ff41; border-radius: 8px; padding: 1.5rem; text-align: center;">
          <p style="color: #00ff41; margin: 0; font-size: 1.1rem;">
            ✓ <strong>Excellent Contrast!</strong><br>
            All text elements meet WCAG contrast requirements.
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
    return '<p style="color: #ff6600;">>>> Keyboard navigation data not available</p>';
  }

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>Platform-Agnostic Metrics:</strong> Keyboard navigation patterns apply universally across devices with keyboard input.
        </p>
      </div>
      
      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> Keyboard Accessibility</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        All interactive elements must be accessible via keyboard. Tab order should be logical and focus indicators visible.
      </p>
      
      <div style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; border-left: 4px solid #bb86fc;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #c0c0c0;">T Focusable Elements</span>
            <span style="color: #bb86fc; font-weight: bold; font-size: 1.2rem;">${keyboard.focusableCount || 0}</span>
          </div>
        </div>
        
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; border-left: 4px solid ${keyboard.tabTraps > 0 ? '#ff4444' : '#00ff41'};">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #c0c0c0;">🚫 Tab Traps Detected</span>
            <span style="color: ${keyboard.tabTraps > 0 ? '#ff4444' : '#00ff41'}; font-weight: bold; font-size: 1.2rem;">${keyboard.tabTraps || 0}</span>
          </div>
        </div>
        
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; border-left: 4px solid ${keyboard.missingFocusIndicators > 0 ? '#ffa500' : '#00ff41'};">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #c0c0c0;">👁️ Missing Focus Indicators</span>
            <span style="color: ${keyboard.missingFocusIndicators > 0 ? '#ffa500' : '#00ff41'}; font-weight: bold; font-size: 1.2rem;">${keyboard.missingFocusIndicators || 0}</span>
          </div>
        </div>
      </div>
      
      ${keyboard.issues && keyboard.issues.length > 0 ? `
        <h4 style="color: #bb86fc; margin: 1.5rem 0 0.75rem 0;">Keyboard Issues Found</h4>
        <div style="display: grid; gap: 0.75rem;">
          ${keyboard.issues.map(issue => `
            <div style="background: rgba(255,68,68,0.1); border-left: 3px solid #ff4444; padding: 1rem; border-radius: 4px;">
              <div style="color: #ff4444; font-weight: bold; margin-bottom: 0.25rem;">${issue.type || 'Keyboard Issue'}</div>
              <div style="color: #c0c0c0; font-size: 0.9rem;">${issue.description || 'No description available'}</div>
              ${issue.element ? `<div style="color: #808080; font-size: 0.85rem; margin-top: 0.25rem; font-family: monospace;">${issue.element}</div>` : ''}
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
    return '<p style="color: #ff6600;">>>> ARIA implementation data not available</p>';
  }

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>Platform-Agnostic Metrics:</strong> ARIA attributes and semantic HTML apply universally to assistive technologies.
        </p>
      </div>
      
      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> ARIA & Semantic HTML</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        Proper use of ARIA attributes and semantic HTML elements ensures screen readers can understand and navigate your content.
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: #bb86fc; margin-bottom: 0.5rem;">${aria.landmarksCount || 0}</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">ARIA Landmarks</div>
        </div>
        
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: ${aria.missingLabels > 0 ? '#ff4444' : '#00ff41'}; margin-bottom: 0.5rem;">${aria.missingLabels || 0}</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">Missing Labels</div>
        </div>
        
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: ${aria.invalidRoles > 0 ? '#ffa500' : '#00ff41'}; margin-bottom: 0.5rem;">${aria.invalidRoles || 0}</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">Invalid Roles</div>
        </div>
        
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: #bb86fc; margin-bottom: 0.5rem;">${aria.headingStructure || 'Good'}</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">Heading Structure</div>
        </div>
      </div>
      
      ${aria.issues && aria.issues.length > 0 ? `
        <h4 style="color: #bb86fc; margin: 1.5rem 0 0.75rem 0;">ARIA Issues Found</h4>
        <table class="seo-table" style="width: 100%;">
          <thead>
            <tr>
              <th style="text-align: left;">Issue Type</th>
              <th style="text-align: left;">Description</th>
              <th style="text-align: center;">Impact</th>
            </tr>
          </thead>
          <tbody>
            ${aria.issues.slice(0, 10).map(issue => `
              <tr>
                <td style="color: #bb86fc; font-weight: bold;">${issue.type || 'ARIA Issue'}</td>
                <td style="color: #c0c0c0; font-size: 0.9rem;">${issue.description || 'No description'}</td>
                <td style="text-align: center;">
                  <span style="
                    color: ${issue.impact === 'critical' ? '#ff4444' : issue.impact === 'serious' ? '#ffa500' : '#00ccff'};
                    font-size: 0.85rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 3px;
                    background: ${issue.impact === 'critical' ? '#ff444420' : issue.impact === 'serious' ? '#ffa50020' : '#00ccff20'};
                    text-transform: uppercase;
                  ">${issue.impact || 'Moderate'}</span>
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
          ⓘ <strong>Cross-Platform Recommendations:</strong> These accessibility improvements are analyzed based on both desktop and mobile to ensure inclusive design.
        </p>
      </div>
    </div>
  `;
  
  if (!recommendations || !recommendations.length) {
    return `
      ${introSection}
      <div style="padding: 2rem; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">✓</div>
        <h3 style="color: #22c55e; margin: 0 0 0.5rem 0;">Excellent Accessibility!</h3>
        <p style="color: #c0c0c0;">No critical accessibility issues found. Your site meets WCAG 2.1 guidelines across both desktop and mobile!</p>
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
        <span style="font-size: 1.75rem;">♿</span> Accessibility Fixes
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${allFixes.length} improvements found)</span>
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
    high: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴', label: 'HIGH' },
    medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠', label: 'MEDIUM' },
    low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢', label: 'LOW' }
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
      <div class="a11y-fix-header" onclick="toggleA11yFixAccordion('${accordionId}')" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: #fff;">${rec.title || 'Accessibility Issue'}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">${rec.wcagReference || 'WCAG 2.1 Compliance'}</p>
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
          ">${style.label}</span>
          <span class="a11y-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="a11y-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
          ${renderA11yFixTabs(rec, accordionId, fullResults)}
        </div>
      </div>
    </div>
  `;
}

function renderA11yFixTabs(rec, accordionId, fullResults) {
  return `
    <div class="a11y-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="a11y-fix-tab active" onclick="switchA11yFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 Summary</button>
      <button class="a11y-fix-tab" onclick="switchA11yFixTab('${accordionId}', 'code')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 Code</button>
      <button class="a11y-fix-tab" onclick="switchA11yFixTab('${accordionId}', 'guide')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">🔧 Fix Guide</button>
    </div>

    <!-- Summary Tab -->
    <div class="a11y-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: #ccc; line-height: 1.7; margin: 0 0 1rem 0;">
        ${rec.description || 'No description available'}
      </p>
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ Expected Impact</div>
        <div style="color: #c0c0c0; font-size: 0.9rem;">${rec.impact || 'Improved accessibility and user experience for all users'}</div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="a11y-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Current Issue -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
            <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ Current Issue</span>
            <button onclick="copyA11yCode('${accordionId}-problem')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeHtmlA11y(getA11yProblemCode(rec, fullResults))}</pre>
        </div>

        <!-- Fixed Code -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ Recommended Fix</span>
            <button onclick="copyA11yCode('${accordionId}-solution')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeHtmlA11y(getA11ySolutionCode(rec, fullResults))}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="a11y-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
      <ol style="margin: 0 0 1.5rem 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
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

// Add click event delegation for accessibility fix accordions and tabs
document.addEventListener('click', function(e) {
  // Handle tab clicks first
  const tab = e.target.closest('.a11y-fix-tab');
  if (tab) {
    const accordion = tab.closest('.a11y-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      const tabText = tab.textContent.toLowerCase();
      let tabName = 'summary';
      if (tabText.includes('code')) tabName = 'code';
      else if (tabText.includes('guide')) tabName = 'guide';
      if (fixId && typeof window.switchA11yFixTab === 'function') {
        e.preventDefault();
        e.stopPropagation();
        window.switchA11yFixTab(fixId, tabName);
      }
    }
    return;
  }
  // Handle accordion header clicks
  const header = e.target.closest('.a11y-fix-header');
  if (header) {
    const accordion = header.closest('.a11y-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      if (fixId && typeof window.toggleA11yFixAccordion === 'function') {
        window.toggleA11yFixAccordion(fixId);
      }
    }
  }
});

function copyA11yCode(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = el.previousElementSibling?.querySelector('button') || 
                el.closest('div')?.querySelector('button[onclick*="' + elementId + '"]');
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => btn.textContent = original, 2000);
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
    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
      <h5 style="margin: 0 0 0.75rem 0; color: #aaa; font-size: 0.85rem; font-weight: 500;">🔗 External Testing Tools</h5>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        ${tools.map(tool => `
          <a href="${tool.url}" target="_blank" rel="noopener noreferrer" style="${buttonStyle}"
             onmouseover="this.style.background='rgba(0,255,65,0.2)'; this.style.borderColor='rgba(0,255,65,0.5)';"
             onmouseout="this.style.background='rgba(0,255,65,0.1)'; this.style.borderColor='rgba(0,255,65,0.3)';">
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
    return `/* Low contrast detected */\n.text-element {\n  color: #888;      /* Too light */\n  background: #ccc; /* Not enough contrast */\n}`;
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
    const headingStatus = results.aria?.headingStructure || 'Unknown';
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
  
  return `/* Issue: ${rec.title} */\n/* ${rec.description || 'Current implementation needs improvement'} */`;
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
  
  return `/* Fix for: ${rec.title} */\n\n${rec.solution || '/* Implement the recommended accessibility improvement */'}`;
}

function getA11yFixSteps(rec, fullResults) {
  if (rec.steps && rec.steps.length) return rec.steps;
  
  const title = (rec.title || '').toLowerCase();
  const results = fullResults || window._a11yFullResults || {};
  
  // Color contrast
  if (title.includes('contrast')) {
    const count = results.contrast?.issuesCount || 'multiple';
    return [
      `Open browser DevTools and navigate to the Elements panel`,
      `Use the Accessibility pane or "Inspect" to check color contrast ratios`,
      `Found ${count} elements below 4.5:1 contrast ratio`,
      `Use WebAIM Contrast Checker to find compliant color alternatives`,
      `Update CSS with new color values that meet WCAG AA (4.5:1 for text)`,
      `Test with browser extensions like axe DevTools or WAVE`
    ];
  }
  
  // Form labels
  if (title.includes('label') || title.includes('form')) {
    const count = results.aria?.missingLabels?.length || 'some';
    return [
      `Identify the ${count} form inputs missing accessible labels`,
      `For each input, add a <label> element with matching for/id attributes`,
      `If visual labels aren't possible, use aria-label attribute`,
      `Ensure labels are programmatically associated (not just visually positioned)`,
      `Test with a screen reader: input purpose should be announced`
    ];
  }
  
  // Focus indicators
  if (title.includes('focus')) {
    const count = results.keyboard?.missingFocusIndicators?.length || 'multiple';
    return [
      `Found ${count} interactive elements without visible focus`,
      `Remove any CSS that hides outlines (outline: none, outline: 0)`,
      `Add :focus-visible styles for keyboard users`,
      `Ensure focus indicator has minimum 3:1 contrast ratio`,
      `Test by tabbing through page - focus should always be visible`,
      `Consider users with both keyboard and mouse (use :focus-visible)`
    ];
  }
  
  // Heading structure
  if (title.includes('heading')) {
    return [
      `Run a heading outline check (browser extensions or DevTools)`,
      `Ensure page has exactly one <h1> element`,
      `Verify headings follow sequential order (h1 → h2 → h3)`,
      `Don't skip heading levels (e.g., h2 directly to h4)`,
      `Use headings for document structure, not for styling`,
      `Test with screen reader "headings list" navigation`
    ];
  }
  
  // ARIA landmarks
  if (title.includes('landmark')) {
    return [
      `Replace generic <div> elements with semantic HTML5 elements`,
      `Use <header>, <nav>, <main>, <aside>, <footer>`,
      `Add role attributes for older browser support if needed`,
      `Use aria-label to differentiate multiple nav elements`,
      `Test with screen reader landmark navigation (NVDA: D key, JAWS: R key)`,
      `Verify all major page sections have appropriate landmarks`
    ];
  }
  
  // Mobile accessibility
  if (title.includes('mobile')) {
    return [
      `Add proper viewport meta tag to <head>`,
      `Audit all interactive elements for 44x44px minimum touch target`,
      `Increase padding on buttons and links for touch`,
      `Ensure adequate spacing between clickable elements (8px minimum)`,
      `Test with mobile screen reader (VoiceOver, TalkBack)`,
      `Verify text is readable without zooming (16px minimum)`
    ];
  }
  
  return [
    `Review the specific WCAG criterion: ${rec.wcagReference || 'relevant guideline'}`,
    `Identify all affected elements on the page`,
    `Implement the recommended code fix`,
    `Test with assistive technology (screen reader, keyboard-only)`,
    `Validate with automated tools (axe, WAVE, Lighthouse)`
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
      color: #ccc !important;
    }
  `;
  document.head.appendChild(style);
}

// -------- Monetization actions (gated) --------
function ensureAccessibilityProAccess() {
  const domain = getCurrentDomain();
  if (window.ProAccess && window.ProAccess.hasProAccess(domain)) {
    return true;
  }
  if (window.ExportGate && window.ExportGate.isPro()) {
    return true;
  }
  safeOpenProPaywall({ domain, context: 'accessibility' });
  return false;
}

async function exportAccessibilityPDF() {
  if (!ensureAccessibilityProAccess()) return;

  const results = window.currentAccessibilityResults;
  if (!results) {
    alert('No scan results to export. Run a scan first.');
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
    alert('PDF export is not available. Please refresh the page.');
  }
}

function copyAccessibilityShareLink() {
  if (!ensureAccessibilityProAccess()) return;
  const targetUrl = window.currentAccessibilityResults?.url || window.location.href;
  const shareUrl = `${window.location.origin}/accessibility-analyzer.html?url=${encodeURIComponent(targetUrl)}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    alert('Share link copied to clipboard');
  });
}

function downloadAccessibilityCSV() {
  if (!ensureAccessibilityProAccess()) return;
  const r = window.currentAccessibilityResults;
  if (!r) return;

  const rows = [
    ['Metric', 'Value'],
    ['Overall Score', r.accessibilityScore ?? ''],
    ['WCAG Level', r.wcagLevel || ''],
    ['Violations Found', r.violationsCount ?? 0],
    ['Contrast Issues', r.contrastIssues ?? r.contrast?.issues?.length ?? 0],
    ['Keyboard Issues', r.keyboard?.issues?.length ?? 0],
    ['ARIA Issues', r.aria?.issues?.length ?? 0],
    ['Recommendations', countAccessibilityRecommendations(r)],
    ['Checks Passed', countAccessibilityPassedChecks(r)],
    ['URL', r.url || '']
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
  errorMessage.textContent = `>>> ERROR: ${message}`;
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
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
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
      return 'Highest Accessibility - Provides the best possible experience for all users, including those with severe disabilities.';
    case 'AA':  
      return 'Industry Standard - Meets legal requirements (ADA, Section 508) and ensures content is accessible to most users with disabilities.';
    case 'A':   
      return 'Minimum Accessibility - Removes the most critical barriers but considered barely accessible.';
    default:    
      return 'Non-Compliant - Does not meet WCAG standards.';
  }
}

// PDF purchase modal removed - monetization disabled

/**
 * Export Accessibility results as CSV
 */
window.exportAccessibilityCSV = function() {
  const results = window.currentAccessibilityResults;
  if (!results) {
    alert('No scan results to export. Run a scan first.');
    return;
  }

  const rows = [];
  // Header
  rows.push(['Category', 'Item', 'Value', 'Status', 'Score']);

  // Overall Score
  rows.push(['Overall', 'Accessibility Score', '', results.accessibilityScore >= 90 ? 'Excellent' : results.accessibilityScore >= 70 ? 'Good' : results.accessibilityScore >= 50 ? 'Fair' : 'Poor', results.accessibilityScore || '']);
  rows.push(['Overall', 'WCAG Level', results.wcagLevel || 'Not Compliant', '', '']);

  // Violations
  rows.push(['Violations', 'Total Violations', String(results.violationsCount || 0), results.violationsCount === 0 ? 'Good' : 'Issue', '']);

  // Contrast Issues
  const contrastIssues = results.contrastIssues ?? results.contrast?.issues?.length ?? 0;
  rows.push(['Contrast', 'Contrast Issues', String(contrastIssues), contrastIssues === 0 ? 'Good' : 'Issue', results.contrast?.score || '']);

  // Keyboard Accessibility
  const keyboardIssues = results.keyboard?.issues?.length ?? 0;
  rows.push(['Keyboard', 'Keyboard Issues', String(keyboardIssues), keyboardIssues === 0 ? 'Good' : 'Issue', results.keyboard?.score || '']);

  // ARIA
  const ariaIssues = results.aria?.issues?.length ?? 0;
  rows.push(['ARIA', 'ARIA Issues', String(ariaIssues), ariaIssues === 0 ? 'Good' : 'Issue', results.aria?.score || '']);

  // Recommendations
  const recommendationsCount = results.recommendations?.length || 0;
  rows.push(['Recommendations', 'Total Recommendations', String(recommendationsCount), '', '']);

  // Passed Checks
  const passedChecks = results.bestPracticesCount || results.passedChecks || 0;
  rows.push(['Best Practices', 'Passed Checks', String(passedChecks), '', '']);

  // URL
  rows.push(['Info', 'Scanned URL', results.url || '', '', '']);

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
