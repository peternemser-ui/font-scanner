# Competitive Analysis Browser Crash Fix

## Problem Summary

The competitive analysis feature was causing:
1. **Browser crashes** - System overload from too many concurrent Puppeteer instances
2. **Process leaks** - Chrome processes not being cleaned up properly
3. **Memory exhaustion** - Multiple heavy analyzers running in parallel
4. **CPU overload** - Up to 30 concurrent browser operations (5 analyzers × 6 sites)

## Root Causes

### 1. Parallel Execution at Multiple Levels
```javascript
// OLD - PROBLEMATIC CODE
// Per site: 5 analyzers running in parallel
const [performance, accessibility, cwv] = await Promise.allSettled([...]);

// Across sites: Potential for parallel execution
```

**Impact**: With 1 + 5 competitors, this meant 6 sites × 5 analyzers = 30 concurrent browser operations, but browser pool only had max 5 browsers!

### 2. No Resource Management
- No delays between operations
- No cleanup between analyzer runs
- No timeout protection
- No circuit breaker for cascading failures
- Browser pool exhaustion (only 5 browsers max)

### 3. Insufficient Rate Limiting
- Used same rate limit as regular scans (20 per 15 min)
- No consideration for resource intensity
- Competitive analysis takes 5-15 minutes each

## Solutions Implemented

### 1. Sequential Execution Pattern ✅

**Service Layer** (`src/services/competitiveAnalysisService.js`):

```javascript
// NEW - FIXED CODE
async analyzeSingleSite(url) {
  // Run analyzers SEQUENTIALLY with timeouts and cleanup delays
  
  // 1. SEO Analysis (lightweight, 30s timeout)
  results.seo = await this.runWithTimeout(seoAnalyzer.analyzeSEO(url), 30000, 'SEO');
  await this.cleanup(500); // Small delay
  
  // 2. Security Analysis (lightweight, 30s timeout)
  results.security = await this.runWithTimeout(...);
  await this.cleanup(500);
  
  // 3. Accessibility Analysis (medium, 45s timeout)
  results.accessibility = await this.runWithTimeout(...);
  await this.cleanup(1000); // Longer delay
  
  // 4. Core Web Vitals (heavy, 60s timeout)
  results.cwv = await this.runWithTimeout(...);
  await this.cleanup(2000); // Even longer delay
  
  // 5. Performance Analysis (heaviest, 90s timeout)
  results.performance = await this.runWithTimeout(...);
  await this.cleanup(2000);
}
```

**Benefits**:
- Only 1 browser from pool at a time per site
- Proper cleanup between operations
- Timeout protection prevents hanging operations
- Graceful degradation if analyzer fails

### 2. Circuit Breaker Pattern ✅

```javascript
async analyzeCompetitors(yourUrl, competitorUrls) {
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 2;
  
  for (let i = 0; i < competitorUrls.length; i++) {
    // Stop if too many failures
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logger.error(`⚠️ CIRCUIT BREAKER TRIGGERED`);
      break;
    }
    
    const result = await this.analyzeSingleSite(competitorUrls[i]);
    
    if (result.error) {
      consecutiveFailures++;
    } else {
      consecutiveFailures = 0; // Reset on success
    }
    
    // 5 second delay between sites
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
```

### 3. Resource Limits ✅

**Configuration** (`src/config/index.js`):

```javascript
competitiveAnalysis: {
  // Maximum competitors reduced from 5 to 3
  maxCompetitors: 3,
  
  // Individual analyzer timeouts
  analyzerTimeouts: {
    seo: 30000,        // 30s
    security: 30000,   // 30s
    accessibility: 45000, // 45s
    coreWebVitals: 60000, // 60s
    performance: 90000,   // 90s
  },
  
  // Cleanup delays
  delays: {
    betweenAnalyzers: 1000, // 1s
    betweenSites: 5000,     // 5s
    afterFailure: 3000,     // 3s
  },
  
  // Circuit breaker
  circuitBreaker: {
    maxConsecutiveFailures: 2,
    resetTimeout: 300000, // 5 min
  },
}
```

