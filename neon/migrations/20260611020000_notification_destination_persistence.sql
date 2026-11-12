-- Owner notification-destination persistence.
-- Keeps destination edits as one PostgreSQL RPC transaction: current
-- destination row, revision evidence, and audit event are written together.
-- This does not send notifications or enable provider delivery.

alter table notification_destinations
  add constraint notification_destinations_tenant_id_id_key unique (tenant_id, id);

create table notification_destination_revisions (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  notification_destination_id text not null,
  actor_user_id text,
  previous_destination_type notification_destination_type not null,
  next_destination_type notification_destination_type not null,
  previous_label text not null,
  next_label text not null,
  previous_destination text not null,
  next_destination text not null,
  previous_status notification_destination_status not null,
  next_status notification_destination_status not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, notification_destination_id) references notification_destinations(tenant_id, id),
  foreign key (tenant_id, actor_user_id) references tenant_memberships(tenant_id, user_id)
);

create index notification_destination_revisions_destination_created_idx
  on notification_destination_revisions (tenant_id, notification_destination_id, created_at desc);

alter table notification_destination_revisions enable row level security;

create policy "members read notification destination revisions" on notification_destination_revisions
  for select using (is_active_tenant_member(tenant_id));

grant select on notification_destination_revisions to authenticated;

create or replace function update_notification_destination(
  p_tenant_id text,
  p_notification_destination_id text,
  p_destination_type text,
  p_label text,
  p_destination text,
  p_status text,
  p_note text default 'Owner updated notification destination through Outpost.'
)
returns notification_destinations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_existing notification_destinations;
  v_next_destination_type notification_destination_type;
  v_next_status notification_destination_status;
  v_revision_id text := gen_random_uuid()::text;
  v_updated notification_destinations;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_notification_destination_id := btrim(p_notification_destination_id);
  p_destination_type := btrim(p_destination_type);
  p_label := btrim(p_label);
  p_destination := btrim(p_destination);
  p_status := btrim(p_status);
  p_note := coalesce(nullif(btrim(p_note), ''), 'Owner updated notification destination through Outpost.');

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_notification_destination_id, '') is null then
    raise exception 'notification destination identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_label, '') is null then
    raise exception 'notification destination label is required'
      using errcode = '22023';
  end if;

  if nullif(p_destination, '') is null then
    raise exception 'notification destination value is required'
      using errcode = '22023';
  end if;

  if length(p_label) > 120 then
    raise exception 'notification destination label must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_destination) > 240 then
    raise exception 'notification destination value must be 240 characters or fewer'
      using errcode = '22023';
  end if;

  if not is_active_tenant_owner(p_tenant_id) then
    raise exception 'owner membership required for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  v_next_destination_type := p_destination_type::notification_destination_type;
  v_next_status := p_status::notification_destination_status;

  select current_app_user_id() into v_actor_user_id;

  if v_actor_user_id is null then
    raise exception 'active application user is required'
      using errcode = '42501';
  end if;

  select *
    into v_existing
    from notification_destinations
    where tenant_id = p_tenant_id
      and id = p_notification_destination_id
    for update;

  if not found then
    raise exception 'notification destination not found'
      using errcode = 'P0002';
  end if;

  update notification_destinations
     set destination_type = v_next_destination_type,
         label = p_label,
         destination = p_destination,
         status = v_next_status,
         updated_at = now()
   where tenant_id = p_tenant_id
     and id = p_notification_destination_id
   returning * into v_updated;

  insert into notification_destination_revisions (
    id,
    tenant_id,
    location_id,
    notification_destination_id,
    actor_user_id,
    previous_destination_type,
    next_destination_type,
    previous_label,
    next_label,
    previous_destination,
    next_destination,
    previous_status,
    next_status,
    note
  ) values (
    v_revision_id,
    p_tenant_id,
    v_updated.location_id,
    v_updated.id,
    v_actor_user_id,
    v_existing.destination_type,
    v_updated.destination_type,
    v_existing.label,
    v_updated.label,
    v_existing.destination,
    v_updated.destination,
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
    'notification_destination',
    v_updated.id,
    'notification_destination.updated',
    jsonb_build_object(
      'previous_destination_type', v_existing.destination_type,
      'next_destination_type', v_updated.destination_type,
      'previous_label', v_existing.label,
      'next_label', v_updated.label,
      'previous_destination', v_existing.destination,
      'next_destination', v_updated.destination,
      'previous_status', v_existing.status,
      'next_status', v_updated.status,
      'revision_id', v_revision_id
    )
  );

  return v_updated;
end;
$$;

revoke execute on function update_notification_destination(text, text, text, text, text, text, text)
  from public, anonymous;
grant execute on function update_notification_destination(text, text, text, text, text, text, text)
  to authenticated;
