// CRO Analyzer Script
// Uses AnalyzerLoader for consistent loading UI

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'cro-analysis';
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

// Translation mapping for API strings to translation keys
// Maps English API response strings to i18n translation keys
function translateApiString(englishText, type = 'message') {
  const messageMap = {
    // Recommendations from API
    'Add more clear call-to-action buttons': 'reports.cro.api.addMoreCtas',
    'No forms detected': 'reports.cro.api.noFormsDetected',
    'Add trust signals': 'reports.cro.api.addTrustSignals',
    'Improve mobile experience': 'reports.cro.api.improveMobile',
    // Quick wins from API
    'Move a CTA above the fold': 'reports.cro.api.moveCta',
    'Add a clear call-to-action button': 'reports.cro.api.addCta',
    'Enable HTTPS/SSL certificate': 'reports.cro.api.enableSsl',
    'Add visible phone number': 'reports.cro.api.addPhone',
    'Add privacy policy link': 'reports.cro.api.addPrivacy',
    'Increase button sizes for mobile': 'reports.cro.api.increaseButtons',
    'Increase base font size to 16px': 'reports.cro.api.increaseFontSize'
  };
  
  const categoryMap = {
    'CTAs': 'reports.cro.categories.ctas',
    'Lead Capture': 'reports.cro.api.categories.leadCapture',
    'Trust': 'reports.cro.api.categories.trust',
    'Mobile UX': 'reports.cro.api.categories.mobileUx',
    'Quick Win': 'reports.cro.quickWin'
  };
  
  const impactMap = {
    'High - directly affects conversions': 'reports.cro.api.impact.highDirectly',
    'Critical - missing conversion opportunity': 'reports.cro.api.impact.criticalMissing',
    'High - trust increases conversion rates by 20-40%': 'reports.cro.api.impact.highTrust',
    'Medium - mobile traffic is 60%+ of users': 'reports.cro.api.impact.mediumMobile'
  };

  const map = type === 'category' ? categoryMap : type === 'impact' ? impactMap : messageMap;
  const key = map[englishText];
  
  if (key) {
    const translated = t(key, englishText);
    return translated;
  }
  return englishText;
}

// Function to get analysis steps with current translations
// Called at runtime to ensure i18n is loaded
function getAnalysisSteps() {
  return [
    { label: t('loader.initializingAnalysis', 'Initializing analysis'), detail: t('loader.connectingTarget', 'Connecting to target website...') },
    { label: t('loader.scanningCtas', 'Scanning CTAs'), detail: t('loader.detectingCtas', 'Detecting call-to-action buttons...') },
    { label: t('loader.analyzingForms', 'Analyzing forms'), detail: t('loader.evaluatingForms', 'Evaluating form conversion elements...') },
    { label: t('loader.checkingTrustSignals', 'Checking trust signals'), detail: t('loader.findingCredibility', 'Finding credibility indicators...') },
    { label: t('loader.testingMobileUx', 'Testing mobile UX'), detail: t('loader.evaluatingMobile', 'Evaluating mobile experience...') },
    { label: t('loader.generatingCroReport', 'Generating CRO report'), detail: t('loader.calculatingConversion', 'Calculating conversion potential...') }
  ];
}

const btn = document.getElementById('analyzeBtn');
const results = document.getElementById('results');

btn.addEventListener('click', analyzeCRO);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyzeCRO();
});

// Handle URL parameters for report loading and billing return
(async function initFromUrlParams() {
  const urlInput = document.getElementById('url');
  const params = new URLSearchParams(window.location.search);
  const reportId = params.get('report_id') || '';
  const autoUrl = params.get('url') || '';
  const autoScan = params.get('auto_scan') === 'true';
  const billingSuccess = params.get('billing_success') === 'true';

  // If we have a report_id, set it immediately so hasAccess checks work
  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    console.log('[CRO] Set report ID from URL:', reportId);
  }

  // If returning from billing, wait for billing return processing to complete
  if (billingSuccess && !window.__smBillingReturnComplete) {
    console.log('[CRO] Waiting for billing return processing...');
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
    console.log('[CRO] Billing return processing complete');
    return;
  }

  // If we have a report_id, try to load the stored report first
  if (reportId && window.ReportStorage) {
    console.log('[CRO] Checking for stored report:', reportId);

    // CRITICAL: Fetch billing status BEFORE displaying the report
    // Force refresh to ensure we have the latest purchase data (e.g., coming from dashboard)
    if (window.ProReportBlock?.fetchBillingStatus) {
      console.log('[CRO] Fetching billing status (force refresh for report recall)...');
      await window.ProReportBlock.fetchBillingStatus(true);
      console.log('[CRO] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportId), 'for reportId:', reportId);
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
      analyzeCRO();
    }, 500);
  }
})();

// Listen for restore scan results event (after payment return)
window.addEventListener('sm:restoreScanResults', (e) => {
  const { results: restoredResults, url, analyzer } = e.detail || {};
  if (restoredResults && analyzer?.includes('cro')) {
    console.log('[CRO] Restoring scan results after payment');
    const urlInput = document.getElementById('url');
    if (url && urlInput) {
      urlInput.value = url;
    }
    displayResults(restoredResults);
  }
});

// Handle billing re-scan: user returned from Stripe but cached results weren't available
window.addEventListener('sm:billingRescan', (e) => {
  const { reportId: purchasedReportId, url: scanUrl } = e.detail || {};
  const analyzerKey = window.SM_ANALYZER_KEY || '';
  if (!analyzerKey.includes('cro')) return;
  console.log('[CRO] Billing re-scan requested:', { purchasedReportId, scanUrl });
  window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;
  window.__smBillingRescanHandled = true;
  const urlInput = document.getElementById('url');
  if (scanUrl && urlInput) urlInput.value = scanUrl;
  if (purchasedReportId) document.body.setAttribute('data-report-id', purchasedReportId);
  analyzeCRO({ preserveReportId: true });
});

// Analysis steps are now defined by getAnalysisSteps() function above

/**
 * @param {Object} options - Optional settings
 * @param {boolean} options.preserveReportId - If true, preserve the existing report_id (for billing return re-scans)
 */
