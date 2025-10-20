# Font Scanner

A comprehensive, enterprise-grade web application that analyzes websites for fonts, font display properties, font loading performance, and typography best practices.

[![CI/CD](https://github.com/your-org/font-scanner/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/your-org/font-scanner/actions)
[![Security Scan](https://img.shields.io/badge/security-scanned-green.svg)](./SECURITY.md)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](./Dockerfile)
[![Kubernetes](https://img.shields.io/badge/kubernetes-ready-blue.svg)](./k8s/)

## Features

### Comprehensive Font & Typography Analysis

- **Font Discovery**: Identifies all fonts used (system, Google Fonts, web fonts, icon fonts)
- **Performance Analysis**: Lighthouse desktop + mobile with Core Web Vitals (LCP, FID, CLS)
- **Best Practices Audit**: Industry-standard compliance checking with detailed recommendations
- **AI-Powered Font Pairing**: Typography harmony evaluation and pairing quality scoring
- **Real User Metrics (RUM)**: Simulated user experience and UX quality assessment
- **Cross-Browser Testing**: Chrome, Firefox, Safari compatibility analysis
- **Advanced Accessibility**: WCAG 2.1 AA/AAA compliance, contrast analysis, readability scoring
- **Font Licensing Detection**: License identification and compliance checking
- **Industry Benchmarking**: Competitive analysis against best-in-class standards
- **Detailed Reports**: Comprehensive PDF reports with weighted scoring and actionable recommendations
- **Score Breakdown Visualization**: Transparent display of exactly how scores are calculated
- **Enterprise-Ready**: Production-ready with Docker, Kubernetes, monitoring, and CI/CD

## Technology Stack

- **Backend**: Node.js, Express
- **Web Scraping**: Puppeteer with Chromium
- **Monitoring**: Prometheus metrics
- **Security**: Helmet.js, rate limiting, input validation
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Kubernetes with HPA, PDB, and network policies
- **CI/CD**: GitHub Actions with security scanning

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

## Comprehensive Analysis Mode

Font Scanner performs a **complete 10-analyzer comprehensive scan** for every website:

### Analysis Components (Weighted Scoring)

1. **Basic Font Scan** (15%) - Font discovery, format detection, categorization
2. **Performance Analysis** (12%) - Load times, font loading waterfall, optimization
3. **Best Practices** (10%) - Industry standards, font-display strategies
4. **Font Pairing Analysis** (15%) - AI-powered typography harmony evaluation
5. **Real User Metrics** (12%) - Simulated user experience, UX quality
6. **Cross-Browser Testing** (10%) - Chrome/Firefox/Safari compatibility
7. **Advanced Accessibility** (13%) - WCAG compliance, contrast, readability
8. **Font Licensing** (8%) - License identification, compliance checking
9. **Lighthouse** (5%) - Google's performance audit (desktop + mobile)

### What You Get

- ✅ **Weighted Score** (0-100) with transparent breakdown
- ✅ **Letter Grade** (A+ to F) with industry benchmarking
- ✅ **Visual Score Breakdown** showing which analyzers contributed
- ✅ **Completeness Bonus** when ≥70% features work with base score >70
- ✅ **PDF Report Download** with all metrics and recommendations
- ✅ **10+ Advanced Analyzers** working in parallel
- ✅ **5-10 Minute Analysis** (thorough and comprehensive)

### Scoring Transparency

The new **Score Breakdown** feature shows exactly how your score is calculated:
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
- `POST /api/scan/best-in-class` - Comprehensive analysis with 10+ analyzers (5-10 minutes)
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

The project includes a comprehensive Makefile:

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
