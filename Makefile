# Font Scanner - Makefile
# Enterprise-grade task automation

.PHONY: help build run test clean docker-build docker-run docker-compose k8s-deploy lint format security-scan

# Variables
IMAGE_NAME ?= font-scanner
IMAGE_TAG ?= latest
NAMESPACE ?= font-scanner
DOCKER_REGISTRY ?= ghcr.io
DOCKER_IMAGE = $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

## help: Show this help message
help:
	@echo "$(CYAN)Font Scanner - Make Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make install          - Install dependencies"
	@echo "  make dev              - Run in development mode"
	@echo "  make test             - Run tests"
	@echo "  make lint             - Run linter"
	@echo "  make format           - Format code"
	@echo ""
	@echo "$(GREEN)Docker:$(NC)"
	@echo "  make docker-build     - Build Docker image"
	@echo "  make docker-run       - Run Docker container"
	@echo "  make docker-compose   - Start with Docker Compose"
	@echo "  make docker-dev       - Start dev environment"
	@echo "  make docker-stop      - Stop Docker Compose"
	@echo "  make docker-clean     - Clean Docker resources"
	@echo ""
	@echo "$(GREEN)Kubernetes:$(NC)"
	@echo "  make k8s-deploy       - Deploy to Kubernetes"
	@echo "  make k8s-status       - Check deployment status"
	@echo "  make k8s-logs         - View application logs"
	@echo "  make k8s-delete       - Delete deployment"
	@echo ""
	@echo "$(GREEN)Security:$(NC)"
	@echo "  make security-scan    - Run security scans"
	@echo "  make audit            - Run npm audit"
	@echo ""
	@echo "$(GREEN)Utility:$(NC)"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make backup-reports   - Backup reports directory"

## install: Install project dependencies
install:
	@echo "$(CYAN)Installing dependencies...$(NC)"
	npm ci

## dev: Run application in development mode
dev:
	@echo "$(CYAN)Starting development server...$(NC)"
	npm run dev

## test: Run tests
test:
	@echo "$(CYAN)Running tests...$(NC)"
	npm test

## lint: Run ESLint
lint:
	@echo "$(CYAN)Running linter...$(NC)"
	npm run lint

## format: Format code with Prettier
format:
	@echo "$(CYAN)Formatting code...$(NC)"
	npm run format

## audit: Run npm security audit
audit:
	@echo "$(CYAN)Running npm audit...$(NC)"
	npm audit

## docker-build: Build Docker production image
docker-build:
	@echo "$(CYAN)Building Docker image: $(IMAGE_NAME):$(IMAGE_TAG)$(NC)"
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .
	@echo "$(GREEN)Build complete!$(NC)"

## docker-build-dev: Build Docker development image
docker-build-dev:
	@echo "$(CYAN)Building development Docker image...$(NC)"
	docker build -f Dockerfile.dev -t $(IMAGE_NAME):dev .

## docker-run: Run Docker container
docker-run:
	@echo "$(CYAN)Running Docker container...$(NC)"
	docker run -d \
		--name font-scanner \
		-p 3000:3000 \
		-e NODE_ENV=production \
		-v font-scanner-reports:/app/reports \
		-v font-scanner-logs:/app/logs \
		$(IMAGE_NAME):$(IMAGE_TAG)
	@echo "$(GREEN)Container started at http://localhost:3000$(NC)"

## docker-compose: Start services with Docker Compose
docker-compose:
	@echo "$(CYAN)Starting services with Docker Compose...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Services started!$(NC)"
	@docker-compose ps

## docker-dev: Start development environment
docker-dev:
	@echo "$(CYAN)Starting development environment...$(NC)"
	docker-compose -f docker-compose.dev.yml up

## docker-stop: Stop Docker Compose services
docker-stop:
	@echo "$(CYAN)Stopping services...$(NC)"
	docker-compose down
	@echo "$(GREEN)Services stopped$(NC)"

## docker-logs: View Docker Compose logs
docker-logs:
	docker-compose logs -f

## docker-clean: Clean Docker resources
docker-clean:
	@echo "$(RED)Cleaning Docker resources...$(NC)"
	docker-compose down -v
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true
	docker system prune -f
	@echo "$(GREEN)Cleanup complete$(NC)"