async function analyzeCRO(options = {}) {
  let { preserveReportId = false } = options;
  const url = document.getElementById('url').value.trim();

  if (!url) {
    alert(t('reports.common.pleaseEnterUrl', 'Please enter a valid URL'));
    return;
  }

  // NOTE: Auto-preserve is ONLY used when explicitly requested via options.preserveReportId
  // (e.g., sm:billingRescan handler passes preserveReportId: true).
  const existingReportId = document.body.getAttribute('data-report-id');
  const preservedReportId = preserveReportId ? existingReportId : null;
  if (preservedReportId) {
    console.log('[CRO] Preserving purchased report_id:', preservedReportId);
  }

  // Clear report metadata from previous scans
  // IMPORTANT: Don't clear report_id when re-scanning after billing return,
  // otherwise the purchased report_id gets lost and replaced with a new one
  if (!preserveReportId) {
    document.body.removeAttribute('data-report-id');
  }
  document.body.removeAttribute('data-sm-screenshot-url');
  document.body.removeAttribute('data-sm-scan-started-at');
  
  btn.disabled = true;
  const buttonText = btn.querySelector('#buttonText') || btn;
  buttonText.textContent = t('reports.common.analyzing', 'Analyzing...');
  
  // Initialize AnalyzerLoader
  const loader = new AnalyzerLoader('loadingContainer');
  
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
      ${t('reports.cro.analysisInProgress', 'CRO analysis in progress...')}
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(var(--accent-primary-rgb), 0.7); padding: 0 0.5rem;">
      ${t('reports.common.mayTake20to30Seconds', 'This may take 20-30 seconds')}
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
  
  loader.start(getAnalysisSteps(), '📈 ' + t('loader.analyzingCro', 'CRO ANALYZER'), 25);
  
  // Insert patience message after loader content
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

    const response = await fetch('/api/cro-analysis', {
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
      // Server returns { error: "Error", message: "actual error message" }
      const errorMsg = errorData.message || errorData.error || t('reports.common.analysisFailed', 'Analysis failed');
      throw new Error(errorMsg);
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
        console.log('[CRO] Using preserved report_id instead of API response:', reportId);
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
    
    loader.nextStep(4);
    loader.nextStep(5);
    loader.complete();
    
    displayResults(data);
    results.style.display = 'block';
    window.__REPORT_READY__ = true;
    window.dispatchEvent(new CustomEvent('report:ready'));

  } catch (error) {
    const message = error.message || t('reports.common.unknownError', 'Unknown error occurred');
    // Show user-friendly message for timeout errors
    if (message.includes('timeout') || message.includes('Timeout')) {
      alert(t('reports.common.timeoutError', 'The website took too long to respond. Please try a different site or try again later.'));
    } else {
      alert(t('reports.common.error', 'Error: {{message}}', { message }));
    }
    loader.complete();
  } finally {
    btn.disabled = false;
    const buttonText = btn.querySelector('#buttonText') || btn;
    buttonText.textContent = t('reports.common.analyze', 'Analyze');
  }
}

function displayResults(data) {
  if (!data || typeof data !== 'object') return;

  const resultsContainer = document.getElementById('results');

  // Ensure results container is visible (may be hidden if called directly without scan flow)
  if (resultsContainer) {
    resultsContainer.style.display = 'block';
  }

  // Defensive defaults for required properties
  data.scores = data.scores || {};
  data.recommendations = data.recommendations || [];

  const url = (document.getElementById('url') || {}).value || '';
  const timestamp = window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString();
  const startedAt = document.body.getAttribute('data-sm-scan-started-at') || new Date().toISOString();

  // Prefer stored reportId, URL param, or generate new one
  const urlParams = new URLSearchParams(window.location.search);
  const urlReportId = urlParams.get('report_id') || '';
  const reportId = data.reportId || urlReportId || `cro_${btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;

  // CRITICAL: Set report ID on body BEFORE checking unlock status
  // This ensures ProReportBlock.hasAccess can find the report ID
  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    console.log('[CRO] Set report ID on body:', reportId);
  }

  const screenshotBase = data.screenshotUrl || document.body.getAttribute('data-sm-screenshot-url') || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');
  const screenshotUrl = screenshotBase ? `${screenshotBase}${screenshotBase.includes('?') ? '&' : '?'}t=${Date.now()}` : '';

  // Store results globally for PDF generation
  window.currentCROResults = data;

  // Check if shared components are loaded
  if (typeof ReportShell === 'undefined' || typeof ReportAccordion === 'undefined') {
    console.error('Shared report components not loaded');
    resultsContainer.innerHTML = '<div style="color: red; padding: 2rem;">' + t('reports.common.componentLoadError', 'Error: Report components failed to load. Please refresh the page.') + '</div>';
    return;
  }

  if (screenshotUrl) {
    document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
  }

  // Check if report is unlocked (Pro subscription or purchased)
  const isReportUnlocked = (id) => {
    const rId = String(id || '').trim();

    // Subscription-style Pro (or ProReportBlock helper)
    if (window.ProReportBlock && typeof window.ProReportBlock.isPro === 'function') {
      if (window.ProReportBlock.isPro(rId || null)) {
        console.log('[CRO] isReportUnlocked: true via ProReportBlock.isPro');
        return true;
      }
    }

    // Also check hasAccess which covers both Pro and purchased
    if (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function') {
      if (window.ProReportBlock.hasAccess(rId)) {
        console.log('[CRO] isReportUnlocked: true via ProReportBlock.hasAccess');
        return true;
      }
    }

    // Per-report unlock via credits
    if (rId && window.CreditsManager) {
      if (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(rId)) {
        console.log('[CRO] isReportUnlocked: true via CreditsManager.isUnlocked');
        return true;
      }
      if (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(rId)) {
        console.log('[CRO] isReportUnlocked: true via CreditsManager.isReportUnlocked');
        return true;
      }
    }

    console.log('[CRO] isReportUnlocked: false for reportId:', rId);
    return false;
  };

  const isUnlocked = isReportUnlocked(reportId);
  console.log('[CRO] displayResults unlock check:', { reportId, isUnlocked });

  // Preview content for locked state (matches SEO pattern)
  const croFixesPreview = renderCROFixesPreview([
    t('reports.cro.preview.ctaPlacement', 'CTA placement optimization'),
    t('reports.cro.preview.formConversion', 'Form conversion improvements'),
    t('reports.cro.preview.trustSignal', 'Trust signal enhancements')
  ]);

  const sections = [
    {
      id: 'cro-cta',
      title: t('reports.cro.sections.ctaAnalysis', 'Call-to-Action Analysis'),
      scoreTextRight: `${data.scores.cta}/100`,
      contentHTML: `<div class="report-shell__card">${renderCTAContent(data.analysis.ctas)}</div>`
    },
    {
      id: 'cro-forms',
      title: t('reports.cro.sections.formOptimization', 'Form Optimization'),
      scoreTextRight: `${data.scores.form}/100`,
      contentHTML: `<div class="report-shell__card">${renderFormContent(data.analysis.forms)}</div>`
    },
    {
      id: 'cro-trust',
      title: t('reports.cro.sections.trustSignals', 'Trust Signals'),
      scoreTextRight: `${data.scores.trust}/100`,
      contentHTML: `<div class="report-shell__card">${renderTrustContent(data.analysis.trustSignals)}</div>`
    },
    {
      id: 'cro-mobile',
      title: t('reports.cro.sections.mobileExperience', 'Mobile Experience'),
      scoreTextRight: `${data.scores.mobile}/100`,
      contentHTML: `<div class="report-shell__card">${renderMobileContent(data.analysis.mobileUX)}</div>`
    },
    {
      id: 'report-recommendations',
      title: t('reports.cro.sections.fixCodeRecommendations', 'Recommendations'),
      scoreTextRight: data.score ? `${data.score}/100` : null,
      isPro: true,
      locked: !isUnlocked,
      context: 'cro',
      reportId,
      contentHTML: renderCROFixes(data)
    }
  ];

  const summary = [
    { label: t('reports.cro.summary.overallCro', 'Overall CRO'), score: data.score },
    { label: t('reports.cro.summary.ctas', 'CTAs'), score: data.scores.cta },
    { label: t('reports.cro.summary.forms', 'Forms'), score: data.scores.form },
    { label: t('reports.cro.summary.trustSignals', 'Trust Signals'), score: data.scores.trust }
  ];

  // Summary stats
  const highPriorityCount = data.recommendations.filter(r => r.priority === 'high').length;
  const summaryStats = {
    issues: highPriorityCount,
    recommendations: data.recommendations.length,
    checks: 0
  };

  const screenshots = screenshotUrl
    ? [{ src: screenshotUrl, alt: t('reports.common.pageScreenshot', 'Page Screenshot'), device: '' }]
    : [];

  const reportHTML = (window.ReportContainer && typeof window.ReportContainer.create === 'function')
    ? window.ReportContainer.create({
        url,
        timestamp: startedAt,
        mode: 'cro',
        title: t('reports.cro.title', 'CRO Report: Conversion Optimization'),
        subtitle: '',
        summary,
        sections,
        screenshots,
        proBlock: true,
        proBlockOptions: {
          context: 'cro',
          features: ['pdf', 'excel', 'csv', 'share'],
          title: t('reports.common.unlockReport', 'Unlock Report'),
          subtitle: t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.'),
          reportId
        }
      })
    : `
      ${(window.ReportShell && typeof window.ReportShell.renderReportHeader === 'function')
        ? window.ReportShell.renderReportHeader({
            title: t('reports.cro.title', 'CRO Report: Conversion Optimization'),
            url,
            timestamp: startedAt,
            badgeText: '',
            mode: 'cro'
          })
        : `<h2>${t('reports.cro.title', 'CRO Report: Conversion Optimization')}</h2>`
      }
    `;

  // Note: ReportContainer.create() with proBlock: true already adds Export & Share block
  // Don't add renderCROTakeActionSection to avoid duplicate
  const html = `
    ${reportHTML}
    ${renderCROSummarySection(summaryStats)}
  `;

  resultsContainer.innerHTML = `<div class="report-scope">${html}</div>`;
  ReportAccordion.initInteractions();

  if (reportId) {
    const img = resultsContainer.querySelector('.screenshot-item__img');
    if (img && img.getAttribute('src')) {
      attachCROScreenshotRetry(img, img.getAttribute('src'));
    }
  }

  if (reportId && window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
    window.CreditsManager.renderPaywallState(reportId);
  }

  // If already unlocked, reveal the Fix Code section content
  if (isUnlocked) {
    revealCROProContent();
  }

  // When the report is unlocked (credit/single), reveal the Fix Code section content.
  if (!window.__croUnlockListenerAttached) {
    window.__croUnlockListenerAttached = true;
    window.addEventListener('reportUnlocked', (e) => {
      const unlockedId = e && e.detail ? e.detail.reportId : '';
      if (!unlockedId || unlockedId !== document.body.getAttribute('data-report-id')) return;

      // Replace the Fix Code section body with the full content.
      const body = document.querySelector('[data-accordion-body="report-recommendations"]');
      if (body && window.currentCROResults) {
        body.innerHTML = renderCROFixes(window.currentCROResults);
      }

      revealCROProContent();

      if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
        window.CreditsManager.renderPaywallState(unlockedId);
      }
    });
  }

  // Auto-save report if user has access (purchased or Pro)
  if (reportId && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
    window.ReportStorage.autoSaveIfEligible(reportId, data, {
      siteUrl: url,
      analyzerType: 'cro',
      scannedAt: window.SM_SCAN_STARTED_AT || new Date().toISOString()
    });
  }
}

// Expose display function globally for billing return handler
window.displayCROResults = displayResults;

// Reveal CRO PRO content (remove lock overlays)
function revealCROProContent() {
  const lockOverlays = document.querySelectorAll('.report-scope .accordion-section[data-accordion-section="report-recommendations"] .lock-overlay, .report-scope .pro-lock-overlay');
  lockOverlays.forEach(overlay => overlay.remove());

  const proBadges = document.querySelectorAll('.report-scope .accordion-section[data-accordion-section="report-recommendations"] .pro-badge');
  proBadges.forEach(badge => badge.remove());

  const lockedSections = document.querySelectorAll('.report-scope .accordion-section[data-accordion-section="report-recommendations"].locked');
  lockedSections.forEach(section => section.classList.remove('locked'));

  // Remove locked state from Pro Report Blocks (show accent border after unlock)
  document.querySelectorAll('.pro-report-block--locked, .pro-report-block[data-locked]').forEach((block) => {
    block.classList.remove('pro-report-block--locked');
    block.removeAttribute('data-locked');
  });
}

function attachCROScreenshotRetry(imgEl, baseUrl, options = {}) {
  if (!imgEl || !baseUrl) return;
  const maxAttempts = Number.isFinite(options.maxAttempts) ? options.maxAttempts : 6;
  const baseDelayMs = Number.isFinite(options.baseDelayMs) ? options.baseDelayMs : 750;

  let attempts = 0;
  let settled = false;

  const cacheBust = (url) => {
    const joiner = url.includes('?') ? '&' : '?';
    return `${url}${joiner}cb=${Date.now()}`;
  };

  const showFallback = () => {
    const wrapper = imgEl.closest('.screenshot-item') || imgEl.parentElement;
    if (!wrapper) return;
    imgEl.style.display = 'none';
    if (wrapper.querySelector('[data-sm-screenshot-fallback]')) return;

    const msg = document.createElement('div');
    msg.setAttribute('data-sm-screenshot-fallback', 'true');
    msg.textContent = t('reports.common.screenshotUnavailable', 'Screenshot unavailable');
    msg.style.cssText = 'padding: 12px; border: 1px dashed var(--border-color); border-radius: 12px; color: var(--text-secondary); text-align: center;';
    wrapper.appendChild(msg);
  };

  const tryReload = () => {
    if (settled) return;
    attempts += 1;
    imgEl.src = cacheBust(baseUrl);
  };

  const onLoad = () => {
    settled = true;
  };

  const onError = () => {
    if (settled) return;
    if (attempts >= maxAttempts) {
      settled = true;
      showFallback();
      return;
    }
    const delay = baseDelayMs * Math.min(attempts + 1, 6);
    window.setTimeout(tryReload, delay);
  };

  imgEl.addEventListener('load', onLoad, { once: true });
  imgEl.addEventListener('error', onError);

  tryReload();
}

function renderCROSummarySection(stats) {
  return `
    <div class="section">
      <h2>${t('reports.common.summary', 'Summary')}</h2>
      <div class="seo-summary">
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-value">${stats.issues}</span>
            <span class="stat-label">${t('reports.cro.stats.highPriority', 'High Priority')}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${stats.recommendations}</span>
            <span class="stat-label">${t('reports.cro.stats.totalRecommendations', 'Total Recommendations')}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCROTakeActionSection(url) {
  // Use new ProReportBlock component if available
  if (window.ProReportBlock && window.ProReportBlock.render) {
    return `
      <div class="section">
        ${window.ProReportBlock.render({
          context: 'cro',
          features: ['pdf', 'excel', 'csv', 'share'],
          title: t('reports.common.unlockReport', 'Unlock Report'),
          subtitle: t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.')
        })}
      </div>
    `;
  } else {
    const opts = { context: 'cro', features: ['pdf', 'excel', 'csv', 'share'], title: 'Unlock Report', subtitle: 'PDF export, share link, export data, and fix packs for this scan.' };
    const safe = JSON.stringify(opts).replace(/</g, '\\u003c').replace(/"/g, '&quot;');
    return '<div class="section"><div class="pro-report-block" data-pro-block-pending data-pro-block-options="' + safe + '"></div></div>';
  }
}

// Stub functions for share/export
window.copyCROShareLink = function() { alert(t('reports.common.shareLinkComingSoon', 'Share link coming soon')); };
window.downloadCROCSV = function() { alert(t('reports.common.csvExportComingSoon', 'CSV export coming soon')); };

// ============================================================
// CRO Fixes (following SEO pattern with tabs + accordions)
// ============================================================

function renderCROFixesPreview(previewLines = []) {
  const lines = previewLines.length
    ? previewLines
    : [
        t('reports.cro.preview.ctaPlacement', 'CTA placement optimization'),
        t('reports.cro.preview.formConversion', 'Form conversion improvements'),
        t('reports.cro.preview.trustSignal', 'Trust signal enhancements')
      ];

  return `
    <div>
      <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
        ${t('reports.cro.preview.title', 'Preview of fix packs:')}
      </p>
      <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary);">
        ${lines.slice(0, 3).map(line => `<li>${line}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderCROFixes(data) {
  ensureCROFixStyles();
  const fixes = buildCROFixCards(data);
  
  if (fixes.length === 0) {
    return `
      <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">✓</span> ${t('reports.cro.excellentCro', 'Excellent CRO!')}
        </h3>
        <p style="color: #86efac; margin: 0;">${t('reports.cro.excellentCroDescription', 'Your site follows conversion optimization best practices. Keep monitoring for continued success.')}</p>
      </div>
    `;
  }

  // Group by severity
  const high = fixes.filter(f => f.severity === 'High');
  const medium = fixes.filter(f => f.severity === 'Medium');
  const low = fixes.filter(f => f.severity === 'Low');

  let html = `
    <div class="cro-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">🎯</span> ${t('reports.cro.croFixes', 'CRO Fixes')}
        <span style="font-size: 0.875rem; color: var(--r-text-faint, #9CA3AF); font-weight: normal;">(${t('reports.cro.improvementsFound', '{{count}} improvements found', { count: fixes.length })})</span>
      </h3>
      <div class="cro-fixes-list">
  `;

  // Render all fixes grouped by severity
  const allFixes = [...high, ...medium, ...low];
  allFixes.forEach((fix, index) => {
    html += renderCROFixAccordion(fix, index);
  });

  html += `</div></div>`;

  return html;
}

function renderCROFixAccordion(fix, index) {
  const accordionId = `crofix-${fix.id || index}`;
  const severityColors = {
    High: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
    Medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
    Low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
  };
  const style = severityColors[fix.severity] || severityColors.Medium;

  return `
    <div class="cro-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="cro-fix-header" data-action="toggle-accordion" data-accordion-id="${accordionId}" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: var(--r-text, #111827);">${fix.title}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${fix.category || t('reports.cro.categories.croOptimization', 'CRO Optimization')}</p>
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
          ">${fix.severity.toUpperCase()}</span>
          <span class="cro-fix-expand-icon" style="color: var(--r-text-faint, #9CA3AF); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="cro-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderCROFixTabs(fix, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderCROFixTabs(fix, accordionId) {
  return `
    <div class="cro-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); padding-bottom: 0.75rem;">
      <button class="cro-fix-tab active" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: var(--r-text, #111827);
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 ${t('reports.common.tabs.summary', 'Summary')}</button>
      <button class="cro-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="code" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 ${t('reports.common.tabs.code', 'Code')}</button>
      <button class="cro-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
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
    <div class="cro-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: var(--r-text-muted, #6B7280); line-height: 1.7; margin: 0 0 1rem 0;">
        ${fix.description}
      </p>
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ ${t('reports.common.fix.expectedImpact', 'Expected Impact')}</div>
        <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${fix.impact}</div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="cro-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Current Issue -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
            <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ ${t('reports.common.fix.currentIssue', 'Current Issue')}</span>
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
          <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${escapeCROHtml(fix.problematicCode || fix.currentIssue || t('reports.cro.missingImplementation', '<!-- Missing or incorrect implementation -->'))}</pre>
        </div>

        <!-- Fixed Code -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ ${t('reports.common.fix.recommendedFix', 'Recommended Fix')}</span>
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
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${escapeCROHtml(fix.snippet || fix.fixedCode)}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="cro-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--r-text, #111827);">${t('reports.common.fix.stepByStepFix', 'Step-by-Step Fix:')}</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--r-text-muted, #6B7280); line-height: 1.8;">
        ${(fix.steps || getDefaultCROSteps(fix)).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
    </div>
  `;
}

function getDefaultCROSteps(fix) {
  const title = (fix.title || '').toLowerCase();

  // Mobile experience / tap targets
  if (title.includes('mobile') || title.includes('tap') || title.includes('touch')) {
    return [
      t('reports.cro.steps.mobile.findButtonStyles', 'Open your CSS and find button/link styles'),
      t('reports.cro.steps.mobile.setMinSize', 'Set min-height: 44px and min-width: 44px on all interactive elements'),
      t('reports.cro.steps.mobile.addPadding', 'Add padding: 12px 24px to buttons for comfortable touch'),
      t('reports.cro.steps.mobile.setFontSize', 'Set body font-size to 16px to prevent iOS zoom on inputs'),
      t('reports.cro.steps.mobile.useDevTools', 'Use Chrome DevTools mobile emulation to test (F12 → Toggle Device)'),
      t('reports.cro.steps.mobile.testDevices', 'Test on actual iOS and Android devices before deploying')
    ];
  }

  // CTA / button / above fold
  if (title.includes('cta') || title.includes('button') || title.includes('fold') || title.includes('call-to-action')) {
    return [
      t('reports.cro.steps.cta.identifyAction', 'Identify the primary action you want visitors to take'),
      t('reports.cro.steps.cta.placeProminent', 'Place a prominent CTA button in the hero section (above the fold)'),
      t('reports.cro.steps.cta.useActionText', 'Use action-oriented text: "Get Started", "Try Free", "Book Now"'),
      t('reports.cro.steps.cta.applyContrast', 'Apply high-contrast colors (e.g., orange or green on dark backgrounds)'),
      t('reports.cro.steps.cta.addVisualWeight', 'Add visual weight with padding, shadows, or borders'),
      t('reports.cro.steps.cta.testMobile', 'Test button visibility on mobile without scrolling')
    ];
  }

  // Form optimization
  if (title.includes('form') || title.includes('input') || title.includes('field') || title.includes('label')) {
    return [
      t('reports.cro.steps.form.reduceFields', 'Reduce form fields to 3-5 essential ones (name, email, message)'),
      t('reports.cro.steps.form.addLabels', 'Add visible <label> elements above each input field'),
      t('reports.cro.steps.form.markRequired', 'Mark required fields with * and aria-required="true"'),
      t('reports.cro.steps.form.usePlaceholders', 'Use descriptive placeholders like "you@company.com"'),
      t('reports.cro.steps.form.addErrorMessages', 'Add helpful error messages that explain how to fix issues'),
      t('reports.cro.steps.form.includeTrustMessage', 'Include a trust message near the submit button ("Your info is safe")')
    ];
  }

  // Trust signals
  if (title.includes('trust') || title.includes('security') || title.includes('testimonial') || title.includes('review') || title.includes('badge')) {
    return [
      t('reports.cro.steps.trust.addSecurityBadges', 'Add SSL/security badges near payment forms and checkout buttons'),
      t('reports.cro.steps.trust.displayTestimonials', 'Display customer testimonials with real names and photos'),
      t('reports.cro.steps.trust.showRatings', 'Show star ratings or review counts (e.g., "4.9/5 from 2,000+ reviews")'),
      t('reports.cro.steps.trust.includeGuarantee', 'Include money-back guarantee or free trial messaging'),
      t('reports.cro.steps.trust.addLogos', 'Add logos of trusted partners, certifications, or media mentions'),
      t('reports.cro.steps.trust.placeNearConversion', 'Place trust signals near conversion points, not just in the footer')
    ];
  }

  // Font / text / readability
  if (title.includes('font') || title.includes('text') || title.includes('readability') || title.includes('size')) {
    return [
      t('reports.cro.steps.font.setBaseFontSize', 'Set base body font-size to 16px (minimum for mobile)'),
      t('reports.cro.steps.font.useLineHeight', 'Use line-height: 1.5 to 1.6 for comfortable reading'),
      t('reports.cro.steps.font.limitWidth', 'Limit paragraph width to 65-75 characters with max-width'),
      t('reports.cro.steps.font.ensureContrast', 'Ensure color contrast ratio is at least 4.5:1 (use WebAIM checker)'),
      t('reports.cro.steps.font.chooseFont', 'Choose a legible system font stack or Google Font'),
      t('reports.cro.steps.font.testMobile', 'Test on mobile devices to verify readability')
    ];
  }

  // Contrast / color / visibility
  if (title.includes('contrast') || title.includes('color') || title.includes('visibility')) {
    return [
      t('reports.cro.steps.contrast.checkContrast', 'Check color contrast with WebAIM Contrast Checker tool'),
      t('reports.cro.steps.contrast.ensureRatio', 'Ensure text has at least 4.5:1 contrast ratio against background'),
      t('reports.cro.steps.contrast.useBold', 'Use bold or larger text for important elements (14px minimum)'),
      t('reports.cro.steps.contrast.avoidLightGray', 'Avoid light gray text on white backgrounds'),
      t('reports.cro.steps.contrast.makeCTAsStandOut', 'Make CTAs stand out with high-contrast button colors'),
      t('reports.cro.steps.contrast.testGrayscale', 'Test with browser grayscale mode to verify visibility')
    ];
  }

  // Speed / performance
  if (title.includes('speed') || title.includes('load') || title.includes('performance') || title.includes('slow')) {
    return [
      t('reports.cro.steps.speed.compressImages', 'Compress images using tools like TinyPNG or Squoosh'),
      t('reports.cro.steps.speed.enableLazyLoading', 'Enable lazy loading for images below the fold'),
      t('reports.cro.steps.speed.minimizeFiles', 'Minimize CSS and JavaScript files'),
      t('reports.cro.steps.speed.useCDN', 'Use a CDN for faster global delivery'),
      t('reports.cro.steps.speed.removeUnused', 'Remove unused plugins and scripts'),
      t('reports.cro.steps.speed.testPageSpeed', 'Test with Google PageSpeed Insights and fix flagged issues')
    ];
  }

  // Generic fallback with useful steps
  return [
    t('reports.cro.steps.generic.reviewImplementation', 'Review the current implementation in your browser DevTools'),
    t('reports.cro.steps.generic.identifyElement', 'Identify the specific element or section that needs improvement'),
    t('reports.cro.steps.generic.applyChanges', 'Apply the recommended code changes from the Code tab'),
    t('reports.cro.steps.generic.testChanges', 'Test the changes on desktop and mobile devices'),
    t('reports.cro.steps.generic.verifyAB', 'Verify the improvement with A/B testing if possible'),
    t('reports.cro.steps.generic.monitorMetrics', 'Monitor conversion metrics after deployment')
  ];
}

// Toggle accordion
function toggleCROFixAccordion(accordionId) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);
  const icon = accordion?.querySelector('.cro-fix-expand-icon');

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
window.toggleCROFixAccordion = toggleCROFixAccordion;

// Switch tabs
function switchCROFixTab(accordionId, tabName) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;

  const tabs = accordion.querySelectorAll('.cro-fix-tab');
  const contents = accordion.querySelectorAll('.cro-fix-tab-content');

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
window.switchCROFixTab = switchCROFixTab;

// Copy code
function copyCROCode(elementId) {
  const codeElement = document.getElementById(elementId);
  if (!codeElement) return;

  const text = codeElement.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = codeElement.parentElement.querySelector('button');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✓ ' + t('reports.common.copied', 'Copied!');
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  });
}
window.copyCROCode = copyCROCode;

function ensureCROFixStyles() {
  if (document.getElementById('cro-fixes-styles')) return;
  const style = document.createElement('style');
  style.id = 'cro-fixes-styles';
  style.textContent = `
    .cro-fix-accordion.expanded .cro-fix-expand-icon {
      transform: rotate(180deg);
    }
    .cro-fix-header:hover {
      background: rgba(255,255,255,0.03);
    }
  `;
  document.head.appendChild(style);
}

function escapeCROHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCROFixCards(data) {
  const cards = [];
  const ctas = data.analysis?.ctas || {};
  const forms = data.analysis?.forms || {};
  const trust = data.analysis?.trustSignals || {};
  const mobile = data.analysis?.mobileUX || {};
  const recommendations = data.recommendations || [];
  const quickWins = data.quickWins || [];

  // Build cards from recommendations
  recommendations.forEach((rec, idx) => {
    const severity = rec.priority === 'high' || rec.priority === 'critical' ? 'High' 
      : rec.priority === 'medium' ? 'Medium' : 'Low';
    
    // Translate API strings to localized text
    const translatedTitle = translateApiString(rec.message || rec.title, 'message') || t('reports.cro.fixes.optimizationOpportunity', 'Optimization Opportunity');
    const translatedCategory = translateApiString(rec.category, 'category') || getCROCategory(rec);
    const translatedImpact = translateApiString(rec.impact, 'impact') || t('reports.cro.fixes.improvedConversionRate', 'Improved conversion rate');
    
    cards.push({
      id: `rec-${idx}`,
      title: translatedTitle,
      severity,
      category: translatedCategory,
      impact: translatedImpact,
      description: rec.detail || rec.description || t('reports.cro.fixes.applyRecommendation', 'Apply this recommendation to improve conversions.'),
      problematicCode: rec.currentCode || generateCROProblemCode(rec),
      snippet: rec.fixedCode || generateCROFixCode(rec),
      steps: rec.steps || []
    });
  });

  // Add quick wins as cards
  quickWins.forEach((win, idx) => {
    // Translate API strings to localized text
    const translatedTitle = translateApiString(win.title, 'message') || t('reports.cro.quickWin', 'Quick Win');
    
    cards.push({
      id: `qw-${idx}`,
      title: translatedTitle,
      severity: 'Low',
      category: t('reports.cro.quickWin', 'Quick Win'),
      impact: win.impact || t('reports.cro.fixes.quickWinImpact', '+5-15% conversions'),
      description: `${translatedTitle}. ${t('reports.cro.estimatedTime', 'Estimated time')}: ${win.timeEstimate || t('reports.cro.fiveMinutes', '5 min')}`,
      problematicCode: generateQuickWinProblemCode(win),
      snippet: generateQuickWinFixCode(win),
      steps: win.steps || []
    });
  });

  // CTA fixes based on analysis
  if (ctas.aboveFold === false || ctas.count === 0) {
    cards.push({
      id: 'cta-fold',
      title: t('reports.cro.fixes.ctaAboveFold', 'Add a CTA above the fold'),
      severity: 'High',
      category: t('reports.cro.categories.ctas', 'CTAs'),
      impact: t('reports.cro.fixes.ctaImpact', 'Increase conversions by 20-30%'),
      description: t('reports.cro.fixes.ctaAboveFoldDescription', 'Visitors should see a clear call-to-action without scrolling. Currently, no CTA is visible above the fold.'),
      problematicCode: `<!-- No CTA visible above the fold -->
<div class="hero">
  <h1>Welcome to Our Site</h1>
  <p>Discover our amazing products...</p>
  <!-- Missing CTA button here -->
</div>`,
      snippet: `<!-- CTA above the fold -->
<div class="hero">
  <h1>Welcome to Our Site</h1>
  <p>Discover our amazing products...</p>
  <button class="cta-primary" style="
    padding: 1rem 2rem;
    font-size: 1.1rem;
    background: #ff6600;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  ">Get Started Free</button>
</div>`,
      steps: [
        t('reports.cro.steps.ctaFold.identifyButton', 'Identify your most important CTA button'),
        t('reports.cro.steps.ctaFold.moveVisible', 'Move it to be visible without scrolling'),
        t('reports.cro.steps.ctaFold.useContrast', 'Use contrasting colors to make it stand out')
      ]
    });
  }

  // Form optimization fixes
  if (forms.count > 0 && (forms.avgFields > 5 || !forms.hasLabels)) {
    cards.push({
      id: 'form-optimize',
      title: t('reports.cro.fixes.optimizeForm', 'Optimize form for conversions'),
      severity: 'Medium',
      category: t('reports.cro.categories.forms', 'Forms'),
      impact: t('reports.cro.fixes.formImpact', 'Reduce form abandonment by 15-25%'),
      description: forms.avgFields > 5
        ? t('reports.cro.fixes.formTooManyFields', 'Forms have {{count}} fields on average. Consider reducing to 3-5 essential fields.', { count: forms.avgFields })
        : t('reports.cro.fixes.formMissingLabels', 'Forms are missing proper labels which hurts accessibility and conversions.'),
      problematicCode: `<!-- Current form structure -->
<form>
  <input type="text" placeholder="Name">
  <input type="email" placeholder="Email">
  <input type="tel" placeholder="Phone">
  <input type="text" placeholder="Company">
  <input type="text" placeholder="Job Title">
  <textarea placeholder="Message"></textarea>
  <!-- Too many fields, missing labels -->
</form>`,
      snippet: `<!-- Optimized form -->
<form>
  <label for="name">Name *</label>
  <input id="name" type="text" required>
  
  <label for="email">Email *</label>
  <input id="email" type="email" required>
  
  <label for="message">How can we help?</label>
  <textarea id="message"></textarea>
  
  <button type="submit" class="cta-primary">
    Send Message
  </button>
</form>`,
      steps: [
        t('reports.cro.steps.formOptimize.reduceFields', 'Reduce form fields to 3-5 essential ones'),
        t('reports.cro.steps.formOptimize.addLabels', 'Add visible labels above each field'),
        t('reports.cro.steps.formOptimize.markRequired', 'Mark required fields clearly'),
        t('reports.cro.steps.formOptimize.useCompellingText', 'Use a compelling submit button text')
      ]
    });
  }

  // Trust signal fixes
  if (!trust.hasSecurityBadges && !trust.hasTestimonials) {
    cards.push({
      id: 'trust-signals',
      title: t('reports.cro.fixes.addTrustSignals', 'Add trust signals'),
      severity: 'Medium',
      category: t('reports.cro.categories.trustSignals', 'Trust Signals'),
      impact: t('reports.cro.fixes.trustImpact', 'Increase trust and conversions by 10-20%'),
      description: t('reports.cro.fixes.trustDescription', 'No security badges or testimonials detected. Adding trust elements can significantly boost conversions.'),
      problematicCode: `<!-- Checkout section without trust signals -->
<div class="checkout">
  <h2>Complete Your Order</h2>
  <form>
    <input type="text" placeholder="Card Number">
    <button type="submit">Pay Now</button>
  </form>
  <!-- Missing trust signals -->
</div>`,
      snippet: `<!-- Checkout with trust signals -->
<div class="checkout">
  <h2>Complete Your Order</h2>
  
  <!-- Security badges -->
  <div class="trust-badges" style="display: flex; gap: 1rem; margin: 1rem 0;">
    <img src="/icons/ssl-secure.svg" alt="SSL Secured">
    <img src="/icons/money-back.svg" alt="30-Day Money Back">
    <img src="/icons/trusted.svg" alt="Trusted by 10,000+">
  </div>
  
  <form>
    <input type="text" placeholder="Card Number">
    <button type="submit">Pay Now - Secure Checkout</button>
  </form>
  
  <!-- Testimonial -->
  <blockquote class="testimonial">
    "Great product, fast shipping!" - John D.
  </blockquote>
</div>`,
      steps: [
        t('reports.cro.steps.trustSignals.addBadges', 'Add security badges near payment forms'),
        t('reports.cro.steps.trustSignals.includeTestimonials', 'Include customer testimonials or reviews'),
        t('reports.cro.steps.trustSignals.displayCertifications', 'Display any certifications or partner logos'),
        t('reports.cro.steps.trustSignals.useSecureLanguage', 'Use "Secure Checkout" language on buttons')
      ]
    });
  }

  // Mobile UX fixes
  if (mobile.score && mobile.score < 70) {
    cards.push({
      id: 'mobile-ux',
      title: t('reports.cro.fixes.improveMobile', 'Improve mobile experience'),
      severity: 'High',
      category: t('reports.cro.categories.mobileExperience', 'Mobile Experience'),
      impact: t('reports.cro.fixes.mobileImpact', 'Mobile users make up 60%+ of traffic'),
      description: t('reports.cro.fixes.mobileDescription', 'Mobile UX score is {{score}}/100. Improving mobile experience is critical for conversions.', { score: mobile.score }),
      problematicCode: `<!-- Mobile issues -->
<style>
  body { font-size: 14px; } /* Too small */
  .btn { padding: 8px; }    /* Tap target too small */
  .form input { width: 100%; }
</style>`,
      snippet: `<!-- Mobile-optimized -->
<style>
  body { 
    font-size: 16px; /* Readable on mobile */
  }
  .btn { 
    padding: 14px 24px;
    min-height: 44px; /* Minimum tap target */
  }
  .form input { 
    width: 100%;
    font-size: 16px; /* Prevents zoom on iOS */
    padding: 12px;
  }
</style>`,
      steps: [
        t('reports.cro.steps.mobileUx.increaseFontSize', 'Increase base font size to 16px minimum'),
        t('reports.cro.steps.mobileUx.makeButtonsLarger', 'Make buttons at least 44x44px'),
        t('reports.cro.steps.mobileUx.ensureInputFontSize', 'Ensure form inputs are at least 16px font'),
        t('reports.cro.steps.mobileUx.testDevices', 'Test on actual mobile devices')
      ]
    });
  }

  return cards;
}

function getCROCategory(rec) {
  const msg = (rec.message || rec.title || '').toLowerCase();
  if (msg.includes('cta') || msg.includes('button') || msg.includes('click')) return t('reports.cro.categories.ctas', 'CTAs');
  if (msg.includes('form') || msg.includes('input') || msg.includes('field')) return t('reports.cro.categories.forms', 'Forms');
  if (msg.includes('trust') || msg.includes('security') || msg.includes('badge')) return t('reports.cro.categories.trustSignals', 'Trust Signals');
  if (msg.includes('mobile') || msg.includes('responsive') || msg.includes('touch') || msg.includes('tap')) return t('reports.cro.categories.mobileExperience', 'Mobile Experience');
  return t('reports.cro.categories.croOptimization', 'CRO Optimization');
}

function generateCROProblemCode(rec) {
  const title = (rec.message || rec.title || '').toLowerCase();
  const detail = rec.detail || '';
  
  // Mobile experience issues
  if (title.includes('mobile') || title.includes('tap') || title.includes('touch')) {
    return `/* Mobile Experience Issues */

/* Problem: Small tap targets */
.button {
  padding: 6px 12px;      /* Too small for touch */
  font-size: 12px;        /* Hard to read on mobile */
}

/* Problem: Text too small */
body {
  font-size: 14px;        /* Below 16px causes zoom on iOS */
}

/* Problem: Elements too close together */
.nav-links a {
  margin: 2px;            /* Easy to mis-tap */
}`;
  }
  
  // CTA issues
  if (title.includes('cta') || title.includes('button') || title.includes('fold')) {
    return `<!-- CTA Issues -->

<!-- Problem: Weak call-to-action -->
<button class="btn">Submit</button>

<!-- Problem: CTA below the fold -->
<div class="hero">
  <h1>Welcome</h1>
  <!-- No CTA visible without scrolling -->
</div>

<!-- Problem: Low contrast button -->
<button style="background: #ccc; color: var(--r-text-faint, #9CA3AF);">
  Click Here
</button>`;
  }
  
  // Form issues
  if (title.includes('form') || title.includes('input') || title.includes('field') || title.includes('label')) {
    return `<!-- Form Issues -->

<!-- Problem: Missing labels -->
<input type="email" placeholder="Email">

<!-- Problem: Too many fields -->
<form>
  <input placeholder="First Name">
  <input placeholder="Last Name">
  <input placeholder="Email">
  <input placeholder="Phone">
  <input placeholder="Company">
  <input placeholder="Job Title">
  <input placeholder="Address">
  <!-- 7+ fields = high abandonment -->
</form>

<!-- Problem: Unclear required fields -->
<input type="text" placeholder="Name">`;
  }
  
  // Trust signal issues
  if (title.includes('trust') || title.includes('security') || title.includes('testimonial') || title.includes('review')) {
    return `<!-- Trust Signal Issues -->

<!-- Problem: No security indicators -->
<form class="payment-form">
  <input type="text" placeholder="Card Number">
  <button>Pay $99</button>
  <!-- No SSL badge, no guarantees shown -->
</form>

<!-- Problem: No social proof -->
<div class="product">
  <h2>Our Product</h2>
  <p>Buy now!</p>
  <!-- No reviews, testimonials, or trust badges -->
</div>`;
  }
  
  // Font/readability issues
  if (title.includes('font') || title.includes('readability') || title.includes('text')) {
    return `/* Readability Issues */

body {
  font-size: 14px;        /* Too small on mobile */
  line-height: 1.2;       /* Too tight */
}

.paragraph {
  max-width: none;        /* Lines too long */
  color: var(--r-text-faint, #9CA3AF);            /* Low contrast */
}`;
  }
  
  // Generic fallback with context
  return `<!-- Current Implementation -->
<!-- Issue: ${rec.message || rec.title || 'Needs optimization'} -->

${detail ? `<!-- Details: ${detail} -->` : ''}

<!-- This affects conversion rates by making it harder
     for users to complete their goals on the page. -->`;
}

function generateCROFixCode(rec) {
  const title = (rec.message || rec.title || '').toLowerCase();
  
  // Mobile experience fixes
  if (title.includes('mobile') || title.includes('tap') || title.includes('touch')) {
    return `/* Mobile-Optimized CSS */

/* Fix: Proper tap target sizes */
.button, .cta, a.nav-link {
  min-height: 44px;       /* Apple HIG minimum */
  min-width: 44px;
  padding: 12px 24px;
  font-size: 16px;        /* Readable on mobile */
}

/* Fix: Readable text */
body {
  font-size: 16px;        /* Prevents iOS zoom */
  line-height: 1.5;
}

/* Fix: Touch-friendly spacing */
.nav-links a {
  margin: 8px;
  padding: 12px 16px;
}

/* Fix: Responsive layout */
@media (max-width: 768px) {
  .container { padding: 16px; }
  .button { width: 100%; }
}`;
  }
  
  // CTA fixes
  if (title.includes('cta') || title.includes('button') || title.includes('fold')) {
    return `<!-- Optimized CTA -->

<!-- Strong, action-oriented button -->
<button class="cta-primary" style="
  background: linear-gradient(135deg, #ff6b00, #ff8533);
  color: white;
  padding: 16px 32px;
  font-size: 18px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(255, 107, 0, 0.4);
">
  Get Started Free →
</button>

<!-- CTA above the fold -->
<div class="hero">
  <h1>Transform Your Business Today</h1>
  <p>Join 10,000+ companies already growing</p>
  <button class="cta-primary">Start Free Trial</button>
  <span class="trust-text">No credit card required</span>
</div>`;
  }
  
  // Form fixes
  if (title.includes('form') || title.includes('input') || title.includes('field') || title.includes('label')) {
    return `<!-- Optimized Form -->

<form class="conversion-form">
  <!-- Clear labels with required indicator -->
  <div class="form-group">
    <label for="email">Email Address *</label>
    <input 
      id="email" 
      type="email" 
      required
      placeholder="you@company.com"
      style="
        width: 100%;
        padding: 12px 16px;
        font-size: 16px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
      "
    >
  </div>
  
  <!-- Minimal fields (3-5 max) -->
  <div class="form-group">
    <label for="name">Full Name *</label>
    <input id="name" type="text" required>
  </div>
  
  <!-- Compelling submit button -->
  <button type="submit" class="cta-primary">
    Get Your Free Quote →
  </button>
  
  <!-- Trust reinforcement -->
  <p class="form-note">🔒 We respect your privacy</p>
</form>`;
  }
  
  // Trust signal fixes
  if (title.includes('trust') || title.includes('security') || title.includes('testimonial') || title.includes('review')) {
    return `<!-- Trust Signals Implementation -->

<!-- Security badges near forms -->
<div class="trust-badges" style="
  display: flex;
  gap: 16px;
  align-items: center;
  margin: 16px 0;
">
  <img src="/badges/ssl-secure.svg" alt="SSL Secured" width="80">
  <img src="/badges/money-back.svg" alt="30-Day Guarantee" width="80">
  <span style="color: #666; font-size: 14px;">
    🔒 256-bit SSL Encryption
  </span>
</div>

<!-- Customer testimonial -->
<blockquote class="testimonial" style="
  background: #f8f9fa;
  border-left: 4px solid #00c853;
  padding: 20px;
  margin: 24px 0;
  border-radius: 0 8px 8px 0;
">
  <p style="font-style: italic; margin: 0 0 12px 0;">
    "This product increased our conversions by 40%!"
  </p>
  <cite style="font-weight: 600;">
    — Sarah J., Marketing Director at TechCorp
  </cite>
</blockquote>

<!-- Star rating display -->
<div class="rating">
  ⭐⭐⭐⭐⭐ <span>4.9/5 from 2,000+ reviews</span>
</div>`;
  }
  
  // Font/readability fixes
  if (title.includes('font') || title.includes('readability') || title.includes('text')) {
    return `/* Readability Optimizations */

body {
  font-size: 16px;        /* Mobile-friendly base */
  line-height: 1.6;       /* Comfortable reading */
  color: #333;            /* High contrast */
}

.paragraph, .content p {
  max-width: 65ch;        /* Optimal line length */
  margin-bottom: 1.5em;
}

h1, h2, h3 {
  line-height: 1.3;
  color: #111;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  body {
    font-size: 17px;      /* Slightly larger on small screens */
  }
}`;
  }
  
  // Generic but useful fallback
  return `<!-- Recommended Implementation -->

<!-- Apply these CRO best practices: -->

<!-- 1. Clear visual hierarchy -->
<section class="optimized-section">
  <h2>Clear Headline</h2>
  <p>Supporting text that explains the value.</p>
  <button class="cta-primary">Take Action</button>
</section>

<!-- 2. Proper styling -->
<style>
  .cta-primary {
    padding: 14px 28px;
    font-size: 16px;
    font-weight: 600;
    background: #0066ff;
    color: white;
    border-radius: 8px;
    cursor: pointer;
  }
  .cta-primary:hover {
    background: #0052cc;
  }
</style>`;
}

function generateQuickWinProblemCode(win) {
  const title = (win.title || '').toLowerCase();
  
  if (title.includes('cta') || title.includes('fold')) {
    return `<!-- Quick Win: CTA Placement -->
<!-- Current: CTA is below the fold -->
<div class="hero">
  <h1>Welcome to Our Site</h1>
  <p>Long intro text...</p>
</div>
<!-- CTA appears only after scrolling -->`;
  }
  
  if (title.includes('font') || title.includes('size')) {
    return `/* Quick Win: Font Size */
body {
  font-size: 14px;  /* Too small for mobile */
}`;
  }
  
  if (title.includes('button') || title.includes('tap')) {
    return `/* Quick Win: Button Size */
.button {
  padding: 8px 12px;  /* Tap target too small */
  font-size: 12px;
}`;
  }
  
  return `<!-- Quick Win: ${win.title} -->
<!-- Current state needs optimization -->
<!-- Estimated fix time: ${win.timeEstimate || '5 minutes'} -->`;
}

function generateQuickWinFixCode(win) {
  const title = (win.title || '').toLowerCase();
  
  if (title.includes('cta') || title.includes('fold')) {
    return `<!-- Quick Win: CTA Above Fold -->
<div class="hero">
  <h1>Welcome to Our Site</h1>
  <p>Brief, compelling intro</p>
  <button class="cta-primary">Get Started</button>
</div>`;
  }
  
  if (title.includes('font') || title.includes('size')) {
    return `/* Quick Win: Readable Font */
body {
  font-size: 16px;  /* Readable, prevents zoom */
  line-height: 1.5;
}`;
  }
  
  if (title.includes('button') || title.includes('tap')) {
    return `/* Quick Win: Touch-Friendly Buttons */
.button {
  min-height: 44px;
  padding: 12px 24px;
  font-size: 16px;
}`;
  }
  
  return `<!-- Quick Win: ${win.title} -->
<!-- Implementation: -->
${(win.steps || ['Apply the recommended change']).map((s, i) => `<!-- ${i + 1}. ${s} -->`).join('\n')}`;
}

function createQuickWinsSection(quickWins) {
  return `
    <div style="
      background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 100%);
      border: 2px solid #ffd700;
      border-radius: 12px;
      padding: 1.5rem 2rem;
      margin: 1rem 0 2rem 0;
    ">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
        <span style="font-size: 1.75rem;">⚡</span>
        <h2 style="margin: 0; color: #ffd700; font-size: 1.35rem;">${t('reports.cro.quickWins', 'Quick Wins')}</h2>
        <span style="
          background: rgba(255, 215, 0, 0.2);
          color: #ffd700;
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
        ">${t('reports.cro.highImpactLowEffort', 'High Impact • Low Effort')}</span>
      </div>
      <p style="color: var(--r-text-muted, #6B7280); margin: 0 0 1.5rem 0; font-size: 0.95rem;">
        ${t('reports.cro.quickWinsDescription', 'These fixes take just minutes but can significantly improve your conversions.')}
      </p>
      
      <div style="display: grid; gap: 1rem;">
        ${quickWins.map((win, index) => `
          <div style="
            background: var(--r-surface-2, #F8FAFC);
            border: 1px solid rgba(255, 215, 0, 0.3);
            border-radius: 12px;
            padding: 1.25rem;
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 1rem;
            align-items: start;
          ">
            <!-- Icon & Number -->
            <div style="
              width: 50px;
              height: 50px;
              background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
              border-radius: 12px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
            ">
              <span style="font-size: 1.5rem;">${win.icon}</span>
            </div>
            
            <!-- Content -->
            <div>
              <h3 style="margin: 0 0 0.5rem 0; color: var(--r-text, #111827); font-size: 1.1rem;">${win.title}</h3>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                <span style="
                  display: inline-flex;
                  align-items: center;
                  gap: 0.35rem;
                  color: #00ff41;
                  font-size: 0.85rem;
                  font-weight: 600;
                ">
                  <span>⏱</span> ${win.timeEstimate}
                </span>
                <span style="
                  display: inline-flex;
                  align-items: center;
                  gap: 0.35rem;
                  color: #00d9ff;
                  font-size: 0.85rem;
                  font-weight: 600;
                ">
                  <span>📈</span> ${win.impact}
                </span>
                <span style="
                  background: ${win.difficulty === 'Easy' ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255, 140, 0, 0.15)'};
                  color: ${win.difficulty === 'Easy' ? '#00ff41' : '#ff8c00'};
                  padding: 0.15rem 0.5rem;
                  border-radius: 4px;
                  font-size: 0.75rem;
                  font-weight: 600;
                ">${win.difficulty}</span>
              </div>
              
              <!-- Steps -->
              <div style="
                background: rgba(255, 255, 255, 0.03);
                border-radius: 6px;
                padding: 0.75rem 1rem;
              ">
                <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.75rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">${t('reports.cro.howToFix', 'How to fix:')}</div>
                <ol style="margin: 0; padding-left: 1.25rem; color: #b0b0b0; font-size: 0.85rem; line-height: 1.6;">
                  ${win.steps.map(step => `<li>${step}</li>`).join('')}
                </ol>
              </div>
            </div>
            
            <!-- Quick Win Number -->
            <div style="
              color: rgba(255, 215, 0, 0.4);
              font-size: 2rem;
              font-weight: 900;
              line-height: 1;
            ">#${index + 1}</div>
          </div>
        `).join('')}
      </div>
      
      <div style="
        margin-top: 1.25rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(255, 215, 0, 0.2);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--r-text-faint, #9CA3AF);
        font-size: 0.85rem;
      ">
        <span>💡</span>
        <span>${t('reports.cro.quickWinsImpact', 'Implementing all quick wins could improve conversions by')} <strong style="color: #ffd700;">30-50%</strong></span>
      </div>
    </div>
  `;
}

function getGradeName(grade) {
  const names = {
    'A': t('reports.common.grades.excellent', 'Excellent'),
    'B': t('reports.common.grades.good', 'Good'),
    'C': t('reports.common.grades.fair', 'Fair'),
    'D': t('reports.common.grades.poor', 'Poor'),
    'F': t('reports.common.grades.critical', 'Critical')
  };
  return names[grade] || t('reports.common.grades.unknown', 'Unknown');
}

function renderCTAContent(ctas) {
  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 0.75rem 0; font-size: 1rem;">>> ${t('reports.cro.sections.ctaAnalysis', 'Call-to-Action Analysis')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1rem; font-size: 0.9rem;">
        ${t('reports.cro.ctaDescription', 'CTAs are the primary conversion elements on your page. Strong, visible CTAs with action-oriented text drive conversions.')}
      </p>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 1rem;">
        <div style="
          background: rgba(var(--accent-primary-rgb), 0.05);
          border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="font-size: 3rem; font-weight: 900; color: var(--accent-primary);">${ctas.count}</div>
          <div style="color: var(--r-text-muted, #6B7280); margin-top: 0.5rem;">${t('reports.cro.totalCtasFound', 'Total CTAs Found')}</div>
        </div>
        <div style="
          background: rgba(0, 200, 255, 0.05);
          border: 1px solid rgba(0, 200, 255, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="font-size: 3rem; font-weight: 900; color: #00c8ff;">${ctas.visible}</div>
          <div style="color: var(--r-text-muted, #6B7280); margin-top: 0.5rem;">${t('reports.cro.aboveTheFold', 'Above the Fold')}</div>
        </div>
      </div>

      ${ctas.examples.length > 0 ? `
        <h4 style="color: #bb86fc; margin: 1.5rem 0 1rem 0;">${t('reports.cro.ctaExamplesFound', 'CTA Examples Found:')}</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
          ${ctas.examples.map(text => `
            <span style="
              background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.15) 0%, rgba(var(--accent-primary-rgb), 0.05) 100%);
              padding: 0.75rem 1.25rem;
              border-radius: 6px;
              border: 1px solid rgba(var(--accent-primary-rgb), 0.4);
              color: var(--accent-primary);
              font-weight: 500;
            ">${text}</span>
          `).join('')}
        </div>
      ` : `
        <div style="
          background: rgba(255, 68, 68, 0.1);
          border: 1px solid rgba(255, 68, 68, 0.3);
          border-radius: 8px;
          padding: 1rem;
          color: #ff4444;
        ">
          ${t('reports.cro.noCtasDetected', 'No action-oriented CTAs detected. Add buttons with text like "Get Started", "Sign Up", or "Buy Now".')}
        </div>
      `}
    </div>
  `;
}

function renderFormContent(forms) {
  if (forms.count === 0) {
    return `
      <div>
        <h3 style="color: #ff8c00; margin: 0 0 1rem 0;">>> ${t('reports.cro.formAnalysis', 'Form Analysis')}</h3>
        <div style="
          background: rgba(255, 140, 0, 0.1);
          border: 1px solid rgba(255, 140, 0, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
          <p style="color: #ff8c00; font-weight: bold; margin: 0;">${t('reports.cro.noFormsDetected', 'No forms detected on this page')}</p>
          <p style="color: var(--r-text-muted, #6B7280); margin: 0.5rem 0 0 0; font-size: 0.9rem;">
            ${t('reports.cro.considerAddingForm', 'Consider adding a contact form or lead capture form to improve conversions.')}
          </p>
        </div>
      </div>
    `;
  }

  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> ${t('reports.cro.formAnalysis', 'Form Analysis')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1rem;">
        ${t('reports.cro.formAnalysisDescription', 'Forms are critical for lead capture. Optimize field count, validation, and user experience for higher completion rates.')}
      </p>

      <div style="overflow-x: auto; margin-bottom: 1rem;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #333;">
              <th style="text-align: left; padding: 0.75rem; color: #bb86fc;">${t('reports.cro.form', 'Form')}</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">${t('reports.cro.fields', 'Fields')}</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">${t('reports.cro.email', 'Email')}</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">${t('reports.cro.phone', 'Phone')}</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">${t('reports.cro.validation', 'Validation')}</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">${t('reports.cro.autocomplete', 'Autocomplete')}</th>
            </tr>
          </thead>
          <tbody>
            ${forms.details.map((form, idx) => `
              <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280);">${t('reports.cro.formNumber', 'Form {{number}}', { number: idx + 1 })}</td>
                <td style="padding: 0.75rem; text-align: center; color: ${form.fieldCount <= 5 ? '#00ff41' : form.fieldCount <= 8 ? '#ffd700' : '#ff4444'}; font-weight: bold;">
                  ${form.fieldCount}
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${form.hasEmail ? '#00ff41' : '#808080'};">${form.hasEmail ? '✓' : '–'}</span>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${form.hasPhone ? '#00ff41' : '#808080'};">${form.hasPhone ? '✓' : '–'}</span>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${form.hasValidation ? '#00ff41' : '#ff8c00'};">${form.hasValidation ? '✓' : '✗'}</span>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${form.hasAutocomplete ? '#00ff41' : '#ff8c00'};">${form.hasAutocomplete ? '✓' : '✗'}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="
        background: rgba(138, 43, 226, 0.05);
        border-radius: 6px;
        padding: 1rem;
        margin-top: 1rem;
      ">
        <h4 style="color: #bb86fc; margin: 0 0 0.5rem 0; font-size: 0.95rem;">${t('reports.cro.formOptimizationTips', 'Form Optimization Tips')}</h4>
        <ul style="color: var(--r-text-muted, #6B7280); margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
          <li>${t('reports.cro.tips.keepFormsUnder5', 'Keep forms under 5 fields when possible')}</li>
          <li>${t('reports.cro.tips.useAutocomplete', 'Use autocomplete to speed up form filling')}</li>
          <li>${t('reports.cro.tips.addInlineValidation', 'Add inline validation for better UX')}</li>
        </ul>
      </div>
    </div>
  `;
}

function renderTrustContent(trust) {
  const signals = [
    { key: 'hasSSL', label: t('reports.cro.trustSignalsList.sslCertificate', 'SSL Certificate'), icon: '🔒', desc: t('reports.cro.trustSignalsList.secureHttps', 'Secure HTTPS connection') },
    { key: 'hasTestimonials', label: t('reports.cro.trustSignalsList.testimonials', 'Testimonials'), icon: '💬', desc: t('reports.cro.trustSignalsList.customerReviews', 'Customer reviews visible') },
    { key: 'hasSocialProof', label: t('reports.cro.trustSignalsList.socialProof', 'Social Proof'), icon: '👥', desc: t('reports.cro.trustSignalsList.trustBadges', 'Trust badges or certifications') },
    { key: 'hasContactInfo', label: t('reports.cro.trustSignalsList.contactInfo', 'Contact Information'), icon: '📞', desc: t('reports.cro.trustSignalsList.phoneDisplayed', 'Phone number displayed') },
    { key: 'hasPrivacyPolicy', label: t('reports.cro.trustSignalsList.privacyPolicy', 'Privacy Policy'), icon: '📋', desc: t('reports.cro.trustSignalsList.privacyFound', 'Privacy policy link found') },
    { key: 'hasSecurityBadges', label: t('reports.cro.trustSignalsList.securityBadges', 'Security Badges'), icon: '🛡️', desc: t('reports.cro.trustSignalsList.securitySeals', 'Security seals visible') }
  ];

  const presentCount = signals.filter(s => trust[s.key]).length;

  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> ${t('reports.cro.trustSignalAnalysis', 'Trust Signal Analysis')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1rem;">
        ${t('reports.cro.trustSignalsDescription', 'Trust signals reduce friction and increase conversion rates. {{present}} of {{total}} trust elements detected.', { present: presentCount, total: signals.length })}
      </p>
      
      <div style="display: grid; gap: 0.75rem;">
        ${signals.map(signal => {
          const hasIt = trust[signal.key];
          return `
            <div style="
              display: grid;
              grid-template-columns: auto 1fr auto;
              gap: 1rem;
              align-items: center;
              padding: 1rem;
              background: ${hasIt ? 'rgba(0, 255, 65, 0.05)' : 'rgba(255, 68, 68, 0.05)'};
              border: 1px solid ${hasIt ? 'rgba(0, 255, 65, 0.2)' : 'rgba(255, 68, 68, 0.2)'};
              border-radius: 8px;
            ">
              <span style="font-size: 1.5rem;">${signal.icon}</span>
              <div>
                <div style="color: var(--r-text-muted, #6B7280); font-weight: 500;">${signal.label}</div>
                <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem;">${signal.desc}</div>
              </div>
              <span style="
                font-size: 1.5rem;
                color: ${hasIt ? '#00ff41' : '#ff4444'};
              ">${hasIt ? '✓' : '✗'}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderMobileContent(mobile) {
  const tapPercent = (mobile.tapTargetCompliance * 100).toFixed(1);

  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> ${t('reports.cro.mobileUxAnalysis', 'Mobile UX Analysis')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1rem;">
        ${t('reports.cro.mobileOptimizationCritical', 'Mobile optimization is critical - over 60% of web traffic comes from mobile devices.')}
      </p>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;">
        <!-- Tap Targets -->
        <div style="
          background: ${mobile.tapTargetCompliance >= 0.8 ? 'rgba(0, 255, 65, 0.05)' : 'rgba(255, 140, 0, 0.05)'};
          border: 2px solid ${mobile.tapTargetCompliance >= 0.8 ? 'rgba(0, 255, 65, 0.4)' : 'rgba(255, 140, 0, 0.4)'};
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="
            width: 80px;
            height: 80px;
            margin: 0 auto 1rem;
            border-radius: 50%;
            background: #ffffff;
            border: 3px solid ${mobile.tapTargetCompliance >= 0.8 ? '#00ff41' : '#ff8c00'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            font-weight: 900;
            color: #000;
          ">${tapPercent}%</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${t('reports.cro.mobile.tapTargetCompliance', 'Tap Target Compliance')}</div>
          <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.75rem; margin-top: 0.25rem;">${t('reports.cro.mobile.minimumSize', '44×44px minimum')}</div>
        </div>

        <!-- Font Size -->
        <div style="
          background: ${mobile.avgFontSize >= 16 ? 'rgba(0, 255, 65, 0.05)' : 'rgba(255, 140, 0, 0.05)'};
          border: 2px solid ${mobile.avgFontSize >= 16 ? 'rgba(0, 255, 65, 0.4)' : 'rgba(255, 140, 0, 0.4)'};
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="
            width: 80px;
            height: 80px;
            margin: 0 auto 1rem;
            border-radius: 50%;
            background: #ffffff;
            border: 3px solid ${mobile.avgFontSize >= 16 ? '#00ff41' : '#ff8c00'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.3rem;
            font-weight: 900;
            color: #000;
          ">${mobile.avgFontSize.toFixed(0)}px</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${t('reports.cro.mobile.averageFontSize', 'Average Font Size')}</div>
          <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.75rem; margin-top: 0.25rem;">${t('reports.cro.mobile.recommended16px', '16px recommended')}</div>
        </div>

        <!-- Viewport Meta -->
        <div style="
          background: ${mobile.hasViewportMeta ? 'rgba(0, 255, 65, 0.05)' : 'rgba(255, 68, 68, 0.05)'};
          border: 2px solid ${mobile.hasViewportMeta ? 'rgba(0, 255, 65, 0.4)' : 'rgba(255, 68, 68, 0.4)'};
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="
            width: 80px;
            height: 80px;
            margin: 0 auto 1rem;
            border-radius: 50%;
            background: #ffffff;
            border: 3px solid ${mobile.hasViewportMeta ? '#00ff41' : '#ff4444'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            color: ${mobile.hasViewportMeta ? '#00cc33' : '#cc0000'};
          ">${mobile.hasViewportMeta ? '✓' : '✗'}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${t('reports.cro.mobile.viewportMeta', 'Viewport Meta')}</div>
          <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.75rem; margin-top: 0.25rem;">${t('reports.cro.mobile.responsiveScaling', 'Responsive scaling')}</div>
        </div>
      </div>
    </div>
  `;
}

function renderRecommendationsContent(recommendations, quickWins = []) {
  if (!recommendations || recommendations.length === 0) {
    return `
      <div>
        <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> ${t('reports.cro.recommendations', 'Recommendations')}</h3>
        <div style="
          background: rgba(0, 255, 65, 0.1);
          border: 1px solid rgba(0, 255, 65, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
          <p style="color: #00ff41; font-weight: bold; margin: 0;">${t('reports.cro.noCriticalIssues', 'Great job! No critical issues found.')}</p>
          <p style="color: var(--r-text-muted, #6B7280); margin: 0.5rem 0 0 0; font-size: 0.9rem;">
            ${t('reports.cro.followsBestPractices', 'Your page follows CRO best practices.')}
          </p>
        </div>
      </div>
    `;
  }

  const priorityColors = {
    critical: '#ff4444',
    high: '#ff8c00',
    medium: '#ffd700',
    low: '#00ff41'
  };

  const quickWinsSection = quickWins && quickWins.length > 0 ? `
    <div style="margin-top: 1.5rem;">
      ${createQuickWinsSection(quickWins)}
    </div>
  ` : '';

  return `
    <div>
      <h3 style="color: #bb86fc; margin: 0 0 1rem 0;">>> ${t('reports.cro.actionableRecommendations', 'Actionable Recommendations')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1rem;">
        ${t('reports.cro.prioritizedImprovements', 'Prioritized improvements to boost your conversion rate.')}
      </p>
      
      <div style="display: grid; gap: 1rem;">
        ${recommendations.map(rec => {
          const color = priorityColors[rec.priority] || '#808080';
          return `
            <div style="
              background: ${color}10;
              border-left: 4px solid ${color};
              border-radius: 0 8px 8px 0;
              padding: 1.25rem;
            ">
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                <span style="
                  background: ${color}30;
                  color: ${color};
                  padding: 0.25rem 0.5rem;
                  border-radius: 4px;
                  font-size: 0.75rem;
                  font-weight: bold;
                  text-transform: uppercase;
                ">${rec.priority}</span>
                <h4 style="color: var(--r-text-muted, #6B7280); margin: 0; font-size: 1rem;">${rec.message}</h4>
              </div>
              <p style="color: var(--r-text-muted, #6B7280); margin: 0 0 0.5rem 0; font-size: 0.9rem;">${rec.detail}</p>
              <p style="color: ${color}; margin: 0; font-size: 0.85rem; font-style: italic;">
                ${t('reports.cro.impact', 'Impact')}: ${rec.impact}
              </p>
            </div>
          `;
        }).join('')}
      </div>
      ${quickWinsSection}
    </div>
  `;
}

function getGradeColor(grade) {
  const colors = { 'A': '#00ff41', 'B': '#ffd700', 'C': '#ff8c00', 'D': '#ff4444', 'F': '#ff4444' };
  return colors[grade] || '#888';
}

function getScoreColor(score) {
  const stops = [
    [0,'#1A0000'],[5,'#311400'],[10,'#482900'],[15,'#5F3D00'],
    [20,'#765200'],[25,'#8C6600'],[30,'#A37A00'],[35,'#BA8F00'],
    [40,'#D1A300'],[45,'#E8B800'],[50,'#FFCC00'],[55,'#E6D106'],
    [60,'#CCD60C'],[65,'#B2DB12'],[70,'#99E018'],[75,'#80E61E'],
    [80,'#66EB23'],[85,'#4CF029'],[90,'#33F52F'],[95,'#1AFA35'],
    [100,'#00FF3B']
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

/**
 * Initialize PDF Export for CRO Analyzer
 */
function initCROPDFExport() {
  if (typeof initPDFExport === 'function') {
    initPDFExport({
      contentSelector: '#results, #resultsContent, .results-container',
      buttonSelector: '#exportPdfBtn, .export-pdf-btn, #downloadPdfButton',
      reportSubtitle: t('reports.cro.subtitle', 'Conversion Rate Optimization Analysis'),
      urlInputSelector: '#urlInput, input[type="url"]',
      filename: `cro-analysis-${new Date().toISOString().split('T')[0]}.pdf`
    });
  } else {
  }
}

// Initialize PDF export when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCROPDFExport);
} else {
  initCROPDFExport();
}

// Add click event delegation for CRO fix accordions and tabs
document.addEventListener('click', function(e) {
  // Handle tab clicks first
  const tab = e.target.closest('.cro-fix-tab');
  if (tab) {
    const accordion = tab.closest('.cro-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      const tabName = tab.getAttribute('data-tab') || 'summary';
      if (fixId && typeof window.switchCROFixTab === 'function') {
        e.preventDefault();
        e.stopPropagation();
        window.switchCROFixTab(fixId, tabName);
      }
    }
    return;
  }
  // Handle accordion header clicks
  const header = e.target.closest('.cro-fix-header');
  if (header) {
    const accordion = header.closest('.cro-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      if (fixId && typeof window.toggleCROFixAccordion === 'function') {
        window.toggleCROFixAccordion(fixId);
      }
    }
  }
});
