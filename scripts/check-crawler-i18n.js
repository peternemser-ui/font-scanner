const fs = require('fs');
const content = fs.readFileSync('src/public/site-crawler-script.js', 'utf8');
const regex = /t\('(reports\.crawler\.[^']+)',\s*'([^']+)'/g;
const keys = new Map();
let match;
while ((match = regex.exec(content)) !== null) {
  keys.set(match[1], match[2]);
}

const en = JSON.parse(fs.readFileSync('src/public/i18n/en.json', 'utf8'));

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o && o[k], obj);
}

const missing = [];
let existing = 0;
for (const [key, fallback] of keys) {
  const val = getNestedValue(en, key);
  if (val === undefined) {
    missing.push({ key, fallback });
  } else {
    existing++;
  }
}

console.log('Existing:', existing, 'Missing:', missing.length, 'Total:', keys.size);
console.log('\nMissing keys:');
missing.forEach(({ key, fallback }) => {
  console.log(`  "${key}": "${fallback}"`);
});
