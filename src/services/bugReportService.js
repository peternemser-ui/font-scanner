/**
 * Bug Report & Reward Token Service
 *
 * Business logic for bug report submission, admin review,
 * token granting, and token redemption.
 */

const { getDatabase } = require('../db');
const { createLogger } = require('../utils/logger');
const { isSafeReportId } = require('../utils/reportId');

const logger = createLogger('BugReportService');

const VALID_CATEGORIES = ['wrong_data', 'missing_section', 'display_issue', 'crash_error', 'other'];
const MAX_REPORTS_PER_DAY = 3;
const MAX_PENDING_PER_USER = 5;
const MIN_DESCRIPTION_LENGTH = 30;
const DUPLICATE_WINDOW_HOURS = 24;
const TOKEN_EXPIRY_DAYS = 90;

/**
 * Submit a bug report (user-facing)
 */
async function submitBugReport(userId, data) {
  const db = getDatabase();
  const { reportId, analyzerType, scannedUrl, category, description, browserInfo, contextJson } = data;

  // Validate category
  if (!category || !VALID_CATEGORIES.includes(category)) {
    const err = new Error(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  // Validate description length
  if (!description || description.trim().length < MIN_DESCRIPTION_LENGTH) {
    const err = new Error(`Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`);
    err.status = 400;
    throw err;
  }

  // Rate limit: max reports per day
  const todayCount = await db.get(
    `SELECT COUNT(*) as count FROM bug_reports WHERE user_id = ? AND created_at >= date('now')`,
    [userId]
  );
  if (todayCount && todayCount.count >= MAX_REPORTS_PER_DAY) {
    const err = new Error(`Daily limit reached (${MAX_REPORTS_PER_DAY} reports per day)`);
    err.status = 429;
    throw err;
  }

  // Rate limit: max pending reports
  const pendingCount = await db.get(
    `SELECT COUNT(*) as count FROM bug_reports WHERE user_id = ? AND status = 'pending'`,
    [userId]
  );
  if (pendingCount && pendingCount.count >= MAX_PENDING_PER_USER) {
    const err = new Error(`Too many pending reports (max ${MAX_PENDING_PER_USER}). Wait for reviews before submitting more.`);
    err.status = 429;
    throw err;
  }

  // Duplicate detection: same user + URL + analyzer within window
  if (scannedUrl && analyzerType) {
    const duplicate = await db.get(
      `SELECT id FROM bug_reports
       WHERE user_id = ? AND scanned_url = ? AND analyzer_type = ?
       AND created_at >= datetime('now', '-${DUPLICATE_WINDOW_HOURS} hours')`,
      [userId, scannedUrl, analyzerType]
    );
    if (duplicate) {
      const err = new Error('A similar report for this URL and analyzer was recently submitted');
      err.status = 409;
      throw err;
    }
  }

  const result = await db.run(
    `INSERT INTO bug_reports (user_id, report_id, analyzer_type, scanned_url, category, description, browser_info, context_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, reportId || null, analyzerType || null, scannedUrl || null, category, description.trim(), browserInfo || null, contextJson || null]
  );

  logger.info('Bug report submitted', { userId, bugId: result.lastID, category, analyzerType });

  return {
    id: result.lastID,
    status: 'pending',
    category,
    createdAt: new Date().toISOString()
  };
}

/**
 * Get user's own bug reports with linked token info
 */
async function getUserBugReports(userId) {
  const db = getDatabase();

  const reports = await db.all(
    `SELECT br.*,
            brt.id as token_id, brt.status as token_status, brt.expires_at as token_expires_at,
            brt.redeemed_report_id as token_redeemed_report_id, brt.redeemed_at as token_redeemed_at
     FROM bug_reports br
     LEFT JOIN bug_reward_tokens brt ON brt.bug_report_id = br.id
     WHERE br.user_id = ?
     ORDER BY br.created_at DESC
     LIMIT 50`,
    [userId]
  );

  return reports.map(r => ({
    id: r.id,
    reportId: r.report_id,
    analyzerType: r.analyzer_type,
    scannedUrl: r.scanned_url,
    category: r.category,
    description: r.description,
    status: r.status,
    adminNotes: r.admin_notes,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    token: r.token_id ? {
      id: r.token_id,
      status: r.token_status,
      expiresAt: r.token_expires_at,
      redeemedReportId: r.token_redeemed_report_id,
      redeemedAt: r.token_redeemed_at
    } : null
  }));
}

/**
 * Get count of active non-expired tokens for a user
 */
async function getUserTokenBalance(userId) {
  const db = getDatabase();
  try {
    const row = await db.get(
      `SELECT COUNT(*) as count FROM bug_reward_tokens
       WHERE user_id = ? AND status = 'active' AND expires_at > datetime('now')`,
      [userId]
    );
    return row?.count || 0;
  } catch (_) {
    return 0; // table may not exist yet
  }
}

/**
 * Admin: get all bug reports with pagination and filters
 */
async function getAllBugReports({ status, page = 1, limit = 20 } = {}) {
  const db = getDatabase();
  const offset = (page - 1) * limit;
  const params = [];

  let where = '';
  if (status && status !== 'all') {
    where = 'WHERE br.status = ?';
    params.push(status);
  }

  const countRow = await db.get(
    `SELECT COUNT(*) as total FROM bug_reports br ${where}`,
    params
  );

  const reports = await db.all(
    `SELECT br.*, u.email as user_email,
            brt.id as token_id, brt.status as token_status
     FROM bug_reports br
     LEFT JOIN users u ON u.id = br.user_id
     LEFT JOIN bug_reward_tokens brt ON brt.bug_report_id = br.id
     ${where}
     ORDER BY
       CASE br.status WHEN 'pending' THEN 0 ELSE 1 END,
       br.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    bugReports: reports.map(r => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email,
      reportId: r.report_id,
      analyzerType: r.analyzer_type,
      scannedUrl: r.scanned_url,
      category: r.category,
      description: r.description,
      status: r.status,
      adminNotes: r.admin_notes,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at,
      createdAt: r.created_at,
      tokenGranted: !!r.token_id,
      tokenStatus: r.token_status
    })),
    total: countRow?.total || 0,
    page,
    limit
  };
}

