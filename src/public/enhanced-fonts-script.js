/**
 * Enhanced Font Analyzer Script
 * Detects font providers, duplicates, unused fonts, and optimization opportunities
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'enhanced-fonts';

// Forward declaration - actual function defined inside DOMContentLoaded
// This allows report-ui.js to find the function for billing return handling
window.displayFontsResults = null;

document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  const urlInput = document.getElementById('urlInput');
  const analyzeButton = document.getElementById('analyzeButton');
  const multiPageOption = document.getElementById('multiPageOption');
  const multiPageOptions = document.getElementById('multiPageOptions');
  const results = document.getElementById('results');
  const loadingContainer = document.getElementById('loadingContainer');
  const resultsContent = document.getElementById('resultsContent');
  const errorMessage = document.getElementById('errorMessage');

  // Initialize AnalyzerLoader
  let loader = null;
  if (typeof AnalyzerLoader !== 'undefined') {
    loader = new AnalyzerLoader('loadingContainer');
  }

  // Define analysis steps
  const analysisSteps = [
    { label: 'Connecting to website', detail: 'Loading page and resources...' },
    { label: 'Detecting font providers', detail: 'Scanning for Google Fonts, Adobe Fonts, self-hosted...' },
    { label: 'Analyzing font declarations', detail: 'Checking @font-face rules and CSS...' },
    { label: 'Finding optimization issues', detail: 'Checking duplicates, display issues, preload...' },
    { label: 'Generating report', detail: 'Compiling results and recommendations...' }
  ];

  // Toggle multi-page options
  multiPageOption.addEventListener('change', () => {
    multiPageOptions.style.display = multiPageOption.checked ? 'block' : 'none';
  });

  // Handle analysis
  analyzeButton.addEventListener('click', analyzeUrl);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzeUrl();
  });

  // Check for URL and report_id in query params
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('url');
  const reportIdParam = params.get('report_id');
  const billingSuccess = params.get('billing_success') === 'true';

  // Initialize from URL params - check for stored report first
  (async function initFromUrlParams() {
    // If we have a report_id, set it on body immediately for access checks
    if (reportIdParam) {
      document.body.setAttribute('data-report-id', reportIdParam);
      console.log('[Fonts] report_id found in URL:', reportIdParam);
    }

    // Fetch billing status for access checks
    if (window.ProReportBlock?.fetchBillingStatus) {
      await window.ProReportBlock.fetchBillingStatus(true);
    }

    // Recovery: Check sessionStorage for checkout data when billing params are missing
    const checkoutReportId = sessionStorage.getItem('sm_checkout_report_id');
    const checkoutUrl = sessionStorage.getItem('sm_checkout_url');
    if (checkoutReportId && checkoutUrl && !billingSuccess && !reportIdParam) {
      console.log('[Fonts] Found checkout data in sessionStorage, checking if purchase completed...', { checkoutReportId, checkoutUrl });
      if (window.ProReportBlock?.hasAccess?.(checkoutReportId)) {
        console.log('[Fonts] Purchase confirmed, recovering report...');
        document.body.setAttribute('data-report-id', checkoutReportId);
        urlInput.value = checkoutUrl;

        // Try to load from database storage
        if (window.ReportStorage) {
          const loaded = await window.ReportStorage.tryLoadAndDisplay(checkoutReportId, displayResults);
          if (loaded) {
            console.log('[Fonts] Stored report loaded successfully after recovery');
            results.classList.remove('hidden');
            sessionStorage.removeItem('sm_checkout_url');
            sessionStorage.removeItem('sm_checkout_report_id');
            return;
          }
        }

        // No stored report, run scan
        console.log('[Fonts] No stored report found, running scan');
        sessionStorage.removeItem('sm_checkout_url');
        sessionStorage.removeItem('sm_checkout_report_id');
        setTimeout(() => analyzeUrl(), 500);
        return;
      } else {
        console.log('[Fonts] Purchase not confirmed, clearing checkout data');
        sessionStorage.removeItem('sm_checkout_url');
        sessionStorage.removeItem('sm_checkout_report_id');
      }
    }

    // If we have a report_id (from dashboard or billing return), try to load stored report
    if (reportIdParam && window.ReportStorage) {
      console.log('[Fonts] Checking for stored report:', reportIdParam);
      const loaded = await window.ReportStorage.tryLoadAndDisplay(reportIdParam, displayResults);
      if (loaded) {
        console.log('[Fonts] Stored report loaded successfully');
        results.classList.remove('hidden');

        // Fill in URL input for context
        if (urlParam) {
          urlInput.value = urlParam;
        }

        // Reveal pro content if user has access
        setTimeout(() => {
          if (window.ProReportBlock?.hasAccess?.(reportIdParam)) {
            // Re-render pro blocks to show unlocked state
            document.querySelectorAll('.pro-code-overlay').forEach(el => el.remove());
            document.querySelectorAll('[data-pro-content-locked]').forEach(el => {
              el.removeAttribute('data-pro-content-locked');
              el.style.filter = '';
              el.style.pointerEvents = '';
            });
          }
        }, 100);
        return;
      }
      console.log('[Fonts] No stored report found for ID:', reportIdParam);
    }

    // Auto-start scan if URL parameter is present
    if (urlParam) {
      urlInput.value = urlParam;
      analyzeUrl();
    }
  })();

  async function analyzeUrl() {
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please enter a valid URL');
      return;
    }

    // Clear any stored report state - this is a fresh scan
    const storedBanner = document.getElementById('sm-stored-report-banner');
    if (storedBanner) storedBanner.remove();

    // Clear old report ID so fresh scan generates a new one
    document.body.removeAttribute('data-report-id');
    document.body.removeAttribute('data-sm-screenshot-url');

    // Show loading
    results.classList.add('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    analyzeButton.disabled = true;
    loadingContainer.style.display = '';

    if (loader) {
      loader.start(analysisSteps, '🔤 ANALYZING FONTS', 30);

      // Add ASCII art patience message after loader starts
      addPatienceMessage(loadingContainer);
    }

    // Build options
    const options = {};
    if (multiPageOption.checked) {
      options.maxPages = parseInt(document.getElementById('maxPages').value) || 5;
      options.maxDepth = 2;
    }

    try {
      if (loader) loader.nextStep(1);

      const scanStartedAt = new Date().toISOString();
      window.SM_SCAN_STARTED_AT = scanStartedAt;
      document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

      const response = await fetch('/api/enhanced-fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options, scanStartedAt })
      });

      if (loader) loader.nextStep(3);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }

      const data = await response.json();
      
      if (loader) {
        loader.complete();
        setTimeout(() => {
          loadingContainer.style.display = 'none';
          results.classList.remove('hidden');
          displayResults(data);
        }, 800);
      } else {
        results.classList.remove('hidden');
        displayResults(data);
      }

    } catch (error) {
      if (loader) {
        loadingContainer.style.display = 'none';
      }
      showError(error.message);
    } finally {
      analyzeButton.disabled = false;
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  // Store current results for export
  let currentResults = null;

  function displayResults(data) {
    currentResults = data;
    // Store data globally for report recall
    window.__fontsCurrentData = data;

    // Remove any stored report banner - this is fresh data
    const storedBanner = document.getElementById('sm-stored-report-banner');
    if (storedBanner) storedBanner.remove();

    const totalIssues = (data.summary.duplicateCount || 0) + 
                        (data.summary.displayIssueCount || 0) + 
                        (data.summary.preloadIssueCount || 0);
    
    // Get full scan data if available
    const fullScan = data.fullScan || {};
    const hasFullScan = !!data.fullScan;
    const fonts = fullScan.fonts || {};
    const performance = fullScan.performance || {};
    const bestPractices = fullScan.bestPractices || {};
    // Prefer top-level screenshotUrl (file-based) or fallback to base64 from fullScan
    const screenshot = data.screenshotUrl || fullScan.screenshot;

    // Generate report ID for unlocking
    const urlValue = document.getElementById('urlInput')?.value || data.url || '';
    const reportId = data.reportId || `fonts_${btoa(urlValue).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
    
    // Set report ID on body for paywall systems
    if (reportId) {
      document.body.setAttribute('data-report-id', reportId);
    }
    
    // Store results globally for unlock handling
    window.currentFontsResults = data;

    // Auto-save report snapshot if user has access (Pro or purchased)
    const scanStartedAt = data.scanStartedAt || window.SM_SCAN_STARTED_AT || new Date().toISOString();
    if (reportId && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
      window.ReportStorage.autoSaveIfEligible(reportId, data, {
        siteUrl: data.url || urlValue,
        analyzerType: 'enhanced-fonts',
        scannedAt: scanStartedAt
      });
    }

    // Initialize entitlements if available
    if (window.SmEntitlements && typeof window.SmEntitlements.init === 'function') {
      window.SmEntitlements.init({ reportId: reportId || undefined });
    }

    // Check if report is unlocked (Pro subscription or purchased single report)
    // Use hasAccess() which checks both Pro subscription and purchased reports
    // Default to LOCKED (false) - user must prove they have access
    let isUnlocked = false;

    if (reportId && window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function') {
      isUnlocked = window.ProReportBlock.hasAccess(reportId);
    }

    console.log('[Fonts] Access check:', {
      reportId,
      hasProReportBlock: !!window.ProReportBlock,
      isUnlocked
    });

    // Advanced Analysis data
    const advancedAnalysis = fonts.advancedAnalysis || {};
    const advancedScore = calculateAdvancedScore(advancedAnalysis);

    // Performance badge
    const perfBadge = hasFullScan ?
      (performance.fontLoadingTime ? `${performance.fontLoadingTime}ms` :
       performance.initialLoadTime ? `${performance.initialLoadTime}ms` :
       fonts.fontMetrics?.length ? `${fonts.fontMetrics.length} elements` : 'Available')
      : 'N/A';

    // Get timestamp
    const startedAt = data.analyzedAt || data.timestamp || window.SM_SCAN_STARTED_AT || '';

    // Build summary donuts (SEO pattern)
    const healthScore = data.healthScore || 0;
    const familyScore = Math.min(100, Math.max(0, 100 - (data.summary.totalFamilies - 3) * 10));
    const duplicateScore = data.summary.duplicateCount === 0 ? 100 : Math.max(0, 100 - data.summary.duplicateCount * 20);
    const displayScore = data.summary.displayIssueCount === 0 ? 100 : Math.max(0, 100 - data.summary.displayIssueCount * 15);

    const summary = [
      { label: 'Health', score: healthScore },
      { label: 'Families', score: familyScore },
      { label: 'Duplicates', score: duplicateScore },
      { label: 'Display', score: displayScore }
    ];

    // Pro preview content for locked state
    const proFixesPreview = getFontsProFixesPreview();

    // Get new font delivery and fallback stability data
    const fontDelivery = data.fontDelivery || fullScan?.fonts?.fontDelivery || {};
    const fallbackStability = data.fallbackStability || fullScan?.fonts?.fallbackStability || {};

    // Calculate display scores with fallback logic (matching content generators)
    const hasNetworkData = fontDelivery && fontDelivery.totalRequests > 0;
    const fallbackFormats = advancedAnalysis?.formats?.summary || {};
    const deliveryDisplayScore = hasNetworkData
      ? fontDelivery.score
      : (fallbackFormats.woff2Percentage >= 80 ? 90 : fallbackFormats.woff2Percentage >= 50 ? 70 : 50);

    const hasStabilityData = fallbackStability && (fallbackStability.score !== undefined || fallbackStability.fallbackStacks?.length > 0);
    const aaFallbackStacks = advancedAnalysis?.fallbackStacks || {};
    const aaClsRisk = advancedAnalysis?.clsRisk || {};
    const stabilityDisplayScore = hasStabilityData
      ? fallbackStability.score
      : (aaFallbackStacks.summary?.score || aaClsRisk.score || 70);
    const stabilityClsLevel = hasStabilityData
      ? fallbackStability.clsRisk?.level
      : (aaClsRisk.level || 'low');

    // Build sections array (SEO pattern)
    const sections = [
      {
        id: 'font-families',
        title: 'Font Families',
        scoreTextRight: `${data.families.length} detected`,
        contentHTML: generateFontsAccordionContent(data, fonts, hasFullScan)
      },
      {
        id: 'font-providers',
        title: 'Providers & Origins',
        scoreTextRight: `${data.providers.length} source${data.providers.length !== 1 ? 's' : ''}`,
        contentHTML: generateProvidersWithEvidence(data)
      },
      {
        id: 'font-delivery',
        title: 'Font Delivery',
        scoreTextRight: deliveryDisplayScore !== undefined ? `${deliveryDisplayScore}/100` : 'N/A',
        contentHTML: generateFontDeliveryContent(fontDelivery, data, advancedAnalysis)
      },
      {
        id: 'fallback-stability',
        title: 'Fallback & Layout Stability',
        scoreTextRight: stabilityDisplayScore !== undefined ? `${stabilityDisplayScore}/100` : stabilityClsLevel.toUpperCase(),
        contentHTML: generateFallbackStabilityContent(fallbackStability, data, advancedAnalysis)
      },
      {
        id: 'advanced-analysis',
        title: 'Advanced Typography Analysis',
        scoreTextRight: advancedScore ? `${advancedScore}/100` : 'N/A',
        contentHTML: generateAdvancedAnalysisContent(advancedAnalysis, fonts)
      },
      {
        id: 'performance',
        title: 'Performance Metrics',
        scoreTextRight: perfBadge,
        contentHTML: generatePerformanceAccordionContent(data, performance, hasFullScan, fonts)
      },
      {
        id: 'report-recommendations',
        title: 'Report and Recommendations',
        scoreTextRight: totalIssues > 0 ? `${totalIssues} issue${totalIssues > 1 ? 's' : ''}` : null,
        isPro: true,
        locked: !isUnlocked,
        context: 'font-analysis',
        reportId,
        contentHTML: isUnlocked ? renderFontsProFixes(data, bestPractices) : proFixesPreview
      }
    ];

    // Build screenshot URL
    const screenshotUrl = screenshot || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');
    if (screenshotUrl) {
      document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
    }

    // Build screenshots array (SEO pattern)
    const screenshots = screenshotUrl
      ? [{ src: screenshotUrl, alt: 'Page screenshot', device: '' }]
      : [];

    // Use ReportContainer.create() - SEO pattern
    const reportHTML = (window.ReportContainer && typeof window.ReportContainer.create === 'function')
      ? window.ReportContainer.create({
          url: data.url || urlValue,
          timestamp: startedAt,
          mode: 'fonts',
          title: 'Fonts & Typography Report',
          subtitle: '',
          summary,
          sections,
          screenshots,
          proBlock: true,
          proBlockOptions: {
            context: 'font-analysis',
            features: ['pdf', 'csv', 'share'],
            title: 'Unlock Report',
            subtitle: 'PDF export, share link, export data, and fix packs for this scan.',
            reportId
          }
        })
      : generateFallbackHTML(data, sections);

    resultsContent.innerHTML = `<div class="report-scope">${reportHTML}</div>`;

    // Handle screenshot retry (SEO pattern)
    if (reportId) {
      const img = resultsContent.querySelector('.screenshot-item__img');
      if (img && img.getAttribute('src')) {
        attachScreenshotRetry(img, img.getAttribute('src'));
      }
    }

    // Initialize ReportAccordion interactions
    if (window.ReportAccordion && typeof window.ReportAccordion.initInteractions === 'function') {
      window.ReportAccordion.initInteractions();
    }
    
    // Initialize charts after DOM is ready
    setTimeout(() => {
      initializeCharts(data, fonts);
    }, 100);

    // Refresh paywall UI
    if (reportId && window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
      window.CreditsManager.renderPaywallState(reportId);
    }

    // If already unlocked, reveal Pro content
    if (isUnlocked) {
      revealFontsProContent();
    }

    // Listen for unlock events
    if (!window.__fontsUnlockListenerAttached) {
      window.__fontsUnlockListenerAttached = true;
      window.addEventListener('reportUnlocked', (e) => {
        const unlockedId = e && e.detail ? e.detail.reportId : '';
        if (!unlockedId || unlockedId !== document.body.getAttribute('data-report-id')) return;

        // Replace recommendations section with full content
        const body = document.querySelector('[data-accordion-body="report-recommendations"]');
        if (body) {
          body.innerHTML = renderFontsProFixes(window.currentFontsResults || data, bestPractices);
        }

        revealFontsProContent();

        if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
          window.CreditsManager.renderPaywallState(unlockedId);
        }
      });
    }
  }

  // Expose displayResults globally for report-ui.js to find during billing return
  // This must be set immediately after function definition, not inside the function
  window.displayFontsResults = displayResults;

  // Fallback HTML if ReportContainer is not available
  function generateFallbackHTML(data, sections) {
    return `
      <h2>Fonts & Typography Report</h2>
      <p>URL: ${data.url || 'N/A'}</p>
      <div id="accordions-container"></div>
    `;
  }

  // Pro fixes preview for locked state
  function getFontsProFixesPreview() {
    return `
      <div style="text-align: center; padding: 2rem; color: #888;">
        <p style="margin-bottom: 1rem;">🔒 Unlock to see detailed font optimization recommendations</p>
        <ul style="text-align: left; display: inline-block; margin: 0; padding-left: 1.5rem;">
          <li>Font loading optimizations</li>
          <li>Preconnect and preload recommendations</li>
          <li>font-display improvements</li>
        </ul>
      </div>
    `;
  }

  // Reveal Pro content after unlock
  function revealFontsProContent() {
    const overlays = document.querySelectorAll('.report-shell__lock-overlay');
    overlays.forEach((overlay) => {
      const locked = overlay.querySelector('.is-locked');
      if (!locked) return;

      const fragment = document.createDocumentFragment();
      while (locked.firstChild) {
        fragment.appendChild(locked.firstChild);
      }
      overlay.replaceWith(fragment);
    });
  }

  // Screenshot retry for lazy loading (SEO pattern)
  function attachScreenshotRetry(imgEl, baseUrl, options = {}) {
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
      msg.textContent = 'Screenshot unavailable';
      msg.style.cssText = 'padding: 12px; border: 1px dashed var(--border-color); border-radius: 10px; color: var(--text-secondary); text-align: center;';
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

    // First attempt: force a fresh fetch
    tryReload();
  }

  // ============================================
  // PRO FIXES - TABBED ACCORDION PATTERN (SEO style)
  // ============================================
  function renderFontsProFixes(data, bestPractices) {
    ensureFontsFixStyles();
    const fixes = buildFontsFixCards(data, bestPractices);
    
    if (fixes.length === 0) {
      return `
        <div style="margin-top: 1rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
          <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
            <span style="font-size: 1.5rem;">✓</span> Excellent Typography!
          </h3>
          <p style="color: #86efac; margin: 0;">Your font setup is well-optimized. Keep monitoring for continued performance.</p>
        </div>
      `;
    }

    // Group by severity
    const high = fixes.filter(f => f.severity === 'High');
    const medium = fixes.filter(f => f.severity === 'Medium');
    const low = fixes.filter(f => f.severity === 'Low');

    let html = `
      <div class="fonts-fixes-container" style="margin-top: 1rem;">
        <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
          <span style="font-size: 1.75rem;">🔍</span> Font Fixes
          <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${fixes.length} improvements found)</span>
        </h3>
        <div class="fonts-fixes-list">
    `;

    const allFixes = [...high, ...medium, ...low];
    allFixes.forEach((fix, index) => {
      html += renderFontsFixAccordion(fix, index);
    });

    html += `</div></div>`;

    return html;
  }

  function buildFontsFixCards(data, bestPractices) {
    const fixes = [];
    let fixIndex = 0;

    // Extract all available data
    const summary = data.summary || {};
    const fullScan = data.fullScan || {};
    const fonts = fullScan.fonts || {};
    const advancedAnalysis = fonts.advancedAnalysis || {};
    const providers = data.providers || [];
    const fontFamilies = data.fontFamilies || [];
    const fontDelivery = data.fontDelivery || fonts.fontDelivery || {};
    const fallbackStability = data.fallbackStability || fonts.fallbackStability || {};

    // Get detected font names for examples
    const detectedFonts = fontFamilies.slice(0, 5).map(f => f.family || f.name || f);
    const primaryFont = detectedFonts[0] || 'Inter';
    const secondaryFont = detectedFonts[1] || 'system-ui';

    // Provider info
    const hasGoogleFonts = providers.some(p => (p.name || '').toLowerCase().includes('google'));
    const hasAdobeFonts = providers.some(p => (p.name || '').toLowerCase().includes('adobe') || (p.name || '').toLowerCase().includes('typekit'));

    // ========================================
    // 1. FONT-DISPLAY OPTIMIZATION (Always show)
    // ========================================
    const displayIssueCount = summary.displayIssueCount || 0;
    const fontDisplayAnalysis = advancedAnalysis.fontDisplay || {};

    fixes.push({
      id: `font-fix-${fixIndex++}`,
      title: displayIssueCount > 0
        ? `Fix font-display issues (${displayIssueCount} fonts affected)`
        : 'Optimize font-display strategy',
      category: 'Render Performance',
      severity: displayIssueCount > 0 ? 'High' : 'Medium',
      description: displayIssueCount > 0
        ? `${displayIssueCount} font(s) are missing or have suboptimal font-display values. This can cause Flash of Invisible Text (FOIT) where users see blank space while fonts load, or Flash of Unstyled Text (FOUT) with jarring font swaps.`
        : 'The font-display property controls how fonts render during loading. Choosing the right strategy improves perceived performance and prevents layout shifts.',
      impact: 'Eliminates invisible text during loading, reduces Cumulative Layout Shift (CLS), improves Core Web Vitals score',
      problematicCode: `/* Current font declarations may have issues */
