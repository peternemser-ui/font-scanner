#!/usr/bin/env node
/**
 * Invariant Checker — validates a file against project invariants defined in invariants.json
 *
 * Usage: node .claude/hooks/check-invariants.js <filepath>
 *        echo '{"file_path":"/path/to/file.js"}' | node .claude/hooks/check-invariants.js --stdin
 *
 * Exit codes:
 *   0 = all checks passed (or warnings only)
 *   1 = blocking invariant violated
 */

const fs = require('fs');
const path = require('path');

// Load invariants from JSON
const invariantsPath = path.join(__dirname, '..', 'invariants.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(invariantsPath, 'utf8'));
} catch (e) {
  console.error(`[invariants] Failed to load ${invariantsPath}: ${e.message}`);
  process.exit(0); // Don't block if config is missing
}

// Parse file path from args or stdin
let filePath = process.argv[2];

if (filePath === '--stdin') {
  try {
    const input = fs.readFileSync(0, 'utf8');
    const parsed = JSON.parse(input);
    filePath = parsed.file_path || parsed.filePath;
  } catch {
    process.exit(0);
  }
}

if (!filePath) {
  console.error('[invariants] Usage: check-invariants.js <filepath>');
  process.exit(0);
}

// Normalize to forward slashes for glob matching
const normalizedPath = filePath.replace(/\\/g, '/');

// Simple glob matcher (supports * and **)
function matchGlob(pattern, filepath) {
  // Normalize both to forward slashes
  const p = pattern.replace(/\\/g, '/');
  const f = filepath.replace(/\\/g, '/');

  // Convert glob to regex
  let regex = p
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*/g, '[^/]*');
  regex = '^(.*/)?(' + regex + ')$';

  return new RegExp(regex).test(f);
}

// Check if any appliesTo glob matches the file
function appliesToFile(invariant, filepath) {
  return invariant.appliesTo.some(glob => matchGlob(glob, filepath));
}

// Read file content
let content;
try {
  content = fs.readFileSync(filePath, 'utf8');
} catch (e) {
  // File might not exist yet (pre-edit check on new file)
  process.exit(0);
}

const warnings = [];
const blocks = [];

for (const inv of config.invariants) {
  if (!appliesToFile(inv, normalizedPath)) continue;

  switch (inv.check) {
    case 'regex': {
      // Pattern MUST be present in the file
      const re = new RegExp(inv.pattern);
      if (!re.test(content)) {
        const msg = `[${inv.id}] ${inv.description} — pattern "${inv.pattern}" not found`;
        if (inv.severity === 'block') blocks.push(msg);
        else warnings.push(msg);
      }
      break;
    }

    case 'absence': {
      // Pattern must NOT be present in the file
      const re = new RegExp(inv.pattern);
      if (re.test(content)) {
        const matches = content.match(new RegExp(inv.pattern, 'g'));
        const msg = `[${inv.id}] ${inv.description} — found ${matches.length} occurrence(s) of forbidden pattern`;
        if (inv.severity === 'block') blocks.push(msg);
        else warnings.push(msg);
      }
      break;
    }

    case 'count-min': {
      // Pattern must appear at least N times
      const re = new RegExp(inv.pattern, 'g');
      const matches = content.match(re) || [];
      if (matches.length < inv.minimum) {
        const msg = `[${inv.id}] ${inv.description} — found ${matches.length} occurrences, need >= ${inv.minimum}`;
        if (inv.severity === 'block') blocks.push(msg);
        else warnings.push(msg);
      }
      break;
    }

    case 'co-change': {
      // This check is informational — remind about updating all locale files together
      if (normalizedPath.includes('/i18n/') && normalizedPath.endsWith('.json')) {
        const localeDir = path.dirname(filePath);
        const locales = inv.locales || ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh', 'ru'];
        const msg = `[${inv.id}] ${inv.description} — remember to update all ${locales.length} locale files: ${locales.join(', ')}`;
        warnings.push(msg);
      }
      break;
    }

    default:
      // Unknown check type, skip
      break;
  }
}

// Output results
if (blocks.length > 0) {
  console.error('BLOCKED — invariant violation(s):');
  blocks.forEach(b => console.error(`  !! ${b}`));
  if (warnings.length > 0) {
    console.warn('Warnings:');
    warnings.forEach(w => console.warn(`  >> ${w}`));
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('Invariant warnings:');
  warnings.forEach(w => console.warn(`  >> ${w}`));
}

process.exit(0);
