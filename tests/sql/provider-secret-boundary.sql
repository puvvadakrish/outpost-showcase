\set ON_ERROR_STOP on

begin;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select ''00000000-0000-0000-0000-000000000201''::uuid';

insert into plans (
  id, name, included_locations, included_voice_minutes, included_emails,
  included_users, overage_voice_minute_cents
) values ('plan_provider_secret_contract', 'Provider secret contract', 1, 0, 0, 1, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values (
  'tenant_provider_secret_contract', 'Provider Secret Contract',
  'provider-secret-contract', 'setup', 'plan_provider_secret_contract',
  'pilot', 'concierge'
);

insert into neon_auth."user" (id)
values ('00000000-0000-0000-0000-000000000201');

insert into users (id, external_auth_id, email, name)
values (
  'user_provider_secret_owner',
  '00000000-0000-0000-0000-000000000201',
  'provider-secret-owner@example.com',
  'Provider Secret Owner'
);

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status)
values (
  'membership_provider_secret_owner',
  'tenant_provider_secret_contract',
  'user_provider_secret_owner',
  'owner',
  'active'
);

insert into provider_connections (
  id, tenant_id, channel, provider_key, status, secret_ref, disabled_reason
) values (
  'provider_secret_contract',
  'tenant_provider_secret_contract',
  'phone',
  'retell',
  'disabled',
  'outpost-secret://provider/provider_secret_contract/webhook-signing/v1',
  'credential boundary contract only'
);

do $$
begin
  if not (
    select credential_reference_configured
      from provider_connections
     where id = 'provider_secret_contract'
  ) then
    raise exception 'credential presence was not generated';
  end if;

  if has_column_privilege('authenticated', 'provider_connections', 'secret_ref', 'select') then
    raise exception 'authenticated retained secret_ref read authority';
  end if;

  if not has_column_privilege(
    'authenticated', 'provider_connections', 'credential_reference_configured', 'select'
  ) then
    raise exception 'authenticated lacks safe credential presence authority';
  end if;

  begin
    insert into provider_connections (
      id, tenant_id, channel, provider_key, status, secret_ref, disabled_reason
    ) values (
      'provider_secret_invalid', 'tenant_provider_secret_contract', 'email',
      'resend', 'disabled', 'OUTPOST_PROVIDER_SECRET_ARBITRARY', 'invalid ref'
    );
    raise exception 'invalid provider secret reference unexpectedly succeeded';
  exception
    when check_violation then null;
  end;
end;
$$;

set local role authenticated;

do $$
declare
  v_configured boolean;
begin
  select credential_reference_configured
    into v_configured
    from provider_connections
   where id = 'provider_secret_contract';

  if v_configured is distinct from true then
    raise exception 'tenant member could not read safe credential presence';
  end if;

  begin
    perform secret_ref
      from provider_connections
     where id = 'provider_secret_contract';
    raise exception 'tenant member unexpectedly read secret_ref';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;
