#!/usr/bin/env node

/**
 * Load Testing Script for Site Mechanic
 *
 * Uses autocannon to hammer key endpoints and report throughput,
 * latency percentiles, and error rates.
 *
 * Usage:
 *   node scripts/load-test.js                        # defaults: localhost:3000, 10s, 10 concurrent
 *   node scripts/load-test.js --url http://staging:3000 --duration 30 --connections 50
 *   node scripts/load-test.js --suite quick           # predefined suite
 *   node scripts/load-test.js --suite full            # full production load test
 *
 * Environment:
 *   LOAD_TEST_URL       Base URL (default http://localhost:3000)
 *   LOAD_TEST_TOKEN     JWT token for authenticated endpoint tests
 */

const autocannon = require('autocannon');

// ─── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const BASE_URL = flag('url', process.env.LOAD_TEST_URL || 'http://localhost:3000');
const TOKEN = flag('token', process.env.LOAD_TEST_TOKEN || '');
const SUITE = flag('suite', 'quick');
const DURATION = parseInt(flag('duration', '10'), 10);
const CONNECTIONS = parseInt(flag('connections', '10'), 10);

// ─── Suites ────────────────────────────────────────────────────────────────────

const suites = {
  quick: {
    description: 'Quick smoke test — lightweight endpoints only',
    scenarios: [
      { name: 'Health Check',   path: '/api/health',  method: 'GET',  duration: DURATION, connections: CONNECTIONS },
      { name: 'Ready Check',    path: '/api/ready',   method: 'GET',  duration: DURATION, connections: CONNECTIONS },
      { name: 'Usage (anon)',   path: '/api/auth/usage', method: 'GET', duration: DURATION, connections: CONNECTIONS },
    ],
  },

  auth: {
    description: 'Auth endpoint stress test',
    scenarios: [
      { name: 'Login (invalid)', path: '/api/auth/login', method: 'POST', duration: DURATION, connections: CONNECTIONS,
        body: JSON.stringify({ email: 'load@test.com', password: 'wrong' }),
        headers: { 'content-type': 'application/json' } },
      { name: 'Register (dup)', path: '/api/auth/register', method: 'POST', duration: DURATION, connections: Math.min(CONNECTIONS, 5),
        body: JSON.stringify({ email: 'load@test.com', password: 'TestPass123' }),
        headers: { 'content-type': 'application/json' } },
    ],
  },

  scan: {
    description: 'Scan creation stress test (rate-limited in production)',
    scenarios: [
      { name: 'Create Scan (anon)', path: '/api/scans', method: 'POST', duration: Math.min(DURATION, 15), connections: 2,
        body: JSON.stringify({ url: 'https://example.com', options: { maxPages: 1, maxDepth: 1 } }),
        headers: { 'content-type': 'application/json' } },
    ],
  },

  full: {
    description: 'Full production load test — all endpoint categories',
    scenarios: [
      { name: 'Health Check',      path: '/api/health',     method: 'GET', duration: 30, connections: 50 },
      { name: 'Ready Check',       path: '/api/ready',      method: 'GET', duration: 30, connections: 20 },
      { name: 'Usage (anon)',      path: '/api/auth/usage', method: 'GET', duration: 30, connections: 30 },
      { name: 'Static CSS',        path: '/css/design-tokens.css', method: 'GET', duration: 30, connections: 50 },
      { name: 'Login (invalid)',   path: '/api/auth/login', method: 'POST', duration: 20, connections: 10,
        body: JSON.stringify({ email: 'load@test.com', password: 'wrong' }),
        headers: { 'content-type': 'application/json' } },
      { name: 'Create Scan (anon)', path: '/api/scans', method: 'POST', duration: 15, connections: 3,
        body: JSON.stringify({ url: 'https://example.com', options: { maxPages: 1, maxDepth: 1 } }),
        headers: { 'content-type': 'application/json' } },
    ],
  },
};

// ─── Runner ────────────────────────────────────────────────────────────────────

function runScenario(scenario) {
  return new Promise((resolve, reject) => {
    const opts = {
      url: `${BASE_URL}${scenario.path}`,
      method: scenario.method,
      duration: scenario.duration,
      connections: scenario.connections,
      pipelining: 1,
      headers: { ...scenario.headers },
    };

    if (scenario.body) opts.body = scenario.body;
    if (TOKEN) opts.headers.authorization = `Bearer ${TOKEN}`;

    const instance = autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });

    // Progress bar
    autocannon.track(instance, { renderProgressBar: true });
  });
}

function formatResult(name, r) {
  const errRate = r.errors ? ((r.errors / r.requests.total) * 100).toFixed(1) : '0.0';
  const non2xx = r.non2xx || 0;
  return {
    scenario: name,
    requests: r.requests.total,
    throughput: `${r.requests.average.toFixed(0)} req/s`,
    latency_p50: `${r.latency.p50}ms`,
    latency_p99: `${r.latency.p99}ms`,
    latency_max: `${r.latency.max}ms`,
    errors: r.errors || 0,
    non2xx,
    error_rate: `${errRate}%`,
    duration: `${r.duration}s`,
    connections: r.connections,
  };
}

async function run() {
  const suite = suites[SUITE];
  if (!suite) {
    console.error(`Unknown suite "${SUITE}". Available: ${Object.keys(suites).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n=== Load Test: ${suite.description} ===`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Suite: ${SUITE}\n`);

  const results = [];

  for (const scenario of suite.scenarios) {
    console.log(`\n--- ${scenario.name} (${scenario.method} ${scenario.path}) ---`);
    console.log(`  ${scenario.connections} connections for ${scenario.duration}s\n`);

    try {
      const r = await runScenario(scenario);
      results.push(formatResult(scenario.name, r));
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      results.push({ scenario: scenario.name, error: err.message });
    }
  }

  // Summary table
  console.log('\n\n=== SUMMARY ===\n');
  console.table(results);

  // Pass/fail checks
  const failures = results.filter(r => {
    if (r.error) return true;
    const errRate = parseFloat(r.error_rate);
    if (errRate > 5) return true;
    const p99 = parseInt(r.latency_p99);
    if (p99 > 5000) return true;
    return false;
  });

  if (failures.length > 0) {
    console.log('\n⚠ WARNING: Some scenarios exceeded thresholds:');
    failures.forEach(f => {
      console.log(`  - ${f.scenario}: ${f.error || `error_rate=${f.error_rate}, p99=${f.latency_p99}`}`);
    });
    process.exit(1);
  } else {
    console.log('\nAll scenarios within acceptable thresholds (error_rate < 5%, p99 < 5000ms).');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
