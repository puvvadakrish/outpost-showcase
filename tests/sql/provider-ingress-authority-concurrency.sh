#!/bin/sh
set -eu

if [ "${OUTPOST_DISPOSABLE_DATABASE_CONFIRMATION:-}" != "provider-ingress-authority-concurrency" ]; then
  echo "Refusing provider ingress concurrency checks without disposable-database confirmation." >&2
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
test_database="outpost_ingress_concurrency_$$_test"

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
) values ('plan_ingress_race', 'Ingress race', 1, 0, 1, 1, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values (
  'tenant_ingress_race', 'Ingress Race', 'ingress-race', 'active',
  'plan_ingress_race', 'pilot', 'concierge'
);

insert into locations (
  id, tenant_id, name, address, timezone, status
) values (
  'location_ingress_race', 'tenant_ingress_race', 'Ingress Race Location',
  '123 Race Street', 'America/Chicago', 'active'
);

insert into provider_connections (
  id, tenant_id, location_id, channel, provider_key, status, secret_ref,
  disabled_reason, ingress_key, provider_ingress_mode
) values (
  'provider_ingress_race', 'tenant_ingress_race', 'location_ingress_race',
  'email', 'resend', 'disabled',
  'outpost-secret://provider/provider_ingress_race/webhook-signing/v1',
  'disposable concurrency fixture', 'd4ac846d-1886-4ea6-a842-2d2f727d10d9',
  'rehearsal'
);

update tenant_runtime_controls
   set processing_state = 'enabled'
 where tenant_id = 'tenant_ingress_race';
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

# Accept owns the production tenant/control/provider SHARE lock order before it
# sleeps. Stop must wait, so the accepted receipt commits before stop.
PGAPPNAME=ingress-accept-first psql -v ON_ERROR_STOP=1 >"$workdir/accept-first.out" 2>"$workdir/accept-first.err" <<'SQL' &
set statement_timeout = '5s';
begin;
select id from tenants where id = 'tenant_ingress_race' for share;
select tenant_id from tenant_runtime_controls where tenant_id = 'tenant_ingress_race' for share;
select id from provider_connections where id = 'provider_ingress_race' for share;
select pg_sleep(2);
select accept_provider_ingress_event(
  'd4ac846d-1886-4ea6-a842-2d2f727d10d9', 'resend', 'email_accept_first',
  'email.received', repeat('a', 64),
  '{"event":"email.received","message_id":"email_accept_first","body_available":false}'::jsonb,
  now()
);
commit;
SQL
accept_pid=$!
wait_for_pg_sleep ingress-accept-first
psql -v ON_ERROR_STOP=1 <<'SQL'
set statement_timeout = '5s';
begin;
select id from tenants where id = 'tenant_ingress_race' for update;
update tenant_runtime_controls
   set processing_state = 'stopped', pause_generation = pause_generation + 1
 where tenant_id = 'tenant_ingress_race';
commit;
SQL
wait "$accept_pid"
grep -q '"replayed": false' "$workdir/accept-first.out"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from provider_ingress_receipts where provider_event_id = 'email_accept_first'")" = "1"

# Stop owns tenant/control UPDATE locks first. Accept waits, observes the
# committed stop, and rejects without creating either a job or a receipt.
psql -v ON_ERROR_STOP=1 -c "update tenant_runtime_controls set processing_state = 'enabled' where tenant_id = 'tenant_ingress_race'" >/dev/null
PGAPPNAME=ingress-stop-first psql -v ON_ERROR_STOP=1 >"$workdir/stop-first.out" 2>"$workdir/stop-first.err" <<'SQL' &
set statement_timeout = '5s';
begin;
select id from tenants where id = 'tenant_ingress_race' for update;
update tenant_runtime_controls
   set processing_state = 'stopped', pause_generation = pause_generation + 1
 where tenant_id = 'tenant_ingress_race';
select pg_sleep(2);
commit;
SQL
stop_pid=$!
wait_for_pg_sleep ingress-stop-first
if psql -v ON_ERROR_STOP=1 -Atqc \
  "select accept_provider_ingress_event('d4ac846d-1886-4ea6-a842-2d2f727d10d9', 'resend', 'email_stop_first', 'email.received', repeat('b', 64), '{\"event\":\"email.received\",\"message_id\":\"email_stop_first\",\"body_available\":false}'::jsonb, now())" \
  >"$workdir/blocked-accept.out" 2>"$workdir/blocked-accept.err"; then
  echo "provider ingress unexpectedly crossed a committed tenant stop" >&2
  exit 1
fi
wait "$stop_pid"
grep -q 'provider ingress is stopped' "$workdir/blocked-accept.err"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from provider_ingress_receipts where provider_event_id = 'email_stop_first'")" = "0"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from jobs where dedupe_key like 'provider-ingress:%'")" = "1"

echo "Provider ingress authority concurrency contract passed."
