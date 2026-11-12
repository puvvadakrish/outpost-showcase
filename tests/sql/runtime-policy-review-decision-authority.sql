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
) values ('plan_policy_review_contract', 'Policy review contract', 1, 0, 0, 4, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values (
  'tenant_policy_review_contract', 'Policy Review Contract',
  'policy-review-contract', 'active', 'plan_policy_review_contract',
  'pilot', 'concierge'
);

insert into locations (id, tenant_id, name, address, timezone, status)
values (
  'location_policy_review_contract', 'tenant_policy_review_contract',
  'Policy Review Contract', 'Test', 'UTC', 'active'
);

insert into neon_auth."user" (id)
values
  ('00000000-0000-0000-0000-000000000711'),
  ('00000000-0000-0000-0000-000000000712'),
  ('00000000-0000-0000-0000-000000000713'),
  ('00000000-0000-0000-0000-000000000714');

insert into users (id, external_auth_id, email, name)
values
  ('user_policy_review_owner_a', '00000000-0000-0000-0000-000000000711',
   'policy-review-owner-a@example.com', 'Policy Review Owner A'),
  ('user_policy_review_owner_b', '00000000-0000-0000-0000-000000000712',
   'policy-review-owner-b@example.com', 'Policy Review Owner B'),
  ('user_policy_review_staff', '00000000-0000-0000-0000-000000000713',
   'policy-review-staff@example.com', 'Policy Review Staff'),
  ('user_policy_review_foreign', '00000000-0000-0000-0000-000000000714',
   'policy-review-foreign@example.com', 'Policy Review Foreign Owner');

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values (
  'tenant_policy_review_foreign', 'Policy Review Foreign',
  'policy-review-foreign', 'active', 'plan_policy_review_contract',
  'pilot', 'concierge'
);

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values
  ('membership_policy_review_owner_a', 'tenant_policy_review_contract',
   'user_policy_review_owner_a', 'owner', 'active'),
  ('membership_policy_review_owner_b', 'tenant_policy_review_contract',
   'user_policy_review_owner_b', 'owner', 'active'),
  ('membership_policy_review_staff', 'tenant_policy_review_contract',
   'user_policy_review_staff', 'staff', 'active'),
  ('membership_policy_review_foreign', 'tenant_policy_review_foreign',
   'user_policy_review_foreign', 'owner', 'active');

select runtime_policy_current_source_state(
  'tenant_policy_review_contract', 'location_policy_review_contract'
)::text as source_state \gset
select set_config('outpost.test_policy_review_source', :'source_state', true);

insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
) values (
  'runtime_policy_review_candidate_1',
  'tenant_policy_review_contract',
  'location_policy_review_contract',
  1,
  1,
  1,
  encode(digest(:'source_state'::jsonb::text, 'sha256'), 'hex'),
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  'user_policy_review_owner_a',
  'candidate:policy-review:1'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000711',
  true
);
select record_runtime_policy_rejection(
  'runtime_policy_review_candidate_1', 'review:owner-a:reject:1'
);
select record_runtime_policy_rejection(
  'runtime_policy_review_candidate_1', 'review:owner-a:reject:1'
);
select record_runtime_policy_rejection(
  'runtime_policy_review_candidate_1', 'review:owner-a:reject:repeat'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000713',
  true
);
do $$
begin
  perform record_runtime_policy_rejection(
    'runtime_policy_review_candidate_1', 'review:staff:reject:denied'
  );
  raise exception 'staff rejection unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform record_runtime_policy_rejection(
    'runtime_policy_review_missing_candidate', 'review:staff:missing:denied'
  );
  raise exception 'missing-candidate rejection unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform record_runtime_policy_acceptance(
    'runtime_policy_review_candidate_1',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_review_source')::jsonb,
    'review:staff:accept:denied'
  );
  raise exception 'staff acceptance unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000714',
  true
);
do $$
begin
  perform record_runtime_policy_rejection(
    'runtime_policy_review_candidate_1', 'review:foreign:reject:denied'
  );
  raise exception 'foreign-owner rejection unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform record_runtime_policy_acceptance(
    'runtime_policy_review_candidate_1',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_review_source')::jsonb,
    'review:foreign:accept:denied'
  );
  raise exception 'foreign-owner acceptance unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
reset role;

update tenant_memberships
   set invite_status = 'disabled'
 where id = 'membership_policy_review_owner_b';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000712',
  true
);
do $$
begin
  perform record_runtime_policy_rejection(
    'runtime_policy_review_candidate_1', 'review:disabled:reject:denied'
  );
  raise exception 'disabled-owner rejection unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform record_runtime_policy_acceptance(
    'runtime_policy_review_candidate_1',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_review_source')::jsonb,
    'review:disabled:accept:denied'
  );
  raise exception 'disabled-owner acceptance unexpectedly succeeded';
