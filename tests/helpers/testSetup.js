/**
 * Test Setup Helpers
 * Provides utilities for setting up test database and cleaning up
 */

const { Database } = require('../../src/db');
const fs = require('fs');
const path = require('path');

let dbCounter = 0;

class TestDatabase {
  constructor() {
    // Each instance gets a unique db file to avoid EBUSY conflicts in parallel test suites
    const uniqueId = `${process.pid}_${++dbCounter}_${Date.now()}`;
    this.testDbPath = path.join(__dirname, '..', `test_${uniqueId}.db`);
    this.db = null;
  }

  /**
   * Initialize test database with schema
   */
  async setup() {
    // Remove existing test database (shouldn't exist with unique paths, but just in case)
    try {
      if (fs.existsSync(this.testDbPath)) {
        fs.unlinkSync(this.testDbPath);
      }
    } catch (err) {
      // Ignore EBUSY on Windows — the unique path should prevent conflicts
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
      try {
        await this.db.close();
      } catch (err) {
        console.warn('Error closing test database:', err.message);
      }
      this.db = null;
    }

    // Remove test database file and WAL/SHM files
    const filesToRemove = [
      this.testDbPath,
      this.testDbPath + '-wal',
      this.testDbPath + '-shm'
    ];

    for (const file of filesToRemove) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (err) {
        // On Windows, files may be locked briefly - ignore errors
        console.warn(`Could not remove ${file}:`, err.message);
      }
    }
  }

  /**
   * Clear all data from tables (keep schema)
   */
  async clearData() {
    if (!this.db) return;

    // Clear tables in order respecting foreign key constraints
    const tables = [
      'sessions',
      'entitlements',
      'stripe_events',
      'report_purchases',
      'billing_sessions',
      'users'
    ];

    for (const table of tables) {
      try {
        await this.db.run(`DELETE FROM ${table}`);
      } catch (err) {
        // Table might not exist - ignore
      }
    }
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
      `INSERT INTO users (
        id, email, password_hash, plan, stripe_customer_id,
        stripe_subscription_id, stripe_subscription_status,
        stripe_current_period_end, stripe_subscription_interval
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        email,
        passwordHash,
        plan,
        data.stripe_customer_id || null,
        data.stripe_subscription_id || null,
        data.stripe_subscription_status || null,
        data.stripe_current_period_end || null,
        data.stripe_subscription_interval || null
      ]
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
        cancel_at_period_end: true,
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30
      }),
      list: jest.fn().mockResolvedValue({
        data: [{
          id: 'sub_test_123',
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          cancel_at_period_end: false
        }]
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
    this.subscriptions.list.mockClear();
  }
}

module.exports = {
  TestDatabase,
  MockStripe
};
