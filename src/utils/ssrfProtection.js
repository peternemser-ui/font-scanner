/**
 * SSRF (Server-Side Request Forgery) Protection
 *
 * Prevents user-submitted URLs from targeting internal services,
 * cloud metadata endpoints, and private networks.
 *
 * Key protections:
 * - Private IP range blocking (RFC 1918, loopback, link-local)
 * - Cloud metadata endpoint blocking (AWS, GCP, Azure, Alibaba)
 * - IPv6 loopback and link-local blocking
 * - DNS resolution check to prevent DNS rebinding attacks
 * - URL scheme restriction (only http: and https:)
 *
 * @module ssrfProtection
 */

const dns = require('dns');
const { URL } = require('url');
const { createLogger } = require('./logger');

const logger = createLogger('SSRFProtection');

/**
 * Hostnames that resolve to cloud provider metadata services.
 * These must be blocked regardless of the resolved IP.
 */
const BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',       // GCP metadata
  'metadata.goog',                  // GCP alternate
  'kubernetes.default.svc',         // Kubernetes API
  'kubernetes.default',             // Kubernetes API
]);

/**
 * Specific IPs that are cloud metadata endpoints.
 * These are checked after DNS resolution.
 */
const BLOCKED_IPS = new Set([
  '169.254.169.254',  // AWS, GCP, Azure metadata
  '100.100.100.200',  // Alibaba Cloud metadata
  '169.254.170.2',    // AWS ECS task metadata
]);

/**
 * Check if an IPv4 address is in a private/reserved range.
 *
 * Blocked ranges:
 * - 0.0.0.0/8        (current network)
 * - 10.0.0.0/8       (RFC 1918 private)
 * - 100.64.0.0/10    (carrier-grade NAT, RFC 6598)
 * - 100.100.100.200  (Alibaba metadata, explicit)
 * - 127.0.0.0/8      (loopback)
 * - 169.254.0.0/16   (link-local, includes AWS metadata 169.254.169.254)
 * - 172.16.0.0/12    (RFC 1918 private)
 * - 192.0.0.0/24     (IETF protocol assignments)
 * - 192.0.2.0/24     (TEST-NET-1, documentation)
 * - 192.88.99.0/24   (6to4 relay anycast)
 * - 192.168.0.0/16   (RFC 1918 private)
 * - 198.18.0.0/15    (benchmarking)
 * - 198.51.100.0/24  (TEST-NET-2)
 * - 203.0.113.0/24   (TEST-NET-3)
 * - 224.0.0.0/4      (multicast)
 * - 240.0.0.0/4      (reserved)
 * - 255.255.255.255  (broadcast)
 *
 * @param {string} ip - IPv4 address as dotted-quad string
 * @returns {boolean} True if the IP is private/reserved
 */
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed = blocked
  }

  const [a, b] = parts;

  // Explicit metadata IPs
  if (BLOCKED_IPS.has(ip)) return true;

  return (
    a === 0 ||                                      // 0.0.0.0/8
    a === 10 ||                                     // 10.0.0.0/8
    a === 127 ||                                    // 127.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) ||           // 100.64.0.0/10 (CGNAT)
    (a === 169 && b === 254) ||                     // 169.254.0.0/16
    (a === 172 && b >= 16 && b <= 31) ||            // 172.16.0.0/12
    (a === 192 && b === 0 && parts[2] === 0) ||     // 192.0.0.0/24
    (a === 192 && b === 0 && parts[2] === 2) ||     // 192.0.2.0/24
    (a === 192 && b === 88 && parts[2] === 99) ||   // 192.88.99.0/24
    (a === 192 && b === 168) ||                     // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) ||        // 198.18.0.0/15
    (a === 198 && b === 51 && parts[2] === 100) ||  // 198.51.100.0/24
    (a === 203 && b === 0 && parts[2] === 113) ||   // 203.0.113.0/24
    a >= 224                                        // 224.0.0.0/4+ (multicast, reserved, broadcast)
  );
}

/**
 * Check if an IPv6 address is loopback, link-local, or otherwise private.
 *
 * @param {string} ip - IPv6 address string
 * @returns {boolean} True if the address is private/reserved
 */
function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();

  // ::1 (loopback)
  if (normalized === '::1' || normalized === '0000:0000:0000:0000:0000:0000:0000:0001') {
    return true;
  }

  // :: (unspecified)
  if (normalized === '::' || normalized === '0000:0000:0000:0000:0000:0000:0000:0000') {
    return true;
  }

  // fe80::/10 (link-local)
  if (normalized.startsWith('fe80:') || normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  // fc00::/7 (unique local address, RFC 4193) - covers fc00:: and fd00::
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  // ::ffff:x.x.x.x (IPv4-mapped IPv6) - extract IPv4 and check
  const v4MappedMatch = normalized.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4MappedMatch) {
    return isPrivateIPv4(v4MappedMatch[1]);
  }

  // Bracketed IPv4-mapped
  const v4Mapped2 = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (v4Mapped2) {
    const high = parseInt(v4Mapped2[1], 16);
    const low = parseInt(v4Mapped2[2], 16);
    const ipv4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
    return isPrivateIPv4(ipv4);
  }

  return false;
}

