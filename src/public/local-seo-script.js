// Local SEO Analyzer Script
// Uses AnalyzerLoader for consistent loading UI

document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
});

// Analysis steps for the loader
const analysisSteps = [
  { label: 'Initializing analysis', detail: 'Connecting to target website...' },
  { label: 'Extracting NAP data', detail: 'Finding Name, Address, Phone information...' },
  { label: 'Checking structured data', detail: 'Scanning for LocalBusiness schema...' },
  { label: 'Analyzing local signals', detail: 'Checking maps, social profiles, hours...' },
  { label: 'Generating recommendations', detail: 'Compiling local SEO insights...' }
];

async function analyze() {
  const url = document.getElementById('url').value.trim();
  if (!url) { 
    alert('Please enter a URL'); 
    return; 
  }
  
  const results = document.getElementById('results');
  const btn = document.getElementById('analyzeBtn');
  
  results.style.display = 'none';
  btn.disabled = true;
  
  // Initialize AnalyzerLoader
  const loader = new AnalyzerLoader('loadingContainer');
  
  // Add ASCII art patience message
  const loaderMessageEl = document.createElement('div');
  loaderMessageEl.id = 'patience-message';
  loaderMessageEl.style.cssText = `
    margin: 0 0 1.5rem 0;
    padding: clamp(0.75rem, 2vw, 1rem);
    background: rgba(0, 255, 65, 0.05);
    border: 1px solid rgba(0, 255, 65, 0.3);
    border-radius: 6px;
    text-align: center;
    overflow: visible;
  `;
  loaderMessageEl.innerHTML = `
    <div style="overflow-x: auto; overflow-y: visible; -webkit-overflow-scrolling: touch;">
      <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: #00ff41; font-family: monospace; text-shadow: 2px 2px 0px rgba(0, 255, 65, 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
    </div>
    <p style="margin: 0.75rem 0 0 0; font-size: clamp(0.75rem, 2.5vw, 0.9rem); color: #00ff41; font-weight: 600; letter-spacing: 0.05em; padding: 0 0.5rem;">
      Local SEO analysis in progress...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(0, 255, 65, 0.7); padding: 0 0.5rem;">
      This may take 30-60 seconds for complex sites
    </p>
  `;

  // Add color cycling animation
  if (!document.getElementById('ascii-art-style')) {
    const style = document.createElement('style');
    style.id = 'ascii-art-style';
    style.textContent = `
      @keyframes color-cycle {
        0% { color: #00ff41; }
        20% { color: #00ffff; }
        40% { color: #0099ff; }
        60% { color: #9933ff; }
        80% { color: #ff33cc; }
        100% { color: #00ff41; }
      }
      .ascii-art-responsive {
        font-size: clamp(0.35rem, 1.2vw, 0.65rem);
        white-space: pre;
        max-width: 100%;
      }
    `;
    document.head.appendChild(style);
  }
  
  loader.start(analysisSteps, '[LOCAL SEO ANALYZER]', 20);
  
  // Insert patience message after loader content
  const loadingContainer = document.getElementById('loadingContainer');
  const analyzerLoading = loadingContainer.querySelector('.analyzer-loading');
  if (analyzerLoading) {
    analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
  }
  
  try {
    loader.nextStep(1);
    
    // Set up AbortController with 90 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    
    const response = await fetch('/api/local-seo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    loader.nextStep(2);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.message || errorData.error || 'Analysis failed - please try again';
      throw new Error(errorMsg);
    }
    
    const data = await response.json();
    
    loader.nextStep(3);
    loader.nextStep(4);
    loader.complete();
    
    displayResults(data);
    results.style.display = 'block';
    
  } catch (error) {
    const message = error.message || 'Unknown error occurred';
    if (message.includes('timeout') || message.includes('Timeout')) {
      alert('The website took too long to respond. Please try a different site or try again later.');
    } else {
      alert(`Error: ${message}`);
    }
    loader.complete();
  } finally {
    btn.disabled = false;
  }
}

