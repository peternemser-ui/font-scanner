# Rate Limiting Implementation Guide

## 📋 Overview

Font Scanner implements **multi-tier rate limiting** to protect against abuse while ensuring legitimate users have a good experience. The rate limiting system is:

- ✅ **Per-IP based** - Each IP address has its own quota
- ✅ **Endpoint-specific** - Different limits for different operations
- ✅ **Prometheus integrated** - Full metrics and monitoring
- ✅ **Request ID aware** - Correlates with request tracking
- ✅ **Highly configurable** - Environment variable control
- ✅ **Production-ready** - Redis-compatible for distributed systems

---

## 🎯 Rate Limit Tiers

### 1. **Global Rate Limiter** (All Endpoints)

Applies to all API requests to prevent general abuse.

| Setting | Default | Environment Variable | Description |
|---------|---------|---------------------|-------------|
| **Window** | 15 minutes | `RATE_LIMIT_WINDOW_MS` | Time window for counting requests |
| **Max Requests** | 100 | `RATE_LIMIT_MAX_REQUESTS` | Maximum requests per IP per window |

**Applies to:** All `/api/*` endpoints (except health checks)

**Use case:** Prevents bots from overwhelming the API with any type of request.

### 2. **Scan Rate Limiter** (Scan Endpoints)

More restrictive for resource-intensive scanning operations.

| Setting | Default | Environment Variable | Description |
|---------|---------|---------------------|-------------|
| **Window** | 15 minutes | `SCAN_RATE_LIMIT_WINDOW_MS` | Time window for counting scans |
| **Max Requests** | 20 | `SCAN_RATE_LIMIT_MAX_REQUESTS` | Maximum scans per IP per window |

**Applies to:**
- `POST /api/scan` - Basic font scan
- `POST /api/scan/best-in-class` - Comprehensive scan

**Use case:** Scans consume significant resources (Puppeteer, Lighthouse). Limit prevents resource exhaustion.

### 3. **Download Rate Limiter** (Report Downloads)

Protects against excessive report downloads.

| Setting | Default | Environment Variable | Description |
|---------|---------|---------------------|-------------|
| **Window** | 15 minutes | `DOWNLOAD_RATE_LIMIT_WINDOW_MS` | Time window for counting downloads |
| **Max Requests** | 50 | `DOWNLOAD_RATE_LIMIT_MAX_REQUESTS` | Maximum downloads per IP per window |

**Applies to:**
- `GET /api/reports/:filename` - PDF report download

**Use case:** Prevents bandwidth abuse and automated scraping of reports.

### 4. **Strict Limiter** (Reserved for Future Use)

Very aggressive limits for brute-force sensitive endpoints.

| Setting | Default | Description |
|---------|---------|-------------|
| **Window** | 5 minutes | Fixed |
| **Max Requests** | 5 | Fixed |

**Currently unused**, but available for:
- Login endpoints (if authentication is added)
- Password reset
- API key generation
- Other security-sensitive operations

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file or set environment variables:

```bash
# Global rate limit
RATE_LIMIT_WINDOW_MS=900000        # 15 minutes (default)
RATE_LIMIT_MAX_REQUESTS=100        # 100 requests per 15 min (default)

# Scan endpoint rate limit
SCAN_RATE_LIMIT_WINDOW_MS=900000   # 15 minutes (default)
SCAN_RATE_LIMIT_MAX_REQUESTS=20    # 20 scans per 15 min (default)

# Download endpoint rate limit
DOWNLOAD_RATE_LIMIT_WINDOW_MS=900000   # 15 minutes (default)
DOWNLOAD_RATE_LIMIT_MAX_REQUESTS=50    # 50 downloads per 15 min (default)
```

### Production Recommendations

**Small Deployment (1-100 users):**
```bash
RATE_LIMIT_MAX_REQUESTS=200
SCAN_RATE_LIMIT_MAX_REQUESTS=30
DOWNLOAD_RATE_LIMIT_MAX_REQUESTS=100
```

**Medium Deployment (100-1000 users):**
```bash
RATE_LIMIT_MAX_REQUESTS=500
SCAN_RATE_LIMIT_MAX_REQUESTS=50
DOWNLOAD_RATE_LIMIT_MAX_REQUESTS=200
```

