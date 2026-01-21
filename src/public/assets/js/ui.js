/**
 * Site Mechanic - Local Credits + Unlock State (No accounts)
 *
 * Storage Keys:
 * - sm_credits_balance → integer
 * - sm_unlocked_reports → JSON object map { [reportId]: { unlockedAt, method } }
 * - sm_purchase_receipts → optional list of Stripe session IDs (for dedupe)
 *
 * Notes:
 * - Backward compatible with older array-based sm_unlocked_reports values.
 * - Exposes a single global module via window.CreditsManager and window.PaywallState.
 */

(function(window) {
  'use strict';

  const STORAGE_KEYS = {
    CREDITS: 'sm_credits_balance',
    UNLOCKED: 'sm_unlocked_reports',
    RECEIPTS: 'sm_purchase_receipts',
    // Still supported for existing billing flows.
    ENTITLEMENTS: 'sm_entitlements'
  };

  // Demo domains that get free pro reports (for product review/testing)
  const DEMO_DOMAINS = ['vail.com', 'www.vail.com'];

  /**
   * Check if current URL input matches a demo domain
   * @returns {boolean} True if analyzing a demo domain
   */
  function isDemoDomain() {
    let hostname = null;

    // Try URL input fields first
    try {
      const urlInput = document.getElementById('url') || document.getElementById('urlInput');
      if (urlInput && urlInput.value) {
        const url = urlInput.value.startsWith('http') ? urlInput.value : 'https://' + urlInput.value;
        hostname = new URL(url).hostname.toLowerCase();
      }
    } catch (e) {}

    // Fallback to ScanContext if available
    if (!hostname && window.ScanContext && typeof window.ScanContext.getDomain === 'function') {
      try {
        const domain = window.ScanContext.getDomain();
        if (domain) hostname = domain.toLowerCase();
      } catch (e) {}
    }

    // Fallback to ProAccess.getCurrentDomain if available
    if (!hostname && window.ProAccess && typeof window.ProAccess.getCurrentDomain === 'function') {
      try {
        const domain = window.ProAccess.getCurrentDomain();
        if (domain) hostname = domain.toLowerCase();
      } catch (e) {}
    }

    if (!hostname) return false;
    return DEMO_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  }

  function safeParseJSON(raw, fallback) {
    try {
      const parsed = raw ? JSON.parse(raw) : fallback;
      return parsed === undefined ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function asInt(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function getCredits() {
    const credits = localStorage.getItem(STORAGE_KEYS.CREDITS);
    return Math.max(0, asInt(credits));
  }

  function setCredits(n) {
    const credits = Math.max(0, asInt(n));
    localStorage.setItem(STORAGE_KEYS.CREDITS, credits.toString());
    window.dispatchEvent(new CustomEvent('creditsChanged', {
      detail: { balance: credits }
    }));
  }

  function addCredits(n) {
    const delta = Math.max(0, asInt(n));
    setCredits(getCredits() + delta);
  }

  function consumeCredit() {
    const current = getCredits();
    if (current < 1) {
      throw new Error('No credits available');
    }
    setCredits(current - 1);
    return true;
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
    if (!raw) return {};

    const parsed = safeParseJSON(raw, null);

    // Back-compat: older versions stored an array of reportIds.
    if (Array.isArray(parsed)) {
      const now = new Date().toISOString();
      const migrated = {};
      parsed.forEach((id) => {
        if (typeof id === 'string' && id.trim()) {
          migrated[id.trim()] = { unlockedAt: now, method: 'single' };
        }
      });
      const normalized = normalizeUnlockMap(migrated);
      localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify(normalized));
      return normalized;
    }

    return normalizeUnlockMap(parsed);
  }

  function setUnlockedMap(map) {
    const normalized = normalizeUnlockMap(map);
    localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify(normalized));
  }

  function isUnlocked(reportId) {
    // Auto-unlock for demo domains (e.g., vail.com)
    if (isDemoDomain()) return true;
    if (!reportId) return false;
    const map = getUnlockedMap();
    return !!map[reportId];
  }

  function getUnlockEntry(reportId) {
    if (!reportId) return null;
    const map = getUnlockedMap();
    return map[reportId] || null;
  }

  function formatUnlockMethod(entry) {
    if (!entry || typeof entry !== 'object') return '';
    if (entry.method === 'credit') return 'Unlocked via credit';
    if (entry.method === 'single') return 'Unlocked via $10 single';
    return '';
  }

  function unlockReport(reportId, method) {
    const id = typeof reportId === 'string' ? reportId.trim() : '';
    if (!id) return;

    const m = method === 'credit' || method === 'single' ? method : 'single';
    const map = getUnlockedMap();
    if (map[id]) return;

    map[id] = {
      unlockedAt: new Date().toISOString(),
      method: m
    };
    setUnlockedMap(map);

    window.dispatchEvent(new CustomEvent('reportUnlocked', {
      detail: { reportId: id, method: m }
    }));
  }

  function lockReport(reportId) {
    const id = typeof reportId === 'string' ? reportId.trim() : '';
    if (!id) return;
    const map = getUnlockedMap();
    if (!map[id]) return;
    delete map[id];
    setUnlockedMap(map);
    window.dispatchEvent(new CustomEvent('reportLocked', {
      detail: { reportId: id }
    }));
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

  function getEntitlements() {
    const raw = localStorage.getItem(STORAGE_KEYS.ENTITLEMENTS);
    const parsed = safeParseJSON(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function addEntitlement(token) {
    if (!token) return;
    const list = getEntitlements();
    if (list.includes(token)) return;
    list.push(token);
    localStorage.setItem(STORAGE_KEYS.ENTITLEMENTS, JSON.stringify(list));
  }

  function updateCreditDisplays(credits) {
    const displays = document.querySelectorAll('[data-credit-balance]');
    displays.forEach(display => {
      display.textContent = credits;
    });
  }

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

  function updatePaidUnlockCards(reportId, unlockEntry, credits) {
    const unlocked = !!unlockEntry;
    const cards = document.querySelectorAll('[data-paid-unlock-card]');
    cards.forEach((card) => {
      const creditDisplay = card.querySelector('[data-credit-balance]');
      const creditsLabel = card.querySelector('[data-credits-label]');
      const unlockBtn = card.querySelector('[data-unlock-with-credit]');
      const buyBtn = card.querySelector('[data-buy-single-report]');
      const unlockedMethod = card.querySelector('[data-unlocked-method]');
      const unlockedBadge = card.querySelector('[data-unlocked-badge]');

      if (creditDisplay) creditDisplay.textContent = credits;
      if (creditsLabel) creditsLabel.textContent = credits >= 1 ? 'Credits available:' : 'Credits:';

      if (unlocked) {
        if (card.hasAttribute('data-hide-when-unlocked')) {
          card.style.display = 'none';
          return;
        }

        card.style.display = '';
        if (unlockBtn) unlockBtn.style.display = 'none';
        if (buyBtn) buyBtn.style.display = 'none';
        if (unlockedBadge) unlockedBadge.style.display = 'flex';
        if (unlockedMethod) {
          unlockedMethod.textContent = formatUnlockMethod(unlockEntry);
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

  function updateBlockUI(block, unlockEntry, credits) {
    const unlocked = !!unlockEntry;
    const creditDisplay = block.querySelector('[data-credit-balance]');
    const creditsLabel = block.querySelector('[data-credits-label]');
    const unlockBtn = block.querySelector('[data-unlock-with-credit]');
    const buyBtn = block.querySelector('[data-buy-single-report]');
    const unlockedBadge = block.querySelector('[data-unlocked-badge]');
    const unlockedMethod = block.querySelector('[data-unlocked-method]');
    const lockedOverlay = block.querySelector('[data-locked-overlay]');

    if (creditDisplay) {
      creditDisplay.textContent = credits;
    }

    if (creditsLabel) {
      creditsLabel.textContent = credits >= 1 ? 'Credits available:' : 'Credits:';
    }

    if (unlocked) {
      if (unlockBtn) unlockBtn.style.display = 'none';
      if (buyBtn) buyBtn.style.display = 'none';
      if (unlockedBadge) unlockedBadge.style.display = 'flex';
      if (unlockedMethod) {
        unlockedMethod.textContent = formatUnlockMethod(unlockEntry);
        unlockedMethod.style.display = 'block';
      }
      if (lockedOverlay) lockedOverlay.style.display = 'none';

      block.classList.add('unlocked');
      block.classList.remove('locked');
      return;
    }

    if (unlockedBadge) unlockedBadge.style.display = 'none';
    if (unlockedMethod) unlockedMethod.style.display = 'none';
    if (lockedOverlay) lockedOverlay.style.display = 'flex';

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

    block.classList.add('locked');
    block.classList.remove('unlocked');
  }

  function renderPaywallState(reportId) {
    const unlockEntry = getUnlockEntry(reportId);
    const unlocked = !!unlockEntry;
    const credits = getCredits();

    updatePaidUnlockCards(reportId, unlockEntry, credits);

    const proBlocks = document.querySelectorAll('[data-pro-report-block]');
    proBlocks.forEach(block => {
      const blockReportId = block.getAttribute('data-report-id');
      if (!blockReportId || blockReportId === reportId) {
        updateBlockUI(block, unlockEntry, credits);
      }
    });

    updateCreditDisplays(credits);
    updateLockedActions(reportId, unlocked);
  }

  function init() {
    if (localStorage.getItem(STORAGE_KEYS.CREDITS) === null) {
      setCredits(0);
    }

    if (localStorage.getItem(STORAGE_KEYS.UNLOCKED) === null) {
      localStorage.setItem(STORAGE_KEYS.UNLOCKED, JSON.stringify({}));
    }

    // Trigger migration if needed.
    getUnlockedMap();

    if (localStorage.getItem(STORAGE_KEYS.RECEIPTS) === null) {
      localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify([]));
    }

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEYS.CREDITS || e.key === STORAGE_KEYS.UNLOCKED) {
        const currentReportId = document.body.getAttribute('data-report-id');
        if (currentReportId) {
          renderPaywallState(currentReportId);
        }
      }
    });
  }

  const api = {
    // Required helpers
    getCredits,
    setCredits,
    addCredits,
    consumeCredit,
    isUnlocked,
    isDemoDomain,
    getUnlockEntry,
    unlockReport,
    renderPaywallState,

    // Optional receipt dedupe helpers
    getPurchaseReceipts,
    hasPurchaseReceipt,
    addPurchaseReceipt,

    // Existing billing flow helpers (kept)
    getEntitlements,
    addEntitlement,

    // Back-compat aliases
    isReportUnlocked: isUnlocked,
    updateProUI: renderPaywallState,
    getUnlockedReports: () => Object.keys(getUnlockedMap()),
    lockReport,
    init,

    __smPaywallV2: true
  };

  window.PaywallState = api;
  window.CreditsManager = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.CreditsManager.init());
  } else {
    window.CreditsManager.init();
  }
})(window);
