(function(window) {
  // Translation helper
  const t = (key, fallback) => (window.t ? window.t(key, fallback) : (window.i18n && window.i18n.t ? window.i18n.t(key) || fallback : fallback));

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

  function getScoreColorClass(scoreTextRight) {
    if (scoreTextRight === null || scoreTextRight === undefined) return '';

    let numericScore = null;

    if (typeof scoreTextRight === 'number' && !Number.isNaN(scoreTextRight)) {
      numericScore = scoreTextRight;
    } else {
      const s = String(scoreTextRight).trim();
      // Extract number from formats like "85/100" or "85"
      const match = s.match(/^(\d{1,3})(?:\/\d+)?$/);
      if (match) {
        numericScore = parseInt(match[1], 10);
      }
    }

    if (numericScore === null) return '';

    // Color thresholds: 80+ green, 50-79 yellow, 0-49 red
    if (numericScore >= 80) return 'report-accordion__score-badge--good';
    if (numericScore >= 50) return 'report-accordion__score-badge--warning';
    return 'report-accordion__score-badge--poor';
  }

  function getSeverity(scoreTextRight) {
    if (scoreTextRight === null || scoreTextRight === undefined) return '';
    let n = null;
    if (typeof scoreTextRight === 'number' && !Number.isNaN(scoreTextRight)) {
      n = scoreTextRight;
    } else {
      const m = String(scoreTextRight).trim().match(/^(\d{1,3})(?:\/\d+)?$/);
      if (m) n = parseInt(m[1], 10);
    }
    if (n === null) return '';
    if (n >= 80) return 'good';
    if (n >= 50) return 'warn';
    return 'bad';
  }

  function createSection({ id, title, scoreTextRight = '—', isPro = false, locked = false, contentHTML = '', context = 'report', reportId = null }) {
    const safeId = safeDomId(id);
    const headerId = `report-accordion-header-${safeId}`;
    const bodyId = `report-accordion-body-${safeId}`;
    const formattedScore = formatScoreText(scoreTextRight);
    const scoreColorClass = getScoreColorClass(scoreTextRight);
    const severity = getSeverity(scoreTextRight);
    const cardHTML = (function() {
      if (!locked) return '';

      // Use ProReportBlock if available
      if (window.ProReportBlock && typeof window.ProReportBlock.renderUnlockPrompt === 'function') {
        return window.ProReportBlock.renderUnlockPrompt({ context, reportId });
      }

      // Fallback markup - new billing model (no credits)
      return `
        <div class="pro-report-block__unlock-prompt" data-locked-overlay>
          <div class="pro-report-block__unlock-header">
            <span class="pro-report-block__unlock-icon">🔒</span>
            <span class="pro-report-block__unlock-text">${t('reports.common.unlockThisReport', 'Unlock this report')}</span>
          </div>
          <div class="pro-report-block__unlock-buttons">
            <button class="pro-report-block__unlock-btn pro-report-block__unlock-btn--primary" data-buy-single-report data-context="${context}" ${reportId ? `data-report-id="${reportId}"` : ''}>
              ${t('reports.common.unlockFor5', 'Unlock for $5')}
            </button>
            <button class="pro-report-block__unlock-btn pro-report-block__unlock-btn--secondary" data-open-pricing-modal data-context="${context}">
              ${t('reports.common.goPro30', 'Go Pro — $30/mo')}
            </button>
          </div>
          <p class="pro-report-block__unlock-hint">
            ${t('reports.common.proUnlocksAll', 'Pro unlocks all reports. Single purchase unlocks only this scan.')}
          </p>
        </div>
      `;
    })();

    return `
      <div class="report-accordion" data-accordion-id="${safeId}"${severity ? ` data-severity="${severity}"` : ''}>
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
            ${formattedScore && formattedScore !== '—' ? `<span class="report-accordion__score-badge ${scoreColorClass}">${formattedScore}</span>` : ''}
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
          ${locked ? `<div class="report-shell__lock-overlay"><div class="report-shell__lock-paywall" data-paid-unlock-card>${cardHTML}</div></div>` : contentHTML}
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

    // Print mode: auto-expand all accordions for PDF capture
    if (new URLSearchParams(window.location.search).get('print') === '1') {
      document.querySelectorAll('[data-accordion-body]').forEach(body => {
        body.classList.add('report-accordion__body--open');
        body.removeAttribute('hidden');
        const id = body.getAttribute('data-accordion-body');
        const header = document.querySelector(`[data-accordion-toggle="${id}"]`);
        if (header) {
          header.setAttribute('aria-expanded', 'true');
          const chevron = header.querySelector('.report-accordion__chevron');
          if (chevron) chevron.classList.add('report-accordion__chevron--open');
        }
      });
    }
  }

  window.ReportAccordion = {
    createSection,
    initInteractions
  };
})(window);
