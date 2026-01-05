# PDF Export Testing Guide

## Quick Start Testing

### 1. Start the Server

```bash
npm start
```

### 2. Test Performance/Speed & UX Page

1. Navigate to: `http://localhost:3000/performance-hub.html`
2. Enter a URL (e.g., `https://vail.com`)
3. Click "ANALYZE" and wait for results
4. Scroll down to find the "📄 Download PDF Report" button
5. Click the button
6. Wait 3-5 seconds for PDF generation
7. PDF should automatically download

### 3. Verify PDF Quality

Open the downloaded PDF and check:

- ✅ **Header Section**
  - "[SITE MECHANIC]" title visible
  - Report subtitle shows "Speed & UX Report"
  - URL and generation date displayed

- ✅ **Content Expansion**
  - All accordion sections are expanded
  - All `<details>` elements show their content
  - No collapsed sections

- ✅ **Styling**
  - White background with black text
  - Good contrast and readability
  - Score badges maintain their colors (green/yellow/red)
  - No dark backgrounds bleeding through

- ✅ **Multi-Page Layout**
  - If content is long, check multiple pages exist
  - Headers appear on every page
  - Footer shows "Page X of Y"
  - Content doesn't get cut off mid-sentence

- ✅ **Issues & Recommendations**
  - All issues are visible (none hidden)
  - Recommendations are expanded
  - Priority levels are color-coded

### 4. Test Other Analyzer Pages

Repeat the same test for:

**SEO Analyzer:**
- URL: `http://localhost:3000/seo-analyzer.html`
- Button: Should appear after analysis
- Expected subtitle: "SEO Analysis Report"

**Security Analyzer:**
- URL: `http://localhost:3000/security-analyzer.html`
- Button: Should appear after analysis
- Expected subtitle: "Security Analysis Report"

**Accessibility Analyzer:**
- URL: `http://localhost:3000/accessibility-analyzer.html`
- Button: Should appear after analysis
- Expected subtitle: "Accessibility Analysis Report"

**Mobile Analyzer:**
- URL: `http://localhost:3000/mobile-analyzer.html`
- Button: Should appear after analysis
- Expected subtitle: "Mobile Optimization Report"

## Common Issues & Fixes

### Issue 1: Button Not Found

**Problem:** "Download PDF Report" button is missing

**Solution:**
- Check if the button exists in the page's HTML
- May need to add button to results section
- Check `#exportPdfBtn` element exists

**Quick Fix:** Add button to results section:
```html
<button id="exportPdfBtn" class="btn btn-primary" style="margin-top: 1rem;">
  📄 Download PDF Report
</button>
```

### Issue 2: Accordions Still Collapsed

**Problem:** Some sections remain collapsed in PDF

**Solution:**
- Check browser console for errors
- Verify pdf-export-utility.js is loaded
- Custom accordion patterns may need to be added to utility

**Debug:**
```javascript
// In browser console:
console.log(typeof PDFExportUtility); // should be 'function'
```

### Issue 3: Content Cut Off

**Problem:** Content gets cut in middle of text

**Solution:**
- This is handled automatically by multi-page splitting
- If still occurs, check for very large images or elements
- May need to add `page-break-inside: avoid` to specific elements

### Issue 4: Poor Image Quality

**Problem:** PDF looks blurry

**Solution:** Increase scale factor in the export function:
```javascript
// In performance-hub.html or other page
const exporter = new PDFExportUtility({
  scale: 3, // Increase from 2 to 3
  // ... other options
});
```

### Issue 5: Libraries Not Loading

**Problem:** Console shows "PDFExportUtility is not defined"

**Solution:**
1. Check network tab for failed script loads
2. Verify paths are correct: `/pdf-export-utility.js`
3. Check server is serving static files from `/src/public/`
4. Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

## Browser Console Tests

### Test 1: Check Libraries Loaded

```javascript
// Open browser console (F12) and run:
console.log('html2canvas:', typeof html2canvas);    // should be 'object'
console.log('jsPDF:', typeof jspdf);                // should be 'object'
console.log('PDFExportUtility:', typeof PDFExportUtility); // should be 'function'
console.log('initPDFExport:', typeof initPDFExport);       // should be 'function'
```

