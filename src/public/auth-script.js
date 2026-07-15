/**
 * Authentication Page Script
 * Handles login and registration forms
 */

function t(key, fallback, params = {}) {
  let value = fallback;
  if (window.i18n && typeof window.i18n.t === 'function') {
    const translated = window.i18n.t(key);
    if (translated !== key) {
      value = translated;
    }
  }
  if (params && typeof value === 'string') {
    Object.keys(params).forEach(param => {
      const regex = new RegExp(`\\{\\{?${param}\\}?\\}`, 'g');
      value = value.replace(regex, params[param]);
    });
  }
  return value;
}

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    showAuthView(tab.dataset.tab);
  });
});

// Clear all error/success messages
function clearMessages() {
  document.querySelectorAll('.error-message, .success-message').forEach(el => {
    el.classList.add('hidden');
    el.textContent = '';
  });
  // These are tied to the forgot-password success state and must not outlive it
  document.getElementById('forgotHint')?.classList.add('hidden');
  document.querySelector('.reset-token-box')?.remove();
}

/**
 * Show one of the auth views and keep the tab strip in sync. The tab strip is
 * hidden for 'forgot'/'reset', which no tab represents.
 */
function showAuthView(view) {
  const views = {
    login: 'loginForm',
    register: 'registerForm',
    forgot: 'forgotPasswordForm',
    reset: 'resetPasswordForm',
  };
  Object.entries(views).forEach(([name, id]) => {
    document.getElementById(id)?.classList.toggle('hidden', name !== view);
  });

  const isTabbed = view === 'login' || view === 'register';
  document.getElementById('authTabs')?.classList.toggle('hidden', !isTabbed);
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.classList.toggle('active', isTabbed && tab.dataset.tab === view);
  });

  clearMessages();
}

// Show error message
function showError(formType, message) {
  const errorEl = document.getElementById(`${formType}Error`);
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

// Show success message
function showSuccess(formType, message) {
  const successEl = document.getElementById(`${formType}Success`);
  successEl.textContent = message;
  successEl.classList.remove('hidden');
}

// Login handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const loginBtn = document.getElementById('loginBtn');

  if (!email || !password) {
    showError('login', 'Please enter email and password');
    return;
  }

  try {
    loginBtn.disabled = true;
    loginBtn.textContent = t('auth.loggingIn', 'Logging in...');

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store token and user data
    // Store token with both key names for compatibility
    localStorage.setItem('sm_token', data.token);
    localStorage.setItem('sm_auth_token', data.token);
    localStorage.setItem('sm_user', JSON.stringify(data.user));

    showSuccess('login', 'Login successful! Redirecting...');

    // Check for redirect parameter (supports both 'redirect' and 'returnTo')
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTo = urlParams.get('redirect') || urlParams.get('returnTo') || '/dashboard.html';

    // Redirect after short delay
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 1000);

  } catch (error) {
    showError('login', error.message);
    loginBtn.disabled = false;
    loginBtn.textContent = t('auth.login', 'Login');
  }
});

// Register handler
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
  const registerBtn = document.getElementById('registerBtn');

  // Validation
  if (!email || !password) {
    showError('register', 'Please enter email and password');
    return;
  }

  if (password !== passwordConfirm) {
    showError('register', 'Passwords do not match');
    return;
  }

  try {
    registerBtn.disabled = true;
    registerBtn.textContent = t('auth.creatingAccount', 'Creating account...');

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, locale: window.i18n?.locale || document.documentElement.lang || 'en' })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    // Store token and user data (both key names for compatibility)
    localStorage.setItem('sm_token', data.token);
    localStorage.setItem('sm_auth_token', data.token);
    localStorage.setItem('sm_user', JSON.stringify(data.user));

    showSuccess('register', 'Account created! Redirecting...');

    // Check for redirect parameter (supports both 'redirect' and 'returnTo')
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTo = urlParams.get('redirect') || urlParams.get('returnTo') || '/dashboard.html';

    // Redirect after short delay
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 1000);

  } catch (error) {
    showError('register', error.message);
    registerBtn.disabled = false;
    registerBtn.textContent = t('auth.createAccount', 'Create Account');
  }
});

