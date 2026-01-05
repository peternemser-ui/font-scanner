/**
 * Unit Tests for Stripe Service
 */

const { TestDatabase, MockStripe } = require('../helpers/testSetup');

// Mock Stripe before requiring the service
const mockStripe = new MockStripe();
jest.mock('stripe', () => {
  return jest.fn(() => mockStripe);
});

const stripeService = require('../../src/services/stripeService');

describe('StripeService', () => {
  let testDb;
  let db;

  beforeAll(async () => {
    testDb = new TestDatabase();
    db = await testDb.setup();

    // Mock getDatabase
    jest.doMock('../../src/db', () => ({
      getDatabase: () => db
    }));
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.clearData();
    mockStripe.reset();
  });

  describe('getOrCreateCustomer', () => {
    it('should create new Stripe customer if none exists', async () => {
      const testUser = await testDb.createTestUser({
        email: 'newcustomer@example.com',
        stripe_customer_id: null
      });

      const customerId = await stripeService.getOrCreateCustomer(testUser.id, testUser.email);

      expect(customerId).toBe('cus_test_123');
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: testUser.email,
        metadata: { userId: testUser.id }
      });

      // Verify customer ID was saved
      const user = await db.get('SELECT stripe_customer_id FROM users WHERE id = ?', [testUser.id]);
      expect(user.stripe_customer_id).toBe('cus_test_123');
    });

    it('should return existing customer ID if already set', async () => {
      const testUser = await testDb.createTestUser({
        email: 'existing@example.com',
        stripe_customer_id: 'cus_existing_123'
      });

      const customerId = await stripeService.getOrCreateCustomer(testUser.id, testUser.email);

      expect(customerId).toBe('cus_existing_123');
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });
  });

  describe('createCheckoutSession', () => {
    it('should create Stripe checkout session', async () => {
      const testUser = await testDb.createTestUser({
        email: 'checkout@example.com'
      });

      const successUrl = 'https://example.com/success';
      const cancelUrl = 'https://example.com/cancel';

      const session = await stripeService.createCheckoutSession(
        testUser.id,
        testUser.email,
        successUrl,
        cancelUrl
      );

      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('url');
      expect(session.url).toContain('checkout.stripe.com');
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();

      const createCall = mockStripe.checkout.sessions.create.mock.calls[0][0];
      expect(createCall.mode).toBe('subscription');
      expect(createCall.success_url).toBe(successUrl);
      expect(createCall.cancel_url).toBe(cancelUrl);
      expect(createCall.metadata.userId).toBe(testUser.id);
    });

    it('should create customer if needed before checkout', async () => {
      const testUser = await testDb.createTestUser({
        email: 'checkout2@example.com',
        stripe_customer_id: null
      });

      await stripeService.createCheckoutSession(
        testUser.id,
        testUser.email,
        'https://example.com/success',
        'https://example.com/cancel'
      );

      expect(mockStripe.customers.create).toHaveBeenCalled();
    });
  });

  describe('createPortalSession', () => {
    it('should create customer portal session', async () => {
      const testUser = await testDb.createTestUser({
        email: 'portal@example.com',
        stripe_customer_id: 'cus_portal_123'
      });

      const returnUrl = 'https://example.com/account';
      const session = await stripeService.createPortalSession(testUser.id, returnUrl);

      expect(session).toHaveProperty('url');
      expect(session.url).toContain('billing.stripe.com');
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_portal_123',
        return_url: returnUrl
      });
    });

    it('should throw error if no stripe customer ID', async () => {
      const testUser = await testDb.createTestUser({
        email: 'noportal@example.com',
        stripe_customer_id: null
      });

      await expect(
        stripeService.createPortalSession(testUser.id, 'https://example.com/account')
      ).rejects.toThrow('No Stripe customer found');
    });
  });

  describe('getSubscription', () => {
    it('should retrieve subscription for user with active subscription', async () => {
      const testUser = await testDb.createTestUser({
        email: 'subscription@example.com',
        plan: 'pro',
        stripe_customer_id: 'cus_sub_123'
      });

      // Create entitlement
      await db.run(
        'INSERT INTO entitlements (user_id, plan, stripe_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?, ?)',
        [testUser.id, 'pro', 'sub_test_123', 'active', new Date(Date.now() + 86400000).toISOString()]
      );

      const subscription = await stripeService.getSubscription(testUser.id);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBe('sub_test_123');
      expect(subscription.status).toBe('active');
      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_test_123');
    });

    it('should return null if no subscription exists', async () => {
      const testUser = await testDb.createTestUser({
        email: 'nosub@example.com',
        plan: 'free'
      });

      const subscription = await stripeService.getSubscription(testUser.id);
      expect(subscription).toBeNull();
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const testUser = await testDb.createTestUser({
        email: 'cancel@example.com',
        plan: 'pro',
        stripe_customer_id: 'cus_cancel_123'
      });

      // Create entitlement
      await db.run(
        'INSERT INTO entitlements (user_id, plan, stripe_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?, ?)',
        [testUser.id, 'pro', 'sub_test_123', 'active', new Date(Date.now() + 86400000).toISOString()]
      );

      const result = await stripeService.cancelSubscription(testUser.id);

      expect(result).toHaveProperty('subscription');
      expect(result.subscription.cancel_at_period_end).toBe(true);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_test_123', {
        cancel_at_period_end: true
      });
    });

    it('should throw error if no active subscription', async () => {
      const testUser = await testDb.createTestUser({
        email: 'nocancel@example.com',
        plan: 'free'
      });

      await expect(
        stripeService.cancelSubscription(testUser.id)
      ).rejects.toThrow('No active subscription found');
    });
  });

  describe('handleWebhook - subscription.created', () => {
    it('should upgrade user to pro on subscription created', async () => {
      const testUser = await testDb.createTestUser({
        email: 'webhook@example.com',
        plan: 'free',
        stripe_customer_id: 'cus_webhook_123'
      });

      const event = {
        id: 'evt_webhook_123',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_webhook_123',
            customer: 'cus_webhook_123',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
            cancel_at_period_end: false
          }
        }
      };

      const result = await stripeService.handleWebhook(event);

      expect(result.processed).toBe(true);

      // Verify user upgraded to pro
      const user = await db.get('SELECT plan FROM users WHERE id = ?', [testUser.id]);
      expect(user.plan).toBe('pro');

      // Verify entitlement created
      const entitlement = await db.get('SELECT * FROM entitlements WHERE user_id = ?', [testUser.id]);
      expect(entitlement).toBeDefined();
      expect(entitlement.stripe_subscription_id).toBe('sub_webhook_123');
      expect(entitlement.status).toBe('active');

      // Verify event marked as processed
      const eventRecord = await db.get('SELECT * FROM stripe_events WHERE id = ?', ['evt_webhook_123']);
      expect(eventRecord.processed).toBe(1);
    });
  });

  describe('handleWebhook - subscription.updated', () => {
    it('should update user plan on subscription status change', async () => {
      const testUser = await testDb.createTestUser({
        email: 'update@example.com',
        plan: 'pro',
        stripe_customer_id: 'cus_update_123'
      });

      const event = {
        id: 'evt_update_123',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_update_123',
            customer: 'cus_update_123',
            status: 'past_due',
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
            cancel_at_period_end: false
          }
        }
      };

      await stripeService.handleWebhook(event);

      // Verify user downgraded to free (past_due is not active)
      const user = await db.get('SELECT plan FROM users WHERE id = ?', [testUser.id]);
      expect(user.plan).toBe('free');
    });
  });

  describe('handleWebhook - subscription.deleted', () => {
    it('should downgrade user to free on subscription deleted', async () => {
      const testUser = await testDb.createTestUser({
        email: 'delete@example.com',
        plan: 'pro',
        stripe_customer_id: 'cus_delete_123'
      });

      const event = {
        id: 'evt_delete_123',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_delete_123',
            customer: 'cus_delete_123'
          }
        }
      };

      await stripeService.handleWebhook(event);

      // Verify user downgraded to free
      const user = await db.get('SELECT plan FROM users WHERE id = ?', [testUser.id]);
      expect(user.plan).toBe('free');
    });
  });

  describe('handleWebhook - idempotency', () => {
    it('should not process duplicate events', async () => {
      const testUser = await testDb.createTestUser({
        email: 'idempotent@example.com',
        stripe_customer_id: 'cus_idem_123'
      });

      const event = {
        id: 'evt_idem_123',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_idem_123',
            customer: 'cus_idem_123',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30
          }
        }
      };

      // Process event first time
      const result1 = await stripeService.handleWebhook(event);
      expect(result1.processed).toBe(true);

      // Process same event again
      const result2 = await stripeService.handleWebhook(event);
      expect(result2.processed).toBe(false);
      expect(result2.reason).toContain('already processed');
    });
  });

  describe('handleWebhook - invoice.payment_succeeded', () => {
    it('should log successful payment', async () => {
      const event = {
        id: 'evt_invoice_123',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_test_123',
            customer: 'cus_invoice_123',
            amount_paid: 2900,
            subscription: 'sub_invoice_123'
          }
        }
      };

      const result = await stripeService.handleWebhook(event);
      expect(result.processed).toBe(true);

      // Verify event was logged
      const eventRecord = await db.get('SELECT * FROM stripe_events WHERE id = ?', ['evt_invoice_123']);
      expect(eventRecord).toBeDefined();
    });
  });

  describe('handleWebhook - invoice.payment_failed', () => {
    it('should handle failed payment', async () => {
      const event = {
        id: 'evt_failed_123',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_failed_123',
            customer: 'cus_failed_123',
            subscription: 'sub_failed_123'
          }
        }
      };

      const result = await stripeService.handleWebhook(event);
      expect(result.processed).toBe(true);
    });
  });
});
