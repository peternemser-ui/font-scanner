class FontScannerApp {
  constructor() {
    this.initializeElements();
    this.bindEvents();
  }

  initializeElements() {
    this.urlInput = document.getElementById('urlInput');
    this.scanButton = document.getElementById('scanButton');
    this.errorMessage = document.getElementById('errorMessage');
    this.resultsSection = document.getElementById('resultsSection');
    this.loadingSpinner = this.scanButton.querySelector('.loading-spinner');
    this.buttonText = this.scanButton.querySelector('.button-text');
    this.scanDescription = document.getElementById('scanDescription');
    this.downloadButton = document.getElementById('downloadButton');
  }

  bindEvents() {
    this.scanButton.addEventListener('click', () => this.handleScan());
    this.urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleScan();
      }
    });

    // Tab switching
    document.querySelectorAll('.tab-button').forEach((button) => {
      button.addEventListener('click', () => this.switchTab(button.dataset.tab));
    });

    // Download and print buttons for final report
    const downloadBtn = document.getElementById('downloadReportBtn');
    const printBtn = document.getElementById('printReportBtn');

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadReport());
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => this.printReport());
    }
  }

  updateScanDescription(scanType) {
    const descriptions = {
      basic: 'Quick analysis of fonts and basic performance metrics',
      comprehensive:
        'Deep analysis with Lighthouse, multi-page scanning, desktop/mobile comparison, and PDF report generation',
    };
    this.scanDescription.textContent = descriptions[scanType] || descriptions['basic'];
  }

  async handleScan() {
    const url = this.urlInput.value.trim();
    const scanType = 'comprehensive'; // Always use comprehensive scanning

    console.log('🔍 Starting scan...', { url, scanType });

    if (!url) {
      this.showError('Please enter a URL to scan');
      return;
    }

    if (!this.isValidUrl(url)) {
      this.showError('Please enter a valid HTTP or HTTPS URL');
      return;
    }

    this.hideError();
    this.setLoading(true);
    this.hideResults();

    try {
      const controller = new AbortController();
      const timeoutDuration = 300000; // 5 minutes for comprehensive analysis
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

      console.log('📡 Sending request to /api/scan...');
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, scanType }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('📡 Response received:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Server error response:', errorData);
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Scan data received:', data);
      console.log('📊 Results structure:', {
        hasResults: !!data.results,
        resultsKeys: data.results ? Object.keys(data.results) : 'No results',
        dataKeys: Object.keys(data),
      });

      this.displayResults(data);
    } catch (error) {
      console.error('❌ Scan error:', error);

      let errorMessage;
      if (error.name === 'AbortError') {
        errorMessage = `Scan timed out. ${scanType === 'comprehensive' ? 'Comprehensive scans' : 'Scans'} may take longer for complex websites.`;
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else {
        errorMessage = error.message || 'An error occurred while scanning the website';
      }

      this.showError(errorMessage);
    } finally {
      this.setLoading(false);
    }
  }

  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  setLoading(isLoading) {
    this.scanButton.disabled = isLoading;
    this.loadingSpinner.hidden = !isLoading;

    if (isLoading) {
      this.buttonText.textContent = 'Analyzing Website...';
    } else {
      this.buttonText.textContent = 'Analyze Website';
    }
  }

  showError(message) {
    console.log('🚨 Showing error:', message);
    this.errorMessage.textContent = message;
    this.errorMessage.hidden = false;
  }

  hideError() {
    this.errorMessage.hidden = true;
  }

  hideResults() {
    this.resultsSection.hidden = true;
  }

  displayResults(data) {
    console.log('🎨 displayResults called with:', data);

    if (!data || !data.results) {
      console.error('❌ Invalid data format - no results found:', data);
      this.showError('Invalid response format from server');
      return;
    }

    const { results, url, scannedAt } = data;

    // Update header info
    document.getElementById('scannedUrl').textContent = url;
    document.getElementById('scanTime').textContent = new Date(scannedAt).toLocaleString();

    // Update overall score - use lighthouse or best practices score
    let overallScore = 0;
    if (results.lighthouse?.desktop?.performance) {
      overallScore = Math.round(results.lighthouse.desktop.performance);
    } else if (results.bestPractices?.score) {
      overallScore = results.bestPractices.score;
    }
    this.updateOverallScore(overallScore);

    // Update overview with actual data
    this.updateOverview(results);

    // Show results
    this.resultsSection.hidden = false;
    this.resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  updateOverallScore(score) {
    const scoreElement = document.getElementById('overallScore');
    const gradeElement = document.getElementById('overallGrade');
    const scoreCircle = document.querySelector('.score-circle');

    scoreElement.textContent = score;
    gradeElement.textContent = this.getGrade(score);

    // Update progress circle
    scoreCircle.style.setProperty('--score-percentage', `${score}%`);

    // Update color based on score
    if (score >= 80) {
      scoreCircle.style.setProperty('--score-color', 'var(--success-color)');
    } else if (score >= 60) {
      scoreCircle.style.setProperty('--score-color', 'var(--warning-color)');
    } else {
      scoreCircle.style.setProperty('--score-color', 'var(--error-color)');
    }
  }

  updateOverview(results) {
    // Calculate total fonts from the fonts object structure
    const totalFonts = results.fonts?.totalFonts || results.fonts?.fonts?.length || 0;
    document.getElementById('totalFonts').textContent = totalFonts;

    // Get load time from performance or summary
    const loadTime = results.performance?.loadTime || results.summary?.performance?.loadTime || 0;
    document.getElementById('loadTime').textContent = `${loadTime}ms`;

    // Get best practices score
    const practicesScore =
      results.bestPractices?.score || results.summary?.bestPractices?.score || 0;
    document.getElementById('practicesScore').textContent = `${practicesScore}%`;

    // Update scan type to show Comprehensive
    const analysisTypeElement = document.querySelector('.analysis-type .metric-value');
    if (analysisTypeElement) {
      analysisTypeElement.textContent = 'Comprehensive';
    }

    // Update pages analyzed count
    const pagesAnalyzedElement = document.querySelector('.pages-analyzed .metric-value');
    if (pagesAnalyzedElement) {
      const pagesCount = results.pages?.length || 1;
      pagesAnalyzedElement.textContent = pagesCount;
    }

    // Update screenshot if available
    if (results.screenshot) {
      const screenshot = document.getElementById('pageScreenshot');
      screenshot.src = results.screenshot;
      screenshot.style.display = 'block';
    }
  }

  switchTab(tabName) {
    // Remove active class from all tabs and panels
    document.querySelectorAll('.tab-button').forEach((tab) => tab.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));

    // Add active class to clicked tab and corresponding panel
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  downloadReport(pdfPath) {
    if (pdfPath) {
      window.open(`/api/reports/${pdfPath}`, '_blank');
    }
  }

  printReport() {
    window.print();
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 FontScannerApp initializing...');
  new FontScannerApp();
});