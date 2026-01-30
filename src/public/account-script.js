/**
 * Account Dashboard Script
 * Manages user account, subscription, and billing
 */

// Store billing status globally for easy access
let billingStatus = null;

// Check authentication on load
document.addEventListener('DOMContentLoaded', async () => {
  // Redirect if not authenticated
  if (!proManager.isAuthenticated()) {
    window.location.href = '/auth.html';
    return;
  }

  // Check for billing return URLs
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('billing_success') === 'true') {
    // Verify and record the purchase first (essential for local dev where webhooks don't fire)
    const sessionId = urlParams.get('session_id');
    if (sessionId) {
      const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
      if (token) {
        try {
          const verifyResp = await fetch('/api/billing/verify-purchase', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ session_id: sessionId })
          });
          const verifyResult = await verifyResp.json().catch(() => null);
          console.log('Account page: Purchase verification result:', verifyResult);
        } catch (e) {
          console.warn('Account page: Failed to verify purchase:', e);
        }
      }
    }
    // Clear ProReportBlock cache so other pages get fresh entitlements
    if (window.ProReportBlock?.clearBillingCache) {
      window.ProReportBlock.clearBillingCache();
    }
    showSuccess('Payment successful! Your plan has been updated.');
    // Clean URL
    urlParams.delete('billing_success');
    urlParams.delete('session_id');
    const newUrl = urlParams.toString()
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  } else if (urlParams.get('billing_canceled') === 'true') {
    showError('Checkout was canceled. No charges were made.');
    // Clean URL
    urlParams.delete('billing_canceled');
    const newUrl = urlParams.toString()
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  } else if (urlParams.get('success') === 'true') {
    // Legacy success param
    showSuccess('Payment successful! Your Pro features are now active.');
  }

  // Load user data
  await loadUserData();
  await loadBillingStatus();
  displayPurchasedReports();

  // Wire up refresh purchased reports button
  const refreshPurchasedBtn = document.getElementById('refreshPurchasedBtn');
  if (refreshPurchasedBtn) {
    refreshPurchasedBtn.addEventListener('click', async () => {
      await loadBillingStatus();
      displayPurchasedReports();
    });
  }

  // Wire up upgrade button
  const upgradeBtn = document.getElementById('upgradeBtn');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', handleUpgradeClick);
  }
});

/**
 * Show error message
 */
function showError(message) {
  const errorEl = document.getElementById('error-message');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');

  // Hide success message
  document.getElementById('success-message').classList.add('hidden');

  // Scroll to message
  errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorEl.classList.add('hidden');
  }, 5000);
}

/**
 * Show success message
 */
function showSuccess(message) {
  const successEl = document.getElementById('success-message');
  successEl.textContent = message;
  successEl.classList.remove('hidden');

  // Hide error message
  document.getElementById('error-message').classList.add('hidden');

  // Scroll to message
  successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Auto-hide after 5 seconds
  setTimeout(() => {
    successEl.classList.add('hidden');
  }, 5000);
}

/**
 * Load user data from API
 */
async function loadUserData() {
  try {
    // Refresh user data from server
    const user = await proManager.refreshUser();

    if (!user) {
      // Token invalid
      window.location.href = '/auth.html';
      return;
    }

    // Update UI
    document.getElementById('userEmail').textContent = user.email || 'N/A';

    // Update created date
    const createdDate = proManager.formatDate(user.created_at);
    document.getElementById('userCreatedAt').textContent = createdDate || 'N/A';

  } catch (error) {
    console.error('Failed to load user data:', error);
    showError('Failed to load account data. Please try again.');
  }
}

/**
 * Load billing status from new /api/billing/status endpoint
 */
async function loadBillingStatus() {
  try {
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    if (!token) return;

    const response = await fetch('/api/billing/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      // Fall back to legacy subscription data
      await loadSubscriptionDataLegacy();
      return;
    }

    billingStatus = await response.json();
    await updateBillingUI(billingStatus);

  } catch (error) {
    console.error('Failed to load billing status:', error);
    // Fall back to legacy
    await loadSubscriptionDataLegacy();
  }
}

/**
 * Update billing UI based on billing status
 */
