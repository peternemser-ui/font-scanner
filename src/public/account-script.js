/**
 * Report Library Script v2
 * Manages report history with search/filter, compare mode, and account settings
 */

// ============================================
// i18n HELPER
// ============================================

function t(key, fallback) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    const result = window.i18n.t(key);
    // If the result equals the key, the translation wasn't found - use fallback
    if (result === key || !result) {
      return fallback;
    }
    return result;
  }
  return fallback;
}

// ============================================
// STATE
// ============================================

let billingStatus = null;
let allReports = [];
let filteredReports = [];
let currentPage = 1;
let compareMode = false;
const selectedForCompare = new Set();
const REPORTS_PER_PAGE = 20;
const MAX_COMPARE = 2;

// Report type mappings
const REPORT_TYPE_MAP = {
  'full': { label: 'Full Scan', category: 'full' },
  'seo': { label: 'SEO', category: 'seo' },
  'seo-analyzer': { label: 'SEO', category: 'seo' },
  'accessibility': { label: 'Accessibility', category: 'accessibility' },
  'accessibility-analyzer': { label: 'Accessibility', category: 'accessibility' },
  'performance': { label: 'Performance', category: 'performance' },
  'performance-hub': { label: 'Performance', category: 'performance' },
  'speed-ux-pro': { label: 'Speed & UX', category: 'performance' },
  'speed-ux-quick': { label: 'Speed & UX', category: 'performance' },
  'speed-ux-cwv': { label: 'Speed & UX - CWV', category: 'performance' },
  'speed-ux-full': { label: 'Lighthouse', category: 'performance' },
  'security': { label: 'Security', category: 'security' },
  'security-analyzer': { label: 'Security', category: 'security' },
  'tag-intelligence': { label: 'Tag Intelligence', category: 'tag-intelligence' },
  'cwv': { label: 'Core Web Vitals', category: 'cwv' },
  'core-web-vitals': { label: 'Core Web Vitals', category: 'cwv' },
  'fonts': { label: 'Fonts', category: 'fonts' },
  'enhanced-fonts': { label: 'Fonts & Typography', category: 'fonts' },
  'brand': { label: 'Brand', category: 'brand' },
  'brand-consistency': { label: 'Brand & Design', category: 'brand' },
  'cro': { label: 'CRO', category: 'cro' },
  'cro-analyzer': { label: 'CRO', category: 'cro' },
  'cro-analysis': { label: 'CRO', category: 'cro' },
  'mobile': { label: 'Mobile', category: 'mobile' },
  'mobile-analyzer': { label: 'Mobile', category: 'mobile' },
  'ip-reputation': { label: 'IP Reputation', category: 'ip-reputation' },
  'ip-reputation-analyzer': { label: 'IP Reputation', category: 'ip-reputation' },
  'gdpr': { label: 'Privacy', category: 'gdpr' },
  'gdpr-compliance': { label: 'Privacy Compliance', category: 'gdpr' },
  'competitive': { label: 'Competitive', category: 'competitive' },
  'competitive-analysis': { label: 'Competitive Analysis', category: 'competitive' },
  'geo-seo': { label: 'GEO SEO', category: 'geo-seo' },
  'local-seo': { label: 'GEO SEO', category: 'geo-seo' },
  'broken-links': { label: 'Broken Links', category: 'broken-links' },
  'site-crawler': { label: 'Site Crawler', category: 'site-crawler' }
};

// Analyzer page mappings
const ANALYZER_PAGES = {
  'seo': '/seo-analyzer.html',
  'seo-analyzer': '/seo-analyzer.html',
  'security': '/security-analyzer.html',
  'security-analyzer': '/security-analyzer.html',
  'accessibility': '/accessibility-analyzer.html',
  'accessibility-analyzer': '/accessibility-analyzer.html',
  'performance': '/performance-hub.html',
  'performance-hub': '/performance-hub.html',
  'speed-ux-pro': '/performance-hub.html',
  'speed-ux-quick': '/performance-hub.html',
  'speed-ux-cwv': '/performance-hub.html',
  'speed-ux-full': '/performance-hub.html',
  'tag-intelligence': '/tag-intelligence.html',
  'cwv': '/core-web-vitals.html',
  'core-web-vitals': '/core-web-vitals.html',
  'ip-reputation': '/ip-reputation-analyzer.html',
  'ip-reputation-analyzer': '/ip-reputation-analyzer.html',
  'mobile': '/mobile-analyzer.html',
  'mobile-analyzer': '/mobile-analyzer.html',
  'cro': '/cro-analyzer.html',
  'cro-analyzer': '/cro-analyzer.html',
  'cro-analysis': '/cro-analyzer.html',
  'gdpr': '/gdpr-compliance.html',
  'gdpr-compliance': '/gdpr-compliance.html',
  'fonts': '/enhanced-fonts.html',
  'enhanced-fonts': '/enhanced-fonts.html',
  'brand': '/brand-consistency.html',
  'brand-consistency': '/brand-consistency.html',
  'competitive': '/competitive-analysis.html',
  'competitive-analysis': '/competitive-analysis.html',
  'geo-seo': '/geo-seo.html',
  'local-seo': '/geo-seo.html',
  'broken-links': '/broken-links.html',
  'site-crawler': '/site-crawler.html'
};

// ============================================
// BROWSER STORAGE HELPERS
// ============================================

/**
 * Load recent reports from browser storage (IndexedDB)
 * These are scans that were saved locally but may not be purchased
 */
