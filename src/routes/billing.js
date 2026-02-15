const express = require('express');
const stripeService = require('../services/stripeService');
const { createLogger } = require('../utils/logger');
const { ValidationError, asyncHandler } = require('../utils/errorHandler');
const { requireAuth } = require('../middleware/requireAuth');
const { isSafeReportId } = require('../utils/reportId');

const logger = createLogger('BillingRoutes');
const router = express.Router();

function getAllowedReturnHosts(requestHost) {
  const fromEnv = (process.env.BILLING_ALLOWED_RETURN_HOSTS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;

  const host = typeof requestHost === 'string' ? requestHost.split(':')[0] : '';
  return [
    'sitemechanic.io',
    'www.sitemechanic.io',
    'localhost',
    host
  ].filter(Boolean);
}

function validateReturnUrl(returnUrl, requestHost) {
  if (!returnUrl || typeof returnUrl !== 'string') {
    throw new ValidationError('returnUrl is required');
  }

  const trimmed = returnUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (e) {
    throw new ValidationError('returnUrl must be a valid absolute URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ValidationError('returnUrl must use http or https');
  }

  const allowedHosts = getAllowedReturnHosts(requestHost);
  if (!allowedHosts.includes(parsed.hostname)) {
    throw new ValidationError('returnUrl host is not allowed');
  }

  return parsed.toString();
}

/**
 * POST /api/billing/checkout
 * Unified checkout endpoint for subscriptions and single reports
 * Body:
 * {
 *   purchaseType: "subscription" | "single_report",
 *   interval?: "month" | "year" (required for subscription),
 *   reportId?: string (required for single_report),
 *   returnUrl?: string (optional, defaults to account page)
 * }
 */
router.post(
  '/checkout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { purchaseType, interval, reportId, returnUrl, siteUrl, analyzerType, locale } = req.body || {};
    const user = req.user;

    // Normalize locale for Stripe (map our codes to Stripe's supported locales)
    // Stripe supports: auto, bg, cs, da, de, el, en, es, et, fi, fr, hr, hu, id, it, ja, ko, lt, lv, ms, mt, nb, nl, pl, pt, ro, ru, sk, sl, sv, th, tr, uk, vi, zh, zh-HK, zh-TW
    const stripeLocaleMap = {
      'en': 'en',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'pt': 'pt',
      'ja': 'ja',
      'zh': 'zh'
    };
    const stripeLocale = stripeLocaleMap[locale] || 'auto';

    if (!purchaseType || !['subscription', 'single_report'].includes(purchaseType)) {
      throw new ValidationError('purchaseType must be "subscription" or "single_report"');
    }

    if (purchaseType === 'subscription') {
      if (!interval || !['day', 'month', 'year'].includes(interval)) {
        throw new ValidationError('interval must be "day", "month" or "year" for subscriptions');
      }
    }

    if (purchaseType === 'single_report') {
      if (!reportId || typeof reportId !== 'string') {
        throw new ValidationError('single_report requires reportId');
      }
      // Validate reportId format to prevent invalid purchases
      if (!isSafeReportId(reportId)) {
        logger.warn('Invalid reportId format in checkout request', { reportId, userId: user.id });
        throw new ValidationError('Invalid reportId format. Expected: r_<16-hex-chars>');
      }
    }

    // Determine return URL
    const requestHost = req.get('host');
    let safeReturnUrl;
    if (returnUrl) {
      safeReturnUrl = validateReturnUrl(returnUrl, requestHost);
    } else {
      // Default to account page
      const baseUrl = stripeService.getBaseUrl(`${req.protocol}://${requestHost}`);
      safeReturnUrl = `${baseUrl}/account.html`;
    }

    logger.info('Creating checkout session', {
      userId: user.id,
      purchaseType,
      interval: interval || null,
      reportId: reportId || null,
      returnUrl: safeReturnUrl
    });

    // Helper to properly append query params to a URL that may already have params
    // Note: Stripe's {CHECKOUT_SESSION_ID} placeholder must NOT be URL-encoded
    function appendQueryParams(baseUrl, params) {
      const url = new URL(baseUrl);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value);
        }
      });
      return url.toString();
    }

    // Build success URLs with the {CHECKOUT_SESSION_ID} placeholder
    // Stripe requires this exact literal string (not URL-encoded) to replace with the actual session ID
    let session;
    if (purchaseType === 'subscription') {
      // Build URL without session_id first, then append it manually
      const baseSuccessUrl = appendQueryParams(safeReturnUrl, { billing_success: 'true' });
      const successUrl = baseSuccessUrl + '&session_id={CHECKOUT_SESSION_ID}';
      const cancelUrl = appendQueryParams(safeReturnUrl, { billing_canceled: 'true' });

      logger.info('Stripe checkout URLs (subscription)', { successUrl, cancelUrl });

      session = await stripeService.createSubscriptionCheckout({
        userId: user.id,
        email: user.email,
        interval,
        successUrl,
        cancelUrl,
        locale: stripeLocale
      });
    } else {
      // Build URL without session_id first, then append it manually
      const baseSuccessUrl = appendQueryParams(safeReturnUrl, { billing_success: 'true', report_id: reportId });
      const successUrl = baseSuccessUrl + '&session_id={CHECKOUT_SESSION_ID}';
      const cancelUrl = appendQueryParams(safeReturnUrl, { billing_canceled: 'true' });

      logger.info('Stripe checkout URLs (single_report)', { successUrl, cancelUrl, reportId });

      session = await stripeService.createSingleReportCheckout({
        userId: user.id,
        email: user.email,
        reportId,
        siteUrl: siteUrl || '',
        analyzerType: analyzerType || '',
        successUrl,
        cancelUrl,
        locale: stripeLocale
      });
    }

    res.json({ checkoutUrl: session.url });
  })
);

