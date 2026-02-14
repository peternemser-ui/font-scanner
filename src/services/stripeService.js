const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db');
const { createLogger } = require('../utils/logger');
const { isSafeReportId } = require('../utils/reportId');

const logger = createLogger('StripeService');

// Stripe key must be configured
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('STRIPE_SECRET_KEY environment variable must be set in production');
}
const stripe = require('stripe')(STRIPE_SECRET_KEY || 'sk_test_placeholder_dev_only');

// JWT secret for entitlement tokens
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable must be set in production');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-only-secret-do-not-use-in-production';

class StripeService {
  getBaseUrl(requestOrigin = null) {
    return process.env.APP_BASE_URL || process.env.BASE_URL || requestOrigin || 'http://localhost:3000';
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
   * @param {string} interval - 'day', 'month' or 'year'
   * @returns {string} Stripe price ID
   */
  getSubscriptionPriceId(interval) {
    const env = process.env;
    if (interval === 'day') {
      const priceId = env.STRIPE_PRICE_DAY_PASS;
      if (!priceId) {
        throw new Error('Stripe price ID not configured: STRIPE_PRICE_DAY_PASS');
      }
      return priceId;
    }
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
    throw new Error('Invalid interval: must be "day", "month" or "year"');
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
        EFFECTIVE_JWT_SECRET,
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
   * @param {string} params.interval - 'day', 'month' or 'year'
   * @param {string} params.successUrl - URL after successful payment
   * @param {string} params.cancelUrl - URL if payment is canceled
   */
  async createSubscriptionCheckout({ userId, email, interval, successUrl, cancelUrl, locale = 'auto' }) {
    const customerId = await this.getOrCreateCustomer(userId, email);
    const priceId = this.getSubscriptionPriceId(interval);

    logger.info('Creating checkout session', {
      userId,
      customerId,
      interval,
      priceId,
      locale
    });

    // Day Pass uses payment mode (one-time purchase), not subscription mode
    if (interval === 'day') {
      const sessionOptions = {
        customer: customerId,
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        locale: locale,
        metadata: {
          userId,
          purchaseType: 'day_pass',
          interval: 'day'
        },
        allow_promotion_codes: true
      };

      const session = await stripe.checkout.sessions.create(sessionOptions);

      logger.info('Day Pass checkout session created', {
        sessionId: session.id,
        interval
      });

      return session;
    }

    // Monthly/Annual subscriptions use subscription mode
    const sessionOptions = {
      customer: customerId,
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: locale,
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
    };

    const session = await stripe.checkout.sessions.create(sessionOptions);

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
  async createSingleReportCheckout({ userId, email, reportId, successUrl, cancelUrl, siteUrl, analyzerType, locale = 'auto' }) {
    const customerId = await this.getOrCreateCustomer(userId, email);
    const priceId = this.getSingleReportPriceId();

    logger.info('Creating single report checkout session', {
      userId,
      customerId,
      reportId,
      priceId,
      siteUrl,
      analyzerType,
      locale
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
      locale: locale, // Display Stripe checkout in user's preferred language
      metadata: {
        userId,
        purchaseType: 'single_report',
        reportId,
        siteUrl: siteUrl || '',
        analyzerType: analyzerType || ''
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
   * Get normalized billing status for a user.
   * Uses canonical resolver for base data, adds purchasedReportDetails.
   *
   * @param {string} userId
   * @returns {Object} Billing status object
   */
  async getBillingStatus(userId) {
    const db = getDatabase();
    const { resolveEntitlements } = require('../utils/entitlements');

    // Get base entitlements from canonical resolver
    const entitlements = await resolveEntitlements({ userId });

    // Check if user has a Stripe customer
    const user = await db.get(
      'SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new Error('User not found');
    }

    // Get purchased reports with full details (extra query not in canonical resolver)
    let purchasedReportDetails = [];
    try {
      const rows = await db.all(
        'SELECT report_id, site_url, analyzer_type, purchased_at FROM report_purchases WHERE user_id = ? ORDER BY purchased_at DESC',
        [userId]
      );
      purchasedReportDetails = rows.map(r => ({
        reportId: r.report_id,
        siteUrl: r.site_url || '',
        analyzerType: r.analyzer_type || '',
        purchasedAt: r.purchased_at ? r.purchased_at.replace(' ', 'T') + 'Z' : null
      }));
    } catch (e) {
      logger.warn('Could not fetch purchased report details', { error: e.message });
    }

    return {
      plan: entitlements.plan,
      subscriptionStatus: entitlements.subscriptionStatus,
      subscriptionInterval: entitlements.subscriptionInterval,
      currentPeriodEnd: entitlements.currentPeriodEnd,
      dayPassExpiresAt: entitlements.dayPassExpiresAt,
      cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
      hasStripeCustomer: !!user.stripe_customer_id,
      purchasedReports: entitlements.purchasedReports,
      purchasedReportDetails,
      permissions: entitlements.permissions
    };
  }

  /**
   * Get canonical entitlements object for a user.
   * Delegates to the canonical resolver in utils/entitlements.js.
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Canonical entitlements object
   */
  async getEntitlements(userId) {
    const { resolveEntitlements } = require('../utils/entitlements');
    return resolveEntitlements({ userId });
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
    const now = new Date();

    // Check if the subscription period has expired (covers day passes and all intervals)
    if (user.stripe_current_period_end) {
      const periodEnd = new Date(user.stripe_current_period_end);
      if (periodEnd < now) {
        // Period has ended — not Pro regardless of status or plan field
        return false;
      }
    }

    // Direct active subscription (period still valid or no period set)
    if (activeStatuses.includes(status)) {
      return true;
    }

    // Canceled but still within grace period (periodEnd > now already checked above)
    if (status === 'canceled' && user.stripe_current_period_end) {
      return true;
    }

    // Legacy plan check — only if there's no subscription evidence at all
    if (user.plan === 'pro' && !status && !user.stripe_current_period_end) {
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
   * Verify a checkout session and record the purchase if successful
   * This is a fallback for when webhooks don't fire (e.g., local development)
   * @param {string} sessionId - Stripe checkout session ID
   * @param {string} userId - User ID to verify against
   * @returns {Promise<Object>} Verification result
   */
  async verifyAndRecordPurchase(sessionId, userId) {
    if (!sessionId || !userId) {
      logger.warn('verifyAndRecordPurchase called with missing params', { sessionId: !!sessionId, userId: !!userId });
      return { success: false, error: 'Missing session ID or user ID' };
    }

    logger.info('Verifying purchase from checkout session', { sessionId, userId });

    const db = getDatabase();

    try {
      // Retrieve the session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (!session) {
        logger.warn('Session not found in Stripe', { sessionId });
        return { success: false, error: 'Session not found' };
      }

      logger.info('Retrieved Stripe session', {
        sessionId,
        paymentStatus: session.payment_status,
        metadata: session.metadata
      });

      // Verify the session belongs to this user (convert both to string for comparison)
      const metadataUserId = String(session.metadata?.userId || '');
      const requestUserId = String(userId);
      if (metadataUserId !== requestUserId) {
        logger.warn('Session user mismatch', { sessionUserId: metadataUserId, requestUserId });
        return { success: false, error: 'Session does not belong to this user' };
      }

      // Check if payment was successful
      if (session.payment_status !== 'paid') {
        logger.warn('Payment not completed', { sessionId, paymentStatus: session.payment_status });
        return { success: false, error: 'Payment not completed', paymentStatus: session.payment_status };
      }

      const purchaseType = session.metadata?.purchaseType;
      const reportId = session.metadata?.reportId;
      const siteUrl = session.metadata?.siteUrl || '';
      const analyzerType = session.metadata?.analyzerType || '';

      // Handle single report purchase
      if (purchaseType === 'single_report' && reportId) {
        // First, record in billing_sessions for tracking
        try {
          await db.run(
            `INSERT INTO billing_sessions (session_id, purchase_type, report_id, payment_status, mode, amount_total, currency, stripe_customer_id, completed_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT(session_id) DO UPDATE SET
               payment_status = excluded.payment_status,
               completed_at = COALESCE(billing_sessions.completed_at, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP`,
            [sessionId, 'single_report', reportId, 'paid', session.mode, session.amount_total, session.currency, session.customer]
          );
          logger.info('Billing session recorded', { sessionId, reportId });
        } catch (e) {
          logger.warn('Could not record billing session (may already exist)', { error: e.message });
        }

        // Check if already recorded in report_purchases
        const existing = await db.get(
          'SELECT 1 FROM report_purchases WHERE user_id = ? AND report_id = ?',
          [userId, reportId]
        );

        if (!existing) {
          // Record the purchase
          await db.run(
            `INSERT INTO report_purchases (user_id, report_id, stripe_checkout_session_id, purchased_at, site_url, analyzer_type, status)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'paid')
             ON CONFLICT(user_id, report_id) DO UPDATE SET
               stripe_checkout_session_id = excluded.stripe_checkout_session_id,
               purchased_at = CURRENT_TIMESTAMP,
               site_url = COALESCE(excluded.site_url, site_url),
               analyzer_type = COALESCE(excluded.analyzer_type, analyzer_type),
               status = 'paid'`,
            [userId, reportId, sessionId, siteUrl, analyzerType]
          );

          logger.info('Single report purchase recorded via session verification', {
            userId,
            reportId,
            sessionId,
            siteUrl,
            analyzerType
          });
        } else {
          logger.info('Purchase already recorded', { userId, reportId });
        }

        return {
          success: true,
          purchaseType: 'single_report',
          reportId,
          siteUrl,
          analyzerType
        };
      }

      // Handle Day Pass one-time purchase
      if (purchaseType === 'day_pass') {
        // Calculate expiration from payment time to avoid drift on retries
        const paymentTime = session.created ? session.created * 1000 : Date.now();
        const dayPassExpiresAt = new Date(paymentTime + 24 * 60 * 60 * 1000).toISOString();

        // Update user with day pass access
        await db.run(
          `UPDATE users SET
             plan = 'pro',
             stripe_subscription_status = 'active',
             stripe_current_period_end = ?,
             stripe_subscription_interval = 'day'
           WHERE id = ?`,
          [dayPassExpiresAt, userId]
        );

        logger.info('Day Pass recorded via session verification', {
          userId,
          sessionId,
          expiresAt: dayPassExpiresAt
        });

        return {
          success: true,
          purchaseType: 'day_pass',
          expiresAt: dayPassExpiresAt
        };
      }

      // Handle subscription purchase
      if (purchaseType === 'subscription' || session.mode === 'subscription') {
        const subscriptionId = session.subscription;
        const interval = session.metadata?.interval || 'month';

        if (subscriptionId) {
          // Fetch subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          // Update user's subscription status
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
              new Date(subscription.current_period_end * 1000).toISOString(),
              interval,
              userId
            ]
          );

          logger.info('Subscription recorded via session verification', {
            userId,
            subscriptionId,
            status: subscription.status
          });

          return {
            success: true,
            purchaseType: 'subscription',
            subscriptionId,
            interval
          };
        }
      }

      return { success: false, error: 'Unknown purchase type' };

    } catch (error) {
      logger.error('Failed to verify and record purchase', {
        sessionId,
        userId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event) {
    const db = getDatabase();

    logger.info('Processing Stripe webhook', { type: event.type, id: event.id });

    // Atomic idempotency check: INSERT OR IGNORE and check changes to avoid TOCTOU race
    try {
      const result = await db.run(
        'INSERT OR IGNORE INTO stripe_events (id, event_type, processed) VALUES (?, ?, 0)',
        [event.id, event.type]
      );

      if (result.changes === 0) {
        // Row already existed — this is a duplicate event
        logger.warn('Duplicate webhook event, skipping', { eventId: event.id });
        return { received: true, processed: false, reason: 'duplicate' };
      }
    } catch (error) {
      logger.error('Error checking webhook idempotency', { error: error.message });
      // Re-throw so the webhook returns 500 and Stripe retries
      throw error;
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
                await db.run('BEGIN');
                try {
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

                  await db.run('COMMIT');
                } catch (txError) {
                  await db.run('ROLLBACK');
                  throw txError;
                }

                logger.info('Subscription checkout completed - user updated', {
                  userId,
                  subscriptionId,
                  status: subscription.status,
                  interval
                });

              } catch (e) {
                logger.error('Failed to sync subscription from checkout', {
                  sessionId: session.id,
                  error: e.message
                });
              }
            }
          }

          // Handle payment mode purchases (single report or day pass)
          if (session && session.mode === 'payment' && isPaid) {
            const purchaseType = session.metadata?.purchaseType;
            const userId = session.metadata?.userId;
            const reportId = session.metadata?.reportId;

            // Log detailed payment processing info for debugging
            logger.info('[ENTITLEMENT_DEBUG] Processing payment webhook', {
              eventId: event.id,
              sessionId: session.id,
              purchaseType,
              userId: userId ? userId.substring(0, 8) + '...' : null,
              reportId,
              reportIdValid: reportId ? isSafeReportId(reportId) : 'n/a'
            });

            // Handle Day Pass one-time purchase
            if (purchaseType === 'day_pass' && userId) {
              try {
                // Calculate expiration from payment time to avoid drift on retries
                const paymentTime = session.created ? session.created * 1000 : Date.now();
                const dayPassExpiresAt = new Date(paymentTime + 24 * 60 * 60 * 1000).toISOString();

                // Update user with day pass access
                await db.run('BEGIN');
                try {
                  await db.run(
                    `UPDATE users SET
                      plan = 'pro',
                      stripe_subscription_status = 'active',
                      stripe_current_period_end = ?,
                      stripe_subscription_interval = 'day'
                    WHERE id = ?`,
                    [dayPassExpiresAt, userId]
                  );

                  // Update entitlements table
                  await db.run(`
                    INSERT INTO entitlements (user_id, plan, status, current_period_end, scans_remaining, max_pages_per_scan, pdf_export_enabled)
                    VALUES (?, 'pro', 'active', ?, -1, 250, 1)
                    ON CONFLICT(user_id) DO UPDATE SET
                      plan = 'pro',
                      status = 'active',
                      current_period_end = excluded.current_period_end,
                      scans_remaining = -1,
                      max_pages_per_scan = 250,
                      pdf_export_enabled = 1,
                      updated_at = CURRENT_TIMESTAMP
                  `, [userId, dayPassExpiresAt]);

                  await db.run('COMMIT');
                } catch (txError) {
                  await db.run('ROLLBACK');
                  throw txError;
                }

                logger.info('Day Pass purchase recorded successfully', {
                  userId: userId.substring(0, 8) + '...',
                  sessionId: session.id,
                  expiresAt: dayPassExpiresAt
                });

              } catch (e) {
                logger.error('Failed to record Day Pass purchase', {
                  sessionId: session.id,
                  userId: userId.substring(0, 8) + '...',
                  error: e.message,
                  stack: e.stack
                });
              }
            }

            const siteUrl = session.metadata?.siteUrl || '';
            const analyzerType = session.metadata?.analyzerType || '';

            if (purchaseType === 'single_report' && userId && reportId) {
              // Validate reportId format before recording
              if (!isSafeReportId(reportId)) {
                logger.error('[ENTITLEMENT_DEBUG] Invalid reportId format in webhook, rejecting', {
                  sessionId: session.id,
                  reportId,
                  expectedFormat: 'r_<16-hex-chars>'
                });
                // Don't record invalid reportId - this is a critical security check
              } else {
                try {
                  await db.run('BEGIN');
                  try {
                    await db.run(
                      `INSERT INTO report_purchases (user_id, report_id, stripe_checkout_session_id, purchased_at, site_url, analyzer_type, status)
                       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'paid')
                       ON CONFLICT(user_id, report_id) DO UPDATE SET
                         stripe_checkout_session_id = excluded.stripe_checkout_session_id,
                         purchased_at = CURRENT_TIMESTAMP,
                         site_url = COALESCE(excluded.site_url, site_url),
                         analyzer_type = COALESCE(excluded.analyzer_type, analyzer_type),
                         status = 'paid'`,
                      [userId, reportId, session.id, siteUrl, analyzerType]
                    );

                    await db.run('COMMIT');
                  } catch (txError) {
                    await db.run('ROLLBACK');
                    throw txError;
                  }

                  logger.info('[ENTITLEMENT_DEBUG] Single report purchase recorded successfully', {
                    userId: userId.substring(0, 8) + '...',
                    reportId,
                    sessionId: session.id,
                    siteUrl,
                    analyzerType
                  });
                } catch (e) {
                  logger.error('[ENTITLEMENT_DEBUG] Failed to record report purchase', {
                    sessionId: session.id,
                    userId: userId.substring(0, 8) + '...',
                    reportId,
                    error: e.message,
                    stack: e.stack
                  });
                }
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
          // Include past_due as a grace period — Stripe is still retrying payment
          const retainAccessStatuses = ['active', 'trialing', 'past_due'];
          const plan = retainAccessStatuses.includes(subscription.status) ? 'pro' : 'free';
          const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          // Get interval from subscription items
          const interval = subscription.items?.data?.[0]?.price?.recurring?.interval || 'month';

          // Day pass: automatically set to cancel at period end so it doesn't auto-renew
          if (event.type === 'customer.subscription.created' && interval === 'day' && !subscription.cancel_at_period_end) {
            try {
              await stripe.subscriptions.update(subscription.id, {
                cancel_at_period_end: true
              });
              logger.info('Day pass subscription set to cancel at period end', {
                subscriptionId: subscription.id
              });
            } catch (cancelErr) {
              logger.error('Failed to set day pass to cancel at period end', {
                subscriptionId: subscription.id,
                error: cancelErr.message
              });
            }
          }

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
              stripe_subscription_id = NULL,
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
          const customerId = invoice.customer;
          const subscriptionId = invoice.subscription;

          logger.info('Payment succeeded', {
            invoiceId: invoice.id,
            customerId,
            subscriptionId,
            amount: invoice.amount_paid / 100,
            billingReason: invoice.billing_reason
          });

          // Handle subscription renewal payments
          // billing_reason: 'subscription_cycle' indicates a renewal
          if (subscriptionId && (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create')) {
            try {
              // Fetch the subscription to get updated period end
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
              const interval = subscription.items?.data?.[0]?.price?.recurring?.interval || 'month';
              const plan = ['active', 'trialing'].includes(subscription.status) ? 'pro' : 'free';

              // Update user's subscription details
              const result = await db.run(
                `UPDATE users SET
                  plan = ?,
                  stripe_subscription_id = ?,
                  stripe_subscription_status = ?,
                  stripe_current_period_end = ?,
                  stripe_subscription_interval = ?
                WHERE stripe_customer_id = ?`,
                [plan, subscriptionId, subscription.status, currentPeriodEnd, interval, customerId]
              );

              if (result.changes > 0) {
                logger.info('User subscription renewed via invoice.payment_succeeded', {
                  customerId,
                  subscriptionId,
                  status: subscription.status,
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
                    subscriptionId,
                    subscription.status,
                    currentPeriodEnd,
                    plan === 'pro' ? -1 : 3,
                    plan === 'pro' ? 250 : 10,
                    plan === 'pro' ? 1 : 0
                  ]);

                  logger.info('Entitlements updated on renewal', {
                    userId: user.id,
                    plan,
                    currentPeriodEnd
                  });
                }
              }
            } catch (e) {
              logger.error('Failed to update subscription on invoice.payment_succeeded', {
                invoiceId: invoice.id,
                subscriptionId,
                error: e.message
              });
            }
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          logger.warn('Payment failed', {
            invoiceId: invoice.id,
            customerId: invoice.customer,
            attemptCount: invoice.attempt_count
          });

          // Proactively mark subscription as past_due so DB stays in sync
          // even if the customer.subscription.updated event is delayed
          if (invoice.customer && invoice.subscription) {
            try {
              await db.run(
                `UPDATE users SET stripe_subscription_status = 'past_due'
                 WHERE stripe_customer_id = ? AND stripe_subscription_status = 'active'`,
                [invoice.customer]
              );
            } catch (e) {
              logger.error('Failed to update subscription status on payment failure', { error: e.message });
            }
          }

          break;
        }

        case 'customer.subscription.trial_will_end': {
          const subscription = event.data.object;
          logger.info('Trial ending soon', {
            subscriptionId: subscription.id,
            trialEnd: new Date(subscription.trial_end * 1000)
          });

          // Future: Send reminder email about trial ending

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
