/**
 * PDF Controller
 * Handles payment processing and PDF report generation/download
 */

const paymentService = require('../services/paymentService');
const stripeService = require('../services/stripeService');
const seoPdfGenerator = require('../services/seoPdfGenerator');
const performancePdfGenerator = require('../services/performancePdfGenerator');
const accessibilityPdfGenerator = require('../services/accessibilityPdfGenerator');
const securityPdfGenerator = require('../services/securityPdfGenerator');
const tagIntelligencePdfGenerator = require('../services/tagIntelligencePdfGenerator');
const pdfReportGenerator = require('../services/pdfReportGenerator');
const { asyncHandler, ValidationError } = require('../utils/errorHandler');
const { createLogger } = require('../utils/logger');
const { resolveReportId } = require('../utils/resolveReportId');
const path = require('path');

const logger = createLogger('PDFController');

/**
 * Get pricing information
 * GET /api/pdf/pricing
 */
const getPricing = asyncHandler(async (req, res) => {
  const pricing = paymentService.getPricing();
  
  res.json({
    success: true,
    pricing
  });
});

/**
 * Process payment for PDF report
 * POST /api/pdf/purchase
 */
const purchasePDFReport = asyncHandler(async (req, res) => {
  const { cardNumber, expiryMonth, expiryYear, cvv, email, reportType, reportData } = req.body;

  // Validate required fields
  if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !email || !reportType) {
    return res.status(400).json({
      success: false,
      error: 'Missing required payment information'
    });
  }

  if (!reportData) {
    return res.status(400).json({
      success: false,
      error: 'Report data is required'
    });
  }

  // Validate report type
  const validReportTypes = [
    'seo', 'performance', 'accessibility', 'security', 'fonts', 'tag-intelligence',
    'core-web-vitals', 'ip-reputation', 'broken-links', 'geo-seo', 'local-seo',
    'gdpr', 'mobile', 'cro', 'site-crawler', 'brand-consistency', 'competitive'
  ];
  // Normalize legacy 'local-seo' to 'geo-seo'
  const normalizedReportType = reportType === 'local-seo' ? 'geo-seo' : reportType;
  if (!validReportTypes.includes(normalizedReportType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid report type. Must be one of: ${validReportTypes.join(', ')}`
    });
  }

  logger.info(`PDF purchase request`, { reportType: normalizedReportType, email, requestId: req.id });

  const analyzerKeyByType = {
    seo: 'seo',
    performance: 'performance',
    accessibility: 'accessibility',
    security: 'security',
    fonts: reportData?.analyzerKey || 'enhanced-fonts',
    'tag-intelligence': 'tag-intelligence',
    'core-web-vitals': 'core-web-vitals',
    'ip-reputation': 'ip-reputation',
    'broken-links': 'broken-links',
    'geo-seo': 'geo-seo',
    gdpr: 'gdpr-compliance',
    mobile: 'mobile-analyzer',
    cro: 'cro-analyzer',
    'site-crawler': 'site-crawler',
    'brand-consistency': 'brand-consistency',
    competitive: 'competitive-analysis',
  };

  const resolvedReportId = resolveReportId({
    reportId: reportData?.reportId,
    analyzerKey: analyzerKeyByType[normalizedReportType],
    url: reportData?.normalizedUrl || reportData?.url || reportData?.baseUrl,
    startedAtISO: reportData?.scanStartedAt || reportData?.startedAt || reportData?.timestamp,
  });

  if (!resolvedReportId) {
    throw new ValidationError('Report identity is required (reportId or url + scanStartedAt + analyzerKey)');
  }

  const reportDataWithId = { ...reportData, reportId: resolvedReportId, analyzerKey: analyzerKeyByType[normalizedReportType] };

  // Process payment
  const paymentResult = await paymentService.processPayment({
    cardNumber,
    expiryMonth,
    expiryYear,
    cvv,
    email,
    reportType: normalizedReportType,
    reportId: resolvedReportId,
  });

  if (!paymentResult.success) {
    return res.status(400).json({
      success: false,
      error: paymentResult.error,
      message: paymentResult.message
    });
  }

  // Generate PDF report
  let pdfResult;
  try {
    switch (normalizedReportType) {
      case 'seo':
        pdfResult = await seoPdfGenerator.generateReport(reportDataWithId);
        break;
      case 'performance':
        pdfResult = await performancePdfGenerator.generateReport(reportDataWithId);
        break;
      case 'accessibility':
        pdfResult = await accessibilityPdfGenerator.generateReport(reportDataWithId);
        break;
      case 'security':
        pdfResult = await securityPdfGenerator.generateReport(reportDataWithId);
        break;
      case 'fonts':
        pdfResult = await pdfReportGenerator.generateComprehensiveReport(reportDataWithId);
        break;
      case 'tag-intelligence':
        pdfResult = await tagIntelligencePdfGenerator.generateReport(reportDataWithId);
        break;
      default:
        throw new Error(`Unknown report type: ${normalizedReportType}`);
    }

    logger.info(`PDF generated successfully`, {
      filename: pdfResult.filename,
      reportType: normalizedReportType,
      transactionId: paymentResult.transaction.transactionId 
    });

    // Return success with download token
    res.json({
      success: true,
      message: 'Payment processed and PDF report generated',
      transaction: paymentResult.transaction,
      downloadToken: paymentResult.downloadToken,
      filename: pdfResult.filename
    });

  } catch (error) {
    logger.error('Error generating PDF after payment:', error);
    
    // Payment succeeded but PDF generation failed - this is a critical error
    // In production, you would: 
    // 1. Refund the payment
    // 2. Alert administrators
    // 3. Queue for retry
    
    res.status(500).json({
      success: false,
      error: 'PDF generation failed after payment. Please contact support with transaction ID: ' + 
             paymentResult.transaction.transactionId,
      transactionId: paymentResult.transaction.transactionId
    });
  }
});

/**
 * Download PDF report with valid token
 * GET /api/pdf/download/:token
 */
const downloadPDFReport = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Download token is required'
    });
  }

  // Validate token
  const validation = paymentService.validateDownloadToken(token);
  
  if (!validation.valid) {
    return res.status(403).json({
      success: false,
      error: validation.reason || 'Invalid or expired download token'
    });
  }

  // Token is valid - proceed with download
  const { reportType, reportId } = validation.data;
  
  logger.info('PDF download request', { reportType, reportId, requestId: req.id });

  // Find PDF file
  // Note: In production, store filename in token data or database
  const reportsDir = path.join(__dirname, '../../reports');
  const fs = require('fs');

  const reportTypePrefixMap = {
    fonts: 'font-analysis',
    'tag-intelligence': 'tag-intelligence-analysis'
  };
  const reportTypePrefix = reportTypePrefixMap[reportType] || `${reportType}-analysis`;
  const expectedFilename = `${reportTypePrefix}-${reportId}.pdf`;
  const pdfPath = path.join(reportsDir, expectedFilename);

  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({
      success: false,
      error: 'PDF report not found'
    });
  }

  // Invalidate token (one-time download)
  paymentService.invalidateToken(token);

  // Send PDF file
  res.download(pdfPath, (err) => {
    if (err) {
      logger.error('Error downloading PDF:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error downloading PDF report'
        });
      }
    } else {
      logger.info('PDF downloaded successfully', { filename: path.basename(pdfPath) });
    }
  });
});

/**
 * Generate PDF report directly (for unlocked reports)
 * POST /api/pdf/generate
 * Returns PDF as direct download stream
 *
 * Requires paid access:
 * - Pro subscribers can generate all PDFs
 * - Users with single report purchase can generate that specific report
 * - req.user is attached by optionalAuth middleware
 */
const generatePDF = asyncHandler(async (req, res) => {
  const { reportType, reportData } = req.body;

  if (!reportType || !reportData) {
    return res.status(400).json({
      success: false,
      error: 'Report type and data are required'
    });
  }

  const validReportTypes = [
    'seo', 'performance', 'accessibility', 'security', 'fonts', 'tag-intelligence',
    'core-web-vitals', 'ip-reputation', 'broken-links', 'geo-seo', 'local-seo',
    'gdpr', 'mobile', 'cro', 'site-crawler', 'brand-consistency', 'competitive'
  ];
  // Normalize legacy 'local-seo' to 'geo-seo'
  const normalizedReportType = reportType === 'local-seo' ? 'geo-seo' : reportType;
  if (!validReportTypes.includes(normalizedReportType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid report type. Must be one of: ${validReportTypes.join(', ')}`
    });
  }

  logger.info(`PDF generation request`, { reportType: normalizedReportType, requestId: req.id });

  const analyzerKeyByType = {
    seo: 'seo',
    performance: 'performance',
    accessibility: 'accessibility',
    security: 'security',
    fonts: reportData?.analyzerKey || 'enhanced-fonts',
    'tag-intelligence': 'tag-intelligence',
    'core-web-vitals': 'core-web-vitals',
    'ip-reputation': 'ip-reputation',
    'broken-links': 'broken-links',
    'geo-seo': 'geo-seo',
    gdpr: 'gdpr-compliance',
    mobile: 'mobile-analyzer',
    cro: 'cro-analyzer',
    'site-crawler': 'site-crawler',
    'brand-consistency': 'brand-consistency',
    competitive: 'competitive-analysis',
  };

  const resolvedReportId = resolveReportId({
    reportId: reportData?.reportId,
    analyzerKey: analyzerKeyByType[normalizedReportType],
    url: reportData?.normalizedUrl || reportData?.url || reportData?.baseUrl,
    startedAtISO: reportData?.scanStartedAt || reportData?.startedAt || reportData?.timestamp,
  });

  // Check entitlement - user must have paid access
  // In development mode, allow access for testing
  const isDev = process.env.NODE_ENV !== 'production';
  const user = req.user; // Attached by optionalAuth middleware
  let canAccess = isDev || await stripeService.canAccessPaid(user, resolvedReportId);

  // If standard check fails, check if client has session-verified purchase
  // This handles the case where webhook didn't fire (local dev) but user did pay
  if (!canAccess && user) {
    // Check if client is claiming session-verified access
    const sessionVerified = req.headers['x-session-verified'] === 'true';
    const sessionCheckoutId = req.headers['x-checkout-session-id'];

    if (sessionVerified && sessionCheckoutId) {
      logger.info('Attempting session-verified purchase fallback', {
        reportId: resolvedReportId,
        userId: user.id,
        sessionId: sessionCheckoutId
      });

      // Try to verify and record the purchase
      try {
        const verifyResult = await stripeService.verifyAndRecordPurchase(sessionCheckoutId, user.id);
        if (verifyResult.success) {
          logger.info('Session-verified purchase recorded successfully', {
            reportId: resolvedReportId,
            userId: user.id
          });
          canAccess = true;
        }
      } catch (e) {
        logger.warn('Session-verified purchase fallback failed', { error: e.message });
      }
    }

    // Also check if a recent billing session exists for this user/report
    // This handles the case where session markers exist but record wasn't persisted
    if (!canAccess) {
      try {
        const { getDatabase } = require('../db');
        const db = getDatabase();
        // Check billing_sessions table for a recent paid session for this report
        const recentSession = await db.get(
          `SELECT session_id FROM billing_sessions
           WHERE report_id = ? AND payment_status = 'paid'
           AND purchase_type = 'single_report'
           ORDER BY completed_at DESC LIMIT 1`,
          [resolvedReportId]
        );

        if (recentSession) {
          logger.info('Found paid billing session, attempting to record purchase', {
            reportId: resolvedReportId,
            sessionId: recentSession.session_id
          });
          const verifyResult = await stripeService.verifyAndRecordPurchase(recentSession.session_id, user.id);
          if (verifyResult.success) {
            canAccess = true;
          }
        }
      } catch (e) {
        logger.warn('Billing session lookup failed', { error: e.message });
      }
    }
  }

  if (!canAccess) {
    logger.info('PDF generation blocked - paid access required', {
      reportType: normalizedReportType,
      reportId: resolvedReportId,
      userId: user?.id || 'anonymous'
    });

    return res.status(403).json({
      success: false,
      error: 'Paid access required',
      message: 'You need a Pro subscription or to purchase this report to download the PDF.',
      upgradeUrl: '/upgrade.html',
      reportId: resolvedReportId
    });
  }

  const reportDataWithId = {
    ...reportData,
    reportId: resolvedReportId || `gen-${Date.now()}`,
    analyzerKey: analyzerKeyByType[normalizedReportType]
  };

  // --- Resolve locale: prefer explicit client lang, then pageUrl, then DB, then 'en' ---
  const { getDatabase } = require('../db');
  const db = getDatabase();
  const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh', 'ru'];
  let locale = 'en';

  // 1. Explicit lang from the export request body (most reliable — reflects active UI language)
  if (req.body.lang && SUPPORTED_LOCALES.includes(req.body.lang)) {
    locale = req.body.lang;
  }

  // 2. Locale from the pageUrl path prefix (e.g. /ja/performance-hub.html)
  if (locale === 'en') {
    const pageUrl = req.body.pageUrl || '';
    const pathParts = pageUrl.split('/').filter(Boolean);
    const urlLocale = pathParts[0];
    if (urlLocale && SUPPORTED_LOCALES.includes(urlLocale) && urlLocale !== 'en') {
      locale = urlLocale;
    }
  }

  // 3. DB scan locale (only trust non-'en' values, since 'en' is often a stale default
  //    from Accept-Language when the user actually selected a different UI language)
  if (locale === 'en') {
    try {
      const scanRow = await db.get(
        'SELECT locale FROM scans WHERE report_id = ? ORDER BY created_at DESC LIMIT 1',
        [resolvedReportId]
      );
      if (scanRow?.locale && scanRow.locale !== 'en' && SUPPORTED_LOCALES.includes(scanRow.locale)) {
        locale = scanRow.locale;
      }
    } catch (e) {
      logger.warn('Could not look up scan locale, using fallback', { error: e.message });
    }
  }

  logger.info('PDF locale resolved', { locale, reportId: resolvedReportId });

  // --- Map reportType to PDF template (new system) or analyzer page (legacy) ---
  const PDF_TEMPLATE_MAP = {
    seo: 'pdf-templates/seo-report.html',
    security: 'pdf-templates/security-report.html',
    accessibility: 'pdf-templates/accessibility-report.html',
    performance: 'pdf-templates/performance-report.html',
    fonts: 'pdf-templates/fonts-report.html',
    'tag-intelligence': 'pdf-templates/tag-intelligence-report.html',
    'core-web-vitals': 'pdf-templates/core-web-vitals-report.html',
    'ip-reputation': 'pdf-templates/ip-reputation-report.html',
    'broken-links': 'pdf-templates/broken-links-report.html',
    'geo-seo': 'pdf-templates/geo-seo-report.html',
    gdpr: 'pdf-templates/gdpr-report.html',
    mobile: 'pdf-templates/mobile-report.html',
    cro: 'pdf-templates/cro-report.html',
    'site-crawler': 'pdf-templates/site-crawler-report.html',
    'brand-consistency': 'pdf-templates/brand-consistency-report.html',
    competitive: 'pdf-templates/competitive-report.html',
  };

  const analyzerPageMap = {
    seo: 'seo-analyzer.html',
    performance: 'performance-hub.html',
    accessibility: 'accessibility-analyzer.html',
    security: 'security-analyzer.html',
    fonts: 'enhanced-fonts.html',
    'tag-intelligence': 'tag-intelligence.html',
    'core-web-vitals': 'core-web-vitals.html',
    'ip-reputation': 'ip-reputation-analyzer.html',
    'broken-links': 'broken-links.html',
    'geo-seo': 'geo-seo.html',
    gdpr: 'gdpr-compliance.html',
    mobile: 'mobile-analyzer.html',
    cro: 'cro-analyzer.html',
    'site-crawler': 'site-crawler.html',
    'brand-consistency': 'brand-consistency.html',
    competitive: 'competitive-analysis.html',
  };

  const port = process.env.PORT || 3000;
  const puppeteerPdfService = require('../services/puppeteerPdfService');
  const fs = require('fs');

  // Get auth token from request to pass to Puppeteer
  const authToken = req.headers.authorization?.replace('Bearer ', '') || '';
  const cookies = authToken ? [{
    name: 'sm_auth_token',
    value: authToken,
    domain: 'localhost'
  }] : [];

  const templatePage = PDF_TEMPLATE_MAP[normalizedReportType];
  const usePdfTemplate = !!templatePage;

  try {
    let result;

    if (usePdfTemplate) {
      // --- NEW: Render dedicated PDF template ---
      const templateUrl = `http://localhost:${port}/${locale}/${templatePage}?report_id=${resolvedReportId}&locale=${locale}`;
      logger.info('Using PDF template', { reportType: normalizedReportType, templateUrl });

      result = await puppeteerPdfService.generatePdfFromTemplate({
        templateUrl,
        reportId: resolvedReportId || `gen-${Date.now()}`,
        reportType: normalizedReportType,
        cookies,
        lang: locale,
        reportData: reportDataWithId,
        analyzedUrl: reportData?.url || reportData?.normalizedUrl
      });
    } else {
      // --- LEGACY: Render the actual report page via Puppeteer ---
      const analyzerPage = analyzerPageMap[normalizedReportType] || `${normalizedReportType}.html`;
      const printUrl = `http://localhost:${port}/${locale}/${analyzerPage}?report_id=${resolvedReportId}&print=1&locale=${locale}`;
      logger.info('Using legacy Puppeteer path', { reportType: normalizedReportType, printUrl });

      result = await puppeteerPdfService.generatePdfFromUrl({
        url: printUrl,
        reportId: resolvedReportId || `gen-${Date.now()}`,
        reportType: normalizedReportType,
        cookies,
        lang: locale,
        expandAccordions: true,
        isPaid: true,
        reportData: reportDataWithId,
        analyzedUrl: reportData?.url || reportData?.normalizedUrl
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

    const fileStream = fs.createReadStream(result.filepath);
    fileStream.pipe(res);
    fileStream.on('error', (err) => {
      logger.error('Error streaming PDF:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Error streaming PDF report' });
      }
    });
    fileStream.on('end', () => {
      setTimeout(() => { fs.unlink(result.filepath, () => {}); }, 5000);
    });

  } catch (error) {
    logger.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF report',
      message: error.message
    });
  }
});

