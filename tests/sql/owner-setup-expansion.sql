\set ON_ERROR_STOP on

begin;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select ''00000000-0000-0000-0000-000000000101''::uuid';

insert into plans (
  id, name, included_locations, included_voice_minutes, included_emails,
  included_users, overage_voice_minute_cents
) values ('plan_setup_contract', 'Setup contract', 2, 0, 0, 2, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values
  ('tenant_setup_contract', 'Setup Contract', 'setup-contract', 'setup',
   'plan_setup_contract', 'pilot', 'concierge'),
  ('tenant_setup_other', 'Setup Other', 'setup-other', 'setup',
   'plan_setup_contract', 'pilot', 'concierge');

insert into neon_auth."user" (id)
values ('00000000-0000-0000-0000-000000000101');

insert into users (id, external_auth_id, email, name)
values (
  'user_setup_owner',
  '00000000-0000-0000-0000-000000000101',
  'setup-owner@example.com',
  'Setup Owner'
);

insert into tenant_memberships (
  id, tenant_id, user_id, role, invite_status
) values (
  'membership_setup_owner',
  'tenant_setup_contract',
  'user_setup_owner',
  'owner',
  'active'
);

insert into locations (
  id, tenant_id, name, address, timezone, status
) values (
  'location_setup_primary',
  'tenant_setup_contract',
  'Primary',
  '100 Main Street',
  'America/Chicago',
  'draft'
);

set local role authenticated;

select create_handoff_rule_draft(
  'tenant_setup_contract',
  'location_setup_primary',
  'rule-request-1',
  'topic',
  'membership freeze',
  'create_task',
  'front desk queue',
  'always',
  50,
  'Contract create'
);
select create_handoff_rule_draft(
  'tenant_setup_contract',
  'location_setup_primary',
  'rule-request-1',
  'topic',
  'membership freeze',
  'create_task',
  'front desk queue',
  'always',
  50,
  'Contract replay'
);

reset role;

do $$
begin
  if (select count(*) from handoff_rules
      where tenant_id = 'tenant_setup_contract' and creation_key = 'rule-request-1') <> 1 then
    raise exception 'handoff rule replay duplicated the row';
  end if;
  if (select count(*) from handoff_rule_revisions
      where tenant_id = 'tenant_setup_contract') <> 1 then
    raise exception 'handoff rule replay duplicated revision evidence';
  end if;
end;
$$;

set local role authenticated;

do $$
begin
  begin
    perform create_handoff_rule_draft(
      'tenant_setup_contract', 'location_setup_primary', 'rule-request-1',
      'topic', 'different topic', 'create_task', 'front desk queue', 'always',
      50, 'Conflicting replay'
    );
    raise exception 'handoff rule conflicting replay unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;
end;
$$;

select create_notification_destination_draft(
  'tenant_setup_contract',
  'location_setup_primary',
  'destination-request-1',
  'staff_email',
  'Staff inbox',
  'staff@example.com',
  'Contract create'
);

select create_additional_location_draft(
  'tenant_setup_contract',
  'location-request-1',
  'North',
  '200 North Street',
  null,
  null,
  'America/Chicago',
  'Contract create'
);

do $$
begin
  if (select count(*) from locations where tenant_id = 'tenant_setup_contract') <> 2 then
    raise exception 'additional location was not created';
  end if;

  begin
    perform create_notification_destination_draft(
      'tenant_setup_contract', 'location_setup_primary', 'destination-request-1',
      'staff_email', 'Staff inbox', 'different@example.com', 'Conflicting replay'
    );
    raise exception 'destination conflicting replay unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;

  begin
    perform create_additional_location_draft(
      'tenant_setup_contract', 'location-request-1', 'Different north',
      '200 North Street', null, null, 'America/Chicago', 'Conflicting replay'
    );
    raise exception 'location conflicting replay unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;
  if (select count(*) from provider_connections
      where tenant_id = 'tenant_setup_contract'
        and location_id = (
          select id from locations
          where tenant_id = 'tenant_setup_contract'
            and creation_key = 'location-request-1'
        )
        and status = 'not_configured'
        and not credential_reference_configured) <> 2 then
    raise exception 'safe provider stubs were not created';
  end if;

  begin
    perform create_additional_location_draft(
      'tenant_setup_contract', 'location-request-2', 'West', '300 West Street',
      null, null, 'America/Chicago', 'Should fail'
    );
    raise exception 'location allowance unexpectedly bypassed';
  exception
    when check_violation then
      if sqlerrm not like 'location allowance reached%' then raise; end if;
  end;

  begin
    perform create_handoff_rule_draft(
      'tenant_setup_other', null, 'cross-tenant-rule', 'topic', 'cross tenant',
      'create_task', 'queue', 'always', 50, 'Should fail'
    );
    raise exception 'cross-tenant owner creation unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform create_notification_destination_draft(
      'tenant_setup_other', null, 'cross-tenant-destination', 'staff_email',
      'Other inbox', 'other@example.com', 'Should fail'
    );
    raise exception 'cross-tenant destination creation unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform create_additional_location_draft(
      'tenant_setup_other', 'cross-tenant-location', 'Other', 'Other address',
      null, null, 'America/Chicago', 'Should fail'
    );
    raise exception 'cross-tenant location creation unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'create_handoff_rule_draft(text,text,text,text,text,text,text,text,integer,text)',
    'execute'
  ) then raise exception 'authenticated cannot create handoff rules'; end if;
  if not has_function_privilege(
    'authenticated',
    'create_notification_destination_draft(text,text,text,text,text,text,text)',
    'execute'
  ) then raise exception 'authenticated cannot create notification destinations'; end if;
  if not has_function_privilege(
    'authenticated',
    'create_additional_location_draft(text,text,text,text,text,text,text,text)',
    'execute'
  ) then raise exception 'authenticated cannot create locations'; end if;
  if has_function_privilege(
    'anonymous',
    'create_handoff_rule_draft(text,text,text,text,text,text,text,text,integer,text)',
    'execute'
  ) then raise exception 'anonymous can create handoff rules'; end if;
  if has_function_privilege(
    'anonymous',
    'create_notification_destination_draft(text,text,text,text,text,text,text)',
    'execute'
  ) then raise exception 'anonymous can create notification destinations'; end if;
  if has_function_privilege(
    'anonymous',
    'create_additional_location_draft(text,text,text,text,text,text,text,text)',
    'execute'
  ) then raise exception 'anonymous can create locations'; end if;
end;
$$;

rollback;
