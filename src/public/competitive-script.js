/**
 * Competitive Analysis Dashboard
 * Compare your site vs competitors with interactive visualizations
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'competitive-analysis';

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

// Returns analysis steps with translations evaluated at runtime
function getAnalysisSteps() {
  return [
    { label: t('loader.seoAnalysis', 'SEO Analysis'), detail: t('loader.analyzingSeoMetrics', 'Analyzing search engine optimization metrics...') },
    { label: t('loader.securityScan', 'Security Scan'), detail: t('loader.checkingSecurityProtocols', 'Checking security headers and protocols...') },
    { label: t('loader.accessibilityCheck', 'Accessibility Check'), detail: t('loader.evaluatingAccessibility', 'Evaluating accessibility standards...') },
    { label: t('loader.coreWebVitals', 'Core Web Vitals'), detail: t('loader.measuringPageSpeed', 'Measuring page speed and user experience...') },
    { label: t('loader.performanceTest', 'Performance Test'), detail: t('loader.runningLighthouse', 'Running Lighthouse performance audit...') }
  ];
}

// Max competitors limited to 5 for comprehensive competitive analysis
const maxCompetitors = 5;

// WebSocket connection
let socket = null;

// Unified loader instance (reassigned in analyze function)
// eslint-disable-next-line prefer-const
let loader = null;

// Initialize Socket.IO connection
function initializeWebSocket() {
  if (socket) return; // Already connected
  
  // Socket.IO client library loaded via CDN in HTML
  // eslint-disable-next-line no-undef
  socket = io({
    transports: ['websocket', 'polling']
  });
  
  socket.on('connect', () => {
  });
  
  socket.on('disconnect', () => {
  });
  
  socket.on('analysis:progress', (data) => {
    handleProgressUpdate(data);
  });
}

// Ensure analyzer key is present for deterministic report identity
document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
});

// ============================================
// BILLING RETURN HANDLING
// ============================================
(async function initCompetitiveAnalysis() {
  // Ensure i18n translations are loaded before rendering any report content.
  // Without this, stored reports loaded on page init may render with English
  // fallbacks because window.i18n.init() (async fetch) hasn't completed yet.
  if (window.i18n && typeof window.i18n.init === 'function' && !window.i18n.initialized) {
    try { await window.i18n.init(); } catch (e) { /* i18n will use fallback */ }
  }

  const params = new URLSearchParams(window.location.search);
  const reportId = params.get('report_id') || '';
  const autoUrl = params.get('url') || '';
  const billingSuccess = params.get('billing_success') === 'true';

  // If we have a report_id, set it immediately so hasAccess checks work
  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    console.log('[Competitive] Set report_id from URL:', reportId);
  }

  // Pre-fill URL input if provided
  const urlInput = document.getElementById('yourUrl');
  if (autoUrl && urlInput) {
    urlInput.value = autoUrl;
  }

  // If returning from billing, wait for billing return processing to complete
  if (billingSuccess && !window.__smBillingReturnComplete) {
    console.log('[Competitive] Waiting for billing return processing...');
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
      // Timeout fallback
      setTimeout(() => {
        window.removeEventListener('sm:billingReturnComplete', handler);
        resolve();
      }, 5000);
    });
    console.log('[Competitive] Billing return processing complete');

    // Check if results were already displayed by report-ui.js
    const resultsContainer = document.getElementById('results');
    if (window.currentCompetitiveResults && resultsContainer && resultsContainer.style.display !== 'none' && resultsContainer.innerHTML.trim()) {
      console.log('[Competitive] Results already displayed by report-ui.js');
      return;
    }

    // report-ui.js couldn't display results, try to get them ourselves
    console.log('[Competitive] Attempting to display results after billing return...');

    // First check sessionStorage (set by PricingModal before checkout)
    // Try new unique key format first
    let cachedData = null;
    const checkoutKey = sessionStorage.getItem('sm_checkout_key');
    if (checkoutKey && checkoutKey.includes('competitive')) {
      try {
        const raw = sessionStorage.getItem(checkoutKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          cachedData = parsed.results;
          console.log('[Competitive] Found cached results in unique key:', checkoutKey);
        }
      } catch (e) {
        console.warn('[Competitive] Failed to parse from unique key:', e);
      }
    }
    // Fall back to legacy key
    if (!cachedData) {
      try {
        const cachedResults = sessionStorage.getItem('sm_checkout_results');
        if (cachedResults) {
          const data = JSON.parse(cachedResults);
          if (data && data.yourSite) { // Verify it's competitive analysis data
            cachedData = data;
            console.log('[Competitive] Found cached results in legacy sessionStorage');
          }
        }
      } catch (e) {
        console.warn('[Competitive] Failed to parse cached results:', e);
      }
    }

    if (cachedData) {
      displayResults(cachedData);
      if (checkoutKey) {
        sessionStorage.removeItem(checkoutKey);
        sessionStorage.removeItem('sm_checkout_key');
      }
      sessionStorage.removeItem('sm_checkout_results');
      return;
    }

    // Fall back to loading from database
    if (reportId && window.ReportStorage) {
      try {
        const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displayResults);
        if (loaded) {
          console.log('[Competitive] Loaded report from database');
          return;
        }
      } catch (e) {
        console.warn('[Competitive] Failed to load from database:', e);
      }
    }

    console.log('[Competitive] No cached results found after billing return');
    return;
  }

  // If we have a report_id (e.g., from dashboard), try to load stored report
  if (reportId && window.ReportStorage) {
    console.log('[Competitive] Checking for stored report:', reportId);

    // Fetch billing status first to ensure hasAccess works correctly
    if (window.ProReportBlock?.fetchBillingStatus) {
      console.log('[Competitive] Fetching billing status (force refresh)...');
      await window.ProReportBlock.fetchBillingStatus(true);
    }

    // Try to load the stored report
    try {
      const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displayResults);
      if (loaded) {
        console.log('[Competitive] Stored report loaded successfully');
        return;
      }
    } catch (e) {
      console.warn('[Competitive] Failed to load stored report:', e);
    }
  }
})();

// Handle real-time progress updates
function handleProgressUpdate(data) {
  // Update loader based on WebSocket data
  if (!loader) return;
  
  // Map WebSocket stage/metric to step index
  const stepMapping = {
    'SEO': 0,
    'Security': 1,
    'Accessibility': 2,
    'Core Web Vitals': 3,
    'Performance': 4
  };
  
  if (data.stage && stepMapping[data.stage] !== undefined) {
    const stepIndex = stepMapping[data.stage];
    
    // Update modal step display
    const modalSteps = document.querySelectorAll('.modal-step');
    if (modalSteps[stepIndex]) {
      if (data.status === 'metric-complete') {
        // Mark step as complete
        modalSteps[stepIndex].classList.remove('pending', 'active');
        modalSteps[stepIndex].classList.add('complete');
        modalSteps[stepIndex].querySelector('.modal-step-icon').textContent = '✓';
        
        loader.completeStep(stepIndex);
        
        // Activate next step
        if (modalSteps[stepIndex + 1]) {
          modalSteps[stepIndex + 1].classList.remove('pending');
          modalSteps[stepIndex + 1].classList.add('active');
          modalSteps[stepIndex + 1].querySelector('.modal-step-icon').textContent = '◉';
        }
      } else if (data.status === 'metric') {
        // Mark step as active
        modalSteps[stepIndex].classList.remove('pending');
        modalSteps[stepIndex].classList.add('active');
        modalSteps[stepIndex].querySelector('.modal-step-icon').textContent = '◉';
      }
    }
  }
}

// Add competitor input field
// eslint-disable-next-line no-unused-vars
function addCompetitorInput() {
  const container = document.getElementById('competitorInputs');
  const currentCount = container.querySelectorAll('.competitor-input-row').length;
  
  if (currentCount >= maxCompetitors) {
    alert(t('reports.competitive.maxCompetitorsAllowed', 'Maximum {{count}} competitors allowed', { count: maxCompetitors }));
    return;
  }
  
  const row = document.createElement('div');
  row.className = 'competitor-input-row';
  
  const input = document.createElement('input');
  input.type = 'url';
  input.className = 'competitor-url';
  input.placeholder = `https://competitor${currentCount + 1}.com`;
  input.setAttribute('aria-label', t('reports.competitive.competitorUrlLabel', 'Competitor {{num}} URL', { num: currentCount + 1 }));
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-competitor';
  removeBtn.textContent = t('reports.common.remove', 'Remove');
  removeBtn.addEventListener('click', function() {
    removeCompetitor(this);
  });
  
  row.appendChild(input);
  row.appendChild(removeBtn);
  container.appendChild(row);
  
  // Hide add button if at max
  if (currentCount + 1 >= maxCompetitors) {
    document.getElementById('addCompetitorBtn').style.display = 'none';
  }
}

// Expose for HTML button handlers / external triggers
window.addCompetitorInput = addCompetitorInput;

// Remove competitor input field
function removeCompetitor(button) {
  const container = document.getElementById('competitorInputs');
  const row = button.parentElement;

  if (container.querySelectorAll('.competitor-input-row').length <= 1) {
    alert(t('reports.competitive.atLeastOneCompetitor', 'At least one competitor is required'));
    return;
  }

  row.remove();

  // Show add button if below max
  document.getElementById('addCompetitorBtn').style.display = 'block';
}

// Expose removeCompetitor for HTML onclick handlers
window.removeCompetitor = removeCompetitor;

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
  // Add Competitor button
  const addBtn = document.getElementById('addCompetitorBtn');
  if (addBtn) {
    addBtn.addEventListener('click', addCompetitorInput);
  }

  // Use event delegation for Remove buttons (handles dynamically added buttons)
  const competitorInputs = document.getElementById('competitorInputs');
  if (competitorInputs) {
    competitorInputs.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-competitor')) {
        removeCompetitor(e.target);
      }
    });
  }
});

// ============================================
// EVENT DELEGATION FOR COMPETITIVE FIX ACCORDIONS
// Replaces inline onclick handlers (blocked by CSP)
// ============================================
document.addEventListener('click', function(e) {
  // Handle data-action based clicks first
  const target = e.target.closest('[data-action]');
  if (target) {
    const action = target.getAttribute('data-action');

    switch (action) {
      case 'toggle-accordion': {
        const accordionId = target.getAttribute('data-accordion-id');
        if (accordionId && typeof window.toggleCompetitiveFixAccordion === 'function') {
          e.preventDefault();
          window.toggleCompetitiveFixAccordion(accordionId);
        }
        return;
      }

      case 'switch-tab': {
        const accordionId = target.getAttribute('data-accordion-id');
        const tabName = target.getAttribute('data-tab');
        if (accordionId && tabName && typeof window.switchCompetitiveFixTab === 'function') {
          e.preventDefault();
          e.stopPropagation();
          window.switchCompetitiveFixTab(accordionId, tabName);
        }
        return;
      }
    }
  }

  // Fallback: Handle tab clicks by class (for backward compatibility)
  const tab = e.target.closest('.competitive-fix-tab');
  if (tab) {
    const accordion = tab.closest('.competitive-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      const tabName = tab.getAttribute('data-tab') || 'summary';

      if (fixId && typeof window.switchCompetitiveFixTab === 'function') {
        e.preventDefault();
        e.stopPropagation();
        window.switchCompetitiveFixTab(fixId, tabName);
      }
    }
    return;
  }

  // Handle accordion header clicks
  const header = e.target.closest('.competitive-fix-header');
  if (header) {
    const accordion = header.closest('.competitive-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      if (fixId && typeof window.toggleCompetitiveFixAccordion === 'function') {
        e.preventDefault();
        window.toggleCompetitiveFixAccordion(fixId);
      }
    }
  }
});

// CSP-compliant hover styles
(function() {
  if (document.getElementById('comp-csp-hover-styles')) return;
  const style = document.createElement('style');
  style.id = 'comp-csp-hover-styles';
  style.textContent = `
    .comp-hover-row:hover {
      background: rgba(255,255,255,0.05) !important;
    }
  `;
  document.head.appendChild(style);
})();

// Validate URL format
function isValidUrl(string) {
  // Add protocol if missing
  let urlToTest = string;
  if (!/^https?:\/\//i.test(urlToTest)) {
    urlToTest = 'https://' + urlToTest;
  }
  
  try {
    const url = new URL(urlToTest);
    // Check for valid hostname with at least one dot (domain.tld)
    const hostname = url.hostname;
    if (!hostname.includes('.')) {
      return false;
    }
    // Basic domain pattern check (alphanumeric, hyphens, dots)
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    return domainPattern.test(hostname) || hostname.includes('.');
  } catch {
    return false;
  }
}

// Analyze competition
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const yourUrl = document.getElementById('yourUrl').value.trim();
  const competitorInputs = document.querySelectorAll('.competitor-url');
  const competitorUrls = Array.from(competitorInputs)
    .map(input => input.value.trim())
    .filter(url => url.length > 0);
  
  if (!yourUrl) {
    alert(t('reports.competitive.pleaseEnterYourUrl', 'Please enter your website URL'));
    return;
  }
  
  // Validate your URL format
  if (!isValidUrl(yourUrl)) {
    alert(t('reports.competitive.invalidUrlFormat', '"{{url}}" is not a valid URL. Please enter a valid website address like "example.com" or "https://example.com"', { url: yourUrl }));
    return;
  }
  
  if (competitorUrls.length === 0) {
    alert(t('reports.competitive.pleaseEnterCompetitor', 'Please enter at least one competitor URL'));
    return;
  }
  
  // Validate all competitor URLs
  for (const url of competitorUrls) {
    if (!isValidUrl(url)) {
      alert(t('reports.competitive.invalidCompetitorUrl', '"{{url}}" is not a valid URL. Please enter a valid website address like "competitor.com" or "https://competitor.com"', { url }));
      return;
    }
  }
  
  const resultsDiv = document.getElementById('results');
  const analyzeBtn = document.getElementById('analyzeBtn');
  
  // Show Pac-Man modal instead of regular loader
  const modal = document.getElementById('pacmanModal');
  const previousFocus = document.activeElement;
  const closePacmanModal = () => {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onPacmanKeyDown);
    if (previousFocus && typeof previousFocus.focus === 'function' && document.contains(previousFocus)) {
      previousFocus.focus();
    }
  };

  const getPacmanFocusable = () => {
    if (!modal) return [];
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];
    return Array.from(modal.querySelectorAll(selectors.join(','))).filter((el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style && style.visibility !== 'hidden' && style.display !== 'none';
    });
  };

  const onPacmanKeyDown = (e) => {
    if (!modal || !modal.classList.contains('active')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePacmanModal();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = getPacmanFocusable();
    if (!focusables.length) {
      e.preventDefault();
      modal.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onPacmanKeyDown);
    window.requestAnimationFrame(() => modal.focus());
  }
  
  // Initialize unified loader (hidden, but still tracking progress)
  const steps = getAnalysisSteps();
  
  // Initialize modal progress tracking
  const totalSeconds = 180; // 3 minutes (realistic estimate)
  let elapsedSeconds = 0;
  
  const modalTimer = setInterval(() => {
    elapsedSeconds++;
    const remaining = totalSeconds - elapsedSeconds;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    
    const timeDisplay = document.getElementById('modalTimeRemaining');
    if (timeDisplay) {
      timeDisplay.textContent = t('reports.common.timeRemaining', 'Time remaining: {{minutes}}m {{seconds}}s', { minutes, seconds });
    }
    
    // Update progress bar
    const progressFill = document.getElementById('modalProgressFill');
    const progressPercent = document.getElementById('modalProgressPercent');
    if (progressFill) {
      const percentage = (elapsedSeconds / totalSeconds) * 100;
      progressFill.style.width = `${Math.min(percentage, 100)}%`;
      
      if (progressPercent) {
        progressPercent.textContent = `${Math.min(Math.round(percentage), 100)}%`;
      }
    }
  }, 1000);
  
  // eslint-disable-next-line no-undef
  loader = new AnalyzerLoader('loadingContainer');
  loader.start(steps, t('loader.analyzingCompetitive', 'COMPETITIVE ANALYSIS'), 180); // 3 minutes = 180 seconds
  
  // Initialize WebSocket connection
  initializeWebSocket();
  
  resultsDiv.style.display = 'none';
  analyzeBtn.disabled = true;
  
  try {
    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/competitive-analysis', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        yourUrl,
        competitorUrls,
        scanStartedAt,
        lang: window.i18n?.getActiveLocale?.() || document.documentElement.lang || 'en'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (error.code === 'SCAN_QUOTA_EXCEEDED') {
        const limit = error.scansLimit || 10;
        loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
        clearInterval(modalTimer);
        closePacmanModal();
        return;
      }
      // Extract the actual error message from the response
      const errorMessage = error.message || error.error || error.details?.message || t('reports.competitive.analysisFailed', 'Analysis failed');
      throw new Error(errorMessage);
    }
    
    const data = await response.json();

    // Extract and set report metadata from API response
    console.log('[competitive-script] Setting report metadata from API response');
    const apiReportId = data?.reportId || data?.results?.reportId;
    const screenshotUrl = data?.screenshotUrl || data?.results?.screenshotUrl;
    if (apiReportId) {
      document.body.setAttribute('data-report-id', apiReportId);
    }
    if (screenshotUrl) {
      document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
    }

    // Join WebSocket session room for real-time updates
    if (data.sessionId && socket) {
      socket.emit('join-session', data.sessionId);
    }
    
    // Debug: Log the data structure
    // Validate data structure before rendering
    if (!data || !data.yourSite) {
      throw new Error(t('reports.competitive.errorMissingYourSite', 'Invalid response structure: missing yourSite data'));
    }

    if (!data.yourSite.scores) {
      throw new Error(t('reports.competitive.errorMissingScores', 'Invalid response structure: missing scores data'));
    }
    
    displayResults(data);

    loader.complete();

    // Close modal and show results
    clearInterval(modalTimer);
    closePacmanModal();
    resultsDiv.style.display = 'block';
    window.__REPORT_READY__ = true;
    window.dispatchEvent(new CustomEvent('report:ready'));
    
  } catch (error) {
    // Show detailed error message
    const errorMsg = error.message || 'An unknown error occurred';
    loader.showError(errorMsg);
    console.error('Competitive analysis error:', error);
    
    // Close modal on error
    clearInterval(modalTimer);
    closePacmanModal();
  } finally {
    analyzeBtn.disabled = false;
  }
});

