/**
 * Interactive Recommendations System
 * Makes recommendations actionable with click-to-copy, expandable details, and visual feedback
 */

class InteractiveRecommendations {
  constructor() {
    this.setupGlobalStyles();
  }

  /**
   * Create an interactive recommendation card
   * @param {Object} options - Recommendation configuration
   * @param {string} options.title - Recommendation title
   * @param {string} options.description - Description text
   * @param {string} options.priority - 'high', 'medium', 'low'
   * @param {string} options.category - 'performance', 'seo', 'accessibility', etc.
   * @param {Object} options.action - Action configuration
   * @returns {HTMLElement}
   */
  createRecommendation({ title, description, priority = 'medium', category = 'general', action }) {
    const card = document.createElement('div');
    card.className = `interactive-recommendation priority-${priority} category-${category}`;

    const priorityIcons = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const categoryIcons = {
      performance: '⚡',
      seo: '🔍',
      accessibility: '♿',
      fonts: '🔤',
      security: '🔒',
      general: '💡'
    };

    card.innerHTML = `
      <div class="rec-header">
        <div class="rec-priority">
          <span class="priority-icon">${priorityIcons[priority]}</span>
          <span class="priority-text">${priority.toUpperCase()}</span>
        </div>
        <div class="rec-category">
          <span class="category-icon">${categoryIcons[category] || '💡'}</span>
          <span class="category-text">${category}</span>
        </div>
      </div>
      <div class="rec-body">
        <h4 class="rec-title">${title}</h4>
        <p class="rec-description">${description}</p>
      </div>
      <div class="rec-footer">
        ${action ? this.createActionButtons(action) : ''}
      </div>
    `;

    return card;
  }

  /**
   * Create action buttons for a recommendation
   * @param {Object} action - Action configuration
   * @returns {string} HTML string
   */
  createActionButtons(action) {
    let buttons = '';

    if (action.code) {
      buttons += `
        <button class="rec-action-btn btn-copy" data-code="${this.escapeHtml(action.code)}">
          📋 Copy Code
        </button>
      `;
    }

    if (action.showFiles) {
      buttons += `
        <button class="rec-action-btn btn-show-files" data-files='${JSON.stringify(action.files || [])}'>
          📂 Show Files (${action.files?.length || 0})
        </button>
      `;
    }

    if (action.learnMore) {
      buttons += `
        <a href="${action.learnMore}" target="_blank" rel="noopener" class="rec-action-btn btn-learn">
          📚 Learn More
        </a>
      `;
    }

    if (action.custom) {
      buttons += `
        <button class="rec-action-btn btn-custom" data-action="${action.custom.id}">
          ${action.custom.icon || '➡️'} ${action.custom.label}
        </button>
      `;
    }

    return buttons;
  }

  /**
   * Create a "Copy Code" snippet box
   * @param {string} code - Code to display and copy
   * @param {string} language - Code language (css, js, html)
   * @returns {HTMLElement}
   */
  createCodeSnippet(code, language = 'css') {
    const container = document.createElement('div');
    container.className = 'code-snippet-container';

    container.innerHTML = `
      <div class="code-snippet-header">
        <span class="code-language">${language.toUpperCase()}</span>
        <button class="code-copy-btn" data-code="${this.escapeHtml(code)}">
          📋 Copy
        </button>
      </div>
      <pre class="code-snippet-body"><code class="language-${language}">${this.escapeHtml(code)}</code></pre>
    `;

    const copyBtn = container.querySelector('.code-copy-btn');
    copyBtn.addEventListener('click', () => this.copyToClipboard(code, copyBtn));

    return container;
  }

