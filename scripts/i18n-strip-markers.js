#!/usr/bin/env node
/**
 * Strip [EN] markers from locale files.
 * Removes keys with [EN] prefix so the t() fallback mechanism shows clean English.
 */
const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'src', 'public', 'i18n');
const NON_EN = ['es', 'fr', 'de', 'pt', 'ja', 'zh', 'ru'];

function stripMarkers(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const cleaned = stripMarkers(value);
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else if (typeof value === 'string' && value.startsWith('[EN] ')) {
      // Skip this key - remove it so t() fallback works
      continue;
    } else {
      result[key] = value;
    }
  }
  return result;
}

for (const locale of NON_EN) {
  const filePath = path.join(I18N_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) continue;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const cleaned = stripMarkers(data);
  fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2) + '\n', 'utf8');
  console.log(`Stripped [EN] markers from ${locale}.json`);
}