// Display competitive analysis results
async function displayResults(data) {
  // Ensure i18n is loaded before rendering (prevents English fallback on fast stored-report loads)
  if (window.i18n && !window.i18n.initialized) {
    try { await window.i18n.init(); } catch (e) { /* fallback */ }
  }

  // Defensive checks
  if (!data || !data.yourSite || !data.competitors) {
    console.error('Invalid data structure:', data);
    alert(t('reports.common.errorInvalidData', 'Error: Invalid response data structure'));
    return;
  }

  if (!data.yourSite.scores) {
    console.error('Missing scores in yourSite:', data.yourSite);
    alert(t('reports.common.errorMissingScores', 'Error: Missing scores data'));
    return;
  }
  
  const resultsDiv = document.getElementById('results');
  const reportId = data.reportId || '';

  // Build screenshot URL for report display
  const screenshotUrl = data.screenshotUrl || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');
  if (screenshotUrl) {
    document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
  }
  const screenshots = screenshotUrl ? [{ src: screenshotUrl, alt: `Screenshot of ${data.yourSite?.url || ''}`, device: '' }] : [];

  // Store data globally for chart access and billing return
  window.competitiveData = data;
  window.currentCompetitiveResults = data;
  
  try {
    // Build summary donuts from scores
    const summary = buildCompetitiveSummary(data);
    
    // Build sections for ReportContainer
    const sections = buildCompetitiveSections(data, reportId);
    
    // Use ReportContainer.create() - SEO pattern
    const reportHTML = (window.ReportContainer && typeof window.ReportContainer.create === 'function')
      ? window.ReportContainer.create({
          url: data.yourSite.url,
          timestamp: data.timestamp || new Date().toISOString(),
          mode: 'competitive',
          title: t('reports.competitive.title', 'Competitive Analysis'),
          subtitle: t('reports.competitive.subtitle', 'Ranked #{{rank}} of {{total}} sites analyzed', { rank: data.rankings?.overall?.rank || '?', total: (data.competitors?.length || 0) + 1 }),
          summary,
          sections,
          screenshots,
          proBlock: true,
          proBlockOptions: {
            context: 'competitive-analysis',
            features: ['pdf', 'excel', 'csv', 'share'],
            title: t('reports.common.unlockReport', 'Unlock Report'),
            subtitle: t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.'),
            reportId
          },
          // Custom content to inject after summary (executive summary + charts)
          customHeaderContent: renderExecutiveSummary(data) + renderInteractiveCharts(data)
        })
      : renderFallbackResults(data);

    resultsDiv.innerHTML = `<div class="report-scope">${reportHTML}</div>`;

    // Show the results div (important for billing return flow)
    resultsDiv.style.display = 'block';

    // Initialize charts after DOM is updated
    setTimeout(() => {
      initializeCharts(data);
    }, 100);
    
    // Initialize accordion interactions
    if (window.ReportAccordion && typeof window.ReportAccordion.initInteractions === 'function') {
      window.ReportAccordion.initInteractions();
    }

    // Refresh paywall UI
    if (reportId && window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
      window.CreditsManager.renderPaywallState(reportId);
    }

    // Check if already unlocked and reveal Pro content
    const isUnlocked = !!(
      (data && (data.unlocked === true || data.purchased === true)) ||
      (window.ProReportBlock && typeof window.ProReportBlock.isProSubscriber === 'function' && window.ProReportBlock.isProSubscriber()) ||
      (reportId && window.ProReportBlock?.hasAccess?.(reportId))
    );

    console.log('[Competitive] Display unlock check:', { reportId, isUnlocked, dataUnlocked: data?.unlocked, dataPurchased: data?.purchased });

    if (isUnlocked) {
      revealCompetitiveProContent();
    }

    // Listen for unlock events (when user purchases during this session)
    if (!window.__competitiveUnlockListenerAttached) {
      window.__competitiveUnlockListenerAttached = true;
      window.addEventListener('reportUnlocked', (e) => {
        const unlockedId = e && e.detail ? e.detail.reportId : '';
        if (!unlockedId || unlockedId !== document.body.getAttribute('data-report-id')) return;

        console.log('[Competitive] Report unlocked event received:', unlockedId);

        // Re-render the Pro sections with full content
        const storedData = window.currentCompetitiveResults || window.competitiveData;
        if (storedData) {
          // Re-render head-to-head
          const h2hBody = document.querySelector('[data-accordion-body="head-to-head"]');
          if (h2hBody) {
            h2hBody.innerHTML = renderHeadToHeadContent(storedData);
          }

          // Re-render strengths-weaknesses
          const swBody = document.querySelector('[data-accordion-body="strengths-weaknesses"]');
          if (swBody) {
            swBody.innerHTML = renderStrengthsWeaknessesContent(storedData);
          }

          // Re-render recommendations
          const recBody = document.querySelector('[data-accordion-body="report-recommendations"]');
          if (recBody && storedData.recommendations) {
            recBody.innerHTML = renderRecommendationsContent(storedData.recommendations);
          }
        }

        revealCompetitiveProContent();

        if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
          window.CreditsManager.renderPaywallState(unlockedId);
        }
      });
    }

  } catch (error) {
    console.error('Error rendering results:', error);
    alert(t('reports.common.errorDisplayingResults', 'Error displaying results: {{message}}', { message: error.message }));
  }
}

// Reveal Pro content after unlock (removes lock overlays)
function revealCompetitiveProContent() {
  console.log('[Competitive] Revealing Pro content...');
  const overlays = document.querySelectorAll('.report-shell__lock-overlay');
  overlays.forEach((overlay) => {
    const locked = overlay.querySelector('.is-locked');
    if (locked) {
      // Move content out of the locked wrapper
      const parent = overlay.parentElement;
      if (parent) {
        parent.innerHTML = locked.innerHTML;
      }
    }
  });

  // Also remove any remaining lock indicators
  document.querySelectorAll('[data-hide-when-unlocked]').forEach(el => el.remove());
  document.querySelectorAll('.pro-locked').forEach(el => el.classList.remove('pro-locked'));

  // Remove locked state from Pro Report Blocks (show accent border after unlock)
  document.querySelectorAll('.pro-report-block--locked, .pro-report-block[data-locked]').forEach((block) => {
    block.classList.remove('pro-report-block--locked');
    block.removeAttribute('data-locked');
  });
}

// Build summary donuts for competitive analysis
function buildCompetitiveSummary(data) {
  const summary = [];
  const scores = data.yourSite.scores;
  
  // Overall score
  if (typeof scores.overall === 'number') {
    summary.push({ label: t('reports.metrics.overall', 'Overall'), score: scores.overall });
  }

  // Individual metrics
  if (typeof scores.seo === 'number') {
    summary.push({ label: t('reports.metrics.seo', 'SEO'), score: scores.seo });
  }
  if (typeof scores.security === 'number') {
    summary.push({ label: t('reports.metrics.security', 'Security'), score: scores.security });
  }
  if (typeof scores.accessibility === 'number') {
    summary.push({ label: t('reports.metrics.accessibility', 'Accessibility'), score: scores.accessibility });
  }
  if (typeof scores.coreWebVitals === 'number') {
    summary.push({ label: t('reports.metrics.coreWebVitals', 'Core Web Vitals'), score: scores.coreWebVitals });
  }
  if (typeof scores.performance === 'number') {
    summary.push({ label: t('reports.metrics.performance', 'Performance'), score: scores.performance });
  }
  
  return summary;
}

// Build sections for ReportContainer
function buildCompetitiveSections(data, reportId) {
  // Use ProReportBlock.hasAccess() which checks both Pro subscription and purchased reports
  // Default to LOCKED (false) - user must prove they have access
  let isUnlocked = false;

  if (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function') {
    isUnlocked = window.ProReportBlock.hasAccess(reportId);
  }

  // Fallback: also check CreditsManager for immediate unlock state
  if (!isUnlocked && reportId && window.CreditsManager) {
    if (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) {
      isUnlocked = true;
    } else if (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId)) {
      isUnlocked = true;
    }
  }

  // Also check if data itself has unlock status from database
  if (!isUnlocked && data && (data.unlocked === true || data.purchased === true)) {
    isUnlocked = true;
  }

  console.log('[Competitive] Access check:', { reportId, isUnlocked, dataUnlocked: data?.unlocked, dataPurchased: data?.purchased });
  
  const sections = [];
  
  // Detailed Metrics Breakdown - always expanded
  sections.push({
    id: 'detailed-metrics',
    title: t('reports.competitive.detailedMetrics', 'Detailed Metrics Breakdown'),
    expanded: true,
    contentHTML: renderDetailedMetricsContent(data)
  });

  // Key Insights - always expanded
  if (data.insights && data.insights.length > 0) {
    sections.push({
      id: 'key-insights',
      title: t('reports.competitive.keyInsights', 'Key Insights'),
      expanded: true,
      contentHTML: renderInsightsContent(data.insights)
    });
  }

  // Visual Score Comparison
  sections.push({
    id: 'visual-comparison',
    title: t('reports.competitive.visualComparison', 'Visual Score Comparison'),
    expanded: false,
    contentHTML: renderVisualComparisonContent(data)
  });

  // Site Screenshots — visual comparison of all analyzed sites
  sections.push({
    id: 'site-screenshots',
    title: t('reports.competitive.siteScreenshots', 'Site Screenshots'),
    expanded: false,
    contentHTML: renderSiteScreenshotsContent(data)
  });

  // Competitive Position Summary
  sections.push({
    id: 'competitive-position',
    title: t('reports.competitive.competitivePosition', 'Competitive Position Summary'),
    expanded: false,
    contentHTML: renderCompetitivePositionContent(data)
  });

  // Head-to-Head Battle (Pro)
  sections.push({
    id: 'head-to-head',
    title: t('reports.competitive.headToHead', 'Head-to-Head Battle'),
    expanded: false,
    isPro: true,
    locked: !isUnlocked,
    context: 'competitive-analysis',
    reportId,
    contentHTML: renderHeadToHeadContent(data)
  });

  // Strengths & Weaknesses (Pro)
  sections.push({
    id: 'strengths-weaknesses',
    title: t('reports.competitive.strengthsWeaknesses', 'Your Competitive Strengths & Weaknesses'),
    expanded: false,
    isPro: true,
    locked: !isUnlocked,
    context: 'competitive-analysis',
    reportId,
    contentHTML: renderStrengthsWeaknessesContent(data)
  });

  // Report and Recommendations (Pro)
  if (data.recommendations && data.recommendations.length > 0) {
    sections.push({
      id: 'report-recommendations',
      title: t('reports.common.reportAndRecommendations', 'Recommendations'),
      expanded: true,
      isPro: true,
      locked: !isUnlocked,
      context: 'competitive-analysis',
      reportId,
      contentHTML: renderRecommendationsContent(data.recommendations)
    });
  }
  
  return sections;
}

// Fallback rendering without ReportContainer
function renderFallbackResults(data) {
  return `
    ${renderExecutiveSummary(data)}
    ${renderInteractiveCharts(data)}
    <div id="accordionContainer" class="accordion-container">
      <div class="accordion expanded">
        <div class="accordion-header">📋 ${t('reports.competitive.detailedMetrics', 'Detailed Metrics Breakdown')}</div>
        <div class="accordion-content expanded">
          <div class="accordion-content-inner">${renderDetailedMetricsContent(data)}</div>
        </div>
      </div>
    </div>
  `;
}

// Pro preview for competitive analysis
function renderCompetitiveProPreview() {
  return `
    <div class="pro-preview-content" style="padding: 1.5rem; text-align: center; color: var(--text-secondary);">
      <p style="margin-bottom: 1rem;">🔒 ${t('reports.competitive.unlockToSeeRecommendations', 'Unlock to see detailed recommendations')}</p>
      <ul style="list-style: none; padding: 0; margin: 0; text-align: left; max-width: 300px; margin: 0 auto;">
        <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">• ${t('reports.competitive.proFeature1', 'Prioritized action items')}</li>
        <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">• ${t('reports.competitive.proFeature2', 'Gap analysis details')}</li>
        <li style="padding: 0.5rem 0;">• ${t('reports.competitive.proFeature3', 'Implementation guidance')}</li>
      </ul>
    </div>
  `;
}

// Create accordion section for competitive analysis
function createCompetitiveAccordion(container, id, title, contentCreator, score, startExpanded = false) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  accordion.style.marginBottom = '0.5rem';
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  header.innerHTML = `
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      <span>${title}</span>
    </span>
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      ${score !== null ? `<span style="color: ${getScoreColor(score)}; font-size: 0.9rem;">${score}</span>` : ''}
      <span class="accordion-toggle">${startExpanded ? '▲' : '▼'}</span>
    </span>
  `;
  
  const content = document.createElement('div');
  content.className = 'accordion-content';
  content.id = `accordion-${id}`;
  
  const contentInner = document.createElement('div');
  contentInner.className = 'accordion-content-inner';
  content.appendChild(contentInner);
  
  // Add click handler for accordion
  header.addEventListener('click', () => {
    const isExpanded = content.classList.contains('expanded');
    
    if (isExpanded) {
      // Collapse
      content.classList.remove('expanded');
      header.classList.remove('active');
      header.querySelector('.accordion-toggle').textContent = '▼';
    } else {
      // Expand and create content if not already created
      if (!contentInner.hasChildNodes()) {
        const contentHTML = contentCreator();
        contentInner.innerHTML = contentHTML;
      }
      
      content.classList.add('expanded');
      header.classList.add('active');
      header.querySelector('.accordion-toggle').textContent = '▲';
    }
  });
  
  accordion.appendChild(header);
  accordion.appendChild(content);
  container.appendChild(accordion);
  
  // If startExpanded, trigger the expansion
  if (startExpanded) {
    contentInner.innerHTML = contentCreator();
    content.classList.add('expanded');
    header.classList.add('active');
  }
}

// Get score color
function getAccentPrimaryColor() {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-primary')
      .trim();
    if (value) return value;
  } catch (e) {
    // Ignore
  }

  const isLightTheme = document.body && document.body.classList.contains('white-theme');
  return isLightTheme ? '#dd3838' : '#5bf4e7';
}

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

// Chart instances storage
let radarChart = null;
let barChart = null;

