/**
 * Centralized Pricing Configuration (Browser Version)
 * Single source of truth for all pricing, plans, and entitlements
 *
 * Usage: window.PRICING.plans.pro_monthly.price => 29
 */

(function(window) {
  'use strict';

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
        display: '$20 / 8 hours',
        interval: 'day',
        limits: {
          scansPerDay: -1, // unlimited
          paidReportsPerWindow: 30,  // 30 reports in 8-hour window
          pagesPerCrawl: 250,
          pdfExport: true
        }
      },
      pro_monthly: {
        price: 29,
        display: '$29/month',
        interval: 'month',
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
        display: '$5 one-time'
      }
    }
  };

  /**
   * Get the free tier limits
   * @returns {Object} Free tier limits
   */
  PRICING.getFreeLimits = function() {
    return PRICING.plans.free.limits;
  };

  /**
   * Get limits for a specific plan
   * @param {string} planKey - Plan key (free, day_pass, pro_monthly, pro_annual)
   * @returns {Object} Plan limits
   */
  PRICING.getPlanLimits = function(planKey) {
    const plan = PRICING.plans[planKey];
    return plan ? plan.limits : PRICING.plans.free.limits;
  };

  /**
   * Check if a plan has Pro-level access
   * @param {string} planKey - Plan key
   * @returns {boolean}
   */
  PRICING.isPlanPro = function(planKey) {
    return planKey === 'pro_monthly' || planKey === 'pro_annual' || planKey === 'day_pass' || planKey === 'pro';
  };

  // Expose globally
  window.PRICING = PRICING;

})(window);
