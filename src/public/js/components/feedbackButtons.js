/**
 * FeedbackButtons — thumbs up/down on recommendations
 * Event-delegated, POSTs to /api/feedback
 */
(function(window) {
  const t = (key, fallback) => (window.t ? window.t(key, fallback) : (window.i18n && window.i18n.t ? window.i18n.t(key) || fallback : fallback));

  /**
   * Render inline thumbs up/down HTML
   * @param {string} reportId
   * @param {string} recId - recommendation ID
   * @param {string} type - 'static' or 'ai'
   * @param {number|null} userVote - existing vote (+1 or -1)
   */
  function render(reportId, recId, type, userVote) {
    const upActive = userVote === 1 ? ' feedback-btn--active' : '';
    const downActive = userVote === -1 ? ' feedback-btn--active' : '';
    const upLabel = t('reports.common.markHelpful', 'Mark as helpful');
    const downLabel = t('reports.common.markNotHelpful', 'Mark as not helpful');

    return `<div class="feedback-buttons" data-feedback-report="${reportId}" data-feedback-rec="${recId}" data-feedback-type="${type}">
      <button class="feedback-btn feedback-btn--up${upActive}" data-feedback-vote="1" aria-label="${upLabel}" title="${upLabel}">
        <span class="feedback-btn__icon">👍</span>
        <span class="feedback-btn__label">${t('reports.common.helpful', 'Helpful')}</span>
      </button>
      <button class="feedback-btn feedback-btn--down${downActive}" data-feedback-vote="-1" aria-label="${downLabel}" title="${downLabel}">
        <span class="feedback-btn__icon">👎</span>
        <span class="feedback-btn__label">${t('reports.common.notHelpful', 'Not helpful')}</span>
      </button>
    </div>`;
  }

  /**
   * Initialize event-delegated click handlers for feedback buttons
   */
  function initFeedbackListeners() {
    document.addEventListener('click', async function(e) {
      const btn = e.target.closest('[data-feedback-vote]');
      if (!btn) return;

      const container = btn.closest('.feedback-buttons');
      if (!container) return;

      const reportId = container.getAttribute('data-feedback-report');
      const recId = container.getAttribute('data-feedback-rec');
      const type = container.getAttribute('data-feedback-type') || 'static';
      const vote = parseInt(btn.getAttribute('data-feedback-vote'), 10);

      if (!reportId || !recId || isNaN(vote)) return;

      // Optimistic UI update
      container.querySelectorAll('.feedback-btn').forEach(b => b.classList.remove('feedback-btn--active'));
      btn.classList.add('feedback-btn--active');

      try {
        const resp = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reportId, recommendationId: recId, recommendationType: type, vote }),
        });

        if (!resp.ok) {
          // Revert on failure
          btn.classList.remove('feedback-btn--active');
        }
      } catch {
        btn.classList.remove('feedback-btn--active');
      }
    });
  }

  window.FeedbackButtons = {
    render,
    initFeedbackListeners,
  };
})(window);
