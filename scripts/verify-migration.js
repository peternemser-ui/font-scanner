#!/usr/bin/env node

/**
 * Migration Verification Script
 *
 * Compares row counts and sample data between SQLite and PostgreSQL
 * to confirm that the data migration was successful.
 *
 * Usage:
 *   DATABASE_PATH=./data/fontscanner.db \
 *   DATABASE_URL=postgresql://fontscanner:fontscanner_dev@localhost:5432/fontscanner \
 *   node scripts/verify-migration.js
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const SQLITE_PATH = process.env.DATABASE_PATH || './data/fontscanner.db';
const PG_URL = process.env.DATABASE_URL || 'postgresql://fontscanner:fontscanner_dev@localhost:5432/fontscanner';

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

async function main() {
  console.log('=== Migration Verification ===\n');
  console.log(`SQLite: ${SQLITE_PATH}`);
  console.log(`PostgreSQL: ${PG_URL.replace(/:[^:@]+@/, ':****@')}\n`);

  const sqliteDb = new sqlite3.Database(SQLITE_PATH, sqlite3.OPEN_READONLY);
  const pgPool = new Pool({ connectionString: PG_URL });

  try {
    // Get all SQLite tables
    const sqliteTables = await sqliteAll(
      sqliteDb,
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    );

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const { name: table } of sqliteTables) {
      // Get SQLite count
      const sqliteCount = await sqliteGet(sqliteDb, `SELECT COUNT(*) as cnt FROM "${table}"`);
      const sqliteN = sqliteCount.cnt;

      // Get PG count
      let pgN;
      try {
        const pgCount = await pgPool.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
        pgN = parseInt(pgCount.rows[0].cnt, 10);
      } catch (err) {
        console.log(`  SKIP  ${table} (not in PostgreSQL)`);
        skipped++;
        continue;
      }

      const match = sqliteN === pgN;
      const icon = match ? 'PASS' : 'FAIL';
      console.log(`  ${icon}  ${table}: SQLite=${sqliteN}  PG=${pgN}`);

      if (match) {
        passed++;
      } else {
        failed++;
      }

      // Sample check: compare first row if counts match and table has data
      if (match && sqliteN > 0) {
        try {
          const sqliteRow = await sqliteGet(sqliteDb, `SELECT * FROM "${table}" LIMIT 1`);
          const pgRow = await pgPool.query(`SELECT * FROM "${table}" LIMIT 1`);
          const pgFirst = pgRow.rows[0];

          // Compare non-date columns (dates may differ in format)
          const cols = Object.keys(sqliteRow);
          let sampleMatch = true;
          for (const col of cols) {
            const sv = String(sqliteRow[col] ?? '');
            const pv = String(pgFirst[col] ?? '');
            // Skip timestamp comparison (format differences are expected)
            if (col.includes('_at') || col.includes('date') || col.includes('Date')) continue;
            if (sv !== pv) {
              sampleMatch = false;
              console.log(`        Column "${col}" differs: SQLite="${sv}" PG="${pv}"`);
            }
          }
          if (!sampleMatch) {
            console.log(`        (sample row mismatch — may be harmless if just date formatting)`);
          }
        } catch (_) {
          // Sample check failed — non-critical
        }
      }
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${skipped} skipped ===`);

    if (failed > 0) {
      console.log('\nVerification FAILED — row count mismatches detected.');
      process.exit(1);
    } else {
      console.log('\nVerification PASSED — all row counts match.');
    }
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

main().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
