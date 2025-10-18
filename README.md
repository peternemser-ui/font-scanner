# Font Scanner

A comprehensive, enterprise-grade web application that analyzes websites for fonts, font display properties, font loading performance, and typography best practices.

[![CI/CD](https://github.com/your-org/font-scanner/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/your-org/font-scanner/actions)
[![Security Scan](https://img.shields.io/badge/security-scanned-green.svg)](./SECURITY.md)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](./Dockerfile)
[![Kubernetes](https://img.shields.io/badge/kubernetes-ready-blue.svg)](./k8s/)

## Features

- **Font Discovery**: Identifies all fonts used on a webpage
- **Font Display Analysis**: Analyzes font-display properties and loading strategies
- **Performance Metrics**: Measures font loading times and impact on page performance
- **Best Practices Audit**: Checks compliance with font loading best practices
- **Visual Analysis**: Screenshots and visual comparison of font rendering
- **Detailed Reports**: Comprehensive PDF reports with actionable recommendations
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

## Deployment Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete enterprise deployment guide
- [DOCKER_README.md](./DOCKER_README.md) - Docker quick start
- [k8s/README.md](./k8s/README.md) - Kubernetes deployment details
- [SECURITY.md](./SECURITY.md) - Security policy and best practices

## API Endpoints

- `POST /api/scan` - Analyze a website for fonts
- `GET /api/health` - Liveness probe endpoint
- `GET /api/ready` - Readiness probe endpoint
- `GET /api/reports/:filename` - Download PDF reports
- `GET /metrics` - Prometheus metrics endpoint
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