async function loadBrowserStoredReports() {
  try {
    // Use the same IndexedDB that ReportStorage uses
    const DB_NAME = 'SiteMechanicReports';
    const DB_VERSION = 1;
    const STORE_NAME = 'reports';

    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.warn('[Account] Could not open IndexedDB for browser reports');
        resolve([]);
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve([]);
          return;
        }

        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          const records = getAllRequest.result || [];
          const reports = records
            .filter(r => r && r.reportId && r.metadata)
            .map(r => ({
              reportId: r.reportId,
              siteUrl: r.metadata?.siteUrl || '',
              siteUrlNormalized: normalizeDomain(r.metadata?.siteUrl || ''),
              analyzerType: r.metadata?.analyzerType || 'unknown',
              reportTypeLabel: getReportTypeLabel(r.metadata?.analyzerType || 'unknown'),
              reportTypeCategory: getReportTypeCategory(r.metadata?.analyzerType || 'unknown'),
              purchasedAt: r.metadata?.scannedAt || r.savedAt,
              purchasedAtDate: safeParseDate(r.metadata?.scannedAt || r.savedAt) || new Date(0),
              accessLevel: r.metadata?.source === 'pro' ? 'pro' : r.metadata?.source === 'purchased' ? 'purchased' : 'browser',
              isBrowserStored: true
            }));

          // Sort by date and limit to recent 50
          reports.sort((a, b) => b.purchasedAtDate - a.purchasedAtDate);
          resolve(reports.slice(0, 50));
        };

        getAllRequest.onerror = () => {
          console.warn('[Account] Failed to read browser reports');
          resolve([]);
        };
      };
    });
  } catch (e) {
    console.warn('[Account] Error loading browser stored reports:', e);
    return [];
  }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  if (!proManager.isAuthenticated()) {
    window.location.href = '/auth.html';
    return;
  }

  await handleBillingReturn();
  initializeUIComponents();
  initStickyToolbar();
  initCompareMode();

  await Promise.all([
    loadUserData(),
    loadBillingStatus()
  ]);

  renderReports();
});

// Re-render reports when language changes
window.addEventListener('languageChanged', () => {
  renderReports();
});

async function handleBillingReturn() {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get('billing_success') === 'true') {
    if (window.ProReportBlock?.clearBillingCache) {
      window.ProReportBlock.clearBillingCache();
    }

    const sessionId = urlParams.get('session_id');
    if (sessionId) {
      const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
      if (token) {
        try {
          await fetch('/api/billing/verify-purchase', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ session_id: sessionId })
          });
        } catch (e) {
          console.warn('Failed to verify purchase:', e);
        }
      }
    }

    showSuccess('Payment successful! Your plan has been updated.');
    cleanUrl(['billing_success', 'session_id']);
  } else if (urlParams.get('billing_canceled') === 'true') {
    showError('Checkout was canceled. No charges were made.');
    cleanUrl(['billing_canceled']);
  } else if (urlParams.get('success') === 'true') {
    showSuccess('Payment successful! Your Pro features are now active.');
    cleanUrl(['success']);
  }
}

function cleanUrl(params) {
  const urlParams = new URLSearchParams(window.location.search);
  params.forEach(p => urlParams.delete(p));
  const newUrl = urlParams.toString()
    ? `${window.location.pathname}?${urlParams.toString()}`
    : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

function initializeUIComponents() {
  // Search with debounce
  const searchInput = document.getElementById('reportSearch');
  if (searchInput) {
    const searchWrapper = searchInput.closest('.toolbar__search');
    const updateSearchExpansion = () => {
      if (!searchWrapper) return;
      const hasValue = searchInput.value.trim().length > 0;
      const isFocused = document.activeElement === searchInput;
      searchWrapper.classList.toggle('toolbar__search--expanded', hasValue || isFocused);
    };

    let debounceTimer;
    searchInput.addEventListener('input', () => {
      updateSearchExpansion();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentPage = 1;
        applyFilters();
        updateClearButton();
      }, 200);
    });

    searchInput.addEventListener('focus', updateSearchExpansion);
    searchInput.addEventListener('blur', updateSearchExpansion);
    updateSearchExpansion();
  }

  // Filters
  ['filterType', 'filterAccess', 'filterDate', 'sortBy'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        currentPage = 1;
        applyFilters();
        updateClearButton();
      });
    }
  });

  // Mobile filters toggle
  const filtersToggle = document.getElementById('filtersToggle');
  const filtersPanel = document.getElementById('filtersPanel');
  if (filtersToggle && filtersPanel) {
    filtersToggle.addEventListener('click', () => {
      const expanded = filtersPanel.classList.toggle('active');
      filtersToggle.setAttribute('aria-expanded', expanded);
    });
  }

  // Clear filters
  const clearBtn = document.getElementById('clearFiltersBtn');
  const clearBtn2 = document.getElementById('clearFiltersBtn2');
  if (clearBtn) clearBtn.addEventListener('click', clearFilters);
  if (clearBtn2) clearBtn2.addEventListener('click', clearFilters);

  // Refresh button
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', handleRefresh);
  }

  // Load more
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      currentPage++;
      renderSiteGroups(false);
    });
  }

  // Account dropdown (trigger + panel)
  const accountTrigger = document.getElementById('accountTrigger');
  const accountSidebar = document.querySelector('.reports-sidebar');

  function openAccountPopover() {
    if (!accountSidebar || !accountTrigger) return;
    accountSidebar.classList.add('popover-open');
    accountTrigger.setAttribute('aria-expanded', 'true');
  }

  function closeAccountPopover() {
    if (!accountSidebar || !accountTrigger) return;
    accountSidebar.classList.remove('popover-open');
    accountTrigger.setAttribute('aria-expanded', 'false');
  }

  function isAccountPopoverOpen() {
    return accountSidebar && accountSidebar.classList.contains('popover-open');
  }

  if (accountTrigger) {
    accountTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      isAccountPopoverOpen() ? closeAccountPopover() : openAccountPopover();
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (isAccountPopoverOpen() && !e.target.closest('.account-dropdown-wrapper')) {
      closeAccountPopover();
    }
  });

  // Esc to close dropdown
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isAccountPopoverOpen()) {
      e.stopPropagation();
      closeAccountPopover();
      accountTrigger.focus();
    }
  });

  // Focus trap within popover
  if (accountSidebar) {
    accountSidebar.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !isAccountPopoverOpen()) return;
      const focusable = accountSidebar.querySelectorAll('button, a, input, select, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  // Legacy: keep panel header click as no-op (panel body always visible in popover)
  const accountPanelHeader = document.getElementById('accountPanelHeader');
  if (accountPanelHeader) {
    accountPanelHeader.removeAttribute('role');
    accountPanelHeader.removeAttribute('tabindex');
    accountPanelHeader.style.cursor = 'default';
  }

  // Upgrade button
  const upgradeBtn = document.getElementById('upgradeBtn');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', handleUpgradeClick);
  }

  // Manage billing
  const manageSubBtn = document.getElementById('manageSubBtn');
  if (manageSubBtn) {
    manageSubBtn.addEventListener('click', handleManageBilling);
  }

  // Password modal
  initPasswordModal();

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

