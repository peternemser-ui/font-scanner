/**
 * Integration Tests for Entitlement Enforcement
 *
 * Tests server-side enforcement of entitlement guards:
 * - Scan quota enforcement
 * - Report access control
 * - PDF export gating
 * - Page limit enforcement
 */

const { TestDatabase } = require('../helpers/testSetup');

let mockDbInstance = null;

// Mock database module
jest.mock('../../src/db', () => ({
  getDatabase: () => mockDbInstance,
  Database: jest.requireActual('../../src/db').Database,
  initializeDatabase: jest.fn()
}));

// Mock stripe before requiring modules that use it
jest.mock('stripe', () => {
  return jest.fn(() => ({
    customers: { create: jest.fn().mockResolvedValue({ id: 'cus_test' }) },
    checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_test' }) } },
    subscriptions: {
      retrieve: jest.fn().mockResolvedValue({ id: 'sub_test', cancel_at_period_end: false }),
      list: jest.fn().mockResolvedValue({ data: [] }),
      update: jest.fn()
    },
    billingPortal: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() }
  }));
});

const { resolveEntitlements, canViewProSections, canExportReport } = require('../../src/utils/entitlements');
const { requireReportAccess, requirePdfExport, enforcePageLimit } = require('../../src/middleware/entitlementGuard');
const { resolveEffectivePlan } = require('../../src/middleware/scanQuota');
const usageService = require('../../src/services/usageService');

