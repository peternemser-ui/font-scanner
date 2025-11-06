# 🚀 i18n Quick Start Guide

## What Was Created

✅ **Core System**
- `src/public/i18n.js` - Main i18n library (auto-detects language, handles translations)
- `src/public/language-switcher.js` - UI component for changing languages

✅ **Translation Files** (7 languages)
- `src/public/i18n/en.json` - English (complete)
- `src/public/i18n/es.json` - Spanish (complete)
- `src/public/i18n/fr.json` - French (complete)
- `src/public/i18n/de.json` - German (basic)
- `src/public/i18n/pt.json` - Portuguese (basic)
- `src/public/i18n/zh.json` - Chinese (basic)
- `src/public/i18n/ja.json` - Japanese (basic)

## How to Add to Any Page (3 Simple Steps)

### Step 1: Add Scripts to HTML `<head>`

```html
<head>
  <!-- Add these TWO lines before other scripts -->
  <script src="/i18n.js"></script>
  <script src="/language-switcher.js"></script>

  <!-- Your existing scripts below -->
  <script src="/nav-template.js"></script>
  <script src="/theme-controls.js"></script>
</head>
```

### Step 2: Add `data-i18n` to Static Text

**Find & Replace Pattern:**

| Before | After |
|--------|-------|
| `<h1>Dashboard</h1>` | `<h1 data-i18n="nav.dashboard"></h1>` |
| `<button>RUN FULL AUDIT</button>` | `<button data-i18n="dashboard.runAudit"></button>` |
| `<input placeholder="Enter URL...">` | `<input data-i18n-placeholder="dashboard.enterUrl">` |

### Step 3: Use `window.i18n.t()` in JavaScript

**Replace hardcoded strings:**

```javascript
// Before:
alert('Please enter a valid URL');
button.textContent = 'ANALYZING...';

// After:
alert(window.i18n.t('errors.urlRequired'));
button.textContent = window.i18n.t('dashboard.analyzing');
```

## Example: Dashboard Update

### dashboard.html Changes

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Dashboard - Comprehensive Website Analysis</title>

  <!-- ADD THESE TWO LINES -->
  <script src="/i18n.js"></script>
  <script src="/language-switcher.js"></script>

  <link rel="stylesheet" href="styles.css" />
  <script src="/nav-template.js"></script>
  <script src="/dashboard-script.js"></script>
</head>
<body>
  <div id="nav-placeholder"></div>

  <div class="container">
    <header class="form-container">
      <!-- ADD data-i18n attributes -->
      <h1 data-i18n="dashboard.title">Comprehensive Dashboard</h1>
      <p>> <span data-i18n="dashboard.breadcrumb">unified website analysis</span></p>

      <input
        type="text"
        id="dashboardUrlInput"
        data-i18n-placeholder="dashboard.enterUrl"
        placeholder="example.com"
      />

      <button
        id="dashboardAnalyzeButton"
        data-i18n="dashboard.runAudit"
      >ANALYZE</button>
    </header>

    <div id="dashboardResults"></div>
  </div>
</body>
</html>
```

### dashboard-script.js Changes

```javascript
// In your existing dashboard-script.js

async function runComprehensiveAnalysis() {
  const url = urlInput.value.trim();

  if (!url) {
    // CHANGE THIS:
    // showError('Please enter a valid URL');

    // TO THIS:
    showError(window.i18n.t('errors.urlRequired'));
    return;
  }

  // Update button text
  // CHANGE THIS:
  // submitButton.textContent = 'ANALYZING...';

  // TO THIS:
  submitButton.textContent = window.i18n.t('dashboard.analyzing');
  submitButton.disabled = true;

  // ... rest of your code
}
```

## Language Switcher

The language switcher automatically appears in your `<nav>` element! It looks like this:

```
🇬🇧 EN ▼
```

Clicking it shows all available languages. User's choice is saved to localStorage.

## Testing

1. **Open any page** with i18n added
2. **Look for the language switcher** (flag + EN in navigation)
3. **Click it and select Spanish** (Español)
4. **Watch the page content update** instantly to Spanish!
5. **Refresh the page** - it remembers your language choice

## Translation Keys Quick Reference

Common keys you'll use:

```javascript
// Navigation
window.i18n.t('nav.dashboard')
window.i18n.t('nav.fontScanner')
window.i18n.t('nav.seo')
window.i18n.t('nav.performance')

