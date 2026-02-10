/**
 * Puppeteer PDF Service
 * Generates pixel-perfect, i18n-aware PDFs by rendering the real report page
 * with headless Chrome in print mode (?print=1).
 *
 * Deterministic "ready" export signal:
 * We wait for three conditions before PDF capture:
 * 1. window.i18n.initialized — translations are loaded and applied to DOM
 * 2. window.__REPORT_READY__ — report data has been rendered (set by PageShell after
 *    onScanComplete or tryLoadAndDisplay succeeds)
 * 3. document.fonts.ready — all web fonts (including CJK) are loaded
 * Each has an independent timeout so a single slow resource doesn't block indefinitely.
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PuppeteerPdfService');

const TEMP_DIR = path.join(__dirname, '../../temp');
const I18N_DIR = path.join(__dirname, '../public/i18n');

const CJK_LANGS = ['ja', 'zh', 'ko'];
const CJK_FONT_URLS = {
  ja: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap',
  zh: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600;700&display=swap',
  ko: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap'
};

/**
 * Read a translated string from the i18n JSON for the given locale.
 * Falls back to en.json, then to the provided default.
 */
function getI18nString(lang, keyPath, defaultVal) {
  try {
    const filePath = path.join(I18N_DIR, `${lang}.json`);
    if (!fsSync.existsSync(filePath)) {
      lang = 'en';
    }
    const data = JSON.parse(fsSync.readFileSync(path.join(I18N_DIR, `${lang}.json`), 'utf8'));
    const parts = keyPath.split('.');
    let node = data;
    for (const p of parts) {
      if (node && typeof node === 'object' && p in node) {
        node = node[p];
      } else {
        return defaultVal;
      }
    }
    return typeof node === 'string' ? node : defaultVal;
  } catch {
    return defaultVal;
  }
}

/**
 * Build the translated PDF footer HTML for a given locale + report type.
 */
function buildPdfFooter(lang, reportType) {
  const reportLabel = getReportLabel(reportType);
  const reportTitle = getI18nString(lang, 'common.pdf.cover.reportTitle', '{{type}} Analysis Report')
    .replace('{{type}}', reportLabel);
  const pageWord = getI18nString(lang, 'common.pdf.footer.page', 'Page');
  const ofWord = getI18nString(lang, 'common.pdf.footer.of', 'of');

  return `
    <div style="font-size:7px; color:#999; width:100%; display:flex; justify-content:space-between; padding:4px 16px; font-family:system-ui,-apple-system,sans-serif; box-sizing:border-box;">
      <span>Site Mechanic &mdash; ${reportTitle}</span>
      <span>${pageWord} <span class="pageNumber"></span> ${ofWord} <span class="totalPages"></span></span>
    </div>`;
}

/**
 * Map report type slugs to display labels with correct casing.
 * Acronyms stay uppercase; other types get title-cased.
 */
const REPORT_LABEL_MAP = {
  seo: 'SEO',
  cro: 'CRO',
  gdpr: 'GDPR',
  cwv: 'CWV',
  security: 'Security',
  performance: 'Performance',
  accessibility: 'Accessibility',
  fonts: 'Fonts',
  'tag-intelligence': 'Tag Intelligence',
  'enhanced-fonts': 'Enhanced Fonts',
  'brand-consistency': 'Brand Consistency',
  'broken-links': 'Broken Links',
  'ip-reputation': 'IP Reputation',
  'local-seo': 'Local SEO',
  'mobile-analyzer': 'Mobile',
  'competitive-analysis': 'Competitive',
  'hosting-analyzer': 'Hosting',
  'site-crawler': 'Site Crawler',
  'performance-hub': 'Performance',
  'core-web-vitals': 'Core Web Vitals',
};

function getReportLabel(reportType) {
  return REPORT_LABEL_MAP[reportType] || reportType.charAt(0).toUpperCase() + reportType.slice(1);
}

/**
 * Get the filename-safe type prefix (uppercase acronyms, title-case others).
 */
function getFilenamePrefix(reportType) {
  const label = getReportLabel(reportType);
  // For multi-word labels, use kebab-case
  return label.replace(/\s+/g, '-');
}

async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    logger.warn('Could not create temp directory:', error.message);
  }
}

/**
 * Build comprehensive CSS that forces light mode, hides chrome,
 * removes position:fixed/sticky, removes overflow clipping,
 * and expands all accordion/collapsible content.
 *
 * CSS injection via page.addStyleTag() is more reliable than DOM manipulation
 * because stylesheets persist through Chromium's PDF rendering pass.
 */
