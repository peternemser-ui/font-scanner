# Plan: Internationalize Report Content

## Status: Infrastructure Complete ✅

### Completed
- [x] Created `src/public/js/report-i18n.js` - shared translation utility
- [x] Added `reports` namespace to `en.json` with ~200 translation keys
- [x] Updated `enhanced-fonts-script.js` as reference implementation
- [x] Audited all 17 analyzer scripts (~2,700+ strings total)

### Remaining
- [ ] Continue replacing hardcoded strings in enhanced-fonts-script.js (~400 more strings)
- [ ] Update remaining 16 analyzer scripts to use t() helper

### Translations Added ✅
- [x] Added translations to es.json (Spanish) - 43 common, 17 analyzers, 19 mode labels
- [x] Added translations to fr.json (French) - 43 common, 17 analyzers, 19 mode labels
- [x] Added translations to de.json (German) - 43 common, 17 analyzers, 19 mode labels
- [x] Added translations to pt.json (Portuguese) - 43 common, 17 analyzers, 19 mode labels
- [x] Added translations to zh.json (Chinese) - 43 common, 17 analyzers, 19 mode labels
- [x] Added translations to ja.json (Japanese) - 43 common, 17 analyzers, 19 mode labels

Script created: `scripts/add-reports-i18n.js` - can be used to add more translations in the future

---

## Problem
The site UI is translated (nav, page headers, buttons) but report content remains hardcoded in English. When users switch to French/Chinese/etc., reports still display English text like "Fonts & Typography Report", "Font Families", "Page Screenshot", etc.

## Scope - All 17 Analyzer Scripts

| Analyzer | Script File | Strings Found | Priority |
|----------|-------------|---------------|----------|
| Enhanced Fonts | `enhanced-fonts-script.js` | ~450 | High |
| SEO | `seo-script.js` | ~280 | High |
| Performance Hub | `performance-hub-script.js` | ~127 | High |
| Accessibility | `accessibility-script.js` | ~274 | High |
| Security | `security-script.js` | ~214 | High |
| Core Web Vitals | `cwv-script.js` | ~87 | Medium |
| Mobile | `mobile-analyzer-script.js` | ~200 | Medium |
| Broken Links | `broken-links-script.js` | ~200 | Medium |
| Brand Consistency | `brand-consistency-script.js` | ~230 | Medium |
| Competitive Analysis | `competitive-script.js` | ~127 | Medium |
| CRO | `cro-script.js` | ~150 | Medium |
| GDPR Compliance | `gdpr-compliance-script.js` | ~186 | Medium |
| Hosting Analyzer | `hosting-analyzer-script.js` | ~100 | Low |
| IP Reputation | `ip-reputation-script.js` | ~156 | Low |
| Local SEO | `local-seo-script.js` | ~100 | Low |
| Site Crawler | `site-crawler-script.js` | ~130 | Low |
| Tag Intelligence | `tag-intelligence-script.js` | ~145 | Low |

**Total: ~2,700+ strings** (higher than original estimate)

---

## Implementation Pattern

### 1. Include report-i18n.js in HTML

Add after i18n.js in any analyzer HTML page:
```html
<script src="/js/report-i18n.js"></script>
```

### 2. Add t() helper at top of analyzer script

```javascript
// i18n translation helper - uses reportI18n if available
const t = (key, fallback, params) => {
  if (window.reportI18n && typeof window.reportI18n.t === 'function') {
    return window.reportI18n.t(key, fallback, params);
  }
  let value = fallback || key;
  if (params && typeof value === 'string') {
    Object.keys(params).forEach(param => {
      value = value.replace(new RegExp(`\\{\\{?${param}\\}?\\}`, 'g'), params[param]);
    });
  }
  return value;
};
```

### 3. Replace hardcoded strings

**Before:**
```javascript
html += `<h2>Fonts & Typography Report</h2>`;
html += `<div class="section-title">Font Families</div>`;
title: 'Report and Recommendations',
```

**After:**
```javascript
html += `<h2>${t('reports.fonts.title', 'Fonts & Typography Report')}</h2>`;
html += `<div class="section-title">${t('reports.fonts.fontFamilies', 'Font Families')}</div>`;
title: t('reports.common.reportRecommendations', 'Report and Recommendations'),
```

