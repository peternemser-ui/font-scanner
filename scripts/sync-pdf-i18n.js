const fs = require('fs');

// Deep merge - only adds missing keys, doesn't overwrite
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else if (!(key in target)) {
      target[key] = source[key];
    }
  }
  return target;
}

// Read en.json
const en = JSON.parse(fs.readFileSync('src/public/i18n/en.json', 'utf8'));

// Report sections under "reports.*"
const reportSections = [
  'security', 'accessibility', 'performance', 'fonts', 'tagIntelligence',
  'hosting', 'cwv', 'ipReputation', 'brokenLinks', 'localSeo',
  'gdpr', 'mobile', 'cro', 'siteCrawler', 'competitive'
];
// Report sections at top level (not under "reports")
const topLevelSections = ['brandConsistency'];
const locales = ['es', 'fr', 'de', 'pt', 'ja', 'zh', 'ru'];

for (const locale of locales) {
  const filePath = `src/public/i18n/${locale}.json`;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Sync report sections under "reports.*"
    if (data.reports) {
      for (const section of reportSections) {
        if (en.reports[section] && en.reports[section].report) {
          if (!data.reports[section]) {
            data.reports[section] = {};
          }
          if (!data.reports[section].report) {
            data.reports[section].report = {};
          }
          deepMerge(data.reports[section].report, en.reports[section].report);
        }
      }

      // Also add missing top-level keys in performance
      if (data.reports.performance && en.reports.performance) {
        if (!data.reports.performance.networkPerformance) {
          data.reports.performance.networkPerformance = en.reports.performance.networkPerformance;
        }
        if (!data.reports.performance.cachingOptimization) {
          data.reports.performance.cachingOptimization = en.reports.performance.cachingOptimization;
        }
      }
    }

    // Sync top-level report sections
    for (const section of topLevelSections) {
      if (en[section] && en[section].report) {
        if (!data[section]) {
          data[section] = {};
        }
        if (!data[section].report) {
          data[section].report = {};
        }
        deepMerge(data[section].report, en[section].report);
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`${locale}.json updated successfully`);
  } catch (e) {
    console.error(`Error processing ${locale}.json:`, e.message);
  }
}

console.log('Done!');
