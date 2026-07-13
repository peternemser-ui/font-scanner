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
  // Translation helper
  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const translated = window.i18n.t(key);
      if (translated !== key) return translated;
    }
    return fallback;
  }

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

  function showPaymentSuccessBanner(purchaseType) {
    // Remove any existing banner
    const existing = document.getElementById('sm-payment-success-banner');
    if (existing) existing.remove();

    const isSubscription = purchaseType === 'subscription';
    const title = isSubscription
      ? t('billingPages.success.proSubscriptionActivated', 'Pro Subscription Activated!')
      : t('billingPages.success.reportUnlocked', 'Report Unlocked!');

    const banner = document.createElement('div');
    banner.id = 'sm-payment-success-banner';
    banner.innerHTML = `
      <div id="sm-payment-success-inner" style="
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 16px 32px 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(16, 185, 129, 0.4);
        max-width: 500px;
        text-align: center;
        animation: slideDown 0.3s ease-out;
      ">
        <style>
          @keyframes slideDown {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
        </style>
        <div style="display: flex; align-items: center; gap: 12px; justify-content: center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <strong style="font-size: 18px;">${title}</strong>
        </div>
        <button id="sm-payment-close-btn" style="
          margin-left: 16px;
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 16px;
          line-height: 1;
        " aria-label="Close">&times;</button>
      </div>
    `;
    document.body.appendChild(banner);

    // Add close button handler
    const closeBtn = document.getElementById('sm-payment-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        banner.remove();
      });
    }

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (banner.parentElement) {
        banner.style.opacity = '0';
        banner.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => banner.remove(), 300);
      }
    }, 10000);
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

      // Strip default ports (80 for http, 443 for https)
      let port = '';
      if (u.port) {
        const isDefaultPort = (protocol === 'https:' && u.port === '443') ||
                              (protocol === 'http:' && u.port === '80');
        if (!isDefaultPort) {
          port = `:${u.port}`;
        }
      }

      let path = u.pathname || '';
      if (path === '/') path = '';
      else path = path.replace(/\/$/, '');

      // Sort query parameters for consistent ordering
      let search = '';
      if (u.search) {
        const params = new URLSearchParams(u.search);
        const sorted = new URLSearchParams([...params.entries()].sort());
        const sortedSearch = sorted.toString();
        if (sortedSearch) {
          search = '?' + sortedSearch;
        }
      }
      return `${protocol}//${hostname}${port}${path}${search}`;
    } catch (e) {
      return raw.replace(/\/$/, '');
    }
  }

  /**
   * Simple hash for storage keys (not cryptographic).
   * Returns a short alphanumeric string suitable for localStorage/sessionStorage keys.
   */
  function hashForStorageKey(str) {
    let hash = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
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
    // Unwrap overlays used by locked accordions (ReportContainer pattern)
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

    // Remove locked overlays used by ProReportBlock and accordion sections
    document.querySelectorAll('[data-locked-overlay]').forEach((overlay) => {
      const body = overlay.closest('.report-accordion__body');
      const content = body?.querySelector('.report-accordion__content-actual');
      if (content) {
        content.hidden = false;
      }
      overlay.remove();
    });

    // Remove locked state from Pro Report Blocks (show accent border after unlock)
    document.querySelectorAll('.pro-report-block--locked, .pro-report-block[data-locked]').forEach((block) => {
      block.classList.remove('pro-report-block--locked');
      block.removeAttribute('data-locked');
    });

    // Re-render pro sections in createAccordionSection pattern
    // These sections use .pro-locked within .accordion-content-inner
    document.querySelectorAll('.pro-section .pro-locked').forEach((lockedEl) => {
      const contentInner = lockedEl.closest('.accordion-content-inner');
      if (contentInner) {
        // Dispatch event so the accordion re-renders with unlocked content
        contentInner.dispatchEvent(new CustomEvent('pro:unlocked'));
      }
    });
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

    // Skip if ReportContainer already rendered a screenshot section
    const reportContainerScreenshot = root.querySelector('.screenshot-section');
    if (reportContainerScreenshot) {
      return; // Don't add duplicate screenshot card
    }

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
        <div class="report-shell__title">${t('reports.common.pageScreenshot', 'Page Screenshot')}</div>
        <a class="report-shell__badge" href="${screenshotUrl}" target="_blank" rel="noopener">${t('reports.common.openFullSize', 'Open full size')}</a>
      </div>
      <div class="report-shell__card" data-screenshot-gallery>
        <a class="report-shell__screenshot-link" href="${screenshotUrl}" target="_blank" rel="noopener">
          <img class="report-shell__screenshot" src="${screenshotUrl}" alt="${t('reports.common.pageScreenshot', 'Page Screenshot')}" data-screenshot="0" loading="lazy" />
        </a>
      </div>
    `;

    // Add retry logic for screenshot loading failures
    const img = shell.querySelector('.report-shell__screenshot');
    if (img) {
      let retryCount = 0;
      const maxRetries = 5;
      const retryDelay = 2000; // 2 seconds between retries

      img.onerror = function() {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`[ReportUI] Screenshot load failed, retry ${retryCount}/${maxRetries} in ${retryDelay}ms`);
          setTimeout(() => {
            // Add new cache buster for retry
            const retryUrl = screenshotUrl.split('?')[0] + `?t=${Date.now()}`;
            img.src = retryUrl;
          }, retryDelay);
        } else {
          console.warn('[ReportUI] Screenshot failed to load after all retries');
          // Show placeholder message
          const link = shell.querySelector('.report-shell__screenshot-link');
          if (link) {
            link.innerHTML = `
              <div style="padding: 3rem; text-align: center; color: var(--color-text-muted, #6b7280);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📷</div>
                <div>This site blocks automated screenshots</div>
              </div>
            `;
          }
        }
      };
    }

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

  /**
   * Reset the waiting state - call this at the start of a new scan.
   * This ensures the screenshot card will be created for the new results.
   */
  function resetWaitingState() {
    waitingForResults = true;
    console.log('[ReportUI] Reset waiting state for new scan');
  }

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

    // Check if user has access via new billing model
    if (window.ProReportBlock?.hasAccess?.(reportId)) {
      revealProOnlyContent();
    }
  }

  async function startSingleReportCheckout(reportId) {
    // Build return URL for Stripe redirect
    const params = new URLSearchParams(window.location.search);
    params.delete('session_id');
    params.delete('sessionId');
    params.delete('canceled');
    params.set('reportId', reportId);
    const returnUrl = `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;

    // Get auth token for authenticated checkout (check both key names)
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        purchaseType: 'single_report',
        reportId,
        returnUrl
      })
    });

    const data = await response.json().catch(() => null);
    if (response.ok && data && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }

    // Handle auth requirement - but only for genuine auth failures, not Stripe errors
    if (response.status === 401) {
      const msg = (data?.message || data?.error || '').toLowerCase();
      const isPaymentError = msg.includes('stripe') || msg.includes('api key') || msg.includes('payment service');

      if (isPaymentError) {
        showToast('Payment service error. Please try again later.');
        return;
      }

      // Genuine auth failure — save purchase intent, clear stale tokens, redirect to auth
      try {
        localStorage.setItem('sm_pending_purchase', JSON.stringify({
          type: 'single_report',
          reportId: reportId || null,
          returnPath: window.location.pathname + window.location.search,
          createdAt: Date.now()
        }));
      } catch (e) { /* continue with redirect */ }

      localStorage.removeItem('sm_auth_token');
      localStorage.removeItem('sm_token');

      // Ensure report_id is in the returnTo URL
      const params = new URLSearchParams(window.location.search);
      if (reportId && !params.has('report_id')) params.set('report_id', reportId);
      const returnTo = encodeURIComponent(window.location.pathname + (params.toString() ? '?' + params.toString() : ''));
      window.location.href = `/auth.html?returnTo=${returnTo}&mode=signup`;
      return;
    }

    showToast('Checkout is unavailable right now.');
  }

  /**
   * Check for a pending purchase intent saved before an auth redirect.
   * If found, wait for the report to render and auto-open the PricingModal.
   */
  function handlePendingPurchaseIfPresent() {
    // Only run if user is now logged in
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    if (!token) return;

    let intent;
    try {
      const raw = localStorage.getItem('sm_pending_purchase');
      if (!raw) return;
      intent = JSON.parse(raw);
    } catch (e) {
      localStorage.removeItem('sm_pending_purchase');
      return;
    }

    // 30-minute TTL
    const THIRTY_MINUTES = 30 * 60 * 1000;
    if (!intent.createdAt || (Date.now() - intent.createdAt) > THIRTY_MINUTES) {
      localStorage.removeItem('sm_pending_purchase');
      return;
    }

    // Verify we're on the matching page
    const currentPath = window.location.pathname;
    const intentPath = (intent.returnPath || '').split('?')[0];
    if (intentPath && currentPath !== intentPath) return;

    // Consume the intent
    localStorage.removeItem('sm_pending_purchase');
    console.log('[ReportUI] Resuming pending purchase after auth:', intent);

    // Poll for report content, then open pricing modal
    let attempts = 0;
    const maxAttempts = 15; // 15 * 200ms = 3 seconds
    const checkAndOpen = () => {
      attempts++;
      const resultsContent = document.getElementById('resultsContent');
      const hasResults = resultsContent && resultsContent.children.length > 0;

      if (hasResults || attempts >= maxAttempts) {
        setTimeout(() => {
          if (window.PricingModal && typeof window.PricingModal.open === 'function') {
            window.PricingModal.open();
          }
        }, 300);
      } else {
        setTimeout(checkAndOpen, 200);
      }
    };
    setTimeout(checkAndOpen, 200);
  }

  // Flag to indicate billing return is being processed
  // Other scripts should wait for this before displaying reports
  let billingReturnInProgress = false;
  const billingReturnPromise = null;

  async function handleBillingReturnIfPresent() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || params.get('sessionId') || '';
    const billingSuccess = params.get('billing_success') === 'true';
    // Get report_id from URL first, fall back to sessionStorage (saved before checkout)
    const reportIdFromUrl = params.get('report_id') || params.get('reportId') || '';
    const reportIdFromStorage = sessionStorage.getItem('sm_checkout_report_id') || '';
    const reportId = reportIdFromUrl || reportIdFromStorage;

    // Debug: Log billing return state
    console.log('[BillingReturn] URL params:', {
      fullUrl: window.location.href,
      sessionId,
      billingSuccess,
      reportIdFromUrl,
      reportIdFromStorage,
      finalReportId: reportId,
      allParams: Object.fromEntries(params.entries())
    });

    // CRITICAL: Set the report_id as the current report ID IMMEDIATELY
    // This ensures that when results are rendered, they use the purchased reportId
    // instead of computing a new one based on current time
    if (reportId) {
      setCurrentReportId(reportId);
      // Also add it to URL params if not already there (for analyzer scripts to pick up)
      if (!reportIdFromUrl && reportId) {
        params.set('report_id', reportId);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, document.title, newUrl);
      }
      console.log('[BillingReturn] Set current report ID:', reportId);
    }

    // Handle new billing_success flow FIRST (from /api/billing/checkout)
    // This takes priority over legacy session_id flow
    if (billingSuccess) {
      // Signal that billing return is being processed
      billingReturnInProgress = true;
      window.__smBillingReturnInProgress = true;
      const checkoutSessionId = params.get('session_id') || '';

      // Dedupe using sessionStorage (include session_id to avoid re-processing same session)
      const receiptKey = `sm_billing_success_${checkoutSessionId || reportId || 'subscription'}`;
      if (sessionStorage.getItem(receiptKey)) {
        // Already processed - set verified flag, reveal content, clean URL, and signal completion
        if (reportId) {
          window.__smVerifiedPurchaseReportId = reportId;
          // Ensure localStorage purchase proof exists (may not if page reloaded before first processing)
          try {
            if (!localStorage.getItem('sm_purchased_' + reportId)) {
              localStorage.setItem('sm_purchased_' + reportId, JSON.stringify({ ts: Date.now(), sid: '' }));
            }
          } catch (e) { /* ignore */ }
        }
        revealProOnlyContent();
        params.delete('billing_success');
        params.delete('billing_canceled');
        params.delete('session_id');
        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.replaceState({}, document.title, newUrl);
        // CRITICAL: Signal billing return complete even on dedup so analyzer scripts
        // don't hang waiting for the event (e.g., security-script waits up to 5 seconds)
        billingReturnInProgress = false;
        window.__smBillingReturnInProgress = false;
        window.__smBillingReturnComplete = true;
        window.dispatchEvent(new CustomEvent('sm:billingReturnComplete', {
          detail: { reportId, billingStatus: null }
        }));
        return;
      }

      // If we have a session_id, verify and record the purchase first
      // This is essential for local dev where webhooks don't fire
      if (checkoutSessionId) {
        const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token') || '';
        if (token) {
          try {
            const verifyResp = await fetch('/api/billing/verify-purchase', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ session_id: checkoutSessionId })
            });
            const verifyResult = await verifyResp.json().catch(() => null);
            if (verifyResult?.success) {
              console.log('Purchase verified and recorded:', verifyResult);
              // CRITICAL: Set verified-purchase flag so hasAccess() grants access
              // immediately, bypassing all session marker / billing cache timing issues.
              // This flag is window-scoped (not persisted) and only set when the server
              // confirms the purchase was recorded.
              window.__smVerifiedPurchaseReportId = reportId;
              console.log('[BillingReturn] Set verified purchase flag for reportId:', reportId);
            } else {
              console.warn('Purchase verification result:', verifyResult);
            }
          } catch (e) {
            console.warn('Failed to verify purchase:', e);
          }
        }
      }

      // Also set verified flag for billing_success without session_id (subscription returns)
      // and as fallback when verify-purchase wasn't called
      if (!window.__smVerifiedPurchaseReportId && reportId) {
        window.__smVerifiedPurchaseReportId = reportId;
        console.log('[BillingReturn] Set verified purchase flag (billing_success) for reportId:', reportId);
      }

      // CRITICAL: Persist purchase proof in localStorage (survives page reloads, tab changes)
      // This is the MOST RELIABLE access check - it doesn't depend on billing cache timing,
      // window-scoped flags, session markers, or any event chain. It simply records that
      // billing_success=true was seen for this reportId. The 24-hour TTL matches ReportStorage.
      if (reportId) {
        try {
          localStorage.setItem('sm_purchased_' + reportId, JSON.stringify({
            ts: Date.now(),
            sid: params.get('session_id') || ''
          }));
          console.log('[BillingReturn] Stored purchase proof in localStorage for:', reportId);
        } catch (e) {
          console.warn('[BillingReturn] Could not store purchase proof:', e);
        }
      }

      // Clear billing cache and fetch fresh status BEFORE displaying results
      // This ensures ProReportBlock.hasAccess() returns true during render
      if (window.ProReportBlock?.clearBillingCache) {
        window.ProReportBlock.clearBillingCache();
      }

      // Fetch and cache billing status - MUST force refresh to pick up the
      // just-verified purchase. Without forceRefresh, this can return stale
      // cached data that doesn't include the new purchase.
      let billingStatus = null;
      if (window.ProReportBlock?.fetchBillingStatus) {
        billingStatus = await window.ProReportBlock.fetchBillingStatus(true);
      }

      // Debug: Log billing status to verify purchase is included
      console.log('[BillingReturn] Billing status after verification:', {
        plan: billingStatus?.plan,
        purchasedReports: billingStatus?.purchasedReports,
        reportId,
        hasAccess: reportId ? billingStatus?.purchasedReports?.includes(reportId) : false
      });

      // Verify purchase and show appropriate message
      if (billingStatus) {
        if (billingStatus.plan === 'pro') {
          showToast('Pro subscription activated! Unlocking premium content...');
        } else if (reportId && billingStatus.purchasedReports?.includes(reportId)) {
          showToast('Report unlocked!');
        } else if (reportId) {
          // Purchase may have been recorded but not yet in billing status
          // Still proceed with reveal since verifyAndRecordPurchase succeeded
          console.log('[BillingReturn] Report not in purchasedReports yet, but continuing with unlock');
          showToast('Report unlocked!');
        }
      }

      // CRITICAL: Set session marker and purchased reportId
      // This allows isReportTypePurchasedLocally() to grant access during same session
      sessionStorage.setItem('sm_payment_completed_session', Date.now().toString());
      // CRITICAL: Store the purchased reportId for reportId-based access verification
      if (reportId) {
        sessionStorage.setItem('sm_purchased_report_id', reportId);
        console.log('[BillingReturn] Stored purchased reportId in session:', reportId);
      }
      // Save checkout session ID for server-side fallback verification
      if (checkoutSessionId) {
        sessionStorage.setItem('sm_last_checkout_session_id', checkoutSessionId);
      }
      console.log('[BillingReturn] Set session payment marker', { checkoutSessionId, reportId });

      // NOTE: Removed URL-based localStorage purchase keys - these were causing security issues
      // by granting access to ALL scans of a URL if any one scan was purchased.
      // Now using reportId-based verification only (sm_purchased_report_id in sessionStorage).

      // Mark as processed
      sessionStorage.setItem(receiptKey, 'true');

      // Restore the URL that was being analyzed before checkout
      const cachedUrl = sessionStorage.getItem('sm_checkout_url');

      // Try new unique key format first, then fall back to legacy
      let cachedResults = null;
      let cachedData = null;
      const checkoutKey = sessionStorage.getItem('sm_checkout_key');
      if (checkoutKey) {
        const raw = sessionStorage.getItem(checkoutKey);
        if (raw) {
          try {
            cachedData = JSON.parse(raw);
            cachedResults = JSON.stringify(cachedData.results); // For compatibility
          } catch (e) {
            console.warn('[ReportUI] Could not parse cached checkout data:', e);
          }
        }
      }
      // Fall back to legacy key
      if (!cachedResults) {
        cachedResults = sessionStorage.getItem('sm_checkout_results');
      }

      // Prefer analyzer from cached data (more specific, e.g., 'speed-ux-quick')
      // Fall back to pathname-based key for legacy checkout data
      const cachedAnalyzer = cachedData?.analyzer || sessionStorage.getItem('sm_checkout_analyzer');
      console.log('[BillingReturn] Cached analyzer:', cachedAnalyzer, 'from', cachedData?.analyzer ? 'cachedData' : 'sessionStorage');

      if (cachedUrl) {
        // Try to auto-fill the URL input
        const urlInput = document.getElementById('urlInput') ||
                         document.querySelector('input[type="url"], input[name="url"], input[id*="url" i]');
        if (urlInput) {
          urlInput.value = cachedUrl;
        }
      }

      // Restore and display cached scan results
      // Now that billing cache is populated, hasAccess() will return true during render
      let displayedFromCache = false;
      let loadedFromStorage = false;
      if (cachedResults) {
        try {
          const results = cachedData?.results || JSON.parse(cachedResults);

          // IMPORTANT: Validate that cached data is not an error response
          // This prevents displaying stale "Route not found" or other errors
          if (results?.error || typeof results === 'string') {
            console.warn('[BillingReturn] Ignoring cached error data:', results?.error || results);
            // Clear the corrupted cache
            const checkoutKey = sessionStorage.getItem('sm_checkout_key');
            if (checkoutKey) sessionStorage.removeItem(checkoutKey);
            sessionStorage.removeItem('sm_checkout_key');
            sessionStorage.removeItem('sm_checkout_results');
            sessionStorage.removeItem('sm_checkout_analyzer');
            // Don't dispatch event with error data - let page load normally
            throw new Error('Cached data contains error, skipping restore');
          }

          // Dispatch event for analyzer-specific result restoration
          const restoreEvent = new CustomEvent('sm:restoreScanResults', {
            detail: { results, url: cachedUrl, analyzer: cachedAnalyzer }
          });
          window.dispatchEvent(restoreEvent);

          // Also try direct display functions
          if (window.displaySEOResults && cachedAnalyzer?.includes('seo')) {
            window.currentSeoResults = results;
            window.displaySEOResults(results);
            displayedFromCache = true;
          } else if (window.displaySecurityResults && cachedAnalyzer?.includes('security')) {
            window.currentSecurityResults = results;
            window.displaySecurityResults(results);
            displayedFromCache = true;
          } else if (window.displayPerformanceResults && (cachedAnalyzer?.includes('performance') || cachedAnalyzer?.includes('speed') || cachedAnalyzer?.includes('cwv'))) {
            window.currentPerformanceResults = results;
            window.currentPerformanceHubResults = results;
            window.displayPerformanceResults(results);
            displayedFromCache = true;
          } else if (window.displayAccessibilityResults && cachedAnalyzer?.includes('accessibility')) {
            window.currentAccessibilityResults = results;
            window.displayAccessibilityResults(results);
            displayedFromCache = true;
          } else if (window.displayMobileResults && cachedAnalyzer?.includes('mobile')) {
            window.currentMobileResults = results;
            window.displayMobileResults(results);
            displayedFromCache = true;
          } else if (window.displayCROResults && cachedAnalyzer?.includes('cro')) {
            window.currentCROResults = results;
            window.displayCROResults(results);
            displayedFromCache = true;
          } else if (window.displayCWVResults && (cachedAnalyzer?.includes('cwv') || cachedAnalyzer?.includes('core-web-vitals'))) {
            window.currentCWVResults = results;
            window.displayCWVResults(results);
            displayedFromCache = true;
          } else if (window.displayResults && (cachedAnalyzer?.includes('gdpr') || cachedAnalyzer?.includes('privacy'))) {
            window.__gdprCurrentData = results;
            window.displayResults(results);
            displayedFromCache = true;
          } else if (window.displayReputationResults && (cachedAnalyzer?.includes('ip-reputation') || cachedAnalyzer?.includes('reputation'))) {
            window.currentResults = results;
            window.displayReputationResults(results);
            displayedFromCache = true;
          } else if (window.displayFontsResults && (cachedAnalyzer?.includes('fonts') || cachedAnalyzer?.includes('typography'))) {
            window.currentFontsResults = results;
            window.displayFontsResults(results);
            displayedFromCache = true;
          } else if (window.displayCrawlerResults && (cachedAnalyzer?.includes('crawler') || cachedAnalyzer?.includes('site-crawler'))) {
            // Site Crawler
            window.currentCrawlerResults = results;
            window.displayCrawlerResults(results);
            displayedFromCache = true;
          } else if ((window.displayGeoSEOResults || window.displayLocalSEOResults) && (cachedAnalyzer?.includes('geo-seo') || cachedAnalyzer?.includes('geo_seo') || cachedAnalyzer?.includes('local-seo') || cachedAnalyzer?.includes('local_seo'))) {
            // GEO SEO (formerly Local SEO)
            window.currentGeoSEOResults = results;
            window.currentLocalSEOResults = results;
            (window.displayGeoSEOResults || window.displayLocalSEOResults)(results);
            displayedFromCache = true;
          } else if (window.displayBrokenLinksResults && (cachedAnalyzer?.includes('broken-links') || cachedAnalyzer?.includes('broken_links'))) {
            // Broken Links
            window.currentBrokenLinksResults = results;
            window.displayBrokenLinksResults(results);
            displayedFromCache = true;
          } else if (window.displayBrandResults && (cachedAnalyzer?.includes('brand-consistency') || cachedAnalyzer?.includes('brand_consistency'))) {
            // Brand Consistency
            window.currentBrandResults = results;
            window.displayBrandResults(results);
            displayedFromCache = true;
          } else if (window.displayCompetitiveResults && cachedAnalyzer?.includes('competitive')) {
            // Competitive Analysis
            window.currentCompetitiveResults = results;
            window.competitiveData = results;
            window.displayCompetitiveResults(results);
            displayedFromCache = true;
          } else {
            // Display function not available yet - leave cache for analyzer script to pick up
            console.log('[BillingReturn] Display function not available, leaving cache for analyzer script');
          }

          // Set screenshot URL from cached results before revealing content
          const cachedScreenshotUrl = results?.screenshotUrl || results?.results?.screenshotUrl;
          if (cachedScreenshotUrl) {
            document.body.setAttribute('data-sm-screenshot-url', cachedScreenshotUrl);
            console.log('[BillingReturn] Set screenshot URL from cached results:', cachedScreenshotUrl);
          }

          // Also call revealProOnlyContent to handle any sections that were rendered locked
          // before the billing status was available (e.g., from cached HTML)
          setTimeout(() => {
            revealProOnlyContent();
            showPaymentSuccessBanner('single_report');
            // Explicitly call ensurePageScreenshotCard since MutationObserver might not trigger
            ensurePageScreenshotCard(reportId);
          }, 100);

          // Safety net: Dispatch entitlements:updated AFTER results are displayed
          // This triggers analyzer scripts to re-render pro sections with current access state.
          // The earlier entitlements:updated (from fetchBillingStatus) fires before results exist,
          // so this delayed dispatch catches any timing issues.
          setTimeout(() => {
            console.log('[BillingReturn] Dispatching delayed entitlements:updated for safety');
            window.dispatchEvent(new CustomEvent('entitlements:updated', { detail: billingStatus }));
          }, 300);
        } catch (e) {
          console.warn('Failed to restore scan results:', e);
          showPaymentSuccessBanner('single_report');
        }
      } else if (reportId) {
        // No cached results in sessionStorage, but we have a reportId
        // Try to load from stored reports (database) and display
        console.log('[BillingReturn] No cached results, trying to load stored report:', reportId);

        if (window.ReportStorage && typeof window.ReportStorage.loadReport === 'function') {
          try {
            const stored = await window.ReportStorage.loadReport(reportId);
            if (stored && stored.data) {
              // Validate stored data - check for error responses or invalid structure
              const data = stored.data;
              const hasError = data.error || typeof data === 'string';
              if (hasError) {
                console.warn('[BillingReturn] Stored report contains error data, skipping display:', {
                  errorType: typeof data.error,
                  dataType: typeof data
                });
              } else {
                console.log('[BillingReturn] Found stored report, displaying...');
              }

              // Try to display using the appropriate display function (skip if error data)
              const analyzerType = stored.metadata?.analyzerType || '';
              if (hasError) {
                // Don't try to display error data
              } else
              if (window.displaySEOResults && analyzerType.includes('seo')) {
                window.currentSeoResults = stored.data;
                window.displaySEOResults(stored.data);
                loadedFromStorage = true;
              } else if (window.displaySecurityResults && analyzerType.includes('security')) {
                window.currentSecurityResults = stored.data;
                window.displaySecurityResults(stored.data);
                loadedFromStorage = true;
              } else if (window.displayPerformanceResults && (analyzerType.includes('performance') || analyzerType.includes('speed') || analyzerType.includes('cwv'))) {
                window.currentPerformanceResults = stored.data;
                window.currentPerformanceHubResults = stored.data;
                window.displayPerformanceResults(stored.data);
                loadedFromStorage = true;
              } else if (window.displayAccessibilityResults && analyzerType.includes('accessibility')) {
                window.currentAccessibilityResults = stored.data;
                window.displayAccessibilityResults(stored.data);
                loadedFromStorage = true;
              } else if (window.displayMobileResults && analyzerType.includes('mobile')) {
                window.currentMobileResults = stored.data;
                window.displayMobileResults(stored.data);
                loadedFromStorage = true;
              } else if (window.displayCROResults && analyzerType.includes('cro')) {
                window.currentCROResults = stored.data;
                window.displayCROResults(stored.data);
                loadedFromStorage = true;
              } else if (window.displayCWVResults && (analyzerType.includes('cwv') || analyzerType.includes('core-web-vitals'))) {
                window.currentCWVResults = stored.data;
                window.displayCWVResults(stored.data);
                loadedFromStorage = true;
              } else if (window.displayResults && (analyzerType.includes('gdpr') || analyzerType.includes('privacy'))) {
                window.__gdprCurrentData = stored.data;
                window.displayResults(stored.data);
                loadedFromStorage = true;
              } else if (window.displayReputationResults && (analyzerType.includes('ip-reputation') || analyzerType.includes('reputation'))) {
                window.currentResults = stored.data;
                window.displayReputationResults(stored.data);
                loadedFromStorage = true;
              } else if (window.displayFontsResults && (analyzerType.includes('fonts') || analyzerType.includes('typography'))) {
                window.currentFontsResults = stored.data;
                window.displayFontsResults(stored.data);
                loadedFromStorage = true;
              } else if (window.displayCompetitiveResults && analyzerType.includes('competitive')) {
                window.currentCompetitiveResults = stored.data;
                window.competitiveData = stored.data;
                window.displayCompetitiveResults(stored.data);
                loadedFromStorage = true;
              }

              if (loadedFromStorage) {
                // Set screenshot URL from stored data before revealing content
                const storedScreenshotUrl = stored.data?.screenshotUrl || stored.data?.results?.screenshotUrl;
                if (storedScreenshotUrl) {
                  document.body.setAttribute('data-sm-screenshot-url', storedScreenshotUrl);
                  console.log('[BillingReturn] Set screenshot URL from stored data:', storedScreenshotUrl);
                }

                // Reveal pro content after display
                setTimeout(() => {
                  revealProOnlyContent();
                  showPaymentSuccessBanner('single_report');
                  ensurePageScreenshotCard(reportId);
                }, 100);

                // Safety net: delayed entitlements:updated after display
                setTimeout(() => {
                  console.log('[BillingReturn] Dispatching delayed entitlements:updated (ReportStorage path)');
                  window.dispatchEvent(new CustomEvent('entitlements:updated', { detail: billingStatus }));
                }, 300);
              }
            }
          } catch (e) {
            console.warn('[BillingReturn] Failed to load stored report:', e);
          }
        }

        if (!loadedFromStorage) {
          // No stored report found either - show banner prompting re-scan
          showPaymentSuccessBanner('single_report');
        }
      } else if (cachedUrl) {
        // No report_id but have URL - show banner
        showPaymentSuccessBanner('single_report');
      }

      // Clear cached data - but only clear if we successfully displayed results
      // This allows analyzer scripts (GDPR, IP Reputation, etc.) to pick up cached data
      // if the display function wasn't available here
      const handledByReportUI = displayedFromCache || loadedFromStorage;
      if (handledByReportUI) {
        sessionStorage.removeItem('sm_checkout_url');
        sessionStorage.removeItem('sm_checkout_report_id');
        sessionStorage.removeItem('sm_checkout_results');
        sessionStorage.removeItem('sm_checkout_analyzer');
      } else {
        console.log('[BillingReturn] Results not handled by report-ui.js, leaving sessionStorage for analyzer script');
      }

      // Clean up URL
      params.delete('billing_success');
      params.delete('billing_canceled');
      params.delete('session_id');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, document.title, newUrl);

      // Signal that billing return processing is complete
      billingReturnInProgress = false;
      window.__smBillingReturnInProgress = false;
      window.__smBillingReturnComplete = true;
      window.dispatchEvent(new CustomEvent('sm:billingReturnComplete', {
        detail: { reportId: reportId, billingStatus }
      }));

      // If results weren't successfully displayed, trigger a re-scan instead of reloading
      // A page reload loses session markers and forces the user through a confusing flow.
      // Instead, dispatch a re-scan event that analyzer scripts can handle, preserving
      // the purchased reportId so pro sections render unlocked.
      if (!displayedFromCache && !loadedFromStorage) {
        console.log('[BillingReturn] Results not displayed, triggering re-scan with preserved reportId');
        showPaymentSuccessBanner('single_report');
        setTimeout(() => {
          // Check if an analyzer script already handled the restore via event listener
          if (window.__smResultsRestoredByAnalyzer) {
            console.log('[BillingReturn] Results were restored by analyzer event listener, skipping re-scan');
            return;
          }

          // Dispatch event for analyzer scripts to re-scan with the purchased reportId
          // This avoids a full page reload which can lose session markers and billing state
          window.dispatchEvent(new CustomEvent('sm:billingRescan', {
            detail: { reportId, url: cachedUrl, billingStatus }
          }));

          // Fallback: if no analyzer handles the re-scan within 3s, reload as last resort
          setTimeout(() => {
            if (window.__smResultsRestoredByAnalyzer || window.__smBillingRescanHandled) {
              return;
            }
            console.log('[BillingReturn] No analyzer handled re-scan, reloading as fallback');
            const reloadParams = new URLSearchParams(window.location.search);
            reloadParams.delete('billing_success');
            reloadParams.delete('billing_canceled');
            reloadParams.delete('session_id');
            if (reloadParams.has('url') || cachedUrl) {
              reloadParams.set('auto_scan', 'true');
              reloadParams.set('billing_rescan', 'true');
              if (cachedUrl && !reloadParams.has('url')) {
                reloadParams.set('url', cachedUrl);
              }
            }
            const reloadUrl = `${window.location.pathname}${reloadParams.toString() ? `?${reloadParams.toString()}` : ''}`;
            window.location.href = reloadUrl;
          }, 3000);
        }, 500);
      }

      return; // Exit early - don't process legacy flow
    }

    // Handle legacy session_id flow (for backwards compatibility)
    // This only runs if billing_success was NOT present
    if (sessionId && !billingSuccess) {
      // Dedupe refreshes using sessionStorage
      const receiptKey = `sm_purchase_receipt_${sessionId}`;
      if (sessionStorage.getItem(receiptKey)) return;

      const verifyResp = await fetch(`/api/billing/verify-session?session_id=${encodeURIComponent(sessionId)}`);
      const verification = await verifyResp.json().catch(() => null);
      if (!verifyResp.ok || !verification || verification.paid !== true) {
        return;
      }

      // Handle subscription purchase
      if (verification.purchaseType === 'subscription') {
        showToast('Pro subscription activated!');
        if (window.ProReportBlock?.clearBillingCache) {
          window.ProReportBlock.clearBillingCache();
        }
        revealProOnlyContent();
      }

      // Handle single report purchase
      if (verification.purchaseType === 'single_report') {
        const rid = verification.reportId || getCurrentReportId();
        if (rid) {
          revealProOnlyContent();
          showToast('Report unlocked!');
        }
      }

      // Mark as processed
      sessionStorage.setItem(receiptKey, 'true');

      // Remove session_id from URL
      params.delete('session_id');
      params.delete('sessionId');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  }


  // If reportId is provided in the URL, set it early so updateProUI()
  // and unlock checks reference the same reportId across redirects.
  // Check both camelCase (legacy) and snake_case (billing flow)
  try {
    const params = new URLSearchParams(window.location.search);
    const reportIdFromQuery = params.get('reportId') || params.get('report_id') || '';
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
   * Print the current report
   * Centralizes print logic for consistent behavior across all pages
   */
  function printReport() {
    // Check if user has pro access (for hiding pro sections)
    const hasPro = (
      (window.ProReportBlock && typeof window.ProReportBlock.isProSubscriber === 'function' && window.ProReportBlock.isProSubscriber()) ||
      (typeof window.userHasPro === 'function' && window.userHasPro())
    );

    // Add class to body for print styling
    document.body.classList.add('printing-report');

    if (!hasPro) {
      // Add class to hide pro sections when not paid
      document.body.classList.add('print-free-tier');
    }

    // Trigger print dialog
    window.print();

    // Remove classes after print dialog closes
    // Use both afterprint event and timeout fallback
    const cleanup = () => {
      document.body.classList.remove('printing-report');
      document.body.classList.remove('print-free-tier');
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    // Fallback timeout in case afterprint doesn't fire
    setTimeout(cleanup, 2000);
  }

  /**
   * Global event delegation for common UI patterns
   */
  function initGlobalEventDelegation() {
    if (window.__reportUIInitialized) return;
    window.__reportUIInitialized = true;

    document.addEventListener('click', async (e) => {
      // Print report buttons
      const printBtn = e.target.closest('[data-print-report]');
      if (printBtn) {
        e.preventDefault();
        printReport();
        return;
      }

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

      // Legacy unlock with credit button - redirect to pricing modal
      const unlockWithCredit = e.target.closest('[data-unlock-with-credit]');
      if (unlockWithCredit) {
        e.preventDefault();
        // New billing model: open pricing modal instead of using credits
        if (window.PricingModal && typeof window.PricingModal.open === 'function') {
          window.PricingModal.open();
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

      // Redeem bug reward token
      const redeemToken = e.target.closest('[data-redeem-bug-token]');
      if (redeemToken) {
        e.preventDefault();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        let reportId = redeemToken.dataset.reportId || document.body.getAttribute('data-report-id');
        if (!reportId) {
          const computed = computeReportId(getReportUrl(), getScanStartedAt(), getAnalyzerKey());
          if (computed) { reportId = computed; setCurrentReportId(reportId); }
        }
        if (!reportId) { showToast('Run a scan first.'); return; }

        redeemToken.disabled = true;
        redeemToken.textContent = '...';
        try {
          const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
          const resp = await fetch('/api/bugs/redeem-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
            credentials: 'include',
            body: JSON.stringify({ reportId })
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || 'Redemption failed');

          showToast(t('bugReport.tokenRedeemed', 'Report unlocked with reward token!'));
          // Refresh entitlements to remove paywall
          if (window.ProReportBlock && typeof window.ProReportBlock.refreshBillingStatus === 'function') {
            await window.ProReportBlock.refreshBillingStatus();
          }
          window.dispatchEvent(new CustomEvent('entitlements:updated'));
        } catch (err) {
          showToast(err.message);
          redeemToken.disabled = false;
          redeemToken.textContent = t('bugReport.redeemToken', 'Use Reward Token');
        }
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
          alert('Unlock Report ($5 USD)');
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
    // If we're returning from Stripe, apply entitlements first.
    handleBillingReturnIfPresent().catch(() => undefined);

    // If we just returned from auth with a pending purchase, auto-open pricing modal
    handlePendingPurchaseIfPresent();

    initGlobalEventDelegation();

    // Handle print events (for Ctrl+P / Cmd+P keyboard shortcuts)
    // This ensures proper CSS classes are applied even when not using the print button
    window.addEventListener('beforeprint', () => {
      const hasPro = (
        (window.ProReportBlock && typeof window.ProReportBlock.isProSubscriber === 'function' && window.ProReportBlock.isProSubscriber()) ||
        (typeof window.userHasPro === 'function' && window.userHasPro())
      );
      document.body.classList.add('printing-report');
      if (!hasPro) {
        document.body.classList.add('print-free-tier');
      }
    });

    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-report');
      document.body.classList.remove('print-free-tier');
    });

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

    // Fetch billing status so Pro blocks can render correctly
    if (window.ProReportBlock?.fetchBillingStatus) {
      window.ProReportBlock.fetchBillingStatus().then(() => {
        const currentReportId = document.body.getAttribute('data-report-id');
        if (currentReportId && window.ProReportBlock.hasAccess(currentReportId)) {
          revealProOnlyContent();
        }
      });
    }

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
      return pretty ? `${pretty.charAt(0).toUpperCase()}${pretty.slice(1)} Report` : t('reports.ui.webAnalysisReport', 'Web Analysis Report');
    }

    return t('reports.ui.webAnalysisReport', 'Web Analysis Report');
  }

  async function exportPdfFromCurrentReport(buttonEl) {
    if (typeof window.PDFExportUtility === 'undefined') {
      alert(t('reports.ui.pdfNotAvailable', 'PDF export is not available on this page.'));
      return;
    }

    const selector = detectExportContentSelector();
    const urlInput = document.querySelector('input[type="url"], #urlInput, #seoUrlInput, #securityUrlInput, #accessibilityUrlInput');
    const url = (urlInput && urlInput.value) || (window.ScanContext && window.ScanContext.get && (window.ScanContext.get() || {}).url) || window.location.href;

    const today = new Date().toISOString().split('T')[0];
    const exporter = new window.PDFExportUtility({
      filename: `site-mechanic-report-${today}.pdf`,
      reportTitle: t('common.siteMechanic', 'Site Mechanic'),
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
      // Check if user has access before sharing
      const reportId = getCurrentReportId();
      if (!window.ProReportBlock?.hasAccess?.(reportId)) {
        showToast(t('reports.ui.purchaseToShare', 'Purchase report to get shareable link'));
        return;
      }

      if (typeof window.copyShareLink === 'function') {
        return window.copyShareLink();
      }

      // Generic share link implementation
      const url = getReportUrl();
      if (!reportId) {
        showToast(t('reports.ui.runScanToShare', 'Run a scan first to share'));
        return;
      }

      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set('report_id', reportId);
      if (url) {
        shareUrl.searchParams.set('url', url);
      }
      shareUrl.searchParams.delete('billing_success');
      shareUrl.searchParams.delete('session_id');
      shareUrl.searchParams.delete('auto_scan');

      navigator.clipboard.writeText(shareUrl.toString()).then(() => {
        showToast(t('reports.ui.linkCopied', 'Share link copied to clipboard!'));
      }).catch(() => {
        showToast(t('reports.ui.copyFailed', 'Failed to copy link'));
      });
    };
  }

  if (typeof window.exportCSV !== 'function') {
    window.exportCSV = function exportCSV() {
      // Check if user has access
      const reportId = getCurrentReportId();
      if (!window.ProReportBlock?.hasAccess?.(reportId)) {
        showToast(t('reports.ui.purchaseToExportCSV', 'Purchase report to export CSV'));
        return;
      }

      // Try analyzer-specific CSV export
      if (typeof window.exportSeoCSV === 'function') {
        return window.exportSeoCSV();
      }
      if (typeof window.exportPerformanceCSV === 'function') {
        return window.exportPerformanceCSV();
      }
      if (typeof window.exportSecurityCSV === 'function') {
        return window.exportSecurityCSV();
      }

      showToast(t('reports.ui.csvNotAvailable', 'CSV export not available for this report type'));
    };
  }

  // Export Excel handler
  if (typeof window.exportExcel !== 'function') {
    window.exportExcel = function exportExcel() {
      // Check if user has access
      const reportId = getCurrentReportId();
      if (!window.ProReportBlock?.hasAccess?.(reportId)) {
        showToast(t('reports.ui.purchaseToExportExcel', 'Purchase report to export Excel'));
        return;
      }

      // Try analyzer-specific Excel export
      if (typeof window.exportSeoExcel === 'function') {
        return window.exportSeoExcel();
      }
      if (typeof window.exportPerformanceExcel === 'function') {
        return window.exportPerformanceExcel();
      }
      if (typeof window.exportSecurityExcel === 'function') {
        return window.exportSecurityExcel();
      }

      // Fallback to CSV if Excel not available
      if (typeof window.exportCSV === 'function') {
        showToast(t('reports.ui.excelNotAvailableFallback', 'Excel not available, exporting CSV instead'));
        return window.exportCSV();
      }

      showToast(t('reports.ui.excelNotAvailable', 'Excel export not available for this report type'));
    };
  }

  if (typeof window.exportJSON !== 'function') {
    window.exportJSON = function exportJSON() {
      // Check if user has access
      const reportId = getCurrentReportId();
      if (!window.ProReportBlock?.hasAccess?.(reportId)) {
        showToast(t('reports.ui.purchaseToExportJSON', 'Purchase report to export JSON'));
        return;
      }

      // Generic JSON export - use current results
      const results = window.currentSeoResults || window.currentPerformanceResults || window.currentSecurityResults;
      if (!results) {
        showToast(t('reports.ui.noResults', 'No results to export'));
        return;
      }

      const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${reportId || 'export'}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(t('reports.ui.jsonExported', 'JSON exported'));
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

    // Print functionality
    printReport,

    // Deterministic report identity helpers
    makeReportId,
    computeReportId,
    getCurrentReportId,
    setCurrentReportId,
    normalizeUrlForReportId,
    hashForStorageKey,

    // Screenshot card helper - ensures screenshot is shown in results
    ensurePageScreenshotCard,

    // Reset waiting state - call at start of new scan to ensure screenshot card is created
    resetWaitingState,

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

    // Pro gating helpers (delegates to ProGate/ProReportBlock)
    pro: {
      showPaywall: (opts) => {
        if (window.PricingModal?.open) {
          return window.PricingModal.open(opts);
        } else if (typeof window.openProPaywall === 'function') {
          return window.openProPaywall(opts);
        } else if (window.ProGate?.showUpgradePrompt) {
          return window.ProGate.showUpgradePrompt(opts);
        }
      },
      isPro: () => window.ProReportBlock?.isProSubscriber?.() || window.ProGate?.isPro() || false,
      hasAccess: (reportId) => window.ProReportBlock?.hasAccess?.(reportId) || false,
      lockContent: (contentHTML, context) => {
        const reportId = getCurrentReportId();
        const unlockPrompt = window.ProReportBlock?.renderUnlockPrompt
          ? window.ProReportBlock.renderUnlockPrompt({ context: context || 'feature', reportId })
          : `
              <div class="pro-report-block__unlock-prompt" data-locked-overlay>
                <div class="pro-report-block__unlock-header">
                  <span class="pro-report-block__unlock-icon">🔒</span>
                  <span class="pro-report-block__unlock-text">${t('reports.common.unlockThisReport', 'Unlock this report')}</span>
                </div>
                <div class="pro-report-block__unlock-buttons">
                  <button class="pro-report-block__unlock-btn pro-report-block__unlock-btn--primary" data-buy-single-report data-context="${context || 'feature'}" ${reportId ? `data-report-id="${reportId}"` : ''}>
                    ${t('reports.common.unlockFor5', 'Unlock for $5')}
                  </button>
                  <button class="pro-report-block__unlock-btn pro-report-block__unlock-btn--secondary" data-open-pricing-modal data-context="${context || 'feature'}">
                    ${t('reports.common.goPro30', 'Go Pro — $30/mo')}
                  </button>
                </div>
                <p class="pro-report-block__unlock-hint">
                  ${t('reports.common.proUnlocksAll', 'Pro unlocks all reports. Single purchase unlocks only this scan.')}
                </p>
              </div>
            `;
        return `
          <div class="report-shell__lock-overlay">
            <div class="is-locked">${contentHTML}</div>
            <div class="report-shell__lock-paywall" data-hide-when-unlocked>${unlockPrompt}</div>
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
