#!/usr/bin/env node
/**
 * Remove console.log/warn/debug statements from production code
 * Keep console.error in catch blocks (will migrate to logger later)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const DRY_RUN = process.argv.includes('--dry-run');

// Patterns to remove
const patterns = [
  // Remove entire console.log/warn/debug lines
  /^(\s*)console\.(log|warn|debug)\([^)]*\);?\s*$/gm,

  // Remove inline console statements
  /console\.(log|warn|debug)\([^)]*\);\s*/g,

  // Remove multi-line console statements
  /console\.(log|warn|debug)\(\s*[^)]*\n[^)]*\);?/g,
];

const filesToProcess = [
  'src/public/**/*.js',
  'src/services/**/*.js',
  'src/routes/**/*.js',
  'src/queue/**/*.js',
  'src/middleware/**/*.js',
  'src/db/**/*.js',
];

const excludePatterns = [
  '**/node_modules/**',
  '**/*.test.js',
  '**/*.spec.js',
  '**/tests/**',
  '**/logger.js', // Don't touch the logger itself
];

let totalRemoved = 0;
let filesModified = 0;

function shouldExclude(filePath) {
  return excludePatterns.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
    return regex.test(filePath);
  });
}

function removeConsoleLogs(content) {
  let modified = content;
  let count = 0;

  // Count occurrences before removal
  patterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      count += matches.length;
    }
  });

  // Remove console statements
  patterns.forEach(pattern => {
    modified = modified.replace(pattern, '');
  });

  // Clean up multiple blank lines
  modified = modified.replace(/\n\n\n+/g, '\n\n');

  return { modified, count };
}

function processFile(filePath) {
  if (shouldExclude(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const { modified, count } = removeConsoleLogs(content);

  if (count > 0) {
    console.log(`${filePath}: ${count} console statements removed`);
    filesModified++;
    totalRemoved += count;

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, modified, 'utf8');
    }
  }
}

console.log(DRY_RUN ? '=== DRY RUN MODE ===' : '=== REMOVING CONSOLE STATEMENTS ===');
console.log('');

filesToProcess.forEach(pattern => {
  const files = glob.sync(pattern, { nodir: true });
  files.forEach(processFile);
});

console.log('');
console.log('=== SUMMARY ===');
console.log(`Files modified: ${filesModified}`);
console.log(`Console statements removed: ${totalRemoved}`);
console.log('');

if (DRY_RUN) {
  console.log('This was a dry run. Run without --dry-run to apply changes.');
} else {
  console.log('✓ Console statements removed successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Run: npm run lint');
  console.log('2. Run: npm test');
  console.log('3. Review changes and commit');
}
