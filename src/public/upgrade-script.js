/**
 * Upgrade Page Script
 * Handles Stripe Checkout for all plans
 */

// Show/hide messages
function showError(message) {
  const errorEl = document.getElementById('error-message');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');

  // Hide success message
  document.getElementById('success-message').classList.add('hidden');

  // Scroll to message
  errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showSuccess(message) {
  const successEl = document.getElementById('success-message');
  successEl.textContent = message;
  successEl.classList.remove('hidden');

  // Hide error message
  document.getElementById('error-message').classList.add('hidden');

  // Scroll to message
  successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearMessages() {
  document.getElementById('error-message').classList.add('hidden');
  document.getElementById('success-message').classList.add('hidden');
}

// Get auth token
function getAuthToken() {
  return localStorage.getItem('sm_token');
}

// Get user data
function getUser() {
  try {
    const userData = localStorage.getItem('sm_user');
    return userData ? JSON.parse(userData) : null;
  } catch (e) {
    return null;
  }
}

// Upgrade to Pro (Monthly)
document.getElementById('upgrade-monthly-btn').addEventListener('click', async () => {
  await handleUpgrade('monthly');
});

// Upgrade to Pro (Annual)
document.getElementById('upgrade-annual-btn').addEventListener('click', async () => {
  await handleUpgrade('annual');
});

// Get Day Pass
document.getElementById('upgrade-daypass-btn').addEventListener('click', async () => {
  await handleUpgrade('day');
});

async function handleUpgrade(billingPeriod) {
  clearMessages();

  const token = getAuthToken();
  if (!token) {
    showError('Please login to upgrade');
    setTimeout(() => {
      window.location.href = '/auth.html';
    }, 2000);
    return;
  }

  // Map billing period to button and interval
  const btnMap = {
    'monthly': document.getElementById('upgrade-monthly-btn'),
    'annual': document.getElementById('upgrade-annual-btn'),
    'day': document.getElementById('upgrade-daypass-btn')
  };
  const intervalMap = {
    'monthly': 'month',
    'annual': 'year',
    'day': 'day'
  };
  const labelMap = {
    'monthly': 'Upgrade to Pro',
    'annual': 'Upgrade to Pro Annual',
    'day': 'Get 8 Hour Day Pass'
  };

  const btn = btnMap[billingPeriod];
  const interval = intervalMap[billingPeriod];

  try {
    btn.disabled = true;
    btn.textContent = 'Redirecting to checkout...';

    // Create Stripe Checkout session via unified billing endpoint
    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        purchaseType: 'subscription',
        interval: interval,
        returnUrl: `${window.location.origin}/account.html`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Backend returns { error: "ErrorName", message: "..." }
      throw new Error(data.message || data.error || 'Failed to create checkout session');
    }

    // Redirect to Stripe Checkout
    window.location.href = data.checkoutUrl || data.url;

  } catch (error) {
    showError(error.message);
    btn.disabled = false;
    btn.textContent = labelMap[billingPeriod];
  }
}

// Check for URL parameters
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);

  // Check if payment was canceled
  if (urlParams.get('canceled') === 'true') {
    showError('Payment was canceled. No charges were made.');
  }

  // Check if payment succeeded (redirected from success URL)
  if (urlParams.get('success') === 'true') {
    showSuccess('Payment successful! Redirecting to your account...');
    setTimeout(() => {
      window.location.href = '/account.html';
    }, 2000);
    return;
  }

  // Check current user plan from server (not stale localStorage)
  const token = getAuthToken();
  if (token) {
    try {
      const resp = await fetch('/api/billing/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const billing = await resp.json();
        if (billing.plan === 'pro') {
          // Only redirect if user has a real Pro subscription (monthly/annual)
          showSuccess('You already have Pro! Redirecting to your account...');
          setTimeout(() => {
            window.location.href = '/account.html';
          }, 2000);
        } else if (billing.plan === 'day_pass') {
          // Day Pass users can still upgrade to Pro — disable the Day Pass button
          const dayPassBtn = document.getElementById('upgrade-daypass-btn');
          dayPassBtn.textContent = 'Current Plan';
          dayPassBtn.disabled = true;
          dayPassBtn.classList.add('secondary');
        }
      }
    } catch (e) {
      // Ignore - allow user to stay on upgrade page
    }
  }

  // Update button text if not logged in
  if (!getAuthToken()) {
    const monthlyBtn = document.getElementById('upgrade-monthly-btn');
    const annualBtn = document.getElementById('upgrade-annual-btn');
    const daypassBtn = document.getElementById('upgrade-daypass-btn');

    monthlyBtn.textContent = 'Login to Upgrade';
    annualBtn.textContent = 'Login to Upgrade';
    daypassBtn.textContent = 'Login to Get 8 Hour Day Pass';

    monthlyBtn.onclick = () => {
      window.location.href = '/auth.html';
    };
    annualBtn.onclick = () => {
      window.location.href = '/auth.html';
    };
    daypassBtn.onclick = () => {
      window.location.href = '/auth.html';
    };
  }
});
