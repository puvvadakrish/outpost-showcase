-- Staff task status persistence for existing seeded tasks only.
-- This does not create tasks, send notifications, or enable provider ingress.

revoke all on tasks, task_events from anonymous, authenticated;
grant select on tasks, task_events to authenticated;

create or replace function update_task_status(
  p_tenant_id text,
  p_location_id text,
  p_task_id text,
  p_to_status text
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_existing tasks;
  v_next_status task_status;
  v_task_event_id text := gen_random_uuid()::text;
  v_updated tasks;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_location_id := btrim(p_location_id);
  p_task_id := btrim(p_task_id);
  p_to_status := btrim(p_to_status);

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_location_id, '') is null then
    raise exception 'location identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_task_id, '') is null then
    raise exception 'task identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_to_status, '') is null then
    raise exception 'task status is required'
      using errcode = '22023';
  end if;

  if not is_active_tenant_member(p_tenant_id) then
    raise exception 'active tenant membership required for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  v_next_status := p_to_status::task_status;

  select current_app_user_id() into v_actor_user_id;

  if v_actor_user_id is null then
    raise exception 'authenticated application user is required'
      using errcode = '42501';
  end if;

  select *
    into v_existing
    from tasks
    where tenant_id = p_tenant_id
      and location_id = p_location_id
      and id = p_task_id
    for update;

  if not found then
    raise exception 'task not found'
      using errcode = 'P0002';
  end if;

  if v_existing.status = v_next_status then
    return v_existing;
  end if;

  if not (
    (v_existing.status = 'new' and v_next_status in ('in_progress', 'needs_human', 'done', 'ignored')) or
    (v_existing.status = 'needs_human' and v_next_status in ('in_progress', 'done', 'ignored')) or
    (v_existing.status = 'in_progress' and v_next_status in ('done', 'needs_human', 'ignored'))
  ) then
    raise exception 'task status transition is not allowed'
      using errcode = '22023';
  end if;

  update tasks
     set status = v_next_status,
         updated_at = now()
   where tenant_id = p_tenant_id
     and location_id = p_location_id
     and id = p_task_id
   returning * into v_updated;

  insert into task_events (
    id,
    tenant_id,
    location_id,
    task_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    note
  ) values (
    v_task_event_id,
    p_tenant_id,
    p_location_id,
    p_task_id,
    v_actor_user_id,
    'status_changed',
    v_existing.status,
    v_updated.status,
    'Status changed through backend-backed staff task persistence.'
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
    p_task_id,
    'task.status_changed',
    jsonb_build_object(
      'location_id', p_location_id,
      'previous_status', v_existing.status,
      'next_status', v_updated.status,
      'task_event_id', v_task_event_id
    )
  );

  return v_updated;
end;
$$;

revoke execute on function update_task_status(text, text, text, text)
  from public, anonymous;
grant execute on function update_task_status(text, text, text, text)
  to authenticated;
