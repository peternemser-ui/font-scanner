/**
 * Fallback Recommendation Engine
 * Generates rich, data-driven strategic analysis from scan data when Claude API is unavailable.
 * Returns i18n keys (reports.fb.*) that the client-side resolve() function translates.
 *
 * Output is a strategic analysis object that complements the existing per-issue
 * fix cards rather than duplicating them.
 */

const { createLogger } = require('../utils/logger');
const logger = createLogger('FallbackRecommendations');

// ─── Impact scores for priority ordering ──────────────────────────────────

const IMPACT_WEIGHTS = { critical: 30, high: 20, medium: 10, low: 5 };

/**
 * Generate a strategic analysis object for a given analyzer type and scan data.
 */
function generateFallback(analyzerType, scanData, locale) {
  // Map client-side keys to canonical generator keys
  const aliases = {
    'cwv': 'core-web-vitals',
    'fonts': 'enhanced-fonts',
    'mobile': 'mobile-analyzer',
    'hosting': 'hosting-analyzer',
    'cro': 'cro-analysis',
    'gdpr': 'gdpr-compliance',
    'local-seo': 'geo-seo',
    'competitive': 'competitive-analysis',
    'performance-snapshot': 'performance',
  };

  const canonical = aliases[analyzerType] || analyzerType;

  const generators = {
    'security': analyzeSecurityStrategic,
    'seo': analyzeSeoStrategic,
    'performance': analyzePerformanceStrategic,
    'accessibility': analyzeAccessibilityStrategic,
    'core-web-vitals': analyzeCwvStrategic,
    'enhanced-fonts': analyzeFontStrategic,
    'tag-intelligence': analyzeTagStrategic,
    'broken-links': analyzeBrokenLinksStrategic,
    'mobile-analyzer': analyzeMobileStrategic,
    'hosting-analyzer': analyzeHostingStrategic,
    'site-crawler': analyzeCrawlerStrategic,
    'cro-analysis': analyzeCroStrategic,
    'brand-consistency': analyzeBrandStrategic,
    'geo-seo': analyzeGeoSeoStrategic,
    'gdpr-compliance': analyzeGdprStrategic,
    'ip-reputation': analyzeIpStrategic,
    'competitive-analysis': analyzeCompetitiveStrategic,
  };

  const generator = generators[canonical] || analyzeGenericStrategic;

  try {
    const result = generator(scanData || {}, analyzerType);
    logger.info('Generated strategic fallback analysis', { analyzerType, canonical, issueCount: result.priorityOrder?.length || 0 });
    return result;
  } catch (error) {
    logger.warn('Strategic fallback generation failed', { analyzerType, error: error.message });
    return analyzeGenericStrategic(scanData || {}, analyzerType);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Helper to build a parameterized i18n object */
function i(key, params, fallback) {
  return { key, params: params || {}, fallback: fallback || key };
}

function scoreLabel(score) {
  if (score == null) return 'reports.fb.common.scoreUnknown';
  if (score >= 90) return 'reports.fb.common.scoreExcellent';
  if (score >= 70) return 'reports.fb.common.scoreGood';
  if (score >= 50) return 'reports.fb.common.scoreFair';
  if (score >= 30) return 'reports.fb.common.scorePoor';
  return 'reports.fb.common.scoreCritical';
}

function scoreLabelText(score) {
  if (score == null) return 'unknown';
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}

function extractUrl(data) {
  return data.url || data.targetUrl || data.siteUrl || data.pageUrl || 'your site';
}

function buildStrategic(issues, assessment, totalImpact) {
  issues.sort((a, b) => (IMPACT_WEIGHTS[b.priority] || 0) - (IMPACT_WEIGHTS[a.priority] || 0));
  const totalPoints = issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0);

  const quickWin = issues.length > 0 ? {
    title: issues[0].quickWinTitle,
    description: issues[0].quickWinDesc,
    estimatedImpact: i('reports.fb.common.pointsPlus', { points: IMPACT_WEIGHTS[issues[0].priority] || 10 }, '+{{points}} points'),
  } : {
    title: 'reports.fb.common.continueMonitoring',
    description: 'reports.fb.common.continueMonitoringDesc',
    estimatedImpact: 'reports.fb.common.maintainScore',
  };

  const priorityOrder = issues.map(i => ({
    category: i.category,
    reason: i.reason,
  }));

  // Build connections (pairs of related issues)
  const connections = [];
  const seenGroups = new Set();
  for (let x = 0; x < issues.length; x++) {
    for (let y = x + 1; y < issues.length; y++) {
      if (issues[x].group && issues[x].group === issues[y].group && !seenGroups.has(issues[x].group)) {
        seenGroups.add(issues[x].group);
        connections.push({ text: issues[x].connectionText || i('reports.fb.common.relatedIssues', { cat1: issues[x].category, cat2: issues[y].category }, '{{cat1}} and {{cat2}} are related \u2014 address them together for maximum impact') });
      }
    }
  }

  return {
    source: 'fallback',
    strategic: true,
    assessment,
    priorityOrder: priorityOrder.length > 0 ? priorityOrder : [{ category: 'reports.fb.common.maintenance', reason: 'reports.fb.common.maintenanceReason' }],
    quickWin,
    connections: connections.length > 0 ? connections : null,
    totalImpact,
    totalPoints: totalPoints > 0 ? i('reports.fb.common.pointsPotential', { points: totalPoints }, '+{{points}} points potential') : null,
  };
}

// ─── Security ───────────────────────────────────────────────────────────────

function analyzeSecurityStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const ssl = data.ssl || data.sslDetails || {};
  const headers = data.headers || data.securityHeaders || {};
  const cookies = data.cookies || {};
  const overallScore = data.overallScore ?? data.score ?? data.securityScore;

  if (!ssl.valid && ssl.valid !== undefined) {
    issues.push({
      category: 'reports.fb.security.sslCategory',
      priority: 'critical',
      reason: i('reports.fb.security.sslReason', { url }, 'SSL certificate issues on {{url}} directly impact user trust, browser warnings, and search rankings. This is the single most visible security problem.'),
      quickWinTitle: 'reports.fb.security.sslQuickWinTitle',
      quickWinDesc: 'reports.fb.security.sslQuickWinDesc',
      group: 'server-config',
      connectionText: 'reports.fb.security.serverConfigConnection',
    });
  }

  const missingHeaders = [];
  if (!headers.contentSecurityPolicy && !headers.csp) missingHeaders.push('Content-Security-Policy');
  if (!headers.strictTransportSecurity && !headers.hsts) missingHeaders.push('Strict-Transport-Security');
  if (!headers.xFrameOptions) missingHeaders.push('X-Frame-Options');
  if (!headers.xContentTypeOptions) missingHeaders.push('X-Content-Type-Options');

  if (missingHeaders.length > 0) {
    issues.push({
      category: 'reports.fb.security.headersCategory',
      priority: missingHeaders.length >= 3 ? 'high' : 'medium',
      reason: i('reports.fb.security.headersReason', { count: missingHeaders.length, headers: missingHeaders.slice(0, 3).join(', '), extra: missingHeaders.length > 3 ? '...' : '' }, 'Missing {{count}} security headers ({{headers}}{{extra}}). These headers prevent XSS, clickjacking, and MIME sniffing attacks with zero performance cost.'),
      quickWinTitle: i('reports.fb.security.headersQuickWinTitle', { header: missingHeaders[0] }, 'Add {{header}} header'),
      quickWinDesc: i('reports.fb.security.headersQuickWinDesc', { header: missingHeaders[0] }, '{{header}} is the most impactful missing header. Adding it requires only a server configuration change and provides immediate protection against common attack vectors.'),
      group: 'server-config',
      connectionText: 'reports.fb.security.serverConfigConnection',
    });
  }

  const insecureCookies = cookies.insecure || cookies.insecureCount || 0;
  if (insecureCookies > 0) {
    issues.push({
      category: 'reports.fb.security.cookieCategory',
      priority: 'high',
      reason: i('reports.fb.security.cookieReason', { count: insecureCookies }, 'Found {{count}} cookie(s) without proper security flags. Insecure cookies can be intercepted on public networks or manipulated via XSS attacks.'),
      quickWinTitle: 'reports.fb.security.cookieQuickWinTitle',
      quickWinDesc: 'reports.fb.security.cookieQuickWinDesc',
      group: 'server-config',
    });
  }

  const outdated = data.vulnerabilities?.outdatedLibraries || data.outdatedLibraries || 0;
  if (outdated > 0) {
    issues.push({
      category: 'reports.fb.security.depsCategory',
      priority: 'high',
      reason: i('reports.fb.security.depsReason', { count: outdated }, 'Detected {{count}} outdated library/libraries with known vulnerabilities. Automated scanners actively exploit known CVEs, making this a high-risk exposure.'),
      quickWinTitle: 'reports.fb.security.depsQuickWinTitle',
      quickWinDesc: 'reports.fb.security.depsQuickWinDesc',
      group: 'code-deps',
    });
  }

  if (data.mixedContent || data.mixedContentCount > 0) {
    issues.push({
      category: 'reports.fb.security.mixedCategory',
      priority: 'medium',
      reason: 'reports.fb.security.mixedReason',
      quickWinTitle: 'reports.fb.security.mixedQuickWinTitle',
      quickWinDesc: 'reports.fb.security.mixedQuickWinDesc',
      group: 'code-deps',
      connectionText: 'reports.fb.security.codeDepsConnection',
    });
  }

  const issueCountText = issues.length > 0
    ? i('reports.fb.security.assessmentIssues', { count: issues.length }, '{{count}} security concern(s) were identified')
    : i('reports.fb.security.assessmentNoIssues', {}, 'No critical security issues were detected');

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.security.assessmentWithIssues', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore), count: issues.length }, 'Security analysis of {{url}} with a current score of {{score}}/100 ({{scoreLabel}}) found that {{count}} security concern(s) were identified. The issues range from server configuration gaps to client-side protections, and addressing them in priority order provides the most efficient path to a strong security posture.')
      : i('reports.fb.security.assessmentClean', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore) }, 'Security analysis of {{url}} with a current score of {{score}}/100 ({{scoreLabel}}) found that no critical security issues were detected. Your security posture is solid. Continue monitoring for new vulnerabilities and keep dependencies up to date.'),
    issues.length > 0
      ? i('reports.fb.security.totalImpact', { count: issues.length, points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Addressing all {{count}} security issues could improve your security score by approximately {{points}} points and significantly reduce your attack surface')
      : 'reports.fb.security.totalImpactClean'
  );
}

