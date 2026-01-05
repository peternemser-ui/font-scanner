# PDF Export Integration Guide

## Overview

The new PDF export system provides:
- ✅ Automatic accordion/details expansion
- ✅ Print-friendly styling
- ✅ Multi-page support with proper page breaks
- ✅ Consistent branding across all reports
- ✅ Easy integration into any analyzer page

## Files Created

1. **pdf-export-utility.js** - Core PDF generation utility
2. **pdf-export-styles.css** - Print-friendly CSS styles
3. **pdf-export-integration.js** - Easy integration helper

## Quick Integration (3 Steps)

### Step 1: Add Required Libraries (if not already present)

Add these scripts before your closing `</body>` tag:

```html
<!-- PDF Libraries -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

<!-- PDF Export System -->
<script src="/pdf-export-utility.js"></script>
<script src="/pdf-export-integration.js"></script>
```

### Step 2: Add Styles

Add this in the `<head>` section:

```html
<!-- PDF Export Styles -->
<link rel="stylesheet" href="/pdf-export-styles.css">
```

### Step 3: Add Export Button

Add a button to trigger PDF export:

```html
<button id="exportPdfBtn" class="btn btn-primary">
  📄 Download PDF Report
</button>
```

### Step 4: Initialize (Auto or Manual)

#### Option A: Automatic Initialization

Add data attribute to `<body>`:

```html
<body data-pdf-export="auto">
```

This will automatically detect content and set up PDF export.

#### Option B: Manual Initialization

Add this script:

```html
<script>
  document.addEventListener('DOMContentLoaded', () => {
    initPDFExport({
      contentSelector: '#resultsContent',
      buttonSelector: '#exportPdfBtn',
      reportSubtitle: 'Speed & UX Report'
    });
  });
</script>
```

## Advanced Configuration

```javascript
initPDFExport({
  // Selector for content to export
  contentSelector: '#resultsContent',

  // Selector for export button
  buttonSelector: '#exportPdfBtn',

  // Report subtitle (appears in header)
  reportSubtitle: 'Speed & UX Report',

  // Filename (optional, auto-generated if not provided)
  filename: 'custom-report.pdf',

  // Selector for URL input (optional)
  urlInputSelector: '#urlInput',

  // Callbacks
  onBeforeExport: async () => {
    console.log('Starting export...');
    // Custom logic before export
  },

  onAfterExport: async () => {
    console.log('Export complete!');
    // Custom logic after export
  }
});
```

## Direct Usage (Without Integration Helper)

```javascript
async function exportToPDF() {
  const exporter = new PDFExportUtility({
    filename: 'my-report.pdf',
    reportTitle: 'Site Mechanic',
    reportSubtitle: 'Web Analysis Report',
    url: 'https://example.com',
    scale: 2,
    pageFormat: 'a4'
  });

  const button = document.getElementById('exportPdfBtn');
  await exporter.export('#resultsContent', button);
}
```

## Features

### Automatic Accordion Expansion

The PDF export automatically finds and expands:
- `<details>` elements
- `.accordion__content`
- `.collapsible__content`
- `[data-accordion-content]`
- Hidden sections (`.hidden`, `display: none`)
- Any elements with `aria-expanded="false"`

### Print-Friendly Styling

When in PDF export mode, the content:
- Uses white background with black text
- Hides navigation, buttons, and interactive elements
- Applies readable fonts and spacing
- Preserves score badge colors
- Adds proper page breaks
- Formats tables, lists, and code blocks

### Multi-Page Support

Long content automatically splits across multiple pages with:
- Consistent headers on each page
- Page numbers in footer
- Proper content slicing (no text cutoffs)

## Pages Already Integrated

✅ [performance-hub.html](src/public/performance-hub.html) - Speed & UX / Core Web Vitals

## Pages to Integrate

The following pages should be updated to use the new PDF export system:

- [ ] seo-analyzer.html
- [ ] security-analyzer.html
- [ ] accessibility-analyzer.html
- [ ] mobile-analyzer.html
- [ ] enhanced-fonts.html
- [ ] broken-links.html
- [ ] brand-consistency.html
- [ ] competitive-analysis.html
- [ ] cro-analyzer.html
- [ ] local-seo.html
- [ ] ip-reputation-analyzer.html
- [ ] gdpr-compliance.html
- [ ] tag-intelligence.html
- [ ] hosting-analyzer.html

## Troubleshooting

### Button doesn't respond

1. Check that libraries are loaded:
   ```javascript
   console.log(typeof PDFExportUtility); // should be 'function'
   console.log(typeof initPDFExport);    // should be 'function'
   ```

2. Check browser console for errors

3. Verify button selector is correct:
   ```javascript
   console.log(document.querySelector('#exportPdfBtn')); // should find button
   ```

### Content not visible in PDF

1. Check content selector:
   ```javascript
   console.log(document.querySelector('#resultsContent')); // should find content
   ```

2. Ensure content has been populated (run analysis first)

3. Check if content is hidden (`display: none`)

### Accordions still collapsed

The utility should automatically expand all accordions. If they remain collapsed:

1. Check that your accordion structure uses standard patterns
2. Add custom selectors in `pdf-export-utility.js` (line 45-51)
3. Use data attribute: `data-accordion-content` on expandable sections

### Styling issues

1. Check that `pdf-export-styles.css` is loaded
2. Add custom styles targeting `.pdf-export-mode` class
3. Use `!important` to override existing styles if needed

## Custom Styling

Add custom print styles for your content:

```css
.pdf-export-mode .my-custom-section {
  background: #ffffff !important;
  color: #000000 !important;
  page-break-inside: avoid;
}
```

## Testing

1. Run analysis on any analyzer page
2. Click "Download PDF Report"
3. Verify:
   - All accordions are expanded
   - Content is readable with good contrast
   - Multi-page content splits properly
   - Headers and footers appear on all pages

## Support

For issues or questions:
- Check browser console for errors
- Verify all required libraries are loaded
- Test with simple content first
- Review the integration examples above