/**
 * Admin: review a bug report (approve/reject/duplicate)
 * Approving auto-grants a reward token
 */
async function reviewBugReport(bugId, adminUserId, decision, adminNotes) {
  const db = getDatabase();

  if (!['approved', 'rejected', 'duplicate'].includes(decision)) {
    const err = new Error('Decision must be approved, rejected, or duplicate');
    err.status = 400;
    throw err;
  }

  const report = await db.get('SELECT * FROM bug_reports WHERE id = ?', [bugId]);
  if (!report) {
    const err = new Error('Bug report not found');
    err.status = 404;
    throw err;
  }

  if (report.status !== 'pending') {
    const err = new Error(`Report already reviewed (status: ${report.status})`);
    err.status = 409;
    throw err;
  }

  let tokenGranted = false;

  await db.transaction(async () => {
    // Update bug report status
    await db.run(
      `UPDATE bug_reports SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [decision, adminNotes || null, adminUserId, bugId]
    );

    // Grant token on approval
    if (decision === 'approved') {
      await db.run(
        `INSERT INTO bug_reward_tokens (user_id, bug_report_id, expires_at)
         VALUES (?, ?, datetime('now', '+${TOKEN_EXPIRY_DAYS} days'))`,
        [report.user_id, bugId]
      );
      tokenGranted = true;
      logger.info('Reward token granted', { bugId, userId: report.user_id, adminUserId });
    }
  });

  logger.info('Bug report reviewed', { bugId, decision, adminUserId });

  return {
    id: bugId,
    status: decision,
    adminNotes,
    tokenGranted,
    userId: report.user_id
  };
}

/**
 * Redeem a reward token for a specific report
 */
async function redeemToken(userId, reportId) {
  const db = getDatabase();

  if (!reportId || !isSafeReportId(reportId)) {
    const err = new Error('Invalid report ID');
    err.status = 400;
    throw err;
  }

  // Check if report already purchased
  const existing = await db.get(
    `SELECT id FROM report_purchases WHERE user_id = ? AND report_id = ? AND status = 'paid'`,
    [userId, reportId]
  );
  if (existing) {
    const err = new Error('This report is already unlocked');
    err.status = 409;
    throw err;
  }

  let redeemedToken = null;

  await db.transaction(async () => {
    // Find oldest active non-expired token
    const token = await db.get(
      `SELECT * FROM bug_reward_tokens
       WHERE user_id = ? AND status = 'active' AND expires_at > datetime('now')
       ORDER BY created_at ASC LIMIT 1`,
      [userId]
    );

    if (!token) {
      const err = new Error('No active reward tokens available');
      err.status = 400;
      throw err;
    }

    // Mark token as redeemed
    await db.run(
      `UPDATE bug_reward_tokens SET status = 'redeemed', redeemed_report_id = ?, redeemed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reportId, token.id]
    );

    // Insert into report_purchases (same as a Stripe purchase, but source='bug_reward')
    await db.run(
      `INSERT INTO report_purchases (user_id, report_id, source, status, purchased_at)
       VALUES (?, ?, 'bug_reward', 'paid', CURRENT_TIMESTAMP)`,
      [userId, reportId]
    );

    redeemedToken = token;
  });

  const remainingBalance = await getUserTokenBalance(userId);

  logger.info('Token redeemed', { userId, reportId, tokenId: redeemedToken.id, remainingBalance });

  return {
    success: true,
    reportId,
    tokenId: redeemedToken.id,
    remainingBalance
  };
}

/**
 * Expire old tokens (called from cleanup scheduler)
 */
async function expireOldTokens() {
  const db = getDatabase();
  try {
    const result = await db.run(
      `UPDATE bug_reward_tokens SET status = 'expired'
       WHERE status = 'active' AND expires_at <= datetime('now')`
    );
    if (result.changes > 0) {
      logger.info('Expired old reward tokens', { count: result.changes });
    }
  } catch (e) {
    logger.warn('Failed to expire tokens (table may not exist yet)', { error: e.message });
  }
}

module.exports = {
  submitBugReport,
  getUserBugReports,
  getUserTokenBalance,
  getAllBugReports,
  reviewBugReport,
  redeemToken,
  expireOldTokens,
  // Constants for testing
  VALID_CATEGORIES,
  MAX_REPORTS_PER_DAY,
  MAX_PENDING_PER_USER,
  MIN_DESCRIPTION_LENGTH
};
