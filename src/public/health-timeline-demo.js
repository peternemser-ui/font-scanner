// Sample data generator
function generateSampleData(scenario) {
  const baseUrl = 'https://example.com';
  const now = Date.now();
  
  switch(scenario) {
    case 'single':
      // First scan ever
      return [{
        id: 'scan1',
        url: baseUrl,
        timestamp: now,
        scores: {
          overall: 75,
          performance: 72,
          accessibility: 88,
          seo: 81,
          fonts: 65
        },
        metrics: {
          lcp: 2800,
          cls: 0.15,
          fcp: 1800
        }
      }];
      
    case 'comparison':
      // Current vs previous
      return [
        {
          id: 'scan2',
          url: baseUrl,
          timestamp: now,
          scores: {
            overall: 82,
            performance: 85,
            accessibility: 92,
            seo: 88,
            fonts: 78
          },
          metrics: {
            lcp: 2200,
            cls: 0.08,
            fcp: 1400
          }
        },
        {
          id: 'scan1',
          url: baseUrl,
          timestamp: now - (24 * 60 * 60 * 1000), // 1 day ago
          scores: {
            overall: 75,
            performance: 72,
            accessibility: 88,
            seo: 81,
            fonts: 65
          },
          metrics: {
            lcp: 2800,
            cls: 0.15,
            fcp: 1800
          }
        }
      ];
      
    case 'trend':
      // 7 scans over 2 weeks
      const scans = [];
      for (let i = 0; i < 7; i++) {
        const daysAgo = i * 2;
        const progress = (7 - i) / 7; // Improving over time
        scans.push({
          id: `scan${i}`,
          url: baseUrl,
          timestamp: now - (daysAgo * 24 * 60 * 60 * 1000),
          scores: {
            overall: Math.round(65 + (progress * 25)),
            performance: Math.round(60 + (progress * 30)),
            accessibility: Math.round(85 + (progress * 10)),
            seo: Math.round(75 + (progress * 20)),
            fonts: Math.round(55 + (progress * 35))
          },
          metrics: {
            lcp: 3500 - (progress * 1500),
            cls: 0.25 - (progress * 0.2),
            fcp: 2200 - (progress * 800)
          }
        });
      }
      return scans;
      
    case 'improvement':
      // Significant improvements
      return [
        {
          id: 'scan_after',
          url: baseUrl,
          timestamp: now,
          scores: {
            overall: 92,
            performance: 95,
            accessibility: 96,
            seo: 94,
            fonts: 88
          },
          metrics: {
            lcp: 1800,
            cls: 0.05,
            fcp: 1200
          }
        },
        {
          id: 'scan_before',
          url: baseUrl,
          timestamp: now - (7 * 24 * 60 * 60 * 1000), // 1 week ago
          scores: {
            overall: 68,
            performance: 65,
            accessibility: 82,
            seo: 74,
            fonts: 58
          },
          metrics: {
            lcp: 3200,
            cls: 0.22,
            fcp: 2100
          }
        }
      ];
      
    case 'decline':
      // Performance degradation
      return [
        {
          id: 'scan_current',
          url: baseUrl,
          timestamp: now,
          scores: {
            overall: 62,
            performance: 58,
            accessibility: 76,
            seo: 68,
            fonts: 54
          },
          metrics: {
            lcp: 3800,
            cls: 0.28,
            fcp: 2400
          }
        },
        {
          id: 'scan_previous',
          url: baseUrl,
          timestamp: now - (3 * 24 * 60 * 60 * 1000), // 3 days ago
          scores: {
            overall: 85,
            performance: 88,
            accessibility: 92,
            seo: 86,
            fonts: 82
          },
          metrics: {
            lcp: 2100,
            cls: 0.06,
            fcp: 1300
          }
        }
      ];
  }
}