@font-face {
  font-family: '${primaryFont}';
  src: url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}.woff2') format('woff2');
  /* ❌ Missing font-display - causes FOIT */
}

/* Or suboptimal values */
@font-face {
  font-family: '${primaryFont}';
  font-display: block; /* ❌ Blocks rendering for up to 3s */
  src: url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}.woff2') format('woff2');
}

/* Google Fonts without display parameter */
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}" rel="stylesheet">`,
      fixedCode: `/* Recommended: font-display: swap */
@font-face {
  font-family: '${primaryFont}';
  font-display: swap;  /* ✓ Shows fallback immediately, swaps when ready */
  src: url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}

/* For critical above-the-fold text: optional */
@font-face {
  font-family: '${primaryFont}';
  font-display: optional;  /* ✓ Best for hero text - no swap if slow */
  src: url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
}

/* Google Fonts - add display=swap parameter */
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}:wght@400;500;600;700&display=swap" rel="stylesheet">

/* font-display values explained:
 * swap    - Show fallback immediately, swap when font loads (recommended)
 * optional - Like swap, but browser may skip swap if load is slow
 * fallback - Short invisible period (100ms), then fallback
 * block   - Invisible up to 3s (avoid for body text)
 * auto    - Browser decides (unpredictable)
 */`,
      steps: [
        'Audit all @font-face declarations in your CSS files',
        'Add font-display: swap to each declaration',
        'For Google Fonts, append &display=swap to the URL',
        'For Adobe Fonts/Typekit, enable "Web Font Loader" with swap behavior',
        'Consider font-display: optional for hero headlines to prevent any swap',
        'Test with Chrome DevTools Network throttling to verify behavior',
        'Verify CLS improvement with Lighthouse or PageSpeed Insights'
      ]
    });

    // ========================================
    // 2. FONT LOADING STRATEGY (Always show)
    // ========================================
    fixes.push({
      id: `font-fix-${fixIndex++}`,
      title: 'Implement optimal font loading strategy',
      category: 'Loading Performance',
      severity: 'High',
      description: 'Font loading strategy significantly impacts page load time. Preloading critical fonts and using preconnect hints can reduce First Contentful Paint by 100-500ms.',
      impact: 'Faster First Contentful Paint, improved Largest Contentful Paint, better user experience on slow connections',
      problematicCode: `<!-- Current: Fonts discovered late in page load -->
<head>
  <title>My Website</title>
  <link rel="stylesheet" href="styles.css">
  <!-- Font CSS at bottom or loaded via @import in stylesheet -->
  <!-- Browser doesn't know about fonts until CSS is parsed -->
</head>

/* styles.css - Fonts loaded via @import (slow!) */
@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}');

body {
  font-family: '${primaryFont}', sans-serif;
}`,
      fixedCode: `<!-- Optimized: Preconnect and preload critical fonts -->
<head>
  <title>My Website</title>

  <!-- 1. Preconnect to font origins (saves ~100-200ms) -->
  ${hasGoogleFonts ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` : `<link rel="preconnect" href="https://your-font-cdn.com" crossorigin>`}
  ${hasAdobeFonts ? `<link rel="preconnect" href="https://use.typekit.net" crossorigin>` : ''}

  <!-- 2. Preload critical font files (saves ~100-300ms) -->
  <link rel="preload"
        href="/fonts/${primaryFont.toLowerCase().replace(/\s+/g, '-')}-400.woff2"
        as="font"
        type="font/woff2"
        crossorigin>
  <link rel="preload"
        href="/fonts/${primaryFont.toLowerCase().replace(/\s+/g, '-')}-700.woff2"
        as="font"
        type="font/woff2"
        crossorigin>

  <!-- 3. Load font stylesheet (don't use @import!) -->
  ${hasGoogleFonts
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}:wght@400;500;600;700&display=swap">`
    : `<link rel="stylesheet" href="/css/fonts.css">`}

  <!-- 4. Your main stylesheet -->
  <link rel="stylesheet" href="/css/styles.css">
</head>

/* Self-hosted fonts CSS (fonts.css) */
@font-face {
  font-family: '${primaryFont}';
  font-display: swap;
  font-weight: 400;
  font-style: normal;
  src: local('${primaryFont}'),
       url('/fonts/${primaryFont.toLowerCase().replace(/\s+/g, '-')}-400.woff2') format('woff2'),
       url('/fonts/${primaryFont.toLowerCase().replace(/\s+/g, '-')}-400.woff') format('woff');
}

@font-face {
  font-family: '${primaryFont}';
  font-display: swap;
  font-weight: 700;
  font-style: normal;
  src: local('${primaryFont} Bold'),
       url('/fonts/${primaryFont.toLowerCase().replace(/\s+/g, '-')}-700.woff2') format('woff2'),
       url('/fonts/${primaryFont.toLowerCase().replace(/\s+/g, '-')}-700.woff') format('woff');
}`,
      steps: [
        'Add preconnect links for all external font origins at the TOP of <head>',
        'Identify your 1-2 most critical font files (used above the fold)',
        'Add preload links for critical font files BEFORE stylesheets',
        'Always include crossorigin attribute for font preloads',
        'Replace @import with <link> tags for better parallelization',
        'Consider self-hosting fonts for maximum control and speed',
        'Test with WebPageTest to verify improved font loading waterfall'
      ]
    });

    // ========================================
    // 3. FONT FILE OPTIMIZATION (Always show)
    // ========================================
    const formatAnalysis = advancedAnalysis.formats || {};
    const woff2Percentage = formatAnalysis.summary?.woff2Percentage || 0;
    const hasLegacyFormats = formatAnalysis.summary?.hasLegacyFormats || false;

    fixes.push({
      id: `font-fix-${fixIndex++}`,
      title: woff2Percentage < 80
        ? `Upgrade to modern font formats (${woff2Percentage}% WOFF2)`
        : 'Optimize font file delivery',
      category: 'File Optimization',
      severity: woff2Percentage < 50 ? 'High' : 'Medium',
      description: woff2Percentage < 80
        ? `Only ${woff2Percentage}% of your fonts use WOFF2 format. WOFF2 provides 30-50% smaller files compared to WOFF, and up to 75% smaller than TTF/OTF.${hasLegacyFormats ? ' Legacy formats (EOT, SVG fonts) detected - these are no longer needed.' : ''}`
        : 'Modern font formats like WOFF2 provide excellent compression. Further optimization can be achieved through subsetting and variable fonts.',
      impact: 'Reduces font payload by 30-75%, faster downloads especially on mobile, lower bandwidth costs',
      problematicCode: `/* Suboptimal: Using older/larger formats */
@font-face {
  font-family: '${primaryFont}';
  src: url('font.eot');                           /* ❌ EOT: IE only, obsolete */
  src: url('font.eot?#iefix') format('eot'),
       url('font.woff') format('woff'),           /* ⚠️ WOFF: Larger than WOFF2 */
       url('font.ttf') format('truetype'),        /* ⚠️ TTF: Uncompressed */
       url('font.svg#font') format('svg');        /* ❌ SVG: Obsolete */
}

/* Size comparison for typical font:
 * TTF/OTF: ~150KB
 * WOFF:    ~100KB (30% smaller)
 * WOFF2:   ~60KB  (60% smaller than TTF!)
 */`,
      fixedCode: `/* Optimized: WOFF2 with WOFF fallback only */
@font-face {
  font-family: '${primaryFont}';
  font-display: swap;
  font-weight: 400;
  font-style: normal;
  src: local('${primaryFont}'),           /* Check system fonts first */
       url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}.woff2') format('woff2'),
       url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}.woff') format('woff');
  /* No TTF, EOT, or SVG needed - 98%+ browser support for WOFF/WOFF2 */
}

/* For maximum optimization: Subset your fonts */
@font-face {
  font-family: '${primaryFont}';
  font-display: swap;
  font-weight: 400;
  src: url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}-subset.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC,
                 U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074,
                 U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215,
                 U+FEFF, U+FFFD;
  /* Latin subset: ~15KB instead of ~60KB! */
}

/* Consider variable fonts for multiple weights */
@font-face {
  font-family: '${primaryFont} VF';
  font-display: swap;
  src: url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}-variable.woff2') format('woff2-variations');
  font-weight: 100 900;  /* Single file for ALL weights */
}`,
      steps: [
        'Convert all fonts to WOFF2 format using tools like Font Squirrel or Transfonter',
        'Remove legacy formats (EOT, SVG) - no modern browser needs them',
        'Keep WOFF as fallback for older browsers if needed',
        'Subset fonts to include only characters you use (Latin, etc.)',
        'Consider variable fonts if using 3+ weights of the same family',
        'Use unicode-range to load language-specific subsets on demand',
        'Compress fonts with tools like woff2_compress for maximum reduction'
      ]
    });

    // ========================================
    // 4. FONT FAMILY CONSOLIDATION
    // ========================================
    const totalFamilies = summary.totalFamilies || fontFamilies.length || 0;

    fixes.push({
      id: `font-fix-${fixIndex++}`,
      title: totalFamilies > 3
        ? `Consolidate font families (${totalFamilies} currently used)`
        : 'Establish a font system',
      category: 'Typography System',
      severity: totalFamilies > 4 ? 'High' : 'Medium',
      description: totalFamilies > 3
        ? `Your site loads ${totalFamilies} different font families. Each additional font adds ~50-100KB and an HTTP request. Industry best practice is 2-3 fonts maximum.`
        : 'A well-structured font system improves consistency, reduces maintenance, and ensures optimal performance. Define clear roles for each font.',
      impact: `${totalFamilies > 3 ? `Could save ${(totalFamilies - 2) * 75}KB+ and ${(totalFamilies - 2) * 100}ms load time. ` : ''}Improves visual consistency and brand recognition`,
      problematicCode: `/* Current fonts detected:
${detectedFonts.map((f, i) => ` * ${i + 1}. ${f}`).join('\n')}${totalFamilies > 5 ? `\n * ... and ${totalFamilies - 5} more` : ''}
 */

/* Loading multiple similar fonts */
@import url('https://fonts.googleapis.com/css2?family=Roboto');
@import url('https://fonts.googleapis.com/css2?family=Open+Sans');
@import url('https://fonts.googleapis.com/css2?family=Lato');
@import url('https://fonts.googleapis.com/css2?family=Montserrat');
/* These are all similar sans-serif fonts - consolidate! */

/* Inconsistent usage */
h1 { font-family: 'Montserrat', sans-serif; }
h2 { font-family: 'Roboto', sans-serif; }
p  { font-family: 'Open Sans', sans-serif; }
/* No clear system = visual inconsistency */`,
      fixedCode: `/* Optimized: 2-3 font system with clear roles */

