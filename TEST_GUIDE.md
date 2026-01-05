# Testing Guide - Async Scan System

## 🚀 Quick Start

### 1. Start the Development Server

```bash
npm run dev
```

You should see:
```
📊 Database connected: ./data/fontscanner.db
✅ Database initialized successfully
✅ Migrations completed
Scan worker initialized
Font Scanner server running on port 3000
```

---

## 📝 Testing Methods

### Method 1: Using cURL (API Testing)

#### Create a Scan
```bash
curl -X POST http://localhost:3000/api/scans \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://fonts.google.com",
    "options": {
      "maxPages": 3,
      "maxDepth": 2,
      "analyzers": ["font", "tags", "performance"]
    }
  }'
```

**Response:**
```json
{
  "scanId": "abc-123-def-456",
  "status": "queued",
  "message": "Scan created successfully",
  "pollUrl": "/api/scans/abc-123-def-456"
}
```

#### Monitor Scan Progress
```bash
# Replace <scanId> with the ID from the response
curl http://localhost:3000/api/scans/<scanId>
```

**Response (while running):**
```json
{
  "scanId": "abc-123-def-456",
  "url": "https://fonts.google.com",
  "status": "running",
  "progress": 45,
  "pagesCrawled": 3,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "startedAt": "2025-01-15T10:30:01.000Z"
}
```

**Response (when complete):**
```json
{
  "scanId": "abc-123-def-456",
  "url": "https://fonts.google.com",
  "status": "done",
  "progress": 100,
  "pagesCrawled": 3,
  "finishedAt": "2025-01-15T10:32:00.000Z",
  "results": {
    "font": [...],
    "tags": [...],
    "performance": [...]
  }
}
```

#### Download PDF Report
```bash
curl http://localhost:3000/api/scans/<scanId>/pdf -o report.pdf
```

---

### Method 2: Using the Web UI

#### View Progress Page
1. Open browser: `http://localhost:3000/results.html?scanId=<your-scan-id>`
2. Watch real-time progress updates
3. Click "📄 Export PDF" when complete

---

### Method 3: Using Postman

#### Import Collection
Create a new request:
- **Method:** POST
- **URL:** `http://localhost:3000/api/scans`
- **Headers:** `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "url": "https://example.com",
  "options": {
    "maxPages": 5,
    "analyzers": ["font", "tags", "performance"]
  }
}
```

---

## 🧪 Test Script (Automated)

I'll create a Node.js test script for you:

```javascript
// Save as test-scan.js
const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testScan() {
  try {
    console.log('🚀 Starting scan test...\n');

    // 1. Create scan
    console.log('📝 Creating scan...');
    const createResponse = await axios.post(`${API_BASE}/api/scans`, {
      url: 'https://fonts.google.com',
      options: {
        maxPages: 2,
        analyzers: ['font', 'tags', 'performance']
      }
    });

    const { scanId } = createResponse.data;
    console.log(`✅ Scan created: ${scanId}\n`);

    // 2. Poll for progress
    console.log('⏳ Monitoring progress...');
    let status = 'queued';
    let lastProgress = 0;

    while (status !== 'done' && status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s

      const statusResponse = await axios.get(`${API_BASE}/api/scans/${scanId}`);
      const data = statusResponse.data;

      status = data.status;
      const progress = data.progress || 0;

      if (progress !== lastProgress) {
        console.log(`   Progress: ${progress}% (${status})`);
        lastProgress = progress;
      }
    }

    console.log(`\n✅ Scan ${status}!\n`);

    // 3. Get results
    if (status === 'done') {
      const resultsResponse = await axios.get(`${API_BASE}/api/scans/${scanId}`);
      const results = resultsResponse.data.results;

      console.log('📊 Results Summary:');
      console.log(`   - Font Analysis: ${results.font ? '✅' : '❌'}`);
      console.log(`   - Tag Analysis: ${results.tags ? '✅' : '❌'}`);
      console.log(`   - Performance: ${results.performance ? '✅' : '❌'}`);

      // 4. Download PDF
      console.log('\n📄 Downloading PDF...');
      const pdfResponse = await axios.get(`${API_BASE}/api/scans/${scanId}/pdf`, {
        responseType: 'arraybuffer'
      });

      const fs = require('fs');
      fs.writeFileSync(`scan-${scanId}.pdf`, pdfResponse.data);
      console.log(`✅ PDF saved: scan-${scanId}.pdf`);

      console.log(`\n🎉 Test completed successfully!`);
      console.log(`   View results: http://localhost:3000/results.html?scanId=${scanId}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testScan();
