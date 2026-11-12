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
) values ('plan_policy_history_contract', 'Policy history contract', 3, 0, 0, 8, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values
  ('tenant_policy_history_contract', 'Policy History Contract',
   'policy-history-contract', 'active', 'plan_policy_history_contract', 'pilot', 'concierge'),
  ('tenant_policy_history_foreign', 'Policy History Foreign',
   'policy-history-foreign', 'active', 'plan_policy_history_contract', 'pilot', 'concierge');

insert into locations (id, tenant_id, name, address, timezone, status)
values
  ('location_policy_history_contract', 'tenant_policy_history_contract',
   'Policy History Contract', 'Test', 'UTC', 'active'),
  ('location_policy_history_foreign', 'tenant_policy_history_foreign',
   'Policy History Foreign', 'Test', 'UTC', 'active');

insert into neon_auth."user" (id)
values
  ('00000000-0000-0000-0000-000000000751'),
  ('00000000-0000-0000-0000-000000000752'),
  ('00000000-0000-0000-0000-000000000753'),
  ('00000000-0000-0000-0000-000000000754');

insert into users (id, external_auth_id, email, name)
values
  ('user_policy_history_owner', '00000000-0000-0000-0000-000000000751',
   'policy-history-owner@example.com', 'Policy History Owner'),
  ('user_policy_history_staff', '00000000-0000-0000-0000-000000000752',
   'policy-history-staff@example.com', 'Policy History Staff'),
  ('user_policy_history_disabled', '00000000-0000-0000-0000-000000000753',
   'policy-history-disabled@example.com', 'Policy History Disabled'),
  ('user_policy_history_foreign', '00000000-0000-0000-0000-000000000754',
   'policy-history-foreign@example.com', 'Policy History Foreign');

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values
  ('membership_policy_history_owner', 'tenant_policy_history_contract',
   'user_policy_history_owner', 'owner', 'active'),
  ('membership_policy_history_staff', 'tenant_policy_history_contract',
   'user_policy_history_staff', 'staff', 'active'),
  ('membership_policy_history_disabled', 'tenant_policy_history_contract',
   'user_policy_history_disabled', 'owner', 'disabled'),
  ('membership_policy_history_foreign', 'tenant_policy_history_foreign',
   'user_policy_history_foreign', 'owner', 'active');

insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
) values
  ('runtime_policy_history_candidate_1', 'tenant_policy_history_contract',
   'location_policy_history_contract', 1, 1, 1, repeat('a', 64),
   '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
   'user_policy_history_owner', 'candidate:policy-history:1'),
  ('runtime_policy_history_candidate_empty', 'tenant_policy_history_contract',
   'location_policy_history_contract', 1, 1, 2, repeat('b', 64),
   '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
   'user_policy_history_owner', 'candidate:policy-history:empty'),
  ('runtime_policy_history_candidate_one', 'tenant_policy_history_contract',
   'location_policy_history_contract', 1, 1, 3, repeat('d', 64),
   '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
   'user_policy_history_owner', 'candidate:policy-history:one'),
  ('runtime_policy_history_candidate_five', 'tenant_policy_history_contract',
   'location_policy_history_contract', 1, 1, 4, repeat('e', 64),
   '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
   'user_policy_history_owner', 'candidate:policy-history:five'),
  ('runtime_policy_history_candidate_six', 'tenant_policy_history_contract',
   'location_policy_history_contract', 1, 1, 5, repeat('f', 64),
   '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
   'user_policy_history_owner', 'candidate:policy-history:six'),
  ('runtime_policy_history_candidate_foreign', 'tenant_policy_history_foreign',
   'location_policy_history_foreign', 1, 1, 1, repeat('c', 64),
   '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
   'user_policy_history_foreign', 'candidate:policy-history:foreign');

insert into runtime_policy_review_decisions (
  id, tenant_id, location_id, candidate_id, decision, decision_sequence,
  decided_by_user_id, candidate_was_latest, creation_key, created_at
)
select 'runtime_policy_history_review_' || sequence_number,
       'tenant_policy_history_contract',
       'location_policy_history_contract',
       'runtime_policy_history_candidate_1',
       case when sequence_number % 2 = 0 then 'rejected' else 'accepted' end,
       sequence_number,
       'user_policy_history_owner',
       true,
       'review:policy-history:' || sequence_number,
       '2026-07-14 12:00:00+00'::timestamptz + sequence_number * interval '1 minute'
  from generate_series(1, 7) sequence_number;

insert into runtime_policy_review_decisions (
  id, tenant_id, location_id, candidate_id, decision, decision_sequence,
  decided_by_user_id, candidate_was_latest, creation_key, created_at
)
select 'runtime_policy_history_boundary_' || boundary.label || '_' || sequence_number,
       'tenant_policy_history_contract',
       'location_policy_history_contract',
       'runtime_policy_history_candidate_' || boundary.label,
       case when sequence_number % 2 = 0 then 'rejected' else 'accepted' end,
       sequence_number,
       'user_policy_history_owner',
       false,
       'review:policy-history-boundary:' || boundary.label || ':' || sequence_number,
       '2026-07-14 13:00:00+00'::timestamptz + sequence_number * interval '1 minute'
  from (values ('one', 1), ('five', 5), ('six', 6)) boundary(label, decision_count)
 cross join lateral generate_series(1, boundary.decision_count) sequence_number;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000751', true);
