/**
 * AIRecommendations — Strategic analysis insights (Pro-gated)
 * Renders a strategic overview (assessment, quick win, priority order, connections)
 * that complements the detailed per-issue fix cards.
 */
(function(window) {
  const t = (key, fallback, params) => {
    let val = window.t ? window.t(key, fallback, params) : (window.i18n && window.i18n.t ? window.i18n.t(key, params) || fallback : fallback);
    if (params && typeof val === 'string') {
      Object.keys(params).forEach(function (p) {
        val = val.replace(new RegExp('\\{\\{' + p + '\\}\\}', 'g'), params[p]);
      });
    }
    return val;
  };

  function renderHeader() {
    return `<h4 style="margin: 0 0 0.5rem 0; font-size: 1.05rem; font-weight: 700; color: var(--r-text, #111827); display: flex; align-items: center; gap: 0.5rem;">
      <span style="font-size: 1.1rem;">&#10024;</span> ${t('reports.ai.strategicTitle', 'AI Strategic Analysis')}
    </h4>
    <p style="color: var(--r-text-muted, #6B7280); font-size: 0.85rem; line-height: 1.5; margin: 0 0 1rem 0;">
      ${t('reports.ai.strategicIntro', 'Beyond the individual fixes above, this analysis looks at the bigger picture \u2014 what to prioritize, where the quick wins are, and how your issues connect.')}
    </p>`;
  }

  function renderLoadingContent() {
    return `<div class="ai-recommendations__loading">
      <div class="ai-recommendations__spinner"></div>
      <span>${t('reports.ai.loading', 'Analyzing your results...')}</span>
      <div class="ai-recommendations__progress"><div class="ai-recommendations__progress-bar"></div></div>
      <div class="ai-recommendations__shimmer">
        <div class="ai-recommendations__shimmer-line"></div>
        <div class="ai-recommendations__shimmer-line"></div>
        <div class="ai-recommendations__shimmer-line"></div>
      </div>
    </div>`;
  }

  function renderLoadingState() {
    return renderHeader() + renderLoadingContent();
  }

  /**
   * Render just the thinking-dots animation (no header) — used inside accordion body
   */
  function renderLoadingAnimation() {
    return `<div class="ai-thinking-dots">
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span>${t('reports.ai.loading', 'Analyzing your results...')}</span>
        <span class="ai-thinking-dots__dot"></span>
        <span class="ai-thinking-dots__dot"></span>
        <span class="ai-thinking-dots__dot"></span>
      </div>
      <div class="ai-thinking-dots__progress"><div class="ai-thinking-dots__progress-bar"></div></div>
      <div class="ai-thinking-dots__shimmer">
        <div class="ai-thinking-dots__shimmer-line"></div>
        <div class="ai-thinking-dots__shimmer-line"></div>
        <div class="ai-thinking-dots__shimmer-line"></div>
      </div>
    </div>`;
  }

  function renderProGateContent() {
    // Use the standard ProReportBlock unlock prompt for consistency across all paywalls
    const reportId = document.body?.getAttribute('data-report-id') || '';
    const context = document.body?.getAttribute('data-analyzer-type') || 'report';

    if (window.ProReportBlock && typeof window.ProReportBlock.renderUnlockPrompt === 'function') {
      return window.ProReportBlock.renderUnlockPrompt({ context, reportId });
    }

    // Fallback markup matching ProReportBlock.renderUnlockPrompt() style
    return `<div class="pro-report-block__unlock-prompt" data-locked-overlay>
      <div class="pro-report-block__unlock-header">
        <span class="pro-report-block__unlock-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span>
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
    </div>`;
  }

  function renderProGate() {
    return renderHeader() + renderProGateContent();
  }

  function renderErrorContent(message) {
    const cleanMsg = message ? `<p style="margin: 0.5rem 0 0 0; font-size: 0.8rem;">${message}</p>` : '';
    return `<div class="ai-recommendations__error" style="padding: 1.5rem; text-align: center; color: var(--r-text-muted, #6B7280);">
      <p style="margin: 0;">${t('reports.ai.error', 'Could not load strategic analysis.')}</p>
      ${cleanMsg}
    </div>`;
  }

  function renderError(message) {
    return renderHeader() + renderErrorContent(message);
  }

  // Resolve a value that might be an i18n key (from fallback engine) or a plain string (from Claude)
  function resolve(val) {
    if (!val) return '';
    if (typeof val === 'string') {
      if (val.startsWith('reports.fb.') || val.startsWith('reports.ai.')) return t(val, val);
      return val;
    }
    if (typeof val === 'object' && val.key) {
      return t(val.key, val.fallback || val.key, val.params);
    }
    return String(val);
  }

  /**
   * Render the strategic analysis layout — assessment, quick win, priority order, connections, total impact
   */
  function renderStrategicInsights(data) {
    const sections = [];

    // Assessment paragraph
    if (data.assessment) {
      sections.push(`
        <div class="ai-strategic__assessment" style="margin-bottom: 1.25rem; line-height: 1.6; color: var(--r-text, #111827); font-size: 0.9rem;">
          ${resolve(data.assessment)}
        </div>`);
    }

    // Quick Win card
    if (data.quickWin) {
      const qw = data.quickWin;
      sections.push(`
        <div class="ai-strategic__quick-win" style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1rem;">&#9889;</span>
            <strong style="font-size: 0.85rem; color: #059669; text-transform: uppercase; letter-spacing: 0.03em;">${t('reports.ai.quickWin', 'Quick Win')}</strong>
            ${qw.estimatedImpact ? `<span style="margin-left: auto; font-size: 0.8rem; font-weight: 600; color: #059669; background: rgba(16, 185, 129, 0.1); padding: 0.15rem 0.5rem; border-radius: 4px;">${resolve(qw.estimatedImpact)}</span>` : ''}
          </div>
          <div style="font-weight: 600; color: var(--r-text, #111827); font-size: 0.9rem; margin-bottom: 0.25rem;">${resolve(qw.title)}</div>
          ${qw.description ? `<div style="color: var(--r-text-muted, #6B7280); font-size: 0.85rem; line-height: 1.5;">${resolve(qw.description)}</div>` : ''}
        </div>`);
    }

    // Priority Order list
    if (data.priorityOrder && data.priorityOrder.length > 0) {
      const items = data.priorityOrder.map((item, i) => {
        const category = typeof item === 'string' ? resolve(item) : (item.category || '');
        const reason = typeof item === 'object' && item.reason ? resolve(item.reason) : '';
        return `<li style="margin-bottom: 0.5rem; line-height: 1.5;">
          <strong style="color: var(--r-text, #111827);">${category}</strong>
          ${reason ? `<span style="color: var(--r-text-muted, #6B7280);"> &mdash; ${reason}</span>` : ''}
        </li>`;
      }).join('');

      sections.push(`
        <div class="ai-strategic__priority" style="margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1rem;">&#128203;</span>
            <strong style="font-size: 0.85rem; color: var(--r-text, #111827); text-transform: uppercase; letter-spacing: 0.03em;">${t('reports.ai.priorityOrder', 'Priority Order')}</strong>
          </div>
          <ol style="margin: 0; padding-left: 1.5rem; font-size: 0.85rem;">
            ${items}
          </ol>
        </div>`);
    }

    // Connected Issues
    if (data.connections && data.connections.length > 0) {
      const connectionItems = data.connections.map(c => {
        const text = typeof c === 'string' ? resolve(c) : resolve(c.text || '');
        return `<li style="margin-bottom: 0.35rem; line-height: 1.5;">${text}</li>`;
      }).join('');

      sections.push(`
        <div class="ai-strategic__connections" style="margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1rem;">&#128279;</span>
            <strong style="font-size: 0.85rem; color: var(--r-text, #111827); text-transform: uppercase; letter-spacing: 0.03em;">${t('reports.ai.connectedIssues', 'Connected Issues')}</strong>
          </div>
          <ul style="margin: 0; padding-left: 1.5rem; font-size: 0.85rem; color: var(--r-text-muted, #6B7280);">
            ${connectionItems}
          </ul>
        </div>`);
    }

    // Total Impact
    const totalText = data.totalImpact ? resolve(data.totalImpact) : null;
    const totalPoints = data.totalPoints || null;
    if (totalText || totalPoints) {
      sections.push(`
        <div class="ai-strategic__total-impact" style="background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.15); border-radius: 8px; padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1rem;">&#128200;</span>
          <span style="font-size: 0.85rem; color: var(--r-text, #111827); font-weight: 500;">
            ${t('reports.ai.totalPotential', 'Total Potential')}:
          </span>
          <span style="font-size: 0.85rem; color: #2563EB; font-weight: 600;">
            ${totalPoints || totalText}
          </span>
        </div>`);
    }

    // If no sections (no issues found), show a positive message
    if (sections.length === 0) {
      return `<div style="padding: 1rem; text-align: center; color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">
        ${t('reports.ai.noIssues', 'No strategic concerns identified — your site is performing well in this area.')}
      </div>`;
    }

    return sections.join('');
  }

  /**
   * Legacy card renderer — kept for backward compatibility with old cached AI responses
   */
  function renderLegacyCards(recommendations, reportId) {
    const PRIORITY_COLORS = {
      critical: { bg: 'rgba(239, 68, 68, 0.08)', border: '#EF4444', text: '#DC2626' },
      high:     { bg: 'rgba(245, 158, 11, 0.08)', border: '#F59E0B', text: '#D97706' },
      medium:   { bg: 'rgba(59, 130, 246, 0.08)', border: '#3B82F6', text: '#2563EB' },
      low:      { bg: 'rgba(16, 185, 129, 0.08)', border: '#10B981', text: '#059669' },
    };

    return recommendations.map(function(rec) {
      const priority = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.medium;
      rec = Object.assign({}, rec, {
        title: resolve(rec.title),
        description: resolve(rec.description),
        implementationSteps: rec.implementationSteps ? rec.implementationSteps.map(resolve) : [],
      });

      const stepsHtml = rec.implementationSteps && rec.implementationSteps.length > 0
        ? `<div style="margin-top: 0.75rem;">
            <strong style="font-size: 0.8rem; color: var(--r-text-muted, #6B7280);">${t('reports.ai.implementationSteps', 'Implementation Steps')}:</strong>
            <ol style="margin: 0.25rem 0 0 1.25rem; padding: 0; font-size: 0.85rem; color: var(--r-text-muted, #6B7280);">
              ${rec.implementationSteps.map(function(step) { return '<li style="margin-bottom: 0.25rem;">' + step + '</li>'; }).join('')}
            </ol>
          </div>`
        : '';

      return `<div class="ai-rec-card" style="background: ${priority.bg}; border-left: 3px solid ${priority.border}; border-radius: 6px; padding: 1rem; margin-bottom: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: ${priority.text}; background: ${priority.bg}; padding: 0.1rem 0.4rem; border-radius: 3px; border: 1px solid ${priority.border};">${rec.priority}</span>
          ${rec.category ? '<span style="font-size: 0.7rem; color: var(--r-text-faint, #9CA3AF);">' + rec.category + '</span>' : ''}
        </div>
        <h4 style="margin: 0 0 0.35rem 0; font-size: 0.95rem; color: var(--r-text, #111827); font-weight: 600;">${rec.title}</h4>
        <p style="margin: 0; font-size: 0.85rem; color: var(--r-text-muted, #6B7280); line-height: 1.5;">${rec.description}</p>
        ${stepsHtml}
      </div>`;
    }).join('');
  }

  function getAuthHeaders() {
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token') || '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
  }

  /**
   * Fetch recommendations from API and render into a container
   * @param {string} containerId
   * @param {string} reportId
   * @param {string} analyzerType
   * @param {object} scanData
   * @param {string} locale
   * @param {object} [opts]
   * @param {boolean} [opts.skipHeader] - Omit the header (used when inside an accordion that already has a title)
   */
  async function fetchAndRender(containerId, reportId, analyzerType, scanData, locale, opts) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const skipHeader = opts && opts.skipHeader;
    const header = skipHeader ? '' : renderHeader();

    // If no reportId, show the pro gate (can't make API call without it)
    if (!reportId) {
      container.innerHTML = header + renderProGateContent();
      return;
    }

    container.innerHTML = skipHeader ? renderLoadingAnimation() : renderLoadingState();

    try {
      const resp = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ reportId, analyzerType, scanData, locale }),
      });

      if (resp.status === 403) {
        container.innerHTML = header + renderProGateContent();
        return;
      }

      if (!resp.ok) {
        container.innerHTML = header + renderErrorContent();
        return;
      }

      const data = await resp.json();

      if (data.error) {
        container.innerHTML = header + renderErrorContent(data.error);
        return;
      }

      const recs = data.recommendations;
      const isFallback = data.source === 'fallback';
      const cachedTag = data.cached
        ? `<span style="font-size: 0.75rem; color: var(--r-text-faint, #9CA3AF); margin-left: 0.5rem;">${t('reports.ai.cached', '(cached)')}</span>`
        : '';
      const sourceLabel = isFallback
        ? t('reports.ai.smartAnalysis', 'Smart Analysis')
        : t('reports.ai.poweredByClaude', 'Powered by Claude AI');

      let contentHtml;

      // Detect strategic format (new) vs legacy array format (old cached responses)
      if (recs && recs.strategic) {
        contentHtml = renderStrategicInsights(recs);
      } else if (Array.isArray(recs) && recs.length > 0) {
        // Check if the first item looks strategic (Claude returned strategic obj inside array)
        if (recs[0] && recs[0].strategic) {
          contentHtml = renderStrategicInsights(recs[0]);
        } else {
          contentHtml = renderLegacyCards(recs, reportId);
        }
      } else {
        container.innerHTML = `${header}<p style="padding: 1rem; color: var(--r-text-muted, #6B7280); text-align: center;">${t('reports.ai.noRecommendations', 'No strategic analysis available for this scan.')}</p>`;
        return;
      }

      const poweredBy = `<div style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--r-text-faint, #9CA3AF); text-align: right;">${sourceLabel}${cachedTag}</div>`;
      container.innerHTML = header + contentHtml + poweredBy;
    } catch (error) {
      container.innerHTML = header + renderErrorContent();
    }
  }

  window.AIRecommendations = {
    fetchAndRender,
    renderLoadingState,
    renderLoadingAnimation,
    renderProGate,
    renderError,
    renderStrategicInsights,
  };
})(window);