### Test 2: Manual PDF Export

```javascript
// Create and trigger export manually:
const exporter = new PDFExportUtility({
  filename: 'test-report.pdf',
  reportSubtitle: 'Test Report',
  url: 'https://example.com'
});

// Find results content (adjust selector as needed)
const content = document.querySelector('#resultsContent, #results, #seoResults');
const button = document.querySelector('#exportPdfBtn');

if (content && button) {
  exporter.export(content.id.startsWith('#') ? content.id : '#' + content.id, button)
    .then(() => console.log('✅ PDF exported successfully'))
    .catch(err => console.error('❌ PDF export failed:', err));
} else {
  console.error('Content or button not found');
  console.log('Content:', content);
  console.log('Button:', button);
}
```

### Test 3: Check Content Selector

```javascript
// Find what content will be exported:
const selectors = [
  '#resultsContent',
  '#results',
  '#seoResults',
  '#cwvResults',
  '.results-container'
];

selectors.forEach(sel => {
  const el = document.querySelector(sel);
  console.log(sel, ':', el ? '✅ Found' : '❌ Not found', el);
});
```

## Performance Testing

### Measure Export Time

```javascript
console.time('PDF Export');

// Trigger export, then in the console when done:
console.timeEnd('PDF Export');

// Expected: 3-7 seconds for typical report
```

### Check Memory Usage

1. Open Chrome DevTools > Performance tab
2. Click "Record"
3. Trigger PDF export
4. Stop recording when PDF downloads
5. Check memory usage spike (should be < 200MB)

## Advanced Testing

### Test with Different Content Sizes

1. **Small Report** - Quick scan with minimal results
2. **Medium Report** - Full scan with moderate results
3. **Large Report** - Comprehensive scan with many issues

### Test Accordion Patterns

Create a test page with various accordion styles:

```html
<!-- Test different accordion patterns -->
<details>
  <summary>Test Details Element</summary>
  <p>This should appear in PDF</p>
</details>

<div class="accordion__content" style="display: none;">
  This should be expanded in PDF
</div>

<div data-accordion-content style="display: none;">
  This should also be expanded
</div>
```

## Automated Testing Script

Create `test-pdf-export.js`:

```javascript
const puppeteer = require('puppeteer');

async function testPDFExport() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to analyzer
  await page.goto('http://localhost:3000/performance-hub.html');

  // Enter URL
  await page.type('#urlInput', 'https://example.com');

  // Click analyze
  await page.click('button[id*="Analyze"]');

  // Wait for results (adjust timeout as needed)
  await page.waitForSelector('#resultsContent', { timeout: 60000 });

  // Wait for export button
  await page.waitForSelector('#exportPdfBtn');

  // Click export (this will trigger download)
  await page.click('#exportPdfBtn');

  // Wait for PDF generation
  await page.waitForTimeout(5000);

  console.log('✅ PDF export test completed');

  await browser.close();
}

testPDFExport().catch(console.error);
```

## Success Criteria

Your PDF export is working correctly if:

- ✅ PDF downloads automatically
- ✅ Filename includes report type and date
- ✅ All accordions are expanded
- ✅ Content is readable (white bg, black text)
- ✅ Multiple pages if content is long
- ✅ Headers on all pages
- ✅ Page numbers in footer
- ✅ Score badges retain colors
- ✅ No console errors
- ✅ Generation completes in < 10 seconds

## Reporting Issues

If you find issues:

1. Note the specific page (e.g., performance-hub.html)
2. Check browser console for errors
3. Note what content is missing/incorrect
4. Take screenshot of both web page and PDF
5. Check if issue is consistent across browsers

## Next Steps

Once basic testing is complete:

1. Test on all integrated pages
2. Try with different websites
3. Test edge cases (very long content, many images, etc.)
4. Consider adding export buttons to remaining pages
5. Gather user feedback on PDF quality

---

**Happy Testing!** 🎉

If you encounter any issues, refer to the [PDF Export Implementation Summary](PDF_EXPORT_IMPLEMENTATION_SUMMARY.md) for troubleshooting tips.