// ============================================
// STICKY TOOLBAR
// ============================================

function initStickyToolbar() {
  const toolbarWrapper = document.getElementById('toolbarWrapper');
  if (!toolbarWrapper) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      toolbarWrapper.classList.toggle('scrolled', !entry.isIntersecting);
    },
    { threshold: 1, rootMargin: '-60px 0px 0px 0px' }
  );

  // Observe a sentinel element at the top of the toolbar area
  const sentinel = document.createElement('div');
  sentinel.style.height = '1px';
  sentinel.style.marginBottom = '-1px';
  toolbarWrapper.parentNode.insertBefore(sentinel, toolbarWrapper);
  observer.observe(sentinel);
}

// ============================================
// COMPARE MODE
// ============================================

function initCompareMode() {
  const compareModeBtn = document.getElementById('compareModeBtn');
  const compareBar = document.getElementById('compareBar');
  const compareBtn = document.getElementById('compareBtn');
  const compareCancelBtn = document.getElementById('compareCancelBtn');
  const reportsPage = document.getElementById('reportsPage');

  if (!compareModeBtn || !compareBar) return;

  compareModeBtn.addEventListener('click', () => {
    compareMode = !compareMode;
    compareModeBtn.classList.toggle('active', compareMode);
    compareModeBtn.setAttribute('aria-pressed', compareMode);
    reportsPage?.classList.toggle('compare-mode', compareMode);

    if (compareMode) {
      compareBar.classList.add('visible');
    } else {
      compareBar.classList.remove('visible');
      selectedForCompare.clear();
      updateCompareUI();
      // Uncheck all checkboxes
      document.querySelectorAll('.compare-checkbox').forEach(cb => cb.checked = false);
    }
  });

  compareCancelBtn?.addEventListener('click', () => {
    compareMode = false;
    compareModeBtn.classList.remove('active');
    compareModeBtn.setAttribute('aria-pressed', false);
    reportsPage?.classList.remove('compare-mode');
    compareBar.classList.remove('visible');
    selectedForCompare.clear();
    updateCompareUI();
    document.querySelectorAll('.compare-checkbox').forEach(cb => cb.checked = false);
  });

  compareBtn?.addEventListener('click', () => {
    if (selectedForCompare.size === 2) {
      const [id1, id2] = Array.from(selectedForCompare);
      // Navigate to compare page (placeholder - implement when compare feature exists)
      console.log('Compare reports:', id1, id2);
      showSuccess('Compare feature coming soon!');
    }
  });
}

function handleCompareCheckbox(reportId, checked) {
  if (checked) {
    if (selectedForCompare.size < MAX_COMPARE) {
      selectedForCompare.add(reportId);
    } else {
      // Uncheck this checkbox - max reached
      const checkbox = document.querySelector(`input[data-report-id="${reportId}"]`);
      if (checkbox) checkbox.checked = false;
      return;
    }
  } else {
    selectedForCompare.delete(reportId);
  }
  updateCompareUI();
}

function updateCompareUI() {
  const compareCount = document.getElementById('compareCount');
  const compareBtn = document.getElementById('compareBtn');

  if (compareCount) {
    compareCount.textContent = selectedForCompare.size;
  }

  if (compareBtn) {
    compareBtn.disabled = selectedForCompare.size !== 2;
  }
}

// ============================================
// DATA LOADING
// ============================================

async function loadUserData() {
  try {
    const user = await proManager.refreshUser();
    if (!user) {
      window.location.href = '/auth.html';
      return;
    }
    document.getElementById('userEmail').textContent = user.email || 'N/A';
  } catch (error) {
    console.error('Failed to load user data:', error);
    showError('Failed to load account data.');
  }
}