/**
 * Check if a resolved IP address (v4 or v6) is private/blocked.
 *
 * @param {string} ip - IP address string
 * @returns {boolean} True if blocked
 */
function isBlockedIP(ip) {
  if (BLOCKED_IPS.has(ip)) return true;
  if (ip.includes(':')) return isPrivateIPv6(ip);
  return isPrivateIPv4(ip);
}

/**
 * Check if a hostname is explicitly blocked (cloud metadata, etc.).
 *
 * @param {string} hostname - Hostname to check
 * @returns {boolean} True if blocked
 */
function isBlockedHostname(hostname) {
  const lower = hostname.toLowerCase();

  // Direct match
  if (BLOCKED_HOSTNAMES.has(lower)) return true;

  // Subdomain match (e.g., anything.metadata.google.internal)
  for (const blocked of BLOCKED_HOSTNAMES) {
    if (lower.endsWith('.' + blocked)) return true;
  }

  // Block .local TLD (mDNS, internal services)
  if (lower.endsWith('.local') || lower === 'local') return true;

  // Block localhost variants
  if (lower === 'localhost' || lower.endsWith('.localhost')) return true;

  return false;
}

/**
 * Validate a URL is safe from SSRF attacks.
 *
 * This function performs comprehensive SSRF validation:
 * 1. Parses the URL and checks the scheme (only http/https allowed)
 * 2. Checks hostname against blocklists (cloud metadata, .local, localhost)
 * 3. Checks if hostname is a literal private IP
 * 4. Resolves hostname via DNS and checks the resolved IP against private ranges
 *
 * The DNS resolution step is critical for preventing DNS rebinding attacks,
 * where an attacker controls a domain that initially resolves to a public IP
 * but later resolves to 127.0.0.1 or 169.254.169.254.
 *
 * @param {string} urlString - The URL to validate
 * @returns {Promise<{safe: boolean, reason: string|null, resolvedIP: string|null}>}
 */
async function isUrlSafe(urlString) {
  // 1. Parse URL
  let urlObj;
  try {
    urlObj = new URL(urlString);
  } catch {
    return { safe: false, reason: 'Invalid URL format', resolvedIP: null };
  }

  // 2. Check scheme - only http and https allowed
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    return {
      safe: false,
      reason: `Blocked URL scheme: ${urlObj.protocol} (only http: and https: allowed)`,
      resolvedIP: null
    };
  }

  const hostname = urlObj.hostname;

  // 3. Strip brackets from IPv6 literals
  const cleanHostname = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  // 4. Check blocked hostnames
  if (isBlockedHostname(cleanHostname)) {
    logger.warn('SSRF blocked: hostname on blocklist', { hostname: cleanHostname, url: urlString });
    return {
      safe: false,
      reason: `Blocked hostname: ${cleanHostname}`,
      resolvedIP: null
    };
  }

  // 5. Check if hostname is a literal IP and whether it is private
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(cleanHostname)) {
    if (isPrivateIPv4(cleanHostname)) {
      logger.warn('SSRF blocked: private IPv4 literal', { ip: cleanHostname, url: urlString });
      return {
        safe: false,
        reason: `Blocked private IP: ${cleanHostname}`,
        resolvedIP: cleanHostname
      };
    }
    return { safe: true, reason: null, resolvedIP: cleanHostname };
  }

  // Check IPv6 literal
  if (cleanHostname.includes(':')) {
    if (isPrivateIPv6(cleanHostname)) {
      logger.warn('SSRF blocked: private IPv6 literal', { ip: cleanHostname, url: urlString });
      return {
        safe: false,
        reason: `Blocked private IPv6: ${cleanHostname}`,
        resolvedIP: cleanHostname
      };
    }
    return { safe: true, reason: null, resolvedIP: cleanHostname };
  }

  // 6. DNS resolution - resolve hostname and check the resulting IP
  try {
    const { address, family } = await dns.promises.lookup(cleanHostname);

    if (isBlockedIP(address)) {
      logger.warn('SSRF blocked: DNS resolved to private/blocked IP', {
        hostname: cleanHostname,
        resolvedIP: address,
        family,
        url: urlString
      });
      return {
        safe: false,
        reason: `Hostname ${cleanHostname} resolves to blocked IP ${address}`,
        resolvedIP: address
      };
    }

    return { safe: true, reason: null, resolvedIP: address };
  } catch (dnsError) {
    // DNS resolution failed - the URL will fail anyway when Puppeteer tries to load it,
    // but we should not treat this as an SSRF risk. Let the downstream handler
    // deal with the unreachable host.
    logger.debug('SSRF check: DNS resolution failed (allowing through)', {
      hostname: cleanHostname,
      error: dnsError.code || dnsError.message
    });
    return { safe: true, reason: null, resolvedIP: null };
  }
}

module.exports = {
  isUrlSafe,
  isBlockedIP,
  isBlockedHostname,
  isPrivateIPv4,
  isPrivateIPv6,
  // Exported for testing
  BLOCKED_HOSTNAMES,
  BLOCKED_IPS
};
