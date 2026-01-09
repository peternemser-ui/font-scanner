/**
 * Pro Report Snapshot Client
 * Captures scan snapshots for paid report generation
 * 
 * Usage:
 * After a scan completes, call ProReportSnapshot.capture(domain, scanResult)
 * This will silently save a snapshot that can be used for PDF generation.
 */

const ProReportSnapshot = (() => {
  'use strict';

  // Configuration
  const API_BASE = '/api/pro-report';
  const MAX_URLS = 10;

  /**
   * Show a non-intrusive toast notification
   * @param {string} message - Message to display
   * @param {string} type - 'success', 'error', or 'info'
   */
  function showToast(message, type = 'info') {
    // Create toast container if not exists
    let container = document.getElementById('pro-report-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pro-report-toast-container';
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'pro-report-toast';
    
    const colors = {
      success: { bg: 'rgba(0, 200, 83, 0.95)', border: '#00c853', icon: '✓' },
      error: { bg: 'rgba(244, 67, 54, 0.95)', border: '#f44336', icon: '✗' },
      info: { bg: 'rgba(33, 150, 243, 0.95)', border: '#2196f3', icon: 'ℹ' }
    };
    const color = colors[type] || colors.info;

    toast.style.cssText = `
      background: ${color.bg};
      border: 1px solid ${color.border};
      border-radius: 8px;
      padding: 12px 16px;
      color: white;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: slideIn 0.3s ease-out;
      pointer-events: auto;
      max-width: 350px;
    `;

    toast.innerHTML = `
      <span style="font-size: 16px;">${color.icon}</span>
      <span>${message}</span>
    `;

    // Add animation keyframes if not exists
    if (!document.getElementById('pro-report-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'pro-report-toast-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * Extract domain from URL
   * @param {string} url - Full URL or domain
   * @returns {string} Clean domain
   */
  function extractDomain(url) {
    if (!url) return '';
    return url.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  }

  /**
   * Extract scanned URLs from scan result
   * @param {object} scanResult - Full scan result object
   * @returns {string[]} Array of scanned URLs (max 10)
   */
  function extractScannedUrls(scanResult) {
    const urls = new Set();

    // Try to find URLs in common result structures
    if (scanResult.url) {
      urls.add(scanResult.url);
    }

    // Check for crawled pages
    if (scanResult.pages && Array.isArray(scanResult.pages)) {
      scanResult.pages.forEach(page => {
        if (page.url) urls.add(page.url);
      });
    }

    // Check basicScan structure
    if (scanResult.basicScan?.url) {
      urls.add(scanResult.basicScan.url);
    }

    // If no URLs found, construct from domain
    if (urls.size === 0 && scanResult.domain) {
      urls.add(`https://${scanResult.domain}`);
    }

    // Return max MAX_URLS
    return Array.from(urls).slice(0, MAX_URLS);
  }

  /**
   * Extract active modules from scan result
   * @param {object} scanResult - Full scan result object
   * @returns {string[]} Array of module names that were run
   */
  function extractModules(scanResult) {
    const modules = [];
    
    // Check for presence of various analyzer results
    const moduleChecks = {
      'fonts': scanResult.fonts || scanResult.basicScan?.fonts,
      'seo': scanResult.seo || scanResult.basicScan?.seo,
      'security': scanResult.security || scanResult.basicScan?.security,
      'accessibility': scanResult.accessibility || scanResult.advancedAccessibility,
      'performance': scanResult.performance || scanResult.basicScan?.performance,
      'lighthouse': scanResult.lighthouse,
      'crossBrowser': scanResult.crossBrowserTesting,
      'fontPairing': scanResult.fontPairing,
      'fontLicensing': scanResult.fontLicensing,
      'realUserMetrics': scanResult.realUserMetrics,
      'benchmarks': scanResult.benchmarkAnalysis
    };

    for (const [name, value] of Object.entries(moduleChecks)) {
      if (value && Object.keys(value).length > 0) {
        modules.push(name);
      }
    }

    return modules;
  }

  /**
   * Initialize a new purchase
   * @param {string} domain - The domain being scanned
   * @returns {Promise<{purchaseId: string, expiresAt: string}>}
   */
  async function initPurchase(domain) {
    const response = await fetch(`${API_BASE}/purchase/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: extractDomain(domain) })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Save a snapshot for a purchase
   * @param {string} purchaseId - The purchase ID
   * @param {string} domain - The domain
   * @param {string[]} selectedUrls - URLs that were scanned
   * @param {string[]} selectedModules - Modules that were run
   * @param {object} scanResult - Full scan result object
   * @returns {Promise<{ok: boolean}>}
   */
  async function saveSnapshot(purchaseId, domain, selectedUrls, selectedModules, scanResult) {
    const response = await fetch(`${API_BASE}/purchase/${purchaseId}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: extractDomain(domain),
        selectedUrls,
        selectedModules,
        scanResult
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Capture a scan snapshot (main entry point)
   * Called after scan completes with the full scan result
   * 
   * @param {string} domain - The scanned domain (URL or domain name)
   * @param {object} scanResult - The complete scan result object
   * @param {object} options - Optional settings
   * @param {boolean} options.silent - If true, don't show toast (default: false)
   * @returns {Promise<{purchaseId: string, success: boolean}>}
   */
  async function capture(domain, scanResult, options = {}) {
    const { silent = false } = options;

    if (!domain || !scanResult) {
      console.warn('[ProReportSnapshot] Missing domain or scanResult');
      return { success: false, error: 'Missing required parameters' };
    }

    try {
      console.log('[ProReportSnapshot] Initializing purchase for:', extractDomain(domain));
      
      // Step 1: Initialize purchase
      const { purchaseId, expiresAt } = await initPurchase(domain);
      console.log('[ProReportSnapshot] Purchase initialized:', purchaseId);

      // Step 2: Extract URLs and modules from scan result
      const selectedUrls = extractScannedUrls(scanResult);
      const selectedModules = extractModules(scanResult);
      
      console.log('[ProReportSnapshot] Captured URLs:', selectedUrls.length);
      console.log('[ProReportSnapshot] Captured modules:', selectedModules);

      // Step 3: Save snapshot
      await saveSnapshot(purchaseId, domain, selectedUrls, selectedModules, scanResult);
      console.log('[ProReportSnapshot] Snapshot saved successfully');

      if (!silent) {
        showToast(`Pro report snapshot saved: ${purchaseId.slice(0, 8)}...`, 'success');
      }

      return { 
        purchaseId, 
        expiresAt,
        success: true,
        urlCount: selectedUrls.length,
        moduleCount: selectedModules.length
      };

    } catch (error) {
      console.error('[ProReportSnapshot] Capture failed:', error.message);
      
      if (!silent) {
        showToast('Snapshot capture failed (non-blocking)', 'error');
      }

      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Get snapshot status for a purchase ID
   * @param {string} purchaseId - The purchase ID to check
   * @returns {Promise<object>} Status information
   */
  async function getStatus(purchaseId) {
    const response = await fetch(`${API_BASE}/purchase/${purchaseId}/status`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Public API
  return {
    capture,
    getStatus,
    extractDomain,
    showToast
  };

})();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProReportSnapshot;
}
