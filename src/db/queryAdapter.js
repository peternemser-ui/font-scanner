/**
 * Query Adapter
 * Translates SQLite-flavored SQL into PostgreSQL-compatible SQL.
 * Called by the PostgreSQL driver before executing queries.
 */

/**
 * Convert `?` positional placeholders to `$1, $2, ...` numbered placeholders.
 * Skips `?` inside single-quoted string literals.
 */
function convertPlaceholders(sql) {
  let idx = 0;
  let out = '';
  let inString = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (ch === "'" && sql[i - 1] !== '\\') {
      inString = !inString;
      out += ch;
    } else if (ch === '?' && !inString) {
      idx++;
      out += '$' + idx;
    } else {
      out += ch;
    }
  }

  return out;
}

/**
 * Translate SQLite-specific SQL constructs to PostgreSQL equivalents.
 */
function adaptSql(sql) {
  let adapted = sql;

  // INSERT OR IGNORE INTO → INSERT INTO ... ON CONFLICT DO NOTHING
  adapted = adapted.replace(
    /INSERT\s+OR\s+IGNORE\s+INTO/gi,
    'INSERT INTO'
  );
  // We need to append ON CONFLICT DO NOTHING for INSERT OR IGNORE.
  // This is handled by checking if the original had INSERT OR IGNORE.
  const wasInsertOrIgnore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql);

  // INSERT OR REPLACE INTO → handled per-query (needs ON CONFLICT ... DO UPDATE)
  // These cases should already be manually rewritten to use ON CONFLICT syntax
  // that works in both DBs.

  // datetime('now') → NOW()
  adapted = adapted.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()');

  // date("now") or date('now') → CURRENT_DATE
  adapted = adapted.replace(/date\s*\(\s*['"]now['"]\s*\)/gi, 'CURRENT_DATE');

  // date("now", "-N days") → CURRENT_DATE - INTERVAL 'N days'
  adapted = adapted.replace(
    /date\s*\(\s*['"]now['"]\s*,\s*['"]-(\d+)\s+(day|days|month|months|year|years)['"]\s*\)/gi,
    (_, n, unit) => `CURRENT_DATE - INTERVAL '${n} ${unit}'`
  );

  // ORDER BY datetime(col) → ORDER BY col
  adapted = adapted.replace(
    /ORDER\s+BY\s+datetime\s*\(\s*(\w+)\s*\)/gi,
    'ORDER BY $1'
  );

  // date(column_name) → (column_name)::date  (for GROUP BY day, etc.)
  // Runs AFTER date("now") replacements, so only matches actual column refs.
  adapted = adapted.replace(
    /\bdate\s*\(\s*([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)?)\s*\)/gi,
    '($1)::date'
  );

  // AUTOINCREMENT → (strip it; SERIAL handles this in PG)
  adapted = adapted.replace(/AUTOINCREMENT/gi, '');

  // INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
  // (only relevant for schema DDL executed at runtime — migrations use separate PG files)

  // Convert placeholders last
  adapted = convertPlaceholders(adapted);

  // Append ON CONFLICT DO NOTHING for INSERT OR IGNORE conversions
  // Only if it doesn't already have an ON CONFLICT clause
  if (wasInsertOrIgnore && !/ON\s+CONFLICT/i.test(adapted)) {
    // Find the end of the VALUES clause
    adapted = adapted.replace(
      /(\)\s*)$/,
      '$1 ON CONFLICT DO NOTHING'
    );
    // If the above didn't match (e.g. already has trailing whitespace), try a different approach
    if (!/ON\s+CONFLICT\s+DO\s+NOTHING/i.test(adapted)) {
      adapted = adapted.trimEnd() + ' ON CONFLICT DO NOTHING';
    }
  }

  return adapted;
}

module.exports = { adaptSql, convertPlaceholders };
