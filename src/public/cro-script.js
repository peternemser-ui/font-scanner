// CRO Analyzer Script
// Uses AnalyzerLoader for consistent loading UI

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'cro-analysis';
document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);

const btn = document.getElementById('analyzeBtn');
const results = document.getElementById('results');

btn.addEventListener('click', analyzeCRO);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyzeCRO();
});

// Analysis steps for the loader
const analysisSteps = [
  { label: 'Initializing analysis', detail: 'Connecting to target website...' },
  { label: 'Scanning CTAs', detail: 'Detecting call-to-action buttons...' },
  { label: 'Analyzing forms', detail: 'Evaluating form conversion elements...' },
  { label: 'Checking trust signals', detail: 'Finding credibility indicators...' },
  { label: 'Testing mobile UX', detail: 'Evaluating mobile experience...' },
  { label: 'Generating CRO report', detail: 'Calculating conversion potential...' }
];

async function analyzeCRO() {
  const url = document.getElementById('url').value.trim();
  
  if (!url) {
    alert('Please enter a URL');
    return;
  }
  
  // Clear report metadata from previous scans
  document.body.removeAttribute('data-report-id');
  document.body.removeAttribute('data-sm-screenshot-url');
  document.body.removeAttribute('data-sm-scan-started-at');
  
  btn.disabled = true;
  const buttonText = btn.querySelector('#buttonText') || btn;
  buttonText.textContent = 'Analyzing...';
  
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
      CRO analysis in progress...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(var(--accent-primary-rgb), 0.7); padding: 0 0.5rem;">
      This may take 20-30 seconds
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
  
  loader.start(analysisSteps, '[CRO ANALYZER]', 25);
  
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
    
    const response = await fetch('/api/cro-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, scanStartedAt })
    });
    
    loader.nextStep(2);
    loader.nextStep(3);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Server returns { error: "Error", message: "actual error message" }
      const errorMsg = errorData.message || errorData.error || 'Analysis failed - please try again';
      throw new Error(errorMsg);
    }
    
    const data = await response.json();
    
    // Set report metadata from API response
    const reportId = data && data.reportId ? String(data.reportId) : '';
    const screenshotUrl = data && data.screenshotUrl ? String(data.screenshotUrl) : '';
    if (reportId) {
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
    
  } catch (error) {
    const message = error.message || 'Unknown error occurred';
    // Show user-friendly message for timeout errors
    if (message.includes('timeout') || message.includes('Timeout')) {
      alert('The website took too long to respond. Please try a different site or try again later.');
    } else {
      alert(`Error: ${message}`);
    }
    loader.complete();
  } finally {
    btn.disabled = false;
    const buttonText = btn.querySelector('#buttonText') || btn;
    buttonText.textContent = 'Analyze';
  }
}

