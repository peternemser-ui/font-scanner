/**
 * SEO i18n Helper - Dynamic Meta Tag Updates for Multilingual SEO
 * Integrates with existing language-switcher.js for seamless i18n
 */

(function() {
  'use strict';

  // Language configuration
  const VALID_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja'];
  const DEFAULT_LANGUAGE = 'en';

  // Locale mapping for og:locale
  const LOCALE_MAP = {
    'en': 'en_US',
    'es': 'es_ES',
    'fr': 'fr_FR',
    'de': 'de_DE',
    'pt': 'pt_PT',
    'zh': 'zh_CN',
    'ja': 'ja_JP'
  };

  /**
   * Detects language from URL path or localStorage
   * @returns {string} Detected language code
   */
  function detectLanguage() {
    // Check URL path first (e.g., /en/page.html)
    const pathParts = window.location.pathname.split('/').filter(p => p);
    const urlLang = pathParts[0];

    if (VALID_LANGUAGES.includes(urlLang)) {
      return urlLang;
    }

    // Fallback to localStorage (set by language-switcher.js)
    const storedLang = localStorage.getItem('preferred-language') || localStorage.getItem('preferredLanguage');
    if (storedLang && VALID_LANGUAGES.includes(storedLang)) {
      return storedLang;
    }

    // Default to English
    return DEFAULT_LANGUAGE;
  }

  /**
   * Gets page identifier from filename
   * @returns {string} Page identifier (e.g., 'security-analyzer')
   */
  function getPageId() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    return filename.replace('.html', '').replace('index', 'home');
  }

  /**
   * Gets the base URL for the current page (for hreflang and canonical)
   * @param {string} pageId - Page identifier
   * @returns {string} Base URL
   */
  function getBaseUrl(pageId) {
    const domain = 'https://sitemechanic.io';
    const page = pageId === 'home' ? '' : `${pageId}.html`;
    return page ? `${domain}/{{LANG}}/${page}` : `${domain}/{{LANG}}/`;
  }

  /**
   * Updates a meta tag or creates it if it doesn't exist
   * @param {string} selector - CSS selector for the meta tag
   * @param {string} content - New content value
   * @param {string} attribute - Attribute to update (default: 'content')
   */
  function updateMetaTag(selector, content, attribute = 'content') {
    if (!content) return;

    const tag = document.querySelector(selector);

    if (tag) {
      tag.setAttribute(attribute, content);
    } else {
      // Create tag if it doesn't exist
      const meta = document.createElement('meta');

      // Parse selector to get attribute name and value
      const matches = selector.match(/\[(.*?)=['"](.*?)['"]\]/);
      if (matches) {
        meta.setAttribute(matches[1], matches[2]);
        meta.setAttribute(attribute, content);
        document.head.appendChild(meta);
      }
    }
  }

  /**
   * Updates canonical and hreflang link tags
   * @param {string} lang - Current language
   * @param {string} baseUrl - Base URL template
   */
  function updateLinkTags(lang, baseUrl) {
    // Update canonical URL
    const canonicalUrl = baseUrl.replace('{{LANG}}', lang);
    let canonical = document.querySelector('link[rel="canonical"]');

    if (canonical) {
      canonical.setAttribute('href', canonicalUrl);
    } else {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.setAttribute('href', canonicalUrl);
      document.head.appendChild(canonical);
    }

    // Update or create hreflang tags for all languages
    VALID_LANGUAGES.forEach(hrefLang => {
      const hrefUrl = baseUrl.replace('{{LANG}}', hrefLang);
      const selector = `link[rel="alternate"][hreflang="${hrefLang}"]`;
      let hrefTag = document.querySelector(selector);

      if (hrefTag) {
        hrefTag.setAttribute('href', hrefUrl);
      } else {
        hrefTag = document.createElement('link');
        hrefTag.setAttribute('rel', 'alternate');
        hrefTag.setAttribute('hreflang', hrefLang);
        hrefTag.setAttribute('href', hrefUrl);
        document.head.appendChild(hrefTag);
      }
    });

    // Add x-default hreflang pointing to English
    const defaultUrl = baseUrl.replace('{{LANG}}', DEFAULT_LANGUAGE);
    let xDefault = document.querySelector('link[rel="alternate"][hreflang="x-default"]');

    if (xDefault) {
      xDefault.setAttribute('href', defaultUrl);
    } else {
      xDefault = document.createElement('link');
      xDefault.setAttribute('rel', 'alternate');
      xDefault.setAttribute('hreflang', 'x-default');
      xDefault.setAttribute('href', defaultUrl);
      document.head.appendChild(xDefault);
    }
  }

  /**
   * Updates all SEO meta tags with translated content
   * @param {Object} seoData - SEO data from i18n JSON
   * @param {string} lang - Current language code
   * @param {string} baseUrl - Base URL for the page
   */
  function updateSEOTags(seoData, lang, baseUrl) {
    if (!seoData) return;

    const currentUrl = baseUrl.replace('{{LANG}}', lang);
    const locale = LOCALE_MAP[lang];

    // Update document title
    if (seoData.title) {
      document.title = seoData.title;
    }

    // Update html lang attribute
    document.documentElement.setAttribute('lang', lang);

    // Primary meta tags
    updateMetaTag('meta[name="description"]', seoData.description);
    updateMetaTag('meta[name="keywords"]', seoData.keywords);

    // Open Graph tags
    updateMetaTag('meta[property="og:title"]', seoData.og_title || seoData.title);
    updateMetaTag('meta[property="og:description"]', seoData.description);
    updateMetaTag('meta[property="og:url"]', currentUrl);
    updateMetaTag('meta[property="og:locale"]', locale);

    // Update og:locale:alternate tags
    const alternateLocales = VALID_LANGUAGES
      .filter(l => l !== lang)
      .map(l => LOCALE_MAP[l]);

    // Remove existing alternate locales
    document.querySelectorAll('meta[property="og:locale:alternate"]').forEach(tag => tag.remove());

    // Add new alternate locales
    alternateLocales.forEach(altLocale => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:locale:alternate');
      meta.setAttribute('content', altLocale);
      document.head.appendChild(meta);
    });

    // Twitter Card tags
    updateMetaTag('meta[name="twitter:title"]', seoData.twitter_title || seoData.title);
    updateMetaTag('meta[name="twitter:description"]', seoData.description);
    updateMetaTag('meta[name="twitter:url"]', currentUrl);

    // Update Schema.org JSON-LD if present
    updateSchemaData(lang, currentUrl);
  }

  /**
   * Updates Schema.org JSON-LD data with current language and URLs
   * @param {string} lang - Current language
   * @param {string} currentUrl - Current page URL
   */
  function updateSchemaData(lang, currentUrl) {
    const schemaScript = document.querySelector('script[type="application/ld+json"]');
    if (!schemaScript) return;

    try {
      const schema = JSON.parse(schemaScript.textContent);

      // Update URLs in schema
      if (schema['@graph']) {
        schema['@graph'].forEach(item => {
          if (item.url) item.url = currentUrl;
          if (item.itemListElement) {
            // Update breadcrumb URLs
            item.itemListElement.forEach(breadcrumb => {
              if (breadcrumb.item) {
                breadcrumb.item = breadcrumb.item.replace(/\/(en|es|fr|de|pt|zh|ja)\//, `/${lang}/`);
              }
            });
          }
        });
      } else {
        if (schema.url) schema.url = currentUrl;
      }

      schemaScript.textContent = JSON.stringify(schema, null, 2);
    } catch (e) {
    }
  }

  /**
   * Loads i18n translations and updates meta tags
   * @returns {Promise<void>}
   */
  async function updateSEOMetaTags() {
    try {
      const lang = detectLanguage();
      const pageId = getPageId();
      const baseUrl = getBaseUrl(pageId);

      // Update link tags (canonical and hreflang)
      updateLinkTags(lang, baseUrl);

      // Load translations
      const response = await fetch(`/i18n/${lang}.json`);
      if (!response.ok) {
        return;
      }

      const translations = await response.json();
      const seoData = translations.seo?.pages?.[pageId];

      if (!seoData) {
        return;
      }

      // Update all SEO meta tags
      updateSEOTags(seoData, lang, baseUrl);

      // Dispatch custom event for other scripts to react
      window.dispatchEvent(new CustomEvent('seo-i18n-updated', {
        detail: { lang, pageId, seoData }
      }));

    } catch (error) {
      console.error('Error updating SEO meta tags:', error);
    }
  }

  /**
   * Initialize SEO i18n on page load
   */
  function init() {
    // Run on DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateSEOMetaTags);
    } else {
      updateSEOMetaTags();
    }

    // Listen for language changes from language-switcher.js
    window.addEventListener('languageChanged', function(e) {
      if (e.detail && e.detail.language) {
        updateSEOMetaTags();
      }
    });
  }

  // Export for potential external use
  window.SEOi18n = {
    detectLanguage,
    getPageId,
    updateSEOMetaTags,
    VALID_LANGUAGES,
    LOCALE_MAP
  };

  // Auto-initialize
  init();

})();