async function loadBillingStatus() {
  try {
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    if (!token) return;

    const response = await fetch('/api/billing/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      await loadSubscriptionDataLegacy();
      return;
    }

    billingStatus = await response.json();
    updateBillingUI(billingStatus);

    // Determine user's plan for access level labelling
    const userPlan = billingStatus.plan || 'free';
    const isPro = userPlan === 'pro' || userPlan === 'day_pass';

    // Start with purchased reports from server
    const purchasedReports = (billingStatus.purchasedReportDetails || []).map(report => ({
      ...report,
      siteUrlNormalized: normalizeDomain(report.siteUrl),
      reportTypeLabel: getReportTypeLabel(report.analyzerType),
      reportTypeCategory: getReportTypeCategory(report.analyzerType),
      purchasedAtDate: safeParseDate(report.purchasedAt) || new Date(0),
      accessLevel: 'purchased'
    }));
    const knownIds = new Set(purchasedReports.map(r => r.reportId));

    // Fetch owned reports from the canonical server endpoint (authoritative for ownership)
    let serverOwnedReports = [];
    try {
      const ownedResponse = await fetch('/api/reports/owned?limit=200', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (ownedResponse.ok) {
        const ownedData = await ownedResponse.json();
        serverOwnedReports = (ownedData.reports || [])
          .filter(r => !knownIds.has(r.reportId))
          .map(r => {
            const parsedDate = safeParseDate(r.createdAt);

            return {
              reportId: r.reportId,
              siteUrl: r.siteUrl || '',
              siteUrlNormalized: normalizeDomain(r.siteUrl || ''),
              analyzerType: r.analyzerType || 'full',
              reportTypeLabel: getReportTypeLabel(r.analyzerType || 'full'),
              reportTypeCategory: getReportTypeCategory(r.analyzerType || 'full'),
              purchasedAt: r.createdAt,
              purchasedAtDate: parsedDate || new Date(0),
              accessLevel: r.ownedVia === 'purchased' ? 'purchased' : (isPro ? 'pro' : 'browser'),
              isServerScan: true
            };
          });
        serverOwnedReports.forEach(s => knownIds.add(s.reportId));
      }
    } catch (e) {
      console.warn('[Account] Failed to fetch owned reports:', e);
    }

    // Fallback: also fetch recent scans for broader coverage
    let serverScans = [];
    try {
      const scansResponse = await fetch('/api/usage/recent-scans?limit=200', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (scansResponse.ok) {
        const scansData = await scansResponse.json();
        serverScans = (scansData.scans || [])
          .filter(scan => !knownIds.has(scan.id))
          .map(scan => {
            let accessLevel = 'browser';
            if (scan.isPurchased) {
              accessLevel = 'purchased';
            } else if (isPro) {
              accessLevel = 'pro';
            }

            const parsedDate = safeParseDate(scan.createdAt);

            return {
              reportId: scan.id,
              siteUrl: scan.siteUrl || '',
              siteUrlNormalized: normalizeDomain(scan.siteUrl || ''),
              analyzerType: scan.analyzerType || 'full',
              reportTypeLabel: getReportTypeLabel(scan.analyzerType || 'full'),
              reportTypeCategory: getReportTypeCategory(scan.analyzerType || 'full'),
              purchasedAt: scan.createdAt,
              purchasedAtDate: parsedDate || new Date(0),
              accessLevel,
              isServerScan: true
            };
          });
        serverScans.forEach(s => knownIds.add(s.reportId));
      }
    } catch (e) {
      console.warn('[Account] Failed to fetch server scans:', e);
    }

    // Free users only see purchased reports — not free scans
    if (!isPro) {
      allReports = [...purchasedReports];
      allReports.sort((a, b) => b.purchasedAtDate - a.purchasedAtDate);
      filteredReports = [...allReports];
    } else {
      // Pro/Day Pass users see everything
      const browserReports = await loadBrowserStoredReports();
      const uniqueBrowserReports = browserReports.filter(r => !knownIds.has(r.reportId));

      allReports = [...purchasedReports, ...serverOwnedReports, ...serverScans, ...uniqueBrowserReports];
      allReports.sort((a, b) => b.purchasedAtDate - a.purchasedAtDate);
      filteredReports = [...allReports];
    }

  } catch (error) {
    console.error('Failed to load billing status:', error);
    await loadSubscriptionDataLegacy();
  }
}

async function loadSubscriptionDataLegacy() {
  try {
    const subscription = await proManager.getSubscription();
    updateBillingUILegacy(subscription);
  } catch (error) {
    console.error('Failed to load subscription data:', error);
  }
}

// ============================================
// BILLING UI
// ============================================

async function updateBillingUI(status) {
  const planEl = document.getElementById('userPlan');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const manageBtn = document.getElementById('manageSubBtn');
  const usageSection = document.getElementById('usageSection');

  const isPro = status.plan === 'pro' || status.plan === 'day_pass';
  const isYearly = status.subscriptionInterval === 'year';
  const isDay = status.subscriptionInterval === 'day';

  // Update trigger badge in header
  const triggerBadge = document.getElementById('accountTriggerBadge');

  if (isPro) {
    const intervalLabel = isDay ? 'Day Pass' : isYearly ? 'Yearly' : 'Monthly';
    planEl.innerHTML = `<span class="plan-badge plan-badge--pro">${intervalLabel}</span>`;
    if (triggerBadge) {
      triggerBadge.className = 'plan-badge plan-badge--pro';
      triggerBadge.textContent = intervalLabel;
    }

    if (status.cancelAtPeriodEnd && status.currentPeriodEnd) {
      const cancelDate = new Date(status.currentPeriodEnd).toLocaleDateString();
      planEl.innerHTML += ` <span style="font-size: 10px; color: var(--color-text-muted);">Cancels on ${cancelDate}</span>`;
    } else if (status.currentPeriodEnd && isDay) {
      const endDate = new Date(status.currentPeriodEnd);
      const hoursRemaining = Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60)));
      planEl.innerHTML += ` <span style="font-size: 10px; color: var(--color-text-muted);">${hoursRemaining}h left</span>`;
    }
  } else {
    planEl.innerHTML = '<span class="plan-badge plan-badge--free">' + t('account.payAsYouGo', 'Pay As You Go') + '</span>';
    if (triggerBadge) {
      triggerBadge.className = 'plan-badge plan-badge--free';
      triggerBadge.textContent = t('account.free', 'Free');
    }
  }

  if (!isPro) {
    let scansUsed = 0;
    let scanLimit = 10;
    let resetAt = null;
    try {
      // Use canonical usage API for consistent tracking
      const usageResponse = await fetch('/api/auth/usage', {
        credentials: 'include',
        headers: proManager.getAuthHeaders()
      });
      if (usageResponse.ok) {
        const usageData = await usageResponse.json();
        scansUsed = usageData.scans_used_today || 0;
        scanLimit = usageData.scan_limit_daily || 10;
        resetAt = usageData.scans_reset_at;
      }
    } catch (err) {
      console.error('Error fetching usage:', err);
    }

    const usageFill = document.getElementById('usageFill');
    const usageCount = document.getElementById('usageCount');
    const usageReset = document.getElementById('usageReset');

    if (usageFill && usageCount && usageReset) {
      const percentage = Math.min((scansUsed / scanLimit) * 100, 100);
      usageFill.style.width = `${percentage}%`;
      usageCount.textContent = `${scansUsed} / ${scanLimit} scans`;

      // Calculate time until reset
      if (resetAt) {
        const resetTime = new Date(resetAt);
        const now = new Date();
        const hoursUntilReset = Math.max(0, Math.ceil((resetTime - now) / (1000 * 60 * 60)));
        usageReset.textContent = `Resets in ${hoursUntilReset}h`;
      } else {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const hoursUntilReset = Math.ceil((midnight - now) / (1000 * 60 * 60));
        usageReset.textContent = `Resets in ${hoursUntilReset}h`;
      }
    }

    if (usageSection) usageSection.classList.remove('hidden');
  } else {
    if (usageSection) usageSection.classList.add('hidden');
  }

  if (isPro) {
    upgradeBtn.classList.add('hidden');
    manageBtn.classList.remove('hidden');
    manageBtn.textContent = t('nav.managePlan', 'Manage Plan');
  } else {
    upgradeBtn.classList.remove('hidden');
    if (status.hasStripeCustomer) {
      manageBtn.classList.remove('hidden');
      manageBtn.textContent = t('account.manageBilling', 'Manage Billing');
    } else {
      manageBtn.classList.add('hidden');
    }
  }
}