// Render interactive charts section
function renderInteractiveCharts() {
  return `
    <div class="section chart-container">
      <div class="chart-header">
        <div>
          <h3 class="chart-title">◈ ${t('reports.competitive.interactiveScoreAnalysis', 'Interactive Score Analysis')}</h3>
          <p class="chart-subtitle">${t('reports.competitive.compareMetricsCharts', 'Compare performance across all metrics with interactive charts')}</p>
        </div>
        <div class="chart-controls">
          <button class="chart-toggle active" data-chart="radar" id="radarToggle">
            ◉ ${t('reports.competitive.radarView', 'Radar View')}
          </button>
          <button class="chart-toggle" data-chart="bar" id="barToggle">
            ▬ ${t('reports.competitive.barChart', 'Bar Chart')}
          </button>
        </div>
      </div>
      
      <div class="chart-wrapper radar" id="radarWrapper">
        <canvas id="radarChart"></canvas>
      </div>
      
      <div class="chart-wrapper" id="barWrapper" style="display: none;">
        <canvas id="barChart"></canvas>
      </div>
    </div>
  `;
}

// Switch between chart views
function switchChart(view) {
  // Update button states
  document.getElementById('radarToggle').classList.toggle('active', view === 'radar');
  document.getElementById('barToggle').classList.toggle('active', view === 'bar');
  
  // Toggle chart visibility
  document.getElementById('radarWrapper').style.display = view === 'radar' ? 'block' : 'none';
  document.getElementById('barWrapper').style.display = view === 'bar' ? 'block' : 'none';
}

// Initialize Chart.js charts
function initializeCharts(data) {
  // Store data globally for theme changes
  chartData = data;
  
  const sites = [
    { name: getDomainName(data.yourSite.url), scores: data.yourSite.scores, isYourSite: true },
    ...data.competitors.map(comp => ({
      name: getDomainName(comp.url),
      scores: comp.scores,
      isYourSite: false
    }))
  ];
  
  createRadarChart(sites);
  createBarChart(sites);
  
  // Add event listeners to chart toggle buttons
  const radarToggle = document.getElementById('radarToggle');
  const barToggle = document.getElementById('barToggle');
  
  if (radarToggle) {
    radarToggle.addEventListener('click', () => switchChart('radar'));
  }
  
  if (barToggle) {
    barToggle.addEventListener('click', () => switchChart('bar'));
  }
}

// Create Radar Chart
function createRadarChart(sites) {
  const ctx = document.getElementById('radarChart');
  if (!ctx) return;

  // Destroy existing chart
  if (radarChart) {
    radarChart.destroy();
  }

  // Detect theme
  const isLightTheme = document.body.classList.contains('white-theme');
  const textColor = isLightTheme ? '#000000' : 'rgba(255, 255, 255, 0.9)';
  const gridColor = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

  const metrics = ['seo', 'security', 'accessibility', 'coreWebVitals', 'performance'];
  const metricLabels = [
    t('reports.metrics.seo', 'SEO'),
    t('reports.metrics.security', 'Security'),
    t('reports.metrics.accessibility', 'Accessibility'),
    t('reports.metrics.coreWebVitals', 'Core Web Vitals'),
    t('reports.metrics.performance', 'Performance')
  ];
  
  const datasets = sites.map((site, idx) => {
    const color = getChartColor(idx, site.isYourSite);
    const scores = metrics.map(metric => site.scores[metric] || 0);
    
    return {
      label: site.name,
      data: scores,
      backgroundColor: `${color}20`,
      borderColor: color,
      borderWidth: site.isYourSite ? 3 : 2,
      pointBackgroundColor: color,
      pointBorderColor: isLightTheme ? '#fff' : '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: color,
      pointRadius: site.isYourSite ? 6 : 4,
      pointHoverRadius: site.isYourSite ? 8 : 6
    };
  });
  
  // Chart.js loaded via CDN in HTML
  // eslint-disable-next-line no-undef
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: metricLabels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20,
            color: textColor,
            font: { size: 12 },
            backdropColor: 'transparent'
          },
          grid: {
            color: gridColor
          },
          angleLines: {
            color: gridColor
          },
          pointLabels: {
            color: textColor,
            font: { size: 14, weight: 'bold' }
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: textColor,
            font: { size: 14, weight: 'bold' },
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: getAccentPrimaryColor(),
          bodyColor: '#fff',
          borderColor: getAccentPrimaryColor(),
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              const score = context.parsed.r;
              const grade = getScoreGrade(score);
              return `${context.dataset.label}: ${score} (${grade})`;
            }
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart'
      }
    }
  });
}

// Create Bar Chart
function createBarChart(sites) {
  const ctx = document.getElementById('barChart');
  if (!ctx) return;

  // Destroy existing chart
  if (barChart) {
    barChart.destroy();
  }

  // Detect theme
  const isLightTheme = document.body.classList.contains('white-theme');
  const textColor = isLightTheme ? '#000000' : 'rgba(255, 255, 255, 0.9)';
  const gridColor = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

  const metrics = ['seo', 'security', 'accessibility', 'coreWebVitals', 'performance'];
  const metricLabels = [
    t('reports.metrics.seo', 'SEO'),
    t('reports.metrics.security', 'Security'),
    t('reports.metrics.accessibility', 'Accessibility'),
    t('reports.metrics.coreWebVitals', 'Core Web Vitals'),
    t('reports.metrics.performance', 'Performance')
  ];
  
  const datasets = sites.map((site, idx) => {
    const color = getChartColor(idx, site.isYourSite);
    const scores = metrics.map(metric => site.scores[metric] || 0);
    
    return {
      label: site.name,
      data: scores,
      backgroundColor: color,
      borderColor: site.isYourSite ? getAccentPrimaryColor() : color,
      borderWidth: site.isYourSite ? 3 : 1,
      borderRadius: 6,
      barThickness: 'flex'
    };
  });
  
  // Chart.js loaded via CDN in HTML
  // eslint-disable-next-line no-undef
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: metricLabels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20,
            color: textColor,
            font: { size: 12 },
            callback: function(value) {
              return value;
            }
          },
          grid: {
            color: gridColor
          }
        },
        x: {
          ticks: {
            color: textColor,
            font: { size: 13, weight: 'bold' }
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: textColor,
            font: { size: 14, weight: 'bold' },
            padding: 15,
            usePointStyle: true,
            pointStyle: 'rect'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: getAccentPrimaryColor(),
          bodyColor: '#fff',
          borderColor: getAccentPrimaryColor(),
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              const score = context.parsed.y;
              const grade = getScoreGrade(score);
              return `${context.dataset.label}: ${score} (${grade})`;
            },
            afterLabel: function(context) {
              const score = context.parsed.y;
              if (score >= 80) return '✓ ' + t('reports.status.excellent', 'Excellent');
              if (score >= 60) return '~ ' + t('reports.status.good', 'Good');
              return '✗ ' + t('reports.status.needsImprovement', 'Needs Improvement');
            }
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart',
        delay: (context) => {
          return context.dataIndex * 100;
        }
      }
    }
  });
}

// Get chart color for site
function getChartColor(index, isYourSite) {
  if (isYourSite) return getAccentPrimaryColor();
  
  const colors = [
    '#ff6b6b', // Red
    '#ffa500', // Orange
    '#4169e1', // Blue
    '#9370db'  // Purple
  ];
  
  return colors[index % colors.length];
}

// Get score grade
function getScoreGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

