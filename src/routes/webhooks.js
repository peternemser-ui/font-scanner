const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const stripeService = require('../services/stripeService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('WebhookRoutes');

/**
 * POST /api/webhooks/stripe
 * Stripe webhook endpoint
 *
 * IMPORTANT: This endpoint must receive raw body, not parsed JSON
 * Configure in server.js BEFORE express.json() middleware
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      logger.info('Webhook signature verified', { type: event.type });
    } else if (process.env.NODE_ENV === 'production') {
      logger.error('STRIPE_WEBHOOK_SECRET not configured in production — rejecting webhook');
      return res.status(500).send('Webhook not configured');
    } else {
      // No webhook secret configured - accept unverified (dev/testing only)
      logger.warn('No webhook secret configured - accepting unverified webhook (non-production)');
      try {
        event = JSON.parse(req.body.toString());
      } catch (parseError) {
        logger.error('Failed to parse webhook body as JSON', { error: parseError.message });
        return res.status(400).send('Invalid JSON body');
      }
    }
  } catch (error) {
    logger.error('Webhook signature verification failed', {
      error: error.message,
      signature: sig?.substring(0, 20)
    });

    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    // Process the event
    const result = await stripeService.handleWebhook(event);

    logger.info('Webhook processed', {
      type: event.type,
      id: event.id,
      processed: result.processed
    });

    res.json({ received: true, processed: result.processed });
  } catch (error) {
    logger.error('Webhook processing error', {
      type: event.type,
      id: event.id,
      error: error.message,
      stack: error.stack
    });

    // Return 500 so Stripe retries the event.
    // Idempotency checks in handleWebhook() protect against duplicate processing.
    res.status(500).json({
      received: true,
      processed: false,
      error: error.message
    });
  }
});

module.exports = router;
