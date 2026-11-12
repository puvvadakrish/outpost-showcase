-- Durable owner-created setup drafts.
-- Creation remains configuration-only: no transfer, provider, or notification
-- delivery behavior is enabled.

alter table handoff_rules
  add column creation_key text;

alter table handoff_rules
  add constraint handoff_rules_tenant_creation_key_key
  unique (tenant_id, creation_key);

alter table notification_destinations
  add column creation_key text;

alter table notification_destinations
  add constraint notification_destinations_tenant_creation_key_key
  unique (tenant_id, creation_key);

alter table locations
  add column creation_key text;

alter table locations
  add constraint locations_tenant_creation_key_key
  unique (tenant_id, creation_key);

create or replace function create_handoff_rule_draft(
  p_tenant_id text,
  p_location_id text,
  p_creation_key text,
  p_trigger text,
  p_topic text,
  p_action text,
  p_destination text,
  p_active_window text,
  p_priority integer,
  p_note text default 'Owner created handoff rule draft through Outpost.'
)
returns handoff_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_created handoff_rules;
  v_next_action handoff_action;
  v_next_trigger handoff_trigger;
  v_revision_id text := gen_random_uuid()::text;
  v_rule_id text := gen_random_uuid()::text;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_location_id := nullif(btrim(coalesce(p_location_id, '')), '');
  p_creation_key := btrim(p_creation_key);
  p_trigger := btrim(p_trigger);
  p_topic := btrim(p_topic);
  p_action := btrim(p_action);
  p_destination := btrim(p_destination);
  p_active_window := btrim(p_active_window);
  p_note := coalesce(nullif(btrim(p_note), ''), 'Owner created handoff rule draft through Outpost.');

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required' using errcode = '22023';
  end if;
  if nullif(p_creation_key, '') is null or length(p_creation_key) > 200 then
    raise exception 'handoff rule creation key is required and must be 200 characters or fewer'
      using errcode = '22023';
  end if;
  if nullif(p_topic, '') is null then
    raise exception 'handoff rule topic is required' using errcode = '22023';
  end if;
  if nullif(p_destination, '') is null then
    raise exception 'handoff rule destination is required' using errcode = '22023';
  end if;
  if nullif(p_active_window, '') is null then
    raise exception 'handoff rule active window is required' using errcode = '22023';
  end if;
  if length(p_topic) > 160 then
    raise exception 'handoff rule topic must be 160 characters or fewer' using errcode = '22023';
  end if;
  if length(p_destination) > 240 then
    raise exception 'handoff rule destination must be 240 characters or fewer' using errcode = '22023';
  end if;
  if length(p_active_window) > 120 then
    raise exception 'handoff rule active window must be 120 characters or fewer' using errcode = '22023';
  end if;
  if length(p_note) > 500 then
    raise exception 'handoff rule revision note must be 500 characters or fewer' using errcode = '22023';
  end if;
  if p_priority is null or p_priority < 1 or p_priority > 1000 then
    raise exception 'handoff rule priority must be a whole number from 1 to 1000' using errcode = '22023';
  end if;
  if not is_active_tenant_owner(p_tenant_id) then
    raise exception 'owner membership required for tenant %', p_tenant_id using errcode = '42501';
  end if;
  if p_location_id is not null and not exists (
    select 1 from locations where tenant_id = p_tenant_id and id = p_location_id
  ) then
    raise exception 'location not found for tenant' using errcode = 'P0002';
  end if;

  v_next_trigger := p_trigger::handoff_trigger;
  v_next_action := p_action::handoff_action;
  select current_app_user_id() into v_actor_user_id;
  if v_actor_user_id is null then
    raise exception 'active application user is required' using errcode = '42501';
  end if;

  insert into handoff_rules (
    id, tenant_id, location_id, trigger, topic, action, destination,
    active_window, priority, status, creation_key
  ) values (
    v_rule_id, p_tenant_id, p_location_id, v_next_trigger, p_topic,
    v_next_action, p_destination, p_active_window, p_priority, 'draft',
    p_creation_key
  )
  on conflict (tenant_id, creation_key) do nothing
  returning * into v_created;

  if v_created.id is null then
    select * into v_created
      from handoff_rules
      where tenant_id = p_tenant_id and creation_key = p_creation_key;
    if v_created.location_id is distinct from p_location_id
       or v_created.trigger <> v_next_trigger
       or v_created.topic <> p_topic
       or v_created.action <> v_next_action
       or v_created.destination <> p_destination
       or v_created.active_window <> p_active_window
       or v_created.priority <> p_priority then
      raise exception 'handoff rule creation key conflicts with different work'
        using errcode = '23505';
    end if;
    return v_created;
  end if;

  insert into handoff_rule_revisions (
    id, tenant_id, location_id, handoff_rule_id, actor_user_id,
    previous_trigger, next_trigger, previous_topic, next_topic,
    previous_action, next_action, previous_destination, next_destination,
    previous_active_window, next_active_window, previous_status, next_status,
    previous_priority, next_priority, note
  ) values (
    v_revision_id, p_tenant_id, v_created.location_id, v_created.id,
    v_actor_user_id, v_created.trigger, v_created.trigger, v_created.topic,
    v_created.topic, v_created.action, v_created.action, v_created.destination,
    v_created.destination, v_created.active_window, v_created.active_window,
    v_created.status, v_created.status, v_created.priority, v_created.priority,
    p_note
  );

  insert into audit_events (
    id, tenant_id, actor_user_id, subject_type, subject_id, action, metadata
  ) values (
    v_audit_event_id, p_tenant_id, v_actor_user_id, 'handoff_rule',
    v_created.id, 'handoff_rule.created',
    jsonb_build_object(
      'status', v_created.status,
      'location_id', v_created.location_id,
      'revision_id', v_revision_id
    )
  );

  return v_created;
