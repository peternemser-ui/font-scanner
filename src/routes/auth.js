const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { requireAuth } = require('../middleware/requireAuth');

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await authService.register(email, password);

    res.json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await authService.login(email, password);

    res.json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side only for JWT - just tells client to clear token)
 */
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/profile
 * Get current user profile (protected route)
 */
router.get('/profile', requireAuth, async (req, res) => {
  res.json({ success: true, user: req.user });
});

/**
 * GET /api/auth/me
 * Alias for profile
 */
router.get('/me', requireAuth, async (req, res) => {
  res.json({ success: true, user: req.user });
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await authService.generateResetToken(email);

    // In production, you would send an email here instead of returning the token
    // For now, we return it for testing purposes
    res.json({
      success: true,
      message: 'If this email exists, a password reset link has been generated',
      // REMOVE in production - only for development/testing
      resetToken: result.resetToken,
      userId: result.userId,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { userId, token, newPassword } = req.body;

    if (!userId || !token || !newPassword) {
      return res.status(400).json({ error: 'User ID, token, and new password are required' });
    }

    await authService.resetPassword(userId, token, newPassword);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in.'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    await authService.changePassword(req.user.id, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/auth/verify-reset-token
 * Verify reset token is valid before showing password form
 */
router.post('/verify-reset-token', async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: 'User ID and token are required' });
    }

    await authService.verifyResetToken(userId, token);

    res.json({ success: true, valid: true });
  } catch (error) {
    res.status(400).json({ error: error.message, valid: false });
  }
});

module.exports = router;
