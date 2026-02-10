# 08 — Legal Pages (Privacy / Terms / Refund)

## Goal
Add basic legal pages suitable for a paid SaaS:
- Privacy Policy
- Terms of Service
- Refund Policy (simple, honest)
And link them in the UI footer/nav.

## Required changes
1) **Create pages**
   - Add static pages under `src/public/`:
     - `privacy.html`
     - `terms.html`
     - `refunds.html`
   - Use the site’s design system (typography, spacing).
   - Include effective date.

2) **Link placement**
   - Add links in global footer or nav template:
     - `src/public/nav-template.js` or wherever footer exists
   - Ensure links are visible but not loud.

3) **Content guidelines**
   - Keep it plain language.
   - Avoid claiming compliance you cannot prove.
   - Mention:
     - what data is collected (URLs scanned, account email, payment handled by Stripe)
     - no selling of personal data
     - retention basics (reports stored for X days if applicable; otherwise state “only as needed”)
     - contact method (use a placeholder email like `support@sitemechanic.io`)

## Acceptance checklist
- Pages load and look consistent with site styles.
- Links appear on main pages.
- No broken routes.

