/**
 * Site Crawler Script
 * Multi-page discovery with sitemap parsing and robots.txt respect
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'site-crawler';

// ============================================================
// PRE-DOMCONTENTLOADED SETUP
// These must run BEFORE DOMContentLoaded to handle billing return
// since report-ui.js may dispatch events before this script's
// DOMContentLoaded handler runs.
// ============================================================

// Queue for pending restore calls (before displayResults is defined)
window.__crawlerPendingRestore = null;

// Wrapper function that queues calls until real displayResults is ready
window.displayCrawlerResults = function(data) {
  if (window.__crawlerDisplayResultsReady && typeof window.__crawlerRealDisplayResults === 'function') {
    // Real function is ready, call it directly
    window.__crawlerRealDisplayResults(data);
  } else {
    // Queue the call for later
    console.log('[Crawler] Queueing displayCrawlerResults call (DOM not ready)');
    window.__crawlerPendingRestore = data;
  }
};

// Also expose as displayResults for compatibility
window.displayResults = window.displayCrawlerResults;

// Listen for restore scan results event BEFORE DOMContentLoaded
// This ensures we capture the event even if it fires before our main handler
window.addEventListener('sm:restoreScanResults', (e) => {
  const { results: restoredResults, url, analyzer } = e.detail || {};
  if (restoredResults && (analyzer?.includes('crawler') || analyzer?.includes('site-crawler'))) {
    console.log('[Crawler] Received sm:restoreScanResults event');
    // Store the URL for later
    window.__crawlerRestoreUrl = url;
    // Call the wrapper (which will queue or call directly)
    window.displayCrawlerResults(restoredResults);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  const urlInput = document.getElementById('urlInput');
  const crawlButton = document.getElementById('crawlButton');
  const maxPagesInput = document.getElementById('maxPages');
  const maxDepthInput = document.getElementById('maxDepth');
  const includeSitemapCheck = document.getElementById('includeSitemap');
  const respectRobotsCheck = document.getElementById('respectRobots');
  const results = document.getElementById('results');
  const loadingContainer = document.getElementById('loadingContainer');
  const resultsContent = document.getElementById('resultsContent');
  const errorMessage = document.getElementById('errorMessage');

  // Initialize AnalyzerLoader
  let loader = null;
  if (typeof AnalyzerLoader !== 'undefined') {
    loader = new AnalyzerLoader('loadingContainer');
  }

  // Define crawl steps
  const crawlSteps = [
    { label: 'Connecting to website', detail: 'Loading page and checking access...' },
    { label: 'Checking sitemap', detail: 'Parsing sitemap.xml for page discovery...' },
    { label: 'Discovering pages', detail: 'Following links and crawling pages...' },
    { label: 'Processing results', detail: 'Compiling discovered pages...' }
  ];

  // Handle crawl
  crawlButton.addEventListener('click', startCrawl);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startCrawl();
  });

  // Handle URL parameters for report loading and billing return
  (async function initFromUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('report_id') || '';
    const autoUrl = params.get('url') || '';
    const autoScan = params.get('auto_scan') === 'true';
    const billingSuccess = params.get('billing_success') === 'true';

    // If we have a report_id, set it immediately so hasAccess checks work
    if (reportId) {
      document.body.setAttribute('data-report-id', reportId);
      console.log('[Crawler] Set report ID from URL:', reportId);
    }

    // If returning from billing, wait for billing return processing to complete
    if (billingSuccess && !window.__smBillingReturnComplete) {
      console.log('[Crawler] Waiting for billing return processing...');
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
      console.log('[Crawler] Billing return processing complete');
      return; // Don't auto-scan after billing return - results will be restored
    }

    // If we have a report_id, try to load the stored report first
    if (reportId && window.ReportStorage) {
      console.log('[Crawler] Checking for stored report:', reportId);

      // CRITICAL: Fetch billing status BEFORE displaying the report
      if (window.ProReportBlock?.fetchBillingStatus) {
        console.log('[Crawler] Fetching billing status...');
        await window.ProReportBlock.fetchBillingStatus(true);
        console.log('[Crawler] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportId));
      }

      const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displayResults);
      if (loaded) {
        if (autoUrl && urlInput) urlInput.value = autoUrl;
        return; // Don't auto-scan
      }
    }

    // No stored report found - pre-fill URL
    if (autoUrl && urlInput) {
      urlInput.value = autoUrl;
    }

    // Only auto-crawl if URL param present AND not coming from billing/report recall
    if (autoUrl && !reportId && !billingSuccess) {
      startCrawl();
    }
  })();

  // Note: sm:restoreScanResults listener is set up before DOMContentLoaded
  // to ensure we catch events that fire before this handler runs

  async function startCrawl() {
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please enter a valid URL');
      return;
    }

    // Show loading
    results.classList.remove('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    crawlButton.disabled = true;

    if (loader) {
      loader.start(crawlSteps, '🕷️ CRAWLING SITE', 60);
      
      // Add ASCII art patience message
      addPatienceMessage(loadingContainer);
    }

    // Build options
    const options = {
      maxPages: parseInt(maxPagesInput.value) || 20,
      maxDepth: parseInt(maxDepthInput.value) || 3,
      includeSitemap: includeSitemapCheck.checked,
      respectRobotsTxt: respectRobotsCheck.checked
    };

    try {
      if (loader) loader.nextStep(1);

      const scanStartedAt = new Date().toISOString();
      window.SM_SCAN_STARTED_AT = scanStartedAt;
      document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options, scanStartedAt })
      });

      if (loader) loader.nextStep(3);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Crawl failed');
      }

      const data = await response.json();

      // Extract and set report metadata from API response
      console.log('[site-crawler-script] Setting report metadata from API response');
      const apiReportId = data?.reportId || data?.results?.reportId;
      const screenshotUrl = data?.screenshotUrl || data?.results?.screenshotUrl;
      if (apiReportId) {
        document.body.setAttribute('data-report-id', apiReportId);
      }
      if (screenshotUrl) {
        document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
      }

      if (loader) {
        loader.complete();
        setTimeout(() => {
          loadingContainer.style.display = 'none';
          displayResults(data);
        }, 800);
      } else {
        displayResults(data);
      }

    } catch (error) {
      if (loader) {
        loadingContainer.style.display = 'none';
      }
      showError(error.message);
    } finally {
      crawlButton.disabled = false;
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  // Store crawl data globally for export and unlock handlers
  window.currentCrawlerResults = null;

  function displayResults(data) {
    // Store results globally for PDF generation and unlock handlers
    window.currentCrawlerResults = data;

    // CRITICAL: Make results container visible (it starts hidden)
    // This is needed when loading from storage since we bypass startCrawl()
    results.classList.remove('hidden');

    const pages = data.results?.pages || [];
    const hostname = new URL(data.url || 'https://example.com').hostname;
    
    // Build site structure from URLs
    const siteStructure = buildSiteStructure(pages);
    const techStack = detectTechStack(pages, data);
    const hostingInfo = detectHostingInfo(hostname, data);

    const scanStartedAt = window.SM_SCAN_STARTED_AT || document.body.getAttribute('data-sm-scan-started-at');
    const analyzerKey = window.SM_ANALYZER_KEY || 'site-crawler';

    // CRITICAL: Use existing reportId from body attribute if set (from billing return)
    // Only compute a new one if not already set
    let reportId = document.body.getAttribute('data-report-id') || data.reportId || null;
    if (!reportId) {
      if (window.ReportUI && typeof window.ReportUI.makeReportId === 'function') {
        reportId = window.ReportUI.makeReportId({
          analyzerKey,
          normalizedUrl: data.url,
          startedAtISO: scanStartedAt
        });
      } else if (window.ReportUI && typeof window.ReportUI.computeReportId === 'function') {
        reportId = window.ReportUI.computeReportId(data.url, scanStartedAt, analyzerKey);
      }
    }
    console.log('[Crawler] displayResults using reportId:', reportId);
    if (reportId) {
      document.body.setAttribute('data-report-id', reportId);
    }
    
    // Check if shared components are loaded
    if (typeof ReportShell === 'undefined' || typeof ReportAccordion === 'undefined') {
      console.error('Shared report components not loaded');
      resultsContent.innerHTML = '<div style="color: red; padding: 2rem;">Error: Report components failed to load. Please refresh the page.</div>';
      return;
    }

    // Check if report is unlocked (Pro subscription or purchased)
    const isReportUnlocked = (id) => {
      const rId = String(id || '').trim();

      // Subscription-style Pro (or ProReportBlock helper)
      if (window.ProReportBlock && typeof window.ProReportBlock.isPro === 'function') {
        if (window.ProReportBlock.isPro(rId || null)) {
          console.log('[Crawler] isReportUnlocked: true via ProReportBlock.isPro');
          return true;
        }
      }

      // Also check hasAccess which covers both Pro and purchased
      if (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function') {
        if (window.ProReportBlock.hasAccess(rId)) {
          console.log('[Crawler] isReportUnlocked: true via ProReportBlock.hasAccess');
          return true;
        }
      }

      // Per-report unlock via credits
      if (rId && window.CreditsManager) {
        if (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(rId)) {
          console.log('[Crawler] isReportUnlocked: true via CreditsManager.isUnlocked');
          return true;
        }
        if (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(rId)) {
          console.log('[Crawler] isReportUnlocked: true via CreditsManager.isReportUnlocked');
          return true;
        }
      }

      console.log('[Crawler] isReportUnlocked: false for reportId:', rId);
      return false;
    };

    const isUnlocked = isReportUnlocked(reportId);
    console.log('[Crawler] displayResults unlock check:', { reportId, isUnlocked });

    // Preview content for locked state
    const crawlerFixesPreview = renderCrawlerFixesPreview();
    const visualSitemapPreview = renderVisualSitemapPreview();
    const discoveredPagesPreview = renderDiscoveredPagesPreview(pages);

    // Build sections array (SEO pattern)
    // Free sections first, then PRO sections at bottom
    const sections = [
      {
        id: 'crawl-config',
        title: 'Crawl Configuration',
        scoreTextRight: null,
        contentHTML: renderCrawlConfigContent(data)
      },
      {
        id: 'site-structure',
        title: 'Site Structure',
        scoreTextRight: `${Object.keys(siteStructure.children).length} sections`,
        contentHTML: renderSiteStructureContent(siteStructure)
      },
      {
        id: 'tech-hosting',
        title: 'Technology & Infrastructure',
        scoreTextRight: null,
        contentHTML: renderTechHostingContent(techStack, hostingInfo, siteStructure, pages)
      },
      // PRO sections below
      {
        id: 'visual-sitemap',
        title: 'Visual Sitemap',
        scoreTextRight: null,
        isPro: true,
        locked: !isUnlocked,
        context: 'crawler',
        reportId,
        contentHTML: isUnlocked ? renderVisualSitemapContent(siteStructure, hostname) : visualSitemapPreview
      },
      {
        id: 'discovered-pages',
        title: `Discovered Pages & Export (${pages.length})`,
        scoreTextRight: pages.length,
        isPro: true,
        locked: !isUnlocked,
        context: 'crawler',
        reportId,
        contentHTML: isUnlocked ? renderDiscoveredPagesWithExport(pages, siteStructure) : discoveredPagesPreview
      },
      {
        id: 'report-recommendations',
        title: 'Fix Code + Recommendations',
        scoreTextRight: data.results?.pagesDiscovered || pages.length,
        isPro: true,
        locked: !isUnlocked,
        context: 'crawler',
        reportId,
        contentHTML: isUnlocked ? renderCrawlerFixes(data, siteStructure, pages) : crawlerFixesPreview
      }
    ];

    // No summary donuts for crawler (not score-based)
    const summary = [];

    // No screenshot for crawler page (single page doesn't need it)
    const screenshots = [];

    // Use ReportContainer (SEO pattern)
    const reportHTML = (window.ReportContainer && typeof window.ReportContainer.create === 'function')
      ? window.ReportContainer.create({
          url: data.url,
          timestamp: scanStartedAt,
          mode: 'crawler',
          title: 'Site Crawler Report',
          subtitle: '',
          summary,
          sections,
          screenshots,
          proBlock: true,
          proBlockOptions: {
            context: 'crawler',
            features: ['pdf', 'csv', 'share'],
            title: 'Unlock Report',
            subtitle: 'PDF export, share link, export data, and fix packs for this scan.',
            reportId
          }
        })
      : renderLegacyCrawlerReport(data, pages, siteStructure, techStack, hostingInfo, isUnlocked, reportId);

    resultsContent.innerHTML = `<div class="report-scope">${reportHTML}</div>`;

    // Initialize accordion interactions
    if (window.ReportAccordion && typeof window.ReportAccordion.initInteractions === 'function') {
      window.ReportAccordion.initInteractions();
    }

    // Refresh paywall UI
    if (reportId && window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
      window.CreditsManager.renderPaywallState(reportId);
    }

    // If already unlocked, reveal PRO content
    if (isUnlocked) {
      revealCrawlerProContent();
    }

    // When the report is unlocked, reveal the Fix Code section content
    if (!window.__crawlerUnlockListenerAttached) {
      window.__crawlerUnlockListenerAttached = true;
      window.addEventListener('reportUnlocked', (e) => {
        const unlockedId = e && e.detail ? e.detail.reportId : '';
        if (!unlockedId || unlockedId !== document.body.getAttribute('data-report-id')) return;

        const crawlData = window.currentCrawlerResults;
        if (!crawlData) return;

        const crawlPages = crawlData.results?.pages || [];
        const crawlStructure = buildSiteStructure(crawlPages);
        const crawlHostname = new URL(crawlData.url).hostname;

        // Replace Visual Sitemap section body with full content
        const sitemapBody = document.querySelector('[data-accordion-body="visual-sitemap"]');
        if (sitemapBody) {
          sitemapBody.innerHTML = renderVisualSitemapContent(crawlStructure, crawlHostname);
        }

        // Replace Discovered Pages & Export section body with full content
        const pagesBody = document.querySelector('[data-accordion-body="discovered-pages"]');
        if (pagesBody) {
          pagesBody.innerHTML = renderDiscoveredPagesWithExport(crawlPages, crawlStructure);
        }

        // Replace the Fix Code section body with the full content
        const body = document.querySelector('[data-accordion-body="report-recommendations"]');
        if (body) {
          body.innerHTML = renderCrawlerFixes(crawlData, crawlStructure, crawlPages);
        }

        revealCrawlerProContent();

        if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
          window.CreditsManager.renderPaywallState(unlockedId);
        }
      });
    }

    // Store data for export functions
    window.crawlData = data;
  }

  // Expose display function globally for billing return handler
  // Store the real function and mark it as ready
  window.__crawlerRealDisplayResults = displayResults;
  window.__crawlerDisplayResultsReady = true;

  // Update the wrapper functions to point to the real function
  window.displayResults = displayResults;
  window.displayCrawlerResults = displayResults;

  // Process any pending restore that came in before DOM was ready
  if (window.__crawlerPendingRestore) {
    console.log('[Crawler] Processing pending restore from queue');
    const pendingData = window.__crawlerPendingRestore;
    window.__crawlerPendingRestore = null;

    // Restore URL if available
    if (window.__crawlerRestoreUrl) {
      const urlInput = document.getElementById('urlInput');
      if (urlInput) {
        urlInput.value = window.__crawlerRestoreUrl;
      }
      window.__crawlerRestoreUrl = null;
    }

    // Use setTimeout to ensure all DOM elements are fully initialized
    setTimeout(() => {
      displayResults(pendingData);
    }, 50);
  }

  // ============================================================
  // Section Content Renderers (SEO pattern)
  // ============================================================

  function renderCrawlConfigContent(data) {
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
        <div>
          <div style="color: var(--text-tertiary); font-size: 0.85rem; margin-bottom: 0.25rem;">Max Pages</div>
          <div style="font-weight: 600;">${data.options?.maxPages || 'N/A'}</div>
        </div>
        <div>
          <div style="color: var(--text-tertiary); font-size: 0.85rem; margin-bottom: 0.25rem;">Max Depth</div>
          <div style="font-weight: 600;">${data.options?.maxDepth || 'N/A'}</div>
        </div>
        <div>
          <div style="color: var(--text-tertiary); font-size: 0.85rem; margin-bottom: 0.25rem;">Sitemap</div>
          <div style="font-weight: 600;">${data.options?.includeSitemap ? '✓ Enabled' : '✗ Disabled'}</div>
        </div>
        <div>
          <div style="color: var(--text-tertiary); font-size: 0.85rem; margin-bottom: 0.25rem;">Robots.txt</div>
          <div style="font-weight: 600;">${data.options?.respectRobotsTxt ? '✓ Respected' : '✗ Ignored'}</div>
        </div>
      </div>
    `;
  }

  function renderVisualSitemapContent(siteStructure, hostname) {
    return `
      <div style="margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
        <button onclick="downloadSitemapImage()" class="text-btn" title="Save Image">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Save
        </button>
      </div>
      <div id="sitemapDiagram" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary); border-radius: var(--radius-lg); padding: 2rem; overflow-x: auto;">
        ${renderSitemapDiagram(siteStructure, hostname)}
      </div>
    `;
  }

  function renderSiteStructureContent(siteStructure) {
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
        ${renderSiteTree(siteStructure)}
      </div>
    `;
  }

  function renderTechHostingContent(techStack, hostingInfo, siteStructure, pages) {
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">Technology Stack</h3>
          </div>
          <div class="card__body">
            ${renderTechStack(techStack)}
          </div>
        </div>
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">Hosting & Infrastructure</h3>
          </div>
          <div class="card__body">
            ${renderHostingInfo(hostingInfo)}
          </div>
        </div>
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">Page Statistics</h3>
          </div>
          <div class="card__body">
            ${renderPageStats(siteStructure, pages)}
          </div>
        </div>
      </div>
    `;
  }

  function renderDiscoveredPagesContent(pages, siteStructure) {
    return `
      <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <input type="text" id="pageSearch" placeholder="🔍 Filter pages..." 
          oninput="filterPages(this.value)"
          class="input input-sm" style="min-width: 200px;">
        <select id="sectionFilter" onchange="filterBySection(this.value)" class="input input-sm">
          <option value="">All Sections</option>
          ${Object.keys(siteStructure.children).map(section => `<option value="${section}">/${section}/</option>`).join('')}
        </select>
        <button onclick="toggleViewMode()" id="viewModeBtn" class="btn btn-secondary btn-sm">
          📁 Group View
        </button>
      </div>
      
      <div id="groupedView" style="display: none;">
        ${renderGroupedPages(pages, siteStructure)}
      </div>
      
      <div id="pagesList">
        ${pages.map((page, index) => {
          const pageType = getPageType(page);
          return `
          <div class="page-item" data-url="${page.toLowerCase()}" data-section="${getPageSection(page)}">
            <span style="color: var(--text-tertiary); font-size: 0.8rem; min-width: 30px;">${index + 1}.</span>
            <span style="font-size: 1.1rem; margin-right: 0.3rem;">${pageType.icon}</span>
            <a href="${page}" target="_blank" rel="noopener" style="flex: 1; word-break: break-all;">${formatPageUrl(page)}</a>
            <span style="background: ${pageType.color}; color: white; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; margin-right: 0.5rem; white-space: nowrap;">${pageType.label}</span>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-sm" onclick="window.open('/tag-intelligence.html?url=${encodeURIComponent(page)}', '_blank')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Tags</button>
              <button class="btn btn-sm" onclick="window.open('/enhanced-fonts.html?url=${encodeURIComponent(page)}', '_blank')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Fonts</button>
            </div>
          </div>
        `}).join('')}
      </div>
      <div id="noResults" style="display: none; text-align: center; padding: 2rem; color: var(--text-tertiary);">
        No pages match your filter
      </div>
    `;
  }

  function renderExportOptionsContent() {
    return `
      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <button onclick="downloadJSON()" class="btn btn-secondary">
          💾 Download JSON
        </button>
        <button onclick="downloadCSV()" class="btn btn-secondary">
          📊 Download CSV
        </button>
        <button onclick="downloadSitemap()" class="btn btn-primary">
          🗺️ Download Sitemap XML
        </button>
      </div>
    `;
  }

  function renderDiscoveredPagesWithExport(pages, siteStructure) {
    return `
      <!-- Export Options -->
      <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); border: 1px solid var(--border-primary);">
        <div style="font-weight: 600; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>📤</span> Export Data
        </div>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button onclick="downloadJSON()" class="btn btn-secondary">
            💾 Download JSON
          </button>
          <button onclick="downloadCSV()" class="btn btn-secondary">
            📊 Download CSV
          </button>
          <button onclick="downloadSitemap()" class="btn btn-primary">
            🗺️ Download Sitemap XML
          </button>
        </div>
      </div>
      
      <!-- Page List -->
      <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <input type="text" id="pageSearch" placeholder="🔍 Filter pages..." 
          oninput="filterPages(this.value)"
          class="input input-sm" style="min-width: 200px;">
        <select id="sectionFilter" onchange="filterBySection(this.value)" class="input input-sm">
          <option value="">All Sections</option>
          ${Object.keys(siteStructure.children).map(section => `<option value="${section}">/${section}/</option>`).join('')}
        </select>
        <button onclick="toggleViewMode()" id="viewModeBtn" class="btn btn-secondary btn-sm">
          📁 Group View
        </button>
      </div>
      
      <div id="groupedView" style="display: none;">
        ${renderGroupedPages(pages, siteStructure)}
      </div>
      
      <div id="pagesList">
        ${pages.map((page, index) => {
          const pageType = getPageType(page);
          return `
          <div class="page-item" data-url="${page.toLowerCase()}" data-section="${getPageSection(page)}">
            <span style="color: var(--text-tertiary); font-size: 0.8rem; min-width: 30px;">${index + 1}.</span>
            <span style="font-size: 1.1rem; margin-right: 0.3rem;">${pageType.icon}</span>
            <a href="${page}" target="_blank" rel="noopener" style="flex: 1; word-break: break-all;">${formatPageUrl(page)}</a>
            <span style="background: ${pageType.color}; color: white; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; margin-right: 0.5rem; white-space: nowrap;">${pageType.label}</span>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-sm" onclick="window.open('/tag-intelligence.html?url=${encodeURIComponent(page)}', '_blank')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Tags</button>
              <button class="btn btn-sm" onclick="window.open('/enhanced-fonts.html?url=${encodeURIComponent(page)}', '_blank')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Fonts</button>
            </div>
          </div>
        `}).join('')}
      </div>
      <div id="noResults" style="display: none; text-align: center; padding: 2rem; color: var(--text-tertiary);">
        No pages match your filter
      </div>
    `;
  }

  // ============================================================
  // Crawler Fixes (following SEO/CRO pattern)
  // ============================================================

  function renderCrawlerFixesPreview() {
    return `
      <div>
        <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
          Preview of fix packs:
        </p>
        <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary);">
          <li>Orphaned page detection and fixes</li>
          <li>Sitemap coverage improvements</li>
          <li>Internal linking structure optimization</li>
        </ul>
      </div>
    `;
  }

  function renderVisualSitemapPreview() {
    return `
      <div>
        <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
          Unlock to view:
        </p>
        <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary);">
          <li>Interactive visual sitemap diagram</li>
          <li>Hierarchical page relationships</li>
          <li>Export and print options</li>
        </ul>
      </div>
    `;
  }

  function renderDiscoveredPagesPreview(pages) {
    const count = pages?.length || 0;
    return `
      <div>
        <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
          ${count} pages discovered. Unlock to access:
        </p>
        <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary);">
          <li>Full page list with filtering</li>
          <li>Page type categorization</li>
          <li>Quick access to analyze individual pages</li>
          <li>Export as JSON, CSV, or Sitemap XML</li>
        </ul>
      </div>
    `;
  }

  function renderCrawlerFixes(data, siteStructure, pages) {
    ensureCrawlerFixStyles();
    const fixes = buildCrawlerFixCards(data, siteStructure, pages);
    
    if (fixes.length === 0) {
      return `
        <div style="margin-top: 1rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
          <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
            <span style="font-size: 1.5rem;">✓</span> Excellent Site Structure!
          </h3>
          <p style="color: #86efac; margin: 0;">Your site has good crawlability and structure. Keep monitoring for continued success.</p>
        </div>
      `;
    }

    const high = fixes.filter(f => f.severity === 'High');
    const medium = fixes.filter(f => f.severity === 'Medium');
    const low = fixes.filter(f => f.severity === 'Low');

    let html = `
      <div class="crawler-fixes-container" style="margin-top: 1rem;">
        <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
          <span style="font-size: 1.75rem;">🕷️</span> Crawler Fixes
          <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${fixes.length} improvements found)</span>
        </h3>
        <div class="crawler-fixes-list">
    `;

    const allFixes = [...high, ...medium, ...low];
    allFixes.forEach((fix, index) => {
      html += renderCrawlerFixAccordion(fix, index);
    });

    html += `</div></div>`;
    return html;
  }

  function renderCrawlerFixAccordion(fix, index) {
    const accordionId = `crawlerfix-${fix.id || index}`;
    const severityColors = {
      High: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
      Medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
      Low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
    };
    const style = severityColors[fix.severity] || severityColors.Medium;

    return `
      <div class="crawler-fix-accordion" data-fix-id="${accordionId}" style="
        border: 1px solid ${style.border}33;
        border-radius: 12px;
        margin-bottom: 1rem;
        overflow: hidden;
        background: ${style.bg};
      ">
        <div class="crawler-fix-header" onclick="toggleCrawlerFixAccordion('${accordionId}')" style="
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
              <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">${fix.category || 'Site Structure'}</p>
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
            <span class="crawler-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
          </div>
        </div>

        <div class="crawler-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
          <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
            ${renderCrawlerFixTabs(fix, accordionId)}
          </div>
        </div>
      </div>
    `;
  }

  function renderCrawlerFixTabs(fix, accordionId) {
    return `
      <div class="crawler-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
        <button class="crawler-fix-tab active" onclick="switchCrawlerFixTab('${accordionId}', 'summary')" style="
          padding: 0.5rem 1rem;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          background: rgba(255,255,255,0.1);
          color: #fff;
          cursor: pointer;
          font-size: 0.85rem;
        ">📋 Summary</button>
        <button class="crawler-fix-tab" onclick="switchCrawlerFixTab('${accordionId}', 'code')" style="
          padding: 0.5rem 1rem;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          background: transparent;
          color: #aaa;
          cursor: pointer;
          font-size: 0.85rem;
        ">💻 Code</button>
        <button class="crawler-fix-tab" onclick="switchCrawlerFixTab('${accordionId}', 'guide')" style="
          padding: 0.5rem 1rem;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          background: transparent;
          color: #aaa;
          cursor: pointer;
          font-size: 0.85rem;
        ">🔧 Fix Guide</button>
      </div>

      <div class="crawler-fix-tab-content active" id="${accordionId}-summary">
        <p style="color: #ccc; line-height: 1.7; margin: 0 0 1rem 0;">
          ${fix.description}
        </p>
        <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
          <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ Expected Impact</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">${fix.impact}</div>
        </div>
      </div>

      <div class="crawler-fix-tab-content" id="${accordionId}-code" style="display: none;">
        <div style="display: grid; gap: 1rem;">
          <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
              <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ Current Issue</span>
              <button onclick="copyCrawlerCode('${accordionId}-problem')" style="
                padding: 0.25rem 0.75rem;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.05);
                color: #fff;
                cursor: pointer;
                font-size: 0.75rem;
              ">📋 Copy</button>
            </div>
            <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeCrawlerHtml(fix.problematicCode)}</pre>
          </div>

          <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
              <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ Recommended Fix</span>
              <button onclick="copyCrawlerCode('${accordionId}-solution')" style="
                padding: 0.25rem 0.75rem;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.05);
                color: #fff;
                cursor: pointer;
                font-size: 0.75rem;
              ">📋 Copy</button>
            </div>
            <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeCrawlerHtml(fix.snippet)}</pre>
          </div>
        </div>
      </div>

      <div class="crawler-fix-tab-content" id="${accordionId}-guide" style="display: none;">
        <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
        <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
          ${fix.steps.map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
        </ol>
      </div>
    `;
  }

  function buildCrawlerFixCards(data, siteStructure, pages) {
    const cards = [];
    const sectionCount = Object.keys(siteStructure.children).length;
    const hasSitemap = data.options?.includeSitemap && data.results?.sitemapPages?.length > 0;
    const sitemapPages = data.results?.sitemapPages || [];
    const crawledPages = pages.length;

    // Check for orphaned pages (in sitemap but not linked)
    if (hasSitemap && sitemapPages.length > 0) {
      const orphanedCount = sitemapPages.filter(sp => !pages.includes(sp)).length;
      if (orphanedCount > 0) {
        cards.push({
          id: 'orphaned-pages',
          title: `Fix ${orphanedCount} orphaned pages`,
          severity: 'High',
          category: 'Internal Linking',
          impact: 'Improve crawlability and page authority distribution',
          description: `Found ${orphanedCount} pages in sitemap.xml that have no internal links pointing to them. These pages may be hard for search engines to discover.`,
          problematicCode: `<!-- Orphaned pages (no internal links) -->
<!-- These pages exist but have no links from other pages: -->

${sitemapPages.filter(sp => !pages.includes(sp)).slice(0, 5).map(p => `<!-- ${p} -->`).join('\n')}
${orphanedCount > 5 ? `\n<!-- ...and ${orphanedCount - 5} more -->` : ''}`,
          snippet: `<!-- Add internal links to orphaned pages -->

<!-- In your navigation or related content: -->
<nav>
  <a href="/orphaned-page/">Link Text</a>
</nav>

<!-- Or in related content sections: -->
<section class="related">
  <h3>Related Pages</h3>
  <ul>
    <li><a href="/orphaned-page/">Descriptive Link</a></li>
  </ul>
</section>`,
          steps: [
            'Identify orphaned pages from the list above',
            'Add links from relevant parent or sibling pages',
            'Update main navigation if pages are important',
            'Consider adding a "Related Content" section',
            'Re-crawl to verify pages are now linked'
          ]
        });
      }
    }

    // Check for missing sitemap entries
    if (!hasSitemap || sitemapPages.length < crawledPages) {
      const missingSitemapCount = hasSitemap ? crawledPages - sitemapPages.length : crawledPages;
      cards.push({
        id: 'sitemap-coverage',
        title: 'Improve sitemap coverage',
        severity: 'Medium',
        category: 'Sitemap',
        impact: 'Better search engine discovery of all pages',
        description: hasSitemap 
          ? `Your sitemap.xml has ${sitemapPages.length} pages but ${crawledPages} were discovered by crawling. ${missingSitemapCount} pages may be missing from sitemap.`
          : 'No sitemap.xml was found or it could not be parsed. Adding a sitemap helps search engines discover your pages.',
        problematicCode: hasSitemap 
          ? `<!-- Current sitemap.xml -->
<!-- Contains ${sitemapPages.length} URLs -->
<!-- But ${crawledPages} pages were found by crawling -->
<!-- Missing ${missingSitemapCount} pages -->`
          : `<!-- No sitemap.xml found -->
<!-- Search engines must discover pages by crawling only -->`,
        snippet: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.slice(0, 5).map(p => `  <url>
    <loc>${p}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
${crawledPages > 5 ? `  <!-- Add all ${crawledPages} discovered pages -->` : ''}
</urlset>`,
        steps: [
          'Export the full page list using "Download Sitemap XML" button',
          'Review and add any additional important pages',
          'Upload sitemap.xml to your website root',
          'Submit sitemap URL in Google Search Console',
          'Add sitemap reference to robots.txt'
        ]
      });
    }

    // Check for deep pages (depth > 3)
    const deepPages = pages.filter(p => {
      try {
        const path = new URL(p).pathname;
        const depth = path.split('/').filter(s => s).length;
        return depth > 3;
      } catch { return false; }
    });
    if (deepPages.length > 0) {
      cards.push({
        id: 'deep-pages',
        title: `Reduce depth for ${deepPages.length} pages`,
        severity: 'Low',
        category: 'Site Structure',
        impact: 'Improve crawl efficiency and user navigation',
        description: `Found ${deepPages.length} pages that are more than 3 levels deep. Deep pages may be harder for search engines to crawl and users to find.`,
        problematicCode: `<!-- Deep page structure -->
${deepPages.slice(0, 5).map(p => {
  const path = new URL(p).pathname;
  return `<!-- ${path} (depth: ${path.split('/').filter(s => s).length}) -->`;
}).join('\n')}
${deepPages.length > 5 ? `\n<!-- ...and ${deepPages.length - 5} more deep pages -->` : ''}`,
        snippet: `<!-- Flatten URL structure -->
<!-- Before: /category/subcategory/type/product-name/ -->
<!-- After:  /category/product-name/ -->

<!-- Add breadcrumbs for user navigation -->
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/category/">Category</a></li>
    <li>Current Page</li>
  </ol>
</nav>`,
        steps: [
          'Identify which deep pages are most important',
          'Consider flattening URL structure for key pages',
          'Add breadcrumb navigation for deep pages',
          'Link to deep pages from higher-level pages',
          'Update internal links to use shorter paths'
        ]
      });
    }

    // Check for section imbalance
    const sectionCounts = Object.entries(siteStructure.children).map(([name, node]) => ({
      name,
      count: node.count
    })).sort((a, b) => b.count - a.count);

    if (sectionCounts.length > 1) {
      const largest = sectionCounts[0];
      const smallest = sectionCounts[sectionCounts.length - 1];
      if (largest.count > smallest.count * 3) {
        cards.push({
          id: 'section-balance',
          title: 'Balance site sections',
          severity: 'Low',
          category: 'Content Strategy',
          impact: 'Improve site architecture and topical authority',
          description: `The /${largest.name}/ section has ${largest.count} pages while /${smallest.name}/ only has ${smallest.count}. Very unbalanced sections may indicate content gaps.`,
          problematicCode: `<!-- Section size imbalance -->
${sectionCounts.slice(0, 5).map(s => `<!-- /${s.name}/: ${s.count} pages -->`).join('\n')}`,
          snippet: `<!-- Expand smaller sections with quality content -->

<!-- For /${smallest.name}/ section: -->
<!-- 1. Identify related topics to cover -->
<!-- 2. Create pillar content pages -->
<!-- 3. Add supporting articles -->
<!-- 4. Interlink within the section -->

<!-- Example structure: -->
/${smallest.name}/
  ├── pillar-page/
  ├── topic-1/
  ├── topic-2/
  └── topic-3/`,
          steps: [
            `Review the /${smallest.name}/ section for content opportunities`,
            'Identify topics that could expand the section',
            'Create pillar content for main topics',
            'Add supporting content that links to pillars',
            'Ensure proper internal linking within sections'
          ]
        });
      }
    }

    // Check robots.txt respect
    if (!data.options?.respectRobotsTxt) {
      cards.push({
        id: 'robots-respect',
        title: 'Consider robots.txt directives',
        severity: 'Low',
        category: 'Technical SEO',
        impact: 'Align with intended crawl behavior',
        description: 'This crawl ignored robots.txt. Some discovered pages may be intentionally blocked from search engines.',
        problematicCode: `# robots.txt was not respected
# Some pages may be blocked intentionally

User-agent: *
Disallow: /admin/
Disallow: /private/
Disallow: /temp/`,
        snippet: `# Typical robots.txt structure

User-agent: *
Disallow: /admin/
Disallow: /private/
Allow: /

Sitemap: https://example.com/sitemap.xml`,
        steps: [
          'Re-run crawl with "Respect robots.txt" enabled',
          'Compare results to identify blocked pages',
          'Review which pages should be blocked',
          'Update robots.txt if needed',
          'Submit updated robots.txt to Search Console'
        ]
      });
    }

    return cards;
  }

  // Crawler fix accordion toggle
  function toggleCrawlerFixAccordion(accordionId) {
    const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
    const content = document.getElementById(`${accordionId}-content`);
    const icon = accordion?.querySelector('.crawler-fix-expand-icon');

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
  window.toggleCrawlerFixAccordion = toggleCrawlerFixAccordion;

  // Crawler fix tab switcher
  function switchCrawlerFixTab(accordionId, tabName) {
    const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
    if (!accordion) return;

    const tabs = accordion.querySelectorAll('.crawler-fix-tab');
    const contents = accordion.querySelectorAll('.crawler-fix-tab-content');

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

    const content = document.getElementById(`${accordionId}-content`);
    if (content && accordion.classList.contains('expanded')) {
      setTimeout(() => {
        content.style.maxHeight = content.scrollHeight + 'px';
      }, 50);
    }
  }
  window.switchCrawlerFixTab = switchCrawlerFixTab;

  // Add click event delegation for crawler fix accordions and tabs
  document.addEventListener('click', function(e) {
    // Handle tab clicks first
    const tab = e.target.closest('.crawler-fix-tab');
    if (tab) {
      const accordion = tab.closest('.crawler-fix-accordion');
      if (accordion) {
        const fixId = accordion.getAttribute('data-fix-id');
        const tabText = tab.textContent.toLowerCase();
        let tabName = 'summary';
        if (tabText.includes('code')) tabName = 'code';
        else if (tabText.includes('guide')) tabName = 'guide';
        if (fixId && typeof window.switchCrawlerFixTab === 'function') {
          e.preventDefault();
          e.stopPropagation();
          window.switchCrawlerFixTab(fixId, tabName);
        }
      }
      return;
    }
    // Handle accordion header clicks
    const header = e.target.closest('.crawler-fix-header');
    if (header) {
      const accordion = header.closest('.crawler-fix-accordion');
      if (accordion) {
        const fixId = accordion.getAttribute('data-fix-id');
        if (fixId && typeof window.toggleCrawlerFixAccordion === 'function') {
          window.toggleCrawlerFixAccordion(fixId);
        }
      }
    }
  });

  // Copy code utility
  function copyCrawlerCode(elementId) {
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
  window.copyCrawlerCode = copyCrawlerCode;

  function ensureCrawlerFixStyles() {
    if (document.getElementById('crawler-fixes-styles')) return;
    const style = document.createElement('style');
    style.id = 'crawler-fixes-styles';
    style.textContent = `
      .crawler-fix-accordion.expanded .crawler-fix-expand-icon {
        transform: rotate(180deg);
      }
      .crawler-fix-header:hover {
        background: rgba(255,255,255,0.03);
      }
    `;
    document.head.appendChild(style);
  }

  function escapeCrawlerHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Reveal PRO content when unlocked
  function revealCrawlerProContent() {
    const lockOverlays = document.querySelectorAll('.report-scope .accordion-section[data-accordion-section="report-recommendations"] .lock-overlay, .report-scope .pro-lock-overlay');
    lockOverlays.forEach(overlay => overlay.remove());

    const proBadges = document.querySelectorAll('.report-scope .accordion-section[data-accordion-section="report-recommendations"] .pro-badge');
    proBadges.forEach(badge => badge.remove());

    const lockedSections = document.querySelectorAll('.report-scope .accordion-section[data-accordion-section="report-recommendations"].locked');
    lockedSections.forEach(section => section.classList.remove('locked'));
  }

  // Screenshot retry helper
  function attachCrawlerScreenshotRetry(imgEl, baseUrl, options = {}) {
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

    const onLoad = () => { settled = true; };
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

  // Legacy fallback renderer
  function renderLegacyCrawlerReport(data, pages, siteStructure, techStack, hostingInfo, isUnlocked, reportId) {
    return `
      <div class="report-shell">
        <div class="report-shell__header">
          <div>
            <h2 class="report-shell__title">Site Crawler Results</h2>
            <p class="report-shell__meta">>> url: ${data.url}</p>
            <p class="report-shell__meta">>> timestamp: ${new Date().toLocaleString()}</p>
          </div>
        </div>
        <div class="report-shell__summary">
          <div class="report-shell__summary-card">
            <div class="report-shell__summary-label">Pages Discovered</div>
            <div style="font-size: 2.5rem; font-weight: bold; color: var(--accent-primary);">${data.results?.pagesDiscovered || 0}</div>
          </div>
          <div class="report-shell__summary-card">
            <div class="report-shell__summary-label">Crawl Time</div>
            <div style="font-size: 2.5rem; font-weight: bold; color: #00d9ff;">${data.duration || 'N/A'}</div>
          </div>
        </div>
      </div>
    `;
  }

  // Build site structure from URLs
  function buildSiteStructure(pages) {
    const structure = { name: 'root', children: {}, count: 0 };
    
    pages.forEach(url => {
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        const parts = path.split('/').filter(p => p);
        
        let current = structure;
        current.count++;
        
        parts.forEach((part, index) => {
          if (!current.children[part]) {
            current.children[part] = { name: part, children: {}, count: 0, isPage: index === parts.length - 1 };
          }
          current = current.children[part];
          current.count++;
        });
      } catch (e) {
        // Skip invalid URLs
      }
    });
    
    return structure;
  }

  // Detect technology stack from URLs and patterns
  function detectTechStack(pages, data) {
    const stack = {
      cms: null,
      framework: null,
      server: null,
      analytics: [],
      other: []
    };
    
    const urlPatterns = pages.join(' ').toLowerCase();
    
    // CMS Detection
    if (urlPatterns.includes('wp-content') || urlPatterns.includes('wordpress')) {
      stack.cms = { name: 'WordPress', icon: '📝', confidence: 95 };
    } else if (urlPatterns.includes('.aspx')) {
      stack.cms = { name: 'ASP.NET', icon: '🔷', confidence: 90 };
    } else if (urlPatterns.includes('drupal') || urlPatterns.includes('/node/')) {
      stack.cms = { name: 'Drupal', icon: '💧', confidence: 85 };
    } else if (urlPatterns.includes('joomla')) {
      stack.cms = { name: 'Joomla', icon: '🔧', confidence: 85 };
    } else if (urlPatterns.includes('shopify') || urlPatterns.includes('/collections/')) {
      stack.cms = { name: 'Shopify', icon: '🛒', confidence: 80 };
    } else if (urlPatterns.includes('squarespace')) {
      stack.cms = { name: 'Squarespace', icon: '⬛', confidence: 90 };
    } else if (urlPatterns.includes('wix')) {
      stack.cms = { name: 'Wix', icon: '🎨', confidence: 90 };
    }
    
    // Framework detection
    if (urlPatterns.includes('_next') || urlPatterns.includes('next')) {
      stack.framework = { name: 'Next.js', icon: '▲', confidence: 90 };
    } else if (urlPatterns.includes('gatsby')) {
      stack.framework = { name: 'Gatsby', icon: '💜', confidence: 85 };
    } else if (urlPatterns.includes('nuxt') || urlPatterns.includes('_nuxt')) {
      stack.framework = { name: 'Nuxt.js', icon: '💚', confidence: 90 };
    }
    
    // Server technology
    if (urlPatterns.includes('.php')) {
      stack.server = { name: 'PHP', icon: '🐘', confidence: 95 };
    } else if (urlPatterns.includes('.aspx') || urlPatterns.includes('.asp')) {
      stack.server = { name: 'ASP.NET', icon: '🔷', confidence: 95 };
    } else if (urlPatterns.includes('.jsp')) {
      stack.server = { name: 'Java/JSP', icon: '☕', confidence: 90 };
    }
    
    return stack;
  }

  // Detect hosting info from hostname
  function detectHostingInfo(hostname, data) {
    const info = {
      provider: null,
      cdn: null,
      ssl: true,
      domain: hostname
    };
    
    const host = hostname.toLowerCase();
    
    // Hosting providers
    if (host.includes('wpengine') || host.includes('wpenginepowered')) {
      info.provider = { name: 'WP Engine', icon: '🚀', type: 'Managed WordPress' };
    } else if (host.includes('kinsta')) {
      info.provider = { name: 'Kinsta', icon: '⚡', type: 'Managed WordPress' };
    } else if (host.includes('pantheon')) {
      info.provider = { name: 'Pantheon', icon: '🏛️', type: 'WebOps Platform' };
    } else if (host.includes('netlify')) {
      info.provider = { name: 'Netlify', icon: '🔷', type: 'JAMstack' };
    } else if (host.includes('vercel')) {
      info.provider = { name: 'Vercel', icon: '▲', type: 'Edge Platform' };
    } else if (host.includes('heroku')) {
      info.provider = { name: 'Heroku', icon: '💜', type: 'PaaS' };
    } else if (host.includes('amazonaws') || host.includes('aws')) {
      info.provider = { name: 'AWS', icon: '🟧', type: 'Cloud Infrastructure' };
    } else if (host.includes('azure')) {
      info.provider = { name: 'Azure', icon: '🔵', type: 'Cloud Infrastructure' };
    } else if (host.includes('cloudflare')) {
      info.provider = { name: 'Cloudflare', icon: '☁️', type: 'Edge/CDN' };
    } else if (host.includes('shopify')) {
      info.provider = { name: 'Shopify', icon: '🛒', type: 'E-commerce' };
    } else if (host.includes('squarespace')) {
      info.provider = { name: 'Squarespace', icon: '⬛', type: 'Website Builder' };
    } else if (host.includes('wix')) {
      info.provider = { name: 'Wix', icon: '🎨', type: 'Website Builder' };
    } else if (host.includes('godaddy')) {
      info.provider = { name: 'GoDaddy', icon: '🌐', type: 'Shared Hosting' };
    } else if (host.includes('bluehost')) {
      info.provider = { name: 'Bluehost', icon: '🔵', type: 'Shared Hosting' };
    } else if (host.includes('siteground')) {
      info.provider = { name: 'SiteGround', icon: '🟠', type: 'Shared Hosting' };
    }
    
    return info;
  }

  // Render visual sitemap diagram - clean hierarchical flow
  function renderSitemapDiagram(structure, hostname) {
    const topLevelSections = Object.keys(structure.children);
    
    if (topLevelSections.length === 0) {
      return '<div style="text-align: center; color: #666; padding: 2rem;">No directory structure detected (flat site)</div>';
    }
    
    const isDark = !document.body.classList.contains('white-theme');
    const nodeStroke = isDark ? '#fff' : '#000';
    const nodeFill = isDark ? '#000' : '#fff';
    const lineColor = isDark ? '#666' : '#ccc';
    const textColor = isDark ? '#fff' : '#000';
    
    // Build SVG tree diagram
    let html = `
      <style>
        .tree-diagram {
          width: 100%;
          min-height: 800px;
          padding: 2rem;
          overflow-x: auto;
        }
        .tree-node {
          cursor: default;
        }
        .tree-node rect {
          transition: all 0.2s ease;
        }
        .tree-node:hover rect {
          filter: brightness(1.1);
        }
      </style>
      <svg class="tree-diagram" viewBox="0 0 1600 550" preserveAspectRatio="xMidYMin meet">
    `;
    
    const rootX = 800;
    const rootY = 80;
    const rootWidth = 280;
    const rootHeight = 80;
    
    // Draw root node
    html += `
      <g class="tree-node">
        <rect x="${rootX - rootWidth/2}" y="${rootY - rootHeight/2}" 
              width="${rootWidth}" height="${rootHeight}" 
              fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="3" rx="6"/>
        <text x="${rootX}" y="${rootY - 5}" 
              text-anchor="middle" dominant-baseline="middle" 
              fill="${textColor}" font-weight="bold" font-size="20">
          ${hostname || 'Home'}
        </text>
        <text x="${rootX}" y="${rootY + 18}" 
              text-anchor="middle" dominant-baseline="middle" 
              fill="${isDark ? '#888' : '#666'}" font-size="12">
          Homepage
        </text>
      </g>
    `;
    
    // Calculate section positions
    const sectionCount = Math.min(topLevelSections.length, 6);
    const sectionSpacing = 1500 / (sectionCount + 1);
    const sectionY = 200;
    
    // Draw vertical line from root
    html += `<line x1="${rootX}" y1="${rootY + rootHeight/2}" x2="${rootX}" y2="${sectionY - 80}" stroke="${lineColor}" stroke-width="2"/>`;
    
    // Draw horizontal line connecting all sections
    if (sectionCount > 1) {
      const startX = 50 + sectionSpacing;
      const endX = 50 + sectionSpacing * sectionCount;
      html += `<line x1="${startX}" y1="${sectionY - 60}" x2="${endX}" y2="${sectionY - 60}" stroke="${lineColor}" stroke-width="2"/>`;
    }
    
    // Draw sections
    topLevelSections.slice(0, 6).forEach((section, i) => {
      const sectionData = structure.children[section];
      const sectionX = 50 + sectionSpacing * (i + 1);
      const sectionWidth = 180;
      const sectionHeight = 70;
      const sectionName = section.replace(/-/g, ' ');
      
      // Vertical line to section
      html += `<line x1="${sectionX}" y1="${sectionY - 60}" x2="${sectionX}" y2="${sectionY - 30}" stroke="${lineColor}" stroke-width="2"/>`;
      
      // Section node
      html += `
        <g class="tree-node">
          <rect x="${sectionX - sectionWidth/2}" y="${sectionY - sectionHeight/2}" 
                width="${sectionWidth}" height="${sectionHeight}" 
                fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="2" rx="6"/>
          <text x="${sectionX}" y="${sectionY - 8}" 
                text-anchor="middle" dominant-baseline="middle" 
                fill="${textColor}" font-weight="600" font-size="15">
            ${sectionName.length > 20 ? sectionName.slice(0, 18) + '...' : sectionName}
          </text>
          <text x="${sectionX}" y="${sectionY + 12}" 
                text-anchor="middle" dominant-baseline="middle" 
                fill="${isDark ? '#888' : '#666'}" font-size="11">
            /${section}/
          </text>
          <text x="${sectionX}" y="${sectionY + 26}" 
                text-anchor="middle" dominant-baseline="middle" 
                fill="${isDark ? '#999' : '#777'}" font-size="10">
            ${sectionData.count} page${sectionData.count !== 1 ? 's' : ''}
          </text>
        </g>
      `;
      
      // Draw child pages - stagger Y position to prevent overlap
      const childPages = Object.entries(sectionData.children || {}).slice(0, 4);
      if (childPages.length > 0) {
        // Stagger: even sections at one level, odd sections lower
        const basePageY = sectionY + 140;
        const staggerOffset = (i % 2 === 0) ? 0 : 80; // Alternate rows
        const pageY = basePageY + staggerOffset;
        const pageWidth = 130;
        const pageHeight = 50;
        
        // Fixed spacing for third level - use absolute positioning
        // Each child page gets its own column to avoid overlaps
        const pageGap = 20; // Gap between page boxes
        const totalChildWidth = (pageWidth + pageGap) * childPages.length - pageGap;
        const startX = sectionX - totalChildWidth / 2;
        
        // Vertical line from section to pages area
        html += `<line x1="${sectionX}" y1="${sectionY + sectionHeight/2}" x2="${sectionX}" y2="${pageY - 30}" stroke="${lineColor}" stroke-width="2"/>`;
        
        // Horizontal line for pages
        if (childPages.length > 1) {
          const pageStartX = startX + pageWidth / 2;
          const pageEndX = startX + totalChildWidth - pageWidth / 2;
          html += `<line x1="${pageStartX}" y1="${pageY - 30}" x2="${pageEndX}" y2="${pageY - 30}" stroke="${lineColor}" stroke-width="1.5"/>`;
        }

        childPages.forEach(([pageName, pageData], j) => {
          const pageX = startX + j * (pageWidth + pageGap) + pageWidth / 2;
          const pageTitle = pageName.replace(/-/g, ' ');
          const subcount = pageData.children ? Object.keys(pageData.children).length : 0;
          
          // Vertical line to page
          html += `<line x1="${pageX}" y1="${pageY - 30}" x2="${pageX}" y2="${pageY - pageHeight/2}" stroke="${lineColor}" stroke-width="1.5"/>`;
          
          // Page node
          html += `
            <g class="tree-node">
              <rect x="${pageX - pageWidth/2}" y="${pageY - pageHeight/2}" 
                    width="${pageWidth}" height="${pageHeight}" 
                    fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="2" rx="4"/>
              <text x="${pageX}" y="${pageY - 5}" 
                    text-anchor="middle" dominant-baseline="middle" 
                    fill="${textColor}" font-size="12" font-weight="500">
                ${pageTitle.length > 16 ? pageTitle.slice(0, 14) + '...' : pageTitle}
              </text>
              <text x="${pageX}" y="${pageY + 12}" 
                    text-anchor="middle" dominant-baseline="middle" 
                    fill="${isDark ? '#999' : '#777'}" font-size="9">
                /${pageName}
              </text>
              ${subcount > 0 ? `
                <text x="${pageX}" y="${pageY + 22}" 
                      text-anchor="middle" dominant-baseline="middle" 
                      fill="${isDark ? '#888' : '#666'}" font-size="8">
                  +${subcount} sub
                </text>
              ` : ''}
            </g>
          `;
        });
        
        // Show "more" indicator if there are additional pages
        const remainingPages = Object.keys(sectionData.children || {}).length - 4;
        if (remainingPages > 0) {
          html += `
            <text x="${sectionX}" y="${pageY + 45}" 
                  text-anchor="middle" 
                  fill="${isDark ? '#666' : '#999'}" font-size="11" font-style="italic">
              +${remainingPages} more...
            </text>
          `;
        }
      }
    });
    
    html += `</svg>`;
    return html;
  }

  function collectPagePaths(node, prefix) {
    const results = [];
    if (node && node.isPage) {
      results.push(prefix);
    }
    const children = node?.children || {};
    Object.entries(children).forEach(([childName, childNode]) => {
      const childPath = `${prefix}/${childName}`;
      results.push(...collectPagePaths(childNode, childPath));
    });
    return results;
  }

  // Render site tree
  function renderSiteTree(structure) {
    const sections = Object.entries(structure.children);
    if (sections.length === 0) {
      return '<div style="color: var(--text-tertiary);">Flat site structure (no directories)</div>';
    }
    
    return sections.slice(0, 6).map(([name, data], index) => {
      const pagePaths = Array.from(new Set(collectPagePaths(data, `/${name}`)));
      const color = getColorForSection(name);
      const isOpen = index === 0 ? 'open' : '';
      
      return `
        <details ${isOpen} style="background: var(--bg-tertiary); border-left: 3px solid ${color}; padding: 1rem; border-radius: 0 var(--radius-md) var(--radius-md) 0; transition: all 0.2s ease;">
          <summary style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; list-style: none;">
            <span style="color: ${color}; font-weight: 600; font-size: 0.95rem;">/${name}/</span>
            <span style="background: ${color}20; color: ${color}; padding: 0.25rem 0.65rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${data.count} ${data.count === 1 ? 'page' : 'pages'}</span>
          </summary>
          ${pagePaths.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.75rem;">
              ${pagePaths.map(pagePath => `
                <span style="background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: var(--text-tertiary);">${pagePath}</span>
              `).join('')}
            </div>
          ` : '<div style="color: var(--text-tertiary); font-size: 0.8rem; font-style: italic; margin-top: 0.5rem;">No pages found</div>'}
        </details>
      `;
    }).join('');
  }

  function getColorForSection(name) {
    const colors = ['#00ff41', '#00d9ff', '#bb77ff', '#ffd700', '#ff6b6b', '#4ecdc4'];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  // Render tech stack
  function renderTechStack(stack) {
    let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';
    
    if (stack.cms) {
      html += `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.8rem;">${stack.cms.icon}</span>
          <div>
            <div style="color: var(--text-primary); font-weight: 600; font-size: 0.95rem;">${stack.cms.name}</div>
            <div style="color: var(--text-tertiary); font-size: 0.8rem;">${stack.cms.confidence}% confidence</div>
          </div>
        </div>
      `;
    }
    
    if (stack.framework) {
      html += `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.8rem;">${stack.framework.icon}</span>
          <div>
            <div style="color: var(--text-primary); font-weight: 600; font-size: 0.95rem;">${stack.framework.name}</div>
            <div style="color: var(--text-tertiary); font-size: 0.8rem;">Framework detected</div>
          </div>
        </div>
      `;
    }
    
    if (stack.server) {
      html += `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.8rem;">${stack.server.icon}</span>
          <div>
            <div style="color: var(--text-primary); font-weight: 600; font-size: 0.95rem;">${stack.server.name}</div>
            <div style="color: var(--text-tertiary); font-size: 0.8rem;">Server technology</div>
          </div>
        </div>
      `;
    }
    
    if (!stack.cms && !stack.framework && !stack.server) {
      html += '<div style="color: var(--text-tertiary);">Could not detect specific technologies. Run full scan for detailed analysis.</div>';
    }
    
    html += '</div>';
    return html;
  }

  // Render hosting info
  function renderHostingInfo(info) {
    let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';
    
    html += `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span style="font-size: 1.5rem;">🌐</span>
        <div>
          <div style="color: var(--text-primary); font-family: var(--font-mono); font-size: 0.9rem;">${info.domain}</div>
          <div style="color: var(--text-tertiary); font-size: 0.8rem;">Domain</div>
        </div>
      </div>
    `;
    
    if (info.provider) {
      html += `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.8rem;">${info.provider.icon}</span>
          <div>
            <div style="color: var(--text-primary); font-weight: 600; font-size: 0.95rem;">${info.provider.name}</div>
            <div style="color: var(--text-tertiary); font-size: 0.8rem;">${info.provider.type}</div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">☁️</span>
          <div>
            <div style="color: var(--text-primary); font-size: 0.95rem;">Custom/Unknown Hosting</div>
            <div style="color: var(--text-tertiary); font-size: 0.8rem;">Use IP Reputation tool for details</div>
          </div>
        </div>
      `;
    }
    
    html += `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span style="font-size: 1.5rem;">🔒</span>
        <div>
          <div style="color: #00ff41; font-weight: 600;">SSL/HTTPS Active</div>
          <div style="color: var(--text-tertiary); font-size: 0.8rem;">Secure connection</div>
        </div>
      </div>
    `;
    
    html += '</div>';
    return html;
  }

  // Render page statistics
  function renderPageStats(structure, pages) {
    const sections = Object.keys(structure.children).length;
    const avgDepth = pages.reduce((sum, url) => {
      try {
        return sum + new URL(url).pathname.split('/').filter(p => p).length;
      } catch (e) { return sum; }
    }, 0) / Math.max(pages.length, 1);
    
    const extensions = {};
    pages.forEach(url => {
      const ext = url.split('.').pop().split('?')[0].toLowerCase();
      if (['html', 'htm', 'php', 'aspx', 'asp', 'jsp'].includes(ext)) {
        extensions[ext] = (extensions[ext] || 0) + 1;
      }
    });
    
    return `
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #888;">Total Pages</span>
          <span style="color: #00ff41; font-weight: bold; font-size: 1.25rem;">${pages.length}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #888;">Top-level Sections</span>
          <span style="color: #00d9ff; font-weight: bold;">${sections}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #888;">Avg Path Depth</span>
          <span style="color: #bb77ff; font-weight: bold;">${avgDepth.toFixed(1)} levels</span>
        </div>
        ${Object.keys(extensions).length > 0 ? `
          <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="color: #888; font-size: 0.8rem; margin-bottom: 0.5rem;">File Types:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
              ${Object.entries(extensions).map(([ext, count]) => `
                <span style="background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: #ffd700;">.${ext}: ${count}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Get page type info (icon and label)
  function getPageType(url) {
    const path = url.toLowerCase();
    if (path.includes('/blog') || path.includes('/article') || path.includes('/news') || path.includes('/post')) {
      return { icon: '📝', label: 'Blog', color: '#8b5cf6' };
    }
    if (path.includes('/product') || path.includes('/shop') || path.includes('/store') || path.includes('/item')) {
      return { icon: '🛒', label: 'Product', color: '#10b981' };
    }
    if (path.includes('/about') || path.includes('/team') || path.includes('/company')) {
      return { icon: '👥', label: 'About', color: '#6366f1' };
    }
    if (path.includes('/contact') || path.includes('/support') || path.includes('/help')) {
      return { icon: '📞', label: 'Contact', color: '#ec4899' };
    }
    if (path.includes('/event') || path.includes('/calendar') || path.includes('/schedule')) {
      return { icon: '📅', label: 'Event', color: '#f59e0b' };
    }
    if (path.includes('/gallery') || path.includes('/photo') || path.includes('/image') || path.includes('/media')) {
      return { icon: '🖼️', label: 'Media', color: '#14b8a6' };
    }
    if (path.includes('/faq') || path.includes('/question')) {
      return { icon: '❓', label: 'FAQ', color: '#f97316' };
    }
    if (path.includes('/login') || path.includes('/signin') || path.includes('/account') || path.includes('/register')) {
      return { icon: '🔐', label: 'Auth', color: '#ef4444' };
    }
    if (path.includes('/search') || path.includes('/find')) {
      return { icon: '🔍', label: 'Search', color: '#3b82f6' };
    }
    if (path.match(/\.(pdf|doc|docx|xls|xlsx)$/i)) {
      return { icon: '📄', label: 'Document', color: '#dc2626' };
    }
    if (path.match(/\/$/) || path.split('/').filter(p => p).length <= 1) {
      return { icon: '🏠', label: 'Main', color: '#22c55e' };
    }
    return { icon: '📃', label: 'Page', color: '#64748b' };
  }

  // Get page section for filtering
  function getPageSection(url) {
    try {
      const path = new URL(url).pathname;
      const parts = path.split('/').filter(p => p);
      return parts[0] || 'root';
    } catch (e) {
      return 'root';
    }
  }

  // Format page URL for display
  function formatPageUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch (e) {
      return url;
    }
  }

  // Render SEO insights
  function renderSeoInsights(pages, structure) {
    const insights = [];
    
    // URL length analysis
    const longUrls = pages.filter(url => url.length > 100);
    if (longUrls.length > 0) {
      insights.push({ icon: '⚠️', text: `${longUrls.length} URLs exceed 100 characters (may affect SEO)`, type: 'warning' });
    } else {
      insights.push({ icon: '✅', text: 'All URLs are reasonably short', type: 'success' });
    }
    
    // Query parameter detection
    const queryUrls = pages.filter(url => url.includes('?'));
    if (queryUrls.length > 0) {
      insights.push({ icon: '📊', text: `${queryUrls.length} pages use query parameters`, type: 'info' });
    }
    
    // Deep nesting detection
    const deepPages = pages.filter(url => {
      try {
        return new URL(url).pathname.split('/').filter(p => p).length > 4;
      } catch (e) { return false; }
    });
    if (deepPages.length > 0) {
      insights.push({ icon: '📁', text: `${deepPages.length} pages are deeply nested (5+ levels)`, type: 'warning' });
    }
    
    // Orphan sections (only 1 page)
    const orphanSections = Object.entries(structure.children).filter(([, data]) => data.count === 1);
    if (orphanSections.length > 0) {
      insights.push({ icon: '🔗', text: `${orphanSections.length} sections have only 1 page`, type: 'info' });
    }
    
    // File extension diversity
    const extensions = new Set(pages.map(url => {
      const ext = url.split('.').pop().split('?')[0].toLowerCase();
      return ['html', 'htm', 'php', 'aspx', 'asp', 'jsp'].includes(ext) ? ext : 'clean';
    }));
    if (extensions.size > 2) {
      insights.push({ icon: '🔀', text: `Multiple URL formats detected (${extensions.size} types)`, type: 'info' });
    }
    
    // Good structure check
    const avgPagesPerSection = pages.length / Math.max(Object.keys(structure.children).length, 1);
    if (avgPagesPerSection > 2 && avgPagesPerSection < 20) {
      insights.push({ icon: '✅', text: 'Well-organized site structure', type: 'success' });
    }
    
    const typeColors = { success: '#00ff41', warning: '#ffc107', info: '#00d9ff' };
    
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75rem;">
        ${insights.map(insight => `
          <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: rgba(0,0,0,0.2); border-radius: 6px; border-left: 3px solid ${typeColors[insight.type]};">
            <span style="font-size: 1.1rem;">${insight.icon}</span>
            <span style="color: #ddd; font-size: 0.9rem;">${insight.text}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Render grouped pages view
  function renderGroupedPages(pages, structure) {
    const groups = {};
    pages.forEach(url => {
      const section = getPageSection(url);
      if (!groups[section]) groups[section] = [];
      groups[section].push(url);
    });
    
    return Object.entries(groups).map(([section, sectionPages]) => `
      <details style="margin-bottom: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <summary style="padding: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: #00d9ff;">📁</span>
            <strong>/${section}/</strong>
          </span>
          <span style="background: rgba(0, 217, 255, 0.2); color: #00d9ff; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
            ${sectionPages.length} page${sectionPages.length !== 1 ? 's' : ''}
          </span>
        </summary>
        <div style="padding: 0 1rem 1rem 1rem;">
          ${sectionPages.map((page, idx) => {
            const pageType = getPageType(page);
            return `
              <div class="page-item" style="padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 1rem; margin-right: 0.3rem;">${pageType.icon}</span>
                <a href="${page}" target="_blank" rel="noopener" style="flex: 1; font-size: 0.9rem;">${formatPageUrl(page)}</a>
                <div style="display: flex; gap: 0.5rem;">
                  <button class="action-btn analyze" onclick="window.open('/tag-intelligence.html?url=${encodeURIComponent(page)}', '_blank')">Tags</button>
                  <button class="action-btn analyze" onclick="window.open('/enhanced-fonts.html?url=${encodeURIComponent(page)}', '_blank')">Fonts</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </details>
    `).join('');
  }

  // Filter pages by search term
  window.filterPages = function(searchTerm) {
    const pagesList = document.getElementById('pagesList');
    const noResults = document.getElementById('noResults');
    const items = pagesList.querySelectorAll('.page-item');
    let visibleCount = 0;
    
    items.forEach(item => {
      const url = item.dataset.url || '';
      const matches = url.includes(searchTerm.toLowerCase());
      item.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });
    
    noResults.style.display = visibleCount === 0 ? 'block' : 'none';
  };

  // Filter pages by section
  window.filterBySection = function(section) {
    const pagesList = document.getElementById('pagesList');
    const noResults = document.getElementById('noResults');
    const items = pagesList.querySelectorAll('.page-item');
    let visibleCount = 0;
    
    items.forEach(item => {
      const itemSection = item.dataset.section || '';
      const matches = !section || itemSection === section;
      item.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });
    
    noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    document.getElementById('pageSearch').value = '';
  };

  // Toggle between list and grouped view
  window.toggleViewMode = function() {
    const listView = document.getElementById('pagesList');
    const groupedView = document.getElementById('groupedView');
    const btn = document.getElementById('viewModeBtn');
    
    if (listView.style.display === 'none') {
      listView.style.display = '';
      groupedView.style.display = 'none';
      btn.textContent = '📁 Group View';
    } else {
      listView.style.display = 'none';
      groupedView.style.display = '';
      btn.textContent = '📋 List View';
    }
  };

  // Global functions for button handlers
  window.analyzeAllFonts = function(url) {
    const maxPages = window.crawlData?.results?.pagesDiscovered || 5;
    window.location.href = `/enhanced-fonts.html?url=${url}&maxPages=${Math.min(maxPages, 10)}`;
  };

  window.analyzeAllTags = function(url) {
    const maxPages = window.crawlData?.results?.pagesDiscovered || 5;
    window.location.href = `/tag-intelligence.html?url=${url}&maxPages=${Math.min(maxPages, 10)}`;
  };

  window.analyzePerformance = function(url) {
    window.location.href = `/performance-snapshot.html?url=${url}`;
  };

  window.copyPagesList = function() {
    const pages = window.crawlData?.results?.pages || [];
    const text = pages.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      alert(`Copied ${pages.length} URLs to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  window.downloadJSON = function() {
    const data = window.crawlData;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crawl-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  window.downloadCSV = function() {
    const pages = window.crawlData?.results?.pages || [];
    const csv = 'URL\n' + pages.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crawl-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  window.downloadSitemap = function() {
    const pages = window.crawlData?.results?.pages || [];
    const hostname = window.crawlData?.results?.hostname || 'unknown';
    const now = new Date().toISOString();
    
    // Generate XML sitemap following sitemaps.org protocol
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    pages.forEach(pageUrl => {
      // Ensure URL is absolute
      let fullUrl = pageUrl;
      if (!pageUrl.startsWith('http')) {
        fullUrl = `https://${hostname}${pageUrl.startsWith('/') ? '' : '/'}${pageUrl}`;
      }
      
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(fullUrl)}</loc>\n`;
      xml += `    <lastmod>${now.split('T')[0]}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    });
    
    xml += '</urlset>';
    
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitemap-${hostname}-${new Date().toISOString().split('T')[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Print the visual sitemap
   */
  window.printSitemap = function() {
    const sitemapDiagram = document.getElementById('sitemapDiagram');
    if (!sitemapDiagram) {
      alert('No sitemap to print');
      return;
    }

    // Get the hostname from crawl data URL
    let hostname = 'website';
    try {
      if (window.crawlData && window.crawlData.url) {
        hostname = new URL(window.crawlData.url).hostname;
      }
    } catch (e) {
      console.error('Error parsing hostname:', e);
    }
    
    const pageCount = window.crawlData?.results?.pagesDiscovered || 
                      window.crawlData?.results?.pages?.length || 0;
    const pages = window.crawlData?.results?.pages || [];
    
    // Build page table HTML
    let pageTableHTML = '';
    if (pages.length > 0) {
      pageTableHTML = `
        <div class="page-table">
          <h2>Page Index</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th style="width: 40%; text-align: left;">Page Name</th>
                <th style="width: 60%; text-align: left;">URL</th>
              </tr>
            </thead>
            <tbody>
              ${pages.map((url, index) => {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                const segments = pathname.split('/').filter(s => s);
                const pageName = segments.length > 0 
                  ? segments[segments.length - 1].replace(/-/g, ' ').replace(/\.(html|htm|php)$/i, '')
                  : 'Home';
                return `
                  <tr>
                    <td style="text-align: center; color: #666;">${index + 1}</td>
                    <td style="text-transform: capitalize;">${pageName || 'Home'}</td>
                    <td style="font-family: monospace; font-size: 11px; color: #333;">${url}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the sitemap');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Visual Sitemap - ${hostname}</title>
        <style>
          @page { 
            size: landscape;
            margin: 1.5cm; 
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: white;
            color: #000;
            padding: 20px;
          }
          .header {
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #dd3838;
          }
          .logo-row {
            margin-bottom: 16px;
          }
          .logo-row img {
            height: 24px;
            width: auto;
          }
          .header-content {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
          }
          .header-title {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .header-info {
            text-align: right;
          }
          h1 {
            color: #dd3838;
            margin: 0;
            font-size: 22px;
            font-weight: 700;
          }
          .meta {
            color: #666;
            font-size: 13px;
            line-height: 1.6;
          }
          .sitemap-container {
            background: white;
            border: 2px solid #e5e5e5;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            overflow: visible;
          }
          svg {
            width: 100%;
            height: auto;
          }
          .page-table {
            page-break-before: always;
            margin-top: 30px;
          }
          .page-table h2 {
            color: #dd3838;
            font-size: 18px;
            margin-bottom: 16px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          thead {
            background: #f5f5f5;
          }
          th {
            padding: 10px 12px;
            font-weight: 600;
            color: #333;
            border: 1px solid #ddd;
          }
          td {
            padding: 8px 12px;
            border: 1px solid #e5e5e5;
          }
          tbody tr:nth-child(even) {
            background: #fafafa;
          }
          tbody tr:hover {
            background: #f0f0f0;
          }
          .footer {
            margin-top: 30px;
            padding-top: 16px;
            border-top: 1px solid #e5e5e5;
            font-size: 11px;
            color: #888;
            text-align: center;
          }
          @media print {
            body { 
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .sitemap-container {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-row">
            <img src="/assets/logo-sitemechanic-white.svg" alt="Site Mechanic">
          </div>
          <div class="header-content">
            <div class="header-title">
              <h1>🗺️ Visual Sitemap</h1>
            </div>
            <div class="header-info">
              <div class="meta">
                <strong>${hostname}</strong><br>
                ${pageCount} pages discovered<br>
                Generated ${new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
        <div class="sitemap-container">
          ${document.getElementById('sitemapDiagram')?.innerHTML || '<p>No sitemap data available</p>'}
        </div>
        ${pageTableHTML}
        <div class="footer">
          Generated by Site Mechanic | sitemechanic.io | ${new Date().toLocaleString()}
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  /**
   * Download sitemap as image (SVG or PNG)
   */
  window.downloadSitemapImage = async function() {
    const sitemapDiagram = document.getElementById('sitemapDiagram');
    if (!sitemapDiagram) {
      alert('No sitemap to download');
      return;
    }

    const svgElement = sitemapDiagram.querySelector('svg');
    if (!svgElement) {
      alert('No sitemap diagram found');
      return;
    }

    try {
      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true);
      
      // Create SVG blob
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      // Download SVG
      const hostname = window.crawlData?.results?.hostname || 'website';
      const a = document.createElement('a');
      a.href = svgUrl;
      a.download = `sitemap-${hostname}-${new Date().toISOString().split('T')[0]}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(svgUrl);
      
      // Show success message
      const button = event?.target;
      if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '✓ Downloaded!';
        button.style.background = 'rgba(0, 255, 65, 0.2)';
        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.background = 'rgba(0, 217, 255, 0.1)';
        }, 2000);
      }
    } catch (error) {
      console.error('Error downloading sitemap:', error);
      alert('Failed to download sitemap. Please try again.');
    }
  };

  // Helper function to escape XML special characters
  function escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
        🕷️ Crawling pages with Puppeteer...<br>
        <span style="font-size: 0.75rem; color: #00ffaa;">This may take 30-60 seconds for large sites</span>
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
});
