/**
 * SEO Visualizations
 * Pure CSS/JS data visualizations for SEO analysis results
 * No external libraries required - maintains terminal aesthetic
 */

/**
 * Create a terminal-style data table
 * @param {Array} headers - Table column headers
 * @param {Array} rows - Array of row data arrays
 * @param {Object} options - Table options (sortable, maxRows, etc.)
 */
function createDataTable(headers, rows, options = {}) {
  const { sortable = false, maxRows = 10, striped = true, compact = false } = options;
  
  if (!rows || rows.length === 0) {
    return '<p style="color: #808080;">>>> no data available</p>';
  }

  const displayRows = rows.slice(0, maxRows);
  const hasMore = rows.length > maxRows;

  return `
    <div class="seo-table-container" style="overflow-x: auto; margin: 1rem 0;">
      <table class="seo-table" style="
        width: 100%;
        border-collapse: collapse;
        font-family: 'Courier New', monospace;
        font-size: ${compact ? '0.85rem' : '0.9rem'};
      ">
        <thead>
          <tr style="border-bottom: 2px solid rgba(0,255,65,0.5);">
            ${headers.map((header, idx) => `
              <th style="
                text-align: left;
                padding: 0.75rem;
                color: #00ff41;
                font-weight: bold;
                background: rgba(0,255,65,0.08);
                ${sortable ? 'cursor: pointer;' : ''}
              " ${sortable ? `data-column="${idx}"` : ''}>
                ${header} ${sortable ? '⇅' : ''}
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${displayRows.map((row, rowIdx) => `
            <tr style="
              border-bottom: 1px solid rgba(0,255,65,0.15);
              ${striped && rowIdx % 2 === 1 ? 'background: rgba(0,255,65,0.05);' : ''}
            ">
              ${row.map(cell => `
                <td style="padding: 0.5rem 0.75rem; color: #e0e0e0;">
                  ${cell}
                </td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${hasMore ? `
        <p style="color: #808080; font-size: 0.85rem; margin-top: 0.5rem; text-align: center;">
          >>> showing ${displayRows.length} of ${rows.length} rows
        </p>
      ` : ''}
    </div>
  `;
}

/**
 * Create a horizontal progress bar
 * @param {number} value - Progress value (0-100)
 * @param {string} label - Progress label
 * @param {Object} options - Bar options
 */
function createProgressBar(value, label, options = {}) {
  const { 
    showValue = true, 
    height = 50,
    animated = true,
    threshold = { good: 80, warning: 60 }
  } = options;

  // Traffic light color scheme: A=green, B=yellow, C=orange, D/F=red
  let color;
  if (value >= 90) {
    color = '#00ff41'; // A - Green
  } else if (value >= 70) {
    color = '#ffd700'; // B - Yellow
  } else if (value >= 50) {
    color = '#ff8c00'; // C - Orange
  } else {
    color = '#ff4444'; // D/F - Red
  }

  return `
    <div class="seo-progress-container" style="margin: 1.5rem 0; padding: 0.5rem;">
      ${label ? `
      <div style="
        display: flex; 
        justify-content: space-between; 
        align-items: center;
        margin-bottom: 0.75rem; 
        padding: 0.5rem;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
      ">
        <span style="
          color: #ffffff; 
          font-weight: 600;
          font-size: 1.1rem;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        ">${label}</span>
        ${showValue ? `
        <span style="
          color: ${color}; 
          font-weight: bold; 
          font-size: 1.3rem;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 0 10px ${color}80;
          padding: 0.25rem 0.75rem;
          background: rgba(0,0,0,0.3);
          border-radius: 6px;
        ">${Math.round(value)}%</span>
        ` : ''}
      </div>
      ` : ''}
      <div style="
        width: 100%;
        height: ${height}px;
        background: #1a1a1a;
        border: 2px solid #404040;
        border-radius: 10px;
        overflow: hidden;
        position: relative;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
      ">
        <div style="
          width: ${Math.max(5, value)}%;
          height: 100%;
          background: linear-gradient(180deg, ${color} 0%, ${color}dd 100%);
          ${animated ? 'transition: width 1s ease-out;' : ''}
          position: relative;
          border-radius: 8px;
          box-shadow: 0 0 20px ${color}80;
        ">
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, 
              transparent 0%, 
              rgba(255,255,255,0.4) 50%, 
              transparent 100%);
            ${animated ? 'animation: shimmer 2s infinite;' : ''}
          "></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Create a radial progress indicator (circular)
 * @param {number} value - Progress value (0-100)
 * @param {string} label - Center label
 * @param {Object} options - Circle options
 */
function createRadialProgress(value, label, options = {}) {
  const { size = 120, strokeWidth = 8, showValue = true } = options;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  
  const color = value >= 80 ? '#00ff41' : 
                value >= 60 ? '#ffaa00' : '#ff4444';

  return `
    <div class="radial-progress" style="
      display: inline-block;
      margin: 1rem;
      text-align: center;
    ">
      <svg width="${size}" height="${size}" style="transform: rotate(-90deg);">
        <circle
          cx="${size/2}"
          cy="${size/2}"
          r="${radius}"
          stroke="rgba(0,255,65,0.1)"
          stroke-width="${strokeWidth}"
          fill="none"
        />
        <circle
          cx="${size/2}"
          cy="${size/2}"
          r="${radius}"
          stroke="${color}"
          stroke-width="${strokeWidth}"
          fill="none"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
          stroke-linecap="round"
          style="transition: stroke-dashoffset 0.8s ease-out;"
        />
        <text
          x="${size/2}"
          y="${size/2}"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="${color}"
          font-size="${size/5}px"
          font-weight="bold"
          font-family="'Courier New', monospace"
          transform="rotate(90 ${size/2} ${size/2})"
        >
          ${showValue ? value : ''}
        </text>
      </svg>
      ${label ? `<div style="color: #808080; font-size: 0.85rem; margin-top: 0.25rem;">${label}</div>` : ''}
    </div>
  `;
}

/**
 * Create a bar chart
 * @param {Object} data - Data object with labels and values
 * @param {Object} options - Chart options
 */
function createBarChart(data, options = {}) {
  const {
    height = 200,
    showValues = true,
    horizontal = false,
    animated = true,
    colorScheme = 'gradient' // 'gradient', 'score', 'mono'
  } = options;

  const entries = Object.entries(data);
  const maxValue = Math.max(...entries.map(([_, v]) => v));
  
  const getBarColor = (value, index) => {
    if (colorScheme === 'score') {
      // Traffic light color scheme
      if (value >= 90) return '#00ff41'; // A - Green
      if (value >= 70) return '#ffd700'; // B - Yellow
      if (value >= 50) return '#ff8c00'; // C - Orange
      return '#ff4444'; // D/F - Red
    } else if (colorScheme === 'gradient') {
      // Gradient from green to yellow based on index
      const ratio = index / Math.max(1, entries.length - 1);
      const hue = 120 - (ratio * 60); // 120 (green) to 60 (yellow)
      return `hsl(${hue}, 100%, 50%)`;
    }
    return '#00ff41';
  };

  if (horizontal) {
    return `
      <div class="bar-chart horizontal" style="margin: 1rem 0;">
        ${entries.map(([label, value], idx) => {
          const percentage = Math.max(2, (value / maxValue) * 100);
          const barColor = getBarColor(value, idx);
          return `
            <div style="margin: 1rem 0;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="color: #c0c0c0; font-size: 0.9rem; font-weight: 500;">${label}</span>
                ${showValues ? `<span style="color: ${barColor}; font-weight: bold;">${value}</span>` : ''}
              </div>
              <div style="
                width: 100%;
                height: 28px;
                background: rgba(128, 128, 128, 0.1);
                border: 1px solid rgba(128, 128, 128, 0.3);
                border-radius: 6px;
                overflow: hidden;
              ">
                <div style="
                  width: ${percentage}%;
                  height: 100%;
                  background: ${barColor};
                  ${animated ? 'transition: width 0.8s ease-out;' : ''}
                  border-radius: 4px;
                  box-shadow: 0 0 10px ${barColor}40;
                "></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Vertical bar chart
  return `
    <div class="bar-chart vertical" style="
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      height: ${height}px;
      margin: 1rem 0;
      padding: 1rem;
      background: rgba(128, 128, 128, 0.05);
      border: 1px solid rgba(128, 128, 128, 0.2);
      border-radius: 8px;
    ">
      ${entries.map(([label, value], idx) => {
        const barHeight = Math.max(20, (value / maxValue) * (height - 60));
        const barColor = getBarColor(value, idx);
        return `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            flex: 1;
            max-width: 100px;
          ">
            ${showValues ? `
              <div style="
                color: ${barColor};
                font-weight: bold;
                font-size: 0.95rem;
                margin-bottom: 0.5rem;
              ">${value}</div>
            ` : ''}
            <div style="
              width: 70%;
              height: ${barHeight}px;
              background: ${barColor};
              border-radius: 6px 6px 0 0;
              ${animated ? 'transition: height 0.8s ease-out;' : ''}
              box-shadow: 0 0 10px ${barColor}40;
            "></div>
            <div style="
              color: #c0c0c0;
              font-size: 0.8rem;
              margin-top: 0.5rem;
              text-align: center;
              word-break: break-word;
              font-weight: 500;
            ">${label}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Create a comparison diagram (before/after, good/bad)
 * @param {Object} comparison - Comparison data
 */
function createComparisonDiagram(comparison) {
  const { before, after, label = 'Comparison' } = comparison;
  
  return `
    <div class="comparison-diagram" style="
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin: 1rem 0;
      padding: 1rem;
      background: rgba(0,255,65,0.03);
      border: 1px solid rgba(0,255,65,0.2);
      border-radius: 8px;
    ">
      <div style="text-align: center;">
        <div style="color: #ff4444; font-weight: bold; margin-bottom: 0.5rem;">❌ CURRENT</div>
        <div style="
          padding: 1rem;
          background: rgba(255,68,68,0.1);
          border: 1px solid rgba(255,68,68,0.3);
          border-radius: 4px;
          font-family: monospace;
        ">
          ${before}
        </div>
      </div>
      <div style="text-align: center;">
        <div style="color: #00ff41; font-weight: bold; margin-bottom: 0.5rem;">✅ RECOMMENDED</div>
        <div style="
          padding: 1rem;
          background: rgba(0,255,65,0.1);
          border: 1px solid rgba(0,255,65,0.3);
          border-radius: 4px;
          font-family: monospace;
        ">
          ${after}
        </div>
      </div>
    </div>
  `;
}

/**
 * Create a heatmap for SEO health metrics
 * @param {Object} metrics - Metrics object
 */
function createHeatmap(metrics) {
  const entries = Object.entries(metrics);
  
  return `
    <div class="heatmap" style="
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin: 1rem 0;
      width: 100%;
    ">
      ${entries.map(([key, value]) => {
        // Traffic light color scheme: A=green, B=yellow, C=orange, D/F=red
        let bgColor, borderColor, textColor;
        if (value >= 90) {
          bgColor = 'rgba(0, 255, 65, 0.1)';
          borderColor = '#00ff41';
          textColor = '#00ff41';
        } else if (value >= 70) {
          bgColor = 'rgba(255, 215, 0, 0.1)';
          borderColor = '#ffd700';
          textColor = '#ffd700';
        } else if (value >= 50) {
          bgColor = 'rgba(255, 140, 0, 0.1)';
          borderColor = '#ff8c00';
          textColor = '#ff8c00';
        } else {
          bgColor = 'rgba(255, 68, 68, 0.1)';
          borderColor = '#ff4444';
          textColor = '#ff4444';
        }
        
        return `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: ${bgColor};
            border: 2px solid ${borderColor};
            border-radius: 12px;
            padding: 1.5rem 1rem;
            transition: all 0.3s ease;
            min-height: 120px;
            cursor: pointer;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 6px 20px ${borderColor}50';" 
             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            <div style="font-weight: bold; font-size: 2.5rem; color: ${textColor}; margin-bottom: 0.5rem; text-shadow: 0 2px 4px ${borderColor}60;">${value}</div>
            <div style="font-size: 0.85rem; color: #e0e0e0; text-align: center; line-height: 1.3; font-weight: 600;">${key}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Create a network diagram for link structure
 * @param {Object} linkData - Link analysis data
 */
function createLinkDiagram(linkData) {
  const { internal = 0, external = 0, nofollow = 0, broken = 0 } = linkData;
  const total = internal + external;
  const internalPercent = total > 0 ? Math.round((internal / total) * 100) : 0;
  const externalPercent = total > 0 ? Math.round((external / total) * 100) : 0;
  
  return `
    <div class="link-diagram" style="
      margin: 1rem 0;
    ">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
        <!-- Internal Links -->
        <div style="
          padding: 1.5rem;
          background: rgba(0, 150, 255, 0.1);
          border: 2px solid rgba(0, 150, 255, 0.4);
          border-radius: 12px;
          text-align: center;
          transition: all 0.3s ease;
          cursor: pointer;
        " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 6px 20px rgba(0,150,255,0.3)';" 
           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
          <div style="font-size: 2.5rem; color: #0096ff; font-weight: bold; margin-bottom: 0.5rem; text-shadow: 0 2px 4px rgba(0,150,255,0.4);">${internal}</div>
          <div style="font-size: 1rem; color: #e0e0e0; font-weight: 600; margin-bottom: 0.25rem;">Internal Links</div>
          <div style="font-size: 0.85rem; color: #909090;">${internalPercent}% of total</div>
        </div>
        
        <!-- External Links -->
        <div style="
          padding: 1.5rem;
          background: rgba(150, 0, 255, 0.1);
          border: 2px solid rgba(150, 0, 255, 0.4);
          border-radius: 12px;
          text-align: center;
          transition: all 0.3s ease;
          cursor: pointer;
        " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 6px 20px rgba(150,0,255,0.3)';" 
           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
          <div style="font-size: 2.5rem; color: #9600ff; font-weight: bold; margin-bottom: 0.5rem; text-shadow: 0 2px 4px rgba(150,0,255,0.4);">${external}</div>
          <div style="font-size: 1rem; color: #e0e0e0; font-weight: 600; margin-bottom: 0.25rem;">External Links</div>
          <div style="font-size: 0.85rem; color: #909090;">${externalPercent}% of total</div>
        </div>
        
        <!-- Broken Links (Warning) -->
        <div style="
          padding: 1.5rem;
          background: ${broken > 0 ? 'rgba(255, 68, 68, 0.1)' : 'rgba(0, 255, 65, 0.1)'};
          border: 2px solid ${broken > 0 ? 'rgba(255, 68, 68, 0.4)' : 'rgba(0, 255, 65, 0.4)'};
          border-radius: 12px;
          text-align: center;
          transition: all 0.3s ease;
          cursor: pointer;
        " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 6px 20px ${broken > 0 ? 'rgba(255,68,68,0.3)' : 'rgba(0,255,65,0.3)'}'; " 
           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
          <div style="font-size: 2.5rem; color: ${broken > 0 ? '#ff4444' : '#00ff41'}; font-weight: bold; margin-bottom: 0.5rem; text-shadow: 0 2px 4px ${broken > 0 ? 'rgba(255,68,68,0.4)' : 'rgba(0,255,65,0.4)'};">${broken}</div>
          <div style="font-size: 1rem; color: #e0e0e0; font-weight: 600; margin-bottom: 0.25rem;">Broken Links</div>
          <div style="font-size: 0.85rem; color: #909090;">${broken > 0 ? '⚠️ Needs attention' : '✅ All working'}</div>
        </div>
      </div>
      
      ${nofollow > 0 ? `
      <div style="
        margin-top: 1rem;
        padding: 1rem;
        background: rgba(255, 170, 0, 0.1);
        border: 1px solid rgba(255, 170, 0, 0.3);
        border-radius: 8px;
        text-align: center;
      ">
        <span style="color: #ffaa00; font-weight: 600;">ℹ️ ${nofollow} No-Follow Links</span>
        <span style="color: #909090; margin-left: 0.5rem;">These links don't pass SEO value</span>
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Create a score gauge (speedometer style)
 * @param {number} score - Score value (0-100)
 * @param {string} label - Gauge label
 */
function createScoreGauge(score, label) {
  const rotation = (score / 100) * 180 - 90; // -90 to 90 degrees
  const color = score >= 80 ? '#00ff41' : 
                score >= 60 ? '#ffaa00' : '#ff4444';
  
  return `
    <div class="score-gauge" style="
      display: inline-block;
      margin: 1rem;
      text-align: center;
    ">
      <div style="position: relative; width: 150px; height: 90px; overflow: hidden;">
        <!-- Background arc -->
        <svg width="150" height="90" style="position: absolute;">
          <path
            d="M 10,85 A 65,65 0 0,1 140,85"
            stroke="rgba(255,68,68,0.3)"
            stroke-width="12"
            fill="none"
          />
          <path
            d="M 10,85 A 65,65 0 0,1 75,20"
            stroke="rgba(255,170,0,0.3)"
            stroke-width="12"
            fill="none"
          />
          <path
            d="M 75,20 A 65,65 0 0,1 140,85"
            stroke="rgba(0,255,65,0.3)"
            stroke-width="12"
            fill="none"
          />
        </svg>
        
        <!-- Needle -->
        <div style="
          position: absolute;
          bottom: 5px;
          left: 50%;
          width: 4px;
          height: 60px;
          background: ${color};
          transform-origin: bottom center;
          transform: translateX(-50%) rotate(${rotation}deg);
          transition: transform 1s ease-out;
          border-radius: 2px;
          box-shadow: 0 0 8px ${color};
        "></div>
        
        <!-- Center dot -->
        <div style="
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 12px;
          height: 12px;
          background: ${color};
          border-radius: 50%;
          border: 2px solid rgba(0,0,0,0.8);
        "></div>
      </div>
      
      <div style="margin-top: 0.5rem;">
        <div style="font-size: 1.5rem; font-weight: bold; color: ${color};">${score}</div>
        <div style="font-size: 0.85rem; color: #808080;">${label}</div>
      </div>
    </div>
  `;
}

// Add CSS animation for shimmer effect
if (!document.getElementById('seo-viz-styles')) {
  const style = document.createElement('style');
  style.id = 'seo-viz-styles';
  style.textContent = `
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    
    .seo-table tbody tr:hover {
      background: rgba(0,255,65,0.08) !important;
    }
    
    .seo-table th:hover {
      color: #00ff41 !important;
      text-shadow: 0 0 8px rgba(0,255,65,0.5);
    }
  `;
  document.head.appendChild(style);
}
