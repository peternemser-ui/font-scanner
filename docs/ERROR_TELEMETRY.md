# Error Telemetry System

## Overview

The Error Telemetry System provides comprehensive error tracking, aggregation, and analysis for Font Scanner. It automatically captures all errors, categorizes them, tracks rates, and provides insights for monitoring and debugging.

**Key Features:**
- ✅ Automatic error capture and categorization
- ✅ Error aggregation by type and message
- ✅ Rate tracking with configurable thresholds
- ✅ Real-time monitoring endpoints
- ✅ Memory-efficient circular buffer storage
- ✅ Context capture (request ID, URL, user agent, IP)
- ✅ Similar error detection
- ✅ Automated cleanup with configurable retention

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                           │
│  (Controllers, Services, Routes)                                │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Error occurs
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Error Handler Middleware                        │
│  src/utils/errorHandler.js                                      │
│  - Parses and categorizes errors                                │
│  - Logs error details                                           │
│  - Records in telemetry (if enabled)                           │
│  - Formats response                                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │ recordError()
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Error Telemetry Service                         │
│  src/utils/errorTelemetry.js                                    │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Circular Buffer│  │  Aggregations    │  │  Statistics   │  │
│  │  (recent errors)│  │  (error groups)  │  │  (by type,    │  │
│  │  Max: 1000     │  │  Max: 100        │  │   category)   │  │
│  └─────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Rate Tracking                                          │   │
│  │  - Last minute/hour/day                                │   │
│  │  - Threshold monitoring                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Query endpoints
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Monitoring Endpoints                            │
│  - GET /api/admin/errors              (all telemetry)          │
│  - GET /api/admin/errors/:errorId     (specific error)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Error Telemetry
ERROR_TELEMETRY_ENABLED=true                   # Enable/disable error tracking
ERROR_TELEMETRY_MAX_ERRORS=1000                # Maximum errors to store in memory
ERROR_TELEMETRY_MAX_AGGREGATIONS=100           # Maximum error aggregations to track
ERROR_TELEMETRY_RETENTION_HOURS=24             # How long to keep errors (in hours)

# Error Rate Thresholds
ERROR_TELEMETRY_THRESHOLD_MINUTE=10            # Alert if > 10 errors/minute
ERROR_TELEMETRY_THRESHOLD_HOUR=100             # Alert if > 100 errors/hour
ERROR_TELEMETRY_THRESHOLD_DAY=1000             # Alert if > 1000 errors/day
```

### Configuration in Code

The config is centralized in `src/config/index.js`:

```javascript
const config = require('./config');

// Access telemetry config
console.log(config.errorTelemetry.enabled);      // true/false
console.log(config.errorTelemetry.maxErrors);    // 1000
console.log(config.errorTelemetry.thresholds);   // { minute: 10, hour: 100, day: 1000 }
```

---

## Error Categories

The telemetry system automatically categorizes errors:

| Category | Description | Examples |
|----------|-------------|----------|
| **operational** | Expected errors, user-facing | 4xx status codes, validation failures |
| **validation** | Input validation errors | Missing fields, invalid formats |
| **timeout** | Request/operation timeouts | Puppeteer timeout, network timeout |
| **network** | Network-related errors | Connection refused, DNS failure |
| **programming** | Code bugs, unexpected errors | TypeError, ReferenceError |
| **database** | Database-related errors | Query errors, connection issues |
| **unknown** | Uncategorized errors | New/unrecognized error types |

---

## API Reference

### Monitoring Endpoints

#### 1. Get All Error Telemetry

**Endpoint:** `GET /api/admin/errors`

**Query Parameters:**
- `timeWindow` (optional): Filter by time window (`minute`, `hour`, `day`, `week`, `all`)
- `category` (optional): Filter by category (`operational`, `programming`, etc.)
- `type` (optional): Filter by error type (`Error`, `TypeError`, etc.)

**Example Request:**

```bash
# Get all errors
curl http://localhost:3000/api/admin/errors

# Get errors from last hour
curl http://localhost:3000/api/admin/errors?timeWindow=hour

# Get programming errors
curl http://localhost:3000/api/admin/errors?category=programming

