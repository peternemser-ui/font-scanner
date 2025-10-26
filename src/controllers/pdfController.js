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
const { asyncHandler } = require('../utils/errorHandler');
const { createLogger } = require('../utils/logger');
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

  // Process payment
  const paymentResult = await paymentService.processPayment({
    cardNumber,
    expiryMonth,
    expiryYear,
    cvv,
    email,
    reportType,
    reportId: reportData.reportId || 'unknown'
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
        pdfResult = await seoPdfGenerator.generateReport(reportData);
        break;
      case 'performance':
        pdfResult = await performancePdfGenerator.generateReport(reportData);
        break;
      case 'accessibility':
        pdfResult = await accessibilityPdfGenerator.generateReport(reportData);
        break;
      case 'security':
        pdfResult = await securityPdfGenerator.generateReport(reportData);
        break;
      case 'fonts':
        pdfResult = await pdfReportGenerator.generateComprehensiveReport(reportData);
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
  
  // Search for matching PDF file
  let pdfPath;
  const files = fs.readdirSync(reportsDir);
  
  // Find file by report type and recent timestamp
  const reportTypePrefix = reportType === 'fonts' ? 'font-analysis' : `${reportType}-analysis`;
  const matchingFiles = files.filter(f => f.startsWith(reportTypePrefix) && f.endsWith('.pdf'));
  
  if (matchingFiles.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'PDF report not found'
    });
  }

  // Get most recent file
  pdfPath = path.join(reportsDir, matchingFiles[matchingFiles.length - 1]);

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
