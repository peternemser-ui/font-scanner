/**
 * Unit Tests for ProManager Frontend Utility
 */

// Mock localStorage
const localStorageMock = (() => {
  let store = {};

  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

global.localStorage = localStorageMock;

// Mock fetch for API calls
global.fetch = jest.fn();

// Load ProManager class
const fs = require('fs');
const path = require('path');
const proUtilsCode = fs.readFileSync(
  path.join(__dirname, '../../src/public/pro-utils.js'),
  'utf8'
);

// Execute the code to define ProManager class
eval(proUtilsCode.replace('window.proManager = proManager;', ''));

describe('ProManager', () => {
  let manager;

  beforeEach(() => {
    localStorage.clear();
    fetch.mockClear();
    manager = new ProManager();
  });

  describe('Constructor and Storage', () => {
    it('should initialize with no user if localStorage is empty', () => {
      expect(manager.user).toBeNull();
      expect(manager.isAuthenticated()).toBe(false);
    });

    it('should load user from localStorage if exists', () => {
      const userData = {
        id: 'user-123',
        email: 'test@example.com',
        plan: 'free'
      };
      const token = 'test_token_123';

      localStorage.setItem('sm_user', JSON.stringify(userData));
      localStorage.setItem('sm_token', token);

      const newManager = new ProManager();

      expect(newManager.user).toBeDefined();
      expect(newManager.user.email).toBe(userData.email);
      expect(newManager.user.plan).toBe(userData.plan);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('sm_user', 'invalid json');
      localStorage.setItem('sm_token', 'token');

      const newManager = new ProManager();

      expect(newManager.user).toBeNull();
      expect(newManager.isAuthenticated()).toBe(false);
    });
  });

  describe('saveUser', () => {
    it('should save user and token to localStorage', () => {
      const user = {
        id: 'user-456',
        email: 'save@example.com',
        plan: 'pro'
      };
      const token = 'save_token_456';

      manager.saveUser(user, token);

      expect(localStorage.getItem('sm_user')).toBe(JSON.stringify(user));
      expect(localStorage.getItem('sm_token')).toBe(token);
      expect(manager.user.email).toBe(user.email);
      expect(manager.token).toBe(token);
    });
  });

  describe('clearUser', () => {
    it('should remove user and token from localStorage', () => {
      const user = { id: 'user-789', email: 'clear@example.com', plan: 'free' };
      manager.saveUser(user, 'clear_token');

      manager.clearUser();

      expect(localStorage.getItem('sm_user')).toBeNull();
      expect(localStorage.getItem('sm_token')).toBeNull();
      expect(manager.user).toBeNull();
      expect(manager.token).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user and token exist', () => {
      manager.saveUser({ id: '1', email: 'test@example.com', plan: 'free' }, 'token');
      expect(manager.isAuthenticated()).toBe(true);
    });

    it('should return false when no user', () => {
      expect(manager.isAuthenticated()).toBe(false);
    });

    it('should return false when user exists but no token', () => {
      manager.user = { id: '1', email: 'test@example.com' };
      manager.token = null;
      expect(manager.isAuthenticated()).toBe(false);
    });
  });

  describe('isPro', () => {
    it('should return true for pro user', () => {
      manager.saveUser({ id: '1', email: 'pro@example.com', plan: 'pro' }, 'token');
      expect(manager.isPro()).toBe(true);
    });

    it('should return false for free user', () => {
      manager.saveUser({ id: '1', email: 'free@example.com', plan: 'free' }, 'token');
      expect(manager.isPro()).toBe(false);
    });

    it('should return false when not authenticated', () => {
      expect(manager.isPro()).toBe(false);
    });
  });

  describe('getAuthHeaders', () => {
    it('should return authorization header with token', () => {
      manager.saveUser({ id: '1', email: 'test@example.com', plan: 'free' }, 'test_token_123');

      const headers = manager.getAuthHeaders();

      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toBe('Bearer test_token_123');
    });

    it('should return empty object when no token', () => {
      const headers = manager.getAuthHeaders();
      expect(headers).toEqual({});
    });
  });

  describe('getEmail', () => {
    it('should return user email', () => {
      manager.saveUser({ id: '1', email: 'getemail@example.com', plan: 'free' }, 'token');
      expect(manager.getEmail()).toBe('getemail@example.com');
    });

    it('should return null when no user', () => {
      expect(manager.getEmail()).toBeNull();
    });
  });

  describe('getPlan', () => {
    it('should return user plan', () => {
      manager.saveUser({ id: '1', email: 'test@example.com', plan: 'pro' }, 'token');
      expect(manager.getPlan()).toBe('pro');
    });

    it('should return "free" when no user', () => {
      expect(manager.getPlan()).toBe('free');
    });
  });

  describe('renderProBadge', () => {
    it('should render pro badge HTML', () => {
      const badge = manager.renderProBadge();

      expect(badge).toContain('pro-badge');
      expect(badge).toContain('✨');
      expect(badge).toContain('PRO');
    });
  });

  describe('renderProUnlockBanner', () => {
    it('should render unlock banner with step count and analyzer name', () => {
      const banner = manager.renderProUnlockBanner(4, 'SEO');

      expect(banner).toContain('pro-unlock-banner');
      expect(banner).toContain('4');
      expect(banner).toContain('SEO');
      expect(banner).toContain('Upgrade to Pro');
      expect(banner).toContain('/upgrade.html');
    });

    it('should use default values when not provided', () => {
      const banner = manager.renderProUnlockBanner();

      expect(banner).toContain('4'); // default step count
      expect(banner).toContain('Upgrade to Pro');
    });
  });

  describe('renderProSteps', () => {
    const steps = [
      'Advanced step 1',
      'Advanced step 2',
      'Advanced step 3',
      'Advanced step 4'
    ];

    it('should render steps normally for pro users', () => {
      manager.saveUser({ id: '1', email: 'pro@example.com', plan: 'pro' }, 'token');

      const html = manager.renderProSteps(steps, 'Security');

      expect(html).toContain('<li>Advanced step 1</li>');
      expect(html).toContain('<li>Advanced step 2</li>');
      expect(html).not.toContain('pro-unlock-banner');
      expect(html).not.toContain('pro-step');
    });

    it('should render locked steps for free users', () => {
      manager.saveUser({ id: '1', email: 'free@example.com', plan: 'free' }, 'token');

      const html = manager.renderProSteps(steps, 'Security');

      expect(html).toContain('pro-unlock-banner');
      expect(html).toContain('pro-step');
      expect(html).toContain('Advanced step 1');
      expect(html).toContain('Upgrade to Pro');
    });

    it('should render locked steps for unauthenticated users', () => {
      const html = manager.renderProSteps(steps, 'Performance');

      expect(html).toContain('pro-unlock-banner');
      expect(html).toContain('pro-step');
      expect(html).toContain('Upgrade to Pro');
    });
  });

  describe('renderProCodeOverlay', () => {
    it('should return empty string for pro users', () => {
      manager.saveUser({ id: '1', email: 'pro@example.com', plan: 'pro' }, 'token');

      const overlay = manager.renderProCodeOverlay();

      expect(overlay).toBe('');
    });

    it('should render overlay for free users', () => {
      manager.saveUser({ id: '1', email: 'free@example.com', plan: 'free' }, 'token');

      const overlay = manager.renderProCodeOverlay();

      expect(overlay).toContain('pro-code-overlay');
      expect(overlay).toContain('Advanced Solution');
      expect(overlay).toContain('Upgrade to Pro');
    });
  });

  describe('canAccess', () => {
    it('should return true for pro users', () => {
      manager.saveUser({ id: '1', email: 'pro@example.com', plan: 'pro' }, 'token');
      expect(manager.canAccess('advanced-feature')).toBe(true);
    });

    it('should return false for free users', () => {
      manager.saveUser({ id: '1', email: 'free@example.com', plan: 'free' }, 'token');
      expect(manager.canAccess('advanced-feature')).toBe(false);
    });

    it('should return false for unauthenticated users', () => {
      expect(manager.canAccess('advanced-feature')).toBe(false);
    });
  });

  describe('refreshUser', () => {
    it('should fetch user data from API and update localStorage', async () => {
      manager.saveUser({ id: '1', email: 'old@example.com', plan: 'free' }, 'test_token');

      const updatedUser = { id: '1', email: 'updated@example.com', plan: 'pro', created_at: '2024-01-01' };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: updatedUser })
      });

      const result = await manager.refreshUser();

      expect(fetch).toHaveBeenCalledWith('/api/auth/profile', {
        headers: { Authorization: 'Bearer test_token' }
      });

      expect(result.email).toBe('updated@example.com');
      expect(result.plan).toBe('pro');
      expect(localStorage.getItem('sm_user')).toContain('updated@example.com');
    });

    it('should clear user data if token is invalid', async () => {
      manager.saveUser({ id: '1', email: 'test@example.com', plan: 'free' }, 'invalid_token');

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      const result = await manager.refreshUser();

      expect(result).toBeNull();
      expect(manager.user).toBeNull();
      expect(manager.token).toBeNull();
      expect(localStorage.getItem('sm_user')).toBeNull();
    });

    it('should return null if no token exists', async () => {
      const result = await manager.refreshUser();

      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      manager.saveUser({ id: '1', email: 'test@example.com', plan: 'free' }, 'token');

      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await manager.refreshUser();

      expect(result).toBeNull();
    });
  });

  describe('getSubscription', () => {
    it('should fetch subscription data from API', async () => {
      manager.saveUser({ id: '1', email: 'pro@example.com', plan: 'pro' }, 'test_token');

      const subscriptionData = {
        id: 'sub_123',
        status: 'active',
        currentPeriodEnd: '2025-02-01',
        cancelAtPeriodEnd: false
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscription: subscriptionData })
      });

      const result = await manager.getSubscription();

      expect(fetch).toHaveBeenCalledWith('/api/payment/subscription', {
        headers: { Authorization: 'Bearer test_token' }
      });

      expect(result.id).toBe('sub_123');
      expect(result.status).toBe('active');
    });

    it('should return null if no token', async () => {
      const result = await manager.getSubscription();
      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should return null on API error', async () => {
      manager.saveUser({ id: '1', email: 'test@example.com', plan: 'free' }, 'token');

      fetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await manager.getSubscription();
      expect(result).toBeNull();
    });
  });

  describe('formatDate', () => {
    it('should format date string to readable format', () => {
      const formatted = manager.formatDate('2024-01-15T10:00:00.000Z');

      expect(formatted).toContain('January');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2024');
    });

    it('should return empty string for null input', () => {
      expect(manager.formatDate(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(manager.formatDate(undefined)).toBe('');
    });
  });

  describe('logout', () => {
    it('should call logout endpoint and clear user data', async () => {
      manager.saveUser({ id: '1', email: 'test@example.com', plan: 'free' }, 'test_token');

      // Mock window.location
      delete global.window;
      global.window = { location: { href: '' } };

      fetch.mockResolvedValueOnce({ ok: true });

      await manager.logout();

      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer test_token' }
      });

      expect(manager.user).toBeNull();
      expect(manager.token).toBeNull();
      expect(localStorage.getItem('sm_user')).toBeNull();
      expect(window.location.href).toBe('/');
    });

    it('should clear user data even if API call fails', async () => {
      manager.saveUser({ id: '1', email: 'test@example.com', plan: 'free' }, 'test_token');

      delete global.window;
      global.window = { location: { href: '' } };

      fetch.mockRejectedValueOnce(new Error('Network error'));

      await manager.logout();

      expect(manager.user).toBeNull();
      expect(window.location.href).toBe('/');
    });
  });
});
