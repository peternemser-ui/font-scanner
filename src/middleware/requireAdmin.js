/**
 * Admin Authorization Middleware
 * Ensures the authenticated user has admin privileges
 */

const { getDatabase } = require('../db');

/**
 * Middleware to require admin privileges
 * Must be used AFTER requireAuth middleware
 */
async function requireAdmin(req, res, next) {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const db = getDatabase();

    // Check if user is admin
    const user = await db.get(
      'SELECT id, email, is_admin FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.is_admin || user.is_admin !== 1) {
      // Log unauthorized admin access attempt
      console.warn(`[SECURITY] Non-admin user ${user.email} attempted to access admin endpoint`);

      return res.status(403).json({
        error: 'Admin privileges required',
        code: 'ADMIN_REQUIRED'
      });
    }

    // User is admin - allow access
    req.admin = user;
    next();

  } catch (error) {
    console.error('Admin authorization error:', error);
    res.status(500).json({
      error: 'Authorization check failed',
      code: 'AUTH_CHECK_FAILED'
    });
  }
}

/**
 * Log admin action for auditing
 */
async function logAdminAction(adminUserId, action, targetUserId = null, details = {}) {
  try {
    const db = getDatabase();

    await db.run(
      'INSERT INTO admin_activity_log (admin_user_id, action, target_user_id, details_json) VALUES (?, ?, ?, ?)',
      [adminUserId, action, targetUserId, JSON.stringify(details)]
    );

    console.log(`[ADMIN] ${adminUserId}: ${action}`, details);
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}

module.exports = {
  requireAdmin,
  logAdminAction
};
