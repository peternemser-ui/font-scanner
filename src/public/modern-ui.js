/**
 * Modern UI Enhancements
 * Summary Ribbon, Quick Navigation, and Interactive Elements
 */

class ModernUI {
  constructor() {
    this.summaryRibbon = document.getElementById('summaryRibbon');
    this.quickNav = document.getElementById('quickNav');
    this.quickNavToggle = document.getElementById('quickNavToggle');
    this.quickNavContent = document.getElementById('quickNavContent');
    this.lastScanTime = new Date();
    
    this.init();
  }

  init() {
    // Initialize quick navigation toggle
    if (this.quickNavToggle && this.quickNav) {
      this.quickNavToggle.addEventListener('click', () => this.toggleQuickNav());
    }

    // Smooth scroll for quick nav links
    this.setupSmoothScroll();

    // Setup ribbon action buttons
    this.setupRibbonActions();

    // Update last scan time periodically
    this.updateLastScanTime();
    setInterval(() => this.updateLastScanTime(), 60000); // Update every minute
  }

  /**
   * Show summary ribbon with health data
   */
  showSummaryRibbon(healthScore, grade) {
    if (!this.summaryRibbon) return;

    const scoreElement = document.getElementById('ribbonHealthScore');
    if (scoreElement) {
      scoreElement.textContent = `${healthScore} (${grade})`;
      scoreElement.className = `summary-value ${this.getScoreClass(healthScore)}`;
    }

    this.summaryRibbon.classList.remove('hidden');
    this.lastScanTime = new Date();
    this.updateLastScanTime();
  }

  /**
   * Show quick navigation panel
   */
  showQuickNav() {
    if (!this.quickNav) return;
    this.quickNav.classList.remove('hidden');
  }

  /**
   * Toggle quick navigation collapse state
   */
  toggleQuickNav() {
    if (!this.quickNav) return;
    this.quickNav.classList.toggle('collapsed');
  }

  /**
   * Setup smooth scroll for navigation links
   */
  setupSmoothScroll() {
    const navLinks = document.querySelectorAll('.quick-nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        
        // Skip if it's an external link or page navigation
        if (href.includes('.html')) return;
        
        e.preventDefault();
        const targetId = href.replace('#', '');
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          
          // Add highlight animation
          this.highlightSection(targetElement);
        }
      });
    });
  }

  /**
   * Highlight a section when navigated to
   */
  highlightSection(element) {
    element.style.animation = 'pulse 1s ease-out';
    setTimeout(() => {
      element.style.animation = '';
    }, 1000);
  }

  /**
   * Setup ribbon action buttons
   */
  setupRibbonActions() {
    const downloadBtn = document.getElementById('ribbonDownloadPDF');
    const shareBtn = document.getElementById('ribbonShareReport');

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.handleDownloadPDF());
    }

    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.handleShareReport());
    }
  }

  /**
   * Handle PDF download
   */
  handleDownloadPDF() {
    // Trigger existing PDF download functionality
    const existingDownloadBtn = document.querySelector('.download-button, #downloadPdfButton');
    if (existingDownloadBtn) {
      existingDownloadBtn.click();
    } else {
      // Fallback - show payment modal if it exists
      const pdfPaymentModal = document.getElementById('pdfPaymentModal');
      if (pdfPaymentModal && typeof openPDFPaymentModal === 'function') {
        openPDFPaymentModal();
      } else {
        alert('PDF download functionality will be available after analysis completes.');
      }
    }
  }

  /**
   * Handle share report
   */
  handleShareReport() {
    const currentUrl = window.location.href;
    const shareText = 'Check out my website analysis report from Site Mechanic!';

    // Use Web Share API if available
    if (navigator.share) {
      navigator.share({
        title: 'Site Mechanic Report',
        text: shareText,
        url: currentUrl
      }).catch((error) => {
        this.fallbackShare(currentUrl);
      });
    } else {
      this.fallbackShare(currentUrl);
    }
  }

  /**
   * Fallback share - copy to clipboard
   */
  fallbackShare(url) {
    navigator.clipboard.writeText(url).then(() => {
      this.showToast('Link copied to clipboard! 🔗', 'success');
    }).catch(() => {
      // If clipboard API fails, show a prompt
      prompt('Copy this link to share:', url);
    });
  }

  /**
   * Update last scan time display
   */
  updateLastScanTime() {
    const lastScanElement = document.getElementById('ribbonLastScan');
    if (!lastScanElement) return;

    const now = new Date();
    const diffMs = now - this.lastScanTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timeText;
    if (diffMins < 1) {
      timeText = 'Just now';
    } else if (diffMins < 60) {
      timeText = `${diffMins}m ago`;
    } else if (diffHours < 24) {
      timeText = `${diffHours}h ago`;
    } else {
      timeText = `${diffDays}d ago`;
    }

    lastScanElement.textContent = timeText;
  }

  /**
   * Get CSS class for score
   */
  getScoreClass(score) {
    if (score >= 90) return 'score-excellent';
    if (score >= 70) return 'score-good';
    if (score >= 50) return 'score-fair';
    return 'score-poor';
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: var(--bg-secondary);
      color: var(--text-primary);
      padding: 1rem 1.5rem;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-primary);
      box-shadow: var(--shadow-lg);
      z-index: 10000;
      animation: slideInFromBottom 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutToBottom 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Add number counter animation
   */
  animateNumber(element, targetValue, duration = 1000) {
    const startValue = 0;
    const startTime = Date.now();

    const update = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOut);

      element.textContent = currentValue;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = targetValue;
      }
    };

    requestAnimationFrame(update);
  }

  /**
   * Add pulse animation to element
   */
  pulseElement(element) {
    element.style.animation = 'pulse 0.5s ease-out';
    setTimeout(() => {
      element.style.animation = '';
    }, 500);
  }
}

// Add toast animations to CSS dynamically
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInFromBottom {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideOutToBottom {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(20px);
    }
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.modernUI = new ModernUI();
  });
} else {
  window.modernUI = new ModernUI();
}
