/**
 * Unified Analyzer Loading System
 * Provides consistent loading UI across all analyzer pages
 */

class AnalyzerLoader {
  constructor(containerId = 'loadingContainer') {
    this.container = document.getElementById(containerId);
    this.steps = [];
    this.currentStep = 0;
    this.startTime = null;
    this.progressInterval = null;
  }

  /**
   * Initialize loading UI with steps
   * @param {Array<{label: string, detail: string}>} steps - Analysis steps
   * @param {string} title - Loading title
   * @param {number} estimatedSeconds - Estimated completion time
   */
  start(steps, title = '[ANALYZING]', estimatedSeconds = 30) {
    this.steps = steps;
    this.currentStep = 0;
    this.startTime = Date.now();
    
    if (!this.container) {
      console.error('Loading container not found');
      return;
    }

    // Build loading HTML
    this.container.innerHTML = `
      <div class="analyzer-loading active">
        <div class="loading-header">
          <h2 class="loading-title">${title}</h2>
          <span id="progressPercentage" style="font-size: 1rem; font-weight: 700; color: #00ff41; min-width: 45px; text-align: right;">0%</span>
        </div>

        <div class="loading-progress-bar">
          <div class="progress-bar-fill" id="progressBarFill" style="width: 0%"></div>
        </div>

        <div class="progress-steps" id="progressSteps">
          ${steps.map((step, index) => `
            <div class="progress-step ${index === 0 ? 'active' : 'pending'}" data-step="${index}">
              <div class="step-icon"></div>
              <div class="step-text">
                <div class="step-label">${step.label}</div>
                <div class="step-detail">${step.detail}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="estimated-time">
          <p class="time-label">Time remaining:</p>
          <p class="time-value" id="timeRemaining">${this.formatTime(estimatedSeconds)}</p>
        </div>
      </div>
    `;

    this.container.style.display = 'block';
    
    // Start progress simulation
    this.simulateProgress(estimatedSeconds);
  }

  /**
   * Update to next step
   * @param {number} stepIndex - Step to activate (optional, auto-increments if not provided)
   */
  nextStep(stepIndex) {
    const index = stepIndex !== undefined ? stepIndex : this.currentStep + 1;
    
    if (index > this.steps.length) return;

    // Mark previous step as complete
    if (this.currentStep < this.steps.length) {
      const prevStep = document.querySelector(`.progress-step[data-step="${this.currentStep}"]`);
      if (prevStep) {
        prevStep.classList.remove('active');
        prevStep.classList.add('complete');
      }
    }

    // Activate current step
    if (index < this.steps.length) {
      const currentStepEl = document.querySelector(`.progress-step[data-step="${index}"]`);
      if (currentStepEl) {
        currentStepEl.classList.remove('pending');
        currentStepEl.classList.add('active');
      }
    }

    this.currentStep = index;
    this.updateProgress();
  }

  /**
   * Mark a step as complete
   * @param {number} stepIndex - Step to mark complete
   */
  completeStep(stepIndex) {
    const step = document.querySelector(`.progress-step[data-step="${stepIndex}"]`);
    if (step) {
      step.classList.remove('active', 'pending');
      step.classList.add('complete');
    }
    this.updateProgress();
  }

  /**
   * Mark a step as error
   * @param {number} stepIndex - Step that failed
   * @param {string} errorMessage - Error description
   */
  errorStep(stepIndex, errorMessage) {
    const step = document.querySelector(`.progress-step[data-step="${stepIndex}"]`);
    if (step) {
      step.classList.remove('active', 'pending', 'complete');
      step.classList.add('error');
      
      const detail = step.querySelector('.step-detail');
      if (detail) {
        detail.textContent = errorMessage || 'Analysis failed';
      }
    }
  }

  /**
   * Update progress bar based on completed steps
   */
  updateProgress() {
    const completed = document.querySelectorAll('.progress-step.complete').length;
    const total = this.steps.length;
    const percentage = (completed / total) * 100;
    
    const progressBar = document.getElementById('progressBarFill');
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }
    
    const percentageDisplay = document.getElementById('progressPercentage');
    if (percentageDisplay) {
      percentageDisplay.textContent = `${Math.round(percentage)}%`;
    }
  }

  /**
   * Simulate progress with estimated time
   */
  simulateProgress(estimatedSeconds) {
    const updateInterval = 1000; // Update every second
    let elapsed = 0;

    this.progressInterval = setInterval(() => {
      elapsed += updateInterval / 1000;
      const remaining = Math.max(0, estimatedSeconds - elapsed);
      
      const timeElement = document.getElementById('timeRemaining');
      if (timeElement) {
        timeElement.textContent = this.formatTime(Math.ceil(remaining));
      }

      // Auto-advance steps based on time
      const stepDuration = estimatedSeconds / this.steps.length;
      const expectedStep = Math.floor(elapsed / stepDuration);
      
      if (expectedStep > this.currentStep && expectedStep < this.steps.length) {
        this.nextStep(expectedStep);
      }

      if (remaining <= 0) {
        clearInterval(this.progressInterval);
      }
    }, updateInterval);
  }

  /**
   * Complete the loading process
   */
  complete() {
    // Mark all steps complete
    document.querySelectorAll('.progress-step').forEach(step => {
      step.classList.remove('active', 'pending');
      step.classList.add('complete');
    });

    const progressBar = document.getElementById('progressBarFill');
    if (progressBar) {
      progressBar.style.width = '100%';
    }
    
    const percentageDisplay = document.getElementById('progressPercentage');
    if (percentageDisplay) {
      percentageDisplay.textContent = '100%';
    }

    const timeElement = document.getElementById('timeRemaining');
    if (timeElement) {
      timeElement.textContent = 'Complete!';
      timeElement.style.color = '#00ff41';
    }

    clearInterval(this.progressInterval);

    // Fade out after 1 second
    setTimeout(() => {
      this.hide();
    }, 1000);
  }

  /**
   * Hide loading UI
   */
  hide() {
    if (this.container) {
      const loader = this.container.querySelector('.analyzer-loading');
      if (loader) {
        loader.classList.remove('active');
        setTimeout(() => {
          this.container.style.display = 'none';
        }, 300);
      }
    }
    clearInterval(this.progressInterval);
  }

  /**
   * Show error state
   */
  showError(message) {
    const loader = this.container.querySelector('.analyzer-loading');
    if (loader) {
      loader.innerHTML = `
        <div class="loading-header">
          <h2 class="loading-title" style="color: #ff4444;">✗ Analysis Failed</h2>
          <p class="loading-subtitle">${message}</p>
        </div>
        <div style="text-align: center; margin-top: 2rem;">
          <button class="analyze-button" onclick="location.reload()">Try Again</button>
        </div>
      `;
    }
    clearInterval(this.progressInterval);
  }

  /**
   * Format seconds into readable time
   */
  formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
}

// Export for use in other scripts (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyzerLoader;
}

// Also expose to browser window for CSP-compliant usage
if (typeof window !== 'undefined') {
  // Expose the class
  window.AnalyzerLoaderClass = AnalyzerLoader;
  
  // Create singleton instance with static-like methods for dashboard compatibility
  const loaderInstance = new AnalyzerLoader('loadingContainer');
  
  // Track step IDs to indices mapping
  const stepMap = new Map();
  let currentProgress = 0;
  
  window.AnalyzerLoader = {
    // Dashboard-compatible API (adapted from different method names)
    show: (steps, title, estimatedSeconds) => {
      // Map step IDs to indices
      stepMap.clear();
      steps.forEach((step, index) => {
        stepMap.set(step.id, index);
      });
      
      // Convert dashboard step format to loader format
      const loaderSteps = steps.map(s => ({
        label: s.label,
        detail: s.detail || ''
      }));
      
      return loaderInstance.start(loaderSteps, title, estimatedSeconds);
    },
    
    updateStep: (stepId, status) => {
      const stepIndex = stepMap.get(stepId);
      if (stepIndex === undefined) return;
      
      if (status === 'active') {
        loaderInstance.nextStep(stepIndex);
      } else if (status === 'complete') {
        loaderInstance.completeStep(stepIndex);
      } else if (status === 'error') {
        loaderInstance.errorStep(stepIndex, 'Failed');
      }
    },
    
    updateProgress: (percent) => {
      currentProgress = percent;
      // The loader auto-calculates progress, but we can override if needed
      const progressBar = document.getElementById('progressBarFill');
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
      const percentageDisplay = document.getElementById('progressPercentage');
      if (percentageDisplay) {
        percentageDisplay.textContent = `${Math.round(percent)}%`;
      }
    },
    
    complete: (message) => loaderInstance.complete(message),
    error: (message) => loaderInstance.error(message),
    hide: () => loaderInstance.hide(),
    
    // Also expose the class for `new AnalyzerLoader()` usage
    Class: AnalyzerLoader
  };
}
