/**
 * Site Mechanic Dashboard Script
 * 
 * Orchestrates the 5-stage workflow:
 *   1. SCAN    → Capture site data (entry point)
 *   2. DIAGNOSE → Run analyzers across 8 categories
 *   3. PRIORITIZE → Sort issues by severity (Critical → Warning → Info)
 *   4. EXPORT  → PDF/CSV reports
 *   5. IMPROVE → Actionable fix guidance
 * 
 * CATEGORY STRUCTURE:
 * A. Overview          - Site Health Summary, Cross-category scores
 * B. Performance & UX  - Speed, Core Web Vitals, Mobile testing
 * C. SEO & Indexing    - SEO Analysis, Crawler, Metadata, Tags
 * D. Accessibility     - WCAG scoring, Compliance, Violations
 * E. Security & Trust  - Security, IP Reputation, Privacy
 * F. Technology        - Fonts & Typography, Tech stack detection
 * G. Infrastructure    - Hosting, Cost estimates
 * H. Competitive       - Competitor benchmarks
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'dashboard';

// Dashboard state
let dashboardResults = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);

  // Check for existing scan context and restore results
  if (window.ScanContext && window.ScanContext.exists()) {
    const context = window.ScanContext.get();
    if (context && context.results) {
      // Pre-fill the URL input
      const urlInput = document.getElementById('dashboardUrlInput');
      if (urlInput && context.url) {
        urlInput.value = context.url;
      }
      // Restore and display results
      dashboardResults = context.results;
      displayDashboard(dashboardResults);
    }
  }

  const urlInput = document.getElementById('dashboardUrlInput');
  const submitButton = document.getElementById('dashboardAnalyzeButton');

  // Handle button click
  submitButton.addEventListener('click', () => runComprehensiveAnalysis());

  // Handle Enter key
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      runComprehensiveAnalysis();
    }
  });

  // Dashboard contact form (support)
  initializeDashboardContactForm();
});

function initializeDashboardContactForm() {
  const form = document.getElementById('dashboardContactForm');
  if (!form) return;

  const statusEl = document.getElementById('contactFormStatus');
  const submitBtn = document.getElementById('contactSubmitButton');
  const urlInput = document.getElementById('dashboardUrlInput');
  const contactUrl = document.getElementById('contactUrl');

  // Prefill URL when possible
  if (contactUrl) {
    const fromQuery = new URLSearchParams(window.location.search).get('url');
    if (fromQuery) contactUrl.value = fromQuery;
    else if (urlInput && urlInput.value) contactUrl.value = urlInput.value;
  }

  const setStatus = (text, isError = false) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = isError ? 'var(--color-error, #ff4444)' : 'var(--text-secondary, #9ca3af)';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    setStatus('');

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    // Keep the URL field synced with the scan input when empty
    if ((!payload.url || String(payload.url).trim() === '') && urlInput && urlInput.value) {
      payload.url = urlInput.value;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data.success) {
        const msg = data && data.message ? data.message : 'Failed to send message. Please try again.';
        setStatus(msg, true);
        return;
      }

      setStatus('Message sent. We’ll reply by email.');
      // Keep name/email for convenience; clear only the message
      const messageEl = document.getElementById('contactMessage');
      if (messageEl) messageEl.value = '';
    } catch (err) {
      setStatus('Failed to send message. Please try again.', true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send message';
      }
    }
  });
}



/**
 * Run analysis across all 5 modules
 */
async function runComprehensiveAnalysis() {
  const urlInput = document.getElementById('dashboardUrlInput');
  const submitButton = document.getElementById('dashboardAnalyzeButton');
  const errorMessage = document.getElementById('errorMessage');
  const resultsContainer = document.getElementById('dashboardResults');
  
  const url = urlInput.value.trim();
  
  if (!url) {
    showError('Please enter a valid URL');
    return;
  }

  // Disable inputs
  submitButton.disabled = true;
  submitButton.textContent = 'Running audit...';
  urlInput.disabled = true;
  
  // Show unified loading with steps
  window.AnalyzerLoader.show([
    { id: 'init', label: 'Connecting to target...' },
    { id: 'fonts', label: 'Analyzing typography & fonts...' },
    { id: 'seo', label: 'Scanning SEO metrics...' },
    { id: 'performance', label: 'Running performance tests...' },
    { id: 'accessibility', label: 'Checking accessibility compliance...' },
    { id: 'security', label: 'Auditing security headers...' },
    { id: 'compile', label: 'Compiling unified report...' }
  ]);
  
  // Add ASCII art patience message
  const loadingContainer = document.getElementById('loadingContainer');
  if (loadingContainer) {
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
        Running analysis across all categories...
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
    
    // Insert ASCII art at the top of loading container
    const analyzerLoading = loadingContainer.querySelector('.analyzer-loading');
    if (analyzerLoading) {
      analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
    }
  }
  
  errorMessage.style.display = 'none';
  resultsContainer.style.display = 'none';

  try {
    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

    const startTime = Date.now();
    
    // Step 1: Initialize
    window.AnalyzerLoader.updateStep('init', 'active');
    await new Promise(resolve => setTimeout(resolve, 200));
    window.AnalyzerLoader.updateStep('init', 'complete');
    window.AnalyzerLoader.updateProgress(10);
    
    // Run all lightweight analyzers in PARALLEL for speed
    window.AnalyzerLoader.updateStep('fonts', 'active');
    window.AnalyzerLoader.updateStep('seo', 'active');
    window.AnalyzerLoader.updateStep('performance', 'active');
    window.AnalyzerLoader.updateStep('accessibility', 'active');
    window.AnalyzerLoader.updateStep('security', 'active');
    
    // Parallel fetch - all requests start at the same time
    const [fontResults, seoResults, perfResults, a11yResults, securityResults] = await Promise.allSettled([
      // Font scan - lightweight basic mode
      fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode: 'basic', scanStartedAt })
      }).then(r => r.json()),
      
      // SEO - lightweight mode
      fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, forceLightweight: true, source: 'dashboard', skipLighthouse: true, scanStartedAt })
      }).then(r => r.json()),
      
      // Performance - skip Lighthouse for speed
      fetch('/api/performance-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, scanStartedAt })
      }).then(r => r.json()),
      
      // Accessibility - lightweight
      fetch('/api/accessibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, lightweight: true, scanStartedAt })
      }).then(r => r.json()),
      
      // Security - lightweight
      fetch('/api/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, lightweight: true, scanStartedAt })
      }).then(r => r.json())
    ]);
    
    // Update progress as results come in
    window.AnalyzerLoader.updateStep('fonts', fontResults.status === 'fulfilled' ? 'complete' : 'error');
    window.AnalyzerLoader.updateProgress(30);
    window.AnalyzerLoader.updateStep('seo', seoResults.status === 'fulfilled' ? 'complete' : 'error');
    window.AnalyzerLoader.updateProgress(50);
    window.AnalyzerLoader.updateStep('performance', perfResults.status === 'fulfilled' ? 'complete' : 'error');
    window.AnalyzerLoader.updateProgress(70);
    window.AnalyzerLoader.updateStep('accessibility', a11yResults.status === 'fulfilled' ? 'complete' : 'error');
    window.AnalyzerLoader.updateProgress(85);
    window.AnalyzerLoader.updateStep('security', securityResults.status === 'fulfilled' ? 'complete' : 'error');
    window.AnalyzerLoader.updateProgress(95);
    
    // Step 7: Compile report
    window.AnalyzerLoader.updateStep('compile', 'active');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Process results
    dashboardResults = {
      url,
      startedAt: scanStartedAt,
      timestamp: scanStartedAt,
      duration,
      font: fontResults.status === 'fulfilled' ? fontResults.value : { error: fontResults.reason?.message || 'Failed' },
      seo: seoResults.status === 'fulfilled' ? seoResults.value : { error: seoResults.reason?.message || 'Failed' },
      performance: perfResults.status === 'fulfilled' ? perfResults.value : { error: perfResults.reason?.message || 'Failed' },
      accessibility: a11yResults.status === 'fulfilled' ? a11yResults.value : { error: a11yResults.reason?.message || 'Failed' },
      security: securityResults.status === 'fulfilled' ? securityResults.value : { error: securityResults.reason?.message || 'Failed' }
    };

    window.AnalyzerLoader.updateStep('compile', 'complete');
    window.AnalyzerLoader.updateProgress(100);
    
    // Save to ScanContext for cross-page access
    if (window.ScanContext) {
      window.ScanContext.save({
        url,
        selectedUrls: [url],
        selectedModules: ['fonts', 'seo', 'performance', 'accessibility', 'security'],
        results: dashboardResults
      });
    }
    
    // Short delay to show completion
    await new Promise(resolve => setTimeout(resolve, 200));

    // Display results
    displayDashboard(dashboardResults);
    
    // Hide loading
    window.AnalyzerLoader.hide();
    
  } catch (error) {
    console.error('Dashboard analysis error:', error);
    showError(error.message || 'Analysis failed. Please try again.');
    window.AnalyzerLoader.hide();
  } finally {
    // Re-enable inputs
    submitButton.disabled = false;
    submitButton.textContent = 'Run audit';
    urlInput.disabled = false;
  }
}

