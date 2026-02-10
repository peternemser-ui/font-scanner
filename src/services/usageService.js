/**
 * Usage Service
 * Centralized service for tracking and enforcing scan and report quotas
 * Supports both authenticated users and anonymous users (via cookie-based anon_id)
 */

const { getDatabase } = require('../db');
const { PRICING, getPlanLimits } = require('../config/pricing');
const { createLogger } = require('../utils/logger');

const logger = createLogger('UsageService');

/**
 * Get the next scan reset time: rolling 24h window from now.
 * Counter resets 24 hours after the user's first scan in a window.
 * @returns {Date}
 */
function getNext24hWindow() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

/**
 * Check if a reset time has passed
 * @param {string} resetAt - ISO date string
 * @returns {boolean}
 */
function hasResetTimePassed(resetAt) {
  if (!resetAt) return true;
  return new Date() >= new Date(resetAt);
}

/**
 * Get or create a usage tracking record
 * @param {string|null} userId - User ID for authenticated users
 * @param {string|null} anonId - Anonymous ID for guests
 * @returns {Promise<Object>} Usage record
 */
async function getOrCreateUsage(userId, anonId) {
  const db = getDatabase();

  if (!userId && !anonId) {
    throw new Error('Either userId or anonId must be provided');
  }

  // Try to get existing record
  let record;
  if (userId) {
    record = await db.get(
      'SELECT * FROM usage_tracking WHERE user_id = ?',
      [userId]
    );
  } else {
    record = await db.get(
      'SELECT * FROM usage_tracking WHERE anon_id = ?',
      [anonId]
    );
  }

  // If record exists, check if scans need reset
  if (record) {
    if (hasResetTimePassed(record.scans_reset_at)) {
      // Reset daily scan count
      const nextReset = getNext24hWindow().toISOString();
      await db.run(
        `UPDATE usage_tracking
         SET scans_used_today = 0, scans_reset_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nextReset, record.id]
      );
      record.scans_used_today = 0;
      record.scans_reset_at = nextReset;
    }
    return record;
  }

  // Create new record
  const nextReset = getNext24hWindow().toISOString();

  if (userId) {
    await db.run(
      `INSERT INTO usage_tracking (user_id, scans_used_today, scans_reset_at)
       VALUES (?, 0, ?)`,
      [userId, nextReset]
    );
    return db.get('SELECT * FROM usage_tracking WHERE user_id = ?', [userId]);
  } else {
    await db.run(
      `INSERT INTO usage_tracking (anon_id, scans_used_today, scans_reset_at)
       VALUES (?, 0, ?)`,
      [anonId, nextReset]
    );
    return db.get('SELECT * FROM usage_tracking WHERE anon_id = ?', [anonId]);
  }
}

/**
 * Check if user can perform a scan
 * @param {string|null} userId - User ID
 * @param {string|null} anonId - Anonymous ID
 * @param {string} planCode - Plan code (free, day_pass, pro_monthly, pro_annual)
 * @returns {Promise<Object>} { allowed, remaining, resetAt, limit, reason }
 */
async function checkScanQuota(userId, anonId, planCode = 'free') {
  const limits = getPlanLimits(planCode);
  const scanLimit = limits.scansPerDay;

  // Unlimited scans for paid plans
  if (scanLimit === -1) {
    return {
      allowed: true,
      remaining: -1, // Unlimited
      resetAt: null,
      limit: -1,
      reason: 'unlimited'
    };
  }

  const usage = await getOrCreateUsage(userId, anonId);
  const remaining = Math.max(0, scanLimit - usage.scans_used_today);

  return {
    allowed: remaining > 0,
    remaining,
    resetAt: usage.scans_reset_at,
    limit: scanLimit,
    reason: remaining > 0 ? 'quota_available' : 'quota_exceeded'
  };
}

/**
 * Increment scan usage count
 * Should be called AFTER validation but BEFORE expensive operations
 * @param {string|null} userId - User ID
 * @param {string|null} anonId - Anonymous ID
 * @returns {Promise<Object>} Updated usage info
 */
async function incrementScanUsage(userId, anonId) {
  const db = getDatabase();
  const usage = await getOrCreateUsage(userId, anonId);

  await db.run(
    `UPDATE usage_tracking
     SET scans_used_today = scans_used_today + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [usage.id]
  );

  logger.info('Scan usage incremented', {
    userId: userId ? userId.substring(0, 8) + '...' : null,
    anonId: anonId ? anonId.substring(0, 8) + '...' : null,
    newCount: usage.scans_used_today + 1
  });

  return {
    scansUsedToday: usage.scans_used_today + 1,
    scansResetAt: usage.scans_reset_at
  };
}

/**
 * Check if user can unlock a paid report
 * @param {string} userId - User ID (required for report unlocks)
 * @param {string} planCode - Plan code
 * @param {string|null} subscriptionEnd - Subscription period end date
 * @param {string|null} dayPassExpiry - Day pass expiry date
 * @returns {Promise<Object>} { allowed, remaining, windowEndsAt, limit, reason }
 */
async function checkReportQuota(userId, planCode, subscriptionEnd = null, dayPassExpiry = null) {
  if (!userId) {
    return {
      allowed: false,
      remaining: 0,
      windowEndsAt: null,
      limit: 0,
      reason: 'authentication_required'
    };
  }

  const limits = getPlanLimits(planCode);
  const reportLimit = limits.paidReportsPerWindow;

  // Free users cannot unlock reports
  if (reportLimit === 0) {
    return {
      allowed: false,
      remaining: 0,
      windowEndsAt: null,
      limit: 0,
      reason: 'upgrade_required'
    };
  }

  // Unlimited reports for Pro Annual
  if (reportLimit === -1) {
    return {
      allowed: true,
      remaining: -1,
      windowEndsAt: subscriptionEnd,
      limit: -1,
      reason: 'unlimited'
    };
  }

  const db = getDatabase();
  const usage = await getOrCreateUsage(userId, null);

  // Determine window end based on plan type
  let windowEndsAt = usage.report_window_ends_at;

  if (planCode === 'day_pass' && dayPassExpiry) {
    windowEndsAt = dayPassExpiry;
  } else if ((planCode === 'pro_monthly' || planCode === 'pro_annual') && subscriptionEnd) {
    windowEndsAt = subscriptionEnd;
  }

  // Check if window has passed and reset if needed
  if (windowEndsAt && hasResetTimePassed(windowEndsAt)) {
    // Reset report count for new billing period
    await db.run(
      `UPDATE usage_tracking
       SET reports_used_in_window = 0, report_window_ends_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [subscriptionEnd || dayPassExpiry, usage.id]
    );
    usage.reports_used_in_window = 0;
    usage.report_window_ends_at = subscriptionEnd || dayPassExpiry;
    windowEndsAt = usage.report_window_ends_at;
  }

  // Update window end if not set
  if (!usage.report_window_ends_at && (subscriptionEnd || dayPassExpiry)) {
    await db.run(
      `UPDATE usage_tracking
       SET report_window_ends_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [subscriptionEnd || dayPassExpiry, usage.id]
    );
    windowEndsAt = subscriptionEnd || dayPassExpiry;
  }

  const remaining = Math.max(0, reportLimit - (usage.reports_used_in_window || 0));

  return {
    allowed: remaining > 0,
    remaining,
    windowEndsAt,
    limit: reportLimit,
    reason: remaining > 0 ? 'quota_available' : 'quota_exceeded'
  };
}

/**
 * Increment report usage atomically with unlock
 * @param {string} userId - User ID
 * @param {string} reportId - Report ID being unlocked
 * @returns {Promise<Object>} Updated usage info
 */
async function incrementReportUsage(userId, reportId) {
  const db = getDatabase();
  const usage = await getOrCreateUsage(userId, null);

  await db.run(
    `UPDATE usage_tracking
     SET reports_used_in_window = reports_used_in_window + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [usage.id]
  );

  logger.info('Report usage incremented', {
    userId: userId.substring(0, 8) + '...',
    reportId: reportId.substring(0, 8) + '...',
    newCount: (usage.reports_used_in_window || 0) + 1
  });

  return {
    reportsUsed: (usage.reports_used_in_window || 0) + 1,
    reportWindowEndsAt: usage.report_window_ends_at
  };
}

/**
 * Add a single report credit (for single report purchase)
 * This effectively increases the limit by 1 for one-time purchases
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function addSingleReportCredit(userId) {
  // For single report purchases, we track via report_purchases table
  // This function is a no-op as individual reports are tracked separately
  logger.info('Single report credit added', {
    userId: userId.substring(0, 8) + '...'
  });
}

/**
 * Get full usage summary for entitlements API
 * @param {string|null} userId - User ID
 * @param {string|null} anonId - Anonymous ID
 * @param {string} planCode - Plan code
 * @param {Object} options - Additional options (subscriptionEnd, dayPassExpiry)
 * @returns {Promise<Object>} Full usage summary
 */
async function getUsageSummary(userId, anonId, planCode = 'free', options = {}) {
  const { subscriptionEnd, dayPassExpiry } = options;
  const limits = getPlanLimits(planCode);

  // Get or create usage record
  const usage = await getOrCreateUsage(userId, anonId);

  // Calculate scan quota
  const scanLimit = limits.scansPerDay;
  const scansUsedToday = usage.scans_used_today || 0;
  const scansRemainingToday = scanLimit === -1 ? -1 : Math.max(0, scanLimit - scansUsedToday);

  // Calculate report quota
  const reportLimit = limits.paidReportsPerWindow;
  let reportsUsed = usage.reports_used_in_window || 0;
  let reportsRemaining = reportLimit === -1 ? -1 : (reportLimit === 0 ? 0 : Math.max(0, reportLimit - reportsUsed));
  let reportWindowEndsAt = usage.report_window_ends_at;

  // Use subscription/pass end dates if available
  if (planCode === 'day_pass' && dayPassExpiry) {
    reportWindowEndsAt = dayPassExpiry;
  } else if ((planCode === 'pro_monthly' || planCode === 'pro_annual') && subscriptionEnd) {
    reportWindowEndsAt = subscriptionEnd;
  }

  // Check for window reset
  if (reportWindowEndsAt && hasResetTimePassed(reportWindowEndsAt)) {
    reportsUsed = 0;
    reportsRemaining = reportLimit === -1 ? -1 : reportLimit;
  }

  return {
    // Scan usage
    scansUsedToday,
    scansRemainingToday,
    scansResetAt: usage.scans_reset_at,
    scanLimitDaily: scanLimit,

    // Report usage
    reportsUsed,
    reportsRemaining,
    reportWindowEndsAt,
    reportLimit,

    // Raw record for debugging
    _raw: {
      recordId: usage.id,
      createdAt: usage.created_at,
      updatedAt: usage.updated_at
    }
  };
}

/**
 * Transfer anonymous usage to authenticated user
 * Called when a user logs in
 * @param {string} userId - User ID
 * @param {string} anonId - Anonymous ID from cookie
 * @returns {Promise<void>}
 */
async function transferAnonymousUsage(userId, anonId) {
  if (!userId || !anonId) return;

  const db = getDatabase();

  try {
    // Get anonymous usage
    const anonUsage = await db.get(
      'SELECT * FROM usage_tracking WHERE anon_id = ?',
      [anonId]
    );

    if (!anonUsage) return;

    // Check if user already has usage record
    const userUsage = await db.get(
      'SELECT * FROM usage_tracking WHERE user_id = ?',
      [userId]
    );

    if (userUsage) {
      // Merge: take higher of the two scan counts
      const newScanCount = Math.max(userUsage.scans_used_today, anonUsage.scans_used_today);
      await db.run(
        `UPDATE usage_tracking
         SET scans_used_today = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newScanCount, userUsage.id]
      );
    } else {
      // Transfer: convert anon record to user record
      await db.run(
        `UPDATE usage_tracking
         SET user_id = ?, anon_id = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, anonUsage.id]
      );
    }

    // Delete anonymous record if still exists
    await db.run('DELETE FROM usage_tracking WHERE anon_id = ?', [anonId]);

    logger.info('Anonymous usage transferred', {
      userId: userId.substring(0, 8) + '...',
      anonId: anonId.substring(0, 8) + '...'
    });
  } catch (error) {
    logger.error('Failed to transfer anonymous usage', {
      userId,
      anonId,
      error: error.message
    });
  }
}

module.exports = {
  getOrCreateUsage,
  checkScanQuota,
  incrementScanUsage,
  checkReportQuota,
  incrementReportUsage,
  addSingleReportCredit,
  getUsageSummary,
  transferAnonymousUsage,
  // Utilities exported for testing
  getNext24hWindow,
  hasResetTimePassed
};
