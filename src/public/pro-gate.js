/**
 * Site Mechanic - Feature Gating & Value Framing
 * Client-side feature gating for freemium model
 * 
 * FREE TIER INCLUDES:
 * - Single-page scans
 * - Summary scores
 * - Top issues (prioritized)
 * - On-screen viewing
 * 
 * PAID TIER ADDS:
 * - Multi-page crawling
 * - Client-ready reports (PDF, CSV, JSON)
 * - Competitive comparisons
 * - Hosting cost intelligence
 * - Historical scans
 * 
 * EXPORT PHILOSOPHY:
 * Exports are a premium outcome, not a utility.
 * Reports should be:
 * - Client-presentable (professional quality)
 * - Clear (no jargon without explanation)
 * - Minimal (focused, not exhaustive)
 * - Recommendation-focused (what to fix, not raw data)
 * Avoid raw data dumps unless explicitly requested.
 * 
 * UPSELL POLICY:
 * - Do NOT aggressively upsell
 * - Show upgrade prompts ONLY when value is obvious
 * - Never interrupt a user's workflow with an upgrade modal
 * - Prompts should explain what manual work the feature saves
 * 
 * PRINCIPLE: Every paid feature must clearly answer:
 * "What does this save the user from doing manually?"
 */

const ProGate = {
  /**
   * Free tier includes:
   * - Single-page scans with summary scores
   * - Top issues (prioritized by impact)
   * - On-screen viewing of all results
   * - PDF export for dashboard only
   */
  FREE_DIAGNOSTICS: [
    // A. Overview
    'dashboard',
    
    // B. Performance & UX
    'performance-hub',
    'core-web-vitals',
    'performance-analyzer',
    
    // C. SEO & Indexing
    'seo-analyzer',
    
    // D. Accessibility
    'accessibility-analyzer',
    
    // E. Security & Trust
    'security-analyzer',
    
    // G. Infrastructure
    'hosting-analyzer'
  ],

  /**
   * Paid tier adds multi-page, export, and automation features:
   * - Multi-page crawling (full site analysis)
   * - Exports: CSV, JSON, PDF for any tool
   * - Competitive comparisons
   * - Historical scan data
   * - Client-ready report formatting
   */
  PAID_DIAGNOSTICS: [
    // B. Performance & UX (paid: saves device testing)
    'mobile-analyzer',
    'cro-analyzer',
    
    // C. SEO & Indexing (paid: multi-page crawling)
    'site-crawler',
    'tag-intelligence',
    'local-seo',
    'broken-links',
    
    // E. Security & Trust (paid: external service checks)
    'ip-reputation',
    'gdpr-compliance',
    
    // F. Technology (paid: detailed font analysis)
    'enhanced-fonts',
    'brand-consistency',
    
    // H. Competitive (paid: competitor research)
    'competitive-analysis'
  ],

  /**
   * Check if user has PRO access
   * Override this with your actual auth check
   * @returns {boolean}
   */
  isPro() {
    // Check localStorage for demo purposes
    // Replace with actual auth/subscription check
    return localStorage.getItem('siteMechanic_isPro') === 'true';
  },

  /**
   * Set PRO status (for demo/testing)
   * @param {boolean} status
   */
  setPro(status) {
    localStorage.setItem('siteMechanic_isPro', status ? 'true' : 'false');
  },

  /**
   * Check if a diagnostic category is free
   * @param {string} categoryId
   * @returns {boolean}
   */
  isFree(categoryId) {
    // If it's not in the paid list, it's free
    return !this.PAID_DIAGNOSTICS.includes(categoryId);
  },

  /**
   * Check if user can access a diagnostic category
   * @param {string} categoryId
   * @returns {boolean}
   */
  canAccess(categoryId) {
    if (this.isFree(categoryId)) return true;
    return this.isPro();
  },

  /**
   * Get usage limits for current tier
   * Free: Single-page scans, on-screen viewing, summary scores, top issues
   * Paid: Multi-page crawls, all exports, competitive analysis, historical data
   * @returns {object}
   */
  getLimits() {
    if (this.isPro()) {
      return {
        scansPerDay: Infinity,
        pagesPerCrawl: Infinity,
        competitorsPerAnalysis: 10,
        exportFormats: ['pdf', 'json', 'csv'],
        historicalData: true,
        clientReadyReports: true,
        apiAccess: true
      };
    }
    // Free tier: generous for single-page analysis
    return {
      scansPerDay: 25,           // Generous daily limit
      pagesPerCrawl: 1,          // Single-page only (multi-page is paid)
      competitorsPerAnalysis: 0, // Competitive analysis is paid
      exportFormats: [],         // On-screen viewing only (exports are paid)
      historicalData: false,     // Current scan only
      clientReadyReports: false, // Formatting is paid
      apiAccess: false
    };
  },

  /**
   * Track usage for rate limiting
   * @param {string} action
   * @returns {boolean} Whether action is allowed
   */
  trackUsage(action) {
    const today = new Date().toDateString();
    const usageKey = `siteMechanic_usage_${today}`;
    const usage = JSON.parse(localStorage.getItem(usageKey) || '{}');
    
    usage[action] = (usage[action] || 0) + 1;
    localStorage.setItem(usageKey, JSON.stringify(usage));
    
    const limits = this.getLimits();
    if (action === 'scan' && usage.scan > limits.scansPerDay) {
      return false;
    }
    return true;
  },

  /**
   * Get current usage counts
   * @returns {object}
   */
  getUsage() {
    const today = new Date().toDateString();
    const usageKey = `siteMechanic_usage_${today}`;
    return JSON.parse(localStorage.getItem(usageKey) || '{}');
  },

  /**
   * Get the value proposition for a paid feature
   * Answers: "What does this save the user from doing manually?"
   * @param {string} toolId
   * @returns {object} {feature, saves, timeEstimate}
   */
  getFeatureValue(toolId) {
    const features = {
      'mobile-analyzer': {
        name: 'Mobile Testing',
        saves: 'Testing across 50+ real device combinations',
        timeEstimate: '4-6 hours'
      },
      'cro-analyzer': {
        name: 'CRO Analyzer',
        saves: 'Manual UX audits and A/B test planning',
        timeEstimate: '3-5 hours'
      },
      'site-crawler': {
        name: 'Site Crawler',
        saves: 'Manual link checking and broken URL discovery',
        timeEstimate: '8-12 hours'
      },
      'tag-intelligence': {
        name: 'Tracking & Analytics',
        saves: 'Auditing marketing tags and GTM configuration',
        timeEstimate: '3-4 hours'
      },
      'local-seo': {
        name: 'Local SEO Audit',
        saves: 'Manual Google My Business and citation verification',
        timeEstimate: '2-3 hours'
      },
      'broken-links': {
        name: 'Broken Link Detection',
        saves: 'Using external link checking tools and manual testing',
        timeEstimate: '4-6 hours'
      },
      'ip-reputation': {
        name: 'IP Reputation Check',
        saves: 'Manual SMTP tests and external reputation lookups',
        timeEstimate: '1-2 hours'
      },
      'gdpr-compliance': {
        name: 'GDPR Compliance Check',
        saves: 'Legal review and manual compliance research',
        timeEstimate: '5-8 hours'
      },
      'enhanced-fonts': {
        name: 'Font Performance Analysis',
        saves: 'Font licensing research and performance testing',
        timeEstimate: '2-3 hours'
      },
      'brand-consistency': {
        name: 'Brand Consistency Check',
        saves: 'Manual brand guideline verification',
        timeEstimate: '2-4 hours'
      },
      'competitive-analysis': {
        name: 'Competitive Analysis',
        saves: 'Manual competitive research and benchmarking',
        timeEstimate: '6-10 hours'
      },
      'export': {
        name: 'Client-Ready Reports',
        saves: 'Manual formatting, data extraction, and presentation prep for client deliverables',
        timeEstimate: '1-2 hours per report'
      },
      'multi-page': {
        name: 'Multi-Page Crawling',
        saves: 'Running individual scans on each page of your site',
        timeEstimate: '10-20 hours for a full site'
      },
      'historical': {
        name: 'Historical Data',
        saves: 'Tracking changes manually over time',
        timeEstimate: '2-4 hours per month'
      }
    };
    
    return features[toolId] || {
      name: 'Extended Feature',
      saves: 'manual analysis work',
      timeEstimate: 'hours of work'
    };
  },

  /**
   * Render upgrade prompt HTML with value-based framing
   * @param {object} options
   * @returns {string}
   */
  renderUpgradePrompt(options = {}) {
    const { 
      feature = 'this feature',
      toolId = null,
      inline = false,
      dismissable = true 
    } = options;

    // Get feature value if toolId provided
    const featureValue = toolId ? this.getFeatureValue(toolId) : null;
    const featureName = featureValue?.name || feature;
    const timesSaved = featureValue?.timeEstimate || 'significant time';

    if (inline) {
      // Inline prompts are subtle - just a small badge, no aggressive text
      return `
        <div class="pro-gate-inline">
          <span class="pro-gate-badge">Paid</span>
          <span class="pro-gate-text">${featureName}</span>
          <a href="/pricing.html" class="pro-gate-link">View plans</a>
        </div>
      `;
    }

    return `
      <div class="pro-gate-overlay" id="proGateOverlay">
        <div class="pro-gate-modal">
          ${dismissable ? '<button class="pro-gate-close" onclick="ProGate.hideUpgradePrompt()">✕</button>' : ''}
          <div class="pro-gate-icon">⏱️</div>
          <h3 class="pro-gate-title">${featureName}</h3>
          <p class="pro-gate-description">
            ${featureValue ? `This saves you from ${featureValue.saves} (estimated ${timesSaved}).` : 'Automates manual work so you can focus on fixes.'}
          </p>
          <div class="pro-gate-benefits">
            <div class="pro-gate-benefit">
              <div class="benefit-icon">✓</div>
              <div class="benefit-text">Client-ready PDF reports (presentation-quality, minimal, clear)</div>
            </div>
            <div class="pro-gate-benefit">
              <div class="benefit-icon">✓</div>
              <div class="benefit-text">Focused on recommendations (not raw data dumps)</div>
            </div>
            <div class="pro-gate-benefit">
              <div class="benefit-icon">✓</div>
              <div class="benefit-text">Multi-page crawling (analyze your whole site at once)</div>
            </div>
            <div class="pro-gate-benefit">
              <div class="benefit-icon">✓</div>
              <div class="benefit-text">Historical tracking (show clients improvement over time)</div>
            </div>
          </div>
          <div class="pro-gate-actions">
            <a href="/pricing.html" class="pro-gate-btn pro-gate-btn--primary">
              View Plans
            </a>
            ${dismissable ? '<button class="pro-gate-btn pro-gate-btn--secondary" onclick="ProGate.hideUpgradePrompt()">Continue Free</button>' : ''}
          </div>
          <p class="pro-gate-footer">
            Free tier includes single-page scans, summary scores, and on-screen viewing.
          </p>
        </div>
      </div>
    `;
  },

  /**
   * Show upgrade prompt with value-based framing
   * @param {string|object} options - Feature name or options object with {feature, toolId, inline, dismissable}
   */
  showUpgradePrompt(options = {}) {
    // Handle backward compatibility: allow string argument
    if (typeof options === 'string') {
      options = { feature: options };
    }

    // Remove existing overlay if any
    this.hideUpgradePrompt();
    
    const overlay = document.createElement('div');
    overlay.innerHTML = this.renderUpgradePrompt(options);
    document.body.appendChild(overlay.firstElementChild);
  },

  /**
   * Hide upgrade prompt
   */
  hideUpgradePrompt() {
    const overlay = document.getElementById('proGateOverlay');
    if (overlay) overlay.remove();
  },

  /**
   * Gate a feature - shows value-based prompt ONLY when value is obvious
   * POLICY: Do NOT interrupt user workflow. Only show when user explicitly
   * tries to access a paid feature (e.g., clicks export, multi-page crawl)
   * @param {string} toolId
   * @param {Function} callback - Called if access is granted
   */
  gate(toolId, callback) {
    if (this.canAccess(toolId)) {
      callback();
    } else {
      // Only show upgrade prompt when user explicitly requests a paid feature
      // Never show proactively or interrupt workflow
      this.showUpgradePrompt({ 
        feature: this.getToolName(toolId),
        toolId: toolId
      });
    }
  },

  /**
   * Soft gate for exports - allows viewing, prompts only on export action
   * Use this instead of gate() when you want to show results but gate exports
   * @param {Function} viewCallback - Always called (user can view results)
   * @param {Function} exportCallback - Called only if user has export access
   */
  gateExport(viewCallback, exportCallback) {
    // Always allow viewing results (free tier includes on-screen viewing)
    viewCallback();
    
    // Return a function to call when user tries to export
    return () => {
      if (this.isPro()) {
        exportCallback();
      } else {
        this.showUpgradePrompt({
          feature: 'Export & Client Reports',
          toolId: 'export'
        });
      }
    };
  },

  /**
   * Get human-readable tool name
   * @param {string} toolId
   * @returns {string}
   */
  getToolName(toolId) {
    const names = {
      'competitive-analysis': 'Rank Competition',
      'site-crawler': 'Site Crawler',
      'mobile-analyzer': 'Mobile Testing',
      'tag-intelligence': 'Tracking & Analytics',
      'enhanced-fonts': 'Typography Analysis',
      'broken-links': 'Broken Links Checker',
      'local-seo': 'Local SEO Analysis',
      'brand-consistency': 'Brand Audit',
      'cro-analyzer': 'CRO Analysis',
      'gdpr-compliance': 'GDPR Compliance',
      'ip-reputation': 'IP Reputation'
    };
    return names[toolId] || toolId;
  },

  /**
   * Initialize PRO gating on page load
   */
  init() {
    // Add upgrade prompt styles if not present
    if (!document.getElementById('proGateStyles')) {
      const styles = document.createElement('style');
      styles.id = 'proGateStyles';
      styles.textContent = `
        .pro-gate-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(4px);
        }
        .pro-gate-modal {
          background: var(--bg-card, #111);
          border: 1px solid var(--border-color, rgba(255,255,255,0.1));
          border-radius: 16px;
          padding: 2.5rem;
          max-width: 420px;
          text-align: center;
          position: relative;
        }
        .pro-gate-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: none;
          border: none;
          color: var(--color-gray-400);
          font-size: 1.25rem;
          cursor: pointer;
        }
        .pro-gate-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        .pro-gate-title {
          color: var(--color-primary, #00ff41);
          font-size: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .pro-gate-description {
          color: var(--color-gray-300);
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }
        .pro-gate-features {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          text-align: left;
          margin-bottom: 1.5rem;
        }
        .pro-gate-feature {
          color: var(--color-gray-400);
          font-size: 0.875rem;
        }
        .pro-gate-benefits {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          text-align: left;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: rgba(255,255,255,0.02);
          border-radius: 8px;
        }
        .pro-gate-benefit {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
        }
        .benefit-icon {
          color: var(--color-primary, #00ff41);
          font-weight: 700;
          flex-shrink: 0;
          margin-top: 0.125rem;
        }
        .benefit-text {
          color: var(--color-gray-300);
          font-size: 0.9rem;
          line-height: 1.4;
        }
        .pro-gate-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .pro-gate-btn {
          padding: 0.875rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: block;
        }
        .pro-gate-btn--primary {
          background: var(--color-primary, #00ff41);
          color: #000;
          border: none;
        }
        .pro-gate-btn--secondary {
          background: transparent;
          color: var(--color-gray-400);
          border: 1px solid var(--border-color);
        }
        .pro-gate-footer {
          margin-top: 1rem;
          font-size: 0.875rem;
        }
        .pro-gate-footer a {
          color: var(--color-primary, #00ff41);
        }
        .pro-gate-inline {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(255,215,0,0.1);
          border: 1px solid rgba(255,215,0,0.3);
          border-radius: 8px;
        }
        .pro-gate-badge {
          background: linear-gradient(135deg, var(--color-primary, #00ff41), #00bcd4);
          color: #000;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          white-space: nowrap;
        }
        .pro-gate-text {
          color: var(--color-gray-300);
          font-size: 0.875rem;
        }
        .pro-gate-link {
          color: var(--color-primary, #00ff41);
          font-size: 0.875rem;
        }
      `;
      document.head.appendChild(styles);
    }
  }
};

// Auto-initialize
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ProGate.init());
  } else {
    ProGate.init();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProGate;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ProGate = ProGate;
}
