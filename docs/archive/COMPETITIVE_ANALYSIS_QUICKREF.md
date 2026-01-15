# Competitive Analysis - Quick Reference Card

## ⚠️ CRITICAL INFORMATION

**This is a VERY resource-intensive endpoint**
- Takes 5-15 minutes per request
- Uses significant CPU/memory
- Strictly rate-limited: **2 requests per 15 minutes per IP**

## Limits

| Limit Type | Old Value | New Value | Reason |
|------------|-----------|-----------|---------|
| Max Competitors | 5 | **3** | Prevent system overload |
| Rate Limit | 20 per 15min | **2 per 15min** | Resource protection |
| Overall Timeout | None | **20 minutes** | Prevent hangs |
| Analyzer Execution | Parallel | **Sequential** | Prevent pool exhaustion |

## How It Works

### Execution Flow
1. **Your site** analyzed first (all 5 analyzers sequentially)
2. **3 second delay** (browser cleanup)
3. **Competitor 1** analyzed (all 5 analyzers sequentially)
4. **5 second delay** (browser cleanup)
5. **Competitor 2** analyzed
6. **5 second delay**
7. **Competitor 3** analyzed

### Per-Site Analysis (Sequential)
1. SEO (30s timeout) → 0.5s delay
2. Security (30s timeout) → 0.5s delay
3. Accessibility (45s timeout) → 1s delay
4. Core Web Vitals (60s timeout) → 2s delay
5. Performance (90s timeout) → 2s delay

## Circuit Breaker

If **2 consecutive sites fail**, the analysis stops to prevent cascading failures.

## API Usage

### Request
```bash
POST /api/competitive-analysis
Content-Type: application/json

{
  "yourUrl": "https://example.com",
  "competitorUrls": [
    "https://competitor1.com",
    "https://competitor2.com",
    "https://competitor3.com"
  ]
}
```

### Response
```json
{
  "yourSite": {
    "url": "https://example.com",
    "scores": { "overall": 85, "seo": 90, ... },
    "details": { ... },
    "grade": "A"
  },
  "competitors": [ ... ],
  "comparison": { ... },
  "rankings": { ... },
  "metadata": {
    "totalSitesRequested": 4,
    "successfulAnalyses": 4,
    "failedAnalyses": 0,
    "circuitBreakerTriggered": false
  },
  "analysisTime": "480.5",
  "warning": null
}
```

## Error Responses

### Rate Limited
```json
{
  "error": "Too Many Requests",
  "message": "Competitive analysis is very resource-intensive...",
  "retryAfter": 900
}
```

### Timeout
```json
{
  "error": "Competitive analysis failed: Analysis timed out after 20 minutes..."
}
```

### Too Many Competitors
```json
{
  "error": "Maximum 3 competitor URLs allowed (system resource protection)"
}
```

## Monitoring Commands

### Check Chrome Processes
```powershell
Get-Process | Where-Object {$_.ProcessName -eq "chrome"}
```

### Check Rate Limit Status
```bash
GET /api/admin/rate-limits
```

### Check Browser Pool Health
```bash
GET /api/health
```

## Configuration (Environment Variables)

```bash
# Number of competitors
COMPETITIVE_MAX_COMPETITORS=3

# Timeouts (ms)
COMPETITIVE_SEO_TIMEOUT=30000
COMPETITIVE_SECURITY_TIMEOUT=30000
COMPETITIVE_A11Y_TIMEOUT=45000
COMPETITIVE_CWV_TIMEOUT=60000
COMPETITIVE_PERF_TIMEOUT=90000

# Delays (ms)
COMPETITIVE_ANALYZER_DELAY=1000
COMPETITIVE_SITE_DELAY=5000

# Circuit breaker
COMPETITIVE_MAX_FAILURES=2

# Rate limiting
COMPETITIVE_RATE_WINDOW_MS=900000  # 15 min
COMPETITIVE_RATE_MAX_REQUESTS=2    # 2 per window
```

## Troubleshooting

### Symptom: Browser crashes
**Cause**: Too many concurrent requests
**Fix**: Rate limiting prevents this (2 per 15 min)

### Symptom: Zombie Chrome processes
**Cause**: Crashed analysis
**Fix**: Run `Get-Process | Where-Object {$_.ProcessName -eq "chrome"} | Stop-Process -Force`

### Symptom: Analysis hangs
**Cause**: Network issues or slow site
**Fix**: 20-minute overall timeout will kill it

### Symptom: Partial results
**Cause**: Some analyzers failed
**Fix**: Normal - graceful degradation. Check warnings in response.

### Symptom: Circuit breaker triggered
**Cause**: Multiple consecutive failures
**Fix**: System self-protection. Try again in 5 minutes with different URLs.

## Best Practices

1. **Always test with 1 competitor first** before using 3
2. **Monitor system resources** during analysis
3. **Don't run multiple analyses** simultaneously
4. **Check rate limits** before submitting requests
5. **Expect 5-15 minute response times**
6. **Handle partial results** gracefully in UI

## Related Files

- `src/services/competitiveAnalysisService.js` - Core logic
- `src/controllers/competitiveAnalysisController.js` - API endpoint
- `src/middleware/rateLimiter.js` - Rate limiting
- `src/config/index.js` - Configuration
- `COMPETITIVE_ANALYSIS_FIX.md` - Full documentation