// ── Social login: hide unconfigured providers, wire click handlers ──
(async function initSocialButtons() {
  try {
    const res = await fetch('/api/auth/oauth/providers');
    const providers = await res.json();
    const hasAny = providers.google || providers.facebook;

    document.querySelectorAll('.btn-social').forEach(btn => {
      const provider = btn.dataset.provider;
      if (!providers[provider]) {
        btn.style.display = 'none';
      } else {
        btn.addEventListener('click', () => {
          const urlParams = new URLSearchParams(window.location.search);
          const returnTo = urlParams.get('redirect') || urlParams.get('returnTo') || '';
          const oauthUrl = `/api/auth/oauth/${provider}` + (returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '');
          window.location.href = oauthUrl;
        });
      }
    });

    // Hide entire social section if no providers configured
    if (!hasAny) {
      document.querySelectorAll('.social-buttons, .social-divider').forEach(el => el.style.display = 'none');
    }
  } catch {
    // If the endpoint fails, hide social buttons
    document.querySelectorAll('.social-buttons, .social-divider').forEach(el => el.style.display = 'none');
  }
})();

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
  // ── Handle OAuth callback (token in URL fragment) ──────────
  const hash = window.location.hash.substring(1);
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    const oauthToken = hashParams.get('oauth_token');
    const oauthUser = hashParams.get('oauth_user');
    const oauthError = hashParams.get('oauth_error');
    const oauthReturnTo = hashParams.get('returnTo');

    if (oauthError) {
      // Clear hash, show error
      history.replaceState(null, '', window.location.pathname + window.location.search);
      setTimeout(() => showError('login', decodeURIComponent(oauthError)), 100);
    } else if (oauthToken && oauthUser) {
      // Store token and user, redirect
      localStorage.setItem('sm_token', oauthToken);
      localStorage.setItem('sm_auth_token', oauthToken);
      localStorage.setItem('sm_user', oauthUser);
      history.replaceState(null, '', window.location.pathname);
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = oauthReturnTo || urlParams.get('redirect') || urlParams.get('returnTo') || '/dashboard.html';
      window.location.href = redirectTo;
      return;
    }
  }

  const token = localStorage.getItem('sm_token');
  const user = localStorage.getItem('sm_user');

  if (token && user) {
    // Already logged in - redirect to intended page or dashboard
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTo = urlParams.get('redirect') || urlParams.get('returnTo') || '/dashboard.html';
    window.location.href = redirectTo;
    return;
  }

  // Check for reset token in URL params
  const urlParams = new URLSearchParams(window.location.search);

  // Auto-switch to Register tab if mode=signup (e.g., from pricing modal redirect)
  const mode = urlParams.get('mode');
  if (mode === 'signup' || mode === 'register') {
    const registerTab = document.querySelector('[data-tab="register"]');
    if (registerTab) registerTab.click();
  }
  const resetUserId = urlParams.get('userId');
  const resetToken = urlParams.get('token');

  if (resetUserId && resetToken) {
    showResetPasswordForm(resetUserId, resetToken);
  }
});

// Store reset credentials for form submission
let pendingResetUserId = null;
let pendingResetToken = null;

// Show forgot password form
document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  showAuthView('forgot');

  // Carry over anything already typed on the login form so the address does
  // not have to be entered twice.
  const forgotEmail = document.getElementById('forgotEmail');
  const typedEmail = document.getElementById('loginEmail')?.value.trim();
  if (typedEmail && !forgotEmail.value) forgotEmail.value = typedEmail;
  forgotEmail.focus();
});

// Back to login (from either the forgot or the reset view)
['backToLoginLink', 'resetBackToLoginLink'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthView('login');
    document.getElementById('loginEmail')?.focus();
  });
});

// "create an account" escape hatch in the post-request hint
document.getElementById('hintCreateAccountLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  const typedEmail = document.getElementById('forgotEmail')?.value.trim();
  showAuthView('register');
  const registerEmail = document.getElementById('registerEmail');
  if (typedEmail) registerEmail.value = typedEmail;
  registerEmail.focus();
});

// Password show/hide toggles
document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.pwToggle);
    if (!input) return;
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    btn.textContent = reveal ? t('auth.hide', 'Hide') : t('auth.show', 'Show');
    btn.setAttribute('aria-label', reveal
      ? t('auth.hidePassword', 'Hide password')
      : t('auth.showPassword', 'Show password'));
    input.focus();
  });
});

/**
 * Copy text, falling back to a hidden textarea + execCommand when the async
 * clipboard API is unavailable or rejects (insecure context, no permission).
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* fall through */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

// Copy the dev reset link (the button is only rendered in local dev)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="copy-reset-url"]');
  if (!btn) return;
  const original = t('auth.copyLink', 'Copy Link');
  const ok = await copyText(btn.dataset.url);
  // Either way the user gets feedback; the URL is also shown in full above the
  // button so it can be selected by hand if both copy paths fail.
  btn.textContent = ok ? t('auth.copied', 'Copied') : t('auth.copyFailed', 'Select the link above to copy');
  setTimeout(() => { btn.textContent = original; }, 2000);
});

