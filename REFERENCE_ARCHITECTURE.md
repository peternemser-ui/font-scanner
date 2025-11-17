# Font Scanner - Architecture Reference

## Project Overview
**Application Name:** Font Scanner – Comprehensive Web Analysis Platform  
**Purpose:** Production-ready internal tool for WordPress Architects to baseline and analyze website digital health  
**Primary Use Case:** Evaluate client websites before WordPress modernization or headless migration  
**Technology Stack:** Node.js/Express backend, Vanilla JavaScript frontend, Puppeteer for browser automation, Lighthouse for audits

## System Architecture

### Backend Services (Node.js/Express)
```
src/
├── server.js                          # Main Express application entry point
├── config/
│   └── index.js                       # Centralized configuration management
├── controllers/
│   ├── fontScannerController.js      # Typography analysis endpoints
│   ├── seoController.js              # SEO analysis endpoints
│   ├── performanceController.js      # Performance/Lighthouse endpoints
│   ├── accessibilityController.js    # WCAG compliance endpoints
│   ├── securityController.js         # Security audit endpoints
│   ├── coreWebVitalsController.js    # Google Core Web Vitals endpoints
│   ├── competitiveController.js      # Multi-site comparison endpoints
│   └── dashboardController.js        # Unified dashboard endpoints
├── services/
│   ├── fontScannerService.js         # Font detection and analysis
│   ├── seoAnalyzerService.js         # Technical SEO evaluation
│   ├── performanceAnalyzerService.js # Lighthouse integration
│   ├── accessibilityAnalyzerService.js # WCAG 2.1 testing
│   ├── securityAnalyzerService.js    # SSL/TLS and security headers
│   ├── coreWebVitalsService.js       # LCP, INP, CLS measurement
│   ├── competitiveAnalysisService.js # Competitor comparison
│   ├── dashboardService.js           # Unified orchestration
│   ├── lighthouseAnalyzer.js         # Lighthouse runner (120s timeout)
│   ├── fontPairingAnalyzer.js        # Typography harmony evaluation
│   ├── fontLicensingDetector.js      # License compliance checking
│   └── enhancedScannerService.js     # Comprehensive mode coordinator
├── utils/
│   ├── browserPool.js                # Puppeteer instance pooling (70-90% perf gain)
│   ├── cache.js                      # TTL-based in-memory caching
│   ├── logger.js                     # Structured logging with sanitization
│   ├── errorHandler.js               # Custom error classes and telemetry
│   ├── validators.js                 # URL validation and sanitization
│   └── reportCleanup.js              # Automated PDF report cleanup
└── middleware/
    ├── requestId.js                  # Request tracking throughout stack
    ├── rateLimiter.js               # Rate limiting (global + per-endpoint)
    └── metrics.js                   # Prometheus metrics collection
```

### Frontend Architecture (Vanilla JavaScript)
```
src/public/
├── index.html                        # Main font scanner page
├── dashboard.html                    # Unified analysis dashboard
├── seo-analyzer.html                 # SEO-specific analyzer
├── performance-analyzer.html         # Performance/Lighthouse analyzer
├── accessibility-analyzer.html       # WCAG compliance analyzer
├── security-analyzer.html            # Security audit analyzer
├── core-web-vitals.html             # Core Web Vitals analyzer
├── competitive-analysis.html         # Multi-site comparison
├── scripts/
│   ├── script.js                    # Main font scanner logic
│   ├── dashboard-script.js          # Dashboard WebSocket orchestration
│   ├── seo-script.js                # SEO analyzer UI
│   ├── performance-script.js        # Performance analyzer UI
│   ├── accessibility-script.js      # Accessibility analyzer UI
│   ├── security-script.js           # Security analyzer UI
│   ├── cwv-script.js               # Core Web Vitals UI
│   ├── competitive-script.js        # Competitive analysis UI
│   ├── nav-template.js              # Unified navigation component
│   ├── theme-controls.js            # Dark/light theme toggle
│   ├── analyzer-loader.js           # Loading animations and progress
│   ├── seo-visualizations.js        # Chart/visualization library
│   └── performance-visualizations.js # Performance-specific charts
└── styles/
    ├── styles.css                   # Global design system
    ├── design-tokens.css            # CSS variables and theme tokens
    ├── components.css               # Reusable UI components
    ├── layout.css                   # Page layout and grid system
    ├── progress-styles.css          # Loading indicators
    └── analyzer-loading.css         # Analyzer-specific loading states
```

## Key Technical Patterns

### 1. Browser Pool Pattern (Critical for Performance)
**Implementation:** `src/utils/browserPool.js`  
**Benefits:** 70-90% faster response times, 5x higher throughput  
**How It Works:**
- Maintains pool of 2-10 Puppeteer browser instances
- Reuses instances instead of creating new browsers per request
- Automatic cleanup and recycling
- Configuration: `src/config/index.js` → `browserPool.*`

