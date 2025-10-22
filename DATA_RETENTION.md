# Data Retention Policy - Technical Implementation

## Overview

Font Scanner implements automated data retention policies to comply with GDPR, prevent disk space exhaustion, and maintain system performance. This document describes the technical implementation of data cleanup mechanisms.

---

## 📊 Retention Policies

### 1. PDF Reports (`reports/` directory)

**Retention Period:** 7 days (configurable)  
**Storage Location:** `./reports/` directory  
**Cleanup Method:** Automated scheduled job  
**Configuration:** `REPORTS_RETENTION_DAYS` environment variable

```bash
# Default configuration
REPORTS_RETENTION_DAYS=7
```

**How it works:**
- Scheduled job runs every 24 hours
- Checks file modification time (mtime) vs. retention period
- Deletes files older than retention period
- Logs all deletions for audit trail
- Reports disk space freed

**Monitoring endpoint:**
```bash
curl http://localhost:3000/api/reports/stats
```

**Response:**
```json
{
  "status": "ok",
  "stats": {
    "total": 137,
    "old": 42,
    "recent": 95,
    "totalSize": "45.32 MB",
    "retentionDays": 7
  },
  "message": "Report cleanup statistics"
}
```

### 2. In-Memory Cache

**Retention Period:** 1 hour (configurable)  
**Storage Location:** Node.js memory (Map)  
**Cleanup Method:** Automatic interval-based cleanup  
**Configuration:** Hardcoded in `cache.js` (can be made configurable)

```javascript
// Default configuration
const defaultCache = new Cache(3600000); // 1 hour TTL
```

**How it works:**
- Cleanup job runs every 10 minutes
- Checks entry expiration time vs. current time
- Removes expired entries from memory
- Logs number of entries removed

### 3. Application Logs

**Retention Period:** 7 days  
**Storage Location:** Console/stdout (Docker/K8s log collectors)  
**Cleanup Method:** External log rotation (Docker, K8s, PM2)  
**Configuration:** External to application

**Recommended external tools:**
- Docker: `--log-opt max-size=10m --log-opt max-file=3`
- Kubernetes: Fluentd/Loki with retention policies
- PM2: Built-in log rotation with `pm2-logrotate` module

### 4. Prometheus Metrics

**Retention Period:** 15 days (default Prometheus setting)  
**Storage Location:** Prometheus TSDB  
**Cleanup Method:** Prometheus automatic retention  
**Configuration:** Prometheus server configuration

---

## 🛠️ Technical Implementation

### Report Cleanup Service

**File:** `src/utils/reportCleanup.js`

**Key Functions:**

#### `cleanupOldReports()`
Scans and deletes old PDF reports:
```javascript
const { deleted, kept, freed, errors } = await cleanupOldReports();
// Returns statistics about cleanup operation
```

#### `getCleanupStats()`
Gets statistics without deleting:
```javascript
const stats = await getCleanupStats();
// { total: 137, old: 42, recent: 95, totalSize: "45.32 MB", retentionDays: 7 }
```

#### `startScheduledCleanup(intervalMs)`
Starts automated cleanup job:
```javascript
const interval = startScheduledCleanup(24 * 60 * 60 * 1000); // 24 hours
```

#### `stopScheduledCleanup(interval)`
Stops cleanup job (used during graceful shutdown):
```javascript
stopScheduledCleanup(interval);
```

### Startup Sequence

When the server starts:

1. **Immediate cleanup run** - Cleans old reports on startup
2. **Schedule interval** - Sets up 24-hour recurring job
3. **Logs configuration** - Records retention settings

```javascript
// In src/server.js
const cleanupInterval = startScheduledCleanup();
logger.info('Report cleanup scheduler started');
```

### Shutdown Sequence

During graceful shutdown:

1. **Stop accepting new requests**
2. **Stop cleanup scheduler** - Prevents new cleanup runs
3. **Drain browser pool** - Close all Puppeteer instances
4. **Exit process**

