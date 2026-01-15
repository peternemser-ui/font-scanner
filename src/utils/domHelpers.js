/**
 * DOM Analysis Helper Utilities
 *
 * Functions designed to run inside page.evaluate() for DOM analysis.
 * Consolidates DOM manipulation patterns used across 10+ services.
 *
 * IMPORTANT: These functions must be serializable (no external dependencies)
 * as they run in the browser context via page.evaluate().
 *
 * @module utils/domHelpers
 */

/**
 * Extract heading structure from page
 *
 * Consolidated from seoAnalyzer.js, accessibilityAnalyzerService.js,
 * mobileAnalyzerService.js
 *
 * Usage: await page.evaluate(extractHeadingStructure)
 *
 * @returns {Object} Heading structure analysis
 */
function extractHeadingStructure() {
  const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

  return {
    h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()),
    h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()),
    h3: Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim()),
    h4: Array.from(document.querySelectorAll('h4')).map(h => h.textContent.trim()),
    h5: Array.from(document.querySelectorAll('h5')).map(h => h.textContent.trim()),
    h6: Array.from(document.querySelectorAll('h6')).map(h => h.textContent.trim()),
    total: headingElements.length,
    hierarchy: Array.from(headingElements).map(h => ({
      level: h.tagName.toLowerCase(),
      text: h.textContent.trim().substring(0, 100)
    }))
  };
}

/**
 * Analyze images on page
 *
 * Consolidated from seoAnalyzer.js, accessibilityAnalyzerService.js,
 * performanceAnalyzer.js
 *
 * Usage: await page.evaluate(analyzeImages)
 *
 * @returns {Object} Image analysis results
 */
function analyzeImages() {
  const imgElements = Array.from(document.querySelectorAll('img'));

  return {
    total: imgElements.length,
    withAlt: imgElements.filter(img => img.alt && img.alt.trim().length > 0).length,
    withoutAlt: imgElements.filter(img => !img.alt || img.alt.trim().length === 0).length,
    images: imgElements.slice(0, 50).map(img => ({
      src: img.src,
      alt: img.alt || null,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      loading: img.loading || 'eager',
      hasTitle: !!img.title,
      title: img.title || null
    }))
  };
}

/**
 * Extract meta tags from page
 *
 * Consolidated from seoAnalyzer.js, mobileAnalyzerService.js
 *
 * Usage: await page.evaluate(extractMetaTags)
 *
 * @returns {Object} Meta tags and SEO metadata
 */
function extractMetaTags() {
  const getMetaContent = (selector) => {
    const element = document.querySelector(selector);
    return element ? (element.content || element.textContent) : null;
  };

  return {
    // Basic meta tags
    title: document.title || null,
    titleLength: document.title ? document.title.length : 0,
    description: getMetaContent('meta[name="description"]'),
    descriptionLength: getMetaContent('meta[name="description"]')?.length || 0,
    keywords: getMetaContent('meta[name="keywords"]'),
    robots: getMetaContent('meta[name="robots"]'),
    canonical: document.querySelector('link[rel="canonical"]')?.href || null,
    viewport: getMetaContent('meta[name="viewport"]'),

    // Open Graph
    ogTitle: getMetaContent('meta[property="og:title"]'),
    ogDescription: getMetaContent('meta[property="og:description"]'),
    ogImage: getMetaContent('meta[property="og:image"]'),
    ogUrl: getMetaContent('meta[property="og:url"]'),
    ogType: getMetaContent('meta[property="og:type"]'),

    // Twitter Cards
    twitterCard: getMetaContent('meta[name="twitter:card"]'),
    twitterTitle: getMetaContent('meta[name="twitter:title"]'),
    twitterDescription: getMetaContent('meta[name="twitter:description"]'),
    twitterImage: getMetaContent('meta[name="twitter:image"]'),

    // Additional
    language: document.documentElement.lang || null,
    charset: document.characterSet || null,
    author: getMetaContent('meta[name="author"]'),
    generator: getMetaContent('meta[name="generator"]')
  };
}

/**
 * Analyze links on page
 *
 * Consolidated from seoAnalyzer.js, brokenLinkService.js
 *
 * Usage: await page.evaluate(analyzeLinks)
 *
 * @returns {Object} Link analysis results
 */
