#!/bin/sh
set -eu

if [ "${OUTPOST_DISPOSABLE_DATABASE_CONFIRMATION:-}" != "runtime-authority-concurrency" ]; then
  echo "Refusing to replace a persistence function without disposable-database confirmation." >&2
  exit 1
fi

database_name="$(psql -v ON_ERROR_STOP=1 -Atqc 'select current_database()')"
case "$database_name" in
  *_test|*_test_*|test_*) ;;
  *)
    echo "Refusing concurrency harness against non-test database: $database_name" >&2
    exit 1
    ;;
esac

workdir="$(mktemp -d)"
base_database="$database_name"
test_database="outpost_runtime_concurrency_$$_test"

cleanup() {
  set +e
  PGDATABASE="$base_database" dropdb --if-exists "$test_database" >/dev/null 2>&1
  rm -rf "$workdir"
}
trap cleanup EXIT HUP INT TERM

createdb --template="$base_database" "$test_database"
export PGDATABASE="$test_database"

psql -v ON_ERROR_STOP=1 <<'SQL'
insert into plans (
  id, name, included_locations, included_voice_minutes, included_emails,
  included_users, overage_voice_minute_cents
) values ('plan_runtime_race', 'Runtime race', 1, 0, 0, 1, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values (
  'tenant_runtime_race', 'Runtime Race', 'runtime-race', 'active',
  'plan_runtime_race', 'pilot', 'concierge'
);

update tenant_runtime_controls
   set processing_state = 'enabled'
 where tenant_id = 'tenant_runtime_race';

insert into jobs (id, tenant_id, kind, payload, dedupe_key)
values (
  'job_runtime_race', 'tenant_runtime_race',
  'provider.resend.email_received.normalize',
  '{"context":{"tenant_id":"tenant_runtime_race","location_id":"","provider_connection_id":""}}'::jsonb,
  'provider:runtime-race'
);

select count(*) from claim_jobs(1, 'runtime-race-worker-first');

-- This cloned disposable database replaces the private body to hold the
-- same production tenant/control locks long enough to prove serialization.
create or replace function persist_normalized_provider_event_private(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_sleep(2);
  return '{"ok":true}'::jsonb;
end;
$$;
SQL

wait_for_pg_sleep() {
  application_name="$1"
  attempts=0
  while [ "$attempts" -lt 100 ]; do
    if [ "$(psql -v ON_ERROR_STOP=1 -Atqc "select exists (select 1 from pg_stat_activity where application_name = '$application_name' and wait_event = 'PgSleep')")" = "t" ]; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 0.05
  done
  echo "Timed out waiting for $application_name to hold its ordered locks." >&2
  return 1
}

# Persistence takes tenant then control SHARE locks. A stop requesting UPDATE
# locks must wait, then linearizes after persistence without deadlock.
PGAPPNAME=runtime-persist-first psql -v ON_ERROR_STOP=1 -Atqc \
  "select persist_normalized_provider_event('{\"providerKey\":\"resend\",\"conversation\":{\"tenantId\":\"tenant_runtime_race\"}}'::jsonb, 'job_runtime_race', 'runtime-race-worker-first')" \
  >"$workdir/persist-first.out" 2>"$workdir/persist-first.err" &
persist_pid=$!
wait_for_pg_sleep runtime-persist-first
psql -v ON_ERROR_STOP=1 <<'SQL'
set statement_timeout = '5s';
begin;
select id from tenants where id = 'tenant_runtime_race' for update;
update tenant_runtime_controls
   set processing_state = 'stopped', pause_generation = pause_generation + 1
 where tenant_id = 'tenant_runtime_race';
commit;
SQL
wait "$persist_pid"
grep -q '"ok": true' "$workdir/persist-first.out"

# A stop that owns the tenant/control UPDATE locks linearizes first. Guarded
# persistence waits and then rejects with the dedicated stopped SQLSTATE.
psql -v ON_ERROR_STOP=1 <<'SQL'
update jobs
   set status = 'queued', attempts = 0, locked_at = null, locked_by = null,
       claimed_pause_generation = null
 where id = 'job_runtime_race';
update tenant_runtime_controls
   set processing_state = 'enabled'
 where tenant_id = 'tenant_runtime_race';
select count(*) from claim_jobs(1, 'runtime-race-worker-second');
SQL
PGAPPNAME=runtime-stop-first psql -v ON_ERROR_STOP=1 >"$workdir/stop-first.out" 2>"$workdir/stop-first.err" <<'SQL' &
set statement_timeout = '5s';
begin;
select id from tenants where id = 'tenant_runtime_race' for update;
update tenant_runtime_controls
   set processing_state = 'stopped', pause_generation = pause_generation + 1
 where tenant_id = 'tenant_runtime_race';
select pg_sleep(2);
commit;
SQL
stop_pid=$!
wait_for_pg_sleep runtime-stop-first
if psql -v ON_ERROR_STOP=1 -Atqc \
  "select persist_normalized_provider_event('{\"providerKey\":\"resend\",\"conversation\":{\"tenantId\":\"tenant_runtime_race\"}}'::jsonb, 'job_runtime_race', 'runtime-race-worker-second')" \
  >"$workdir/blocked-persist.out" 2>"$workdir/blocked-persist.err"; then
  echo "persistence unexpectedly crossed a committed tenant stop" >&2
  exit 1
fi
wait "$stop_pid"
grep -q 'tenant runtime processing is stopped' "$workdir/blocked-persist.err"

# Stop-first stale-lease recovery waits on tenant/control authority, observes
# the committed generation advance, and restores the consumed claim attempt.
psql -v ON_ERROR_STOP=1 <<'SQL'
update jobs
   set status = 'queued', attempts = 0, locked_at = null, locked_by = null,
       claimed_pause_generation = null
 where id = 'job_runtime_race';
update tenant_runtime_controls
   set processing_state = 'enabled'
 where tenant_id = 'tenant_runtime_race';
select count(*) from claim_jobs(1, 'runtime-race-worker-recovery');
update jobs
   set locked_at = now() - interval '6 minutes'
 where id = 'job_runtime_race';
SQL
PGAPPNAME=runtime-stop-before-recovery psql -v ON_ERROR_STOP=1 >"$workdir/stop-recovery.out" 2>"$workdir/stop-recovery.err" <<'SQL' &
set statement_timeout = '5s';
begin;
select id from tenants where id = 'tenant_runtime_race' for update;
update tenant_runtime_controls
   set processing_state = 'stopped', pause_generation = pause_generation + 1
 where tenant_id = 'tenant_runtime_race';
select pg_sleep(2);
commit;
SQL
stop_recovery_pid=$!
wait_for_pg_sleep runtime-stop-before-recovery
psql -v ON_ERROR_STOP=1 -Atqc \
  "select count(*) from claim_jobs(1, 'runtime-race-worker-after-recovery')" \
  >"$workdir/recovery-claim.out"
wait "$stop_recovery_pid"
grep -qx '0' "$workdir/recovery-claim.out"
psql -v ON_ERROR_STOP=1 -Atqc \
  "select status || ':' || attempts from jobs where id = 'job_runtime_race'" \
  >"$workdir/recovery-state.out"
grep -qx 'queued:0' "$workdir/recovery-state.out"

echo "Runtime authority concurrency contract passed."