end;
$$;

create or replace function create_notification_destination_draft(
  p_tenant_id text,
  p_location_id text,
  p_creation_key text,
  p_destination_type text,
  p_label text,
  p_destination text,
  p_note text default 'Owner created notification destination draft through Outpost.'
)
returns notification_destinations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_created notification_destinations;
  v_destination_id text := gen_random_uuid()::text;
  v_next_destination_type notification_destination_type;
  v_revision_id text := gen_random_uuid()::text;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_location_id := nullif(btrim(coalesce(p_location_id, '')), '');
  p_creation_key := btrim(p_creation_key);
  p_destination_type := btrim(p_destination_type);
  p_label := btrim(p_label);
  p_destination := btrim(p_destination);
  p_note := coalesce(nullif(btrim(p_note), ''), 'Owner created notification destination draft through Outpost.');

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required' using errcode = '22023';
  end if;
  if nullif(p_creation_key, '') is null or length(p_creation_key) > 200 then
    raise exception 'notification destination creation key is required and must be 200 characters or fewer'
      using errcode = '22023';
  end if;
  if nullif(p_label, '') is null then
    raise exception 'notification destination label is required' using errcode = '22023';
  end if;
  if nullif(p_destination, '') is null then
    raise exception 'notification destination value is required' using errcode = '22023';
  end if;
  if length(p_label) > 120 then
    raise exception 'notification destination label must be 120 characters or fewer' using errcode = '22023';
  end if;
  if length(p_destination) > 240 then
    raise exception 'notification destination value must be 240 characters or fewer' using errcode = '22023';
  end if;
  if length(p_note) > 500 then
    raise exception 'notification destination revision note must be 500 characters or fewer' using errcode = '22023';
  end if;
  if not is_active_tenant_owner(p_tenant_id) then
    raise exception 'owner membership required for tenant %', p_tenant_id using errcode = '42501';
  end if;
  if p_location_id is not null and not exists (
    select 1 from locations where tenant_id = p_tenant_id and id = p_location_id
  ) then
    raise exception 'location not found for tenant' using errcode = 'P0002';
  end if;

  v_next_destination_type := p_destination_type::notification_destination_type;
  select current_app_user_id() into v_actor_user_id;
  if v_actor_user_id is null then
    raise exception 'active application user is required' using errcode = '42501';
  end if;

  insert into notification_destinations (
    id, tenant_id, location_id, destination_type, label, destination, status,
    creation_key
  ) values (
    v_destination_id, p_tenant_id, p_location_id, v_next_destination_type,
    p_label, p_destination, 'draft', p_creation_key
  )
  on conflict (tenant_id, creation_key) do nothing
  returning * into v_created;

  if v_created.id is null then
    select * into v_created
      from notification_destinations
      where tenant_id = p_tenant_id and creation_key = p_creation_key;
    if v_created.location_id is distinct from p_location_id
       or v_created.destination_type <> v_next_destination_type
       or v_created.label <> p_label
       or v_created.destination <> p_destination then
      raise exception 'notification destination creation key conflicts with different work'
        using errcode = '23505';
    end if;
    return v_created;
  end if;

  insert into notification_destination_revisions (
    id, tenant_id, location_id, notification_destination_id, actor_user_id,
    previous_destination_type, next_destination_type, previous_label,
    next_label, previous_destination, next_destination, previous_status,
    next_status, note
  ) values (
    v_revision_id, p_tenant_id, v_created.location_id, v_created.id,
    v_actor_user_id, v_created.destination_type, v_created.destination_type,
    v_created.label, v_created.label, v_created.destination,
    v_created.destination, v_created.status, v_created.status, p_note
  );

  insert into audit_events (
    id, tenant_id, actor_user_id, subject_type, subject_id, action, metadata
  ) values (
    v_audit_event_id, p_tenant_id, v_actor_user_id,
    'notification_destination', v_created.id,
    'notification_destination.created',
    jsonb_build_object(
      'status', v_created.status,
      'location_id', v_created.location_id,
      'revision_id', v_revision_id
    )
  );

  return v_created;
