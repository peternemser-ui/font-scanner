const crypto = require('crypto');
const dns = require('dns');
const { promisify } = require('util');
const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const stripeService = require('../services/stripeService');
const { requireAuth, optionalAuth } = require('../middleware/requireAuth');
const { resolveEntitlements, getReportAccess, validateReportId, createDebugSummary } = require('../utils/entitlements');
const usageService = require('../services/usageService');
const { resolveEffectivePlan } = require('../middleware/scanQuota');
const { PRICING, getPlanLimits } = require('../config/pricing');
const { createLogger } = require('../utils/logger');

const logger = createLogger('AuthRoutes');

const resolveMx = promisify(dns.resolveMx);

// Domains that technically exist but should never be used for real registration
const BLOCKED_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net',
  'test.com', 'test.org', 'test.net',
  'localhost', 'invalid', 'mailinator.com',
  'tempmail.com', 'throwaway.email', 'guerrillamail.com',
  'sharklasers.com', 'grr.la', 'guerrillamailblock.com',
  'yopmail.com', 'trashmail.com', 'fakeinbox.com',
  'dispostable.com', 'mailnesia.com', 'maildrop.cc',
  'temp-mail.org', 'getnada.com', '10minutemail.com',
]);

/**
 * Validate email domain: check blocklist + MX records
 * Returns null if valid, or an error string if invalid.
 */
async function validateEmailDomain(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return 'Invalid email format';

  if (BLOCKED_DOMAINS.has(domain)) {
    return 'Please use a real email address';
  }

  try {
    const records = await resolveMx(domain);
    if (!records || records.length === 0) {
      return 'This email domain cannot receive mail';
    }
  } catch (err) {
    // ENOTFOUND = domain doesn't exist, ENODATA = no MX records
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return 'This email domain cannot receive mail';
    }
    // DNS timeout or other transient error — allow registration
    logger.warn('MX lookup failed, allowing registration', { domain, error: err.code });
  }

  return null;
}

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, locale } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Validate email domain (blocklist + MX check)
    const domainError = await validateEmailDomain(email.trim().toLowerCase());
    if (domainError) {
      return res.status(400).json({ error: domainError });
    }

    const result = await authService.register(email, password);

    // Send welcome email (fire-and-forget, don't block registration)
    const emailService = require('../services/emailService');
    emailService.sendWelcomeEmail(email, locale).catch(err => {
      logger.warn('Failed to send welcome email', { error: err.message });
    });

    res.json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    // Only expose known validation messages, not internal errors
    const safeMessages = [
      'Email already registered',
      'Invalid email format',
      'Password must be at least 8 characters',
      'Password must contain at least one uppercase letter',
      'Password must contain at least one lowercase letter',
      'Password must contain at least one number',
    ];
    const message = safeMessages.includes(error.message) ? error.message : 'Registration failed';
    res.status(400).json({ error: message });
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

    // Transfer anonymous usage to the authenticated user
    const anonId = req.cookies?.anon_id;
    if (anonId && result.user?.id) {
      await usageService.transferAnonymousUsage(result.user.id, anonId).catch(err => {
        logger.warn('Failed to transfer anonymous usage', { error: err.message });
      });
    }

    res.json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    // Always return generic message to prevent user enumeration
    res.status(401).json({ error: 'Invalid email or password' });
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
 * GET /api/auth/me/entitlements
 * Get canonical entitlements object for the authenticated user
 * This is the single source of truth for all entitlement decisions.
 *
 * Returns:
 * {
 *   plan: "free" | "pro" | "day_pass",
 *   subscriptionStatus: "active" | "trialing" | "canceled" | "past_due" | "none",
 *   subscriptionInterval: "day" | "month" | "year" | null,
 *   currentPeriodEnd: ISO date string | null,
 *   dayPassExpiresAt: ISO date string | null,
 *   cancelAtPeriodEnd: boolean,
 *   purchasedReports: string[],
 *   permissions: {
 *     accessProTools: boolean,
 *     viewProSections: boolean,
 *     exportReports: boolean
 *   }
 * }
 */
