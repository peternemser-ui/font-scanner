/**
 * Tag Intelligence Analyzer Script
 * Detects and analyzes analytics, advertising, and tracking tags
 * Always runs comprehensive analysis
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'tag-intelligence';

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

// Function to get analysis steps with current translations
// Called at runtime to ensure i18n is loaded
function getAnalysisSteps() {
  return [
    { label: t('loader.connectingToWebsite', 'Connecting to website'), detail: t('loader.loadingPage', 'Loading page and resources...') },
    { label: t('loader.detectingTagManagers', 'Detecting tag managers'), detail: t('loader.scanningTagManagers', 'Scanning for GTM, Adobe Launch, Tealium...') },
    { label: t('loader.analyzingTrackingTags', 'Analyzing tracking tags'), detail: t('loader.checkingAnalytics', 'Checking analytics and advertising tags...') },
    { label: t('loader.generatingReport', 'Generating report'), detail: t('loader.compilingResults', 'Compiling results and recommendations...') }
  ];
}

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

  // Analysis steps are now defined by getAnalysisSteps() function above

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
      showError(t('reports.common.pleaseEnterUrl', 'Please enter a valid URL'));
      return;
    }

    // Show loading
    results.classList.remove('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    analyzeButton.disabled = true;

    if (loader) {
      loader.start(getAnalysisSteps(), '🏷️ ' + t('loader.analyzingTags', 'ANALYZING TAGS'), 30);
      
      // Add ASCII art patience message
      addPatienceMessage(loadingContainer);
    }

    // Always use comprehensive mode
    const options = {
      comprehensive: true,
      includePerformanceImpact: true,
      includeDataLayer: true,
      includeConsentMode: true,
      includeThirdPartyScripts: true
    };

    try {
      if (loader) loader.nextStep(1);

      const scanStartedAt = new Date().toISOString();
      window.SM_SCAN_STARTED_AT = scanStartedAt;
      document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

      const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/tag-intelligence', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, options, scanStartedAt })
      });

      if (loader) loader.nextStep(3);

      if (!response.ok) {
        const error = await response.json();
        if (error.code === 'SCAN_QUOTA_EXCEEDED') {
          const limit = error.scansLimit || 10;
          if (loader) {
            loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
          }
          return;
        }
        throw new Error(error.message || error.error || t('reports.common.analysisFailed', 'Analysis failed'));
      }

      const data = await response.json();

      // Extract and set report metadata from API response
      console.log('[tag-intelligence-script] Setting report metadata from API response');
      const apiReportId = data?.reportId || data?.results?.reportId;
      const screenshotUrl = data?.screenshotUrl || data?.results?.screenshotUrl;
      if (apiReportId) {
        document.body.setAttribute('data-report-id', apiReportId);
      }
      if (screenshotUrl) {
        document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
      }

      // Store results globally for PDF export
      window.SM_TAG_INTELLIGENCE_RESULTS = data;

      if (loader) {
        loader.complete();
        setTimeout(() => {
          loadingContainer.style.display = 'none';
          try {
            displayResults(data);
          } catch (err) {
            console.error('[Tag Intelligence] Error in displayResults:', err);
            showError(t('reports.common.errorDisplayingResults', 'Error displaying results') + ': ' + err.message);
          }
          window.__REPORT_READY__ = true;
          window.dispatchEvent(new CustomEvent('report:ready'));
        }, 800);
      } else {
        try {
          displayResults(data);
        } catch (err) {
          console.error('[Tag Intelligence] Error in displayResults:', err);
          showError(t('reports.common.errorDisplayingResults', 'Error displaying results') + ': ' + err.message);
        }
        window.__REPORT_READY__ = true;
        window.dispatchEvent(new CustomEvent('report:ready'));
      }

    } catch (error) {
      if (loader) {
        loader.showError(error.message);
        setTimeout(() => {
          loadingContainer.style.display = 'none';
          showError(error.message);
        }, 2000);
      } else {
        showError(error.message);
      }
    } finally {
      analyzeButton.disabled = false;
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  // Pro preview helper functions (must be defined before displayResults)
  function ensureTagIntelligenceProStyles() {
    if (document.getElementById('tag-intelligence-pro-styles')) return;
    const style = document.createElement('style');
    style.id = 'tag-intelligence-pro-styles';
    style.textContent = `
      .pro-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(var(--accent-primary-rgb, 91, 244, 231), 0.4);
        background: rgba(var(--accent-primary-rgb, 91, 244, 231), 0.1);
        color: var(--accent-primary, #5bf4e7);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.05em;
      }
      .pro-locked {
        position: relative;
        border: 1px dashed rgba(var(--accent-primary-rgb, 91, 244, 231), 0.3);
        border-radius: 10px;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.02);
        overflow: hidden;
      }
      .pro-locked__header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
        font-weight: 600;
      }
      .pro-locked__list {
        margin: 0;
        padding-left: 1.25rem;
        color: #ccc;
        font-size: 0.9rem;
      }
      .pro-locked__blur {
        position: absolute;
        inset: 0;
        backdrop-filter: blur(3px);
        background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 60%);
        pointer-events: none;
      }
      .pro-locked__buttons {
        position: relative;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.75rem;
      }
      .pro-locked__unlock {
        position: relative;
        padding: 0.55rem 1rem;
        border-radius: 8px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .pro-locked__unlock--primary {
        border: none;
        background: linear-gradient(135deg, #5bf4e7, #0AFFEF);
        color: #000;
      }
      .pro-locked__unlock--primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(91, 244, 231, 0.4);
      }
      .pro-locked__unlock--secondary {
        border: 1px solid #5bf4e7;
        background: transparent;
        color: #5bf4e7;
      }
      .pro-locked__unlock--secondary:hover {
        background: rgba(91, 244, 231, 0.1);
      }
    `;
    document.head.appendChild(style);
  }

  // Expose paywall opener on window for onclick handlers
  window.safeOpenTagIntelligencePaywall = function() {
    try {
      if (typeof window.openProPaywall === 'function') {
        window.openProPaywall({ context: 'tag-intelligence' });
        return;
      }
      if (window.ProAccess && typeof window.ProAccess.openProPaywall === 'function') {
        window.ProAccess.openProPaywall({ context: 'tag-intelligence' });
        return;
      }
      if (window.PricingModal && typeof window.PricingModal.open === 'function') {
        window.PricingModal.open();
        return;
      }
    } catch (err) {
      console.warn('[Tag Intelligence] Could not open paywall:', err);
    }
  };

  function renderTagIntelligenceProPreview(recommendations) {
    ensureTagIntelligenceProStyles();

    const previewItems = recommendations && recommendations.length > 0
      ? recommendations.slice(0, 2).map(r => r.title || r.description?.substring(0, 50) + '...')
      : [t('reports.tagIntelligence.actionableRecommendations', 'Actionable optimization recommendations'), t('reports.tagIntelligence.prioritySteps', 'Priority-based remediation steps')];

    const recCount = recommendations?.length || 0;

    return `
      <div class="pro-locked" style="padding: 1rem;">
        <div class="pro-locked__header">
          <span class="pro-pill">PRO</span>
          <span>${t('reports.common.reportRecommendations', 'Recommendations')} (${recCount} ${t('reports.common.items', 'items')})</span>
        </div>
        <p style="color: #888; font-size: 0.9rem; margin: 0.5rem 0 1rem 0;">
          ${t('reports.tagIntelligence.unlockInsights', 'Unlock actionable insights and priority-based recommendations to optimize your tag implementation.')}
        </p>
        <ul class="pro-locked__list">
          ${previewItems.map(item => `<li>${item}</li>`).join('')}
          ${recCount > 2 ? `<li style="color: #666;">...${t('reports.common.andMore', 'and')} ${recCount - 2} ${t('reports.common.moreRecommendations', 'more recommendations')}</li>` : ''}
        </ul>
        <div class="pro-locked__blur"></div>
        <div class="pro-locked__buttons">
          <button class="pro-locked__unlock pro-locked__unlock--primary" data-buy-single-report data-context="tag-intelligence">${t('reports.common.unlockFor5', 'Unlock for $5')}</button>
          <button class="pro-locked__unlock pro-locked__unlock--secondary" data-open-pricing-modal data-context="tag-intelligence">${t('reports.common.goPro30', 'Go Pro — $30/mo')}</button>
        </div>
      </div>
    `;
  }

  function displayResults(data) {
    if (!data || typeof data !== 'object' || typeof data === 'string') { console.error('[TagIntelligence] displayResults received invalid data:', data); return; }
    // Check required components
    if (typeof ReportAccordion === 'undefined') {
      console.error('[Tag Intelligence] ReportAccordion is not defined');
      resultsContent.innerHTML = `<div style="color: red; padding: 2rem;">${t('reports.common.errorComponentsNotLoaded', 'Error: Report components not loaded. Please refresh the page.')}</div>`;
      return;
    }
    
    const url = document.getElementById('url') ? document.getElementById('url').value : (document.getElementById('urlInput') ? document.getElementById('urlInput').value : '');
    const timestamp = window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString();

    const scanStartedAt = data.scanStartedAt || window.SM_SCAN_STARTED_AT || new Date().toISOString();
    const analyzerKey = window.SM_ANALYZER_KEY || 'tag-intelligence';

    let reportId = null;
    if (window.ReportUI && typeof window.ReportUI.makeReportId === 'function') {
      reportId = window.ReportUI.makeReportId({
        analyzerKey,
        normalizedUrl: url,
        startedAtISO: scanStartedAt
      });
    } else if (window.ReportUI && typeof window.ReportUI.computeReportId === 'function') {
      reportId = window.ReportUI.computeReportId(url, scanStartedAt, analyzerKey);
    }

    if (reportId) {
      document.body.setAttribute('data-report-id', reportId);
      resultsContent.setAttribute('data-sm-report-id', reportId);
    }

    // Build screenshot URL for report display
    const screenshotUrl = data.screenshotUrl || (data.pageResults?.[0]?.screenshotUrl) || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');
    if (screenshotUrl) {
      document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
    }
    const screenshots = screenshotUrl ? [{ src: screenshotUrl, alt: `Screenshot of ${url}`, device: '' }] : [];

    // Build summary array for ReportContainer (score donuts)
    const summary = [
      { label: t('reports.common.overall', 'Overall'), score: data.healthScore }
    ];
    
    // Add category breakdown as summary items
    if (data.summary && data.summary.byCategory) {
      Object.entries(data.summary.byCategory).forEach(([cat, count]) => {
        // Calculate a score based on presence (just for visual display)
        summary.push({ label: formatCategory(cat), score: count > 0 ? Math.min(100, count * 20) : 0, count });
      });
    }

    // Build sections array for ReportContainer
    const sections = [];

    // Charts Section (rendered as a static section, not accordion)
    sections.push({
      id: 'charts-section',
      title: '📊 ' + t('reports.tagIntelligence.analyticsOverview', 'Analytics Overview'),
      contentHTML: `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 1rem;">
          <!-- Tags by Category Chart -->
          <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 8px;">
            <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #888;">${t('reports.tagIntelligence.tagsByCategory', 'Tags by Category')}</h4>
            <canvas id="tagsCategoryChart" style="max-height: 220px;"></canvas>
          </div>

          <!-- Script Loading Strategy Chart -->
          ${data.pageResults && data.pageResults[0]?.performanceImpact ? `
            <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 8px;">
              <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #888;">${t('reports.tagIntelligence.scriptLoadingStrategy', 'Script Loading Strategy')}</h4>
              <canvas id="scriptLoadingChart" style="max-height: 220px;"></canvas>
            </div>
          ` : ''}

          <!-- Third-Party Scripts Chart -->
          ${data.pageResults && data.pageResults[0]?.thirdPartyScripts?.total > 0 ? `
            <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 8px;">
              <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #888;">${t('reports.tagIntelligence.thirdPartyScripts', 'Third-Party Scripts')}</h4>
              <canvas id="thirdPartyChart" style="max-height: 220px;"></canvas>
            </div>
          ` : ''}
        </div>
      `
    });

    // Issues Alert Section
    if (data.issues.length > 0 || data.duplicates.length > 0) {
      sections.push({
        id: 'issues-detected',
        title: `⚠️ ${t('reports.tagIntelligence.issuesDetected', 'Issues Detected')} (${data.issues.length + data.duplicates.length})`,
        contentHTML: `
          <ul style="margin: 0; padding-left: 1.5rem;">
            ${data.duplicates.map(d => `<li class="severity-warning">${d.messageKey ? t('reports.' + d.messageKey, d.message) : d.message}</li>`).join('')}
            ${data.issues.map(i => `<li class="severity-${i.severity}">${i.messageKey ? t('reports.' + i.messageKey, i.message, i.messageParams) : i.message}</li>`).join('')}
          </ul>
        `
      });
    }

    // Tags Detected Section
    sections.push({
      id: 'tags-detected',
      title: `🏷️ ${t('reports.tagIntelligence.tagsDetected', 'Tags Detected')} (${data.tags.length})`,
      contentHTML: `
        <div style="padding: 1rem 0;">
          ${data.tags.length === 0 ? `<p style="color: #666;">${t('reports.tagIntelligence.noTagsDetected', 'No analytics or tracking tags detected.')}</p>` : ''}
          ${data.tags.map(tag => `
            <div class="tag-card" style="margin-bottom: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                  <span class="tag-badge tag-${tag.category}">${formatCategory(tag.category)}</span>
                  <strong>${tag.name}</strong>
                </div>
                <div style="color: #808080; font-size: 0.85rem;">
                  ${tag.instances} ${t('reports.tagIntelligence.instances', 'instance(s)')} • ${tag.pagesFound ? tag.pagesFound.length : 1} ${t('reports.tagIntelligence.pages', 'page(s)')}
                </div>
              </div>
              ${tag.ids && tag.ids.length > 0 ? `
                <div style="margin-top: 0.5rem; font-family: monospace; font-size: 0.85rem; color: #a78bfa;">
                  ${t('reports.tagIntelligence.ids', 'ID(s)')}: ${tag.ids.join(', ')}
                </div>
              ` : ''}
              <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #666;">
                ${tag.foundInline ? '📝 ' + t('reports.tagIntelligence.foundInline', 'Found inline') : ''}
                ${tag.foundScript ? '📜 ' + t('reports.tagIntelligence.foundInScriptSrc', 'Found in script src') : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `
    });

    // Tags by Category Section
    sections.push({
      id: 'tags-by-category',
      title: '📊 ' + t('reports.tagIntelligence.tagsByCategory', 'Tags by Category'),
      contentHTML: `
        <div style="padding: 1rem 0;">
          ${Object.entries(data.tagsByCategory).map(([category, tags]) => `
            <div style="margin-bottom: 2rem;">
              <h4 style="margin-bottom: 1rem;">
                <span class="tag-badge tag-${category}">${formatCategory(category)}</span>
                ${tags.length} ${t('reports.tagIntelligence.tags', 'Tag(s)')}
              </h4>
              <div style="display: grid; gap: 0.5rem;">
                ${tags.map(tagItem => `
                  <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 4px;">
                    <span>${tagItem.name}</span>
                    <span style="color: #666;">${tagItem.ids?.join(', ') || t('reports.common.notAvailable', 'N/A')}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `
    });

    // Performance Impact Section
    if (data.pageResults && data.pageResults[0]?.performanceImpact) {
      sections.push({
        id: 'performance-impact',
        title: '⚡ ' + t('reports.tagIntelligence.scriptPerformanceImpact', 'Script Performance Impact'),
        scoreTextRight: `${data.pageResults[0].performanceImpact.score}/100`,
        contentHTML: `
          <div style="padding: 1rem 0;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: bold; color: ${data.pageResults[0].performanceImpact.score >= 80 ? '#10b981' : data.pageResults[0].performanceImpact.score >= 60 ? '#f59e0b' : '#ef4444'};">
                  ${data.pageResults[0].performanceImpact.grade}
                </div>
                <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.performanceGrade', 'Performance Grade')}</div>
              </div>
              <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #3b82f6;">
                  ${data.pageResults[0].performanceImpact.stats?.syncScripts || 0}
                </div>
                <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.blockingScripts', 'Blocking Scripts')}</div>
              </div>
              <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #10b981;">
                  ${data.pageResults[0].performanceImpact.stats?.asyncScripts || 0}
                </div>
                <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.asyncScripts', 'Async Scripts')}</div>
              </div>
              <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #a78bfa;">
                  ${data.pageResults[0].performanceImpact.stats?.deferScripts || 0}
                </div>
                <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.deferredScripts', 'Deferred Scripts')}</div>
              </div>
            </div>
            ${data.pageResults[0].performanceImpact.issues?.length > 0 ? `
              <div style="margin-top: 1rem;">
                ${data.pageResults[0].performanceImpact.issues.map(issue => `
                  <div style="background: rgba(${issue.severity === 'warning' ? '239, 68, 68' : '59, 130, 246'}, 0.1); padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.85rem;">
                    ${issue.severity === 'warning' ? '⚠️' : 'ℹ️'} ${issue.message}
                  </div>
                `).join('')}
              </div>
            ` : ''}
            <p style="margin-top: 1rem; color: #888; font-size: 0.85rem;">💡 ${data.pageResults[0].performanceImpact.recommendation}</p>
          </div>
        `
      });
    }

    // Third-Party Scripts Section
    if (data.pageResults && data.pageResults[0]?.thirdPartyScripts?.total > 0) {
      sections.push({
        id: 'third-party-scripts',
        title: `🌐 ${t('reports.tagIntelligence.thirdPartyScripts', 'Third-Party Scripts')} (${data.pageResults[0].thirdPartyScripts.total})`,
        contentHTML: `
          <div style="padding: 1rem 0;">
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
              ${Object.entries(data.pageResults[0].thirdPartyScripts.byCategory || {}).map(([cat, count]) => `
                <span style="background: ${getCategoryColor(cat)}; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem;">
                  ${formatScriptCategory(cat)}: ${count}
                </span>
              `).join('')}
            </div>
            <div style="display: grid; gap: 0.5rem;">
              ${data.pageResults[0].thirdPartyScripts.scripts.slice(0, 10).map(script => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 4px; font-size: 0.85rem;">
                  <div>
                    <span style="color: #fff;">${script.name}</span>
                    <span style="color: #666; margin-left: 0.5rem;">${script.host}</span>
                  </div>
                  <div style="display: flex; gap: 0.5rem;">
                    ${script.async ? '<span style="background: #10b981; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.7rem;">async</span>' : ''}
                    ${script.defer ? '<span style="background: #3b82f6; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.7rem;">defer</span>' : ''}
                    ${!script.async && !script.defer ? '<span style="background: #ef4444; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.7rem;">blocking</span>' : ''}
                    <span style="color: #888;">×${script.count}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `
      });
    }

    // DataLayer Analysis Section
    if (data.pageResults && data.pageResults[0]?.dataLayer?.found) {
      sections.push({
        id: 'datalayer-analysis',
        title: '📊 ' + t('reports.tagIntelligence.dataLayerAnalysis', 'DataLayer Analysis'),
        contentHTML: `
          <div style="padding: 1rem 0;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div style="text-align: center; padding: 1rem; background: rgba(167, 139, 250, 0.1); border-radius: 8px;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #a78bfa;">
                  ${data.pageResults[0].dataLayer.eventCount || 0}
                </div>
                <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.eventsDetected', 'Events Detected')}</div>
              </div>
              <div style="text-align: center; padding: 1rem; background: rgba(${data.pageResults[0].dataLayer.ecommerce ? '16, 185, 129' : '100, 100, 100'}, 0.1); border-radius: 8px;">
                <div style="font-size: 1.5rem; font-weight: bold; color: ${data.pageResults[0].dataLayer.ecommerce ? '#10b981' : '#666'};">
                  ${data.pageResults[0].dataLayer.ecommerce ? '✓' : '✗'}
                </div>
                <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.ecommerceTracking', 'Ecommerce Tracking')}</div>
              </div>
            </div>
            ${data.pageResults[0].dataLayer.events?.length > 0 ? `
              <div style="margin-top: 1rem;">
                <div style="font-size: 0.85rem; color: #888; margin-bottom: 0.5rem;">${t('reports.tagIntelligence.eventsFound', 'Events Found')}:</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                  ${data.pageResults[0].dataLayer.events.map(event => `
                    <code style="background: rgba(167, 139, 250, 0.2); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${event}</code>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            ${data.pageResults[0].dataLayer.ecommerce ? `
              <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(16, 185, 129, 0.1); border-radius: 4px; font-size: 0.85rem;">
                🛒 <strong>${data.pageResults[0].dataLayer.ecommerce.type}</strong> ${t('reports.tagIntelligence.detected', 'detected')}
              </div>
            ` : ''}
          </div>
        `
      });
    }

    // Consent Mode Section
    if (data.pageResults && data.pageResults[0]?.consentMode) {
      sections.push({
        id: 'consent-mode',
        title: '🍪 ' + t('reports.tagIntelligence.consentMode', 'Consent Mode'),
        contentHTML: `
          <div style="padding: 1rem 0;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
              <div style="width: 60px; height: 60px; border-radius: 50%; background: ${data.pageResults[0].consentMode.implemented ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                ${data.pageResults[0].consentMode.implemented ? '✓' : '✗'}
              </div>
              <div>
                <div style="font-weight: bold; color: ${data.pageResults[0].consentMode.implemented ? '#10b981' : '#ef4444'};">
                  ${data.pageResults[0].consentMode.implemented ? t('reports.tagIntelligence.consentModeDetected', 'Consent Mode Detected') : t('reports.tagIntelligence.consentModeNotDetected', 'Consent Mode Not Detected')}
                </div>
                <div style="font-size: 0.85rem; color: #888;">${data.pageResults[0].consentMode.recommendation}</div>
              </div>
            </div>
          </div>
        `
      });
    }

    // Cookie Audit Section
    if (data.pageResults && data.pageResults[0]?.cookies?.count > 0) {
      sections.push({
        id: 'cookie-audit',
        title: `🍪 ${t('reports.tagIntelligence.cookieAudit', 'Cookie Audit')} (${data.pageResults[0].cookies.count})`,
        scoreTextRight: `${data.pageResults[0].cookies.complianceScore}/100`,
        contentHTML: `
          <div style="padding: 1rem 0;">
            <!-- Cookie Compliance Score -->
            <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1.5rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
              <div style="text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: ${getScoreColor(data.pageResults[0].cookies.complianceScore || 100)};">
                  ${data.pageResults[0].cookies.complianceScore || 100}
                </div>
                <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.complianceScore', 'Compliance Score')}</div>
              </div>
              <div style="flex: 1;">
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                  ${Object.entries(data.pageResults[0].cookies.summary || {}).map(([type, count]) => count > 0 ? `
                    <span style="background: ${getCookieTypeColor(type)}; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem;">
                      ${formatCookieType(type)}: ${count}
                    </span>
                  ` : '').join('')}
                </div>
              </div>
            </div>

            <!-- Cookie Issues -->
            ${data.pageResults[0].cookies.issues?.length > 0 ? `
              <div style="margin-bottom: 1rem;">
                ${data.pageResults[0].cookies.issues.map(issue => `
                  <div style="background: rgba(${issue.severity === 'high' ? '239, 68, 68' : '245, 158, 11'}, 0.1); padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.85rem; border-left: 3px solid ${issue.severity === 'high' ? '#ef4444' : '#f59e0b'};">
                    <strong>${issue.severity === 'high' ? '⚠️' : '⚡'} ${issue.message}</strong>
                    <p style="margin: 0.25rem 0 0 0; color: #888;">${issue.recommendation}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <!-- Cookie List -->
            <div style="max-height: 400px; overflow-y: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                <thead style="position: sticky; top: 0; background: #1a1a1a;">
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <th style="text-align: left; padding: 0.5rem; color: #888;">${t('reports.tagIntelligence.cookieName', 'Name')}</th>
                    <th style="text-align: left; padding: 0.5rem; color: #888;">${t('reports.tagIntelligence.cookieType', 'Type')}</th>
                    <th style="text-align: left; padding: 0.5rem; color: #888;">${t('reports.tagIntelligence.cookieVendor', 'Vendor')}</th>
                    <th style="text-align: left; padding: 0.5rem; color: #888;">${t('reports.tagIntelligence.cookiePurpose', 'Purpose')}</th>
                    <th style="text-align: center; padding: 0.5rem; color: #888;">${t('reports.tagIntelligence.cookieSecure', 'Secure')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.pageResults[0].cookies.cookies.slice(0, 30).map(cookie => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                      <td style="padding: 0.5rem; font-family: monospace; color: #a78bfa;">${cookie.name.substring(0, 25)}${cookie.name.length > 25 ? '...' : ''}</td>
                      <td style="padding: 0.5rem;"><span style="background: ${getCookieTypeColor(cookie.type)}; padding: 0.15rem 0.5rem; border-radius: 3px; font-size: 0.7rem;">${cookie.type}</span></td>
                      <td style="padding: 0.5rem; color: #ccc;">${cookie.vendor || t('reports.tagIntelligence.unknown', 'Unknown')}</td>
                      <td style="padding: 0.5rem; color: #888; font-size: 0.75rem;">${cookie.purpose || '-'}</td>
                      <td style="padding: 0.5rem; text-align: center;">${cookie.hasSecure ? '✓' : '✗'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              ${data.pageResults[0].cookies.cookies.length > 30 ? `<p style="color: #888; font-size: 0.8rem; margin-top: 0.5rem;">... ${t('reports.common.andMore', 'and')} ${data.pageResults[0].cookies.cookies.length - 30} ${t('reports.tagIntelligence.moreCookies', 'more cookies')}</p>` : ''}
            </div>
          </div>
        `
      });
    }

    // Tag Load Waterfall Section
    if (data.pageResults && data.pageResults[0]?.tagLoadWaterfall?.scripts?.length > 0) {
      sections.push({
        id: 'tag-waterfall',
        title: `⏱️ ${t('reports.tagIntelligence.tagLoadWaterfall', 'Tag Load Waterfall')} (${data.pageResults[0].tagLoadWaterfall.totalScripts} ${t('reports.tagIntelligence.scripts', 'scripts')})`,
        contentHTML: `
          <div style="padding: 1rem 0;">
            <!-- Waterfall Stats -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
              <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #3b82f6;">${data.pageResults[0].tagLoadWaterfall.totalLoadTime}ms</div>
                <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.totalLoadTime', 'Total Load Time')}</div>
              </div>
              <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #10b981;">${data.pageResults[0].tagLoadWaterfall.totalSizeFormatted}</div>
                <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.totalSize', 'Total Size')}</div>
              </div>
              <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <div style="font-size: 1.5rem; font-weight: bold; color: ${data.pageResults[0].tagLoadWaterfall.blockingCount > 5 ? '#ef4444' : '#10b981'};">${data.pageResults[0].tagLoadWaterfall.blockingCount}</div>
                <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.blockingScripts', 'Blocking Scripts')}</div>
              </div>
            </div>

            <!-- Insights -->
            ${data.pageResults[0].tagLoadWaterfall.insights?.length > 0 ? `
              <div style="margin-bottom: 1.5rem;">
                ${data.pageResults[0].tagLoadWaterfall.insights.map(insight => `
                  <div style="background: rgba(${insight.type === 'warning' ? '245, 158, 11' : insight.type === 'good' ? '16, 185, 129' : '59, 130, 246'}, 0.1); padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.85rem;">
                    ${insight.type === 'warning' ? '⚠️' : insight.type === 'good' ? '✅' : 'ℹ️'} ${insight.message}
                    ${insight.recommendation ? `<span style="color: #888;"> - ${insight.recommendation}</span>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <!-- Waterfall Visualization -->
            <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem; overflow-x: auto;">
              <div style="min-width: 600px;">
                ${data.pageResults[0].tagLoadWaterfall.scripts.slice(0, 20).map(script => `
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.75rem;">
                    <div style="width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ccc;" title="${script.vendor}">${script.vendor}</div>
                    <div style="flex: 1; height: 20px; background: rgba(255,255,255,0.05); border-radius: 3px; position: relative; overflow: hidden;">
                      <div style="
                        position: absolute;
                        left: ${(script.startTime / data.pageResults[0].tagLoadWaterfall.totalLoadTime) * 100}%;
                        width: ${Math.max((script.duration / data.pageResults[0].tagLoadWaterfall.totalLoadTime) * 100, 2)}%;
                        height: 100%;
                        background: ${getWaterfallColor(script.category)};
                        border-radius: 3px;
                      " title="${script.vendor}: ${script.duration}ms"></div>
                    </div>
                    <div style="width: 60px; text-align: right; color: #888;">${script.duration}ms</div>
                    <div style="width: 50px; text-align: right; color: #666;">${script.sizeFormatted}</div>
                  </div>
                `).join('')}
              </div>

              <!-- Legend -->
              <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                <span style="font-size: 0.7rem; color: #888;"><span style="display: inline-block; width: 12px; height: 12px; background: #3b82f6; border-radius: 2px; margin-right: 4px;"></span>${t('reports.tagIntelligence.categories.analytics', 'Analytics')}</span>
                <span style="font-size: 0.7rem; color: #888;"><span style="display: inline-block; width: 12px; height: 12px; background: #f59e0b; border-radius: 2px; margin-right: 4px;"></span>${t('reports.tagIntelligence.categories.advertising', 'Advertising')}</span>
                <span style="font-size: 0.7rem; color: #888;"><span style="display: inline-block; width: 12px; height: 12px; background: #ec4899; border-radius: 2px; margin-right: 4px;"></span>${t('reports.tagIntelligence.categories.sessionRecording', 'Session Recording')}</span>
                <span style="font-size: 0.7rem; color: #888;"><span style="display: inline-block; width: 12px; height: 12px; background: #8b5cf6; border-radius: 2px; margin-right: 4px;"></span>${t('reports.tagIntelligence.categories.abTesting', 'A/B Testing')}</span>
                <span style="font-size: 0.7rem; color: #888;"><span style="display: inline-block; width: 12px; height: 12px; background: #6b7280; border-radius: 2px; margin-right: 4px;"></span>${t('reports.tagIntelligence.categories.other', 'Other')}</span>
              </div>
            </div>
          </div>
        `
      });
    }

    // Report and Recommendations Section (Free)
    sections.push({
      id: 'report-recommendations',
      title: '📋 ' + t('reports.common.reportAndRecommendations', 'Recommendations'),
      isPro: false,
      locked: false,
      context: 'tag-intelligence',
      reportId: reportId,
      contentHTML: renderTagIntelligenceRecommendations(data.recommendations)
    });

    // Use ReportContainer.create() for consistent header styling
    const reportHTML = (window.ReportContainer && typeof window.ReportContainer.create === 'function')
      ? window.ReportContainer.create({
          url: url,
          timestamp: scanStartedAt,
          mode: 'tag-intelligence',
          title: t('reports.tagIntelligence.title', 'Tracking & Analytics: Tag Intelligence'),
          subtitle: t('reports.tagIntelligence.scannedPagesAndTags', 'Scanned {{pages}} page(s) • {{tags}} tag(s) detected', { pages: data.pagesScanned, tags: data.summary.totalTags }),
          summary: [{ label: t('reports.common.overall', 'Overall'), score: data.healthScore }],
          sections,
          screenshots,
          proBlock: true,
          proBlockOptions: {
            context: 'tag-intelligence',
            features: ['pdf', 'excel', 'csv', 'share'],
            title: t('reports.common.unlockReport', 'Unlock Report'),
            subtitle: t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.'),
            reportId
          }
        })
      : `<h2>${t('reports.tagIntelligence.results', 'Tag Analysis Results')}</h2><p>${t('reports.common.reportContainerNotAvailable', 'ReportContainer not available')}</p>`;

    resultsContent.innerHTML = '<div class="report-scope">' + reportHTML + '</div>';

    // Initialize ReportAccordion interactions
    if (window.ReportAccordion && typeof window.ReportAccordion.initInteractions === 'function') {
      window.ReportAccordion.initInteractions();
    }

    if (window.ReportUI && reportId) {
      window.ReportUI.setCurrentReportId(reportId);
    }
    
    // Render charts after DOM is updated
    setTimeout(() => renderCharts(data), 100);
  }

  /**
   * Render recommendations content (free, not locked)
   */
  function renderTagIntelligenceRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) {
      return `
        <div style="padding: 1rem; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px;">
          <p style="margin: 0; color: #22c55e;">✓ ${t('reports.tagIntelligence.noIssuesFound', 'No issues found. Your tag setup looks good!')}</p>
        </div>
      `;
    }
    
    return `
      <div style="display: grid; gap: 1rem;">
        ${recommendations.map(rec => `
          <div style="background: var(--bg-tertiary); border: 1px solid var(--border-primary); border-radius: 8px; padding: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <span style="font-size: 1.2rem;">${rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢'}</span>
              <strong>${rec.titleKey ? t('reports.' + rec.titleKey, rec.title || rec.message || '') : (rec.title || rec.message || t('reports.common.recommendation', 'Recommendation'))}</strong>
            </div>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">${rec.descriptionKey ? t('reports.' + rec.descriptionKey, rec.description || rec.details || '', rec.descriptionParams) : (rec.description || rec.details || '')}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render Chart.js charts
   */
  function renderCharts(data) {
    const chartColors = {
      analytics: '#3b82f6',
      advertising: '#f59e0b',
      tag_manager: '#8b5cf6',
      consent: '#10b981',
      customer_support: '#ec4899',
      marketing: '#ef4444',
      other: '#6b7280'
    };

    // Tags by Category Doughnut Chart
    const categoryCanvas = document.getElementById('tagsCategoryChart');
    if (categoryCanvas && data.summary?.byCategory) {
      const categories = Object.keys(data.summary.byCategory);
      const counts = Object.values(data.summary.byCategory);
      
      new Chart(categoryCanvas, {
        type: 'doughnut',
        data: {
          labels: categories.map(c => formatCategory(c)),
          datasets: [{
            data: counts,
            backgroundColor: categories.map(c => chartColors[c] || '#6b7280'),
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#888',
                padding: 10,
                font: { size: 11 }
              }
            }
          },
          cutout: '60%'
        }
      });
    }

    // Script Loading Strategy Pie Chart
    const scriptCanvas = document.getElementById('scriptLoadingChart');
    if (scriptCanvas && data.pageResults?.[0]?.performanceImpact?.stats) {
      const stats = data.pageResults[0].performanceImpact.stats;
      
      new Chart(scriptCanvas, {
        type: 'pie',
        data: {
          labels: [t('reports.tagIntelligence.scriptTypes.async', 'Async'), t('reports.tagIntelligence.scriptTypes.deferred', 'Deferred'), t('reports.tagIntelligence.scriptTypes.blocking', 'Blocking'), t('reports.tagIntelligence.scriptTypes.inline', 'Inline')],
          datasets: [{
            data: [stats.asyncScripts, stats.deferScripts, stats.syncScripts, stats.inlineScripts],
            backgroundColor: ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#888',
                padding: 10,
                font: { size: 11 }
              }
            }
          }
        }
      });
    }

    // Third-Party Scripts Bar Chart
    const thirdPartyCanvas = document.getElementById('thirdPartyChart');
    if (thirdPartyCanvas && data.pageResults?.[0]?.thirdPartyScripts?.byCategory) {
      const byCategory = data.pageResults[0].thirdPartyScripts.byCategory;
      const categories = Object.keys(byCategory);
      const counts = Object.values(byCategory);
      
      const categoryColors = {
        analytics: '#a78bfa',
        advertising: '#ef4444',
        cdn: '#3b82f6',
        library: '#10b981',
        unknown: '#6b7280'
      };
      
      new Chart(thirdPartyCanvas, {
        type: 'bar',
        data: {
          labels: categories.map(c => formatScriptCategory(c).replace(/[^\w\s]/g, '').trim()),
          datasets: [{
            data: counts,
            backgroundColor: categories.map(c => categoryColors[c] || '#6b7280'),
            borderRadius: 4,
            barThickness: 24
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          indexAxis: 'y',
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { color: '#888', stepSize: 1 },
              grid: { color: 'rgba(255,255,255,0.05)' }
            },
            y: {
              ticks: { color: '#888' },
              grid: { display: false }
            }
          }
        }
      });
    }
  }

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

  function formatCategory(category) {
    const labels = {
      analytics: t('reports.tagIntelligence.categories.analytics', 'Analytics'),
      advertising: t('reports.tagIntelligence.categories.advertising', 'Advertising'),
      tag_manager: t('reports.tagIntelligence.categories.tagManager', 'Tag Manager'),
      consent: t('reports.tagIntelligence.categories.consent', 'Consent'),
      customer_support: t('reports.tagIntelligence.categories.support', 'Support'),
      marketing: t('reports.tagIntelligence.categories.marketing', 'Marketing'),
      ab_testing: t('reports.tagIntelligence.categories.abTesting', 'A/B Testing'),
      session_recording: t('reports.tagIntelligence.categories.sessionRecording', 'Session Recording'),
      error_monitoring: t('reports.tagIntelligence.categories.errorMonitoring', 'Error Monitoring'),
      cdp: t('reports.tagIntelligence.categories.cdp', 'CDP'),
      other: t('reports.tagIntelligence.categories.other', 'Other')
    };
    return labels[category] || category;
  }

  function formatScriptCategory(category) {
    const labels = {
      analytics: '📊 ' + t('reports.tagIntelligence.categories.analytics', 'Analytics'),
      advertising: '📢 ' + t('reports.tagIntelligence.categories.advertising', 'Advertising'),
      cdn: '🌐 ' + t('reports.tagIntelligence.categories.cdn', 'CDN'),
      library: '📚 ' + t('reports.tagIntelligence.categories.library', 'Library'),
      unknown: '❓ ' + t('reports.tagIntelligence.categories.other', 'Other')
    };
    return labels[category] || category;
  }

  function getCategoryColor(category) {
    const colors = {
      analytics: 'rgba(167, 139, 250, 0.3)',
      advertising: 'rgba(239, 68, 68, 0.3)',
      cdn: 'rgba(59, 130, 246, 0.3)',
      library: 'rgba(16, 185, 129, 0.3)',
      unknown: 'rgba(100, 100, 100, 0.3)'
    };
    return colors[category] || 'rgba(100, 100, 100, 0.3)';
  }

  /**
   * Get color for cookie type badges
   */
  function getCookieTypeColor(type) {
    const colors = {
      necessary: 'rgba(16, 185, 129, 0.3)',
      analytics: 'rgba(59, 130, 246, 0.3)',
      advertising: 'rgba(239, 68, 68, 0.3)',
      functional: 'rgba(167, 139, 250, 0.3)',
      marketing: 'rgba(245, 158, 11, 0.3)',
      unknown: 'rgba(100, 100, 100, 0.3)'
    };
    return colors[type] || colors.unknown;
  }

  /**
   * Format cookie type for display
   */
  function formatCookieType(type) {
    const labels = {
      necessary: t('reports.tagIntelligence.cookieTypes.essential', 'Essential'),
      analytics: t('reports.tagIntelligence.cookieTypes.analytics', 'Analytics'),
      advertising: t('reports.tagIntelligence.cookieTypes.advertising', 'Advertising'),
      functional: t('reports.tagIntelligence.cookieTypes.functional', 'Functional'),
      marketing: t('reports.tagIntelligence.cookieTypes.marketing', 'Marketing'),
      unknown: t('reports.tagIntelligence.cookieTypes.unknown', 'Unknown')
    };
    return labels[type] || type;
  }

  /**
   * Get color for waterfall chart bars
   */
  function getWaterfallColor(category) {
    const colors = {
      analytics: '#3b82f6',
      advertising: '#f59e0b',
      session_recording: '#ec4899',
      ab_testing: '#8b5cf6',
      consent: '#10b981',
      customer_support: '#06b6d4',
      marketing: '#ef4444',
      error_monitoring: '#f97316',
      cdp: '#14b8a6',
      other: '#6b7280'
    };
    return colors[category] || colors.other;
  }

  /**
   * Render A/B Testing & Session Recording section with enhanced details
   */
  function renderABTestingSection(data) {
    // Collect A/B testing and session recording tags
    const abTags = data.tags?.filter(t => t.category === 'ab_testing') || [];
    const sessionTags = data.tags?.filter(t => t.category === 'session_recording') || [];
    const errorTags = data.tags?.filter(t => t.category === 'error_monitoring') || [];
    const cdpTags = data.tags?.filter(t => t.category === 'cdp') || [];

    const totalCount = abTags.length + sessionTags.length + errorTags.length + cdpTags.length;

    if (totalCount === 0) {
      return '';
    }

    // Get screenshot if available
    const screenshotUrl = data.pageResults?.[0]?.screenshotUrl || data.screenshotUrl;

    // Tool information database for enhanced details
    const toolInfo = {
      'Google Optimize': { icon: '🎯', features: ['Visual Editor', 'Multivariate', 'Personalization'], docs: 'https://support.google.com/optimize' },
      'Optimizely': { icon: '🔬', features: ['Feature Flags', 'Full Stack', 'Web Experimentation'], docs: 'https://docs.optimizely.com' },
      'VWO': { icon: '📊', features: ['A/B Testing', 'Heatmaps', 'Session Recording'], docs: 'https://vwo.com/knowledge' },
      'AB Tasty': { icon: '🧪', features: ['A/B Testing', 'Personalization', 'AI-Powered'], docs: 'https://www.abtasty.com/resources/' },
      'Convert': { icon: '⚡', features: ['A/B Testing', 'Multivariate', 'Split URL'], docs: 'https://www.convert.com/support/' },
      'Hotjar': { icon: '🔥', features: ['Heatmaps', 'Recordings', 'Feedback'], docs: 'https://help.hotjar.com' },
      'FullStory': { icon: '📹', features: ['Session Replay', 'Funnels', 'Error Tracking'], docs: 'https://help.fullstory.com' },
      'Mouseflow': { icon: '🖱️', features: ['Heatmaps', 'Recordings', 'Form Analytics'], docs: 'https://mouseflow.com/docs/' },
      'Lucky Orange': { icon: '🍊', features: ['Recordings', 'Heatmaps', 'Chat'], docs: 'https://help.luckyorange.com' },
      'Clarity': { icon: '🔍', features: ['Heatmaps', 'Recordings', 'Insights'], docs: 'https://clarity.microsoft.com/docs' },
      'Heap': { icon: '📈', features: ['Auto-capture', 'Analytics', 'Paths'], docs: 'https://help.heap.io' },
      'Mixpanel': { icon: '📉', features: ['Event Analytics', 'Funnels', 'Cohorts'], docs: 'https://developer.mixpanel.com' },
      'Amplitude': { icon: '📊', features: ['Product Analytics', 'Experiments', 'CDP'], docs: 'https://help.amplitude.com' },
      'Segment': { icon: '🔄', features: ['Data Collection', 'Integrations', 'Protocols'], docs: 'https://segment.com/docs/' },
      'Sentry': { icon: '🐛', features: ['Error Tracking', 'Performance', 'Releases'], docs: 'https://docs.sentry.io' },
      'LogRocket': { icon: '🚀', features: ['Session Replay', 'Error Tracking', 'Performance'], docs: 'https://docs.logrocket.com' }
    };

    const getToolDetails = (tagName) => {
      const normalizedName = Object.keys(toolInfo).find(key =>
        tagName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(tagName.toLowerCase())
      );
      return toolInfo[normalizedName] || { icon: '🔧', features: [], docs: null };
    };

    return ReportAccordion.createSection({
      id: 'ab-session-tools',
      title: `🧪 ${t('reports.tagIntelligence.abTestingAndSessionRecording', 'A/B Testing & Session Recording')} (${totalCount})`,
      contentHTML: `
      <div style="padding: 1rem 0;">
        <!-- Screenshot Preview (if available) -->
        ${screenshotUrl ? `
          <div style="margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 0.75rem 0; color: #888; font-size: 0.85rem;">📸 ${t('reports.tagIntelligence.pagePreview', 'Page Preview')}</h4>
            <div style="position: relative; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
              <img src="${screenshotUrl}" alt="${t('reports.tagIntelligence.pageScreenshot', 'Page screenshot')}" style="width: 100%; max-height: 200px; object-fit: cover; object-position: top; cursor: pointer;" data-action="open-lightbox" data-screenshot-url="${screenshotUrl}" data-screenshot-title="${t('reports.tagIntelligence.pageScreenshot', 'Page Screenshot')}" />
              <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 0.5rem; background: linear-gradient(transparent, rgba(0,0,0,0.8)); font-size: 0.75rem; color: #888;">
                ${t('reports.tagIntelligence.clickToEnlarge', 'Click to enlarge')} • ${t('reports.tagIntelligence.toolsRunOnThisPage', 'Tools run on this page')}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Implementation Summary -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="text-align: center; padding: 1rem; background: rgba(139, 92, 246, 0.1); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.2);">
            <div style="font-size: 1.75rem; font-weight: bold; color: #8b5cf6;">${abTags.length}</div>
            <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.categories.abTesting', 'A/B Testing')}</div>
          </div>
          <div style="text-align: center; padding: 1rem; background: rgba(236, 72, 153, 0.1); border-radius: 8px; border: 1px solid rgba(236, 72, 153, 0.2);">
            <div style="font-size: 1.75rem; font-weight: bold; color: #ec4899;">${sessionTags.length}</div>
            <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.categories.sessionRecording', 'Session Recording')}</div>
          </div>
          <div style="text-align: center; padding: 1rem; background: rgba(249, 115, 22, 0.1); border-radius: 8px; border: 1px solid rgba(249, 115, 22, 0.2);">
            <div style="font-size: 1.75rem; font-weight: bold; color: #f97316;">${errorTags.length}</div>
            <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.categories.errorMonitoring', 'Error Monitoring')}</div>
          </div>
          <div style="text-align: center; padding: 1rem; background: rgba(20, 184, 166, 0.1); border-radius: 8px; border: 1px solid rgba(20, 184, 166, 0.2);">
            <div style="font-size: 1.75rem; font-weight: bold; color: #14b8a6;">${cdpTags.length}</div>
            <div style="font-size: 0.75rem; color: #888;">${t('reports.tagIntelligence.categories.dataPlatforms', 'Data Platforms')}</div>
          </div>
        </div>

        <!-- A/B Testing Tools (Enhanced) -->
        ${abTags.length > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 0.75rem 0; color: #8b5cf6; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
              🧪 ${t('reports.tagIntelligence.abTestingTools', 'A/B Testing Tools')}
              <span style="background: rgba(139, 92, 246, 0.2); padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.7rem;">${abTags.length}</span>
            </h4>
            <div style="display: grid; gap: 0.75rem;">
              ${abTags.map(tag => {
                const details = getToolDetails(tag.name);
                return `
                <div style="padding: 1rem; background: rgba(139, 92, 246, 0.08); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.2);">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.25rem;">${details.icon}</span>
                      <strong style="color: #fff;">${tag.name}</strong>
                      ${tag.ids?.length ? `<code style="background: rgba(139, 92, 246, 0.3); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.7rem; color: #a78bfa;">${tag.ids[0]}</code>` : ''}
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      <span style="background: #10b981; color: #000; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.65rem; font-weight: 600;">${t('reports.tagIntelligence.status.active', 'ACTIVE')}</span>
                      <span style="color: #888; font-size: 0.8rem;">${tag.instances}×</span>
                    </div>
                  </div>
                  ${details.features.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem;">
                      ${details.features.map(f => `<span style="background: rgba(139, 92, 246, 0.15); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; color: #c4b5fd;">${f}</span>`).join('')}
                    </div>
                  ` : ''}
                  ${tag.foundIn ? `<div style="margin-top: 0.5rem; font-size: 0.75rem; color: #666;">${t('reports.tagIntelligence.found', 'Found')}: ${tag.foundIn.join(', ')}</div>` : ''}
                </div>
              `}).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Session Recording Tools (Enhanced) -->
        ${sessionTags.length > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 0.75rem 0; color: #ec4899; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
              🎥 ${t('reports.tagIntelligence.sessionRecordingAndHeatmaps', 'Session Recording & Heatmaps')}
              <span style="background: rgba(236, 72, 153, 0.2); padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.7rem;">${sessionTags.length}</span>
            </h4>
            <div style="display: grid; gap: 0.75rem;">
              ${sessionTags.map(tag => {
                const details = getToolDetails(tag.name);
                return `
                <div style="padding: 1rem; background: rgba(236, 72, 153, 0.08); border-radius: 8px; border: 1px solid rgba(236, 72, 153, 0.2);">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.25rem;">${details.icon}</span>
                      <strong style="color: #fff;">${tag.name}</strong>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      <span style="background: #10b981; color: #000; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.65rem; font-weight: 600;">${t('reports.tagIntelligence.status.recording', 'RECORDING')}</span>
                      <span style="color: #888; font-size: 0.8rem;">${tag.instances}×</span>
                    </div>
                  </div>
                  ${details.features.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem;">
                      ${details.features.map(f => `<span style="background: rgba(236, 72, 153, 0.15); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; color: #f9a8d4;">${f}</span>`).join('')}
                    </div>
                  ` : ''}
                </div>
              `}).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Error Monitoring Tools (Enhanced) -->
        ${errorTags.length > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 0.75rem 0; color: #f97316; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
              🐛 ${t('reports.tagIntelligence.categories.errorMonitoring', 'Error Monitoring')}
              <span style="background: rgba(249, 115, 22, 0.2); padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.7rem;">${errorTags.length}</span>
            </h4>
            <div style="display: grid; gap: 0.75rem;">
              ${errorTags.map(tag => {
                const details = getToolDetails(tag.name);
                return `
                <div style="padding: 1rem; background: rgba(249, 115, 22, 0.08); border-radius: 8px; border: 1px solid rgba(249, 115, 22, 0.2);">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.25rem;">${details.icon}</span>
                      <strong style="color: #fff;">${tag.name}</strong>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      <span style="background: #3b82f6; color: #fff; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.65rem; font-weight: 600;">${t('reports.tagIntelligence.status.monitoring', 'MONITORING')}</span>
                      <span style="color: #888; font-size: 0.8rem;">${tag.instances}×</span>
                    </div>
                  </div>
                  ${details.features.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem;">
                      ${details.features.map(f => `<span style="background: rgba(249, 115, 22, 0.15); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; color: #fdba74;">${f}</span>`).join('')}
                    </div>
                  ` : ''}
                </div>
              `}).join('')}
            </div>
          </div>
        ` : ''}

        <!-- CDP Tools (Enhanced) -->
        ${cdpTags.length > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 0.75rem 0; color: #14b8a6; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
              🔄 ${t('reports.tagIntelligence.customerDataPlatforms', 'Customer Data Platforms')}
              <span style="background: rgba(20, 184, 166, 0.2); padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.7rem;">${cdpTags.length}</span>
            </h4>
            <div style="display: grid; gap: 0.75rem;">
              ${cdpTags.map(tag => {
                const details = getToolDetails(tag.name);
                return `
                <div style="padding: 1rem; background: rgba(20, 184, 166, 0.08); border-radius: 8px; border: 1px solid rgba(20, 184, 166, 0.2);">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.25rem;">${details.icon}</span>
                      <strong style="color: #fff;">${tag.name}</strong>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      <span style="background: #14b8a6; color: #000; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.65rem; font-weight: 600;">${t('reports.tagIntelligence.status.collecting', 'COLLECTING')}</span>
                      <span style="color: #888; font-size: 0.8rem;">${tag.instances}×</span>
                    </div>
                  </div>
                  ${details.features.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem;">
                      ${details.features.map(f => `<span style="background: rgba(20, 184, 166, 0.15); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; color: #5eead4;">${f}</span>`).join('')}
                    </div>
                  ` : ''}
                </div>
              `}).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Integration & Performance Tips -->
        <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 1rem; margin-top: 1rem;">
          <h4 style="margin: 0 0 0.75rem 0; color: #3b82f6; font-size: 0.9rem;">💡 ${t('reports.tagIntelligence.optimizationInsights', 'Optimization Insights')}</h4>
          <div style="display: grid; gap: 0.5rem; font-size: 0.85rem; color: #ccc;">
            ${abTags.length > 1 ? `
              <div style="display: flex; align-items: start; gap: 0.5rem;">
                <span style="color: #f59e0b;">⚠️</span>
                <span><strong>${t('reports.tagIntelligence.insights.multipleAbTools', 'Multiple A/B tools detected')}:</strong> ${t('reports.tagIntelligence.insights.consolidateTools', 'Consider consolidating to {{tool}} to reduce page weight and avoid test conflicts.', { tool: abTags[0]?.name || t('reports.tagIntelligence.insights.onePlatform', 'one platform') })}</span>
              </div>
            ` : ''}
            ${sessionTags.length > 0 && abTags.length > 0 ? `
              <div style="display: flex; align-items: start; gap: 0.5rem;">
                <span style="color: #10b981;">✓</span>
                <span><strong>${t('reports.tagIntelligence.insights.greatCombo', 'Great combo')}:</strong> ${t('reports.tagIntelligence.insights.sessionPlusAb', 'Session recordings + A/B testing allows you to see exactly how users interact with test variants.')}</span>
              </div>
            ` : ''}
            ${sessionTags.length > 0 && abTags.length === 0 ? `
              <div style="display: flex; align-items: start; gap: 0.5rem;">
                <span style="color: #3b82f6;">💡</span>
                <span><strong>${t('reports.tagIntelligence.insights.opportunity', 'Opportunity')}:</strong> ${t('reports.tagIntelligence.insights.addAbTesting', 'You have session recordings but no A/B testing. Consider adding experimentation to optimize based on behavioral insights.')}</span>
              </div>
            ` : ''}
            ${sessionTags.length === 0 && abTags.length > 0 ? `
              <div style="display: flex; align-items: start; gap: 0.5rem;">
                <span style="color: #3b82f6;">💡</span>
                <span><strong>${t('reports.tagIntelligence.insights.opportunity', 'Opportunity')}:</strong> ${t('reports.tagIntelligence.insights.addSessionRecording', 'Add session recording to see how users interact with your A/B test variants.')}</span>
              </div>
            ` : ''}
            ${errorTags.length > 0 ? `
              <div style="display: flex; align-items: start; gap: 0.5rem;">
                <span style="color: #10b981;">✓</span>
                <span><strong>${t('reports.tagIntelligence.insights.errorTrackingActive', 'Error tracking active')}:</strong> ${t('reports.tagIntelligence.insights.errorTrackingDesc', 'JavaScript errors are being monitored - essential for catching issues with experiments.')}</span>
              </div>
            ` : ''}
            ${cdpTags.length > 0 ? `
              <div style="display: flex; align-items: start; gap: 0.5rem;">
                <span style="color: #10b981;">✓</span>
                <span><strong>${t('reports.tagIntelligence.insights.cdpIntegration', 'CDP integration')}:</strong> ${t('reports.tagIntelligence.insights.cdpIntegrationDesc', 'Customer data is being unified - enables better targeting for experiments.')}</span>
              </div>
            ` : ''}
            ${totalCount <= 2 ? `
              <div style="display: flex; align-items: start; gap: 0.5rem;">
                <span style="color: #10b981;">✓</span>
                <span><strong>${t('reports.tagIntelligence.insights.leanStack', 'Lean stack')}:</strong> ${t('reports.tagIntelligence.insights.leanStackDesc', 'Minimal tool overhead helps maintain good page performance.')}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `});
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
      background: rgba(0, 255, 65, 0.05);
      border: 1px solid rgba(0, 255, 65, 0.3);
      border-radius: 6px;
      text-align: center;
      overflow: visible;
    `;
    patienceEl.innerHTML = `
      <div style="overflow-x: auto; overflow-y: visible;">
        <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: #00ff41; font-family: monospace; text-shadow: 2px 2px 0px rgba(0, 255, 65, 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
      </div>
      <div style="margin-top: 0.75rem; font-size: 0.85rem; color: #00ff41;">
        🏷️ ${t('loader.detectingAnalyticsAndTracking', 'Detecting analytics and tracking tags...')}<br>
        <span style="font-size: 0.75rem; color: #00ffaa;">${t('loader.mayTake20To45Seconds', 'This may take 20-45 seconds')}</span>
      </div>
    `;
    
    // Add animations if not already added
    if (!document.getElementById('patience-animations')) {
      const style = document.createElement('style');
      style.id = 'patience-animations';
      style.textContent = `
        @keyframes color-cycle {
          0% { color: #00ff41; }
          20% { color: #00ffaa; }
          40% { color: #00aaff; }
          60% { color: #aa00ff; }
          80% { color: #ff00aa; }
          100% { color: #00ff41; }
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

  // Event delegation for CSP-compliant lightbox handler
  document.addEventListener('click', function(e) {
    const openLightbox = e.target.closest('[data-action="open-lightbox"]');
    if (openLightbox) {
      const screenshotUrl = openLightbox.getAttribute('data-screenshot-url');
      const screenshotTitle = openLightbox.getAttribute('data-screenshot-title');
      if (screenshotUrl && window.ScreenshotLightbox && typeof window.ScreenshotLightbox.open === 'function') {
        window.ScreenshotLightbox.open(screenshotUrl, screenshotTitle || t('reports.common.screenshot', 'Screenshot'));
      }
    }
  });

});

/**
 * Server-side PDF Export for Tag Intelligence
 * Uses unified PDF export function (server-side Puppeteer)
 */
window.exportPDF = async function exportTagIntelligencePDF(format, buttonEl) {
  const results = window.SM_TAG_INTELLIGENCE_RESULTS;

  if (!results) {
    if (window.ReportUI?.toast) {
      window.ReportUI.toast(t('reports.common.noResultsToExport', 'Run a scan first to export PDF.'));
    } else {
      alert(t('reports.common.noResultsToExport', 'Run a scan first to export PDF.'));
    }
    return;
  }

  // Use unified PDF export function (server-side Puppeteer)
  if (typeof window.exportReportPDF === 'function') {
    await window.exportReportPDF({
      reportType: 'tag-intelligence',
      buttonElement: buttonEl
    });
  } else {
    console.error('PDF export utility not loaded');
    alert(t('reports.common.pdfNotAvailable', 'PDF export is not available. Please refresh the page.'));
  }
};
