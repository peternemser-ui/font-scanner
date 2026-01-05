/**
 * Test Setup Helpers
 * Provides utilities for setting up test database and cleaning up
 */

const Database = require('../../src/db');
const fs = require('fs');
const path = require('path');

class TestDatabase {
  constructor() {
    this.testDbPath = path.join(__dirname, '..', 'test.db');
    this.db = null;
  }

  /**
   * Initialize test database with schema
   */
  async setup() {
    // Remove existing test database
    if (fs.existsSync(this.testDbPath)) {
      fs.unlinkSync(this.testDbPath);
    }

    // Initialize database
    this.db = new Database(this.testDbPath);
    await this.db.initialize();

    // Run migrations
    await this.db.runMigrationFiles();

    return this.db;
  }

  /**
   * Clean up test database
   */
  async teardown() {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }

    // Remove test database file
    if (fs.existsSync(this.testDbPath)) {
      fs.unlinkSync(this.testDbPath);
    }
  }

  /**
   * Clear all data from tables (keep schema)
   */
  async clearData() {
    if (!this.db) return;

    await this.db.run('DELETE FROM sessions');
    await this.db.run('DELETE FROM entitlements');
    await this.db.run('DELETE FROM stripe_events');
    await this.db.run('DELETE FROM users');
  }

  /**
   * Create a test user
   */
  async createTestUser(data = {}) {
    const { v4: uuidv4 } = require('uuid');
    const bcrypt = require('bcryptjs');

    const userId = data.id || uuidv4();
    const email = data.email || `test-${Date.now()}@example.com`;
    const password = data.password || 'Test1234';
    const plan = data.plan || 'free';
    const passwordHash = await bcrypt.hash(password, 10);

    await this.db.run(
      'INSERT INTO users (id, email, password_hash, plan, stripe_customer_id) VALUES (?, ?, ?, ?, ?)',
      [userId, email, passwordHash, plan, data.stripe_customer_id || null]
    );

    const user = await this.db.get('SELECT * FROM users WHERE id = ?', [userId]);
    return { ...user, rawPassword: password };
  }

  /**
   * Create a test stripe event
   */
  async createStripeEvent(eventId, eventType = 'customer.subscription.created') {
    await this.db.run(
      'INSERT INTO stripe_events (id, event_type, processed) VALUES (?, ?, ?)',
      [eventId, eventType, 1]
    );
  }

  /**
   * Get database instance
   */
  getDb() {
    return this.db;
  }
}

/**
 * Mock Stripe client for testing
 */
class MockStripe {
  constructor() {
    this.customers = {
      create: jest.fn().mockResolvedValue({
        id: 'cus_test_123',
        email: 'test@example.com'
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'cus_test_123',
        email: 'test@example.com'
      })
    };

    this.checkout = {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123'
        })
      }
    };

    this.billingPortal = {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'bps_test_123',
          url: 'https://billing.stripe.com/session/test_123'
        })
      }
    };

    this.webhooks = {
      constructEvent: jest.fn((body, sig, secret) => {
        // Simple mock - just return the parsed body as the event
        return typeof body === 'string' ? JSON.parse(body) : body;
      })
    };

    this.subscriptions = {
      retrieve: jest.fn().mockResolvedValue({
        id: 'sub_test_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        cancel_at_period_end: false
      }),
      update: jest.fn().mockResolvedValue({
        id: 'sub_test_123',
        cancel_at_period_end: true
      })
    };
  }

  /**
   * Reset all mocks
   */
  reset() {
    this.customers.create.mockClear();
    this.customers.retrieve.mockClear();
    this.checkout.sessions.create.mockClear();
    this.billingPortal.sessions.create.mockClear();
    this.webhooks.constructEvent.mockClear();
    this.subscriptions.retrieve.mockClear();
    this.subscriptions.update.mockClear();
  }
}

module.exports = {
  TestDatabase,
  MockStripe
};
