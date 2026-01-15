const express = require('express');
const stripeService = require('../services/stripeService');
const { createLogger } = require('../utils/logger');
const { ValidationError, asyncHandler } = require('../utils/errorHandler');

const logger = createLogger('BillingRoutes');
const router = express.Router();

function getAllowedReturnHosts(requestHost) {
  const fromEnv = (process.env.BILLING_ALLOWED_RETURN_HOSTS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;

  const host = typeof requestHost === 'string' ? requestHost.split(':')[0] : '';
  return [
    'sitemechanic.io',
    'www.sitemechanic.io',
    'localhost',
    host
  ].filter(Boolean);
}

function validateReturnUrl(returnUrl, requestHost) {
  if (!returnUrl || typeof returnUrl !== 'string') {
    throw new ValidationError('returnUrl is required');
  }

  const trimmed = returnUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (e) {
    throw new ValidationError('returnUrl must be a valid absolute URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ValidationError('returnUrl must use http or https');
  }

  const allowedHosts = getAllowedReturnHosts(requestHost);
  if (!allowedHosts.includes(parsed.hostname)) {
    throw new ValidationError('returnUrl host is not allowed');
  }

  return parsed.toString();
}

/**
 * POST /api/billing/create-checkout-session
 * Body:
 * {
 *   purchaseType: "single_report" | "credit_pack",
 *   packId?: "pack_5" | "pack_10" | "pack_25",
 *   reportId?: string,
 *   returnUrl: string
 * }
 */
router.post(
  '/create-checkout-session',
  asyncHandler(async (req, res) => {
    const { purchaseType, packId, reportId, returnUrl, returnTo } = req.body || {};

    if (!purchaseType || (purchaseType !== 'single_report' && purchaseType !== 'credit_pack')) {
      throw new ValidationError('purchaseType must be "single_report" or "credit_pack"');
    }

    if (purchaseType === 'single_report') {
      if (!reportId || typeof reportId !== 'string') {
        throw new ValidationError('single_report requires reportId');
      }
    }

    if (purchaseType === 'credit_pack') {
      if (!packId || !['pack_5', 'pack_10', 'pack_25'].includes(packId)) {
        throw new ValidationError('packId must be one of: pack_5, pack_10, pack_25');
      }
    }

    // Back-compat: older clients send returnTo (relative). Prefer returnUrl (absolute).
    const requestHost = req.get('host');
    let safeReturnUrl;
    if (returnUrl) {
      safeReturnUrl = validateReturnUrl(returnUrl, requestHost);
    } else if (returnTo && typeof returnTo === 'string') {
      // Best-effort: convert relative path to absolute using request origin.
      const origin = `${req.protocol}://${requestHost}`;
      safeReturnUrl = validateReturnUrl(new URL(returnTo.trim(), origin).toString(), requestHost);
    } else {
      throw new ValidationError('returnUrl is required');
    }

    logger.info('Creating billing checkout session', {
      purchaseType,
      packId: packId || null,
      reportId: reportId || null,
      returnUrl: safeReturnUrl
    });

    const session = await stripeService.createBillingCheckoutSession({
      purchaseType,
      packId: packId || null,
      reportId: reportId || null,
      returnUrl: safeReturnUrl,
      requestOrigin: `${req.protocol}://${req.get('host')}`
    });

    res.json({ checkoutUrl: session.url });
  })
);

/**
 * GET /api/billing/verify-session?session_id=...
 * On success returns:
 * {
 *   paid: boolean,
 *   purchaseType: "single_report" | "credit_pack",
 *   reportId: string | null,
 *   creditsAdded: 0 | 5 | 10 | 25
 * }
 */
router.get(
  '/verify-session',
  asyncHandler(async (req, res) => {
    const sessionId = req.query.session_id;
    if (!sessionId || typeof sessionId !== 'string') {
      throw new ValidationError('session_id is required');
    }

    const result = await stripeService.verifyBillingSession(sessionId);
    res.json(result);
  })
);

module.exports = router;
