(function(window) {
  function safeDomId(input) {
    const raw = String(input || '').trim();
    const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
    return sanitized || `section-${Math.random().toString(16).slice(2)}`;
  }

  function formatScoreText(scoreTextRight) {
    if (scoreTextRight === null || scoreTextRight === undefined) return '—';
    if (typeof scoreTextRight === 'number' && !Number.isNaN(scoreTextRight)) {
      const n = Math.max(0, Math.min(100, Math.round(scoreTextRight)));
      return `${n}/100`;
    }

    const s = String(scoreTextRight).trim();
    if (!s || s === '—') return '—';
    if (s.includes('/')) return s;
    if (/^\d{1,3}$/.test(s)) {
      const n = Math.max(0, Math.min(100, Math.round(Number(s))));
      return `${n}/100`;
    }
    return s;
  }

  function createSection({ id, title, scoreTextRight = '—', isPro = false, locked = false, contentHTML = '', context = 'report', reportId = null }) {
    const safeId = safeDomId(id);
    const headerId = `report-accordion-header-${safeId}`;
    const bodyId = `report-accordion-body-${safeId}`;
    const formattedScore = formatScoreText(scoreTextRight);
    const cardHTML = (function() {
      if (!locked) return '';
      if (window.PaidUnlockCard && typeof window.PaidUnlockCard.render === 'function') {
        return window.PaidUnlockCard.render({
          context,
          reportId,
          credits: 0
        });
      }

      // Fallback markup (keeps event handlers working)
      return `
        <div class="pro-report-block__upgrade-prompt" data-locked-overlay>
          <div class="pro-report-block__credit-info">
            <span class="pro-report-block__credit-balance"><span data-credits-label>Credits:</span> <span data-credit-balance>0</span></span>
          </div>
          <div class="pro-report-block__cta-buttons">
            <button class="pro-report-block__upgrade-button pro-report-block__upgrade-button--primary" data-buy-single-report ${reportId ? `data-report-id="${reportId}"` : ''} data-context="${context}">Buy single report — $10</button>
            <button class="pro-report-block__upgrade-button pro-report-block__upgrade-button--secondary" data-open-pricing-modal>Buy credits & save</button>
          </div>
        </div>
      `;
    })();

    return `
      <div class="report-accordion" data-accordion-id="${safeId}">
        <button
          class="report-accordion__header"
          id="${headerId}"
          type="button"
          data-accordion-toggle="${safeId}"
          aria-expanded="false"
          aria-controls="${bodyId}"
        >
          <div class="report-accordion__title">${title}</div>
          <div class="report-accordion__meta">
            ${isPro ? '<span class="report-accordion__pro-pill">PRO</span>' : ''}
            ${formattedScore && formattedScore !== '—' ? `<span class="report-accordion__score-badge">${formattedScore}</span>` : ''}
            <span class="report-accordion__chevron">▾</span>
          </div>
        </button>
        <div
          class="report-accordion__body"
          id="${bodyId}"
          role="region"
          aria-labelledby="${headerId}"
          data-accordion-body="${safeId}"
          hidden
        >
          ${locked ? `<div class="report-shell__lock-overlay"><div class="is-locked">${contentHTML}</div><div class="report-shell__lock-paywall" data-paid-unlock-card data-hide-when-unlocked>${cardHTML}</div></div>` : contentHTML}
        </div>
      </div>
    `;
  }

  function initInteractions() {
    if (window.__reportAccordionInitialized) return;
    window.__reportAccordionInitialized = true;
    document.addEventListener('click', (e) => {
      const header = e.target.closest('[data-accordion-toggle]');
      if (!header) return;
      const id = header.getAttribute('data-accordion-toggle');
      const body = document.querySelector(`[data-accordion-body="${id}"]`);
      if (!body) return;
      const chevron = header.querySelector('.report-accordion__chevron');
      const isOpen = body.classList.contains('report-accordion__body--open');
      body.classList.toggle('report-accordion__body--open');
      body.toggleAttribute('hidden', isOpen);
      header.setAttribute('aria-expanded', String(!isOpen));
      if (chevron) chevron.classList.toggle('report-accordion__chevron--open', !isOpen);
    });

  }

  window.ReportAccordion = {
    createSection,
    initInteractions
  };
})(window);