  /**
   * Create an expandable file list
   * @param {Array} files - Array of {name, size, path, recommendation} objects
   * @param {string} title - Section title
   * @returns {HTMLElement}
   */
  createFileList(files, title = 'Affected Files') {
    const container = document.createElement('div');
    container.className = 'file-list-container';

    container.innerHTML = `
      <div class="file-list-header">
        <h4>${title} (${files.length})</h4>
        <button class="file-list-toggle">▼</button>
      </div>
      <div class="file-list-body">
        ${files.map(file => `
          <div class="file-item">
            <div class="file-icon">📄</div>
            <div class="file-info">
              <div class="file-name">${file.name || file}</div>
              ${file.size ? `<div class="file-size">${this.formatFileSize(file.size)}</div>` : ''}
              ${file.recommendation ? `<div class="file-recommendation">${file.recommendation}</div>` : ''}
            </div>
            ${file.path ? `<button class="file-action" data-path="${file.path}">📋 Copy Path</button>` : ''}
          </div>
        `).join('')}
      </div>
    `;

    const toggle = container.querySelector('.file-list-toggle');
    const body = container.querySelector('.file-list-body');

    toggle.addEventListener('click', () => {
      body.classList.toggle('expanded');
      toggle.textContent = body.classList.contains('expanded') ? '▲' : '▼';
    });

    // Add copy path functionality
    container.querySelectorAll('.file-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.getAttribute('data-path');
        this.copyToClipboard(path, btn);
      });
    });

    return container;
  }

  /**
   * Create optimization suggestions with before/after comparison
   * @param {Object} options - {before, after, metric, improvement}
   * @returns {HTMLElement}
   */
  createBeforeAfter({ before, after, metric, improvement }) {
    const container = document.createElement('div');
    container.className = 'before-after-comparison';

    const improvementPercent = ((before - after) / before * 100).toFixed(1);

    container.innerHTML = `
      <div class="comparison-grid">
        <div class="comparison-item before">
          <div class="comparison-label">❌ Before</div>
          <div class="comparison-value">${before}</div>
          <div class="comparison-metric">${metric}</div>
        </div>
        <div class="comparison-arrow">
          <div class="arrow-icon">→</div>
          <div class="improvement-badge">
            ${improvementPercent > 0 ? '↓' : '↑'} ${Math.abs(improvementPercent)}%
          </div>
        </div>
        <div class="comparison-item after">
          <div class="comparison-label">✅ After</div>
          <div class="comparison-value">${after}</div>
          <div class="comparison-metric">${metric}</div>
        </div>
      </div>
      ${improvement ? `<div class="comparison-note">${improvement}</div>` : ''}
    `;

    return container;
  }

  /**
   * Copy text to clipboard with visual feedback
   * @param {string} text - Text to copy
   * @param {HTMLElement} button - Button that triggered the copy
   */
  async copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      
      const originalText = button.innerHTML;
      button.innerHTML = '✅ Copied!';
      button.classList.add('copied');

      setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove('copied');
      }, 2000);

      this.showToast('Copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      this.showToast('Failed to copy. Please try manually.', 'error');
    }
  }

  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {string} type - 'success', 'error', 'info'
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `interactive-toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Format file size
   * @param {number} bytes - File size in bytes
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} html - HTML string to escape
   * @returns {string}
   */
  escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Setup global styles for interactive recommendations
   */
  setupGlobalStyles() {
    if (document.getElementById('interactive-rec-styles')) return;

    const style = document.createElement('style');
    style.id = 'interactive-rec-styles';
    style.textContent = `
      /* Interactive Recommendation Cards */
      .interactive-recommendation {
        background: var(--bg-tertiary);
        border: 2px solid var(--border-primary);
        border-radius: var(--radius-xl);
        padding: var(--spacing-lg);
        margin: var(--spacing-md) 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }

      .interactive-recommendation::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        width: 4px;
        height: 100%;
        transition: width 0.3s ease;
      }

      .interactive-recommendation.priority-high::before { background: var(--status-error); }
      .interactive-recommendation.priority-medium::before { background: var(--status-warning); }
      .interactive-recommendation.priority-low::before { background: var(--status-success); }

      .interactive-recommendation:hover {
        transform: translateX(5px);
        box-shadow: var(--shadow-xl);
        border-color: var(--accent-primary);
      }

      .interactive-recommendation:hover::before {
        width: 8px;
      }

      .rec-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-sm);
      }

      .rec-priority, .rec-category {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .priority-icon, .category-icon {
        font-size: 1rem;
      }

      .rec-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 var(--spacing-sm);
      }

      .rec-description {
        color: var(--text-secondary);
        line-height: 1.6;
        margin: 0;
      }

      .rec-footer {
        display: flex;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-md);
        padding-top: var(--spacing-md);
        border-top: 1px solid var(--border-primary);
        flex-wrap: wrap;
      }

      .rec-action-btn {
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-secondary);
        padding: 0.6rem 1.2rem;
        border-radius: var(--radius-md);
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .rec-action-btn:hover {
        background: var(--accent-primary);
        color: var(--bg-primary);
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }

      .rec-action-btn.copied {
        background: var(--status-success);
        color: var(--bg-primary);
      }

      /* Code Snippets */
      .code-snippet-container {
        background: var(--bg-input);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-lg);
        margin: var(--spacing-md) 0;
        overflow: hidden;
      }

      .code-snippet-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-primary);
      }

      .code-language {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--accent-primary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .code-copy-btn {
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--border-primary);
        padding: 0.4rem 0.8rem;
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .code-copy-btn:hover {
        background: var(--accent-primary);
        color: var(--bg-primary);
        border-color: var(--accent-primary);
      }

      .code-snippet-body {
        padding: var(--spacing-md);
        margin: 0;
        overflow-x: auto;
      }

      .code-snippet-body code {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.85rem;
        line-height: 1.6;
        color: var(--text-secondary);
      }

      /* File Lists */
      .file-list-container {
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-lg);
        margin: var(--spacing-md) 0;
        overflow: hidden;
      }

      .file-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-md);
        background: var(--bg-tertiary);
        border-bottom: 1px solid var(--border-primary);
        cursor: pointer;
      }

      .file-list-header h4 {
        margin: 0;
        font-size: 0.95rem;
        color: var(--text-primary);
      }

      .file-list-toggle {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 1rem;
        cursor: pointer;
        transition: transform 0.3s ease;
      }

      .file-list-body {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
      }

      .file-list-body.expanded {
        max-height: 500px;
        overflow-y: auto;
      }

      .file-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        border-bottom: 1px solid var(--border-primary);
        transition: background 0.2s ease;
      }

      .file-item:last-child {
        border-bottom: none;
      }

      .file-item:hover {
        background: var(--bg-hover);
      }

      .file-icon {
        font-size: 1.5rem;
      }

      .file-info {
        flex: 1;
      }

      .file-name {
        font-weight: 600;
        color: var(--text-primary);
        font-size: 0.9rem;
      }

      .file-size {
        font-size: 0.75rem;
        color: var(--text-tertiary);
      }

      .file-recommendation {
        font-size: 0.8rem;
        color: var(--status-warning);
        margin-top: 0.25rem;
      }

      .file-action {
        background: transparent;
        border: 1px solid var(--border-primary);
        color: var(--text-secondary);
        padding: 0.4rem 0.8rem;
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .file-action:hover {
        background: var(--accent-primary);
        color: var(--bg-primary);
        border-color: var(--accent-primary);
      }

      /* Before/After Comparison */
      .before-after-comparison {
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: var(--radius-xl);
        padding: var(--spacing-lg);
        margin: var(--spacing-md) 0;
      }

      .comparison-grid {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: var(--spacing-lg);
        align-items: center;
      }

      .comparison-item {
        text-align: center;
        padding: var(--spacing-md);
        border-radius: var(--radius-lg);
        border: 2px solid;
      }

      .comparison-item.before {
        background: rgba(255, 68, 68, 0.1);
        border-color: var(--status-error);
      }

      .comparison-item.after {
        background: rgba(0, 255, 65, 0.1);
        border-color: var(--status-success);
      }

      .comparison-label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.5rem;
      }

      .comparison-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0.5rem 0;
      }

      .comparison-metric {
        font-size: 0.85rem;
        color: var(--text-tertiary);
      }

      .comparison-arrow {
        text-align: center;
      }

      .arrow-icon {
        font-size: 2rem;
        color: var(--accent-primary);
        margin-bottom: 0.5rem;
      }

      .improvement-badge {
        background: var(--status-success);
        color: var(--bg-primary);
        padding: 0.5rem 1rem;
        border-radius: var(--radius-md);
        font-weight: 700;
        font-size: 0.9rem;
      }

      .comparison-note {
        margin-top: var(--spacing-md);
        padding-top: var(--spacing-md);
        border-top: 1px solid var(--border-primary);
        text-align: center;
        color: var(--text-secondary);
        font-size: 0.9rem;
      }

      /* Toast Notifications */
      .interactive-toast {
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: var(--bg-secondary);
        color: var(--text-primary);
        padding: 1rem 1.5rem;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-primary);
        box-shadow: var(--shadow-xl);
        z-index: 10000;
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .interactive-toast.show {
        transform: translateY(0);
        opacity: 1;
      }

      .interactive-toast.toast-success {
        border-color: var(--status-success);
        background: linear-gradient(135deg, rgba(0, 255, 65, 0.1), var(--bg-secondary));
      }

      .interactive-toast.toast-error {
        border-color: var(--status-error);
        background: linear-gradient(135deg, rgba(255, 68, 68, 0.1), var(--bg-secondary));
      }

      /* Responsive */
      @media (max-width: 768px) {
        .comparison-grid {
          grid-template-columns: 1fr;
          gap: var(--spacing-sm);
        }

        .comparison-arrow {
          transform: rotate(90deg);
        }

        .rec-footer {
          flex-direction: column;
        }

        .rec-action-btn {
          width: 100%;
          justify-content: center;
        }
      }
    `;

    document.head.appendChild(style);
  }
}

// Initialize and export
const interactiveRecs = new InteractiveRecommendations();

// Make available globally
window.InteractiveRecommendations = InteractiveRecommendations;
window.interactiveRecs = interactiveRecs;