/**
 * GET /api/billing/portal
 * Create Stripe Customer Portal session for subscription management
 */
router.get(
  '/portal',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    const requestHost = req.get('host');
    const baseUrl = stripeService.getBaseUrl(`${req.protocol}://${requestHost}`);
    const returnUrl = `${baseUrl}/account.html`;

    logger.info('Creating portal session', { userId: user.id });

    const session = await stripeService.createPortalSession(user.id, returnUrl);

    res.json({ portalUrl: session.url });
  })
);

/**
 * GET /api/billing/status
 * Get normalized billing info for the authenticated user
 * Returns:
 * {
 *   plan: "free" | "pro",
 *   subscriptionStatus: "active" | "trialing" | "canceled" | "past_due" | null,
 *   subscriptionInterval: "month" | "year" | null,
 *   currentPeriodEnd: ISO date string | null,
 *   cancelAtPeriodEnd: boolean,
 *   hasStripeCustomer: boolean,
 *   purchasedReports: string[] (array of report IDs)
 * }
 */
router.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;

    logger.info('Fetching billing status', { userId: user.id });

    const status = await stripeService.getBillingStatus(user.id);

    res.json(status);
  })
);

/**
 * GET /api/billing/entitlements
 * Alias for /api/auth/me/entitlements - canonical entitlements endpoint
 * This is the single source of truth for all entitlement decisions.
 *
 * Returns canonical entitlements object (see /api/auth/me/entitlements for shape)
 */
router.get(
  '/entitlements',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;

    logger.info('Fetching entitlements', { userId: user.id });

    const entitlements = await stripeService.getEntitlements(user.id);

    res.json(entitlements);
  })
);

/**
 * POST /api/billing/verify-purchase
 * Verify a checkout session and record the purchase
 * This is the primary method for recording purchases (fallback for webhooks)
 * Body: { session_id: string }
 */
router.post(
  '/verify-purchase',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { session_id } = req.body || {};
    const user = req.user;

    if (!session_id || typeof session_id !== 'string') {
      throw new ValidationError('session_id is required');
    }

    logger.info('Verifying purchase from session', { userId: user.id, sessionId: session_id });

    const result = await stripeService.verifyAndRecordPurchase(session_id, user.id);

    if (result.success) {
      logger.info('Purchase verified and recorded', {
        userId: user.id,
        purchaseType: result.purchaseType,
        reportId: result.reportId
      });
    } else {
      logger.warn('Purchase verification failed', {
        userId: user.id,
        sessionId: session_id,
        error: result.error
      });
    }

    res.json(result);
  })
);

/**
 * POST /api/billing/sync-purchases
 * Sync all paid Stripe sessions to report_purchases table
 * This queries Stripe directly to find payments that weren't recorded locally.
 * Essential for local development where webhooks don't fire.
 *
 * Returns: { synced: number, errors: number, details: [...] }
 */
