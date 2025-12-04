const dns = require('dns').promises;
const { createLogger } = require('../utils/logger');

const logger = createLogger('IPReputationService');

/**
 * IP/Domain Reputation Service
 * Comprehensive reputation analysis including blacklist checking,
 * email deliverability, hosting reputation, and threat intelligence
 */
class IPReputationService {
  constructor() {
    // Major DNS Blacklists (DNSBLs)
    this.blacklists = [
      { name: 'Spamhaus ZEN', zone: 'zen.spamhaus.org', description: 'Combined Spamhaus blocklist' },
      { name: 'Spamhaus SBL', zone: 'sbl.spamhaus.org', description: 'Spam blocklist' },
      { name: 'Spamhaus XBL', zone: 'xbl.spamhaus.org', description: 'Exploits blocklist' },
      { name: 'Spamhaus PBL', zone: 'pbl.spamhaus.org', description: 'Policy blocklist' },
      { name: 'SpamCop', zone: 'bl.spamcop.net', description: 'Spam reporting service' },
      { name: 'Barracuda', zone: 'b.barracudacentral.org', description: 'Barracuda reputation' },
      { name: 'Sorbs', zone: 'dnsbl.sorbs.net', description: 'Spam and open relay blocklist' },
      { name: 'UCEPROTECT Level 1', zone: 'dnsbl-1.uceprotect.net', description: 'Spam blocklist' },
      { name: 'SURBL', zone: 'multi.surbl.org', description: 'URI blocklist' },
      { name: 'Invaluement', zone: 'ivmuri.invaluement.com', description: 'Reputation list' },
    ];
  }

