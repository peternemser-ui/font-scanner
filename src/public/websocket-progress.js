// WebSocket Progress Enhancement for Font Scanner
// This file contains methods to add to FontScannerApp class for real-time progress

// Method 1: Update performComprehensiveScan (replace existing method)
async performComprehensiveScan(normalizedUrl) {
  this.setLoading(true);
  
  // Generate unique scan ID
  this.scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Join Socket.IO room for this scan
  this.socket.emit('join-scan', this.scanId);
  
  // Show progress UI
  this.showProgressUI();
  
  // Clear previous font preview styles
  this.clearFontPreviewStyles();

  try {
    const controller = new AbortController();
    const timeoutDuration = 600000; // 10 minutes for comprehensive scan
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    console.log('🚀 Sending request to /api/scan/best-in-class...');
    const response = await fetch('/api/scan/best-in-class', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url: normalizedUrl,
        scanId: this.scanId,
        includePerformance: true,
        includeBestPractices: true,
        includeFontPairing: true,
        includeRealUserMetrics: true,
        includeCrossBrowserTesting: true,
        includeAdvancedAccessibility: true,
        includeFontLicensing: true,
        includeBenchmarking: true,
        includeLighthouse: true
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('🚀 Best-in-class response received:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`🎉 Comprehensive scan completed with grade: ${data.data.grade}`);
    
    if (data.success) {
      this.hideProgressUI();
      this.displayComprehensiveResults(data.data);
    } else {
      this.showError(data.error || 'Comprehensive scan failed');
    }
  } catch (error) {
    console.error('❌ Comprehensive scan error:', error);
    this.hideProgressUI();
    if (error.name === 'AbortError') {
      this.showError('Comprehensive scan timed out. Please try again.');
    } else {
      this.showError(`Comprehensive scan failed: ${error.message}`);
    }
  } finally {
    this.setLoading(false);
  }
}

// Method 2: Show progress UI
showProgressUI() {
  // Create progress container if it doesn't exist
  let progressContainer = document.getElementById('progressContainer');
  if (!progressContainer) {
    progressContainer = document.createElement('div');
    progressContainer.id = 'progressContainer';
    progressContainer.className = 'progress-container';
    progressContainer.innerHTML = `
      <h2 style="margin-bottom: 20px;">🚀 Comprehensive Analysis in Progress</h2>
      <div id="timeEstimate" style="margin-bottom: 20px; color: #666;">Initializing...</div>
      <div class="progress-steps">
        ${this.generateProgressSteps()}
      </div>
    `;
    
    // Insert before results
    const results = document.getElementById('results');
    results.parentNode.insertBefore(progressContainer, results);
  }
  
  progressContainer.style.display = 'block';
}

// Method 3: Hide progress UI
hideProgressUI() {
  const progressContainer = document.getElementById('progressContainer');
  if (progressContainer) {
    progressContainer.style.display = 'none';
  }
}

// Method 4: Generate progress steps HTML
generateProgressSteps() {
  const steps = [
    { id: 1, name: 'Basic Font Scan', icon: '🔍' },
    { id: 2, name: 'Performance Analysis', icon: '⚡' },
    { id: 3, name: 'Best Practices', icon: '✅' },
    { id: 4, name: 'AI Font Pairing', icon: '🎨' },
    { id: 5, name: 'Real User Metrics', icon: '📊' },
    { id: 6, name: 'Cross-Browser Testing', icon: '🌍' },
    { id: 7, name: 'Accessibility Analysis', icon: '♿' },
    { id: 8, name: 'Font Licensing', icon: '⚖️' },
    { id: 9, name: 'Industry Benchmarking', icon: '🏆' },
    { id: 10, name: 'Lighthouse Analysis', icon: '🏠' }
  ];
  
  return steps.map(step => `
    <div class="progress-step" id="step-${step.id}">
      <div class="step-header">
        <span class="status-icon pending">⏸️</span>
        <span class="step-name">${step.icon} Step ${step.id}/10: ${step.name}</span>
        <span class="status-text">Pending</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: 0%"></div>
      </div>
    </div>
  `).join('');
}

// Instructions for integration:
// 1. Add Socket.IO initialization to constructor (already done in script.js)
// 2. Replace the existing performComprehensiveScan method with the one above
// 3. Add the three helper methods (showProgressUI, hideProgressUI, generateProgressSteps)
// 4. Ensure handleProgressUpdate is working (already added)
// 5. Add CSS styles for the progress UI (next step)