function loadDemo(scenario, clickedButton) {
  console.log('T loadDemo called with scenario:', scenario);
  console.log('S window.timelineVisualizer exists?', typeof window.timelineVisualizer !== 'undefined');
  console.log('S timelineVisualizer exists?', typeof timelineVisualizer !== 'undefined');
  
  // Update active button
  document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  if (clickedButton) {
    clickedButton.classList.add('active');
  } else {
    // Activate the first button if no button clicked (initial load)
    const firstBtn = document.querySelector('.demo-btn');
    if (firstBtn) firstBtn.classList.add('active');
  }
  
  const container = document.getElementById('demoContainer');
  container.innerHTML = '';
  
  // Check if visualizer is available
  const visualizer = window.timelineVisualizer || timelineVisualizer;
  if (!visualizer) {
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #ff6b6b;">
        <h2>~ Error: Timeline Visualizer Not Found</h2>
        <p>Please check the browser console (F12) for errors.</p>
        <p>Make sure health-timeline.js and timeline-visualizer.js loaded correctly.</p>
      </div>
    `;
    return;
  }
  
  console.log('✓ Visualizer found, generating data...');
  
  // Generate sample data
  const history = generateSampleData(scenario);
  const current = history[0];
  const previous = history.length > 1 ? history[1] : null;
  
  // Create timeline container
  const timelineContainer = document.createElement('div');
  timelineContainer.className = 'health-timeline-container';
  
  // Add header
  const header = document.createElement('div');
  header.className = 'timeline-main-header';
  header.innerHTML = `
    <h2>U Health Timeline & History</h2>
    <p>Scenario: <strong>${scenario.charAt(0).toUpperCase() + scenario.slice(1)}</strong></p>
  `;
  timelineContainer.appendChild(header);
  
  // Show visualizations based on scenario
  if (scenario !== 'single' && previous) {
    // Comparison panel
    console.log('C Creating comparison panel...');
    const comparisonPanel = visualizer.createComparisonPanel(current, previous);
    timelineContainer.appendChild(comparisonPanel);
  }
  
  if (history.length > 2) {
    // Trend chart
    console.log('U Creating trend chart...');
    const trendChart = visualizer.createTrendChart(
      history,
      ['overall', 'performance', 'accessibility', 'seo']
    );
    timelineContainer.appendChild(trendChart);
  }
  
  if (previous) {
    // Radar chart
    console.log('T Creating radar chart...');
    const radarChart = visualizer.createRadarChart(current, previous);
    timelineContainer.appendChild(radarChart);
  }
  
  // Timeline overview
  console.log('🕒 Creating timeline overview...');
  const timelineOverview = visualizer.createTimelineOverview(history, 5);
  timelineContainer.appendChild(timelineOverview);
  
  // First scan message
  if (scenario === 'single') {
    const firstScanMessage = document.createElement('div');
    firstScanMessage.className = 'first-scan-message';
    firstScanMessage.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 12px; margin-top: 1rem;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">!</div>
        <h3 style="margin: 0 0 0.5rem 0; color: #00ff41;">First Scan Recorded!</h3>
        <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 0.875rem;">
          Run another scan in the future to track improvements and see trend charts
        </p>
      </div>
    `;
    timelineContainer.appendChild(firstScanMessage);
  }
  
  container.appendChild(timelineContainer);
  console.log('✓ Demo loaded successfully!');
}

// Load default demo on page load
window.addEventListener('DOMContentLoaded', () => {
  console.log('→ DOM loaded, initializing demo...');
  
  // Check if required objects are available
  if (typeof timelineVisualizer === 'undefined' && typeof window.timelineVisualizer === 'undefined') {
    console.error('✗ timelineVisualizer not loaded!');
    document.getElementById('demoContainer').innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #ff6b6b;">
        <h2>~ Error Loading Demo</h2>
        <p>Timeline visualizer not found. Please ensure all scripts are loaded.</p>
      </div>
    `;
    return;
  }
  
  console.log('✓ timelineVisualizer loaded');
  
  // Attach event listeners to buttons (CSP-compliant)
  document.querySelectorAll('.demo-btn').forEach(button => {
    button.addEventListener('click', function() {
      const scenario = this.getAttribute('data-scenario');
      loadDemo(scenario, this);
    });
  });
  
  // Load initial demo
  loadDemo('single');
});
