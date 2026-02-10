/**
 * UsagePill Component
 * Displays usage status (scans remaining, reports remaining) in various formats
 * Supports inline mode (near scan inputs) and dropdown mode (header)
 */

(function(window) {
  'use strict';

  /**
   * Translation helper
   */
  function t(key, fallback, replacements = {}) {
    let text = fallback;
    if (window.i18n && typeof window.i18n.t === 'function') {
      const result = window.i18n.t(key);
      if (result && result !== key) {
        text = result;
      }
    }
    // Apply replacements
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
    return text;
  }

  /**
   * Format reset time for display
   */
  function formatResetTime(resetAt) {
    if (!resetAt) return '';
    const reset = new Date(resetAt);
    const now = new Date();
    const diffMs = reset - now;

    if (diffMs <= 0) return t('usage.resetNow', 'now');

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 1) {
      const mins = Math.floor(diffMs / (1000 * 60));
      return t('usage.resetInMinutes', '{count}m', { count: mins });
    }
    if (hours < 24) {
      return t('usage.resetInHours', '{count}h', { count: hours });
    }
    return reset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Format Day Pass time remaining for display
   * Shows hours and minutes remaining, e.g., "5h 23m left"
   */
  function formatDayPassTimeRemaining(expiresAt) {
    if (!expiresAt) return '';
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires - now;

    if (diffMs <= 0) return t('usage.expired', 'expired');

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours < 1) {
      return t('usage.dayPassMinutesLeft', '{mins}m left', { mins });
    }
    return t('usage.dayPassTimeLeft', '{hours}h {mins}m left', { hours, mins });
  }

  class UsagePill {
    constructor(options = {}) {
      this.mode = options.mode || 'inline'; // 'inline' | 'dropdown' | 'compact'
      this.container = options.container;
      this.showReports = options.showReports !== false;
      this.showUpgradeLink = options.showUpgradeLink !== false;
      this.autoRefresh = options.autoRefresh !== false;
      this.refreshInterval = options.refreshInterval || 60000; // 1 minute
      this.onUpgradeClick = options.onUpgradeClick || null;

      this.usage = null;
      this.refreshTimer = null;
    }

    /**
     * Initialize the component
     */
    async init() {
      if (!this.container) {
        console.warn('[UsagePill] No container provided');
        return;
      }

      await this.refresh();

      // Auto-refresh usage data
      if (this.autoRefresh) {
        this.refreshTimer = setInterval(() => this.refresh(), this.refreshInterval);
      }

      // Listen for usage updates from scan completion
      window.addEventListener('scan:completed', () => this.refresh());
      window.addEventListener('entitlements:updated', () => this.refresh());
      window.addEventListener('languageChanged', () => this.render());
    }

    /**
     * Fetch usage data from API
     */
    async fetchUsage() {
      try {
        // Include auth token if available (for authenticated users)
        const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/auth/usage', {
          credentials: 'include',
          headers
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.warn('[UsagePill] Failed to fetch usage:', error);
      }

      // Return defaults on error
      const defaultLimit = window.PRICING?.plans?.free?.limits?.scansPerDay || 10;
      return {
        plan_code: 'free',
        plan_label: 'Free',
        scan_limit_daily: defaultLimit,
        scans_used_today: 0,
        scans_remaining_today: defaultLimit,
        scans_reset_at: null,
        report_limit: 0,
        reports_used: 0,
        reports_remaining: 0,
        is_authenticated: false
      };
    }

    /**
     * Refresh usage data and re-render
     */
    async refresh() {
      const prevExhausted = this.isExhausted();
      this.usage = await this.fetchUsage();
      this.render();

      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('usage:updated', { detail: this.usage }));

      // Fire exhausted event if quota just became exhausted
      if (this.isExhausted() && !prevExhausted) {
        window.dispatchEvent(new CustomEvent('scan:quotaExhausted', { detail: this.usage }));
      }

      // Store global quota state for other components
      window.__SM_SCANS_EXHAUSTED__ = this.isExhausted();
      window.__SM_USAGE_DATA__ = this.usage;
    }

    /**
     * Render the component
     */
    render() {
      if (!this.container || !this.usage) return;

      switch (this.mode) {
        case 'inline':
          this.container.innerHTML = this.renderInline();
          break;
        case 'dropdown':
          this.container.innerHTML = this.renderDropdown();
          break;
        case 'compact':
          this.container.innerHTML = this.renderCompact();
          break;
        default:
          this.container.innerHTML = this.renderInline();
      }

      this.bindEvents();
    }

    /**
     * Render inline mode (for scan pages)
     */
    renderInline() {
      const { plan_label, plan_code, scans_remaining_today, scans_reset_at, scan_limit_daily, day_pass_expires_at } = this.usage;
      const isDayPass = plan_code === 'day_pass';

      // If day pass has expired client-side, treat as free tier
      const dayPassExpired = isDayPass && day_pass_expires_at && new Date(day_pass_expires_at) <= new Date();
      const isUnlimited = scan_limit_daily === -1 && !dayPassExpired;
      const isExhausted = !isUnlimited && scans_remaining_today <= 0;
      const isLow = !isUnlimited && scans_remaining_today <= 2 && scans_remaining_today > 0;

      if (isUnlimited) {
        // Show time remaining for Day Pass users
        const timeRemaining = isDayPass && day_pass_expires_at
          ? `<span class="usage-pill__time-remaining">${formatDayPassTimeRemaining(day_pass_expires_at)}</span>`
          : '';

        return `
          <div class="usage-pill usage-pill--unlimited${isDayPass ? ' usage-pill--day-pass' : ''}">
            <span class="usage-pill__plan">${plan_label}</span>
            <span class="usage-pill__status">${t('usage.unlimitedScans', 'Unlimited scans')}</span>
            ${timeRemaining}
          </div>
        `;
      }

      if (isExhausted) {
        const resetInfo = scans_reset_at
          ? ` <span class="usage-pill__reset-info">(${t('usage.resetsIn', 'resets in {time}', { time: formatResetTime(scans_reset_at) })})</span>`
          : '';
        return `
          <div class="usage-pill usage-pill--exhausted">
            <span class="usage-pill__plan">${plan_label}</span>
            <span class="usage-pill__status">${t('usage.scansExhausted', 'Daily limit reached')}${resetInfo}</span>
            ${this.showUpgradeLink ? `
              <a href="/upgrade.html" class="usage-pill__upgrade">${t('usage.upgrade', 'Upgrade')}</a>
            ` : ''}
          </div>
        `;
      }

      const statusClass = isLow ? 'usage-pill--low' : '';
      const scansText = t('usage.scansLeftToday', '{count} scans left today', { count: scans_remaining_today });

      return `
        <div class="usage-pill ${statusClass}">
          <span class="usage-pill__plan">${plan_label}</span>
          <span class="usage-pill__separator">:</span>
          <span class="usage-pill__count">${scansText}</span>
        </div>
      `;
    }

    /**
     * Render dropdown mode (for header)
     */
    renderDropdown() {
      const {
        plan_label,
        scans_remaining_today,
        scans_used_today,
        scan_limit_daily,
        reports_remaining,
        report_limit,
        scans_reset_at
      } = this.usage;

      const isUnlimitedScans = scan_limit_daily === -1;
      const isUnlimitedReports = report_limit === -1;

      let scansDisplay;
      if (isUnlimitedScans) {
        scansDisplay = t('usage.unlimited', 'Unlimited');
      } else {
        scansDisplay = `${scans_used_today}/${scan_limit_daily}`;
      }

      let reportsDisplay;
      if (isUnlimitedReports) {
        reportsDisplay = t('usage.unlimited', 'Unlimited');
      } else if (report_limit === 0) {
        reportsDisplay = t('usage.upgradeRequired', 'Upgrade required');
      } else {
        reportsDisplay = `${reports_remaining}/${report_limit}`;
      }

      const resetText = scans_reset_at && !isUnlimitedScans
        ? t('usage.resetsIn', 'Resets in {time}', { time: formatResetTime(scans_reset_at) })
        : '';

      return `
        <div class="usage-pill usage-pill--dropdown">
          <div class="usage-pill__header">
            <span class="usage-pill__plan-badge">${plan_label}</span>
          </div>
          <div class="usage-pill__row">
            <span class="usage-pill__label">${t('usage.scansToday', 'Scans today')}</span>
            <span class="usage-pill__value">${scansDisplay}</span>
          </div>
          ${this.showReports ? `
            <div class="usage-pill__row">
              <span class="usage-pill__label">${t('usage.reports', 'Reports')}</span>
              <span class="usage-pill__value">${reportsDisplay}</span>
            </div>
          ` : ''}
          ${resetText ? `
            <div class="usage-pill__reset">${resetText}</div>
          ` : ''}
        </div>
      `;
    }

    /**
     * Render compact mode (minimal)
     */
    renderCompact() {
      const { scans_remaining_today, scan_limit_daily, plan_code, day_pass_expires_at } = this.usage;
      const dayPassExpired = plan_code === 'day_pass' && day_pass_expires_at && new Date(day_pass_expires_at) <= new Date();
      const isUnlimited = scan_limit_daily === -1 && !dayPassExpired;

      if (isUnlimited) {
        return `<span class="usage-pill usage-pill--compact usage-pill--unlimited" title="${t('usage.unlimitedScans', 'Unlimited scans')}">&#8734;</span>`;
      }

      const isExhausted = scans_remaining_today <= 0;
      const isLow = scans_remaining_today <= 2;
      const statusClass = isExhausted ? 'usage-pill--exhausted' : (isLow ? 'usage-pill--low' : '');

      return `
        <span class="usage-pill usage-pill--compact ${statusClass}" title="${t('usage.scansLeftToday', '{count} scans left today', { count: scans_remaining_today })}">
          ${scans_remaining_today}
        </span>
      `;
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
      const upgradeLink = this.container.querySelector('.usage-pill__upgrade');
      if (upgradeLink && this.onUpgradeClick) {
        upgradeLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.onUpgradeClick();
        });
      }
    }

    /**
     * Check if scans are exhausted
     */
    isExhausted() {
      if (!this.usage) return false;
      if (this.usage.scan_limit_daily === -1) return false;
      return this.usage.scans_remaining_today <= 0;
    }

    /**
     * Get remaining scans
     */
    getRemaining() {
      if (!this.usage) return 0;
      if (this.usage.scan_limit_daily === -1) return Infinity;
      return this.usage.scans_remaining_today;
    }

    /**
     * Destroy the component
     */
    destroy() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
      }
      if (this.container) {
        this.container.innerHTML = '';
      }
    }
  }

  /**
   * Factory function to create and initialize a UsagePill
   */
  UsagePill.create = async function(containerSelector, options = {}) {
    const container = typeof containerSelector === 'string'
      ? document.querySelector(containerSelector)
      : containerSelector;

    if (!container) {
      console.warn('[UsagePill] Container not found:', containerSelector);
      return null;
    }

    const pill = new UsagePill({ ...options, container });
    await pill.init();
    return pill;
  };

  /**
   * Inject styles if not already present
   */
  UsagePill.injectStyles = function() {
    if (document.getElementById('usage-pill-styles')) return;

    const link = document.createElement('link');
    link.id = 'usage-pill-styles';
    link.rel = 'stylesheet';
    link.href = '/css/components/usage-pill.css';
    document.head.appendChild(link);
  };

  // Auto-inject styles
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', UsagePill.injectStyles);
  } else {
    UsagePill.injectStyles();
  }

  /**
   * Auto-initialize UsagePill on #usagePillContainer if present
   * (For pages not using PageShell)
   */
  function autoInit() {
    const container = document.getElementById('usagePillContainer');
    // Only auto-init if container exists and doesn't already have content
    if (container && !container.hasChildNodes() && !window.__usagePillAutoInitialized) {
      window.__usagePillAutoInitialized = true;
      UsagePill.create('#usagePillContainer', {
        mode: 'inline',
        showReports: false,
        showUpgradeLink: true
      }).then(pill => {
        // After pill is created, check if we need to show the upgrade gate
        if (pill && pill.isExhausted()) {
          showUpgradeGateIfNeeded();
        }
      });
    }
  }

  /**
   * Show UpgradeGate if scans are exhausted
   * Dynamically loads UpgradeGate.js if not already present
   */
  async function showUpgradeGateIfNeeded() {
    // Dynamically load UpgradeGate if not present
    if (!window.UpgradeGate) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/js/components/UpgradeGate.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      }).catch(() => {
        console.warn('[UsagePill] Failed to load UpgradeGate');
        return;
      });
    }

    if (!window.UpgradeGate) return;

    // Look for an existing upgrade gate container or create one
    let gateContainer = document.getElementById('upgradeGateContainer');
    if (!gateContainer) {
      // Try to insert after the scan form
      const scanForm = document.querySelector('.card__body, .form-row, .form-container');
      if (scanForm) {
        gateContainer = document.createElement('div');
        gateContainer.id = 'upgradeGateContainer';
        scanForm.parentNode.insertBefore(gateContainer, scanForm.nextSibling);
      }
    }

    if (gateContainer && !gateContainer.hasChildNodes()) {
      window.UpgradeGate.create(gateContainer);
    }
  }

  // Listen for quota exhausted event
  window.addEventListener('scan:quotaExhausted', showUpgradeGateIfNeeded);

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    // DOM already loaded, init with slight delay to ensure container is rendered
    setTimeout(autoInit, 50);
  }

  // Export
  window.UsagePill = UsagePill;

})(window);
