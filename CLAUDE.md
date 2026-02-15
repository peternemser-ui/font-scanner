# Site Mechanic (font-scanner) — Project Instructions

## Tech Stack

- **Runtime**: Node.js (>= 16), Express 4.18
- **Database**: SQLite3 (WAL mode), file at `./data/fontscanner.db`
- **Frontend**: Vanilla JavaScript (no framework), CSS variables for design tokens
- **PDF Generation**: Puppeteer (headless Chrome renders HTML templates to PDF)
- **Browser Automation**: Puppeteer + Playwright (scanning), Lighthouse 11 (performance audits)
- **Payments**: Stripe (subscriptions, day passes, single-report purchases)
- **Auth**: JWT (jsonwebtoken)
- **Testing**: Jest 29, Supertest
- **i18n**: Custom lightweight system — 8 locales (en, es, fr, de, pt, ja, zh, ru)
- **No TypeScript, no bundler** — Express serves static files directly

## Key File Paths

| Area | Path |
|---|---|
| Server entry point | `src/server.js` |
| Config | `src/config/index.js`, `src/config/pricing.js` |
| Controllers | `src/controllers/*Controller.js` |
| Services / analyzers | `src/services/*Service.js` |
| PDF generators (server-side PDFKit) | `src/services/*PdfGenerator.js` |
| Routes | `src/routes/*.js` |
| Middleware | `src/middleware/*.js` |
| Database schema | `src/db/schema.sql` |
| Migrations | `src/db/migrations/*.sql` |
| **Entitlements resolver (SSOT)** | `src/utils/entitlements.js` |
| Report scripts (frontend) | `src/public/*-script.js` |
| i18n locale files | `src/public/i18n/{locale}.json` |
| i18n system loader | `src/public/i18n.js` |
| PDF HTML templates | `src/public/pdf-templates/{report-type}.html` |
| PDF render scripts | `src/public/pdf-templates/{report-type}-render.js` |
| Shared PDF engine | `src/public/pdf-templates/_pdf-report.js` |
| PDF styles | `src/public/pdf-templates/_pdf-report.css` |
| Design tokens | `src/public/css/design-tokens.css` |
| ReportShell component | `src/public/js/components/reportShell.js` |
| ReportAccordion component | `src/public/js/components/reportAccordion.js` |
| PageShell component | `src/public/js/components/PageShell.js` |
| ScreenshotLightbox | `src/public/js/components/ScreenshotLightbox.js` |
| ProReportBlock (paywall) | `src/public/js/components/ProReportBlock.js` |
| Report UI (global) | `src/public/js/report-ui.js` |
| Stripe service | `src/services/stripeService.js` |
| Webhook handlers | `src/routes/webhooks.js` |
| Scan quota middleware | `src/middleware/scanQuota.js` |
| Tests | `tests/` (unit, integration, services, middleware, frontend) |

## Project Invariants (MUST be enforced)

These are non-negotiable rules that every code change must respect:

1. **Page Screenshot** — Every report page MUST render a screenshot section (`.screenshot-section`) after the report header and before summary donuts. Uses `screenshotUrl` from API response, falls back to `data-sm-screenshot-url` body attribute or `/reports/{reportId}/screenshot.jpg`. Includes `onerror` placeholder and ScreenshotLightbox click handler.

2. **Light Background Reports** — All report surfaces use light backgrounds (`#F8F9FA` shell, `#FFFFFF` cards) regardless of any site-wide dark mode. Print styles enforce this too.

3. **Module Count >= 6** — Reports must render at least 6 distinct content modules/sections.

4. **i18n Everywhere** — All user-facing strings use the `t(key, fallback)` helper. No hardcoded English in report output. All 8 locale files must be updated together.

5. **Server-Side Entitlements** — All gating decisions go through `src/utils/entitlements.js`. The client receives a minimal entitlement state and only renders based on it — never decides access.

6. **No Mixed Languages** — A report page must be entirely in one language. The language is captured at scan start, persisted with the report, and used by all consumers (UI, PDF, AI content).

7. **Idempotent Webhooks** — Stripe webhook handlers check `event.id` for deduplication and use atomic DB transactions.

## Common Patterns

### i18n Translation
```javascript
// Frontend — every report script defines this helper
function t(key, fallback, params) {
  if (window.i18n?.t) return window.i18n.t(key, params) || fallback;
  return fallback;
}
```

### Report Display Function Structure
Every `display*Results(data)` function in a report script follows this pattern:
1. Extract/normalize data from API response
2. Build `screenshotUrl` (API → body attribute → report ID fallback)
3. Build `screenshotHTML` with i18n, onerror, clickable image
4. Build `summaryDonuts` via `ReportShell.renderSummaryDonuts()`
5. Build `accordions` via `ReportAccordion.createSection()` calls
6. Compose final HTML: `reportHeader → screenshotHTML → summaryDonuts → accordions → summary → takeAction`
7. Set `resultsContent.innerHTML`
8. Attach screenshot lightbox click handler
9. Call `ReportAccordion.initInteractions()`, `animateScoreRings()`, `scrollToResults()`

### PDF Template Registration
```javascript
// In src/public/pdf-templates/{report-type}-render.js
PdfReport.register('seo', function renderSEO(data, utils) {
  // utils provides: t(), esc(), scoreColor(), scoreClass(), formatDate()
  document.querySelector('#section-meta-tags').innerHTML = buildMetaTagsHTML(data);
});
```

### Entitlements Check
```javascript
// Server-side — the only way to check access
const entitlements = resolveEntitlements(userId);
if (!entitlements.permissions.exportReports) return res.status(403).json({ error: 'Upgrade required' });
```

## Commands

```bash
npm run dev          # Dev server with nodemon
npm start            # Production server
npm test             # Run Jest tests
npm run lint         # ESLint
npm run i18n:audit   # Check i18n key completeness
```

## Available Specialist Agents

| Agent | Purpose | Model |
|---|---|---|
| `orchestrator-planner` | Decompose complex requests into sub-tasks assigned to specialist agents | opus |
| `entitlements-pro-gating` | Billing model, gating rules, client entitlement state, Pro UI components | opus |
| `stripe-webhooks-engineer` | Stripe webhook handlers, event processing, idempotency (references entitlements model) | opus |
| `i18n-language-lock` | Language consistency across UI, PDF, AI content — zero mixed-language tolerance | opus |
| `pdf-fidelity-auditor` | PDF export completeness, print CSS, visual fidelity vs. screen | opus |
| `report-shell-design-system` | Report layout, design tokens, typography, card system, light-background rule | sonnet |
| `report-data-completeness` | Schema validation, placeholder rendering, retry logic for report data | sonnet |
| `qa-harness-regression` | Automated regression tests: module count, language lock, screenshots, Pro state, PDF, print | sonnet |
| `accessibility-auditor` | WCAG 2.1 AA/AAA audit — headings, contrast, focus, keyboard, print/PDF | sonnet |
| `ux-billing-copy` | User-facing microcopy for billing states, paywalls, unlock flows, timers | sonnet |
