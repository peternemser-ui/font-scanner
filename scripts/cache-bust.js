/**
 * Add ?v=VERSION cache-busting to all CSS/JS references in HTML files.
 * Run: node scripts/cache-bust.js
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const VERSION = require('../package.json').version;

// Find all public HTML files (skip pdf-templates — rendered by Puppeteer, not browsers)
const htmlFiles = glob.sync('src/public/**/*.html').filter(f =>
  !f.includes('pdf-templates') &&
  !f.includes('index_backup') &&
  !f.includes('index_simple') &&
  !f.includes('partials/')
);

// External patterns to skip — these are not served by express.static
const SKIP_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.',
  'cdnjs.',
  'unpkg.com',
  'socket.io/socket.io.js',
  'https://',
  'http://',
];

let totalChanges = 0;
const summary = [];

for (const file of htmlFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let changes = 0;

  // Match href="...css" or href="...css?v=..." and src="...js" or src="...js?v=..."
  content = content.replace(
    /((?:href|src)=")([^"]+\.(css|js))(\?[^"]*)?(")/g,
    (match, prefix, url, ext, existingQuery, quote) => {
      // Skip external URLs
      if (SKIP_PATTERNS.some(s => url.includes(s))) return match;
      if (url.startsWith('data:')) return match;

      const newRef = `${prefix}${url}?v=${VERSION}${quote}`;
      if (newRef !== match) changes++;
      return newRef;
    }
  );

  if (changes > 0) {
    fs.writeFileSync(file, content, 'utf8');
    totalChanges += changes;
    summary.push(`  ${path.basename(file)}: ${changes} refs`);
  }
}

console.log(`Cache-bust v${VERSION} applied to ${summary.length} files (${totalChanges} refs total)`);
summary.forEach(s => console.log(s));
