/**
 * Performance Analyzer Frontend
 * Handles performance scan submissions and results display
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'performance';

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
// Make t() available globally for inline handlers
// NOTE: Do NOT overwrite window.t here — i18n.js already defines it with
// a (key, params) signature. Overwriting it with (key, fallback, params)
// breaks callers that rely on the i18n signature (e.g. renderScanContextBar).
if (typeof window.t !== 'function') window.t = t;

// --- i18n helpers for server-side recommendation data ---
function translateRecTitle(title) {
  const key = 'reports.performance.recTitles.' + title;
  const translated = t(key, null);
  return translated !== null ? translated : title;
}
function translateRecDescription(title, fallback) {
  const key = 'reports.performance.recDescriptions.' + title;
  const translated = t(key, null);
  return translated !== null ? translated : (fallback || '');
}
function translateRecImpact(title, fallback) {
  const key = 'reports.performance.recImpacts.' + title;
  const translated = t(key, null);
  return translated !== null ? translated : (fallback || '');
}
function translateRecCategory(category) {
  const key = 'reports.performance.recCategories.' + category;
  const translated = t(key, null);
  return translated !== null ? translated : (category || t('reports.performance.performance', 'Performance'));
}
function translatePriority(priority) {
  const p = (priority || 'medium').toLowerCase();
  return t('reports.performance.priorityLabels.' + p, p.toUpperCase());
}

// Function to get analysis steps with current translations
// Called at runtime to ensure i18n is loaded
function getAnalysisSteps() {
  return [
    {
      label: t('loader.runningLighthouse', 'Running Lighthouse performance audit...'),
      detail: t('loader.testingPerformance', 'Testing desktop and mobile performance...')
    },
    {
      label: t('loader.analyzingResources', 'Analyzing resource loading'),
      detail: t('loader.trackingAssets', 'Tracking scripts, styles, images, fonts...')
    },
    {
      label: t('loader.testingNetwork', 'Testing network efficiency'),
      detail: t('loader.measuringBandwidth', 'Measuring request counts and bandwidth...')
    },
    {
      label: t('loader.checkingCache', 'Checking caching strategy'),
      detail: t('loader.evaluatingCache', 'Evaluating cache headers and optimization...')
    },
    {
      label: t('loader.generatingReport', 'Generating report'),
      detail: t('loader.compilingInsights', 'Compiling performance insights...')
    }
  ];
}

/**
 * MEMORY MANAGEMENT: Clean up previous scan data to prevent memory leaks
 */
function cleanupPreviousPerfData(container) {
  // Clear report metadata from previous scans
  document.body.removeAttribute('data-report-id');
  document.body.removeAttribute('data-sm-screenshot-url');
  document.body.removeAttribute('data-sm-scan-started-at');
  
  // Clear global results cache
  if (window._perfFullResults) {
    window._perfFullResults = null;
  }
  
  // Clear results container
  if (container) {
    container.innerHTML = '';
  }
  
  // Clear loading container
  const loadingContainer = document.getElementById('loadingContainer');
  if (loadingContainer) {
    loadingContainer.innerHTML = '';
  }
  
  // Remove patience message
  const patienceMessage = document.getElementById('patience-message');
  if (patienceMessage) {
    patienceMessage.remove();
  }
  
  // Destroy any Chart.js instances
  if (window.Chart && Chart.instances) {
    Object.values(Chart.instances).forEach(chart => {
      try { chart.destroy(); } catch (e) { /* ignore */ }
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  const urlInput = document.getElementById('perfUrlInput');
  const submitButton = document.getElementById('perfAnalyzeButton');
  const resultsContainer = document.getElementById('perfResults');

  // Handle button click - runs performance analysis with resource metrics
  submitButton.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      showError(t('reports.common.pleaseEnterUrl', 'Please enter a valid URL'));
      return;
    }

    // MEMORY CLEANUP: Clear previous scan data
    cleanupPreviousPerfData(resultsContainer);

    // Disable button during scan
    submitButton.disabled = true;
    submitButton.textContent = t('reports.performance.analyzing', 'ANALYZING...');
    submitButton.style.opacity = '0.6';
    urlInput.disabled = true;

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
  / _ \\\\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\\\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
      </div>
      <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem; color: var(--accent-primary); font-weight: 600; letter-spacing: 0.05em;">
        ${t('reports.performance.comprehensiveAnalysisInProgress', 'Comprehensive analysis in progress...')}
      </p>
      <p style="margin: 0.35rem 0 0 0; font-size: 0.8rem; color: rgba(var(--accent-primary-rgb), 0.7);">
        ${t('reports.performance.mayTake30to60Seconds', 'This may take 30-60 seconds')}
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
    
    // Use getAnalysisSteps() to get translated steps at runtime
    loader.start(getAnalysisSteps(), '⚡ ' + t('loader.analyzingPerformance', 'PERFORMANCE ANALYZER'), 60);
    
    // Insert ASCII art message after loader starts
    setTimeout(() => {
      const loadingContainer = document.getElementById('loadingContainer');
      if (loadingContainer && loaderMessageEl) {
        loadingContainer.insertBefore(loaderMessageEl, loadingContainer.firstChild);
      }
    }, 100);
    
    resultsContainer.style.display = 'none';

    try {
      const scanStartedAt = new Date().toISOString();
      window.SM_SCAN_STARTED_AT = scanStartedAt;
      document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

      const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/performance', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, scanStartedAt }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'SCAN_QUOTA_EXCEEDED') {
          const limit = data.scansLimit || 10;
          loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
          return;
        }
        throw new Error(data.message || data.error || t('reports.performance.analysisFailed', 'Performance analysis failed'));
      }

      // Set report metadata from API response
      const reportId = (data.results && data.results.reportId) || (data && data.reportId) || '';
      const screenshotUrl = (data.results && data.results.screenshotUrl) || (data && data.screenshotUrl) || '';
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

      if (data.success) {
        // Complete the loader
        loader.complete();
        
        // Show results after animation completes
        setTimeout(() => {
          displayPerformanceResults(data.results);
          window.__REPORT_READY__ = true;
          window.dispatchEvent(new CustomEvent('report:ready'));
        }, 1000);
      } else {
        loader.showError(data.message || data.error || t('reports.performance.analysisFailed', 'Performance analysis failed'));
      }

    } catch (error) {
      console.error('Performance scan error:', error);
      loader.showError(error.message || t('reports.performance.failedToAnalyze', 'Failed to analyze website. Please try again.'));
    } finally {
      // Re-enable button
      submitButton.disabled = false;
      submitButton.textContent = t('reports.performance.analyzePerformance', 'ANALYZE PERFORMANCE');
      submitButton.style.opacity = '1';
      urlInput.disabled = false;
    }
  });

  // Allow Enter key to submit
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitButton.click();
    }
  });
  
  // Auto-start scan if URL parameter is present
  if (typeof window.getUrlParameter === 'function') {
    const autoUrl = window.getUrlParameter();
    if (autoUrl) {
      urlInput.value = autoUrl;
      setTimeout(() => {
        submitButton.click();
      }, 500);
    }
  }
});

/**
 * Display Performance analysis results
 */
