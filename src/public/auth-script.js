/**
 * Authentication Page Script
 * Handles login and registration forms
 */

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;

    // Update tabs
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update forms
    document.getElementById('loginForm').classList.toggle('hidden', targetTab !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', targetTab !== 'register');

    // Clear error messages
    clearMessages();
  });
});

// Clear all error/success messages
function clearMessages() {
  document.querySelectorAll('.error-message, .success-message').forEach(el => {
    el.classList.add('hidden');
    el.textContent = '';
  });
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
    loginBtn.textContent = 'Logging in...';

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
    localStorage.setItem('sm_token', data.token);
    localStorage.setItem('sm_user', JSON.stringify(data.user));

    showSuccess('login', 'Login successful! Redirecting...');

    // Check for redirect parameter
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTo = urlParams.get('redirect') || '/dashboard.html';

    // Redirect after short delay
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 1000);

  } catch (error) {
    showError('login', error.message);
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
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
    registerBtn.textContent = 'Creating account...';

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    // Store token and user data
    localStorage.setItem('sm_token', data.token);
    localStorage.setItem('sm_user', JSON.stringify(data.user));

    showSuccess('register', 'Account created! Redirecting...');

    // Check for redirect parameter
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTo = urlParams.get('redirect') || '/dashboard.html';

    // Redirect after short delay
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 1000);

  } catch (error) {
    showError('register', error.message);
    registerBtn.disabled = false;
    registerBtn.textContent = 'Create Account';
  }
});

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('sm_token');
  const user = localStorage.getItem('sm_user');

  if (token && user) {
    // Already logged in - redirect to intended page or dashboard
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTo = urlParams.get('redirect') || '/dashboard.html';
    window.location.href = redirectTo;
  }

  // Check for reset token in URL params
  const urlParams = new URLSearchParams(window.location.search);
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
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('forgotPasswordForm').classList.remove('hidden');
  document.getElementById('resetPasswordForm').classList.add('hidden');
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  clearMessages();
});

// Back to login
document.getElementById('backToLoginLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('forgotPasswordForm').classList.add('hidden');
  document.getElementById('resetPasswordForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
  document.querySelector('[data-tab="login"]').classList.add('active');
  clearMessages();
});

// Forgot password form submission
document.getElementById('forgotPasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email = document.getElementById('forgotEmail').value.trim();
  const forgotBtn = document.getElementById('forgotBtn');

  if (!email) {
    showError('forgot', 'Please enter your email address');
    return;
  }

  try {
    forgotBtn.disabled = true;
    forgotBtn.textContent = 'Sending...';

    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send reset link');
    }

    // Show success message
    showSuccess('forgot', 'Reset link generated! Use the link below to reset your password.');

    // DEV ONLY: Show reset token for testing (remove in production)
    if (data.resetToken && data.userId) {
      const resetUrl = `${window.location.origin}/auth.html?userId=${data.userId}&token=${encodeURIComponent(data.resetToken)}`;
      
      // Remove any existing token box
      const existingBox = document.querySelector('.reset-token-box');
      if (existingBox) existingBox.remove();
      
      const tokenBox = document.createElement('div');
      tokenBox.className = 'reset-token-box';
      tokenBox.innerHTML = `
        <strong>🔧 Dev Mode: No Email Required</strong>
        <p style="margin: 0.5rem 0; color: #aaa; font-size: 0.85rem;">Click the button below to reset your password:</p>
        <a href="${resetUrl}" class="reset-link-btn" style="display: inline-block; margin: 0.75rem 0; padding: 0.625rem 1.25rem; background: linear-gradient(135deg, var(--accent-primary), var(--accent-primary-dark)); color: var(--accent-primary-contrast); text-decoration: none; border-radius: 6px; font-weight: 600; font-family: Inter, sans-serif;">Reset Password Now →</a>
        <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.75rem;">Or copy the link:</p>
        <code style="display: block; margin-top: 0.5rem; padding: 0.5rem; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 0.7rem; word-break: break-all;">${resetUrl}</code>
        <button type="button" class="copy-btn" onclick="navigator.clipboard.writeText('${resetUrl}'); this.textContent = '✓ Copied!';">Copy Link</button>
      `;
      
      const successEl = document.getElementById('forgotSuccess');
      successEl.parentNode.insertBefore(tokenBox, successEl.nextSibling);
    }

  } catch (error) {
    showError('forgot', error.message);
  } finally {
    forgotBtn.disabled = false;
    forgotBtn.textContent = 'Send Reset Link';
  }
});

// Show reset password form (called when user visits with reset token)
async function showResetPasswordForm(userId, token) {
  // Hide all other forms
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('forgotPasswordForm').classList.add('hidden');
  document.getElementById('resetPasswordForm').classList.remove('hidden');
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));

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
      throw new Error(data.error || 'Reset link is invalid or expired');
    }
  } catch (error) {
    showError('reset', error.message + '. Please request a new password reset.');
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
    showError('reset', 'Please enter a new password');
    return;
  }

  if (password !== passwordConfirm) {
    showError('reset', 'Passwords do not match');
    return;
  }

  if (!pendingResetUserId || !pendingResetToken) {
    showError('reset', 'Reset token missing. Please request a new password reset.');
    return;
  }

  try {
    resetBtn.disabled = true;
    resetBtn.textContent = 'Resetting...';

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
      throw new Error(data.error || 'Password reset failed');
    }

    showSuccess('reset', 'Password reset successfully! Redirecting to login...');

    // Clear URL params and redirect
    setTimeout(() => {
      window.location.href = '/auth.html';
    }, 2000);

  } catch (error) {
    showError('reset', error.message);
    resetBtn.disabled = false;
    resetBtn.textContent = 'Reset Password';
  }
});
