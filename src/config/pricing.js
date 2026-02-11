/**
 * Centralized Pricing Configuration
 * Single source of truth for all pricing, plans, and entitlements
 */

const PRICING = {
  plans: {
    free: {
      price: 0,
      display: '$0/month',
      limits: {
        scansPerDay: 10,
        paidReportsPerWindow: 0,  // Free users cannot unlock reports
        pagesPerCrawl: 1,
        pdfExport: false
      }
    },
    day_pass: {
      price: 20,
      display: '$20 / day',
      interval: 'day',
      stripeEnvKey: 'STRIPE_PRICE_DAY_PASS',
      limits: {
        scansPerDay: -1, // unlimited
        paidReportsPerWindow: 30,  // 30 reports in day pass window
        pagesPerCrawl: 250,
        pdfExport: true
      }
    },
    pro_monthly: {
      price: 29,
      display: '$29/month',
      interval: 'month',
      stripeEnvKey: 'STRIPE_PRICE_PRO_MONTHLY',
      limits: {
        scansPerDay: -1, // unlimited
        paidReportsPerWindow: 250,  // 250 reports per billing period
        pagesPerCrawl: 250,
        pdfExport: true
      }
    },
    pro_annual: {
      price: 290,
      effectiveMonthly: 24,
      savings: 60,
      display: '$24/month (Save $60/year)',
      interval: 'year',
      stripeEnvKey: 'STRIPE_PRICE_PRO_YEARLY',
      limits: {
        scansPerDay: -1, // unlimited
        paidReportsPerWindow: -1,  // unlimited reports
        pagesPerCrawl: 250,
        pdfExport: true
      }
    }
  },
  oneTimePurchases: {
    single_report: {
      price: 5,
      display: '$5 one-time',
      stripeEnvKey: 'STRIPE_PRICE_SINGLE_REPORT'
    }
  }
};

/**
 * Get the free tier limits
 * @returns {Object} Free tier limits
 */
function getFreeLimits() {
  return PRICING.plans.free.limits;
}

/**
 * Get limits for a specific plan
 * @param {string} planKey - Plan key (free, day_pass, pro_monthly, pro_annual)
 * @returns {Object} Plan limits
 */
function getPlanLimits(planKey) {
  const plan = PRICING.plans[planKey];
  return plan ? plan.limits : PRICING.plans.free.limits;
}

/**
 * Get the Stripe price ID for a plan interval
 * @param {string} interval - 'day', 'month', or 'year'
 * @returns {string|null} Stripe price ID from environment
 */
function getStripePriceId(interval) {
  const intervalMap = {
    day: 'day_pass',
    month: 'pro_monthly',
    year: 'pro_annual'
  };
  const planKey = intervalMap[interval];
  if (!planKey) return null;

  const plan = PRICING.plans[planKey];
  if (!plan || !plan.stripeEnvKey) return null;

  return process.env[plan.stripeEnvKey] || null;
}

/**
 * Get the Stripe price ID for single report purchase
 * @returns {string|null} Stripe price ID from environment
 */
function getSingleReportPriceId() {
  const envKey = PRICING.oneTimePurchases.single_report.stripeEnvKey;
  return process.env[envKey] || process.env.STRIPE_PRICE_SINGLE_REPORT_10 || null;
}

/**
 * Check if a plan has Pro-level access
 * @param {string} planKey - Plan key
 * @returns {boolean}
 */
function isPlanPro(planKey) {
  return planKey === 'pro_monthly' || planKey === 'pro_annual' || planKey === 'day_pass';
}

module.exports = {
  PRICING,
  getFreeLimits,
  getPlanLimits,
  getStripePriceId,
  getSingleReportPriceId,
  isPlanPro
};
