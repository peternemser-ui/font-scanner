# Programmatic SEO plan — the compounding channel

Goal: each free analyzer ranks for its own "free [X] checker" intent; a guide cluster
captures informational searches and funnels to the analyzers. All pages get the existing
hreflang treatment (8 locales) — that is leverage most competitors don't have.

## Tier 1 — Analyzer landing intents (pages exist; optimize copy + titles)

| Existing page | Target queries | Action |
|---|---|---|
| /core-web-vitals.html | core web vitals checker, LCP test free | Title/H1 to match query; add FAQ schema answering "what is a good LCP" |
| /accessibility-analyzer.html | wcag compliance checker free, ada website test | Same treatment; cite WCAG 2.1 AA explicitly |
| /security-analyzer.html | security headers checker, CSP checker | Compare against securityheaders.com politely in FAQ |
| /seo-analyzer.html | free seo audit no signup | "no signup" is the differentiator — put it in the title |
| /enhanced-fonts.html | font checker website, web font analyzer | Low competition — easiest win of the set |
| /broken-links.html | broken link checker free | High volume, high competition — long-tail via FAQ |
| /mobile-analyzer.html | mobile friendly test | Google retired their tool in 2023 — this is an open intent |

## Tier 2 — Guide cluster (new pages, one per week)

Each guide: ~1,200 words, honest and technical, ends with "check yours" CTA into the
relevant analyzer. Priority order:

1. "What is a good Core Web Vitals score in 2026?" → /core-web-vitals.html
2. "How to fix render-blocking fonts" → /enhanced-fonts.html
3. "Security headers explained: CSP, HSTS, X-Frame-Options" → /security-analyzer.html
4. "WCAG 2.1 AA checklist for developers" → /accessibility-analyzer.html
5. "Why your Lighthouse score differs between runs" → /performance-hub.html
6. "Website audit checklist (the 30-minute version)" → homepage

## Tier 3 — Comparison pages (month 2+)

"Site Mechanic vs Lighthouse", "vs GTmetrix", "vs Screaming Frog" — honest tables,
concede what the competitor does better, win on "one ranked list, 5 categories, 8 languages".
These convert best of all page types; write them only after Tier 2 traffic proves the funnel.

## Measurement

- Google Search Console (verify domain property if not already)
- Weekly rank tracking for the Tier 1 queries — handled by the marketing routine
- Success metric at 90 days: any Tier 1 page in the top 20 for its primary query
