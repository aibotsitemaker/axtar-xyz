#!/usr/bin/env bash
# İstifadə: PGHOST=... PGPORT=... PGUSER=postgres tests/pg/run_migrations.sh <dbname> [son_fayl_prefiksi]
# Test bazasını yenidən yaradır və migrasiyaları dokumentasiyadakı sıra ilə icra edir.
set -euo pipefail
DB="${1:?db adı}"
UPTO="${2:-08}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PGOPTIONS='-c client_min_messages=warning'
dropdb --if-exists --force "$DB" 2>/dev/null || true
createdb "$DB"
P="psql -X -q -v ON_ERROR_STOP=1 -d $DB"
$P -f "$ROOT/tests/pg/00_supabase_stub.sql"
for f in 01_supabase_schema 02_hardening_phase1 04_grants 05_backfill_profiles 03_hardening_phase2 06_roles_and_forum 07_admin_panel_and_audit; do
  echo "== $f"; $P -f "$ROOT/$f.sql"
done
