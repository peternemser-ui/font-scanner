/**
 * Performance Hub Script
 * Unified performance analysis with three modes:
 * - Quick Scan: Fast resource analysis without Lighthouse
 * - Full Analysis: Complete Lighthouse audit with desktop/mobile
 * - Core Web Vitals: Google ranking metrics focus
 */

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const analyzeButton = document.getElementById('analyzeButton');
  const buttonText = document.getElementById('buttonText');
  const results = document.getElementById('results');
  const loadingContainer = document.getElementById('loadingContainer');
  const resultsContent = document.getElementById('resultsContent');
  const errorMessage = document.getElementById('errorMessage');
  const modeTabs = document.querySelectorAll('.tabs__item');
  const modeIndicator = document.getElementById('selectedMode');

  let currentMode = 'quick';
  let loader = null;

  // Expose mode switching globally for inline onclick handlers
  window.setPerformanceMode = function(mode, buttonEl) {
    console.log('Setting mode to:', mode);
    currentMode = mode;
    
    // Update active state on tabs
    modeTabs.forEach(t => t.classList.remove('tabs__item--active'));
    if (buttonEl) {
      buttonEl.classList.add('tabs__item--active');
    }
    
    // Update mode indicator
    updateModeIndicator();
  };

  // Debug: Check if tabs are found
  console.log('Mode tabs found:', modeTabs.length);

  // Tab switching is handled by inline script in HTML
  // This external script just reads the active tab at analysis time

  function updateModeIndicator() {
    const modeLabels = {
      'quick': 'Quick scan',
      'cwv': 'Core Web Vitals',
      'full': 'Lighthouse audit'
    };
    if (modeIndicator) {
      modeIndicator.textContent = modeLabels[currentMode] || 'Quick scan';
    }
  }

  // Handle analysis
  analyzeButton.addEventListener('click', runAnalysis);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') runAnalysis();
  });

  // Check for URL in query params
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('url');
  const modeParam = params.get('mode');
  
  if (modeParam && ['quick', 'full', 'cwv'].includes(modeParam)) {
    currentMode = modeParam;
    modeTabs.forEach(t => {
      t.classList.remove('tabs__item--active');
      if (t.dataset.mode === modeParam) {
        t.classList.add('tabs__item--active');
      }
    });
    updateModeIndicator();
  }
  
  if (urlParam) {
    urlInput.value = urlParam;
    runAnalysis();
  }

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
      case 'quick': return '[QUICK SCAN]';
      case 'full': return '[FULL LIGHTHOUSE ANALYSIS]';
      case 'cwv': return '[CORE WEB VITALS]';
      default: return '[ANALYZING]';
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
      console.log('Mode from active tab:', currentMode);
    }
    console.log('Running analysis with mode:', currentMode);

    // Show loading with AnalyzerLoader
    results.classList.remove('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    analyzeButton.disabled = true;
    buttonText.textContent = 'Running scan...';

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
      background: rgba(0, 255, 65, 0.05);
      border: 1px solid rgba(0, 255, 65, 0.3);
      border-radius: 6px;
      text-align: center;
      overflow: visible;
    `;
    loaderMessageEl.innerHTML = `
      <div style="overflow-x: auto; overflow-y: visible; -webkit-overflow-scrolling: touch;">
        <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: #00ff41; font-family: monospace; text-shadow: 2px 2px 0px rgba(0, 255, 65, 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
      </div>
      <p style="margin: 0.75rem 0 0 0; font-size: clamp(0.75rem, 2.5vw, 0.9rem); color: #00ff41; font-weight: 600; letter-spacing: 0.05em; padding: 0 0.5rem;">
        ${currentMode === 'full' ? 'Full Lighthouse analysis in progress...' : 'Performance analysis in progress...'}
      </p>
      <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(0, 255, 65, 0.7); padding: 0 0.5rem;">
        ${currentMode === 'full' ? 'This may take 60-90 seconds' : 'This may take 15-30 seconds'}
      </p>
    `;

    // Add color cycling animation
    if (!document.getElementById('ascii-art-style')) {
      const style = document.createElement('style');
      style.id = 'ascii-art-style';
      style.textContent = `
        @keyframes color-cycle {
          0% { color: #00ff41; }
          20% { color: #00ffff; }
          40% { color: #0099ff; }
          60% { color: #9933ff; }
          80% { color: #ff33cc; }
          100% { color: #00ff41; }
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

      switch (currentMode) {
        case 'quick':
          data = await runQuickScan(url);
          displayQuickResults(data);
          break;
        case 'full':
          // Check if payment is required for Lighthouse
          const hasLighthousePaid = await checkPaymentStatus('lighthouse', url);
          if (!hasLighthousePaid) {
            showPaymentGate('lighthouse', url);
            return;
          }
          data = await runFullAnalysis(url);
          displayFullResults(data);
          break;
        case 'cwv':
          // Check if payment is required for CWV
          const hasCWVPaid = await checkPaymentStatus('cwv', url);
          if (!hasCWVPaid) {
            showPaymentGate('cwv', url);
            return;
          }
          data = await runCWVAnalysis(url);
          displayCWVResults(data);
          break;
      }

    } catch (error) {
      showError(error.message);
    } finally {
      analyzeButton.disabled = false;
      buttonText.textContent = 'Run scan';
      if (loader) {
        loader.complete();
      }
    }
  }

  // Quick Scan Mode
  async function runQuickScan(url) {
    if (loader) loader.nextStep(0);

    const response = await fetch('/api/performance-snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
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
  async function runFullAnalysis(url) {
    if (loader) loader.nextStep(0);

    // Create abort controller with 5 minute timeout for Lighthouse
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

    try {
      const response = await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
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
  async function runCWVAnalysis(url) {
    if (loader) loader.nextStep(0);

    const response = await fetch('/api/core-web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
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
    const url = urlInput.value;

    // Log for debugging
    console.log('Quick Scan Data:', { summary, resources, recommendations, performanceScore: data.performanceScore });

    // Calculate metric ratings
    const requestsRating = summary.totalRequests <= 50 ? 'good' : summary.totalRequests <= 100 ? 'average' : 'poor';
    const weightRating = summary.estimatedPageWeightKB <= 1000 ? 'good' : summary.estimatedPageWeightKB <= 3000 ? 'average' : 'poor';
    const blockingRating = summary.renderBlockingCount <= 3 ? 'good' : summary.renderBlockingCount <= 5 ? 'average' : 'poor';
    const responseRating = summary.serverResponseTime <= 500 ? 'good' : summary.serverResponseTime <= 1000 ? 'average' : 'poor';

    const html = `
      ${createReportHeader('quick', url)}

      ${createScoreSection(
        'Quick Performance Score',
        data.performanceScore || 0,
        data.performanceScore || 0,
        `Based on resource analysis • ${data.pagesScanned || 1} page(s)`
      )}

      ${createSectionHeader('Key Performance Metrics', '⚡')}
      <div class="score-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem; max-width: 700px;">
        ${createMetricCard(summary.totalRequests || 0, 'Requests', requestsRating, '📦')}
        ${createMetricCard(formatKB(summary.estimatedPageWeightKB), 'Page Weight', weightRating, '⚖️')}
        ${createMetricCard(summary.renderBlockingCount || 0, 'Blocking', blockingRating, '🚫')}
        ${createMetricCard(`${summary.serverResponseTime || 0}ms`, 'Response', responseRating, '⚡')}
      </div>

      ${recommendations.likelyCauses && recommendations.likelyCauses.length > 0
        ? createInfoBox('error', 'Likely Performance Issues', `
            <ul style="margin: 0; padding-left: 1.5rem; display: grid; gap: 0.5rem;">
              ${recommendations.likelyCauses.map(cause => `<li>${cause}</li>`).join('')}
            </ul>
          `, '🔍')
        : createInfoBox('success', 'No Major Issues Detected', 'Your page resources appear to be well-optimized.', '✓')
      }

      ${createSectionHeader('Resource Breakdown', '📊')}
      <div style="margin-bottom: 2rem;">
        ${renderResourceAccordions(resources)}
      </div>

      ${createNextStepsSection('quick')}
    `;

    resultsContent.innerHTML = html;
    showPdfExportButton();
    animateScoreRings();
    scrollToResults();
  }

  // Display Full Lighthouse Results
  function displayFullResults(data) {
    // API returns { success, results, requestId } - extract results
    const results = data.results || data;
    const desktop = results.desktop || {};
    const mobile = results.mobile || {};
    const url = urlInput.value;

    // Calculate overall performance score (average of desktop and mobile)
    const desktopPerf = desktop.lighthouse?.performance || desktop.performanceScore || 0;
    const mobilePerf = mobile.lighthouse?.performance || mobile.performanceScore || 0;
    const overallPerf = Math.round((desktopPerf + mobilePerf) / 2);

    const html = `
      ${createReportHeader('full', url)}

      ${createScoreSection(
        'Overall Lighthouse Performance',
        overallPerf,
        overallPerf,
        'Combined Desktop & Mobile Analysis',
        overallPerf >= 90 ? '✓ Excellent Performance' : overallPerf >= 50 ? '⚠ Moderate Performance' : '✗ Poor Performance'
      )}

      <!-- Side by Side Results -->
      <div class="side-by-side-results">
        <!-- Desktop Results -->
        <div class="device-column" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 2rem;">
          <h2 style="text-align: center; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <span style="font-size: 1.5rem;">🖥️</span> Desktop
          </h2>
          ${renderLighthouseResults(desktop, 'Desktop')}
        </div>

        <!-- Mobile Results -->
        <div class="device-column" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 2rem;">
          <h2 style="text-align: center; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <span style="font-size: 1.5rem;">📱</span> Mobile
          </h2>
          ${renderLighthouseResults(mobile, 'Mobile')}
        </div>
      </div>

      <!-- Fixes to Make Section -->
      ${renderFixesToMake(desktop, mobile)}

      ${createNextStepsSection('full')}
    `;

    resultsContent.innerHTML = html;
    showPdfExportButton();
    animateScoreRings();
    scrollToResults();
  }

  // NOTE: renderFixesToMake() is now defined in performance-fixes-renderer.js
  // The new implementation provides tabbed accordions with detailed code examples
  // and step-by-step fix guides (Option 3 from design proposals)

  function renderLighthouseResults(data, device) {
    // Scores are in data.lighthouse, metrics in data.coreWebVitals
    const lighthouse = data.lighthouse || {};
    const scores = {
      performance: lighthouse.performance || data.performanceScore || 0,
      accessibility: lighthouse.accessibility || 0,
      bestPractices: lighthouse.bestPractices || 0,
      seo: lighthouse.seo || 0
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
    const desktop = data.desktop || {};
    const mobile = data.mobile || {};
    // API returns 'score' not 'overallScore'
    const overallScore = data.score || data.overallScore || 0;
    const grade = data.grade || 'N/A';
    const url = urlInput.value;

    const html = `
      ${createReportHeader('cwv', url)}

      ${createScoreSection(
        'Core Web Vitals Score',
        overallScore,
        grade,
        'Google uses CWV as a ranking factor',
        overallScore >= 80 ? '✓ Passing Google CWV' : overallScore >= 50 ? '⚠ Needs Improvement' : '✗ Failing Google CWV'
      )}

      <!-- Device Comparison -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
        <!-- Desktop CWV -->
        <div class="device-panel" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1.5rem;">
          <h3 style="text-align: center; margin-bottom: 1rem;">🖥️ Desktop <span style="font-size: 0.75rem; color: #888;">(30% weight)</span></h3>
          ${renderCWVMetrics(desktop)}
        </div>

        <!-- Mobile CWV -->
        <div class="device-panel" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1.5rem;">
          <h3 style="text-align: center; margin-bottom: 1rem;">📱 Mobile <span style="font-size: 0.75rem; color: #888;">(70% weight)</span></h3>
          ${renderCWVMetrics(mobile)}
        </div>
      </div>

      ${overallScore >= 80
        ? createInfoBox('success', '🏆 Google Ranking Impact', '<strong>Your Core Web Vitals are passing!</strong> Google uses CWV as a ranking factor - you\'re in good standing for search visibility.')
        : overallScore >= 50
        ? createInfoBox('warning', '⚠️ Google Ranking Impact', '<strong>Your Core Web Vitals need improvement.</strong> This may negatively impact your Google search rankings. Focus on the metrics marked "Needs Work".')
        : createInfoBox('error', '🚨 Google Ranking Impact', '<strong>Your Core Web Vitals are failing.</strong> This is likely hurting your Google search rankings significantly. Immediate optimization recommended.')
      }

      ${createSectionHeader('Understanding Core Web Vitals', '📚')}
      <div style="display: grid; gap: 1rem; margin-bottom: 2rem;">
        <div style="background: rgba(59, 130, 246, 0.05); padding: 1rem; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <strong style="color: #3b82f6;">LCP (Largest Contentful Paint)</strong>
          <p style="color: #aaa; margin: 0.5rem 0 0 0; font-size: 0.9rem;">Measures loading performance. Should occur within <strong style="color: #22c55e;">2.5 seconds</strong> of page start loading.</p>
        </div>
        <div style="background: rgba(16, 185, 129, 0.05); padding: 1rem; border-radius: 8px; border-left: 4px solid #10b981;">
          <strong style="color: #10b981;">INP (Interaction to Next Paint)</strong>
          <p style="color: #aaa; margin: 0.5rem 0 0 0; font-size: 0.9rem;">Measures interactivity. Should be less than <strong style="color: #22c55e;">200 milliseconds</strong>.</p>
        </div>
        <div style="background: rgba(245, 158, 11, 0.05); padding: 1rem; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <strong style="color: #f59e0b;">CLS (Cumulative Layout Shift)</strong>
          <p style="color: #aaa; margin: 0.5rem 0 0 0; font-size: 0.9rem;">Measures visual stability. Should be less than <strong style="color: #22c55e;">0.1</strong>.</p>
        </div>
      </div>

      ${createNextStepsSection('cwv')}
    `;

    resultsContent.innerHTML = html;
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
    const color = getScoreColor(score);
    const radius = (size - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
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
          <div style="font-size: ${size * 0.3}px; font-weight: bold; color: ${color}; text-shadow: 0 0 10px ${glowColor};">${displayValue || score}</div>
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

  function getScoreClass(score) {
    if (score >= 80) return 'score-good';
    if (score >= 50) return 'score-average';
    return 'score-poor';
  }

  function getScoreColor(score) {
    if (score >= 80) return '#22c55e';  // Vibrant green
    if (score >= 50) return '#f59e0b';  // Orange
    return '#ef4444';                    // Red
  }

  function getScoreBackground(score) {
    if (score >= 80) return 'rgba(34, 197, 94, 0.25)';
    if (score >= 50) return 'rgba(245, 158, 11, 0.25)';
    return 'rgba(239, 68, 68, 0.25)';
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
    buttonText.textContent = 'Run scan';
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
      <div style="text-align: center; margin-bottom: 3rem; padding: 2rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;">
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
      poor: '#ef4444'
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
        console.log(`Found valid payment for ${reportType}:`, url);
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

      console.log(`Payment verified for ${reportType}:`, url);
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

          <!-- Price -->
          <div style="text-align: center; margin-bottom: 2rem;">
            <div style="font-size: 3rem; font-weight: bold; color: ${info.color}; margin-bottom: 0.25rem;">$5</div>
            <div style="color: #888; font-size: 0.9rem;">One-time payment • No subscription • Instant access</div>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 1rem;">
            <button id="cancelPaymentBtn" style="
              flex: 1;
              background: rgba(255, 255, 255, 0.1);
              border: 1px solid rgba(255, 255, 255, 0.2);
              color: #fff;
              padding: 0.875rem 1.5rem;
              border-radius: 8px;
              cursor: pointer;
              font-weight: 600;
              font-size: 1rem;
              transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255, 255, 255, 0.15)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'">
              Cancel
            </button>
            <button id="proceedPaymentBtn" style="
              flex: 2;
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
              Get Report for $5
            </button>
          </div>

          <!-- Trust badges -->
          <div style="text-align: center; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="color: #666; font-size: 0.8rem; margin-bottom: 0.5rem;">
              🔒 Secure payment powered by Stripe
            </div>
            <div style="color: #555; font-size: 0.75rem;">
              No account needed • Instant access • 24-hour validity
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
      buttonText.textContent = 'Run scan';
      if (loader) loader.complete();
    });

    document.getElementById('proceedPaymentBtn').addEventListener('click', () => {
      createPaymentSession(reportType, url);
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
      const response = await fetch('/api/payment/create-report-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          url
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create payment session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;

    } catch (error) {
      console.error('Payment error:', error);
      proceedBtn.disabled = false;
      proceedBtn.textContent = 'Get Report for $5';
      alert(`Payment error: ${error.message}`);
    }
  }
});
