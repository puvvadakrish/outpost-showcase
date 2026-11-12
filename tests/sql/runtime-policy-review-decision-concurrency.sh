#!/bin/sh
set -eu

if [ "${OUTPOST_DISPOSABLE_DATABASE_CONFIRMATION:-}" != "runtime-policy-review-decision-concurrency" ]; then
  echo "Refusing runtime-policy review concurrency checks without disposable-database confirmation." >&2
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
test_database="outpost_policy_review_concurrency_$$_test"

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
) values ('plan_policy_review_race', 'Policy review race', 1, 0, 0, 2, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values (
  'tenant_policy_review_race', 'Policy Review Race', 'policy-review-race',
  'active', 'plan_policy_review_race', 'pilot', 'concierge'
);

insert into locations (id, tenant_id, name, address, timezone, status)
values (
  'location_policy_review_race', 'tenant_policy_review_race',
  'Policy Review Race', 'Test', 'UTC', 'active'
);

insert into neon_auth."user" (id)
values
  ('00000000-0000-0000-0000-000000000721'),
  ('00000000-0000-0000-0000-000000000722');

insert into users (id, external_auth_id, email, name)
values
  ('user_policy_review_race_a', '00000000-0000-0000-0000-000000000721',
   'policy-review-race-a@example.com', 'Policy Review Race A'),
  ('user_policy_review_race_b', '00000000-0000-0000-0000-000000000722',
   'policy-review-race-b@example.com', 'Policy Review Race B');

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values
  ('membership_policy_review_race_a', 'tenant_policy_review_race',
   'user_policy_review_race_a', 'owner', 'active'),
  ('membership_policy_review_race_b', 'tenant_policy_review_race',
   'user_policy_review_race_b', 'owner', 'active');

insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
)
select 'runtime_policy_review_race_candidate_1',
       'tenant_policy_review_race',
       'location_policy_review_race',
       1,
       1,
       1,
       encode(digest(runtime_policy_current_source_state(
         'tenant_policy_review_race', 'location_policy_review_race'
       )::text, 'sha256'), 'hex'),
       '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
       'user_policy_review_race_a',
       'candidate:policy-review-race:1';
SQL

source_state="$(psql -v ON_ERROR_STOP=1 -Atqc "select runtime_policy_current_source_state('tenant_policy_review_race', 'location_policy_review_race')::text")"

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
  echo "Timed out waiting for $application_name to hold the candidate lock." >&2
  return 1
}

PGAPPNAME=policy-review-reject-first psql -v ON_ERROR_STOP=1 \
  >"$workdir/reject-first.out" 2>"$workdir/reject-first.err" <<'SQL' &
set statement_timeout = '5s';
begin;
select id from locations
 where id = 'location_policy_review_race'
 for update;
select id from runtime_policy_snapshots
 where id = 'runtime_policy_review_race_candidate_1'
 for update;
select pg_sleep(2);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000721', true);
select record_runtime_policy_rejection(
  'runtime_policy_review_race_candidate_1', 'review:race-a:reject:1'
);
commit;
SQL
reject_pid=$!
wait_for_pg_sleep policy-review-reject-first

psql -v ON_ERROR_STOP=1 -v source_state="$source_state" \
  >"$workdir/accept-second.out" 2>"$workdir/accept-second.err" <<'SQL' &
set statement_timeout = '5s';
select set_config('outpost.test_source_state', :'source_state', false);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000722', false);
select record_runtime_policy_acceptance(
  'runtime_policy_review_race_candidate_1',
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  current_setting('outpost.test_source_state')::jsonb,
  'review:race-b:accept:1'
);
SQL
accept_pid=$!

wait "$reject_pid"
wait "$accept_pid"

test "$(psql -v ON_ERROR_STOP=1 -Atqc "select array_agg(decision order by decision_sequence)::text from runtime_policy_review_decisions where candidate_id = 'runtime_policy_review_race_candidate_1'")" = "{rejected,accepted}"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from runtime_policy_review_decisions where candidate_id = 'runtime_policy_review_race_candidate_1' and previous_decision_id is not null")" = "1"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from audit_events where subject_type = 'runtime_policy_review_decision'")" = "2"

