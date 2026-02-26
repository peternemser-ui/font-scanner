/**
 * Abuse / DoS Filter
 *
 * A lightweight, in-memory filter that runs BEFORE any other middleware.
 * It enforces two hard limits that cannot be bypassed by any user tier:
 *
 * 1. Burst limit  — max N requests in a short window (e.g. 50 in 2 seconds)
 *    Catches automated scripts, accidental request loops, and simple DoS.
 *
 * 2. Sustained limit — max N requests in a longer window (e.g. 1000 in 1 minute)
 *    Catches slower but sustained abuse patterns.
 *
 * When an IP exceeds either threshold it is temporarily blocked and receives
 * a 429 with a Retry-After header. Blocked IPs are auto-released after the
 * block duration expires.
 *
 * No database, no Redis — pure in-memory for minimum latency.
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('AbuseFilter');

// ─── Configuration ───────────────────────────────────────────────────────────

const BURST_WINDOW_MS   = parseInt(process.env.ABUSE_BURST_WINDOW_MS   || '2000', 10);   // 2 seconds
const BURST_MAX         = parseInt(process.env.ABUSE_BURST_MAX         || '50',   10);    // 50 requests
const SUSTAINED_WINDOW_MS = parseInt(process.env.ABUSE_SUSTAINED_WINDOW_MS || '60000', 10); // 1 minute
const SUSTAINED_MAX     = parseInt(process.env.ABUSE_SUSTAINED_MAX     || '600',  10);    // 600 requests
const BLOCK_DURATION_MS = parseInt(process.env.ABUSE_BLOCK_DURATION_MS || '60000', 10);   // 1 minute block

// IPs that are never blocked (e.g. monitoring, load balancers)
const ALLOWLIST = new Set(
  (process.env.ABUSE_ALLOWLIST || '127.0.0.1,::1,::ffff:127.0.0.1').split(',').map(s => s.trim()).filter(Boolean)
);

// ─── State ───────────────────────────────────────────────────────────────────

/** @type {Map<string, number[]>} IP -> array of request timestamps */
const ipHits = new Map();

/** @type {Map<string, number>} IP -> unblock-at timestamp */
const blocked = new Map();

// Periodic cleanup every 30 seconds to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const cutoff = now - SUSTAINED_WINDOW_MS;

  for (const [ip, timestamps] of ipHits.entries()) {
    // Remove old timestamps
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
    if (timestamps.length === 0) ipHits.delete(ip);
  }

  // Remove expired blocks
  for (const [ip, unblockAt] of blocked.entries()) {
    if (unblockAt <= now) blocked.delete(ip);
  }
}, 30_000);

// ─── Middleware ───────────────────────────────────────────────────────────────

function abuseFilter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // Allow-listed IPs bypass the filter
  if (ALLOWLIST.has(ip)) return next();

  const now = Date.now();

  // Check if currently blocked
  const unblockAt = blocked.get(ip);
  if (unblockAt && unblockAt > now) {
    const retryAfter = Math.ceil((unblockAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Your IP has been temporarily blocked due to excessive requests. Please wait before retrying.',
      retryAfter,
      blocked: true,
    });
  }

  // Remove expired block
  if (unblockAt) blocked.delete(ip);

  // Record this hit
  if (!ipHits.has(ip)) ipHits.set(ip, []);
  const timestamps = ipHits.get(ip);
  timestamps.push(now);

  // Trim timestamps older than the sustained window
  const sustainedCutoff = now - SUSTAINED_WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0] < sustainedCutoff) {
    timestamps.shift();
  }

  // Check burst (recent timestamps within burst window)
  const burstCutoff = now - BURST_WINDOW_MS;
  let burstCount = 0;
  for (let i = timestamps.length - 1; i >= 0; i--) {
    if (timestamps[i] >= burstCutoff) burstCount++;
    else break;
  }

  const sustainedCount = timestamps.length;

  if (burstCount > BURST_MAX || sustainedCount > SUSTAINED_MAX) {
    const reason = burstCount > BURST_MAX ? 'burst' : 'sustained';
    const blockUntil = now + BLOCK_DURATION_MS;
    blocked.set(ip, blockUntil);

    logger.warn('IP blocked by abuse filter', {
      ip,
      reason,
      burstCount,
      sustainedCount,
      blockDurationMs: BLOCK_DURATION_MS,
      path: req.path,
    });

    const retryAfter = Math.ceil(BLOCK_DURATION_MS / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Your IP has been temporarily blocked due to excessive requests. Please wait before retrying.',
      retryAfter,
      blocked: true,
    });
  }

  next();
}

// ─── Admin helpers ───────────────────────────────────────────────────────────

function getAbuseFilterStats() {
  return {
    config: {
      burstWindow: `${BURST_WINDOW_MS}ms`,
      burstMax: BURST_MAX,
      sustainedWindow: `${SUSTAINED_WINDOW_MS}ms`,
      sustainedMax: SUSTAINED_MAX,
      blockDuration: `${BLOCK_DURATION_MS}ms`,
    },
    activeIPs: ipHits.size,
    blockedIPs: blocked.size,
    blockedList: Array.from(blocked.entries()).map(([ip, until]) => ({
      ip,
      unblockAt: new Date(until).toISOString(),
    })),
  };
}

module.exports = { abuseFilter, getAbuseFilterStats };
