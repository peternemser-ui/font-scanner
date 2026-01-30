/**
 * Competitive Analysis Dashboard
 * Compare your site vs competitors with interactive visualizations
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'competitive-analysis';

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
    try {
      const cachedResults = sessionStorage.getItem('sm_checkout_results');
      if (cachedResults) {
        const data = JSON.parse(cachedResults);
        if (data && data.yourSite) { // Verify it's competitive analysis data
          console.log('[Competitive] Found cached results in sessionStorage, displaying...');
          displayResults(data);
          sessionStorage.removeItem('sm_checkout_results');
          return;
        }
      }
    } catch (e) {
      console.warn('[Competitive] Failed to parse cached results:', e);
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
    alert(`Maximum ${maxCompetitors} competitors allowed`);
    return;
  }
  
  const row = document.createElement('div');
  row.className = 'competitor-input-row';
  
  const input = document.createElement('input');
  input.type = 'url';
  input.className = 'competitor-url';
  input.placeholder = `https://competitor${currentCount + 1}.com`;
  input.setAttribute('aria-label', `Competitor ${currentCount + 1} URL`);
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-competitor';
  removeBtn.textContent = 'Remove';
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
    alert('At least one competitor is required');
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
  // Handle tab clicks first (more specific)
  const tab = e.target.closest('.competitive-fix-tab');
  if (tab) {
    const accordion = tab.closest('.competitive-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      // Determine which tab was clicked based on text content
      const tabText = tab.textContent.toLowerCase();
      let tabName = 'summary';
      if (tabText.includes('comparison') || tabText.includes('analysis') || tabText.includes('gap')) tabName = 'analysis';
      else if (tabText.includes('guide') || tabText.includes('action') || tabText.includes('fix') || tabText.includes('maintain') || tabText.includes('lead')) tabName = 'guide';

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
    alert('Please enter your website URL');
    return;
  }
  
  // Validate your URL format
  if (!isValidUrl(yourUrl)) {
    alert(`"${yourUrl}" is not a valid URL. Please enter a valid website address like "example.com" or "https://example.com"`);
    return;
  }
  
  if (competitorUrls.length === 0) {
    alert('Please enter at least one competitor URL');
    return;
  }
  
  // Validate all competitor URLs
  for (const url of competitorUrls) {
    if (!isValidUrl(url)) {
      alert(`"${url}" is not a valid URL. Please enter a valid website address like "competitor.com" or "https://competitor.com"`);
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
  const steps = [
    { label: 'SEO Analysis', detail: 'Analyzing search engine optimization metrics...' },
    { label: 'Security Scan', detail: 'Checking security headers and protocols...' },
    { label: 'Accessibility Check', detail: 'Evaluating accessibility standards...' },
    { label: 'Core Web Vitals', detail: 'Measuring page speed and user experience...' },
    { label: 'Performance Test', detail: 'Running Lighthouse performance audit...' }
  ];
  
  // Initialize modal progress tracking
  const totalSeconds = 900; // 15 minutes
  let elapsedSeconds = 0;
  
  const modalTimer = setInterval(() => {
    elapsedSeconds++;
    const remaining = totalSeconds - elapsedSeconds;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    
    const timeDisplay = document.getElementById('modalTimeRemaining');
    if (timeDisplay) {
      timeDisplay.textContent = `Time remaining: ${minutes}m ${seconds}s`;
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
  loader.start(steps, 'Competitive Analysis', 900); // 15 minutes = 900 seconds
  
  // Initialize WebSocket connection
  initializeWebSocket();
  
  resultsDiv.style.display = 'none';
  analyzeBtn.disabled = true;
  
  try {
    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

    const response = await fetch('/api/competitive-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        yourUrl,
        competitorUrls,
        scanStartedAt
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      // Extract the actual error message from the response
      const errorMessage = error.message || error.error || error.details?.message || 'Analysis failed';
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
      throw new Error('Invalid response structure: missing yourSite data');
    }
    
    if (!data.yourSite.scores) {
      throw new Error('Invalid response structure: missing scores data');
    }
    
    displayResults(data);
    
    loader.complete();
    
    // Close modal and show results
    clearInterval(modalTimer);
    closePacmanModal();
    resultsDiv.style.display = 'block';
    
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
function displayResults(data) {
  // Defensive checks
  if (!data || !data.yourSite || !data.competitors) {
    console.error('Invalid data structure:', data);
    alert('Error: Invalid response data structure');
    return;
  }
  
  if (!data.yourSite.scores) {
    console.error('Missing scores in yourSite:', data.yourSite);
    alert('Error: Missing scores data');
    return;
  }
  
  const resultsDiv = document.getElementById('results');
  const reportId = data.reportId || '';
  
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
          title: 'Competitive Analysis',
          subtitle: `Ranked #${data.rankings?.overall?.rank || '?'} of ${(data.competitors?.length || 0) + 1} sites analyzed`,
          summary,
          sections,
          screenshots: [], // No screenshot for competitive analysis
          proBlock: true,
          proBlockOptions: {
            context: 'competitive-analysis',
            features: ['pdf', 'csv', 'share'],
            title: 'Unlock Report',
            subtitle: 'PDF export, share link, export data, and fix packs for this scan.',
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
    alert(`Error displaying results: ${error.message}`);
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
}

// Build summary donuts for competitive analysis
function buildCompetitiveSummary(data) {
  const summary = [];
  const scores = data.yourSite.scores;
  
  // Overall score
  if (typeof scores.overall === 'number') {
    summary.push({ label: 'Overall', score: scores.overall });
  }
  
  // Individual metrics
  if (typeof scores.seo === 'number') {
    summary.push({ label: 'SEO', score: scores.seo });
  }
  if (typeof scores.security === 'number') {
    summary.push({ label: 'Security', score: scores.security });
  }
  if (typeof scores.accessibility === 'number') {
    summary.push({ label: 'Accessibility', score: scores.accessibility });
  }
  if (typeof scores.coreWebVitals === 'number') {
    summary.push({ label: 'Core Web Vitals', score: scores.coreWebVitals });
  }
  if (typeof scores.performance === 'number') {
    summary.push({ label: 'Performance', score: scores.performance });
  }
  
  return summary;
}

// Build sections for ReportContainer
function buildCompetitiveSections(data, reportId) {
  // Use ProReportBlock.hasAccess() which checks both Pro subscription and purchased reports
  // Default to LOCKED (false) - user must prove they have access
  let isUnlocked = false;

  if (reportId && window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function') {
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
    title: 'Detailed Metrics Breakdown',
    expanded: true,
    contentHTML: renderDetailedMetricsContent(data)
  });
  
  // Key Insights - always expanded
  if (data.insights && data.insights.length > 0) {
    sections.push({
      id: 'key-insights',
      title: 'Key Insights',
      expanded: true,
      contentHTML: renderInsightsContent(data.insights)
    });
  }
  
  // Visual Score Comparison
  sections.push({
    id: 'visual-comparison',
    title: 'Visual Score Comparison',
    expanded: false,
    contentHTML: renderVisualComparisonContent(data)
  });
  
  // Competitive Position Summary
  sections.push({
    id: 'competitive-position',
    title: 'Competitive Position Summary',
    expanded: false,
    contentHTML: renderCompetitivePositionContent(data)
  });
  
  // Head-to-Head Battle (Pro)
  sections.push({
    id: 'head-to-head',
    title: 'Head-to-Head Battle',
    expanded: false,
    isPro: true,
    locked: !isUnlocked,
    context: 'competitive-analysis',
    reportId,
    contentHTML: isUnlocked ? renderHeadToHeadContent(data) : renderCompetitiveProPreview()
  });
  
  // Strengths & Weaknesses (Pro)
  sections.push({
    id: 'strengths-weaknesses',
    title: 'Your Competitive Strengths & Weaknesses',
    expanded: false,
    isPro: true,
    locked: !isUnlocked,
    context: 'competitive-analysis',
    reportId,
    contentHTML: isUnlocked ? renderStrengthsWeaknessesContent(data) : renderCompetitiveProPreview()
  });
  
  // Report and Recommendations (Pro)
  if (data.recommendations && data.recommendations.length > 0) {
    sections.push({
      id: 'report-recommendations',
      title: 'Report and Recommendations',
      expanded: true,
      isPro: true,
      locked: !isUnlocked,
      context: 'competitive-analysis',
      reportId,
      contentHTML: isUnlocked ? renderRecommendationsContent(data.recommendations) : renderCompetitiveProPreview()
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
        <div class="accordion-header">📋 Detailed Metrics Breakdown</div>
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
      <p style="margin-bottom: 1rem;">🔒 Unlock to see detailed recommendations</p>
      <ul style="list-style: none; padding: 0; margin: 0; text-align: left; max-width: 300px; margin: 0 auto;">
        <li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.1);">• Prioritized action items</li>
        <li style="padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.1);">• Gap analysis details</li>
        <li style="padding: 0.5rem 0;">• Implementation guidance</li>
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
  if (score >= 80) return getAccentPrimaryColor();
  if (score >= 60) return '#ffa500';
  return '#ff4444';
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
          <h3 class="chart-title">◈ Interactive Score Analysis</h3>
          <p class="chart-subtitle">Compare performance across all metrics with interactive charts</p>
        </div>
        <div class="chart-controls">
          <button class="chart-toggle active" data-chart="radar" id="radarToggle">
            ◉ Radar View
          </button>
          <button class="chart-toggle" data-chart="bar" id="barToggle">
            ▬ Bar Chart
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
  const metricLabels = ['SEO', 'Security', 'Accessibility', 'Core Web Vitals', 'Performance'];
  
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
  const metricLabels = ['SEO', 'Security', 'Accessibility', 'Core Web Vitals', 'Performance'];
  
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
              if (score >= 80) return '✓ Excellent';
              if (score >= 60) return '~ Good';
              return '✗ Needs Improvement';
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
    { key: 'seo', label: 'SEO', icon: 'S' },
    { key: 'security', label: 'Security', icon: '◈' },
    { key: 'accessibility', label: 'Accessibility', icon: 'A' },
    { key: 'coreWebVitals', label: 'Core Web Vitals', icon: 'V' },
    { key: 'performance', label: 'Performance', icon: 'P' }
  ];

  return `
    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
      Complete score breakdown with individual metric details for every site
    </p>
    
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.03); border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: rgba(var(--accent-primary-rgb), 0.1); border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
            <th style="padding: 0.6rem 0.8rem; text-align: left; color: var(--accent-primary); font-weight: bold; border-right: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem;">
              Site
            </th>
            ${metrics.map(({ label, icon }) => `
              <th style="padding: 0.6rem 0.8rem; text-align: center; color: var(--text-primary); font-weight: bold; border-right: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem;">
                ${icon} ${label}
              </th>
            `).join('')}
            <th style="padding: 0.6rem 0.8rem; text-align: center; color: #ffd700; font-weight: bold; font-size: 0.95rem;">
              ◉ Overall
            </th>
          </tr>
        </thead>
        <tbody>
          ${sites.map((site, siteIdx) => {
            const scores = site.data.scores || {};
            const details = site.data.details || {};
            const isYou = site.isYou;
            
            return `
              <tr style="background: ${isYou ? 'rgba(var(--accent-primary-rgb), 0.05)' : siteIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 0.6rem 0.8rem; font-weight: ${isYou ? 'bold' : 'normal'}; color: ${isYou ? 'var(--accent-primary)' : 'var(--text-primary)'}; border-right: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem;">
                  ${isYou ? '◉ ' : ''}${site.name}${isYou ? ' (YOU)' : ''}
                  <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.15rem;">
                    ${getDomainName(site.data.url)}
                  </div>
                </td>
                ${metrics.map(({ key }) => {
                  const score = scores[key] || 0;
                  const hasDetails = details[key] !== null && details[key] !== undefined;
                  const failed = score === 0;
                  
                  let scoreColor = '#ff4444';
                  if (score >= 80) scoreColor = getAccentPrimaryColor();
                  else if (score >= 60) scoreColor = '#ffa500';
                  
                  let grade = 'F';
                  if (score >= 90) grade = 'A+';
                  else if (score >= 80) grade = 'A';
                  else if (score >= 70) grade = 'B';
                  else if (score >= 60) grade = 'C';
                  else if (score >= 50) grade = 'D';
                  
                  return `
                    <td style="padding: 0.5rem 0.6rem; text-align: center; border-right: 1px solid rgba(255,255,255,0.1);">
                      <div style="font-size: 1.2rem; font-weight: bold; color: ${scoreColor}; margin-bottom: 0.15rem;">
                        ${failed ? '✗' : score}
                      </div>
                      <div style="font-size: 0.7rem; padding: 0.15rem 0.4rem; background: ${scoreColor}20; border: 1px solid ${scoreColor}40; border-radius: 3px; display: inline-block; color: ${scoreColor};">
                        ${failed ? 'Failed' : grade}
                      </div>
                      ${failed ? `
                        <div style="font-size: 0.65rem; color: #ff8c00; margin-top: 0.3rem;">
                          ~ Analysis error
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
                <td style="padding: 0.6rem 0.8rem; text-align: center; background: ${isYou ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'rgba(255, 215, 0, 0.05)'};">
                  <div style="font-size: 1.5rem; font-weight: bold; color: ${scores.overall >= 80 ? 'var(--accent-primary)' : scores.overall >= 60 ? '#ffa500' : '#ff4444'};">
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
      <strong style="color: #ff8c00;">ⓘ Note:</strong>
      <span style="color: var(--text-secondary); font-size: 0.9rem;">
        Scores marked with ✗ indicate analyzer failures (typically due to Lighthouse timeouts or site restrictions). 
        These metrics are excluded from overall score calculation to ensure accuracy.
      </span>
    </div>
  `;
}

// Legacy wrapper for backward compatibility
function renderDetailedMetricsTable(data) {
  return `<section class="section"><h2>📋 Detailed Metrics Breakdown</h2>${renderDetailedMetricsContent(data)}</section>`;
}

// Executive Summary - Quick overview
function renderExecutiveSummary(data) {
  // Defensive checks
  if (!data.yourSite?.scores || !data.competitors || data.competitors.length === 0) {
    return '<div class="error">Missing data for executive summary</div>';
  }
  
  const totalCompetitors = data.competitors.length;
  const yourOverall = data.yourSite.scores.overall || 0;
  const competitorScores = data.competitors
    .map(c => c.scores?.overall || 0)
    .filter(score => score > 0);
  
  if (competitorScores.length === 0) {
    return '<div class="warning">No valid competitor scores available</div>';
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
  
  const statusColor = isWinning ? getAccentPrimaryColor() : isLosing ? '#ff4444' : '#ff8c00';
  const statusIcon = isWinning ? '↑' : isLosing ? '↓' : '≈';
  const statusText = isWinning ? 'COMPETITIVE' : isLosing ? 'COMPETITIVE' : 'COMPETITIVE';
  
  return `
    <div style="
      background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.05) 0%, rgba(0,0,0,0.1) 100%);
      border: 2px solid ${statusColor};
      border-radius: 16px;
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
              Grade ${data.yourSite.grade}
            </div>
          </div>
        </div>
        
        <!-- Stats Grid -->
        <div>
          <div style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
            Ranked <span style="color: ${statusColor}; font-size: 1.4rem; font-weight: 900;">#${overallRank}</span> out of ${totalCompetitors + 1} competitors analyzed
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 1.5rem;">
            <div style="
              background: rgba(255,255,255,0.03);
              padding: 1rem;
              border-radius: 8px;
              border-left: 3px solid var(--accent-primary);
            ">
              <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                Winning in
              </div>
              <div style="font-size: 2rem; font-weight: 900; color: var(--text-primary); line-height: 1;">
                ${winsCount}/${metrics.length}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                categories
              </div>
            </div>
            
            <div style="
              background: rgba(255,255,255,0.03);
              padding: 1rem;
              border-radius: 8px;
              border-left: 3px solid #ff8c00;
            ">
              <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                Avg competitor
              </div>
              <div style="font-size: 2rem; font-weight: 900; color: var(--text-primary); line-height: 1;">
                ${Math.round(avgCompetitor)}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                score
              </div>
            </div>
            
            <div style="
              background: rgba(255,255,255,0.03);
              padding: 1rem;
              border-radius: 8px;
              border-left: 3px solid ${maxCompetitor > yourOverall ? '#ff4444' : 'var(--accent-primary)'};
            ">
              <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                Gap to leader
              </div>
              <div style="font-size: 2rem; font-weight: 900; color: ${maxCompetitor > yourOverall ? '#ff4444' : 'var(--accent-primary)'}; line-height: 1;">
                ${maxCompetitor > yourOverall ? `${maxCompetitor - yourOverall}` : `+${yourOverall - maxCompetitor}`}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                points
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
            Priority Focus
          </div>
          <div style="
            font-size: 1.5rem; 
            font-weight: 900; 
            color: var(--text-primary);
            line-height: 1.2;
            margin-bottom: 1rem;
          ">
            ${lossesCount > 0 ? 
              `Fix ${lossesCount} ${lossesCount === 1 ? 'weakness' : 'weaknesses'}` : 
              'Maintain Lead'}
          </div>
          <div style="
            font-size: 0.8rem; 
            color: var(--text-secondary);
            padding: 0.5rem 1rem;
            background: rgba(0,0,0,0.2);
            border-radius: 6px;
            display: inline-block;
          ">
            ${data.analysisTime}s analysis
          </div>
        </div>
      </div>
    </div>
    
    ${data.warning ? `
      <div style="background: rgba(255, 140, 0, 0.15); border-left: 4px solid #ff8c00; padding: 1rem; margin-bottom: 2rem; border-radius: 4px;">
        <p style="margin: 0; color: #ff8c00;">
          <strong>ⓘ Note:</strong> ${data.warning}
        </p>
      </div>
    ` : ''}
  `;
}

// Render rankings grid
function renderRankings(rankings) {
  const metrics = [
    { key: 'overall', label: 'Overall', data: rankings.overall },
    { key: 'seo', label: 'SEO', data: rankings.seo },
    { key: 'performance', label: 'Performance', data: rankings.performance },
    { key: 'coreWebVitals', label: 'Core Web Vitals', data: rankings.coreWebVitals },
    { key: 'accessibility', label: 'Accessibility', data: rankings.accessibility },
    { key: 'security', label: 'Security', data: rankings.security }
  ];

  return `
    <section class="section">
      <h2>R Your Rankings</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.03); border-radius: 8px; overflow: hidden; font-size: 0.9rem;">
          <thead>
            <tr style="background: rgba(255,255,255,0.08);">
              <th style="padding: 0.75rem 1rem; text-align: left; border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-primary); font-weight: 600;">Metric</th>
              <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-primary); font-weight: 600; width: 60px;">Medal</th>
              <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-primary); font-weight: 600; width: 80px;">Rank</th>
              <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-primary); font-weight: 600; width: 100px;">Status</th>
              <th style="padding: 0.75rem 1rem; text-align: left; border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-primary); font-weight: 600;">Recommended Action</th>
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
              
              let statusColor = '#ff4444';
              let statusText = '~ Behind';
              let medal = data.medal || '◉';
              let rankDisplay = data.rank ? `${data.rank}/${data.total}` : '—';
              let recommendation = '';
              
              if (failed) {
                statusColor = '#ff4444';
                statusText = data.total === 0 ? '✗ All Failed' : '✗ Failed';
                medal = '✗';
                rankDisplay = '—';
                recommendation = 'Fix analysis errors - check site accessibility';
              } else if (isFirst) {
                statusColor = getAccentPrimaryColor();
                statusText = '↑ Leading!';
                recommendation = 'Maintain position - monitor competitors';
              } else if (isSecond) {
                statusColor = '#ffd700';
                statusText = '🥈 Strong';
                recommendation = 'Push to #1 - minor optimizations needed';
              } else if (isThird) {
                statusColor = '#ff8c00';
                statusText = '≈ Competitive';
                recommendation = `Improve ${label.toLowerCase()} - gap closing opportunity`;
              } else if (isLast) {
                statusColor = '#ff4444';
                statusText = '↓ Behind';
                recommendation = `Priority: ${label.toLowerCase()} overhaul required`;
              } else {
                statusColor = '#ff8c00';
                statusText = '◉ Mid-pack';
                recommendation = `Target ${label.toLowerCase()} improvements for rank gain`;
              }
              
              // Specific recommendations by metric
              if (!failed) {
                switch(key) {
                  case 'overall':
                    recommendation = isFirst ? 'Maintain all-around excellence' : 
                                   isLast ? 'Multi-metric improvement needed - start with weakest area' :
                                   'Focus on lowest-scoring individual metrics';
                    break;
                  case 'seo':
                    recommendation = isFirst ? 'Monitor keyword rankings & maintain' :
                                   'Optimize meta tags, content, internal linking';
                    break;
                  case 'performance':
                    recommendation = isFirst ? 'Keep load times optimized' :
                                   'Reduce page size, optimize images, enable caching';
                    break;
                  case 'coreWebVitals':
                    recommendation = isFirst ? 'Maintain LCP/FCP/CLS scores' :
                                   'Improve LCP (<2.5s), FCP (<1.8s), CLS (<0.1)';
                    break;
                  case 'accessibility':
                    recommendation = isFirst ? 'Keep accessibility standards high' :
                                   'Add alt text, improve contrast, fix ARIA labels';
                    break;
                  case 'security':
                    recommendation = isFirst ? 'Maintain security best practices' :
                                   'Enable HTTPS, add security headers, update protocols';
                    break;
                }
              }
              
              return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
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

// Render insights content (for accordion)
function renderInsightsContent(insights) {
  if (!insights || insights.length === 0) return '<p style="color: var(--text-secondary);">No insights available.</p>';
  
  return `
    ${insights.map(insight => `
      <div class="insight-card insight-${insight.type}" style="margin-bottom: 0.75rem;">
        <h3 style="margin: 0 0 0.5rem 0;">${insight.message}</h3>
        <p style="margin: 0; color: var(--text-secondary);">${insight.detail}</p>
      </div>
    `).join('')}
  `;
}

// Legacy wrapper
function renderInsights(insights) {
  if (!insights || insights.length === 0) return '';
  
  return `
    <section class="section">
      <h2>ⓘ Key Insights</h2>
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
      ? (rankingData.total === 0 ? '✗ All Sites Failed' : '✗ Failed')
      : `${rankingData.rank || 0}/${rankingData.total || 0}`,
    statusText: failed 
      ? '✗ Analysis Failed'
      : (rankingData.rank === 1 ? '↑ Leading!' : rankingData.rank === 2 ? '≈ Strong' : '◉ Competitive'),
    statusColor: failed ? '#ff4444' : (rankingData.rank === 1 ? getAccentPrimaryColor() : rankingData.rank === 2 ? '#ffd700' : '#ff8c00')
  };
}

// Visual bar chart comparison content (for accordion)
function renderVisualComparisonContent(data) {
  const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
  
  return `
    <p style="color: var(--text-secondary); margin-bottom: 2rem;">
      See exactly where you stand against each competitor in every category
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
        <div style="margin-bottom: 2.5rem; padding: 1.5rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0; font-size: 1.1rem;">
              ${formatMetricName(metric)}
              ${metricStatus.failed ? `<span style="color: ${metricStatus.statusColor}; font-size: 0.9rem; margin-left: 0.5rem;">(${metricStatus.statusText})</span>` :
                gap > 0 ? `<span style="color: #ff4444; font-size: 0.9rem; margin-left: 0.5rem;">(-${gap} behind leader)</span>` : 
                 gap < 0 ? `<span style="color: var(--accent-primary); font-size: 0.9rem; margin-left: 0.5rem;">(+${Math.abs(gap)} ahead!)</span>` :
                 `<span style="color: #ffd700; font-size: 0.9rem; margin-left: 0.5rem;">(${metricStatus.statusText})</span>`}
            </h3>
            <div style="font-size: 0.85rem; color: ${metricStatus.statusColor};">
              Your rank: ${metricStatus.displayRank}
            </div>
          </div>
          
          ${allScores.map((site, idx) => {
            const percentage = maxScore > 0 ? (site.score / maxScore) * 100 : 0;
            const isWinner = idx === 0;
            const barColor = site.isYou ? getAccentPrimaryColor() : (isWinner ? '#ffd700' : '#4a9eff');
            
            return `
              <div style="margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                  <span style="font-size: 0.9rem; ${site.isYou ? 'font-weight: bold; color: var(--accent-primary);' : ''}">
                    ${isWinner ? '👑 ' : ''}${site.name}${site.isYou ? ' (YOU)' : ''}
                  </span>
                  <span style="font-weight: bold; font-size: 1rem; color: ${barColor};">
                    ${site.score}
                  </span>
                </div>
                <div style="background: rgba(255,255,255,0.1); height: 24px; border-radius: 4px; overflow: hidden; position: relative;">
                  <div style="
                    background: linear-gradient(90deg, ${barColor} 0%, ${barColor}dd 100%);
                    height: 100%;
                    width: ${percentage}%;
                    transition: width 1s ease-out;
                    display: flex;
                    align-items: center;
                    padding: 0 0.5rem;
                    font-size: 0.75rem;
                    font-weight: bold;
                    color: white;
                    box-shadow: ${site.isYou ? '0 0 10px ' + barColor : 'none'};
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
  return `<section class="section"><h2>◉ Visual Score Comparison</h2>${renderVisualComparisonContent(data)}</section>`;
}

// Competitive position content (for accordion)
function renderCompetitivePositionContent(data) {
  return `
    <div class="stats-grid">
      ${Object.entries(data.comparison).map(([metric, stats]) => `
        <div class="stat-card" style="border: 2px solid ${stats.status === 'winning' ? 'var(--accent-primary)' : stats.status === 'losing' ? '#ff4444' : '#ffd700'};">
          <div style="text-align: center; margin-bottom: 0.5rem;">
            ${stats.status === 'winning' ? '✓' : stats.status === 'losing' ? '✗' : '≈'}
          </div>
          <div class="stat-value status-${stats.status}">
            ${stats.diff > 0 ? '+' : ''}${stats.diff}
          </div>
          <div class="stat-label">${formatMetricName(metric)}</div>
          <div class="stat-sublabel" style="font-weight: bold; color: ${stats.status === 'winning' ? 'var(--accent-primary)' : stats.status === 'losing' ? '#ff4444' : '#ffd700'};">
            ${stats.status === 'winning' ? 'WINNING' : stats.status === 'tied' ? 'TIED' : 'LOSING'}
          </div>
          <div style="font-size: 0.8rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
            <div>You: <strong>${stats.yourScore}</strong></div>
            <div>Avg: ${stats.avgCompetitor}</div>
            <div>Best: ${stats.maxCompetitor}</div>
            <div style="margin-top: 0.25rem; color: var(--text-secondary);">
              ${stats.percentile}th percentile
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Legacy wrapper
function renderCompetitivePosition(data) {
  return `<section class="section"><h2>◈ Competitive Position Summary</h2>${renderCompetitivePositionContent(data)}</section>`;
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
      Click each metric below to see detailed competitive analysis and actionable insights.
    </p>

    <!-- Summary Table -->
    <div style="overflow-x: auto; margin-bottom: 2rem;">
      <table class="comparison-table">
        <thead>
          <tr>
            <th style="position: sticky; left: 0; background: rgba(20, 20, 20, 0.95); z-index: 10;">Website</th>
            ${metrics.map(m => `<th>${formatMetricName(m)}</th>`).join('')}
            <th>Overall</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          ${allSites.map(site => {
            const isYou = site.isYou;
            return `
              <tr class="${isYou ? 'your-site' : ''}" style="${isYou ? 'background: rgba(var(--accent-primary-rgb), 0.1);' : ''}">
                <td style="position: sticky; left: 0; background: ${isYou ? 'rgba(var(--accent-primary-rgb), 0.15)' : 'rgba(20, 20, 20, 0.95)'}; z-index: 9;">
                  <strong>${isYou ? '👤 YOU' : site.name}</strong>
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
                        color: ${isMax ? '#ffd700' : 'inherit'};
                        ${isMax ? 'text-shadow: 0 0 10px #ffd700;' : ''}
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
    <h4 style="color: var(--text-primary); margin: 0 0 1rem 0; font-size: 1rem;">📊 Detailed Metric Analysis</h4>
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
    ? { bg: 'rgba(0, 255, 65, 0.08)', border: '#00ff41', color: '#00ff41', icon: '👑' }
    : { bg: 'rgba(255, 165, 0, 0.08)', border: '#ffa500', color: '#ffa500', icon: '📈' };

  const statusText = isWinning
    ? 'You\'re leading!'
    : `${analysis.gap} points behind ${analysis.leader}`;

  return `
    <div class="competitive-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="competitive-fix-header" onclick="toggleCompetitiveFixAccordion('${accordionId}')" style="
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
              Your score: <strong>${analysis.yourScore}</strong> | ${statusText}
            </p>
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
          ">${isWinning ? 'WINNING' : 'OPPORTUNITY'}</span>
          <span class="competitive-fix-expand-icon" style="color: var(--text-secondary); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="competitive-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
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
    <div class="competitive-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="competitive-fix-tab active" onclick="switchCompetitiveFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 Overview</button>
      <button class="competitive-fix-tab" onclick="switchCompetitiveFixTab('${accordionId}', 'analysis')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">📊 Comparison</button>
      <button class="competitive-fix-tab" onclick="switchCompetitiveFixTab('${accordionId}', 'guide')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">🎯 Action Steps</button>
    </div>

    <!-- Overview Tab -->
    <div class="competitive-fix-tab-content active" id="${accordionId}-summary">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Your Score</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: ${analysis.isWinning ? '#00ff41' : '#ffa500'};">${analysis.yourScore}</div>
        </div>
        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Best Competitor</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: var(--text-primary);">${analysis.maxScore}</div>
        </div>
        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Avg Competitor</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: var(--text-secondary);">${Math.round(analysis.avgCompetitor)}</div>
        </div>
      </div>
      <div style="background: ${analysis.isWinning ? 'rgba(0,255,65,0.1)' : 'rgba(255,165,0,0.1)'}; border-left: 3px solid ${analysis.isWinning ? '#00ff41' : '#ffa500'}; padding: 0.75rem; border-radius: 4px;">
        <div style="color: ${analysis.isWinning ? '#00ff41' : '#ffa500'}; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">
          ${analysis.isWinning ? '✓ Competitive Advantage' : '⚠ Improvement Opportunity'}
        </div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">
          ${analysis.isWinning
            ? `You're outperforming all competitors in ${metricName}. Focus on maintaining this advantage while they try to catch up.`
            : `Closing this ${analysis.gap}-point gap could significantly improve your competitive position. ${analysis.leader} is setting the benchmark here.`
          }
        </div>
      </div>
    </div>

    <!-- Comparison Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-analysis" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">${metricName} Leaderboard</h5>
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
              border-left: 3px solid ${rank === 0 ? '#ffd700' : site.isYou ? 'var(--accent-primary)' : 'transparent'};
            ">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="
                  width: 24px;
                  height: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 50%;
                  background: ${rank === 0 ? '#ffd700' : 'rgba(255,255,255,0.1)'};
                  color: ${rank === 0 ? '#000' : 'var(--text-secondary)'};
                  font-size: 0.75rem;
                  font-weight: bold;
                ">${rank + 1}</span>
                <span style="font-weight: ${site.isYou ? 'bold' : 'normal'}; color: ${site.isYou ? 'var(--accent-primary)' : 'var(--text-primary)'};">
                  ${site.isYou ? '👤 You' : site.name}
                </span>
              </div>
              <span style="font-weight: bold; font-size: 1.1rem; color: ${rank === 0 ? '#ffd700' : 'var(--text-primary)'};">
                ${site.score}
              </span>
            </div>
          `).join('')}
      </div>
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(91, 244, 231, 0.1); border-radius: 8px; border: 1px solid rgba(91, 244, 231, 0.2);">
        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
          <strong style="color: var(--accent-primary);">What this means:</strong> ${getMetricCompetitiveInsight(analysis)}
        </p>
      </div>
    </div>

    <!-- Action Steps Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">
        ${analysis.isWinning ? '🛡️ Maintain Your Lead' : '🎯 Close the Gap'}
      </h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
        ${(analysis.isWinning ? getDefensiveSteps(analysis.metric) : actionSteps).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(91, 244, 231, 0.1); border-radius: 8px; border: 1px solid rgba(91, 244, 231, 0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--accent-primary); font-weight: 600; margin-bottom: 0.5rem;">
          <span>💡</span> Pro Tip
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
    return `You're the ${formatMetricName(metric)} leader in your competitive set. This is a significant advantage - competitors would need to make substantial improvements to match you.`;
  }

  const insights = {
    performance: `A ${gap}-point performance gap means users experience noticeably faster load times on competitor sites. This directly impacts user engagement, bounce rates, and can affect search rankings.`,
    seo: `Being ${gap} points behind in SEO means competitors likely have better search visibility. They may be capturing organic traffic you're missing, particularly for competitive keywords.`,
    accessibility: `This ${gap}-point accessibility gap could mean competitors are reaching audiences you're not. It may also expose you to compliance risks that competitors have already addressed.`,
    security: `Competitors with ${gap} more security points likely have stronger trust signals. This is especially important for e-commerce or sites handling sensitive information.`,
    corewebvitals: `Core Web Vitals directly affect Google rankings. This ${gap}-point gap means competitors may rank higher in search results and provide a better user experience.`
  };

  return insights[metric] || `This ${gap}-point gap represents a competitive disadvantage that should be addressed to stay competitive in your market.`;
}

// Get defensive steps for maintaining lead
function getDefensiveSteps(metric) {
  const stepsMap = {
    performance: [
      'Set up continuous performance monitoring to catch regressions early',
      'Document your performance optimizations so they\'re not accidentally removed',
      'Monitor competitor performance to stay ahead of their improvements',
      'Invest in performance budgets to prevent feature creep from slowing you down',
      'Consider progressive enhancement to maintain speed as you add features'
    ],
    seo: [
      'Continue producing high-quality, relevant content regularly',
      'Monitor your keyword rankings and react to changes quickly',
      'Keep your technical SEO updated as best practices evolve',
      'Build and maintain a healthy backlink profile',
      'Watch for algorithm updates and adapt your strategy accordingly'
    ],
    accessibility: [
      'Include accessibility testing in your development workflow',
      'Train your team on accessibility best practices',
      'Conduct regular audits to catch any regressions',
      'Stay updated on WCAG guidelines as they evolve',
      'Gather feedback from users with disabilities to improve further'
    ],
    security: [
      'Keep all dependencies and software up to date',
      'Conduct regular security audits and penetration testing',
      'Monitor for new vulnerabilities affecting your stack',
      'Implement security logging and monitoring',
      'Have an incident response plan ready'
    ],
    corewebvitals: [
      'Set up real user monitoring (RUM) to track actual performance',
      'Monitor Core Web Vitals in Google Search Console regularly',
      'Test changes in staging to prevent CWV regressions',
      'Keep an eye on third-party scripts that could impact CWV',
      'Stay informed about CWV threshold changes from Google'
    ]
  };

  return stepsMap[metric.toLowerCase()] || [
    'Continue monitoring your metrics regularly',
    'Stay informed about industry best practices',
    'React quickly if competitors start catching up',
    'Invest in continuous improvement',
    'Document what\'s working so it can be maintained'
  ];
}

// Legacy wrapper
function renderHeadToHead(data, metrics) {
  return `<section class="section"><h2>⚔️ Head-to-Head Battle</h2>${renderHeadToHeadContent(data)}</section>`;
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
      Based on your competitive analysis, here's where you excel and where you need improvement. Click each item for detailed insights.
    </p>

    <!-- Summary Stats -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
      <div style="background: rgba(0,255,65,0.1); padding: 1rem; border-radius: 8px; text-align: center; border: 1px solid rgba(0,255,65,0.3);">
        <div style="font-size: 2rem; font-weight: bold; color: #00ff41;">${strengths.filter(s => s.status === 'dominant').length}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">Categories Leading</div>
      </div>
      <div style="background: rgba(91,244,231,0.1); padding: 1rem; border-radius: 8px; text-align: center; border: 1px solid rgba(91,244,231,0.3);">
        <div style="font-size: 2rem; font-weight: bold; color: var(--accent-primary);">${strengths.filter(s => s.status === 'ahead').length}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">Above Average</div>
      </div>
      <div style="background: rgba(255,165,0,0.1); padding: 1rem; border-radius: 8px; text-align: center; border: 1px solid rgba(255,165,0,0.3);">
        <div style="font-size: 2rem; font-weight: bold; color: #ffa500;">${weaknesses.length}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">Need Improvement</div>
      </div>
      <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
        <div style="font-size: 2rem; font-weight: bold; color: var(--text-primary);">${data.yourSite.scores.overall}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">Overall Score</div>
      </div>
    </div>

    <!-- Strengths Section -->
    ${strengths.length > 0 ? `
      <h4 style="color: #00ff41; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.25rem;">💪</span> Your Competitive Strengths (${strengths.length})
      </h4>
      <div class="competitive-fixes-list" style="margin-bottom: 2rem;">
        ${strengths.map((s, index) => renderStrengthAccordion(s, index, data)).join('')}
      </div>
    ` : ''}

    <!-- Weaknesses Section -->
    ${weaknesses.length > 0 ? `
      <h4 style="color: #ff4444; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.25rem;">⚠️</span> Areas Needing Improvement (${weaknesses.length})
      </h4>
      <div class="competitive-fixes-list">
        ${weaknesses.map((w, index) => renderWeaknessAccordion(w, index, data)).join('')}
      </div>
    ` : `
      <div style="background: linear-gradient(135deg, rgba(0,255,65,0.1), rgba(91,244,231,0.05)); border: 1px solid rgba(0,255,65,0.3); border-radius: 16px; padding: 2rem; text-align: center;">
        <h3 style="margin: 0 0 1rem 0; color: #00ff41;">🏆 Outstanding Performance!</h3>
        <p style="color: var(--text-secondary); margin: 0;">You have no significant weaknesses. You're leading or competitive in all measured areas!</p>
      </div>
    `}
  `;
}

// Render strength accordion
function renderStrengthAccordion(strength, index, data) {
  const accordionId = `strength-${index}`;
  const isDominant = strength.status === 'dominant';
  const style = isDominant
    ? { bg: 'rgba(255, 215, 0, 0.08)', border: '#ffd700', color: '#ffd700', icon: '👑' }
    : { bg: 'rgba(0, 255, 65, 0.08)', border: '#00ff41', color: '#00ff41', icon: '💪' };

  return `
    <div class="competitive-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="competitive-fix-header" onclick="toggleCompetitiveFixAccordion('${accordionId}')" style="
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
              Score: <strong>${strength.score}</strong> | +${strength.lead.toFixed(0)} above average
            </p>
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
          ">${isDominant ? 'DOMINANT' : 'AHEAD'}</span>
          <span class="competitive-fix-expand-icon" style="color: var(--text-secondary); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="competitive-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
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
    <div class="competitive-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="competitive-fix-tab active" onclick="switchCompetitiveFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 Overview</button>
      <button class="competitive-fix-tab" onclick="switchCompetitiveFixTab('${accordionId}', 'analysis')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">📊 Comparison</button>
      <button class="competitive-fix-tab" onclick="switchCompetitiveFixTab('${accordionId}', 'guide')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">🛡️ Maintain Lead</button>
    </div>

    <!-- Overview Tab -->
    <div class="competitive-fix-tab-content active" id="${accordionId}-summary">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Your Score</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: #00ff41;">${strength.score}</div>
        </div>
        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Best Competitor</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: var(--text-primary);">${strength.maxCompetitor}</div>
        </div>
        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Your Lead</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: #ffd700;">+${strength.lead.toFixed(0)}</div>
        </div>
      </div>
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">
          ${strength.status === 'dominant' ? '👑 Category Leader' : '✓ Competitive Advantage'}
        </div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">
          ${getStrengthExplanation(strength)}
        </div>
      </div>
    </div>

    <!-- Comparison Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-analysis" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">${metricName} Standings</h5>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${[{ name: 'You', score: strength.score, isYou: true }, ...strength.competitorScores]
          .sort((a, b) => b.score - a.score)
          .map((site, rank) => `
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0.75rem 1rem;
              background: ${site.isYou ? 'rgba(0,255,65,0.15)' : 'rgba(0,0,0,0.2)'};
              border-radius: 6px;
              border-left: 3px solid ${site.isYou ? '#00ff41' : 'transparent'};
            ">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="
                  width: 24px;
                  height: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 50%;
                  background: ${rank === 0 ? '#ffd700' : 'rgba(255,255,255,0.1)'};
                  color: ${rank === 0 ? '#000' : 'var(--text-secondary)'};
                  font-size: 0.75rem;
                  font-weight: bold;
                ">${rank + 1}</span>
                <span style="font-weight: ${site.isYou ? 'bold' : 'normal'}; color: ${site.isYou ? '#00ff41' : 'var(--text-primary)'};">
                  ${site.isYou ? '👤 You' : site.name}
                </span>
              </div>
              <span style="font-weight: bold; font-size: 1.1rem; color: ${rank === 0 ? '#ffd700' : 'var(--text-primary)'};">
                ${site.score}
              </span>
            </div>
          `).join('')}
      </div>
    </div>

    <!-- Maintain Lead Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">🛡️ How to Protect Your Advantage</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
        ${defensiveSteps.map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255,215,0,0.1); border-radius: 8px; border: 1px solid rgba(255,215,0,0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: #ffd700; font-weight: 600; margin-bottom: 0.5rem;">
          <span>⚠️</span> Watch Out
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
    ? { bg: 'rgba(255, 68, 68, 0.08)', border: '#ff4444', color: '#ff4444', icon: '🔴' }
    : { bg: 'rgba(255, 165, 0, 0.08)', border: '#ffa500', color: '#ffa500', icon: '🟠' };

  return `
    <div class="competitive-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="competitive-fix-header" onclick="toggleCompetitiveFixAccordion('${accordionId}')" style="
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
              Score: <strong>${weakness.score}</strong> | ${weakness.gap} points behind ${weakness.leader?.name || 'leader'}
            </p>
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
          ">${isUrgent ? 'URGENT' : 'IMPROVE'}</span>
          <span class="competitive-fix-expand-icon" style="color: var(--text-secondary); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="competitive-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
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
    <div class="competitive-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="competitive-fix-tab active" onclick="switchCompetitiveFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 Overview</button>
      <button class="competitive-fix-tab" onclick="switchCompetitiveFixTab('${accordionId}', 'analysis')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">📊 Gap Analysis</button>
      <button class="competitive-fix-tab" onclick="switchCompetitiveFixTab('${accordionId}', 'guide')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">🎯 Fix It</button>
    </div>

    <!-- Overview Tab -->
    <div class="competitive-fix-tab-content active" id="${accordionId}-summary">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
        <div style="background: rgba(255,68,68,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Your Score</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: #ff6666;">${weakness.score}</div>
        </div>
        <div style="background: rgba(0,255,65,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Leader Score</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: #00ff41;">${weakness.leader?.score || weakness.maxCompetitor}</div>
        </div>
        <div style="background: rgba(255,165,0,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Gap to Close</div>
          <div style="font-size: 1.75rem; font-weight: bold; color: #ffa500;">${weakness.gap}</div>
        </div>
      </div>
      <div style="background: rgba(255,68,68,0.1); border-left: 3px solid #ff4444; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #ff4444; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">
          ⚠️ Competitive Disadvantage
        </div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">
          ${getWeaknessExplanation(weakness)}
        </div>
      </div>
    </div>

    <!-- Gap Analysis Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-analysis" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">${metricName} Gap Breakdown</h5>

      <!-- Visual Gap Bar -->
      <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span style="color: #ff6666;">You: ${weakness.score}</span>
          <span style="color: #00ff41;">Leader: ${weakness.leader?.score || weakness.maxCompetitor}</span>
        </div>
        <div style="background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow: hidden; position: relative;">
          <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${weakness.score}%; background: linear-gradient(90deg, #ff4444, #ffa500);"></div>
          <div style="position: absolute; left: ${weakness.score}%; top: 0; height: 100%; width: ${weakness.gap}%; background: rgba(255,255,255,0.2);"></div>
        </div>
        <div style="text-align: center; margin-top: 0.5rem;">
          <span style="color: #ffa500; font-weight: bold;">${weakness.gap} point gap to close</span>
        </div>
      </div>

      <!-- Competitor Standings -->
      <h6 style="margin: 1rem 0 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">All Competitors:</h6>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${[{ name: 'You', score: weakness.score, isYou: true }, ...weakness.competitorScores]
          .sort((a, b) => b.score - a.score)
          .map((site, rank) => `
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0.5rem 0.75rem;
              background: ${site.isYou ? 'rgba(255,68,68,0.15)' : 'rgba(0,0,0,0.2)'};
              border-radius: 4px;
              border-left: 2px solid ${site.isYou ? '#ff4444' : rank === 0 ? '#00ff41' : 'transparent'};
            ">
              <span style="color: ${site.isYou ? '#ff6666' : 'var(--text-primary)'}; font-size: 0.9rem;">
                ${site.isYou ? '👤 You' : site.name}
              </span>
              <span style="font-weight: bold; color: ${rank === 0 ? '#00ff41' : 'var(--text-primary)'};">
                ${site.score}
              </span>
            </div>
          `).join('')}
      </div>
    </div>

    <!-- Fix It Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">🎯 Action Plan to Close the Gap</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
        ${actionSteps.map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(91, 244, 231, 0.1); border-radius: 8px; border: 1px solid rgba(91, 244, 231, 0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--accent-primary); font-weight: 600; margin-bottom: 0.5rem;">
          <span>💡</span> Pro Tip
        </div>
        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
          ${getProTip({ metric: weakness.metric })}
        </p>
      </div>
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,215,0,0.1); border-radius: 8px; border: 1px solid rgba(255,215,0,0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: #ffd700; font-weight: 600; margin-bottom: 0.5rem;">
          <span>🎯</span> Target Score
        </div>
        <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
          Aim for <strong style="color: #ffd700;">${weakness.leader?.score || weakness.maxCompetitor}+</strong> to match or exceed ${weakness.leader?.name || 'the leader'} in ${metricName}.
        </p>
      </div>
    </div>
  `;
}

// Helper functions for S&W content
function getStrengthExplanation(strength) {
  const metric = strength.metric.toLowerCase();
  const explanations = {
    performance: `Your site loads faster than competitors, providing a better user experience. This advantage impacts user engagement, SEO rankings, and conversion rates.`,
    seo: `Your SEO implementation is stronger than competitors, giving you better search visibility and organic traffic potential.`,
    accessibility: `Your site is more accessible than competitors, reaching a wider audience and demonstrating commitment to inclusive design.`,
    security: `Your security posture is stronger, building more trust with users and protecting against potential vulnerabilities.`,
    corewebvitals: `Your Core Web Vitals are better than competitors, which directly impacts Google search rankings and user experience.`
  };
  return explanations[metric] || `You're outperforming competitors in ${formatMetricName(metric)}, giving you a significant competitive advantage.`;
}

function getWeaknessExplanation(weakness) {
  const metric = weakness.metric.toLowerCase();
  const gap = weakness.gap;
  const explanations = {
    performance: `Your site is ${gap} points slower than the leader. Users may experience longer load times, potentially increasing bounce rates and reducing engagement.`,
    seo: `You're ${gap} points behind in SEO. This gap could mean competitors are capturing organic traffic and rankings that you're missing.`,
    accessibility: `Your accessibility score is ${gap} points lower. This limits your reach to users with disabilities and could pose compliance risks.`,
    security: `Your security is ${gap} points weaker. Users may trust competitor sites more, especially for sensitive transactions.`,
    corewebvitals: `Core Web Vitals gap of ${gap} points could affect your Google rankings. Competitors may rank higher in search results.`
  };
  return explanations[metric] || `The ${gap}-point gap in ${formatMetricName(metric)} puts you at a disadvantage compared to ${weakness.leader?.name || 'competitors'}.`;
}

function getCompetitorThreatWarning(strength) {
  const metric = strength.metric.toLowerCase();
  const warnings = {
    performance: `Performance is constantly evolving. Competitors may invest in optimization at any time. Monitor their speeds regularly.`,
    seo: `SEO rankings can shift quickly with algorithm updates or competitor content strategies. Stay vigilant with your SEO efforts.`,
    accessibility: `Accessibility standards are becoming more stringent. Competitors may catch up to meet compliance requirements.`,
    security: `Security threats evolve daily. What's secure today may be vulnerable tomorrow. Keep your security measures updated.`,
    corewebvitals: `Google updates CWV thresholds periodically. Competitors may be working to improve their scores.`
  };
  return warnings[metric] || `Your competitors are likely working to improve. Don't get complacent - continue to invest in this area to maintain your lead.`;
}

// Legacy wrapper
function renderStrengthsWeaknesses(data, metrics) {
  return `<section class="section"><h2>💪 Your Competitive Strengths & Weaknesses</h2>${renderStrengthsWeaknessesContent(data)}</section>`;
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
      color: #fff !important;
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
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = original; }, 2000);
    }
  });
};

// Recommendations content (for accordion) - comprehensive version with tabs
function renderRecommendationsContent(recommendations) {
  ensureCompetitiveFixStyles();
  
  if (!recommendations || recommendations.length === 0) {
    return `
      <div style="margin-top: 1rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">✓</span> You're Ahead of Competition!
        </h3>
        <p style="color: #86efac; margin: 0;">You're already outperforming your competitors. Keep monitoring to maintain your lead.</p>
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
    high: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
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
            <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">Close ${rec.gap}-point gap in ${metricName}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">${competitorName}: <strong>${topScore}</strong> vs yours: <strong>${yourScore}</strong></p>
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
          ">${(rec.priority || 'medium').toUpperCase()}</span>
          <span class="competitive-fix-expand-icon" style="color: var(--text-secondary); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="competitive-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
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
    <div class="competitive-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="competitive-fix-tab active" onclick="switchCompetitiveFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">Summary</button>
      <button class="competitive-fix-tab" onclick="switchCompetitiveFixTab('${accordionId}', 'analysis')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">Gap Analysis</button>
      <button class="competitive-fix-tab" onclick="switchCompetitiveFixTab('${accordionId}', 'guide')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">Action Steps</button>
    </div>

    <!-- Summary Tab -->
    <div class="competitive-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: var(--text-secondary); line-height: 1.7; margin: 0 0 1rem 0;">
        ${rec.recommendation}
      </p>
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ Expected Impact</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">${rec.impact}</div>
      </div>
    </div>

    <!-- Gap Analysis Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-analysis" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Score Comparison -->
        <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem; border: 1px solid rgba(255,255,255,0.1);">
          <h5 style="margin: 0 0 0.75rem 0; color: var(--text-primary);">${metricName} Score Comparison</h5>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div style="text-align: center; padding: 1rem; background: rgba(255,68,68,0.1); border-radius: 8px;">
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Your Score</div>
              <div style="font-size: 2rem; font-weight: bold; color: #ff6666;">${rec.yourScore ?? '?'}</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.1); border-radius: 8px;">
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${rec.topCompetitorName || 'Top Competitor'}</div>
              <div style="font-size: 2rem; font-weight: bold; color: #00ff41;">${rec.topCompetitorScore ?? '?'}</div>
            </div>
          </div>

          <!-- Visual Gap Bar -->
          <div style="margin-top: 1.25rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.8rem;">
              <span style="color: #ff6666;">You: ${rec.yourScore ?? '?'}</span>
              <span style="color: #00ff41;">${rec.topCompetitorName || 'Leader'}: ${rec.topCompetitorScore ?? '?'}</span>
            </div>
            <div style="background: rgba(255,255,255,0.1); height: 12px; border-radius: 6px; overflow: hidden; position: relative;">
              <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${Math.min(rec.yourScore || 0, 100)}%; background: linear-gradient(90deg, #ff4444, #ff6666); border-radius: 6px 0 0 6px;"></div>
              <div style="position: absolute; left: ${Math.min(rec.yourScore || 0, 100)}%; top: 0; height: 100%; width: ${Math.min(rec.gap || 0, 100 - (rec.yourScore || 0))}%; background: repeating-linear-gradient(45deg, rgba(255,165,0,0.3), rgba(255,165,0,0.3) 5px, rgba(255,165,0,0.1) 5px, rgba(255,165,0,0.1) 10px);"></div>
            </div>
            <div style="text-align: center; margin-top: 0.75rem;">
              <span style="display: inline-block; padding: 0.5rem 1rem; background: rgba(255,165,0,0.2); border-radius: 20px; color: #ffa500; font-weight: 600; font-size: 0.9rem;">
                ${rec.gap} point gap to close
              </span>
            </div>
          </div>

          <!-- Avg Competitor Context -->
          ${rec.avgCompetitorScore ? `
          <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(91,244,231,0.1); border-radius: 6px; border: 1px solid rgba(91,244,231,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-secondary); font-size: 0.85rem;">Average competitor score:</span>
              <span style="color: var(--accent-primary); font-weight: bold;">${rec.avgCompetitorScore}</span>
            </div>
          </div>
          ` : ''}
        </div>

        <!-- What This Means -->
        <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem; border: 1px solid rgba(255,255,255,0.1);">
          <h5 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">What This Means</h5>
          <p style="color: var(--text-secondary); margin: 0; line-height: 1.6;">
            ${getGapExplanation(rec)}
          </p>
        </div>

        <!-- Target Score -->
        <div style="background: linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,165,0,0.05)); border-radius: 8px; padding: 1rem; border: 1px solid rgba(255,215,0,0.3);">
          <div style="display: flex; align-items: center; gap: 0.5rem; color: #ffd700; font-weight: 600; margin-bottom: 0.5rem;">
            <span>🎯</span> Target Score
          </div>
          <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
            Aim for <strong style="color: #ffd700;">${(rec.topCompetitorScore || 0) + 5}+</strong> to surpass ${rec.topCompetitorName || 'the leader'} and establish yourself as the ${metricName} leader in your competitive set.
          </p>
        </div>
      </div>
    </div>

    <!-- Action Steps Tab -->
    <div class="competitive-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--text-primary);">How to Close This Gap:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary); line-height: 1.8;">
        ${actionSteps.map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(91, 244, 231, 0.1); border-radius: 8px; border: 1px solid rgba(91, 244, 231, 0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--accent-primary); font-weight: 600; margin-bottom: 0.5rem;">
          <span>💡</span> Pro Tip
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
    performance: `Your site loads ${gap > 20 ? 'significantly' : 'noticeably'} slower than top competitors. Users may choose faster alternatives, affecting bounce rates and conversions.`,
    seo: `Competitors have ${gap > 20 ? 'substantially' : 'moderately'} better search visibility. This could mean they're capturing traffic you're missing out on.`,
    accessibility: `Your site is ${gap > 20 ? 'much' : 'somewhat'} less accessible than competitors. This affects users with disabilities and may have legal implications.`,
    security: `Competitors have stronger security measures. Users may trust their sites more, especially for transactions.`,
    corewebvitals: `Core Web Vitals affect Google rankings. A ${gap}-point gap could mean competitors rank higher in search results.`
  };
  
  return explanations[metric] || `Closing this ${gap}-point gap would put you on par with or ahead of your top competitors in this area.`;
}

function getCompetitiveActionSteps(rec) {
  const metric = (rec.metric || '').toLowerCase();
  
  const stepsMap = {
    performance: [
      'Run a Lighthouse performance audit to identify specific bottlenecks',
      'Optimize images: compress, use WebP format, and implement lazy loading',
      'Minimize and bundle JavaScript and CSS files',
      'Enable browser caching and use a CDN for static assets',
      'Consider server-side optimizations and faster hosting'
    ],
    seo: [
      'Audit your meta titles and descriptions for all key pages',
      'Ensure proper heading hierarchy (H1, H2, H3) on each page',
      'Add structured data markup for rich search results',
      'Build high-quality backlinks from relevant sites',
      'Create fresh, valuable content targeting your keywords'
    ],
    accessibility: [
      'Add alt text to all images and meaningful link text',
      'Ensure sufficient color contrast (WCAG AA minimum)',
      'Make all interactive elements keyboard accessible',
      'Add proper ARIA labels and roles where needed',
      'Test with screen readers and accessibility tools'
    ],
    security: [
      'Implement all recommended security headers (CSP, HSTS, etc.)',
      'Ensure all resources load over HTTPS',
      'Keep all software and dependencies up to date',
      'Implement proper input validation and sanitization',
      'Set up regular security scanning and monitoring'
    ],
    corewebvitals: [
      'Optimize Largest Contentful Paint (LCP) by preloading key resources',
      'Reduce Cumulative Layout Shift (CLS) by sizing images and embeds',
      'Improve First Input Delay (FID) by breaking up long JavaScript tasks',
      'Use browser caching and efficient cache policies',
      'Monitor Core Web Vitals in Google Search Console'
    ]
  };
  
  return stepsMap[metric] || [
    'Analyze competitor implementations for best practices',
    'Identify specific areas where competitors excel',
    'Prioritize quick wins that can close the gap fastest',
    'Implement changes incrementally and measure impact',
    'Re-run analysis to track improvement'
  ];
}

function getProTip(rec) {
  const metric = (rec.metric || '').toLowerCase();
  
  const tips = {
    performance: 'Focus on mobile performance first - Google uses mobile-first indexing and most users browse on mobile devices.',
    seo: 'Quality over quantity - one excellent, in-depth piece of content often outranks many thin pages.',
    accessibility: 'Accessibility improvements often benefit all users, not just those with disabilities. Better UX = better conversions.',
    security: 'Security headers are free to implement but provide significant trust signals and protection.',
    corewebvitals: 'Core Web Vitals are a confirmed Google ranking factor. Improvements here directly impact your search visibility.'
  };
  
  return tips[metric] || 'Start with the highest-impact changes first. Small improvements compound over time to create significant competitive advantages.';
}

// Legacy wrapper
function renderRecommendations(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return `
      <section class="section">
        <h2>✓ You're Dominating!</h2>
        <p style="color: var(--accent-primary);">You're already ahead of the competition. Keep up the great work!</p>
      </section>
    `;
  }
  
  return `<section class="section"><h2>🎯 Action Plan to Beat Competition</h2>${renderRecommendationsContent(recommendations)}</section>`;
}

// Utility functions
function formatMetricName(metric) {
  const names = {
    seo: 'SEO',
    performance: 'Performance',
    accessibility: 'Accessibility',
    security: 'Security',
    coreWebVitals: 'Core Web Vitals',
    overall: 'Overall'
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
    'B': '#ffd700',
    'C': '#ff8c00',
    'D': '#ff4444',
    'F': '#ff4444'
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