/* 1. Define your font stack with CSS variables */
:root {
  /* Primary: Display/Heading font */
  --font-display: '${primaryFont}', ${primaryFont.toLowerCase().includes('serif') && !primaryFont.toLowerCase().includes('sans') ? 'Georgia, serif' : '-apple-system, BlinkMacSystemFont, sans-serif'};

  /* Secondary: Body text font */
  --font-body: '${secondaryFont || 'system-ui'}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Tertiary: Monospace for code */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
}

/* 2. Load only what you need */
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}:wght@500;700&family=${encodeURIComponent(secondaryFont || 'Inter')}:wght@400;500&display=swap" rel="stylesheet">

/* 3. Apply systematically */
h1, h2, h3, .display-text {
  font-family: var(--font-display);
  font-weight: 700;
}

body, p, li, .body-text {
  font-family: var(--font-body);
  font-weight: 400;
}

code, pre, .code-text {
  font-family: var(--font-mono);
}

/* 4. Weight variations instead of font variations */
.text-medium { font-weight: 500; }
.text-bold { font-weight: 700; }
/* Use weights, not different fonts, for emphasis */`,
      steps: [
        'Audit all fonts used across your site',
        'Choose ONE display font for headings and branding',
        'Choose ONE body font optimized for readability',
        'Optionally add a monospace font for code',
        'Create CSS custom properties for your font stack',
        'Replace all font-family declarations with variables',
        'Use font-weight variations instead of different fonts for emphasis',
        'Remove unused font imports and @font-face declarations'
      ]
    });

    // ========================================
    // 5. FALLBACK FONT OPTIMIZATION
    // ========================================
    const fallbackAnalysis = advancedAnalysis.fallbackStacks || {};
    const fallbackScore = fallbackAnalysis.summary?.score || fallbackStability.score || 70;

    fixes.push({
      id: `font-fix-${fixIndex++}`,
      title: `Optimize fallback font stacks${fallbackScore < 80 ? ` (Score: ${fallbackScore}%)` : ''}`,
      category: 'Layout Stability',
      severity: fallbackScore < 60 ? 'High' : 'Medium',
      description: 'Fallback fonts display while custom fonts load. Poorly matched fallbacks cause Cumulative Layout Shift (CLS) when the web font swaps in, hurting Core Web Vitals and user experience.',
      impact: 'Reduces CLS by 0.05-0.2, improves Core Web Vitals score, eliminates jarring text reflow on font swap',
      problematicCode: `/* Poor fallback stacks cause layout shift */
body {
  font-family: '${primaryFont}', sans-serif;
  /* ❌ Generic 'sans-serif' has very different metrics */
  /* Text may jump when web font loads */
}

h1 {
  font-family: 'Playfair Display', serif;
  /* ❌ Default 'serif' (Times) has different width than Playfair */
  /* Headlines will reflow significantly */
}

/* Missing fallback entirely */
.special-text {
  font-family: 'Custom Font';
  /* ❌ No fallback = browser default if font fails */
}`,
      fixedCode: `/* Optimized fallback stacks with metric-matched fonts */

/* Method 1: Use system fonts with similar metrics */
body {
  font-family: '${primaryFont}',
    /* Metric-similar system fonts */
    -apple-system,        /* San Francisco on macOS/iOS */
    BlinkMacSystemFont,   /* San Francisco on Chrome/macOS */
    'Segoe UI',           /* Windows */
    Roboto,               /* Android */
    'Helvetica Neue',     /* Older macOS */
    Arial,                /* Universal fallback */
    sans-serif;           /* Generic last resort */
}

/* Method 2: Use @font-face with size-adjust for perfect matching */
@font-face {
  font-family: '${primaryFont} Fallback';
  src: local('Arial');
  size-adjust: 105%;      /* Adjust to match web font metrics */
  ascent-override: 90%;   /* Fine-tune vertical metrics */
  descent-override: 20%;
  line-gap-override: 0%;
}

body {
  font-family: '${primaryFont}', '${primaryFont} Fallback', sans-serif;
}

/* Method 3: CSS Font Loading API for zero-CLS */
<script>
if ('fonts' in document) {
  document.fonts.load('1rem "${primaryFont}"').then(() => {
    document.documentElement.classList.add('fonts-loaded');
  });
}
</script>

<style>
/* Fallback styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Apply web font only after loaded */
.fonts-loaded body {
  font-family: '${primaryFont}', -apple-system, sans-serif;
}
</style>

/* Tool: Use Fontaine or Capsize to generate exact metrics:
   https://github.com/unjs/fontaine
   https://seek-oss.github.io/capsize/
*/`,
      steps: [
        'Test your site with fonts blocked to see fallback appearance',
        'Choose system fonts with similar x-height and character width',
        'Use CSS size-adjust property to fine-tune fallback metrics',
        'Consider metric override properties (ascent, descent, line-gap)',
        'Use tools like Fontaine or Capsize to calculate exact adjustments',
        'Implement CSS Font Loading API for precise control',
        'Test CLS with Lighthouse and WebPageTest',
        'Verify layout stability on slow 3G connections'
      ]
    });

    // ========================================
    // 6. DUPLICATE FONTS
    // ========================================
    const duplicateCount = summary.duplicateCount || 0;

    fixes.push({
      id: `font-fix-${fixIndex++}`,
      title: duplicateCount > 0
        ? `Remove duplicate font declarations (${duplicateCount} found)`
        : 'Audit font loading sources',
      category: 'Optimization',
      severity: duplicateCount > 0 ? 'High' : 'Low',
      description: duplicateCount > 0
        ? `${duplicateCount} duplicate font declaration(s) detected. The same font is being loaded multiple times through different methods, wasting bandwidth and slowing page load.`
        : 'Fonts can be loaded through multiple sources (CSS @import, link tags, JavaScript, inline @font-face). Auditing ensures no duplicates and optimal loading order.',
      impact: duplicateCount > 0
        ? `Removing duplicates saves ${duplicateCount * 50}-${duplicateCount * 150}KB and ${duplicateCount * 100}ms+ load time`
        : 'Ensures clean, maintainable font loading with no wasted resources',
      problematicCode: `/* Common duplication patterns */

/* 1. Same font loaded via different methods */
/* In HTML: */
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}" rel="stylesheet">

/* In CSS: */
@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}');
/* ❌ Same font loaded twice! */

/* 2. Multiple weight requests that could be combined */
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}:wght@400" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}:wght@700" rel="stylesheet">
/* ❌ Two requests when one would work */

/* 3. Font loaded in CSS AND preloaded but different file */
<link rel="preload" href="/fonts/font-v1.woff2" as="font" crossorigin>
@font-face {
  src: url('/fonts/font-v2.woff2');  /* ❌ Different file preloaded! */
}`,
      fixedCode: `/* Consolidated: Single source of truth for fonts */

/* 1. Use ONE method to load fonts */
<head>
  <!-- Preconnect first -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- Single request with all weights -->
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}:wght@400;500;600;700&family=${encodeURIComponent(secondaryFont || 'Inter')}:wght@400;500&display=swap" rel="stylesheet">

  <!-- NO @import in CSS files -->
</head>

/* 2. For self-hosted: Consistent @font-face declarations */
/* fonts.css - single file, imported once */
@font-face {
  font-family: '${primaryFont}';
  font-weight: 400;
  src: url('/fonts/${primaryFont.toLowerCase().replace(/\s+/g, '-')}-400.woff2') format('woff2');
}

@font-face {
  font-family: '${primaryFont}';
  font-weight: 700;
  src: url('/fonts/${primaryFont.toLowerCase().replace(/\s+/g, '-')}-700.woff2') format('woff2');
}

/* 3. Preload EXACTLY what you declare */
<link rel="preload" href="/fonts/${primaryFont.toLowerCase().replace(/\s+/g, '-')}-400.woff2" as="font" type="font/woff2" crossorigin>

/* Checklist:
 * ✓ Only ONE method loads each font (link OR @import OR @font-face)
 * ✓ Preloaded files match @font-face src exactly
 * ✓ No duplicate weight declarations
 * ✓ Bundle service requests (Google Fonts combines families)
 */`,
      steps: [
        'Search codebase for all font loading: @import, <link>, @font-face, JavaScript',
        'List each unique font family and all sources loading it',
        'Choose ONE loading method per font (prefer <link> over @import)',
        'Combine multiple Google Fonts requests into single URL',
        'Ensure preloaded files match @font-face src URLs exactly',
        'Remove redundant declarations from CSS',
        'Use browser DevTools Network tab to verify no duplicate font requests',
        'Consider using a bundler plugin to deduplicate automatically'
      ]
    });

    // ========================================
    // 7. VARIABLE FONTS
    // ========================================
    const variableFontsAnalysis = advancedAnalysis.variableFonts || {};
    const hasVariableFonts = variableFontsAnalysis.fonts?.length > 0;

    fixes.push({
      id: `font-fix-${fixIndex++}`,
      title: hasVariableFonts
        ? 'Optimize variable font usage'
        : 'Consider variable fonts for weight flexibility',
      category: 'Modern Typography',
      severity: 'Low',
      description: hasVariableFonts
        ? 'Variable fonts detected! Ensure you\'re leveraging their full potential with CSS font-variation-settings and animation capabilities.'
        : `Using multiple weights of the same font family? Variable fonts bundle all weights into one file, often smaller than 2 static fonts combined.`,
      impact: 'Single file for all weights (saves 50-200KB), enables smooth weight animations, more design flexibility',
      problematicCode: `/* Static fonts: One file per weight */
@font-face {
  font-family: '${primaryFont}';
  font-weight: 400;
  src: url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}-regular.woff2');
}
@font-face {
  font-family: '${primaryFont}';
  font-weight: 500;
  src: url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}-medium.woff2');
}
@font-face {
  font-family: '${primaryFont}';
  font-weight: 600;
  src: url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}-semibold.woff2');
}
@font-face {
  font-family: '${primaryFont}';
  font-weight: 700;
  src: url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}-bold.woff2');
}
/* 4 files × ~30KB each = ~120KB total */`,
      fixedCode: `/* Variable font: One file, infinite weights */
@font-face {
  font-family: '${primaryFont} VF';
  font-display: swap;
  src: url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}-variable.woff2') format('woff2 supports variations'),
       url('${primaryFont.toLowerCase().replace(/\s+/g, '-')}-variable.woff2') format('woff2-variations');
  font-weight: 100 900;  /* Full weight range */
  font-stretch: 75% 125%; /* If width axis available */
}
/* 1 file × ~70KB = 70KB total (42% smaller!) */

/* Usage with CSS */
body {
  font-family: '${primaryFont} VF', sans-serif;
  font-weight: 400;
}

h1 {
  font-weight: 700;
}

/* Use ANY weight value, not just 100, 200, etc. */
.slightly-bold {
  font-weight: 550;  /* ✓ Only possible with variable fonts! */
}

/* Smooth weight animation on hover */
.animated-link {
  font-weight: 400;
  transition: font-weight 0.2s ease;
}
.animated-link:hover {
  font-weight: 600;
}

/* Access other axes with font-variation-settings */
.fancy-text {
  font-variation-settings:
    'wght' 600,    /* Weight */
    'wdth' 110,    /* Width */
    'slnt' -12;    /* Slant/Italic */
}

/* Popular variable fonts:
 * Inter, Roboto Flex, Source Sans 3, Open Sans,
 * Montserrat, Work Sans, Raleway, IBM Plex
 */`,
      steps: [
        'Check if your font has a variable version (Google Fonts, fonts.google.com)',
        'Download or link to the variable font file',
        'Update @font-face with font-weight range (e.g., 100 900)',
        'Use format("woff2 supports variations") for proper browser support',
        'Replace static weight values with variable font family',
        'Explore additional axes (width, slant, optical size) if available',
        'Remove old static font files to save space',
        'Test across browsers - variable fonts have 95%+ support'
      ]
    });

    // ========================================
    // 8. ACCESSIBILITY
    // ========================================
    const accessibilityAnalysis = advancedAnalysis.accessibility || {};
    const accessScore = accessibilityAnalysis.score || 70;

    fixes.push({
      id: `font-fix-${fixIndex++}`,
      title: `Improve font accessibility${accessScore < 80 ? ` (Score: ${accessScore}%)` : ''}`,
      category: 'Accessibility',
      severity: accessScore < 60 ? 'High' : 'Medium',
      description: 'Font choices significantly impact readability for users with visual impairments, dyslexia, and cognitive disabilities. WCAG guidelines provide minimum standards for text legibility.',
      impact: 'WCAG compliance, wider audience reach, improved readability for all users, reduced eye strain',
      problematicCode: `/* Common accessibility issues */

body {
  font-size: 12px;        /* ❌ Too small - minimum 16px for body */
  line-height: 1.2;       /* ❌ Too tight - minimum 1.5 for readability */
  letter-spacing: -0.5px; /* ❌ Negative tracking hurts readability */
}

p {
  font-size: 14px;
  max-width: none;        /* ❌ Lines too long - max 80 characters */
  text-align: justify;    /* ❌ Justified text creates uneven spacing */
}

.decorative-heading {
  font-family: 'Fancy Script Font', cursive;
  /* ❌ Decorative fonts hard to read for dyslexic users */
}

/* Missing relative units */
h1 { font-size: 32px; }   /* ❌ Doesn't scale with user preferences */`,
      fixedCode: `/* Accessible typography system */

:root {
  /* Base size that respects user preferences */
  font-size: 100%;  /* Usually 16px, but respects browser settings */
}

body {
  font-family: '${primaryFont}', -apple-system, sans-serif;
  font-size: 1rem;           /* ✓ 16px base, scales with user prefs */
  line-height: 1.6;          /* ✓ WCAG minimum is 1.5 */
  letter-spacing: 0.01em;    /* ✓ Slight positive tracking */
  word-spacing: 0.05em;      /* ✓ Helps word recognition */
}

p, li {
  max-width: 70ch;           /* ✓ Optimal line length (45-80 chars) */
  text-align: left;          /* ✓ Left-align for consistent spacing */
}

/* Relative font sizes that scale */
h1 { font-size: clamp(2rem, 5vw, 3.5rem); }
h2 { font-size: clamp(1.5rem, 4vw, 2.5rem); }
h3 { font-size: clamp(1.25rem, 3vw, 1.75rem); }
small { font-size: max(0.875rem, 14px); }  /* Never below 14px */

/* Ensure sufficient contrast and weight */
.body-text {
  font-weight: 400;         /* ✓ Regular weight for body */
  color: #1a1a2e;           /* ✓ High contrast (not pure black) */
}

/* Support user preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}

/* Respect user's font size preference */
@media (prefers-contrast: more) {
  body {
    font-weight: 500;       /* Bolder for high contrast mode */
  }
}

/* Dyslexia-friendly option */
.dyslexia-friendly {
  font-family: 'OpenDyslexic', 'Comic Sans MS', sans-serif;
  letter-spacing: 0.05em;
  word-spacing: 0.1em;
  line-height: 1.8;
}`,
      steps: [
        'Set base font-size to 100% (16px) to respect user preferences',
        'Use rem/em units for all font sizes, not px',
        'Ensure line-height is at least 1.5 (WCAG requirement)',
        'Limit line length to 45-80 characters (use max-width: 70ch)',
        'Use left-alignment, avoid justified text',
        'Ensure minimum font-size of 16px for body, 14px for small text',
        'Test with browser zoom at 200% - content should remain readable',
        'Consider offering a dyslexia-friendly font option'
      ]
    });

    // ========================================
    // 9. PERFORMANCE MONITORING
    // ========================================
    fixes.push({
      id: `font-fix-${fixIndex++}`,
      title: 'Implement font loading monitoring',
      category: 'Performance Monitoring',
      severity: 'Low',
      description: 'Monitor font loading performance in production to catch regressions and ensure optimal user experience. Track metrics like font load time, FOUT duration, and CLS from fonts.',
      impact: 'Catch performance regressions early, data-driven optimization decisions, ensure consistent user experience',
      problematicCode: `/* No visibility into font loading performance */

/* You might not know:
 * - How long fonts take to load for real users
 * - If font-related CLS is impacting Core Web Vitals
 * - Whether font CDN has regional performance issues
 * - If new font additions degraded performance
 */`,
      fixedCode: `/* Font loading performance monitoring */