router.post(
  '/sync-purchases',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;

    logger.info('Syncing purchases for user', { userId: user.id });

    const { getDatabase } = require('../db');
    const db = getDatabase();

    // Get user's Stripe customer ID
    const userRecord = await db.get('SELECT stripe_customer_id FROM users WHERE id = ?', [user.id]);

    if (!userRecord?.stripe_customer_id) {
      logger.info('User has no Stripe customer ID, nothing to sync', { userId: user.id });
      return res.json({ synced: 0, errors: 0, details: [], total: 0, message: 'No Stripe customer found' });
    }

    // Query Stripe directly for recent checkout sessions for this customer
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    let stripeSessions = [];

    try {
      const sessions = await stripe.checkout.sessions.list({
        customer: userRecord.stripe_customer_id,
        limit: 50,
        expand: ['data.line_items']
      });

      stripeSessions = sessions.data.filter(s =>
        s.payment_status === 'paid' &&
        s.metadata?.purchaseType === 'single_report' &&
        s.metadata?.reportId
      );

      logger.info('Found paid Stripe sessions', {
        userId: user.id,
        total: sessions.data.length,
        singleReportPaid: stripeSessions.length
      });
    } catch (e) {
      logger.error('Failed to fetch Stripe sessions', { error: e.message });
      return res.status(500).json({ error: 'Failed to fetch from Stripe', message: e.message });
    }

    // Get existing report purchases to avoid duplicates
    const existingPurchases = await db.all(
      'SELECT report_id FROM report_purchases WHERE user_id = ?',
      [user.id]
    );
    const existingReportIds = new Set(existingPurchases.map(p => p.report_id));

    const results = [];
    let synced = 0;
    let errors = 0;
    let skipped = 0;

    for (const session of stripeSessions) {
      const reportId = session.metadata.reportId;
      const siteUrl = session.metadata.siteUrl || '';
      const analyzerType = session.metadata.analyzerType || '';

      // Skip if already recorded
      if (existingReportIds.has(reportId)) {
        skipped++;
        results.push({ sessionId: session.id, reportId, status: 'already_exists' });
        continue;
      }

      // Directly record the purchase - we already verified this session belongs to this customer
      // No need to call verifyAndRecordPurchase which may have stricter userId checks
      try {
        // Record in billing_sessions
        await db.run(
          `INSERT INTO billing_sessions (session_id, purchase_type, report_id, payment_status, mode, amount_total, currency, stripe_customer_id, completed_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT(session_id) DO UPDATE SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP`,
          [session.id, 'single_report', reportId, 'paid', session.mode, session.amount_total, session.currency, session.customer]
        );

        // Record in report_purchases
        await db.run(
          `INSERT INTO report_purchases (user_id, report_id, stripe_checkout_session_id, purchased_at, site_url, analyzer_type, status)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'paid')
           ON CONFLICT(user_id, report_id) DO UPDATE SET
             stripe_checkout_session_id = excluded.stripe_checkout_session_id,
             purchased_at = CURRENT_TIMESTAMP,
             site_url = COALESCE(excluded.site_url, site_url),
             analyzer_type = COALESCE(excluded.analyzer_type, analyzer_type),
             status = 'paid'`,
          [user.id, reportId, session.id, siteUrl, analyzerType]
        );

        synced++;
        existingReportIds.add(reportId);
        results.push({ sessionId: session.id, reportId, status: 'synced', siteUrl });
        logger.info('Synced purchase directly', { userId: user.id, reportId, sessionId: session.id });
      } catch (e) {
        errors++;
        results.push({ sessionId: session.id, reportId, status: 'error', error: e.message });
        logger.error('Failed to sync purchase', { error: e.message, reportId, sessionId: session.id });
      }
    }

    logger.info('Purchase sync completed', { userId: user.id, synced, errors, skipped, total: stripeSessions.length });

    res.json({
      synced,
      errors,
      skipped,
      details: results,
      total: stripeSessions.length,
      message: synced > 0 ? `Synced ${synced} purchase(s) from Stripe` : 'No new purchases to sync'
    });
  })
);

