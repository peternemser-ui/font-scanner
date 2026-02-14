/**
 * Test script: Run SEO scan then export PDF report
 * Usage: node scripts/test-pdf-export.js [url]
 */
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const TEST_URL = process.argv[2] || 'https://dariopegoretti.com/quick-curves-the-new-marcelo-interno';
const OUT_DIR = path.join(__dirname, '..', 'temp');

async function main() {
  // 1. Run SEO scan
  console.log('=== Step 1: Running SEO scan ===');
  console.log('URL:', TEST_URL);
  const scanRes = await fetch(`${BASE}/api/seo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: TEST_URL })
  });
  const scanData = await scanRes.json();
  console.log('Scan status:', scanRes.status);

  // Results may be nested under .results
  const results = scanData.results || scanData;
  const overall = results.score?.overall || results.overallScore;
  console.log('Overall score:', overall, '/ Grade:', results.score?.grade || 'N/A');
  console.log('Categories:', Object.keys(results.score?.breakdown || {}).join(', '));

  if (!overall && !results.score && !results.scores) {
    console.error('Scan failed or returned no data:', JSON.stringify(scanData).substring(0, 300));
    process.exit(1);
  }

  // Build reportData payload matching what the client sends
  const reportData = {
    ...results,
    overallScore: overall,
    url: TEST_URL,
    normalizedUrl: TEST_URL,
    reportId: scanData.reportId || results.reportId || `test-${Date.now()}`,
    scanStartedAt: scanData.startedAt || scanData.timestamp
  };

  // 2. Generate PDF
  console.log('\n=== Step 2: Generating PDF ===');
  try {
    const pdfRes = await fetch(`${BASE}/api/pdf/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportType: 'seo',
        reportData,
        lang: 'en',
        pageUrl: '/seo-analyzer.html',
        preferBrowser: true
      })
    });
    console.log('PDF status:', pdfRes.status);

    if (pdfRes.ok) {
      const buffer = await pdfRes.arrayBuffer();
      const domain = TEST_URL.replace(/^https?:\/\//, '').split('/')[0];
      const dateStr = new Date().toISOString().split('T')[0];
      const suffix = Date.now().toString(36);
      const outFile = path.join(OUT_DIR, `seo-report-${domain}-${dateStr}-${suffix}.pdf`);
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(outFile, Buffer.from(buffer));
      console.log(`PDF saved: ${outFile} (${Math.round(buffer.byteLength / 1024)} KB)`);
    } else {
      const err = await pdfRes.text();
      console.error('PDF generation failed:', err.substring(0, 500));
    }
  } catch (e) {
    console.error('PDF error:', e.message);
  }

  console.log('\n=== Done! ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
