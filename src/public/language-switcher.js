/**
 * Language Switcher Component
 * Dropdown for selecting application language
 */

class LanguageSwitcher {
  constructor() {
    this.container = null;
    this.initialized = false;
  }

  /**
   * Initialize and inject language switcher into page
   */
  async init(targetSelector = 'nav') {
    if (this.initialized) return;

    // Wait for i18n to be ready (with timeout)
    if (!window.i18n || !window.i18n.initialized) {
      await new Promise(resolve => {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        const checkI18n = setInterval(() => {
          attempts++;
          if ((window.i18n && window.i18n.initialized) || attempts >= maxAttempts) {
            clearInterval(checkI18n);
            if (attempts >= maxAttempts) {
              console.warn('[LanguageSwitcher] i18n initialization timeout, proceeding with defaults');
            }
            resolve();
          }
        }, 100);
      });
    }

    // Find target location
    const target = document.querySelector(targetSelector);
    if (!target) {
      console.error(`[LanguageSwitcher] Target not found: ${targetSelector}`);
      return;
    }

    // Create and inject switcher
    this.container = this.createSwitcher();
    target.appendChild(this.container);

    // Setup event listeners
    this.setupEventListeners();

    this.initialized = true;
    console.log('[LanguageSwitcher] Initialized successfully');
  }

  /**
   * Create switcher HTML
   */
  createSwitcher() {
    const container = document.createElement('div');
    container.className = 'language-switcher';
    container.innerHTML = this.getSwitcherHTML();
    return container;
  }

  /**
   * Get switcher HTML structure
   */
  getSwitcherHTML() {
    // Fallback language data if i18n isn't ready
    const flagImg = (code) => `<img src="https://flagcdn.com/w40/${code}.png" srcset="https://flagcdn.com/w80/${code}.png 2x" alt="${code.toUpperCase()}" class="flag-img" width="20" height="15">`;
    const defaultLanguages = [
      { code: 'en', name: 'English', flag: flagImg('gb'), active: true },
      { code: 'ja', name: '日本語', flag: flagImg('jp'), active: false },
      { code: 'de', name: 'Deutsch', flag: flagImg('de'), active: false },
      { code: 'es', name: 'Español', flag: flagImg('es'), active: false },
      { code: 'fr', name: 'Français', flag: flagImg('fr'), active: false },
      { code: 'pt', name: 'Português', flag: flagImg('br'), active: false },
      { code: 'zh', name: '中文', flag: flagImg('cn'), active: false }
    ];

    let languages, currentLang, currentFlag;

    if (window.i18n && typeof window.i18n.getSupportedLanguages === 'function') {
      languages = window.i18n.getSupportedLanguages();
      currentLang = window.i18n.currentLanguage || 'en';
      currentFlag = window.i18n.getLanguageFlag ? window.i18n.getLanguageFlag(currentLang) : flagImg('gb');
    } else {
      // Use fallbacks
      currentLang = localStorage.getItem('sm_language') || 'en';
      languages = defaultLanguages.map(l => ({
        ...l,
        active: l.code === currentLang
      }));
      currentFlag = defaultLanguages.find(l => l.code === currentLang)?.flag || flagImg('gb');
    }

    return `
      <div class="language-switcher-trigger" id="languageSwitcherTrigger">
        <span class="language-flag" id="currentLanguageFlag">${currentFlag}</span>
        <span class="language-code">${currentLang.toUpperCase()}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" class="dropdown-arrow">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>

      <div class="language-dropdown" id="languageDropdown">
        ${languages.map(lang => `
          <div class="language-option ${lang.active ? 'active' : ''}" data-lang="${lang.code}">
            <span class="language-flag">${lang.flag}</span>
            <span class="language-name">${lang.name}</span>
            ${lang.active ? '<span class="check-mark">✓</span>' : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const trigger = this.container.querySelector('#languageSwitcherTrigger');
    const dropdown = this.container.querySelector('#languageDropdown');

    // Move dropdown to body for proper z-index layering
    document.body.appendChild(dropdown);
    this.dropdown = dropdown;
    this.trigger = trigger;

    let isOpen = false;

    const showDropdown = () => {
      const rect = trigger.getBoundingClientRect();
      const isLightTheme = document.body.classList.contains('white-theme');
      const textColor = isLightTheme ? '#333' : '#fff';
      const hoverBg = isLightTheme ? 'rgba(0,122,255,0.1)' : 'rgba(0,255,65,0.1)';
      const activeBg = isLightTheme ? 'rgba(0,122,255,0.15)' : 'rgba(0,255,65,0.15)';
      const checkColor = isLightTheme ? '#007aff' : '#00ff41';

      dropdown.style.cssText = `
        position: fixed !important;
        top: ${rect.bottom + 8}px !important;
        right: ${window.innerWidth - rect.right}px !important;
        left: auto !important;
        min-width: 180px !important;
        max-width: 220px !important;
        background: ${isLightTheme ? '#ffffff' : '#1a1a1a'} !important;
        border: 1px solid ${isLightTheme ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)'} !important;
        border-radius: 8px !important;
        box-shadow: 0 8px 32px ${isLightTheme ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.5)'} !important;
        z-index: 2147483647 !important;
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        transform: none !important;
        overflow: hidden !important;
        padding: 0.25rem 0 !important;
      `;

      // Style the options
      dropdown.querySelectorAll('.language-option').forEach(opt => {
        const isActive = opt.classList.contains('active');
        opt.style.cssText = `
          display: flex !important;
          align-items: center !important;
          gap: 0.75rem !important;
          padding: 0.65rem 1rem !important;
          cursor: pointer !important;
          color: ${textColor} !important;
          background: ${isActive ? activeBg : 'transparent'} !important;
          border-left: ${isActive ? `3px solid ${checkColor}` : '3px solid transparent'} !important;
          transition: background 0.15s ease !important;
        `;

        // Style children
        const nameEl = opt.querySelector('.language-name');
        if (nameEl) nameEl.style.cssText = `flex: 1; font-size: 0.9rem; color: ${textColor};`;

        const checkEl = opt.querySelector('.check-mark');
        if (checkEl) checkEl.style.cssText = `color: ${checkColor}; font-weight: bold;`;

        // Hover effects
        opt.onmouseenter = () => { if (!opt.classList.contains('active')) opt.style.background = hoverBg; };
        opt.onmouseleave = () => { if (!opt.classList.contains('active')) opt.style.background = 'transparent'; };
      });

      isOpen = true;
    };

    const hideDropdown = () => {
      dropdown.style.cssText = 'display: none !important; visibility: hidden !important;';
      isOpen = false;
    };

    // Start hidden
    hideDropdown();

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isOpen) {
        hideDropdown();
      } else {
        showDropdown();
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (isOpen && !this.container.contains(e.target) && !dropdown.contains(e.target)) {
        hideDropdown();
      }
    });

