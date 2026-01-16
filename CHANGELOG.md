# Changelog

All notable changes to Site Mechanic will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive codebase cleanup and optimization
- **PDF Report Design Modernization**: Complete Material Design overhaul of all 5 PDF report types
  - `pdfCharts.js`: New chart rendering module with 6 chart types (gauge, bar, pie/donut, comparison, progress, threshold)
  - Material Design color palette, typography, and spacing system
  - 60+ data visualizations added across SEO, Security, Performance, Accessibility, and Font Analysis reports
  - Professional gauge charts for overall scores and component breakdowns
  - Threshold charts for Core Web Vitals (LCP, TBT, CLS) with color-coded zones
  - Pie/donut charts for distributions (vulnerabilities, resources, violations)
  - Comparison charts for Desktop vs Mobile metrics
  - Timeline visualizations for performance metrics (FCP → FMP → LCP → TTI)
  - Progress bars for completion indicators and strength metrics
  - Material cards with subtle elevation for visual grouping
  - 4-gauge grid for WCAG 2.1 principles (Perceivable, Operable, Understandable, Robust)
  - Color contrast analysis with visual swatches and ratio indicators
  - Removed terminal-style brackets in favor of clean Material Design headers
- **Service Layer Consolidation**: 6 new utility modules consolidating 3000+ lines of duplicated code
  - `controllerHelpers.js`: Request/response processing, report metadata, URL validation
  - `formatHelpers.js`: Number formatting, byte/duration conversion, percentage formatting
  - `scoringHelpers.js`: Penalty-based scoring, weighted averages, domain-specific scoring functions
  - `browserHelpers.js`: Browser automation patterns, bot detection, device profiles, timeout wrappers
  - `domHelpers.js`: DOM analysis functions for page.evaluate() (headings, images, meta tags, content)
  - `pdfHelpers.js`: PDF generation boilerplate, headers, sections, score badges

### Changed
- ESLint now enforces `no-console` rule in production code
- Documentation reorganized: 84 historical docs archived, 8 obsolete docs removed
- **5 PDF generators** completely redesigned with Material Design and data visualizations
  - `seoPdfGenerator.js`: 638 lines (from 499) - Added gauge charts, bar charts, pie charts, progress bars, metric grids
  - `securityPdfGenerator.js`: 1017 lines (from 627) - Added vulnerability pie charts, progress bars, comparison charts, OWASP bar charts
  - `performancePdfGenerator.js`: 1006 lines (from 498) - Added threshold charts, timeline visualization, resource pie charts, metric cards
  - `accessibilityPdfGenerator.js`: 1084 lines (from 606) - Added 4-gauge WCAG grid, violation donut charts, contrast swatches, comparison charts
  - `pdfReportGenerator.js`: 1038 lines (from 951) - Font Analysis PDF redesigned with pie charts, progress bars, dual gauge charts, metric grids, comparison charts
  - Eliminated terminal-style `[BRACKETS]` headers and neon green colors in favor of Material Design section headers
  - Professional gauge charts for overall scores with component breakdowns
  - Rich data visualizations throughout (60+ charts total across all PDF types)
  - **US Letter page size (8.5" x 11")** for all PDF reports with white background
  - **Company logo** displayed in header of all PDF reports
- **12 controllers** refactored to use `controllerHelpers` (eliminated 340+ lines of duplication)
  - Unified report metadata pattern (reportId, screenshotUrl, scanStartedAt)
  - Consolidated URL processing with HTTP fallback support
  - Single source for analyzer key extraction
