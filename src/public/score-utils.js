/**
 * Site Mechanic - Unified Scoring Utilities
 * Normalizes all scores to 0-100 with consistent status labels
 * 
 * SCORE STANDARD:
 *   90-100: Excellent (green)
 *   75-89:  Good (blue/teal)
 *   50-74:  Needs Work (yellow/orange)
 *   0-49:   Critical (red)
 * 
 * Each score should answer:
 *   1. What does this mean?
 *   2. Why does it matter?
 *   3. What should I do next?
 * 
 * Usage: Include this script before analyzer scripts
 * <script src="/score-utils.js"></script>
 */

const ScoreUtils = {
  /**
   * Standard score thresholds and labels
   */
  SCORE_THRESHOLDS: {
    EXCELLENT: 90,  // 90-100: Excellent
    GOOD: 75,       // 75-89: Good
    NEEDS_WORK: 50, // 50-74: Needs Work
    CRITICAL: 0     // 0-49: Critical
  },

  /**
   * Convert numeric score (0-100) to status label
   * @param {number} score - Score from 0-100
   * @returns {string} Status label (Excellent, Good, Needs Work, Critical)
   */
  getStatus(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Needs Work';
    return 'Critical';
  },

  /**
   * @deprecated Use getStatus() instead. Kept for backward compatibility.
   */
  getGrade(score) {
    return this.getStatus(score);
  },

  /**
   * Get status color based on score
   * @param {number} score - Score from 0-100
   * @returns {string} CSS color value
   */
  getStatusColor(score) {
    if (score >= 90) return 'var(--color-success, #00ff41)';    // Excellent: Green
    if (score >= 75) return 'var(--color-info, #00bcd4)';       // Good: Teal/Cyan
    if (score >= 50) return 'var(--color-warning, #ffa500)';    // Needs Work: Orange
    return 'var(--color-error, #ff4444)';                       // Critical: Red
  },

  /**
   * @deprecated Use getStatusColor() instead.
   */
  getGradeColor(score) {
    return this.getStatusColor(score);
  },

  /**
   * Get status label for display (same as getStatus)
   * @param {number} score - Score from 0-100
   * @returns {string} Human-readable label
   */
  getStatusLabel(score) {
    return this.getStatus(score);
  },

  /**
   * @deprecated Use getStatusLabel() instead.
   */
  getGradeLabel(score) {
    return this.getStatus(score);
  },

  /**
   * Get CSS class for status styling
   * @param {number} score - Score from 0-100
   * @returns {string} CSS class name
   */
  getStatusClass(score) {
    if (score >= 90) return 'status-excellent';
    if (score >= 75) return 'status-good';
    if (score >= 50) return 'status-needs-work';
    return 'status-critical';
  },

  /**
   * @deprecated Use getStatusClass() instead.
   */
  getGradeClass(score) {
    return this.getStatusClass(score);
  },

  /**
   * Normalize any score to 0-100 range
   * @param {number} value - Raw value
   * @param {number} min - Minimum possible value
   * @param {number} max - Maximum possible value
   * @returns {number} Normalized score 0-100
   */
  normalize(value, min = 0, max = 100) {
    if (max === min) return 0;
    const normalized = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, Math.round(normalized)));
  },

  /**
   * Calculate weighted average of multiple scores
   * @param {Array<{score: number, weight: number}>} scores - Array of score objects
   * @returns {number} Weighted average score
   */
  weightedAverage(scores) {
    const validScores = scores.filter(s => typeof s.score === 'number' && !isNaN(s.score));
    if (validScores.length === 0) return 0;
    
    const totalWeight = validScores.reduce((sum, s) => sum + (s.weight || 1), 0);
    const weightedSum = validScores.reduce((sum, s) => sum + (s.score * (s.weight || 1)), 0);
    
    return Math.round(weightedSum / totalWeight);
  },

  /**
   * Render a score badge HTML
   * Shows: numeric score + status label
   * @param {number} score - Score from 0-100
   * @param {object} options - Display options
   * @returns {string} HTML string for score badge
   */
  renderBadge(score, options = {}) {
    const { showStatus = true, showLabel = false, size = 'medium' } = options;
    const status = this.getStatus(score);
    const color = this.getStatusColor(score);
    const statusClass = this.getStatusClass(score);
    
    const sizeClass = size === 'small' ? 'score-badge--sm' : size === 'large' ? 'score-badge--lg' : '';
    
    return `
      <div class="score-badge ${statusClass} ${sizeClass}" style="--score-color: ${color};">
        <span class="score-badge__value">${score}</span>
        ${showStatus ? `<span class="score-badge__status">${status}</span>` : ''}
        ${showLabel ? `<span class="score-badge__label">${status}</span>` : ''}
      </div>
    `;
  },

  /**
   * Render a score ring/dial HTML
   * Shows: numeric score in center + status label below
   * @param {number} score - Score from 0-100
   * @param {object} options - Display options
   * @returns {string} HTML string for score ring
   */
  renderRing(score, options = {}) {
    const { size = 120, strokeWidth = 8, showStatus = true } = options;
    const status = this.getStatus(score);
    const color = this.getStatusColor(score);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    
    return `
      <div class="score-ring" style="width: ${size}px; height: ${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle 
            cx="${size/2}" cy="${size/2}" r="${radius}"
            fill="none" 
            stroke="rgba(255,255,255,0.1)" 
            stroke-width="${strokeWidth}"
          />
          <circle 
            cx="${size/2}" cy="${size/2}" r="${radius}"
            fill="none" 
            stroke="${color}" 
            stroke-width="${strokeWidth}"
            stroke-linecap="round"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"
            transform="rotate(-90 ${size/2} ${size/2})"
            style="transition: stroke-dashoffset 0.5s ease;"
          />
        </svg>
        <div class="score-ring__content">
          <span class="score-ring__value" style="color: ${color};">${score}</span>
          ${showStatus ? `<span class="score-ring__status">${status}</span>` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Format score for display with trend indicator
   * @param {number} current - Current score
   * @param {number} previous - Previous score (optional)
   * @returns {object} Formatted score object with status labels
   */
  formatWithTrend(current, previous = null) {
    const result = {
      score: current,
      status: this.getStatus(current),
      color: this.getStatusColor(current),
      label: this.getStatusLabel(current)
    };
    
    if (previous !== null) {
      const diff = current - previous;
      result.trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable';
      result.trendValue = Math.abs(diff);
      result.trendIcon = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
    }
    
    return result;
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScoreUtils;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ScoreUtils = ScoreUtils;
}
