/**
 * Accessibility Fixes Renderer - Translation Layer
 * Maps hardcoded English fix titles/descriptions/impacts/solutions from the API
 * to i18n keys, following the pattern from performance-fixes-renderer.js
 */

/**
 * Get translated accessibility fix title
 */
function translateA11yFixTitle(englishTitle) {
  const titleMap = {
    'Multiple Color Contrast Issues': 'reports.accessibility.fixTitles.colorContrast',
    'Missing Focus Indicators': 'reports.accessibility.fixTitles.focusIndicators',
    'Missing Form Labels': 'reports.accessibility.fixTitles.formLabels',
    'Improper Heading Structure': 'reports.accessibility.fixTitles.headingStructure',
    'Missing ARIA Landmarks': 'reports.accessibility.fixTitles.ariaLandmarks',
    'Mobile Accessibility Gap': 'reports.accessibility.fixTitles.mobileGap'
  };

  const key = titleMap[englishTitle];
  if (key && typeof t === 'function') {
    return t(key, englishTitle);
  }
  return englishTitle;
}

/**
 * Get translated accessibility fix description
 */
function translateA11yFixDescription(englishTitle, englishDescription, params) {
  const descMap = {
    'Multiple Color Contrast Issues': 'reports.accessibility.fixDescriptions.colorContrast',
    'Missing Focus Indicators': 'reports.accessibility.fixDescriptions.focusIndicators',
    'Missing Form Labels': 'reports.accessibility.fixDescriptions.formLabels',
    'Improper Heading Structure': 'reports.accessibility.fixDescriptions.headingStructure',
    'Missing ARIA Landmarks': 'reports.accessibility.fixDescriptions.ariaLandmarks',
    'Mobile Accessibility Gap': 'reports.accessibility.fixDescriptions.mobileGap'
  };

  const key = descMap[englishTitle];
  if (key && typeof t === 'function') {
    return t(key, englishDescription, params || {});
  }
  return englishDescription;
}

/**
 * Get translated accessibility fix impact
 */
function translateA11yFixImpact(englishTitle, englishImpact) {
  const impactMap = {
    'Multiple Color Contrast Issues': 'reports.accessibility.fixImpacts.colorContrast',
    'Missing Focus Indicators': 'reports.accessibility.fixImpacts.focusIndicators',
    'Missing Form Labels': 'reports.accessibility.fixImpacts.formLabels',
    'Improper Heading Structure': 'reports.accessibility.fixImpacts.headingStructure',
    'Missing ARIA Landmarks': 'reports.accessibility.fixImpacts.ariaLandmarks',
    'Mobile Accessibility Gap': 'reports.accessibility.fixImpacts.mobileGap'
  };

  const key = impactMap[englishTitle];
  if (key && typeof t === 'function') {
    return t(key, englishImpact);
  }
  return englishImpact;
}

/**
 * Get translated accessibility fix solution
 */
function translateA11yFixSolution(englishTitle, englishSolution) {
  const solutionMap = {
    'Multiple Color Contrast Issues': 'reports.accessibility.fixSolutions.colorContrast',
    'Missing Focus Indicators': 'reports.accessibility.fixSolutions.focusIndicators',
    'Missing Form Labels': 'reports.accessibility.fixSolutions.formLabels',
    'Improper Heading Structure': 'reports.accessibility.fixSolutions.headingStructure',
    'Missing ARIA Landmarks': 'reports.accessibility.fixSolutions.ariaLandmarks',
    'Mobile Accessibility Gap': 'reports.accessibility.fixSolutions.mobileGap'
  };

  const key = solutionMap[englishTitle];
  if (key && typeof t === 'function') {
    return t(key, englishSolution);
  }
  return englishSolution;
}