function displayResults(data) {
  const resultsContainer = document.getElementById('results');
  const url = document.getElementById('url').value;
  const timestamp = new Date().toLocaleString();
  const startedAt = document.body.getAttribute('data-sm-scan-started-at') || new Date().toISOString();
  const reportId = data.reportId || `cro_${btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
  const screenshotBase = data.screenshotUrl || document.body.getAttribute('data-sm-screenshot-url') || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');
  const screenshotUrl = screenshotBase ? `${screenshotBase}${screenshotBase.includes('?') ? '&' : '?'}t=${Date.now()}` : '';
  
  // Store results globally for PDF generation
  window.currentCROResults = data;

  // Check if shared components are loaded
  if (typeof ReportShell === 'undefined' || typeof ReportAccordion === 'undefined') {
    console.error('Shared report components not loaded');
    resultsContainer.innerHTML = '<div style="color: red; padding: 2rem;">Error: Report components failed to load. Please refresh the page.</div>';
    return;
  }

  if (screenshotUrl) {
    document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
  }

  // Check if report is unlocked (purchased)
  const isReportUnlocked = (id) => {
    if (reportId && window.CreditsManager) {
      if (typeof window.CreditsManager.isUnlocked === 'function') return window.CreditsManager.isUnlocked(id);
      if (typeof window.CreditsManager.isReportUnlocked === 'function') return window.CreditsManager.isReportUnlocked(id);
    }
    return false;
  };

  const isUnlocked = isReportUnlocked(reportId);

  // Preview content for locked state (matches SEO pattern)
  const croFixesPreview = renderCROFixesPreview([
    'CTA placement optimization',
    'Form conversion improvements',
    'Trust signal enhancements'
  ]);

  const sections = [
    {
      id: 'cro-cta',
      title: 'Call-to-Action Analysis',
      scoreTextRight: `${data.scores.cta}/100`,
      contentHTML: `<div class="report-shell__card">${renderCTAContent(data.analysis.ctas)}</div>`
    },
    {
      id: 'cro-forms',
      title: 'Form Optimization',
      scoreTextRight: `${data.scores.form}/100`,
      contentHTML: `<div class="report-shell__card">${renderFormContent(data.analysis.forms)}</div>`
    },
    {
      id: 'cro-trust',
      title: 'Trust Signals',
      scoreTextRight: `${data.scores.trust}/100`,
      contentHTML: `<div class="report-shell__card">${renderTrustContent(data.analysis.trustSignals)}</div>`
    },
    {
      id: 'cro-mobile',
      title: 'Mobile Experience',
      scoreTextRight: `${data.scores.mobile}/100`,
      contentHTML: `<div class="report-shell__card">${renderMobileContent(data.analysis.mobileUX)}</div>`
    },
    {
      id: 'report-recommendations',
      title: 'Fix Code + Recommendations',
      scoreTextRight: data.score ? `${data.score}/100` : null,
      isPro: true,
      locked: !isUnlocked,
      context: 'cro',
      reportId,
      contentHTML: isUnlocked ? renderCROFixes(data) : croFixesPreview
    }
  ];

  const summary = [
    { label: 'Overall CRO', score: data.score },
    { label: 'CTAs', score: data.scores.cta },
    { label: 'Forms', score: data.scores.form },
    { label: 'Trust Signals', score: data.scores.trust }
  ];

  // Summary stats
  const highPriorityCount = data.recommendations.filter(r => r.priority === 'high').length;
  const summaryStats = {
    issues: highPriorityCount,
    recommendations: data.recommendations.length,
    checks: 0
  };

  const screenshots = screenshotUrl
    ? [{ src: screenshotUrl, alt: 'Page screenshot', device: '' }]
    : [];

  const reportHTML = (window.ReportContainer && typeof window.ReportContainer.create === 'function')
    ? window.ReportContainer.create({
        url,
        timestamp: startedAt,
        mode: 'cro',
        title: 'CRO Report: Conversion Optimization',
        subtitle: '',
        summary,
        sections,
        screenshots,
        proBlock: true,
        proBlockOptions: {
          context: 'cro',
          features: ['pdf', 'csv', 'share'],
          title: 'Unlock Report',
          subtitle: 'PDF export, share link, export data, and fix packs for this scan.',
          reportId
        }
      })
    : `
      ${(window.ReportShell && typeof window.ReportShell.renderReportHeader === 'function')
        ? window.ReportShell.renderReportHeader({
            title: 'CRO Report: Conversion Optimization',
            url,
            timestamp: startedAt,
            badgeText: '',
            mode: 'cro'
          })
        : `<h2>Conversion Optimization Analysis</h2>`
      }
    `;

  const html = `
    ${reportHTML}
    ${renderCROSummarySection(summaryStats)}
    ${renderCROTakeActionSection(url)}
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
}

// Reveal CRO PRO content (remove lock overlays)
function revealCROProContent() {
  const lockOverlays = document.querySelectorAll('.report-scope .accordion-section[data-accordion-section="report-recommendations"] .lock-overlay, .report-scope .pro-lock-overlay');
  lockOverlays.forEach(overlay => overlay.remove());

  const proBadges = document.querySelectorAll('.report-scope .accordion-section[data-accordion-section="report-recommendations"] .pro-badge');
  proBadges.forEach(badge => badge.remove());

  const lockedSections = document.querySelectorAll('.report-scope .accordion-section[data-accordion-section="report-recommendations"].locked');
  lockedSections.forEach(section => section.classList.remove('locked'));
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

  tryReload();
}