- **26 analyzer services** refactored to use utility helpers (eliminated 320+ lines)
  - `seoAnalyzer.js`: Uses formatHelpers, scoringHelpers, browserHelpers, domHelpers (eliminated 120+ lines)
  - `securityAnalyzerService.js`: Uses formatHelpers and scoringHelpers for weighted scoring
  - `performanceAnalyzerService.js`: Uses formatHelpers for consistent number formatting
  - `accessibilityAnalyzerService.js`: Uses formatHelpers for scoring and duration formatting (6 replacements)
  - `mobileAnalyzerService.js`: Uses formatHelpers for extensive scoring calculations (14 replacements)
  - `lighthouseAnalyzer.js`: Uses formatHelpers for all Lighthouse score calculations (6 replacements)
  - `performanceSnapshotAnalyzer.js`: Uses formatHelpers for KB formatting and scoring (6 replacements)
  - `competitiveAnalysisService.js`: Uses formatHelpers for competitive metrics and duration (10 replacements)
  - `croAnalyzerService.js`: Uses formatHelpers for CRO scoring and analysis time (2 replacements)
  - `tagAnalyzer.js`: Uses formatHelpers for resource timing and size formatting (10 replacements)
  - `brandConsistencyService.js`: Uses formatHelpers for color analysis, contrast ratios, hierarchy (20 replacements)
  - `ipReputationService.js`: Uses formatHelpers for scoring, price averages, savings calculations (8 replacements)
  - `localSEOService.js`: Uses formatHelpers for score calculations and analysis duration (2 replacements)
  - `coreWebVitalsService.js`: Uses formatHelpers for CWV metrics, scoring, duration (20 replacements)
  - `bestPracticesAnalyzer.js`: Uses formatHelpers for best practice scoring and metrics (14 replacements)
  - `loadingStrategyAnalyzer.js`: Uses formatHelpers for loading performance metrics (5 replacements)
  - `advancedAccessibilityAnalyzer.js`: Uses formatHelpers for contrast ratios, WCAG scoring, readability (5 replacements)
  - `brokenLinkService.js`: Uses formatHelpers for duration, scores, quality metrics, ratios (4 replacements)
  - `fontAnalyzer.js`: Uses formatHelpers for WOFF2 percentages, font display scores (3 replacements)
  - `advancedFontMetrics.js`: Uses formatHelpers for font size, line height, readability recommendations (3 replacements)
  - `competitivePerformanceAnalyzer.js`: Uses formatHelpers for duration and performance scoring (2 replacements)
  - `competitiveCoreWebVitalsAnalyzer.js`: Uses formatHelpers for duration and CWV scoring (2 replacements)
  - `competitiveAccessibilityAnalyzer.js`: Uses formatHelpers for duration and accessibility scoring (2 replacements)
  - `gdprComplianceService.js`: Uses formatHelpers for analysis duration (1 replacement)
  - `fontPairingAnalyzer.js`: Uses formatHelpers for pairing scores (1 replacement)
  - `fontLicensingDetector.js`: Uses formatHelpers for compliance percentages (1 replacement)
- **5 PDF generators** refactored to use pdfHelpers (eliminated 250+ lines)
  - `seoPdfGenerator.js`: Uses initializePdfGeneration, finalizePdfGeneration, addPdfHeader, section helpers
  - `securityPdfGenerator.js`: Uses pdfHelpers for headers, sections, scoring, page breaks
  - `performancePdfGenerator.js`: Uses pdfHelpers + formatHelpers for bytes formatting
  - `accessibilityPdfGenerator.js`: Uses pdfHelpers for consistent report structure
  - `pdfReportGenerator.js`: Uses pdfHelpers, pdfCharts, Material Design components throughout

