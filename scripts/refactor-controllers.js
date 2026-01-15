#!/usr/bin/env node
/**
 * Automated Controller Refactoring Script
 *
 * Refactors remaining controllers to use controllerHelpers utility:
 * - Removes duplicate getAnalyzerKeyOverride functions
 * - Updates imports to include controllerHelpers
 * - Replaces report metadata pattern with helper calls
 */

const fs = require('fs');
const path = require('path');

const CONTROLLERS_TO_REFACTOR = [
  'advancedAnalyzersController.js',
  'brokenLinkController.js',
  'competitiveAnalysisController.js',
  'coreWebVitalsController.js',
  'hostingController.js',
  'ipReputationController.js',
  'mobileAnalyzerController.js',
  'scanController.js',
  'tagIntelligenceController.js'
];

const CONTROLLERS_DIR = path.join(__dirname, '../src/controllers');

function refactorController(filename) {
  const filepath = path.join(CONTROLLERS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  Skipping ${filename} (not found)`);
    return false;
  }

  let content = fs.readFileSync(filepath, 'utf8');
  const originalContent = content;
  let changes = [];

  // Step 1: Remove duplicate getAnalyzerKeyOverride function
  const getAnalyzerKeyPattern = /function getAnalyzerKeyOverride\(req, fallbackKey\) \{\n  const fromBody = req && req\.body && typeof req\.body\.analyzerKey === 'string' \? req\.body\.analyzerKey\.trim\(\) : '';\n  return fromBody \|\| fallbackKey;\n\}/g;

  if (getAnalyzerKeyPattern.test(content)) {
    content = content.replace(getAnalyzerKeyPattern, '');
    changes.push('Removed duplicate getAnalyzerKeyOverride function');
  }

  // Step 2: Add controllerHelpers import if not present
  if (!content.includes('controllerHelpers')) {
    // Find the last require statement
    const requireMatches = content.match(/const .+ = require\(.+\);/g);
    if (requireMatches && requireMatches.length > 0) {
      const lastRequire = requireMatches[requireMatches.length - 1];
      const helperImport = `const {\n  getAnalyzerKeyOverride,\n  buildReportMetadata,\n  attachReportMetadata\n} = require('../utils/controllerHelpers');`;

      content = content.replace(lastRequire, `${lastRequire}\n${helperImport}`);
      changes.push('Added controllerHelpers import');
    }
  }

  // Step 3: Remove unused imports from scanTimestamp if getAnalyzerKeyOverride was removed
  if (changes.includes('Removed duplicate getAnalyzerKeyOverride function')) {
    // Remove imports no longer needed
    content = content.replace(/const { getRequestScanStartedAt, attachScanStartedAt } = require\('\.\.\/utils\/scanTimestamp'\);/, '');
    content = content.replace(/const { makeReportId } = require\('\.\.\/utils\/reportId'\);/, '');
    content = content.replace(/const { ensureReportScreenshot } = require\('\.\.\/utils\/reportScreenshot'\);/, '');

    // Clean up empty lines
    content = content.replace(/\n\n\n+/g, '\n\n');
    changes.push('Removed unused timestamp/report imports');
  }

  // Step 4: Replace report metadata pattern with helper calls
  // Pattern: 8-line block starting with getRequestScanStartedAt
  const metadataPattern = /const startedAt = getRequestScanStartedAt\(req\)[^;]*;\n\s*const analyzerKey = getAnalyzerKeyOverride\(req, '[^']+'\);\n\s*const reportId = makeReportId\(\{[^}]+\}\);\n\s*const screenshotUrl = reportId \? await ensureReportScreenshot\(\{[^}]+\}\) : null;\n\s*attachScanStartedAt\(results, startedAt\);\n\s*if \(reportId\) results\.reportId = reportId;\n\s*if \(screenshotUrl\) results\.screenshotUrl = screenshotUrl;/g;

  content = content.replace(metadataPattern, (match) => {
    // Extract analyzer key from the match
    const analyzerKeyMatch = match.match(/getAnalyzerKeyOverride\(req, '([^']+)'\)/);
    const analyzerKey = analyzerKeyMatch ? analyzerKeyMatch[1] : 'unknown';

    // Extract URL variable name (usually normalizedUrl or similar)
    const urlMatch = match.match(/normalizedUrl: (\w+)/);
    const urlVar = urlMatch ? urlMatch[1] : 'normalizedUrl';

    changes.push(`Replaced report metadata pattern (analyzerKey: ${analyzerKey})`);

    return `// Attach report metadata (reportId, screenshotUrl, timestamps)\n  const analyzerKey = getAnalyzerKeyOverride(req, '${analyzerKey}');\n  const metadata = await buildReportMetadata({ req, results, url: ${urlVar}, analyzerKey });\n  attachReportMetadata(results, metadata);`;
  });

  // Save if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`✅ ${filename}`);
    changes.forEach(change => console.log(`   - ${change}`));
    return true;
  } else {
    console.log(`⏭️  ${filename} (no changes needed)`);
    return false;
  }
}

console.log('=== Controller Refactoring Script ===\n');

let refactoredCount = 0;
let skippedCount = 0;

CONTROLLERS_TO_REFACTOR.forEach(filename => {
  const success = refactorController(filename);
  if (success) {
    refactoredCount++;
  } else {
    skippedCount++;
  }
  console.log('');
});

console.log('=== Summary ===');
console.log(`✅ Refactored: ${refactoredCount} controllers`);
console.log(`⏭️  Skipped: ${skippedCount} controllers`);
console.log('');
console.log('Next steps:');
console.log('1. Run: npm run lint');
console.log('2. Test refactored controllers manually or with API tests');
console.log('3. Commit changes');
