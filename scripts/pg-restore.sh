#!/usr/bin/env bash
set -euo pipefail

#
# PostgreSQL Restore Script for Site Mechanic
#
# Restores a compressed pg_dump backup.
#
# Usage:
#   ./scripts/pg-restore.sh backups/sitemechanic_20260226_030000.sql.gz
#   DATABASE_URL=postgres://... ./scripts/pg-restore.sh <backup_file>
#
# WARNING: This will DROP and recreate all tables. Use with caution.
#

DATABASE_URL="${DATABASE_URL:?DATABASE_URL environment variable is required}"
BACKUP_FILE="${1:?Usage: pg-restore.sh <backup_file.sql.gz>}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[$(date -Iseconds)] === PostgreSQL Restore ==="
echo "  Source: ${BACKUP_FILE}"
echo ""
echo "  WARNING: This will DROP and recreate all tables in the target database."
echo ""
read -rp "  Type 'yes' to continue: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "[$(date -Iseconds)] Restoring from ${BACKUP_FILE}..."

zcat "$BACKUP_FILE" | psql "$DATABASE_URL" --set ON_ERROR_STOP=on

echo "[$(date -Iseconds)] Restore complete."

# Quick table count verification
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
echo "[$(date -Iseconds)] Verified: ${TABLE_COUNT// /} tables in database."
