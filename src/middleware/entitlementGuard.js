/**
 * Entitlement Guard Middleware
 * Server-side enforcement for report access, PDF export, and page limits.
 */

const { resolveEntitlements, getReportAccess, canExportReport } = require('../utils/entitlements');
const { getPlanLimits } = require('../config/pricing');
const { resolveEffectivePlan } = require('./scanQuota');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EntitlementGuard');

/**
 * Require report access middleware.
 * - Requires auth (401 if not)
 * - Resolves entitlements and checks access for the given reportId
 * - If canView: attach entitlements to req, next()
 * - If !canView: 403 with reason
 *
 * reportId is read from req.params.id, req.query.reportId, or req.body.reportId
 */
async function requireReportAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'authentication_required',
      message: 'You must be logged in to access reports.',
      code: 'AUTH_REQUIRED'
    });
  }

  const reportId = req.params.id || req.query.reportId || req.query.report_id ||
                   req.body?.reportId || req.body?.report_id;

  if (!reportId) {
    return res.status(400).json({
      error: 'missing_report_id',
      message: 'Report ID is required.',
      code: 'MISSING_REPORT_ID'
    });
  }

  try {
    const entitlements = await resolveEntitlements({ userId: req.user.id });
    const access = await getReportAccess(reportId, { userId: req.user.id }, entitlements);

    if (!access.canView) {
      logger.info('Report access denied', {
        userId: req.user.id.substring(0, 8) + '...',
        reportId,
        reason: access.reason
      });

      return res.status(403).json({
        error: 'report_access_denied',
        message: 'You do not have access to this report.',
        reason: access.reason,
        code: 'REPORT_ACCESS_DENIED',
        upgradeUrl: '/upgrade.html'
      });
    }

    // Attach entitlements and access info for downstream use
    req.entitlements = entitlements;
    req.reportAccess = access;
    next();
  } catch (error) {
    logger.error('Report access check failed', { error: error.message });
    return res.status(500).json({
      error: 'access_check_failed',
      message: 'Unable to verify report access. Please try again.',
      code: 'ACCESS_CHECK_ERROR'
    });
  }
}

/**
 * Require PDF export access middleware.
 * - Requires auth (401 if not)
 * - Gets reportId from req.body or req.query
 * - Checks canExportReport
 * - If !canExport: 403 with upgrade CTA
 */
async function requirePdfExport(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'authentication_required',
      message: 'You must be logged in to export PDFs.',
      code: 'AUTH_REQUIRED'
    });
  }

  const reportId = req.body?.reportId || req.body?.report_id ||
                   req.query?.reportId || req.query?.report_id;

  try {
    const entitlements = await resolveEntitlements({ userId: req.user.id });

    if (!canExportReport(entitlements, reportId)) {
      logger.info('PDF export denied', {
        userId: req.user.id.substring(0, 8) + '...',
        reportId,
        plan: entitlements.plan
      });

      return res.status(403).json({
        error: 'pdf_export_denied',
        message: 'PDF export requires a Pro subscription or report purchase.',
        code: 'PDF_EXPORT_DENIED',
        upgradeUrl: '/upgrade.html'
      });
    }

    req.entitlements = entitlements;
    next();
  } catch (error) {
    logger.error('PDF export check failed', { error: error.message });
    return res.status(500).json({
      error: 'export_check_failed',
      message: 'Unable to verify export access. Please try again.',
      code: 'EXPORT_CHECK_ERROR'
    });
  }
}

/**
 * Enforce page limit middleware.
 * Reads plan from req.planCode (set by checkScanQuota) or resolves it.
 * Caps requested pages to the plan's pagesPerCrawl limit.
 */
function enforcePageLimit(req, res, next) {
  try {
    const planCode = req.planCode || resolveEffectivePlan(req.user);
    const limits = getPlanLimits(planCode);
    const maxPages = limits.pagesPerCrawl;

    // Cap maxPages in the request body/validated data
    if (req.validatedData?.options?.maxPages && maxPages > 0) {
      if (req.validatedData.options.maxPages > maxPages) {
        logger.info('Page limit capped', {
          requested: req.validatedData.options.maxPages,
          capped: maxPages,
          plan: planCode
        });
        req.validatedData.options.maxPages = maxPages;
      }
    }

    if (req.body?.options?.maxPages && maxPages > 0) {
      if (req.body.options.maxPages > maxPages) {
        req.body.options.maxPages = maxPages;
      }
    }

    req.pageLimit = maxPages;
    next();
  } catch (error) {
    logger.error('Page limit enforcement failed', { error: error.message });
    next(); // Fail open for availability
  }
}

module.exports = {
  requireReportAccess,
  requirePdfExport,
  enforcePageLimit
};
