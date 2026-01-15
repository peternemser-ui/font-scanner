/**
 * PDF Controller
 * Handles payment processing and PDF report generation/download
 */

const paymentService = require('../services/paymentService');
const seoPdfGenerator = require('../services/seoPdfGenerator');
const performancePdfGenerator = require('../services/performancePdfGenerator');
const accessibilityPdfGenerator = require('../services/accessibilityPdfGenerator');
const securityPdfGenerator = require('../services/securityPdfGenerator');
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
  const validReportTypes = ['seo', 'performance', 'accessibility', 'security', 'fonts'];
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

  const reportTypePrefix = reportType === 'fonts' ? 'font-analysis' : `${reportType}-analysis`;
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

module.exports = {
  getPricing,
  purchasePDFReport,
  downloadPDFReport
};
