/**
 * Competitive Analysis Dashboard
 * Compare your site vs competitors with interactive visualizations
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'competitive-analysis';

// Max competitors limited to 5 for comprehensive competitive analysis
const maxCompetitors = 5;

// WebSocket connection
let socket = null;

// Unified loader instance (reassigned in analyze function)
// eslint-disable-next-line prefer-const
let loader = null;

// Initialize Socket.IO connection
function initializeWebSocket() {
  if (socket) return; // Already connected
  
  // Socket.IO client library loaded via CDN in HTML
  // eslint-disable-next-line no-undef
  socket = io({
    transports: ['websocket', 'polling']
  });
  
  socket.on('connect', () => {
  });
  
  socket.on('disconnect', () => {
  });
  
  socket.on('analysis:progress', (data) => {
    handleProgressUpdate(data);
  });
}

// Ensure analyzer key is present for deterministic report identity
document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
});

// Handle real-time progress updates
function handleProgressUpdate(data) {
  // Update loader based on WebSocket data
  if (!loader) return;
  
  // Map WebSocket stage/metric to step index
  const stepMapping = {
    'SEO': 0,
    'Security': 1,
    'Accessibility': 2,
    'Core Web Vitals': 3,
    'Performance': 4
  };
  
  if (data.stage && stepMapping[data.stage] !== undefined) {
    const stepIndex = stepMapping[data.stage];
    
    // Update modal step display
    const modalSteps = document.querySelectorAll('.modal-step');
    if (modalSteps[stepIndex]) {
      if (data.status === 'metric-complete') {
        // Mark step as complete
        modalSteps[stepIndex].classList.remove('pending', 'active');
        modalSteps[stepIndex].classList.add('complete');
        modalSteps[stepIndex].querySelector('.modal-step-icon').textContent = '✓';
        
        loader.completeStep(stepIndex);
        
        // Activate next step
        if (modalSteps[stepIndex + 1]) {
          modalSteps[stepIndex + 1].classList.remove('pending');
          modalSteps[stepIndex + 1].classList.add('active');
          modalSteps[stepIndex + 1].querySelector('.modal-step-icon').textContent = '◉';
        }
      } else if (data.status === 'metric') {
        // Mark step as active
        modalSteps[stepIndex].classList.remove('pending');
        modalSteps[stepIndex].classList.add('active');
        modalSteps[stepIndex].querySelector('.modal-step-icon').textContent = '◉';
      }
    }
  }
}

// Add competitor input field
// eslint-disable-next-line no-unused-vars
function addCompetitorInput() {
  const container = document.getElementById('competitorInputs');
  const currentCount = container.querySelectorAll('.competitor-input-row').length;
  
  if (currentCount >= maxCompetitors) {
    alert(`Maximum ${maxCompetitors} competitors allowed`);
    return;
  }
  
  const row = document.createElement('div');
  row.className = 'competitor-input-row';
  
  const input = document.createElement('input');
  input.type = 'url';
  input.className = 'competitor-url';
  input.placeholder = `https://competitor${currentCount + 1}.com`;
  input.setAttribute('aria-label', `Competitor ${currentCount + 1} URL`);
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-competitor';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', function() {
    removeCompetitor(this);
  });
  
  row.appendChild(input);
  row.appendChild(removeBtn);
  container.appendChild(row);
  
  // Hide add button if at max
  if (currentCount + 1 >= maxCompetitors) {
    document.getElementById('addCompetitorBtn').style.display = 'none';
  }
}

// Expose for HTML button handlers / external triggers
window.addCompetitorInput = addCompetitorInput;

// Remove competitor input field
function removeCompetitor(button) {
  const container = document.getElementById('competitorInputs');
  const row = button.parentElement;
  
  if (container.querySelectorAll('.competitor-input-row').length <= 1) {
    alert('At least one competitor is required');
    return;
  }
  
  row.remove();
  
  // Show add button if below max
  document.getElementById('addCompetitorBtn').style.display = 'block';
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
  // Note: Add competitor and remove buttons use inline onclick handlers in HTML
  // No additional event listeners needed here
});

// Analyze competition
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const yourUrl = document.getElementById('yourUrl').value.trim();
  const competitorInputs = document.querySelectorAll('.competitor-url');
  const competitorUrls = Array.from(competitorInputs)
    .map(input => input.value.trim())
    .filter(url => url.length > 0);
  
  if (!yourUrl) {
    alert('Please enter your website URL');
    return;
  }
  
  if (competitorUrls.length === 0) {
    alert('Please enter at least one competitor URL');
    return;
  }
  
  const resultsDiv = document.getElementById('results');
  const analyzeBtn = document.getElementById('analyzeBtn');
  
  // Show Pac-Man modal instead of regular loader
  const modal = document.getElementById('pacmanModal');
  const previousFocus = document.activeElement;
  const closePacmanModal = () => {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onPacmanKeyDown);
    if (previousFocus && typeof previousFocus.focus === 'function' && document.contains(previousFocus)) {
      previousFocus.focus();
    }
  };

  const getPacmanFocusable = () => {
    if (!modal) return [];
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];
    return Array.from(modal.querySelectorAll(selectors.join(','))).filter((el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style && style.visibility !== 'hidden' && style.display !== 'none';
    });
  };

  const onPacmanKeyDown = (e) => {
    if (!modal || !modal.classList.contains('active')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePacmanModal();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = getPacmanFocusable();
    if (!focusables.length) {
      e.preventDefault();
      modal.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onPacmanKeyDown);
    window.requestAnimationFrame(() => modal.focus());
  }
  
  // Initialize unified loader (hidden, but still tracking progress)
  const steps = [
    { label: 'SEO Analysis', detail: 'Analyzing search engine optimization metrics...' },
    { label: 'Security Scan', detail: 'Checking security headers and protocols...' },
    { label: 'Accessibility Check', detail: 'Evaluating accessibility standards...' },
    { label: 'Core Web Vitals', detail: 'Measuring page speed and user experience...' },
    { label: 'Performance Test', detail: 'Running Lighthouse performance audit...' }
  ];
  
  // Initialize modal progress tracking
  const totalSeconds = 900; // 15 minutes
  let elapsedSeconds = 0;
  
  const modalTimer = setInterval(() => {
    elapsedSeconds++;
    const remaining = totalSeconds - elapsedSeconds;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    
    const timeDisplay = document.getElementById('modalTimeRemaining');
    if (timeDisplay) {
      timeDisplay.textContent = `Time remaining: ${minutes}m ${seconds}s`;
    }
    
    // Update progress bar
    const progressFill = document.getElementById('modalProgressFill');
    const progressPercent = document.getElementById('modalProgressPercent');
    if (progressFill) {
      const percentage = (elapsedSeconds / totalSeconds) * 100;
      progressFill.style.width = `${Math.min(percentage, 100)}%`;
      
      if (progressPercent) {
        progressPercent.textContent = `${Math.min(Math.round(percentage), 100)}%`;
      }
    }
  }, 1000);
  
  // eslint-disable-next-line no-undef
  loader = new AnalyzerLoader('loadingContainer');
  loader.start(steps, '[COMPETITIVE_ANALYSIS]', 900); // 15 minutes = 900 seconds
  
  // Initialize WebSocket connection
  initializeWebSocket();
  
  resultsDiv.style.display = 'none';
  analyzeBtn.disabled = true;
  
  try {
    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

    const response = await fetch('/api/competitive-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        yourUrl,
        competitorUrls,
        scanStartedAt
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      // Extract the actual error message from the response
      const errorMessage = error.message || error.error || error.details?.message || 'Analysis failed';
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // Join WebSocket session room for real-time updates
    if (data.sessionId && socket) {
      socket.emit('join-session', data.sessionId);
    }
    
    // Debug: Log the data structure
    // Validate data structure before rendering
    if (!data || !data.yourSite) {
      throw new Error('Invalid response structure: missing yourSite data');
    }
    
    if (!data.yourSite.scores) {
      throw new Error('Invalid response structure: missing scores data');
    }
    
    displayResults(data);
    
    loader.complete();
    
    // Close modal and show results
    clearInterval(modalTimer);
    closePacmanModal();
    resultsDiv.style.display = 'block';
    
  } catch (error) {
    // Show detailed error message
    const errorMsg = error.message || 'An unknown error occurred';
    loader.showError(errorMsg);
    console.error('Competitive analysis error:', error);
    
    // Close modal on error
    clearInterval(modalTimer);
    closePacmanModal();
  } finally {
    analyzeBtn.disabled = false;
  }
});

// Display competitive analysis results
function displayResults(data) {
  // Defensive checks
  if (!data || !data.yourSite || !data.competitors) {
    console.error('Invalid data structure:', data);
    alert('Error: Invalid response data structure');
    return;
  }
  
  if (!data.yourSite.scores) {
    console.error('Missing scores in yourSite:', data.yourSite);
    alert('Error: Missing scores data');
    return;
  }
  
  const resultsDiv = document.getElementById('results');
  
  try {
    // Build the HTML with executive summary and interactive charts at top (always visible)
    // Then accordion sections for detailed breakdowns
    const html = `
      ${renderExecutiveSummary(data)}
      ${renderInteractiveCharts(data)}
      
      <div id="accordionContainer" class="accordion-container"></div>
    `;
    
    resultsDiv.innerHTML = html;
    
    // Create accordion sections
    const accordionContainer = document.getElementById('accordionContainer');
    
    // Detailed Metrics Breakdown
    createCompetitiveAccordion(accordionContainer, 'detailed-metrics', '📋 Detailed Metrics Breakdown', 
      () => renderDetailedMetricsContent(data), null, true);
    
    // Key Insights
    if (data.insights && data.insights.length > 0) {
      createCompetitiveAccordion(accordionContainer, 'key-insights', 'ⓘ Key Insights', 
        () => renderInsightsContent(data.insights), null, true);
    }
    
    // Visual Score Comparison
    createCompetitiveAccordion(accordionContainer, 'visual-comparison', '◉ Visual Score Comparison', 
      () => renderVisualComparisonContent(data), null, false);
    
    // Competitive Position Summary
    createCompetitiveAccordion(accordionContainer, 'competitive-position', '◈ Competitive Position Summary', 
      () => renderCompetitivePositionContent(data), null, false);
    
    // Head-to-Head Battle
    createCompetitiveAccordion(accordionContainer, 'head-to-head', '⚔️ Head-to-Head Battle', 
      () => renderHeadToHeadContent(data), null, false);
    
    // Strengths & Weaknesses
    createCompetitiveAccordion(accordionContainer, 'strengths-weaknesses', '💪 Your Competitive Strengths & Weaknesses', 
      () => renderStrengthsWeaknessesContent(data), null, false);
    
    // Action Plan / Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      createCompetitiveAccordion(accordionContainer, 'action-plan', '🎯 Action Plan to Beat Competition', 
        () => renderRecommendationsContent(data.recommendations), null, true);
    }
    
    // Initialize charts after DOM is updated
    setTimeout(() => {
      initializeCharts(data);
    }, 100);


    // Pro Report Block
    if (window.ProReportBlock && window.ProReportBlock.render) {
      const proBlockHtml = window.ProReportBlock.render({
        context: 'competitive-analysis',
        features: ['pdf', 'csv', 'share'],
        title: 'Unlock Report',
        subtitle: 'PDF export, share link, export data, and fix packs for this scan.'
      });
      accordionContainer.insertAdjacentHTML('beforeend', proBlockHtml);
    }
  } catch (error) {
    console.error('Error rendering results:', error);
    alert(`Error displaying results: ${error.message}`);
  }
}

// Create accordion section for competitive analysis
function createCompetitiveAccordion(container, id, title, contentCreator, score, startExpanded = false) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  accordion.style.marginBottom = '0.5rem';
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  header.innerHTML = `
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      <span>${title}</span>
    </span>
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      ${score !== null ? `<span style="color: ${getScoreColor(score)}; font-size: 0.9rem;">${score}</span>` : ''}
      <span class="accordion-toggle">${startExpanded ? '▲' : '▼'}</span>
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
    } else {
      // Expand and create content if not already created
      if (!contentInner.hasChildNodes()) {
        const contentHTML = contentCreator();
        contentInner.innerHTML = contentHTML;
      }
      
      content.classList.add('expanded');
      header.classList.add('active');
      header.querySelector('.accordion-toggle').textContent = '▲';
    }
  });
  
  accordion.appendChild(header);
  accordion.appendChild(content);
  container.appendChild(accordion);
  
  // If startExpanded, trigger the expansion
  if (startExpanded) {
    contentInner.innerHTML = contentCreator();
    content.classList.add('expanded');
    header.classList.add('active');
  }
}

// Get score color
function getAccentPrimaryColor() {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-primary')
      .trim();
    if (value) return value;
  } catch (e) {
    // Ignore
  }

  const isLightTheme = document.body && document.body.classList.contains('white-theme');
  return isLightTheme ? '#dd3838' : '#5bf4e7';
}

function getScoreColor(score) {
  if (score >= 80) return getAccentPrimaryColor();
  if (score >= 60) return '#ffa500';
  return '#ff4444';
}

// Chart instances storage
let radarChart = null;
let barChart = null;

// Render interactive charts section
function renderInteractiveCharts() {
  return `
    <div class="section chart-container">
      <div class="chart-header">
        <div>
          <h3 class="chart-title">◈ Interactive Score Analysis</h3>
          <p class="chart-subtitle">Compare performance across all metrics with interactive charts</p>
        </div>
        <div class="chart-controls">
          <button class="chart-toggle active" data-chart="radar" id="radarToggle">
            ◉ Radar View
          </button>
          <button class="chart-toggle" data-chart="bar" id="barToggle">
            ▬ Bar Chart
          </button>
        </div>
      </div>
      
      <div class="chart-wrapper radar" id="radarWrapper">
        <canvas id="radarChart"></canvas>
      </div>
      
      <div class="chart-wrapper" id="barWrapper" style="display: none;">
        <canvas id="barChart"></canvas>
      </div>
    </div>
  `;
}

// Switch between chart views
function switchChart(view) {
  // Update button states
  document.getElementById('radarToggle').classList.toggle('active', view === 'radar');
  document.getElementById('barToggle').classList.toggle('active', view === 'bar');
  
  // Toggle chart visibility
  document.getElementById('radarWrapper').style.display = view === 'radar' ? 'block' : 'none';
  document.getElementById('barWrapper').style.display = view === 'bar' ? 'block' : 'none';
}

// Initialize Chart.js charts
function initializeCharts(data) {
  // Store data globally for theme changes
  chartData = data;
  
  const sites = [
    { name: getDomainName(data.yourSite.url), scores: data.yourSite.scores, isYourSite: true },
    ...data.competitors.map(comp => ({
      name: getDomainName(comp.url),
      scores: comp.scores,
      isYourSite: false
    }))
  ];
  
  createRadarChart(sites);
  createBarChart(sites);
  
  // Add event listeners to chart toggle buttons
  const radarToggle = document.getElementById('radarToggle');
  const barToggle = document.getElementById('barToggle');
  
  if (radarToggle) {
    radarToggle.addEventListener('click', () => switchChart('radar'));
  }
  
  if (barToggle) {
    barToggle.addEventListener('click', () => switchChart('bar'));
  }
}

// Create Radar Chart
function createRadarChart(sites) {
  const ctx = document.getElementById('radarChart');
  if (!ctx) return;
  
  // Destroy existing chart
  if (radarChart) {
    radarChart.destroy();
  }
  
  // Detect theme
  const isLightTheme = document.body.classList.contains('white-theme');
  const textColor = isLightTheme ? '#000000' : 'rgba(255, 255, 255, 0.9)';
  const gridColor = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  
  const metrics = ['seo', 'security', 'accessibility', 'coreWebVitals', 'performance'];
  const metricLabels = ['SEO', 'Security', 'Accessibility', 'Core Web Vitals', 'Performance'];
  
  const datasets = sites.map((site, idx) => {
    const color = getChartColor(idx, site.isYourSite);
    const scores = metrics.map(metric => site.scores[metric] || 0);
    
    return {
      label: site.name,
      data: scores,
      backgroundColor: `${color}20`,
      borderColor: color,
      borderWidth: site.isYourSite ? 3 : 2,
      pointBackgroundColor: color,
      pointBorderColor: isLightTheme ? '#fff' : '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: color,
      pointRadius: site.isYourSite ? 6 : 4,
      pointHoverRadius: site.isYourSite ? 8 : 6
    };
  });
  
  // Chart.js loaded via CDN in HTML
  // eslint-disable-next-line no-undef
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: metricLabels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20,
            color: textColor,
            font: { size: 12 },
            backdropColor: 'transparent'
          },
          grid: {
            color: gridColor
          },
          angleLines: {
            color: gridColor
          },
          pointLabels: {
            color: textColor,
            font: { size: 14, weight: 'bold' }
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: textColor,
            font: { size: 14, weight: 'bold' },
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: getAccentPrimaryColor(),
          bodyColor: '#fff',
          borderColor: getAccentPrimaryColor(),
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              const score = context.parsed.r;
              const grade = getScoreGrade(score);
              return `${context.dataset.label}: ${score} (${grade})`;
            }
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart'
      }
    }
  });
}

// Create Bar Chart
function createBarChart(sites) {
  const ctx = document.getElementById('barChart');
  if (!ctx) return;
  
  // Destroy existing chart
  if (barChart) {
    barChart.destroy();
  }
  
  // Detect theme
  const isLightTheme = document.body.classList.contains('white-theme');
  const textColor = isLightTheme ? '#000000' : 'rgba(255, 255, 255, 0.9)';
  const gridColor = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  
  const metrics = ['seo', 'security', 'accessibility', 'coreWebVitals', 'performance'];
  const metricLabels = ['SEO', 'Security', 'Accessibility', 'Core Web Vitals', 'Performance'];
  
  const datasets = sites.map((site, idx) => {
    const color = getChartColor(idx, site.isYourSite);
    const scores = metrics.map(metric => site.scores[metric] || 0);
    
    return {
      label: site.name,
      data: scores,
      backgroundColor: color,
      borderColor: site.isYourSite ? getAccentPrimaryColor() : color,
      borderWidth: site.isYourSite ? 3 : 1,
      borderRadius: 6,
      barThickness: 'flex'
    };
  });
  
  // Chart.js loaded via CDN in HTML
  // eslint-disable-next-line no-undef
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: metricLabels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20,
            color: textColor,
            font: { size: 12 },
            callback: function(value) {
              return value;
            }
          },
          grid: {
            color: gridColor
          }
        },
        x: {
          ticks: {
            color: textColor,
            font: { size: 13, weight: 'bold' }
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: textColor,
            font: { size: 14, weight: 'bold' },
            padding: 15,
            usePointStyle: true,
            pointStyle: 'rect'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: getAccentPrimaryColor(),
          bodyColor: '#fff',
          borderColor: getAccentPrimaryColor(),
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              const score = context.parsed.y;
              const grade = getScoreGrade(score);
              return `${context.dataset.label}: ${score} (${grade})`;
            },
            afterLabel: function(context) {
              const score = context.parsed.y;
              if (score >= 80) return '✓ Excellent';
              if (score >= 60) return '~ Good';
              return '✗ Needs Improvement';
            }
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart',
        delay: (context) => {
          return context.dataIndex * 100;
        }
      }
    }
  });
}

// Get chart color for site
function getChartColor(index, isYourSite) {
  if (isYourSite) return getAccentPrimaryColor();
  
  const colors = [
    '#ff6b6b', // Red
    '#ffa500', // Orange
    '#4169e1', // Blue
    '#9370db'  // Purple
  ];
  
  return colors[index % colors.length];
}

// Get score grade
function getScoreGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

// Detailed Metrics Breakdown Content (for accordion)
function renderDetailedMetricsContent(data) {
  const sites = [
    { name: getDomainName(data.yourSite.url), data: data.yourSite, isYou: true },
    ...data.competitors.map(comp => ({
      name: getDomainName(comp.url),
      data: comp,
      isYou: false
    }))
  ];

  const metrics = [
    { key: 'seo', label: 'SEO', icon: 'S' },
    { key: 'security', label: 'Security', icon: '◈' },
    { key: 'accessibility', label: 'Accessibility', icon: 'A' },
    { key: 'coreWebVitals', label: 'Core Web Vitals', icon: 'V' },
    { key: 'performance', label: 'Performance', icon: 'P' }
  ];

  return `
    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
      Complete score breakdown with individual metric details for every site
    </p>
    
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.03); border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: rgba(var(--accent-primary-rgb), 0.1); border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
            <th style="padding: 0.6rem 0.8rem; text-align: left; color: var(--accent-primary); font-weight: bold; border-right: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem;">
              Site
            </th>
            ${metrics.map(({ label, icon }) => `
              <th style="padding: 0.6rem 0.8rem; text-align: center; color: var(--text-primary); font-weight: bold; border-right: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem;">
                ${icon} ${label}
              </th>
            `).join('')}
            <th style="padding: 0.6rem 0.8rem; text-align: center; color: #ffd700; font-weight: bold; font-size: 0.95rem;">
              ◉ Overall
            </th>
          </tr>
        </thead>
        <tbody>
          ${sites.map((site, siteIdx) => {
            const scores = site.data.scores || {};
            const details = site.data.details || {};
            const isYou = site.isYou;
            
            return `
              <tr style="background: ${isYou ? 'rgba(var(--accent-primary-rgb), 0.05)' : siteIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 0.6rem 0.8rem; font-weight: ${isYou ? 'bold' : 'normal'}; color: ${isYou ? 'var(--accent-primary)' : 'var(--text-primary)'}; border-right: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem;">
                  ${isYou ? '◉ ' : ''}${site.name}${isYou ? ' (YOU)' : ''}
                  <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.15rem;">
                    ${getDomainName(site.data.url)}
                  </div>
                </td>
                ${metrics.map(({ key }) => {
                  const score = scores[key] || 0;
                  const hasDetails = details[key] !== null && details[key] !== undefined;
                  const failed = score === 0;
                  
                  let scoreColor = '#ff4444';
                  if (score >= 80) scoreColor = getAccentPrimaryColor();
                  else if (score >= 60) scoreColor = '#ffa500';
                  
                  let grade = 'F';
                  if (score >= 90) grade = 'A+';
                  else if (score >= 80) grade = 'A';
                  else if (score >= 70) grade = 'B';
                  else if (score >= 60) grade = 'C';
                  else if (score >= 50) grade = 'D';
                  
                  return `
                    <td style="padding: 0.5rem 0.6rem; text-align: center; border-right: 1px solid rgba(255,255,255,0.1);">
                      <div style="font-size: 1.2rem; font-weight: bold; color: ${scoreColor}; margin-bottom: 0.15rem;">
                        ${failed ? '✗' : score}
                      </div>
                      <div style="font-size: 0.7rem; padding: 0.15rem 0.4rem; background: ${scoreColor}20; border: 1px solid ${scoreColor}40; border-radius: 3px; display: inline-block; color: ${scoreColor};">
                        ${failed ? 'Failed' : grade}
                      </div>
                      ${failed ? `
                        <div style="font-size: 0.65rem; color: #ff8c00; margin-top: 0.3rem;">
                          ~ Analysis error
                        </div>
                      ` : hasDetails && key === 'coreWebVitals' && details[key].metrics ? `
                        <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.3rem; line-height: 1.3;">
                          LCP: ${details[key].metrics.lcp ? (details[key].metrics.lcp / 1000).toFixed(2) + 's' : 'N/A'}<br>
                          FID: ${details[key].metrics.fid ? details[key].metrics.fid.toFixed(0) + 'ms' : 'N/A'}<br>
                          CLS: ${details[key].metrics.cls ? details[key].metrics.cls.toFixed(3) : 'N/A'}
                        </div>
                      ` : ''}
                    </td>
                  `;
                }).join('')}
                <td style="padding: 0.6rem 0.8rem; text-align: center; background: ${isYou ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'rgba(255, 215, 0, 0.05)'};">
                  <div style="font-size: 1.5rem; font-weight: bold; color: ${scores.overall >= 80 ? 'var(--accent-primary)' : scores.overall >= 60 ? '#ffa500' : '#ff4444'};">
                    ${scores.overall || 0}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem;">
                    ${site.data.grade || 'F'}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255, 152, 0, 0.1); border-left: 4px solid #ff8c00; border-radius: 4px;">
      <strong style="color: #ff8c00;">ⓘ Note:</strong>
      <span style="color: var(--text-secondary); font-size: 0.9rem;">
        Scores marked with ✗ indicate analyzer failures (typically due to Lighthouse timeouts or site restrictions). 
        These metrics are excluded from overall score calculation to ensure accuracy.
      </span>
    </div>
  `;
}

// Legacy wrapper for backward compatibility
function renderDetailedMetricsTable(data) {
  return `<section class="section"><h2>📋 Detailed Metrics Breakdown</h2>${renderDetailedMetricsContent(data)}</section>`;
}

// Executive Summary - Quick overview
function renderExecutiveSummary(data) {
  // Defensive checks
  if (!data.yourSite?.scores || !data.competitors || data.competitors.length === 0) {
    return '<div class="error">Missing data for executive summary</div>';
  }
  
  const totalCompetitors = data.competitors.length;
  const yourOverall = data.yourSite.scores.overall || 0;
  const competitorScores = data.competitors
    .map(c => c.scores?.overall || 0)
    .filter(score => score > 0);
  
  if (competitorScores.length === 0) {
    return '<div class="warning">No valid competitor scores available</div>';
  }
  
  const avgCompetitor = competitorScores.reduce((a, b) => a + b, 0) / competitorScores.length;
  const maxCompetitor = Math.max(...competitorScores);
  
  const overallRank = data.rankings?.overall?.rank || totalCompetitors + 1;
  const isWinning = overallRank === 1;
  const isLosing = overallRank === totalCompetitors + 1;
  
  // Count wins/losses across metrics
  const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
  let winsCount = 0;
  let lossesCount = 0;
  metrics.forEach(metric => {
    const status = data.comparison?.[metric]?.status;
    if (status === 'winning') winsCount++;
    if (status === 'losing') lossesCount++;
  });
  
  const statusColor = isWinning ? getAccentPrimaryColor() : isLosing ? '#ff4444' : '#ff8c00';
  const statusIcon = isWinning ? '↑' : isLosing ? '↓' : '≈';
  const statusText = isWinning ? 'COMPETITIVE' : isLosing ? 'COMPETITIVE' : 'COMPETITIVE';
  
  return `
    <div style="
      background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.05) 0%, rgba(0,0,0,0.1) 100%);
      border: 2px solid ${statusColor};
      border-radius: 16px;
      padding: 2.5rem;
      margin-bottom: 2rem;
      position: relative;
      overflow: hidden;
    ">
      <!-- Status Badge -->
      <div style="
        position: absolute;
        top: -1px;
        right: -1px;
        background: ${statusColor};
        color: #000;
        padding: 0.5rem 1.5rem;
        border-bottom-left-radius: 12px;
        font-weight: 700;
        font-size: 0.9rem;
        letter-spacing: 1px;
      ">
        ${statusIcon} ${statusText}
      </div>

      <div style="display: grid; grid-template-columns: 180px 1fr 240px; gap: 2.5rem; align-items: center;">
        <!-- Score Circle -->
        <div style="text-align: center;">
          <div class="score-circle-gradient" style="
            width: 180px;
            height: 180px;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 6px solid ${statusColor};
            box-shadow: 0 0 30px ${statusColor}40, inset 0 0 20px rgba(0,0,0,0.3);
            position: relative;
          ">
            <div style="font-size: 4rem; font-weight: 900; color: ${statusColor}; line-height: 1; text-shadow: 0 0 20px ${statusColor}80;">
              ${yourOverall}
            </div>
            <div style="
              font-size: 0.95rem; 
              color: var(--text-primary); 
              margin-top: 0.5rem;
              font-weight: 600;
              letter-spacing: 1px;
            ">
              Grade ${data.yourSite.grade}
            </div>
          </div>
        </div>
        
        <!-- Stats Grid -->
        <div>
          <div style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
            Ranked <span style="color: ${statusColor}; font-size: 1.4rem; font-weight: 900;">#${overallRank}</span> out of ${totalCompetitors + 1} competitors analyzed
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 1.5rem;">
            <div style="
              background: rgba(255,255,255,0.03);
              padding: 1rem;
              border-radius: 8px;
              border-left: 3px solid var(--accent-primary);
            ">
              <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                Winning in
              </div>
              <div style="font-size: 2rem; font-weight: 900; color: var(--text-primary); line-height: 1;">
                ${winsCount}/${metrics.length}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                categories
              </div>
            </div>
            
            <div style="
              background: rgba(255,255,255,0.03);
              padding: 1rem;
              border-radius: 8px;
              border-left: 3px solid #ff8c00;
            ">
              <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                Avg competitor
              </div>
              <div style="font-size: 2rem; font-weight: 900; color: var(--text-primary); line-height: 1;">
                ${Math.round(avgCompetitor)}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                score
              </div>
            </div>
            
            <div style="
              background: rgba(255,255,255,0.03);
              padding: 1rem;
              border-radius: 8px;
              border-left: 3px solid ${maxCompetitor > yourOverall ? '#ff4444' : 'var(--accent-primary)'};
            ">
              <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.25rem;">
                Gap to leader
              </div>
              <div style="font-size: 2rem; font-weight: 900; color: ${maxCompetitor > yourOverall ? '#ff4444' : 'var(--accent-primary)'}; line-height: 1;">
                ${maxCompetitor > yourOverall ? `${maxCompetitor - yourOverall}` : `+${yourOverall - maxCompetitor}`}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                points
              </div>
            </div>
          </div>
        </div>
        
        <!-- Priority Focus -->
        <div style="
          background: linear-gradient(135deg, ${statusColor}20 0%, ${statusColor}05 100%);
          border: 2px solid ${statusColor}60;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
        ">
          <div style="
            font-size: 0.85rem; 
            color: var(--text-secondary); 
            text-transform: uppercase; 
            letter-spacing: 1.5px; 
            margin-bottom: 0.75rem;
            font-weight: 600;
          ">
            Priority Focus
          </div>
          <div style="
            font-size: 1.5rem; 
            font-weight: 900; 
            color: var(--text-primary);
            line-height: 1.2;
            margin-bottom: 1rem;
          ">
            ${lossesCount > 0 ? 
              `Fix ${lossesCount} ${lossesCount === 1 ? 'weakness' : 'weaknesses'}` : 
              'Maintain Lead'}
          </div>
          <div style="
            font-size: 0.8rem; 
            color: var(--text-secondary);
            padding: 0.5rem 1rem;
            background: rgba(0,0,0,0.2);
            border-radius: 6px;
            display: inline-block;
          ">
            ${data.analysisTime}s analysis
          </div>
        </div>
      </div>
    </div>
    
    ${data.warning ? `
      <div style="background: rgba(255, 140, 0, 0.15); border-left: 4px solid #ff8c00; padding: 1rem; margin-bottom: 2rem; border-radius: 4px;">
        <p style="margin: 0; color: #ff8c00;">
          <strong>ⓘ Note:</strong> ${data.warning}
        </p>
      </div>
    ` : ''}
  `;
}

// Render rankings grid
function renderRankings(rankings) {
  const metrics = [
    { key: 'overall', label: 'Overall', data: rankings.overall },
    { key: 'seo', label: 'SEO', data: rankings.seo },
    { key: 'performance', label: 'Performance', data: rankings.performance },
    { key: 'coreWebVitals', label: 'Core Web Vitals', data: rankings.coreWebVitals },
    { key: 'accessibility', label: 'Accessibility', data: rankings.accessibility },
    { key: 'security', label: 'Security', data: rankings.security }
  ];

  return `
    <section class="section">
      <h2>R Your Rankings</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.03); border-radius: 8px; overflow: hidden; font-size: 0.9rem;">
          <thead>
            <tr style="background: rgba(255,255,255,0.08);">
              <th style="padding: 0.75rem 1rem; text-align: left; border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-primary); font-weight: 600;">Metric</th>
              <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-primary); font-weight: 600; width: 60px;">Medal</th>
              <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-primary); font-weight: 600; width: 80px;">Rank</th>
              <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-primary); font-weight: 600; width: 100px;">Status</th>
              <th style="padding: 0.75rem 1rem; text-align: left; border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-primary); font-weight: 600;">Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.map(({ key, label, data }) => {
              // Check if metric failed
              const failed = data.failed || data.rank === 0 || data.total === 0;
              const isFirst = data.rank === 1 && !failed;
              const isSecond = data.rank === 2 && !failed;
              const isThird = data.rank === 3 && !failed;
              const isLast = data.rank === data.total && data.total > 0 && !failed;
              
              let statusColor = '#ff4444';
              let statusText = '~ Behind';
              let medal = data.medal || '◉';
              let rankDisplay = data.rank ? `${data.rank}/${data.total}` : '—';
              let recommendation = '';
              
              if (failed) {
                statusColor = '#ff4444';
                statusText = data.total === 0 ? '✗ All Failed' : '✗ Failed';
                medal = '✗';
                rankDisplay = '—';
                recommendation = 'Fix analysis errors - check site accessibility';
              } else if (isFirst) {
                statusColor = getAccentPrimaryColor();
                statusText = '↑ Leading!';
                recommendation = 'Maintain position - monitor competitors';
              } else if (isSecond) {
                statusColor = '#ffd700';
                statusText = '🥈 Strong';
                recommendation = 'Push to #1 - minor optimizations needed';
              } else if (isThird) {
                statusColor = '#ff8c00';
                statusText = '≈ Competitive';
                recommendation = `Improve ${label.toLowerCase()} - gap closing opportunity`;
              } else if (isLast) {
                statusColor = '#ff4444';
                statusText = '↓ Behind';
                recommendation = `Priority: ${label.toLowerCase()} overhaul required`;
              } else {
                statusColor = '#ff8c00';
                statusText = '◉ Mid-pack';
                recommendation = `Target ${label.toLowerCase()} improvements for rank gain`;
              }
              
              // Specific recommendations by metric
              if (!failed) {
                switch(key) {
                  case 'overall':
                    recommendation = isFirst ? 'Maintain all-around excellence' : 
                                   isLast ? 'Multi-metric improvement needed - start with weakest area' :
                                   'Focus on lowest-scoring individual metrics';
                    break;
                  case 'seo':
                    recommendation = isFirst ? 'Monitor keyword rankings & maintain' :
                                   'Optimize meta tags, content, internal linking';
                    break;
                  case 'performance':
                    recommendation = isFirst ? 'Keep load times optimized' :
                                   'Reduce page size, optimize images, enable caching';
                    break;
                  case 'coreWebVitals':
                    recommendation = isFirst ? 'Maintain LCP/FCP/CLS scores' :
                                   'Improve LCP (<2.5s), FCP (<1.8s), CLS (<0.1)';
                    break;
                  case 'accessibility':
                    recommendation = isFirst ? 'Keep accessibility standards high' :
                                   'Add alt text, improve contrast, fix ARIA labels';
                    break;
                  case 'security':
                    recommendation = isFirst ? 'Maintain security best practices' :
                                   'Enable HTTPS, add security headers, update protocols';
                    break;
                }
              }
              
              return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                  <td style="padding: 0.75rem 1rem; color: var(--text-primary); font-weight: 500;">${label}</td>
                  <td style="padding: 0.75rem; text-align: center; font-size: 1.5rem;">${medal}</td>
                  <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; font-weight: bold; color: ${failed ? '#666' : statusColor};">${rankDisplay}</td>
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="
                      display: inline-block;
                      padding: 0.3rem 0.6rem;
                      background: ${statusColor}22;
                      color: ${statusColor};
                      border-radius: 4px;
                      font-size: 0.85rem;
                      font-weight: 500;
                      border: 1px solid ${statusColor}44;
                      white-space: nowrap;
                    ">${statusText}</span>
                  </td>
                  <td style="padding: 0.75rem 1rem; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4;">
                    ${recommendation}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

// Render insights content (for accordion)
function renderInsightsContent(insights) {
  if (!insights || insights.length === 0) return '<p style="color: var(--text-secondary);">No insights available.</p>';
  
  return `
    ${insights.map(insight => `
      <div class="insight-card insight-${insight.type}" style="margin-bottom: 0.75rem;">
        <h3 style="margin: 0 0 0.5rem 0;">${insight.message}</h3>
        <p style="margin: 0; color: var(--text-secondary);">${insight.detail}</p>
      </div>
    `).join('')}
  `;
}

// Legacy wrapper
function renderInsights(insights) {
  if (!insights || insights.length === 0) return '';
  
  return `
    <section class="section">
      <h2>ⓘ Key Insights</h2>
      ${renderInsightsContent(insights)}
    </section>
  `;
}

// Render comparison table with visual enhancements
function renderComparisonTable(data) {
  const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
  
  // Legacy - now handled by accordions
  return '';
}

// Get metric status from rankings data (ALWAYS use this to check if metric failed)
function getMetricStatus(data, metric) {
  const rankingData = data.rankings?.[metric] || {};
  const failed = rankingData.failed || rankingData.rank === 0 || rankingData.total === 0;
  
  return {
    failed: failed,
    rank: rankingData.rank || 0,
    total: rankingData.total || 0,
    displayRank: failed 
      ? (rankingData.total === 0 ? '✗ All Sites Failed' : '✗ Failed')
      : `${rankingData.rank || 0}/${rankingData.total || 0}`,
    statusText: failed 
      ? '✗ Analysis Failed'
      : (rankingData.rank === 1 ? '↑ Leading!' : rankingData.rank === 2 ? '≈ Strong' : '◉ Competitive'),
    statusColor: failed ? '#ff4444' : (rankingData.rank === 1 ? getAccentPrimaryColor() : rankingData.rank === 2 ? '#ffd700' : '#ff8c00')
  };
}

// Visual bar chart comparison content (for accordion)
function renderVisualComparisonContent(data) {
  const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
  
  return `
    <p style="color: var(--text-secondary); margin-bottom: 2rem;">
      See exactly where you stand against each competitor in every category
    </p>
    
    ${metrics.map(metric => {
      // Get metric status from backend rankings
      const metricStatus = getMetricStatus(data, metric);
      
      const allScores = [
        { name: 'You', score: data.yourSite.scores[metric], url: data.yourSite.url, isYou: true },
        ...data.competitors.map(c => ({ 
          name: getDomainName(c.url), 
          score: c.scores[metric], 
          url: c.url, 
          isYou: false 
        }))
      ].sort((a, b) => b.score - a.score);
      
      const maxScore = Math.max(...allScores.map(s => s.score));
      const yourScore = data.yourSite.scores[metric];
      const bestCompetitor = data.competitors.reduce((best, c) => 
        c.scores[metric] > (best?.scores[metric] || 0) ? c : best, null);
      const gap = bestCompetitor ? bestCompetitor.scores[metric] - yourScore : 0;
      
      return `
        <div style="margin-bottom: 2.5rem; padding: 1.5rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0; font-size: 1.1rem;">
              ${formatMetricName(metric)}
              ${metricStatus.failed ? `<span style="color: ${metricStatus.statusColor}; font-size: 0.9rem; margin-left: 0.5rem;">(${metricStatus.statusText})</span>` :
                gap > 0 ? `<span style="color: #ff4444; font-size: 0.9rem; margin-left: 0.5rem;">(-${gap} behind leader)</span>` : 
                 gap < 0 ? `<span style="color: var(--accent-primary); font-size: 0.9rem; margin-left: 0.5rem;">(+${Math.abs(gap)} ahead!)</span>` :
                 `<span style="color: #ffd700; font-size: 0.9rem; margin-left: 0.5rem;">(${metricStatus.statusText})</span>`}
            </h3>
            <div style="font-size: 0.85rem; color: ${metricStatus.statusColor};">
              Your rank: ${metricStatus.displayRank}
            </div>
          </div>
          
          ${allScores.map((site, idx) => {
            const percentage = maxScore > 0 ? (site.score / maxScore) * 100 : 0;
            const isWinner = idx === 0;
            const barColor = site.isYou ? getAccentPrimaryColor() : (isWinner ? '#ffd700' : '#4a9eff');
            
            return `
              <div style="margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                  <span style="font-size: 0.9rem; ${site.isYou ? 'font-weight: bold; color: var(--accent-primary);' : ''}">
                    ${isWinner ? '👑 ' : ''}${site.name}${site.isYou ? ' (YOU)' : ''}
                  </span>
                  <span style="font-weight: bold; font-size: 1rem; color: ${barColor};">
                    ${site.score}
                  </span>
                </div>
                <div style="background: rgba(255,255,255,0.1); height: 24px; border-radius: 4px; overflow: hidden; position: relative;">
                  <div style="
                    background: linear-gradient(90deg, ${barColor} 0%, ${barColor}dd 100%);
                    height: 100%;
                    width: ${percentage}%;
                    transition: width 1s ease-out;
                    display: flex;
                    align-items: center;
                    padding: 0 0.5rem;
                    font-size: 0.75rem;
                    font-weight: bold;
                    color: white;
                    box-shadow: ${site.isYou ? '0 0 10px ' + barColor : 'none'};
                  ">
                    ${percentage.toFixed(0)}%
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }).join('')}
  `;
}

// Legacy wrapper
function renderVisualComparison(data, metrics) {
  return `<section class="section"><h2>◉ Visual Score Comparison</h2>${renderVisualComparisonContent(data)}</section>`;
}

// Competitive position content (for accordion)
function renderCompetitivePositionContent(data) {
  return `
    <div class="stats-grid">
      ${Object.entries(data.comparison).map(([metric, stats]) => `
        <div class="stat-card" style="border: 2px solid ${stats.status === 'winning' ? 'var(--accent-primary)' : stats.status === 'losing' ? '#ff4444' : '#ffd700'};">
          <div style="text-align: center; margin-bottom: 0.5rem;">
            ${stats.status === 'winning' ? '✓' : stats.status === 'losing' ? '✗' : '≈'}
          </div>
          <div class="stat-value status-${stats.status}">
            ${stats.diff > 0 ? '+' : ''}${stats.diff}
          </div>
          <div class="stat-label">${formatMetricName(metric)}</div>
          <div class="stat-sublabel" style="font-weight: bold; color: ${stats.status === 'winning' ? 'var(--accent-primary)' : stats.status === 'losing' ? '#ff4444' : '#ffd700'};">
            ${stats.status === 'winning' ? 'WINNING' : stats.status === 'tied' ? 'TIED' : 'LOSING'}
          </div>
          <div style="font-size: 0.8rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
            <div>You: <strong>${stats.yourScore}</strong></div>
            <div>Avg: ${stats.avgCompetitor}</div>
            <div>Best: ${stats.maxCompetitor}</div>
            <div style="margin-top: 0.25rem; color: var(--text-secondary);">
              ${stats.percentile}th percentile
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Legacy wrapper
function renderCompetitivePosition(data) {
  return `<section class="section"><h2>◈ Competitive Position Summary</h2>${renderCompetitivePositionContent(data)}</section>`;
}

// Head-to-head content (for accordion)
function renderHeadToHeadContent(data) {
  const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
  const allSites = [
    { name: 'You', ...data.yourSite, isYou: true },
    ...data.competitors.map(c => ({ name: getDomainName(c.url), ...c, isYou: false }))
  ];
  
  return `
    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
      Detailed score breakdown across all competitors
    </p>
    
    <div style="overflow-x: auto;">
      <table class="comparison-table">
        <thead>
          <tr>
            <th style="position: sticky; left: 0; background: rgba(20, 20, 20, 0.95); z-index: 10;">Website</th>
            ${metrics.map(m => `<th>${formatMetricName(m)}</th>`).join('')}
            <th>Overall</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          ${allSites.map(site => {
            const isYou = site.isYou;
            return `
              <tr class="${isYou ? 'your-site' : ''}" style="${isYou ? 'background: rgba(var(--accent-primary-rgb), 0.1);' : ''}">
                <td style="position: sticky; left: 0; background: ${isYou ? 'rgba(var(--accent-primary-rgb), 0.15)' : 'rgba(20, 20, 20, 0.95)'}; z-index: 9;">
                  <strong>${isYou ? '👤 YOU' : site.name}</strong>
                  <br><small style="font-size: 0.75rem; opacity: 0.7;">${site.url}</small>
                </td>
                ${metrics.map(m => {
                  const score = site.scores[m];
                  const maxScore = Math.max(...allSites.map(s => s.scores[m]));
                  const isMax = score === maxScore && score > 0;
                  return `
                    <td style="text-align: center;">
                      <span style="
                        font-weight: ${isMax ? 'bold' : 'normal'};
                        color: ${isMax ? '#ffd700' : 'inherit'};
                        ${isMax ? 'text-shadow: 0 0 10px #ffd700;' : ''}
                      ">
                        ${isMax ? '👑 ' : ''}${score}
                      </span>
                    </td>
                  `;
                }).join('')}
                <td style="text-align: center;">
                  <strong style="font-size: 1.1rem;">${site.scores.overall}</strong>
                </td>
                <td style="text-align: center;">
                  <strong style="color: ${getGradeColor(site.grade)}; font-size: 1.2rem;">
                    ${site.grade}
                  </strong>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Legacy wrapper
function renderHeadToHead(data, metrics) {
  return `<section class="section"><h2>⚔️ Head-to-Head Battle</h2>${renderHeadToHeadContent(data)}</section>`;
}

// Strengths and weaknesses content (for accordion)
function renderStrengthsWeaknessesContent(data) {
  const metrics = ['seo', 'performance', 'accessibility', 'security', 'coreWebVitals'];
  const yourScores = data.yourSite.scores;
  
  // Calculate what you're winning and losing at
  const strengths = [];
  const weaknesses = [];
  
  metrics.forEach(metric => {
    const yourScore = yourScores[metric];
    const competitorScores = data.competitors.map(c => c.scores[metric]);
    const maxCompetitor = Math.max(...competitorScores);
    const avgCompetitor = competitorScores.reduce((a, b) => a + b, 0) / competitorScores.length;
    
    if (yourScore >= maxCompetitor) {
      strengths.push({
        metric,
        score: yourScore,
        lead: yourScore - avgCompetitor,
        status: 'dominant'
      });
    } else if (yourScore >= avgCompetitor) {
      strengths.push({
        metric,
        score: yourScore,
        lead: yourScore - avgCompetitor,
        status: 'ahead'
      });
    } else {
      weaknesses.push({
        metric,
        score: yourScore,
        gap: maxCompetitor - yourScore,
        avgGap: avgCompetitor - yourScore,
        leader: data.competitors.find(c => c.scores[metric] === maxCompetitor)
      });
    }
  });
  
  return `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 1rem;">
      <!-- Strengths -->
      <div style="background: rgba(var(--accent-primary-rgb), 0.05); padding: 1.5rem; border-radius: 8px; border: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
        <h3 style="margin: 0 0 1rem 0; color: var(--accent-primary); display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.5rem;">💪</span> Strengths (${strengths.length})
        </h3>
        ${strengths.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${strengths.map(s => `
              <div style="background: rgba(var(--accent-primary-rgb), 0.1); padding: 1rem; border-radius: 6px; border-left: 3px solid var(--accent-primary);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-weight: bold;">${formatMetricName(s.metric)}</span>
                  <span style="color: var(--accent-primary); font-weight: bold; font-size: 1.1rem;">${s.score}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                  ${s.status === 'dominant' ? '👑 <strong>DOMINATING</strong> - Best in category!' : 
                    `✓ <strong>+${s.lead.toFixed(0)} above average</strong>`}
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <p style="color: var(--text-secondary); font-style: italic;">
            No clear strengths identified. Focus on improving across all areas.
          </p>
        `}
      </div>
      
      <!-- Weaknesses -->
      <div style="background: rgba(255, 75, 75, 0.05); padding: 1.5rem; border-radius: 8px; border: 2px solid rgba(255, 75, 75, 0.3);">
        <h3 style="margin: 0 0 1rem 0; color: #ff4444; display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.5rem;">~</span> Weaknesses (${weaknesses.length})
        </h3>
        ${weaknesses.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${weaknesses.map(w => `
              <div style="background: rgba(255, 75, 75, 0.1); padding: 1rem; border-radius: 6px; border-left: 3px solid #ff4444;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-weight: bold;">${formatMetricName(w.metric)}</span>
                  <span style="color: #ff4444; font-weight: bold; font-size: 1.1rem;">${w.score}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                  ~ <strong>-${w.gap.toFixed(0)} behind leader</strong>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
                  Leader: <strong>${getDomainName(w.leader.url)}</strong> (${w.leader.scores[w.metric]})
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <p style="color: var(--accent-primary); font-style: italic;">
            ! No weaknesses! You're leading or competitive in all areas!
          </p>
        `}
      </div>
    </div>
  `;
}

// Legacy wrapper
function renderStrengthsWeaknesses(data, metrics) {
  return `<section class="section"><h2>💪 Your Competitive Strengths & Weaknesses</h2>${renderStrengthsWeaknessesContent(data)}</section>`;
}

// Recommendations content (for accordion)
function renderRecommendationsContent(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return `<p style="color: var(--accent-primary);">You're already ahead of the competition. Keep up the great work!</p>`;
  }
  
  return `
    <div style="display: grid; gap: 1rem;">
      ${recommendations.map((rec, idx) => `
        <div class="insight-card ${rec.priority === 'high' ? 'insight-critical' : 'insight-warning'}" style="margin-bottom: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h3 style="margin: 0 0 0.5rem 0;">
                ${idx + 1}. Close ${rec.gap}-point gap in ${rec.metric}
              </h3>
              <p style="margin: 0.5rem 0; color: var(--text-secondary);">${rec.recommendation}</p>
              <p style="margin: 0.5rem 0 0 0; font-style: italic; color: var(--text-secondary);">
                ⓘ ${rec.impact}
              </p>
            </div>
            <span style="padding: 0.25rem 0.75rem; background: rgba(255,255,255,0.1); border-radius: 4px; font-size: 0.85rem; white-space: nowrap;">
              ${rec.priority.toUpperCase()}
            </span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Legacy wrapper
function renderRecommendations(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return `
      <section class="section">
        <h2>✓ You're Dominating!</h2>
        <p style="color: var(--accent-primary);">You're already ahead of the competition. Keep up the great work!</p>
      </section>
    `;
  }
  
  return `<section class="section"><h2>🎯 Action Plan to Beat Competition</h2>${renderRecommendationsContent(recommendations)}</section>`;
}

// Utility functions
function formatMetricName(metric) {
  const names = {
    seo: 'SEO',
    performance: 'Performance',
    accessibility: 'Accessibility',
    security: 'Security',
    coreWebVitals: 'Core Web Vitals',
    overall: 'Overall'
  };
  return names[metric] || metric;
}

function getDomainName(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (e) {
    return url;
  }
}

function getGradeColor(grade) {
  const colors = {
    'A': getAccentPrimaryColor(),
    'B': '#ffd700',
    'C': '#ff8c00',
    'D': '#ff4444',
    'F': '#ff4444'
  };
  return colors[grade] || '#888';
}

// Enter key support for your URL
document.getElementById('yourUrl').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('analyzeBtn').click();
  }
});

// Store chart data globally so we can re-render on theme change
let chartData = null;

// Listen for theme changes and update charts
function setupThemeChangeListener() {
  // Watch for class changes on body element
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        // Theme changed, re-render charts if data exists
        if (chartData) {
          initializeCharts(chartData);
        }
      }
    });
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
}

// Initialize theme listener on page load
setupThemeChangeListener();
