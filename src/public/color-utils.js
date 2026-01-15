/**
 * Color System Utilities
 * Provides helper functions for working with the unified CSS variable color system
 */

/**
 * Get a CSS variable value from the current theme
 * @param {string} varName - The CSS variable name (with or without --)
 * @returns {string} The computed color value
 */
function getThemeColor(varName) {
  // Add -- prefix if not provided
  const cssVar = varName.startsWith('--') ? varName : `--${varName}`;
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar).trim();
}

/**
 * Get the appropriate score class based on a numerical score
 * @param {number} score - Score value (0-100)
 * @returns {string} CSS class name
 */
function getScoreClass(score) {
  if (score >= 90) return 'score-excellent';
  if (score >= 70) return 'score-good';
  if (score >= 50) return 'score-fair';
  return 'score-poor';
}

/**
 * Get the appropriate score color based on a numerical score
 * @param {number} score - Score value (0-100)
 * @returns {string} CSS variable name
 */
function getScoreColor(score) {
  if (score >= 90) return 'var(--score-excellent)';
  if (score >= 70) return 'var(--score-good)';
  if (score >= 50) return 'var(--score-fair)';
  return 'var(--score-poor)';
}

/**
 * Get score color with fallback for themes that may not have CSS variables loaded
 * Traditional traffic light system
 * A grades (90-100): Green
 * B grades (70-89): Yellow
 * C grades (50-69): Orange
 * Below C (<50): Red
 * @param {number} score - Score value (0-100)
 * @returns {string} Color hex value
 */
function getScoreColorFallback(score) {
  if (score >= 90) return getThemeColor('--accent-primary') || '#00ff41';
  if (score >= 70) return '#ffd700';  // B: Yellow (gold)
  if (score >= 50) return '#ff8c00';  // C: Dark orange
  return '#ff4444';                   // D/F: Red
}

/**
 * Apply theme-aware inline styles to an element
 * @param {HTMLElement} element - The element to style
 * @param {Object} styles - Style properties to apply (supports CSS variables)
 */
function applyThemeStyles(element, styles) {
  Object.entries(styles).forEach(([property, value]) => {
    element.style[property] = value;
  });
}

/**
 * Create a styled element with theme-aware colors
 * @param {string} tag - HTML tag name
 * @param {Object} options - Configuration object
 * @param {string} options.className - CSS class names
 * @param {string} options.textContent - Text content
 * @param {Object} options.styles - Inline styles (use CSS variables)
 * @returns {HTMLElement}
 */
function createThemedElement(tag, { className = '', textContent = '', styles = {} } = {}) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  applyThemeStyles(element, styles);
  return element;
}

/**
 * Check if current theme is light mode
 * @returns {boolean}
 */
function isLightTheme() {
  return document.body.classList.contains('white-theme');
}

/**
 * Get status color CSS variable
 * @param {string} status - 'success', 'warning', 'error', or 'info'
 * @returns {string} CSS variable
 */
function getStatusColor(status) {
  const statusMap = {
    success: 'var(--status-success)',
    warning: 'var(--status-warning)',
    error: 'var(--status-error)',
    info: 'var(--status-info)'
  };
  return statusMap[status] || 'var(--text-secondary)';
}

/**
 * Legacy color mapping for gradual migration
 * Maps old hardcoded colors to new CSS variables
 */
const COLOR_MIGRATION_MAP = {
  // Greens (terminal accent)
  '#00ff41': 'var(--accent-primary)',
  '#00ff88': 'var(--accent-primary)',
  '#00cc33': 'var(--accent-primary-dark)',
  '#00cc66': 'var(--accent-primary-dark)',
  
  // Purples (secondary accent)
  '#bb86fc': 'var(--accent-secondary)',
  '#9d5fdb': 'var(--accent-secondary-dark)',
  
  // Blacks/Dark backgrounds
  '#000000': 'var(--bg-primary)',
  '#111111': 'var(--bg-secondary)',
  '#1a1a1a': 'var(--bg-tertiary)',
  '#0a0a0a': 'var(--bg-input)',
  
  // Whites/Light text
  '#ffffff': 'var(--text-primary)',
  '#f5f5f5': 'var(--text-primary)',
  '#e0e0e0': 'var(--text-secondary)',
  '#d0d0d0': 'var(--text-secondary)',
  '#c0c0c0': 'var(--text-tertiary)',
  '#b0b0b0': 'var(--text-tertiary)',
  '#a0a0a0': 'var(--text-tertiary)',
  '#808080': 'var(--text-muted)',
  '#909090': 'var(--text-muted)',
  
  // Status colors
  '#ff4444': 'var(--status-error)',
  '#ff6b6b': 'var(--status-error)',
  '#ffa500': 'var(--status-warning)',
  '#ff6600': 'var(--status-warning)',
  '#00d9ff': 'var(--status-info)',
  
  // Borders
  '#333333': 'var(--border-primary)',
  '#404040': 'var(--border-primary)',
  '#555555': 'var(--border-secondary)',
  '#505050': 'var(--border-secondary)',
  '#707070': 'var(--border-secondary)'
};

/**
 * Migrate a color from old hex to new CSS variable
 * @param {string} color - Hex color code
 * @returns {string} CSS variable or original color if no mapping exists
 */
function migrateColor(color) {
  return COLOR_MIGRATION_MAP[color.toLowerCase()] || color;
}

// Export for use in modules (if using ES6 modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getThemeColor,
    getScoreClass,
    getScoreColor,
    getScoreColorFallback,
    applyThemeStyles,
    createThemedElement,
    isLightTheme,
    getStatusColor,
    migrateColor,
    COLOR_MIGRATION_MAP
  };
}
