\set ON_ERROR_STOP on

begin;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';

insert into plans (
  id, name, included_locations, included_voice_minutes, included_emails,
  included_users, overage_voice_minute_cents
) values ('plan_policy_currentness_contract', 'Policy currentness contract', 2, 0, 0, 4, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values
  ('tenant_policy_currentness_contract', 'Policy Currentness Contract',
   'policy-currentness-contract', 'active', 'plan_policy_currentness_contract',
   'pilot', 'concierge'),
  ('tenant_policy_currentness_foreign', 'Policy Currentness Foreign',
   'policy-currentness-foreign', 'active', 'plan_policy_currentness_contract',
   'pilot', 'concierge');

insert into locations (id, tenant_id, name, address, timezone, status)
values (
  'location_policy_currentness_contract', 'tenant_policy_currentness_contract',
  'Policy Currentness Contract', 'Test', 'UTC', 'active'
);

insert into neon_auth."user" (id)
values
  ('00000000-0000-0000-0000-000000000731'),
  ('00000000-0000-0000-0000-000000000732'),
  ('00000000-0000-0000-0000-000000000733'),
  ('00000000-0000-0000-0000-000000000734');

insert into users (id, external_auth_id, email, name)
values
  ('user_policy_currentness_owner', '00000000-0000-0000-0000-000000000731',
   'policy-currentness-owner@example.com', 'Policy Currentness Owner'),
  ('user_policy_currentness_disabled', '00000000-0000-0000-0000-000000000732',
   'policy-currentness-disabled@example.com', 'Policy Currentness Disabled'),
  ('user_policy_currentness_staff', '00000000-0000-0000-0000-000000000733',
   'policy-currentness-staff@example.com', 'Policy Currentness Staff'),
  ('user_policy_currentness_foreign', '00000000-0000-0000-0000-000000000734',
   'policy-currentness-foreign@example.com', 'Policy Currentness Foreign');

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values
  ('membership_policy_currentness_owner', 'tenant_policy_currentness_contract',
   'user_policy_currentness_owner', 'owner', 'active'),
  ('membership_policy_currentness_disabled', 'tenant_policy_currentness_contract',
   'user_policy_currentness_disabled', 'owner', 'disabled'),
  ('membership_policy_currentness_staff', 'tenant_policy_currentness_contract',
   'user_policy_currentness_staff', 'staff', 'active'),
  ('membership_policy_currentness_foreign', 'tenant_policy_currentness_foreign',
   'user_policy_currentness_foreign', 'owner', 'active');

select runtime_policy_current_source_state(
  'tenant_policy_currentness_contract', 'location_policy_currentness_contract'
)::text as source_state \gset
select set_config('outpost.test_policy_currentness_source', :'source_state', true);

insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
) values (
  'runtime_policy_currentness_candidate_1',
  'tenant_policy_currentness_contract',
  'location_policy_currentness_contract',
  1,
  1,
  1,
  encode(digest(:'source_state'::jsonb::text, 'sha256'), 'hex'),
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  'user_policy_currentness_owner',
  'candidate:policy-currentness:1'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000731',
  true
);
do $$
declare
  v_result jsonb;
begin
  v_result := check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_1',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  if v_result->>'outcome' <> 'review_required'
     or v_result->>'reason' <> 'not_accepted' then
    raise exception 'unreviewed candidate produced unexpected currentness: %', v_result;
  end if;
end;
$$;
reset role;

insert into runtime_policy_review_decisions (
  id, tenant_id, location_id, candidate_id, decision, decision_sequence,
  decided_by_user_id, candidate_was_latest, creation_key
) values (
  'runtime_policy_currentness_review_1',
  'tenant_policy_currentness_contract',
  'location_policy_currentness_contract',
  'runtime_policy_currentness_candidate_1',
  'accepted',
  1,
  'user_policy_currentness_owner',
  true,
  'review:policy-currentness:accept:1'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000731',
  true
);
do $$
declare
  v_result jsonb;
begin
  v_result := check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_1',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  if v_result->>'outcome' <> 'matches_current_source'
     or v_result->>'reason' <> 'accepted_exact'
     or v_result->>'candidate_id' <> 'runtime_policy_currentness_candidate_1'
     or v_result->>'location_id' <> 'location_policy_currentness_contract'
     or nullif(v_result->>'checked_at', '') is null then
    raise exception 'exact accepted currentness was not bounded correctly: %', v_result;
  end if;

  v_result := check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_1',
    '{"answerTopics":[{"kind":"create_staff_task","sourceAnswerId":"changed","topic":"Changed","topicKey":"changed"}],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  if v_result->>'reason' <> 'source_or_candidate_changed' then
    raise exception 'body drift produced unexpected currentness: %', v_result;
  end if;

  v_result := check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_1',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    jsonb_set(
      current_setting('outpost.test_policy_currentness_source')::jsonb,
      '{tenantId}',
      '"tenant_changed"'::jsonb
    )
  );
  if v_result->>'reason' <> 'source_or_candidate_changed' then
    raise exception 'source drift produced unexpected currentness: %', v_result;
  end if;

  begin
    perform check_runtime_policy_review_currentness(
      'runtime_policy_currentness_candidate_1',
      '{}'::jsonb,
      current_setting('outpost.test_policy_currentness_source')::jsonb
    );
    raise exception 'malformed policy body unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform check_runtime_policy_review_currentness(
      'runtime_policy_currentness_candidate_1',
      '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
      jsonb_build_object('oversized', repeat('x', 4194305))
    );
    raise exception 'oversized source state unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
