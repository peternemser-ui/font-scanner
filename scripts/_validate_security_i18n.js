const fs = require('fs');
const path = require('path');

const locales = ['ja','es','fr','de','pt','zh','ru'];
const keys = [
  // Cookie issues (from earlier round)
  'reports.security.cookieIssues.weakSameSite',
  'reports.security.cookieIssues.noneSecured',
  'reports.security.cookieIssues.vulnerableXss',
  'reports.security.cookieIssues.transmittedHttp',
  // Vuln titles
  'reports.security.vulnTitles.mixedContent',
  'reports.security.vulnTitles.excessiveInlineScripts',
  'reports.security.vulnTitles.insecureFormSubmission',
  'reports.security.vulnTitles.passwordFieldConfig',
  'reports.security.vulnTitles.unsandboxedIframes',
  // Vuln solutions
  'reports.security.vulnSolutions.updateHttps',
  'reports.security.vulnSolutions.moveScripts',
  'reports.security.vulnSolutions.updateForms',
  'reports.security.vulnSolutions.addAutocomplete',
  'reports.security.vulnSolutions.addSandbox',
  // SSL issues
  'reports.security.sslIssues.expiresInDays',
  'reports.security.sslIssues.expiringCritical',
  'reports.security.sslIssues.outdatedTls',
  'reports.security.sslIssues.noHttps',
  'reports.security.sslIssues.analysisFailed',
  // Rec descriptions (new)
  'reports.security.recDescriptions.noHttps',
  'reports.security.recDescriptions.noCsp',
  'reports.security.recDescriptions.noHsts',
  'reports.security.recDescriptions.noXFrameOptions',
  'reports.security.recDescriptions.noXContentType',
  'reports.security.recDescriptions.cookiesNotSecured',
  'reports.security.recDescriptions.mixedContentCount',
  'reports.security.recDescriptions.inlineScriptsCount',
  'reports.security.recDescriptions.insecureFormsCount',
  'reports.security.recDescriptions.passwordFieldsCount',
  'reports.security.recDescriptions.unsandboxedIframesCount',
  'reports.security.recDescriptions.sriMissingCount',
  // Rec impacts (new)
  'reports.security.recImpacts.plainText',
  'reports.security.recImpacts.certIssues',
  'reports.security.recImpacts.xssRisk',
  'reports.security.recImpacts.downgradeAttack',
  'reports.security.recImpacts.clickjacking',
  'reports.security.recImpacts.mimeSniffing',
  'reports.security.recImpacts.criticalVuln',
  'reports.security.recImpacts.highVuln',
  'reports.security.recImpacts.cookieVuln',
  'reports.security.recImpacts.sriRisk',
  // Rec solutions (new)
  'reports.security.recSolutions.installSsl',
  'reports.security.recSolutions.upgradeTls',
  'reports.security.recSolutions.addCsp',
  'reports.security.recSolutions.addHsts',
  'reports.security.recSolutions.addXFrameOptions',
  'reports.security.recSolutions.addNosniff',
  'reports.security.recSolutions.secureCookies',
  'reports.security.recSolutions.addSri'
];

locales.forEach(locale => {
  try {
    const filePath = path.join(__dirname, '..', 'src', 'public', 'i18n', locale + '.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const missing = [];
    keys.forEach(k => {
      const parts = k.split('.');
      let v = data;
      for (const p of parts) { v = v && v[p]; }
      if (!v) missing.push(k);
    });
    if (missing.length === 0) {
      console.log(locale + ': ALL ' + keys.length + ' KEYS PRESENT');
    } else {
      console.log(locale + ': MISSING ' + missing.length + '/' + keys.length + ':');
      missing.forEach(k => console.log('  - ' + k));
    }
  } catch (e) {
    console.log(locale + ': JSON ERROR: ' + e.message);
  }
});