**Usage Pattern:**
```javascript
const browserPool = require('../utils/browserPool');

const result = await browserPool.execute(async (browser) => {
  const page = await browser.newPage();
  // Perform analysis
  return result;
});
```

### 2. Error Handling & Telemetry
**Implementation:** `src/utils/errorHandler.js`  
**Features:**
- Custom error classes: `ValidationError`, `TimeoutError`, `NetworkError`
- Automatic error tracking and aggregation
- Error rate monitoring with thresholds
- Context preservation through request IDs
- Admin endpoint: `GET /api/admin/errors`

### 3. Request ID Tracking
**Implementation:** `src/middleware/requestId.js`  
**Purpose:** End-to-end traceability for debugging  
**Flow:** Middleware → Controller → Service → Logger  
**Accessible via:** `req.id` throughout the stack

### 4. Caching Strategy
**Implementation:** `src/utils/cache.js`  
**Rules:**
- Basic scans: 15-minute TTL
- Comprehensive scans: Always fresh
- Cache key: Normalized URL
- Check before expensive operations

### 5. Real-time Progress (WebSocket)
**Implementation:** Socket.IO integration  
**Used By:** Dashboard, Competitive Analysis  
**Features:**
- Step-by-step progress updates
- Time remaining estimates
- Error propagation
- Automatic reconnection

## Analysis Categories

### 1. Typography Analysis (Font Scanner)
**Endpoint:** `POST /api/scan`  
**Capabilities:**
- Font detection (Google Fonts, web fonts, system fonts)
- Font pairing analysis and recommendations
- Font licensing detection (commercial vs free)
- Performance impact estimation
- CSS declaration generation with fallback stacks
- Font size and readability metrics

**Modes:**
- **Basic:** Quick detection and metrics (3-5 seconds)
- **Enhanced:** Deep analysis with cross-browser testing (15-30 seconds)

### 2. SEO Analysis
**Endpoint:** `POST /api/seo`  
**Evaluates:**
- Meta tags (title, description, Open Graph, Twitter Cards)
- Heading structure (H1-H6 hierarchy)
- Content quality (word count, readability, keyword density)
- Image optimization (alt text, lazy loading)
- Link analysis (internal/external, broken links)
- Mobile responsiveness
- Structured data (Schema.org markup)
- Robots.txt and sitemap.xml

### 3. Performance Analysis
**Endpoint:** `POST /api/performance`  
**Measures:**
- Lighthouse scores (performance, accessibility, best practices, SEO)
- Core Web Vitals (LCP, INP, CLS)
- Network analysis (resource loading, waterfall)
- Resource breakdown (JS, CSS, images, fonts)
- Desktop vs Mobile comparison
- Time to Interactive (TTI), First Contentful Paint (FCP)

### 4. Accessibility Analysis
**Endpoint:** `POST /api/accessibility`  
**Tests:**
- WCAG 2.1 compliance (Level A, AA, AAA)
- Color contrast ratios (WCAG AA/AAA)
- Keyboard navigation
- Screen reader compatibility
- Form accessibility
- Interactive element testing

### 5. Security Analysis
**Endpoint:** `POST /api/security`  
**Audits:**
- SSL/TLS certificates (validation, expiration, cipher suites)
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- OWASP Top 10 vulnerability scanning
- Cookie security (Secure, HttpOnly, SameSite)
- Mixed content detection
- Third-party script analysis

### 6. Core Web Vitals
**Endpoint:** `POST /api/cwv`  
**Google Ranking Factors:**
- **LCP:** Largest Contentful Paint (≤2.5s = Good)
- **INP:** Interaction to Next Paint (≤200ms = Good)
- **CLS:** Cumulative Layout Shift (≤0.1 = Good)

### 7. Competitive Analysis
**Endpoint:** `POST /api/competitive/analyze`  
**Compares:**
- Your site vs up to 5 competitors
- All metrics side-by-side
- Competitive ranking and positioning
- Strengths/weaknesses identification
- Takes 5-15 minutes for full analysis

### 8. Unified Dashboard
**Endpoint:** `POST /api/dashboard/analyze`  
**Orchestrates:**
- Parallel execution of all analyzers
- Real-time WebSocket progress
- Aggregate scoring and health metrics
- Performance health timeline
- Deep-dive links to detailed analyses

## API Endpoints Reference

### Analysis Endpoints
- `POST /api/scan` - Font analysis (basic or enhanced mode)
- `POST /api/seo` - SEO analysis
- `POST /api/performance` - Performance/Lighthouse analysis
- `POST /api/accessibility` - Accessibility/WCAG analysis
- `POST /api/security` - Security audit
- `POST /api/cwv` - Core Web Vitals measurement
- `POST /api/competitive/analyze` - Competitive analysis (multi-site)
- `POST /api/dashboard/analyze` - Unified dashboard analysis

