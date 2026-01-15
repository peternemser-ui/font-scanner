/**
 * Site Mechanic - Scan Context Manager
 * 
 * Single source of truth for current scan state across all pages.
 * Stored in localStorage under 'sm_current_scan' key.
 * 
 * Schema:
 * {
 *   domain: string,           // The scanned domain (e.g., "example.com")
 *   selectedUrls: string[],   // URLs included in the scan
 *   selectedModules: string[], // Modules used (fonts, seo, performance, accessibility, security)
 *   finishedAt: ISO string,   // When the scan completed
 *   results: object           // Full scan result JSON
 * }
 */

const ScanContext = {
  STORAGE_KEY: 'sm_current_scan',
  
  /**
   * Get the current scan context
   * @returns {Object|null} The scan context or null if none exists
   */
  get() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[ScanContext] Failed to read scan context:', error);
      return null;
    }
  },
  
  /**
   * Save a new scan context
   * @param {Object} scanData - The scan results and metadata
   */
  save(scanData) {
    try {
      // Extract domain from URL
      let domain = scanData.url || '';
      try {
        const urlObj = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
        domain = urlObj.hostname;
      } catch (e) {
        // Keep as-is if URL parsing fails
      }
      
      const context = {
        domain,
        url: scanData.url,
        selectedUrls: scanData.selectedUrls || [scanData.url],
        selectedModules: scanData.selectedModules || ['fonts', 'seo', 'performance', 'accessibility', 'security'],
        finishedAt: new Date().toISOString(),
        results: scanData.results || scanData
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(context));

      // Dispatch custom event for cross-page reactivity
      window.dispatchEvent(new CustomEvent('scanContextUpdated', { detail: context }));
      
      return context;
    } catch (error) {
      console.error('[ScanContext] Failed to save scan context:', error);
      return null;
    }
  },
  
  /**
   * Clear the current scan context
   */
  clear() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);

      window.dispatchEvent(new CustomEvent('scanContextUpdated', { detail: null }));
    } catch (error) {
      console.error('[ScanContext] Failed to clear scan context:', error);
    }
  },
  
  /**
   * Check if a scan context exists
   * @returns {boolean}
   */
  exists() {
    return this.get() !== null;
  },
  
  /**
   * Get just the domain from current scan
   * @returns {string|null}
   */
  getDomain() {
    const ctx = this.get();
    return ctx ? ctx.domain : null;
  },
  
  /**
   * Get the scan results
   * @returns {Object|null}
   */
  getResults() {
    const ctx = this.get();
    return ctx ? ctx.results : null;
  },
  
  /**
   * Get time since last scan in human-readable format
   * @returns {string|null}
   */
  getTimeSinceScan() {
    const ctx = this.get();
    if (!ctx || !ctx.finishedAt) return null;
    
    const scanTime = new Date(ctx.finishedAt);
    const now = new Date();
    const diffMs = now - scanTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  },
  
  /**
   * Check if the scan is stale (older than 24 hours)
   * @returns {boolean}
   */
  isStale() {
    const ctx = this.get();
    if (!ctx || !ctx.finishedAt) return true;
    
    const scanTime = new Date(ctx.finishedAt);
    const now = new Date();
    const diffHours = (now - scanTime) / (1000 * 60 * 60);
    return diffHours > 24;
  }
};

// Make available globally
window.ScanContext = ScanContext;

/**
 * Site Mechanic - Export Paywall Utility
 * 
 * Shared utility to check Pro status and show export paywall.
 * Used by PDFExportUtility, copyShareLink, and other export features.
 */