do $$
declare
  v_entry jsonb;
  v_expected_count bigint;
  v_expected_has_more boolean;
  v_expected_window bigint;
  v_label text;
  v_result jsonb;
begin
  v_result := get_runtime_policy_review_history('runtime_policy_history_candidate_1');
  if v_result->>'candidate_id' <> 'runtime_policy_history_candidate_1'
     or v_result->>'location_id' <> 'location_policy_history_contract'
     or (v_result->>'snapshot_version')::bigint <> 1
     or (v_result->>'total_decision_count')::bigint <> 7
     or (v_result->>'has_more')::boolean is not true
     or jsonb_array_length(v_result->'entries') <> 5 then
    raise exception 'bounded history envelope is invalid: %', v_result;
  end if;
  if (v_result#>>'{entries,0,decision_sequence}')::bigint <> 7
     or (v_result#>>'{entries,4,decision_sequence}')::bigint <> 3 then
    raise exception 'history ordering is invalid: %', v_result;
  end if;
  for v_entry in select value from jsonb_array_elements(v_result->'entries') loop
    if (select array_agg(key order by key) from jsonb_object_keys(v_entry) key)
       <> array['created_at', 'decision', 'decision_sequence'] then
      raise exception 'history entry leaked fields: %', v_entry;
    end if;
  end loop;
  if v_result::text ~ '(decided_by|creation_key|previous_decision|policy_body|source_digest|audit)' then
    raise exception 'history envelope leaked private evidence: %', v_result;
  end if;

  v_result := get_runtime_policy_review_history('runtime_policy_history_candidate_empty');
  if (v_result->>'total_decision_count')::bigint <> 0
     or (v_result->>'has_more')::boolean
     or v_result->'entries' <> '[]'::jsonb then
    raise exception 'empty history envelope is invalid: %', v_result;
  end if;

  for v_label, v_expected_count, v_expected_window, v_expected_has_more in values
    ('one', 1::bigint, 1::bigint, false),
    ('five', 5::bigint, 5::bigint, false),
    ('six', 6::bigint, 5::bigint, true)
  loop
    v_result := get_runtime_policy_review_history(
      'runtime_policy_history_candidate_' || v_label
    );
    if (v_result->>'total_decision_count')::bigint <> v_expected_count
       or jsonb_array_length(v_result->'entries') <> v_expected_window
       or (v_result->>'has_more')::boolean is distinct from v_expected_has_more then
      raise exception 'history boundary % is invalid: %', v_label, v_result;
    end if;
  end loop;
end;
$$;
reset role;

set local role authenticated;
do $$
declare
  v_candidate_id text;
  v_subject text;
begin
  for v_subject, v_candidate_id in values
    ('00000000-0000-0000-0000-000000000752', 'runtime_policy_history_candidate_1'),
    ('00000000-0000-0000-0000-000000000753', 'runtime_policy_history_candidate_1'),
    ('00000000-0000-0000-0000-000000000754', 'runtime_policy_history_candidate_1'),
    ('00000000-0000-0000-0000-000000000751', 'runtime_policy_history_candidate_missing')
  loop
    perform set_config('request.jwt.claim.sub', v_subject, true);
    begin
      perform get_runtime_policy_review_history(v_candidate_id);
      raise exception 'unauthorized history read unexpectedly succeeded for %', v_subject;
    exception when insufficient_privilege then
      if sqlerrm <> 'active tenant owner required' then
        raise exception 'history denial leaked scope: %', sqlerrm;
      end if;
    end;
  end loop;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000752', true);
  if (select count(*) from audit_events
       where subject_type = 'runtime_policy_review_decision') <> 0 then
    raise exception 'staff can read owner-only runtime policy review audit';
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform get_runtime_policy_review_history('runtime_policy_history_candidate_1');
    raise exception 'missing actor unexpectedly read history';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
begin
  if not has_function_privilege('authenticated', 'get_runtime_policy_review_history(text)', 'execute')
     or has_function_privilege('anonymous', 'get_runtime_policy_review_history(text)', 'execute')
     or has_function_privilege('outpost_policy_compiler', 'get_runtime_policy_review_history(text)', 'execute') then
    raise exception 'runtime policy history execute grants are invalid';
  end if;
  if has_table_privilege('authenticated', 'runtime_policy_review_decisions', 'select')
     or has_table_privilege('outpost_policy_compiler', 'runtime_policy_review_decisions', 'select') then
    raise exception 'runtime policy history widened relation authority';
  end if;
end;
$$;

do $$
declare
  v_audits bigint;
  v_decisions bigint;
begin
  select count(*) into v_decisions from runtime_policy_review_decisions
   where candidate_id = 'runtime_policy_history_candidate_1';
  select count(*) into v_audits from audit_events
   where tenant_id = 'tenant_policy_history_contract';
  if v_decisions <> 7 or v_audits <> 0 then
    raise exception 'history reads changed durable evidence';
  end if;
end;
$$;

rollback;

select 'Runtime policy review history authority contract passed.' as result;
