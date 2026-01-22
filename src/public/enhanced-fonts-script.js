/**
 * Enhanced Font Analyzer Script
 * Detects font providers, duplicates, unused fonts, and optimization opportunities
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'enhanced-fonts';

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

  // Check for URL in query params
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('url');
  if (urlParam) {
    urlInput.value = urlParam;
    analyzeUrl();
  }

  async function analyzeUrl() {
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please enter a valid URL');
      return;
    }

    // Show loading
    results.classList.add('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    analyzeButton.disabled = true;
    
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

    const totalIssues = (data.summary.duplicateCount || 0) + 
                        (data.summary.displayIssueCount || 0) + 
                        (data.summary.preloadIssueCount || 0);
    
    // Get full scan data if available
    const fullScan = data.fullScan || {};
    const hasFullScan = !!data.fullScan;
    const fonts = fullScan.fonts || {};
    const performance = fullScan.performance || {};
    const bestPractices = fullScan.bestPractices || {};
    const screenshot = fullScan.screenshot;

    // Generate report ID for unlocking
    const urlValue = document.getElementById('urlInput')?.value || data.url || '';
    const reportId = data.reportId || `fonts_${btoa(urlValue).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
    
    // Set report ID on body for paywall systems
    if (reportId) {
      document.body.setAttribute('data-report-id', reportId);
    }
    
    // Store results globally for unlock handling
    window.currentFontsResults = data;

    // Initialize entitlements if available
    if (window.SmEntitlements && typeof window.SmEntitlements.init === 'function') {
      window.SmEntitlements.init({ reportId: reportId || undefined });
    }

    // Check if report is unlocked
    const isUnlocked = !!(
      reportId &&
      window.CreditsManager &&
      (
        (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) ||
        (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId))
      )
    );

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
        title: 'Font Providers',
        scoreTextRight: `${data.providers.length} source${data.providers.length !== 1 ? 's' : ''}`,
        contentHTML: generateProvidersAccordionContent(data)
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

    // Display issues
    if (data.summary.displayIssueCount > 0) {
      fixes.push({
        id: 'font-display',
        title: 'Add font-display: swap',
        category: 'Performance',
        severity: 'High',
        description: `${data.summary.displayIssueCount} font(s) are missing the font-display property, which can cause Flash of Invisible Text (FOIT) during loading.`,
        impact: 'Prevents invisible text during font loading, improving perceived performance and user experience.',
        problematicCode: `@font-face {
  font-family: 'MyFont';
  src: url('font.woff2') format('woff2');
  /* Missing font-display property */
}`,
        fixedCode: `@font-face {
  font-family: 'MyFont';
  font-display: swap;
  src: url('font.woff2') format('woff2');
}`,
        steps: [
          'Locate your @font-face declarations in CSS',
          'Add font-display: swap to each declaration',
          'For Google Fonts, add &display=swap to the URL'
        ]
      });
    }

    // Duplicate fonts
    if (data.summary.duplicateCount > 0) {
      fixes.push({
        id: 'duplicates',
        title: 'Remove duplicate font declarations',
        category: 'Optimization',
        severity: 'Medium',
        description: `${data.summary.duplicateCount} duplicate font declaration(s) detected. This increases page weight and loading time unnecessarily.`,
        impact: 'Reduces HTTP requests and total page weight, improving load time by 100-300ms.',
        problematicCode: `/* Font loaded twice */
@import url('fonts.googleapis.com/css2?family=Roboto');
<link href="fonts.googleapis.com/css2?family=Roboto" rel="stylesheet">`,
        fixedCode: `/* Single font declaration */
<link href="fonts.googleapis.com/css2?family=Roboto" rel="stylesheet">`,
        steps: [
          'Audit all font loading sources (CSS @import, link tags, JavaScript)',
          'Remove duplicate declarations',
          'Verify fonts still load correctly after cleanup'
        ]
      });
    }

    // Preload opportunities
    if (data.summary.preloadIssueCount > 0) {
      fixes.push({
        id: 'preload',
        title: 'Preload critical fonts',
        category: 'Performance',
        severity: 'Medium',
        description: `${data.summary.preloadIssueCount} font(s) could benefit from preloading to improve First Contentful Paint.`,
        impact: 'Improves First Contentful Paint by 100-300ms by starting font downloads earlier.',
        problematicCode: `<!-- Fonts discovered late during parsing -->