describe('Entitlement Enforcement', () => {
  let testDb;

  beforeAll(async () => {
    testDb = new TestDatabase();
    mockDbInstance = await testDb.setup();
  });

  afterAll(async () => {
    await testDb.teardown();
    mockDbInstance = null;
  });

  beforeEach(async () => {
    await testDb.clearData();
    // Also clear usage_tracking
    try {
      await mockDbInstance.run('DELETE FROM usage_tracking');
    } catch (e) { /* may not exist */ }
  });

  // =============================================
  // Scan Quota Enforcement
  // =============================================

  describe('Scan Quota', () => {
    it('1. Free user: 10 scans OK, 11th returns quota_exceeded', async () => {
      const user = await testDb.createTestUser({ email: 'scanfree@test.com', plan: 'free' });

      // Use 10 scans
      for (let i = 0; i < 10; i++) {
        const quota = await usageService.checkScanQuota(user.id, null, 'free');
        expect(quota.allowed).toBe(true);
        await usageService.incrementScanUsage(user.id, null);
      }

      // 11th should be denied
      const quota11 = await usageService.checkScanQuota(user.id, null, 'free');
      expect(quota11.allowed).toBe(false);
      expect(quota11.reason).toBe('quota_exceeded');
    });

    it('4. Day Pass user: unlimited scans OK', async () => {
      const quota = await usageService.checkScanQuota(null, 'anon123', 'day_pass');
      expect(quota.allowed).toBe(true);
      expect(quota.remaining).toBe(-1);
      expect(quota.reason).toBe('unlimited');
    });

    it('Pro user: unlimited scans OK', async () => {
      const quota = await usageService.checkScanQuota(null, 'anon456', 'pro_monthly');
      expect(quota.allowed).toBe(true);
      expect(quota.remaining).toBe(-1);
    });
  });

  // =============================================
  // Report Access Enforcement
  // =============================================

  describe('Report Access - requireReportAccess middleware', () => {
    function mockReq(overrides = {}) {
      return {
        user: overrides.user || null,
        params: overrides.params || {},
        query: overrides.query || {},
        body: overrides.body || {}
      };
    }

    function mockRes() {
      const res = {
        statusCode: 200,
        jsonData: null,
        status(code) { res.statusCode = code; return res; },
        json(data) { res.jsonData = data; return res; }
      };
      return res;
    }

    it('2. Unauthenticated user: returns 401', async () => {
      const req = mockReq({ params: { id: 'r_abcdef1234567890' } });
      const res = mockRes();
      const next = jest.fn();

      await requireReportAccess(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.code).toBe('AUTH_REQUIRED');
      expect(next).not.toHaveBeenCalled();
    });

    it('Missing reportId: returns 400', async () => {
      const user = await testDb.createTestUser({ email: 'noid@test.com', plan: 'free' });
      const req = mockReq({ user, params: {} });
      const res = mockRes();
      const next = jest.fn();

      await requireReportAccess(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.code).toBe('MISSING_REPORT_ID');
    });

    it('Free user with valid reportId: passes (canView is true for all)', async () => {
      const user = await testDb.createTestUser({ email: 'viewfree@test.com', plan: 'free' });
      const req = mockReq({ user, params: { id: 'r_abcdef1234567890' } });
      const res = mockRes();
      const next = jest.fn();

      await requireReportAccess(req, res, next);

      // canView is currently true for all valid reports
      expect(next).toHaveBeenCalled();
      expect(req.entitlements).toBeDefined();
      expect(req.reportAccess.canViewPro).toBe(false);
    });

    it('Pro user: passes with canViewPro=true', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const user = await testDb.createTestUser({
        email: 'viewpro@test.com',
        plan: 'pro',
        stripe_subscription_status: 'active',
        stripe_current_period_end: futureDate,
        stripe_subscription_interval: 'month'
      });
      const req = mockReq({ user, params: { id: 'r_abcdef1234567890' } });
      const res = mockRes();
      const next = jest.fn();

      await requireReportAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.reportAccess.canViewPro).toBe(true);
      expect(req.reportAccess.canExport).toBe(true);
    });

    it('10. Single Report purchase: that reportId accessible', async () => {
      const user = await testDb.createTestUser({ email: 'singlerpt@test.com', plan: 'free' });
      await mockDbInstance.run(
        "INSERT INTO report_purchases (user_id, report_id, purchased_at, status) VALUES (?, ?, CURRENT_TIMESTAMP, 'paid')",
        [user.id, 'r_abcdef1234567890']
      );

      const req = mockReq({ user, params: { id: 'r_abcdef1234567890' } });
      const res = mockRes();
      const next = jest.fn();

      await requireReportAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.reportAccess.canViewPro).toBe(true);
      expect(req.reportAccess.canExport).toBe(true);
    });

    it('11. Single Report: other reportIds still have no pro access', async () => {
      const user = await testDb.createTestUser({ email: 'singlerptother@test.com', plan: 'free' });
      await mockDbInstance.run(
        "INSERT INTO report_purchases (user_id, report_id, purchased_at, status) VALUES (?, ?, CURRENT_TIMESTAMP, 'paid')",
        [user.id, 'r_abcdef1234567890']
      );

      const req = mockReq({ user, params: { id: 'r_1111111111111111' } });
      const res = mockRes();
      const next = jest.fn();

      await requireReportAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.reportAccess.canViewPro).toBe(false);
      expect(req.reportAccess.canExport).toBe(false);
    });
  });

  // =============================================
  // PDF Export Enforcement
  // =============================================

  describe('PDF Export - requirePdfExport middleware', () => {
    function mockReq(overrides = {}) {
      return {
        user: overrides.user || null,
        body: overrides.body || {},
        query: overrides.query || {}
      };
    }

    function mockRes() {
      const res = {
        statusCode: 200,
        jsonData: null,
        status(code) { res.statusCode = code; return res; },
        json(data) { res.jsonData = data; return res; }
      };
      return res;
    }

    it('3. Unauthenticated user: returns 401', async () => {
      const req = mockReq({});
      const res = mockRes();
      const next = jest.fn();

      await requirePdfExport(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('Free user without purchase: returns 403', async () => {
      const user = await testDb.createTestUser({ email: 'pdffree@test.com', plan: 'free' });
      const req = mockReq({ user, body: { reportId: 'r_abcdef1234567890' } });
      const res = mockRes();
      const next = jest.fn();

      await requirePdfExport(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData.code).toBe('PDF_EXPORT_DENIED');
    });

    it('Pro user: passes', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const user = await testDb.createTestUser({
        email: 'pdfpro@test.com',
        plan: 'pro',
        stripe_subscription_status: 'active',
        stripe_current_period_end: futureDate,
        stripe_subscription_interval: 'month'
      });
      const req = mockReq({ user, body: { reportId: 'r_abcdef1234567890' } });
      const res = mockRes();
      const next = jest.fn();

      await requirePdfExport(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('Free user with purchased report: PDF exportable', async () => {
      const user = await testDb.createTestUser({ email: 'pdfpurchase@test.com', plan: 'free' });
      await mockDbInstance.run(
        "INSERT INTO report_purchases (user_id, report_id, purchased_at, status) VALUES (?, ?, CURRENT_TIMESTAMP, 'paid')",
        [user.id, 'r_abcdef1234567890']
      );

      const req = mockReq({ user, body: { reportId: 'r_abcdef1234567890' } });
      const res = mockRes();
      const next = jest.fn();

      await requirePdfExport(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // =============================================
  // Page Limit Enforcement
  // =============================================

  describe('enforcePageLimit middleware', () => {
    it('Free user: pages capped at 1', () => {
      const req = {
        user: null,
        planCode: 'free',
        validatedData: { options: { maxPages: 50 } },
        body: { options: { maxPages: 50 } }
      };
      const res = {};
      const next = jest.fn();

      enforcePageLimit(req, res, next);

      expect(req.validatedData.options.maxPages).toBe(1);
      expect(next).toHaveBeenCalled();
    });

    it('Day Pass user: pages capped at 250', () => {
      const req = {
        user: { plan: 'pro', stripe_subscription_interval: 'day', stripe_current_period_end: new Date(Date.now() + 86400000).toISOString() },
        planCode: 'day_pass',
        validatedData: { options: { maxPages: 500 } },
        body: { options: { maxPages: 500 } }
      };
      const res = {};
      const next = jest.fn();

      enforcePageLimit(req, res, next);

      expect(req.validatedData.options.maxPages).toBe(250);
      expect(next).toHaveBeenCalled();
    });

    it('Pro user: pages capped at 250', () => {
      const req = {
        user: { plan: 'pro' },
        planCode: 'pro_monthly',
        validatedData: { options: { maxPages: 100 } },
        body: {}
      };
      const res = {};
      const next = jest.fn();

      enforcePageLimit(req, res, next);

      // 100 <= 250, so no capping
      expect(req.validatedData.options.maxPages).toBe(100);
      expect(next).toHaveBeenCalled();
    });
  });

  // =============================================
  // resolveEffectivePlan
  // =============================================

  describe('resolveEffectivePlan', () => {
    it('returns free for null user', () => {
      expect(resolveEffectivePlan(null)).toBe('free');
    });

    it('returns day_pass for active day pass with valid period', () => {
      const user = {
        plan: 'pro',
        stripe_subscription_status: 'active',
        stripe_subscription_interval: 'day',
        stripe_current_period_end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      };
      expect(resolveEffectivePlan(user)).toBe('day_pass');
    });

    it('returns free for expired day pass', () => {
      const user = {
        plan: 'pro',
        stripe_subscription_status: 'active',
        stripe_subscription_interval: 'day',
        stripe_current_period_end: new Date(Date.now() - 1000).toISOString()
      };
      expect(resolveEffectivePlan(user)).toBe('free');
    });

    it('returns pro_annual for active yearly subscription', () => {
      const user = {
        plan: 'pro',
        stripe_subscription_status: 'active',
        stripe_subscription_interval: 'year',
        stripe_current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };
      expect(resolveEffectivePlan(user)).toBe('pro_annual');
    });

    it('returns pro_monthly for canceled with grace period', () => {
      const user = {
        plan: 'pro',
        stripe_subscription_status: 'canceled',
        stripe_subscription_interval: 'month',
        stripe_current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };
      expect(resolveEffectivePlan(user)).toBe('pro_monthly');
    });

    it('9. Canceled Pro: active until period_end, then free', () => {
      // Within period
      const futureUser = {
        plan: 'pro',
        stripe_subscription_status: 'canceled',
        stripe_subscription_interval: 'month',
        stripe_current_period_end: new Date(Date.now() + 86400000).toISOString()
      };
      expect(resolveEffectivePlan(futureUser)).toBe('pro_monthly');

      // Past period
      const pastUser = {
        plan: 'pro',
        stripe_subscription_status: 'canceled',
        stripe_subscription_interval: 'month',
        stripe_current_period_end: new Date(Date.now() - 86400000).toISOString()
      };
      expect(resolveEffectivePlan(pastUser)).toBe('free');
    });
  });

  // =============================================
  // Report Quota
  // =============================================

  describe('Report Quota', () => {
    it('5. Day Pass user: 30 report saves OK, 31st denied', async () => {
      const user = await testDb.createTestUser({ email: 'rptdaypass@test.com', plan: 'pro' });
      const dayPassExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

      // Use 30 reports
      for (let i = 0; i < 30; i++) {
        const quota = await usageService.checkReportQuota(user.id, 'day_pass', null, dayPassExpiry);
        expect(quota.allowed).toBe(true);
        await usageService.incrementReportUsage(user.id, `r_report${String(i).padStart(10, '0')}0`);
      }

      // 31st should be denied
      const quota31 = await usageService.checkReportQuota(user.id, 'day_pass', null, dayPassExpiry);
      expect(quota31.allowed).toBe(false);
      expect(quota31.reason).toBe('quota_exceeded');
    });

    it('7. Pro Monthly user: 250 reports OK, 251st denied', async () => {
      const user = await testDb.createTestUser({ email: 'rptpro@test.com', plan: 'pro' });
      const subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Simulate 250 used reports by directly updating the usage record
      await usageService.getOrCreateUsage(user.id, null);
      await mockDbInstance.run(
        'UPDATE usage_tracking SET reports_used_in_window = 250, report_window_ends_at = ? WHERE user_id = ?',
        [subscriptionEnd, user.id]
      );

      const quota251 = await usageService.checkReportQuota(user.id, 'pro_monthly', subscriptionEnd, null);
      expect(quota251.allowed).toBe(false);
      expect(quota251.reason).toBe('quota_exceeded');
    });

    it('Pro Annual: unlimited reports', async () => {
      const user = await testDb.createTestUser({ email: 'rptannual@test.com', plan: 'pro' });
      const subscriptionEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      const quota = await usageService.checkReportQuota(user.id, 'pro_annual', subscriptionEnd, null);
      expect(quota.allowed).toBe(true);
      expect(quota.remaining).toBe(-1);
    });

    it('Free user: cannot unlock reports', async () => {
      const user = await testDb.createTestUser({ email: 'rptfree@test.com', plan: 'free' });

      const quota = await usageService.checkReportQuota(user.id, 'free');
      expect(quota.allowed).toBe(false);
      expect(quota.reason).toBe('upgrade_required');
    });
  });

  // =============================================
  // Rolling 24h Window
  // =============================================

  describe('Rolling 24h Scan Window', () => {
    it('getNext24hWindow returns ~24h from now', () => {
      const now = Date.now();
      const next = usageService.getNext24hWindow();
      const diffMs = next.getTime() - now;

      // Should be approximately 24 hours (allow 1 second tolerance)
      expect(diffMs).toBeGreaterThan(24 * 60 * 60 * 1000 - 1000);
      expect(diffMs).toBeLessThan(24 * 60 * 60 * 1000 + 1000);
    });

    it('new usage record gets rolling 24h reset time', async () => {
      const user = await testDb.createTestUser({ email: 'rolling@test.com', plan: 'free' });
      const usage = await usageService.getOrCreateUsage(user.id, null);

      const resetTime = new Date(usage.scans_reset_at);
      const now = Date.now();
      const diffMs = resetTime.getTime() - now;

      // Should be approximately 24 hours
      expect(diffMs).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(diffMs).toBeLessThan(25 * 60 * 60 * 1000);
    });
  });
});
