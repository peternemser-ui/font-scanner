const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db');
const { createLogger } = require('../utils/logger');

const logger = createLogger('StripeService');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-use-long-random-string';

class StripeService {
  getBaseUrl(requestOrigin = null) {
    return process.env.BASE_URL || requestOrigin || 'http://localhost:3000';
  }

  getBillingPriceId(purchaseType, packId = null) {
    const env = process.env;
    const priceMap = {
      single_report: env.STRIPE_PRICE_SINGLE_REPORT_10,
      credit_pack: {
        pack_5: env.STRIPE_PRICE_CREDITS_PACK_5_40,
        pack_10: env.STRIPE_PRICE_CREDITS_PACK_10_70,
        pack_25: env.STRIPE_PRICE_CREDITS_PACK_25_150,
      }
    };

    if (purchaseType === 'single_report') {
      if (!priceMap.single_report) {
        throw new Error('Stripe price ID not configured: STRIPE_PRICE_SINGLE_REPORT_10');
      }
      return priceMap.single_report;
    }

    if (purchaseType === 'credit_pack') {
      const priceId = priceMap.credit_pack[packId];
      if (!priceId) {
        throw new Error(`Stripe price ID not configured for pack: ${packId}`);
      }
      return priceId;
    }

    throw new Error('Invalid purchaseType');
  }

  getCreditsForPack(packId) {
    const map = { pack_5: 5, pack_10: 10, pack_25: 25 };
    return map[packId] || 0;
  }

  /**
   * Get subscription price ID based on interval
   * @param {string} interval - 'month' or 'year'
   * @returns {string} Stripe price ID
   */
  getSubscriptionPriceId(interval) {
    const env = process.env;
    if (interval === 'month') {
      const priceId = env.STRIPE_PRICE_PRO_MONTHLY || env.STRIPE_PRO_PRICE_ID;
      if (!priceId) {
        throw new Error('Stripe price ID not configured: STRIPE_PRICE_PRO_MONTHLY');
      }
      return priceId;
    }
    if (interval === 'year') {
      const priceId = env.STRIPE_PRICE_PRO_YEARLY || env.STRIPE_PRO_ANNUAL_PRICE_ID;
      if (!priceId) {
        throw new Error('Stripe price ID not configured: STRIPE_PRICE_PRO_YEARLY');
      }
      return priceId;
    }
    throw new Error('Invalid interval: must be "month" or "year"');
  }

  /**
   * Get single report price ID
   * @returns {string} Stripe price ID
   */
  getSingleReportPriceId() {
    const priceId = process.env.STRIPE_PRICE_SINGLE_REPORT || process.env.STRIPE_PRICE_SINGLE_REPORT_10;
    if (!priceId) {
      throw new Error('Stripe price ID not configured: STRIPE_PRICE_SINGLE_REPORT');
    }
    return priceId;
  }

  /**
   * Get the base URL for redirects
   * @param {string} requestOrigin - The request origin (fallback)
   * @returns {string} Base URL
   */
  getBaseUrl(requestOrigin) {
    return process.env.APP_BASE_URL || process.env.BASE_URL || requestOrigin || 'http://localhost:3000';
  }

  appendQuery(urlString, query) {
    const url = new URL(urlString);
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  }

  createEntitlementToken(payload) {
    try {
      return jwt.sign(
        {
          ...payload,
          iss: 'site-mechanic',
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
    } catch (e) {
      logger.warn('Failed to create entitlement token', { error: e.message });
      return null;
    }
  }

  /**
   * Create Stripe Checkout session for billing purchases (no auth required)
   * purchaseType: 'single_report' | 'credit_pack'
   */
  async createBillingCheckoutSession({ purchaseType, packId = null, reportId = null, returnUrl, requestOrigin = null }) {
    const baseUrl = this.getBaseUrl(requestOrigin);
    const priceId = this.getBillingPriceId(purchaseType, packId);
    const creditsAdded = purchaseType === 'credit_pack' ? this.getCreditsForPack(packId) : 0;

    const successHandlerUrl = new URL('/billing-success.html', baseUrl).toString();
    const cancelHandlerUrl = new URL('/billing-cancel.html', baseUrl).toString();
    const successUrl = this.appendQuery(successHandlerUrl, {
      session_id: '{CHECKOUT_SESSION_ID}',
      returnUrl
    });
    const cancelUrl = this.appendQuery(cancelHandlerUrl, { returnUrl });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: false,
      metadata: {
        purchaseType,
        packId: packId || '',
        reportId: reportId || '',
        creditsAdded: creditsAdded.toString(),
        returnUrl
      }
    });

    logger.info('Billing checkout session created', {
      sessionId: session.id,
      purchaseType,
      packId,
      reportId,
      creditsAdded
    });

    return session;
  }