### 4. Add keys to en.json

Keys follow namespace pattern: `reports.{analyzer}.{key}` or `reports.common.{key}`

See `src/public/i18n/en.json` for full key structure.

---

## Translation Key Structure (en.json)

```json
{
  "reports": {
    "common": {
      "pageScreenshot": "Page Screenshot",
      "screenshotUnavailable": "Screenshot unavailable",
      "unlockReport": "Unlock Report",
      "unlockReportSubtitle": "PDF export, share link...",
      "reportRecommendations": "Report and Recommendations",
      "fixCode": "Fix Code + Recommendations",
      "tabs": { "summary": "Summary", "code": "Code", "guide": "Fix Guide" },
      "priority": { "critical": "Critical", "high": "High", ... },
      "status": { "excellent": "Excellent", "good": "Good", ... },
      "fix": { "currentIssue": "Current Issue", ... }
    },
    "fonts": { "title": "Fonts & Typography Report", ... },
    "seo": { "title": "SEO Analysis Report", ... },
    "security": { "title": "Security Analysis Report", ... },
    "accessibility": { "title": "Accessibility Report", ... },
    "performance": { "title": "Performance Report", ... },
    "cwv": { "title": "Core Web Vitals Report", ... },
    "mobile": { "title": "Mobile Testing Report", ... },
    "brokenLinks": { "title": "Broken Link Analysis", ... },
    "brand": { "title": "Brand Analysis Report", ... },
    "competitive": { "title": "Competitive Analysis Report", ... },
    "cro": { "title": "CRO Report: Conversion Optimization", ... },
    "gdpr": { "title": "Privacy Compliance Analysis", ... },
    "hosting": { "title": "Hosting Analysis Results", ... },
    "ipReputation": { "title": "IP Reputation Analysis", ... },
    "localSeo": { "title": "Local SEO Report", ... },
    "siteCrawler": { "title": "Site Crawler Report", ... },
    "tagIntelligence": { "title": "Tag Intelligence Report", ... }
  }
}
```

---

## Execution Order

### Phase 1: Infrastructure ✅ COMPLETE
- [x] Add `reports` namespace structure to `en.json`
- [x] Create shared `report-i18n.js` utility
- [x] Update `enhanced-fonts-script.js` as reference (partial)

### Phase 2: High Priority Analyzers
- [ ] Complete `enhanced-fonts-script.js` (~400 strings remaining)
- [ ] `seo-script.js` (~280 strings)
- [ ] `performance-hub-script.js` (~127 strings)
- [ ] `accessibility-script.js` (~274 strings)
- [ ] `security-script.js` (~214 strings)

### Phase 3: Medium Priority
- [ ] `cwv-script.js` (~87 strings)
- [ ] `mobile-analyzer-script.js` (~200 strings)
- [ ] `broken-links-script.js` (~200 strings)
- [ ] `brand-consistency-script.js` (~230 strings)
- [ ] `competitive-script.js` (~127 strings)
- [ ] `cro-script.js` (~150 strings)
- [ ] `gdpr-compliance-script.js` (~186 strings)

### Phase 4: Low Priority + Translations
- [ ] `hosting-analyzer-script.js` (~100 strings)
- [ ] `ip-reputation-script.js` (~156 strings)
- [ ] `local-seo-script.js` (~100 strings)
- [ ] `site-crawler-script.js` (~130 strings)
- [ ] `tag-intelligence-script.js` (~145 strings)
- [ ] Add French translations
- [ ] Add Chinese translations
- [ ] Add Spanish, German, Portuguese, Japanese translations

---

## Testing Checklist

For each analyzer:
- [ ] All visible text uses i18n
- [ ] Fallback to English works when translation missing
- [ ] Language switch updates report content
- [ ] PDF export includes translated text
- [ ] No broken layouts from longer translated text

---

## Notes

- Some strings are dynamically generated (scores, counts) - only translate labels
- Keep English as source of truth in code (fallback)
- Use `{{param}}` syntax for interpolation
- May need to adjust CSS for languages with longer text (German, French)
- PDF exports will need to use the same t() pattern
