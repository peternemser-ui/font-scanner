// Broken Links Analyzer Script
// Uses AnalyzerLoader for consistent loading UI

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'broken-links';
document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);

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
    { label: t('loader.initializingCrawler', 'Initializing crawler'), detail: t('loader.startingCrawl', 'Starting website crawl...') },
    { label: t('loader.discoveringPages', 'Discovering pages'), detail: t('loader.findingLinks', 'Finding internal links...') },
    { label: t('loader.checkingLinkStatus', 'Checking link status'), detail: t('loader.testingLinks', 'Testing each link for errors...') },
    { label: t('loader.analyzingRedirects', 'Analyzing redirects'), detail: t('loader.tracingRedirects', 'Tracing redirect chains...') },
    { label: t('loader.testingExternalLinks', 'Testing external links'), detail: t('loader.validatingExternal', 'Validating external resources...') },
    { label: t('loader.generatingReport', 'Generating report'), detail: t('loader.compilingLinkHealth', 'Compiling link health analysis...') }
  ];
}

// Helper function to translate issue descriptions from backend
function translateIssueDescription(issue) {
  if (!issue) return '';

  // Check for known issue patterns and translate them
  if (issue === 'No anchor text, aria-label, or image alt') {
    return t('reports.brokenLinks.issues.noAccessibleText', issue);
  }
  if (issue === 'Image link without alt text') {
    return t('reports.brokenLinks.issues.imageNoAlt', issue);
  }
  if (issue.includes('External link opens in new tab without rel=')) {
    return t('reports.brokenLinks.issues.externalNoRel', 'External link opens in new tab without rel="noopener" or rel="noreferrer"');
  }
  // Generic anchor text pattern: 'Generic anchor text "xxx" provides poor SEO value'
  const genericMatch = issue.match(/^Generic anchor text "(.+)" provides poor SEO value$/);
  if (genericMatch) {
    return t('reports.brokenLinks.issues.genericAnchorText', 'Generic anchor text "{text}" provides poor SEO value', { text: genericMatch[1] });
  }

  // Return original if no match
  return issue;
}

document.getElementById('analyzeBtn').addEventListener('click', analyzeLinks);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyzeLinks();
});

async function analyzeLinks() {
  const url = document.getElementById('url').value.trim();
  const maxPages = parseInt(document.getElementById('maxPages').value);
  const maxDepth = parseInt(document.getElementById('maxDepth').value);
  const followExternal = document.getElementById('followExternal').checked;
  
  if (!url) {
    alert(t('reports.common.pleaseEnterUrl', 'Please enter a valid URL'));
    return;
  }
  
  const results = document.getElementById('results');
  const btn = document.getElementById('analyzeBtn');
  
  results.style.display = 'none';
  btn.disabled = true;
  
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
      ${t('reports.brokenLinks.analysisInProgress', 'Link analysis in progress...')}
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(var(--accent-primary-rgb), 0.7); padding: 0 0.5rem;">
      ${t('reports.brokenLinks.analysisDuration', 'This may take 30-90 seconds depending on site size')}
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
  
  loader.start(getAnalysisSteps(), '🔗 ' + t('loader.analyzingBrokenLinks', 'BROKEN LINK CHECKER'), 60);
  
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
    
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/broken-links', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, maxPages, maxDepth, followExternal, scanStartedAt, lang: window.i18n?.getActiveLocale?.() || document.documentElement.lang || 'en' })
    });
    
    loader.nextStep(2);
    loader.nextStep(3);
    
    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.code === 'SCAN_QUOTA_EXCEEDED') {
        const limit = errorData.scansLimit || 10;
        loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
        return;
      }
      throw new Error(errorData.message || errorData.error || t('reports.common.analysisFailed', 'Analysis failed'));
    }
    
    const data = await response.json();

    // Extract and set report metadata from API response
    console.log('[broken-links-script] Setting report metadata from API response');
    const apiReportId = data?.reportId || data?.results?.reportId;
    const screenshotUrl = data?.screenshotUrl || data?.results?.screenshotUrl;
    if (apiReportId) {
      document.body.setAttribute('data-report-id', apiReportId);
    }
    if (screenshotUrl) {
      document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
    }

    loader.nextStep(4);
    loader.nextStep(5);
    loader.complete();
    
    displayResults(data);
    results.style.display = 'block';
    window.__REPORT_READY__ = true;
    window.dispatchEvent(new CustomEvent('report:ready'));

  } catch (error) {
    alert(`Error: ${error.message}`);
    loader.complete();
  } finally {
    btn.disabled = false;
  }
}

async function displayResults(data) {
  // Ensure i18n is loaded before rendering (prevents English fallback on fast stored-report loads)
  if (window.i18n && !window.i18n.initialized) {
    try { await window.i18n.init(); } catch (e) { /* fallback */ }
  }

  if (!data || typeof data !== 'object' || data.error === true || typeof data === 'string') { console.error('[BrokenLinks] displayResults received invalid data:', data?.error || data); return; }
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = '';

  // CRITICAL: Show results container (it starts hidden)
  resultsContainer.style.display = 'block';

  // Store results globally
  window.currentBrokenLinksResults = data;

  // CRITICAL: Compute reportId and isUnlocked EARLY so accordions can use it
  // Use existing reportId from body attribute if set (from billing return/dashboard recall)
  const reportUrl = data.url || document.getElementById('url')?.value?.trim() || '';
  const scanStartedAt = window.SM_SCAN_STARTED_AT || document.body.getAttribute('data-sm-scan-started-at');
  const analyzerKey = window.SM_ANALYZER_KEY || 'broken-links';

  let reportId = document.body.getAttribute('data-report-id') || data.reportId || null;
  if (!reportId && window.ReportUI) {
    if (typeof window.ReportUI.makeReportId === 'function') {
      reportId = window.ReportUI.makeReportId({
        analyzerKey,
        normalizedUrl: reportUrl,
        startedAtISO: scanStartedAt
      });
    } else if (typeof window.ReportUI.computeReportId === 'function') {
      reportId = window.ReportUI.computeReportId(reportUrl, scanStartedAt, analyzerKey);
    }
  }
  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
  }
  console.log('[BrokenLinks] displayResults using reportId:', reportId);

  // Build screenshot URL for report display
  const screenshotUrl = data.screenshotUrl || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');
  if (screenshotUrl) {
    document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
  }

  // Check if report is unlocked (Pro/Day Pass get global access; single purchase needs reportId)
  const isUnlocked = !!(
    (window.ProReportBlock && typeof window.ProReportBlock.isProSubscriber === 'function' && window.ProReportBlock.isProSubscriber()) ||
    (reportId &&
      window.ProReportBlock &&
      typeof window.ProReportBlock.hasAccess === 'function' &&
      window.ProReportBlock.hasAccess(reportId))
  );
  console.log('[BrokenLinks] isUnlocked:', isUnlocked, 'reportId:', reportId);

  // Wrap in report-scope for proper CSS styling of accordions
  const reportScope = document.createElement('div');
  reportScope.className = 'report-scope';
  resultsContainer.appendChild(reportScope);

  // 1. Overview Section with Score Circle
  const overviewSection = document.createElement('div');
  overviewSection.className = 'section';
  overviewSection.innerHTML = createOverviewSection(data);
  reportScope.appendChild(overviewSection);

  // 1.25. Page Screenshot Section
  if (screenshotUrl) {
    const screenshotSection = document.createElement('div');
    screenshotSection.className = 'section screenshot-section';
    screenshotSection.innerHTML = `
      <h3 style="color: var(--text-primary, #fff); font-size: 1rem; margin: 0 0 0.75rem 0; font-weight: 600;">
        ${t('reports.common.pageScreenshot', 'Page Screenshot')}
      </h3>
      <div class="screenshot-item" style="background: var(--bg-secondary, #1a1a1a); border: 1px solid var(--border-color, #333); border-radius: 8px; overflow: hidden;">
        <img
          src="${screenshotUrl}"
          alt="${t('reports.common.screenshotOf', 'Screenshot of {{url}}', { url: reportUrl })}"
          class="screenshot-item__img"
          style="width: 100%; max-height: 300px; object-fit: cover; object-position: top; cursor: pointer; display: block;"
          data-action="open-lightbox"
          data-screenshot-url="${screenshotUrl}"
          data-screenshot-title="${t('reports.common.pageScreenshot', 'Page Screenshot')}"
        />
      </div>
    `;
    reportScope.appendChild(screenshotSection);

    // Use JS listener instead of inline onerror (CSP blocks script-src-attr)
    const ssImg = screenshotSection.querySelector('.screenshot-item__img');
    if (ssImg) {
      ssImg.addEventListener('error', function() {
        this.parentElement.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted, #666);">' + t('reports.common.screenshotUnavailable', 'Screenshot unavailable') + '</div>';
      });
    }

    // Add click handler for screenshot lightbox
    screenshotSection.addEventListener('click', (e) => {
      const openLightbox = e.target.closest('[data-action="open-lightbox"]');
      if (openLightbox) {
        const url = openLightbox.getAttribute('data-screenshot-url');
        const title = openLightbox.getAttribute('data-screenshot-title');
        if (url && window.ScreenshotLightbox && typeof window.ScreenshotLightbox.open === 'function') {
          window.ScreenshotLightbox.open(url, title || t('reports.common.screenshot', 'Screenshot'));
        }
      }
    });
  }

  // 1.5. Show warning if no links found (site blocking or JS rendering issue)
  if (data.totalLinks === 0 || data.summary.broken + data.summary.redirects + data.summary.working + data.summary.external === 0) {
    const warningSection = document.createElement('div');
    warningSection.className = 'section';
    warningSection.innerHTML = `
      <div style="
        background: linear-gradient(135deg, rgba(255,140,0,0.15), rgba(255,68,68,0.1));
        border: 2px solid rgba(255,140,0,0.6);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
      ">
        <h3 style="color: #ff8c00; margin: 0 0 0.75rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
          ${t('reports.brokenLinks.noLinksDiscovered', 'No Links Discovered')}
        </h3>
        <p style="color: var(--r-text-muted, #6B7280); margin: 0 0 0.75rem 0; line-height: 1.6;">
          ${t('reports.brokenLinks.noLinksDesc', 'The crawler was unable to find any links on <strong>{{url}}</strong>. This usually indicates one of the following:', { url: data.url })}
        </p>
        <ul style="color: var(--r-text-muted, #6B7280); margin: 0 0 1rem 1rem; line-height: 1.8;">
          <li><strong>${t('reports.brokenLinks.botDetection', 'Bot Detection')}:</strong> ${t('reports.brokenLinks.botDetectionDesc', 'The site is blocking automated crawlers (common with CloudFlare, Akamai, etc.)')}</li>
          <li><strong>${t('reports.brokenLinks.jsRendering', 'JavaScript Rendering')}:</strong> ${t('reports.brokenLinks.jsRenderingDesc', 'Links are generated dynamically by JavaScript that requires a browser')}</li>
          <li><strong>${t('reports.brokenLinks.accessRestrictions', 'Access Restrictions')}:</strong> ${t('reports.brokenLinks.accessRestrictionsDesc', 'The site returned a 403 Forbidden or similar error')}</li>
          <li><strong>${t('reports.brokenLinks.unusualNavigation', 'Unusual Navigation')}:</strong> ${t('reports.brokenLinks.unusualNavigationDesc', 'The site uses custom navigation (data-href, onclick handlers, etc.)')}</li>
        </ul>
        <p style="color: var(--r-text-faint, #9CA3AF); margin: 0; font-size: 0.85rem; font-style: italic;">
          ${t('reports.brokenLinks.noLinksSupportNote', 'Try running the scan again, or contact support if this issue persists. Some enterprise sites cannot be crawled externally.')}
        </p>
      </div>
    `;
    reportScope.appendChild(warningSection);
  }

  // 2. Summary Cards
  const summarySection = document.createElement('div');
  summarySection.className = 'section';
  summarySection.innerHTML = createSummaryCards(data.summary);
  reportScope.appendChild(summarySection);

  // 3. Accordion Sections using ReportAccordion
  const accordionContainer = document.createElement('div');
  accordionContainer.className = 'accordion-container';

  let accordionHTML = '';

  if (data.links.broken && data.links.broken.length > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'broken-links',
      title: t('reports.brokenLinks.brokenLinksCount', 'Broken Links ({{count}})', { count: data.links.broken.length }),
      contentHTML: renderBrokenLinksContent(data.links.broken)
    });
  }

  if (data.links.redirects && data.links.redirects.length > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'redirects',
      title: t('reports.brokenLinks.redirectsCount', 'Redirects ({{count}})', { count: data.links.redirects.length }),
      contentHTML: renderRedirectsContent(data.links.redirects, data.redirectAnalysis)
    });
  }

  if (data.links.working && data.links.working.length > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'working-links',
      title: t('reports.brokenLinks.workingLinksTotal', 'Working Links ({{count}} total)', { count: data.summary.working }),
      contentHTML: renderWorkingLinksContent(data.links.working, data.summary.working)
    });
  }

  if (data.links.external && data.links.external.length > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'external-links',
      title: t('reports.brokenLinks.externalLinksTotal', 'External Links ({{count}} total)', { count: data.summary.external }),
      contentHTML: renderExternalLinksContent(data.links.external, data.summary.external)
    });
  }

  // Anchor Text Analysis - only show if there's actual anchor data
  if (data.anchorAnalysis && data.anchorAnalysis.totalAnchors > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'anchor-analysis',
      title: t('reports.brokenLinks.anchorTextAnalysis', 'Anchor Text Analysis'),
      contentHTML: renderAnchorAnalysisContent(data.anchorAnalysis)
    });
  }

  // Link Attributes Audit - only show if there are external links to audit
  if (data.attributeAnalysis && (data.attributeAnalysis.secureExternalLinks > 0 || data.attributeAnalysis.insecureExternalLinks > 0 || data.attributeAnalysis.nofollowCount > 0)) {
    accordionHTML += ReportAccordion.createSection({
      id: 'attribute-analysis',
      title: t('reports.brokenLinks.linkAttributesAudit', 'Link Attributes Audit'),
      contentHTML: renderAttributeAnalysisContent(data.attributeAnalysis)
    });
  }

  // Redirect Chain Analysis
  if (data.redirectAnalysis && data.redirectAnalysis.total > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'redirect-analysis',
      title: t('reports.brokenLinks.redirectChainAnalysis', 'Redirect Chain Analysis'),
      contentHTML: renderRedirectAnalysisContent(data.redirectAnalysis)
    });
  }

  // Report and Recommendations (PRO)
  if (data.recommendations && data.recommendations.length > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'report-recommendations',
      title: t('reports.common.reportAndRecommendationsCount', 'Recommendations ({{count}})', { count: data.recommendations.length }),
      isPro: true,
      locked: !isUnlocked,
      context: 'broken-links',
      reportId: reportId,
      contentHTML: renderRecommendationsAndExportContent(data)
    });
  }

  // AI Strategic Analysis (Pro)
  accordionHTML += ReportAccordion.createSection({
    id: 'ai-strategic-analysis',
    title: t('reports.ai.strategicTitle', 'AI Strategic Analysis'),
    isPro: true, locked: !isUnlocked, context: 'broken-links', reportId: reportId,
    scoreTextRight: null,
    contentHTML: '<div id="ai-strategic-content">' + (window.AIRecommendations && window.AIRecommendations.renderLoadingAnimation ? window.AIRecommendations.renderLoadingAnimation() : '<div style="padding:1.5rem;text-align:center;color:var(--r-text-muted,#6B7280);">' + t('reports.ai.loading', 'Analyzing your results...') + '</div>') + '</div>'
  });

  accordionContainer.innerHTML = accordionHTML;
  reportScope.appendChild(accordionContainer);

  // Fetch AI strategic analysis content
  if (window.AIRecommendations) {
    const locale = document.documentElement.lang || (window.i18n && window.i18n.locale) || 'en';
    window.AIRecommendations.fetchAndRender('ai-strategic-content', reportId, 'broken-links', data, locale, { skipHeader: true });
  }
  if (window.SelfImprovement) {
    window.SelfImprovement.integrate({ data: data, analyzerType: 'broken-links', donutLabels: {}, resultsContent: resultsContainer, reportId: reportId });
  }

  // Initialize ReportAccordion interactions
  ReportAccordion.initInteractions();

  // 9. Pro Report Block (reportId and isUnlocked already computed at top of function)
  const proSection = document.createElement('div');
  proSection.className = 'section';
  proSection.style.marginTop = '2rem';
  if (window.ProReportBlock && window.ProReportBlock.render) {
    proSection.innerHTML = window.ProReportBlock.render({
      context: 'broken-links',
      features: ['pdf', 'excel', 'csv', 'share'],
      title: t('reports.common.unlockReport', 'Unlock Report'),
      subtitle: t('reports.brokenLinks.unlockSubtitle', 'PDF export, Excel spreadsheet, share link, and export data for this scan.'),
      reportId: reportId
    });
  } else {
    const opts = { context: 'broken-links', features: ['pdf', 'excel', 'csv', 'share'], title: 'Unlock Report', subtitle: 'PDF export, Excel spreadsheet, share link, and export data for this scan.' };
    const safe = JSON.stringify(opts).replace(/</g, '\\u003c').replace(/"/g, '&quot;');
    proSection.innerHTML = '<div class="pro-report-block" data-pro-block-pending data-pro-block-options="' + safe + '"></div>';
  }
  reportScope.appendChild(proSection);

  // Refresh paywall state to show correct buttons
  if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
    window.CreditsManager.renderPaywallState();
  }

  // CRITICAL: Ensure fix accordion functions are available after DOM render
  // This must be called after all content is added to the DOM
  setTimeout(() => {
    ensureBrokenLinksFixFunctions();
  }, 50);
}