function displayResults(data) {
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = '';
  
  // Store results globally for PDF generation
  window.currentLocalSEOResults = data;

  // 1. Overview Section with Score Circle
  const overviewSection = document.createElement('div');
  overviewSection.className = 'section';
  overviewSection.innerHTML = createOverviewSection(data);
  resultsContainer.appendChild(overviewSection);

  // 2. Quick Wins Section (if any)
  if (data.quickWins && data.quickWins.length > 0) {
    const quickWinsSection = document.createElement('div');
    quickWinsSection.className = 'section';
    quickWinsSection.innerHTML = createQuickWinsSection(data.quickWins);
    resultsContainer.appendChild(quickWinsSection);
  }

  // 3. Score Breakdown Cards
  const breakdownSection = document.createElement('div');
  breakdownSection.className = 'section';
  breakdownSection.innerHTML = createScoreBreakdownCards(data.scores);
  resultsContainer.appendChild(breakdownSection);

  // 4. Accordion Sections
  createAccordionSection(resultsContainer, 'nap-analysis', 'NAP Analysis (Name, Address, Phone)', 
    () => renderNAPContent(data.analysis), data.scores.nap);
  createAccordionSection(resultsContainer, 'schema-analysis', 'Structured Data & Schema', 
    () => renderSchemaContent(data.analysis.schema), data.scores.schema);
  createAccordionSection(resultsContainer, 'local-presence', 'Local Presence Signals', 
    () => renderLocalPresenceContent(data.analysis.localPresence), data.scores.presence);
  createAccordionSection(resultsContainer, 'recommendations', 'All Recommendations', 
    () => renderRecommendationsContent(data.recommendations), null);
}

