const { isSafeReportId, makeReportId } = require('./reportId');

function pickFirstString(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * Resolve a deterministic reportId.
 *
 * Prefer a provided reportId if it matches `isSafeReportId`.
 * Otherwise compute it using `makeReportId` if we have enough inputs.
 */
function resolveReportId({ reportId, analyzerKey, url, startedAtISO }) {
  if (isSafeReportId(reportId)) return reportId;

  const resolvedAnalyzerKey = pickFirstString(analyzerKey);
  const resolvedUrl = pickFirstString(url);
  const resolvedStartedAtISO = pickFirstString(startedAtISO);

  const computed = makeReportId({
    analyzerKey: resolvedAnalyzerKey,
    normalizedUrl: resolvedUrl,
    startedAtISO: resolvedStartedAtISO,
  });

  return isSafeReportId(computed) ? computed : '';
}

module.exports = {
  resolveReportId,
};