**Large Deployment (1000+ users):**
```bash
RATE_LIMIT_MAX_REQUESTS=1000
SCAN_RATE_LIMIT_MAX_REQUESTS=100
DOWNLOAD_RATE_LIMIT_MAX_REQUESTS=500
```

**Public API (with authentication):**
```bash
# Tier 1: Free tier
RATE_LIMIT_MAX_REQUESTS=100
SCAN_RATE_LIMIT_MAX_REQUESTS=10

# Tier 2: Paid tier (configure separately)
RATE_LIMIT_MAX_REQUESTS=1000
SCAN_RATE_LIMIT_MAX_REQUESTS=100
```

---

## 📊 Response Headers

When a request is made, the API returns rate limit information in headers:

```http
RateLimit-Limit: 100
RateLimit-Remaining: 87
RateLimit-Reset: 1698765432
```

| Header | Description |
|--------|-------------|
| `RateLimit-Limit` | Maximum requests allowed in window |
| `RateLimit-Remaining` | Requests remaining before limit hit |
| `RateLimit-Reset` | Unix timestamp when limit resets |

**Client Usage:**
```javascript
const response = await fetch('http://localhost:3000/api/scan', options);

const limit = response.headers.get('RateLimit-Limit');
const remaining = response.headers.get('RateLimit-Remaining');
const reset = new Date(response.headers.get('RateLimit-Reset') * 1000);

console.log(`You have ${remaining}/${limit} requests remaining`);
console.log(`Limit resets at ${reset.toLocaleString()}`);
```

---

## 🚨 Rate Limit Exceeded Response

When a client exceeds the rate limit, they receive a **429 Too Many Requests** response:

```json
{
  "error": "Too Many Requests",
  "message": "Too many scan requests. Scanning is resource-intensive. Please try again in 15 minutes.",
  "retryAfter": 900,
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "details": {
    "limit": 20,
    "window": "900 seconds",
    "limiter": "scan"
  }
}
```

| Field | Description |
|-------|-------------|
| `error` | Error type (always "Too Many Requests") |
| `message` | Human-readable explanation |
| `retryAfter` | Seconds until limit resets |
| `requestId` | Unique request ID for support |
| `details.limit` | Maximum requests allowed |
| `details.window` | Time window in seconds |
| `details.limiter` | Which rate limiter was triggered |

---

## 📈 Monitoring & Metrics

### Prometheus Metrics

Rate limiting emits the following Prometheus metrics:

```
# HELP font_scanner_rate_limit_hits_total Total number of rate limit hits
# TYPE font_scanner_rate_limit_hits_total counter
font_scanner_rate_limit_hits_total{limiter="global",endpoint="/api/scan"} 5
font_scanner_rate_limit_hits_total{limiter="scan",endpoint="/api/scan"} 12
font_scanner_rate_limit_hits_total{limiter="download",endpoint="/api/reports"} 3
```

**Labels:**
- `limiter`: Which rate limiter triggered (global, scan, download)
- `endpoint`: Which endpoint was accessed

### Rate Limit Stats Endpoint

Query current rate limit configuration:

```bash
GET /api/rate-limits
```

**Response:**
```json
{
  "limits": {
    "global": {
      "window": "15 minutes",
      "limit": 100
    },
    "scan": {
      "window": "15 minutes",
      "limit": 20
    },
    "download": {
      "window": "15 minutes",
      "limit": 50
    }
  },
  "message": "Current rate limit configuration"
}
```

### Logging

When a rate limit is hit, a warning is logged:

```
[2025-10-18T20:30:15.123Z] [WARN] [RateLimiter] Rate limit exceeded {
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "ip": "192.168.1.100",
  "endpoint": "/api/scan",
  "limiter": "scan",
  "limit": 20,
  "window": "900s"
}
```

**High usage alerts** (when usage exceeds 80%):

```
[2025-10-18T20:30:15.123Z] [INFO] [RateLimiter] High rate limit usage {
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "ip": "192.168.1.100",
  "endpoint": "/api/scan",
  "remaining": 3,
  "limit": 20,
  "usage": "85.0%",
  "reset": "2025-10-18T20:45:00.000Z"
}
```

---

## 🔍 Troubleshooting

### Problem: Users complaining about rate limits

**Solution 1: Check current limits**
```bash
# Check environment variables
env | grep RATE_LIMIT

# Check current config via API
curl http://localhost:3000/api/rate-limits
```

