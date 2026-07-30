/**
 * Admin Dashboard Script
 * Handles admin functionality for user management, testing, and monitoring
 */

// Check admin access on load
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is authenticated
  if (!proManager || !proManager.isAuthenticated()) {
    window.location.href = '/auth.html?redirect=/admin.html';
    return;
  }

  // Setup logout link
  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      proManager.logout();
      window.location.href = '/';
    });
  }

  // Check if user is admin by trying to fetch dashboard stats
  try {
    await loadDashboardStats();
  } catch (error) {
    if (error.message.includes('Admin')) {
      showError('Access Denied: Admin privileges required');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 2000);
      return;
    }
  }

  // Load analytics charts (non-blocking)
  loadAnalytics();

  // Load Docker widget on homepage
  loadDockerWidget();

  // Load new dashboard widgets
  loadSecurityWidget();
  loadDbStats();
  loadErrorLog();
  loadActiveScans();
  initQuickActions();

  // Auto-refresh security widget every 30s
  setInterval(loadSecurityWidget, 30000);
  // Auto-refresh active scans every 10s
  setInterval(loadActiveScans, 10000);

  // Initialize tabs
  initializeTabs();
  initChartTabs();

  // Load initial data
  await loadUsers();
  await loadActivityLog();

  // Setup search
  document.getElementById('userSearch').addEventListener('input', debounce(loadUsers, 300));

  // Setup forms
  document.getElementById('createTestUserForm').addEventListener('submit', handleCreateTestUser);
  document.getElementById('resetUsageForm').addEventListener('submit', handleResetUsage);
});

/**
 * Load dashboard statistics
 */
async function loadDashboardStats() {
  try {
    const response = await fetch('/api/admin/dashboard-stats', {
      headers: proManager.getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load stats');
    }

    // Update stats
    document.getElementById('totalUsers').textContent = data.stats.users.total;
    document.getElementById('proUsers').textContent = data.stats.users.pro;
    document.getElementById('freeUsers').textContent = data.stats.users.free;
    document.getElementById('totalScans').textContent = data.stats.scans.total;
    document.getElementById('scansToday').textContent = data.stats.scans.today;
    document.getElementById('scansWeek').textContent = data.stats.scans.thisWeek;
    document.getElementById('activeSubscriptions').textContent = data.stats.subscriptions.active;
    document.getElementById('mrr').textContent = data.stats.subscriptions.mrr;

    // Purchases
    if (data.stats.purchases) {
      document.getElementById('totalPurchases').textContent = data.stats.purchases.total;
      document.getElementById('purchaseSubtext').textContent = data.stats.purchases.today + ' today';
    } else {
      document.getElementById('totalPurchases').textContent = '0';
      document.getElementById('purchaseSubtext').textContent = '0 today';
    }

  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    throw error;
  }
}

/**
 * Load users list
 */
async function loadUsers() {
  try {
    const search = document.getElementById('userSearch').value;
    const url = `/api/admin/users?search=${encodeURIComponent(search)}`;

    const response = await fetch(url, {
      headers: proManager.getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load users');
    }

    displayUsers(data.users);

  } catch (error) {
    console.error('Error loading users:', error);
    showError('Failed to load users: ' + error.message);
  }
}

/**
 * Display users in table
 */
function displayUsers(users) {
  const tbody = document.getElementById('usersTableBody');

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--r-text-faint, #9CA3AF);">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr>
      <td>
        ${user.email}
        ${user.is_admin ? '<span class="admin-badge-small">ADMIN</span>' : ''}
      </td>
      <td>
        <span class="plan-badge ${user.plan}">${user.plan.toUpperCase()}</span>
      </td>
      <td>
        ${user.scansToday || 0} today / ${user.totalScans || 0} total
      </td>
      <td>
        ${formatDate(user.created_at)}
      </td>
      <td>
        <button class="btn btn-secondary" data-action="view-user" data-user-id="${user.id}">View</button>
        <button class="btn btn-secondary" data-action="toggle-user-plan" data-user-id="${user.id}" data-current-plan="${user.plan}">
          ${user.plan === 'free' ? 'Make Pro' : 'Make Free'}
        </button>
        ${!user.is_admin ? `<button class="btn btn-danger" data-action="delete-user" data-user-id="${user.id}" data-user-email="${user.email}">Delete</button>` : ''}
      </td>
    </tr>
  `).join('');
}

/**
 * View user details
 */
async function viewUser(userId) {
  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      headers: proManager.getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load user');
    }

    const user = data.user;
    const details = `
User: ${user.email}
Plan: ${user.plan}
Admin: ${user.is_admin ? 'Yes' : 'No'}
Created: ${formatDate(user.created_at)}
Last Login: ${formatDate(user.last_login)}

Stats:
- Total Scans: ${data.stats.totalScans}
- Scans Today: ${data.stats.scansToday}
- Entitlements: ${data.entitlements.length}
    `;

    alert(details);

  } catch (error) {
    showError('Failed to load user details: ' + error.message);
  }
}

/**
 * Toggle user plan (free <-> pro)
 */
async function toggleUserPlan(userId, currentPlan) {
  const newPlan = currentPlan === 'free' ? 'pro' : 'free';

  if (!confirm(`Change user plan to ${newPlan.toUpperCase()}?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...proManager.getAuthHeaders()
      },
      body: JSON.stringify({ plan: newPlan })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update user');
    }

    showSuccess(`User plan updated to ${newPlan.toUpperCase()}`);
    await loadUsers();
    await loadDashboardStats();

  } catch (error) {
    showError('Failed to update user: ' + error.message);
  }
}

/**
 * Delete user
 */
