/**
 * Performance Analyzer Frontend
 * Handles performance scan submissions and results display
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'performance';

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
      showError('Please enter a URL');
      return;
    }

    // MEMORY CLEANUP: Clear previous scan data
    cleanupPreviousPerfData(resultsContainer);

    // Disable button during scan
    submitButton.disabled = true;
    submitButton.textContent = 'ANALYZING...';
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
        Comprehensive analysis in progress...
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
        label: 'Running Lighthouse analysis',
        detail: 'Testing desktop and mobile performance...'
      },
      {
        label: 'Analyzing resource loading',
        detail: 'Tracking scripts, styles, images, fonts...'
      },
      {
        label: 'Testing network efficiency',
        detail: 'Measuring request counts and bandwidth...'
      },
      {
        label: 'Checking caching strategy',
        detail: 'Evaluating cache headers and optimization...'
      },
      {
        label: 'Generating report',
        detail: 'Compiling performance insights...'
      }
    ];

    loader.start(analysisSteps, '[PERFORMANCE ANALYZER]', 60);
    
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

      const response = await fetch('/api/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, scanStartedAt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Performance analysis failed');
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
        }, 1000);
      } else {
        loader.showError(data.message || data.error || 'Performance analysis failed');
      }

    } catch (error) {
      console.error('Performance scan error:', error);
      loader.showError(error.message || 'Failed to analyze website. Please try again.');
    } finally {
      // Re-enable button
      submitButton.disabled = false;
      submitButton.textContent = 'ANALYZE PERFORMANCE';
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
  
  // Clear container
  container.innerHTML = '';
  container.style.display = 'block';
  
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
    <h2>Performance Analysis Results</h2>
    <p>>> url: ${results.url}</p>
    <p>>> timestamp: ${new Date(results.timestamp).toLocaleString()}</p>
    <p>>> analysis_duration: ${results.analysisDuration || 'N/A'}</p>
    ${isCrossBrowser ? '<p>>> devices_tested: 2</p>' : ''}
    
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
                color: #ffffff;
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
            <div style="font-size: 0.85rem; color: #808080; margin-top: 0.25rem;">Load Speed</div>
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
                  color: #ffffff;
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
              <div style="font-size: 0.85rem; color: #00ff41; margin-top: 0.25rem; font-weight: 600;">Site Health</div>
            </div>
          ` : ''}
        </div>

        <!-- Right: Performance Score Details -->
        <div style="padding: 0 1rem; flex: 1;">
          <h3 style="color: #00ff41; margin: 0 0 1rem 0; font-size: 1.3rem;">P Performance Score</h3>
          
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
              <div style="font-size: 0.75rem; color: #808080; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                Load Time
              </div>
              <div style="font-size: 1.3rem; font-weight: bold; color: #00ff41;">
                ${results.loadTime || 'N/A'}
              </div>
            </div>
            
            <div style="
              background: rgba(0, 255, 65, 0.05);
              border: 1px solid rgba(0, 255, 65, 0.2);
              border-radius: 6px;
              padding: 0.75rem;
              text-align: center;
            ">
              <div style="font-size: 0.75rem; color: #808080; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                Page Size
              </div>
              <div style="font-size: 1.3rem; font-weight: bold; color: #00ff41;">
                ${results.pageSize || 'N/A'}
              </div>
            </div>
            
            <div style="
              background: rgba(0, 255, 65, 0.05);
              border: 1px solid rgba(0, 255, 65, 0.2);
              border-radius: 6px;
              padding: 0.75rem;
              text-align: center;
            ">
              <div style="font-size: 0.75rem; color: #808080; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                Requests
              </div>
              <div style="font-size: 1.3rem; font-weight: bold; color: #00ff41;">
                ${results.totalRequests || 'N/A'}
              </div>
            </div>
          </div>

          <!-- Core Metrics -->
          <div style="
            background: rgba(0, 0, 0, 0.3);
            border-radius: 6px;
            padding: 1rem;
            margin-bottom: 0.75rem;
          ">
            <div style="font-size: 0.85rem; font-weight: bold; color: #00ff41; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">
              Core Metrics
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.85rem;">
              ${results.coreWebVitals ? `
                <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                  <span style="color: #a0a0a0;">LCP:</span>
                  <span style="color: ${results.coreWebVitals.lcp && parseInt(results.coreWebVitals.lcp) < 2500 ? '#00ff41' : '#ff8c00'}; font-weight: 600;">
                    ${results.coreWebVitals.lcp || 'N/A'}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                  <span style="color: #a0a0a0;">FID:</span>
                  <span style="color: ${results.coreWebVitals.fid && parseInt(results.coreWebVitals.fid) < 100 ? '#00ff41' : '#ff8c00'}; font-weight: 600;">
                    ${results.coreWebVitals.fid || 'N/A'}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                  <span style="color: #a0a0a0;">CLS:</span>
                  <span style="color: ${results.coreWebVitals.cls && parseFloat(results.coreWebVitals.cls) < 0.1 ? '#00ff41' : '#ff8c00'}; font-weight: 600;">
                    ${results.coreWebVitals.cls || 'N/A'}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                  <span style="color: #a0a0a0;">TTI:</span>
                  <span style="color: ${results.coreWebVitals.tti && parseInt(results.coreWebVitals.tti) < 3800 ? '#00ff41' : '#ff8c00'}; font-weight: 600;">
                    ${results.coreWebVitals.tti || 'N/A'}
                  </span>
                </div>
              ` : '<div style="color: #808080; grid-column: 1 / -1; text-align: center;">Metrics not available</div>'}
            </div>
          </div>

          <!-- Note -->
          <div style="
            background: rgba(255, 152, 0, 0.1);
            border-left: 4px solid #ff9800;
            padding: 0.6rem 0.75rem;
            border-radius: 4px;
          ">
            <strong style="color: #ff9800; font-size: 0.85rem;">ⓘ Note:</strong>
            <span style="color: #d0d0d0; font-size: 0.8rem;">
              100/100 performance ≠ perfect website. Check Site Health Score for overall quality.
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
          <h4 style="color: #00ff41; margin: 0 0 1rem 0; font-size: 1.1rem;">◉ Multi-Dimensional Analysis</h4>
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
                performance: 'Performance',
                resources: 'Resources',
                caching: 'Caching',
                network: 'Network',
                webVitals: 'Web Vitals'
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
      <h2>Desktop vs Mobile Comparison</h2>
      <div style="padding-left: 1rem;">
        <p style="color: #00ff41; margin-bottom: 1.5rem;">>> Comprehensive analysis across both platforms</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
          <!-- Desktop Column -->
          <div style="
            background: linear-gradient(135deg, rgba(0,204,255,0.1), rgba(0,102,204,0.05));
            border: 2px solid #00ccff;
            border-radius: 8px;
            padding: 1.5rem;
          ">
            <div style="text-align: center; margin-bottom: 1rem;">
              <div style="font-size: 1.5rem; color: #00ccff; margin-bottom: 0.5rem;">D DESKTOP</div>
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
                  color: #ffffff;
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
              <h4 style="color: #00ccff; margin: 0 0 0.75rem 0; font-size: 1rem;">Lighthouse Scores</h4>
              <div style="display: grid; gap: 0.5rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">P Performance</span>
                  <span style="color: ${getPerformanceColor(results.browsers.desktop.performanceScore)}; font-weight: bold;">
                    ${results.browsers.desktop.performanceScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">A Accessibility</span>
                  <span style="color: ${getPerformanceColor(results.browsers.desktop.accessibilityScore)}; font-weight: bold;">
                    ${results.browsers.desktop.accessibilityScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">B Best Practices</span>
                  <span style="color: ${getPerformanceColor(results.browsers.desktop.bestPracticesScore)}; font-weight: bold;">
                    ${results.browsers.desktop.bestPracticesScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">S SEO</span>
                  <span style="color: ${getPerformanceColor(results.browsers.desktop.seoScore)}; font-weight: bold;">
                    ${results.browsers.desktop.seoScore}
                  </span>
                </div>
              </div>
              
              <h4 style="color: #00ccff; margin: 1rem 0 0.75rem 0; font-size: 1rem;">Core Web Vitals</h4>
              <div style="display: grid; gap: 0.5rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">LCP</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.desktop.metrics?.coreWebVitals?.lcp || 'N/A'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">FID</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.desktop.metrics?.coreWebVitals?.fid || 'N/A'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">CLS</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.desktop.metrics?.coreWebVitals?.cls || 'N/A'}</span>
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
              <div style="font-size: 1.5rem; color: #ff6600; margin-bottom: 0.5rem;">M MOBILE</div>
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
                  color: #ffffff;
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
              <h4 style="color: #ff6600; margin: 0 0 0.75rem 0; font-size: 1rem;">Lighthouse Scores</h4>
              <div style="display: grid; gap: 0.5rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">P Performance</span>
                  <span style="color: ${getPerformanceColor(results.browsers.mobile.performanceScore)}; font-weight: bold;">
                    ${results.browsers.mobile.performanceScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">A Accessibility</span>
                  <span style="color: ${getPerformanceColor(results.browsers.mobile.accessibilityScore)}; font-weight: bold;">
                    ${results.browsers.mobile.accessibilityScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">B Best Practices</span>
                  <span style="color: ${getPerformanceColor(results.browsers.mobile.bestPracticesScore)}; font-weight: bold;">
                    ${results.browsers.mobile.bestPracticesScore}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">S SEO</span>
                  <span style="color: ${getPerformanceColor(results.browsers.mobile.seoScore)}; font-weight: bold;">
                    ${results.browsers.mobile.seoScore}
                  </span>
                </div>
              </div>
              
              <h4 style="color: #ff6600; margin: 1rem 0 0.75rem 0; font-size: 1rem;">Core Web Vitals</h4>
              <div style="display: grid; gap: 0.5rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">LCP</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.mobile.metrics?.coreWebVitals?.lcp || 'N/A'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">FID</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.mobile.metrics?.coreWebVitals?.fid || 'N/A'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #c0c0c0;">CLS</span>
                  <span style="color: #00ff41; font-weight: bold;">${results.browsers.mobile.metrics?.coreWebVitals?.cls || 'N/A'}</span>
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
            ~ PERFORMANCE GAP DETECTED
          </div>
          <p style="color: #c0c0c0; margin: 0;">
            There is a ${Math.abs(results.browsers.desktop.performanceScore - results.browsers.mobile.performanceScore)}-point difference between desktop (${results.browsers.desktop.performanceScore}) and mobile (${results.browsers.mobile.performanceScore}) performance. 
            ${results.browsers.mobile.performanceScore < results.browsers.desktop.performanceScore ? 
              'Mobile users may experience significantly slower load times.' : 
              'This is unusual - mobile typically performs worse than desktop.'}
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
            ✓ CONSISTENT PERFORMANCE
          </div>
          <p style="color: #c0c0c0; margin: 0;">
            Desktop and mobile performance scores are within 10 points of each other, indicating consistent user experience across platforms.
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
  createAccordionSection(container, 'core-web-vitals', 'Core Web Vitals', () => renderCoreWebVitalsContent(results.desktop?.coreWebVitals, results.mobile?.coreWebVitals), avgVitalsScore);
  createAccordionSection(container, 'resource-analysis', 'Resource Analysis', () => renderResourceAnalysisContent(results.resources), results.resources?.score || 0);
  createAccordionSection(container, 'network-performance', 'Network Performance', () => renderNetworkPerformanceContent(results.network), results.network?.score || 0);
  createAccordionSection(container, 'caching-optimization', 'Caching & Optimization', () => renderCachingOptimizationContent(results.caching), results.caching?.score || 0);
  createAccordionSection(container, 'report-recommendations', 'Report and Recommendations', () => renderRecommendationsContent(results.recommendations), null, { isPro: true }); // Pro gated

  // Pro Report Block
  if (window.ProReportBlock && window.ProReportBlock.render) {
    const proBlockHtml = window.ProReportBlock.render({
      context: 'performance-analysis',
      features: ['pdf', 'csv', 'share'],
      title: 'Unlock Report',
      subtitle: 'PDF export, share link, export data, and fix packs for this scan.'
    });
    container.insertAdjacentHTML('beforeend', proBlockHtml);
  }
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
    return '<p style="color: #ff6600;">>>> Core Web Vitals data not available</p>';
  }

  // Helper to get metric status
  const getMetricStatus = (value, type) => {
    if (!value || value === 'N/A') return { color: '#808080', status: 'N/A' };
    
    let numValue;
    if (type === 'LCP' || type === 'FID' || type === 'TTFB' || type === 'FCP') {
      numValue = parseFloat(value.replace(/[ms]/g, '')) || 0;
    } else {
      numValue = parseFloat(value) || 0;
    }
    
    switch(type) {
      case 'LCP':
        if (numValue <= 2500) return { color: '#00ff41', status: 'Good' };
        if (numValue <= 4000) return { color: '#ffa500', status: 'Needs Improvement' };
        return { color: '#ff4444', status: 'Poor' };
      case 'FID':
        if (numValue <= 100) return { color: '#00ff41', status: 'Good' };
        if (numValue <= 300) return { color: '#ffa500', status: 'Needs Improvement' };
        return { color: '#ff4444', status: 'Poor' };
      case 'CLS':
        if (numValue <= 0.1) return { color: '#00ff41', status: 'Good' };
        if (numValue <= 0.25) return { color: '#ffa500', status: 'Needs Improvement' };
        return { color: '#ff4444', status: 'Poor' };
      case 'TTFB':
        if (numValue < 600) return { color: '#00ff41', status: 'Info' };
        return { color: '#ffa500', status: 'Info' };
      case 'FCP':
        if (numValue < 1800) return { color: '#00ff41', status: 'Info' };
        return { color: '#ffa500', status: 'Info' };
      default:
        return { color: '#808080', status: 'Info' };
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
        <td style="color: #808080;">${description}</td>
        <td style="text-align: center;">
          <span style="color: ${desktopStatus.color}; font-weight: bold;">${desktopValue || 'N/A'}</span>
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
          <span style="color: ${mobileStatus.color}; font-weight: bold;">${mobileValue || 'N/A'}</span>
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
      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> What are Core Web Vitals?</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        Core Web Vitals are Google's metrics for measuring user experience. They directly impact SEO rankings and user satisfaction.
      </p>
      
      <table class="seo-table" style="width: 100%; margin-bottom: 1.5rem;">
        <thead>
          <tr>
            <th style="text-align: left; width: 25%;">Metric</th>
            <th style="text-align: left; width: 25%;">Description</th>
            <th colspan="2" style="text-align: center; background: rgba(0,204,255,0.1); border-left: 2px solid #00ccff;">
              <span style="color: #00ccff;">D Desktop</span>
            </th>
            <th colspan="2" style="text-align: center; background: rgba(255,102,0,0.1); border-left: 2px solid #ff6600;">
              <span style="color: #ff6600;">M Mobile</span>
            </th>
          </tr>
          <tr style="font-size: 0.85rem;">
            <th style="border-top: 1px solid #333;"></th>
            <th style="border-top: 1px solid #333;"></th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(0,204,255,0.05);">Value</th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(0,204,255,0.05);">Status</th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(255,102,0,0.05);">Value</th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(255,102,0,0.05);">Status</th>
          </tr>
        </thead>
        <tbody>
          ${renderMetricRow(
            'L',
            'Largest Contentful Paint (LCP)',
            'Measures loading performance. Good LCP is ≤ 2.5s',
            desktopVitals?.lcp,
            mobileVitals?.lcp,
            'LCP'
          )}
          
          ${renderMetricRow(
            'P',
            'First Input Delay (FID)',
            'Measures interactivity. Good FID is ≤ 100ms',
            desktopVitals?.fid,
            mobileVitals?.fid,
            'FID'
          )}
          
          ${renderMetricRow(
            'T',
            'Cumulative Layout Shift (CLS)',
            'Measures visual stability. Good CLS is ≤ 0.1',
            desktopVitals?.cls || '0.000',
            mobileVitals?.cls || '0.000',
            'CLS'
          )}
          
          ${desktopVitals?.ttfb || mobileVitals?.ttfb ? renderMetricRow(
            '⧗',
            'Time to First Byte (TTFB)',
            'Server response time. Good TTFB is < 600ms',
            desktopVitals?.ttfb || 'N/A',
            mobileVitals?.ttfb || 'N/A',
            'TTFB'
          ) : ''}
          
          ${desktopVitals?.fcp || mobileVitals?.fcp ? renderMetricRow(
            'Y',
            'First Contentful Paint (FCP)',
            'First text/image render. Good FCP is < 1.8s',
            desktopVitals?.fcp || 'N/A',
            mobileVitals?.fcp || 'N/A',
            'FCP'
          ) : ''}
        </tbody>
      </table>
      
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px;">
        <h4 style="color: #00ff41; margin: 0 0 0.5rem 0; font-size: 1rem;">📚 Learn More</h4>
        <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
          Core Web Vitals are part of Google's Page Experience signals used for ranking. 
          Improving these metrics can lead to better search rankings and user engagement.
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
    return '<p style="color: #ff6600;">>>> Resource analysis data not available</p>';
  }

  // Calculate total size and percentages
  const totalSize = (resources.javascript?.size || 0) + 
                    (resources.css?.size || 0) + 
                    (resources.images?.size || 0) + 
                    (resources.fonts?.size || 0) + 
                    (resources.other?.size || 0);

  const resourceTypes = [
    { name: 'JavaScript', data: resources.javascript, color: '#f7df1e', icon: '📜' },
    { name: 'CSS', data: resources.css, color: '#264de4', icon: 'Y' },
    { name: 'Images', data: resources.images, color: '#00ccff', icon: 'I' },
    { name: 'Fonts', data: resources.fonts, color: '#ff6600', icon: '🔤' },
    { name: 'Other', data: resources.other, color: '#808080', icon: 'R' }
  ].filter(r => r.data && r.data.count > 0);

  // Calculate percentages
  resourceTypes.forEach(r => {
    r.percentage = totalSize > 0 ? ((r.data.size / totalSize) * 100).toFixed(1) : 0;
  });

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>Platform-Agnostic Metrics:</strong> Resource data is collected during page analysis and applies universally to both desktop and mobile experiences.
        </p>
      </div>
      
      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> Resource Breakdown</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        Total page weight: <strong style="color: #00ff41;">${formatBytes(totalSize)}</strong> across <strong style="color: #00ff41;">${resources.javascript?.count + resources.css?.count + resources.images?.count + resources.fonts?.count + resources.other?.count || 0}</strong> resources
      </p>
      
      <!-- Resource Size Chart -->
      <div style="margin-bottom: 2rem;">
        <h4 style="color: #00ff41; margin: 0 0 1rem 0; font-size: 1rem;">C Size Distribution</h4>
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; height: 40px; display: flex; margin-bottom: 1rem;">
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
              <span style="color: #c0c0c0; font-size: 0.9rem;">
                ${r.icon} ${r.name}: <strong style="color: ${r.color};">${r.data.sizeFormatted}</strong> (${r.percentage}%)
              </span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Resource Details Table -->
      <h4 style="color: #00ff41; margin: 1.5rem 0 1rem 0; font-size: 1rem;">📋 Detailed Breakdown</h4>
      <table class="seo-table" style="width: 100%;">
        <thead>
          <tr>
            <th style="text-align: left; width: 25%;">Resource Type</th>
            <th style="text-align: center; width: 15%;">Count</th>
            <th style="text-align: center; width: 20%;">Total Size</th>
            <th style="text-align: center; width: 20%;">Avg Size</th>
            <th style="text-align: center; width: 20%;">% of Total</th>
          </tr>
        </thead>
        <tbody>
          ${resourceTypes.map(r => `
            <tr>
              <td>
                <span style="color: ${r.color};">${r.icon} ${r.name}</span>
              </td>
              <td style="text-align: center; color: #c0c0c0;">
                ${r.data.count}
              </td>
              <td style="text-align: center;">
                <strong style="color: ${r.color};">${r.data.sizeFormatted}</strong>
              </td>
              <td style="text-align: center; color: #c0c0c0;">
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
      text: `JavaScript bundle is large (${resources.javascript.sizeFormatted}). Consider code splitting and lazy loading.`
    });
  }
  
  if (resources.images?.size > 1000000) {
    recommendations.push({
      type: 'warning',
      text: `Images are ${resources.images.sizeFormatted}. Use WebP format and implement lazy loading.`
    });
  }
  
  if (resources.css?.size > 100000) {
    recommendations.push({
      type: 'info',
      text: `CSS files total ${resources.css.sizeFormatted}. Consider removing unused styles and minification.`
    });
  }
  
  if (recommendations.length === 0) {
    return `
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px; border-left: 4px solid #00ff41;">
        <span style="color: #00ff41;">✓ Resource sizes are well optimized!</span>
      </div>
    `;
  }
  
  return `
    <div style="margin-top: 1.5rem;">
      <h4 style="color: #ffa500; margin: 0 0 0.75rem 0; font-size: 1rem;">~ Optimization Opportunities</h4>
      ${recommendations.map(rec => `
        <div style="
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: rgba(255,165,0,0.05);
          border-left: 3px solid ${rec.type === 'warning' ? '#ffa500' : '#00ccff'};
          border-radius: 4px;
        ">
          <span style="color: #c0c0c0; font-size: 0.9rem;">${rec.text}</span>
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
    return '<p style="color: #ff6600;">>>> Network performance data not available</p>';
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
    if (ms < 200) return { color: '#00ff41', label: 'Excellent' };
    if (ms < 400) return { color: '#00ff41', label: 'Good' };
    if (ms < 600) return { color: '#ffa500', label: 'Fair' };
    return { color: '#ff4444', label: 'Poor' };
  };

  const ttfbStatus = getTTFBStatus(ttfb);

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>Platform-Agnostic Metrics:</strong> Network timing data reflects server infrastructure and applies to all devices accessing the site.
        </p>
      </div>
      
      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> Network Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        Network performance breakdown showing connection establishment, server response, and content delivery timing.
      </p>
      
      <!-- Network Timing Waterfall -->
      <div style="margin-bottom: 2rem;">
        <h4 style="color: #00ff41; margin: 0 0 1rem 0; font-size: 1rem;">🌊 Connection Timeline</h4>
        
        <div style="background: rgba(0,0,0,0.3); padding: 1.5rem; border-radius: 8px;">
          ${dns > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="color: #00ccff; font-size: 0.95rem; font-weight: 600;">S DNS Lookup</span>
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
              <span style="color: #00ff41; font-size: 0.95rem; font-weight: 600;">🔌 TCP Connection</span>
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
              <span style="color: #ffa500; font-size: 0.95rem; font-weight: 600;">◈ SSL Handshake</span>
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
              <span style="color: ${ttfbStatus.color}; font-size: 0.95rem; font-weight: 600;">⧗ Time to First Byte</span>
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
      <h4 style="color: #00ff41; margin: 1.5rem 0 1rem 0; font-size: 1rem;">C Network Metrics</h4>
      <table class="seo-table" style="width: 100%;">
        <thead>
          <tr>
            <th style="text-align: left; width: 40%;">Metric</th>
            <th style="text-align: left; width: 35%;">Description</th>
            <th style="text-align: center; width: 25%;">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span style="color: #00ccff;">S DNS Lookup</span></td>
            <td style="color: #808080;">Domain name resolution time</td>
            <td style="text-align: center;"><strong style="color: #00ccff;">${network.dns || 'N/A'}</strong></td>
          </tr>
          <tr>
            <td><span style="color: #00ff41;">🔌 TCP Connection</span></td>
            <td style="color: #808080;">Time to establish connection</td>
            <td style="text-align: center;"><strong style="color: #00ff41;">${network.connectionTime || 'N/A'}</strong></td>
          </tr>
          ${ssl > 0 ? `
          <tr>
            <td><span style="color: #ffa500;">◈ SSL Handshake</span></td>
            <td style="color: #808080;">Secure connection setup time</td>
            <td style="text-align: center;"><strong style="color: #ffa500;">${network.ssl}</strong></td>
          </tr>
          ` : ''}
          <tr>
            <td><span style="color: ${ttfbStatus.color};">⧗ Time to First Byte</span></td>
            <td style="color: #808080;">Server response time</td>
            <td style="text-align: center;"><strong style="color: ${ttfbStatus.color};">${network.ttfb}</strong></td>
          </tr>
          <tr>
            <td><span style="color: #00ff41;">P DOM Interactive</span></td>
            <td style="color: #808080;">Time until DOM is ready</td>
            <td style="text-align: center;"><strong style="color: #00ff41;">${network.domInteractive || 'N/A'}</strong></td>
          </tr>
          <tr>
            <td><span style="color: #00ff41;">D DOM Content Loaded</span></td>
            <td style="color: #808080;">Initial HTML parsed and ready</td>
            <td style="text-align: center;"><strong style="color: #00ff41;">${network.domContentLoaded || 'N/A'}</strong></td>
          </tr>
          <tr>
            <td><span style="color: #00ff41;">W Total Requests</span></td>
            <td style="color: #808080;">Number of HTTP requests</td>
            <td style="text-align: center;"><strong style="color: #00ff41;">${network.requests || 'N/A'}</strong></td>
          </tr>
        </tbody>
      </table>
      
      <!-- Network Performance Insights -->
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(0,204,255,0.05); border-radius: 4px; border-left: 4px solid #00ccff;">
        <h4 style="color: #00ccff; margin: 0 0 0.5rem 0; font-size: 1rem;">ⓘ Network Insights</h4>
        <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
          ${ttfb < 200 ? 
            '✓ Excellent server response time! Your backend is highly optimized.' : 
            ttfb < 600 ? 
            '~ Server response time is acceptable but could be improved with better caching or a CDN.' :
            'H Slow server response time. Consider upgrading hosting, implementing Redis caching, or using a CDN.'}
        </p>
        ${network.requests > 50 ? `
        <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0.5rem 0 0 0;">
          ~ High number of requests (${network.requests}). Consider bundling assets and reducing third-party scripts.
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
    return '<p style="color: #ff6600;">>>> Caching optimization data not available</p>';
  }

  const cacheRate = parseFloat(caching.cacheHitRateNum) || 0;
  const getCacheStatus = (rate) => {
    if (rate >= 80) return { color: '#00ff41', label: 'Excellent', icon: '✓' };
    if (rate >= 60) return { color: '#00ff41', label: 'Good', icon: '+' };
    if (rate >= 40) return { color: '#ffa500', label: 'Fair', icon: '~' };
    return { color: '#ff4444', label: 'Poor', icon: '✗' };
  };

  const status = getCacheStatus(cacheRate);

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>Platform-Agnostic Metrics:</strong> Caching policies are defined by HTTP headers and benefit all users equally regardless of device.
        </p>
      </div>
      
      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> Caching Strategy</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        Cache effectiveness determines how many resources can be loaded from browser cache on repeat visits.
      </p>
      
      <!-- Cache Hit Rate Visual -->
      <div style="margin-bottom: 2rem;">
        <h4 style="color: #00ff41; margin: 0 0 1rem 0; font-size: 1rem;">U Cache Hit Rate</h4>
        
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
            <div style="color: #808080; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">
              Cacheable
            </div>
          </div>
          
          <div style="background: rgba(255,68,68,0.1); padding: 1rem; border-radius: 8px; text-align: center; border: 2px solid rgba(255,68,68,0.3);">
            <div style="font-size: 1.8rem; color: #ff4444; font-weight: bold; margin-bottom: 0.25rem;">
              ${caching.notCached || 0}
            </div>
            <div style="color: #808080; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">
              Not Cached
            </div>
          </div>
          
          <div style="background: rgba(0,204,255,0.1); padding: 1rem; border-radius: 8px; text-align: center; border: 2px solid rgba(0,204,255,0.3);">
            <div style="font-size: 1.8rem; color: #00ccff; font-weight: bold; margin-bottom: 0.25rem;">
              ${caching.total || 0}
            </div>
            <div style="color: #808080; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">
              Total Resources
            </div>
          </div>
        </div>
      </div>
      
      <!-- Cache Strategies Table -->
      ${caching.strategies && Object.keys(caching.strategies).length > 0 ? `
      <h4 style="color: #00ff41; margin: 1.5rem 0 1rem 0; font-size: 1rem;">🔧 Cache Strategies Detected</h4>
      <table class="seo-table" style="width: 100%;">
        <thead>
          <tr>
            <th style="text-align: left; width: 50%;">Cache Strategy</th>
            <th style="text-align: center; width: 25%;">Resources</th>
            <th style="text-align: center; width: 25%;">Percentage</th>
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
                <td style="text-align: center; color: #c0c0c0;">
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
        <h4 style="color: ${status.color}; margin: 0 0 0.5rem 0; font-size: 1rem;">${status.icon} Cache Performance</h4>
        ${cacheRate >= 80 ? `
          <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
            Excellent caching strategy! ${cacheRate}% of resources are cacheable, which significantly improves repeat visit performance.
          </p>
        ` : cacheRate >= 60 ? `
          <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
            Good caching implementation with ${cacheRate}% cache hit rate. Consider increasing cache TTL for static assets to reach 80%+ cacheability.
          </p>
        ` : cacheRate >= 40 ? `
          <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
            ~ Fair caching with ${cacheRate}% hit rate. Implement proper Cache-Control headers for static assets (CSS, JS, images, fonts) with long TTL values (1 year for versioned files).
          </p>
          <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0.5rem 0 0 0;">
            ⓘ Recommended: <code style="background: rgba(0,0,0,0.3); padding: 0.25rem 0.5rem; border-radius: 3px; color: #00ff41;">Cache-Control: public, max-age=31536000, immutable</code>
          </p>
        ` : `
          <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
            H Poor caching performance (${cacheRate}%). Most resources are not cacheable, forcing full re-downloads on every visit. This significantly impacts repeat visitor performance.
          </p>
          <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0.5rem 0 0 0;">
            ⓘ Urgent: Add <code style="background: rgba(0,0,0,0.3); padding: 0.25rem 0.5rem; border-radius: 3px; color: #ff4444;">Cache-Control</code> headers to static assets with appropriate TTL values.
          </p>
        `}
      </div>
      
      <!-- Best Practices -->
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,204,255,0.05); border-radius: 4px;">
        <h4 style="color: #00ccff; margin: 0 0 0.5rem 0; font-size: 1rem;">📚 Caching Best Practices</h4>
        <ul style="color: #c0c0c0; font-size: 0.9rem; margin: 0.5rem 0; padding-left: 1.5rem;">
          <li style="margin-bottom: 0.5rem;">Use versioning/hashing for filenames and set long cache times (1 year)</li>
          <li style="margin-bottom: 0.5rem;">Add <code style="background: rgba(0,0,0,0.3); padding: 0.25rem 0.5rem; border-radius: 3px;">immutable</code> directive for fingerprinted assets</li>
          <li style="margin-bottom: 0.5rem;">Implement ETags for dynamic content validation</li>
          <li style="margin-bottom: 0.5rem;">Use CDN for static asset distribution and edge caching</li>
          <li>Set appropriate cache headers: <code style="background: rgba(0,0,0,0.3); padding: 0.25rem 0.5rem; border-radius: 3px;">public</code> for static, <code style="background: rgba(0,0,0,0.3); padding: 0.25rem 0.5rem; border-radius: 3px;">private</code> for user-specific</li>
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
      <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">⚡</span> Excellent Performance!
        </h3>
        <p style="color: #86efac; margin: 0;">No critical optimization recommendations. Your site is performing well!</p>
      </div>
    `;
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortedRecs = [...recommendations].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  let html = `
    <div class="perf-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">⚡</span> Performance Fixes
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${recommendations.length} improvements found)</span>
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
      <div class="perf-fix-header" onclick="togglePerfFixAccordion('${accordionId}')" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: #fff;">${rec.title}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">${rec.category || 'Performance'}</p>
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
          <span class="perf-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="perf-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
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
    <div class="perf-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="perf-fix-tab active" onclick="switchPerfFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 Summary</button>
      <button class="perf-fix-tab" onclick="switchPerfFixTab('${accordionId}', 'code')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 Code</button>
      <button class="perf-fix-tab" onclick="switchPerfFixTab('${accordionId}', 'guide')" style="
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
    <div class="perf-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: #ccc; line-height: 1.7; margin: 0 0 1rem 0;">
        ${rec.description || 'Optimize this area to improve performance.'}
      </p>
      ${rec.impact ? `
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ Expected Impact</div>
        <div style="color: #c0c0c0; font-size: 0.9rem;">${rec.impact}</div>
      </div>
      ` : ''}
    </div>

    <!-- Code Tab -->
    <div class="perf-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Current Issue -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
            <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ Current Issue</span>
            <button onclick="copyPerfCode('${accordionId}-problem')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${codeData.problem}</pre>
        </div>

        <!-- Fixed Code -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ Recommended Fix</span>
            <button onclick="copyPerfCode('${accordionId}-solution')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${codeData.solution}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="perf-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
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

// Copy code
function copyPerfCode(elementId) {
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

/**
 * Get code example for specific recommendation (problem + solution)
 */
