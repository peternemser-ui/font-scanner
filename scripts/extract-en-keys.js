#!/usr/bin/env node
/**
 * Extract English keys by namespace for translation work
 */
const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '..', 'src', 'public', 'i18n', 'en.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function flat(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flat(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

const locale = process.argv[2] || 'ja';
const localePath = path.join(__dirname, '..', 'src', 'public', 'i18n', `${locale}.json`);
const localeData = fs.existsSync(localePath) ? JSON.parse(fs.readFileSync(localePath, 'utf8')) : {};
const localeFlat = flat(localeData);

const enFlat = flat(en);
const ns = process.argv[3];

const missing = Object.entries(enFlat)
  .filter(([k]) => !ns || k.startsWith(ns))
  .filter(([k]) => !(k in localeFlat))
  .sort(([a], [b]) => a.localeCompare(b));

console.log(`Missing keys in ${locale}.json${ns ? ` (${ns}*)` : ''}: ${missing.length}`);
missing.forEach(([k, v]) => console.log(`${k} = ${v}`));
