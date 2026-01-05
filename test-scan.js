/**
 * Simple test script for the async scan system
 * Usage: node test-scan.js [url]
 */

const axios = require('axios');
const fs = require('fs');

const API_BASE = 'http://localhost:3000';
const TEST_URL = process.argv[2] || 'https://fonts.google.com';

async function testScan() {
  try {
    console.log('🚀 Font Scanner - Test Script\n');
    console.log(`Target URL: ${TEST_URL}\n`);

    // 1. Create scan
    console.log('📝 Step 1: Creating scan...');
    const createResponse = await axios.post(`${API_BASE}/api/scans`, {
      url: TEST_URL,
      options: {
        maxPages: 3,
        maxDepth: 2,
        analyzers: ['font', 'tags', 'performance']
      }
    });

    const { scanId, status } = createResponse.data;
    console.log(`✅ Scan created successfully!`);
    console.log(`   Scan ID: ${scanId}`);
    console.log(`   Status: ${status}\n`);

    // 2. Poll for progress
    console.log('⏳ Step 2: Monitoring progress...');
    console.log('   (This may take 30-60 seconds)\n');

    let currentStatus = 'queued';
    let lastProgress = 0;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max

    while (currentStatus !== 'done' && currentStatus !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const statusResponse = await axios.get(`${API_BASE}/api/scans/${scanId}`);
      const data = statusResponse.data;

      currentStatus = data.status;
      const progress = data.progress || 0;

      if (progress !== lastProgress) {
        const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
        console.log(`   [${progressBar}] ${progress}% - ${currentStatus}`);
        lastProgress = progress;
      }

      attempts++;
    }

    console.log('');

    if (currentStatus === 'failed') {
      console.error('❌ Scan failed!');
      process.exit(1);
    }

    if (attempts >= maxAttempts) {
      console.error('⏱️  Timeout: Scan took too long');
      process.exit(1);
    }

    console.log('✅ Scan completed successfully!\n');

    // 3. Display results summary
    console.log('📊 Step 3: Results Summary');
    const resultsResponse = await axios.get(`${API_BASE}/api/scans/${scanId}`);
    const { results, pagesCrawled } = resultsResponse.data;

    console.log(`   Pages Crawled: ${pagesCrawled}`);
    console.log('   Analyzers:');

    // Font Analysis
    if (results.font && results.font[0]?.result) {
      const fontResult = results.font[0].result;
      console.log(`   ✅ Font Analysis (Score: ${fontResult.healthScore || 0}/100)`);
      console.log(`      - Families: ${fontResult.summary?.totalFamilies || 0}`);
      console.log(`      - Providers: ${fontResult.providers?.length || 0}`);
    }

    // Tag Analysis
    if (results.tags && results.tags[0]?.result) {
      const tagResult = results.tags[0].result;
      console.log(`   ✅ Tag Analysis (Score: ${tagResult.healthScore || 0}/100)`);
      console.log(`      - Tags Found: ${tagResult.summary?.totalTags || 0}`);
      console.log(`      - Issues: ${tagResult.issues?.length || 0}`);
    }

    // Performance Analysis
    if (results.performance && results.performance[0]?.result) {
      const perfResult = results.performance[0].result;
      console.log(`   ✅ Performance (Score: ${perfResult.performanceScore || 0}/100)`);
      console.log(`      - Total Requests: ${perfResult.summary?.totalRequests || 0}`);
      console.log(`      - Page Weight: ${perfResult.summary?.estimatedPageWeightKB?.toFixed(0) || 0} KB`);
    }

    console.log('');

    // 4. Download PDF
    console.log('📄 Step 4: Downloading PDF report...');
    try {
      const pdfResponse = await axios.get(`${API_BASE}/api/scans/${scanId}/pdf`, {
        responseType: 'arraybuffer'
      });

      const filename = `scan-report-${scanId.substring(0, 8)}.pdf`;
      fs.writeFileSync(filename, pdfResponse.data);
      console.log(`✅ PDF saved: ${filename}`);
      console.log(`   Size: ${(pdfResponse.data.length / 1024).toFixed(2)} KB`);
      console.log(`   Note: Free tier watermark applied\n`);
    } catch (pdfError) {
      console.log('⚠️  PDF download failed:', pdfError.response?.data?.message || pdfError.message);
      console.log('   (PDF export may require Playwright browsers installed)\n');
    }

    // 5. Final info
    console.log('🎉 Test Completed Successfully!\n');
    console.log('📱 View in browser:');
    console.log(`   http://localhost:3000/results.html?scanId=${scanId}\n`);
    console.log('💡 Tip: Try different URLs to test various analyzers:');
    console.log('   node test-scan.js https://google.com');
    console.log('   node test-scan.js https://github.com');
    console.log('   node test-scan.js https://fonts.google.com\n');

  } catch (error) {
    console.error('\n❌ Test Failed!\n');

    if (error.code === 'ECONNREFUSED') {
      console.error('Error: Cannot connect to server');
      console.error('Make sure the server is running: npm run dev\n');
    } else if (error.response) {
      console.error('API Error:', error.response.status);
      console.error('Message:', error.response.data.message || error.response.data.error);
      if (error.response.data.details) {
        console.error('Details:', error.response.data.details);
      }
    } else {
      console.error('Error:', error.message);
    }

    console.error('');
    process.exit(1);
  }
}

// Check if axios is available
try {
  require.resolve('axios');
} catch (e) {
  console.error('❌ Error: axios not found');
  console.error('Run: npm install axios\n');
  process.exit(1);
}

// Run test
console.clear();
testScan();
