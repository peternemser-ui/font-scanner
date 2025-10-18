# Kubernetes Deployment

This directory contains Kubernetes manifests for deploying Font Scanner in a production environment.

## Files Overview

- `namespace.yaml` - Creates the font-scanner namespace
- `configmap.yaml` - Application configuration
- `secret.yaml` - Sensitive configuration (template)
- `serviceaccount.yaml` - Service account and RBAC
- `deployment.yaml` - Application deployment with 3 replicas
- `service.yaml` - ClusterIP and headless services
- `ingress.yaml` - Ingress configuration with TLS
- `hpa.yaml` - Horizontal Pod Autoscaler (3-10 replicas)
- `pdb.yaml` - Pod Disruption Budget (min 2 available)
- `networkpolicy.yaml` - Network security policies

## Prerequisites

- Kubernetes 1.24+
- kubectl configured with cluster access
- NGINX Ingress Controller
- cert-manager (for automatic TLS)
- Metrics Server (for HPA)
- Prometheus (optional, for monitoring)

## Quick Deploy

```bash
# Deploy all resources
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f serviceaccount.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f hpa.yaml
kubectl apply -f pdb.yaml
kubectl apply -f ingress.yaml
kubectl apply -f networkpolicy.yaml

# Or deploy all at once
kubectl apply -f .
```

## Verify Deployment

```bash
# Check pods
kubectl get pods -n font-scanner

# Check services
kubectl get svc -n font-scanner

# Check ingress
kubectl get ingress -n font-scanner

# Check HPA status
kubectl get hpa -n font-scanner

# Check pod logs
kubectl logs -l app=font-scanner -n font-scanner --tail=50
```

## Configuration

### Update ConfigMap

Edit `configmap.yaml` and apply changes:

```bash
kubectl apply -f configmap.yaml
kubectl rollout restart deployment/font-scanner -n font-scanner
```

### Update Secrets

Create real secrets (don't use the template in production):

```bash
kubectl create secret generic font-scanner-secrets \
  --from-literal=API_KEY=your-secret-key \
  --from-literal=OTHER_SECRET=value \
  -n font-scanner \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Update Image

```bash
# Update to new version
kubectl set image deployment/font-scanner \
  font-scanner=ghcr.io/your-org/font-scanner:v1.0.1 \
  -n font-scanner

# Watch rollout
kubectl rollout status deployment/font-scanner -n font-scanner
```

## Scaling

### Manual Scaling

```bash
kubectl scale deployment font-scanner --replicas=5 -n font-scanner
```

### Automatic Scaling

HPA is configured to scale between 3-10 replicas based on:
- CPU utilization > 70%
- Memory utilization > 80%

```bash
# View HPA status
kubectl describe hpa font-scanner -n font-scanner
```

## Monitoring

### Health Checks

```bash
# Port-forward to access locally
kubectl port-forward svc/font-scanner 3000:80 -n font-scanner

# Check health
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
```

### Metrics

```bash
# View Prometheus metrics
kubectl port-forward svc/font-scanner 3000:80 -n font-scanner
curl http://localhost:3000/metrics
```

### Resource Usage

```bash
# View pod resource usage
kubectl top pods -n font-scanner

# View node resource usage
kubectl top nodes
```

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod
kubectl describe pod <pod-name> -n font-scanner

# Check events
kubectl get events -n font-scanner --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n font-scanner
kubectl logs <pod-name> -n font-scanner --previous
```

### Network Issues

```bash
# Test internal connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -n font-scanner -- sh

# Inside debug pod:
wget -O- http://font-scanner.font-scanner.svc.cluster.local/api/health
```

### Certificate Issues

```bash
# Check certificate
kubectl describe certificate font-scanner-tls -n font-scanner

# Check cert-manager logs
kubectl logs -n cert-manager deploy/cert-manager
```

## Security

### Network Policies

Network policies are configured to:
- Allow ingress from ingress-nginx namespace
- Allow ingress from monitoring namespace
- Allow egress to DNS
- Allow egress to HTTP/HTTPS

### RBAC

Minimal RBAC is configured:
- Service account: `font-scanner`
- Permissions: Read ConfigMaps, Read Secrets

### Pod Security

- Non-root user (UID 1001)
- Read-only root filesystem (where possible)
- No privilege escalation
- Dropped all capabilities except NET_BIND_SERVICE
- seccomp profile enabled

## Backup and Restore

### Backup Reports

Reports are stored in emptyDir volumes. For persistence:

1. Use PersistentVolumeClaims:
```yaml
volumes:
- name: reports
  persistentVolumeClaim:
    claimName: font-scanner-reports
```

2. Or backup regularly:
```bash
kubectl cp font-scanner-pod:/app/reports ./reports-backup
```

## Cleanup

```bash
# Delete all resources
kubectl delete namespace font-scanner

# Or selectively
kubectl delete -f .
```

## Production Checklist

- [ ] Update secret.yaml with real secrets
- [ ] Update ingress.yaml with your domain
- [ ] Configure TLS certificates
- [ ] Set up persistent volumes if needed
- [ ] Configure monitoring and alerting
- [ ] Set resource limits appropriately
- [ ] Configure backup strategy
- [ ] Test disaster recovery
- [ ] Document runbooks
- [ ] Set up log aggregation

## Support

For issues and questions, refer to the main [DEPLOYMENT.md](../DEPLOYMENT.md) guide.