# Get TypeErrors from last day
curl "http://localhost:3000/api/admin/errors?type=TypeError&timeWindow=day"
```

**Response:**

```json
{
  "status": "ok",
  "statistics": {
    "summary": {
      "total": 127,
      "timeWindow": "all",
      "startTime": null,
      "endTime": "2025-10-20T14:00:00.000Z"
    },
    "byType": {
      "Error": 45,
      "TypeError": 32,
      "ValidationError": 50
    },
    "byCategory": {
      "operational": 50,
      "programming": 32,
      "validation": 45
    },
    "byStatusCode": {
      "400": 50,
      "500": 77
    },
    "errorRate": "2.12",
    "topErrors": [
      {
        "type": "ValidationError",
        "message": "Invalid URL format",
        "category": "validation",
        "count": 45,
        "statusCode": 400
      }
    ],
    "recentErrors": [
      {
        "id": "err_1760969725407_abc123",
        "timestamp": 1760969725407,
        "type": "ValidationError",
        "message": "Invalid URL format",
        "category": "validation",
        "statusCode": 400,
        "context": {
          "requestId": "req_123",
          "url": "/api/scan",
          "method": "POST"
        }
      }
    ]
  },
  "rates": {
    "lastMinute": 3,
    "lastHour": 45,
    "lastDay": 127,
    "rates": {
      "perMinute": "0.75",
      "perHour": "5.29"
    },
    "thresholds": {
      "minute": 10,
      "hour": 100,
      "day": 1000
    }
  },
  "thresholds": {
    "hasViolations": false,
    "violations": [],
    "rates": {
      "lastMinute": 3,
      "lastHour": 45,
      "lastDay": 127
    }
  },
  "timestamp": "2025-10-20T14:00:00.000Z"
}
```

#### 2. Get Specific Error Details

**Endpoint:** `GET /api/admin/errors/:errorId`

**Example Request:**

```bash
curl http://localhost:3000/api/admin/errors/err_1760969725407_abc123
```

**Response:**

```json
{
  "status": "ok",
  "error": {
    "id": "err_1760969725407_abc123",
    "timestamp": 1760969725407,
    "type": "ValidationError",
    "message": "Invalid URL format",
    "stack": "ValidationError: Invalid URL format\n    at ...",
    "category": "validation",
    "statusCode": 400,
    "isOperational": true,
    "context": {
      "requestId": "req_123",
      "url": "/api/scan",
      "method": "POST",
      "userAgent": "Mozilla/5.0...",
      "ip": "127.0.0.1"
    }
  },
  "similarErrors": [
    {
      "id": "err_1760969700000_def456",
      "timestamp": 1760969700000,
      "type": "ValidationError",
      "message": "Invalid URL provided",
      "category": "validation"
    }
  ],
  "timestamp": "2025-10-20T14:00:00.000Z"
}
```

---

## Programmatic Usage

### Recording Errors

Errors are automatically recorded by the error handler middleware. For manual recording:

```javascript
const { recordError } = require('./utils/errorTelemetry');

try {
  // Your code
  throw new Error('Something went wrong');
} catch (error) {
  // Record the error with context
  const errorId = recordError(error, {
    requestId: req.id,
    url: req.url,
    method: req.method,
    userAgent: req.get('user-agent'),
    ip: req.ip
  });
  
  console.log(`Error recorded: ${errorId}`);
}
```

### Getting Statistics

```javascript
const { getStatistics } = require('./utils/errorTelemetry');

// Get all statistics
const allStats = getStatistics();

// Get errors from last hour
const hourlyStats = getStatistics({ timeWindow: 'hour' });

// Get programming errors
const programmingErrors = getStatistics({ category: 'programming' });

// Get TypeErrors from last day
const typeErrors = getStatistics({ 
  type: 'TypeError', 
  timeWindow: 'day' 
});
```

### Checking Error Rates

```javascript
const { getErrorRates } = require('./utils/errorTelemetry');

const rates = getErrorRates();
console.log(`Errors in last minute: ${rates.lastMinute}`);
console.log(`Errors per hour: ${rates.rates.perHour}`);
```

### Checking Thresholds

```javascript
const { checkThresholds } = require('./utils/errorTelemetry');

const check = checkThresholds();
if (check.hasViolations) {
  check.violations.forEach(violation => {
    console.error(`${violation.level}: ${violation.message}`);
    // Send alert
  });
}
```

### Finding Similar Errors

```javascript
const { getSimilarErrors } = require('./utils/errorTelemetry');

const errorId = 'err_1760969725407_abc123';
const similar = getSimilarErrors(errorId, 10); // Get up to 10 similar errors

console.log(`Found ${similar.length} similar errors`);
```

---

## Monitoring & Alerting

### Real-Time Monitoring

Set up a monitoring script to check error rates:

```javascript
// scripts/monitor-errors.js
const axios = require('axios');

