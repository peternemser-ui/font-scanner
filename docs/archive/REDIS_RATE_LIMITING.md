# Redis-Based Rate Limiting

## Overview

For production deployments with multiple Font Scanner instances, the default in-memory rate limiting store is insufficient because each instance tracks rate limits independently. This document explains how to implement Redis-based distributed rate limiting.

## Why Redis?

### Problem with Memory Store

**Single Instance:**
```
User → Server Instance → Memory Store
           ↓
    100 requests/15min limit ✅
```

**Multiple Instances (Load Balanced):**
```
          ┌─ Instance 1 (Memory: 50 req) ─┐
User → LB ├─ Instance 2 (Memory: 30 req) ─┤ = 130 requests total ❌
          └─ Instance 3 (Memory: 50 req) ─┘
```

Each instance has its own rate limit counter, so a user can make 100 requests to each instance, defeating the rate limit.

**With Redis:**
```
          ┌─ Instance 1 ─┐
User → LB ├─ Instance 2 ─┤ → Redis (Shared: 100 req) ✅
          └─ Instance 3 ─┘
```

All instances share the same rate limit state in Redis.

### Benefits

- ✅ **Distributed**: Rate limits work correctly across multiple instances
- ✅ **Persistent**: Survives application restarts
- ✅ **Fast**: Redis is optimized for high-performance counter operations
- ✅ **Scalable**: Supports horizontal scaling
- ✅ **TTL Support**: Automatic expiration of rate limit windows

## Implementation

### Step 1: Install Dependencies

```bash
npm install rate-limit-redis ioredis
```

**Package Versions:**
- `rate-limit-redis`: ^4.0.0+
- `ioredis`: ^5.0.0+

### Step 2: Create Redis Client

Create `src/utils/redisClient.js`:

```javascript
/**
 * Redis Client Configuration
 * Shared Redis connection for rate limiting and caching
 */

const Redis = require('ioredis');
const { createLogger } = require('./logger');

const logger = createLogger('Redis');

/**
 * Create Redis client with connection pooling and error handling
 */
const createRedisClient = () => {
  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    
    // Connection settings
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
      return delay;
    },
    
    // Timeouts
    connectTimeout: 10000,
    commandTimeout: 5000,
    
    // Keep-alive
    keepAlive: 30000,
    
    // Pool settings
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    
    // Reconnection
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Reconnect on READONLY errors
        return true;
      }
      return false;
    },
  });

  // Event handlers
  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('error', (err) => {
    logger.error('Redis client error:', err);
  });

  client.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting...');
  });

  // Test connection
  client.ping().then(() => {
    logger.info('Redis connection test successful');
  }).catch((err) => {
    logger.error('Redis connection test failed:', err);
  });

  return client;
};

// Create and export singleton instance
let redisClient = null;

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
};

const closeRedisClient = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis client closed');
  }
};

module.exports = {
  getRedisClient,
  closeRedisClient,
};
```

### Step 3: Update Rate Limiter Middleware

Update `src/middleware/rateLimiter.js`:

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { getRedisClient } = require('../utils/redisClient');
const { createLogger } = require('../utils/logger');
const { rateLimitCounter } = require('./metrics');

const logger = createLogger('RateLimiter');

// Determine if Redis should be used
const USE_REDIS = process.env.USE_REDIS_RATE_LIMITING === 'true';

/**
 * Create rate limit store (Redis or Memory)
 */
const createStore = (prefix) => {
  if (USE_REDIS) {
    try {
      const redisClient = getRedisClient();
      logger.info(`Using Redis store for rate limiting: ${prefix}`);
      
      return new RedisStore({
        // Redis client instance
        // @ts-expect-error - Known issue with the class's name
        sendCommand: (...args) => redisClient.call(...args),
        
        // Key prefix for this rate limiter
        prefix: `rl:${prefix}:`,
      });
    } catch (error) {
      logger.error('Failed to create Redis store, falling back to memory:', error);
      return undefined; // Use default memory store
    }
  }
  
  logger.info('Using in-memory store for rate limiting');
  return undefined; // Use default memory store
};

/**
 * Create a standardized rate limit handler with logging and metrics
 * @param {string} name - Name for this rate limiter (for logging)
 * @param {object} options - express-rate-limit options
 */
const createRateLimiter = (name, options) => {
  const defaultOptions = {
    // Use Redis store if configured, otherwise memory
    store: createStore(name),
    
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      const requestId = req.id || 'unknown';
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const endpoint = req.path || 'unknown';
      
      logger.warn('Rate limit exceeded', {
        requestId,
        ip,
        endpoint,
        limiter: name,
        limit: options.max,
        window: `${options.windowMs / 1000}s`,
        store: USE_REDIS ? 'redis' : 'memory',
      });

      // Increment Prometheus counter
      if (rateLimitCounter) {
        rateLimitCounter.inc({
          limiter: name,
          endpoint,
        });
      }

      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'You have exceeded the rate limit. Please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000),
        requestId,
        details: {
          limit: options.max,
          window: `${options.windowMs / 1000} seconds`,
          limiter: name,
        },
      });
    },

    // Skip requests that shouldn't count against rate limit
    skip: (req) => {
      // Don't count health checks
      if (req.path === '/api/health' || req.path === '/api/ready') {
        return true;
      }
      // Don't count monitoring/admin endpoints
      if (req.path === '/api/rate-limits' || req.path === '/api/admin/rate-limits' || req.path === '/metrics') {
        return true;
      }
      return false;
    },

    // Key generator - default is IP address
    keyGenerator: (req) => {
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
  };

  // Merge options
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };

  return rateLimit(mergedOptions);
};

