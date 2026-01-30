const express = require('express');
const stripeService = require('../services/stripeService');
const { createLogger } = require('../utils/logger');
const { ValidationError, asyncHandler } = require('../utils/errorHandler');
const { requireAuth } = require('../middleware/requireAuth');

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
    const { purchaseType, interval, reportId, returnUrl, siteUrl, analyzerType } = req.body || {};
    const user = req.user;

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
        cancelUrl
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
        cancelUrl
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

module.exports = router;
