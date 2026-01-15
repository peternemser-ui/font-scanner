/**
 * Site Mechanic - Modal Component
 * Generic, reusable modal system
 *
 * Features:
 * - Backdrop with blur
 * - Keyboard navigation (ESC to close)
 * - Focus trap
 * - Accessible (ARIA labels)
 * - Size variants (small, medium, large, fullscreen)
 */

(function(window) {
  const openModals = [];
  let previousFocus = null;
  let globalKeydownAttached = false;
  let globalKeydownHandler = null;

  /**
   * Create modal HTML
   */
  function create(options = {}) {
    const {
      id = `modal-${Date.now()}`,
      title,
      content,
      size = 'medium', // small, medium, large, fullscreen
      dismissible = true,
      showCloseButton = true,
      footer,
      className = ''
    } = options;

    return `
      <div class="modal-overlay" data-modal-id="${id}" role="dialog" aria-modal="true" ${title ? `aria-labelledby="${id}-title"` : ''}>
        <div class="modal modal--${size} ${className}" id="${id}" tabindex="-1">
          ${title || showCloseButton ? `
            <div class="modal__header">
              ${title ? `<h3 class="modal__title" id="${id}-title">${title}</h3>` : ''}
              ${showCloseButton && dismissible ? `
                <button type="button" class="modal__close" data-modal-close="${id}" aria-label="Close modal">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              ` : ''}
            </div>
          ` : ''}
          <div class="modal__body">
            ${content || ''}
          </div>
          ${footer ? `
            <div class="modal__footer">
              ${footer}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Get all focusable elements within modal
   */
  function getFocusableElements(modal) {
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(modal.querySelectorAll(selector)).filter(el => {
      return !el.hasAttribute('disabled') && el.offsetParent !== null;
    });
  }

  /**
   * Trap focus within modal
   */
  function trapFocus(modal) {
    const focusableElements = getFocusableElements(modal);
    if (!focusableElements.length) {
      return () => {};
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    function handleTab(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }

    modal.addEventListener('keydown', handleTab);
    return () => modal.removeEventListener('keydown', handleTab);
  }

  function ensureGlobalKeydown() {
    if (globalKeydownAttached) return;
    globalKeydownAttached = true;
    globalKeydownHandler = (e) => {
      if (e.key === 'Escape') {
        // Close topmost modal
        if (openModals.length > 0) {
          e.preventDefault();
          closeTopmost();
        }
      }
    };
    document.addEventListener('keydown', globalKeydownHandler);
  }

  function teardownGlobalKeydownIfIdle() {
    if (!globalKeydownAttached) return;
    if (openModals.length > 0) return;
    document.removeEventListener('keydown', globalKeydownHandler);
    globalKeydownAttached = false;
    globalKeydownHandler = null;
  }

  /**
   * Open modal
   */
  function open(modalId, options = {}) {
    const {
      onOpen,
      onClose
    } = options;

    // Save current focus
    previousFocus = document.activeElement;

    // Find existing modal or create new one
    let overlay = document.querySelector(`.modal-overlay[data-modal-id="${modalId}"]`);

    if (!overlay) {
      // Modal doesn't exist, create it
      const modalHTML = create({ id: modalId, ...options });
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      overlay = document.querySelector(`.modal-overlay[data-modal-id="${modalId}"]`);
    }

    if (!overlay) {
      console.error(`Modal ${modalId} not found`);
      return;
    }

    const modal = overlay.querySelector('.modal');

    ensureGlobalKeydown();

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Show modal with animation
    requestAnimationFrame(() => {
      overlay.classList.add('modal-overlay--open');
      modal.classList.add('modal--open');
    });

    // Track open modal
    openModals.push({ id: modalId, overlay, cleanupFocusTrap: trapFocus(modal), onClose });

    // Focus first focusable element (or modal container)
    const focusableElements = getFocusableElements(modal);
    if (focusableElements.length > 0) focusableElements[0].focus();
    else modal.focus();

    // Call onOpen callback
    if (onOpen) {
      onOpen();
    }
  }

  /**
   * Close specific modal
   */
  function close(modalId) {
    const modalIndex = openModals.findIndex(m => m.id === modalId);
    if (modalIndex === -1) return;

    const { overlay, cleanupFocusTrap, onClose } = openModals[modalIndex];

    // Cleanup focus trap
    if (cleanupFocusTrap) {
      cleanupFocusTrap();
    }

    // Hide modal with animation
    overlay.classList.remove('modal-overlay--open');
    const modal = overlay.querySelector('.modal');
    if (modal) {
      modal.classList.remove('modal--open');
    }

    // Remove from DOM after animation
    setTimeout(() => {
      overlay.remove();
    }, 300);

    // Remove from tracking
    openModals.splice(modalIndex, 1);

    // Restore body scroll if no modals open
    if (openModals.length === 0) {
      document.body.style.overflow = '';
    }

    teardownGlobalKeydownIfIdle();

    // Restore focus
    if (previousFocus && openModals.length === 0) {
      previousFocus.focus();
      previousFocus = null;
    }

    // Call onClose callback
    if (onClose) {
      onClose();
    }
  }

  /**
   * Close topmost modal
   * Used for ESC key handling
   */
  function closeTopmost() {
    if (openModals.length > 0) {
      const topmostModal = openModals[openModals.length - 1];
      close(topmostModal.id);
    }
  }

  /**
   * Close all modals
   */
  function closeAll() {
    while (openModals.length > 0) {
      closeTopmost();
    }
  }

  /**
   * Check if any modals are open
   */
  function isOpen() {
    return openModals.length > 0;
  }

  // Public API
  window.Modal = {
    create,
    open,
    close,
    closeTopmost,
    closeAll,
    isOpen
  };

})(window);