function buildPdfOverrideCSS(lang) {
  const cjkFont = lang === 'ja' ? "'Noto Sans JP', " :
                  lang === 'zh' ? "'Noto Sans SC', " :
                  lang === 'ko' ? "'Noto Sans KR', " : '';

  return `
    /* =============================================
       PDF EXPORT OVERRIDES
       Injected by PuppeteerPdfService
       ============================================= */

    /* --- LIGHT MODE: Override ALL CSS custom properties --- */
    :root, html, body, body.white-theme, html.white-theme {
      --bg-base: #ffffff !important;
      --bg-elevated: #f9fafb !important;
      --bg-card: #ffffff !important;
      --bg-input: #f3f4f6 !important;
      --bg-overlay: rgba(255, 255, 255, 0.95) !important;
      --bg-gradient-primary: none !important;
      --bg-gradient-success: none !important;
      --bg-gradient-warning: none !important;
      --bg-gradient-error: none !important;
      --bg-gradient-dark: none !important;
      --border-color: rgba(0, 0, 0, 0.1) !important;
      --border-color-strong: rgba(0, 0, 0, 0.2) !important;
      --border-color-subtle: rgba(0, 0, 0, 0.05) !important;
      --color-text: #111827 !important;
      --color-text-secondary: #4b5563 !important;
      --color-text-muted: #6b7280 !important;
      --color-primary: #dd3838 !important;
      --color-primary-hover: #c52f2f !important;
      --color-primary-dim: rgba(221, 56, 56, 0.1) !important;
      --color-secondary: #ff5252 !important;
      --color-secondary-hover: #e04545 !important;
      --color-secondary-dim: rgba(255, 82, 82, 0.1) !important;
      --color-success: #10b981 !important;
      --color-warning: #f59e0b !important;
      --color-error: #ef4444 !important;
      --color-info: #3b82f6 !important;
      --color-accent: #dd3838 !important;
      --color-accent-hover: #c52f2f !important;
      --color-accent-light: rgba(221, 56, 56, 0.1) !important;
      --focus-ring: 0 0 0 3px rgba(221, 56, 56, 0.3) !important;
      --swiss-border: 1px solid rgba(0, 0, 0, 0.08) !important;
      color-scheme: light !important;
    }

    html, body {
      background-color: #ffffff !important;
      background-image: none !important;
      color: #111827 !important;
      font-family: ${cjkFont} 'Inter', system-ui, -apple-system, sans-serif !important;
    }

    /* Force all elements to use light background/text */
    * {
      color-scheme: light !important;
    }

    /* Catch any element with dark background via computed style fallback */
    main, section, div, article, aside, .card, .panel, .container, .wrapper,
    .report-content, .report-section, .results-container, .security-results,
    .metric-card, .score-card, .summary-card, [class*="card"], [class*="panel"],
    [class*="section"], [class*="container"], [class*="wrapper"] {
      background-color: var(--bg-card) !important;
      background-image: none !important;
    }

    /* Tables */
    table, thead, tbody, tr, th, td {
      background-color: #ffffff !important;
      color: #111827 !important;
      border-color: rgba(0, 0, 0, 0.12) !important;
    }
    thead, th {
      background-color: #f3f4f6 !important;
      color: #374151 !important;
    }
    tr:nth-child(even) td {
      background-color: #f9fafb !important;
    }

    /* Text elements */
    h1, h2, h3, h4, h5, h6 { color: #111827 !important; }
    p, span, li, label, a, strong, em, code, pre, td, th, dd, dt {
      color: #111827 !important;
    }
    a { color: #dd3838 !important; }
    .color-text-secondary, .text-secondary, .text-muted {
      color: #4b5563 !important;
    }

    /* --- REMOVE FIXED/STICKY POSITIONING --- */
    /* Only remove fixed/sticky — leave static/relative/absolute intact for layout */
    [style*="position: fixed"], [style*="position: sticky"] {
      position: static !important;
    }
    .unified-header, .top-nav, .nav-wrapper, .mobile-nav,
    .site-footer-bar, .breadcrumb-bar, .toast-container,
    .language-switcher, .usage-pill, .scan-counter {
      position: static !important;
    }
    /* Ensure injected PDF pages use relative positioning */
    .pdf-cover-page, .pdf-toc-page, .pdf-exec-summary {
      position: relative !important;
    }

    /* --- REMOVE OVERFLOW CLIPPING --- */
    * {
      overflow: visible !important;
      max-height: none !important;
    }

    /* --- PRINT COLOR PRESERVATION --- */
    * {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* --- HIDE CHROME --- */
    #nav-placeholder, .unified-header, .nav-wrapper, .top-nav,
    .mobile-nav, .mobile-nav-overlay, .hamburger-menu,
    .breadcrumb-bar, .breadcrumb, .page-header,
    .site-footer-bar, .footer-template, .nav-template,
    .scan-card-enhanced, .run-scan-section,
    #urlInput, .analyze-button, .url-input-wrapper,
    .export-buttons, [data-export="pdf"], [data-export="csv"],
    [data-export="json"], [data-export="excel"],
    .pro-report-block__unlock-prompt, .pro-report-block__unlock-buttons,
    [data-locked-overlay], [data-paid-unlock-card],
    .report-shell__lock-overlay,
    #paymentGateModal, .payment-modal, .pricing-modal,
    .tabs__nav, [class*="fix-tabs"], .faq-group, .take-action-section,
    .stored-report-banner, #stored-report-banner,
    #report-unavailable-banner, #report-unavailable-overlay,
    .report-unavailable-overlay,
    .language-switcher, .usage-pill, .scan-counter, .scan-context-bar,
    .page-shell__header, .export-bar, .scan-form,
    .page-shell__url-form, .report-shell__url-bar,
    #scan-form, .scan-input-group, .toast-container {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      max-height: 0 !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    }

    /* --- EXPAND ALL ACCORDIONS/TABS --- */
    [data-accordion-body],
    .report-accordion__body,
    .accordion-content,
    .accordion-body,
    [class*="fix-content"] {
      display: block !important;
      max-height: none !important;
      overflow: visible !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    [class*="fix-tab-content"] {
      display: block !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    .accordion-content.expanded,
    [class*="fix-accordion"].expanded [class*="fix-content"] {
      max-height: none !important;
      overflow: visible !important;
    }

    /* --- PAGINATION --- */
    .pdf-cover-page {
      page-break-after: always;
      break-after: page;
    }
    .pdf-toc-page {
      page-break-after: always;
      break-after: page;
    }
    .pdf-exec-summary {
      page-break-after: always;
      break-after: page;
    }
    h2, h3, .report-accordion__header {
      page-break-after: avoid;
      break-after: avoid;
    }
    table, .metric-card, .score-card, .card,
    .report-accordion, pre, .code-block {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Make results visible — target both generic and analyzer-specific IDs */
    #results,
    #seoResults, #securityResults, #performanceResults,
    #accessibilityResults, #fontsResults, #seoanalyzerResults,
    #tagIntelligenceResults, #enhancedFontsResults,
    [id$="Results"].results-container,
    .results-container {
      display: block !important;
      visibility: visible !important;
    }

    /* Score colors - preserve intentional colored backgrounds */
    .donut-score, .score-gauge, .gauge-circle, .score-circle,
    [class*="severity-"], [class*="status-"], [class*="badge-"],
    .badge, .tag, .label, .chip {
      color: inherit !important;
    }

    /* Fix SVG visibility */
    svg { overflow: visible !important; }

    /* --- URL WRAPPING ON COVER --- */
    .pdf-cover-page .site-url,
    .pdf-cover-page [class*="url"] {
      word-break: break-all !important;
      overflow-wrap: break-word !important;
    }
  `;
}

/**
 * Generate PDF from a URL using Puppeteer.
 * This is the sole PDF generation entry point — it renders the real report page.
 */