/**
 * GET /api/billing/verify-session?session_id=...
 * Legacy endpoint for verifying billing sessions
 * On success returns:
 * {
 *   paid: boolean,
 *   purchaseType: "single_report" | "credit_pack",
 *   reportId: string | null,
 *   creditsAdded: 0 | 5 | 10 | 25
 * }
 */
router.get(
  '/verify-session',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessionId = req.query.session_id;
    if (!sessionId || typeof sessionId !== 'string') {
      throw new ValidationError('session_id is required');
    }

    const result = await stripeService.verifyBillingSession(sessionId);
    res.json(result);
  })
);

/**
 * POST /api/billing/create-checkout-session
 * Legacy endpoint - now redirects to /checkout for subscriptions
 * or handles credit packs directly
 * Body:
 * {
 *   purchaseType: "single_report" | "credit_pack",
 *   packId?: "pack_5" | "pack_10" | "pack_25",
 *   reportId?: string,
 *   returnUrl: string
 * }
 */
router.post(
  '/create-checkout-session',
  asyncHandler(async (req, res) => {
    const { purchaseType, packId, reportId, returnUrl, returnTo } = req.body || {};

    if (!purchaseType || (purchaseType !== 'single_report' && purchaseType !== 'credit_pack')) {
      throw new ValidationError('purchaseType must be "single_report" or "credit_pack"');
    }

    if (purchaseType === 'single_report') {
      if (!reportId || typeof reportId !== 'string') {
        throw new ValidationError('single_report requires reportId');
      }
      // Validate reportId format to prevent invalid purchases
      if (!isSafeReportId(reportId)) {
        logger.warn('Invalid reportId format in legacy checkout request', { reportId });
        throw new ValidationError('Invalid reportId format. Expected: r_<16-hex-chars>');
      }
    }

    if (purchaseType === 'credit_pack') {
      if (!packId || !['pack_5', 'pack_10', 'pack_25'].includes(packId)) {
        throw new ValidationError('packId must be one of: pack_5, pack_10, pack_25');
      }
    }

    // Back-compat: older clients send returnTo (relative). Prefer returnUrl (absolute).
    const requestHost = req.get('host');
    let safeReturnUrl;
    if (returnUrl) {
      safeReturnUrl = validateReturnUrl(returnUrl, requestHost);
    } else if (returnTo && typeof returnTo === 'string') {
      // Best-effort: convert relative path to absolute using request origin.
      const origin = `${req.protocol}://${requestHost}`;
      safeReturnUrl = validateReturnUrl(new URL(returnTo.trim(), origin).toString(), requestHost);
    } else {
      throw new ValidationError('returnUrl is required');
    }

    logger.info('Creating billing checkout session (legacy)', {
      purchaseType,
      packId: packId || null,
      reportId: reportId || null,
      returnUrl: safeReturnUrl
    });

    const session = await stripeService.createBillingCheckoutSession({
      purchaseType,
      packId: packId || null,
      reportId: reportId || null,
      returnUrl: safeReturnUrl,
      requestOrigin: `${req.protocol}://${req.get('host')}`
    });

    res.json({ checkoutUrl: session.url });
  })
);

/**
 * GET /api/billing/diagnose
 * Full diagnostic of user's purchase state
 */
router.get(
  '/diagnose',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    const { getDatabase } = require('../db');
    const db = getDatabase();

    // Get all data
    const userRecord = await db.get('SELECT id, email, stripe_customer_id FROM users WHERE id = ?', [user.id]);
    const reportPurchases = await db.all('SELECT * FROM report_purchases WHERE user_id = ? ORDER BY purchased_at DESC', [user.id]);
    const billingSessions = await db.all('SELECT * FROM billing_sessions WHERE stripe_customer_id = ? ORDER BY completed_at DESC LIMIT 20', [userRecord?.stripe_customer_id]);
    const billingStatus = await stripeService.getBillingStatus(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        stripe_customer_id: userRecord?.stripe_customer_id
      },
      database: {
        report_purchases_count: reportPurchases.length,
        report_purchases: reportPurchases,
        billing_sessions_count: billingSessions.length,
        billing_sessions: billingSessions
      },
      billingStatus: {
        plan: billingStatus.plan,
        purchasedReports: billingStatus.purchasedReports,
        purchasedReportDetails: billingStatus.purchasedReportDetails
      }
    });
  })
);

/**
 * GET /api/billing/debug/:reportId
 * Debug endpoint to troubleshoot entitlement issues
 * Shows all relevant database records for a specific report
 * Only available in development or for admin users
 */
