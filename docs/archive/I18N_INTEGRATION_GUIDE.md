# 🌐 Internationalization (i18n) Integration Guide

## Overview

This guide shows you how to add multi-language support to pages in the Font Scanner application. The system supports 7 languages:

- 🇬🇧 English (en)
- 🇪🇸 Spanish (es)
- 🇫🇷 French (fr)
- 🇩🇪 German (de)
- 🇵🇹 Portuguese (pt)
- 🇨🇳 Chinese (zh)
- 🇯🇵 Japanese (ja)

## Files Structure

```
src/public/
├── i18n.js                    # Core i18n library
├── language-switcher.js       # Language switcher UI component
└── i18n/                      # Translation files
    ├── en.json
    ├── es.json
    ├── fr.json
    ├── de.json
    ├── pt.json
    ├── zh.json
    └── ja.json
```

## Integration Steps

### 1. Add Scripts to HTML

Add these scripts to your HTML `<head>` section (before other scripts):

```html
<!-- i18n Support -->
<script src="/i18n.js"></script>
<script src="/language-switcher.js"></script>
```

### 2. Add `data-i18n` Attributes

Replace hardcoded text with `data-i18n` attributes:

####Before:
```html
<h1>Dashboard</h1>
<button>ANALYZE WEBSITE</button>
<input placeholder="Enter URL...">
```

#### After:
```html
<h1 data-i18n="nav.dashboard"></h1>
<button data-i18n="fontScanner.analyzeWebsite"></button>
<input data-i18n-placeholder="fontScanner.enterUrl">
```

### 3. Available `data-i18n` Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-i18n` | Translate element's text content | `<span data-i18n="common.loading"></span>` |
| `data-i18n-placeholder` | Translate input placeholder | `<input data-i18n-placeholder="common.search">` |
| `data-i18n-title` | Translate element's title attribute | `<button data-i18n-title="common.help">?</button>` |
| `data-i18n-attr` | Translate custom attribute | `<div data-i18n="nav.dashboard" data-i18n-attr="aria-label">` |

### 4. Using Translations in JavaScript

```javascript
// Wait for i18n to be ready
document.addEventListener('DOMContentLoaded', async () => {
  // i18n is automatically initialized

  // Get translation
  const text = window.i18n.t('dashboard.runAudit');

  // Translation with parameters
  const message = window.i18n.t('messages.analysisStarted', {
    url: 'example.com'
  });

  // Format numbers according to locale
  const formattedNumber = window.i18n.formatNumber(1234.56);

  // Format dates according to locale
  const formattedDate = window.i18n.formatDate(new Date());
});
```

### 5. Dynamic Content Translation

For dynamically generated content:

```javascript
function createCard(title, score) {
  return `
    <div class="card">
      <h3>${window.i18n.t(title)}</h3>
      <div class="score">${score}</div>
      <button onclick="viewDetails()">${window.i18n.t('dashboard.viewDetails')}</button>
    </div>
  `;
}
```

## Complete Page Example

Here's a complete example showing how to add i18n to a page:

```html
<!DOCTYPE html>
<html lang="en" data-i18n-title="dashboard.title">
<head>
  <meta charset="UTF-8">
  <title>Dashboard</title>

  <!-- i18n Support -->
  <script src="/i18n.js"></script>
  <script src="/language-switcher.js"></script>

  <!-- Other scripts -->
  <script src="/nav-template.js"></script>
  <script src="/theme-controls.js"></script>
</head>
<body>
  <header>
    <h1 data-i18n="app.name">FONT SCANNER</h1>
    <p data-i18n="app.tagline">Advanced Web Typography & Performance Analysis</p>
  </header>

  <nav>
    <!-- Navigation links -->
    <a href="/" data-i18n="nav.dashboard">Dashboard</a>
    <a href="/index.html" data-i18n="nav.fontScanner">Font Scanner</a>
    <a href="/seo-analyzer.html" data-i18n="nav.seo">SEO</a>

    <!-- Language switcher is auto-injected here -->
  </nav>

  <main>
    <section>
      <h2 data-i18n="dashboard.overallHealth">Overall Website Health</h2>

      <input
        type="url"
        id="urlInput"
        data-i18n-placeholder="dashboard.enterUrl"
      >

      <button
        id="analyzeButton"
        data-i18n="dashboard.runAudit"
      >RUN FULL AUDIT</button>

      <div id="results"></div>
    </section>
  </main>

  <script>
    // Your page-specific JavaScript
    document.getElementById('analyzeButton').addEventListener('click', () => {
      const url = document.getElementById('urlInput').value;

      if (!url) {
        alert(window.i18n.t('errors.urlRequired'));
        return;
      }

      // Update button text during analysis
      const button = document.getElementById('analyzeButton');
      button.textContent = window.i18n.t('dashboard.analyzing');
      button.disabled = true;

      // Perform analysis...
    });
  </script>
</body>
</html>
```

