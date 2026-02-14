#!/usr/bin/env node
/**
 * i18n Audit Script
 * Checks translation coverage across all supported locales
 *
 * Usage: node scripts/i18n-audit.js
 *        node scripts/i18n-audit.js --json    (machine-readable output)
 *        npm run i18n:audit
 */

const fs = require('fs');
const path = require('path');

const LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh', 'ru'];
const I18N_DIR = path.join(__dirname, '..', 'src', 'public', 'i18n');
const PUBLIC_DIR = path.join(__dirname, '..', 'src', 'public');
const jsonMode = process.argv.includes('--json');

// Technical terms that are expected to remain in English
const TECHNICAL_TERMS = new Set([
  'HTTPS', 'HTTP', 'SSL', 'TLS', 'DNS', 'CDN', 'HSTS', 'CSP', 'CORS',
  'ARIA', 'WCAG', 'LCP', 'FCP', 'CLS', 'INP', 'TBT', 'FID', 'TTFB',
  'WOFF', 'WOFF2', 'TTF', 'OTF', 'PDF', 'CSV', 'JSON', 'XML',
  'DOM', 'JavaScript', 'CSS', 'HTML', 'SEO', 'CRO', 'NAP',
  'Robots.txt', 'Open Graph', 'Twitter Cards',
  'HttpOnly', 'SameSite', 'Secure', 'nofollow',
  'iPhone', 'Galaxy', 'Pixel', 'iPad',
  'Lighthouse', 'Google Fonts', 'Adobe Fonts',
  'Schema.org', 'gzip', 'Brotli',
  'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F',
  'N/A', 'OK', 'Pro', 'KB', 'MB', 'URL', 'CDN', 'VPS'
]);

/**
 * Flatten nested object to { 'dot.key': value } map
 */
function flattenToMap(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenToMap(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

/**
 * Load all translation files
 */
function loadTranslations() {
  const translations = {};
  for (const locale of LOCALES) {
    const filePath = path.join(I18N_DIR, `${locale}.json`);
    if (fs.existsSync(filePath)) {
      try {
        translations[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        if (!jsonMode) console.error(`Error parsing ${locale}.json:`, e.message);
        translations[locale] = {};
      }
    } else {
      if (!jsonMode) console.warn(`Missing translation file: ${locale}.json`);
      translations[locale] = {};
    }
  }
  return translations;
}

/**
 * Find data-i18n attributes in HTML files
 */
function findI18nKeysInHtml(dir) {
  const keys = new Set();
  const regex = /data-i18n(?:-(?:placeholder|title|attr))?="([^"]+)"/g;

  function scanDir(dirPath) {
    let files;
    try { files = fs.readdirSync(dirPath); } catch { return; }
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      let stat;
      try { stat = fs.statSync(filePath); } catch { continue; }

      if (stat.isDirectory()) {
        if (!['node_modules', 'assets', 'lib'].includes(file)) {
          scanDir(filePath);
        }
      } else if (file.endsWith('.html')) {
        const content = fs.readFileSync(filePath, 'utf8');
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(content)) !== null) {
          keys.add(match[1]);
        }
      }
    }
  }

  scanDir(dir);
  return keys;
}

/**
 * Find t() calls in JavaScript files
 */
function findI18nKeysInJs(dir) {
  const keys = new Set();
  const regex = /(?:window\.)?i18n\.t\s*\(\s*['"]([^'"]+)['"]/g;
  const tFuncRegex = /\bt\s*\(\s*['"]([^'"]+)['"]/g;

  function scanDir(dirPath) {
    let files;
    try { files = fs.readdirSync(dirPath); } catch { return; }
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      let stat;
      try { stat = fs.statSync(filePath); } catch { continue; }

      if (stat.isDirectory()) {
        if (!['node_modules', 'assets', 'lib', 'i18n'].includes(file)) {
          scanDir(filePath);
        }
      } else if (file.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf8');
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(content)) !== null) {
          keys.add(match[1]);
        }
        tFuncRegex.lastIndex = 0;
        while ((match = tFuncRegex.exec(content)) !== null) {
          keys.add(match[1]);
        }
      }
    }
  }

  scanDir(dir);
  return keys;
}

/**
 * Check if a key exists in nested object
 */