async function deleteUser(userId, email) {
  if (!confirm(`Are you sure you want to delete user: ${email}?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: proManager.getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete user');
    }

    showSuccess(`User ${email} deleted successfully`);
    await loadUsers();
    await loadDashboardStats();

  } catch (error) {
    showError('Failed to delete user: ' + error.message);
  }
}

/**
 * Load activity log
 */
async function loadActivityLog() {
  try {
    const response = await fetch('/api/admin/activity-log', {
      headers: proManager.getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load activity log');
    }

    displayActivityLog(data.logs);

  } catch (error) {
    console.error('Error loading activity log:', error);
  }
}

/**
 * Display activity log
 */
function displayActivityLog(logs) {
  const container = document.getElementById('activityLog');

  if (logs.length === 0) {
    container.innerHTML = '<div class="loading">No activity recorded</div>';
    return;
  }

  container.innerHTML = logs.map(log => `
    <div class="activity-item">
      <div class="activity-action">${log.action.replace(/_/g, ' ')}</div>
      <div class="activity-details">
        By: ${log.admin_email || 'Unknown'}
        ${log.target_email ? `• Target: ${log.target_email}` : ''}
      </div>
      <div class="activity-time">${formatDate(log.created_at)}</div>
    </div>
  `).join('');
}

/**
 * Handle create test user form
 */
async function handleCreateTestUser(e) {
  e.preventDefault();

  const email = document.getElementById('testUserEmail').value;
  const password = document.getElementById('testUserPassword').value;
  const plan = document.getElementById('testUserPlan').value;

  try {
    const response = await fetch('/api/admin/testing/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...proManager.getAuthHeaders()
      },
      body: JSON.stringify({ email, password, plan })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create test user');
    }

    showSuccess(`Test user created!\n\nEmail: ${data.user.email}\nPassword: ${data.user.password}\nPlan: ${data.user.plan}`);

    // Reset form
    document.getElementById('createTestUserForm').reset();
    document.getElementById('testUserPassword').value = 'TestPass123';

    // Reload users list
    await loadUsers();
    await loadDashboardStats();

  } catch (error) {
    showError('Failed to create test user: ' + error.message);
  }
}

/**
 * Handle reset usage form
 */
async function handleResetUsage(e) {
  e.preventDefault();

  const userIdOrEmail = document.getElementById('resetUserId').value;

  try {
    // First, get user ID if email was provided
    let userId = userIdOrEmail;
    if (userIdOrEmail.includes('@')) {
      // Search for user by email
      const searchResponse = await fetch(`/api/admin/users?search=${encodeURIComponent(userIdOrEmail)}`, {
        headers: proManager.getAuthHeaders()
      });
      const searchData = await searchResponse.json();

      if (searchData.users.length === 0) {
        throw new Error('User not found');
      }
      userId = searchData.users[0].id;
    }

    const response = await fetch(`/api/admin/testing/reset-usage/${userId}`, {
      method: 'POST',
      headers: proManager.getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reset usage');
    }

    showSuccess(data.message);
    document.getElementById('resetUsageForm').reset();
    await loadUsers();

  } catch (error) {
    showError('Failed to reset usage: ' + error.message);
  }
}

/**
 * Initialize tabs
 */
function initializeTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const contents = document.querySelectorAll('.tab-content');
  let currentTab = 'users';

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      // Leave health room when switching away
      if (currentTab === 'health' && targetTab !== 'health') {
        leaveHealthRoom();
      }

      // Update active states
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(`${targetTab}Tab`).classList.add('active');

      // Join health room when switching to health tab
      if (targetTab === 'health') {
        joinHealthRoom();
      }

      // Load bug reports when switching to bugs tab
      if (targetTab === 'bugs') {
        loadBugReports();
      }

      currentTab = targetTab;
    });
  });
}

/**
 * Chart tab switching
 */
function initChartTabs() {
  var nav = document.getElementById('chartTabsNav');
  if (!nav) return;

  var btns = nav.querySelectorAll('.chart-tab-btn');
  var panels = document.querySelectorAll('.chart-tab-panel');
  var aiCostsLoaded = false;

  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.dataset.chartTab;

      btns.forEach(function (b) { b.classList.remove('active'); });
      panels.forEach(function (p) { p.classList.remove('active'); });

      btn.classList.add('active');
      var panel = document.getElementById('chartPanel-' + target);
      if (panel) panel.classList.add('active');

      // Lazy-load AI costs on first visit
      if (target === 'ai-costs' && !aiCostsLoaded) {
        aiCostsLoaded = true;
        loadAICosts();
        loadAIConfig();
      }

      // Re-render charts when switching tabs (canvas size may have changed)
      if (typeof _analyticsData !== 'undefined' && _analyticsData) {
        setTimeout(function () { _renderCharts(_analyticsData); }, 50);
      }
    });
  });
}

/**
 * Load AI costs data and render chart + summary
 */
async function loadAICosts() {
  try {
    var response = await fetch('/api/admin/ai-costs', {
      headers: proManager.getAuthHeaders()
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load AI costs');

    // Render token usage chart
    _renderAICostsChart(data);

    // Render cost summary
    _renderAICostsSummary(data);
  } catch (err) {
    console.error('Error loading AI costs:', err);
    var summary = document.getElementById('aiCostsSummary');
    if (summary) summary.innerHTML = '<div style="color:var(--admin-text-faint);font-size:0.85rem;padding:1rem">No AI usage data available</div>';
  }
}

function _renderAICostsChart(data) {
  // Build 30-day series from daily data
  var map = {};
  (data.daily || []).forEach(function (r) {
    if (!map[r.day]) map[r.day] = 0;
    map[r.day] += r.total_tokens || 0;
  });

  var labels = [];
  var values = [];
  var now = new Date();
  for (var i = 29; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    var key = d.toISOString().split('T')[0];
    var short = (d.getMonth() + 1) + '/' + d.getDate();
    labels.push(short);
    values.push(map[key] || 0);
  }

  _drawBarChart('aiCostsChart', labels, values, { color: '#a855f7' });
}

function _renderAICostsSummary(data) {
  var el = document.getElementById('aiCostsSummary');
  if (!el) return;

  var t = data.totals || {};
  var last30 = t.last30Days || {};
  var allTime = t.allTime || {};

  function fmtTokens(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  var rows = [
    { label: 'Tokens (30d)', value: fmtTokens(last30.tokens) },
    { label: 'Requests (30d)', value: String(last30.requests || 0) },
    { label: 'Est. Cost (30d)', value: '$' + (data.totalCost30d || '0.00'), cls: 'cost' },
    { label: 'Tokens (all time)', value: fmtTokens(allTime.tokens) },
    { label: 'Requests (all time)', value: String(allTime.requests || 0) },
  ];

  // Add per-model breakdown
  if (data.costBreakdown && data.costBreakdown.length) {
    rows.push({ label: '', value: '' }); // spacer
    data.costBreakdown.forEach(function (m) {
      var shortName = m.model.replace('claude-', '').split('-202')[0];
      rows.push({ label: shortName, value: fmtTokens(m.tokens) + ' / $' + m.estimatedCost, cls: 'cost' });
    });
  }

  el.innerHTML = rows.map(function (r) {
    if (!r.label && !r.value) return '<div style="border-bottom:1px solid var(--admin-border);margin:0.25rem 0"></div>';
    return '<div class="ai-stat-row"><span class="ai-stat-label">' + r.label +
      '</span><span class="ai-stat-value' + (r.cls ? ' ' + r.cls : '') + '">' + r.value + '</span></div>';
  }).join('');
}

/**
 * Load AI config and render model switcher
 */
async function loadAIConfig() {
  try {
    var response = await fetch('/api/admin/ai-config', {
      headers: proManager.getAuthHeaders()
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed');

    _renderAIConfig(data);
  } catch (err) {
    console.error('Error loading AI config:', err);
    var panel = document.getElementById('aiConfigPanel');
    if (panel) panel.innerHTML = '<div style="color:var(--admin-text-faint);font-size:0.85rem;padding:1rem">Failed to load AI config</div>';
  }
}

function _renderAIConfig(data) {
  var panel = document.getElementById('aiConfigPanel');
  if (!panel) return;

  var html = '';

  // AI enabled toggle
  html += '<div class="ai-toggle-row">' +
    '<span class="ai-toggle-label">AI Recommendations</span>' +
    '<div class="ai-toggle-switch' + (data.enabled ? ' on' : '') + '" id="aiEnabledToggle"></div>' +
    '</div>';

  // Model selector
  html += '<div class="ai-model-switcher">' +
    '<h4>Model</h4>' +
    '<div class="ai-model-options">';

  (data.availableModels || []).forEach(function (m) {
    var selected = m.id === data.model;
    html += '<div class="ai-model-option' + (selected ? ' selected' : '') + '" data-model-id="' + m.id + '">' +
      '<div class="ai-model-option-left">' +
        '<span class="ai-model-name">' + m.name + '</span>' +
        '<span class="ai-model-meta">' + m.speed + ' &middot; ' + m.quality + ' quality</span>' +
      '</div>' +
      '<span class="ai-model-price">$' + m.costPer1M.toFixed(2) + '/1M tokens</span>' +
    '</div>';
  });

  html += '</div></div>';

  panel.innerHTML = html;

  // Attach event listeners
  var toggle = document.getElementById('aiEnabledToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var isOn = toggle.classList.contains('on');
      _updateAIConfig({ enabled: !isOn });
      toggle.classList.toggle('on');
    });
  }

  panel.querySelectorAll('.ai-model-option').forEach(function (opt) {
    opt.addEventListener('click', function () {
      var modelId = opt.dataset.modelId;
      panel.querySelectorAll('.ai-model-option').forEach(function (o) { o.classList.remove('selected'); });
      opt.classList.add('selected');
      _updateAIConfig({ model: modelId });
    });
  });
}

async function _updateAIConfig(updates) {
  try {
    var response = await fetch('/api/admin/ai-config', {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json' }, proManager.getAuthHeaders()),
      body: JSON.stringify(updates)
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed');
    showSuccess('AI configuration updated');
  } catch (err) {
    console.error('Failed to update AI config:', err);
    showError('Failed to update AI config: ' + err.message);
  }
}

/**
 * Show success message
 */
function showSuccess(message) {
  const el = document.getElementById('successMessage');
  el.textContent = message;
  el.style.display = 'block';
  document.getElementById('errorMessage').style.display = 'none';

  setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}

/**
 * Show error message
 */
function showError(message) {
  const el = document.getElementById('errorMessage');
  el.textContent = message;
  el.style.display = 'block';
  document.getElementById('successMessage').style.display = 'none';

  setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}

/**
 * Format date
 */
function formatDate(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  // Use centralized i18n formatting if available
  if (window.i18n?.formatDateTime) {
    return window.i18n.formatDateTime(date, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  // Fallback with locale detection
  const locale = window.i18n?.currentLanguage || navigator.language || 'en-US';
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale.startsWith('en')
  });
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// =============================================================================
// TEST RUNNER FUNCTIONALITY
// =============================================================================

let testSuites = [];
const testResultsCache = {};
let isRunningTests = false;

/**
 * Initialize test runner
 */
async function initializeTestRunner() {
  await loadTestSuites();
  
  // Attach event listeners
  document.getElementById('runAllTestsBtn')?.addEventListener('click', runAllTests);
  document.getElementById('quickCheckBtn')?.addEventListener('click', runQuickCheck);
  document.getElementById('copyFailedReportBtn')?.addEventListener('click', copyFailedReport);
}

/**
 * Load available test suites
 */
async function loadTestSuites() {
  const container = document.getElementById('testSuitesGrid');
  
  try {
    const response = await fetch('/api/admin/tests/suites', {
      headers: proManager.getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load test suites');
    }

    // Handle production environment where Jest is unavailable
    if (data.unavailable) {
      container.innerHTML = `<div class="loading">Test runner is not available in this environment.<br><span style="font-size:0.85rem;color:var(--admin-text-faint);">Jest is a dev dependency and is not installed in production.</span></div>`;
      document.getElementById('runAllTestsBtn').disabled = true;
      document.getElementById('quickCheckBtn').disabled = true;
      return;
    }

    testSuites = data.suites;
    renderTestSuites();

  } catch (error) {
    console.error('Error loading test suites:', error);
    container.innerHTML = `<div class="loading" style="color: #ef4444;">Failed to load test suites: ${error.message}</div>`;
  }
}

/**
 * Render test suite cards
 */
function renderTestSuites() {
  const container = document.getElementById('testSuitesGrid');
  
  if (testSuites.length === 0) {
    container.innerHTML = '<div class="loading">No test suites found</div>';
    return;
  }

  container.innerHTML = testSuites.map(suite => {
    const cached = testResultsCache[suite.id];
    let statusClass = '';
    let statusText = 'Click to run';
    
    if (cached) {
      if (cached.running) {
        statusClass = 'running';
        statusText = 'Running...';
      } else if (cached.failed > 0) {
        statusClass = 'failed';
        statusText = `${cached.passed} passed, ${cached.failed} failed`;
      } else {
        statusClass = 'passed';
        statusText = `${cached.passed} passed`;
      }
    }

    return `
      <div class="test-suite-card ${statusClass}" data-suite-id="${suite.id}" data-action="run-test-suite">
        <div class="test-suite-header">
          <span class="test-suite-name">${suite.name}</span>
          <span class="test-suite-category ${suite.category}">${suite.category}</span>
        </div>
        <div class="test-suite-status ${statusClass}">${statusText}</div>
      </div>
    `;
  }).join('');
}

/**
 * Run a single test suite
 */
async function runSingleSuite(suiteId) {
  if (isRunningTests) {
    showError('Tests are already running');
    return;
  }

  const suite = testSuites.find(s => s.id === suiteId);
  if (!suite) return;

  isRunningTests = true;
  setTestButtonsDisabled(true);
  
  // Mark as running
  testResultsCache[suiteId] = { running: true };
  renderTestSuites();
  showTestRunning();

  try {
    const response = await fetch('/api/admin/tests/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...proManager.getAuthHeaders()
      },
      body: JSON.stringify({ suite: suite.path })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to run tests');
    }

    // Update cache
    const suiteResult = data.results.testResults[0];
    testResultsCache[suiteId] = {
      passed: suiteResult?.assertionResults.filter(a => a.status === 'passed').length || 0,
      failed: suiteResult?.assertionResults.filter(a => a.status === 'failed').length || 0
    };

    renderTestSuites();
    displayTestResults(data.results);

  } catch (error) {
    console.error('Error running test suite:', error);
    testResultsCache[suiteId] = { passed: 0, failed: 1, error: error.message };
    renderTestSuites();
    showError('Failed to run tests: ' + error.message);
  } finally {
    isRunningTests = false;
    setTestButtonsDisabled(false);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  if (isRunningTests) {
    showError('Tests are already running');
    return;
  }

  isRunningTests = true;
  setTestButtonsDisabled(true);
  
  // Mark all as running
  testSuites.forEach(s => {
    testResultsCache[s.id] = { running: true };
  });
  renderTestSuites();
  showTestRunning('Running all tests... This may take a few minutes.');

  try {
    const response = await fetch('/api/admin/tests/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...proManager.getAuthHeaders()
      },
      body: JSON.stringify({})
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to run tests');
    }

    // Update cache for each suite
    testSuites.forEach(suite => {
      const result = data.results.testResults.find(tr => 
        tr.name.includes(suite.path.replace('tests/', ''))
      );
      
      if (result) {
        testResultsCache[suite.id] = {
          passed: result.assertionResults.filter(a => a.status === 'passed').length,
          failed: result.assertionResults.filter(a => a.status === 'failed').length
        };
      } else {
        delete testResultsCache[suite.id];
      }
    });

    renderTestSuites();
    displayTestResults(data.results);
    showSuccess(`Tests complete: ${data.results.numPassedTests} passed, ${data.results.numFailedTests} failed`);

  } catch (error) {
    console.error('Error running all tests:', error);
    testSuites.forEach(s => {
      testResultsCache[s.id] = { error: true };
    });
    renderTestSuites();
    showTestError(error.message);
  } finally {
    isRunningTests = false;
    setTestButtonsDisabled(false);
  }
}

/**
 * Run quick health check
 */
async function runQuickCheck() {
  if (isRunningTests) {
    showError('Tests are already running');
    return;
  }

  isRunningTests = true;
  setTestButtonsDisabled(true);
  showTestRunning('Running quick health check...');

  try {
    const response = await fetch('/api/admin/tests/quick-check', {
      headers: proManager.getAuthHeaders()
    });

    const data = await response.json();

    const panel = document.getElementById('testResultsPanel');
    
    if (data.healthy) {
      panel.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
          <div style="font-size: 1.25rem; font-weight: 600; color: #22c55e;">Health Check Passed</div>
          <div style="color: var(--r-text-faint, #9CA3AF); margin-top: 0.5rem;">
            ${data.passed} tests passed in ${data.duration}ms
          </div>
        </div>
      `;
      showSuccess('Quick health check passed!');
    } else {
      panel.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
          <div style="font-size: 1.25rem; font-weight: 600; color: #ef4444;">Health Check Failed</div>
          <div style="color: var(--r-text-faint, #9CA3AF); margin-top: 0.5rem;">
            ${data.error || `${data.failed} tests failed`}
          </div>
        </div>
      `;
      showError('Quick health check failed!');
    }

  } catch (error) {
    console.error('Error running quick check:', error);
    showTestError(error.message);
  } finally {
    isRunningTests = false;
    setTestButtonsDisabled(false);
  }
}

/** Last test results for failed report generation */
let lastTestResults = null;

/**
 * Generate a structured markdown report of failed tests for Claude
 */
function generateFailedTestReport(results) {
  const failedFiles = results.testResults.filter(file =>
    file.assertionResults.some(a => a.status === 'failed')
  );

  if (failedFiles.length === 0) return null;

  let report = `# Failed Test Report\n\n`;
  report += `**${results.numFailedTests} failed** out of ${results.numTotalTests} tests\n\n`;

  for (const file of failedFiles) {
    const filePath = file.name;
    const failures = file.assertionResults.filter(a => a.status === 'failed');

    report += `## ${filePath}\n\n`;

    for (const failure of failures) {
      report += `### FAIL: ${failure.fullName}\n\n`;
      if (failure.failureMessages.length > 0) {
        report += '```\n' + failure.failureMessages.join('\n') + '\n```\n\n';
      }
    }
  }

  report += `---\nPlease analyze these failures and fix them. The test files are in the \`tests/\` directory and the source code is in \`src/\`.\n`;

  return report;
}

/**
 * Copy failed test report to clipboard
 */
function copyFailedReport() {
  if (!lastTestResults) return;
  const report = generateFailedTestReport(lastTestResults);
  if (!report) return;

  navigator.clipboard.writeText(report).then(() => {
    const btn = document.getElementById('copyFailedReportBtn');
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy Failed Report';
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    showError('Failed to copy to clipboard');
  });
}

/**
 * Display test results
 */
function displayTestResults(results) {
  lastTestResults = results;

  // Show/hide copy failed report button
  const copyBtn = document.getElementById('copyFailedReportBtn');
  if (copyBtn) {
    if (results.numFailedTests > 0) {
      copyBtn.classList.remove('hidden');
      copyBtn.textContent = `Copy Failed Report (${results.numFailedTests})`;
    } else {
      copyBtn.classList.add('hidden');
    }
  }

  // Update summary
  const summary = document.getElementById('testSummary');
  summary.classList.remove('hidden');
  
  document.getElementById('testTotal').textContent = results.numTotalTests;
  document.getElementById('testPassed').textContent = results.numPassedTests;
  document.getElementById('testFailed').textContent = results.numFailedTests;
  
  const duration = results.endTime - results.startTime;
  document.getElementById('testDuration').textContent = duration > 1000 
    ? `${(duration / 1000).toFixed(1)}s` 
    : `${duration}ms`;

  // Display detailed results
  const panel = document.getElementById('testResultsPanel');
  
  if (results.testResults.length === 0) {
    panel.innerHTML = '<div class="test-results-empty">No test results</div>';
    return;
  }

  panel.innerHTML = results.testResults.map(file => {
    const passCount = file.assertionResults.filter(a => a.status === 'passed').length;
    const failCount = file.assertionResults.filter(a => a.status === 'failed').length;
    const fileName = file.name.split('/').pop();

    return `
      <div class="test-result-file">
        <div class="test-result-file-header">
          <span class="test-result-file-name">${fileName}</span>
          <div class="test-result-file-stats">
            <span class="pass-count">${passCount} ✓</span>
            ${failCount > 0 ? `<span class="fail-count">${failCount} ✗</span>` : ''}
          </div>
        </div>
        <div class="test-assertions">
          ${file.assertionResults.map(assertion => `
            <div class="test-assertion ${assertion.status}">
              <span class="test-assertion-icon ${assertion.status}"></span>
              <div>
                <span class="test-assertion-name">${assertion.title}</span>
                ${assertion.duration ? `<span class="test-duration">(${assertion.duration}ms)</span>` : ''}
                ${assertion.failureMessages.length > 0 ? `
                  <div class="test-assertion-error">${escapeHtml(assertion.failureMessages[0])}</div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Show test running indicator
 */
function showTestRunning(message = 'Running tests...') {
  const panel = document.getElementById('testResultsPanel');
  panel.innerHTML = `
    <div class="test-running-indicator">
      <div class="spinner"></div>
      <span>${message}</span>
    </div>
  `;
}

/**
 * Show test error
 */
function showTestError(message) {
  const panel = document.getElementById('testResultsPanel');
  panel.innerHTML = `
    <div style="text-align: center; padding: 2rem; color: #ef4444;">
      <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
      <div>Failed to run tests</div>
      <div style="font-size: 0.875rem; color: var(--r-text-faint, #9CA3AF); margin-top: 0.5rem;">${escapeHtml(message)}</div>
    </div>
  `;
}

/**
 * Disable/enable test buttons
 */
function setTestButtonsDisabled(disabled) {
  document.getElementById('runAllTestsBtn').disabled = disabled;
  document.getElementById('quickCheckBtn').disabled = disabled;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize test runner when testing tab is activated
document.addEventListener('DOMContentLoaded', () => {
  // Load test suites after a short delay to avoid blocking initial load
  setTimeout(initializeTestRunner, 500);
});

// Event delegation for admin actions (CSP compliant)
document.addEventListener('click', function(e) {
  // Handle view user action
  const viewUserBtn = e.target.closest('[data-action="view-user"]');
  if (viewUserBtn) {
    const userId = viewUserBtn.getAttribute('data-user-id');
    if (userId) {
      e.preventDefault();
      viewUser(userId);
    }
    return;
  }

  // Handle toggle user plan action
  const togglePlanBtn = e.target.closest('[data-action="toggle-user-plan"]');
  if (togglePlanBtn) {
    const userId = togglePlanBtn.getAttribute('data-user-id');
    const currentPlan = togglePlanBtn.getAttribute('data-current-plan');
    if (userId && currentPlan) {
      e.preventDefault();
      toggleUserPlan(userId, currentPlan);
    }
    return;
  }

  // Handle delete user action
  const deleteUserBtn = e.target.closest('[data-action="delete-user"]');
  if (deleteUserBtn) {
    const userId = deleteUserBtn.getAttribute('data-user-id');
    const userEmail = deleteUserBtn.getAttribute('data-user-email');
    if (userId && userEmail) {
      e.preventDefault();
      deleteUser(userId, userEmail);
    }
    return;
  }

  // Handle run test suite action
  const testSuiteCard = e.target.closest('[data-action="run-test-suite"]');
  if (testSuiteCard) {
    const suiteId = testSuiteCard.getAttribute('data-suite-id');
    if (suiteId) {
      e.preventDefault();
      runSingleSuite(suiteId);
    }
    return;
  }
});

// =============================================================================
// DOCKER WIDGET (homepage)
// =============================================================================

async function loadDockerWidget() {
  var body = document.getElementById('dockerWidgetBody');
  var dot = document.getElementById('dockerDot');
  if (!body) return;

  try {
    var response = await fetch('/api/admin/server-info', {
      headers: proManager.getAuthHeaders()
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed');

    var s = data.server;
    var d = data.docker;
    var g = data.git;
    var a = data.app;

    if (dot) { dot.classList.add('live'); }

    var envClass = s.env === 'production' ? 'env-prod' : 'env-dev';

    body.innerHTML =
      '<div class="docker-widget-row">' +
        '<span class="docker-widget-label">Environment</span>' +
        '<span class="docker-widget-value ' + envClass + '">' + escapeHtml(s.env) + '</span>' +
      '</div>' +
      '<div class="docker-widget-row">' +
        '<span class="docker-widget-label">Docker</span>' +
        '<span class="docker-widget-value">' + (d.isDocker ? 'Yes' : 'No') + '</span>' +
      '</div>' +
      (d.containerId ? '<div class="docker-widget-row">' +
        '<span class="docker-widget-label">Container</span>' +
        '<span class="docker-widget-value">' + escapeHtml(d.containerId) + '</span>' +
      '</div>' : '') +
      '<div class="docker-widget-row">' +
        '<span class="docker-widget-label">Version</span>' +
        '<span class="docker-widget-value">' + escapeHtml(a.version || 'N/A') + '</span>' +
      '</div>' +
      '<div class="docker-widget-row">' +
        '<span class="docker-widget-label">Node</span>' +
        '<span class="docker-widget-value">' + escapeHtml(s.nodeVersion) + '</span>' +
      '</div>' +
      '<div class="docker-widget-row">' +
        '<span class="docker-widget-label">Branch</span>' +
        '<span class="docker-widget-value">' + escapeHtml(g.branch || 'N/A') + '</span>' +
      '</div>' +
      '<div class="docker-widget-row">' +
        '<span class="docker-widget-label">Commit</span>' +
        '<span class="docker-widget-value">' + escapeHtml(g.commit || 'N/A') + '</span>' +
      '</div>' +
      '<div class="docker-widget-row">' +
        '<span class="docker-widget-label">Uptime</span>' +
        '<span class="docker-widget-value">' + formatUptime(s.uptime) + '</span>' +
      '</div>' +
      '<div class="docker-widget-row">' +
        '<span class="docker-widget-label">Memory</span>' +
        '<span class="docker-widget-value">' + data.memory.rss + ' MB</span>' +
      '</div>' +
      '<button class="docker-widget-deploy-btn" id="dockerWidgetDeployBtn">Deploy Latest</button>';

    // Attach deploy handler
    document.getElementById('dockerWidgetDeployBtn').addEventListener('click', handleDeploy);

  } catch (error) {
    body.innerHTML = '<div class="docker-widget-loading" style="color:#ef4444;">Failed to load</div>';
  }
}

// =============================================================================
// SECURITY WIDGET
// =============================================================================

async function loadSecurityWidget() {
  var body = document.getElementById('securityWidgetBody');
  var badge = document.getElementById('threatBadge');
  if (!body) return;

  try {
    var response = await fetch('/api/admin/security-overview', {
      headers: proManager.getAuthHeaders()
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed');

    // Threat badge
    if (badge) {
      badge.textContent = data.threatLevel.toUpperCase();
      badge.className = 'security-threat-badge ' + data.threatLevel;
    }

    var rl = data.rateLimits || {};
    var af = data.abuseFilter || {};
    var auth = data.authFailures || {};

    var html =
      '<div class="widget-stat-row">' +
        '<span class="widget-stat-label">Blocked IPs</span>' +
        '<span class="widget-stat-value' + (af.blockedIPs > 0 ? ' danger' : '') + '">' + (af.blockedIPs || 0) + '</span>' +
      '</div>' +
      '<div class="widget-stat-row">' +
        '<span class="widget-stat-label">Rate Violations (1h)</span>' +
        '<span class="widget-stat-value' + (rl.lastHour > 10 ? ' warn' : '') + '">' + (rl.lastHour || 0) + '</span>' +
      '</div>' +
      '<div class="widget-stat-row">' +
        '<span class="widget-stat-label">Rate Violations (24h)</span>' +
        '<span class="widget-stat-value">' + (rl.last24Hours || 0) + '</span>' +
      '</div>' +
      '<div class="widget-stat-row">' +
        '<span class="widget-stat-label">Auth Failures (1h)</span>' +
        '<span class="widget-stat-value' + (auth.lastHour > 5 ? ' warn' : '') + '">' + (auth.lastHour || 0) + '</span>' +
      '</div>' +
      '<div class="widget-stat-row">' +
        '<span class="widget-stat-label">Auth Failures (24h)</span>' +
        '<span class="widget-stat-value">' + (auth.last24Hours || 0) + '</span>' +
      '</div>';

    // Top offending IPs
    var topIPs = data.topIPs || [];
    if (topIPs.length > 0) {
      html += '<div class="security-top-ips">' +
        '<div class="security-top-ips-title">Top Offending IPs</div>';
      topIPs.slice(0, 3).forEach(function(entry) {
        html += '<div class="security-ip-row">' +
          '<span>' + escapeHtml(entry.ip) + '</span>' +
          '<span class="ip-hits">' + entry.totalHits + ' hits</span>' +
        '</div>';
      });
      html += '</div>';
    }

    body.innerHTML = html;
  } catch (error) {
    body.innerHTML = '<div class="docker-widget-loading" style="color:#ef4444;">Failed to load</div>';
  }
}

// =============================================================================
// DATABASE STATS WIDGET
// =============================================================================

async function loadDbStats() {
  var body = document.getElementById('dbStatsBody');
  if (!body) return;

  try {
    var response = await fetch('/api/admin/db-stats', {
      headers: proManager.getAuthHeaders()
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed');

    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    var html =
      '<div class="widget-stat-row">' +
        '<span class="widget-stat-label">DB File Size</span>' +
        '<span class="widget-stat-value">' + formatBytes(data.fileSize) + '</span>' +
      '</div>' +
      '<div class="widget-stat-row">' +
        '<span class="widget-stat-label">WAL Size</span>' +
        '<span class="widget-stat-value">' + formatBytes(data.walSize) + '</span>' +
      '</div>';

    var tables = data.tables || {};
    Object.keys(tables).forEach(function(table) {
      var displayName = table.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      html += '<div class="widget-stat-row">' +
        '<span class="widget-stat-label">' + escapeHtml(displayName) + '</span>' +
        '<span class="widget-stat-value">' + tables[table].toLocaleString() + '</span>' +
      '</div>';
    });

    body.innerHTML = html;
  } catch (error) {
    body.innerHTML = '<div class="docker-widget-loading" style="color:#ef4444;">Failed to load</div>';
  }
}

// =============================================================================
// ERROR LOG
// =============================================================================

async function loadErrorLog() {
  var body = document.getElementById('errorLogBody');
  var countEl = document.getElementById('errorLogCount');
  if (!body) return;

  try {
    var response = await fetch('/api/admin/error-log', {
      headers: proManager.getAuthHeaders()
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed');

    var errors = data.errors || [];
    if (countEl) countEl.textContent = errors.length + ' error' + (errors.length !== 1 ? 's' : '');

    if (errors.length === 0) {
      body.innerHTML = '<div class="error-log-empty">No recent errors</div>';
      return;
    }

    var html = '';
    errors.forEach(function(err) {
      var timeAgo = formatTimeAgo(err.timestamp);
      var ctx = err.context || {};
      var contextStr = '';
      if (ctx.method || ctx.url) {
        contextStr = (ctx.method || '') + ' ' + (ctx.url || '');
        if (err.statusCode) contextStr += ' (' + err.statusCode + ')';
      }

      html += '<div class="error-log-entry">' +
        '<div class="error-log-entry-header">' +
          '<span class="error-log-type">' + escapeHtml(err.type || 'Error') + '</span>' +
          '<span class="error-log-time">' + timeAgo + '</span>' +
        '</div>' +
        '<div class="error-log-message">' + escapeHtml(err.message || 'Unknown error') + '</div>';

      if (contextStr) {
        html += '<div class="error-log-context">' + escapeHtml(contextStr) + '</div>';
      }

      if (err.stack) {
        html += '<div class="error-log-stack collapsed" onclick="this.classList.toggle(\'collapsed\')">' +
          escapeHtml(err.stack) + '</div>';
      }

      html += '</div>';
    });

    body.innerHTML = html;
  } catch (error) {
    body.innerHTML = '<div class="docker-widget-loading" style="color:#ef4444;">Failed to load errors</div>';
  }
}

function formatTimeAgo(timestamp) {
  var diff = Date.now() - (typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime());
  if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

// =============================================================================
// ACTIVE SCANS
// =============================================================================

async function loadActiveScans() {
  var body = document.getElementById('activeScansBody');
  var countEl = document.getElementById('activeScanCount');
  if (!body) return;

  try {
    var response = await fetch('/api/admin/active-scans', {
      headers: proManager.getAuthHeaders()
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed');

    var scans = data.scans || [];
    if (countEl) countEl.textContent = scans.length + ' running';

    if (scans.length === 0) {
      body.innerHTML = '<div class="active-scans-empty">No active scans</div>';
      return;
    }

    var html = '';
    scans.forEach(function(scan) {
      var pct = scan.progress || 0;
      var elapsed = scan.elapsed_seconds || 0;
      var elapsedStr = elapsed < 60 ? elapsed + 's' : Math.floor(elapsed / 60) + 'm ' + (elapsed % 60) + 's';

      html += '<div class="active-scan-item">' +
        '<span class="active-scan-url" title="' + escapeHtml(scan.target_url || '') + '">' + escapeHtml(scan.target_url || 'Unknown') + '</span>' +
        '<div class="active-scan-progress"><div class="active-scan-progress-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="active-scan-pct">' + pct + '%</span>' +
        '<span class="active-scan-time">' + elapsedStr + '</span>' +
      '</div>';
    });

    body.innerHTML = html;
  } catch (error) {
    body.innerHTML = '<div class="active-scans-empty" style="color:#ef4444;">Failed to load</div>';
  }
}

// =============================================================================
// QUICK ACTIONS
// =============================================================================

function initQuickActions() {
  var actions = [
    { id: 'actionClearPool', url: '/api/admin/actions/clear-browser-pool' },
    { id: 'actionForceGC', url: '/api/admin/actions/force-gc' },
    { id: 'actionFlushRateLimits', url: '/api/admin/actions/flush-rate-limits' },
    { id: 'actionClearBlocked', url: '/api/admin/actions/clear-blocked' }
  ];

  actions.forEach(function(action) {
    var btn = document.getElementById(action.id);
    if (!btn) return;

    var originalText = btn.textContent;
    btn.addEventListener('click', async function() {
      btn.disabled = true;
      try {
        var response = await fetch(action.url, {
          method: 'POST',
          headers: proManager.getAuthHeaders()
        });
        var data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed');

        btn.classList.add('success');
        btn.textContent = 'Done';
        setTimeout(function() {
          btn.classList.remove('success');
          btn.textContent = originalText;
          btn.disabled = false;
        }, 2000);

        // Refresh security widget after security-related actions
        if (action.id === 'actionFlushRateLimits' || action.id === 'actionClearBlocked') {
          loadSecurityWidget();
        }
      } catch (error) {
        btn.textContent = 'Error';
        btn.style.color = '#ef4444';
        setTimeout(function() {
          btn.style.color = '';
          btn.textContent = originalText;
          btn.disabled = false;
        }, 2000);
      }
    });
  });

  // Error log refresh button
  var refreshBtn = document.getElementById('refreshErrorLogBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadErrorLog);
  }
}

// =============================================================================
// SERVER INFO & DEPLOY
// =============================================================================

async function loadServerInfo() {
  const grid = document.getElementById('serverInfoGrid');
  const envBadge = document.getElementById('serverEnvBadge');

  try {
    const response = await fetch('/api/admin/server-info', {
      headers: proManager.getAuthHeaders()
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed');

    const s = data.server;
    const d = data.docker;
    const g = data.git;
    const a = data.app;

    // Environment badge
    envBadge.textContent = s.env;
    envBadge.className = 'server-info-env' + (s.env !== 'production' ? ' dev' : '');

    const items = [
      { label: 'Docker', value: d.isDocker ? 'Running' : 'No' },
      { label: 'Container ID', value: d.containerId || 'N/A' },
      { label: 'App Version', value: a.version || 'N/A' },
      { label: 'Node.js', value: s.nodeVersion },
      { label: 'Git Branch', value: g.branch || 'N/A' },
      { label: 'Git Commit', value: g.commit || 'N/A' },
      { label: 'Last Deploy', value: g.commitDate ? new Date(g.commitDate).toLocaleString() : 'N/A' },
      { label: 'Uptime', value: formatUptime(s.uptime) },
      { label: 'Hostname', value: s.hostname },
      { label: 'Platform', value: s.platform + '/' + s.arch },
      { label: 'CPUs', value: s.cpus },
      { label: 'System Memory', value: s.freeMemory + ' / ' + s.totalMemory + ' MB' },
      { label: 'Load Average', value: s.loadAvg.join(', ') },
      { label: 'PID', value: s.pid }
    ];

    grid.innerHTML = items.map(function(item) {
      return '<div class="server-info-item">' +
        '<span class="server-info-label">' + escapeHtml(item.label) + '</span>' +
        '<span class="server-info-value">' + escapeHtml(String(item.value)) + '</span>' +
        '</div>';
    }).join('');

  } catch (error) {
    grid.innerHTML = '<div class="server-info-loading" style="color:#ef4444;">Failed to load server info: ' + escapeHtml(error.message) + '</div>';
  }
}

async function handleDeploy() {
  if (!confirm('Pull latest code from main branch?\n\nThe container may need to be restarted manually after this.')) {
    return;
  }

  const deployBtn = document.getElementById('deployBtn');
  const outputEl = document.getElementById('deployOutput');

  deployBtn.disabled = true;
  deployBtn.textContent = 'Deploying...';
  outputEl.classList.remove('hidden');
  outputEl.textContent = 'Running git pull origin main...\n';

  try {
    const response = await fetch('/api/admin/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...proManager.getAuthHeaders()
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Deploy failed');
    }

    outputEl.textContent += data.output + '\n\n' + data.message;
    showSuccess('Deploy completed! ' + data.message);

    // Refresh server info to show new commit
    setTimeout(loadServerInfo, 1000);

  } catch (error) {
    outputEl.textContent += 'ERROR: ' + error.message;
    showError('Deploy failed: ' + error.message);
  } finally {
    deployBtn.disabled = false;
    deployBtn.textContent = 'Deploy Latest';
  }
}

// Initialize server info when health tab is activated or on load
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('refreshServerInfoBtn')?.addEventListener('click', loadServerInfo);
  document.getElementById('deployBtn')?.addEventListener('click', handleDeploy);

  // Load on first health tab activation
  var healthTabLoaded = false;
  document.querySelectorAll('.admin-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      if (tab.dataset.tab === 'health' && !healthTabLoaded) {
        healthTabLoaded = true;
        loadServerInfo();
      }
    });
  });
});

// =============================================================================
// SYSTEM HEALTH DASHBOARD
// =============================================================================

let healthSocket = null;
const healthHistory = {
  heap: [],
  rss: [],
  cpu: [],
  scans: [],
  reqPerMin: []
};
const HEALTH_HISTORY_MAX = 60;

/**
 * Join the admin-health Socket.IO room
 */
function joinHealthRoom() {
  const token = (typeof proManager !== 'undefined' && proManager.token)
    ? proManager.token
    : localStorage.getItem('sm_token');

  if (!token) {
    updateHealthStatus('error', 'No auth token');
    return;
  }

  if (!healthSocket) {
    healthSocket = io({ transports: ['websocket', 'polling'] });

    healthSocket.on('connect', () => {
      updateHealthStatus('live', 'Live');
      healthSocket.emit('join-admin-health', token);
    });

    healthSocket.on('disconnect', () => {
      updateHealthStatus('error', 'Disconnected');
    });

    healthSocket.on('connect_error', () => {
      updateHealthStatus('error', 'Connection error');
    });

    healthSocket.on('admin:health-tick', renderHealthTick);

    healthSocket.on('admin:health-error', (data) => {
      updateHealthStatus('error', data.error || 'Auth failed');
    });
  } else {
    // Already connected, just re-join the room
    if (healthSocket.connected) {
      healthSocket.emit('join-admin-health', token);
      updateHealthStatus('live', 'Live');
    } else {
      healthSocket.connect();
    }
  }

  // Fetch initial data via REST so we don't wait 4s
  fetchInitialHealth();
}

/**
 * Leave the admin-health room (server stops sending ticks)
 */
function leaveHealthRoom() {
  if (healthSocket && healthSocket.connected) {
    healthSocket.emit('leave-admin-health');
  }
}

/**
 * Fetch initial health data via REST API
 */
async function fetchInitialHealth() {
  try {
    const headers = (typeof proManager !== 'undefined' && proManager.getAuthHeaders)
      ? proManager.getAuthHeaders()
      : { 'Authorization': 'Bearer ' + localStorage.getItem('sm_token') };

    const res = await fetch('/api/health', { headers });
    if (res.ok) {
      const data = await res.json();
      const mem = data.memory || {};
      renderHealthTick({
        timestamp: Date.now(),
        memory: {
          heapUsed: Math.round((mem.heapUsed || 0) / 1024 / 1024 * 10) / 10,
          heapTotal: Math.round((mem.heapTotal || 0) / 1024 / 1024 * 10) / 10,
          rss: Math.round((mem.rss || 0) / 1024 / 1024 * 10) / 10,
          external: Math.round((mem.external || 0) / 1024 / 1024 * 10) / 10
        },
        cpu: { percent: 0 },
        uptime: data.uptime || 0,
        activeScans: 0,
        requestsPerMinute: 0,
        errors: { lastMinute: 0, lastHour: 0, thresholdViolations: [] },
        rateLimits: { totalViolations: 0, lastHour: 0 },
        browserPool: { available: 0, borrowed: 0, max: 0 }
      });
    }
  } catch (_) { /* initial fetch is best-effort */ }
}

/**
 * Update the connection status indicator
 */
function updateHealthStatus(state, text) {
  const dot = document.getElementById('healthDot');
  const statusText = document.getElementById('healthStatusText');
  if (!dot || !statusText) return;

  dot.className = 'health-dot';
  if (state === 'live') dot.classList.add('live');
  else if (state === 'error') dot.classList.add('error');
  statusText.textContent = text;
}

/**
 * Render a single health tick into the dashboard
 */
function renderHealthTick(data) {
  if (!data) return;

  // Uptime
  const uptimeEl = document.getElementById('healthUptime');
  if (uptimeEl && data.uptime != null) {
    uptimeEl.textContent = 'Uptime: ' + formatUptime(data.uptime);
  }

  // Memory gauges
  if (data.memory) {
    const heapPct = data.memory.heapTotal > 0
      ? Math.round(data.memory.heapUsed / data.memory.heapTotal * 100)
      : 0;
    setGaugeBar('heapBar', heapPct);
    setText('heapValue', data.memory.heapUsed);
    setText('heapTotal', data.memory.heapTotal);

    // RSS (use 1024 MB as reference max)
    const rssPct = Math.min(100, Math.round(data.memory.rss / 1024 * 100));
    setGaugeBar('rssBar', rssPct);
    setText('rssValue', data.memory.rss);

    pushHistory('heap', data.memory.heapUsed);
    pushHistory('rss', data.memory.rss);
  }

  // CPU gauge
  if (data.cpu) {
    setGaugeBar('cpuBar', Math.round(data.cpu.percent));
    setText('cpuValue', data.cpu.percent);
    pushHistory('cpu', data.cpu.percent);
  }

  // Active scans
  setText('activeScansValue', data.activeScans != null ? data.activeScans : 0);
  pushHistory('scans', data.activeScans || 0);

  // Requests per minute
  setText('reqPerMinValue', data.requestsPerMinute != null ? data.requestsPerMinute : '—');
  pushHistory('reqPerMin', data.requestsPerMinute || 0);

  // Errors
  if (data.errors) {
    setText('errMinValue', data.errors.lastMinute);
    setText('errHourValue', data.errors.lastHour);

    const warning = document.getElementById('errorThresholdWarning');
    if (warning) {
      if (data.errors.thresholdViolations && data.errors.thresholdViolations.length > 0) {
        warning.classList.remove('hidden');
        warning.textContent = data.errors.thresholdViolations.map(function(v) { return v.message; }).join('; ');
      } else {
        warning.classList.add('hidden');
      }
    }
  }

  // Rate limits
  if (data.rateLimits) {
    setText('rlTotalValue', data.rateLimits.totalViolations);
    setText('rlHourValue', data.rateLimits.lastHour);
  }

  // Browser pool
  if (data.browserPool) {
    var bp = data.browserPool;
    setText('poolAvailable', bp.available);
    setText('poolBorrowed', bp.borrowed);
    setText('poolMax', bp.max);

    var maxPool = bp.max || 1;
    var availPct = Math.round(bp.available / maxPool * 100);
    var borrowPct = Math.round(bp.borrowed / maxPool * 100);
    var availBar = document.getElementById('poolAvailableBar');
    var borrowBar = document.getElementById('poolBorrowedBar');
    if (availBar) availBar.style.width = availPct + '%';
    if (borrowBar) borrowBar.style.width = borrowPct + '%';
  }

  // Render sparklines
  renderSparkline('heapSparkline', healthHistory.heap, Math.max.apply(null, healthHistory.heap.concat([100])));
  renderSparkline('rssSparkline', healthHistory.rss, Math.max.apply(null, healthHistory.rss.concat([100])));
  renderSparkline('cpuSparkline', healthHistory.cpu, 100);
  renderSparkline('scansSparkline', healthHistory.scans, Math.max.apply(null, healthHistory.scans.concat([1])));
  renderSparkline('reqSparkline', healthHistory.reqPerMin, Math.max.apply(null, healthHistory.reqPerMin.concat([1])));
}

/**
 * Set a gauge bar's width and color class
 */
function setGaugeBar(id, percent) {
  var el = document.getElementById(id);
  if (!el) return;
  percent = Math.max(0, Math.min(100, percent));
  el.style.width = percent + '%';
  el.classList.remove('warn', 'danger');
  if (percent > 85) el.classList.add('danger');
  else if (percent > 60) el.classList.add('warn');
}

/**
 * Set text content of an element by ID
 */
function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

/**
 * Push a value into a history array, capped at HEALTH_HISTORY_MAX
 */
function pushHistory(key, value) {
  var arr = healthHistory[key];
  if (!arr) return;
  arr.push(value);
  if (arr.length > HEALTH_HISTORY_MAX) arr.shift();
}

/**
 * Render a CSS-only sparkline into a container
 */
function renderSparkline(containerId, data, maxValue) {
  var container = document.getElementById(containerId);
  if (!container || !data || data.length === 0) return;

  maxValue = maxValue || 1;
  var okColor = getComputedStyle(document.body).getPropertyValue('--admin-sparkline-ok').trim() || '#22c55e';
  var bars = '';
  for (var i = 0; i < data.length; i++) {
    var val = data[i];
    var heightPct = Math.max(2, Math.round(val / maxValue * 100));
    var ratio = val / maxValue;
    var color;
    if (ratio > 0.85) color = '#ef4444';
    else if (ratio > 0.6) color = '#f59e0b';
    else color = okColor;
    bars += '<div class="spark-bar" style="height:' + heightPct + '%;background:' + color + '"></div>';
  }
  container.innerHTML = bars;
}

/**
 * Format uptime seconds into human-readable string
 */
function formatUptime(seconds) {
  seconds = Math.floor(seconds);
  var d = Math.floor(seconds / 86400);
  var h = Math.floor((seconds % 86400) / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = seconds % 60;

  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
  if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
  return m + 'm ' + s + 's';
}

// ── Bug Reports ─────────────────────────────────────────────────────

var _bugFilter = 'all';
var _bugPage = 1;

function loadBugReports(status, page) {
  _bugFilter = status || _bugFilter || 'all';
  _bugPage = page || 1;

  var qs = '?page=' + _bugPage + '&limit=20';
  if (_bugFilter !== 'all') qs += '&status=' + _bugFilter;

  fetch('/api/admin/bugs' + qs, {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') }
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.success) throw new Error(data.error || 'Failed to load');
    renderBugReportsTable(data.bugReports || [], data.total || 0, data.page, data.limit);
  })
  .catch(function(err) {
    document.getElementById('bugReportsTableBody').innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">' + err.message + '</td></tr>';
  });
}

function renderBugReportsTable(reports, total, page, limit) {
  var tbody = document.getElementById('bugReportsTableBody');
  if (!reports.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">No bug reports found</td></tr>';
    document.getElementById('bugPagination').innerHTML = '';
    return;
  }

  var rows = reports.map(function(r) {
    var shortUrl = (r.scannedUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (shortUrl.length > 30) shortUrl = shortUrl.substring(0, 30) + '...';
    var shortDesc = (r.description || '').substring(0, 60);
    if ((r.description || '').length > 60) shortDesc += '...';
    var catLabel = (r.category || '').replace(/_/g, ' ');
    var dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '';

    var actions = '';
    if (r.status === 'pending') {
      actions =
        '<button class="bug-action-btn bug-action-btn--approve" onclick="reviewBug(' + r.id + ',\'approved\')">Approve</button>' +
        '<button class="bug-action-btn bug-action-btn--reject" onclick="reviewBug(' + r.id + ',\'rejected\')">Reject</button>' +
        '<button class="bug-action-btn bug-action-btn--duplicate" onclick="reviewBug(' + r.id + ',\'duplicate\')">Dupe</button>';
    } else {
      actions = r.tokenGranted ? '<span style="color:#22c55e;font-size:0.75rem;">Token granted</span>' : '—';
    }

    return '<tr>' +
      '<td>' + (r.userEmail || '—') + '</td>' +
      '<td title="' + (r.scannedUrl || '') + '">' + (shortUrl || '—') + '</td>' +
      '<td style="text-transform:capitalize;">' + catLabel + '</td>' +
      '<td title="' + (r.description || '').replace(/"/g, '&quot;') + '">' + shortDesc + '</td>' +
      '<td><span class="bug-status bug-status--' + r.status + '">' + r.status + '</span></td>' +
      '<td>' + dateStr + '</td>' +
      '<td>' + actions + '</td>' +
    '</tr>';
  });

  tbody.innerHTML = rows.join('');

  // Pagination
  var totalPages = Math.ceil(total / limit);
  var pagDiv = document.getElementById('bugPagination');
  if (totalPages <= 1) { pagDiv.innerHTML = ''; return; }
  var btns = '';
  for (var i = 1; i <= totalPages; i++) {
    var active = i === page ? 'background:var(--admin-accent);color:#fff;' : '';
    btns += '<button onclick="loadBugReports(null,' + i + ')" style="padding:0.25rem 0.625rem;border:1px solid var(--admin-border);border-radius:4px;cursor:pointer;color:var(--admin-text);background:var(--admin-card-bg);' + active + '">' + i + '</button>';
  }
  pagDiv.innerHTML = btns;
}

function reviewBug(bugId, decision) {
  var notes = '';
  if (decision === 'rejected' || decision === 'duplicate') {
    notes = prompt('Add a note (optional):') || '';
  }

  fetch('/api/admin/bugs/' + bugId, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
    },
    body: JSON.stringify({ decision: decision, adminNotes: notes })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.success) throw new Error(data.error || 'Failed');
    var msg = decision === 'approved'
      ? 'Bug approved — reward token granted!'
      : 'Bug ' + decision;
    showSuccess(msg);
    loadBugReports();
  })
  .catch(function(err) {
    showError(err.message);
  });
}

// Bug filter chip clicks
document.addEventListener('click', function(e) {
  var chip = e.target.closest('.bug-filter-chip');
  if (!chip) return;
  document.querySelectorAll('.bug-filter-chip').forEach(function(c) { c.classList.remove('active'); });
  chip.classList.add('active');
  loadBugReports(chip.getAttribute('data-bug-filter'), 1);
});
