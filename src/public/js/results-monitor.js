// Inspection results monitoring page logic
(function() {
  'use strict';

  // Get inspection ID from URL
  var urlParams = new URLSearchParams(window.location.search);
  var scanId = urlParams.get('scanId');

  if (!scanId) {
    document.querySelector('.progress-container').innerHTML =
      '<div class="error-message">' +
      '<h2>No Inspection ID Provided</h2>' +
      '<p>Please provide a valid inspection ID in the URL.</p>' +
      '<a href="/" class="btn btn-primary">&larr; Back to Home</a>' +
      '</div>';
  } else {
    initializeInspectionMonitoring();
  }

  var pollInterval = null;
  var startTime = null;
  var currentStatus = null;

  async function initializeInspectionMonitoring() {
    document.getElementById('scanId').textContent = scanId;

    // Start polling
    pollInterval = setInterval(fetchScanStatus, 2000);
    fetchScanStatus(); // Initial fetch

    // Update elapsed time
    setInterval(updateElapsedTime, 1000);
  }

  async function fetchScanStatus() {
    try {
      var response = await fetch('/api/scans/' + scanId);
      var data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch scan status');
      }

      updateUI(data);

      // Stop polling if scan is complete or failed
      if (data.status === 'done' || data.status === 'failed') {
        clearInterval(pollInterval);
        if (window.asciiBackground && window.asciiBackground.stop) {
          window.asciiBackground.stop();
        }
      }
    } catch (error) {
      console.error('Error fetching scan status:', error);
      showError('Failed to fetch scan status: ' + error.message);
    }
  }

  function updateUI(data) {
    // Update URL
    document.getElementById('scanUrl').textContent = data.url;

    // Update status badge
    var statusBadge = document.getElementById('statusBadge');
    statusBadge.textContent = data.status.toUpperCase();
    statusBadge.className = 'status-badge status-' + data.status;
    currentStatus = data.status;

    // Update progress bar
    var progress = data.progress || 0;
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('progressText').textContent = progress + '%';

    // Update info cards
    document.getElementById('pagesCrawled').textContent = data.pagesCrawled || 0;

    if (data.createdAt) {
      document.getElementById('createdAt').textContent = new Date(data.createdAt).toLocaleString();
      if (!startTime) {
        startTime = new Date(data.createdAt);
      }
    }

    // Update workflow stage indicator based on status
    updateWorkflowStage(data.status);

    // Handle completion
    if (data.status === 'done' && data.results) {
      showResults(data.results);
      document.getElementById('exportCsvBtn').style.display = 'inline-block';
    }

    // Handle failure
    if (data.status === 'failed') {
      showError(data.error || 'Scan failed for unknown reason');
    }
  }

  function updateElapsedTime() {
    if (!startTime) return;

    var elapsed = Math.floor((new Date() - startTime) / 1000);
    var minutes = Math.floor(elapsed / 60);
    var seconds = elapsed % 60;

    document.getElementById('timeElapsed').textContent = minutes + 'm ' + seconds + 's';

    updateLongScanHint(elapsed);
  }

  function updateLongScanHint(elapsedSeconds) {
    var hint = document.getElementById('longScanHint');
    if (!hint) return;

    var isActiveScan = currentStatus && currentStatus !== 'done' && currentStatus !== 'failed';
    var isLong = elapsedSeconds >= 60;

    if (!isActiveScan || !isLong) {
      hint.classList.remove('show');
      return;
    }

    hint.classList.add('show');

    var messageEl = document.getElementById('longScanMessage');
    if (!messageEl) return;

    var messages = [
      'Some sites take longer to inspect.',
      'Still crawling pages and checking links.',
      'Finishing up the last checks \u2014 almost there.'
    ];

    var messageIndex = Math.floor((elapsedSeconds - 60) / 10) % messages.length;
    messageEl.textContent = messages[messageIndex];
  }

  function showError(message) {
    var errorContainer = document.getElementById('errorContainer');
    var errorMessage = document.getElementById('errorMessage');

    errorMessage.innerHTML = '<strong>Error:</strong> ' + message;
    errorContainer.style.display = 'block';
  }

  function showResults(results) {
    var resultsSection = document.getElementById('resultsSection');
    var resultTabs = document.getElementById('resultTabs');
    var resultContent = document.getElementById('resultContent');

    resultsSection.style.display = 'block';

    // Create tabs for each analyzer type
    var analyzers = Object.keys(results).filter(function(key) {
      return key !== 'scanId' && key !== 'summary' && key !== 'pages';
    });

    if (analyzers.length === 0) {
      resultContent.innerHTML = '<p>No analyzer results available.</p>';
      return;
    }

    // Create tabs
    analyzers.forEach(function(analyzer, index) {
      var tab = document.createElement('button');
      tab.className = 'tab-button' + (index === 0 ? ' active' : '');
      tab.textContent = analyzer.toUpperCase();
      tab.onclick = function() { switchTab(analyzer); };
      resultTabs.appendChild(tab);
    });

    // Show first analyzer results
    switchTab(analyzers[0]);
  }

  function switchTab(analyzer) {
    // Update active tab
    document.querySelectorAll('.tab-button').forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.textContent === analyzer.toUpperCase()) {
        btn.classList.add('active');
      }
    });

    // Fetch and display results for this analyzer
    fetch('/api/scans/' + scanId)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var resultContent = document.getElementById('resultContent');
        var analyzerResults = data.results[analyzer];

        if (!analyzerResults) {
          resultContent.innerHTML = '<p>No results available for this analyzer.</p>';
          return;
        }

        // Display results as formatted JSON
        resultContent.innerHTML =
          '<pre style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; overflow-x: auto;">' +
          JSON.stringify(analyzerResults, null, 2) +
          '</pre>';
      });
  }

  /**
   * Update the workflow stage indicator based on scan status
   * Stages: 1. Scan -> 2. Diagnose -> 3. Prioritize -> 4. Export -> 5. Improve
   */
  function updateWorkflowStage(status) {
    var stages = {
      scan: document.getElementById('stagesScan'),
      diagnose: document.getElementById('stagesDiagnose'),
      prioritize: document.getElementById('stagesPrioritize'),
      export: document.getElementById('stagesExport'),
      improve: document.getElementById('stagesImprove')
    };

    // Helper to set stage as active
    var setActive = function(el) {
      if (!el) return;
      el.style.background = 'rgba(var(--accent-primary-rgb), 0.15)';
      el.style.color = 'var(--accent-primary)';
      el.style.border = '2px solid var(--accent-primary)';
      el.style.fontWeight = '600';
    };

    // Helper to set stage as complete
    var setComplete = function(el) {
      if (!el) return;
      el.style.background = 'var(--bg-secondary, #1a1a1a)';
      el.style.color = 'var(--accent-primary)';
      el.style.border = '1px solid var(--accent-primary)';
      el.style.fontWeight = 'normal';
    };

    // Helper to set stage as pending
    var setPending = function(el) {
      if (!el) return;
      el.style.background = 'var(--bg-secondary, #1a1a1a)';
      el.style.color = 'var(--text-muted, #888)';
      el.style.border = '1px solid var(--border-color, #333)';
      el.style.fontWeight = 'normal';
    };

    // Update based on status
    switch (status) {
      case 'queued':
        setComplete(stages.scan);
        setPending(stages.diagnose);
        setPending(stages.prioritize);
        setPending(stages.export);
        setPending(stages.improve);
        break;
      case 'running':
        setComplete(stages.scan);
        setActive(stages.diagnose);
        setPending(stages.prioritize);
        setPending(stages.export);
        setPending(stages.improve);
        break;
      case 'done':
        setComplete(stages.scan);
        setComplete(stages.diagnose);
        setActive(stages.prioritize);
        setComplete(stages.export);
        setPending(stages.improve);
        break;
      case 'failed':
        setComplete(stages.scan);
        if (stages.diagnose) {
          stages.diagnose.style.background = 'rgba(255, 68, 68, 0.15)';
          stages.diagnose.style.color = '#ff4444';
          stages.diagnose.style.border = '2px solid #ff4444';
        }
        break;
    }
  }

  // New scan button
  var newScanBtn = document.getElementById('newScanBtn');
  if (newScanBtn) {
    newScanBtn.addEventListener('click', function() {
      window.location.href = '/';
    });
  }

  // Export CSV button
  var exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', function() {
      alert('CSV export coming soon!');
    });
  }
})();