### Administrative Endpoints
- `GET /api/health` - Health check
- `GET /api/admin/rate-limits` - Rate limit statistics and violations
- `GET /api/admin/errors` - Error telemetry and patterns
- `GET /api/reports/stats` - PDF report cleanup statistics
- `GET /metrics` - Prometheus metrics scrape endpoint

## Configuration Management

### Environment Variables
Located in: `src/config/index.js`

**Critical Settings:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (production/development)
- `BROWSER_POOL_MIN` - Minimum browser instances (default: 2)
- `BROWSER_POOL_MAX` - Maximum browser instances (default: 10)
- `LIGHTHOUSE_TIMEOUT_MS` - Lighthouse timeout (default: 120000ms)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window (default: 900000ms)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

**Rate Limiting Configuration:**
```javascript
{
  global: { windowMs: 15 * 60 * 1000, max: 100 },
  scan: { windowMs: 5 * 60 * 1000, max: 10 },
  dashboard: { windowMs: 15 * 60 * 1000, max: 5 },
  competitive: { windowMs: 30 * 60 * 1000, max: 3 }
}
```

## Security Measures

### Input Validation Pipeline
**Implementation:** `src/utils/validators.js`  
**Process:**
1. `sanitizeUrl()` - Remove dangerous characters
2. `normalizeUrl()` - Add protocol if missing
3. `validateUrl()` - Format check
4. `testUrlReachability()` - Network check (HTTPS first, fallback HTTP)
5. `isValidDomain()` - Prevent localhost/internal IPs (SSRF protection)

### Automatic Log Sanitization
**Implementation:** `src/utils/logger.js`  
**Redacts:**
- Passwords, API keys, tokens
- Email addresses, IP addresses
- JWT tokens, credentials in URLs
- Can be disabled: `DISABLE_LOG_SANITIZATION=true`

### Security Headers
**Implementation:** Helmet middleware  
**Includes:**
- Content Security Policy
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

## Performance Characteristics

### Response Times
- Basic font scan: 3-5 seconds
- Comprehensive font scan: 15-30 seconds
- SEO analysis: 5-10 seconds
- Performance/Lighthouse audit: 30-60 seconds
- Accessibility analysis: 10-20 seconds
- Security audit: 5-10 seconds
- Core Web Vitals: 15-30 seconds
- Competitive analysis (5 sites): 5-15 minutes
- Dashboard unified analysis: 60-120 seconds

### Throughput & Concurrency
- **Without Browser Pool:** ~2-3 requests/minute
- **With Browser Pool:** ~15-20 requests/minute (5x improvement)
- **Concurrent Scans:** Limited by pool size (2-10 instances)
- **Cache Hit Rate:** ~30-40% for repeated URLs

## Deployment Options

### Docker
**Files:** `Dockerfile`, `docker-compose.yml`
```bash
docker-compose up -d
```

### Kubernetes
**Files:** `k8s/` directory with manifests
```bash
kubectl apply -f k8s/
```

### Direct
```bash
npm install
npm start  # Production
npm run dev  # Development with nodemon
```

## Monitoring & Observability

### Metrics Collection
**Endpoint:** `GET /metrics` (Prometheus format)  
**Tracks:**
- Request counts by endpoint
- Response times (p50, p95, p99)
- Error rates
- Browser pool utilization
- Cache hit/miss rates

### Logging
**Format:** Structured JSON logs  
**Includes:**
- Request ID for tracing
- Timestamp, level, message
- Contextual data (URL, user-agent, etc.)
- Automatic sanitization of sensitive data

### Error Telemetry
**Endpoint:** `GET /api/admin/errors`  
**Provides:**
- Error patterns and aggregation
- Error rates by type/category
- Threshold monitoring
- Recent error samples

## Data Retention & Cleanup

### PDF Reports
**Location:** `./reports/`  
**Retention:** 7 days (configurable)  
**Cleanup:** Automated via node-cron  
**Manual:** `node scripts/cleanup-reports.js`

### Cache
**Type:** In-memory  
**TTL:** 15 minutes (basic scans)  
**Cleared on:** Server restart

### Logs
**Retention:** Configured via logger settings  
**Rotation:** Recommended via external log management

## Testing

### Test Suite
**Framework:** Jest  
**Coverage:** 158+ tests  
**Categories:**
- Integration tests (E2E API workflows)
- Middleware tests (rate limiting, metrics)
- Utility tests (validators, sanitizers, cache)

**Run Tests:**
```bash
npm test
```

## Use Cases for WordPress Architects

