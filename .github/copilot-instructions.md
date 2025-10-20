# Font Scanner - AI Coding Agent Instructions

## Project Overview

Enterprise-grade web application that analyzes websites for fonts, typography, accessibility, and performance using Puppeteer, Lighthouse, and advanced font metrics. Built for production with Docker/Kubernetes deployment, comprehensive monitoring, and security-first design.

## Architecture & Core Patterns

### Layered Service Architecture
- **Controllers** (`src/controllers/`) - HTTP request handlers with validation
- **Services** (`src/services/`) - 20+ specialized analyzers (fonts, Lighthouse, accessibility, cross-browser)
- **Utils** (`src/utils/`) - Shared infrastructure (logger, cache, browser pool, error telemetry)
- **Middleware** (`src/middleware/`) - Request ID tracking, rate limiting, Prometheus metrics

### Critical Performance Pattern: Browser Pool
**ALWAYS use the browser pool singleton** from `src/utils/browserPool.js` - never create standalone Puppeteer instances:

```javascript
const browserPool = require('../utils/browserPool');

// ✅ Correct - uses pooling
const result = await browserPool.execute(async (browser) => {
  const page = await browser.newPage();
  // ... work with page
  return result;
});

// ❌ Never do this - creates new browser every time
const browser = await puppeteer.launch();
```

Benefits: 70-90% faster response times, 5x higher throughput. Pool config in `src/config/index.js` under `browserPool.*`

### Error Handling Convention
Use custom error classes from `src/utils/errorHandler.js`:

```javascript
const { ValidationError, TimeoutError, asyncHandler } = require('../utils/errorHandler');

// Wrap async route handlers
const handler = asyncHandler(async (req, res) => {
  if (!input) throw new ValidationError('Specific user-facing message');
  // Errors automatically recorded in telemetry + Prometheus metrics
});
```

Error telemetry tracks patterns, aggregates by type/category, accessible via `/api/admin/errors`

### Logging Standards
All modules use contextual loggers with automatic sanitization:

```javascript
const { createLogger } = require('../utils/logger');
const logger = createLogger('ModuleName'); // Shows in logs

logger.info('User action', { url, requestId: req.id }); // Structured context
logger.error('Operation failed:', error); // Auto-sanitizes passwords/tokens
```

Request IDs flow through entire stack via `req.id` (set by `requestId` middleware)

## Development Workflows

### Running the Application
```bash
npm start              # Production mode
npm run dev            # Development with nodemon
make docker-compose    # Full Docker environment
make k8s-deploy        # Kubernetes deployment
```

Task available: "Start Font Scanner" runs `npm start` in background

### Testing Strategy
```bash
npm test               # Jest test suite (158+ tests)
```

Tests organized by layer:
- `tests/integration/` - E2E API workflows
- `tests/middleware/` - Rate limiting, metrics
- `tests/utils/` - Validators, sanitizers, cache

### Configuration Management
**All config centralized in `src/config/index.js`** - uses env vars with fallbacks:
- Rate limits (global, per-endpoint)
- Browser pool (min/max, timeouts)
- Error telemetry thresholds
- Report retention (7 days default)

Never hardcode values - always reference `config` object

## Critical Integration Points

### Service Composition
Services are **dependency-injected singletons** - import and use directly:

```javascript
// fontScannerService.js exports singleton
const fontScannerService = require('../services/fontScannerService');
const result = await fontScannerService.scanFonts(url);
```

Main scan orchestration in `enhancedScannerService.performComprehensiveScan()` - coordinates 9 analyzers

### Scoring Algorithm (Critical!)
Enhanced mode uses **strict validation** - only working analyzers contribute to scores:
- NO default scores for failed/missing analyzers (they're excluded entirely)
- Completeness bonus (0-3 points) only applies if base score > 70 AND ≥70% features work
- All scoring includes detailed `scoringBreakdown` object showing what contributed
- Check logs for `✅ Component scored: XX` vs `⏭️ Component excluded`

**Never assume** a score component will be present - always check for errors and null values

### Middleware Stack Order (in server.js)
1. Security (Helmet, CORS)
2. Rate limiting (global, then endpoint-specific)
3. Request ID tracking
4. Metrics collection
5. Body parsing

**Do not reorder** - metrics and request IDs must be early, rate limiting before heavy processing

### Admin Endpoints
Protected endpoints for operational visibility:
- `/api/admin/rate-limits` - Violations, top offenders, analytics
- `/api/admin/errors` - Error patterns, rates, thresholds
- `/api/reports/stats` - Cleanup statistics
- `/metrics` - Prometheus scrape endpoint

## Project-Specific Quirks

### Graceful Shutdown Pattern
`server.js` implements comprehensive shutdown via `gracefulShutdown()`:
1. Set `isShuttingDown = true` (readiness probe fails)
2. Stop accepting new connections
3. Drain browser pool (closes all Puppeteer instances)
4. Stop cleanup scheduler
5. Force exit after 30s timeout

When adding async resources, **always register cleanup** in `gracefulShutdown()`

### Cache Strategy
`src/utils/cache.js` provides TTL-based in-memory cache:
- Basic scans cached (15min default)
- Comprehensive scans always fresh
- Check cache before expensive operations: `defaultCache.get(key, metadata)`

### Report Management
PDF reports in `./reports/` auto-cleanup via `src/utils/reportCleanup.js`:
- Scheduled daily via node-cron
- Retention: 7 days (configurable)
- Manual: `node scripts/cleanup-reports.js`

## Security Conventions

### Input Validation Pipeline
Every user URL goes through `src/utils/validators.js`:
1. `sanitizeUrl()` - Remove dangerous chars
2. `normalizeUrl()` - Add protocol if missing
3. `validateUrl()` - Format check
4. `testUrlReachability()` - Network check (try HTTPS, fallback HTTP)
5. `isValidDomain()` - Prevent localhost/internal IPs

**Never skip validation** - prevents SSRF and injection attacks

### Automatic Log Sanitization
Logger auto-redacts (disable with `DISABLE_LOG_SANITIZATION=true`):
- Passwords, API keys, tokens
- Email addresses, IP addresses
- JWT tokens, credentials in URLs

## Documentation References

- `ARCHITECTURE_REVIEW.md` - Full architecture analysis, scoring A- (90/100)
- `BROWSER_POOL_IMPLEMENTATION.md` - Performance optimization details
- `DEPLOYMENT.md` - Docker/K8s deployment patterns
- `SECURITY.md` - Threat model, security controls
- `docs/ERROR_TELEMETRY.md` - Error tracking implementation
- `Makefile` - All available commands with descriptions