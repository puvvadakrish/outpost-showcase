-- Owner location profile persistence.
-- Keeps location edits as one PostgreSQL RPC transaction: current location
-- row, revision evidence, and audit event are written together.
-- This does not enable live phone routing or provider delivery.

create table location_revisions (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text not null,
  actor_user_id text,
  previous_name text not null,
  next_name text not null,
  previous_address text not null,
  next_address text not null,
  previous_public_phone text,
  next_public_phone text,
  previous_routing_phone text,
  next_routing_phone text,
  previous_timezone text not null,
  next_timezone text not null,
  previous_status location_status not null,
  next_status location_status not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, actor_user_id) references tenant_memberships(tenant_id, user_id)
);

create index location_revisions_location_created_idx
  on location_revisions (tenant_id, location_id, created_at desc);

alter table location_revisions enable row level security;

create policy "members read location revisions" on location_revisions
  for select using (is_active_tenant_member(tenant_id));

grant select on location_revisions to authenticated;

create or replace function update_location_profile(
  p_tenant_id text,
  p_location_id text,
  p_name text,
  p_address text,
  p_public_phone text,
  p_routing_phone text,
  p_timezone text,
  p_status text,
  p_note text default 'Owner updated location profile through Outpost.'
)
returns locations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_existing locations;
  v_next_status location_status;
  v_revision_id text := gen_random_uuid()::text;
  v_updated locations;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_location_id := btrim(p_location_id);
  p_name := btrim(p_name);
  p_address := btrim(p_address);
  p_public_phone := nullif(btrim(coalesce(p_public_phone, '')), '');
  p_routing_phone := nullif(btrim(coalesce(p_routing_phone, '')), '');
  p_timezone := btrim(p_timezone);
  p_status := btrim(p_status);
  p_note := coalesce(nullif(btrim(p_note), ''), 'Owner updated location profile through Outpost.');

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_location_id, '') is null then
    raise exception 'location identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_name, '') is null then
    raise exception 'location name is required'
      using errcode = '22023';
  end if;

  if nullif(p_address, '') is null then
    raise exception 'location address is required'
      using errcode = '22023';
  end if;

  if nullif(p_timezone, '') is null then
    raise exception 'location timezone is required'
      using errcode = '22023';
  end if;

  if length(p_name) > 120 then
    raise exception 'location name must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_address) > 240 then
    raise exception 'location address must be 240 characters or fewer'
      using errcode = '22023';
  end if;

  if p_public_phone is not null and length(p_public_phone) > 80 then
    raise exception 'location public phone must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  if p_routing_phone is not null and length(p_routing_phone) > 80 then
    raise exception 'location routing phone must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_timezone) > 80 then
    raise exception 'location timezone must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_note) > 500 then
    raise exception 'location revision note must be 500 characters or fewer'
      using errcode = '22023';
  end if;

  if not is_active_tenant_owner(p_tenant_id) then
    raise exception 'owner membership required for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  v_next_status := p_status::location_status;

  select current_app_user_id() into v_actor_user_id;

  if v_actor_user_id is null then
    raise exception 'active application user is required'
      using errcode = '42501';
  end if;

  select *
    into v_existing
    from locations
    where tenant_id = p_tenant_id
      and id = p_location_id
    for update;

  if not found then
    raise exception 'location not found'
      using errcode = 'P0002';
  end if;

  update locations
     set name = p_name,
         address = p_address,
         public_phone = p_public_phone,
         routing_phone = p_routing_phone,
         timezone = p_timezone,
         status = v_next_status,
         updated_at = now()
   where tenant_id = p_tenant_id
     and id = p_location_id
   returning * into v_updated;

  insert into location_revisions (
    id,
    tenant_id,
    location_id,
    actor_user_id,
    previous_name,
    next_name,
    previous_address,
    next_address,
    previous_public_phone,
    next_public_phone,
    previous_routing_phone,
    next_routing_phone,
    previous_timezone,
    next_timezone,
    previous_status,
    next_status,
    note
  ) values (
    v_revision_id,
    p_tenant_id,
    v_updated.id,
    v_actor_user_id,
    v_existing.name,
    v_updated.name,
    v_existing.address,
    v_updated.address,
    v_existing.public_phone,
    v_updated.public_phone,
    v_existing.routing_phone,
    v_updated.routing_phone,
    v_existing.timezone,
    v_updated.timezone,
    v_existing.status,
    v_updated.status,
    p_note
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
    p_tenant_id,
    v_actor_user_id,
    'location',
    v_updated.id,
    'location.updated',
    jsonb_build_object(
      'previous_name', v_existing.name,
      'next_name', v_updated.name,
      'previous_address', v_existing.address,
      'next_address', v_updated.address,
      'previous_public_phone', v_existing.public_phone,
      'next_public_phone', v_updated.public_phone,
      'previous_routing_phone', v_existing.routing_phone,
      'next_routing_phone', v_updated.routing_phone,
      'previous_timezone', v_existing.timezone,
      'next_timezone', v_updated.timezone,
      'previous_status', v_existing.status,
      'next_status', v_updated.status,
      'revision_id', v_revision_id
    )
  );

  return v_updated;
end;
$$;

revoke execute on function update_location_profile(text, text, text, text, text, text, text, text, text)
  from public, anonymous;
grant execute on function update_location_profile(text, text, text, text, text, text, text, text, text)
  to authenticated;
