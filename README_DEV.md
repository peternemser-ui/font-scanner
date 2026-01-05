# Font Scanner - Developer Guide

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- npm or pnpm
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd font-scanner

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

## 📁 Project Structure

```
font-scanner/
├── src/
│   ├── server.js              # Main Express server
│   ├── controllers/           # Request handlers
│   ├── services/              # Business logic & analyzers
│   │   ├── fontAnalyzer.js
│   │   ├── seoAnalyzer.js
│   │   ├── securityAnalyzer.js
│   │   ├── accessibilityAnalyzer.js
│   │   └── performanceAnalyzer.js
│   ├── db/                    # Database (SQLite)
│   │   ├── index.js
│   │   └── schema.sql
│   ├── queue/                 # Async job processing
│   │   ├── scanQueue.js
│   │   └── scanWorker.js
│   ├── routes/                # API routes
│   ├── middleware/            # Express middleware
│   ├── reports/               # Report generators
│   └── public/                # Frontend assets
│       ├── index.html
│       ├── styles.css
│       ├── *.html             # Analyzer pages
│       └── *.js               # Frontend scripts
├── .vscode/                   # VS Code configuration
│   ├── tasks.json             # Build/run tasks
│   └── launch.json            # Debug configurations
├── tests/                     # Test files
├── Dockerfile
└── package.json
```

## 🛠️ Development

### Available Commands

```bash
# Development
npm run dev          # Start dev server with hot reload (nodemon)
npm start            # Start production server

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier

# Docker
docker build -t font-scanner .
docker run -p 3000:3000 font-scanner
```

### VS Code Tasks

Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) and type "Run Task":

- **💻 Dev: Server** - Start development server
- **🧪 Test** - Run tests
- **🔍 Lint** - Run ESLint
- **✨ Format** - Format code
- **🚀 Deploy to Production** - Deploy to production server

### Debugging

Press `F5` or use the Debug panel:

- **🐛 Debug Server** - Debug the main server
- **🔌 Attach to Process** - Attach to running Node process
- **🧪 Debug Tests** - Debug all tests
- **🧪 Debug Current Test File** - Debug the currently open test file

## 🏗️ Architecture

### Async Scan System

Scans run asynchronously to prevent long-running requests:

1. **POST /api/scans** - Create scan, returns `{ scanId }` immediately
2. **GET /api/scans/:scanId** - Poll for status and progress
3. **Worker** processes scans in background queue

```javascript
// Example scan lifecycle
const response = await fetch('/api/scans', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://example.com', options: {...} })
});
const { scanId } = await response.json();

// Poll for results
const poll = setInterval(async () => {
  const status = await fetch(`/api/scans/${scanId}`);
  const { state, progress, results } = await status.json();

  if (state === 'done') {
    clearInterval(poll);
    displayResults(results);
  }
}, 2000);
```

### Database Schema

SQLite database stores:
- **scans** - Scan metadata and status
- **scan_results** - Detailed scan results
- **users** - User accounts (for paid features)
- **entitlements** - Scan credits and limits
- **api_keys** - API access tokens

### Analyzers

Each analyzer is a self-contained service in `src/services/`:

- **fontAnalyzer** - Font detection, licensing, duplicates
- **tagAnalyzer** - GA4, GTM, Meta Pixel, ad tags
- **seoAnalyzer** - SEO metrics and recommendations
- **securityAnalyzer** - Security headers, HTTPS, vulnerabilities
- **accessibilityAnalyzer** - WCAG compliance
- **performanceAnalyzer** - Page speed, resource optimization
- **crawlerService** - Multi-page crawling with sitemap support

## 🔒 Security

### SSRF Protection

All URL inputs are validated to prevent server-side request forgery:

```javascript
// Blocked: Private IP ranges
- 127.0.0.0/8 (localhost)
- 10.0.0.0/8 (private)
- 172.16.0.0/12 (private)
- 192.168.0.0/16 (private)
- 169.254.0.0/16 (link-local)
- file:// protocol
```

### Rate Limiting

- **Scan endpoint**: 2 requests per 15 minutes (free), higher for paid
- **API endpoints**: 100 requests per 15 minutes
- **Results endpoint**: 1000 requests per hour

### Input Validation

All inputs validated with Zod schemas before processing.

## 💰 Monetization

### Pricing Tiers

| Plan | Price | Scans | Max Pages | PDF Export |
|------|-------|-------|-----------|------------|
| Free | $0 | 3/day | 10 | ❌ |
| Starter | $19 | 50 | 50 | ✅ |
| Pro | $49 | 200 | 250 | ✅ |

### Stripe Integration

```bash
# Set environment variables
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Webhook handles:
- `checkout.session.completed` - Add credits
- `invoice.payment_failed` - Suspend account

## 📊 Monitoring

- **Prometheus metrics** exposed at `/metrics`
- **Health check** at `/health`
- **Server logs** via Morgan middleware

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- fontAnalyzer.test.js

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Test Structure

```
tests/
├── unit/
│   ├── services/
│   └── middleware/
├── integration/
│   └── api/
└── e2e/
    └── scan-flow.test.js
```

## 🐳 Docker

```bash
# Build
docker build -t font-scanner .

# Run
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e STRIPE_SECRET_KEY=sk_... \
  font-scanner

# With volume for database
docker run -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  font-scanner
```

## 🚀 Deployment

### Production Deployment

```bash
# Push to main branch
git push origin main

# Auto-deploy via task or CI/CD
# OR manually:
ssh user@server 'cd /var/www/fontscanner && git pull && npm install --production && pm2 restart fontscanner'
```

### Environment Variables

Required for production:

```env
NODE_ENV=production
PORT=3000
DATABASE_PATH=/data/fontscanner.db
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SESSION_SECRET=random-secret-here
```

## 📚 API Documentation

### Scan Endpoints

#### Create Scan
```http
POST /api/scans
Content-Type: application/json

{
  "url": "https://example.com",
  "options": {
    "maxPages": 10,
    "maxDepth": 3,
    "includeSitemap": true
  }
}

Response: { "scanId": "uuid" }
```

#### Get Scan Status
```http
GET /api/scans/:scanId

Response: {
  "scanId": "uuid",
  "status": "running|done|failed",
  "progress": 45,
  "startedAt": "ISO date",
  "finishedAt": "ISO date",
  "results": {...}  // when done
}
```

#### Export PDF
```http
GET /api/scans/:scanId/pdf

Response: PDF file download
```

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/tag-analyzer`
2. Make changes and test
3. Run linter: `npm run lint`
4. Commit with clear message
5. Push and create pull request

## 📝 License

MIT
