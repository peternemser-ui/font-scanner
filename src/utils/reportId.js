const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const FNV_MOD_64 = 0xffffffffffffffffn;

function fnv1a64(input) {
  let hash = FNV_OFFSET_BASIS_64;
  const str = String(input || '');
  for (let i = 0; i < str.length; i += 1) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * FNV_PRIME_64) & FNV_MOD_64;
  }
  return hash;
}

function roundTimestampToMinute(startedAtISO) {
  const raw = (startedAtISO || '').trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  d.setSeconds(0, 0);
  return d.toISOString();
}

function normalizeUrlForReportId(inputUrl) {
  const raw = (inputUrl || '').trim();
  if (!raw) return '';

  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const u = new URL(withProto);

    const protocol = (u.protocol || 'https:').toLowerCase();
    const hostname = (u.hostname || '').toLowerCase();
    if (!hostname) return '';

    // Strip default ports (80 for http, 443 for https)
    let port = '';
    if (u.port) {
      const isDefaultPort = (protocol === 'https:' && u.port === '443') ||
                            (protocol === 'http:' && u.port === '80');
      if (!isDefaultPort) {
        port = `:${u.port}`;
      }
    }

    let path = u.pathname || '';

    // Remove trailing slash; represent root as empty path.
    if (path === '/') path = '';
    else path = path.replace(/\/$/, '');

    // Sort query parameters for consistent ordering
    let search = '';
    if (u.search) {
      const params = new URLSearchParams(u.search);
      const sorted = new URLSearchParams([...params.entries()].sort());
      const sortedSearch = sorted.toString();
      if (sortedSearch) {
        search = '?' + sortedSearch;
      }
    }
    // Drop hash fragments

    return `${protocol}//${hostname}${port}${path}${search}`;
  } catch (e) {
    // Best-effort fallback: trim + remove trailing slash
    return raw.replace(/\/$/, '');
  }
}

/**
 * Simple hash for storage keys (not cryptographic).
 * Returns a short alphanumeric string suitable for localStorage/sessionStorage keys.
 */
function hashForStorageKey(str) {
  let hash = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Shared deterministic report identity.
 *
 * reportId = hash(analyzerKey + normalizedUrl + timestampRounded)
 */
function makeReportId({ analyzerKey, normalizedUrl, startedAtISO }) {
  const key = (analyzerKey || '').trim();
  const url = normalizeUrlForReportId(normalizedUrl);
  const ts = roundTimestampToMinute(startedAtISO);

  if (!key || !url || !ts) return '';

  const raw = `${key}|${url}|${ts}`;
  const hex = fnv1a64(raw).toString(16).padStart(16, '0');
  return `r_${hex}`;
}

// Backward-compat alias (older callsites passed (url, startedAt, analyzerKey))
function computeReportId(url, startedAt, analyzerKey) {
  return makeReportId({ analyzerKey, normalizedUrl: url, startedAtISO: startedAt });
}

function isSafeReportId(reportId) {
  // Matches the r_<hex> form produced by makeReportId.
  return typeof reportId === 'string' && /^r_[a-f0-9]{16}$/i.test(reportId);
}

module.exports = {
  makeReportId,
  computeReportId,
  normalizeUrlForReportId,
  roundTimestampToMinute,
  isSafeReportId,
  hashForStorageKey,
};