function analyzeLinks() {
  const anchorElements = Array.from(document.querySelectorAll('a'));

  return {
    total: anchorElements.length,
    internal: anchorElements.filter(a => {
      try {
        const url = new URL(a.href, window.location.href);
        return url.hostname === window.location.hostname;
      } catch {
        return false;
      }
    }).length,
    external: anchorElements.filter(a => {
      try {
        const url = new URL(a.href, window.location.href);
        return url.hostname !== window.location.hostname;
      } catch {
        return false;
      }
    }).length,
    brokenFormat: anchorElements.filter(a => !a.href || a.href === '#' || a.href === 'javascript:void(0)').length,
    noFollow: anchorElements.filter(a => a.rel && a.rel.includes('nofollow')).length,
    links: anchorElements.slice(0, 100).map(a => ({
      href: a.href,
      text: a.textContent.trim().substring(0, 100),
      title: a.title || null,
      rel: a.rel || null,
      target: a.target || null
    }))
  };
}

/**
 * Analyze content quality
 *
 * Consolidated from seoAnalyzer.js
 *
 * Usage: await page.evaluate(analyzeContent)
 *
 * @returns {Object} Content analysis results
 */
function analyzeContent() {
  // Get visible text content (exclude scripts, styles, etc.)
  const bodyText = document.body ? document.body.innerText : '';
  const words = bodyText.trim().split(/\s+/).filter(w => w.length > 0);
  const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Calculate text-to-HTML ratio
  const htmlSize = document.documentElement.outerHTML.length;
  const textSize = bodyText.length;
  const textToHTMLRatio = htmlSize > 0 ? textSize / htmlSize : 0;

  return {
    wordCount: words.length,
    characterCount: bodyText.length,
    sentenceCount: sentences.length,
    averageWordsPerSentence: sentences.length > 0
      ? Math.round(words.length / sentences.length)
      : 0,
    paragraphCount: document.querySelectorAll('p').length,
    textToHTMLRatio: Math.round(textToHTMLRatio * 100) / 100,
    htmlSize,
    textSize
  };
}

/**
 * Get resource type from URL
 *
 * Consolidated from performanceAnalyzer.js, competitivePerformanceAnalyzer.js
 * Used to classify network requests by resource type
 *
 * @param {string} url - Resource URL
 * @returns {string} Resource type
 */
function getResourceType(url) {
  const urlLower = url.toLowerCase();

  if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)(\?|$)/)) return 'image';
  if (urlLower.match(/\.(css)(\?|$)/)) return 'stylesheet';
  if (urlLower.match(/\.(js)(\?|$)/)) return 'script';
  if (urlLower.match(/\.(woff|woff2|ttf|otf|eot)(\?|$)/)) return 'font';
  if (urlLower.match(/\.(mp4|webm|ogg|mp3|wav)(\?|$)/)) return 'media';
  if (urlLower.includes('api') || urlLower.includes('json')) return 'fetch';

  return 'other';
}

/**
 * Calculate maximum DOM depth
 *
 * Consolidated from seoAnalyzer.js, performanceAnalyzer.js
 * Protected against stack overflow for deep DOM trees
 *
 * Usage: await page.evaluate(getMaxDOMDepth)
 *
 * @param {Element} element - Root element (default: document.body)
 * @param {number} maxDepth - Maximum depth to traverse (default: 100)
 * @returns {number} Maximum DOM depth
 */
function getMaxDOMDepth(element = document.body, maxDepth = 100) {
  if (!element) return 0;

  let depth = 0;
  const queue = [{ node: element, level: 0 }];

  while (queue.length > 0) {
    const { node, level } = queue.shift();

    if (level > maxDepth) {
      return maxDepth; // Prevent infinite loops
    }

    depth = Math.max(depth, level);

    for (const child of node.children) {
      queue.push({ node: child, level: level + 1 });
    }
  }

  return depth;
}

/**
 * Count DOM nodes
 *
 * Consolidated from performanceAnalyzer.js, seoAnalyzer.js
 *
 * Usage: await page.evaluate(countDOMNodes)
 *
 * @returns {number} Total DOM nodes
 */
function countDOMNodes() {
  return document.querySelectorAll('*').length;
}