```javascript
// Graceful shutdown
stopScheduledCleanup(cleanupInterval);
```

---

## 📈 Monitoring & Observability

### Logs

All cleanup operations are logged:

```javascript
// Startup
{
  level: 'info',
  message: 'Starting report cleanup',
  directory: './reports',
  retentionDays: 7
}

// File deletion
{
  level: 'info',
  message: 'Report deleted',
  file: 'font-analysis-abc123.pdf',
  path: './reports/font-analysis-abc123.pdf'
}

// Completion
{
  level: 'info',
  message: 'Report cleanup completed',
  deleted: 42,
  kept: 95,
  freed: '18.52 MB',
  errors: 0,
  retentionDays: 7
}
```

### Monitoring Endpoint

**GET `/api/reports/stats`**

Returns current state of reports directory:

```bash
curl http://localhost:3000/api/reports/stats
```

```json
{
  "status": "ok",
  "stats": {
    "total": 137,           // Total PDF files
    "old": 42,              // Files older than retention period
    "recent": 95,           // Files within retention period
    "totalSize": "45.32 MB", // Total disk usage
    "retentionDays": 7       // Current retention period
  },
  "message": "Report cleanup statistics"
}
```

**Use cases:**
- Dashboard monitoring
- Alerting on excessive disk usage
- Verifying cleanup is working
- Capacity planning

### Prometheus Metrics (Future Enhancement)

Potential metrics to expose:

```prometheus
# Total reports on disk
font_scanner_reports_total{status="old|recent"} 137

# Disk space used by reports
font_scanner_reports_disk_bytes 47523840

# Reports deleted in last cleanup
font_scanner_reports_deleted_total 42

# Cleanup job execution time
font_scanner_cleanup_duration_seconds 2.3
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REPORTS_RETENTION_DAYS` | `7` | Days to keep PDF reports |

**Examples:**

#### Development (keep longer)
```bash
REPORTS_RETENTION_DAYS=30
```

#### Production (comply with GDPR)
```bash
REPORTS_RETENTION_DAYS=7
```

#### High-volume (shorter retention)
```bash
REPORTS_RETENTION_DAYS=3
```

### Adjusting Cleanup Frequency

Currently hardcoded to 24 hours. To change:

**File:** `src/server.js`

```javascript
// Change from 24 hours to 12 hours
const cleanupInterval = startScheduledCleanup(12 * 60 * 60 * 1000);
```

**File:** `src/utils/reportCleanup.js`

```javascript
// Make interval configurable
function startScheduledCleanup(intervalMs = 24 * 60 * 60 * 1000) {
  // ...
}
```

**Future enhancement:** Add `CLEANUP_INTERVAL_HOURS` env variable.

---

## 🚨 Troubleshooting

### Reports Not Being Deleted

**Symptoms:** Old reports accumulate, disk space grows

**Diagnosis:**
1. Check logs for cleanup messages
2. Verify cleanup job is running: `grep "report cleanup" logs/app.log`
3. Check file permissions on `reports/` directory
4. Verify `REPORTS_RETENTION_DAYS` is set correctly

**Solutions:**
- Restart application to trigger cleanup
- Manually run cleanup: Check logs for errors
- Verify filesystem permissions: `ls -la reports/`

### Too Much Disk Usage

**Symptoms:** Disk space exhausted, reports filling storage

**Diagnosis:**
```bash
# Check current usage
curl http://localhost:3000/api/reports/stats

# Check filesystem
du -sh reports/
ls -lh reports/ | wc -l
```

**Solutions:**
1. **Reduce retention period**:
   ```bash
   REPORTS_RETENTION_DAYS=3
   ```

2. **Increase cleanup frequency**:
   ```javascript
   // Run every 6 hours instead of 24
   startScheduledCleanup(6 * 60 * 60 * 1000);
   ```

