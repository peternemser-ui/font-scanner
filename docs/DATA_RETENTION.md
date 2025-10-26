# Data Retention & Cleanup Operations

## Overview

Font Scanner implements an **automated data retention policy** to ensure GDPR compliance and prevent unlimited disk space growth. This document describes the cleanup system, monitoring capabilities, and operational procedures.

## System Architecture

### Components

1. **Report Cleanup Service** (`src/utils/reportCleanup.js`)
   - Automated deletion of expired PDF reports
   - Daily scheduled execution
   - Statistics tracking and logging
   - Graceful shutdown support

2. **Server Integration** (`src/server.js`)
   - Starts cleanup scheduler on server initialization
   - Stops scheduler during graceful shutdown
   - Provides monitoring endpoint

3. **Configuration** (Environment Variables)
   - `REPORTS_RETENTION_DAYS` - Number of days to retain reports (default: 7)
   - `REPORTS_DIR` - Directory containing PDF reports (default: ./reports)

## Automated Cleanup Process

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Server Startup                          │
│  1. Start cleanup scheduler (runs immediately)              │
│  2. Schedule recurring cleanup every 24 hours               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cleanup Execution                         │
│  1. Scan reports directory for PDF files                    │
│  2. Check file modification time (mtime)                    │
│  3. Compare against retention period                        │
│  4. Delete files older than retention period                │
│  5. Track statistics (deleted, freed space, errors)         │
│  6. Log results                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Graceful Shutdown                         │
│  1. Receive SIGTERM/SIGINT signal                           │
│  2. Stop cleanup scheduler                                  │
│  3. Allow current cleanup to complete                       │
│  4. Exit cleanly                                            │
└─────────────────────────────────────────────────────────────┘
```

### Cleanup Logic

```javascript
For each PDF file in reports directory:
  1. Get file modification time (mtime)
  2. Calculate age = current time - mtime
  3. If age > REPORTS_RETENTION_DAYS:
     - Delete file
     - Track freed space
     - Log deletion
  4. Else:
     - Keep file
     - Include in statistics
```

### Default Configuration

```env
REPORTS_RETENTION_DAYS=7    # Delete reports older than 7 days
REPORTS_DIR=./reports       # Directory to monitor
```

## Monitoring

### Real-Time Statistics

The `/api/reports/stats` endpoint provides real-time cleanup statistics:

```bash
# Check cleanup status
curl http://localhost:3000/api/reports/stats
```

**Response Format:**

```json
{
  "status": "ok",
  "stats": {
    "total": 97,              // Total PDF reports in directory
    "old": 0,                 // Reports beyond retention period
    "recent": 97,             // Reports within retention period
    "totalSize": 1018545,     // Total size in bytes
    "totalSizeMB": "0.97",    // Total size in MB
    "retentionDays": 7,       // Configured retention period
    "reportsDir": "./reports" // Monitored directory
  }
}
```

### Interpreting Statistics

| Metric | Meaning | Healthy Range |
|--------|---------|---------------|
| `total` | Total reports on disk | Varies by usage |
| `old` | Reports pending deletion | Should be 0 after cleanup |
| `recent` | Reports within retention | Should match total |
| `totalSize` | Disk space used | Monitor for growth |
| `totalSizeMB` | Human-readable size | Depends on report count |

**Alert Conditions:**

- ⚠️ `old > 0` after scheduled cleanup → Cleanup may have failed
- ⚠️ `totalSizeMB` growing unbounded → Check retention period
- ⚠️ `total` exceeds expected range → Investigate unusual activity

### Log Monitoring

The cleanup service logs all operations:

```log
# Successful cleanup
[2025-10-18T10:00:00.000Z] INFO: Report cleanup started
[2025-10-18T10:00:00.123Z] INFO: Report cleanup completed: deleted=5, kept=92, freed=2.34 MB

# No files to delete
[2025-10-18T10:00:00.000Z] INFO: Report cleanup started
[2025-10-18T10:00:00.050Z] INFO: Report cleanup completed: deleted=0, kept=97, freed=0.00 MB

# Error during cleanup
[2025-10-18T10:00:00.000Z] ERROR: Failed to delete report abc123.pdf: EACCES: permission denied
```

**Log Locations:**

- Application logs: `logs/application.log`
- Error logs: `logs/error.log`
- Rotation: 7 days (matches report retention)

## Operational Procedures

### Manual Cleanup

While cleanup is automatic, you may need to trigger it manually:

#### Option 1: Programmatic Trigger

```javascript
const { cleanupOldReports } = require('./src/utils/reportCleanup');

