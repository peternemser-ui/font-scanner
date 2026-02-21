/**
 * Self-Improvement Integration — shared helper for all report scripts
 * Handles: trend badges, percentile fetching, AI insights as accordion, feedback buttons
 *
 * Call `SelfImprovement.integrate(opts)` after setting resultsContent.innerHTML
 * and BEFORE ReportAccordion.initInteractions().
 */
(function(window) {
  'use strict';

  var t = function(key, fallback) {
    if (window.t) return window.t(key, fallback);
    if (window.i18n && window.i18n.t) return window.i18n.t(key) || fallback;
    return fallback;
  };

  function getAuthHeaders() {
    var token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token') || '';
    var headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
  }

  // Guard: prevent duplicate AI accordion injection
  var _aiAccordionInjected = false;

  /**
   * Find the best insertion point for the AI accordion.
   * Priority order:
   *   1. After [data-accordion-id="report-recommendations"] (ReportContainer / direct ReportAccordion scripts)
   *   2. After an element whose id contains "report-recommendations" inside .accordion (performance/cwv custom)
   *   3. After the last .report-accordion in .report-scope
   *   4. After the last .accordion on the page
   *   5. End of .report-scope
   */
  function findAccordionInsertionPoint() {
    // 1. Standard ReportAccordion recommendations
    var recsAccordion = document.querySelector('[data-accordion-id="report-recommendations"]');
    if (recsAccordion) {
      return recsAccordion;
    }

    // 2. Custom accordion pattern (performance/cwv use #accordion-report-recommendations or similar)
    var customRecsPanel = document.querySelector('[id*="report-recommendations"]');
    if (customRecsPanel) {
      // Walk up to the .accordion wrapper
      var accordionWrapper = customRecsPanel.closest('.accordion');
      if (accordionWrapper) return accordionWrapper;
      return customRecsPanel;
    }

    // 3. Last .report-accordion inside .report-scope
    var reportAccordions = document.querySelectorAll('.report-scope .report-accordion');
    if (reportAccordions.length > 0) {
      return reportAccordions[reportAccordions.length - 1];
    }

    // 4. Last .accordion on the page
    var genericAccordions = document.querySelectorAll('.accordion');
    if (genericAccordions.length > 0) {
      return genericAccordions[genericAccordions.length - 1];
    }

    return null;
  }

  /**
   * Add feedback buttons to existing static recommendation items.
   */
  function addFeedbackToStaticRecs(reportId) {
    if (!window.FeedbackButtons) return;
    var recItems = document.querySelectorAll(
      '.recommendation-item, .rec-card, [data-recommendation-id]'
    );
    recItems.forEach(function(item, index) {
      var recId = item.getAttribute('data-recommendation-id') || ('static-rec-' + index);
      if (item.querySelector('.feedback-buttons')) return;
      var feedbackHtml = window.FeedbackButtons.render(reportId, recId, 'static', null);
      var div = document.createElement('div');
      div.style.marginTop = '0.5rem';
      div.innerHTML = feedbackHtml;
      item.appendChild(div);
    });
  }

  /**
   * Main integration function — call from each report script's display function.
   */
  function integrate(opts) {
    var data = opts.data;
    var analyzerType = opts.analyzerType;
    var donutLabels = opts.donutLabels;
    var resultsContent = opts.resultsContent;
    var reportId = opts.reportId || (data && data.reportId) || document.body.getAttribute('data-report-id') || '';
    var locale = document.documentElement.lang || (window.i18n && window.i18n.locale) || 'en';

    // 1. Fetch & inject trend delta badges on summary donuts (async, non-blocking)
    if (window.TrendIndicator && donutLabels) {
      var scanUrl = (data && (data.url || data.targetUrl || data.site_url)) || '';
      if (scanUrl) {
        fetch('/api/trends?url=' + encodeURIComponent(scanUrl) + '&analyzer_type=' + encodeURIComponent(analyzerType), {
          headers: getAuthHeaders()
        })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(trends) {
            if (trends && trends.hasPreviousScan) {
              window.TrendIndicator.injectTrendBadges(trends, donutLabels);
            }
          })
          .catch(function() {});
      }
    }

    // 2. Fetch & inject percentile badge (async, non-blocking)
    if (window.TrendIndicator && data && data.overallScore != null) {
      window.TrendIndicator.fetchAndInjectPercentile(analyzerType, 'overallScore', data.overallScore);
    }

    // 3. AI insights — inject as accordion after recommendations
    // Reset guard if the accordion was removed from the DOM (e.g. user ran a new scan)
    if (_aiAccordionInjected && !document.querySelector('[data-accordion-id="ai-strategic-analysis"]')) {
      _aiAccordionInjected = false;
    }
    if (window.AIRecommendations && !_aiAccordionInjected) {
      // Skip if the accordion was already added inline by the report script
      if (document.querySelector('[data-accordion-id="ai-strategic-analysis"]')) {
        _aiAccordionInjected = true;
      }
    }
    if (window.AIRecommendations && !_aiAccordionInjected) {
      // Remove any pre-existing standalone container (from ReportContainer)
      var oldContainer = document.getElementById('ai-strategic-section');
      if (oldContainer) oldContainer.remove();

      // Check if ReportAccordion is available for proper accordion injection
      if (window.ReportAccordion && window.ReportAccordion.createSection) {
        var loadingHtml = window.AIRecommendations.renderLoadingAnimation
          ? window.AIRecommendations.renderLoadingAnimation()
          : '<div style="padding: 1.5rem; text-align: center; color: var(--r-text-muted, #6B7280);">' + t('reports.ai.loading', 'Analyzing your results...') + '</div>';

        // Wrap loading HTML with a targetable container for fetchAndRender
        var aiContainerId = 'ai-strategic-content';
        var wrappedContent = '<div id="' + aiContainerId + '">' + loadingHtml + '</div>';

        var accordionHTML = window.ReportAccordion.createSection({
          id: 'ai-strategic-analysis',
          title: t('reports.ai.strategicTitle', 'AI Strategic Analysis'),
          isPro: true,
          locked: false,
          scoreTextRight: null,
          contentHTML: wrappedContent
        });

        var insertAfter = findAccordionInsertionPoint();
        if (insertAfter) {
          insertAfter.insertAdjacentHTML('afterend', accordionHTML);
          _aiAccordionInjected = true;
          window.AIRecommendations.fetchAndRender(
            aiContainerId,
            reportId, analyzerType, data, locale,
            { skipHeader: true }
          );
        } else {
          // Last resort: append to .report-scope or #results
          var scope = document.querySelector('.report-scope') || document.getElementById('results');
          if (scope) {
            scope.insertAdjacentHTML('beforeend', accordionHTML);
            _aiAccordionInjected = true;
            window.AIRecommendations.fetchAndRender(
              aiContainerId,
              reportId, analyzerType, data, locale,
              { skipHeader: true }
            );
          }
        }
      } else {
        // Fallback: AIRecommendations without ReportAccordion (shouldn't happen in practice)
        console.warn('[SelfImprovement] ReportAccordion not available, skipping AI accordion injection');
      }
    }

    // 4. Add feedback buttons to static recommendations
    if (reportId) {
      addFeedbackToStaticRecs(reportId);
    }

    // 5. Initialize feedback button listeners
    if (window.FeedbackButtons) {
      window.FeedbackButtons.initFeedbackListeners();
    }
  }

  window.SelfImprovement = {
    integrate: integrate,
    addFeedbackToStaticRecs: addFeedbackToStaticRecs,
  };
})(window);
