-- Font Scanner Database Schema
-- SQLite database for async scan jobs, user management, and results

-- ============================================================
-- USERS TABLE (must be first for foreign key references)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- UUID
  email TEXT UNIQUE NOT NULL,       -- User email
  email_verified INTEGER DEFAULT 0, -- 0 = not verified, 1 = verified
  stripe_customer_id TEXT,          -- Stripe customer ID
  plan TEXT DEFAULT 'free',         -- free, starter, pro
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  metadata_json TEXT                -- Extra user data
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- ============================================================
-- SCANS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,              -- UUID
  target_url TEXT NOT NULL,         -- URL being scanned
  status TEXT NOT NULL DEFAULT 'queued', -- queued, running, done, failed
  progress INTEGER DEFAULT 0,       -- 0-100
  started_at DATETIME,              -- When scan started
  finished_at DATETIME,             -- When scan completed/failed
  error_message TEXT,               -- Error details if failed
  user_id TEXT,                     -- User who requested scan (NULL for anonymous)
  options_json TEXT,                -- JSON: { maxPages, maxDepth, analyzers, etc }
  pages_crawled INTEGER DEFAULT 0,  -- Number of pages actually crawled
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);

-- ============================================================
-- SCAN RESULTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id TEXT NOT NULL,            -- Foreign key to scans table
  result_type TEXT NOT NULL,        -- font, seo, security, accessibility, performance, tags
  result_json TEXT NOT NULL,        -- Full JSON result data
  page_url TEXT,                    -- Specific page URL (NULL for aggregate results)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_type ON scan_results(result_type);

-- ============================================================
-- ENTITLEMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,            -- Foreign key to users
  plan TEXT NOT NULL,               -- free, starter, pro
  scans_remaining INTEGER NOT NULL DEFAULT 0, -- Scan credits
  max_pages_per_scan INTEGER NOT NULL DEFAULT 10,
  pdf_export_enabled INTEGER DEFAULT 0,
  valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
  valid_until DATETIME,             -- NULL = forever (subscription)
  stripe_subscription_id TEXT,      -- For subscription tracking
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entitlements_user_id ON entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_valid_until ON entitlements(valid_until);

-- ============================================================
-- API KEYS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,              -- The API key itself (hashed)
  user_id TEXT NOT NULL,            -- Owner of the key
  name TEXT,                        -- User-friendly name
  scopes TEXT,                      -- Comma-separated: scan,export,read
  last_used_at DATETIME,
  requests_count INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,        -- 0 = disabled, 1 = enabled
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,              -- NULL = never expires
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- ============================================================
-- SCAN USAGE TRACKING (for rate limiting)
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,                     -- NULL for anonymous
  ip_address TEXT,                  -- For anonymous rate limiting
  scan_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scan_usage_user_id ON scan_usage(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scan_usage_ip ON scan_usage(ip_address, created_at);

-- ============================================================
-- STRIPE EVENTS (webhook deduplication)
-- ============================================================
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,              -- Stripe event ID
  event_type TEXT NOT NULL,
  processed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);

-- ============================================================
-- CRAWLED PAGES (for scan progress tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS crawled_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,              -- HTTP status
  crawled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  error TEXT,                       -- Error message if failed
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crawled_pages_scan_id ON crawled_pages(scan_id);

-- ============================================================
-- MIGRATIONS TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PASSWORD RESETS
-- ============================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,            -- Foreign key to users
  token_hash TEXT NOT NULL,         -- Hashed reset token
  expires_at DATETIME NOT NULL,     -- Token expiration time
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);
