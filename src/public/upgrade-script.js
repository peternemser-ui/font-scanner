/**
 * Upgrade Page Script
 * Handles billing toggle and Stripe Checkout
 */

let isAnnual = false;

// Billing toggle
const billingToggle = document.getElementById('billing-toggle');
const monthlyCard = document.getElementById('pro-monthly');
const annualCard = document.getElementById('pro-annual');

billingToggle.addEventListener('click', () => {
  isAnnual = !isAnnual;
  billingToggle.classList.toggle('active', isAnnual);

  // Toggle card visibility
  if (isAnnual) {
    monthlyCard.classList.add('hidden');
    annualCard.classList.remove('hidden');
  } else {
    monthlyCard.classList.remove('hidden');
    annualCard.classList.add('hidden');
  }
});

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

  const btn = billingPeriod === 'monthly'
    ? document.getElementById('upgrade-monthly-btn')
    : document.getElementById('upgrade-annual-btn');

  try {
    btn.disabled = true;
    btn.textContent = 'Redirecting to checkout...';

    // Create Stripe Checkout session
    const response = await fetch('/api/payment/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        successUrl: `${window.location.origin}/account.html?success=true`,
        cancelUrl: `${window.location.origin}/account.html?canceled=true`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create checkout session');
    }

    // Redirect to Stripe Checkout
    window.location.href = data.url;

  } catch (error) {
    showError(error.message);
    btn.disabled = false;
    btn.textContent = billingPeriod === 'monthly' ? 'Upgrade to Pro' : 'Upgrade to Pro Annual';
  }
}

// Check for URL parameters
document.addEventListener('DOMContentLoaded', () => {
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
  }

  // Check current user plan
  const user = getUser();
  if (user && user.plan === 'pro') {
    // Already Pro - redirect to account
    showSuccess('You already have Pro! Redirecting to your account...');
    setTimeout(() => {
      window.location.href = '/account.html';
    }, 2000);
  }

  // Update button text if not logged in
  if (!getAuthToken()) {
    const monthlyBtn = document.getElementById('upgrade-monthly-btn');
    const annualBtn = document.getElementById('upgrade-annual-btn');

    monthlyBtn.textContent = 'Login to Upgrade';
    annualBtn.textContent = 'Login to Upgrade';

    monthlyBtn.onclick = () => {
      window.location.href = '/auth.html';
    };
    annualBtn.onclick = () => {
      window.location.href = '/auth.html';
    };
  }
});
