# Font Scanner - Enterprise Deployment Guide

This guide covers enterprise-grade deployment of the Font Scanner application using Docker and Kubernetes.

## Table of Contents

1. [Docker Deployment](#docker-deployment)
2. [Docker Compose](#docker-compose)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Monitoring and Observability](#monitoring-and-observability)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

## Docker Deployment

### Building the Docker Image

```bash
# Build production image
docker build -t font-scanner:latest .

# Build with specific tag
docker build -t font-scanner:v1.0.0 .

# Build development image
docker build -f Dockerfile.dev -t font-scanner:dev .
```

### Running a Single Container

```bash
# Run in production mode
docker run -d \
  --name font-scanner \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=INFO \
  -v font-scanner-reports:/app/reports \
  -v font-scanner-logs:/app/logs \
  font-scanner:latest

# View logs
docker logs -f font-scanner

# Stop container
docker stop font-scanner
```

### Multi-Stage Build Benefits

The Dockerfile uses a multi-stage build approach:
- **Base Stage**: Sets up Chromium and base dependencies
- **Dependencies Stage**: Installs production npm packages
- **Build Stage**: Runs tests and linting (optional)
- **Production Stage**: Minimal final image with only what's needed

Benefits:
- Smaller image size (~500MB vs ~1GB+)
- Improved security (no dev dependencies)
- Faster deployment
- Non-root user execution

## Docker Compose

### Production Deployment

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Development Mode

```bash
# Start development environment with hot-reload
docker-compose -f docker-compose.dev.yml up

# Run with debugging enabled
docker-compose -f docker-compose.dev.yml up --build

# Execute commands in running container
docker-compose -f docker-compose.dev.yml exec font-scanner-dev npm test
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
NODE_ENV=production
LOG_LEVEL=INFO
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=30000

# Rate Limiting Configuration
# See RATE_LIMITING.md for detailed information

# Global rate limit (all API endpoints)
RATE_LIMIT_WINDOW_MS=900000              # 15 minutes (900,000 ms)
RATE_LIMIT_MAX_REQUESTS=100              # 100 requests per IP per window

# Scan endpoint rate limit (resource-intensive operations)
SCAN_RATE_LIMIT_WINDOW_MS=900000         # 15 minutes (900,000 ms)
SCAN_RATE_LIMIT_MAX_REQUESTS=20          # 20 scans per IP per window

# Download endpoint rate limit (PDF reports)
DOWNLOAD_RATE_LIMIT_WINDOW_MS=900000     # 15 minutes (900,000 ms)
DOWNLOAD_RATE_LIMIT_MAX_REQUESTS=50      # 50 downloads per IP per window

# Report configuration
REPORTS_RETENTION_DAYS=7

# Performance settings
MAX_PAGES_TO_SCAN=10
SCAN_TIMEOUT=60000

# Browser pool configuration
BROWSER_POOL_MIN=1
BROWSER_POOL_MAX=5
BROWSER_POOL_IDLE_TIMEOUT=300000         # 5 minutes
BROWSER_POOL_ACQUIRE_TIMEOUT=30000       # 30 seconds
```

### Recommended Production Values

For different deployment scales:

**Small Deployment (1-100 users):**
```env
RATE_LIMIT_MAX_REQUESTS=200
SCAN_RATE_LIMIT_MAX_REQUESTS=30
DOWNLOAD_RATE_LIMIT_MAX_REQUESTS=100
BROWSER_POOL_MAX=3
```

**Medium Deployment (100-1000 users):**
```env
RATE_LIMIT_MAX_REQUESTS=500
SCAN_RATE_LIMIT_MAX_REQUESTS=50
DOWNLOAD_RATE_LIMIT_MAX_REQUESTS=200
BROWSER_POOL_MAX=5
```

**Large Deployment (1000+ users):**
```env
RATE_LIMIT_MAX_REQUESTS=1000
SCAN_RATE_LIMIT_MAX_REQUESTS=100
DOWNLOAD_RATE_LIMIT_MAX_REQUESTS=500
BROWSER_POOL_MAX=10
```

**Note:** For large deployments, consider implementing Redis-based rate limiting for proper distributed rate limiting across multiple instances. See [Rate Limiting Documentation](./RATE_LIMITING.md) for implementation details.

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Container registry access
- Ingress controller (nginx recommended)
- cert-manager for TLS (optional)

### Quick Start

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create ConfigMap and Secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# Create ServiceAccount and RBAC
kubectl apply -f k8s/serviceaccount.yaml

# Deploy application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Setup autoscaling
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml

# Setup networking
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/networkpolicy.yaml

# Verify deployment
kubectl get pods -n font-scanner
kubectl get svc -n font-scanner
```

### Updating the Deployment

```bash
# Update image
kubectl set image deployment/font-scanner \
  font-scanner=font-scanner:v1.0.1 \
  -n font-scanner

# Check rollout status
kubectl rollout status deployment/font-scanner -n font-scanner

# Rollback if needed
kubectl rollout undo deployment/font-scanner -n font-scanner
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment font-scanner --replicas=5 -n font-scanner

# Horizontal Pod Autoscaler is configured to scale between 3-10 replicas
# based on CPU (70%) and memory (80%) utilization
```

### Health Checks

The application exposes multiple health endpoints:

- `/api/health` - Liveness probe (checks if app is alive)
- `/api/ready` - Readiness probe (checks if app can accept traffic)
- `/metrics` - Prometheus metrics

### Ingress Configuration

Update `k8s/ingress.yaml` with your domain:

```yaml
spec:
  tls:
  - hosts:
    - your-domain.com
    secretName: font-scanner-tls
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: font-scanner
            port:
              number: 80
```

## CI/CD Pipeline

### GitHub Actions

The project includes a complete CI/CD pipeline with:

1. **Lint and Test** - Code quality checks
2. **Security Scan** - Dependency and container vulnerability scanning
3. **Build and Push** - Multi-platform Docker image building
4. **Deploy** - Automated deployment to staging/production

### Required Secrets

Configure these in GitHub repository settings:

```
GITHUB_TOKEN - Automatically provided
KUBE_CONFIG_STAGING - Base64 encoded kubeconfig for staging
KUBE_CONFIG_PROD - Base64 encoded kubeconfig for production
```

### Manual Deployment

To trigger a deployment:

```bash
# Push to develop branch for staging
git push origin develop

# Push to main or tag for production
git push origin main
# or
git tag v1.0.0 && git push origin v1.0.0
```

## Monitoring and Observability

### Prometheus Metrics

The application exposes Prometheus metrics at `/metrics`:

**Available Metrics:**

- `font_scanner_http_request_duration_seconds` - HTTP request duration
- `font_scanner_http_requests_total` - Total HTTP requests
- `font_scanner_scan_duration_seconds` - Font scan operation duration
- `font_scanner_scans_total` - Total number of scans
- `font_scanner_active_scans` - Currently active scans
- `font_scanner_errors_total` - Total errors by type
- `font_scanner_nodejs_*` - Node.js process metrics
- `font_scanner_process_*` - Process metrics (CPU, memory, etc.)

### Grafana Dashboard

Import the included Grafana dashboard for visualization:

1. Access Grafana
2. Import dashboard
3. Upload or paste JSON from `monitoring/grafana-dashboard.json`
4. Select Prometheus data source

### Logging

Structured JSON logging is available:

```bash
# View logs in Kubernetes
kubectl logs -f deployment/font-scanner -n font-scanner

# View logs with labels
kubectl logs -l app=font-scanner -n font-scanner --tail=100

# Export logs
kubectl logs deployment/font-scanner -n font-scanner > app.log
```

### Alerts

Configure Prometheus alerts for:

- High error rate (>5% of requests)
- High response time (p95 > 5s)
- Pod crashes or restarts
- Memory usage > 80%
- CPU usage > 80%

## Security Best Practices

### Container Security

- **Non-root user**: Application runs as user ID 1001
- **Read-only root filesystem**: Where possible
- **Minimal capabilities**: Only essential Linux capabilities
- **No privilege escalation**: Prevented
- **Security scanning**: Trivy scans on every build

### Network Security

- **Network Policies**: Restrict pod-to-pod communication
- **TLS/HTTPS**: All external traffic encrypted
- **Rate Limiting**: Configured at multiple levels
- **CORS**: Properly configured
- **Security Headers**: Helmet.js middleware

### Secrets Management

```bash
# Create secrets from literal values
kubectl create secret generic font-scanner-secrets \
  --from-literal=API_KEY=your-secret-key \
  -n font-scanner

# Or from files
kubectl create secret generic font-scanner-secrets \
  --from-file=./secrets/ \
  -n font-scanner

# For production, use sealed-secrets or external secret managers
```

### Vulnerability Scanning

```bash
# Scan image with Trivy
docker pull aquasec/trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image font-scanner:latest

# Scan filesystem
trivy fs .
```

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n font-scanner
kubectl describe pod <pod-name> -n font-scanner

# Check logs
kubectl logs <pod-name> -n font-scanner
kubectl logs <pod-name> -n font-scanner --previous
```

#### High Memory Usage

```bash
# Check resource usage
kubectl top pods -n font-scanner

# Adjust memory limits in deployment.yaml
resources:
  limits:
    memory: "4Gi"  # Increase as needed
```

#### Chromium Issues

If Puppeteer/Chromium fails:

1. Ensure sufficient memory (minimum 512Mi)
2. Check sandbox settings
3. Verify Alpine Linux compatibility
4. Review Chromium logs

#### Network Issues

```bash
# Test pod connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -n font-scanner -- sh

# Inside pod, test:
wget -O- http://font-scanner.font-scanner.svc.cluster.local/api/health
```

### Debug Mode

Enable debug logging:

```bash
# Update ConfigMap
kubectl edit configmap font-scanner-config -n font-scanner

# Set LOG_LEVEL: "DEBUG"
# Restart pods
kubectl rollout restart deployment/font-scanner -n font-scanner
```

### Performance Tuning

1. **Horizontal Scaling**: Increase replicas for better throughput
2. **Resource Limits**: Adjust based on actual usage
3. **Cache Configuration**: Optimize caching strategies
4. **Connection Pooling**: Configure appropriately
5. **Puppeteer Pool**: Limit concurrent browser instances

## Support

For issues and questions:

- GitHub Issues: [https://github.com/your-org/font-scanner/issues](https://github.com/your-org/font-scanner/issues)
- Documentation: [README.md](README.md)
- API Documentation: Access `/api/test` endpoint for API info

## License

MIT License - See LICENSE file for details
