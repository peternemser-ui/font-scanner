const nodemailer = require('nodemailer');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EmailService');

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

module.exports = { sendPasswordResetEmail, verifyConnection };