async function manualCleanup() {
  console.log('Starting manual cleanup...');
  const result = await cleanupOldReports();
  
  console.log(`Results:
    Deleted: ${result.deleted} files
    Kept: ${result.kept} files
    Freed Space: ${result.freedSpaceMB} MB
    Errors: ${result.errors.length}
  `);
  
  if (result.errors.length > 0) {
    console.error('Errors encountered:', result.errors);
  }
}

manualCleanup();
```

#### Option 2: Server Restart

The cleanup service runs immediately on server startup:

```bash
# Restart server to trigger cleanup
npm restart
```

#### Option 3: Direct File System Operation

**⚠️ Use with caution - bypasses logging:**

```bash
# PowerShell: Delete reports older than 7 days
Get-ChildItem ./reports -Filter "*.pdf" | 
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | 
  Remove-Item -Force

# Linux/Mac: Delete reports older than 7 days
find ./reports -name "*.pdf" -mtime +7 -delete
```

### Adjusting Retention Period

To change the retention period:

1. **Edit environment configuration:**

```env
# Increase retention to 30 days
REPORTS_RETENTION_DAYS=30
```

2. **Restart server:**

```bash
npm restart
```

3. **Verify new setting:**

```bash
curl http://localhost:3000/api/reports/stats
# Check "retentionDays" in response
```

**Common Retention Periods:**

| Period | Use Case | Disk Space Impact |
|--------|----------|-------------------|
| 1 day | High privacy, low storage | Minimal |
| 7 days | Balanced (default) | Moderate |
| 30 days | Long-term access | Higher |
| 90 days | Compliance requirements | Significant |

### Troubleshooting

#### Problem: Old reports not being deleted

**Symptoms:**
- `/api/reports/stats` shows `old > 0` after cleanup
- Disk space continues to grow

**Diagnosis:**

```bash
# Check if cleanup scheduler is running
curl http://localhost:3000/api/reports/stats

# Check application logs
cat logs/application.log | grep "cleanup"

# Check error logs
cat logs/error.log | grep "cleanup"
```

**Solutions:**

1. **Check file permissions:**
   ```bash
   # Ensure server has write access to reports directory
   ls -la ./reports
   chmod 755 ./reports
   ```

2. **Verify environment configuration:**
   ```bash
   # Check if REPORTS_RETENTION_DAYS is set correctly
   printenv | grep REPORTS
   ```

3. **Restart server:**
   ```bash
   # Cleanup runs on startup
   npm restart
   ```

4. **Manual cleanup:**
   ```javascript
   // Run manual cleanup to clear backlog
   const { cleanupOldReports } = require('./src/utils/reportCleanup');
   await cleanupOldReports();
   ```

#### Problem: Cleanup scheduler not starting

**Symptoms:**
- No cleanup logs in application log
- `/api/reports/stats` endpoint returns error

**Diagnosis:**

```bash
# Check server startup logs
cat logs/application.log | grep "scheduler"

# Verify server.js integration
grep -A5 "reportCleanup" src/server.js
```

**Solutions:**

1. **Verify reportCleanup.js exists:**
   ```bash
   ls -la src/utils/reportCleanup.js
   ```

2. **Check for startup errors:**
   ```bash
   cat logs/error.log | tail -20
   ```

3. **Restart with verbose logging:**
   ```bash
   NODE_ENV=development npm start
   ```

#### Problem: Excessive disk space usage

**Symptoms:**
- Disk space alert
- `totalSizeMB` larger than expected

**Diagnosis:**

```bash
# Check disk usage
du -sh ./reports