  /**
   * Verify a billing session and return a client-side entitlement payload
   */
  async verifyBillingSession(sessionId) {
    const db = getDatabase();

    // Prefer webhook-fulfilled DB state when available
    try {
      const row = await db.get(
        'SELECT purchase_type, report_id, credits_added, payment_status FROM billing_sessions WHERE session_id = ?',
        [sessionId]
      );

      if (row && row.payment_status === 'paid') {
        return {
          paid: true,
          purchaseType: row.purchase_type || null,
          reportId: row.report_id || null,
          creditsAdded: parseInt(row.credits_added || 0, 10) || 0,
        };
      }
    } catch (e) {
      // DB might not be initialized in some edge contexts; fall back to Stripe.
      logger.warn('Failed to check billing session DB state', { error: e.message });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid = session.payment_status === 'paid';
    const purchaseType = session.metadata?.purchaseType || null;
    const packId = session.metadata?.packId || null;
    const reportId = session.metadata?.reportId || null;

    let creditsAdded = 0;
    if (paid && purchaseType === 'credit_pack') {
      creditsAdded = this.getCreditsForPack(packId);
    }

    // Best-effort upsert so subsequent verifications can short-circuit
    try {
      if (purchaseType === 'single_report' || purchaseType === 'credit_pack') {
        await db.run(
          `INSERT INTO billing_sessions (session_id, purchase_type, report_id, pack_id, credits_added, payment_status, mode, amount_total, currency, stripe_customer_id, completed_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(session_id) DO UPDATE SET
             purchase_type = excluded.purchase_type,
             report_id = excluded.report_id,
             pack_id = excluded.pack_id,
             credits_added = excluded.credits_added,
             payment_status = excluded.payment_status,
             mode = excluded.mode,
             amount_total = excluded.amount_total,
             currency = excluded.currency,
             stripe_customer_id = excluded.stripe_customer_id,
             completed_at = COALESCE(excluded.completed_at, billing_sessions.completed_at),
             updated_at = CURRENT_TIMESTAMP`,
          [
            session.id,
            purchaseType,
            reportId || null,
            packId || null,
            paid ? creditsAdded : 0,
            session.payment_status || null,
            session.mode || null,
            session.amount_total || null,
            session.currency || null,
            session.customer || null,
            session.created ? new Date(session.created * 1000).toISOString() : null,
          ]
        );
      }
    } catch (e) {
      logger.warn('Failed to upsert billing session during verify', { error: e.message });
    }

    return {
      paid: !!paid,
      purchaseType,
      reportId: reportId || null,
      creditsAdded: paid ? creditsAdded : 0
    };
  }

  async upsertBillingSessionFromCheckoutSession(session) {
    const db = getDatabase();

    const purchaseType = session.metadata?.purchaseType || null;
    if (purchaseType !== 'single_report' && purchaseType !== 'credit_pack') {
      return { stored: false, reason: 'not_billing_purchase' };
    }

    const packId = session.metadata?.packId || null;
    const reportId = session.metadata?.reportId || null;
    const paid = session.payment_status === 'paid';
    const creditsAdded = paid && purchaseType === 'credit_pack' ? this.getCreditsForPack(packId) : 0;

    await db.run(
      `INSERT INTO billing_sessions (session_id, purchase_type, report_id, pack_id, credits_added, payment_status, mode, amount_total, currency, stripe_customer_id, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(session_id) DO UPDATE SET
         purchase_type = excluded.purchase_type,
         report_id = excluded.report_id,
         pack_id = excluded.pack_id,
         credits_added = excluded.credits_added,
         payment_status = excluded.payment_status,
         mode = excluded.mode,
         amount_total = excluded.amount_total,
         currency = excluded.currency,
         stripe_customer_id = excluded.stripe_customer_id,
         completed_at = COALESCE(excluded.completed_at, billing_sessions.completed_at),
         updated_at = CURRENT_TIMESTAMP`,
      [
        session.id,
        purchaseType,
        reportId || null,
        packId || null,
        paid ? creditsAdded : 0,
        session.payment_status || null,
        session.mode || null,
        session.amount_total || null,
        session.currency || null,
        session.customer || null,
        session.created ? new Date(session.created * 1000).toISOString() : null,
      ]
    );

    return {
      stored: true,
      paid,
      purchaseType,
      reportId: reportId || null,
      creditsAdded: paid ? creditsAdded : 0,
    };
  }

  /**
   * Create or get Stripe customer for user
   */
  async getOrCreateCustomer(userId, email) {
    const db = getDatabase();

    // Check if user already has a Stripe customer ID
    const user = await db.get(
      'SELECT stripe_customer_id FROM users WHERE id = ?',
      [userId]
    );

    if (user.stripe_customer_id) {
      logger.info('Using existing Stripe customer', { customerId: user.stripe_customer_id });
      return user.stripe_customer_id;
    }

    // Create new Stripe customer
    logger.info('Creating new Stripe customer', { userId, email });
    const customer = await stripe.customers.create({
      email,
      metadata: { userId }
    });

    // Save customer ID to database
    await db.run(
      'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
      [customer.id, userId]
    );

    logger.info('Stripe customer created', { customerId: customer.id });
    return customer.id;
  }

  /**
   * Create Stripe Checkout Session for Pro subscription
   */
  async createCheckoutSession(userId, email, successUrl, cancelUrl) {
    const db = getDatabase();

    // Get or create Stripe customer
    const customerId = await this.getOrCreateCustomer(userId, email);

    // Get Pro price ID from environment or database
    let proPriceId = process.env.STRIPE_PRO_PRICE_ID;

    if (!proPriceId) {
      // Fallback: Get from database
      const plan = await db.get(
        'SELECT stripe_price_id FROM subscription_plans WHERE id = ?',
        ['pro']
      );
      proPriceId = plan?.stripe_price_id;
    }

    if (!proPriceId) {
      throw new Error('Stripe Pro price ID not configured');
    }

    // Create checkout session
    logger.info('Creating Stripe Checkout session', { userId, customerId });
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price: proPriceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: successUrl || `${process.env.BASE_URL || 'http://localhost:3000'}/account.html?success=true`,
      cancel_url: cancelUrl || `${process.env.BASE_URL || 'http://localhost:3000'}/upgrade.html?canceled=true`,
      metadata: {
        userId
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto'
      }
    });

