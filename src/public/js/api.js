/**
 * API Utility Module
 * Provides authenticated fetch for all analyzer API calls
 */

(function() {
  'use strict';

  /**
   * Get auth headers including token if user is logged in
   * @returns {Object} Headers object
   */
  function getAuthHeaders() {
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Make an authenticated API request
   * @param {string} url - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async function apiFetch(url, options = {}) {
    const headers = {
      ...getAuthHeaders(),
      ...(options.headers || {})
    };

    return fetch(url, {
      ...options,
      headers
    });
  }

  /**
   * Make an authenticated POST request with JSON body
   * @param {string} url - API endpoint
   * @param {Object} body - Request body
   * @param {Object} extraOptions - Additional fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async function apiPost(url, body, extraOptions = {}) {
    return apiFetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      ...extraOptions
    });
  }

  // Expose globally for use by other scripts
  window.SM_API = {
    getAuthHeaders,
    fetch: apiFetch,
    post: apiPost
  };

  // Also expose getAuthHeaders directly for backwards compatibility
  window.getAuthHeaders = getAuthHeaders;
})();