### 4. Aggressive Rate Limiting ✅

**Middleware** (`src/middleware/rateLimiter.js`):

```javascript
// NEW - Very restrictive rate limiter
const competitiveAnalysisLimiter = createRateLimiter('competitive-analysis', {
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 2,                     // Only 2 requests per 15 min
  message: 'Competitive analysis is very resource-intensive...',
});
```

**Applied in** `src/server.js`:
```javascript
app.post('/api/competitive-analysis', competitiveAnalysisLimiter, ...);
```

### 5. Enhanced Error Handling ✅

**Controller Layer** (`src/controllers/competitiveAnalysisController.js`):

```javascript
// Overall 20-minute timeout for entire analysis
const OVERALL_TIMEOUT = 20 * 60 * 1000;

const analysisPromise = competitiveAnalysisService.analyzeCompetitors(...);
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Analysis timed out')), OVERALL_TIMEOUT);
});

const results = await Promise.race([analysisPromise, timeoutPromise]);

// Add warnings for partial failures
if (successRate < 50) {
  results.warning = 'Less than 50% of sites analyzed successfully...';
}

if (results.metadata?.circuitBreakerTriggered) {
  results.warning += ' Circuit breaker triggered...';
}
```

### 6. Comprehensive Logging ✅

```javascript
logger.info('═══════════════════════════════════════════════');
logger.info('ANALYZING YOUR SITE...');
logger.info('═══════════════════════════════════════════════');

logger.info(`${url}: Running SEO analysis...`);
logger.info(`${url}: SEO completed (score: ${scores.seo})`);

logger.info('⏳ Waiting 5 seconds before next competitor...');

logger.info(`✅ COMPETITIVE ANALYSIS COMPLETED in ${results.analysisTime}s`);
logger.info(`   Successful: ${results.metadata.successfulAnalyses}/${results.metadata.totalSitesAnalyzed}`);
```

## Performance Improvements

### Before (Problematic)
- **Max concurrent operations**: 30 (6 sites × 5 analyzers)
- **Browser pool size**: 5
- **Result**: Pool exhaustion, crashes, process leaks
- **Time**: Could hang indefinitely
- **Rate limit**: 20 per 15 min (same as regular scans)

### After (Fixed)
- **Max concurrent operations**: 1 analyzer at a time
- **Browser pool utilization**: 1-2 browsers typically
- **Result**: Stable, predictable resource usage
- **Time**: 5-15 minutes per analysis (with timeouts)
- **Rate limit**: 2 per 15 min (highly restrictive)

## Migration Guide

### For Users

**Old behavior**:
- Could analyze 1 + 5 competitors (6 sites)
- Often crashed or hung
- 20 requests per 15 minutes

**New behavior**:
- Limited to 1 + 3 competitors (4 sites) for system protection
- Stable, always completes (or times out gracefully)
- 2 requests per 15 minutes
- Takes 5-15 minutes per analysis
- Shows progress in logs
- Provides partial results if some analyzers fail

### For Developers

**Important patterns to follow**:

1. **Always use sequential execution** for heavy operations:
   ```javascript
   // ❌ BAD - Parallel
   await Promise.all([heavy1(), heavy2(), heavy3()]);
   
   // ✅ GOOD - Sequential
   await heavy1();
   await cleanup(1000);
   await heavy2();
   await cleanup(1000);
   await heavy3();
   ```

2. **Always add timeouts** to external operations:
   ```javascript
   await runWithTimeout(operation(), 30000, 'OperationName');
   ```

3. **Always add cleanup delays** after heavy operations:
   ```javascript
   await cleanup(2000); // Let browser resources be released
   ```

