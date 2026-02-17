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

  // Initialize tabs
  initializeTabs();

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

      currentTab = targetTab;
    });
  });
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

/**
 * Display test results
 */
function displayTestResults(results) {
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
// SYSTEM HEALTH DASHBOARD
// =============================================================================

let healthSocket = null;
let healthHistory = {
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
  var bars = '';
  for (var i = 0; i < data.length; i++) {
    var val = data[i];
    var heightPct = Math.max(2, Math.round(val / maxValue * 100));
    var ratio = val / maxValue;
    var color;
    if (ratio > 0.85) color = '#ef4444';
    else if (ratio > 0.6) color = '#f59e0b';
    else color = '#00ff41';
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
