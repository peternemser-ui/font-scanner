# Pro Report Snapshot System

This document describes the **Pro Report Snapshot** feature, which captures full scan results to disk for later PDF report generation in the paid report flow.

## Overview

When a user runs a comprehensive scan, Site Mechanic automatically captures a snapshot of the complete scan result. This snapshot:
- Is stored on disk with a unique purchase ID
- Contains the full scan data (all analyzer results)
- Expires after 7 days
- Can later be used by an async report worker to generate PDFs

## Architecture

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend API     │────▶│   Disk Storage  │
│   (browser)     │     │   (Express)       │     │   (JSON files)  │
└─────────────────┘     └───────────────────┘     └─────────────────┘
       │                         │                        │
       │  1. Scan completes      │                        │
       │  2. POST /init          │                        │
       │  ◀── purchaseId ───     │                        │
       │  3. POST /snapshot      │                        │
       │                         │── write meta.json ────▶│
       │                         │── write snapshot.json ─▶│
       │  ◀── { ok: true } ──    │                        │
```

## API Endpoints

### 1. Initialize Purchase

Creates a new purchase folder and returns a unique ID.

```http
POST /api/pro-report/purchase/init
Content-Type: application/json

{
  "domain": "example.com"
}
```

**Response (201 Created):**
```json
{
  "purchaseId": "01hxyz123abc456def789",
  "expiresAt": "2026-01-12T10:30:00.000Z"
}
```

### 2. Capture Snapshot

Saves the full scan result to disk.

```http
POST /api/pro-report/purchase/:purchaseId/snapshot
Content-Type: application/json

{
  "domain": "example.com",
  "selectedUrls": [
    "https://example.com/",
    "https://example.com/about"
  ],
  "selectedModules": ["fonts", "seo", "performance", "lighthouse"],
  "scanResult": { /* full scan result object */ }
}
```

**Response (200 OK):**
```json
{
  "ok": true
}
```

**Validation:**
- `purchaseId` must exist
- `domain` must match the purchase domain
- `selectedUrls` max 10 items
- Purchase must not be expired

### 3. Retrieve Snapshot

Get a stored snapshot (for report rendering or debugging).

```http
GET /api/pro-report/purchase/:purchaseId/snapshot
X-Internal-Report-Key: your-secret-key  # Required in production
```

**Response (200 OK):**
```json
{
  "meta": {
    "domain": "example.com",
    "selectedUrls": ["https://example.com/"],
    "selectedModules": ["fonts", "seo"],
    "createdAt": "2026-01-05T10:30:00.000Z",
    "expiresAt": "2026-01-12T10:30:00.000Z"
  },
  "scanResult": { /* full scan result object */ }
}
```

**Security:**
- In development: accessible freely
- In production: requires `X-Internal-Report-Key` header matching `REPORT_INTERNAL_KEY` env var

### 4. Check Status

Get purchase status without retrieving full snapshot.

```http
GET /api/pro-report/purchase/:purchaseId/status
```

**Response (200 OK):**
```json
{
  "purchaseId": "01hxyz123abc456def789",
  "domain": "example.com",
  "createdAt": "2026-01-05T10:30:00.000Z",
  "expiresAt": "2026-01-12T10:30:00.000Z",
  "isExpired": false,
  "hasSnapshot": true
}
```

## Storage Layout

```
data/reports/                      # Or REPORT_STORAGE_DIR
├── 01hxyz123abc456def789/         # Purchase folder
│   ├── meta.json                  # Purchase metadata
│   └── snapshot.json              # Full scan snapshot
├── 01habc456xyz789def012/
│   ├── meta.json
│   └── snapshot.json
└── ...
```

### meta.json
```json
{
  "purchaseId": "01hxyz123abc456def789",
  "domain": "example.com",
  "createdAt": "2026-01-05T10:30:00.000Z",
  "expiresAt": "2026-01-12T10:30:00.000Z"
}
```

### snapshot.json
```json
{
  "meta": {
    "domain": "example.com",
    "selectedUrls": ["https://example.com/"],
    "selectedModules": ["fonts", "seo", "performance"],
    "createdAt": "2026-01-05T10:35:00.000Z",
    "expiresAt": "2026-01-12T10:30:00.000Z"
  },
  "scanResult": {
    "url": "https://example.com/",
    "overallScore": 85,
    "grade": "B",
    "fonts": { ... },
    "seo": { ... },
    "performance": { ... },
    "lighthouse": { ... },
    ...
  }
}
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `REPORT_STORAGE_DIR` | `./data/reports` (dev) or `/var/lib/sitemechanic/reports` (prod) | Storage directory path |
| `REPORT_INTERNAL_KEY` | (none) | Secret key for snapshot retrieval in production |
| `NODE_ENV` | `development` | Set to `production` for production security |

