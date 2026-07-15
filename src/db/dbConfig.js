/**
 * Database Configuration
 *
 * PostgreSQL is the only supported database. There is deliberately no SQLite
 * fallback: this module used to default to `DB_DRIVER || 'sqlite'`, so any
 * process started without DB_DRIVER set (a script, a test run, a container
 * missing its env file) silently wrote to a local ./data/fontscanner.db
 * instead of the real database. Accounts created that way looked successful
 * but were invisible to the app — that is how every prod user was stranded
 * between March and July 2026. A misconfigured environment must fail loudly
 * here rather than quietly write data somewhere nobody looks.
 */

const DEFAULT_URL = 'postgresql://fontscanner:fontscanner_dev@localhost:5432/fontscanner';

const driver = (process.env.DB_DRIVER || 'postgres').toLowerCase();

if (driver !== 'postgres') {
  throw new Error(
    `Unsupported DB_DRIVER "${driver}". PostgreSQL is the only supported database ` +
    '(SQLite support was removed). Set DB_DRIVER=postgres and DATABASE_URL.'
  );
}

// In production a real DATABASE_URL is mandatory — never fall back to a
// local-dev connection string on a production box.
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required when NODE_ENV=production.');
}

const dbConfig = {
  driver,

  postgres: {
    connectionString: process.env.DATABASE_URL || DEFAULT_URL,
    pool: {
      min: parseInt(process.env.PG_POOL_MIN || '2', 10),
      max: parseInt(process.env.PG_POOL_MAX || '10', 10),
    },
  },
};

module.exports = dbConfig;