function createOverviewSection(data) {
  const gradeColor = getGradeColor(data.grade);
  const nap = data.analysis.nap;
  const presence = data.analysis.localPresence;
  const score = data.overallScore;
  const circumference = 2 * Math.PI * 75; // 471.24
  const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;
  
  return `
    <h2>[LOCAL_SEO_OVERVIEW]</h2>
    
    <div style="
      background: linear-gradient(135deg, ${gradeColor}10 0%, ${gradeColor}05 100%);
      border: 2px solid ${gradeColor};
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
      box-shadow: 0 4px 20px ${gradeColor}20;
    ">
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 2rem; align-items: center;">
        <!-- Left: SVG Score Circle -->
        <div style="text-align: center;">
          <svg width="180" height="180" viewBox="0 0 180 180">
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
              stroke="${gradeColor}"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${strokeDasharray}"
              transform="rotate(-90 90 90)"
            />
            <text
              x="90"
              y="90"
              text-anchor="middle"
              dy="0.35em"
              font-size="3.5rem"
              font-weight="bold"
              fill="#f9fff2"
              stroke="rgba(0, 0, 0, 0.65)"
              stroke-width="2.5"
              paint-order="stroke fill"
              style="text-shadow: 0 0 18px ${gradeColor}, 0 0 30px rgba(0,0,0,0.6);"
            >
              ${score}
            </text>
          </svg>
          <div style="
            margin-top: 0.5rem;
            font-size: 1.3rem;
            font-weight: bold;
            color: ${gradeColor};
          ">${getGradeName(data.grade)}</div>
        </div>
        
        <!-- Right: Quick Stats -->
        <div>
          <h3 style="color: ${gradeColor}; margin: 0 0 1rem 0; font-size: 1.3rem;">>> Quick Stats</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Overall Grade</span>
              <span style="color: ${gradeColor}; font-weight: bold;">${data.grade}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Phone Numbers Found</span>
              <span style="color: ${nap.phoneCount > 0 ? '#00ff41' : '#ff4444'}; font-weight: bold;">${nap.phoneCount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Business Address</span>
              <span style="color: ${nap.hasAddress ? '#00ff41' : '#ff8c00'}; font-weight: bold;">${nap.hasAddress ? 'Detected' : 'Not Found'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">LocalBusiness Schema</span>
              <span style="color: ${data.analysis.schema.hasLocalBusinessSchema ? '#00ff41' : '#ff4444'}; font-weight: bold;">${data.analysis.schema.hasLocalBusinessSchema ? 'Present' : 'Missing'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
              <span style="color: #c0c0c0;">Google Maps Embed</span>
              <span style="color: ${presence.hasGoogleMap ? '#00ff41' : '#ff8c00'}; font-weight: bold;">${presence.hasGoogleMap ? 'Found' : 'Not Found'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createQuickWinsSection(quickWins) {
  return `
    <div style="
      background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 100%);
      border: 2px solid #ffd700;
      border-radius: 12px;
      padding: 1.5rem 2rem;
      margin: 1rem 0 2rem 0;
    ">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <span style="font-size: 1.75rem;">⚡</span>
        <h2 style="margin: 0; color: #ffd700; font-size: 1.4rem;">Quick Wins</h2>
        <span style="
          background: rgba(255, 215, 0, 0.2);
          color: #ffd700;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        ">High Impact • Low Effort</span>
      </div>
      <p style="color: #c0c0c0; margin: 0 0 1.5rem 0; font-size: 0.95rem;">
        These quick fixes can boost your local search visibility fast.
      </p>
      
      <div style="display: grid; gap: 1rem;">
        ${quickWins.map((win, index) => `
          <div style="
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 215, 0, 0.3);
            border-radius: 10px;
            padding: 1.25rem;
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 1rem;
            align-items: start;
          ">
            <!-- Icon -->
            <div style="
              width: 50px;
              height: 50px;
              background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
            ">
              <span style="font-size: 1.5rem;">${win.icon}</span>
            </div>
            
            <!-- Content -->
            <div>
              <h3 style="margin: 0 0 0.5rem 0; color: #fff; font-size: 1.1rem;">${win.title}</h3>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                <span style="
                  display: inline-flex;
                  align-items: center;
                  gap: 0.35rem;
                  color: #00ff41;
                  font-size: 0.85rem;
                  font-weight: 600;
                ">
                  <span>⏱</span> ${win.timeEstimate}
                </span>
                <span style="
                  display: inline-flex;
                  align-items: center;
                  gap: 0.35rem;
                  color: #00d9ff;
                  font-size: 0.85rem;
                  font-weight: 600;
                ">
                  <span>📈</span> ${win.impact}
                </span>
                <span style="
                  background: ${win.difficulty === 'Easy' ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255, 140, 0, 0.15)'};
                  color: ${win.difficulty === 'Easy' ? '#00ff41' : '#ff8c00'};
                  padding: 0.15rem 0.5rem;
                  border-radius: 4px;
                  font-size: 0.75rem;
                  font-weight: 600;
                ">${win.difficulty}</span>
              </div>
              
              <!-- Steps -->
              <div style="
                background: rgba(255, 255, 255, 0.03);
                border-radius: 6px;
                padding: 0.75rem 1rem;
              ">
                <div style="color: #808080; font-size: 0.75rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">How to fix:</div>
                <ol style="margin: 0; padding-left: 1.25rem; color: #b0b0b0; font-size: 0.85rem; line-height: 1.6;">
                  ${win.steps.map(step => `<li>${step}</li>`).join('')}
                </ol>
              </div>
            </div>
            
            <!-- Quick Win Number -->
            <div style="
              color: rgba(255, 215, 0, 0.4);
              font-size: 2rem;
              font-weight: 900;
              line-height: 1;
            ">#${index + 1}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function createScoreBreakdownCards(scores) {
  const categories = [
    { key: 'nap', label: 'NAP Info', description: 'Name, Address, Phone' },
    { key: 'schema', label: 'Schema', description: 'Structured Data' },
    { key: 'presence', label: 'Presence', description: 'Local Signals' }
  ];
  const circumference = 2 * Math.PI * 60; // 376.99

  return `
    <h2>[SCORE_BREAKDOWN]</h2>
    <p style="color: #c0c0c0; margin-bottom: 1rem;">>> Category performance breakdown</p>
    
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;">
      ${categories.map(cat => {
        const score = scores[cat.key] || 0;
        const color = getScoreColor(score);
        const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;
        return `
          <div style="
            background: linear-gradient(135deg, ${color}15 0%, ${color}05 100%);
            border: 2px solid ${color}80;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
          ">
            <svg width="120" height="120" viewBox="0 0 140 140" style="margin: 0 auto 0.75rem; display: block;">
              <circle
                cx="70"
                cy="70"
                r="60"
                fill="none"
                stroke="rgba(0, 0, 0, 0.1)"
                stroke-width="8"
              />
              <circle
                cx="70"
                cy="70"
                r="60"
                fill="none"
                stroke="${color}"
                stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="${strokeDasharray}"
                transform="rotate(-90 70 70)"
              />
              <text
                x="70"
                y="70"
                text-anchor="middle"
                dy="0.35em"
                font-size="2.5rem"
                font-weight="bold"
                fill="#f9fff2"
                stroke="rgba(0, 0, 0, 0.65)"
                stroke-width="2"
                paint-order="stroke fill"
                style="text-shadow: 0 0 12px ${color};"
              >
                ${score}
              </text>
            </svg>
            <div style="color: #ffffff; font-size: 1rem; font-weight: 600;">${cat.label}</div>
            <div style="color: #808080; font-size: 0.8rem; margin-top: 0.25rem;">${cat.description}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function createAccordionSection(container, id, title, contentCreator, score) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  accordion.style.cssText = 'margin: 0.5rem 0;';
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  header.innerHTML = `
    <span>${title}</span>
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      ${score !== null ? `<span style="color: ${getScoreColor(score)}; font-size: 0.9rem;">${score}/100</span>` : ''}
      <span class="accordion-toggle">▼</span>
    </span>
  `;
  
  const content = document.createElement('div');
  content.className = 'accordion-content';
  content.id = `accordion-${id}`;
  // Start collapsed - no height, no padding, no border, hidden overflow
  content.style.cssText = 'max-height: 0; padding: 0; overflow: hidden; border-top: none; transition: max-height 0.3s ease, padding 0.3s ease;';
  
  const contentInner = document.createElement('div');
  contentInner.className = 'accordion-content-inner';
  content.appendChild(contentInner);
  
  header.addEventListener('click', () => {
    const isExpanded = content.classList.contains('expanded');
    
    if (isExpanded) {
      content.classList.remove('expanded');
      header.classList.remove('active');
      header.querySelector('.accordion-toggle').textContent = '▼';
      content.style.maxHeight = '0';
      content.style.padding = '0';
      content.style.borderTop = 'none';
    } else {
      if (!contentInner.hasChildNodes()) {
        contentInner.innerHTML = contentCreator();
      }
      content.classList.add('expanded');
      header.classList.add('active');
      header.querySelector('.accordion-toggle').textContent = '▲';
      content.style.maxHeight = content.scrollHeight + 100 + 'px';
      content.style.padding = '1rem 1.25rem';
      content.style.borderTop = '1px solid #333';
    }
  });
  
  accordion.appendChild(header);
  accordion.appendChild(content);
  container.appendChild(accordion);
}

function renderNAPContent(analysis) {
  const nap = analysis.nap;
  
  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Contact Information Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        NAP (Name, Address, Phone) consistency is crucial for local SEO. Ensure this information matches across all platforms.
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 1.5rem;">
        <!-- Phone Numbers -->
        <div style="
          background: rgba(0, 255, 65, 0.05);
          border: 1px solid rgba(0, 255, 65, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
        ">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
            <span style="font-size: 1.5rem;">📞</span>
            <span style="color: #00ff41; font-weight: bold;">Phone Numbers</span>
          </div>
          <div style="font-size: 2rem; font-weight: 900; color: #ffffff; margin-bottom: 0.5rem;">${nap.phoneCount}</div>
          <div style="color: #808080; font-size: 0.85rem;">detected on page</div>
          ${nap.phones.length > 0 ? `
            <div style="margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${nap.phones.map(phone => `
                <span style="
                  background: rgba(0, 255, 65, 0.1);
                  color: #00ff41;
                  padding: 0.35rem 0.75rem;
                  border-radius: 4px;
                  font-size: 0.85rem;
                  font-family: monospace;
                ">${phone}</span>
              `).join('')}
            </div>
          ` : ''}
        </div>
        
        <!-- Address -->
        <div style="
          background: rgba(${nap.hasAddress ? '0, 255, 65' : '255, 140, 0'}, 0.05);
          border: 1px solid rgba(${nap.hasAddress ? '0, 255, 65' : '255, 140, 0'}, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
        ">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
            <span style="font-size: 1.5rem;">📍</span>
            <span style="color: ${nap.hasAddress ? '#00ff41' : '#ff8c00'}; font-weight: bold;">Business Address</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 900; color: ${nap.hasAddress ? '#00ff41' : '#ff8c00'}; margin-bottom: 0.5rem;">
            ${nap.hasAddress ? '✅ Detected' : '⚠️ Not Found'}
          </div>
          ${nap.zipCodes.length > 0 ? `
            <div style="margin-top: 0.5rem; color: #c0c0c0; font-size: 0.85rem;">
              ZIP Codes: ${nap.zipCodes.join(', ')}
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Email Addresses -->
      <div style="
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        padding: 1.25rem;
      ">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
          <span style="font-size: 1.2rem;">✉️</span>
          <span style="color: #c0c0c0; font-weight: bold;">Email Addresses</span>
        </div>
        ${nap.emails.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${nap.emails.map(email => `
              <span style="
                background: rgba(0, 217, 255, 0.1);
                color: #00d9ff;
                padding: 0.35rem 0.75rem;
                border-radius: 4px;
                font-size: 0.85rem;
              ">${email}</span>
            `).join('')}
          </div>
        ` : `
          <span style="color: #808080; font-size: 0.9rem;">No email addresses detected on page</span>
        `}
      </div>
    </div>
  `;
}

function renderSchemaContent(schema) {
  const items = [
    { label: 'LocalBusiness Schema', value: schema.hasLocalBusinessSchema, critical: true },
    { label: 'Organization Schema', value: schema.hasOrganizationSchema },
    { label: 'Contact Point', value: schema.hasContactPoint },
    { label: 'Geo Coordinates', value: schema.hasGeoCoordinates },
    { label: 'Opening Hours', value: schema.hasOpeningHours }
  ];

  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Structured Data Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        Schema markup helps search engines understand your business. LocalBusiness schema is essential for local pack results.
      </p>
      
      ${schema.businessName ? `
        <div style="
          background: rgba(0, 255, 65, 0.1);
          border: 1px solid rgba(0, 255, 65, 0.3);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
        ">
          <span style="color: #808080; font-size: 0.85rem;">Business Name in Schema:</span>
          <div style="color: #00ff41; font-size: 1.1rem; font-weight: bold; margin-top: 0.25rem;">${schema.businessName}</div>
        </div>
      ` : ''}
      
      <div style="display: grid; gap: 0.5rem;">
        ${items.map(item => `
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 6px;
            border-left: 3px solid ${item.value ? '#00ff41' : (item.critical ? '#ff4444' : '#ff8c00')};
          ">
            <span style="color: #c0c0c0;">${item.label}</span>
            <span style="
              color: ${item.value ? '#00ff41' : '#ff4444'};
              font-weight: bold;
              display: flex;
              align-items: center;
              gap: 0.35rem;
            ">
              ${item.value ? '✅ Present' : '❌ Missing'}
            </span>
          </div>
        `).join('')}
      </div>
      
      ${!schema.hasLocalBusinessSchema ? `
        <div style="
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(255, 68, 68, 0.1);
          border: 1px solid rgba(255, 68, 68, 0.3);
          border-radius: 8px;
        ">
          <div style="display: flex; align-items: center; gap: 0.5rem; color: #ff4444; font-weight: bold; margin-bottom: 0.5rem;">
            <span>⚠️</span> Critical: LocalBusiness Schema Missing
          </div>
          <p style="color: #c0c0c0; margin: 0; font-size: 0.9rem;">
            Without LocalBusiness schema, Google may not fully understand your business type and location, 
            reducing your chances of appearing in local pack results.
          </p>
        </div>
      ` : ''}
    </div>
  `;
}

function renderLocalPresenceContent(presence) {
  const signals = [
    { icon: '🗺️', label: 'Google Maps Embed', value: presence.hasGoogleMap, impact: 'High' },
    { icon: '⏰', label: 'Hours of Operation', value: presence.hasHoursInfo, impact: 'Medium' },
    { icon: '📞', label: 'Contact Page Link', value: presence.hasContactPage, impact: 'Medium' },
    { icon: '⭐', label: 'Reviews/Testimonials', value: presence.hasReviews, impact: 'High' }
  ];

  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Local Presence Signals</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        These signals help establish your local presence and build trust with potential customers.
      </p>
      
      <!-- Signal Cards -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        ${signals.map(signal => `
          <div style="
            background: rgba(${signal.value ? '0, 255, 65' : '255, 140, 0'}, 0.05);
            border: 1px solid rgba(${signal.value ? '0, 255, 65' : '255, 140, 0'}, 0.3);
            border-radius: 8px;
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 1rem;
          ">
            <span style="font-size: 1.5rem;">${signal.icon}</span>
            <div style="flex: 1;">
              <div style="color: #ffffff; font-weight: 600;">${signal.label}</div>
              <div style="color: ${signal.value ? '#00ff41' : '#ff8c00'}; font-size: 0.85rem;">
                ${signal.value ? '✅ Found' : '⚠️ Not Found'}
              </div>
            </div>
            <span style="
              background: rgba(${signal.impact === 'High' ? '255, 68, 68' : '255, 215, 0'}, 0.15);
              color: ${signal.impact === 'High' ? '#ff6b6b' : '#ffd700'};
              padding: 0.2rem 0.5rem;
              border-radius: 4px;
              font-size: 0.7rem;
              font-weight: 600;
            ">${signal.impact} Impact</span>
          </div>
        `).join('')}
      </div>
      
      <!-- Social Profiles -->
      <div style="
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        padding: 1.25rem;
      ">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
          <span style="font-size: 1.2rem;">📱</span>
          <span style="color: #c0c0c0; font-weight: bold;">Social Profiles Linked</span>
          <span style="
            background: rgba(0, 217, 255, 0.15);
            color: #00d9ff;
            padding: 0.15rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
          ">${presence.socialProfiles.length} found</span>
        </div>
        ${presence.socialProfiles.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${presence.socialProfiles.map(profile => `
              <span style="
                background: rgba(0, 217, 255, 0.1);
                color: #00d9ff;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-size: 0.9rem;
                text-transform: capitalize;
              ">${getSocialIcon(profile)} ${profile}</span>
            `).join('')}
          </div>
        ` : `
          <p style="color: #808080; margin: 0; font-size: 0.9rem;">
            No social media profile links detected. Consider adding links to your business profiles on 
            Facebook, Instagram, LinkedIn, or Yelp to improve local trust signals.
          </p>
        `}
      </div>
    </div>
  `;
}

function renderRecommendationsContent(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return `
      <div style="text-align: center; padding: 2rem; color: #00ff41;">
        <span style="font-size: 3rem;">🎉</span>
        <h3 style="margin: 1rem 0 0.5rem;">Excellent Local SEO!</h3>
        <p style="color: #c0c0c0;">No critical recommendations at this time.</p>
      </div>
    `;
  }

  const grouped = {
    critical: recommendations.filter(r => r.priority === 'critical'),
    high: recommendations.filter(r => r.priority === 'high'),
    medium: recommendations.filter(r => r.priority === 'medium')
  };

  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> All Recommendations</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        Address these issues to improve your local search visibility.
      </p>
      
      ${grouped.critical.length > 0 ? `
        <h4 style="color: #ff4444; margin: 1rem 0 0.5rem; font-size: 0.9rem;">🔴 Critical Issues</h4>
        ${grouped.critical.map(rec => renderRecommendation(rec, '#ff4444')).join('')}
      ` : ''}
      
      ${grouped.high.length > 0 ? `
        <h4 style="color: #ff8c00; margin: 1rem 0 0.5rem; font-size: 0.9rem;">🟠 High Priority</h4>
        ${grouped.high.map(rec => renderRecommendation(rec, '#ff8c00')).join('')}
      ` : ''}
      
      ${grouped.medium.length > 0 ? `
        <h4 style="color: #ffd700; margin: 1rem 0 0.5rem; font-size: 0.9rem;">🟡 Medium Priority</h4>
        ${grouped.medium.map(rec => renderRecommendation(rec, '#ffd700')).join('')}
      ` : ''}
    </div>
  `;
}

function renderRecommendation(rec, color) {
  return `
    <div class="recommendation-card" style="
      padding: 1rem 1rem 1rem 1.25rem;
      margin: 0.5rem 0;
      background: ${color}10;
      border-left: 4px solid ${color};
      border-radius: 4px;
    ">
      <h4 style="margin: 0 0 0.5rem 0; color: #ffffff;">${rec.message}</h4>
      <p style="margin: 0; color: #c0c0c0; font-size: 0.9rem;">${rec.detail}</p>
    </div>
  `;
}

// Helper functions
function getGradeColor(grade) {
  const colors = {
    'A': '#00ff41',
    'B': '#ffd700',
    'C': '#ff8c00',
    'D': '#ff4444',
    'F': '#ff0000'
  };
  return colors[grade] || '#888888';
}

function getGradeName(grade) {
  const names = {
    'A': 'Excellent',
    'B': 'Good',
    'C': 'Fair',
    'D': 'Poor',
    'F': 'Critical'
  };
  return names[grade] || 'Unknown';
}

function getScoreColor(score) {
  if (score >= 80) return '#00ff41';
  if (score >= 60) return '#ffd700';
  if (score >= 40) return '#ff8c00';
  return '#ff4444';
}

function getSocialIcon(platform) {
  const icons = {
    'facebook': '📘',
    'twitter': '🐦',
    'x': '🐦',
    'instagram': '📸',
    'linkedin': '💼',
    'youtube': '📺',
    'yelp': '⭐',
    'tiktok': '🎵'
  };
  return icons[platform] || '🔗';
}
