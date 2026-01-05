/**
 * Admin API Routes
 * Provides admin-only endpoints for user management, system monitoring, and testing
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const { requireAdmin, logAdminAction } = require('../middleware/requireAdmin');
const { getDatabase } = require('../db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// All admin routes require authentication AND admin privileges
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/dashboard-stats
 * Get overview statistics for admin dashboard
 */
router.get('/dashboard-stats', async (req, res) => {
  try {
    const db = getDatabase();

    // Get counts
    const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
    const proUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE plan = "pro"');
    const freeUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE plan = "free"');

    // Get scan stats
    const totalScans = await db.get('SELECT COUNT(*) as count FROM scans');
    const scansToday = await db.get(
      'SELECT COUNT(*) as count FROM scans WHERE created_at >= date("now")'
    );
    const scansThisWeek = await db.get(
      'SELECT COUNT(*) as count FROM scans WHERE created_at >= date("now", "-7 days")'
    );

    // Get revenue stats (if you have payment data)
    const activeSubscriptions = await db.get(
      'SELECT COUNT(*) as count FROM entitlements WHERE status = "active"'
    );

    // Recent activity
    const recentUsers = await db.all(
      'SELECT id, email, plan, created_at FROM users ORDER BY created_at DESC LIMIT 10'
    );

    const recentScans = await db.all(
      'SELECT s.id, s.target_url, s.status, s.created_at, u.email FROM scans s LEFT JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 10'
    );

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers.count,
          pro: proUsers.count,
          free: freeUsers.count
        },
        scans: {
          total: totalScans.count,
          today: scansToday.count,
          thisWeek: scansThisWeek.count
        },
        subscriptions: {
          active: activeSubscriptions.count,
          mrr: activeSubscriptions.count * 29 // $29/month per pro user
        }
      },
      recentActivity: {
        users: recentUsers,
        scans: recentScans
      }
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

/**
 * GET /api/admin/users
 * Get all users with pagination
 */
router.get('/users', async (req, res) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = 'SELECT id, email, plan, is_admin, created_at, last_login, stripe_customer_id FROM users';
    let countQuery = 'SELECT COUNT(*) as count FROM users';
    const params = [];

    if (search) {
      query += ' WHERE email LIKE ?';
      countQuery += ' WHERE email LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const users = await db.all(query, params);
    const totalCount = await db.get(countQuery, search ? [`%${search}%`] : []);

    // Get scan counts for each user
    for (let user of users) {
      const scanCount = await db.get(
        'SELECT COUNT(*) as count FROM scans WHERE user_id = ?',
        [user.id]
      );
      user.totalScans = scanCount.count;

      const scansToday = await db.get(
        'SELECT COUNT(*) as count FROM scans WHERE user_id = ? AND created_at >= date("now")',
        [user.id]
      );
      user.scansToday = scansToday.count;
    }

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/users/:userId
 * Get detailed information about a specific user
 */
router.get('/users/:userId', async (req, res) => {
  try {
    const db = getDatabase();
    const { userId } = req.params;

    const user = await db.get(
      'SELECT id, email, plan, is_admin, created_at, last_login, stripe_customer_id, metadata_json FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get entitlements
    const entitlements = await db.all(
      'SELECT * FROM entitlements WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    // Get scans
    const scans = await db.all(
      'SELECT id, target_url, status, progress, created_at, finished_at FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    // Get usage stats
    const totalScans = await db.get(
      'SELECT COUNT(*) as count FROM scans WHERE user_id = ?',
      [userId]
    );

    const scansToday = await db.get(
      'SELECT COUNT(*) as count FROM scans WHERE user_id = ? AND created_at >= date("now")',
      [userId]
    );

    res.json({
      success: true,
      user,
      entitlements,
      scans,
      stats: {
        totalScans: totalScans.count,
        scansToday: scansToday.count
      }
    });

  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

/**
 * PATCH /api/admin/users/:userId
 * Update user details (plan, admin status, etc.)
 */
router.patch('/users/:userId', async (req, res) => {
  try {
    const db = getDatabase();
    const { userId } = req.params;
    const { plan, is_admin, email } = req.body;

    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const params = [];

    if (plan !== undefined) {
      updates.push('plan = ?');
      params.push(plan);
    }

    if (is_admin !== undefined) {
      updates.push('is_admin = ?');
      params.push(is_admin ? 1 : 0);
    }

    if (email !== undefined) {
      // Check if email already exists
      const existing = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (existing) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.push('email = ?');
      params.push(email.toLowerCase());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(userId);
    await db.run(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );

    // Log admin action
    await logAdminAction(req.admin.id, 'UPDATE_USER', userId, { plan, is_admin, email });

    const updatedUser = await db.get('SELECT id, email, plan, is_admin FROM users WHERE id = ?', [userId]);

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user account
 */
router.delete('/users/:userId', async (req, res) => {
  try {
    const db = getDatabase();
    const { userId } = req.params;

    // Prevent deleting yourself
    if (userId === req.admin.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await db.get('SELECT email FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user (cascade will handle related records)
    await db.run('DELETE FROM users WHERE id = ?', [userId]);

    // Log admin action
    await logAdminAction(req.admin.id, 'DELETE_USER', userId, { email: user.email });

    res.json({
      success: true,
      message: `User ${user.email} deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * POST /api/admin/testing/create-user
 * Create a test user for testing purposes
 */
router.post('/testing/create-user', async (req, res) => {
  try {
    const db = getDatabase();
    const { email, password, plan } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    await db.run(
      'INSERT INTO users (id, email, password_hash, plan) VALUES (?, ?, ?, ?)',
      [userId, email.toLowerCase(), passwordHash, plan || 'free']
    );

    // Log admin action
    await logAdminAction(req.admin.id, 'CREATE_TEST_USER', userId, { email, plan });

    res.json({
      success: true,
      message: 'Test user created successfully',
      user: {
        id: userId,
        email: email.toLowerCase(),
        plan: plan || 'free',
        password: password // Return password for testing purposes
      }
    });

  } catch (error) {
    console.error('Error creating test user:', error);
    res.status(500).json({ error: 'Failed to create test user' });
  }
});

/**
 * POST /api/admin/testing/reset-usage/:userId
 * Reset daily usage counter for a user
 */
router.post('/testing/reset-usage/:userId', async (req, res) => {
  try {
    const db = getDatabase();
    const { userId } = req.params;

    const user = await db.get('SELECT email FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete scans from today
    await db.run(
      'DELETE FROM scans WHERE user_id = ? AND created_at >= date("now")',
      [userId]
    );

    // Log admin action
    await logAdminAction(req.admin.id, 'RESET_USAGE', userId, { email: user.email });

    res.json({
      success: true,
      message: `Daily usage reset for ${user.email}`
    });

  } catch (error) {
    console.error('Error resetting usage:', error);
    res.status(500).json({ error: 'Failed to reset usage' });
  }
});

/**
 * GET /api/admin/activity-log
 * Get admin activity log
 */
router.get('/activity-log', async (req, res) => {
  try {
    const db = getDatabase();
    const limit = parseInt(req.query.limit) || 100;

    const logs = await db.all(
      `SELECT
        al.*,
        u.email as admin_email,
        tu.email as target_email
      FROM admin_activity_log al
      LEFT JOIN users u ON al.admin_user_id = u.id
      LEFT JOIN users tu ON al.target_user_id = tu.id
      ORDER BY al.created_at DESC
      LIMIT ?`,
      [limit]
    );

    res.json({
      success: true,
      logs
    });

  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

module.exports = router;
