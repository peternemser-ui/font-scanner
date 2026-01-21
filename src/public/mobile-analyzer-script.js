/**
 * Mobile Analyzer Script
 * Multi-device testing with performance, accessibility, and readability analysis
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'mobile-analyzer';

document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  
  const urlInput = document.getElementById('urlInput');
  const analyzeButton = document.getElementById('analyzeButton');
  const results = document.getElementById('results');
  const loadingContainer = document.getElementById('loadingContainer');
  const resultsContent = document.getElementById('resultsContent');
  const errorMessage = document.getElementById('errorMessage');
  // Initialize AnalyzerLoader
  let loader = null;
  if (typeof AnalyzerLoader !== 'undefined') {
    loader = new AnalyzerLoader('loadingContainer');
  }

  // Device name mapping for display
  const deviceNames = {
    'iphone-14': 'iPhone 14',
    'iphone-15-pro': 'iPhone 15 Pro',
    'iphone-se': 'iPhone SE',
    'pixel-7': 'Pixel 7',
    'pixel-8': 'Pixel 8',
    'galaxy-s23': 'Galaxy S23',
    'galaxy-s24': 'Galaxy S24',
    'ipad': 'iPad',
    'ipad-pro': 'iPad Pro'
  };

  // Build dynamic analysis steps based on selected devices
  function buildAnalysisSteps(devices) {
    const steps = [
      { label: 'Connecting to website', detail: 'Loading page on multiple devices...' }
    ];
    
    devices.forEach((deviceId, index) => {
      const name = deviceNames[deviceId] || deviceId;
      steps.push({
        label: `Testing ${name}`,
        detail: index === 0 ? 'Analyzing performance and layout...' : 
                index === devices.length - 1 ? 'Final device checks...' :
                'Checking touch targets and readability...'
      });
    });
    
    steps.push({ label: 'Compiling results', detail: 'Generating device comparison report...' });
    return steps;
  }

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

    // Clear report metadata from previous scans
    document.body.removeAttribute('data-report-id');
    document.body.removeAttribute('data-sm-screenshot-url');
    document.body.removeAttribute('data-sm-scan-started-at');

    // Get selected devices
    const devices = [];
    document.querySelectorAll('.device-selector input[type="checkbox"]:checked').forEach(checkbox => {
      const deviceId = checkbox.id.replace('device-', '');
      devices.push(deviceId);
    });

    if (devices.length === 0) {
      showError('Please select at least one device to test');
      return;
    }

    // Show loading
    results.classList.remove('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    analyzeButton.disabled = true;
    
    // Update button text
    const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
    buttonText.textContent = 'Analyzing...';

    // Build dynamic steps based on selected devices
    const analysisSteps = buildAnalysisSteps(devices);
    
    if (loader) {
      loader.start(analysisSteps, '📱 TESTING MOBILE', 45);
      
      // Add ASCII art patience message
      addPatienceMessage(loadingContainer);
    }

    try {
      if (loader) loader.nextStep(1);

      // Simulate progression through device testing steps
      const totalDeviceSteps = devices.length;
      let currentStep = 2; // Start after "Connecting to website"
      
      // Progress through device steps during API call
      const stepInterval = setInterval(() => {
        if (loader && currentStep <= totalDeviceSteps) {
          loader.nextStep(currentStep);
          currentStep++;
        } else {
          clearInterval(stepInterval);
        }
      }, 3000); // Every 3 seconds advance to next device

      const scanStartedAt = new Date().toISOString();
      window.SM_SCAN_STARTED_AT = scanStartedAt;
      document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

      const response = await fetch('/api/mobile-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url, 
          scanStartedAt,
          options: {
            devices,
            includePerformance: true,
            includeAccessibility: true,
            includeReadability: true,
            checkTouchTargets: true
          }
        })
      });

      // Clear the interval and jump to final step
      clearInterval(stepInterval);
      if (loader) loader.nextStep(totalDeviceSteps + 1); // "Compiling results"

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }

      const data = await response.json();
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
      
      if (loader) {
        loader.complete();
        setTimeout(() => {
          loadingContainer.style.display = 'none';
          displayResults(data.results, { reportId });
        }, 800);
      } else {
        displayResults(data.results, { reportId });
      }

    } catch (error) {
      if (loader) {
        loadingContainer.style.display = 'none';
      }
      showError(error.message);
    } finally {
      analyzeButton.disabled = false;
      const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
      buttonText.textContent = 'Analyze';
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  function displayResults(data, meta = {}) {
    const url = document.getElementById('urlInput').value;
    const timestamp = new Date().toLocaleString();
    const reportId = (meta && meta.reportId) ? String(meta.reportId) : (document.body.getAttribute('data-report-id') || '');
    
    // Check if shared components are loaded
    if (typeof ReportShell === 'undefined' || typeof ReportAccordion === 'undefined') {
      console.error('Shared report components not loaded');
      resultsContent.innerHTML = '<div style="color: red; padding: 2rem;">Error: Report components failed to load. Please refresh the page.</div>';
      return;
    }
    
    // Get first device data for advanced features
    const firstDevice = Object.values(data.devices).find(d => !d.error) || {};
    
    // Summary donuts
    const summaryDonuts = ReportShell.renderSummaryDonuts([
      { label: 'Mobile Score', score: data.mobileScore },
      { label: 'Performance', score: data.performanceSummary.average },
      { label: 'Readability', score: data.readabilitySummary.average },
      { label: 'Accessibility', score: data.accessibilitySummary.average }
    ]);
    
    // Device Screenshots Section
    const screenshotsContent = `
      <div class="report-shell__card">
        ${Object.entries(data.devices).map(([key, device]) => {
          if (device.error) {
            return `
              <div style="margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border-primary, rgba(255,255,255,0.1));">
                <h4 style="margin-bottom: 1rem;">${device.device || key}</h4>
                <div style="color: #ff6b6b; padding: 1rem; background: rgba(255,107,107,0.1); border-radius: 8px;">
                  ⚠️ Error capturing this device: ${device.error}
                </div>
              </div>
            `;
          }
          const portraitSrc = device.portraitScreenshot || device.screenshot || '';
          const landscapeSrc = device.landscapeScreenshot || '';
          const deviceWidth = device.viewport?.width || device.width || '';
          const deviceHeight = device.viewport?.height || device.height || '';
          return `
            <div style="margin-bottom: 2rem;">
              <h4 style="margin-bottom: 1rem;">${device.device}</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                ${portraitSrc ? `
                  <div style="text-align: center;">
                    <img src="${portraitSrc}" alt="${device.device} portrait" class="device-screenshot" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border-primary, rgba(255,255,255,0.1)); cursor: pointer;" onclick="window.open(this.src)">
                    <div style="margin-top: 0.5rem; color: var(--text-muted, #888); font-size: 0.85rem;">📱 ${deviceWidth}x${deviceHeight}</div>
                    <a href="${portraitSrc}" download="${device.device}-portrait.png" style="color: #60a5fa; font-size: 0.85rem; text-decoration: none;">🔽 Click to enlarge</a>
                  </div>
                ` : ''}
                ${landscapeSrc ? `
                  <div style="text-align: center;">
                    <img src="${landscapeSrc}" alt="${device.device} landscape" class="device-screenshot" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border-primary, rgba(255,255,255,0.1)); cursor: pointer;" onclick="window.open(this.src)">
                    <div style="margin-top: 0.5rem; color: var(--text-muted, #888); font-size: 0.85rem;">🖥️ ${deviceHeight}x${deviceWidth}</div>
                    <a href="${landscapeSrc}" download="${device.device}-landscape.png" style="color: #60a5fa; font-size: 0.85rem; text-decoration: none;">🔽 Click to enlarge</a>
                  </div>
                ` : ''}
                ${!portraitSrc && !landscapeSrc ? `
                  <div style="padding: 1rem; border: 1px dashed var(--border-primary, rgba(255,255,255,0.1)); border-radius: 8px; color: var(--text-muted, #888);">
                    Screenshot not available for this device.
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
    // Other diagnostic sections (viewport, PWA, dark mode, etc.)
    const diagnosticsContent = createAllDiagnosticSections(data, firstDevice);
    
    // Recommendations
    const recommendationsContent = `
      <div class="report-shell__card">
        ${data.recommendations.length > 0 ? 
          data.recommendations.map(rec => `
            <div style="background: rgba(255, 255, 255, 0.03); padding: 1rem; margin-bottom: 0.75rem; border-radius: 8px; border-left: 3px solid ${rec.severity === 'high' ? '#ef4444' : rec.severity === 'medium' ? '#f59e0b' : '#22c55e'};">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <strong style="color: var(--text-primary, #fff);">${rec.title}</strong>
                <span style="padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; background: rgba(255,255,255,0.1);">${rec.category}</span>
              </div>
              <div style="font-size: 0.9rem; color: var(--text-muted, #aaa);">${rec.suggestion}</div>
            </div>
          `).join('') 
          : '<p style="color: var(--text-muted, #888);">✅ No significant issues detected!</p>'
        }
      </div>
    `;

    const isReportUnlocked = (id) => {
      const reportId = String(id || '').trim();

      // Subscription-style Pro (or ProReportBlock helper)
      if (window.ProReportBlock && typeof window.ProReportBlock.isPro === 'function') {
        if (window.ProReportBlock.isPro(reportId || null)) return true;
      }

      // Per-report unlock via credits
      if (reportId && window.CreditsManager) {
        if (typeof window.CreditsManager.isUnlocked === 'function') return window.CreditsManager.isUnlocked(reportId);
        if (typeof window.CreditsManager.isReportUnlocked === 'function') return window.CreditsManager.isReportUnlocked(reportId);
      }

      return false;
    };

    const proLocked = !isReportUnlocked(reportId);
    
    const majorScoreSections = [
      ReportAccordion.createSection({
        id: 'mobile-performance-summary',
        title: 'Performance',
        scoreTextRight: `${data.performanceSummary?.average || 0}/100`,
        contentHTML: renderScoreSectionContent(
          data.devices,
          'performance',
          'score',
          data.recommendations,
          'Performance',
          ['Load time', 'DOM content loaded', 'First paint'],
          data.performanceSummary?.average || 0
        )
      }),
      ReportAccordion.createSection({
        id: 'mobile-readability-summary',
        title: 'Readability',
        scoreTextRight: `${data.readabilitySummary?.average || 0}/100`,
        contentHTML: renderScoreSectionContent(
          data.devices,
          'readability',
          'readabilityScore',
          data.recommendations,
          'Readability',
          ['Body font size', 'Line height', 'Text contrast'],
          data.readabilitySummary?.average || 0
        )
      }),
      ReportAccordion.createSection({
        id: 'mobile-accessibility-summary',
        title: 'Accessibility',
        scoreTextRight: `${data.accessibilitySummary?.average || 0}/100`,
        contentHTML: renderScoreSectionContent(
          data.devices,
          'accessibility',
          'a11yScore',
          data.recommendations,
          'Accessibility',
          ['Alt text coverage', 'Heading hierarchy', 'Contrast checks'],
          data.accessibilitySummary?.average || 0
        )
      })
    ];

    // Build accordions
    const accordions = [
      ReportAccordion.createSection({ id: 'mobile-screenshots', title: 'Device Screenshots', scoreTextRight: `${Object.keys(data.devices).length} Devices`, contentHTML: screenshotsContent }),
      ...majorScoreSections,
      ...diagnosticsContent,
      ReportAccordion.createSection({
        id: 'report-recommendations',
        title: 'Report and Recommendations',
        scoreTextRight: null,
        isPro: true,
        locked: proLocked,
        context: 'mobile',
        reportId,
        contentHTML: recommendationsContent
      })
    ].join('');
    
    // Summary stats
    const issuesCount = data.recommendations.filter(r => r.severity === 'high').length;
    const summaryStats = {
      issues: issuesCount,
      recommendations: data.recommendations.length,
      checks: Object.keys(data.devices).length
    };
    
    const html = `
      ${ReportShell.renderReportHeader({ title: 'Mobile Testing Report', url, timestamp, badgeText: 'Mobile', mode: 'mobile' })}
      ${summaryDonuts}
      ${accordions}
      ${renderMobileSummarySection(summaryStats)}
      ${renderMobileTakeActionSection(url, reportId)}
    `;
    
    resultsContent.innerHTML = `<div class="report-scope">${html}</div>`;
    window.mobileData = data;
    ReportAccordion.initInteractions();

    if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function' && reportId) {
      window.CreditsManager.renderPaywallState(reportId);
    }
  }
  
  function formatScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0.00';
    return numeric.toFixed(2);
  }

  function renderDeviceScoreBreakdown(devices = {}, metricKey, scoreKey, averageScore = 0) {
    const items = Object.entries(devices)
      .filter(([, device]) => device?.[metricKey]?.[scoreKey] !== undefined)
      .map(([, device]) => ({
        name: device.device || 'Device',
        score: device[metricKey][scoreKey]
      }));

    const scores = items.map(item => Number(item.score) || 0);
    const avg = scores.length ? (scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
    const min = scores.length ? Math.min(...scores) : 0;
    const max = scores.length ? Math.max(...scores) : 0;

    if (items.length === 0) {
      return `
        <div class="report-shell__card">
          <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
            No per-device scores available. Using overall average for this category: <strong>${formatScore(averageScore)}/100</strong>.
          </div>
        </div>
      `;
    }

    return `
      <div class="report-shell__card">
        <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px; display: grid; gap: 0.75rem;">
          <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; font-size: 0.85rem; color: var(--text-tertiary);">
            <div>Avg: <strong style="color: var(--text-primary);">${formatScore(avg)}/100</strong></div>
            <div>Best: <strong style="color: var(--text-primary);">${formatScore(max)}/100</strong></div>
            <div>Lowest: <strong style="color: var(--text-primary);">${formatScore(min)}/100</strong></div>
          </div>
          ${items.map(item => {
            const safeScore = Math.max(0, Math.min(100, Number(item.score) || 0));
            const barColor = safeScore >= 90 ? '#22c55e' : safeScore >= 70 ? '#eab308' : '#ef4444';
            return `
              <div style="display: grid; grid-template-columns: 120px 1fr 48px; gap: 0.75rem; align-items: center;">
                <span>${item.name}</span>
                <div style="height: 8px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden;">
                  <div style="width: ${safeScore}%; height: 100%; background: ${barColor};"></div>
                </div>
                <strong>${formatScore(safeScore)}/100</strong>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderScoreSectionContent(devices, metricKey, scoreKey, recommendations = [], categoryLabel, criteria = [], summaryAverage = 0) {
    const deviceEntries = Object.entries(devices || {});
    const items = deviceEntries
      .filter(([, device]) => device?.[metricKey]?.[scoreKey] !== undefined)
      .map(([, device]) => ({
        name: device.device || 'Device',
        score: device[metricKey][scoreKey]
      }));
    const scores = items.map(item => Number(item.score) || 0);
    const avg = scores.length ? (scores.reduce((sum, value) => sum + value, 0) / scores.length) : Number(summaryAverage) || 0;
    const min = scores.length ? Math.min(...scores) : 0;
    const max = scores.length ? Math.max(...scores) : 0;
    const spread = scores.length ? Math.max(0, max - min) : 0;
    const missingCount = Math.max(0, deviceEntries.length - items.length);
    const lowestDevices = items
      .slice()
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 2);
    const highestDevices = items
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 2);

    const breakdown = renderDeviceScoreBreakdown(devices, metricKey, scoreKey, avg);
    const categoryRecs = recommendations.filter(rec => rec.category === categoryLabel).slice(0, 3);

    const criteriaList = criteria.length
      ? `<ul style="margin: 0.25rem 0 0.75rem 1rem; color: var(--text-tertiary); font-size: 0.85rem;">
          ${criteria.map(item => `<li>${item}</li>`).join('')}
        </ul>`
      : '';

    const recList = categoryRecs.length
      ? `<div style="display: grid; gap: 0.4rem;">
           ${categoryRecs.map(rec => `
             <div style="padding: 0.5rem 0.75rem; border-radius: 8px; background: rgba(255,255,255,0.04);">
               <div style="font-weight: 600;">${rec.title}</div>
               <div style="color: var(--text-tertiary); font-size: 0.85rem;">${rec.suggestion}</div>
             </div>
           `).join('')}
         </div>`
      : '<div style="color: var(--text-tertiary); font-size: 0.85rem;">No major issues flagged for this category.</div>';

    let extraInsights = '';
    if (metricKey === 'readability') {
      const readabilityItems = deviceEntries
        .map(([, device]) => ({
          name: device.device || 'Device',
          data: device.readability
        }))
        .filter(item => item.data && !item.data.error && item.data.totalElements);

      if (!readabilityItems.length) {
        extraInsights = `
          <div style="margin-top: 0.75rem; color: var(--text-tertiary); font-size: 0.85rem;">
            Readability details were not available for this scan. We will retry on the next run.
          </div>
        `;
      } else {
        const avgSmallFont = Math.round(readabilityItems.reduce((sum, item) => sum + (item.data.smallFontPercentage || 0), 0) / readabilityItems.length);
        const avgLineHeight = Math.round(readabilityItems.reduce((sum, item) => sum + (item.data.goodLineHeightPercentage || 0), 0) / readabilityItems.length);
        const totalElements = readabilityItems.reduce((sum, item) => sum + (item.data.totalElements || 0), 0);
        const worst = readabilityItems.slice().sort((a, b) => (b.data.smallFontPercentage || 0) - (a.data.smallFontPercentage || 0))[0];

        extraInsights = `
          <div style="margin-top: 0.75rem; display: grid; gap: 0.5rem;">
            <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; font-size: 0.85rem; color: var(--text-tertiary);">
              <div>Small text: <strong style="color: var(--text-primary);">${avgSmallFont}%</strong></div>
              <div>Good line height: <strong style="color: var(--text-primary);">${avgLineHeight}%</strong></div>
              <div>Elements checked: <strong style="color: var(--text-primary);">${totalElements}</strong></div>
            </div>
            ${worst ? `<div style="color: var(--text-tertiary); font-size: 0.85rem;">Most small text on: <strong style="color: var(--text-primary);">${worst.name}</strong> (${Math.round(worst.data.smallFontPercentage || 0)}%).</div>` : ''}
          </div>
        `;
      }
    }

    if (metricKey === 'performance') {
      const perfItems = deviceEntries
        .map(([, device]) => ({
          name: device.device || 'Device',
          data: device.performance
        }))
        .filter(item => item.data && !item.data.error);

      if (!perfItems.length) {
        extraInsights = `
          <div style="margin-top: 0.75rem; color: var(--text-tertiary); font-size: 0.85rem;">
            Performance timing metrics were not captured. Using score-only analysis.
          </div>
        `;
      } else {
        const avgDom = Math.round(perfItems.reduce((sum, item) => sum + (item.data.domContentLoaded || 0), 0) / perfItems.length);
        const avgLoad = Math.round(perfItems.reduce((sum, item) => sum + (item.data.loadComplete || 0), 0) / perfItems.length);
        const avgFcp = Math.round(perfItems.reduce((sum, item) => sum + (item.data.firstContentfulPaint || 0), 0) / perfItems.length);
        const slowest = perfItems.slice().sort((a, b) => (b.data.loadComplete || 0) - (a.data.loadComplete || 0))[0];

        extraInsights = `
          <div style="margin-top: 0.75rem; display: grid; gap: 0.5rem;">
            <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; font-size: 0.85rem; color: var(--text-tertiary);">
              <div>Avg DOM ready: <strong style="color: var(--text-primary);">${avgDom}ms</strong></div>
              <div>Avg load: <strong style="color: var(--text-primary);">${avgLoad}ms</strong></div>
              <div>Avg FCP: <strong style="color: var(--text-primary);">${avgFcp}ms</strong></div>
            </div>
            ${slowest ? `<div style="color: var(--text-tertiary); font-size: 0.85rem;">Slowest load: <strong style="color: var(--text-primary);">${slowest.name}</strong> (${Math.round(slowest.data.loadComplete || 0)}ms).</div>` : ''}
          </div>
        `;
      }
    }

    if (metricKey === 'accessibility') {
      const a11yItems = deviceEntries
        .map(([, device]) => ({
          name: device.device || 'Device',
          data: device.accessibility
        }))
        .filter(item => item.data && !item.data.error);

      if (!a11yItems.length) {
        extraInsights = `
          <div style="margin-top: 0.75rem; color: var(--text-tertiary); font-size: 0.85rem;">
            Accessibility detail checks were not captured. Using score-only analysis.
          </div>
        `;
      } else {
        const totalImages = a11yItems.reduce((sum, item) => sum + (item.data.totalImages || 0), 0);
        const missingAlt = a11yItems.reduce((sum, item) => sum + (item.data.missingAlt || 0), 0);
        const headingIssues = a11yItems.filter(item => item.data.headingIssues).length;
        const altCoverage = totalImages ? Math.round(((totalImages - missingAlt) / totalImages) * 100) : 0;

        extraInsights = `
          <div style="margin-top: 0.75rem; display: grid; gap: 0.5rem;">
            <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; font-size: 0.85rem; color: var(--text-tertiary);">
              <div>Alt coverage: <strong style="color: var(--text-primary);">${altCoverage}%</strong></div>
              <div>Images missing alt: <strong style="color: var(--text-primary);">${missingAlt}</strong></div>
              <div>Heading issues: <strong style="color: var(--text-primary);">${headingIssues}</strong></div>
            </div>
          </div>
        `;
      }
    }

    const coverageLine = deviceEntries.length
      ? `<div style="color: var(--text-tertiary); font-size: 0.85rem;">Coverage: ${items.length}/${deviceEntries.length} devices scored${missingCount ? ` (missing ${missingCount})` : ''}.</div>`
      : '';

    const varianceLine = scores.length
      ? `<div style="color: var(--text-tertiary); font-size: 0.85rem;">Score spread: ${formatScore(spread)} points (best ${formatScore(max)}/100, lowest ${formatScore(min)}/100).</div>`
      : `<div style="color: var(--text-tertiary); font-size: 0.85rem;">Score spread not available. Using summary average ${formatScore(avg)}/100.</div>`;

    const deviceHighlights = scores.length
      ? `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.5rem; margin-top: 0.5rem;">
          <div>
            <div style="font-weight: 600; margin-bottom: 0.25rem;">Lowest scoring</div>
            ${lowestDevices.map(item => `<div style="color: var(--text-tertiary); font-size: 0.85rem;">${item.name}: ${formatScore(item.score || 0)}/100</div>`).join('')}
          </div>
          <div>
            <div style="font-weight: 600; margin-bottom: 0.25rem;">Highest scoring</div>
            ${highestDevices.map(item => `<div style="color: var(--text-tertiary); font-size: 0.85rem;">${item.name}: ${formatScore(item.score || 0)}/100</div>`).join('')}
          </div>
        </div>`
      : '';

    return `
      <div style="display: grid; gap: 0.75rem;">
        ${breakdown}
        <div class="report-shell__card">
          <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
            <div style="font-weight: 600; margin-bottom: 0.35rem;">Why this score?</div>
            <div style="color: var(--text-tertiary); font-size: 0.9rem;">Measured on-device using the selected viewport(s).</div>
            ${coverageLine}
            ${varianceLine}
            ${deviceHighlights}
            ${extraInsights}
            ${criteriaList}
            <div style="font-weight: 600; margin: 0.75rem 0 0.35rem;">Top factors</div>
            ${recList}
          </div>
        </div>
      </div>
    `;
  }

  function createAllDiagnosticSections(data, firstDevice) {
    const sections = [];
    
    // Viewport Meta Tag
    sections.push(ReportAccordion.createSection({
      id: 'mobile-viewport',
      title: 'Viewport Meta Tag',
      scoreTextRight: `${firstDevice.viewportMetaTag?.score || 0}/100`,
      contentHTML: `
        <div class="report-shell__card">
          <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
            <strong>Status:</strong> ${firstDevice.viewportMetaTag?.present ? '✅ Present' : '❌ Missing'}<br>
            ${firstDevice.viewportMetaTag?.content ? `<strong>Content:</strong> <code style="background: rgba(0,0,0,0.3); padding: 0.25rem 0.5rem; border-radius: 4px;">${firstDevice.viewportMetaTag.content}</code>` : ''}
          </div>
        </div>
      `
    }));
    
    // PWA Readiness
    sections.push(ReportAccordion.createSection({
      id: 'mobile-pwa',
      title: 'PWA Readiness',
      scoreTextRight: `${firstDevice.pwaReadiness?.score || 0}/100`,
      contentHTML: `
        <div class="report-shell__card">
          <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
            ${firstDevice.pwaReadiness?.manifest ? '✅' : '❌'} Manifest: ${firstDevice.pwaReadiness?.manifest || 'Missing'}<br>
            ${firstDevice.pwaReadiness?.serviceWorker ? '✅' : '❌'} Service Worker: ${firstDevice.pwaReadiness?.serviceWorker || 'Not registered'}
          </div>
        </div>
      `
    }));
    
    // Dark Mode Support
    sections.push(ReportAccordion.createSection({
      id: 'mobile-darkmode',
      title: 'Dark Mode Support',
      scoreTextRight: `${firstDevice.darkModeSupport?.score || 0}/100`,
      contentHTML: `
        <div class="report-shell__card">
          <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
            <strong>Support:</strong> ${firstDevice.darkModeSupport?.supported ? '✅ Supported' : '❌ Not detected'}
          </div>
        </div>
      `
    }));
    
    // Above the fold content
    if (firstDevice.aboveTheFoldContent) {
      sections.push(ReportAccordion.createSection({
        id: 'mobile-fold',
        title: 'Above the Fold',
        scoreTextRight: `${firstDevice.aboveTheFoldContent.score || 0}/100`,
        contentHTML: `
          <div class="report-shell__card">
            <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <strong>Visible Content:</strong> ${firstDevice.aboveTheFoldContent.visibleElements || 0} elements<br>
              <strong>Images:</strong> ${firstDevice.aboveTheFoldContent.images || 0}<br>
              <strong>Text Elements:</strong> ${firstDevice.aboveTheFoldContent.textElements || 0}
            </div>
          </div>
        `
      }));
    }
    
    // Mobile SEO
    if (firstDevice.mobileSeo) {
      sections.push(ReportAccordion.createSection({
        id: 'mobile-seo',
        title: 'Mobile SEO',
        scoreTextRight: `${firstDevice.mobileSeo.score || 0}/100`,
        contentHTML: `
          <div class="report-shell__card">
            <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              ${firstDevice.mobileSeo.canonical ? '✅' : '❌'} Canonical URL<br>
              ${firstDevice.mobileSeo.robotsMeta ? '✅' : '❌'} Robots Meta<br>
              ${firstDevice.mobileSeo.structuredData ? '✅' : '❌'} Structured Data
            </div>
          </div>
        `
      }));
    }
    
    // Input Fields
    if (firstDevice.inputFields) {
      sections.push(ReportAccordion.createSection({
        id: 'mobile-inputs',
        title: 'Input Fields',
        scoreTextRight: `${firstDevice.inputFields.score || 0}/100`,
        contentHTML: `
          <div class="report-shell__card">
            <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <strong>Total:</strong> ${firstDevice.inputFields.total || 0}<br>
              <strong>With autocomplete:</strong> ${firstDevice.inputFields.withAutocomplete || 0}<br>
              <strong>With labels:</strong> ${firstDevice.inputFields.withLabels || 0}
            </div>
          </div>
        `
      }));
    }
    
    // Touch Targets
    if (firstDevice.touchTargets) {
      sections.push(ReportAccordion.createSection({
        id: 'mobile-touch',
        title: 'Touch Targets',
        scoreTextRight: `${Math.round((firstDevice.touchTargets.compliant || 0) / (firstDevice.touchTargets.total || 1) * 100)}%`,
        contentHTML: `
          <div class="report-shell__card">
            <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <strong>Total elements:</strong> ${firstDevice.touchTargets.total || 0}<br>
              <strong>Compliant (≥48px):</strong> ${firstDevice.touchTargets.compliant || 0}<br>
              <strong>Non-compliant:</strong> ${firstDevice.touchTargets.nonCompliant || 0}
            </div>
          </div>
        `
      }));
    }
    
    // Performance Metrics
    if (firstDevice.performanceMetrics) {
      sections.push(ReportAccordion.createSection({
        id: 'mobile-performance',
        title: 'Performance Metrics',
        scoreTextRight: `${firstDevice.performanceMetrics.score || 0}/100`,
        contentHTML: `
          <div class="report-shell__card">
            <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <strong>Load Time:</strong> ${firstDevice.performanceMetrics.loadTime || 'N/A'}<br>
              <strong>DOM Content Loaded:</strong> ${firstDevice.performanceMetrics.domContentLoaded || 'N/A'}<br>
              <strong>First Paint:</strong> ${firstDevice.performanceMetrics.firstPaint || 'N/A'}
            </div>
          </div>
        `
      }));
    }
    
    return sections;
  }
  
  function renderMobileSummarySection(stats) {
    return `
      <div class="section">
        <h2>Summary</h2>
        <div class="seo-summary">
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-value">${stats.issues}</span>
              <span class="stat-label">Issues Found</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stats.recommendations}</span>
              <span class="stat-label">Recommendations</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stats.checks}</span>
              <span class="stat-label">Checks Passed</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  function renderMobileTakeActionSection(url, reportId = '') {
    // Use new ProReportBlock component if available
    if (window.ProReportBlock && window.ProReportBlock.render) {
      return `
        <div class="section">
          ${window.ProReportBlock.render({
            context: 'mobile',
            features: ['pdf', 'csv', 'share'],
            title: 'Purchase Report',
            subtitle: 'Client-ready exports (PDF/share/data) for this scan.',
            reportId: reportId || null
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
              <span style="color: #666; font-size: 0.9rem;">Export or share this Mobile Testing report</span>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button onclick="exportMobilePDF()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid rgba(var(--accent-primary-rgb), 0.4); background: rgba(var(--accent-primary-rgb), 0.1); color: var(--accent-primary); cursor: pointer; font-weight: 600;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                PDF Report
              </button>
              <button onclick="copyMobileShareLink()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.05); color: #fff; cursor: pointer; font-weight: 600;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share Link
              </button>
              <button onclick="downloadMobileCSV()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.05); color: #fff; cursor: pointer; font-weight: 600;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7"/><path d="M3 7h18"/><path d="M10 11h4"/><path d="M10 15h4"/><path d="M6 11h.01"/><path d="M6 15h.01"/><path d="M18 11h.01"/><path d="M18 15h.01"/></svg>
                Export Data
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }
  
  // Stub functions for export (can be implemented later)
  window.exportMobilePDF = function() { alert('PDF export coming soon'); };
  window.copyMobileShareLink = function() { alert('Share link coming soon'); };
  window.downloadMobileCSV = function() { alert('CSV export coming soon'); };

  function getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'warning';
    return 'error';
  }

  function getScoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  function getScoreRGB(score) {
    if (score >= 80) return '16, 185, 129';
    if (score >= 60) return '245, 158, 11';
    return '239, 68, 68';
  }

  /**
   * Add ASCII art patience message to loading container
                          <div style="border: 4px solid #333; border-radius: 16px; padding: 4px; background: #1a1a1a;">
                            <img src="${device.screenshot}" alt="${device.device} portrait" 
                                 style="width: 120px; height: auto; border-radius: 12px; cursor: zoom-in;"
                                 class="device-screenshot" />
                          </div>
                          <div class="orientation-label">Portrait<br>${device.viewport.width}×${device.viewport.height}</div>
                          <div class="screenshot-zoom-hint" style="margin-top: 0.5rem; cursor: pointer; color: #888; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem;" onclick="this.previousElementSibling.previousElementSibling.querySelector('img').click()">
                            🔍 <span style="text-decoration: underline;">Click to enlarge</span>
                          </div>
                        </div>
                      ` : ''}
                      ${device.landscapeScreenshot ? `
                        <div class="orientation-item">
                          <div style="border: 4px solid #333; border-radius: 16px; padding: 4px; background: #1a1a1a;">
                            <img src="${device.landscapeScreenshot}" alt="${device.device} landscape" 
                                 style="width: 180px; height: auto; border-radius: 12px; cursor: zoom-in;"
                                 class="device-screenshot" />
                          </div>
                          <div class="orientation-label">Landscape<br>${device.viewport.height}×${device.viewport.width}</div>
                          <div class="screenshot-zoom-hint" style="margin-top: 0.5rem; cursor: pointer; color: #888; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem;" onclick="this.previousElementSibling.previousElementSibling.querySelector('img').click()">
                            🔍 <span style="text-decoration: underline;">Click to enlarge</span>
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 2. Viewport Meta Tag Analysis -->
        ${firstDevice.viewportMeta ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">📐</span>
              <span class="accordion-title">Viewport Meta Tag</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.viewportMeta.score)}">${firstDevice.viewportMeta.score}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">Meta Tag Present:</span>
                <span class="metric-value">${firstDevice.viewportMeta.exists ? '✅ Yes' : '❌ No'}</span>
              </div>
              ${firstDevice.viewportMeta.content ? `
                <div style="background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 4px; margin: 0.5rem 0; font-family: monospace; font-size: 0.85rem;">
                  ${firstDevice.viewportMeta.content}
                </div>
              ` : ''}
              ${firstDevice.viewportMeta.issues?.length > 0 ? `
                <h5 style="margin-top: 1rem; margin-bottom: 0.5rem;">Issues Found:</h5>
                ${firstDevice.viewportMeta.issues.map(issue => `
                  <div class="issue-item issue-${issue.severity}">${issue.message}</div>
                `).join('')}
              ` : '<p style="color: #10b981;">✅ No viewport issues detected</p>'}
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 3. PWA Readiness -->
        ${firstDevice.pwaReadiness ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">📲</span>
              <span class="accordion-title">PWA Readiness</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.pwaReadiness.score)}">${firstDevice.pwaReadiness.score}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">Installable:</span>
                <span class="metric-value">${firstDevice.pwaReadiness.installable ? '✅ Yes' : '❌ No'}</span>
              </div>
              <h5 style="margin-top: 1rem; margin-bottom: 0.5rem;">PWA Checklist:</h5>
              ${firstDevice.pwaReadiness.checklist?.map(item => `
                <div class="checklist-item">
                  <span class="${item.status === 'pass' ? 'checklist-pass' : 'checklist-fail'}">
                    ${item.status === 'pass' ? '✓' : '✗'}
                  </span>
                  <span>${item.item}</span>
                </div>
              `).join('') || ''}
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 4. Dark Mode Support -->
        ${firstDevice.darkModeSupport ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">🌙</span>
              <span class="accordion-title">Dark Mode Support</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.darkModeSupport.score)}">${firstDevice.darkModeSupport.score}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">Dark Mode Supported:</span>
                <span class="metric-value">${firstDevice.darkModeSupport.supported ? '✅ Yes' : '❌ No'}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">prefers-color-scheme:</span>
                <span class="metric-value">${firstDevice.darkModeSupport.hasMediaQuery ? '✅ Detected' : '❌ Not found'}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">color-scheme meta:</span>
                <span class="metric-value">${firstDevice.darkModeSupport.hasColorSchemeMeta ? '✅ ' + (firstDevice.darkModeSupport.colorSchemeValue || 'Present') : '❌ Missing'}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Theme Toggle:</span>
                <span class="metric-value">${firstDevice.darkModeSupport.hasThemeToggle ? '✅ Found' : '❌ Not found'}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">CSS Variables:</span>
                <span class="metric-value">${firstDevice.darkModeSupport.cssVariablesCount || 0} defined</span>
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 5. Above the Fold Analysis -->
        ${firstDevice.aboveTheFold ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">👁️</span>
              <span class="accordion-title">Above the Fold</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.aboveTheFold.criticalContentScore)}">${firstDevice.aboveTheFold.criticalContentScore}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">Headline (H1/H2):</span>
                <span class="metric-value">${firstDevice.aboveTheFold.hasHeadline ? '✅ Present' : '❌ Missing'}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Hero Image:</span>
                <span class="metric-value">${firstDevice.aboveTheFold.hasHeroImage ? '✅ Present' : '❌ Missing'}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Call-to-Action:</span>
                <span class="metric-value">${firstDevice.aboveTheFold.hasCTA ? '✅ Found' : '⚠️ Not detected'}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Images Above Fold:</span>
                <span class="metric-value">${firstDevice.aboveTheFold.imageCount || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Render-blocking Scripts:</span>
                <span class="metric-value ${firstDevice.aboveTheFold.renderBlockingScripts > 3 ? 'color: #ef4444' : ''}">${firstDevice.aboveTheFold.renderBlockingScripts || 0}</span>
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 6. Mobile SEO -->
        ${firstDevice.mobileSEO ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">🔍</span>
              <span class="accordion-title">Mobile SEO</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.mobileSEO.score)}">${firstDevice.mobileSEO.score}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">Title Tag:</span>
                <span class="metric-value">${firstDevice.mobileSEO.hasTitle ? '✅ ' + firstDevice.mobileSEO.titleLength + ' chars' : '❌ Missing'}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Meta Description:</span>
                <span class="metric-value">${firstDevice.mobileSEO.hasMetaDescription ? '✅ ' + firstDevice.mobileSEO.descriptionLength + ' chars' : '❌ Missing'}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Viewport Meta:</span>
                <span class="metric-value">${firstDevice.mobileSEO.hasViewport ? '✅ Present' : '❌ Missing'}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Canonical URL:</span>
                <span class="metric-value">${firstDevice.mobileSEO.hasCanonical ? '✅ Set' : '⚠️ Missing'}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Structured Data:</span>
                <span class="metric-value">${firstDevice.mobileSEO.structuredDataCount || 0} schemas</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Click-to-Call Links:</span>
                <span class="metric-value">${firstDevice.mobileSEO.clickToCallLinks || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">H1 Tags:</span>
                <span class="metric-value">${firstDevice.mobileSEO.h1Count === 1 ? '✅ 1 (good)' : (firstDevice.mobileSEO.h1Count || 0) + ' (should be 1)'}</span>
              </div>
              ${firstDevice.mobileSEO.issues?.length > 0 ? `
                <h5 style="margin-top: 1rem; margin-bottom: 0.5rem;">Issues:</h5>
                ${firstDevice.mobileSEO.issues.map(issue => `
                  <div class="issue-item issue-${issue.type}">${issue.item}</div>
                `).join('')}
              ` : ''}
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 7. Input Field Analysis -->
        ${firstDevice.inputAnalysis ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">⌨️</span>
              <span class="accordion-title">Input Fields</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.inputAnalysis.score)}">${firstDevice.inputAnalysis.score}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">Total Inputs:</span>
                <span class="metric-value">${firstDevice.inputAnalysis.total || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Email Inputs (type=email):</span>
                <span class="metric-value">${firstDevice.inputAnalysis.emailInputs || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Phone Inputs (type=tel):</span>
                <span class="metric-value">${firstDevice.inputAnalysis.telInputs || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Autocomplete Enabled:</span>
                <span class="metric-value">${firstDevice.inputAnalysis.autocompleteEnabled || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">Missing Labels:</span>
                <span class="metric-value ${firstDevice.inputAnalysis.missingLabels > 0 ? 'color: #ef4444' : ''}">${firstDevice.inputAnalysis.missingLabels || 0}</span>
              </div>
              ${firstDevice.inputAnalysis.issues?.length > 0 ? `
                <h5 style="margin-top: 1rem; margin-bottom: 0.5rem;">Optimization Suggestions:</h5>
                ${firstDevice.inputAnalysis.issues.map(issue => `
                  <div class="issue-item issue-warning">${issue.field}: ${issue.issue}</div>
                `).join('')}
              ` : '<p style="color: #10b981; margin-top: 1rem;">✅ Input fields are well-optimized for mobile</p>'}
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 8. Touch Targets -->
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">👆</span>
              <span class="accordion-title">Touch Targets</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(data.touchTargetsSummary.average)}">${data.touchTargetsSummary.average}%</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <p style="color: #888; margin-bottom: 1rem;">WCAG AAA requires touch targets to be at least 44×44 pixels.</p>
              ${Object.entries(data.devices).map(([key, device]) => {
                if (device.error || !device.touchTargets) return '';
                return `
                  <div style="margin-bottom: 1rem;">
                    <strong>${device.device}</strong>: ${device.touchTargets.compliancePercentage}% compliant
                    ${device.touchTargets.issues > 0 ? `<span style="color: #ef4444;"> (${device.touchTargets.issues} undersized)</span>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 9. Performance Metrics -->
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">⚡</span>
              <span class="accordion-title">Performance Metrics</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(data.performanceSummary.average)}">${data.performanceSummary.average}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              ${Object.entries(data.devices).map(([key, device]) => {
                if (device.error || !device.performance) return '';
                return `
                  <div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <strong style="color: #00ff41;">${device.device}</strong>
                    <div class="metric-row">
                      <span class="metric-label">First Paint:</span>
                      <span class="metric-value">${device.performance.firstPaint}ms</span>
                    </div>
                    <div class="metric-row">
                      <span class="metric-label">First Contentful Paint:</span>
                      <span class="metric-value">${device.performance.firstContentfulPaint}ms</span>
                    </div>
                    <div class="metric-row">
                      <span class="metric-label">DOM Content Loaded:</span>
                      <span class="metric-value">${device.performance.domContentLoaded}ms</span>
                    </div>
                    <div class="metric-row">
                      <span class="metric-label">Page Load Complete:</span>
                      <span class="metric-value">${device.performance.loadComplete}ms</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

      </div>

      <!-- Recommendations -->
      ${data.recommendations.length > 0 ? `
        <h3 style="margin-top: 2rem; margin-bottom: 1rem;">💡 Recommendations</h3>
        ${data.recommendations.map(rec => `
          <div class="recommendation-card ${rec.severity}">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
              <strong>${rec.title}</strong>
              <span class="score-badge score-${rec.severity}" style="margin: 0;">
                ${rec.category}
              </span>
            </div>
            <div style="font-size: 0.9rem; color: #aaa;">${rec.suggestion}</div>
          </div>
        `).join('')}
      ` : '<p style="color: #888;">✅ No significant issues detected!</p>'}
    `;

    resultsContent.innerHTML = html;
    window.mobileData = data;

    // Setup accordion using event delegation on resultsContent
    resultsContent.addEventListener('click', function(e) {
      // Find if we clicked on or inside an accordion-header
      const header = e.target.closest('.accordion-header');
      if (header) {
        // Don't toggle if clicking on a screenshot
        if (e.target.classList.contains('device-screenshot')) return;
        
        const item = header.closest('.accordion-item');
        if (item) {
          e.preventDefault();
          e.stopPropagation();
          item.classList.toggle('open');
        }
      }
    });

    // Setup screenshot modal click handlers
    const modal = document.getElementById('screenshotModal');
    const modalImage = document.getElementById('modalImage');
    const closeBtn = document.getElementById('screenshotModalClose');

    if (modal && modalImage) {
      const previousFocus = { el: null };

      const closeModal = () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        modalImage.src = '';
        if (previousFocus.el && typeof previousFocus.el.focus === 'function' && document.contains(previousFocus.el)) {
          previousFocus.el.focus();
        }
      };

      const openModal = (imgEl) => {
        previousFocus.el = document.activeElement;
        modalImage.src = imgEl.src;
        modalImage.alt = imgEl.alt || 'Full size screenshot';
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        window.requestAnimationFrame(() => {
          if (closeBtn) closeBtn.focus();
          else modal.focus();
        });
      };

      // Avoid stacking duplicate handlers across rerenders
      if (modal.dataset.smWired !== 'true') {
        modal.dataset.smWired = 'true';

        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal();
        });

        document.addEventListener('keydown', (e) => {
          if (!modal.classList.contains('active')) return;

          if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
            return;
          }

          if (e.key !== 'Tab') return;

          const focusables = [closeBtn].filter(Boolean);
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
        });
      }

      document.querySelectorAll('.device-screenshot img').forEach((imgEl) => {
        imgEl.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent accordion toggle
          openModal(imgEl);
        });
      });
    }
  }

  function getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'warning';
    return 'error';
  }

  function getScoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  function getScoreRGB(score) {
    if (score >= 80) return '16, 185, 129';
    if (score >= 60) return '245, 158, 11';
    return '239, 68, 68';
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
        📱 Emulating multiple mobile devices...<br>
        <span style="font-size: 0.75rem; color: rgba(var(--accent-primary-rgb), 0.8);">This may take 45-90 seconds</span>
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