async function monitorErrors() {
  try {
    const response = await axios.get('http://localhost:3000/api/admin/errors');
    const { thresholds } = response.data;
    
    if (thresholds.hasViolations) {
      thresholds.violations.forEach(violation => {
        // Send alert (email, Slack, PagerDuty, etc.)
        console.error(`ALERT: ${violation.message}`);
      });
    }
  } catch (error) {
    console.error('Failed to check error telemetry:', error.message);
  }
}

// Run every 5 minutes
setInterval(monitorErrors, 300000);
```

### Integration with Prometheus

Export error telemetry metrics for Prometheus:

```javascript
// Add to src/middleware/metrics.js
const { getErrorRates } = require('../utils/errorTelemetry');

function getErrorMetrics() {
  const rates = getErrorRates();
  
  return `
# HELP font_scanner_errors_total Total number of errors
# TYPE font_scanner_errors_total counter
font_scanner_errors_last_minute ${rates.lastMinute}
font_scanner_errors_last_hour ${rates.lastHour}
font_scanner_errors_last_day ${rates.lastDay}

# HELP font_scanner_error_rate Error rate per time window
# TYPE font_scanner_error_rate gauge
font_scanner_error_rate_per_minute ${rates.rates.perMinute}
font_scanner_error_rate_per_hour ${rates.rates.perHour}
  `.trim();
}
```

### Alerting Rules

Example Prometheus alerting rules:

```yaml
groups:
  - name: error_telemetry
    rules:
      - alert: HighErrorRate
        expr: font_scanner_errors_last_minute > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "More than 10 errors per minute for 5 minutes"
      
      - alert: CriticalErrorRate
        expr: font_scanner_errors_last_hour > 100
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Critical error rate"
          description: "More than 100 errors per hour"
```

---

## Error Lifecycle

### 1. Error Occurrence

```
Application Code → Error Thrown
```

### 2. Error Capture

```
Error Handler Middleware → Parse & Categorize → Record in Telemetry
```

### 3. Error Storage

```
Circular Buffer (max 1000) + Aggregation Map (max 100) + Rate Tracking
```

### 4. Error Query

```
Monitoring Endpoints → Return Statistics/Details
```

### 5. Error Cleanup

```
Automatic cleanup every 5 minutes → Remove errors older than retention period
```

---

## Performance Considerations

### Memory Usage

- **Circular Buffer:** ~1MB for 1000 errors (including stack traces)
- **Aggregations:** ~100KB for 100 aggregations
- **Rate Tracking:** ~10KB for rate arrays
- **Total:** ~1.1MB typical memory footprint

### Storage Limits

| Setting | Default | Recommended Range |
|---------|---------|-------------------|
| `maxErrors` | 1000 | 500 - 5000 |
| `maxAggregations` | 100 | 50 - 500 |
| `retentionHours` | 24 | 1 - 72 |

### Performance Impact

- **Recording:** < 1ms per error
- **Statistics:** < 5ms for full stats
- **Cleanup:** < 10ms per cleanup cycle

---

## Best Practices

### 1. Configure Appropriate Thresholds

```env
# Development
ERROR_TELEMETRY_THRESHOLD_MINUTE=50
ERROR_TELEMETRY_THRESHOLD_HOUR=500
ERROR_TELEMETRY_THRESHOLD_DAY=5000

# Production
ERROR_TELEMETRY_THRESHOLD_MINUTE=10
ERROR_TELEMETRY_THRESHOLD_HOUR=100
ERROR_TELEMETRY_THRESHOLD_DAY=1000
```

### 2. Monitor Error Trends

- Check error rates daily
- Investigate sudden spikes
- Track error type distribution
- Monitor similar error clusters

### 3. Use Error Categories

- **operational:** Expected, handle gracefully
- **programming:** Bugs, fix immediately
- **timeout:** May need infrastructure scaling
- **network:** External dependency issues

### 4. Context is Key

Always include context when recording errors:

```javascript
recordError(error, {
  requestId: req.id,      // Trace request flow
  url: req.url,           // Identify problematic endpoints
  method: req.method,      // HTTP method
  userAgent: req.get('user-agent'),  // Client info
  ip: req.ip,             // Source IP (privacy-aware)
  userId: req.user?.id    // User context (if authenticated)
});
```

### 5. Security Considerations

- ❌ **Don't** log sensitive data (passwords, tokens, API keys)
- ✅ **Do** sanitize error messages
- ✅ **Do** use request IDs instead of user IDs when possible
- ✅ **Do** respect privacy regulations (GDPR, CCPA)

---

## Troubleshooting

### Problem: High Memory Usage

**Symptoms:**
- Application memory grows over time
- Out of memory errors

**Solutions:**

1. **Reduce retention:**
   ```env
   ERROR_TELEMETRY_RETENTION_HOURS=12  # Reduce from 24
   ```

2. **Reduce storage limits:**
   ```env
   ERROR_TELEMETRY_MAX_ERRORS=500       # Reduce from 1000
   ERROR_TELEMETRY_MAX_AGGREGATIONS=50  # Reduce from 100
   ```

3. **Disable telemetry temporarily:**
   ```env
   ERROR_TELEMETRY_ENABLED=false
   ```

### Problem: Missing Error Data

**Symptoms:**
- Recent errors not showing up
- Empty statistics

**Diagnosis:**

```bash
# Check if telemetry is enabled
curl http://localhost:3000/api/admin/errors | jq '.statistics.summary.total'

