# Font Scanner - Quick Start Guide

Get Font Scanner running in under 5 minutes!

## Option 1: Docker Compose (Recommended)

The fastest way to get started:

```bash
# Clone the repository
git clone <your-repo-url>
cd font-scanner

# Start the application
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

Access at: http://localhost:3000

## Option 2: Make Commands

If you have Make installed:

```bash
# Start production environment
make docker-compose

# Or start development environment with hot-reload
make docker-dev
```

## Option 3: Docker Run

Single command to run:

```bash
docker build -t font-scanner:latest .
docker run -d -p 3000:3000 --name font-scanner font-scanner:latest
```

## Option 4: Local Node.js

If you prefer running locally:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or production server
npm start
```

## Verify Installation

Once running, test these endpoints:

```bash
# Health check
curl http://localhost:3000/api/health

# API test
curl http://localhost:3000/api/test

# Metrics
curl http://localhost:3000/metrics
```

## Next Steps

- **Use the App**: Open http://localhost:3000 in your browser
- **Read Docs**: Check [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
- **Configure**: Edit `.env` file for custom configuration
- **Deploy to K8s**: See [k8s/README.md](./k8s/README.md)

## Common Commands

```bash
# Stop services
docker-compose down

# Rebuild and start
docker-compose up --build -d

# View logs
docker-compose logs -f

# Check resource usage
docker stats

# Execute commands in container
docker-compose exec font-scanner sh
```

## Troubleshooting

### Port Already in Use
```bash
# Change port in .env file or docker-compose.yml
PORT=3001

# Or stop conflicting service
lsof -ti:3000 | xargs kill
```

### Container Won't Start
```bash
# Check logs
docker-compose logs

# Rebuild image
docker-compose build --no-cache
docker-compose up -d
```

### Out of Memory
```bash
# Increase Docker memory limit
# Docker Desktop: Settings > Resources > Memory

# Or adjust container limits in docker-compose.yml
```

## Getting Help

- **Documentation**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Docker Help**: [DOCKER_README.md](./DOCKER_README.md)
- **Security**: [SECURITY.md](./SECURITY.md)
- **Issues**: GitHub Issues

## Production Deployment

For production deployment:
1. Review [DEPLOYMENT.md](./DEPLOYMENT.md)
2. Configure secrets in `.env`
3. Set up monitoring
4. Configure TLS/HTTPS
5. Deploy to Kubernetes (recommended)

Ready for production in minutes!
