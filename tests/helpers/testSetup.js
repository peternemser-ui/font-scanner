/**
 * Test Setup Helpers
 * Provides utilities for setting up test database and cleaning up.
 *
 * Tests run against PostgreSQL — the same engine as production. Each
 * TestDatabase gets its own schema, so suites are fully isolated and the
 * `public` schema of the target database is never touched.
 *
 * Requires a reachable PostgreSQL. Override the target with TEST_DATABASE_URL
 * (falls back to DATABASE_URL, then the local dev DSN).
 *
 * This previously created a SQLite file per instance — except Database's
 * constructor ignored the path, so every suite silently shared
 * ./data/fontscanner.db, writing test users into the real dev database.
 */

const { Client } = require('pg');
const { Database } = require('../../src/db');

let dbCounter = 0;

function testConnectionString() {
  return process.env.TEST_DATABASE_URL
    || process.env.DATABASE_URL
    || 'postgresql://fontscanner:fontscanner_dev@localhost:5432/fontscanner';
}

class TestDatabase {
  constructor() {
    // Unique per process + instance so parallel workers cannot collide.
    this.schema = `test_${process.pid}_${++dbCounter}_${Date.now()}`;
    this.connectionString = testConnectionString();
    this.db = null;
  }

  /** Run a statement on a throwaway admin connection (outside the pool). */
  async _admin(sql) {
    const client = new Client({ connectionString: this.connectionString });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
  }

  /**
   * Initialize an isolated schema with the full production schema + migrations.
   */
  async setup() {
    try {
      await this._admin(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`);
    } catch (err) {
      throw new Error(
        `Could not create test schema — is PostgreSQL running and reachable at ` +
        `${this.connectionString.replace(/:\/\/[^@]*@/, '://***@')}? Original error: ${err.message}`
      );
    }

    // Pinning search_path to the test schema means schema.pg.sql and every
    // migration build their objects inside it.
    this.db = new Database({ connectionString: this.connectionString, schema: this.schema });
    await this.db.initialize();

    return this.db;
  }

  /**
   * Drop the schema and close the pool.
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

    try {
      await this._admin(`DROP SCHEMA IF EXISTS "${this.schema}" CASCADE`);
    } catch (err) {
      console.warn(`Could not drop test schema ${this.schema}:`, err.message);
    }
  }

  /**
   * Clear all data from tables (keep schema)
   */
  async clearData() {
    if (!this.db) return;

    // Clear tables in order respecting foreign key constraints.
    // Child tables (those with FK references to users) must be cleared BEFORE users.
    const tables = [
      // Child tables first (FK → users or FK → scans)
      'bug_reward_tokens',
      'bug_reports',
      'usage_tracking',
      'scan_usage',
      'scan_results',
      'crawled_pages',
      'password_resets',
      'api_keys',
      'recommendation_feedback',
      'ai_recommendations',
      'benchmark_stats',
      'admin_activity_log',
      'contact_messages',
      'sessions',
      'entitlements',
      'report_purchases',
      'billing_sessions',
      'stripe_events',
      'scans',
      // Parent table last
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
