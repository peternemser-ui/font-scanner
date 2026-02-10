# 03 — Pro Gating (UI + server checks)

## Goal
Implement clean Pro gating across the app with minimal headache:
- Free users can see limited output, but Pro sections are visually locked.
- Paid users can access Pro tools/sections.
- Subscriptions can be cancelled anytime (customer portal link or API).
- Pricing:
  - Pro Monthly: $20/mo
  - Pro Yearly: $180/yr (equivalent $15/mo)
  - Single Report: $10 one-time

## Scope
- UI gating (locked overlays, upgrade prompts)
- Server-side entitlement check hooks (do not rely only on frontend)
- Do not redo billing flows beyond what is needed to enforce gating.

## Required changes
1) **Canonical gating rules**
   - Define `entitlements` object shape (backend response):
     - `plan`: `free|pro`
     - `subscriptionStatus`: `active|past_due|canceled|none`
     - `currentPeriodEnd`: ISO string or null
     - `purchasedReports`: array of report IDs
     - `permissions`: `{ accessProTools, viewProSections, exportReports }`

2) **Frontend gating**
   - Use existing components where possible:
     - `src/public/js/components/ProReportBlock.js`
     - `src/public/js/components/PricingModal.js`
     - `src/public/pro-gate.js`
   - Add a consistent overlay and CTA that opens PricingModal.
   - Ensure locked sections do not run expensive scan code unless unlocked (where feasible).

3) **Server enforcement**
   - Add/confirm middleware or utility that validates entitlement before:
     - pro-only analyzers
     - pro-only report sections
     - exporting PDFs
   - Unauthorized returns 403 with clear message.

4) **Upgrade UX**
   - Add “How it works” teaser on homepage and a clear explainer section somewhere (lightweight copy).
   - Add “Cancel subscription” entry point in Account page (Stripe portal link is fine).

## Acceptance checklist
- Free user sees locked Pro UI, cannot export Pro report.
- Pro user can access gated sections and export.
- Pricing modal shows $20/mo and $180/yr and $10 single report.
- Cancel subscription path exists in Account page.
- `npm test` passes.

