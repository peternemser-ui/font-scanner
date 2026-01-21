const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db');
const stripeService = require('../services/stripeService');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-use-long-random-string';

// Extended user fields including subscription data
const USER_SELECT_FIELDS = `
  id, email, plan, created_at, email_verified, is_admin,
  stripe_customer_id, stripe_subscription_id, stripe_subscription_status,
  stripe_current_period_end, stripe_subscription_interval
`;

/**
 * Require authentication (blocking)
 * Returns 401 if not authenticated
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists - load full subscription data
    const db = getDatabase();
    const user = await db.get(
      `SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = ?`,
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Require Pro plan
 * Must be used after requireAuth middleware
 * Uses stripeService.isPro() for proper subscription status checking
 */
function requirePro(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!stripeService.isPro(req.user)) {
    return res.status(403).json({
      error: 'Pro plan required',
      upgradeUrl: '/upgrade.html'
    });
  }

  next();
}

/**
 * Require paid access to a specific report
 * Pro users have access to all reports, others need individual purchases
 * reportId can be passed in query, body, or params as 'reportId' or 'report_id'
 */
async function requirePaidAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Extract reportId from various locations
  const reportId = req.query.reportId || req.query.report_id ||
                   req.body?.reportId || req.body?.report_id ||
                   req.params?.reportId || req.params?.report_id;

  const canAccess = await stripeService.canAccessPaid(req.user, reportId);

  if (!canAccess) {
    return res.status(403).json({
      error: 'Paid access required',
      message: reportId
        ? 'You need a Pro subscription or to purchase this report to access this feature.'
        : 'You need a Pro subscription to access this feature.',
      upgradeUrl: '/upgrade.html',
      reportId: reportId || null
    });
  }

  next();
}

/**
 * Optional authentication (non-blocking)
 * Attaches user to req if valid token provided, but doesn't block
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const db = getDatabase();
      const user = await db.get(
        `SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = ?`,
        [decoded.userId]
      );

      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    // Ignore errors - optional auth
  }
  next();
}

module.exports = { requireAuth, requirePro, requirePaidAccess, optionalAuth };
