/**
 * Pro Features Utility
 * Shared across all analyzers for managing pro features and authentication
 */

class ProManager {
  constructor() {
    this.user = this.loadUser();
    this.token = this.loadToken();
  }

  /**
   * Load user data from localStorage
   */
  loadUser() {
    try {
      const userData = localStorage.getItem('sm_user');
      return userData ? JSON.parse(userData) : null;
    } catch (e) {
      console.error('Failed to load user:', e);
      return null;
    }
  }

  /**
   * Load JWT token from localStorage
   */
  loadToken() {
    return localStorage.getItem('sm_token');
  }

  /**
   * Save user data and token to localStorage
   */
  saveUser(user, token) {
    localStorage.setItem('sm_user', JSON.stringify(user));
    localStorage.setItem('sm_token', token);
    this.user = user;
    this.token = token;
  }

  /**
   * Clear user data (logout)
   */
  clearUser() {
    localStorage.removeItem('sm_user');
    localStorage.removeItem('sm_token');
    this.user = null;
    this.token = null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.user !== null && this.token !== null;
  }

  /**
   * Check if user has Pro plan
   */
  isPro() {
    return this.user && this.user.plan === 'pro';
  }

  /**
   * Check if user has admin privileges
   */
  isAdmin() {
    return this.user && this.user.is_admin === 1;
  }

  /**
   * Get authorization headers for API calls
   */
  getAuthHeaders() {
    if (!this.token) return {};
    return { 'Authorization': `Bearer ${this.token}` };
  }

  /**
   * Get user email
   */
  getEmail() {
    return this.user?.email || null;
  }

  /**
   * Get user plan
   */
  getPlan() {
    return this.user?.plan || 'free';
  }

  /**
   * Render Pro badge HTML
   */
  renderProBadge() {
    return `<span class="pro-badge"><span style="font-size: 0.7rem;">✨</span> PRO</span>`;
  }

  /**
   * Render Pro unlock banner
   */
  renderProUnlockBanner(stepCount = 4, analyzerName = '') {
    return `
      <div class="pro-unlock-banner" style="margin: 1.5rem 0; list-style: none;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">🔒</span>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.25rem;">
              Unlock ${stepCount} Advanced ${analyzerName} Steps
            </div>
            <div style="font-size: 0.8rem; opacity: 0.8;">
              Get expert-level optimization with Site Mechanic Pro
            </div>
          </div>
          <span style="padding: 0.5rem 1.25rem; background: linear-gradient(135deg, #ffd700, #ffaa00); color: #000; border: none; border-radius: 6px; font-weight: 700; font-size: 0.8rem; white-space: nowrap; display: inline-block;">
            Pro required
          </span>
        </div>
      </div>
    `;
  }

  /**
   * Render pro steps as locked list items
   */
  renderProSteps(steps, analyzerName = '') {
    if (this.isPro()) {
      // Show steps normally for pro users
      return steps.map(step => `<li>${step}</li>`).join('');
    }

    // Show unlock banner + locked steps for free users
    return `
      ${this.renderProUnlockBanner(steps.length, analyzerName)}
      ${steps.map(step => `<li class="pro-step">${step}</li>`).join('')}
    `;
  }

  /**
   * Render pro code overlay (for code blocks)
   */
  renderProCodeOverlay() {
    if (this.isPro()) {
      return ''; // No overlay for pro users
    }

    return `
      <div class="pro-code-overlay">
        <div style="text-align: center; position: relative; z-index: 2;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔒</div>
          <div style="font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem;">
            Advanced Solution
          </div>
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 1rem;">
            Unlock expert-level code examples
          </div>
          <span style="padding: 0.625rem 1.5rem; background: linear-gradient(135deg, #ffd700, #ffaa00); color: #000; border: none; border-radius: 6px; font-weight: 700; font-size: 0.85rem; display: inline-block;">
            Pro required
          </span>
        </div>
      </div>
    `;
  }

  /**
   * Check feature access (returns true if user can access)
   */
  canAccess(feature) {
    if (!this.isPro()) {
      return false;
    }

    // Pro users have access to all features
    return true;
  }

  /**
   * Show upgrade prompt for a specific feature
   */
  showUpgradePrompt(featureName) {
    alert(`${featureName} is a Pro feature. Please sign in with a Pro account.`);
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      // Call logout endpoint (just for consistency, JWT is stateless)
      if (this.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: this.getAuthHeaders()
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      this.clearUser();
      // Redirect to home
      window.location.href = '/';
    }
  }

  /**
   * Refresh user data from server
   */
  async refreshUser() {
    if (!this.token) {
      return null;
    }

    try {
      const response = await fetch('/api/auth/profile', {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        // Token invalid or expired
        this.clearUser();
        return null;
      }

      const data = await response.json();
      if (data.success && data.user) {
        // Update local storage with fresh user data
        localStorage.setItem('sm_user', JSON.stringify(data.user));
        this.user = data.user;
        return data.user;
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }

    return null;
  }

  /**
   * Get subscription details
   */
  async getSubscription() {
    if (!this.token) {
      return null;
    }

    try {
      const response = await fetch('/api/payment/subscription', {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.subscription;
    } catch (error) {
      console.error('Failed to get subscription:', error);
      return null;
    }
  }

  /**
   * Open Stripe Customer Portal
   */
  async openCustomerPortal() {
    if (!this.token) {
      window.location.href = '/auth.html';
      return;
    }

    try {
      const response = await fetch('/api/payment/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({
          returnUrl: window.location.origin + '/account.html'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const data = await response.json();
      const portalUrl = data.portalUrl || data.url;
      if (data.success && portalUrl) {
        window.location.href = portalUrl;
      }
    } catch (error) {
      console.error('Failed to open customer portal:', error);
      alert('Failed to open billing portal. Please try again.');
    }
  }

  /**
   * Format date helper
   */
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

// Create global instance
const proManager = new ProManager();

// Make it globally available
window.proManager = proManager;

// Auto-refresh user data on page load if authenticated
if (proManager.isAuthenticated()) {
  proManager.refreshUser().catch(err => {
    console.error('Auto-refresh failed:', err);
  });
}