exception when insufficient_privilege then null;
end;
$$;
reset role;

update tenant_memberships
   set invite_status = 'active'
 where id = 'membership_policy_review_owner_b';

do $$
begin
  if (select count(*) from runtime_policy_review_decisions
       where candidate_id = 'runtime_policy_review_candidate_1') <> 1 then
    raise exception 'same-owner rejection retry duplicated review evidence';
  end if;
  if (select count(*) from audit_events
       where action = 'runtime_policy.review_rejected') <> 1 then
    raise exception 'same-owner rejection retry duplicated audit evidence';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000712',
  true
);
select record_runtime_policy_rejection(
  'runtime_policy_review_candidate_1', 'review:owner-b:reject:1'
);
reset role;

do $$
begin
  if (select count(*) from runtime_policy_review_decisions
       where candidate_id = 'runtime_policy_review_candidate_1') <> 2 then
    raise exception 'different-owner same-state review evidence was collapsed';
  end if;
  if not exists (
    select 1
      from runtime_policy_review_decisions decision_row
     where decision_row.candidate_id = 'runtime_policy_review_candidate_1'
       and decision_row.decision_sequence = 2
       and decision_row.previous_decision_id is not null
  ) then
    raise exception 'decision history does not link to prior evidence';
  end if;
end;
$$;

insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key
) values (
  'runtime_policy_review_candidate_2',
  'tenant_policy_review_contract',
  'location_policy_review_contract',
  1,
  1,
  2,
  encode(digest(:'source_state'::jsonb::text, 'sha256'), 'hex'),
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  'user_policy_review_owner_a',
  'candidate:policy-review:2'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000712',
  true
);
do $$
begin
  perform record_runtime_policy_acceptance(
    'runtime_policy_review_candidate_1',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_review_source')::jsonb,
    'review:owner-b:accept:stale'
  );
  raise exception 'stale runtime policy candidate acceptance unexpectedly succeeded';
exception when serialization_failure then null;
end;
$$;
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000711',
  true
);
select record_runtime_policy_rejection(
  'runtime_policy_review_candidate_1', 'review:owner-a:reject:stale'
);
select record_runtime_policy_acceptance(
  'runtime_policy_review_candidate_2',
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  :'source_state'::jsonb,
  'review:owner-a:accept:1'
);
select record_runtime_policy_acceptance(
  'runtime_policy_review_candidate_2',
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  :'source_state'::jsonb,
  'review:owner-a:accept:1'
);
reset role;

do $$
begin
  if (select count(*) from runtime_policy_review_decisions
       where candidate_id = 'runtime_policy_review_candidate_1') <> 3 then
    raise exception 'stale rejection was not preserved as exact negative evidence';
  end if;
  if (select count(*) from runtime_policy_review_decisions
       where candidate_id = 'runtime_policy_review_candidate_2'
         and decision = 'accepted') <> 1 then
    raise exception 'acceptance retry duplicated positive review evidence';
  end if;
  if not exists (
    select 1
      from runtime_policy_review_decisions
     where candidate_id = 'runtime_policy_review_candidate_1'
       and creation_key = 'review:owner-a:reject:stale'
       and candidate_was_latest = false
  ) then
    raise exception 'stale rejection did not preserve decision-time staleness';
  end if;
  if not exists (
    select 1
      from runtime_policy_review_decisions
     where candidate_id = 'runtime_policy_review_candidate_2'
       and decision = 'accepted'
       and candidate_was_latest = true
  ) then
    raise exception 'acceptance did not preserve latest-candidate evidence';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000711',
  true
);
select record_runtime_policy_rejection(
  'runtime_policy_review_candidate_2', 'review:owner-a:reject:2'
);
select record_runtime_policy_acceptance(
  'runtime_policy_review_candidate_2',
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  :'source_state'::jsonb,
  'review:owner-a:accept:2'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000712',
  true
);
select record_runtime_policy_acceptance(
  'runtime_policy_review_candidate_2',
  '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
  :'source_state'::jsonb,
  'review:owner-b:accept:2'
);
reset role;

