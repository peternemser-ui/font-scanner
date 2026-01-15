/**
 * Site Mechanic - Screenshot Lightbox Component
 * Image gallery viewer with navigation
 *
 * Features:
 * - Fullscreen image viewing
 * - Arrow navigation (prev/next)
 * - Keyboard support (arrows, ESC)
 * - Device labels for Mobile Testing
 * - Image counter (1 of 3)
 */

(function(window) {
  let currentGallery = [];
  let currentIndex = 0;
  let lightboxElement = null;
  let previousFocus = null;
  let keydownHandler = null;

  /**
   * Extract image data from element
   */
  function getImageData(element) {
    const img = element.querySelector('img') || element;
    return {
      src: img.src || img.dataset.src || element.dataset.src || '',
      alt: img.alt || element.dataset.alt || 'Screenshot',
      device: element.dataset.device || '',
      title: element.dataset.title || ''
    };
  }

  /**
   * Create lightbox HTML
   */
  function createLightboxHTML() {
    return `
      <div class="screenshot-lightbox" id="screenshot-lightbox" role="dialog" aria-modal="true" aria-label="Screenshot viewer" tabindex="-1">
        <div class="screenshot-lightbox__overlay"></div>
        <div class="screenshot-lightbox__content">
          <!-- Close button -->
          <button type="button" class="screenshot-lightbox__close" aria-label="Close lightbox">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <!-- Navigation arrows -->
          <button type="button" class="screenshot-lightbox__nav screenshot-lightbox__nav--prev" aria-label="Previous image">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button type="button" class="screenshot-lightbox__nav screenshot-lightbox__nav--next" aria-label="Next image">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>

          <!-- Image container -->
          <div class="screenshot-lightbox__image-container">
            <img class="screenshot-lightbox__image" src="" alt="" />
          </div>

          <!-- Image info footer -->
          <div class="screenshot-lightbox__footer">
            <div class="screenshot-lightbox__device"></div>
            <div class="screenshot-lightbox__counter"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Initialize lightbox element
   */
  function initLightbox() {
    if (lightboxElement) return;

    // Create lightbox
    document.body.insertAdjacentHTML('beforeend', createLightboxHTML());
    lightboxElement = document.getElementById('screenshot-lightbox');

    // Event listeners
    const closeBtn = lightboxElement.querySelector('.screenshot-lightbox__close');
    const prevBtn = lightboxElement.querySelector('.screenshot-lightbox__nav--prev');
    const nextBtn = lightboxElement.querySelector('.screenshot-lightbox__nav--next');
    const overlay = lightboxElement.querySelector('.screenshot-lightbox__overlay');

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', () => navigate('prev'));
    nextBtn.addEventListener('click', () => navigate('next'));
    overlay.addEventListener('click', close);
  }

  /**
   * Update lightbox display
   */
  function updateDisplay() {
    if (!lightboxElement || currentGallery.length === 0) return;

    const image = currentGallery[currentIndex];
    const imgElement = lightboxElement.querySelector('.screenshot-lightbox__image');
    const deviceElement = lightboxElement.querySelector('.screenshot-lightbox__device');
    const counterElement = lightboxElement.querySelector('.screenshot-lightbox__counter');
    const prevBtn = lightboxElement.querySelector('.screenshot-lightbox__nav--prev');
    const nextBtn = lightboxElement.querySelector('.screenshot-lightbox__nav--next');

    // Update image
    imgElement.src = image.src;
    imgElement.alt = image.alt;

    // Update device label
    if (image.device) {
      deviceElement.textContent = image.device;
      deviceElement.style.display = '';
    } else {
      deviceElement.style.display = 'none';
    }

    // Update counter
    if (currentGallery.length > 1) {
      counterElement.textContent = `${currentIndex + 1} of ${currentGallery.length}`;
      counterElement.style.display = '';
    } else {
      counterElement.style.display = 'none';
    }

    // Show/hide navigation arrows
    prevBtn.style.display = currentGallery.length > 1 ? '' : 'none';
    nextBtn.style.display = currentGallery.length > 1 ? '' : 'none';

    // Disable arrows at boundaries
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === currentGallery.length - 1;
  }

  /**
   * Open lightbox at specific index
   */
  function open(index, images) {
    initLightbox();

    // Save current focus
    previousFocus = document.activeElement;

    // Build gallery from images
    currentGallery = images.map(img => {
      if (typeof img === 'string') {
        return { src: img, alt: 'Screenshot', device: '' };
      } else if (img instanceof Element) {
        return getImageData(img);
      } else {
        return img;
      }
    });

    currentIndex = Math.max(0, Math.min(index, currentGallery.length - 1));

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Show lightbox
    lightboxElement.classList.add('screenshot-lightbox--open');

    // Focus management + keyboard handling
    lightboxElement.focus();
    attachKeydown();

    // Update display
    updateDisplay();
  }

  /**
   * Close lightbox
   */
  function close() {
    if (!lightboxElement) return;

    // Hide lightbox
    lightboxElement.classList.remove('screenshot-lightbox--open');

    detachKeydown();

    // Restore body scroll
    document.body.style.overflow = '';

    // Restore focus
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
    previousFocus = null;

    // Clear gallery
    currentGallery = [];
    currentIndex = 0;
  }

  function getFocusableElements() {
    if (!lightboxElement) return [];
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(lightboxElement.querySelectorAll(selector)).filter(el => {
      return !el.hasAttribute('disabled') && el.offsetParent !== null;
    });
  }

  function attachKeydown() {
    if (keydownHandler) return;
    keydownHandler = (e) => {
      if (!isOpen()) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigate('prev');
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigate('next');
        return;
      }

      // Focus trap
      if (e.key === 'Tab') {
        const focusables = getFocusableElements();
        if (!focusables.length) {
          e.preventDefault();
          lightboxElement.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === lightboxElement) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', keydownHandler);
  }

  function detachKeydown() {
    if (!keydownHandler) return;
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }

  /**
   * Navigate between images
   */
  function navigate(direction) {
    if (direction === 'prev' && currentIndex > 0) {
      currentIndex--;
      updateDisplay();
    } else if (direction === 'next' && currentIndex < currentGallery.length - 1) {
      currentIndex++;
      updateDisplay();
    }
  }

  /**
   * Check if lightbox is open
   */
  function isOpen() {
    return lightboxElement && lightboxElement.classList.contains('screenshot-lightbox--open');
  }

  /**
   * Initialize screenshot gallery
   * Finds all screenshot thumbnails and sets up click handlers
   */
  function init(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) {
      return;
    }

    const screenshots = Array.from(container.querySelectorAll('[data-screenshot]'));
    if (screenshots.length === 0) {
      return;
    }

    // Note: Click handling is done via global event delegation in report-ui.js
    // This function just validates the setup
  }

  // Public API
  window.ScreenshotLightbox = {
    init,
    open,
    close,
    navigate,
    isOpen
  };

})(window);
