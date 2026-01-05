# Site Mechanic

A web diagnostics platform that analyzes websites for SEO, performance, accessibility, security, and typography. Production-ready with detailed monitoring and security controls.

[![CI/CD](https://github.com/your-org/font-scanner/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/your-org/font-scanner/actions)
[![Security Scan](https://img.shields.io/badge/security-scanned-green.svg)](./SECURITY.md)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](./Dockerfile)
[![Kubernetes](https://img.shields.io/badge/kubernetes-ready-blue.svg)](./k8s/)

## Features

### Core Diagnostics

- **Font Scanner Module**: Identifies all fonts used (system, Google Fonts, web fonts, icon fonts)
- **Performance Analysis**: Lighthouse desktop + mobile with Core Web Vitals (LCP, FID, CLS)
- **Best Practices Audit**: Industry-standard compliance checking with detailed recommendations
- **AI-Powered Font Pairing**: Typography harmony evaluation and pairing quality scoring
- **Real User Metrics (RUM)**: Simulated user experience and UX quality assessment
- **Cross-Browser Testing**: Chrome, Firefox, Safari compatibility analysis
- **Accessibility Analysis**: WCAG 2.1 AA/AAA compliance, contrast analysis, readability scoring
- **Font Licensing Detection**: License identification and compliance checking
- **Industry Benchmarking**: Competitive analysis against best-in-class standards
- **Real-Time Progress Updates**: WebSocket-powered live progress tracking (5-10 min scans)
- **PDF Reports**: Exportable reports with weighted scoring and actionable recommendations
- **Score Breakdown Visualization**: Transparent display of exactly how scores are calculated
- **Production-Ready**: Docker, Kubernetes, monitoring, and CI/CD

## Technology Stack

- **Backend**: Node.js, Express, Socket.IO
- **Real-Time**: WebSocket progress updates with Socket.IO
- **Web Scraping**: Puppeteer with Chromium
- **Monitoring**: Prometheus metrics
- **Security**: Helmet.js, rate limiting, input validation
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Kubernetes with HPA, PDB, and network policies
- **CI/CD**: GitHub Actions with security scanning

## Important: Supported Websites

Font Scanner works best with:

✅ **Recommended Sites:**
- Your own websites and client projects
- Small to medium business websites
- Development/staging environments
- Bot-friendly sites: `example.com`, `wikipedia.org`, `github.com`

❌ **Sites That Will Be Blocked:**
- Major e-commerce platforms (Amazon, Walmart, Target)
- Commercial automotive sites (cars.com, autotrader.com)
- Large retail chains with aggressive bot protection
- Any site using Cloudflare Enterprise WAF or similar

**Why?** These sites use bot detection (Cloudflare, PerimeterX, etc.) that blocks automated analysis tools. This is expected behavior, not a bug. Use [Google PageSpeed Insights](https://pagespeed.web.dev/) for these sites instead.

**Fallback Mode:** Font Scanner automatically attempts a lightweight HTTP-based analysis if full Puppeteer analysis is blocked. This provides basic SEO metrics (meta tags, headings, content) but no Core Web Vitals or performance data.

## Quick Start

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd font-scanner
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   make install
   ```

3. Start the application:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

4. Access at `http://localhost:3000`

### Docker Quick Start

```bash
# Using Docker Compose (recommended)
docker-compose up -d

# Or using Make
make docker-compose

# Access at http://localhost:3000
```

See [DOCKER_README.md](./DOCKER_README.md) for detailed Docker instructions.

## Full Analysis Mode

Font Scanner performs a **complete 10-analyzer scan** for every website:

### Analysis Components (Weighted Scoring)

1. **Basic Font Scan** (15%) - Font discovery, format detection, categorization
2. **Performance Analysis** (12%) - Load times, font loading waterfall, optimization
3. **Best Practices** (10%) - Industry standards, font-display strategies
4. **Font Pairing Analysis** (15%) - AI-powered typography harmony evaluation
5. **Real User Metrics** (12%) - Simulated user experience, UX quality
6. **Cross-Browser Testing** (10%) - Chrome/Firefox/Safari compatibility
7. **Accessibility** (13%) - WCAG compliance, contrast, readability
8. **Font Licensing** (8%) - License identification, compliance checking
9. **Lighthouse** (5%) - Google's performance audit (desktop + mobile)

### What You Get

- ✅ **Weighted Score** (0-100) with transparent breakdown
- ✅ **Letter Grade** (A+ to F) with industry benchmarking
- ✅ **Real-Time Progress** - Live WebSocket updates showing each analyzer step
- ✅ **Visual Score Breakdown** showing which analyzers contributed
- ✅ **Completeness Bonus** when ≥70% features work with base score >70
- ✅ **PDF Report Download** with all metrics and recommendations
- ✅ **10+ Parallel Analyzers** for comprehensive coverage
- ✅ **5-10 Minute Analysis** with live time estimates

### Real-Time Progress Tracking (NEW!)

Experience real-time progress updates during full scans:
- **Live step tracking**: See which analyzer is currently running (Step 1/10)
- **Status indicators**: Running (⏳), Completed (✅), Error (❌)
- **Progress bars**: Visual feedback for each step's completion
- **Time estimates**: Real-time elapsed/remaining time calculations
- **No guessing**: Know exactly what's happening during long scans

See [WEBSOCKET_PROGRESS.md](./WEBSOCKET_PROGRESS.md) for implementation details.

### Scoring Transparency

The **Score Breakdown** feature shows exactly how your score is calculated:
- Component-by-component progress bars
- Weight distribution visualization
- Base score vs completeness bonus
- Clear indicators for included/excluded analyzers
- Educational notes about scoring methodology

**Note:** Only working analyzers contribute to scores. Failed analyzers are excluded rather than penalized.

## Documentation

### Deployment & Operations
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete enterprise deployment guide
- [DOCKER_README.md](./DOCKER_README.md) - Docker quick start
- [k8s/README.md](./k8s/README.md) - Kubernetes deployment details
- [docs/DATA_RETENTION.md](./docs/DATA_RETENTION.md) - Data retention and cleanup operations

### Security & Compliance
- [SECURITY.md](./SECURITY.md) - Security policy and best practices
- [PRIVACY.md](./PRIVACY.md) - Privacy policy and GDPR compliance
- [docs/RATE_LIMITING.md](./docs/RATE_LIMITING.md) - Rate limiting configuration and monitoring
- [docs/REDIS_RATE_LIMITING.md](./docs/REDIS_RATE_LIMITING.md) - Redis integration for distributed systems

### Monitoring & Observability
- [docs/ERROR_TELEMETRY.md](./docs/ERROR_TELEMETRY.md) - Error tracking and analytics system
- [docs/ERROR_TELEMETRY_SUMMARY.md](./docs/ERROR_TELEMETRY_SUMMARY.md) - Implementation summary

## API Endpoints

### Core Endpoints
- `POST /api/scan/best-in-class` - Full analysis with 10+ analyzers (5-10 minutes)
  - Includes: Font discovery, performance, best practices, font pairing, RUM, cross-browser, accessibility, licensing, benchmarking, Lighthouse
  - Returns: Weighted scoring (0-100), letter grade (A+ to F), PDF report
- `GET /api/health` - Liveness probe endpoint
- `GET /api/ready` - Readiness probe endpoint
- `GET /api/reports/:filename` - Download PDF reports
- `GET /metrics` - Prometheus metrics endpoint

### Admin & Monitoring
- `GET /api/admin/rate-limits` - Rate limit analytics and statistics
- `GET /api/admin/errors` - Error telemetry analytics (filter by time/category/type)
- `GET /api/admin/errors/:errorId` - Specific error details with similar errors
- `GET /api/reports/stats` - Report cleanup statistics
- `GET /api/test` - API information endpoint

## Make Commands

The project includes a Makefile with common tasks:

```bash
make help              # Show all available commands
make install           # Install dependencies
make dev               # Start development server
make test              # Run tests
make docker-build      # Build Docker image
make docker-compose    # Start with Docker Compose
make k8s-deploy        # Deploy to Kubernetes
make security-scan     # Run security scans
```

See `make help` for complete list of commands.

## Troubleshooting

### "Analysis Failed" or 500 Error

**Problem:** Site returns error during analysis

**Common Causes:**
1. **Bot Protection** (Most Common)
   - Major e-commerce sites (Amazon, Walmart, Target)
   - Automotive sites (cars.com, autotrader.com)
   - Any site with Cloudflare Enterprise, PerimeterX, or similar
   - **Solution:** This is expected. Use [Google PageSpeed Insights](https://pagespeed.web.dev/) for these sites.

2. **Slow/Unresponsive Site**
   - Site takes >30 seconds to load
   - **Solution:** Check if site loads normally in your browser first

3. **Invalid URL**
   - Missing `https://` (auto-added but verify)
   - Typo in domain name
   - **Solution:** Copy URL directly from browser address bar

### Which Sites Work?

✅ **Will Work:**
- Your own websites
- Client projects you manage
- Small to medium business sites
- Development/staging environments
- Bot-friendly sites: example.com, wikipedia.org, github.com

❌ **Will Be Blocked:**
- Major e-commerce: Amazon, eBay, Walmart
- Large retail: Target, Best Buy, Home Depot
- Automotive: cars.com, autotrader.com, edmunds.com
- Travel: booking.com, expedia.com
- Any site actively blocking automation

### Need to Analyze a Bot-Protected Site?

Use these alternatives:
- **[Google PageSpeed Insights](https://pagespeed.web.dev/)** - Official Google tool (bypasses bot protection)
- **Chrome DevTools Lighthouse** - Built into Chrome (F12 → Lighthouse tab)
- **[WebPageTest](https://www.webpagetest.org/)** - May work for some sites
- **Real User Monitoring** - Install analytics on sites you control

## Project Structure

```
font-scanner/
├── .github/
│   ├── workflows/          # CI/CD pipelines
│   └── dependabot.yml      # Automated dependency updates
├── k8s/                    # Kubernetes manifests
├── src/
│   ├── server.js           # Express server with graceful shutdown
│   ├── controllers/        # Request handlers
│   ├── services/           # Business logic
│   ├── middleware/         # Custom middleware (metrics, etc.)
│   ├── utils/              # Utility functions
│   └── public/             # Static assets
├── tests/                  # Test files
├── Dockerfile              # Production Docker image
├── docker-compose.yml      # Production compose file
├── Makefile                # Task automation
└── package.json            # Dependencies and scripts
```

## License

MIT - See LICENSE file for details