/**
 * Display dashboard with actionable results
 */
function displayDashboard(data) {
  const container = document.getElementById('dashboardResults');
  container.style.display = 'block';
  container.innerHTML = '';

  // Extract desktop and mobile scores
  const scores = {
    font: extractScores(data.font, 'fonts'),
    seo: extractScores(data.seo, 'seo'),
    performance: extractScores(data.performance, 'performance'),
    accessibility: extractScores(data.accessibility, 'accessibility'),
    security: extractScores(data.security, 'security')
  };

  // Calculate overall health score (average of all desktop and mobile scores)
  const allScores = [];
  Object.values(scores).forEach(scoreObj => {
    if (scoreObj.desktop !== null) allScores.push(scoreObj.desktop);
    if (scoreObj.mobile !== null) allScores.push(scoreObj.mobile);
  });
  const overallScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  // Generate plain-English summary
  const summary = generatePlainEnglishSummary(overallScore, scores, data);
  
  // Get top 3 issues ranked by impact
  const topIssues = getTop3Issues(data, scores);
  
  // Get the single most important next step
  const nextStep = getNextStep(topIssues, scores);

  // Extract domain from URL for display
  let displayDomain = data.url;
  try {
    displayDomain = new URL(data.url.startsWith('http') ? data.url : `https://${data.url}`).hostname;
  } catch (e) {
    displayDomain = data.url;
  }

  // Create summary section - NEW SIMPLIFIED STRUCTURE
  const summaryHTML = `
    <div class="section dashboard-animate-in" style="border-left: 4px solid ${getScoreColor(overallScore)};">
      <div style="display: flex; justify-content: space-between; align-items: center; margin: 0 0 1.25rem 0;">
        <h2 style="color: var(--text-primary); font-size: 1.1rem; font-weight: 600; margin: 0;">Results for ${displayDomain}</h2>
        <button onclick="window.print()" title="Print report" class="text-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
          Print
        </button>
      </div>

      <!-- ROW 1: Site Health Score + Summary Text -->
      <div class="dashboard-animate-in dashboard-animate-in-delay-1" style="
        display: flex;
        align-items: center;
        gap: 2rem;
        padding: 1.5rem;
        background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.05), rgba(var(--accent-primary-rgb), 0.02));
        border: 1px solid ${getScoreColor(overallScore)}40;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        backdrop-filter: blur(8px);
      ">
        <!-- Large Overall Health Circle -->
        <div style="text-align: center; flex-shrink: 0;">
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Site health score</div>
          <svg width="140" height="140" viewBox="0 0 140 140" style="filter: drop-shadow(0 4px 12px ${getScoreColor(overallScore)}40);">
            <circle class="score-ring-bg" cx="70" cy="70" r="58" fill="var(--score-ring-fill, rgba(0,0,0,0.3))" stroke="var(--score-ring-stroke, rgba(255,255,255,0.1))" stroke-width="10" />
            <circle
              class="score-gauge-animated"
              cx="70" cy="70" r="58"
              fill="none"
              stroke="${getScoreColor(overallScore)}"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${(overallScore / 100) * 364.42} 364.42"
              transform="rotate(-90 70 70)"
              style="filter: drop-shadow(0 0 8px ${getScoreColor(overallScore)}80);"
            />
            <text x="70" y="70" text-anchor="middle" dy="0.35em" font-size="2.5rem" font-weight="bold" class="dial-score-text score-text-animated" fill="${getScoreColor(overallScore)}">${overallScore}</text>
          </svg>
          <div style="color: ${getScoreColor(overallScore)}; font-weight: 700; font-size: 1rem; margin-top: 0.5rem;">${getStatus(overallScore)}</div>
        </div>
        
        <!-- Summary Text -->
        <div style="flex: 1;">
          <p style="font-size: 1.25rem; color: var(--text-primary); margin: 0 0 1rem 0; line-height: 1.5; font-weight: 500;">
            ${summary}
          </p>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
            Analyzed: ${data.url} • Started: ${new Date(data.startedAt || data.timestamp).toLocaleString()} • Duration: ${data.duration}s
          </p>
        </div>
      </div>
      
      <!-- ROW 2: Category Breakdown (larger dials) -->
      <div class="dashboard-animate-in dashboard-animate-in-delay-2" style="
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 1rem;
        padding: 1.25rem;
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        margin-bottom: 1rem;
      ">
        ${createMiniScore('Performance', scores.performance, 0)}
        ${createMiniScore('SEO', scores.seo, 1)}
        ${createMiniScore('Accessibility', scores.accessibility, 2)}
        ${createMiniScore('Security', scores.security, 3)}
        ${createMiniScore('Fonts', scores.font, 4)}
      </div>
      
      <!-- ROW 3: Insights -->
      <div class="dashboard-animate-in dashboard-animate-in-delay-3" style="
        padding: 1rem 1.25rem;
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        margin-bottom: 1.5rem;
      ">
        <h3 style="color: var(--text-primary); margin: 0 0 0.75rem 0; font-size: 1rem; font-weight: 700;">Insights</h3>
        <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.8;">
          ${generateInsights(scores, data)}
        </ul>
      </div>
      
      <!-- 4. TOP 3 ISSUES (ranked by impact) -->
      <div style="margin-bottom: 1.5rem;">
        <h3 style="color: var(--text-primary); margin: 0 0 0.75rem 0; font-size: 1rem; font-weight: 600;">Top fixes</h3>
        ${topIssues.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${topIssues.slice(0, 3).map((issue, idx) => `
              <div style="
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1rem;
                background: ${issue.severity === 'critical' ? 'rgba(255,68,68,0.1)' : 'rgba(255,165,0,0.1)'};
                border-left: 3px solid ${issue.severity === 'critical' ? '#ff4444' : '#ffa500'};
                border-radius: 0 6px 6px 0;
              ">
                <span style="
                  width: 20px; height: 20px; border-radius: 50%;
                  background: ${issue.severity === 'critical' ? '#ff4444' : '#ffa500'};
                  color: white; font-size: 0.75rem; font-weight: 600;
                  display: flex; align-items: center; justify-content: center;
                ">${idx + 1}</span>
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${issue.title}</div>
                  <div style="font-size: 0.8rem; color: var(--text-secondary);">${issue.impact}</div>
                </div>
                <a href="${issue.link}" style="color: ${issue.severity === 'critical' ? '#ff4444' : '#ffa500'}; font-size: 0.8rem; text-decoration: none; font-weight: 600;">View fix</a>
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="padding: 1rem; background: rgba(var(--accent-primary-rgb), 0.1); border-radius: 6px; text-align: center;">
            <span style="color: var(--accent-primary); font-weight: 600;">No critical issues found. Your site is in good shape!</span>
          </div>
        `}
      </div>
      
      <!-- 4. CLEAR RECOMMENDATION / NEXT STEP -->
      <div style="
        padding: 1rem 1.25rem;
        background: rgba(var(--accent-primary-rgb), 0.08);
        border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
        border-radius: 8px;
        margin-bottom: 1.5rem;
      ">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
          </svg>
          <div>
            <div style="font-weight: 600; color: var(--accent-primary); font-size: 0.85rem; margin-bottom: 0.25rem;">Recommended next fix</div>
            <div style="color: var(--text-primary); font-size: 0.95rem;">${nextStep.text}</div>
          </div>
          ${nextStep.link ? `<a href="${nextStep.link}" style="margin-left: auto; padding: 0.5rem 1rem; background: var(--accent-primary); color: var(--accent-primary-contrast); font-weight: 600; font-size: 0.85rem; border-radius: 4px; text-decoration: none;">Start</a>` : ''}
        </div>
      </div>
      
      <!-- 5. VIEW DETAILS (optional - collapsed by default) -->
      <details class="accordion" style="margin-bottom: 1rem;">
        <summary class="accordion__header" style="
          cursor: pointer;
          padding: 1rem 1.25rem;
          background: var(--bg-elevated, rgba(255,255,255,0.03));
          border: 1px solid var(--border-color, rgba(255,255,255,0.1));
          border-radius: 8px;
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: space-between;
          list-style: none;
          transition: background 0.2s ease;
        ">
          <span style="font-size: 1rem;">Details & export</span>
          <svg class="accordion__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s ease;"><path d="M6 9l6 6 6-6"/></svg>
        </summary>
        <div class="accordion__body" style="padding: 1.25rem; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-top: none; border-radius: 0 0 8px 8px; background: var(--bg-card, rgba(255,255,255,0.02));">
          
          <!-- Detailed Category Links -->
          <h4 style="color: var(--text-secondary); font-size: 0.85rem; margin: 0 0 1rem 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Explore by Category</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            ${createCategoryLink('Performance & UX', 'Speed, Core Web Vitals, Mobile', '/performance-hub.html', scores.performance, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>')}
            ${createCategoryLink('SEO & Indexing', 'Metadata, Structure, Crawlability', '/seo-analyzer.html', scores.seo, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>')}
            ${createCategoryLink('Accessibility', 'WCAG Compliance, Violations', '/accessibility-analyzer.html', scores.accessibility, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M10.5 8.5h3M8 13h8M8 13v7M16 13v7"/></svg>')}
            ${createCategoryLink('Security & Trust', 'SSL, Headers, Vulnerabilities', '/security-analyzer.html', scores.security, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>')}
            ${createCategoryLink('Fonts', 'Font Loading, Optimization', '/enhanced-fonts.html', scores.font, '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>')}
          </div>
          
          <!-- Export Options -->
          <h4 style="color: var(--text-secondary); font-size: 0.85rem; margin: 0 0 1rem 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Client-Ready Reports</h4>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button onclick="copyShareLink()" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.3); border-radius: 8px; color: var(--accent-primary); cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s ease;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Copy Link
            </button>
          </div>
        </div>
      </details>
    </div>
  `;

  container.innerHTML = summaryHTML;

  // Populate the fixes sidebar for two-column layout
  const fixesSidebar = document.getElementById('fixesSidebar');
  if (fixesSidebar) {
    fixesSidebar.style.display = 'block';
    fixesSidebar.innerHTML = `
      <div class="dashboard-card">
        <h2 class="card-heading">Top fixes</h2>
        ${topIssues.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${topIssues.slice(0, 5).map((issue, idx) => `
              <div style="
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
                padding: 1rem;
                background: ${issue.severity === 'critical' ? 'rgba(255,68,68,0.08)' : 'rgba(255,165,0,0.08)'};
                border-left: 3px solid ${issue.severity === 'critical' ? '#ff4444' : '#ffa500'};
                border-radius: 0 8px 8px 0;
              ">
                <span style="
                  width: 22px; height: 22px; border-radius: 50%;
                  background: ${issue.severity === 'critical' ? '#ff4444' : '#ffa500'};
                  color: white; font-size: 0.75rem; font-weight: 600;
                  display: flex; align-items: center; justify-content: center;
                  flex-shrink: 0;
                ">${idx + 1}</span>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem; margin-bottom: 0.25rem;">${issue.title}</div>
                  <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">${issue.impact}</div>
                  <a href="${issue.link}" style="display: inline-block; margin-top: 0.5rem; color: ${issue.severity === 'critical' ? '#ff4444' : '#ffa500'}; font-size: 0.8rem; text-decoration: none; font-weight: 600;">View fix →</a>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="padding: 1.5rem; background: rgba(var(--accent-primary-rgb), 0.08); border-radius: 8px; text-align: center;">
            <span style="color: var(--accent-primary); font-weight: 600;">✓ No critical issues found</span>
            <p style="margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">Your site is in good shape!</p>
          </div>
        `}
        
        <!-- Recommended next fix -->
        <div style="
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(var(--accent-primary-rgb), 0.08);
          border: 1px solid rgba(var(--accent-primary-rgb), 0.25);
          border-radius: 8px;
        ">
          <div style="font-weight: 600; color: var(--accent-primary); font-size: 0.8rem; margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.03em;">Recommended next fix</div>
          <div style="color: var(--text-primary); font-size: 0.9rem; line-height: 1.4;">${nextStep.text}</div>
          ${nextStep.link ? `<a href="${nextStep.link}" style="display: inline-block; margin-top: 0.75rem; padding: 0.5rem 1rem; background: var(--accent-primary); color: var(--accent-primary-contrast); font-weight: 600; font-size: 0.85rem; border-radius: 6px; text-decoration: none;">Start</a>` : ''}
        </div>
      </div>
    `;
  }

  // Add event listeners for action cards (CSP-compliant)
  const actionCards = container.querySelectorAll('.action-card');
  actionCards.forEach(card => {
    const hoverBorder = card.dataset.hoverBorder;
    const hoverBg = card.dataset.hoverBg;
    const defaultBorder = card.dataset.defaultBorder;
    const defaultBg = card.dataset.defaultBg;

    card.addEventListener('mouseover', function() {
      this.style.borderColor = hoverBorder;
      this.style.background = hoverBg;
    });

    card.addEventListener('mouseout', function() {
      this.style.borderColor = defaultBorder;
      this.style.background = defaultBg;
    });
  });
}

