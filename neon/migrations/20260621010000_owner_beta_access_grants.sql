-- Controlled owner beta access.
-- This gates new owner tenant bootstrap on an active beta grant. It does not
-- send invite email, create Auth users, enable providers, or promote production.

create type owner_beta_access_status as enum ('active', 'disabled');

create table owner_beta_access_grants (
  id text primary key,
  email citext not null unique,
  display_name text not null,
  status owner_beta_access_status not null default 'active',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table owner_beta_access_grants enable row level security;

revoke all on table owner_beta_access_grants from public, anonymous, authenticated;

create or replace function has_active_owner_beta_access(p_owner_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from owner_beta_access_grants
      where email = lower(btrim(p_owner_email))::citext
        and status = 'active'
        and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(btrim(p_owner_email))
  );
$$;

revoke execute on function has_active_owner_beta_access(text)
  from public, anonymous;
grant execute on function has_active_owner_beta_access(text)
  to authenticated;

create or replace function bootstrap_owner_tenant(
  p_owner_email text,
  p_owner_name text,
  p_tenant_name text,
  p_location_name text,
  p_location_address text,
  p_timezone text,
  p_public_phone text default null
)
returns table (
  tenant_id text,
  tenant_name text,
  tenant_slug text,
  location_id text,
  location_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_auth_id uuid := auth.uid();
  v_audit_event_id text := 'audit_' || gen_random_uuid()::text;
  v_existing_active_memberships integer;
  v_jwt_email text := nullif(auth.jwt() ->> 'email', '');
  v_location_id text := 'loc_' || gen_random_uuid()::text;
  v_plan_id text := 'plan_single_location';
  v_slug_base text;
  v_source_document_id text := 'source_' || gen_random_uuid()::text;
  v_tenant_id text := 'tenant_' || gen_random_uuid()::text;
  v_tenant_slug text;
  v_user_id text;
begin
  p_owner_email := lower(btrim(p_owner_email));
  p_owner_name := btrim(p_owner_name);
  p_tenant_name := btrim(p_tenant_name);
  p_location_name := btrim(p_location_name);
  p_location_address := btrim(p_location_address);
  p_timezone := btrim(p_timezone);
  p_public_phone := nullif(btrim(coalesce(p_public_phone, '')), '');

  if v_actor_auth_id is null then
    raise exception 'authenticated user is required'
      using errcode = '42501';
  end if;

  if nullif(p_owner_email, '') is null then
    raise exception 'owner email is required'
      using errcode = '22023';
  end if;

  if v_jwt_email is null then
    raise exception 'authenticated email claim is required'
      using errcode = '42501';
  end if;

  if lower(v_jwt_email) <> p_owner_email then
    raise exception 'owner email must match authenticated email'
      using errcode = '42501';
  end if;

  if not has_active_owner_beta_access(p_owner_email) then
    raise exception 'owner beta access grant is required before creating a tenant'
      using errcode = '42501';
  end if;

  if nullif(p_owner_name, '') is null then
    raise exception 'owner name is required'
      using errcode = '22023';
  end if;

  if nullif(p_tenant_name, '') is null then
    raise exception 'gym name is required'
      using errcode = '22023';
  end if;

  if nullif(p_location_name, '') is null then
    raise exception 'location name is required'
      using errcode = '22023';
  end if;

  if nullif(p_location_address, '') is null then
    raise exception 'location address is required'
      using errcode = '22023';
  end if;

  if nullif(p_timezone, '') is null then
    raise exception 'timezone is required'
      using errcode = '22023';
  end if;

  if length(p_owner_email) > 254 then
    raise exception 'owner email must be 254 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_owner_name) > 120 then
    raise exception 'owner name must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_tenant_name) > 120 then
    raise exception 'gym name must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_location_name) > 120 then
    raise exception 'location name must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_location_address) > 240 then
    raise exception 'location address must be 240 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_timezone) > 80 then
    raise exception 'timezone must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  if p_public_phone is not null and length(p_public_phone) > 80 then
    raise exception 'public phone must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  if not exists (select 1 from plans where id = v_plan_id) then
    raise exception 'default plan is not configured'
      using errcode = 'P0002';
  end if;

  select users.id
    into v_user_id
    from users
    where users.external_auth_id = v_actor_auth_id
       or users.email = p_owner_email
    order by case when users.external_auth_id = v_actor_auth_id then 0 else 1 end
    limit 1
    for update;

  if v_user_id is null then
    v_user_id := 'user_' || gen_random_uuid()::text;

    insert into users (
      id,
      external_auth_id,
      email,
      name
    ) values (
      v_user_id,
      v_actor_auth_id,
      p_owner_email,
      p_owner_name
    );
  else
    update users
       set external_auth_id = coalesce(external_auth_id, v_actor_auth_id),
           email = p_owner_email,
           name = p_owner_name,
           updated_at = now()
     where id = v_user_id
       and (external_auth_id is null or external_auth_id = v_actor_auth_id)
    returning id into v_user_id;

    if v_user_id is null then
      raise exception 'owner email is already linked to another authenticated user'
        using errcode = '23505';
    end if;
  end if;

  select count(*)
    into v_existing_active_memberships
    from tenant_memberships
    where user_id = v_user_id
      and invite_status = 'active';

  if v_existing_active_memberships > 0 then
    raise exception 'user already has an active tenant membership'
      using errcode = '23505';
  end if;

  v_slug_base := lower(regexp_replace(p_tenant_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug_base := btrim(regexp_replace(v_slug_base, '-+', '-', 'g'), '-');
  v_slug_base := coalesce(nullif(left(v_slug_base, 40), ''), 'gym');
  v_tenant_slug := v_slug_base || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);

  insert into tenants (
    id,
    name,
    slug,
    status,
    plan_id,
    billing_mode,
    support_tier
  ) values (
    v_tenant_id,
    p_tenant_name,
    v_tenant_slug,
    'setup',
    v_plan_id,
    'pilot',
    'standard'
  );

  insert into tenant_memberships (
    id,
    tenant_id,
    user_id,
    role,
    invite_status
  ) values (
    'member_' || gen_random_uuid()::text,
    v_tenant_id,
    v_user_id,
    'owner',
    'active'
  );

  insert into locations (
    id,
    tenant_id,
    name,
    address,
    public_phone,
    routing_phone,
    timezone,
    status
  ) values (
    v_location_id,
    v_tenant_id,
    p_location_name,
    p_location_address,
    p_public_phone,
    null,
    p_timezone,
    'draft'
  );

  insert into source_documents (
    id,
    tenant_id,
    location_id,
    source_type,
    label,
    status,
    facts_found,
    conflicts_found
  ) values (
    v_source_document_id,
    v_tenant_id,
    v_location_id,
    'manual',
    'Owner setup notes',
    'missing',
    0,
    0
  );

  insert into handoff_rules (
    id,
    tenant_id,
    location_id,
    trigger,
    topic,
    action,
    destination,
    active_window,
    priority,
    status
  ) values
    (
      'rule_' || gen_random_uuid()::text,
      v_tenant_id,
      v_location_id,
      'always_human',
      'cancellation or freeze',
      'create_task',
      'front desk queue',
      'always',
      10,
      'active'
    ),
    (
      'rule_' || gen_random_uuid()::text,
      v_tenant_id,
      v_location_id,
      'low_confidence',
      'unapproved or low-confidence fact',
      'create_task',
      'front desk queue',
      'always',
      20,
      'active'
    ),
    (
      'rule_' || gen_random_uuid()::text,
      v_tenant_id,
      v_location_id,
      'explicit_human_request',
      'caller or sender asks for a person',
      'create_task',
      'front desk queue',
      'always',
      30,
      'draft'
    );

  insert into notification_destinations (
    id,
    tenant_id,
    location_id,
    destination_type,
    label,
    destination,
    status
  ) values (
    'dest_' || gen_random_uuid()::text,
    v_tenant_id,
    v_location_id,
    'task_queue',
    'Unified task inbox',
    'Front-desk workboard',
    'ready'
  );

  insert into provider_connections (
    id,
    tenant_id,
    location_id,
    channel,
    provider_key,
    status,
    external_account_label,
    secret_ref,
    disabled_reason
  ) values
    (
      'provider_' || gen_random_uuid()::text,
      v_tenant_id,
      v_location_id,
      'phone',
      'retell',
      'not_configured',
      null,
      null,
      'not configured'
    ),
    (
      'provider_' || gen_random_uuid()::text,
      v_tenant_id,
      v_location_id,
      'email',
      'gmail',
      'not_configured',
      null,
      null,
      'not configured'
    );

  insert into audit_events (
    id,
    tenant_id,
    actor_user_id,
    subject_type,
    subject_id,
    action,
    metadata
  ) values (
    v_audit_event_id,
    v_tenant_id,
    v_user_id,
    'tenant',
    v_tenant_id,
    'tenant.bootstrapped',
    jsonb_build_object(
      'location_id', v_location_id,
      'source_document_id', v_source_document_id,
      'plan_id', v_plan_id,
      'live_providers_enabled', false
    )
  );

  return query
    select
      v_tenant_id,
      p_tenant_name,
      v_tenant_slug,
      v_location_id,
      p_location_name;
end;
$$;

revoke execute on function bootstrap_owner_tenant(text, text, text, text, text, text, text)
  from public, anonymous;
grant execute on function bootstrap_owner_tenant(text, text, text, text, text, text, text)
  to authenticated;
