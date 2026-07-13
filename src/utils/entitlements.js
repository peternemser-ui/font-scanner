/**
 * Canonical Entitlements Utility
 *
 * This is the SINGLE SOURCE OF TRUTH for all entitlement decisions.
 * All entitlement checks throughout the application should use these functions.
 *
 * Entitlement Rules:
 * 1. Pro subscription (active/trialing): Unlocks all reports and features
 * 2. Day pass (active within 24h): Unlocks all reports and features
 * 3. Single report purchase: Unlocks specific reportId only
 * 4. Free: Access to free sections only
 */

const { getDatabase } = require('../db');
const { createLogger } = require('./logger');
const { isSafeReportId } = require('./reportId');

const logger = createLogger('Entitlements');

/**
 * Normalize a date value from the database to ISO 8601 format.
 * SQLite may return dates as "YYYY-MM-DD HH:MM:SS.sss+00" instead of ISO "...T...Z".
 * @param {string|null} val
 * @returns {string|null}
 */
function toISO(val) {
  if (!val) return null;
  // Already ISO format
  if (val.includes('T')) return val;
  // Convert SQLite format to ISO
  try {
    return new Date(val).toISOString();
  } catch {
    return val;
  }
}

// One-time migration flag for NULL-status report_purchases records
let _nullStatusMigrated = false;

/**
 * Canonical entitlements shape returned by resolveEntitlements
 * @typedef {Object} Entitlements
 * @property {string} plan - "free" | "pro" | "day_pass"
 * @property {string} subscriptionStatus - "active" | "trialing" | "canceled" | "past_due" | "none"
 * @property {string|null} subscriptionInterval - "day" | "month" | "year" | null
 * @property {string|null} currentPeriodEnd - ISO date string | null
 * @property {string|null} dayPassExpiresAt - ISO date string | null
 * @property {boolean} cancelAtPeriodEnd
 * @property {string[]} purchasedReports - Array of report IDs
 * @property {Object} permissions
 * @property {boolean} permissions.accessProTools - Global pro tools access
 * @property {boolean} permissions.viewProSections - Global pro sections access
 * @property {boolean} permissions.exportReports - Global export access
 */

/**
 * Get default free entitlements (for unauthenticated users)
 * @returns {Entitlements}
 */
function getDefaultEntitlements() {
  return {
    plan: 'free',
    subscriptionStatus: 'none',
    subscriptionInterval: null,
    currentPeriodEnd: null,
    dayPassExpiresAt: null,
    cancelAtPeriodEnd: false,
    purchasedReports: [],
    permissions: {
      accessProTools: false,
      viewProSections: false,
      exportReports: false
    }
  };
}

/**
 * Resolve entitlements for a user
 *
 * This is the canonical entitlements resolver.
 * Use this function for ALL entitlement decisions.
 *
 * @param {Object} userContext - User context object
 * @param {string} userContext.userId - User ID (null for guest)
 * @param {string} userContext.sessionId - Session ID (for guest tracking)
 * @returns {Promise<Entitlements>}
 */