### Removed
- 723 debug console statements from production code
- 5 obsolete backup script files (script_backup.js, script_new.js, etc.)
- Duplicate and outdated documentation files
- **13 duplicate `getAnalyzerKeyOverride()` functions** from controllers
- **10+ duplicate 8-line report metadata patterns** from controllers
- **36+ duplicate scoring methods** replaced with scoringHelpers utilities
- **175+ scattered `.toFixed()` and `Math.round()` formatting calls** replaced with formatHelpers
- **17 duplicate browser automation patterns** replaced with browserHelpers
- **10+ duplicate DOM extraction functions** replaced with domHelpers
- **5 × 50-line PDF boilerplate blocks** replaced with pdfHelpers (250+ lines eliminated)
- **Terminal-style design from font analysis PDF**: Removed neon green colors (#00ff41), bracket headers ([SECTION]), dark backgrounds (#0a0a0a, #1a1a1a)

---

## [2.0.0] - 2025-01-12

### Major Features

#### Authentication & Payment System
- **Stripe Payment Integration**: Full payment processing with webhook support
- **User Authentication**: Login, registration, account management
- **Pro Account Features**: Credits system, usage tracking, tier-based access
- **Billing Pages**: Success/cancel flows, subscription management

#### PDF Export System
- **Professional PDF Reports**: Export analysis results with branding
- **Multi-Analyzer Support**: SEO, Performance, Security, Accessibility reports
- **Payment Gate**: Pro-only PDF export with credit system
- **Screenshot Integration**: Visual evidence in PDF reports

#### Performance Hub
- **Unified Performance Dashboard**: Centralized performance metrics
- **Lighthouse Integration**: Full Lighthouse audits with fallback scoring
- **Core Web Vitals**: LCP, FID, CLS tracking and visualization
- **Performance Snapshots**: Quick performance checks

#### Enhanced Analyzers
- **Site Crawler**: Enhanced sitemap visualization, crawl depth control
- **GDPR Compliance**: Cookie consent, privacy policy analysis
- **IP Reputation**: Blacklist checks, spam detection
- **Mobile Analyzer**: Mobile-first analysis, responsive testing
- **Hosting Analyzer**: Server info, SSL, CDN detection
- **Tag Intelligence**: Marketing tag audit, GTM analysis
- **CRO Analyzer**: Conversion optimization recommendations

### Enhanced Features

#### Design System
- **Component Library**: Reusable UI components (ReportContainer, Modal, etc.)
- **Design Tokens**: CSS custom properties for consistent theming
- **Light/Dark Theme**: Full theme support across all pages
- **Responsive Design**: Mobile-optimized layouts

#### Internationalization (i18n)
- **7 Languages**: EN, ES, FR, DE, PT, JA, ZH
- **Dynamic Translation**: Real-time language switching
- **SEO Localization**: Analyzer-specific translations

#### WebSocket Progress
- **Real-time Updates**: Live progress for competitive analysis
- **Progress Indicators**: Visual feedback during long-running scans
- **Error Handling**: Graceful degradation when WebSocket unavailable

#### UI/UX Improvements
- **Unified Loading System**: Consistent loading states across analyzers
- **Report Shell**: Standardized report layout component
- **Screenshot Lightbox**: Expandable screenshots with zoom
- **Pro Report Blocks**: Premium content gating
- **Pricing Modals**: Inline upgrade prompts

### Technical Improvements

#### Backend
- **Browser Pool**: Puppeteer instance pooling for performance
- **Rate Limiting**: Request throttling with Redis support
- **Request ID Tracking**: Distributed tracing across services
- **Error Telemetry**: Comprehensive error logging
- **Data Retention**: Automated cleanup of old scan results
- **Health Checks**: `/api/health` endpoint for monitoring

#### Testing
- **21 Test Files**: Unit and integration test coverage
- **E2E Tests**: Full scan workflow testing
- **Payment Tests**: Stripe webhook and subscription tests
- **Browser Pool Tests**: Resource pooling validation

#### Infrastructure
- **Docker Support**: Multi-stage Docker builds
- **Kubernetes Ready**: K8s manifests for cloud deployment
- **Environment Config**: Comprehensive .env support
- **Database Migrations**: SQLite schema versioning

### Performance Optimizations
- **Lighthouse Timeout Handling**: Graceful fallback when Lighthouse times out
- **SEO Analyzer Timeout**: 35-second timeout with abort controller
- **DOM Depth Protection**: Prevents stack overflow on deep DOM trees
- **Fetch Timeouts**: 5-second timeouts for robots.txt/sitemap checks
- **Parallel Processing**: Concurrent analyzer execution where safe

### Bug Fixes
- **Competitive Analysis**: Fixed 5-site concurrent analysis
- **Scoring Algorithms**: Corrected weighted score calculations
- **PDF Export**: Fixed rendering issues on various analyzers
- **Dashboard**: Resolved PDF generation conflicts
- **Footer**: Light theme contrast improvements
- **Session Handling**: Fixed cookie and JWT token management

---

## [1.0.0] - 2024-11

### Initial Release

#### Core Analyzers
- **SEO Analyzer**: Meta tags, structured data, keyword density
- **Performance Analyzer**: Load times, resource optimization
- **Security Analyzer**: SSL, headers, vulnerability scanning
- **Accessibility Analyzer**: WCAG 2.1 compliance, ARIA validation
- **Broken Links Checker**: Internal/external link validation
- **Competitive Analysis**: Multi-site comparison (up to 5 competitors)

#### Infrastructure
- **Express.js Backend**: RESTful API architecture
- **SQLite Database**: Scan history and results storage
- **Puppeteer Integration**: Headless browser automation
- **Responsive Frontend**: Mobile-first HTML/CSS/JS

#### Key Features
- **URL Validation**: Input sanitization and format checking
- **Result Caching**: In-memory cache with TTL
- **Error Handling**: Custom error classes and logging
- **CORS Support**: Cross-origin resource sharing enabled

---

## Development Guidelines

### Versioning Strategy
- **Major (X.0.0)**: Breaking changes, major feature releases
- **Minor (x.X.0)**: New features, backward compatible
- **Patch (x.x.X)**: Bug fixes, minor improvements

### Commit Message Format
```
<type>: <description>

[optional body]
[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions/modifications
- `chore`: Build process, tooling changes

### Release Process
1. Update version in `package.json`
2. Update this CHANGELOG.md
3. Create git tag: `git tag -a v2.0.0 -m "Release v2.0.0"`
4. Push tags: `git push origin --tags`
5. Deploy to production

---

## Archived Documentation

Historical implementation details and session summaries have been moved to `docs/archive/`:
- Browser pool implementation details
- Design system evolution
- WebSocket integration guides
- Payment system implementation
- PDF export development
- Performance optimization sessions
- Security hardening steps
- Internationalization rollout

For detailed technical history, see `docs/archive/`.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/site-mechanic/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/site-mechanic/discussions)
- **Documentation**: See [README.md](README.md) and [QUICKSTART.md](QUICKSTART.md)

---

**Note**: This changelog was generated on 2025-01-14 as part of codebase cleanup initiative.
Previous changes were consolidated from git history and archived documentation.