reset role;

insert into runtime_policy_review_decisions (
  id, tenant_id, location_id, candidate_id, decision, decision_sequence,
  decided_by_user_id, candidate_was_latest, previous_decision_id, creation_key
) values (
  'runtime_policy_currentness_review_2',
  'tenant_policy_currentness_contract',
  'location_policy_currentness_contract',
  'runtime_policy_currentness_candidate_1',
  'rejected',
  2,
  'user_policy_currentness_owner',
  true,
  'runtime_policy_currentness_review_1',
  'review:policy-currentness:reject:2'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000731',
  true
);
do $$
declare
  v_result jsonb;
begin
  v_result := check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_1',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  if v_result->>'reason' <> 'not_accepted' then
    raise exception 'rejected candidate produced unexpected currentness: %', v_result;
  end if;
end;
$$;
reset role;

insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
) values (
  'runtime_policy_currentness_candidate_2',
  'tenant_policy_currentness_contract',
  'location_policy_currentness_contract',
  1,
  1,
  2,
  encode(digest(:'source_state'::jsonb::text, 'sha256'), 'hex'),
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  'user_policy_currentness_owner',
  'candidate:policy-currentness:2'
);

insert into runtime_policy_review_decisions (
  id, tenant_id, location_id, candidate_id, decision, decision_sequence,
  decided_by_user_id, candidate_was_latest, creation_key
) values (
  'runtime_policy_currentness_review_3',
  'tenant_policy_currentness_contract',
  'location_policy_currentness_contract',
  'runtime_policy_currentness_candidate_2',
  'accepted',
  1,
  'user_policy_currentness_owner',
  true,
  'review:policy-currentness:accept:3'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000731',
  true
);
do $$
declare
  v_result jsonb;
begin
  v_result := check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_1',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  if v_result->>'reason' <> 'source_or_candidate_changed' then
    raise exception 'superseded candidate produced unexpected currentness: %', v_result;
  end if;
end;
$$;
reset role;

insert into handoff_rules (
  id, tenant_id, location_id, topic, trigger, action, destination,
  active_window, priority, status
) values (
  'handoff_policy_currentness_drift', 'tenant_policy_currentness_contract',
  'location_policy_currentness_contract', 'Drift', 'topic', 'create_task',
  'front desk', 'always', 10, 'active'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000731',
  true
);
do $$
declare
  v_result jsonb;
begin
  v_result := check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_2',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  if v_result->>'reason' <> 'source_or_candidate_changed' then
    raise exception 'database source drift produced unexpected currentness: %', v_result;
  end if;
end;
$$;
reset role;

delete from handoff_rules where id = 'handoff_policy_currentness_drift';
update locations
   set status = 'paused'
 where id = 'location_policy_currentness_contract';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000731',
  true
);
do $$
declare
  v_result jsonb;
begin
  v_result := check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_2',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  if v_result->>'reason' <> 'source_or_candidate_changed' then
    raise exception 'inactive location produced unexpected currentness: %', v_result;
  end if;
end;
$$;
reset role;

update locations
   set status = 'active'
 where id = 'location_policy_currentness_contract';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000733',
  true
);
do $$
begin
  perform check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_2',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  raise exception 'staff currentness unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform count(*) from runtime_policy_snapshots;
  raise exception 'staff direct candidate read unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000732',
  true
);
do $$
begin
  perform check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_2',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  raise exception 'disabled owner currentness unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000734',
  true
);
do $$
begin
  perform check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_2',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  raise exception 'foreign owner currentness unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
reset role;

set local role anonymous;
do $$
begin
  perform check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_2',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  raise exception 'anonymous currentness unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
reset role;

set local role outpost_policy_compiler;
do $$
begin
  perform check_runtime_policy_review_currentness(
    'runtime_policy_currentness_candidate_2',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_currentness_source')::jsonb
  );
  raise exception 'compiler capability currentness unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from runtime_policy_review_decisions
       where tenant_id = 'tenant_policy_currentness_contract') <> 3 then
    raise exception 'currentness reads changed immutable decision history';
  end if;
  if exists (
    select 1
      from audit_events
     where tenant_id = 'tenant_policy_currentness_contract'
       and subject_type like 'runtime_policy%current%'
  ) then
    raise exception 'currentness reads created audit evidence';
  end if;
end;
$$;

rollback;
