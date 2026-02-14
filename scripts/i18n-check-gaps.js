/**
 * Quick check: list missing keys in all locale files vs en.json
 */
const fs = require('fs');
const path = require('path');

const i18nDir = path.join(__dirname, '..', 'src', 'public', 'i18n');
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8'));

function flattenKeys(obj, prefix) {
  prefix = prefix || '';
  let keys = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? prefix + '.' + k : k;
    if (Array.isArray(obj[k])) {
      // Treat arrays as leaf values (they are translation arrays like steps)
      keys.push(fullKey);
    } else if (typeof obj[k] === 'object' && obj[k] !== null) {
      keys = keys.concat(flattenKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getNestedValue(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

const enKeys = flattenKeys(en);
const locales = ['ja', 'es', 'fr', 'de', 'pt', 'zh', 'ru'];

for (const locale of locales) {
  const localeData = JSON.parse(fs.readFileSync(path.join(i18nDir, `${locale}.json`), 'utf8'));
  const localeKeys = new Set(flattenKeys(localeData));
  const missing = enKeys.filter(k => !localeKeys.has(k));

  // Group by namespace
  const groups = {};
  missing.forEach(k => {
    const parts = k.split('.');
    let ns = parts[0];
    if (parts[0] === 'reports' && parts.length > 1) ns = 'reports.' + parts[1];
    if (!groups[ns]) groups[ns] = [];
    groups[ns].push(k);
  });

  console.log(`\n=== ${locale}.json: ${missing.length} missing keys ===`);
  Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length).forEach(ns => {
    console.log(`  ${ns}: ${groups[ns].length}`);
  });
}

// Also output the full missing key list for fr (debugging)
const fr = JSON.parse(fs.readFileSync(path.join(i18nDir, 'fr.json'), 'utf8'));
const frKeys = new Set(flattenKeys(fr));
const missingFr = enKeys.filter(k => !frKeys.has(k));
console.log('\n\nFull missing key list (fr):');
missingFr.forEach(k => {
  const val = getNestedValue(en, k);
  const short = typeof val === 'string' && val.length > 80 ? val.substring(0, 80) + '...' : val;
  console.log(`  ${k} = ${JSON.stringify(short)}`);
});
