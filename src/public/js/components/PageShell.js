/**
 * Site Mechanic - PageShell Component
 * Provides a unified page structure for all analyzer pages
 *
 * Creates consistent layout: breadcrumb, page header, URL input, results container
 * Handles URL validation, scan flow, and integrates with AnalyzerLoader
 */

(function(window) {
  'use strict';

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
      return { valid: false, error: 'Please enter a URL' };
    }

    const normalized = normalizeUrl(url);
    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname || !parsed.hostname.includes('.')) {
        return { valid: false, error: 'Please enter a valid domain' };
      }
      return { valid: true, url: normalized };
    } catch (e) {
      return { valid: false, error: 'Please enter a valid URL' };
    }
  }

  /**
   * Render breadcrumb HTML
   */
  function renderBreadcrumb(config) {
    const { pageTitle, breadcrumb } = config;
    const crumbs = breadcrumb || [
      { label: 'Dashboard', href: '/dashboard.html', i18nKey: 'nav.dashboard' },
      { label: pageTitle, current: true }
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
    const { pageTitle, pageDescription, i18n } = config;
    const titleI18n = i18n?.title ? ` data-i18n="${i18n.title}"` : '';
    const subtitleI18n = i18n?.subtitle ? ` data-i18n="${i18n.subtitle}"` : '';

    return `
      <header class="page-header">
        <h1 class="page-header__title"${titleI18n}>${pageTitle}</h1>
        ${pageDescription ? `<p class="page-header__subtitle"${subtitleI18n}>${pageDescription}</p>` : ''}
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

      // Rich tab format (for Performance Hub style)
      if (richTabs || tab.description) {
        return `
          <button
            type="button"
            class="tabs__item${isActive ? ' tabs__item--active' : ''}"
            data-tab="${tab.id}"
            data-mode="${tab.id}"
            aria-selected="${isActive}"
            role="tab"
          >
            <span class="tabs__label">${tab.label}</span>
            ${tab.description ? `<span class="tabs__desc">${tab.description}</span>` : ''}
            ${tab.timeEstimate ? `<span class="tabs__time">${tab.timeEstimate}</span>` : ''}
            ${proLabel}
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
        >
          ${tab.label}${proLabel}
        </button>
      `;
    }).join('');

    // Mode indicator below tabs (shown for rich tabs)
    const firstTab = tabs[0];
    const showModeIndicator = richTabs || tabs.some(t => t.description);
    const modeDescHtml = showModeIndicator ? `
      <p class="helper-text">
        <span class="mode-indicator">
          <span class="mode-indicator__label">Mode:</span>
          <span class="mode-indicator__value" id="selectedMode">${firstTab.label}</span>
        </span>
      </p>
      <p class="helper-text" id="modeDescription" style="margin-top: 0.25rem;">${firstTab.description || ''}</p>
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
    const labelText = urlInput?.label || 'Website URL';

    const placeholderI18n = urlInput?.i18nPlaceholder ? ` data-i18n-placeholder="${urlInput.i18nPlaceholder}"` : '';
    const labelI18n = urlInput?.i18nLabel ? ` data-i18n="${urlInput.i18nLabel}"` : '';
    const helperI18n = urlInput?.i18nHelper ? ` data-i18n="${urlInput.i18nHelper}"` : '';

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
              aria-label="${labelText}"
            />
            <button id="${ids.scanButton}" class="btn btn-primary" aria-label="${buttonText}">
              <span id="buttonText">${buttonText}</span>
            </button>
          </div>
          ${helperText ? `<p class="helper-text"${helperI18n}>${helperText}</p>` : ''}
        </div>
      </section>
    `;
  }

  /**
   * Render results container HTML
   */
  function renderResultsContainer(config) {
    const ids = getElementIds(config);

    return `
      <div id="loadingContainer"></div>
      <div id="errorMessage" class="error-message hidden" role="alert" aria-live="assertive"></div>
      <div id="${ids.results}" class="results-container" hidden>
        <div id="resultsContent"></div>
        <!-- Results will be dynamically inserted by analyzer script -->
      </div>
    `;
  }

  /**
   * Get element IDs - applies legacy ID mapping if configured
   */
  function getElementIds(config) {
    const { legacyIds, pageId } = config;
    const defaultPrefix = pageId ? pageId.replace(/-/g, '') : '';

    return {
      urlInput: legacyIds?.urlInput || `${defaultPrefix}UrlInput` || 'urlInput',
      scanButton: legacyIds?.scanButton || `${defaultPrefix}AnalyzeButton` || 'analyzeButton',
      results: legacyIds?.results || `${defaultPrefix}Results` || 'results'
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

      const loadingSteps = steps || config.loadingSteps || [
        { label: 'Starting analysis', detail: 'Initializing scan engine...' }
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
    function showError(message) {
      if (loader) {
        loader.showError(message);
      } else {
        // Fallback error display
        if (elements.loadingContainer) {
          elements.loadingContainer.innerHTML = `
            <div class="error-message" style="padding: 1rem; color: var(--error-color, #ef4444);">
              ${message}
            </div>
          `;
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

      if (elements.results) {
        elements.results.innerHTML = '';
      }
      if (elements.loadingContainer) {
        elements.loadingContainer.innerHTML = '';
      }

      // Destroy Chart.js instances if any
      if (window.Chart && window.Chart.instances) {
        Object.values(window.Chart.instances).forEach(chart => {
          try { chart.destroy(); } catch (e) { /* ignore */ }
        });
      }
    }

    /**
     * Start a scan
     */
    async function startScan() {
      const url = getUrl();
      const validation = config.validateUrl ? config.validateUrl(url) : validateUrl(url);

      if (!validation.valid) {
        showError(validation.error);
        return;
      }

      const normalizedUrl = validation.url || normalizeUrl(url);
      isScanning = true;
      window.SM_IS_SCANNING = true;

      // Cleanup previous data
      cleanup();

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
          ...(activeTab && { mode: activeTab })
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          throw new Error(data.message || data.error || 'Analysis failed');
        }

        if (data.success) {
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

          // Call success callback with delay for loader animation
          setTimeout(() => {
            if (typeof config.onScanComplete === 'function') {
              config.onScanComplete(results);
            }
          }, 1000);
        } else {
          showError(data.message || data.error || 'Analysis failed');
        }

      } catch (error) {
        console.error('[PageShell] Scan error:', error);

        let errorMessage = 'Failed to analyze website. Please try again.';

        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          errorMessage = 'Analysis timed out. The website may be too slow or complex. Please try again.';
        } else if (error.message.includes('bot protection') || error.message.includes('cloudflare')) {
          errorMessage = 'This website blocks automated analysis. Try a different website.';
        } else if (error.message.includes('not accessible') || error.message.includes('unreachable')) {
          errorMessage = 'Website is not accessible. Please check the URL and ensure the website is online.';
        } else if (error.message) {
          errorMessage = error.message;
        }

        if (typeof config.onScanError === 'function') {
          config.onScanError(error, errorMessage);
        } else {
          showError(errorMessage);
        }

      } finally {
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
      }
    }

    /**
     * Handle URL parameters (auto-scan, report loading)
     */
    async function handleUrlParams() {
      const params = new URLSearchParams(window.location.search);
      const reportId = params.get('report_id') || '';
      const autoUrl = params.get('url') || (typeof window.getUrlParameter === 'function' ? window.getUrlParameter() : '');
      const autoScan = params.get('auto_scan') === 'true';
      const billingSuccess = params.get('billing_success') === 'true';

      // Set report ID immediately if present
      if (reportId) {
        document.body.setAttribute('data-report-id', reportId);
      }

      // Handle billing return
      if (billingSuccess && !window.__smBillingReturnComplete) {
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
      if (reportId && window.ReportStorage && typeof config.onScanComplete === 'function') {
        // Fetch billing status first
        if (window.ProReportBlock?.fetchBillingStatus) {
          await window.ProReportBlock.fetchBillingStatus(true);
        }

        const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, config.onScanComplete);
        if (loaded) {
          if (autoUrl) setUrl(autoUrl);
          return;
        }
      }

      // Pre-fill URL if provided
      if (autoUrl) {
        setUrl(autoUrl);
      }

      // Auto-scan if explicitly requested
      if (autoScan && autoUrl) {
        setTimeout(() => startScan(), 500);
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
