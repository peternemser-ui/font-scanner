(function(window) {
  function createSection({ id, title, scoreTextRight = '—', isPro = false, locked = false, contentHTML = '' }) {
    return `
      <div class="report-accordion" data-accordion-id="${id}">
        <button class="report-accordion__header" type="button" data-accordion-toggle="${id}">
          <div class="report-accordion__title">${title}</div>
          <div class="report-accordion__meta">
            ${isPro ? '<span class="report-accordion__pro-pill">PRO</span>' : ''}
            ${scoreTextRight && scoreTextRight !== '—' ? `<span>${scoreTextRight}</span>` : ''}
            <span class="report-accordion__chevron">▾</span>
          </div>
        </button>
        <div class="report-accordion__body" data-accordion-body="${id}">
          ${locked ? `<div class="report-shell__lock-overlay"><div class="is-locked">${contentHTML}</div><button class="report-shell__lock-cta" data-pro-unlock>Unlock in Pro Report ($5 USD)</button></div>` : contentHTML}
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
      if (chevron) chevron.classList.toggle('report-accordion__chevron--open', !isOpen);
    });

    document.addEventListener('click', (e) => {
      const unlockBtn = e.target.closest('[data-pro-unlock]');
      if (!unlockBtn) return;
      if (typeof window.openProPaywall === 'function') {
        window.openProPaywall({ domain: window.location.hostname, context: 'performance' });
      } else {
        alert('Unlock in Pro Report ($5 USD)');
      }
    });
  }

  window.ReportAccordion = {
    createSection,
    initInteractions
  };
})(window);
