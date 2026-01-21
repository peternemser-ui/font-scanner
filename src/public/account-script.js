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
    showSuccess('Payment successful! Your plan has been updated.');
    // Clean URL
    urlParams.delete('billing_success');
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
  await loadRecentReports();

  // Wire up refresh button
  const refreshBtn = document.getElementById('refreshReportsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadRecentReports);
  }

  // Wire up retry button
  const retryBtn = document.getElementById('retryReportsBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', loadRecentReports);
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
    const token = localStorage.getItem('sm_auth_token');
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
    updateBillingUI(billingStatus);

  } catch (error) {
    console.error('Failed to load billing status:', error);
    // Fall back to legacy
    await loadSubscriptionDataLegacy();
  }
}

/**
 * Update billing UI based on billing status
 */
function updateBillingUI(status) {
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

  // Update plan badge
  if (isPro) {
    const intervalLabel = isYearly ? 'YEARLY' : 'MONTHLY';
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

    const statusLabel = isCanceled ? 'Canceled' : isTrialing ? 'Trialing' : 'Active';
    const statusClass = isCanceled ? 'canceled' : isTrialing ? 'trialing' : 'active';

    detailsEl.innerHTML = `
      <div class="account-info-row">
        <span class="account-info-label">Status</span>
        <span class="account-info-value">
          <span class="subscription-status ${statusClass}">${statusLabel}</span>
        </span>
      </div>
      <div class="account-info-row">
        <span class="account-info-label">${isCanceled || status.cancelAtPeriodEnd ? 'Access Until' : 'Renews'}</span>
        <span class="account-info-value">${periodEnd}</span>
      </div>
      ${isCanceled || status.cancelAtPeriodEnd ? `
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

    // Try new billing portal endpoint first
    const token = localStorage.getItem('sm_auth_token');
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
 * Load recent reports for the account page
 */
async function loadRecentReports() {
  const loadingEl = document.getElementById('recentReportsLoading');
  const tableEl = document.getElementById('recentReportsTable');
  const tbodyEl = document.getElementById('recentReportsTbody');
  const emptyEl = document.getElementById('recentReportsEmpty');
  const errorEl = document.getElementById('recentReportsError');
  const refreshBtn = document.getElementById('refreshReportsBtn');

  // Show loading, hide others
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (tableEl) tableEl.classList.add('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    const response = await fetch('/api/usage/recent-scans?limit=8', {
      headers: proManager.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch reports');
    }

    const data = await response.json();
    const scans = data.scans || [];

    // Hide loading
    if (loadingEl) loadingEl.classList.add('hidden');

    if (scans.length === 0) {
      // Show empty state
      if (emptyEl) emptyEl.classList.remove('hidden');
    } else {
      // Render table
      if (tbodyEl) {
        tbodyEl.innerHTML = scans.map(scan => renderReportRow(scan)).join('');
      }
      if (tableEl) tableEl.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error loading recent reports:', error);
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

/**
 * Render a single report row
 */
function renderReportRow(scan) {
  const siteUrl = truncateUrl(scan.siteUrl || 'Unknown');
  const reportType = formatReportType(scan.analyzerType);
  const runDate = formatDate(scan.createdAt);
  const statusBadge = getStatusBadge(scan.status);
  const accessBadge = getAccessBadge(scan);
  const scanId = scan.id || '';

  return `
    <tr>
      <td class="site-url" title="${escapeHtml(scan.siteUrl || '')}">${escapeHtml(siteUrl)}</td>
      <td>${escapeHtml(reportType)}</td>
      <td>${escapeHtml(runDate)}</td>
      <td>${statusBadge} ${accessBadge}</td>
      <td>
        <a href="/dashboard.html?scan=${encodeURIComponent(scanId)}" class="btn-link" style="padding: 0;">Open</a>
      </td>
    </tr>
  `;
}

/**
 * Get access badge (PRO, PURCHASED, FREE)
 */
function getAccessBadge(scan) {
  if (!billingStatus) return '';

  const isPro = billingStatus.plan === 'pro';
  if (isPro) {
    return '<span class="badge badge--pro" style="background: linear-gradient(135deg, #ffd700, #ffaa00); color: #000; margin-left: 4px;">PRO</span>';
  }

  // Check if this report was purchased
  const purchasedReports = billingStatus.purchasedReports || [];
  const reportId = scan.reportId || '';
  if (reportId && purchasedReports.includes(reportId)) {
    return '<span class="badge badge--ok" style="margin-left: 4px;">PURCHASED</span>';
  }

  return '<span class="badge badge--muted" style="margin-left: 4px;">FREE</span>';
}

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
    'accessibility': 'Accessibility',
    'performance': 'Performance',
    'security': 'Security',
    'fonts': 'Fonts',
    'brand': 'Brand',
    'cro': 'CRO',
    'mobile': 'Mobile'
  };
  return types[type] || type || 'Full Scan';
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
  const statusMap = {
    'completed': { class: 'badge--ok', text: 'Completed' },
    'running': { class: 'badge--info', text: 'Running' },
    'queued': { class: 'badge--muted', text: 'Queued' },
    'failed': { class: 'badge--danger', text: 'Failed' }
  };
  const info = statusMap[status] || { class: 'badge--muted', text: status || 'Unknown' };
  return `<span class="badge ${info.class}">${escapeHtml(info.text)}</span>`;
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
