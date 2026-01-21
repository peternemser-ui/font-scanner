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
  const validReportTypes = ['seo', 'performance', 'accessibility', 'security', 'fonts', 'tag-intelligence'];
  if (!validReportTypes.includes(reportType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid report type. Must be one of: ${validReportTypes.join(', ')}`
    });
  }

  logger.info(`PDF purchase request`, { reportType, email, requestId: req.id });

  const analyzerKeyByType = {
    seo: 'seo',
    performance: 'performance',
    accessibility: 'accessibility',
    security: 'security',
    fonts: reportData?.analyzerKey || 'enhanced-fonts',
    'tag-intelligence': 'tag-intelligence',
  };

  const resolvedReportId = resolveReportId({
    reportId: reportData?.reportId,
    analyzerKey: analyzerKeyByType[reportType],
    url: reportData?.normalizedUrl || reportData?.url || reportData?.baseUrl,
    startedAtISO: reportData?.scanStartedAt || reportData?.startedAt || reportData?.timestamp,
  });

  if (!resolvedReportId) {
    throw new ValidationError('Report identity is required (reportId or url + scanStartedAt + analyzerKey)');
  }

  const reportDataWithId = { ...reportData, reportId: resolvedReportId, analyzerKey: analyzerKeyByType[reportType] };

  // Process payment
  const paymentResult = await paymentService.processPayment({
    cardNumber,
    expiryMonth,
    expiryYear,
    cvv,
    email,
    reportType,
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
    switch (reportType) {
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
        throw new Error(`Unknown report type: ${reportType}`);
    }

    logger.info(`PDF generated successfully`, { 
      filename: pdfResult.filename, 
      reportType,
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

  const validReportTypes = ['seo', 'performance', 'accessibility', 'security', 'fonts', 'tag-intelligence'];
  if (!validReportTypes.includes(reportType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid report type. Must be one of: ${validReportTypes.join(', ')}`
    });
  }

  logger.info(`PDF generation request`, { reportType, requestId: req.id });

  const analyzerKeyByType = {
    seo: 'seo',
    performance: 'performance',
    accessibility: 'accessibility',
    security: 'security',
    fonts: reportData?.analyzerKey || 'enhanced-fonts',
    'tag-intelligence': 'tag-intelligence',
  };

  const resolvedReportId = resolveReportId({
    reportId: reportData?.reportId,
    analyzerKey: analyzerKeyByType[reportType],
    url: reportData?.normalizedUrl || reportData?.url || reportData?.baseUrl,
    startedAtISO: reportData?.scanStartedAt || reportData?.startedAt || reportData?.timestamp,
  });

  // Check entitlement - user must have paid access
  const user = req.user; // Attached by optionalAuth middleware
  const canAccess = await stripeService.canAccessPaid(user, resolvedReportId);

  if (!canAccess) {
    logger.info('PDF generation blocked - paid access required', {
      reportType,
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
    analyzerKey: analyzerKeyByType[reportType]
  };

  try {
    let pdfResult;

    switch (reportType) {
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
        throw new Error(`Unknown report type: ${reportType}`);
    }

    logger.info(`PDF generated successfully`, { filename: pdfResult.filename, reportType });

    const fs = require('fs');

    // Stream the PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);

    const fileStream = fs.createReadStream(pdfResult.filepath);
    fileStream.pipe(res);

    fileStream.on('error', (err) => {
      logger.error('Error streaming PDF:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error streaming PDF report'
        });
      }
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

module.exports = {
  getPricing,
  purchasePDFReport,
  downloadPDFReport,
  generatePDF
};