router.get('/me/entitlements', requireAuth, async (req, res) => {
  try {
    // Use canonical entitlements resolver
    const entitlements = await resolveEntitlements({ userId: req.user.id });

    logger.debug('Entitlements fetched', createDebugSummary(entitlements));

    // Compute display-friendly plan info for dropdown
    let planCode = 'free';
    let planLabel = 'Free';
    let expiresAt = null;
    let renewsAt = null;

    if (entitlements.plan === 'pro') {
      if (entitlements.subscriptionInterval === 'year') {
        planCode = 'pro_annual';
        planLabel = 'Pro Annual';
      } else {
        planCode = 'pro_monthly';
        planLabel = 'Pro Monthly';
      }
      if (entitlements.cancelAtPeriodEnd) {
        expiresAt = entitlements.currentPeriodEnd;
      } else {
        renewsAt = entitlements.currentPeriodEnd;
      }
    } else if (entitlements.plan === 'day_pass') {
      planCode = 'day_pass';
      planLabel = 'Day Pass';
      expiresAt = entitlements.dayPassExpiresAt;
    } else if (entitlements.purchasedReports && entitlements.purchasedReports.length > 0) {
      planCode = 'single_report';
      planLabel = 'Single Report';
    }

    // Get usage summary
    const usageSummary = await usageService.getUsageSummary(
      req.user.id,
      null, // No anon ID for authenticated users
      planCode,
      {
        subscriptionEnd: entitlements.currentPeriodEnd,
        dayPassExpiry: entitlements.dayPassExpiresAt
      }
    );

    // Get plan limits
    const limits = getPlanLimits(planCode);

    // Build response with usage data
    res.json({
      // Plan info
      plan: entitlements.plan,
      plan_code: planCode,
      plan_label: planLabel,
      plan_status: entitlements.subscriptionStatus || 'none',

      // Subscription details
      subscriptionStatus: entitlements.subscriptionStatus,
      subscriptionInterval: entitlements.subscriptionInterval,
      currentPeriodEnd: entitlements.currentPeriodEnd,
      dayPassExpiresAt: entitlements.dayPassExpiresAt,
      cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,

      // Scan quotas
      scan_limit_daily: usageSummary.scanLimitDaily,
      scans_used_today: usageSummary.scansUsedToday,
      scans_remaining_today: usageSummary.scansRemainingToday,
      scans_reset_at: usageSummary.scansResetAt,

      // Report quotas
      report_limit: usageSummary.reportLimit,
      reports_used: usageSummary.reportsUsed,
      reports_remaining: usageSummary.reportsRemaining,
      report_window_ends_at: usageSummary.reportWindowEndsAt,

      // Purchased reports (individual unlocks)
      purchasedReports: entitlements.purchasedReports,

      // Permissions
      permissions: entitlements.permissions,

      // Display-friendly fields for dropdown
      display: {
        planCode,
        planLabel,
        status: entitlements.subscriptionStatus,
        expiresAt,
        renewsAt,
        reportsRemaining: usageSummary.reportsRemaining
      },

      // Pricing config for upgrade CTAs
      pricing: PRICING
    });
  } catch (error) {
    logger.error('Failed to fetch entitlements', { userId: req.user?.id, error: error.message });
    res.status(500).json({ error: 'Failed to fetch entitlements' });
  }
});

/**
 * GET /api/auth/check-access
 * Check if user has access to Pro sections of a specific report.
 * Works for both authenticated and unauthenticated users.
 *
 * Query params:
 *   reportId (required) - The report ID to check access for
 *
 * Returns:
 * {
 *   canView: boolean,      // Can view free sections
 *   canViewPro: boolean,   // Can view Pro sections
 *   canExport: boolean,    // Can export report
 *   reason: string,        // "global_access" | "purchased_report" | "no_access"
 *   reportId: string,
 *   entitlements: {
 *     plan: string,
 *     hasGlobalAccess: boolean,
 *     isPurchased: boolean
 *   }
 * }
 */
router.get('/check-access', optionalAuth, async (req, res) => {
  try {
    const reportId = req.query.reportId || req.query.report_id;

    // Validate reportId
    const validation = validateReportId(reportId);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        canView: false,
        canViewPro: false,
        canExport: false
      });
    }

    // Resolve entitlements (will return default free entitlements if no user)
    const entitlements = await resolveEntitlements({
      userId: req.user?.id,
      sessionId: req.sessionID
    });

    // Check access for this specific report
    const accessResult = await getReportAccess(
      reportId,
      { userId: req.user?.id, sessionId: req.sessionID },
      entitlements
    );

    logger.info('Access check', {
      reportId,
      userId: req.user?.id ? req.user.id.substring(0, 8) + '...' : 'guest',
      canViewPro: accessResult.canViewPro,
      reason: accessResult.reason
    });

    res.json(accessResult);
  } catch (error) {
    logger.error('Access check failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to check access',
      canView: false,
      canViewPro: false,
      canExport: false
    });
  }
});

/**
 * GET /api/auth/usage
 * Get usage status for current user (authenticated or anonymous)
 * This is a public endpoint that works without authentication
 * Uses anon_id cookie for anonymous users
 *
 * Returns:
 * {
 *   plan_code: string,
 *   plan_label: string,
 *   scan_limit_daily: number,
 *   scans_used_today: number,
 *   scans_remaining_today: number,
 *   scans_reset_at: ISO date string,
 *   is_authenticated: boolean,
 *   pricing: { ... }
 * }
 */
