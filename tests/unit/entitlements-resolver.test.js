/**
 * Unit Tests for Canonical Entitlements Resolver
 *
 * Tests resolveEntitlements, canViewProSections, canExportReport, getReportAccess
 */

const { TestDatabase } = require('../helpers/testSetup');

let mockDbInstance = null;

// Mock database module
jest.mock('../../src/db', () => ({
  getDatabase: () => mockDbInstance,
  Database: jest.requireActual('../../src/db').Database,
  initializeDatabase: jest.fn()
}));

const {
  resolveEntitlements,
  getFullEntitlements,
  canViewProSections,
  canExportReport,
  getReportAccess,
  getDefaultEntitlements
} = require('../../src/utils/entitlements');

describe('Canonical Entitlements Resolver', () => {
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
  });

  // =============================================
  // resolveEntitlements
  // =============================================

  describe('resolveEntitlements', () => {
    it('1. Free user: plan=free, permissions all false, no purchasedReports', async () => {
      const user = await testDb.createTestUser({
        email: 'free@example.com',
        plan: 'free'
      });

      const ent = await resolveEntitlements({ userId: user.id });

      expect(ent.plan).toBe('free');
      expect(ent.subscriptionStatus).toBe('none');
      expect(ent.permissions.accessProTools).toBe(false);
      expect(ent.permissions.viewProSections).toBe(false);
      expect(ent.permissions.exportReports).toBe(false);
      expect(ent.purchasedReports).toEqual([]);
    });

    it('2. Active Pro Monthly: plan=pro, permissions all true', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const user = await testDb.createTestUser({
        email: 'promonthly@example.com',
        plan: 'pro',
        stripe_subscription_status: 'active',
        stripe_current_period_end: futureDate,
        stripe_subscription_interval: 'month'
      });

      const ent = await resolveEntitlements({ userId: user.id });

      expect(ent.plan).toBe('pro');
      expect(ent.subscriptionStatus).toBe('active');
      expect(ent.subscriptionInterval).toBe('month');
      expect(ent.permissions.accessProTools).toBe(true);
      expect(ent.permissions.viewProSections).toBe(true);
      expect(ent.permissions.exportReports).toBe(true);
    });

    it('3. Active Pro Annual: plan=pro, interval=year', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const user = await testDb.createTestUser({
        email: 'proannual@example.com',
        plan: 'pro',
        stripe_subscription_status: 'active',
        stripe_current_period_end: futureDate,
        stripe_subscription_interval: 'year'
      });

      const ent = await resolveEntitlements({ userId: user.id });

      expect(ent.plan).toBe('pro');
      expect(ent.subscriptionInterval).toBe('year');
      expect(ent.permissions.accessProTools).toBe(true);
    });

    it('4. Active Day Pass (within 8h): plan=day_pass, dayPassExpiresAt set', async () => {
      const futureDate = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      const user = await testDb.createTestUser({
        email: 'daypass@example.com',
        plan: 'pro',
        stripe_subscription_status: 'active',
        stripe_current_period_end: futureDate,
        stripe_subscription_interval: 'day'
      });

      const ent = await resolveEntitlements({ userId: user.id });

      expect(ent.plan).toBe('day_pass');
      expect(ent.dayPassExpiresAt).toBe(futureDate);
      expect(ent.permissions.accessProTools).toBe(true);
      expect(ent.permissions.exportReports).toBe(true);
    });

    it('5. Expired Day Pass: plan=free (downgraded)', async () => {
      const pastDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      const user = await testDb.createTestUser({
        email: 'expireddaypass@example.com',
        plan: 'pro',
        stripe_subscription_status: 'active',
        stripe_current_period_end: pastDate,
        stripe_subscription_interval: 'day'
      });

      const ent = await resolveEntitlements({ userId: user.id });

      expect(ent.plan).toBe('free');
      expect(ent.dayPassExpiresAt).toBeNull();
      expect(ent.permissions.accessProTools).toBe(false);
    });

    it('6. Canceled Pro in grace period: plan=pro, cancelAtPeriodEnd=true', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const user = await testDb.createTestUser({
        email: 'canceled@example.com',
        plan: 'pro',
        stripe_subscription_status: 'canceled',
        stripe_current_period_end: futureDate,
        stripe_subscription_interval: 'month'
      });

      const ent = await resolveEntitlements({ userId: user.id });

      expect(ent.plan).toBe('pro');
      expect(ent.cancelAtPeriodEnd).toBe(true);
      expect(ent.permissions.accessProTools).toBe(true);
    });

    it('7. Canceled Pro past period end: plan=free', async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const user = await testDb.createTestUser({
        email: 'expired@example.com',
        plan: 'free',
        stripe_subscription_status: 'canceled',
        stripe_current_period_end: pastDate,
        stripe_subscription_interval: 'month'
      });

      const ent = await resolveEntitlements({ userId: user.id });

      expect(ent.plan).toBe('free');
      expect(ent.permissions.accessProTools).toBe(false);
    });

    it('8. Free user with purchased report: plan=free, purchasedReports includes ID', async () => {
      const user = await testDb.createTestUser({
        email: 'purchaser@example.com',
        plan: 'free'
      });

      await mockDbInstance.run(
        "INSERT INTO report_purchases (user_id, report_id, purchased_at, status) VALUES (?, ?, CURRENT_TIMESTAMP, 'paid')",
        [user.id, 'r_abcdef1234567890']
      );

      const ent = await resolveEntitlements({ userId: user.id });

      expect(ent.plan).toBe('free');
      expect(ent.purchasedReports).toContain('r_abcdef1234567890');
      expect(ent.permissions.viewProSections).toBe(false);
    });

    it('returns default entitlements for null userId', async () => {
      const ent = await resolveEntitlements({ userId: null });

      expect(ent.plan).toBe('free');
      expect(ent.purchasedReports).toEqual([]);
    });

    it('returns default entitlements for non-existent user', async () => {
      const ent = await resolveEntitlements({ userId: 'nonexistent-user-id' });

      expect(ent.plan).toBe('free');
      expect(ent.purchasedReports).toEqual([]);
    });
  });

  // =============================================
  // canViewProSections
  // =============================================

  describe('canViewProSections', () => {
    it('9. true for pro user', () => {
      const ent = {
        plan: 'pro',
        permissions: { viewProSections: true },
        purchasedReports: []
      };
      expect(canViewProSections(ent, 'r_anyreportid12345')).toBe(true);
    });

    it('true for purchased reportId', () => {
      const ent = {
        plan: 'free',
        permissions: { viewProSections: false },
        purchasedReports: ['r_abcdef1234567890']
      };
      expect(canViewProSections(ent, 'r_abcdef1234567890')).toBe(true);
    });

    it('false for other reportId on free plan', () => {
      const ent = {
        plan: 'free',
        permissions: { viewProSections: false },
        purchasedReports: ['r_abcdef1234567890']
      };
      expect(canViewProSections(ent, 'r_differentreport1')).toBe(false);
    });
  });

  // =============================================
  // canExportReport
  // =============================================

  describe('canExportReport', () => {
    it('10. true for pro user', () => {
      const ent = {
        plan: 'pro',
        permissions: { exportReports: true },
        purchasedReports: []
      };
      expect(canExportReport(ent, 'r_anyreportid12345')).toBe(true);
    });

    it('true for purchased reportId', () => {
      const ent = {
        plan: 'free',
        permissions: { exportReports: false },
        purchasedReports: ['r_abcdef1234567890']
      };
      expect(canExportReport(ent, 'r_abcdef1234567890')).toBe(true);
    });

    it('false for non-purchased reportId on free', () => {
      const ent = {
        plan: 'free',
        permissions: { exportReports: false },
        purchasedReports: []
      };
      expect(canExportReport(ent, 'r_anyreportid12345')).toBe(false);
    });
  });

  // =============================================
  // getReportAccess
  // =============================================

  describe('getReportAccess', () => {
    it('11. returns canView=true, canViewPro=true for pro user', async () => {
      const ent = {
        plan: 'pro',
        permissions: { viewProSections: true, exportReports: true },
        purchasedReports: []
      };

      const access = await getReportAccess('r_abcdef1234567890', { userId: 'test' }, ent);

      expect(access.canView).toBe(true);
      expect(access.canViewPro).toBe(true);
      expect(access.canExport).toBe(true);
      expect(access.reason).toBe('global_access');
    });

    it('returns reason=purchased_report for purchased report', async () => {
      const ent = {
        plan: 'free',
        permissions: { viewProSections: false, exportReports: false },
        purchasedReports: ['r_abcdef1234567890']
      };

      const access = await getReportAccess('r_abcdef1234567890', { userId: 'test' }, ent);

      expect(access.canViewPro).toBe(true);
      expect(access.canExport).toBe(true);
      expect(access.reason).toBe('purchased_report');
    });

    it('returns reason=no_access for free user without purchase', async () => {
      const ent = {
        plan: 'free',
        permissions: { viewProSections: false, exportReports: false },
        purchasedReports: []
      };

      const access = await getReportAccess('r_abcdef1234567890', { userId: 'test' }, ent);

      expect(access.canViewPro).toBe(false);
      expect(access.canExport).toBe(false);
      expect(access.reason).toBe('no_access');
    });

    it('returns invalid_report_id for bad format', async () => {
      const ent = getDefaultEntitlements();
      const access = await getReportAccess('bad-id', { userId: 'test' }, ent);

      expect(access.canView).toBe(false);
      expect(access.reason).toBe('invalid_report_id');
    });
  });

  // =============================================
  // getDefaultEntitlements
  // =============================================

  describe('getDefaultEntitlements', () => {
    it('returns correct default shape', () => {
      const defaults = getDefaultEntitlements();

      expect(defaults.plan).toBe('free');
      expect(defaults.subscriptionStatus).toBe('none');
      expect(defaults.subscriptionInterval).toBeNull();
      expect(defaults.currentPeriodEnd).toBeNull();
      expect(defaults.dayPassExpiresAt).toBeNull();
      expect(defaults.cancelAtPeriodEnd).toBe(false);
      expect(defaults.purchasedReports).toEqual([]);
      expect(defaults.permissions.accessProTools).toBe(false);
      expect(defaults.permissions.viewProSections).toBe(false);
      expect(defaults.permissions.exportReports).toBe(false);
    });
  });
});
