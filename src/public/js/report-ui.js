/**
 * Site Mechanic - Unified Report UI
 * Central hub for all report UI behaviors
 *
 * Provides:
 * - Global event delegation for screenshots, Pro unlocks, exports
 * - Unified modal system
 * - Screenshot lightbox
 * - Pro gating helpers
 * - Feature flag support
 */

(function(window) {
  // Feature flag for gradual rollout
  const FEATURE_FLAG_KEY = 'use_new_report_ui';

  // Session-scoped toast queue key (used for cross-redirect messages)
  const TOAST_QUEUE_KEY = 'sm_toast_queue';

  function getToastQueue() {
    try {
      const raw = sessionStorage.getItem(TOAST_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function setToastQueue(queue) {
    try {
      sessionStorage.setItem(TOAST_QUEUE_KEY, JSON.stringify(queue || []));
    } catch (e) {
      // ignore
    }
  }

  function enqueueToast(message) {
    if (!message) return;
    const queue = getToastQueue();
    queue.push({ message: String(message), ts: Date.now() });
    setToastQueue(queue);
  }

  function ensureToastContainer() {
    let container = document.getElementById('sm-toast-container');
    if (container) return container;

    container = document.createElement('div');
    container.id = 'sm-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.style.position = 'fixed';
    container.style.left = '50%';
    container.style.bottom = '24px';
    container.style.transform = 'translateX(-50%)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    container.style.zIndex = '9999';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
    return container;
  }

  function showToast(message) {
    if (!message) return;
    const container = ensureToastContainer();

    const toast = document.createElement('div');
    toast.textContent = String(message);
    toast.setAttribute('role', 'status');
    toast.style.pointerEvents = 'none';
    toast.style.padding = '10px 14px';
    toast.style.borderRadius = '12px';
    toast.style.border = '1px solid var(--border-color, rgba(255, 255, 255, 0.16))';
    toast.style.background = 'var(--bg-card, rgba(22, 26, 31, 0.95))';
    toast.style.color = 'var(--text-primary, #fff)';
    toast.style.fontWeight = '600';
    toast.style.fontSize = '14px';
    toast.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.35)';
    toast.style.backdropFilter = 'blur(6px)';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'opacity 180ms ease, transform 180ms ease';

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      window.setTimeout(() => toast.remove(), 220);
    }, 2600);
  }

  function flushQueuedToasts() {
    const queue = getToastQueue();
    if (!queue.length) return;
    setToastQueue([]);
    queue.forEach((item) => {
      if (item && item.message) showToast(item.message);
    });
  }

  // Lazy-load CreditsManager helpers for pages that don't include them.
  let creditsManagerLoadPromise = null;
  function ensureCreditsManagerLoaded() {
    if (window.CreditsManager) return Promise.resolve(true);
    if (creditsManagerLoadPromise) return creditsManagerLoadPromise;

    creditsManagerLoadPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-sm-credits-manager]');
      if (existing) {
        existing.addEventListener('load', () => resolve(!!window.CreditsManager), { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = '/assets/js/ui.js';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-sm-credits-manager', 'true');
      script.onload = () => resolve(!!window.CreditsManager);
      script.onerror = () => {
        resolve(false);
      };

      document.head.appendChild(script);
    });

    return creditsManagerLoadPromise;
  }

  function getReportUrl() {
    const candidateInputIds = [
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

    // Fallback: first URL-like input on the page
    const anyInput = document.querySelector('input[type="url"], input[name="url"], input[id*="url" i]');
    const fromAnyInput = anyInput && typeof anyInput.value === 'string' ? anyInput.value.trim() : '';
    if (fromAnyInput) return fromAnyInput;

    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('url');
    return fromQuery ? fromQuery.trim() : '';
  }

  function getAnalyzerKey() {
    return (
      document.body.getAttribute('data-sm-analyzer-key') ||
      document.body.getAttribute('data-analyzer-key') ||
      window.SM_ANALYZER_KEY ||
      ''
    );
  }

  function getScanStartedAt() {
    return (
      document.body.getAttribute('data-sm-scan-started-at') ||
      window.SM_SCAN_STARTED_AT ||
      ''
    );
  }

  const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
  const FNV_PRIME_64 = 0x100000001b3n;
  const FNV_MOD_64 = 0xffffffffffffffffn;

  function fnv1a64(input) {
    let hash = FNV_OFFSET_BASIS_64;
    const str = String(input || '');
    for (let i = 0; i < str.length; i += 1) {
      hash ^= BigInt(str.charCodeAt(i));
      hash = (hash * FNV_PRIME_64) & FNV_MOD_64;
    }
    return hash;
  }

  function roundTimestampToMinute(startedAtISO) {
    const raw = (startedAtISO || '').trim();
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    d.setSeconds(0, 0);
    return d.toISOString();
  }

  function normalizeUrlForReportId(inputUrl) {
    const raw = (inputUrl || '').trim();
    if (!raw) return '';

    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
      const u = new URL(withProto);
      const protocol = (u.protocol || 'https:').toLowerCase();
      const hostname = (u.hostname || '').toLowerCase();
      if (!hostname) return '';

      const port = u.port ? `:${u.port}` : '';
      let path = u.pathname || '';
      if (path === '/') path = '';
      else path = path.replace(/\/$/, '');

      const search = u.search || '';
      return `${protocol}//${hostname}${port}${path}${search}`;
    } catch (e) {
      return raw.replace(/\/$/, '');
    }
  }

  function makeReportId({ analyzerKey, normalizedUrl, startedAtISO }) {
    const key = (analyzerKey || '').trim();
    const url = normalizeUrlForReportId(normalizedUrl);
    const ts = roundTimestampToMinute(startedAtISO);
    if (!key || !url || !ts) return '';

    const raw = `${key}|${url}|${ts}`;
    const hex = fnv1a64(raw).toString(16).padStart(16, '0');
    return `r_${hex}`;
  }

  // Backward-compat alias
  function computeReportId(url, startedAt, analyzerKey) {
    return makeReportId({ analyzerKey, normalizedUrl: url, startedAtISO: startedAt });
  }

  function setCurrentReportId(reportId) {
    if (!reportId) return;
    document.body.setAttribute('data-report-id', reportId);
    const resultsContent = document.getElementById('resultsContent');
    if (resultsContent) {
      resultsContent.setAttribute('data-sm-report-id', reportId);
    }
  }

  function getCurrentReportId() {
    return document.body.getAttribute('data-report-id') || '';
  }

  function revealProOnlyContent() {
    // Unwrap overlays used by locked accordions
    const overlays = document.querySelectorAll('.report-shell__lock-overlay');
    overlays.forEach((overlay) => {
      const locked = overlay.querySelector('.is-locked');
      if (!locked) return;

      const fragment = document.createDocumentFragment();
      while (locked.firstChild) {
        fragment.appendChild(locked.firstChild);
      }
      overlay.replaceWith(fragment);
    });

    // Remove any code overlays if present
    document.querySelectorAll('.pro-code-overlay').forEach((el) => el.remove());
  }

  function getResultsRoot(resultsContent) {
    if (!resultsContent) return null;
    const scope = resultsContent.querySelector('.report-scope');
    return scope || resultsContent;
  }

  function ensurePageScreenshotCard(reportId) {
    if (!reportId) return;
    const resultsContent = document.getElementById('resultsContent');
    if (!resultsContent) return;

    const root = getResultsRoot(resultsContent);
    if (!root) return;
    const existingCard = root.querySelector('[data-sm-page-screenshot-card]');
    const headerEl = root.querySelector('.report-header');
    const firstNonScreenshotChild = Array.from(root.children || []).find(
      (el) => el && el.nodeType === 1 && !el.hasAttribute('data-sm-page-screenshot-card')
    );
    const preferredAnchor = headerEl || firstNonScreenshotChild;

    const encodedId = encodeURIComponent(reportId);
    let screenshotUrl = (
      document.body.getAttribute('data-sm-screenshot-url') ||
      `/reports/${encodedId}/screenshot.jpg`
    );
    
    // Add cache-busting parameter to ensure fresh screenshots
    const cacheBuster = `?t=${Date.now()}`;
    if (!screenshotUrl.includes('?')) {
      screenshotUrl += cacheBuster;
    }

    // If the screenshot card already exists, update its URL and reposition if needed
    if (existingCard) {
      // Update the screenshot URL in existing card
      const img = existingCard.querySelector('.report-shell__screenshot');
      const link = existingCard.querySelector('.report-shell__screenshot-link');
      const badge = existingCard.querySelector('.report-shell__badge');
      if (img && img.src !== screenshotUrl) {
        img.src = screenshotUrl;
      }
      if (link && link.href !== screenshotUrl) {
        link.href = screenshotUrl;
      }
      if (badge && badge.href !== screenshotUrl) {
        badge.href = screenshotUrl;
      }
      // Reposition if needed
      if (preferredAnchor && existingCard.compareDocumentPosition(preferredAnchor) & Node.DOCUMENT_POSITION_FOLLOWING) {
        preferredAnchor.insertAdjacentElement('afterend', existingCard);
      }
      return;
    }

    const shell = document.createElement('div');
    shell.className = 'report-shell';
    shell.setAttribute('data-sm-page-screenshot-card', 'true');
    shell.innerHTML = `
      <div class="report-shell__header">
        <div class="report-shell__title">Page Screenshot</div>
        <a class="report-shell__badge" href="${screenshotUrl}" target="_blank" rel="noopener">Open full size</a>
      </div>
      <div class="report-shell__card" data-screenshot-gallery>
        <a class="report-shell__screenshot-link" href="${screenshotUrl}" target="_blank" rel="noopener">
          <img class="report-shell__screenshot" src="${screenshotUrl}" alt="Page screenshot" data-screenshot="0" loading="lazy" />
        </a>
      </div>
    `;

    // Prefer inserting the screenshot after the report header so the report always starts with the heading/meta.
    if (preferredAnchor) {
      preferredAnchor.insertAdjacentElement('afterend', shell);
      return;
    }

    // Last resort: if we truly can't find any anchor, prepend.
    if (root.firstChild) root.insertBefore(shell, root.firstChild);
    else root.appendChild(shell);
  }

  // Track scan cycles: when results are cleared, the next render should generate a new reportId.
  let waitingForResults = true;

  async function ensureReportIdOnceResultsExist() {
    const resultsContent = document.getElementById('resultsContent');
    if (!resultsContent) return;

    // Results exist once there's real DOM inside
    const hasResults = resultsContent.children.length > 0 || (resultsContent.textContent || '').trim().length > 0;
    if (!hasResults) {
      // Treat an empty results container as "between scans" so the next render gets a new reportId.
      waitingForResults = true;
      resultsContent.removeAttribute('data-sm-report-id');
      return;
    }

    // If results exist but we aren't in a new scan cycle, don't churn reportId.
    if (!waitingForResults) return;

    let reportId = getCurrentReportId();
    const alreadyTagged = resultsContent.getAttribute('data-sm-report-id');
    if (!reportId || alreadyTagged !== reportId) {
      const url = getReportUrl();
      const startedAt = getScanStartedAt();
      const analyzerKey = getAnalyzerKey();
      const computed = computeReportId(url, startedAt, analyzerKey);
      if (computed) {
        reportId = reportId || computed;
        setCurrentReportId(reportId);
      }
    }

    // Only finalize the scan cycle once we have a deterministic reportId.
    reportId = getCurrentReportId();
    if (!reportId) return;

    ensurePageScreenshotCard(reportId);

    waitingForResults = false;

    await ensureCreditsManagerLoaded();
    if (window.CreditsManager) {
      const render = window.CreditsManager.renderPaywallState || window.CreditsManager.updateProUI;
      if (typeof render === 'function') render(reportId);

      const isUnlocked =
        (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) ||
        (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId));

      if (isUnlocked) {
        revealProOnlyContent();
      }
    }
  }

  async function startSingleReportCheckout(reportId) {
    // returnUrl must be an absolute URL on an allowed domain
    const params = new URLSearchParams(window.location.search);
    params.delete('session_id');
    params.delete('sessionId');
    params.delete('canceled');
    params.set('reportId', reportId);
    const returnUrl = `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch('/api/billing/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchaseType: 'single_report',
        packId: null,
        reportId,
        returnUrl
      })
    });

    const data = await response.json().catch(() => null);
    if (response.ok && data && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }
    showToast('Checkout is unavailable right now.');
  }

  async function handleBillingReturnIfPresent() {
    let sessionId = '';
    try {
      const params = new URLSearchParams(window.location.search);
      sessionId = params.get('session_id') || params.get('sessionId') || '';
    } catch (e) {
      sessionId = '';
    }

    if (!sessionId) return;

    await ensureCreditsManagerLoaded();
    if (!window.CreditsManager) return;

    // Dedupe refreshes
    if (typeof window.CreditsManager.hasPurchaseReceipt === 'function' && window.CreditsManager.hasPurchaseReceipt(sessionId)) {
      return;
    }

    const verifyResp = await fetch(`/api/billing/verify-session?session_id=${encodeURIComponent(sessionId)}`);
    const verification = await verifyResp.json().catch(() => null);
    if (!verifyResp.ok || !verification || verification.paid !== true) {
      return;
    }

    if (verification.purchaseType === 'credit_pack') {
      const creditsAdded = parseInt(verification.creditsAdded || 0, 10) || 0;
      if (creditsAdded > 0) {
        window.CreditsManager.addCredits(creditsAdded);
        showToast(`${creditsAdded} credits added.`);
      }
    }

    if (verification.purchaseType === 'single_report') {
      const rid = verification.reportId || getCurrentReportId();
      if (rid) {
        window.CreditsManager.unlockReport(rid, 'single');
        const render = window.CreditsManager.renderPaywallState || window.CreditsManager.updateProUI;
        if (typeof render === 'function') render(rid);
        revealProOnlyContent();
        showToast('Report unlocked.');
      }
    }

    if (typeof window.CreditsManager.addPurchaseReceipt === 'function') {
      window.CreditsManager.addPurchaseReceipt(sessionId);
    }

    // Remove session_id from URL
    try {
      const params = new URLSearchParams(window.location.search);
      params.delete('session_id');
      params.delete('sessionId');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, document.title, newUrl);
    } catch (e) {
      // ignore
    }
  }


  // If reportId is provided in the URL, set it early so updateProUI()
  // and unlock checks reference the same reportId across redirects.
  try {
    const params = new URLSearchParams(window.location.search);
    const reportIdFromQuery = params.get('reportId');
    if (reportIdFromQuery) setCurrentReportId(reportIdFromQuery);
  } catch (e) {
    // ignore
  }

  /**
   * Check if new Report UI is enabled
   */
  function isEnabled() {
    return localStorage.getItem(FEATURE_FLAG_KEY) === 'true';
  }

  /**
   * Enable new Report UI (for testing)
   */
  function enable() {
    localStorage.setItem(FEATURE_FLAG_KEY, 'true');
  }

  /**
   * Disable new Report UI (rollback)
   */
  function disable() {
    localStorage.removeItem(FEATURE_FLAG_KEY);
  }

  /**
   * Global event delegation for common UI patterns
   */
  function initGlobalEventDelegation() {
    if (window.__reportUIInitialized) return;
    window.__reportUIInitialized = true;

    document.addEventListener('click', async (e) => {
      // Screenshot thumbnails
      const screenshot = e.target.closest('[data-screenshot]');
      if (screenshot && window.ScreenshotLightbox) {
        e.preventDefault();
        const index = parseInt(screenshot.dataset.screenshot, 10);
        const container = screenshot.closest('[data-screenshot-gallery]');
        if (container) {
          const images = Array.from(container.querySelectorAll('[data-screenshot]'));
          window.ScreenshotLightbox.open(index, images);
        }
      }

      // Unlock with credit button
      const unlockWithCredit = e.target.closest('[data-unlock-with-credit]');
      if (unlockWithCredit) {
        e.preventDefault();
        if (!window.CreditsManager) {
          await ensureCreditsManagerLoaded();
        }
        let reportId = unlockWithCredit.dataset.reportId ||
                        document.body.getAttribute('data-report-id');

        if (!reportId) {
          const computed = computeReportId(getReportUrl(), getScanStartedAt(), getAnalyzerKey());
          if (computed) {
            reportId = computed;
            setCurrentReportId(reportId);
          }
        }

        if (!reportId) {
          showToast('Run a scan first to unlock this report.');
          return;
        }

        // Use CreditsManager if available, otherwise fallback to ProReportBlock
        const manager = window.CreditsManager || window.ProReportBlock;

        if (manager) {
          const hasCredits = window.CreditsManager ?
                            window.CreditsManager.getCredits() >= 1 :
                            window.ProReportBlock.getCredits() >= 1;

          if (hasCredits) {
            // Consume credit and unlock report
            if (window.CreditsManager) {
              try {
                window.CreditsManager.consumeCredit();
              } catch (err) {
                showToast('No credits available.');
                return;
              }
              if (reportId) {
                window.CreditsManager.unlockReport(reportId, 'credit');
                const render = window.CreditsManager.renderPaywallState || window.CreditsManager.updateProUI;
                if (typeof render === 'function') render(reportId);
                revealProOnlyContent();
                showToast('1 credit used — report unlocked');
              }
            } else if (window.ProReportBlock) {
              window.ProReportBlock.useCredit(reportId);
              revealProOnlyContent();
              showToast('1 credit used — report unlocked');
            }
          } else if (window.PricingModal) {
            window.PricingModal.open();
          }
        }
      }

      // Buy single report button
      const buySingleReport = e.target.closest('[data-buy-single-report]');
      if (buySingleReport) {
        e.preventDefault();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        if (!window.CreditsManager) {
          await ensureCreditsManagerLoaded();
        }
        let reportId = buySingleReport.dataset.reportId ||
                        document.body.getAttribute('data-report-id');

        if (!reportId) {
          const computed = computeReportId(getReportUrl(), getScanStartedAt(), getAnalyzerKey());
          if (computed) {
            reportId = computed;
            setCurrentReportId(reportId);
          }
        }

        if (!reportId) {
          showToast('Run a scan first to buy this report.');
          return;
        }

        if (window.PricingModal && typeof window.PricingModal.openSingleReport === 'function') {
          window.PricingModal.openSingleReport({ reportId });
          return;
        }

        await startSingleReportCheckout(reportId);
        return;
      }

      // Open pricing modal button
      const openPricingModal = e.target.closest('[data-open-pricing-modal]');
      if (openPricingModal) {
        e.preventDefault();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        if (window.PricingModal && typeof window.PricingModal.open === 'function') window.PricingModal.open();
        return;
      }

      // Pro unlock buttons (legacy)
      const proUnlock = e.target.closest('[data-pro-unlock]');
      if (proUnlock) {
        e.preventDefault();
        const context = proUnlock.dataset.context || 'feature';
        const domain = window.location.hostname;

        if (typeof window.openProPaywall === 'function') {
          window.openProPaywall({ domain, context });
        } else if (typeof window.ProGate !== 'undefined' && window.ProGate.showUpgradePrompt) {
          window.ProGate.showUpgradePrompt({ context });
        } else {
          alert('Unlock Report ($10 USD)');
        }
      }

      // Export buttons
      const exportBtn = e.target.closest('[data-export]');
      if (exportBtn) {
        e.preventDefault();
        const format = exportBtn.dataset.export;
        const handler = exportBtn.dataset.handler;

        // Call the export handler if it exists
        if (handler && typeof window[handler] === 'function') {
          window[handler](format, exportBtn);
        } else {
          // Fallback: common handlers
          if (format === 'pdf' && typeof window.exportPDF === 'function') {
            window.exportPDF(format, exportBtn);
          }
        }
      }

      // Modal close buttons
      const modalClose = e.target.closest('[data-modal-close]');
      if (modalClose && window.Modal) {
        const modalId = modalClose.dataset.modalClose;
        window.Modal.close(modalId);
      }

      // Modal overlay (close on click outside)
      if (e.target.classList.contains('modal-overlay') && window.Modal) {
        const modalId = e.target.dataset.modalId;
        if (modalId) {
          window.Modal.close(modalId);
        }
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // ESC closes modals
      if (e.key === 'Escape') {
        if (window.Modal && window.Modal.closeTopmost) {
          window.Modal.closeTopmost();
        }
        if (window.ScreenshotLightbox && window.ScreenshotLightbox.isOpen()) {
          window.ScreenshotLightbox.close();
        }
      }

      // Arrow keys for screenshot navigation
      if (window.ScreenshotLightbox && window.ScreenshotLightbox.isOpen()) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          window.ScreenshotLightbox.navigate('prev');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          window.ScreenshotLightbox.navigate('next');
        }
      }
    });
  }

  /**
   * Initialize Report UI system
   * Call this once per page load
   */
  function init() {
    // If we're returning from Stripe, apply entitlements/credits first.
    handleBillingReturnIfPresent().catch(() => undefined);

    initGlobalEventDelegation();

    flushQueuedToasts();

    // Compute reportId once results render, then update Pro UI.
    const resultsContent = document.getElementById('resultsContent');
    if (resultsContent && !window.__smReportObserver) {
      window.__smReportObserver = new MutationObserver(() => {
        ensureReportIdOnceResultsExist();
      });
      window.__smReportObserver.observe(resultsContent, { childList: true, subtree: true });
    }

    ensureReportIdOnceResultsExist();

    // Preload credits helpers so Pro blocks can render correctly.
    ensureCreditsManagerLoaded().then((loaded) => {
      if (!loaded || !window.CreditsManager) return;
      const currentReportId = document.body.getAttribute('data-report-id');
      if (currentReportId) {
        const render = window.CreditsManager.renderPaywallState || window.CreditsManager.updateProUI;
        if (typeof render === 'function') render(currentReportId);
      }
    });

    // Initialize ReportAccordion if available
    if (window.ReportAccordion && window.ReportAccordion.initInteractions) {
      window.ReportAccordion.initInteractions();
    }
  }

  function detectExportContentSelector() {
    const candidates = [
      '.report-shell',
      '#resultsContent',
      '#results',
      '.results-container',
      'main'
    ];
    for (const selector of candidates) {
      try {
        if (document.querySelector(selector)) return selector;
      } catch (e) {
        // ignore invalid selectors
      }
    }
    return 'main';
  }

  function detectReportSubtitle() {
    const badge = document.querySelector('.report-header__badge');
    if (badge && badge.textContent && badge.textContent.trim()) return badge.textContent.trim();

    const pageAttr = document.body.getAttribute('data-page');
    if (pageAttr) {
      const pretty = pageAttr.replace(/[-_]+/g, ' ').trim();
      return pretty ? `${pretty.charAt(0).toUpperCase()}${pretty.slice(1)} Report` : 'Web Analysis Report';
    }

    return 'Web Analysis Report';
  }

  async function exportPdfFromCurrentReport(buttonEl) {
    if (typeof window.PDFExportUtility === 'undefined') {
      alert('PDF export is not available on this page.');
      return;
    }

    const selector = detectExportContentSelector();
    const urlInput = document.querySelector('input[type="url"], #urlInput, #seoUrlInput, #securityUrlInput, #accessibilityUrlInput');
    const url = (urlInput && urlInput.value) || (window.ScanContext && window.ScanContext.get && (window.ScanContext.get() || {}).url) || window.location.href;

    const today = new Date().toISOString().split('T')[0];
    const exporter = new window.PDFExportUtility({
      filename: `site-mechanic-report-${today}.pdf`,
      reportTitle: 'Site Mechanic',
      reportSubtitle: detectReportSubtitle(),
      url,
      scale: 2,
      pageFormat: 'a4'
    });

    await exporter.export(selector, buttonEl || null);
  }

  // Export handlers used by ProReportBlock buttons.
  if (typeof window.exportPDF !== 'function') {
    window.exportPDF = function exportPDF(_format, buttonEl) {
      return exportPdfFromCurrentReport(buttonEl);
    };
  }

  if (typeof window.shareResults !== 'function') {
    window.shareResults = function shareResults() {
      if (typeof window.copyShareLink === 'function') return window.copyShareLink();
      if (window.ExportGate && typeof window.ExportGate.showPaywall === 'function' && !window.ExportGate.isPro()) {
        window.ExportGate.showPaywall();
        return;
      }
      alert('Share link is not available on this page.');
    };
  }

  if (typeof window.exportCSV !== 'function') {
    window.exportCSV = function exportCSV() {
      alert('CSV export is not available yet.');
    };
  }

  if (typeof window.exportJSON !== 'function') {
    window.exportJSON = function exportJSON() {
      alert('JSON export is not available yet.');
    };
  }

  // Auto-initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.ReportUI = {
    // Feature flags
    isEnabled,
    enable,
    disable,

    // Billing return
    handleBillingReturnIfPresent,

    // Initialization
    init,

    // Deterministic report identity helpers
    makeReportId,
    computeReportId,
    getCurrentReportId,
    setCurrentReportId,

    // Accordion management (delegates to ReportAccordion)
    accordions: {
      init: () => window.ReportAccordion?.initInteractions(),
      create: (opts) => window.ReportAccordion?.createSection(opts)
    },

    // Modal system (delegates to Modal)
    modal: {
      open: (modalId, options) => window.Modal?.open(modalId, options),
      close: (modalId) => window.Modal?.close(modalId),
      create: (options) => window.Modal?.create(options)
    },

    // Screenshot lightbox (delegates to ScreenshotLightbox)
    screenshots: {
      init: (selector) => window.ScreenshotLightbox?.init(selector),
      open: (index, images) => window.ScreenshotLightbox?.open(index, images),
      close: () => window.ScreenshotLightbox?.close()
    },

    // Pro gating helpers (delegates to ProGate)
    pro: {
      showPaywall: (opts) => {
        if (typeof window.openProPaywall === 'function') {
          return window.openProPaywall(opts);
        } else if (window.ProGate?.showUpgradePrompt) {
          return window.ProGate.showUpgradePrompt(opts);
        }
      },
      isPro: () => window.ProGate?.isPro() || false,
      lockContent: (contentHTML, context) => {
        const credits = window.CreditsManager?.getCredits ? window.CreditsManager.getCredits() : 0;
        const card = window.PaidUnlockCard?.render
          ? window.PaidUnlockCard.render({ context: context || 'feature', reportId: getCurrentReportId(), credits })
          : `
              <div class="report-shell__lock-overlay">
                <div class="is-locked">${contentHTML}</div>
                <button class="report-shell__lock-cta" data-pro-unlock data-context="${context || 'feature'}">
                  Unlock Report ($10 USD)
                </button>
              </div>
            `;
        return `
          <div class="report-shell__lock-overlay">
            <div class="is-locked">${contentHTML}</div>
            <div data-paid-unlock-card>${card}</div>
          </div>
        `;
      }
    }
  };

  // Expose toast helpers for other pages (e.g. billing success redirect)
  window.ReportUI.toast = showToast;
  window.ReportUI.enqueueToast = enqueueToast;

  // Expose feature flag helpers globally for easy testing
  window.enableReportUI = enable;
  window.disableReportUI = disable;

})(window);
