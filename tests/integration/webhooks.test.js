/**
 * Integration Tests for Stripe Webhooks
 */

const request = require('supertest');
const express = require('express');
const { TestDatabase, MockStripe } = require('../helpers/testSetup');

// Mock Stripe before requiring routes
const mockStripe = new MockStripe();
jest.mock('stripe', () => {
  return jest.fn(() => mockStripe);
});

const webhookRoutes = require('../../src/routes/webhooks');

describe('Stripe Webhook Handler', () => {
  let app;
  let testDb;
  let db;

  beforeAll(async () => {
    testDb = new TestDatabase();
    db = await testDb.setup();

    // Mock getDatabase
    jest.doMock('../../src/db', () => ({
      getDatabase: () => db
    }));

    // Setup Express app with raw body parser (required for webhooks)
    app = express();
    app.use('/api/webhooks', webhookRoutes);
    app.use(express.json());
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.clearData();
    mockStripe.reset();
  });

  describe('POST /api/webhooks/stripe', () => {
    describe('customer.subscription.created', () => {
      it('should upgrade user to pro on subscription created', async () => {
        const testUser = await testDb.createTestUser({
          email: 'webhook1@example.com',
          plan: 'free',
          stripe_customer_id: 'cus_webhook1'
        });

        const event = {
          id: 'evt_create_123',
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_webhook1',
              customer: 'cus_webhook1',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              cancel_at_period_end: false
            }
          }
        };

        const response = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('received', true);
        expect(response.body).toHaveProperty('processed', true);

        // Verify user upgraded
        const user = await db.get('SELECT plan FROM users WHERE id = ?', [testUser.id]);
        expect(user.plan).toBe('pro');

        // Verify entitlement created
        const entitlement = await db.get('SELECT * FROM entitlements WHERE user_id = ?', [testUser.id]);
        expect(entitlement).toBeDefined();
        expect(entitlement.stripe_subscription_id).toBe('sub_webhook1');
        expect(entitlement.status).toBe('active');
      });

      it('should not process duplicate events', async () => {
        const testUser = await testDb.createTestUser({
          email: 'duplicate@example.com',
          stripe_customer_id: 'cus_duplicate'
        });

        const event = {
          id: 'evt_duplicate_123',
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_duplicate',
              customer: 'cus_duplicate',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30
            }
          }
        };

        // Send event first time
        const response1 = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(event);

        expect(response1.status).toBe(200);
        expect(response1.body.processed).toBe(true);

        // Send same event again
        const response2 = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(event);

        expect(response2.status).toBe(200);
        expect(response2.body.processed).toBe(false);
        expect(response2.body.reason).toContain('already processed');
      });
    });

    describe('customer.subscription.updated', () => {
      it('should update user plan when subscription status changes', async () => {
        const testUser = await testDb.createTestUser({
          email: 'update@example.com',
          plan: 'pro',
          stripe_customer_id: 'cus_update'
        });

        // Create existing entitlement
        await db.run(
          'INSERT INTO entitlements (user_id, plan, stripe_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?, ?)',
          [testUser.id, 'pro', 'sub_update', 'active', new Date(Date.now() + 86400000).toISOString()]
        );

        const event = {
          id: 'evt_update_123',
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_update',
              customer: 'cus_update',
              status: 'past_due',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              cancel_at_period_end: false
            }
          }
        };

        const response = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.processed).toBe(true);

        // Verify user downgraded (past_due is not active)
        const user = await db.get('SELECT plan FROM users WHERE id = ?', [testUser.id]);
        expect(user.plan).toBe('free');

        // Verify entitlement updated
        const entitlement = await db.get('SELECT * FROM entitlements WHERE user_id = ?', [testUser.id]);
        expect(entitlement.status).toBe('past_due');
      });

      it('should handle cancel_at_period_end flag', async () => {
        const testUser = await testDb.createTestUser({
          email: 'cancelperiod@example.com',
          plan: 'pro',
          stripe_customer_id: 'cus_cancelperiod'
        });

        await db.run(
          'INSERT INTO entitlements (user_id, plan, stripe_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?, ?)',
          [testUser.id, 'pro', 'sub_cancelperiod', 'active', new Date(Date.now() + 86400000).toISOString()]
        );

        const event = {
          id: 'evt_cancelperiod_123',
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_cancelperiod',
              customer: 'cus_cancelperiod',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              cancel_at_period_end: true
            }
          }
        };

        const response = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(event);

        expect(response.status).toBe(200);

        // User should still be pro until period ends
        const user = await db.get('SELECT plan FROM users WHERE id = ?', [testUser.id]);
        expect(user.plan).toBe('pro');

        // Verify entitlement has cancel flag
        const entitlement = await db.get('SELECT * FROM entitlements WHERE user_id = ?', [testUser.id]);
        expect(entitlement.cancel_at_period_end).toBe(1);
      });
    });

    describe('customer.subscription.deleted', () => {
      it('should downgrade user to free on subscription deleted', async () => {
        const testUser = await testDb.createTestUser({
          email: 'delete@example.com',
          plan: 'pro',
          stripe_customer_id: 'cus_delete'
        });

        await db.run(
          'INSERT INTO entitlements (user_id, plan, stripe_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?, ?)',
          [testUser.id, 'pro', 'sub_delete', 'active', new Date(Date.now() + 86400000).toISOString()]
        );

        const event = {
          id: 'evt_delete_123',
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_delete',
              customer: 'cus_delete'
            }
          }
        };

        const response = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.processed).toBe(true);

        // Verify user downgraded to free
        const user = await db.get('SELECT plan FROM users WHERE id = ?', [testUser.id]);
        expect(user.plan).toBe('free');
      });
    });

    describe('invoice.payment_succeeded', () => {
      it('should log successful payment', async () => {
        const event = {
          id: 'evt_invoice_success_123',
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              id: 'in_success_123',
              customer: 'cus_invoice',
              amount_paid: 2900,
              subscription: 'sub_invoice'
            }
          }
        };

        const response = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.processed).toBe(true);

        // Verify event was logged
        const eventRecord = await db.get('SELECT * FROM stripe_events WHERE id = ?', ['evt_invoice_success_123']);
        expect(eventRecord).toBeDefined();
        expect(eventRecord.processed).toBe(1);
      });
    });

    describe('invoice.payment_failed', () => {
      it('should handle failed payment', async () => {
        const event = {
          id: 'evt_invoice_failed_123',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_failed_123',
              customer: 'cus_failed',
              subscription: 'sub_failed',
              amount_due: 2900
            }
          }
        };

        const response = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.processed).toBe(true);

        // Verify event was logged
        const eventRecord = await db.get('SELECT * FROM stripe_events WHERE id = ?', ['evt_invoice_failed_123']);
        expect(eventRecord).toBeDefined();
      });
    });

    describe('Signature Verification', () => {
      it('should require stripe-signature header', async () => {
        const event = {
          id: 'evt_nosig_123',
          type: 'customer.subscription.created',
          data: { object: {} }
        };

        const response = await request(app)
          .post('/api/webhooks/stripe')
          .send(event);

        expect(response.status).toBe(400);
      });

      it('should verify signature using Stripe webhook secret', async () => {
        const event = {
          id: 'evt_sig_123',
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_sig',
              customer: 'cus_sig',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30
            }
          }
        };

        const response = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'valid_test_signature')
          .send(event);

        expect(response.status).toBe(200);
        expect(mockStripe.webhooks.constructEvent).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle unknown event types gracefully', async () => {
        const event = {
          id: 'evt_unknown_123',
          type: 'unknown.event.type',
          data: { object: {} }
        };

        const response = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(event);

        expect(response.status).toBe(200);
        expect(response.body.received).toBe(true);

        // Should still log the event
        const eventRecord = await db.get('SELECT * FROM stripe_events WHERE id = ?', ['evt_unknown_123']);
        expect(eventRecord).toBeDefined();
      });

      it('should return 400 for invalid event format', async () => {
        mockStripe.webhooks.constructEvent.mockImplementationOnce(() => {
          throw new Error('Invalid payload');
        });

        const response = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send('invalid json');

        expect(response.status).toBe(400);
      });
    });

    describe('Complete Subscription Lifecycle', () => {
      it('should handle created → updated → deleted lifecycle', async () => {
        const testUser = await testDb.createTestUser({
          email: 'lifecycle@example.com',
          plan: 'free',
          stripe_customer_id: 'cus_lifecycle'
        });

        // 1. Subscription Created
        const createEvent = {
          id: 'evt_lifecycle_create',
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_lifecycle',
              customer: 'cus_lifecycle',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              cancel_at_period_end: false
            }
          }
        };

        await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(createEvent);

        let user = await db.get('SELECT plan FROM users WHERE id = ?', [testUser.id]);
        expect(user.plan).toBe('pro');

        // 2. Subscription Updated (cancel at period end)
        const updateEvent = {
          id: 'evt_lifecycle_update',
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_lifecycle',
              customer: 'cus_lifecycle',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              cancel_at_period_end: true
            }
          }
        };

        await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(updateEvent);

        user = await db.get('SELECT plan FROM users WHERE id = ?', [testUser.id]);
        expect(user.plan).toBe('pro'); // Still pro until period ends

        let entitlement = await db.get('SELECT * FROM entitlements WHERE user_id = ?', [testUser.id]);
        expect(entitlement.cancel_at_period_end).toBe(1);

        // 3. Subscription Deleted
        const deleteEvent = {
          id: 'evt_lifecycle_delete',
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_lifecycle',
              customer: 'cus_lifecycle'
            }
          }
        };

        await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send(deleteEvent);

        user = await db.get('SELECT plan FROM users WHERE id = ?', [testUser.id]);
        expect(user.plan).toBe('free');
      });
    });
  });
});
