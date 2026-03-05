const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');
const { getDatabase } = require('../db');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EmailService');

const I18N_DIR = path.join(__dirname, '../public/i18n');

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
 */
async function sendPasswordResetEmail(toEmail, resetUrl) {
  const fromName = config.email.from.name;
  const fromAddress = config.email.from.address;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0F172A;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Site Mechanic</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:22px;font-weight:600;">Reset Your Password</h2>
              <p style="margin:0 0 24px;color:#4a4a68;font-size:15px;line-height:1.6;">
                We received a request to reset your password. Click the button below to choose a new one.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${resetUrl}" style="display:inline-block;background-color:#3B82F6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 32px;border-radius:6px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.5;">
                This link expires in <strong>1 hour</strong>.
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:13px;line-height:1.5;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="margin:0 0 24px;color:#3B82F6;font-size:13px;line-height:1.5;word-break:break-all;">
                ${resetUrl}
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                &copy; ${new Date().getFullYear()} ${fromName}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject: 'Reset your Site Mechanic password',
    text: `Reset your password by visiting: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
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

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject: 'Site Mechanic — SMTP Test',
    text: `This is a test email from Site Mechanic.\n\nIf you received this, your SMTP configuration is working correctly.\n\nSent at: ${new Date().toISOString()}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#0F172A;">Site Mechanic — SMTP Test</h2>
        <p>If you received this, your SMTP configuration is working correctly.</p>
        <p style="color:#6b7280;font-size:13px;">Sent at: ${new Date().toISOString()}</p>
      </div>`
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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0F172A;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Site Mechanic</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:22px;font-weight:600;">${escHtml(heading)}</h2>
              <p style="margin:0 0 24px;color:#4a4a68;font-size:15px;line-height:1.6;">
                ${escHtml(intro)}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${reportUrl}" style="display:inline-block;background-color:#3B82F6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 32px;border-radius:6px;">
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
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                &copy; ${new Date().getFullYear()} ${escHtml(fromName)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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

module.exports = { sendPasswordResetEmail, sendTestEmail, verifyConnection, sendReportPurchaseEmail, sendPurchaseReportWithPdf };
