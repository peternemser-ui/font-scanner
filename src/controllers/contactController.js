const { asyncHandler, ValidationError } = require('../utils/errorHandler');
const { createLogger } = require('../utils/logger');
const { getDatabase } = require('../db');

const logger = createLogger('ContactController');

const MAX_NAME_LEN = 200;
const MAX_EMAIL_LEN = 320;
const MAX_URL_LEN = 2000;
const MAX_MESSAGE_LEN = 5000;

function isLikelyEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > MAX_EMAIL_LEN) return false;
  // Simple pragmatic check (avoid overly strict validation)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

const submitContact = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    message,
    url,
    // Honeypot (bots fill this)
    website,
  } = req.body || {};

  // If honeypot is filled, pretend success but do nothing.
  if (website) {
    return res.json({ success: true });
  }

  const cleanName = typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LEN) : '';
  const cleanEmail = typeof email === 'string' ? email.trim().slice(0, MAX_EMAIL_LEN) : '';
  const cleanMessage = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LEN) : '';
  const cleanUrl = typeof url === 'string' ? url.trim().slice(0, MAX_URL_LEN) : '';

  if (!isLikelyEmail(cleanEmail)) {
    throw new ValidationError('Please enter a valid email address.');
  }

  if (!cleanMessage || cleanMessage.length < 10) {
    throw new ValidationError('Message must be at least 10 characters.');
  }

  const db = getDatabase();

  const userAgent = req.get('user-agent') || '';
  const ipAddress = req.ip || req.socket?.remoteAddress || '';
  const requestId = req.id || '';

  const result = await db.run(
    `INSERT INTO contact_messages (name, email, message, url, user_agent, ip_address, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [cleanName, cleanEmail, cleanMessage, cleanUrl, userAgent, ipAddress, requestId]
  );

  logger.info('Contact message received', {
    requestId,
    hasName: !!cleanName,
    email: cleanEmail,
    hasUrl: !!cleanUrl,
  });

  res.json({
    success: true,
    id: result.lastID,
  });
});

module.exports = {
  submitContact,
};