    // Reposition on scroll/resize
    window.addEventListener('scroll', () => { if (isOpen) showDropdown(); }, { passive: true });
    window.addEventListener('resize', () => { if (isOpen) showDropdown(); }, { passive: true });

    // Handle language selection
    const options = dropdown.querySelectorAll('.language-option');
    options.forEach(option => {
      option.addEventListener('click', async (e) => {
        const lang = option.getAttribute('data-lang');

        // Update UI immediately
        options.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        hideDropdown();

        // Switch language
        if (window.i18n && window.i18n.switchLanguage) {
          await window.i18n.switchLanguage(lang);
        }

        // Update switcher UI
        this.updateUI();
      });
    });
  }

  /**
   * Update switcher UI after language change
   */
  updateUI() {
    if (!this.container) return;

    const currentLang = window.i18n?.currentLanguage || 'en';
    const flagElement = this.container.querySelector('#currentLanguageFlag');
    const codeElement = this.container.querySelector('.language-code');

    if (flagElement && window.i18n?.getLanguageFlag) {
      flagElement.innerHTML = window.i18n.getLanguageFlag(currentLang);
    }
    if (codeElement) {
      codeElement.textContent = currentLang.toUpperCase();
    }

    // Update active state in dropdown (which is now in body)
    const dropdown = this.dropdown || document.getElementById('languageDropdown');
    if (dropdown) {
      dropdown.querySelectorAll('.language-option').forEach(option => {
        const lang = option.getAttribute('data-lang');
        if (lang === currentLang) {
          option.classList.add('active');
          option.innerHTML = `
            <span class="language-flag">${window.i18n?.getLanguageFlag?.(lang) || ''}</span>
            <span class="language-name">${window.i18n?.getLanguageName?.(lang) || lang}</span>
            <span class="check-mark">✓</span>
          `;
        } else {
          option.classList.remove('active');
          option.innerHTML = `
            <span class="language-flag">${window.i18n?.getLanguageFlag?.(lang) || ''}</span>
            <span class="language-name">${window.i18n?.getLanguageName?.(lang) || lang}</span>
          `;
        }
      });
    }
  }

  /**
   * Get CSS styles for language switcher
   */
  static getStyles() {
    return `
      /* Language Switcher */
      .language-switcher {
        position: relative;
        display: inline-flex;
        align-items: center;
        z-index: 2147483646 !important; /* Very high z-index to ensure it's above other elements */
        isolation: isolate; /* Create new stacking context */
      }
      
      /* When in header container, no auto margin */
      .language-selector-header .language-switcher {
        margin-left: 0;
      }
      
      /* When in nav, push to the right */
      nav .language-switcher {
        margin-left: auto;
      }

      .language-switcher-trigger {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.6rem 0.6rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: 'Courier New', monospace;
        white-space: nowrap;
        font-size: 0.8rem;
      }

      .language-switcher-trigger:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(0, 255, 65, 0.5);
      }

      .language-flag {
        display: inline-flex;
        align-items: center;
        line-height: 1;
      }

      .flag-img {
        width: 20px;
        height: 15px;
        object-fit: cover;
        border-radius: 2px;
        vertical-align: middle;
      }

      .language-code {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-primary, #00ff41);
        letter-spacing: 0.5px;
      }

      .dropdown-arrow {
        transition: transform 0.2s ease;
        color: var(--text-secondary, #888);
      }

      .language-switcher-trigger:hover .dropdown-arrow {
        color: var(--text-primary, #00ff41);
      }

      .language-dropdown {
        position: absolute;
        top: calc(100% + 0.5rem);
        right: 0;
        min-width: 180px;
        max-width: 220px;
        background: var(--bg-secondary, #1a1a1a);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
        opacity: 0;
        visibility: hidden;
        transform: translateY(-10px);
        transition: all 0.2s ease;
        overflow: hidden;
        z-index: 2147483647 !important; /* Maximum z-index value */
      }

      .language-dropdown.show {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .language-option {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        cursor: pointer;
        transition: all 0.15s ease;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .language-option:last-child {
        border-bottom: none;
      }

      .language-option:hover {
        background: rgba(0, 255, 65, 0.1);
      }

      .language-option.active {
        background: rgba(0, 255, 65, 0.15);
        border-left: 3px solid #00ff41;
      }

      .language-option .language-name {
        flex: 1;
        font-size: 0.9rem;
        color: var(--text-primary, #ffffff);
      }

      .language-option .check-mark {
        color: #00ff41;
        font-weight: bold;
      }

      /* Light mode adjustments */
      body.white-theme .language-switcher-trigger {
        background: rgba(0, 0, 0, 0.04);
        border-color: rgba(0, 0, 0, 0.12);
      }

      body.white-theme .language-switcher-trigger:hover {
        background: rgba(0, 0, 0, 0.06);
        border-color: rgba(0, 0, 0, 0.2);
      }

      body.white-theme .language-code {
        color: #333;
      }

      body.white-theme .language-dropdown {
        background: #ffffff;
        border-color: rgba(0, 0, 0, 0.15);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }

      body.white-theme .language-option {
        border-bottom-color: rgba(0, 0, 0, 0.05);
      }

      body.white-theme .language-option:hover {
        background: rgba(0, 122, 255, 0.1);
      }

      body.white-theme .language-option.active {
        background: rgba(0, 122, 255, 0.15);
        border-left-color: #007aff;
      }

      body.white-theme .language-option .language-name {
        color: #333;
      }

      body.white-theme .language-option .check-mark {
        color: #007aff;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .language-switcher {
          margin-left: 0;
          margin-right: 0.5rem;
        }

        .language-switcher-trigger {
          padding: 0.3rem 0.5rem;
          gap: 0.3rem;
          font-size: 0.75rem;
        }

        .language-flag {
          font-size: 0.95rem;
          /* flag images used instead of emoji */
        }

        .language-code {
          font-size: 0.7rem;
        }

        .language-dropdown {
          right: 0;
          left: auto;
          min-width: 160px;
          max-width: 90vw;
        }
      }

      @media (max-width: 480px) {
        .language-switcher {
          margin-right: 0.25rem;
        }

        .language-switcher-trigger {
          padding: 0.25rem 0.4rem;
          gap: 0.25rem;
          font-size: 0.7rem;
        }

        .language-flag {
          font-size: 0.9rem;
          /* flag images used instead of emoji */
        }

        .language-code {
          display: none;
        }

        .dropdown-arrow {
          width: 8px;
          height: 8px;
        }

        .language-dropdown {
          right: 0;
          left: auto;
          min-width: 150px;
          max-width: 85vw;
        }

        .language-option {
          padding: 0.6rem 0.75rem;
          gap: 0.5rem;
        }

        .language-option .language-name {
          font-size: 0.8rem;
        }

        .language-option .language-flag {
          font-size: 1rem;
          /* flag images used instead of emoji */
        }
      }

      /* Extra small screens */
      @media (max-width: 360px) {
        .language-switcher-trigger {
          padding: 0.3rem 0.4rem;
        }

        .language-flag {
          font-size: 0.95rem;
          /* flag images used instead of emoji */
        }

        .language-dropdown {
          min-width: 150px;
          max-width: 80vw;
        }

        .language-option {
          padding: 0.6rem 0.75rem;
        }

        .language-option .language-name {
          font-size: 0.8rem;
        }
      }
    `;
  }

  /**
   * Inject styles into page
   */
  static injectStyles() {
    if (document.getElementById('language-switcher-styles')) return;

    const style = document.createElement('style');
    style.id = 'language-switcher-styles';
    style.textContent = LanguageSwitcher.getStyles();
    document.head.appendChild(style);
  }
}

// Auto-inject styles
LanguageSwitcher.injectStyles();

// Export for use
window.LanguageSwitcher = LanguageSwitcher;

// Store instance globally for nav-template to use
window.languageSwitcher = new LanguageSwitcher();
