# 10 — Language (i18n/l10n + correctness checks)

## Status: COMPLETED

## Overview
Implemented internationalization (i18n) infrastructure with language switching, string management, server-side locale resolution, SEO language signals, and a language audit scan.

## Implementation Summary

### 1. Frontend Language Switcher
**Location:** `src/public/language-switcher.js`
- Dropdown component with 7 language options (en, es, fr, de, pt, zh, ja)
- Flag emoji indicators
- Integrated into nav header via `nav-template.js`
- Persists preference to localStorage

### 2. String Management with t() Lookups
**Location:** `src/public/i18n.js`
- `t(key)` function with dot notation for nested keys (e.g., `t('nav.dashboard')`)
- Parameter interpolation: `t('messages.count', { count: 5 })`
- Fallback to English when translation missing
- Auto-translates elements with `data-i18n` attribute

**JSON Dictionaries:** `src/public/i18n/`
- `en.json` - English (primary)
- `es.json` - Spanish
- `fr.json` - French
- `de.json` - German
- `pt.json` - Portuguese
- `zh.json` - Chinese
- `ja.json` - Japanese

### 3. Server-Side Locale Resolution
**Location:** `src/server.js` (locale middleware)
- Parses `Accept-Language` header
- Resolves to supported locale (`req.locale`)
- Available in all request handlers

### 4. SEO Language Signals
**Location:** `src/public/seo-i18n.js`
- Updates `<html lang="...">` attribute
- Generates hreflang link tags for all supported languages
- Updates og:locale and og:locale:alternate meta tags
- Updates canonical URLs per language

**i18n.js enhancement:**
- Now updates `document.documentElement.lang` on language switch

### 5. Language Audit Scan
**Location:** `src/services/languageAuditService.js`
**Endpoint:** `POST /api/scans/language-audit`

Checks:
- HTML lang attribute presence and validity
- Content-Language HTTP header
- Hreflang tag configuration
- x-default hreflang for multilingual sites
- og:locale format
- Language consistency across signals
- RTL direction attribute for RTL languages

Returns JSON with:
```json
{
  "url": "https://example.com",
  "score": 85,
  "grade": "B",
  "issues": [...],
  "checks": {...},
  "recommendations": [...],
  "timestamp": "2026-01-30T..."
}
```

## Files Modified/Created

### Created
- `src/services/languageAuditService.js` - Language audit service
- `ops/claude/10-language-i18n.md` - This documentation

### Modified
- `src/public/i18n.js` - Added html lang attribute update in translatePage()
- `src/public/i18n/en.json` - Added languageAudit translations
- `src/public/i18n/es.json` - Added languageAudit translations
- `src/routes/scan.routes.js` - Added language-audit endpoint
- `src/server.js` - Added locale resolution middleware

## Pre-existing Files (Already Implemented)
- `src/public/i18n.js` - Core i18n library
- `src/public/language-switcher.js` - Language switcher component
- `src/public/seo-i18n.js` - SEO meta tag updates
- `src/public/i18n/*.json` - Translation dictionaries

## Testing

Language audit service manual test:
```bash
curl -X POST http://localhost:3000/api/scans/language-audit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## Acceptance Criteria
- [x] Frontend language switcher with 7 options
- [x] t() lookups with JSON dictionaries
- [x] Server-side locale resolution from Accept-Language
- [x] html lang attribute updates on language change
- [x] hreflang tags generated for multilingual SEO
- [x] Language audit endpoint returning score and issues
