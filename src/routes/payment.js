const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');
const { requireAuth } = require('../middleware/requireAuth');
const { createLogger } = require('../utils/logger');
const { ValidationError, asyncHandler } = require('../utils/errorHandler');

const logger = createLogger('PaymentRoutes');

function getAllowedReturnHosts(requestHost) {
  const fromEnv = (process.env.PAYMENT_ALLOWED_RETURN_HOSTS || '')
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

function appendQuery(urlString, query) {
  const url = new URL(urlString);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

/**
 * POST /api/payment/create-checkout-session
 * Create a Stripe Checkout session for Pro subscription
 */
router.post(
  '/create-checkout-session',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { successUrl, cancelUrl, returnUrl } = req.body || {};

    logger.info('Creating checkout session', { userId: req.user.id });

    const requestHost = req.get('host');
    let safeSuccessUrl = successUrl;
    let safeCancelUrl = cancelUrl;

    if (returnUrl) {
      const safeReturnUrl = validateReturnUrl(returnUrl, requestHost);
      safeSuccessUrl = safeSuccessUrl || appendQuery(safeReturnUrl, { success: 'true' });
      safeCancelUrl = safeCancelUrl || appendQuery(safeReturnUrl, { canceled: 'true' });
    }

    // If provided, validate success/cancel URLs are safe absolute URLs on allowed hosts.
    if (safeSuccessUrl) safeSuccessUrl = validateReturnUrl(safeSuccessUrl, requestHost);
    if (safeCancelUrl) safeCancelUrl = validateReturnUrl(safeCancelUrl, requestHost);

    const session = await stripeService.createCheckoutSession(
      req.user.id,
      req.user.email,
      safeSuccessUrl,
      safeCancelUrl
    );

    // New contract: checkoutUrl. Keep legacy fields for back-compat.
    res.json({
      success: true,
      checkoutUrl: session.url,
      url: session.url,
      sessionId: session.id
    });
  })
);

/**
 * POST /api/payment/create-portal-session
 * Create a Stripe Customer Portal session for subscription management
 */
router.post(
  '/create-portal-session',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { returnUrl } = req.body || {};
    const requestHost = req.get('host');

    logger.info('Creating portal session', { userId: req.user.id });

    const safeReturnUrl = returnUrl ? validateReturnUrl(returnUrl, requestHost) : null;
    const session = await stripeService.createPortalSession(req.user.id, safeReturnUrl);

    res.json({
      success: true,
      portalUrl: session.url,
      url: session.url
    });
  })
);

/**
 * GET /api/payment/subscription
 * Get current user's subscription details
 */
router.get('/subscription', requireAuth, async (req, res) => {
  try {
    const subscription = await stripeService.getUserSubscription(req.user.id);

    res.json({
      success: true,
      subscription,
      plan: req.user.plan
    });
  } catch (error) {
    logger.error('Error fetching subscription', {
      userId: req.user?.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/payment/cancel-subscription
 * Cancel subscription at period end
 */
router.post('/cancel-subscription', requireAuth, async (req, res) => {
  try {
    logger.info('Canceling subscription', { userId: req.user.id });

    const subscription = await stripeService.cancelSubscription(req.user.id);

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      }
    });
  } catch (error) {
    logger.error('Error canceling subscription', {
      userId: req.user?.id,
      error: error.message
    });

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/payment/create-report-payment
 * Create one-time payment for individual report (no auth required)
 * Body: { reportType: 'cwv' | 'lighthouse', url: string, email?: string }
 */
router.post(
  '/create-report-payment',
  asyncHandler(async (req, res) => {
    const { reportType, url, email, successUrl, cancelUrl, returnUrl } = req.body || {};

    if (!reportType || !url) {
      throw new ValidationError('Missing required fields: reportType and url');
    }

    if (!['cwv', 'lighthouse'].includes(reportType)) {
      throw new ValidationError('Invalid report type. Must be "cwv" or "lighthouse"');
    }

    const requestHost = req.get('host');
    let safeSuccessUrl = successUrl;
    let safeCancelUrl = cancelUrl;

    if (returnUrl) {
      const safeReturnUrl = validateReturnUrl(returnUrl, requestHost);
      safeSuccessUrl = safeSuccessUrl || appendQuery(safeReturnUrl, { payment: 'success', type: reportType, url: url });
      safeCancelUrl = safeCancelUrl || appendQuery(safeReturnUrl, { payment: 'canceled', type: reportType });
    }

    if (safeSuccessUrl) safeSuccessUrl = validateReturnUrl(safeSuccessUrl, requestHost);
    if (safeCancelUrl) safeCancelUrl = validateReturnUrl(safeCancelUrl, requestHost);

    logger.info('Creating report payment', { reportType, url, email: email || null });

    const session = await stripeService.createOneTimePayment(
      reportType,
      url,
      email,
      safeSuccessUrl,
      safeCancelUrl
    );

    res.json({
      success: true,
      checkoutUrl: session.url,
      url: session.url,
      sessionId: session.id
    });
  })
);

/**
 * GET /api/payment/verify/:sessionId
 * Verify payment completion (no auth required)
 */
router.get('/verify/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID required'
      });
    }

    logger.info('Verifying payment', { sessionId });

    const verification = await stripeService.verifyPayment(sessionId);

    res.json({
      success: true,
      ...verification
    });
  } catch (error) {
    logger.error('Error verifying payment', {
      sessionId: req.params?.sessionId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