/**
 * Create analyzer dial with desktop and mobile scores
 */
function createAnalyzerDial(name, scores, icon, link) {
  // Handle null or error cases
  if (!scores || (scores.desktop === null && scores.mobile === null)) {
    return `
      <div style="text-align: center; opacity: 0.5;">
        <div style="margin-bottom: 0.5rem; font-weight: 600; color: #808080; font-size: 0.85rem;">${icon} ${name}</div>
        <div style="
          width: 140px; height: 140px; border-radius: 50%; margin: 0 auto;
          background: rgba(0,0,0,0.3); border: 2px dashed rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
        ">
          <span style="color: #808080; font-size: 0.9rem;">N/A</span>
        </div>
        <div style="margin-top: 0.35rem; color: #808080; font-size: 0.85rem;">Error</div>
      </div>
    `;
  }

  // Use average for the dial, or whichever score is available
  const avgScore = scores.desktop !== null && scores.mobile !== null
    ? Math.round((scores.desktop + scores.mobile) / 2)
    : (scores.desktop || scores.mobile);

  const desktopDisplay = scores.desktop !== null ? scores.desktop : 'N/A';
  const mobileDisplay = scores.mobile !== null ? scores.mobile : 'N/A';

  return `
    <div style="text-align: center;">
      <div style="margin-bottom: 0.5rem; font-weight: 600; color: var(--text-primary); font-size: 0.85rem;">${icon} ${name}</div>
      <a href="${link}" style="text-decoration: none; display: inline-block;">
        <svg class="circular-progress" width="140" height="160" viewBox="0 0 140 160" style="cursor: pointer;">
          <!-- Background circle - uses CSS var for light/dark mode -->
          <circle class="score-ring-bg" cx="70" cy="70" r="60" fill="var(--score-ring-fill, rgba(0,0,0,0.3))" stroke="var(--score-ring-track, rgba(100, 100, 100, 0.3))" stroke-width="9" />
          <!-- Colored progress circle -->
          <circle
            cx="70" cy="70" r="60" fill="none"
            stroke="${getScoreColor(avgScore)}"
            stroke-width="9" stroke-linecap="round"
            stroke-dasharray="${(avgScore / 100) * 376.99} 376.99"
            transform="rotate(-90 70 70)"
          />
          <!-- Average score in center -->
          <text x="70" y="70" text-anchor="middle" dy="0.35em" font-size="2.2rem" font-weight="bold" class="dial-score-text">
            ${avgScore}
          </text>
          <!-- Desktop and Mobile labels below -->
          <text x="35" y="145" text-anchor="middle" font-size="0.7rem" fill="#888">Desktop</text>
          <text x="105" y="145" text-anchor="middle" font-size="0.7rem" fill="#888">Mobile</text>
          <!-- Desktop and Mobile scores -->
          <text x="35" y="158" text-anchor="middle" font-size="0.9rem" font-weight="600" fill="${scores.desktop !== null ? getScoreColor(scores.desktop) : '#666'}">
            ${desktopDisplay}
          </text>
          <text x="105" y="158" text-anchor="middle" font-size="0.9rem" font-weight="600" fill="${scores.mobile !== null ? getScoreColor(scores.mobile) : '#666'}">
            ${mobileDisplay}
          </text>
        </svg>
      </a>
      <div style="margin-top: 0.35rem; color: ${getScoreColor(avgScore)}; font-weight: 600; font-size: 0.9rem;">
        ${getStatus(avgScore)}
      </div>
    </div>
  `;
}

