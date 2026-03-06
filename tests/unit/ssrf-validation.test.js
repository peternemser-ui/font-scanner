/**
 * SSRF Protection Test Suite
 *
 * Tests the isUrlSafe() function and its helpers against known SSRF
 * attack vectors including private IPs, cloud metadata endpoints,
 * DNS rebinding patterns, and blocked URL schemes.
 */

const {
  isUrlSafe,
  isBlockedIP,
  isBlockedHostname,
  isPrivateIPv4,
  isPrivateIPv6
} = require('../../src/utils/ssrfProtection');

// ─── isPrivateIPv4 ──────────────────────────────────────────────────────────

describe('isPrivateIPv4', () => {
  test.each([
    ['127.0.0.1', true, 'loopback'],
    ['127.255.255.255', true, 'loopback range end'],
    ['10.0.0.1', true, 'RFC 1918 class A'],
    ['10.255.255.255', true, 'RFC 1918 class A end'],
    ['172.16.0.1', true, 'RFC 1918 class B start'],
    ['172.31.255.255', true, 'RFC 1918 class B end'],
    ['172.15.255.255', false, 'just below RFC 1918 class B'],
    ['172.32.0.0', false, 'just above RFC 1918 class B'],
    ['192.168.0.1', true, 'RFC 1918 class C'],
    ['192.168.255.255', true, 'RFC 1918 class C end'],
    ['169.254.169.254', true, 'AWS/GCP/Azure metadata'],
    ['169.254.0.1', true, 'link-local'],
    ['0.0.0.0', true, 'current network'],
    ['100.100.100.200', true, 'Alibaba Cloud metadata'],
    ['100.64.0.1', true, 'CGNAT'],
    ['100.127.255.255', true, 'CGNAT end'],
    ['224.0.0.1', true, 'multicast'],
    ['240.0.0.1', true, 'reserved'],
    ['255.255.255.255', true, 'broadcast'],
    ['8.8.8.8', false, 'Google DNS - public'],
    ['1.1.1.1', false, 'Cloudflare DNS - public'],
    ['93.184.216.34', false, 'example.com IP - public'],
    ['192.0.2.1', true, 'TEST-NET-1 documentation'],
    ['198.51.100.1', true, 'TEST-NET-2 documentation'],
    ['203.0.113.1', true, 'TEST-NET-3 documentation'],
  ])('%s should return %s (%s)', (ip, expected, _desc) => {
    expect(isPrivateIPv4(ip)).toBe(expected);
  });

  test('malformed IPs are treated as blocked', () => {
    expect(isPrivateIPv4('999.999.999.999')).toBe(true);
    expect(isPrivateIPv4('abc.def.ghi.jkl')).toBe(true);
    expect(isPrivateIPv4('')).toBe(true);
  });
});

// ─── isPrivateIPv6 ──────────────────────────────────────────────────────────

describe('isPrivateIPv6', () => {
  test.each([
    ['::1', true, 'IPv6 loopback'],
    ['::', true, 'IPv6 unspecified'],
    ['fe80::1', true, 'link-local'],
    ['fe80::1234:abcd', true, 'link-local with suffix'],
    ['fc00::1', true, 'unique local (fc00::)'],
    ['fd00::1', true, 'unique local (fd00::)'],
    ['::ffff:127.0.0.1', true, 'IPv4-mapped loopback'],
    ['::ffff:10.0.0.1', true, 'IPv4-mapped private'],
    ['::ffff:8.8.8.8', false, 'IPv4-mapped public'],
    ['2001:4860:4860::8888', false, 'Google public DNS IPv6'],
  ])('%s should return %s (%s)', (ip, expected, _desc) => {
    expect(isPrivateIPv6(ip)).toBe(expected);
  });
});

// ─── isBlockedHostname ──────────────────────────────────────────────────────

describe('isBlockedHostname', () => {
  test.each([
    ['metadata.google.internal', true, 'GCP metadata'],
    ['sub.metadata.google.internal', true, 'GCP metadata subdomain'],
    ['metadata.goog', true, 'GCP alternate'],
    ['kubernetes.default.svc', true, 'K8s API'],
    ['kubernetes.default', true, 'K8s API short'],
    ['localhost', true, 'localhost'],
    ['sub.localhost', true, 'localhost subdomain'],
    ['myapp.local', true, '.local TLD'],
    ['printer.local', true, '.local TLD device'],
    ['example.com', false, 'public domain'],
    ['google.com', false, 'public domain'],
    ['my-internal-service.internal.company.com', false, 'internal subdomain of public domain'],
  ])('%s should return %s (%s)', (hostname, expected, _desc) => {
    expect(isBlockedHostname(hostname)).toBe(expected);
  });
});

// ─── isBlockedIP ────────────────────────────────────────────────────────────

describe('isBlockedIP', () => {
  test('blocks AWS metadata IP', () => {
    expect(isBlockedIP('169.254.169.254')).toBe(true);
  });

  test('blocks Alibaba metadata IP', () => {
    expect(isBlockedIP('100.100.100.200')).toBe(true);
  });

  test('blocks ECS task metadata IP', () => {
    expect(isBlockedIP('169.254.170.2')).toBe(true);
  });

  test('allows public IPs', () => {
    expect(isBlockedIP('8.8.8.8')).toBe(false);
    expect(isBlockedIP('93.184.216.34')).toBe(false);
  });

  test('blocks IPv6 loopback', () => {
    expect(isBlockedIP('::1')).toBe(true);
  });
});

