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
) values ('plan_beta_summary_contract', 'Beta summary contract', 1, 0, 0, 8, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values (
  'tenant_beta_summary_contract',
  'Beta Summary Contract',
  'beta-summary-contract',
  'active',
  'plan_beta_summary_contract',
  'pilot',
  'concierge'
);

insert into neon_auth."user" (id)
values
  ('00000000-0000-0000-0000-000000000801'),
  ('00000000-0000-0000-0000-000000000802'),
  ('00000000-0000-0000-0000-000000000803'),
  ('00000000-0000-0000-0000-000000000804'),
  ('00000000-0000-0000-0000-000000000805'),
  ('00000000-0000-0000-0000-000000000806'),
  ('00000000-0000-0000-0000-000000000807'),
  ('00000000-0000-0000-0000-000000000808');

insert into users (id, external_auth_id, email, name)
values
  ('user_beta_summary_active', '00000000-0000-0000-0000-000000000801', 'beta-summary-active@example.com', 'Active Founder'),
  ('user_beta_summary_disabled', '00000000-0000-0000-0000-000000000802', 'beta-summary-disabled@example.com', 'Disabled Admin'),
  ('user_beta_summary_no_admin', '00000000-0000-0000-0000-000000000803', 'beta-summary-no-admin@example.com', 'No Admin'),
  ('user_beta_summary_no_membership', '00000000-0000-0000-0000-000000000804', 'beta-summary-no-membership@example.com', 'No Membership'),
  ('user_beta_summary_split_admin', '00000000-0000-0000-0000-000000000805', 'beta-summary-split-admin@example.com', 'Split Admin'),
  ('user_beta_summary_split_member', '00000000-0000-0000-0000-000000000806', 'beta-summary-split-member@example.com', 'Split Member'),
  ('user_beta_summary_inactive_member', '00000000-0000-0000-0000-000000000807', 'beta-summary-inactive-member@example.com', 'Inactive Founder'),
  ('user_beta_summary_wrong_role', '00000000-0000-0000-0000-000000000808', 'beta-summary-wrong-role@example.com', 'Non-founder Admin');

insert into app_admins (id, user_id, status)
values
  ('app_admin_beta_summary_active', 'user_beta_summary_active', 'active'),
  ('app_admin_beta_summary_disabled', 'user_beta_summary_disabled', 'disabled'),
  ('app_admin_beta_summary_no_membership', 'user_beta_summary_no_membership', 'active'),
  ('app_admin_beta_summary_split', 'user_beta_summary_split_admin', 'active'),
  ('app_admin_beta_summary_inactive_member', 'user_beta_summary_inactive_member', 'active'),
  ('app_admin_beta_summary_wrong_role', 'user_beta_summary_wrong_role', 'active');

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values
  ('membership_beta_summary_active', 'tenant_beta_summary_contract', 'user_beta_summary_active', 'founder_admin', 'active'),
  ('membership_beta_summary_disabled', 'tenant_beta_summary_contract', 'user_beta_summary_disabled', 'founder_admin', 'active'),
  ('membership_beta_summary_no_admin', 'tenant_beta_summary_contract', 'user_beta_summary_no_admin', 'founder_admin', 'active'),
  ('membership_beta_summary_split', 'tenant_beta_summary_contract', 'user_beta_summary_split_member', 'founder_admin', 'active'),
  ('membership_beta_summary_inactive', 'tenant_beta_summary_contract', 'user_beta_summary_inactive_member', 'founder_admin', 'disabled'),
  ('membership_beta_summary_wrong_role', 'tenant_beta_summary_contract', 'user_beta_summary_wrong_role', 'owner', 'active');

insert into hosted_beta_proof_run_summary_records (
  id,
  status,
  app_origin,
  neon_branch_name,
  summary_sha256,
  browser_artifact_sha256,
  chain_artifact_sha256,
  browser_cleanup,
  chain_cleanup,
  recorded_at
)
select
  'beta_summary_' || lpad(record_number::text, 3, '0'),
  'hosted_beta_proof_run_summary_recorded',
  'https://outpost-beta-summary-contract.vercel.app',
  'beta-summary-contract',
  encode(digest('summary-' || record_number::text, 'sha256'), 'hex'),
  encode(digest('browser-' || record_number::text, 'sha256'), 'hex'),
  encode(digest('chain-' || record_number::text, 'sha256'), 'hex'),
  'cleanup_requested',
  'cleanup_requested',
  case
    when record_number = 1 then '2026-07-13T13:00:00Z'::timestamptz
    else '2026-07-13T12:00:00Z'::timestamptz
  end
from generate_series(1, 51) record_number;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000801', true);
do $$
declare
  report jsonb := list_founder_admin_beta_proof_run_summary_records();
  rows_are_ordered boolean;
  row_keys text[];
begin
  if report ->> 'authorized' <> 'true' then
    raise exception 'active app-admin with active founder membership was denied';
  end if;
  if jsonb_array_length(report -> 'rows') <> 50 then
    raise exception 'founder beta summary did not preserve the 50-row bound';
  end if;

  select bool_and(
    row_value ->> 'id' = case
      when ordinal_position = 1 then 'beta_summary_001'
      else 'beta_summary_' || lpad((53 - ordinal_position)::text, 3, '0')
    end
  )
  into rows_are_ordered
  from jsonb_array_elements(report -> 'rows') with ordinality
    as ordered_rows(row_value, ordinal_position);

  if not coalesce(rows_are_ordered, false) then
    raise exception 'founder beta summary rows are not ordered by recorded_at desc, id desc';
  end if;

  select array_agg(row_key order by row_key)
    into row_keys
    from jsonb_object_keys(report -> 'rows' -> 0) row_key;

  if row_keys is distinct from array[
    'app_origin',
    'browser_artifact_sha256',
    'browser_cleanup',
    'chain_artifact_sha256',
    'chain_cleanup',
    'created_at',
    'id',
    'live_provider_enablement_allowed',
    'neon_branch_name',
    'public_self_serve_launch_allowed',
    'recorded_at',
    'status',
    'summary_sha256'
  ]::text[] then
    raise exception 'founder beta summary projection changed';
  end if;
  if report -> 'rows' -> 0 -> 'public_self_serve_launch_allowed' is distinct from 'false'::jsonb
     or report -> 'rows' -> 0 -> 'live_provider_enablement_allowed' is distinct from 'false'::jsonb then
    raise exception 'founder beta summary opened a blocked gate';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000807', true);
do $$
declare report jsonb := list_founder_admin_beta_proof_run_summary_records();
begin
  if report ->> 'authorized' <> 'false' or report -> 'rows' <> '[]'::jsonb then
    raise exception 'inactive founder membership retained beta summary authority';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000808', true);
do $$
declare report jsonb := list_founder_admin_beta_proof_run_summary_records();
begin
  if report ->> 'authorized' <> 'false' or report -> 'rows' <> '[]'::jsonb then
    raise exception 'active non-founder membership was authorized';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000802', true);
do $$
declare report jsonb := list_founder_admin_beta_proof_run_summary_records();
begin
  if report ->> 'authorized' <> 'false' or report -> 'rows' <> '[]'::jsonb then
    raise exception 'disabled app-admin retained founder beta summary authority';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000803', true);
do $$
declare report jsonb := list_founder_admin_beta_proof_run_summary_records();
begin
  if report ->> 'authorized' <> 'false' or report -> 'rows' <> '[]'::jsonb then
    raise exception 'founder membership without app-admin identity was authorized';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000804', true);
do $$
declare report jsonb := list_founder_admin_beta_proof_run_summary_records();
begin
  if report ->> 'authorized' <> 'false' or report -> 'rows' <> '[]'::jsonb then
    raise exception 'active app-admin without founder membership was authorized';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000805', true);
do $$
declare report jsonb := list_founder_admin_beta_proof_run_summary_records();
begin
  if report ->> 'authorized' <> 'false' or report -> 'rows' <> '[]'::jsonb then
    raise exception 'app-admin authority was combined with another identity membership';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000806', true);
do $$
declare report jsonb := list_founder_admin_beta_proof_run_summary_records();
begin
  if report ->> 'authorized' <> 'false' or report -> 'rows' <> '[]'::jsonb then
    raise exception 'founder membership was combined with another identity app-admin authority';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000899', true);
do $$
declare report jsonb := list_founder_admin_beta_proof_run_summary_records();
begin
  if report ->> 'authorized' <> 'false' or report -> 'rows' <> '[]'::jsonb then
    raise exception 'unknown authenticated identity was authorized';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
do $$
declare report jsonb := list_founder_admin_beta_proof_run_summary_records();
begin
  if report ->> 'authorized' <> 'false' or report -> 'rows' <> '[]'::jsonb then
    raise exception 'null authenticated identity was authorized';
  end if;
end;
$$;

do $$
begin
  perform 1 from hosted_beta_proof_run_summary_records limit 1;
  raise exception 'authenticated role read protected beta summary rows directly';
exception when sqlstate '42501' then null;
end;
$$;
reset role;

do $$
begin
  if has_function_privilege(
       'anonymous',
       'list_founder_admin_beta_proof_run_summary_records()',
       'execute'
     ) then
    raise exception 'anonymous role retained founder beta summary execute authority';
  end if;
  if not has_function_privilege(
       'authenticated',
       'list_founder_admin_beta_proof_run_summary_records()',
       'execute'
     ) then
    raise exception 'authenticated role lost founder beta summary execute authority';
  end if;
  if exists (
    select 1
    from pg_proc function_record
    cross join lateral aclexplode(function_record.proacl) function_acl
    where function_record.oid = 'list_founder_admin_beta_proof_run_summary_records()'::regprocedure
      and function_acl.grantee = 0
      and function_acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC retained founder beta summary execute authority';
  end if;
end;
$$;

set local role anonymous;
do $$
begin
  perform list_founder_admin_beta_proof_run_summary_records();
  raise exception 'anonymous role executed founder beta summary function';
exception when sqlstate '42501' then null;
end;
$$;
reset role;

rollback;