  /**
   * Main analysis function
   */
  async analyzeReputation(input) {
    logger.info('Starting reputation analysis', { input });
    const startTime = Date.now();

    try {
      // Determine if input is IP or domain
      const isIP = this.isValidIP(input);
      let ipAddress = input;
      let hostname = null;

      // Resolve domain to IP if needed
      if (!isIP) {
        try {
          const addresses = await dns.resolve4(input);
          ipAddress = addresses[0];
          hostname = input;
          logger.info('Resolved domain to IP', { domain: input, ip: ipAddress });
        } catch (error) {
          logger.warn('Failed to resolve domain', { domain: input, error: error.message });
          // Continue with domain as-is
          hostname = input;
        }
      } else {
        // Reverse lookup for IP
        try {
          const hostnames = await dns.reverse(ipAddress);
          hostname = hostnames[0] || null;
          logger.info('Reverse lookup successful', { ip: ipAddress, hostname });
        } catch (error) {
          logger.info('Reverse lookup failed (not necessarily an issue)', { ip: ipAddress });
        }
      }

      // Perform parallel checks using Promise.allSettled for resilience
      const [
        blacklistResults,
        emailConfigResults,
        hostingInfoResults,
      ] = await Promise.allSettled([
        this.checkBlacklists(ipAddress),
        this.checkEmailConfiguration(hostname || input),
        this.getHostingInformation(ipAddress, hostname),
      ]);

      const blacklists = blacklistResults.status === 'fulfilled' ? blacklistResults.value : [];
      const emailConfig = emailConfigResults.status === 'fulfilled' ? emailConfigResults.value : null;
      const hostingInfo = hostingInfoResults.status === 'fulfilled' ? hostingInfoResults.value : null;

      // Calculate scores
      const blacklistScore = this.calculateBlacklistScore(blacklists);
      const emailScore = this.calculateEmailScore(emailConfig);
      const overallScore = this.calculateOverallScore(blacklistScore, emailScore, hostingInfo);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        blacklists,
        emailConfig,
        hostingInfo,
        blacklistScore,
        emailScore
      );

      // Determine threat intelligence based on blacklists
      const threatIntel = this.analyzeThreatIntelligence(blacklists, hostingInfo);

      const results = {
        input,
        ipAddress,
        hostname,
        timestamp: new Date().toISOString(),
        overallScore,
        blacklistScore,
        blacklistStatus: this.getBlacklistStatus(blacklistScore),
        emailScore,
        emailStatus: this.getEmailStatus(emailScore),
        blacklists,
        emailConfig,
        hostingInfo,
        threatIntel,
        recommendations,
        analysisTime: Date.now() - startTime,
      };

      logger.info('Reputation analysis completed', {
        input,
        overallScore,
        blacklistScore,
        emailScore,
        duration: results.analysisTime,
      });

      return results;
    } catch (error) {
      logger.error('Reputation analysis failed', { input, error: error.message });
      throw error;
    }
  }

  /**
   * Check IP against multiple DNS blacklists
   */
  async checkBlacklists(ip) {
    if (!this.isValidIP(ip)) {
      logger.warn('Invalid IP for blacklist check', { ip });
      return [];
    }

    logger.info('Checking blacklists', { ip, count: this.blacklists.length });

    // Reverse IP for DNSBL lookup (e.g., 8.8.8.8 becomes 8.8.8.8 in reverse)
    const reversedIP = this.reverseIP(ip);

    const checks = this.blacklists.map(async (blacklist) => {
      try {
        const query = `${reversedIP}.${blacklist.zone}`;
        const addresses = await dns.resolve4(query);

        // If resolution succeeds, IP is listed
        if (addresses && addresses.length > 0) {
          logger.warn('IP listed on blacklist', { ip, blacklist: blacklist.name });
          return {
            ...blacklist,
            listed: true,
            details: `IP is listed on ${blacklist.name} (${addresses[0]})`,
          };
        }
      } catch (error) {
        // NXDOMAIN means not listed (good)
        if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
          return {
            ...blacklist,
            listed: false,
          };
        }
        // Other errors (timeout, etc.) - mark as unknown
        logger.debug('Blacklist check error', { blacklist: blacklist.name, error: error.message });
        return {
          ...blacklist,
          listed: false,
          error: true,
        };
      }
    });

    const results = await Promise.allSettled(checks);
    return results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
  }

  /**
   * Check email configuration (SPF, DKIM, DMARC)
   */
  async checkEmailConfiguration(domain) {
    if (!domain) {
      return null;
    }

    logger.info('Checking email configuration', { domain });

    const config = {
      spf: await this.checkSPF(domain),
      dkim: await this.checkDKIM(domain),
      dmarc: await this.checkDMARC(domain),
    };

    return config;
  }

  /**
   * Check SPF record
   */
  async checkSPF(domain) {
    try {
      const records = await dns.resolveTxt(domain);
      const spfRecord = records.find(record =>
        record.some(part => part.startsWith('v=spf1'))
      );

      if (spfRecord) {
        const spfText = spfRecord.join('');
        logger.info('SPF record found', { domain, spf: spfText });
        return {
          valid: true,
          record: spfText,
        };
      } else {
        logger.warn('No SPF record found', { domain });
        return {
          valid: false,
          record: null,
          issues: 'No SPF record found - email deliverability may be impacted',
        };
      }
    } catch (error) {
      logger.warn('SPF check failed', { domain, error: error.message });
      return {
        valid: false,
        record: null,
        issues: 'Unable to retrieve SPF record',
      };
    }
  }

  /**
   * Check DKIM (requires selector, so we provide general guidance)
   */
  async checkDKIM(domain) {
    // DKIM requires knowing the selector (e.g., selector._domainkey.domain.com)
    // We can't check all possible selectors, so we provide general info
    return {
      valid: null,
      status: 'DKIM requires selector-specific lookup. Check your email provider documentation for your DKIM selector.',
    };
  }

  /**
   * Check DMARC record
   */
  async checkDMARC(domain) {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const records = await dns.resolveTxt(dmarcDomain);
      const dmarcRecord = records.find(record =>
        record.some(part => part.startsWith('v=DMARC1'))
      );

      if (dmarcRecord) {
        const dmarcText = dmarcRecord.join('');
        logger.info('DMARC record found', { domain, dmarc: dmarcText });

        // Extract policy
        const policyMatch = dmarcText.match(/p=(\w+)/);
        const policy = policyMatch ? policyMatch[1] : 'unknown';

        return {
          valid: true,
          record: dmarcText,
          policy,
        };
      } else {
        logger.warn('No DMARC record found', { domain });
        return {
          valid: false,
          record: null,
        };
      }
    } catch (error) {
      logger.warn('DMARC check failed', { domain, error: error.message });
      return {
        valid: false,
        record: null,
      };
    }
  }

  /**
   * Get hosting and network information
   */
  async getHostingInformation(ip, hostname) {
    // Basic implementation - can be extended with GeoIP services
    const info = {
      ipAddress: ip,
      hostname: hostname || 'Unknown',
    };

    // Check if it's a known cloud provider
    if (hostname) {
      info.cloudProvider = this.detectCloudProvider(hostname);
    }

    // Note: For production, integrate with IP geolocation APIs like:
    // - ipapi.co
    // - ip-api.com
    // - MaxMind GeoIP
    // These would provide country, city, ISP, ASN, etc.

    info.note = 'Extended hosting information requires external API integration';

    return info;
  }

  /**
   * Detect cloud provider from hostname
   */
  detectCloudProvider(hostname) {
    const providers = {
      'amazonaws.com': 'Amazon Web Services (AWS)',
      'googleusercontent.com': 'Google Cloud Platform',
      'azure.com': 'Microsoft Azure',
      'azurewebsites.net': 'Microsoft Azure',
      'cloudflare.com': 'Cloudflare',
      'digitalocean.com': 'DigitalOcean',
      'vultr.com': 'Vultr',
      'linode.com': 'Linode',
      'ovh.net': 'OVH',
    };

    for (const [domain, provider] of Object.entries(providers)) {
      if (hostname.includes(domain)) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Analyze threat intelligence based on reputation data
   */
  analyzeThreatIntelligence(blacklists, hostingInfo) {
    const listedBlacklists = blacklists.filter(bl => bl.listed);
    const hasThreats = listedBlacklists.length > 0;

    const threats = listedBlacklists.map(bl => ({
      type: 'Blacklist Listing',
      severity: this.getBlacklistSeverity(bl),
      description: `Listed on ${bl.name}: ${bl.description}`,
      source: bl.name,
    }));

    let riskLevel = 'low';
    if (listedBlacklists.length >= 5) {
      riskLevel = 'high';
    } else if (listedBlacklists.length >= 2) {
      riskLevel = 'medium';
    } else if (listedBlacklists.length === 1) {
      riskLevel = 'low';
    } else {
      riskLevel = 'minimal';
    }

    return {
      hasThreats,
      threats,
      riskLevel,
    };
  }

  /**
   * Get blacklist severity
   */
  getBlacklistSeverity(blacklist) {
    // Spamhaus listings are generally more serious
    if (blacklist.name.includes('Spamhaus')) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Calculate blacklist score (0-100, higher is better)
   */
  calculateBlacklistScore(blacklists) {
    const totalChecks = blacklists.length;
    const listedCount = blacklists.filter(bl => bl.listed).length;

    if (totalChecks === 0) return 50; // Unknown

    // Perfect score if not listed anywhere
    if (listedCount === 0) return 100;

    // Score decreases with more listings
    const cleanPercentage = ((totalChecks - listedCount) / totalChecks) * 100;

    // Apply penalty for any listings
    let score = cleanPercentage;
    if (listedCount === 1) score -= 20;
    else if (listedCount >= 2 && listedCount <= 3) score -= 40;
    else if (listedCount >= 4) score -= 60;

    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate email score (0-100, higher is better)
   */
  calculateEmailScore(emailConfig) {
    if (!emailConfig) return 50; // Unknown

    let score = 0;

    // SPF: 40 points
    if (emailConfig.spf && emailConfig.spf.valid) {
      score += 40;
    }

    // DMARC: 40 points
    if (emailConfig.dmarc && emailConfig.dmarc.valid) {
      score += 40;
      // Bonus for stricter policies
      if (emailConfig.dmarc.policy === 'reject') {
        score += 10;
      } else if (emailConfig.dmarc.policy === 'quarantine') {
        score += 5;
      }
    }

    // DKIM: We can't check without selector, so give partial credit
    score += 10;

    return Math.min(100, score);
  }

  /**
   * Calculate overall reputation score
   */
  calculateOverallScore(blacklistScore, emailScore, hostingInfo) {
    // Weighted average
    // Blacklist: 60% (most critical for reputation)
    // Email: 30%
    // Hosting: 10% (basic check for now)

    const hostingScore = hostingInfo && hostingInfo.cloudProvider ? 70 : 60;

    const overallScore =
      blacklistScore * 0.6 +
      emailScore * 0.3 +
      hostingScore * 0.1;

    return Math.round(overallScore);
  }

  /**
   * Get blacklist status text
   */
  getBlacklistStatus(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    if (score >= 30) return 'Poor';
    return 'Critical';
  }

  /**
   * Get email status text
   */
  getEmailStatus(score) {
    if (score >= 80) return 'Optimal';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Improvement';
    return 'Poor Configuration';
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(blacklists, emailConfig, hostingInfo, blacklistScore, emailScore) {
    const recommendations = [];

    // Blacklist recommendations
    const listedBlacklists = blacklists.filter(bl => bl.listed);
    if (listedBlacklists.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Remove from DNS Blacklists',
        description: `Your IP/domain is listed on ${listedBlacklists.length} blacklist(s). This severely impacts email deliverability and reputation.`,
        action: `Visit each blacklist's removal page and follow their delisting process. Common steps: identify and fix the spam source, wait for automatic expiration, or request manual removal.`,
        impact: 'Critical - Affects email delivery, website reputation, and user trust',
      });
    }

    // SPF recommendations
    if (emailConfig && !emailConfig.spf.valid) {
      recommendations.push({
        priority: 'high',
        title: 'Configure SPF Record',
        description: 'No valid SPF record found. SPF helps prevent email spoofing and improves deliverability.',
        action: 'Add an SPF TXT record to your DNS. Example: "v=spf1 include:_spf.youremailprovider.com ~all"',
        impact: 'High - Improves email deliverability and security',
      });
    }

    // DMARC recommendations
    if (emailConfig && !emailConfig.dmarc.valid) {
      recommendations.push({
        priority: 'medium',
        title: 'Implement DMARC Policy',
        description: 'No DMARC record found. DMARC provides reporting and policy enforcement for email authentication.',
        action: 'Add a DMARC TXT record at _dmarc.yourdomain.com. Start with "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com" for monitoring.',
        impact: 'Medium - Enhances email security and provides visibility into email authentication',
      });
    } else if (emailConfig && emailConfig.dmarc.valid && emailConfig.dmarc.policy === 'none') {
      recommendations.push({
        priority: 'low',
        title: 'Strengthen DMARC Policy',
        description: 'Your DMARC policy is set to "none" (monitoring only).',
        action: 'After monitoring for issues, upgrade to "quarantine" and eventually "reject" for maximum protection.',
        impact: 'Low - Provides stronger email authentication enforcement',
      });
    }

    // General recommendations
    if (blacklistScore < 70 || emailScore < 60) {
      recommendations.push({
        priority: 'medium',
        title: 'Monitor Reputation Regularly',
        description: 'Regular monitoring helps catch reputation issues early.',
        action: 'Set up automated reputation monitoring and alerts. Check blacklists weekly and review email authentication regularly.',
        impact: 'Medium - Prevents reputation degradation',
      });
    }

    // If everything looks good
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        title: 'Maintain Current Standards',
        description: 'Your IP/domain reputation is in good standing.',
        action: 'Continue monitoring regularly and maintain email authentication best practices.',
        impact: 'Low - Preventive maintenance',
      });
    }

    return recommendations;
  }

  /**
   * Utility: Check if string is valid IPv4
   */
  isValidIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
  }

  /**
   * Utility: Reverse IP for DNSBL lookup
   */
  reverseIP(ip) {
    return ip.split('.').reverse().join('.');
  }
}

module.exports = new IPReputationService();
