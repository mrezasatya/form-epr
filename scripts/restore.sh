#!/usr/bin/env bash
# Pulihkan backup e-PR. PERINGATAN: menimpa isi database saat ini.
#   MODE=docker ./scripts/restore.sh backup/epr_db_2026-11-19_0115.dump [backup/epr_files_2026-11-19_0115.tar.gz]
#   MODE=native DATABASE_URL=postgresql://... STORAGE_DIR=/srv/epr/uploads ./scripts/restore.sh <dump> [files.tar.gz]
set -euo pipefail
MODE="${MODE:-docker}"
DB_FILE="${1:?Sebutkan file .dump}"
FILES_FILE="${2:-}"
read -r -p "Database e-PR akan DITIMPA dengan $DB_FILE. Ketik YA untuk lanjut: " ok
[ "$ok" = "YA" ] || { echo "Dibatalkan."; exit 1; }
if [ "$MODE" = "docker" ]; then
  docker compose exec -T db pg_restore -U epr -d epr --clean --if-exists --no-owner < "$DB_FILE"
  [ -n "$FILES_FILE" ] && docker compose exec -T app tar xzf - -C /app < "$FILES_FILE"
else
  : "${DATABASE_URL:?DATABASE_URL wajib untuk MODE=native}"
  pg_restore --dbname="${DATABASE_URL%%\?*}" --clean --if-exists --no-owner "$DB_FILE"
  if [ -n "$FILES_FILE" ]; then STORAGE_DIR="${STORAGE_DIR:-./uploads}"; tar xzf "$FILES_FILE" -C "$(dirname "$STORAGE_DIR")"; fi
fi
echo "Restore selesai. Restart aplikasi: docker compose restart app (atau service Node)."
