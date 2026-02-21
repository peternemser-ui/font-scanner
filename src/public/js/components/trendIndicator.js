/**
 * TrendIndicator — delta badges for score changes and percentile rankings
 * Used by all report scripts to show trend data on summary donuts.
 */
(function(window) {
  const t = (key, fallback) => (window.t ? window.t(key, fallback) : (window.i18n && window.i18n.t ? window.i18n.t(key) || fallback : fallback));

  /**
   * Render a delta badge (e.g., "+12" with up arrow, "-5" with down arrow)
   */
  function renderDelta(delta, label) {
    if (delta == null || isNaN(delta)) return '';
    const sign = delta > 0 ? '+' : '';
    const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
    const ariaLabel = label
      ? `${label}: ${sign}${delta}`
      : `${sign}${delta}`;

    return `<span class="trend-indicator trend-indicator--${direction}" aria-label="${ariaLabel}" title="${t('reports.common.sinceLastScan', 'Since last scan')}: ${sign}${delta}">
      <span class="trend-indicator__arrow">${arrow}</span>
      <span class="trend-indicator__value">${sign}${delta}</span>
    </span>`;
  }

  /**
   * Render a percentile badge (e.g., "Top 28%" or "Better than 72%")
   */
  function renderPercentile(percentile) {
    if (percentile == null || isNaN(percentile)) return '';
    const pct = Math.round(percentile);
    const topPct = 100 - pct;
    const text = topPct <= 25
      ? t('reports.common.topPct', 'Top {{pct}}%').replace('{{pct}}', topPct)
      : t('reports.common.betterThan', 'Better than {{pct}}%').replace('{{pct}}', pct);

    return `<span class="percentile-badge" aria-label="${text}" title="${text}">
      <span class="percentile-badge__icon">📊</span>
      <span class="percentile-badge__text">${text}</span>
    </span>`;
  }

  /**
   * Inject delta badges onto rendered summary donuts.
   * Call after ReportShell.renderSummaryDonuts() has rendered.
   * @param {Object} trends - { deltas: { overallScore: { delta }, ... } }
   * @param {Array} donutLabels - Array of { key, label } matching donut order
   */
  function injectTrendBadges(trends, donutLabels) {
    if (!trends || !trends.deltas || !donutLabels) return;

    const labelElements = document.querySelectorAll('.report-shell__summary-label');
    if (!labelElements.length) return;

    donutLabels.forEach((item, index) => {
      const labelEl = labelElements[index];
      if (!labelEl) return;

      const deltaData = trends.deltas[item.key];
      if (!deltaData || deltaData.delta === 0) return;

      // Don't inject twice
      if (labelEl.querySelector('.trend-indicator')) return;

      const badge = document.createElement('span');
      badge.innerHTML = renderDelta(deltaData.delta, item.label);
      labelEl.appendChild(badge);
    });
  }

  /**
   * Fetch percentile and inject badge on first donut card.
   * @param {string} analyzerType
   * @param {string} scoreField
   * @param {number} score
   */
  async function fetchAndInjectPercentile(analyzerType, scoreField, score) {
    if (score == null || isNaN(score)) return;

    try {
      const resp = await fetch(`/api/benchmarks?analyzer_type=${encodeURIComponent(analyzerType)}&score_field=${encodeURIComponent(scoreField)}&score=${encodeURIComponent(score)}`);
      if (!resp.ok) return;

      const data = await resp.json();
      if (!data.hasEnoughData || data.percentile == null) return;

      const firstCard = document.querySelector('.report-shell__summary-card');
      if (!firstCard || firstCard.querySelector('.percentile-badge')) return;

      const badge = document.createElement('div');
      badge.style.marginTop = '0.5rem';
      badge.innerHTML = renderPercentile(data.percentile);
      firstCard.appendChild(badge);
    } catch {
      // Silent fail — percentile is non-critical
    }
  }

  window.TrendIndicator = {
    renderDelta,
    renderPercentile,
    injectTrendBadges,
    fetchAndInjectPercentile,
  };
})(window);