/**
 * Calculate contrast ratio between two colors
 *
 * Consolidated from accessibilityAnalyzerService.js
 * WCAG 2.1 contrast ratio calculation
 *
 * @param {string} foreground - Foreground color (hex, rgb, rgba)
 * @param {string} background - Background color (hex, rgb, rgba)
 * @returns {number} Contrast ratio (1-21)
 */
function calculateContrastRatio(foreground, background) {
  // Helper to parse color to RGB
  const parseColor = (color) => {
    const div = document.createElement('div');
    div.style.color = color;
    document.body.appendChild(div);
    const computed = window.getComputedStyle(div).color;
    document.body.removeChild(div);

    const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0];
  };

  // Helper to calculate relative luminance
  const getLuminance = (rgb) => {
    const [r, g, b] = rgb.map(val => {
      const sRGB = val / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  try {
    const fgRgb = parseColor(foreground);
    const bgRgb = parseColor(background);

    const fgLuminance = getLuminance(fgRgb);
    const bgLuminance = getLuminance(bgRgb);

    const lighter = Math.max(fgLuminance, bgLuminance);
    const darker = Math.min(fgLuminance, bgLuminance);

    return (lighter + 0.05) / (darker + 0.05);
  } catch (error) {
    return 1; // Default to failing ratio on error
  }
}

/**
 * Check for horizontal scroll
 *
 * Consolidated from mobileAnalyzerService.js
 *
 * Usage: await page.evaluate(hasHorizontalScroll)
 *
 * @returns {boolean} True if page has horizontal scroll
 */
function hasHorizontalScroll() {
  return document.documentElement.scrollWidth > document.documentElement.clientWidth;
}

/**
 * Extract structured data (JSON-LD, microdata)
 *
 * Consolidated from seoAnalyzer.js
 *
 * Usage: await page.evaluate(extractStructuredData)
 *
 * @returns {Object} Structured data analysis
 */
function extractStructuredData() {
  // Extract JSON-LD
  const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const jsonLdData = jsonLdScripts.map(script => {
    try {
      return JSON.parse(script.textContent);
    } catch {
      return null;
    }
  }).filter(Boolean);

  // Check for microdata
  const microdataElements = document.querySelectorAll('[itemscope]');

  return {
    hasStructuredData: jsonLdData.length > 0 || microdataElements.length > 0,
    jsonLdCount: jsonLdData.length,
    microdataCount: microdataElements.length,
    schemas: jsonLdData.map(data => ({
      type: data['@type'] || 'Unknown',
      valid: !!(data['@type'] && data['@context'])
    }))
  };
}

/**
 * Get performance timing metrics
 *
 * Consolidated from performanceAnalyzer.js, performanceSnapshotAnalyzer.js
 *
 * Usage: await page.evaluate(getPerformanceTiming)
 *
 * @returns {Object} Performance timing metrics
 */
function getPerformanceTiming() {
  const timing = performance.timing;
  const navigation = performance.navigation;

  return {
    // Navigation timing
    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
    loadComplete: timing.loadEventEnd - timing.navigationStart,
    domInteractive: timing.domInteractive - timing.navigationStart,

    // Resource timing
    dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
    tcpConnection: timing.connectEnd - timing.connectStart,
    serverResponse: timing.responseEnd - timing.requestStart,

    // Rendering
    domParsing: timing.domInteractive - timing.domLoading,

    // Navigation type
    navigationType: navigation.type, // 0=navigate, 1=reload, 2=back/forward
    redirectCount: navigation.redirectCount
  };
}

/**
 * Serialize functions for use in page.evaluate()
 *
 * Helper to convert these functions to strings for injection
 */
function serializeFunctionForEvaluate(fn) {
  return fn.toString();
}

// Export all functions
module.exports = {
  // Heading and structure
  extractHeadingStructure,
  getMaxDOMDepth,
  countDOMNodes,

  // Content analysis
  analyzeContent,
  analyzeImages,
  analyzeLinks,
  extractMetaTags,
  extractStructuredData,

  // Performance
  getPerformanceTiming,
  getResourceType,

  // Accessibility
  calculateContrastRatio,
  hasHorizontalScroll,

  // Utilities
  serializeFunctionForEvaluate
};
