/**
 * Fix locale files where arrays were incorrectly stored as objects with numeric keys.
 * e.g., "steps": {"0": "...", "1": "...", "2": "..."} → "steps": ["...", "...", "..."]
 *
 * This affects security fix steps and ipReputation technicalDetails in fr/de/pt/zh.
 */
const fs = require('fs');
const path = require('path');

const i18nDir = path.join(__dirname, '..', 'src', 'public', 'i18n');
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8'));

/**
 * Check if an object looks like it should be an array (has sequential numeric keys starting from 0)
 */
function isNumericKeyObject(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  // Check if all keys are sequential numbers starting from 0
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== String(i)) return false;
  }
  // Only convert if each value is a string (leaf array)
  return keys.every(k => typeof obj[k] === 'string');
}

/**
 * Convert numeric-key objects to arrays where the reference (en.json) has arrays
 */
function fixArrays(localeObj, refObj, pathStr) {
  let fixes = 0;
  if (typeof refObj !== 'object' || refObj === null) return fixes;

  for (const key of Object.keys(refObj)) {
    if (!(key in localeObj)) continue;

    const refVal = refObj[key];
    const locVal = localeObj[key];

    if (Array.isArray(refVal) && isNumericKeyObject(locVal)) {
      // Convert object to array
      const arr = [];
      const numKeys = Object.keys(locVal).sort((a, b) => Number(a) - Number(b));
      for (const nk of numKeys) {
        arr.push(locVal[nk]);
      }
      localeObj[key] = arr;
      fixes++;
      console.log(`  Fixed: ${pathStr}.${key} (${arr.length} items)`);
    } else if (typeof refVal === 'object' && !Array.isArray(refVal) && typeof locVal === 'object' && !Array.isArray(locVal)) {
      fixes += fixArrays(locVal, refVal, `${pathStr}.${key}`);
    }
  }
  return fixes;
}

const locales = ['fr', 'de', 'pt', 'zh'];

for (const locale of locales) {
  const filePath = path.join(i18nDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  console.log(`\n=== ${locale}.json ===`);
  const fixes = fixArrays(data, en, 'root');

  if (fixes > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`  Total fixes: ${fixes}`);
  } else {
    console.log('  No fixes needed');
  }
}