### 1. Pre-Migration Assessment
**Scenario:** Client wants to migrate from traditional WordPress to headless  
**Analysis:** Run comprehensive scan to identify:
- Current font loading strategy and performance impact
- SEO technical debt (missing meta tags, poor structure)
- Accessibility compliance gaps
- Security vulnerabilities
- Core Web Vitals baseline for comparison post-migration

### 2. Technical Debt Evaluation
**Scenario:** Inherited legacy WordPress site needs modernization  
**Analysis:** Use dashboard for unified view:
- Identify performance bottlenecks (render-blocking resources)
- Document accessibility violations for remediation
- Assess security posture and compliance
- Establish baseline metrics for improvement tracking

### 3. Competitive Analysis
**Scenario:** Client wants to outrank competitors  
**Analysis:** Run competitive scan with client + 5 competitors:
- Compare performance scores
- Identify competitor advantages (better CWV, accessibility)
- Find gaps in SEO implementation
- Provide data-driven recommendations

### 4. Client Reporting
**Scenario:** Need to justify modernization investment  
**Analysis:** Generate comprehensive reports showing:
- Current state baseline across all categories
- Specific issues with business impact
- Prioritized recommendations
- ROI projections based on performance improvements

### 5. Ongoing Monitoring
**Scenario:** Track site health over time  
**Analysis:** Regular scans to monitor:
- Performance degradation
- New accessibility violations
- Security vulnerabilities
- SEO ranking factor changes
- Core Web Vitals trends

## WordPress-Specific Considerations

### Common WordPress Issues Detected

**Typography:**
- Excessive Google Fonts loading (4-6 fonts common)
- Missing font-display: swap
- Lack of system font fallbacks
- Poor font pairing choices

**Performance:**
- Render-blocking WordPress CSS/JS
- Unoptimized images from media library
- Plugin bloat (30+ active plugins)
- No caching strategy
- Slow database queries

**SEO:**
- Yoast/Rank Math misconfiguration
- Missing structured data
- Poor permalink structure
- Duplicate content issues

**Accessibility:**
- Non-semantic HTML from page builders
- Missing ARIA labels
- Poor color contrast in themes
- Keyboard navigation issues

**Security:**
- Outdated WordPress core
- Vulnerable plugins
- Weak security headers
- Exposed /wp-admin endpoint

## Integration Recommendations

### WordPress Plugin Integration
**Possible Approach:** Create WordPress plugin that:
- Schedules automated scans via WP-Cron
- Displays dashboard in WordPress admin
- Stores historical data in WordPress database
- Integrates with existing SEO plugins

### Headless CMS Integration
**API-First Approach:** Use as microservice:
- Expose REST API for headless frontends
- Implement OAuth/JWT authentication
- Return JSON responses for custom dashboards
- Support webhook notifications for CI/CD

### CI/CD Pipeline Integration
**Automation:** Add to deployment pipeline:
- Run performance checks before production deploy
- Gate deployments on accessibility thresholds
- Track Core Web Vitals changes per release
- Alert on security vulnerabilities

## Future Enhancements

### Planned Features
1. Historical tracking database (SQLite/PostgreSQL)
2. Scheduled automated scans
3. Email/Slack notifications
4. Custom threshold alerts
5. White-label branding
6. Multi-user authentication
7. API key management
8. Export to PDF/CSV
9. WordPress plugin version
10. Headless CMS integration

### Scalability Improvements
1. Redis caching layer
2. Queue-based processing (Bull/RabbitMQ)
3. Horizontal scaling with load balancer
4. Distributed browser pool
5. CDN for static assets

## Documentation Files

- `README.md` - Project overview and quick start
- `ARCHITECTURE_REVIEW.md` - Detailed architecture analysis (A- rating)
- `DEPLOYMENT.md` - Docker/Kubernetes deployment guide
- `SECURITY.md` - Threat model and security controls
- `BROWSER_POOL_IMPLEMENTATION.md` - Performance optimization details
- `docs/ERROR_TELEMETRY.md` - Error tracking implementation
- `QUICKSTART.md` - Getting started guide
- `Makefile` - Common development commands

## Support & Maintenance

### Common Issues & Solutions
1. **Lighthouse timeouts:** Increase `LIGHTHOUSE_TIMEOUT_MS` to 180000
2. **Browser pool exhaustion:** Increase `BROWSER_POOL_MAX` to 15
3. **Rate limiting too strict:** Adjust per-endpoint limits in config
4. **Memory leaks:** Ensure browser pool cleanup on shutdown

### Performance Tuning
1. Increase browser pool size for higher concurrency
2. Enable caching for frequently analyzed URLs
3. Use queue system for long-running analyses
4. Deploy multiple instances behind load balancer

---

**Last Updated:** November 6, 2025  
**Version:** 1.0  
**Maintainer:** WordPress Architecture Team
