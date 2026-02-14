/**
 * UpgradeGate Component
 * Shows when daily scan limit is exhausted with upgrade CTAs
 * Displays options for Day Pass, Pro Monthly, Pro Annual, and Login
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
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
    return text;
  }

  class UpgradeGate {
    constructor(options = {}) {
      this.container = options.container;
      this.onUpgrade = options.onUpgrade || null;
      this.onLogin = options.onLogin || null;
      this.showLoginOption = options.showLoginOption !== false;
      this.usage = null;
      this.isLoggedIn = false;
    }

    /**
     * Initialize the component
     */
    async init() {
      if (!this.container) {
        console.warn('[UpgradeGate] No container provided');
        return;
      }

      await this.fetchUsage();
      this.render();
      this.bindEvents();

      // Listen for usage/auth changes
      window.addEventListener('entitlements:updated', () => this.refresh());
      window.addEventListener('scan:completed', () => this.refresh());
      window.addEventListener('languageChanged', () => this.render());
    }

    /**
     * Fetch usage data
     */
    async fetchUsage() {
      try {
        const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch('/api/auth/usage', {
          credentials: 'include',
          headers
        });
        if (response.ok) {
          this.usage = await response.json();
          this.isLoggedIn = !!this.usage.user_id;
        }
      } catch (error) {
        console.warn('[UpgradeGate] Failed to fetch usage:', error);
      }
    }

    /**
     * Check if gate should be shown
     */
    shouldShow() {
      if (!this.usage) return false;
      if (this.usage.scan_limit_daily === -1) return false; // Unlimited
      return this.usage.scans_remaining_today <= 0;
    }

    /**
     * Refresh usage and re-render
     */
    async refresh() {
      await this.fetchUsage();
      this.render();
      this.bindEvents();
    }

    /**
     * Render the gate
     */
    render() {
      if (!this.container) return;

      if (!this.shouldShow()) {
        this.container.innerHTML = '';
        this.container.classList.add('hidden');
        return;
      }

      this.container.classList.remove('hidden');

      const resetTime = this.usage.scans_reset_at
        ? new Date(this.usage.scans_reset_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'midnight UTC';

      this.container.innerHTML = `
        <div class="upgrade-gate">
          <div class="upgrade-gate__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4l2 2"/>
            </svg>
          </div>

          <h3 class="upgrade-gate__title">
            ${t('usage.scansExhausted', 'Daily limit reached')}
          </h3>

          <p class="upgrade-gate__subtitle">
            ${t('usage.scansResetAt', 'Resets at {time}', { time: resetTime })}
          </p>

          <p class="upgrade-gate__single-report-note">
            ${t('usage.needOneReport', 'Just need one report? You can unlock this single report for $5 after scanning.')}
          </p>

          <div class="upgrade-gate__options">
            <!-- Day Pass Option -->
            <button class="upgrade-gate__option upgrade-gate__option--daypass" data-action="daypass">
              <span class="upgrade-gate__option-badge">${t('pricing.oneTime', 'One-time')}</span>
              <span class="upgrade-gate__option-name">${t('pricing.dayPass', 'Day Pass')}</span>
              <span class="upgrade-gate__option-price">$20</span>
              <span class="upgrade-gate__option-desc">${t('pricing.dayPassDesc', 'Unlimited scans for 24 hours')}</span>
            </button>

            <!-- Pro Monthly Option -->
            <button class="upgrade-gate__option upgrade-gate__option--monthly" data-action="monthly">
              <span class="upgrade-gate__option-name">${t('pricing.proMonthly', 'Pro Monthly')}</span>
              <span class="upgrade-gate__option-price">$29<span class="upgrade-gate__option-period">/mo</span></span>
              <span class="upgrade-gate__option-desc">${t('pricing.monthlyDesc', 'Unlimited scans + 250 reports')}</span>
            </button>

            <!-- Pro Annual Option -->
            <button class="upgrade-gate__option upgrade-gate__option--annual upgrade-gate__option--featured" data-action="annual">
              <span class="upgrade-gate__option-badge upgrade-gate__option-badge--savings">${t('pricing.save60', 'Save $60')}</span>
              <span class="upgrade-gate__option-name">${t('pricing.proAnnual', 'Pro Annual')}</span>
              <span class="upgrade-gate__option-price">$290<span class="upgrade-gate__option-period">/yr</span></span>
              <span class="upgrade-gate__option-desc">${t('pricing.annualDesc', 'Unlimited scans + unlimited reports')}</span>
            </button>
          </div>

          ${!this.isLoggedIn && this.showLoginOption ? `
            <div class="upgrade-gate__login">
              <p class="upgrade-gate__login-text">
                ${t('auth.alreadyHaveAccount', 'Already have an account?')}
              </p>
              <a href="#" class="upgrade-gate__login-link" data-action="login">
                ${t('auth.signIn', 'Sign in')}
              </a>
            </div>
          ` : ''}
        </div>
      `;
    }

    /**
     * Bind click handlers
     */
    bindEvents() {
      if (!this.container) return;

      // Plan buttons
      this.container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const action = btn.dataset.action;

          if (action === 'login') {
            if (this.onLogin) {
              this.onLogin();
            } else {
              window.location.href = '/auth.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
            }
            return;
          }

          // Handle upgrade actions
          if (this.onUpgrade) {
            this.onUpgrade(action);
          } else {
            // Default: open PricingModal or redirect to upgrade page
            if (window.PricingModal && typeof window.PricingModal.show === 'function') {
              const planMap = {
                'daypass': 'daypass',
                'monthly': 'monthly',
                'annual': 'yearly'
              };
              window.PricingModal.show({ defaultPlan: planMap[action] || 'monthly' });
            } else {
              // Fallback to upgrade page
              window.location.href = '/upgrade.html';
            }
          }
        });
      });
    }

    /**
     * Show the gate
     */
    show() {
      if (this.container) {
        this.container.classList.remove('hidden');
      }
    }

    /**
     * Hide the gate
     */
    hide() {
      if (this.container) {
        this.container.classList.add('hidden');
      }
    }

    /**
     * Destroy the component
     */
    destroy() {
      if (this.container) {
        this.container.innerHTML = '';
      }
    }
  }

  /**
   * Factory function
   */
  UpgradeGate.create = async function(containerSelector, options = {}) {
    const container = typeof containerSelector === 'string'
      ? document.querySelector(containerSelector)
      : containerSelector;

    if (!container) {
      console.warn('[UpgradeGate] Container not found:', containerSelector);
      return null;
    }

    const gate = new UpgradeGate({ ...options, container });
    await gate.init();
    return gate;
  };

  /**
   * Inject styles
   */
  UpgradeGate.injectStyles = function() {
    if (document.getElementById('upgrade-gate-styles')) return;

    const link = document.createElement('link');
    link.id = 'upgrade-gate-styles';
    link.rel = 'stylesheet';
    link.href = '/css/components/upgrade-gate.css';
    document.head.appendChild(link);
  };

  // Auto-inject styles
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', UpgradeGate.injectStyles);
  } else {
    UpgradeGate.injectStyles();
  }

  // Export
  window.UpgradeGate = UpgradeGate;

})(window);