<link rel="stylesheet" href="styles.css">`,
        fixedCode: `<!-- Preload critical fonts -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="styles.css">`,
        steps: [
          'Identify fonts used above-the-fold',
          'Add preload hints in document head before stylesheets',
          'Include crossorigin attribute for cross-origin fonts'
        ]
      });
    }

    // Too many font families
    if (data.summary.totalFamilies > 3) {
      fixes.push({
        id: 'families',
        title: 'Reduce font families',
        category: 'Performance',
        severity: 'Low',
        description: `Using ${data.summary.totalFamilies} font families. Consider consolidating to 2-3 families for better performance.`,
        impact: `Reduces font loading time by approximately ${(data.summary.totalFamilies - 2) * 100}ms and improves visual consistency.`,
        problematicCode: `/* Too many fonts */
@import url('fonts.googleapis.com/css2?family=Roboto');
@import url('fonts.googleapis.com/css2?family=Open+Sans');
@import url('fonts.googleapis.com/css2?family=Lato');
@import url('fonts.googleapis.com/css2?family=Montserrat');`,
        fixedCode: `/* Consolidated to 2-3 fonts */
@import url('fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700');`,
        steps: [
          'Review your typography design system',
          'Choose 1 font for headings and 1 for body text',
          'Replace redundant fonts with variants of your primary fonts'
        ]
      });
    }

    // Preconnect for external fonts
    if (data.providers.length > 0) {
      const hasGoogleFonts = data.providers.some(p => p.name.toLowerCase().includes('google'));
      if (hasGoogleFonts) {
        fixes.push({
          id: 'preconnect',
          title: 'Add preconnect hints',
          category: 'Performance',
          severity: 'Low',
          description: 'Adding preconnect hints for Google Fonts domains can speed up font loading.',
          impact: 'Reduces connection setup time by 100-200ms for external font resources.',
          problematicCode: `<!-- No preconnect hints -->
<link href="https://fonts.googleapis.com/css2?family=Roboto" rel="stylesheet">`,
          fixedCode: `<!-- Add preconnect before font stylesheet -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto" rel="stylesheet">`,
          steps: [
            'Add preconnect hints at the top of your document head',
            'Include both fonts.googleapis.com and fonts.gstatic.com',
            'Add crossorigin attribute for fonts.gstatic.com'
          ]
        });
      }
    }

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
  // PROVIDERS ACCORDION CONTENT
  // ============================================
  function generateProvidersAccordionContent(data) {
    if (data.providers.length === 0) {
      return '<p style="color: #666;">No external font providers detected (fonts may be self-hosted).</p>';
    }
    
    return data.providers.map(provider => `
      <div class="font-card">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span class="provider-badge provider-${getProviderClass(provider.name)}">${provider.name}</span>
            <span style="color: #888;">${provider.families.length} family/families</span>
          </div>
        </div>
        <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${provider.families.map(f => `
            <span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">${f}</span>
          `).join('')}
        </div>
      </div>
    `).join('');
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
    if (!currentResults) return;
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Font Analysis Report', 20, 20);
    
    doc.setFontSize(12);
    doc.text('URL: ' + currentResults.url, 20, 35);
    doc.text('Health Score: ' + currentResults.healthScore + '/100', 20, 45);
    doc.text('Font Families: ' + currentResults.summary.totalFamilies, 20, 55);
    doc.text('Providers: ' + currentResults.summary.totalProviders, 20, 65);
    doc.text('Issues Found: ' + (currentResults.summary.duplicateCount + currentResults.summary.displayIssueCount + currentResults.summary.preloadIssueCount), 20, 75);
    
    doc.setFontSize(14);
    doc.text('Font Families:', 20, 95);
    
    let yPos = 105;
    currentResults.families.slice(0, 15).forEach(f => {
      doc.setFontSize(10);
      doc.text('• ' + f.name + ' (' + (f.variants?.length || 0) + ' variants)', 25, yPos);
      yPos += 8;
    });
    
    doc.save('font-analysis-' + new Date().toISOString().split('T')[0] + '.pdf');
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
