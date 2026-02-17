#!/usr/bin/env node
/**
 * Fix corrupted escaped-apostrophe strings in PDF render scripts.
 *
 * The automated i18n sync doubled text after \' in fallback strings.
 * Pattern: 'text before apostrophe\'s continuation...end.'s continuation...end.'
 * Fix:     'text before apostrophe\'s continuation...end.'
 *
 * We scan each line for an UNESCAPED single-quote followed by s/t/re/ve/ll/d + space
 * that is preceded by a sentence-ending character (. ! ? )) and NOT preceded by \.
 * That junction marks the start of the duplicate — we delete from the period before
 * the unescaped ' to right before the closing '.
 */

const fs = require('fs');
const path = require('path');
const glob = require('path');

const RENDER_DIR = path.join(__dirname, '../src/public/pdf-templates');

// Match an unescaped ' followed by s/t/re/ve/ll/d and a space,
// preceded by sentence-ending punctuation.
// We look for:  <sentence-end-char>'<contraction-suffix><space>
// where <sentence-end-char> is NOT a backslash (so not \')
// Pattern explanation:
//   ([^\\])   – char before the ' that is NOT a backslash
//   '         – the unescaped closing single-quote (corrupt junction)
//   (s|t|re|ve|ll|d)\s – contraction suffix
const CORRUPT_PATTERN = /([^\\])'(s|t|re|ve|ll|d)\s/g;

let totalFixes = 0;

const files = fs.readdirSync(RENDER_DIR).filter(f => f.endsWith('-render.js'));

for (const file of files) {
  const filepath = path.join(RENDER_DIR, file);
  let content = fs.readFileSync(filepath, 'utf8');
  let fileFixed = 0;

  // Process line by line for better control
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Only process lines that contain t() function calls with fallback strings
    if (!line.includes("t('") && !line.includes('t("')) continue;

    // Reset the pattern
    CORRUPT_PATTERN.lastIndex = 0;

    let match;
    let newLine = line;
    let offset = 0;

    // We need to be careful: check each match to see if it's inside a string
    // and represents a corruption point (not a normal use of apostrophe in JS code)
    while ((match = CORRUPT_PATTERN.exec(line)) !== null) {
      const matchStart = match.index;
      const charBefore = match[1]; // char before the unescaped '
      const suffix = match[2]; // s, t, re, ve, etc.

      // The corruption junction: everything from here to the end of the string
      // is a duplicate. We need to find the closing ' of the string.
      // The unescaped ' at matchStart+1 SHOULD be the end of the first copy.
      // After it comes `<suffix> <duplicate text>'` which we need to remove.

      // Find where the duplicate portion ends (the real closing ')
      // We need to find the next unescaped ' that closes the t() call's second arg
      const afterCorruption = matchStart + match[0].length;
      let endQuote = -1;

      for (let j = afterCorruption; j < line.length; j++) {
        if (line[j] === "'" && line[j - 1] !== '\\') {
          endQuote = j;
          break;
        }
      }

      if (endQuote === -1) continue; // can't find closing quote, skip

      // The fix: remove from (matchStart + 1) to (endQuote)
      // i.e., replace the unescaped ' with ' (keep it as the end of string)
      // and delete everything between it and the real closing '
      const corruptionStart = matchStart + 1 + offset; // position of unescaped '
      const corruptionEnd = endQuote + offset; // position of real closing '

      // Build fixed line: keep everything up to and including the unescaped ',
      // then skip everything until the real closing ' (but keep the closing ')
      newLine = newLine.substring(0, corruptionStart + 1) + newLine.substring(corruptionEnd);
      offset += (corruptionStart + 1) - corruptionEnd; // adjust for removed chars

      fileFixed++;
      console.log(`  ${file}:${i + 1} — removed ${corruptionEnd - corruptionStart - 1} chars of duplicate after \\'${suffix}`);

      // Reset pattern to continue scanning from adjusted position
      CORRUPT_PATTERN.lastIndex = matchStart + 2;
    }

    if (newLine !== line) {
      lines[i] = newLine;
    }
  }

  if (fileFixed > 0) {
    fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
    console.log(`Fixed ${fileFixed} corruption(s) in ${file}`);
    totalFixes += fileFixed;
  }
}

console.log(`\nTotal: ${totalFixes} corruptions fixed across ${files.length} files`);
