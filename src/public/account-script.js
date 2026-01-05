/**
 * Account Dashboard Script
 * Manages user account, subscription, and billing
 */

// Check authentication on load
document.addEventListener('DOMContentLoaded', async () => {
  // Redirect if not authenticated
  if (!proManager.isAuthenticated()) {
    window.location.href = '/auth.html';
    return;
  }

  // Check for success message from URL params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('success') === 'true') {
    showSuccess('Payment successful! Your Pro features are now active.');
  }

  // Load user data
  await loadUserData();
  await loadSubscriptionData();
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

    // Update plan badge
    const planEl = document.getElementById('userPlan');
    const isPro = user.plan === 'pro';

    planEl.innerHTML = isPro
      ? '<span class="plan-badge"><span style="font-size: 0.8rem;">✨</span> PRO</span>'
      : '<span class="plan-badge free">FREE</span>';

    // Update created date
    const createdDate = proManager.formatDate(user.created_at);
    document.getElementById('userCreatedAt').textContent = createdDate || 'N/A';

    // Show/hide upgrade button
    const upgradeBtn = document.getElementById('upgradeBtn');
    if (isPro) {
      upgradeBtn.classList.add('hidden');
    } else {
      upgradeBtn.classList.remove('hidden');
    }

  } catch (error) {
    console.error('Failed to load user data:', error);
    showError('Failed to load account data. Please try again.');
  }
}

/**
 * Load subscription data from API
 */
async function loadSubscriptionData() {
  try {
    const subscription = await proManager.getSubscription();
    const detailsEl = document.getElementById('subscriptionDetails');

    if (!subscription) {
      // No subscription - show free plan with real usage
      // Fetch usage data
      let scansRemaining = '25';
      try {
        const usageResponse = await fetch('/api/usage/stats', {
          headers: proManager.getAuthHeaders()
        });
        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          scansRemaining = usageData.scansRemaining || 25;
        }
      } catch (err) {
        console.error('Error fetching usage:', err);
      }

      detailsEl.innerHTML = `
        <div class="account-info-row">
          <span class="account-info-label">Status</span>
          <span class="account-info-value">
            <span class="subscription-status free">Free Plan</span>
          </span>
        </div>
        <div class="account-info-row">
          <span class="account-info-label">Scans Remaining</span>
          <span class="account-info-value">${scansRemaining} / day</span>
        </div>
      `;
      return;
    }

    // Has subscription
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

    const renewText = subscription.cancelAtPeriodEnd
      ? `Ends ${periodEnd}`
      : `Renews ${periodEnd}`;

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
      ${subscription.cancelAtPeriodEnd ? `
        <div class="account-info-row">
          <span class="account-info-label">Note</span>
          <span class="account-info-value" style="color: #ef4444;">Subscription will cancel on ${periodEnd}</span>
        </div>
      ` : ''}
    `;

  } catch (error) {
    console.error('Failed to load subscription data:', error);
    // Don't show error - subscription might not exist
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
