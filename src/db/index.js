/**
 * Database Module - SQLite setup and utilities
 */

const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

class Database {
  constructor(dbPath = process.env.DATABASE_PATH || './data/fontscanner.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize() {
    try {
      // Ensure data directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Open database
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          throw err;
        }
        console.log(`📊 Database connected: ${this.dbPath}`);
      });

      // Enable foreign keys
      await this.run('PRAGMA foreign_keys = ON');

      // Enable WAL mode for better concurrency
      await this.run('PRAGMA journal_mode = WAL');

      // Run migrations
      await this.runMigrations();

      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    // First, run base schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Remove single-line comments and split by semicolons
    const cleanedSchema = schema
      .split('\n')
      .map(line => {
        // Remove inline comments but preserve the rest of the line
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');

    // Split schema into individual statements
    const statements = cleanedSchema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        await this.run(statement);
      } catch (error) {
        // Ignore "table already exists" errors
        if (!error.message.includes('already exists')) {
          console.error('Migration error:', error.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
          throw error;
        }
      }
    }

    // Then run migrations from migrations folder
    await this.runMigrationFiles();

    console.log('✅ Migrations completed');
  }

  /**
   * Run migration files from migrations folder
   */
  async runMigrationFiles() {
    const migrationsDir = path.join(__dirname, 'migrations');

    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      return;
    }

    // Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const migrationName = file.replace('.sql', '');

      // Check if migration already applied
      try {
        const existing = await this.get(
          'SELECT 1 FROM migrations WHERE name = ?',
          [migrationName]
        );

        if (existing) {
          console.log(`⏭️  Skipping migration: ${migrationName} (already applied)`);
          continue;
        }
      } catch (error) {
        // migrations table doesn't exist yet - skip check
      }

      console.log(`🔄 Running migration: ${migrationName}`);

      // Read and execute migration
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      // Remove comments
      const cleanedSQL = migrationSQL
        .split('\n')
        .map(line => {
          const commentIndex = line.indexOf('--');
          if (commentIndex >= 0) {
            return line.substring(0, commentIndex);
          }
          return line;
        })
        .join('\n');

      // Split into statements
      const migrationStatements = cleanedSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Execute each statement
      for (const statement of migrationStatements) {
        try {
          // Skip INSERT INTO migrations statements - we'll add them ourselves
          if (statement.includes('INSERT INTO migrations')) {
            continue;
          }

          await this.run(statement);
        } catch (error) {
          // Handle specific errors gracefully
          if (error.message.includes('duplicate column name') ||
              error.message.includes('already exists')) {
            console.log(`⚠️  Column/table already exists, continuing...`);
          } else {
            console.error('Migration statement error:', error.message);
            console.error('Statement:', statement.substring(0, 200));
            throw error;
          }
        }
      }

      console.log(`✅ Migration applied: ${migrationName}`);
    }
  }

  /**
   * Promisified run method
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Promisified get method (single row)
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Promisified all method (multiple rows)
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) reject(err);
        else {
          console.log('📊 Database connection closed');
          resolve();
        }
      });
    });
  }

  /**
   * Transaction helper
   */
  async transaction(callback) {
    await this.run('BEGIN TRANSACTION');
    try {
      const result = await callback(this);
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }
}

// Singleton instance
let dbInstance = null;

/**
 * Get database instance
 */
function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

/**
 * Initialize database (call on app startup)
 */
async function initializeDatabase() {
  const db = getDatabase();
  await db.initialize();
  return db;
}

module.exports = {
  Database,
  getDatabase,
  initializeDatabase
};
