/**
 * Scan Quota Middleware
 * Enforces daily scan limits at the API boundary
 * Supports both authenticated and anonymous users
 */

const crypto = require('crypto');
const usageService = require('../services/usageService');
const { PRICING, getPlanLimits, isPlanPro } = require('../config/pricing');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ScanQuota');

/**
 * Generate a stable anonymous ID
 * @returns {string} UUID v4
 */
function generateAnonId() {
  return crypto.randomUUID();
}

/**
 * Resolve the effective plan for a user
 * @param {Object|null} user - User object from auth middleware
 * @returns {string} Plan code (free, day_pass, pro_monthly, pro_annual)
 */
function resolveEffectivePlan(user) {
  if (!user) return 'free';

  const { plan, stripe_subscription_status, stripe_subscription_interval, stripe_current_period_end } = user;

  // Check if subscription is active
  const isActive = stripe_subscription_status === 'active' || stripe_subscription_status === 'trialing';

  // Check if within grace period (canceled but not expired)
  const inGracePeriod = stripe_subscription_status === 'canceled' &&
    stripe_current_period_end &&
    new Date(stripe_current_period_end) > new Date();

  // Day Pass special handling: Day Pass sets plan='pro', interval='day', and a future period_end
  // Even if status is not 'active' (e.g., due to webhook race conditions), honor Day Pass if period is valid
  if (stripe_subscription_interval === 'day') {
    if (stripe_current_period_end && new Date(stripe_current_period_end) > new Date()) {
      logger.debug('Day Pass detected via interval and valid period', {
        userId: user.id?.substring(0, 8) + '...',
        periodEnd: stripe_current_period_end,
        status: stripe_subscription_status
      });
      return 'day_pass';
    }
    // Day pass expired or no period_end — always free
    return 'free';
  }

  if (!isActive && !inGracePeriod) {
    return 'free';
  }

  // Map interval to plan code
  if (stripe_subscription_interval === 'year') return 'pro_annual';
  if (stripe_subscription_interval === 'month') return 'pro_monthly';

  // Fallback to user.plan field
  if (plan === 'pro') return 'pro_monthly';

  return 'free';
}

/**
 * Scan quota middleware
 * - Generates anon_id cookie for anonymous users
 * - Checks quota before scan operations
 * - Returns 429 if quota exceeded
 * - Attaches quota info to req for downstream use
 */
async function checkScanQuota(req, res, next) {
  try {
    const userId = req.user?.id || null;
    let anonId = req.cookies?.anon_id || null;

    // Generate and set anon_id cookie for anonymous users
    if (!userId && !anonId) {
      anonId = generateAnonId();
      res.cookie('anon_id', anonId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        sameSite: 'lax'
      });
      logger.debug('Generated new anon_id', { anonId: anonId.substring(0, 8) + '...' });
    }

    // Store anon_id on request for downstream use
    req.anonId = anonId;

    // Billing re-scan: skip quota check entirely. The user already consumed a scan
    // credit on the original scan; this re-scan only re-fetches data so purchased
    // pro sections render unlocked. Only authenticated users can trigger this.
    if (req.body?.billingRescan === true && userId) {
      logger.debug('Billing re-scan: bypassing scan quota check', {
        userId: userId.substring(0, 8) + '...'
      });
      req.planCode = resolveEffectivePlan(req.user);
      req.scanQuota = { allowed: true, remaining: -1, limit: -1, resetAt: null, isUnlimited: true };
      return next();
    }

    // Resolve effective plan
    const planCode = resolveEffectivePlan(req.user);
    req.planCode = planCode;

    // Check scan quota
    const quotaCheck = await usageService.checkScanQuota(userId, anonId, planCode);

    if (!quotaCheck.allowed) {
      logger.info('Scan quota exceeded', {
        userId: userId ? userId.substring(0, 8) + '...' : null,
        anonId: anonId ? anonId.substring(0, 8) + '...' : null,
        plan: planCode,
        used: quotaCheck.limit - quotaCheck.remaining,
        limit: quotaCheck.limit
      });

      return res.status(429).json({
        error: 'scan_quota_exceeded',
        message: planCode === 'free'
          ? `Daily scan limit reached (${quotaCheck.limit} scans). Upgrade to Pro for unlimited scans.`
          : 'Daily scan limit reached.',
        code: 'SCAN_QUOTA_EXCEEDED',
        scansUsed: quotaCheck.limit,
        scansRemaining: 0,
        scansLimit: quotaCheck.limit,
        scansResetAt: quotaCheck.resetAt,
        upgradeUrl: '/upgrade.html',
        pricing: {
          dayPass: PRICING.plans.day_pass.price,
          proMonthly: PRICING.plans.pro_monthly.price,
          proAnnual: PRICING.plans.pro_annual.price
        }
      });
    }

    // Attach quota info for downstream handlers
    req.scanQuota = {
      allowed: true,
      remaining: quotaCheck.remaining,
      limit: quotaCheck.limit,
      resetAt: quotaCheck.resetAt,
      isUnlimited: quotaCheck.remaining === -1
    };

    next();
  } catch (error) {
    logger.error('Scan quota check failed', { error: error.message });
    // On error, allow the scan to proceed (fail open for availability)
    // but log the error for investigation
    req.scanQuota = { allowed: true, remaining: -1, error: true };
    next();
  }
}