function displayPerformanceResults(results) {
  const container = document.getElementById('perfResults');
  if (!results || typeof results !== 'object' || results.error || typeof results === 'string') {
    console.error('[Performance] displayPerformanceResults received invalid data:', results?.error || results);
    return;
  }
  if (!container) { console.error('[Performance] Results container #perfResults not found'); return; }

  // Clear container
  container.innerHTML = '';
  container.style.display = 'block';

  // Build screenshot URL for report display
  const reportId = document.body.getAttribute('data-report-id') || '';
  const screenshotUrl = results.screenshotUrl || document.body.getAttribute('data-sm-screenshot-url') || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');

  // Add screenshot section first if available
  if (screenshotUrl) {
    const screenshotSection = document.createElement('div');
    screenshotSection.className = 'section screenshot-section';
    screenshotSection.innerHTML = `
      <h3 style="color: var(--text-primary, #fff); font-size: 1rem; margin: 0 0 0.75rem 0; font-weight: 600;">
        ${t('reports.performance.pageScreenshot', 'Page Screenshot')}
      </h3>
      <div class="screenshot-item" style="background: var(--bg-secondary, #1a1a1a); border: 1px solid var(--border-color, #333); border-radius: 8px; overflow: hidden;">
        <img
          src="${screenshotUrl}"
          alt="Screenshot of ${results.url || ''}"
          class="screenshot-item__img"
          style="width: 100%; max-height: 300px; object-fit: cover; object-position: top; cursor: pointer; display: block;"
          data-action="open-lightbox"
          data-screenshot-url="${screenshotUrl}"
          data-screenshot-title="${t('reports.performance.pageScreenshot', 'Page Screenshot')}"
        />
      </div>
    `;
    container.appendChild(screenshotSection);

    // Use JS listener instead of inline onerror (CSP blocks script-src-attr)
    const ssImg = screenshotSection.querySelector('.screenshot-item__img');
    if (ssImg) {
      ssImg.addEventListener('error', function() {
        this.parentElement.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted, #666);">' + (window.t?.('reports.performance.screenshotUnavailable', 'Screenshot unavailable') || 'Screenshot unavailable') + '</div>';
      });
    }

    // Add click handler for screenshot lightbox
    screenshotSection.addEventListener('click', (e) => {
      const openLightbox = e.target.closest('[data-action="open-lightbox"]');
      if (openLightbox) {
        const url = openLightbox.getAttribute('data-screenshot-url');
        const title = openLightbox.getAttribute('data-screenshot-title');
        if (url && window.ScreenshotLightbox && typeof window.ScreenshotLightbox.open === 'function') {
          window.ScreenshotLightbox.open(url, title || t('reports.performance.screenshot', 'Screenshot'));
        }
      }
    });
  }

  // Check if this is cross-browser results (has browsers.desktop/mobile) or single device
  const isCrossBrowser = results.browsers && (results.browsers.desktop || results.browsers.mobile);
  
  // Calculate average score for cross-browser or use direct score or overallScore
  const avgScore = isCrossBrowser 
    ? results.overallScore || Math.round((results.browsers.desktop?.performanceScore + results.browsers.mobile?.performanceScore) / 2)
    : results.performanceScore;
  
  // Executive Summary (not in accordion)
  const summarySection = document.createElement('div');
  summarySection.className = 'section';
  summarySection.innerHTML = `
    <h2>${t('reports.performance.title', 'Performance Report')}</h2>
    <p>>> ${t('reports.performance.url', 'URL')}: ${results.url}</p>
    <p>>> ${t('reports.performance.timestamp', 'timestamp')}: ${window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date(results.timestamp)) : new Date(results.timestamp).toLocaleString()}</p>
    <p>>> ${t('reports.performance.analysisDuration', 'analysis_duration')}: ${results.analysisDuration || t('reports.performance.notAvailable', 'N/A')}</p>
    ${isCrossBrowser ? '<p>>> ' + t('reports.performance.devicesTested', 'devices_tested') + ': 2</p>' : ''}
    
    <!-- Performance Score Overview -->
    <div style="
      background: linear-gradient(135deg, rgba(0,255,65,0.05) 0%, rgba(0,255,65,0.02) 100%);
      border: 2px solid ${getPerformanceColor(avgScore)};
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
      box-shadow: 0 4px 20px rgba(0,255,65,0.15);
    ">
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 2rem; align-items: start;">
        <!-- Left: Stacked Score Circles -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Performance Score Circle (100) -->
          <div style="text-align: center;">
            <div style="
              width: 160px;
              height: 160px;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(0,0,0,0.95) 0%, rgba(0,0,0,1) 100%);
              border: 5px solid ${getPerformanceColor(avgScore)};
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              box-shadow: 0 0 30px ${getPerformanceColor(avgScore)}40, inset 0 0 20px rgba(0,0,0,0.5);
            ">
              <div style="
                font-size: 4rem;
                font-weight: 900;
                color: var(--r-text, #111827);
                text-shadow: 0 0 20px ${getPerformanceColor(avgScore)}, 0 0 40px ${getPerformanceColor(avgScore)}80;
                line-height: 1;
              ">${avgScore}</div>
              <div style="
                font-size: 0.85rem;
                color: #b0b0b0;
                margin-top: 0.5rem;
                text-transform: uppercase;
                letter-spacing: 2px;
                font-weight: 600;
              ">/ 100</div>
            </div>
            <div style="
              margin-top: 0.75rem;
              font-size: 1.3rem;
              font-weight: bold;
              color: ${getPerformanceColor(avgScore)};
              text-shadow: 0 0 10px ${getPerformanceColor(avgScore)}80;
            ">${getPerformanceGrade(avgScore)}</div>
            <div style="font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF); margin-top: 0.25rem;">${t('reports.performance.loadSpeed', 'Load Speed')}</div>
          </div>

          ${results.siteHealthScore ? `
            <!-- Site Health Score Circle (85) -->
            <div style="text-align: center;">
              <div style="
                width: 160px;
                height: 160px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(0,0,0,0.95) 0%, rgba(0,0,0,1) 100%);
                border: 4px solid ${getPerformanceColor(results.siteHealthScore)};
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 25px ${getPerformanceColor(results.siteHealthScore)}40, inset 0 0 15px rgba(0,0,0,0.5);
              ">
                <div style="
                  font-size: 3.5rem;
                  font-weight: 900;
                  color: var(--r-text, #111827);
                  text-shadow: 0 0 15px ${getPerformanceColor(results.siteHealthScore)};
                  line-height: 1;
                ">${results.siteHealthScore}</div>
                <div style="
                  font-size: 0.8rem;
                  color: #b0b0b0;
                  margin-top: 0.4rem;
                  text-transform: uppercase;
                  letter-spacing: 1.5px;
                  font-weight: 600;
                ">/ 100</div>
              </div>
              <div style="
                margin-top: 0.75rem;
                font-size: 1.2rem;
                font-weight: bold;
                color: ${getPerformanceColor(results.siteHealthScore)};
                text-shadow: 0 0 8px ${getPerformanceColor(results.siteHealthScore)}80;
              ">${getPerformanceGrade(results.siteHealthScore)}</div>
              <div style="font-size: 0.85rem; color: #00ff41; margin-top: 0.25rem; font-weight: 600;">${t('reports.performance.siteHealth', 'Site Health')}</div>
            </div>
          ` : ''}
        </div>

        <!-- Right: Performance Score Details -->
        <div style="padding: 0 1rem; flex: 1;">
          <h3 style="color: #00ff41; margin: 0 0 1rem 0; font-size: 1.3rem;">P ${t('reports.performance.performanceScore', 'Performance Score')}</h3>
          
          <!-- Quick Stats Grid -->
          <div style="
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            margin-bottom: 1rem;
          ">
            <div style="
              background: rgba(0, 255, 65, 0.05);
              border: 1px solid rgba(0, 255, 65, 0.2);
              border-radius: 6px;
              padding: 0.75rem;
              text-align: center;
            ">
              <div style="font-size: 0.75rem; color: var(--r-text-faint, #9CA3AF); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                ${t('reports.performance.loadTime', 'Load Time')}
              </div>
              <div style="font-size: 1.3rem; font-weight: bold; color: #00ff41;">
                ${results.loadTime || t('reports.performance.notAvailable', 'N/A')}
              </div>
            </div>

            <div style="
              background: rgba(0, 255, 65, 0.05);
              border: 1px solid rgba(0, 255, 65, 0.2);
              border-radius: 6px;
              padding: 0.75rem;
              text-align: center;
            ">
              <div style="font-size: 0.75rem; color: var(--r-text-faint, #9CA3AF); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                ${t('reports.performance.pageSize', 'Page Size')}
              </div>
              <div style="font-size: 1.3rem; font-weight: bold; color: #00ff41;">
                ${results.pageSize || t('reports.performance.notAvailable', 'N/A')}
              </div>
            </div>

            <div style="
              background: rgba(0, 255, 65, 0.05);
              border: 1px solid rgba(0, 255, 65, 0.2);
              border-radius: 6px;
              padding: 0.75rem;
              text-align: center;
            ">
              <div style="font-size: 0.75rem; color: var(--r-text-faint, #9CA3AF); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                ${t('reports.performance.requests', 'Requests')}
              </div>
              <div style="font-size: 1.3rem; font-weight: bold; color: #00ff41;">
                ${results.totalRequests || t('reports.performance.notAvailable', 'N/A')}
              </div>
            </div>
          </div>

          <!-- Core Metrics -->
          <div style="
            background: var(--r-surface-2, #F8FAFC);
            border-radius: 6px;
            padding: 1rem;
            margin-bottom: 0.75rem;
          ">
            <div style="font-size: 0.85rem; font-weight: bold; color: #00ff41; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">
              ${t('reports.performance.coreMetrics', 'Core Metrics')}
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.85rem;">
              ${results.coreWebVitals ? `
                <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                  <span style="color: #a0a0a0;">LCP:</span>
                  <span style="color: ${results.coreWebVitals.lcp && parseInt(results.coreWebVitals.lcp) < 2500 ? '#00ff41' : '#ff8c00'}; font-weight: 600;">
                    ${results.coreWebVitals.lcp || t('reports.performance.notAvailable', 'N/A')}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                  <span style="color: #a0a0a0;">FID:</span>
                  <span style="color: ${results.coreWebVitals.fid && parseInt(results.coreWebVitals.fid) < 100 ? '#00ff41' : '#ff8c00'}; font-weight: 600;">
                    ${results.coreWebVitals.fid || t('reports.performance.notAvailable', 'N/A')}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                  <span style="color: #a0a0a0;">CLS:</span>
                  <span style="color: ${results.coreWebVitals.cls && parseFloat(results.coreWebVitals.cls) < 0.1 ? '#00ff41' : '#ff8c00'}; font-weight: 600;">
                    ${results.coreWebVitals.cls || t('reports.performance.notAvailable', 'N/A')}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                  <span style="color: #a0a0a0;">TTI:</span>
                  <span style="color: ${results.coreWebVitals.tti && parseInt(results.coreWebVitals.tti) < 3800 ? '#00ff41' : '#ff8c00'}; font-weight: 600;">
                    ${results.coreWebVitals.tti || t('reports.performance.notAvailable', 'N/A')}
                  </span>
                </div>
              ` : '<div style="color: var(--r-text-faint, #9CA3AF); grid-column: 1 / -1; text-align: center;">' + t('reports.performance.metricsNotAvailable', 'Metrics not available') + '</div>'}
            </div>
          </div>

          <!-- Note -->
          <div style="
            background: rgba(255, 152, 0, 0.1);
            border-left: 4px solid #ff9800;
            padding: 0.6rem 0.75rem;
            border-radius: 4px;
          ">
            <strong style="color: #ff9800; font-size: 0.85rem;">ⓘ ${t('reports.performance.note', 'Note')}:</strong>
            <span style="color: #d0d0d0; font-size: 0.8rem;">
              ${t('reports.performance.scoreNote', '100/100 performance ≠ perfect website. Check Site Health Score for overall quality.')}
            </span>
          </div>
        </div>
      </div>

      <!-- Dimensional Grades Breakdown -->
      ${results.dimensionalGrades ? `
        <div style="
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(0, 255, 65, 0.2);
        ">
          <h4 style="color: #00ff41; margin: 0 0 1rem 0; font-size: 1.1rem;">◉ ${t('reports.performance.multiDimensionalAnalysis', 'Multi-Dimensional Analysis')}</h4>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem;">
            ${Object.entries(results.dimensionalGrades).map(([dimension, grade]) => {
              const icons = {
                performance: 'P',
                resources: 'R',
                caching: 'C',
                network: 'N',
                webVitals: 'W'
              };
              const labels = {
                performance: t('reports.performance.performance', 'Performance'),
                resources: t('reports.performance.resources', 'resources'),
                caching: t('reports.performance.caching', 'Caching'),
                network: t('reports.performance.network', 'Network'),
                webVitals: t('reports.performance.webVitals', 'Web Vitals')
              };
              const gradeColor = getGradeColor(grade);
              return `
                <div style="
                  text-align: center;
                  padding: 1rem;
                  background: rgba(255, 255, 255, 0.03);
                  border: 2px solid ${gradeColor}40;
                  border-radius: 8px;
                  transition: all 0.3s ease;
                ">
                  <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${icons[dimension]}</div>
                  <div style="
                    font-size: 2rem;
                    font-weight: 900;
                    color: ${gradeColor};
                    text-shadow: 0 0 10px ${gradeColor}60;
                    margin-bottom: 0.25rem;
                  ">${grade}</div>
                  <div style="font-size: 0.75rem; color: #a0a0a0; text-transform: uppercase; letter-spacing: 1px;">
                    ${labels[dimension]}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
  container.appendChild(summarySection);
  
  // Store results globally for PDF generation
  window.currentPerformanceResults = results;
  
  // Desktop vs Mobile Comparison Section
  if (isCrossBrowser && results.browsers.desktop && results.browsers.mobile) {
    const comparisonSection = document.createElement('div');
    comparisonSection.className = 'section';
    comparisonSection.innerHTML = `
      <h2>${t('reports.performance.desktopVsMobileComparison', 'Desktop vs Mobile Comparison')}</h2>
      <div style="padding-left: 1rem;">
        <p style="color: #00ff41; margin-bottom: 1.5rem;">>> ${t('reports.performance.comprehensiveAnalysis', 'Comprehensive analysis across both platforms')}</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
          <!-- Desktop Column -->
          <div style="
            background: linear-gradient(135deg, rgba(0,204,255,0.1), rgba(0,102,204,0.05));
            border: 2px solid #00ccff;
            border-radius: 8px;
            padding: 1.5rem;
          ">
            <div style="text-align: center; margin-bottom: 1rem;">
              <div style="font-size: 1.5rem; color: #00ccff; margin-bottom: 0.5rem;">D ${t('reports.performance.desktop', 'Desktop')}</div>
              <div style="
                width: 120px;
                height: 120px;
                margin: 0 auto;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(0,0,0,0.95) 0%, rgba(0,0,0,1) 100%);
                border: 4px solid ${getPerformanceColor(results.browsers.desktop.performanceScore)};
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 20px ${getPerformanceColor(results.browsers.desktop.performanceScore)}40;
              ">
                <div style="
                  font-size: 2.8rem;
                  font-weight: 900;
                  color: var(--r-text, #111827);
                  line-height: 1;
                  text-shadow: 0 0 10px ${getPerformanceColor(results.browsers.desktop.performanceScore)};
                ">${results.browsers.desktop.performanceScore}</div>
                <div style="color: #b0b0b0; font-size: 0.75rem; margin-top: 0.25rem; font-weight: 600;">/ 100</div>
              </div>
              <div style="
                margin-top: 0.75rem;
                font-weight: bold;
                color: ${getPerformanceColor(results.browsers.desktop.performanceScore)};
              ">${getPerformanceGrade(results.browsers.desktop.performanceScore)}</div>
            </div>
            
            <div style="border-top: 1px solid rgba(0,204,255,0.3); padding-top: 1rem;">
              <h4 style="color: #00ccff; margin: 0 0 0.75rem 0; font-size: 1rem;">${t('reports.performance.lighthouseScores', 'Lighthouse Scores')}</h4>
              <div style="display: grid; gap: 0.5rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">P ${t('reports.performance.performance', 'Performance')}</span>
                  <span style="color: ${getPerformanceColor(results.browsers.desktop.performanceScore)}; font-weight: bold;">
                    ${results.browsers.desktop.performanceScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">A ${t('reports.performance.accessibility', 'Accessibility')}</span>
                  <span style="color: ${getPerformanceColor(results.browsers.desktop.accessibilityScore)}; font-weight: bold;">
                    ${results.browsers.desktop.accessibilityScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">B ${t('reports.performance.bestPractices', 'Best Practices')}</span>
                  <span style="color: ${getPerformanceColor(results.browsers.desktop.bestPracticesScore)}; font-weight: bold;">
                    ${results.browsers.desktop.bestPracticesScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">S ${t('reports.performance.seo', 'SEO')}</span>
                  <span style="color: ${getPerformanceColor(results.browsers.desktop.seoScore)}; font-weight: bold;">
                    ${results.browsers.desktop.seoScore}
                  </span>
                </div>
              </div>

              <h4 style="color: #00ccff; margin: 1rem 0 0.75rem 0; font-size: 1rem;">${t('reports.performance.coreWebVitals', 'Core Web Vitals')}</h4>
              <div style="display: grid; gap: 0.5rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">LCP</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.desktop.metrics?.coreWebVitals?.lcp || t('reports.performance.notAvailable', 'N/A')}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">FID</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.desktop.metrics?.coreWebVitals?.fid || t('reports.performance.notAvailable', 'N/A')}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">CLS</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.desktop.metrics?.coreWebVitals?.cls || t('reports.performance.notAvailable', 'N/A')}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Mobile Column -->
          <div style="
            background: linear-gradient(135deg, rgba(255,102,0,0.1), rgba(255,102,0,0.05));
            border: 2px solid #ff6600;
            border-radius: 8px;
            padding: 1.5rem;
          ">
            <div style="text-align: center; margin-bottom: 1rem;">
              <div style="font-size: 1.5rem; color: #ff6600; margin-bottom: 0.5rem;">M ${t('reports.performance.mobile', 'Mobile')}</div>
              <div style="
                width: 120px;
                height: 120px;
                margin: 0 auto;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(0,0,0,0.95) 0%, rgba(0,0,0,1) 100%);
                border: 4px solid ${getPerformanceColor(results.browsers.mobile.performanceScore)};
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 20px ${getPerformanceColor(results.browsers.mobile.performanceScore)}40;
              ">
                <div style="
                  font-size: 2.8rem;
                  font-weight: 900;
                  color: var(--r-text, #111827);
                  line-height: 1;
                  text-shadow: 0 0 10px ${getPerformanceColor(results.browsers.mobile.performanceScore)};
                ">${results.browsers.mobile.performanceScore}</div>
                <div style="color: #b0b0b0; font-size: 0.75rem; margin-top: 0.25rem; font-weight: 600;">/ 100</div>
              </div>
              <div style="
                margin-top: 0.75rem;
                font-weight: bold;
                color: ${getPerformanceColor(results.browsers.mobile.performanceScore)};
              ">${getPerformanceGrade(results.browsers.mobile.performanceScore)}</div>
            </div>
            
            <div style="border-top: 1px solid rgba(255,102,0,0.3); padding-top: 1rem;">
              <h4 style="color: #ff6600; margin: 0 0 0.75rem 0; font-size: 1rem;">${t('reports.performance.lighthouseScores', 'Lighthouse Scores')}</h4>
              <div style="display: grid; gap: 0.5rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">P ${t('reports.performance.performance', 'Performance')}</span>
                  <span style="color: ${getPerformanceColor(results.browsers.mobile.performanceScore)}; font-weight: bold;">
                    ${results.browsers.mobile.performanceScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">A ${t('reports.performance.accessibility', 'Accessibility')}</span>
                  <span style="color: ${getPerformanceColor(results.browsers.mobile.accessibilityScore)}; font-weight: bold;">
                    ${results.browsers.mobile.accessibilityScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">B ${t('reports.performance.bestPractices', 'Best Practices')}</span>
                  <span style="color: ${getPerformanceColor(results.browsers.mobile.bestPracticesScore)}; font-weight: bold;">
                    ${results.browsers.mobile.bestPracticesScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">S ${t('reports.performance.seo', 'SEO')}</span>
                  <span style="color: ${getPerformanceColor(results.browsers.mobile.seoScore)}; font-weight: bold;">
                    ${results.browsers.mobile.seoScore}
                  </span>
                </div>
              </div>

              <h4 style="color: #ff6600; margin: 1rem 0 0.75rem 0; font-size: 1rem;">${t('reports.performance.coreWebVitals', 'Core Web Vitals')}</h4>
              <div style="display: grid; gap: 0.5rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">LCP</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.mobile.metrics?.coreWebVitals?.lcp || t('reports.performance.notAvailable', 'N/A')}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">FID</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.mobile.metrics?.coreWebVitals?.fid || t('reports.performance.notAvailable', 'N/A')}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--r-text-muted, #6B7280);">CLS</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.mobile.metrics?.coreWebVitals?.cls || t('reports.performance.notAvailable', 'N/A')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Performance Gap Warning -->
        ${Math.abs(results.browsers.desktop.performanceScore - results.browsers.mobile.performanceScore) > 10 ? `
        <div style="
          background: rgba(255,165,0,0.1);
          border: 2px solid #ffa500;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        ">
          <div style="color: #ffa500; font-weight: bold; margin-bottom: 0.5rem;">
            ~ ${t('reports.performance.performanceGapDetected', 'Performance Gap Detected')}
          </div>
          <p style="color: var(--r-text-muted, #6B7280); margin: 0;">
            ${t('reports.performance.performanceGapMessage', 'There is a {{gap}}-point difference between desktop ({{desktop}}) and mobile ({{mobile}}) performance.', { gap: Math.abs(results.browsers.desktop.performanceScore - results.browsers.mobile.performanceScore), desktop: results.browsers.desktop.performanceScore, mobile: results.browsers.mobile.performanceScore })}
            ${results.browsers.mobile.performanceScore < results.browsers.desktop.performanceScore ?
              t('reports.performance.mobileSlower', 'Mobile users may experience significantly slower load times.') :
              t('reports.performance.mobileUnusual', 'This is unusual - mobile typically performs worse than desktop.')}
          </p>
        </div>
        ` : `
        <div style="
          background: rgba(0,255,65,0.05);
          border: 2px solid #00ff41;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        ">
          <div style="color: #00ff41; font-weight: bold; margin-bottom: 0.5rem;">
            ✓ ${t('reports.performance.consistentPerformance', 'Consistent Performance')}
          </div>
          <p style="color: var(--r-text-muted, #6B7280); margin: 0;">
            ${t('reports.performance.consistentPerformanceMessage', 'Desktop and mobile performance scores are within 10 points of each other, indicating consistent user experience across platforms.')}
          </p>
        </div>
        `}
      </div>
    `;
    container.appendChild(comparisonSection);
  }
  
  // Create accordion sections
  // Pass both desktop and mobile vitals for comparison
  const avgVitalsScore = results.desktop?.coreWebVitals?.score && results.mobile?.coreWebVitals?.score 
    ? Math.round((results.desktop.coreWebVitals.score + results.mobile.coreWebVitals.score) / 2)
    : (results.desktop?.coreWebVitals?.score || results.mobile?.coreWebVitals?.score || results.coreWebVitals?.score || 0);
  
  // Debug logging
  createAccordionSection(container, 'core-web-vitals', t('reports.performance.coreWebVitals', 'Core Web Vitals'), () => renderCoreWebVitalsContent(results.desktop?.coreWebVitals, results.mobile?.coreWebVitals), avgVitalsScore);
  createAccordionSection(container, 'resource-analysis', t('reports.performance.resourceAnalysis', 'Resource Analysis'), () => renderResourceAnalysisContent(results.resources), results.resources?.score || 0);
  createAccordionSection(container, 'network-performance', t('reports.performance.networkPerformance', 'Network Performance'), () => renderNetworkPerformanceContent(results.network), results.network?.score || 0);
  createAccordionSection(container, 'caching-optimization', t('reports.performance.cachingOptimization', 'Caching & Optimization'), () => renderCachingOptimizationContent(results.caching), results.caching?.score || 0);
  createAccordionSection(container, 'report-recommendations', t('reports.common.reportRecommendations', 'Recommendations'), () => renderRecommendationsContent(results.recommendations), null, { isPro: true }); // Pro gated
  createAccordionSection(container, 'ai-strategic-analysis', t('reports.ai.strategicTitle', 'AI Strategic Analysis'), () => '<div id="ai-strategic-content">' + (window.AIRecommendations && window.AIRecommendations.renderLoadingAnimation ? window.AIRecommendations.renderLoadingAnimation() : '<div style="padding:1.5rem;text-align:center;color:var(--r-text-muted,#6B7280);">' + t('reports.ai.loading', 'Analyzing your results...') + '</div>') + '</div>', null, { isPro: true });

  // Fetch AI strategic analysis content
  if (window.AIRecommendations) {
    const locale = document.documentElement.lang || (window.i18n && window.i18n.locale) || 'en';
    window.AIRecommendations.fetchAndRender('ai-strategic-content', reportId, 'performance', results, locale, { skipHeader: true });
  }
  if (window.SelfImprovement) {
    window.SelfImprovement.integrate({ data: results, analyzerType: 'performance', donutLabels: {}, resultsContent: container, reportId: reportId });
  }

  // Pro Report Block
  if (window.ProReportBlock && window.ProReportBlock.render) {
    const proBlockHtml = window.ProReportBlock.render({
      context: 'performance-analysis',
      features: ['pdf', 'excel', 'csv', 'share'],
      title: t('reports.common.unlockReport', 'Unlock Report'),
      subtitle: t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.')
    });
    container.insertAdjacentHTML('beforeend', proBlockHtml);
  } else {
    const opts = { context: 'performance-analysis', features: ['pdf', 'excel', 'csv', 'share'], title: 'Unlock Report', subtitle: 'PDF export, share link, export data, and fix packs for this scan.' };
    const safe = JSON.stringify(opts).replace(/</g, '\\u003c').replace(/"/g, '&quot;');
    container.insertAdjacentHTML('beforeend', '<div class="pro-report-block" data-pro-block-pending data-pro-block-options="' + safe + '"></div>');
  }

  // Dispatch report:ready for direct calls (billing return, storage recall)
  window.__REPORT_READY__ = true;
  window.dispatchEvent(new CustomEvent('report:ready'));
}

/**
 * Create an accordion section
 */
function createAccordionSection(container, id, displayTitle, contentCreator, score) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  header.innerHTML = `
    <span>${displayTitle}</span>
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      ${score !== null ? `<span style="color: ${getPerformanceColor(score)}; font-size: 0.9rem;">${score}/100</span>` : ''}
      <span class="accordion-toggle">▼</span>
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
      header.querySelector('.accordion-toggle').classList.remove('rotated');
    } else {
      // Expand and create content if not already created
      if (!contentInner.hasChildNodes()) {
        const contentHTML = contentCreator();
        contentInner.innerHTML = contentHTML;
      }
      
      content.classList.add('expanded');
      header.classList.add('active');
      header.querySelector('.accordion-toggle').textContent = '▲';
      header.querySelector('.accordion-toggle').classList.add('rotated');
    }
  });
  
  accordion.appendChild(header);
  accordion.appendChild(content);
  container.appendChild(accordion);
}

/**
 * Render Core Web Vitals content
 */
function renderCoreWebVitalsContent(desktopVitals, mobileVitals) {
  if (!desktopVitals && !mobileVitals) {
    return '<p style="color: #ff6600;">>>> ' + t('reports.performance.coreWebVitalsNotAvailable', 'Core Web Vitals data not available') + '</p>';
  }

  // Helper to get metric status
  const getMetricStatus = (value, type) => {
    if (!value || value === 'N/A') return { color: '#808080', status: t('reports.performance.notAvailable', 'N/A') };

    let numValue;
    if (type === 'LCP' || type === 'FID' || type === 'TTFB' || type === 'FCP') {
      numValue = parseFloat(value.replace(/[ms]/g, '')) || 0;
    } else {
      numValue = parseFloat(value) || 0;
    }

    switch(type) {
      case 'LCP':
        if (numValue <= 2500) return { color: '#00ff41', status: t('reports.performance.good', 'Good') };
        if (numValue <= 4000) return { color: '#ffa500', status: t('reports.performance.needsImprovement', 'Needs Improvement') };
        return { color: '#ff4444', status: t('reports.performance.poor', 'Poor') };
      case 'FID':
        if (numValue <= 100) return { color: '#00ff41', status: t('reports.performance.good', 'Good') };
        if (numValue <= 300) return { color: '#ffa500', status: t('reports.performance.needsImprovement', 'Needs Improvement') };
        return { color: '#ff4444', status: t('reports.performance.poor', 'Poor') };
      case 'CLS':
        if (numValue <= 0.1) return { color: '#00ff41', status: t('reports.performance.good', 'Good') };
        if (numValue <= 0.25) return { color: '#ffa500', status: t('reports.performance.needsImprovement', 'Needs Improvement') };
        return { color: '#ff4444', status: t('reports.performance.poor', 'Poor') };
      case 'TTFB':
        if (numValue < 600) return { color: '#00ff41', status: t('reports.performance.info', 'Info') };
        return { color: '#ffa500', status: t('reports.performance.info', 'Info') };
      case 'FCP':
        if (numValue < 1800) return { color: '#00ff41', status: t('reports.performance.info', 'Info') };
        return { color: '#ffa500', status: t('reports.performance.info', 'Info') };
      default:
        return { color: '#808080', status: t('reports.performance.info', 'Info') };
    }
  };

  const renderMetricRow = (icon, name, description, desktopValue, mobileValue, type) => {
    const desktopStatus = getMetricStatus(desktopValue, type);
    const mobileStatus = getMetricStatus(mobileValue, type);
    
    return `
      <tr>
        <td>
          <span style="color: #00ff41;">${icon} ${name}</span>
        </td>
        <td style="color: var(--r-text-faint, #9CA3AF);">${description}</td>
        <td style="text-align: center;">
          <span style="color: ${desktopStatus.color}; font-weight: bold;">${desktopValue || t('reports.performance.notAvailable', 'N/A')}</span>
        </td>
        <td style="text-align: center;">
          <span style="
            color: ${desktopStatus.color};
            font-size: 0.85rem;
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            background: ${desktopStatus.color}20;
          ">${desktopStatus.status}</span>
        </td>
        <td style="text-align: center;">
          <span style="color: ${mobileStatus.color}; font-weight: bold;">${mobileValue || t('reports.performance.notAvailable', 'N/A')}</span>
        </td>
        <td style="text-align: center;">
          <span style="
            color: ${mobileStatus.color}; 
            font-size: 0.85rem;
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            background: ${mobileStatus.color}20;
          ">${mobileStatus.status}</span>
        </td>
      </tr>
    `;
  };

  return `
    <div style="padding-left: 1rem;">
      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> ${t('reports.performance.whatAreCoreWebVitals', 'What are Core Web Vitals?')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1.5rem;">
        ${t('reports.performance.coreWebVitalsDescription', 'Core Web Vitals are Google\\')}
      </p>

      <table class="seo-table" style="width: 100%; margin-bottom: 1.5rem;">
        <thead>
          <tr>
            <th style="text-align: left; width: 25%;">${t('reports.performance.metric', 'Metric')}</th>
            <th style="text-align: left; width: 25%;">${t('reports.performance.description', 'Description')}</th>
            <th colspan="2" style="text-align: center; background: rgba(0,204,255,0.1); border-left: 2px solid #00ccff;">
              <span style="color: #00ccff;">D ${t('reports.performance.desktop', 'Desktop')}</span>
            </th>
            <th colspan="2" style="text-align: center; background: rgba(255,102,0,0.1); border-left: 2px solid #ff6600;">
              <span style="color: #ff6600;">M ${t('reports.performance.mobile', 'Mobile')}</span>
            </th>
          </tr>
          <tr style="font-size: 0.85rem;">
            <th style="border-top: 1px solid #333;"></th>
            <th style="border-top: 1px solid #333;"></th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(0,204,255,0.05);">${t('reports.performance.value', 'Value')}</th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(0,204,255,0.05);">${t('reports.performance.status', 'Status')}</th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(255,102,0,0.05);">${t('reports.performance.value', 'Value')}</th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(255,102,0,0.05);">${t('reports.performance.status', 'Status')}</th>
          </tr>
        </thead>
        <tbody>
          ${renderMetricRow(
            'L',
            t('reports.performance.largestContentfulPaint', 'Largest Contentful Paint (LCP)'),
            t('reports.performance.lcpDescription', 'Largest Contentful Paint - Measures loading performance. Good LCP is ≤ 2.5s'),
            desktopVitals?.lcp,
            mobileVitals?.lcp,
            'LCP'
          )}

          ${renderMetricRow(
            'P',
            t('reports.performance.firstInputDelay', 'First Input Delay (FID)'),
            t('reports.performance.fidDescription', 'First Input Delay - Measures interactivity. Good FID is ≤ 100ms'),
            desktopVitals?.fid,
            mobileVitals?.fid,
            'FID'
          )}

          ${renderMetricRow(
            'T',
            t('reports.performance.cumulativeLayoutShift', 'Cumulative Layout Shift (CLS)'),
            t('reports.performance.clsDescription', 'Cumulative Layout Shift - Measures visual stability. Good CLS is ≤ 0.1'),
            desktopVitals?.cls || '0.000',
            mobileVitals?.cls || '0.000',
            'CLS'
          )}

          ${desktopVitals?.ttfb || mobileVitals?.ttfb ? renderMetricRow(
            '⧗',
            t('reports.performance.timeToFirstByte', 'Time to First Byte (TTFB)'),
            t('reports.performance.ttfbDescription', 'Time to First Byte - Server response time. Good TTFB is < 600ms'),
            desktopVitals?.ttfb || t('reports.performance.notAvailable', 'N/A'),
            mobileVitals?.ttfb || t('reports.performance.notAvailable', 'N/A'),
            'TTFB'
          ) : ''}

          ${desktopVitals?.fcp || mobileVitals?.fcp ? renderMetricRow(
            'Y',
            t('reports.performance.firstContentfulPaint', 'First Contentful Paint (FCP)'),
            t('reports.performance.fcpDescription', 'First Contentful Paint - First text/image render. Good FCP is < 1.8s'),
            desktopVitals?.fcp || t('reports.performance.notAvailable', 'N/A'),
            mobileVitals?.fcp || t('reports.performance.notAvailable', 'N/A'),
            'FCP'
          ) : ''}
        </tbody>
      </table>

      <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px;">
        <h4 style="color: #00ff41; margin: 0 0 0.5rem 0; font-size: 1rem;">📚 ${t('reports.performance.learnMore', 'Learn More')}</h4>
        <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0;">
          ${t('reports.performance.learnMoreDescription', 'Core Web Vitals are part of Google\\')}
        </p>
      </div>
    </div>
  `;
}

/**
 * Render Resource Analysis content
 */
function renderResourceAnalysisContent(resources) {
  if (!resources) {
    return '<p style="color: #ff6600;">>>> ' + t('reports.performance.resourceAnalysisNotAvailable', 'Resource analysis data not available') + '</p>';
  }

  // Calculate total size and percentages
  const totalSize = (resources.javascript?.size || 0) +
                    (resources.css?.size || 0) +
                    (resources.images?.size || 0) +
                    (resources.fonts?.size || 0) +
                    (resources.other?.size || 0);

  const resourceTypes = [
    { name: t('reports.performance.javascript', 'JavaScript'), data: resources.javascript, color: '#f7df1e', icon: '📜' },
    { name: t('reports.performance.css', 'CSS'), data: resources.css, color: '#264de4', icon: 'Y' },
    { name: t('reports.performance.images', 'Images'), data: resources.images, color: '#00ccff', icon: 'I' },
    { name: t('reports.performance.fonts', 'Fonts'), data: resources.fonts, color: '#ff6600', icon: '🔤' },
    { name: t('reports.performance.other', 'Other'), data: resources.other, color: '#808080', icon: 'R' }
  ].filter(r => r.data && r.data.count > 0);

  // Calculate percentages
  resourceTypes.forEach(r => {
    r.percentage = totalSize > 0 ? ((r.data.size / totalSize) * 100).toFixed(1) : 0;
  });

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>${t('reports.performance.platformAgnosticMetrics', 'Platform-Agnostic Metrics')}:</strong> ${t('reports.performance.resourceDataDescription', 'Resource data is collected during page analysis and applies universally to both desktop and mobile experiences.')}
        </p>
      </div>

      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> ${t('reports.performance.resourceBreakdown', 'Resource Breakdown')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1.5rem;">
        ${t('reports.performance.totalPageWeight', 'Total page weight')}: <strong style="color: #00ff41;">${formatBytes(totalSize)}</strong> ${t('reports.performance.across', 'across')} <strong style="color: #00ff41;">${resources.javascript?.count + resources.css?.count + resources.images?.count + resources.fonts?.count + resources.other?.count || 0}</strong> ${t('reports.performance.resources', 'resources')}
      </p>

      <!-- Resource Size Chart -->
      <div style="margin-bottom: 2rem;">
        <h4 style="color: #00ff41; margin: 0 0 1rem 0; font-size: 1rem;">C ${t('reports.performance.sizeDistribution', 'Size Distribution')}</h4>
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; height: 40px; display: flex; margin-bottom: 1rem;">
          ${resourceTypes.map(r => `
            <div style="
              background: ${r.color};
              width: ${r.percentage}%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #000;
              font-weight: bold;
              font-size: 0.85rem;
              transition: all 0.3s;
            " title="${r.name}: ${r.data.sizeFormatted} (${r.percentage}%)">
              ${parseFloat(r.percentage) > 5 ? `${r.percentage}%` : ''}
            </div>
          `).join('')}
        </div>
        
        <!-- Legend -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem;">
          ${resourceTypes.map(r => `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div style="width: 16px; height: 16px; background: ${r.color}; border-radius: 3px;"></div>
              <span style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">
                ${r.icon} ${r.name}: <strong style="color: ${r.color};">${r.data.sizeFormatted}</strong> (${r.percentage}%)
              </span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Resource Details Table -->
      <h4 style="color: #00ff41; margin: 1.5rem 0 1rem 0; font-size: 1rem;">📋 ${t('reports.performance.detailedBreakdown', 'Detailed Breakdown')}</h4>
      <table class="seo-table" style="width: 100%;">
        <thead>
          <tr>
            <th style="text-align: left; width: 25%;">${t('reports.performance.resourceType', 'Resource Type')}</th>
            <th style="text-align: center; width: 15%;">${t('reports.performance.count', 'Count')}</th>
            <th style="text-align: center; width: 20%;">${t('reports.performance.totalSize', 'Total Size')}</th>
            <th style="text-align: center; width: 20%;">${t('reports.performance.avgSize', 'Avg Size')}</th>
            <th style="text-align: center; width: 20%;">${t('reports.performance.percentOfTotal', '% of Total')}</th>
          </tr>
        </thead>
        <tbody>
          ${resourceTypes.map(r => `
            <tr>
              <td>
                <span style="color: ${r.color};">${r.icon} ${r.name}</span>
              </td>
              <td style="text-align: center; color: var(--r-text-muted, #6B7280);">
                ${r.data.count}
              </td>
              <td style="text-align: center;">
                <strong style="color: ${r.color};">${r.data.sizeFormatted}</strong>
              </td>
              <td style="text-align: center; color: var(--r-text-muted, #6B7280);">
                ${formatBytes(r.data.size / r.data.count)}
              </td>
              <td style="text-align: center;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                  <div style="
                    width: 60px;
                    height: 8px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                    overflow: hidden;
                  ">
                    <div style="
                      width: ${r.percentage}%;
                      height: 100%;
                      background: ${r.color};
                    "></div>
                  </div>
                  <span style="color: ${r.color}; font-weight: bold;">${r.percentage}%</span>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <!-- Recommendations based on resource analysis -->
      ${generateResourceRecommendations(resources)}
    </div>
  `;
}

/**
 * Generate recommendations based on resource analysis
 */
function generateResourceRecommendations(resources) {
  const recommendations = [];

  if (resources.javascript?.size > 300000) {
    recommendations.push({
      type: 'warning',
      text: t('reports.performance.jsBundleLarge', 'JavaScript bundle is large ({{size}}). Consider code splitting and lazy loading.', { size: resources.javascript.sizeFormatted })
    });
  }

  if (resources.images?.size > 1000000) {
    recommendations.push({
      type: 'warning',
      text: t('reports.performance.imagesLarge', 'Images are {{size}}. Use WebP format and implement lazy loading.', { size: resources.images.sizeFormatted })
    });
  }

  if (resources.css?.size > 100000) {
    recommendations.push({
      type: 'info',
      text: t('reports.performance.cssLarge', 'CSS files total {{size}}. Consider removing unused styles and minification.', { size: resources.css.sizeFormatted })
    });
  }

  if (recommendations.length === 0) {
    return `
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px; border-left: 4px solid #00ff41;">
        <span style="color: #00ff41;">✓ ${t('reports.performance.resourcesOptimized', 'Resource sizes are well optimized!')}</span>
      </div>
    `;
  }

  return `
    <div style="margin-top: 1.5rem;">
      <h4 style="color: #ffa500; margin: 0 0 0.75rem 0; font-size: 1rem;">~ ${t('reports.performance.optimizationOpportunities', 'Optimization Opportunities')}</h4>
      ${recommendations.map(rec => `
        <div style="
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: rgba(255,165,0,0.05);
          border-left: 3px solid ${rec.type === 'warning' ? '#ffa500' : '#00ccff'};
          border-radius: 4px;
        ">
          <span style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${rec.text}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Render Network Performance content
 */
function renderNetworkPerformanceContent(network) {
  if (!network) {
    return '<p style="color: #ff6600;">>>> ' + t('reports.performance.networkPerformanceNotAvailable', 'Network performance data not available') + '</p>';
  }

  // Parse timing values
  const ttfb = parseInt(network.ttfb) || 0;
  const dns = parseInt(network.dns) || 0;
  const tcp = parseInt(network.connectionTime) || 0;
  const ssl = parseInt(network.ssl) || 0;
  const domInteractive = parseInt(network.domInteractive) || 0;
  const domContentLoaded = parseInt(network.domContentLoaded) || 0;

  // Get status colors
  const getTTFBStatus = (ms) => {
    if (ms < 200) return { color: '#00ff41', label: t('reports.performance.excellent', 'Excellent') };
    if (ms < 400) return { color: '#00ff41', label: t('reports.performance.good', 'Good') };
    if (ms < 600) return { color: '#ffa500', label: t('reports.performance.fair', 'Fair') };
    return { color: '#ff4444', label: t('reports.performance.poor', 'Poor') };
  };

  const ttfbStatus = getTTFBStatus(ttfb);

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>${t('reports.performance.platformAgnosticMetrics', 'Platform-Agnostic Metrics')}:</strong> ${t('reports.performance.networkDataDescription', 'Network timing data reflects server infrastructure and applies to all devices accessing the site.')}
        </p>
      </div>

      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> ${t('reports.performance.networkAnalysis', 'Network Analysis')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1.5rem;">
        ${t('reports.performance.networkAnalysisDescription', 'Network performance breakdown showing connection establishment, server response, and content delivery timing.')}
      </p>

      <!-- Network Timing Waterfall -->
      <div style="margin-bottom: 2rem;">
        <h4 style="color: #00ff41; margin: 0 0 1rem 0; font-size: 1rem;">🌊 ${t('reports.performance.connectionTimeline', 'Connection Timeline')}</h4>

        <div style="background: var(--r-surface-2, #F8FAFC); padding: 1.5rem; border-radius: 8px;">
          ${dns > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="color: #00ccff; font-size: 0.95rem; font-weight: 600;">S ${t('reports.performance.dnsLookup', 'DNS Lookup')}</span>
              <span style="color: #00ccff; font-weight: bold; font-size: 1rem;">${network.dns}</span>
            </div>
            <div style="background: rgba(255,255,255,0.1); height: 28px; border-radius: 4px; overflow: hidden;">
              <div style="
                background: linear-gradient(90deg, #00ccff, #0099cc);
                height: 100%;
                width: ${Math.min((dns / 500) * 100, 100)}%;
                transition: width 0.3s ease;
              "></div>
            </div>
          </div>
          ` : ''}

          ${tcp > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="color: #00ff41; font-size: 0.95rem; font-weight: 600;">🔌 ${t('reports.performance.tcpConnection', 'TCP Connection')}</span>
              <span style="color: #00ff41; font-weight: bold; font-size: 1rem;">${network.connectionTime}</span>
            </div>
            <div style="background: rgba(255,255,255,0.1); height: 28px; border-radius: 4px; overflow: hidden;">
              <div style="
                background: linear-gradient(90deg, #00ff41, #00cc33);
                height: 100%;
                width: ${Math.min((tcp / 500) * 100, 100)}%;
                transition: width 0.3s ease;
              "></div>
            </div>
          </div>
          ` : ''}

          ${ssl > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="color: #ffa500; font-size: 0.95rem; font-weight: 600;">◈ ${t('reports.performance.sslHandshake', 'SSL Handshake')}</span>
              <span style="color: #ffa500; font-weight: bold; font-size: 1rem;">${network.ssl}</span>
            </div>
            <div style="background: rgba(255,255,255,0.1); height: 28px; border-radius: 4px; overflow: hidden;">
              <div style="
                background: linear-gradient(90deg, #ffa500, #ff8800);
                height: 100%;
                width: ${Math.min((ssl / 500) * 100, 100)}%;
                transition: width 0.3s ease;
              "></div>
            </div>
          </div>
          ` : ''}

          <div style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="color: ${ttfbStatus.color}; font-size: 0.95rem; font-weight: 600;">⧗ ${t('reports.performance.timeToFirstByte', 'Time to First Byte (TTFB)')}</span>
              <span style="color: ${ttfbStatus.color}; font-weight: bold; font-size: 1rem;">${network.ttfb} <span style="font-size: 0.85rem; opacity: 0.8;">(${ttfbStatus.label})</span></span>
            </div>
            <div style="background: rgba(255,255,255,0.1); height: 28px; border-radius: 4px; overflow: hidden;">
              <div style="
                background: linear-gradient(90deg, ${ttfbStatus.color}, ${ttfbStatus.color}cc);
                height: 100%;
                width: ${Math.min((ttfb / 1000) * 100, 100)}%;
                transition: width 0.3s ease;
              "></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Network Metrics Table -->
      <h4 style="color: #00ff41; margin: 1.5rem 0 1rem 0; font-size: 1rem;">C ${t('reports.performance.networkMetrics', 'Network Metrics')}</h4>
      <table class="seo-table" style="width: 100%;">
        <thead>
          <tr>
            <th style="text-align: left; width: 40%;">${t('reports.performance.metric', 'Metric')}</th>
            <th style="text-align: left; width: 35%;">${t('reports.performance.description', 'Description')}</th>
            <th style="text-align: center; width: 25%;">${t('reports.performance.value', 'Value')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span style="color: #00ccff;">S ${t('reports.performance.dnsLookup', 'DNS Lookup')}</span></td>
            <td style="color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.dnsLookupDesc', 'Domain name resolution time')}</td>
            <td style="text-align: center;"><strong style="color: #00ccff;">${network.dns || t('reports.performance.notAvailable', 'N/A')}</strong></td>
          </tr>
          <tr>
            <td><span style="color: #00ff41;">🔌 ${t('reports.performance.tcpConnection', 'TCP Connection')}</span></td>
            <td style="color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.tcpConnectionDesc', 'Time to establish connection')}</td>
            <td style="text-align: center;"><strong style="color: #00ff41;">${network.connectionTime || t('reports.performance.notAvailable', 'N/A')}</strong></td>
          </tr>
          ${ssl > 0 ? `
          <tr>
            <td><span style="color: #ffa500;">◈ ${t('reports.performance.sslHandshake', 'SSL Handshake')}</span></td>
            <td style="color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.sslHandshakeDesc', 'Secure connection setup time')}</td>
            <td style="text-align: center;"><strong style="color: #ffa500;">${network.ssl}</strong></td>
          </tr>
          ` : ''}
          <tr>
            <td><span style="color: ${ttfbStatus.color};">⧗ ${t('reports.performance.timeToFirstByte', 'Time to First Byte (TTFB)')}</span></td>
            <td style="color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.ttfbTableDesc', 'Server response time')}</td>
            <td style="text-align: center;"><strong style="color: ${ttfbStatus.color};">${network.ttfb}</strong></td>
          </tr>
          <tr>
            <td><span style="color: #00ff41;">P ${t('reports.performance.domInteractive', 'DOM Interactive')}</span></td>
            <td style="color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.domInteractiveDesc', 'Time until DOM is ready')}</td>
            <td style="text-align: center;"><strong style="color: #00ff41;">${network.domInteractive || t('reports.performance.notAvailable', 'N/A')}</strong></td>
          </tr>
          <tr>
            <td><span style="color: #00ff41;">D ${t('reports.performance.domContentLoaded', 'DOM Content Loaded')}</span></td>
            <td style="color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.domContentLoadedDesc', 'Initial HTML parsed and ready')}</td>
            <td style="text-align: center;"><strong style="color: #00ff41;">${network.domContentLoaded || t('reports.performance.notAvailable', 'N/A')}</strong></td>
          </tr>
          <tr>
            <td><span style="color: #00ff41;">W ${t('reports.performance.totalRequests', 'Total Requests')}</span></td>
            <td style="color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.totalRequestsDesc', 'Number of HTTP requests')}</td>
            <td style="text-align: center;"><strong style="color: #00ff41;">${network.requests || t('reports.performance.notAvailable', 'N/A')}</strong></td>
          </tr>
        </tbody>
      </table>

      <!-- Network Performance Insights -->
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(0,204,255,0.05); border-radius: 4px; border-left: 4px solid #00ccff;">
        <h4 style="color: #00ccff; margin: 0 0 0.5rem 0; font-size: 1rem;">ⓘ ${t('reports.performance.networkInsights', 'Network Insights')}</h4>
        <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0;">
          ${ttfb < 200 ?
            t('reports.performance.ttfbExcellent', 'Excellent server response time! Your backend is highly optimized.') :
            ttfb < 600 ?
            t('reports.performance.ttfbAcceptable', 'Server response time is acceptable but could be improved with better caching or a CDN.') :
            t('reports.performance.ttfbSlow', 'Slow server response time. Consider upgrading hosting, implementing Redis caching, or using a CDN.')}
        </p>
        ${network.requests > 50 ? `
        <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0.5rem 0 0 0;">
          ~ ${t('reports.performance.highRequests', 'High number of requests ({{count}}). Consider bundling assets and reducing third-party scripts.', { count: network.requests })}
        </p>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render Caching & Optimization content
 */
function renderCachingOptimizationContent(caching) {
  if (!caching) {
    return '<p style="color: #ff6600;">>>> ' + t('reports.performance.cachingNotAvailable', 'Caching optimization data not available') + '</p>';
  }

  const cacheRate = parseFloat(caching.cacheHitRateNum) || 0;
  const getCacheStatus = (rate) => {
    if (rate >= 80) return { color: '#00ff41', label: t('reports.performance.excellent', 'Excellent'), icon: '✓' };
    if (rate >= 60) return { color: '#00ff41', label: t('reports.performance.good', 'Good'), icon: '+' };
    if (rate >= 40) return { color: '#ffa500', label: t('reports.performance.fair', 'Fair'), icon: '~' };
    return { color: '#ff4444', label: t('reports.performance.poor', 'Poor'), icon: '✗' };
  };

  const status = getCacheStatus(cacheRate);

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>${t('reports.performance.platformAgnosticMetrics', 'Platform-Agnostic Metrics')}:</strong> ${t('reports.performance.cachingDataDescription', 'Caching policies are defined by HTTP headers and benefit all users equally regardless of device.')}
        </p>
      </div>

      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> ${t('reports.performance.cachingStrategy', 'Caching Strategy')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1.5rem;">
        ${t('reports.performance.cacheEffectivenessDescription', 'Cache effectiveness determines how many resources can be loaded from browser cache on repeat visits.')}
      </p>

      <!-- Cache Hit Rate Visual -->
      <div style="margin-bottom: 2rem;">
        <h4 style="color: #00ff41; margin: 0 0 1rem 0; font-size: 1rem;">U ${t('reports.performance.cacheHitRate', 'Cache Hit Rate')}</h4>
        
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="
            display: inline-block;
            width: 180px;
            height: 180px;
            border-radius: 50%;
            background: conic-gradient(
              ${status.color} 0deg,
              ${status.color} ${cacheRate * 3.6}deg,
              rgba(255,255,255,0.1) ${cacheRate * 3.6}deg
            );
            position: relative;
            box-shadow: 0 0 20px ${status.color}40;
          ">
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 140px;
              height: 140px;
              border-radius: 50%;
              background: #1a1a1a;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            ">
              <div style="font-size: 2.5rem; color: ${status.color}; font-weight: bold; line-height: 1;">
                ${cacheRate}%
              </div>
              <div style="font-size: 0.85rem; color: ${status.color}; margin-top: 0.25rem; text-transform: uppercase; letter-spacing: 1px;">
                ${status.label}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Cache Stats Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: rgba(0,255,65,0.1); padding: 1rem; border-radius: 8px; text-align: center; border: 2px solid rgba(0,255,65,0.3);">
            <div style="font-size: 1.8rem; color: #00ff41; font-weight: bold; margin-bottom: 0.25rem;">
              ${caching.cached || 0}
            </div>
            <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">
              ${t('reports.performance.cacheable', 'Cacheable')}
            </div>
          </div>

          <div style="background: rgba(255,68,68,0.1); padding: 1rem; border-radius: 8px; text-align: center; border: 2px solid rgba(255,68,68,0.3);">
            <div style="font-size: 1.8rem; color: #ff4444; font-weight: bold; margin-bottom: 0.25rem;">
              ${caching.notCached || 0}
            </div>
            <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">
              ${t('reports.performance.notCached', 'Not Cached')}
            </div>
          </div>

          <div style="background: rgba(0,204,255,0.1); padding: 1rem; border-radius: 8px; text-align: center; border: 2px solid rgba(0,204,255,0.3);">
            <div style="font-size: 1.8rem; color: #00ccff; font-weight: bold; margin-bottom: 0.25rem;">
              ${caching.total || 0}
            </div>
            <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">
              ${t('reports.performance.totalResources', 'Total Resources')}
            </div>
          </div>
        </div>
      </div>

      <!-- Cache Strategies Table -->
      ${caching.strategies && Object.keys(caching.strategies).length > 0 ? `
      <h4 style="color: #00ff41; margin: 1.5rem 0 1rem 0; font-size: 1rem;">🔧 ${t('reports.performance.cacheStrategiesDetected', 'Cache Strategies Detected')}</h4>
      <table class="seo-table" style="width: 100%;">
        <thead>
          <tr>
            <th style="text-align: left; width: 50%;">${t('reports.performance.cacheStrategy', 'Cache Strategy')}</th>
            <th style="text-align: center; width: 25%;">${t('reports.performance.resources', 'resources')}</th>
            <th style="text-align: center; width: 25%;">${t('reports.performance.percentage', 'Percentage')}</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(caching.strategies).map(([strategy, count]) => {
            const percentage = ((count / caching.total) * 100).toFixed(1);
            return `
              <tr>
                <td>
                  <span style="color: #00ccff;">🔖 ${strategy}</span>
                </td>
                <td style="text-align: center; color: var(--r-text-muted, #6B7280);">
                  ${count}
                </td>
                <td style="text-align: center;">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                    <div style="
                      width: 60px;
                      height: 8px;
                      background: rgba(255,255,255,0.1);
                      border-radius: 4px;
                      overflow: hidden;
                    ">
                      <div style="
                        width: ${percentage}%;
                        height: 100%;
                        background: #00ccff;
                      "></div>
                    </div>
                    <span style="color: #00ccff; font-weight: bold;">${percentage}%</span>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      ` : ''}
      
      <!-- Caching Recommendations -->
      <div style="margin-top: 1.5rem; padding: 1rem; background: ${status.color}10; border-radius: 4px; border-left: 4px solid ${status.color};">
        <h4 style="color: ${status.color}; margin: 0 0 0.5rem 0; font-size: 1rem;">${status.icon} ${t('reports.performance.cachePerformance', 'Cache Performance')}</h4>
        ${cacheRate >= 80 ? `
          <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0;">
            ${t('reports.performance.cacheExcellent', 'Excellent caching strategy! {{rate}}% of resources are cacheable, which significantly improves repeat visit performance.', { rate: cacheRate })}
          </p>
        ` : cacheRate >= 60 ? `
          <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0;">
            ${t('reports.performance.cacheGood', 'Good caching implementation with {{rate}}% cache hit rate. Consider increasing cache TTL for static assets to reach 80%+ cacheability.', { rate: cacheRate })}
          </p>
        ` : cacheRate >= 40 ? `
          <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0;">
            ~ ${t('reports.performance.cacheFair', 'Fair caching with {{rate}}% hit rate. Implement proper Cache-Control headers for static assets (CSS, JS, images, fonts) with long TTL values (1 year for versioned files).', { rate: cacheRate })}
          </p>
          <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0.5rem 0 0 0;">
            ⓘ ${t('reports.performance.recommended', 'Recommended')}: <code style="background: var(--r-surface-2, #F8FAFC); padding: 0.25rem 0.5rem; border-radius: 3px; color: #00ff41;">Cache-Control: public, max-age=31536000, immutable</code>
          </p>
        ` : `
          <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0;">
            H ${t('reports.performance.cachePoor', 'Poor caching performance ({{rate}}%). Most resources are not cacheable, forcing full re-downloads on every visit. This significantly impacts repeat visitor performance.', { rate: cacheRate })}
          </p>
          <p style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0.5rem 0 0 0;">
            ⓘ ${t('reports.performance.urgent', 'Urgent')}: ${t('reports.performance.addCacheControl', 'Add Cache-Control headers to static assets with appropriate TTL values.')}
          </p>
        `}
      </div>

      <!-- Best Practices -->
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,204,255,0.05); border-radius: 4px;">
        <h4 style="color: #00ccff; margin: 0 0 0.5rem 0; font-size: 1rem;">📚 ${t('reports.performance.cachingBestPractices', 'Caching Best Practices')}</h4>
        <ul style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; margin: 0.5rem 0; padding-left: 1.5rem;">
          <li style="margin-bottom: 0.5rem;">${t('reports.performance.cacheTip1', 'Use versioning/hashing for filenames and set long cache times (1 year)')}</li>
          <li style="margin-bottom: 0.5rem;">${t('reports.performance.cacheTip2', 'Add immutable directive for fingerprinted assets')}</li>
          <li style="margin-bottom: 0.5rem;">${t('reports.performance.cacheTip3', 'Implement ETags for dynamic content validation')}</li>
          <li style="margin-bottom: 0.5rem;">${t('reports.performance.cacheTip4', 'Use CDN for static asset distribution and edge caching')}</li>
          <li>${t('reports.performance.cacheTip5', 'Set appropriate cache headers: public for static, private for user-specific')}</li>
        </ul>
      </div>
    </div>
  `;
}

/**
 * Render Recommendations content - Accordion + Tabs Pattern
 */
function renderRecommendationsContent(recommendations) {
  if (!recommendations || !recommendations.length) {
    return `
      <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">⚡</span> ${t('reports.performance.excellentPerformance', 'Excellent Performance!')}
        </h3>
        <p style="color: #86efac; margin: 0;">${t('reports.performance.noCriticalRecommendations', 'No critical optimization recommendations. Your site is performing well!')}</p>
      </div>
    `;
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortedRecs = [...recommendations].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  let html = `
    <div class="perf-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">⚡</span> ${t('reports.performance.performanceFixes', 'Performance Fixes')}
        <span style="font-size: 0.875rem; color: var(--r-text-faint, #9CA3AF); font-weight: normal;">(${t('reports.performance.improvementsFound', '{{count}} improvements found', { count: recommendations.length })})</span>
      </h3>
      <div class="perf-fixes-list">
  `;

  sortedRecs.forEach((rec, index) => {
    html += renderPerfFixAccordion(rec, index);
  });

  html += `</div></div>`;

  return html;
}

function renderPerfFixAccordion(rec, index) {
  const accordionId = `perffix-${index}`;
  const severityColors = {
    high: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
    medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
    low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
  };
  const style = severityColors[rec.priority] || severityColors.medium;

  return `
    <div class="perf-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="perf-fix-header" data-action="toggle-accordion" data-accordion-id="${accordionId}" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: var(--r-text, #111827);">${translateRecTitle(rec.title)}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${translateRecCategory(rec.category)}</p>
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
          ">${translatePriority(rec.priority)}</span>
          <span class="perf-fix-expand-icon" style="color: var(--r-text-faint, #9CA3AF); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="perf-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderPerfFixTabs(rec, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderPerfFixTabs(rec, accordionId) {
  const codeData = getPerfCodeExample(rec.category, rec.title);
  const steps = getPerfActionItems(rec.category, rec.title);

  return `
    <div class="perf-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); padding-bottom: 0.75rem;">
      <button class="perf-fix-tab active" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: var(--r-text, #111827);
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 ${t('reports.performance.summary', 'Summary')}</button>
      <button class="perf-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="code" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 ${t('reports.performance.code', 'Code')}</button>
      <button class="perf-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">🔧 ${t('reports.performance.fixGuide', 'Fix Guide')}</button>
    </div>

    <!-- Summary Tab -->
    <div class="perf-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: var(--r-text-muted, #6B7280); line-height: 1.7; margin: 0 0 1rem 0;">
        ${translateRecDescription(rec.title, rec.description) || t('reports.performance.optimizeArea', 'Optimize this area to improve performance.')}
      </p>
      ${rec.impact ? `
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ ${t('reports.performance.expectedImpact', 'Expected Impact')}</div>
        <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${translateRecImpact(rec.title, rec.impact)}</div>
      </div>
      ` : ''}
    </div>

    <!-- Code Tab -->
    <div class="perf-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Current Issue -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
            <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ ${t('reports.performance.currentIssue', 'Current Issue')}</span>
            <button data-action="copy-code" data-copy-target="${accordionId}-problem" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: var(--r-text, #111827);
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 ${t('reports.performance.copy', 'Copy')}</button>
          </div>
          <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${codeData.problem}</pre>
        </div>

        <!-- Fixed Code -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ ${t('reports.performance.recommendedFix', 'Recommended Fix')}</span>
            <button data-action="copy-code" data-copy-target="${accordionId}-solution" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: var(--r-text, #111827);
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 ${t('reports.performance.copy', 'Copy')}</button>
          </div>
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${codeData.solution}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="perf-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--r-text, #111827);">${t('reports.performance.stepByStepFix', 'Step-by-Step Fix')}:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--r-text-muted, #6B7280); line-height: 1.8;">
        ${steps.map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
    </div>
  `;
}

// Toggle accordion
function togglePerfFixAccordion(accordionId) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);
  const icon = accordion?.querySelector('.perf-fix-expand-icon');

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

// Switch tabs
function switchPerfFixTab(accordionId, tabName) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;

  const tabs = accordion.querySelectorAll('.perf-fix-tab');
  const contents = accordion.querySelectorAll('.perf-fix-tab-content');

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

window.togglePerfFixAccordion = togglePerfFixAccordion;
window.switchPerfFixTab = switchPerfFixTab;

// Add click event delegation for performance fix accordions and tabs
document.addEventListener('click', function(e) {
  // Handle tab clicks first
  const tab = e.target.closest('.perf-fix-tab');
  if (tab) {
    const accordion = tab.closest('.perf-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      const tabName = tab.getAttribute('data-tab') || 'summary';
      if (fixId && typeof window.switchPerfFixTab === 'function') {
        e.preventDefault();
        e.stopPropagation();
        window.switchPerfFixTab(fixId, tabName);
      }
    }
    return;
  }
  // Handle accordion header clicks
  const header = e.target.closest('.perf-fix-header');
  if (header) {
    const accordion = header.closest('.perf-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      if (fixId && typeof window.togglePerfFixAccordion === 'function') {
        window.togglePerfFixAccordion(fixId);
      }
    }
  }
});

// Copy code
function copyPerfCode(elementId) {
  const codeElement = document.getElementById(elementId);
  if (!codeElement) return;

  const text = codeElement.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = codeElement.parentElement.querySelector('button');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✓ ' + t('reports.performance.copied', 'Copied!');
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  });
}

/**
 * Get code example for specific recommendation (problem + solution)
 */
function getPerfCodeExample(category, title) {
  const examples = {
    'Minimize JavaScript': {
      problem: `<!-- ${t('reports.performance.codeComments.currentLargeBundle', 'Current: Large unoptimized bundle')} -->
<script src="/bundle.js"></script>
<!-- ${t('reports.performance.codeComments.jsBlockingRender', '500KB+ JavaScript blocking render')} -->
<!-- ✗ ${t('reports.performance.codeComments.noCodeSplitting', 'No code splitting')} -->
<!-- ✗ ${t('reports.performance.codeComments.noTreeShaking', 'No tree shaking')} -->
<!-- ✗ ${t('reports.performance.codeComments.vendorBundled', 'Vendor code bundled with app')} -->`,
      solution: `// webpack.config.js
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10
      }
    }
  },
  usedExports: true, // ${t('reports.performance.codeComments.treeShaking', 'Tree shaking')}
  minimize: true
}

<!-- ${t('reports.performance.codeComments.resultSmallerBundles', 'Result: Smaller, split bundles')} -->
<script src="/vendors.js" defer></script>
<script src="/app.js" defer></script>`
    },
    'Optimize Images': {
      problem: `<!-- ${t('reports.performance.codeComments.currentUnoptimizedImages', 'Current: Unoptimized images')} -->
<img src="hero.png" alt="Hero">
<!-- ✗ ${t('reports.performance.codeComments.pngInsteadOfWebp', 'PNG instead of WebP/AVIF')} -->
<!-- ✗ ${t('reports.performance.codeComments.noSrcset', 'No srcset for responsive')} -->
<!-- ✗ ${t('reports.performance.codeComments.noLazyLoading', 'No lazy loading')} -->
<!-- ✗ ${t('reports.performance.codeComments.largeImageFile', '2MB image file')} -->`,
      solution: `<!-- ${t('reports.performance.codeComments.optimizedModernFormats', 'Optimized with modern formats')} -->
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="Hero" loading="lazy"
       srcset="hero-400.jpg 400w, hero-800.jpg 800w"
       sizes="(max-width: 600px) 400px, 800px">
</picture>
<!-- ✓ ${t('reports.performance.codeComments.modernFormatsSmaller', 'Modern formats (90% smaller)')} -->
<!-- ✓ ${t('reports.performance.codeComments.responsiveImages', 'Responsive images')} -->
<!-- ✓ ${t('reports.performance.codeComments.lazyLoading', 'Lazy loading')} -->`
    },
    'Reduce CSS Size': {
      problem: `<!-- ${t('reports.performance.codeComments.currentLargeCss', 'Current: Large CSS file')} -->
<link rel="stylesheet" href="styles.css">
<!-- ✗ ${t('reports.performance.codeComments.largeCssFile', '200KB+ CSS file')} -->
<!-- ✗ ${t('reports.performance.codeComments.unusedStyles', 'Unused styles included')} -->
<!-- ✗ ${t('reports.performance.codeComments.renderBlocking', 'Render-blocking')} -->`,
      solution: `<!-- ${t('reports.performance.codeComments.criticalCssInline', 'Critical CSS inline')} -->
<style>
  /* ${t('reports.performance.codeComments.aboveTheFold', 'Above-the-fold styles only')} */
  .hero { ... }
  .nav { ... }
</style>
<!-- ${t('reports.performance.codeComments.nonCriticalAsync', 'Non-critical CSS async')} -->
<link rel="preload" href="styles.css" as="style"
      onload="this.onload=null;this.rel='stylesheet'">
<!-- ✓ ${t('reports.performance.codeComments.criticalInlined', 'Critical CSS inlined')} -->
<!-- ✓ ${t('reports.performance.codeComments.nonBlockingLoad', 'Non-blocking load')} -->`
    },
    'Improve Caching Strategy': {
      problem: `<!-- ${t('reports.performance.codeComments.currentNoCaching', 'Current: No caching headers')} -->
Cache-Control: no-cache
<!-- ✗ ${t('reports.performance.codeComments.assetsRedownloaded', 'Assets re-downloaded every visit')} -->
<!-- ✗ ${t('reports.performance.codeComments.slowRepeatVisits', 'Slow repeat visits')} -->`,
      solution: `# ${t('reports.performance.codeComments.nginxConfig', 'Nginx configuration')}
location ~* \\.(js|css|png|jpg|woff2)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location ~* \\.html$ {
  expires 1h;
  add_header Cache-Control "public, must-revalidate";
}
<!-- ✓ ${t('reports.performance.codeComments.staticCached1Year', 'Static assets cached 1 year')} -->
<!-- ✓ ${t('reports.performance.codeComments.htmlRevalidated', 'HTML revalidated hourly')} -->`
    },
    'Enable Text Compression': {
      problem: `<!-- ${t('reports.performance.codeComments.currentNoCompression', 'Current: No compression')} -->
Content-Encoding: identity
<!-- ✗ ${t('reports.performance.codeComments.largeTransfer', '500KB transferred')} -->
<!-- ✗ ${t('reports.performance.codeComments.slowMobile', 'Slow on mobile networks')} -->`,
      solution: `# ${t('reports.performance.codeComments.enableGzip', 'Enable Gzip in Nginx')}
gzip on;
gzip_vary on;
gzip_types text/plain text/css application/javascript
           application/json;
gzip_min_length 1000;
gzip_comp_level 6;

# ${t('reports.performance.codeComments.result', 'Result')}:
Content-Encoding: gzip
<!-- ✓ ${t('reports.performance.codeComments.smallerTransfer', '100KB transferred (80% smaller)')} -->`
    }
  };

  const defaultExample = {
    problem: `<!-- ${t('reports.performance.codeComments.commonIssue', 'Common performance issue')} -->
<!-- ✗ ${t('reports.performance.codeComments.unoptimizedLoading', 'Unoptimized resource loading')} -->
<!-- ✗ ${t('reports.performance.codeComments.blockingRender', 'Blocking render')} -->`,
    solution: `<!-- ${t('reports.performance.codeComments.optimizedImpl', 'Optimized implementation')} -->
<!-- ✓ ${t('reports.performance.codeComments.asyncDefer', 'Async/defer loading')} -->
<!-- ✓ ${t('reports.performance.codeComments.properCaching', 'Proper caching')} -->
<!-- ✓ ${t('reports.performance.codeComments.compressionEnabled', 'Compression enabled')} -->`
  };

  return examples[title] || defaultExample;
}

/**
 * Get action items for specific recommendation
 */
function getPerfActionItems(category, title) {
  const items = {
    'Minimize JavaScript': [
      t('reports.performance.actionItems.enableCodeSplitting', 'Enable code splitting in your bundler (webpack/vite)'),
      t('reports.performance.actionItems.useTreeShaking', 'Use tree shaking to remove unused code'),
      t('reports.performance.actionItems.splitVendorCode', 'Split vendor code from application code'),
      t('reports.performance.actionItems.addDeferAttribute', 'Add defer attribute to non-critical scripts')
    ],
    'Optimize Images': [
      t('reports.performance.actionItems.convertToWebp', 'Convert images to WebP or AVIF format'),
      t('reports.performance.actionItems.implementSrcset', 'Implement responsive images with srcset'),
      t('reports.performance.actionItems.addLazyLoading', 'Add loading='),
      t('reports.performance.actionItems.useImageCdn', 'Use an image CDN for automatic optimization')
    ],
    'Reduce CSS Size': [
      t('reports.performance.actionItems.extractCriticalCss', 'Extract and inline critical CSS'),
      t('reports.performance.actionItems.removeUnusedCss', 'Remove unused CSS with PurgeCSS'),
      t('reports.performance.actionItems.loadCssAsync', 'Load non-critical CSS asynchronously')
    ],
    'Improve Caching Strategy': [
      t('reports.performance.actionItems.setCacheHeaders', 'Set Cache-Control headers for static assets'),
      t('reports.performance.actionItems.useContentHashing', 'Use content-based hashing in filenames'),
      t('reports.performance.actionItems.configure1YearCache', 'Configure 1-year cache for immutable assets')
    ],
    'Enable Text Compression': [
      t('reports.performance.actionItems.enableGzipBrotli', 'Enable Gzip or Brotli compression on server'),
      t('reports.performance.actionItems.verifyCompression', 'Verify compression with browser DevTools'),
      t('reports.performance.actionItems.setMinSizeThreshold', 'Set minimum size threshold (1KB)')
    ]
  };

  return items[title] || [
    t('reports.performance.actionItems.analyzeImplementation', 'Analyze current implementation'),
    t('reports.performance.actionItems.applyOptimizations', 'Apply recommended optimizations'),
    t('reports.performance.actionItems.testAndMeasure', 'Test and measure improvements')
  ];
}

// Helper functions - Traditional traffic light system
function getPerformanceColor(score) {
  if (score >= 90) return '#00ff41';  // A: Bright green
  if (score >= 70) return '#ffd700';  // B: Yellow (gold)
  if (score >= 50) return '#ff8c00';  // C: Dark orange
  return '#ff4444';                   // D/F: Red
}

function getPerformanceGrade(score) {
  if (score >= 90) return t('reports.performance.excellent', 'Excellent');
  if (score >= 70) return t('reports.performance.good', 'Good');
  if (score >= 50) return t('reports.performance.needsImprovement', 'Needs Improvement');
  return t('reports.performance.poor', 'Poor');
}

/**
 * Get color for letter grade
 */
function getGradeColor(grade) {
  if (grade.startsWith('A')) return '#00ff41';  // A+, A, A-
  if (grade.startsWith('B')) return '#ffd700';  // B+, B, B-
  if (grade.startsWith('C')) return '#ff8c00';  // C+, C, C-
  if (grade.startsWith('D')) return '#ff6600';  // D+, D, D-
  return '#ff4444';                              // F
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 ' + t('reports.performance.bytes', 'Bytes');
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [t('reports.performance.bytes', 'Bytes'), 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getLoadingHTML() {
  return `
    <div class="section">
      <h2>${t('reports.performance.analyzing', 'ANALYZING...')}</h2>
      <div style="padding-left: 1rem;">
        <p>>> ${t('reports.performance.runningAnalysis', 'running comprehensive performance analysis...')}</p>
        <p>>> ${t('reports.performance.measuringVitals', 'measuring core web vitals...')}</p>
        <p>>> ${t('reports.performance.analyzingResources', 'analyzing resource loading...')}</p>
        <p>>> ${t('reports.performance.evaluatingNetwork', 'evaluating network performance...')}</p>
        <p>>> ${t('reports.performance.checkingCaching', 'checking caching strategies...')}</p>
        <div class="loading-bar" style="margin-top: 1rem;"></div>
      </div>
    </div>
  `;
}

function showError(message) {
  const container = document.getElementById('perfResults');
  container.innerHTML = `
    <div class="section">
      <h2 style="color: #ff0000;">${t('reports.performance.error', 'Error')}</h2>
      <div style="padding-left: 1rem;">
        <p>>> ${t('reports.performance.analysisFailed', 'Performance analysis failed')}</p>
        <p style="color: #ff6600;">>> ${message}</p>
        <button data-action="reload-page" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #ff6600; color: #000; border: none; cursor: pointer; font-family: 'Courier New', monospace; font-weight: bold;">${t('reports.performance.retry', 'RETRY')}</button>
      </div>
    </div>
  `;
  container.style.display = 'block';
}

/**
 * Cross-Browser Loading HTML
 */
function getCrossBrowserLoadingHTML() {
  return `
    <div class="section">
      <h2>${t('reports.performance.crossBrowserAnalysis', 'Cross-Browser Analysis')}</h2>
      <div style="padding-left: 1rem;">
        <p>>> ${t('reports.performance.runningDesktopAnalysis', 'running desktop analysis (Lighthouse)...')}</p>
        <p>>> ${t('reports.performance.runningMobileAnalysis', 'running mobile analysis (Lighthouse)...')}</p>
        <p>>> ${t('reports.performance.comparingCoreWebVitals', 'comparing Core Web Vitals across devices...')}</p>
        <p>>> ${t('reports.performance.generatingComparison', 'generating performance comparison...')}</p>
        <p style="color: #ff6600; font-style: italic;">>>> ${t('reports.performance.estimatedTime', 'estimated time: 30-60 seconds')}</p>
        <div class="loading-bar" style="margin-top: 1rem;"></div>
      </div>
    </div>
  `;
}

/**
 * Display Cross-Browser Comparison Results
 */
function displayCrossBrowserResults(results) {
  const container = document.getElementById('perfResults');
  
  // Clear container
  container.innerHTML = '';
  container.style.display = 'block';
  
  // Executive Summary
  const summarySection = document.createElement('div');
  summarySection.className = 'section';
  summarySection.innerHTML = `
    <h2>${t('reports.performance.crossBrowserComparisonResults', 'Cross-Browser Comparison Results')}</h2>
    <p>>> ${t('reports.performance.url', 'URL')}: ${results.url}</p>
    <p>>> ${t('reports.performance.timestamp', 'timestamp')}: ${window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date(results.timestamp)) : new Date(results.timestamp).toLocaleString()}</p>
    <p>>> ${t('reports.performance.analysisDuration', 'analysis_duration')}: ${results.duration ? `${(results.duration / 1000).toFixed(1)}s` : t('reports.performance.notAvailable', 'N/A')}</p>
    <p>>> ${t('reports.performance.devicesTested', 'devices_tested')}: ${Object.keys(results.browsers).length}</p>

    <!-- Overall Comparison Score -->
    <div style="
      background: linear-gradient(135deg, rgba(187,134,252,0.05) 0%, rgba(187,134,252,0.02) 100%);
      border: 2px solid ${getPerformanceColor(results.overallScore)};
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
      box-shadow: 0 4px 20px rgba(187,134,252,0.15);
    ">
      <h3 style="margin: 0 0 1.5rem 0; color: #bb86fc;">${t('reports.performance.overallPerformanceComparison', 'Overall Performance Comparison')}</h3>

      <!-- Circular Dials for Each Browser -->
      <div style="display: flex; justify-content: center; gap: 3rem; flex-wrap: wrap; margin: 2rem 0;">
        ${renderBrowserDials(results.browsers)}
      </div>

      <!-- Performance Gap Warning -->
      ${results.comparison.performanceGap > 20 ? `
        <div style="background: rgba(255, 102, 0, 0.1); border-left: 4px solid #ff6600; padding: 1rem; margin-top: 1.5rem; border-radius: 4px;">
          <p style="margin: 0; color: #ff6600; font-weight: bold;">~ ${t('reports.performance.significantPerformanceGap', 'Significant Performance Gap Detected')}</p>
          <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">
            ${t('reports.performance.performanceGapPoints', '{{gap}} point difference between desktop and mobile performance', { gap: results.comparison.performanceGap })}
          </p>
        </div>
      ` : ''}

      <!-- Overall Score -->
      <div style="text-align: center; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(187,134,252,0.3);">
        <div style="font-size: 2.5rem; font-weight: bold; color: ${getPerformanceColor(results.overallScore)}; margin-bottom: 0.5rem;">
          ${results.overallScore}
        </div>
        <div style="font-size: 1rem; color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.averagePerformanceScore', 'Average Performance Score')}</div>
      </div>
    </div>
  `;
  
  container.appendChild(summarySection);
  
  // Accordion Sections
  createAccordionSection(container, 'browser-comparison', t('reports.performance.deviceByDeviceAnalysis', 'Device-by-Device Analysis'),
    () => renderDeviceComparisonContent(results.browsers), null);

  createAccordionSection(container, 'cwv-comparison', t('reports.performance.coreWebVitalsComparison', 'Core Web Vitals Comparison'),
    () => renderCWVComparisonContent(results.browsers), null);

  createAccordionSection(container, 'cross-browser-recommendations', t('reports.performance.crossDeviceRecommendations', 'Cross-Device Recommendations'),
    () => renderCrossBrowserRecommendationsContent(results.recommendations, results.comparison), null);
}

/**
 * Render browser circular dials
 */
function renderBrowserDials(browsers) {
  return Object.entries(browsers).map(([key, data]) => {
    const score = data.performanceScore || 0;
    const color = getPerformanceColor(score);
    const circumference = 2 * Math.PI * 75; // radius 75
    const offset = circumference - (score / 100) * circumference;
    
    return `
      <div style="text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">${data.icon}</div>
        <svg width="180" height="180" style="transform: rotate(-90deg);">
          <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="10"/>
          <circle 
            cx="90" cy="90" r="75" 
            fill="none" 
            stroke="${color}" 
            stroke-width="10"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"
            stroke-linecap="round"
            style="transition: stroke-dashoffset 1s ease;"
          />
          <text 
            x="90" y="95" 
            text-anchor="middle" 
            font-size="36" 
            font-weight="bold" 
            fill="#ffffff"
            style="transform: rotate(90deg); transform-origin: 90px 90px; text-shadow: 0 0 10px ${color};"
          >
            ${score}
          </text>
          <text 
            x="90" y="115" 
            text-anchor="middle" 
            font-size="14" 
            fill="#808080"
            style="transform: rotate(90deg); transform-origin: 90px 90px;"
          >
            /100
          </text>
        </svg>
        <div style="margin-top: 0.5rem; font-weight: bold;">${data.browser}</div>
        <div style="font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${data.description}</div>
      </div>
    `;
  }).join('');
}

/**
 * Render device comparison content
 */
function renderDeviceComparisonContent(browsers) {
  let html = '<div>';
  
  Object.entries(browsers).forEach(([key, data]) => {
    const perfColor = getPerformanceColor(data.performanceScore);
    const a11yColor = getPerformanceColor(data.accessibilityScore);
    const bpColor = getPerformanceColor(data.bestPracticesScore);
    const seoColor = getPerformanceColor(data.seoScore);
    
    html += `
      <div style="margin-bottom: 2rem; padding: 1.5rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(187,134,252,0.2);">
        <h3 style="margin: 0 0 1rem 0; color: #bb86fc;">
          ${data.icon} ${data.browser} - ${data.description}
        </h3>

        ${!data.success ? `
          <p style="color: #ff4444;">✗ ${t('reports.performance.analysisFailed', 'Performance analysis failed')}: ${data.error || t('reports.performance.unknownError', 'Unknown error')}</p>
        ` : `
          <!-- Lighthouse Category Scores -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${perfColor};">${data.performanceScore}</div>
              <div style="font-size: 0.9rem; color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.performance', 'Performance')}</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${a11yColor};">${data.accessibilityScore}</div>
              <div style="font-size: 0.9rem; color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.accessibility', 'Accessibility')}</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${bpColor};">${data.bestPracticesScore}</div>
              <div style="font-size: 0.9rem; color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.bestPractices', 'Best Practices')}</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${seoColor};">${data.seoScore}</div>
              <div style="font-size: 0.9rem; color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.seo', 'SEO')}</div>
            </div>
          </div>

          <!-- Core Web Vitals -->
          <h4 style="margin: 1rem 0 0.5rem 0; color: #00ff41;">${t('reports.performance.coreWebVitals', 'Core Web Vitals')}</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
            ${renderMetricBox('LCP', data.metrics.metrics.coreWebVitals.lcp, 'ms', 'lcp')}
            ${renderMetricBox('FID', data.metrics.metrics.coreWebVitals.fid, 'ms', 'fid')}
            ${renderMetricBox('CLS', data.metrics.metrics.coreWebVitals.cls, '', 'cls')}
          </div>

          <!-- Additional Metrics -->
          <h4 style="margin: 1rem 0 0.5rem 0; color: #00ff41;">${t('reports.performance.additionalMetrics', 'Additional Metrics')}</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
            ${renderMetricBox('FCP', data.metrics.firstContentfulPaint, 'ms', 'fcp')}
            ${renderMetricBox('TBT', data.metrics.totalBlockingTime, 'ms', 'tbt')}
            ${renderMetricBox(t('reports.performance.speedIndex', 'Speed Index (SI)'), data.metrics.speedIndex, 'ms', 'si')}
          </div>
        `}
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}

/**
 * Render Core Web Vitals comparison table
 */
function renderCWVComparisonContent(browsers) {
  const browserKeys = Object.keys(browsers);
  const desktopData = browsers.desktop;
  const mobileData = browsers.mobile;

  if (!desktopData || !mobileData) {
    return '<p style="color: #ff6600;">>>> ' + t('reports.performance.comparisonRequiresBothDevices', 'Comparison requires both desktop and mobile data') + '</p>';
  }

  return `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-family: 'Courier New', monospace;">
        <thead>
          <tr style="border-bottom: 2px solid rgba(187,134,252,0.3);">
            <th style="text-align: left; padding: 1rem; color: #bb86fc;">${t('reports.performance.metric', 'Metric')}</th>
            <th style="text-align: center; padding: 1rem; color: #bb86fc;">D ${t('reports.performance.desktop', 'Desktop')}</th>
            <th style="text-align: center; padding: 1rem; color: #bb86fc;">M ${t('reports.performance.mobile', 'Mobile')}</th>
            <th style="text-align: center; padding: 1rem; color: #bb86fc;">${t('reports.performance.difference', 'Difference')}</th>
            <th style="text-align: center; padding: 1rem; color: #bb86fc;">${t('reports.performance.status', 'Status')}</th>
          </tr>
        </thead>
        <tbody>
          ${renderComparisonRow('LCP', desktopData.metrics.metrics.coreWebVitals.lcp, mobileData.metrics.metrics.coreWebVitals.lcp, 'ms', 2500, 4000)}
          ${renderComparisonRow('FID', desktopData.metrics.metrics.coreWebVitals.fid, mobileData.metrics.metrics.coreWebVitals.fid, 'ms', 100, 300)}
          ${renderComparisonRow('CLS', desktopData.metrics.metrics.coreWebVitals.cls, mobileData.metrics.metrics.coreWebVitals.cls, '', 0.1, 0.25)}
          ${renderComparisonRow('FCP', desktopData.metrics.firstContentfulPaint, mobileData.metrics.firstContentfulPaint, 'ms', 1800, 3000)}
          ${renderComparisonRow('TBT', desktopData.metrics.totalBlockingTime, mobileData.metrics.totalBlockingTime, 'ms', 200, 600)}
          ${renderComparisonRow(t('reports.performance.speedIndex', 'Speed Index (SI)'), desktopData.metrics.speedIndex, mobileData.metrics.speedIndex, 'ms', 3400, 5800)}
        </tbody>
      </table>
    </div>

    <!-- Performance Score Comparison -->
    <div style="margin-top: 2rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
      <h4 style="margin: 0 0 1rem 0; color: #bb86fc;">${t('reports.performance.lighthouseCategoryScores', 'Lighthouse Category Scores')}</h4>
      <div style="display: grid; grid-template-columns: auto 1fr 1fr 1fr; gap: 0.5rem; align-items: center;">
        <div style="font-weight: bold;">${t('reports.performance.category', 'Category')}</div>
        <div style="text-align: center; font-weight: bold;">D ${t('reports.performance.desktop', 'Desktop')}</div>
        <div style="text-align: center; font-weight: bold;">M ${t('reports.performance.mobile', 'Mobile')}</div>
        <div style="text-align: center; font-weight: bold;">${t('reports.performance.gap', 'Gap')}</div>

        ${renderScoreComparisonRow(t('reports.performance.performance', 'Performance'), desktopData.performanceScore, mobileData.performanceScore)}
        ${renderScoreComparisonRow(t('reports.performance.accessibility', 'Accessibility'), desktopData.accessibilityScore, mobileData.accessibilityScore)}
        ${renderScoreComparisonRow(t('reports.performance.bestPractices', 'Best Practices'), desktopData.bestPracticesScore, mobileData.bestPracticesScore)}
        ${renderScoreComparisonRow(t('reports.performance.seo', 'SEO'), desktopData.seoScore, mobileData.seoScore)}
      </div>
    </div>
  `;
}

/**
 * Render comparison table row
 */
function renderComparisonRow(metric, desktopValue, mobileValue, unit, goodThreshold, needsImprovementThreshold) {
  const diff = Math.abs(mobileValue - desktopValue);
  const diffPercent = desktopValue > 0 ? ((diff / desktopValue) * 100).toFixed(0) : 0;

  let status, statusColor;
  const avgValue = (desktopValue + mobileValue) / 2;

  if (metric === 'CLS') {
    if (avgValue <= goodThreshold) {
      status = '✓ ' + t('reports.performance.good', 'Good');
      statusColor = '#00ff41';
    } else if (avgValue <= needsImprovementThreshold) {
      status = '~ ' + t('reports.performance.needsWork', 'Needs work');
      statusColor = '#ffa500';
    } else {
      status = '✗ ' + t('reports.performance.poor', 'Poor');
      statusColor = '#ff4444';
    }
  } else {
    if (avgValue <= goodThreshold) {
      status = '✓ ' + t('reports.performance.good', 'Good');
      statusColor = '#00ff41';
    } else if (avgValue <= needsImprovementThreshold) {
      status = '~ ' + t('reports.performance.needsWork', 'Needs work');
      statusColor = '#ffa500';
    } else {
      status = '✗ ' + t('reports.performance.poor', 'Poor');
      statusColor = '#ff4444';
    }
  }
  
  return `
    <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
      <td style="padding: 0.75rem; font-weight: bold;">${metric}</td>
      <td style="padding: 0.75rem; text-align: center;">${desktopValue.toFixed(metric === 'CLS' ? 3 : 0)}${unit}</td>
      <td style="padding: 0.75rem; text-align: center;">${mobileValue.toFixed(metric === 'CLS' ? 3 : 0)}${unit}</td>
      <td style="padding: 0.75rem; text-align: center; color: ${diff > desktopValue * 0.5 ? '#ff6600' : '#808080'};">
        +${diff.toFixed(metric === 'CLS' ? 3 : 0)}${unit} (${diffPercent}%)
      </td>
      <td style="padding: 0.75rem; text-align: center; color: ${statusColor}; font-weight: bold;">
        ${status}
      </td>
    </tr>
  `;
}

/**
 * Render score comparison row
 */
function renderScoreComparisonRow(category, desktopScore, mobileScore) {
  const gap = Math.abs(desktopScore - mobileScore);
  const gapColor = gap > 20 ? '#ff6600' : gap > 10 ? '#ffa500' : '#00ff41';
  
  return `
    <div style="padding: 0.5rem 0; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">${category}</div>
    <div style="padding: 0.5rem 0; text-align: center; color: ${getPerformanceColor(desktopScore)}; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
      ${desktopScore}
    </div>
    <div style="padding: 0.5rem 0; text-align: center; color: ${getPerformanceColor(mobileScore)}; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
      ${mobileScore}
    </div>
    <div style="padding: 0.5rem 0; text-align: center; color: ${gapColor}; font-weight: bold; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
      ${gap}
    </div>
  `;
}

/**
 * Render metric box for device comparison
 */
function renderMetricBox(label, value, unit, metricType) {
  let color, status;
  const numValue = parseFloat(value) || 0;

  // Determine color and status based on metric type
  switch(metricType) {
    case 'lcp':
      if (numValue <= 2500) { color = '#00ff41'; status = t('reports.performance.good', 'Good'); }
      else if (numValue <= 4000) { color = '#ffa500'; status = t('reports.performance.needsWork', 'Needs work'); }
      else { color = '#ff4444'; status = t('reports.performance.poor', 'Poor'); }
      break;
    case 'fid':
      if (numValue <= 100) { color = '#00ff41'; status = t('reports.performance.good', 'Good'); }
      else if (numValue <= 300) { color = '#ffa500'; status = t('reports.performance.needsWork', 'Needs work'); }
      else { color = '#ff4444'; status = t('reports.performance.poor', 'Poor'); }
      break;
    case 'cls':
      if (numValue <= 0.1) { color = '#00ff41'; status = t('reports.performance.good', 'Good'); }
      else if (numValue <= 0.25) { color = '#ffa500'; status = t('reports.performance.needsWork', 'Needs work'); }
      else { color = '#ff4444'; status = t('reports.performance.poor', 'Poor'); }
      break;
    case 'fcp':
      if (numValue <= 1800) { color = '#00ff41'; status = t('reports.performance.good', 'Good'); }
      else if (numValue <= 3000) { color = '#ffa500'; status = t('reports.performance.needsWork', 'Needs work'); }
      else { color = '#ff4444'; status = t('reports.performance.poor', 'Poor'); }
      break;
    case 'tbt':
      if (numValue <= 200) { color = '#00ff41'; status = t('reports.performance.good', 'Good'); }
      else if (numValue <= 600) { color = '#ffa500'; status = t('reports.performance.needsWork', 'Needs work'); }
      else { color = '#ff4444'; status = t('reports.performance.poor', 'Poor'); }
      break;
    case 'si':
      if (numValue <= 3400) { color = '#00ff41'; status = t('reports.performance.good', 'Good'); }
      else if (numValue <= 5800) { color = '#ffa500'; status = t('reports.performance.needsWork', 'Needs work'); }
      else { color = '#ff4444'; status = t('reports.performance.poor', 'Poor'); }
      break;
    default:
      color = '#808080';
      status = t('reports.performance.info', 'Info');
  }
  
  return `
    <div style="padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 4px; border-left: 3px solid ${color};">
      <div style="font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF); margin-bottom: 0.25rem;">${label}</div>
      <div style="font-size: 1.25rem; font-weight: bold; color: ${color};">
        ${metricType === 'cls' ? numValue.toFixed(3) : numValue.toFixed(0)}${unit}
      </div>
      <div style="font-size: 0.75rem; color: ${color};">${status}</div>
    </div>
  `;
}

/**
 * Render cross-browser recommendations
 */
function renderCrossBrowserRecommendationsContent(recommendations, comparison) {
  if (!recommendations || recommendations.length === 0) {
    return '<p style="color: #00ff41;">>>> ' + t('reports.performance.noMajorCrossDeviceIssues', 'No major cross-device issues detected!') + '</p>';
  }

  let html = '<div>';

  recommendations.forEach((rec, index) => {
    const priorityColor = rec.priority === 'high' ? '#ff4444' : rec.priority === 'medium' ? '#ffa500' : '#00ff41';
    const priorityIcon = rec.priority === 'high' ? '!' : rec.priority === 'medium' ? '~' : 'ⓘ';

    html += `
      <div style="margin-bottom: 1.5rem; padding: 1.5rem; background: rgba(255,255,255,0.03); border-left: 4px solid ${priorityColor}; border-radius: 4px;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <span style="font-size: 1.2rem;">${priorityIcon}</span>
          <h4 style="margin: 0; color: ${priorityColor};">${translateRecTitle(rec.title)}</h4>
          <span style="margin-left: auto; padding: 0.25rem 0.75rem; background: ${priorityColor}33; color: ${priorityColor}; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">
            ${translatePriority(rec.priority)}
          </span>
        </div>

        <p style="margin: 0.5rem 0; color: var(--r-text-muted, #6B7280);">${translateRecDescription(rec.title, rec.description)}</p>

        ${rec.actions && rec.actions.length > 0 ? `
          <div style="margin-top: 1rem;">
            <strong style="color: #bb86fc;">${t('reports.performance.recommendedActions', 'Recommended Actions')}:</strong>
            <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
              ${rec.actions.map(action => `<li style="margin: 0.25rem 0; color: var(--r-text-muted, #6B7280);">${action}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  });

  // Add metrics differences if present
  if (comparison && comparison.metricsDifferences && comparison.metricsDifferences.length > 0) {
    html += `
      <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(255,165,0,0.05); border: 1px solid rgba(255,165,0,0.3); border-radius: 8px;">
        <h4 style="margin: 0 0 1rem 0; color: #ffa500;">C ${t('reports.performance.detectedMetricDiscrepancies', 'Detected Metric Discrepancies')}</h4>
        ${comparison.metricsDifferences.map(diff => `
          <div style="padding: 0.75rem; margin: 0.5rem 0; background: var(--r-surface-2, #F8FAFC); border-radius: 4px;">
            <div style="font-weight: bold; color: ${diff.severity === 'high' ? '#ff4444' : '#ffa500'};">
              ${diff.metric}
            </div>
            <div style="font-size: 0.9rem; color: var(--r-text-muted, #6B7280); margin-top: 0.25rem;">
              ${diff.message}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem; font-size: 0.85rem;">
              <div>D ${t('reports.performance.desktop', 'Desktop')}: <span style="color: #00ff41;">${typeof diff.desktop === 'number' ? diff.desktop.toFixed(diff.metric.includes('CLS') ? 3 : 0) : diff.desktop}</span></div>
              <div>M ${t('reports.performance.mobile', 'Mobile')}: <span style="color: #ffa500;">${typeof diff.mobile === 'number' ? diff.mobile.toFixed(diff.metric.includes('CLS') ? 3 : 0) : diff.mobile}</span></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  html += '</div>';
  return html;
}

/**
 * Open PDF purchase modal (shared function)
 */
// PDF purchase modal removed - monetization disabled

/**
 * Export performance results to CSV
 */
function exportPerformanceCSV() {
  const results = window.currentPerformanceResults;
  if (!results) {
    console.warn('No performance results available to export');
    return;
  }

  const rows = [];

  // Header
  rows.push([t('reports.performance.csv.metric', 'Metric'), t('reports.performance.csv.value', 'Value'), t('reports.performance.csv.unit', 'Unit'), t('reports.performance.csv.status', 'Status')]);

  // URL info
  rows.push(['URL', results.url || '', '', '']);
  rows.push([t('reports.performance.csv.scanDate', 'Scan Date'), new Date().toISOString(), '', '']);
  rows.push(['', '', '', '']);

  // Performance Score
  const score = results.score || results.performanceScore || 0;
  rows.push([t('reports.performance.csv.performanceScore', 'Performance Score'), score, t('reports.performance.csv.points', 'points'), score >= 90 ? t('reports.performance.good', 'Good') : score >= 50 ? t('reports.performance.needsImprovement', 'Needs Improvement') : t('reports.performance.poor', 'Poor')]);
  rows.push(['', '', '', '']);

  // Core Web Vitals
  rows.push(['--- ' + t('reports.performance.coreWebVitals', 'Core Web Vitals') + ' ---', '', '', '']);

  const vitals = results.coreWebVitals || results.vitals || {};
  if (vitals.LCP !== undefined) {
    const lcpMs = typeof vitals.LCP === 'number' ? vitals.LCP : 0;
    rows.push([t('reports.performance.largestContentfulPaint', 'Largest Contentful Paint (LCP)'), lcpMs, 'ms', lcpMs <= 2500 ? t('reports.performance.good', 'Good') : lcpMs <= 4000 ? t('reports.performance.needsImprovement', 'Needs Improvement') : t('reports.performance.poor', 'Poor')]);
  }
  if (vitals.FID !== undefined) {
    const fidMs = typeof vitals.FID === 'number' ? vitals.FID : 0;
    rows.push([t('reports.performance.firstInputDelay', 'First Input Delay (FID)'), fidMs, 'ms', fidMs <= 100 ? t('reports.performance.good', 'Good') : fidMs <= 300 ? t('reports.performance.needsImprovement', 'Needs Improvement') : t('reports.performance.poor', 'Poor')]);
  }
  if (vitals.CLS !== undefined) {
    const cls = typeof vitals.CLS === 'number' ? vitals.CLS : 0;
    rows.push([t('reports.performance.cumulativeLayoutShift', 'Cumulative Layout Shift (CLS)'), cls.toFixed(3), '', cls <= 0.1 ? t('reports.performance.good', 'Good') : cls <= 0.25 ? t('reports.performance.needsImprovement', 'Needs Improvement') : t('reports.performance.poor', 'Poor')]);
  }
  if (vitals.FCP !== undefined) {
    const fcpMs = typeof vitals.FCP === 'number' ? vitals.FCP : 0;
    rows.push([t('reports.performance.firstContentfulPaint', 'First Contentful Paint (FCP)'), fcpMs, 'ms', fcpMs <= 1800 ? t('reports.performance.good', 'Good') : fcpMs <= 3000 ? t('reports.performance.needsImprovement', 'Needs Improvement') : t('reports.performance.poor', 'Poor')]);
  }
  if (vitals.TTFB !== undefined) {
    const ttfbMs = typeof vitals.TTFB === 'number' ? vitals.TTFB : 0;
    rows.push([t('reports.performance.timeToFirstByte', 'Time to First Byte (TTFB)'), ttfbMs, 'ms', ttfbMs <= 800 ? t('reports.performance.good', 'Good') : ttfbMs <= 1800 ? t('reports.performance.needsImprovement', 'Needs Improvement') : t('reports.performance.poor', 'Poor')]);
  }
  if (vitals.SI !== undefined) {
    const siMs = typeof vitals.SI === 'number' ? vitals.SI : 0;
    rows.push([t('reports.performance.speedIndex', 'Speed Index (SI)'), siMs, 'ms', siMs <= 3400 ? t('reports.performance.good', 'Good') : siMs <= 5800 ? t('reports.performance.needsImprovement', 'Needs Improvement') : t('reports.performance.poor', 'Poor')]);
  }
  if (vitals.TBT !== undefined) {
    const tbtMs = typeof vitals.TBT === 'number' ? vitals.TBT : 0;
    rows.push([t('reports.performance.csv.totalBlockingTime', 'Total Blocking Time (TBT)'), tbtMs, 'ms', tbtMs <= 200 ? t('reports.performance.good', 'Good') : tbtMs <= 600 ? t('reports.performance.needsImprovement', 'Needs Improvement') : t('reports.performance.poor', 'Poor')]);
  }

  rows.push(['', '', '', '']);

  // Resource breakdown if available
  if (results.resources) {
    rows.push(['--- ' + t('reports.performance.resourceAnalysis', 'Resource Analysis') + ' ---', '', '', '']);
    const resources = results.resources;
    if (resources.totalSize !== undefined) rows.push([t('reports.performance.totalSize', 'Total Size'), resources.totalSize, t('reports.performance.csv.bytes', 'bytes'), '']);
    if (resources.totalRequests !== undefined) rows.push([t('reports.performance.totalRequests', 'Total Requests'), resources.totalRequests, '', '']);
    if (resources.scripts !== undefined) rows.push([t('reports.performance.csv.scripts', 'Scripts'), typeof resources.scripts === 'object' ? resources.scripts.count || 0 : resources.scripts, '', '']);
    if (resources.stylesheets !== undefined) rows.push([t('reports.performance.csv.stylesheets', 'Stylesheets'), typeof resources.stylesheets === 'object' ? resources.stylesheets.count || 0 : resources.stylesheets, '', '']);
    if (resources.images !== undefined) rows.push([t('reports.performance.images', 'Images'), typeof resources.images === 'object' ? resources.images.count || 0 : resources.images, '', '']);
    if (resources.fonts !== undefined) rows.push([t('reports.performance.fonts', 'Fonts'), typeof resources.fonts === 'object' ? resources.fonts.count || 0 : resources.fonts, '', '']);
    rows.push(['', '', '', '']);
  }

  // Recommendations if available
  if (results.recommendations && results.recommendations.length > 0) {
    rows.push(['--- ' + t('reports.common.reportRecommendations', 'Recommendations') + ' ---', '', '', '']);
    results.recommendations.forEach((rec, index) => {
      const title = rec.title || rec.name || t('reports.performance.csv.recommendation', 'Recommendation') + ` ${index + 1}`;
      const impact = rec.impact || rec.priority || '';
      const savings = rec.savings || rec.estimatedSavings || '';
      rows.push([title, impact, savings, rec.category || '']);
    });
  }

  // Convert to CSV string
  const csvContent = rows.map(row =>
    row.map(cell => {
      const cellStr = String(cell);
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
  const urlParam = results.url ? results.url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) : 'performance';
  link.href = URL.createObjectURL(blob);
  link.download = `performance_report_${urlParam}_${new Date().toISOString().split('T')[0]}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

window.exportPerformanceCSV = exportPerformanceCSV;




