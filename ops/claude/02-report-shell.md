# 02 — Report Shell Unification

## Goal
Create a single shared “Report Shell” layout so every tool page uses the same structure, with only inner content differing.

## What “Report Shell” means
A consistent page frame with:
- top nav + breadcrumb
- page title + short description
- URL input / scan controls (consistent UI)
- report container area with tabs/sections
- consistent “locked/pro” handling hooks (do not implement gating here unless needed for layout)

## Required changes
1) **Create or finalize a reusable component**
   - Use `src/public/js/components/ReportContainer.js` (or create it if missing).
   - It must be importable from tool pages with minimal code changes.
   - It must accept:
     - `pageTitle`
     - `pageDescription`
     - `analyzerType` (string used for IDs / caching)
     - `tabs` config array (id, label, render function or template selector)

2) **Update tool pages to use the shell**
   - Update these pages first (minimum):
     - `src/public/performance-hub.html` + script
     - `src/public/seo-analyzer.html` + script
     - `src/public/security-analyzer.html` + script
   - Then apply to remaining analyzer pages if straightforward.

3) **Standardize Scan Context**
   - Ensure the shell calls existing scan utilities (do not rewrite analyzers).
   - Standardize how URL is read, validated, and passed to backend.

4) **Keep backwards compatibility**
   - If a legacy page relies on old DOM IDs, keep them or provide aliases.

## Acceptance checklist
- At least 3 analyzer pages share identical layout structure (frame, header, controls, report container).
- Only the inner report content differs.
- No broken buttons/handlers.
- `npm test` passes.

