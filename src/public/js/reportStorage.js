/**
 * Report Storage - Client-side report caching and retrieval
 * Provides persistence for scan results across page loads and billing flow
 */
(function(window) {
  'use strict';

  // Translation helper
  const t = (key, fallback) => (window.t ? window.t(key, fallback) : (window.i18n && window.i18n.t ? window.i18n.t(key) || fallback : fallback));

  const STORAGE_PREFIX = 'sm_report_';
  const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get storage key for a report
   */
  function getStorageKey(reportId) {
    return `${STORAGE_PREFIX}${reportId}`;
  }

  /**
   * Save report data to localStorage
   */
  function saveReport(reportId, data, metadata = {}) {
    if (!reportId || !data) {
      console.warn('[ReportStorage] Cannot save: missing reportId or data');
      return false;
    }

    try {
      // Capture active locale so recalled reports render in the original language
      const locale = (window.i18n && typeof window.i18n.getActiveLocale === 'function')
        ? window.i18n.getActiveLocale()
        : localStorage.getItem('sm_lang') || 'en';

      const record = {
        reportId,
        data,
        metadata: {
          ...metadata,
          locale,
          savedAt: new Date().toISOString()
        }
      };

      localStorage.setItem(getStorageKey(reportId), JSON.stringify(record));
      console.log('[ReportStorage] Saved report:', reportId);
      return true;
    } catch (e) {
      console.error('[ReportStorage] Failed to save:', e);
      return false;
    }
  }

  /**
   * Load report from localStorage
   */
  function loadReport(reportId) {
    if (!reportId) return null;

    try {
      const key = getStorageKey(reportId);
      const stored = localStorage.getItem(key);

      if (!stored) {
        console.log('[ReportStorage] No stored report for:', reportId);
        return null;
      }

      const record = JSON.parse(stored);

      // Check if expired
      if (record.metadata?.savedAt) {
        const savedTime = new Date(record.metadata.savedAt).getTime();
        if (Date.now() - savedTime > CACHE_DURATION_MS) {
          console.log('[ReportStorage] Report expired:', reportId);
          localStorage.removeItem(key);
          return null;
        }
      }

      console.log('[ReportStorage] Loaded report:', reportId);
      return record;
    } catch (e) {
      console.error('[ReportStorage] Failed to load:', e);
      return null;
    }
  }

  /**
   * Try to load and display a stored report
   * @param {string} reportId - Report ID to load
   * @param {function} displayCallback - Function to call with loaded data
   * @param {object} options - Optional settings
   * @returns {Promise<boolean>} - True if report was loaded and displayed
   */
  async function tryLoadAndDisplay(reportId, displayCallback, options = {}) {
    if (!reportId || typeof displayCallback !== 'function') {
      return false;
    }

    const record = loadReport(reportId);
    if (!record || !record.data) {
      return false;
    }

    try {
      // Force the locale that was active when the report was saved
      // so the recalled report renders in its original language
      const savedLocale = record.metadata?.locale;
      if (savedLocale && window.i18n && typeof window.i18n.forceLocale === 'function') {
        await window.i18n.forceLocale(savedLocale);
      }

      console.log('[ReportStorage] Displaying stored report:', reportId, savedLocale ? `(locale: ${savedLocale})` : '');
      await displayCallback(record.data);

      // Show banner if requested
      if (options.showBanner !== false && record.metadata) {
        showStoredReportBanner(record.metadata);
      }

      return true;
    } catch (e) {
      console.error('[ReportStorage] Display callback failed:', e);
      return false;
    }
  }

  /**
   * Auto-save report to browser storage
   * Now saves ALL scans (not just Pro/purchased) so users can access recent scans
   * Note: This is browser-local storage, not server-side. Only purchased reports appear on dashboard.
   */
  function autoSaveIfEligible(reportId, data, metadata = {}) {
    if (!reportId || !data) return false;

    // Check if user has paid access (Pro or purchased)
    const billingStatus = window.__cachedBillingStatus;
    const isPro = billingStatus?.plan === 'pro' || billingStatus?.plan === 'day_pass';
    const isPurchased = billingStatus?.purchasedReports?.includes(reportId);

    // Save ALL reports to browser storage for better UX
    // This allows users to revisit recent scans within the same browser
    const source = isPro ? 'pro' : isPurchased ? 'purchased' : 'free';

    console.log('[ReportStorage] Saving report to browser storage', { reportId, source, isPro, isPurchased });

    return saveReport(reportId, data, {
      ...metadata,
      autoSaved: true,
      source
    });
  }

  /**
   * Save report before checkout (ensures data persists through billing flow)
   */
  async function saveBeforeCheckout(reportId, data, metadata = {}) {
    if (!reportId || !data) {
      console.warn('[ReportStorage] saveBeforeCheckout: missing data');
      return false;
    }

    return saveReport(reportId, data, {
      ...metadata,
      preCheckout: true
    });
  }

  /**
   * Show banner indicating report was loaded from storage
   */
  function showStoredReportBanner(metadata) {
    if (!metadata?.savedAt) return;

    // Defer until i18n translations are loaded (avoids English fallback on race condition)
    if (window.i18n && !window.i18n.initialized) {
      window.addEventListener('languageChanged', () => showStoredReportBanner(metadata), { once: true });
      return;
    }

    const savedAt = new Date(metadata.savedAt);
    const timeAgo = getTimeAgo(savedAt);

    // Check if banner already exists
    if (document.getElementById('stored-report-banner')) return;

    // Remove payment success banner if present (avoids duplicate alerts)
    const paymentBanner = document.getElementById('sm-payment-success-banner');
    if (paymentBanner) paymentBanner.remove();

    const banner = document.createElement('div');
    banner.id = 'stored-report-banner';
    banner.className = 'stored-report-banner';
    banner.innerHTML = `
      <span class="banner-icon">📋</span>
      <span class="banner-text">${t('reports.common.showingSavedReport', 'Showing saved report from')} ${timeAgo}</span>
      <button class="banner-refresh" title="${t('reports.common.runNewScan', 'Run New Scan')}">↻ ${t('reports.common.refresh', 'Refresh')}</button>
      <button class="banner-close" title="${t('common.close', 'Close')}">&times;</button>
    `;

    // Add styles if not present
    if (!document.getElementById('stored-report-banner-styles')) {
      const styles = document.createElement('style');
      styles.id = 'stored-report-banner-styles';
      styles.textContent = `
        .stored-report-banner {
          position: fixed;
          top: 190px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.4rem 0.8rem;
          background: #1a2332;
          border: 1px solid rgba(91, 244, 231, 0.4);
          border-radius: 10px;
          font-size: 0.925rem;
          color: #fff;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }
        body.white-theme .stored-report-banner {
          background: #ffffff;
          border-color: rgba(221, 56, 56, 0.3);
          color: #1a1a1a;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }
        .stored-report-banner .banner-icon { font-size: 1.5em; }
        .stored-report-banner .banner-text { font-weight: 600; }
        .stored-report-banner .banner-refresh,
        .stored-report-banner .banner-close {
          background: none;
          border: none;
          color: var(--accent-primary, #5bf4e7);
          cursor: pointer;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 600;
          transition: background 0.2s;
        }
        .stored-report-banner .banner-refresh:hover,
        .stored-report-banner .banner-close:hover {
          background: rgba(91, 244, 231, 0.15);
        }
        body.white-theme .stored-report-banner .banner-refresh,
        body.white-theme .stored-report-banner .banner-close {
          color: var(--accent-primary, #dd3838);
        }
        body.white-theme .stored-report-banner .banner-refresh:hover,
        body.white-theme .stored-report-banner .banner-close:hover {
          background: rgba(221, 56, 56, 0.1);
        }
        .stored-report-banner .banner-close { font-size: 1.2em; }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(banner);

    // Event listeners
    banner.querySelector('.banner-refresh')?.addEventListener('click', () => {
      banner.remove();
      location.reload();
    });
    banner.querySelector('.banner-close')?.addEventListener('click', () => {
      banner.remove();
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (banner.parentNode) {
        banner.style.opacity = '0';
        banner.style.transition = 'opacity 0.3s';
        setTimeout(() => banner.remove(), 300);
      }
    }, 10000);
  }

  /**
   * Get human-readable time ago string
   */
  function getTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return t('common.time.justNow', 'Just now');
    if (seconds < 3600) return t('common.time.minutesAgo', '{{count}} minutes ago').replace('{{count}}', Math.floor(seconds / 60));
    if (seconds < 86400) return t('common.time.hoursAgo', '{{count}} hours ago').replace('{{count}}', Math.floor(seconds / 3600));
    return t('common.time.daysAgo', '{{count}} days ago').replace('{{count}}', Math.floor(seconds / 86400));
  }

  /**
   * Clear all stored reports
   */
  function clearAll() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
    console.log('[ReportStorage] Cleared', keys.length, 'stored reports');
    return keys.length;
  }

  /**
   * Clear expired reports
   */
  function clearExpired() {
    let cleared = 0;
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));

    keys.forEach(key => {
      try {
        const record = JSON.parse(localStorage.getItem(key));
        if (record?.metadata?.savedAt) {
          const savedTime = new Date(record.metadata.savedAt).getTime();
          if (Date.now() - savedTime > CACHE_DURATION_MS) {
            localStorage.removeItem(key);
            cleared++;
          }
        }
      } catch (e) {
        // Remove corrupted entries
        localStorage.removeItem(key);
        cleared++;
      }
    });

    console.log('[ReportStorage] Cleared', cleared, 'expired reports');
    return cleared;
  }

  /**
   * Show banner indicating report data is unavailable and needs re-scan
   * @param {object} options - Banner options
   * @param {string} options.url - The URL to pre-fill for re-scanning
   * @param {string} options.analyzerType - Type of analyzer (e.g., 'security', 'seo')
   * @param {function} options.onRescan - Callback when user clicks re-scan button
   */
  function showReportUnavailableBanner(options = {}) {
    const { url, analyzerType, onRescan } = options;

    // Defer until i18n translations are loaded (avoids English fallback on race condition)
    if (window.i18n && !window.i18n.initialized) {
      window.addEventListener('languageChanged', () => showReportUnavailableBanner(options), { once: true });
      return;
    }

    // Check if banner already exists
    if (document.getElementById('report-unavailable-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'report-unavailable-banner';
    banner.className = 'report-unavailable-banner';

    const analyzerLabel = analyzerType
      ? analyzerType.charAt(0).toUpperCase() + analyzerType.slice(1)
      : 'Report';

    banner.innerHTML = `
      <div class="banner-content">
        <span class="banner-icon">⚠️</span>
        <div class="banner-message">
          <strong>${t('reports.storage.dataUnavailable', 'Report data unavailable')}</strong>
          <p>${t('reports.storage.dataExpired', 'The saved report data has expired or was cleared from your browser.')} ${url ? t('reports.storage.clickToRescan', 'Click below to run a fresh scan.') : t('reports.storage.pleaseRescan', 'Please run a new scan.')}</p>
        </div>
      </div>
      <div class="banner-actions">
        ${url ? `<button class="banner-rescan" title="Run new ${analyzerLabel} scan">🔄 Re-scan ${url.length > 40 ? url.substring(0, 40) + '...' : url}</button>` : ''}
        <button class="banner-close" title="${t('reports.storage.dismissTitle', 'Dismiss and start fresh')}">✕ Dismiss</button>
      </div>
    `;

    // Add styles if not present
    if (!document.getElementById('report-unavailable-banner-styles')) {
      const styles = document.createElement('style');
      styles.id = 'report-unavailable-banner-styles';
      styles.textContent = `
        .report-unavailable-banner {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 2rem;
          background: #1a2332;
          border: 2px solid rgba(255, 165, 0, 0.6);
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          color: #fff;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }
        body.white-theme .report-unavailable-banner {
          background: #ffffff;
          border-color: rgba(255, 165, 0, 0.6);
          color: #1a1a1a;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        .report-unavailable-banner .banner-content {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
        }
        .report-unavailable-banner .banner-icon {
          font-size: 2rem;
          flex-shrink: 0;
        }
        .report-unavailable-banner .banner-message {
          flex: 1;
        }
        .report-unavailable-banner .banner-message strong {
          display: block;
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
          color: #ffa500;
        }
        .report-unavailable-banner .banner-message p {
          margin: 0;
          font-size: 0.95rem;
          color: var(--text-secondary, #9ca3af);
          line-height: 1.5;
        }
        .report-unavailable-banner .banner-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .report-unavailable-banner .banner-rescan {
          background: var(--accent-primary, #5bf4e7);
          border: none;
          color: #1a1a1a;
          cursor: pointer;
          padding: 0.75rem 1.25rem;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 600;
          transition: all 0.2s;
          flex: 1;
          min-width: 200px;
          text-align: center;
        }
        .report-unavailable-banner .banner-rescan:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .report-unavailable-banner .banner-close {
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: #fff;
          cursor: pointer;
          padding: 0.75rem 1.25rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          transition: all 0.2s;
        }
        body.white-theme .report-unavailable-banner .banner-close {
          background: rgba(0, 0, 0, 0.05);
          border-color: rgba(0, 0, 0, 0.1);
        }
        .report-unavailable-banner .banner-close:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        body.white-theme .report-unavailable-banner .banner-close:hover {
          background: rgba(0, 0, 0, 0.1);
        }
        .report-unavailable-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 9999;
        }
      `;
      document.head.appendChild(styles);
    }

    // Add overlay
    const overlay = document.createElement('div');
    overlay.id = 'report-unavailable-overlay';
    overlay.className = 'report-unavailable-overlay';
    document.body.appendChild(overlay);
    document.body.appendChild(banner);

    // Event listeners
    const closeModal = () => {
      banner.remove();
      overlay.remove();
    };

    // Clean up report_id from URL to prevent banner from showing again on refresh
    const cleanUrl = new URL(window.location.href);
    if (cleanUrl.searchParams.has('report_id')) {
      cleanUrl.searchParams.delete('report_id');
      window.history.replaceState({}, document.title, cleanUrl.toString());
    }

    overlay.addEventListener('click', closeModal);
    banner.querySelector('.banner-close')?.addEventListener('click', closeModal);

    const rescanBtn = banner.querySelector('.banner-rescan');
    if (rescanBtn) {
      rescanBtn.addEventListener('click', () => {
        closeModal();
        // Pre-fill URL input if available
        const urlInput = document.getElementById('urlInput');
        if (urlInput && url) {
          urlInput.value = url;
        }
        // Trigger rescan callback if provided
        if (typeof onRescan === 'function') {
          onRescan(url);
        } else if (url) {
          // Default: click the analyze button
          const analyzeBtn = document.getElementById('analyzeButton');
          if (analyzeBtn) {
            analyzeBtn.click();
          }
        }
      });
    }

    console.log('[ReportStorage] Showing report unavailable banner', { url, analyzerType });
  }

  // Clean up expired reports on load
  try {
    clearExpired();
  } catch (e) {
    console.warn('[ReportStorage] Cleanup failed:', e);
  }

  // Expose API
  window.ReportStorage = {
    saveReport,
    loadReport,
    tryLoadAndDisplay,
    autoSaveIfEligible,
    saveBeforeCheckout,
    showStoredReportBanner,
    showReportUnavailableBanner,
    clearAll,
    clearExpired
  };

})(window);
