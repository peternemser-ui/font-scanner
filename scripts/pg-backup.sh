#!/usr/bin/env bash
set -euo pipefail

#
# PostgreSQL Backup Script for Site Mechanic
#
# Creates compressed pg_dump backups with retention policy.
#
# Usage:
#   ./scripts/pg-backup.sh                     # uses env vars
#   DATABASE_URL=postgres://... ./scripts/pg-backup.sh
#
# Environment:
#   DATABASE_URL          PostgreSQL connection string (required)
#   BACKUP_DIR            Where to store backups (default: ./backups)
#   BACKUP_RETENTION      Number of backups to keep (default: 7)
#   BACKUP_S3_BUCKET      If set, uploads to S3 after local dump
#   BACKUP_S3_PREFIX      S3 key prefix (default: site-mechanic/db)
#
# Cron example (daily at 3 AM):
#   0 3 * * * cd /app && DATABASE_URL=postgres://... ./scripts/pg-backup.sh >> /var/log/pg-backup.log 2>&1
#

# ─── Config ─────────────────────────────────────────────────────────────────────

DATABASE_URL="${DATABASE_URL:?DATABASE_URL environment variable is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-7}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-site-mechanic/db}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/sitemechanic_${TIMESTAMP}.sql.gz"

# ─── Setup ──────────────────────────────────────────────────────────────────────

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting PostgreSQL backup..."
echo "  Target: ${BACKUP_FILE}"

# ─── Dump ───────────────────────────────────────────────────────────────────────

# pg_dump with:
#   --no-owner       Omit ownership commands (portable across environments)
#   --no-privileges  Omit grant/revoke (same reason)
#   --clean          Include DROP statements for idempotent restore
#   --if-exists      Don't error on DROP if table doesn't exist
#   --format=plain   Plain SQL (compressed via gzip pipe)

pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=plain \
  | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ─── Verify ─────────────────────────────────────────────────────────────────────

# Quick integrity check — ensure file is valid gzip and contains SQL
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
  echo "[$(date -Iseconds)] ERROR: Backup file failed gzip integrity check!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

LINE_COUNT=$(zcat "$BACKUP_FILE" | wc -l)
if [ "$LINE_COUNT" -lt 10 ]; then
  echo "[$(date -Iseconds)] WARNING: Backup seems too small (${LINE_COUNT} lines). Check DATABASE_URL."
fi

echo "[$(date -Iseconds)] Integrity check passed (${LINE_COUNT} SQL lines)"

# ─── S3 Upload (optional) ──────────────────────────────────────────────────────

if [ -n "$BACKUP_S3_BUCKET" ]; then
  S3_KEY="${BACKUP_S3_PREFIX}/sitemechanic_${TIMESTAMP}.sql.gz"
  echo "[$(date -Iseconds)] Uploading to s3://${BACKUP_S3_BUCKET}/${S3_KEY}..."

  if command -v aws &>/dev/null; then
    aws s3 cp "$BACKUP_FILE" "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" --storage-class STANDARD_IA
    echo "[$(date -Iseconds)] S3 upload complete"
  else
    echo "[$(date -Iseconds)] WARNING: aws CLI not found — skipping S3 upload"
  fi
fi

# ─── Retention cleanup ─────────────────────────────────────────────────────────

BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/sitemechanic_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$BACKUP_RETENTION" ]; then
  EXCESS=$((BACKUP_COUNT - BACKUP_RETENTION))
  echo "[$(date -Iseconds)] Cleaning up ${EXCESS} old backup(s) (keeping ${BACKUP_RETENTION})..."

  ls -1t "${BACKUP_DIR}"/sitemechanic_*.sql.gz | tail -n "$EXCESS" | while read -r OLD_BACKUP; do
    echo "  Removing: $(basename "$OLD_BACKUP")"
    rm -f "$OLD_BACKUP"
  done
fi

echo "[$(date -Iseconds)] Backup process finished. ${BACKUP_RETENTION} most recent backups retained."