// ... rest of the file remains the same
```

### Step 4: Update Server Shutdown

Update `src/server.js` to close Redis connection on shutdown:

```javascript
const { closeRedisClient } = require('./utils/redisClient');

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  isShuttingDown = true;

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed. All connections finished.');

    // Cleanup tasks
    logger.info('Performing cleanup tasks...');

    // Drain browser pool
    try {
      logger.info('Draining browser pool...');
      await browserPool.drain();
      logger.info('Browser pool drained successfully');
    } catch (error) {
      logger.error('Error draining browser pool:', error);
    }

    // Close Redis connection
    try {
      logger.info('Closing Redis connection...');
      await closeRedisClient();
      logger.info('Redis connection closed successfully');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }

    logger.info('Cleanup complete. Exiting process.');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing shutdown.');
    process.exit(1);
  }, 30000);
};
```

### Step 5: Environment Configuration

Add to `.env`:

```env
# Redis Configuration (for distributed rate limiting)
USE_REDIS_RATE_LIMITING=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0
```

### Step 6: Docker Compose with Redis

Update `docker-compose.yml`:

```yaml
version: '3.8'

services:
  font-scanner:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - USE_REDIS_RATE_LIMITING=true
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    depends_on:
      - redis
    restart: unless-stopped
    deploy:
      replicas: 3  # Multiple instances for load balancing
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - font-scanner
    restart: unless-stopped

volumes:
  redis-data:
```

### Step 7: Kubernetes Deployment with Redis

**Redis Deployment (`k8s/redis-deployment.yaml`):**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: font-scanner
spec:
  ports:
  - port: 6379
    targetPort: 6379
  selector:
    app: redis
  type: ClusterIP
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: font-scanner
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - --requirepass
        - $(REDIS_PASSWORD)
        ports:
        - containerPort: 6379
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: font-scanner-secrets
              key: redis-password
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: redis-data
          mountPath: /data
      volumes:
      - name: redis-data
        persistentVolumeClaim:
          claimName: redis-pvc
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: font-scanner
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

**Update Font Scanner ConfigMap:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: font-scanner-config
  namespace: font-scanner
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "INFO"
  
  # Redis configuration
  USE_REDIS_RATE_LIMITING: "true"
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
  REDIS_DB: "0"
  
  # Rate limiting
  RATE_LIMIT_WINDOW_MS: "900000"
  RATE_LIMIT_MAX_REQUESTS: "100"
  SCAN_RATE_LIMIT_MAX_REQUESTS: "20"
  DOWNLOAD_RATE_LIMIT_MAX_REQUESTS: "50"
```

## Testing Redis Integration

### Manual Testing

1. **Start Redis:**
```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

2. **Start Font Scanner with Redis:**
```bash
export USE_REDIS_RATE_LIMITING=true
export REDIS_HOST=localhost
export REDIS_PORT=6379
npm start
```

3. **Test Rate Limiting:**
```bash
# Make requests
for i in {1..105}; do
  curl http://localhost:3000/api/test
done
```

4. **Verify Redis Keys:**
```bash
docker exec -it redis redis-cli

> KEYS rl:*
> TTL rl:global:::1
> GET rl:global:::1
```

### Automated Testing

Create `tests/redis-rate-limiting.test.js`:

```javascript
const Redis = require('ioredis');
const request = require('supertest');
const app = require('../src/server');

describe('Redis Rate Limiting', () => {
  let redisClient;

  beforeAll(() => {
    if (process.env.USE_REDIS_RATE_LIMITING === 'true') {
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      });
    }
  });

  afterAll(async () => {
    if (redisClient) {
      await redisClient.quit();
    }
  });

  it('should store rate limit data in Redis', async () => {
    if (!process.env.USE_REDIS_RATE_LIMITING) {
      console.log('Skipping Redis test - Redis not enabled');
      return;
    }

    // Make a request
    await request(app).get('/api/test');

    // Check Redis for rate limit key
    const keys = await redisClient.keys('rl:global:*');
    expect(keys.length).toBeGreaterThan(0);
  });

  it('should enforce rate limits across multiple app instances', async () => {
    if (!process.env.USE_REDIS_RATE_LIMITING) {
      console.log('Skipping Redis test - Redis not enabled');
      return;
    }

    // This test requires multiple app instances
    // In practice, you'd start multiple servers
    // For testing, we can verify Redis keys are shared
    
    await request(app).get('/api/test');
    const keys = await redisClient.keys('rl:*');
    
    // All instances would see these keys
    expect(keys.length).toBeGreaterThan(0);
  });
});
```

## Monitoring Redis

### Redis Metrics

Monitor these Redis metrics:

1. **Connected Clients:**
```bash
redis-cli INFO clients | grep connected_clients
```

2. **Memory Usage:**
```bash
redis-cli INFO memory | grep used_memory_human
```

3. **Rate Limit Keys:**
```bash
redis-cli KEYS "rl:*" | wc -l
```

4. **TTL Distribution:**
```bash
redis-cli --scan --pattern "rl:*" | xargs -L1 redis-cli TTL
```

### Prometheus Exporter

Use Redis Exporter for Prometheus:

```bash
docker run -d \
  --name redis-exporter \
  -p 9121:9121 \
  oliver006/redis_exporter:latest \
  --redis.addr=redis://redis:6379
