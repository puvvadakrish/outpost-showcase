#!/bin/sh
set -eu

if [ "${OUTPOST_DISPOSABLE_DATABASE_CONFIRMATION:-}" != "runtime-policy-candidate-review-manifest-concurrency" ]; then
  echo "Refusing runtime-policy manifest concurrency checks without disposable-database confirmation." >&2
  exit 1
fi

database_name="$(psql -v ON_ERROR_STOP=1 -Atqc 'select current_database()')"
case "$database_name" in
  *_test|*_test_*|test_*) ;;
  *)
    echo "Refusing manifest concurrency harness against non-test database: $database_name" >&2
    exit 1
    ;;
esac

workdir="$(mktemp -d)"
base_database="$database_name"
test_database="outpost_policy_manifest_concurrency_$$_test"

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
) values ('plan_policy_manifest_race', 'Policy manifest race', 1, 0, 0, 2, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values (
  'tenant_policy_manifest_race', 'Policy Manifest Race', 'policy-manifest-race',
  'active', 'plan_policy_manifest_race', 'pilot', 'concierge'
);

insert into locations (id, tenant_id, name, address, timezone, status)
values (
  'location_policy_manifest_race', 'tenant_policy_manifest_race',
  'Policy Manifest Race', 'Test', 'UTC', 'active'
);

insert into neon_auth."user" (id)
values ('00000000-0000-0000-0000-000000000795');

insert into users (id, external_auth_id, email, name)
values (
  'user_policy_manifest_race', '00000000-0000-0000-0000-000000000795',
  'policy-manifest-race@example.com', 'Policy Manifest Race'
);

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values (
  'membership_policy_manifest_race', 'tenant_policy_manifest_race',
  'user_policy_manifest_race', 'owner', 'active'
);

insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
) values (
  'runtime_policy_manifest_race_1', 'tenant_policy_manifest_race',
  'location_policy_manifest_race', 1, 1, 1, repeat('a', 64),
  '{
    "answerTopics":[
      {"answer":"Approved answer","kind":"answer","sourceAnswerId":"answer_race","topic":"Membership","topicKey":"membership"},
      {"kind":"create_staff_task","sourceAnswerId":"answer_staff_race","topic":"Billing","topicKey":"billing"}
    ],
    "defaultPolicy":{"kind":"create_staff_task"},
    "handoffs":[
      {"action":"create_task","activeWindow":"Always","destination":"staff","priority":1,"sourceRuleId":"handoff_race","topic":"Cancellation","trigger":"topic"}
    ],
    "warnings":[]
  }'::jsonb,
  'user_policy_manifest_race', 'candidate:policy-manifest-race:1'
);
SQL

candidate_policy_body='{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'
source_state="$(psql -v ON_ERROR_STOP=1 -Atq -c "select runtime_policy_current_source_state('tenant_policy_manifest_race', 'location_policy_manifest_race')::text")"
intent_token="$(psql -v ON_ERROR_STOP=1 -Atq -v policy_body="$candidate_policy_body" <<'SQL'
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000795',
  false
) as authenticated_subject \gset
select issue_runtime_policy_candidate_intent(
  'tenant_policy_manifest_race',
  'location_policy_manifest_race',
  1,
  :'policy_body'::jsonb
);
SQL
)"

wait_for_reader() {
  attempts=0
  while [ "$attempts" -lt 100 ]; do
    if [ "$(psql -v ON_ERROR_STOP=1 -Atqc "select exists (select 1 from pg_stat_activity where application_name = 'policy-manifest-reader' and wait_event = 'PgSleep')")" = "t" ]; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 0.05
  done
  echo "Timed out waiting for the manifest reader statement." >&2
  return 1
}

PGAPPNAME=policy-manifest-reader psql -v ON_ERROR_STOP=1 -At \
  >"$workdir/reader.out" 2>"$workdir/reader.err" <<'SQL' &
set statement_timeout = '5s';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000795', false);
select (manifest->>'snapshot_version') || ':' ||
       (manifest->>'answer_topic_count') || ':' ||
       (manifest->>'handoff_count') || ':' ||
       (manifest->>'answer_topics_has_more') || ':' ||
       (manifest->>'handoffs_has_more') || ':' ||
       (manifest->>'default_behavior'),
       pg_sleep(2)
  from (
    select get_runtime_policy_candidate_review_manifest(
      'runtime_policy_manifest_race_1'
    ) manifest
  ) result;
SQL
reader_pid=$!
wait_for_reader

psql -v ON_ERROR_STOP=1 \
  -v intent_token="$intent_token" \
  -v policy_body="$candidate_policy_body" \
  -v source_state="$source_state" \
  >"$workdir/candidate-writer.out" 2>"$workdir/candidate-writer.err" <<'SQL'
set statement_timeout = '1s';
set role outpost_policy_compiler;
select record_runtime_policy_candidate(
  :'intent_token',
  :'policy_body'::jsonb,
  :'source_state'::jsonb
);
SQL

psql -v ON_ERROR_STOP=1 >"$workdir/decision-writer.out" 2>"$workdir/decision-writer.err" <<'SQL'
set statement_timeout = '1s';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000795', false);
select record_runtime_policy_rejection(
  'runtime_policy_manifest_race_1',
  'review:policy-manifest-race:1'
);
SQL

wait "$reader_pid"

grep -q '^1:2:1:false:false:create_staff_task|$' "$workdir/reader.out"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from runtime_policy_snapshots where tenant_id = 'tenant_policy_manifest_race'")" = "2"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from runtime_policy_review_decisions where tenant_id = 'tenant_policy_manifest_race'")" = "1"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from audit_events where tenant_id = 'tenant_policy_manifest_race' and action = 'runtime_policy.candidate_recorded'")" = "1"
test "$(psql -v ON_ERROR_STOP=1 -Atqc "select count(*) from audit_events where tenant_id = 'tenant_policy_manifest_race' and action = 'runtime_policy.review_rejected'")" = "1"

echo "Runtime policy candidate review manifest concurrency contract passed."