psql -v ON_ERROR_STOP=1 <<'SQL'
insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
)
select 'runtime_policy_review_race_candidate_2',
       'tenant_policy_review_race',
       'location_policy_review_race',
       1,
       1,
       2,
       encode(digest(runtime_policy_current_source_state(
         'tenant_policy_review_race', 'location_policy_review_race'
       )::text, 'sha256'), 'hex'),
       '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
       'user_policy_review_race_a',
       'candidate:policy-review-race:2';
SQL

PGAPPNAME=policy-review-same-state-first psql -v ON_ERROR_STOP=1 \
  >"$workdir/same-first.out" 2>"$workdir/same-first.err" <<'SQL' &
set statement_timeout = '5s';
begin;
select id from locations
 where id = 'location_policy_review_race'
 for update;
select id from runtime_policy_snapshots
 where id = 'runtime_policy_review_race_candidate_2'
 for update;
select pg_sleep(2);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000721', true);
select record_runtime_policy_rejection(
  'runtime_policy_review_race_candidate_2', 'review:race-a:reject:2'
);
commit;
SQL
same_first_pid=$!
wait_for_pg_sleep policy-review-same-state-first

psql -v ON_ERROR_STOP=1 >"$workdir/same-second.out" 2>"$workdir/same-second.err" <<'SQL' &
set statement_timeout = '5s';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000722', false);
select record_runtime_policy_rejection(
  'runtime_policy_review_race_candidate_2', 'review:race-b:reject:2'
);
SQL
same_second_pid=$!

wait "$same_first_pid"
wait "$same_second_pid"

test "$(psql -v ON_ERROR_STOP=1 -Atqc "select array_agg(decided_by_user_id order by decision_sequence)::text from runtime_policy_review_decisions where candidate_id = 'runtime_policy_review_race_candidate_2'")" = "{user_policy_review_race_a,user_policy_review_race_b}"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from runtime_policy_review_decisions where candidate_id = 'runtime_policy_review_race_candidate_2'")" = "2"

PGAPPNAME=policy-review-candidate-create-first psql -v ON_ERROR_STOP=1 \
  >"$workdir/candidate-create-first.out" 2>"$workdir/candidate-create-first.err" <<'SQL' &
set statement_timeout = '5s';
begin;
select id from locations
 where id = 'location_policy_review_race'
 for update;
insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
)
select 'runtime_policy_review_race_candidate_3',
       'tenant_policy_review_race',
       'location_policy_review_race',
       1,
       1,
       3,
       encode(digest(runtime_policy_current_source_state(
         'tenant_policy_review_race', 'location_policy_review_race'
       )::text, 'sha256'), 'hex'),
       '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
       'user_policy_review_race_a',
       'candidate:policy-review-race:3';
select pg_sleep(2);
commit;
SQL
candidate_create_pid=$!
wait_for_pg_sleep policy-review-candidate-create-first

if psql -v ON_ERROR_STOP=1 -v source_state="$source_state" \
  >"$workdir/stale-accept.out" 2>"$workdir/stale-accept.err" <<'SQL'
set statement_timeout = '5s';
select set_config('outpost.test_source_state', :'source_state', false);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000721', false);
select record_runtime_policy_acceptance(
  'runtime_policy_review_race_candidate_2',
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  current_setting('outpost.test_source_state')::jsonb,
  'review:race-a:accept:stale-after-create'
);
SQL
then
  echo "Acceptance of a candidate superseded under the shared location lock unexpectedly succeeded." >&2
  exit 1
fi
wait "$candidate_create_pid"
grep -q "runtime policy acceptance requires the latest candidate" "$workdir/stale-accept.err"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from runtime_policy_review_decisions where candidate_id = 'runtime_policy_review_race_candidate_2' and decision = 'accepted'")" = "0"

echo "Runtime policy review decision concurrency contract passed."
