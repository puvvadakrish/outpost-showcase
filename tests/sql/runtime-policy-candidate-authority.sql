\set ON_ERROR_STOP on

begin;

grant outpost_policy_compiler to current_user;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';

insert into plans (
  id, name, included_locations, included_voice_minutes, included_emails,
  included_users, overage_voice_minute_cents
) values ('plan_policy_contract', 'Policy contract', 1, 0, 0, 2, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values ('tenant_policy_contract', 'Policy Contract', 'policy-contract', 'active',
  'plan_policy_contract', 'pilot', 'concierge');

insert into locations (id, tenant_id, name, address, timezone, status)
values ('location_policy_contract', 'tenant_policy_contract', 'Policy Contract', 'Test', 'UTC', 'active');

insert into neon_auth."user" (id)
values
  ('00000000-0000-0000-0000-000000000701'),
  ('00000000-0000-0000-0000-000000000702');

insert into users (id, external_auth_id, email, name)
values
  ('user_policy_owner', '00000000-0000-0000-0000-000000000701', 'policy-owner@example.com', 'Policy Owner'),
  ('user_policy_staff', '00000000-0000-0000-0000-000000000702', 'policy-staff@example.com', 'Policy Staff');

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values
  ('membership_policy_owner', 'tenant_policy_contract', 'user_policy_owner', 'owner', 'active'),
  ('membership_policy_staff', 'tenant_policy_contract', 'user_policy_staff', 'staff', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);
select issue_runtime_policy_candidate_intent(
  'tenant_policy_contract', 'location_policy_contract', 1,
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb
) as intent_token \gset
reset role;

select runtime_policy_current_source_state(
  'tenant_policy_contract', 'location_policy_contract'
)::text as source_state \gset
select set_config('outpost.test_policy_intent', :'intent_token', true);
select set_config('outpost.test_policy_source', :'source_state', true);

set local role outpost_policy_compiler;
do $$
begin
  perform record_runtime_policy_candidate(
    current_setting('outpost.test_policy_intent'),
    '{"answerTopics":[{"kind":"create_staff_task","sourceAnswerId":"forged","topic":"Forged","topicKey":"forged"}],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_source')::jsonb
  );
  raise exception 'substituted runtime policy body unexpectedly succeeded';
exception when invalid_parameter_value then null;
end;
$$;
select record_runtime_policy_candidate(
  :'intent_token',
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  :'source_state'::jsonb
);
select record_runtime_policy_candidate(
  :'intent_token',
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  :'source_state'::jsonb
);

do $$
begin
  perform record_runtime_policy_candidate(
    repeat('f', 64),
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    '{}'::jsonb
  );
  raise exception 'unissued runtime policy intent unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from runtime_policy_snapshots where tenant_id = 'tenant_policy_contract') <> 1 then
    raise exception 'runtime policy intent replay duplicated candidate evidence';
  end if;
  if (select count(*) from audit_events where tenant_id = 'tenant_policy_contract'
      and action = 'runtime_policy.candidate_recorded') <> 1 then
    raise exception 'runtime policy intent replay duplicated audit evidence';
  end if;
  if not has_function_privilege(
       'outpost_policy_compiler', 'record_runtime_policy_candidate(text,jsonb,jsonb)', 'execute'
     ) or has_function_privilege('outpost_policy_compiler', 'claim_jobs(integer,text)', 'execute')
     or has_table_privilege(
       'outpost_policy_compiler', 'runtime_policy_candidate_intents', 'select,insert,update,delete'
     ) then
    raise exception 'policy compiler capability crossed its exact authority boundary';
  end if;
  if (select count(*)
        from pg_auth_members membership
       where membership.roleid = 'outpost_policy_compiler'::regrole
         and membership.member = current_user::regrole
         and not membership.admin_option) <> 1 then
    raise exception 'policy compiler capability membership is delegating or ambiguous';
  end if;
  if has_function_privilege(
       'authenticated', 'record_runtime_policy_candidate(text,jsonb,jsonb)', 'execute'
     ) or has_table_privilege(
       'authenticated', 'runtime_policy_candidate_intents', 'select,insert,update,delete'
     ) or has_column_privilege(
       'authenticated', 'runtime_policy_snapshots', 'policy_body', 'select'
     ) or has_table_privilege(
       'authenticated', 'runtime_policy_snapshots', 'select'
     ) then
    raise exception 'authenticated role crossed protected policy evidence boundary';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);
do $$
begin
  if (select count(*) from list_runtime_policy_candidate_summaries('tenant_policy_contract')) <> 1
     or (select max(candidate_count)
           from list_runtime_policy_candidate_summaries('tenant_policy_contract')) <> 1 then
    raise exception 'owner bounded runtime policy summary is inaccurate';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000702', true);
do $$
begin
  if (select count(*) from list_runtime_policy_candidate_summaries('tenant_policy_contract')) <> 0 then
    raise exception 'staff can read owner runtime policy summary';
  end if;
  if (select count(*) from audit_events where action = 'runtime_policy.candidate_recorded') <> 0 then
    raise exception 'staff can read owner-only runtime policy audit';
  end if;
end;
$$;
reset role;

update locations set status = 'paused'
where tenant_id = 'tenant_policy_contract' and id = 'location_policy_contract';
set local role outpost_policy_compiler;
do $$
begin
  perform record_runtime_policy_candidate(
    current_setting('outpost.test_policy_intent'),
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_source')::jsonb
  );
  raise exception 'stale runtime policy replay unexpectedly succeeded';
exception when object_not_in_prerequisite_state then null;
end;
$$;
reset role;

update locations set status = 'active'
where tenant_id = 'tenant_policy_contract' and id = 'location_policy_contract';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);
select issue_runtime_policy_candidate_intent(
  'tenant_policy_contract', 'location_policy_contract', 1,
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb
) as expired_intent_token \gset
reset role;
select set_config('outpost.test_policy_expired_intent', :'expired_intent_token', true);
update runtime_policy_candidate_intents
   set expires_at = clock_timestamp() - interval '1 second'
 where token_digest = encode(digest(:'expired_intent_token', 'sha256'), 'hex');
set local role outpost_policy_compiler;
do $$
begin
  perform record_runtime_policy_candidate(
    current_setting('outpost.test_policy_expired_intent'),
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_source')::jsonb
  );
  raise exception 'expired runtime policy intent unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from runtime_policy_candidate_intents
       where tenant_id = 'tenant_policy_contract'
         and location_id = 'location_policy_contract'
         and actor_user_id = 'user_policy_owner') <> 1 then
    raise exception 'runtime policy intent rows grew beyond their bounded owner/location slot';
  end if;
end;
$$;

do $$
begin
  update runtime_policy_snapshots set snapshot_version = 2
   where tenant_id = 'tenant_policy_contract';
  raise exception 'runtime policy candidate mutation unexpectedly succeeded';
exception when object_not_in_prerequisite_state then null;
end;
$$;

rollback;
