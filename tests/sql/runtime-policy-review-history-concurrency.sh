#!/bin/sh
set -eu

if [ "${OUTPOST_DISPOSABLE_DATABASE_CONFIRMATION:-}" != "runtime-policy-review-history-concurrency" ]; then
  echo "Refusing runtime-policy history concurrency checks without disposable-database confirmation." >&2
  exit 1
fi

database_name="$(psql -v ON_ERROR_STOP=1 -Atqc 'select current_database()')"
case "$database_name" in
  *_test|*_test_*|test_*) ;;
  *)
    echo "Refusing history concurrency harness against non-test database: $database_name" >&2
    exit 1
    ;;
esac

workdir="$(mktemp -d)"
base_database="$database_name"
test_database="outpost_policy_history_concurrency_$$_test"

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
) values ('plan_policy_history_race', 'Policy history race', 1, 0, 0, 2, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values (
  'tenant_policy_history_race', 'Policy History Race', 'policy-history-race',
  'active', 'plan_policy_history_race', 'pilot', 'concierge'
);

insert into locations (id, tenant_id, name, address, timezone, status)
values (
  'location_policy_history_race', 'tenant_policy_history_race',
  'Policy History Race', 'Test', 'UTC', 'active'
);

insert into neon_auth."user" (id)
values ('00000000-0000-0000-0000-000000000761');

insert into users (id, external_auth_id, email, name)
values (
  'user_policy_history_race', '00000000-0000-0000-0000-000000000761',
  'policy-history-race@example.com', 'Policy History Race'
);

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values (
  'membership_policy_history_race', 'tenant_policy_history_race',
  'user_policy_history_race', 'owner', 'active'
);

insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
) values (
  'runtime_policy_history_race_candidate_1', 'tenant_policy_history_race',
  'location_policy_history_race', 1, 1, 1, repeat('a', 64),
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  'user_policy_history_race', 'candidate:policy-history-race:1'
);

insert into runtime_policy_review_decisions (
  id, tenant_id, location_id, candidate_id, decision, decision_sequence,
  decided_by_user_id, candidate_was_latest, creation_key
) values (
  'runtime_policy_history_race_review_1', 'tenant_policy_history_race',
  'location_policy_history_race', 'runtime_policy_history_race_candidate_1',
  'accepted', 1, 'user_policy_history_race', true,
  'review:policy-history-race:1'
);
SQL

wait_for_reader() {
  attempts=0
  while [ "$attempts" -lt 100 ]; do
    if [ "$(psql -v ON_ERROR_STOP=1 -Atqc "select exists (select 1 from pg_stat_activity where application_name = 'policy-history-reader' and wait_event = 'PgSleep')")" = "t" ]; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 0.05
  done
  echo "Timed out waiting for the history reader transaction." >&2
  return 1
}

PGAPPNAME=policy-history-reader psql -v ON_ERROR_STOP=1 -At \
  >"$workdir/reader.out" 2>"$workdir/reader.err" <<'SQL' &
set statement_timeout = '5s';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000761', true);
select (history->>'total_decision_count') || ':' || jsonb_array_length(history->'entries')
  from (select get_runtime_policy_review_history('runtime_policy_history_race_candidate_1') history) result;
select pg_sleep(2);
commit;
SQL
reader_pid=$!
wait_for_reader

psql -v ON_ERROR_STOP=1 >"$workdir/decision-writer.out" 2>"$workdir/decision-writer.err" <<'SQL'
set statement_timeout = '1s';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000761', false);
select record_runtime_policy_rejection(
  'runtime_policy_history_race_candidate_1',
  'review:policy-history-race:2'
);
SQL

psql -v ON_ERROR_STOP=1 >"$workdir/candidate-writer.out" 2>"$workdir/candidate-writer.err" <<'SQL'
set statement_timeout = '1s';
insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
) values (
  'runtime_policy_history_race_candidate_2', 'tenant_policy_history_race',
  'location_policy_history_race', 1, 1, 2, repeat('b', 64),
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  'user_policy_history_race', 'candidate:policy-history-race:2'
);
SQL

wait "$reader_pid"

grep -q '^1:1$' "$workdir/reader.out"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from runtime_policy_snapshots where tenant_id = 'tenant_policy_history_race'")" = "2"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from runtime_policy_review_decisions where tenant_id = 'tenant_policy_history_race'")" = "2"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from audit_events where tenant_id = 'tenant_policy_history_race' and action = 'runtime_policy.review_rejected'")" = "1"

echo "Runtime policy review history concurrency contract passed."