/**
 * Render PDF using Puppeteer (screenshot-perfect output)
 * POST /api/pdf/render
 *
 * This endpoint renders the actual page using headless Chrome
 * for pixel-perfect PDF output that matches the web UI exactly.
 */
const renderPDF = asyncHandler(async (req, res) => {
  const { url, reportType, reportId, reportData, analyzedUrl } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required'
    });
  }

  // Check entitlement - user must have paid access
  // In development mode, allow access for testing
  const isDev = process.env.NODE_ENV !== 'production';
  const user = req.user;
  const canAccess = isDev || await stripeService.canAccessPaid(user, reportId);

  if (!canAccess) {
    logger.info('PDF render blocked - paid access required', {
      reportType,
      reportId,
      userId: user?.id || 'anonymous'
    });

    return res.status(403).json({
      success: false,
      error: 'Paid access required',
      message: 'You need a Pro subscription or to purchase this report to download the PDF.',
      upgradeUrl: '/upgrade.html',
      reportId
    });
  }

  logger.info('Rendering PDF with Puppeteer', {
    url,
    reportType,
    reportId,
    hasReportData: !!reportData,
    reportDataKeys: reportData ? Object.keys(reportData).slice(0, 5) : [],
    analyzedUrl: analyzedUrl
  });

  try {
    const puppeteerPdfService = require('../services/puppeteerPdfService');

    // Build the full URL if it's a relative path
    const fullUrl = url.startsWith('http')
      ? url
      : `http://localhost:${process.env.PORT || 3000}${url}`;

    // Get auth token from request to pass to Puppeteer
    const authToken = req.headers.authorization?.replace('Bearer ', '') || '';
    const cookies = authToken ? [{
      name: 'sm_auth_token',
      value: authToken,
      domain: 'localhost'
    }] : [];

    const result = await puppeteerPdfService.generatePdfFromUrl({
      url: fullUrl,
      reportId: reportId || `render-${Date.now()}`,
      reportType: reportType || 'report',
      cookies,
      waitTime: 3000,
      expandAccordions: true,
      isPaid: true, // User has verified paid access at this point
      reportData: reportData, // Pass report data for direct injection
      analyzedUrl: analyzedUrl // Pass analyzed URL
    });

    // Stream the PDF file
    const fs = require('fs');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

    const fileStream = fs.createReadStream(result.filepath);
    fileStream.pipe(res);

    fileStream.on('error', (err) => {
      logger.error('Error streaming rendered PDF:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error streaming PDF'
        });
      }
    });

    // Clean up file after sending (with delay)
    fileStream.on('end', () => {
      setTimeout(() => {
        fs.unlink(result.filepath, (err) => {
          if (err) logger.warn('Could not delete temp PDF:', err.message);
        });
      }, 5000);
    });

  } catch (error) {
    logger.error('Error rendering PDF with Puppeteer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to render PDF',
      message: error.message
    });
  }
});

module.exports = {
  getPricing,
  purchasePDFReport,
  downloadPDFReport,
  generatePDF,
  renderPDF
};
