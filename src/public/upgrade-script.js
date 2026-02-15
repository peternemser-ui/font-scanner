/**
 * Upgrade Page Script
 * Handles Stripe Checkout for all plans with i18n support
 */

// i18n helper - falls back to English text if i18n not ready
function t(key, fallback) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    const val = window.i18n.t(key);
    return (val === key && fallback) ? fallback : val;
  }
  return fallback || key;
}

// Show/hide messages
function showError(message) {
  const errorEl = document.getElementById('error-message');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  document.getElementById('success-message').classList.add('hidden');
  errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showSuccess(message) {
  const successEl = document.getElementById('success-message');
  successEl.textContent = message;
  successEl.classList.remove('hidden');
  document.getElementById('error-message').classList.add('hidden');
  successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearMessages() {
  document.getElementById('error-message').classList.add('hidden');
  document.getElementById('success-message').classList.add('hidden');
}

// Auth helpers
function getAuthToken() {
  return localStorage.getItem('sm_token');
}

function getUser() {
  try {
    const userData = localStorage.getItem('sm_user');
    return userData ? JSON.parse(userData) : null;
  } catch (e) {
    return null;
  }
}

// Update template-based text (save badge, effective monthly) using i18n + pricing config
function updateDynamicText() {
  const pricing = window.PRICING;
  if (!pricing) return;

  const savings = pricing.plans.pro_annual?.savings || 60;
  const effectiveMonthly = pricing.plans.pro_annual?.effectiveMonthly || 24;
  const annualPrice = pricing.plans.pro_annual?.price || 290;
  const monthlyPrice = pricing.plans.pro_monthly?.price || 29;
  const dayPassPrice = pricing.plans.day_pass?.price || 20;

  // Update prices from config
  const priceMonthly = document.getElementById('price-monthly');
  if (priceMonthly) priceMonthly.textContent = `$${monthlyPrice}`;

  const priceYearly = document.getElementById('price-yearly');
  if (priceYearly) priceYearly.textContent = `$${annualPrice}`;

  const priceDaypass = document.getElementById('price-daypass');
  if (priceDaypass) priceDaypass.textContent = `$${dayPassPrice}`;

  // Update save badge with template
  const saveBadge = document.getElementById('save-badge');
  if (saveBadge) {
    const saveText = t('pricing.badges.save', 'Save ${{amount}}');
    saveBadge.textContent = saveText.replace('{{amount}}', savings);
  }

  // Update effective monthly with template
  const effectiveEl = document.getElementById('effective-monthly');
  if (effectiveEl) {
    const effectiveText = t('pricing.periods.effectiveMonthly', '${{amount}}/mo effective');
    effectiveEl.textContent = effectiveText.replace('{{amount}}', effectiveMonthly);
  }
}

// Checkout handler
async function handleUpgrade(billingPeriod) {
  clearMessages();

  const token = getAuthToken();
  if (!token) {
    showError(t('pricing.modal.pleaseLoginToContinue', 'Please log in to continue'));
    setTimeout(() => {
      window.location.href = '/auth.html';
    }, 2000);
    return;
  }

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

  const btn = btnMap[billingPeriod];
  const interval = intervalMap[billingPeriod];
  const originalText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = t('pricing.buttons.redirecting', 'Redirecting to checkout...');

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
      throw new Error(data.message || data.error || 'Failed to create checkout session');
    }

    window.location.href = data.checkoutUrl || data.url;

  } catch (error) {
    showError(error.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// Button click handlers
document.getElementById('upgrade-monthly-btn').addEventListener('click', () => handleUpgrade('monthly'));
document.getElementById('upgrade-annual-btn').addEventListener('click', () => handleUpgrade('annual'));
document.getElementById('upgrade-daypass-btn').addEventListener('click', () => handleUpgrade('day'));

// Page initialization
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);

  // Check if payment was canceled
  if (urlParams.get('canceled') === 'true') {
    showError(t('pricing.page.paymentCanceled', 'Payment was canceled. No charges were made.'));
  }

  // Check if payment succeeded
  if (urlParams.get('success') === 'true') {
    showSuccess(t('pricing.page.paymentSuccess', 'Payment successful! Redirecting to your account...'));
    setTimeout(() => {
      window.location.href = '/account.html';
    }, 2000);
    return;
  }

  // Update dynamic text (save badge, effective monthly, prices from config)
  updateDynamicText();

  // Check current user plan
  const token = getAuthToken();
  if (token) {
    try {
      const resp = await fetch('/api/billing/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const billing = await resp.json();
        if (billing.plan === 'pro') {
          showSuccess(t('pricing.page.alreadyPro', 'You already have Pro! Redirecting to your account...'));
          setTimeout(() => {
            window.location.href = '/account.html';
          }, 2000);
        } else if (billing.plan === 'day_pass') {
          // Day Pass users - mark day pass as current, can still upgrade to Pro
          const dayPassBtn = document.getElementById('upgrade-daypass-btn');
          dayPassBtn.textContent = t('pricing.buttons.currentPlan', 'Current Plan');
          dayPassBtn.disabled = true;
          dayPassBtn.className = 'sm-plan-card__btn sm-plan-card__btn--current';
          document.getElementById('card-daypass').classList.add('sm-plan-card--current');
        }
      }
    } catch (e) {
      // Ignore - allow user to stay on upgrade page
    }
  }

  // Update button text if not logged in
  if (!getAuthToken()) {
    const loginText = t('pricing.buttons.loginToUpgrade', 'Login to Upgrade');
    const monthlyBtn = document.getElementById('upgrade-monthly-btn');
    const annualBtn = document.getElementById('upgrade-annual-btn');
    const daypassBtn = document.getElementById('upgrade-daypass-btn');

    monthlyBtn.textContent = loginText;
    annualBtn.textContent = loginText;
    daypassBtn.textContent = loginText;

    const redirectToAuth = () => { window.location.href = '/auth.html'; };
    monthlyBtn.onclick = redirectToAuth;
    annualBtn.onclick = redirectToAuth;
    daypassBtn.onclick = redirectToAuth;
  }
});

// Re-apply dynamic text when language changes
window.addEventListener('languageChanged', () => {
  updateDynamicText();

  // Re-apply login text if not logged in
  if (!getAuthToken()) {
    const loginText = t('pricing.buttons.loginToUpgrade', 'Login to Upgrade');
    const monthlyBtn = document.getElementById('upgrade-monthly-btn');
    const annualBtn = document.getElementById('upgrade-annual-btn');
    const daypassBtn = document.getElementById('upgrade-daypass-btn');
    if (monthlyBtn && !monthlyBtn.disabled) monthlyBtn.textContent = loginText;
    if (annualBtn && !annualBtn.disabled) annualBtn.textContent = loginText;
    if (daypassBtn && !daypassBtn.disabled) daypassBtn.textContent = loginText;
  }
});
