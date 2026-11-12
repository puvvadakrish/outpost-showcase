-- Manual staff task creation for existing tenants and locations.
-- This does not ingest sources, send notifications, or enable provider ingress.

revoke all on tasks, task_events, usage_events from anonymous, authenticated;
grant select on tasks, task_events, usage_events to authenticated;

create or replace function create_manual_task(
  p_tenant_id text,
  p_location_id text,
  p_requester_name text,
  p_requester_contact text,
  p_intent text,
  p_summary text,
  p_suggested_next_step text,
  p_confidence numeric default 0.9
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_created tasks;
  v_task_event_id text := gen_random_uuid()::text;
  v_task_id text := 'task_' || replace(gen_random_uuid()::text, '-', '');
  v_usage_event_id text := gen_random_uuid()::text;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_location_id := btrim(p_location_id);
  p_requester_name := btrim(p_requester_name);
  p_requester_contact := btrim(p_requester_contact);
  p_intent := btrim(p_intent);
  p_summary := btrim(p_summary);
  p_suggested_next_step := btrim(p_suggested_next_step);

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_location_id, '') is null then
    raise exception 'location identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_requester_name, '') is null then
    raise exception 'requester name is required'
      using errcode = '22023';
  end if;

  if nullif(p_requester_contact, '') is null then
    raise exception 'requester contact is required'
      using errcode = '22023';
  end if;

  if nullif(p_intent, '') is null then
    raise exception 'task intent is required'
      using errcode = '22023';
  end if;

  if nullif(p_summary, '') is null then
    raise exception 'task summary is required'
      using errcode = '22023';
  end if;

  if nullif(p_suggested_next_step, '') is null then
    raise exception 'suggested next step is required'
      using errcode = '22023';
  end if;

  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then
    raise exception 'task confidence must be between 0 and 1'
      using errcode = '22023';
  end if;

  if length(p_requester_name) > 160 then
    raise exception 'requester name is too long'
      using errcode = '22023';
  end if;

  if length(p_requester_contact) > 200 then
    raise exception 'requester contact is too long'
      using errcode = '22023';
  end if;

  if length(p_intent) > 120 then
    raise exception 'task intent is too long'
      using errcode = '22023';
  end if;

  if length(p_summary) > 1200 then
    raise exception 'task summary is too long'
      using errcode = '22023';
  end if;

  if length(p_suggested_next_step) > 800 then
    raise exception 'suggested next step is too long'
      using errcode = '22023';
  end if;

  if not is_active_tenant_member(p_tenant_id) then
    raise exception 'active tenant membership required for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  select current_app_user_id() into v_actor_user_id;

  if v_actor_user_id is null then
    raise exception 'authenticated application user is required'
      using errcode = '42501';
  end if;

  perform 1
    from locations
    where tenant_id = p_tenant_id
      and id = p_location_id;

  if not found then
    raise exception 'location not found'
      using errcode = 'P0002';
  end if;

  insert into tasks (
    id,
    tenant_id,
    location_id,
    channel,
    requester_name,
    requester_contact,
    intent,
    summary,
    confidence,
    suggested_next_step,
    status
  ) values (
    v_task_id,
    p_tenant_id,
    p_location_id,
    'manual',
    p_requester_name,
    p_requester_contact,
    p_intent,
    p_summary,
    p_confidence,
    p_suggested_next_step,
    'new'
  )
  returning * into v_created;

  insert into task_events (
    id,
    tenant_id,
    location_id,
    task_id,
    actor_user_id,
    event_type,
    to_status,
    note
  ) values (
    v_task_event_id,
    p_tenant_id,
    p_location_id,
    v_created.id,
    v_actor_user_id,
    'created',
    'new',
    'Manual task created through Outpost staff workboard.'
  );

  insert into usage_events (
    id,
    tenant_id,
    location_id,
    meter,
    quantity,
    source_type,
    source_id,
    period_key
  ) values (
    v_usage_event_id,
    p_tenant_id,
    p_location_id,
    'task_created',
    1,
    'task',
    v_created.id,
    to_char(now() at time zone 'UTC', 'YYYY-MM')
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
    'task',
    v_created.id,
    'task.created',
    jsonb_build_object(
      'location_id', p_location_id,
      'channel', 'manual',
      'status', 'new',
      'task_event_id', v_task_event_id,
      'usage_event_id', v_usage_event_id
    )
  );

  return v_created;
end;
$$;

revoke execute on function create_manual_task(text, text, text, text, text, text, text, numeric)
  from public, anonymous;
grant execute on function create_manual_task(text, text, text, text, text, text, text, numeric)
  to authenticated;