4. **Always implement circuit breakers** for operations that can fail:
   ```javascript
   if (consecutiveFailures >= MAX_FAILURES) {
     break; // Stop before cascading failures
   }
   ```

## Testing Recommendations

### Manual Testing
```bash
# 1. Start the server
npm start

# 2. Test competitive analysis with 1 competitor
curl -X POST http://localhost:3000/api/competitive-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "yourUrl": "https://example.com",
    "competitorUrls": ["https://competitor.com"]
  }'

# 3. Monitor Chrome processes
Get-Process | Where-Object {$_.ProcessName -eq "chrome"}

# 4. Verify no leaks after completion
# Chrome processes should return to baseline (0-2 instances)
```

### Load Testing
```bash
# Verify rate limiting works
# Should block after 2 requests in 15 minutes
```

### Resource Monitoring
- CPU usage should stay under 80%
- Memory should not continuously grow
- Chrome processes should be cleaned up after each site
- No zombie processes after completion

## Environment Variables

New environment variables for fine-tuning:

```bash
# Competitive Analysis Limits
COMPETITIVE_MAX_COMPETITORS=3           # Max competitors per request
COMPETITIVE_SEO_TIMEOUT=30000          # SEO analyzer timeout (ms)
COMPETITIVE_SECURITY_TIMEOUT=30000     # Security analyzer timeout (ms)
COMPETITIVE_A11Y_TIMEOUT=45000         # Accessibility timeout (ms)
COMPETITIVE_CWV_TIMEOUT=60000          # Core Web Vitals timeout (ms)
COMPETITIVE_PERF_TIMEOUT=90000         # Performance timeout (ms)
COMPETITIVE_ANALYZER_DELAY=1000        # Delay between analyzers (ms)
COMPETITIVE_SITE_DELAY=5000            # Delay between sites (ms)
COMPETITIVE_MAX_FAILURES=2             # Circuit breaker threshold
COMPETITIVE_RATE_WINDOW_MS=900000      # Rate limit window (15 min)
COMPETITIVE_RATE_MAX_REQUESTS=2        # Max requests per window
```

## Monitoring

### Key Metrics to Watch
1. **Browser pool stats** - Check `/api/health` for pool utilization
2. **Rate limit violations** - Check `/api/admin/rate-limits` for abuse
3. **Error rates** - Check `/api/admin/errors` for analyzer failures
4. **Response times** - Prometheus metrics at `/metrics`

### Log Patterns to Look For

**Good signs**:
```
✅ Browser acquired in 50ms
✅ Browser released to pool
✅ COMPETITIVE ANALYSIS COMPLETED in 480.5s
   Successful: 4/4
```

**Warning signs**:
```
⚠️ Browser validation failed: not connected
⚠️ CIRCUIT BREAKER TRIGGERED: 2 consecutive failures
❌ Failed to acquire browser
```

## Files Modified

1. `src/services/competitiveAnalysisService.js` - Sequential execution, timeouts, cleanup
2. `src/controllers/competitiveAnalysisController.js` - Enhanced validation, error boundaries
3. `src/config/index.js` - Competitive analysis configuration
4. `src/middleware/rateLimiter.js` - New competitive analysis rate limiter
5. `src/server.js` - Apply competitive analysis rate limiter

## Next Steps

1. **Monitor in production** - Watch for any remaining issues
2. **Tune timeouts** - Adjust based on real-world performance
3. **Consider Redis** - For distributed rate limiting in multi-instance deployments
4. **Add caching** - Cache competitor analysis results for 1 hour
5. **Add queue system** - For handling multiple concurrent requests (BullMQ, etc.)

## Related Documentation

- `BROWSER_POOL_IMPLEMENTATION.md` - Browser pool architecture
- `RATE_LIMITING.md` - Rate limiting patterns
- `ARCHITECTURE_REVIEW.md` - Overall system architecture
- `docs/ERROR_TELEMETRY.md` - Error tracking and monitoring
