const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');
const { getDatabase } = require('../db');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EmailService');

const I18N_DIR = path.join(__dirname, '../public/i18n');

const LOGO_CID = 'sm-logo@sitemechanic.io';
const LOGO_PATH = path.join(__dirname, '../public/assets/logo-red.png');

// Design tokens ("work order" email system)
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO_STACK = "'Courier New',Courier,monospace";

/**
 * Inline logo attachment referenced by cid: from the branded email header.
 */
function logoAttachment() {
  return {
    filename: 'sitemechanic-logo.png',
    path: LOGO_PATH,
    cid: LOGO_CID,
    contentDisposition: 'inline'
  };
}

/**
 * Resolve the public app URL for links in emails.
 */
function getAppUrl() {
  return process.env.APP_BASE_URL || process.env.BASE_URL || 'https://sitemechanic.io';
}

/**
 * Support mailbox used in footers and List-Unsubscribe headers.
 */
function getSupportAddress() {
  return config.email.supportAddress || 'support@sitemechanic.io';
}

/**
 * Locales that have a /{lang}/ URL prefix route (must match
 * SUPPORTED_LANG_PREFIXES in src/server.js). Unknown locales fall back to
 * 'en' so email links never 404 on an unrecognized prefix.
 */
const URL_LANGS = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ru'];
function urlLang(lang) {
  return URL_LANGS.includes(lang) ? lang : 'en';
}

/**
 * List-Unsubscribe headers (marketing-adjacent sends only: welcome + report
 * purchase). Pure transactional emails omit these.
 * NOTE: no List-Unsubscribe-Post (RFC 8058) header — the app has no one-click
 * POST unsubscribe endpoint, so advertising one would make Gmail/Yahoo's
 * native Unsubscribe button silently fail. Re-add it only once a token-based
 * POST endpoint exists. The HTTPS URI points at the served account.html page
 * (express.static has no extensionless resolution) with the email's language
 * prefix so the language lock is preserved.
 */
function unsubscribeHeaders(lang) {
  const appUrl = getAppUrl();
  return {
    'List-Unsubscribe': `<mailto:${getSupportAddress()}?subject=unsubscribe>, <${appUrl}/${urlLang(lang)}/account.html#notifications>`
  };
}

/* --------------------------------------------------------------------------
 * Component library — identical across all four transactional emails.
 * Table-based, all styles inline, Outlook-robust by construction.
 * ------------------------------------------------------------------------ */

/**
 * Diagnostic kicker label (12px/700 uppercase slate). Letter-spacing is
 * reduced for CJK locales where wide tracking breaks glyph rhythm.
 */
function kickerHtml(lang, text) {
  const ls = (lang === 'ja' || lang === 'zh') ? '0.4px' : '1.5px';
  return `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:12px;font-weight:700;letter-spacing:${ls};text-transform:uppercase;color:#64748B;">${escHtml(text)}</p>`;
}

/** Exactly one H1 per email. */
function h1Html(text) {
  return `<h1 style="margin:0 0 12px;font-family:${FONT_STACK};font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.2px;color:#0F172A;">${escHtml(text)}</h1>`;
}

/** Section heading (real h2). */
function h2Html(text, margin) {
  return `<h2 style="margin:${margin || '0 0 12px'};font-family:${FONT_STACK};font-size:16px;line-height:1.4;font-weight:700;color:#0F172A;">${escHtml(text)}</h2>`;
}

/**
 * The ONE primary CTA geometry. Bulletproof: padding on the <a> for modern
 * clients, plus mso-padding-alt on the <td> for Outlook's Word engine, which
 * ignores padding/display:inline-block on anchors (without the td padding the
 * button would collapse to a text-height red sliver). Background declared on
 * both td and a, no VML. Outlook drops the radius but keeps a solid red
 * padded cell. Full-width block on mobile via .sm-btn.
 */
function buildCta(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="sm-btn" style="margin:28px 0;"><tr><td style="border-radius:8px;background:#DC2626;mso-padding-alt:15px 40px;"><a href="${escHtml(href)}" target="_blank" style="display:inline-block;background:#DC2626;color:#FFFFFF;font-family:${FONT_STACK};font-size:15px;font-weight:700;line-height:1;letter-spacing:0.2px;text-decoration:none;padding:15px 40px;border-radius:8px;border-bottom:3px solid #B91C1C;">${escHtml(label)}</a></td></tr></table>`;
}

/** Neutral info panel (slate on #F8FAFC). Inner HTML is caller-escaped. */
function buildPanel(inner) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px 20px;">${inner}</td></tr></table>`;
}

