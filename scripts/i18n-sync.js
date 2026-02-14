#!/usr/bin/env node
/**
 * i18n Sync Script
 * Extracts translation keys from source code and syncs them to all locale files.
 *
 * Usage:
 *   node scripts/i18n-sync.js              # Extract keys, update en.json, backfill locales
 *   node scripts/i18n-sync.js --check      # Dry-run: report what would change
 *   node scripts/i18n-sync.js --en-only    # Only update en.json (don't backfill locales)
 */

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'src', 'public', 'i18n');
const PUBLIC_DIR = path.join(__dirname, '..', 'src', 'public');
const ALL_LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh', 'ru'];
const NON_EN_LOCALES = ALL_LOCALES.filter(l => l !== 'en');

const dryRun = process.argv.includes('--check');
const enOnly = process.argv.includes('--en-only');

// Technical terms that should remain in English
const TECHNICAL_TERMS = new Set([
  'HTTPS', 'HTTP', 'SSL', 'TLS', 'DNS', 'CDN', 'HSTS', 'CSP', 'CORS',
  'ARIA', 'WCAG', 'LCP', 'FCP', 'CLS', 'INP', 'TBT', 'FID', 'TTFB',
  'WOFF', 'WOFF2', 'TTF', 'OTF', 'PDF', 'CSV', 'JSON', 'XML',
  'DOM', 'JavaScript', 'CSS', 'HTML', 'SEO', 'CRO', 'NAP',
  'Robots.txt', 'sitemap.xml', 'Open Graph', 'Twitter Cards',
  'HttpOnly', 'SameSite', 'Secure', 'nofollow',
  'iPhone', 'Galaxy', 'Pixel', 'iPad',
  'Lighthouse', 'Google Fonts', 'Adobe Fonts',
  'Schema.org', 'gzip', 'Brotli',
  'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F',
  'N/A', 'OK', 'Pro'
]);

// ── Utilities ──

function flattenKeys(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

function setNestedKey(obj, dotKey, value) {
  const parts = dotKey.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function getNestedKey(obj, dotKey) {
  const parts = dotKey.split('.');
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

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Error reading ${filePath}: ${e.message}`);
    return {};
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ── Extraction ──

/**
 * Extract t('key', 'fallback') calls from JS files.
 * Returns Map<key, fallbackString>
 */
function extractFromJs(dir) {
  const extracted = new Map();

  // Match patterns like:
  //   t('key', 'fallback')
  //   t("key", "fallback")
  //   t('key', `fallback`)
  //   _t('key', 'fallback')
  //   window.reportI18n.t('key', 'fallback')
  //   window.i18n.t('key', 'fallback')
  const tCallRegex = /(?:window\.(?:reportI18n|i18n)\.)?_?t\s*\(\s*['"]([\w.]+)['"]\s*,\s*['"`]([^'"`]*?)['"`]/g;

  function scanDir(dirPath) {
    let entries;
    try {
      entries = fs.readdirSync(dirPath);
    } catch { return; }

    for (const file of entries) {
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
        // Reset lastIndex since we reuse the regex
        tCallRegex.lastIndex = 0;
        while ((match = tCallRegex.exec(content)) !== null) {
          const key = match[1];
          const fallback = match[2];
          // Only record if we don't already have this key, or the new fallback is longer
          if (!extracted.has(key) || fallback.length > extracted.get(key).length) {
            extracted.set(key, fallback);
          }
        }
      }
    }
  }

  scanDir(dir);
  return extracted;
}

/**
 * Extract data-i18n keys from HTML files.
 * Returns Set<key>
 */
function extractFromHtml(dir) {
  const keys = new Set();
  const regex = /data-i18n(?:-(?:placeholder|title|attr))?="([^"]+)"/g;

  function scanDir(dirPath) {
    let entries;
    try {
      entries = fs.readdirSync(dirPath);
    } catch { return; }

    for (const file of entries) {
      const filePath = path.join(dirPath, file);
      let stat;
      try { stat = fs.statSync(filePath); } catch { continue; }

      if (stat.isDirectory()) {
        if (!['node_modules', 'assets', 'lib', 'i18n'].includes(file)) {
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

// ── Main ──

function main() {
  console.log('i18n Sync Tool');
  console.log('==============');
  if (dryRun) console.log('(DRY RUN - no files will be modified)\n');

  // Step 1: Extract keys from source code
  console.log('Scanning JS files for t() calls...');
  const jsKeys = extractFromJs(PUBLIC_DIR);
  console.log(`  Found ${jsKeys.size} unique t() keys with fallback strings`);

  console.log('Scanning HTML files for data-i18n attributes...');
  const htmlKeys = extractFromHtml(PUBLIC_DIR);
  console.log(`  Found ${htmlKeys.size} unique data-i18n keys`);

  // Step 2: Load en.json
  const enPath = path.join(I18N_DIR, 'en.json');
  const enData = readJson(enPath);
  const enFlat = flattenKeys(enData);

  // Step 3: Find keys missing from en.json and add them
  let enAdded = 0;
  for (const [key, fallback] of jsKeys) {
    if (!(key in enFlat) && fallback) {
      setNestedKey(enData, key, fallback);
      enFlat[key] = fallback;
      enAdded++;
    }
  }

  // For HTML keys, we can't extract fallback text easily, so just log missing ones
  let htmlMissing = 0;
  for (const key of htmlKeys) {
    if (!(key in enFlat)) {
      htmlMissing++;
      if (htmlMissing <= 10) {
        console.log(`  WARNING: HTML key "${key}" not in en.json and no fallback available`);
      }
    }
  }
  if (htmlMissing > 10) {
    console.log(`  ... and ${htmlMissing - 10} more HTML-only keys missing from en.json`);
  }

  console.log(`\nen.json: ${enAdded} new keys to add (${Object.keys(enFlat).length} total)`);

  if (!dryRun && enAdded > 0) {
    writeJson(enPath, enData);
    console.log(`  Written to ${enPath}`);
  }

  if (enOnly) {
    console.log('\n--en-only mode: skipping locale backfill');
    return;
  }

  // Step 4: Report missing keys per locale (no backfill - use translation scripts instead)
  console.log('\nMissing keys per locale:');
  const updatedEnFlat = flattenKeys(enData);

  for (const locale of NON_EN_LOCALES) {
    const localePath = path.join(I18N_DIR, `${locale}.json`);
    if (!fs.existsSync(localePath)) {
      console.log(`  Skipping ${locale} (file not found)`);
      continue;
    }

    const localeData = readJson(localePath);
    const localeFlat = flattenKeys(localeData);
    let missing = 0;

    for (const key of Object.keys(updatedEnFlat)) {
      if (!(key in localeFlat)) {
        missing++;
      }
    }

    console.log(`  ${locale}: ${missing} keys missing`);
  }

  // Step 5: Summary report
  console.log('\n── Summary ──');
  console.log(`Keys extracted from JS:   ${jsKeys.size}`);
  console.log(`Keys extracted from HTML:  ${htmlKeys.size}`);
  console.log(`New keys added to en.json: ${enAdded}`);
  if (htmlMissing > 0) {
    console.log(`HTML keys missing from en: ${htmlMissing} (need manual review)`);
  }

  if (dryRun) {
    console.log('\nRun without --check to apply changes to en.json.');
  } else {
    console.log('\nSync complete! en.json is now the source of truth.');
    console.log('Use translation scripts (scripts/i18n-add-*.js) to add locale translations.');
    console.log('Run "node scripts/i18n-audit.js" to check translation coverage.');
  }
}

main();
