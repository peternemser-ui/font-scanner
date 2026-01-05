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
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">No users found</td></tr>';
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
        <button class="btn btn-secondary" onclick="viewUser('${user.id}')">View</button>
        <button class="btn btn-secondary" onclick="toggleUserPlan('${user.id}', '${user.plan}')">
          ${user.plan === 'free' ? 'Make Pro' : 'Make Free'}
        </button>
        ${!user.is_admin ? `<button class="btn btn-danger" onclick="deleteUser('${user.id}', '${user.email}')">Delete</button>` : ''}
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

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      // Update active states
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(`${targetTab}Tab`).classList.add('active');
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
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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
