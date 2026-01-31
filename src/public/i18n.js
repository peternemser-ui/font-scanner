/**
 * Lightweight Internationalization (i18n) Library
 * Handles language detection, switching, and translation
 */

class I18n {
  constructor() {
    this.currentLanguage = null;
    this.translations = {};
    this.fallbackLanguage = 'en';
    this.supportedLanguages = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja'];
    this.initialized = false;
  }

  /**
   * Initialize i18n system
   */
  async init() {
    if (this.initialized) return;

    // Detect language (localStorage > browser > fallback)
    this.currentLanguage = this.detectLanguage();

    // Load translation file
    await this.loadTranslations(this.currentLanguage);

    // Apply translations to page
    this.translatePage();

    // Notify listeners (dynamic pages can re-render without reload)
    window.dispatchEvent(
      new CustomEvent('languageChanged', {
        detail: { language: this.currentLanguage, initial: true }
      })
    );

    this.initialized = true;
  }

  /**
   * Detect user's preferred language
   * Priority: URL ?lang= > localStorage > browser language > fallback
   */
  detectLanguage() {
    // 1. Check URL parameter ?lang=xx (highest priority)
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang && this.supportedLanguages.includes(urlLang)) {
      // Persist URL override to localStorage for consistency
      localStorage.setItem('preferred-language', urlLang);
      return urlLang;
    }

    // 2. Check localStorage
    const savedLang = localStorage.getItem('preferred-language') || localStorage.getItem('preferredLanguage');
    if (savedLang && this.supportedLanguages.includes(savedLang)) {
      return savedLang;
    }

    // 3. Check browser language (Accept-Language header equivalent)
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0]; // 'en-US' -> 'en'

    if (this.supportedLanguages.includes(langCode)) {
      return langCode;
    }

    // 4. Fallback
    return this.fallbackLanguage;
  }

  /**
   * Load translation file for a language
   */
  async loadTranslations(lang) {
    try {
      const response = await fetch(`/i18n/${lang}.json`);
      if (!response.ok) throw new Error(`Failed to load ${lang}.json`);

      this.translations = await response.json();
    } catch (error) {
      console.error(`Failed to load translations for ${lang}, falling back to ${this.fallbackLanguage}:`, error);

      if (lang !== this.fallbackLanguage) {
        this.currentLanguage = this.fallbackLanguage;
        await this.loadTranslations(this.fallbackLanguage);
      } else {
        this.translations = {}; // Empty translations as last resort
      }
    }
  }

  /**
   * Get translated text by key
   * Supports nested keys with dot notation: 'nav.dashboard'
   */
  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations;

    // Navigate through nested object
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    // Replace parameters in translation
    if (typeof value === 'string' && Object.keys(params).length > 0) {
      Object.keys(params).forEach(param => {
        value = value.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
      });
    }

    return value;
  }

  /**
   * Switch to a different language
   */
  async switchLanguage(lang) {
    if (!this.supportedLanguages.includes(lang)) {
      console.error(`Unsupported language: ${lang}`);
      return;
    }

    if (lang === this.currentLanguage) return;

    // Load new translations
    await this.loadTranslations(lang);
    this.currentLanguage = lang;

    // Save preference
    localStorage.setItem('preferred-language', lang);
    // Back-compat for older scripts
    localStorage.setItem('preferredLanguage', lang);

    // Update page
    this.translatePage();

    // Update language switcher UI
    this.updateLanguageSwitcher();

    // Notify listeners (dynamic pages can re-render without reload)
    window.dispatchEvent(
      new CustomEvent('languageChanged', {
        detail: { language: lang }
      })
    );
  }

  /**
   * Translate all elements with data-i18n attribute
   */
  translatePage() {
    // Update html lang attribute for SEO and accessibility
    document.documentElement.setAttribute('lang', this.currentLanguage);

    // Translate elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.t(key);

      // Check if element should translate different attribute
      const attr = element.getAttribute('data-i18n-attr');
      if (attr) {
        element.setAttribute(attr, translation);
      } else {
        element.textContent = translation;
      }
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = this.t(key);
    });

    // Translate titles
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = this.t(key);
    });

    // Update page title
    const titleKey = document.documentElement.getAttribute('data-i18n-title');
    if (titleKey) {
      document.title = this.t(titleKey);
    }
  }

  /**
   * Update language switcher UI to reflect current language
   */
  updateLanguageSwitcher() {
    const switcher = document.getElementById('languageSwitcher');
    if (switcher) {
      switcher.value = this.currentLanguage;
    }

    // Update flag emoji if present
    const flagElement = document.getElementById('currentLanguageFlag');
    if (flagElement) {
      flagElement.textContent = this.getLanguageFlag(this.currentLanguage);
    }
  }

  /**
   * Get flag emoji for language
   */
  getLanguageFlag(lang) {
    const flags = {
      'en': '🇬🇧',
      'es': '🇪🇸',
      'fr': '🇫🇷',
      'de': '🇩🇪',
      'pt': '🇵🇹',
      'zh': '🇨🇳',
      'ja': '🇯🇵'
    };
    return flags[lang] || '🌐';
  }

  /**
   * Get language name
   */
  getLanguageName(lang) {
    const names = {
      'en': 'English',
      'es': 'Español',
      'fr': 'Français',
      'de': 'Deutsch',
      'pt': 'Português',
      'zh': '中文',
      'ja': '日本語'
    };
    return names[lang] || lang.toUpperCase();
  }

  /**
   * Get all supported languages with metadata
   */
  getSupportedLanguages() {
    return this.supportedLanguages.map(lang => ({
      code: lang,
      name: this.getLanguageName(lang),
      flag: this.getLanguageFlag(lang),
      active: lang === this.currentLanguage
    }));
  }

  /**
   * Format number according to locale
   */
  formatNumber(number, options = {}) {
    return new Intl.NumberFormat(this.currentLanguage, options).format(number);
  }

  /**
   * Format date according to locale
   */
  formatDate(date, options = {}) {
    return new Intl.DateTimeFormat(this.currentLanguage, options).format(date);
  }
}

// Create global instance
window.i18n = new I18n();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.i18n.init());
} else {
  window.i18n.init();
}