/** Success panel with pass-check glyph. bodyText is optional. */
function buildSuccessPanel(label, bodyText) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px 20px;"><p style="margin:0;font-family:${FONT_STACK};font-size:13px;font-weight:700;letter-spacing:0.3px;color:#166534;"><span style="font-size:14px;font-weight:700;color:#16A34A;">&#10003;</span>&nbsp;&nbsp;${escHtml(label)}</p>${bodyText ? `<p style="margin:6px 0 0;font-family:${FONT_STACK};font-size:14px;line-height:1.5;color:#15803D;">${escHtml(bodyText)}</p>` : ''}</td></tr></table>`;
}

/**
 * Checklist rows with green pass-check glyphs (no emoji-font roulette).
 * items: [{ title, desc }]
 */
function buildChecklist(items) {
  const rows = items.map((it, i) => {
    const border = i === items.length - 1 ? '' : 'border-bottom:1px solid #E2E8F0;';
    return `<tr><td width="28" valign="top" style="padding:14px 0;${border}"><span style="font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#16A34A;line-height:1;">&#10003;</span></td><td style="padding:14px 0 14px 4px;${border}"><p style="margin:0 0 3px;font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#0F172A;">${escHtml(it.title)}</p><p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:#64748B;">${escHtml(it.desc)}</p></td></tr>`;
  }).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>`;
}

/**
 * Work-order "job sheet" card: micro-label + value field rows in a panel.
 * fields: [{ label, value, mono }]
 */
function buildJobSheet(fields) {
  const rows = fields.map((f) => {
    const valueStyle = f.mono
      ? `font-family:${MONO_STACK};font-size:13px;font-weight:400;color:#0F172A;word-break:break-all;`
      : `font-family:${FONT_STACK};font-size:14px;font-weight:600;color:#0F172A;`;
    return `<tr><td width="110" valign="top" style="padding:6px 12px 6px 0;font-family:${FONT_STACK};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94A3B8;">${escHtml(f.label)}</td><td style="padding:6px 0;${valueStyle}">${escHtml(f.value)}</td></tr>`;
  }).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table></td></tr></table>`;
}

/** Divider (replaces <hr>, which clients style unpredictably). */
function buildDivider() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0;"><tr><td style="border-top:1px solid #E2E8F0;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

/** Fine print footer note. */
function finePrintHtml(text) {
  return `<p style="margin:24px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:#94A3B8;">${escHtml(text)}</p>`;
}

/**
 * Build the branded email wrapper — "work order" system: light card with a
 * 3px red gauge line under the logo header, in-card footer, canvas sub-footer.
 * All transactional emails go through this for consistent UX.
 * @param {object} opts
 * @param {string} opts.body - Inner HTML content for the email body
 * @param {string} opts.fromName - Company name for the footer copyright
 * @param {string} [opts.preheader=''] - Hidden inbox-preview text
 * @param {string} [opts.lang='en'] - Locale for chrome strings (footer links, logo alt)
 * @param {string} [opts.title] - <title> text (defaults to fromName)
 * @param {boolean} [opts.managePrefs=false] - Show "Manage email preferences" sub-footer link
 * @returns {string} Full HTML email document
 */
function brandedEmailHtml({ body, fromName, preheader, lang, title, managePrefs }) {
  const appUrl = getAppUrl();
  const l = lang || 'en';
  // Logo is embedded as an inline CID attachment (see logoAttachment) so it
  // renders even when clients block remote images. Every sendMail call that
  // uses this wrapper must include logoAttachment() in its attachments.
  const logoUrl = `cid:${LOGO_CID}`;
  const supportAddress = getSupportAddress();
  const postalAddress = String(config.email.postalAddress || process.env.EMAIL_POSTAL_ADDRESS || '').trim();
  const logoAlt = getI18nString(l, 'email.common.logoAlt', 'Site Mechanic');
  const supportLabel = getI18nString(l, 'email.common.support', 'Support');
  const privacyLabel = getI18nString(l, 'email.common.privacy', 'Privacy Policy');
  const termsLabel = getI18nString(l, 'email.common.terms', 'Terms of Service');
  const managePrefsLabel = getI18nString(l, 'email.common.managePrefs', 'Manage email preferences');
  const copyright = getI18nString(l, 'email.common.copyright', '© {{year}} {{name}}. All rights reserved.')
    .replace('{{year}}', String(new Date().getFullYear()))
    .replace('{{name}}', fromName || 'Site Mechanic');
  const sep = '<span style="color:#CBD5E1;">&nbsp;&middot;&nbsp;</span>';
  // Preheader is ALWAYS rendered (empty when none) so no client promotes body
  // copy into the inbox preview; &nbsp;&zwnj; padding stops preview bleed.
  const preheaderPad = '&nbsp;&zwnj;'.repeat(90);
  return `<!DOCTYPE html>
