const jwt = require('jsonwebtoken');
const { getDatabase } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-use-long-random-string';

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

    // Verify user still exists
    const db = getDatabase();
    const user = await db.get(
      'SELECT id, email, plan, created_at, email_verified, is_admin FROM users WHERE id = ?',
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
 */
function requirePro(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.plan !== 'pro') {
    return res.status(403).json({
      error: 'Pro plan required',
      upgradeUrl: '/upgrade.html'
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
        'SELECT id, email, plan, created_at, email_verified, is_admin FROM users WHERE id = ?',
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

module.exports = { requireAuth, requirePro, optionalAuth };