end;
$$;

create or replace function create_additional_location_draft(
  p_tenant_id text,
  p_creation_key text,
  p_name text,
  p_address text,
  p_public_phone text,
  p_routing_phone text,
  p_timezone text,
  p_note text default 'Owner created additional location draft through Outpost.'
)
returns locations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_created locations;
  v_email_provider_id text := gen_random_uuid()::text;
  v_included_locations integer;
  v_location_count integer;
  v_location_id text := gen_random_uuid()::text;
  v_phone_provider_id text := gen_random_uuid()::text;
  v_revision_id text := gen_random_uuid()::text;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_creation_key := btrim(p_creation_key);
  p_name := btrim(p_name);
  p_address := btrim(p_address);
  p_public_phone := nullif(btrim(coalesce(p_public_phone, '')), '');
  p_routing_phone := nullif(btrim(coalesce(p_routing_phone, '')), '');
  p_timezone := btrim(p_timezone);
  p_note := coalesce(nullif(btrim(p_note), ''), 'Owner created additional location draft through Outpost.');

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required' using errcode = '22023';
  end if;
  if nullif(p_creation_key, '') is null or length(p_creation_key) > 200 then
    raise exception 'location creation key is required and must be 200 characters or fewer'
      using errcode = '22023';
  end if;
  if nullif(p_name, '') is null then
    raise exception 'location name is required' using errcode = '22023';
  end if;
  if nullif(p_address, '') is null then
    raise exception 'location address is required' using errcode = '22023';
  end if;
  if nullif(p_timezone, '') is null then
    raise exception 'location timezone is required' using errcode = '22023';
  end if;
  if length(p_name) > 120 then
    raise exception 'location name must be 120 characters or fewer' using errcode = '22023';
  end if;
  if length(p_address) > 240 then
    raise exception 'location address must be 240 characters or fewer' using errcode = '22023';
  end if;
  if p_public_phone is not null and length(p_public_phone) > 80 then
    raise exception 'location public phone must be 80 characters or fewer' using errcode = '22023';
  end if;
  if p_routing_phone is not null and length(p_routing_phone) > 80 then
    raise exception 'location routing phone must be 80 characters or fewer' using errcode = '22023';
  end if;
  if length(p_timezone) > 80 then
    raise exception 'location timezone must be 80 characters or fewer' using errcode = '22023';
  end if;
  if length(p_note) > 500 then
    raise exception 'location revision note must be 500 characters or fewer' using errcode = '22023';
  end if;
  if not is_active_tenant_owner(p_tenant_id) then
    raise exception 'owner membership required for tenant %', p_tenant_id using errcode = '42501';
  end if;

  select current_app_user_id() into v_actor_user_id;
  if v_actor_user_id is null then
    raise exception 'active application user is required' using errcode = '42501';
  end if;

  select plans.included_locations
    into v_included_locations
    from tenants
    join plans on plans.id = tenants.plan_id
    where tenants.id = p_tenant_id
    for update of tenants, plans;

  if not found then
    raise exception 'tenant plan not found' using errcode = 'P0002';
  end if;

  select * into v_created
    from locations
    where tenant_id = p_tenant_id and creation_key = p_creation_key;
  if found then
    if v_created.name <> p_name
       or v_created.address <> p_address
       or v_created.public_phone is distinct from p_public_phone
       or v_created.routing_phone is distinct from p_routing_phone
       or v_created.timezone <> p_timezone then
      raise exception 'location creation key conflicts with different work'
        using errcode = '23505';
    end if;
    return v_created;
  end if;

  select count(*) into v_location_count
    from locations
    where tenant_id = p_tenant_id;
  if v_location_count >= v_included_locations then
    raise exception 'location allowance reached for the current plan'
      using errcode = '23514';
  end if;

  insert into locations (
    id, tenant_id, name, address, public_phone, routing_phone, timezone, status,
    creation_key
  ) values (
    v_location_id, p_tenant_id, p_name, p_address, p_public_phone,
    p_routing_phone, p_timezone, 'draft', p_creation_key
  )
  returning * into v_created;

  insert into provider_connections (
    id, tenant_id, location_id, channel, provider_key, status,
    external_account_label, secret_ref, disabled_reason
  ) values
    (
      v_phone_provider_id, p_tenant_id, v_created.id, 'phone', 'retell',
      'not_configured', null, null, 'not configured'
    ),
    (
      v_email_provider_id, p_tenant_id, v_created.id, 'email', 'resend',
      'not_configured', null, null, 'not configured'
    );

  insert into location_revisions (
    id, tenant_id, location_id, actor_user_id, previous_name, next_name,
    previous_address, next_address, previous_public_phone, next_public_phone,
    previous_routing_phone, next_routing_phone, previous_timezone,
    next_timezone, previous_status, next_status, note
  ) values (
    v_revision_id, p_tenant_id, v_created.id, v_actor_user_id,
    v_created.name, v_created.name, v_created.address, v_created.address,
    v_created.public_phone, v_created.public_phone, v_created.routing_phone,
    v_created.routing_phone, v_created.timezone, v_created.timezone,
    v_created.status, v_created.status, p_note
  );

  insert into audit_events (
    id, tenant_id, actor_user_id, subject_type, subject_id, action, metadata
  ) values (
    v_audit_event_id, p_tenant_id, v_actor_user_id, 'location', v_created.id,
    'location.created',
    jsonb_build_object(
      'status', v_created.status,
      'revision_id', v_revision_id,
      'provider_stub_ids', jsonb_build_array(v_phone_provider_id, v_email_provider_id),
      'included_locations', v_included_locations
    )
  );

  return v_created;
end;
$$;

revoke execute on function create_handoff_rule_draft(
  text, text, text, text, text, text, text, text, integer, text
) from public, anonymous;
grant execute on function create_handoff_rule_draft(
  text, text, text, text, text, text, text, text, integer, text
) to authenticated;

revoke execute on function create_notification_destination_draft(
  text, text, text, text, text, text, text
) from public, anonymous;
grant execute on function create_notification_destination_draft(
  text, text, text, text, text, text, text
) to authenticated;

revoke execute on function create_additional_location_draft(
  text, text, text, text, text, text, text, text
) from public, anonymous;
grant execute on function create_additional_location_draft(
  text, text, text, text, text, text, text, text
) to authenticated;