## docker-push: Push image to registry
docker-push:
	@echo "$(CYAN)Pushing image to registry...$(NC)"
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(DOCKER_IMAGE)
	docker push $(DOCKER_IMAGE)
	@echo "$(GREEN)Push complete!$(NC)"

## k8s-deploy: Deploy to Kubernetes
k8s-deploy:
	@echo "$(CYAN)Deploying to Kubernetes...$(NC)"
	kubectl apply -f k8s/namespace.yaml
	kubectl apply -f k8s/configmap.yaml
	kubectl apply -f k8s/secret.yaml
	kubectl apply -f k8s/serviceaccount.yaml
	kubectl apply -f k8s/deployment.yaml
	kubectl apply -f k8s/service.yaml
	kubectl apply -f k8s/hpa.yaml
	kubectl apply -f k8s/pdb.yaml
	kubectl apply -f k8s/ingress.yaml
	kubectl apply -f k8s/networkpolicy.yaml
	@echo "$(GREEN)Deployment complete!$(NC)"

## k8s-status: Check Kubernetes deployment status
k8s-status:
	@echo "$(CYAN)Checking deployment status...$(NC)"
	kubectl get pods -n $(NAMESPACE)
	kubectl get svc -n $(NAMESPACE)
	kubectl get ingress -n $(NAMESPACE)
	kubectl get hpa -n $(NAMESPACE)

## k8s-logs: View Kubernetes logs
k8s-logs:
	kubectl logs -f -l app=font-scanner -n $(NAMESPACE)

## k8s-describe: Describe Kubernetes deployment
k8s-describe:
	kubectl describe deployment font-scanner -n $(NAMESPACE)

## k8s-delete: Delete Kubernetes deployment
k8s-delete:
	@echo "$(RED)Deleting Kubernetes resources...$(NC)"
	kubectl delete namespace $(NAMESPACE)
	@echo "$(GREEN)Deletion complete$(NC)"

## k8s-rollout: Update Kubernetes deployment
k8s-rollout:
	@echo "$(CYAN)Updating deployment...$(NC)"
	kubectl set image deployment/font-scanner \
		font-scanner=$(DOCKER_IMAGE) \
		-n $(NAMESPACE)
	kubectl rollout status deployment/font-scanner -n $(NAMESPACE)

## security-scan: Run security scans
security-scan:
	@echo "$(CYAN)Running security scans...$(NC)"
	@echo "$(YELLOW)1. NPM Audit...$(NC)"
	npm audit --audit-level=moderate || true
	@echo "$(YELLOW)2. Trivy filesystem scan...$(NC)"
	docker run --rm -v $(PWD):/src aquasec/trivy fs /src || true
	@echo "$(YELLOW)3. Trivy image scan...$(NC)"
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		aquasec/trivy image $(IMAGE_NAME):$(IMAGE_TAG) || true
	@echo "$(GREEN)Security scan complete$(NC)"

## clean: Clean build artifacts and temp files
clean:
	@echo "$(CYAN)Cleaning build artifacts...$(NC)"
	rm -rf node_modules
	rm -rf reports/*
	rm -rf logs/*
	rm -rf coverage
	rm -f *.log
	@echo "$(GREEN)Cleanup complete$(NC)"

## backup-reports: Backup reports directory
backup-reports:
	@echo "$(CYAN)Backing up reports...$(NC)"
	mkdir -p backups
	tar -czf backups/reports-$(shell date +%Y%m%d-%H%M%S).tar.gz reports/
	@echo "$(GREEN)Backup complete$(NC)"

## health: Check application health
health:
	@echo "$(CYAN)Checking application health...$(NC)"
	@curl -s http://localhost:3000/api/health | jq . || echo "$(RED)Health check failed$(NC)"

## metrics: Display Prometheus metrics
metrics:
	@echo "$(CYAN)Fetching metrics...$(NC)"
	@curl -s http://localhost:3000/metrics

## version: Display version information
version:
	@echo "$(CYAN)Font Scanner Version Information$(NC)"
	@node -e "console.log('Node:', process.version)"
	@npm --version | xargs -I {} echo "NPM: {}"
	@docker --version || echo "Docker: not installed"
	@kubectl version --client --short 2>/dev/null || echo "kubectl: not installed"

.DEFAULT_GOAL := help