function updateBillingUILegacy(subscription) {
  const planEl = document.getElementById('userPlan');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const triggerBadge = document.getElementById('accountTriggerBadge');

  if (subscription) {
    planEl.innerHTML = '<span class="plan-badge plan-badge--pro">' + t('account.pro', 'Pro') + '</span>';
    upgradeBtn.classList.add('hidden');
    if (triggerBadge) {
      triggerBadge.className = 'plan-badge plan-badge--pro';
      triggerBadge.textContent = t('account.pro', 'Pro');
    }
  } else {
    planEl.innerHTML = '<span class="plan-badge plan-badge--free">' + t('account.payAsYouGo', 'Pay As You Go') + '</span>';
    upgradeBtn.classList.remove('hidden');
    if (triggerBadge) {
      triggerBadge.className = 'plan-badge plan-badge--free';
      triggerBadge.textContent = t('account.free', 'Free');
    }
  }
}

// ============================================
// FILTERING
// ============================================

function applyFilters() {
  const searchTerm = (document.getElementById('reportSearch')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('filterType')?.value || '';
  const accessFilter = document.getElementById('filterAccess')?.value || '';
  const dateFilter = document.getElementById('filterDate')?.value || '';
  const sortBy = document.getElementById('sortBy')?.value || 'newest';

  filteredReports = allReports.filter(report => {
    if (searchTerm) {
      const searchableText = [
        report.siteUrlNormalized,
        report.reportTypeLabel,
        report.reportTypeCategory
      ].join(' ').toLowerCase();
      if (!searchableText.includes(searchTerm)) return false;
    }

    if (typeFilter && report.reportTypeCategory !== typeFilter) return false;
    if (accessFilter && report.accessLevel !== accessFilter) return false;

    if (dateFilter) {
      const daysAgo = parseInt(dateFilter);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      if (report.purchasedAtDate < cutoffDate) return false;
    }

    return true;
  });

  filteredReports.sort((a, b) => {
    switch (sortBy) {
      case 'oldest': return a.purchasedAtDate - b.purchasedAtDate;
      case 'site-az': return a.siteUrlNormalized.localeCompare(b.siteUrlNormalized);
      case 'site-za': return b.siteUrlNormalized.localeCompare(a.siteUrlNormalized);
      default: return b.purchasedAtDate - a.purchasedAtDate;
    }
  });

  renderReports();
}

function clearFilters() {
  document.getElementById('reportSearch').value = '';
  document.getElementById('filterType').value = '';
  document.getElementById('filterAccess').value = '';
  document.getElementById('filterDate').value = '';
  document.getElementById('sortBy').value = 'newest';
  currentPage = 1;
  updateClearButton();
  applyFilters();
}

function updateClearButton() {
  const clearBtn = document.getElementById('clearFiltersBtn');
  if (!clearBtn) return;

  const hasFilters =
    document.getElementById('reportSearch')?.value ||
    document.getElementById('filterType')?.value ||
    document.getElementById('filterAccess')?.value ||
    document.getElementById('filterDate')?.value ||
    document.getElementById('sortBy')?.value !== 'newest';

  clearBtn.classList.toggle('visible', hasFilters);
}

// ============================================
// RENDERING
// ============================================

function renderReports() {
  const loadingEl = document.getElementById('reportsLoading');
  const emptyEl = document.getElementById('reportsEmpty');
  const noResultsEl = document.getElementById('reportsNoResults');
  const continueSection = document.getElementById('continueSection');
  const reportsCount = document.getElementById('reportsCount');

  if (loadingEl) loadingEl.classList.add('hidden');

  if (allReports.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (noResultsEl) noResultsEl.classList.add('hidden');
    if (continueSection) continueSection.classList.add('hidden');
    if (reportsCount) reportsCount.textContent = '';
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  if (filteredReports.length === 0) {
    if (noResultsEl) noResultsEl.classList.remove('hidden');
    if (continueSection) continueSection.classList.add('hidden');
    if (reportsCount) reportsCount.textContent = `0 ${t('reportsPage.labels.reports', 'reports')}`;
    document.getElementById('siteGroups').innerHTML = '';
    return;
  }

  if (noResultsEl) noResultsEl.classList.add('hidden');
  if (reportsCount) reportsCount.textContent = `${filteredReports.length} ${t('reportsPage.labels.reports', 'reports')}`;

  renderContinueCards();
  currentPage = 1;
  renderSiteGroups(true);
}

function renderContinueCards() {
  const container = document.getElementById('continueCards');
  const section = document.getElementById('continueSection');

  if (!container || !section) return;

  const recentReports = filteredReports.slice(0, 3);

  if (recentReports.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');

  container.innerHTML = recentReports.map(report => {
    const viewUrl = buildReportUrl(report);
    const rerunUrl = buildRerunUrl(report);
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(report.siteUrl)}&sz=32`;

    return `
      <div class="continue-card">
        <div class="continue-card__header">
          <div class="continue-card__favicon">
            <img src="${faviconUrl}" alt="" onerror="this.style.display='none'">
          </div>
          <h3 class="continue-card__site">${escapeHtml(report.siteUrlNormalized)}</h3>
        </div>
        <div class="continue-card__meta">
          <span class="continue-card__type-pill">${escapeHtml(getReportTypeLabel(report.analyzerType))}</span>
          <span class="continue-card__time">${formatRelativeTime(report.purchasedAtDate)}</span>
        </div>
        <div class="continue-card__actions">
          <a href="${viewUrl}" class="continue-card__btn continue-card__btn--primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ${t('reportsPage.buttons.view', 'View')}
          </a>
          <a href="${rerunUrl}" class="continue-card__btn continue-card__btn--secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            ${t('reportsPage.buttons.rerun', 'Rerun')}
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function renderSiteGroups(reset = true) {
  const container = document.getElementById('siteGroups');
  const loadMoreEl = document.getElementById('loadMore');

  if (!container) return;

  // Group by site
  const siteGroups = new Map();

  filteredReports.forEach(report => {
    const site = report.siteUrlNormalized;
    if (!siteGroups.has(site)) {
      siteGroups.set(site, {
        site,
        fullUrl: report.siteUrl,
        reports: [],
        latestReport: report,
        hasPurchased: false,
        hasPro: false,
        hasBrowserOnly: false
      });
    }

    const group = siteGroups.get(site);
    group.reports.push(report);

    if (report.accessLevel === 'purchased') group.hasPurchased = true;
    if (report.accessLevel === 'pro') group.hasPro = true;
    if (report.accessLevel === 'browser') group.hasBrowserOnly = true;

    if (report.purchasedAtDate > group.latestReport.purchasedAtDate) {
      group.latestReport = report;
    }
  });

  const groupsArray = Array.from(siteGroups.values());
  groupsArray.sort((a, b) => b.latestReport.purchasedAtDate - a.latestReport.purchasedAtDate);

  const totalGroups = groupsArray.length;
  const displayGroups = groupsArray.slice(0, currentPage * REPORTS_PER_PAGE);
  const hasMore = displayGroups.length < totalGroups;

  if (reset) {
    container.innerHTML = '';
  }

  const startIndex = reset ? 0 : (currentPage - 1) * REPORTS_PER_PAGE;
  const groupsToRender = reset ? displayGroups : displayGroups.slice(startIndex);

  groupsToRender.forEach((group, index) => {
    const groupEl = createSiteGroupElement(group, startIndex + index);
    container.appendChild(groupEl);
  });

  if (loadMoreEl) {
    if (hasMore) {
      loadMoreEl.classList.remove('hidden');
      const loadMoreBtn = document.getElementById('loadMoreBtn');
      if (loadMoreBtn) {
        loadMoreBtn.textContent = t('reportsPage.loadMoreRemaining', 'Load more ({n} remaining)').replace('{n}', totalGroups - displayGroups.length);
      }
    } else {
      loadMoreEl.classList.add('hidden');
    }
  }
}

function createSiteGroupElement(group, index) {
  const div = document.createElement('div');
  div.className = 'site-group';
  div.setAttribute('data-site', group.site);

  const latestViewUrl = buildReportUrl(group.latestReport);
  const rerunUrl = buildRerunUrl(group.latestReport);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(group.fullUrl)}&sz=32`;

  // Badge - only show at site level
  let badgeHtml = '';
  if (group.hasPurchased) {
    badgeHtml = `<span class="site-group__badge site-group__badge--purchased">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
      ${t('reportsPage.badges.purchased', 'Purchased')}
    </span>`;
  } else if (group.hasPro) {
    badgeHtml = `<span class="site-group__badge site-group__badge--pro">${t('reportsPage.badges.pro', 'Pro')}</span>`;
  } else if (group.hasBrowserOnly) {
    badgeHtml = `<span class="site-group__badge site-group__badge--browser" title="${t('reportsPage.badges.browserOnlyTooltip', 'Stored locally in this browser only')}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      ${t('reportsPage.badges.recent', 'Recent')}
    </span>`;
  }

  // Report rows
  const reportsHtml = group.reports.map(report => {
    const viewUrl = buildReportUrl(report);
    const checkboxId = `compare-${report.reportId}`;
    const isChecked = selectedForCompare.has(report.reportId) ? 'checked' : '';

    return `
      <div class="report-row">
        <div class="report-row__checkbox">
          <input type="checkbox" class="compare-checkbox" id="${checkboxId}" data-report-id="${report.reportId}" ${isChecked} onclick="handleCompareCheckbox('${report.reportId}', this.checked)">
        </div>
        <span class="report-row__type">${escapeHtml(getReportTypeLabel(report.analyzerType))}</span>
        <span class="report-row__time">${formatDateTime(report.purchasedAtDate)}</span>
        <a href="${viewUrl}" class="report-row__action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${t('reportsPage.buttons.view', 'View')}
        </a>
      </div>
    `;
  }).join('');

  div.innerHTML = `
    <div class="site-group__header" role="button" tabindex="0" aria-expanded="false" aria-controls="site-group-content-${index}">
      <div class="site-group__checkbox">
        <input type="checkbox" class="compare-checkbox" data-site="${group.site}" onclick="event.stopPropagation()">
      </div>
      <div class="site-group__favicon">
        <img src="${faviconUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
        <svg class="site-group__favicon-placeholder" style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </div>
      <div class="site-group__info">
        <h3 class="site-group__name">${escapeHtml(group.site)}</h3>
        <div class="site-group__meta">
          <span class="site-group__last-scan">${t('reportsPage.labels.last', 'Last:')} ${formatRelativeTime(group.latestReport.purchasedAtDate)}</span>
          <span class="site-group__count">${group.reports.length} ${group.reports.length !== 1 ? t('reportsPage.labels.reports', 'reports') : t('reportsPage.labels.report', 'report')}</span>
        </div>
      </div>
      ${badgeHtml}
      <div class="site-group__actions">
        <a href="${latestViewUrl}" class="site-group__btn site-group__btn--view" onclick="event.stopPropagation()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${t('reportsPage.buttons.viewLatest', 'View Latest')}
        </a>
        <a href="${rerunUrl}" class="site-group__btn site-group__btn--secondary" onclick="event.stopPropagation()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
          ${t('reportsPage.buttons.runAgain', 'Run Again')}
        </a>
      </div>
      <button class="site-group__expand" aria-label="Expand">
        <span class="expand-chevron">&#9660;</span>
      </button>
    </div>
    <div class="site-group__content" id="site-group-content-${index}">
      ${reportsHtml}
    </div>
  `;

  // Expand/collapse
  const header = div.querySelector('.site-group__header');
  header.addEventListener('click', (e) => {
    if (e.target.closest('a, button:not(.site-group__expand), input')) return;

    const isExpanded = div.hasAttribute('open');
    if (isExpanded) {
      div.removeAttribute('open');
      header.setAttribute('aria-expanded', 'false');
    } else {
      div.setAttribute('open', '');
      header.setAttribute('aria-expanded', 'true');
    }
  });

  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      header.click();
    }
  });

  return div;
}

// ============================================
// URL BUILDERS
// ============================================

function buildReportUrl(report) {
  const basePage = ANALYZER_PAGES[report.analyzerType] || '/dashboard.html';
  const params = new URLSearchParams();
  params.set('report_id', report.reportId);
  if (report.siteUrl) params.set('url', report.siteUrl);
  return `${basePage}?${params.toString()}`;
}

function buildRerunUrl(report) {
  const basePage = ANALYZER_PAGES[report.analyzerType] || '/dashboard.html';
  const params = new URLSearchParams();
  if (report.siteUrl) params.set('url', report.siteUrl);
  params.set('auto_scan', 'true');

  // Pass mode parameter for performance-hub based reports
  const modeMap = {
    'speed-ux-cwv': 'cwv',
    'speed-ux-full': 'full',
    'speed-ux-quick': 'quick',
    'cwv': 'cwv',
    'core-web-vitals': 'cwv',
    'performance': 'quick',
    'lighthouse': 'full'
  };
  const mode = modeMap[report.analyzerType];
  if (mode) {
    params.set('mode', mode);
  }

  return `${basePage}?${params.toString()}`;
}

// ============================================
// HELPERS
// ============================================

function normalizeDomain(url) {
  if (!url) return 'Unknown';
  try {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
  } catch {
    return url;
  }
}

function getReportTypeLabel(type) {
  const typeInfo = REPORT_TYPE_MAP[type];
  if (!typeInfo) return type || t('reportsPage.reportTypes.report', 'Report');

  // Try to get translated label
  const translationKey = `reportsPage.reportTypes.${typeInfo.category}`;
  return t(translationKey, typeInfo.label);
}

function getReportTypeCategory(type) {
  return REPORT_TYPE_MAP[type]?.category || type || 'other';
}

function safeParseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    // Handle PostgreSQL timestamps like "2026-03-04 02:10:23.138412+00"
    // Strip the timezone offset before converting, then append Z
    val = val.replace(/\+\d{2}$/, '').replace(/\+\d{2}:\d{2}$/, '');
    // Convert "YYYY-MM-DD HH:MM:SS" to ISO "YYYY-MM-DDTHH:MM:SSZ"
    if (!val.includes('T') && val.includes(' ')) {
      val = val.replace(' ', 'T') + 'Z';
    }
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function formatRelativeTime(date) {
  if (!date || isNaN(date.getTime())) return t('reportsPage.time.unknown', 'Unknown date');
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('reportsPage.time.justNow', 'Just now');
  if (minutes < 60) return t('reportsPage.time.minutesAgo', '{n}m ago').replace('{n}', minutes);
  if (hours < 24) return t('reportsPage.time.hoursAgo', '{n}h ago').replace('{n}', hours);
  if (days < 7) return t('reportsPage.time.daysAgo', '{n}d ago').replace('{n}', days);

  // Use user's locale for older dates
  const locale = window.i18n?.currentLanguage || 'en';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function formatDateTime(date) {
  if (!date || isNaN(date.getTime())) return t('reportsPage.time.unknown', 'Unknown date');
  // Use centralized i18n formatting if available
  if (window.i18n?.formatDateTime) {
    return window.i18n.formatDateTime(date, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
  // Fallback with locale detection
  const locale = window.i18n?.currentLanguage || navigator.language || 'en-US';
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: locale.startsWith('en')
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// ACTIONS
// ============================================

async function handleRefresh() {
  const btn = document.getElementById('refreshBtn');
  if (!btn) return;

  btn.classList.add('syncing');
  btn.disabled = true;

  try {
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    if (!token) {
      showError('Please log in to refresh');
      return;
    }

    const syncResponse = await fetch('/api/billing/sync-purchases', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const syncResult = await syncResponse.json();

    if (syncResult.synced > 0) {
      showSuccess(`Synced ${syncResult.synced} new purchase(s)`);
    }

    await loadBillingStatus();
    applyFilters();

  } catch (e) {
    console.error('Refresh error:', e);
    showError('Failed to refresh: ' + e.message);
  } finally {
    btn.classList.remove('syncing');
    btn.disabled = false;
  }
}

function handleUpgradeClick(e) {
  e.preventDefault();
  if (window.PricingModal && typeof window.PricingModal.open === 'function') {
    window.PricingModal.open();
  } else {
    window.location.href = '/upgrade.html';
  }
}

async function handleManageBilling() {
  const btn = document.getElementById('manageSubBtn');
  if (!btn) return;

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = t('account.loading', 'Loading...');

  try {
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    if (token) {
      const response = await fetch('/api/billing/portal', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.portalUrl) {
          window.location.href = data.portalUrl;
          return;
        }
      }
    }

    await proManager.openCustomerPortal();
  } catch (error) {
    showError(error.message || 'Failed to open billing portal');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function handleLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;

  btn.disabled = true;
  btn.textContent = t('account.loggingOut', 'Logging out...');

  try {
    await proManager.logout();
  } catch (error) {
    showError(t('account.logoutFailed', 'Logout failed. Please try again.'));
    btn.disabled = false;
    btn.textContent = t('account.logout', 'Logout');
  }
}

// ============================================
// PASSWORD MODAL
// ============================================

function initPasswordModal() {
  const modal = document.getElementById('passwordModal');
  const openBtn = document.getElementById('changePasswordBtn');
  const closeBtn = document.getElementById('passwordModalClose');
  const cancelBtn = document.getElementById('passwordModalCancel');
  const form = document.getElementById('changePasswordForm');

  if (!modal || !openBtn) return;

  function openModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('currentPassword')?.focus();
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    form?.reset();
  }

  openBtn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
      showError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      showError('Password must contain an uppercase letter');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      showError('Password must contain a lowercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      showError('Password must contain a number');
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...proManager.getAuthHeaders()
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      showSuccess('Password changed successfully!');
      closeModal();
    } catch (error) {
      showError(error.message || 'Failed to change password');
    }
  });
}

// ============================================
// MESSAGES
// ============================================

function showError(message) {
  const el = document.getElementById('error-message');
  if (!el) return;

  el.textContent = message;
  el.classList.remove('hidden');
  document.getElementById('success-message')?.classList.add('hidden');

  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => el.classList.add('hidden'), 5000);
}

function showSuccess(message) {
  const el = document.getElementById('success-message');
  if (!el) return;

  el.textContent = message;
  el.classList.remove('hidden');
  document.getElementById('error-message')?.classList.add('hidden');

  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// Expose to window for inline handlers
window.handleCompareCheckbox = handleCompareCheckbox;
