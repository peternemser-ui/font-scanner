/**
 * Cookie Consent Manager
 * Self-contained IIFE that manages cookie consent for GDPR/CCPA compliance.
 * Blocks Google Analytics until the user opts in.
 */
(function() {
  'use strict';

  const STORAGE_KEY = 'sm_cookie_consent';
  const CONSENT_VERSION = 1;
  const GA_ID = 'G-TZ2S73Q6BK';

  // ── i18n helper ──────────────────────────────────────────────
  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const result = window.i18n.t('cookieConsent.' + key);
      if (result && result !== 'cookieConsent.' + key) return result;
    }
    return fallback;
  }

  // ── Consent state ────────────────────────────────────────────
  function getPreferences() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === CONSENT_VERSION) return parsed;
    } catch (e) { /* corrupt data */ }
    return null;
  }

  function savePreferences(analytics) {
    const prefs = {
      essential: true,
      analytics: !!analytics,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (e) { /* quota */ }
    return prefs;
  }

  function hasConsent(category) {
    const prefs = getPreferences();
    if (!prefs) return false;
    if (category === 'essential') return true;
    return !!prefs[category];
  }

  // ── GA loader ────────────────────────────────────────────────
  let gaLoaded = false;
  function loadGA() {
    if (gaLoaded) return;
    gaLoaded = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  // ── Banner CSS ───────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('smCookieConsentStyles')) return;
    const style = document.createElement('style');
    style.id = 'smCookieConsentStyles';
    style.textContent = [
      '.cc-banner {',
      '  position: fixed; bottom: 0; left: 0; right: 0;',
      '  z-index: 10000;',
      '  background: var(--bg-elevated, #111418);',
      '  border-top: 1px solid var(--border-color, rgba(255,255,255,0.08));',
      '  padding: 1rem 1.5rem;',
      '  transform: translateY(100%);',
      '  transition: transform 0.3s ease;',
      '  font-family: var(--font-body, "Inter", system-ui, sans-serif);',
      '  color: var(--color-text, #fff);',
      '}',
      '.cc-banner.cc-visible { transform: translateY(0); }',
      '.cc-inner {',
      '  max-width: 960px; margin: 0 auto;',
      '  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;',
      '}',
      '.cc-text {',
      '  flex: 1 1 320px; font-size: 0.875rem; line-height: 1.5;',
      '  color: var(--color-text-secondary, #ccc);',
      '}',
      '.cc-text a {',
      '  color: var(--color-primary, #5bf4e7);',
      '  text-decoration: underline; text-underline-offset: 2px;',
      '}',
      '.cc-actions {',
      '  display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;',
      '}',
      '.cc-btn {',
      '  padding: 0.5rem 1.25rem; border-radius: var(--radius-md, 6px);',
      '  font-size: 0.875rem; font-weight: 600; cursor: pointer;',
      '  border: none; transition: opacity 0.15s;',
      '}',
      '.cc-btn:hover { opacity: 0.85; }',
      '.cc-btn--primary {',
      '  background: var(--color-primary, #5bf4e7);',
      '  color: var(--bg-base, #0B0D10);',
      '}',
      '.cc-btn--secondary {',
      '  background: transparent;',
      '  color: var(--color-text-secondary, #ccc);',
      '  border: 1px solid var(--border-color-strong, rgba(255,255,255,0.15));',
      '}',
      '.cc-customize-link {',
      '  background: none; border: none; cursor: pointer;',
      '  color: var(--color-text-muted, #888); font-size: 0.8125rem;',
      '  text-decoration: underline; text-underline-offset: 2px;',
      '  padding: 0.5rem 1.25rem;',
      '}',
      '.cc-details {',
      '  display: none; width: 100%;',
      '  padding-top: 0.75rem; margin-top: 0.75rem;',
      '  border-top: 1px solid var(--border-color-subtle, rgba(255,255,255,0.05));',
      '}',
      '.cc-details.cc-open { display: block; }',
      '.cc-category {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding: 0.5rem 0; font-size: 0.875rem;',
      '}',
      '.cc-category + .cc-category {',
      '  border-top: 1px solid var(--border-color-subtle, rgba(255,255,255,0.05));',
      '}',
      '.cc-cat-info { display: flex; flex-direction: column; gap: 0.125rem; }',
      '.cc-cat-name { font-weight: 600; color: var(--color-text, #fff); }',
      '.cc-cat-desc { font-size: 0.75rem; color: var(--color-text-muted, #888); }',
      '.cc-always-on {',
      '  font-size: 0.75rem; color: var(--color-text-muted, #888);',
      '  font-style: italic;',
      '}',
      /* Toggle switch */
      '.cc-toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; }',
      '.cc-toggle input {',
      '  opacity: 0; width: 0; height: 0; position: absolute;',
      '}',
      '.cc-toggle-slider {',
      '  position: absolute; inset: 0; cursor: pointer;',
      '  background: var(--color-gray-600, #525252); border-radius: 11px;',
      '  transition: background 0.2s;',
      '}',
      '.cc-toggle-slider::before {',
      '  content: ""; position: absolute; left: 3px; top: 3px;',
      '  width: 16px; height: 16px; border-radius: 50%;',
      '  background: #fff; transition: transform 0.2s;',
      '}',
      '.cc-toggle input:checked + .cc-toggle-slider {',
      '  background: var(--color-primary, #5bf4e7);',
      '}',
      '.cc-toggle input:checked + .cc-toggle-slider::before {',
      '  transform: translateX(18px);',
      '}',
      '.cc-save-btn {',
      '  margin-top: 0.75rem;',
      '}',
      /* Mobile stacking */
      '@media (max-width: 600px) {',
      '  .cc-banner { padding: 0.75rem 1rem; }',
      '  .cc-inner { flex-direction: column; align-items: stretch; gap: 0.75rem; }',
      '  .cc-text { flex-basis: auto; font-size: 0.8125rem; }',
      '  .cc-actions { flex-direction: column; gap: 0.5rem; }',
      '  .cc-btn { width: 100%; text-align: center; padding: 0.75rem 1rem; font-size: 1rem; }',
      '  .cc-btn--primary { order: -1; }',
      '  .cc-customize-link { padding: 0.5rem; font-size: 0.8125rem; text-align: center; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Banner DOM ───────────────────────────────────────────────
  let bannerEl = null;
  let detailsEl = null;
  let analyticsToggle = null;

  // References to translatable elements so we can update them later
  let elMsg = null;
  let elPrivacyLink = null;
  let elAcceptBtn = null;
  let elRejectBtn = null;
  let elCustomizeBtn = null;
  let elEssentialName = null;
  let elEssentialDesc = null;
  let elAlwaysOn = null;
  let elAnalyticsName = null;
  let elAnalyticsDesc = null;
  let elSaveBtn = null;

  /**
   * Re-apply translations to all translatable elements.
   * Called on languageChanged or when i18n becomes available after initial render.
   */
  function updateTexts() {
    if (!bannerEl) return;
    if (elMsg) elMsg.textContent = t('message', 'We use cookies to improve your experience and analyze site traffic. ');
    if (elPrivacyLink) elPrivacyLink.textContent = t('privacyPolicy', 'Privacy Policy');
    if (elAcceptBtn) elAcceptBtn.textContent = t('acceptAll', 'Accept All');
    if (elRejectBtn) elRejectBtn.textContent = t('rejectAll', 'Reject All');
    if (elCustomizeBtn) elCustomizeBtn.textContent = t('customize', 'Customize');
    if (elEssentialName) elEssentialName.textContent = t('essential', 'Essential');
    if (elEssentialDesc) elEssentialDesc.textContent = t('essentialDesc', 'Required for the site to function (session, preferences).');
    if (elAlwaysOn) elAlwaysOn.textContent = t('alwaysOn', 'Always on');
    if (elAnalyticsName) elAnalyticsName.textContent = t('analytics', 'Analytics');
    if (elAnalyticsDesc) elAnalyticsDesc.textContent = t('analyticsDesc', 'Help us understand how visitors use the site (Google Analytics).');
    if (elSaveBtn) elSaveBtn.textContent = t('savePreferences', 'Save Preferences');
    bannerEl.setAttribute('aria-label', t('ariaLabel', 'Cookie consent'));
  }

  function createBanner() {
    if (bannerEl) return bannerEl;
    injectStyles();

    bannerEl = document.createElement('div');
    bannerEl.className = 'cc-banner';
    bannerEl.setAttribute('role', 'dialog');
    bannerEl.setAttribute('aria-label', 'Cookie consent');

    const inner = document.createElement('div');
    inner.className = 'cc-inner';

    // Text
    const textEl = document.createElement('p');
    textEl.className = 'cc-text';
    elMsg = document.createTextNode(
      t('message', 'We use cookies to improve your experience and analyze site traffic. ')
    );
    textEl.appendChild(elMsg);
    elPrivacyLink = document.createElement('a');
    elPrivacyLink.href = '/privacy.html#cookies';
    elPrivacyLink.textContent = t('privacyPolicy', 'Privacy Policy');
    textEl.appendChild(elPrivacyLink);
    inner.appendChild(textEl);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'cc-actions';

    elAcceptBtn = document.createElement('button');
    elAcceptBtn.className = 'cc-btn cc-btn--primary';
    elAcceptBtn.textContent = t('acceptAll', 'Accept All');
    elAcceptBtn.addEventListener('click', function() { onAcceptAll(); });

    elRejectBtn = document.createElement('button');
    elRejectBtn.className = 'cc-btn cc-btn--secondary';
    elRejectBtn.textContent = t('rejectAll', 'Reject All');
    elRejectBtn.addEventListener('click', function() { onRejectAll(); });

    elCustomizeBtn = document.createElement('button');
    elCustomizeBtn.className = 'cc-customize-link';
    elCustomizeBtn.textContent = t('customize', 'Customize');
    elCustomizeBtn.addEventListener('click', function() { toggleDetails(); });

    actions.appendChild(elAcceptBtn);
    actions.appendChild(elRejectBtn);
    actions.appendChild(elCustomizeBtn);
    inner.appendChild(actions);

    // Details panel
    detailsEl = document.createElement('div');
    detailsEl.className = 'cc-details';

    // Essential row
    const essentialRow = document.createElement('div');
    essentialRow.className = 'cc-category';
    const essentialInfo = document.createElement('div');
    essentialInfo.className = 'cc-cat-info';
    elEssentialName = document.createElement('span');
    elEssentialName.className = 'cc-cat-name';
    elEssentialName.textContent = t('essential', 'Essential');
    elEssentialDesc = document.createElement('span');
    elEssentialDesc.className = 'cc-cat-desc';
    elEssentialDesc.textContent = t('essentialDesc', 'Required for the site to function (session, preferences).');
    essentialInfo.appendChild(elEssentialName);
    essentialInfo.appendChild(elEssentialDesc);
    elAlwaysOn = document.createElement('span');
    elAlwaysOn.className = 'cc-always-on';
    elAlwaysOn.textContent = t('alwaysOn', 'Always on');
    essentialRow.appendChild(essentialInfo);
    essentialRow.appendChild(elAlwaysOn);
    detailsEl.appendChild(essentialRow);

    // Analytics row
    const analyticsRow = document.createElement('div');
    analyticsRow.className = 'cc-category';
    const analyticsInfo = document.createElement('div');
    analyticsInfo.className = 'cc-cat-info';
    elAnalyticsName = document.createElement('span');
    elAnalyticsName.className = 'cc-cat-name';
    elAnalyticsName.textContent = t('analytics', 'Analytics');
    elAnalyticsDesc = document.createElement('span');
    elAnalyticsDesc.className = 'cc-cat-desc';
    elAnalyticsDesc.textContent = t('analyticsDesc', 'Help us understand how visitors use the site (Google Analytics).');
    analyticsInfo.appendChild(elAnalyticsName);
    analyticsInfo.appendChild(elAnalyticsDesc);

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'cc-toggle';
    analyticsToggle = document.createElement('input');
    analyticsToggle.type = 'checkbox';
    analyticsToggle.checked = false;
    const slider = document.createElement('span');
    slider.className = 'cc-toggle-slider';
    toggleLabel.appendChild(analyticsToggle);
    toggleLabel.appendChild(slider);

    analyticsRow.appendChild(analyticsInfo);
    analyticsRow.appendChild(toggleLabel);
    detailsEl.appendChild(analyticsRow);

    // Save preferences button
    elSaveBtn = document.createElement('button');
    elSaveBtn.className = 'cc-btn cc-btn--primary cc-save-btn';
    elSaveBtn.textContent = t('savePreferences', 'Save Preferences');
    elSaveBtn.addEventListener('click', function() { onSavePreferences(); });
    detailsEl.appendChild(elSaveBtn);

    inner.appendChild(detailsEl);
    bannerEl.appendChild(inner);
    document.body.appendChild(bannerEl);

    return bannerEl;
  }

  function showBanner() {
    const banner = createBanner();
    // Restore current preference into toggle if reopening
    const prefs = getPreferences();
    if (prefs && analyticsToggle) {
      analyticsToggle.checked = prefs.analytics;
    } else if (analyticsToggle) {
      analyticsToggle.checked = false;
    }
    // Close details panel when re-showing
    if (detailsEl) detailsEl.classList.remove('cc-open');
    // Force reflow then show
    void banner.offsetHeight;
    banner.classList.add('cc-visible');
  }

  function hideBanner() {
    if (bannerEl) bannerEl.classList.remove('cc-visible');
  }

  function toggleDetails() {
    if (detailsEl) detailsEl.classList.toggle('cc-open');
  }

  // ── Actions ──────────────────────────────────────────────────
  function onAcceptAll() {
    savePreferences(true);
    hideBanner();
    loadGA();
  }

  function onRejectAll() {
    savePreferences(false);
    hideBanner();
  }

  function onSavePreferences() {
    const wantAnalytics = analyticsToggle ? analyticsToggle.checked : false;
    savePreferences(wantAnalytics);
    hideBanner();
    if (wantAnalytics) loadGA();
  }

  // ── Public API ───────────────────────────────────────────────
  window.CookieConsent = {
    hasConsent: hasConsent,
    showBanner: showBanner,
    getPreferences: getPreferences
  };

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    const prefs = getPreferences();
    if (!prefs) {
      showBanner();
    } else if (prefs.analytics) {
      loadGA();
    }
  }

  // Re-translate banner when i18n loads or user switches language
  window.addEventListener('languageChanged', function() {
    updateTexts();
  });

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
