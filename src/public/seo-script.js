/**
 * SEO Analyzer Frontend
 * Handles SEO scan submissions and results display
 */

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('seoUrlInput');
  const submitButton = document.getElementById('seoAnalyzeButton');
  const resultsContainer = document.getElementById('seoResults');
  
  // Create loading container if it doesn't exist
  let loadingContainer = document.getElementById('loadingContainer');
  if (!loadingContainer) {
    loadingContainer = document.createElement('div');
    loadingContainer.id = 'loadingContainer';
    resultsContainer.parentNode.insertBefore(loadingContainer, resultsContainer);
  }

  // Handle button click
  submitButton.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please enter a URL');
      return;
    }

    // Disable button during scan
    submitButton.disabled = true;
    submitButton.textContent = 'ANALYZING...';
    submitButton.style.opacity = '0.6';
    urlInput.disabled = true;

    // Show loading state with new animation
    resultsContainer.style.display = 'none';
    const loader = new AnalyzerLoader('loadingContainer');
    loader.start([
      { label: 'Running comprehensive SEO analysis', detail: 'Initializing scan engine...' },
      { label: 'Checking meta tags', detail: 'Analyzing title, description, keywords...' },
      { label: 'Analyzing content quality', detail: 'Evaluating headings, text, readability...' },
      { label: 'Testing mobile responsiveness', detail: 'Checking viewport and layout...' },
      { label: 'Measuring performance', detail: 'Testing load speed and optimization...' }
    ], '[SEO ANALYZER]', 30);

    try {
      const response = await fetch('/api/seo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'SEO analysis failed');
      }

      if (data.success) {
        loader.complete();
        setTimeout(() => {
          displaySEOResults(data.results);
        }, 1000);
      } else {
        loader.showError(data.message || data.error || 'SEO analysis failed');
      }

    } catch (error) {
      console.error('SEO scan error:', error);
      loader.showError(error.message || 'Failed to analyze website. Please try again.');
    } finally {
      // Re-enable button
      submitButton.disabled = false;
      submitButton.textContent = 'ANALYZE SEO';
      submitButton.style.opacity = '1';
      urlInput.disabled = false;
    }
  });

  // Allow Enter key to submit
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitButton.click();
    }
  });
});

/**
 * Display SEO analysis results
 */
function displaySEOResults(results) {
  const container = document.getElementById('seoResults');
  
  // Prepare component scores for visualizations
  const componentScores = {};
  Object.entries(results.score.breakdown || {}).forEach(([key, data]) => {
    componentScores[formatComponentName(key)] = data.score;
  });
  
  // Clear container
  container.innerHTML = '';
  container.style.display = 'block';
  
  // Executive Summary (not in accordion)
  const summarySection = document.createElement('div');
  summarySection.className = 'section';
  summarySection.innerHTML = `
    <h2>[SEO_ANALYSIS_RESULTS]</h2>
    <p>>> url: ${results.url}</p>
    <p>>> timestamp: ${new Date(results.timestamp).toLocaleString()}</p>
    
    <!-- Enhanced Overall Score Display with SVG Circular Dials -->
    <div style="
      background: linear-gradient(135deg, rgba(0,255,65,0.05) 0%, rgba(0,255,65,0.02) 100%);
      border: 2px solid ${getScoreColor(results.score.overall)};
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
      box-shadow: 0 4px 20px rgba(0,255,65,0.15);
    ">
      <h3 style="color: #00ff41; margin: 0 0 1.5rem 0; font-size: 1.3rem;">>> SEO Audit Summary</h3>
      
      <!-- Circular Progress Dials -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 2rem; margin: 2rem 0;">
        <!-- Overall Score -->
        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff; font-size: 1.1rem;">Overall SEO Score</div>
          <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
            <circle
              cx="90"
              cy="90"
              r="75"
              fill="none"
              stroke="rgba(0, 0, 0, 0.1)"
              stroke-width="10"
            />
            <circle
              cx="90"
              cy="90"
              r="75"
              fill="none"
              stroke="${getScoreColor(results.score.overall)}"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${(results.score.overall / 100) * 471.24} 471.24"
              transform="rotate(-90 90 90)"
            />
            <text
              x="90"
              y="90"
              text-anchor="middle"
              dy="0.35em"
              font-size="3.5rem"
              font-weight="bold"
              fill="#ffffff"
              style="text-shadow: 0 0 10px ${getScoreColor(results.score.overall)}, 0 0 20px ${getScoreColor(results.score.overall)};"
            >
              ${results.score.overall}
            </text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${getScoreColor(results.score.overall)}; font-weight: 600; font-size: 1.1rem;">
            Grade: ${results.score.grade}
          </div>
        </div>

        ${Object.entries(results.score.breakdown || {}).slice(0, 3).map(([key, data]) => `
          <div style="text-align: center;">
            <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">${formatComponentName(key)}</div>
            <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
              <circle
                cx="90"
                cy="90"
                r="75"
                fill="none"
                stroke="rgba(0, 0, 0, 0.1)"
                stroke-width="10"
              />
              <circle
                cx="90"
                cy="90"
                r="75"
                fill="none"
                stroke="${getScoreColor(data.score)}"
                stroke-width="10"
                stroke-linecap="round"
                stroke-dasharray="${(data.score / 100) * 471.24} 471.24"
                transform="rotate(-90 90 90)"
              />
              <text
                x="90"
                y="90"
                text-anchor="middle"
                dy="0.35em"
                font-size="3.5rem"
                font-weight="bold"
                fill="#ffffff"
                style="text-shadow: 0 0 10px ${getScoreColor(data.score)}, 0 0 20px ${getScoreColor(data.score)};"
              >
                ${data.score}
              </text>
            </svg>
            <div style="margin-top: 0.5rem; color: ${getScoreColor(data.score)}; font-weight: 600; font-size: 1.1rem;">
              ${data.score}/100
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <!-- PDF Download Button -->
    <div style="text-align: center; margin: 2rem 0; padding: 2rem; background: rgba(187, 134, 252, 0.05); border: 2px solid rgba(187, 134, 252, 0.3); border-radius: 12px;">
      <h3 style="color: #bb86fc; margin: 0 0 1rem 0;">📄 Professional PDF Report</h3>
      <p style="color: #c0c0c0; margin: 0 0 1.5rem 0;">
        Get a comprehensive PDF report with detailed analysis, recommendations, and insights.
      </p>
      <button 
        id="seoPdfDownloadButton"
        style="
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #bb86fc 0%, #9d5fdb 100%);
          border: none;
          border-radius: 8px;
          color: #000000;
          font-size: 1.1rem;
          font-weight: bold;
          font-family: 'Courier New', monospace;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 15px rgba(187, 134, 252, 0.3);
        "
        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(187, 134, 252, 0.5)';"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(187, 134, 252, 0.3)';"
        onclick="openPdfPurchaseModal('seo')"
      >
        📥 Download PDF Report ($5)
      </button>
      <p style="color: #808080; font-size: 0.85rem; margin: 1rem 0 0 0; font-style: italic;">
        Secure payment • Instant download • One-time purchase
      </p>
    </div>
  `;
  container.appendChild(summarySection);
  
  // Store results globally for PDF generation
  window.currentSeoResults = results;
  
  // Create accordion sections for each analysis category
  createAccordionSection(container, 'meta-tags', 'Meta Tags Analysis', () => renderMetaTagsContent(results.metaTags), results.metaTags.score);
  createAccordionSection(container, 'heading-structure', 'Heading Structure', () => renderHeadingStructureContent(results.headingStructure), results.headingStructure.score);
  createAccordionSection(container, 'content-analysis', 'Content Analysis', () => renderContentAnalysisContent(results.contentAnalysis), results.contentAnalysis.score);
  createAccordionSection(container, 'image-analysis', 'Image Analysis', () => renderImageAnalysisContent(results.imageAnalysis), results.imageAnalysis.score);
  createAccordionSection(container, 'link-analysis', 'Link Analysis', () => renderLinkAnalysisContent(results.linkAnalysis), results.linkAnalysis.score);
  createAccordionSection(container, 'mobile-responsive', 'Mobile Responsiveness', () => renderMobileResponsivenessContent(results.mobileResponsive), results.mobileResponsive.score);
  createAccordionSection(container, 'performance', 'Performance Metrics', () => renderPerformanceMetricsContent(results.performanceMetrics), results.performanceMetrics.score);
  createAccordionSection(container, 'security', 'Security Headers', () => renderSecurityHeadersContent(results.securityHeaders), results.securityHeaders.score);
  createAccordionSection(container, 'structured-data', 'Structured Data Schema', () => renderStructuredDataContent(results.structuredData), results.structuredData.score);
  createAccordionSection(container, 'additional-checks', 'Additional Checks', () => renderAdditionalChecksContent(results.additionalChecks), results.additionalChecks.score);
  
  // Summary section (not in accordion)
  const summaryFooter = document.createElement('div');
  summaryFooter.className = 'section';
  summaryFooter.innerHTML = `
    <h2>[SUMMARY]</h2>
    <div class="seo-summary">
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-value">${countTotalIssues(results)}</span>
          <span class="stat-label">Issues Found</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${countTotalRecommendations(results)}</span>
          <span class="stat-label">Recommendations</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${countPassedChecks(results)}</span>
          <span class="stat-label">Checks Passed</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(summaryFooter);

  // Animate score circle
  animateScoreCircle(results.score.overall);
}