/**
 * Create compact category link - shows status indicator without repeating numeric score
 * (Canonical score is displayed in the circular dials above)
 */
function createCategoryLink(title, description, link, scores, icon) {
  // Calculate status from scores
  const avgScore = scores?.desktop !== null && scores?.mobile !== null
    ? Math.round((scores.desktop + scores.mobile) / 2)
    : (scores?.desktop || scores?.mobile || null);
  
  const hasError = avgScore === null;
  const statusLabel = hasError ? 'N/A' : getStatus(avgScore);
  const statusColor = hasError ? '#666' : getScoreColor(avgScore || 0);

  // Detect light mode
  const isLightMode = document.body.classList.contains('white-theme');
  const linkBg = isLightMode ? '#f8f8f8' : 'rgba(255,255,255,0.02)';
  const linkBorder = isLightMode ? '#e0e0e0' : 'rgba(255,255,255,0.08)';
  const titleColor = isLightMode ? '#222' : 'var(--text-primary)';
  const descColor = isLightMode ? '#666' : 'var(--text-secondary)';

  // Create mini dial SVG
  const miniDial = hasError ? `
    <svg width="56" height="56" viewBox="0 0 56 56" style="flex-shrink: 0;">
      <circle class="score-ring-bg" cx="28" cy="28" r="24" fill="var(--score-ring-fill, none)" stroke="var(--score-ring-track, rgba(100,100,100,0.2))" stroke-width="4" stroke-dasharray="3 3" />
      <text x="28" y="28" text-anchor="middle" dy="0.35em" font-size="0.85rem" font-weight="600" fill="#666">--</text>
    </svg>
  ` : `
    <svg width="56" height="56" viewBox="0 0 56 56" style="flex-shrink: 0;">
      <circle class="score-ring-bg" cx="28" cy="28" r="24" fill="var(--score-ring-fill, none)" stroke="var(--score-ring-track, rgba(100,100,100,0.15))" stroke-width="4" />
      <circle 
        cx="28" cy="28" r="24" 
        fill="none" 
        stroke="${statusColor}" 
        stroke-width="4" 
        stroke-linecap="round"
        stroke-dasharray="${(avgScore / 100) * 150.8} 150.8"
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="28" text-anchor="middle" dy="0.35em" font-size="0.95rem" font-weight="700" fill="${statusColor}">${avgScore}</text>
    </svg>
  `;

  return `
    <a href="${link}" class="category-link" style="
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 1.5rem;
      background: ${linkBg};
      border: 1px solid ${linkBorder};
      border-radius: 10px;
      text-decoration: none;
      transition: all 0.2s ease;
    " onmouseover="this.style.borderColor='${statusColor}'; this.style.background='${isLightMode ? '#f0f0f0' : 'rgba(255,255,255,0.05)'}';"
       onmouseout="this.style.borderColor='${linkBorder}'; this.style.background='${linkBg}';">
      ${miniDial}
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 600; color: ${titleColor}; font-size: 1.05rem;">${title}</div>
        <div style="font-size: 0.85rem; color: ${descColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${description}</div>
      </div>
      <div style="
        font-size: 0.8rem;
        font-weight: 600;
        color: ${statusColor};
        flex-shrink: 0;
        text-align: right;
      ">${statusLabel}</div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2" style="flex-shrink: 0; opacity: 0.5;">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </a>
  `;
}

/**
 * Create mini score display for compact category breakdown
 * Enhanced with animations and color-coded scores
 */
function createMiniScore(name, scores, index = 0) {
  const avgScore = scores?.desktop !== null && scores?.mobile !== null
    ? Math.round((scores.desktop + scores.mobile) / 2)
    : (scores?.desktop || scores?.mobile || null);

  // Get color class based on score
  const getScoreColorClass = (score) => {
    if (score >= 80) return 'score-excellent';
    if (score >= 50) return 'score-warning';
    return 'score-poor';
  };

  // Get glow color for hover effect
  const getGlowColor = (score) => {
    if (score >= 80) return 'rgba(16, 185, 129, 0.5)';
    if (score >= 50) return 'rgba(245, 158, 11, 0.5)';
    return 'rgba(239, 68, 68, 0.5)';
  };

  if (avgScore === null) {
    return `
      <div class="mini-score-container mini-score-${index}" style="text-align: center; opacity: 0.5;">
        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.75rem; font-weight: 600;">${name}</div>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle class="score-ring-bg" cx="50" cy="50" r="40" fill="var(--score-ring-fill, none)" stroke="var(--score-ring-track, rgba(100,100,100,0.2))" stroke-width="6" stroke-dasharray="5 5" />
          <text x="50" y="50" text-anchor="middle" dy="0.35em" font-size="1.3rem" font-weight="600" fill="#666">--</text>
        </svg>
      </div>
    `;
  }

  const colorClass = getScoreColorClass(avgScore);
  const glowColor = getGlowColor(avgScore);
  const scoreColor = getScoreColor(avgScore);

  return `
    <div class="mini-score-container mini-score-${index}" style="text-align: center;">
      <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.75rem; font-weight: 600;">${name}</div>
      <svg width="100" height="100" viewBox="0 0 100 100" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
        <circle class="score-ring-bg" cx="50" cy="50" r="40" fill="var(--score-ring-fill, none)" stroke="var(--score-ring-track, rgba(100,100,100,0.2))" stroke-width="6" />
        <circle
          class="score-gauge-mini-animated"
          cx="50" cy="50" r="40"
          fill="none"
          stroke="${scoreColor}"
          stroke-width="6"
          stroke-linecap="round"
          stroke-dasharray="${(avgScore / 100) * 251.33} 251.33"
          transform="rotate(-90 50 50)"
          style="filter: drop-shadow(0 0 6px ${glowColor});"
        />
        <text x="50" y="50" text-anchor="middle" dy="0.35em" font-size="1.75rem" font-weight="700" fill="${scoreColor}">${avgScore}</text>
      </svg>
    </div>
  `;
}