**Solution 2: Increase limits temporarily**
```bash
# Increase scan limit to 50
export SCAN_RATE_LIMIT_MAX_REQUESTS=50

# Restart server
npm start
```

**Solution 3: Monitor Prometheus metrics**
```bash
# Check rate limit hits
curl http://localhost:3000/metrics | grep rate_limit
```

### Problem: Legitimate users getting blocked

**Root causes:**
1. **Shared IP (NAT/VPN)** - Multiple users behind same IP
2. **Aggressive usage** - Automated testing, CI/CD
3. **Limits too low** - Not appropriate for user base

**Solutions:**

**Option 1: Whitelist IPs**

Modify `src/middleware/rateLimiter.js`:

```javascript
const createRateLimiter = (name, options) => {
  const defaultOptions = {
    // ... existing code ...
    
    skip: (req) => {
      const ip = req.ip || req.socket.remoteAddress;
      
      // Whitelist specific IPs
      const whitelist = (process.env.RATE_LIMIT_WHITELIST || '').split(',');
      if (whitelist.includes(ip)) {
        return true;
      }
      
      // Don't count health checks
      if (req.path === '/api/health' || req.path === '/api/ready') {
        return true;
      }
      
      return false;
    },
  };
  // ...
};
```

Then set environment variable:
```bash
RATE_LIMIT_WHITELIST=10.0.0.1,10.0.0.2,192.168.1.100
```

**Option 2: API Keys (Future Enhancement)**

Implement authentication-based rate limiting where authenticated users get higher limits.

**Option 3: Dynamic Limits Based on Behavior**

Use `express-slow-down` for gradual throttling instead of hard limits.

### Problem: Rate limits not working

**Check 1: Middleware order**

Ensure rate limiters are registered before routes:

```javascript
// ✅ CORRECT ORDER:
app.use(globalLimiter);         // First
app.post('/api/scan', ...);     // After

// ❌ WRONG ORDER:
app.post('/api/scan', ...);     // Before
app.use(globalLimiter);         // After (won't apply)
```

**Check 2: Key generator**

By default, rate limiting is per-IP. Behind a proxy, ensure IP forwarding is configured:

```javascript
// In server.js
app.set('trust proxy', 1); // Trust first proxy
```

**Check 3: Store configuration**

In-memory store is reset on server restart. For persistent rate limiting, use Redis:

```bash
npm install rate-limit-redis
```

```javascript
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

const globalLimiter = createRateLimiter('global', {
  store: new RedisStore({
    client: client,
    prefix: 'rl:global:',
  }),
  // ... other options
});
```

---

## 🏗️ Architecture

### Request Flow

```
┌─────────────┐
│   Client    │
│ 192.168.1.1 │
└──────┬──────┘
       │
       │ POST /api/scan
       ▼
┌─────────────────────┐
│  Request ID         │ ← Assigns unique ID
│  Middleware         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Global Rate        │ ← Check: 87/100 remaining ✅
│  Limiter            │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Scan Rate          │ ← Check: 21/20 limit ❌
│  Limiter            │   REJECT with 429
└──────┬──────────────┘
       │
       ▼ (if passed)
┌─────────────────────┐
│  Scan Controller    │ ← Process scan
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Response           │ ← Return result + headers
│  + Headers          │   RateLimit-Remaining: 19
└─────────────────────┘
```

### Multi-Layer Defense

```
Layer 1: Global Limiter (100/15min)
  ↓ Prevents general API abuse
  
Layer 2: Endpoint-Specific Limiter (20/15min for scans)
  ↓ Prevents resource exhaustion
  
Layer 3: Application Logic
  ↓ Browser pool, timeouts, validation
  
Layer 4: Infrastructure
  ↓ Firewall, DDoS protection, CDN
```

---

## 🚀 Advanced Configurations

### Distributed Systems (Multiple Servers)

Use Redis for shared rate limit state:

```javascript
const RedisStore = require('rate-limit-redis');

const scanLimiter = createRateLimiter('scan', {
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
  windowMs: 15 * 60 * 1000,
  max: 20,
});
```

### Custom Key Generators

Rate limit by user ID instead of IP:

```javascript
const userLimiter = createRateLimiter('user', {
  keyGenerator: (req) => {
    // Requires authentication middleware
    return req.user?.id || 'anonymous';
  },
  windowMs: 15 * 60 * 1000,
  max: 50,
});
```

