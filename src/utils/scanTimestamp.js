/**
 * Scan timestamp helpers
 *
 * Determinism requirement:
 * - Prefer a backend-generated timestamp when available.
 * - If the client provides scanStartedAt, echo it back unchanged.
 */

function getRequestScanStartedAt(req) {
  if (!req || !req.body) return null;

  // Echo unchanged (do NOT parse/normalize)
  const candidate =
    req.body.scanStartedAt ??
    req.body.startedAt ??
    req.body.timestamp ??
    null;

  if (candidate === undefined || candidate === null || candidate === '') return null;
  return candidate;
}

function attachScanStartedAt(payload, startedAt) {
  if (!startedAt) return payload;
  if (!payload || typeof payload !== 'object') return payload;

  if (!Object.prototype.hasOwnProperty.call(payload, 'startedAt')) {
    payload.startedAt = startedAt;
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'timestamp')) {
    payload.timestamp = startedAt;
  }

  return payload;
}

/**
 * Attach startedAt/timestamp to both the wrapper and nested results, if present.
 */
function attachToResponse(responseBody, startedAt) {
  attachScanStartedAt(responseBody, startedAt);

  if (responseBody && typeof responseBody === 'object') {
    if (responseBody.results && typeof responseBody.results === 'object') {
      attachScanStartedAt(responseBody.results, startedAt);
    }
    if (responseBody.data && typeof responseBody.data === 'object') {
      attachScanStartedAt(responseBody.data, startedAt);
    }
  }

  return responseBody;
}

module.exports = {
  getRequestScanStartedAt,
  attachScanStartedAt,
  attachToResponse,
};