async function updateBillingUI(status) {
  const planEl = document.getElementById('userPlan');
  const detailsEl = document.getElementById('subscriptionDetails');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const manageBtn = document.getElementById('manageSubBtn');
  const waitlistHint = document.querySelector('.upgrade-hint');

  const isPro = status.plan === 'pro';
  const isActive = status.subscriptionStatus === 'active';
  const isTrialing = status.subscriptionStatus === 'trialing';
  const isCanceled = status.subscriptionStatus === 'canceled';
  const isYearly = status.subscriptionInterval === 'year';
  const isDay = status.subscriptionInterval === 'day';

  // Update plan badge
  if (isPro) {
    const intervalLabel = isDay ? 'DAY PASS' : isYearly ? 'YEARLY' : 'MONTHLY';
    if (isCanceled) {
      planEl.innerHTML = `<span class="plan-badge canceled">PRO (${intervalLabel}) - CANCELED</span>`;
    } else {
      planEl.innerHTML = `<span class="plan-badge"><span style="font-size: 0.8rem;">&#10024;</span> PRO (${intervalLabel})</span>`;
    }
  } else {
    planEl.innerHTML = '<span class="plan-badge free">FREE PLAN</span>';
  }

  // Update subscription details
  if (isPro && status.currentPeriodEnd) {
    const periodEnd = new Date(status.currentPeriodEnd).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Day passes have special display - show time remaining
    let periodEndDisplay = periodEnd;
    if (isDay) {
      const endDate = new Date(status.currentPeriodEnd);
      const now = new Date();
      const hoursRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60)));
      periodEndDisplay = hoursRemaining > 0 ? `${hoursRemaining}h remaining` : 'Expired';
    }

    const statusLabel = isCanceled ? 'Canceled' : isTrialing ? 'Trialing' : isDay ? 'Active (24h)' : 'Active';
    const statusClass = isCanceled ? 'canceled' : isTrialing ? 'trialing' : 'active';

    // Day passes always show "Expires" since they don't auto-renew
    const periodLabel = isDay ? 'Expires' : (isCanceled || status.cancelAtPeriodEnd ? 'Access Until' : 'Renews');

    detailsEl.innerHTML = `
      <div class="account-info-row">
        <span class="account-info-label">Status</span>
        <span class="account-info-value">
          <span class="subscription-status ${statusClass}">${statusLabel}</span>
        </span>
      </div>
      <div class="account-info-row">
        <span class="account-info-label">${periodLabel}</span>
        <span class="account-info-value">${periodEndDisplay}</span>
      </div>
      ${(isCanceled || status.cancelAtPeriodEnd) && !isDay ? `
        <div class="account-info-row">
          <span class="account-info-label">Note</span>
          <span class="account-info-value" style="color: #ef4444;">Subscription ends on ${periodEnd}</span>
        </div>
      ` : ''}
    `;
  } else {
    // Free plan - show usage
    let scansToday = 0;
    try {
      const usageResponse = await fetch('/api/usage/stats', {
        headers: proManager.getAuthHeaders()
      });
      if (usageResponse.ok) {
        const usageData = await usageResponse.json();
        scansToday = usageData.scansToday || 0;
      }
    } catch (err) {
      console.error('Error fetching usage:', err);
    }

    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const hoursUntilReset = Math.ceil((midnight - now) / (1000 * 60 * 60));

    detailsEl.innerHTML = `
      <div class="account-info-row">
        <span class="account-info-label">Status</span>
        <span class="account-info-value">
          <span class="subscription-status free">Free Plan</span>
        </span>
      </div>
      <div class="account-info-row">
        <span class="account-info-label">Usage Today</span>
        <span class="account-info-value">
          <div class="usage-block">
            <span class="usage-main">${scansToday} / 25 scans used</span>
            <span class="usage-hint">Resets in ${hoursUntilReset}h</span>
          </div>
        </span>
      </div>
    `;
  }

  // Update buttons
  if (isPro) {
    // Pro user - show Manage Billing, hide upgrade
    upgradeBtn.classList.add('hidden');
    manageBtn.classList.remove('hidden');
    if (waitlistHint) waitlistHint.classList.add('hidden');
  } else {
    // Free user - show Upgrade, maybe show Manage Billing if has customer
    upgradeBtn.classList.remove('hidden');
    upgradeBtn.classList.remove('account-btn-disabled');
    upgradeBtn.removeAttribute('aria-disabled');
    upgradeBtn.removeAttribute('tabindex');
    upgradeBtn.classList.add('account-btn-primary');

    if (status.hasStripeCustomer) {
      manageBtn.classList.remove('hidden');
    } else {
      manageBtn.classList.add('hidden');
    }

    if (waitlistHint) waitlistHint.classList.add('hidden');
  }
}

/**
 * Legacy subscription data loader (fallback)
 */
