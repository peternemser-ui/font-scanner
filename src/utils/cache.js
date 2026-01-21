/**
 * Simple in-memory cache with TTL support
 * @module cache
 */

const { createLogger } = require('./logger');

const logger = createLogger('Cache');

class Cache {
  constructor(ttl = 3600000, maxEntries = 500) {
    // Default 1 hour, max 500 entries
    this.cache = new Map();
    this.ttl = ttl;
    this.maxEntries = maxEntries;
  }

  /**
   * Generate cache key from URL and options
   * @private
   */
  _generateKey(url, options = {}) {
    const optionsStr = JSON.stringify(options);
    return `${url}:${optionsStr}`;
  }

  /**
   * Check if cache entry is expired
   * @private
   */
  _isExpired(entry) {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Set a value in cache
   * @param {string} url - The URL being cached
   * @param {*} value - The value to cache
   * @param {Object} options - Additional cache options
   * @param {number} options.ttl - Time to live in milliseconds
   */
  set(url, value, options = {}) {
    const key = this._generateKey(url, options);
    const ttl = options.ttl || this.ttl;
    const entry = {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    // Enforce max entries limit - remove oldest entries if at capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const entriesToRemove = Math.max(1, Math.floor(this.maxEntries * 0.1)); // Remove 10%
      const keys = Array.from(this.cache.keys()).slice(0, entriesToRemove);
      keys.forEach(k => this.cache.delete(k));
      logger.debug('Cache eviction', { removed: entriesToRemove, remaining: this.cache.size });
    }

    this.cache.set(key, entry);
    logger.debug('Cache set', { key, ttl, size: this.cache.size });
  }

  /**
   * Get a value from cache
   * @param {string} url - The URL to retrieve
   * @param {Object} options - Additional cache options
   * @returns {*} The cached value or null if not found/expired
   */
  get(url, options = {}) {
    const key = this._generateKey(url, options);
    const entry = this.cache.get(key);

    if (!entry) {
      logger.debug('Cache miss', { key });
      return null;
    }

    if (this._isExpired(entry)) {
      logger.debug('Cache expired', { key });
      this.cache.delete(key);
      return null;
    }

    logger.debug('Cache hit', { key });
    return entry.value;
  }

  /**
   * Check if a key exists and is not expired
   * @param {string} url - The URL to check
   * @param {Object} options - Additional cache options
   * @returns {boolean} True if exists and not expired
   */
  has(url, options = {}) {
    return this.get(url, options) !== null;
  }

  /**
   * Delete a value from cache
   * @param {string} url - The URL to delete
   * @param {Object} options - Additional cache options
   */
  delete(url, options = {}) {
    const key = this._generateKey(url, options);
    this.cache.delete(key);
    logger.debug('Cache deleted', { key });
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { entriesCleared: size });
  }

  /**
   * Remove expired entries
   */
  cleanup() {
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (this._isExpired(entry)) {
        this.cache.delete(key);
        removed++;
      }
    }
    logger.info('Cache cleanup completed', { entriesRemoved: removed });
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    let expired = 0;
    let valid = 0;

    for (const entry of this.cache.values()) {
      if (this._isExpired(entry)) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries: valid,
      expiredEntries: expired,
      ttl: this.ttl,
    };
  }
}

// Create default cache instance with size limit
const defaultCache = new Cache(3600000, 500); // 1 hour TTL, max 500 entries

// Run cleanup every 5 minutes (more aggressive)
const cacheCleanupInterval = setInterval(() => {
  defaultCache.cleanup();
}, 300000);

// Clear interval on process exit to prevent memory leaks
process.on('beforeExit', () => {
  clearInterval(cacheCleanupInterval);
});

module.exports = {
  Cache,
  defaultCache,
};
