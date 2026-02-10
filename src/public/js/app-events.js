/**
 * App Events - Centralized Event Delegation Handler
 *
 * Replaces inline event handlers (onclick, onmouseover, etc.) with
 * data-action attributes for CSP compliance.
 *
 * Usage:
 *   <button data-action="navigate" data-href="/page.html">Go</button>
 *   <button data-action="alert" data-message="Hello!">Alert</button>
 *   <button data-action="accordion-toggle">Toggle</button>
 *   <button data-action="filter-providers" data-filter="all">All</button>
 *   <div data-action="hover-scale">Hover me</div>
 */

(function() {
  'use strict';

  /**
   * Action handlers for click events
   */
  const clickActions = {
    /**
     * Navigate to a URL
     * data-href: URL to navigate to
     * data-preserve-search: if "true", preserves current query string
     */
    'navigate': function(element) {
      const href = element.dataset.href;
      if (!href) return;

      const preserveSearch = element.dataset.preserveSearch === 'true';
      const url = preserveSearch ? href + window.location.search : href;
      window.location.href = url;
    },

    /**
     * Show an alert message
     * data-message: Message to display
     */
    'alert': function(element) {
      const message = element.dataset.message || '';
      alert(message);
    },

    /**
     * Toggle accordion open/closed state
     * Toggles 'accordion--open' class on parent element
     */
    'accordion-toggle': function(element) {
      const parent = element.parentElement;
      if (parent) {
        parent.classList.toggle('accordion--open');
      }
    },

    /**
     * Filter providers (hosting-analyzer specific)
     * data-filter: Filter category (all, wordpress, ecommerce, vps, budget)
     */
    'filter-providers': function(element) {
      const filter = element.dataset.filter || 'all';
      if (typeof window.filterProviders === 'function') {
        window.filterProviders(filter);
      }
    },

    /**
     * Export to PDF
     */
    'export-pdf': function(element) {
      if (typeof window.exportToPDF === 'function') {
        window.exportToPDF();
      }
    },

    /**
     * Switch tab
     * data-tab: Tab identifier
     */
    'switch-tab': function(element) {
      const tab = element.dataset.tab;
      if (tab && typeof window.switchTab === 'function') {
        window.switchTab(tab);
      }
    }
  };

  /**
   * Handle hover effects
   * data-hover-scale: Scale factor (e.g., "1.05")
   * data-hover-shadow: Box shadow value
   */
  function handleHoverEnter(element) {
    const scale = element.dataset.hoverScale || '1.05';
    const shadow = element.dataset.hoverShadow || '0 4px 15px rgba(0, 217, 255, 0.4)';

    element.style.transform = `scale(${scale})`;
    element.style.boxShadow = shadow;
  }

  function handleHoverLeave(element) {
    element.style.transform = 'scale(1)';
    element.style.boxShadow = 'none';
  }

  /**
   * Initialize event delegation
   */
  function init() {
    // Click event delegation
    document.addEventListener('click', function(event) {
      // Find the closest element with a data-action attribute
      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;

      const action = actionElement.dataset.action;
      const handler = clickActions[action];

      if (handler) {
        event.preventDefault();
        handler(actionElement, event);
      }
    });

    // Mouseover event delegation for hover effects
    document.addEventListener('mouseover', function(event) {
      const hoverElement = event.target.closest('[data-action="hover-scale"]');
      if (hoverElement) {
        handleHoverEnter(hoverElement);
      }
    });

    // Mouseout event delegation for hover effects
    document.addEventListener('mouseout', function(event) {
      const hoverElement = event.target.closest('[data-action="hover-scale"]');
      if (hoverElement) {
        handleHoverLeave(hoverElement);
      }
    });

    // Change event delegation (for future use with form elements)
    document.addEventListener('change', function(event) {
      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;

      const action = actionElement.dataset.action;
      // Add change handlers here as needed
    });
  }

  // Initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded
    init();
  }

  // Expose for external use if needed
  window.AppEvents = {
    clickActions: clickActions,
    registerAction: function(name, handler) {
      clickActions[name] = handler;
    }
  };
})();
