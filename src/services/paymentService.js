const { createLogger } = require('../utils/logger');
const crypto = require('crypto');

const logger = createLogger('PaymentService');

/**
 * Payment Service for PDF Report Purchases
 * Handles payment processing and PDF download token generation
 * 
 * NOTE: This is a DEMO implementation. In production, you would:
 * 1. Integrate with Stripe/PayPal/Square for real payment processing
 * 2. Store transactions in a database with proper audit trails
 * 3. Implement webhook handlers for payment confirmations
 * 4. Add proper encryption for sensitive data
 * 5. Implement rate limiting and fraud detection
 */
class PaymentService {
  constructor() {
    this.pdfPrice = 5.00; // $5 per PDF report
    this.currency = 'USD';
    this.downloadTokens = new Map(); // In production: use Redis or database
    this.tokenExpiryMs = 3600000; // 1 hour
    
    // Demo mode - accepts test card numbers (must be explicitly enabled)
    this.demoMode = process.env.PAYMENT_DEMO_MODE === 'true';
    this.testCardNumbers = this.demoMode ? ['4242424242424242', '5555555555554444'] : [];
    
    logger.info('Payment Service initialized', { 
      demoMode: this.demoMode, 
      pdfPrice: this.pdfPrice 
    });
  }

  /**
   * Process payment for PDF report
   * In demo mode, accepts test card numbers
   * In production mode, would integrate with Stripe
   */
  async processPayment(paymentDetails) {
    const { cardNumber, expiryMonth, expiryYear, cvv, email, reportType, reportId } = paymentDetails;
    
    logger.info('Processing payment', { 
      reportType, 
      reportId, 
      email,
      demoMode: this.demoMode 
    });

    try {
      // Validate payment details
      this.validatePaymentDetails(paymentDetails);

      if (this.demoMode) {
        // Demo mode - check for test card
        if (!this.testCardNumbers.includes(cardNumber)) {
          throw new Error('Invalid card number. Use 4242424242424242 for testing.');
        }
        
        // Simulate payment processing delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        logger.info('Demo payment processed successfully', { reportType, email });
      } else {
        // Production mode - integrate with Stripe
        // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        // const paymentIntent = await stripe.paymentIntents.create({...});
        throw new Error('Production payment processing not yet implemented. Set PAYMENT_DEMO_MODE=true for testing.');
      }

      // Generate download token
      const downloadToken = this.generateDownloadToken(reportType, reportId, email);
      
      // Record transaction (in production: save to database)
      const transaction = {
        transactionId: this.generateTransactionId(),
        reportType,
        reportId,
        email,
        amount: this.pdfPrice,
        currency: this.currency,
        timestamp: new Date().toISOString(),
        downloadToken,
        status: 'completed'
      };

      logger.info('Payment completed successfully', { 
        transactionId: transaction.transactionId,
        reportType,
        email 
      });

      return {
        success: true,
        transaction,
        downloadToken,
        message: 'Payment processed successfully'
      };

    } catch (error) {
      logger.error('Payment processing failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Payment failed. Please check your card details and try again.'
      };
    }
  }

  /**
   * Validate payment details
   */
  validatePaymentDetails(details) {
    const { cardNumber, expiryMonth, expiryYear, cvv, email } = details;

    if (!cardNumber || !/^\d{13,19}$/.test(cardNumber.replace(/\s/g, ''))) {
      throw new Error('Invalid card number');
    }

    if (!expiryMonth || expiryMonth < 1 || expiryMonth > 12) {
      throw new Error('Invalid expiry month');
    }

    const currentYear = new Date().getFullYear();
    if (!expiryYear || expiryYear < currentYear) {
      throw new Error('Card has expired');
    }

    if (!cvv || !/^\d{3,4}$/.test(cvv)) {
      throw new Error('Invalid CVV');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email address');
    }

    return true;
  }

  /**
   * Generate secure download token
   */
  generateDownloadToken(reportType, reportId, email) {
    const tokenData = {
      reportType,
      reportId,
      email,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.tokenExpiryMs
    };

    // Generate cryptographic hash
    const secret = process.env.DOWNLOAD_TOKEN_SECRET || process.env.NODE_ENV === 'production' ? (() => { throw new Error('DOWNLOAD_TOKEN_SECRET must be set in production'); })() : 'dev-only-download-secret';
    const dataString = JSON.stringify(tokenData);
    const hash = crypto.createHmac('sha256', secret)
      .update(dataString)
      .digest('hex');

    const token = Buffer.from(JSON.stringify({ ...tokenData, hash })).toString('base64');
    
    // Store token (in production: use Redis with TTL)
    this.downloadTokens.set(token, tokenData);
    
    // Auto-cleanup expired token
    setTimeout(() => {
      this.downloadTokens.delete(token);
    }, this.tokenExpiryMs);

    return token;
  }

  /**
   * Validate download token
   */
  validateDownloadToken(token) {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      
      // Check expiry
      if (decoded.expiresAt < Date.now()) {
        logger.warn('Download token expired', { token: token.substring(0, 20) });
        return { valid: false, reason: 'Token expired' };
      }

      // Verify hash
      const secret = process.env.DOWNLOAD_TOKEN_SECRET || process.env.NODE_ENV === 'production' ? (() => { throw new Error('DOWNLOAD_TOKEN_SECRET must be set in production'); })() : 'dev-only-download-secret';
      const { hash, ...tokenData } = decoded;
      const dataString = JSON.stringify(tokenData);
      const expectedHash = crypto.createHmac('sha256', secret)
        .update(dataString)
        .digest('hex');

      if (hash !== expectedHash) {
        logger.warn('Invalid download token hash', { token: token.substring(0, 20) });
        return { valid: false, reason: 'Invalid token' };
      }

      // Check if token exists in storage
      if (!this.downloadTokens.has(token)) {
        logger.warn('Download token not found in storage', { token: token.substring(0, 20) });
        return { valid: false, reason: 'Token not found or already used' };
      }

      logger.info('Download token validated successfully', { 
        reportType: decoded.reportType,
        reportId: decoded.reportId 
      });

      return { 
        valid: true, 
        data: decoded 
      };

    } catch (error) {
      logger.error('Token validation error:', error);
      return { valid: false, reason: 'Invalid token format' };
    }
  }

  /**
   * Invalidate download token (one-time use)
   */
  invalidateToken(token) {
    this.downloadTokens.delete(token);
    logger.info('Download token invalidated', { token: token.substring(0, 20) });
  }

  /**
   * Generate transaction ID
   */
  generateTransactionId() {
    return `TXN-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get pricing information
   */
  getPricing() {
    return {
      pdfPrice: this.pdfPrice,
      currency: this.currency,
      demoMode: this.demoMode,
      testCards: this.demoMode ? this.testCardNumbers : []
    };
  }

  /**
   * Get transaction stats (for admin dashboard)
   */
  getTransactionStats() {
    return {
      activeTokens: this.downloadTokens.size,
      totalRevenue: this.pdfPrice * this.downloadTokens.size, // Simplified
      demoMode: this.demoMode
    };
  }
}

module.exports = new PaymentService();
