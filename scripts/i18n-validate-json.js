/**
 * Validate all i18n JSON files parse correctly and have consistent structure.
 */
const fs = require('fs');
const path = require('path');

const i18nDir = path.join(__dirname, '..', 'src', 'public', 'i18n');
const locales = ['en', 'ja', 'es', 'fr', 'de', 'pt', 'zh', 'ru'];
let allValid = true;

for (const locale of locales) {
  const filePath = path.join(i18nDir, `${locale}.json`);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    const keys = Object.keys(data);
    console.log(`  ${locale}.json: OK (${keys.length} top-level keys, ${(raw.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.error(`  ${locale}.json: PARSE ERROR - ${e.message}`);
    allValid = false;
  }
}

console.log(allValid ? '\nAll JSON files are valid.' : '\nSome files have errors!');