/**
 * Generate plain-English summary of the scan results
 */
function generatePlainEnglishSummary(overallScore, scores, data) {
  const status = getStatus(overallScore);
  
  // Find the weakest area
  const areas = [
    { name: 'performance', score: getAvgScore(scores.performance), label: 'page speed' },
    { name: 'seo', score: getAvgScore(scores.seo), label: 'search visibility' },
    { name: 'accessibility', score: getAvgScore(scores.accessibility), label: 'accessibility' },
    { name: 'security', score: getAvgScore(scores.security), label: 'security' },
    { name: 'font', score: getAvgScore(scores.font), label: 'typography' }
  ].filter(a => a.score !== null).sort((a, b) => a.score - b.score);
  
  const weakest = areas[0];
  const strongest = areas[areas.length - 1];
  
  if (overallScore >= 90) {
    return `Your website is in excellent shape with strong scores across all areas. ${strongest ? `${strongest.label.charAt(0).toUpperCase() + strongest.label.slice(1)} is your strongest area at ${strongest.score}.` : ''}`;
  } else if (overallScore >= 75) {
    return `Your website is performing well overall, but ${weakest ? `${weakest.label} (${weakest.score}) could use some attention` : 'there are a few areas to improve'}.`;
  } else if (overallScore >= 50) {
    return `Your website needs work in several areas. ${weakest ? `Priority: Fix ${weakest.label} issues (currently scoring ${weakest.score}).` : 'Review the issues below to improve.'}`;
  } else {
    return `Your website has critical issues that need immediate attention. ${weakest ? `${weakest.label.charAt(0).toUpperCase() + weakest.label.slice(1)} is the most urgent problem at ${weakest.score}.` : 'Start with the critical issues listed below.'}`;
  }
}

/**
 * Generate up to 5 insights based on scores
 */
function generateInsights(scores, data) {
  const insights = [];
  
  const perfScore = getAvgScore(scores.performance);
  const seoScore = getAvgScore(scores.seo);
  const a11yScore = getAvgScore(scores.accessibility);
  const secScore = getAvgScore(scores.security);
  const fontScore = getAvgScore(scores.font);
  
  // Performance insights
  if (perfScore !== null) {
    if (perfScore >= 90) {
      insights.push('⚡ <strong>Excellent performance</strong> — Your site loads fast, providing a great user experience.');
    } else if (perfScore >= 75) {
      insights.push('⚡ <strong>Good performance</strong> — Page speed is acceptable but has room for optimization.');
    } else if (perfScore >= 50) {
      insights.push('⚠️ <strong>Performance needs work</strong> — Slow loading times may be causing visitors to leave.');
    } else if (perfScore < 50) {
      insights.push('🔴 <strong>Critical performance issue</strong> — Page speed is severely impacting user experience and SEO rankings.');
    }
  } else {
    insights.push('⚡ <strong>Performance not scanned yet</strong> — <a href="/performance-hub.html" style="color: var(--accent-primary);">Run performance scan</a> for detailed analysis.');
  }
  
  // SEO insights
  if (seoScore !== null) {
    if (seoScore >= 90) {
      insights.push('🔍 <strong>SEO is excellent</strong> — Your site is well-optimized for search engines.');
    } else if (seoScore >= 75) {
      insights.push('🔍 <strong>SEO is good</strong> — Most SEO best practices are in place.');
    } else if (seoScore < 75) {
      insights.push('🔍 <strong>SEO improvements needed</strong> — Missing meta tags or structure issues may affect rankings.');
    }
  } else {
    insights.push('🔍 <strong>SEO not scanned yet</strong> — <a href="/seo-analyzer.html" style="color: var(--accent-primary);">Run SEO scan</a> for detailed analysis.');
  }
  
  // Accessibility insights
  if (a11yScore !== null) {
    if (a11yScore >= 90) {
      insights.push('♿ <strong>Accessibility is excellent</strong> — Your site is usable by people with disabilities.');
    } else if (a11yScore >= 75) {
      insights.push('♿ <strong>Accessibility is good</strong> — Most WCAG guidelines are followed.');
    } else if (a11yScore < 75) {
      insights.push('♿ <strong>Accessibility issues found</strong> — Some users may have difficulty using your site.');
    }
  } else {
    insights.push('♿ <strong>Accessibility not scanned yet</strong> — <a href="/accessibility-analyzer.html" style="color: var(--accent-primary);">Run accessibility scan</a> for detailed analysis.');
  }
  
  // Security insights
  if (secScore !== null) {
    if (secScore >= 90) {
      insights.push('🔒 <strong>Security is strong</strong> — SSL and security headers are properly configured.');
    } else if (secScore >= 75) {
      insights.push('🔒 <strong>Security is adequate</strong> — Basic protections are in place but could be stronger.');
    } else if (secScore < 75) {
      insights.push('🔒 <strong>Security vulnerabilities detected</strong> — Missing headers or SSL issues need attention.');
    }
  } else {
    insights.push('🔒 <strong>Security not scanned yet</strong> — <a href="/security-analyzer.html" style="color: var(--accent-primary);">Run security scan</a> for detailed analysis.');
  }
  
  // Font insights
  if (fontScore !== null) {
    if (fontScore >= 90) {
      insights.push('🔤 <strong>Fonts optimized</strong> — Fonts are loading efficiently.');
    } else if (fontScore >= 75) {
      insights.push('🔤 <strong>Fonts are good</strong> — Font usage is reasonable.');
    } else if (fontScore < 75) {
      insights.push('🔤 <strong>Font optimization needed</strong> — Too many fonts or poor loading strategy detected.');
    }
  } else {
    insights.push('🔤 <strong>Fonts not scanned yet</strong> — <a href="/enhanced-fonts.html" style="color: var(--accent-primary);">Run font scan</a> for detailed analysis.');
  }
  
  // Limit to 5 insights
  return insights.slice(0, 5).map(insight => `<li>${insight}</li>`).join('');
}

/**
 * Get average score from desktop/mobile scores object
 */
function getAvgScore(scores) {
  if (!scores) return null;
  if (scores.desktop !== null && scores.mobile !== null) {
    return Math.round((scores.desktop + scores.mobile) / 2);
  }
  return scores.desktop || scores.mobile || null;
}

/**
 * Get top 3 issues ranked by impact
 */