async function generatePdfFromUrl(options) {
  const {
    url,
    reportId = `report-${Date.now()}`,
    reportType = 'report',
    cookies = [],
    lang = 'en',
    expandAccordions = true,
    isPaid = false,
    reportData = null,
    analyzedUrl = null
  } = options;

  await ensureTempDir();

  const domain = (analyzedUrl || '').replace(/^https?:\/\//, '').split('/')[0] || 'report';
  const dateStr = new Date().toISOString().split('T')[0];
  const typePrefix = getFilenamePrefix(reportType);
  const filename = `${typePrefix}-report-${domain}-${dateStr}.pdf`;
  const uniqueSuffix = Date.now().toString(36);
  const tempFilename = `${typePrefix}-report-${domain}-${dateStr}-${uniqueSuffix}.pdf`;
  const filepath = path.join(TEMP_DIR, tempFilename);

  logger.info('Generating PDF from URL', {
    url, reportId, reportType, lang, typePrefix,
    hasCookies: cookies.length > 0,
    hasReportData: !!reportData
  });

  try {
    await browserPool.execute(async (browser) => {
      const page = await browser.newPage();

      try {
        // 0. Capture console messages for debugging
        const consoleMessages = [];
        page.on('console', msg => {
          const type = msg.type();
          const text = msg.text();
          if (type === 'error' || type === 'warn') {
            consoleMessages.push(`[${type}] ${text}`);
          }
        });
        page.on('pageerror', err => {
          consoleMessages.push(`[pageerror] ${err.message}`);
        });

        // 1. Set viewport
        await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });

        // 2. Set Accept-Language header
        await page.setExtraHTTPHeaders({ 'Accept-Language': `${lang},en;q=0.9` });

        // 3. Set cookies
        if (cookies.length > 0) {
          await page.setCookie(...cookies);
        }

        // 4. Inject localStorage + pro-tier classes before page scripts run
        await page.evaluateOnNewDocument((params) => {
          try {
            localStorage.setItem('theme', 'light');
            localStorage.setItem('sm_lang', params.lang);
            if (params.reportData && params.reportId) {
              const key = `sm_report_${params.reportId}`;
              localStorage.setItem(key, JSON.stringify({
                reportId: params.reportId,
                data: params.reportData,
                metadata: { savedAt: new Date().toISOString(), source: 'pdf-injection' }
              }));
            }
          } catch (e) {
            console.error('[PDF] evaluateOnNewDocument error:', e);
          }
          // Set pro-tier and print classes early so ProReportBlock/page scripts
          // see them before rendering lock overlays
          document.addEventListener('DOMContentLoaded', () => {
            document.body.classList.add('print-pro-tier', 'pdf-export-mode', 'sm-print-mode');
            document.documentElement.classList.add('white-theme');
            document.documentElement.setAttribute('data-theme', 'print');
          });
        }, { lang, reportData, reportId });

        // 5. Bypass CSP for this page load (CSP blocks some Puppeteer evaluate calls)
        await page.setBypassCSP(true);
        logger.info('CSP bypassed for PDF rendering');

        // 6. Navigate to the URL
        logger.info('Navigating to page', { url, lang });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // 7. Set screen media type (prevents @media print CSS from activating)
        await page.emulateMediaType('screen');

        // 8. Force light mode via inline styles AND CSS injection
        const cssInjected = await page.evaluate((cssText) => {
          try {
            document.documentElement.classList.add('white-theme');
            document.documentElement.setAttribute('data-theme', 'print');
            document.documentElement.style.colorScheme = 'light';
            document.body.classList.add('white-theme', 'pdf-export-mode', 'print-pro-tier', 'sm-print-mode');
            document.body.style.setProperty('background-color', '#ffffff', 'important');
            document.body.style.setProperty('background-image', 'none', 'important');
            document.body.style.setProperty('color', '#111827', 'important');

            const style = document.createElement('style');
            style.setAttribute('data-pdf-override', 'true');
            style.textContent = cssText;
            document.head.appendChild(style);
            return { success: true };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }, buildPdfOverrideCSS(lang));
        logger.info('CSS injection result', cssInjected);

        // 9. Belt-and-suspenders: also try addStyleTag
        try {
          await page.addStyleTag({ content: buildPdfOverrideCSS(lang) });
        } catch (e) {
          logger.warn('addStyleTag failed (CSP?), relying on evaluate injection', e.message);
        }

        // 10. Inject CJK font stylesheet if needed
        if (CJK_LANGS.includes(lang) && CJK_FONT_URLS[lang]) {
          logger.info('Injecting CJK font', { lang });
          await page.addStyleTag({ url: CJK_FONT_URLS[lang] });
        }

        // 11. Wait for i18n
        await page.waitForFunction(() => window.i18n && window.i18n.initialized === true,
          { timeout: 15000 }).catch(() => logger.warn('i18n timed out'));

        // 12. Wait for report ready signal
        await page.waitForFunction(() => window.__REPORT_READY__ === true,
          { timeout: 15000 }).catch(() => logger.warn('Report ready timed out'));

        // 13. Fallback: if report didn't render, force-display it
        const isReady = await page.evaluate(() => window.__REPORT_READY__ === true);
        if (!isReady && reportData) {
          logger.info('Force-displaying report from data', { reportType });
          const displayResult = await page.evaluate((data, rType) => {
            try {
              document.getElementById('report-unavailable-banner')?.remove();
              document.getElementById('report-unavailable-overlay')?.remove();
              document.querySelector('.report-unavailable-overlay')?.remove();

              // Find the results container — try generic ID first, then analyzer-specific
              const results = document.getElementById('results')
                || document.querySelector('[id$="Results"].results-container')
                || document.querySelector('.results-container');
              if (results) {
                results.classList.remove('hidden');
                results.removeAttribute('hidden');
                results.style.display = 'block';
              }

              const fnMap = {
                seo: window.displaySEOResults,
                security: window.displaySecurityResults,
                performance: window.displayPerformanceResults || window.displayCWVResults,
                accessibility: window.displayAccessibilityResults,
                fonts: window.displayFontsResults,
                'tag-intelligence': window.displayTagIntelligenceResults,
                mobile: window.displayMobileResults,
                cro: window.displayCROResults,
                hosting: window.displayHostingResults,
                gdpr: window.displayGdprResults,
                'broken-links': window.displayBrokenLinksResults,
                brand: window.displayBrandResults,
                competitive: window.displayCompetitiveResults,
                'local-seo': window.displayLocalSEOResults,
                'ip-reputation': window.displayReputationResults,
              };
              const fn = fnMap[rType];

              if (fn) {
                fn(data);
                window.__REPORT_READY__ = true;
                return { success: true, fnName: fn.name || 'anonymous' };
              } else {
                return { success: false, error: 'No display function found' };
              }
            } catch (e) {
              return { success: false, error: e.message };
            }
          }, reportData, reportType);
          logger.info('Force-display result', displayResult);
          await page.waitForTimeout(3000);
        }

        // 13b. Ensure locale is correct: if i18n loaded but report rendered with
        // wrong language (race condition), force re-render with correct locale.
        const localeCheck = await page.evaluate(async (targetLang, rType, rData) => {
          try {
            if (!window.i18n) return { skipped: true, reason: 'no i18n' };

            const currentLang = window.i18n.currentLanguage || 'en';
            // Check if a representative i18n key resolves to a non-English translation.
            // If it returns the key itself, translations aren't loaded for target locale.
            const testKey = 'nav.dashboard';
            const testVal = window.i18n.t(testKey);
            const translationsLoaded = (testVal !== testKey && Object.keys(window.i18n.translations).length > 0);

            if (currentLang === targetLang && translationsLoaded) {
              // Locale matches and translations are loaded — but the report DOM
              // might have been rendered before translations were ready.
              // Check if the page actually has translated content by looking for
              // a known English-only string in the results container.
              const results = document.getElementById('results')
                || document.querySelector('[id$="Results"].results-container')
                || document.querySelector('.results-container');
              if (!results) return { ok: true, note: 'no results container' };

              // Sample the first accordion header text — if it's still in English
              // when target is non-English, we need to re-render.
              if (targetLang !== 'en') {
                const firstHeader = results.querySelector('.report-accordion__title, [data-accordion-toggle]');
                if (firstHeader) {
                  const headerText = firstHeader.textContent.trim();
                  // Heuristic: if text is ASCII-only and target is CJK, it's likely untranslated
                  const isCJK = ['ja', 'zh', 'ko'].includes(targetLang);
                  const isAsciiOnly = /^[\x20-\x7E]+$/.test(headerText);
                  if (isCJK && isAsciiOnly && headerText.length > 3) {
                    // Report content is in English despite target being CJK — re-render needed
                    const fnMap = {
                      seo: window.displaySEOResults,
                      security: window.displaySecurityResults,
                      performance: window.displayPerformanceResults || window.displayCWVResults,
                      accessibility: window.displayAccessibilityResults,
                      fonts: window.displayFontsResults,
                      'tag-intelligence': window.displayTagIntelligenceResults,
                      mobile: window.displayMobileResults,
                      cro: window.displayCROResults,
                      hosting: window.displayHostingResults,
                      gdpr: window.displayGdprResults,
                      'broken-links': window.displayBrokenLinksResults,
                      brand: window.displayBrandResults,
                      competitive: window.displayCompetitiveResults,
                      'local-seo': window.displayLocalSEOResults,
                      'ip-reputation': window.displayReputationResults,
                    };
                    const fn = fnMap[rType];
                    if (fn && rData) {
                      fn(rData);
                      return { reRendered: true, reason: 'content was ASCII despite CJK target', headerSample: headerText.slice(0, 50) };
                    }
                    return { needsReRender: true, noFn: !fn, noData: !rData, headerSample: headerText.slice(0, 50) };
                  }
                }
              }
              return { ok: true };
            }

            // Language mismatch — force locale and re-render
            await window.i18n.forceLocale(targetLang);

            // Re-render report if display function is available
            if (rData) {
              const fnMap = {
                seo: window.displaySEOResults,
                security: window.displaySecurityResults,
                performance: window.displayPerformanceResults || window.displayCWVResults,
                accessibility: window.displayAccessibilityResults,
                fonts: window.displayFontsResults,
                'tag-intelligence': window.displayTagIntelligenceResults,
                mobile: window.displayMobileResults,
                cro: window.displayCROResults,
                'broken-links': window.displayBrokenLinksResults,
                brand: window.displayBrandResults,
                competitive: window.displayCompetitiveResults,
                'local-seo': window.displayLocalSEOResults,
                'ip-reputation': window.displayReputationResults,
              };
              const fn = fnMap[rType];
              if (fn) {
                fn(rData);
                return { reRendered: true, reason: 'locale mismatch', from: currentLang, to: targetLang };
              }
            }
            return { localeForced: true, from: currentLang, to: targetLang };
          } catch (e) {
            return { error: e.message };
          }
        }, lang, reportType, reportData);
        logger.info('Locale check after render', localeCheck);
        if (localeCheck?.reRendered) {
          // Wait for re-rendered content to settle
          await page.waitForTimeout(2000);
        }

        // 14. Wait for fonts
        await page.waitForFunction(() => document.fonts.ready.then(() => true),
          { timeout: 10000 }).catch(() => logger.warn('Fonts timed out'));

        // 15. Wait for charts/images to settle
        await page.waitForTimeout(2000);

        // 16. Convert all <canvas> to static <img> (Chart.js charts fail in PDF)
        const canvasCount = await page.evaluate(() => {
          let converted = 0;
          document.querySelectorAll('canvas').forEach(canvas => {
            try {
              const img = document.createElement('img');
              img.src = canvas.toDataURL('image/png');
              img.style.width = canvas.style.width || canvas.width + 'px';
              img.style.height = canvas.style.height || canvas.height + 'px';
              img.style.maxWidth = '100%';
              img.setAttribute('data-from-canvas', 'true');
              canvas.parentNode.replaceChild(img, canvas);
              converted++;
            } catch (e) {
              // Tainted canvas (cross-origin) — skip
            }
          });
          return converted;
        });
        if (canvasCount > 0) {
          logger.info('Converted canvases to images', { count: canvasCount });
        }

        // 17. Wait for all <img> elements to finish loading
        await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return Promise.all(imgs.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
              setTimeout(resolve, 5000); // 5s per-image timeout
            });
          }));
        }).catch(() => logger.warn('Image loading wait timed out'));

        // 18. Expand all accordions (click-based for lazy-loaded content)
        const accordionCount = await page.evaluate(() => {
          let count = 0;

          // A) Standard report accordions
          document.querySelectorAll('[data-accordion-body]').forEach(body => {
            body.classList.add('report-accordion__body--open');
            body.removeAttribute('hidden');
            const id = body.getAttribute('data-accordion-body');
            const hdr = document.querySelector(`[data-accordion-toggle="${id}"]`);
            if (hdr) hdr.setAttribute('aria-expanded', 'true');
            count++;
          });

          // B) aria-expanded pattern
          document.querySelectorAll('[aria-expanded="false"]').forEach(el => {
            el.setAttribute('aria-expanded', 'true');
            count++;
          });

          // C) Custom lazy-loaded accordions (click to trigger content rendering)
          document.querySelectorAll('.accordion-header').forEach(header => {
            const content = header.nextElementSibling;
            if (content && content.classList.contains('accordion-content')) {
              if (!content.classList.contains('expanded')) {
                header.click();
              }
              content.classList.add('expanded');
              header.classList.add('active');
              const toggle = header.querySelector('.accordion-toggle');
              if (toggle) toggle.textContent = '▲';
              count++;
            }
          });

          // D) All report-specific fix accordions (wildcard: *-fix-accordion)
          document.querySelectorAll('[class*="fix-accordion"]').forEach(accordion => {
            accordion.classList.add('expanded');
            count++;
          });

          // E) All fix tab content panels — make visible
          document.querySelectorAll('[class*="fix-tab-content"]').forEach(tab => {
            tab.classList.add('active');
            count++;
          });

          // F) Generic accordion content
          document.querySelectorAll('.accordion-content, .accordion-body').forEach(el => {
            el.classList.add('expanded');
          });

          // G) Un-hide result panels
          document.querySelectorAll('[hidden]').forEach(el => {
            if (el.closest('#results') || el.closest('[id$="Results"]') ||
                el.closest('.results-container') || el.closest('.report-content') ||
                el.closest('[class*="report"]') || el.id === 'results' ||
                (el.id && el.id.endsWith('Results'))) {
              el.removeAttribute('hidden');
              count++;
            }
          });

          // H) Results container (support legacy #results and analyzer-specific IDs)
          const results = document.getElementById('results')
            || document.querySelector('[id$="Results"].results-container')
            || document.querySelector('.results-container');
          if (results) {
            results.classList.remove('hidden');
            results.removeAttribute('hidden');
            results.style.display = 'block';
            results.style.visibility = 'visible';
          }

          // I) Visual Sitemap
          document.querySelectorAll('.vs-node--collapsed').forEach(node => {
            node.classList.remove('vs-node--collapsed');
            count++;
          });

          // J) HTML5 <details>
          document.querySelectorAll('details:not([open])').forEach(el => {
            el.setAttribute('open', '');
            count++;
          });

          return count;
        });
        logger.info('Accordions expanded', { count: accordionCount });

        // 19. Wait for lazy content to render
        await page.waitForTimeout(1000);

        // 19b. Second-pass: force-expand any remaining fix/recommendation sections
        await page.evaluate(() => {
          // Re-click any still-collapsed accordion headers in recommendation areas
          document.querySelectorAll('.accordion-header:not(.active)').forEach(h => h.click());
          // Force max-height on any remaining collapsed content
          document.querySelectorAll('.accordion-content, .accordion-body, [class*="fix-accordion"], [class*="fix-content"], [class*="fix-tab-content"]').forEach(el => {
            el.style.maxHeight = 'none';
            el.style.overflow = 'visible';
            el.style.display = 'block';
            el.classList.add('expanded');
          });

          // Force all fix tab content panels visible (Summary, Code, Fix Guide)
          // These use inline style="display: none;" which needs JS override
          document.querySelectorAll('.seo-fix-tab-content, [class*="fix-tab-content"]').forEach(panel => {
            panel.style.setProperty('display', 'block', 'important');
            panel.style.opacity = '1';
            panel.style.visibility = 'visible';

            // Add a visible section label since tab buttons are hidden in PDF
            const panelId = panel.id || '';
            let label = '';
            if (panelId.endsWith('-summary')) label = 'Summary';
            else if (panelId.endsWith('-code')) label = 'Code';
            else if (panelId.endsWith('-guide')) label = 'Fix Guide';

            if (label && !panel.querySelector('.pdf-tab-label')) {
              const labelEl = document.createElement('div');
              labelEl.className = 'pdf-tab-label';
              labelEl.style.cssText = 'font-weight: 700; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.1);';
              labelEl.textContent = label;
              panel.insertBefore(labelEl, panel.firstChild);
            }
          });

          // Ensure pro-only content is visible (belt-and-suspenders with CSS)
          document.querySelectorAll('[data-locked-overlay]').forEach(el => el.remove());
          document.querySelectorAll('.pro-report-block__unlock-prompt').forEach(el => el.remove());
          document.querySelectorAll('[data-pro-only], .pro-only, .pro-content').forEach(el => {
            el.style.display = 'block';
            el.style.visibility = 'visible';
            el.style.opacity = '1';
          });
        });
        await page.waitForTimeout(500);

        // 20. Remove chrome elements from DOM (belt-and-suspenders with CSS hiding)
        const removeCount = await page.evaluate(() => {
          let removed = 0;
          const removeSelectors = [
            '#nav-placeholder', 'nav', 'header', '.unified-header', '.nav-wrapper', '.top-nav',
            '.mobile-nav', '.mobile-nav-overlay', '.hamburger-menu',
            '.breadcrumb-bar', '.breadcrumb', '.page-header',
            'footer', '.site-footer-bar', '.footer-template', '.nav-template',
            '.scan-card-enhanced', '.run-scan-section',
            '.url-input-wrapper', '.scan-form', '#scan-form',
            '.page-shell__header', '.page-shell__url-form',
            '.report-shell__url-bar', '.scan-input-group',
            '#urlInput', '.analyze-button',
            '.export-buttons', '.export-bar', '[data-export]',
            '#paymentGateModal', '.payment-modal', '.pricing-modal',
            '#report-unavailable-banner', '#report-unavailable-overlay',
            '.report-unavailable-overlay',
            '.language-switcher', '.scan-context-bar', '.usage-pill', '.scan-counter',
            '.toast-container', '.faq-group', '.take-action-section',
            '[data-locked-overlay]', '[data-paid-unlock-card]',
            '.pro-report-block__unlock-prompt', '.pro-report-block__unlock-buttons',
            '.report-shell__lock-paywall', '[data-hide-when-unlocked]',
            '[class*="cookie"]', '[id*="cookie"]', '[class*="consent"]',
            '.stored-report-banner', '#stored-report-banner'
          ];
          removeSelectors.forEach(sel => {
            try {
              document.querySelectorAll(sel).forEach(el => {
                if (!el.closest('#results') && !el.closest('[id$="Results"]') &&
                    !el.closest('.results-container') && !el.closest('.pdf-cover-page') &&
                    !el.closest('.pdf-toc-page') && !el.closest('.pdf-exec-summary')) {
                  el.remove();
                  removed++;
                }
              });
            } catch (e) { /* ignore selector errors */ }
          });
          return removed;
        });
        logger.info('Chrome elements removed from DOM', { removeCount });

        // 21. Inject Cover Page, Table of Contents, and Executive Summary
        let logoSvg = '';
        try {
          const logoPath = path.join(__dirname, '../public/assets/logo-pdf.svg');
          logoSvg = fsSync.readFileSync(logoPath, 'utf8');
        } catch (e) {
          logger.warn('Could not read logo SVG', e.message);
        }

        const reportLabel = getReportLabel(reportType);

        const injectedContent = await page.evaluate((opts) => {
          const { reportType, reportLabel, analyzedUrl, lang, reportData, logoSvg: logo } = opts;
          // i18n helper — use page's i18n if available, else return fallback
          const _t = (key, fallback, params) => {
            let val = fallback;
            if (window.i18n && typeof window.i18n.t === 'function') {
              const translated = window.i18n.t(key);
              if (translated !== key) val = translated;
            }
            if (params && typeof val === 'string') {
              Object.keys(params).forEach(p => {
                val = val.replace(new RegExp('\\{\\{' + p + '\\}\\}', 'g'), params[p]);
              });
            }
            return val;
          };

          const now = new Date();
          const localeMap = { ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', pt: 'pt-BR', ru: 'ru-RU' };
          const dateStr = now.toLocaleDateString(localeMap[lang] || 'en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
          });
          const siteUrl = analyzedUrl || reportData?.url || reportData?.normalizedUrl || '';

          // Insert <wbr> at "/" and "-" for URL wrapping
          const wrappedUrl = siteUrl.replace(/([/\-])/g, '$1<wbr>');

          // Localized strings
          const coverSubtitle = _t('common.pdf.cover.subtitle', 'web diagnostics & performance analysis');
          const coverTitle = _t('common.pdf.cover.reportTitle', '{{type}} Analysis Report', { type: reportLabel });
          const coverConfidential = _t('common.pdf.cover.confidential', 'Confidential — Prepared for site owner');
          const coverOverallScore = _t('common.pdf.cover.overallScore', 'Overall Score');

          // --- Build cover page ---
          const coverPage = document.createElement('div');
          coverPage.className = 'pdf-cover-page';
          const fontStack = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
          coverPage.style.cssText = `
            page-break-after: always;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: 85vh;
            text-align: center;
            padding: 64px 40px;
            background: #ffffff;
            font-family: ${fontStack};
          `;
          coverPage.innerHTML = `
            <div style="margin-bottom: 48px;">
              <div style="margin-bottom: 32px;">
                ${logo ? `<div style="width: 220px; margin: 0 auto;">${logo}</div>` : `<div style="font-family: ${fontStack}; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; color: #dd3838; font-weight: 700;">Site Mechanic</div>`}
              </div>
              <div style="font-family: ${fontStack}; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 24px; font-weight: 500;">
                ${coverSubtitle}
              </div>
              <h1 style="font-family: ${fontStack}; font-size: 2.5rem; font-weight: 700; color: #111827; margin: 0 0 16px 0; line-height: 1.15; letter-spacing: -0.025em;">
                ${coverTitle}
              </h1>
              <div style="width: 48px; height: 3px; background: #dd3838; margin: 24px auto;"></div>
            </div>
            <div style="margin-bottom: 32px;" class="site-url">
              <div style="font-family: ${fontStack}; font-size: 1.125rem; color: #374151; font-weight: 500; word-break: break-all; overflow-wrap: break-word;">${wrappedUrl}</div>
            </div>
            <div style="font-family: ${fontStack}; color: #6b7280; font-size: 0.875rem; line-height: 2; font-weight: 400;">
              <div>${dateStr}</div>
              <div style="margin-top: 8px;">${coverConfidential}</div>
            </div>
            ${reportData?.overallScore !== undefined ? `
              <div style="margin-top: 48px; padding: 24px 40px; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px;">
                <div style="font-family: ${fontStack}; font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">${coverOverallScore}</div>
                <div style="font-family: ${fontStack}; font-size: 3rem; font-weight: 700; color: ${reportData.overallScore >= 80 ? '#10b981' : reportData.overallScore >= 60 ? '#f59e0b' : '#ef4444'}; letter-spacing: -0.025em;">
                  ${reportData.overallScore}<span style="font-size: 1.5rem; color: #9ca3af;">/100</span>
                </div>
              </div>
            ` : ''}
          `;

          // --- Build Table of Contents ---
          const tocPage = document.createElement('div');
          tocPage.className = 'pdf-toc-page';
          tocPage.style.cssText = `
            page-break-after: always;
            padding: 48px 0;
            background: #ffffff;
            font-family: ${fontStack};
          `;

          const headings = [];
          let tocIndex = 1;
          document.querySelectorAll('#results h2, #results h3, [id$="Results"] h2, [id$="Results"] h3, .results-container h2, .results-container h3, .report-accordion__header, .accordion-header').forEach(el => {
            const text = el.textContent.replace(/[▲▼►◄↕↔]/g, '').trim();
            if (text && text.length > 2 && text.length < 100) {
              const isH2 = el.tagName === 'H2' || el.classList.contains('report-accordion__header');
              headings.push({ text, level: isH2 ? 2 : 3, index: tocIndex++ });
            }
          });

          const tocTitle = _t('common.pdf.toc.title', 'Table of Contents');
          let tocHTML = `
            <h2 style="font-family: ${fontStack}; font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 32px; padding-bottom: 12px; border-bottom: 2px solid #dd3838; letter-spacing: -0.025em;">
              ${tocTitle}
            </h2>
            <div style="line-height: 2.2;">
          `;
          headings.forEach(h => {
            const indent = h.level === 3 ? 'padding-left: 24px;' : '';
            const weight = h.level === 2 ? 'font-weight: 600;' : 'font-weight: 400;';
            const size = h.level === 2 ? 'font-size: 0.875rem;' : 'font-size: 0.8125rem;';
            tocHTML += `<div style="font-family: ${fontStack}; ${indent} ${weight} ${size} color: #374151; border-bottom: 1px solid rgba(0,0,0,0.06); padding: 6px 0;">${h.index}. ${h.text}</div>`;
          });
          tocHTML += '</div>';
          tocPage.innerHTML = tocHTML;

          // --- Build Executive Summary ---
          const execSummary = document.createElement('div');
          execSummary.className = 'pdf-exec-summary';
          execSummary.style.cssText = `
            page-break-after: always;
            padding: 48px 0;
            background: #ffffff;
            font-family: ${fontStack};
          `;

          const execSummaryTitle = _t('common.pdf.execSummary.title', 'Executive Summary');
          let summaryHTML = `
            <h2 style="font-family: ${fontStack}; font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #dd3838; letter-spacing: -0.025em;">
              ${execSummaryTitle}
            </h2>
          `;

          if (reportData) {
            const categories = [];
            if (reportData.ssl?.score !== undefined) categories.push({ name: 'SSL/TLS', score: reportData.ssl.score });
            if (reportData.headers?.score !== undefined) categories.push({ name: 'Security Headers', score: reportData.headers.score });
            if (reportData.vulnerabilities?.score !== undefined) categories.push({ name: 'Vulnerabilities', score: reportData.vulnerabilities.score });
            if (reportData.cookies?.score !== undefined) categories.push({ name: 'Cookies', score: reportData.cookies.score });
            if (reportData.thirdPartyScripts?.score !== undefined) categories.push({ name: 'Third-Party Scripts', score: reportData.thirdPartyScripts.score });
            if (reportData.scores?.meta !== undefined) categories.push({ name: 'Meta Tags', score: reportData.scores.meta });
            if (reportData.scores?.performance !== undefined) categories.push({ name: 'Performance', score: reportData.scores.performance });
            if (reportData.scores?.accessibility !== undefined) categories.push({ name: 'Accessibility', score: reportData.scores.accessibility });
            if (reportData.performanceScore !== undefined) categories.push({ name: 'Performance', score: reportData.performanceScore });
            if (reportData.accessibilityScore !== undefined) categories.push({ name: 'Accessibility', score: reportData.accessibilityScore });

            // Score breakdown from SEO reports
            if (reportData.score?.breakdown) {
              const nameMap = {
                metaTags: 'Meta Tags', headingStructure: 'Headings', contentAnalysis: 'Content',
                imageAnalysis: 'Images', linkAnalysis: 'Links', mobileResponsive: 'Mobile',
                performanceMetrics: 'Performance', securityHeaders: 'Security',
                structuredData: 'Structured Data', additionalChecks: 'Technical SEO'
              };
              for (const [key, val] of Object.entries(reportData.score.breakdown)) {
                if (val?.score !== undefined) {
                  categories.push({ name: nameMap[key] || key, score: val.score });
                }
              }
            }

            if (categories.length > 0) {
              summaryHTML += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">';
              categories.forEach(cat => {
                const color = cat.score >= 80 ? '#10b981' : cat.score >= 60 ? '#f59e0b' : '#ef4444';
                const bg = cat.score >= 80 ? 'rgba(16, 185, 129, 0.08)' : cat.score >= 60 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)';
                summaryHTML += `
                  <div style="font-family: ${fontStack}; padding: 20px; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; text-align: center; background: ${bg};">
                    <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.025em;">${cat.name}</div>
                    <div style="font-size: 2rem; font-weight: 700; color: ${color}; letter-spacing: -0.025em;">${cat.score}</div>
                  </div>
                `;
              });
              summaryHTML += '</div>';
            }

            // Key findings
            const findings = [];
            if (reportData.ssl?.valid === false) findings.push({ severity: 'critical', text: 'SSL certificate is invalid or expired' });
            if (reportData.ssl?.valid === true) findings.push({ severity: 'good', text: 'SSL certificate is valid (' + (reportData.ssl.protocol || 'TLS') + ')' });
            if (reportData.headers?.implemented !== undefined) {
              findings.push({
                severity: reportData.headers.implemented / reportData.headers.total > 0.7 ? 'good' : 'warning',
                text: `${reportData.headers.implemented}/${reportData.headers.total} security headers implemented`
              });
            }
            if (reportData.vulnerabilities?.critical > 0) findings.push({ severity: 'critical', text: `${reportData.vulnerabilities.critical} critical vulnerabilities found` });
            if (reportData.vulnerabilities?.high > 0) findings.push({ severity: 'warning', text: `${reportData.vulnerabilities.high} high-severity vulnerabilities found` });
            if (reportData.recommendations?.length > 0) findings.push({ severity: 'info', text: `${reportData.recommendations.length} recommendations available` });

            if (findings.length > 0) {
              summaryHTML += `<h3 style="font-family: ${fontStack}; font-size: 1.125rem; font-weight: 600; color: #111827; margin: 24px 0 12px; letter-spacing: -0.025em;">Key Findings</h3>`;
              summaryHTML += '<div style="line-height: 2;">';
              findings.forEach(f => {
                const icon = f.severity === 'critical' ? '🔴' : f.severity === 'warning' ? '🟡' : f.severity === 'good' ? '🟢' : '🔵';
                summaryHTML += `<div style="font-family: ${fontStack}; color: #374151; font-size: 0.875rem;">${icon} ${f.text}</div>`;
              });
              summaryHTML += '</div>';
            }
          }

          execSummary.innerHTML = summaryHTML;

          // --- Insert all at the beginning of the page body ---
          const firstChild = document.body.firstChild;
          document.body.insertBefore(execSummary, firstChild);
          document.body.insertBefore(tocPage, firstChild);
          document.body.insertBefore(coverPage, firstChild);

          return { headings: headings.length, hasCover: true, hasTOC: headings.length > 0, hasExecSummary: true };
        }, { reportType, reportLabel, analyzedUrl, lang, reportData, logoSvg });
        logger.info('Injected cover page, TOC, executive summary', injectedContent);

        // 22. Final DOM walk as belt-and-suspenders for any remaining dark elements
        await page.evaluate(() => {
          function getBrightness(colorStr) {
            if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return -1;
            const m = colorStr.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (!m) return -1;
            return (parseInt(m[1]) * 299 + parseInt(m[2]) * 587 + parseInt(m[3]) * 114) / 1000;
          }

          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) continue;
            if (el.tagName === 'CANVAS') continue;
            if (el.closest('.pdf-cover-page') || el.closest('.pdf-toc-page') || el.closest('.pdf-exec-summary')) continue;

            const computed = getComputedStyle(el);
            const bgBrightness = getBrightness(computed.backgroundColor);
            if (bgBrightness >= 0 && bgBrightness < 50) {
              el.style.setProperty('background-color', '#ffffff', 'important');
              if (computed.backgroundImage && computed.backgroundImage !== 'none' && computed.backgroundImage.includes('gradient')) {
                el.style.setProperty('background-image', 'none', 'important');
              }
            }
            const textBrightness = getBrightness(computed.color);
            if (textBrightness > 200) {
              el.style.setProperty('color', '#111827', 'important');
            }
          }
        });
        logger.info('DOM walk light mode applied');

        // 23. Wait for final paint
        await page.waitForTimeout(500);

        // Log captured console errors
        if (consoleMessages.length > 0) {
          logger.warn('Browser console errors during PDF render', { count: consoleMessages.length, first5: consoleMessages.slice(0, 5) });
        }

        // 24. Generate PDF
        await page.pdf({
          path: filepath,
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '18mm', right: '12mm', bottom: '18mm', left: '12mm' },
          displayHeaderFooter: true,
          headerTemplate: `
            <div style="font-size: 8px; color: #999; width: 100%; text-align: center; padding: 4px 0; font-family: system-ui, sans-serif;">
              Site Mechanic &mdash; ${reportLabel} Analysis Report
            </div>`,
          footerTemplate: `
            <div style="font-size: 8px; color: #999; width: 100%; text-align: center; padding: 4px 0; font-family: system-ui, sans-serif;">
              Page <span class="pageNumber"></span> of <span class="totalPages"></span>
            </div>`
        });

        logger.info('PDF generated successfully', { filepath, filename, lang });

      } finally {
        try { await page.close(); } catch (e) { /* ignore */ }
      }
    });

    if (!fsSync.existsSync(filepath)) {
      throw new Error('PDF file was not created');
    }
    return { filename, filepath };

  } catch (error) {
    logger.error('Error generating PDF:', { error: error.message, url, reportId, lang });
    throw error;
  }
}

