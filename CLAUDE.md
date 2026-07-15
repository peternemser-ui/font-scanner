# Site Mechanic (font-scanner) — Project Instructions

## Tech Stack

- **Runtime**: Node.js (>= 16), Express 4.18
- **Database**: PostgreSQL only (`pg`), via `DATABASE_URL`. Dev, test and prod all use Postgres — there is no SQLite driver and no fallback; an unset/invalid `DB_DRIVER` throws at startup rather than silently writing to a local file. Tests run against a real Postgres, each suite in its own schema (`TEST_DATABASE_URL` overrides the target).
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

2. **Theme-Consistent Reports** — Report surfaces follow the page theme: dark mode uses dark report tokens (`--r-surface-1: #161A1F`, `--r-surface-2: #1C2128`), light mode uses light tokens (`#FFFFFF` cards, `#F8FAFC` shell). Print/PDF always uses light backgrounds. The `--r-*` token system in `design-tokens.css` is the single source of truth for report surface colors.

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
| `issue-fix-propagator` | Fix an issue on one page, then scan and fix all similar occurrences across every page, template, and locale | opus |
| `infra-deploy-guardian` | Docker, K8s manifests, CI/CD pipelines, zero-downtime deployments, rollback procedures | opus |
| `observability-engineer` | Structured logging, Prometheus/Grafana dashboards, OpenTelemetry tracing, alerting rules | opus |
| `security-hardening-auditor` | CSP hardening, SSRF prevention, Redis rate limiting, audit logging, OWASP Top 10 | opus |
| `perf-scalability-engineer` | Load testing, browser pool tuning, caching layers, asset optimization, horizontal scaling | opus |
| `db-migration-architect` | Schema migrations (`src/db/migrations/pg/`), backup/recovery, index optimization, Postgres performance | sonnet |
| `api-contract-guardian` | OpenAPI spec, API versioning, error standardization, request validation, contract testing | sonnet |
| `error-resilience-engineer` | Circuit breakers, retry with backoff, timeout budgets, graceful degradation, crash recovery | sonnet |
| `seo-i18n-optimizer` | Site SEO: meta tags, OG/Twitter Cards, hreflang (8 locales), sitemap, structured data, SEO parity | sonnet |
| `user-report-dashboard` | User-facing report library, scan history, report viewing/comparison, search/filter/sort, PDF export triggers, usage quota UI | sonnet |
| `admin-system-dashboard` | Admin panel: user management, system monitoring, billing debugging, test runner, audit trail, metrics | opus |

### Issue Fix & Propagate Workflow (`issue-fix-propagator`)

When the user reports an issue (bug, rendering glitch, bad string, missing element, etc.) on a specific page — often by uploading a screenshot or naming the page — follow this exact sequence:

1. **Diagnose & fix the reported page** — Read the specific report script, PDF render script, or template. Identify the root cause and apply the fix.
2. **Characterize the pattern** — Describe what the issue is in generic terms (e.g., "unescaped apostrophe in template literal", "missing `t()` wrapper on a heading", "wrong CSS class on donut container").
3. **Sweep all similar files** — Scan every file that could contain the same pattern:
   - All report scripts: `src/public/*-script.js`
   - All PDF render scripts: `src/public/pdf-templates/*-render.js`
   - All PDF HTML templates: `src/public/pdf-templates/*.html`
   - Shared components: `src/public/js/components/*.js`
   - Shared PDF engine: `src/public/pdf-templates/_pdf-report.js`, `_pdf-report.css`
   - Server-side PDF generators: `src/services/*PdfGenerator.js`
   - All 8 i18n locale files: `src/public/i18n/{en,es,fr,de,pt,ja,zh,ru}.json`
   - Any other files where the pattern could plausibly appear
4. **Fix every occurrence** — Apply the same class of fix to every instance found. Do not skip files that "look okay" — verify each one.
5. **Report a summary** — List every file changed, number of fixes per file, and confirm zero remaining occurrences with a final grep.
