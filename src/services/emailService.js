const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');
const { getDatabase } = require('../db');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EmailService');

const I18N_DIR = path.join(__dirname, '../public/i18n');

/**
 * Build the branded email wrapper with red logo header.
 * All transactional emails should use this for consistent UX.
 * @param {object} opts
 * @param {string} opts.body - Inner HTML content for the email body
 * @param {string} opts.fromName - Company name for the footer copyright
 * @returns {string} Full HTML email document
 */
function brandedEmailHtml({ body, fromName }) {
  const appUrl = process.env.APP_BASE_URL || process.env.BASE_URL || 'https://sitemechanic.io';
  // Hosted PNG logo — email clients don't support SVG or data URIs
  const logoUrl = `${appUrl}/assets/logo-red.png`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if mso]>
  <style>
    table { border-collapse: collapse; }
    .fallback-font { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
          <!-- Logo header -->
          <tr>
            <td style="background-color:#F8FAFC;padding:28px 40px;text-align:center;border-radius:12px 12px 0 0;border-bottom:1px solid #e2e8f0;">
              <img src="${logoUrl}" alt="Site Mechanic" width="180" style="display:block;margin:0 auto;max-width:180px;height:auto;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#ffffff;padding:0 40px 28px;border-radius:0 0 12px 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid #e5e7eb;padding-top:20px;text-align:center;">
                    <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;">
                      &copy; ${new Date().getFullYear()} ${escHtml(fromName)}
                    </p>
                    <p style="margin:0;color:#c4c9d2;font-size:11px;">
                      <a href="${appUrl}" style="color:#c4c9d2;text-decoration:none;">sitemechanic.io</a>
                    </p>
                  </td>
                </tr>
              </table>
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
  const heading = getI18nString(lang, 'email.passwordReset.heading', 'Reset Your Password');
  const intro = getI18nString(lang, 'email.passwordReset.intro', 'We received a request to reset your password. Click the button below to choose a new one.');
  const cta = getI18nString(lang, 'email.passwordReset.cta', 'Reset Password');
  const expiry = getI18nString(lang, 'email.passwordReset.expiry', 'This link expires in 1 hour.');
  const fallback = getI18nString(lang, 'email.passwordReset.fallback', 'If the button doesn\'t work, copy and paste this URL into your browser:');
  const footerText = getI18nString(lang, 'email.passwordReset.footer', 'If you didn\'t request a password reset, you can safely ignore this email. Your password will remain unchanged.');

  const html = brandedEmailHtml({
    fromName,
    body: `
              <h2 style="margin:0 0 16px;color:#0F172A;font-size:22px;font-weight:700;">${escHtml(heading)}</h2>
              <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.7;">
                ${escHtml(intro)}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${resetUrl}" style="display:inline-block;background-color:#DC2626;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:8px;box-shadow:0 2px 8px rgba(220,38,38,0.25);">
                      ${escHtml(cta)}
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafbfc;border-radius:8px;border:1px solid #e2e8f0;margin:0 0 24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0 0 6px;color:#0F172A;font-size:13px;font-weight:600;">
                      ${escHtml(expiry)}
                    </p>
                    <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">
                      ${escHtml(fallback)}
                    </p>
                    <p style="margin:8px 0 0;color:#DC2626;font-size:12px;line-height:1.4;word-break:break-all;">
                      ${resetUrl}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                ${escHtml(footerText)}
              </p>`
  });

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject,
    text: `${heading}\n\n${intro}\n\n${resetUrl}\n\n${expiry}\n\n${footerText}`,
    html
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
 */
async function sendTestEmail(toEmail) {
  const fromName = config.email.from.name;
  const fromAddress = config.email.from.address;
  const sentAt = new Date().toISOString();

  const html = brandedEmailHtml({
    fromName,
    body: `
              <h2 style="margin:0 0 16px;color:#0F172A;font-size:22px;font-weight:700;">SMTP Test</h2>
              <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">
                If you received this, your SMTP configuration is working correctly.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin:0 0 16px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;color:#166534;font-size:14px;font-weight:600;">&#10004; Connection verified</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#94a3b8;font-size:12px;">Sent at: ${sentAt}</p>`
  });

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject: 'Site Mechanic — SMTP Test',
    text: `SMTP Test\n\nIf you received this, your SMTP configuration is working correctly.\n\nSent at: ${sentAt}`,
    html
  });

  logger.info(`[Email] Test email sent to ${toEmail}`, { messageId: info.messageId });
  return info;
}