// Dashboard
window.i18n.t('dashboard.runAudit')
window.i18n.t('dashboard.analyzing')
window.i18n.t('dashboard.viewDetails')
window.i18n.t('dashboard.score')
window.i18n.t('dashboard.desktop')
window.i18n.t('dashboard.mobile')

// Common
window.i18n.t('common.loading')
window.i18n.t('common.error')
window.i18n.t('common.success')

// Errors
window.i18n.t('errors.urlRequired')
window.i18n.t('errors.networkError')

// With parameters
window.i18n.t('messages.analysisStarted', { url: 'example.com' })
```

## Next Steps

### Immediate (Today)
1. ✅ Add i18n scripts to `dashboard.html`, `index.html` (Font Scanner)
2. ✅ Add `data-i18n` attributes to headers, buttons, labels
3. ✅ Test language switching

### Short-term (This Week)
1. ⬜ Update all analyzer pages (SEO, Performance, Accessibility, Security)
2. ⬜ Add `data-i18n` to dynamic content in JavaScript
3. ⬜ Complete German, Portuguese, Chinese, Japanese translations

### Long-term
1. ⬜ Add more languages (Italian, Russian, Arabic, Hindi, etc.)
2. ⬜ Professional translation review
3. ⬜ A/B testing for different markets

## Common Translation Patterns

### Buttons
```html
<button data-i18n="dashboard.runAudit">RUN FULL AUDIT</button>
<button data-i18n="common.download">Download</button>
<button data-i18n="fontScanner.analyzeWebsite">ANALYZE WEBSITE</button>
```

### Headings
```html
<h1 data-i18n="nav.dashboard">Dashboard</h1>
<h2 data-i18n="dashboard.detailedAnalysis">Detailed Analysis</h2>
<h3 data-i18n="performance.coreWebVitals">Core Web Vitals</h3>
```

### Input Placeholders
```html
<input data-i18n-placeholder="dashboard.enterUrl" placeholder="Enter URL...">
<input data-i18n-placeholder="common.search" placeholder="Search...">
```

### Dynamic Content in JS
```javascript
// Creating cards/elements
function createAnalyzerCard(type, score) {
  return `
    <div class="card">
      <h3>${window.i18n.t(`dashboard.${type}Analysis`)}</h3>
      <div class="score">${score}</div>
      <button>${window.i18n.t('dashboard.viewDetails')}</button>
    </div>
  `;
}

// Status messages
function showStatus(analyzing) {
  const status = analyzing
    ? window.i18n.t('dashboard.analyzing')
    : window.i18n.t('dashboard.runAudit');
  document.getElementById('status').textContent = status;
}
```

## Pro Tips

💡 **Auto-complete in VS Code**: Translation keys show up in autocomplete if you type `window.i18n.t('`

💡 **Missing translations**: If a key doesn't exist, it shows the key name (e.g., "dashboard.newFeature"), making it easy to spot

💡 **Browser language**: The system automatically detects the user's browser language on first visit

💡 **Testing**: Hold Shift while clicking the language switcher to reload the page (helps test full translation coverage)

## File Sizes

- `i18n.js`: ~6KB
- `language-switcher.js`: ~8KB
- Each translation file: ~2-4KB
- **Total overhead**: ~20KB (minified: ~8KB)

## Browser Support

✅ Works in all modern browsers (Chrome, Firefox, Safari, Edge)
✅ Falls back to English if translation missing
✅ No external dependencies

---

**Ready to start?** Just add those 2 script tags and start adding `data-i18n` attributes! 🚀
