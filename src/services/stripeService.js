const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const { getDatabase } = require('../db');
const { createLogger } = require('../utils/logger');

const logger = createLogger('StripeService');

class StripeService {
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
          const plan = subscription.status === 'active' ? 'pro' : 'free';

          // Update user plan
          const result = await db.run(
            'UPDATE users SET plan = ? WHERE stripe_customer_id = ?',
            [plan, customerId]
          );

          if (result.changes > 0) {
            logger.info('User plan updated', { customerId, plan });

            // Update entitlements
            const user = await db.get(
              'SELECT id FROM users WHERE stripe_customer_id = ?',
              [customerId]
            );

            if (user) {
              const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

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

          logger.info('Subscription deleted', {
            subscriptionId: subscription.id,
            customerId
          });

          // Downgrade to free plan
          const result = await db.run(
            'UPDATE users SET plan = ? WHERE stripe_customer_id = ?',
            ['free', customerId]
          );

          if (result.changes > 0) {
            logger.info('User downgraded to free', { customerId });

            // Update entitlements to free tier
            const user = await db.get(
              'SELECT id FROM users WHERE stripe_customer_id = ?',
              [customerId]
            );

            if (user) {
              await db.run(`
                UPDATE entitlements SET
                  plan = 'free',
                  status = 'canceled',
                  scans_remaining = 3,
                  max_pages_per_scan = 10,
                  pdf_export_enabled = 0,
                  updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
              `, [user.id]);

              logger.info('Entitlements downgraded', { userId: user.id });
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