function getPerfCodeExample(category, title) {
  const examples = {
    'Minimize JavaScript': {
      problem: `<!-- Current: Large unoptimized bundle -->
<script src="/bundle.js"></script>
<!-- 500KB+ JavaScript blocking render -->
<!-- ✗ No code splitting -->
<!-- ✗ No tree shaking -->
<!-- ✗ Vendor code bundled with app -->`,
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
  usedExports: true, // Tree shaking
  minimize: true
}

<!-- Result: Smaller, split bundles -->
<script src="/vendors.js" defer></script>
<script src="/app.js" defer></script>`
    },
    'Optimize Images': {
      problem: `<!-- Current: Unoptimized images -->
<img src="hero.png" alt="Hero">
<!-- ✗ PNG instead of WebP/AVIF -->
<!-- ✗ No srcset for responsive -->
<!-- ✗ No lazy loading -->
<!-- ✗ 2MB image file -->`,
      solution: `<!-- Optimized with modern formats -->
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="Hero" loading="lazy"
       srcset="hero-400.jpg 400w, hero-800.jpg 800w"
       sizes="(max-width: 600px) 400px, 800px">
</picture>
<!-- ✓ Modern formats (90% smaller) -->
<!-- ✓ Responsive images -->
<!-- ✓ Lazy loading -->`
    },
    'Reduce CSS Size': {
      problem: `<!-- Current: Large CSS file -->
<link rel="stylesheet" href="styles.css">
<!-- ✗ 200KB+ CSS file -->
<!-- ✗ Unused styles included -->
<!-- ✗ Render-blocking -->`,
      solution: `<!-- Critical CSS inline -->
<style>
  /* Above-the-fold styles only */
  .hero { ... }
  .nav { ... }
</style>
<!-- Non-critical CSS async -->
<link rel="preload" href="styles.css" as="style" 
      onload="this.onload=null;this.rel='stylesheet'">
<!-- ✓ Critical CSS inlined -->
<!-- ✓ Non-blocking load -->`
    },
    'Improve Caching Strategy': {
      problem: `<!-- Current: No caching headers -->
Cache-Control: no-cache
<!-- ✗ Assets re-downloaded every visit -->
<!-- ✗ Slow repeat visits -->`,
      solution: `# Nginx configuration
location ~* \\.(js|css|png|jpg|woff2)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location ~* \\.html$ {
  expires 1h;
  add_header Cache-Control "public, must-revalidate";
}
<!-- ✓ Static assets cached 1 year -->
<!-- ✓ HTML revalidated hourly -->`
    },
    'Enable Text Compression': {
      problem: `<!-- Current: No compression -->
Content-Encoding: identity
<!-- ✗ 500KB transferred -->
<!-- ✗ Slow on mobile networks -->`,
      solution: `# Enable Gzip in Nginx
gzip on;
gzip_vary on;
gzip_types text/plain text/css application/javascript 
           application/json;
gzip_min_length 1000;
gzip_comp_level 6;

# Result:
Content-Encoding: gzip
<!-- ✓ 100KB transferred (80% smaller) -->`
    }
  };
  
  const defaultExample = {
    problem: `<!-- Common performance issue -->
<!-- ✗ Unoptimized resource loading -->
<!-- ✗ Blocking render -->`,
    solution: `<!-- Optimized implementation -->
<!-- ✓ Async/defer loading -->
<!-- ✓ Proper caching -->
<!-- ✓ Compression enabled -->`
  };
  
  return examples[title] || defaultExample;
}

/**
 * Get action items for specific recommendation
 */
function getPerfActionItems(category, title) {
  const items = {
    'Minimize JavaScript': [
      'Enable code splitting in your bundler (webpack/vite)',
      'Use tree shaking to remove unused code',
      'Split vendor code from application code',
      'Add defer attribute to non-critical scripts'
    ],
    'Optimize Images': [
      'Convert images to WebP or AVIF format',
      'Implement responsive images with srcset',
      'Add loading="lazy" to below-fold images',
      'Use an image CDN for automatic optimization'
    ],
    'Reduce CSS Size': [
      'Extract and inline critical CSS',
      'Remove unused CSS with PurgeCSS',
      'Load non-critical CSS asynchronously'
    ],
    'Improve Caching Strategy': [
      'Set Cache-Control headers for static assets',
      'Use content-based hashing in filenames',
      'Configure 1-year cache for immutable assets'
    ],
    'Enable Text Compression': [
      'Enable Gzip or Brotli compression on server',
      'Verify compression with browser DevTools',
      'Set minimum size threshold (1KB)'
    ]
  };
  
  return items[title] || [
    'Analyze current implementation',
    'Apply recommended optimizations', 
    'Test and measure improvements'
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
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Improvement';
  return 'Poor';
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
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getLoadingHTML() {
  return `
    <div class="section">
      <h2>Analyzing...</h2>
      <div style="padding-left: 1rem;">
        <p>>> running comprehensive performance analysis...</p>
        <p>>> measuring core web vitals...</p>
        <p>>> analyzing resource loading...</p>
        <p>>> evaluating network performance...</p>
        <p>>> checking caching strategies...</p>
        <div class="loading-bar" style="margin-top: 1rem;"></div>
      </div>
    </div>
  `;
}

function showError(message) {
  const container = document.getElementById('perfResults');
  container.innerHTML = `
    <div class="section">
      <h2 style="color: #ff0000;">Error</h2>
      <div style="padding-left: 1rem;">
        <p>>> analysis_failed</p>
        <p style="color: #ff6600;">>> ${message}</p>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #ff6600; color: #000; border: none; cursor: pointer; font-family: 'Courier New', monospace; font-weight: bold;">RETRY</button>
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
      <h2>Cross-Browser Analysis</h2>
      <div style="padding-left: 1rem;">
        <p>>> running desktop analysis (Lighthouse)...</p>
        <p>>> running mobile analysis (Lighthouse)...</p>
        <p>>> comparing Core Web Vitals across devices...</p>
        <p>>> generating performance comparison...</p>
        <p style="color: #ff6600; font-style: italic;">>>> estimated time: 30-60 seconds</p>
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
    <h2>Cross-Browser Comparison Results</h2>
    <p>>> url: ${results.url}</p>
    <p>>> timestamp: ${new Date(results.timestamp).toLocaleString()}</p>
    <p>>> analysis_duration: ${results.duration ? `${(results.duration / 1000).toFixed(1)}s` : 'N/A'}</p>
    <p>>> devices_tested: ${Object.keys(results.browsers).length}</p>
    
    <!-- Overall Comparison Score -->
    <div style="
      background: linear-gradient(135deg, rgba(187,134,252,0.05) 0%, rgba(187,134,252,0.02) 100%);
      border: 2px solid ${getPerformanceColor(results.overallScore)};
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
      box-shadow: 0 4px 20px rgba(187,134,252,0.15);
    ">
      <h3 style="margin: 0 0 1.5rem 0; color: #bb86fc;">Overall Performance Comparison</h3>
      
      <!-- Circular Dials for Each Browser -->
      <div style="display: flex; justify-content: center; gap: 3rem; flex-wrap: wrap; margin: 2rem 0;">
        ${renderBrowserDials(results.browsers)}
      </div>
      
      <!-- Performance Gap Warning -->
      ${results.comparison.performanceGap > 20 ? `
        <div style="background: rgba(255, 102, 0, 0.1); border-left: 4px solid #ff6600; padding: 1rem; margin-top: 1.5rem; border-radius: 4px;">
          <p style="margin: 0; color: #ff6600; font-weight: bold;">~ Significant Performance Gap Detected</p>
          <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">
            ${results.comparison.performanceGap} point difference between desktop and mobile performance
          </p>
        </div>
      ` : ''}
      
      <!-- Overall Score -->
      <div style="text-align: center; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(187,134,252,0.3);">
        <div style="font-size: 2.5rem; font-weight: bold; color: ${getPerformanceColor(results.overallScore)}; margin-bottom: 0.5rem;">
          ${results.overallScore}
        </div>
        <div style="font-size: 1rem; color: #808080;">Average Performance Score</div>
      </div>
    </div>
  `;
  
  container.appendChild(summarySection);
  
  // Accordion Sections
  createAccordionSection(container, 'browser-comparison', 'Device-by-Device Analysis', 
    () => renderDeviceComparisonContent(results.browsers), null);
  
  createAccordionSection(container, 'cwv-comparison', 'Core Web Vitals Comparison', 
    () => renderCWVComparisonContent(results.browsers), null);
  
  createAccordionSection(container, 'cross-browser-recommendations', 'Cross-Device Recommendations', 
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
        <div style="font-size: 0.85rem; color: #808080;">${data.description}</div>
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
          <p style="color: #ff4444;">✗ Analysis failed: ${data.error || 'Unknown error'}</p>
        ` : `
          <!-- Lighthouse Category Scores -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${perfColor};">${data.performanceScore}</div>
              <div style="font-size: 0.9rem; color: #808080;">Performance</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${a11yColor};">${data.accessibilityScore}</div>
              <div style="font-size: 0.9rem; color: #808080;">Accessibility</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${bpColor};">${data.bestPracticesScore}</div>
              <div style="font-size: 0.9rem; color: #808080;">Best Practices</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.05); border-radius: 4px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${seoColor};">${data.seoScore}</div>
              <div style="font-size: 0.9rem; color: #808080;">SEO</div>
            </div>
          </div>
          
          <!-- Core Web Vitals -->
          <h4 style="margin: 1rem 0 0.5rem 0; color: #00ff41;">Core Web Vitals</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
            ${renderMetricBox('LCP', data.metrics.metrics.coreWebVitals.lcp, 'ms', 'lcp')}
            ${renderMetricBox('FID', data.metrics.metrics.coreWebVitals.fid, 'ms', 'fid')}
            ${renderMetricBox('CLS', data.metrics.metrics.coreWebVitals.cls, '', 'cls')}
          </div>
          
          <!-- Additional Metrics -->
          <h4 style="margin: 1rem 0 0.5rem 0; color: #00ff41;">Additional Metrics</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
            ${renderMetricBox('FCP', data.metrics.firstContentfulPaint, 'ms', 'fcp')}
            ${renderMetricBox('TBT', data.metrics.totalBlockingTime, 'ms', 'tbt')}
            ${renderMetricBox('Speed Index', data.metrics.speedIndex, 'ms', 'si')}
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
    return '<p style="color: #ff6600;">>>> Comparison requires both desktop and mobile data</p>';
  }
  
  return `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-family: 'Courier New', monospace;">
        <thead>
          <tr style="border-bottom: 2px solid rgba(187,134,252,0.3);">
            <th style="text-align: left; padding: 1rem; color: #bb86fc;">Metric</th>
            <th style="text-align: center; padding: 1rem; color: #bb86fc;">D Desktop</th>
            <th style="text-align: center; padding: 1rem; color: #bb86fc;">M Mobile</th>
            <th style="text-align: center; padding: 1rem; color: #bb86fc;">Difference</th>
            <th style="text-align: center; padding: 1rem; color: #bb86fc;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${renderComparisonRow('LCP', desktopData.metrics.metrics.coreWebVitals.lcp, mobileData.metrics.metrics.coreWebVitals.lcp, 'ms', 2500, 4000)}
          ${renderComparisonRow('FID', desktopData.metrics.metrics.coreWebVitals.fid, mobileData.metrics.metrics.coreWebVitals.fid, 'ms', 100, 300)}
          ${renderComparisonRow('CLS', desktopData.metrics.metrics.coreWebVitals.cls, mobileData.metrics.metrics.coreWebVitals.cls, '', 0.1, 0.25)}
          ${renderComparisonRow('FCP', desktopData.metrics.firstContentfulPaint, mobileData.metrics.firstContentfulPaint, 'ms', 1800, 3000)}
          ${renderComparisonRow('TBT', desktopData.metrics.totalBlockingTime, mobileData.metrics.totalBlockingTime, 'ms', 200, 600)}
          ${renderComparisonRow('Speed Index', desktopData.metrics.speedIndex, mobileData.metrics.speedIndex, 'ms', 3400, 5800)}
        </tbody>
      </table>
    </div>
    
    <!-- Performance Score Comparison -->
    <div style="margin-top: 2rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
      <h4 style="margin: 0 0 1rem 0; color: #bb86fc;">Lighthouse Category Scores</h4>
      <div style="display: grid; grid-template-columns: auto 1fr 1fr 1fr; gap: 0.5rem; align-items: center;">
        <div style="font-weight: bold;">Category</div>
        <div style="text-align: center; font-weight: bold;">D Desktop</div>
        <div style="text-align: center; font-weight: bold;">M Mobile</div>
        <div style="text-align: center; font-weight: bold;">Gap</div>
        
        ${renderScoreComparisonRow('Performance', desktopData.performanceScore, mobileData.performanceScore)}
        ${renderScoreComparisonRow('Accessibility', desktopData.accessibilityScore, mobileData.accessibilityScore)}
        ${renderScoreComparisonRow('Best Practices', desktopData.bestPracticesScore, mobileData.bestPracticesScore)}
        ${renderScoreComparisonRow('SEO', desktopData.seoScore, mobileData.seoScore)}
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
      status = '✓ Good';
      statusColor = '#00ff41';
    } else if (avgValue <= needsImprovementThreshold) {
      status = '~ Needs Work';
      statusColor = '#ffa500';
    } else {
      status = '✗ Poor';
      statusColor = '#ff4444';
    }
  } else {
    if (avgValue <= goodThreshold) {
      status = '✓ Good';
      statusColor = '#00ff41';
    } else if (avgValue <= needsImprovementThreshold) {
      status = '~ Needs Work';
      statusColor = '#ffa500';
    } else {
      status = '✗ Poor';
      statusColor = '#ff4444';
    }
  }
  
  return `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
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
    <div style="padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">${category}</div>
    <div style="padding: 0.5rem 0; text-align: center; color: ${getPerformanceColor(desktopScore)}; border-bottom: 1px solid rgba(255,255,255,0.05);">
      ${desktopScore}
    </div>
    <div style="padding: 0.5rem 0; text-align: center; color: ${getPerformanceColor(mobileScore)}; border-bottom: 1px solid rgba(255,255,255,0.05);">
      ${mobileScore}
    </div>
    <div style="padding: 0.5rem 0; text-align: center; color: ${gapColor}; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.05);">
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
      if (numValue <= 2500) { color = '#00ff41'; status = 'Good'; }
      else if (numValue <= 4000) { color = '#ffa500'; status = 'Needs Work'; }
      else { color = '#ff4444'; status = 'Poor'; }
      break;
    case 'fid':
      if (numValue <= 100) { color = '#00ff41'; status = 'Good'; }
      else if (numValue <= 300) { color = '#ffa500'; status = 'Needs Work'; }
      else { color = '#ff4444'; status = 'Poor'; }
      break;
    case 'cls':
      if (numValue <= 0.1) { color = '#00ff41'; status = 'Good'; }
      else if (numValue <= 0.25) { color = '#ffa500'; status = 'Needs Work'; }
      else { color = '#ff4444'; status = 'Poor'; }
      break;
    case 'fcp':
      if (numValue <= 1800) { color = '#00ff41'; status = 'Good'; }
      else if (numValue <= 3000) { color = '#ffa500'; status = 'Needs Work'; }
      else { color = '#ff4444'; status = 'Poor'; }
      break;
    case 'tbt':
      if (numValue <= 200) { color = '#00ff41'; status = 'Good'; }
      else if (numValue <= 600) { color = '#ffa500'; status = 'Needs Work'; }
      else { color = '#ff4444'; status = 'Poor'; }
      break;
    case 'si':
      if (numValue <= 3400) { color = '#00ff41'; status = 'Good'; }
      else if (numValue <= 5800) { color = '#ffa500'; status = 'Needs Work'; }
      else { color = '#ff4444'; status = 'Poor'; }
      break;
    default:
      color = '#808080';
      status = 'Info';
  }
  
  return `
    <div style="padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 4px; border-left: 3px solid ${color};">
      <div style="font-size: 0.85rem; color: #808080; margin-bottom: 0.25rem;">${label}</div>
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
    return '<p style="color: #00ff41;">>>> No major cross-device issues detected!</p>';
  }
  
  let html = '<div>';
  
  recommendations.forEach((rec, index) => {
    const priorityColor = rec.priority === 'high' ? '#ff4444' : rec.priority === 'medium' ? '#ffa500' : '#00ff41';
    const priorityIcon = rec.priority === 'high' ? '!' : rec.priority === 'medium' ? '~' : 'ⓘ';
    
    html += `
      <div style="margin-bottom: 1.5rem; padding: 1.5rem; background: rgba(255,255,255,0.03); border-left: 4px solid ${priorityColor}; border-radius: 4px;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <span style="font-size: 1.2rem;">${priorityIcon}</span>
          <h4 style="margin: 0; color: ${priorityColor};">${rec.title}</h4>
          <span style="margin-left: auto; padding: 0.25rem 0.75rem; background: ${priorityColor}33; color: ${priorityColor}; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">
            ${rec.priority.toUpperCase()}
          </span>
        </div>
        
        <p style="margin: 0.5rem 0; color: #c0c0c0;">${rec.description}</p>
        
        ${rec.actions && rec.actions.length > 0 ? `
          <div style="margin-top: 1rem;">
            <strong style="color: #bb86fc;">Recommended Actions:</strong>
            <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
              ${rec.actions.map(action => `<li style="margin: 0.25rem 0; color: #c0c0c0;">${action}</li>`).join('')}
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
        <h4 style="margin: 0 0 1rem 0; color: #ffa500;">C Detected Metric Discrepancies</h4>
        ${comparison.metricsDifferences.map(diff => `
          <div style="padding: 0.75rem; margin: 0.5rem 0; background: rgba(0,0,0,0.3); border-radius: 4px;">
            <div style="font-weight: bold; color: ${diff.severity === 'high' ? '#ff4444' : '#ffa500'};">
              ${diff.metric}
            </div>
            <div style="font-size: 0.9rem; color: #c0c0c0; margin-top: 0.25rem;">
              ${diff.message}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem; font-size: 0.85rem;">
              <div>D Desktop: <span style="color: #00ff41;">${typeof diff.desktop === 'number' ? diff.desktop.toFixed(diff.metric.includes('CLS') ? 3 : 0) : diff.desktop}</span></div>
              <div>M Mobile: <span style="color: #ffa500;">${typeof diff.mobile === 'number' ? diff.mobile.toFixed(diff.metric.includes('CLS') ? 3 : 0) : diff.mobile}</span></div>
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




