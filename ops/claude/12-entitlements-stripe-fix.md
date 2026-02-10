# Entitlements & Stripe Consistency Fix

**Date**: 2026-02-01
**Status**: Implemented
**Branch**: feat/ws-01-design-system

## Summary

This fix addresses inconsistencies in the report entitlement system, ensuring that Pro sections are correctly gated across all pages, reports are properly saved and recallable, and Stripe entitlements are deterministically applied.

## What Was Wrong

### 1. Missing Database Columns
The `report_purchases` table was missing `site_url`, `analyzer_type`, and `status` columns that were being used by `stripeService.js`, causing INSERT failures.

### 2. No Centralized Entitlements Resolver
Entitlement checks were scattered across multiple files with inconsistent logic:
- `pro-gate.js` had client-side checks
- `ProReportBlock.js` had 4-layer verification
- `stripeService.js` had `getEntitlements()` but wasn't used consistently

### 3. No Server-Side ReportId Validation
Invalid `reportId` formats could be passed to billing endpoints, potentially causing database issues and payment mismatches.

### 4. Client-Side Export Access Used Sync Check
The PDF export utility used synchronous `hasAccess()` which relied on cached billing status, not fresh server verification.

### 5. Migration Records Not Persisted
The migration runner executed statements but never recorded which migrations had been applied to the `migrations` table.

## What Was Changed

### Files Modified

| File | Changes |
|------|---------|
| `src/db/index.js` | Added migration record insertion after successful migration |
| `src/db/migrations/006_fix_report_purchases_columns.sql` | **NEW** - Adds missing columns to report_purchases |
| `src/utils/entitlements.js` | **NEW** - Canonical entitlements resolver utility |
| `src/routes/auth.js` | Added `/api/auth/check-access` endpoint for server-verified access checks |
| `src/routes/billing.js` | Added `isSafeReportId()` validation to checkout endpoints |
| `src/services/stripeService.js` | Added debug logging, reportId validation in webhook handler |
| `src/public/js/components/ProReportBlock.js` | Added `verifyAccessViaServer()` and `hasAccessAsync()` for server-verified access |
| `src/public/pdf-export-utility.js` | Updated to use async server verification for export access |
| `tests/integration/entitlements.test.js` | **NEW** - Integration tests for entitlement scenarios |

### New API Endpoint

**GET `/api/auth/check-access?reportId=<reportId>`**

Returns server-verified access status for a specific report:

```json
{
  "canView": true,
  "canViewPro": false,
  "canExport": false,
  "reason": "no_access",
  "reportId": "r_abcdef1234567890",
  "entitlements": {
    "plan": "free",
    "hasGlobalAccess": false,
    "isPurchased": false
  }
}
```

### New Utility Functions

**`src/utils/entitlements.js`**:
- `resolveEntitlements(userContext)` - Canonical entitlements resolver
- `canViewProSections(entitlements, reportId)` - Check Pro section access
- `canExportReport(entitlements, reportId)` - Check export access
- `getReportAccess(reportId, userContext, entitlements)` - Full access check
- `validateReportId(reportId)` - Validate reportId format
- `createDebugSummary(entitlements)` - Generate debug summary

**`ProReportBlock.js`**:
- `verifyAccessViaServer(reportId)` - Async server-verified access check
- `hasAccessAsync(reportId, preferServer)` - Async wrapper with fallback

### ReportId Validation

Valid format: `r_<16-hex-chars>` (e.g., `r_abcdef1234567890`)

Validation is now enforced at:
- Billing checkout endpoints (400 error if invalid)
- Stripe webhook handler (rejects invalid reportIds)
- Access check endpoint (400 error if invalid)

## How to Test Manually

### 1. Free User Flow
```
1. Open browser in incognito mode
2. Navigate to /seo-analyzer.html
3. Enter any URL and run a scan
4. Verify: Pro sections show lock overlay with "Unlock for $5" button
5. Verify: PDF Export button shows pricing modal when clicked
```

### 2. Login and Check Entitlements
```
1. Register/login at /auth.html
2. Open DevTools Console
3. Run: fetch('/api/auth/me/entitlements').then(r => r.json()).then(console.log)
4. Verify response shows:
   - plan: "free"
   - permissions.viewProSections: false
   - purchasedReports: []
```

### 3. Check Access for Specific Report
```
1. Note the reportId from body attribute: document.body.getAttribute('data-report-id')
2. Run: fetch('/api/auth/check-access?reportId=' + reportId).then(r => r.json()).then(console.log)
3. Verify: canViewPro: false, reason: "no_access"
```

### 4. Invalid ReportId Handling
```
1. Try: fetch('/api/auth/check-access?reportId=invalid').then(r => r.json()).then(console.log)
2. Verify: error message about invalid format
```

### 5. Subscription Flow (requires Stripe test mode)
```
1. Log in
2. Navigate to /upgrade.html
3. Select a subscription plan
4. Complete checkout with test card (4242 4242 4242 4242)
5. After redirect, verify:
   - All Pro sections are visible
   - PDF export works
   - /api/auth/me/entitlements shows plan: "pro"
```

### 6. Single Report Purchase (requires Stripe test mode)
```
1. Log in
2. Run a scan
3. Click "Unlock for $5" on a locked Pro section
4. Complete checkout
5. Verify: That specific report's Pro sections are visible
6. Navigate to a different URL and run a scan
7. Verify: New report's Pro sections are still locked
```

## Debug Logging

New debug logs are prefixed with `[ENTITLEMENT_DEBUG]`:

```
[ENTITLEMENT_DEBUG] Processing payment webhook { eventId, sessionId, purchaseType, userId, reportId }
[ENTITLEMENT_DEBUG] Single report purchase recorded successfully { userId, reportId }
[ENTITLEMENT_DEBUG] getEntitlements result { userId, plan, hasGlobalAccess, purchasedReportsCount }
```

Enable debug logging by setting `LOG_LEVEL=debug` in environment.

## Database Migration

The migration `006_fix_report_purchases_columns.sql` will run automatically on server start. It adds:

```sql
ALTER TABLE report_purchases ADD COLUMN site_url TEXT;
ALTER TABLE report_purchases ADD COLUMN analyzer_type TEXT;
ALTER TABLE report_purchases ADD COLUMN status TEXT DEFAULT 'paid';
```

## Rollback Instructions

If issues arise:
1. The migration adds columns that won't break existing functionality
2. The new API endpoint `/api/auth/check-access` is additive
3. Client-side changes fallback to previous behavior if server check fails

To fully rollback:
1. Revert the commits from this branch
2. The added database columns will remain but won't cause issues

## Future Improvements

1. **Report Storage**: Implement full report snapshot storage in database (free_json, pro_json)
2. **Guest Session Mapping**: Map guest sessions to users after login
3. **Webhook Retry Handling**: Add more robust retry logic for failed webhook processing
4. **Real-time Updates**: Use WebSocket to push entitlement updates to client
