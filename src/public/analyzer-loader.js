/**
 * Unified Analyzer Loading System
 * Provides consistent loading UI across all analyzer pages
 * Now uses modal overlay format
 */

// i18n helper for analyzer loader
const _t = (key, fallback, params) => {
  // Try window.i18n first (global i18n system)
  if (window.i18n && typeof window.i18n.t === 'function') {
    const translated = window.i18n.t(key);
    if (translated !== key) {
      let value = translated;
      if (params && typeof value === 'string') {
        Object.keys(params).forEach(param => {
          value = value.replace(new RegExp(`\\{\\{?${param}\\}?\\}`, 'g'), params[param]);
        });
      }
      return value;
    }
  }
  // Fallback with interpolation
  let value = fallback || key;
  if (params && typeof value === 'string') {
    Object.keys(params).forEach(param => {
      value = value.replace(new RegExp(`\\{\\{?${param}\\}?\\}`, 'g'), params[param]);
    });
  }
  return value;
};

class AnalyzerLoader {
  constructor(containerId = 'loadingContainer') {
    this.container = document.getElementById(containerId);
    this.steps = [];
    this.currentStep = 0;
    this.startTime = null;
    this.startedAtIso = null;
    this.scanUrl = '';
    this.progressInterval = null;
    this.estimatedSeconds = 0;
    this.isComplete = false;
    this.overrunActive = false;
    this.overlay = null;
    this.longScanMessageInterval = null;
  }