3. **Manual cleanup**:
   ```bash
   # Delete reports older than 7 days
   find reports/ -name "*.pdf" -mtime +7 -delete
   ```

### Cleanup Job Not Starting

**Symptoms:** No cleanup logs on startup

**Diagnosis:**
```bash
# Check for error messages
grep "cleanup" logs/app.log
grep "error" logs/app.log | grep -i report
```

**Solutions:**
- Check `reports/` directory exists
- Verify no exceptions during startup
- Check Node.js version compatibility

### Reports Deleted Too Soon

**Symptoms:** Users complain reports unavailable

**Diagnosis:**
```bash
# Check retention configuration
echo $REPORTS_RETENTION_DAYS

# Check when cleanup runs
grep "Report cleanup completed" logs/app.log
```

**Solutions:**
1. **Increase retention**:
   ```bash
   REPORTS_RETENTION_DAYS=14
   ```

2. **Document retention to users**:
   - Add message to UI: "Reports available for 7 days"
   - Email reports immediately after scan

---

## 🔐 Security Considerations

### File Deletion is Permanent

**Risk:** Deleted files cannot be recovered  
**Mitigation:** 
- Ensure adequate retention period
- Consider backup strategy for important reports
- Document retention policy to users

### Disk Space Exhaustion

**Risk:** Cleanup job fails, disk fills up, service crashes  
**Mitigation:**
- Monitor disk usage with alerts
- Set up filesystem quotas
- Implement fallback cleanup mechanism

### Race Conditions

**Risk:** User downloads report while cleanup deletes it  
**Mitigation:**
- Cleanup checks file is not in use (OS-level lock)
- Use atomic file operations
- Return 404 gracefully if file deleted during download

---

## 📊 Performance Impact

### Cleanup Job Performance

**Typical execution time:**
- 100 files: ~200ms
- 1000 files: ~1.5s
- 10000 files: ~15s

**Resource usage:**
- CPU: Minimal (file stat operations)
- Memory: ~1-2 MB per 1000 files
- I/O: Read directory + stat calls + unlink operations

**Optimization tips:**
- Run cleanup during low-traffic periods
- Consider batching deletes (e.g., 100 at a time)
- Use `fs.promises` for parallel operations (already implemented)

---

## 🔮 Future Enhancements

### 1. Configurable Cleanup Interval
```bash
CLEANUP_INTERVAL_HOURS=12
```

### 2. S3/Cloud Storage Support
- Move old reports to cold storage before deletion
- Implement tiered retention (7 days local, 30 days S3)

### 3. User-Requested Retention
- Allow users to "pin" reports for longer retention
- Implement paid tier with extended retention

### 4. Prometheus Metrics
- Expose cleanup metrics for Grafana dashboards
- Alert on cleanup failures

### 5. Report Archive
- Create daily archives before deletion
- Keep compressed archives for compliance

### 6. Selective Deletion
- Keep high-value reports (e.g., comprehensive scans)
- Delete basic scans more aggressively

---

## 📚 References

- **GDPR Article 5(1)(e)** - Storage limitation principle
- **PRIVACY.md** - User-facing privacy policy
- **src/utils/reportCleanup.js** - Implementation
- **src/config/index.js** - Configuration
- **src/server.js** - Startup integration

---

## ✅ Validation Checklist

- [x] Reports are automatically deleted after 7 days
- [x] Cleanup job runs on startup
- [x] Cleanup job runs every 24 hours
- [x] Cleanup stops gracefully during shutdown
- [x] Cleanup operations are logged
- [x] Monitoring endpoint exposes statistics
- [x] Configuration via environment variables
- [x] Error handling for filesystem issues
- [x] Disk space freed is tracked and logged
- [x] Compliant with GDPR retention requirements

---

**Last Updated:** October 19, 2025  
**Version:** 1.0  
**Author:** Font Scanner Team
