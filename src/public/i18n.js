/**
 * Lightweight Internationalization (i18n) Library
 * Handles language detection, switching, and translation
 */

// Exported constants for consistency
const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh', 'ru'];
const STORAGE_KEY = 'sm_lang';

class I18n {
  constructor() {
    this.currentLanguage = null;
    this.translations = {};
    this.fallbackLanguage = 'en';
    this.supportedLanguages = SUPPORTED_LOCALES;
    this.initialized = false;
  }

  /**
   * Initialize i18n system
   */
  async init() {
    if (this.initialized) return;

    // Detect language (URL path > URL param > cookie > localStorage > browser > fallback)
    this.currentLanguage = this.detectLanguage();

    // Load translation file
    await this.loadTranslations(this.currentLanguage);

    // Apply translations to page
    this.translatePage();

    // Inject SEO tags (hreflang and canonical)
    this.injectHreflangTags();
    this.updateCanonicalUrl();

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
   * Priority: URL path (/ja/) > URL ?lang= > cookie (sm_url_lang) > localStorage > browser language > fallback
   */
  detectLanguage() {
    // 1. Check URL path prefix (e.g., /ja/seo-analyzer.html) - highest priority for SEO
    const pathLang = this.getLanguageFromPath();
    if (pathLang && this.supportedLanguages.includes(pathLang)) {
      // Persist to localStorage for consistency
      localStorage.setItem(STORAGE_KEY, pathLang);
      return pathLang;
    }

    // 2. Check URL parameter ?lang=xx
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang && this.supportedLanguages.includes(urlLang)) {
      // Persist URL override to localStorage for consistency
      localStorage.setItem(STORAGE_KEY, urlLang);
      return urlLang;
    }

    // 3. Check cookie set by server (sm_url_lang)
    const cookieLang = this.getCookie('sm_url_lang');
    if (cookieLang && this.supportedLanguages.includes(cookieLang)) {
      localStorage.setItem(STORAGE_KEY, cookieLang);
      return cookieLang;
    }

    // 4. Check localStorage (sm_lang is canonical, check legacy keys for migration)
    const savedLang = localStorage.getItem(STORAGE_KEY) ||
                      localStorage.getItem('preferred-language') ||
                      localStorage.getItem('preferredLanguage');
    if (savedLang && this.supportedLanguages.includes(savedLang)) {
      // Migrate to canonical key if needed
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, savedLang);
      }
      return savedLang;
    }

    // 5. Check browser language (Accept-Language header equivalent)
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0]; // 'en-US' -> 'en'

    if (this.supportedLanguages.includes(langCode)) {
      return langCode;
    }

    // 6. Fallback
    return this.fallbackLanguage;
  }

  /**
   * Extract language code from URL path (e.g., /ja/seo-analyzer.html -> 'ja')
   */
  getLanguageFromPath() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const firstPart = pathParts[0];

    if (firstPart && this.supportedLanguages.includes(firstPart)) {
      return firstPart;
    }
    return null;
  }

  /**
   * Get cookie value by name
   */
  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop().split(';').shift();
    }
    return null;
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
    let lastObj = null;
    let lastObjIdx = -1;

    // Navigate through nested object
    for (let i = 0; i < keys.length; i++) {
      if (value && typeof value === 'object' && keys[i] in value) {
        lastObj = value;
        lastObjIdx = i;
        value = value[keys[i]];
      } else if (value && typeof value === 'object') {
        // Fallback: check for literal dotted key (e.g. "consent.overviewHeading")
        const remaining = keys.slice(i).join('.');
        if (remaining in value) {
          value = value[remaining];
          break;
        }
        return key; // Return key if translation not found
      } else {
        // value is not an object but segments remain — backtrack and try
        // a literal dotted key from the parent (e.g. "recommendations.noneTitle"
        // when "recommendations" resolved to a string)
        if (lastObj) {
          const remaining = keys.slice(lastObjIdx).join('.');
          if (remaining in lastObj) {
            value = lastObj[remaining];
            break;
          }
        }
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
   * @param {string} lang - Language code to switch to
   * @param {boolean} updateUrl - Whether to update the URL (default: true for SEO)
   */
  async switchLanguage(lang, updateUrl = true) {
    if (!this.supportedLanguages.includes(lang)) {
      console.error(`Unsupported language: ${lang}`);
      return;
    }

    if (lang === this.currentLanguage) return;

    // Save preference (sm_lang is the canonical key)
    localStorage.setItem(STORAGE_KEY, lang);
    // Back-compat for older scripts (will be removed in future)
    localStorage.setItem('preferred-language', lang);
    localStorage.setItem('preferredLanguage', lang);

    // Set cookie for server-side detection
    document.cookie = `sm_url_lang=${lang}; max-age=${365 * 24 * 60 * 60}; path=/; samesite=lax`;

    // Update URL if requested (for SEO-friendly language switching)
    if (updateUrl) {
      const newUrl = this.getUrlForLanguage(lang);
      // Navigate to new URL (full page reload to ensure proper server-side handling)
      window.location.href = newUrl;
      return; // Stop here - page will reload
    }

    // If not updating URL, just update translations in place
    await this.loadTranslations(lang);
    this.currentLanguage = lang;

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
   * Get URL for a specific language
   * @param {string} lang - Target language code
   * @returns {string} Full URL with language prefix
   */
  getUrlForLanguage(lang) {
    const currentPath = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;

    // Check if current path already has a language prefix
    const pathParts = currentPath.split('/').filter(Boolean);
    const firstPart = pathParts[0];

    let newPath;
    if (firstPart && this.supportedLanguages.includes(firstPart)) {
      // Replace existing language prefix
      pathParts[0] = lang;
      newPath = '/' + pathParts.join('/');
    } else {
      // Add language prefix
      newPath = '/' + lang + currentPath;
    }

    // Ensure trailing slash consistency
    if (currentPath.endsWith('/') && !newPath.endsWith('/')) {
      newPath += '/';
    }

    return newPath + search + hash;
  }

  /**
   * Get current URL path without language prefix
   */
  getPathWithoutLanguage() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const firstPart = pathParts[0];

    if (firstPart && this.supportedLanguages.includes(firstPart)) {
      return '/' + pathParts.slice(1).join('/') || '/';
    }
    return window.location.pathname;
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

    // Update flag image if present
    const flagElement = document.getElementById('currentLanguageFlag');
    if (flagElement) {
      flagElement.innerHTML = this.getLanguageFlag(this.currentLanguage);
    }
  }

  /**
   * Get flag HTML for language (uses flagcdn.com images since Windows lacks emoji flags)
   */
  getLanguageFlag(lang) {
    const countryCodes = {
      'en': 'gb',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'pt': 'br',
      'zh': 'cn',
      'ja': 'jp',
      'ru': 'ru'
    };
    const code = countryCodes[lang] || 'gb';
    return `<img src="https://flagcdn.com/w40/${code}.png" srcset="https://flagcdn.com/w80/${code}.png 2x" alt="${lang.toUpperCase()}" class="flag-img" width="20" height="15">`;
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
      'ja': '日本語',
      'ru': 'Русский'
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

  /**
   * Format date and time according to locale (commonly used in reports)
   * @param {Date|string|number} date - Date to format
   * @param {Object} options - Optional Intl.DateTimeFormat options
   * @returns {string} Formatted date and time string
   */
  formatDateTime(date, options = {}) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);

    const locale = this.currentLanguage || 'en';
    const defaultOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: locale.startsWith('en'), // 12-hour for English, 24-hour for others
      timeZoneName: 'short'
    };

    return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(d);
  }

  /**
   * Format currency according to locale
   */
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat(this.currentLanguage, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Get current locale code
   */
  getActiveLocale() {
    return this.currentLanguage || this.fallbackLanguage;
  }

  /**
   * Set locale (alias for switchLanguage)
   */
  setLocale(lang) {
    return this.switchLanguage(lang);
  }

  /**
   * Force locale for print/PDF mode without persisting to storage.
   * Loads the translation file, applies translations to the page,
   * but does NOT update localStorage, cookies, or URL.
   * @param {string} lang - Language code to force
   */
  async forceLocale(lang) {
    if (!this.supportedLanguages.includes(lang)) {
      console.warn(`[i18n] forceLocale: unsupported language "${lang}", using fallback`);
      lang = this.fallbackLanguage;
    }
    if (lang === this.currentLanguage && Object.keys(this.translations).length > 0) {
      return; // already loaded
    }
    this.currentLanguage = lang;
    await this.loadTranslations(lang);
    this.translatePage();
    window.dispatchEvent(
      new CustomEvent('languageChanged', {
        detail: { language: lang, forced: true }
      })
    );
  }

  /**
   * Inject hreflang tags into document head for SEO
   * Call this after page load to add alternate language URLs
   */
  injectHreflangTags() {
    // Remove any existing hreflang tags
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove());

    const basePath = this.getPathWithoutLanguage();
    const origin = window.location.origin;

    // Add hreflang for each supported language
    this.supportedLanguages.forEach(lang => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = lang;
      link.href = `${origin}/${lang}${basePath}`;
      document.head.appendChild(link);
    });

    // Add x-default (usually points to English or auto-detect)
    const xDefault = document.createElement('link');
    xDefault.rel = 'alternate';
    xDefault.hreflang = 'x-default';
    xDefault.href = `${origin}/en${basePath}`;
    document.head.appendChild(xDefault);
  }

  /**
   * Update canonical URL to include language prefix
   */
  updateCanonicalUrl() {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }

    const origin = window.location.origin;
    const lang = this.currentLanguage;
    const basePath = this.getPathWithoutLanguage();
    canonical.href = `${origin}/${lang}${basePath}`;
  }
}

// Create global instance
window.i18n = new I18n();

// Export constants for external use
window.i18n.SUPPORTED_LOCALES = SUPPORTED_LOCALES;
window.i18n.STORAGE_KEY = STORAGE_KEY;

// Convenience alias: t() function at window level
window.t = (key, params) => window.i18n.t(key, params);

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.i18n.init());
} else {
  window.i18n.init();
}