## Local Development

### Run the server

```bash
npm run dev
```

### Test the flow manually

```bash
# 1. Initialize purchase
curl -X POST http://localhost:3000/api/pro-report/purchase/init \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com"}'

# Response: {"purchaseId":"abc123...","expiresAt":"2026-01-12T..."}

# 2. Capture snapshot (replace PURCHASE_ID)
curl -X POST http://localhost:3000/api/pro-report/purchase/PURCHASE_ID/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "selectedUrls": ["https://example.com/"],
    "selectedModules": ["fonts", "seo"],
    "scanResult": {"url": "https://example.com/", "overallScore": 85}
  }'

# Response: {"ok":true}

# 3. Retrieve snapshot
curl http://localhost:3000/api/pro-report/purchase/PURCHASE_ID/snapshot

# 4. Check status
curl http://localhost:3000/api/pro-report/purchase/PURCHASE_ID/status
```

### Check stored files

```bash
# List purchases
ls -la data/reports/

# View metadata
cat data/reports/PURCHASE_ID/meta.json | jq

# View snapshot
cat data/reports/PURCHASE_ID/snapshot.json | jq
```

## Cleanup

Expired snapshots can be cleaned up using the provided script:

```bash
# Dry run (show what would be deleted)
node scripts/cleanup-expired-reports.js --dry-run

# Actually delete expired folders
node scripts/cleanup-expired-reports.js

# Verbose output
node scripts/cleanup-expired-reports.js --verbose
```

## Frontend Integration

The snapshot is automatically captured after a comprehensive scan completes. The frontend calls:

1. `POST /api/pro-report/purchase/init` with the domain
2. `POST /api/pro-report/purchase/:purchaseId/snapshot` with the full scan result

A toast notification appears: "Pro report snapshot saved: abc123..."

If capture fails, it's logged but doesn't affect the user experience.

## Future: PDF Generation Flow

The snapshot system is designed to support this flow:

1. User scans website (snapshot auto-captured)
2. User clicks "Generate Pro Report"
3. Stripe checkout flow creates payment record
4. On payment success, webhook triggers async worker
5. Worker reads `snapshot.json` via internal API
6. Worker generates PDF and stores it
7. User downloads PDF

## Files Added

| File | Description |
|------|-------------|
| `src/utils/proReportStorage.js` | Disk storage utilities |
| `src/routes/proReport.js` | API route handlers |
| `src/public/pro-report-snapshot.js` | Frontend capture client |
| `scripts/cleanup-expired-reports.js` | Cleanup script |
| `docs/ProReportSnapshot.md` | This documentation |

## Troubleshooting

### Snapshot not being captured

1. Check browser console for `[ProReportSnapshot]` logs
2. Verify `pro-report-snapshot.js` is loaded in the page
3. Check server logs for API errors

### Permission errors on disk

```bash
# Ensure data directory exists with proper permissions
mkdir -p data/reports
chmod 750 data/reports
```

### 403 on retrieval in production

Set the `REPORT_INTERNAL_KEY` environment variable and include it in requests:

```bash
curl -H "X-Internal-Report-Key: your-secret-key" \
  http://localhost:3000/api/pro-report/purchase/PURCHASE_ID/snapshot
```