<html lang="${escHtml(l)}" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escHtml(title || fromName)}</title>
  <!--[if mso]>
  <style>
    table { border-collapse: collapse; }
    .fallback-font { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
  <style>
    @media only screen and (max-width:620px){ .sm-outer-pad{padding:24px 12px!important} .sm-card-pad{padding-left:24px!important;padding-right:24px!important} .sm-btn, .sm-btn a{display:block!important;text-align:center!important} }
  </style>
</head>
<body style="margin:0;padding:0;background:#F0F2F5;word-spacing:normal;font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escHtml(preheader || '')}${preheaderPad}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#F0F2F5" style="background:#F0F2F5;">
    <tr>
      <td align="center" class="sm-outer-pad" style="padding:48px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="580" style="max-width:580px;width:100%;">
          <!-- Logo header with red gauge line -->
          <tr>
            <td class="sm-card-pad" style="background:#F8FAFC;padding:24px 40px;border-radius:12px 12px 0 0;border-bottom:3px solid #DC2626;">
              <img src="${logoUrl}" width="160" alt="${escHtml(logoAlt)}" style="display:block;width:160px;max-width:160px;height:auto;border:0;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#DC2626;" />
            </td>
          </tr>
          <!-- Card: body + in-card footer in one cell -->
          <tr>
            <td class="sm-card-pad" style="background:#FFFFFF;padding:36px 40px 28px;border-radius:0 0 12px 12px;">
              ${body}
              <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top:1px solid #E2E8F0;padding-top:20px;">
                    <p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:#64748B;"><a href="mailto:${escHtml(supportAddress)}" style="color:#64748B;text-decoration:underline;">${escHtml(supportLabel)}</a>${sep}<a href="${appUrl}/${urlLang(l)}/privacy.html" target="_blank" style="color:#64748B;text-decoration:underline;">${escHtml(privacyLabel)}</a>${sep}<a href="${appUrl}/${urlLang(l)}/terms.html" target="_blank" style="color:#64748B;text-decoration:underline;">${escHtml(termsLabel)}</a></p>
                    <p style="margin:6px 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:#94A3B8;">${escHtml(copyright)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Canvas sub-footer -->
          <tr>
            <td align="center" style="padding:20px 24px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.7;color:#94A3B8;">
              <a href="${appUrl}" target="_blank" style="color:#64748B;text-decoration:underline;">sitemechanic.io</a>${postalAddress ? `<br>${escHtml(postalAddress)}` : ''}${managePrefs ? `<br><a href="${appUrl}/${urlLang(l)}/account.html#notifications" target="_blank" style="color:#64748B;text-decoration:underline;">${escHtml(managePrefsLabel)}</a>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: config.email.smtp.host,
  port: config.email.smtp.port,
  secure: config.email.smtp.secure,
  auth: {
    user: config.email.smtp.auth.user,
    pass: config.email.smtp.auth.pass
  }
});

/**
 * Send password reset email
 * @param {string} toEmail - Recipient email address
 * @param {string} resetUrl - Full password reset URL with token
 * @param {string} [locale='en'] - User's locale for i18n
 */
async function sendPasswordResetEmail(toEmail, resetUrl, locale) {
  const fromName = config.email.from.name;
  const fromAddress = config.email.from.address;
  const lang = locale || 'en';

  const subject = getI18nString(lang, 'email.passwordReset.subject', 'Reset your Site Mechanic password');
  const preheader = getI18nString(lang, 'email.passwordReset.preheader', 'Use the link inside to choose a new password. It expires in 1 hour.');
  const kicker = getI18nString(lang, 'email.passwordReset.kicker', 'Account security');
  const heading = getI18nString(lang, 'email.passwordReset.heading', 'Reset Your Password');
  const intro = getI18nString(lang, 'email.passwordReset.intro', 'We received a request to reset your password. Click the button below to choose a new one.');
  const cta = getI18nString(lang, 'email.passwordReset.cta', 'Reset Password');
  const expiry = getI18nString(lang, 'email.passwordReset.expiry', 'This link expires in 1 hour.');
  const fallback = getI18nString(lang, 'email.passwordReset.fallback', 'If the button doesn\'t work, copy and paste this URL into your browser:');
  const footerText = getI18nString(lang, 'email.passwordReset.footer', 'If you didn\'t request a password reset, you can safely ignore this email. Your password will remain unchanged.');

  const html = brandedEmailHtml({
    fromName,
    preheader,
    lang,
    title: subject,
    body: `
              ${kickerHtml(lang, kicker)}
              ${h1Html(heading)}
              <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:#475569;">${escHtml(intro)}</p>
              ${buildCta(resetUrl, cta)}
              ${buildPanel(`
                <p style="margin:0;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:#0F172A;">${escHtml(expiry)}</p>
                <p style="margin:8px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:#64748B;">${escHtml(fallback)}</p>
                <p style="margin:8px 0 0;"><a href="${escHtml(resetUrl)}" target="_blank" style="font-family:${MONO_STACK};font-size:12px;line-height:1.5;color:#475569;text-decoration:underline;word-break:break-all;">${escHtml(resetUrl)}</a></p>
              `)}
              ${finePrintHtml(footerText)}`
  });

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject,
    text: `${heading}\n\n${intro}\n\n${cta}:\n${resetUrl}\n\n${expiry}\n${fallback}\n${resetUrl}\n\n${footerText}`,
    html,
    attachments: [logoAttachment()]
  });

  logger.info(`[Email] Password reset email sent to ${toEmail}`, { messageId: info.messageId });
  return info;
}

/**
 * Verify SMTP connection (optional healthcheck)
 */
async function verifyConnection() {
  try {
    await transporter.verify();
    logger.info('[Email] SMTP connection verified');
    return true;
  } catch (err) {
    logger.error('[Email] SMTP connection failed', { error: err.message });
    return false;
  }
}

/**
 * Send a test email to verify SMTP is working end-to-end
 * @param {string} toEmail - Recipient email address
 * @param {string} [locale='en'] - Locale for i18n (admin routes may pass from query)
 */
async function sendTestEmail(toEmail, locale) {
  const fromName = config.email.from.name;
  const fromAddress = config.email.from.address;
  const lang = locale || 'en';
  const sentAt = new Date().toISOString();

  const subject = getI18nString(lang, 'email.smtpTest.subject', 'Site Mechanic — SMTP Test');
  const preheader = getI18nString(lang, 'email.smtpTest.preheader', 'SMTP connection verified — your email configuration is working.');
  const kicker = getI18nString(lang, 'email.smtpTest.kicker', 'System diagnostics');
  const heading = getI18nString(lang, 'email.smtpTest.heading', 'SMTP Test');
  const intro = getI18nString(lang, 'email.smtpTest.intro', 'If you received this, your SMTP configuration is working correctly.');
  const verified = getI18nString(lang, 'email.smtpTest.verified', 'Connection verified');
  const sentAtLabel = getI18nString(lang, 'email.smtpTest.sentAt', 'Sent at:');

  const html = brandedEmailHtml({
    fromName,
    preheader,
    lang,
    title: subject,
    body: `
              ${kickerHtml(lang, kicker)}
              ${h1Html(heading)}
              <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:#475569;">${escHtml(intro)}</p>
              ${buildSuccessPanel(verified)}
              <p style="margin:16px 0 0;font-family:${MONO_STACK};font-size:12px;line-height:1.5;color:#64748B;">${escHtml(sentAtLabel)} ${escHtml(sentAt)}</p>`
  });

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject,
    text: `${heading}\n\n${intro}\n\n${verified}\n\n${sentAtLabel} ${sentAt}`,
    html,
    attachments: [logoAttachment()]
  });

  logger.info(`[Email] Test email sent to ${toEmail}`, { messageId: info.messageId });
  return info;
}

// Module-level cache of parsed locale JSON (per-string readFileSync would be
// ~25 disk reads per email with this design).
const i18nCache = new Map();

function loadLocaleData(lang) {
  if (i18nCache.has(lang)) return i18nCache.get(lang);
  let data = null;
  try {
    const filePath = path.join(I18N_DIR, `${lang}.json`);
    if (fsSync.existsSync(filePath)) {
      data = JSON.parse(fsSync.readFileSync(filePath, 'utf8'));
    }
  } catch {
    data = null;
  }
  i18nCache.set(lang, data);
  return data;
}

/**
 * Read a translated string from the i18n JSON for the given locale.
 */
function getI18nString(lang, keyPath, defaultVal) {
  try {
    const data = loadLocaleData(lang) || (lang !== 'en' ? loadLocaleData('en') : null);
    if (!data) return defaultVal;
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

// Maps analyzer types to human-readable labels (English fallbacks for the
// email.analyzer.* i18n keys)
const ANALYZER_LABELS = {
  'security': 'Security',
  'seo': 'SEO',
  'performance': 'Performance',
  'accessibility': 'Accessibility',
  'core-web-vitals': 'Core Web Vitals',
  'enhanced-fonts': 'Font & Typography',
  'fonts': 'Font & Typography',
  'tag-intelligence': 'Tag Intelligence',
  'broken-links': 'Broken Links',
  'mobile-analyzer': 'Mobile',
  'mobile': 'Mobile',
  'hosting-analyzer': 'Hosting',
  'hosting': 'Hosting',
  'site-crawler': 'Site Crawler',
  'cro-analysis': 'CRO',
  'cro': 'CRO',
  'brand-consistency': 'Brand Consistency',
  'geo-seo': 'Geo SEO',
  'local-seo': 'Local SEO',
  'gdpr-compliance': 'GDPR Compliance',
  'gdpr': 'GDPR Compliance',
  'ip-reputation': 'IP Reputation',
  'competitive': 'Competitive Analysis',
};

// Alias slugs → canonical slugs used by the email.analyzer.* i18n keys
const ANALYZER_CANONICAL = {
  'enhanced-fonts': 'fonts',
  'mobile-analyzer': 'mobile',
  'hosting-analyzer': 'hosting',
  'cro-analysis': 'cro',
  'gdpr-compliance': 'gdpr',
};

// Maps analyzer type to the page filename for report viewing
const ANALYZER_PAGE_MAP = {
  seo: 'seo-analyzer.html',
  performance: 'performance-hub.html',
  accessibility: 'accessibility-analyzer.html',
  security: 'security-analyzer.html',
  fonts: 'enhanced-fonts.html',
  'enhanced-fonts': 'enhanced-fonts.html',
  'tag-intelligence': 'tag-intelligence.html',
  'core-web-vitals': 'core-web-vitals.html',
  'ip-reputation': 'ip-reputation-analyzer.html',
  'broken-links': 'broken-links.html',
  'geo-seo': 'geo-seo.html',
  gdpr: 'gdpr-compliance.html',
  'gdpr-compliance': 'gdpr-compliance.html',
  mobile: 'mobile-analyzer.html',
  'mobile-analyzer': 'mobile-analyzer.html',
  cro: 'cro-analyzer.html',
  'cro-analysis': 'cro-analyzer.html',
  'site-crawler': 'site-crawler.html',
  'brand-consistency': 'brand-consistency.html',
  competitive: 'competitive-analysis.html',
};

// Maps analyzer type to PDF template page
const PDF_TEMPLATE_MAP = {
  seo: 'pdf-templates/seo-report.html',
  security: 'pdf-templates/security-report.html',
  accessibility: 'pdf-templates/accessibility-report.html',
  performance: 'pdf-templates/performance-report.html',
  fonts: 'pdf-templates/fonts-report.html',
  'enhanced-fonts': 'pdf-templates/fonts-report.html',
  'tag-intelligence': 'pdf-templates/tag-intelligence-report.html',
  'core-web-vitals': 'pdf-templates/core-web-vitals-report.html',
  'ip-reputation': 'pdf-templates/ip-reputation-report.html',
  'broken-links': 'pdf-templates/broken-links-report.html',
  'geo-seo': 'pdf-templates/geo-seo-report.html',
  gdpr: 'pdf-templates/gdpr-report.html',
  'gdpr-compliance': 'pdf-templates/gdpr-report.html',
  mobile: 'pdf-templates/mobile-report.html',
  'mobile-analyzer': 'pdf-templates/mobile-report.html',
  cro: 'pdf-templates/cro-report.html',
  'cro-analysis': 'pdf-templates/cro-report.html',
  'site-crawler': 'pdf-templates/site-crawler-report.html',
  'brand-consistency': 'pdf-templates/brand-consistency-report.html',
  competitive: 'pdf-templates/competitive-report.html',
};

/**
 * Escape HTML special characters for safe embedding in email HTML
 */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Send report purchase email (low-level sender)
 * Works gracefully with or without PDF attachment and AI analysis.
 */
async function sendReportPurchaseEmail({ toEmail, reportId, siteUrl, analyzerType, locale, aiData, pdfBuffer }) {
  const fromName = config.email.from.name;
  const fromAddress = config.email.from.address;
  const appUrl = getAppUrl();
  const lang = locale || 'en';
  // Resolve alias slug to canonical FIRST, then localize the analyzer label
  // so subjects/headings are single-language (project invariant 6).
  const canonicalSlug = ANALYZER_CANONICAL[analyzerType] || analyzerType || '';
  const typeLabel = getI18nString(lang, `email.analyzer.${canonicalSlug}`, ANALYZER_LABELS[analyzerType] || 'Report');
  const analyzerPage = ANALYZER_PAGE_MAP[analyzerType] || 'seo-analyzer.html';
  const reportUrl = `${appUrl}/${lang}/${analyzerPage}?report_id=${encodeURIComponent(reportId)}`;

  // i18n strings
  const siteFallback = getI18nString(lang, 'email.reportPurchase.siteFallback', 'your site');
  const siteDisplay = siteUrl || siteFallback;
  const subject = getI18nString(lang, 'email.reportPurchase.subject', 'Your {{type}} Report is Ready').replace('{{type}}', typeLabel);
  const preheader = getI18nString(lang, 'email.reportPurchase.preheader', 'Your {{type}} report for {{site}} is ready to view.')
    .replace('{{type}}', typeLabel)
    .replace('{{site}}', siteDisplay);
  const kicker = getI18nString(lang, 'email.reportPurchase.kicker', 'Diagnostic complete');
  const heading = getI18nString(lang, 'email.reportPurchase.heading', 'Your {{type}} Report is Ready').replace('{{type}}', typeLabel);
  const introTemplate = getI18nString(lang, 'email.reportPurchase.intro', 'Your report for {{site}} has been generated and is ready to view.');
  const fieldSite = getI18nString(lang, 'email.reportPurchase.fieldSite', 'Site');
  const fieldReport = getI18nString(lang, 'email.reportPurchase.fieldReport', 'Report');
  const fieldDate = getI18nString(lang, 'email.reportPurchase.fieldDate', 'Date');
  const viewOnline = getI18nString(lang, 'email.reportPurchase.viewOnline', 'View Report Online');
  const aiHeading = getI18nString(lang, 'email.reportPurchase.aiHeading', 'AI Strategic Assessment');
  const quickWinLabel = getI18nString(lang, 'email.reportPurchase.quickWinLabel', 'Quick Win');
  const footerText = getI18nString(lang, 'email.reportPurchase.footer', 'This email was sent because you purchased a report on Site Mechanic.');
  const attachmentNote = getI18nString(lang, 'email.reportPurchase.attachmentNote', 'Your full PDF report is attached to this email.');

  // Intro with emphasized site (escape template first; {{site}} survives escaping)
  const introHtml = escHtml(introTemplate)
    .replace('{{site}}', `<span style="font-weight:600;color:#0F172A;">${escHtml(siteDisplay)}</span>`);
  const introText = introTemplate.replace('{{site}}', siteDisplay);

  // Localized job-sheet date
  let dateValue;
  try {
    dateValue = new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date());
  } catch {
    dateValue = new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date());
  }

  // PDF attachment note with text chip ("PDF" is a literal, not translated)
  const pdfNoteHtml = pdfBuffer
    ? `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:#64748B;"><span style="display:inline-block;background:#FEF2F2;color:#DC2626;font-family:${FONT_STACK};font-size:12px;font-weight:700;letter-spacing:0.5px;padding:2px 8px;border-radius:4px;margin-right:8px;">PDF</span>${escHtml(attachmentNote)}</p>`
    : '';

  // Build AI section (if available)
  let aiSectionHtml = '';
  let aiSectionText = '';
  if (aiData && aiData.strategic) {
    const strategic = aiData.strategic;
    const assessmentText = strategic.assessment || '';
    const quickWins = strategic.quickWins || [];

    aiSectionHtml = `
              ${buildDivider()}
              ${h2Html(aiHeading)}
              ${assessmentText ? `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:#475569;">${escHtml(assessmentText)}</p>` : ''}
              ${quickWins.length > 0 ? buildSuccessPanel(quickWinLabel, quickWins[0]) : ''}`;
    aiSectionText = `\n\n${aiHeading}\n${assessmentText}${quickWins.length > 0 ? `\n- ${quickWinLabel}: ${quickWins[0]}` : ''}`;
  }

  const html = brandedEmailHtml({
    fromName,
    preheader,
    lang,
    title: subject,
    managePrefs: true,
    body: `
              ${kickerHtml(lang, kicker)}
              ${h1Html(heading)}
              <p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:#475569;">${introHtml}</p>
              ${buildJobSheet([
                { label: fieldSite, value: siteDisplay, mono: true },
                { label: fieldReport, value: typeLabel },
                { label: fieldDate, value: dateValue },
              ])}
              ${buildCta(reportUrl, viewOnline)}
              ${pdfNoteHtml}
              ${aiSectionHtml}
              ${buildDivider()}
              ${finePrintHtml(footerText)}`
  });

  const plainText = `${heading}\n\n${introText}\n\n- ${fieldSite}: ${siteDisplay}\n- ${fieldReport}: ${typeLabel}\n- ${fieldDate}: ${dateValue}\n\n${viewOnline}:\n${reportUrl}${pdfBuffer ? `\n\n${attachmentNote}` : ''}${aiSectionText}\n\n${footerText}`;

  const mailOptions = {
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject,
    text: plainText,
    html,
    headers: unsubscribeHeaders(lang),
    attachments: [logoAttachment()],
  };

  // Attach PDF if available
  if (pdfBuffer) {
    // Filename safety: fall back to ASCII 'report' when the localized value
    // contains non-ASCII characters.
    let filenameFallback = getI18nString(lang, 'email.reportPurchase.filenameFallback', 'report');
    if (!/^[\x20-\x7E]+$/.test(filenameFallback)) filenameFallback = 'report';
    const domain = (siteUrl || '').replace(/^https?:\/\//, '').split('/')[0] || filenameFallback;
    const dateStr = new Date().toISOString().split('T')[0];
    mailOptions.attachments.push({
      filename: `${(analyzerType || filenameFallback).replace(/[^a-z0-9-]/gi, '-')}-report-${domain}-${dateStr}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    });
  }

  const info = await transporter.sendMail(mailOptions);
  logger.info('[Email] Purchase report email sent', { toEmail, reportId, messageId: info.messageId });
  return info;
}