async function loadSubscriptionDataLegacy() {
  try {
    const subscription = await proManager.getSubscription();
    const detailsEl = document.getElementById('subscriptionDetails');
    const planEl = document.getElementById('userPlan');

    if (!subscription) {
      // No subscription - show free plan
      planEl.innerHTML = '<span class="plan-badge free">FREE PLAN</span>';

      let scansToday = 0;
      try {
        const usageResponse = await fetch('/api/usage/stats', {
          headers: proManager.getAuthHeaders()
        });
        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          scansToday = usageData.scansToday || 0;
        }
      } catch (err) {
        console.error('Error fetching usage:', err);
      }

      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const hoursUntilReset = Math.ceil((midnight - now) / (1000 * 60 * 60));

      detailsEl.innerHTML = `
        <div class="account-info-row">
          <span class="account-info-label">Status</span>
          <span class="account-info-value">
            <span class="subscription-status free">Free Plan</span>
          </span>
        </div>
        <div class="account-info-row">
          <span class="account-info-label">Usage Today</span>
          <span class="account-info-value">
            <div class="usage-block">
              <span class="usage-main">${scansToday} / 25 scans used</span>
              <span class="usage-hint">Resets in ${hoursUntilReset}h</span>
            </div>
          </span>
        </div>
      `;
      return;
    }

    // Has subscription - use legacy format
    planEl.innerHTML = '<span class="plan-badge"><span style="font-size: 0.8rem;">&#10024;</span> PRO</span>';

    const status = subscription.status || 'unknown';
    const statusClass = status === 'active' ? 'active' :
                       status === 'canceled' ? 'canceled' : 'trialing';
    const statusText = status.charAt(0).toUpperCase() + status.slice(1);

    const periodEnd = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'N/A';

    detailsEl.innerHTML = `
      <div class="account-info-row">
        <span class="account-info-label">Status</span>
        <span class="account-info-value">
          <span class="subscription-status ${statusClass}">${statusText}</span>
        </span>
      </div>
      <div class="account-info-row">
        <span class="account-info-label">${subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'}</span>
        <span class="account-info-value">${periodEnd}</span>
      </div>
    `;

  } catch (error) {
    console.error('Failed to load subscription data:', error);
  }
}

/**
 * Handle upgrade button click
 */
function handleUpgradeClick(e) {
  e.preventDefault();
  if (window.PricingModal && typeof window.PricingModal.open === 'function') {
    window.PricingModal.open();
  } else {
    window.location.href = '/upgrade.html';
  }
}

/**
 * Manage subscription button
 */
document.getElementById('manageSubBtn').addEventListener('click', async () => {
  const btn = document.getElementById('manageSubBtn');
  const btnText = document.getElementById('manageSubBtnText');

  try {
    btn.disabled = true;
    btnText.innerHTML = '<span class="loading-spinner"></span> Loading...';

    // Try new billing portal endpoint first (check both token keys)
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

    // Fall back to legacy
    await proManager.openCustomerPortal();

  } catch (error) {
    showError(error.message || 'Failed to open billing portal');
    btn.disabled = false;
    btnText.textContent = 'Manage Billing';
  }
});

/**
 * Change Password button - show/hide form
 */
document.getElementById('changePasswordBtn').addEventListener('click', () => {
  const card = document.getElementById('changePasswordCard');
  card.classList.toggle('hidden');

  // Scroll to form if showing
  if (!card.classList.contains('hidden')) {
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

/**
 * Cancel password change
 */
document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
  document.getElementById('changePasswordCard').classList.add('hidden');
  document.getElementById('changePasswordForm').reset();
});

/**
 * Change Password form submission
 */
document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Validate passwords match
  if (newPassword !== confirmPassword) {
    showError('New passwords do not match');
    return;
  }

  // Validate new password strength
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
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to change password');
    }

    showSuccess('Password changed successfully!');
    document.getElementById('changePasswordCard').classList.add('hidden');
    document.getElementById('changePasswordForm').reset();

  } catch (error) {
    showError(error.message || 'Failed to change password');
  }
});

/**
 * Logout button
 */
