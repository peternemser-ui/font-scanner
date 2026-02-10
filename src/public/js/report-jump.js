/**
 * Site Mechanic - Report Jump Component
 * Auto-scrolls to report results after scan completion
 *
 * Features:
 * - Scrolls report into view when report:ready event fires
 * - Accounts for sticky header height via CSS scroll-margin-top
 * - Moves keyboard focus to results heading for accessibility
 * - Applies brief highlight/flash for visual confirmation
 * - Respects prefers-reduced-motion
 * - Avoids jarring jump if user is already near results
 */

(function(window) {
  'use strict';

  // Configuration
  const CONFIG = {
    // Threshold: if user is within this many pixels of results, don't scroll
    proximityThreshold: 200,
    // Delay before scrolling (allows DOM to settle)
    scrollDelay: 100,
    // Flash animation duration (matches CSS)
    flashDuration: 600
  };

  /**
   * Check if user prefers reduced motion
   */
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Get the sticky header height for scroll offset calculation
   */
  function getHeaderHeight() {
    // Try common header selectors
    const headerSelectors = [
      '.site-header',
      '#nav-placeholder > header',
      '#nav-placeholder > nav',
      'header[role="banner"]',
      '.nav-header',
      'nav.main-nav'
    ];

    for (const selector of headerSelectors) {
      const header = document.querySelector(selector);
      if (header) {
        const rect = header.getBoundingClientRect();
        // Only count if header is at top (sticky/fixed)
        if (rect.top <= 5) {
          return rect.height;
        }
      }
    }

    // Fallback: check for any fixed/sticky positioned element at top
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (navPlaceholder) {
      const firstChild = navPlaceholder.firstElementChild;
      if (firstChild) {
        const style = window.getComputedStyle(firstChild);
        if (style.position === 'fixed' || style.position === 'sticky') {
          return firstChild.getBoundingClientRect().height;
        }
      }
    }

    // Default header height estimate
    return 64;
  }

  /**
   * Find the report results container
   */
  function findResultsContainer() {
    // Primary: standardized report-results section
    const reportResults = document.getElementById('report-results');
    if (reportResults) return reportResults;

    // Fallback: any visible results container
    const containers = document.querySelectorAll('.results-container, [id$="Results"]');
    for (const container of containers) {
      if (!container.hidden && container.offsetHeight > 0) {
        return container;
      }
    }

    return null;
  }

  /**
   * Find the results heading for focus
   */
  function findResultsHeading(container) {
    if (!container) return null;

    // Primary: heading with data-results-heading attribute
    const markedHeading = container.querySelector('[data-results-heading]');
    if (markedHeading) return markedHeading;

    // Fallback: first heading in report header
    const reportHeaderHeading = container.querySelector('.report-header__title');
    if (reportHeaderHeading) return reportHeaderHeading;

    // Fallback: first h1, h2, or h3
    const heading = container.querySelector('h1, h2, h3');
    if (heading) return heading;

    return null;
  }

  /**
   * Check if element is already mostly visible in viewport
   */
  function isNearViewport(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const headerHeight = getHeaderHeight();
    const viewportHeight = window.innerHeight;

    // Calculate visible area below header
    const visibleTop = headerHeight;
    const visibleBottom = viewportHeight;

    // Check if top of element is within proximity threshold of visible area
    const distanceFromVisibleArea = rect.top - visibleTop;

    return distanceFromVisibleArea <= CONFIG.proximityThreshold &&
           distanceFromVisibleArea >= -rect.height * 0.5;
  }

  /**
   * Apply flash highlight to element
   */
  function applyFlash(element) {
    if (!element || prefersReducedMotion()) return;

    element.classList.add('results-flash');

    setTimeout(() => {
      element.classList.remove('results-flash');
    }, CONFIG.flashDuration);
  }

  /**
   * Scroll to results and focus heading
   */
  function scrollToResults() {
    const container = findResultsContainer();
    if (!container) {
      console.log('[ReportJump] No results container found');
      return;
    }

    // Check if user is already near results
    if (isNearViewport(container)) {
      console.log('[ReportJump] User already near results, skipping scroll');
      // Still apply flash and focus for visual/a11y confirmation
      applyFlash(container);
      focusHeading(container);
      return;
    }

    console.log('[ReportJump] Scrolling to results');

    // Scroll behavior based on motion preference
    const scrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';

    // Use scrollIntoView - CSS scroll-margin-top handles header offset
    container.scrollIntoView({
      behavior: scrollBehavior,
      block: 'start'
    });

    // Apply flash and focus after scroll settles
    setTimeout(() => {
      applyFlash(container);
      focusHeading(container);
    }, prefersReducedMotion() ? 50 : 400);
  }

  /**
   * Focus the results heading for accessibility
   */
  function focusHeading(container) {
    const heading = findResultsHeading(container);
    if (!heading) return;

    // Make heading focusable if it isn't already
    if (!heading.hasAttribute('tabindex')) {
      heading.setAttribute('tabindex', '-1');
    }

    // Focus without scrolling (we already scrolled)
    heading.focus({ preventScroll: true });
  }

  // Track last scroll time to avoid duplicate scrolls
  let lastScrollTime = 0;
  const SCROLL_DEBOUNCE = 2000; // 2 seconds between scrolls

  /**
   * Show a sticky toast if user has scrolled far from results
   */
  function showJumpToast() {
    const container = findResultsContainer();
    if (!container || isNearViewport(container)) return;

    // Only show if user is far from results
    const rect = container.getBoundingClientRect();
    if (Math.abs(rect.top) < 400) return;

    const toast = document.createElement('div');
    toast.className = 'report-jump-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = 'Report ready &mdash; jump to results <span aria-hidden="true">&darr;</span>';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'z-index:9999;padding:10px 20px;border-radius:12px;cursor:pointer;' +
      'background:var(--bg-card,rgba(22,26,31,0.95));color:var(--text-primary,#fff);' +
      'font-weight:600;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,0.35);' +
      'backdrop-filter:blur(6px);border:1px solid var(--border-color,rgba(255,255,255,0.16));' +
      'opacity:0;transition:opacity 180ms ease,transform 180ms ease;';

    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });

    const dismiss = () => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    };

    toast.addEventListener('click', () => {
      dismiss();
      scrollToResults();
    });

    // Auto-dismiss after 5s
    const autoDismiss = setTimeout(dismiss, 5000);

    // Dismiss if user scrolls results into view
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        clearTimeout(autoDismiss);
        dismiss();
        obs.disconnect();
      }
    }, { threshold: 0.1 });
    obs.observe(container);
  }

  /**
   * Handle report:ready event
   */
  function handleReportReady(event) {
    const now = Date.now();
    if (now - lastScrollTime < SCROLL_DEBOUNCE) {
      console.log('[ReportJump] Debouncing report:ready scroll (too recent)');
      return;
    }

    lastScrollTime = now;
    console.log('[ReportJump] report:ready event received');

    // Small delay to ensure DOM is fully updated
    setTimeout(() => {
      const container = findResultsContainer();
      if (container && isNearViewport(container)) {
        scrollToResults();
      } else {
        scrollToResults();
        // Show toast fallback if user has scrolled far away
        setTimeout(showJumpToast, 600);
      }
    }, CONFIG.scrollDelay);
  }

  /**
   * Handle results container becoming visible (for pages without PageShell)
   */
  function handleResultsVisible(container) {
    const now = Date.now();
    if (now - lastScrollTime < SCROLL_DEBOUNCE) {
      console.log('[ReportJump] Debouncing scroll (too recent)');
      return;
    }

    // Only scroll if we're during or just after a scan
    // Check for scanning state or recent completion
    if (!window.SM_IS_SCANNING && !window.SM_SCAN_STARTED_AT) {
      // Not in a scan context - could be page load with cached results
      console.log('[ReportJump] Not in scan context, skipping auto-scroll');
      return;
    }

    lastScrollTime = now;
    console.log('[ReportJump] Results container became visible');
    setTimeout(scrollToResults, CONFIG.scrollDelay);
  }

  /**
   * Set up MutationObserver to detect when results containers become visible
   * This handles pages that don't use PageShell or don't dispatch report:ready
   */
  function setupVisibilityObserver() {
    // Selectors for results containers to observe
    const containerSelectors = [
      '#report-results',
      '#results',
      '.results-container',
      '[id$="Results"]'
    ];

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const target = mutation.target;

          // Check if this is a results container that just became visible
          if (mutation.attributeName === 'hidden' && !target.hidden) {
            if (target.matches(containerSelectors.join(', '))) {
              handleResultsVisible(target);
              return;
            }
          }

          // Check for class changes (removing 'hidden' class)
          if (mutation.attributeName === 'class') {
            const wasHidden = mutation.oldValue && mutation.oldValue.includes('hidden');
            const isNowVisible = !target.classList.contains('hidden');
            if (wasHidden && isNowVisible && target.matches(containerSelectors.join(', '))) {
              handleResultsVisible(target);
              return;
            }
          }
        }
      }
    });

    // Observe the document body for attribute changes on results containers
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'class'],
      attributeOldValue: true
    });

    return observer;
  }

  /**
   * Initialize the report jump listener
   */
  function init() {
    // Listen for the report:ready event (primary method)
    window.addEventListener('report:ready', handleReportReady);

    // Also observe for results containers becoming visible (fallback for custom pages)
    setupVisibilityObserver();

    console.log('[ReportJump] Initialized');
  }

  /**
   * Manually trigger scroll to results (for programmatic use)
   */
  function jumpToResults() {
    scrollToResults();
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.ReportJump = {
    init,
    jumpToResults,
    scrollToResults,
    // Expose for testing/debugging
    getHeaderHeight,
    findResultsContainer,
    isNearViewport
  };

})(window);