```

---

## 🔍 What to Test

### 1. Enhanced Font Analyzer
**Test URL:** https://fonts.google.com

**What to verify:**
- ✅ Detects Google Fonts provider
- ✅ Lists font families and variants
- ✅ Calculates font health score
- ✅ Shows recommendations if issues found

### 2. Tag Analyzer
**Test URL:** https://analytics.google.com

**What to verify:**
- ✅ Detects Google Analytics, GTM
- ✅ Shows tag health score
- ✅ Identifies duplicates if present
- ✅ Checks consent management

### 3. Performance Analyzer
**Test URL:** https://example.com

**What to verify:**
- ✅ Detects render-blocking resources
- ✅ Calculates page weight
- ✅ Shows CSS/JS file counts
- ✅ Performance score calculated
- ✅ Recommendations provided

### 4. Multi-Page Crawler
**Test URL:** https://fonts.google.com

**What to verify:**
- ✅ Discovers multiple pages (set maxPages: 5)
- ✅ Respects maxPages limit
- ✅ Tries sitemap.xml
- ✅ Stays on same domain

### 5. PDF Export
**After scan completes:**
- ✅ PDF downloads successfully
- ✅ Free tier watermark appears
- ✅ All sections render correctly
- ✅ Scores and recommendations visible

---

## 🐛 Common Issues & Fixes

### Issue: "Cannot read database"
**Fix:**
```bash
mkdir -p data
npm run dev
```

### Issue: "Port 3000 already in use"
**Fix:**
```bash
# Kill existing process
npx kill-port 3000
npm run dev
```

### Issue: Scan stays at 0%
**Check:**
1. Server logs for errors
2. Database connection
3. URL is accessible (not localhost)

### Issue: PDF export fails
**Fix:**
```bash
# Install Playwright browsers
npx playwright install chromium
```

---

## 📊 Database Inspection

### View all scans
```bash
sqlite3 data/fontscanner.db "SELECT id, target_url, status, progress FROM scans;"
```

### View scan results
```bash
sqlite3 data/fontscanner.db "SELECT scan_id, result_type FROM scan_results;"
```

### Clear test data
```bash
sqlite3 data/fontscanner.db "DELETE FROM scans; DELETE FROM scan_results;"
```

---

## 🎯 Expected Performance

- **Scan creation:** < 300ms
- **Single page analysis:** 10-20 seconds
- **Multi-page (5 pages):** 30-60 seconds
- **PDF generation:** 2-5 seconds

---

## 📸 Screenshots to Verify

1. **Progress UI** - Real-time progress bar updating
2. **Results Page** - All analyzer tabs visible
3. **PDF Report** - Professional formatting, watermark on free tier
4. **Console Logs** - No errors during scan

---

## ✅ Success Checklist

- [ ] Server starts without errors
- [ ] Database initializes successfully
- [ ] Can create scan via API
- [ ] Progress updates in real-time
- [ ] Scan completes successfully
- [ ] Results include all analyzers
- [ ] PDF exports with watermark
- [ ] Results page displays correctly
- [ ] No SSRF vulnerabilities (blocks localhost)
- [ ] Rate limiting works (3 scans max in 24h)

---

## 🚀 Ready for Production?

Before deploying:
1. ✅ Set environment variables (NODE_ENV=production)
2. ✅ Configure database path
3. ✅ Set up proper rate limiting
4. ⏳ Add Stripe integration
5. ⏳ Implement user authentication
6. ⏳ Set up monitoring (Sentry, etc.)