## Adding New Translations

### 1. Add to Translation Files

Add the key-value pair to all language files:

**en.json:**
```json
{
  "mySection": {
    "newFeature": "New Feature",
    "description": "This is a new feature with {{count}} items"
  }
}
```

**es.json:**
```json
{
  "mySection": {
    "newFeature": "Nueva Función",
    "description": "Esta es una nueva función con {{count}} elementos"
  }
}
```

### 2. Use in HTML

```html
<h3 data-i18n="mySection.newFeature"></h3>
<p id="description"></p>

<script>
  // With parameters
  document.getElementById('description').textContent =
    window.i18n.t('mySection.description', { count: 5 });
</script>
```

## Translation Key Naming Convention

Use dot notation for nested keys:

```
section.subsection.key
```

Examples:
- `nav.dashboard` - Navigation items
- `dashboard.runAudit` - Dashboard-specific text
- `common.loading` - Common/shared text
- `errors.urlRequired` - Error messages
- `messages.analysisCompleted` - Success messages

## Language Switcher Customization

### Custom Position

By default, the language switcher is added to `<nav>`. To change:

```javascript
const switcher = new LanguageSwitcher();
switcher.init('#customSelector'); // Any CSS selector
```

### Programmatic Language Switch

```javascript
// Switch to Spanish
await window.i18n.switchLanguage('es');

// Get current language
const currentLang = window.i18n.currentLanguage;

// Get supported languages
const languages = window.i18n.getSupportedLanguages();
```

## Best Practices

1. **Always use translation keys** - Never hardcode user-facing text
2. **Use descriptive keys** - `dashboard.runAudit` not `button1`
3. **Group by section** - Keep related translations together
4. **Test all languages** - Switch between languages and verify layout
5. **Keep translations updated** - When adding features, update all language files
6. **Use parameters** - For dynamic content: `"Hello {{name}}"`
7. **Fallback behavior** - Missing translations will show the key name

## Troubleshooting

### Translation not showing

1. Check console for errors
2. Verify translation key exists in en.json
3. Ensure `data-i18n` attribute is correct
4. Make sure i18n.js is loaded before other scripts

### Language not switching

1. Check if language file exists in `/i18n/` folder
2. Verify language code in `supportedLanguages` array
3. Check browser console for loading errors

### Styles not applied to language switcher

1. Ensure `language-switcher.js` is loaded
2. Check that styles are injected (look for `<style id="language-switcher-styles">` in `<head>`)

## Next Steps

1. ✅ Add i18n scripts to all HTML pages
2. ✅ Add `data-i18n` attributes to static text
3. ✅ Update JavaScript to use `window.i18n.t()` for dynamic text
4. ✅ Test each language for layout issues
5. ✅ Expand translation files with missing keys

## Example: Dashboard Integration

See the updated `dashboard.html` file for a complete working example of i18n integration.

---

📝 **Note**: Translation files support nested objects for organization. Use dot notation to access nested keys: `window.i18n.t('section.subsection.key')`

🌐 **Adding More Languages**: To add a new language:
1. Create `/i18n/{code}.json` with translations
2. Add language code to `supportedLanguages` array in `i18n.js`
3. Add flag emoji and name to helper functions in `i18n.js`