```

**Grafana Dashboard:**
- Import dashboard ID: 763 (Redis Dashboard for Prometheus Redis Exporter)

## Troubleshooting

### Issue: Rate limits not working across instances

**Symptoms:**
- Each instance has separate rate limits
- Users can bypass limits by hitting different instances

**Solution:**
1. Verify Redis connection:
```bash
docker exec -it font-scanner-1 node -e "
  const Redis = require('ioredis');
  const client = new Redis('redis://redis:6379');
  client.ping().then(() => console.log('OK')).catch(console.error);
"
```

2. Check environment variable:
```bash
echo $USE_REDIS_RATE_LIMITING  # Should be "true"
```

3. Check Redis keys:
```bash
redis-cli KEYS "rl:*"
```

### Issue: Redis connection errors

**Symptoms:**
- "ECONNREFUSED" errors
- Rate limiting falls back to memory

**Solution:**
1. Verify Redis is running:
```bash
docker ps | grep redis
```

2. Test Redis connectivity:
```bash
redis-cli -h redis ping
```

3. Check firewall rules:
```bash
telnet redis 6379
```

### Issue: High Redis memory usage

**Symptoms:**
- Redis memory grows continuously
- OOM errors

**Solution:**
1. Check key count:
```bash
redis-cli DBSIZE
```

2. Verify TTL is set:
```bash
redis-cli --scan --pattern "rl:*" | xargs -L1 redis-cli TTL
```

3. Set maxmemory policy:
```bash
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Issue: Slow rate limit checks

**Symptoms:**
- High latency on requests
- Redis command timeouts

**Solution:**
1. Check Redis latency:
```bash
redis-cli --latency
```

2. Enable connection pooling (already configured in ioredis)

3. Monitor slow queries:
```bash
redis-cli SLOWLOG GET 10
```

## Performance Considerations

### Redis vs Memory Store

| Metric | Memory Store | Redis Store |
|--------|-------------|-------------|
| Latency | ~0.1ms | ~1-5ms |
| Throughput | Very High | High |
| Scalability | Single instance | Distributed |
| Persistence | None | Yes |
| Memory Usage | Per instance | Shared |

### Optimization Tips

1. **Use Connection Pooling:** Already configured in `ioredis`

2. **Enable Pipelining:** For batch operations
```javascript
const pipeline = redisClient.pipeline();
pipeline.get('key1');
pipeline.get('key2');
await pipeline.exec();
```

3. **Monitor Redis Latency:** Set up alerts for latency > 10ms

4. **Use Redis Cluster:** For very high scale (10k+ RPS)

5. **Tune Redis Configuration:**
```conf
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1  # Snapshot every 15 minutes if 1+ keys changed
tcp-keepalive 60
timeout 300
```

## Cost Considerations

### AWS ElastiCache Pricing (us-east-1, 2025)

| Instance Type | Memory | vCPUs | Price/Hour | Price/Month |
|--------------|--------|-------|------------|-------------|
| cache.t3.micro | 0.5 GB | 2 | $0.017 | ~$12 |
| cache.t3.small | 1.4 GB | 2 | $0.034 | ~$25 |
| cache.t3.medium | 3.1 GB | 2 | $0.068 | ~$50 |
| cache.m6g.large | 6.4 GB | 2 | $0.119 | ~$87 |

### Recommendations by Scale

- **Development:** Local Redis (free)
- **Small Production (<100 RPS):** cache.t3.micro ($12/mo)
- **Medium Production (100-1000 RPS):** cache.t3.small ($25/mo)
- **Large Production (1000+ RPS):** cache.m6g.large+ ($87+/mo)

## Summary

✅ **When to Use Redis Rate Limiting:**
- Multiple application instances
- Load balanced deployments
- Kubernetes/Docker Swarm environments
- Need for persistent rate limits

❌ **When Memory Store is Fine:**
- Single instance deployments
- Development/testing
- Cost-sensitive scenarios
- Very low latency requirements (<1ms)

**Migration Path:**
1. Start with memory store (default)
2. Add Redis when scaling to multiple instances
3. Monitor Redis performance
4. Consider Redis Cluster for very high scale

For more information, see:
- [Rate Limiting Documentation](./RATE_LIMITING.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Kubernetes Deployment](./k8s/)