router.get(
  '/debug/:reportId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const user = req.user;

    // Only allow in development or for admin users
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev && !user.is_admin) {
      return res.status(403).json({ error: 'Debug endpoint only available in development' });
    }

    const { getDatabase } = require('../db');
    const db = getDatabase();

    logger.info('Debug entitlements request', { reportId, userId: user.id });

    try {
      // 1. Get user's subscription status
      const userRecord = await db.get(
        `SELECT id, email, plan, stripe_customer_id, stripe_subscription_id,
                stripe_subscription_status, stripe_current_period_end, stripe_subscription_interval
         FROM users WHERE id = ?`,
        [user.id]
      );

      // 2. Get report_purchases for this user
      const reportPurchases = await db.all(
        `SELECT * FROM report_purchases WHERE user_id = ? ORDER BY purchased_at DESC`,
        [user.id]
      );

      // 3. Get report_purchases for this specific report (any user)
      const reportPurchasesForReport = await db.all(
        `SELECT user_id, report_id, purchased_at, site_url, analyzer_type, status
         FROM report_purchases WHERE report_id = ?`,
        [reportId]
      );

      // 4. Get billing_sessions for this report
      const billingSessions = await db.all(
        `SELECT session_id, purchase_type, report_id, payment_status, completed_at, stripe_customer_id
         FROM billing_sessions WHERE report_id = ? ORDER BY completed_at DESC`,
        [reportId]
      );

      // 5. Get all billing_sessions for this user's Stripe customer
      let userBillingSessions = [];
      if (userRecord?.stripe_customer_id) {
        userBillingSessions = await db.all(
          `SELECT session_id, purchase_type, report_id, payment_status, completed_at
           FROM billing_sessions WHERE stripe_customer_id = ? ORDER BY completed_at DESC LIMIT 10`,
          [userRecord.stripe_customer_id]
        );
      }

      // 6. Get entitlements record
      const entitlements = await db.get(
        `SELECT * FROM entitlements WHERE user_id = ?`,
        [user.id]
      );

      // 7. Check if reportId is valid format
      const isValidFormat = isSafeReportId(reportId);

      // 8. Compute effective access
      const canAccessPaid = await stripeService.canAccessPaid(user, reportId);
      const billingStatus = await stripeService.getBillingStatus(user.id);

      res.json({
        debug: true,
        timestamp: new Date().toISOString(),
        reportId,
        reportIdValidFormat: isValidFormat,

        user: {
          id: user.id,
          email: user.email,
          plan: userRecord?.plan,
          stripeCustomerId: userRecord?.stripe_customer_id,
          subscriptionStatus: userRecord?.stripe_subscription_status,
          subscriptionInterval: userRecord?.stripe_subscription_interval,
          currentPeriodEnd: userRecord?.stripe_current_period_end
        },

        access: {
          canAccessPaid,
          isPro: billingStatus?.plan === 'pro' || billingStatus?.plan === 'day_pass',
          reportInPurchasedList: billingStatus?.purchasedReports?.includes(reportId),
          purchasedReportsCount: billingStatus?.purchasedReports?.length || 0,
          purchasedReports: billingStatus?.purchasedReports || []
        },

        database: {
          reportPurchasesForUser: reportPurchases,
          reportPurchasesForThisReport: reportPurchasesForReport,
          billingSessionsForThisReport: billingSessions,
          billingSessionsForUser: userBillingSessions,
          entitlementsRecord: entitlements
        },

        suggestion: !canAccessPaid ? (
          billingSessions.length > 0 && billingSessions[0].payment_status === 'paid'
            ? 'Found paid billing session but no report_purchase record. Try calling POST /api/billing/verify-purchase with session_id: ' + billingSessions[0].session_id
            : reportPurchasesForReport.length > 0 && reportPurchasesForReport[0].user_id !== user.id
              ? 'Report was purchased by a different user (user_id: ' + reportPurchasesForReport[0].user_id + ')'
              : 'No purchase record found. User needs to purchase this report.'
        ) : 'Access granted - no issues detected'
      });

    } catch (error) {
      logger.error('Debug endpoint error', { error: error.message });
      res.status(500).json({ error: 'Debug query failed', message: error.message });
    }
  })
);

module.exports = router;
