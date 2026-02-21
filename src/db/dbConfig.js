/**
 * Database Configuration
 * Reads database driver selection and connection settings from environment.
 */

const dbConfig = {
  // 'sqlite' or 'postgres'
  driver: (process.env.DB_DRIVER || 'sqlite').toLowerCase(),

  // SQLite settings
  sqlite: {
    path: process.env.DATABASE_PATH || './data/fontscanner.db',
  },

  // PostgreSQL settings
  postgres: {
    connectionString: process.env.DATABASE_URL || 'postgresql://fontscanner:fontscanner_dev@localhost:5432/fontscanner',
    pool: {
      min: parseInt(process.env.PG_POOL_MIN || '2', 10),
      max: parseInt(process.env.PG_POOL_MAX || '10', 10),
    },
  },
};

module.exports = dbConfig;