    logger.info('Checkout session created', { sessionId: session.id });
    return session;
  }

  /**
   * Create Stripe Customer Portal session
   * Allows users to manage subscription, payment methods, billing history
   */
  async createPortalSession(userId, returnUrl) {
    const db = getDatabase();

    // Get user's Stripe customer ID
    const user = await db.get(
      'SELECT stripe_customer_id FROM users WHERE id = ?',
      [userId]
    );

    if (!user?.stripe_customer_id) {
      throw new Error('No Stripe customer found for user');
    }

    // Create portal session
    logger.info('Creating Customer Portal session', { userId, customerId: user.stripe_customer_id });
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl || `${process.env.BASE_URL || 'http://localhost:3000'}/account.html`,
    });

    logger.info('Portal session created', { sessionId: session.id });
    return session;
  }

  /**
   * Create Stripe Checkout session for subscription (monthly or yearly)
   * @param {Object} params
   * @param {string} params.userId - User ID
   * @param {string} params.email - User email
   * @param {string} params.interval - 'month' or 'year'
   * @param {string} params.successUrl - URL after successful payment
   * @param {string} params.cancelUrl - URL if payment is canceled
   */
  async createSubscriptionCheckout({ userId, email, interval, successUrl, cancelUrl }) {
    const customerId = await this.getOrCreateCustomer(userId, email);
    const priceId = this.getSubscriptionPriceId(interval);

    logger.info('Creating subscription checkout session', {
      userId,
      customerId,
      interval,
      priceId
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        purchaseType: 'subscription',
        interval
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto'
      }
    });

    logger.info('Subscription checkout session created', {
      sessionId: session.id,
      interval
    });

    return session;
  }

  /**
   * Create Stripe Checkout session for single report purchase
   * @param {Object} params
   * @param {string} params.userId - User ID
   * @param {string} params.email - User email
   * @param {string} params.reportId - Report ID being purchased
   * @param {string} params.successUrl - URL after successful payment
   * @param {string} params.cancelUrl - URL if payment is canceled
   */
  async createSingleReportCheckout({ userId, email, reportId, successUrl, cancelUrl }) {
    const customerId = await this.getOrCreateCustomer(userId, email);
    const priceId = this.getSingleReportPriceId();

    logger.info('Creating single report checkout session', {
      userId,
      customerId,
      reportId,
      priceId
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        purchaseType: 'single_report',
        reportId
      },
      allow_promotion_codes: false
    });

    logger.info('Single report checkout session created', {
      sessionId: session.id,
      reportId
    });

    return session;
  }

  /**
   * Get normalized billing status for a user
   * @param {string} userId
   * @returns {Object} Billing status object
   */
  async getBillingStatus(userId) {
    const db = getDatabase();

    // Get user data with subscription fields
    const user = await db.get(
      `SELECT
        id, email, plan, stripe_customer_id,
        stripe_subscription_id, stripe_subscription_status,
        stripe_current_period_end, stripe_subscription_interval
      FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      throw new Error('User not found');
    }

    // Get purchased reports
    let purchasedReports = [];
    try {
      const rows = await db.all(
        'SELECT report_id FROM report_purchases WHERE user_id = ?',
        [userId]
      );
      purchasedReports = rows.map(r => r.report_id);
    } catch (e) {
      // Table may not exist yet
      logger.warn('Could not fetch purchased reports', { error: e.message });
    }

    // Determine if subscription is active
    const activeStatuses = ['active', 'trialing'];
    const isPro = activeStatuses.includes(user.stripe_subscription_status);

    // Check if subscription should still have access (grace period)
    let effectivePlan = user.plan || 'free';
    if (user.stripe_subscription_status === 'canceled' && user.stripe_current_period_end) {
      const periodEnd = new Date(user.stripe_current_period_end);
      if (periodEnd > new Date()) {
        // Still within paid period
        effectivePlan = 'pro';
      }
    } else if (isPro) {
      effectivePlan = 'pro';
    }

    // If we have a Stripe customer but no local subscription data, try to fetch from Stripe
    let cancelAtPeriodEnd = false;
    if (user.stripe_customer_id && !user.stripe_subscription_id) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          status: 'all',
          limit: 1
        });

        if (subscriptions.data.length > 0) {
          const sub = subscriptions.data[0];
          cancelAtPeriodEnd = sub.cancel_at_period_end || false;
        }
      } catch (e) {
        logger.warn('Failed to fetch subscription from Stripe', { error: e.message });
      }
    }

    return {
      plan: effectivePlan,
      subscriptionStatus: user.stripe_subscription_status || null,
      subscriptionInterval: user.stripe_subscription_interval || null,
      currentPeriodEnd: user.stripe_current_period_end || null,
      cancelAtPeriodEnd,
      hasStripeCustomer: !!user.stripe_customer_id,
      purchasedReports
    };
  }

  // ============================================
  // Entitlement Helper Functions
  // ============================================

  /**
   * Check if user has active Pro subscription
   * @param {Object} user - User object with stripe_subscription_status and stripe_current_period_end
   * @returns {boolean}
   */
  isPro(user) {
    if (!user) return false;

    const status = user.stripe_subscription_status;
    const activeStatuses = ['active', 'trialing'];

    // Direct active subscription
    if (activeStatuses.includes(status)) {
      return true;
    }

    // Canceled but still within grace period
    if (status === 'canceled' && user.stripe_current_period_end) {
      const periodEnd = new Date(user.stripe_current_period_end);
      if (periodEnd > new Date()) {
        return true;
      }
    }

    // Legacy plan check
    if (user.plan === 'pro') {
      return true;
    }

    return false;
  }

  /**
   * Check if user has purchased a specific report
   * @param {string} userId - User ID
   * @param {string} reportId - Report ID
   * @returns {Promise<boolean>}
   */
  async hasReportPurchase(userId, reportId) {
    if (!userId || !reportId) return false;

    const db = getDatabase();
    try {
      const row = await db.get(
        'SELECT 1 FROM report_purchases WHERE user_id = ? AND report_id = ?',
        [userId, reportId]
      );
      return !!row;
    } catch (e) {
      // Table may not exist yet
      logger.warn('Could not check report purchase', { error: e.message });
      return false;
    }
  }

  /**
   * Check if user can access paid features for a report
   * Pro users can access all reports, others need individual purchases
   * @param {Object} user - User object
   * @param {string} reportId - Report ID (optional)
   * @returns {Promise<boolean>}
   */
  async canAccessPaid(user, reportId = null) {
    // Pro users have access to everything
    if (this.isPro(user)) {
      return true;
    }

    // If no reportId provided, they need Pro
    if (!user?.id || !reportId) {
      return false;
    }

    // Check for individual report purchase
    return this.hasReportPurchase(user.id, reportId);
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event) {
    const db = getDatabase();

    logger.info('Processing Stripe webhook', { type: event.type, id: event.id });

    // Check for duplicate events (idempotency)
    try {
      const existing = await db.get(
        'SELECT processed FROM stripe_events WHERE id = ?',
        [event.id]
      );

      if (existing && existing.processed) {
        logger.warn('Duplicate webhook event, skipping', { eventId: event.id });
        return { received: true, processed: false, reason: 'duplicate' };
      }

      // Record event
      await db.run(
        'INSERT OR IGNORE INTO stripe_events (id, event_type, processed) VALUES (?, ?, ?)',
        [event.id, event.type, 0]
      );
    } catch (error) {
      logger.error('Error checking webhook idempotency', { error: error.message });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
        case 'checkout.session.async_payment_failed': {
          const session = event.data.object;
          const isPaid = session.payment_status === 'paid';

          // Handle subscription checkouts
          if (session && session.mode === 'subscription' && isPaid) {
            const userId = session.metadata?.userId;
            const interval = session.metadata?.interval;
            const subscriptionId = session.subscription;

            if (userId && subscriptionId) {
              try {
                // Fetch full subscription details from Stripe
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

                // Update user with subscription details
                await db.run(
                  `UPDATE users SET
                    plan = 'pro',
                    stripe_subscription_id = ?,
                    stripe_subscription_status = ?,
                    stripe_current_period_end = ?,
                    stripe_subscription_interval = ?
                  WHERE id = ?`,
                  [
                    subscriptionId,
                    subscription.status,
                    currentPeriodEnd,
                    interval || (subscription.items?.data?.[0]?.price?.recurring?.interval) || 'month',
                    userId
                  ]
                );

                logger.info('Subscription checkout completed - user updated', {
                  userId,
                  subscriptionId,
                  status: subscription.status,
                  interval
                });

                // Update entitlements
                await db.run(`
                  INSERT INTO entitlements (user_id, plan, stripe_subscription_id, status, current_period_end, scans_remaining, max_pages_per_scan, pdf_export_enabled)
                  VALUES (?, 'pro', ?, ?, ?, -1, 250, 1)
                  ON CONFLICT(user_id) DO UPDATE SET
                    plan = 'pro',
                    stripe_subscription_id = excluded.stripe_subscription_id,
                    status = excluded.status,
                    current_period_end = excluded.current_period_end,
                    scans_remaining = -1,
                    max_pages_per_scan = 250,
                    pdf_export_enabled = 1,
                    updated_at = CURRENT_TIMESTAMP
                `, [userId, subscriptionId, subscription.status, currentPeriodEnd]);

              } catch (e) {
                logger.error('Failed to sync subscription from checkout', {
                  sessionId: session.id,
                  error: e.message
                });
              }
            }
          }

          // Handle single report payment purchases (linked to user)
          if (session && session.mode === 'payment' && isPaid) {
            const purchaseType = session.metadata?.purchaseType;
            const userId = session.metadata?.userId;
            const reportId = session.metadata?.reportId;

            if (purchaseType === 'single_report' && userId && reportId) {
              try {
                await db.run(
                  `INSERT INTO report_purchases (user_id, report_id, stripe_checkout_session_id, purchased_at)
                   VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                   ON CONFLICT(user_id, report_id) DO UPDATE SET
                     stripe_checkout_session_id = excluded.stripe_checkout_session_id,
                     purchased_at = CURRENT_TIMESTAMP`,
                  [userId, reportId, session.id]
                );

                logger.info('Single report purchase recorded', {
                  userId,
                  reportId,
                  sessionId: session.id
                });
              } catch (e) {
                logger.error('Failed to record report purchase', {
                  sessionId: session.id,
                  userId,
                  reportId,
                  error: e.message
                });
              }
            }

            // Also store in billing_sessions for legacy support
            try {
              const stored = await this.upsertBillingSessionFromCheckoutSession(session);
              logger.info('Billing checkout session webhook stored', {
                eventType: event.type,
                sessionId: session.id,
                stored: stored.stored,
                paid: stored.paid,
                purchaseType: stored.purchaseType,
              });
            } catch (e) {
              logger.error('Failed to store billing checkout session webhook', {
                eventType: event.type,
                sessionId: session?.id,
                error: e.message,
              });
            }
          }

          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const customerId = subscription.customer;

          logger.info('Subscription event', {
            type: event.type,
            subscriptionId: subscription.id,
            status: subscription.status
          });

          // Determine plan based on subscription status
          const activeStatuses = ['active', 'trialing'];
          const plan = activeStatuses.includes(subscription.status) ? 'pro' : 'free';
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          // Get interval from subscription items
          const interval = subscription.items?.data?.[0]?.price?.recurring?.interval || 'month';

          // Update user with full subscription details
          const result = await db.run(
            `UPDATE users SET
              plan = ?,
              stripe_subscription_id = ?,
              stripe_subscription_status = ?,
              stripe_current_period_end = ?,
              stripe_subscription_interval = ?
            WHERE stripe_customer_id = ?`,
            [plan, subscription.id, subscription.status, currentPeriodEnd, interval, customerId]
          );

          if (result.changes > 0) {
            logger.info('User subscription updated', {
              customerId,
              plan,
              status: subscription.status,
              interval,
              currentPeriodEnd
            });

            // Update entitlements
            const user = await db.get(
              'SELECT id FROM users WHERE stripe_customer_id = ?',
              [customerId]
            );

            if (user) {
              await db.run(`
                INSERT INTO entitlements (user_id, plan, stripe_subscription_id, status, current_period_end, scans_remaining, max_pages_per_scan, pdf_export_enabled)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                  plan = excluded.plan,
                  stripe_subscription_id = excluded.stripe_subscription_id,
                  status = excluded.status,
                  current_period_end = excluded.current_period_end,
                  scans_remaining = excluded.scans_remaining,
                  max_pages_per_scan = excluded.max_pages_per_scan,
                  pdf_export_enabled = excluded.pdf_export_enabled,
                  updated_at = CURRENT_TIMESTAMP
              `, [
                user.id,
                plan,
                subscription.id,
                subscription.status,
                currentPeriodEnd,
                plan === 'pro' ? -1 : 3, // -1 = unlimited
                plan === 'pro' ? 250 : 10,
                plan === 'pro' ? 1 : 0
              ]);

              logger.info('Entitlements updated', { userId: user.id, plan });
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription.customer;
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          logger.info('Subscription deleted', {
            subscriptionId: subscription.id,
            customerId,
            currentPeriodEnd
          });

          // Set status to canceled but keep current_period_end for grace period
          // User retains access until the end of the paid period
          const result = await db.run(
            `UPDATE users SET
              stripe_subscription_status = 'canceled',
              stripe_current_period_end = ?
            WHERE stripe_customer_id = ?`,
            [currentPeriodEnd, customerId]
          );

          if (result.changes > 0) {
            logger.info('User subscription marked as canceled with grace period', {
              customerId,
              accessUntil: currentPeriodEnd
            });

            // Update entitlements - keep pro access until period end
            const user = await db.get(
              'SELECT id FROM users WHERE stripe_customer_id = ?',
              [customerId]
            );

            if (user) {
              await db.run(`
                UPDATE entitlements SET
                  status = 'canceled',
                  current_period_end = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
              `, [currentPeriodEnd, user.id]);

              logger.info('Entitlements marked as canceled with grace period', {
                userId: user.id,
                accessUntil: currentPeriodEnd
              });
            }
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          logger.info('Payment succeeded', {
            invoiceId: invoice.id,
            customerId: invoice.customer,
            amount: invoice.amount_paid / 100
          });
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          logger.warn('Payment failed', {
            invoiceId: invoice.id,
            customerId: invoice.customer,
            attemptCount: invoice.attempt_count
          });

          // TODO: Send email notification to user
          // TODO: If attempt_count > 3, consider downgrading or suspending

          break;
        }

        case 'customer.subscription.trial_will_end': {
          const subscription = event.data.object;
          logger.info('Trial ending soon', {
            subscriptionId: subscription.id,
            trialEnd: new Date(subscription.trial_end * 1000)
          });

          // TODO: Send reminder email

          break;
        }

        default:
          logger.info('Unhandled webhook event type', { type: event.type });
      }

      // Mark event as processed
      await db.run(
        'UPDATE stripe_events SET processed = 1 WHERE id = ?',
        [event.id]
      );

      logger.info('Webhook processed successfully', { eventId: event.id });
      return { received: true, processed: true };

    } catch (error) {
      logger.error('Error processing webhook', {
        eventId: event.id,
        type: event.type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get subscription details for a user
   */
  async getUserSubscription(userId) {
    const db = getDatabase();

    const user = await db.get(
      'SELECT stripe_customer_id, plan FROM users WHERE id = ?',
      [userId]
    );

    if (!user?.stripe_customer_id) {
      return null;
    }

    try {
      // Get subscriptions from Stripe
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'all',
        limit: 1
      });

      if (subscriptions.data.length === 0) {
        return null;
      }

      const subscription = subscriptions.data[0];

      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        plan: user.plan
      };
    } catch (error) {
      logger.error('Error fetching subscription', { userId, error: error.message });
      return null;
    }
  }

  /**
   * Create one-time payment session for individual reports (no account needed)
   * @param {string} reportType - 'cwv' or 'lighthouse'
   * @param {string} url - The URL being analyzed
   * @param {string} email - Optional customer email
   * @param {string} successUrl - URL to redirect to after successful payment
   * @param {string} cancelUrl - URL to redirect to if payment is canceled
   */
  async createOneTimePayment(reportType, url, email = null, successUrl = null, cancelUrl = null) {
    const reportConfig = {
      cwv: {
        name: 'Core Web Vitals Report',
        description: 'Detailed Core Web Vitals analysis with mobile & desktop metrics',
        price: 500 // $5.00 in cents
      },
      lighthouse: {
        name: 'Lighthouse Full Audit',
        description: 'Complete Lighthouse performance audit for desktop & mobile',
        price: 500 // $5.00 in cents
      }
    };

    const config = reportConfig[reportType];
    if (!config) {
      throw new Error('Invalid report type');
    }

    logger.info('Creating one-time payment session', { reportType, url, email });

    // Create checkout session for one-time payment
    const sessionConfig = {
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: config.name,
            description: `${config.description} for ${url}`,
            metadata: {
              reportType,
              url
            }
          },
          unit_amount: config.price,
        },
        quantity: 1,
      }],
      mode: 'payment', // One-time payment, not subscription
      success_url: successUrl || `${process.env.BASE_URL || 'http://localhost:3000'}/performance-hub.html?payment=success&type=${reportType}&url=${encodeURIComponent(url)}`,
      cancel_url: cancelUrl || `${process.env.BASE_URL || 'http://localhost:3000'}/performance-hub.html?payment=canceled&type=${reportType}`,
      metadata: {
        reportType,
        url,
        timestamp: new Date().toISOString()
      },
      allow_promotion_codes: true,
    };

    // Add customer email if provided
    if (email) {
      sessionConfig.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    logger.info('One-time payment session created', {
      sessionId: session.id,
      reportType,
      url,
      amount: config.price / 100
    });

    return session;
  }

  /**
   * Verify payment completion for a checkout session
   */
  async verifyPayment(sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      logger.info('Payment verification', {
        sessionId,
        status: session.payment_status,
        mode: session.mode
      });

      return {
        paid: session.payment_status === 'paid',
        reportType: session.metadata?.reportType,
        url: session.metadata?.url,
        email: session.customer_details?.email,
        amount: session.amount_total / 100,
        metadata: session.metadata
      };
    } catch (error) {
      logger.error('Error verifying payment', { sessionId, error: error.message });
      throw error;
    }
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(userId) {
    const db = getDatabase();

    const user = await db.get(
      'SELECT stripe_customer_id FROM users WHERE id = ?',
      [userId]
    );

    if (!user?.stripe_customer_id) {
      throw new Error('No Stripe customer found');
    }

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      throw new Error('No active subscription found');
    }

    const subscription = subscriptions.data[0];

    // Cancel at period end (user keeps access until end of billing period)
    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true
    });

    logger.info('Subscription canceled at period end', {
      userId,
      subscriptionId: subscription.id,
      periodEnd: new Date(updated.current_period_end * 1000)
    });

    return updated;
  }
}

module.exports = new StripeService();
