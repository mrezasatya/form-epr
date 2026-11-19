#!/usr/bin/env bash
# Backup database PostgreSQL + folder file upload e-PR, dengan retensi otomatis.
# Pemakaian:
#   MODE=docker ./scripts/backup.sh            # aplikasi dijalankan dengan docker compose (dari folder repo)
#   MODE=native DATABASE_URL=postgresql://... STORAGE_DIR=/srv/epr/uploads ./scripts/backup.sh
# Variabel opsional: BACKUP_DIR (default ./backup), RETENTION_DAYS (default 30).
# Jadwalkan harian, mis. crontab:  15 1 * * *  cd /srv/e-pr && MODE=docker ./scripts/backup.sh >> backup.log 2>&1
set -euo pipefail
MODE="${MODE:-docker}"
BACKUP_DIR="${BACKUP_DIR:-./backup}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$BACKUP_DIR"
DB_FILE="$BACKUP_DIR/epr_db_$STAMP.dump"
FILES_FILE="$BACKUP_DIR/epr_files_$STAMP.tar.gz"

if [ "$MODE" = "docker" ]; then
  docker compose exec -T db pg_dump -U epr -d epr -Fc > "$DB_FILE"
  docker compose exec -T app tar czf - -C /app uploads > "$FILES_FILE"
else
  : "${DATABASE_URL:?DATABASE_URL wajib untuk MODE=native}"
  pg_dump --dbname="${DATABASE_URL%%\?*}" -Fc > "$DB_FILE"
  STORAGE_DIR="${STORAGE_DIR:-./uploads}"
  if [ -d "$STORAGE_DIR" ]; then
    tar czf "$FILES_FILE" -C "$(dirname "$STORAGE_DIR")" "$(basename "$STORAGE_DIR")"
  else
    echo "Peringatan: STORAGE_DIR $STORAGE_DIR tidak ada, backup file dilewati." >&2
  fi
fi

# Verifikasi: file dump harus terbaca oleh pg_restore
if command -v pg_restore >/dev/null; then pg_restore --list "$DB_FILE" > /dev/null; fi
echo "$(date '+%F %T') backup OK: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))${FILES_FILE:+ · $FILES_FILE}"
find "$BACKUP_DIR" -name 'epr_*' -type f -mtime +"$RETENTION_DAYS" -print -delete
