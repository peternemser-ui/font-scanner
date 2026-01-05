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

    // Wait for i18n to be ready
    if (!window.i18n || !window.i18n.initialized) {
      await new Promise(resolve => {
        const checkI18n = setInterval(() => {
          if (window.i18n && window.i18n.initialized) {
            clearInterval(checkI18n);
            resolve();
          }
        }, 100);
      });
    }

    // Find target location
    const target = document.querySelector(targetSelector);
    if (!target) {
      console.error(`Language switcher target not found: ${targetSelector}`);
      return;
    }

    // Create and inject switcher
    this.container = this.createSwitcher();
    target.appendChild(this.container);

    // Setup event listeners
    this.setupEventListeners();

    this.initialized = true;
    console.log('✓ Language switcher initialized');
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
    const languages = window.i18n.getSupportedLanguages();
    const currentLang = window.i18n.currentLanguage;
    const currentFlag = window.i18n.getLanguageFlag(currentLang);

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
    const options = this.container.querySelectorAll('.language-option');

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });

    // Handle language selection
    options.forEach(option => {
      option.addEventListener('click', async (e) => {
        const lang = option.getAttribute('data-lang');

        // Update UI immediately
        options.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        dropdown.classList.remove('show');

        // Switch language
        await window.i18n.switchLanguage(lang);

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

    const currentLang = window.i18n.currentLanguage;
    const flagElement = this.container.querySelector('#currentLanguageFlag');
    const codeElement = this.container.querySelector('.language-code');

    if (flagElement) {
      flagElement.textContent = window.i18n.getLanguageFlag(currentLang);
    }
    if (codeElement) {
      codeElement.textContent = currentLang.toUpperCase();
    }

    // Update active state in dropdown
    this.container.querySelectorAll('.language-option').forEach(option => {
      const lang = option.getAttribute('data-lang');
      if (lang === currentLang) {
        option.classList.add('active');
        option.innerHTML = `
          <span class="language-flag">${window.i18n.getLanguageFlag(lang)}</span>
          <span class="language-name">${window.i18n.getLanguageName(lang)}</span>
          <span class="check-mark">✓</span>
        `;
      } else {
        option.classList.remove('active');
        option.innerHTML = `
          <span class="language-flag">${window.i18n.getLanguageFlag(lang)}</span>
          <span class="language-name">${window.i18n.getLanguageName(lang)}</span>
        `;
      }
    });
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
        z-index: 99999 !important;
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
        padding: 0.35rem 0.6rem;
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
        font-size: 1rem;
        line-height: 1;
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
        z-index: 100000 !important;
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
        }
      }

      /* Extra small screens */
      @media (max-width: 360px) {
        .language-switcher-trigger {
          padding: 0.3rem 0.4rem;
        }

        .language-flag {
          font-size: 0.95rem;
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
