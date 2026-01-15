const dns = require('dns').promises;
const https = require('https');
const http = require('http');
const tls = require('tls');
const net = require('net');
const { createLogger } = require('../utils/logger');
const { roundTo } = require('../utils/formatHelpers');

const logger = createLogger('IPReputationService');

/**
 * IP/Domain Reputation Service
 * Comprehensive reputation analysis including blacklist checking,
 * email deliverability, hosting reputation, and threat intelligence
 */
class IPReputationService {
  constructor() {
    // Expanded DNS Blacklists (25+ DNSBLs for comprehensive coverage)
    this.blacklists = [
      // Spamhaus (most authoritative)
      { name: 'Spamhaus ZEN', zone: 'zen.spamhaus.org', description: 'Combined Spamhaus blocklist', tier: 'primary' },
      { name: 'Spamhaus SBL', zone: 'sbl.spamhaus.org', description: 'Spam blocklist', tier: 'primary' },
      { name: 'Spamhaus XBL', zone: 'xbl.spamhaus.org', description: 'Exploits blocklist', tier: 'primary' },
      { name: 'Spamhaus PBL', zone: 'pbl.spamhaus.org', description: 'Policy blocklist', tier: 'primary' },
      { name: 'Spamhaus CSS', zone: 'css.spamhaus.org', description: 'Spambot & hijacked hosts', tier: 'primary' },
      // SpamCop
      { name: 'SpamCop', zone: 'bl.spamcop.net', description: 'Spam reporting service', tier: 'primary' },
      // Barracuda
      { name: 'Barracuda', zone: 'b.barracudacentral.org', description: 'Barracuda reputation', tier: 'primary' },
      // SORBS
      { name: 'SORBS Combined', zone: 'dnsbl.sorbs.net', description: 'Spam and open relay blocklist', tier: 'secondary' },
      { name: 'SORBS HTTP', zone: 'http.dnsbl.sorbs.net', description: 'Open HTTP proxy servers', tier: 'secondary' },
      { name: 'SORBS SMTP', zone: 'smtp.dnsbl.sorbs.net', description: 'Open SMTP relay servers', tier: 'secondary' },
      { name: 'SORBS Zombie', zone: 'zombie.dnsbl.sorbs.net', description: 'Hijacked/zombie hosts', tier: 'secondary' },
      // UCEProtect
      { name: 'UCEPROTECT L1', zone: 'dnsbl-1.uceprotect.net', description: 'IP-based blocklist', tier: 'secondary' },
      { name: 'UCEPROTECT L2', zone: 'dnsbl-2.uceprotect.net', description: 'Network-based blocklist', tier: 'secondary' },
      { name: 'UCEPROTECT L3', zone: 'dnsbl-3.uceprotect.net', description: 'ASN-based blocklist', tier: 'secondary' },
      // SURBL (URI-based)
      { name: 'SURBL Multi', zone: 'multi.surbl.org', description: 'URI blocklist', tier: 'secondary' },
      // Invaluement
      { name: 'Invaluement', zone: 'ivmuri.invaluement.com', description: 'Reputation list', tier: 'secondary' },
      // Additional lists
      { name: 'Spamrats DYNA', zone: 'dyna.spamrats.com', description: 'Dynamic IP addresses', tier: 'secondary' },
      { name: 'Spamrats NOPTR', zone: 'noptr.spamrats.com', description: 'No reverse DNS', tier: 'secondary' },
      { name: 'Spamrats SPAM', zone: 'spam.spamrats.com', description: 'Known spam sources', tier: 'secondary' },
      { name: 'JustSpam', zone: 'dnsbl.justspam.org', description: 'Spam blocklist', tier: 'tertiary' },
      { name: 'NiX Spam', zone: 'ix.dnsbl.manitu.net', description: 'German anti-spam list', tier: 'tertiary' },
      { name: 'Mailspike Z', zone: 'z.mailspike.net', description: 'Mailspike blocklist', tier: 'tertiary' },
      { name: 'PSBL', zone: 'psbl.surriel.com', description: 'Passive spam blocklist', tier: 'tertiary' },
      { name: 'Truncate', zone: 'truncate.gbudb.net', description: 'Truncate blocklist', tier: 'tertiary' },
      { name: 'DroneBL', zone: 'dnsbl.dronebl.org', description: 'Drone/zombie blocklist', tier: 'tertiary' },
    ];
    
    // Common ports to scan for security assessment
    this.securityPorts = [
      { port: 21, name: 'FTP', risk: 'high', description: 'File Transfer Protocol - often insecure' },
      { port: 22, name: 'SSH', risk: 'info', description: 'Secure Shell - check for hardening' },
      { port: 23, name: 'Telnet', risk: 'critical', description: 'Unencrypted remote access - major risk' },
      { port: 25, name: 'SMTP', risk: 'medium', description: 'Email server - verify authentication' },
      { port: 80, name: 'HTTP', risk: 'info', description: 'Web server - check for HTTPS redirect' },
      { port: 443, name: 'HTTPS', risk: 'info', description: 'Secure web server' },
      { port: 445, name: 'SMB', risk: 'critical', description: 'Windows file sharing - high risk if exposed' },
      { port: 3306, name: 'MySQL', risk: 'high', description: 'Database server - should not be public' },
      { port: 3389, name: 'RDP', risk: 'high', description: 'Remote Desktop - major attack vector' },
      { port: 5432, name: 'PostgreSQL', risk: 'high', description: 'Database server - should not be public' },
      { port: 6379, name: 'Redis', risk: 'critical', description: 'Cache server - often misconfigured' },
      { port: 27017, name: 'MongoDB', risk: 'critical', description: 'Database - frequently exposed' },
    ];

    // CMS Detection Signatures
    this.cmsSignatures = {
      wordpress: {
        name: 'WordPress',
        icon: '📝',
        patterns: ['wp-content', 'wp-includes', 'wp-json', '/xmlrpc.php', 'wordpress'],
        headers: ['x-powered-by: php', 'link: <.*wp-json'],
        marketShare: '43%',
        category: 'CMS'
      },
      shopify: {
        name: 'Shopify',
        icon: '🛒',
        patterns: ['cdn.shopify.com', 'myshopify.com', 'Shopify.theme', 'shopify-section'],
        headers: ['x-shopify-stage', 'x-sorting-hat-shopid'],
        marketShare: '4.4%',
        category: 'E-commerce'
      },
      wix: {
        name: 'Wix',
        icon: '🎨',
        patterns: ['wix.com', 'wixsite.com', 'static.wixstatic.com', '_wix_browser_sess'],
        headers: ['x-wix-request-id'],
        marketShare: '3.4%',
        category: 'Website Builder'
      },
      squarespace: {
        name: 'Squarespace',
        icon: '⬛',
        patterns: ['squarespace.com', 'sqsp.net', 'static1.squarespace.com', 'squarespace-cdn'],
        headers: ['x-served-by: squarespace'],
        marketShare: '2.1%',
        category: 'Website Builder'
      },
      webflow: {
        name: 'Webflow',
        icon: '🌊',
        patterns: ['webflow.io', 'assets.website-files.com', 'webflow.com', 'w-nav'],
        headers: ['x-webflow'],
        marketShare: '1.0%',
        category: 'Website Builder'
      },
      drupal: {
        name: 'Drupal',
        icon: '💧',
        patterns: ['sites/default/files', '/core/misc/drupal.js', 'drupal.org', 'drupal-settings-json'],
        headers: ['x-drupal-cache', 'x-generator: drupal'],
        marketShare: '1.6%',
        category: 'CMS'
      },
      joomla: {
        name: 'Joomla',
        icon: '🔧',
        patterns: ['/components/', '/media/jui/', 'joomla.org', '/administrator/'],
        headers: ['x-content-powered-by: joomla'],
        marketShare: '1.7%',
        category: 'CMS'
      },
      magento: {
        name: 'Magento/Adobe Commerce',
        icon: '🏪',
        patterns: ['/static/frontend/', '/pub/media/', 'mage/cookies', 'Magento_'],
        headers: ['x-magento-cache-control'],
        marketShare: '0.8%',
        category: 'E-commerce'
      },
      ghost: {
        name: 'Ghost',
        icon: '👻',
        patterns: ['ghost.io', 'ghost.org', 'ghost-api', '/ghost/api/'],
        headers: ['x-ghost-cache-status'],
        marketShare: '0.1%',
        category: 'CMS'
      },
      hubspot: {
        name: 'HubSpot CMS',
        icon: '🧡',
        patterns: ['hs-scripts.com', 'hubspot.com', 'hscta', 'hs-analytics'],
        headers: ['x-hubspot-correlation-id'],
        marketShare: '0.6%',
        category: 'Marketing CMS'
      },
      contentful: {
        name: 'Contentful',
        icon: '📦',
        patterns: ['contentful.com', 'ctfassets.net', 'images.ctfassets.net'],
        headers: [],
        marketShare: '0.3%',
        category: 'Headless CMS'
      },
      strapi: {
        name: 'Strapi',
        icon: '🚀',
        patterns: ['/api/', 'strapi.io', '/uploads/'],
        headers: ['x-powered-by: strapi'],
        marketShare: '0.1%',
        category: 'Headless CMS'
      },
      nextjs: {
        name: 'Next.js',
        icon: '▲',
        patterns: ['_next/static', '__NEXT_DATA__', 'next/dist'],
        headers: ['x-powered-by: next.js'],
        marketShare: '1.2%',
        category: 'Framework'
      },
      gatsby: {
        name: 'Gatsby',
        icon: '💜',
        patterns: ['gatsby-', '/page-data/', 'gatsby.js'],
        headers: [],
        marketShare: '0.3%',
        category: 'Framework'
      },
      bigcommerce: {
        name: 'BigCommerce',
        icon: '🛍️',
        patterns: ['bigcommerce.com', '/stencil/', 'bc-sf-filter'],
        headers: ['x-bc-corr-id'],
        marketShare: '0.5%',
        category: 'E-commerce'
      }
    };

    // Enterprise/High-Traffic Brand Keywords (indicates major companies)
    this.enterpriseIndicators = {
      // Brand type suffixes
      brandSuffixes: ['resort', 'resorts', 'hotel', 'hotels', 'airlines', 'airline', 'bank', 'insurance', 
                      'motors', 'auto', 'automotive', 'pharma', 'health', 'medical', 'hospital',
                      'university', 'college', 'edu', 'gov', 'government', 'financial', 'capital',
                      'global', 'international', 'worldwide', 'inc', 'corp', 'corporation', 'group',
                      'holdings', 'enterprises', 'solutions', 'technologies', 'media', 'entertainment',
                      'sports', 'casino', 'gaming', 'travel', 'tours', 'cruises', 'properties'],
      // Major brand names (partial matches)
      knownBrands: ['vail', 'marriott', 'hilton', 'hyatt', 'disney', 'united', 'delta', 'american',
                    'southwest', 'jetblue', 'nike', 'adidas', 'coca-cola', 'pepsi', 'ford', 'toyota',
                    'honda', 'bmw', 'mercedes', 'apple', 'microsoft', 'google', 'amazon', 'meta',
                    'netflix', 'spotify', 'uber', 'lyft', 'airbnb', 'expedia', 'booking', 'kayak',
                    'target', 'walmart', 'costco', 'bestbuy', 'homedepot', 'lowes', 'macys',
                    'nordstrom', 'sephora', 'ulta', 'whole-foods', 'starbucks', 'mcdonalds',
                    'chipotle', 'dominos', 'pizzahut', 'wendys', 'chilis', 'applebees',
                    'comcast', 'verizon', 'att', 'sprint', 'tmobile', 'chase', 'wellsfargo',
                    'bankofamerica', 'citi', 'capitalone', 'amex', 'discover', 'paypal',
                    'salesforce', 'oracle', 'sap', 'ibm', 'cisco', 'intel', 'nvidia', 'amd',
                    'redbull', 'monster', 'gopro', 'fitbit', 'peloton', 'lululemon', 'patagonia',
                    'northface', 'rei', 'cabelas', 'basspro', 'dickssportinggoods', 'academy'],
      // CDN/Enterprise infrastructure indicators
      enterpriseCDNs: ['akamai', 'cloudfront', 'fastly', 'edgecast', 'limelight', 'stackpath',
                       'imperva', 'incapsula', 'sucuri', 'f5', 'citrix'],
      // Premium TLDs that suggest enterprise
      enterpriseTLDs: ['.travel', '.bank', '.insurance', '.gov', '.edu', '.museum']
    };

    // Traffic tier definitions
    this.trafficTiers = {
      enterprise: {
        name: 'Enterprise',
        icon: '🏢',
        description: 'High-traffic, mission-critical websites',
        minMonthly: 100,
        characteristics: ['Fortune 500', 'Major brands', '100K+ monthly visitors', 'E-commerce over $1M/year'],
        recommendedCategories: ['Managed WordPress', 'Managed Cloud', 'Cloud Provider', 'E-commerce Platform']
      },
      business: {
        name: 'Business',
        icon: '🏪',
        description: 'Growing businesses with moderate traffic',
        minMonthly: 20,
        characteristics: ['Regional companies', '10K-100K monthly visitors', 'E-commerce under $1M/year'],
        recommendedCategories: ['Managed WordPress', 'Managed Cloud', 'Cloud VPS']
      },
      startup: {
        name: 'Startup/Small Business',
        icon: '🚀',
        description: 'New businesses and small sites',
        minMonthly: 5,
        characteristics: ['Local businesses', '1K-10K monthly visitors', 'New websites'],
        recommendedCategories: ['Cloud VPS', 'Shared Hosting', 'JAMstack/Edge']
      },
      personal: {
        name: 'Personal/Hobby',
        icon: '👤',
        description: 'Personal projects and low-traffic sites',
        minMonthly: 0,
        characteristics: ['Blogs', 'Portfolios', 'Under 1K monthly visitors'],
        recommendedCategories: ['Shared Hosting', 'JAMstack/Edge', 'Cloud VPS']
      }
    };

    // Comprehensive Hosting Providers Database (Top 25+)
    // Each provider includes: regions, features, ecommerceSupport, migrationDifficulty
    this.hostingProviders = [
      // Premium Managed WordPress Hosts
      {
        name: 'WP Engine',
        logo: '🚀',
        category: 'Managed WordPress',
        url: 'https://wpengine.com',
        bestFor: ['wordpress', 'woocommerce'],
        regions: ['us', 'eu', 'asia', 'au'],
        features: ['ssl', 'cdn', 'backup', 'staging', 'migration', 'support247', 'uptime99'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'Startup', price: 20, period: 'month', storage: '10GB', bandwidth: '50GB', sites: 1, features: ['Free SSL', 'CDN', 'Daily backups'] },
          { name: 'Professional', price: 39, period: 'month', storage: '15GB', bandwidth: '125GB', sites: 3, features: ['Free SSL', 'CDN', 'Staging'] },
          { name: 'Growth', price: 77, period: 'month', storage: '20GB', bandwidth: '200GB', sites: 10, features: ['Free SSL', 'CDN', 'Phone support'] },
          { name: 'Scale', price: 193, period: 'month', storage: '50GB', bandwidth: '500GB', sites: 30, features: ['Enterprise features', '24/7 support'] }
        ],
        rating: 4.5,
        uptime: '99.99%',
        support: '24/7 Phone & Chat',
        highlights: ['Best WordPress performance', 'Automatic updates', 'Free migrations']
      },
      {
        name: 'Kinsta',
        logo: '⚡',
        category: 'Managed WordPress',
        url: 'https://kinsta.com',
        bestFor: ['wordpress', 'woocommerce'],
        regions: ['us', 'eu', 'asia', 'au', 'latam'],
        features: ['ssl', 'cdn', 'backup', 'staging', 'migration', 'support247', 'uptime99'],
        ecommerceSupport: 'large',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'Starter', price: 35, period: 'month', storage: '10GB', bandwidth: '25K visits', sites: 1, features: ['Free SSL', 'CDN', 'Daily backups'] },
          { name: 'Pro', price: 70, period: 'month', storage: '20GB', bandwidth: '50K visits', sites: 2, features: ['Staging', 'Free migrations'] },
          { name: 'Business 1', price: 115, period: 'month', storage: '30GB', bandwidth: '100K visits', sites: 5, features: ['Priority support'] },
          { name: 'Enterprise', price: 675, period: 'month', storage: '100GB', bandwidth: '600K visits', sites: 60, features: ['Dedicated support'] }
        ],
        rating: 4.7,
        uptime: '99.99%',
        support: '24/7 Chat',
        highlights: ['Google Cloud Platform', 'Fastest WordPress host', '35+ data centers']
      },
      {
        name: 'Flywheel',
        logo: '🎡',
        category: 'Managed WordPress',
        url: 'https://getflywheel.com',
        bestFor: ['wordpress'],
        regions: ['us', 'eu', 'asia', 'au'],
        features: ['ssl', 'cdn', 'backup', 'staging', 'migration'],
        ecommerceSupport: 'basic',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'Tiny', price: 13, period: 'month', storage: '5GB', bandwidth: '5K visits', sites: 1, features: ['Free SSL', 'Nightly backups'] },
          { name: 'Starter', price: 25, period: 'month', storage: '10GB', bandwidth: '25K visits', sites: 1, features: ['Free SSL', 'CDN'] },
          { name: 'Freelance', price: 96, period: 'month', storage: '20GB', bandwidth: '100K visits', sites: 10, features: ['Staging', 'White-label'] },
          { name: 'Agency', price: 242, period: 'month', storage: '50GB', bandwidth: '400K visits', sites: 30, features: ['Priority support', 'Client billing'] }
        ],
        rating: 4.4,
        uptime: '99.99%',
        support: '24/7 Chat',
        highlights: ['Designer-focused', 'Beautiful dashboard', 'Collaboration tools']
      },
      // Cloud/VPS Providers
      {
        name: 'DigitalOcean',
        logo: '🌊',
        category: 'Cloud VPS',
        url: 'https://www.digitalocean.com',
        bestFor: ['wordpress', 'drupal', 'joomla', 'nextjs', 'strapi', 'ghost', 'custom'],
        regions: ['us', 'eu', 'asia', 'au', 'latam', 'uk'],
        features: ['ssl', 'backup', 'staging'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'medium',
        plans: [
          { name: 'Basic', price: 4, period: 'month', storage: '10GB SSD', bandwidth: '500GB', sites: 'Unlimited', features: ['1 vCPU', '512MB RAM'] },
          { name: 'Regular', price: 6, period: 'month', storage: '25GB SSD', bandwidth: '1TB', sites: 'Unlimited', features: ['1 vCPU', '1GB RAM'] },
          { name: 'Pro', price: 12, period: 'month', storage: '25GB SSD', bandwidth: '2TB', sites: 'Unlimited', features: ['2 vCPU', '2GB RAM'] },
          { name: 'Premium', price: 48, period: 'month', storage: '80GB SSD', bandwidth: '5TB', sites: 'Unlimited', features: ['4 vCPU', '8GB RAM'] }
        ],
        rating: 4.6,
        uptime: '99.99%',
        support: 'Ticket & Chat',
        highlights: ['Developer-friendly', 'Simple pricing', 'Kubernetes support']
      },
      {
        name: 'Vultr',
        logo: '🔥',
        category: 'Cloud VPS',
        url: 'https://www.vultr.com',
        bestFor: ['wordpress', 'drupal', 'nextjs', 'strapi', 'custom'],
        regions: ['us', 'eu', 'asia', 'au', 'latam', 'uk'],
        features: ['ssl', 'backup'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'medium',
        plans: [
          { name: 'VC2 Micro', price: 2.50, period: 'month', storage: '10GB SSD', bandwidth: '0.5TB', sites: 'Unlimited', features: ['1 vCPU', '512MB RAM'] },
          { name: 'VC2 Small', price: 5, period: 'month', storage: '25GB SSD', bandwidth: '1TB', sites: 'Unlimited', features: ['1 vCPU', '1GB RAM'] },
          { name: 'VC2 Medium', price: 10, period: 'month', storage: '55GB SSD', bandwidth: '2TB', sites: 'Unlimited', features: ['1 vCPU', '2GB RAM'] },
          { name: 'VC2 Large', price: 20, period: 'month', storage: '80GB SSD', bandwidth: '3TB', sites: 'Unlimited', features: ['2 vCPU', '4GB RAM'] }
        ],
        rating: 4.5,
        uptime: '99.99%',
        support: 'Ticket',
        highlights: ['Cheapest cloud VPS', '32 locations', 'High performance NVMe']
      },
      {
        name: 'Linode (Akamai)',
        logo: '🟢',
        category: 'Cloud VPS',
        url: 'https://www.linode.com',
        bestFor: ['wordpress', 'drupal', 'nextjs', 'ghost', 'custom'],
        regions: ['us', 'eu', 'asia', 'au', 'uk'],
        features: ['ssl', 'backup', 'cdn'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'medium',
        plans: [
          { name: 'Nanode', price: 5, period: 'month', storage: '25GB SSD', bandwidth: '1TB', sites: 'Unlimited', features: ['1 vCPU', '1GB RAM'] },
          { name: 'Linode 2GB', price: 12, period: 'month', storage: '50GB SSD', bandwidth: '2TB', sites: 'Unlimited', features: ['1 vCPU', '2GB RAM'] },
          { name: 'Linode 4GB', price: 24, period: 'month', storage: '80GB SSD', bandwidth: '4TB', sites: 'Unlimited', features: ['2 vCPU', '4GB RAM'] },
          { name: 'Linode 8GB', price: 48, period: 'month', storage: '160GB SSD', bandwidth: '5TB', sites: 'Unlimited', features: ['4 vCPU', '8GB RAM'] }
        ],
        rating: 4.5,
        uptime: '99.99%',
        support: '24/7 Phone & Ticket',
        highlights: ['Akamai CDN integration', '11 data centers', 'Great docs']
      },
      {
        name: 'Hetzner',
        logo: '🇩🇪',
        category: 'Cloud VPS',
        url: 'https://www.hetzner.com',
        bestFor: ['wordpress', 'drupal', 'nextjs', 'strapi', 'custom'],
        regions: ['eu', 'us'],
        features: ['ssl', 'backup'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'medium',
        plans: [
          { name: 'CX11', price: 3.79, period: 'month', storage: '20GB SSD', bandwidth: '20TB', sites: 'Unlimited', features: ['1 vCPU', '2GB RAM'] },
          { name: 'CX21', price: 5.39, period: 'month', storage: '40GB SSD', bandwidth: '20TB', sites: 'Unlimited', features: ['2 vCPU', '4GB RAM'] },
          { name: 'CX31', price: 10.59, period: 'month', storage: '80GB SSD', bandwidth: '20TB', sites: 'Unlimited', features: ['2 vCPU', '8GB RAM'] },
          { name: 'CX41', price: 18.59, period: 'month', storage: '160GB SSD', bandwidth: '20TB', sites: 'Unlimited', features: ['4 vCPU', '16GB RAM'] }
        ],
        rating: 4.7,
        uptime: '99.99%',
        support: 'Ticket',
        highlights: ['Best value in Europe', 'Carbon neutral', 'German data protection']
      },
      // JAMstack/Static Hosting
      {
        name: 'Vercel',
        logo: '▲',
        category: 'JAMstack/Edge',
        url: 'https://vercel.com',
        bestFor: ['nextjs', 'gatsby', 'contentful', 'strapi', 'static'],
        regions: ['us', 'eu', 'asia', 'au', 'latam', 'uk'],
        features: ['ssl', 'cdn', 'staging', 'uptime99'],
        ecommerceSupport: 'basic',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'Hobby', price: 0, period: 'month', storage: 'N/A', bandwidth: '100GB', sites: 'Unlimited', features: ['Free SSL', 'Edge Network', 'Serverless'] },
          { name: 'Pro', price: 20, period: 'month', storage: 'N/A', bandwidth: '1TB', sites: 'Unlimited', features: ['Team features', 'Preview deployments'] },
          { name: 'Enterprise', price: 'Custom', period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 'Unlimited', features: ['SLA', 'Dedicated support'] }
        ],
        rating: 4.8,
        uptime: '99.99%',
        support: 'Chat & Email',
        highlights: ['Best for Next.js', 'Edge functions', 'Instant deployments']
      },
      {
        name: 'Netlify',
        logo: '🔷',
        category: 'JAMstack/Edge',
        url: 'https://www.netlify.com',
        bestFor: ['gatsby', 'nextjs', 'contentful', 'hugo', 'static'],
        regions: ['us', 'eu', 'asia', 'au', 'latam', 'uk'],
        features: ['ssl', 'cdn', 'staging', 'uptime99'],
        ecommerceSupport: 'basic',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'Starter', price: 0, period: 'month', storage: 'N/A', bandwidth: '100GB', sites: 'Unlimited', features: ['Free SSL', 'Global CDN', 'Forms'] },
          { name: 'Pro', price: 19, period: 'month', storage: 'N/A', bandwidth: '1TB', sites: 'Unlimited', features: ['Background functions', 'Analytics'] },
          { name: 'Business', price: 99, period: 'month', storage: 'N/A', bandwidth: '2TB', sites: 'Unlimited', features: ['SSO', 'Role-based access'] },
          { name: 'Enterprise', price: 'Custom', period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 'Unlimited', features: ['SLA', 'Dedicated support'] }
        ],
        rating: 4.7,
        uptime: '99.99%',
        support: 'Chat & Email',
        highlights: ['Pioneer of JAMstack', 'Great DX', 'Built-in CI/CD']
      },
      {
        name: 'Cloudflare Pages',
        logo: '☁️',
        category: 'JAMstack/Edge',
        url: 'https://pages.cloudflare.com',
        bestFor: ['nextjs', 'gatsby', 'hugo', 'contentful', 'static'],
        regions: ['us', 'eu', 'asia', 'au', 'latam', 'uk'],
        features: ['ssl', 'cdn', 'uptime99'],
        ecommerceSupport: 'none',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'Free', price: 0, period: 'month', storage: 'N/A', bandwidth: 'Unlimited', sites: 'Unlimited', features: ['Free SSL', 'Global CDN', '500 builds/mo'] },
          { name: 'Pro', price: 20, period: 'month', storage: 'N/A', bandwidth: 'Unlimited', sites: 'Unlimited', features: ['5000 builds/mo', 'Web analytics'] },
          { name: 'Business', price: 200, period: 'month', storage: 'N/A', bandwidth: 'Unlimited', sites: 'Unlimited', features: ['20K builds/mo', 'WAF'] }
        ],
        rating: 4.6,
        uptime: '99.99%',
        support: 'Ticket',
        highlights: ['Unlimited bandwidth free', 'Fastest edge network', 'Workers integration']
      },
      // Budget Shared Hosting
      {
        name: 'Hostinger',
        logo: '💜',
        category: 'Shared Hosting',
        url: 'https://www.hostinger.com',
        bestFor: ['wordpress', 'joomla', 'drupal'],
        regions: ['us', 'eu', 'asia', 'uk', 'latam'],
        features: ['ssl', 'backup', 'email', 'migration'],
        ecommerceSupport: 'basic',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'Single', price: 1.99, period: 'month', storage: '30GB SSD', bandwidth: '100GB', sites: 1, features: ['Free SSL', '1 Email'] },
          { name: 'Premium', price: 2.99, period: 'month', storage: '100GB SSD', bandwidth: 'Unlimited', sites: 100, features: ['Free domain', 'Daily backups'] },
          { name: 'Business', price: 3.99, period: 'month', storage: '200GB SSD', bandwidth: 'Unlimited', sites: 100, features: ['Free CDN', 'Daily backups'] },
          { name: 'Cloud Startup', price: 9.99, period: 'month', storage: '200GB SSD', bandwidth: 'Unlimited', sites: 300, features: ['3GB RAM', 'Dedicated IP'] }
        ],
        rating: 4.3,
        uptime: '99.9%',
        support: '24/7 Chat',
        highlights: ['Best budget option', 'Fast LiteSpeed servers', 'hPanel control panel']
      },
      {
        name: 'Bluehost',
        logo: '🔵',
        category: 'Shared Hosting',
        url: 'https://www.bluehost.com',
        bestFor: ['wordpress'],
        regions: ['us'],
        features: ['ssl', 'email', 'support247'],
        ecommerceSupport: 'basic',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'Basic', price: 2.95, period: 'month', storage: '10GB SSD', bandwidth: 'Unmetered', sites: 1, features: ['Free domain', 'Free SSL'] },
          { name: 'Plus', price: 5.45, period: 'month', storage: '40GB SSD', bandwidth: 'Unmetered', sites: 'Unlimited', features: ['Free domain', 'Email marketing'] },
          { name: 'Choice Plus', price: 5.45, period: 'month', storage: '40GB SSD', bandwidth: 'Unmetered', sites: 'Unlimited', features: ['Domain privacy', 'Backups'] },
          { name: 'Pro', price: 13.95, period: 'month', storage: '100GB SSD', bandwidth: 'Unmetered', sites: 'Unlimited', features: ['Dedicated IP', 'High performance'] }
        ],
        rating: 4.0,
        uptime: '99.9%',
        support: '24/7 Phone & Chat',
        highlights: ['WordPress recommended', 'Free domain 1 year', 'Easy setup']
      },
      {
        name: 'SiteGround',
        logo: '🟠',
        category: 'Shared Hosting',
        url: 'https://www.siteground.com',
        bestFor: ['wordpress', 'woocommerce', 'joomla', 'drupal'],
        regions: ['us', 'eu', 'asia', 'au', 'uk'],
        features: ['ssl', 'cdn', 'backup', 'staging', 'email', 'migration', 'support247', 'uptime99'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'StartUp', price: 2.99, period: 'month', storage: '10GB SSD', bandwidth: 'Unmetered', sites: 1, features: ['Free SSL', 'Daily backup'] },
          { name: 'GrowBig', price: 5.49, period: 'month', storage: '20GB SSD', bandwidth: 'Unmetered', sites: 'Unlimited', features: ['Staging', 'Priority support'] },
          { name: 'GoGeek', price: 9.49, period: 'month', storage: '40GB SSD', bandwidth: 'Unmetered', sites: 'Unlimited', features: ['White label', 'Git integration'] }
        ],
        rating: 4.4,
        uptime: '99.99%',
        support: '24/7 Phone & Chat',
        highlights: ['Excellent support', 'Google Cloud', 'Free CDN & Email']
      },
      {
        name: 'A2 Hosting',
        logo: '🟩',
        category: 'Shared Hosting',
        url: 'https://www.a2hosting.com',
        bestFor: ['wordpress', 'joomla', 'drupal', 'magento'],
        regions: ['us', 'eu', 'asia'],
        features: ['ssl', 'backup', 'migration', 'support247'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'Startup', price: 2.99, period: 'month', storage: '100GB SSD', bandwidth: 'Unmetered', sites: 1, features: ['Free SSL', 'Free migration'] },
          { name: 'Drive', price: 5.99, period: 'month', storage: '200GB SSD', bandwidth: 'Unmetered', sites: 'Unlimited', features: ['2X resources', 'Free backups'] },
          { name: 'Turbo Boost', price: 6.99, period: 'month', storage: '200GB NVMe', bandwidth: 'Unmetered', sites: 'Unlimited', features: ['Turbo servers', '20X faster'] },
          { name: 'Turbo Max', price: 14.99, period: 'month', storage: '200GB NVMe', bandwidth: 'Unmetered', sites: 'Unlimited', features: ['5X resources', 'Priority support'] }
        ],
        rating: 4.2,
        uptime: '99.9%',
        support: '24/7 Phone & Chat',
        highlights: ['Turbo servers', 'Anytime money-back', 'Developer-friendly']
      },
      {
        name: 'DreamHost',
        logo: '🌙',
        category: 'Shared Hosting',
        url: 'https://www.dreamhost.com',
        bestFor: ['wordpress'],
        regions: ['us'],
        features: ['ssl', 'backup', 'email', 'uptime99'],
        ecommerceSupport: 'basic',
        migrationDifficulty: 'medium',
        plans: [
          { name: 'Shared Starter', price: 2.59, period: 'month', storage: '50GB SSD', bandwidth: 'Unlimited', sites: 1, features: ['Free domain', 'Free SSL'] },
          { name: 'Shared Unlimited', price: 4.95, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 'Unlimited', features: ['Email included', 'Unlimited traffic'] },
          { name: 'DreamPress', price: 16.95, period: 'month', storage: '30GB SSD', bandwidth: 'Unmetered', sites: 1, features: ['Managed WordPress', 'Jetpack'] }
        ],
        rating: 4.1,
        uptime: '99.9%',
        support: '24/7 Chat & Ticket',
        highlights: ['100% uptime guarantee', '97-day money-back', 'Carbon neutral']
      },
      // E-commerce Platforms
      {
        name: 'Shopify',
        logo: '🛒',
        category: 'E-commerce Platform',
        url: 'https://www.shopify.com',
        bestFor: ['shopify'],
        regions: ['us', 'eu', 'asia', 'au', 'uk', 'latam'],
        features: ['ssl', 'cdn', 'backup', 'support247', 'uptime99'],
        ecommerceSupport: 'enterprise',
        migrationDifficulty: 'medium',
        plans: [
          { name: 'Basic', price: 29, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 1, features: ['2 staff accounts', '2.9% + 30¢ fees'] },
          { name: 'Shopify', price: 79, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 1, features: ['5 staff accounts', '2.6% + 30¢ fees'] },
          { name: 'Advanced', price: 299, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 1, features: ['15 staff accounts', '2.4% + 30¢ fees'] },
          { name: 'Plus', price: 2300, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 10, features: ['Enterprise', 'Custom checkout'] }
        ],
        rating: 4.5,
        uptime: '99.99%',
        support: '24/7 Phone & Chat',
        highlights: ['Best for dropshipping', 'App ecosystem', 'POS integration']
      },
      {
        name: 'BigCommerce',
        logo: '🛍️',
        category: 'E-commerce Platform',
        url: 'https://www.bigcommerce.com',
        bestFor: ['bigcommerce'],
        regions: ['us', 'eu', 'au', 'uk'],
        features: ['ssl', 'cdn', 'backup', 'support247', 'uptime99'],
        ecommerceSupport: 'enterprise',
        migrationDifficulty: 'medium',
        plans: [
          { name: 'Standard', price: 29.95, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 1, features: ['Unlimited products', 'No transaction fees'] },
          { name: 'Plus', price: 79.95, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 1, features: ['Customer groups', 'Abandoned cart'] },
          { name: 'Pro', price: 299.95, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 1, features: ['Google reviews', 'Price lists'] },
          { name: 'Enterprise', price: 'Custom', period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 'Unlimited', features: ['Priority support', 'Custom SSL'] }
        ],
        rating: 4.3,
        uptime: '99.99%',
        support: '24/7 Phone & Chat',
        highlights: ['No transaction fees', 'Multi-channel', 'B2B features']
      },
      // Website Builders (self-hosting not available)
      {
        name: 'Wix',
        logo: '🎨',
        category: 'Website Builder',
        url: 'https://www.wix.com',
        bestFor: ['wix'],
        regions: ['us', 'eu', 'asia', 'au', 'uk', 'latam'],
        features: ['ssl', 'cdn', 'backup', 'support247'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'hard',
        plans: [
          { name: 'Light', price: 16, period: 'month', storage: '2GB', bandwidth: '500MB', sites: 1, features: ['Free domain', 'Basic analytics'] },
          { name: 'Core', price: 27, period: 'month', storage: '50GB', bandwidth: '15GB', sites: 1, features: ['Accept payments', 'Visitor analytics'] },
          { name: 'Business', price: 32, period: 'month', storage: '100GB', bandwidth: 'Unlimited', sites: 1, features: ['Developer tools', 'Custom reports'] },
          { name: 'Business Elite', price: 159, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 1, features: ['VIP support', 'Custom reports'] }
        ],
        rating: 4.2,
        uptime: '99.9%',
        support: '24/7 Phone & Chat',
        highlights: ['Easiest builder', 'AI website maker', '800+ templates']
      },
      {
        name: 'Squarespace',
        logo: '⬛',
        category: 'Website Builder',
        url: 'https://www.squarespace.com',
        bestFor: ['squarespace'],
        regions: ['us', 'eu', 'au', 'uk'],
        features: ['ssl', 'cdn', 'backup', 'support247', 'uptime99'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'hard',
        plans: [
          { name: 'Personal', price: 16, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 1, features: ['Free domain', 'SSL included'] },
          { name: 'Business', price: 23, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 1, features: ['E-commerce', '3% fees'] },
          { name: 'Commerce Basic', price: 27, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 1, features: ['No fees', 'POS'] },
          { name: 'Commerce Advanced', price: 49, period: 'month', storage: 'Unlimited', bandwidth: 'Unlimited', sites: 1, features: ['Subscriptions', 'Abandoned cart'] }
        ],
        rating: 4.4,
        uptime: '99.98%',
        support: '24/7 Chat & Email',
        highlights: ['Beautiful templates', 'All-in-one', 'Great for creatives']
      },
      // Managed Cloud
      {
        name: 'Cloudways',
        logo: '☁️',
        category: 'Managed Cloud',
        url: 'https://www.cloudways.com',
        bestFor: ['wordpress', 'magento', 'drupal', 'joomla', 'woocommerce'],
        regions: ['us', 'eu', 'asia', 'au', 'uk', 'latam'],
        features: ['ssl', 'cdn', 'backup', 'staging', 'migration', 'support247', 'uptime99'],
        ecommerceSupport: 'large',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'DO 1GB', price: 11, period: 'month', storage: '25GB', bandwidth: '1TB', sites: 'Unlimited', features: ['1 vCPU', '1GB RAM', 'Free SSL'] },
          { name: 'DO 2GB', price: 24, period: 'month', storage: '50GB', bandwidth: '2TB', sites: 'Unlimited', features: ['1 vCPU', '2GB RAM', 'Staging'] },
          { name: 'AWS Small', price: 38.56, period: 'month', storage: '20GB', bandwidth: '2GB', sites: 'Unlimited', features: ['1 vCPU', '2GB RAM', 'AWS'] },
          { name: 'GCE Small', price: 37.45, period: 'month', storage: '20GB', bandwidth: '2GB', sites: 'Unlimited', features: ['1 vCPU', '1.7GB RAM', 'GCP'] }
        ],
        rating: 4.5,
        uptime: '99.99%',
        support: '24/7 Chat & Ticket',
        highlights: ['Choose your cloud', 'Pay as you go', 'Free migrations']
      },
      {
        name: 'AWS (Lightsail)',
        logo: '🟧',
        category: 'Cloud Provider',
        url: 'https://aws.amazon.com/lightsail/',
        bestFor: ['wordpress', 'drupal', 'nextjs', 'ghost', 'magento', 'custom'],
        regions: ['us', 'eu', 'asia', 'au', 'uk', 'latam'],
        features: ['ssl', 'cdn', 'backup', 'uptime99'],
        ecommerceSupport: 'large',
        migrationDifficulty: 'hard',
        plans: [
          { name: 'Nano', price: 3.50, period: 'month', storage: '20GB SSD', bandwidth: '1TB', sites: 'Unlimited', features: ['1 vCPU', '512MB RAM'] },
          { name: 'Micro', price: 5, period: 'month', storage: '40GB SSD', bandwidth: '2TB', sites: 'Unlimited', features: ['1 vCPU', '1GB RAM'] },
          { name: 'Small', price: 10, period: 'month', storage: '60GB SSD', bandwidth: '3TB', sites: 'Unlimited', features: ['1 vCPU', '2GB RAM'] },
          { name: 'Medium', price: 20, period: 'month', storage: '80GB SSD', bandwidth: '4TB', sites: 'Unlimited', features: ['2 vCPU', '4GB RAM'] }
        ],
        rating: 4.4,
        uptime: '99.99%',
        support: 'Paid plans',
        highlights: ['AWS ecosystem', 'Scalable', '3 months free tier']
      },
      {
        name: 'Google Cloud',
        logo: '🔴🟡🟢🔵',
        category: 'Cloud Provider',
        url: 'https://cloud.google.com',
        bestFor: ['wordpress', 'nextjs', 'ghost', 'strapi', 'custom'],
        regions: ['us', 'eu', 'asia', 'au', 'uk', 'latam'],
        features: ['ssl', 'cdn', 'backup', 'uptime99'],
        ecommerceSupport: 'large',
        migrationDifficulty: 'hard',
        plans: [
          { name: 'e2-micro', price: 6.11, period: 'month', storage: '10GB', bandwidth: 'Pay per use', sites: 'Unlimited', features: ['2 vCPU', '1GB RAM'] },
          { name: 'e2-small', price: 12.23, period: 'month', storage: '10GB', bandwidth: 'Pay per use', sites: 'Unlimited', features: ['2 vCPU', '2GB RAM'] },
          { name: 'e2-medium', price: 24.46, period: 'month', storage: '10GB', bandwidth: 'Pay per use', sites: 'Unlimited', features: ['2 vCPU', '4GB RAM'] },
          { name: 'n1-standard-1', price: 24.27, period: 'month', storage: '10GB', bandwidth: 'Pay per use', sites: 'Unlimited', features: ['1 vCPU', '3.75GB RAM'] }
        ],
        rating: 4.5,
        uptime: '99.99%',
        support: 'Paid plans',
        highlights: ['Premium network', '$300 free credits', 'ML/AI integration']
      },
      // Additional CMS-specific hosting
      {
        name: 'Webflow',
        logo: '🌐',
        category: 'Website Builder',
        url: 'https://webflow.com',
        bestFor: ['webflow'],
        regions: ['us', 'eu', 'asia'],
        features: ['ssl', 'cdn', 'backup', 'uptime99'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'hard',
        plans: [
          { name: 'Starter', price: 0, period: 'month', storage: '1GB', bandwidth: '1GB', sites: 2, features: ['Webflow.io subdomain', '1,000 form submissions'] },
          { name: 'Basic', price: 14, period: 'month', storage: '10GB', bandwidth: '50GB', sites: 1, features: ['Custom domain', '500 form submissions'] },
          { name: 'CMS', price: 23, period: 'month', storage: '10GB', bandwidth: '200GB', sites: 1, features: ['CMS items: 2,000', 'SEO controls'] },
          { name: 'Business', price: 39, period: 'month', storage: '10GB', bandwidth: '400GB', sites: 1, features: ['CMS items: 10,000', 'Form file uploads'] }
        ],
        rating: 4.6,
        uptime: '99.99%',
        support: 'Priority chat',
        highlights: ['Visual development', 'No-code animations', 'CMS built-in']
      },
      {
        name: 'Ghost(Pro)',
        logo: '👻',
        category: 'Managed CMS',
        url: 'https://ghost.org',
        bestFor: ['ghost'],
        regions: ['us', 'eu', 'asia'],
        features: ['ssl', 'cdn', 'backup', 'migration', 'uptime99'],
        ecommerceSupport: 'basic',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'Starter', price: 9, period: 'month', storage: '5GB', bandwidth: 'Unlimited', sites: 1, features: ['500 members', 'Custom theme'] },
          { name: 'Creator', price: 25, period: 'month', storage: '25GB', bandwidth: 'Unlimited', sites: 1, features: ['1,000 members', 'Newsletter analytics'] },
          { name: 'Team', price: 50, period: 'month', storage: '50GB', bandwidth: 'Unlimited', sites: 1, features: ['5 staff users', '10,000 members'] },
          { name: 'Business', price: 199, period: 'month', storage: '100GB', bandwidth: 'Unlimited', sites: 1, features: ['Unlimited staff', '100,000 members'] }
        ],
        rating: 4.7,
        uptime: '99.99%',
        support: 'Priority email',
        highlights: ['Creator-focused', 'Built-in memberships', 'Newsletter platform']
      },
      {
        name: 'Pantheon',
        logo: '🏛️',
        category: 'Managed WordPress/Drupal',
        url: 'https://pantheon.io',
        bestFor: ['wordpress', 'drupal'],
        regions: ['us', 'eu', 'au'],
        features: ['ssl', 'cdn', 'backup', 'staging', 'support247', 'uptime99'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'medium',
        plans: [
          { name: 'Basic', price: 41, period: 'month', storage: '20GB', bandwidth: '25K visits', sites: 1, features: ['Dev/Test/Live', 'Free SSL'] },
          { name: 'Performance Small', price: 175, period: 'month', storage: '40GB', bandwidth: '125K visits', sites: 1, features: ['Global CDN', 'New Relic'] },
          { name: 'Performance Medium', price: 300, period: 'month', storage: '60GB', bandwidth: '250K visits', sites: 1, features: ['Advanced CDN', 'Priority support'] },
          { name: 'Performance Large', price: 550, period: 'month', storage: '100GB', bandwidth: '500K visits', sites: 1, features: ['Edge caching', 'Multizone failover'] }
        ],
        rating: 4.6,
        uptime: '99.99%',
        support: '24/7 Chat & Ticket',
        highlights: ['WebOps platform', 'Git-based workflow', 'Multidev environments']
      },
      {
        name: 'WP.com Business',
        logo: '📝',
        category: 'Managed WordPress',
        url: 'https://wordpress.com',
        bestFor: ['wordpress'],
        regions: ['us', 'eu', 'asia', 'au', 'uk', 'latam'],
        features: ['ssl', 'cdn', 'backup', 'support247', 'uptime99'],
        ecommerceSupport: 'medium',
        migrationDifficulty: 'easy',
        plans: [
          { name: 'Free', price: 0, period: 'month', storage: '1GB', bandwidth: 'Unlimited', sites: 1, features: ['WordPress.com subdomain', 'Limited themes'] },
          { name: 'Personal', price: 4, period: 'month', storage: '6GB', bandwidth: 'Unlimited', sites: 1, features: ['Custom domain', 'Email support'] },
          { name: 'Premium', price: 8, period: 'month', storage: '13GB', bandwidth: 'Unlimited', sites: 1, features: ['Premium themes', 'Monetization'] },
          { name: 'Business', price: 25, period: 'month', storage: '50GB', bandwidth: 'Unlimited', sites: 1, features: ['Plugins', 'SEO tools'] },
          { name: 'Commerce', price: 45, period: 'month', storage: '50GB', bandwidth: 'Unlimited', sites: 1, features: ['WooCommerce', 'Product add-ons'] }
        ],
        rating: 4.3,
        uptime: '99.99%',
        support: '24/7 Chat & Email',
        highlights: ['Easiest WordPress', 'Jetpack included', 'Automatic updates']
      }
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
        sslCertResults,
        dnsHealthResults,
        portScanResults,
        cmsDetectionResults,
      ] = await Promise.allSettled([
        this.checkBlacklists(ipAddress),
        this.checkEmailConfiguration(hostname || input),
        this.getHostingInformation(ipAddress, hostname),
        hostname ? this.checkSSLCertificate(hostname) : Promise.resolve(null),
        hostname ? this.checkDNSHealth(hostname) : Promise.resolve(null),
        this.scanSecurityPorts(ipAddress),
        hostname ? this.detectCMSAndAnalyzeHosting(hostname) : Promise.resolve(null),
      ]);

      const blacklists = blacklistResults.status === 'fulfilled' ? blacklistResults.value : [];
      const emailConfig = emailConfigResults.status === 'fulfilled' ? emailConfigResults.value : null;
      const hostingInfo = hostingInfoResults.status === 'fulfilled' ? hostingInfoResults.value : null;
      const sslCert = sslCertResults.status === 'fulfilled' ? sslCertResults.value : null;
      const dnsHealth = dnsHealthResults.status === 'fulfilled' ? dnsHealthResults.value : null;
      const portScan = portScanResults.status === 'fulfilled' ? portScanResults.value : null;
      const hostingAnalysis = cmsDetectionResults.status === 'fulfilled' ? cmsDetectionResults.value : null;

      // Calculate scores
      const blacklistScore = this.calculateBlacklistScore(blacklists);
      const emailScore = this.calculateEmailScore(emailConfig);
      const sslScore = this.calculateSSLScore(sslCert);
      const dnsScore = this.calculateDNSHealthScore(dnsHealth);
      const portSecurityScore = this.calculatePortSecurityScore(portScan);
      const overallScore = this.calculateOverallScore(blacklistScore, emailScore, hostingInfo, sslScore, dnsScore, portSecurityScore);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        blacklists,
        emailConfig,
        hostingInfo,
        blacklistScore,
        emailScore,
        sslCert,
        dnsHealth,
        portScan
      );

      // Determine threat intelligence based on blacklists
      const threatIntel = this.analyzeThreatIntelligence(blacklists, hostingInfo, portScan);

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
        sslScore,
        sslStatus: this.getSSLStatus(sslScore),
        dnsScore,
        dnsStatus: this.getDNSStatus(dnsScore),
        portSecurityScore,
        blacklists,
        emailConfig,
        hostingInfo,
        sslCert,
        dnsHealth,
        portScan,
        hostingAnalysis,
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
  analyzeThreatIntelligence(blacklists, hostingInfo, portScan) {
    const listedBlacklists = blacklists.filter(bl => bl.listed);
    const threats = [];

    // Blacklist threats
    listedBlacklists.forEach(bl => {
      threats.push({
        type: 'Blacklist Listing',
        severity: this.getBlacklistSeverity(bl),
        description: `Listed on ${bl.name}: ${bl.description}`,
        source: bl.name,
      });
    });

    // Port scan threats
    if (portScan && portScan.securityIssues) {
      portScan.securityIssues.forEach(issue => {
        threats.push({
          type: 'Exposed Service',
          severity: issue.severity,
          description: issue.description,
          source: `Port ${issue.port}`,
        });
      });
    }

    const hasThreats = threats.length > 0;

    // Calculate risk level
    let riskLevel = 'minimal';
    const criticalCount = threats.filter(t => t.severity === 'critical').length;
    const highCount = threats.filter(t => t.severity === 'high').length;
    
    if (criticalCount > 0 || listedBlacklists.length >= 5) {
      riskLevel = 'critical';
    } else if (highCount >= 2 || listedBlacklists.length >= 3) {
      riskLevel = 'high';
    } else if (highCount >= 1 || listedBlacklists.length >= 1) {
      riskLevel = 'medium';
    } else if (threats.length > 0) {
      riskLevel = 'low';
    }

    return {
      hasThreats,
      threats,
      riskLevel,
      summary: {
        totalThreats: threats.length,
        critical: criticalCount,
        high: highCount,
        medium: threats.filter(t => t.severity === 'medium').length,
        low: threats.filter(t => t.severity === 'low').length,
      },
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

    return Math.max(0, roundTo(score, 0));
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
  calculateOverallScore(blacklistScore, emailScore, hostingInfo, sslScore = 50, dnsScore = 50, portSecurityScore = 50) {
    // Weighted average with expanded factors
    // Blacklist: 40% (most critical for reputation)
    // Email: 20% (important for deliverability)
    // SSL: 15% (security indicator)
    // DNS: 10% (infrastructure health)
    // Port Security: 10% (attack surface)
    // Hosting: 5% (basic check)

    const hostingScore = hostingInfo && hostingInfo.cloudProvider ? 70 : 60;

    const overallScore =
      blacklistScore * 0.40 +
      emailScore * 0.20 +
      sslScore * 0.15 +
      dnsScore * 0.10 +
      portSecurityScore * 0.10 +
      hostingScore * 0.05;

    return roundTo(overallScore, 0);
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
  generateRecommendations(blacklists, emailConfig, hostingInfo, blacklistScore, emailScore, sslCert, dnsHealth, portScan) {
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

    // SSL Certificate recommendations
    if (sslCert) {
      if (!sslCert.valid) {
        recommendations.push({
          priority: 'high',
          title: 'Fix SSL Certificate',
          description: sslCert.error || 'SSL certificate is invalid or missing.',
          action: 'Install a valid SSL certificate from a trusted CA. Consider free options like Let\'s Encrypt.',
          impact: 'High - Essential for security and SEO ranking',
        });
      } else if (sslCert.daysUntilExpiry <= 30) {
        recommendations.push({
          priority: 'high',
          title: 'Renew SSL Certificate Soon',
          description: `Your SSL certificate expires in ${sslCert.daysUntilExpiry} days.`,
          action: 'Renew your SSL certificate before expiration to avoid security warnings.',
          impact: 'High - Expired certificates break website access',
        });
      } else if (sslCert.selfSigned) {
        recommendations.push({
          priority: 'medium',
          title: 'Replace Self-Signed Certificate',
          description: 'Self-signed certificates cause browser warnings and reduce trust.',
          action: 'Replace with a certificate from a trusted CA like Let\'s Encrypt (free).',
          impact: 'Medium - Improves user trust and security',
        });
      }
      if (sslCert.protocol && !['TLSv1.2', 'TLSv1.3'].includes(sslCert.protocol)) {
        recommendations.push({
          priority: 'high',
          title: 'Upgrade TLS Version',
          description: `Using outdated ${sslCert.protocol}. Modern browsers may reject this.`,
          action: 'Configure your server to use TLS 1.2 or 1.3 only.',
          impact: 'High - Security vulnerability',
        });
      }
    }

    // Port Security recommendations
    if (portScan && portScan.securityIssues?.length > 0) {
      const criticalPorts = portScan.securityIssues.filter(i => i.severity === 'critical');
      const highPorts = portScan.securityIssues.filter(i => i.severity === 'high');
      
      if (criticalPorts.length > 0) {
        recommendations.push({
          priority: 'high',
          title: 'Close Critical Exposed Ports',
          description: `${criticalPorts.length} critically risky port(s) are publicly accessible: ${criticalPorts.map(p => p.service).join(', ')}.`,
          action: 'Use a firewall to close these ports or move services behind a VPN.',
          impact: 'Critical - Major attack vector for hackers',
        });
      }
      if (highPorts.length > 0) {
        recommendations.push({
          priority: 'medium',
          title: 'Secure High-Risk Ports',
          description: `${highPorts.length} high-risk port(s) are accessible: ${highPorts.map(p => p.service).join(', ')}.`,
          action: 'Restrict access with firewall rules or VPN. Ensure strong authentication.',
          impact: 'High - Potential security risk',
        });
      }
    }

    // DNS Health recommendations
    if (dnsHealth) {
      if (!dnsHealth.hasCAA) {
        recommendations.push({
          priority: 'low',
          title: 'Add CAA DNS Records',
          description: 'No CAA records found. CAA restricts which CAs can issue certificates for your domain.',
          action: 'Add a CAA record to specify authorized certificate authorities.',
          impact: 'Low - Prevents unauthorized certificate issuance',
        });
      }
      if (dnsHealth.nsRecords?.length < 2) {
        recommendations.push({
          priority: 'medium',
          title: 'Add Additional Nameservers',
          description: 'Only one nameserver detected. This creates a single point of failure.',
          action: 'Configure at least 2 nameservers for DNS redundancy.',
          impact: 'Medium - Ensures DNS availability',
        });
      }
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

  /**
   * Check SSL/TLS Certificate
   */
  async checkSSLCertificate(hostname) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ valid: false, error: 'Connection timeout' });
      }, 10000);

      try {
        const socket = tls.connect({
          host: hostname,
          port: 443,
          servername: hostname,
          rejectUnauthorized: false, // Allow self-signed for analysis
        }, () => {
          clearTimeout(timeout);
          const cert = socket.getPeerCertificate();
          socket.end();

          if (!cert || Object.keys(cert).length === 0) {
            resolve({ valid: false, error: 'No certificate found' });
            return;
          }

          const now = new Date();
          const validFrom = new Date(cert.valid_from);
          const validTo = new Date(cert.valid_to);
          const daysUntilExpiry = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));
          const isExpired = validTo < now;
          const isNotYetValid = validFrom > now;

          resolve({
            valid: !isExpired && !isNotYetValid,
            issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
            subject: cert.subject?.CN || hostname,
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
            daysUntilExpiry,
            isExpired,
            isNotYetValid,
            protocol: socket.getProtocol(),
            cipher: socket.getCipher()?.name,
            selfSigned: cert.issuer?.CN === cert.subject?.CN,
            altNames: cert.subjectaltname?.split(', ').map(n => n.replace('DNS:', '')) || [],
            serialNumber: cert.serialNumber,
            fingerprint256: cert.fingerprint256,
          });
        });

        socket.on('error', (err) => {
          clearTimeout(timeout);
          resolve({ valid: false, error: err.message });
        });
      } catch (error) {
        clearTimeout(timeout);
        resolve({ valid: false, error: error.message });
      }
    });
  }

  /**
   * Check DNS Health (DNSSEC, CAA, NS records)
   */
  async checkDNSHealth(domain) {
    const results = {
      nsRecords: [],
      mxRecords: [],
      caaRecords: [],
      dnssec: false,
      issues: [],
    };

    try {
      // Check NS records
      try {
        results.nsRecords = await dns.resolveNs(domain);
        if (results.nsRecords.length < 2) {
          results.issues.push('Less than 2 NS records - redundancy recommended');
        }
      } catch (e) {
        results.issues.push('Unable to resolve NS records');
      }

      // Check MX records
      try {
        const mxRecords = await dns.resolveMx(domain);
        results.mxRecords = mxRecords.sort((a, b) => a.priority - b.priority);
      } catch (e) {
        // MX records not required for all domains
      }

      // Check CAA records (Certificate Authority Authorization)
      try {
        const caaRecords = await dns.resolveCaa(domain);
        results.caaRecords = caaRecords;
        results.hasCAA = caaRecords.length > 0;
      } catch (e) {
        results.hasCAA = false;
        results.issues.push('No CAA records - consider adding to restrict certificate issuance');
      }

      // Check for DNSSEC (attempt to resolve with DO flag - simplified check)
      try {
        const dnskeyDomain = domain;
        await dns.resolveTxt(`_dnskey.${dnskeyDomain}`);
        results.dnssec = true;
      } catch (e) {
        // Simplified DNSSEC check - presence of DS record indicates DNSSEC
        try {
          // We can't easily check DNSSEC without special resolvers
          // Mark as unknown/not verified
          results.dnssec = null;
          results.dnssecNote = 'DNSSEC verification requires special resolver';
        } catch (e2) {
          results.dnssec = false;
        }
      }

      // Check for common DNS misconfigurations
      try {
        const aRecords = await dns.resolve4(domain);
        const wwwRecords = await dns.resolve4(`www.${domain}`).catch(() => []);
        
        if (aRecords.length === 0) {
          results.issues.push('No A records found');
        }
        
        results.aRecords = aRecords;
        results.wwwRecords = wwwRecords;
        
        // Check if www points to same IP
        if (wwwRecords.length > 0 && !aRecords.some(a => wwwRecords.includes(a))) {
          results.issues.push('www subdomain points to different IP than root domain');
        }
      } catch (e) {
        results.issues.push('Unable to resolve A records');
      }

    } catch (error) {
      logger.warn('DNS health check error', { domain, error: error.message });
    }

    results.score = this.calculateDNSHealthScore(results);
    return results;
  }

  /**
   * Scan common security-sensitive ports
   */
  async scanSecurityPorts(ip) {
    if (!this.isValidIP(ip)) {
      return { scanned: false, error: 'Invalid IP address' };
    }

    logger.info('Starting port security scan', { ip });
    
    const results = {
      scanned: true,
      openPorts: [],
      closedPorts: [],
      timedOutPorts: [],
      securityIssues: [],
      timestamp: new Date().toISOString(),
    };

    const scanPort = (port, portInfo) => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        const timeout = 2000; // 2 second timeout per port

        socket.setTimeout(timeout);

        socket.on('connect', () => {
          socket.destroy();
          resolve({
            ...portInfo,
            status: 'open',
          });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({
            ...portInfo,
            status: 'filtered',
          });
        });

        socket.on('error', (err) => {
          socket.destroy();
          if (err.code === 'ECONNREFUSED') {
            resolve({
              ...portInfo,
              status: 'closed',
            });
          } else {
            resolve({
              ...portInfo,
              status: 'filtered',
            });
          }
        });

        socket.connect(port, ip);
      });
    };

    // Scan all ports in parallel
    const portScans = this.securityPorts.map(p => scanPort(p.port, p));
    const portResults = await Promise.all(portScans);

    portResults.forEach(result => {
      if (result.status === 'open') {
        results.openPorts.push(result);
        
        // Flag security issues
        if (result.risk === 'critical') {
          results.securityIssues.push({
            severity: 'critical',
            port: result.port,
            service: result.name,
            description: `Port ${result.port} (${result.name}) is open - ${result.description}`,
          });
        } else if (result.risk === 'high') {
          results.securityIssues.push({
            severity: 'high',
            port: result.port,
            service: result.name,
            description: `Port ${result.port} (${result.name}) is open - ${result.description}`,
          });
        }
      } else if (result.status === 'closed') {
        results.closedPorts.push(result);
      } else {
        results.timedOutPorts.push(result);
      }
    });

    results.score = this.calculatePortSecurityScore(results);
    return results;
  }

  /**
   * Calculate SSL Certificate Score
   */
  calculateSSLScore(sslCert) {
    if (!sslCert || !sslCert.valid) return 0;

    let score = 50; // Base score for valid cert

    // Days until expiry scoring
    if (sslCert.daysUntilExpiry > 90) score += 25;
    else if (sslCert.daysUntilExpiry > 30) score += 15;
    else if (sslCert.daysUntilExpiry > 14) score += 5;
    else if (sslCert.daysUntilExpiry <= 0) score -= 50;

    // Self-signed penalty
    if (sslCert.selfSigned) score -= 20;

    // Modern protocol bonus
    if (sslCert.protocol === 'TLSv1.3') score += 15;
    else if (sslCert.protocol === 'TLSv1.2') score += 10;

    // Strong cipher bonus
    if (sslCert.cipher && sslCert.cipher.includes('GCM')) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate DNS Health Score
   */
  calculateDNSHealthScore(dnsHealth) {
    if (!dnsHealth) return 50;

    let score = 70; // Base score

    // NS records
    if (dnsHealth.nsRecords?.length >= 2) score += 10;
    else score -= 10;

    // CAA records
    if (dnsHealth.hasCAA) score += 10;

    // MX records (if email is expected)
    if (dnsHealth.mxRecords?.length > 0) score += 5;

    // Issues penalty
    score -= (dnsHealth.issues?.length || 0) * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate Port Security Score
   */
  calculatePortSecurityScore(portScan) {
    if (!portScan || !portScan.scanned) return 50;

    let score = 100; // Start with perfect score

    // Deduct for open risky ports
    portScan.securityIssues?.forEach(issue => {
      if (issue.severity === 'critical') score -= 25;
      else if (issue.severity === 'high') score -= 15;
      else if (issue.severity === 'medium') score -= 5;
    });

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get SSL Status text
   */
  getSSLStatus(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    if (score > 0) return 'Poor';
    return 'No SSL';
  }

  /**
   * Get DNS Status text
   */
  getDNSStatus(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Attention';
  }

  /**
   * Detect CMS and analyze hosting options with traffic-aware recommendations
   * @param {string} hostname - The hostname to analyze
   * @param {Object} manualOverrides - Optional manual overrides for traffic/CMS
   */
  async detectCMSAndAnalyzeHosting(hostname, manualOverrides = {}) {
    logger.info('Detecting CMS and analyzing hosting options', { 
      hostname,
      manualOverrides: Object.keys(manualOverrides).filter(k => manualOverrides[k])
    });
    
    const result = {
      cms: null,
      detectedSignatures: [],
      currentHost: null,
      trafficTier: null,
      trafficIndicators: [],
      recommendedHosts: [],
      allProviders: [],
      priceComparison: null,
      savingsOpportunities: [],
      tierWarning: null,
      manualOverridesApplied: false,
    };

    try {
      // Fetch the website to detect CMS
      const pageContent = await this.fetchWebsiteContent(hostname);
      
      if (pageContent) {
        // Detect CMS from page content and headers (unless manually overridden)
        if (manualOverrides.cms) {
          // Use manual CMS selection
          result.cms = this.getCMSByKey(manualOverrides.cms);
          result.manualOverridesApplied = true;
          logger.info('Using manual CMS override', { cms: manualOverrides.cms });
        } else {
          result.cms = this.detectCMSFromContent(pageContent.html, pageContent.headers);
        }
        result.detectedSignatures = pageContent.signatures || [];
      }

      // Try to detect current hosting provider from headers/DNS
      result.currentHost = await this.detectCurrentHost(hostname);

      // Estimate traffic tier - use manual override if provided
      let tierAnalysis;
      if (manualOverrides.monthlyVisitors) {
        // Use manual traffic tier based on visitor count
        tierAnalysis = this.getTrafficTierFromVisitors(manualOverrides.monthlyVisitors);
        result.manualOverridesApplied = true;
        logger.info('Using manual traffic override', { visitors: manualOverrides.monthlyVisitors, tier: tierAnalysis.tier.name });
      } else {
        tierAnalysis = await this.estimateTrafficTier(hostname, pageContent, result.currentHost);
      }
      result.trafficTier = tierAnalysis.tier;
      result.trafficIndicators = tierAnalysis.indicators;
      result.tierConfidence = tierAnalysis.confidence;

      // Get recommended hosts based on detected CMS AND traffic tier
      const cmsKey = result.cms?.key || 'generic';
      
      // Build comprehensive filter object
      const filterOptions = {
        priority: manualOverrides.priority || 'balanced',
        region: manualOverrides.region || null,
        ecommerceLevel: manualOverrides.ecommerceLevel || 'none',
        requiredFeatures: manualOverrides.requiredFeatures || [],
        storageNeeds: manualOverrides.storageNeeds || null,
        billingPreference: manualOverrides.billingPreference || 'annual'
      };
      
      result.recommendedHosts = this.getRecommendedHostsForTier(cmsKey, result.trafficTier, filterOptions);
      result.appliedFilters = filterOptions;

      // Get all providers filtered by tier appropriateness
      result.allProviders = this.getAllHostingProvidersForTier(result.trafficTier, filterOptions);

      // Calculate price comparison for tier-appropriate hosts only
      result.priceComparison = this.calculatePriceComparisonForTier(result.recommendedHosts, result.trafficTier);

      // Add tier warning if needed
      if (result.trafficTier.key === 'enterprise' || result.trafficTier.key === 'business') {
        result.tierWarning = {
          message: `Based on our analysis, this appears to be a ${result.trafficTier.name.toLowerCase()} website. Budget hosting options are not shown as they would be inadequate for this site's needs.`,
          hiddenCount: this.countHiddenBudgetOptions(),
        };
      }

      // Find savings opportunities only within appropriate tier
      if (result.currentHost && result.cms) {
        result.savingsOpportunities = this.findSavingsOpportunitiesForTier(
          result.currentHost, 
          result.cms.key,
          result.trafficTier
        );
      }

      logger.info('Hosting analysis completed', {
        hostname,
        cms: result.cms?.name,
        trafficTier: result.trafficTier?.name,
        recommendedCount: result.recommendedHosts.length,
        manualOverridesApplied: result.manualOverridesApplied,
      });

    } catch (error) {
      logger.warn('CMS detection failed', { hostname, error: error.message });
    }

    return result;
  }

  /**
   * Get CMS info by key (for manual overrides)
   */
  getCMSByKey(cmsKey) {
    const cmsDatabase = {
      wordpress: { key: 'wordpress', name: 'WordPress', icon: '📝', marketShare: '43%' },
      shopify: { key: 'shopify', name: 'Shopify', icon: '🛒', marketShare: '4%' },
      wix: { key: 'wix', name: 'Wix', icon: '🎨', marketShare: '2.5%' },
      squarespace: { key: 'squarespace', name: 'Squarespace', icon: '⬛', marketShare: '2%' },
      webflow: { key: 'webflow', name: 'Webflow', icon: '🌐', marketShare: '1%' },
      woocommerce: { key: 'woocommerce', name: 'WooCommerce', icon: '🛍️', marketShare: '8%' },
      magento: { key: 'magento', name: 'Magento', icon: '🧲', marketShare: '1.2%' },
      bigcommerce: { key: 'bigcommerce', name: 'BigCommerce', icon: '🛍️', marketShare: '0.5%' },
      prestashop: { key: 'prestashop', name: 'PrestaShop', icon: '🛒', marketShare: '0.8%' },
      drupal: { key: 'drupal', name: 'Drupal', icon: '💧', marketShare: '1.5%' },
      joomla: { key: 'joomla', name: 'Joomla', icon: '🔌', marketShare: '1.7%' },
      hubspot: { key: 'hubspot', name: 'HubSpot CMS', icon: '🟠', marketShare: '0.5%' },
      contentful: { key: 'contentful', name: 'Contentful', icon: '📦', marketShare: '0.3%' },
      nextjs: { key: 'nextjs', name: 'Next.js', icon: '▲', marketShare: '1%' },
      gatsby: { key: 'gatsby', name: 'Gatsby', icon: '💜', marketShare: '0.5%' },
      ghost: { key: 'ghost', name: 'Ghost', icon: '👻', marketShare: '0.3%' },
      strapi: { key: 'strapi', name: 'Strapi', icon: '🚀', marketShare: '0.2%' },
      static: { key: 'static', name: 'Static HTML', icon: '📄', marketShare: 'N/A' },
      custom: { key: 'custom', name: 'Custom/Other', icon: '⚙️', marketShare: 'N/A' }
    };
    return cmsDatabase[cmsKey] || cmsDatabase.custom;
  }

  /**
   * Get traffic tier based on manual visitor count input
   */
  getTrafficTierFromVisitors(monthlyVisitors) {
    let tier;
    const indicators = [{ icon: '👤', signal: `${monthlyVisitors.toLocaleString()} monthly visitors (user input)` }];
    
    if (monthlyVisitors >= 500000) {
      tier = { ...this.trafficTiers.enterprise };
    } else if (monthlyVisitors >= 50000) {
      tier = { ...this.trafficTiers.business };
    } else if (monthlyVisitors >= 5000) {
      tier = { ...this.trafficTiers.startup };
    } else {
      tier = { ...this.trafficTiers.personal };
    }
    
    return {
      tier,
      indicators,
      confidence: 95, // High confidence since user provided the number
    };
  }

  /**
   * Fetch website content for CMS detection
   */
  async fetchWebsiteContent(hostname) {
    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          logger.debug('Content fetch timeout', { hostname });
          resolve(null);
        }
      }, 15000); // Increased timeout to 15 seconds

      const options = {
        hostname,
        port: 443,
        path: '/',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'identity', // Disable compression for simpler handling
        },
        rejectUnauthorized: false,
      };

      const req = https.request(options, (res) => {
        let html = '';
        const headers = res.headers;

        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            // Follow redirect if same host
            const location = res.headers.location;
            if (location.startsWith('/')) {
              // Same host redirect
              this.fetchWebsiteContentPath(hostname, location).then(resolve).catch(() => resolve(null));
            } else {
              // External redirect - just return what we have
              resolve({ html, headers });
            }
          }
          return;
        }

        res.on('data', (chunk) => {
          html += chunk.toString();
          // Stop after 50KB - enough for CMS detection
          if (html.length > 50000) {
            clearTimeout(timeout);
            if (!resolved) {
              resolved = true;
              res.destroy();
              resolve({ html: html.substring(0, 50000), headers });
            }
          }
        });

        res.on('end', () => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve({ html: html.substring(0, 100000), headers });
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          logger.debug('HTTPS fetch failed, trying HTTP', { hostname, error: err.message });
          // Try HTTP if HTTPS fails
          this.fetchHTTP(hostname).then(resolve).catch(() => resolve(null));
        }
      });

      req.setTimeout(10000, () => {
        req.destroy();
      });

      req.end();
    });
  }

  /**
   * Fetch from a specific path (for redirects)
   */
  async fetchWebsiteContentPath(hostname, path) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);

      const req = https.request({
        hostname,
        port: 443,
        path,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FontScanner/1.0)',
          'Accept': 'text/html',
        },
        rejectUnauthorized: false,
      }, (res) => {
        let html = '';
        res.on('data', (chunk) => {
          html += chunk.toString();
          if (html.length > 50000) res.destroy();
        });
        res.on('end', () => {
          clearTimeout(timeout);
          resolve({ html: html.substring(0, 50000), headers: res.headers });
        });
      });

      req.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      req.end();
    });
  }

  /**
   * Fallback HTTP fetch
   */
  async fetchHTTP(hostname) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

      const req = http.request({
        hostname,
        port: 80,
        path: '/',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FontScanner/1.0)',
        },
      }, (res) => {
        let html = '';
        res.on('data', (chunk) => {
          html += chunk.toString();
          if (html.length > 100000) res.destroy();
        });
        res.on('end', () => {
          clearTimeout(timeout);
          resolve({ html: html.substring(0, 100000), headers: res.headers });
        });
      });

      req.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      req.end();
    });
  }

  /**
   * Detect CMS from page content and headers
   */
  detectCMSFromContent(html, headers) {
    const headerStr = JSON.stringify(headers).toLowerCase();
    const htmlLower = html.toLowerCase();
    const detectedCMS = [];

    for (const [key, cms] of Object.entries(this.cmsSignatures)) {
      let score = 0;
      const matchedPatterns = [];

      // Check HTML patterns
      for (const pattern of cms.patterns) {
        if (htmlLower.includes(pattern.toLowerCase())) {
          score += 10;
          matchedPatterns.push(pattern);
        }
      }

      // Check headers
      for (const headerPattern of cms.headers) {
        if (headerStr.includes(headerPattern.toLowerCase())) {
          score += 15;
          matchedPatterns.push(`header: ${headerPattern}`);
        }
      }

      if (score > 0) {
        detectedCMS.push({
          key,
          ...cms,
          confidence: Math.min(100, score),
          matchedPatterns,
        });
      }
    }

    // Sort by confidence and return the best match
    detectedCMS.sort((a, b) => b.confidence - a.confidence);
    return detectedCMS[0] || null;
  }

  /**
   * Detect current hosting provider
   */
  async detectCurrentHost(hostname) {
    const hostPatterns = {
      'wpengine': { name: 'WP Engine', category: 'Managed WordPress' },
      'kinsta': { name: 'Kinsta', category: 'Managed WordPress' },
      'flywheel': { name: 'Flywheel', category: 'Managed WordPress' },
      'pantheon': { name: 'Pantheon', category: 'Managed Hosting' },
      'cloudflare': { name: 'Cloudflare', category: 'CDN/Edge' },
      'vercel': { name: 'Vercel', category: 'JAMstack' },
      'netlify': { name: 'Netlify', category: 'JAMstack' },
      'amazonaws': { name: 'AWS', category: 'Cloud Provider' },
      'digitalocean': { name: 'DigitalOcean', category: 'Cloud VPS' },
      'linode': { name: 'Linode', category: 'Cloud VPS' },
      'vultr': { name: 'Vultr', category: 'Cloud VPS' },
      'hetzner': { name: 'Hetzner', category: 'Cloud VPS' },
      'googleusercontent': { name: 'Google Cloud', category: 'Cloud Provider' },
      'azurewebsites': { name: 'Azure', category: 'Cloud Provider' },
      'shopify': { name: 'Shopify', category: 'E-commerce Platform' },
      'squarespace': { name: 'Squarespace', category: 'Website Builder' },
      'wix': { name: 'Wix', category: 'Website Builder' },
      'godaddy': { name: 'GoDaddy', category: 'Shared Hosting' },
      'bluehost': { name: 'Bluehost', category: 'Shared Hosting' },
      'hostgator': { name: 'HostGator', category: 'Shared Hosting' },
      'siteground': { name: 'SiteGround', category: 'Shared Hosting' },
      'dreamhost': { name: 'DreamHost', category: 'Shared Hosting' },
    };

    try {
      // Check CNAME records
      const cnames = await dns.resolveCname(hostname).catch(() => []);
      for (const cname of cnames) {
        const cnameLower = cname.toLowerCase();
        for (const [pattern, host] of Object.entries(hostPatterns)) {
          if (cnameLower.includes(pattern)) {
            return { ...host, detectedVia: 'CNAME', value: cname };
          }
        }
      }

      // Check NS records for hosting clues
      const nsRecords = await dns.resolveNs(hostname).catch(() => []);
      for (const ns of nsRecords) {
        const nsLower = ns.toLowerCase();
        for (const [pattern, host] of Object.entries(hostPatterns)) {
          if (nsLower.includes(pattern)) {
            return { ...host, detectedVia: 'NS', value: ns };
          }
        }
      }

    } catch (error) {
      logger.debug('Host detection error', { error: error.message });
    }

    return null;
  }

  /**
   * Get recommended hosts for a specific CMS
   */
  getRecommendedHosts(cmsKey) {
    const recommended = [];
    
    for (const provider of this.hostingProviders) {
      const isRecommended = provider.bestFor.includes(cmsKey) || 
                           provider.bestFor.includes('wordpress') && cmsKey === 'generic';
      
      if (isRecommended) {
        recommended.push({
          ...provider,
          matchScore: provider.bestFor.includes(cmsKey) ? 100 : 50,
          cheapestPlan: provider.plans[0],
          bestValuePlan: this.findBestValuePlan(provider.plans),
        });
      }
    }

    // Sort by rating and match score
    recommended.sort((a, b) => {
      const scoreA = a.matchScore + (a.rating * 10);
      const scoreB = b.matchScore + (b.rating * 10);
      return scoreB - scoreA;
    });

    return recommended.slice(0, 10); // Top 10 recommendations
  }

  /**
   * Estimate website traffic tier based on multiple signals
   */
  async estimateTrafficTier(hostname, pageContent, currentHost) {
    const indicators = [];
    let score = 0; // Higher = more enterprise-like
    
    const hostnameClean = hostname.toLowerCase().replace(/^www\./, '');
    const domainParts = hostnameClean.split('.');
    const domainName = domainParts[0];
    const tld = domainParts.slice(-1)[0];

    // 1. Check for enterprise brand keywords in domain (MAJOR weight - known brands are enterprise)
    for (const brand of this.enterpriseIndicators.knownBrands) {
      if (domainName === brand || domainName.includes(brand)) {
        // Exact match = definitely enterprise, partial match = high likelihood
        const matchScore = domainName === brand ? 65 : 50;
        score += matchScore;
        indicators.push({ signal: 'Known brand', detail: `Matches known brand: ${brand}`, weight: 'high', icon: '🏢' });
        break;
      }
    }

    // 2. Check for enterprise-indicating suffixes (resort, hotel, etc)
    for (const suffix of this.enterpriseIndicators.brandSuffixes) {
      if (domainName.includes(suffix) || hostnameClean.includes(suffix)) {
        score += 30;
        indicators.push({ signal: 'Enterprise domain', detail: `Contains business indicator: ${suffix}`, weight: 'medium', icon: '🏷️' });
        break;
      }
    }

    // 3. Check for enterprise TLDs
    for (const tld of this.enterpriseIndicators.enterpriseTLDs) {
      if (hostnameClean.endsWith(tld)) {
        score += 35;
        indicators.push({ signal: 'Premium TLD', detail: `Uses enterprise TLD: ${tld}`, weight: 'high', icon: '🌐' });
        break;
      }
    }

    // 4. Check current host for enterprise infrastructure
    if (currentHost) {
      const hostName = currentHost.name?.toLowerCase() || '';
      const isEnterpriseCDN = this.enterpriseIndicators.enterpriseCDNs.some(cdn => hostName.includes(cdn));
      const isEnterpriseHost = ['aws', 'google cloud', 'azure', 'cloudflare', 'akamai', 'fastly'].some(h => hostName.includes(h));
      
      if (isEnterpriseCDN) {
        score += 30;
        indicators.push({ signal: 'Enterprise CDN', detail: `Uses enterprise CDN: ${currentHost.name}`, weight: 'high', icon: '⚡' });
      } else if (isEnterpriseHost) {
        score += 20;
        indicators.push({ signal: 'Cloud infrastructure', detail: `Hosted on: ${currentHost.name}`, weight: 'medium', icon: '☁️' });
      }
    }

    // 5. Analyze response headers for enterprise signals
    if (pageContent?.headers) {
      const headers = pageContent.headers;
      
      // Enterprise security headers
      if (headers['strict-transport-security']) {
        score += 5;
        indicators.push({ signal: 'HSTS enabled', detail: 'Uses HTTP Strict Transport Security', weight: 'low', icon: '🔒' });
      }
      if (headers['content-security-policy']) {
        score += 8;
        indicators.push({ signal: 'CSP enabled', detail: 'Has Content Security Policy', weight: 'medium', icon: '🛡️' });
      }
      
      // CDN headers
      const cdnHeaders = ['cf-ray', 'x-cache', 'x-amz-cf-id', 'x-cdn', 'via', 'x-akamai', 'x-fastly', 'x-served-by'];
      for (const h of cdnHeaders) {
        if (headers[h]) {
          score += 10;
          indicators.push({ signal: 'CDN detected', detail: `CDN header: ${h}`, weight: 'medium', icon: '🌍' });
          break;
        }
      }

      // Load balancer indicators
      if (headers['x-backend-server'] || headers['x-served-by'] || headers['x-instance']) {
        score += 15;
        indicators.push({ signal: 'Load balanced', detail: 'Multiple backend servers detected', weight: 'medium', icon: '⚖️' });
      }
    }

    // 6. Analyze HTML content for enterprise signals
    if (pageContent?.html) {
      const html = pageContent.html.toLowerCase();
      
      // Check for enterprise third-party integrations
      if (html.includes('salesforce') || html.includes('marketo') || html.includes('hubspot')) {
        score += 15;
        indicators.push({ signal: 'Enterprise marketing', detail: 'Uses enterprise marketing platform', weight: 'medium', icon: '📊' });
      }
      
      // Check for A/B testing platforms (indicates traffic)
      if (html.includes('optimizely') || html.includes('vwo.com') || html.includes('google optimize')) {
        score += 12;
        indicators.push({ signal: 'A/B testing', detail: 'Uses optimization platform', weight: 'medium', icon: '🔬' });
      }

      // Check for advanced analytics
      if (html.includes('adobe analytics') || html.includes('omniture') || html.includes('segment.com')) {
        score += 15;
        indicators.push({ signal: 'Enterprise analytics', detail: 'Uses enterprise analytics', weight: 'medium', icon: '📈' });
      }

      // Check for chat/support platforms
      if (html.includes('zendesk') || html.includes('intercom') || html.includes('drift')) {
        score += 8;
        indicators.push({ signal: 'Support platform', detail: 'Has enterprise support tools', weight: 'low', icon: '💬' });
      }

      // Check for reservations/booking systems (high-traffic indicator)
      if (html.includes('booking engine') || html.includes('reservation') || html.includes('book now') || 
          html.includes('availability') || html.includes('check rates')) {
        score += 10;
        indicators.push({ signal: 'Booking system', detail: 'Has reservation/booking functionality', weight: 'medium', icon: '📅' });
      }
    }

    // 7. DNS complexity check
    try {
      const [aRecords, mxRecords, txtRecords] = await Promise.all([
        dns.resolve4(hostname).catch(() => []),
        dns.resolveMx(hostname).catch(() => []),
        dns.resolveTxt(hostname).catch(() => [])
      ]);
      
      // Multiple A records = load balanced
      if (aRecords.length > 1) {
        score += 15;
        indicators.push({ signal: 'Multiple IPs', detail: `${aRecords.length} A records (load balanced)`, weight: 'medium', icon: '🔀' });
      }

      // SPF/DKIM/DMARC = professional email setup
      const hasSPF = txtRecords.some(r => r.join('').includes('v=spf1'));
      const hasDMARC = await dns.resolveTxt(`_dmarc.${hostname}`).catch(() => []).then(r => r.length > 0);
      if (hasSPF || hasDMARC) {
        score += 5;
        indicators.push({ signal: 'Email security', detail: 'Has SPF/DKIM/DMARC configured', weight: 'low', icon: '📧' });
      }
    } catch (e) {
      // Ignore DNS errors
    }

    // Determine tier based on score
    let tier;
    let confidence;
    
    if (score >= 60) {
      tier = { ...this.trafficTiers.enterprise, key: 'enterprise' };
      confidence = Math.min(95, 60 + score - 60);
    } else if (score >= 35) {
      tier = { ...this.trafficTiers.business, key: 'business' };
      confidence = Math.min(85, 50 + score - 35);
    } else if (score >= 15) {
      tier = { ...this.trafficTiers.startup, key: 'startup' };
      confidence = Math.min(75, 40 + score);
    } else {
      tier = { ...this.trafficTiers.personal, key: 'personal' };
      confidence = Math.min(70, 50 + (15 - score));
    }

    logger.info('Traffic tier estimated', { hostname, tier: tier.name, score, confidence, indicatorCount: indicators.length });

    return { tier, indicators, score, confidence };
  }

  /**
   * Get recommended hosts filtered by traffic tier and user preferences
   * @param {string} cmsKey - The CMS type
   * @param {Object} trafficTier - The traffic tier object
   * @param {Object} filters - Additional user preference filters
   */
  getRecommendedHostsForTier(cmsKey, trafficTier, filters = {}) {
    const recommended = [];
    const tierKey = trafficTier?.key || 'personal';
    const allowedCategories = trafficTier?.recommendedCategories || [];
    const minPrice = trafficTier?.minMonthly || 0;
    
    // Extract filter preferences
    const { priority, region, ecommerceLevel, requiredFeatures, storageNeeds } = filters;
    
    for (const provider of this.hostingProviders) {
      // Check if provider category is appropriate for tier
      const categoryAllowed = allowedCategories.length === 0 || allowedCategories.includes(provider.category);
      
      // Check if cheapest plan meets minimum price threshold
      const cheapestPrice = provider.plans[0]?.price || 0;
      const priceAppropriate = cheapestPrice >= minPrice;
      
      // For enterprise/business, also check if provider has adequate plans
      const hasAdequatePlans = tierKey === 'enterprise' || tierKey === 'business' 
        ? provider.plans.some(p => typeof p.price === 'number' && p.price >= minPrice)
        : true;
      
      // Check CMS compatibility
      const isRecommended = provider.bestFor.includes(cmsKey) || 
                           (provider.bestFor.includes('wordpress') && cmsKey === 'generic');
      
      // NEW: Check region compatibility
      const regionMatch = !region || !provider.regions || provider.regions.includes(region);
      
      // NEW: Check e-commerce level compatibility
      const ecommerceMatch = this.checkEcommerceCompatibility(provider, ecommerceLevel);
      
      // NEW: Check required features
      const featuresMatch = this.checkRequiredFeatures(provider, requiredFeatures);
      
      // NEW: Check storage needs
      const storageMatch = this.checkStorageCompatibility(provider, storageNeeds);
      
      if (isRecommended && (categoryAllowed || priceAppropriate) && hasAdequatePlans && 
          regionMatch && ecommerceMatch && featuresMatch && storageMatch) {
        // Find the appropriate plan for this tier
        const appropriatePlan = this.findAppropriateplanForTier(provider.plans, minPrice);
        
        // Calculate comprehensive match score
        const matchScore = this.calculateMatchScore(provider, {
          cmsKey, tierKey, priority, region, ecommerceLevel, requiredFeatures
        });
        
        recommended.push({
          ...provider,
          matchScore,
          tierAppropriate: true,
          recommendedPlan: appropriatePlan,
          cheapestPlan: appropriatePlan || provider.plans[0],
          bestValuePlan: this.findBestValuePlan(provider.plans.filter(p => p.price >= minPrice)),
          tierNote: this.getTierNote(provider, tierKey, minPrice),
          matchReasons: this.getMatchReasons(provider, { cmsKey, region, ecommerceLevel, priority }),
        });
      }
    }

    // Sort based on priority preference
    this.sortByPriority(recommended, priority);

    return recommended.slice(0, 12);
  }

  /**
   * Check e-commerce compatibility
   */
  checkEcommerceCompatibility(provider, ecommerceLevel) {
    if (!ecommerceLevel || ecommerceLevel === 'none') return true;
    
    const ecommerceLevels = {
      none: 0,
      basic: 1,
      medium: 2,
      large: 3,
      enterprise: 4
    };
    
    const providerLevel = ecommerceLevels[provider.ecommerceSupport] || 0;
    const requiredLevel = ecommerceLevels[ecommerceLevel] || 0;
    
    return providerLevel >= requiredLevel;
  }

  /**
   * Check if provider has required features
   */
  checkRequiredFeatures(provider, requiredFeatures) {
    if (!requiredFeatures || requiredFeatures.length === 0) return true;
    if (!provider.features) return false;
    
    // Check if provider has at least 70% of required features
    const matchedFeatures = requiredFeatures.filter(f => provider.features.includes(f));
    return matchedFeatures.length >= Math.ceil(requiredFeatures.length * 0.7);
  }

  /**
   * Check storage compatibility
   */
  checkStorageCompatibility(provider, storageNeeds) {
    if (!storageNeeds) return true;
    
    // Check if any plan meets storage needs
    for (const plan of provider.plans) {
      const planStorage = this.parseStorageValue(plan.storage);
      if (planStorage >= storageNeeds || planStorage === Infinity) {
        return true;
      }
    }
    return false;
  }

  /**
   * Parse storage string to number (in GB)
   */
  parseStorageValue(storageStr) {
    if (!storageStr || storageStr === 'Unlimited' || storageStr === 'N/A') return Infinity;
    const match = storageStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Calculate comprehensive match score
   */
  calculateMatchScore(provider, criteria) {
    let score = 0;
    
    // CMS match (40 points max)
    if (provider.bestFor.includes(criteria.cmsKey)) score += 40;
    else if (provider.bestFor.includes('wordpress') && criteria.cmsKey === 'generic') score += 20;
    
    // Rating bonus (20 points max)
    score += (provider.rating - 4) * 40; // 4.5 rating = +20 points
    
    // Region match (10 points)
    if (criteria.region && provider.regions?.includes(criteria.region)) score += 10;
    
    // E-commerce support (10 points)
    if (criteria.ecommerceLevel !== 'none') {
      const levels = { none: 0, basic: 5, medium: 10, large: 15, enterprise: 20 };
      score += levels[provider.ecommerceSupport] || 0;
    }
    
    // Features match (10 points max)
    if (criteria.requiredFeatures?.length > 0 && provider.features) {
      const matched = criteria.requiredFeatures.filter(f => provider.features.includes(f)).length;
      score += (matched / criteria.requiredFeatures.length) * 10;
    }
    
    // Priority bonuses (20 points max)
    score += this.getPriorityScore(provider, criteria.priority);

    return roundTo(score, 0);
  }

  /**
   * Get priority-based score bonus
   */
  getPriorityScore(provider, priority) {
    switch (priority) {
      case 'speed':
        if (provider.category.includes('JAMstack') || provider.category.includes('Managed')) return 20;
        if (provider.category === 'Cloud VPS') return 10;
        return 0;
      case 'budget':
        const cheapestPrice = provider.plans[0]?.price || 0;
        if (cheapestPrice === 0) return 20;
        if (cheapestPrice < 5) return 15;
        if (cheapestPrice < 10) return 10;
        return 0;
      case 'support':
        if (provider.support?.includes('24/7')) return 20;
        if (provider.support?.includes('Phone')) return 15;
        if (provider.support?.includes('Chat')) return 10;
        return 0;
      case 'uptime':
        if (provider.uptime === '99.99%') return 20;
        if (provider.uptime === '99.9%') return 10;
        return 0;
      case 'scalability':
        if (provider.category === 'Cloud VPS' || provider.category === 'Cloud Provider') return 20;
        if (provider.category.includes('Managed')) return 15;
        return 0;
      case 'security':
        if (provider.features?.includes('uptime99') && provider.features?.includes('ssl')) return 20;
        if (provider.features?.includes('backup')) return 10;
        return 0;
      case 'ecommerce':
        const ecomLevels = { enterprise: 20, large: 15, medium: 10, basic: 5, none: 0 };
        return ecomLevels[provider.ecommerceSupport] || 0;
      default:
        return 0;
    }
  }

  /**
   * Sort recommendations by priority
   */
  sortByPriority(recommendations, priority) {
    recommendations.sort((a, b) => {
      // Primary sort by match score
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      
      // Secondary sort based on priority
      switch (priority) {
        case 'budget':
          const priceA = a.cheapestPlan?.price || 0;
          const priceB = b.cheapestPlan?.price || 0;
          return priceA - priceB;
        case 'speed':
        case 'uptime':
          // Managed hosts and JAMstack first
          const catOrder = { 'Managed WordPress': 1, 'JAMstack/Edge': 2, 'Managed Cloud': 3, 'Cloud VPS': 4, 'Cloud Provider': 5, 'Shared Hosting': 6 };
          return (catOrder[a.category] || 7) - (catOrder[b.category] || 7);
        case 'support':
          // 24/7 support first
          const supportA = a.support?.includes('24/7') ? 0 : 1;
          const supportB = b.support?.includes('24/7') ? 0 : 1;
          return supportA - supportB;
        default:
          return b.rating - a.rating;
      }
    });
  }

  /**
   * Get human-readable match reasons
   */
  getMatchReasons(provider, criteria) {
    const reasons = [];
    
    if (provider.bestFor.includes(criteria.cmsKey)) {
      reasons.push(`Optimized for ${criteria.cmsKey}`);
    }
    if (criteria.region && provider.regions?.includes(criteria.region)) {
      const regionNames = { us: 'US', eu: 'Europe', uk: 'UK', asia: 'Asia Pacific', au: 'Australia', latam: 'Latin America' };
      reasons.push(`Data centers in ${regionNames[criteria.region] || criteria.region}`);
    }
    if (criteria.ecommerceLevel !== 'none' && provider.ecommerceSupport) {
      reasons.push(`${provider.ecommerceSupport} e-commerce support`);
    }
    if (provider.uptime === '99.99%') {
      reasons.push('99.99% uptime guarantee');
    }
    if (provider.migrationDifficulty === 'easy') {
      reasons.push('Easy migration');
    }
    
    return reasons.slice(0, 3);
  }

  /**
   * Find appropriate plan for traffic tier
   */
  findAppropriateplanForTier(plans, minPrice) {
    // Find cheapest plan that meets minimum price
    for (const plan of plans) {
      if (typeof plan.price === 'number' && plan.price >= minPrice) {
        return plan;
      }
    }
    return plans[plans.length - 1]; // Return highest plan if none meet minimum
  }

  /**
   * Get tier-specific note for a provider
   */
  getTierNote(provider, tierKey, minPrice) {
    if (tierKey === 'enterprise') {
      if (provider.category === 'Managed WordPress' || provider.category === 'Managed Cloud') {
        return 'Recommended for enterprise - includes managed support and SLA';
      }
      if (provider.category === 'Cloud Provider') {
        return 'Requires DevOps expertise - consider managed alternatives';
      }
    }
    if (tierKey === 'business' && provider.plans[0]?.price < minPrice) {
      return `Entry plan shown is $${minPrice}+/mo for adequate performance`;
    }
    return null;
  }

  /**
   * Get all hosting providers filtered by tier and user preferences
   */
  getAllHostingProvidersForTier(trafficTier, filters = {}) {
    const tierKey = trafficTier?.key || 'personal';
    const minPrice = trafficTier?.minMonthly || 0;
    const allowedCategories = trafficTier?.recommendedCategories || [];
    
    const {
      region = null,
      ecommerceLevel = 'none',
      requiredFeatures = [],
      storageNeeds = null,
      billingPreference = 'annual'
    } = filters;
    
    return this.hostingProviders
      .filter(provider => {
        // For enterprise/business, filter out inappropriate options
        if (tierKey === 'enterprise' || tierKey === 'business') {
          const hasAdequatePlan = provider.plans.some(p => typeof p.price === 'number' && p.price >= minPrice);
          const categoryOk = allowedCategories.length === 0 || allowedCategories.includes(provider.category);
          if (!hasAdequatePlan || !categoryOk) return false;
        }
        
        // Region filter
        if (region && region !== 'global' && provider.regions) {
          if (!provider.regions.includes(region)) return false;
        }
        
        // E-commerce compatibility filter
        if (ecommerceLevel && ecommerceLevel !== 'none') {
          if (!this.checkEcommerceCompatibility(provider, ecommerceLevel)) return false;
        }
        
        // Required features filter (allow 50% match for all providers list)
        if (requiredFeatures && requiredFeatures.length > 0 && provider.features) {
          const matchedFeatures = requiredFeatures.filter(f => provider.features.includes(f));
          const matchRatio = matchedFeatures.length / requiredFeatures.length;
          if (matchRatio < 0.5) return false;
        }
        
        // Storage filter
        if (storageNeeds && !this.checkStorageCompatibility(provider, storageNeeds)) return false;
        
        return true;
      })
      .map(provider => {
        const appropriatePlan = this.findAppropriateplanForTier(provider.plans, minPrice);
        const matchScore = this.calculateMatchScore(provider, { region, ecommerceLevel, requiredFeatures, priority: filters.priority });
        const matchReasons = this.getMatchReasons(provider, { region, ecommerceLevel, requiredFeatures, priority: filters.priority });
        
        return {
          ...provider,
          cheapestPlan: appropriatePlan || provider.plans[0],
          mostExpensivePlan: provider.plans[provider.plans.length - 1],
          priceRange: `$${appropriatePlan?.price || provider.plans[0].price}-$${provider.plans[provider.plans.length - 1].price === 'Custom' ? '∞' : provider.plans[provider.plans.length - 1].price}`,
          tierNote: this.getTierNote(provider, tierKey, minPrice),
          matchScore,
          matchReasons,
          migrationDifficulty: provider.migrationDifficulty || 'medium',
          availableRegions: provider.regions || [],
          featuresBadges: this.getProviderFeatureBadges(provider, requiredFeatures),
        };
      })
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }
  
  /**
   * Generate feature badges for a provider
   */
  getProviderFeatureBadges(provider, requiredFeatures = []) {
    const badges = [];
    const allFeatures = ['ssl', 'cdn', 'backup', 'staging', 'email', 'migration', 'support247', 'uptime99'];
    
    const featureLabels = {
      ssl: 'SSL',
      cdn: 'CDN',
      backup: 'Backups',
      staging: 'Staging',
      email: 'Email',
      migration: 'Free Migration',
      support247: '24/7 Support',
      uptime99: '99.9%+ Uptime'
    };
    
    for (const feature of allFeatures) {
      if (provider.features && provider.features.includes(feature)) {
        badges.push({
          feature,
          label: featureLabels[feature],
          included: true,
          required: requiredFeatures.includes(feature)
        });
      } else {
        badges.push({
          feature,
          label: featureLabels[feature],
          included: false,
          required: requiredFeatures.includes(feature)
        });
      }
    }
    
    return badges;
  }

  /**
   * Count budget options that are hidden for enterprise tiers
   */
  countHiddenBudgetOptions() {
    return this.hostingProviders.filter(p => p.plans[0]?.price < 20).length;
  }

  /**
   * Calculate price comparison for tier-appropriate hosts
   */
  calculatePriceComparisonForTier(hosts, trafficTier) {
    if (!hosts || hosts.length === 0) return null;

    const minPrice = trafficTier?.minMonthly || 0;
    const prices = hosts
      .map(h => h.recommendedPlan?.price || h.cheapestPlan?.price)
      .filter(p => typeof p === 'number' && p >= minPrice);

    if (prices.length === 0) return null;

    return {
      lowestPrice: Math.min(...prices),
      highestPrice: Math.max(...prices),
      averagePrice: roundTo(prices.reduce((a, b) => a + b, 0) / prices.length, 2),
      medianPrice: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)],
      budgetOptions: hosts.filter(h => (h.recommendedPlan?.price || h.cheapestPlan?.price) <= minPrice * 2).length,
      premiumOptions: hosts.filter(h => (h.recommendedPlan?.price || h.cheapestPlan?.price) >= 50).length,
      tierMinimum: minPrice,
      tierName: trafficTier?.name || 'General',
    };
  }

  /**
   * Find savings opportunities within appropriate tier
   */
  findSavingsOpportunitiesForTier(currentHost, cmsKey, trafficTier) {
    const opportunities = [];
    const minPrice = trafficTier?.minMonthly || 0;
    const currentProviderData = this.hostingProviders.find(
      p => p.name.toLowerCase().includes(currentHost.name.toLowerCase())
    );

    if (!currentProviderData) return opportunities;

    const currentPlan = this.findAppropriateplanForTier(currentProviderData.plans, minPrice);
    const currentPrice = currentPlan?.price || 0;

    for (const provider of this.hostingProviders) {
      if (provider.name === currentProviderData.name) continue;
      if (!provider.bestFor.includes(cmsKey) && !provider.bestFor.includes('wordpress')) continue;

      const providerPlan = this.findAppropriateplanForTier(provider.plans, minPrice);
      const providerPrice = providerPlan?.price;
      if (typeof providerPrice !== 'number' || providerPrice < minPrice) continue;

      const savings = currentPrice - providerPrice;
      const savingsPercent = currentPrice > 0 ? roundTo((savings / currentPrice) * 100, 0) : 0;

      if (savings > 0 && savingsPercent >= 10) {
        opportunities.push({
          provider: provider.name,
          currentPrice,
          newPrice: providerPrice,
          currentPlan: currentPlan?.name,
          newPlan: providerPlan?.name,
          monthlySavings: savings,
          annualSavings: roundTo(savings * 12, 0),
          savingsPercent,
          category: provider.category,
          rating: provider.rating,
        });
      }
    }

    return opportunities.sort((a, b) => b.savingsPercent - a.savingsPercent).slice(0, 5);
  }

  /**
   * Get all hosting providers for full comparison
   */
  getAllHostingProviders() {
    return this.hostingProviders.map(provider => ({
      ...provider,
      cheapestPlan: provider.plans[0],
      mostExpensivePlan: provider.plans[provider.plans.length - 1],
      priceRange: `$${provider.plans[0].price}-$${provider.plans[provider.plans.length - 1].price === 'Custom' ? '∞' : provider.plans[provider.plans.length - 1].price}`,
    }));
  }

  /**
   * Find best value plan from a provider
   */
  findBestValuePlan(plans) {
    // Best value = most features per dollar for mid-tier plan
    if (plans.length <= 2) return plans[0];
    return plans[Math.floor(plans.length / 2)]; // Middle plan usually best value
  }

  /**
   * Calculate price comparison statistics
   */
  calculatePriceComparison(hosts) {
    if (!hosts || hosts.length === 0) return null;

    const prices = hosts
      .map(h => h.cheapestPlan?.price)
      .filter(p => typeof p === 'number');

    if (prices.length === 0) return null;

    return {
      lowestPrice: Math.min(...prices),
      highestPrice: Math.max(...prices),
      averagePrice: roundTo(prices.reduce((a, b) => a + b, 0) / prices.length, 2),
      medianPrice: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)],
      budgetOptions: hosts.filter(h => h.cheapestPlan?.price <= 5).length,
      premiumOptions: hosts.filter(h => h.cheapestPlan?.price >= 20).length,
    };
  }

  /**
   * Find savings opportunities
   */
  findSavingsOpportunities(currentHost, cmsKey) {
    const opportunities = [];
    const currentProviderData = this.hostingProviders.find(
      p => p.name.toLowerCase().includes(currentHost.name.toLowerCase())
    );

    if (!currentProviderData) return opportunities;

    const currentPrice = currentProviderData.plans[0]?.price || 0;

    for (const provider of this.hostingProviders) {
      if (provider.name === currentProviderData.name) continue;
      if (!provider.bestFor.includes(cmsKey) && !provider.bestFor.includes('wordpress')) continue;

      const providerPrice = provider.plans[0]?.price;
      if (typeof providerPrice !== 'number') continue;

      const savings = currentPrice - providerPrice;
      const savingsPercent = currentPrice > 0 ? roundTo((savings / currentPrice) * 100, 0) : 0;

      if (savings > 0 && savingsPercent >= 20) {
        opportunities.push({
          provider: provider.name,
          currentPrice,
          newPrice: providerPrice,
          monthlySavings: savings,
          annualSavings: savings * 12,
          savingsPercent,
          category: provider.category,
          rating: provider.rating,
        });
      }
    }

    return opportunities.sort((a, b) => b.savingsPercent - a.savingsPercent).slice(0, 5);
  }
}

module.exports = new IPReputationService();