# Count reports
ls -1 ./reports/*.pdf | wc -l

# Check for large files
ls -lhS ./reports | head -10
```

**Solutions:**

1. **Reduce retention period:**
   ```env
   REPORTS_RETENTION_DAYS=1  # Aggressive cleanup
   ```

2. **Immediate cleanup:**
   ```bash
   npm restart  # Runs cleanup on startup
   ```

3. **Optimize report size:**
   - Review PDF generation settings
   - Consider compression options
   - Reduce image quality in reports

## Testing

### Unit Tests

The cleanup service includes comprehensive tests:

```bash
# Run cleanup tests
npm test -- reportCleanup.test.js

# Expected output:
# PASS tests/utils/reportCleanup.test.js
#   cleanupOldReports
#     ✓ should delete old reports and keep recent ones
#     ✓ should handle empty directory
#     ✓ should only delete PDF files
#     ✓ should calculate freed disk space
#     ✓ should handle deletion errors gracefully
#   getCleanupStats
#     ✓ should return accurate statistics
#     ✓ should handle non-existent directory
#   startScheduledCleanup
#     ✓ should create cleanup interval
#     ✓ should use default interval if not provided
#   stopScheduledCleanup
#     ✓ should stop cleanup interval
#     ✓ should handle null interval gracefully
#
# Tests: 11 passed, 11 total
```

### Integration Testing

Test the full cleanup flow:

```bash
# 1. Create test reports with old dates
touch -d "8 days ago" ./reports/old-report-1.pdf
touch -d "8 days ago" ./reports/old-report-2.pdf
touch ./reports/recent-report.pdf

# 2. Check statistics before cleanup
curl http://localhost:3000/api/reports/stats
# Should show: old=2, recent=1

# 3. Restart server (triggers cleanup)
npm restart

# 4. Check statistics after cleanup
curl http://localhost:3000/api/reports/stats
# Should show: old=0, recent=1

# 5. Verify old reports deleted
ls ./reports
# Should only show recent-report.pdf
```

## Performance Considerations

### Cleanup Performance

| Reports | Scan Time | Delete Time | Total Time |
|---------|-----------|-------------|------------|
| 100 | ~50ms | ~100ms | ~150ms |
| 1,000 | ~500ms | ~1s | ~1.5s |
| 10,000 | ~5s | ~10s | ~15s |

**Performance Tips:**

1. **Schedule during low traffic**: Default 24-hour interval is good
2. **Monitor large directories**: > 10,000 files may need optimization
3. **Use SSD storage**: Faster file operations
4. **Adjust retention**: Shorter retention = fewer files = faster cleanup

### Memory Usage

The cleanup service is memory-efficient:

- **File list**: ~1KB per 100 files
- **Statistics**: ~200 bytes
- **Total impact**: < 1MB for typical deployments

## Security Considerations

### File System Security

1. **Principle of Least Privilege**
   - Server user should only have access to reports directory
   - Restrict write access to other directories

2. **Path Traversal Prevention**
   - Cleanup only operates on configured REPORTS_DIR
   - No user input accepted for directory paths

3. **Deletion Safety**
   - Only deletes .pdf files
   - Respects retention period strictly
   - Logs all deletions for audit trail

### GDPR Compliance

The cleanup service ensures GDPR compliance:

| Principle | Implementation |
|-----------|----------------|
| **Storage Limitation** | 7-day automatic deletion |
| **Accountability** | Comprehensive logging |
| **Data Minimization** | Only retains necessary data |
| **Transparency** | Public documentation |

## Best Practices

### Production Deployment

1. **Monitor disk space:**
   ```bash
   # Set up disk space alerts
   df -h | grep reports
   ```

2. **Regular statistics checks:**
   ```bash
   # Daily health check
   curl http://localhost:3000/api/reports/stats
   ```

3. **Log aggregation:**
   - Forward cleanup logs to centralized logging
   - Set up alerts for deletion errors

4. **Backup strategy:**
   - Reports are ephemeral by design
   - No backup needed (can be regenerated)

### Configuration Management

```yaml
# Example: Docker Compose
services:
  font-scanner:
    environment:
      - REPORTS_RETENTION_DAYS=7
      - REPORTS_DIR=/app/reports
    volumes:
      - ./reports:/app/reports

# Example: Kubernetes ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: font-scanner-config
data:
  REPORTS_RETENTION_DAYS: "7"
  REPORTS_DIR: "/app/reports"
```

## API Reference

### GET /api/reports/stats

Returns current cleanup statistics.

**Request:**
```bash
curl http://localhost:3000/api/reports/stats
```

**Response:**
```json
{
  "status": "ok",
  "stats": {
    "total": 97,
    "old": 0,
    "recent": 97,
    "totalSize": 1018545,
    "totalSizeMB": "0.97",
    "retentionDays": 7,
    "reportsDir": "./reports"
  }
}
```

**Status Codes:**
- `200 OK` - Statistics retrieved successfully
- `500 Internal Server Error` - Failed to retrieve statistics

## Changelog

### Version 1.0.0 (2025-10-18)

- Initial implementation of automated cleanup service
- Daily scheduled cleanup with 24-hour interval
- Real-time statistics endpoint
- Comprehensive logging and error handling
- Integration with server lifecycle
- 11 passing unit tests

## Support

For issues or questions about the data retention system:

1. Check logs: `logs/application.log` and `logs/error.log`
2. Review statistics: `curl http://localhost:3000/api/reports/stats`
3. Consult this documentation
4. Check GitHub issues for known problems

---

**Document Version:** 1.0.0  
**Last Updated:** 2025-10-18  
**Maintainer:** Font Scanner Team
