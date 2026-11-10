#!/usr/bin/env bash
# Bütün SQL testləri: təmiz test bazası → migrasiyalar → testlər.
# İstifadə:  PGHOST=<host/soket> PGPORT=<port> PGUSER=postgres tests/pg/run_all.sh
set -euo pipefail
cd "$(dirname "$0")"
export TEST_DB="${TEST_DB:-tehsilhub_test}"
./run_migrations.sh "$TEST_DB" >/dev/null
node test_main.mjs
node test_legacy.mjs