const ExportGate = {
  /**
   * Check if user has Pro status
   * @returns {boolean}
   */
  isPro() {
    return window.proManager && window.proManager.isPro();
  },
  
  /**
   * Gate an action behind Pro status
   * @param {Function} action - The action to perform if user is Pro
   * @returns {boolean} Whether the action was performed
   */
  gatedAction(action) {
    if (this.isPro()) {
      action();
      return true;
    }
    this.showPaywall();
    return false;
  },
  
  /**
   * Show inline paywall CTA for exports
   */
  showPaywall() {
    // Remove any existing paywall
    const existingPaywall = document.getElementById('exportPaywall');
    if (existingPaywall) existingPaywall.remove();
    
    const paywall = document.createElement('div');
    paywall.id = 'exportPaywall';
    const previousFocus = document.activeElement;
    paywall.innerHTML = `
      <div class="export-paywall-overlay">
        <div class="export-paywall-modal" role="dialog" aria-modal="true" aria-labelledby="exportPaywallTitle" tabindex="-1">
          <button type="button" class="export-paywall-close" aria-label="Close">&times;</button>
          <div class="export-paywall-icon">📄</div>
          <h3 class="export-paywall-title" id="exportPaywallTitle">Export Your Report</h3>
          <p class="export-paywall-text">
            Get the <strong>$5 USD SiteMechanic Pro Report</strong> to download client-ready PDFs, 
            export fix packs, and share results.
          </p>
          <div class="export-paywall-features">
            <div class="export-paywall-feature">✓ PDF Downloads</div>
            <div class="export-paywall-feature">✓ Fix Pack Export</div>
            <div class="export-paywall-feature">✓ Share Links</div>
            <div class="export-paywall-feature">✓ Multi-page Scanning</div>
          </div>
          <span class="export-paywall-cta">Get Pro access to export</span>
          <p class="export-paywall-note">One-time purchase. No subscription.</p>
        </div>
      </div>
    `;
    
    // Add styles if not present
    if (!document.getElementById('exportPaywallStyles')) {
      const style = document.createElement('style');
      style.id = 'exportPaywallStyles';
      style.textContent = `
        .export-paywall-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(4px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .export-paywall-modal {
          position: relative;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 1px solid rgba(0, 255, 65, 0.3);
          border-radius: 16px;
          padding: 2rem;
          max-width: 400px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }
        .export-paywall-close {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          background: none;
          border: none;
          color: #888;
          font-size: 1.5rem;
          cursor: pointer;
          line-height: 1;
        }
        .export-paywall-close:hover { color: #fff; }
        .export-paywall-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        .export-paywall-title {
          color: #fff;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 0.75rem 0;
        }
        .export-paywall-text {
          color: #aaa;
          font-size: 1rem;
          line-height: 1.5;
          margin: 0 0 1.25rem 0;
        }
        .export-paywall-features {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }
        .export-paywall-feature {
          color: #00ff41;
          font-size: 0.9rem;
          text-align: left;
          padding: 0.25rem 0;
        }
        .export-paywall-cta {
          display: inline-block;
          background: linear-gradient(135deg, #00ff41 0%, #00cc33 100%);
          color: #000;
          font-weight: 700;
          font-size: 1.1rem;
          padding: 0.875rem 2rem;
          border-radius: 8px;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .export-paywall-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 255, 65, 0.3);
        }
        .export-paywall-note {
          color: #666;
          font-size: 0.8rem;
          margin: 1rem 0 0 0;
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(paywall);
    
    const overlayEl = paywall.querySelector('.export-paywall-overlay');
    const dialogEl = paywall.querySelector('.export-paywall-modal');
    const closeBtn = paywall.querySelector('.export-paywall-close');

    const getFocusable = () => {
      const selectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ];
      return Array.from(dialogEl.querySelectorAll(selectors.join(','))).filter((el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style && style.visibility !== 'hidden' && style.display !== 'none';
      });
    };

    const cleanup = () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus && typeof previousFocus.focus === 'function' && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };

    const close = () => {
      if (!paywall.isConnected) return;
      paywall.remove();
      cleanup();
    };

    const onKeyDown = (e) => {
      if (!paywall.isConnected) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      if (e.key !== 'Tab') return;
      const focusables = getFocusable();
      if (!focusables.length) {
        e.preventDefault();
        dialogEl.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Close on click
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlayEl) {
      overlayEl.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) close();
      });
    }

    document.addEventListener('keydown', onKeyDown);
    window.requestAnimationFrame(() => {
      if (closeBtn) closeBtn.focus();
      else if (dialogEl) dialogEl.focus();
    });
  }
};

// Make available globally
window.ExportGate = ExportGate;

/**
 * Pro entitlement helper
 * Provides a single source of truth for Pro access and paywall triggers
 */
const ProAccess = {
  getEntitlement() {
    try {
      const raw = localStorage.getItem('sm_pro_entitlement');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('[ProAccess] Failed to parse entitlement', e);
      return null;
    }
  },
  normalizeDomain(domain) {
    if (!domain) return null;
    try {
      const asUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      return new URL(asUrl).hostname;
    } catch (e) {
      return domain.replace(/^https?:\/\//, '').split('/')[0];
    }
  },
  getCurrentDomain() {
    return ScanContext.getDomain() || this.normalizeDomain(window.currentSeoResults?.url || window.location.hostname);
  },
  hasProAccess(domainOverride) {
    const entitlement = this.getEntitlement();
    if (!entitlement) return false;
    const now = Date.now();
    const expires = entitlement.expiresAt ? new Date(entitlement.expiresAt).getTime() : 0;
    if (!expires || now >= expires) return false;
    const targetDomain = this.normalizeDomain(domainOverride || this.getCurrentDomain());
    const entitlementDomain = this.normalizeDomain(entitlement.domain);
    return Boolean(targetDomain && entitlementDomain && entitlementDomain === targetDomain && entitlement.token);
  },
  openProPaywall(payload = {}) {
    const { domain, context } = payload || {};
    if (window.ExportGate) {
      window.ExportGate.showPaywall();
      return;
    }
    const target = domain ? ` for ${domain}` : '';
    const area = context ? ` (${context})` : '';
    alert(`Pro Report required${target}${area}. Unlock to access this content.`);
  }
};

// Expose globally for analyzers
window.ProAccess = ProAccess;
window.hasProAccess = (...args) => ProAccess.hasProAccess(...args);
window.openProPaywall = (payload) => ProAccess.openProPaywall(payload);
