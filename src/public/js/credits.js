/**
 * Credits & Entitlements System
 *
 * Local storage-based credit system with report-level unlocking.
 * No accounts required - uses localStorage for persistence.
 *
 * Storage Keys:
 * - sm_credits_balance: Integer credit balance
 * - sm_unlocked_reports: JSON object map { [reportId]: { unlockedAt, method } }
 * - sm_purchase_receipts: Optional list of Stripe session IDs (for dedupe)
 * - sm_entitlements: Optional JWT tokens for signed proof
 */

if (window.CreditsManager) {
  // CreditsManager already loaded (e.g. from /assets/js/ui.js)
  // Keep this file for backwards compatibility and polyfill missing helpers.
  (function extendExistingCreditsManager() {
    const manager = window.CreditsManager;
    const STORAGE_KEYS = {
      CREDITS: 'sm_credits_balance',
      UNLOCKED: 'sm_unlocked_reports',
      RECEIPTS: 'sm_purchase_receipts',
      ENTITLEMENTS: 'sm_entitlements'
    };

    function safeParseJSON(raw, fallback) {
      try {
        const parsed = raw ? JSON.parse(raw) : fallback;
        return parsed === undefined ? fallback : parsed;
      } catch (e) {
        return fallback;
      }
    }

    function normalizeUnlockMap(map) {
      const result = {};
      if (!map || typeof map !== 'object') return result;
      Object.keys(map).forEach((reportId) => {
        const entry = map[reportId];
        if (!reportId) return;
        if (!entry || typeof entry !== 'object') {
          result[reportId] = { unlockedAt: new Date().toISOString(), method: 'single' };
          return;
        }
        const unlockedAt = typeof entry.unlockedAt === 'string' && entry.unlockedAt ? entry.unlockedAt : new Date().toISOString();
        const method = entry.method === 'credit' || entry.method === 'single' ? entry.method : 'single';
        result[reportId] = { unlockedAt, method };
      });
      return result;
    }

    function getUnlockedMap() {
      const raw = localStorage.getItem(STORAGE_KEYS.UNLOCKED);
      const parsed = safeParseJSON(raw, null);
      if (Array.isArray(parsed)) {
        const now = new Date().toISOString();
        const migrated = {};
        parsed.forEach((id) => {
          if (typeof id === 'string' && id.trim()) migrated[id.trim()] = { unlockedAt: now, method: 'single' };
        });
        const normalized = normalizeUnlockMap(migrated);
        localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify(normalized));
        return normalized;
      }
      return normalizeUnlockMap(parsed);
    }

    function setUnlockedMap(map) {
      localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify(normalizeUnlockMap(map)));
    }

    function getPurchaseReceipts() {
      const raw = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
      const parsed = safeParseJSON(raw, []);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string' && v.trim()) : [];
    }

    if (typeof manager.getPurchaseReceipts !== 'function') {
      manager.getPurchaseReceipts = getPurchaseReceipts;
    }
    if (typeof manager.hasPurchaseReceipt !== 'function') {
      manager.hasPurchaseReceipt = function hasPurchaseReceipt(sessionId) {
        const id = typeof sessionId === 'string' ? sessionId.trim() : '';
        if (!id) return false;
        return getPurchaseReceipts().includes(id);
      };
    }
    if (typeof manager.addPurchaseReceipt !== 'function') {
      manager.addPurchaseReceipt = function addPurchaseReceipt(sessionId) {
        const id = typeof sessionId === 'string' ? sessionId.trim() : '';
        if (!id) return;
        const receipts = getPurchaseReceipts();
        if (receipts.includes(id)) return;
        receipts.push(id);
        localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
      };
    }

    if (typeof manager.getCredits !== 'function') {
      manager.getCredits = function getCredits() {
        const credits = localStorage.getItem(STORAGE_KEYS.CREDITS);
        return credits ? parseInt(credits, 10) : 0;
      };
    }

    if (typeof manager.setCredits !== 'function') {
      manager.setCredits = function setCredits(amount) {
        const credits = Math.max(0, parseInt(amount, 10) || 0);
        localStorage.setItem(STORAGE_KEYS.CREDITS, credits.toString());
        window.dispatchEvent(new CustomEvent('creditsChanged', {
          detail: { balance: credits }
        }));
      };
    }

    if (typeof manager.addCredits !== 'function') {
      manager.addCredits = function addCredits(amount) {
        const current = manager.getCredits();
        const newBalance = current + Math.max(0, parseInt(amount, 10) || 0);
        manager.setCredits(newBalance);
      };
    }

    if (typeof manager.consumeCredit !== 'function') {
      manager.consumeCredit = function consumeCredit() {
        const current = manager.getCredits();
        if (current < 1) throw new Error('No credits available');
        manager.setCredits(current - 1);
        return true;
      };
    }

    if (typeof manager.isUnlocked !== 'function') {
      manager.isUnlocked = function isUnlocked(reportId) {
        if (!reportId) return false;
        const map = getUnlockedMap();
        return !!map[reportId];
      };
    }

    if (typeof manager.isReportUnlocked !== 'function') {
      manager.isReportUnlocked = function isReportUnlocked(reportId) {
        return manager.isUnlocked(reportId);
      };
    }

    if (typeof manager.unlockReport !== 'function') {
      manager.unlockReport = function unlockReport(reportId, method) {
        const id = typeof reportId === 'string' ? reportId.trim() : '';
        if (!id) return;

        const m = method === 'credit' || method === 'single' ? method : 'single';
        const map = getUnlockedMap();
        if (map[id]) return;
        map[id] = { unlockedAt: new Date().toISOString(), method: m };
        setUnlockedMap(map);

        window.dispatchEvent(new CustomEvent('reportUnlocked', {
          detail: { reportId: id, method: m }
        }));
      };
    }

    if (typeof manager.renderPaywallState !== 'function' && typeof manager.updateProUI === 'function') {
      manager.renderPaywallState = manager.updateProUI;
    }

    if (typeof manager.updateProUI !== 'function' && typeof manager.renderPaywallState === 'function') {
      manager.updateProUI = manager.renderPaywallState;
    }

    if (typeof manager.getEntitlements !== 'function') {
      manager.getEntitlements = function getEntitlements() {
        try {
          const tokens = localStorage.getItem(STORAGE_KEYS.ENTITLEMENTS);
          const list = tokens ? JSON.parse(tokens) : [];
          return Array.isArray(list) ? list : [];
        } catch (e) {
          return [];
        }
      };
    }

    if (typeof manager.addEntitlement !== 'function') {
      manager.addEntitlement = function addEntitlement(token) {
        if (!token) return;
        const tokens = manager.getEntitlements();
        if (!tokens.includes(token)) {
          tokens.push(token);
          localStorage.setItem(STORAGE_KEYS.ENTITLEMENTS, JSON.stringify(tokens));
        }
      };
    }
  })();
} else {
window.CreditsManager = (function() {
  'use strict';

  const STORAGE_KEYS = {
    CREDITS: 'sm_credits_balance',
    UNLOCKED: 'sm_unlocked_reports',
    RECEIPTS: 'sm_purchase_receipts',
    ENTITLEMENTS: 'sm_entitlements'
  };

  function safeParseJSON(raw, fallback) {
    try {
      const parsed = raw ? JSON.parse(raw) : fallback;
      return parsed === undefined ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function normalizeUnlockMap(map) {
    const result = {};
    if (!map || typeof map !== 'object') return result;
    Object.keys(map).forEach((reportId) => {
      const entry = map[reportId];
      if (!reportId) return;
      if (!entry || typeof entry !== 'object') {
        result[reportId] = { unlockedAt: new Date().toISOString(), method: 'single' };
        return;
      }
      const unlockedAt = typeof entry.unlockedAt === 'string' && entry.unlockedAt ? entry.unlockedAt : new Date().toISOString();
      const method = entry.method === 'credit' || entry.method === 'single' ? entry.method : 'single';
      result[reportId] = { unlockedAt, method };
    });
    return result;
  }

  function getUnlockedMap() {
    const raw = localStorage.getItem(STORAGE_KEYS.UNLOCKED);
    const parsed = safeParseJSON(raw, null);
    if (Array.isArray(parsed)) {
      const now = new Date().toISOString();
      const migrated = {};
      parsed.forEach((id) => {
        if (typeof id === 'string' && id.trim()) migrated[id.trim()] = { unlockedAt: now, method: 'single' };
      });
      const normalized = normalizeUnlockMap(migrated);
      localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify(normalized));
      return normalized;
    }
    return normalizeUnlockMap(parsed);
  }

  function setUnlockedMap(map) {
    localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify(normalizeUnlockMap(map)));
  }

  /**
   * Get current credit balance
   * @returns {number} Credit balance (0 if none)
   */
  function getCredits() {
    const credits = localStorage.getItem(STORAGE_KEYS.CREDITS);
    return credits ? parseInt(credits, 10) : 0;
  }

  /**
   * Set credit balance to specific amount
   * @param {number} amount - New credit balance
   */
  function setCredits(amount) {
    const credits = Math.max(0, parseInt(amount, 10) || 0);
    localStorage.setItem(STORAGE_KEYS.CREDITS, credits.toString());

    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('creditsChanged', {
      detail: { balance: credits }
    }));
  }

  /**
   * Add credits to current balance
   * @param {number} amount - Credits to add
   */
  function addCredits(amount) {
    const current = getCredits();
    const newBalance = current + Math.max(0, parseInt(amount, 10) || 0);
    setCredits(newBalance);
  }

  /**
   * Consume one credit (decrement balance)
   * @returns {boolean} True if credit was consumed, false if insufficient balance
   */
  function consumeCredit() {
    const current = getCredits();
    if (current < 1) {
      throw new Error('No credits available');
    }
    setCredits(current - 1);
    return true;
  }

  function isUnlocked(reportId) {
    if (!reportId) return false;
    const map = getUnlockedMap();
    return !!map[reportId];
  }

  /**
   * Check if a specific report is unlocked
   * @param {string} reportId - Unique report identifier
   * @returns {boolean} True if report is unlocked
   */
  function isReportUnlocked(reportId) {
    return isUnlocked(reportId);
  }

  /**
   * Unlock a specific report and persist to localStorage
   * @param {string} reportId - Unique report identifier
   */
  function unlockReport(reportId, method) {
    const id = typeof reportId === 'string' ? reportId.trim() : '';
    if (!id) return;
    const m = method === 'credit' || method === 'single' ? method : 'single';

    const map = getUnlockedMap();
    if (map[id]) return;
    map[id] = { unlockedAt: new Date().toISOString(), method: m };
    setUnlockedMap(map);

    window.dispatchEvent(new CustomEvent('reportUnlocked', {
      detail: { reportId: id, method: m }
    }));
  }

  /**
   * Get list of all unlocked reports
   * @returns {string[]} Array of unlocked reportIds
   */
  function getUnlockedReports() {
    return Object.keys(getUnlockedMap());
  }

  /**
   * Clear specific unlocked report
   * @param {string} reportId - Report to lock again
   */
  function lockReport(reportId) {
    if (!reportId) return;

    const id = typeof reportId === 'string' ? reportId.trim() : '';
    if (!id) return;
    const map = getUnlockedMap();
    if (!map[id]) return;
    delete map[id];
    setUnlockedMap(map);

    window.dispatchEvent(new CustomEvent('reportLocked', {
      detail: { reportId }
    }));
  }

  /**
   * Clear all unlocked reports
   */
  function clearUnlockedReports() {
    localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify({}));
    window.dispatchEvent(new CustomEvent('reportsCleared'));
  }

  function getPurchaseReceipts() {
    const raw = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    const parsed = safeParseJSON(raw, []);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string' && v.trim()) : [];
  }

  function hasPurchaseReceipt(sessionId) {
    const id = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!id) return false;
    return getPurchaseReceipts().includes(id);
  }

  function addPurchaseReceipt(sessionId) {
    const id = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!id) return;
    const receipts = getPurchaseReceipts();
    if (receipts.includes(id)) return;
    receipts.push(id);
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
  }

  /**
   * Get entitlement tokens (optional signed proof)
   * @returns {string[]} Array of JWT tokens
   */
  function getEntitlements() {
    try {
      const tokens = localStorage.getItem(STORAGE_KEYS.ENTITLEMENTS);
      return tokens ? JSON.parse(tokens) : [];
    } catch (e) {
      console.error('Failed to parse entitlements:', e);
      return [];
    }
  }

  /**
   * Add entitlement token
   * @param {string} token - JWT token
   */
  function addEntitlement(token) {
    if (!token) return;

    const tokens = getEntitlements();
    if (!tokens.includes(token)) {
      tokens.push(token);
      localStorage.setItem(STORAGE_KEYS.ENTITLEMENTS, JSON.stringify(tokens));
    }
  }

  /**
   * Update Pro UI for specific report
   * @param {string} reportId - Report identifier
   */
  function updateProUI(reportId) {
    const unlockEntry = (getUnlockedMap && typeof getUnlockedMap === 'function') ? (getUnlockedMap()[reportId] || null) : null;
    const isUnlocked = unlockEntry ? true : isReportUnlocked(reportId);
    const credits = getCredits();

    // Update all Pro Report Blocks on the page
    const proBlocks = document.querySelectorAll('[data-pro-report-block]');
    proBlocks.forEach(block => {
      const blockReportId = block.getAttribute('data-report-id');

      // Only update if this block is for the current report or no specific report
      if (!blockReportId || blockReportId === reportId) {
        updateBlockUI(block, unlockEntry, isUnlocked, credits);
      }
    });

    // Update credit balance displays
    updateCreditDisplays(credits);

    // Update standalone PaidUnlockCard instances (e.g., locked accordion overlays)
    updatePaidUnlockCards(unlockEntry, isUnlocked, credits);

    // Enable/disable locked actions
    updateLockedActions(reportId, isUnlocked);
  }

  function updatePaidUnlockCards(unlockEntry, isUnlocked, credits) {
    const cards = document.querySelectorAll('[data-paid-unlock-card]');
    cards.forEach((card) => {
      const creditDisplay = card.querySelector('[data-credit-balance]');
      const creditsLabel = card.querySelector('[data-credits-label]');
      const unlockBtn = card.querySelector('[data-unlock-with-credit]');
      const buyBtn = card.querySelector('[data-buy-single-report]');
      const unlockedBadge = card.querySelector('[data-unlocked-badge]');
      const unlockedMethod = card.querySelector('[data-unlocked-method]');

      if (creditDisplay) creditDisplay.textContent = credits;
      if (creditsLabel) creditsLabel.textContent = credits >= 1 ? 'Credits available:' : 'Credits:';

      if (isUnlocked) {
        if (card.hasAttribute('data-hide-when-unlocked')) {
          card.style.display = 'none';
          return;
        }

        card.style.display = '';
        if (unlockBtn) unlockBtn.style.display = 'none';
        if (buyBtn) buyBtn.style.display = 'none';
        if (unlockedBadge) unlockedBadge.style.display = 'flex';
        if (unlockedMethod) {
          unlockedMethod.textContent = unlockEntry && unlockEntry.method === 'credit' ? 'Unlocked via credit' : 'Unlocked via $10 single';
          unlockedMethod.style.display = 'block';
        }
        return;
      }

      card.style.display = '';

      if (unlockedBadge) unlockedBadge.style.display = 'none';
      if (unlockedMethod) unlockedMethod.style.display = 'none';

      if (credits >= 1) {
        if (unlockBtn) {
          unlockBtn.style.display = 'inline-flex';
          unlockBtn.disabled = false;
        }
        if (buyBtn) buyBtn.style.display = 'none';
      } else {
        if (unlockBtn) unlockBtn.style.display = 'none';
        if (buyBtn) {
          buyBtn.style.display = 'inline-flex';
          buyBtn.disabled = false;
        }
      }
    });
  }

  /**
   * Update individual Pro Report Block UI
   * @private
   */
  function updateBlockUI(block, unlockEntry, isUnlocked, credits) {
    const creditDisplay = block.querySelector('[data-credit-balance]');
    const creditsLabel = block.querySelector('[data-credits-label]');
    const unlockBtn = block.querySelector('[data-unlock-with-credit]');
    const buyBtn = block.querySelector('[data-buy-single-report]');
    const unlockedBadge = block.querySelector('[data-unlocked-badge]');
    const unlockedMethod = block.querySelector('[data-unlocked-method]');
    const lockedOverlay = block.querySelector('[data-locked-overlay]');

    // Update credit display
    if (creditDisplay) {
      creditDisplay.textContent = credits;
    }

    if (creditsLabel) {
      creditsLabel.textContent = credits >= 1 ? 'Credits available:' : 'Credits:';
    }

    if (unlockedMethod && unlockEntry) {
      unlockedMethod.textContent = unlockEntry.method === 'credit' ? 'Unlocked via credit' : 'Unlocked via $10 single';
    }

    if (isUnlocked) {
      // Report is unlocked - show unlocked state
      if (unlockBtn) unlockBtn.style.display = 'none';
      if (buyBtn) buyBtn.style.display = 'none';
      if (unlockedBadge) unlockedBadge.style.display = 'flex';
      if (unlockedMethod) unlockedMethod.style.display = 'block';
      if (lockedOverlay) lockedOverlay.style.display = 'none';

      block.classList.add('unlocked');
      block.classList.remove('locked');
    } else {
      // Report is locked - show appropriate buttons
      if (unlockedBadge) unlockedBadge.style.display = 'none';
      if (unlockedMethod) unlockedMethod.style.display = 'none';
      if (lockedOverlay) lockedOverlay.style.display = 'flex';

      if (credits >= 1) {
        // Has credits - show unlock button
        if (unlockBtn) {
          unlockBtn.style.display = 'inline-flex';
          unlockBtn.disabled = false;
        }
        if (buyBtn) buyBtn.style.display = 'none';
      } else {
        // No credits - show buy button
        if (unlockBtn) unlockBtn.style.display = 'none';
        if (buyBtn) {
          buyBtn.style.display = 'inline-flex';
          buyBtn.disabled = false;
        }
      }

      block.classList.add('locked');
      block.classList.remove('unlocked');
    }
  }

  /**
   * Update all credit balance displays on page
   * @private
   */
  function updateCreditDisplays(credits) {
    const displays = document.querySelectorAll('[data-credit-balance]');
    displays.forEach(display => {
      display.textContent = credits;
    });
  }

  /**
   * Enable or disable locked actions based on unlock status
   * @private
   */
  function updateLockedActions(reportId, isUnlocked) {
    const actions = document.querySelectorAll('[data-requires-unlock]');
    actions.forEach(action => {
      const actionReportId = action.getAttribute('data-report-id');

      if (!actionReportId || actionReportId === reportId) {
        if (isUnlocked) {
          action.disabled = false;
          action.classList.remove('disabled', 'locked');
          action.setAttribute('aria-disabled', 'false');
        } else {
          action.disabled = true;
          action.classList.add('disabled', 'locked');
          action.setAttribute('aria-disabled', 'true');
        }
      }
    });
  }

  /**
   * Generate report ID from URL and timestamp
   * @param {string} url - Website URL
   * @param {string|number} timestamp - Scan timestamp
   * @returns {string} Unique report identifier
   */
  function generateReportId(url, timestamp) {
    const cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    return `${cleanUrl}_${ts}`;
  }

  /**
   * Initialize credits system - call on page load
   */
  function init() {
    // Ensure credit balance exists
    if (localStorage.getItem(STORAGE_KEYS.CREDITS) === null) {
      setCredits(0);
    }

    // Ensure unlocked reports map exists
    if (localStorage.getItem(STORAGE_KEYS.UNLOCKED) === null) {
      localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify({}));
    }

    // Trigger migration if needed
    getUnlockedMap();

    if (localStorage.getItem(STORAGE_KEYS.RECEIPTS) === null) {
      localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify([]));
    }

    // Listen for storage events from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEYS.CREDITS || e.key === STORAGE_KEYS.UNLOCKED) {
        // Refresh UI when credits/unlocks change in another tab
        const currentReportId = document.body.getAttribute('data-report-id');
        if (currentReportId) {
          updateProUI(currentReportId);
        }
      }
    });

  }

  /**
   * Debug utility - log current state
   */
  function debugState() {
    // Debug logging removed for production
  }

  /**
   * Reset entire credits system (for testing/debugging)
   */
  function reset() {
    localStorage.removeItem(STORAGE_KEYS.CREDITS);
    localStorage.removeItem(STORAGE_KEYS.UNLOCKED);
    localStorage.removeItem(STORAGE_KEYS.ENTITLEMENTS);
    init();
  }

  // Public API
  return {
    // Core credit functions
    getCredits,
    setCredits,
    addCredits,
    consumeCredit,

    // Report unlock functions
    isUnlocked,
    isReportUnlocked,
    unlockReport,
    lockReport,
    getUnlockedReports,
    clearUnlockedReports,

    // Receipt dedupe
    getPurchaseReceipts,
    hasPurchaseReceipt,
    addPurchaseReceipt,

    // Entitlement functions
    getEntitlements,
    addEntitlement,

    // UI update function
    renderPaywallState: updateProUI,
    updateProUI,

    // Utilities
    generateReportId,
    init,
    debugState,
    reset
  };
})();

// Auto-initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.CreditsManager.init());
} else {
  window.CreditsManager.init();
}

}
