/**
 * Site Crawler Script
 * Multi-page discovery with sitemap parsing and robots.txt respect
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'site-crawler';

document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  const urlInput = document.getElementById('urlInput');
  const crawlButton = document.getElementById('crawlButton');
  const maxPagesInput = document.getElementById('maxPages');
  const maxDepthInput = document.getElementById('maxDepth');
  const includeSitemapCheck = document.getElementById('includeSitemap');
  const respectRobotsCheck = document.getElementById('respectRobots');
  const results = document.getElementById('results');
  const loadingContainer = document.getElementById('loadingContainer');
  const resultsContent = document.getElementById('resultsContent');
  const errorMessage = document.getElementById('errorMessage');

  // Initialize AnalyzerLoader
  let loader = null;
  if (typeof AnalyzerLoader !== 'undefined') {
    loader = new AnalyzerLoader('loadingContainer');
  }

  // Define crawl steps
  const crawlSteps = [
    { label: 'Connecting to website', detail: 'Loading page and checking access...' },
    { label: 'Checking sitemap', detail: 'Parsing sitemap.xml for page discovery...' },
    { label: 'Discovering pages', detail: 'Following links and crawling pages...' },
    { label: 'Processing results', detail: 'Compiling discovered pages...' }
  ];

  // Handle crawl
  crawlButton.addEventListener('click', startCrawl);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startCrawl();
  });

  // Check for URL in query params
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('url');
  if (urlParam) {
    urlInput.value = urlParam;
    startCrawl();
  }

  async function startCrawl() {
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please enter a valid URL');
      return;
    }

    // Show loading
    results.classList.remove('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    crawlButton.disabled = true;

    if (loader) {
      loader.start(crawlSteps, '🕷️ CRAWLING SITE', 60);
      
      // Add ASCII art patience message
      addPatienceMessage(loadingContainer);
    }

    // Build options
    const options = {
      maxPages: parseInt(maxPagesInput.value) || 20,
      maxDepth: parseInt(maxDepthInput.value) || 3,
      includeSitemap: includeSitemapCheck.checked,
      respectRobotsTxt: respectRobotsCheck.checked
    };

    try {
      if (loader) loader.nextStep(1);

      const scanStartedAt = new Date().toISOString();
      window.SM_SCAN_STARTED_AT = scanStartedAt;
      document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options, scanStartedAt })
      });

      if (loader) loader.nextStep(3);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Crawl failed');
      }

      const data = await response.json();
      
      if (loader) {
        loader.complete();
        setTimeout(() => {
          loadingContainer.style.display = 'none';
          displayResults(data);
        }, 800);
      } else {
        displayResults(data);
      }

    } catch (error) {
      if (loader) {
        loadingContainer.style.display = 'none';
      }
      showError(error.message);
    } finally {
      crawlButton.disabled = false;
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  function displayResults(data) {

    const pages = data.results?.pages || [];
    const hostname = new URL(data.url || 'https://example.com').hostname;
    
    // Build site structure from URLs
    const siteStructure = buildSiteStructure(pages);
    const techStack = detectTechStack(pages, data);
    const hostingInfo = detectHostingInfo(hostname, data);
    
    // Check if shared components are loaded
    if (typeof ReportShell === 'undefined' || typeof ReportAccordion === 'undefined') {
      console.error('Shared report components not loaded');
      resultsContent.innerHTML = '<div style="color: red; padding: 2rem;">Error: Report components failed to load. Please refresh the page.</div>';
      return;
    }
    
    const html = `
      <div class="section">
        <h2>[SITE_CRAWLER_RESULTS]</h2>
        <p>>> url: ${data.url}</p>
        <p>>> timestamp: ${new Date().toLocaleString()}</p>
        
        <div style="
          background: linear-gradient(135deg, rgba(0,255,65,0.05) 0%, rgba(0,255,65,0.02) 100%);
          border: 2px solid #00ff41;
          border-radius: 12px;
          padding: 2rem;
          margin: 2rem 0;
          box-shadow: 0 4px 20px rgba(0,255,65,0.15);
        ">
          <h3 style="color: #00ff41; margin: 0 0 1.5rem 0; font-size: 1.3rem;">>> Site Crawl Summary</h3>
          <div style="display: flex; justify-content: center; gap: 2rem; flex-wrap: wrap; margin: 1rem 0;">
            <div style="text-align: center;">
              <div style="font-size: 2.5rem; font-weight: bold; color: #10b981;">${data.results?.pagesDiscovered || 0}</div>
              <div style="color: #9ca3af; font-size: 0.9rem;">Pages Discovered</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 2.5rem; font-weight: bold; color: #00d9ff;">${data.duration || 'N/A'}</div>
              <div style="color: #9ca3af; font-size: 0.9rem;">Crawl Time</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Visual Sitemap Section -->
      <div id="sitemapSection" style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
          <h3 style="margin: 0; color: #00ff41; display: flex; align-items: center; gap: 0.5rem;">
            🗺️ Visual Sitemap
          </h3>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button onclick="printSitemap()" style="padding: 0.5rem 1rem; background: rgba(0, 255, 65, 0.1); color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.3); border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.background='rgba(0, 255, 65, 0.2)'" onmouseout="this.style.background='rgba(0, 255, 65, 0.1)'">
              🖨️ Print Sitemap
            </button>
            <button onclick="downloadSitemapImage()" style="padding: 0.5rem 1rem; background: rgba(0, 217, 255, 0.1); color: #00d9ff; border: 1px solid rgba(0, 217, 255, 0.3); border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.background='rgba(0, 217, 255, 0.2)'" onmouseout="this.style.background='rgba(0, 217, 255, 0.1)'">
              💾 Save as Image
            </button>
          </div>
        </div>
        <div id="sitemapDiagram" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 2rem; overflow-x: auto;">
          ${renderSitemapDiagram(siteStructure, hostname)}
        </div>
      </div>
      
      <!-- Site Structure Tree -->
      <div style="margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem; color: #00d9ff; display: flex; align-items: center; gap: 0.5rem;">
          📂 Site Structure
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
          ${renderSiteTree(siteStructure)}
        </div>
      </div>
      
      <!-- Tech Stack & Hosting Row -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Detected Tech Stack -->
        <div style="background: linear-gradient(135deg, rgba(187, 119, 255, 0.1), rgba(187, 119, 255, 0.02)); border: 1px solid rgba(187, 119, 255, 0.3); border-radius: 12px; padding: 2rem;">
          <h3 style="margin: 0 0 1rem 0; color: #bb77ff; display: flex; align-items: center; gap: 0.5rem;">
            🔧 Detected Technology
          </h3>
          ${renderTechStack(techStack)}
        </div>
        
        <!-- Hosting & Infrastructure -->
        <div style="background: linear-gradient(135deg, rgba(0, 217, 255, 0.1), rgba(0, 217, 255, 0.02)); border: 1px solid rgba(0, 217, 255, 0.3); border-radius: 12px; padding: 2rem;">
          <h3 style="margin: 0 0 1rem 0; color: #00d9ff; display: flex; align-items: center; gap: 0.5rem;">
            ☁️ Hosting & Infrastructure
          </h3>
          ${renderHostingInfo(hostingInfo)}
        </div>
        
        <!-- Page Statistics -->
        <div style="background: linear-gradient(135deg, rgba(0, 255, 65, 0.1), rgba(0, 255, 65, 0.02)); border: 1px solid rgba(0, 255, 65, 0.3); border-radius: 12px; padding: 2rem;">
          <h3 style="margin: 0 0 1rem 0; color: #00ff41; display: flex; align-items: center; gap: 0.5rem;">
            📊 Page Statistics
          </h3>
          ${renderPageStats(siteStructure, pages)}
        </div>
      </div>

      <!-- Crawl Options Used -->
      <div style="background: rgba(255,255,255,0.03); padding: 2rem; border-radius: 8px; margin-bottom: 2rem;">
        <h3 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #888;">Crawl Configuration</h3>
        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; font-size: 0.85rem;">
          <span>Max Pages: <strong>${data.options?.maxPages || 'N/A'}</strong></span>
          <span>Max Depth: <strong>${data.options?.maxDepth || 'N/A'}</strong></span>
          <span>Sitemap: <strong>${data.options?.includeSitemap ? '✓' : '✗'}</strong></span>
          <span>Robots.txt: <strong>${data.options?.respectRobotsTxt ? '✓' : '✗'}</strong></span>
        </div>
      </div>

      <!-- Quick Actions -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        <button onclick="analyzeAllFonts('${encodeURIComponent(data.url)}')" style="padding: 1rem; background: #4285f4; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
          🔤 Analyze Fonts (All Pages)
        </button>
        <button onclick="analyzeAllTags('${encodeURIComponent(data.url)}')" style="padding: 1rem; background: #8b5cf6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
          🏷️ Analyze Tags (All Pages)
        </button>
        <button onclick="analyzePerformance('${encodeURIComponent(data.url)}')" style="padding: 1rem; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
          ⚡ Performance Snapshot
        </button>
        <button onclick="copyPagesList()" style="padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
          📋 Copy All URLs
        </button>
      </div>

      <!-- SEO Insights -->
      <div style="background: linear-gradient(135deg, rgba(255, 193, 7, 0.1), rgba(255, 193, 7, 0.02)); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 12px; padding: 2rem; margin-bottom: 2rem;">
        <h3 style="margin: 0 0 1rem 0; color: #ffc107; display: flex; align-items: center; gap: 0.5rem;">
          💡 Quick SEO Insights
        </h3>
        ${renderSeoInsights(pages, siteStructure)}
      </div>

      <!-- Pages List with Filters -->
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
          <h3 style="margin: 0;">📄 Discovered Pages (${pages.length})</h3>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <input type="text" id="pageSearch" placeholder="🔍 Filter pages..." 
              oninput="filterPages(this.value)"
              style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: white; min-width: 200px;">
            <select id="sectionFilter" onchange="filterBySection(this.value)"
              style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: white; cursor: pointer;">
              <option value="">All Sections</option>
              ${Object.keys(siteStructure.children).map(section => `<option value="${section}">/${section}/</option>`).join('')}
            </select>
            <button onclick="toggleViewMode()" id="viewModeBtn" style="padding: 0.5rem 1rem; background: rgba(0, 217, 255, 0.1); color: #00d9ff; border: 1px solid rgba(0, 217, 255, 0.3); border-radius: 6px; cursor: pointer;">
              📁 Group View
            </button>
          </div>
        </div>
        
        <!-- Grouped View (hidden by default) -->
        <div id="groupedView" style="display: none;">
          ${renderGroupedPages(pages, siteStructure)}
        </div>
        
        <!-- List View -->
        <div id="pagesList">
          ${pages.map((page, index) => {
            const pageType = getPageType(page);
            return `
            <div class="page-item" data-url="${page.toLowerCase()}" data-section="${getPageSection(page)}">
              <span style="color: #666; font-size: 0.8rem; min-width: 30px;">${index + 1}.</span>
              <span style="font-size: 1.1rem; margin-right: 0.3rem;">${pageType.icon}</span>
              <a href="${page}" target="_blank" rel="noopener" style="flex: 1;">${formatPageUrl(page)}</a>
              <span style="background: ${pageType.color}; color: white; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; margin-right: 0.5rem;">${pageType.label}</span>
              <div style="display: flex; gap: 0.5rem;">
                <button class="action-btn analyze" onclick="window.open('/tag-intelligence.html?url=${encodeURIComponent(page)}', '_blank')">Tags</button>
                <button class="action-btn analyze" onclick="window.open('/enhanced-fonts.html?url=${encodeURIComponent(page)}', '_blank')">Fonts</button>
              </div>
            </div>
          `}).join('')}
        </div>
        <div id="noResults" style="display: none; text-align: center; padding: 2rem; color: #888;">
          No pages match your filter
        </div>
      </div>

      <!-- Export Options -->
      <div style="margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem;">📥 Export</h3>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <button onclick="downloadJSON()" style="padding: 0.75rem 1.5rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; cursor: pointer;">
            Download JSON
          </button>
          <button onclick="downloadCSV()" style="padding: 0.75rem 1.5rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; cursor: pointer;">
            Download CSV
          </button>
          <button onclick="downloadSitemap()" style="padding: 0.75rem 1.5rem; background: rgba(0,255,65,0.1); color: #00ff41; border: 1px solid rgba(0,255,65,0.3); border-radius: 4px; cursor: pointer;">
            Download Sitemap XML
          </button>
        </div>
      </div>

      <!-- Raw Data -->
      <details style="margin-top: 2rem;">
        <summary style="cursor: pointer; color: #888;">📋 View Raw Data</summary>
        <pre id="rawData" style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.75rem; margin-top: 1rem;">
${JSON.stringify(data, null, 2)}
        </pre>
      </details>

      <!-- Pro Report Block -->
      ${window.ProReportBlock && window.ProReportBlock.render ? `
        <div class="section" style="margin-top: 2rem;">
          ${window.ProReportBlock.render({
            context: 'crawler',
            features: ['pdf', 'csv', 'share'],
            title: 'Unlock Report',
            subtitle: 'PDF export, share link, export data, and fix packs for this scan.'
          })}
        </div>
      ` : ''}
    `;

    resultsContent.innerHTML = `<div class="report-scope">${html}</div>`;

    // Store data for export functions
    window.crawlData = data;
  }

  // Build site structure from URLs
  function buildSiteStructure(pages) {
    const structure = { name: 'root', children: {}, count: 0 };
    
    pages.forEach(url => {
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        const parts = path.split('/').filter(p => p);
        
        let current = structure;
        current.count++;
        
        parts.forEach((part, index) => {
          if (!current.children[part]) {
            current.children[part] = { name: part, children: {}, count: 0, isPage: index === parts.length - 1 };
          }
          current = current.children[part];
          current.count++;
        });
      } catch (e) {
        // Skip invalid URLs
      }
    });
    
    return structure;
  }

  // Detect technology stack from URLs and patterns
  function detectTechStack(pages, data) {
    const stack = {
      cms: null,
      framework: null,
      server: null,
      analytics: [],
      other: []
    };
    
    const urlPatterns = pages.join(' ').toLowerCase();
    
    // CMS Detection
    if (urlPatterns.includes('wp-content') || urlPatterns.includes('wordpress')) {
      stack.cms = { name: 'WordPress', icon: '📝', confidence: 95 };
    } else if (urlPatterns.includes('.aspx')) {
      stack.cms = { name: 'ASP.NET', icon: '🔷', confidence: 90 };
    } else if (urlPatterns.includes('drupal') || urlPatterns.includes('/node/')) {
      stack.cms = { name: 'Drupal', icon: '💧', confidence: 85 };
    } else if (urlPatterns.includes('joomla')) {
      stack.cms = { name: 'Joomla', icon: '🔧', confidence: 85 };
    } else if (urlPatterns.includes('shopify') || urlPatterns.includes('/collections/')) {
      stack.cms = { name: 'Shopify', icon: '🛒', confidence: 80 };
    } else if (urlPatterns.includes('squarespace')) {
      stack.cms = { name: 'Squarespace', icon: '⬛', confidence: 90 };
    } else if (urlPatterns.includes('wix')) {
      stack.cms = { name: 'Wix', icon: '🎨', confidence: 90 };
    }
    
    // Framework detection
    if (urlPatterns.includes('_next') || urlPatterns.includes('next')) {
      stack.framework = { name: 'Next.js', icon: '▲', confidence: 90 };
    } else if (urlPatterns.includes('gatsby')) {
      stack.framework = { name: 'Gatsby', icon: '💜', confidence: 85 };
    } else if (urlPatterns.includes('nuxt') || urlPatterns.includes('_nuxt')) {
      stack.framework = { name: 'Nuxt.js', icon: '💚', confidence: 90 };
    }
    
    // Server technology
    if (urlPatterns.includes('.php')) {
      stack.server = { name: 'PHP', icon: '🐘', confidence: 95 };
    } else if (urlPatterns.includes('.aspx') || urlPatterns.includes('.asp')) {
      stack.server = { name: 'ASP.NET', icon: '🔷', confidence: 95 };
    } else if (urlPatterns.includes('.jsp')) {
      stack.server = { name: 'Java/JSP', icon: '☕', confidence: 90 };
    }
    
    return stack;
  }

  // Detect hosting info from hostname
  function detectHostingInfo(hostname, data) {
    const info = {
      provider: null,
      cdn: null,
      ssl: true,
      domain: hostname
    };
    
    const host = hostname.toLowerCase();
    
    // Hosting providers
    if (host.includes('wpengine') || host.includes('wpenginepowered')) {
      info.provider = { name: 'WP Engine', icon: '🚀', type: 'Managed WordPress' };
    } else if (host.includes('kinsta')) {
      info.provider = { name: 'Kinsta', icon: '⚡', type: 'Managed WordPress' };
    } else if (host.includes('pantheon')) {
      info.provider = { name: 'Pantheon', icon: '🏛️', type: 'WebOps Platform' };
    } else if (host.includes('netlify')) {
      info.provider = { name: 'Netlify', icon: '🔷', type: 'JAMstack' };
    } else if (host.includes('vercel')) {
      info.provider = { name: 'Vercel', icon: '▲', type: 'Edge Platform' };
    } else if (host.includes('heroku')) {
      info.provider = { name: 'Heroku', icon: '💜', type: 'PaaS' };
    } else if (host.includes('amazonaws') || host.includes('aws')) {
      info.provider = { name: 'AWS', icon: '🟧', type: 'Cloud Infrastructure' };
    } else if (host.includes('azure')) {
      info.provider = { name: 'Azure', icon: '🔵', type: 'Cloud Infrastructure' };
    } else if (host.includes('cloudflare')) {
      info.provider = { name: 'Cloudflare', icon: '☁️', type: 'Edge/CDN' };
    } else if (host.includes('shopify')) {
      info.provider = { name: 'Shopify', icon: '🛒', type: 'E-commerce' };
    } else if (host.includes('squarespace')) {
      info.provider = { name: 'Squarespace', icon: '⬛', type: 'Website Builder' };
    } else if (host.includes('wix')) {
      info.provider = { name: 'Wix', icon: '🎨', type: 'Website Builder' };
    } else if (host.includes('godaddy')) {
      info.provider = { name: 'GoDaddy', icon: '🌐', type: 'Shared Hosting' };
    } else if (host.includes('bluehost')) {
      info.provider = { name: 'Bluehost', icon: '🔵', type: 'Shared Hosting' };
    } else if (host.includes('siteground')) {
      info.provider = { name: 'SiteGround', icon: '🟠', type: 'Shared Hosting' };
    }
    
    return info;
  }

  // Render visual sitemap diagram - clean hierarchical flow
  function renderSitemapDiagram(structure, hostname) {
    const topLevelSections = Object.keys(structure.children);
    
    if (topLevelSections.length === 0) {
      return '<div style="text-align: center; color: #666; padding: 2rem;">No directory structure detected (flat site)</div>';
    }
    
    const isDark = !document.body.classList.contains('white-theme');
    const nodeStroke = isDark ? '#fff' : '#000';
    const nodeFill = isDark ? '#000' : '#fff';
    const lineColor = isDark ? '#666' : '#ccc';
    const textColor = isDark ? '#fff' : '#000';
    
    // Build SVG tree diagram
    let html = `
      <style>
        .tree-diagram {
          width: 100%;
          min-height: 800px;
          padding: 2rem;
          overflow-x: auto;
        }
        .tree-node {
          cursor: default;
        }
        .tree-node rect {
          transition: all 0.2s ease;
        }
        .tree-node:hover rect {
          filter: brightness(1.1);
        }
      </style>
      <svg class="tree-diagram" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMin meet">
    `;
    
    const rootX = 800;
    const rootY = 60;
    const rootWidth = 200;
    const rootHeight = 60;
    
    // Draw root node
    html += `
      <g class="tree-node">
        <rect x="${rootX - rootWidth/2}" y="${rootY - rootHeight/2}" 
              width="${rootWidth}" height="${rootHeight}" 
              fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="3" rx="4"/>
        <text x="${rootX}" y="${rootY}" 
              text-anchor="middle" dominant-baseline="middle" 
              fill="${textColor}" font-weight="bold" font-size="16">
          ${hostname || 'Home'}
        </text>
      </g>
    `;
    
    // Calculate section positions
    const sectionCount = Math.min(topLevelSections.length, 6);
    const sectionSpacing = 1500 / (sectionCount + 1);
    const sectionY = 200;
    
    // Draw vertical line from root
    html += `<line x1="${rootX}" y1="${rootY + rootHeight/2}" x2="${rootX}" y2="${sectionY - 80}" stroke="${lineColor}" stroke-width="2"/>`;
    
    // Draw horizontal line connecting all sections
    if (sectionCount > 1) {
      const startX = 50 + sectionSpacing;
      const endX = 50 + sectionSpacing * sectionCount;
      html += `<line x1="${startX}" y1="${sectionY - 60}" x2="${endX}" y2="${sectionY - 60}" stroke="${lineColor}" stroke-width="2"/>`;
    }
    
    // Draw sections
    topLevelSections.slice(0, 6).forEach((section, i) => {
      const sectionData = structure.children[section];
      const sectionX = 50 + sectionSpacing * (i + 1);
      const sectionWidth = 140;
      const sectionHeight = 50;
      const sectionName = section.replace(/-/g, ' ');
      
      // Vertical line to section
      html += `<line x1="${sectionX}" y1="${sectionY - 60}" x2="${sectionX}" y2="${sectionY - 20}" stroke="${lineColor}" stroke-width="2"/>`;
      
      // Section node
      html += `
        <g class="tree-node">
          <rect x="${sectionX - sectionWidth/2}" y="${sectionY - sectionHeight/2}" 
                width="${sectionWidth}" height="${sectionHeight}" 
                fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="2" rx="4"/>
          <text x="${sectionX}" y="${sectionY - 5}" 
                text-anchor="middle" dominant-baseline="middle" 
                fill="${textColor}" font-weight="600" font-size="13">
            ${sectionName.length > 18 ? sectionName.slice(0, 16) + '...' : sectionName}
          </text>
          <text x="${sectionX}" y="${sectionY + 12}" 
                text-anchor="middle" dominant-baseline="middle" 
                fill="${isDark ? '#888' : '#666'}" font-size="10">
            ${sectionData.count} page${sectionData.count !== 1 ? 's' : ''}
          </text>
        </g>
      `;
      
      // Draw child pages
      const childPages = Object.entries(sectionData.children || {}).slice(0, 2);
      if (childPages.length > 0) {
        const pageY = sectionY + 110;
        const pageWidth = 95;
        const pageHeight = 35;
        
        // Critical: Prevent overlap by strictly constraining pages within section boundaries
        // Each section owns a territory of sectionSpacing width, but we only use half to add buffer
        const safeBoundary = sectionSpacing * 0.4; // only use 40% of available space
        const totalPageWidth = pageWidth * childPages.length;
        const minGap = 15; // minimum gap between page nodes
        const neededSpace = totalPageWidth + (minGap * (childPages.length - 1));
        
        // If pages would overflow the safe boundary, reduce their count or spacing
        let actualSpacing;
        if (neededSpace > safeBoundary) {
          // Pages would overlap - use tight spacing within boundary
          actualSpacing = childPages.length === 1 ? 0 : (safeBoundary - totalPageWidth) / (childPages.length - 1);
        } else {
          // Plenty of space - use comfortable spacing
          actualSpacing = childPages.length === 1 ? 0 : pageWidth + minGap;
        }
        
        const pageSpacing = actualSpacing;
        
        // Vertical line from section to pages area
        html += `<line x1="${sectionX}" y1="${sectionY + sectionHeight/2}" x2="${sectionX}" y2="${pageY - 40}" stroke="${lineColor}" stroke-width="2"/>`;
        
        // Horizontal line for pages
        if (childPages.length > 1) {
          const pageStartX = sectionX - (childPages.length - 1) * pageSpacing / 2;
          const pageEndX = sectionX + (childPages.length - 1) * pageSpacing / 2;
          html += `<line x1="${pageStartX}" y1="${pageY - 20}" x2="${pageEndX}" y2="${pageY - 20}" stroke="${lineColor}" stroke-width="1.5"/>`;
        }
        
        childPages.forEach(([pageName, pageData], j) => {
          const pageX = sectionX - (childPages.length - 1) * pageSpacing / 2 + j * pageSpacing;
          const pageTitle = pageName.replace(/-/g, ' ');
          const subcount = pageData.children ? Object.keys(pageData.children).length : 0;
          
          // Vertical line to page
          html += `<line x1="${pageX}" y1="${pageY - 20}" x2="${pageX}" y2="${pageY - 10}" stroke="${lineColor}" stroke-width="1.5"/>`;
          
          // Page node
          html += `
            <g class="tree-node">
              <rect x="${pageX - pageWidth/2}" y="${pageY - pageHeight/2}" 
                    width="${pageWidth}" height="${pageHeight}" 
                    fill="${nodeFill}" stroke="${nodeStroke}" stroke-width="1.5" rx="3"/>
              <text x="${pageX}" y="${pageY}" 
                    text-anchor="middle" dominant-baseline="middle" 
                    fill="${textColor}" font-size="10">
                ${pageTitle.length > 12 ? pageTitle.slice(0, 10) + '...' : pageTitle}
              </text>
              ${subcount > 0 ? `
                <text x="${pageX}" y="${pageY + 12}" 
                      text-anchor="middle" dominant-baseline="middle" 
                      fill="${isDark ? '#888' : '#666'}" font-size="8">
                  +${subcount}
                </text>
              ` : ''}
            </g>
          `;
        });
        
        // Show "more" indicator if there are additional pages
        const remainingPages = Object.keys(sectionData.children || {}).length - 2;
        if (remainingPages > 0) {
          html += `
            <text x="${sectionX}" y="${pageY + 45}" 
                  text-anchor="middle" 
                  fill="${isDark ? '#666' : '#999'}" font-size="11" font-style="italic">
              +${remainingPages} more...
            </text>
          `;
        }
      }
    });
    
    html += `</svg>`;
    return html;
  }

  // Render site tree
  function renderSiteTree(structure) {
    const sections = Object.entries(structure.children);
    if (sections.length === 0) {
      return '<div style="color: #888;">Flat site structure (no directories)</div>';
    }
    
    return sections.slice(0, 6).map(([name, data]) => {
      const children = Object.keys(data.children || {});
      const color = getColorForSection(name);
      
      return `
        <div style="background: rgba(0,0,0,0.3); border-left: 3px solid ${color}; padding: 1rem; border-radius: 0 8px 8px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="color: ${color}; font-weight: bold; font-size: 0.95rem;">/${name}/</span>
            <span style="background: ${color}20; color: ${color}; padding: 0.2rem 0.5rem; border-radius: 10px; font-size: 0.75rem;">${data.count} pages</span>
          </div>
          ${children.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem;">
              ${children.slice(0, 5).map(child => `
                <span style="background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: #888;">/${child}</span>
              `).join('')}
              ${children.length > 5 ? `<span style="color: #666; font-size: 0.75rem;">+${children.length - 5} more</span>` : ''}
            </div>
          ` : '<div style="color: #666; font-size: 0.8rem; font-style: italic;">No subdirectories</div>'}
        </div>
      `;
    }).join('');
  }

  function getColorForSection(name) {
    const colors = ['#00ff41', '#00d9ff', '#bb77ff', '#ffd700', '#ff6b6b', '#4ecdc4'];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  // Render tech stack
  function renderTechStack(stack) {
    let html = '<div style="display: flex; flex-direction: column; gap: 0.75rem;">';
    
    if (stack.cms) {
      html += `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.5rem;">${stack.cms.icon}</span>
          <div>
            <div style="color: #fff; font-weight: bold;">${stack.cms.name}</div>
            <div style="color: #888; font-size: 0.75rem;">${stack.cms.confidence}% confidence</div>
          </div>
        </div>
      `;
    }
    
    if (stack.framework) {
      html += `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.5rem;">${stack.framework.icon}</span>
          <div>
            <div style="color: #fff; font-weight: bold;">${stack.framework.name}</div>
            <div style="color: #888; font-size: 0.75rem;">Framework detected</div>
          </div>
        </div>
      `;
    }
    
    if (stack.server) {
      html += `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.5rem;">${stack.server.icon}</span>
          <div>
            <div style="color: #fff; font-weight: bold;">${stack.server.name}</div>
            <div style="color: #888; font-size: 0.75rem;">Server technology</div>
          </div>
        </div>
      `;
    }
    
    if (!stack.cms && !stack.framework && !stack.server) {
      html += '<div style="color: #888;">Could not detect specific technologies. Run full scan for detailed analysis.</div>';
    }
    
    html += '</div>';
    return html;
  }

  // Render hosting info
  function renderHostingInfo(info) {
    let html = '<div style="display: flex; flex-direction: column; gap: 0.75rem;">';
    
    html += `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.2rem;">🌐</span>
        <div>
          <div style="color: #fff; font-family: monospace;">${info.domain}</div>
          <div style="color: #888; font-size: 0.75rem;">Domain</div>
        </div>
      </div>
    `;
    
    if (info.provider) {
      html += `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.5rem;">${info.provider.icon}</span>
          <div>
            <div style="color: #fff; font-weight: bold;">${info.provider.name}</div>
            <div style="color: #888; font-size: 0.75rem;">${info.provider.type}</div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.2rem;">☁️</span>
          <div>
            <div style="color: #fff;">Custom/Unknown Hosting</div>
            <div style="color: #888; font-size: 0.75rem;">Use IP Reputation tool for details</div>
          </div>
        </div>
      `;
    }
    
    html += `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.2rem;">🔒</span>
        <div>
          <div style="color: #00ff41;">SSL/HTTPS Active</div>
          <div style="color: #888; font-size: 0.75rem;">Secure connection</div>
        </div>
      </div>
    `;
    
    html += '</div>';
    return html;
  }

  // Render page statistics
  function renderPageStats(structure, pages) {
    const sections = Object.keys(structure.children).length;
    const avgDepth = pages.reduce((sum, url) => {
      try {
        return sum + new URL(url).pathname.split('/').filter(p => p).length;
      } catch (e) { return sum; }
    }, 0) / Math.max(pages.length, 1);
    
    const extensions = {};
    pages.forEach(url => {
      const ext = url.split('.').pop().split('?')[0].toLowerCase();
      if (['html', 'htm', 'php', 'aspx', 'asp', 'jsp'].includes(ext)) {
        extensions[ext] = (extensions[ext] || 0) + 1;
      }
    });
    
    return `
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #888;">Total Pages</span>
          <span style="color: #00ff41; font-weight: bold; font-size: 1.25rem;">${pages.length}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #888;">Top-level Sections</span>
          <span style="color: #00d9ff; font-weight: bold;">${sections}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #888;">Avg Path Depth</span>
          <span style="color: #bb77ff; font-weight: bold;">${avgDepth.toFixed(1)} levels</span>
        </div>
        ${Object.keys(extensions).length > 0 ? `
          <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="color: #888; font-size: 0.8rem; margin-bottom: 0.5rem;">File Types:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
              ${Object.entries(extensions).map(([ext, count]) => `
                <span style="background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: #ffd700;">.${ext}: ${count}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Get page type info (icon and label)
  function getPageType(url) {
    const path = url.toLowerCase();
    if (path.includes('/blog') || path.includes('/article') || path.includes('/news') || path.includes('/post')) {
      return { icon: '📝', label: 'Blog', color: '#8b5cf6' };
    }
    if (path.includes('/product') || path.includes('/shop') || path.includes('/store') || path.includes('/item')) {
      return { icon: '🛒', label: 'Product', color: '#10b981' };
    }
    if (path.includes('/about') || path.includes('/team') || path.includes('/company')) {
      return { icon: '👥', label: 'About', color: '#6366f1' };
    }
    if (path.includes('/contact') || path.includes('/support') || path.includes('/help')) {
      return { icon: '📞', label: 'Contact', color: '#ec4899' };
    }
    if (path.includes('/event') || path.includes('/calendar') || path.includes('/schedule')) {
      return { icon: '📅', label: 'Event', color: '#f59e0b' };
    }
    if (path.includes('/gallery') || path.includes('/photo') || path.includes('/image') || path.includes('/media')) {
      return { icon: '🖼️', label: 'Media', color: '#14b8a6' };
    }
    if (path.includes('/faq') || path.includes('/question')) {
      return { icon: '❓', label: 'FAQ', color: '#f97316' };
    }
    if (path.includes('/login') || path.includes('/signin') || path.includes('/account') || path.includes('/register')) {
      return { icon: '🔐', label: 'Auth', color: '#ef4444' };
    }
    if (path.includes('/search') || path.includes('/find')) {
      return { icon: '🔍', label: 'Search', color: '#3b82f6' };
    }
    if (path.match(/\.(pdf|doc|docx|xls|xlsx)$/i)) {
      return { icon: '📄', label: 'Document', color: '#dc2626' };
    }
    if (path.match(/\/$/) || path.split('/').filter(p => p).length <= 1) {
      return { icon: '🏠', label: 'Main', color: '#22c55e' };
    }
    return { icon: '📃', label: 'Page', color: '#64748b' };
  }

  // Get page section for filtering
  function getPageSection(url) {
    try {
      const path = new URL(url).pathname;
      const parts = path.split('/').filter(p => p);
      return parts[0] || 'root';
    } catch (e) {
      return 'root';
    }
  }

  // Format page URL for display
  function formatPageUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch (e) {
      return url;
    }
  }

  // Render SEO insights
  function renderSeoInsights(pages, structure) {
    const insights = [];
    
    // URL length analysis
    const longUrls = pages.filter(url => url.length > 100);
    if (longUrls.length > 0) {
      insights.push({ icon: '⚠️', text: `${longUrls.length} URLs exceed 100 characters (may affect SEO)`, type: 'warning' });
    } else {
      insights.push({ icon: '✅', text: 'All URLs are reasonably short', type: 'success' });
    }
    
    // Query parameter detection
    const queryUrls = pages.filter(url => url.includes('?'));
    if (queryUrls.length > 0) {
      insights.push({ icon: '📊', text: `${queryUrls.length} pages use query parameters`, type: 'info' });
    }
    
    // Deep nesting detection
    const deepPages = pages.filter(url => {
      try {
        return new URL(url).pathname.split('/').filter(p => p).length > 4;
      } catch (e) { return false; }
    });
    if (deepPages.length > 0) {
      insights.push({ icon: '📁', text: `${deepPages.length} pages are deeply nested (5+ levels)`, type: 'warning' });
    }
    
    // Orphan sections (only 1 page)
    const orphanSections = Object.entries(structure.children).filter(([, data]) => data.count === 1);
    if (orphanSections.length > 0) {
      insights.push({ icon: '🔗', text: `${orphanSections.length} sections have only 1 page`, type: 'info' });
    }
    
    // File extension diversity
    const extensions = new Set(pages.map(url => {
      const ext = url.split('.').pop().split('?')[0].toLowerCase();
      return ['html', 'htm', 'php', 'aspx', 'asp', 'jsp'].includes(ext) ? ext : 'clean';
    }));
    if (extensions.size > 2) {
      insights.push({ icon: '🔀', text: `Multiple URL formats detected (${extensions.size} types)`, type: 'info' });
    }
    
    // Good structure check
    const avgPagesPerSection = pages.length / Math.max(Object.keys(structure.children).length, 1);
    if (avgPagesPerSection > 2 && avgPagesPerSection < 20) {
      insights.push({ icon: '✅', text: 'Well-organized site structure', type: 'success' });
    }
    
    const typeColors = { success: '#00ff41', warning: '#ffc107', info: '#00d9ff' };
    
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75rem;">
        ${insights.map(insight => `
          <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: rgba(0,0,0,0.2); border-radius: 6px; border-left: 3px solid ${typeColors[insight.type]};">
            <span style="font-size: 1.1rem;">${insight.icon}</span>
            <span style="color: #ddd; font-size: 0.9rem;">${insight.text}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Render grouped pages view
  function renderGroupedPages(pages, structure) {
    const groups = {};
    pages.forEach(url => {
      const section = getPageSection(url);
      if (!groups[section]) groups[section] = [];
      groups[section].push(url);
    });
    
    return Object.entries(groups).map(([section, sectionPages]) => `
      <details style="margin-bottom: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <summary style="padding: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: #00d9ff;">📁</span>
            <strong>/${section}/</strong>
          </span>
          <span style="background: rgba(0, 217, 255, 0.2); color: #00d9ff; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
            ${sectionPages.length} page${sectionPages.length !== 1 ? 's' : ''}
          </span>
        </summary>
        <div style="padding: 0 1rem 1rem 1rem;">
          ${sectionPages.map((page, idx) => {
            const pageType = getPageType(page);
            return `
              <div class="page-item" style="padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span style="font-size: 1rem; margin-right: 0.3rem;">${pageType.icon}</span>
                <a href="${page}" target="_blank" rel="noopener" style="flex: 1; font-size: 0.9rem;">${formatPageUrl(page)}</a>
                <div style="display: flex; gap: 0.5rem;">
                  <button class="action-btn analyze" onclick="window.open('/tag-intelligence.html?url=${encodeURIComponent(page)}', '_blank')">Tags</button>
                  <button class="action-btn analyze" onclick="window.open('/enhanced-fonts.html?url=${encodeURIComponent(page)}', '_blank')">Fonts</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </details>
    `).join('');
  }

  // Filter pages by search term
  window.filterPages = function(searchTerm) {
    const pagesList = document.getElementById('pagesList');
    const noResults = document.getElementById('noResults');
    const items = pagesList.querySelectorAll('.page-item');
    let visibleCount = 0;
    
    items.forEach(item => {
      const url = item.dataset.url || '';
      const matches = url.includes(searchTerm.toLowerCase());
      item.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });
    
    noResults.style.display = visibleCount === 0 ? 'block' : 'none';
  };

  // Filter pages by section
  window.filterBySection = function(section) {
    const pagesList = document.getElementById('pagesList');
    const noResults = document.getElementById('noResults');
    const items = pagesList.querySelectorAll('.page-item');
    let visibleCount = 0;
    
    items.forEach(item => {
      const itemSection = item.dataset.section || '';
      const matches = !section || itemSection === section;
      item.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });
    
    noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    document.getElementById('pageSearch').value = '';
  };

  // Toggle between list and grouped view
  window.toggleViewMode = function() {
    const listView = document.getElementById('pagesList');
    const groupedView = document.getElementById('groupedView');
    const btn = document.getElementById('viewModeBtn');
    
    if (listView.style.display === 'none') {
      listView.style.display = '';
      groupedView.style.display = 'none';
      btn.textContent = '📁 Group View';
    } else {
      listView.style.display = 'none';
      groupedView.style.display = '';
      btn.textContent = '📋 List View';
    }
  };

  // Global functions for button handlers
  window.analyzeAllFonts = function(url) {
    const maxPages = window.crawlData?.results?.pagesDiscovered || 5;
    window.location.href = `/enhanced-fonts.html?url=${url}&maxPages=${Math.min(maxPages, 10)}`;
  };

  window.analyzeAllTags = function(url) {
    const maxPages = window.crawlData?.results?.pagesDiscovered || 5;
    window.location.href = `/tag-intelligence.html?url=${url}&maxPages=${Math.min(maxPages, 10)}`;
  };

  window.analyzePerformance = function(url) {
    window.location.href = `/performance-snapshot.html?url=${url}`;
  };

  window.copyPagesList = function() {
    const pages = window.crawlData?.results?.pages || [];
    const text = pages.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      alert(`Copied ${pages.length} URLs to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  window.downloadJSON = function() {
    const data = window.crawlData;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crawl-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  window.downloadCSV = function() {
    const pages = window.crawlData?.results?.pages || [];
    const csv = 'URL\n' + pages.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crawl-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  window.downloadSitemap = function() {
    const pages = window.crawlData?.results?.pages || [];
    const hostname = window.crawlData?.results?.hostname || 'unknown';
    const now = new Date().toISOString();
    
    // Generate XML sitemap following sitemaps.org protocol
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    pages.forEach(pageUrl => {
      // Ensure URL is absolute
      let fullUrl = pageUrl;
      if (!pageUrl.startsWith('http')) {
        fullUrl = `https://${hostname}${pageUrl.startsWith('/') ? '' : '/'}${pageUrl}`;
      }
      
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(fullUrl)}</loc>\n`;
      xml += `    <lastmod>${now.split('T')[0]}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    });
    
    xml += '</urlset>';
    
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitemap-${hostname}-${new Date().toISOString().split('T')[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Print the visual sitemap
   */
  window.printSitemap = function() {
    const sitemapSection = document.getElementById('sitemapSection');
    if (!sitemapSection) {
      alert('No sitemap to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    const hostname = window.crawlData?.results?.hostname || 'website';
    const pageCount = window.crawlData?.results?.pages?.length || 0;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Visual Sitemap - ${hostname}</title>
        <style>
          @page { 
            size: landscape;
            margin: 1cm; 
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: white;
            color: black;
            padding: 20px;
            margin: 0;
          }
          h1 {
            color: #00994d;
            margin-bottom: 10px;
            font-size: 24px;
          }
          .meta {
            color: #666;
            margin-bottom: 20px;
            font-size: 14px;
          }
          .sitemap-container {
            background: white;
            border: 2px solid #00994d;
            border-radius: 8px;
            padding: 20px;
            overflow: visible;
          }
          svg {
            width: 100%;
            height: auto;
          }
          .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #888;
            text-align: center;
          }
          @media print {
            body { 
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <h1>🗺️ Visual Sitemap</h1>
        <div class="meta">
          <strong>${hostname}</strong> • ${pageCount} pages discovered • Generated ${new Date().toLocaleDateString()}
        </div>
        <div class="sitemap-container">
          ${document.getElementById('sitemapDiagram')?.innerHTML || '<p>No sitemap data available</p>'}
        </div>
        <div class="footer">
          Generated by Site Mechanic | sitemechanic.io
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  /**
   * Download sitemap as image (SVG or PNG)
   */
  window.downloadSitemapImage = async function() {
    const sitemapDiagram = document.getElementById('sitemapDiagram');
    if (!sitemapDiagram) {
      alert('No sitemap to download');
      return;
    }

    const svgElement = sitemapDiagram.querySelector('svg');
    if (!svgElement) {
      alert('No sitemap diagram found');
      return;
    }

    try {
      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true);
      
      // Create SVG blob
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      // Download SVG
      const hostname = window.crawlData?.results?.hostname || 'website';
      const a = document.createElement('a');
      a.href = svgUrl;
      a.download = `sitemap-${hostname}-${new Date().toISOString().split('T')[0]}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(svgUrl);
      
      // Show success message
      const button = event?.target;
      if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '✓ Downloaded!';
        button.style.background = 'rgba(0, 255, 65, 0.2)';
        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.background = 'rgba(0, 217, 255, 0.1)';
        }, 2000);
      }
    } catch (error) {
      console.error('Error downloading sitemap:', error);
      alert('Failed to download sitemap. Please try again.');
    }
  };

  // Helper function to escape XML special characters
  function escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Add ASCII art patience message to loading container
   */
  function addPatienceMessage(container) {
    // Remove existing patience message if any
    const existing = document.getElementById('patience-message');
    if (existing) existing.remove();
    
    const patienceEl = document.createElement('div');
    patienceEl.id = 'patience-message';
    patienceEl.style.cssText = `
      margin: 0 0 1.5rem 0;
      padding: 1rem;
      background: rgba(0, 255, 65, 0.05);
      border: 1px solid rgba(0, 255, 65, 0.3);
      border-radius: 6px;
      text-align: center;
      overflow: visible;
    `;
    patienceEl.innerHTML = `
      <div style="overflow-x: auto; overflow-y: visible;">
        <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: #00ff41; font-family: monospace; text-shadow: 2px 2px 0px rgba(0, 255, 65, 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
      </div>
      <div style="margin-top: 0.75rem; font-size: 0.85rem; color: #00ff41;">
        🕷️ Crawling pages with Puppeteer...<br>
        <span style="font-size: 0.75rem; color: #00ffaa;">This may take 30-60 seconds for large sites</span>
      </div>
    `;
    
    // Add animations if not already added
    if (!document.getElementById('patience-animations')) {
      const style = document.createElement('style');
      style.id = 'patience-animations';
      style.textContent = `
        @keyframes color-cycle {
          0% { color: #00ff41; }
          20% { color: #00ffaa; }
          40% { color: #00aaff; }
          60% { color: #aa00ff; }
          80% { color: #ff00aa; }
          100% { color: #00ff41; }
        }
        @keyframes fade-in-out {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .ascii-art-responsive {
          font-size: clamp(0.35rem, 1.2vw, 0.65rem);
          white-space: pre;
          max-width: 100%;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Insert at the beginning of the loading container
    const loaderDiv = container.querySelector('.analyzer-loading');
    if (loaderDiv) {
      loaderDiv.insertBefore(patienceEl, loaderDiv.firstChild);
    } else {
      container.insertBefore(patienceEl, container.firstChild);
    }
  }
});