### Sliding Window

More accurate rate limiting using sliding window algorithm:

```javascript
const slidingLimiter = createRateLimiter('sliding', {
  windowMs: 15 * 60 * 1000,
  max: 100,
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
  // Uses sliding window by default in express-rate-limit v6+
});
```

### Different Limits for Authenticated Users

```javascript
const dynamicLimiter = createRateLimiter('dynamic', {
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    if (req.user?.plan === 'premium') {
      return 1000; // Premium users: 1000/15min
    } else if (req.user?.plan === 'basic') {
      return 100;  // Basic users: 100/15min
    }
    return 20;     // Anonymous: 20/15min
  },
});
```

---

## ✅ Best Practices

### 1. **Always Return Rate Limit Headers**
- Clients can adjust behavior proactively
- Improves user experience
- Enables client-side retry logic

### 2. **Log Rate Limit Hits**
- Track abuse patterns
- Identify legitimate users hitting limits
- Adjust limits based on real usage

### 3. **Use Different Limits for Different Operations**
- Expensive operations (scans) → Lower limits
- Cheap operations (static files) → Higher limits
- Read operations → Higher than write operations

### 4. **Consider Graduated Throttling**
- Instead of hard blocking, slow down requests gradually
- Use `express-slow-down` for warning phase before hard limit

### 5. **Monitor Usage Patterns**
- Track 80% usage warnings
- Alert when rate limits are frequently hit
- Adjust limits based on actual usage

### 6. **Plan for Scaling**
- Use Redis for distributed rate limiting
- Consider CDN for static assets
- Implement caching to reduce backend load

### 7. **Communicate Limits Clearly**
- Document limits in API documentation
- Return helpful error messages
- Provide contact for limit increases

---

## 📝 Testing

### Manual Testing

**Test global rate limit:**
```bash
# Make 101 requests quickly
for i in {1..101}; do
  curl -w "\n%{http_code}\n" http://localhost:3000/api/test
done

# First 100 should return 200
# 101st should return 429
```

**Test scan rate limit:**
```bash
# Make 21 scan requests
for i in {1..21}; do
  curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"url":"https://example.com"}' \
    -w "\n%{http_code}\n" \
    http://localhost:3000/api/scan
done

# First 20 should process
# 21st should return 429
```

**Check rate limit headers:**
```bash
curl -I http://localhost:3000/api/test | grep RateLimit
```

### Automated Testing

```javascript
const request = require('supertest');
const app = require('../src/server');

describe('Rate Limiting', () => {
  it('should enforce global rate limit', async () => {
    // Make 100 requests (should all succeed)
    for (let i = 0; i < 100; i++) {
      const res = await request(app).get('/api/test');
      expect(res.status).toBe(200);
    }
    
    // 101st request should be rate limited
    const res = await request(app).get('/api/test');
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('retryAfter');
  });
  
  it('should return rate limit headers', async () => {
    const res = await request(app).get('/api/test');
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
    expect(res.headers).toHaveProperty('ratelimit-reset');
  });
});
```

---

## 📚 Resources

- **express-rate-limit documentation:** https://github.com/express-rate-limit/express-rate-limit
- **Redis store:** https://github.com/express-rate-limit/rate-limit-redis
- **Rate limiting best practices:** https://cloud.google.com/architecture/rate-limiting-strategies-techniques
- **HTTP 429 specification:** https://tools.ietf.org/html/rfc6585#section-4

---

## 🎯 Summary

Font Scanner implements a **multi-tier rate limiting strategy**:

1. ✅ **Global limiter**: 100 req/15min - Prevents general abuse
2. ✅ **Scan limiter**: 20 scans/15min - Protects expensive operations
3. ✅ **Download limiter**: 50 downloads/15min - Prevents bandwidth abuse
4. ✅ **Full monitoring**: Prometheus metrics + request ID correlation
5. ✅ **Configurable**: Environment variables for all limits
6. ✅ **Production-ready**: Redis-compatible for distributed systems

**Need to adjust limits?** Set environment variables and restart:
```bash
export SCAN_RATE_LIMIT_MAX_REQUESTS=50
npm start
```

**Questions?** Check logs, Prometheus metrics, or `/api/rate-limits` endpoint.

