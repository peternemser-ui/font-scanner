/**
 * Unit Tests for Email Service
 *
 * Verifies the PUBLIC contract of src/services/emailService.js:
 *  - Inline CID logo attachment on every branded email
 *  - PDF attachment handling for purchase emails
 *  - Plain-text part + subject on every send
 *  - Locale handling (translated strings + English fallback)
 *  - HTML escaping of user-influenced values
 *
 * nodemailer is fully mocked — no real SMTP traffic occurs.
 */

const LOGO_CID = 'sm-logo@sitemechanic.io';

// Mock nodemailer BEFORE requiring the service (factory runs lazily on require)
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const mockVerify = jest.fn().mockResolvedValue(true);
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify
  }))
}));

// Mock the db module so no real database is opened at load time
jest.mock('../../src/db', () => ({
  getDatabase: jest.fn(),
  initializeDatabase: jest.fn()
}));

// Mock logger to keep test output clean and avoid any file/console transports
jest.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

const emailService = require('../../src/services/emailService');

/** Return the mail options object of the most recent sendMail call */
function lastMail() {
  expect(mockSendMail).toHaveBeenCalled();
  return mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1][0];
}

function findLogoAttachment(mail) {
  expect(Array.isArray(mail.attachments)).toBe(true);
  return mail.attachments.find((a) => a && a.cid === LOGO_CID);
}

