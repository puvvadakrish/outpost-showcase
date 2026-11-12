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
) values ('plan_policy_manifest_contract', 'Policy manifest contract', 8, 0, 0, 8, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values
  ('tenant_policy_manifest_contract', 'Policy Manifest Contract',
   'policy-manifest-contract', 'active', 'plan_policy_manifest_contract', 'pilot', 'concierge'),
  ('tenant_policy_manifest_foreign', 'Policy Manifest Foreign',
   'policy-manifest-foreign', 'active', 'plan_policy_manifest_contract', 'pilot', 'concierge');

insert into locations (id, tenant_id, name, address, timezone, status)
values
  ('location_policy_manifest_empty', 'tenant_policy_manifest_contract',
   'Policy Manifest Empty', 'Test', 'UTC', 'active'),
  ('location_policy_manifest_small', 'tenant_policy_manifest_contract',
   'Policy Manifest Small', 'Test', 'UTC', 'active'),
  ('location_policy_manifest_ten', 'tenant_policy_manifest_contract',
   'Policy Manifest Ten', 'Test', 'UTC', 'active'),
  ('location_policy_manifest_truncated', 'tenant_policy_manifest_contract',
   'Policy Manifest Truncated', 'Test', 'UTC', 'active'),
  ('location_policy_manifest_unicode', 'tenant_policy_manifest_contract',
   'Policy Manifest Unicode', 'Test', 'UTC', 'active'),
  ('location_policy_manifest_stale', 'tenant_policy_manifest_contract',
   'Policy Manifest Stale', 'Test', 'UTC', 'active'),
  ('location_policy_manifest_inactive', 'tenant_policy_manifest_contract',
   'Policy Manifest Inactive', 'Test', 'UTC', 'paused'),
  ('location_policy_manifest_foreign', 'tenant_policy_manifest_foreign',
   'Policy Manifest Foreign', 'Test', 'UTC', 'active');

insert into neon_auth."user" (id)
values
  ('00000000-0000-0000-0000-000000000791'),
  ('00000000-0000-0000-0000-000000000792'),
  ('00000000-0000-0000-0000-000000000793'),
  ('00000000-0000-0000-0000-000000000794');

insert into users (id, external_auth_id, email, name)
values
  ('user_policy_manifest_owner', '00000000-0000-0000-0000-000000000791',
   'policy-manifest-owner@example.com', 'Policy Manifest Owner'),
  ('user_policy_manifest_staff', '00000000-0000-0000-0000-000000000792',
   'policy-manifest-staff@example.com', 'Policy Manifest Staff'),
  ('user_policy_manifest_disabled', '00000000-0000-0000-0000-000000000793',
   'policy-manifest-disabled@example.com', 'Policy Manifest Disabled'),
  ('user_policy_manifest_foreign', '00000000-0000-0000-0000-000000000794',
   'policy-manifest-foreign@example.com', 'Policy Manifest Foreign');

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values
  ('membership_policy_manifest_owner', 'tenant_policy_manifest_contract',
   'user_policy_manifest_owner', 'owner', 'active'),
  ('membership_policy_manifest_staff', 'tenant_policy_manifest_contract',
   'user_policy_manifest_staff', 'staff', 'active'),
  ('membership_policy_manifest_disabled', 'tenant_policy_manifest_contract',
   'user_policy_manifest_disabled', 'owner', 'disabled'),
  ('membership_policy_manifest_foreign', 'tenant_policy_manifest_foreign',
   'user_policy_manifest_foreign', 'owner', 'active');

with candidates(
  label, tenant_id, location_id, owner_user_id, snapshot_version,
  answer_count, handoff_count
) as (
  values
    ('empty', 'tenant_policy_manifest_contract',
     'location_policy_manifest_empty', 'user_policy_manifest_owner', 1, 0, 0),
    ('small', 'tenant_policy_manifest_contract',
     'location_policy_manifest_small', 'user_policy_manifest_owner', 1, 2, 1),
    ('ten', 'tenant_policy_manifest_contract',
     'location_policy_manifest_ten', 'user_policy_manifest_owner', 1, 10, 10),
    ('truncated', 'tenant_policy_manifest_contract',
     'location_policy_manifest_truncated', 'user_policy_manifest_owner', 1, 15, 12),
    ('stale_1', 'tenant_policy_manifest_contract',
     'location_policy_manifest_stale', 'user_policy_manifest_owner', 1, 1, 1),
    ('stale_2', 'tenant_policy_manifest_contract',
     'location_policy_manifest_stale', 'user_policy_manifest_owner', 2, 0, 0),
    ('inactive', 'tenant_policy_manifest_contract',
     'location_policy_manifest_inactive', 'user_policy_manifest_owner', 1, 1, 1),
    ('foreign', 'tenant_policy_manifest_foreign',
     'location_policy_manifest_foreign', 'user_policy_manifest_foreign', 1, 1, 1)
), candidate_bodies as (
  select candidate.*,
         jsonb_build_object(
           'answerTopics', coalesce((
             select jsonb_agg(
               case when answer_number % 2 = 0 then
                 jsonb_build_object(
                   'kind', 'create_staff_task',
                   'sourceAnswerId', 'answer_' || candidate.label || '_' || answer_number,
                   'topic', 'Answer topic ' || lpad(answer_number::text, 2, '0'),
                   'topicKey', 'answer topic ' || lpad(answer_number::text, 2, '0')
                 )
               else
                 jsonb_build_object(
                   'answer', 'Approved answer ' || answer_number,
                   'kind', 'answer',
                   'sourceAnswerId', 'answer_' || candidate.label || '_' || answer_number,
                   'topic', 'Answer topic ' || lpad(answer_number::text, 2, '0'),
                   'topicKey', 'answer topic ' || lpad(answer_number::text, 2, '0')
                 )
               end
               order by case
                 when candidate.label = 'truncated' then -answer_number
                 else answer_number
               end
             )
               from generate_series(1, candidate.answer_count) answer_number
           ), '[]'::jsonb),
           'defaultPolicy', '{"kind":"create_staff_task"}'::jsonb,
           'handoffs', coalesce((
             select jsonb_agg(
               jsonb_build_object(
                 'action', (array[
                   'create_task', 'notify_staff',
                   'transfer_when_live', 'block_automation'
                 ])[((handoff_number - 1) % 4) + 1],
                 'activeWindow', 'Always',
                 'destination', 'staff',
                 'priority', handoff_number,
                 'sourceRuleId', 'handoff_' || candidate.label || '_' || handoff_number,
                 'topic', 'Handoff topic ' || lpad(handoff_number::text, 2, '0'),
                 'trigger', (array[
                   'topic', 'low_confidence', 'always_human',
                   'explicit_human_request', 'missing_fact', 'conflict'
                 ])[((handoff_number - 1) % 6) + 1]
               )
               order by case
                 when candidate.label = 'truncated' then -handoff_number
                 else handoff_number
               end
             )
               from generate_series(1, candidate.handoff_count) handoff_number
           ), '[]'::jsonb),
           'warnings', '[]'::jsonb
         ) as policy_body
    from candidates candidate
)
insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
)
select 'runtime_policy_manifest_' || body.label,
       body.tenant_id,
       body.location_id,
       1,
       1,
       body.snapshot_version,
       repeat('a', 64),
       body.policy_body,
       body.owner_user_id,
       'candidate:policy-manifest:' || body.label
  from candidate_bodies body;

insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
) values (
  'runtime_policy_manifest_unicode', 'tenant_policy_manifest_contract',
  'location_policy_manifest_unicode', 1, 1, 1, repeat('b', 64),
  jsonb_build_object(
    'answerTopics', jsonb_build_array(
      jsonb_build_object(
        'answer', 'Emoji answer',
        'kind', 'answer',
        'sourceAnswerId', 'answer_unicode_emoji',
        'topic', repeat('😀', 81),
        'topicKey', repeat('😀', 81)
      ),
      jsonb_build_object(
        'kind', 'create_staff_task',
        'sourceAnswerId', 'answer_unicode_fullwidth',
        'topic', 'Ａ',
        'topicKey', 'ａ'
      )
    ),
    'defaultPolicy', '{"kind":"create_staff_task"}'::jsonb,
    'handoffs', '[]'::jsonb,
    'warnings', '[]'::jsonb
  ),
  'user_policy_manifest_owner', 'candidate:policy-manifest:unicode'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000791', true);
do $$
declare
  v_answer jsonb;
  v_handoff jsonb;
  v_result jsonb;
begin
  v_result := get_runtime_policy_candidate_review_manifest(
    'runtime_policy_manifest_truncated'
  );
  if (select array_agg(key order by key) from jsonb_object_keys(v_result) key)
     <> array[
       'answer_topic_count', 'answer_topics', 'answer_topics_has_more',
       'candidate_id', 'default_behavior', 'handoff_count', 'handoffs',
       'handoffs_has_more', 'location_id', 'snapshot_version'
     ] then
    raise exception 'manifest envelope fields are invalid: %', v_result;
  end if;
  if v_result->>'candidate_id' <> 'runtime_policy_manifest_truncated'
     or v_result->>'location_id' <> 'location_policy_manifest_truncated'
     or (v_result->>'snapshot_version')::bigint <> 1
     or (v_result->>'answer_topic_count')::integer <> 15
     or (v_result->>'handoff_count')::integer <> 12
     or (v_result->>'answer_topics_has_more')::boolean is not true
     or (v_result->>'handoffs_has_more')::boolean is not true
     or v_result->>'default_behavior' <> 'create_staff_task'
     or jsonb_array_length(v_result->'answer_topics') <> 10
     or jsonb_array_length(v_result->'handoffs') <> 10 then
    raise exception 'bounded manifest envelope is invalid: %', v_result;
  end if;
  if (
    select array_agg(value->>'topic' order by ordinal)
      from jsonb_array_elements(v_result->'answer_topics')
           with ordinality answer(value, ordinal)
  ) <> array[
    'Answer topic 01', 'Answer topic 02', 'Answer topic 03', 'Answer topic 04',
    'Answer topic 05', 'Answer topic 06', 'Answer topic 07', 'Answer topic 08',
    'Answer topic 09', 'Answer topic 10'
  ] then
    raise exception 'manifest answer order is invalid: %', v_result;
  end if;
  if (
    select array_agg((value->>'priority')::integer order by ordinal)
      from jsonb_array_elements(v_result->'handoffs')
           with ordinality handoff(value, ordinal)
  ) <> array[1,2,3,4,5,6,7,8,9,10] then
    raise exception 'manifest handoff order is invalid: %', v_result;
  end if;
  for v_answer in select value from jsonb_array_elements(v_result->'answer_topics') loop
    if (select array_agg(key order by key) from jsonb_object_keys(v_answer) key)
       <> array['behavior', 'topic']
       or v_answer->>'behavior' not in ('answer', 'create_staff_task') then
      raise exception 'manifest answer leaked or invalid fields: %', v_answer;
    end if;
  end loop;
  for v_handoff in select value from jsonb_array_elements(v_result->'handoffs') loop
    if (select array_agg(key order by key) from jsonb_object_keys(v_handoff) key)
       <> array['action', 'priority', 'topic', 'trigger'] then
      raise exception 'manifest handoff leaked fields: %', v_handoff;
    end if;
  end loop;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000791', true);
do $$
declare
  v_result jsonb;
begin
  v_result := get_runtime_policy_candidate_review_manifest(
    'runtime_policy_manifest_unicode'
  );
  if jsonb_array_length(v_result->'answer_topics') <> 2
     or v_result->'answer_topics'->0->>'topic' <> 'Ａ'
     or v_result->'answer_topics'->1->>'topic' <> repeat('😀', 81)
     or char_length(v_result->'answer_topics'->1->>'topic') <> 81 then
    raise exception 'manifest Unicode length or C ordering is invalid: %', v_result;
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000791', true);
do $$
declare
  v_answer_count integer;
  v_answer_has_more boolean;
  v_handoff_count integer;
  v_handoff_has_more boolean;
  v_label text;
  v_result jsonb;
begin
  for v_label, v_answer_count, v_handoff_count,
      v_answer_has_more, v_handoff_has_more in values
    ('empty', 0, 0, false, false),
    ('small', 2, 1, false, false),
    ('ten', 10, 10, false, false),
    ('truncated', 10, 10, true, true)
  loop
    v_result := get_runtime_policy_candidate_review_manifest(
      'runtime_policy_manifest_' || v_label
    );
    if jsonb_array_length(v_result->'answer_topics') <> v_answer_count
       or jsonb_array_length(v_result->'handoffs') <> v_handoff_count
       or (v_result->>'answer_topics_has_more')::boolean
            is distinct from v_answer_has_more
       or (v_result->>'handoffs_has_more')::boolean
            is distinct from v_handoff_has_more then
      raise exception 'manifest boundary % is invalid: %', v_label, v_result;
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
    ('00000000-0000-0000-0000-000000000792', 'runtime_policy_manifest_truncated'),
    ('00000000-0000-0000-0000-000000000793', 'runtime_policy_manifest_truncated'),
    ('00000000-0000-0000-0000-000000000794', 'runtime_policy_manifest_truncated'),
    ('00000000-0000-0000-0000-000000000791', 'runtime_policy_manifest_foreign'),
    ('00000000-0000-0000-0000-000000000791', 'runtime_policy_manifest_stale_1'),
    ('00000000-0000-0000-0000-000000000791', 'runtime_policy_manifest_inactive'),
    ('00000000-0000-0000-0000-000000000791', 'runtime_policy_manifest_missing'),
    ('00000000-0000-0000-0000-000000000791', ' ')
  loop
    perform set_config('request.jwt.claim.sub', v_subject, true);
    begin
      perform get_runtime_policy_candidate_review_manifest(v_candidate_id);
      raise exception 'unauthorized manifest read unexpectedly succeeded for %', v_subject;
    exception when insufficient_privilege then
      if sqlerrm <> 'active tenant owner required' then
        raise exception 'manifest denial leaked scope: %', sqlerrm;
      end if;
    end;
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform get_runtime_policy_candidate_review_manifest(
      'runtime_policy_manifest_truncated'
    );
    raise exception 'missing actor unexpectedly read manifest';
  exception when insufficient_privilege then
    if sqlerrm <> 'active tenant owner required' then
      raise exception 'missing-actor manifest denial leaked scope: %', sqlerrm;
    end if;
  end;
end;
$$;
reset role;

do $$
declare
  v_compiler_functions text[];
begin
  if not has_function_privilege(
       'authenticated',
       'get_runtime_policy_candidate_review_manifest(text)',
       'execute'
     )
     or has_function_privilege(
       'anonymous',
       'get_runtime_policy_candidate_review_manifest(text)',
       'execute'
     )
     or has_function_privilege(
       'outpost_policy_compiler',
       'get_runtime_policy_candidate_review_manifest(text)',
       'execute'
     ) then
    raise exception 'runtime policy manifest execute grants are invalid';
  end if;
  if has_table_privilege('authenticated', 'runtime_policy_snapshots', 'select')
     or has_table_privilege('outpost_policy_compiler', 'runtime_policy_snapshots', 'select') then
    raise exception 'runtime policy manifest widened relation authority';
  end if;
  select coalesce(array_agg(function.oid::regprocedure::text order by function.oid::regprocedure::text), array[]::text[])
    into v_compiler_functions
    from pg_proc function
    join pg_namespace namespace on namespace.oid = function.pronamespace
   where namespace.nspname = 'public'
     and function.prosecdef
     and has_function_privilege('outpost_policy_compiler', function.oid, 'execute');
  if v_compiler_functions <> array[
    'record_runtime_policy_candidate(text,jsonb,jsonb)'
  ] then
    raise exception 'runtime policy compiler function allowlist changed: %',
      v_compiler_functions;
  end if;
end;
$$;

do $$
declare
  v_audits bigint;
  v_decisions bigint;
  v_snapshots bigint;
  v_tasks bigint;
  v_usage bigint;
begin
  select count(*) into v_snapshots from runtime_policy_snapshots
   where tenant_id = 'tenant_policy_manifest_contract';
  select count(*) into v_decisions from runtime_policy_review_decisions
   where tenant_id = 'tenant_policy_manifest_contract';
  select count(*) into v_audits from audit_events
   where tenant_id = 'tenant_policy_manifest_contract';
  select count(*) into v_tasks from tasks
   where tenant_id = 'tenant_policy_manifest_contract';
  select count(*) into v_usage from usage_events
   where tenant_id = 'tenant_policy_manifest_contract';
  if v_snapshots <> 8
     or v_decisions <> 0
     or v_audits <> 0
     or v_tasks <> 0
     or v_usage <> 0 then
    raise exception 'manifest reads changed durable evidence';
  end if;
end;
$$;

rollback;

select 'Runtime policy candidate review manifest authority contract passed.' as result;
