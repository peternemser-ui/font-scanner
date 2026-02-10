# 05 — Billing + Entitlements (single source of truth)

## Goal
Implement a single entitlement resolver used by:
- UI gating
- export gating
- pro tools gating
- account display

## Required changes
1) **Backend: unified entitlements**
   - In `src/services/stripeService.js` (or a new `entitlementsService.js` if cleaner), implement:
     - `getEntitlements(userId)` => returns canonical entitlements object
   - Must consider:
     - active subscription
     - cancellation at period end
     - purchased single reports
     - day pass (if supported)

2) **Backend: endpoints**
   - Add endpoint:
     - `GET /api/me/entitlements`
   - It must require auth and return canonical shape.
   - Optionally alias `GET /api/billing/entitlements` for backwards compatibility.

3) **Webhook updates**
   - Ensure Stripe webhooks update local DB fields needed by `getEntitlements`.
   - Must be idempotent.
   - Must track renewal (`invoice.paid` or `invoice.payment_succeeded` depending on current code).

4) **Frontend: use entitlements**
   - Account page should refresh entitlements after successful checkout.
   - Any caching should be bustable (clear billing cache after redirect).

5) **Migrations**
   - If entitlements table needs constraints for upserts, add a migration.
   - Do not break existing data.

6) **Tests**
   - Update/add tests so:
     - entitlement resolver returns correct permissions
     - endpoints return correct shape
   - If existing tests assume old exports, keep backwards compatibility.

## Acceptance checklist
- `/api/me/entitlements` returns correct object for free and pro users.
- Account page reflects plan changes after purchase.
- Webhook renewal updates entitlement state.
- `npm test` passes.