/**
 * Initialize accordion functionality for collapsible sections
 */
function initializeAccordions() {
  const collapsibleSections = document.querySelectorAll('.section.collapsible');
  
  collapsibleSections.forEach(section => {
    const header = section.querySelector('.section-header');
    const content = section.querySelector('.section-content');
    
    if (header && content) {
      // Add click event to header
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        const isExpanded = section.classList.contains('expanded');
        
        if (isExpanded) {
          section.classList.remove('expanded');
          content.style.display = 'none';
        } else {
          section.classList.add('expanded');
          content.style.display = 'block';
        }
      });
      
      // Start expanded
      section.classList.add('expanded');
      content.style.display = 'block';
    }
  });
}

/**
 * Create an accordion section (similar to font scanner)
 */
function createAccordionSection(container, id, displayTitle, contentCreator, score) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  header.innerHTML = `
    <span>${displayTitle}</span>
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      <span style="color: ${getScoreColor(score)}; font-size: 0.9rem;">${score}/100</span>
      <span class="accordion-toggle">▼</span>
    </span>
  `;
  
  const content = document.createElement('div');
  content.className = 'accordion-content';
  content.id = `accordion-${id}`;
  
  const contentInner = document.createElement('div');
  contentInner.className = 'accordion-content-inner';
  content.appendChild(contentInner);
  
  // Add click handler for accordion
  header.addEventListener('click', () => {
    const isExpanded = content.classList.contains('expanded');
    
    if (isExpanded) {
      // Collapse
      content.classList.remove('expanded');
      header.classList.remove('active');
      header.querySelector('.accordion-toggle').textContent = '▼';
      header.querySelector('.accordion-toggle').classList.remove('rotated');
    } else {
      // Expand and create content if not already created
      if (!contentInner.hasChildNodes()) {
        const contentHTML = contentCreator();
        contentInner.innerHTML = contentHTML;
      }
      
      content.classList.add('expanded');
      header.classList.add('active');
      header.querySelector('.accordion-toggle').textContent = '▲';
      header.querySelector('.accordion-toggle').classList.add('rotated');
    }
  });
  
  accordion.appendChild(header);
  accordion.appendChild(content);
  container.appendChild(accordion);
}

/**
 * Render Meta Tags section content
 */
