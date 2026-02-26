/**
 * Rate Limit Alert — Global 429 Interceptor
 *
 * Monkey-patches window.fetch so that any 429 (Too Many Requests) response
 * triggers a user-visible toast notification. Works with the existing
 * ReportUI.toast helper or falls back to a standalone toast.
 *
 * Also patches XMLHttpRequest for legacy code paths.
 */
(function () {
  'use strict';

  // Dedup: don't show the same message repeatedly within a short window
  let lastAlertTime = 0;
  const ALERT_COOLDOWN_MS = 5000; // 5 seconds between toasts

  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const result = window.i18n.t(key);
      if (result && result !== key) return result;
    }
    return fallback;
  }

  /**
   * Show a rate limit toast to the user.
   */
  function showRateLimitToast(retryAfter, upgradeUrl, isBlocked) {
    const now = Date.now();
    if (now - lastAlertTime < ALERT_COOLDOWN_MS) return;
    lastAlertTime = now;

    const retryMins = retryAfter ? Math.ceil(retryAfter / 60) : 1;

    let message;
    if (isBlocked) {
      message = t(
        'rateLimit.blocked',
        'You\'ve been temporarily blocked due to too many requests. Please wait ' + retryMins + ' minute(s) and try again.'
      );
    } else if (upgradeUrl) {
      message = t(
        'rateLimit.exceeded',
        'You\'ve reached the request limit. Upgrade for higher limits, or try again in ' + retryMins + ' minute(s).'
      );
    } else {
      message = t(
        'rateLimit.exceededPro',
        'You\'ve reached the request limit. Please try again in ' + retryMins + ' minute(s).'
      );
    }

    // Use existing toast system if available
    if (window.ReportUI && typeof window.ReportUI.toast === 'function') {
      window.ReportUI.toast(message);
      return;
    }

    // Fallback: create a standalone toast
    showFallbackToast(message, upgradeUrl);
  }

  /**
   * Standalone toast when ReportUI isn't loaded yet.
   */
  function showFallbackToast(message, upgradeUrl) {
    // Ensure container exists
    let container = document.getElementById('sm-rate-limit-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sm-rate-limit-toast-container';
      container.style.cssText =
        'position:fixed;top:20px;right:20px;z-index:999999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.setAttribute('role', 'alert');
    toast.style.cssText =
      'pointer-events:auto;max-width:380px;padding:14px 18px;border-radius:12px;' +
      'background:var(--bg-card, #1c2128);color:var(--text-primary, #fff);' +
      'border:1px solid var(--border-color, rgba(255,255,255,0.16));' +
      'font-size:14px;font-weight:500;line-height:1.45;' +
      'box-shadow:0 10px 30px rgba(0,0,0,0.35);backdrop-filter:blur(6px);' +
      'opacity:0;transform:translateY(-8px);transition:opacity 200ms ease,transform 200ms ease;';

    let html = '<div style="display:flex;align-items:flex-start;gap:10px;">';
    html += '<span style="font-size:18px;line-height:1;flex-shrink:0;">&#9888;</span>';
    html += '<div>';
    html += '<div>' + escHtml(message) + '</div>';
    if (upgradeUrl) {
      const upgradeText = t('rateLimit.upgradeLink', 'Upgrade for higher limits');
      html += '<a href="' + escHtml(upgradeUrl) + '" style="color:#60a5fa;font-size:13px;margin-top:4px;display:inline-block;">' + escHtml(upgradeText) + ' &rarr;</a>';
    }
    html += '</div></div>';

    toast.innerHTML = html;
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      setTimeout(() => toast.remove(), 250);
    }, 8000);
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Parse a 429 JSON body for our custom fields.
   */
  function parse429Body(body) {
    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      return {
        retryAfter: data.retryAfter || 60,
        upgradeUrl: data.upgradeUrl || null,
        isBlocked: data.blocked === true,
      };
    } catch (_) {
      return { retryAfter: 60, upgradeUrl: null, isBlocked: false };
    }
  }

  // ─── Patch fetch ─────────────────────────────────────────────────────────

  const originalFetch = window.fetch;
  window.fetch = function () {
    return originalFetch.apply(this, arguments).then(function (response) {
      if (response.status === 429) {
        // Clone so downstream code can still read the body
        response.clone().json().then(function (data) {
          const info = parse429Body(data);
          showRateLimitToast(info.retryAfter, info.upgradeUrl, info.isBlocked);
        }).catch(function () {
          // Non-JSON 429 body
          const retryHeader = response.headers.get('Retry-After');
          showRateLimitToast(retryHeader ? parseInt(retryHeader, 10) : 60, null, false);
        });
      }
      return response;
    });
  };

  // ─── Patch XMLHttpRequest ────────────────────────────────────────────────

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function () {
    this._smUrl = arguments[1];
    return xhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      if (this.status === 429) {
        const info = parse429Body(this.responseText);
        showRateLimitToast(info.retryAfter, info.upgradeUrl, info.isBlocked);
      }
    });
    return xhrSend.apply(this, arguments);
  };

})();
