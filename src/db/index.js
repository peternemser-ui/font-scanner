/**
 * Database Module — driver-agnostic facade
 *
 * Consumer files (services, routes, middleware) continue calling:
 *   db.run(sql, params)  db.get(sql, params)  db.all(sql, params)  db.transaction(cb)
 *
 * The active driver (SQLite or PostgreSQL) is chosen via DB_DRIVER env var.
 */

const fs = require('fs');
const path = require('path');
const dbConfig = require('./dbConfig');

class Database {
  constructor() {
    this.driver = null;
    this.driverName = dbConfig.driver; // 'sqlite' | 'postgres'
  }

  async initialize() {
    try {
      // Instantiate the correct driver
      if (this.driverName === 'postgres') {
        const PostgresDriver = require('./drivers/postgres');
        this.driver = new PostgresDriver(dbConfig.postgres);
      } else {
        const SqliteDriver = require('./drivers/sqlite');
        this.driver = new SqliteDriver(dbConfig.sqlite.path);
      }

      await this.driver.open();
      await this.driver.applyPragmas();
      await this.runMigrations();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  // ── Forwarded query methods ───────────────────────────────────────
  run(sql, params = [])  { return this.driver.run(sql, params); }
  get(sql, params = [])  { return this.driver.get(sql, params); }
  all(sql, params = [])  { return this.driver.all(sql, params); }
  close()                { return this.driver.close(); }

  async transaction(callback) {
    return this.driver.transaction(callback);
  }

  // ── Schema & migrations ───────────────────────────────────────────

  async runMigrations() {
    const schemaFile = this.driverName === 'postgres' ? 'schema.pg.sql' : 'schema.sql';
    const schemaPath = path.join(__dirname, schemaFile);

    // If no PG schema file yet, skip (allows SQLite-only dev to keep working)
    if (!fs.existsSync(schemaPath)) {
      if (this.driverName === 'postgres') {
        console.warn(`PostgreSQL schema file not found at ${schemaPath} — skipping base schema`);
      }
      if (this.driverName === 'sqlite') {
        throw new Error(`Schema file not found: ${schemaPath}`);
      }
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = this._splitStatements(schema);

    for (const statement of statements) {
      try {
        await this.run(statement);
      } catch (error) {
        // Ignore "already exists" errors (both SQLite and PG)
        if (!error.message.includes('already exists')) {
          console.error('Migration error:', error.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
          throw error;
        }
      }
    }

    await this.runMigrationFiles();
  }

  async runMigrationFiles() {
    // Postgres reads from migrations/pg/, SQLite from migrations/
    const migrationsDir = this.driverName === 'postgres'
      ? path.join(__dirname, 'migrations', 'pg')
      : path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const migrationName = file.replace('.sql', '');

      // Check if already applied
      try {
        const existing = await this.get(
          'SELECT 1 FROM migrations WHERE name = ?',
          [migrationName]
        );
        if (existing) continue;
      } catch (_) {
        // migrations table may not exist yet
      }

      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      const migrationStatements = this._splitStatements(migrationSQL);

      for (const statement of migrationStatements) {
        try {
          if (statement.includes('INSERT INTO migrations')) continue;
          await this.run(statement);
        } catch (error) {
          const isDuplicate =
            error.message.includes('duplicate column name') ||
            error.message.includes('already exists');
          if (!isDuplicate) {
            console.error('Migration statement error:', error.message);
            console.error('Statement:', statement.substring(0, 200));
            throw error;
          }
        }
      }

      // Record migration
      try {
        const insertSQL = this.driverName === 'postgres'
          ? 'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT DO NOTHING'
          : 'INSERT OR IGNORE INTO migrations (name) VALUES (?)';
        await this.run(insertSQL, [migrationName]);
        console.log(`Applied migration: ${migrationName}`);
      } catch (error) {
        console.warn(`Could not record migration ${migrationName}:`, error.message);
      }
    }
  }

  /**
   * Strip single-line comments and split SQL text into individual statements.
   */
  _splitStatements(sql) {
    const cleaned = sql
      .split('\n')
      .map(line => {
        const idx = line.indexOf('--');
        return idx >= 0 ? line.substring(0, idx) : line;
      })
      .join('\n');

    return cleaned
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}

// ── Singleton ─────────────────────────────────────────────────────

let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

async function initializeDatabase() {
  const db = getDatabase();
  await db.initialize();
  return db;
}

module.exports = {
  Database,
  getDatabase,
  initializeDatabase,
};
