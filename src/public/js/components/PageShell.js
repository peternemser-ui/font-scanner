/**
 * Site Mechanic - PageShell Component
 * Provides a unified page structure for all analyzer pages
 *
 * Creates consistent layout: breadcrumb, page header, URL input, results container
 * Handles URL validation, scan flow, and integrates with AnalyzerLoader
 */

(function(window) {
  'use strict';

  // i18n helper
  function _t(key, fallback, params) {
    let value = fallback || key;
    if (window.i18n && typeof window.i18n.t === 'function') {
      const translated = window.i18n.t(key);
      if (translated !== key) value = translated;
    }
    if (params && typeof value === 'string') {
      Object.keys(params).forEach(p => {
        value = value.replace(new RegExp('\\{\\{' + p + '\\}\\}', 'g'), params[p]);
      });
    }
    return value;
  }

  // Store instances by pageId
  const instances = new Map();

  /**
   * Normalize URL - add https:// if missing
   */
  function normalizeUrl(url) {
    if (!url) return '';
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  }

  /**
   * Validate URL format
   */
  function validateUrl(url) {
    if (!url || !url.trim()) {
      return { valid: false, error: _t('shell.pleaseEnterUrl', 'Please enter a URL') };
    }

    const normalized = normalizeUrl(url);
    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname || !parsed.hostname.includes('.')) {
        return { valid: false, error: _t('shell.pleaseEnterValidDomain', 'Please enter a valid domain') };
      }
      return { valid: true, url: normalized };
    } catch (e) {
      return { valid: false, error: _t('shell.pleaseEnterValidUrl', 'Please enter a valid URL') };
    }
  }

  /**
   * Render breadcrumb HTML
   */
  function renderBreadcrumb(config) {
    const { pageTitle, breadcrumb } = config;
    const crumbs = breadcrumb || [
      { label: 'Dashboard', href: '/dashboard.html', i18nKey: 'nav.dashboard' },
      { label: pageTitle, current: true, i18nKey: config?.i18n?.title }
    ];

    const items = crumbs.map((crumb, index) => {
      if (crumb.current) {
        return `<span aria-current="page"${crumb.i18nKey ? ` data-i18n="${crumb.i18nKey}"` : ''}>${crumb.label}</span>`;
      }
      const sep = index < crumbs.length - 1 ? '<span class="breadcrumb-sep">›</span>' : '';
      return `<a href="${crumb.href}"${crumb.i18nKey ? ` data-i18n="${crumb.i18nKey}"` : ''}>${crumb.label}</a>${sep}`;
    }).join('');

    return `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        ${items}
      </nav>
    `;
  }

  /**
   * Render page header HTML
   */
  function renderHeader(config) {
    const { pageTitle, pageDescription, pageIntro, i18n } = config;
    const titleI18n = i18n?.title ? ` data-i18n="${i18n.title}"` : '';
    const subtitleI18n = i18n?.subtitle ? ` data-i18n="${i18n.subtitle}"` : '';
    const introI18n = i18n?.pageIntro ? ` data-i18n="${i18n.pageIntro}"` : '';

    return `
      <header class="page-header">
        <h1 class="page-header__title"${titleI18n}>${pageTitle}</h1>
        ${pageDescription ? `<p class="page-header__subtitle"${subtitleI18n}>${pageDescription}</p>` : ''}
        ${pageIntro ? `<p class="page-header__intro"${introI18n}>${pageIntro}</p>` : ''}
      </header>
    `;
  }

  /**
   * Render tabs HTML (for multi-mode analyzers like Performance Hub)
   * Supports both simple tabs (label only) and rich tabs (label, description, timeEstimate)
   */
  function renderTabs(config) {
    const { tabs, richTabs } = config;
    if (!tabs || tabs.length === 0) return '';

    const tabItems = tabs.map((tab, index) => {
      const isActive = index === 0;
      const proLabel = tab.isPro ? '<span class="tabs__pro-badge">PRO</span>' : '';
      const freeLabel = tab.isFree ? '<span class="tabs__free-badge">FREE</span>' : '';

      // Rich tab format (for Performance Hub style)
      if (richTabs || tab.description) {
        const labelI18n = tab.i18nLabel ? ` data-i18n="${tab.i18nLabel}"` : '';
        const descI18n = tab.i18nDesc ? ` data-i18n="${tab.i18nDesc}"` : '';
        return `
          <button
            type="button"
            class="tabs__item${isActive ? ' tabs__item--active' : ''}"
            data-tab="${tab.id}"
            data-mode="${tab.id}"
            aria-selected="${isActive}"
            role="tab"
            tabindex="${isActive ? '0' : '-1'}"
          >
            <span class="tabs__label"${labelI18n}>${tab.label}</span>
            ${tab.description ? `<span class="tabs__desc"${descI18n}>${tab.description}</span>` : ''}
            ${tab.timeEstimate ? `<span class="tabs__time">${tab.timeEstimate}</span>` : ''}
            ${freeLabel}${proLabel}
          </button>
        `;
      }

      // Simple tab format
      return `
        <button
          type="button"
          class="tabs__item${isActive ? ' tabs__item--active' : ''}"
          data-tab="${tab.id}"
          aria-selected="${isActive}"
          role="tab"
          tabindex="${isActive ? '0' : '-1'}"
        >
          ${tab.label}${proLabel}
        </button>
      `;
    }).join('');

    // Mode indicator below tabs (shown for rich tabs)
    const firstTab = tabs[0];
    const showModeIndicator = richTabs || tabs.some(t => t.description);
    const firstTabLabelI18n = firstTab?.i18nLabel ? ` data-i18n="${firstTab.i18nLabel}"` : '';
    const firstTabDescI18n = firstTab?.i18nDesc ? ` data-i18n="${firstTab.i18nDesc}"` : '';

    const modeDescHtml = showModeIndicator ? `
      <p class="helper-text">
        <span class="mode-indicator">
          <span class="mode-indicator__label" data-i18n="reports.common.mode">Mode:</span>
          <span class="mode-indicator__value" id="selectedMode"${firstTabLabelI18n}>${firstTab.label}</span>
        </span>
      </p>
      <p class="helper-text" id="modeDescription" style="margin-top: 0.25rem;"${firstTabDescI18n}>${firstTab.description || ''}</p>
    ` : '';

    return `
      <div class="tabs" id="modeTabs" role="tablist">
        ${tabItems}
      </div>
      ${modeDescHtml}
    `;
  }

  /**
   * Render input card HTML
   */
  function renderInputCard(config) {
    const { urlInput, scanButton, tabs } = config;
    const ids = getElementIds(config);

    const placeholder = urlInput?.placeholder || 'https://yoursite.com';
    const helperText = urlInput?.helperText || '';
    const buttonText = scanButton?.text || 'Analyze';
    const labelText = urlInput?.label || _t('shell.websiteUrl', 'Website URL');

    const placeholderI18n = urlInput?.i18nPlaceholder ? ` data-i18n-placeholder="${urlInput.i18nPlaceholder}"` : '';
    const labelI18n = urlInput?.i18nLabel ? ` data-i18n="${urlInput.i18nLabel}"` : '';
    const helperI18n = urlInput?.i18nHelper ? ` data-i18n="${urlInput.i18nHelper}"` : '';
    const buttonI18n = scanButton?.i18nText ? ` data-i18n="${scanButton.i18nText}"` : '';

    return `
      <section class="card">
        <div class="card__body">
          ${renderTabs(config)}
          <div class="form-row">
            <label for="${ids.urlInput}" class="visually-hidden"${labelI18n}>${labelText}</label>
            <input
              type="url"
              id="${ids.urlInput}"
              class="input"
              placeholder="${placeholder}"
              ${placeholderI18n}
              required
              aria-required="true"
            />
            <button id="${ids.scanButton}" class="btn btn-primary" aria-label="${buttonText}">
              <span id="buttonText"${buttonI18n}>${buttonText}</span>
            </button>
          </div>
          ${helperText ? `<p class="helper-text"${helperI18n}>${helperText}</p>` : ''}
          <!-- Usage Status Indicator (rendered by UsagePill.js) -->
          <div id="usagePillContainer" class="page-shell-usage-pill"></div>
        </div>
      </section>
    `;
  }

  /**
   * Render results container HTML
   * Wraps in <section id="report-results"> for standardized scroll-to behavior
   */
  function renderResultsContainer(config) {
    const ids = getElementIds(config);

    return `
      <div id="loadingContainer"></div>
      <div id="errorMessage" class="error-message hidden" role="alert" aria-live="assertive"></div>
      <section id="report-results">
        <div id="${ids.results}" class="results-container" hidden>
          <div id="resultsContent"></div>
          <!-- Results will be dynamically inserted by analyzer script -->
        </div>
      </section>
    `;
  }

  /**
   * Get element IDs - applies legacy ID mapping if configured
   */
  function getElementIds(config) {
    const { legacyIds, pageId } = config;
    const defaultPrefix = pageId ? pageId.replace(/-/g, '') : '';

    return {
      urlInput: legacyIds?.urlInput || (defaultPrefix ? `${defaultPrefix}UrlInput` : 'urlInput'),
      scanButton: legacyIds?.scanButton || (defaultPrefix ? `${defaultPrefix}AnalyzeButton` : 'analyzeButton'),
      results: legacyIds?.results || (defaultPrefix ? `${defaultPrefix}Results` : 'results')
    };
  }

  /**
   * Render the complete page shell HTML
   */
  function render(config) {
    return `
      ${renderBreadcrumb(config)}
      ${renderHeader(config)}
      ${renderInputCard(config)}
      ${renderResultsContainer(config)}
    `;
  }

  /**
   * Initialize a PageShell instance
   * @param {string|HTMLElement} containerSelector - Target container
   * @param {Object} config - Shell configuration
   * @returns {Object} PageShell instance with control methods
   */
  function init(containerSelector, config) {
    const container = typeof containerSelector === 'string'
      ? document.querySelector(containerSelector)
      : containerSelector;

    if (!container) {
      console.error('[PageShell] Container not found:', containerSelector);
      return null;
    }

    // Render the shell HTML
    container.innerHTML = render(config);

    // Ensure freshly-rendered content is translated
    if (window.i18n && typeof window.i18n.translatePage === 'function') {
      window.i18n.translatePage();
    }

    // Get element references
    const ids = getElementIds(config);
    const elements = {
      urlInput: document.getElementById(ids.urlInput),
      scanButton: document.getElementById(ids.scanButton),
      results: document.getElementById(ids.results),
      loadingContainer: document.getElementById('loadingContainer'),
      buttonText: document.querySelector('#buttonText')
    };

    // State
    let isScanning = false;
    let activeTab = config.tabs?.[0]?.id || null;
    let loader = null;

    // Set analyzer key on body
    if (config.analyzerType) {
      window.SM_ANALYZER_KEY = config.analyzerType;
      document.body.setAttribute('data-sm-analyzer-key', config.analyzerType);
    }

    // Print mode: when ?print=1 is in URL (used by Puppeteer PDF export),
    // add styling classes to hide interactive chrome and expand content
    const searchParams = new URLSearchParams(window.location.search);
    const isPrintMode = searchParams.get('print') === '1';
    if (isPrintMode) {
      document.body.classList.add('pdf-export-mode', 'print-pro-tier', 'sm-print-mode');

      // Lock i18n to the locale specified in the URL (set by the PDF server from the DB)
      const forceLocale = searchParams.get('locale');
      if (forceLocale && window.i18n && typeof window.i18n.forceLocale === 'function') {
        window.i18n.forceLocale(forceLocale).catch(e => {
          console.warn('[PageShell] Failed to force locale for print mode:', e);
        });
      }
    }

    /**
     * Get current URL value
     */
    function getUrl() {
      return elements.urlInput?.value?.trim() || '';
    }

    /**
     * Set URL value
     */
    function setUrl(url) {
      if (elements.urlInput) {
        elements.urlInput.value = url || '';
      }
    }

    /**
     * Get the active tab ID
     */
    function getActiveTab() {
      return activeTab;
    }

    /**
     * Set active tab
     */
    function setActiveTab(tabId) {
      if (!config.tabs) return;

      const tab = config.tabs.find(t => t.id === tabId);
      if (!tab) return;

      activeTab = tabId;

      // Update UI
      const tabButtons = container.querySelectorAll('.tabs__item');
      tabButtons.forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        btn.classList.toggle('tabs__item--active', isActive);
        btn.setAttribute('aria-selected', isActive);
        btn.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      // Update mode indicator
      const selectedMode = document.getElementById('selectedMode');
      const modeDescription = document.getElementById('modeDescription');
      if (selectedMode) selectedMode.textContent = tab.label;
      if (modeDescription) modeDescription.textContent = tab.description || '';

      // Update analyzer key if tab has its own
      if (tab.analyzerKey) {
        window.SM_ANALYZER_KEY = tab.analyzerKey;
      }

      // Call onTabChange callback
      if (typeof config.onTabChange === 'function') {
        config.onTabChange(tabId, tab);
      }
    }

    /**
     * Show loading state
     */
    function showLoading(steps) {
      if (elements.results) elements.results.hidden = true;

      // Support loadingSteps as a function (thunk) for lazy i18n evaluation
      const configSteps = typeof config.loadingSteps === 'function' ? config.loadingSteps() : config.loadingSteps;
      const loadingSteps = steps || configSteps || [
        { label: _t('shell.startingAnalysis', 'Starting analysis'), detail: _t('shell.initializingScan', 'Initializing scan engine...') }
      ];

      // Use AnalyzerLoader class (or AnalyzerLoaderClass as fallback)
      const LoaderClass = window.AnalyzerLoader || window.AnalyzerLoaderClass;
      if (LoaderClass && typeof LoaderClass === 'function') {
        loader = new LoaderClass('loadingContainer');
        loader.start(loadingSteps, `[${config.pageTitle?.toUpperCase() || 'ANALYZER'}]`, 25);
      } else {
        console.warn('[PageShell] AnalyzerLoader not available');
      }
    }

    /**
     * Show error message
     */
    function showError(message, options = {}) {
      if (loader) {
        loader.showError(message, options);
      } else {
        // Fallback error display (message set via textContent to avoid HTML injection)
        if (elements.loadingContainer) {
          elements.loadingContainer.innerHTML = `
            <div class="error-message" style="padding: 1rem; color: var(--error-color, #ef4444);"></div>
          `;
          const errorEl = elements.loadingContainer.querySelector('.error-message');
          if (errorEl) errorEl.textContent = message;
        }
      }
    }

    /**
     * Show results
     */
    function showResults(html) {
      if (elements.loadingContainer) {
        elements.loadingContainer.innerHTML = '';
      }
      if (elements.results) {
        if (typeof html === 'string') {
          elements.results.innerHTML = html;
        }
        elements.results.hidden = false;
      }
    }

    /**
     * Clean up previous scan data
     */
    function cleanup() {
      document.body.removeAttribute('data-report-id');
      document.body.removeAttribute('data-sm-screenshot-url');
      document.body.removeAttribute('data-sm-scan-started-at');

      // Destroy Chart.js instances whose canvas lives inside this page's results container
      // (scoped so charts elsewhere on the page are left alone; must run before the
      // container is emptied, or the canvases are no longer inside it)
      if (window.Chart && window.Chart.instances && elements.results) {
        Object.values(window.Chart.instances).forEach(chart => {
          try {
            if (chart.canvas && elements.results.contains(chart.canvas)) {
              chart.destroy();
            }
          } catch (e) { /* ignore */ }
        });
      }

      if (elements.results) {
        elements.results.innerHTML = '';
      }
      if (elements.loadingContainer) {
        elements.loadingContainer.innerHTML = '';
      }
    }

    /**
     * Start a scan
     * @param {Object} [options] - Optional settings
     * @param {boolean} [options.preserveReportId] - Preserve existing report_id (billing return)
     * @param {boolean} [options.billingRescan] - Skip server-side usage tracking (post-purchase re-scan)
     */
    async function startScan(options = {}) {
      const { billingRescan = false } = options;
      const url = getUrl();
      const validation = config.validateUrl ? config.validateUrl(url) : validateUrl(url);

      if (!validation.valid) {
        showError(validation.error);
        return;
      }

      const normalizedUrl = validation.url || normalizeUrl(url);
      isScanning = true;
      window.SM_IS_SCANNING = true;

      // Track current scan URL for context
      window.__SM_CURRENT_SCAN_URL__ = normalizedUrl;

      // Clear stale session purchase markers from previous scans
      // NOTE: Do NOT clear billing cache here — the user's Pro/Day Pass status
      // doesn't change between scans, and nuking the cache causes race conditions
      // where Day Pass users see locked sections if the re-fetch hasn't completed.
      // fetchBillingStatus(true) after scan completion will refresh the data.
      sessionStorage.removeItem('sm_payment_completed_session');
      sessionStorage.removeItem('sm_purchased_report_id');

      // Cleanup previous data
      cleanup();

      // Reset ReportUI waiting state to ensure screenshot card is created
      if (window.ReportUI?.resetWaitingState) {
        window.ReportUI.resetWaitingState();
      }

      // Disable inputs
      if (elements.scanButton) {
        elements.scanButton.disabled = true;
        elements.scanButton.style.opacity = '0.6';
      }
      if (elements.buttonText) {
        elements.buttonText.textContent = config.scanButton?.loadingText || 'Analyzing...';
      }
      if (elements.urlInput) {
        elements.urlInput.disabled = true;
      }

      // Show loading
      showLoading();

      // Track whether success path defers cleanup to its own timeout
      let successPathDeferred = false;

      try {
        const scanStartedAt = new Date().toISOString();
        window.SM_SCAN_STARTED_AT = scanStartedAt;
        document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

        // Set up abort controller with timeout
        const controller = new AbortController();
        const timeout = config.timeout || 60000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const endpoint = config.apiEndpoint || `/api/${config.analyzerType}`;
        const requestBody = {
          url: normalizedUrl,
          scanStartedAt,
          ...(activeTab && { mode: activeTab }),
          ...(billingRescan && { billingRescan: true })
        };

        // Build headers with authentication if available
        const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          data = {};
        }

        if (!response.ok || data.success === false) {
          // Translate known server error codes
          if (data.code === 'SCAN_QUOTA_EXCEEDED') {
            const limit = data.scansLimit || 10;
            showError(_t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.', { limit }), { isQuotaError: true });
            return;
          }
          throw new Error(data.message || data.error || _t('errors.analysisFailed', 'Analysis failed'));
        }

        if (data.success) {
          successPathDeferred = true;

          // Complete loader animation
          if (loader) loader.complete();

          // Build results object
          const results = {
            ...(data.results || {}),
            reportId: data.reportId || data.results?.reportId,
            startedAt: data.startedAt || data.results?.startedAt,
            screenshotUrl: data.screenshotUrl || data.results?.screenshotUrl,
            url: normalizedUrl
          };

          // Store report ID on body
          if (results.reportId) {
            document.body.setAttribute('data-report-id', results.reportId);
          }

          // CRITICAL FIX: Update URL in browser address bar to reflect the scanned URL
          // This prevents URL collision where old URL stays in address bar after new scan
          const newParams = new URLSearchParams();
          newParams.set('url', normalizedUrl);
          if (results.reportId) {
            newParams.set('report_id', results.reportId);
          }
          const newBrowserUrl = `${window.location.pathname}?${newParams.toString()}`;
          window.history.replaceState({}, '', newBrowserUrl);
          console.log('[PageShell] Updated browser URL to:', newBrowserUrl);

          // Set screenshot URL from API response
          if (results.screenshotUrl) {
            document.body.setAttribute('data-sm-screenshot-url', results.screenshotUrl);
          }

          // CRITICAL FIX: Ensure screenshot card is shown
          if (results.reportId && typeof window.ReportUI?.ensurePageScreenshotCard === 'function') {
            setTimeout(() => {
              window.ReportUI.ensurePageScreenshotCard(results.reportId);
              console.log('[PageShell] Called ensurePageScreenshotCard for:', results.reportId);
            }, 100);
          }

          // Call success callback with delay for loader animation.
          // SM_IS_SCANNING stays true until after onScanComplete so that
          // entitlements:updated handlers don't attempt premature re-renders.
          setTimeout(() => {
            // Start billing status fetch in background (non-blocking).
            // Previously this was `await`ed, which blocked onScanComplete when the
            // billing API was slow (cold start, first call). The entitlements:updated
            // handler in each analyzer script re-renders once billing data arrives,
            // so Pro/Day Pass sections unlock automatically without gating the initial render.
            if (window.ProReportBlock?.fetchBillingStatus) {
              console.log('[PageShell] Starting billing status fetch (non-blocking)...');
              window.ProReportBlock.fetchBillingStatus(true)
                .then(() => {
                  const isPro = window.ProReportBlock?.isProSubscriber?.();
                  console.log('[PageShell] Billing status fetched, plan:', isPro ? 'Pro/DayPass' : 'Free');
                  if (isPro) {
                    console.log('[PageShell] Pro/Day Pass user detected - clearing fresh scan payment flag');
                    window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;
                  }
                })
                .catch((e) => {
                  console.warn('[PageShell] Failed to fetch billing status:', e);
                });
            }

            // Display results immediately - don't wait for billing API
            if (typeof config.onScanComplete === 'function') {
              config.onScanComplete(results);
            }

            // Notify UsagePill to refresh scan count
            window.dispatchEvent(new CustomEvent('scan:completed'));

            // NOW clear the scanning flag and re-enable inputs
            isScanning = false;
            window.SM_IS_SCANNING = false;
            if (elements.scanButton) {
              elements.scanButton.disabled = false;
              elements.scanButton.style.opacity = '1';
            }
            if (elements.buttonText) {
              elements.buttonText.textContent = config.scanButton?.text || 'Analyze';
            }
            if (elements.urlInput) {
              elements.urlInput.disabled = false;
            }

            // Dispatch report:ready event for auto-scroll to results
            // Small delay to ensure DOM is updated after onScanComplete
            setTimeout(() => {
              window.__REPORT_READY__ = true;
              window.dispatchEvent(new CustomEvent('report:ready', {
                detail: { reportId: results.reportId, url: normalizedUrl }
              }));
            }, 100);
          }, 1000);
        } else {
          showError(data.message || data.error || _t('errors.analysisFailed', 'Analysis failed'));
        }

      } catch (error) {
        console.error('[PageShell] Scan error:', error);

        let errorMessage = _t('errors.analysisFailedRetry', 'Failed to analyze website. Please try again.');

        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          errorMessage = _t('errors.analysisTimedOut', 'Analysis timed out. The website may be too slow or complex. Please try again.');
        } else if (error.message.includes('bot protection') || error.message.includes('cloudflare')) {
          errorMessage = _t('errors.botProtection', 'This website blocks automated analysis. Try a different website.');
        } else if (error.message.includes('not accessible') || error.message.includes('unreachable')) {
          errorMessage = _t('errors.websiteNotAccessible', 'Website is not accessible. Please check the URL and ensure the website is online.');
        } else if (error.message) {
          errorMessage = error.message;
        }

        if (typeof config.onScanError === 'function') {
          config.onScanError(error, errorMessage);
        } else {
          showError(errorMessage);
        }

      } finally {
        // On success path, cleanup is deferred to the setTimeout callback
        // (which runs after the loader animation and onScanComplete).
        // Only run immediate cleanup for error/else paths.
        if (!successPathDeferred) {
          isScanning = false;
          window.SM_IS_SCANNING = false;

          // Re-enable inputs
          if (elements.scanButton) {
            elements.scanButton.disabled = false;
            elements.scanButton.style.opacity = '1';
          }
          if (elements.buttonText) {
            elements.buttonText.textContent = config.scanButton?.text || 'Analyze';
          }
          if (elements.urlInput) {
            elements.urlInput.disabled = false;
          }
        }
      }
    }

    /**
     * Set up event listeners
     * If config.manualEventHandling is true, skips scan button and URL input listeners
     * (page script will handle these manually for complex flows like Performance Hub)
     */
    function setupEventListeners() {
      // Scan button click (skip if manual handling enabled)
      if (elements.scanButton && !config.manualEventHandling) {
        elements.scanButton.addEventListener('click', () => {
          if (!isScanning) startScan();
        });
      }

      // Enter key in URL input (skip if manual handling enabled)
      if (elements.urlInput && !config.manualEventHandling) {
        elements.urlInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !isScanning) {
            startScan();
          }
        });
      }

      // Tab switching (always enabled - unless manually handled)
      if (config.tabs && !config.manualEventHandling) {
        const tabButtons = container.querySelectorAll('.tabs__item');
        tabButtons.forEach(btn => {
          btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            if (tabId && !isScanning) {
              setActiveTab(tabId);
            }
          });
        });

        // Arrow key navigation for tabs (WAI-ARIA tab pattern)
        const tabList = container.querySelector('[role="tablist"]');
        if (tabList) {
          tabList.addEventListener('keydown', (e) => {
            const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));
            const currentIndex = tabs.indexOf(document.activeElement);
            if (currentIndex === -1) return;

            let newIndex = currentIndex;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault();
              newIndex = (currentIndex + 1) % tabs.length;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            } else if (e.key === 'Home') {
              e.preventDefault();
              newIndex = 0;
            } else if (e.key === 'End') {
              e.preventDefault();
              newIndex = tabs.length - 1;
            } else {
              return;
            }

            const newTab = tabs[newIndex];
            const tabId = newTab.dataset.tab;
            if (tabId && !isScanning) {
              setActiveTab(tabId);
              newTab.focus();
            }
          });
        }
      }
    }

    /**
     * Handle URL parameters (auto-scan, report loading)
     */
    async function handleUrlParams() {
      // In print mode, wait for i18n to finish loading translations before rendering
      // the report. Without this gate, the report renders immediately (data is in
      // localStorage) while ja.json/zh.json is still being fetched, causing all
      // t() calls to return English fallbacks.
      if (isPrintMode && window.i18n) {
        const targetLocale = searchParams.get('locale') || window.i18n.currentLanguage;
        const i18nReady = () =>
          window.i18n.initialized &&
          Object.keys(window.i18n.translations || {}).length > 0 &&
          window.i18n.currentLanguage === targetLocale;

        if (!i18nReady()) {
          console.log(`[PageShell] Print mode: waiting for i18n (target: ${targetLocale})...`);
          await new Promise((resolve) => {
            const check = setInterval(() => {
              if (i18nReady()) { clearInterval(check); resolve(); }
            }, 50);
            // Safety timeout — don't block PDF rendering forever
            setTimeout(() => {
              clearInterval(check);
              console.warn(`[PageShell] i18n wait timed out (current: ${window.i18n.currentLanguage}, target: ${targetLocale})`);
              resolve();
            }, 10000);
          });
          console.log(`[PageShell] i18n ready: ${window.i18n.currentLanguage}, translations: ${Object.keys(window.i18n.translations).length} keys`);
        }
      }

      const params = new URLSearchParams(window.location.search);
      const reportId = params.get('report_id') || '';
      const autoUrl = params.get('url') || (typeof window.getUrlParameter === 'function' ? window.getUrlParameter() : '');
      const autoScan = params.get('auto_scan') === 'true';
      const billingRescanParam = params.get('billing_rescan') === 'true';
      const billingSuccess = params.get('billing_success') === 'true';

      // Set report ID immediately if present
      if (reportId) {
        document.body.setAttribute('data-report-id', reportId);
      }

      // Handle billing return
      if (billingSuccess && !window.__smBillingReturnComplete) {
        // CRITICAL: Clear fresh scan flag - user paid for this report
        console.log('[PageShell] Billing return detected - clearing fresh scan flag');
        window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;

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
        return; // Don't auto-load after billing return
      }

      // Try to load stored report
      if (reportId && typeof config.onScanComplete === 'function') {
        // Fetch billing status first
        if (window.ProReportBlock?.fetchBillingStatus) {
          await window.ProReportBlock.fetchBillingStatus(true);
        }

        // 1. Try browser storage first (fastest)
        let loaded = false;
        if (window.ReportStorage) {
          loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, config.onScanComplete);
        }

        // 2. If not in browser, try fetching from server database
        if (!loaded) {
          console.log(`[PageShell:${config.pageId}] Browser storage miss, trying server for report:`, reportId);
          try {
            const token = localStorage.getItem('sm_token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const resp = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, { headers });
            if (resp.ok) {
              const serverReport = await resp.json();
              if (serverReport.success && serverReport.data) {
                // Build results object from server data (same normalization as scan response)
                const serverData = serverReport.data;
                const results = {
                  ...(serverData.results || {}),
                  reportId: serverData.reportId || serverData.results?.reportId || reportId,
                  startedAt: serverData.startedAt || serverData.results?.startedAt || serverData.timestamp,
                  screenshotUrl: serverData.screenshotUrl || serverData.results?.screenshotUrl,
                  url: serverData.url || autoUrl
                };
                if (results.reportId) {
                  document.body.setAttribute('data-report-id', results.reportId);
                }
                if (results.screenshotUrl) {
                  document.body.setAttribute('data-sm-screenshot-url', results.screenshotUrl);
                }
                // Force the locale from the stored scan so the report renders in its original language
                const serverLocale = serverReport.locale;
                if (serverLocale && window.i18n && typeof window.i18n.forceLocale === 'function') {
                  await window.i18n.forceLocale(serverLocale);
                }
                config.onScanComplete(results);
                loaded = true;
                window.__REPORT_READY__ = true;
                console.log(`[PageShell:${config.pageId}] Report loaded from server successfully`);
              }
            }
          } catch (serverErr) {
            console.warn(`[PageShell:${config.pageId}] Server report fetch failed:`, serverErr.message);
          }
        }

        if (loaded) {
          if (autoUrl) setUrl(autoUrl);
          // Signal for Puppeteer PDF export that report content is rendered
          window.__REPORT_READY__ = true;
          return;
        }

        // Report data not found in browser or server - show unavailable banner
        // Pre-fill URL first so the re-scan button works
        if (autoUrl) setUrl(autoUrl);

        console.log(`[PageShell:${config.pageId}] Report data unavailable, showing banner:`, { reportId, autoUrl });
        if (window.ReportStorage && window.ReportStorage.showReportUnavailableBanner) {
          window.ReportStorage.showReportUnavailableBanner({
            url: autoUrl || '',
            analyzerType: config.pageId || config.analyzerKey || 'report',
            onRescan: () => {
              startScan();
            }
          });
        }
        return; // Don't continue - user should click re-scan
      }

      // No report_id - just pre-fill URL if available
      if (autoUrl) {
        setUrl(autoUrl);
      }

      // Auto-scan if explicitly requested
      if (autoScan && autoUrl) {
        setTimeout(() => startScan({ billingRescan: billingRescanParam }), 500);
      }
    }

    /**
     * Destroy the instance
     */
    function destroy() {
      instances.delete(config.pageId);
      container.innerHTML = '';
    }

    // Set up event listeners (skip if manual handling)
    setupEventListeners();

    // Initialize UsagePill if available
    function initUsagePill() {
      if (window.UsagePill) {
        window.UsagePill.create('#usagePillContainer', {
          mode: 'inline',
          showReports: false,
          showUpgradeLink: true
        });
      }
    }

    // Try to initialize UsagePill now, or wait for it to load
    if (window.UsagePill) {
      initUsagePill();
    } else {
      // UsagePill may not be loaded yet, wait for DOMContentLoaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUsagePill);
      } else {
        // DOM is ready, wait a bit for scripts to load
        setTimeout(initUsagePill, 100);
      }
    }

    // Handle URL parameters (skip if manual handling - page script handles this)
    if (!config.manualEventHandling) {
      handleUrlParams();
    }

    // Create instance object
    const instance = {
      // Element access
      getUrlInput: () => elements.urlInput,
      getScanButton: () => elements.scanButton,
      getResultsContainer: () => elements.results,
      getLoadingContainer: () => elements.loadingContainer,

      // URL management
      getUrl,
      setUrl,

      // Scan control
      startScan,
      isScanning: () => isScanning,

      // Display states
      showLoading,
      showError,
      showResults,
      cleanup,

      // Tab management
      getActiveTab,
      setActiveTab,
      getActiveTabConfig: () => config.tabs?.find(t => t.id === activeTab),

      // Lifecycle
      destroy,

      // Config access
      config
    };

    // Store instance
    if (config.pageId) {
      instances.set(config.pageId, instance);
    }

    return instance;
  }

  /**
   * Get an existing instance by pageId
   */
  function getInstance(pageId) {
    return instances.get(pageId) || null;
  }

  // Public API
  window.PageShell = {
    init,
    render,
    getInstance,
    validateUrl,
    normalizeUrl
  };

})(window);
