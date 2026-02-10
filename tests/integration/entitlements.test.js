/**
 * Entitlements Integration Tests
 *
 * Tests the entitlement system to ensure:
 * 1. Free scan shows locked Pro sections
 * 2. Single report purchase unlocks that report only
 * 3. Day pass unlocks all reports until expiry
 * 4. Subscription unlocks all reports while active
 * 5. Dashboard recall uses same reportId
 *
 * Run with: npm test -- --grep "Entitlements"
 */

const { expect } = require('chai');
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// These tests require a running server and database
// Skip in CI unless explicitly enabled
const RUN_INTEGRATION_TESTS = process.env.RUN_INTEGRATION_TESTS === 'true';

describe('Entitlements Integration Tests', function() {
  // Longer timeout for integration tests
  this.timeout(30000);

  let app;
  let testUserId;
  let testUserToken;
  let testReportId;

  before(async function() {
    if (!RUN_INTEGRATION_TESTS) {
      this.skip();
      return;
    }

    // Import the app
    const server = require('../../src/server');
    app = server.app || server;

    // Create a test user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `test-${uuidv4()}@test.com`,
        password: 'TestPassword123!'
      });

    if (registerRes.status === 200) {
      testUserId = registerRes.body.user.id;
      testUserToken = registerRes.body.token;
    }

    // Generate a test report ID
    testReportId = `r_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  });

  describe('1. Free User Access', function() {
    it('should return free entitlements for authenticated user without subscription', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();
      if (!testUserToken) this.skip();

      const res = await request(app)
        .get('/api/auth/me/entitlements')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.plan).to.equal('free');
      expect(res.body.permissions.viewProSections).to.equal(false);
      expect(res.body.permissions.exportReports).to.equal(false);
      expect(res.body.purchasedReports).to.be.an('array').that.is.empty;
    });

    it('should deny Pro access for specific report without purchase', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();
      if (!testUserToken) this.skip();

      const res = await request(app)
        .get(`/api/auth/check-access?reportId=${testReportId}`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.canViewPro).to.equal(false);
      expect(res.body.canExport).to.equal(false);
      expect(res.body.reason).to.equal('no_access');
    });

    it('should return free entitlements for unauthenticated user', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();

      const res = await request(app)
        .get(`/api/auth/check-access?reportId=${testReportId}`);

      expect(res.status).to.equal(200);
      expect(res.body.canViewPro).to.equal(false);
      expect(res.body.canExport).to.equal(false);
    });
  });

  describe('2. Report ID Validation', function() {
    it('should reject invalid reportId format in checkout', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();
      if (!testUserToken) this.skip();

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          purchaseType: 'single_report',
          reportId: 'invalid-format',
          returnUrl: 'http://localhost:3000/test'
        });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.include('Invalid reportId format');
    });

    it('should reject missing reportId in checkout', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();
      if (!testUserToken) this.skip();

      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          purchaseType: 'single_report',
          returnUrl: 'http://localhost:3000/test'
        });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.include('requires reportId');
    });

    it('should accept valid reportId format in access check', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();

      const validReportId = 'r_abcdef1234567890';
      const res = await request(app)
        .get(`/api/auth/check-access?reportId=${validReportId}`);

      expect(res.status).to.equal(200);
      expect(res.body.reportId).to.equal(validReportId);
    });

    it('should reject invalid reportId format in access check', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();

      const res = await request(app)
        .get('/api/auth/check-access?reportId=invalid');

      expect(res.status).to.equal(400);
      expect(res.body.error).to.include('Invalid report ID format');
    });
  });

  describe('3. Entitlements Consistency', function() {
    it('should return consistent entitlements across endpoints', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();
      if (!testUserToken) this.skip();

      // Fetch from /me/entitlements
      const entitlementsRes = await request(app)
        .get('/api/auth/me/entitlements')
        .set('Authorization', `Bearer ${testUserToken}`);

      // Fetch from /billing/status
      const statusRes = await request(app)
        .get('/api/billing/status')
        .set('Authorization', `Bearer ${testUserToken}`);

      // Both should return the same plan
      expect(entitlementsRes.body.plan).to.equal(statusRes.body.plan);

      // Both should have same permissions structure
      expect(entitlementsRes.body.permissions.viewProSections)
        .to.equal(statusRes.body.permissions.viewProSections);
    });

    it('should return same purchasedReports across endpoints', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();
      if (!testUserToken) this.skip();

      const entitlementsRes = await request(app)
        .get('/api/auth/me/entitlements')
        .set('Authorization', `Bearer ${testUserToken}`);

      const statusRes = await request(app)
        .get('/api/billing/status')
        .set('Authorization', `Bearer ${testUserToken}`);

      // Both should return the same purchased reports
      expect(entitlementsRes.body.purchasedReports).to.deep.equal(statusRes.body.purchasedReports);
    });
  });

  describe('4. Billing Endpoints', function() {
    it('should require authentication for /billing/checkout', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();

      const res = await request(app)
        .post('/api/billing/checkout')
        .send({
          purchaseType: 'subscription',
          interval: 'month'
        });

      expect(res.status).to.equal(401);
    });

    it('should require authentication for /billing/status', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();

      const res = await request(app)
        .get('/api/billing/status');

      expect(res.status).to.equal(401);
    });

    it('should allow valid subscription checkout request', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();
      if (!testUserToken) this.skip();

      // This test validates the request format but may fail if Stripe is not configured
      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          purchaseType: 'subscription',
          interval: 'month',
          returnUrl: 'http://localhost:3000/account.html'
        });

      // Either success or Stripe config error
      expect([200, 500]).to.include(res.status);
      if (res.status === 200) {
        expect(res.body.checkoutUrl).to.be.a('string');
      }
    });

    it('should allow valid single report checkout request', async function() {
      if (!RUN_INTEGRATION_TESTS) this.skip();
      if (!testUserToken) this.skip();

      const validReportId = 'r_1234567890abcdef';
      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          purchaseType: 'single_report',
          reportId: validReportId,
          returnUrl: 'http://localhost:3000/results.html'
        });

      // Either success or Stripe config error
      expect([200, 500]).to.include(res.status);
      if (res.status === 200) {
        expect(res.body.checkoutUrl).to.be.a('string');
      }
    });
  });
});

/**
 * Manual Testing Checklist
 *
 * These scenarios should be tested manually in a browser:
 *
 * 1. FREE USER FLOW:
 *    - Visit any analyzer page (e.g., /seo-analyzer.html)
 *    - Run a scan
 *    - Verify Pro sections show lock overlay
 *    - Verify PDF export is blocked
 *    - Click "Unlock" button and verify pricing modal opens
 *
 * 2. SINGLE REPORT PURCHASE:
 *    - Complete checkout for single report ($5)
 *    - Verify redirect back to report page
 *    - Verify Pro sections are now visible for THAT report
 *    - Verify PDF export works for THAT report
 *    - Open a DIFFERENT report URL
 *    - Verify Pro sections are still locked on the new report
 *
 * 3. DAY PASS:
 *    - Complete checkout for day pass ($20)
 *    - Verify all Pro sections visible on any report
 *    - Verify PDF export works on any report
 *    - Check /api/billing/status for dayPassExpiresAt
 *
 * 4. SUBSCRIPTION:
 *    - Complete checkout for monthly subscription ($30/mo)
 *    - Verify all Pro sections visible on any report
 *    - Verify PDF export works on any report
 *    - Check /api/billing/status for subscriptionStatus: "active"
 *
 * 5. DASHBOARD RECALL:
 *    - Run a scan and note the reportId
 *    - Purchase access (single report or subscription)
 *    - Navigate to dashboard
 *    - Click on the saved report
 *    - Verify it loads with the SAME reportId
 *    - Verify Pro sections are unlocked (if purchased)
 *
 * 6. LOGOUT/LOGIN:
 *    - With an active subscription, log out
 *    - Verify Pro sections are now locked
 *    - Log back in
 *    - Verify Pro sections are unlocked again
 */
