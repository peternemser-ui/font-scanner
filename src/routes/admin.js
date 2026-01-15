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
 * GET /api/admin/billing-sessions
 * Debug endpoint to inspect recent billing (no-account) checkout sessions.
 * Query: ?limit=50
 */
router.get('/billing-sessions', async (req, res) => {
  try {
    const db = getDatabase();

    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

    const sessions = await db.all(
      `SELECT
         session_id,
         purchase_type,
         report_id,
         pack_id,
         credits_added,
         payment_status,
         mode,
         amount_total,
         currency,
         completed_at,
         updated_at
       FROM billing_sessions
       ORDER BY datetime(updated_at) DESC
       LIMIT ?`,
      [limit]
    );

    await logAdminAction(req.admin.id, 'VIEW_BILLING_SESSIONS', null, { limit });

    res.json({
      success: true,
      limit,
      sessions
    });
  } catch (error) {
    console.error('Error fetching billing sessions:', error);
    res.status(500).json({ error: 'Failed to fetch billing sessions' });
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

// =============================================================================
// TEST RUNNER ENDPOINTS
// =============================================================================

const { spawn } = require('child_process');
const path = require('path');

/**
 * GET /api/admin/tests/suites
 * List available test suites
 */
router.get('/tests/suites', async (req, res) => {
  const fs = require('fs').promises;
  const testsDir = path.join(process.cwd(), 'tests');
  
  try {
    const suites = [];
    
    // Scan test directories
    const categories = ['utils', 'services', 'middleware', 'integration'];
    
    for (const category of categories) {
      const categoryPath = path.join(testsDir, category);
      try {
        const files = await fs.readdir(categoryPath);
        const testFiles = files.filter(f => f.endsWith('.test.js'));
        
        for (const file of testFiles) {
          suites.push({
            id: `${category}/${file}`,
            name: file.replace('.test.js', ''),
            category,
            path: `tests/${category}/${file}`
          });
        }
      } catch (e) {
        // Category doesn't exist, skip
      }
    }
    
    res.json({
      success: true,
      suites,
      categories: [...new Set(suites.map(s => s.category))]
    });
    
  } catch (error) {
    console.error('Error listing test suites:', error);
    res.status(500).json({ error: 'Failed to list test suites' });
  }
});

/**
 * POST /api/admin/tests/run
 * Run tests and return results
 * Body: { suite?: string, category?: string } - if empty, runs all tests
 */
router.post('/tests/run', async (req, res) => {
  const { suite, category } = req.body;
  
  // Build jest command arguments
  const args = ['--json', '--testLocationInResults'];
  
  if (suite) {
    // Run specific test file
    args.push(suite);
  } else if (category) {
    // Run all tests in a category
    args.push(`tests/${category}/`);
  }
  // If neither, runs all tests
  
  try {
    const result = await runJestTests(args);
    
    // Log admin action
    await logAdminAction(req.admin.id, 'RUN_TESTS', null, { 
      suite: suite || 'all',
      category: category || 'all',
      passed: result.numPassedTests,
      failed: result.numFailedTests
    });
    
    res.json({
      success: true,
      results: {
        numTotalTests: result.numTotalTests,
        numPassedTests: result.numPassedTests,
        numFailedTests: result.numFailedTests,
        numPendingTests: result.numPendingTests,
        numTotalSuites: result.numTotalTestSuites,
        numPassedSuites: result.numPassedTestSuites,
        numFailedSuites: result.numFailedTestSuites,
        startTime: result.startTime,
        endTime: new Date().getTime(),
        testResults: result.testResults.map(tr => ({
          name: tr.name.replace(process.cwd(), '').replace(/\\/g, '/'),
          status: tr.status,
          duration: tr.endTime - tr.startTime,
          numPassingAsserts: tr.numPassingAsserts,
          numFailingAsserts: tr.numFailingAsserts,
          assertionResults: tr.assertionResults.map(ar => ({
            title: ar.title,
            fullName: ar.fullName,
            status: ar.status,
            duration: ar.duration,
            failureMessages: ar.failureMessages
          }))
        }))
      }
    });
    
  } catch (error) {
    console.error('Error running tests:', error);
    res.status(500).json({ 
      error: 'Failed to run tests',
      message: error.message,
      output: error.output || null
    });
  }
});

/**
 * Run Jest tests and return parsed JSON results
 */
function runJestTests(args) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'npx.cmd' : 'npx';
    
    const jestProcess = spawn(npmCmd, ['jest', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    jestProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    jestProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    jestProcess.on('close', (code) => {
      try {
        // Jest outputs JSON to stdout when using --json flag
        // Even if tests fail, it still outputs valid JSON
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const results = JSON.parse(jsonMatch[0]);
          resolve(results);
        } else {
          reject({ 
            message: 'No JSON output from Jest', 
            output: stdout + stderr,
            code 
          });
        }
      } catch (parseError) {
        reject({ 
          message: 'Failed to parse Jest output', 
          output: stdout + stderr,
          code 
        });
      }
    });
    
    jestProcess.on('error', (error) => {
      reject({ message: error.message, output: stderr });
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      jestProcess.kill();
      reject({ message: 'Test execution timed out after 5 minutes' });
    }, 5 * 60 * 1000);
  });
}

/**
 * GET /api/admin/tests/quick-check
 * Run a quick health check (subset of critical tests)
 */
router.get('/tests/quick-check', async (req, res) => {
  try {
    // Run only validator and sanitizer tests (fast)
    const result = await runJestTests([
      '--json',
      '--testLocationInResults', 
      'tests/utils/validators.test.js',
      'tests/utils/sanitizer.test.js'
    ]);
    
    res.json({
      success: true,
      healthy: result.numFailedTests === 0,
      passed: result.numPassedTests,
      failed: result.numFailedTests,
      duration: result.testResults.reduce((sum, tr) => sum + (tr.endTime - tr.startTime), 0)
    });
    
  } catch (error) {
    res.json({
      success: false,
      healthy: false,
      error: error.message
    });
  }
});

module.exports = router;
