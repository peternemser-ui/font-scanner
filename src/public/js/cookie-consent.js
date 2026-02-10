/**
 * Cookie Consent Manager
 * Self-contained IIFE that manages cookie consent for GDPR/CCPA compliance.
 * Blocks Google Analytics until the user opts in.
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'sm_cookie_consent';
  var CONSENT_VERSION = 1;
  var GA_ID = 'G-TZ2S73Q6BK';

  // ── i18n helper ──────────────────────────────────────────────
  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      var result = window.i18n.t('cookieConsent.' + key);
      if (result && result !== 'cookieConsent.' + key) return result;
    }
    return fallback;
  }

  // ── Consent state ────────────────────────────────────────────
  function getPreferences() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.version === CONSENT_VERSION) return parsed;
    } catch (e) { /* corrupt data */ }
    return null;
  }

  function savePreferences(analytics) {
    var prefs = {
      essential: true,
      analytics: !!analytics,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (e) { /* quota */ }
    return prefs;
  }

  function hasConsent(category) {
    var prefs = getPreferences();
    if (!prefs) return false;
    if (category === 'essential') return true;
    return !!prefs[category];
  }

  // ── GA loader ────────────────────────────────────────────────
  var gaLoaded = false;
  function loadGA() {
    if (gaLoaded) return;
    gaLoaded = true;

    var script = document.createElement('script');
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
    var style = document.createElement('style');
    style.id = 'smCookieConsentStyles';
    style.textContent = [
      '.cc-banner {',
      '  position: fixed; bottom: 0; left: 0; right: 0;',
      '  z-index: 50;',
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
      '  padding: 0.25rem 0;',
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
      '  .cc-inner { flex-direction: column; align-items: stretch; }',
      '  .cc-actions { justify-content: stretch; }',
      '  .cc-btn { flex: 1; text-align: center; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Banner DOM ───────────────────────────────────────────────
  var bannerEl = null;
  var detailsEl = null;
  var analyticsToggle = null;

  function createBanner() {
    if (bannerEl) return bannerEl;
    injectStyles();

    bannerEl = document.createElement('div');
    bannerEl.className = 'cc-banner';
    bannerEl.setAttribute('role', 'dialog');
    bannerEl.setAttribute('aria-label', 'Cookie consent');

    var inner = document.createElement('div');
    inner.className = 'cc-inner';

    // Text
    var textEl = document.createElement('p');
    textEl.className = 'cc-text';
    var msg = document.createTextNode(
      t('message', 'We use cookies to improve your experience and analyze site traffic. ')
    );
    textEl.appendChild(msg);
    var learnLink = document.createElement('a');
    learnLink.href = '/privacy.html#cookies';
    learnLink.textContent = t('privacyPolicy', 'Privacy Policy');
    textEl.appendChild(learnLink);
    inner.appendChild(textEl);

    // Action buttons
    var actions = document.createElement('div');
    actions.className = 'cc-actions';

    var acceptBtn = document.createElement('button');
    acceptBtn.className = 'cc-btn cc-btn--primary';
    acceptBtn.textContent = t('acceptAll', 'Accept All');
    acceptBtn.addEventListener('click', function() { onAcceptAll(); });

    var rejectBtn = document.createElement('button');
    rejectBtn.className = 'cc-btn cc-btn--secondary';
    rejectBtn.textContent = t('rejectAll', 'Reject All');
    rejectBtn.addEventListener('click', function() { onRejectAll(); });

    var customizeBtn = document.createElement('button');
    customizeBtn.className = 'cc-customize-link';
    customizeBtn.textContent = t('customize', 'Customize');
    customizeBtn.addEventListener('click', function() { toggleDetails(); });

    actions.appendChild(acceptBtn);
    actions.appendChild(rejectBtn);
    actions.appendChild(customizeBtn);
    inner.appendChild(actions);

    // Details panel
    detailsEl = document.createElement('div');
    detailsEl.className = 'cc-details';

    // Essential row
    var essentialRow = document.createElement('div');
    essentialRow.className = 'cc-category';
    var essentialInfo = document.createElement('div');
    essentialInfo.className = 'cc-cat-info';
    var essentialName = document.createElement('span');
    essentialName.className = 'cc-cat-name';
    essentialName.textContent = t('essential', 'Essential');
    var essentialDesc = document.createElement('span');
    essentialDesc.className = 'cc-cat-desc';
    essentialDesc.textContent = t('essentialDesc', 'Required for the site to function (session, preferences).');
    essentialInfo.appendChild(essentialName);
    essentialInfo.appendChild(essentialDesc);
    var alwaysOn = document.createElement('span');
    alwaysOn.className = 'cc-always-on';
    alwaysOn.textContent = t('alwaysOn', 'Always on');
    essentialRow.appendChild(essentialInfo);
    essentialRow.appendChild(alwaysOn);
    detailsEl.appendChild(essentialRow);

    // Analytics row
    var analyticsRow = document.createElement('div');
    analyticsRow.className = 'cc-category';
    var analyticsInfo = document.createElement('div');
    analyticsInfo.className = 'cc-cat-info';
    var analyticsName = document.createElement('span');
    analyticsName.className = 'cc-cat-name';
    analyticsName.textContent = t('analytics', 'Analytics');
    var analyticsDesc = document.createElement('span');
    analyticsDesc.className = 'cc-cat-desc';
    analyticsDesc.textContent = t('analyticsDesc', 'Help us understand how visitors use the site (Google Analytics).');
    analyticsInfo.appendChild(analyticsName);
    analyticsInfo.appendChild(analyticsDesc);

    var toggleLabel = document.createElement('label');
    toggleLabel.className = 'cc-toggle';
    analyticsToggle = document.createElement('input');
    analyticsToggle.type = 'checkbox';
    analyticsToggle.checked = false;
    var slider = document.createElement('span');
    slider.className = 'cc-toggle-slider';
    toggleLabel.appendChild(analyticsToggle);
    toggleLabel.appendChild(slider);

    analyticsRow.appendChild(analyticsInfo);
    analyticsRow.appendChild(toggleLabel);
    detailsEl.appendChild(analyticsRow);

    // Save preferences button
    var saveBtn = document.createElement('button');
    saveBtn.className = 'cc-btn cc-btn--primary cc-save-btn';
    saveBtn.textContent = t('savePreferences', 'Save Preferences');
    saveBtn.addEventListener('click', function() { onSavePreferences(); });
    detailsEl.appendChild(saveBtn);

    inner.appendChild(detailsEl);
    bannerEl.appendChild(inner);
    document.body.appendChild(bannerEl);

    return bannerEl;
  }

  function showBanner() {
    var banner = createBanner();
    // Restore current preference into toggle if reopening
    var prefs = getPreferences();
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
    var wantAnalytics = analyticsToggle ? analyticsToggle.checked : false;
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
    var prefs = getPreferences();
    if (!prefs) {
      showBanner();
    } else if (prefs.analytics) {
      loadGA();
    }
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
