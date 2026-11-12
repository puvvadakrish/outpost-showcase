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
) values ('plan_policy_lineage_contract', 'Policy lineage contract', 8, 0, 0, 8, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values
  ('tenant_policy_lineage_contract', 'Policy Lineage Contract',
   'policy-lineage-contract', 'active', 'plan_policy_lineage_contract', 'pilot', 'concierge'),
  ('tenant_policy_lineage_foreign', 'Policy Lineage Foreign',
   'policy-lineage-foreign', 'active', 'plan_policy_lineage_contract', 'pilot', 'concierge');

insert into locations (id, tenant_id, name, address, timezone, status)
values
  ('location_policy_lineage_zero', 'tenant_policy_lineage_contract',
   'Policy Lineage Zero', 'Test', 'UTC', 'active'),
  ('location_policy_lineage_one', 'tenant_policy_lineage_contract',
   'Policy Lineage One', 'Test', 'UTC', 'active'),
  ('location_policy_lineage_five', 'tenant_policy_lineage_contract',
   'Policy Lineage Five', 'Test', 'UTC', 'active'),
  ('location_policy_lineage_six', 'tenant_policy_lineage_contract',
   'Policy Lineage Six', 'Test', 'UTC', 'active'),
  ('location_policy_lineage_inactive', 'tenant_policy_lineage_contract',
   'Policy Lineage Inactive', 'Test', 'UTC', 'paused'),
  ('location_policy_lineage_foreign', 'tenant_policy_lineage_foreign',
   'Policy Lineage Foreign', 'Test', 'UTC', 'active');

insert into neon_auth."user" (id)
values
  ('00000000-0000-0000-0000-000000000771'),
  ('00000000-0000-0000-0000-000000000772'),
  ('00000000-0000-0000-0000-000000000773'),
  ('00000000-0000-0000-0000-000000000774');

insert into users (id, external_auth_id, email, name)
values
  ('user_policy_lineage_owner', '00000000-0000-0000-0000-000000000771',
   'policy-lineage-owner@example.com', 'Policy Lineage Owner'),
  ('user_policy_lineage_staff', '00000000-0000-0000-0000-000000000772',
   'policy-lineage-staff@example.com', 'Policy Lineage Staff'),
  ('user_policy_lineage_disabled', '00000000-0000-0000-0000-000000000773',
   'policy-lineage-disabled@example.com', 'Policy Lineage Disabled'),
  ('user_policy_lineage_foreign', '00000000-0000-0000-0000-000000000774',
   'policy-lineage-foreign@example.com', 'Policy Lineage Foreign');

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values
  ('membership_policy_lineage_owner', 'tenant_policy_lineage_contract',
   'user_policy_lineage_owner', 'owner', 'active'),
  ('membership_policy_lineage_staff', 'tenant_policy_lineage_contract',
   'user_policy_lineage_staff', 'staff', 'active'),
  ('membership_policy_lineage_disabled', 'tenant_policy_lineage_contract',
   'user_policy_lineage_disabled', 'owner', 'disabled'),
  ('membership_policy_lineage_foreign', 'tenant_policy_lineage_foreign',
   'user_policy_lineage_foreign', 'owner', 'active');

insert into runtime_policy_snapshots (
  id, tenant_id, location_id, schema_version, compiler_revision,
  snapshot_version, source_digest, policy_body, compiled_by_user_id, creation_key,
  created_at
)
select 'runtime_policy_lineage_' || boundary.label || '_' || version_number,
       boundary.tenant_id,
       boundary.location_id,
       1,
       1,
       version_number,
       repeat('a', 64),
       '{"answerTopics":[],"defaultPolicy":{"kind":"create_staff_task"},"handoffs":[],"warnings":[]}'::jsonb,
       boundary.owner_user_id,
       'candidate:policy-lineage:' || boundary.label || ':' || version_number,
       '2026-07-15 12:00:00+00'::timestamptz + version_number * interval '1 minute'
  from (
    values
      ('zero', 'tenant_policy_lineage_contract', 'location_policy_lineage_zero',
       'user_policy_lineage_owner', 1),
      ('one', 'tenant_policy_lineage_contract', 'location_policy_lineage_one',
       'user_policy_lineage_owner', 2),
      ('five', 'tenant_policy_lineage_contract', 'location_policy_lineage_five',
       'user_policy_lineage_owner', 6),
      ('six', 'tenant_policy_lineage_contract', 'location_policy_lineage_six',
       'user_policy_lineage_owner', 7),
      ('inactive', 'tenant_policy_lineage_contract', 'location_policy_lineage_inactive',
       'user_policy_lineage_owner', 1),
      ('foreign', 'tenant_policy_lineage_foreign', 'location_policy_lineage_foreign',
       'user_policy_lineage_foreign', 1)
  ) boundary(label, tenant_id, location_id, owner_user_id, candidate_count)
 cross join lateral generate_series(1, boundary.candidate_count) version_number;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000771', true);
do $$
declare
  v_entry jsonb;
  v_expected_has_more boolean;
  v_expected_window integer;
  v_label text;
  v_result jsonb;
begin
  v_result := get_runtime_policy_candidate_lineage('runtime_policy_lineage_six_7');
  if (select array_agg(key order by key) from jsonb_object_keys(v_result) key)
     <> array['anchor_candidate_id', 'anchor_snapshot_version', 'entries', 'has_more', 'location_id'] then
    raise exception 'lineage envelope fields are invalid: %', v_result;
  end if;
  if v_result->>'anchor_candidate_id' <> 'runtime_policy_lineage_six_7'
     or v_result->>'location_id' <> 'location_policy_lineage_six'
     or (v_result->>'anchor_snapshot_version')::bigint <> 7
     or (v_result->>'has_more')::boolean is not true
     or jsonb_array_length(v_result->'entries') <> 5
     or (
       select array_agg((value->>'snapshot_version')::bigint order by ordinal)
         from jsonb_array_elements(v_result->'entries') with ordinality entry(value, ordinal)
     ) <> array[6, 5, 4, 3, 2]::bigint[] then
    raise exception 'bounded lineage envelope is invalid: %', v_result;
  end if;
  for v_entry in select value from jsonb_array_elements(v_result->'entries') loop
    if (select array_agg(key order by key) from jsonb_object_keys(v_entry) key)
       <> array['compiler_revision', 'created_at', 'snapshot_version'] then
      raise exception 'lineage entry leaked fields: %', v_entry;
    end if;
  end loop;
  for v_label, v_expected_window, v_expected_has_more in values
    ('zero', 0, false),
    ('one', 1, false),
    ('five', 5, false),
    ('six', 5, true)
  loop
    v_result := get_runtime_policy_candidate_lineage(
      'runtime_policy_lineage_' || v_label || '_' ||
      case v_label when 'zero' then '1' when 'one' then '2'
                   when 'five' then '6' else '7' end
    );
    if jsonb_array_length(v_result->'entries') <> v_expected_window
       or (v_result->>'has_more')::boolean is distinct from v_expected_has_more then
      raise exception 'lineage boundary % is invalid: %', v_label, v_result;
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
    ('00000000-0000-0000-0000-000000000772', 'runtime_policy_lineage_six_7'),
    ('00000000-0000-0000-0000-000000000773', 'runtime_policy_lineage_six_7'),
    ('00000000-0000-0000-0000-000000000774', 'runtime_policy_lineage_six_7'),
    ('00000000-0000-0000-0000-000000000771', 'runtime_policy_lineage_foreign_1'),
    ('00000000-0000-0000-0000-000000000771', 'runtime_policy_lineage_one_1'),
    ('00000000-0000-0000-0000-000000000771', 'runtime_policy_lineage_inactive_1'),
    ('00000000-0000-0000-0000-000000000771', 'runtime_policy_lineage_missing'),
    ('00000000-0000-0000-0000-000000000771', ' ')
  loop
    perform set_config('request.jwt.claim.sub', v_subject, true);
    begin
      perform get_runtime_policy_candidate_lineage(v_candidate_id);
      raise exception 'unauthorized lineage read unexpectedly succeeded for %', v_subject;
    exception when insufficient_privilege then
      if sqlerrm <> 'active tenant owner required' then
        raise exception 'lineage denial leaked scope: %', sqlerrm;
      end if;
    end;
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform get_runtime_policy_candidate_lineage('runtime_policy_lineage_six_7');
    raise exception 'missing actor unexpectedly read lineage';
  exception when insufficient_privilege then
    if sqlerrm <> 'active tenant owner required' then
      raise exception 'missing-actor lineage denial leaked scope: %', sqlerrm;
    end if;
  end;
end;
$$;
reset role;

do $$
begin
  if not has_function_privilege('authenticated', 'get_runtime_policy_candidate_lineage(text)', 'execute')
     or has_function_privilege('anonymous', 'get_runtime_policy_candidate_lineage(text)', 'execute')
     or has_function_privilege('outpost_policy_compiler', 'get_runtime_policy_candidate_lineage(text)', 'execute') then
    raise exception 'runtime policy lineage execute grants are invalid';
  end if;
  if has_table_privilege('authenticated', 'runtime_policy_snapshots', 'select')
     or has_table_privilege('outpost_policy_compiler', 'runtime_policy_snapshots', 'select') then
    raise exception 'runtime policy lineage widened relation authority';
  end if;
end;
$$;

do $$
declare
  v_audits bigint;
  v_decisions bigint;
  v_snapshots bigint;
begin
  select count(*) into v_snapshots from runtime_policy_snapshots
   where tenant_id = 'tenant_policy_lineage_contract';
  select count(*) into v_decisions from runtime_policy_review_decisions
   where tenant_id = 'tenant_policy_lineage_contract';
  select count(*) into v_audits from audit_events
   where tenant_id = 'tenant_policy_lineage_contract';
  if v_snapshots <> 17 or v_decisions <> 0 or v_audits <> 0 then
    raise exception 'lineage reads changed durable evidence';
  end if;
end;
$$;

rollback;

select 'Runtime policy candidate lineage authority contract passed.' as result;
