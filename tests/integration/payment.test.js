/**
 * Integration Tests for Payment Routes
 */

const request = require('supertest');
const express = require('express');
const { TestDatabase, MockStripe } = require('../helpers/testSetup');

// Mock Stripe before requiring routes
const mockStripe = new MockStripe();
jest.mock('stripe', () => {
  return jest.fn(() => mockStripe);
});

const paymentRoutes = require('../../src/routes/payment');
const authService = require('../../src/services/authService');

describe('Payment Routes', () => {
  let app;
  let testDb;
  let db;
  let authToken;
  let testUser;

  beforeAll(async () => {
    testDb = new TestDatabase();
    db = await testDb.setup();

    // Mock getDatabase
    jest.doMock('../../src/db', () => ({
      getDatabase: () => db
    }));

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/payment', paymentRoutes);
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.clearData();
    mockStripe.reset();

    // Create test user and get auth token
    const registerResult = await authService.register('payment@example.com', 'SecurePass123');
    testUser = registerResult.user;
    authToken = registerResult.token;
  });

  describe('POST /api/payment/create-checkout-session', () => {
    it('should create checkout session with valid auth', async () => {
      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body.url).toContain('checkout.stripe.com');
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .send({
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Authentication required');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .set('Authorization', 'Bearer invalid.token')
        .send({
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        });

      expect(response.status).toBe(401);
    });

    it('should use default URLs if not provided', async () => {
      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();

      const createCall = mockStripe.checkout.sessions.create.mock.calls[0][0];
      expect(createCall.success_url).toBeDefined();
      expect(createCall.cancel_url).toBeDefined();
    });

    it('should create Stripe customer if needed', async () => {
      const response = await request(app)
        .post('/api/payment/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(mockStripe.customers.create).toHaveBeenCalled();

      // Verify customer ID saved to database
      const user = await db.get('SELECT stripe_customer_id FROM users WHERE id = ?', [testUser.id]);
      expect(user.stripe_customer_id).toBeDefined();
    });
  });

  describe('POST /api/payment/create-portal-session', () => {
    beforeEach(async () => {
      // Set up user with Stripe customer ID
      await db.run(
        'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
        ['cus_portal_123', testUser.id]
      );
    });

    it('should create portal session with valid auth', async () => {
      const response = await request(app)
        .post('/api/payment/create-portal-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          returnUrl: 'https://example.com/account'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toContain('billing.stripe.com');
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalled();
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/payment/create-portal-session')
        .send({
          returnUrl: 'https://example.com/account'
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 if no Stripe customer exists', async () => {
      // Remove stripe customer ID
      await db.run('UPDATE users SET stripe_customer_id = NULL WHERE id = ?', [testUser.id]);

      const response = await request(app)
        .post('/api/payment/create-portal-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          returnUrl: 'https://example.com/account'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('No Stripe customer');
    });

    it('should use default return URL if not provided', async () => {
      const response = await request(app)
        .post('/api/payment/create-portal-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalled();
    });
  });

  describe('GET /api/payment/subscription', () => {
    it('should return subscription for pro user', async () => {
      // Upgrade user to pro
      await db.run('UPDATE users SET plan = ? WHERE id = ?', ['pro', testUser.id]);

      // Create entitlement
      const periodEnd = new Date(Date.now() + 86400000 * 30).toISOString();
      await db.run(
        'INSERT INTO entitlements (user_id, plan, stripe_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?, ?)',
        [testUser.id, 'pro', 'sub_test_123', 'active', periodEnd]
      );

      const response = await request(app)
        .get('/api/payment/subscription')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('subscription');
      expect(response.body).toHaveProperty('plan', 'pro');
      expect(response.body.subscription.id).toBe('sub_test_123');
      expect(response.body.subscription.status).toBe('active');
    });

    it('should return null subscription for free user', async () => {
      const response = await request(app)
        .get('/api/payment/subscription')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.subscription).toBeNull();
      expect(response.body.plan).toBe('free');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/payment/subscription');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/payment/cancel-subscription', () => {
    beforeEach(async () => {
      // Set up pro user with subscription
      await db.run('UPDATE users SET plan = ?, stripe_customer_id = ? WHERE id = ?',
        ['pro', 'cus_cancel_123', testUser.id]);

      await db.run(
        'INSERT INTO entitlements (user_id, plan, stripe_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?, ?)',
        [testUser.id, 'pro', 'sub_cancel_123', 'active', new Date(Date.now() + 86400000 * 30).toISOString()]
      );
    });

    it('should cancel subscription at period end', async () => {
      const response = await request(app)
        .post('/api/payment/cancel-subscription')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('subscription');
      expect(response.body.subscription.cancel_at_period_end).toBe(true);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_cancel_123', {
        cancel_at_period_end: true
      });
    });

    it('should return 400 for free user without subscription', async () => {
      // Downgrade to free
      await db.run('UPDATE users SET plan = ? WHERE id = ?', ['free', testUser.id]);
      await db.run('DELETE FROM entitlements WHERE user_id = ?', [testUser.id]);

      const response = await request(app)
        .post('/api/payment/cancel-subscription')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('No active subscription');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/payment/cancel-subscription');

      expect(response.status).toBe(401);
    });
  });

  describe('Complete Payment Flow', () => {
    it('should complete checkout → webhook → subscription retrieval flow', async () => {
      // 1. Create checkout session
      const checkoutResponse = await request(app)
        .post('/api/payment/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        });

      expect(checkoutResponse.status).toBe(200);
      expect(checkoutResponse.body.url).toBeDefined();

      // 2. Simulate subscription created (would come from webhook)
      await db.run('UPDATE users SET plan = ? WHERE id = ?', ['pro', testUser.id]);
      await db.run(
        'INSERT INTO entitlements (user_id, plan, stripe_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?, ?)',
        [testUser.id, 'pro', 'sub_flow_123', 'active', new Date(Date.now() + 86400000 * 30).toISOString()]
      );

      // 3. Get subscription details
      const subscriptionResponse = await request(app)
        .get('/api/payment/subscription')
        .set('Authorization', `Bearer ${authToken}`);

      expect(subscriptionResponse.status).toBe(200);
      expect(subscriptionResponse.body.plan).toBe('pro');
      expect(subscriptionResponse.body.subscription.status).toBe('active');

      // 4. Open customer portal
      const portalResponse = await request(app)
        .post('/api/payment/create-portal-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ returnUrl: 'https://example.com/account' });

      expect(portalResponse.status).toBe(200);
      expect(portalResponse.body.url).toBeDefined();
    });
  });
});