/**
 * After scan middleware
 * Increments usage after a successful scan
 * Should be called AFTER scan is validated and queued
 */
async function recordScanUsage(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const anonId = req.anonId || req.cookies?.anon_id || null;

    if (userId || anonId) {
      await usageService.incrementScanUsage(userId, anonId);
    }

    next();
  } catch (error) {
    logger.error('Failed to record scan usage', { error: error.message });
    // Don't fail the request if recording fails
    next();
  }
}

/**
 * Report credit middleware
 * Checks if user has available report credits for Pro unlock actions
 */
async function checkReportCredit(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'You must be logged in to unlock reports.',
        code: 'AUTH_REQUIRED'
      });
    }

    const planCode = resolveEffectivePlan(req.user);
    const subscriptionEnd = req.user.stripe_current_period_end;

    // Calculate day pass expiry (24 hours from subscription start)
    let dayPassExpiry = null;
    if (planCode === 'day_pass' && subscriptionEnd) {
      dayPassExpiry = subscriptionEnd;
    }

    const quotaCheck = await usageService.checkReportQuota(
      req.user.id,
      planCode,
      subscriptionEnd,
      dayPassExpiry
    );

    if (!quotaCheck.allowed) {
      logger.info('Report quota exceeded', {
        userId: req.user.id.substring(0, 8) + '...',
        plan: planCode,
        reason: quotaCheck.reason
      });

      return res.status(403).json({
        error: 'report_quota_exceeded',
        message: quotaCheck.reason === 'upgrade_required'
          ? 'Upgrade to a paid plan to unlock reports.'
          : `No report credits remaining. Your quota resets ${quotaCheck.windowEndsAt ? new Date(quotaCheck.windowEndsAt).toLocaleDateString() : 'at your next billing period'}.`,
        code: 'REPORT_QUOTA_EXCEEDED',
        reportsUsed: quotaCheck.limit - quotaCheck.remaining,
        reportsRemaining: 0,
        reportsLimit: quotaCheck.limit,
        reportWindowEndsAt: quotaCheck.windowEndsAt,
        upgradeUrl: '/upgrade.html',
        pricing: {
          singleReport: PRICING.oneTimePurchases.single_report.price,
          dayPass: PRICING.plans.day_pass.price,
          proMonthly: PRICING.plans.pro_monthly.price,
          proAnnual: PRICING.plans.pro_annual.price
        }
      });
    }

    // Attach quota info for downstream handlers
    req.reportQuota = {
      allowed: true,
      remaining: quotaCheck.remaining,
      limit: quotaCheck.limit,
      windowEndsAt: quotaCheck.windowEndsAt,
      isUnlimited: quotaCheck.remaining === -1
    };

    next();
  } catch (error) {
    logger.error('Report quota check failed', { error: error.message });
    // On error, deny access (fail closed for paid features)
    return res.status(500).json({
      error: 'quota_check_failed',
      message: 'Unable to verify your report quota. Please try again.',
      code: 'QUOTA_CHECK_ERROR'
    });
  }
}

/**
 * Record report usage middleware
 * Increments report usage after a successful unlock
 */
async function recordReportUsage(req, res, next) {
  try {
    const { reportId } = req.body;
    if (req.user?.id && reportId) {
      await usageService.incrementReportUsage(req.user.id, reportId);
    }
    next();
  } catch (error) {
    logger.error('Failed to record report usage', { error: error.message });
    next();
  }
}

module.exports = {
  checkScanQuota,
  recordScanUsage,
  checkReportCredit,
  recordReportUsage,
  resolveEffectivePlan,
  generateAnonId
};