// ─── isUrlSafe ──────────────────────────────────────────────────────────────

describe('isUrlSafe', () => {
  // --- Blocked URL schemes ---

  test('blocks file:// URLs', async () => {
    const result = await isUrlSafe('file:///etc/passwd');
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/scheme/i);
  });

  test('blocks ftp:// URLs', async () => {
    const result = await isUrlSafe('ftp://internal-server/data');
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/scheme/i);
  });

  test('blocks javascript: URLs', async () => {
    const result = await isUrlSafe('javascript:alert(1)');
    expect(result.safe).toBe(false);
  });

  test('blocks data: URLs', async () => {
    const result = await isUrlSafe('data:text/html,<h1>hi</h1>');
    expect(result.safe).toBe(false);
  });

  // --- Private IP literals ---

  test('blocks http://127.0.0.1', async () => {
    const result = await isUrlSafe('http://127.0.0.1');
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/private/i);
  });

  test('blocks http://10.0.0.1', async () => {
    const result = await isUrlSafe('http://10.0.0.1/admin');
    expect(result.safe).toBe(false);
  });

  test('blocks http://192.168.1.1', async () => {
    const result = await isUrlSafe('http://192.168.1.1/router');
    expect(result.safe).toBe(false);
  });

  test('blocks http://172.16.0.1', async () => {
    const result = await isUrlSafe('http://172.16.0.1');
    expect(result.safe).toBe(false);
  });

  test('blocks http://0.0.0.0', async () => {
    const result = await isUrlSafe('http://0.0.0.0');
    expect(result.safe).toBe(false);
  });

  // --- Cloud metadata endpoints ---

  test('blocks AWS metadata IP', async () => {
    const result = await isUrlSafe('http://169.254.169.254/latest/meta-data/');
    expect(result.safe).toBe(false);
  });

  test('blocks Alibaba Cloud metadata IP', async () => {
    const result = await isUrlSafe('http://100.100.100.200/latest/meta-data/');
    expect(result.safe).toBe(false);
  });

  test('blocks GCP metadata hostname', async () => {
    const result = await isUrlSafe('http://metadata.google.internal/computeMetadata/v1/');
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/hostname/i);
  });

  // --- Blocked hostnames ---

  test('blocks localhost', async () => {
    const result = await isUrlSafe('http://localhost:3000/api/admin');
    expect(result.safe).toBe(false);
  });

  test('blocks .local domains', async () => {
    const result = await isUrlSafe('http://internal-app.local/api');
    expect(result.safe).toBe(false);
  });

  test('blocks kubernetes.default.svc', async () => {
    const result = await isUrlSafe('http://kubernetes.default.svc/api/v1/secrets');
    expect(result.safe).toBe(false);
  });

  // --- IPv6 ---

  test('blocks IPv6 loopback [::1]', async () => {
    const result = await isUrlSafe('http://[::1]:8080/admin');
    expect(result.safe).toBe(false);
  });

  test('blocks IPv6 link-local', async () => {
    const result = await isUrlSafe('http://[fe80::1]/admin');
    expect(result.safe).toBe(false);
  });

  // --- Valid public URLs ---

  test('allows https://example.com', async () => {
    const result = await isUrlSafe('https://example.com');
    expect(result.safe).toBe(true);
  });

  test('allows https://google.com', async () => {
    const result = await isUrlSafe('https://google.com');
    expect(result.safe).toBe(true);
  });

  test('allows http://example.com with path', async () => {
    const result = await isUrlSafe('http://example.com/path/to/page');
    expect(result.safe).toBe(true);
  });

  test('allows URL with port on public domain', async () => {
    const result = await isUrlSafe('https://example.com:8443/api');
    expect(result.safe).toBe(true);
  });

  // --- Invalid URL format ---

  test('rejects invalid URL format', async () => {
    const result = await isUrlSafe('not-a-url');
    expect(result.safe).toBe(false);
  });

  // --- DNS rebinding: hostname resolves to private IP ---
  // We cannot easily test real DNS rebinding in unit tests, but we can
  // verify that the function resolves DNS and checks the resulting IP.
  // The DNS lookup for public domains (example.com) should succeed and be allowed.

  test('allows domains that resolve to public IPs', async () => {
    // example.com resolves to 93.184.216.34 (public)
    const result = await isUrlSafe('https://example.com');
    expect(result.safe).toBe(true);
    // resolvedIP should be populated
    expect(result.resolvedIP).toBeTruthy();
  });

  test('handles DNS resolution failure gracefully', async () => {
    // A domain that is very unlikely to resolve
    const result = await isUrlSafe('https://this-domain-does-not-exist-ssrf-test-xyzzy.invalid');
    // DNS failure is allowed through (the downstream scanner will handle the error)
    expect(result.safe).toBe(true);
  });
});