// Detailed Metrics Breakdown Content (for accordion)
function renderDetailedMetricsContent(data) {
  const sites = [
    { name: getDomainName(data.yourSite.url), data: data.yourSite, isYou: true },
    ...data.competitors.map(comp => ({
      name: getDomainName(comp.url),
      data: comp,
      isYou: false
    }))
  ];

  const metrics = [
    { key: 'seo', label: t('reports.metrics.seo', 'SEO'), icon: 'S' },
    { key: 'security', label: t('reports.metrics.security', 'Security'), icon: '◈' },
    { key: 'accessibility', label: t('reports.metrics.accessibility', 'Accessibility'), icon: 'A' },
    { key: 'coreWebVitals', label: t('reports.metrics.coreWebVitals', 'Core Web Vitals'), icon: 'V' },
    { key: 'performance', label: t('reports.metrics.performance', 'Performance'), icon: 'P' }
  ];

  return `
    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
      ${t('reports.competitive.completeScoreBreakdown', 'Complete score breakdown with individual metric details for every site')}
    </p>
    
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; background: var(--r-surface-1, #fff); border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: var(--r-surface-2, #f3f4f6); border-bottom: 2px solid var(--r-border, #e5e7eb);">
            <th style="padding: 0.6rem 0.8rem; text-align: left; color: var(--r-text, #111827); font-weight: bold; border-right: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); font-size: 0.9rem;">
              ${t('reports.competitive.site', 'Site')}
            </th>
            ${metrics.map(({ label, icon }) => `
              <th style="padding: 0.6rem 0.8rem; text-align: center; color: var(--text-primary); font-weight: bold; border-right: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); font-size: 0.85rem;">
                ${icon} ${label}
              </th>
            `).join('')}
            <th style="padding: 0.6rem 0.8rem; text-align: center; color: #f59e0b; font-weight: bold; font-size: 0.95rem;">
              ◉ ${t('reports.metrics.overall', 'Overall')}
            </th>
          </tr>
        </thead>
        <tbody>
          ${sites.map((site, siteIdx) => {
            const scores = site.data.scores || {};
            const details = site.data.details || {};
            const isYou = site.isYou;
            
            return `
              <tr style="background: ${isYou ? 'rgba(14, 165, 233, 0.07)' : siteIdx % 2 === 0 ? 'var(--r-surface-2, #f9fafb)' : 'transparent'}; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
                <td style="padding: 0.6rem 0.8rem; font-weight: ${isYou ? 'bold' : 'normal'}; color: ${isYou ? 'var(--accent-primary)' : 'var(--text-primary)'}; border-right: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); font-size: 0.85rem;">
                  ${isYou ? '◉ ' : ''}${site.name}${isYou ? ' (' + t('reports.competitive.you', 'YOU') + ')' : ''}
                  <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.15rem;">
                    ${getDomainName(site.data.url)}
                  </div>
                </td>
                ${metrics.map(({ key }) => {
                  const score = scores[key] || 0;
                  const hasDetails = details[key] !== null && details[key] !== undefined;
                  const failed = score === 0;
                  
                  let scoreColor = '#ef4444';
                  if (score >= 80) scoreColor = getAccentPrimaryColor();
                  else if (score >= 60) scoreColor = '#ffa500';
                  
                  let grade = 'F';
                  if (score >= 90) grade = 'A+';
                  else if (score >= 80) grade = 'A';
                  else if (score >= 70) grade = 'B';
                  else if (score >= 60) grade = 'C';
                  else if (score >= 50) grade = 'D';
                  
                  return `
                    <td style="padding: 0.5rem 0.6rem; text-align: center; border-right: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
                      <div style="font-size: 1.2rem; font-weight: bold; color: ${scoreColor}; margin-bottom: 0.15rem;">
                        ${failed ? '✗' : score}
                      </div>
                      <div style="font-size: 0.7rem; padding: 0.15rem 0.4rem; background: ${scoreColor}20; border: 1px solid ${scoreColor}40; border-radius: 3px; display: inline-block; color: ${scoreColor};">
                        ${failed ? t('reports.status.failed', 'Failed') : grade}
                      </div>
                      ${failed ? `
                        <div style="font-size: 0.65rem; color: #ff8c00; margin-top: 0.3rem;">
                          ~ ${t('reports.competitive.analysisError', 'Analysis error')}
                        </div>
                      ` : hasDetails && key === 'coreWebVitals' && details[key].metrics ? `
                        <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.3rem; line-height: 1.3;">
                          LCP: ${details[key].metrics.lcp ? (details[key].metrics.lcp / 1000).toFixed(2) + 's' : 'N/A'}<br>
                          FID: ${details[key].metrics.fid ? details[key].metrics.fid.toFixed(0) + 'ms' : 'N/A'}<br>
                          CLS: ${details[key].metrics.cls ? details[key].metrics.cls.toFixed(3) : 'N/A'}
                        </div>
                      ` : ''}
                    </td>
                  `;
                }).join('')}
                <td style="padding: 0.6rem 0.8rem; text-align: center; background: ${isYou ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'rgba(245, 158, 11, 0.05)'};">
                  <div style="font-size: 1.5rem; font-weight: bold; color: ${scores.overall >= 80 ? 'var(--accent-primary)' : scores.overall >= 60 ? '#ffa500' : '#ef4444'};">
                    ${scores.overall || 0}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem;">
                    ${site.data.grade || 'F'}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255, 152, 0, 0.1); border-left: 4px solid #ff8c00; border-radius: 4px;">
      <strong style="color: #ff8c00;">ⓘ ${t('reports.common.note', 'Note')}:</strong>
      <span style="color: var(--text-secondary); font-size: 0.9rem;">
        ${t('reports.competitive.analyzerFailureNote', 'Scores marked with X indicate analyzer failures (typically due to Lighthouse timeouts or site restrictions). These metrics are excluded from overall score calculation to ensure accuracy.')}
      </span>
    </div>
  `;
}

// Legacy wrapper for backward compatibility
function renderDetailedMetricsTable(data) {
  return `<section class="section"><h2>📋 ${t('reports.competitive.detailedMetrics', 'Detailed Metrics Breakdown')}</h2>${renderDetailedMetricsContent(data)}</section>`;
}

// Executive Summary - Quick overview
function renderExecutiveSummary(data) {
  // Defensive checks
  if (!data.yourSite?.scores || !data.competitors || data.competitors.length === 0) {
    return '<div class="error">' + t('reports.competitive.missingDataExecutiveSummary', 'Missing data for executive summary') + '</div>';
  }
  
  const totalCompetitors = data.competitors.length;
  const yourOverall = data.yourSite.scores.overall || 0;
  const competitorScores = data.competitors
    .map(c => c.scores?.overall || 0)
    .filter(score => score > 0);
  
  if (competitorScores.length === 0) {
    return '<div class="warning">' + t('reports.competitive.noValidCompetitorScores', 'No valid competitor scores available') + '</div>';
  }
  
  const avgCompetitor = competitorScores.reduce((a, b) => a + b, 0) / competitorScores.length;
  const maxCompetitor = Math.max(...competitorScores);
  
  const overallRank = data.rankings?.overall?.rank || totalCompetitors + 1;
  const isWinning = overallRank === 1;
  const isLosing = overallRank === totalCompetitors + 1;
  
  // Count wins/losses across metrics
  const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
  let winsCount = 0;
  let lossesCount = 0;
  metrics.forEach(metric => {
    const status = data.comparison?.[metric]?.status;
    if (status === 'winning') winsCount++;
    if (status === 'losing') lossesCount++;
  });
  
  const statusColor = isWinning ? getAccentPrimaryColor() : isLosing ? '#ef4444' : '#ff8c00';
  const statusIcon = isWinning ? '↑' : isLosing ? '↓' : '≈';
  const statusText = t('reports.competitive.competitive', 'COMPETITIVE');
  
  return `
    <div style="
      background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.05) 0%, rgba(0,0,0,0.1) 100%);
      border: 2px solid ${statusColor};
      border-radius: 12px;
      padding: 2.5rem;
      margin-bottom: 2rem;
      position: relative;
      overflow: hidden;
    ">
      <!-- Status Badge -->
      <div style="
        position: absolute;
        top: -1px;
        right: -1px;
        background: ${statusColor};
        color: #000;
        padding: 0.5rem 1.5rem;
        border-bottom-left-radius: 12px;
        font-weight: 700;
        font-size: 0.9rem;
        letter-spacing: 1px;
      ">
        ${statusIcon} ${statusText}
      </div>

      <div style="display: grid; grid-template-columns: 180px 1fr 240px; gap: 2.5rem; align-items: center;">
        <!-- Score Circle -->
        <div style="text-align: center;">
          <div class="score-circle-gradient" style="
            width: 180px;
            height: 180px;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 6px solid ${statusColor};
            box-shadow: 0 0 30px ${statusColor}40, inset 0 0 20px rgba(0,0,0,0.3);
            position: relative;
          ">
            <div style="font-size: 4rem; font-weight: 900; color: ${statusColor}; line-height: 1; text-shadow: 0 0 20px ${statusColor}80;">
              ${yourOverall}
            </div>
            <div style="
              font-size: 0.95rem;
              color: var(--text-primary);
              margin-top: 0.5rem;
              font-weight: 600;
              letter-spacing: 1px;
            ">
              ${t('reports.competitive.grade', 'Grade')} ${data.yourSite.grade}
            </div>
          </div>
        </div>
        
        <!-- Stats Grid -->
        <div>
          <div style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
            ${t('reports.competitive.ranked', 'Ranked')} <span style="color: ${statusColor}; font-size: 1.4rem; font-weight: 900;">#${overallRank}</span> ${t('reports.competitive.outOf', 'out of')} ${totalCompetitors + 1} ${t('reports.competitive.competitorsAnalyzed', 'competitors analyzed')}
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 1.5rem;">
            <div style="
              background: rgba(255,255,255,0.03);
              padding: 1rem;
              border-radius: 8px;
              border-left: 3px solid var(--accent-primary);
            ">
              <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                ${t('reports.competitive.winningIn', 'Winning in')}
              </div>
              <div style="font-size: 2rem; font-weight: 900; color: var(--text-primary); line-height: 1;">
                ${winsCount}/${metrics.length}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                ${t('reports.competitive.categories', 'categories')}
              </div>
            </div>

            <div style="
              background: rgba(255,255,255,0.03);
              padding: 1rem;
              border-radius: 8px;
              border-left: 3px solid #ff8c00;
            ">
              <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                ${t('reports.competitive.avgCompetitor', 'Avg competitor')}
              </div>
              <div style="font-size: 2rem; font-weight: 900; color: var(--text-primary); line-height: 1;">
                ${Math.round(avgCompetitor)}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                ${t('reports.competitive.score', 'score')}
              </div>
            </div>

            <div style="
              background: rgba(255,255,255,0.03);
              padding: 1rem;
              border-radius: 8px;
              border-left: 3px solid ${maxCompetitor > yourOverall ? '#ef4444' : 'var(--accent-primary)'};
            ">
              <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                ${t('reports.competitive.gapToLeader', 'Gap to leader')}
              </div>
              <div style="font-size: 2rem; font-weight: 900; color: ${maxCompetitor > yourOverall ? '#ef4444' : 'var(--accent-primary)'}; line-height: 1;">
                ${maxCompetitor > yourOverall ? `${maxCompetitor - yourOverall}` : `+${yourOverall - maxCompetitor}`}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                ${t('reports.competitive.points', 'points')}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Priority Focus -->
        <div style="
          background: linear-gradient(135deg, ${statusColor}20 0%, ${statusColor}05 100%);
          border: 2px solid ${statusColor}60;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
        ">
          <div style="
            font-size: 0.85rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 0.75rem;
            font-weight: 600;
          ">
            ${t('reports.competitive.priorityFocus', 'Priority Focus')}
          </div>
          <div style="
            font-size: 1.5rem;
            font-weight: 900;
            color: var(--text-primary);
            line-height: 1.2;
            margin-bottom: 1rem;
          ">
            ${lossesCount > 0 ?
              (lossesCount === 1
                ? t('reports.competitive.fixWeakness', 'Fix {{count}} weakness', { count: lossesCount })
                : t('reports.competitive.fixWeaknesses', 'Fix {{count}} weaknesses', { count: lossesCount })) :
              t('reports.competitive.maintainLead', 'Maintain Lead')}
          </div>
          <div style="
            font-size: 0.8rem; 
            color: var(--text-secondary);
            padding: 0.5rem 1rem;
            background: var(--r-surface-2, #F8FAFC);
            border-radius: 6px;
            display: inline-block;
          ">
            ${data.analysisTime}s ${t('reports.competitive.analysis', 'analysis')}
          </div>
        </div>
      </div>
    </div>
    
    ${data.warning ? `
      <div style="background: rgba(255, 140, 0, 0.15); border-left: 4px solid #ff8c00; padding: 1rem; margin-bottom: 2rem; border-radius: 4px;">
        <p style="margin: 0; color: #ff8c00;">
          <strong>ⓘ ${t('reports.common.note', 'Note')}:</strong> ${data.warning}
        </p>
      </div>
    ` : ''}
  `;
}

// Render rankings grid
function renderRankings(rankings) {
  const metrics = [
    { key: 'overall', label: t('reports.metrics.overall', 'Overall'), data: rankings.overall },
    { key: 'seo', label: t('reports.metrics.seo', 'SEO'), data: rankings.seo },
    { key: 'performance', label: t('reports.metrics.performance', 'Performance'), data: rankings.performance },
    { key: 'coreWebVitals', label: t('reports.metrics.coreWebVitals', 'Core Web Vitals'), data: rankings.coreWebVitals },
    { key: 'accessibility', label: t('reports.metrics.accessibility', 'Accessibility'), data: rankings.accessibility },
    { key: 'security', label: t('reports.metrics.security', 'Security'), data: rankings.security }
  ];

  return `
    <section class="section">
      <h2>R ${t('reports.competitive.yourRankings', 'Your Rankings')}</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: var(--r-surface-1, #fff); border-radius: 8px; overflow: hidden; font-size: 0.9rem;">
          <thead>
            <tr style="background: var(--r-surface-2, #f3f4f6);">
              <th style="padding: 0.75rem 1rem; text-align: left; border-bottom: 2px solid var(--r-border, #e5e7eb); color: var(--r-text, #111827); font-weight: 600;">${t('reports.competitive.metric', 'Metric')}</th>
              <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid var(--r-border, #e5e7eb); color: var(--r-text, #111827); font-weight: 600; width: 60px;">${t('reports.competitive.medal', 'Medal')}</th>
              <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid var(--r-border, #e5e7eb); color: var(--r-text, #111827); font-weight: 600; width: 80px;">${t('reports.competitive.rank', 'Rank')}</th>
              <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid var(--r-border, #e5e7eb); color: var(--r-text, #111827); font-weight: 600; width: 100px;">${t('reports.competitive.status', 'Status')}</th>
              <th style="padding: 0.75rem 1rem; text-align: left; border-bottom: 2px solid var(--r-border, #e5e7eb); color: var(--r-text, #111827); font-weight: 600;">${t('reports.competitive.recommendedAction', 'Recommended Action')}</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.map(({ key, label, data }) => {
              // Check if metric failed
              const failed = data.failed || data.rank === 0 || data.total === 0;
              const isFirst = data.rank === 1 && !failed;
              const isSecond = data.rank === 2 && !failed;
              const isThird = data.rank === 3 && !failed;
              const isLast = data.rank === data.total && data.total > 0 && !failed;
              
              let statusColor = '#ef4444';
              let statusText = '~ Behind';
              let medal = data.medal || '◉';
              let rankDisplay = data.rank ? `${data.rank}/${data.total}` : '—';
              let recommendation = '';
              
              if (failed) {
                statusColor = '#ef4444';
                statusText = data.total === 0 ? '✗ ' + t('reports.competitive.allFailed', 'All Failed') : '✗ ' + t('reports.status.failed', 'Failed');
                medal = '✗';
                rankDisplay = '—';
                recommendation = t('reports.competitive.fixAnalysisErrors', 'Fix analysis errors - check site accessibility');
              } else if (isFirst) {
                statusColor = getAccentPrimaryColor();
                statusText = '↑ ' + t('reports.competitive.leading', 'Leading!');
                recommendation = t('reports.competitive.maintainPosition', 'Maintain position - monitor competitors');
              } else if (isSecond) {
                statusColor = '#f59e0b';
                statusText = '🥈 ' + t('reports.competitive.strong', 'Strong');
                recommendation = t('reports.competitive.pushToFirst', 'Push to #1 - minor optimizations needed');
              } else if (isThird) {
                statusColor = '#ff8c00';
                statusText = '≈ ' + t('reports.competitive.competitiveStatus', 'Competitive');
                recommendation = t('reports.competitive.improveGapClosing', 'Improve {{metric}} - gap closing opportunity', { metric: label.toLowerCase() });
              } else if (isLast) {
                statusColor = '#ef4444';
                statusText = '↓ ' + t('reports.competitive.behind', 'Behind');
                recommendation = t('reports.competitive.priorityOverhaul', 'Priority: {{metric}} overhaul required', { metric: label.toLowerCase() });
              } else {
                statusColor = '#ff8c00';
                statusText = '◉ ' + t('reports.competitive.midPack', 'Mid-pack');
                recommendation = t('reports.competitive.targetImprovements', 'Target {{metric}} improvements for rank gain', { metric: label.toLowerCase() });
              }
              
              // Specific recommendations by metric
              if (!failed) {
                switch(key) {
                  case 'overall':
                    recommendation = isFirst ? t('reports.competitive.rec.overallFirst', 'Maintain all-around excellence') :
                                   isLast ? t('reports.competitive.rec.overallLast', 'Multi-metric improvement needed - start with weakest area') :
                                   t('reports.competitive.rec.overallMid', 'Focus on lowest-scoring individual metrics');
                    break;
                  case 'seo':
                    recommendation = isFirst ? t('reports.competitive.rec.seoFirst', 'Monitor keyword rankings & maintain') :
                                   t('reports.competitive.rec.seoImprove', 'Optimize meta tags, content, internal linking');
                    break;
                  case 'performance':
                    recommendation = isFirst ? t('reports.competitive.rec.performanceFirst', 'Keep load times optimized') :
                                   t('reports.competitive.rec.performanceImprove', 'Reduce page size, optimize images, enable caching');
                    break;
                  case 'coreWebVitals':
                    recommendation = isFirst ? t('reports.competitive.rec.cwvFirst', 'Maintain LCP/FCP/CLS scores') :
                                   t('reports.competitive.rec.cwvImprove', 'Improve LCP (<2.5s), FCP (<1.8s), CLS (<0.1)');
                    break;
                  case 'accessibility':
                    recommendation = isFirst ? t('reports.competitive.rec.a11yFirst', 'Keep accessibility standards high') :
                                   t('reports.competitive.rec.a11yImprove', 'Add alt text, improve contrast, fix ARIA labels');
                    break;
                  case 'security':
                    recommendation = isFirst ? t('reports.competitive.rec.securityFirst', 'Maintain security best practices') :
                                   t('reports.competitive.rec.securityImprove', 'Enable HTTPS, add security headers, update protocols');
                    break;
                }
              }
              
              return `
                <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); transition: background 0.2s;" class="comp-hover-row">
                  <td style="padding: 0.75rem 1rem; color: var(--text-primary); font-weight: 500;">${label}</td>
                  <td style="padding: 0.75rem; text-align: center; font-size: 1.5rem;">${medal}</td>
                  <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; font-weight: bold; color: ${failed ? '#666' : statusColor};">${rankDisplay}</td>
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="
                      display: inline-block;
                      padding: 0.3rem 0.6rem;
                      background: ${statusColor}22;
                      color: ${statusColor};
                      border-radius: 4px;
                      font-size: 0.85rem;
                      font-weight: 500;
                      border: 1px solid ${statusColor}44;
                      white-space: nowrap;
                    ">${statusText}</span>
                  </td>
                  <td style="padding: 0.75rem 1rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4;">
                    ${recommendation}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

// Translate insight message from server (server sends English, we translate client-side)
function translateInsightMessage(insight) {
  const cat = (insight.category || '').toLowerCase();
  const type = (insight.type || '').toLowerCase();
  // Map server-generated messages to i18n keys
  if (cat === 'overall' && type === 'success') {
    return t('reports.competitive.insights.outperforming', 'You are outperforming the competition!');
  }
  if (cat === 'overall' && (type === 'warning' || type === 'critical')) {
    return t('reports.competitive.insights.competitorsAhead', 'Competitors are ahead');
  }
  if (cat === 'seo') {
    return t('reports.competitive.insights.losingSeo', 'Losing SEO battle');
  }
  if (cat === 'core web vitals') {
    return t('reports.competitive.insights.cwvAtRisk', 'Google rankings at risk');
  }
  if (cat === 'performance') {
    return t('reports.competitive.insights.slowerThan', 'Slower than competitors');
  }
  if (cat === 'security') {
    return t('reports.competitive.insights.securityGap', 'Security gap detected');
  }
  // Fallback to server message if no matching key
  return insight.message || '';
}

// Translate insight detail from server
function translateInsightDetail(insight) {
  const cat = (insight.category || '').toLowerCase();
  const type = (insight.type || '').toLowerCase();
  // Extract scores from detail if present (server embeds them in English text)
  const yourScore = insight.yourScore;
  const avgScore = insight.avgScore;
  if (cat === 'overall' && type === 'success') {
    return t('reports.competitive.insights.outperformingDetail', 'Your overall score is above the competitive average');
  }
  if (cat === 'overall' && (type === 'warning' || type === 'critical')) {
    return t('reports.competitive.insights.competitorsAheadDetail', 'Focus on areas where you are falling behind to gain competitive advantage');
  }
  if (cat === 'seo') {
    return t('reports.competitive.insights.losingSeoDetail', 'Your SEO score is below competitor average. This hurts organic visibility.');
  }
  if (cat === 'core web vitals') {
    return t('reports.competitive.insights.cwvAtRiskDetail', 'Competitors have better Core Web Vitals. Google may rank them higher.');
  }
  if (cat === 'performance') {
    return t('reports.competitive.insights.slowerThanDetail', 'Users may choose faster competitor sites.');
  }
  if (cat === 'security') {
    return t('reports.competitive.insights.securityGapDetail', 'Competitors have stronger security measures. This affects user trust.');
  }
  return insight.detail || '';
}

// Render insights content (for accordion)
function renderInsightsContent(insights) {
  if (!insights || insights.length === 0) return '<p style="color: var(--text-secondary);">' + t('reports.competitive.noInsightsAvailable', 'No insights available.') + '</p>';

  return `
    ${insights.map(insight => `
      <div class="insight-card insight-${insight.type}" style="margin-bottom: 0.75rem;">
        <h3 style="margin: 0 0 0.5rem 0;">${translateInsightMessage(insight)}</h3>
        <p style="margin: 0; color: var(--text-secondary);">${translateInsightDetail(insight)}</p>
      </div>
    `).join('')}
  `;
}

// Legacy wrapper
function renderInsights(insights) {
  if (!insights || insights.length === 0) return '';

  return `
    <section class="section">
      <h2>ⓘ ${t('reports.competitive.keyInsights', 'Key Insights')}</h2>
      ${renderInsightsContent(insights)}
    </section>
  `;
}

// Render comparison table with visual enhancements
function renderComparisonTable(data) {
  const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
  
  // Legacy - now handled by accordions
  return '';
}

// Get metric status from rankings data (ALWAYS use this to check if metric failed)
function getMetricStatus(data, metric) {
  const rankingData = data.rankings?.[metric] || {};
  const failed = rankingData.failed || rankingData.rank === 0 || rankingData.total === 0;
  
  return {
    failed: failed,
    rank: rankingData.rank || 0,
    total: rankingData.total || 0,
    displayRank: failed
      ? (rankingData.total === 0 ? '✗ ' + t('reports.competitive.allSitesFailed', 'All Sites Failed') : '✗ ' + t('reports.status.failed', 'Failed'))
      : `${rankingData.rank || 0}/${rankingData.total || 0}`,
    statusText: failed
      ? '✗ ' + t('reports.competitive.analysisFailed', 'Analysis failed')
      : (rankingData.rank === 1 ? '↑ ' + t('reports.competitive.leading', 'Leading!') : rankingData.rank === 2 ? '≈ ' + t('reports.competitive.strong', 'Strong') : '◉ ' + t('reports.competitive.competitiveStatus', 'Competitive')),
    statusColor: failed ? '#ef4444' : (rankingData.rank === 1 ? getAccentPrimaryColor() : rankingData.rank === 2 ? '#f59e0b' : '#ff8c00')
  };
}

// Visual bar chart comparison content (for accordion)
function renderVisualComparisonContent(data) {
  const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];

  return `
    <p style="color: var(--text-secondary); margin-bottom: 2rem;">
      ${t('reports.competitive.seeWhereYouStand', 'See exactly where you stand against each competitor in every category')}
    </p>
    
    ${metrics.map(metric => {
      // Get metric status from backend rankings
      const metricStatus = getMetricStatus(data, metric);
      
      const allScores = [
        { name: 'You', score: data.yourSite.scores[metric], url: data.yourSite.url, isYou: true },
        ...data.competitors.map(c => ({ 
          name: getDomainName(c.url), 
          score: c.scores[metric], 
          url: c.url, 
          isYou: false 
        }))
      ].sort((a, b) => b.score - a.score);
      
      const maxScore = Math.max(...allScores.map(s => s.score));
      const yourScore = data.yourSite.scores[metric];
      const bestCompetitor = data.competitors.reduce((best, c) => 
        c.scores[metric] > (best?.scores[metric] || 0) ? c : best, null);
      const gap = bestCompetitor ? bestCompetitor.scores[metric] - yourScore : 0;
      
      return `
        <div style="margin-bottom: 2.5rem; padding: 1.5rem; background: var(--r-surface-2, #f3f4f6); border-radius: 8px; border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0; font-size: 1.1rem; color: var(--r-text, #111827);">
              ${formatMetricName(metric)}
              ${metricStatus.failed ? `<span style="color: ${metricStatus.statusColor}; font-size: 0.9rem; margin-left: 0.5rem;">(${metricStatus.statusText})</span>` :
                gap > 0 ? `<span style="color: #dc2626; font-size: 0.9rem; margin-left: 0.5rem;">(-${gap} ${t('reports.competitive.behindLeader', 'behind leader')})</span>` :
                 gap < 0 ? `<span style="color: #16a34a; font-size: 0.9rem; margin-left: 0.5rem;">(+${Math.abs(gap)} ${t('reports.competitive.ahead', 'ahead!')})</span>` :
                 `<span style="color: #ca8a04; font-size: 0.9rem; margin-left: 0.5rem;">(${metricStatus.statusText})</span>`}
            </h3>
            <div style="font-size: 0.85rem; color: ${metricStatus.statusColor};">
              ${t('reports.competitive.yourRank', 'Your rank')}: ${metricStatus.displayRank}
            </div>
          </div>

          ${allScores.map((site, idx) => {
            const percentage = maxScore > 0 ? (site.score / maxScore) * 100 : 0;
            const isWinner = idx === 0;
            const competitorColors = ['#6366f1', '#8b5cf6', '#a78bfa', '#94a3b8', '#64748b'];
            const competitorIdx = site.isYou || isWinner ? 0 : Math.min(idx - 1, competitorColors.length - 1);
            const barColor = site.isYou ? '#0ea5e9' : (isWinner ? '#10b981' : competitorColors[competitorIdx]);
            const barGradient = site.isYou
              ? 'linear-gradient(90deg, #0ea5e9, #06b6d4)'
              : (isWinner ? 'linear-gradient(90deg, #10b981, #34d399)' : barColor);

            return `
              <div style="margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                  <span style="font-size: 0.9rem; color: var(--r-text, #111827); ${site.isYou ? 'font-weight: bold;' : ''}">
                    ${isWinner ? '👑 ' : ''}${site.name}${site.isYou ? ' (' + t('reports.competitive.you', 'YOU') + ')' : ''}
                  </span>
                  <span style="font-weight: bold; font-size: 1rem; color: ${barColor};">
                    ${site.score}
                  </span>
                </div>
                <div style="background: var(--r-dial-track, #e5e7eb); height: 24px; border-radius: 6px; overflow: hidden; position: relative;">
                  <div style="
                    background: ${barGradient};
                    height: 100%;
                    width: ${percentage}%;
                    min-width: ${site.score > 0 ? '2rem' : '0'};
                    transition: width 1s ease-out;
                    display: flex;
                    align-items: center;
                    padding: 0 0.5rem;
                    font-size: 0.75rem;
                    font-weight: bold;
                    color: #fff;
                    border-radius: 6px;
                  ">
                    ${percentage.toFixed(0)}%
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }).join('')}
  `;
}

// Legacy wrapper
function renderVisualComparison(data, metrics) {
  return `<section class="section"><h2>◉ ${t('reports.competitive.visualComparison', 'Visual Score Comparison')}</h2>${renderVisualComparisonContent(data)}</section>`;
}

// Competitive position content (for accordion)
function renderCompetitivePositionContent(data) {
  return `
    <div class="stats-grid">
      ${Object.entries(data.comparison).map(([metric, stats]) => `
        <div class="stat-card" style="border: 2px solid ${stats.status === 'winning' ? 'var(--accent-primary)' : stats.status === 'losing' ? '#ef4444' : '#f59e0b'};">
          <div style="text-align: center; margin-bottom: 0.5rem;">
            ${stats.status === 'winning' ? '✓' : stats.status === 'losing' ? '✗' : '≈'}
          </div>
          <div class="stat-value status-${stats.status}">
            ${stats.diff > 0 ? '+' : ''}${stats.diff}
          </div>
          <div class="stat-label">${formatMetricName(metric)}</div>
          <div class="stat-sublabel" style="font-weight: bold; color: ${stats.status === 'winning' ? 'var(--accent-primary)' : stats.status === 'losing' ? '#ef4444' : '#f59e0b'};">
            ${stats.status === 'winning' ? t('reports.competitive.winning', 'WINNING') : stats.status === 'tied' ? t('reports.competitive.tied', 'TIED') : t('reports.competitive.losing', 'LOSING')}
          </div>
          <div style="font-size: 0.8rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <div>${t('reports.competitive.you', 'YOU')}: <strong>${stats.yourScore}</strong></div>
            <div>${t('reports.competitive.avg', 'Avg')}: ${stats.avgCompetitor}</div>
            <div>${t('reports.competitive.best', 'Best')}: ${stats.maxCompetitor}</div>
            <div style="margin-top: 0.25rem; color: var(--text-secondary);">
              ${stats.percentile}${t('reports.competitive.thPercentile', 'th percentile')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Legacy wrapper
function renderCompetitivePosition(data) {
  return `<section class="section"><h2>◈ ${t('reports.competitive.competitivePosition', 'Competitive Position Summary')}</h2>${renderCompetitivePositionContent(data)}</section>`;
}

// Head-to-head content (for accordion) - Enhanced with sub-accordions per metric
function renderHeadToHeadContent(data) {
  ensureCompetitiveFixStyles();
  const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
  const allSites = [
    { name: 'You', ...data.yourSite, isYou: true },
    ...data.competitors.map(c => ({ name: getDomainName(c.url), ...c, isYou: false }))
  ];

  // Build metric analysis for sub-accordions
  const metricAnalysis = metrics.map(metric => {
    const yourScore = data.yourSite.scores[metric];
    const competitorScores = data.competitors.map(c => ({ name: getDomainName(c.url), score: c.scores[metric], url: c.url }));
    const maxScore = Math.max(yourScore, ...competitorScores.map(c => c.score));
    const avgCompetitor = competitorScores.reduce((a, c) => a + c.score, 0) / competitorScores.length;
    const leader = yourScore >= maxScore ? 'You' : competitorScores.find(c => c.score === maxScore)?.name || 'Competitor';
    const isWinning = yourScore >= maxScore;
    const gap = maxScore - yourScore;

    return {
      metric,
      yourScore,
      competitorScores,
      maxScore,
      avgCompetitor,
      leader,
      isWinning,
      gap
    };
  });

  return `
    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
      ${t('reports.competitive.clickEachMetric', 'Click each metric below to see detailed competitive analysis and actionable insights.')}
    </p>

    <!-- Summary Table -->
    <div style="overflow-x: auto; margin-bottom: 2rem;">
      <table class="comparison-table">
        <thead>
          <tr>
            <th style="position: sticky; left: 0; background: rgba(20, 20, 20, 0.95); z-index: 10;">${t('reports.competitive.website', 'Website')}</th>
            ${metrics.map(m => `<th>${formatMetricName(m)}</th>`).join('')}
            <th>${t('reports.metrics.overall', 'Overall')}</th>
            <th>${t('reports.competitive.grade', 'Grade')}</th>
          </tr>
        </thead>
        <tbody>
          ${allSites.map(site => {
            const isYou = site.isYou;
            return `
              <tr class="${isYou ? 'your-site' : ''}" style="${isYou ? 'background: rgba(var(--accent-primary-rgb), 0.1);' : ''}">
                <td style="position: sticky; left: 0; background: ${isYou ? 'rgba(var(--accent-primary-rgb), 0.15)' : 'rgba(20, 20, 20, 0.95)'}; z-index: 9;">
                  <strong>${isYou ? '👤 ' + t('reports.competitive.you', 'YOU') : site.name}</strong>
                  <br><small style="font-size: 0.75rem; opacity: 0.7;">${site.url}</small>
                </td>
                ${metrics.map(m => {
                  const score = site.scores[m];
                  const maxScore = Math.max(...allSites.map(s => s.scores[m]));
                  const isMax = score === maxScore && score > 0;
                  return `
                    <td style="text-align: center;">
                      <span style="
                        font-weight: ${isMax ? 'bold' : 'normal'};
                        color: ${isMax ? '#f59e0b' : 'inherit'};
                        ${isMax ? 'text-shadow: 0 0 10px #f59e0b;' : ''}
                      ">
                        ${isMax ? '👑 ' : ''}${score}
                      </span>
                    </td>
                  `;
                }).join('')}
                <td style="text-align: center;">
                  <strong style="font-size: 1.1rem;">${site.scores.overall}</strong>
                </td>
                <td style="text-align: center;">
                  <strong style="color: ${getGradeColor(site.grade)}; font-size: 1.2rem;">
                    ${site.grade}
                  </strong>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Detailed Metric Sub-Accordions -->
    <h4 style="color: var(--text-primary); margin: 0 0 1rem 0; font-size: 1rem;">📊 ${t('reports.competitive.detailedMetricAnalysis', 'Detailed Metric Analysis')}</h4>
    <div class="competitive-fixes-list">
      ${metricAnalysis.map((analysis, index) => renderMetricAccordion(analysis, index, data)).join('')}
    </div>
  `;
}

// Render individual metric accordion for head-to-head
function renderMetricAccordion(analysis, index, data) {
  const accordionId = `h2h-metric-${index}`;
  const isWinning = analysis.isWinning;
  const style = isWinning
    ? { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', color: '#10b981', icon: '👑' }
    : { bg: 'rgba(255, 165, 0, 0.08)', border: '#ffa500', color: '#ffa500', icon: '📈' };

  const statusText = isWinning
    ? t('reports.competitive.youreLeading', "You're leading!")
    : t('reports.competitive.pointsBehind', '{{gap}} points behind {{leader}}', { gap: analysis.gap, leader: analysis.leader });

  return `
    <div class="competitive-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="competitive-fix-header" data-action="toggle-accordion" data-accordion-id="${accordionId}" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">${formatMetricName(analysis.metric)}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">
              ${t('reports.competitive.yourScore', 'Your score')}: <strong>${analysis.yourScore}</strong> | ${statusText}
            </p>
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
          ">${isWinning ? t('reports.competitive.winning', 'WINNING') : t('reports.competitive.opportunity', 'OPPORTUNITY')}</span>
          <span class="competitive-fix-expand-icon" style="color: var(--text-secondary); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="competitive-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderMetricTabs(analysis, accordionId, data)}
        </div>
      </div>
    </div>
  `;
}

// Render tabs for metric accordion
function renderMetricTabs(analysis, accordionId, data) {
  const metricName = formatMetricName(analysis.metric);
  const actionSteps = getCompetitiveActionSteps({ metric: analysis.metric });

  return `
    <div class="competitive-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); padding-bottom: 0.75rem;">
      <button class="competitive-fix-tab active" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: var(--r-text, #111827);
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 ${t('reports.common.overview', 'Overview')}</button>
      <button class="competitive-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="analysis" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">📊 ${t('reports.competitive.comparison', 'Comparison')}</button>
      <button class="competitive-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">🎯 ${t('reports.competitive.actionSteps', 'Action Steps')}</button>
    </div>

    <!-- Overview Tab -->
    <div class="competitive-fix-tab-content active" id="${accordionId}-summary">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
        <div style="background: var(--r-surface-2, #F8FAFC); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('reports.competitive.yourScore', 'Your score')}</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: ${analysis.isWinning ? '#10b981' : '#ffa500'};">${analysis.yourScore}</div>
        </div>
        <div style="background: var(--r-surface-2, #F8FAFC); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('reports.competitive.bestCompetitor', 'Best Competitor')}</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: var(--text-primary);">${analysis.maxScore}</div>
        </div>
        <div style="background: var(--r-surface-2, #F8FAFC); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('reports.competitive.avgCompetitor', 'Avg competitor')}</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: var(--text-secondary);">${Math.round(analysis.avgCompetitor)}</div>
        </div>
      </div>
      <div style="background: ${analysis.isWinning ? 'rgba(16,185,129,0.1)' : 'rgba(255,165,0,0.1)'}; border-left: 3px solid ${analysis.isWinning ? '#10b981' : '#ffa500'}; padding: 0.75rem; border-radius: 4px;">
        <div style="color: ${analysis.isWinning ? '#10b981' : '#ffa500'}; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">
          ${analysis.isWinning ? '✓ ' + t('reports.competitive.competitiveAdvantage', 'Competitive Advantage') : '⚠ ' + t('reports.competitive.improvementOpportunity', 'Improvement Opportunity')}
        </div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">
          ${analysis.isWinning
            ? t('reports.competitive.outperformingCompetitors', "You're outperforming all competitors in {{metric}}. Focus on maintaining this advantage while they try to catch up.", { metric: metricName })
            : t('reports.competitive.closingGapHelp', 'Closing this {{gap}}-point gap could significantly improve your competitive position. {{leader}} is setting the benchmark here.', { gap: analysis.gap, leader: analysis.leader })
          }
        </div>
      </div>
    </div>

    <!-- Comparison Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-analysis" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">${metricName} ${t('reports.competitive.leaderboard', 'Leaderboard')}</h5>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${[{ name: 'You', score: analysis.yourScore, isYou: true }, ...analysis.competitorScores.map(c => ({ ...c, isYou: false }))]
          .sort((a, b) => b.score - a.score)
          .map((site, rank) => `
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0.75rem 1rem;
              background: ${site.isYou ? 'rgba(var(--accent-primary-rgb), 0.15)' : 'rgba(0,0,0,0.2)'};
              border-radius: 6px;
              border-left: 3px solid ${rank === 0 ? '#10b981' : site.isYou ? '#0ea5e9' : 'transparent'};
            ">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="
                  width: 24px;
                  height: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 50%;
                  background: ${rank === 0 ? '#10b981' : 'rgba(255,255,255,0.1)'};
                  color: ${rank === 0 ? '#fff' : 'var(--text-secondary)'};
                  font-size: 0.75rem;
                  font-weight: bold;
                ">${rank + 1}</span>
                <span style="font-weight: ${site.isYou ? 'bold' : 'normal'}; color: ${site.isYou ? '#0ea5e9' : 'var(--text-primary)'};">
                  ${site.isYou ? '👤 ' + t('reports.competitive.you', 'YOU') : site.name}
                </span>
              </div>
              <span style="font-weight: bold; font-size: 1.1rem; color: ${rank === 0 ? '#10b981' : 'var(--text-primary)'};">
                ${site.score}
              </span>
            </div>
          `).join('')}
      </div>
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(91, 244, 231, 0.1); border-radius: 8px; border: 1px solid rgba(91, 244, 231, 0.2);">
        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
          <strong style="color: var(--accent-primary);">${t('reports.competitive.whatThisMeans', 'What this means')}:</strong> ${getMetricCompetitiveInsight(analysis)}
        </p>
      </div>
    </div>

    <!-- Action Steps Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">
        ${analysis.isWinning ? '🛡️ ' + t('reports.competitive.maintainYourLead', 'Maintain Your Lead') : '🎯 ' + t('reports.competitive.closeTheGap', 'Close the Gap')}
      </h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
        ${(analysis.isWinning ? getDefensiveSteps(analysis.metric) : actionSteps).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(91, 244, 231, 0.1); border-radius: 8px; border: 1px solid rgba(91, 244, 231, 0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--accent-primary); font-weight: 600; margin-bottom: 0.5rem;">
          <span>💡</span> ${t('reports.competitive.proTip', 'Pro Tip')}
        </div>
        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
          ${getProTip({ metric: analysis.metric })}
        </p>
      </div>
    </div>
  `;
}

// Get competitive insight for a metric
function getMetricCompetitiveInsight(analysis) {
  const metric = analysis.metric.toLowerCase();
  const isWinning = analysis.isWinning;
  const gap = analysis.gap;

  if (isWinning) {
    return t('reports.competitive.insight.winning', "You're the {{metric}} leader in your competitive set. This is a significant advantage - competitors would need to make substantial improvements to match you.", { metric: formatMetricName(metric) });
  }

  const insights = {
    performance: t('reports.competitive.insight.performance', 'A {{gap}}-point performance gap means users experience noticeably faster load times on competitor sites. This directly impacts user engagement, bounce rates, and can affect search rankings.', { gap }),
    seo: t('reports.competitive.insight.seo', 'Being {{gap}} points behind in SEO means competitors likely have better search visibility. They may be capturing organic traffic that you are missing.', { gap }),
    accessibility: t('reports.competitive.insight.accessibility', 'This {{gap}}-point accessibility gap could mean competitors are reaching audiences that you are not. This also poses compliance risks.', { gap }),
    security: t('reports.competitive.insight.security', 'Competitors with {{gap}} more security points likely have stronger trust signals. This is especially important for e-commerce or sites handling sensitive information.', { gap }),
    corewebvitals: t('reports.competitive.insight.coreWebVitals', 'Core Web Vitals directly affect Google rankings. This {{gap}}-point gap means competitors may rank higher in search results and provide a better user experience.', { gap })
  };

  return insights[metric] || t('reports.competitive.insight.generic', 'This {{gap}}-point gap represents a competitive disadvantage that should be addressed to stay competitive in your market.', { gap });
}

// Get defensive steps for maintaining lead
function getDefensiveSteps(metric) {
  const stepsMap = {
    performance: [
      t('reports.competitive.defense.perf1', 'Set up continuous performance monitoring to catch regressions early'),
      t('reports.competitive.defense.perf2', "Document your performance optimizations so they're not accidentally removed"),
      t('reports.competitive.defense.perf3', 'Monitor competitor performance to stay ahead of their improvements'),
      t('reports.competitive.defense.perf4', 'Invest in performance budgets to prevent feature creep from slowing you down'),
      t('reports.competitive.defense.perf5', 'Consider progressive enhancement to maintain speed as you add features')
    ],
    seo: [
      t('reports.competitive.defense.seo1', 'Continue producing high-quality, relevant content regularly'),
      t('reports.competitive.defense.seo2', 'Monitor your keyword rankings and react to changes quickly'),
      t('reports.competitive.defense.seo3', 'Keep your technical SEO updated as best practices evolve'),
      t('reports.competitive.defense.seo4', 'Build and maintain a healthy backlink profile'),
      t('reports.competitive.defense.seo5', 'Watch for algorithm updates and adapt your strategy accordingly')
    ],
    accessibility: [
      t('reports.competitive.defense.a11y1', 'Include accessibility testing in your development workflow'),
      t('reports.competitive.defense.a11y2', 'Train your team on accessibility best practices'),
      t('reports.competitive.defense.a11y3', 'Conduct regular audits to catch any regressions'),
      t('reports.competitive.defense.a11y4', 'Stay updated on WCAG guidelines as they evolve'),
      t('reports.competitive.defense.a11y5', 'Gather feedback from users with disabilities to improve further')
    ],
    security: [
      t('reports.competitive.defense.sec1', 'Keep all dependencies and software up to date'),
      t('reports.competitive.defense.sec2', 'Conduct regular security audits and penetration testing'),
      t('reports.competitive.defense.sec3', 'Monitor for new vulnerabilities affecting your stack'),
      t('reports.competitive.defense.sec4', 'Implement security logging and monitoring'),
      t('reports.competitive.defense.sec5', 'Have an incident response plan ready')
    ],
    corewebvitals: [
      t('reports.competitive.defense.cwv1', 'Set up real user monitoring (RUM) to track actual performance'),
      t('reports.competitive.defense.cwv2', 'Monitor Core Web Vitals in Google Search Console regularly'),
      t('reports.competitive.defense.cwv3', 'Test changes in staging to prevent CWV regressions'),
      t('reports.competitive.defense.cwv4', 'Keep an eye on third-party scripts that could impact CWV'),
      t('reports.competitive.defense.cwv5', 'Stay informed about CWV threshold changes from Google')
    ]
  };

  return stepsMap[metric.toLowerCase()] || [
    t('reports.competitive.defense.gen1', 'Continue monitoring your metrics regularly'),
    t('reports.competitive.defense.gen2', 'Stay informed about industry best practices'),
    t('reports.competitive.defense.gen3', 'React quickly if competitors start catching up'),
    t('reports.competitive.defense.gen4', 'Invest in continuous improvement'),
    t('reports.competitive.defense.gen5', "Document what's working so it can be maintained")
  ];
}

// Legacy wrapper
function renderHeadToHead(data, metrics) {
  return `<section class="section"><h2>⚔️ ${t('reports.competitive.headToHead', 'Head-to-Head Battle')}</h2>${renderHeadToHeadContent(data)}</section>`;
}

// Strengths and weaknesses content (for accordion) - Enhanced with sub-accordions
function renderStrengthsWeaknessesContent(data) {
  ensureCompetitiveFixStyles();
  const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
  const yourScores = data.yourSite.scores;

  // Calculate what you're winning and losing at
  const strengths = [];
  const weaknesses = [];

  metrics.forEach(metric => {
    const yourScore = yourScores[metric];
    const competitorScores = data.competitors.map(c => ({ name: getDomainName(c.url), score: c.scores[metric], url: c.url }));
    const maxCompetitor = Math.max(...competitorScores.map(c => c.score));
    const avgCompetitor = competitorScores.reduce((a, c) => a + c.score, 0) / competitorScores.length;

    if (yourScore >= maxCompetitor) {
      strengths.push({
        metric,
        score: yourScore,
        lead: yourScore - avgCompetitor,
        maxCompetitor,
        avgCompetitor,
        competitorScores,
        status: 'dominant'
      });
    } else if (yourScore >= avgCompetitor) {
      strengths.push({
        metric,
        score: yourScore,
        lead: yourScore - avgCompetitor,
        maxCompetitor,
        avgCompetitor,
        competitorScores,
        status: 'ahead'
      });
    } else {
      const leader = data.competitors.find(c => c.scores[metric] === maxCompetitor);
      weaknesses.push({
        metric,
        score: yourScore,
        gap: maxCompetitor - yourScore,
        avgGap: avgCompetitor - yourScore,
        maxCompetitor,
        avgCompetitor,
        competitorScores,
        leader: leader ? { name: getDomainName(leader.url), score: leader.scores[metric], url: leader.url } : null
      });
    }
  });

  return `
    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
      ${t('reports.competitive.swDescription', "Based on your competitive analysis, here's where you excel and where you need improvement. Click each item for detailed insights.")}
    </p>

    <!-- Summary Stats -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
      <div style="background: rgba(16,185,129,0.1); padding: 1rem; border-radius: 8px; text-align: center; border: 1px solid rgba(16,185,129,0.3);">
        <div style="font-size: 2rem; font-weight: bold; color: #10b981;">${strengths.filter(s => s.status === 'dominant').length}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">${t('reports.competitive.categoriesLeading', 'Categories Leading')}</div>
      </div>
      <div style="background: rgba(91,244,231,0.1); padding: 1rem; border-radius: 8px; text-align: center; border: 1px solid rgba(91,244,231,0.3);">
        <div style="font-size: 2rem; font-weight: bold; color: var(--accent-primary);">${strengths.filter(s => s.status === 'ahead').length}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">${t('reports.competitive.aboveAverage', 'Above Average')}</div>
      </div>
      <div style="background: rgba(255,165,0,0.1); padding: 1rem; border-radius: 8px; text-align: center; border: 1px solid rgba(255,165,0,0.3);">
        <div style="font-size: 2rem; font-weight: bold; color: #ffa500;">${weaknesses.length}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">${t('reports.competitive.needImprovement', 'Need Improvement')}</div>
      </div>
      <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; text-align: center; border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
        <div style="font-size: 2rem; font-weight: bold; color: var(--text-primary);">${data.yourSite.scores.overall}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">${t('reports.competitive.overallScore', 'Overall Score')}</div>
      </div>
    </div>

    <!-- Strengths Section -->
    ${strengths.length > 0 ? `
      <h4 style="color: #10b981; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.25rem;">💪</span> ${t('reports.competitive.yourStrengths', 'Your Competitive Strengths')} (${strengths.length})
      </h4>
      <div class="competitive-fixes-list" style="margin-bottom: 2rem;">
        ${strengths.map((s, index) => renderStrengthAccordion(s, index, data)).join('')}
      </div>
    ` : ''}

    <!-- Weaknesses Section -->
    ${weaknesses.length > 0 ? `
      <h4 style="color: #ef4444; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.25rem;">⚠️</span> ${t('reports.competitive.areasNeedingImprovement', 'Areas Needing Improvement')} (${weaknesses.length})
      </h4>
      <div class="competitive-fixes-list">
        ${weaknesses.map((w, index) => renderWeaknessAccordion(w, index, data)).join('')}
      </div>
    ` : `
      <div style="background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(91,244,231,0.05)); border: 1px solid rgba(16,185,129,0.3); border-radius: 12px; padding: 2rem; text-align: center;">
        <h3 style="margin: 0 0 1rem 0; color: #10b981;">🏆 ${t('reports.competitive.outstandingPerformance', 'Outstanding Performance!')}</h3>
        <p style="color: var(--text-secondary); margin: 0;">${t('reports.competitive.noWeaknesses', "You have no significant weaknesses. You're leading or competitive in all measured areas!")}</p>
      </div>
    `}
  `;
}

// Render strength accordion
function renderStrengthAccordion(strength, index, data) {
  const accordionId = `strength-${index}`;
  const isDominant = strength.status === 'dominant';
  const style = isDominant
    ? { bg: 'rgba(245, 158, 11, 0.08)', border: '#f59e0b', color: '#f59e0b', icon: '👑' }
    : { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', color: '#10b981', icon: '💪' };

  return `
    <div class="competitive-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="competitive-fix-header" data-action="toggle-accordion" data-accordion-id="${accordionId}" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">${formatMetricName(strength.metric)}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">
              ${t('reports.competitive.score', 'score')}: <strong>${strength.score}</strong> | +${strength.lead.toFixed(0)} ${t('reports.competitive.aboveAverageLower', 'above average')}
            </p>
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
          ">${isDominant ? t('reports.competitive.dominant', 'DOMINANT') : t('reports.competitive.aheadStatus', 'AHEAD')}</span>
          <span class="competitive-fix-expand-icon" style="color: var(--text-secondary); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="competitive-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderStrengthTabs(strength, accordionId)}
        </div>
      </div>
    </div>
  `;
}

// Render strength tabs
function renderStrengthTabs(strength, accordionId) {
  const metricName = formatMetricName(strength.metric);
  const defensiveSteps = getDefensiveSteps(strength.metric);

  return `
    <div class="competitive-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); padding-bottom: 0.75rem;">
      <button class="competitive-fix-tab active" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: var(--r-text, #111827);
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 ${t('reports.common.overview', 'Overview')}</button>
      <button class="competitive-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="analysis" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">📊 ${t('reports.competitive.comparison', 'Comparison')}</button>
      <button class="competitive-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">🛡️ ${t('reports.competitive.maintainLeadTab', 'Maintain Lead')}</button>
    </div>

    <!-- Overview Tab -->
    <div class="competitive-fix-tab-content active" id="${accordionId}-summary">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
        <div style="background: var(--r-surface-2, #F8FAFC); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('reports.competitive.yourScore', 'Your score')}</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: #10b981;">${strength.score}</div>
        </div>
        <div style="background: var(--r-surface-2, #F8FAFC); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('reports.competitive.bestCompetitor', 'Best Competitor')}</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: var(--text-primary);">${strength.maxCompetitor}</div>
        </div>
        <div style="background: var(--r-surface-2, #F8FAFC); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('reports.competitive.yourLead', 'Your Lead')}</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: #f59e0b;">+${strength.lead.toFixed(0)}</div>
        </div>
      </div>
      <div style="background: rgba(16,185,129,0.1); border-left: 3px solid #10b981; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #10b981; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">
          ${strength.status === 'dominant' ? '👑 ' + t('reports.competitive.categoryLeader', 'Category Leader') : '✓ ' + t('reports.competitive.competitiveAdvantage', 'Competitive Advantage')}
        </div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">
          ${getStrengthExplanation(strength)}
        </div>
      </div>
    </div>

    <!-- Comparison Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-analysis" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">${metricName} ${t('reports.competitive.standings', 'Standings')}</h5>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${[{ name: t('reports.competitive.you', 'YOU'), score: strength.score, isYou: true }, ...strength.competitorScores]
          .sort((a, b) => b.score - a.score)
          .map((site, rank) => `
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0.75rem 1rem;
              background: ${site.isYou ? 'rgba(16, 185, 129, 0.1)' : 'var(--r-surface-2, rgba(0,0,0,0.2))'};
              border-radius: 6px;
              border-left: 3px solid ${site.isYou ? '#10b981' : 'transparent'};
            ">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="
                  width: 24px;
                  height: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 50%;
                  background: ${rank === 0 ? '#10b981' : 'rgba(255,255,255,0.1)'};
                  color: ${rank === 0 ? '#fff' : 'var(--text-secondary)'};
                  font-size: 0.75rem;
                  font-weight: bold;
                ">${rank + 1}</span>
                <span style="font-weight: ${site.isYou ? 'bold' : 'normal'}; color: ${site.isYou ? '#10b981' : 'var(--text-primary)'};">
                  ${site.isYou ? '👤 ' + t('reports.competitive.you', 'YOU') : site.name}
                </span>
              </div>
              <span style="font-weight: bold; font-size: 1.1rem; color: ${rank === 0 ? '#10b981' : 'var(--text-primary)'};">
                ${site.score}
              </span>
            </div>
          `).join('')}
      </div>
    </div>

    <!-- Maintain Lead Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">🛡️ ${t('reports.competitive.howToProtectAdvantage', 'How to Protect Your Advantage')}</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
        ${defensiveSteps.map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255,215,0,0.1); border-radius: 8px; border: 1px solid rgba(255,215,0,0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: #f59e0b; font-weight: 600; margin-bottom: 0.5rem;">
          <span>⚠️</span> ${t('reports.competitive.watchOut', 'Watch Out')}
        </div>
        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
          ${getCompetitorThreatWarning(strength)}
        </p>
      </div>
    </div>
  `;
}

// Render weakness accordion
function renderWeaknessAccordion(weakness, index, data) {
  const accordionId = `weakness-${index}`;
  const isUrgent = weakness.gap > 20;
  const style = isUrgent
    ? { bg: 'rgba(255, 68, 68, 0.08)', border: '#ef4444', color: '#ef4444', icon: '🔴' }
    : { bg: 'rgba(255, 165, 0, 0.08)', border: '#ffa500', color: '#ffa500', icon: '🟠' };

  return `
    <div class="competitive-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="competitive-fix-header" data-action="toggle-accordion" data-accordion-id="${accordionId}" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">${formatMetricName(weakness.metric)}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">
              ${t('reports.competitive.score', 'score')}: <strong>${weakness.score}</strong> | ${t('reports.competitive.pointsBehindShort', '{{gap}} points behind {{leader}}', { gap: weakness.gap, leader: weakness.leader?.name || t('reports.competitive.leader', 'leader') })}
            </p>
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
          ">${isUrgent ? t('reports.competitive.urgent', 'URGENT') : t('reports.competitive.improve', 'IMPROVE')}</span>
          <span class="competitive-fix-expand-icon" style="color: var(--text-secondary); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="competitive-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderWeaknessTabs(weakness, accordionId)}
        </div>
      </div>
    </div>
  `;
}

// Render weakness tabs
function renderWeaknessTabs(weakness, accordionId) {
  const metricName = formatMetricName(weakness.metric);
  const actionSteps = getCompetitiveActionSteps({ metric: weakness.metric });

  return `
    <div class="competitive-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); padding-bottom: 0.75rem;">
      <button class="competitive-fix-tab active" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: var(--r-text, #111827);
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 ${t('reports.common.overview', 'Overview')}</button>
      <button class="competitive-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="analysis" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">📊 ${t('reports.competitive.gapAnalysis', 'Gap Analysis')}</button>
      <button class="competitive-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">🎯 ${t('reports.competitive.fixIt', 'Fix It')}</button>
    </div>

    <!-- Overview Tab -->
    <div class="competitive-fix-tab-content active" id="${accordionId}-summary">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
        <div style="background: rgba(239,68,68,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('reports.competitive.yourScore', 'Your score')}</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: #f87171;">${weakness.score}</div>
        </div>
        <div style="background: rgba(16,185,129,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('reports.competitive.leaderScore', 'Leader Score')}</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: #10b981;">${weakness.leader?.score || weakness.maxCompetitor}</div>
        </div>
        <div style="background: rgba(255,165,0,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('reports.competitive.gapToClose', 'Gap to Close')}</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: #ffa500;">${weakness.gap}</div>
        </div>
      </div>
      <div style="background: rgba(239,68,68,0.1); border-left: 3px solid #ef4444; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #ef4444; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">
          ⚠️ ${t('reports.competitive.competitiveDisadvantage', 'Competitive Disadvantage')}
        </div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">
          ${getWeaknessExplanation(weakness)}
        </div>
      </div>
    </div>

    <!-- Gap Analysis Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-analysis" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">${metricName} ${t('reports.competitive.gapBreakdown', 'Gap Breakdown')}</h5>

      <!-- Visual Gap Bar -->
      <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span style="color: #0ea5e9;">${t('reports.competitive.you', 'YOU')}: ${weakness.score}</span>
          <span style="color: #10b981;">${t('reports.competitive.leader', 'leader')}: ${weakness.leader?.score || weakness.maxCompetitor}</span>
        </div>
        <div style="background: var(--r-dial-track, rgba(255,255,255,0.1)); height: 8px; border-radius: 4px; overflow: hidden; position: relative;">
          <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${weakness.score}%; background: linear-gradient(90deg, #0ea5e9, #38bdf8);"></div>
          <div style="position: absolute; left: ${weakness.score}%; top: 0; height: 100%; width: ${weakness.gap}%; background: rgba(148, 163, 184, 0.25);"></div>
        </div>
        <div style="text-align: center; margin-top: 0.5rem;">
          <span style="color: #f59e0b; font-weight: bold;">${t('reports.competitive.pointGapToClose', '{{gap}} point gap to close', { gap: weakness.gap })}</span>
        </div>
      </div>

      <!-- Competitor Standings -->
      <h6 style="margin: 1rem 0 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">${t('reports.competitive.allCompetitors', 'All Competitors')}:</h6>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${[{ name: t('reports.competitive.you', 'YOU'), score: weakness.score, isYou: true }, ...weakness.competitorScores]
          .sort((a, b) => b.score - a.score)
          .map((site, rank) => `
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0.5rem 0.75rem;
              background: ${site.isYou ? 'rgba(14, 165, 233, 0.1)' : 'var(--r-surface-2, rgba(0,0,0,0.2))'};
              border-radius: 4px;
              border-left: 2px solid ${site.isYou ? '#0ea5e9' : rank === 0 ? '#10b981' : 'transparent'};
            ">
              <span style="color: ${site.isYou ? '#0ea5e9' : 'var(--text-primary)'}; font-size: 0.9rem;">
                ${site.isYou ? '👤 ' + t('reports.competitive.you', 'YOU') : site.name}
              </span>
              <span style="font-weight: bold; color: ${rank === 0 ? '#10b981' : 'var(--text-primary)'};">
                ${site.score}
              </span>
            </div>
          `).join('')}
      </div>
    </div>

    <!-- Fix It Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">🎯 ${t('reports.competitive.actionPlanCloseGap', 'Action Plan to Close the Gap')}</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
        ${actionSteps.map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(91, 244, 231, 0.1); border-radius: 8px; border: 1px solid rgba(91, 244, 231, 0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--accent-primary); font-weight: 600; margin-bottom: 0.5rem;">
          <span>💡</span> ${t('reports.competitive.proTip', 'Pro Tip')}
        </div>
        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
          ${getProTip({ metric: weakness.metric })}
        </p>
      </div>
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,215,0,0.1); border-radius: 8px; border: 1px solid rgba(255,215,0,0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: #f59e0b; font-weight: 600; margin-bottom: 0.5rem;">
          <span>🎯</span> ${t('reports.competitive.targetScore', 'Target Score')}
        </div>
        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
          ${t('reports.competitive.aimFor', 'Aim for')} <strong style="color: #f59e0b;">${weakness.leader?.score || weakness.maxCompetitor}+</strong> ${t('reports.competitive.toMatchOrExceed', 'to match or exceed')} ${weakness.leader?.name || t('reports.competitive.theLeader', 'the leader')} ${t('reports.competitive.inMetric', 'in')} ${metricName}.
        </p>
      </div>
    </div>
  `;
}

// Helper functions for S&W content
function getStrengthExplanation(strength) {
  const metric = strength.metric.toLowerCase();
  const explanations = {
    performance: t('reports.competitive.strengthExp.performance', 'Your site loads faster than competitors, providing a better user experience. This advantage impacts user engagement, SEO rankings, and conversion rates.'),
    seo: t('reports.competitive.strengthExp.seo', 'Your SEO implementation is stronger than competitors, giving you better search visibility and organic traffic potential.'),
    accessibility: t('reports.competitive.strengthExp.accessibility', 'Your site is more accessible than competitors, reaching a wider audience and demonstrating commitment to inclusive design.'),
    security: t('reports.competitive.strengthExp.security', 'Your security posture is stronger, building more trust with users and protecting against potential vulnerabilities.'),
    corewebvitals: t('reports.competitive.strengthExp.coreWebVitals', 'Your Core Web Vitals are better than competitors, which directly impacts Google search rankings and user experience.')
  };
  return explanations[metric] || t('reports.competitive.strengthExp.generic', "You're outperforming competitors in {{metric}}, giving you a significant competitive advantage.", { metric: formatMetricName(metric) });
}

function getWeaknessExplanation(weakness) {
  const metric = weakness.metric.toLowerCase();
  const gap = weakness.gap;
  const explanations = {
    performance: t('reports.competitive.weaknessExp.performance', 'Your site is {{gap}} points slower than the leader. Users may experience longer load times, potentially increasing bounce rates and reducing engagement.', { gap }),
    seo: t('reports.competitive.weaknessExp.seo', "You're {{gap}} points behind in SEO. This gap could mean competitors are capturing organic traffic and rankings that you're missing.", { gap }),
    accessibility: t('reports.competitive.weaknessExp.accessibility', 'Your accessibility score is {{gap}} points lower. This limits your reach to users with disabilities and could pose compliance risks.', { gap }),
    security: t('reports.competitive.weaknessExp.security', 'Your security is {{gap}} points weaker. Users may trust competitor sites more, especially for sensitive transactions.', { gap }),
    corewebvitals: t('reports.competitive.weaknessExp.coreWebVitals', 'Core Web Vitals gap of {{gap}} points could affect your Google rankings. Competitors may rank higher in search results.', { gap })
  };
  return explanations[metric] || t('reports.competitive.weaknessExp.generic', 'The {{gap}}-point gap in {{metric}} puts you at a disadvantage compared to {{leader}}.', { gap, metric: formatMetricName(metric), leader: weakness.leader?.name || t('reports.competitive.competitors', 'competitors') });
}

function getCompetitorThreatWarning(strength) {
  const metric = strength.metric.toLowerCase();
  const warnings = {
    performance: t('reports.competitive.threatWarning.performance', 'Performance is constantly evolving. Competitors may invest in optimization at any time. Monitor their speeds regularly.'),
    seo: t('reports.competitive.threatWarning.seo', 'SEO rankings can shift quickly with algorithm updates or competitor content strategies. Stay vigilant with your SEO efforts.'),
    accessibility: t('reports.competitive.threatWarning.accessibility', 'Accessibility standards are becoming more stringent. Competitors may catch up to meet compliance requirements.'),
    security: t('reports.competitive.threatWarning.security', "Security threats evolve daily. What's secure today may be vulnerable tomorrow. Keep your security measures updated."),
    corewebvitals: t('reports.competitive.threatWarning.coreWebVitals', 'Google updates CWV thresholds periodically. Competitors may be working to improve their scores.')
  };
  return warnings[metric] || t('reports.competitive.threatWarning.generic', "Your competitors are likely working to improve. Don't get complacent - continue to invest in this area to maintain your lead.");
}

// Legacy wrapper
function renderStrengthsWeaknesses(data, metrics) {
  return `<section class="section"><h2>💪 ${t('reports.competitive.strengthsWeaknesses', 'Your Competitive Strengths & Weaknesses')}</h2>${renderStrengthsWeaknessesContent(data)}</section>`;
}

// Ensure competitive fix styles are injected
function ensureCompetitiveFixStyles() {
  if (document.getElementById('competitive-fix-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'competitive-fix-styles';
  style.textContent = `
    .competitive-fix-accordion .competitive-fix-header:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    .competitive-fix-accordion.expanded .competitive-fix-expand-icon {
      transform: rotate(180deg);
    }
    .competitive-fix-tab.active {
      background: rgba(255, 255, 255, 0.1) !important;
      color: var(--r-text, #111827) !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
    }
    .competitive-fix-tab-content {
      display: none;
    }
    .competitive-fix-tab-content.active {
      display: block;
    }
  `;
  document.head.appendChild(style);
}

// Toggle competitive fix accordion
window.toggleCompetitiveFixAccordion = function(accordionId) {
  const content = document.getElementById(`${accordionId}-content`);
  const accordion = content?.closest('.competitive-fix-accordion');
  const icon = accordion?.querySelector('.competitive-fix-expand-icon');
  
  if (!content) return;
  
  const isExpanded = content.style.maxHeight && content.style.maxHeight !== '0px';
  
  if (isExpanded) {
    content.style.maxHeight = '0px';
    accordion?.classList.remove('expanded');
  } else {
    content.style.maxHeight = content.scrollHeight + 'px';
    accordion?.classList.add('expanded');
  }
};

// Switch competitive fix tab
window.switchCompetitiveFixTab = function(accordionId, tabName) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;
  
  // Update tab buttons
  accordion.querySelectorAll('.competitive-fix-tab').forEach(tab => {
    tab.classList.remove('active');
    tab.style.background = 'transparent';
    tab.style.color = '#aaa';
  });
  
  const activeTab = accordion.querySelector(`[onclick*="'${tabName}'"]`);
  if (activeTab) {
    activeTab.classList.add('active');
    activeTab.style.background = 'rgba(255,255,255,0.1)';
    activeTab.style.color = '#fff';
  }
  
  // Update content panels
  accordion.querySelectorAll('.competitive-fix-tab-content').forEach(panel => {
    panel.classList.remove('active');
    panel.style.display = 'none';
  });
  
  const activePanel = document.getElementById(`${accordionId}-${tabName}`);
  if (activePanel) {
    activePanel.classList.add('active');
    activePanel.style.display = 'block';
  }
  
  // Recalculate max-height for expanded content
  const content = document.getElementById(`${accordionId}-content`);
  if (content && content.style.maxHeight && content.style.maxHeight !== '0px') {
    setTimeout(() => {
      content.style.maxHeight = content.scrollHeight + 'px';
    }, 10);
  }
};

// Copy code utility
window.copyCompetitiveCode = function(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = document.querySelector(`[onclick*="${elementId}"]`);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✓ ' + t('common.copied', 'Copied!');
      setTimeout(() => { btn.textContent = original; }, 2000);
    }
  });
};

// Translate server-generated recommendation text to the active locale
function translateRecommendation(rec) {
  const metric = rec.metric || '';
  const metricName = formatMetricName(metric);
  const gap = rec.gap || 0;
  const yourScore = rec.yourScore || 0;
  const topScore = rec.topCompetitorScore || 0;
  const priority = (rec.priority || 'medium').toLowerCase();

  if (priority === 'high') {
    return t('reports.competitive.recText.high', 'Your {{metric}} score of {{yourScore}} is {{gap}} points behind the leader ({{topScore}}). This is a significant competitive disadvantage that requires immediate attention. Focus on quick wins first: {{quickWins}}', {
      metric: metricName, yourScore, gap, topScore,
      quickWins: getQuickWinsText(metric)
    });
  }
  if (priority === 'medium') {
    return t('reports.competitive.recText.medium', 'A {{gap}}-point improvement in {{metric}} would put you on par with top competitors. Your current score of {{yourScore}} is close but not quite there. {{advice}}', {
      metric: metricName, gap, yourScore,
      advice: getMediumAdviceText(metric)
    });
  }
  return t('reports.competitive.recText.low', 'You are close to the top in {{metric}}. A small {{gap}}-point improvement would help you match or exceed the competition. {{advice}}', {
    metric: metricName, gap,
    advice: getLowAdviceText(metric)
  });
}

// Translate server-generated impact text
function translateImpact(rec) {
  const priority = (rec.priority || 'medium').toLowerCase();
  const metricName = formatMetricName(rec.metric || '');

  if (priority === 'high') {
    return t('reports.competitive.impactText.high', 'Closing this gap could significantly improve your competitive position and help you capture traffic currently going to competitors with better {{metric}} scores.', { metric: metricName });
  }
  if (priority === 'medium') {
    return t('reports.competitive.impactText.medium', 'Moderate improvement opportunity. Closing this gap would make you more competitive and could lead to better user engagement and conversion rates.');
  }
  return t('reports.competitive.impactText.low', 'Fine-tuning opportunity. You are already competitive here, but small improvements can make a difference.');
}

// Get localized quick wins text for a metric
function getQuickWinsText(metric) {
  const wins = {
    seo: t('reports.competitive.quickWins.seo', 'optimize title tags, add meta descriptions, and ensure proper heading hierarchy'),
    performance: t('reports.competitive.quickWins.performance', 'compress images, enable caching, and minimize JavaScript'),
    accessibility: t('reports.competitive.quickWins.accessibility', 'add alt text to images, ensure proper color contrast, and fix ARIA labels'),
    security: t('reports.competitive.quickWins.security', 'implement HTTPS, add security headers, and update dependencies'),
    coreWebVitals: t('reports.competitive.quickWins.coreWebVitals', 'optimize LCP by preloading key resources and reduce CLS by sizing images')
  };
  return wins[metric] || t('reports.competitive.quickWins.generic', 'review best practices and implement improvements');
}

// Get localized medium-priority advice
function getMediumAdviceText(metric) {
  const advice = {
    seo: t('reports.competitive.mediumAdvice.seo', 'Consider adding structured data, improving internal linking, and creating more targeted content.'),
    performance: t('reports.competitive.mediumAdvice.performance', 'Look into code splitting, lazy loading, and optimizing your critical rendering path.'),
    accessibility: t('reports.competitive.mediumAdvice.accessibility', 'Conduct a thorough WCAG audit and address any remaining issues.'),
    security: t('reports.competitive.mediumAdvice.security', 'Review your CSP policy, enable additional security headers, and audit third-party scripts.'),
    coreWebVitals: t('reports.competitive.mediumAdvice.coreWebVitals', 'Focus on Time to First Byte (TTFB) and optimize server response times.')
  };
  return advice[metric] || t('reports.competitive.mediumAdvice.generic', 'Review current implementation and identify optimization opportunities.');
}

// Get localized low-priority advice
function getLowAdviceText(metric) {
  const advice = {
    seo: t('reports.competitive.lowAdvice.seo', 'Fine-tune your existing optimizations and monitor for any regressions.'),
    performance: t('reports.competitive.lowAdvice.performance', 'Consider advanced techniques like service workers or edge caching.'),
    accessibility: t('reports.competitive.lowAdvice.accessibility', 'Test with real users with disabilities and gather feedback.'),
    security: t('reports.competitive.lowAdvice.security', 'Stay updated on new security best practices and vulnerabilities.'),
    coreWebVitals: t('reports.competitive.lowAdvice.coreWebVitals', 'Monitor real-user metrics and address any edge cases.')
  };
  return advice[metric] || t('reports.competitive.lowAdvice.generic', 'Continue monitoring and maintaining your current standards.');
}

// Recommendations content (for accordion) - comprehensive version with tabs
function renderRecommendationsContent(recommendations) {
  ensureCompetitiveFixStyles();
  
  if (!recommendations || recommendations.length === 0) {
    return `
      <div style="margin-top: 1rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">✓</span> ${t('reports.competitive.youreAheadOfCompetition', "You're Ahead of Competition!")}
        </h3>
        <p style="color: #86efac; margin: 0;">${t('reports.competitive.alreadyOutperforming', "You're already outperforming your competitors. Keep monitoring to maintain your lead.")}</p>
      </div>
    `;
  }
  
  // Sort by priority: high first, then medium, then low
  const sortedRecs = [...recommendations].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });
  
  let html = `
    <div class="competitive-fixes-container" style="margin-top: 1rem;">
      <div class="competitive-fixes-list">
  `;
  
  sortedRecs.forEach((rec, index) => {
    html += renderCompetitiveFixAccordion(rec, index);
  });
  
  html += `</div></div>`;
  
  return html;
}

function renderCompetitiveFixAccordion(rec, index) {
  const accordionId = `compfix-${index}`;
  const priorityColors = {
    high: { bg: 'rgba(239,68,68,0.1)', border: '#ef4444', color: '#ef4444', icon: '🔴' },
    medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
    low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
  };
  const style = priorityColors[rec.priority] || priorityColors.medium;
  const metricName = formatMetricName(rec.metric);
  const competitorName = rec.topCompetitorName || 'competitor';
  const yourScore = typeof rec.yourScore === 'number' ? rec.yourScore : '?';
  const topScore = typeof rec.topCompetitorScore === 'number' ? rec.topCompetitorScore : '?';

  return `
    <div class="competitive-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="competitive-fix-header" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">${t('reports.competitive.closeGapIn', 'Close {{gap}}-point gap in {{metric}}', { gap: rec.gap, metric: metricName })}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">${t('reports.competitive.recSubtitle', '{{competitor}}: {{topScore}} vs {{you}}: {{yourScore}}', { competitor: competitorName, topScore, you: t('reports.competitive.you', 'YOU'), yourScore })}</p>
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
          ">${t('reports.common.severity.' + (rec.priority || 'medium').toLowerCase(), rec.priority || 'medium')}</span>
          <span class="competitive-fix-expand-icon" style="color: var(--text-secondary); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="competitive-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderCompetitiveFixTabs(rec, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderCompetitiveFixTabs(rec, accordionId) {
  const metricName = formatMetricName(rec.metric);
  const actionSteps = getCompetitiveActionSteps(rec);
  
  return `
    <div class="competitive-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); padding-bottom: 0.75rem;">
      <button class="competitive-fix-tab active" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: var(--r-text, #111827);
        cursor: pointer;
        font-size: 0.85rem;
      ">${t('reports.competitive.summary', 'Summary')}</button>
      <button class="competitive-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="analysis" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">${t('reports.competitive.gapAnalysis', 'Gap Analysis')}</button>
      <button class="competitive-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">${t('reports.competitive.actionSteps', 'Action Steps')}</button>
    </div>

    <!-- Summary Tab -->
    <div class="competitive-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: var(--text-secondary); line-height: 1.7; margin: 0 0 1rem 0;">
        ${translateRecommendation(rec)}
      </p>
      <div style="background: rgba(16,185,129,0.1); border-left: 3px solid #10b981; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #10b981; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ ${t('reports.competitive.expectedImpact', 'Expected Impact')}</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">${translateImpact(rec)}</div>
      </div>
    </div>

    <!-- Gap Analysis Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-analysis" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Score Comparison -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; padding: 1rem; border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
          <h5 style="margin: 0 0 0.75rem 0; color: var(--text-primary);">${metricName} ${t('reports.competitive.scoreComparison', 'Score Comparison')}</h5>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div style="text-align: center; padding: 1rem; background: rgba(239,68,68,0.1); border-radius: 8px;">
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('reports.competitive.yourScore', 'Your score')}</div>
              <div style="font-size: 2rem; font-weight: bold; color: #f87171;">${rec.yourScore ?? '?'}</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(16,185,129,0.1); border-radius: 8px;">
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${rec.topCompetitorName || t('reports.competitive.topCompetitor', 'Top Competitor')}</div>
              <div style="font-size: 2rem; font-weight: bold; color: #10b981;">${rec.topCompetitorScore ?? '?'}</div>
            </div>
          </div>

          <!-- Visual Gap Bar -->
          <div style="margin-top: 1.25rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.8rem;">
              <span style="color: #0ea5e9;">${t('reports.competitive.you', 'YOU')}: ${rec.yourScore ?? '?'}</span>
              <span style="color: #10b981;">${rec.topCompetitorName || t('reports.competitive.leader', 'leader')}: ${rec.topCompetitorScore ?? '?'}</span>
            </div>
            <div style="background: var(--r-dial-track, rgba(255,255,255,0.1)); height: 12px; border-radius: 6px; overflow: hidden; position: relative;">
              <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${Math.min(rec.yourScore || 0, 100)}%; background: linear-gradient(90deg, #0ea5e9, #38bdf8); border-radius: 6px 0 0 6px;"></div>
              <div style="position: absolute; left: ${Math.min(rec.yourScore || 0, 100)}%; top: 0; height: 100%; width: ${Math.min(rec.gap || 0, 100 - (rec.yourScore || 0))}%; background: repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.3), rgba(148, 163, 184, 0.3) 5px, rgba(148, 163, 184, 0.1) 5px, rgba(148, 163, 184, 0.1) 10px);"></div>
            </div>
            <div style="text-align: center; margin-top: 0.75rem;">
              <span style="display: inline-block; padding: 0.5rem 1rem; background: rgba(245, 158, 11, 0.15); border-radius: 999px; color: #f59e0b; font-weight: 600; font-size: 0.9rem;">
                ${t('reports.competitive.pointGapToClose', '{{gap}} point gap to close', { gap: rec.gap })}
              </span>
            </div>
          </div>

          <!-- Avg Competitor Context -->
          ${rec.avgCompetitorScore ? `
          <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(91,244,231,0.1); border-radius: 6px; border: 1px solid rgba(91,244,231,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-secondary); font-size: 0.85rem;">${t('reports.competitive.averageCompetitorScore', 'Average competitor score')}:</span>
              <span style="color: var(--accent-primary); font-weight: bold;">${rec.avgCompetitorScore}</span>
            </div>
          </div>
          ` : ''}
        </div>

        <!-- What This Means -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; padding: 1rem; border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
          <h5 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">${t('reports.competitive.whatThisMeans', 'What this means')}</h5>
          <p style="color: var(--text-secondary); margin: 0; line-height: 1.6;">
            ${getGapExplanation(rec)}
          </p>
        </div>

        <!-- Target Score -->
        <div style="background: linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,165,0,0.05)); border-radius: 8px; padding: 1rem; border: 1px solid rgba(255,215,0,0.3);">
          <div style="display: flex; align-items: center; gap: 0.5rem; color: #f59e0b; font-weight: 600; margin-bottom: 0.5rem;">
            <span>🎯</span> ${t('reports.competitive.targetScore', 'Target Score')}
          </div>
          <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
            ${t('reports.competitive.aimForSurpass', 'Aim for')} <strong style="color: #f59e0b;">${(rec.topCompetitorScore || 0) + 5}+</strong> ${t('reports.competitive.toSurpassAndEstablish', 'to surpass {{leader}} and establish yourself as the {{metric}} leader in your competitive set.', { leader: rec.topCompetitorName || t('reports.competitive.theLeader', 'the leader'), metric: metricName })}
          </p>
        </div>
      </div>
    </div>

    <!-- Action Steps Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">${t('reports.competitive.howToCloseGap', 'How to Close This Gap')}:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
        ${actionSteps.map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(91, 244, 231, 0.1); border-radius: 8px; border: 1px solid rgba(91, 244, 231, 0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--accent-primary); font-weight: 600; margin-bottom: 0.5rem;">
          <span>💡</span> ${t('reports.competitive.proTip', 'Pro Tip')}
        </div>
        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
          ${getProTip(rec)}
        </p>
      </div>
    </div>
  `;
}

function getGapExplanation(rec) {
  const metric = (rec.metric || '').toLowerCase();
  const gap = rec.gap || 0;

  const explanations = {
    performance: t('reports.competitive.gapExp.performance', 'Your site loads {{speed}} slower than top competitors. Users may choose faster alternatives, affecting bounce rates and conversions.', { speed: gap > 20 ? t('reports.competitive.significantly', 'significantly') : t('reports.competitive.noticeably', 'noticeably') }),
    seo: t('reports.competitive.gapExp.seo', "Competitors have {{degree}} better search visibility. This could mean they're capturing traffic you're missing out on.", { degree: gap > 20 ? t('reports.competitive.substantially', 'substantially') : t('reports.competitive.moderately', 'moderately') }),
    accessibility: t('reports.competitive.gapExp.accessibility', 'Your site is {{degree}} less accessible than competitors. This affects users with disabilities and may have legal implications.', { degree: gap > 20 ? t('reports.competitive.much', 'much') : t('reports.competitive.somewhat', 'somewhat') }),
    security: t('reports.competitive.gapExp.security', 'Competitors have stronger security measures. Users may trust their sites more, especially for transactions.'),
    corewebvitals: t('reports.competitive.gapExp.coreWebVitals', 'Core Web Vitals affect Google rankings. A {{gap}}-point gap could mean competitors rank higher in search results.', { gap })
  };

  return explanations[metric] || t('reports.competitive.gapExp.generic', 'Closing this {{gap}}-point gap would put you on par with or ahead of your top competitors in this area.', { gap });
}

function getCompetitiveActionSteps(rec) {
  const metric = (rec.metric || '').toLowerCase();

  const stepsMap = {
    performance: [
      t('reports.competitive.action.perf1', 'Run a Lighthouse performance audit to identify specific bottlenecks'),
      t('reports.competitive.action.perf2', 'Optimize images: compress, use WebP format, and implement lazy loading'),
      t('reports.competitive.action.perf3', 'Minimize and bundle JavaScript and CSS files'),
      t('reports.competitive.action.perf4', 'Enable browser caching and use a CDN for static assets'),
      t('reports.competitive.action.perf5', 'Consider server-side optimizations and faster hosting')
    ],
    seo: [
      t('reports.competitive.action.seo1', 'Audit your meta titles and descriptions for all key pages'),
      t('reports.competitive.action.seo2', 'Ensure proper heading hierarchy (H1, H2, H3) on each page'),
      t('reports.competitive.action.seo3', 'Add structured data markup for rich search results'),
      t('reports.competitive.action.seo4', 'Build high-quality backlinks from relevant sites'),
      t('reports.competitive.action.seo5', 'Create fresh, valuable content targeting your keywords')
    ],
    accessibility: [
      t('reports.competitive.action.a11y1', 'Add alt text to all images and meaningful link text'),
      t('reports.competitive.action.a11y2', 'Ensure sufficient color contrast (WCAG AA minimum)'),
      t('reports.competitive.action.a11y3', 'Make all interactive elements keyboard accessible'),
      t('reports.competitive.action.a11y4', 'Add proper ARIA labels and roles where needed'),
      t('reports.competitive.action.a11y5', 'Test with screen readers and accessibility tools')
    ],
    security: [
      t('reports.competitive.action.sec1', 'Implement all recommended security headers (CSP, HSTS, etc.)'),
      t('reports.competitive.action.sec2', 'Ensure all resources load over HTTPS'),
      t('reports.competitive.action.sec3', 'Keep all software and dependencies up to date'),
      t('reports.competitive.action.sec4', 'Implement proper input validation and sanitization'),
      t('reports.competitive.action.sec5', 'Set up regular security scanning and monitoring')
    ],
    corewebvitals: [
      t('reports.competitive.action.cwv1', 'Optimize Largest Contentful Paint (LCP) by preloading key resources'),
      t('reports.competitive.action.cwv2', 'Reduce Cumulative Layout Shift (CLS) by sizing images and embeds'),
      t('reports.competitive.action.cwv3', 'Improve First Input Delay (FID) by breaking up long JavaScript tasks'),
      t('reports.competitive.action.cwv4', 'Use browser caching and efficient cache policies'),
      t('reports.competitive.action.cwv5', 'Monitor Core Web Vitals in Google Search Console')
    ]
  };

  return stepsMap[metric] || [
    t('reports.competitive.action.gen1', 'Analyze competitor implementations for best practices'),
    t('reports.competitive.action.gen2', 'Identify specific areas where competitors excel'),
    t('reports.competitive.action.gen3', 'Prioritize quick wins that can close the gap fastest'),
    t('reports.competitive.action.gen4', 'Implement changes incrementally and measure impact'),
    t('reports.competitive.action.gen5', 'Re-run analysis to track improvement')
  ];
}

function getProTip(rec) {
  const metric = (rec.metric || '').toLowerCase();

  const tips = {
    performance: t('reports.competitive.tip.performance', 'Focus on mobile performance first - Google uses mobile-first indexing and most users browse on mobile devices.'),
    seo: t('reports.competitive.tip.seo', 'Quality over quantity - one excellent, in-depth piece of content often outranks many thin pages.'),
    accessibility: t('reports.competitive.tip.accessibility', 'Accessibility improvements often benefit all users, not just those with disabilities. Better UX = better conversions.'),
    security: t('reports.competitive.tip.security', 'Security headers are free to implement but provide significant trust signals and protection.'),
    corewebvitals: t('reports.competitive.tip.coreWebVitals', 'Core Web Vitals are a confirmed Google ranking factor. Improvements here directly impact your search visibility.')
  };

  return tips[metric] || t('reports.competitive.tip.generic', 'Start with the highest-impact changes first. Small improvements compound over time to create significant competitive advantages.');
}

// Legacy wrapper
function renderRecommendations(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return `
      <section class="section">
        <h2>✓ ${t('reports.competitive.youreDominating', "You're Dominating!")}</h2>
        <p style="color: var(--accent-primary);">${t('reports.competitive.alreadyAhead', "You're already ahead of the competition. Keep up the great work!")}</p>
      </section>
    `;
  }

  return `<section class="section"><h2>🎯 ${t('reports.competitive.actionPlanBeatCompetition', 'Action Plan to Beat Competition')}</h2>${renderRecommendationsContent(recommendations)}</section>`;
}

// Render site screenshots grid for visual comparison of all analyzed sites
function renderSiteScreenshotsContent(data) {
  const sites = [];

  // Your site first
  if (data.yourSite) {
    sites.push({
      url: data.yourSite.url,
      screenshotUrl: data.yourSite.screenshotUrl || null,
      label: getDomainName(data.yourSite.url),
      isYou: true
    });
  }

  // Then each competitor
  if (Array.isArray(data.competitors)) {
    data.competitors.forEach(comp => {
      sites.push({
        url: comp.url,
        screenshotUrl: comp.screenshotUrl || null,
        label: getDomainName(comp.url),
        isYou: false
      });
    });
  }

  if (sites.length === 0) {
    return `<p class="competitive-no-data">${t('reports.competitive.noScreenshots', 'No screenshots available.')}</p>`;
  }

  const cards = sites.map((site, idx) => {
    const youBadge = site.isYou
      ? ` <span class="site-screenshots-grid__you-badge">${t('reports.competitive.yourSiteLabel', 'Your Site')}</span>`
      : '';
    const altText = t('reports.competitive.screenshotOf', 'Screenshot of {{domain}}', { domain: site.label });

    if (!site.screenshotUrl) {
      return `
        <div class="site-screenshots-grid__item site-screenshots-grid__item--no-image">
          <div class="site-screenshots-grid__label">${site.label}${youBadge}</div>
          <div class="site-screenshots-grid__placeholder">
            <span>${t('reports.competitive.noScreenshots', 'No screenshot available')}</span>
          </div>
        </div>`;
    }

    return `
      <div class="site-screenshots-grid__item">
        <div class="site-screenshots-grid__label">${site.label}${youBadge}</div>
        <div class="site-screenshots-grid__image-wrap">
          <img class="site-screenshots-grid__img" src="${site.screenshotUrl}" alt="${altText}" data-screenshot="${idx}" loading="lazy"
               onerror="this.parentElement.innerHTML='<div class=\\'site-screenshots-grid__placeholder\\'><span>${t('reports.competitive.noScreenshots', 'No screenshot available')}</span></div>'" />
        </div>
      </div>`;
  }).join('');

  return `
    <p class="competitive-section-desc">${t('reports.competitive.screenshotsDesc', 'Visual comparison of all analyzed sites as captured during the scan.')}</p>
    <div class="site-screenshots-grid" data-screenshot-gallery>
      ${cards}
    </div>`;
}

// Utility functions
function formatMetricName(metric) {
  const names = {
    seo: t('reports.metrics.seo', 'SEO'),
    performance: t('reports.metrics.performance', 'Performance'),
    accessibility: t('reports.metrics.accessibility', 'Accessibility'),
    security: t('reports.metrics.security', 'Security'),
    coreWebVitals: t('reports.metrics.coreWebVitals', 'Core Web Vitals'),
    overall: t('reports.metrics.overall', 'Overall')
  };
  return names[metric] || metric;
}

function getDomainName(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (e) {
    return url;
  }
}

function getGradeColor(grade) {
  const colors = {
    'A': getAccentPrimaryColor(),
    'B': '#f59e0b',
    'C': '#ff8c00',
    'D': '#ef4444',
    'F': '#ef4444'
  };
  return colors[grade] || '#888';
}

// Enter key support for your URL
document.getElementById('yourUrl').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('analyzeBtn').click();
  }
});

// Store chart data globally so we can re-render on theme change
let chartData = null;

// Listen for theme changes and update charts
function setupThemeChangeListener() {
  // Watch for class changes on body element
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        // Theme changed, re-render charts if data exists
        if (chartData) {
          initializeCharts(chartData);
        }
      }
    });
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
}

// Initialize theme listener on page load
setupThemeChangeListener();

// ============================================
// GLOBAL EXPORTS for billing return & report-ui.js
// ============================================
window.displayCompetitiveResults = displayResults;
