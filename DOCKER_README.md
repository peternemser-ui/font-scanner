# Font Scanner - Docker Quick Start

## Quick Start with Docker

### Using Docker Run

```bash
# Pull and run (if image is published)
docker run -d -p 3000:3000 font-scanner:latest

# Or build and run locally
docker build -t font-scanner:latest .
docker run -d -p 3000:3000 \
  --name font-scanner \
  -e NODE_ENV=production \
  font-scanner:latest
```

Access the application at http://localhost:3000

### Using Docker Compose (Recommended)

#### Production

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### Development with Hot Reload

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# With rebuild
docker-compose -f docker-compose.dev.yml up --build
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

Key variables:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (DEBUG/INFO/WARN/ERROR)
- `PUPPETEER_HEADLESS` - Run browser in headless mode
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window
- `MAX_PAGES_TO_SCAN` - Maximum pages to scan per request

## Health Checks

Check application health:

```bash
# Liveness check
curl http://localhost:3000/api/health

# Readiness check
curl http://localhost:3000/api/ready

# Metrics
curl http://localhost:3000/metrics
```

## Volumes

The application uses persistent volumes for:
- `/app/reports` - Generated PDF reports
- `/app/logs` - Application logs

### Backup Reports

```bash
# Copy reports from container
docker cp font-scanner:/app/reports ./reports-backup

# Using volume
docker run --rm -v font-scanner_reports-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/reports-backup.tar.gz /data
```

## Troubleshooting

### View Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f font-scanner
```

### Shell Access

```bash
# Docker run
docker exec -it font-scanner sh

# Docker compose
docker-compose exec font-scanner sh
```

### Memory Issues

If Chromium crashes due to memory:

1. Increase Docker memory limit (Docker Desktop: Settings > Resources)
2. Adjust container memory in `docker-compose.yml`:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 2G
   ```

### Reset Everything

```bash
# Stop and remove everything
docker-compose down -v

# Remove all font-scanner images
docker rmi $(docker images -q font-scanner)

# Clean up Docker system
docker system prune -a
```

## Security Notes

- Application runs as non-root user (UID 1001)
- Minimal container capabilities
- Security scanning enabled in CI/CD
- Regular dependency updates recommended

## Performance Tips

1. **Resource Allocation**: Allocate at least 2GB RAM
2. **Concurrent Scans**: Limit via `MAX_PAGES_TO_SCAN`
3. **Rate Limiting**: Adjust based on your needs
4. **Caching**: Reports are cached in volumes

## Next Steps

- For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md)
- For Kubernetes deployment, see `k8s/` directory
- For CI/CD setup, see `.github/workflows/`

## Support

For issues, check:
1. Container logs: `docker-compose logs`
2. Health endpoint: `curl http://localhost:3000/api/health`
3. GitHub Issues for known problems
