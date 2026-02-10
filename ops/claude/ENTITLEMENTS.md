# Entitlement System Documentation

## Plan Rules

| Plan | Price | Scans/Day | Reports/Window | Pages/Crawl | PDF Export |
|------|-------|-----------|----------------|-------------|------------|
| Free | $0 | 10 | 0 | 1 | No |
| Day Pass | $20/8h | Unlimited | 30 / 8h | 250 | Yes |
| Pro Monthly | $29/mo | Unlimited | 250 / billing period | 250 | Yes |
| Pro Annual | $290/yr | Unlimited | Unlimited | 250 | Yes |
| Single Report | $5 one-time | N/A | 1 specific report | N/A | Yes (that report) |

## Definitions

- **Scan**: Running an analyzer against a URL. Counted per 24h rolling window.
- **Saved Report**: A report whose `result_json` is persisted in the `scans` table.
- **Owned Report**: A report the user can access pro sections of — either via active plan or individual purchase.

## Canonical Resolver

All entitlement decisions flow through `src/utils/entitlements.js`:

```
resolveEntitlements({ userId })  →  Entitlements object
getFullEntitlements(userId)      →  Entitlements + Usage summary
```

### Resolution Logic

```
1. Load user from DB (users table)
2. Load purchasedReports from report_purchases table
3. Determine effective plan:
   a. If interval='day' AND period_end > now → day_pass
   b. Else if status='canceled' AND period_end > now → grace period (pro or day_pass)
   c. Else if status in [active, trialing] → pro or day_pass based on interval
   d. Else → free
4. If day_pass AND expiresAt <= now → downgrade to free
5. Derive permissions from effective plan
6. Return canonical Entitlements object
```

### Entitlements Shape

```javascript
{
  plan: "free" | "pro" | "day_pass",
  subscriptionStatus: "active" | "trialing" | "canceled" | "past_due" | "none",
  subscriptionInterval: "day" | "month" | "year" | null,
  currentPeriodEnd: ISO string | null,
  dayPassExpiresAt: ISO string | null,
  cancelAtPeriodEnd: boolean,
  purchasedReports: string[],
  permissions: {
    accessProTools: boolean,
    viewProSections: boolean,
    exportReports: boolean
  }
}
```

## Enforcement Points

| Endpoint | Middleware | Check |
|----------|-----------|-------|
| `POST /api/scans` | `checkScanQuota` + `enforcePageLimit` | Scan quota + page cap |
| `GET /api/reports/:id` | `requireAuth` + `requireReportAccess` | Auth + report ownership |
| `GET /api/reports/owned` | `requireAuth` | Auth only (returns user's own) |
| `POST /api/pdf/generate` | `requireAuth` + `requirePdfExport` | Auth + export permission |
| `POST /api/pdf/render` | `requireAuth` + `requirePdfExport` | Auth + export permission |
| `POST /api/analyze-*` | `checkScanQuota` | Scan quota via scanQuota middleware |

## Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` (subscription) | Set user plan=pro, record subscription details |
| `checkout.session.completed` (day_pass) | Set user plan=pro, interval=day, period_end=+8h |
| `checkout.session.completed` (single_report) | Insert into report_purchases |
| `customer.subscription.created/updated` | Sync plan, status, period_end to users table |
| `customer.subscription.deleted` | Set status=canceled, keep period_end for grace |
| `invoice.payment_succeeded` | Renew subscription, update period_end |
| `invoice.payment_failed` | Log warning (future: email notification) |

## Counters & Reset Rules

### Scan Counter
- **Storage**: `usage_tracking.scans_used_today`
- **Reset**: Rolling 24h window. `scans_reset_at` = now + 24h from first scan in window.
- **Function**: `usageService.getNext24hWindow()`

### Report Counter
- **Storage**: `usage_tracking.reports_used_in_window`
- **Reset**: Tied to billing period (`report_window_ends_at`).
  - Day Pass: resets when pass expires (8h)
  - Pro Monthly: resets at `currentPeriodEnd`
  - Pro Annual: unlimited (no counter)

## Upgrade/Downgrade State Transitions

```
Free → Day Pass:    plan=pro, interval=day, period_end=+8h
Free → Pro Monthly: plan=pro, interval=month, subscription created
Free → Pro Annual:  plan=pro, interval=year, subscription created
Day Pass → expired: Falls back to free (period_end passed)
Pro → canceled:     status=canceled, access until period_end
Pro Monthly → Annual: New subscription replaces old, interval=year
Single Report:      Adds to report_purchases, no plan change
```

## Files

- **Canonical resolver**: `src/utils/entitlements.js`
- **Plan limits config**: `src/config/pricing.js`
- **Usage tracking**: `src/services/usageService.js`
- **Scan quota middleware**: `src/middleware/scanQuota.js`
- **Enforcement middleware**: `src/middleware/entitlementGuard.js`
- **Stripe service**: `src/services/stripeService.js` (delegates to resolver)
- **Auth routes**: `src/routes/auth.js` (entitlements + usage endpoints)

## Manual QA Checklist

- [ ] Free user: scan limit at 10, 11th blocked, resets ~24h later
- [ ] Free user: cannot access pro report sections
- [ ] Free user: PDF export returns 403
- [ ] Day Pass: countdown displays correctly
- [ ] Day Pass: reports block at 30
- [ ] Day Pass: after 8h expiry, treated as free
- [ ] Pro Monthly: 250 report limit enforced
- [ ] Pro Annual: unlimited reports
- [ ] Cancel: shows "Cancels on {date}" in nav and account
- [ ] Cancel: access maintained until period end
- [ ] Single report purchase: that report accessible + exportable
- [ ] Single report purchase: other reports still gated
- [ ] GET /api/reports/:id returns 401 for unauthenticated
- [ ] GET /api/reports/owned returns user's reports
- [ ] Pages capped to plan limit on scan creation
