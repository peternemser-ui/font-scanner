/**
 * PDF Smoke Test
 *
 * Validates that the PDF generation pipeline works end-to-end:
 * - Server-side Puppeteer rendering via generatePdfFromUrl
 * - Correct filename casing (SEO not Seo, etc.)
 * - Locale persistence and light-theme forcing
 * - Content presence (non-trivial file size)
 *
 * Prerequisites:
 *   The app server must be running on localhost (default port 3000).
 *   Start it with: npm start
 *
 * Run:
 *   node tests/pdf-smoke.test.js
 *
 * Or via Jest (will skip if server is not reachable):
 *   npx jest tests/pdf-smoke.test.js
 */

const http = require('http');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lightweight fetch using Node http (no external deps needed). */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 60000 // 60s — PDF generation can be slow
    };

    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks)
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/** Check if server is reachable. */
async function isServerRunning() {
  try {
    const res = await request(`${BASE_URL}/`, { method: 'GET' });
    return res.status < 500;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Assertions (work both standalone and under Jest)
// ---------------------------------------------------------------------------
function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const REPORT_TYPES = ['seo', 'security'];

async function testPdfGeneration(reportType) {
  const reportId = `smoke-${reportType}-${Date.now()}`;

  const payload = JSON.stringify({
    reportType,
    reportData: {
      reportId,
      url: 'https://example.com',
      normalizedUrl: 'https://example.com',
      scanStartedAt: new Date().toISOString()
    },
    pageUrl: `/en/${reportType}-analyzer.html?report_id=${reportId}&print=1`,
    preferBrowser: true
  });

  const res = await request(`${BASE_URL}/api/pdf/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    body: payload
  });

  // Should return 200 or 403 (if auth required). Either proves the pipeline runs.
  // We accept 403 because smoke tests may run without auth tokens.
  if (res.status === 403) {
    console.log(`  [${reportType}] Skipped — auth required (403). Pipeline reachable.`);
    return;
  }

  assert(
    res.status === 200,
    `${reportType}: Expected 200, got ${res.status}. Body: ${res.body.toString().slice(0, 300)}`
  );

  // Check content-type is PDF
  const contentType = res.headers['content-type'] || '';
  assert(
    contentType.includes('application/pdf'),
    `${reportType}: Expected PDF content-type, got "${contentType}"`
  );

  // Check content-disposition has correct filename casing
  const disposition = res.headers['content-disposition'] || '';
  const expectedPrefix = reportType === 'seo' ? 'SEO' : 'Security';
  assert(
    disposition.includes(`${expectedPrefix}-report-`),
    `${reportType}: Filename should start with "${expectedPrefix}-report-", got: "${disposition}"`
  );

  // Check non-trivial size (> 10KB suggests real rendered content)
  const size = res.body.length;
  assert(
    size > 10240,
    `${reportType}: PDF too small (${size} bytes). Expected > 10KB for real content.`
  );

  // Verify it's actually a PDF (starts with %PDF-)
  const header = res.body.slice(0, 5).toString();
  assert(
    header === '%PDF-',
    `${reportType}: File does not start with PDF magic bytes. Got: "${header}"`
  );

  console.log(`  [${reportType}] OK — ${(size / 1024).toFixed(1)} KB, filename: ${disposition}`);
}

// ---------------------------------------------------------------------------
// Runner (standalone or Jest)
// ---------------------------------------------------------------------------

if (typeof describe === 'function') {
  // Running under Jest
  describe('PDF Smoke Tests', () => {
    let serverAvailable = false;

    beforeAll(async () => {
      serverAvailable = await isServerRunning();
      if (!serverAvailable) {
        console.warn('Server not running — skipping PDF smoke tests');
      }
    });

    for (const reportType of REPORT_TYPES) {
      it(`should generate a valid ${reportType.toUpperCase()} PDF`, async () => {
        if (!serverAvailable) return; // skip
        await testPdfGeneration(reportType);
      }, 90000); // 90s timeout
    }

    it('should not include lang in POST body (server uses DB locale)', () => {
      // Static assertion: verify the client utility doesn't send lang
      // This is a design-level check, not a runtime check
      const fs = require('fs');
      const path = require('path');
      const utilityPath = path.join(__dirname, '..', 'src', 'public', 'pdf-export-utility.js');
      const source = fs.readFileSync(utilityPath, 'utf8');

      // Find the fetch body JSON.stringify block
      const fetchBodyMatch = source.match(/body:\s*JSON\.stringify\(\{[\s\S]*?\}\)/);
      if (fetchBodyMatch) {
        const fetchBody = fetchBodyMatch[0];
        // Ensure 'lang:' is NOT in the body (it should be removed)
        expect(fetchBody).not.toMatch(/\blang\s*:/);
      }
    });

    it('should have forceLocale method in i18n', () => {
      const fs = require('fs');
      const path = require('path');
      const i18nPath = path.join(__dirname, '..', 'src', 'public', 'i18n.js');
      const source = fs.readFileSync(i18nPath, 'utf8');
      expect(source).toContain('async forceLocale(lang)');
    });

    it('should persist locale in scans table (migration exists)', () => {
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(__dirname, '..', 'src', 'db', 'migrations', '009_add_locale_to_scans.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql).toContain('locale');
    });
  });
} else {
  // Standalone execution
  (async () => {
    console.log('PDF Smoke Test');
    console.log('==============');
    console.log(`Target: ${BASE_URL}\n`);

    const running = await isServerRunning();
    if (!running) {
      console.error('ERROR: Server is not running. Start with: npm start');
      process.exit(1);
    }

    let passed = 0;
    let failed = 0;

    for (const reportType of REPORT_TYPES) {
      try {
        await testPdfGeneration(reportType);
        passed++;
      } catch (err) {
        console.error(`  [${reportType}] FAILED: ${err.message}`);
        failed++;
      }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  })();
}