function renderCROSummarySection(stats) {
  return `
    <div class="section">
      <h2>Summary</h2>
      <div class="seo-summary">
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-value">${stats.issues}</span>
            <span class="stat-label">High Priority</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${stats.recommendations}</span>
            <span class="stat-label">Total Recommendations</span>
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
          features: ['pdf', 'csv', 'share'],
          title: 'Unlock Report',
          subtitle: 'PDF export, share link, export data, and fix packs for this scan.'
        })}
      </div>
    `;
  } else {
    // Fallback/legacy code
    return `
      <div class="section">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding-top: 1rem; border-top: 1px solid rgba(var(--accent-primary-rgb), 0.2);">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: var(--accent-primary); font-weight: 600;">Take Action</span>
            <span style="color: #666; font-size: 0.9rem;">Export or share this CRO report</span>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button onclick="copyCROShareLink()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.05); color: #fff; cursor: pointer; font-weight: 600;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Share Link
            </button>
            <button onclick="downloadCROCSV()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.05); color: #fff; cursor: pointer; font-weight: 600;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7"/><path d="M3 7h18"/><path d="M10 11h4"/><path d="M10 15h4"/><path d="M6 11h.01"/><path d="M6 15h.01"/><path d="M18 11h.01"/><path d="M18 15h.01"/></svg>
              Export Data
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// Stub functions for share/export
window.copyCROShareLink = function() { alert('Share link coming soon'); };
window.downloadCROCSV = function() { alert('CSV export coming soon'); };

// ============================================================
// CRO Fixes (following SEO pattern with tabs + accordions)
// ============================================================

function renderCROFixesPreview(previewLines = []) {
  const lines = previewLines.length
    ? previewLines
    : ['CTA placement optimization', 'Form conversion improvements', 'Trust signal enhancements'];

  return `
    <div>
      <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
        Preview of fix packs:
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
      <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">✓</span> Excellent CRO!
        </h3>
        <p style="color: #86efac; margin: 0;">Your site follows conversion optimization best practices. Keep monitoring for continued success.</p>
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
        <span style="font-size: 1.75rem;">🎯</span> CRO Fixes
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${fixes.length} improvements found)</span>
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
      <div class="cro-fix-header" onclick="toggleCROFixAccordion('${accordionId}')" style="
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
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">${fix.category || 'CRO Optimization'}</p>
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
          <span class="cro-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="cro-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
          ${renderCROFixTabs(fix, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderCROFixTabs(fix, accordionId) {
  return `
    <div class="cro-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="cro-fix-tab active" onclick="switchCROFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 Summary</button>
      <button class="cro-fix-tab" onclick="switchCROFixTab('${accordionId}', 'code')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 Code</button>
      <button class="cro-fix-tab" onclick="switchCROFixTab('${accordionId}', 'guide')" style="
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
    <div class="cro-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: #ccc; line-height: 1.7; margin: 0 0 1rem 0;">
        ${fix.description}
      </p>
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ Expected Impact</div>
        <div style="color: #c0c0c0; font-size: 0.9rem;">${fix.impact}</div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="cro-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Current Issue -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
            <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ Current Issue</span>
            <button onclick="copyCROCode('${accordionId}-problem')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeCROHtml(fix.problematicCode || fix.currentIssue || '<!-- Missing or incorrect implementation -->')}</pre>
        </div>

        <!-- Fixed Code -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ Recommended Fix</span>
            <button onclick="copyCROCode('${accordionId}-solution')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeCROHtml(fix.snippet || fix.fixedCode)}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="cro-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
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
      'Open your CSS and find button/link styles',
      'Set min-height: 44px and min-width: 44px on all interactive elements',
      'Add padding: 12px 24px to buttons for comfortable touch',
      'Set body font-size to 16px to prevent iOS zoom on inputs',
      'Use Chrome DevTools mobile emulation to test (F12 → Toggle Device)',
      'Test on actual iOS and Android devices before deploying'
    ];
  }
  
  // CTA / button / above fold
  if (title.includes('cta') || title.includes('button') || title.includes('fold') || title.includes('call-to-action')) {
    return [
      'Identify the primary action you want visitors to take',
      'Place a prominent CTA button in the hero section (above the fold)',
      'Use action-oriented text: "Get Started", "Try Free", "Book Now"',
      'Apply high-contrast colors (e.g., orange or green on dark backgrounds)',
      'Add visual weight with padding, shadows, or borders',
      'Test button visibility on mobile without scrolling'
    ];
  }
  
  // Form optimization
  if (title.includes('form') || title.includes('input') || title.includes('field') || title.includes('label')) {
    return [
      'Reduce form fields to 3-5 essential ones (name, email, message)',
      'Add visible <label> elements above each input field',
      'Mark required fields with * and aria-required="true"',
      'Use descriptive placeholders like "you@company.com"',
      'Add helpful error messages that explain how to fix issues',
      'Include a trust message near the submit button ("🔒 Your info is safe")'
    ];
  }
  
  // Trust signals
  if (title.includes('trust') || title.includes('security') || title.includes('testimonial') || title.includes('review') || title.includes('badge')) {
    return [
      'Add SSL/security badges near payment forms and checkout buttons',
      'Display customer testimonials with real names and photos',
      'Show star ratings or review counts (e.g., "4.9/5 from 2,000+ reviews")',
      'Include money-back guarantee or free trial messaging',
      'Add logos of trusted partners, certifications, or media mentions',
      'Place trust signals near conversion points, not just in the footer'
    ];
  }
  
  // Font / text / readability
  if (title.includes('font') || title.includes('text') || title.includes('readability') || title.includes('size')) {
    return [
      'Set base body font-size to 16px (minimum for mobile)',
      'Use line-height: 1.5 to 1.6 for comfortable reading',
      'Limit paragraph width to 65-75 characters with max-width',
      'Ensure color contrast ratio is at least 4.5:1 (use WebAIM checker)',
      'Choose a legible system font stack or Google Font',
      'Test on mobile devices to verify readability'
    ];
  }
  
  // Contrast / color / visibility
  if (title.includes('contrast') || title.includes('color') || title.includes('visibility')) {
    return [
      'Check color contrast with WebAIM Contrast Checker tool',
      'Ensure text has at least 4.5:1 contrast ratio against background',
      'Use bold or larger text for important elements (14px minimum)',
      'Avoid light gray text on white backgrounds',
      'Make CTAs stand out with high-contrast button colors',
      'Test with browser grayscale mode to verify visibility'
    ];
  }
  
  // Speed / performance
  if (title.includes('speed') || title.includes('load') || title.includes('performance') || title.includes('slow')) {
    return [
      'Compress images using tools like TinyPNG or Squoosh',
      'Enable lazy loading for images below the fold',
      'Minimize CSS and JavaScript files',
      'Use a CDN for faster global delivery',
      'Remove unused plugins and scripts',
      'Test with Google PageSpeed Insights and fix flagged issues'
    ];
  }
  
  // Generic fallback with useful steps
  return [
    'Review the current implementation in your browser DevTools',
    'Identify the specific element or section that needs improvement',
    'Apply the recommended code changes from the Code tab',
    'Test the changes on desktop and mobile devices',
    'Verify the improvement with A/B testing if possible',
    'Monitor conversion metrics after deployment'
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

  const activeTab = Array.from(tabs).find(tab => tab.textContent.toLowerCase().includes(tabName));
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
      btn.textContent = '✓ Copied!';
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
    
    cards.push({
      id: `rec-${idx}`,
      title: rec.message || rec.title || 'Optimization Opportunity',
      severity,
      category: rec.category || getCROCategory(rec),
      impact: rec.impact || 'Improved conversion rate',
      description: rec.detail || rec.description || 'Apply this recommendation to improve conversions.',
      problematicCode: rec.currentCode || generateCROProblemCode(rec),
      snippet: rec.fixedCode || generateCROFixCode(rec),
      steps: rec.steps || []
    });
  });

  // Add quick wins as cards
  quickWins.forEach((win, idx) => {
    cards.push({
      id: `qw-${idx}`,
      title: win.title || 'Quick Win',
      severity: 'Low',
      category: 'Quick Win',
      impact: win.impact || '+5-15% conversions',
      description: `${win.title}. Estimated time: ${win.timeEstimate || '5 min'}`,
      problematicCode: generateQuickWinProblemCode(win),
      snippet: generateQuickWinFixCode(win),
      steps: win.steps || []
    });
  });

  // CTA fixes based on analysis
  if (ctas.aboveFold === false || ctas.count === 0) {
    cards.push({
      id: 'cta-fold',
      title: 'Add a CTA above the fold',
      severity: 'High',
      category: 'CTAs',
      impact: 'Increase conversions by 20-30%',
      description: 'Visitors should see a clear call-to-action without scrolling. Currently, no CTA is visible above the fold.',
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
        'Identify your most important CTA button',
        'Move it to be visible without scrolling',
        'Use contrasting colors to make it stand out'
      ]
    });
  }

  // Form optimization fixes
  if (forms.count > 0 && (forms.avgFields > 5 || !forms.hasLabels)) {
    cards.push({
      id: 'form-optimize',
      title: 'Optimize form for conversions',
      severity: 'Medium',
      category: 'Forms',
      impact: 'Reduce form abandonment by 15-25%',
      description: forms.avgFields > 5 
        ? `Forms have ${forms.avgFields} fields on average. Consider reducing to 3-5 essential fields.`
        : 'Forms are missing proper labels which hurts accessibility and conversions.',
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
        'Reduce form fields to 3-5 essential ones',
        'Add visible labels above each field',
        'Mark required fields clearly',
        'Use a compelling submit button text'
      ]
    });
  }

  // Trust signal fixes
  if (!trust.hasSecurityBadges && !trust.hasTestimonials) {
    cards.push({
      id: 'trust-signals',
      title: 'Add trust signals',
      severity: 'Medium',
      category: 'Trust Signals',
      impact: 'Increase trust and conversions by 10-20%',
      description: 'No security badges or testimonials detected. Adding trust elements can significantly boost conversions.',
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
        'Add security badges near payment forms',
        'Include customer testimonials or reviews',
        'Display any certifications or partner logos',
        'Use "Secure Checkout" language on buttons'
      ]
    });
  }

  // Mobile UX fixes
  if (mobile.score && mobile.score < 70) {
    cards.push({
      id: 'mobile-ux',
      title: 'Improve mobile experience',
      severity: 'High',
      category: 'Mobile Experience',
      impact: 'Mobile users make up 60%+ of traffic',
      description: `Mobile UX score is ${mobile.score}/100. Improving mobile experience is critical for conversions.`,
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
        'Increase base font size to 16px minimum',
        'Make buttons at least 44x44px',
        'Ensure form inputs are at least 16px font',
        'Test on actual mobile devices'
      ]
    });
  }

  return cards;
}

function getCROCategory(rec) {
  const msg = (rec.message || rec.title || '').toLowerCase();
  if (msg.includes('cta') || msg.includes('button') || msg.includes('click')) return 'CTAs';
  if (msg.includes('form') || msg.includes('input') || msg.includes('field')) return 'Forms';
  if (msg.includes('trust') || msg.includes('security') || msg.includes('badge')) return 'Trust Signals';
  if (msg.includes('mobile') || msg.includes('responsive') || msg.includes('touch') || msg.includes('tap')) return 'Mobile Experience';
  return 'CRO Optimization';
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
<button style="background: #ccc; color: #999;">
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
  color: #999;            /* Low contrast */
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
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <span style="font-size: 1.75rem;">⚡</span>
        <h2 style="margin: 0; color: #ffd700; font-size: 1.4rem;">Quick Wins</h2>
        <span style="
          background: rgba(255, 215, 0, 0.2);
          color: #ffd700;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        ">High Impact • Low Effort</span>
      </div>
      <p style="color: #c0c0c0; margin: 0 0 1.5rem 0; font-size: 0.95rem;">
        These fixes take just minutes but can significantly improve your conversions.
      </p>
      
      <div style="display: grid; gap: 1rem;">
        ${quickWins.map((win, index) => `
          <div style="
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 215, 0, 0.3);
            border-radius: 10px;
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
              border-radius: 10px;
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
              <h3 style="margin: 0 0 0.5rem 0; color: #fff; font-size: 1.1rem;">${win.title}</h3>
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
                <div style="color: #808080; font-size: 0.75rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">How to fix:</div>
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
        color: #808080;
        font-size: 0.85rem;
      ">
        <span>💡</span>
        <span>Implementing all quick wins could improve conversions by <strong style="color: #ffd700;">30-50%</strong></span>
      </div>
    </div>
  `;
}

function getGradeName(grade) {
  const names = {
    'A': 'Excellent',
    'B': 'Good', 
    'C': 'Fair',
    'D': 'Poor',
    'F': 'Critical'
  };
  return names[grade] || 'Unknown';
}

function renderCTAContent(ctas) {
  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 0.75rem 0; font-size: 1rem;">>> Call-to-Action Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        CTAs are the primary conversion elements on your page. Strong, visible CTAs with action-oriented text drive conversions.
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
          <div style="color: #c0c0c0; margin-top: 0.5rem;">Total CTAs Found</div>
        </div>
        <div style="
          background: rgba(0, 200, 255, 0.05);
          border: 1px solid rgba(0, 200, 255, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="font-size: 3rem; font-weight: 900; color: #00c8ff;">${ctas.visible}</div>
          <div style="color: #c0c0c0; margin-top: 0.5rem;">Above the Fold</div>
        </div>
      </div>
      
      ${ctas.examples.length > 0 ? `
        <h4 style="color: #bb86fc; margin: 1.5rem 0 1rem 0;">CTA Examples Found:</h4>
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
          ⚠️ No action-oriented CTAs detected. Add buttons with text like "Get Started", "Sign Up", or "Buy Now".
        </div>
      `}
    </div>
  `;
}

function renderFormContent(forms) {
  if (forms.count === 0) {
    return `
      <div>
        <h3 style="color: #ff8c00; margin: 0 0 1rem 0;">>> Form Analysis</h3>
        <div style="
          background: rgba(255, 140, 0, 0.1);
          border: 1px solid rgba(255, 140, 0, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
          <p style="color: #ff8c00; font-weight: bold; margin: 0;">No forms detected on this page</p>
          <p style="color: #c0c0c0; margin: 0.5rem 0 0 0; font-size: 0.9rem;">
            Consider adding a contact form or lead capture form to improve conversions.
          </p>
        </div>
      </div>
    `;
  }
  
  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> Form Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem;">
        Forms are critical for lead capture. Optimize field count, validation, and user experience for higher completion rates.
      </p>
      
      <div style="overflow-x: auto; margin-bottom: 1rem;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #333;">
              <th style="text-align: left; padding: 0.75rem; color: #bb86fc;">Form</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">Fields</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">Email</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">Phone</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">Validation</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">Autocomplete</th>
            </tr>
          </thead>
          <tbody>
            ${forms.details.map((form, idx) => `
              <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 0.75rem; color: #c0c0c0;">Form ${idx + 1}</td>
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
        <h4 style="color: #bb86fc; margin: 0 0 0.5rem 0; font-size: 0.95rem;">💡 Form Optimization Tips</h4>
        <ul style="color: #c0c0c0; margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
          <li>Keep forms under 5 fields when possible</li>
          <li>Use autocomplete to speed up form filling</li>
          <li>Add inline validation for better UX</li>
        </ul>
      </div>
    </div>
  `;
}

function renderTrustContent(trust) {
  const signals = [
    { key: 'hasSSL', label: 'SSL Certificate', icon: '🔒', desc: 'Secure HTTPS connection' },
    { key: 'hasTestimonials', label: 'Testimonials', icon: '💬', desc: 'Customer reviews visible' },
    { key: 'hasSocialProof', label: 'Social Proof', icon: '👥', desc: 'Trust badges or certifications' },
    { key: 'hasContactInfo', label: 'Contact Information', icon: '📞', desc: 'Phone number displayed' },
    { key: 'hasPrivacyPolicy', label: 'Privacy Policy', icon: '📋', desc: 'Privacy policy link found' },
    { key: 'hasSecurityBadges', label: 'Security Badges', icon: '🛡️', desc: 'Security seals visible' }
  ];

  const presentCount = signals.filter(s => trust[s.key]).length;
  
  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> Trust Signal Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem;">
        Trust signals reduce friction and increase conversion rates. ${presentCount} of ${signals.length} trust elements detected.
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
                <div style="color: #e0e0e0; font-weight: 500;">${signal.label}</div>
                <div style="color: #808080; font-size: 0.85rem;">${signal.desc}</div>
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
      <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> Mobile UX Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem;">
        Mobile optimization is critical - over 60% of web traffic comes from mobile devices.
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
          <div style="color: #c0c0c0; font-size: 0.9rem;">Tap Target Compliance</div>
          <div style="color: #808080; font-size: 0.75rem; margin-top: 0.25rem;">44×44px minimum</div>
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
          <div style="color: #c0c0c0; font-size: 0.9rem;">Average Font Size</div>
          <div style="color: #808080; font-size: 0.75rem; margin-top: 0.25rem;">16px recommended</div>
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
          <div style="color: #c0c0c0; font-size: 0.9rem;">Viewport Meta</div>
          <div style="color: #808080; font-size: 0.75rem; margin-top: 0.25rem;">Responsive scaling</div>
        </div>
      </div>
    </div>
  `;
}

function renderRecommendationsContent(recommendations, quickWins = []) {
  if (!recommendations || recommendations.length === 0) {
    return `
      <div>
        <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> Recommendations</h3>
        <div style="
          background: rgba(0, 255, 65, 0.1);
          border: 1px solid rgba(0, 255, 65, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
          <p style="color: #00ff41; font-weight: bold; margin: 0;">Great job! No critical issues found.</p>
          <p style="color: #c0c0c0; margin: 0.5rem 0 0 0; font-size: 0.9rem;">
            Your page follows CRO best practices.
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
      <h3 style="color: #bb86fc; margin: 0 0 1rem 0;">>> Actionable Recommendations</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem;">
        Prioritized improvements to boost your conversion rate.
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
                <h4 style="color: #e0e0e0; margin: 0; font-size: 1rem;">${rec.message}</h4>
              </div>
              <p style="color: #c0c0c0; margin: 0 0 0.5rem 0; font-size: 0.9rem;">${rec.detail}</p>
              <p style="color: ${color}; margin: 0; font-size: 0.85rem; font-style: italic;">
                ⚡ Impact: ${rec.impact}
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
  if (score >= 90) return '#00ff41';
  if (score >= 70) return '#ffd700';
  if (score >= 50) return '#ff8c00';
  return '#ff4444';
}

/**
 * Initialize PDF Export for CRO Analyzer
 */
function initCROPDFExport() {
  if (typeof initPDFExport === 'function') {
    initPDFExport({
      contentSelector: '#results, #resultsContent, .results-container',
      buttonSelector: '#exportPdfBtn, .export-pdf-btn, #downloadPdfButton',
      reportSubtitle: 'Conversion Rate Optimization Analysis',
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