// Forgot password form submission
document.getElementById('forgotPasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email = document.getElementById('forgotEmail').value.trim();
  const forgotBtn = document.getElementById('forgotBtn');

  if (!email) {
    showError('forgot', t('auth.enterEmail', 'Please enter your email address'));
    return;
  }

  try {
    forgotBtn.disabled = true;
    forgotBtn.textContent = t('auth.sending', 'Sending...');

    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, locale: window.i18n?.locale || document.documentElement.lang || 'en' })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || t('auth.failedToSendResetLink', 'Could not send the reset link. Please try again.'));
    }

    // The server deliberately does not reveal whether the address is
    // registered, so this message must not promise that an email was sent to
    // this specific address — only that one was sent if the account exists.
    showSuccess('forgot', t(
      'auth.resetLinkSent',
      'If an account exists for {{email}}, we\'ve sent a password reset link. The link expires in 1 hour.',
      { email }
    ));

    // Give the "no account" case a way out — otherwise the neutral message
    // above is a dead end for anyone who mistyped or never registered.
    document.getElementById('forgotHint')?.classList.remove('hidden');

    // Local dev only: the server returns the token when NODE_ENV !== production
    // so the flow is testable without SMTP. Never present in production.
    if (data.resetToken && data.userId) {
      renderDevResetBox(data.userId, data.resetToken);
    }

  } catch (error) {
    showError('forgot', error.message);
  } finally {
    forgotBtn.disabled = false;
    forgotBtn.textContent = t('auth.sendResetLink', 'Send Reset Link');
  }
});

/**
 * Local-dev helper: renders a clickable reset link when the API returns the
 * token (non-production only). Built with DOM APIs rather than innerHTML so
 * the token never flows through an HTML string.
 */
function renderDevResetBox(userId, resetToken) {
  document.querySelector('.reset-token-box')?.remove();

  const resetUrl = `${window.location.origin}/auth.html?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(resetToken)}`;

  const box = document.createElement('div');
  box.className = 'reset-token-box';

  const title = document.createElement('strong');
  title.textContent = t('auth.devModeTitle', 'Dev mode: no email required');

  const link = document.createElement('a');
  link.className = 'reset-link-btn btn';
  link.href = resetUrl;
  link.textContent = t('auth.resetPasswordNow', 'Reset password now');
  link.style.cssText = 'display:inline-block;width:auto;margin:0.75rem 0;padding:0.625rem 1.25rem;text-decoration:none;';

  const code = document.createElement('code');
  code.textContent = resetUrl;
  code.style.cssText = 'display:block;margin-top:0.5rem;padding:0.5rem;background:var(--bg-input);border-radius:4px;font-size:0.7rem;word-break:break-all;';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'copy-btn';
  copyBtn.dataset.action = 'copy-reset-url';
  copyBtn.dataset.url = resetUrl;
  copyBtn.textContent = t('auth.copyLink', 'Copy Link');

  box.append(title, link, code, copyBtn);

  const successEl = document.getElementById('forgotSuccess');
  successEl.parentNode.insertBefore(box, successEl.nextSibling);
}

// Show reset password form (called when user visits with reset token)
async function showResetPasswordForm(userId, token) {
  showAuthView('reset');

  // Store for form submission
  pendingResetUserId = userId;
  pendingResetToken = token;

  // Verify token is valid
  try {
    const response = await fetch('/api/auth/verify-reset-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token })
    });

    const data = await response.json();

    if (!response.ok || !data.valid) {
      throw new Error(data.error || t('auth.resetLinkInvalid', 'Reset link is invalid or expired'));
    }

    document.getElementById('resetPassword').focus();
  } catch (error) {
    showError('reset', `${error.message}. ${t('auth.requestNewReset', 'Please request a new password reset.')}`);
    document.getElementById('resetBtn').disabled = true;
  }
}

// Reset password form submission
document.getElementById('resetPasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const password = document.getElementById('resetPassword').value;
  const passwordConfirm = document.getElementById('resetPasswordConfirm').value;
  const resetBtn = document.getElementById('resetBtn');

  if (!password) {
    showError('reset', t('auth.enterNewPassword', 'Please enter a new password'));
    return;
  }

  if (password !== passwordConfirm) {
    showError('reset', t('auth.passwordsDoNotMatch', 'Passwords do not match'));
    return;
  }

  if (!pendingResetUserId || !pendingResetToken) {
    showError('reset', t('auth.resetTokenMissing', 'Reset token missing. Please request a new password reset.'));
    return;
  }

  try {
    resetBtn.disabled = true;
    resetBtn.textContent = t('auth.resetting', 'Resetting...');

    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: pendingResetUserId,
        token: pendingResetToken,
        newPassword: password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || t('auth.passwordResetFailed', 'Password reset failed'));
    }

    showSuccess('reset', t('auth.passwordResetSuccess', 'Password reset successfully. Redirecting to login…'));

    // Clear URL params and redirect
    setTimeout(() => {
      window.location.href = '/auth.html';
    }, 2000);

  } catch (error) {
    showError('reset', error.message);
    resetBtn.disabled = false;
    resetBtn.textContent = t('auth.resetPassword', 'Reset Password');
  }
});
