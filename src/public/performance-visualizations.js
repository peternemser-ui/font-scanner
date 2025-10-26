/**
 * Performance Analyzer Visualizations
 * Reusable visualization components for performance metrics
 */

/**
 * Create a Core Web Vitals gauge
 */
function createWebVitalGauge(metric, value, thresholds) {
  const { good, needsImprovement } = thresholds;
  let status = 'poor';
  let color = '#ff4444';
  
  if (value <= good) {
    status = 'good';
    color = '#00ff41';
  } else if (value <= needsImprovement) {
    status = 'needs-improvement';
    color = '#ffaa00';
  }
  
  return `
    <div class="web-vital-gauge" style="
      display: inline-block;
      text-align: center;
      margin: 1rem;
    ">
      <div style="
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.95) 100%);
        border: 3px solid ${color};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 20px ${color}40;
      ">
        <div style="
          font-size: 2rem;
          font-weight: bold;
          color: ${color};
          line-height: 1;
        ">${value}</div>
        <div style="
          font-size: 0.7rem;
          color: #808080;
          margin-top: 0.3rem;
          text-transform: uppercase;
        ">${metric}</div>
      </div>
      <div style="
        margin-top: 0.5rem;
        font-size: 0.9rem;
        color: ${color};
        text-transform: capitalize;
      ">${status.replace('-', ' ')}</div>
    </div>
  `;
}

/**
 * Create a resource waterfall chart (simplified version)
 */
function createResourceWaterfall(resources) {
  if (!resources || !resources.length) {
    return '<p style="color: #808080;">>>> no resource data available</p>';
  }
  
  return `
    <div class="resource-waterfall" style="
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(0,255,65,0.2);
      border-radius: 4px;
      padding: 1rem;
      margin: 1rem 0;
    ">
      <p style="color: #00ff41; margin-bottom: 1rem;">Resource Loading Timeline</p>
      <div style="color: #808080; font-size: 0.9rem;">
        Waterfall visualization coming soon...
      </div>
    </div>
  `;
}

/**
 * Create a performance timeline
 */
function createPerformanceTimeline(metrics) {
  return `
    <div class="performance-timeline" style="
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(0,255,65,0.2);
      border-radius: 4px;
      padding: 1rem;
      margin: 1rem 0;
    ">
      <p style="color: #00ff41; margin-bottom: 1rem;">Loading Timeline</p>
      <div style="color: #808080; font-size: 0.9rem;">
        Timeline visualization coming soon...
      </div>
    </div>
  `;
}

/**
 * Create a resource pie chart
 */
function createResourcePieChart(data) {
  return `
    <div class="resource-pie-chart" style="
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(0,255,65,0.2);
      border-radius: 4px;
      padding: 1rem;
      margin: 1rem 0;
      text-align: center;
    ">
      <p style="color: #00ff41; margin-bottom: 1rem;">Resource Distribution</p>
      <div style="color: #808080; font-size: 0.9rem;">
        Pie chart visualization coming soon...
      </div>
    </div>
  `;
}
