/**
 * Report i18n Helper
 * Provides translation utilities for analyzer report scripts
 *
 * Usage in analyzer scripts:
 *   const t = window.reportI18n.t;
 *   html += `<h2>${t('reports.fonts.title', 'Fonts & Typography Report')}</h2>`;
 */
(function(window) {
  'use strict';

  /**
   * Get translated string with fallback
   * @param {string} key - Dot-notation key like 'reports.fonts.title'
   * @param {string} fallback - Fallback English string
   * @param {object} params - Optional interpolation params like {count: 5}
   * @returns {string} Translated string or fallback
   */
  function t(key, fallback, params = {}) {
    let value = fallback;

    // Try to get translation from global i18n
    if (window.i18n && typeof window.i18n.t === 'function') {
      const translated = window.i18n.t(key);
      // Only use translation if it's not the key itself (missing translation)
      if (translated !== key) {
        value = translated;
      }
    }

    // Handle interpolation for params like {count}, {url}, etc.
    if (params && typeof value === 'string') {
      Object.keys(params).forEach(param => {
        const regex = new RegExp(`\\{\\{?${param}\\}?\\}`, 'g');
        value = value.replace(regex, params[param]);
      });
    }

    return value;
  }

  /**
   * Get plural form based on count
   * @param {number} count - The count to pluralize
   * @param {string} singularKey - Key for singular form
   * @param {string} pluralKey - Key for plural form
   * @param {string} singularFallback - Fallback singular
   * @param {string} pluralFallback - Fallback plural
   * @returns {string} Appropriate form
   */
  function plural(count, singularKey, pluralKey, singularFallback, pluralFallback) {
    if (count === 1) {
      return t(singularKey, singularFallback);
    }
    return t(pluralKey, pluralFallback);
  }

  /**
   * Common report strings namespace
   * These are shared across multiple analyzers
   */
  const common = {
    pageScreenshot: () => t('reports.common.pageScreenshot', 'Page Screenshot'),
    screenshotUnavailable: () => t('reports.common.screenshotUnavailable', 'This site blocks automated screenshots'),
    exportShare: () => t('reports.common.exportShare', 'Export & Share'),
    downloadReports: () => t('reports.common.downloadReports', 'Download reports, export data, and share results.'),
    exportPdf: () => t('reports.common.exportPdf', 'Export PDF'),
    exportCsv: () => t('reports.common.exportCsv', 'Export CSV'),
    shareLink: () => t('reports.common.shareLink', 'Share Link'),
    clientReadyReport: () => t('reports.common.clientReadyReport', 'Client-ready report'),
    rawDataExport: () => t('reports.common.rawDataExport', 'Raw data export'),
    shareableUrl: () => t('reports.common.shareableUrl', 'Shareable URL'),
    unlockReport: () => t('reports.common.unlockReport', 'Unlock Report'),
    unlockReportSubtitle: () => t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.'),
    summary: () => t('reports.common.summary', 'Summary'),
    recommendations: () => t('reports.common.recommendations', 'Recommendations'),
    issuesFound: () => t('reports.common.issuesFound', 'Issues Found'),
    checksPassed: () => t('reports.common.checksPassed', 'Checks Passed'),
    reportRecommendations: () => t('reports.common.reportRecommendations', 'Recommendations'),
    fixCode: () => t('reports.common.fixCode', 'Recommendations'),
    takeAction: () => t('reports.common.takeAction', 'Take Action'),
    copy: () => t('reports.common.copy', 'Copy'),
    copied: () => t('reports.common.copied', 'Copied!'),

    // Tab labels
    tabSummary: () => t('reports.common.tabs.summary', 'Summary'),
    tabCode: () => t('reports.common.tabs.code', 'Code'),
    tabGuide: () => t('reports.common.tabs.guide', 'Guide'),

    // Priority/severity
    priorityHigh: () => t('reports.common.priority.high', 'High'),
    priorityMedium: () => t('reports.common.priority.medium', 'Medium'),
    priorityLow: () => t('reports.common.priority.low', 'Low'),
    priorityCritical: () => t('reports.common.priority.critical', 'Critical'),

    // Status
    statusExcellent: () => t('reports.common.status.excellent', 'Excellent'),
    statusGood: () => t('reports.common.status.good', 'Good'),
    statusFair: () => t('reports.common.status.fair', 'Fair'),
    statusPoor: () => t('reports.common.status.poor', 'Poor'),
    statusCritical: () => t('reports.common.status.critical', 'Critical'),

    // Fix guide
    currentIssue: () => t('reports.common.fix.currentIssue', 'Current Issue'),
    recommendedFix: () => t('reports.common.fix.recommendedFix', 'Recommended Fix'),
    stepByStepFix: () => t('reports.common.fix.stepByStepFix', 'Step-by-Step Fix:'),
    expectedImpact: () => t('reports.common.fix.expectedImpact', 'Expected Impact'),

    // Counts with plurals
    improvementsFound: (count) => t('reports.common.improvementsFound', '{{count}} improvements found', { count }),
    issuesDetected: (count) => t('reports.common.issuesDetected', '{{count}} issues detected', { count })
  };

  /**
   * Grades helper
   */
  const grades = {
    aPlus: () => t('grades.aPlus', 'A+'),
    a: () => t('grades.a', 'A'),
    aMinus: () => t('grades.aMinus', 'A-'),
    bPlus: () => t('grades.bPlus', 'B+'),
    b: () => t('grades.b', 'B'),
    bMinus: () => t('grades.bMinus', 'B-'),
    cPlus: () => t('grades.cPlus', 'C+'),
    c: () => t('grades.c', 'C'),
    cMinus: () => t('grades.cMinus', 'C-'),
    d: () => t('grades.d', 'D'),
    f: () => t('grades.f', 'F'),

    // Get grade name from score
    fromScore: (score) => {
      if (score >= 97) return grades.aPlus();
      if (score >= 93) return grades.a();
      if (score >= 90) return grades.aMinus();
      if (score >= 87) return grades.bPlus();
      if (score >= 83) return grades.b();
      if (score >= 80) return grades.bMinus();
      if (score >= 77) return grades.cPlus();
      if (score >= 73) return grades.c();
      if (score >= 70) return grades.cMinus();
      if (score >= 60) return grades.d();
      return grades.f();
    }
  };

  // Expose API
  window.reportI18n = {
    t,
    plural,
    common,
    grades
  };

  // Also expose t directly for convenience
  window.reportT = t;

})(window);