/**
 * Orchestrator: Generate PDF + fetch AI analysis, then send purchase email.
 * Called fire-and-forget from stripe webhook after purchase recording.
 */
async function sendPurchaseReportWithPdf({ userId, reportId, siteUrl, analyzerType }) {
  const db = getDatabase();

  // 1. Idempotency check — skip if already sent
  try {
    const purchase = await db.get(
      'SELECT email_sent FROM report_purchases WHERE user_id = ? AND report_id = ?',
      [userId, reportId]
    );
    if (purchase && purchase.email_sent === 1) {
      logger.info('[Email] Purchase email already sent, skipping', { userId: userId.substring(0, 8) + '...', reportId });
      return;
    }
  } catch (err) {
    // Column may not exist yet if migration hasn't run — continue anyway
    logger.warn('[Email] Could not check email_sent flag', { error: err.message });
  }

  // 2. Fetch user email
  let userEmail;
  try {
    const user = await db.get('SELECT email FROM users WHERE id = ?', [userId]);
    if (!user || !user.email) {
      logger.warn('[Email] No email found for user, skipping purchase email', { userId: userId.substring(0, 8) + '...' });
      return;
    }
    userEmail = user.email;
  } catch (err) {
    logger.error('[Email] Failed to fetch user email', { error: err.message });
    return;
  }

  // 3. Fetch scan data + locale
  let scanData = null;
  let locale = 'en';
  try {
    const scan = await db.get(
      'SELECT report_data, locale FROM scans WHERE report_id = ? ORDER BY created_at DESC LIMIT 1',
      [reportId]
    );
    if (scan) {
      locale = scan.locale || 'en';
      if (scan.report_data) {
        scanData = typeof scan.report_data === 'string' ? JSON.parse(scan.report_data) : scan.report_data;
      }
    }
  } catch (err) {
    logger.warn('[Email] Could not fetch scan data', { error: err.message, reportId });
  }

  // 4. Fetch AI analysis (best-effort)
  let aiData = null;
  try {
    const aiService = require('./aiRecommendationService');
    const result = await aiService.getRecommendations(reportId, analyzerType, scanData, locale);
    if (result && result.recommendations && result.recommendations.strategic) {
      aiData = result.recommendations;
    }
  } catch (err) {
    logger.warn('[Email] AI recommendations unavailable for purchase email', { error: err.message });
  }

  // 5. Generate PDF (best-effort)
  let pdfBuffer = null;
  let pdfFilepath = null;
  try {
    const templatePage = PDF_TEMPLATE_MAP[analyzerType];
    if (templatePage) {
      const puppeteerPdfService = require('./puppeteerPdfService');
      const port = process.env.PORT || 3000;
      const templateUrl = `http://localhost:${port}/${locale}/${templatePage}?report_id=${encodeURIComponent(reportId)}&locale=${locale}`;

      const result = await puppeteerPdfService.generatePdfFromTemplate({
        templateUrl,
        reportId,
        reportType: analyzerType,
        cookies: [],
        lang: locale,
        reportData: scanData,
        analyzedUrl: siteUrl,
      });

      pdfFilepath = result.filepath;
      pdfBuffer = await fs.readFile(result.filepath);
    }
  } catch (err) {
    logger.warn('[Email] PDF generation failed for purchase email, sending without attachment', { error: err.message });
  }

  // 6. Send email
  try {
    await sendReportPurchaseEmail({
      toEmail: userEmail,
      reportId,
      siteUrl,
      analyzerType,
      locale,
      aiData,
      pdfBuffer,
    });
  } catch (err) {
    logger.error('[Email] Failed to send purchase report email', { error: err.message, reportId });
    // Clean up temp PDF
    if (pdfFilepath) {
      fs.unlink(pdfFilepath).catch(() => {});
    }
    return;
  }

  // 7. Mark email as sent
  try {
    await db.run(
      'UPDATE report_purchases SET email_sent = 1, email_sent_at = CURRENT_TIMESTAMP WHERE user_id = ? AND report_id = ?',
      [userId, reportId]
    );
  } catch (err) {
    logger.warn('[Email] Could not update email_sent flag', { error: err.message });
  }

  // 8. Clean up temp PDF
  if (pdfFilepath) {
    fs.unlink(pdfFilepath).catch(() => {});
  }

  logger.info('[Email] Purchase report email flow completed', {
    userId: userId.substring(0, 8) + '...',
    reportId,
    analyzerType,
    hadAi: !!aiData,
    hadPdf: !!pdfBuffer,
  });
}

