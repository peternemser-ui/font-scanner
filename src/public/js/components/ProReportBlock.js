/**
 * Site Mechanic - Pro Report Block Component
 * Conversion-focused export & upgrade CTA
 *
 * Replaces all "Take Action" blocks with consistent, professional UI
 * that clearly communicates value proposition
 */

(function(window) {
  /**
   * PaidUnlockCard
   * Reusable paywall UI for per-report unlock (no accounts).
   * Driven by CreditsManager.renderPaywallState().
   */
  function renderPaidUnlockCard(options = {}) {
    const {
      context = 'report',
      reportId = null,
      credits = 0
    } = options;

    // Render both primary buttons; CreditsManager toggles visibility.
    const showCredit = credits >= 1;

    return `
      <div class="pro-report-block__upgrade-prompt" data-locked-overlay>
        <div class="pro-report-block__credit-info">
          <span class="pro-report-block__credit-balance">
            <span data-credits-label>${showCredit ? 'Credits available:' : 'Credits:'}</span>
            <span data-credit-balance>${credits}</span>
          </span>
        </div>
        <div class="pro-report-block__cta-buttons">
          <button
            class="pro-report-block__upgrade-button pro-report-block__upgrade-button--primary"
            data-unlock-with-credit
            data-context="${context}"
            ${reportId ? `data-report-id="${reportId}"` : ''}
            style="display:${showCredit ? 'inline-flex' : 'none'}"
          >
            Unlock with 1 credit
          </button>
          <button
            class="pro-report-block__upgrade-button pro-report-block__upgrade-button--primary"
            data-buy-single-report
            data-context="${context}"
            ${reportId ? `data-report-id="${reportId}"` : ''}
            style="display:${showCredit ? 'none' : 'inline-flex'}"
          >
            Buy single report — $10
          </button>
          <button class="pro-report-block__upgrade-button pro-report-block__upgrade-button--secondary" data-open-pricing-modal>
            Buy credits & save
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Feature labels for different export formats
   */
  const FEATURE_LABELS = {
    pdf: {
      icon: '📄',
      label: 'Export PDF',
      description: 'Client-ready report'
    },
    excel: {
      icon: '📗',
      label: 'Export Excel',
      description: 'Spreadsheet data'
    },
    csv: {
      icon: '📊',
      label: 'Export CSV',
      description: 'Raw data export'
    },
    json: {
      icon: '🔧',
      label: 'Export JSON',
      description: 'API integration'
    },
    share: {
      icon: '🔗',
      label: 'Share Link',
      description: 'Shareable URL'
    },
    compare: {
      icon: '⚖️',
      label: 'Compare',
      description: 'Historical trends'
    },
    schedule: {
      icon: '📅',
      label: 'Schedule Scan',
      description: 'Automated reports'
    }
  };

  /**
   * Check if user has Pro access or if current report is unlocked
   * @param {string} reportId - Optional report identifier
   */
  function isPro(reportId) {
    // Check demo domains first (for testing with vail.com etc.)
    if (window.ProAccess && typeof window.ProAccess.isDemoDomain === 'function' && window.ProAccess.isDemoDomain()) {
      return true;
    }

    // Check if specific report is unlocked via credits
    if (reportId && window.CreditsManager) {
      if (
        (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) ||
        (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId))
      ) {
        return true;
      }
    }

    // Check legacy Pro access (for backwards compatibility)
    if (window.ProGate && typeof window.ProGate.isPro === 'function') {
      return window.ProGate.isPro();
    }
    if (window.proManager && typeof window.proManager.isPro === 'function') {
      return window.proManager.isPro();
    }

    return false;
  }

  /**
   * Get user's credit balance
   */
  function getCredits() {
    if (window.CreditsManager) {
      return window.CreditsManager.getCredits();
    }
    // Fallback for legacy system
    const credits = localStorage.getItem('user_credits');
    return credits ? parseInt(credits, 10) : 0;
  }

  /**
   * Set user's credit balance
   */
  function setCredits(amount) {
    if (window.CreditsManager) {
      window.CreditsManager.setCredits(amount);
    } else {
      // Fallback for legacy system
      const safe = Math.max(0, parseInt(amount, 10) || 0);
      localStorage.setItem('user_credits', safe.toString());
    }
  }

  /**
   * Use one credit to unlock current report
   * @param {string} reportId - Report identifier to unlock
   */
  function useCredit(reportId) {
    if (window.CreditsManager) {
      try {
        window.CreditsManager.consumeCredit();
        if (reportId) {
          window.CreditsManager.unlockReport(reportId, 'credit');
        }
        return true;
      } catch (e) {
        return false;
      }
    } else {
      // Fallback for legacy system
      const credits = getCredits();
      if (credits >= 1) {
        setCredits(credits - 1);
        return true;
      }
      return false;
    }
  }

  /**
   * Render individual action button
   */
  function renderActionButton(feature, context, reportId) {
    const featureData = FEATURE_LABELS[feature];
    if (!featureData) return '';

    const userIsPro = isPro(reportId);
    const handler = feature === 'pdf' ? 'exportPDF' :
                    feature === 'excel' ? 'exportExcel' :
                    feature === 'csv' ? 'exportCSV' :
                    feature === 'json' ? 'exportJSON' :
                    feature === 'share' ? 'shareResults' : null;

    if (userIsPro) {
      // User has Pro or report is unlocked - show functional export button
      return `
        <button class="pro-report-block__action" data-export="${feature}" ${handler ? `data-handler="${handler}"` : ''} ${reportId ? `data-report-id="${reportId}"` : ''}>
          <span class="pro-report-block__action-icon">${featureData.icon}</span>
          <div class="pro-report-block__action-text">
            <div class="pro-report-block__action-label">${featureData.label}</div>
            <div class="pro-report-block__action-description">${featureData.description}</div>
          </div>
        </button>
      `;
    } else {
      // User is Free and report is locked - show locked state with upgrade prompt
      return `
        <button class="pro-report-block__action pro-report-block__action--locked" data-pro-unlock data-context="${context}" data-requires-unlock ${reportId ? `data-report-id="${reportId}"` : ''} disabled>
          <span class="pro-report-block__action-icon">${featureData.icon}</span>
          <div class="pro-report-block__action-text">
            <div class="pro-report-block__action-label">${featureData.label}</div>
            <div class="pro-report-block__action-description">${featureData.description}</div>
          </div>
          <span class="pro-report-block__lock-badge">PRO</span>
        </button>
      `;
    }
  }

  /**
   * Render Pro Report Block
   */
  function render(options = {}) {
    const {
      context = 'report',
      features = ['pdf', 'csv', 'share'],
      title = 'Unlock Report',
      subtitle = 'PDF export, share link, export data, and fix packs for this scan.',
      showBadge = true,
      reportId = null // Unique report identifier for unlock tracking
    } = options;

    const userIsPro = isPro(reportId);
    const credits = getCredits();

    return `
      <div class="pro-report-block" data-pro-report-block ${reportId ? `data-report-id="${reportId}"` : ''}>
        <div class="pro-report-block__header">
          <div class="pro-report-block__icon">📊</div>
          <div class="pro-report-block__text">
            <h3 class="pro-report-block__title">
              ${title}
              ${showBadge ? `<span class="pro-report-block__user-badge" data-unlocked-badge style="display:${userIsPro ? 'inline-flex' : 'none'}">Unlocked</span>` : ''}
            </h3>
            <p class="pro-report-block__subtitle">${subtitle}</p>
            <p class="pro-report-block__subtitle" data-unlocked-method style="display:${userIsPro ? 'block' : 'none'}"></p>
          </div>
        </div>
        <div class="pro-report-block__actions">
          ${features.map(feature => renderActionButton(feature, context, reportId)).join('')}
        </div>
        ${!userIsPro ? renderPaidUnlockCard({ context, reportId, credits }) : ''}
      </div>
    `;
  }

  /**
   * Render compact version (for sidebar or footer)
   */
  function renderCompact(options = {}) {
    const {
      context = 'report',
      features = ['pdf']
    } = options;

    const userIsPro = isPro();

    if (userIsPro) {
      // Show single export button for Pro users
      return `
        <div class="pro-report-block pro-report-block--compact">
          ${features.map(feature => renderActionButton(feature, context)).join('')}
        </div>
      `;
    } else {
      // Show upgrade CTA for Free users
      return `
        <div class="pro-report-block pro-report-block--compact pro-report-block--locked">
          <button class="pro-report-block__upgrade-button pro-report-block__upgrade-button--compact" data-pro-unlock data-context="${context}">
            <span>📄</span>
            <span>Unlock Report</span>
          </button>
        </div>
      `;
    }
  }

  /**
   * Render minimal version (just the upgrade CTA)
   */
  function renderMinimal(options = {}) {
    const {
      context = 'report',
      text = 'Unlock Report'
    } = options;

    const userIsPro = isPro();

    if (userIsPro) {
      return `
        <div class="pro-report-block pro-report-block--minimal">
          <span class="pro-report-block__user-badge">PRO</span>
        </div>
      `;
    } else {
      return `
        <div class="pro-report-block pro-report-block--minimal">
          <button class="pro-report-block__upgrade-button pro-report-block__upgrade-button--minimal" data-pro-unlock data-context="${context}">
            ${text}
          </button>
        </div>
      `;
    }
  }

  /**
   * Value proposition messaging for different contexts
   */
  const VALUE_PROPS = {
    performance: 'Turn performance data into client-ready reports',
    seo: 'Share SEO insights with your team or clients',
    accessibility: 'Document WCAG compliance for stakeholders',
    security: 'Export security findings for remediation',
    mobile: 'Compare mobile vs desktop screenshots',
    cro: 'Track conversion optimization over time',
    fonts: 'Document font usage across your site',
    brand: 'Verify brand consistency at scale',
    default: 'Professional reports your clients will love'
  };

  /**
   * Get value proposition for context
   */
  function getValueProp(context) {
    return VALUE_PROPS[context] || VALUE_PROPS.default;
  }

  // Public API
  window.PaidUnlockCard = {
    render: renderPaidUnlockCard
  };

  window.ProReportBlock = {
    render,
    renderCompact,
    renderMinimal,
    getValueProp,
    isPro,

    // Credit management
    getCredits,
    setCredits,
    useCredit,

    // Feature labels (for custom implementations)
    FEATURE_LABELS,
    VALUE_PROPS
  };

})(window);
