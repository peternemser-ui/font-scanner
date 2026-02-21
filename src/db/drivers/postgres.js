/**
 * PostgreSQL Driver
 * Uses the `pg` module with connection pooling.
 * Translates SQLite-flavored SQL via queryAdapter before execution.
 */

const { Pool } = require('pg');
const pg = require('pg');
const { adaptSql } = require('../queryAdapter');

// Return timestamps as ISO strings (matching SQLite behaviour)
// so consumer code that does string comparisons / new Date(row.created_at) keeps working.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (val) => val);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (val) => val);
pg.types.setTypeParser(pg.types.builtins.DATE, (val) => val);

class PostgresDriver {
  constructor(config) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      min: config.pool.min,
      max: config.pool.max,
    });
  }

  async open() {
    // Verify connectivity
    const client = await this.pool.connect();
    client.release();
  }

  async applyPragmas() {
    // No SQLite pragmas needed for PostgreSQL.
    // Foreign keys are enforced by default.
  }

  /**
   * Determine if a SQL statement is an INSERT that should return the new row id.
   * If so, append RETURNING id (unless already present).
   */
  _maybeAppendReturning(sql) {
    const trimmed = sql.trimStart();
    const isInsert = /^INSERT\s/i.test(trimmed);
    if (!isInsert) return sql;
    if (/RETURNING\s/i.test(sql)) return sql;
    // Only append if table likely has an id column (safe — PG just returns null if no column)
    return sql.replace(/;?\s*$/, ' RETURNING id');
  }

  async run(sql, params = []) {
    const adapted = adaptSql(sql);

    // For INSERTs, try to get the new id via RETURNING
    const isInsert = /^\s*INSERT\s/i.test(adapted);
    const finalSql = isInsert ? this._maybeAppendReturning(adapted) : adapted;

    try {
      const result = await this.pool.query(finalSql, params);
      return {
        lastID: (result.rows && result.rows[0] && result.rows[0].id) || 0,
        changes: result.rowCount || 0,
      };
    } catch (err) {
      // If RETURNING id fails because column doesn't exist, retry without it
      if (isInsert && err.message && err.message.includes('column "id" does not exist')) {
        const result = await this.pool.query(adapted, params);
        return { lastID: 0, changes: result.rowCount || 0 };
      }
      throw err;
    }
  }

  async get(sql, params = []) {
    const adapted = adaptSql(sql);
    const result = await this.pool.query(adapted, params);
    return result.rows[0] || undefined;
  }

  async all(sql, params = []) {
    const adapted = adaptSql(sql);
    const result = await this.pool.query(adapted, params);
    return result.rows;
  }

  /**
   * Run a callback inside a single transaction on a dedicated connection.
   * The txDb object passed to the callback has the same run/get/all interface
   * but all queries go through the same pooled client.
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const txDb = {
        run: async (sql, params = []) => {
          const adapted = adaptSql(sql);
          const isInsert = /^\s*INSERT\s/i.test(adapted);
          const finalSql = isInsert ? this._maybeAppendReturning(adapted) : adapted;
          try {
            const result = await client.query(finalSql, params);
            return {
              lastID: (result.rows && result.rows[0] && result.rows[0].id) || 0,
              changes: result.rowCount || 0,
            };
          } catch (err) {
            if (isInsert && err.message && err.message.includes('column "id" does not exist')) {
              const result = await client.query(adapted, params);
              return { lastID: 0, changes: result.rowCount || 0 };
            }
            throw err;
          }
        },
        get: async (sql, params = []) => {
          const adapted = adaptSql(sql);
          const result = await client.query(adapted, params);
          return result.rows[0] || undefined;
        },
        all: async (sql, params = []) => {
          const adapted = adaptSql(sql);
          const result = await client.query(adapted, params);
          return result.rows;
        },
      };

      const result = await callback(txDb);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = PostgresDriver;