do $$
begin
  if (select array_agg(decision order by decision_sequence)
        from runtime_policy_review_decisions
       where candidate_id = 'runtime_policy_review_candidate_2')
     <> array['accepted', 'rejected', 'accepted', 'accepted'] then
    raise exception 'superseded review decision history is inaccurate';
  end if;
  if (select count(*) from audit_events
       where subject_type = 'runtime_policy_review_decision') <> 7 then
    raise exception 'review decisions and privacy-minimal audits are not one-to-one';
  end if;
  if exists (
    select 1
      from audit_events
     where subject_type = 'runtime_policy_review_decision'
       and (
         metadata ? 'policy_body'
         or metadata ? 'source_digest'
         or metadata ? 'policy_digest'
         or metadata ? 'creation_key'
         or metadata ? 'actor_email'
       )
  ) then
    raise exception 'runtime policy review audit leaked sensitive evidence';
  end if;
end;
$$;

insert into handoff_rules (
  id, tenant_id, location_id, topic, trigger, action, destination,
  active_window, priority, status
) values (
  'handoff_policy_review_drift', 'tenant_policy_review_contract',
  'location_policy_review_contract', 'Drift', 'topic', 'create_task',
  'front desk', 'always', 10, 'active'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000711',
  true
);
do $$
begin
  perform record_runtime_policy_acceptance(
    'runtime_policy_review_candidate_2',
    '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
    current_setting('outpost.test_policy_review_source')::jsonb,
    'review:owner-a:accept:drift'
  );
  raise exception 'source-drifted runtime policy acceptance unexpectedly succeeded';
exception when serialization_failure then null;
end;
$$;
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000711',
  true
);
do $$
begin
  if (select count(*) from list_runtime_policy_candidate_summaries(
       'tenant_policy_review_contract')) <> 1
     or (select max(decision_count) from list_runtime_policy_candidate_summaries(
       'tenant_policy_review_contract')) <> 4
     or (select max(latest_decision) from list_runtime_policy_candidate_summaries(
       'tenant_policy_review_contract')) <> 'accepted' then
    raise exception 'owner bounded runtime policy review summary is inaccurate';
  end if;
  if (select count(*) from get_runtime_policy_candidate_summary(
       'runtime_policy_review_candidate_1')) <> 1
     or (select max(decision_count) from get_runtime_policy_candidate_summary(
       'runtime_policy_review_candidate_1')) <> 3 then
    raise exception 'owner exact stale candidate summary is inaccurate';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000713',
  true
);
do $$
begin
  if (select count(*) from list_runtime_policy_candidate_summaries(
       'tenant_policy_review_contract')) <> 0
     or (select count(*) from get_runtime_policy_candidate_summary(
       'runtime_policy_review_candidate_2')) <> 0 then
    raise exception 'staff can read runtime policy candidate review summaries';
  end if;
  if (select count(*) from audit_events
       where subject_type = 'runtime_policy_review_decision') <> 0 then
    raise exception 'staff can read owner-only runtime policy review audit';
  end if;
end;
$$;
reset role;

do $$
begin
  update runtime_policy_review_decisions
     set decision = 'rejected'
   where candidate_id = 'runtime_policy_review_candidate_2'
     and decision_sequence = 1;
  raise exception 'runtime policy review decision mutation unexpectedly succeeded';
exception when object_not_in_prerequisite_state then null;
end;
$$;

do $$
begin
  if not has_function_privilege(
       'authenticated', 'record_runtime_policy_acceptance(text,jsonb,jsonb,text)', 'execute'
     )
     or not has_function_privilege(
       'authenticated', 'record_runtime_policy_rejection(text,text)', 'execute'
     )
     or has_function_privilege(
       'anonymous', 'record_runtime_policy_acceptance(text,jsonb,jsonb,text)', 'execute'
     )
     or has_function_privilege(
       'outpost_policy_compiler', 'record_runtime_policy_rejection(text,text)', 'execute'
     )
     or has_function_privilege(
       'outpost_policy_compiler',
       'append_runtime_policy_review_decision(text,text,text,text)', 'execute'
     )
     or has_function_privilege(
       'outpost_policy_compiler',
       'record_runtime_policy_acceptance(text,jsonb,jsonb,text)', 'execute'
     )
     or has_table_privilege(
       'authenticated', 'runtime_policy_review_decisions', 'select,insert,update,delete'
     )
     or has_table_privilege(
       'outpost_policy_compiler', 'runtime_policy_review_decisions', 'select,insert,update,delete'
     ) then
    raise exception 'runtime policy review authority crossed its exact boundary';
  end if;
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name in ('runtime_policy_snapshots', 'runtime_policy_review_decisions')
       and column_name in (
         'activation_state', 'activated_at', 'current_policy', 'executable_state'
       )
  ) then
    raise exception 'runtime policy review evidence gained executable state';
  end if;
end;
$$;

rollback;