describe('EmailService', () => {
  beforeEach(() => {
    mockSendMail.mockClear();
    mockVerify.mockClear();
  });

  // -------------------------------------------------------------------------
  // 1. CID logo attachment + html references it
  // -------------------------------------------------------------------------
  describe('inline CID logo branding', () => {
    const senders = [
      ['sendWelcomeEmail', () => emailService.sendWelcomeEmail('user@example.com', 'en')],
      ['sendPasswordResetEmail', () => emailService.sendPasswordResetEmail('user@example.com', 'https://sitemechanic.io/reset-password?token=abc123', 'en')],
      ['sendTestEmail', () => emailService.sendTestEmail('user@example.com')]
    ];

    test.each(senders)('%s includes the CID logo attachment', async (_name, send) => {
      await send();
      const mail = lastMail();
      const logo = findLogoAttachment(mail);
      expect(logo).toBeDefined();
      expect(logo.cid).toBe(LOGO_CID);
    });

    test.each(senders)(`%s html references cid:${LOGO_CID}`, async (_name, send) => {
      await send();
      const mail = lastMail();
      expect(typeof mail.html).toBe('string');
      expect(mail.html).toContain(`cid:${LOGO_CID}`);
    });
  });

  // -------------------------------------------------------------------------
  // 2. sendReportPurchaseEmail attachments
  // -------------------------------------------------------------------------
  describe('sendReportPurchaseEmail attachments', () => {
    const baseArgs = {
      toEmail: 'buyer@example.com',
      reportId: 'rep_123',
      siteUrl: 'https://example.com',
      analyzerType: 'seo',
      locale: 'en'
    };

    it('includes BOTH the logo attachment and the PDF attachment when pdfBuffer is provided', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
      await emailService.sendReportPurchaseEmail({ ...baseArgs, pdfBuffer });

      const mail = lastMail();
      expect(Array.isArray(mail.attachments)).toBe(true);
      expect(mail.attachments.length).toBeGreaterThanOrEqual(2);

      const logo = findLogoAttachment(mail);
      expect(logo).toBeDefined();

      const pdf = mail.attachments.find((a) => a && a.contentType === 'application/pdf');
      expect(pdf).toBeDefined();
      expect(pdf.content).toBe(pdfBuffer);
      expect(pdf.filename).toMatch(/\.pdf$/i);
      // Logo and PDF are distinct attachments
      expect(pdf).not.toBe(logo);
    });

    it('includes just the logo attachment when pdfBuffer is absent', async () => {
      await emailService.sendReportPurchaseEmail({ ...baseArgs });

      const mail = lastMail();
      const logo = findLogoAttachment(mail);
      expect(logo).toBeDefined();

      const pdfs = mail.attachments.filter((a) => a && a.contentType === 'application/pdf');
      expect(pdfs).toHaveLength(0);
      expect(mail.attachments).toHaveLength(1);
      expect(mail.html).toContain(`cid:${LOGO_CID}`);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Plain-text part and subject on every send
  // -------------------------------------------------------------------------
  describe('plain-text part and subject', () => {
    const senders = [
      ['sendWelcomeEmail', () => emailService.sendWelcomeEmail('user@example.com', 'en')],
      ['sendPasswordResetEmail', () => emailService.sendPasswordResetEmail('user@example.com', 'https://sitemechanic.io/reset-password?token=abc123', 'en')],
      ['sendTestEmail', () => emailService.sendTestEmail('user@example.com')],
      ['sendReportPurchaseEmail (no pdf)', () => emailService.sendReportPurchaseEmail({
        toEmail: 'buyer@example.com',
        reportId: 'rep_123',
        siteUrl: 'https://example.com',
        analyzerType: 'seo',
        locale: 'en'
      })],
      ['sendReportPurchaseEmail (with pdf)', () => emailService.sendReportPurchaseEmail({
        toEmail: 'buyer@example.com',
        reportId: 'rep_456',
        siteUrl: 'https://example.com',
        analyzerType: 'performance',
        locale: 'en',
        pdfBuffer: Buffer.from('%PDF-1.4 fake')
      })]
    ];

    test.each(senders)('%s produces a non-empty text part and a subject', async (_name, send) => {
      await send();
      const mail = lastMail();

      expect(typeof mail.text).toBe('string');
      expect(mail.text.trim().length).toBeGreaterThan(0);

      expect(typeof mail.subject).toBe('string');
      expect(mail.subject.trim().length).toBeGreaterThan(0);

      expect(mail.to).toBeTruthy();
      expect(mail.from).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Locale handling
  // -------------------------------------------------------------------------
  describe('locale handling', () => {
    it('uses Spanish strings from es.json when locale is "es" (password reset)', async () => {
      await emailService.sendPasswordResetEmail('user@example.com', 'https://sitemechanic.io/reset?token=x', 'es');
      const mail = lastMail();
      // es.json: email.passwordReset.heading = "Restablecer tu contraseña"
      expect(mail.html).toContain('Restablecer');
      expect(mail.subject).toContain('Restablecer');
    });

    it('uses Spanish strings from es.json when locale is "es" (welcome)', async () => {
      await emailService.sendWelcomeEmail('user@example.com', 'es');
      const mail = lastMail();
      // es.json: email.welcome.heading = "Bienvenido a Site Mechanic"
      expect(mail.html).toContain('Bienvenido');
    });

    it('falls back to English without throwing for an unknown locale', async () => {
      await expect(
        emailService.sendWelcomeEmail('user@example.com', 'xx')
      ).resolves.toBeDefined();

      const mail = lastMail();
      expect(typeof mail.subject).toBe('string');
      expect(mail.subject.trim().length).toBeGreaterThan(0);
      expect(mail.text.trim().length).toBeGreaterThan(0);
      // Should not contain unresolved template placeholders
      expect(mail.html).not.toContain('{{');
    });

    it('falls back to English without throwing for an unknown locale (purchase email)', async () => {
      await expect(
        emailService.sendReportPurchaseEmail({
          toEmail: 'buyer@example.com',
          reportId: 'rep_789',
          siteUrl: 'https://example.com',
          analyzerType: 'seo',
          locale: 'zz-ZZ'
        })
      ).resolves.toBeDefined();

      const mail = lastMail();
      expect(mail.subject.trim().length).toBeGreaterThan(0);
      expect(mail.html).not.toContain('{{');
    });

    it('defaults to English when locale is omitted', async () => {
      await expect(
        emailService.sendPasswordResetEmail('user@example.com', 'https://sitemechanic.io/reset?token=x')
      ).resolves.toBeDefined();
      const mail = lastMail();
      expect(mail.subject.trim().length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. HTML safety — user-influenced values must not inject markup
  // -------------------------------------------------------------------------
  describe('HTML safety (escaping of user-influenced values)', () => {
    const XSS = '<script>alert(1)</script>';

    it('siteUrl containing <script> does not appear unescaped in purchase email html', async () => {
      await emailService.sendReportPurchaseEmail({
        toEmail: 'buyer@example.com',
        reportId: 'rep_xss',
        siteUrl: `https://evil.example/${XSS}`,
        analyzerType: 'seo',
        locale: 'en'
      });

      const mail = lastMail();
      expect(mail.html).not.toContain('<script>');
      expect(mail.html).not.toContain('</script>');
    });

    it('toEmail containing <script> does not appear unescaped in welcome email html', async () => {
      await emailService.sendWelcomeEmail(`${XSS}@example.com`, 'en');
      const mail = lastMail();
      expect(mail.html).not.toContain('<script>');
    });

    it('toEmail containing <script> does not appear unescaped in test email html', async () => {
      await emailService.sendTestEmail(`${XSS}@example.com`);
      const mail = lastMail();
      expect(mail.html).not.toContain('<script>');
    });

    it('AI content containing <script> is escaped in purchase email html', async () => {
      await emailService.sendReportPurchaseEmail({
        toEmail: 'buyer@example.com',
        reportId: 'rep_ai',
        siteUrl: 'https://example.com',
        analyzerType: 'seo',
        locale: 'en',
        aiData: {
          strategic: {
            assessment: `Assessment ${XSS} text`,
            quickWins: [`Quick win ${XSS}`]
          }
        }
      });

      const mail = lastMail();
      expect(mail.html).not.toContain('<script>');
      // Escaped form should be present where AI content was rendered
      expect(mail.html).toContain('&lt;script&gt;');
    });
  });

  // -------------------------------------------------------------------------
  // verifyConnection
  // -------------------------------------------------------------------------
  describe('verifyConnection', () => {
    it('returns true when transporter.verify resolves', async () => {
      mockVerify.mockResolvedValueOnce(true);
      await expect(emailService.verifyConnection()).resolves.toBe(true);
      expect(mockVerify).toHaveBeenCalled();
    });

    it('returns false when transporter.verify rejects (no throw)', async () => {
      mockVerify.mockRejectedValueOnce(new Error('SMTP down'));
      await expect(emailService.verifyConnection()).resolves.toBe(false);
    });
  });
});
