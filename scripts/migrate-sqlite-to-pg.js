#!/usr/bin/env node

/**
 * SQLite → PostgreSQL Data Migration Script
 *
 * Reads all rows from every SQLite table and inserts them into PostgreSQL
 * in foreign-key order.  Resets SERIAL sequences after import.
 *
 * Usage:
 *   DATABASE_PATH=./data/fontscanner.db \
 *   DATABASE_URL=postgresql://fontscanner:fontscanner_dev@localhost:5432/fontscanner \
 *   node scripts/migrate-sqlite-to-pg.js
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// ── Configuration ───────────────────────────────────────────────────

const SQLITE_PATH = process.env.DATABASE_PATH || './data/fontscanner.db';
const PG_URL = process.env.DATABASE_URL || 'postgresql://fontscanner:fontscanner_dev@localhost:5432/fontscanner';

// Tables in dependency (FK) order.
// Tables with no FK deps come first; dependents follow.
const TABLE_ORDER = [
  'users',
  'migrations',
  'subscription_plans',
  'stripe_events',
  'sessions',
  'api_keys',
  'password_resets',
  'entitlements',
  'scans',
  'scan_results',
  'scan_usage',
  'crawled_pages',
  'billing_sessions',
  'report_purchases',
  'contact_messages',
  'admin_activity_log',
  'usage_tracking',
  'benchmark_stats',
  'ai_recommendations',
  'recommendation_feedback',
];

// Tables with SERIAL id columns that need sequence resets
const SERIAL_TABLES = [
  'scan_results',
  'entitlements',
  'scan_usage',
  'crawled_pages',
  'password_resets',
  'admin_activity_log',
  'usage_tracking',
  'contact_messages',
  'migrations',
  'report_purchases',
  'benchmark_stats',
  'ai_recommendations',
  'recommendation_feedback',
];

// ── Helpers ─────────────────────────────────────────────────────────

function sqliteAll(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function sqliteGet(db, sql) {
  return new Promise((resolve, reject) => {
    db.get(sql, [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function tableExists(pgPool, table) {
  const res = await pgPool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
    [table]
  );
  return res.rows.length > 0;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('=== SQLite → PostgreSQL Data Migration ===\n');
  console.log(`SQLite: ${SQLITE_PATH}`);
  console.log(`PostgreSQL: ${PG_URL.replace(/:[^:@]+@/, ':****@')}\n`);

  // Open SQLite
  const sqliteDb = new sqlite3.Database(SQLITE_PATH, sqlite3.OPEN_READONLY);
  const pgPool = new Pool({ connectionString: PG_URL });

  try {
    // Verify PG connectivity
    const client = await pgPool.connect();
    client.release();
    console.log('PostgreSQL connection verified.\n');

    let totalRows = 0;

    for (const table of TABLE_ORDER) {
      // Check if table exists in SQLite
      const sqliteTable = await sqliteGet(
        sqliteDb,
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
      );
      if (!sqliteTable) {
        console.log(`  SKIP  ${table} (not in SQLite)`);
        continue;
      }

      // Check if table exists in PG
      const pgExists = await tableExists(pgPool, table);
      if (!pgExists) {
        console.log(`  SKIP  ${table} (not in PostgreSQL — run migrations first)`);
        continue;
      }

      // Read all rows from SQLite
      const rows = await sqliteAll(sqliteDb, `SELECT * FROM "${table}"`);
      if (rows.length === 0) {
        console.log(`  SKIP  ${table} (0 rows)`);
        continue;
      }

      // Determine columns from the first row
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const colList = columns.map(c => `"${c}"`).join(', ');

      // Truncate PG table first (to make the script re-runnable)
      await pgPool.query(`DELETE FROM "${table}"`);

      // Batch insert
      const batchSize = 500;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const pgClient = await pgPool.connect();
        try {
          await pgClient.query('BEGIN');
          for (const row of batch) {
            const values = columns.map(c => row[c]);
            await pgClient.query(
              `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              values
            );
          }
          await pgClient.query('COMMIT');
          inserted += batch.length;
        } catch (err) {
          await pgClient.query('ROLLBACK');
          console.error(`  ERROR inserting into ${table}:`, err.message);
          throw err;
        } finally {
          pgClient.release();
        }
      }

      console.log(`  OK    ${table}: ${inserted} rows migrated`);
      totalRows += inserted;
    }

    // Reset SERIAL sequences
    console.log('\nResetting SERIAL sequences...');
    for (const table of SERIAL_TABLES) {
      const pgExists = await tableExists(pgPool, table);
      if (!pgExists) continue;

      try {
        await pgPool.query(`
          SELECT setval(
            pg_get_serial_sequence('"${table}"', 'id'),
            COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1,
            false
          )
        `);
        console.log(`  OK    ${table}_id_seq reset`);
      } catch (err) {
        // Table may use TEXT PK instead of SERIAL — that's fine
        if (!err.message.includes('does not exist')) {
          console.warn(`  WARN  ${table}: ${err.message}`);
        }
      }
    }

    console.log(`\nMigration complete: ${totalRows} total rows migrated.`);
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

main().catch((err) => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
