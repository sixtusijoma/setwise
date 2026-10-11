#!/usr/bin/env bash
# Runs the pgTAP suite against a throwaway local Postgres database.
# Requires postgresql + pgtap + pg_prove (apt: postgresql-16 postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl).
# With Docker available, `supabase test db` runs the same tests against the real Supabase stack.
set -euo pipefail
cd "$(dirname "$0")/.."

DB=setwise_test
PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -c "drop database if exists $DB" -c "create database $DB" -c "alter database $DB set search_path = public, extensions"
"${PSQL[@]}" -d "$DB" -f supabase/tests/local/supabase-stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -d "$DB" -f "$f"; done
sudo -u postgres pg_prove -d "$DB" supabase/tests/database/*.test.sql