async function resolveEntitlements(userContext = {}) {
  const { userId, sessionId } = userContext;

  // If no userId, return default free entitlements
  if (!userId) {
    logger.debug('resolveEntitlements: No userId, returning free entitlements', { sessionId });
    return getDefaultEntitlements();
  }

  const db = getDatabase();

  try {
    // Get user data with subscription fields
    const user = await db.get(
      `SELECT
        id, email, plan, stripe_customer_id,
        stripe_subscription_id, stripe_subscription_status,
        stripe_current_period_end, stripe_subscription_interval
      FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      logger.warn('resolveEntitlements: User not found', { userId });
      return getDefaultEntitlements();
    }

    // Get purchased reports - only records with explicit 'paid' status
    let purchasedReports = [];
    // One-time migration: backfill legacy NULL-status records to 'paid'
    if (!_nullStatusMigrated) {
      try {
        const { changes } = await db.run(
          "UPDATE report_purchases SET status = 'paid' WHERE status IS NULL"
        );
        if (changes > 0) {
          logger.info('Migrated NULL-status report_purchases to paid', { count: changes });
        }
        _nullStatusMigrated = true;
      } catch (_migrationErr) {
        // Ignore - column may not exist yet; mark as done to avoid retrying every call
        _nullStatusMigrated = true;
      }
    }
    try {
      const rows = await db.all(
        "SELECT report_id FROM report_purchases WHERE user_id = ? AND status = 'paid' ORDER BY purchased_at DESC",
        [userId]
      );
      purchasedReports = rows.map(r => r.report_id);
    } catch (e) {
      logger.warn('Could not fetch purchased reports', { userId, error: e.message });
    }

    // Fallback: Also check billing_sessions for paid single-report purchases
    // This handles webhook race conditions where payment is recorded in billing_sessions
    // but verifyAndRecordPurchase hasn't written to report_purchases yet
    if (user.stripe_customer_id) {
      try {
        const billingRows = await db.all(
          `SELECT DISTINCT report_id FROM billing_sessions
           WHERE stripe_customer_id = ? AND payment_status = 'paid'
           AND purchase_type = 'single_report' AND report_id IS NOT NULL`,
          [user.stripe_customer_id]
        );
        for (const row of billingRows) {
          if (row.report_id && !purchasedReports.includes(row.report_id)) {
            purchasedReports.push(row.report_id);
          }
        }
      } catch (e) {
        logger.warn('Could not fetch billing sessions for purchased reports', { userId, error: e.message });
      }
    }

    // Determine subscription status and effective plan
    const activeStatuses = ['active', 'trialing'];
    const isActiveSubscription = activeStatuses.includes(user.stripe_subscription_status);
    const isDayPass = user.stripe_subscription_interval === 'day';

    let effectivePlan = user.plan || 'free';
    let dayPassExpiresAt = null;
    let cancelAtPeriodEnd = false;

    // Day Pass special handling: Day Pass sets interval='day' and a future period_end
    // Even if status is not 'active' (e.g., due to webhook race conditions), honor Day Pass if period is valid
    if (isDayPass && user.stripe_current_period_end) {
      const periodEnd = new Date(user.stripe_current_period_end);
      if (periodEnd > new Date()) {
        logger.debug('Day Pass detected via interval and valid period', {
          userId,
          periodEnd: user.stripe_current_period_end,
          status: user.stripe_subscription_status
        });
        effectivePlan = 'day_pass';
        dayPassExpiresAt = user.stripe_current_period_end;
        // Not truly a subscription, so don't mark as cancelAtPeriodEnd
      } else {
        // Day pass period has expired — force free regardless of DB plan column
        effectivePlan = 'free';
      }
    }
    // Day pass with no period end — expired
    else if (isDayPass) {
      effectivePlan = 'free';
    }
    // Check for grace period (canceled but still within paid period)
    else if (user.stripe_subscription_status === 'canceled' && user.stripe_current_period_end) {
      const periodEnd = new Date(user.stripe_current_period_end);
      if (periodEnd > new Date()) {
        // Still within paid period
        effectivePlan = isDayPass ? 'day_pass' : 'pro';
        if (isDayPass) {
          dayPassExpiresAt = user.stripe_current_period_end;
        }
        cancelAtPeriodEnd = true;
      }
    } else if (isActiveSubscription) {
      effectivePlan = isDayPass ? 'day_pass' : 'pro';
      if (isDayPass) {
        dayPassExpiresAt = user.stripe_current_period_end;
      }
    }

    // For day pass, verify it hasn't expired
    if (effectivePlan === 'day_pass' && dayPassExpiresAt) {
      const expiresAt = new Date(dayPassExpiresAt);
      if (expiresAt < new Date()) {
        logger.info('Day pass expired', { userId, expiresAt });
        effectivePlan = 'free';
        dayPassExpiresAt = null;
      }
    }

    // Derive permissions from effective plan
    const hasGlobalAccess = effectivePlan === 'pro' || effectivePlan === 'day_pass';
    const permissions = {
      accessProTools: hasGlobalAccess,
      viewProSections: hasGlobalAccess,
      exportReports: hasGlobalAccess
    };

    const entitlements = {
      plan: effectivePlan,
      subscriptionStatus: user.stripe_subscription_status || 'none',
      subscriptionInterval: user.stripe_subscription_interval || null,
      currentPeriodEnd: toISO(user.stripe_current_period_end),
      dayPassExpiresAt: toISO(dayPassExpiresAt),
      cancelAtPeriodEnd,
      purchasedReports,
      permissions
    };

    logger.debug('resolveEntitlements: Resolved', {
      userId,
      plan: effectivePlan,
      hasGlobalAccess,
      purchasedReportsCount: purchasedReports.length
    });

    return entitlements;

  } catch (error) {
    logger.error('resolveEntitlements: Error', { userId, error: error.message });
    return getDefaultEntitlements();
  }
}

/**
 * Check if user has access to Pro sections for a specific report
 *
 * Access is granted if:
 * 1. User has global pro access (pro subscription or day pass), OR
 * 2. User has purchased this specific report
 *
 * @param {Entitlements} entitlements - Entitlements object from resolveEntitlements
 * @param {string} reportId - Report ID to check
 * @returns {boolean}
 */
function canViewProSections(entitlements, reportId) {
  // Global pro access
  if (entitlements.permissions.viewProSections) {
    return true;
  }

  // Specific report purchase
  if (reportId && entitlements.purchasedReports.includes(reportId)) {
    return true;
  }

  return false;
}

/**
 * Check if user can export a specific report
 *
 * Export is allowed if:
 * 1. User has global export access (pro subscription or day pass), OR
 * 2. User has purchased this specific report
 *
 * @param {Entitlements} entitlements - Entitlements object from resolveEntitlements
 * @param {string} reportId - Report ID to check
 * @returns {boolean}
 */
function canExportReport(entitlements, reportId) {
  // Global export access
  if (entitlements.permissions.exportReports) {
    return true;
  }

  // Specific report purchase
  if (reportId && entitlements.purchasedReports.includes(reportId)) {
    return true;
  }

  return false;
}

/**
 * Check if user owns or has access to a report
 *
 * Access is granted if:
 * 1. Report belongs to user (user_id matches)
 * 2. Report belongs to session (session_id matches)
 * 3. User has global pro access
 * 4. User has purchased this specific report
 *
 * @param {string} reportId - Report ID to check
 * @param {Object} userContext - User context
 * @param {string} userContext.userId - User ID
 * @param {string} userContext.sessionId - Session ID
 * @param {Entitlements} entitlements - Entitlements object
 * @returns {Object} Access result with details
 */
async function getReportAccess(reportId, userContext, entitlements) {
  // Validate reportId format
  if (!reportId || !isSafeReportId(reportId)) {
    logger.warn('getReportAccess: Invalid reportId format', { reportId });
    return {
      canView: false,
      canViewPro: false,
      canExport: false,
      reason: 'invalid_report_id',
      reportId
    };
  }

  const { userId, sessionId } = userContext;
  const canViewPro = canViewProSections(entitlements, reportId);
  const canExport = canExportReport(entitlements, reportId);

  // For now, anyone can view the free sections of a report
  // In the future, could add ownership checks here
  const canView = true;

  const accessResult = {
    canView,
    canViewPro,
    canExport,
    reason: canViewPro
      ? (entitlements.permissions.viewProSections ? 'global_access' : 'purchased_report')
      : 'no_access',
    reportId,
    entitlements: {
      plan: entitlements.plan,
      hasGlobalAccess: entitlements.permissions.viewProSections,
      isPurchased: entitlements.purchasedReports.includes(reportId)
    }
  };

  logger.debug('getReportAccess: Result', {
    reportId,
    userId,
    ...accessResult
  });

  return accessResult;
}

/**
 * Validate reportId format
 * Re-exported from reportId.js for convenience
 */
function validateReportId(reportId) {
  if (!reportId) {
    return { valid: false, error: 'Report ID is required' };
  }
  if (typeof reportId !== 'string') {
    return { valid: false, error: 'Report ID must be a string' };
  }
  if (!isSafeReportId(reportId)) {
    return { valid: false, error: 'Invalid report ID format. Expected: r_<16-hex-chars>' };
  }
  return { valid: true };
}

/**
 * Create a debug summary of entitlements for logging
 * @param {Entitlements} entitlements
 * @param {string} reportId - Optional report ID for context
 * @returns {Object} Debug summary
 */
function createDebugSummary(entitlements, reportId = null) {
  const summary = {
    plan: entitlements.plan,
    subscriptionStatus: entitlements.subscriptionStatus,
    hasGlobalAccess: entitlements.permissions.viewProSections,
    purchasedReportsCount: entitlements.purchasedReports.length
  };

  if (reportId) {
    summary.reportId = reportId;
    summary.canViewPro = canViewProSections(entitlements, reportId);
    summary.canExport = canExportReport(entitlements, reportId);
  }

  if (entitlements.dayPassExpiresAt) {
    summary.dayPassExpiresAt = entitlements.dayPassExpiresAt;
  }
  if (entitlements.currentPeriodEnd) {
    summary.currentPeriodEnd = entitlements.currentPeriodEnd;
  }

  return summary;
}

/**
 * Get full entitlements + usage summary for a user.
 * This is the ONE function every endpoint should call for complete state.
 *
 * @param {string} userId - User ID
 * @param {string|null} anonId - Anonymous ID (for guest tracking)
 * @returns {Promise<Object>} Unified entitlements + usage object
 */
async function getFullEntitlements(userId, anonId = null) {
  const entitlements = await resolveEntitlements({ userId });

  // Map plan to planCode for usage service
  let planCode = 'free';
  if (entitlements.plan === 'pro') {
    planCode = entitlements.subscriptionInterval === 'year' ? 'pro_annual' : 'pro_monthly';
  } else if (entitlements.plan === 'day_pass') {
    planCode = 'day_pass';
  }

  // Lazy-require to avoid circular dependency
  const usageService = require('../services/usageService');
  const usageSummary = await usageService.getUsageSummary(
    userId,
    userId ? null : anonId,
    planCode,
    {
      subscriptionEnd: entitlements.currentPeriodEnd,
      dayPassExpiry: entitlements.dayPassExpiresAt
    }
  );

  // Bug reward token balance (for showing "Use Reward Token" in paywall)
  let bugRewardTokenBalance = 0;
  if (userId) {
    try {
      const db = getDatabase();
      const tokenRow = await db.get(
        "SELECT COUNT(*) as count FROM bug_reward_tokens WHERE user_id = ? AND status = 'active' AND expires_at > datetime('now')",
        [userId]
      );
      bugRewardTokenBalance = tokenRow?.count || 0;
    } catch (_) { /* table may not exist yet */ }
  }

  return {
    ...entitlements,
    planCode,
    usage: usageSummary,
    bugRewardTokenBalance
  };
}

module.exports = {
  resolveEntitlements,
  getFullEntitlements,
  canViewProSections,
  canExportReport,
  getReportAccess,
  validateReportId,
  getDefaultEntitlements,
  createDebugSummary
};