# Check application logs
cat logs/application.log | grep "Error recorded"
```

**Solutions:**

1. **Verify configuration:**
   ```javascript
   const config = require('./config');
   console.log(config.errorTelemetry.enabled); // Should be true
   ```

2. **Check error handler integration:**
   ```javascript
   // In src/utils/errorHandler.js
   if (config.errorTelemetry?.enabled) {
     recordError(error, context);  // Should be present
   }
   ```

### Problem: Threshold Violations

**Symptoms:**
- Constant threshold violation alerts
- Error rates higher than expected

**Solutions:**

1. **Investigate error sources:**
   ```bash
   # Get error breakdown
   curl http://localhost:3000/api/admin/errors | jq '.statistics.topErrors'
   ```

2. **Adjust thresholds if needed:**
   ```env
   # If legitimate higher traffic
   ERROR_TELEMETRY_THRESHOLD_HOUR=200
   ```

3. **Fix underlying issues:**
   - Review error messages
   - Check for programming errors
   - Validate input handling
   - Review external dependencies

---

## Integration Examples

### With Sentry

```javascript
// src/utils/errorTelemetry.js
const Sentry = require('@sentry/node');

// In recordError function
if (process.env.SENTRY_DSN) {
  Sentry.captureException(error, {
    tags: {
      category: errorEntry.category,
      errorId: errorEntry.id
    },
    extra: errorEntry.context
  });
}
```

### With Datadog

```javascript
const dogstatsd = require('node-dogstatsd');
const metrics = new dogstatsd.StatsD();

// Track error rates
const { getErrorRates } = require('./utils/errorTelemetry');
setInterval(() => {
  const rates = getErrorRates();
  metrics.gauge('font_scanner.errors.last_minute', rates.lastMinute);
  metrics.gauge('font_scanner.errors.last_hour', rates.lastHour);
}, 60000);
```

### With Slack

```javascript
const axios = require('axios');

async function sendSlackAlert(violation) {
  await axios.post(process.env.SLACK_WEBHOOK_URL, {
    text: `🚨 Error Rate Alert: ${violation.message}`,
    attachments: [{
      color: violation.level === 'critical' ? 'danger' : 'warning',
      fields: [
        { title: 'Window', value: violation.window, short: true },
        { title: 'Current Rate', value: violation.current, short: true },
        { title: 'Threshold', value: violation.threshold, short: true }
      ]
    }]
  });
}

// In monitoring script
const { checkThresholds } = require('./utils/errorTelemetry');
const check = checkThresholds();
if (check.hasViolations) {
  check.violations.forEach(sendSlackAlert);
}
```

---

## Testing

Run the error telemetry tests:

```bash
# Run all tests
npm test

# Run only telemetry tests
npm test -- errorTelemetry.test.js

# With coverage
npm test -- --coverage errorTelemetry.test.js
```

**Test Coverage:**
- ✅ Error recording with context
- ✅ Null error handling
- ✅ Statistics generation
- ✅ Error rate calculation
- ✅ Data clearing
- ✅ Singleton pattern

---

## Changelog

### Version 1.0.0 (2025-10-20)

- Initial implementation of Error Telemetry System
- Automatic error capture and categorization
- Error aggregation by type and message
- Rate tracking with configurable thresholds
- Monitoring endpoints (`/api/admin/errors`)
- Integration with error handler middleware
- Memory-efficient circular buffer storage
- 6 passing unit tests
- Complete documentation

---

## Support

For issues or questions about the error telemetry system:

1. Check error telemetry statistics: `GET /api/admin/errors`
2. Review application logs: `logs/application.log`
3. Consult this documentation
4. Check GitHub issues for known problems

---

**Document Version:** 1.0.0  
**Last Updated:** 2025-10-20  
**Maintainer:** Font Scanner Team
