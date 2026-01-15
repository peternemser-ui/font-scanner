#!/usr/bin/env node
/**
 * Organize markdown documentation files
 * - Keep essential docs in root
 * - Archive session summaries and historical docs
 * - Delete duplicates and obsolete docs
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// Essential docs to KEEP in root
const KEEP_IN_ROOT = [
  'README.md',
  'README_DEV.md',
  'SECURITY.md',
  'PRIVACY.md',
  'QUICKSTART.md',
  'START_HERE.md',
  'DEPLOY.md',
  'TEST_GUIDE.md',
  'MIGRATION-COMPLETE.md', // Recent important migration doc
];

// Archive to docs/archive (historical value but not needed in root)
const ARCHIVE_PATTERNS = [
  /_COMPLETE\.md$/,
  /_SUMMARY\.md$/,
  /^SESSION_/,
  /_FIX\.md$/,
  /_IMPLEMENTATION\.md$/,
  /^PHASE_\d+_COMPLETE\.md$/,
  /^OPTION_[A-Z]+_COMPLETE\.md$/,
  /^(DESIGN_SYSTEM|HEALTH_TIMELINE|PDF_EXPORT|WEBSOCKET)_.+\.md$/,
  /^(COLOR|LAYOUT|ICON|FONT)_.+\.md$/,
];

// Delete (duplicates or truly obsolete)
const DELETE_LIST = [
  'DEPLOY_NOW.md', // Duplicate of DEPLOY.md
  'DEPLOYMENT.md', // Duplicate of DEPLOY.md
  'DEPLOYMENT_SUMMARY.md', // Duplicate of DEPLOY.md
  'DOCKER_README.md', // Info should be in DEPLOY.md
  'VSCODE_SETUP.md', // Not critical
  'TESTING_CHARTJS.md', // Specific test, archived
  'TEST_PDF_EXPORT.md', // Specific test, archived
  'BENCHMARK.md', // Outdated benchmark
];

// Consolidation opportunities (merge multiple docs into one)
const CONSOLIDATE_GROUPS = {
  'ARCHITECTURE.md': [
    'ARCHITECTURE_REVIEW.md',
    'REFERENCE_ARCHITECTURE.md',
    'BROWSER_POOL_IMPLEMENTATION.md',
  ],
  'DEVELOPMENT.md': [
    'QUICKSTART.md', // Keep this one
    'START_HERE.md',
  ],
};

function shouldArchive(filename) {
  return ARCHIVE_PATTERNS.some(pattern => pattern.test(filename));
}

function shouldDelete(filename) {
  return DELETE_LIST.includes(filename);
}

function shouldKeep(filename) {
  return KEEP_IN_ROOT.includes(filename);
}

function organizeFiles() {
  const files = fs.readdirSync('.').filter(f => f.endsWith('.md'));

  const actions = {
    keep: [],
    archive: [],
    delete: [],
  };

  files.forEach(file => {
    if (shouldKeep(file)) {
      actions.keep.push(file);
    } else if (shouldDelete(file)) {
      actions.delete.push(file);
    } else if (shouldArchive(file)) {
      actions.archive.push(file);
    } else {
      // Default: archive if not explicitly kept
      actions.archive.push(file);
    }
  });

  return actions;
}

function executeActions(actions) {
  console.log(DRY_RUN ? '=== DRY RUN MODE ===' : '=== ORGANIZING DOCUMENTATION ===');
  console.log('');

  // Create archive directory
  const archiveDir = 'docs/archive';
  if (!DRY_RUN && !fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  // Keep in root
  console.log(`📌 KEEPING IN ROOT (${actions.keep.length} files):`);
  actions.keep.forEach(file => console.log(`   ${file}`));
  console.log('');

  // Archive
  console.log(`📦 ARCHIVING (${actions.archive.length} files):`);
  actions.archive.forEach(file => {
    console.log(`   ${file} → docs/archive/${file}`);
    if (!DRY_RUN) {
      fs.renameSync(file, path.join(archiveDir, file));
    }
  });
  console.log('');

  // Delete
  console.log(`🗑️  DELETING (${actions.delete.length} files):`);
  actions.delete.forEach(file => {
    console.log(`   ${file}`);
    if (!DRY_RUN) {
      fs.unlinkSync(file);
    }
  });
  console.log('');

  console.log('=== SUMMARY ===');
  console.log(`Total files processed: ${actions.keep.length + actions.archive.length + actions.delete.length}`);
  console.log(`├─ Kept in root: ${actions.keep.length}`);
  console.log(`├─ Archived: ${actions.archive.length}`);
  console.log(`└─ Deleted: ${actions.delete.length}`);
  console.log('');

  if (DRY_RUN) {
    console.log('This was a dry run. Run without --dry-run to apply changes.');
  } else {
    console.log('✓ Documentation organized successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Review docs/archive/ for any files you want to restore');
    console.log('2. Consider consolidating similar docs (ARCHITECTURE, DEPLOYMENT, etc.)');
    console.log('3. Update README.md with links to key documentation');
  }
}

const actions = organizeFiles();
executeActions(actions);