router.get('/usage', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || null;
    let anonId = req.cookies?.anon_id || null;

    // Generate anon_id for anonymous users if they don't have one
    // This ensures consistent usage tracking across page loads
    if (!userId && !anonId) {
      anonId = crypto.randomUUID();
      res.cookie('anon_id', anonId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        sameSite: 'lax'
      });
    }

    // If user is authenticated and has an anon_id, transfer anonymous usage
    // This ensures usage is consolidated even if user logged in before transfer fix
    if (userId && anonId) {
      await usageService.transferAnonymousUsage(userId, anonId).catch(() => {});
    }

    // Determine plan code
    const planCode = userId ? resolveEffectivePlan(req.user) : 'free';
    const limits = getPlanLimits(planCode);

    // Determine Day Pass expiry for authenticated Day Pass users
    let dayPassExpiresAt = null;
    if (planCode === 'day_pass' && req.user?.stripe_current_period_end) {
      dayPassExpiresAt = req.user.stripe_current_period_end;
    }

    // Get usage summary (use userId if authenticated, otherwise anonId)
    const usageSummary = await usageService.getUsageSummary(
      userId,
      userId ? null : anonId, // Only use anonId for anonymous users
      planCode,
      {
        subscriptionEnd: req.user?.stripe_current_period_end,
        dayPassExpiry: dayPassExpiresAt
      }
    );

    res.json({
      plan_code: planCode,
      plan_label: planCode === 'free' ? 'Free' :
                  planCode === 'day_pass' ? 'Day Pass' :
                  planCode === 'pro_monthly' ? 'Pro Monthly' :
                  planCode === 'pro_annual' ? 'Pro Annual' : 'Free',
      scan_limit_daily: usageSummary.scanLimitDaily,
      scans_used_today: usageSummary.scansUsedToday,
      scans_remaining_today: usageSummary.scansRemainingToday,
      scans_reset_at: usageSummary.scansResetAt,
      report_limit: usageSummary.reportLimit,
      reports_used: usageSummary.reportsUsed,
      reports_remaining: usageSummary.reportsRemaining,
      report_window_ends_at: usageSummary.reportWindowEndsAt,
      day_pass_expires_at: dayPassExpiresAt,
      is_authenticated: !!userId,
      pricing: {
        dayPass: PRICING.plans.day_pass.price,
        proMonthly: PRICING.plans.pro_monthly.price,
        proAnnual: PRICING.plans.pro_annual.price,
        singleReport: PRICING.oneTimePurchases.single_report.price
      }
    });
  } catch (error) {
    logger.error('Usage check failed', { error: error.message });
    // Return default free tier usage on error
    res.json({
      plan_code: 'free',
      plan_label: 'Free',
      scan_limit_daily: PRICING.plans.free.limits.scansPerDay,
      scans_used_today: 0,
      scans_remaining_today: PRICING.plans.free.limits.scansPerDay,
      scans_reset_at: null,
      report_limit: 0,
      reports_used: 0,
      reports_remaining: 0,
      report_window_ends_at: null,
      is_authenticated: false,
      pricing: {
        dayPass: PRICING.plans.day_pass.price,
        proMonthly: PRICING.plans.pro_monthly.price,
        proAnnual: PRICING.plans.pro_annual.price,
        singleReport: PRICING.oneTimePurchases.single_report.price
      }
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, locale } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await authService.generateResetToken(email, locale);

    // In production, the token would be sent via email
    // Never expose the token in the API response
    res.json({
      success: true,
      message: 'If this email exists, a password reset link has been generated'
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

/**
 * POST /api/auth/test-email
 * Admin-only: verify SMTP connection and optionally send a test email
 */
router.post('/test-email', requireAuth, async (req, res) => {
  try {
    const { getDatabase } = require('../db');
    const db = getDatabase();
    const user = await db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id]);
    if (!user?.is_admin) return res.status(403).json({ error: 'Admin only' });

    const emailService = require('../services/emailService');

    // Step 1: verify SMTP connection
    const connected = await emailService.verifyConnection();
    if (!connected) {
      return res.json({ success: false, step: 'connection', error: 'SMTP connection failed — check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars' });
    }

    // Step 2: optionally send a test email
    const { to } = req.body || {};
    if (to) {
      const info = await emailService.sendTestEmail(to);
      return res.json({ success: true, step: 'sent', messageId: info.messageId, to });
    }

    res.json({ success: true, step: 'connection', message: 'SMTP connection verified' });
  } catch (error) {
    logger.error('[Auth] test-email failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