function getNestedValue(obj, key) {
  const parts = key.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Main audit function
 */
function audit() {
  const translations = loadTranslations();
  const enFlat = flattenToMap(translations['en'] || {});

  // Flatten all locales
  const flatByLocale = {};
  for (const locale of LOCALES) {
    flatByLocale[locale] = flattenToMap(translations[locale] || {});
  }

  // Find keys used in code
  const htmlKeys = findI18nKeysInHtml(PUBLIC_DIR);
  const jsKeys = findI18nKeysInJs(PUBLIC_DIR);
  const usedKeys = new Set([...htmlKeys, ...jsKeys]);

  // Results per locale
  const results = {};

  for (const locale of LOCALES) {
    const localeFlat = flatByLocale[locale];
    const missing = [];
    const untranslated = [];

    // Check keys present in en.json
    for (const [key, enValue] of Object.entries(enFlat)) {
      if (!(key in localeFlat)) {
        missing.push(key);
      } else if (locale !== 'en') {
        // Check if value is identical to English (untranslated)
        const localeValue = localeFlat[key];
        if (
          typeof localeValue === 'string' &&
          typeof enValue === 'string' &&
          localeValue === enValue &&
          enValue.length > 5 &&
          !TECHNICAL_TERMS.has(enValue.trim())
        ) {
          untranslated.push(key);
        }
        // Check for [EN] prefix markers
        if (typeof localeValue === 'string' && localeValue.startsWith('[EN] ')) {
          untranslated.push(key);
        }
      }
    }

    results[locale] = {
      totalKeys: Object.keys(localeFlat).length,
      missingFromEn: missing.length,
      untranslated: locale === 'en' ? 0 : untranslated.length,
      missing: missing.slice(0, 20),
      untranslatedSample: untranslated.slice(0, 10)
    };
  }

  if (jsonMode) {
    const output = {
      locales: LOCALES,
      keysInEn: Object.keys(enFlat).length,
      usedInCode: usedKeys.size,
      results
    };
    console.log(JSON.stringify(output, null, 2));
    const hasIssues = LOCALES.some(l => results[l].missingFromEn > 0 || results[l].untranslated > 0);
    process.exit(hasIssues ? 1 : 0);
    return;
  }

  // Human-readable output
  console.log('='.repeat(60));
  console.log('i18n Audit Report');
  console.log('='.repeat(60));
  console.log(`Locales checked: ${LOCALES.join(', ')}`);
  console.log(`Keys in en.json: ${Object.keys(enFlat).length}`);
  console.log(`Keys used in code: ${usedKeys.size}`);
  console.log('');

  for (const locale of LOCALES) {
    const r = results[locale];
    console.log(`${locale}: ${r.totalKeys} keys`);
  }
  console.log('');

  // Missing keys report
  console.log('-'.repeat(60));
  console.log('Missing Keys (present in en.json, absent in locale):');
  console.log('-'.repeat(60));

  for (const locale of LOCALES.filter(l => l !== 'en')) {
    const r = results[locale];
    if (r.missingFromEn > 0) {
      console.log(`\n${locale.toUpperCase()}: ${r.missingFromEn} missing from en.json`);
      r.missing.forEach(key => console.log(`  - ${key}`));
      if (r.missingFromEn > 20) console.log(`  ... and ${r.missingFromEn - 20} more`);
    } else {
      console.log(`\n${locale.toUpperCase()}: All en.json keys present!`);
    }
  }

  // Untranslated values report
  console.log('\n' + '-'.repeat(60));
  console.log('Untranslated Values (identical to English or [EN] marked):');
  console.log('-'.repeat(60));

  for (const locale of LOCALES.filter(l => l !== 'en')) {
    const r = results[locale];
    if (r.untranslated > 0) {
      console.log(`\n${locale.toUpperCase()}: ${r.untranslated} untranslated values`);
      r.untranslatedSample.forEach(key => console.log(`  - ${key}`));
      if (r.untranslated > 10) console.log(`  ... and ${r.untranslated - 10} more`);
    } else {
      console.log(`\n${locale.toUpperCase()}: All values translated!`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log('='.repeat(60));

  let hasIssues = false;
  for (const locale of LOCALES) {
    const r = results[locale];
    const enTotal = Object.keys(enFlat).length;
    const present = enTotal - r.missingFromEn;
    const translated = locale === 'en' ? present : present - r.untranslated;
    const coverage = enTotal > 0 ? ((translated / enTotal) * 100).toFixed(1) : 0;
    const status = r.missingFromEn === 0 && r.untranslated === 0 ? 'OK' : 'NEEDS WORK';
    console.log(`${locale}: ${r.totalKeys} keys, ${r.missingFromEn} missing, ${r.untranslated} untranslated (${coverage}% translated) [${status}]`);
    if (r.missingFromEn > 0 || r.untranslated > 0) hasIssues = true;
  }

  console.log('');
  if (hasIssues) {
    console.log('Run "node scripts/i18n-sync.js" to add missing keys.');
    process.exit(1);
  } else {
    console.log('All translations are complete!');
    process.exit(0);
  }
}

audit();
