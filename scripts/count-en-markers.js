const fs = require('fs');
const path = require('path');

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
const filePath = path.join(__dirname, '..', 'src', 'public', 'i18n', `${locale}.json`);
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const flattened = flat(data);

const enMarkers = Object.entries(flattened).filter(
  ([k, v]) => typeof v === 'string' && v.startsWith('[EN] ')
);

console.log(`Total [EN] keys in ${locale}.json: ${enMarkers.length}`);

const byNs = {};
enMarkers.forEach(([k]) => {
  const ns = k.split('.').slice(0, 2).join('.');
  byNs[ns] = (byNs[ns] || 0) + 1;
});

Object.entries(byNs)
  .sort((a, b) => b[1] - a[1])
  .forEach(([ns, count]) => console.log(`  ${ns}: ${count}`));