// ─── SEO ────────────────────────────────────────────────────────────────────

function analyzeSeoStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score ?? data.seoScore;

  const metaScore = data.metaScore ?? data.metaTagsScore;
  if (metaScore != null && metaScore < 80) {
    issues.push({
      category: 'reports.fb.seo.metaCategory',
      priority: metaScore < 50 ? 'critical' : 'high',
      reason: i('reports.fb.seo.metaReason', { score: metaScore, url }, 'Meta tag score is {{score}}/100. These tags directly control how {{url}} appears in search results and social media shares.'),
      quickWinTitle: 'reports.fb.seo.metaQuickWinTitle',
      quickWinDesc: i('reports.fb.seo.metaQuickWinDesc', { score: metaScore }, 'Your meta tags scored {{score}}/100. Well-crafted title tags (50-60 chars) and descriptions (150-160 chars) can improve click-through rates by 20-30%.'),
      group: 'on-page',
      connectionText: 'reports.fb.seo.onPageConnection',
    });
  }

  const headingScore = data.headingScore ?? data.headingsScore;
  if (headingScore != null && headingScore < 80) {
    issues.push({
      category: 'reports.fb.seo.headingCategory',
      priority: headingScore < 50 ? 'high' : 'medium',
      reason: i('reports.fb.seo.headingReason', { score: headingScore }, 'Heading structure scored {{score}}/100. Proper H1 \u2192 H2 \u2192 H3 hierarchy helps search engines understand your content organization and topic relevance.'),
      quickWinTitle: 'reports.fb.seo.headingQuickWinTitle',
      quickWinDesc: i('reports.fb.seo.headingQuickWinDesc', { score: headingScore }, 'A clear heading structure (scored {{score}}/100) signals content organization to search engines. Pages with proper heading hierarchy are 2x more likely to earn featured snippets.'),
      group: 'on-page',
      connectionText: 'reports.fb.seo.onPageConnection',
    });
  }

  const imageScore = data.imageScore ?? data.imagesScore;
  if (imageScore != null && imageScore < 80) {
    issues.push({
      category: 'reports.fb.seo.imageCategory',
      priority: imageScore < 40 ? 'high' : 'medium',
      reason: i('reports.fb.seo.imageReason', { score: imageScore }, 'Image optimization scored {{score}}/100. Missing alt text hurts both SEO (image search traffic) and accessibility compliance.'),
      quickWinTitle: 'reports.fb.seo.imageQuickWinTitle',
      quickWinDesc: i('reports.fb.seo.imageQuickWinDesc', { score: imageScore }, 'Image optimization is at {{score}}/100. Descriptive alt text opens up image search traffic (which accounts for ~20% of all Google searches) and improves accessibility.'),
      group: 'content',
      connectionText: 'reports.fb.seo.contentConnection',
    });
  }

  const linkScore = data.linkScore ?? data.linksScore;
  if (linkScore != null && linkScore < 80) {
    issues.push({
      category: 'reports.fb.seo.linkCategory',
      priority: linkScore < 40 ? 'high' : 'medium',
      reason: i('reports.fb.seo.linkReason', { score: linkScore }, 'Link health scored {{score}}/100. Broken links waste crawl budget, create dead-end user experiences, and leak PageRank.'),
      quickWinTitle: 'reports.fb.seo.linkQuickWinTitle',
      quickWinDesc: i('reports.fb.seo.linkQuickWinDesc', { score: linkScore }, 'Link health is at {{score}}/100. Repairing broken links recovers lost link equity and ensures search engines can fully crawl your site structure.'),
      group: 'content',
    });
  }

  if (data.canonicalIssues || data.duplicateContent) {
    issues.push({
      category: 'reports.fb.seo.canonicalCategory',
      priority: 'medium',
      reason: 'reports.fb.seo.canonicalReason',
      quickWinTitle: 'reports.fb.seo.canonicalQuickWinTitle',
      quickWinDesc: 'reports.fb.seo.canonicalQuickWinDesc',
      group: 'technical',
    });
  }

  if (data.schemaMarkup === false || data.structuredData === false) {
    issues.push({
      category: 'reports.fb.seo.schemaCategory',
      priority: 'low',
      reason: 'reports.fb.seo.schemaReason',
      quickWinTitle: 'reports.fb.seo.schemaQuickWinTitle',
      quickWinDesc: 'reports.fb.seo.schemaQuickWinDesc',
      group: 'technical',
      connectionText: 'reports.fb.seo.technicalConnection',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.seo.assessmentWithIssues', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore), count: issues.length }, 'SEO analysis of {{url}} scoring {{score}}/100 overall ({{scoreLabel}}) identified {{count}} areas for improvement. Addressing these in priority order will help search engines better understand, index, and rank your content.')
      : i('reports.fb.seo.assessmentClean', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore) }, 'SEO analysis of {{url}} scoring {{score}}/100 overall ({{scoreLabel}}) identified a strong SEO foundation. Your on-page SEO fundamentals are solid. Focus on content quality, backlink building, and monitoring search console data.'),
    issues.length > 0
      ? i('reports.fb.seo.totalImpact', { count: issues.length, points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Addressing all {{count}} SEO issues could improve your score by approximately {{points}} points and significantly boost organic search visibility')
      : 'reports.fb.seo.totalImpactClean'
  );
}

// ─── Performance ────────────────────────────────────────────────────────────

function analyzePerformanceStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score ?? data.performanceScore;

  const loadTime = data.loadTime ?? data.pageLoadTime;
  if (loadTime != null && loadTime > 2000) {
    const loadSec = (loadTime / 1000).toFixed(1);
    issues.push({
      category: 'reports.fb.performance.loadTimeCategory',
      priority: loadTime > 5000 ? 'critical' : loadTime > 3000 ? 'high' : 'medium',
      reason: i('reports.fb.performance.loadTimeReason', { seconds: loadSec }, 'Page loads in {{seconds}}s. Research shows 53% of mobile users abandon sites that take over 3 seconds to load. Every 100ms of improvement increases conversions by ~1%.'),
      quickWinTitle: 'reports.fb.performance.loadTimeQuickWinTitle',
      quickWinDesc: i('reports.fb.performance.loadTimeQuickWinDesc', { seconds: loadSec }, 'At {{seconds}}s load time, reducing Time to First Byte through server-side caching or CDN deployment provides the fastest path to improvement. Target under 2.5s for good user experience.'),
      group: 'delivery',
      connectionText: 'reports.fb.performance.deliveryConnection',
    });
  }

  const totalSize = data.totalSize ?? data.pageSize ?? data.totalPageSize;
  if (totalSize != null && totalSize > 2000000) {
    const sizeMb = (totalSize / 1048576).toFixed(1);
    issues.push({
      category: 'reports.fb.performance.pageSizeCategory',
      priority: totalSize > 5000000 ? 'critical' : 'high',
      reason: i('reports.fb.performance.pageSizeReason', { size: sizeMb }, 'Total page size is {{size}}MB. Heavy pages are especially painful on mobile networks where bandwidth is limited.'),
      quickWinTitle: 'reports.fb.performance.pageSizeQuickWinTitle',
      quickWinDesc: i('reports.fb.performance.pageSizeQuickWinDesc', { size: sizeMb }, 'At {{size}}MB, images are likely the biggest contributor to page weight. Converting to WebP/AVIF and implementing lazy loading can reduce page size by 40-70%.'),
      group: 'delivery',
      connectionText: 'reports.fb.performance.deliveryConnection',
    });
  }

  const requestCount = data.requestCount ?? data.totalRequests;
  if (requestCount != null && requestCount > 40) {
    issues.push({
      category: 'reports.fb.performance.requestsCategory',
      priority: requestCount > 80 ? 'high' : 'medium',
      reason: i('reports.fb.performance.requestsReason', { count: requestCount }, '{{count}} HTTP requests create significant network overhead. Each request adds latency from DNS lookup, TCP connection, and TLS handshake.'),
      quickWinTitle: 'reports.fb.performance.requestsQuickWinTitle',
      quickWinDesc: i('reports.fb.performance.requestsQuickWinDesc', { count: requestCount }, 'With {{count}} requests, bundling CSS/JS files, using CSS sprites, and removing unused resources could cut requests by 30-50%.'),
      group: 'delivery',
    });
  }

  const fcp = data.fcp ?? data.firstContentfulPaint;
  if (fcp != null && fcp > 1800) {
    const fcpSec = (fcp / 1000).toFixed(1);
    issues.push({
      category: 'reports.fb.performance.fcpCategory',
      priority: fcp > 3000 ? 'high' : 'medium',
      reason: i('reports.fb.performance.fcpReason', { seconds: fcpSec }, 'FCP at {{seconds}}s means users wait too long to see any content. Google considers FCP > 1.8s as "needs improvement".'),
      quickWinTitle: 'reports.fb.performance.fcpQuickWinTitle',
      quickWinDesc: i('reports.fb.performance.fcpQuickWinDesc', { seconds: fcpSec }, 'FCP of {{seconds}}s can be improved by deferring non-critical CSS/JS, inlining critical styles, and preloading key fonts. Target under 1.8s.'),
      group: 'rendering',
    });
  }

  const cacheScore = data.cacheScore ?? data.cachingScore;
  if (cacheScore != null && cacheScore < 60) {
    issues.push({
      category: 'reports.fb.performance.cacheCategory',
      priority: 'medium',
      reason: i('reports.fb.performance.cacheReason', { score: cacheScore }, 'Cache effectiveness scored {{score}}/100. Without proper caching, repeat visitors re-download unchanged resources.'),
      quickWinTitle: 'reports.fb.performance.cacheQuickWinTitle',
      quickWinDesc: i('reports.fb.performance.cacheQuickWinDesc', { score: cacheScore }, 'At {{score}}/100 for caching, adding Cache-Control headers with appropriate max-age values eliminates redundant downloads for returning visitors.'),
      group: 'server',
    });
  }

  if (data.renderBlocking || data.renderBlockingResources > 0) {
    const count = data.renderBlockingResources || 'multiple';
    issues.push({
      category: 'reports.fb.performance.renderBlockCategory',
      priority: 'high',
      reason: i('reports.fb.performance.renderBlockReason', { count }, '{{count}} render-blocking resource(s) delay the initial page render. The browser cannot display any content until these files are downloaded and processed.'),
      quickWinTitle: 'reports.fb.performance.renderBlockQuickWinTitle',
      quickWinDesc: 'reports.fb.performance.renderBlockQuickWinDesc',
      group: 'rendering',
      connectionText: 'reports.fb.performance.renderingConnection',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.performance.assessmentWithIssues', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore), count: issues.length }, 'Performance analysis of {{url}} scoring {{score}}/100 ({{scoreLabel}}) identified {{count}} optimization opportunities. Site speed directly impacts business metrics \u2014 slower sites see higher bounce rates, lower conversion rates, and reduced search rankings.')
      : i('reports.fb.performance.assessmentClean', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore) }, 'Performance analysis of {{url}} scoring {{score}}/100 ({{scoreLabel}}) identified strong performance fundamentals. Your performance metrics are within healthy ranges. Continue monitoring Core Web Vitals.'),
    issues.length > 0
      ? i('reports.fb.performance.totalImpact', { count: issues.length, points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Addressing all {{count}} performance issues could improve your score by approximately {{points}} points, reducing load times and improving user experience')
      : 'reports.fb.performance.totalImpactClean'
  );
}

// ─── Accessibility ──────────────────────────────────────────────────────────

function analyzeAccessibilityStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score ?? data.accessibilityScore;

  const contrastScore = data.contrastScore ?? data.colorContrastScore;
  if (contrastScore != null && contrastScore < 80) {
    issues.push({
      category: 'reports.fb.accessibility.contrastCategory',
      priority: contrastScore < 50 ? 'critical' : 'high',
      reason: i('reports.fb.accessibility.contrastReason', { score: contrastScore }, 'Contrast scored {{score}}/100. Low-contrast text is unreadable for the ~300 million people with color vision deficiency and fails WCAG 2.1 AA requirements.'),
      quickWinTitle: 'reports.fb.accessibility.contrastQuickWinTitle',
      quickWinDesc: i('reports.fb.accessibility.contrastQuickWinDesc', { score: contrastScore }, 'At {{score}}/100, adjusting text/background contrast to meet the 4.5:1 minimum ratio improves readability for all users.'),
      group: 'visual',
      connectionText: 'reports.fb.accessibility.visualConnection',
    });
  }

  const ariaScore = data.ariaScore ?? data.ariaLabelsScore;
  if (ariaScore != null && ariaScore < 80) {
    issues.push({
      category: 'reports.fb.accessibility.ariaCategory',
      priority: ariaScore < 50 ? 'critical' : 'high',
      reason: i('reports.fb.accessibility.ariaReason', { score: ariaScore }, 'ARIA compliance scored {{score}}/100. Missing or incorrect ARIA attributes make interactive elements unusable for those relying on assistive technology.'),
      quickWinTitle: 'reports.fb.accessibility.ariaQuickWinTitle',
      quickWinDesc: i('reports.fb.accessibility.ariaQuickWinDesc', { score: ariaScore }, 'ARIA score of {{score}}/100 indicates screen readers cannot properly announce interactive elements. Adding aria-label, aria-describedby, and proper roles ensures meaningful announcements.'),
      group: 'semantics',
    });
  }

  const altTextScore = data.altTextScore ?? data.imageAltScore;
  if (altTextScore != null && altTextScore < 80) {
    issues.push({
      category: 'reports.fb.accessibility.altTextCategory',
      priority: altTextScore < 50 ? 'high' : 'medium',
      reason: i('reports.fb.accessibility.altTextReason', { score: altTextScore }, 'Image alt text scored {{score}}/100. Images without alt text create content gaps for screen reader users.'),
      quickWinTitle: 'reports.fb.accessibility.altTextQuickWinTitle',
      quickWinDesc: i('reports.fb.accessibility.altTextQuickWinDesc', { score: altTextScore }, 'At {{score}}/100, your images need descriptive alt text. Good alt text describes the image purpose and doubles as SEO for image search.'),
      group: 'visual',
    });
  }

  const keyboardScore = data.keyboardScore ?? data.keyboardNavScore;
  if (keyboardScore != null && keyboardScore < 80) {
    issues.push({
      category: 'reports.fb.accessibility.keyboardCategory',
      priority: keyboardScore < 50 ? 'critical' : 'high',
      reason: i('reports.fb.accessibility.keyboardReason', { score: keyboardScore }, 'Keyboard navigation scored {{score}}/100. Users who cannot use a mouse are effectively locked out of inaccessible elements.'),
      quickWinTitle: 'reports.fb.accessibility.keyboardQuickWinTitle',
      quickWinDesc: i('reports.fb.accessibility.keyboardQuickWinDesc', { score: keyboardScore }, 'Keyboard score of {{score}}/100 means some interactive elements cannot be reached via Tab key. Adding proper tabindex, focus styles, and keyboard event handlers fixes this.'),
      group: 'interaction',
    });
  }

  const formScore = data.formScore ?? data.formsScore;
  if (formScore != null && formScore < 70) {
    issues.push({
      category: 'reports.fb.accessibility.formCategory',
      priority: 'medium',
      reason: i('reports.fb.accessibility.formReason', { score: formScore }, 'Form accessibility scored {{score}}/100. Forms without proper labels, error messages, and field associations are difficult to complete with assistive technology.'),
      quickWinTitle: 'reports.fb.accessibility.formQuickWinTitle',
      quickWinDesc: 'reports.fb.accessibility.formQuickWinDesc',
      group: 'interaction',
      connectionText: 'reports.fb.accessibility.interactionConnection',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.accessibility.assessmentWithIssues', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore), count: issues.length }, 'Accessibility analysis of {{url}} scoring {{score}}/100 ({{scoreLabel}}) found {{count}} barriers that may prevent some users from accessing content. Accessibility is both a legal requirement and a business opportunity.')
      : i('reports.fb.accessibility.assessmentClean', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore) }, 'Accessibility analysis of {{url}} scoring {{score}}/100 ({{scoreLabel}}) found a generally accessible experience. Your accessibility compliance is strong. Continue testing with real assistive technology.'),
    issues.length > 0
      ? i('reports.fb.accessibility.totalImpact', { count: issues.length, points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Addressing all {{count}} accessibility issues could improve your compliance score by approximately {{points}} points and make your site usable for all visitors')
      : 'reports.fb.accessibility.totalImpactClean'
  );
}

// ─── Core Web Vitals ────────────────────────────────────────────────────────

function analyzeCwvStrategic(data) {
  const issues = [];
  const url = extractUrl(data);

  const lcp = data.lcp ?? data.largestContentfulPaint;
  if (lcp != null) {
    const lcpSec = (lcp / 1000).toFixed(1);
    if (lcp > 2500) {
      issues.push({
        category: 'reports.fb.cwv.lcpCategory',
        priority: lcp > 4000 ? 'critical' : 'high',
        reason: i('reports.fb.cwv.lcpReason', { seconds: lcpSec, rating: lcp > 4000 ? 'poor' : 'needs improvement' }, 'LCP is {{seconds}}s ({{rating}} \u2014 target is under 2.5s). LCP is Google\'s primary loading metric and directly affects your search ranking.'),
        quickWinTitle: 'reports.fb.cwv.lcpQuickWinTitle',
        quickWinDesc: i('reports.fb.cwv.lcpQuickWinDesc', { seconds: lcpSec }, 'LCP of {{seconds}}s can be improved by preloading hero images, using appropriate image formats (WebP/AVIF), implementing a CDN, and reducing server response time.'),
        group: 'rendering',
        connectionText: 'reports.fb.cwv.renderingConnection',
      });
    }
  }

  const cls = data.cls ?? data.cumulativeLayoutShift;
  if (cls != null) {
    if (cls > 0.1) {
      issues.push({
        category: 'reports.fb.cwv.clsCategory',
        priority: cls > 0.25 ? 'critical' : 'high',
        reason: i('reports.fb.cwv.clsReason', { value: cls.toFixed(3), rating: cls > 0.25 ? 'poor' : 'needs improvement' }, 'CLS is {{value}} ({{rating}} \u2014 target is under 0.1). High CLS means elements visually shift after loading, frustrating users.'),
        quickWinTitle: 'reports.fb.cwv.clsQuickWinTitle',
        quickWinDesc: i('reports.fb.cwv.clsQuickWinDesc', { value: cls.toFixed(3) }, 'CLS of {{value}} is typically caused by images/ads/embeds loading without reserved space. Adding width/height attributes or CSS aspect-ratio prevents layout shifts.'),
        group: 'rendering',
      });
    }
  }

  const inp = data.inp ?? data.interactionToNextPaint;
  if (inp != null) {
    if (inp > 200) {
      issues.push({
        category: 'reports.fb.cwv.inpCategory',
        priority: inp > 500 ? 'critical' : 'high',
        reason: i('reports.fb.cwv.inpReason', { ms: inp, rating: inp > 500 ? 'poor' : 'needs improvement' }, 'INP is {{ms}}ms ({{rating}} \u2014 target is under 200ms). INP measures how quickly your site responds to user interactions.'),
        quickWinTitle: 'reports.fb.cwv.inpQuickWinTitle',
        quickWinDesc: i('reports.fb.cwv.inpQuickWinDesc', { ms: inp }, 'INP of {{ms}}ms indicates the main thread is blocked during interactions. Break long tasks into smaller chunks using requestIdleCallback or setTimeout.'),
        group: 'interactivity',
      });
    }
  }

  const fcp = data.fcp ?? data.firstContentfulPaint;
  if (fcp != null && fcp > 1800) {
    const fcpSec = (fcp / 1000).toFixed(1);
    issues.push({
      category: 'reports.fb.cwv.fcpCategory',
      priority: fcp > 3000 ? 'high' : 'medium',
      reason: i('reports.fb.cwv.fcpReason', { seconds: fcpSec }, 'FCP is {{seconds}}s. While not a Core Web Vital itself, FCP measures when users first see any content.'),
      quickWinTitle: 'reports.fb.cwv.fcpQuickWinTitle',
      quickWinDesc: i('reports.fb.cwv.fcpQuickWinDesc', { seconds: fcpSec }, 'FCP of {{seconds}}s can be improved by inlining critical CSS, deferring non-essential scripts, and preloading fonts.'),
      group: 'rendering',
    });
  }

  const ttfb = data.ttfb ?? data.timeToFirstByte;
  if (ttfb != null && ttfb > 800) {
    const ttfbMs = Math.round(ttfb);
    issues.push({
      category: 'reports.fb.cwv.ttfbCategory',
      priority: ttfb > 1800 ? 'high' : 'medium',
      reason: i('reports.fb.cwv.ttfbReason', { ms: ttfbMs }, 'TTFB is {{ms}}ms. A slow server response delays everything downstream \u2014 no amount of frontend optimization can compensate.'),
      quickWinTitle: 'reports.fb.cwv.ttfbQuickWinTitle',
      quickWinDesc: i('reports.fb.cwv.ttfbQuickWinDesc', { ms: ttfbMs }, 'TTFB of {{ms}}ms suggests server-side optimization is needed. Consider server-side caching, database query optimization, or a CDN.'),
      group: 'server',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.cwv.assessmentWithIssues', { url, count: issues.length }, 'Core Web Vitals analysis of {{url}} shows {{count}} metrics that need attention. These metrics directly affect your Google search ranking.')
      : i('reports.fb.cwv.assessmentClean', { url }, 'Core Web Vitals analysis of {{url}} shows all metrics within acceptable ranges. All three core metrics (LCP, CLS, INP) are within Google\'s "good" threshold.'),
    issues.length > 0
      ? 'reports.fb.cwv.totalImpact'
      : 'reports.fb.cwv.totalImpactClean'
  );
}

// ─── Font & Typography ────────────────────────────────────────────────────

function analyzeFontStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score;
  const fontCount = data.fontCount ?? data.totalFonts ?? data.fontsDetected;
  const loadingScore = data.loadingScore ?? data.fontLoadingScore;

  if (fontCount != null && fontCount > 4) {
    issues.push({
      category: 'reports.fb.fonts.countCategory',
      priority: fontCount > 8 ? 'high' : 'medium',
      reason: i('reports.fb.fonts.countReason', { count: fontCount }, '{{count}} different fonts detected. Each font family adds ~100-300KB to page weight. Google recommends no more than 2-3 font families per page.'),
      quickWinTitle: 'reports.fb.fonts.countQuickWinTitle',
      quickWinDesc: i('reports.fb.fonts.countQuickWinDesc', { count: fontCount }, 'Consolidating from {{count}} fonts to 2-3 carefully chosen families reduces page weight and creates a more cohesive visual design.'),
      group: 'loading',
      connectionText: 'reports.fb.fonts.loadingConnection',
    });
  }

  if (loadingScore != null && loadingScore < 70) {
    issues.push({
      category: 'reports.fb.fonts.loadingCategory',
      priority: 'high',
      reason: i('reports.fb.fonts.loadingReason', { score: loadingScore }, 'Font loading scored {{score}}/100. Without font-display: swap and preloading, users see a flash of invisible text (FOIT) or flash of unstyled text (FOUT).'),
      quickWinTitle: 'reports.fb.fonts.loadingQuickWinTitle',
      quickWinDesc: i('reports.fb.fonts.loadingQuickWinDesc', { score: loadingScore }, 'At {{score}}/100, implementing font-display: swap shows fallback text immediately while custom fonts load. Add <link rel="preload"> for critical fonts.'),
      group: 'loading',
    });
  }

  if (data.fontSizeConsistency != null && data.fontSizeConsistency < 70) {
    issues.push({
      category: 'reports.fb.fonts.consistencyCategory',
      priority: 'medium',
      reason: i('reports.fb.fonts.consistencyReason', { score: data.fontSizeConsistency }, 'Font size consistency scored {{score}}/100. Inconsistent type scales make content harder to scan and reduce visual hierarchy clarity.'),
      quickWinTitle: 'reports.fb.fonts.consistencyQuickWinTitle',
      quickWinDesc: 'reports.fb.fonts.consistencyQuickWinDesc',
      group: 'design',
    });
  }

  if (overallScore != null && overallScore < 60 && issues.length === 0) {
    issues.push({
      category: 'reports.fb.fonts.optimizationCategory',
      priority: 'medium',
      reason: i('reports.fb.fonts.optimizationReason', { score: overallScore }, 'Overall typography score of {{score}}/100 suggests multiple small issues that add up.'),
      quickWinTitle: 'reports.fb.fonts.optimizationQuickWinTitle',
      quickWinDesc: 'reports.fb.fonts.optimizationQuickWinDesc',
      group: 'loading',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.fonts.assessmentWithIssues', { url, score: overallScore || '', count: issues.length }, 'Font and typography analysis of {{url}} scoring {{score}}/100 found {{count}} areas for improvement. Typography directly affects both performance and user experience.')
      : i('reports.fb.fonts.assessmentClean', { url, score: overallScore || '' }, 'Font and typography analysis of {{url}} scoring {{score}}/100 found a well-optimized font setup. Your font implementation is efficient and consistent.'),
    issues.length > 0
      ? i('reports.fb.fonts.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Optimizing font implementation could improve your score by approximately {{points}} points and reduce font-related load time')
      : 'reports.fb.fonts.totalImpactClean'
  );
}

// ─── Tag Intelligence ─────────────────────────────────────────────────────

function analyzeTagStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score;
  const tagCount = data.tagCount ?? data.totalTags;
  const duplicateTags = data.duplicateTags ?? data.duplicates;

  if (tagCount != null && tagCount > 20) {
    issues.push({
      category: 'reports.fb.tags.bloatCategory',
      priority: tagCount > 40 ? 'high' : 'medium',
      reason: i('reports.fb.tags.bloatReason', { count: tagCount }, '{{count}} tags detected on the page. Each tag adds JavaScript execution time and potential data collection.'),
      quickWinTitle: 'reports.fb.tags.bloatQuickWinTitle',
      quickWinDesc: i('reports.fb.tags.bloatQuickWinDesc', { count: tagCount }, 'With {{count}} tags, a tag audit will likely reveal 20-40% that are no longer needed.'),
      group: 'optimization',
      connectionText: 'reports.fb.tags.optimizationConnection',
    });
  }

  if (duplicateTags != null && duplicateTags > 0) {
    issues.push({
      category: 'reports.fb.tags.duplicateCategory',
      priority: 'high',
      reason: i('reports.fb.tags.duplicateReason', { count: duplicateTags }, 'Found {{count}} duplicate tag(s). Duplicate tracking tags fire multiple events for the same action, corrupting analytics data.'),
      quickWinTitle: 'reports.fb.tags.duplicateQuickWinTitle',
      quickWinDesc: i('reports.fb.tags.duplicateQuickWinDesc', { count: duplicateTags }, '{{count}} duplicate tag(s) are skewing your analytics data. Remove the direct implementations and use the tag manager instead.'),
      group: 'optimization',
    });
  }

  if (overallScore != null && overallScore < 70 && issues.length === 0) {
    issues.push({
      category: 'reports.fb.tags.managementCategory',
      priority: 'medium',
      reason: i('reports.fb.tags.managementReason', { score: overallScore }, 'Tag intelligence score of {{score}}/100 indicates room for optimization. Poorly managed tags slow page load and compromise user privacy.'),
      quickWinTitle: 'reports.fb.tags.managementQuickWinTitle',
      quickWinDesc: 'reports.fb.tags.managementQuickWinDesc',
      group: 'optimization',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.tags.assessmentWithIssues', { url, score: overallScore || '', count: issues.length }, 'Tag intelligence analysis of {{url}} scoring {{score}}/100 found {{count}} optimization opportunities. Tags are a hidden performance cost.')
      : i('reports.fb.tags.assessmentClean', { url, score: overallScore || '' }, 'Tag intelligence analysis of {{url}} scoring {{score}}/100 found a well-managed tag setup. Your tag implementation is clean and efficient.'),
    issues.length > 0
      ? i('reports.fb.tags.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Cleaning up tags could improve performance by approximately {{points}} points and improve analytics data accuracy')
      : 'reports.fb.tags.totalImpactClean'
  );
}

// ─── Broken Links ─────────────────────────────────────────────────────────

function analyzeBrokenLinksStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const broken = data.brokenCount ?? data.broken ?? data.brokenLinks ?? 0;
  const total = data.totalLinks ?? data.linksChecked ?? data.totalChecked;
  const redirects = data.redirectCount ?? data.redirects ?? 0;

  if (broken > 0) {
    const brokenPct = total ? ((broken / total) * 100).toFixed(1) : null;
    issues.push({
      category: 'reports.fb.brokenLinks.brokenCategory',
      priority: broken > 20 ? 'critical' : broken > 5 ? 'high' : 'medium',
      reason: brokenPct
        ? i('reports.fb.brokenLinks.brokenReasonPct', { count: broken, pct: brokenPct, total }, 'Found {{count}} broken link(s) ({{pct}}% of {{total}} links). Each broken link is a dead end that frustrates users and wastes search engine crawl budget.')
        : i('reports.fb.brokenLinks.brokenReason', { count: broken }, 'Found {{count}} broken link(s). Each broken link is a dead end that frustrates users and wastes search engine crawl budget.'),
      quickWinTitle: i('reports.fb.brokenLinks.brokenQuickWinTitle', { count: Math.min(broken, 5) }, 'Fix the {{count}} most important broken links'),
      quickWinDesc: i('reports.fb.brokenLinks.brokenQuickWinDesc', { count: broken }, '{{count}} broken link(s) need attention. Start with links on high-traffic pages and in main navigation.'),
      group: 'links',
      connectionText: 'reports.fb.brokenLinks.linksConnection',
    });
  }

  if (redirects > 5) {
    issues.push({
      category: 'reports.fb.brokenLinks.redirectCategory',
      priority: redirects > 20 ? 'high' : 'medium',
      reason: i('reports.fb.brokenLinks.redirectReason', { count: redirects }, 'Found {{count}} redirect(s). Redirect chains add latency (each hop adds ~100-300ms) and dilute link equity.'),
      quickWinTitle: 'reports.fb.brokenLinks.redirectQuickWinTitle',
      quickWinDesc: i('reports.fb.brokenLinks.redirectQuickWinDesc', { count: redirects }, 'Update {{count}} link(s) to point directly to the final URL, eliminating intermediate redirects.'),
      group: 'links',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.brokenLinks.assessmentWithIssues', { url, broken, total: total || '' }, 'Link analysis of {{url}} found {{broken}} broken link(s) out of {{total}} checked. Broken links create dead-end user experiences and signal poor site maintenance to search engines.')
      : i('reports.fb.brokenLinks.assessmentClean', { url, total: total || '' }, 'Link analysis of {{url}} found no broken links out of {{total}} checked. Your link structure is healthy.'),
    issues.length > 0
      ? i('reports.fb.brokenLinks.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Fixing all link issues could recover lost traffic and improve crawl efficiency by approximately {{points}} points')
      : 'reports.fb.brokenLinks.totalImpactClean'
  );
}

// ─── Mobile ──────────────────────────────────────────────────────────────

function analyzeMobileStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score ?? data.mobileScore;
  const viewportScore = data.viewportScore ?? data.viewport;
  const tapTargetScore = data.tapTargetScore ?? data.tapTargets;

  if (viewportScore != null && viewportScore < 80) {
    issues.push({
      category: 'reports.fb.mobile.viewportCategory',
      priority: 'critical',
      reason: i('reports.fb.mobile.viewportReason', { score: viewportScore }, 'Viewport score of {{score}}/100. Without proper viewport meta tag configuration, your site renders at desktop width on mobile devices.'),
      quickWinTitle: 'reports.fb.mobile.viewportQuickWinTitle',
      quickWinDesc: 'reports.fb.mobile.viewportQuickWinDesc',
      group: 'mobile-ux',
      connectionText: 'reports.fb.mobile.mobileUxConnection',
    });
  }

  if (tapTargetScore != null && tapTargetScore < 70) {
    issues.push({
      category: 'reports.fb.mobile.tapCategory',
      priority: 'high',
      reason: i('reports.fb.mobile.tapReason', { score: tapTargetScore }, 'Tap target score of {{score}}/100. Buttons and links that are too small or too close together cause frustrating mis-taps on touch devices.'),
      quickWinTitle: 'reports.fb.mobile.tapQuickWinTitle',
      quickWinDesc: i('reports.fb.mobile.tapQuickWinDesc', { score: tapTargetScore }, 'Tap targets scored {{score}}/100. Google recommends minimum 48x48px touch targets with 8px spacing between them.'),
      group: 'mobile-ux',
    });
  }

  if (data.fontSizeScore != null && data.fontSizeScore < 70) {
    issues.push({
      category: 'reports.fb.mobile.fontCategory',
      priority: 'medium',
      reason: i('reports.fb.mobile.fontReason', { score: data.fontSizeScore }, 'Mobile font size score of {{score}}/100. Text that is too small on mobile forces users to pinch-zoom.'),
      quickWinTitle: 'reports.fb.mobile.fontQuickWinTitle',
      quickWinDesc: 'reports.fb.mobile.fontQuickWinDesc',
      group: 'readability',
    });
  }

  if (overallScore != null && overallScore < 60 && issues.length === 0) {
    issues.push({
      category: 'reports.fb.mobile.usabilityCategory',
      priority: 'high',
      reason: i('reports.fb.mobile.usabilityReason', { score: overallScore }, 'Mobile score of {{score}}/100 indicates significant mobile usability issues. With over 60% of web traffic from mobile devices, this directly impacts your reach.'),
      quickWinTitle: 'reports.fb.mobile.usabilityQuickWinTitle',
      quickWinDesc: 'reports.fb.mobile.usabilityQuickWinDesc',
      group: 'mobile-ux',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.mobile.assessmentWithIssues', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore), count: issues.length }, 'Mobile analysis of {{url}} scoring {{score}}/100 ({{scoreLabel}}) found {{count}} usability issues. With over 60% of web traffic coming from mobile devices, mobile usability directly impacts both user experience and search rankings.')
      : i('reports.fb.mobile.assessmentClean', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore) }, 'Mobile analysis of {{url}} scoring {{score}}/100 ({{scoreLabel}}) found a well-optimized mobile experience. Continue testing on real devices.'),
    issues.length > 0
      ? i('reports.fb.mobile.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Addressing mobile issues could improve your mobile score by approximately {{points}} points and reduce mobile bounce rates significantly')
      : 'reports.fb.mobile.totalImpactClean'
  );
}

// ─── Hosting ────────────────────────────────────────────────────────────────

function analyzeHostingStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score;

  if (data.http2 === false) {
    issues.push({
      category: 'reports.fb.hosting.http2Category',
      priority: 'high',
      reason: 'reports.fb.hosting.http2Reason',
      quickWinTitle: 'reports.fb.hosting.http2QuickWinTitle',
      quickWinDesc: 'reports.fb.hosting.http2QuickWinDesc',
      group: 'server',
      connectionText: 'reports.fb.hosting.serverConnection',
    });
  }

  if (data.compression === false || data.gzip === false) {
    issues.push({
      category: 'reports.fb.hosting.compressionCategory',
      priority: 'high',
      reason: 'reports.fb.hosting.compressionReason',
      quickWinTitle: 'reports.fb.hosting.compressionQuickWinTitle',
      quickWinDesc: 'reports.fb.hosting.compressionQuickWinDesc',
      group: 'server',
    });
  }

  if (data.cdn === false) {
    issues.push({
      category: 'reports.fb.hosting.cdnCategory',
      priority: 'medium',
      reason: 'reports.fb.hosting.cdnReason',
      quickWinTitle: 'reports.fb.hosting.cdnQuickWinTitle',
      quickWinDesc: 'reports.fb.hosting.cdnQuickWinDesc',
      group: 'server',
    });
  }

  if (overallScore != null && overallScore < 60 && issues.length === 0) {
    issues.push({
      category: 'reports.fb.hosting.configCategory',
      priority: 'medium',
      reason: i('reports.fb.hosting.configReason', { score: overallScore }, 'Hosting score of {{score}}/100 indicates room for server-level optimization.'),
      quickWinTitle: 'reports.fb.hosting.configQuickWinTitle',
      quickWinDesc: 'reports.fb.hosting.configQuickWinDesc',
      group: 'server',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.hosting.assessmentWithIssues', { url, score: overallScore || '', count: issues.length }, 'Hosting analysis of {{url}} scoring {{score}}/100 found {{count}} infrastructure optimizations. Server-level optimizations improve every single page load.')
      : i('reports.fb.hosting.assessmentClean', { url, score: overallScore || '' }, 'Hosting analysis of {{url}} scoring {{score}}/100 found a well-configured hosting setup. Continue monitoring server metrics.'),
    issues.length > 0
      ? i('reports.fb.hosting.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Optimizing hosting could improve delivery speed by approximately {{points}} points and benefit every page on your site')
      : 'reports.fb.hosting.totalImpactClean'
  );
}

// ─── Site Crawler ──────────────────────────────────────────────────────────

function analyzeCrawlerStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score;
  const pagesFound = data.pagesFound ?? data.totalPages ?? data.pagesScanned;

  if (data.robotsTxt === false || data.robotsValid === false) {
    issues.push({
      category: 'reports.fb.crawler.robotsCategory',
      priority: 'high',
      reason: 'reports.fb.crawler.robotsReason',
      quickWinTitle: 'reports.fb.crawler.robotsQuickWinTitle',
      quickWinDesc: 'reports.fb.crawler.robotsQuickWinDesc',
      group: 'crawl-config',
      connectionText: 'reports.fb.crawler.crawlConfigConnection',
    });
  }

  if (data.sitemap === false || data.sitemapValid === false) {
    issues.push({
      category: 'reports.fb.crawler.sitemapCategory',
      priority: 'high',
      reason: 'reports.fb.crawler.sitemapReason',
      quickWinTitle: 'reports.fb.crawler.sitemapQuickWinTitle',
      quickWinDesc: 'reports.fb.crawler.sitemapQuickWinDesc',
      group: 'crawl-config',
    });
  }

  if (data.orphanPages > 0) {
    issues.push({
      category: 'reports.fb.crawler.orphanCategory',
      priority: 'medium',
      reason: i('reports.fb.crawler.orphanReason', { count: data.orphanPages }, 'Found {{count}} orphan page(s) with no internal links pointing to them. Search engines may not discover these pages.'),
      quickWinTitle: 'reports.fb.crawler.orphanQuickWinTitle',
      quickWinDesc: 'reports.fb.crawler.orphanQuickWinDesc',
      group: 'structure',
    });
  }

  if (overallScore != null && overallScore < 60 && issues.length === 0) {
    issues.push({
      category: 'reports.fb.crawler.crawlabilityCategory',
      priority: 'medium',
      reason: i('reports.fb.crawler.crawlabilityReason', { score: overallScore }, 'Crawl score of {{score}}/100 indicates search engines may have difficulty fully indexing your site.'),
      quickWinTitle: 'reports.fb.crawler.crawlabilityQuickWinTitle',
      quickWinDesc: 'reports.fb.crawler.crawlabilityQuickWinDesc',
      group: 'structure',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.crawler.assessmentWithIssues', { url, score: overallScore || '', pages: pagesFound || '', count: issues.length }, 'Crawl analysis of {{url}} scoring {{score}}/100 across {{pages}} discovered pages found {{count}} crawlability issues. Search engines need to efficiently crawl your site to index your content.')
      : i('reports.fb.crawler.assessmentClean', { url, score: overallScore || '', pages: pagesFound || '' }, 'Crawl analysis of {{url}} scoring {{score}}/100 across {{pages}} discovered pages found a well-structured site for search engine crawling.'),
    issues.length > 0
      ? i('reports.fb.crawler.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Fixing crawlability issues could help search engines discover more of your content, improving visibility by approximately {{points}} points')
      : 'reports.fb.crawler.totalImpactClean'
  );
}

// ─── CRO ──────────────────────────────────────────────────────────────────

function analyzeCroStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score;

  if (data.ctaScore != null && data.ctaScore < 70) {
    issues.push({
      category: 'reports.fb.cro.ctaCategory',
      priority: 'critical',
      reason: i('reports.fb.cro.ctaReason', { score: data.ctaScore }, 'CTA effectiveness scored {{score}}/100. Your primary call-to-action is the most important conversion element on the page.'),
      quickWinTitle: 'reports.fb.cro.ctaQuickWinTitle',
      quickWinDesc: i('reports.fb.cro.ctaQuickWinDesc', { score: data.ctaScore }, 'CTA score of {{score}}/100 suggests the primary action is not compelling enough. Use contrasting colors, action-oriented copy, and place it above the fold.'),
      group: 'conversion',
      connectionText: 'reports.fb.cro.conversionConnection',
    });
  }

  if (data.formScore != null && data.formScore < 70) {
    issues.push({
      category: 'reports.fb.cro.formCategory',
      priority: 'high',
      reason: i('reports.fb.cro.formReason', { score: data.formScore }, 'Form design scored {{score}}/100. Complex or poorly designed forms are the #1 reason users abandon the conversion process.'),
      quickWinTitle: 'reports.fb.cro.formQuickWinTitle',
      quickWinDesc: i('reports.fb.cro.formQuickWinDesc', { score: data.formScore }, 'Form score of {{score}}/100 indicates friction in the conversion process. Reducing form fields by 50% typically increases completion rates by 25-50%.'),
      group: 'conversion',
    });
  }

  if (data.trustScore != null && data.trustScore < 70) {
    issues.push({
      category: 'reports.fb.cro.trustCategory',
      priority: 'high',
      reason: i('reports.fb.cro.trustReason', { score: data.trustScore }, 'Trust signal score of {{score}}/100. Without visible trust indicators, visitors hesitate to provide personal information.'),
      quickWinTitle: 'reports.fb.cro.trustQuickWinTitle',
      quickWinDesc: 'reports.fb.cro.trustQuickWinDesc',
      group: 'persuasion',
    });
  }

  if (data.loadImpact != null && data.loadImpact > 3000) {
    issues.push({
      category: 'reports.fb.cro.speedCategory',
      priority: 'high',
      reason: i('reports.fb.cro.speedReason', { seconds: (data.loadImpact / 1000).toFixed(1) }, 'Page loads in {{seconds}}s. Every additional second of load time reduces conversions by ~7%.'),
      quickWinTitle: 'reports.fb.cro.speedQuickWinTitle',
      quickWinDesc: 'reports.fb.cro.speedQuickWinDesc',
      group: 'performance',
    });
  }

  if (overallScore != null && overallScore < 60 && issues.length === 0) {
    issues.push({
      category: 'reports.fb.cro.optimizationCategory',
      priority: 'high',
      reason: i('reports.fb.cro.optimizationReason', { score: overallScore }, 'CRO score of {{score}}/100 indicates significant conversion rate improvement opportunities.'),
      quickWinTitle: 'reports.fb.cro.optimizationQuickWinTitle',
      quickWinDesc: 'reports.fb.cro.optimizationQuickWinDesc',
      group: 'conversion',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.cro.assessmentWithIssues', { url, score: overallScore || '', count: issues.length }, 'CRO analysis of {{url}} scoring {{score}}/100 identified {{count}} conversion optimization opportunities. Conversion rate optimization has the highest direct revenue impact of any optimization type.')
      : i('reports.fb.cro.assessmentClean', { url, score: overallScore || '' }, 'CRO analysis of {{url}} scoring {{score}}/100 identified a well-optimized conversion path. Consider A/B testing variations to find further improvements.'),
    issues.length > 0
      ? i('reports.fb.cro.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Addressing CRO issues could improve conversion rates significantly, turning approximately {{points}} points of improvement into real revenue growth')
      : 'reports.fb.cro.totalImpactClean'
  );
}

// ─── Brand Consistency ────────────────────────────────────────────────────

function analyzeBrandStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score;

  if (data.colorConsistency != null && data.colorConsistency < 70) {
    issues.push({
      category: 'reports.fb.brand.colorCategory',
      priority: 'high',
      reason: i('reports.fb.brand.colorReason', { score: data.colorConsistency }, 'Color consistency scored {{score}}/100. Inconsistent brand colors undermine recognition and trust.'),
      quickWinTitle: 'reports.fb.brand.colorQuickWinTitle',
      quickWinDesc: i('reports.fb.brand.colorQuickWinDesc', { score: data.colorConsistency }, 'At {{score}}/100, defining CSS custom properties for your brand colors ensures consistency across all pages.'),
      group: 'visual-brand',
      connectionText: 'reports.fb.brand.visualBrandConnection',
    });
  }

  if (data.typographyConsistency != null && data.typographyConsistency < 70) {
    issues.push({
      category: 'reports.fb.brand.typographyCategory',
      priority: 'medium',
      reason: i('reports.fb.brand.typographyReason', { score: data.typographyConsistency }, 'Typography consistency scored {{score}}/100. Inconsistent fonts and sizes reduce brand cohesion.'),
      quickWinTitle: 'reports.fb.brand.typographyQuickWinTitle',
      quickWinDesc: 'reports.fb.brand.typographyQuickWinDesc',
      group: 'visual-brand',
    });
  }

  if (data.logoConsistency != null && data.logoConsistency < 80) {
    issues.push({
      category: 'reports.fb.brand.logoCategory',
      priority: 'medium',
      reason: i('reports.fb.brand.logoReason', { score: data.logoConsistency }, 'Logo consistency scored {{score}}/100. Inconsistent logo usage dilutes brand recognition.'),
      quickWinTitle: 'reports.fb.brand.logoQuickWinTitle',
      quickWinDesc: 'reports.fb.brand.logoQuickWinDesc',
      group: 'assets',
    });
  }

  if (overallScore != null && overallScore < 60 && issues.length === 0) {
    issues.push({
      category: 'reports.fb.brand.cohesionCategory',
      priority: 'medium',
      reason: i('reports.fb.brand.cohesionReason', { score: overallScore }, 'Brand consistency score of {{score}}/100 indicates your visual identity needs attention. Consistent branding increases revenue by up to 23%.'),
      quickWinTitle: 'reports.fb.brand.cohesionQuickWinTitle',
      quickWinDesc: 'reports.fb.brand.cohesionQuickWinDesc',
      group: 'visual-brand',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.brand.assessmentWithIssues', { url, score: overallScore || '', count: issues.length }, 'Brand consistency analysis of {{url}} scoring {{score}}/100 found {{count}} consistency issues. Consistent branding builds trust, aids recognition, and increases perceived quality.')
      : i('reports.fb.brand.assessmentClean', { url, score: overallScore || '' }, 'Brand consistency analysis of {{url}} scoring {{score}}/100 found strong brand cohesion. Continue maintaining brand guidelines.'),
    issues.length > 0
      ? i('reports.fb.brand.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Improving brand consistency could strengthen user trust and professional perception by approximately {{points}} points')
      : 'reports.fb.brand.totalImpactClean'
  );
}

// ─── Geo SEO / Local SEO ──────────────────────────────────────────────────

function analyzeGeoSeoStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score;

  if (data.hreflangScore != null && data.hreflangScore < 70) {
    issues.push({
      category: 'reports.fb.geoSeo.hreflangCategory',
      priority: 'high',
      reason: i('reports.fb.geoSeo.hreflangReason', { score: data.hreflangScore }, 'Hreflang implementation scored {{score}}/100. Without proper hreflang tags, search engines may serve the wrong language version to users.'),
      quickWinTitle: 'reports.fb.geoSeo.hreflangQuickWinTitle',
      quickWinDesc: i('reports.fb.geoSeo.hreflangQuickWinDesc', { score: data.hreflangScore }, 'At {{score}}/100, adding self-referencing and reciprocal hreflang tags ensures Google serves the correct language version.'),
      group: 'international',
      connectionText: 'reports.fb.geoSeo.internationalConnection',
    });
  }

  if (data.localSignals != null && data.localSignals < 70) {
    issues.push({
      category: 'reports.fb.geoSeo.localCategory',
      priority: 'medium',
      reason: i('reports.fb.geoSeo.localReason', { score: data.localSignals }, 'Local SEO signals scored {{score}}/100. Missing NAP consistency and local schema markup reduces visibility in local search results.'),
      quickWinTitle: 'reports.fb.geoSeo.localQuickWinTitle',
      quickWinDesc: 'reports.fb.geoSeo.localQuickWinDesc',
      group: 'local',
    });
  }

  if (overallScore != null && overallScore < 60 && issues.length === 0) {
    issues.push({
      category: 'reports.fb.geoSeo.geoCategory',
      priority: 'medium',
      reason: i('reports.fb.geoSeo.geoReason', { score: overallScore }, 'Geo-SEO score of {{score}}/100 means you may be missing local and international search traffic.'),
      quickWinTitle: 'reports.fb.geoSeo.geoQuickWinTitle',
      quickWinDesc: 'reports.fb.geoSeo.geoQuickWinDesc',
      group: 'local',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.geoSeo.assessmentWithIssues', { url, score: overallScore || '', count: issues.length }, 'Geographic SEO analysis of {{url}} scoring {{score}}/100 found {{count}} optimization opportunities. Geographic optimization ensures search engines serve the right version of your site to the right audience.')
      : i('reports.fb.geoSeo.assessmentClean', { url, score: overallScore || '' }, 'Geographic SEO analysis of {{url}} scoring {{score}}/100 found well-configured geographic targeting. Continue monitoring international search performance.'),
    issues.length > 0
      ? i('reports.fb.geoSeo.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Addressing geo-SEO issues could improve regional search visibility by approximately {{points}} points')
      : 'reports.fb.geoSeo.totalImpactClean'
  );
}

// ─── GDPR Compliance ──────────────────────────────────────────────────────

function analyzeGdprStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score;

  if (data.cookieConsent === false || (data.consentScore != null && data.consentScore < 70)) {
    issues.push({
      category: 'reports.fb.gdpr.consentCategory',
      priority: 'critical',
      reason: data.consentScore != null
        ? i('reports.fb.gdpr.consentReasonScore', { score: data.consentScore }, 'Cookie consent implementation is inadequate (scored {{score}}/100). GDPR requires explicit, informed consent before setting non-essential cookies. Violations can result in fines up to 4% of annual global revenue.')
        : 'reports.fb.gdpr.consentReason',
      quickWinTitle: 'reports.fb.gdpr.consentQuickWinTitle',
      quickWinDesc: 'reports.fb.gdpr.consentQuickWinDesc',
      group: 'consent',
      connectionText: 'reports.fb.gdpr.consentConnection',
    });
  }

  if (data.privacyPolicy === false || (data.privacyScore != null && data.privacyScore < 70)) {
    issues.push({
      category: 'reports.fb.gdpr.privacyCategory',
      priority: 'high',
      reason: 'reports.fb.gdpr.privacyReason',
      quickWinTitle: 'reports.fb.gdpr.privacyQuickWinTitle',
      quickWinDesc: 'reports.fb.gdpr.privacyQuickWinDesc',
      group: 'consent',
    });
  }

  if (data.thirdPartyTracking > 5) {
    issues.push({
      category: 'reports.fb.gdpr.trackingCategory',
      priority: 'high',
      reason: i('reports.fb.gdpr.trackingReason', { count: data.thirdPartyTracking }, 'Detected {{count}} third-party trackers. Each tracker represents a data sharing relationship that must be disclosed.'),
      quickWinTitle: 'reports.fb.gdpr.trackingQuickWinTitle',
      quickWinDesc: i('reports.fb.gdpr.trackingQuickWinDesc', { count: data.thirdPartyTracking }, '{{count}} third-party services need to be documented in your Records of Processing Activities (ROPA).'),
      group: 'data-flows',
    });
  }

  if (overallScore != null && overallScore < 60 && issues.length === 0) {
    issues.push({
      category: 'reports.fb.gdpr.complianceCategory',
      priority: 'high',
      reason: i('reports.fb.gdpr.complianceReason', { score: overallScore }, 'Compliance score of {{score}}/100 indicates significant regulatory risk.'),
      quickWinTitle: 'reports.fb.gdpr.complianceQuickWinTitle',
      quickWinDesc: 'reports.fb.gdpr.complianceQuickWinDesc',
      group: 'consent',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.gdpr.assessmentWithIssues', { url, score: overallScore || '', count: issues.length }, 'GDPR compliance analysis of {{url}} scoring {{score}}/100 found {{count}} compliance gaps. GDPR compliance is not optional for any site with EU visitors. Fines can reach 4% of annual global revenue.')
      : i('reports.fb.gdpr.assessmentClean', { url, score: overallScore || '' }, 'GDPR compliance analysis of {{url}} scoring {{score}}/100 found generally compliant data practices. Your GDPR compliance posture is strong.'),
    issues.length > 0
      ? i('reports.fb.gdpr.totalImpact', { count: issues.length, points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Addressing all {{count}} compliance gaps could reduce regulatory risk and improve your compliance score by approximately {{points}} points')
      : 'reports.fb.gdpr.totalImpactClean'
  );
}

// ─── IP Reputation ────────────────────────────────────────────────────────

function analyzeIpStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score;
  const blacklistCount = data.blacklistCount ?? data.blacklists ?? data.listedOn;

  if (blacklistCount != null && blacklistCount > 0) {
    issues.push({
      category: 'reports.fb.ipReputation.blacklistCategory',
      priority: blacklistCount > 3 ? 'critical' : 'high',
      reason: i('reports.fb.ipReputation.blacklistReason', { count: blacklistCount }, 'Your IP is listed on {{count}} blacklist(s). Blacklisted IPs face email delivery failures, reduced search trust, and potential blocking.'),
      quickWinTitle: 'reports.fb.ipReputation.blacklistQuickWinTitle',
      quickWinDesc: i('reports.fb.ipReputation.blacklistQuickWinDesc', { count: blacklistCount }, 'Listed on {{count}} blacklist(s). Submit delisting requests after resolving the underlying issue. Most blacklists process removal within 24-48 hours.'),
      group: 'reputation',
      connectionText: 'reports.fb.ipReputation.reputationConnection',
    });
  }

  if (data.emailReputation != null && data.emailReputation < 70) {
    issues.push({
      category: 'reports.fb.ipReputation.emailCategory',
      priority: 'high',
      reason: i('reports.fb.ipReputation.emailReason', { score: data.emailReputation }, 'Email reputation scored {{score}}/100. Poor IP reputation causes emails to land in spam folders.'),
      quickWinTitle: 'reports.fb.ipReputation.emailQuickWinTitle',
      quickWinDesc: i('reports.fb.ipReputation.emailQuickWinDesc', { score: data.emailReputation }, 'Email reputation at {{score}}/100 can be improved by implementing authentication records (SPF, DKIM, DMARC).'),
      group: 'reputation',
    });
  }

  if (data.neighborReputation != null && data.neighborReputation < 70) {
    issues.push({
      category: 'reports.fb.ipReputation.neighborCategory',
      priority: 'medium',
      reason: i('reports.fb.ipReputation.neighborReason', { score: data.neighborReputation }, 'IP neighborhood reputation scored {{score}}/100. Sharing an IP range with spammers can negatively affect your own reputation.'),
      quickWinTitle: 'reports.fb.ipReputation.neighborQuickWinTitle',
      quickWinDesc: 'reports.fb.ipReputation.neighborQuickWinDesc',
      group: 'infrastructure',
    });
  }

  if (overallScore != null && overallScore < 60 && issues.length === 0) {
    issues.push({
      category: 'reports.fb.ipReputation.reputationCategory',
      priority: 'medium',
      reason: i('reports.fb.ipReputation.reputationReason', { score: overallScore }, 'IP reputation score of {{score}}/100 indicates potential issues with how your server\'s IP is perceived.'),
      quickWinTitle: 'reports.fb.ipReputation.reputationQuickWinTitle',
      quickWinDesc: 'reports.fb.ipReputation.reputationQuickWinDesc',
      group: 'reputation',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.ipReputation.assessmentWithIssues', { url, score: overallScore || '', count: issues.length }, 'IP reputation analysis of {{url}} scoring {{score}}/100 found {{count}} reputation concerns. IP reputation affects email deliverability, search engine trust, and whether security tools flag your site.')
      : i('reports.fb.ipReputation.assessmentClean', { url, score: overallScore || '' }, 'IP reputation analysis of {{url}} scoring {{score}}/100 found a healthy IP reputation. Continue monitoring blacklist databases.'),
    issues.length > 0
      ? i('reports.fb.ipReputation.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Improving IP reputation could restore email deliverability and domain trust by approximately {{points}} points')
      : 'reports.fb.ipReputation.totalImpactClean'
  );
}

// ─── Competitive Analysis ─────────────────────────────────────────────────

function analyzeCompetitiveStrategic(data) {
  const issues = [];
  const url = extractUrl(data);
  const competitors = data.competitors || data.competitorCount || 0;

  if (data.performanceGap != null && data.performanceGap < 0) {
    issues.push({
      category: 'reports.fb.competitive.performanceCategory',
      priority: 'high',
      reason: i('reports.fb.competitive.performanceReason', { gap: Math.abs(data.performanceGap) }, 'Your site is slower than competitors by {{gap}} points. In competitive markets, faster sites capture more traffic.'),
      quickWinTitle: 'reports.fb.competitive.performanceQuickWinTitle',
      quickWinDesc: 'reports.fb.competitive.performanceQuickWinDesc',
      group: 'competitive-gap',
    });
  }

  if (data.seoGap != null && data.seoGap < 0) {
    issues.push({
      category: 'reports.fb.competitive.seoCategory',
      priority: 'high',
      reason: i('reports.fb.competitive.seoReason', { gap: Math.abs(data.seoGap) }, 'Your SEO score trails competitors by {{gap}} points. Better-optimized competitors will consistently outrank you.'),
      quickWinTitle: 'reports.fb.competitive.seoQuickWinTitle',
      quickWinDesc: 'reports.fb.competitive.seoQuickWinDesc',
      group: 'competitive-gap',
    });
  }

  if (data.securityGap != null && data.securityGap < 0) {
    issues.push({
      category: 'reports.fb.competitive.securityCategory',
      priority: 'medium',
      reason: i('reports.fb.competitive.securityReason', { gap: Math.abs(data.securityGap) }, 'Security score is {{gap}} points below competitors. Browsers actively warn users about security issues.'),
      quickWinTitle: 'reports.fb.competitive.securityQuickWinTitle',
      quickWinDesc: 'reports.fb.competitive.securityQuickWinDesc',
      group: 'competitive-gap',
      connectionText: 'reports.fb.competitive.gapConnection',
    });
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.competitive.assessmentWithIssues', { url, competitors, count: issues.length }, 'Competitive analysis of {{url}} against {{competitors}} competitors identified {{count}} areas where competitors have an advantage. Focus on closing the largest gaps first.')
      : i('reports.fb.competitive.assessmentClean', { url, competitors }, 'Competitive analysis of {{url}} against {{competitors}} competitors found a competitive position overall. Focus on differentiation and content quality.'),
    issues.length > 0
      ? i('reports.fb.competitive.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Closing competitive gaps could improve your relative market position by approximately {{points}} points')
      : 'reports.fb.competitive.totalImpactClean'
  );
}

// ─── Generic fallback ─────────────────────────────────────────────────────

function analyzeGenericStrategic(data, analyzerType) {
  const issues = [];
  const url = extractUrl(data);
  const overallScore = data.overallScore ?? data.score ?? data.totalScore;

  if (overallScore != null) {
    if (overallScore < 40) {
      issues.push({
        category: 'reports.fb.generic.criticalCategory',
        priority: 'critical',
        reason: i('reports.fb.generic.criticalReason', { score: overallScore }, 'Overall score of {{score}}/100 indicates significant issues that need immediate attention.'),
        quickWinTitle: 'reports.fb.generic.criticalQuickWinTitle',
        quickWinDesc: i('reports.fb.generic.criticalQuickWinDesc', { score: overallScore }, 'With a score of {{score}}/100, focusing on the single most impactful fix provides the fastest path to visible improvement.'),
      });
    } else if (overallScore < 70) {
      issues.push({
        category: 'reports.fb.generic.keyCategory',
        priority: 'high',
        reason: i('reports.fb.generic.keyReason', { score: overallScore }, 'Score of {{score}}/100 shows room for meaningful improvement. Addressing the flagged issues could move you into the "good" range (70+).'),
        quickWinTitle: 'reports.fb.generic.keyQuickWinTitle',
        quickWinDesc: i('reports.fb.generic.keyQuickWinDesc', { score: overallScore }, 'At {{score}}/100, the high-priority issues represent the most efficient path to improvement.'),
      });
    } else if (overallScore < 90) {
      issues.push({
        category: 'reports.fb.generic.tuningCategory',
        priority: 'medium',
        reason: i('reports.fb.generic.tuningReason', { score: overallScore }, 'Score of {{score}}/100 is good but there is room to reach excellent.'),
        quickWinTitle: 'reports.fb.generic.tuningQuickWinTitle',
        quickWinDesc: i('reports.fb.generic.tuningQuickWinDesc', { score: overallScore }, 'At {{score}}/100, the remaining improvements are optimization-level changes that distinguish good from great.'),
      });
    }
  }

  return buildStrategic(
    issues,
    issues.length > 0
      ? i('reports.fb.generic.assessmentWithIssues', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore) }, 'Analysis of {{url}} scoring {{score}}/100 ({{scoreLabel}}) has been completed. Review the detailed issue cards above for specific fix instructions.')
      : i('reports.fb.generic.assessmentClean', { url, score: overallScore || '', scoreLabel: scoreLabelText(overallScore) }, 'Analysis of {{url}} scoring {{score}}/100 ({{scoreLabel}}) has been completed. Your site is performing well across the measured criteria.'),
    issues.length > 0
      ? i('reports.fb.generic.totalImpact', { points: issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.priority] || 0), 0) }, 'Addressing all identified issues could improve your overall score by approximately {{points}} points')
      : 'reports.fb.generic.totalImpactClean'
  );
}

module.exports = { generateFallback };