function getTop3Issues(data, scores) {
  const issues = [];
  
  // Performance issues
  const perfScore = getAvgScore(scores.performance);
  if (perfScore !== null && perfScore < 75) {
    issues.push({
      title: 'Slow page load speed',
      impact: perfScore < 50 ? 'Users leave slow sites. Each second of delay costs 7% conversions.' : 'Page could load faster, impacting user experience.',
      severity: perfScore < 50 ? 'critical' : 'warning',
      score: perfScore,
      link: '/performance-hub.html'
    });
  }
  
  // SEO issues
  const seoScore = getAvgScore(scores.seo);
  if (seoScore !== null && seoScore < 75) {
    issues.push({
      title: 'SEO issues affecting search rankings',
      impact: seoScore < 50 ? 'Your site may not appear in search results. Fix meta tags and structure.' : 'Improve metadata to rank higher in search results.',
      severity: seoScore < 50 ? 'critical' : 'warning',
      score: seoScore,
      link: '/seo-analyzer.html'
    });
  }
  
  // Accessibility issues
  const a11yScore = getAvgScore(scores.accessibility);
  if (a11yScore !== null && a11yScore < 75) {
    issues.push({
      title: 'Accessibility barriers detected',
      impact: a11yScore < 50 ? 'Site excludes users with disabilities. May violate ADA/WCAG laws.' : 'Some users may have difficulty using your site.',
      severity: a11yScore < 50 ? 'critical' : 'warning',
      score: a11yScore,
      link: '/accessibility-analyzer.html'
    });
  }
  
  // Security issues
  const secScore = getAvgScore(scores.security);
  if (secScore !== null && secScore < 75) {
    issues.push({
      title: 'Security vulnerabilities found',
      impact: secScore < 50 ? 'Site is at risk of attacks. Missing critical security headers.' : 'Security headers could be strengthened.',
      severity: secScore < 50 ? 'critical' : 'warning',
      score: secScore,
      link: '/security-analyzer.html'
    });
  }
  
  // Typography issues
  const fontScore = getAvgScore(scores.font);
  if (fontScore !== null && fontScore < 75) {
    issues.push({
      title: 'Font loading issues',
      impact: 'Fonts may cause layout shifts or slow rendering.',
      severity: 'warning',
      score: fontScore,
      link: '/enhanced-fonts.html'
    });
  }
  
  // Sort by severity (critical first), then by score (lowest first)
  return issues.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return a.score - b.score;
  }).slice(0, 3);
}

/**
 * Get the single most important next step
 */
function getNextStep(topIssues, scores) {
  if (topIssues.length === 0) {
    return {
      text: 'Your site is in great shape! Consider running a competitive analysis to find optimization opportunities.',
      link: '/competitive-analysis.html'
    };
  }
  
  const topIssue = topIssues[0];
  
  if (topIssue.severity === 'critical') {
    return {
      text: `Fix ${topIssue.title.toLowerCase()} first — this is your highest-impact improvement.`,
      link: topIssue.link
    };
  }
  
  return {
    text: `Review and improve ${topIssue.title.toLowerCase()} to boost your overall score.`,
    link: topIssue.link
  };
}

/**
 * Create action card (kept for backward compatibility, but no longer used in dashboard)
 */
function createActionCard(title, key, scores, data, link, icon) {
  const hasError = data && data.error;
  const limitedNote = data && data.warning
    ? `<div style="margin-top: 0.5rem; color: #ffa500; font-size: 0.8rem;">${data.warning}</div>`
    : '';

  // Calculate average score from desktop/mobile
  const avgScore = scores.desktop !== null && scores.mobile !== null
    ? Math.round((scores.desktop + scores.mobile) / 2)
    : (scores.desktop || scores.mobile || 0);

  const status = hasError ? 'Error' : getStatus(avgScore);
  const statusColor = hasError ? '#ff4444' : getScoreColor(avgScore || 0);

  // Detect light mode
  const isLightMode = document.body.classList.contains('white-theme');
  const cardBg = isLightMode ? '#f5f5f5' : 'rgba(var(--accent-primary-rgb), 0.05)';
  const cardBorder = isLightMode ? '#cccccc' : 'rgba(var(--accent-primary-rgb), 0.2)';
  const cardTitleColor = isLightMode ? '#222' : '#ffffff';
  const cardTextColor = isLightMode ? '#333' : '#808080';
  const detailsColor = 'var(--accent-primary)';
  const borderTopColor = isLightMode ? '#e0e0e0' : 'rgba(255,255,255,0.1)';

  return `
    <a href="${link}" style="text-decoration: none; display: block;">
      <div class="action-card" data-card-key="${key}" style="
        padding: 1.5rem;
        background: ${cardBg};
        border: 1px solid ${cardBorder};
        border-radius: 8px;
        transition: all 0.3s ease;
        cursor: pointer;
      " data-hover-border="var(--accent-primary)" 
        data-hover-bg="rgba(var(--accent-primary-rgb), 0.1)" 
         data-default-border="${cardBorder}" 
         data-default-bg="${cardBg}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div style="color: ${cardTextColor}; line-height: 0;">${icon}</div>
          <div style="
            padding: 0.25rem 0.75rem;
            background: ${statusColor}20;
            border: 1px solid ${statusColor};
            border-radius: 4px;
            color: ${statusColor};
            font-size: 0.85rem;
            font-weight: 600;
          ">${status}</div>
        </div>
        <div style="font-size: 1.1rem; font-weight: 600; color: ${cardTitleColor}; margin-bottom: 0.5rem;">${title}</div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: ${cardTextColor}; font-size: 0.9rem;">Score</span>
          <span style="font-size: 1.5rem; font-weight: bold; color: ${statusColor};">${avgScore !== null ? avgScore : 'N/A'}</span>
        </div>
        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid ${borderTopColor};">
          <span style="color: ${detailsColor}; font-size: 0.9rem;">View Details →</span>
        </div>
        ${limitedNote}
      </div>
    </a>
  `;
}

/**
 * Generate priority recommendations
 */
function generateRecommendations(data) {
  const recommendations = [];
  
  // Check each analyzer for issues
  if (data.seo && data.seo.results && data.seo.results.score.overall < 70) {
    recommendations.push('~ <strong>SEO:</strong> Improve meta tags, headings, and content optimization');
  }
  if (data.performance && data.performance.results && data.performance.results.overallScore < 70) {
    recommendations.push('~ <strong>Performance:</strong> Optimize images, minify resources, and leverage caching');
  }
  if (data.accessibility && data.accessibility.results && data.accessibility.results.overallScore < 70) {
    recommendations.push('~ <strong>Accessibility:</strong> Fix color contrast, add ARIA labels, and improve keyboard navigation');
  }
  if (data.security && data.security.overallScore < 70) {
    recommendations.push('~ <strong>Security:</strong> Add security headers, enable HTTPS, and fix vulnerabilities');
  }
  if (data.font && data.font.overallScore && data.font.overallScore < 70) {
    recommendations.push('~ <strong>Typography:</strong> Optimize font loading and improve typography hierarchy');
  }

  if (recommendations.length === 0) {
    return '<p style="color: var(--accent-primary); margin: 0;">✓ Excellent! All areas are performing well. Keep up the good work!</p>';
  }

  return `
    <ul style="margin: 0; padding-left: 1.5rem; line-height: 1.8;">
      ${recommendations.map(rec => `<li style="color: #ffa500;">${rec}</li>`).join('')}
    </ul>
  `;
}

/**
 * Stage 3: Generate prioritized issues sorted by severity
 * Groups issues into Critical, Warning, and Info categories
 */
