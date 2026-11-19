#!/usr/bin/env bash
# Build untuk Vercel (prototype online). Migrasi & seed memakai koneksi langsung (tanpa pooler).
# Variabel dari integrasi Neon: DATABASE_URL_UNPOOLED / POSTGRES_URL_NON_POOLING.
set -euo pipefail
DIRECT="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-${DATABASE_URL:-}}}"
if [ -z "$DIRECT" ]; then
  echo "ERROR: database belum terhubung. Tambahkan Neon Postgres di Vercel → Storage, lalu deploy ulang." >&2
  exit 1
fi
export DATABASE_URL="${DATABASE_URL:-$DIRECT}"
npx prisma generate
DATABASE_URL="$DIRECT" npx prisma migrate deploy
DATABASE_URL="$DIRECT" npx prisma db seed
npx next build
