#!/usr/bin/env node

/**
 * PDF i18n Verification Script
 *
 * Tests that PDF export produces Japanese content when lang=ja,
 * and that all report sections are present (no blank pages).
 *
 * Usage:
 *   node scripts/test-pdf-i18n.js
 *
 * Prerequisites:
 *   - Server running on localhost:3000
 *   - npm install pdf-parse (if not already installed)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(__dirname, '../temp');

// Minimal security report data for testing
const MOCK_SECURITY_DATA = {
  reportId: 'test-pdf-i18n-' + Date.now(),
  url: 'https://example.com',
  normalizedUrl: 'https://example.com',
  scanStartedAt: new Date().toISOString(),
  overallScore: 72,
  ssl: {
    score: 85,
    valid: true,
    protocol: 'TLSv1.3',
    issuer: "Let's Encrypt Authority X3",
    validFrom: '2024-01-01',
    validTo: '2025-01-01',
    daysUntilExpiry: 180,
    issues: []
  },
  headers: {
    score: 60,
    implemented: 4,
    total: 10,
    details: {
      strictTransportSecurity: { implemented: true, value: 'max-age=31536000' },
      contentSecurityPolicy: { implemented: true, value: "default-src 'self'" },
      xFrameOptions: { implemented: true, value: 'DENY' },
      xContentTypeOptions: { implemented: true, value: 'nosniff' },
      xXSSProtection: { implemented: false },
      referrerPolicy: { implemented: false },
      permissionsPolicy: { implemented: false }
    }
  },
  vulnerabilities: {
    score: 80,
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    details: [
      { severity: 'high', title: 'Missing HTTP/2 Support', description: 'Site does not use HTTP/2' },
      { severity: 'medium', title: 'Cookie without SameSite', description: 'Some cookies lack SameSite attribute' },
      { severity: 'medium', title: 'No Subresource Integrity', description: 'Third-party scripts lack SRI' }
    ]
  },
  cookies: {
    score: 55,
    secure: 2,
    total: 5,
    httpOnly: 3,
    sameSite: 1,
    details: [
      { name: 'session_id', secure: true, httpOnly: true, sameSite: 'Strict', path: '/' },
      { name: 'analytics', secure: true, httpOnly: false, sameSite: 'None', path: '/' },
      { name: 'prefs', secure: false, httpOnly: false, sameSite: null, path: '/' }
    ]
  },
  thirdPartyScripts: {
    score: 60,
    total: 8,
    withSRI: 3,
    details: [
      { url: 'https://cdn.example.com/analytics.js', hasSRI: true },
      { url: 'https://fonts.googleapis.com/css2', hasSRI: false },
      { url: 'https://cdn.example.com/widget.js', hasSRI: true }
    ]
  },
  owaspCompliance: 65,
  recommendations: [
    { priority: 'high', title: 'Enable HSTS', description: 'Add Strict-Transport-Security header' },
    { priority: 'medium', title: 'Add CSP', description: 'Implement Content-Security-Policy' }
  ]
};

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;

    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = lib.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: res.headers,
          buffer: () => body,
          text: () => body.toString('utf-8')
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testJapanesePdf() {
  console.log('=== PDF i18n Verification Test ===\n');

  // Ensure output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Check server is running
  console.log(`1. Checking server at ${BASE_URL}...`);
  try {
    await fetch(BASE_URL);
    console.log('   Server is running.\n');
  } catch (e) {
    console.error(`   ERROR: Server not reachable at ${BASE_URL}`);
    console.error('   Start the server first: npm start\n');
    process.exit(1);
  }

  // 2. Request Japanese PDF
  console.log('2. Requesting Japanese PDF export (lang=ja, preferBrowser=true)...');
  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/api/pdf/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reportType: 'security',
        reportData: MOCK_SECURITY_DATA,
        lang: 'ja',
        pageUrl: '/ja/security-analyzer.html?report_id=' + MOCK_SECURITY_DATA.reportId + '&print=1',
        preferBrowser: true
      })
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errorText = response.text();
      console.error(`   ERROR: Server returned ${response.status}`);
      console.error(`   Response: ${errorText.substring(0, 200)}`);

      if (response.status === 403) {
        console.log('\n   Note: 403 = entitlement check failed (expected in dev without auth).');
        console.log('   To test, ensure NODE_ENV=development or provide auth token.');
      }
      process.exit(1);
    }

    const pdfBuffer = response.buffer();
    const outputPath = path.join(OUTPUT_DIR, 'test-japanese-export.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(`   PDF generated in ${elapsed}s, size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
    console.log(`   Saved to: ${outputPath}\n`);

    // 3. Verify PDF content
    console.log('3. Verifying PDF content...');

    let pdfParse;
    try {
      pdfParse = require('pdf-parse');
    } catch (e) {
      console.log('   SKIP: pdf-parse not installed. Install with: npm install --save-dev pdf-parse');
      console.log('   Manual verification: Open the PDF and check for Japanese text.\n');
      console.log('=== Test partially complete (PDF generated, content not verified) ===');
      return;
    }

    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    const pageCount = pdfData.numpages;

    console.log(`   Pages: ${pageCount}`);
    console.log(`   Text length: ${text.length} chars`);

    // Check for Japanese characters (Hiragana, Katakana, Kanji)
    const hasHiragana = /[\u3040-\u309F]/.test(text);
    const hasKatakana = /[\u30A0-\u30FF]/.test(text);
    const hasKanji = /[\u4E00-\u9FFF]/.test(text);
    const hasJapanese = hasHiragana || hasKatakana || hasKanji;

    console.log(`   Contains Hiragana: ${hasHiragana}`);
    console.log(`   Contains Katakana: ${hasKatakana}`);
    console.log(`   Contains Kanji: ${hasKanji}`);

    // Check for English-only headings that should be translated
    const englishOnlyHeadings = [
      'Executive Summary',
      'Security Headers',
      'Vulnerability Assessment',
      'Recommendations'
    ];

    const foundEnglishHeadings = englishOnlyHeadings.filter(h => text.includes(h));

    console.log(`\n   --- Results ---`);

    if (hasJapanese) {
      console.log('   PASS: Japanese text found in PDF');
    } else {
      console.log('   FAIL: No Japanese text found in PDF');
    }

    if (foundEnglishHeadings.length === 0) {
      console.log('   PASS: No English-only headings found (all translated)');
    } else {
      console.log(`   WARN: Found English headings: ${foundEnglishHeadings.join(', ')}`);
      console.log('         (These should be translated to Japanese)');
    }

    if (pageCount > 0 && text.length > 100) {
      console.log(`   PASS: PDF has content (${pageCount} pages, ${text.length} chars)`);
    } else {
      console.log('   FAIL: PDF appears to have no/minimal content');
    }

    console.log(`\n=== Test complete ===`);

  } catch (e) {
    console.error(`   ERROR: ${e.message}`);
    process.exit(1);
  }
}

testJapanesePdf().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
