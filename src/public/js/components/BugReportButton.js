/**
 * BugReportButton — Minimal bug report trigger + slide-up drawer
 *
 * Appears after every report renders (via report:ready event).
 * Users can report data issues and earn reward tokens.
 */
(function(window) {
  'use strict';

  function t(key, fallback, params) {
    let str = fallback;
    if (window.i18n && typeof window.i18n.t === 'function') {
      const translated = window.i18n.t(key, params);
      if (translated && translated !== key) str = translated;
    }
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(k => {
        str = str.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), params[k]);
      });
    }
    return str;
  }

  const CATEGORIES = [
    { key: 'wrong_data',       label: () => t('bugReport.categories.wrongData', 'Wrong Data') },
    { key: 'missing_section',  label: () => t('bugReport.categories.missingSection', 'Missing Section') },
    { key: 'display_issue',    label: () => t('bugReport.categories.displayIssue', 'Display Issue') },
    { key: 'crash_error',      label: () => t('bugReport.categories.crashError', 'Crash / Error') },
    { key: 'other',            label: () => t('bugReport.categories.other', 'Other') }
  ];

  const MIN_CHARS = 30;
  let _drawerOpen = false;

  /**
   * Build the inline trigger HTML
   */
  function renderTrigger() {
    return `
      <div class="bug-report-trigger" style="
        text-align: center;
        padding: 0.75rem 0;
        margin-top: 0.5rem;
      ">
        <button class="bug-report-trigger__btn" data-bug-report-open
          style="
            background: none;
            border: none;
            color: var(--r-text-muted, var(--text-muted, #6B7280));
            font-size: 0.8125rem;
            cursor: pointer;
            padding: 0.375rem 0.75rem;
            border-radius: 6px;
            transition: color 0.15s, background 0.15s;
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
          "
          onmouseover="this.style.color='var(--r-text, var(--text-primary, #E5E7EB))';this.style.background='var(--r-surface-2, rgba(255,255,255,0.05))'"
          onmouseout="this.style.color='var(--r-text-muted, var(--text-muted, #6B7280))';this.style.background='none'"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          ${t('bugReport.trigger', 'Found a data issue? Report it & earn a free unlock')}
        </button>
      </div>
    `;
  }

  /**
   * Build the drawer HTML
   */
  function renderDrawer() {
    const categoryChips = CATEGORIES.map(cat =>
      `<button type="button" class="bug-drawer__chip" data-bug-category="${cat.key}">${cat.label()}</button>`
    ).join('');

    return `
      <div class="bug-drawer-backdrop" data-bug-drawer-backdrop style="
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(0,0,0,0.4); opacity: 0;
        transition: opacity 0.2s; pointer-events: none;
      "></div>
      <div class="bug-drawer" data-bug-drawer style="
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 10001;
        background: var(--r-surface-1, var(--bg-primary, #161A1F));
        border-top: 1px solid var(--r-border, var(--border-color, #2D333B));
        border-radius: 16px 16px 0 0;
        padding: 1.25rem 1.5rem 1.5rem;
        max-height: 70vh; overflow-y: auto;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
        box-shadow: 0 -8px 32px rgba(0,0,0,0.3);
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <h3 style="margin:0;font-size:1rem;font-weight:600;color:var(--r-text, var(--text-primary, #E5E7EB));">
            ${t('bugReport.drawerTitle', 'Report an Issue')}
          </h3>
          <button data-bug-drawer-close style="background:none;border:none;color:var(--r-text-muted,#6B7280);cursor:pointer;font-size:1.25rem;padding:0.25rem;line-height:1;">&times;</button>
        </div>

        <!-- Auth guard (hidden by default, shown if not logged in) -->
        <div class="bug-drawer__auth-guard" data-bug-auth-guard style="display:none;text-align:center;padding:2rem 1rem;">
          <p style="color:var(--r-text-muted,#6B7280);margin:0 0 1rem;">
            ${t('bugReport.loginRequired', 'Sign in to report bugs and earn free report unlocks')}
          </p>
          <a href="/login.html" style="color:var(--brand-red,#E03E3E);text-decoration:none;font-weight:600;">
            ${t('bugReport.signIn', 'Sign In')}
          </a>
        </div>

        <!-- Form (hidden if not logged in) -->
        <form class="bug-drawer__form" data-bug-form>
          <!-- Context pills -->
          <div data-bug-context style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;"></div>

          <!-- Category chips -->
          <p style="font-size:0.8125rem;color:var(--r-text-muted,#6B7280);margin:0 0 0.5rem;">
            ${t('bugReport.categoryLabel', 'What type of issue?')}
          </p>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;">
            ${categoryChips}
          </div>

          <!-- Description -->
          <div style="position:relative;">
            <textarea data-bug-description
              placeholder="${t('bugReport.descriptionPlaceholder', 'Describe what\'s wrong (minimum 30 characters)...')}"
              rows="3"
              style="
                width: 100%; box-sizing: border-box;
                background: var(--r-surface-2, var(--bg-secondary, #1C2128));
                border: 1px solid var(--r-border, var(--border-color, #2D333B));
                border-radius: 8px; padding: 0.75rem;
                color: var(--r-text, var(--text-primary, #E5E7EB));
                font-family: inherit; font-size: 0.875rem;
                resize: vertical; min-height: 80px;
              "
            ></textarea>
            <span data-bug-char-count style="
              position: absolute; bottom: 0.5rem; right: 0.75rem;
              font-size: 0.75rem; color: var(--r-text-faint, #4B5563);
            ">0/${MIN_CHARS} min</span>
          </div>

          <!-- Submit -->
          <button type="submit" data-bug-submit disabled style="
            margin-top: 0.75rem; width: 100%;
            padding: 0.625rem 1rem;
            background: var(--brand-red, #E03E3E); color: #fff;
            border: none; border-radius: 8px;
            font-size: 0.875rem; font-weight: 600;
            cursor: pointer; opacity: 0.5;
            transition: opacity 0.15s;
          ">
            ${t('bugReport.submitBtn', 'Submit Report')}
          </button>
        </form>

        <!-- Success state (hidden by default) -->
        <div class="bug-drawer__success" data-bug-success style="display:none;text-align:center;padding:1.5rem 0;">
          <div style="font-size:2.5rem;margin-bottom:0.75rem;">&#10003;</div>
          <h4 style="color:var(--r-text,#E5E7EB);margin:0 0 0.5rem;font-size:1rem;">
            ${t('bugReport.successTitle', 'Report Submitted!')}
          </h4>
          <p style="color:var(--r-text-muted,#6B7280);margin:0;font-size:0.875rem;">
            ${t('bugReport.successMsg', 'You\'ll earn a free report unlock if we confirm this bug.')}
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Get auto-captured context from the page
   */
  function captureContext() {
    const body = document.body;
    return {
      reportId: body.getAttribute('data-report-id') || body.getAttribute('data-sm-report-id') || null,
      analyzerType: (window.SM_ANALYZER_KEY || body.getAttribute('data-sm-analyzer-type') || '').replace(/-/g, '_') || null,
      scannedUrl: body.getAttribute('data-sm-scanned-url') || document.querySelector('#urlInput')?.value || null,
      browserInfo: navigator.userAgent,
      contextJson: JSON.stringify({
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        locale: document.documentElement.lang || navigator.language,
        theme: body.classList.contains('dark-mode') ? 'dark' : 'light',
        timestamp: new Date().toISOString()
      })
    };
  }

  /**
   * Check if user is logged in
   */
  function isLoggedIn() {
    try {
      return !!(localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token'));
    } catch (_) {
      return false;
    }
  }

  /**
   * Open the drawer
   */
  function openDrawer() {
    if (_drawerOpen) return;
    _drawerOpen = true;

    // Inject drawer if not already present
    let drawer = document.querySelector('[data-bug-drawer]');
    if (!drawer) {
      const container = document.createElement('div');
      container.id = 'bug-drawer-container';
      container.innerHTML = renderDrawer();
      document.body.appendChild(container);
      drawer = document.querySelector('[data-bug-drawer]');
    }

    // Show auth guard or form
    const authGuard = document.querySelector('[data-bug-auth-guard]');
    const form = document.querySelector('[data-bug-form]');
    const success = document.querySelector('[data-bug-success]');
    if (isLoggedIn()) {
      if (authGuard) authGuard.style.display = 'none';
      if (form) form.style.display = '';
    } else {
      if (authGuard) authGuard.style.display = '';
      if (form) form.style.display = 'none';
    }
    if (success) success.style.display = 'none';

    // Populate context pills
    const ctx = captureContext();
    const contextDiv = document.querySelector('[data-bug-context]');
    if (contextDiv) {
      const pills = [];
      if (ctx.analyzerType) {
        pills.push(`<span style="
          background:var(--r-surface-2,rgba(255,255,255,0.08));
          border:1px solid var(--r-border,#2D333B);
          border-radius:12px;padding:0.25rem 0.625rem;
          font-size:0.75rem;color:var(--r-text-muted,#6B7280);
        ">${ctx.analyzerType.replace(/_/g, ' ')}</span>`);
      }
      if (ctx.scannedUrl) {
        const short = ctx.scannedUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        pills.push(`<span style="
          background:var(--r-surface-2,rgba(255,255,255,0.08));
          border:1px solid var(--r-border,#2D333B);
          border-radius:12px;padding:0.25rem 0.625rem;
          font-size:0.75rem;color:var(--r-text-muted,#6B7280);
          max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        ">${short}</span>`);
      }
      contextDiv.innerHTML = pills.join('');
    }

    // Animate in
    const backdrop = document.querySelector('[data-bug-drawer-backdrop]');
    requestAnimationFrame(() => {
      if (backdrop) { backdrop.style.opacity = '1'; backdrop.style.pointerEvents = 'auto'; }
      if (drawer) drawer.style.transform = 'translateY(0)';
    });
  }

  /**
   * Close the drawer
   */
  function closeDrawer() {
    if (!_drawerOpen) return;
    _drawerOpen = false;

    const drawer = document.querySelector('[data-bug-drawer]');
    const backdrop = document.querySelector('[data-bug-drawer-backdrop]');
    if (drawer) drawer.style.transform = 'translateY(100%)';
    if (backdrop) { backdrop.style.opacity = '0'; backdrop.style.pointerEvents = 'none'; }

    // Reset form state after animation
    setTimeout(() => {
      const form = document.querySelector('[data-bug-form]');
      if (form) form.reset();
      document.querySelectorAll('.bug-drawer__chip').forEach(c => c.classList.remove('active'));
      const charCount = document.querySelector('[data-bug-char-count]');
      if (charCount) charCount.textContent = `0/${MIN_CHARS} min`;
      const submitBtn = document.querySelector('[data-bug-submit]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }
    }, 300);
  }

  /**
   * Validate form and toggle submit button
   */
  function validateForm() {
    const selectedCat = document.querySelector('.bug-drawer__chip.active');
    const desc = document.querySelector('[data-bug-description]');
    const submitBtn = document.querySelector('[data-bug-submit]');
    const charCount = document.querySelector('[data-bug-char-count]');

    const len = (desc?.value || '').trim().length;
    if (charCount) {
      charCount.textContent = len >= MIN_CHARS ? `${len} chars` : `${len}/${MIN_CHARS} min`;
      charCount.style.color = len >= MIN_CHARS ? 'var(--green-500, #22c55e)' : 'var(--r-text-faint, #4B5563)';
    }

    const valid = !!selectedCat && len >= MIN_CHARS;
    if (submitBtn) {
      submitBtn.disabled = !valid;
      submitBtn.style.opacity = valid ? '1' : '0.5';
    }
  }

  /**
   * Submit the bug report
   */
  async function submitReport() {
    const selectedCat = document.querySelector('.bug-drawer__chip.active');
    const desc = document.querySelector('[data-bug-description]');
    const submitBtn = document.querySelector('[data-bug-submit]');

    if (!selectedCat || !desc) return;

    const ctx = captureContext();
    const payload = {
      reportId: ctx.reportId,
      analyzerType: ctx.analyzerType,
      scannedUrl: ctx.scannedUrl,
      category: selectedCat.getAttribute('data-bug-category'),
      description: desc.value.trim(),
      browserInfo: ctx.browserInfo,
      contextJson: ctx.contextJson
    };

    // Disable button during submit
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '...'; }

    try {
      const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
      const res = await fetch('/api/bugs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      // Show success
      const form = document.querySelector('[data-bug-form]');
      const success = document.querySelector('[data-bug-success]');
      if (form) form.style.display = 'none';
      if (success) success.style.display = '';

      // Auto-close after 3s
      setTimeout(() => closeDrawer(), 3000);

    } catch (err) {
      // Show error inline
      if (submitBtn) {
        submitBtn.textContent = err.message;
        submitBtn.style.background = 'var(--red-500, #ef4444)';
        setTimeout(() => {
          submitBtn.textContent = t('bugReport.submitBtn', 'Submit Report');
          submitBtn.style.background = 'var(--brand-red, #E03E3E)';
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
        }, 3000);
      }
    }
  }

  /**
   * Initialize event delegation
   */
  function initListeners() {
    document.addEventListener('click', (e) => {
      // Open drawer
      if (e.target.closest('[data-bug-report-open]')) {
        e.preventDefault();
        openDrawer();
        return;
      }

      // Close drawer
      if (e.target.closest('[data-bug-drawer-close]') || e.target.matches('[data-bug-drawer-backdrop]')) {
        e.preventDefault();
        closeDrawer();
        return;
      }

      // Category chip selection
      const chip = e.target.closest('.bug-drawer__chip');
      if (chip) {
        document.querySelectorAll('.bug-drawer__chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        validateForm();
        return;
      }
    });

    // Description input
    document.addEventListener('input', (e) => {
      if (e.target.matches('[data-bug-description]')) {
        validateForm();
      }
    });

    // Form submit
    document.addEventListener('submit', (e) => {
      if (e.target.matches('[data-bug-form]')) {
        e.preventDefault();
        submitReport();
      }
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _drawerOpen) {
        closeDrawer();
      }
    });
  }

  /**
   * Inject the trigger into the results container
   */
  function injectTrigger() {
    // Don't inject twice
    if (document.querySelector('.bug-report-trigger')) return;

    const container = document.getElementById('resultsContent') || document.querySelector('.report-results');
    if (!container) return;

    // Try to insert before the ProReportBlock unlock area so it's visible mid-report
    const proBlock = container.querySelector('.pro-report-block__unlock-prompt, [data-locked-overlay]');
    const triggerDiv = document.createElement('div');
    triggerDiv.innerHTML = renderTrigger();
    const triggerEl = triggerDiv.firstElementChild;

    if (proBlock) {
      // Insert before the first unlock prompt
      proBlock.parentElement.insertBefore(triggerEl, proBlock);
    } else {
      container.appendChild(triggerEl);
    }
  }

  // Auto-inject on report:ready (covers both window and document dispatches)
  window.addEventListener('report:ready', () => { setTimeout(injectTrigger, 200); });
  document.addEventListener('report:ready', () => { setTimeout(injectTrigger, 200); });

  // Fallback: watch for report content appearing in DOM
  // Some pages dispatch report:ready before this script loads, or use custom flows
  function watchForResults() {
    const container = document.getElementById('resultsContent') || document.querySelector('.report-results');
    if (!container) return;

    // If content already exists (page reload / cached), inject immediately
    if (container.children.length > 0 && !document.querySelector('.bug-report-trigger')) {
      setTimeout(injectTrigger, 500);
    }

    // Watch for future content changes
    const observer = new MutationObserver(() => {
      if (container.children.length > 0 && !document.querySelector('.bug-report-trigger')) {
        setTimeout(injectTrigger, 300);
      }
    });
    observer.observe(container, { childList: true });
  }

  // Initialize listeners on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initListeners(); watchForResults(); });
  } else {
    initListeners();
    watchForResults();
  }

  // Inject chip styles
  const style = document.createElement('style');
  style.textContent = `
    .bug-drawer__chip {
      background: var(--r-surface-2, rgba(255,255,255,0.08));
      border: 1px solid var(--r-border, #2D333B);
      border-radius: 16px;
      padding: 0.375rem 0.875rem;
      font-size: 0.8125rem;
      color: var(--r-text-muted, #6B7280);
      cursor: pointer;
      transition: all 0.15s;
    }
    .bug-drawer__chip:hover {
      border-color: var(--r-text-muted, #6B7280);
      color: var(--r-text, #E5E7EB);
    }
    .bug-drawer__chip.active {
      background: var(--brand-red, #E03E3E);
      border-color: var(--brand-red, #E03E3E);
      color: #fff;
    }
  `;
  document.head.appendChild(style);

  // Public API
  window.BugReportButton = {
    injectTrigger,
    openDrawer,
    closeDrawer
  };

})(window);