  /**
   * Initialize loading UI with steps
   * @param {Array<{label: string, detail: string}>} steps - Analysis steps
   * @param {string} title - Loading title
   * @param {number} estimatedSeconds - Estimated completion time
   */
  start(steps, title = '[ANALYZING]', estimatedSeconds = 30) {
    this.steps = steps;
    this.currentStep = 0;
    this.startTime = Date.now();
    this.startedAtIso = (typeof window !== 'undefined' && window.SM_SCAN_STARTED_AT) ? window.SM_SCAN_STARTED_AT : new Date().toISOString();
    this.scanUrl = this.getCurrentScanUrl();
    this.estimatedSeconds = Math.max(estimatedSeconds, this.steps.length * 2 || 10);
    this.isComplete = false;
    this.overrunActive = false;

    if (this.longScanMessageInterval) {
      clearInterval(this.longScanMessageInterval);
      this.longScanMessageInterval = null;
    }

    // Cache-bust logo assets so updates show immediately without relying on hard refresh.
    const logoAssetVersion = '20260112.2';
    
    // Create modal overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'analyzer-loading-overlay active';
    this.overlay.id = 'analyzerLoadingOverlay';

    const scanUrlDisplay = this.formatUrlForDisplay(this.scanUrl);
    const scanUrlEscaped = this.escapeHtml(this.scanUrl);
    const scanUrlDisplayEscaped = this.escapeHtml(scanUrlDisplay);
    const titleEscaped = this.escapeHtml(title);
    
    // Build loading HTML inside overlay
    this.overlay.innerHTML = `
      <div class="analyzer-loading active">
        <div class="loading-header">
          <div class="loading-brand" aria-hidden="true">
            <img src="/assets/logo-dark.svg?v=${logoAssetVersion}" alt="" class="loading-logo loading-logo-dark" />
            <img src="/assets/logo-light.svg?v=${logoAssetVersion}" alt="" class="loading-logo loading-logo-light" />
          </div>

          <div class="loading-title-row">
            <h2 class="loading-title">${titleEscaped}</h2>
            <span id="progressPercentage" style="font-size: 1rem; font-weight: 700; color: var(--accent-primary); min-width: 45px; text-align: right;">0%</span>
          </div>
        </div>

        ${scanUrlDisplay ? `
          <div class="loading-url-row">
            <span class="loading-scan-url" title="${scanUrlEscaped}">${scanUrlDisplayEscaped}</span>
          </div>
        ` : ''}

        <div class="loading-progress-bar">
          <div class="progress-bar-fill" id="progressBarFill" style="width: 0%"></div>
        </div>

        <div class="loading-meta" aria-label="${_t('loader.scanTiming', 'Scan timing')}">
          <div class="loading-meta__item" id="scanStartedAt">${_t('loader.started', 'Started:')} ${this.formatDateTime(this.startedAtIso)}</div>
          <div class="loading-meta__item" id="scanDuration">${_t('loader.duration', 'Duration:')} 0s</div>
        </div>

        <div class="progress-steps" id="progressSteps">
          ${steps.map((step, index) => `
            <div class="progress-step ${index === 0 ? 'active' : 'pending'}" data-step="${index}">
              <div class="step-icon"></div>
              <div class="step-text">
                <div class="step-label">${step.label}</div>
                <div class="step-detail">${step.detail}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="loading-long-scan" id="longScanContainer" hidden>
          <span class="loading-spinner" aria-hidden="true"></span>
          <div class="loading-long-scan__text">
            <div class="loading-long-scan__title">${_t('loader.stillWorking', 'Still working…')}</div>
            <div class="loading-long-scan__message" id="longScanMessage">${_t('loader.longScan1', 'Some sites take longer to analyze.')}</div>
          </div>
        </div>

        <div class="estimated-time">
          <p class="time-label" id="timeLabel">${_t('loader.timeRemaining', 'Time remaining:')}</p>
          <p class="time-value" id="timeRemaining">${this.formatTime(this.estimatedSeconds)}</p>
        </div>
      </div>
    `;

    // Add overlay to body
    document.body.appendChild(this.overlay);
    
    // Prevent body scrolling while loading
    document.body.style.overflow = 'hidden';
    
    // Also update the container for backward compatibility
    if (this.container) {
      this.container.style.display = 'none';
    }
    
    // Start progress simulation
    this.simulateProgress();
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  getCurrentScanUrl() {
    try {
      const candidateInputIds = [
        'dashboardUrlInput',
        'urlInput',
        'url',
        'seoUrlInput',
        'securityUrlInput',
        'performanceUrlInput',
        'perfUrlInput',
        'cwvUrlInput',
        'brokenLinksUrlInput',
        'accessibilityUrlInput',
        'mobileUrlInput',
        'hostingUrlInput',
        'ipReputationInput',
      ];

      for (const id of candidateInputIds) {
        const input = document.getElementById(id);
        const value = input && typeof input.value === 'string' ? input.value.trim() : '';
        if (value) return value;
      }

      const anyInput = document.querySelector('input[type="url"], input[name="url"], input[id*="url" i]');
      const fromAnyInput = anyInput && typeof anyInput.value === 'string' ? anyInput.value.trim() : '';
      if (fromAnyInput) return fromAnyInput;

      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('url');
      return fromQuery ? fromQuery.trim() : '';
    } catch {
      return '';
    }
  }

  formatUrlForDisplay(rawUrl) {
    const raw = String(rawUrl || '').trim();
    if (!raw) return '';

    let printable = raw;
    try {
      const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const u = new URL(withProto);
      const host = u.hostname || raw;
      const path = (u.pathname && u.pathname !== '/') ? u.pathname : '';
      printable = `${host}${path}`;
    } catch {
      printable = raw.replace(/^https?:\/\//i, '');
    }

    printable = printable.replace(/\/$/, '');
    const maxLen = 44;
    if (printable.length <= maxLen) return printable;
    return `${printable.slice(0, maxLen - 1)}…`;
  }

  /**
   * Update to next step
   * @param {number} stepIndex - Step to activate (optional, auto-increments if not provided)
   */
  nextStep(stepIndex) {
    const index = stepIndex !== undefined ? stepIndex : this.currentStep + 1;
    const container = this.overlay || document;

    if (index > this.steps.length) return;

    // Mark ALL steps from currentStep up to (but not including) index as complete
    // This prevents steps from being skipped and left in pending state
    for (let i = this.currentStep; i < index && i < this.steps.length; i++) {
      const stepEl = container.querySelector(`.progress-step[data-step="${i}"]`);
      if (stepEl) {
        stepEl.classList.remove('active', 'pending');
        stepEl.classList.add('complete');
      }
    }

    // Activate current step
    if (index < this.steps.length) {
      const currentStepEl = container.querySelector(`.progress-step[data-step="${index}"]`);
      if (currentStepEl) {
        currentStepEl.classList.remove('pending');
        currentStepEl.classList.add('active');
      }
    }

    this.currentStep = index;
    this.updateProgress();
  }

  /**
   * Mark a step as complete
   * @param {number} stepIndex - Step to mark complete
   */
  completeStep(stepIndex) {
    const container = this.overlay || document;
    const step = container.querySelector(`.progress-step[data-step="${stepIndex}"]`);
    if (step) {
      step.classList.remove('active', 'pending');
      step.classList.add('complete');
    }
    this.updateProgress();
  }

  /**
   * Mark a step as error
   * @param {number} stepIndex - Step that failed
   * @param {string} errorMessage - Error description
   */
  errorStep(stepIndex, errorMessage) {
    const container = this.overlay || document;
    const step = container.querySelector(`.progress-step[data-step="${stepIndex}"]`);
    if (step) {
      step.classList.remove('active', 'pending', 'complete');
      step.classList.add('error');
      
      const detail = step.querySelector('.step-detail');
      if (detail) {
        detail.textContent = errorMessage || _t('loader.analysisFailed', 'Analysis failed');
      }
    }
  }

  /**
   * Update progress bar based on completed steps
   */
  updateProgress() {
    const container = this.overlay || document;
    const completed = container.querySelectorAll('.progress-step.complete').length;
    const total = this.steps.length;
    const percentage = (completed / total) * 100;
    
    const progressBar = container.querySelector('#progressBarFill');
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }
    
    const percentageDisplay = container.querySelector('#progressPercentage');
    if (percentageDisplay) {
      percentageDisplay.textContent = `${Math.round(percentage)}%`;
    }
  }

  /**
   * Simulate progress with estimated time
   */
  simulateProgress() {
    const updateInterval = 1000; // Update every second
    let elapsed = 0;

    this.progressInterval = setInterval(() => {
      if (this.isComplete) {
        clearInterval(this.progressInterval);
        return;
      }

      elapsed += updateInterval / 1000;
      const remaining = Math.max(0, this.estimatedSeconds - elapsed);

      this.updateDurationValue(this.formatTime(Math.floor(elapsed)));
      
      if (!this.overrunActive && remaining <= 0) {
        this.enterOverrunState();
      }

      if (this.overrunActive) {
        this.updateOverrunTime(elapsed);
      } else {
        this.updateTimeValue(this.formatTime(Math.ceil(remaining)));
      }

      // Auto-advance steps based on time
      const stepDuration = this.steps.length ? this.estimatedSeconds / this.steps.length : this.estimatedSeconds;
      const expectedStep = Math.floor(elapsed / stepDuration);
      
      if (expectedStep > this.currentStep && expectedStep < this.steps.length) {
        this.nextStep(expectedStep);
      }

      if (!this.overrunActive && remaining <= 0) {
        clearInterval(this.progressInterval);
      }
    }, updateInterval);
  }

  /**
   * Complete the loading process
   */
  complete() {
    this.isComplete = true;
    this.overrunActive = false;

    if (this.longScanMessageInterval) {
      clearInterval(this.longScanMessageInterval);
      this.longScanMessageInterval = null;
    }
    
    // Query within overlay if it exists, otherwise fallback to document
    const container = this.overlay || document;
    
    // Mark all steps complete
    container.querySelectorAll('.progress-step').forEach(step => {
      step.classList.remove('active', 'pending');
      step.classList.add('complete');
    });

    const progressBar = container.querySelector('#progressBarFill');
    if (progressBar) {
      progressBar.style.width = '100%';
    }
    
    const percentageDisplay = container.querySelector('#progressPercentage');
    if (percentageDisplay) {
      percentageDisplay.textContent = '100%';
    }

    const timeElement = container.querySelector('#timeRemaining');
    if (timeElement) {
      timeElement.textContent = _t('loader.complete', 'Complete!');
      timeElement.style.color = 'var(--accent-primary)';
    }

    clearInterval(this.progressInterval);

    // Fade out after 800ms
    setTimeout(() => {
      this.hide();
    }, 800);
  }

  /**
   * Hide loading UI
   */
  hide() {
    this.isComplete = true;
    this.overrunActive = false;

    if (this.longScanMessageInterval) {
      clearInterval(this.longScanMessageInterval);
      this.longScanMessageInterval = null;
    }
    
    // Remove modal overlay
    if (this.overlay) {
      this.overlay.classList.remove('active');
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        // Restore body scrolling
        document.body.style.overflow = '';
      }, 300);
    }
    
    // Also hide container for backward compatibility
    if (this.container) {
      const loader = this.container.querySelector('.analyzer-loading');
      if (loader) {
        loader.classList.remove('active');
        setTimeout(() => {
          this.container.style.display = 'none';
        }, 300);
      }
    }
    clearInterval(this.progressInterval);
  }

  /**
   * Show error state
   */
  showError(message) {
    this.isComplete = true;
    this.overrunActive = false;

    // Clear all intervals
    if (this.longScanMessageInterval) {
      clearInterval(this.longScanMessageInterval);
      this.longScanMessageInterval = null;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    const container = this.overlay || this.container;
    const loader = container ? container.querySelector('.analyzer-loading') : null;
    if (loader) {
      // Sanitize message to prevent XSS
      const sanitizedMessage = String(message)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

      loader.innerHTML = `
        <div class="loading-header">
          <h2 class="loading-title" style="color: #ff4444;">✗ ${_t('loader.analysisFailed', 'Analysis Failed')}</h2>
          <p class="loading-subtitle" style="color: var(--text-primary); margin-top: 1rem; max-width: 500px; margin-left: auto; margin-right: auto;">${sanitizedMessage}</p>
        </div>
        <div style="text-align: center; margin-top: 2rem;">
          <button class="analyze-button" id="retry-button">${_t('loader.tryAgain', 'Try Again')}</button>
        </div>
      `;

      // Add event listener (CSP-compliant)
      const retryButton = loader.querySelector('#retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', () => location.reload());
      }
    }
  }

  /**
   * Format seconds into readable time
   */
  formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  updateTimeValue(displayText) {
    const container = this.overlay || document;
    const timeElement = container.querySelector('#timeRemaining');
    if (timeElement) {
      timeElement.textContent = displayText;
    }
  }

  enterOverrunState() {
    if (this.overrunActive) return;
    this.overrunActive = true;
    const container = this.overlay || document;

    const longScan = container.querySelector('#longScanContainer');
    if (longScan) {
      longScan.hidden = false;
    }

    const messages = [
      _t('loader.longScan1', 'Some sites take longer to analyze.'),
      _t('loader.longScan2', 'Still collecting metrics and validating results.'),
      _t('loader.longScan3', 'Almost there — finishing up the final checks.')
    ];

    const messageEl = container.querySelector('#longScanMessage');
    if (messageEl && !this.longScanMessageInterval) {
      let messageIndex = 0;
      this.longScanMessageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        messageEl.textContent = messages[messageIndex];
      }, 6500);
    }

    const label = container.querySelector('#timeLabel');
    if (label) {
      label.textContent = _t('loader.additionalTime', 'Additional time:');
      label.classList.add('overrun');
    }
    const value = container.querySelector('#timeRemaining');
    if (value) {
      value.classList.add('overrun');
    }
  }

  formatDateTime(isoString) {
    if (!isoString) return '-';
    try {
      // Use i18n locale if available for proper internationalization
      if (window.i18n?.formatDateTime) {
        return window.i18n.formatDateTime(new Date(isoString));
      }
      // Fallback to browser locale
      const locale = window.i18n?.currentLanguage || navigator.language || 'en-US';
      return new Date(isoString).toLocaleString(locale);
    } catch {
      return String(isoString);
    }
  }

  updateDurationValue(displayText) {
    const container = this.overlay || document;
    const durationEl = container.querySelector('#scanDuration');
    if (durationEl) {
      durationEl.textContent = `${_t('loader.duration', 'Duration:')} ${displayText}`;
    }
  }

  updateOverrunTime(elapsedSeconds) {
    const extraSeconds = Math.max(0, Math.ceil(elapsedSeconds - this.estimatedSeconds));
    this.updateTimeValue(extraSeconds > 0 ? `+${extraSeconds}s` : '+0s');
  }
}

// Export for use in other scripts (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyzerLoader;
}

// Expose to browser window
if (typeof window !== 'undefined') {
  // IMPORTANT: Expose the class directly as window.AnalyzerLoader
  // This maintains backward compatibility with `new AnalyzerLoader()` usage
  window.AnalyzerLoader = AnalyzerLoader;
  window.AnalyzerLoaderClass = AnalyzerLoader;

  // Also provide a singleton instance API for dashboard compatibility
  // Lazily created on first use
  let _singletonInstance = null;
  const stepMap = new Map();

  function getSingleton() {
    if (!_singletonInstance) {
      _singletonInstance = new AnalyzerLoader('loadingContainer');
    }
    return _singletonInstance;
  }

  // Attach static methods to the class for alternative API usage
  window.AnalyzerLoader.api = {
    show: (steps, title, estimatedSeconds) => {
      const loaderInstance = getSingleton();
      stepMap.clear();
      steps.forEach((step, index) => {
        stepMap.set(step.id, index);
      });

      const loaderSteps = steps.map(s => ({
        label: s.label,
        detail: s.detail || ''
      }));

      return loaderInstance.start(loaderSteps, title, estimatedSeconds);
    },

    updateStep: (stepId, status) => {
      const stepIndex = stepMap.get(stepId);
      if (stepIndex === undefined) return;
      const loaderInstance = getSingleton();

      if (status === 'active') {
        loaderInstance.nextStep(stepIndex);
      } else if (status === 'complete') {
        loaderInstance.completeStep(stepIndex);
      } else if (status === 'error') {
        loaderInstance.errorStep(stepIndex, 'Failed');
      }
    },

    updateProgress: (percent) => {
      const loaderInstance = getSingleton();
      const container = loaderInstance.overlay || document;
      const progressBar = container.querySelector('#progressBarFill');
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
      const percentageDisplay = container.querySelector('#progressPercentage');
      if (percentageDisplay) {
        percentageDisplay.textContent = `${Math.round(percent)}%`;
      }
    },

    complete: (message) => getSingleton().complete(message),
    error: (message) => getSingleton().error(message),
    hide: () => getSingleton().hide()
  };

  // Expose direct aliases on window.AnalyzerLoader for backward compatibility
  // This allows calling window.AnalyzerLoader.show() instead of window.AnalyzerLoader.api.show()
  window.AnalyzerLoader.show = window.AnalyzerLoader.api.show;
  window.AnalyzerLoader.updateStep = window.AnalyzerLoader.api.updateStep;
  window.AnalyzerLoader.updateProgress = window.AnalyzerLoader.api.updateProgress;
  window.AnalyzerLoader.complete = window.AnalyzerLoader.api.complete;
  window.AnalyzerLoader.error = window.AnalyzerLoader.api.error;
  window.AnalyzerLoader.hide = window.AnalyzerLoader.api.hide;
}
