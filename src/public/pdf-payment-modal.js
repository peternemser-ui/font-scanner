/**
 * Payment Modal for PDF Report Purchases
 * Reusable payment form with Stripe-style UI
 */

class PDFPaymentModal {
  constructor() {
    this.modal = null;
    this.reportType = null;
    this.reportData = null;
    this.onSuccess = null;
    this.pricing = null;
    
    this.init();
  }

  async init() {
    // Fetch pricing information
    try {
      const response = await fetch('/api/pdf/pricing');
      const data = await response.json();
      if (data.success) {
        this.pricing = data.pricing;
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
    }

    // Create modal HTML
    this.createModal();
  }

  createModal() {
    const modalHTML = `
      <div id="pdfPaymentModal" class="pdf-payment-modal" style="display: none;">
        <div class="pdf-modal-overlay" onclick="window.pdfPaymentModal.close()"></div>
        <div class="pdf-modal-content">
          <div class="pdf-modal-header">
            <h2>[PURCHASE_PDF_REPORT]</h2>
            <button class="pdf-modal-close" onclick="window.pdfPaymentModal.close()">×</button>
          </div>
          
          <div class="pdf-modal-body">
            <!-- Pricing Section -->
            <div class="pdf-pricing-section">
              <div class="pdf-price-tag">
                <span class="pdf-currency">$</span>
                <span class="pdf-amount">5</span>
                <span class="pdf-period">one-time</span>
              </div>
              <p class="pdf-description">
                Get a comprehensive PDF report with detailed analysis, 
                recommendations, and actionable insights.
              </p>
            </div>

            <!-- Demo Mode Notice -->
            <div id="pdfDemoNotice" class="pdf-demo-notice" style="display: none;">
              <strong>🎯 Demo Mode Active</strong>
              <p>Use test card: <code>4242 4242 4242 4242</code></p>
              <p>Any future expiry date and any 3-digit CVV</p>
            </div>

            <!-- Payment Form -->
            <form id="pdfPaymentForm" class="pdf-payment-form">
              <div class="pdf-form-group">
                <label for="pdfEmail">Email Address *</label>
                <input 
                  type="email" 
                  id="pdfEmail" 
                  required 
                  placeholder="your.email@example.com"
                  autocomplete="email"
                />
              </div>

              <div class="pdf-form-group">
                <label for="pdfCardNumber">Card Number *</label>
                <input 
                  type="text" 
                  id="pdfCardNumber" 
                  required 
                  placeholder="4242 4242 4242 4242"
                  maxlength="19"
                  autocomplete="cc-number"
                />
              </div>

              <div class="pdf-form-row">
                <div class="pdf-form-group">
                  <label for="pdfExpiryMonth">Expiry Month *</label>
                  <select id="pdfExpiryMonth" required autocomplete="cc-exp-month">
                    <option value="">MM</option>
                    ${Array.from({length: 12}, (_, i) => {
                      const month = String(i + 1).padStart(2, '0');
                      return `<option value="${month}">${month}</option>`;
                    }).join('')}
                  </select>
                </div>

                <div class="pdf-form-group">
                  <label for="pdfExpiryYear">Expiry Year *</label>
                  <select id="pdfExpiryYear" required autocomplete="cc-exp-year">
                    <option value="">YYYY</option>
                    ${Array.from({length: 15}, (_, i) => {
                      const year = new Date().getFullYear() + i;
                      return `<option value="${year}">${year}</option>`;
                    }).join('')}
                  </select>
                </div>

                <div class="pdf-form-group">
                  <label for="pdfCVV">CVV *</label>
                  <input 
                    type="text" 
                    id="pdfCVV" 
                    required 
                    placeholder="123"
                    maxlength="4"
                    autocomplete="cc-csc"
                  />
                </div>
              </div>

              <div class="pdf-form-group pdf-checkbox-group">
                <label>
                  <input type="checkbox" id="pdfTerms" required />
                  I agree to the terms and conditions
                </label>
              </div>

              <button type="submit" class="pdf-submit-button" id="pdfSubmitButton">
                <span id="pdfSubmitText">Purchase & Download PDF ($5)</span>
                <span id="pdfSubmitSpinner" class="pdf-spinner" style="display: none;">Processing...</span>
              </button>
            </form>

            <!-- Error Message -->
            <div id="pdfErrorMessage" class="pdf-error-message" style="display: none;"></div>

            <!-- Success Message -->
            <div id="pdfSuccessMessage" class="pdf-success-message" style="display: none;">
              <div class="pdf-success-icon">✓</div>
              <h3>Payment Successful!</h3>
              <p>Your PDF report is being downloaded...</p>
            </div>
          </div>

          <div class="pdf-modal-footer">
            <div class="pdf-security-badges">
              <span>🔒 Secure Payment</span>
              <span>💳 All Major Cards</span>
              <span>📧 Receipt Sent</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Inject modal into DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    this.modal = document.getElementById('pdfPaymentModal');

    // Attach event listeners
    this.attachEventListeners();
  }

  attachEventListeners() {
    const form = document.getElementById('pdfPaymentForm');
    form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Auto-format card number
    const cardInput = document.getElementById('pdfCardNumber');
    cardInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\s/g, '');
      let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
      e.target.value = formattedValue;
    });

    // CVV numeric only
    const cvvInput = document.getElementById('pdfCVV');
    cvvInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
  }

  open(reportType, reportData, onSuccess) {
    this.reportType = reportType;
    this.reportData = reportData;
    this.onSuccess = onSuccess;

    // Show demo notice if in demo mode
    if (this.pricing && this.pricing.demoMode) {
      document.getElementById('pdfDemoNotice').style.display = 'block';
    }

    // Reset form
    this.resetForm();

    // Show modal
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.modal.style.display = 'none';
    document.body.style.overflow = '';
    this.resetForm();
  }

  resetForm() {
    document.getElementById('pdfPaymentForm').reset();
    document.getElementById('pdfErrorMessage').style.display = 'none';
    document.getElementById('pdfSuccessMessage').style.display = 'none';
    document.getElementById('pdfSubmitButton').disabled = false;
    document.getElementById('pdfSubmitText').style.display = 'inline';
    document.getElementById('pdfSubmitSpinner').style.display = 'none';
  }

  async handleSubmit(event) {
    event.preventDefault();

    // Show loading state
    const submitButton = document.getElementById('pdfSubmitButton');
    const submitText = document.getElementById('pdfSubmitText');
    const submitSpinner = document.getElementById('pdfSubmitSpinner');
    const errorMessage = document.getElementById('pdfErrorMessage');

    submitButton.disabled = true;
    submitText.style.display = 'none';
    submitSpinner.style.display = 'inline';
    errorMessage.style.display = 'none';

    // Get form data
    const formData = {
      email: document.getElementById('pdfEmail').value,
      cardNumber: document.getElementById('pdfCardNumber').value.replace(/\s/g, ''),
      expiryMonth: parseInt(document.getElementById('pdfExpiryMonth').value),
      expiryYear: parseInt(document.getElementById('pdfExpiryYear').value),
      cvv: document.getElementById('pdfCVV').value,
      reportType: this.reportType,
      reportData: this.reportData
    };

    try {
      // Process payment
      const response = await fetch('/api/pdf/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Payment failed');
      }

      // Payment successful - show success message
      document.getElementById('pdfPaymentForm').style.display = 'none';
      document.getElementById('pdfSuccessMessage').style.display = 'block';

      // Download PDF
      this.downloadPDF(result.downloadToken);

      // Call success callback
      if (this.onSuccess) {
        this.onSuccess(result);
      }

      // Auto-close after 3 seconds
      setTimeout(() => {
        this.close();
      }, 3000);

    } catch (error) {
      console.error('Payment error:', error);
      
      // Show error message
      errorMessage.textContent = error.message || 'Payment failed. Please try again.';
      errorMessage.style.display = 'block';

      // Re-enable button
      submitButton.disabled = false;
      submitText.style.display = 'inline';
      submitSpinner.style.display = 'none';
    }
  }

  downloadPDF(token) {
    // Create hidden link and trigger download
    const downloadUrl = `/api/pdf/download/${token}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${this.reportType}-analysis-report.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Initialize global payment modal
window.pdfPaymentModal = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pdfPaymentModal = new PDFPaymentModal();
  });
} else {
  window.pdfPaymentModal = new PDFPaymentModal();
}
