#!/bin/sh
set -eu

if [ "${OUTPOST_DISPOSABLE_DATABASE_CONFIRMATION:-}" != "runtime-policy-candidate-lineage-concurrency" ]; then
  echo "Refusing runtime-policy lineage concurrency checks without disposable-database confirmation." >&2
  exit 1
fi

database_name="$(psql -v ON_ERROR_STOP=1 -Atqc 'select current_database()')"
case "$database_name" in
  *_test|*_test_*|test_*) ;;
  *)
    echo "Refusing lineage concurrency harness against non-test database: $database_name" >&2
    exit 1
    ;;
esac

workdir="$(mktemp -d)"
base_database="$database_name"
test_database="outpost_policy_lineage_concurrency_$$_test"

cleanup() {
  set +e
  PGDATABASE="$base_database" dropdb --if-exists "$test_database" >/dev/null 2>&1
  rm -rf "$workdir"
}
trap cleanup EXIT HUP INT TERM

createdb --template="$base_database" "$test_database"
export PGDATABASE="$test_database"

psql -v ON_ERROR_STOP=1 <<'SQL'
create or replace function auth.uid()
returns uuid
language sql
stable
as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';

insert into plans (
  id, name, included_locations, included_voice_minutes, included_emails,
  included_users, overage_voice_minute_cents
) values ('plan_policy_lineage_race', 'Policy lineage race', 1, 0, 0, 2, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values (
  'tenant_policy_lineage_race', 'Policy Lineage Race', 'policy-lineage-race',
  'active', 'plan_policy_lineage_race', 'pilot', 'concierge'
);

insert into locations (id, tenant_id, name, address, timezone, status)
values (
  'location_policy_lineage_race', 'tenant_policy_lineage_race',
  'Policy Lineage Race', 'Test', 'UTC', 'active'
);

insert into neon_auth."user" (id)
values ('00000000-0000-0000-0000-000000000781');

insert into users (id, external_auth_id, email, name)
values (
  'user_policy_lineage_race', '00000000-0000-0000-0000-000000000781',
  'policy-lineage-race@example.com', 'Policy Lineage Race'
);

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values (
  'membership_policy_lineage_race', 'tenant_policy_lineage_race',
  'user_policy_lineage_race', 'owner', 'active'
);

insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
) values
  ('runtime_policy_lineage_race_1', 'tenant_policy_lineage_race',
   'location_policy_lineage_race', 1, 1, 1, repeat('a', 64),
   '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
   'user_policy_lineage_race', 'candidate:policy-lineage-race:1'),
  ('runtime_policy_lineage_race_2', 'tenant_policy_lineage_race',
   'location_policy_lineage_race', 1, 1, 2, repeat('b', 64),
   '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
   'user_policy_lineage_race', 'candidate:policy-lineage-race:2');
SQL

wait_for_reader() {
  attempts=0
  while [ "$attempts" -lt 100 ]; do
    if [ "$(psql -v ON_ERROR_STOP=1 -Atqc "select exists (select 1 from pg_stat_activity where application_name = 'policy-lineage-reader' and wait_event = 'PgSleep')")" = "t" ]; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 0.05
  done
  echo "Timed out waiting for the lineage reader statement." >&2
  return 1
}

PGAPPNAME=policy-lineage-reader psql -v ON_ERROR_STOP=1 -At \
  >"$workdir/reader.out" 2>"$workdir/reader.err" <<'SQL' &
set statement_timeout = '5s';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000781', false);
select (lineage->>'anchor_snapshot_version') || ':' ||
       jsonb_array_length(lineage->'entries') || ':' ||
       (lineage->>'has_more'),
       pg_sleep(2)
  from (
    select get_runtime_policy_candidate_lineage(
      'runtime_policy_lineage_race_2'
    ) lineage
  ) result;
SQL
reader_pid=$!
wait_for_reader

psql -v ON_ERROR_STOP=1 >"$workdir/candidate-writer.out" 2>"$workdir/candidate-writer.err" <<'SQL'
set statement_timeout = '1s';
insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
) values (
  'runtime_policy_lineage_race_3', 'tenant_policy_lineage_race',
  'location_policy_lineage_race', 1, 1, 3, repeat('c', 64),
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  'user_policy_lineage_race', 'candidate:policy-lineage-race:3'
);
SQL

psql -v ON_ERROR_STOP=1 >"$workdir/decision-writer.out" 2>"$workdir/decision-writer.err" <<'SQL'
set statement_timeout = '1s';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000781', false);
select record_runtime_policy_rejection(
  'runtime_policy_lineage_race_2',
  'review:policy-lineage-race:2'
);
SQL

wait "$reader_pid"

grep -q '^2:1:false|$' "$workdir/reader.out"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from runtime_policy_snapshots where tenant_id = 'tenant_policy_lineage_race'")" = "3"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from runtime_policy_review_decisions where tenant_id = 'tenant_policy_lineage_race'")" = "1"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from audit_events where tenant_id = 'tenant_policy_lineage_race' and action = 'runtime_policy.review_rejected'")" = "1"

echo "Runtime policy candidate lineage concurrency contract passed."
