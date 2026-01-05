const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');
const { requireAuth } = require('../middleware/requireAuth');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PaymentRoutes');

/**
 * POST /api/payment/create-checkout-session
 * Create a Stripe Checkout session for Pro subscription
 */
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const { successUrl, cancelUrl } = req.body;

    logger.info('Creating checkout session', { userId: req.user.id });

    const session = await stripeService.createCheckoutSession(
      req.user.id,
      req.user.email,
      successUrl,
      cancelUrl
    );

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id
    });
  } catch (error) {
    logger.error('Error creating checkout session', {
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
 * POST /api/payment/create-portal-session
 * Create a Stripe Customer Portal session for subscription management
 */
router.post('/create-portal-session', requireAuth, async (req, res) => {
  try {
    const { returnUrl } = req.body;

    logger.info('Creating portal session', { userId: req.user.id });

    const session = await stripeService.createPortalSession(
      req.user.id,
      returnUrl
    );

    res.json({
      success: true,
      url: session.url
    });
  } catch (error) {
    logger.error('Error creating portal session', {
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
router.post('/create-report-payment', async (req, res) => {
  try {
    const { reportType, url, email, successUrl, cancelUrl } = req.body;

    if (!reportType || !url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: reportType and url'
      });
    }

    if (!['cwv', 'lighthouse'].includes(reportType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report type. Must be "cwv" or "lighthouse"'
      });
    }

    logger.info('Creating report payment', { reportType, url, email });

    const session = await stripeService.createOneTimePayment(
      reportType,
      url,
      email,
      successUrl,
      cancelUrl
    );

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id
    });
  } catch (error) {
    logger.error('Error creating report payment', {
      error: error.message,
      reportType: req.body?.reportType
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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