document.getElementById('logoutBtn').addEventListener('click', async () => {
  const btn = document.getElementById('logoutBtn');

  try {
    btn.disabled = true;
    btn.textContent = 'Logging out...';

    await proManager.logout();

  } catch (error) {
    showError('Logout failed. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Logout';
  }
});


/**
 * Truncate URL for display
 */
function truncateUrl(url) {
  if (!url) return 'Unknown';
  // Remove protocol
  let display = url.replace(/^https?:\/\//, '');
  // Remove trailing slash
  display = display.replace(/\/$/, '');
  // Truncate if too long
  if (display.length > 30) {
    display = display.substring(0, 27) + '...';
  }
  return display;
}

/**
 * Format report type for display
 */
function formatReportType(type) {
  const types = {
    'full': 'Full Scan',
    'seo': 'SEO',
    'seo-analyzer': 'SEO',
    'accessibility': 'Accessibility',
    'accessibility-analyzer': 'Accessibility',
    'performance': 'Performance',
    'performance-hub': 'Performance',
    'speed-ux-pro': 'Speed & UX',
    'speed-ux-quick': 'Speed & UX - Quick',
    'speed-ux-cwv': 'Speed & UX - CWV',
    'speed-ux-full': 'Speed & UX - Lighthouse',
    'security': 'Security',
    'security-analyzer': 'Security',
    'tag-intelligence': 'Tag Intelligence',
    'cwv': 'Core Web Vitals',
    'core-web-vitals': 'Core Web Vitals',
    'fonts': 'Fonts',
    'enhanced-fonts': 'Fonts & Typography',
    'brand': 'Brand',
    'brand-consistency': 'Brand & Design',
    'cro': 'CRO',
    'cro-analyzer': 'CRO',
    'mobile': 'Mobile',
    'mobile-analyzer': 'Mobile',
    'ip-reputation': 'IP Reputation',
    'ip-reputation-analyzer': 'IP Reputation',
    'gdpr': 'Privacy Compliance',
    'gdpr-compliance': 'Privacy Compliance',
    'hosting': 'Hosting',
    'hosting-analyzer': 'Hosting',
    'competitive': 'Competitive Analysis',
    'competitive-analysis': 'Competitive Analysis',
    'local-seo': 'Local SEO',
    'broken-links': 'Broken Links',
    'site-crawler': 'Site Crawler'
  };
  return types[type] || type || 'Full Scan';
}

/**
 * Format date for display in user's local timezone
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';

    // Format in user's local timezone with timezone abbreviation
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
  } catch {
    return 'N/A';
  }
}


/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Pagination state for purchased reports
let purchasedReportsPage = 1;
const REPORTS_PER_PAGE = 20;

/**
 * Display purchased reports section with pagination
 */
function displayPurchasedReports(page = 1) {
  // Validate page number
  page = Math.max(1, parseInt(page) || 1);
  purchasedReportsPage = page;

  const card = document.getElementById('purchasedReportsCard');
  const tbody = document.getElementById('purchasedReportsTbody');
  const tableEl = document.getElementById('purchasedReportsTable');
  const loadingEl = document.getElementById('purchasedReportsLoading');
  const emptyEl = document.getElementById('purchasedReportsEmpty');
  const descEl = document.getElementById('purchasedReportsDesc');

  console.log('[Account] displayPurchasedReports called', {
    hasCard: !!card,
    hasTbody: !!tbody,
    billingStatus,
    purchasedReportDetails: billingStatus?.purchasedReportDetails
  });

  if (!card || !tbody) return;

  // Hide loading
  if (loadingEl) loadingEl.classList.add('hidden');

  // Get purchased report details from billing status
  const purchases = billingStatus?.purchasedReportDetails || [];

  console.log('[Account] Purchased reports to display:', purchases);

  if (purchases.length === 0) {
    // No purchased reports - show empty state
    if (tableEl) tableEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (descEl) descEl.classList.add('hidden');
    removePaginationControls();
    return;
  }

  // Show the table
  if (tableEl) tableEl.classList.remove('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');
  if (descEl) descEl.classList.remove('hidden');

  // Calculate pagination
  const totalPages = Math.ceil(purchases.length / REPORTS_PER_PAGE);
  const startIndex = (page - 1) * REPORTS_PER_PAGE;
  const endIndex = startIndex + REPORTS_PER_PAGE;
  const paginatedPurchases = purchases.slice(startIndex, endIndex);

  // Render purchased reports for current page
  tbody.innerHTML = paginatedPurchases.map(purchase => renderPurchasedReportRow(purchase)).join('');

  // Render pagination controls if needed
  if (purchases.length > REPORTS_PER_PAGE) {
    renderPaginationControls(page, totalPages, purchases.length);
  } else {
    removePaginationControls();
  }
}

/**
 * Render pagination controls
 */
function renderPaginationControls(currentPage, totalPages, totalItems) {
  let paginationEl = document.getElementById('purchasedReportsPagination');

  if (!paginationEl) {
    paginationEl = document.createElement('div');
    paginationEl.id = 'purchasedReportsPagination';
    paginationEl.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-top: 1px solid var(--border-primary, #e5e7eb); margin-top: 1rem;';

    const tableEl = document.getElementById('purchasedReportsTable');
    if (tableEl && tableEl.parentNode) {
      tableEl.parentNode.insertBefore(paginationEl, tableEl.nextSibling);
    }
  }

  const startItem = (currentPage - 1) * REPORTS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * REPORTS_PER_PAGE, totalItems);

  paginationEl.innerHTML = `
    <span style="color: var(--text-secondary, #6b7280); font-size: 0.875rem;">
      Showing ${startItem}-${endItem} of ${totalItems} reports
    </span>
    <div style="display: flex; gap: 0.5rem;">
      <button
        id="paginationPrevBtn"
        ${currentPage === 1 ? 'disabled' : ''}
        style="padding: 0.5rem 1rem; border: 1px solid var(--border-primary, #e5e7eb); border-radius: 6px; background: ${currentPage === 1 ? 'var(--bg-secondary, #f3f4f6)' : 'var(--bg-primary, #fff)'}; color: ${currentPage === 1 ? 'var(--text-muted, #9ca3af)' : 'var(--text-primary, #111827)'}; cursor: ${currentPage === 1 ? 'not-allowed' : 'pointer'}; font-size: 0.875rem;"
      >
        ← Previous
      </button>
      <span style="padding: 0.5rem 1rem; color: var(--text-secondary, #6b7280); font-size: 0.875rem;">
        Page ${currentPage} of ${totalPages}
      </span>
      <button
        id="paginationNextBtn"
        ${currentPage === totalPages ? 'disabled' : ''}
        style="padding: 0.5rem 1rem; border: 1px solid var(--border-primary, #e5e7eb); border-radius: 6px; background: ${currentPage === totalPages ? 'var(--bg-secondary, #f3f4f6)' : 'var(--bg-primary, #fff)'}; color: ${currentPage === totalPages ? 'var(--text-muted, #9ca3af)' : 'var(--text-primary, #111827)'}; cursor: ${currentPage === totalPages ? 'not-allowed' : 'pointer'}; font-size: 0.875rem;"
      >
        Next →
      </button>
    </div>
  `;

  // Add event listeners (more reliable than inline onclick)
  const prevBtn = document.getElementById('paginationPrevBtn');
  const nextBtn = document.getElementById('paginationNextBtn');

  if (prevBtn && currentPage > 1) {
    prevBtn.addEventListener('click', function() {
      console.log('[Account] Previous button clicked, going to page', currentPage - 1);
      displayPurchasedReports(currentPage - 1);
    });
  }

  if (nextBtn && currentPage < totalPages) {
    nextBtn.addEventListener('click', function() {
      console.log('[Account] Next button clicked, going to page', currentPage + 1);
      displayPurchasedReports(currentPage + 1);
    });
  }
}

/**
 * Remove pagination controls
 */
function removePaginationControls() {
  const paginationEl = document.getElementById('purchasedReportsPagination');
  if (paginationEl) {
    paginationEl.remove();
  }
}

/**
 * Render a single purchased report row
 */
function renderPurchasedReportRow(purchase) {
  const siteUrl = truncateUrl(purchase.siteUrl || 'Unknown');
  const fullSiteUrl = purchase.siteUrl || '';
  const reportType = formatReportType(purchase.analyzerType);
  const purchaseDate = formatDate(purchase.purchasedAt);
  const reportId = purchase.reportId || '';

  // Determine the link based on analyzer type
  const analyzerPages = {
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
    'hosting': '/hosting-analyzer.html',
    'hosting-analyzer': '/hosting-analyzer.html',
    'competitive': '/competitive-analysis.html',
    'competitive-analysis': '/competitive-analysis.html',
    'local-seo': '/local-seo.html',
    'broken-links': '/broken-links.html',
    'site-crawler': '/site-crawler.html'
  };
  const basePage = analyzerPages[purchase.analyzerType] || '/dashboard.html';

  // Build URL with report_id and url (for auto-fill)
  // Don't set auto_scan - we want to try loading from database first
  // If report not in database, user can manually trigger scan
  const params = new URLSearchParams();
  params.set('report_id', reportId);
  if (fullSiteUrl) {
    params.set('url', fullSiteUrl);
  }
  const viewUrl = `${basePage}?${params.toString()}`;

  return `
    <tr>
      <td class="site-url" title="${escapeHtml(fullSiteUrl)}">${escapeHtml(siteUrl)}</td>
      <td>${escapeHtml(reportType)}</td>
      <td>${escapeHtml(purchaseDate)}</td>
      <td>
        <a href="${viewUrl}" class="btn-link" style="padding: 0;">View Report</a>
      </td>
    </tr>
  `;
}

// Expose pagination function to window for onclick handlers
window.displayPurchasedReports = displayPurchasedReports;
