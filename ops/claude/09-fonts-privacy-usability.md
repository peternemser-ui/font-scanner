# 09 — Fonts + Privacy + Usability (high-impact UX upgrades)

## Goal
Strengthen the typography/font analysis and add two meaningful new tabs.
Also improve font provider detection and make the experience feel “productized”.

## Required changes
1) **Add two new tabs to Fonts/ Typography analysis**
   - Tabs must be genuinely useful and actionable. Choose TWO:
     - “Font Loading Performance” (preload, FOIT/FOUT hints, render-blocking CSS)
     - “Licensing / Hosting Risk” (Google Fonts vs self-hosted, third-party calls, GDPR risk flags)
     - “Fallback + System Font Strategy” (font-display usage, fallback stack quality)
     - “Coverage & Unicode” (missing glyph ranges, multi-language coverage indicators)
   - Wire them into existing fonts analyzer page:
     - `src/public/enhanced-fonts.html`
     - `src/public/enhanced-fonts-script.js`

2) **Improve Font Provider section**
   - Today it’s weak. Enhance detection:
     - Identify Google Fonts, Adobe Fonts, Typekit, Cloudflare fonts, self-hosted
     - Show domains contacted for fonts
     - Recommend self-hosting where relevant (do not overclaim legality; present as “may reduce third-party exposure”)

3) **Homepage teaser + “How it works” section**
   - Add a brief teaser to `src/public/index.html` describing:
     - enter a URL → scan → get a report → upgrade for pro exports
   - Add a lightweight “How it works” block (can be on homepage or a dedicated section/page).

4) **Usability polish**
   - Ensure results are readable:
     - better headings
     - less scrolling inside modals
     - clearer CTAs

## Acceptance checklist
- Fonts analyzer has two new tabs with real output.
- Provider detection is clearly better (shows domains and provider classification).
- Homepage includes a short “how it works” teaser.
- `npm test` passes.