/**
 * Read a translated string from the i18n JSON for the given locale.
 */
function getI18nString(lang, keyPath, defaultVal) {
  try {
    let effectiveLang = lang;
    const filePath = path.join(I18N_DIR, `${effectiveLang}.json`);
    if (!fsSync.existsSync(filePath)) effectiveLang = 'en';
    const data = JSON.parse(fsSync.readFileSync(path.join(I18N_DIR, `${effectiveLang}.json`), 'utf8'));
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

// Maps analyzer types to human-readable labels
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
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Send report purchase email (low-level sender)
 * Works gracefully with or without PDF attachment and AI analysis.
 */
async function sendReportPurchaseEmail({ toEmail, reportId, siteUrl, analyzerType, locale, aiData, pdfBuffer }) {
  const fromName = config.email.from.name;
  const fromAddress = config.email.from.address;
  const appUrl = process.env.APP_BASE_URL || process.env.BASE_URL || 'https://sitemechanic.io';
  const lang = locale || 'en';
  const typeLabel = ANALYZER_LABELS[analyzerType] || analyzerType || 'Report';
  const analyzerPage = ANALYZER_PAGE_MAP[analyzerType] || 'seo-analyzer.html';
  const reportUrl = `${appUrl}/${lang}/${analyzerPage}?report_id=${encodeURIComponent(reportId)}`;

  // i18n strings
  const subject = getI18nString(lang, 'email.reportPurchase.subject', 'Your {{type}} Report is Ready').replace('{{type}}', typeLabel);
  const heading = getI18nString(lang, 'email.reportPurchase.heading', 'Your {{type}} Report is Ready').replace('{{type}}', typeLabel);
  const intro = getI18nString(lang, 'email.reportPurchase.intro', 'Your report for {{site}} has been generated and is ready to view.')
    .replace('{{site}}', siteUrl || 'your site');
  const viewOnline = getI18nString(lang, 'email.reportPurchase.viewOnline', 'View Report Online');
  const aiHeading = getI18nString(lang, 'email.reportPurchase.aiHeading', 'AI Strategic Assessment');
  const quickWinLabel = getI18nString(lang, 'email.reportPurchase.quickWinLabel', 'Quick Win');
  const footerText = getI18nString(lang, 'email.reportPurchase.footer', 'This email was sent because you purchased a report on Site Mechanic.');
  const attachmentNote = getI18nString(lang, 'email.reportPurchase.attachmentNote', 'Your full PDF report is attached to this email.');

  // Build AI section (if available)
  let aiSectionHtml = '';
  if (aiData && aiData.strategic) {
    const strategic = aiData.strategic;
    const assessmentText = strategic.assessment || '';
    const quickWins = strategic.quickWins || [];

    aiSectionHtml = `
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <h3 style="margin:0 0 12px;color:#1a1a2e;font-size:17px;font-weight:600;">${escHtml(aiHeading)}</h3>
              ${assessmentText ? `<p style="margin:0 0 16px;color:#4a4a68;font-size:14px;line-height:1.6;">${escHtml(assessmentText)}</p>` : ''}
              ${quickWins.length > 0 ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 8px;color:#166534;font-size:13px;font-weight:600;">${escHtml(quickWinLabel)}</p>
                    <p style="margin:0;color:#15803d;font-size:14px;line-height:1.5;">${escHtml(quickWins[0])}</p>
                  </td>
                </tr>
              </table>` : ''}`;
  }

  const html = brandedEmailHtml({
    fromName,
    body: `
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:22px;font-weight:600;">${escHtml(heading)}</h2>
              <p style="margin:0 0 24px;color:#4a4a68;font-size:15px;line-height:1.6;">
                ${escHtml(intro)}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${reportUrl}" style="display:inline-block;background-color:#DC2626;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 32px;border-radius:6px;">
                      ${escHtml(viewOnline)}
                    </a>
                  </td>
                </tr>
              </table>
              ${pdfBuffer ? `<p style="margin:0 0 16px;color:#6b7280;font-size:13px;line-height:1.5;">${escHtml(attachmentNote)}</p>` : ''}
              ${aiSectionHtml}
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                ${escHtml(footerText)}
              </p>`
  });

  const plainText = `${heading}\n\n${intro}\n\nView your report: ${reportUrl}\n\n${footerText}`;

  const mailOptions = {
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject,
    text: plainText,
    html,
  };

  // Attach PDF if available
  if (pdfBuffer) {
    const domain = (siteUrl || '').replace(/^https?:\/\//, '').split('/')[0] || 'report';
    const dateStr = new Date().toISOString().split('T')[0];
    mailOptions.attachments = [{
      filename: `${(analyzerType || 'report').replace(/[^a-z0-9-]/gi, '-')}-report-${domain}-${dateStr}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }];
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
  const appUrl = process.env.APP_BASE_URL || process.env.BASE_URL || 'https://sitemechanic.io';
  const lang = locale || 'en';

  const subject = getI18nString(lang, 'email.welcome.subject', 'Welcome to Site Mechanic!');
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

  const html = brandedEmailHtml({
    fromName,
    body: `
              <h2 style="margin:0 0 8px;color:#0F172A;font-size:24px;font-weight:700;">${escHtml(heading)}</h2>
              <p style="margin:0 0 32px;color:#475569;font-size:15px;line-height:1.7;">
                ${escHtml(intro)}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 36px;">
                    <a href="${appUrl}" style="display:inline-block;background-color:#DC2626;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 44px;border-radius:8px;letter-spacing:0.3px;box-shadow:0 2px 8px rgba(220,38,38,0.25);">
                      ${escHtml(cta)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 14px;color:#0F172A;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${escHtml(featuresHeading)}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 18px;background-color:#fafbfc;border-bottom:1px solid #e2e8f0;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="vertical-align:top;padding-right:12px;font-size:20px;">&#9889;</td>
                      <td>
                        <p style="margin:0 0 3px;color:#0F172A;font-size:14px;font-weight:600;">${escHtml(feature1)}</p>
                        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">${escHtml(feature1Desc)}</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;background-color:#fafbfc;border-bottom:1px solid #e2e8f0;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="vertical-align:top;padding-right:12px;font-size:20px;">&#10024;</td>
                      <td>
                        <p style="margin:0 0 3px;color:#0F172A;font-size:14px;font-weight:600;">${escHtml(feature2)}</p>
                        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">${escHtml(feature2Desc)}</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;background-color:#fafbfc;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="vertical-align:top;padding-right:12px;font-size:20px;">&#128202;</td>
                      <td>
                        <p style="margin:0 0 3px;color:#0F172A;font-size:14px;font-weight:600;">${escHtml(feature3)}</p>
                        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">${escHtml(feature3Desc)}</p>
                      </td>
                    </tr></table>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                ${escHtml(footerText)}
              </p>`
  });

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject,
    text: `${heading}\n\n${intro}\n\n${appUrl}\n\n- ${feature1}: ${feature1Desc}\n- ${feature2}: ${feature2Desc}\n- ${feature3}: ${feature3Desc}`,
    html
  });

  logger.info(`[Email] Welcome email sent to ${toEmail}`, { messageId: info.messageId });
  return info;
}

module.exports = { sendPasswordResetEmail, sendWelcomeEmail, sendTestEmail, verifyConnection, sendReportPurchaseEmail, sendPurchaseReportWithPdf };