/* 1. CSS Font Loading API for basic tracking */
<script>
if ('fonts' in document) {
  const fontLoadStart = performance.now();

  Promise.all([
    document.fonts.load('400 1rem "${primaryFont}"'),
    document.fonts.load('700 1rem "${primaryFont}"')
  ]).then(() => {
    const fontLoadTime = performance.now() - fontLoadStart;
    console.log('Fonts loaded in:', fontLoadTime, 'ms');

    // Send to analytics
    if (window.gtag) {
      gtag('event', 'font_load_time', {
        value: Math.round(fontLoadTime),
        event_category: 'Web Vitals'
      });
    }
  });
}
</script>

/* 2. Use Performance Observer for detailed metrics */
<script>
// Track font-related Largest Contentful Paint
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.element?.tagName === 'H1' || entry.element?.tagName === 'P') {
      console.log('LCP element:', entry.element.tagName);
      console.log('LCP time:', entry.startTime);
    }
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });

// Track Cumulative Layout Shift (font swaps cause CLS)
let clsValue = 0;
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) {
      clsValue += entry.value;
    }
  }
}).observe({ type: 'layout-shift', buffered: true });

// Report CLS on page unload
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    console.log('Final CLS:', clsValue);
    navigator.sendBeacon('/analytics', JSON.stringify({ cls: clsValue }));
  }
});
</script>

/* 3. Use web-vitals library for production */
<script type="module">
import { onCLS, onLCP, onFCP } from 'https://unpkg.com/web-vitals?module';

function sendToAnalytics(metric) {
  const body = JSON.stringify({ name: metric.name, value: metric.value });
  navigator.sendBeacon('/analytics', body);
}

onCLS(sendToAnalytics);  // Font swaps impact CLS
onLCP(sendToAnalytics);  // Font loading impacts LCP
onFCP(sendToAnalytics);  // Font loading impacts FCP
</script>