function generatePrioritizedIssues(data) {
  const issues = {
    critical: [],
    warning: [],
    info: []
  };

  // Collect issues from all analyzers
  // SEO issues
  if (data.seo?.results?.score?.overall < 50) {
    issues.critical.push({ category: 'SEO', issue: 'Overall SEO health is critical', score: data.seo.results.score.overall });
  } else if (data.seo?.results?.score?.overall < 70) {
    issues.warning.push({ category: 'SEO', issue: 'SEO needs improvement', score: data.seo.results.score.overall });
  }

  // Performance issues  
  if (data.performance?.results?.overallScore < 50 || data.performance?.results?.performanceScore < 50) {
    const score = data.performance?.results?.overallScore || data.performance?.results?.performanceScore;
    issues.critical.push({ category: 'Performance', issue: 'Page load speed is critically slow', score });
  } else if (data.performance?.results?.overallScore < 70 || data.performance?.results?.performanceScore < 70) {
    const score = data.performance?.results?.overallScore || data.performance?.results?.performanceScore;
    issues.warning.push({ category: 'Performance', issue: 'Page performance could be improved', score });
  }

  // Accessibility issues
  if (data.accessibility?.results?.overallScore < 50 || data.accessibility?.results?.accessibilityScore < 50) {
    const score = data.accessibility?.results?.overallScore || data.accessibility?.results?.accessibilityScore;
    issues.critical.push({ category: 'Accessibility', issue: 'Major accessibility barriers detected', score });
  } else if (data.accessibility?.results?.overallScore < 70 || data.accessibility?.results?.accessibilityScore < 70) {
    const score = data.accessibility?.results?.overallScore || data.accessibility?.results?.accessibilityScore;
    issues.warning.push({ category: 'Accessibility', issue: 'Accessibility improvements needed', score });
  }

  // Security issues
  if (data.security?.overallScore < 50) {
    issues.critical.push({ category: 'Security', issue: 'Security vulnerabilities detected', score: data.security.overallScore });
  } else if (data.security?.overallScore < 70) {
    issues.warning.push({ category: 'Security', issue: 'Security headers could be strengthened', score: data.security.overallScore });
  }

  // Typography issues
  if (data.font?.overallScore && data.font.overallScore < 50) {
    issues.warning.push({ category: 'Typography', issue: 'Font loading may impact performance', score: data.font.overallScore });
  }

  // Generate HTML
  const totalIssues = issues.critical.length + issues.warning.length + issues.info.length;
  
  if (totalIssues === 0) {
    return '<p style="color: var(--accent-primary); margin: 0;">✓ No critical or warning issues found. Your site is in good shape!</p>';
  }

  let html = '';
  
  if (issues.critical.length > 0) {
    html += `
      <div style="margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <span style="background: #ff4444; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">CRITICAL</span>
          <span style="color: var(--text-secondary); font-size: 0.85rem;">${issues.critical.length} issue${issues.critical.length > 1 ? 's' : ''}</span>
        </div>
        ${issues.critical.map(i => `
          <div style="display: flex; align-items: center; padding: 0.5rem; background: rgba(255,68,68,0.1); border-radius: 4px; margin-bottom: 0.5rem;">
            <span style="flex: 1;"><strong>${i.category}:</strong> ${i.issue}</span>
            <span style="color: #ff4444; font-size: 0.75rem; font-weight: 600;">FIX NOW →</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (issues.warning.length > 0) {
    html += `
      <div style="margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <span style="background: #ffa500; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">WARNING</span>
          <span style="color: var(--text-secondary); font-size: 0.85rem;">${issues.warning.length} issue${issues.warning.length > 1 ? 's' : ''}</span>
        </div>
        ${issues.warning.map(i => `
          <div style="display: flex; align-items: center; padding: 0.5rem; background: rgba(255,165,0,0.1); border-radius: 4px; margin-bottom: 0.5rem;">
            <span style="flex: 1;"><strong>${i.category}:</strong> ${i.issue}</span>
            <span style="color: #ffa500; font-size: 0.75rem; font-weight: 600;">REVIEW →</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  return html || '<p style="color: var(--text-secondary); margin: 0;">No priority issues to display.</p>';
}

/**
 * Stage 5: Generate actionable improvement guide
 * Provides specific "How to Fix" guidance for each issue area
 * Each improvement answers: What to do, Why it matters, Next steps
 */
function generateImprovementGuide(data) {
  const improvements = [];

  // SEO improvements (threshold: 75 for "Good")
  if (data.seo?.results?.score?.overall < 75) {
    improvements.push({
      category: 'SEO',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
      why: 'Search engines need clear signals to rank your pages. Poor SEO means less organic traffic.',
      actions: [
        'Add unique title tags (50-60 chars) to each page',
        'Write compelling meta descriptions (150-160 chars)',
        'Use proper heading hierarchy (H1 → H2 → H3)',
        'Add alt text to all images'
      ],
      link: '/seo-analyzer.html'
    });
  }

  // Performance improvements (threshold: 75 for "Good")
  if (data.performance?.results?.overallScore < 75 || data.performance?.results?.performanceScore < 75) {
    improvements.push({
      category: 'Performance',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
      why: 'Slow pages lose visitors. Each second of delay reduces conversions by 7%.',
      actions: [
        'Compress and serve images in WebP format',
        'Enable browser caching with proper headers',
        'Minify CSS, JavaScript, and HTML',
        'Implement lazy loading for images below the fold'
      ],
      link: '/performance-hub.html'
    });
  }

  // Accessibility improvements (threshold: 75 for "Good")
  if (data.accessibility?.results?.overallScore < 75 || data.accessibility?.results?.accessibilityScore < 75) {
    improvements.push({
      category: 'Accessibility',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M10.5 8.5h3M8 13h8M8 13v7M16 13v7"/></svg>',
      why: 'Accessibility issues exclude 15% of users and create legal liability (ADA/WCAG).',
      actions: [
        'Ensure color contrast ratio of at least 4.5:1',
        'Add ARIA labels to interactive elements',
        'Make all functionality keyboard accessible',
        'Add skip-to-content links for screen readers'
      ],
      link: '/accessibility-analyzer.html'
    });
  }

  // Security improvements (threshold: 75 for "Good")
  if (data.security?.overallScore < 75) {
    improvements.push({
      category: 'Security',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      why: 'Missing security headers leave your site vulnerable to XSS, clickjacking, and data theft.',
      actions: [
        'Add Content-Security-Policy header',
        'Enable HSTS (Strict-Transport-Security)',
        'Set X-Content-Type-Options: nosniff',
        'Configure X-Frame-Options to prevent clickjacking'
      ],
      link: '/security-analyzer.html'
    });
  }

  // Typography improvements (threshold: 75 for "Good")
  if (data.font?.overallScore && data.font.overallScore < 75) {
    improvements.push({
      category: 'Typography',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
      why: 'Poor font loading causes layout shifts and slow rendering, hurting Core Web Vitals.',
      actions: [
        'Use font-display: swap for web fonts',
        'Preload critical fonts in the <head>',
        'Limit font families to 2-3 maximum',
        'Subset fonts to include only needed characters'
      ],
      link: '/enhanced-fonts.html'
    });
  }

  if (improvements.length === 0) {
    return `
      <div style="text-align: center; padding: 1rem;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" style="margin-bottom: 0.5rem;">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p style="color: var(--accent-primary); margin: 0; font-weight: 600;">Excellent work!</p>
        <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0;">Your site is performing well across all categories. Keep monitoring for changes.</p>
      </div>
    `;
  }

  return `
    <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0 0 1rem 0;">Click each category to see what to fix and why it matters.</p>
    ${improvements.map((imp, idx) => `
    <details style="background: rgba(0, 0, 0, 0.2); border-radius: 8px; margin-bottom: 0.5rem;" ${idx === 0 ? 'open' : ''}>
      <summary style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; cursor: pointer; list-style: none;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--color-warning, #ffa500);">${imp.icon}</span>
          <strong style="color: var(--text-primary);">${imp.category}</strong>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">(${imp.actions.length} fixes)</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s;"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div style="padding: 0 1rem 1rem 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
        <p style="margin: 0.75rem 0 0.5rem 0; font-size: 0.85rem; color: var(--text-secondary); font-style: italic;">Why it matters: ${imp.why}</p>
        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.25rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">
          ${imp.actions.map(action => `<li>${action}</li>`).join('')}
        </ul>
        </ul>
        <a href="${imp.link}" style="display: inline-block; margin-top: 0.75rem; color: var(--accent-primary); font-size: 0.85rem; text-decoration: none;">View Full Report →</a>
      </div>
    </details>
  `).join('')}`;
}

/**
 * Export PDF report (Stage 4)
 * NOTE: PDF exports are now handled in the Performance Hub (/performance-hub.html)
 * This keeps the business model consistent - PDF exports are available for $5 paid reports
 */
// function exportPDF() {
//   if (!dashboardResults) {
//     alert('No results to export. Please run a scan first.');
//     return;
//   }
//   // For now, show message - PDF generation to be implemented
//   alert('PDF export coming soon! For now, you can print this page to PDF using Ctrl/Cmd+P.');
// }

/**
 * Copy shareable link (Stage 4) - GATED BEHIND PAYMENT
 */
function copyShareLink() {
  // Check Pro status before sharing
  if (window.ExportGate && !window.ExportGate.isPro()) {
    window.ExportGate.showPaywall();
    return;
  }
  
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    // Show temporary success message
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
    btn.style.borderColor = 'var(--accent-primary)';
    btn.style.color = 'var(--accent-primary)';
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 2000);
  });
}