function renderMetaTagsContent(metaTags) {
  // Create meta tags data table
  const metaTableData = [
    ['Title', metaTags.title || '❌ Missing', `${metaTags.titleLength || 0} chars`, metaTags.titleLength >= 50 && metaTags.titleLength <= 60 ? '✅ Optimal' : '⚠️ Review', '50-60 chars, include primary keyword near start'],
    ['Description', metaTags.description ? `${metaTags.description.substring(0, 50)}...` : '❌ Missing', `${metaTags.descriptionLength || 0} chars`, metaTags.descriptionLength >= 150 && metaTags.descriptionLength <= 160 ? '✅ Optimal' : '⚠️ Review', '150-160 chars, compelling CTA, unique per page'],
    ['Open Graph', metaTags.ogTitle ? '✅ Configured' : '❌ Missing', metaTags.ogTitle ? 'og:title, og:description' : 'None', metaTags.ogTitle ? '✅ Valid' : '❌ Missing', 'og:title, og:description, og:image (1200x630px)'],
    ['Twitter Card', metaTags.twitterCard || '❌ Missing', metaTags.twitterCard ? 'Configured' : 'None', metaTags.twitterCard ? '✅ Valid' : '❌ Missing', 'summary_large_image, twitter:title, twitter:image'],
    ['Viewport', metaTags.viewport ? '✅ Present' : '❌ Missing', metaTags.viewport || 'None', metaTags.viewport ? '✅ Valid' : '❌ Missing', 'width=device-width, initial-scale=1'],
    ['Canonical', metaTags.canonical ? '✅ Set' : '❌ Missing', metaTags.canonical || 'None', metaTags.canonical ? '✅ Valid' : '⚠️ Review', 'Prevents duplicate content, use absolute URLs']
  ];

  // Meta tags health metrics
  const healthMetrics = {
    'Title': metaTags.title ? (metaTags.titleLength >= 50 && metaTags.titleLength <= 60 ? 100 : 70) : 0,
    'Description': metaTags.description ? (metaTags.descriptionLength >= 150 && metaTags.descriptionLength <= 160 ? 100 : 70) : 0,
    'OG Tags': metaTags.ogTitle ? 100 : 0,
    'Twitter': metaTags.twitterCard ? 100 : 0,
    'Viewport': metaTags.viewport ? 100 : 0,
    'Canonical': metaTags.canonical ? 100 : 0
  };

  return `
    <div style="padding-left: 1rem;">
      <div style="background: rgba(0, 255, 65, 0.1); border-left: 4px solid #00ff41; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #00ff41;">🏷️ Meta Tags are Your First Impression</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          These tags control how your site appears in search results and social media. Optimizing them can increase click-through rates by 30-50%.
        </p>
      </div>
      
      <h3 style="color: #00ff41; margin: 1rem 0 1rem 0;">>> Meta Tags Overview</h3>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(0, 255, 65, 0.3);">
          <thead>
            <tr style="background: rgba(0, 255, 65, 0.1); border-bottom: 2px solid rgba(0, 255, 65, 0.3);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41;">Property</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41;">Value</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41;">Length</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41;">Status</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41;">Best Practice</th>
            </tr>
          </thead>
          <tbody>
            ${metaTableData.map((row) => `
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); ${row[3].includes('❌') ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                <td style="padding: 0.75rem; font-weight: 500;">${row[0]}</td>
                <td style="padding: 0.75rem; font-family: 'Courier New', monospace; font-size: 0.9rem; word-break: break-word; max-width: 300px;">${row[1]}</td>
                <td style="padding: 0.75rem; text-align: center;">${row[2]}</td>
                <td style="padding: 0.75rem; text-align: center; font-weight: 600; color: ${row[3].includes('✅') ? '#00ff41' : row[3].includes('⚠️') ? '#ffa500' : '#ff4444'};">${row[3]}</td>
                <td style="padding: 0.75rem; color: #00ff41; font-size: 0.85rem;">${row[4]}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <h3 style="color: #00ff41; margin: 1.5rem 0 0.5rem 0;">>> Meta Tags Health</h3>
      ${createHeatmap(healthMetrics)}

      ${renderIssuesAndRecommendations(metaTags)}
    </div>
  `;
}

/**
 * Render Heading Structure section content
 */
function renderHeadingStructureContent(headings) {
  // Heading distribution data for bar chart
  const headingCounts = {
    'H1': headings.h1.length,
    'H2': headings.h2.length,
    'H3': headings.h3.length,
    'H4': headings.h4.length,
    'H5': headings.h5?.length || 0,
    'H6': headings.h6?.length || 0
  };

  // Create heading hierarchy table
  const headingTable = [
    ['H1', headings.h1.length, headings.h1.length === 1 ? '✅ Optimal' : headings.h1.length === 0 ? '❌ Missing' : '⚠️ Multiple', headings.h1[0] ? `"${headings.h1[0].substring(0, 40)}..."` : 'N/A'],
    ['H2', headings.h2.length, headings.h2.length > 0 ? '✅ Present' : '⚠️ None', headings.h2[0] ? `"${headings.h2[0].substring(0, 40)}..."` : 'N/A'],
    ['H3', headings.h3.length, headings.h3.length > 0 ? '✅ Present' : '⚠️ None', headings.h3[0] ? `"${headings.h3[0].substring(0, 40)}..."` : 'N/A'],
    ['H4', headings.h4.length, headings.h4.length > 0 ? '✅ Present' : '⚠️ None', headings.h4[0] ? `"${headings.h4[0].substring(0, 40)}..."` : 'N/A']
  ];

  return `
    <div style="padding-left: 1rem;">
      
      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> Heading Distribution</h3>
      ${createBarChart(headingCounts, { height: 180, colorScheme: 'gradient', animated: true })}

      <h3 style="color: #00ff41; margin: 1.5rem 0 0.5rem 0;">>> Heading Hierarchy</h3>
      ${createDataTable(
        ['Level', 'Count', 'Status', 'First Instance'],
        headingTable,
        { striped: true }
      )}

      <p>>> total_headings: ${headings.total}</p>
      ${headings.h1.length > 0 ? `<p>>> primary_h1: "${headings.h1[0]}"</p>` : ''}

      ${headings.hierarchy.length > 3 ? `
        <p>>> hierarchy_sample:</p>
        ${headings.hierarchy.slice(0, 5).map(h => `<p style="margin-left: 1rem; color: #808080;">${h.level.toUpperCase()}: ${h.text.substring(0, 80)}${h.text.length > 80 ? '...' : ''}</p>`).join('')}
        ${headings.hierarchy.length > 5 ? `<p style="margin-left: 1rem; color: #808080;">... ${headings.hierarchy.length - 5} more</p>` : ''}
      ` : ''}

      ${renderIssuesAndRecommendations(headings)}
    </div>
  `;
}

/**
 * Render Content Analysis section content
 */
function renderContentAnalysisContent(content) {
  const wordStatus = content.wordCount >= 600 ? '✅' : content.wordCount >= 300 ? '⚠️' : '❌';
  const sentenceStatus = content.averageWordsPerSentence <= 20 ? '✅' : '⚠️';
  
  // Content quality metrics
  const contentMetrics = {
    'Word Count': content.wordCount >= 600 ? 100 : content.wordCount >= 300 ? 70 : 40,
    'Readability': content.averageWordsPerSentence <= 20 ? 100 : content.averageWordsPerSentence <= 25 ? 70 : 40,
    'Text Ratio': content.textToHTMLRatio >= 0.25 ? 100 : content.textToHTMLRatio >= 0.15 ? 70 : 40,
    'Paragraphs': content.paragraphCount >= 5 ? 100 : content.paragraphCount >= 3 ? 70 : 40
  };

  return `
    <div style="padding-left: 1rem;">
      
      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> Content Quality Metrics</h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
        <div>
          ${createProgressBar(Math.min((content.wordCount / 1000) * 100, 100), `Word Count: ${content.wordCount}`, { threshold: { good: 60, warning: 30 } })}
          ${createProgressBar(Math.min(100, Math.max(0, 100 - (content.averageWordsPerSentence - 15) * 5)), `Readability Score`, { threshold: { good: 70, warning: 50 } })}
        </div>
        <div>
          ${createProgressBar(content.textToHTMLRatio * 100, `Text-to-HTML: ${(content.textToHTMLRatio * 100).toFixed(1)}%`, { threshold: { good: 25, warning: 15 } })}
          ${createProgressBar(Math.min((content.paragraphCount / 10) * 100, 100), `Paragraphs: ${content.paragraphCount}`, { threshold: { good: 50, warning: 30 } })}
        </div>
      </div>

      <h3 style="color: #00ff41; margin: 1.5rem 0 0.5rem 0;">>> Content Health</h3>
      ${createHeatmap(contentMetrics)}

      <p>>> word_count: ${content.wordCount} ${wordStatus}</p>
      <p>>> sentences: ${content.sentenceCount}</p>
      <p>>> avg_words_per_sentence: ${content.averageWordsPerSentence} ${sentenceStatus}</p>

      ${renderIssuesAndRecommendations(content)}
    </div>
  `;
}

/**
 * Render Image Analysis section content
 */
function renderImageAnalysisContent(images) {
  const altStatus = images.withAlt === images.total ? '✅' : images.withoutAlt === 0 ? '⚠️' : '❌';
  const altPercentage = images.total > 0 ? ((images.withAlt / images.total) * 100).toFixed(1) : 0;
  
  // Image optimization data
  const imageData = {
    'With Alt': images.withAlt,
    'Missing Alt': images.withoutAlt,
    'Total Images': images.total
  };

  // Create image table
  const imageTable = images.images.slice(0, 10).map(img => [
    truncateUrl(img.src, 40),
    `${img.width}x${img.height}`,
    img.alt ? `✅ "${img.alt.substring(0, 30)}${img.alt.length > 30 ? '...' : ''}"` : '❌ Missing',
    img.alt ? 'Pass' : 'Fail',
    img.alt ? 'Descriptive, helps SEO and accessibility' : 'Add descriptive alt text for SEO + screen readers'
  ]);

  return `
    <div style="padding-left: 1rem;">
      <div style="background: rgba(255, 140, 0, 0.1); border-left: 4px solid #ff8c00; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #ff8c00;">🖼️ Image SEO: Alt Text is Critical</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          Alt text helps search engines understand images and improves accessibility. Google Image Search drives 20-30% of web traffic for many sites.
        </p>
      </div>
      
      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> Image Optimization Overview</h3>
      ${images.total > 0 ? `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1rem 0;">
          ${createRadialProgress(parseFloat(altPercentage), 'Alt Text Coverage')}
          ${createRadialProgress(images.total, 'Images Found')}
          ${createRadialProgress(images.score, 'Overall Score')}
        </div>
      ` : `
        <p style="color: #ff6600; margin: 1rem 0;">>> No images found on this page</p>
      `}

      <h3 style="color: #00ff41; margin: 1.5rem 0 0.5rem 0;">>> Image Statistics</h3>
      ${createBarChart(imageData, { height: 150, horizontal: true, colorScheme: 'score' })}

      ${images.images.length > 0 ? `
        <h3 style="color: #00ff41; margin: 1.5rem 0 1rem 0;">>> Image Details</h3>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(0, 255, 65, 0.3);">
            <thead>
              <tr style="background: rgba(0, 255, 65, 0.1); border-bottom: 2px solid rgba(0, 255, 65, 0.3);">
                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41;">Image URL</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41;">Dimensions</th>
                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41;">Alt Text</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41;">Status</th>
                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41;">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              ${imageTable.map((row) => `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); ${row[3] === 'Fail' ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                  <td style="padding: 0.75rem; font-family: 'Courier New', monospace; font-size: 0.85rem; word-break: break-all;">${row[0]}</td>
                  <td style="padding: 0.75rem; text-align: center; font-family: monospace;">${row[1]}</td>
                  <td style="padding: 0.75rem; color: ${row[2].includes('✅') ? '#00ff41' : '#ff4444'}; font-size: 0.9rem;">${row[2]}</td>
                  <td style="padding: 0.75rem; text-align: center; font-weight: 600; color: ${row[3] === 'Pass' ? '#00ff41' : '#ff4444'};">${row[3]}</td>
                  <td style="padding: 0.75rem; color: #00ff41; font-size: 0.85rem;">${row[4]}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <p>>> total_images: ${images.total}</p>
      <p>>> with_alt: ${images.withAlt} / ${images.total} ${altStatus} (${altPercentage}%)</p>

      ${renderIssuesAndRecommendations(images)}
    </div>
  `;
}

/**
 * Render Link Analysis section content
 */
function renderLinkAnalysisContent(links) {
  const brokenStatus = links.brokenFormat === 0 ? '✅' : '⚠️';
  
  return `
    <div style="padding-left: 1rem;">
      
      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> Link Network Diagram</h3>
      ${createLinkDiagram({
        internal: links.internal,
        external: links.external,
        nofollow: links.noFollow,
        broken: links.brokenFormat
      })}

      <h3 style="color: #00ff41; margin: 1.5rem 0 0.5rem 0;">>> Link Health Summary</h3>
      <p>>> total_links: ${links.total}</p>
      <p>>> internal_links: ${links.internal} (${((links.internal / links.total) * 100).toFixed(1)}%)</p>
      <p>>> external_links: ${links.external} (${((links.external / links.total) * 100).toFixed(1)}%)</p>
      <p>>> nofollow_links: ${links.noFollow}</p>
      <p>>> broken_format: ${links.brokenFormat} ${brokenStatus}</p>

      ${renderIssuesAndRecommendations(links)}
    </div>
  `;
}

/**
 * Render Mobile Responsiveness section content
 */
function renderMobileResponsivenessContent(mobile) {
  return `
    <div style="padding-left: 1rem;">
      <div style="background: rgba(0, 150, 255, 0.1); border-left: 4px solid #0096ff; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #0096ff;">📱 Mobile-First Indexing</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          Google now uses the mobile version of your site for indexing and ranking. Mobile responsiveness is critical for SEO.
        </p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(0, 255, 65, 0.1); border-bottom: 2px solid rgba(0, 255, 65, 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Device Type</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Width</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">No Horizontal Scroll</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Viewport Meta</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Readable Font Size</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Recommended</th>
          </tr>
        </thead>
        <tbody>
          ${mobile.viewports.map(vp => {
            const recommended = vp.viewport === 'Mobile' 
              ? '≥ 16px fonts, no horizontal scroll' 
              : vp.viewport === 'Tablet' 
              ? 'Responsive layout, touch-friendly' 
              : 'Desktop fallback';
            
            return `
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${vp.viewport}</td>
                <td style="padding: 0.75rem; text-align: center; color: #c0c0c0; border: 1px solid rgba(255, 255, 255, 0.05);">${vp.width}px</td>
                <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${vp.hasHorizontalScroll ? '❌' : '✅'}</td>
                <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${vp.hasViewportMeta ? '✅' : '❌'}</td>
                <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${vp.fontSizeReadable ? '✅' : '❌'}</td>
                <td style="padding: 0.75rem; color: #00ff41; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">${recommended}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0;">
        <div style="background: rgba(255, 255, 255, 0.03); padding: 1rem; border-radius: 4px; border-left: 3px solid ${mobile.viewports.every(vp => !vp.hasHorizontalScroll) ? '#00ff41' : '#ff4444'};">
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Horizontal Scroll</div>
          <div style="font-size: 1.5rem; font-weight: bold; color: ${mobile.viewports.every(vp => !vp.hasHorizontalScroll) ? '#00ff41' : '#ff4444'};">
            ${mobile.viewports.every(vp => !vp.hasHorizontalScroll) ? '✅ None' : '❌ Detected'}
          </div>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.03); padding: 1rem; border-radius: 4px; border-left: 3px solid ${mobile.viewports.every(vp => vp.hasViewportMeta) ? '#00ff41' : '#ff8c00'};">
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Viewport Meta Tag</div>
          <div style="font-size: 1.5rem; font-weight: bold; color: ${mobile.viewports.every(vp => vp.hasViewportMeta) ? '#00ff41' : '#ff8c00'};">
            ${mobile.viewports.every(vp => vp.hasViewportMeta) ? '✅ Present' : '⚠️ Missing'}
          </div>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.03); padding: 1rem; border-radius: 4px; border-left: 3px solid ${mobile.viewports.filter(vp => vp.fontSizeReadable).length === mobile.viewports.length ? '#00ff41' : '#ff8c00'};">
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Font Readability</div>
          <div style="font-size: 1.5rem; font-weight: bold; color: ${mobile.viewports.filter(vp => vp.fontSizeReadable).length === mobile.viewports.length ? '#00ff41' : '#ff8c00'};">
            ${mobile.viewports.filter(vp => vp.fontSizeReadable).length}/${mobile.viewports.length} Devices
          </div>
        </div>
      </div>

      ${renderIssuesAndRecommendations(mobile)}
    </div>
  `;
}

/**
 * Render Performance Metrics section content
 */
function renderPerformanceMetricsContent(perf) {
  const loadStatus = perf.loadComplete < 3000 ? '✅' : perf.loadComplete < 5000 ? '⚠️' : '❌';
  const sizeStatus = parseFloat(perf.transferSizeMB) < 3 ? '✅' : '⚠️';
  const resourceStatus = perf.resources < 150 ? '✅' : perf.resources < 300 ? '⚠️' : '❌';
  const domStatus = perf.domNodes < 1500 ? '✅' : perf.domNodes < 3000 ? '⚠️' : '❌';
  
  const metrics = [
    ['Page Load Time', `${perf.loadCompleteSeconds}s`, loadStatus, 'Time until page fully loaded', '< 3s (Good) | < 5s (Fair)'],
    ['DOM Content Loaded', `${(perf.domContentLoaded / 1000).toFixed(2)}s`, perf.domContentLoaded < 2000 ? '✅' : '⚠️', 'Time until DOM is ready', '< 2s (Good)'],
    ['Total Resources', perf.resources, resourceStatus, 'Number of HTTP requests', '< 150 (Good) | < 300 (Fair)'],
    ['Page Size', `${perf.transferSizeMB} MB`, sizeStatus, 'Total transfer size', '< 3 MB (Good)'],
    ['DOM Nodes', perf.domNodes, domStatus, 'Total HTML elements', '< 1,500 (Good) | < 3,000 (Fair)']
  ];
  
  return `
    <div style="padding-left: 1rem;">
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(0, 255, 65, 0.1); border-bottom: 2px solid rgba(0, 255, 65, 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Metric</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Value</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Status</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Recommended</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Description</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.map(([metric, value, status, desc, recommended]) => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${metric}</td>
              <td style="padding: 0.75rem; text-align: center; color: #c0c0c0; font-family: 'Courier New', monospace; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">${value}</td>
              <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${status}</td>
              <td style="padding: 0.75rem; text-align: center; color: #00ff41; font-size: 0.85rem; font-weight: 500; border: 1px solid rgba(255, 255, 255, 0.05);">${recommended}</td>
              <td style="padding: 0.75rem; color: #909090; font-size: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.05);">${desc}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${renderIssuesAndRecommendations(perf)}
    </div>
  `;
}

/**
 * Render Security Headers section content
 */
function renderSecurityHeadersContent(security) {
  const securityChecks = [
    ['HTTPS Enabled', security.hasHTTPS ? '✅ Yes' : '❌ No', 'Encrypted connection', security.hasHTTPS ? 'Secure SSL/TLS enabled' : 'No HTTPS detected', 'Required - Always use HTTPS in production'],
    ['HSTS Header', security.strictTransportSecurity ? '✅ Present' : '⚠️ Missing', 'Force HTTPS', security.strictTransportSecurity || 'Not configured - browsers can connect via HTTP', 'max-age=31536000; includeSubDomains; preload'],
    ['Content Security Policy', security.contentSecurityPolicy ? '✅ Present' : '⚠️ Missing', 'XSS Protection', security.contentSecurityPolicy ? 'Configured' : 'Vulnerable to injection attacks', "default-src 'self'; script-src 'self'"],
    ['X-Frame-Options', security.xFrameOptions ? '✅ Present' : '⚠️ Missing', 'Clickjacking Protection', security.xFrameOptions || 'Can be embedded in iframes', 'DENY or SAMEORIGIN'],
    ['X-Content-Type-Options', security.xContentTypeOptions ? '✅ Present' : '⚠️ Missing', 'MIME Sniffing Protection', security.xContentTypeOptions ? 'Enabled' : 'Browser may misinterpret content', 'nosniff']
  ];
  
  return `
    <div style="padding-left: 1rem;">
      <div style="background: rgba(255, 68, 68, 0.1); border-left: 4px solid #ff4444; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #ff4444;">🔒 Security Headers Critical for SEO</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          Google prioritizes secure sites in rankings. Missing security headers can harm SEO and user trust. HTTPS is a direct ranking factor.
        </p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(0, 255, 65, 0.1); border-bottom: 2px solid rgba(0, 255, 65, 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Security Header</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Status</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Purpose</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Details</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Recommended Value</th>
          </tr>
        </thead>
        <tbody>
          ${securityChecks.map(([header, status, purpose, details, recommended]) => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${header}</td>
              <td style="padding: 0.75rem; text-align: center; font-size: 1.1rem; border: 1px solid rgba(255, 255, 255, 0.05);">${status}</td>
              <td style="padding: 0.75rem; color: #c0c0c0; border: 1px solid rgba(255, 255, 255, 0.05);">${purpose}</td>
              <td style="padding: 0.75rem; color: #909090; font-size: 0.9rem; font-family: 'Courier New', monospace; word-break: break-all; border: 1px solid rgba(255, 255, 255, 0.05);">${details}</td>
              <td style="padding: 0.75rem; color: #00ff41; font-size: 0.85rem; font-family: 'Courier New', monospace; border: 1px solid rgba(255, 255, 255, 0.05);">${recommended}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${renderIssuesAndRecommendations(security)}
    </div>
  `;
}

/**
 * Render Structured Data section content
 */
function renderStructuredDataContent(data) {
  // Common schema types with descriptions and benefits
  const commonSchemas = {
    'Organization': { 
      icon: '🏢', 
      desc: 'Company/Brand information',
      benefit: 'Establishes brand identity in Knowledge Graph',
      fields: ['name', 'logo', 'url', 'contactPoint', 'sameAs']
    },
    'Person': { 
      icon: '👤', 
      desc: 'Individual profile data',
      benefit: 'Powers author rich snippets and Knowledge Panel',
      fields: ['name', 'image', 'jobTitle', 'worksFor', 'sameAs']
    },
    'Product': { 
      icon: '🛍️', 
      desc: 'Product listings & details',
      benefit: 'Shows price, availability, and reviews in search',
      fields: ['name', 'image', 'description', 'sku', 'offers', 'aggregateRating']
    },
    'Article': { 
      icon: '📰', 
      desc: 'Blog posts & articles',
      benefit: 'Enables article snippets with author and publish date',
      fields: ['headline', 'author', 'datePublished', 'image']
    },
    'WebSite': { 
      icon: '🌐', 
      desc: 'Website metadata',
      benefit: 'Enables sitelinks search box in Google',
      fields: ['name', 'url', 'potentialAction']
    },
    'BreadcrumbList': { 
      icon: '🍞', 
      desc: 'Navigation breadcrumbs',
      benefit: 'Shows breadcrumb trail in search results',
      fields: ['itemListElement', 'position', 'name', 'item']
    },
    'LocalBusiness': { 
      icon: '🏪', 
      desc: 'Local business info',
      benefit: 'Appears in local search and Google Maps',
      fields: ['name', 'address', 'telephone', 'openingHours', 'geo']
    },
    'Event': { 
      icon: '📅', 
      desc: 'Event information',
      benefit: 'Shows event details in search with "Add to Calendar"',
      fields: ['name', 'startDate', 'location', 'description', 'offers']
    },
    'Recipe': { 
      icon: '🍳', 
      desc: 'Recipe content',
      benefit: 'Rich recipe cards with ratings, cook time, calories',
      fields: ['name', 'image', 'author', 'recipeIngredient', 'recipeInstructions']
    },
    'Review': { 
      icon: '⭐', 
      desc: 'User reviews',
      benefit: 'Display star ratings directly in search results',
      fields: ['itemReviewed', 'reviewRating', 'author', 'reviewBody']
    },
    'VideoObject': { 
      icon: '🎥', 
      desc: 'Video content',
      benefit: 'Video snippets with thumbnails and key moments',
      fields: ['name', 'description', 'thumbnailUrl', 'uploadDate', 'duration']
    },
    'FAQPage': { 
      icon: '❓', 
      desc: 'FAQ content',
      benefit: 'Expandable FAQ sections in search results',
      fields: ['mainEntity', 'name', 'acceptedAnswer']
    },
    'HowTo': { 
      icon: '📋', 
      desc: 'Step-by-step guides',
      benefit: 'Numbered steps with images in search',
      fields: ['name', 'step', 'totalTime', 'tool', 'supply']
    },
    'SoftwareApplication': {
      icon: '💻',
      desc: 'Software/app details',
      benefit: 'App install buttons and ratings in search',
      fields: ['name', 'operatingSystem', 'applicationCategory', 'offers', 'aggregateRating']
    },
    'JobPosting': {
      icon: '💼',
      desc: 'Job listings',
      benefit: 'Appears in Google for Jobs with salary and location',
      fields: ['title', 'description', 'datePosted', 'employmentType', 'hiringOrganization']
    }
  };

  return `
    <div style="padding-left: 1rem;">
      
      <!-- What is Structured Data Info Box -->
      <div style="
        background: linear-gradient(135deg, rgba(0, 204, 255, 0.1) 0%, rgba(0, 204, 255, 0.05) 100%);
        border-left: 4px solid #00ccff;
        padding: 1.5rem;
        margin: 1rem 0;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,204,255,0.15);
      ">
        <div style="color: #00ccff; font-weight: bold; margin-bottom: 0.75rem; font-size: 1.1rem;">💡 What is Structured Data Schema?</div>
        <div style="color: #c0c0c0; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1rem;">
          Structured data (also called schema markup) is code that helps search engines understand your content better, 
          enabling <strong style="color: #00ff41;">rich search results</strong> like star ratings, product prices, event dates, 
          FAQ dropdowns, and more. It uses the <strong style="color: #00ccff;">Schema.org</strong> vocabulary in JSON-LD, Microdata, or RDFa formats.
        </div>
        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        ">
          <div style="padding: 0.75rem; background: rgba(0,255,65,0.1); border-radius: 6px; border: 1px solid rgba(0,255,65,0.2);">
            <div style="color: #00ff41; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.3rem;">📈 Improved CTR</div>
            <div style="color: #b0b0b0; font-size: 0.8rem;">Rich results stand out and attract more clicks</div>
          </div>
          <div style="padding: 0.75rem; background: rgba(0,255,65,0.1); border-radius: 6px; border: 1px solid rgba(0,255,65,0.2);">
            <div style="color: #00ff41; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.3rem;">🎯 Better Targeting</div>
            <div style="color: #b0b0b0; font-size: 0.8rem;">Helps search engines understand your niche</div>
          </div>
          <div style="padding: 0.75rem; background: rgba(0,255,65,0.1); border-radius: 6px; border: 1px solid rgba(0,255,65,0.2);">
            <div style="color: #00ff41; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.3rem;">🏆 SEO Advantage</div>
            <div style="color: #b0b0b0; font-size: 0.8rem;">Competitive edge in search results</div>
          </div>
        </div>
      </div>

      <!-- Summary Table -->
      <h3 style="color: #00ff41; margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> Summary</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(0, 255, 65, 0.1); border-bottom: 2px solid rgba(0, 255, 65, 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Metric</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Status</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Value</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Impact</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">Structured Data Found</td>
            <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${data.hasStructuredData ? '✅' : '❌'}</td>
            <td style="padding: 0.75rem; color: ${data.hasStructuredData ? '#00ff41' : '#ff6600'}; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.hasStructuredData ? 'Detected' : 'Not Found'}
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.hasStructuredData ? 'Enables rich search results' : 'Missing enhanced search appearances'}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">Schema Types Implemented</td>
            <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">📊</td>
            <td style="padding: 0.75rem; color: #00ccff; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.count} ${data.count === 1 ? 'Type' : 'Types'}
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.count >= 3 ? 'Great coverage' : data.count >= 1 ? 'Good start' : 'None implemented'}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">Overall Score</td>
            <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">🎯</td>
            <td style="padding: 0.75rem; color: #bb86fc; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.score}/100
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.score >= 80 ? 'Excellent implementation' : data.score >= 60 ? 'Room for improvement' : 'Critical gap'}
            </td>
          </tr>
        </tbody>
      </table>

      ${data.hasStructuredData ? `
        <!-- Detected Schema Types Table -->
        <h3 style="color: #00ff41; margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> Detected Schema Types</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
          <thead>
            <tr style="background: rgba(0, 255, 65, 0.1); border-bottom: 2px solid rgba(0, 255, 65, 0.3);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2); width: 30%;">Schema Type</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2); width: 45%;">SEO Benefit</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2); width: 25%;">Key Fields</th>
            </tr>
          </thead>
          <tbody>
            ${data.types.map(type => {
              const schema = commonSchemas[type] || { 
                icon: '📦', 
                desc: 'Schema markup',
                benefit: 'Structured data implementation',
                fields: []
              };
              return `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                  <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.5rem;">${schema.icon}</span>
                      <div>
                        <div style="color: #00ff41; font-weight: 600; font-size: 0.95rem;">${type}</div>
                        <div style="color: #808080; font-size: 0.75rem;">${schema.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; line-height: 1.5; border: 1px solid rgba(255, 255, 255, 0.05);">
                    ${schema.benefit}
                  </td>
                  <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                    ${schema.fields && schema.fields.length > 0 ? `
                      <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
                        ${schema.fields.slice(0, 3).map(field => `
                          <span style="
                            background: rgba(0,204,255,0.15);
                            color: #00ccff;
                            padding: 0.15rem 0.4rem;
                            border-radius: 3px;
                            font-size: 0.7rem;
                            font-family: 'Courier New', monospace;
                            border: 1px solid rgba(0,204,255,0.3);
                          ">${field}</span>
                        `).join('')}
                        ${schema.fields.length > 3 ? `<span style="color: #808080; font-size: 0.7rem;">+${schema.fields.length - 3} more</span>` : ''}
                      </div>
                    ` : '<span style="color: #808080; font-size: 0.8rem;">N/A</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Validation Tip -->
        <div style="
          background: linear-gradient(135deg, rgba(0,255,65,0.1) 0%, rgba(0,255,65,0.05) 100%);
          border-left: 4px solid #00ff41;
          padding: 1rem;
          margin: 1rem 0;
          border-radius: 4px;
        ">
          <div style="color: #00ff41; font-weight: bold; margin-bottom: 0.5rem;">✅ Next Step: Validate Your Schema</div>
          <div style="color: #c0c0c0; font-size: 0.9rem; line-height: 1.6;">
            Use <a href="https://search.google.com/test/rich-results" target="_blank" style="color: #00ccff; text-decoration: underline;">Google's Rich Results Test</a> 
            to ensure your structured data is error-free and eligible for rich snippets. Monitor Search Console for structured data errors.
          </div>
        </div>
      ` : `
        <!-- No Structured Data - Show Benefits and Guide -->
        <h3 style="color: #ff6600; margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> Missing Critical SEO Opportunity</h3>
        <div style="
          padding: 1rem;
          background: rgba(255,102,0,0.05);
          border-left: 4px solid #ff6600;
          border-radius: 4px;
          margin-bottom: 1rem;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="font-size: 1.5rem;">⚠️</div>
            <div>
              <div style="color: #ff6600; font-weight: bold; font-size: 1rem;">No Structured Data Detected</div>
              <div style="color: #c0c0c0; font-size: 0.85rem;">You're missing enhanced search appearances that boost visibility and click-through rates</div>
            </div>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
          <thead>
            <tr style="background: rgba(255, 102, 0, 0.1); border-bottom: 2px solid rgba(255, 102, 0, 0.3);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #ff6600; border: 1px solid rgba(255, 102, 0, 0.2); width: 25%;">Rich Result Type</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #ff6600; border: 1px solid rgba(255, 102, 0, 0.2); width: 50%;">What You're Missing</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ff6600; border: 1px solid rgba(255, 102, 0, 0.2); width: 25%;">CTR Impact</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">⭐</span>
                  <span style="color: #ffd700; font-weight: 600; font-size: 0.9rem;">Star Ratings</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                Display review stars and ratings directly in search results
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: #00ff41; font-weight: bold; font-size: 0.9rem;">+35%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">💰</span>
                  <span style="color: #00ff41; font-weight: 600; font-size: 0.9rem;">Product Info</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                Show prices, availability, and special offers inline
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: #00ff41; font-weight: bold; font-size: 0.9rem;">+25%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">📅</span>
                  <span style="color: #00ccff; font-weight: 600; font-size: 0.9rem;">Event Details</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                Event dates, locations, and ticket info with calendar integration
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: #ffd700; font-weight: bold; font-size: 0.9rem;">+20%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">🖼️</span>
                  <span style="color: #bb86fc; font-weight: 600; font-size: 0.9rem;">Rich Media</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                Enhanced thumbnails, carousels, and video snippets
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: #ffd700; font-weight: bold; font-size: 0.9rem;">+18%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">❓</span>
                  <span style="color: #ff8c00; font-weight: 600; font-size: 0.9rem;">FAQ Dropdowns</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                Expandable Q&A sections directly in search results
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: #ffd700; font-weight: bold; font-size: 0.9rem;">+15%</span>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div style="
          padding: 0.75rem;
          background: rgba(0,255,65,0.05);
          border-left: 3px solid #00ff41;
          border-radius: 4px;
          margin: 1rem 0;
        ">
          <div style="color: #c0c0c0; font-size: 0.85rem; line-height: 1.6;">
            <strong style="color: #00ff41;">💡 Pro Tip:</strong> Rich results can increase click-through rates by 15-35% according to Google research. 
            Start with the foundational schemas below to unlock these benefits.
          </div>
        </div>

        <!-- Recommended Schema Types for Your Site -->
        <h3 style="color: #00ccff; margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> Recommended Schema Types to Implement</h3>
        <div style="
          padding: 1rem;
          background: rgba(0,204,255,0.05);
          border-left: 4px solid #00ccff;
          border-radius: 4px;
          margin-bottom: 1rem;
        ">
          <div style="color: #c0c0c0; font-size: 0.9rem; line-height: 1.6;">
            <strong style="color: #00ccff;">Start with these foundational schemas</strong> that work for almost every website. 
            You can add more specific schemas based on your content type later.
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
          <thead>
            <tr style="background: rgba(0, 204, 255, 0.1); border-bottom: 2px solid rgba(0, 204, 255, 0.3);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 25%;">Schema Type</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 12%;">Priority</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 40%;">SEO Benefit</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 23%;">Required Fields</th>
            </tr>
          </thead>
          <tbody>
            ${[
              { type: 'Organization', priority: 'HIGH', color: '#ff6600' },
              { type: 'WebSite', priority: 'HIGH', color: '#ff6600' },
              { type: 'BreadcrumbList', priority: 'MEDIUM', color: '#ffd700' },
              { type: 'Article', priority: 'MEDIUM', color: '#ffd700' }
            ].map(item => {
              const schema = commonSchemas[item.type];
              return `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                  <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.5rem;">${schema.icon}</span>
                      <div>
                        <div style="color: #00ccff; font-weight: 600; font-size: 0.95rem;">${item.type}</div>
                        <div style="color: #808080; font-size: 0.75rem;">${schema.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <span style="
                      background: ${item.color}30;
                      color: ${item.color};
                      padding: 0.25rem 0.6rem;
                      border-radius: 4px;
                      font-size: 0.7rem;
                      font-weight: bold;
                      border: 1px solid ${item.color}50;
                    ">${item.priority}</span>
                  </td>
                  <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; line-height: 1.5; border: 1px solid rgba(255, 255, 255, 0.05);">
                    ${schema.benefit}
                  </td>
                  <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
                      ${schema.fields.slice(0, 4).map(field => `
                        <span style="
                          background: rgba(0,204,255,0.15);
                          color: #00ccff;
                          padding: 0.15rem 0.4rem;
                          border-radius: 3px;
                          font-size: 0.7rem;
                          font-family: 'Courier New', monospace;
                          border: 1px solid rgba(0,204,255,0.3);
                        ">${field}</span>
                      `).join('')}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}

      <!-- Implementation Formats -->
      <h3 style="color: #bb86fc; margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> Implementation Formats</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 1rem 0;">
        <div style="
          padding: 1.25rem;
          background: linear-gradient(135deg, rgba(0,255,65,0.08) 0%, rgba(0,255,65,0.02) 100%);
          border: 2px solid rgba(0,255,65,0.3);
          border-radius: 10px;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.8rem;">📝</div>
            <div>
              <div style="color: #00ff41; font-weight: bold; font-size: 1rem;">JSON-LD</div>
              <div style="color: #00ff41; font-size: 0.7rem; background: rgba(0,255,65,0.2); padding: 0.2rem 0.4rem; border-radius: 3px; display: inline-block; margin-top: 0.2rem;">RECOMMENDED</div>
            </div>
          </div>
          <div style="color: #b0b0b0; font-size: 0.85rem; line-height: 1.6; margin-bottom: 0.75rem;">
            JavaScript Object Notation for Linked Data. Google's preferred format - clean, separate from HTML, easy to maintain.
          </div>
          <div style="
            background: rgba(0,0,0,0.4);
            padding: 0.75rem;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.75rem;
            color: #00ccff;
            border: 1px solid rgba(0,204,255,0.2);
          ">
            &lt;script type="application/ld+json"&gt;<br/>
            { "@context": "https://schema.org", ... }<br/>
            &lt;/script&gt;
          </div>
        </div>

        <div style="
          padding: 1.25rem;
          background: rgba(0,204,255,0.05);
          border: 2px solid rgba(0,204,255,0.2);
          border-radius: 10px;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.8rem;">🏷️</div>
            <div>
              <div style="color: #00ccff; font-weight: bold; font-size: 1rem;">Microdata</div>
              <div style="color: #808080; font-size: 0.7rem;">HTML Attributes</div>
            </div>
          </div>
          <div style="color: #b0b0b0; font-size: 0.85rem; line-height: 1.6; margin-bottom: 0.75rem;">
            Embedded directly in HTML tags. More complex to maintain but tightly couples markup with content.
          </div>
          <div style="
            background: rgba(0,0,0,0.4);
            padding: 0.75rem;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.75rem;
            color: #00ccff;
            border: 1px solid rgba(0,204,255,0.2);
          ">
            &lt;div itemscope itemtype="..."&gt;<br/>
            &nbsp;&nbsp;&lt;span itemprop="name"&gt;...&lt;/span&gt;<br/>
            &lt;/div&gt;
          </div>
        </div>

        <div style="
          padding: 1.25rem;
          background: rgba(187,134,252,0.05);
          border: 2px solid rgba(187,134,252,0.2);
          border-radius: 10px;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.8rem;">🔗</div>
            <div>
              <div style="color: #bb86fc; font-weight: bold; font-size: 1rem;">RDFa</div>
              <div style="color: #808080; font-size: 0.7rem;">Resource Description</div>
            </div>
          </div>
          <div style="color: #b0b0b0; font-size: 0.85rem; line-height: 1.6; margin-bottom: 0.75rem;">
            Resource Description Framework in Attributes. Similar to Microdata, uses different attribute names.
          </div>
          <div style="
            background: rgba(0,0,0,0.4);
            padding: 0.75rem;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.75rem;
            color: #bb86fc;
            border: 1px solid rgba(187,134,252,0.2);
          ">
            &lt;div vocab="..." typeof="..."&gt;<br/>
            &nbsp;&nbsp;&lt;span property="..."&gt;...&lt;/span&gt;<br/>
            &lt;/div&gt;
          </div>
        </div>
      </div>

      <!-- Resources Section -->
      <h3 style="color: #00ccff; margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> Essential Resources & Tools</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(0, 204, 255, 0.1); border-bottom: 2px solid rgba(0, 204, 255, 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 25%;">Tool</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 50%;">Purpose</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 25%;">Link</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">🔧</span>
                <span style="color: #00ccff; font-weight: 600; font-size: 0.9rem;">Schema.org Docs</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              Official vocabulary reference with complete documentation for all schema types and properties
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://schema.org" target="_blank" style="color: #00ccff; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #00ccff;">schema.org →</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">✅</span>
                <span style="color: #00ff41; font-weight: 600; font-size: 0.9rem;">Rich Results Test</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              Test your structured data markup and see which Google rich results can be generated from it
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://search.google.com/test/rich-results" target="_blank" style="color: #00ff41; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #00ff41;">Test Markup →</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">📊</span>
                <span style="color: #ffd700; font-weight: 600; font-size: 0.9rem;">Schema Validator</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              Comprehensive validation tool for all structured data formats including JSON-LD, Microdata, and RDFa
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://validator.schema.org/" target="_blank" style="color: #ffd700; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #ffd700;">Validate →</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">📚</span>
                <span style="color: #bb86fc; font-weight: 600; font-size: 0.9rem;">Google Guide</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              Step-by-step guide from Google on implementing structured data with code examples and best practices
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data" target="_blank" style="color: #bb86fc; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #bb86fc;">Read Guide →</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">🔧</span>
                <span style="color: #ff8c00; font-weight: 600; font-size: 0.9rem;">Markup Generator</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              Free tool to generate JSON-LD structured data markup for various schema types quickly and easily
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://technicalseo.com/tools/schema-markup-generator/" target="_blank" style="color: #ff8c00; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #ff8c00;">Generate →</a>
            </td>
          </tr>
        </tbody>
      </table>

      ${renderIssuesAndRecommendations(data)}
    </div>
  `;
}

/**
 * Render Additional Checks section content
 */
function renderAdditionalChecksContent(checks) {
  const additionalMetrics = [
    ['robots.txt', checks.hasRobotsTxt ? '✅ Found' : '⚠️ Not found', 'Controls search engine crawling', checks.hasRobotsTxt ? 'File is present and accessible' : 'Missing - create /robots.txt', 'Allow crawlers, disallow admin/private pages'],
    ['XML Sitemap', checks.hasSitemap ? '✅ Found' : '⚠️ Not found', 'Helps search engines discover pages', checks.hasSitemap ? 'Sitemap detected' : 'Missing - improves indexing', 'Submit to Google Search Console, update weekly'],
    ['Favicon', checks.hasFavicon ? '✅ Present' : '⚠️ Missing', 'Browser tab icon', checks.hasFavicon ? 'Configured' : 'No favicon found', '32x32 PNG or ICO, helps brand recognition'],
    ['Google Analytics', checks.googleAnalytics ? '✅ Detected' : '⚠️ Not detected', 'Traffic tracking', checks.googleAnalytics ? 'Analytics tracking enabled' : 'No analytics detected', 'GA4 recommended, track user behavior for SEO insights']
  ];

  const socialPlatforms = [
    ['Facebook', checks.socialLinks.facebook ? '✅' : '❌', 'Meta Open Graph tags', checks.socialLinks.facebook ? 'Link present' : 'No Facebook link found', 'Add og:image, og:title, og:description tags'],
    ['Twitter/X', checks.socialLinks.twitter ? '✅' : '❌', 'Twitter Card tags', checks.socialLinks.twitter ? 'Link present' : 'No Twitter link found', 'Add twitter:card, twitter:image meta tags'],
    ['LinkedIn', checks.socialLinks.linkedin ? '✅' : '❌', 'Professional network', checks.socialLinks.linkedin ? 'Link present' : 'No LinkedIn link found', 'Add to company footer, improves B2B credibility'],
    ['Instagram', checks.socialLinks.instagram ? '✅' : '❌', 'Visual content', checks.socialLinks.instagram ? 'Link present' : 'No Instagram link found', 'Link to business profile, helps visual branding']
  ];
  
  return `
    <div style="padding-left: 1rem;">
      <div style="background: rgba(0, 150, 255, 0.1); border-left: 4px solid #0096ff; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #0096ff;">🔧 Technical SEO Essentials</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          These technical elements help search engines crawl, index, and understand your site. Missing items can significantly impact discoverability.
        </p>
      </div>
      
      <h3 style="color: #00ff41; margin: 1rem 0 0.5rem 0;">>> Technical SEO</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(0, 255, 65, 0.1); border-bottom: 2px solid rgba(0, 255, 65, 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Check</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Status</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Purpose</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Details</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Best Practice</th>
          </tr>
        </thead>
        <tbody>
          ${additionalMetrics.map(([check, status, purpose, details, recommended]) => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${check}</td>
              <td style="padding: 0.75rem; text-align: center; font-size: 1.1rem; border: 1px solid rgba(255, 255, 255, 0.05);">${status}</td>
              <td style="padding: 0.75rem; color: #c0c0c0; border: 1px solid rgba(255, 255, 255, 0.05);">${purpose}</td>
              <td style="padding: 0.75rem; color: #909090; font-size: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.05);">${details}</td>
              <td style="padding: 0.75rem; color: #00ff41; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">${recommended}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="background: rgba(138, 43, 226, 0.1); border-left: 4px solid #8a2be2; padding: 1rem; margin: 1.5rem 0 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #8a2be2;">📱 Social Signals & SEO</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          While not direct ranking factors, social links increase brand visibility, drive traffic, and improve Open Graph previews when content is shared.
        </p>
      </div>

      <h3 style="color: #00ff41; margin: 1.5rem 0 0.5rem 0;">>> Social Media Presence</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(0, 255, 65, 0.1); border-bottom: 2px solid rgba(0, 255, 65, 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Platform</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Status</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">SEO Value</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Details</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; border: 1px solid rgba(0, 255, 65, 0.2);">Implementation Tip</th>
          </tr>
        </thead>
        <tbody>
          ${socialPlatforms.map(([platform, status, value, details, recommended]) => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${platform}</td>
              <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${status}</td>
              <td style="padding: 0.75rem; color: #c0c0c0; border: 1px solid rgba(255, 255, 255, 0.05);">${value}</td>
              <td style="padding: 0.75rem; color: #909090; font-size: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.05);">${details}</td>
              <td style="padding: 0.75rem; color: #00ff41; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">${recommended}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${renderIssuesAndRecommendations(checks)}
    </div>
  `;
}

/**
 * Render issues and recommendations
 */
function renderIssuesAndRecommendations(section) {
  let html = '';

  if (section.issues && section.issues.length > 0) {
    html += '<p style="color: #ff6600; margin-top: 0.5rem;">>> issues:</p>';
    section.issues.forEach(issue => {
      html += `<p style="margin-left: 1rem; color: #ff6600;">❌ ${issue}</p>`;
    });
  }

  if (section.recommendations && section.recommendations.length > 0) {
    html += '<p style="color: #00ccff; margin-top: 0.5rem;">>> recommendations:</p>';
    section.recommendations.forEach(rec => {
      html += `<p style="margin-left: 1rem; color: #00ccff;">💡 ${rec}</p>`;
    });
  }

  return html;
}

// Helper functions
function formatComponentName(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// Get score color - Traditional traffic light system
// A grades (90-100): Green
// B grades (70-89): Yellow
// C grades (50-69): Orange
// Below C (<50): Red
function getScoreColor(score) {
  if (score >= 90) return '#00ff41';  // A: Bright green (terminal green)
  if (score >= 70) return '#ffd700';  // B: Yellow (gold)
  if (score >= 50) return '#ff8c00';  // C: Dark orange
  return '#ff4444';                   // D/F: Red
}

function truncateUrl(url, maxLength) {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

function countTotalIssues(results) {
  let count = 0;
  for (const key in results) {
    if (results[key] && results[key].issues) {
      count += results[key].issues.length;
    }
  }
  return count;
}

function countTotalRecommendations(results) {
  let count = 0;
  for (const key in results) {
    if (results[key] && results[key].recommendations) {
      count += results[key].recommendations.length;
    }
  }
  return count;
}

function countPassedChecks(results) {
  let count = 0;
  for (const key in results) {
    if (results[key] && results[key].passed === true) {
      count++;
    }
  }
  return count;
}

function animateScoreCircle(score) {
  const circle = document.querySelector('.seo-score-circle');
  if (!circle) return;

  // Add color based on score
  if (score >= 90) circle.classList.add('score-a');
  else if (score >= 80) circle.classList.add('score-b');
  else if (score >= 70) circle.classList.add('score-c');
  else if (score >= 60) circle.classList.add('score-d');
  else circle.classList.add('score-f');

  // Animate number counting up
  const numberEl = circle.querySelector('.score-number');
  let current = 0;
  const increment = score / 50; // 50 frames
  const timer = setInterval(() => {
    current += increment;
    if (current >= score) {
      current = score;
      clearInterval(timer);
    }
    numberEl.textContent = Math.round(current);
  }, 20);
}

function getLoadingHTML() {
  return `
    <div class="section">
      <h2>[ANALYZING]</h2>
      <div style="padding-left: 1rem;">
        <p>>> running comprehensive seo analysis...</p>
        <p>>> checking meta tags...</p>
        <p>>> analyzing content quality...</p>
        <p>>> testing mobile responsiveness...</p>
        <p>>> measuring performance...</p>
        <div class="loading-bar" style="margin-top: 1rem;"></div>
      </div>
    </div>
  `;
}

function showError(message) {
  const container = document.getElementById('seoResults');
  container.innerHTML = `
    <div class="section">
      <h2 style="color: #ff0000;">[ERROR]</h2>
      <div style="padding-left: 1rem;">
        <p>>> analysis_failed</p>
        <p style="color: #ff6600;">>> ${message}</p>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #ff6600; color: #000; border: none; cursor: pointer; font-family: 'Courier New', monospace; font-weight: bold;">RETRY</button>
      </div>
    </div>
  `;
  container.style.display = 'block';
}

/**
 * Open PDF purchase modal
 */
function openPdfPurchaseModal(reportType) {
  if (!window.pdfPaymentModal) {
    console.error('PDF Payment Modal not initialized');
    alert('Payment system is loading. Please try again in a moment.');
    return;
  }

  // Get the current results
  let reportData;
  switch (reportType) {
    case 'seo':
      reportData = window.currentSeoResults;
      break;
    case 'performance':
      reportData = window.currentPerformanceResults;
      break;
    case 'accessibility':
      reportData = window.currentAccessibilityResults;
      break;
    case 'security':
      reportData = window.currentSecurityResults;
      break;
    case 'fonts':
      reportData = window.currentFontResults;
      break;
    default:
      console.error('Unknown report type:', reportType);
      return;
  }

  if (!reportData) {
    alert('Please run an analysis first before purchasing a PDF report.');
    return;
  }

  // Open payment modal
  window.pdfPaymentModal.open(reportType, reportData, (result) => {
    console.log('PDF purchase successful:', result);
    // Payment successful, PDF download started automatically
  });
}