/* 4. Server-side: Log font requests */
// nginx config
log_format fonts '$remote_addr - $request_time - $request_uri';
access_log /var/log/nginx/fonts.log fonts if=$is_font_request;`,
      steps: [
        'Add CSS Font Loading API tracking for basic timing',
        'Implement Performance Observer for LCP and CLS metrics',
        'Use the web-vitals library for production-ready monitoring',
        'Send metrics to your analytics platform (GA4, custom backend)',
        'Set up alerts for font load time > 500ms',
        'Monitor CLS specifically from font swaps',
        'Track metrics by geographic region and connection type',
        'Review font performance weekly in your analytics dashboard'
      ]
    });

    return fixes;
  }

  function renderFontsFixAccordion(fix, index) {
    const accordionId = `fontsfix-${fix.id || index}`;
    const severityColors = {
      High: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
      Medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
      Low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
    };
    const style = severityColors[fix.severity] || severityColors.Medium;

    return `
      <div class="fonts-fix-accordion" data-fix-id="${accordionId}" style="
        border: 1px solid ${style.border}33;
        border-radius: 12px;
        margin-bottom: 1rem;
        overflow: hidden;
        background: ${style.bg};
      ">
        <div class="fonts-fix-header" onclick="toggleFontsFixAccordion('${accordionId}')" style="
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
              <h4 style="margin: 0; font-size: 1rem; color: #fff;">${fix.title}</h4>
              <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">${fix.category || 'Font Optimization'}</p>
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
            ">${fix.severity.toUpperCase()}</span>
            <span class="fonts-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
          </div>
        </div>

        <div class="fonts-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
          <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
            ${renderFontsFixTabs(fix, accordionId)}
          </div>
        </div>
      </div>
    `;
  }

  function renderFontsFixTabs(fix, accordionId) {
    return `
      <div class="fonts-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
        <button class="fonts-fix-tab active" onclick="switchFontsFixTab('${accordionId}', 'summary')" style="
          padding: 0.5rem 1rem;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          background: rgba(255,255,255,0.1);
          color: #fff;
          cursor: pointer;
          font-size: 0.85rem;
        ">📋 Summary</button>
        <button class="fonts-fix-tab" onclick="switchFontsFixTab('${accordionId}', 'code')" style="
          padding: 0.5rem 1rem;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          background: transparent;
          color: #aaa;
          cursor: pointer;
          font-size: 0.85rem;
        ">💻 Code</button>
        <button class="fonts-fix-tab" onclick="switchFontsFixTab('${accordionId}', 'guide')" style="
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
      <div class="fonts-fix-tab-content active" id="${accordionId}-summary">
        <p style="color: #ccc; line-height: 1.7; margin: 0 0 1rem 0;">
          ${fix.description}
        </p>
        <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
          <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ Expected Impact</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">${fix.impact}</div>
        </div>
      </div>

      <!-- Code Tab -->
      <div class="fonts-fix-tab-content" id="${accordionId}-code" style="display: none;">
        <div style="display: grid; gap: 1rem;">
          <!-- Current Issue -->
          <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
              <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ Current Issue</span>
              <button onclick="copyFontsCode('${accordionId}-problem')" style="
                padding: 0.25rem 0.75rem;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.05);
                color: #fff;
                cursor: pointer;
                font-size: 0.75rem;
              ">📋 Copy</button>
            </div>
            <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeFontsHtml(fix.problematicCode || '<!-- Missing or incorrect implementation -->')}</pre>
          </div>

          <!-- Fixed Code -->
          <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
              <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ Recommended Fix</span>
              <button onclick="copyFontsCode('${accordionId}-solution')" style="
                padding: 0.25rem 0.75rem;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.05);
                color: #fff;
                cursor: pointer;
                font-size: 0.75rem;
              ">📋 Copy</button>
            </div>
            <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeFontsHtml(fix.fixedCode || '')}</pre>
          </div>
        </div>
      </div>

      <!-- Fix Guide Tab -->
      <div class="fonts-fix-tab-content" id="${accordionId}-guide" style="display: none;">
        <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
        <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
          ${(fix.steps || ['Review current implementation', 'Apply the recommended fix', 'Test and verify changes']).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
        </ol>
      </div>
    `;
  }

  function escapeFontsHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureFontsFixStyles() {
    if (document.getElementById('fonts-fix-styles')) return;
    const style = document.createElement('style');
    style.id = 'fonts-fix-styles';
    style.textContent = `
      .fonts-fix-header:hover {
        background: rgba(255,255,255,0.03);
      }
      .fonts-fix-accordion.expanded .fonts-fix-expand-icon {
        transform: rotate(180deg);
      }
      .fonts-fix-tab:hover {
        background: rgba(255,255,255,0.05) !important;
      }
      .fonts-fix-tab.active {
        background: rgba(255,255,255,0.1) !important;
        border-color: rgba(255,255,255,0.2) !important;
        color: #fff !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  // ============================================
  // CALCULATE ADVANCED ANALYSIS SCORE
  // ============================================
  function calculateAdvancedScore(advancedAnalysis) {
    if (!advancedAnalysis || Object.keys(advancedAnalysis).length === 0) return null;
    
    const scores = [];
    if (advancedAnalysis.formats?.summary?.woff2Percentage !== undefined) {
      scores.push(advancedAnalysis.formats.summary.woff2Percentage);
    }
    if (advancedAnalysis.fontDisplay?.summary?.score !== undefined) {
      scores.push(advancedAnalysis.fontDisplay.summary.score);
    }
    if (advancedAnalysis.accessibility?.score !== undefined) {
      scores.push(advancedAnalysis.accessibility.score);
    }
    if (advancedAnalysis.fallbackStacks?.summary?.score !== undefined) {
      scores.push(advancedAnalysis.fallbackStacks.summary.score);
    }
    if (advancedAnalysis.clsRisk?.score !== undefined) {
      scores.push(advancedAnalysis.clsRisk.score);
    }
    
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  
  // ============================================
  // ADVANCED ANALYSIS CONTENT GENERATOR
  // ============================================
  function generateAdvancedAnalysisContent(advancedAnalysis, fonts) {
    if (!advancedAnalysis || Object.keys(advancedAnalysis).length === 0) {
      return '<p style="color: #888;">Advanced analysis not available. Run a full scan for detailed typography insights.</p>';
    }
    
    const { formats, fontDisplay, accessibility, fallbackStacks, variableFonts, clsRisk } = advancedAnalysis;
    
    return `
      <!-- Font Format Analysis -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41;">
          >> Font Format Analysis
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${getRecommendationColor(formats?.summary?.recommendation)}; color: white;">
            ${formats?.summary?.recommendation || 'N/A'}
          </span>
        </h4>
        ${formats ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 0.75rem; margin-bottom: 1rem;">
            <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #10b981;">${formats.summary.woff2Count}</div>
              <div style="font-size: 0.75rem; color: #888;">WOFF2</div>
            </div>
            <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #4285f4;">${formats.formats.woff.length}</div>
              <div style="font-size: 0.75rem; color: #888;">WOFF</div>
            </div>
            <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #f59e0b;">${formats.formats.ttf.length + formats.formats.otf.length}</div>
              <div style="font-size: 0.75rem; color: #888;">TTF/OTF</div>
            </div>
            <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${formats.summary.woff2Percentage >= 80 ? '#10b981' : '#f59e0b'};">${formats.summary.woff2Percentage}%</div>
              <div style="font-size: 0.75rem; color: #888;">Modern</div>
            </div>
          </div>
          ${formats.summary.hasLegacyFormats ? `
            <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              Legacy formats detected (EOT/SVG). Consider removing for smaller bundles.
            </div>
          ` : ''}
        ` : '<p style="color: #666;">Format data not available</p>'}
      </div>
      
      <!-- font-display Audit -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41;">
          >> font-display Audit
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${getRecommendationColor(fontDisplay?.summary?.recommendation)}; color: white;">
            ${fontDisplay?.summary?.score || 0}/100
          </span>
        </h4>
        ${fontDisplay ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 0.5rem; margin-bottom: 1rem;">
            ${fontDisplay.values.swap.length > 0 ? `
              <div style="text-align: center; padding: 0.5rem; background: rgba(16, 185, 129, 0.1); border-radius: 6px;">
                <div style="font-weight: bold; color: #10b981;">${fontDisplay.values.swap.length}</div>
                <div style="font-size: 0.7rem; color: #888;">swap</div>
              </div>
            ` : ''}
            ${fontDisplay.values.optional.length > 0 ? `
              <div style="text-align: center; padding: 0.5rem; background: rgba(16, 185, 129, 0.1); border-radius: 6px;">
                <div style="font-weight: bold; color: #10b981;">${fontDisplay.values.optional.length}</div>
                <div style="font-size: 0.7rem; color: #888;">optional</div>
              </div>
            ` : ''}
            ${fontDisplay.values.fallback.length > 0 ? `
              <div style="text-align: center; padding: 0.5rem; background: rgba(66, 133, 244, 0.1); border-radius: 6px;">
                <div style="font-weight: bold; color: #4285f4;">${fontDisplay.values.fallback.length}</div>
                <div style="font-size: 0.7rem; color: #888;">fallback</div>
              </div>
            ` : ''}
            ${fontDisplay.values.block.length > 0 ? `
              <div style="text-align: center; padding: 0.5rem; background: rgba(239, 68, 68, 0.1); border-radius: 6px;">
                <div style="font-weight: bold; color: #ef4444;">${fontDisplay.values.block.length}</div>
                <div style="font-size: 0.7rem; color: #888;">block</div>
              </div>
            ` : ''}
            ${fontDisplay.values.auto.length + fontDisplay.values.notSet.length > 0 ? `
              <div style="text-align: center; padding: 0.5rem; background: rgba(245, 158, 11, 0.1); border-radius: 6px;">
                <div style="font-weight: bold; color: #f59e0b;">${fontDisplay.values.auto.length + fontDisplay.values.notSet.length}</div>
                <div style="font-size: 0.7rem; color: #888;">auto/none</div>
              </div>
            ` : ''}
          </div>
          ${fontDisplay.summary.problematicCount > 0 ? `
            <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              Add <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px;">font-display: swap</code> to prevent Flash of Invisible Text (FOIT)
            </div>
          ` : `
            <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              All fonts use optimal font-display values
            </div>
          `}
        ` : '<p style="color: #666;">font-display data not available</p>'}
      </div>
      
      <!-- Typography Accessibility -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41;">
          >> Typography Accessibility
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${getRecommendationColor(accessibility?.summary?.recommendation)}; color: white;">
            ${accessibility?.score || 0}/100
          </span>
        </h4>
        ${accessibility ? `
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${accessibility.passed.map(item => `
              <div style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.5rem; background: rgba(16, 185, 129, 0.05); border-radius: 6px;">
                <span style="color: #10b981;">✓</span>
                <div>
                  <div style="font-weight: 500;">${item.title}</div>
                  <div style="font-size: 0.8rem; color: #888;">${item.detail}</div>
                </div>
              </div>
            `).join('')}
            ${accessibility.issues.map(item => `
              <div style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.5rem; background: rgba(${item.type === 'warning' ? '245, 158, 11' : '239, 68, 68'}, 0.05); border-radius: 6px;">
                <span style="color: ${item.type === 'warning' ? '#f59e0b' : '#ef4444'};">${item.type === 'warning' ? '~' : '✗'}</span>
                <div>
                  <div style="font-weight: 500;">${item.title}</div>
                  <div style="font-size: 0.8rem; color: #888;">${item.detail}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p style="color: #666;">Accessibility data not available</p>'}
      </div>
      
      <!-- Fallback Stack Quality -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41;">
          >> Fallback Stack Quality
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${getRecommendationColor(fallbackStacks?.summary?.recommendation)}; color: white;">
            ${fallbackStacks?.summary?.score || 0}/100
          </span>
        </h4>
        ${fallbackStacks && fallbackStacks.stacks.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
            <span style="padding: 0.25rem 0.5rem; background: rgba(16, 185, 129, 0.2); border-radius: 4px; font-size: 0.75rem;">
              Excellent: ${fallbackStacks.summary.excellent}
            </span>
            <span style="padding: 0.25rem 0.5rem; background: rgba(66, 133, 244, 0.2); border-radius: 4px; font-size: 0.75rem;">
              Good: ${fallbackStacks.summary.good}
            </span>
            <span style="padding: 0.25rem 0.5rem; background: rgba(239, 68, 68, 0.2); border-radius: 4px; font-size: 0.75rem;">
              Poor: ${fallbackStacks.summary.poor}
            </span>
          </div>
          ${fallbackStacks.stacks.filter(s => s.quality === 'poor').slice(0, 3).map(stack => `
            <div style="background: rgba(239, 68, 68, 0.05); border-left: 4px solid #ef4444; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              <div style="font-family: monospace; font-size: 0.8rem; margin-bottom: 0.25rem; word-break: break-all;">${stack.stack}</div>
              <div style="color: #888;">${stack.recommendation}</div>
            </div>
          `).join('')}
        ` : '<p style="color: #666;">Fallback stack data not available</p>'}
      </div>
      
      <!-- Variable Fonts Detection -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41;">
          >> Variable Fonts
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${variableFonts?.hasVariableFonts ? '#10b981' : '#6b7280'}; color: white;">
            ${variableFonts?.variableFonts?.length || 0} detected
          </span>
        </h4>
        ${variableFonts ? `
          ${variableFonts.hasVariableFonts ? `
            <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem; margin-bottom: 0.75rem;">
              Using variable fonts! This reduces HTTP requests and enables smooth weight/width transitions.
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${variableFonts.variableFonts.map(vf => `
                <span style="padding: 0.25rem 0.75rem; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 20px; font-size: 0.8rem;">
                  ${vf.fontFamily}
                </span>
              `).join('')}
            </div>
          ` : `
            <div style="background: rgba(66, 133, 244, 0.1); border-left: 4px solid #4285f4; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              ${variableFonts.potentialSavings || 'Consider using variable fonts for more flexible typography with fewer files.'}
            </div>
          `}
        ` : '<p style="color: #666;">Variable font data not available</p>'}
      </div>
      
      <!-- CLS Risk Score -->
      <div style="margin-bottom: 1rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41;">
          >> Layout Shift Risk (CLS)
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${clsRisk?.level === 'low' ? '#10b981' : clsRisk?.level === 'medium' ? '#f59e0b' : '#ef4444'}; color: white;">
            ${clsRisk?.level || 'N/A'}
          </span>
        </h4>
        ${clsRisk ? `
          ${clsRisk.risks.length === 0 ? `
            <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              Low risk of font-related layout shifts. Good font-display and fallback configuration.
            </div>
          ` : `
            ${clsRisk.risks.map(risk => `
              <div style="background: rgba(${risk.type === 'high' ? '239, 68, 68' : '245, 158, 11'}, 0.1); border-left: 4px solid ${risk.type === 'high' ? '#ef4444' : '#f59e0b'}; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
                <div style="font-weight: 500; margin-bottom: 0.25rem;">${risk.title}</div>
                <div style="color: #888;">${risk.detail}</div>
              </div>
            `).join('')}
          `}
        ` : '<p style="color: #666;">CLS risk data not available</p>'}
      </div>
    `;
  }
  
  function getRecommendationColor(recommendation) {
    switch (recommendation) {
      case 'excellent': return '#10b981';
      case 'good': return '#4285f4';
      case 'needs-improvement': return '#f59e0b';
      default: return '#6b7280';
    }
  }
  
  // ============================================
  // STICKY ALERT GENERATOR
  // ============================================
  function generateStickyAlert(totalIssues, data) {
    if (totalIssues === 0) {
      return `
        <div class="sticky-alert success" role="alert">
          <div>
            <strong>Excellent Font Health!</strong>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; opacity: 0.8;">No critical font issues detected. Your typography is well-optimized.</p>
          </div>
        </div>
      `;
    }
    
    const hasCritical = data.summary.displayIssueCount > 0 || data.summary.duplicateCount > 0;
    
    return `
      <div class="sticky-alert ${hasCritical ? 'critical' : 'warning'}" role="alert">
        <div style="flex: 1;">
          <strong>${totalIssues} Issue${totalIssues > 1 ? 's' : ''} Found</strong>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; opacity: 0.8;">
            ${data.summary.duplicateCount > 0 ? `${data.summary.duplicateCount} duplicate${data.summary.duplicateCount > 1 ? 's' : ''} • ` : ''}
            ${data.summary.displayIssueCount > 0 ? `${data.summary.displayIssueCount} display issue${data.summary.displayIssueCount > 1 ? 's' : ''} • ` : ''}
            ${data.summary.preloadIssueCount > 0 ? `${data.summary.preloadIssueCount} preload opportunit${data.summary.preloadIssueCount > 1 ? 'ies' : 'y'}` : ''}
          </p>
        </div>
      </div>
    `;
  }

  // ============================================
  // OVERVIEW SECTION (SEO-style design pattern)
  // ============================================
  function generateOverviewSection(data, totalIssues, hasFullScan, fonts, performance, bestPractices, screenshot) {
    const healthScore = data.healthScore || 0;
    const familyScore = Math.min(100, Math.max(0, 100 - (data.summary.totalFamilies - 3) * 10));
    const duplicateScore = data.summary.duplicateCount === 0 ? 100 : Math.max(0, 100 - data.summary.duplicateCount * 20);
    const displayScore = data.summary.displayIssueCount === 0 ? 100 : Math.max(0, 100 - data.summary.displayIssueCount * 15);
    
    return `
      <div class="section">
        <h2>Font Analysis Results</h2>
        <p>>> url: ${data.url || 'N/A'}</p>
        <p>>> timestamp: ${new Date(data.analyzedAt).toLocaleString()}</p>
        
        <h3 style="color: #00ff41; margin: 1.5rem 0 1rem 0; font-size: 1.3rem;">>> Font Health Summary</h3>
        
        <!-- Circular Progress Dials -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 2rem; margin: 2rem 0;">
          <!-- Overall Score -->
          <div style="text-align: center;">
            <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Font Health Score</div>
            <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10"/>
              <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor(healthScore)}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(healthScore / 100) * 471.24} 471.24" transform="rotate(-90 90 90)"/>
              <text x="90" y="90" text-anchor="middle" dy="0.35em" font-size="3.5rem" font-weight="bold" fill="#f9fff2" stroke="rgba(0, 0, 0, 0.65)" stroke-width="2.5" paint-order="stroke fill" style="text-shadow: 0 0 18px ${getScoreColor(healthScore)}, 0 0 30px rgba(0,0,0,0.6);">${healthScore}</text>
            </svg>
            <div style="margin-top: 0.5rem; color: ${getScoreColor(healthScore)}; font-weight: 600; font-size: 1.1rem;">${healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Work'}</div>
          </div>
          
          <!-- Font Families -->
          <div style="text-align: center;">
            <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Font Families</div>
            <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10"/>
              <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor(familyScore)}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(familyScore / 100) * 471.24} 471.24" transform="rotate(-90 90 90)"/>
              <text x="90" y="90" text-anchor="middle" dy="0.35em" font-size="3.5rem" font-weight="bold" fill="#f9fff2" stroke="rgba(0, 0, 0, 0.65)" stroke-width="2.5" paint-order="stroke fill" style="text-shadow: 0 0 18px ${getScoreColor(familyScore)}, 0 0 30px rgba(0,0,0,0.6);">${data.summary.totalFamilies}</text>
            </svg>
            <div style="margin-top: 0.5rem; color: ${getScoreColor(familyScore)}; font-weight: 600; font-size: 1.1rem;">${data.summary.totalFamilies <= 3 ? 'Optimal' : data.summary.totalFamilies <= 5 ? 'Acceptable' : 'Too Many'}</div>
          </div>
          
          <!-- Duplicates -->
          <div style="text-align: center;">
            <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Duplicates</div>
            <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10"/>
              <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor(duplicateScore)}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(duplicateScore / 100) * 471.24} 471.24" transform="rotate(-90 90 90)"/>
              <text x="90" y="90" text-anchor="middle" dy="0.35em" font-size="3.5rem" font-weight="bold" fill="#f9fff2" stroke="rgba(0, 0, 0, 0.65)" stroke-width="2.5" paint-order="stroke fill" style="text-shadow: 0 0 18px ${getScoreColor(duplicateScore)}, 0 0 30px rgba(0,0,0,0.6);">${data.summary.duplicateCount}</text>
            </svg>
            <div style="margin-top: 0.5rem; color: ${getScoreColor(duplicateScore)}; font-weight: 600; font-size: 1.1rem;">${data.summary.duplicateCount === 0 ? 'None Found' : 'Issues Found'}</div>
          </div>
          
          <!-- Display Issues -->
          <div style="text-align: center;">
            <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Display Issues</div>
            <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10"/>
              <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor(displayScore)}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(displayScore / 100) * 471.24} 471.24" transform="rotate(-90 90 90)"/>
              <text x="90" y="90" text-anchor="middle" dy="0.35em" font-size="3.5rem" font-weight="bold" fill="#f9fff2" stroke="rgba(0, 0, 0, 0.65)" stroke-width="2.5" paint-order="stroke fill" style="text-shadow: 0 0 18px ${getScoreColor(displayScore)}, 0 0 30px rgba(0,0,0,0.6);">${data.summary.displayIssueCount}</text>
            </svg>
            <div style="margin-top: 0.5rem; color: ${getScoreColor(displayScore)}; font-weight: 600; font-size: 1.1rem;">${data.summary.displayIssueCount === 0 ? 'All Good' : 'Needs Fix'}</div>
          </div>
        </div>
      </div>
      
      <!-- Charts Row -->
      <h3 style="color: #00ff41; margin: 1.5rem 0 1rem 0; font-size: 1.1rem;">>> Font Distribution</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 1rem;">
        <div class="chart-container">
          <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #c0c0c0;">Provider Distribution</h4>
          <canvas id="providerChart"></canvas>
        </div>
        <div class="chart-container">
          <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #c0c0c0;">Font Weight Usage</h4>
          <canvas id="weightChart"></canvas>
        </div>
      </div>
      
      <!-- Screenshot Preview -->
      ${screenshot ? `
        <h3 style="color: #00ff41; margin: 1.5rem 0 1rem 0; font-size: 1.1rem;">>> Page Preview</h3>
        <div style="margin-bottom: 1rem;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
            <img src="${screenshot}" alt="Website screenshot" style="max-width: 100%; max-height: 300px; border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);" loading="lazy" />
          </div>
        </div>
      ` : ''}
    `;
  }

  // ============================================
  // FONTS ACCORDION CONTENT
  // ============================================
  function generateFontsAccordionContent(data, fonts, hasFullScan) {
    return `
      ${data.families.length === 0 ? '<p style="color: #666;">No font families detected.</p>' : ''}
      ${data.families.map(family => `
        <div class="font-card">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <strong style="font-size: 1.1rem;">${family.name}</strong>
              ${isDuplicate(family.name, data.issues.duplicates) ? '<span class="issue-badge issue-duplicate">DUPLICATE</span>' : ''}
              ${hasDisplayIssue(family.name, data.issues.displayIssues) ? '<span class="issue-badge issue-display">NO DISPLAY</span>' : ''}
            </div>
            <div style="color: #666; font-size: 0.8rem;">
              ${family.variants?.length || 0} variant(s)
            </div>
          </div>
          <!-- Font Preview -->
          <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="font-family: '${family.name}', sans-serif; font-size: 2.5rem; line-height: 1.3; letter-spacing: 0.01em;">
              The quick brown fox jumps over the lazy dog
            </div>
            <div style="font-family: '${family.name}', sans-serif; font-size: 2.5rem; line-height: 1.3; margin-top: 0.75rem; letter-spacing: 0.02em;">
              0123456789
            </div>
            <div style="font-family: '${family.name}', sans-serif; font-size: 2rem; line-height: 1.3; margin-top: 0.5rem; letter-spacing: 0.05em; color: #888;">
              !@#$%^&amp;*()_+-=[]{}|;':",./&lt;&gt;?
            </div>
          </div>
          ${family.variants && family.variants.length > 0 ? `
            <div style="margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${family.variants.slice(0, 10).map(v => `
                <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 3px; font-size: 0.75rem; color: #888;">${v.weight || v}${v.style && v.style !== 'normal' ? ' ' + v.style : ''}</span>
              `).join('')}
              ${family.variants.length > 10 ? `<span style="color: #666; font-size: 0.75rem;">+${family.variants.length - 10} more</span>` : ''}
            </div>
          ` : ''}
        </div>
      `).join('')}
      
      <!-- Categorized Fonts (from full scan) -->
      ${hasFullScan && fonts.categorizedFonts ? `
        <div style="margin-top: 1.5rem;">
          <h4 style="margin-bottom: 1rem; color: #00ff41;">>> Font Categories</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
            ${fonts.categorizedFonts.googleFonts?.length > 0 ? `
              <div style="background: rgba(66, 133, 244, 0.1); border: 1px solid rgba(66, 133, 244, 0.3); border-radius: 8px; padding: 1rem;">
                <div style="font-weight: 600; color: #4285f4; margin-bottom: 0.5rem;">Google (${fonts.categorizedFonts.googleFonts.length})</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                  ${fonts.categorizedFonts.googleFonts.slice(0, 3).map(f => `<span style="background: rgba(66, 133, 244, 0.2); padding: 2px 6px; border-radius: 3px; font-size: 0.75rem;">${f.fontFamily || f.name || f}</span>`).join('')}
                </div>
              </div>
            ` : ''}
            ${fonts.categorizedFonts.system?.length > 0 ? `
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 1rem;">
                <div style="font-weight: 600; color: #10b981; margin-bottom: 0.5rem;">System (${fonts.categorizedFonts.system.length})</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                  ${fonts.categorizedFonts.system.slice(0, 3).map(f => `<span style="background: rgba(16, 185, 129, 0.2); padding: 2px 6px; border-radius: 3px; font-size: 0.75rem;">${f.fontFamily || f.name || f}</span>`).join('')}
                </div>
              </div>
            ` : ''}
            ${fonts.categorizedFonts.iconFonts?.length > 0 ? `
              <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 1rem;">
                <div style="font-weight: 600; color: #f59e0b; margin-bottom: 0.5rem;">Icons (${fonts.categorizedFonts.iconFonts.length})</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                  ${fonts.categorizedFonts.iconFonts.slice(0, 3).map(f => `<span style="background: rgba(245, 158, 11, 0.2); padding: 2px 6px; border-radius: 3px; font-size: 0.75rem;">${f.fontFamily || f.name || f}</span>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
    `;
  }

  // ============================================
  // PROVIDERS ACCORDION CONTENT (LEGACY)
  // ============================================
  function generateProvidersAccordionContent(data) {
    if (data.providers.length === 0) {
      return '<p style="color: #666;">No external font providers detected (fonts may be self-hosted).</p>';
    }

    return data.providers.map(provider => {
      // Normalize families - handle both string arrays and object arrays with .name property
      const families = (provider.families || []).map(f =>
        typeof f === 'string' ? f : (f && f.name ? f.name : String(f))
      );
      const familyCount = families.length;
      const familyText = familyCount === 1 ? '1 family' : `${familyCount} families`;

      // For icon fonts like Font Awesome, show a note if no families detected
      const isIconFont = provider.name.toLowerCase().includes('awesome') ||
                         provider.name.toLowerCase().includes('icon');
      const noFamiliesNote = familyCount === 0 && isIconFont
        ? '<span style="color: #888; font-style: italic;">Icon font library</span>'
        : '';

      return `
        <div class="font-card">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span class="provider-badge provider-${getProviderClass(provider.name)}">${provider.name}</span>
              <span style="color: #888;">${familyText}</span>
            </div>
          </div>
          <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${families.length > 0
              ? families.map(f => `
                  <span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">${f}</span>
                `).join('')
              : noFamiliesNote
            }
          </div>
        </div>
      `;
    }).join('');
  }

  // ============================================
  // PROVIDERS WITH EVIDENCE BLOCKS (NEW)
  // ============================================
  function generateProvidersWithEvidence(data) {
    if (data.providers.length === 0) {
      return `
        <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 1rem; border-radius: 0 8px 8px 0;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span style="color: #10b981; font-size: 1.25rem;">✓</span>
            <strong style="color: #10b981;">Self-Hosted Fonts</strong>
          </div>
          <p style="color: #86efac; margin: 0; font-size: 0.9rem;">No external font providers detected. Fonts appear to be self-hosted, which provides better privacy and performance control.</p>
        </div>
      `;
    }

    return data.providers.map(provider => {
      const families = (provider.families || []).map(f =>
        typeof f === 'string' ? f : (f && f.name ? f.name : String(f))
      );
      const familyCount = families.length;
      const isIconFont = provider.name.toLowerCase().includes('awesome') || provider.name.toLowerCase().includes('icon');

      // Determine provider color scheme
      const providerColors = {
        'Google Fonts': { bg: 'rgba(66, 133, 244, 0.1)', border: '#4285f4', text: '#4285f4' },
        'Adobe Fonts': { bg: 'rgba(255, 0, 0, 0.1)', border: '#ff0000', text: '#ff4444' },
        'Font Awesome': { bg: 'rgba(52, 152, 219, 0.1)', border: '#3498db', text: '#3498db' },
        'Bunny Fonts': { bg: 'rgba(255, 165, 0, 0.1)', border: '#ffa500', text: '#ffa500' },
        'Self-Hosted': { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#10b981' }
      };
      const colors = providerColors[provider.name] || { bg: 'rgba(139, 92, 246, 0.1)', border: '#8b5cf6', text: '#8b5cf6' };

      // Generate evidence code snippet
      let codeSnippet = '';
      if (provider.url) {
        if (provider.type === 'link') {
          codeSnippet = `&lt;link href="${escapeHtmlForProviders(provider.url.substring(0, 80))}${provider.url.length > 80 ? '...' : ''}" rel="stylesheet"&gt;`;
        } else if (provider.type === '@import') {
          codeSnippet = `@import url('${escapeHtmlForProviders(provider.url.substring(0, 60))}${provider.url.length > 60 ? '...' : ''}');`;
        } else if (provider.type === 'script') {
          codeSnippet = `&lt;script src="${escapeHtmlForProviders(provider.url.substring(0, 70))}${provider.url.length > 70 ? '...' : ''}"&gt;&lt;/script&gt;`;
        }
      } else if (provider.type === '@font-face') {
        codeSnippet = `@font-face { font-family: '${families[0] || 'CustomFont'}'; src: url('/fonts/...'); }`;
      }

      return `
        <div class="font-card" style="border-left: 4px solid ${colors.border}; background: ${colors.bg};">
          <!-- Provider Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span class="provider-badge provider-${getProviderClass(provider.name)}">${provider.name}</span>
              <span style="color: #888; font-size: 0.85rem;">${familyCount} ${familyCount === 1 ? 'family' : 'families'}</span>
            </div>
            <span style="padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.7rem; font-weight: 600; background: ${colors.bg}; color: ${colors.text}; border: 1px solid ${colors.border}40; text-transform: uppercase;">
              ${provider.type || 'external'}
            </span>
          </div>

          <!-- Font Families -->
          ${families.length > 0 ? `
            <div style="margin-bottom: 1rem;">
              <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Font Families</div>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${families.map(f => `
                  <span style="background: rgba(255,255,255,0.1); padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.85rem; font-weight: 500;">${f}</span>
                `).join('')}
              </div>
            </div>
          ` : isIconFont ? `
            <div style="margin-bottom: 1rem; color: #888; font-style: italic; font-size: 0.85rem;">
              Icon font library (families loaded dynamically)
            </div>
          ` : ''}

          <!-- Evidence Code Block -->
          ${codeSnippet ? `
            <div style="margin-top: 0.75rem;">
              <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Evidence</div>
              <div style="background: rgba(0,0,0,0.4); border-radius: 6px; padding: 0.75rem; overflow-x: auto;">
                <code style="font-size: 0.8rem; color: #e0e0e0; white-space: nowrap;">${codeSnippet}</code>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function escapeHtmlForProviders(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ============================================
  // FONT DELIVERY CONTENT (NEW TAB)
  // ============================================
  function generateFontDeliveryContent(fontDelivery, data, advancedAnalysis) {
    // Use advancedAnalysis formats as fallback if network data wasn't captured
    const fallbackFormats = advancedAnalysis?.formats?.summary || {};
    const hasNetworkData = fontDelivery && fontDelivery.totalRequests > 0;

    const { requests, totalBytesKB, totalRequests, averageLoadTime, preconnects, preloads, formats, modernFormatPercentage, score } = fontDelivery || {};

    // Use fallback data if network data wasn't captured
    const displayModernPercentage = hasNetworkData ? modernFormatPercentage : (fallbackFormats.woff2Percentage || 0);
    const displayScore = hasNetworkData ? score : (fallbackFormats.woff2Percentage >= 80 ? 90 : fallbackFormats.woff2Percentage >= 50 ? 70 : 50);

    // Score color
    const scoreColor = displayScore >= 80 ? '#10b981' : displayScore >= 60 ? '#f59e0b' : '#ef4444';

    return `
      <!-- Delivery Score -->
      <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1.5rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 12px;">
        <div style="text-align: center;">
          <div style="font-size: 2.5rem; font-weight: bold; color: ${scoreColor}; line-height: 1;">${displayScore || 0}</div>
          <div style="font-size: 0.75rem; color: #888; margin-top: 0.25rem;">Delivery Score</div>
        </div>
        <div style="flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 1rem;">
          ${hasNetworkData ? `
            <div style="text-align: center; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <div style="font-size: 1.25rem; font-weight: 600; color: #fff;">${totalRequests || 0}</div>
              <div style="font-size: 0.7rem; color: #888;">Font Files</div>
            </div>
            <div style="text-align: center; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <div style="font-size: 1.25rem; font-weight: 600; color: #fff;">${totalBytesKB || '0'}KB</div>
              <div style="font-size: 0.7rem; color: #888;">Total Size</div>
            </div>
            <div style="text-align: center; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <div style="font-size: 1.25rem; font-weight: 600; color: #fff;">${averageLoadTime || 0}ms</div>
              <div style="font-size: 0.7rem; color: #888;">Avg Load</div>
            </div>
          ` : `
            <div style="text-align: center; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <div style="font-size: 1.25rem; font-weight: 600; color: #fff;">${fallbackFormats.total || data?.families?.length || 0}</div>
              <div style="font-size: 0.7rem; color: #888;">Font Faces</div>
            </div>
            <div style="text-align: center; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <div style="font-size: 1.25rem; font-weight: 600; color: #fff;">${fallbackFormats.woff2 || 0}</div>
              <div style="font-size: 0.7rem; color: #888;">WOFF2</div>
            </div>
            <div style="text-align: center; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <div style="font-size: 1.25rem; font-weight: 600; color: #fff;">${(fallbackFormats.woff || 0) + (fallbackFormats.ttf || 0)}</div>
              <div style="font-size: 0.7rem; color: #888;">Other</div>
            </div>
          `}
          <div style="text-align: center; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
            <div style="font-size: 1.25rem; font-weight: 600; color: ${displayModernPercentage >= 80 ? '#10b981' : '#f59e0b'};">${displayModernPercentage || 0}%</div>
            <div style="font-size: 0.7rem; color: #888;">Modern</div>
          </div>
        </div>
      </div>
      ${!hasNetworkData ? `
        <div style="background: rgba(66, 133, 244, 0.1); border-left: 4px solid #4285f4; padding: 0.75rem; border-radius: 0 6px 6px 0; margin-bottom: 1.5rem; font-size: 0.85rem;">
          <span style="color: #93c5fd;">Network timing data from CSS analysis. Individual font file metrics require network interception.</span>
        </div>
      ` : ''}

      <!-- Format Distribution -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41; font-size: 0.95rem;">
          >> Font Formats
        </h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
          ${formats?.woff2 > 0 ? `<div style="padding: 0.5rem 1rem; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px;"><span style="font-weight: 600; color: #10b981;">${formats.woff2}</span> <span style="color: #86efac; font-size: 0.85rem;">WOFF2</span></div>` : ''}
          ${formats?.woff > 0 ? `<div style="padding: 0.5rem 1rem; background: rgba(66, 133, 244, 0.15); border: 1px solid rgba(66, 133, 244, 0.3); border-radius: 8px;"><span style="font-weight: 600; color: #4285f4;">${formats.woff}</span> <span style="color: #93c5fd; font-size: 0.85rem;">WOFF</span></div>` : ''}
          ${formats?.ttf > 0 ? `<div style="padding: 0.5rem 1rem; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px;"><span style="font-weight: 600; color: #f59e0b;">${formats.ttf}</span> <span style="color: #fcd34d; font-size: 0.85rem;">TTF</span></div>` : ''}
          ${formats?.otf > 0 ? `<div style="padding: 0.5rem 1rem; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px;"><span style="font-weight: 600; color: #f59e0b;">${formats.otf}</span> <span style="color: #fcd34d; font-size: 0.85rem;">OTF</span></div>` : ''}
          ${formats?.legacy > 0 ? `<div style="padding: 0.5rem 1rem; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;"><span style="font-weight: 600; color: #ef4444;">${formats.legacy}</span> <span style="color: #fca5a5; font-size: 0.85rem;">Legacy (EOT/SVG)</span></div>` : ''}
        </div>
        ${fontDelivery.hasLegacyFormats ? `
          <div style="margin-top: 1rem; background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
            <strong style="color: #f59e0b;">Legacy formats detected.</strong> <span style="color: #fcd34d;">Consider removing EOT/SVG for smaller bundles.</span>
          </div>
        ` : ''}
      </div>

      <!-- Preconnect Status -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41; font-size: 0.95rem;">
          >> Preconnect Hints
          <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: ${fontDelivery.preconnectsMissing === 0 ? 'rgba(16, 185, 129, 0.2); color: #10b981' : 'rgba(245, 158, 11, 0.2); color: #f59e0b'};">
            ${fontDelivery.preconnectsMissing === 0 ? 'All found' : `${fontDelivery.preconnectsMissing} missing`}
          </span>
        </h4>
        ${(preconnects || []).length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${preconnects.map(p => `
              <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1rem; background: rgba(${p.found ? '16, 185, 129' : '245, 158, 11'}, 0.08); border-radius: 6px; border-left: 3px solid ${p.found ? '#10b981' : '#f59e0b'};">
                <span style="color: ${p.found ? '#10b981' : '#f59e0b'}; font-size: 1.1rem;">${p.found ? '✓' : '!'}</span>
                <code style="flex: 1; font-size: 0.85rem; color: #e0e0e0;">${p.domain}</code>
                <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; background: ${p.found ? 'rgba(16, 185, 129, 0.2); color: #10b981' : 'rgba(245, 158, 11, 0.2); color: #f59e0b'};">
                  ${p.found ? 'connected' : 'missing'}
                </span>
              </div>
            `).join('')}
          </div>
          ${fontDelivery.preconnectsMissing > 0 ? `
            <div style="margin-top: 1rem;">
              <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem;">Add this to your HTML &lt;head&gt;:</div>
              <div style="background: rgba(0,0,0,0.4); border-radius: 6px; padding: 0.75rem; overflow-x: auto;">
                <code style="font-size: 0.8rem; color: #10b981;">${preconnects.filter(p => !p.found && p.recommended).map(p => `&lt;link rel="preconnect" href="https://${p.domain}"&gt;`).join('\\n')}</code>
              </div>
            </div>
          ` : ''}
        ` : '<p style="color: #888; font-size: 0.9rem;">No preconnect data available</p>'}
      </div>

      <!-- Preload Status -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41; font-size: 0.95rem;">
          >> Font Preloads
          <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: ${(preloads || []).length > 0 ? 'rgba(16, 185, 129, 0.2); color: #10b981' : 'rgba(245, 158, 11, 0.2); color: #f59e0b'};">
            ${(preloads || []).length} found
          </span>
        </h4>
        ${(preloads || []).length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${preloads.map(p => `
              <div style="padding: 0.6rem 1rem; background: rgba(16, 185, 129, 0.08); border-radius: 6px; border-left: 3px solid #10b981;">
                <code style="font-size: 0.8rem; color: #86efac; word-break: break-all;">${p.href}</code>
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 0.75rem; border-radius: 0 6px 6px 0;">
            <p style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: #fcd34d;">No font preloads detected. Add preload hints for critical fonts.</p>
            <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem;">Example:</div>
            <div style="background: rgba(0,0,0,0.4); border-radius: 6px; padding: 0.75rem; overflow-x: auto;">
              <code style="font-size: 0.8rem; color: #10b981;">&lt;link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin&gt;</code>
            </div>
          </div>
        `}
      </div>

      <!-- Font Requests Table -->
      ${(requests || []).length > 0 ? `
        <div style="margin-bottom: 1rem;">
          <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41; font-size: 0.95rem;">
            >> Network Requests
          </h4>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
              <thead>
                <tr style="background: rgba(255,255,255,0.05); text-align: left;">
                  <th style="padding: 0.6rem;">File</th>
                  <th style="padding: 0.6rem;">Format</th>
                  <th style="padding: 0.6rem;">Size</th>
                  <th style="padding: 0.6rem;">Time</th>
                  <th style="padding: 0.6rem;">Cache</th>
                </tr>
              </thead>
              <tbody>
                ${requests.slice(0, 10).map(req => {
                  const fileName = req.url.split('/').pop().split('?')[0] || 'font';
                  const cacheColor = req.cacheStatus === 'HIT' ? '#10b981' : '#f59e0b';
                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                      <td style="padding: 0.6rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${req.url}">${fileName}</td>
                      <td style="padding: 0.6rem;"><span style="padding: 2px 6px; background: rgba(${req.format === 'woff2' ? '16, 185, 129' : '245, 158, 11'}, 0.2); border-radius: 4px; font-size: 0.7rem; text-transform: uppercase;">${req.format}</span></td>
                      <td style="padding: 0.6rem; color: #06b6d4;">${req.sizeKB}KB</td>
                      <td style="padding: 0.6rem; color: #a78bfa;">${req.loadTime}ms</td>
                      <td style="padding: 0.6rem;"><span style="color: ${cacheColor};">${req.cacheStatus || 'MISS'}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ${requests.length > 10 ? `<p style="color: #666; font-size: 0.75rem; margin-top: 0.5rem;">+ ${requests.length - 10} more requests</p>` : ''}
        </div>
      ` : ''}
    `;
  }

  // ============================================
  // FALLBACK & LAYOUT STABILITY CONTENT (NEW TAB)
  // ============================================
  function generateFallbackStabilityContent(fallbackStability, data, advancedAnalysis) {
    // Use advancedAnalysis as fallback source
    const aaFallbackStacks = advancedAnalysis?.fallbackStacks || {};
    const aaClsRisk = advancedAnalysis?.clsRisk || {};
    const aaFontDisplay = advancedAnalysis?.fontDisplay || {};

    // Check if we have new stability data or need to fall back
    const hasStabilityData = fallbackStability && (fallbackStability.score !== undefined || fallbackStability.fallbackStacks?.length > 0);

    // Use new data if available, otherwise fall back to advancedAnalysis
    const fallbackStacks = hasStabilityData ? (fallbackStability.fallbackStacks || []) : (aaFallbackStacks.stacks || []);
    const fallbackStacksSummary = hasStabilityData ? fallbackStability.fallbackStacksSummary : aaFallbackStacks.summary || { total: 0, excellent: 0, good: 0, poor: 0 };
    const metricOverrides = hasStabilityData ? (fallbackStability.metricOverrides || []) : [];
    const fontDisplayBreakdown = hasStabilityData ? fallbackStability.fontDisplayBreakdown : null;
    const fontDisplaySummary = hasStabilityData ? fallbackStability.fontDisplaySummary : aaFontDisplay.summary || {};
    const clsRisk = hasStabilityData ? fallbackStability.clsRisk : aaClsRisk;
    const score = hasStabilityData ? fallbackStability.score : (aaFallbackStacks.summary?.score || aaClsRisk.score || 70);

    // Score and CLS risk colors
    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    const clsColors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
    const clsColor = clsColors[clsRisk?.level] || '#888';

    return `
      <!-- Stability Score & CLS Risk -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="padding: 1.25rem; background: rgba(0,0,0,0.2); border-radius: 12px; text-align: center;">
          <div style="font-size: 2.5rem; font-weight: bold; color: ${scoreColor}; line-height: 1;">${score || 0}</div>
          <div style="font-size: 0.8rem; color: #888; margin-top: 0.25rem;">Stability Score</div>
        </div>
        <div style="padding: 1.25rem; background: rgba(0,0,0,0.2); border-radius: 12px; text-align: center; border: 2px solid ${clsColor}40;">
          <div style="font-size: 1.75rem; font-weight: bold; color: ${clsColor}; line-height: 1; text-transform: uppercase;">${clsRisk?.level || 'N/A'}</div>
          <div style="font-size: 0.8rem; color: #888; margin-top: 0.25rem;">CLS Risk</div>
        </div>
      </div>

      <!-- CLS Risk Details -->
      ${clsRisk?.risks?.length > 0 ? `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41; font-size: 0.95rem;">
            >> Layout Shift Risks
          </h4>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${clsRisk.risks.map(risk => `
              <div style="background: rgba(${risk.type === 'warning' ? '245, 158, 11' : '239, 68, 68'}, 0.1); border-left: 4px solid ${risk.type === 'warning' ? '#f59e0b' : '#ef4444'}; padding: 0.75rem 1rem; border-radius: 0 8px 8px 0;">
                <div style="font-weight: 600; color: ${risk.type === 'warning' ? '#f59e0b' : '#ef4444'}; margin-bottom: 0.25rem;">${risk.title}</div>
                <div style="color: #c0c0c0; font-size: 0.85rem;">${risk.detail}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div style="margin-bottom: 1.5rem; background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 1rem; border-radius: 0 8px 8px 0;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: #10b981; font-size: 1.25rem;">✓</span>
            <span style="color: #86efac;">Low risk of font-related layout shifts. Good configuration!</span>
          </div>
        </div>
      `}

      <!-- font-display Breakdown -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41; font-size: 0.95rem;">
          >> font-display Values
          <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: ${fontDisplaySummary?.problematic === 0 ? 'rgba(16, 185, 129, 0.2); color: #10b981' : 'rgba(245, 158, 11, 0.2); color: #f59e0b'};">
            ${fontDisplaySummary?.optimal || 0} optimal
          </span>
        </h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem;">
          ${fontDisplayBreakdown?.swap?.length > 0 ? `
            <div style="padding: 0.5rem 1rem; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px;">
              <span style="font-weight: 600; color: #10b981;">${fontDisplayBreakdown.swap.length}</span>
              <span style="color: #86efac; font-size: 0.85rem; margin-left: 0.5rem;">swap</span>
            </div>
          ` : ''}
          ${fontDisplayBreakdown?.optional?.length > 0 ? `
            <div style="padding: 0.5rem 1rem; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px;">
              <span style="font-weight: 600; color: #10b981;">${fontDisplayBreakdown.optional.length}</span>
              <span style="color: #86efac; font-size: 0.85rem; margin-left: 0.5rem;">optional</span>
            </div>
          ` : ''}
          ${fontDisplayBreakdown?.fallback?.length > 0 ? `
            <div style="padding: 0.5rem 1rem; background: rgba(66, 133, 244, 0.15); border: 1px solid rgba(66, 133, 244, 0.3); border-radius: 8px;">
              <span style="font-weight: 600; color: #4285f4;">${fontDisplayBreakdown.fallback.length}</span>
              <span style="color: #93c5fd; font-size: 0.85rem; margin-left: 0.5rem;">fallback</span>
            </div>
          ` : ''}
          ${fontDisplayBreakdown?.block?.length > 0 ? `
            <div style="padding: 0.5rem 1rem; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;">
              <span style="font-weight: 600; color: #ef4444;">${fontDisplayBreakdown.block.length}</span>
              <span style="color: #fca5a5; font-size: 0.85rem; margin-left: 0.5rem;">block</span>
            </div>
          ` : ''}
          ${fontDisplayBreakdown?.auto?.length > 0 ? `
            <div style="padding: 0.5rem 1rem; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px;">
              <span style="font-weight: 600; color: #f59e0b;">${fontDisplayBreakdown.auto.length}</span>
              <span style="color: #fcd34d; font-size: 0.85rem; margin-left: 0.5rem;">auto/none</span>
            </div>
          ` : ''}
        </div>
        ${fontDisplaySummary?.problematic > 0 ? `
          <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 0.75rem; border-radius: 0 6px 6px 0;">
            <p style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: #fcd34d;"><strong>${fontDisplaySummary.problematic}</strong> font(s) use <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px;">block</code> or <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px;">auto</code>, which may cause Flash of Invisible Text (FOIT).</p>
            <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem;">Recommended fix:</div>
            <div style="background: rgba(0,0,0,0.4); border-radius: 6px; padding: 0.75rem; overflow-x: auto;">
              <code style="font-size: 0.8rem; color: #10b981;">font-display: swap;</code>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Metric Overrides -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41; font-size: 0.95rem;">
          >> Metric Overrides
          <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: ${(metricOverrides || []).length > 0 ? 'rgba(16, 185, 129, 0.2); color: #10b981' : 'rgba(107, 114, 128, 0.2); color: #9ca3af'};">
            ${(metricOverrides || []).length} found
          </span>
        </h4>
        ${(metricOverrides || []).length > 0 ? `
          <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 1rem; border-radius: 0 8px 8px 0; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
              <span style="color: #10b981; font-size: 1.25rem;">✓</span>
              <strong style="color: #86efac;">Metric overrides detected!</strong>
            </div>
            <p style="color: #a7f3d0; margin: 0; font-size: 0.9rem;">Using metric overrides helps minimize layout shifts when fonts swap.</p>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${metricOverrides.map(mo => `
              <div class="font-card" style="padding: 1rem;">
                <div style="font-weight: 600; margin-bottom: 0.75rem;">${mo.family}</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                  ${mo.sizeAdjust ? `<span style="padding: 0.25rem 0.5rem; background: rgba(16, 185, 129, 0.15); border-radius: 4px; font-size: 0.8rem;"><code>size-adjust: ${mo.sizeAdjust}</code></span>` : ''}
                  ${mo.ascentOverride ? `<span style="padding: 0.25rem 0.5rem; background: rgba(66, 133, 244, 0.15); border-radius: 4px; font-size: 0.8rem;"><code>ascent-override: ${mo.ascentOverride}</code></span>` : ''}
                  ${mo.descentOverride ? `<span style="padding: 0.25rem 0.5rem; background: rgba(139, 92, 246, 0.15); border-radius: 4px; font-size: 0.8rem;"><code>descent-override: ${mo.descentOverride}</code></span>` : ''}
                  ${mo.lineGapOverride ? `<span style="padding: 0.25rem 0.5rem; background: rgba(245, 158, 11, 0.15); border-radius: 4px; font-size: 0.8rem;"><code>line-gap-override: ${mo.lineGapOverride}</code></span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="background: rgba(107, 114, 128, 0.1); border-left: 4px solid #6b7280; padding: 1rem; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 0.75rem 0; color: #9ca3af; font-size: 0.9rem;">No metric overrides detected. Consider using them to minimize layout shifts.</p>
            <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.5rem;">Example @font-face with metric overrides:</div>
            <div style="background: rgba(0,0,0,0.4); border-radius: 6px; padding: 0.75rem; overflow-x: auto;">
              <pre style="margin: 0; font-size: 0.8rem; color: #e0e0e0;">@font-face {
  font-family: 'Fallback';
  src: local('Arial');
  size-adjust: 105%;
  ascent-override: 90%;
  descent-override: 20%;
}</pre>
            </div>
          </div>
        `}
      </div>

      <!-- Fallback Stack Quality -->
      <div style="margin-bottom: 1rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #00ff41; font-size: 0.95rem;">
          >> Fallback Stack Quality
          <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: ${fallbackStacksSummary?.poor === 0 ? 'rgba(16, 185, 129, 0.2); color: #10b981' : 'rgba(245, 158, 11, 0.2); color: #f59e0b'};">
            ${fallbackStacksSummary?.excellent || 0} excellent, ${fallbackStacksSummary?.poor || 0} poor
          </span>
        </h4>
        ${(fallbackStacks || []).length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${fallbackStacks.slice(0, 6).map(stack => {
              const qualityColors = {
                excellent: { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#86efac', icon: '✓' },
                good: { bg: 'rgba(66, 133, 244, 0.1)', border: '#4285f4', text: '#93c5fd', icon: '~' },
                poor: { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#fca5a5', icon: '✗' }
              };
              const colors = qualityColors[stack.quality] || qualityColors.poor;
              return `
                <div style="background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 0.75rem 1rem; border-radius: 0 8px 8px 0;">
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span style="color: ${colors.border}; font-size: 1rem;">${colors.icon}</span>
                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; background: ${colors.bg}; color: ${colors.border}; text-transform: uppercase; font-weight: 600;">${stack.quality}</span>
                  </div>
                  <code style="font-size: 0.8rem; color: #e0e0e0; word-break: break-all;">${stack.stack}</code>
                  ${stack.recommendation && stack.quality !== 'excellent' ? `
                    <div style="margin-top: 0.5rem; font-size: 0.8rem; color: ${colors.text};">${stack.recommendation}</div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
          ${fallbackStacks.length > 6 ? `<p style="color: #666; font-size: 0.75rem; margin-top: 0.5rem;">+ ${fallbackStacks.length - 6} more stacks analyzed</p>` : ''}
        ` : '<p style="color: #888; font-size: 0.9rem;">No fallback stacks analyzed</p>'}
      </div>
    `;
  }

  // ============================================
  // PERFORMANCE ACCORDION CONTENT
  // ============================================
  function generatePerformanceAccordionContent(data, performance, hasFullScan, fonts) {
    // Calculate typography statistics from fontMetrics
    const fontMetrics = fonts.fontMetrics || [];
    const typographyStats = calculateTypographyStats(fontMetrics);
    
    return `
      <!-- Core Performance Metrics -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">
        ${hasFullScan && performance.initialLoadTime ? `
          <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
            <div style="font-size: 1.5rem; font-weight: bold; color: ${performance.initialLoadTime < 1000 ? '#10b981' : performance.initialLoadTime < 2000 ? '#f59e0b' : '#ef4444'};">${performance.initialLoadTime}ms</div>
            <div style="color: #888; font-size: 0.75rem;">Page Load</div>
          </div>
        ` : ''}
        <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
          <div style="font-size: 1.5rem; font-weight: bold; color: ${data.summary.totalFamilies <= 3 ? '#10b981' : data.summary.totalFamilies <= 5 ? '#f59e0b' : '#ef4444'};">${data.summary.totalFamilies}</div>
          <div style="color: #888; font-size: 0.75rem;">Font Families</div>
        </div>
        <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #4285f4;">${typographyStats.uniqueFonts}</div>
          <div style="color: #888; font-size: 0.75rem;">Unique Fonts</div>
        </div>
        <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #a78bfa;">${typographyStats.uniqueWeights}</div>
          <div style="color: #888; font-size: 0.75rem;">Font Weights</div>
        </div>
        <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #06b6d4;">${typographyStats.uniqueSizes}</div>
          <div style="color: #888; font-size: 0.75rem;">Font Sizes</div>
        </div>
      </div>
      
      <!-- Typography Scale Analysis -->
      ${typographyStats.sizeBreakdown.length > 0 ? `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="margin-bottom: 1rem; color: #00ff41; display: flex; align-items: center; gap: 0.5rem;">
            >> Typography Scale
            <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: ${typographyStats.hasConsistentScale ? 'rgba(16, 185, 129, 0.2); color: #10b981' : 'rgba(245, 158, 11, 0.2); color: #f59e0b'};">
              ${typographyStats.hasConsistentScale ? 'Consistent' : 'Review needed'}
            </span>
          </h4>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-end;">
            ${typographyStats.sizeBreakdown.slice(0, 8).map(size => `
              <div style="display: flex; flex-direction: column; align-items: center; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 6px; min-width: 60px;">
                <div style="font-size: ${Math.min(parseFloat(size.size), 32)}px; font-weight: 500; line-height: 1; margin-bottom: 0.25rem;">Aa</div>
                <div style="font-size: 0.7rem; color: #888;">${size.size}</div>
                <div style="font-size: 0.65rem; color: #666;">${size.count}×</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Font Weight Distribution -->
      ${typographyStats.weightBreakdown.length > 0 ? `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="margin-bottom: 1rem; color: #00ff41;">>> Weight Distribution</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${typographyStats.weightBreakdown.map(weight => `
              <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.05); border-radius: 6px;">
                <span style="font-weight: ${weight.weight}; font-size: 0.9rem;">${weight.weight}</span>
                <span style="font-size: 0.7rem; color: #888; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 10px;">${weight.count}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Typography Usage Table -->
      ${fontMetrics.length > 0 ? `
        <div style="margin-bottom: 1rem;">
          <h4 style="margin-bottom: 1rem; color: #00ff41;">>> Typography Usage</h4>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
              <thead>
                <tr style="background: rgba(255,255,255,0.05); text-align: left;">
                  <th style="padding: 0.6rem;">Element</th>
                  <th style="padding: 0.6rem;">Font</th>
                  <th style="padding: 0.6rem;">Size</th>
                  <th style="padding: 0.6rem;">Weight</th>
                  <th style="padding: 0.6rem;">Sample</th>
                </tr>
              </thead>
              <tbody>
                ${fontMetrics.slice(0, 12).map(metric => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.6rem;">
                      <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-size: 0.75rem;">&lt;${metric.element}&gt;</code>
                    </td>
                    <td style="padding: 0.6rem; font-family: '${metric.fontFamily?.split(',')[0]}', sans-serif; font-size: 0.85rem;">
                      ${metric.fontFamily?.split(',')[0]?.substring(0, 20) || 'N/A'}
                    </td>
                    <td style="padding: 0.6rem; color: #06b6d4;">${metric.fontSize}</td>
                    <td style="padding: 0.6rem; color: #a78bfa;">${metric.fontWeight}</td>
                    <td style="padding: 0.6rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #666; font-size: 0.75rem;">
                      ${metric.textContent?.substring(0, 40) || '—'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${fontMetrics.length > 12 ? `<p style="color: #666; font-size: 0.75rem; margin-top: 0.5rem;">+ ${fontMetrics.length - 12} more elements analyzed</p>` : ''}
        </div>
      ` : `
        <div style="background: rgba(66, 133, 244, 0.1); border-left: 4px solid #4285f4; padding: 1rem; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; font-size: 0.9rem;">Run a full scan to see detailed typography usage analysis.</p>
        </div>
      `}
      
      <!-- Performance Tips -->
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(16, 185, 129, 0.05); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.2);">
        <h4 style="margin: 0 0 0.5rem 0; color: #10b981; font-size: 0.9rem;">Typography Performance Tips</h4>
        <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.8rem; color: #888;">
          ${data.summary.totalFamilies > 3 ? `<li>Consider reducing font families from ${data.summary.totalFamilies} to 2-3 for faster loading</li>` : ''}
          ${typographyStats.uniqueWeights > 4 ? `<li>Using ${typographyStats.uniqueWeights} font weights - consider consolidating to 3-4</li>` : ''}
          ${typographyStats.uniqueSizes > 8 ? `<li>${typographyStats.uniqueSizes} different font sizes detected - aim for a consistent type scale (6-8 sizes)</li>` : ''}
          ${data.summary.totalFamilies <= 3 && typographyStats.uniqueWeights <= 4 ? `<li>Good job! Your typography setup is well-optimized for performance</li>` : ''}
        </ul>
      </div>
    `;
  }
  
  // Calculate typography statistics from font metrics
  function calculateTypographyStats(fontMetrics) {
    const fonts = new Set();
    const weights = new Set();
    const sizes = new Map();
    const weightCounts = new Map();
    
    fontMetrics.forEach(m => {
      if (m.fontFamily) {
        const primaryFont = m.fontFamily.split(',')[0]?.replace(/['"]/g, '').trim();
        if (primaryFont) fonts.add(primaryFont);
      }
      if (m.fontWeight) {
        weights.add(m.fontWeight);
        weightCounts.set(m.fontWeight, (weightCounts.get(m.fontWeight) || 0) + 1);
      }
      if (m.fontSize) {
        sizes.set(m.fontSize, (sizes.get(m.fontSize) || 0) + 1);
      }
    });
    
    // Sort sizes by pixel value
    const sizeBreakdown = Array.from(sizes.entries())
      .map(([size, count]) => ({ size, count, px: parseFloat(size) }))
      .sort((a, b) => b.px - a.px);
    
    const weightBreakdown = Array.from(weightCounts.entries())
      .map(([weight, count]) => ({ weight, count }))
      .sort((a, b) => parseInt(a.weight) - parseInt(b.weight));
    
    // Check if sizes follow a consistent scale (roughly 1.2-1.5 ratio between sizes)
    let hasConsistentScale = true;
    if (sizeBreakdown.length >= 3) {
      const pxValues = sizeBreakdown.map(s => s.px).filter(px => !isNaN(px) && px > 0);
      for (let i = 1; i < Math.min(pxValues.length, 5); i++) {
        const ratio = pxValues[i-1] / pxValues[i];
        if (ratio < 1.1 || ratio > 2.0) {
          hasConsistentScale = false;
          break;
        }
      }
    }
    
    return {
      uniqueFonts: fonts.size,
      uniqueWeights: weights.size,
      uniqueSizes: sizes.size,
      sizeBreakdown,
      weightBreakdown,
      hasConsistentScale
    };
  }

  // ============================================
  // RECOMMENDATIONS ACCORDION CONTENT
  // ============================================
  function generateRecommendationsAccordionContent(data, bestPractices) {
    const allRecs = [...(data.recommendations || [])];
    
    // Generate AI insights for the report
    const aiInsights = generateAIInsightsForReport(data);
    
    return `
      <!-- AI-Powered Insights -->
      <div style="margin-bottom: 1.5rem; background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05)); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; padding: 1rem;">
        <h4 style="margin: 0 0 0.75rem 0; color: #a78bfa; display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.1rem;">✨</span> AI-Powered Recommendations
        </h4>
        ${aiInsights}
      </div>
      
      <!-- Quick Fixes with Copy Buttons -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; color: #00ff41;">>> Quick Performance Fixes</h4>
        
        <div class="font-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>1. Add Preconnect for External Fonts</strong>
            <button class="copy-btn" onclick="copyCode(this, 'preconnect-code')">Copy</button>
          </div>
          <pre id="preconnect-code" style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px; font-size: 0.8rem; overflow-x: auto; margin: 0;">&lt;link rel="preconnect" href="https://fonts.googleapis.com"&gt;
&lt;link rel="preconnect" href="https://fonts.gstatic.com" crossorigin&gt;</pre>
        </div>
        
        <div class="font-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>2. Add font-display: swap</strong>
            <button class="copy-btn" onclick="copyCode(this, 'display-code')">Copy</button>
          </div>
          <pre id="display-code" style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px; font-size: 0.8rem; overflow-x: auto; margin: 0;">/* In your Google Fonts URL: */
https://fonts.googleapis.com/css2?family=Roboto&amp;display=swap

/* Or in @font-face: */
@font-face {
  font-family: 'MyFont';
  font-display: swap;
  src: url('font.woff2') format('woff2');
}</pre>
        </div>
        
        <div class="font-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>3. Preload Critical Fonts</strong>
            <button class="copy-btn" onclick="copyCode(this, 'preload-code')">Copy</button>
          </div>
          <pre id="preload-code" style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px; font-size: 0.8rem; overflow-x: auto; margin: 0;">&lt;link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin&gt;</pre>
        </div>
      </div>
      
      <!-- Detailed Recommendations -->
      ${allRecs.length > 0 ? `
        <h4 style="margin-bottom: 1rem; color: #00ff41;">>> Site-Specific Recommendations</h4>
        ${allRecs.map(rec => `
          <div style="background: rgba(66, 133, 244, 0.05); border-left: 4px solid ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#3b82f6'}; padding: 1rem; margin-bottom: 0.75rem; border-radius: 0 8px 8px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#3b82f6'};">${rec.title}</strong>
              <span class="issue-badge" style="background: ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#3b82f6'}; color: white;">${rec.priority}</span>
            </div>
            <p style="margin: 0.5rem 0; color: #ccc;">${rec.description}</p>
            <p style="margin: 0; font-size: 0.85rem; color: #888;">${rec.action}</p>
          </div>
        `).join('')}
      ` : ''}
      
      <!-- Best Practices -->
      ${bestPractices.recommendations && bestPractices.recommendations.length > 0 ? `
        <h4 style="margin: 1.5rem 0 1rem 0; color: #00ff41;">>> Best Practices Audit (Score: ${bestPractices.score || 0}/100)</h4>
        <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 1rem;">
          ${bestPractices.recommendations.slice(0, 6).map(rec => `
            <div style="display: flex; align-items: flex-start; margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: ${rec.type === 'error' ? '#ef4444' : rec.type === 'warning' ? '#f59e0b' : '#10b981'}; margin-right: 0.75rem; font-size: 1.2rem;">
                ${rec.type === 'error' ? '✗' : rec.type === 'warning' ? '~' : '✓'}
              </span>
              <div>
                <div style="font-weight: 500;">${rec.message || rec.title}</div>
                ${rec.detail ? `<div style="color: #888; font-size: 0.85rem; margin-top: 0.25rem;">${rec.detail}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  // ============================================
  // AI INSIGHTS FOR PAID REPORT
  // ============================================
  function generateAIInsightsForReport(data) {
    const insights = [];
    
    // Font pairing analysis
    if (data.families.length >= 2) {
      const heading = data.families[0]?.name || 'Primary font';
      const body = data.families[1]?.name || 'Secondary font';
      insights.push(`
        <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(167, 139, 250, 0.2);">
          <strong style="color: #e0e7ff;">Font Pairing Strategy:</strong>
          <span style="color: #c7d2fe;">Use "${heading}" for headings and "${body}" for body text to create visual hierarchy and improve readability.</span>
        </div>
      `);
    }
    
    // Performance optimization
    if (data.summary.totalFamilies > 3) {
      const savings = (data.summary.totalFamilies - 2) * 100; // Rough estimate
      insights.push(`
        <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(167, 139, 250, 0.2);">
          <strong style="color: #e0e7ff;">Performance Optimization:</strong>
          <span style="color: #c7d2fe;">Reduce from ${data.summary.totalFamilies} to 2-3 font families. Estimated improvement: ${savings}-${savings + 200}ms faster load time.</span>
        </div>
      `);
    }
    
    // Provider consolidation
    if (data.providers.length > 1) {
      insights.push(`
        <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(167, 139, 250, 0.2);">
          <strong style="color: #e0e7ff;">Provider Consolidation:</strong>
          <span style="color: #c7d2fe;">Fonts loaded from ${data.providers.length} providers. Consolidate to reduce DNS lookups and connection overhead.</span>
        </div>
      `);
    }
    
    // Display issues
    if (data.summary.displayIssueCount > 0) {
      insights.push(`
        <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(167, 139, 250, 0.2);">
          <strong style="color: #fbbf24;">Font Display Fix:</strong>
          <span style="color: #c7d2fe;">${data.summary.displayIssueCount} fonts missing font-display property. Add "font-display: swap" to prevent invisible text during load.</span>
        </div>
      `);
    }
    
    // Preload opportunities  
    if (data.summary.preloadIssueCount > 0) {
      insights.push(`
        <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(167, 139, 250, 0.2);">
          <strong style="color: #34d399;">Preload Opportunity:</strong>
          <span style="color: #c7d2fe;">${data.summary.preloadIssueCount} critical fonts could benefit from preloading. This can improve First Contentful Paint by 100-300ms.</span>
        </div>
      `);
    }
    
    // Accessibility best practice
    insights.push(`
      <div style="margin-bottom: 0;">
        <strong style="color: #e0e7ff;">Accessibility:</strong>
        <span style="color: #c7d2fe;">Ensure body text is at least 16px with line-height of 1.5 for WCAG compliance and optimal readability.</span>
      </div>
    `);
    
    return insights.join('');
  }

  // ============================================
  // AI SUGGESTIONS GENERATOR (Legacy - kept for reference)
  // ============================================
  function generateAISuggestions(data, fonts) {
    const suggestions = [];
    
    // Font pairing suggestion
    if (data.families.length >= 2) {
      suggestions.push(`<p style="margin: 0.5rem 0;"><strong>Font Pairing:</strong> Consider using "${data.families[0]?.name}" for headings and "${data.families[1]?.name}" for body text for visual hierarchy.</p>`);
    }
    
    // Performance suggestion
    if (data.summary.totalFamilies > 3) {
      suggestions.push(`<p style="margin: 0.5rem 0;"><strong>Performance Tip:</strong> You're loading ${data.summary.totalFamilies} font families. Consider reducing to 2-3 for faster load times (potential 200-400ms improvement).</p>`);
    }
    
    // Provider suggestion
    if (data.providers.length > 1) {
      suggestions.push(`<p style="margin: 0.5rem 0;"><strong>Consolidation:</strong> Fonts are loaded from ${data.providers.length} different providers. Consolidating to one provider reduces DNS lookups.</p>`);
    }
    
    // Accessibility suggestion
    suggestions.push(`<p style="margin: 0.5rem 0;"><strong>Accessibility:</strong> Ensure body text is at least 16px with line-height of 1.5 for optimal readability.</p>`);
    
    if (suggestions.length === 0) {
      suggestions.push(`<p style="margin: 0.5rem 0;">Your font setup looks optimized! Keep monitoring for any new issues.</p>`);
    }
    
    return suggestions.join('');
  }

  // ============================================
  // CHART INITIALIZATION
  // ============================================
  function initializeCharts(data, fonts) {
    // Provider Distribution Chart
    const providerCtx = document.getElementById('providerChart');
    if (providerCtx && typeof Chart !== 'undefined') {
      const providerData = data.providers.length > 0 
        ? data.providers.map(p => ({ name: p.name, count: p.families.length }))
        : [{ name: 'Self-hosted', count: data.summary.totalFamilies }];
      
      new Chart(providerCtx, {
        type: 'doughnut',
        data: {
          labels: providerData.map(p => p.name),
          datasets: [{
            data: providerData.map(p => p.count),
            backgroundColor: ['#4285f4', '#ff0000', '#10b981', '#ff6b35', '#528dd7', '#6b7280'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#888', font: { size: 11 } }
            }
          }
        }
      });
    }
    
    // Weight Distribution Chart
    const weightCtx = document.getElementById('weightChart');
    if (weightCtx && typeof Chart !== 'undefined') {
      const weights = {};
      data.families.forEach(f => {
        if (f.variants) {
          f.variants.forEach(v => {
            const w = v.weight || v || '400';
            weights[w] = (weights[w] || 0) + 1;
          });
        }
      });
      
      new Chart(weightCtx, {
        type: 'bar',
        data: {
          labels: Object.keys(weights).sort(),
          datasets: [{
            label: 'Usage Count',
            data: Object.values(weights),
            backgroundColor: '#10b981',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { 
              beginAtZero: true,
              ticks: { color: '#888' },
              grid: { color: 'rgba(255,255,255,0.1)' }
            },
            x: {
              ticks: { color: '#888' },
              grid: { display: false }
            }
          }
        }
      });
    }
  }

  // ============================================
  // EXPORT FUNCTIONS (Global scope)
  // ============================================
  window.copyCode = function(btn, codeId) {
    const code = document.getElementById(codeId).textContent;
    navigator.clipboard.writeText(code).then(() => {
      btn.textContent = '✅ Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '📋 Copy';
        btn.classList.remove('copied');
      }, 2000);
    });
  };

  window.exportToPDF = async function() {
    if (!currentResults) {
      alert('No scan results to export. Run a scan first.');
      return;
    }

    // Use unified PDF export function (server-side Puppeteer)
    if (typeof window.exportReportPDF === 'function') {
      const button = document.querySelector('[data-export="pdf"]') ||
                     document.querySelector('button[onclick*="exportToPDF"]');
      await window.exportReportPDF({
        reportType: 'fonts',
        buttonElement: button
      });
    } else {
      console.error('PDF export utility not loaded');
      alert('PDF export is not available. Please refresh the page.');
    }
  };

  window.exportToCSS = function() {
    if (!currentResults) return;
    
    let css = '/* Font families detected by Site Mechanic */\n\n';
    
    currentResults.families.forEach(f => {
      css += '/* ' + f.name + ' */\n';
      css += '.font-' + f.name.toLowerCase().replace(/\s+/g, '-') + ' {\n';
      css += "  font-family: '" + f.name + "', sans-serif;\n";
      css += '}\n\n';
    });
    
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fonts.css';
    a.click();
  };

  window.copyShareLink = function() {
    // Check Pro status before sharing
    if (window.ExportGate && !window.ExportGate.isPro()) {
      window.ExportGate.showPaywall();
      return;
    }
    
    const url = window.location.origin + window.location.pathname + '?url=' + encodeURIComponent(urlInput.value);
    navigator.clipboard.writeText(url).then(() => {
      alert('Share link copied to clipboard!');
    });
  };

  function getScoreClass(score) {
    if (score >= 80) return 'score-good';
    if (score >= 60) return 'score-warning';
    return 'score-poor';
  }

  function getScoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  function getProviderClass(name) {
    const lower = name.toLowerCase();
    if (lower.includes('google')) return 'google';
    if (lower.includes('adobe') || lower.includes('typekit')) return 'adobe';
    if (lower.includes('bunny')) return 'bunny';
    if (lower.includes('fontawesome') || lower.includes('font awesome')) return 'fontawesome';
    if (lower.includes('self')) return 'self';
    return 'unknown';
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function isDuplicate(familyName, duplicates) {
    if (!duplicates) return false;
    return duplicates.some(d => d.family === familyName || d.name === familyName);
  }

  function hasDisplayIssue(familyName, displayIssues) {
    if (!displayIssues) return false;
    return displayIssues.some(d => d.family === familyName || d.name === familyName);
  }

  /**
   * Add ASCII art patience message to loading container
   */
  function addPatienceMessage(container) {
    // Remove existing patience message if any
    const existing = document.getElementById('patience-message');
    if (existing) existing.remove();
    
    const patienceEl = document.createElement('div');
    patienceEl.id = 'patience-message';
    patienceEl.style.cssText = `
      margin: 0 0 1.5rem 0;
      padding: 1rem;
      background: rgba(var(--accent-primary-rgb), 0.05);
      border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
      border-radius: 6px;
      text-align: center;
      overflow: visible;
    `;
    patienceEl.innerHTML = `
      <div style="overflow-x: auto; overflow-y: visible;">
        <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: var(--accent-primary); font-family: monospace; text-shadow: 2px 2px 0px rgba(var(--accent-primary-rgb), 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
      </div>
      <div style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--accent-primary);">
        ⏳ Font analysis in progress...<br>
        <span style="font-size: 0.75rem; color: rgba(var(--accent-primary-rgb), 0.8);">This may take 20-45 seconds</span>
      </div>
    `;
    
    // Add animations if not already added
    if (!document.getElementById('patience-animations')) {
      const style = document.createElement('style');
      style.id = 'patience-animations';
      style.textContent = `
        @keyframes color-cycle {
          0% { color: var(--accent-primary); }
          20% { color: #00ffaa; }
          40% { color: #00aaff; }
          60% { color: #aa00ff; }
          80% { color: #ff00aa; }
          100% { color: var(--accent-primary); }
        }
        @keyframes fade-in-out {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .ascii-art-responsive {
          font-size: clamp(0.35rem, 1.2vw, 0.65rem);
          white-space: pre;
          max-width: 100%;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Insert at the beginning of the loading container
    const loaderDiv = container.querySelector('.analyzer-loading');
    if (loaderDiv) {
      loaderDiv.insertBefore(patienceEl, loaderDiv.firstChild);
    } else {
      container.insertBefore(patienceEl, container.firstChild);
    }
  }
});

// ============================================
// GLOBAL FUNCTIONS FOR FONTS FIX ACCORDIONS
// ============================================
window.toggleFontsFixAccordion = function(accordionId) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);
  const icon = accordion?.querySelector('.fonts-fix-expand-icon');

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
};

window.switchFontsFixTab = function(accordionId, tabName) {
  // Get all tab buttons and content
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;

  const tabs = accordion.querySelectorAll('.fonts-fix-tab');
  const contents = accordion.querySelectorAll('.fonts-fix-tab-content');

  // Update tab buttons
  tabs.forEach((tab, index) => {
    const tabNames = ['summary', 'code', 'guide'];
    if (tabNames[index] === tabName) {
      tab.classList.add('active');
      tab.style.background = 'rgba(255,255,255,0.1)';
      tab.style.borderColor = 'rgba(255,255,255,0.2)';
      tab.style.color = '#fff';
    } else {
      tab.classList.remove('active');
      tab.style.background = 'transparent';
      tab.style.borderColor = 'rgba(255,255,255,0.1)';
      tab.style.color = '#aaa';
    }
  });

  // Update content visibility
  const summaryEl = document.getElementById(`${accordionId}-summary`);
  const codeEl = document.getElementById(`${accordionId}-code`);
  const guideEl = document.getElementById(`${accordionId}-guide`);

  if (summaryEl) summaryEl.style.display = tabName === 'summary' ? 'block' : 'none';
  if (codeEl) codeEl.style.display = tabName === 'code' ? 'block' : 'none';
  if (guideEl) guideEl.style.display = tabName === 'guide' ? 'block' : 'none';

  // Recalculate max-height after content change
  const content = document.getElementById(`${accordionId}-content`);
  if (content && accordion.classList.contains('expanded')) {
    content.style.maxHeight = content.scrollHeight + 'px';
  }
};

window.copyFontsCode = function(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const text = element.textContent;
  navigator.clipboard.writeText(text).then(() => {
    // Find the copy button that triggered this
    const btn = element.parentElement?.querySelector('button');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }
  });
};

// Event delegation for fonts fix accordions (more reliable than inline onclick)
document.addEventListener('click', function(e) {
  // Handle tab clicks
  const tab = e.target.closest('.fonts-fix-tab');
  if (tab) {
    const accordion = tab.closest('.fonts-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      const tabText = tab.textContent.toLowerCase();
      let tabName = 'summary';
      if (tabText.includes('code')) tabName = 'code';
      else if (tabText.includes('guide')) tabName = 'guide';

      if (fixId && typeof window.switchFontsFixTab === 'function') {
        e.preventDefault();
        e.stopPropagation();
        window.switchFontsFixTab(fixId, tabName);
      }
    }
    return;
  }

  // Handle accordion header clicks
  const header = e.target.closest('.fonts-fix-header');
  if (header) {
    const accordion = header.closest('.fonts-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      if (fixId && typeof window.toggleFontsFixAccordion === 'function') {
        e.preventDefault();
        e.stopPropagation();
        window.toggleFontsFixAccordion(fixId);
      }
    }
  }
});