function createOverviewSection(data) {
  const gradeColor = getGradeColor(data.grade);
  const s = data.summary;
  const score = data.score;
  const circumference = 2 * Math.PI * 75;
  const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;
  
  // Check if scan failed to find links
  const noLinksFound = data.totalLinks === 0 || (s.broken === 0 && s.redirects === 0 && s.working === 0 && s.external === 0);
  
  return `
    <h2>${t('reports.brokenLinks.title', 'Broken Link Analysis')}</h2>
    <p>>> ${t('reports.common.url', 'URL')}: ${data.url || t('reports.common.na', 'N/A')}</p>
    <p>>> ${t('reports.common.timestamp', 'timestamp')}: ${window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString()}</p>
    
    <div style="
      background: linear-gradient(135deg, ${gradeColor}10 0%, ${gradeColor}05 100%);
      border: 2px solid ${gradeColor};
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
      box-shadow: 0 4px 20px ${gradeColor}20;
    ">
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 2rem; align-items: center;">
        <!-- Left: SVG Score Circle -->
        <div style="text-align: center;">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle
              cx="90"
              cy="90"
              r="75"
              fill="none"
              stroke="rgba(0, 0, 0, 0.1)"
              stroke-width="10"
            />
            <circle
              cx="90"
              cy="90"
              r="75"
              fill="none"
              stroke="${gradeColor}"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${strokeDasharray}"
              transform="rotate(-90 90 90)"
            />
            <text
              x="90"
              y="90"
              text-anchor="middle"
              dy="0.35em"
              font-size="3.5rem"
              font-weight="bold"
              fill="#f9fff2"
              stroke="rgba(0, 0, 0, 0.65)"
              stroke-width="2.5"
              paint-order="stroke fill"
              style="text-shadow: 0 0 18px ${gradeColor}, 0 0 30px rgba(0,0,0,0.6);"
            >
              ${score}
            </text>
          </svg>
          <div style="
            margin-top: 0.5rem;
            font-size: 1.3rem;
            font-weight: bold;
            color: ${gradeColor};
          ">${getGradeName(data.grade)}</div>
        </div>
        
        <!-- Right: Quick Stats -->
        <div>
          <h3 style="color: ${gradeColor}; margin: 0 0 1rem 0; font-size: 1.3rem;">>> ${t('reports.brokenLinks.linkHealthSummary', 'Link Health Summary')}</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: var(--r-text-muted, #6B7280);">${t('reports.brokenLinks.pagesScanned', 'Pages Scanned')}</span>
              <span style="color: #00d9ff; font-weight: bold;">${data.pagesScanned}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: var(--r-text-muted, #6B7280);">${t('reports.brokenLinks.totalLinksFound', 'Total Links Found')}</span>
              <span style="color: #00d9ff; font-weight: bold;">${data.totalLinks}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: var(--r-text-muted, #6B7280);">${t('reports.brokenLinks.brokenLinks', 'Broken Links')}</span>
              <span style="color: ${s.broken > 0 ? '#ff4444' : getAccentPrimaryHex()}; font-weight: bold;">${s.broken}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: var(--r-text-muted, #6B7280);">${t('reports.brokenLinks.redirects', 'Redirects')}</span>
              <span style="color: ${s.redirects > 5 ? '#ff8c00' : '#ffd700'}; font-weight: bold;">${s.redirects}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
              <span style="color: var(--r-text-muted, #6B7280);">${t('reports.brokenLinks.analysisTime', 'Analysis Time')}</span>
              <span style="color: var(--r-text-faint, #9CA3AF); font-weight: bold;">${data.analysisTime}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createSummaryCards(summary) {
  const accent = getAccentPrimaryHex();
  const cards = [
    { key: 'broken', label: t('reports.brokenLinks.cards.broken', 'Broken'), color: summary.broken > 0 ? '#ff4444' : accent, desc: t('reports.brokenLinks.cards.brokenDesc', 'Dead links') },
    { key: 'redirects', label: t('reports.brokenLinks.cards.redirects', 'Redirects'), color: summary.redirects > 5 ? '#ff8c00' : '#ffd700', desc: t('reports.brokenLinks.cards.redirectsDesc', '301/302 chains') },
    { key: 'working', label: t('reports.brokenLinks.cards.working', 'Working'), color: accent, desc: t('reports.brokenLinks.cards.workingDesc', 'Healthy links') },
    { key: 'external', label: t('reports.brokenLinks.cards.external', 'External'), color: '#00d9ff', desc: t('reports.brokenLinks.cards.externalDesc', 'Outbound links') }
  ];

  return `
    <h3 style="color: ${accent}; margin: 0 0 1.5rem 0; font-size: 1.3rem;">>> ${t('reports.brokenLinks.linkStatusBreakdown', 'Link Status Breakdown')}</h3>
    <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1rem;">${t('reports.brokenLinks.overviewByCategory', 'Overview of all links found on the site by category')}</p>
    
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem;">
      ${cards.map(cat => {
        const count = summary[cat.key] || 0;
        const circumference = 2 * Math.PI * 55;
        // For visual purposes, show fill based on relative count (max 100 for full circle)
        const fillPercent = Math.min(count, 100) / 100;
        const strokeDasharray = `${fillPercent * circumference} ${circumference}`;
        return `
          <div style="
            background: linear-gradient(135deg, ${cat.color}15 0%, ${cat.color}05 100%);
            border: 2px solid ${cat.color}80;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
          ">
            <svg width="100" height="100" viewBox="0 0 120 120" style="margin: 0 auto 0.75rem; display: block;">
              <circle
                cx="60"
                cy="60"
                r="55"
                fill="none"
                stroke="rgba(0, 0, 0, 0.1)"
                stroke-width="8"
              />
              <circle
                cx="60"
                cy="60"
                r="55"
                fill="none"
                stroke="${cat.color}"
                stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="${strokeDasharray}"
                transform="rotate(-90 60 60)"
              />
              <text
                x="60"
                y="60"
                text-anchor="middle"
                dy="0.35em"
                font-size="2rem"
                font-weight="bold"
                fill="#f9fff2"
                stroke="rgba(0, 0, 0, 0.65)"
                stroke-width="1.5"
                paint-order="stroke fill"
                style="text-shadow: 0 0 10px ${cat.color};"
              >
                ${count}
              </text>
            </svg>
            <div style="color: var(--r-text, #111827); font-size: 1rem; font-weight: 600;">${cat.label}</div>
            <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.8rem; margin-top: 0.25rem;">${cat.desc}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Reusable export button helper
function renderExportButton(functionName, color, isUnlocked) {
  return `
    <button data-action="call-function" data-function="${functionName}" style="
      background: ${isUnlocked ? `rgba(${hexToRgb(color)}, 0.15)` : 'rgba(128,128,128,0.15)'};
      color: ${isUnlocked ? color : '#888'};
      border: 1px solid ${isUnlocked ? `rgba(${hexToRgb(color)}, 0.4)` : 'rgba(128,128,128,0.4)'};
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s;
    " title="${isUnlocked ? t('reports.common.exportToExcel', 'Export to Excel') : t('reports.common.proFeatureUnlock', 'PRO feature - Unlock to export')}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      ${t('reports.common.export', 'Export')} ${isUnlocked ? '' : '<span style="font-size: 0.65rem; background: rgba(255,215,0,0.2); color: #ffd700; padding: 0.1rem 0.3rem; border-radius: 3px; margin-left: 0.25rem;">PRO</span>'}
    </button>
  `;
}

// Helper to convert hex to RGB for rgba()
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '128, 128, 128';
}

function renderBrokenLinksContent(broken) {
  const headers = [
    { label: t('reports.brokenLinks.headers.brokenUrl', 'Broken URL'), align: 'left' },
    { label: t('reports.brokenLinks.headers.status', 'Status'), align: 'center' },
    { label: t('reports.brokenLinks.headers.foundOn', 'Found On'), align: 'center' },
    { label: t('reports.brokenLinks.headers.linkText', 'Link Text'), align: 'left' }
  ];

  const renderRow = (link) => `
    <tr style="border-bottom: 1px solid #222;">
      <td style="padding: 0.75rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <a href="${link.url}" target="_blank" rel="noopener" style="color: #ff6b6b;">${truncateUrl(link.url)}</a>
      </td>
      <td style="padding: 0.75rem; text-align: center;">
        <span style="background: rgba(255,68,68,0.2); color: #ff6b6b; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600;">
          ${link.statusCode || t('reports.common.err', 'ERR')}
        </span>
      </td>
      <td style="padding: 0.75rem; text-align: center; color: var(--r-text-faint, #9CA3AF);">${link.foundOn.length} ${link.foundOn.length !== 1 ? t('reports.brokenLinks.pages', 'pages') : t('reports.brokenLinks.page', 'page')}</td>
      <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--r-text-muted, #6B7280);">
        ${link.text || '—'}
      </td>
    </tr>
  `;

  const isUnlocked = window.ProAccess?.hasProAccess?.() || false;

  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="color: #ff4444; margin: 0; font-size: 1rem;">>> ${t('reports.brokenLinks.sections.criticalFixLinks', 'Critical: Fix These Links')}</h3>
        ${renderExportButton('exportBrokenLinksToExcel', '#E74C3C', isUnlocked)}
      </div>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1rem; font-size: 0.9rem;">
        ${t('reports.brokenLinks.descriptions.brokenLinksHurt', 'Broken links hurt SEO and user experience. These need immediate attention.')}
      </p>
      ${renderPaginatedTable(broken, 'broken-links', renderRow, headers)}
    </div>
  `;
}

function renderRedirectsContent(redirects, redirectAnalysis) {
  const headers = [
    { label: t('reports.brokenLinks.headers.originalUrl', 'Original URL'), align: 'left' },
    { label: t('reports.brokenLinks.headers.type', 'Type'), align: 'center' },
    { label: t('reports.brokenLinks.headers.chain', 'Chain'), align: 'center' },
    { label: t('reports.brokenLinks.headers.finalDestination', 'Final Destination'), align: 'left' }
  ];

  const renderRow = (link) => {
    const chainLength = (link.redirectChain || []).length;
    const typeColor = link.redirectType === 'permanent' || link.redirectType === 'permanent-308' ? '#00ff41' : '#ff8c00';
    const typeLabel = link.redirectType === 'permanent' ? '301' :
                     link.redirectType === 'temporary' ? '302' :
                     link.redirectType === 'temporary-307' ? '307' :
                     link.redirectType === 'permanent-308' ? '308' : link.statusCode;
    return `
      <tr style="border-bottom: 1px solid #222;">
        <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <a href="${link.url}" target="_blank" rel="noopener" style="color: #F5B041;">${truncateUrl(link.url)}</a>
        </td>
        <td style="padding: 0.75rem; text-align: center;">
          <span style="background: ${typeColor}20; color: ${typeColor}; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">
            ${typeLabel}
          </span>
        </td>
        <td style="padding: 0.75rem; text-align: center;">
          <span style="color: ${chainLength > 2 ? '#E74C3C' : '#58D68D'}; font-weight: 600;">
            ${chainLength} ${chainLength !== 1 ? t('reports.brokenLinks.hops', 'hops') : t('reports.brokenLinks.hop', 'hop')}
          </span>
          ${link.redirectLoop ? '<span style="color: #E74C3C; margin-left: 0.5rem;">⚠️ ' + t('reports.brokenLinks.loop', 'LOOP') + '</span>' : ''}
        </td>
        <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${link.redirectEndsInError ? '#E74C3C' : '#58D68D'};">
            link.redirectEndsInError ? '❌ ' + t('reports.common.error', 'Error: {{message}}') :
            link.redirectChain && link.redirectChain.length > 0 ? truncateUrl(link.redirectChain[link.redirectChain.length - 1]?.url || link.redirectChain[0]) : '—'}
        </td>
      </tr>
    `;
  };

  const isUnlocked = window.ProAccess?.hasProAccess?.() || false;

  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="color: #F5B041; margin: 0; font-size: 1rem;">>> ${t('reports.brokenLinks.sections.redirectChains', 'Redirect Chains')}</h3>
        ${renderExportButton('exportRedirectsToExcel', '#F5B041', isUnlocked)}
      </div>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1rem; font-size: 0.9rem;">
        ${t('reports.brokenLinks.descriptions.updateRedirects', 'Update these links to point directly to their final destination to improve page speed.')}
      </p>
      ${renderPaginatedTable(redirects, 'redirects', renderRow, headers)}
    </div>
  `;
}

function renderWorkingLinksContent(working, total) {
  const headers = [
    { label: t('reports.brokenLinks.headers.url', 'URL'), align: 'left' },
    { label: t('reports.brokenLinks.headers.linkText', 'Link Text'), align: 'left' },
    { label: t('reports.brokenLinks.headers.foundOn', 'Found On'), align: 'center' }
  ];

  const renderRow = (link) => `
    <tr style="border-bottom: 1px solid #222;">
      <td style="padding: 0.75rem; max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <a href="${link.url}" target="_blank" rel="noopener" style="color: #5DADE2;">${truncateUrl(link.url)}</a>
      </td>
      <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--r-text-muted, #6B7280);">
        ${link.text || '—'}
      </td>
      <td style="padding: 0.75rem; text-align: center; color: var(--r-text-faint, #9CA3AF);">${link.foundOn ? link.foundOn.length : 1}</td>
    </tr>
  `;

  const isUnlocked = window.ProAccess?.hasProAccess?.() || false;

  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="color: #5DADE2; margin: 0; font-size: 1rem;">>> ${t('reports.brokenLinks.sections.healthyInternalLinks', 'Healthy Internal Links')}</h3>
        ${renderExportButton('exportWorkingLinksToExcel', '#5DADE2', isUnlocked)}
      </div>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1rem; font-size: 0.9rem;">
        ${t('reports.brokenLinks.descriptions.allLinksWorking', 'All these links are working correctly.')} ${t('reports.brokenLinks.descriptions.showingXofY', 'Showing {shown} of {total} total.').replace('{shown}', working.length).replace('{total}', total)}
      </p>
      ${renderPaginatedTable(working, 'working-links', renderRow, headers)}
    </div>
  `;
}

function renderExternalLinksContent(external, total) {
  const headers = [
    { label: t('reports.brokenLinks.headers.externalUrl', 'External URL'), align: 'left' },
    { label: t('reports.brokenLinks.headers.linkText', 'Link Text'), align: 'left' },
    { label: t('reports.brokenLinks.headers.status', 'Status'), align: 'center' },
    { label: t('reports.brokenLinks.headers.foundOn', 'Found On'), align: 'center' }
  ];

  const renderRow = (link) => `
    <tr style="border-bottom: 1px solid #222;">
      <td style="padding: 0.75rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: #7FB3D5;">${truncateUrl(link.url)}</a>
      </td>
      <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--r-text-muted, #6B7280);">
        ${link.text || '—'}
      </td>
      <td style="padding: 0.75rem; text-align: center;">
        <span style="background: rgba(93,173,226,0.2); color: #5DADE2; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">
          ${link.statusCode || t('reports.common.ok', 'OK')}
        </span>
      </td>
      <td style="padding: 0.75rem; text-align: center; color: var(--r-text-faint, #9CA3AF);">${link.foundOn ? link.foundOn.length : 1}</td>
    </tr>
  `;

  const isUnlocked = window.ProAccess?.hasProAccess?.() || false;

  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="color: #7FB3D5; margin: 0; font-size: 1rem;">>> ${t('reports.brokenLinks.sections.externalOutboundLinks', 'External Outbound Links')}</h3>
        ${renderExportButton('exportExternalLinksToExcel', '#7FB3D5', isUnlocked)}
      </div>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1rem; font-size: 0.9rem;">
        ${t('reports.brokenLinks.descriptions.linksToOtherDomains', 'Links pointing to other domains.')} ${t('reports.brokenLinks.descriptions.showingXofY', 'Showing {shown} of {total} total.').replace('{shown}', external.length).replace('{total}', total)}
      </p>
      ${renderPaginatedTable(external, 'external-links', renderRow, headers)}
    </div>
  `;
}

function renderRecommendationsContent(recommendations) {
  // Ensure global fix functions are available
  ensureBrokenLinksFixFunctions();

  const grouped = {
    critical: recommendations.filter(r => r.priority === 'critical'),
    high: recommendations.filter(r => r.priority === 'high'),
    medium: recommendations.filter(r => r.priority === 'medium'),
    success: recommendations.filter(r => r.priority === 'success')
  };

  // Combine all fixes for accordion rendering
  const allFixes = [
    ...grouped.critical.map(r => ({ ...r, severity: 'High' })),
    ...grouped.high.map(r => ({ ...r, severity: 'High' })),
    ...grouped.medium.map(r => ({ ...r, severity: 'Medium' })),
    ...grouped.success.map(r => ({ ...r, severity: 'Low' }))
  ];

  if (allFixes.length === 0) {
    return `
      <div style="text-align: center; padding: 2rem;">
        <span style="font-size: 3rem;">✅</span>
        <h3 style="color: #00ff41; margin: 1rem 0 0.5rem;">${t('reports.brokenLinks.allClear', 'All Clear!')}</h3>
        <p style="color: var(--r-text-faint, #9CA3AF);">${t('reports.brokenLinks.noLinkIssues', "No link issues detected. Your site's link health is excellent.")}</p>
      </div>
    `;
  }

  return `
    <div class="broken-links-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">🔗</span> ${t('reports.brokenLinks.sections.linkFixes', 'Link Fixes')}
        <span style="font-size: 0.875rem; color: var(--r-text-faint, #9CA3AF); font-weight: normal;">(${allFixes.length} ${t('reports.common.recommendations', 'Recommendations')})</span>
      </h3>
      <div class="broken-links-fixes-list">
        ${allFixes.map((fix, index) => renderBrokenLinksFixAccordion(fix, index)).join('')}
      </div>
    </div>
  `;
}

/**
 * Translate recommendation fields using i18n keys
 * Maps backend category names to translation keys
 */
function translateRecommendation(fix) {
  // Map backend category to translation key
  const categoryMap = {
    'Broken Links': 'brokenLinks',
    'Redirect Chains': 'redirectChains',
    'Redirect Loops': 'redirectLoops',
    'Temporary Redirects': 'temporaryRedirects',
    'Link Security': 'linkSecurity',
    'Anchor Text': 'anchorText',
    'Accessibility': 'accessibility',
    'Anchor Diversity': 'anchorDiversity',
    'Internal Linking': 'internalLinking',
    'Link Flow': 'linkFlow',
    'Link Health': 'linkHealth'
  };
  
  // Map backend detail patterns to translation keys
  const detailMap = {
    'Broken links hurt SEO': 'brokenLinksHurt',
    'Broken links lead to': 'brokenLinks',
    'Redirect chains with more than 2 hops': 'redirectChains',
    'Redirect chains slow': 'redirectChains',
    'Redirect loops prevent': 'redirectLoops',
    'Temporary redirects (302/307)': 'temporaryRedirects',
    'External links opening in new tabs': 'insecureLinks',
    'Anchor texts like': 'genericAnchorText',
    'Links without text': 'emptyLinks',
    'Some anchor texts are used frequently': 'overUsedAnchors',
    'You have': 'moreExternalThanInternal',
    'Internal links with nofollow': 'nofollowInternal',
    'No broken links': 'excellentHealth'
  };

  // Map backend impact patterns to translation keys
  const impactMap = {
    'Critical - pages are inaccessible': 'criticalInaccessible',
    'High - affects SEO rankings': 'highSeoRankings',
    'High - affects page speed': 'highPageSpeed',
    'High - affects user experience': 'highUserExperience',
    'High - security vulnerability': 'highSecurity',
    'Medium - affects SEO link equity': 'mediumSeoEquity',
    'Medium - affects keyword relevance': 'mediumKeywordRelevance',
    'Medium - affects accessibility': 'mediumAccessibility',
    'Medium - improves content': 'mediumDiscoverability',
    'Low - affects natural link': 'lowNaturalProfile',
    'Low - affects internal PageRank': 'lowPageRank',
    'Maintain current standards': 'maintainStandards'
  };
  
  const categoryKey = categoryMap[fix.category] || fix.category;
  const translatedCategory = t(`reports.brokenLinks.recommendations.categories.${categoryKey}`, fix.category);
  
  // Translate detail
  let translatedDetail = fix.detail;
  for (const [pattern, key] of Object.entries(detailMap)) {
    if (fix.detail && fix.detail.includes(pattern)) {
      translatedDetail = t(`reports.brokenLinks.recommendations.details.${key}`, fix.detail);
      break;
    }
  }
  
  // Translate impact
  let translatedImpact = fix.impact;
  for (const [pattern, key] of Object.entries(impactMap)) {
    if (fix.impact && fix.impact.includes(pattern)) {
      translatedImpact = t(`reports.brokenLinks.recommendations.impacts.${key}`, fix.impact);
      break;
    }
  }
  
  // Translate message - these often have dynamic counts
  // Keep the original message but extract count for translation
  let translatedMessage = fix.message;
  const countMatch = fix.message?.match(/(\d+)/);
  const count = countMatch ? parseInt(countMatch[1]) : 0;
  const plural = count !== 1 ? 's' : '';
  
  // Map message patterns to translation keys
  const messagePatterns = [
    { pattern: /Fix (\d+) broken link/i, key: 'fixBrokenLinks' },
    { pattern: /Shorten (\d+) redirect chain/i, key: 'fixRedirectChains' },
    { pattern: /Fix (\d+) redirect loop/i, key: 'fixRedirectLoops' },
    { pattern: /Consider converting (\d+) temporary redirect/i, key: 'convertTempRedirects' },
    { pattern: /Fix (\d+) insecure external/i, key: 'fixInsecureLinks' },
    { pattern: /Improve (\d+) generic anchor/i, key: 'improveAnchorText' },
    { pattern: /Add text to (\d+) empty link/i, key: 'addTextToEmptyLinks' },
    { pattern: /Diversify your anchor/i, key: 'diversifyAnchorText' },
    { pattern: /Add more internal/i, key: 'addInternalLinks' },
    { pattern: /Review (\d+) nofollowed/i, key: 'reviewNofollowLinks' },
    { pattern: /Excellent link health/i, key: 'excellentLinkHealth' }
  ];
  
  for (const { pattern, key } of messagePatterns) {
    if (pattern.test(fix.message || '')) {
      translatedMessage = t(`reports.brokenLinks.recommendations.messages.${key}`, fix.message, { count, plural });
      break;
    }
  }
  
  return {
    ...fix,
    category: translatedCategory,
    message: translatedMessage,
    detail: translatedDetail,
    impact: translatedImpact
  };
}

function renderBrokenLinksFixAccordion(fix, index) {
  // Translate the fix content
  const translatedFix = translateRecommendation(fix);
  
  const accordionId = `blfix-${fix.category?.replace(/\s+/g, '-').toLowerCase() || index}`;
  const severityColors = {
    High: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
    Medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
    Low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
  };
  const style = severityColors[fix.severity] || severityColors.Medium;
  
  // Translate severity label
  const severityLabels = {
    High: t('reports.common.severity.high', 'High'),
    Medium: t('reports.common.severity.medium', 'Medium'),
    Low: t('reports.common.severity.low', 'Low')
  };
  const severityLabel = severityLabels[fix.severity] || fix.severity.toUpperCase();

  return `
    <div class="broken-links-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="broken-links-fix-header" data-action="toggle-accordion" data-accordion-id="${accordionId}" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: var(--r-text, #111827);">${escapeBrokenLinksHtml(translatedFix.message)}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${translatedFix.category ? escapeBrokenLinksHtml(translatedFix.category) : t('reports.brokenLinks.linkIssue', 'Link Issue')}</p>
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
          ">${severityLabel}</span>
          <span class="broken-links-fix-expand-icon" style="color: var(--r-text-faint, #9CA3AF); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="broken-links-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderBrokenLinksFixTabs(translatedFix, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderBrokenLinksFixTabs(fix, accordionId) {
  return `
    <div class="broken-links-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); padding-bottom: 0.75rem;">
      <button class="broken-links-fix-tab active" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: var(--r-text, #111827);
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 ${t('reports.common.tabs.summary', 'Summary')}</button>
      <button class="broken-links-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="code" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 ${t('reports.common.tabs.code', 'Code')}</button>
      <button class="broken-links-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">🔧 ${t('reports.common.tabs.fixGuide', 'Fix Guide')}</button>
    </div>

    <!-- Summary Tab -->
    <div class="broken-links-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: var(--r-text-muted, #6B7280); line-height: 1.7; margin: 0 0 1rem 0;">
        ${escapeBrokenLinksHtml(fix.detail)}
      </p>
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ ${t('reports.common.fix.expectedImpact', 'Expected Impact')}</div>
        <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${escapeBrokenLinksHtml(fix.impact)}</div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="broken-links-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Current Issue -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
            <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ ${t('reports.common.fix.currentIssue', 'Current Issue')}</span>
            <button data-action="copy-code" data-copy-target="${accordionId}-problem" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: var(--r-text, #111827);
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 ${t('reports.common.copy', 'Copy')}</button>
          </div>
          <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${getBrokenLinksCodeSnippet(fix, 'problem')}</pre>
        </div>

        <!-- Fixed Code -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ ${t('reports.common.fix.recommendedFix', 'Recommended Fix')}</span>
            <button data-action="copy-code" data-copy-target="${accordionId}-solution" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: var(--r-text, #111827);
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 ${t('reports.common.copy', 'Copy')}</button>
          </div>
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${getBrokenLinksCodeSnippet(fix, 'solution')}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="broken-links-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--r-text, #111827);">${t('reports.common.fix.stepByStepFix', 'Step-by-Step Fix:')}</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--r-text-muted, #6B7280); line-height: 1.8;">
        ${getBrokenLinksSteps(fix).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
    </div>
  `;
}

function escapeBrokenLinksHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getBrokenLinksCodeSnippet(fix, type) {
  const category = fix.category || '';
  const data = window.currentBrokenLinksResults || {};

  // Get actual data based on category
  if (category === 'Broken Links' && data.links?.broken) {
    const brokenLinks = data.links.broken.slice(0, 5); // Show up to 5 examples
    if (type === 'problem') {
      if (brokenLinks.length === 0) return '<!-- No broken links found -->';
      return brokenLinks.map(link =>
        `❌ ${link.url}\n   Status: ${link.statusCode || 'Error'}\n   Found on: ${link.foundOn || 'Homepage'}\n   Text: "${link.text || 'No anchor text'}"`
      ).join('\n\n');
    } else {
      return `For each broken link above:

1. Check if page moved → Update href to new URL
2. If deleted → Remove link or replace content
3. If external → Contact site owner or remove

Example .htaccess redirect:
Redirect 301 /old-page /new-page`;
    }
  }

  if (category === 'Link Security' && data.attributeAnalysis?.insecureLinks) {
    const insecureLinks = data.attributeAnalysis.insecureLinks.slice(0, 5);
    if (type === 'problem') {
      if (insecureLinks.length === 0) return '<!-- No insecure links found -->';
      return insecureLinks.map(link =>
        `⚠️ ${link.url}\n   Opens in: new tab (target="_blank")\n   Missing: rel="noopener noreferrer"`
      ).join('\n\n');
    } else {
      return `Add security attributes to external links:

<a href="https://external-site.com"
   target="_blank"
   rel="noopener noreferrer">
  Link Text
</a>

This prevents:
• tabnabbing attacks (noopener)
• referrer leakage (noreferrer)`;
    }
  }

  if (category === 'Accessibility' && data.anchorAnalysis?.emptyTexts) {
    const emptyLinks = data.anchorAnalysis.emptyTexts.slice(0, 5);
    if (type === 'problem') {
      if (emptyLinks.length === 0) return '<!-- No empty links found -->';
      return emptyLinks.map(link =>
        `⚠️ ${link.url || link}\n   Issue: No accessible text for screen readers`
      ).join('\n\n');
    } else {
      return `Add accessible text to links:

Option 1 - Visible text:
<a href="/page">Descriptive text</a>

Option 2 - aria-label:
<a href="/page" aria-label="Description">
  <img src="icon.png" alt="">
</a>

Option 3 - Image alt:
<a href="/page">
  <img src="icon.png" alt="Description">
</a>`;
    }
  }

  if (category === 'Anchor Text' && data.anchorAnalysis?.genericTexts) {
    const genericLinks = data.anchorAnalysis.genericTexts.slice(0, 5);
    if (type === 'problem') {
      if (genericLinks.length === 0) return '<!-- No generic anchor texts found -->';
      return genericLinks.map(link =>
        `⚠️ "${link.text || link}" → ${link.url || 'unknown URL'}\n   Issue: Generic text provides no SEO value`
      ).join('\n\n');
    } else {
      return `Replace generic anchor text with descriptive text:

Instead of:           Use:
"Click here"     →   "View pricing plans"
"Read more"      →   "Read our SEO guide"
"Learn more"     →   "Learn about our services"

Good anchor text describes the destination.`;
    }
  }

  if (category === 'Redirect Chains' && data.redirectAnalysis?.longChains) {
    const chains = data.redirectAnalysis.longChains.slice(0, 3);
    if (type === 'problem') {
      if (chains.length === 0) return '<!-- No redirect chains found -->';
      return chains.map(chain =>
        `⚠️ Redirect Chain (${chain.length || chain.hops} hops):\n   ${chain.chain?.join(' → ') || chain.url || 'See redirect analysis'}`
      ).join('\n\n');
    } else {
      return `Update links to point directly to final destination:

Before: Page A → B → C → Final
After:  Page A → Final

In .htaccess, consolidate redirects:
Redirect 301 /page-a /final-destination
Redirect 301 /page-b /final-destination`;
    }
  }

  if (category === 'Redirect Loops' && data.redirectAnalysis?.loops) {
    const loops = data.redirectAnalysis.loops.slice(0, 3);
    if (type === 'problem') {
      if (loops.length === 0) return '<!-- No redirect loops found -->';
      return loops.map(loop =>
        `🔄 Redirect Loop:\n   ${loop.chain?.join(' → ') || loop.url || 'See redirect analysis'}\n   (loops back to start)`
      ).join('\n\n');
    } else {
      return `Fix redirect loops in server config:

1. Identify conflicting rules
2. Remove circular redirects
3. Ensure each URL has ONE destination

Example fix in .htaccess:
# WRONG - creates loop
Redirect 301 /a /b
Redirect 301 /b /a

# CORRECT - single destination
Redirect 301 /a /final
Redirect 301 /b /final`;
    }
  }

  // Fallback for other categories
  return type === 'problem'
    ? t('reports.brokenLinks.codeSnippets.reviewIssues', 'Review the {{category}} issues in this report. See the summary tab for details.', { category })
    : t('reports.brokenLinks.codeSnippets.followRecommendations', 'Follow the recommendations in the Fix Guide tab to resolve {{category}} issues.', { category });
}

function getBrokenLinksSteps(fix) {
  const category = fix.category || '';
  
  // Map category names to translation keys
  const categoryToKey = {
    'Broken Links': 'brokenLinks',
    'Redirect Chains': 'redirectChains',
    'Redirect Loops': 'redirectLoops',
    'Temporary Redirects': 'temporaryRedirects',
    'Link Security': 'linkSecurity',
    'Anchor Text': 'anchorText',
    'Accessibility': 'accessibility'
  };
  
  const key = categoryToKey[category] || 'default';
  
  // Get translated steps from i18n
  const steps = [];
  for (let i = 1; i <= 6; i++) {
    const step = t(`reports.brokenLinks.fixSteps.${key}.step${i}`, '');
    if (step) steps.push(step);
  }
  
  // If we found translated steps, return them
  if (steps.length > 0) {
    return steps;
  }
  
  // Fallback to default steps
  const defaultSteps = [
    t('reports.brokenLinks.fixSteps.default.step1', 'Review the specific issue in the report details'),
    t('reports.brokenLinks.fixSteps.default.step2', 'Identify affected links using the tables above'),
    t('reports.brokenLinks.fixSteps.default.step3', 'Apply the recommended fix from the Code tab'),
    t('reports.brokenLinks.fixSteps.default.step4', 'Test the changes in a development environment'),
    t('reports.brokenLinks.fixSteps.default.step5', 'Deploy fixes and re-run the scan to verify')
  ];
  
  return defaultSteps;
}

function ensureBrokenLinksFixFunctions() {
  // Toggle accordion - ALWAYS define to ensure it's available
  window.toggleBrokenLinksFixAccordion = function(accordionId) {
    console.log('[BrokenLinks] toggleBrokenLinksFixAccordion called with:', accordionId);
    const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
    const content = document.getElementById(`${accordionId}-content`);
    const icon = accordion?.querySelector('.broken-links-fix-expand-icon');

    console.log('[BrokenLinks] Found elements:', { accordion: !!accordion, content: !!content, icon: !!icon });

    if (!accordion || !content) {
      console.warn('[BrokenLinks] Missing elements for accordion:', accordionId);
      return;
    }

    const isExpanded = accordion.classList.contains('expanded');
    console.log('[BrokenLinks] isExpanded:', isExpanded);

    if (isExpanded) {
      accordion.classList.remove('expanded');
      content.style.maxHeight = '0';
      if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
      accordion.classList.add('expanded');
      content.style.maxHeight = content.scrollHeight + 'px';
      console.log('[BrokenLinks] Setting maxHeight to:', content.scrollHeight + 'px');
      if (icon) icon.style.transform = 'rotate(180deg)';
    }
  };

  // NOTE: Click handling is done by the CSP-compliant data-action handler at the bottom of this file.
  // The data-action handler looks for [data-action="toggle-accordion"] and calls toggleBrokenLinksFixAccordion.
  // Do NOT add another click handler here as it would cause double-toggle (accordion opens then immediately closes).

  // Switch tabs - ALWAYS define to ensure it's available
  window.switchBrokenLinksFixTab = function(accordionId, tabName) {
    console.log('[BrokenLinks] switchBrokenLinksFixTab called:', accordionId, tabName);
    const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
    if (!accordion) return;

    const tabs = accordion.querySelectorAll('.broken-links-fix-tab');
    const contents = accordion.querySelectorAll('.broken-links-fix-tab-content');

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
  };

  // Event delegation for tab clicks
  if (!window.__brokenLinksTabClickHandlerInitialized) {
    window.__brokenLinksTabClickHandlerInitialized = true;
    document.addEventListener('click', function(e) {
      const tab = e.target.closest('.broken-links-fix-tab');
      if (tab) {
        const accordion = tab.closest('.broken-links-fix-accordion');
        if (accordion) {
          const accordionId = accordion.getAttribute('data-fix-id');
          // Use data-tab attribute instead of parsing text (works with all languages)
          const tabName = tab.getAttribute('data-tab') || 'summary';
          console.log('[BrokenLinks] Event delegation tab click:', accordionId, tabName);
          window.switchBrokenLinksFixTab(accordionId, tabName);
        }
      }
    });
    console.log('[BrokenLinks] Tab click handler initialized');
  }

  // Copy code - ALWAYS define to ensure it's available
  window.copyBrokenLinksCode = function(elementId) {
      const codeElement = document.getElementById(elementId);
      if (!codeElement) return;

      const text = codeElement.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = codeElement.parentElement.querySelector('button');
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = t('reports.common.copied', 'Copied!');
          setTimeout(() => { btn.textContent = originalText; }, 2000);
        }
      });
    };
}

// Combined Recommendations + Export Content
function renderRecommendationsAndExportContent(data) {
  const recommendations = data.recommendations || [];

  // Initialize export handlers after render
  setTimeout(() => initExportHandlers(data), 100);

  return `
    <div>
      <!-- Recommendations Section -->
      ${renderRecommendationsContent(recommendations)}

      <!-- Export Section (inline) -->
      <div style="
        margin-top: 2rem;
        padding-top: 1.5rem;
        border-top: 1px solid #333;
      ">
        <h3 style="color: #00d9ff; margin: 0 0 0.75rem 0; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          ${t('reports.common.exportReportData', 'Export Report Data')}
        </h3>
        <p style="color: var(--r-text-faint, #9CA3AF); margin: 0 0 1rem 0; font-size: 0.85rem;">
          ${t('reports.brokenLinks.exportDesc', 'Download your broken links report in Excel or CSV format to share with your team or track fixes.')}
        </p>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <button id="exportExcelBtn" style="
            background: rgba(0,217,255,0.15);
            color: #00d9ff;
            border: 1px solid rgba(0,217,255,0.4);
            padding: 0.6rem 1.25rem;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s;
          " class="bl-export-btn-excel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            ${t('reports.common.exportToExcel', 'Export to Excel')}
          </button>
          <button id="exportCsvBtn" style="
            background: rgba(0,255,65,0.1);
            color: #00ff41;
            border: 1px solid rgba(0,255,65,0.3);
            padding: 0.6rem 1.25rem;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s;
          " class="bl-export-btn-csv">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            ${t('reports.common.exportToCsv', 'Export to CSV')}
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// NEW: Anchor Text Analysis
// ============================================
function renderAnchorAnalysisContent(analysis) {
  const qualityColor = analysis.qualityScore >= 80 ? '#00ff41' : 
                       analysis.qualityScore >= 60 ? '#ffd700' : 
                       analysis.qualityScore >= 40 ? '#ff8c00' : '#ff4444';
  
  return `
    <div>
      <h3 style="color: #00d9ff; margin: 0 0 0.75rem 0; font-size: 1rem;">>> ${t('reports.brokenLinks.anchorTextQuality', 'Anchor Text Quality Score')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1.5rem; font-size: 0.9rem;">
        ${t('reports.brokenLinks.anchorTextQualityDesc', 'Good anchor text describes the link destination and helps search engines understand page relevance.')}
      </p>
      
      <!-- Quality Score -->
      <div style="
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 1rem;
        background: ${qualityColor}10;
        border: 1px solid ${qualityColor}40;
        border-radius: 8px;
        margin-bottom: 1.5rem;
      ">
        <div style="
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid ${qualityColor};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 900;
          color: #000000;
        ">${analysis.qualityScore}%</div>
        <div>
          <div style="color: var(--r-text, #111827); font-weight: 600; margin-bottom: 0.25rem;">${t('reports.brokenLinks.anchorTextQualityScore', 'Anchor Text Quality Score')}</div>
          <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem;">
            ${t('reports.brokenLinks.linksHaveDescriptiveText', '{{descriptive}} of {{total}} links have descriptive anchor text', { descriptive: analysis.descriptiveCount, total: analysis.totalAnchors })}
          </div>
        </div>
      </div>
      
      <!-- Stats Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.1); border-radius: 8px;">
          <div style="font-size: 1.75rem; font-weight: 900; color: #00ff41;">${analysis.descriptiveCount}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.8rem;">${t('reports.brokenLinks.labels.descriptive', 'Descriptive')}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,140,0,0.1); border-radius: 8px;">
          <div style="font-size: 1.75rem; font-weight: 900; color: #ff8c00;">${analysis.genericCount}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.8rem;">${t('reports.brokenLinks.labels.generic', 'Generic')}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,68,68,0.1); border-radius: 8px;">
          <div style="font-size: 1.75rem; font-weight: 900; color: #ff4444;">${analysis.emptyCount}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.8rem;">${t('reports.brokenLinks.labels.empty', 'Empty')}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(0,217,255,0.1); border-radius: 8px;">
          <div style="font-size: 1.75rem; font-weight: 900; color: #00d9ff;">${analysis.imageOnlyCount}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.8rem;">${t('reports.brokenLinks.labels.imageLinks', 'Image Links')}</div>
        </div>
      </div>
      
      <!-- Over-used Anchors -->
      ${analysis.overUsedAnchors && analysis.overUsedAnchors.length > 0 ? `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: #ffd700; margin: 0 0 0.5rem 0; font-size: 0.95rem;">${t('reports.brokenLinks.frequentlyUsedAnchors', 'Frequently Used Anchors')}</h4>
          <p style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; margin-bottom: 0.75rem;">
            ${t('reports.brokenLinks.frequentlyUsedAnchorsDesc', 'Consider varying these to create a more natural link profile.')}
          </p>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${analysis.overUsedAnchors.map(a => `
              <span style="
                background: rgba(255,215,0,0.15);
                color: #ffd700;
                padding: 0.35rem 0.75rem;
                border-radius: 4px;
                font-size: 0.85rem;
              ">"${a.text}" <span style="opacity: 0.7;">(${a.count}×)</span></span>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Issues Table -->
      ${analysis.issues && analysis.issues.length > 0 ? `
        <h4 style="color: #ff8c00; margin: 0 0 0.5rem 0; font-size: 0.95rem;">${t('reports.brokenLinks.issuesToFix', 'Issues to Fix')}</h4>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 2px solid #333;">
                <th style="text-align: left; padding: 0.5rem; color: var(--r-text-muted, #6B7280);">${t('reports.brokenLinks.headers.anchorText', 'Anchor Text')}</th>
                <th style="text-align: left; padding: 0.5rem; color: var(--r-text-muted, #6B7280);">${t('reports.brokenLinks.headers.issue', 'Issue')}</th>
                <th style="text-align: left; padding: 0.5rem; color: var(--r-text-muted, #6B7280);">${t('reports.brokenLinks.headers.linkUrl', 'Link URL')}</th>
              </tr>
            </thead>
            <tbody>
              ${analysis.issues.slice(0, 20).map(issue => `
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 0.5rem; color: ${issue.category === 'empty' ? '#ff4444' : '#ff8c00'};">
                    ${issue.text || `<em style="opacity: 0.5;">${t('reports.brokenLinks.emptyPlaceholder', '[empty]')}</em>`}
                  </td>
                  <td style="padding: 0.5rem; color: var(--r-text-muted, #6B7280); font-size: 0.8rem;">${translateIssueDescription(issue.issue)}</td>
                  <td style="padding: 0.5rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <a href="${issue.url}" target="_blank" rel="noopener" style="color: #00d9ff;">${truncateUrl(issue.url)}</a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${analysis.issues.length > 20 ? `<p style="margin-top: 0.5rem; color: var(--r-text-faint, #9CA3AF); font-size: 0.8rem;">${t('reports.common.showingFirstOf', 'Showing first {{shown}} of {{total}} issues', { shown: 20, total: analysis.issues.length })}</p>` : ''}
        </div>
      ` : `<p style="color: #00ff41;">${t('reports.brokenLinks.allAnchorTextsGood', 'All anchor texts look good!')}</p>`}
    </div>
  `;
}

// ============================================
// NEW: Link Attributes Audit
// ============================================
function renderAttributeAnalysisContent(analysis) {
  const securityScore = analysis.insecureExternalLinks === 0 ? 100 :
    Math.round((analysis.secureExternalLinks / (analysis.secureExternalLinks + analysis.insecureExternalLinks)) * 100);
  const securityColor = securityScore === 100 ? '#00ff41' : securityScore >= 80 ? '#ffd700' : '#ff4444';
  const isUnlocked = window.ProAccess?.hasProAccess?.() || false;
  
  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="color: #9933ff; margin: 0; font-size: 1rem;">>> ${t('reports.brokenLinks.linkAttributesOverview', 'Link Attributes Overview')}</h3>
        ${renderExportButton('exportSecurityIssuesToExcel', '#9933ff', isUnlocked)}
      </div>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1.5rem; font-size: 0.9rem;">
        ${t('reports.brokenLinks.linkAttributesDesc', 'Proper link attributes improve security, SEO, and control how link equity flows through your site.')}
      </p>
      
      <!-- Attribute Distribution -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 1rem; background: rgba(153,51,255,0.1); border-radius: 8px; border: 1px solid rgba(153,51,255,0.3);">
          <div style="font-size: 1.5rem; font-weight: 900; color: #9933ff;">${analysis.nofollowCount}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.75rem;">${t('reports.brokenLinks.labels.nofollow', 'nofollow')}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(0,217,255,0.1); border-radius: 8px; border: 1px solid rgba(0,217,255,0.3);">
          <div style="font-size: 1.5rem; font-weight: 900; color: #00d9ff;">${analysis.sponsoredCount}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.75rem;">${t('reports.brokenLinks.labels.sponsored', 'sponsored')}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,140,0,0.1); border-radius: 8px; border: 1px solid rgba(255,140,0,0.3);">
          <div style="font-size: 1.5rem; font-weight: 900; color: #ff8c00;">${analysis.ugcCount}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.75rem;">${t('reports.brokenLinks.labels.ugc', 'ugc')}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.1); border-radius: 8px; border: 1px solid rgba(0,255,65,0.3);">
          <div style="font-size: 1.5rem; font-weight: 900; color: #00ff41;">${analysis.secureExternalLinks}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.75rem;">${t('reports.brokenLinks.labels.secureExternal', 'secure external')}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,68,68,0.1); border-radius: 8px; border: 1px solid rgba(255,68,68,0.3);">
          <div style="font-size: 1.5rem; font-weight: 900; color: #ff4444;">${analysis.insecureExternalLinks}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.75rem;">${t('reports.brokenLinks.labels.insecure', 'insecure')}</div>
        </div>
      </div>
      
      <!-- Security Status -->
      <div style="
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: ${securityColor}10;
        border: 1px solid ${securityColor}40;
        border-radius: 8px;
        margin-bottom: 1.5rem;
      ">
        <span style="font-size: 2rem;">${securityScore === 100 ? '🛡️' : '⚠️'}</span>
        <div>
          <div style="color: ${securityColor}; font-weight: 600;">
            ${securityScore === 100 ? t('reports.brokenLinks.allExternalLinksSecure', 'All external links are secure!') :
              t('reports.brokenLinks.externalLinksMissingSecurity', '{{count}} external link(s) missing security attributes', { count: analysis.insecureExternalLinks })}
          </div>
          <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem;">
            ${t('reports.brokenLinks.externalLinksSecurityTip', 'External links opening in new tabs should have rel="noopener noreferrer" to prevent tabnabbing')}
          </div>
        </div>
      </div>
      
      <!-- Internal Link Flow -->
      <div style="
        padding: 1rem;
        background: rgba(255,255,255,0.03);
        border-radius: 8px;
        margin-bottom: 1.5rem;
      ">
        <h4 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 0.95rem;">${t('reports.brokenLinks.internalLinkEquityFlow', 'Internal Link Equity Flow')}</h4>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="flex: 1; background: #222; border-radius: 4px; height: 24px; overflow: hidden;">
            <div style="
              width: ${analysis.internalLinkFlow.ratio};
              height: 100%;
              background: linear-gradient(90deg, #00ff41, #00d9ff);
            "></div>
          </div>
          <span style="color: #00ff41; font-weight: 600; min-width: 60px;">${analysis.internalLinkFlow.ratio}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; color: var(--r-text-faint, #9CA3AF); font-size: 0.8rem;">
          <span>${t('reports.brokenLinks.followed', 'Followed')}: ${analysis.internalLinkFlow.followed}</span>
          <span>${t('reports.brokenLinks.nofollowed', 'Nofollowed')}: ${analysis.internalLinkFlow.nofollowed}</span>
        </div>
      </div>
      
      <!-- Security Issues Table -->
      ${analysis.securityIssues && analysis.securityIssues.length > 0 ? `
        <h4 style="color: #ff4444; margin: 0 0 0.5rem 0; font-size: 0.95rem;">${t('reports.brokenLinks.securityIssuesToFix', 'Security Issues to Fix')}</h4>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 2px solid #333;">
                <th style="text-align: left; padding: 0.5rem; color: var(--r-text-muted, #6B7280);">${t('reports.brokenLinks.headers.url', 'URL')}</th>
                <th style="text-align: left; padding: 0.5rem; color: var(--r-text-muted, #6B7280);">${t('reports.brokenLinks.headers.issue', 'Issue')}</th>
                <th style="text-align: left; padding: 0.5rem; color: var(--r-text-muted, #6B7280);">${t('reports.brokenLinks.headers.fix', 'Fix')}</th>
              </tr>
            </thead>
            <tbody>
              ${analysis.securityIssues.slice(0, 15).map(issue => `
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 0.5rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <a href="${issue.url}" target="_blank" rel="noopener noreferrer" style="color: #ff6b6b;">${truncateUrl(issue.url)}</a>
                  </td>
                  <td style="padding: 0.5rem; color: var(--r-text-muted, #6B7280); font-size: 0.8rem;">${issue.risk}</td>
                  <td style="padding: 0.5rem; color: #00ff41; font-size: 0.8rem; font-family: monospace;">${issue.fix}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${analysis.securityIssues.length > 15 ? `<p style="margin-top: 0.5rem; color: var(--r-text-faint, #9CA3AF); font-size: 0.8rem;">${t('reports.common.showingFirstOf', 'Showing first {{shown}} of {{total}} issues', { shown: 15, total: analysis.securityIssues.length })}</p>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================
// NEW: Redirect Chain Analysis
// ============================================
function renderRedirectAnalysisContent(analysis) {
  return `
    <div>
      <h3 style="color: #ffd700; margin: 0 0 0.75rem 0; font-size: 1rem;">>> ${t('reports.brokenLinks.redirectAnalysis', 'Redirect Analysis')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin-bottom: 1.5rem; font-size: 0.9rem;">
        ${t('reports.brokenLinks.redirectAnalysisDesc', 'Detailed breakdown of redirect types and chain lengths across your site.')}
      </p>
      
      <!-- Redirect Type Distribution -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.1); border-radius: 8px; border: 1px solid rgba(0,255,65,0.3);">
          <div style="font-size: 1.75rem; font-weight: 900; color: #00ff41;">${analysis.permanent301 + analysis.permanent308}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.8rem;">${t('reports.brokenLinks.labels.permanent301308', 'Permanent (301/308)')}</div>
          <div style="color: #00ff41; font-size: 0.7rem; margin-top: 0.25rem;">${t('reports.brokenLinks.passesLinkEquity', 'Passes link equity')}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,140,0,0.1); border-radius: 8px; border: 1px solid rgba(255,140,0,0.3);">
          <div style="font-size: 1.75rem; font-weight: 900; color: #ff8c00;">${analysis.temporary302 + analysis.temporary307}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.8rem;">${t('reports.brokenLinks.labels.temporary302307', 'Temporary (302/307)')}</div>
          <div style="color: #ff8c00; font-size: 0.7rem; margin-top: 0.25rem;">${t('reports.brokenLinks.limitedEquity', 'Limited equity')}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,68,68,0.1); border-radius: 8px; border: 1px solid rgba(255,68,68,0.3);">
          <div style="font-size: 1.75rem; font-weight: 900; color: #ff4444;">${analysis.longChains.length}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.8rem;">${t('reports.brokenLinks.labels.longChains', 'Long Chains (>2 hops)')}</div>
          <div style="color: #ff4444; font-size: 0.7rem; margin-top: 0.25rem;">${t('reports.brokenLinks.slowAndLossy', 'Slow & lossy')}</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: ${analysis.loops.length > 0 ? 'rgba(255,0,0,0.2)' : 'rgba(0,255,65,0.1)'}; border-radius: 8px; border: 1px solid ${analysis.loops.length > 0 ? 'rgba(255,0,0,0.5)' : 'rgba(0,255,65,0.3)'};">
          <div style="font-size: 1.75rem; font-weight: 900; color: ${analysis.loops.length > 0 ? '#ff0000' : '#00ff41'};">${analysis.loops.length}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.8rem;">${t('reports.brokenLinks.labels.redirectLoops', 'Redirect Loops')}</div>
          <div style="color: ${analysis.loops.length > 0 ? '#ff0000' : '#00ff41'}; font-size: 0.7rem; margin-top: 0.25rem;">
            ${analysis.loops.length > 0 ? t('reports.brokenLinks.critical', 'Critical!') : t('reports.brokenLinks.noneFound', 'None found')}
          </div>
        </div>
      </div>
      
      <!-- Chain Length Distribution -->
      ${Object.keys(analysis.chainLengths).length > 0 ? `
        <div style="
          padding: 1rem;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
          margin-bottom: 1.5rem;
        ">
          <h4 style="color: var(--r-text-muted, #6B7280); margin: 0 0 0.75rem 0; font-size: 0.9rem;">${t('reports.brokenLinks.chainLengthDistribution', 'Chain Length Distribution')}</h4>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${Object.entries(analysis.chainLengths).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).map(([length, count]) => {
              const color = parseInt(length) <= 1 ? '#00ff41' : parseInt(length) <= 2 ? '#ffd700' : '#ff4444';
              return `
                <div style="
                  padding: 0.5rem 1rem;
                  background: ${color}15;
                  border: 1px solid ${color}40;
                  border-radius: 4px;
                  text-align: center;
                ">
                  <span style="color: ${color}; font-weight: 600;">${count}</span>
                  <span style="color: var(--r-text-faint, #9CA3AF); font-size: 0.8rem;"> × ${length} ${parseInt(length) !== 1 ? t('reports.brokenLinks.hops', 'hops') : t('reports.brokenLinks.hop', 'hop')}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Long Chains Detail -->
      ${analysis.longChains && analysis.longChains.length > 0 ? `
        <h4 style="color: #ff4444; margin: 0 0 0.5rem 0; font-size: 0.95rem;">${t('reports.brokenLinks.longRedirectChains', 'Long Redirect Chains (>2 hops)')}</h4>
        <p style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; margin-bottom: 0.75rem;">
          ${t('reports.brokenLinks.longRedirectChainsDesc', 'These chains slow down page load. Update links to point directly to final destination.')}
        </p>
        <div style="display: grid; gap: 0.75rem;">
          ${analysis.longChains.slice(0, 10).map(chain => `
            <div style="
              padding: 0.75rem;
              background: rgba(255,68,68,0.1);
              border: 1px solid rgba(255,68,68,0.3);
              border-radius: 6px;
            ">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span style="color: #ff4444; font-weight: 600;">${chain.chainLength} ${t('reports.brokenLinks.hops', 'hops')}</span>
                <span style="color: var(--r-text-faint, #9CA3AF); font-size: 0.8rem;">→</span>
              </div>
              <div style="font-family: monospace; font-size: 0.8rem; color: var(--r-text-muted, #6B7280); overflow-x: auto;">
                <span style="color: #ff8c00;">${truncateUrl(chain.originalUrl)}</span>
                ${chain.chain.slice(0, 3).map(r => `
                  <span style="color: #666;"> → </span>
                  <span style="color: #ffd700;">${r.statusCode || '→'}</span>
                  <span style="color: #666;"> → </span>
                  <span style="color: #00d9ff;">${truncateUrl(r.url)}</span>
                `).join('')}
                ${chain.chain.length > 3 ? `<span style="color: #666;"> ... ${t('reports.common.plusMore', '+{{count}} more', { count: chain.chain.length - 3 })}</span>` : ''}
                ${chain.finalDestination ? `
                  <span style="color: #666;"> → </span>
                  <span style="color: #00ff41;">✓ ${truncateUrl(chain.finalDestination)}</span>
                ` : ''}
              </div>
            </div>
          `).join('')}
          ${analysis.longChains.length > 10 ? `<p style="color: var(--r-text-faint, #9CA3AF); font-size: 0.8rem;">${t('reports.brokenLinks.moreLongChains', '+{{count}} more long chains', { count: analysis.longChains.length - 10 })}</p>` : ''}
        </div>
      ` : `<p style="color: #00ff41; margin-top: 1rem;">${t('reports.brokenLinks.noProblematicRedirects', 'No problematic redirect chains detected!')}</p>`}
      
      <!-- Loops Detail -->
      ${analysis.loops && analysis.loops.length > 0 ? `
        <h4 style="color: #ff0000; margin: 1rem 0 0.5rem 0; font-size: 0.95rem;">${t('reports.brokenLinks.redirectLoopsDetected', 'Redirect Loops Detected')}</h4>
        <p style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; margin-bottom: 0.75rem;">
          ${t('reports.brokenLinks.redirectLoopsDetectedDesc', 'These redirects form infinite loops. Fix immediately!')}
        </p>
        ${analysis.loops.slice(0, 5).map(loop => `
          <div style="
            padding: 0.75rem;
            background: rgba(255,0,0,0.15);
            border: 2px solid #ff0000;
            border-radius: 6px;
            margin-bottom: 0.5rem;
          ">
            <div style="color: #ff0000; font-weight: 600; margin-bottom: 0.25rem;">${t('reports.brokenLinks.loopStartingFrom', 'Loop starting from:')}</div>
            <a href="${loop.url}" target="_blank" rel="noopener" style="color: #ff6b6b; font-family: monospace; font-size: 0.85rem;">${loop.url}</a>
          </div>
        `).join('')}
      ` : ''}
      
      <!-- Redirects Ending in Error -->
      ${analysis.endsInError && analysis.endsInError.length > 0 ? `
        <h4 style="color: #ff4444; margin: 1rem 0 0.5rem 0; font-size: 0.95rem;">${t('reports.brokenLinks.redirectsEndingInErrors', 'Redirects Ending in Errors')}</h4>
        <p style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem; margin-bottom: 0.75rem;">
          ${t('reports.brokenLinks.redirectsEndingInErrorsDesc', 'These redirect chains end in error pages instead of valid content.')}
        </p>
        ${analysis.endsInError.slice(0, 5).map(err => `
          <div style="
            padding: 0.5rem 0.75rem;
            background: rgba(255,68,68,0.1);
            border-left: 3px solid #ff4444;
            margin-bottom: 0.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <a href="${err.url}" target="_blank" rel="noopener" style="color: #ff6b6b; font-size: 0.85rem;">${truncateUrl(err.url)}</a>
            <span style="background: #ff444420; color: #ff4444; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
              ${err.finalStatusCode || t('reports.common.err', 'ERR')}
            </span>
          </div>
        `).join('')}
      ` : ''}
    </div>
  `;
}

// Helper functions
function truncateUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    if (path.length > 50) {
      return parsed.hostname + path.substring(0, 47) + '...';
    }
    return parsed.hostname + path;
  } catch (e) {
    return url.length > 60 ? url.substring(0, 57) + '...' : url;
  }
}

function getAccentPrimaryHex() {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-primary').trim();
  return value || '#00ff41';
}

function getGradeColor(grade) {
  if (grade === 'A') return getAccentPrimaryHex();
  if (grade === 'B') return '#ffd700';
  if (grade === 'C') return '#ff8c00';
  if (grade === 'D') return '#ff4444';
  if (grade === 'F') return '#ff0000';
  return '#888888';
}

function getGradeName(grade) {
  const names = {
    'A': t('reports.common.grades.excellent', 'Excellent'),
    'B': t('reports.common.grades.good', 'Good'),
    'C': t('reports.common.grades.fair', 'Fair'),
    'D': t('reports.common.grades.poor', 'Poor'),
    'F': t('reports.common.grades.critical', 'Critical')
  };
  return names[grade] || t('reports.common.grades.unknown', 'Unknown');
}

function getScoreColor(score) {
  const stops = [
    [0,'#E53935'],[5,'#E14127'],[10,'#DD4E1A'],[15,'#DA5B0E'],
    [20,'#D96A06'],[25,'#E07E00'],[30,'#E89200'],[35,'#F0A400'],
    [40,'#F5B300'],[45,'#FAC200'],[50,'#FFD000'],[55,'#FFD600'],
    [60,'#FFDC00'],[65,'#FFE100'],[70,'#F0DD00'],[75,'#D2D400'],
    [80,'#A0C800'],[85,'#6BBD28'],[90,'#38B249'],[95,'#1FAD4F'],
    [100,'#0AA64F']
  ];
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const idx = Math.min(Math.floor(s / 5), 19);
  const [s1, c1] = stops[idx];
  const [, c2] = stops[Math.min(idx + 1, 20)];
  const t = (s - s1) / 5;
  const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [r1,g1,b1] = p(c1);
  const [r2,g2,b2] = p(c2);
  const r = Math.round(r1+(r2-r1)*t);
  const g = Math.round(g1+(g2-g1)*t);
  const b = Math.round(b1+(b2-b1)*t);
  return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
}

function createProUpgradePrompt(message) {
  return `
    <div style="
      text-align: center;
      padding: 2rem;
      background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,140,0,0.05) 100%);
      border: 1px dashed rgba(255,215,0,0.4);
      border-radius: 12px;
    ">
      <div style="
        width: 60px;
        height: 60px;
        margin: 0 auto 1rem;
        background: linear-gradient(135deg, #ffd700, #ff8c00);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
      ">🔒</div>
      <h3 style="color: #ffd700; margin: 0 0 0.5rem 0; font-size: 1.1rem;">${t('reports.common.proFeature', 'Pro Feature')}</h3>
      <p style="color: var(--r-text-muted, #6B7280); margin: 0 0 1.5rem 0; font-size: 0.9rem;">${message}</p>
      <button data-action="open-pricing-modal" class="bl-upgrade-btn" style="
        background: linear-gradient(135deg, #ffd700, #ff8c00);
        color: #000;
        border: none;
        padding: 0.75rem 2rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      ">
        ${t('reports.common.upgradeToPro', 'Upgrade to Pro')}
      </button>
    </div>
  `;
}

async function checkProAccess() {
  const reportId = document.body.getAttribute('data-report-id');

  // Check ProReportBlock (new billing model) - hasAccess checks both Pro and purchased reports
  if (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function') {
    if (window.ProReportBlock.hasAccess(reportId)) {
      return true;
    }
  }

  // Check if CreditsManager has Pro status
  if (window.CreditsManager && typeof window.CreditsManager.hasProAccess === 'function') {
    return await window.CreditsManager.hasProAccess();
  }
  // Fallback: check for reportUnlocked in session
  if (reportId && window.CreditsManager && window.CreditsManager.isReportUnlocked) {
    return window.CreditsManager.isReportUnlocked(reportId);
  }
  return false;
}

function openPricingModal() {
  if (window.PricingModal && typeof window.PricingModal.open === 'function') {
    window.PricingModal.open();
  } else {
    alert(t('reports.common.pleaseSignUpPro', 'Please sign up for Pro access at sitemechanic.io/pricing'));
  }
}

// Global export handler for ProReportBlock
window.exportExcel = async function(format, buttonEl) {
  const data = window.currentBrokenLinksResults;
  if (!data) {
    console.error('No broken links data available for export');
    return;
  }
  exportToExcel(data);
};

// ============================================
// EXPORT SECTION (Pro Feature)
// ============================================
function createExportSection() {
  return `
    <div style="
      background: linear-gradient(135deg, rgba(0,217,255,0.1) 0%, rgba(0,255,65,0.05) 100%);
      border: 1px solid rgba(0,217,255,0.3);
      border-radius: 12px;
      padding: 1.5rem;
    ">
      <h3 style="color: #00d9ff; margin: 0 0 0.75rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
        ${t('reports.brokenLinks.exportBrokenLinksData', 'Export Broken Links Data')}
        <span style="
          background: linear-gradient(135deg, #ffd700, #ff8c00);
          color: #000;
          font-size: 0.6rem;
          font-weight: 700;
          padding: 0.15rem 0.4rem;
          border-radius: 3px;
          text-transform: uppercase;
        ">PRO</span>
      </h3>
      <p style="color: var(--r-text-faint, #9CA3AF); margin: 0 0 1rem 0; font-size: 0.85rem;">
        ${t('reports.brokenLinks.exportExcelDesc', 'Download your broken links report in Excel format to share with your team or track fixes.')}
      </p>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <button id="exportExcelBtn" style="
          background: rgba(0,217,255,0.15);
          color: #00d9ff;
          border: 1px solid rgba(0,217,255,0.4);
          padding: 0.6rem 1.25rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        " class="bl-export-btn-excel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          ${t('reports.common.exportToExcel', 'Export to Excel')}
        </button>
        <button id="exportCsvBtn" style="
          background: rgba(0,255,65,0.1);
          color: #00ff41;
          border: 1px solid rgba(0,255,65,0.3);
          padding: 0.6rem 1.25rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        " class="bl-export-btn-csv">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          ${t('reports.common.exportToCsv', 'Export to CSV')}
        </button>
      </div>
    </div>
  `;
}

function initExportHandlers(data) {
  const excelBtn = document.getElementById('exportExcelBtn');
  const csvBtn = document.getElementById('exportCsvBtn');

  if (excelBtn) {
    excelBtn.addEventListener('click', async () => {
      const hasPro = await checkProAccess();
      if (!hasPro) {
        openPricingModal();
        return;
      }
      exportToExcel(data);
    });
  }

  if (csvBtn) {
    csvBtn.addEventListener('click', async () => {
      const hasPro = await checkProAccess();
      if (!hasPro) {
        openPricingModal();
        return;
      }
      exportToCsv(data);
    });
  }
}

function exportToExcel(data) {
  // Create Excel-compatible XML (SpreadsheetML)
  const worksheets = [];

  // Sheet 1: Summary
  const summaryRows = [
    [t('reports.brokenLinks.title', 'Broken Link Analysis')],
    [t('reports.common.url', 'URL'), data.url],
    [t('reports.common.scanDate', 'Scan Date'), window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString()],
    [t('reports.brokenLinks.pagesScanned', 'Pages Scanned'), data.pagesScanned],
    [t('reports.brokenLinks.totalLinksFound', 'Total Links Found'), data.totalLinks],
    [''],
    [t('reports.common.summary', 'Summary')],
    [t('reports.brokenLinks.brokenLinks', 'Broken Links'), data.summary.broken],
    [t('reports.brokenLinks.redirects', 'Redirects'), data.summary.redirects],
    [t('reports.brokenLinks.cards.working', 'Working'), data.summary.working],
    [t('reports.brokenLinks.cards.external', 'External'), data.summary.external],
    [t('reports.common.score', 'Score'), data.score],
    [t('reports.common.grade', 'Grade'), data.grade]
  ];
  worksheets.push({ name: t('reports.common.summary', 'Summary'), rows: summaryRows });

  // Sheet 2: Broken Links
  if (data.links.broken && data.links.broken.length > 0) {
    const brokenRows = [[t('reports.common.url', 'URL'), t('reports.brokenLinks.headers.status', 'Status'), t('reports.brokenLinks.headers.linkText', 'Link Text'), t('reports.brokenLinks.headers.foundOnPages', 'Found On Pages')]];
    data.links.broken.forEach(link => {
      brokenRows.push([
        link.url,
        link.statusCode || t('reports.common.err', 'ERR'),
        link.text || '',
        link.foundOn.length
      ]);
    });
    worksheets.push({ name: t('reports.brokenLinks.brokenLinks', 'Broken Links'), rows: brokenRows });
  }

  // Sheet 3: Redirects
  if (data.links.redirects && data.links.redirects.length > 0) {
    const redirectRows = [[t('reports.brokenLinks.headers.originalUrl', 'Original URL'), t('reports.brokenLinks.headers.status', 'Status'), t('reports.brokenLinks.headers.redirectType', 'Redirect Type'), t('reports.brokenLinks.headers.chainLength', 'Chain Length'), t('reports.brokenLinks.headers.finalDestination', 'Final Destination')]];
    data.links.redirects.forEach(link => {
      redirectRows.push([
        link.url,
        link.statusCode,
        link.redirectType || '',
        (link.redirectChain || []).length,
        link.finalDestination || ''
      ]);
    });
    worksheets.push({ name: t('reports.brokenLinks.redirects', 'Redirects'), rows: redirectRows });
  }

  // Sheet 4: Recommendations
  if (data.recommendations && data.recommendations.length > 0) {
    const recRows = [[t('reports.common.priority', 'Priority'), t('reports.common.category', 'Category'), t('reports.common.message', 'Message'), t('reports.common.detail', 'Detail'), t('reports.common.impact', 'Impact')]];
    data.recommendations.forEach(rec => {
      recRows.push([
        rec.priority,
        rec.category,
        rec.message,
        rec.detail,
        rec.impact
      ]);
    });
    worksheets.push({ name: t('reports.common.recommendations', 'Recommendations'), rows: recRows });
  }

  // Generate Excel XML
  let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';

  worksheets.forEach(sheet => {
    xml += `<Worksheet ss:Name="${escapeXml(sheet.name)}">\n<Table>\n`;
    sheet.rows.forEach(row => {
      xml += '<Row>\n';
      row.forEach(cell => {
        const value = cell !== null && cell !== undefined ? String(cell) : '';
        const type = typeof cell === 'number' ? 'Number' : 'String';
        xml += `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>\n`;
      });
      xml += '</Row>\n';
    });
    xml += '</Table>\n</Worksheet>\n';
  });

  xml += '</Workbook>';

  // Download
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `broken-links-report-${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export working links to Excel - called from inline button
window.exportWorkingLinksToExcel = async function() {
  const hasPro = await checkProAccess();
  if (!hasPro) {
    openPricingModal();
    return;
  }
  
  const data = window.currentBrokenLinksResults;
  if (!data || !data.links || !data.links.working) {
    alert(t('reports.brokenLinks.noLinkDataExport', 'No link data available to export'));
    return;
  }

  const rows = [
    [t('reports.brokenLinks.export.workingLinksExport', 'Working Links Export')],
    [t('reports.common.url', 'URL'), data.url],
    [t('reports.common.scanDate', 'Scan Date'), window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString()],
    [t('reports.brokenLinks.export.totalWorkingLinks', 'Total Working Links'), data.summary.working],
    [''],
    [t('reports.common.url', 'URL'), t('reports.brokenLinks.headers.linkText', 'Link Text'), t('reports.brokenLinks.headers.foundOnPages', 'Found On Pages')]
  ];

  data.links.working.forEach(link => {
    rows.push([
      link.url,
      link.text || '',
      link.foundOn ? link.foundOn.length : 1
    ]);
  });

  // Generate Excel XML
  let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += `<Worksheet ss:Name="${escapeXml(t('reports.brokenLinks.cards.working', 'Working'))}">\n<Table>\n`;

  rows.forEach(row => {
    xml += '<Row>\n';
    row.forEach(cell => {
      const value = cell !== null && cell !== undefined ? String(cell) : '';
      const type = typeof cell === 'number' ? 'Number' : 'String';
      xml += `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>\n`;
    });
    xml += '</Row>\n';
  });

  xml += '</Table>\n</Worksheet>\n</Workbook>';

  // Download
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `working-links-${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Export broken links to Excel
window.exportBrokenLinksToExcel = async function() {
  const hasPro = await checkProAccess();
  if (!hasPro) {
    openPricingModal();
    return;
  }
  
  const data = window.currentBrokenLinksResults;
  if (!data || !data.links || !data.links.broken || data.links.broken.length === 0) {
    alert(t('reports.brokenLinks.noBrokenLinksExport', 'No broken links to export'));
    return;
  }

  const rows = [
    [t('reports.brokenLinks.export.brokenLinksExport', 'Broken Links Export')],
    [t('reports.common.url', 'URL'), data.url],
    [t('reports.common.scanDate', 'Scan Date'), window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString()],
    [t('reports.brokenLinks.export.totalBrokenLinks', 'Total Broken Links'), data.links.broken.length],
    [''],
    [t('reports.common.url', 'URL'), t('reports.brokenLinks.headers.status', 'Status'), t('reports.brokenLinks.headers.linkText', 'Link Text'), t('reports.brokenLinks.headers.foundOnPages', 'Found On Pages')]
  ];

  data.links.broken.forEach(link => {
    rows.push([
      link.url,
      link.statusCode || t('reports.common.err', 'ERR'),
      link.text || '',
      link.foundOn ? link.foundOn.length : 1
    ]);
  });

  downloadExcelFile(rows, t('reports.brokenLinks.brokenLinks', 'Broken Links'), `broken-links-${new Date().toISOString().split('T')[0]}.xls`);
};

// Export redirects to Excel
window.exportRedirectsToExcel = async function() {
  const hasPro = await checkProAccess();
  if (!hasPro) {
    openPricingModal();
    return;
  }
  
  const data = window.currentBrokenLinksResults;
  if (!data || !data.links || !data.links.redirects || data.links.redirects.length === 0) {
    alert(t('reports.brokenLinks.noRedirectsExport', 'No redirects to export'));
    return;
  }

  const rows = [
    [t('reports.brokenLinks.export.redirectsExport', 'Redirects Export')],
    [t('reports.common.url', 'URL'), data.url],
    [t('reports.common.scanDate', 'Scan Date'), window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString()],
    [t('reports.brokenLinks.export.totalRedirects', 'Total Redirects'), data.links.redirects.length],
    [''],
    [t('reports.brokenLinks.headers.originalUrl', 'Original URL'), t('reports.brokenLinks.headers.status', 'Status'), t('reports.brokenLinks.headers.redirectType', 'Redirect Type'), t('reports.brokenLinks.headers.chainLength', 'Chain Length'), t('reports.brokenLinks.headers.finalDestination', 'Final Destination')]
  ];

  data.links.redirects.forEach(link => {
    rows.push([
      link.url,
      link.statusCode || '',
      link.redirectType || '',
      (link.redirectChain || []).length,
      link.finalDestination || ''
    ]);
  });

  downloadExcelFile(rows, t('reports.brokenLinks.redirects', 'Redirects'), `redirects-${new Date().toISOString().split('T')[0]}.xls`);
};

// Export external links to Excel
window.exportExternalLinksToExcel = async function() {
  const hasPro = await checkProAccess();
  if (!hasPro) {
    openPricingModal();
    return;
  }
  
  const data = window.currentBrokenLinksResults;
  if (!data || !data.links || !data.links.external || data.links.external.length === 0) {
    alert(t('reports.brokenLinks.noExternalLinksExport', 'No external links to export'));
    return;
  }

  const rows = [
    [t('reports.brokenLinks.export.externalLinksExport', 'External Links Export')],
    [t('reports.common.url', 'URL'), data.url],
    [t('reports.common.scanDate', 'Scan Date'), window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString()],
    [t('reports.brokenLinks.export.totalExternalLinks', 'Total External Links'), data.summary.external],
    [''],
    [t('reports.brokenLinks.headers.externalUrl', 'External URL'), t('reports.brokenLinks.headers.linkText', 'Link Text'), t('reports.brokenLinks.headers.status', 'Status'), t('reports.brokenLinks.headers.foundOnPages', 'Found On Pages')]
  ];

  data.links.external.forEach(link => {
    rows.push([
      link.url,
      link.text || '',
      link.statusCode || t('reports.common.ok', 'OK'),
      link.foundOn ? link.foundOn.length : 1
    ]);
  });

  downloadExcelFile(rows, t('reports.brokenLinks.cards.external', 'External'), `external-links-${new Date().toISOString().split('T')[0]}.xls`);
};

// Export security issues (Link Attributes Audit) to Excel
window.exportSecurityIssuesToExcel = async function() {
  const hasPro = await checkProAccess();
  if (!hasPro) {
    openPricingModal();
    return;
  }
  
  const data = window.currentBrokenLinksResults;
  if (!data || !data.attributeAnalysis) {
    alert(t('reports.brokenLinks.noAttributeDataExport', 'No link attribute data to export'));
    return;
  }

  const analysis = data.attributeAnalysis;
  const rows = [
    [t('reports.brokenLinks.export.linkAttributesAuditExport', 'Link Attributes Audit Export')],
    [t('reports.common.url', 'URL'), data.url],
    [t('reports.common.scanDate', 'Scan Date'), window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString()],
    [''],
    [t('reports.common.summary', 'Summary')],
    [t('reports.brokenLinks.export.nofollowLinks', 'Nofollow Links'), analysis.nofollowCount],
    [t('reports.brokenLinks.export.sponsoredLinks', 'Sponsored Links'), analysis.sponsoredCount],
    [t('reports.brokenLinks.export.ugcLinks', 'UGC Links'), analysis.ugcCount],
    [t('reports.brokenLinks.export.secureExternalLinks', 'Secure External Links'), analysis.secureExternalLinks],
    [t('reports.brokenLinks.export.insecureExternalLinks', 'Insecure External Links'), analysis.insecureExternalLinks],
    [''],
    [t('reports.brokenLinks.internalLinkEquityFlow', 'Internal Link Equity Flow')],
    [t('reports.brokenLinks.followed', 'Followed'), analysis.internalLinkFlow?.followed || 0],
    [t('reports.brokenLinks.nofollowed', 'Nofollowed'), analysis.internalLinkFlow?.nofollowed || 0],
    [t('reports.common.ratio', 'Ratio'), analysis.internalLinkFlow?.ratio || t('reports.common.na', 'N/A')],
    ['']
  ];

  // Add security issues if any
  if (analysis.securityIssues && analysis.securityIssues.length > 0) {
    rows.push([t('reports.brokenLinks.securityIssuesToFix', 'Security Issues to Fix')]);
    rows.push([t('reports.common.url', 'URL'), t('reports.brokenLinks.headers.issue', 'Issue'), t('reports.brokenLinks.export.recommendedFix', 'Recommended Fix')]);
    analysis.securityIssues.forEach(issue => {
      rows.push([
        issue.url,
        issue.risk || t('reports.brokenLinks.export.missingSecurityAttributes', 'Missing security attributes'),
        issue.fix || t('reports.brokenLinks.export.addRelNoopener', 'Add rel=')
      ]);
    });
  }

  downloadExcelFile(rows, t('reports.brokenLinks.linkAttributesAudit', 'Link Attributes Audit'), `link-attributes-audit-${new Date().toISOString().split('T')[0]}.xls`);
};
// Shared Excel download helper
function downloadExcelFile(rows, sheetName, filename) {
  let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += `<Worksheet ss:Name="${escapeXml(sheetName)}">\n<Table>\n`;

  rows.forEach(row => {
    xml += '<Row>\n';
    row.forEach(cell => {
      const value = cell !== null && cell !== undefined ? String(cell) : '';
      const type = typeof cell === 'number' ? 'Number' : 'String';
      xml += `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>\n`;
    });
    xml += '</Row>\n';
  });

  xml += '</Table>\n</Worksheet>\n</Workbook>';

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportToCsv(data) {
  const rows = [
    [t('reports.brokenLinks.title', 'Broken Link Analysis')],
    [t('reports.common.url', 'URL'), data.url],
    [t('reports.common.scanDate', 'Scan Date'), window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString()],
    [''],
    [t('reports.brokenLinks.brokenLinks', 'Broken Links')],
    [t('reports.common.url', 'URL'), t('reports.brokenLinks.headers.status', 'Status'), t('reports.brokenLinks.headers.linkText', 'Link Text'), t('reports.brokenLinks.headers.foundOnPages', 'Found On Pages')]
  ];

  if (data.links.broken) {
    data.links.broken.forEach(link => {
      rows.push([
        link.url,
        link.statusCode || t('reports.common.err', 'ERR'),
        link.text || '',
        link.foundOn.length
      ]);
    });
  }

  rows.push(['']);
  rows.push([t('reports.brokenLinks.redirects', 'Redirects')]);
  rows.push([t('reports.brokenLinks.headers.originalUrl', 'Original URL'), t('reports.brokenLinks.headers.status', 'Status'), t('reports.brokenLinks.headers.redirectType', 'Redirect Type'), t('reports.brokenLinks.headers.chainLength', 'Chain Length'), t('reports.brokenLinks.headers.finalDestination', 'Final Destination')]);

  if (data.links.redirects) {
    data.links.redirects.forEach(link => {
      rows.push([
        link.url,
        link.statusCode,
        link.redirectType || '',
        (link.redirectChain || []).length,
        link.finalDestination || ''
      ]);
    });
  }

  // Convert to CSV
  const csv = rows.map(row =>
    row.map(cell => {
      const value = cell !== null && cell !== undefined ? String(cell) : '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  ).join('\n');

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `broken-links-report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================
// PAGINATION
// ============================================
const ITEMS_PER_PAGE = 25;
const paginationState = {
  'broken-links': { page: 1, total: 0 },
  'redirects': { page: 1, total: 0 },
  'working-links': { page: 1, total: 0 },
  'external-links': { page: 1, total: 0 }
};

function renderPaginatedTable(items, tableId, renderRow, headers) {
  const state = paginationState[tableId] || { page: 1, total: items.length };
  state.total = items.length;
  paginationState[tableId] = state;

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const startIdx = (state.page - 1) * ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, items.length);
  const pageItems = items.slice(startIdx, endIdx);

  return `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <thead>
          <tr style="border-bottom: 2px solid #333;">
            ${headers.map(h => `<th style="text-align: ${h.align || 'left'}; padding: 0.75rem; color: var(--r-text-muted, #6B7280);">${h.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${pageItems.map(renderRow).join('')}
        </tbody>
      </table>
    </div>
    ${items.length > ITEMS_PER_PAGE ? renderPaginationControls(tableId, state.page, totalPages, items.length) : ''}
  `;
}

function renderPaginationControls(tableId, currentPage, totalPages, totalItems) {
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
      padding: 0.75rem;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
    ">
      <span style="color: var(--r-text-faint, #9CA3AF); font-size: 0.85rem;">
        ${t('reports.common.showingRange', 'Showing {{start}}-{{end}} of {{total}} items', { start: startItem, end: endItem, total: totalItems })}
      </span>
      <div style="display: flex; gap: 0.5rem;">
        <button
          data-action="change-page" data-table-id="${tableId}" data-page="${currentPage - 1}"
          ${currentPage === 1 ? 'disabled' : ''}
          style="
            background: ${currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(0,217,255,0.15)'};
            color: ${currentPage === 1 ? '#555' : '#00d9ff'};
            border: 1px solid ${currentPage === 1 ? '#333' : 'rgba(0,217,255,0.3)'};
            padding: 0.4rem 0.75rem;
            border-radius: 4px;
            cursor: ${currentPage === 1 ? 'not-allowed' : 'pointer'};
            font-size: 0.85rem;
          "
        >${t('reports.common.prevArrow', '← Prev')}</button>
        <span style="
          color: #00d9ff;
          padding: 0.4rem 0.75rem;
          font-size: 0.85rem;
          font-weight: 600;
        ">${currentPage} / ${totalPages}</span>
        <button
          data-action="change-page" data-table-id="${tableId}" data-page="${currentPage + 1}"
          ${currentPage === totalPages ? 'disabled' : ''}
          style="
            background: ${currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(0,217,255,0.15)'};
            color: ${currentPage === totalPages ? '#555' : '#00d9ff'};
            border: 1px solid ${currentPage === totalPages ? '#333' : 'rgba(0,217,255,0.3)'};
            padding: 0.4rem 0.75rem;
            border-radius: 4px;
            cursor: ${currentPage === totalPages ? 'not-allowed' : 'pointer'};
            font-size: 0.85rem;
          "
        >${t('reports.common.nextArrow', 'Next →')}</button>
      </div>
    </div>
  `;
}

function changePage(tableId, newPage) {
  const state = paginationState[tableId];
  if (!state) return;

  const totalPages = Math.ceil(state.total / ITEMS_PER_PAGE);
  if (newPage < 1 || newPage > totalPages) return;

  state.page = newPage;

  // Re-render the content
  const data = window.currentBrokenLinksResults;
  if (!data) return;

  const accordion = document.querySelector(`#accordion-${tableId}`);
  if (!accordion) return;

  const contentInner = accordion.querySelector('.accordion-content-inner');
  if (!contentInner) return;

  // Re-render based on table type
  switch(tableId) {
    case 'broken-links':
      contentInner.innerHTML = renderBrokenLinksContent(data.links.broken);
      break;
    case 'redirects':
      contentInner.innerHTML = renderRedirectsContent(data.links.redirects, data.redirectAnalysis);
      break;
    case 'working-links':
      contentInner.innerHTML = renderWorkingLinksContent(data.links.working, data.summary.working);
      break;
    case 'external-links':
      contentInner.innerHTML = renderExternalLinksContent(data.links.external, data.summary.external);
      break;
  }
}

// ============================================================
// Expose display function globally for billing return handler
// ============================================================
window.displayResults = displayResults;
window.displayBrokenLinksResults = displayResults;

// ============================================================
// Billing Return Handling
// ============================================================
(async function initFromUrlParams() {
  // Ensure i18n translations are loaded before rendering any report content
  if (window.i18n && typeof window.i18n.init === 'function' && !window.i18n.initialized) {
    try { await window.i18n.init(); } catch (e) { /* i18n will use fallback */ }
  }

  const params = new URLSearchParams(window.location.search);
  const reportId = params.get('report_id') || '';
  const autoUrl = params.get('url') || '';
  const billingSuccess = params.get('billing_success') === 'true';

  // If we have a report_id, set it immediately so hasAccess checks work
  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    console.log('[BrokenLinks] Set report ID from URL:', reportId);
  }

  // Pre-fill URL if provided
  if (autoUrl) {
    const urlInput = document.getElementById('url');
    if (urlInput) urlInput.value = autoUrl;
  }

  // If returning from billing, wait for billing return processing to complete
  if (billingSuccess && !window.__smBillingReturnComplete) {
    console.log('[BrokenLinks] Waiting for billing return processing...');
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
      setTimeout(() => {
        window.removeEventListener('sm:billingReturnComplete', handler);
        resolve();
      }, 5000);
    });
    console.log('[BrokenLinks] Billing return processing complete');
    return; // Results will be restored by report-ui.js
  }

  // If we have a report_id, try to load the stored report
  if (reportId && window.ReportStorage) {
    console.log('[BrokenLinks] Checking for stored report:', reportId);

    // Fetch billing status BEFORE displaying the report
    if (window.ProReportBlock?.fetchBillingStatus) {
      console.log('[BrokenLinks] Fetching billing status...');
      await window.ProReportBlock.fetchBillingStatus(true);
    }

    const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displayResults);
    if (loaded) {
      console.log('[BrokenLinks] Loaded stored report successfully');
      return;
    }
  }
})();

// Listen for restore scan results event (after payment return)
window.addEventListener('sm:restoreScanResults', (e) => {
  const { results: restoredResults, url, analyzer } = e.detail || {};
  if (restoredResults && (analyzer?.includes('broken-links') || analyzer?.includes('broken_links'))) {
    console.log('[BrokenLinks] Restoring scan results after payment');
    const urlInput = document.getElementById('url');
    if (url && urlInput) urlInput.value = url;
    displayResults(restoredResults);
  }
});

// ============================================
// CSP-COMPLIANT EVENT DELEGATION
// ============================================
if (!window.__brokenLinksDataActionHandlerInitialized) {
  window.__brokenLinksDataActionHandlerInitialized = true;
  document.addEventListener('click', function(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');

    switch (action) {
      case 'toggle-accordion': {
        const accordionId = target.getAttribute('data-accordion-id');
        if (accordionId && typeof window.toggleBrokenLinksFixAccordion === 'function') {
          window.toggleBrokenLinksFixAccordion(accordionId);
        }
        break;
      }

      case 'switch-tab': {
        const accordionId = target.getAttribute('data-accordion-id');
        const tabName = target.getAttribute('data-tab');
        if (accordionId && tabName && typeof window.switchBrokenLinksFixTab === 'function') {
          e.preventDefault();
          e.stopPropagation();
          window.switchBrokenLinksFixTab(accordionId, tabName);
        }
        break;
      }

      case 'copy-code': {
        const copyTarget = target.getAttribute('data-copy-target');
        if (copyTarget && typeof window.copyBrokenLinksCode === 'function') {
          e.preventDefault();
          window.copyBrokenLinksCode(copyTarget);
        }
        break;
      }

      case 'call-function': {
        const fnName = target.getAttribute('data-function');
        if (fnName && typeof window[fnName] === 'function') {
          e.preventDefault();
          window[fnName]();
        }
        break;
      }

      case 'open-pricing-modal': {
        e.preventDefault();
        if (typeof window.openPricingModal === 'function') {
          window.openPricingModal();
        }
        break;
      }

      case 'change-page': {
        const tableId = target.getAttribute('data-table-id');
        const page = parseInt(target.getAttribute('data-page'), 10);
        if (tableId && !isNaN(page) && typeof window.changePage === 'function') {
          e.preventDefault();
          window.changePage(tableId, page);
        }
        break;
      }
    }
  });
}

// ============================================
// CSP-COMPLIANT HOVER STYLES
// ============================================
(function() {
  if (document.getElementById('bl-csp-hover-styles')) return;
  const style = document.createElement('style');
  style.id = 'bl-csp-hover-styles';
  style.textContent = `
    .bl-export-btn-excel:hover {
      background: rgba(0,217,255,0.25) !important;
    }
    .bl-export-btn-csv:hover {
      background: rgba(0,255,65,0.2) !important;
    }
    .bl-upgrade-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 20px rgba(255,215,0,0.3);
    }
  `;
  document.head.appendChild(style);
})();