/**
 * Send a welcome email when a new user registers.
 * @param {string} toEmail - The new user's email address
 * @param {string} [locale='en'] - User's locale for i18n
 */
async function sendWelcomeEmail(toEmail, locale) {
  const fromName = config.email.from.name;
  const fromAddress = config.email.from.address;
  const appUrl = getAppUrl();
  const lang = locale || 'en';

  const subject = getI18nString(lang, 'email.welcome.subject', 'Welcome to Site Mechanic!');
  const preheader = getI18nString(lang, 'email.welcome.preheader', 'Your account is ready — run your first site diagnostic in seconds.');
  const kicker = getI18nString(lang, 'email.welcome.kicker', 'Account ready');
  const heading = getI18nString(lang, 'email.welcome.heading', 'Welcome to Site Mechanic!');
  const intro = getI18nString(lang, 'email.welcome.intro', 'Your account has been created. You\'re ready to start analyzing your websites with professional-grade tools.');
  const cta = getI18nString(lang, 'email.welcome.cta', 'Start Your First Scan');
  const featuresHeading = getI18nString(lang, 'email.welcome.featuresHeading', 'Here\'s what you can do:');
  const feature1 = getI18nString(lang, 'email.welcome.feature1', 'Run SEO, performance, and security audits');
  const feature1Desc = getI18nString(lang, 'email.welcome.feature1Desc', 'Analyze any website in seconds with 15+ professional tools');
  const feature2 = getI18nString(lang, 'email.welcome.feature2', 'Get actionable recommendations with AI insights');
  const feature2Desc = getI18nString(lang, 'email.welcome.feature2Desc', 'AI-powered analysis tells you exactly what to fix and why');
  const feature3 = getI18nString(lang, 'email.welcome.feature3', 'Export detailed PDF reports');
  const feature3Desc = getI18nString(lang, 'email.welcome.feature3Desc', 'Share branded reports with clients and stakeholders');
  const footerText = getI18nString(lang, 'email.welcome.footer', 'You\'re receiving this because you created an account on Site Mechanic.');

  // Language-prefixed .html link: express.static has no extensionless
  // resolution, and the /{lang}/ prefix sets the sm_url_lang language-lock
  // cookie so the page renders in the email's locale.
  const dashboardUrl = `${appUrl}/${urlLang(lang)}/dashboard.html`;

  const html = brandedEmailHtml({
    fromName,
    preheader,
    lang,
    title: subject,
    managePrefs: true,
    body: `
              ${kickerHtml(lang, kicker)}
              ${h1Html(heading)}
              <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:#475569;">${escHtml(intro)}</p>
              ${buildCta(dashboardUrl, cta)}
              ${h2Html(featuresHeading, '28px 0 4px')}
              ${buildChecklist([
                { title: feature1, desc: feature1Desc },
                { title: feature2, desc: feature2Desc },
                { title: feature3, desc: feature3Desc },
              ])}
              ${finePrintHtml(footerText)}`
  });

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject,
    text: `${heading}\n\n${intro}\n\n${cta}:\n${dashboardUrl}\n\n${featuresHeading}\n- ${feature1}: ${feature1Desc}\n- ${feature2}: ${feature2Desc}\n- ${feature3}: ${feature3Desc}\n\n${footerText}`,
    html,
    headers: unsubscribeHeaders(lang),
    attachments: [logoAttachment()]
  });

  logger.info(`[Email] Welcome email sent to ${toEmail}`, { messageId: info.messageId });
  return info;
}

module.exports = { sendPasswordResetEmail, sendWelcomeEmail, sendTestEmail, verifyConnection, sendReportPurchaseEmail, sendPurchaseReportWithPdf };