function getAccentPrimaryHex() {
  const computed = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-primary')
    .trim();
  if (computed) return computed;

  const isLight = document.body?.classList?.contains('white-theme');
  return isLight ? '#dd3838' : '#5bf4e7';
}

/**
 * Extract desktop and mobile scores from analyzer result
 */
function extractScores(data, type) {
  if (!data) {
    return { desktop: null, mobile: null };
  }

  if (data.error) {
    return { desktop: null, mobile: null };
  }
  switch(type) {
    case 'fonts': {
      // Font scanner may return desktop/mobile font data separately
      if (data.success && data.results) {
        const fontCount = data.results.fonts?.totalFonts || 0;
        // Calculate simple score based on font count (optimal is 2-4 fonts)
        let score = 50;
        if (fontCount === 0) score = 30;
        else if (fontCount <= 2) score = 100;
        else if (fontCount <= 4) score = 90;
        else if (fontCount <= 6) score = 75;
        else if (fontCount <= 8) score = 60;
        else score = 40;

        // Fonts don't distinguish desktop/mobile, so use same score
        return { desktop: score, mobile: score };
      }
      return { desktop: null, mobile: null };
    }

    case 'seo': {
      // SEO returns single overall score (no desktop/mobile distinction)
      const seoScore = data.results?.score?.overall || data.score?.overall || null;
      return { desktop: seoScore, mobile: seoScore };
    }

    case 'performance': {
      // Performance has multiple possible formats
      let score = null;

      // Check for performanceSnapshot format (top-level performanceScore)
      if (data.performanceScore !== undefined) {
        score = data.performanceScore;
        return { desktop: score, mobile: score };
      }

      // Check for nested desktop/mobile breakdown in results
      let desktopScore = null;
      let mobileScore = null;
      
      if (data.results?.desktop?.performanceScore !== undefined) {
        desktopScore = data.results.desktop.performanceScore;
      }
      if (data.results?.mobile?.performanceScore !== undefined) {
        mobileScore = data.results.mobile.performanceScore;
      }

      // Fallback: use top-level score for both if no breakdown
      if (desktopScore === null && mobileScore === null) {
        const overallScore = data.results?.performanceScore ||
                            data.results?.overallScore ||
                            data.score ||
                            null;
        return { desktop: overallScore, mobile: overallScore };
      }

      return { desktop: desktopScore, mobile: mobileScore };
    }

    case 'accessibility': {
      // Accessibility has desktop/mobile results nested in data.results
      let desktopScore = null;
      let mobileScore = null;

      // Check for nested desktop/mobile breakdown in results
      if (data.results?.desktop?.accessibilityScore !== undefined) {
        desktopScore = data.results.desktop.accessibilityScore;
      }
      if (data.results?.mobile?.accessibilityScore !== undefined) {
        mobileScore = data.results.mobile.accessibilityScore;
      }

      // Fallback: use overall score for both if no breakdown
      if (desktopScore === null && mobileScore === null) {
        const overallScore = data.accessibilityScore ||
                            data.results?.accessibilityScore ||
                            data.results?.overallScore ||
                            null;
        return { desktop: overallScore, mobile: overallScore };
      }

      return { desktop: desktopScore, mobile: mobileScore };
    }

    case 'security': {
      // Security returns overallScore at top level or in results
      let score = null;
      
      // Check top-level overallScore first (most common format)
      if (data.overallScore !== undefined && data.overallScore !== null) {
        score = data.overallScore;
        return { desktop: score, mobile: score };
      }
      
      // Check results.overallScore
      if (data.results?.overallScore !== undefined) {
        score = data.results.overallScore;
        return { desktop: score, mobile: score };
      }
      
      // Check for securityScore
      if (data.securityScore !== undefined) {
        score = data.securityScore;
        return { desktop: score, mobile: score };
      }
      
      // Check for desktop/mobile breakdown
      let desktopScore = null;
      let mobileScore = null;

      if (data.desktop && !data.desktop.error) {
        desktopScore = data.desktop.securityScore || data.desktop.overallScore || null;
      }

      if (data.mobile && !data.mobile.error) {
        mobileScore = data.mobile.securityScore || data.mobile.overallScore || null;
      }

      if (desktopScore !== null || mobileScore !== null) {
        return { desktop: desktopScore, mobile: mobileScore };
      }
      return { desktop: null, mobile: null };
    }

    default:
      return { desktop: null, mobile: null };
  }
}

/**
 * Extract single score from analyzer result (legacy function)
 * Returns average of desktop and mobile scores
 */
function extractScore(data, type) {
  const scores = extractScores(data, type);

  // Return average of desktop and mobile, or whichever is available
  if (scores.desktop !== null && scores.mobile !== null) {
    return Math.round((scores.desktop + scores.mobile) / 2);
  }
  return scores.desktop || scores.mobile || null;
}

/**
 * Get score color - Standardized status colors
 * Excellent (90-100): Green
 * Good (75-89): Teal/Cyan
 * Needs Work (50-74): Orange
 * Critical (<50): Red
 */
function getScoreColor(score) {
  if (score >= 90) return getAccentPrimaryHex(); // Excellent: Theme accent
  if (score >= 75) return '#00bcd4';  // Good: Teal/Cyan
  if (score >= 50) return '#ffa500';  // Needs Work: Orange
  return '#ff4444';                   // Critical: Red
}

/**
 * Get status label for score
 * Answers: "What does this score mean?"
 */
function getStatus(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

/**
 * @deprecated Use getStatus() instead
 */
function getGrade(score) {
  return getStatus(score);
}

/**
 * Show error message
 */
function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';

  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

/**
 * Initialize PDF Export
 * Called after page load to set up PDF export functionality
 */
function initDashboardPDFExport() {
  if (typeof initPDFExport === 'function') {
    initPDFExport({
      contentSelector: '#results',
      buttonSelector: '#exportPdfBtn, .export-pdf-btn',
      reportSubtitle: 'Comprehensive Website Analysis',
      urlInputSelector: '#urlInput',
      filename: `site-mechanic-dashboard-${new Date().toISOString().split('T')[0]}.pdf`
    });
  } else {
  }
}

// Initialize PDF export when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboardPDFExport);
} else {
  // DOMContentLoaded already fired
  initDashboardPDFExport();
}
