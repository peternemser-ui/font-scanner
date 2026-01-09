#!/usr/bin/env node

/**
 * Cleanup Expired Pro Report Snapshots
 * 
 * This script scans the pro report storage directory and removes
 * purchase folders where the expiresAt timestamp has passed.
 * 
 * Usage:
 *   node scripts/cleanup-expired-reports.js [--dry-run]
 * 
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 * 
 * Environment:
 *   REPORT_STORAGE_DIR  Override storage directory (default: ./data/reports)
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const isDryRun = process.argv.includes('--dry-run');
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

/**
 * Get storage directory (matches proReportStorage.js logic)
 */
function getStorageDir() {
  const isProduction = process.env.NODE_ENV === 'production';
  const envDir = process.env.REPORT_STORAGE_DIR;
  
  if (envDir) {
    return path.resolve(envDir);
  }
  
  if (isProduction) {
    return '/var/lib/sitemechanic/reports';
  }
  
  return path.resolve(process.cwd(), 'data', 'reports');
}

/**
 * Read meta.json from a purchase folder
 */
async function readMetadata(folderPath) {
  try {
    const metaPath = path.join(folderPath, 'meta.json');
    const content = await fs.readFile(metaPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Delete a folder recursively
 */
async function deleteFolder(folderPath) {
  await fs.rm(folderPath, { recursive: true, force: true });
}

/**
 * Main cleanup function
 */
async function cleanupExpiredReports() {
  const storageDir = getStorageDir();
  const now = new Date();
  
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Pro Report Snapshot Cleanup                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Storage directory: ${storageDir}`);
  console.log(`Current time: ${now.toISOString()}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no deletions)' : 'LIVE'}`);
  console.log('');

  // Check if storage directory exists
  try {
    await fs.access(storageDir);
  } catch (error) {
    console.log('Storage directory does not exist. Nothing to clean up.');
    return { scanned: 0, deleted: 0, errors: 0 };
  }

  // Get all entries in storage directory
  const entries = await fs.readdir(storageDir, { withFileTypes: true });
  const folders = entries.filter(e => e.isDirectory());

  console.log(`Found ${folders.length} purchase folder(s) to scan.`);
  console.log('');

  let scanned = 0;
  let deleted = 0;
  let errors = 0;
  let skipped = 0;

  for (const folder of folders) {
    const folderPath = path.join(storageDir, folder.name);
    scanned++;

    try {
      const metadata = await readMetadata(folderPath);
      
      if (!metadata) {
        if (isVerbose) {
          console.log(`⚠ ${folder.name}: No meta.json found, skipping`);
        }
        skipped++;
        continue;
      }

      if (!metadata.expiresAt) {
        if (isVerbose) {
          console.log(`⚠ ${folder.name}: No expiresAt in metadata, skipping`);
        }
        skipped++;
        continue;
      }

      const expiresAt = new Date(metadata.expiresAt);
      const isExpired = expiresAt < now;

      if (isExpired) {
        const ageMs = now - expiresAt;
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        
        if (isDryRun) {
          console.log(`🗑 [DRY RUN] Would delete: ${folder.name}`);
          console.log(`   Domain: ${metadata.domain}`);
          console.log(`   Expired: ${expiresAt.toISOString()} (${ageDays} days ago)`);
        } else {
          console.log(`🗑 Deleting: ${folder.name}`);
          console.log(`   Domain: ${metadata.domain}`);
          console.log(`   Expired: ${expiresAt.toISOString()} (${ageDays} days ago)`);
          await deleteFolder(folderPath);
          console.log(`   ✓ Deleted`);
        }
        deleted++;
      } else if (isVerbose) {
        const remainingMs = expiresAt - now;
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        console.log(`✓ ${folder.name}: Valid (expires in ${remainingDays} days)`);
      }

    } catch (error) {
      console.error(`✗ Error processing ${folder.name}:`, error.message);
      errors++;
    }
  }

  // Summary
  console.log('');
  console.log('─'.repeat(60));
  console.log('Summary:');
  console.log(`  Scanned: ${scanned} folder(s)`);
  console.log(`  ${isDryRun ? 'Would delete' : 'Deleted'}: ${deleted} folder(s)`);
  console.log(`  Skipped: ${skipped} folder(s) (no/invalid metadata)`);
  console.log(`  Errors: ${errors}`);
  console.log('');

  if (isDryRun && deleted > 0) {
    console.log('To actually delete these folders, run without --dry-run');
  }

  return { scanned, deleted, errors, skipped };
}

// Run cleanup
cleanupExpiredReports()
  .then(stats => {
    if (stats.errors > 0) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
