/**
 * Translation Completeness Checker
 * Compares all language files against English to find missing keys
 */

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'src', 'public', 'i18n');
const LANGUAGES = ['es', 'fr', 'de', 'pt', 'zh', 'ja'];

// Load JSON file
function loadJSON(lang) {
  const filePath = path.join(I18N_DIR, `${lang}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error loading ${lang}.json:`, err.message);
    return null;
  }
}

// Get all keys from nested object
function getAllKeys(obj, prefix = '') {
  const keys = [];
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

// Main check
function checkTranslations() {
  console.log('🔍 Translation Completeness Check\n');
  
  // Load English as reference
  const enData = loadJSON('en');
  if (!enData) {
    console.error('❌ Could not load English translations');
    return;
  }
  
  const enKeys = getAllKeys(enData);
  console.log(`📋 English has ${enKeys.length} translation keys\n`);
  
  const results = {};
  let totalMissing = 0;
  
  // Check each language
  for (const lang of LANGUAGES) {
    const langData = loadJSON(lang);
    if (!langData) continue;
    
    const langKeys = getAllKeys(langData);
    const missingKeys = enKeys.filter(key => !langKeys.includes(key));
    const extraKeys = langKeys.filter(key => !enKeys.includes(key));
    
    results[lang] = {
      total: langKeys.length,
      missing: missingKeys,
      extra: extraKeys,
      completeness: ((langKeys.length / enKeys.length) * 100).toFixed(1)
    };
    
    totalMissing += missingKeys.length;
    
    // Print summary
    const status = missingKeys.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${lang.toUpperCase()}: ${results[lang].completeness}% complete (${langKeys.length}/${enKeys.length} keys)`);
    
    if (missingKeys.length > 0) {
      console.log(`   Missing ${missingKeys.length} keys:`);
      missingKeys.slice(0, 10).forEach(key => {
        console.log(`   - ${key}`);
      });
      if (missingKeys.length > 10) {
        console.log(`   ... and ${missingKeys.length - 10} more`);
      }
    }
    
    if (extraKeys.length > 0) {
      console.log(`   ⚡ Has ${extraKeys.length} extra keys not in English`);
    }
    
    console.log('');
  }
  
  // Summary
  console.log('─'.repeat(60));
  if (totalMissing === 0) {
    console.log('✅ All translations complete!');
  } else {
    console.log(`⚠️  Total missing translations: ${totalMissing}`);
    console.log('\n💡 Tip: Run this script after adding new English keys');
  }
  
  // Save detailed report
  const reportPath = path.join(__dirname, 'translation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

// Run check
checkTranslations();