async function cleanupTempFiles() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const file of files) {
      if (file.endsWith('.pdf')) {
        const fp = path.join(TEMP_DIR, file);
        const stats = await fs.stat(fp);
        if (stats.mtimeMs < oneHourAgo) {
          await fs.unlink(fp);
          logger.debug('Cleaned up old temp PDF:', file);
        }
      }
    }
  } catch (error) {
    logger.warn('Error cleaning up temp files:', error.message);
  }
}

setInterval(cleanupTempFiles, 30 * 60 * 1000);

/**
 * Generate PDF from a dedicated PDF template (not the live report page).
 * Simplified rendering path — the template is designed for PDF output,
 * so we skip CSS overrides, accordion expansion, chrome removal, etc.
 */
async function generatePdfFromTemplate(options) {
  const {
    templateUrl,
    reportId = `report-${Date.now()}`,
    reportType = 'report',
    cookies = [],
    lang = 'en',
    reportData = null,
    analyzedUrl = null
  } = options;

  await ensureTempDir();

  const domain = (analyzedUrl || '').replace(/^https?:\/\//, '').split('/')[0] || 'report';
  const dateStr = new Date().toISOString().split('T')[0];
  const typePrefix = getFilenamePrefix(reportType);
  const filename = `${typePrefix}-report-${domain}-${dateStr}.pdf`;
  const uniqueSuffix = Date.now().toString(36);
  const tempFilename = `${typePrefix}-report-${domain}-${dateStr}-${uniqueSuffix}.pdf`;
  const filepath = path.join(TEMP_DIR, tempFilename);

  logger.info('Generating PDF from template', {
    templateUrl, reportId, reportType, lang, typePrefix
  });

  try {
    await browserPool.execute(async (browser) => {
      const page = await browser.newPage();

      try {
        // Console capture for debugging
        page.on('console', msg => {
          if (msg.type() === 'error') {
            logger.warn('[Template PDF console]', msg.text());
          }
        });

        // 1. Viewport — narrower for tighter A4 look, higher DPI for crisp text
        await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 1.5 });

        // 2. Accept-Language header
        await page.setExtraHTTPHeaders({ 'Accept-Language': `${lang},en;q=0.9` });

        // 3. Cookies
        if (cookies.length > 0) {
          await page.setCookie(...cookies);
        }

        // 4. Inject localStorage with reportData before page scripts run
        await page.evaluateOnNewDocument((params) => {
          try {
            localStorage.setItem('theme', 'light');
            localStorage.setItem('sm_lang', params.lang);
            if (params.reportData && params.reportId) {
              const key = `sm_report_${params.reportId}`;
              localStorage.setItem(key, JSON.stringify({
                reportId: params.reportId,
                data: params.reportData,
                metadata: { savedAt: new Date().toISOString(), source: 'pdf-template' }
              }));
            }
            // Also set as global fallback
            window.__PDF_INJECT_DATA__ = params.reportData;
          } catch (e) {
            console.error('[PDF Template] evaluateOnNewDocument error:', e);
          }
        }, { lang, reportData, reportId });

        // 5. Bypass CSP
        await page.setBypassCSP(true);

        // 6. Navigate to the template
        await page.goto(templateUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // 7. Inject CJK font stylesheet if needed
        if (CJK_LANGS.includes(lang) && CJK_FONT_URLS[lang]) {
          logger.info('Injecting CJK font for template', { lang });
          await page.addStyleTag({ url: CJK_FONT_URLS[lang] });
        }

        // 8. Wait for template to signal readiness
        await page.waitForFunction(() => window.__PDF_READY__ === true,
          { timeout: 20000 }).catch(() => logger.warn('Template PDF ready signal timed out'));

        // 9. Wait for fonts
        await page.waitForFunction(() => document.fonts.ready.then(() => true),
          { timeout: 10000 }).catch(() => logger.warn('Template fonts timed out'));

        // 10. Wait for images
        await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return Promise.all(imgs.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
              setTimeout(resolve, 5000);
            });
          }));
        }).catch(() => logger.warn('Template image wait timed out'));

        // 11. Brief settle time
        await page.waitForTimeout(500);

        // 12. Generate PDF
        const footerHtml = buildPdfFooter(lang, reportType);
        await page.pdf({
          path: filepath,
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '12mm', right: '12mm', bottom: '16mm', left: '12mm' },
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: footerHtml
        });

        logger.info('Template PDF generated successfully', { filepath, filename, lang });

      } finally {
        try { await page.close(); } catch (e) { /* ignore */ }
      }
    });

    if (!fsSync.existsSync(filepath)) {
      throw new Error('Template PDF file was not created');
    }
    return { filename, filepath };

  } catch (error) {
    logger.error('Error generating template PDF:', { error: error.message, templateUrl, reportId, lang });
    throw error;
  }
}

module.exports = { generatePdfFromUrl, generatePdfFromTemplate, cleanupTempFiles };
