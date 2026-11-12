-- Staff task assignment and note persistence for existing tasks.
-- This does not create provider-ingested tasks, send notifications, compute
-- billing, or enable live phone/email behavior.

create or replace function assign_task(
  p_tenant_id text,
  p_location_id text,
  p_task_id text,
  p_assignee_user_id text default null,
  p_note text default 'Task assignment changed through Outpost staff workboard.'
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_assignee_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_existing tasks;
  v_task_event_id text := gen_random_uuid()::text;
  v_updated tasks;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_location_id := btrim(p_location_id);
  p_task_id := btrim(p_task_id);
  v_assignee_user_id := nullif(btrim(coalesce(p_assignee_user_id, '')), '');
  p_note := coalesce(nullif(btrim(p_note), ''), 'Task assignment changed through Outpost staff workboard.');

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

  if length(p_note) > 1200 then
    raise exception 'assignment note is too long'
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

  if v_assignee_user_id is not null then
    perform 1
      from tenant_memberships
      where tenant_id = p_tenant_id
        and user_id = v_assignee_user_id
        and invite_status = 'active';

    if not found then
      raise exception 'assignee must be an active member of tenant %', p_tenant_id
        using errcode = '42501';
    end if;
  end if;

  if v_existing.assignee_user_id is not distinct from v_assignee_user_id then
    return v_existing;
  end if;

  update tasks
     set assignee_user_id = v_assignee_user_id,
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
    note
  ) values (
    v_task_event_id,
    p_tenant_id,
    p_location_id,
    p_task_id,
    v_actor_user_id,
    'assigned',
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
    'task',
    p_task_id,
    'task.assigned',
    jsonb_build_object(
      'location_id', p_location_id,
      'previous_assignee_user_id', v_existing.assignee_user_id,
      'next_assignee_user_id', v_updated.assignee_user_id,
      'task_event_id', v_task_event_id
    )
  );

  return v_updated;
end;
$$;

create or replace function add_task_note(
  p_tenant_id text,
  p_location_id text,
  p_task_id text,
  p_note text
)
returns task_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_existing tasks;
  v_task_event task_events;
  v_task_event_id text := gen_random_uuid()::text;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_location_id := btrim(p_location_id);
  p_task_id := btrim(p_task_id);
  p_note := btrim(p_note);

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

  if nullif(p_note, '') is null then
    raise exception 'task note is required'
      using errcode = '22023';
  end if;

  if length(p_note) > 1200 then
    raise exception 'task note is too long'
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

  update tasks
     set updated_at = now()
   where tenant_id = p_tenant_id
     and location_id = p_location_id
     and id = p_task_id;

  insert into task_events (
    id,
    tenant_id,
    location_id,
    task_id,
    actor_user_id,
    event_type,
    note
  ) values (
    v_task_event_id,
    p_tenant_id,
    p_location_id,
    p_task_id,
    v_actor_user_id,
    'note_added',
    p_note
  )
  returning * into v_task_event;

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
    'task.note_added',
    jsonb_build_object(
      'location_id', p_location_id,
      'task_event_id', v_task_event_id
    )
  );

  return v_task_event;
end;
$$;

create or replace function list_active_tenant_members(
  p_tenant_id text
)
returns table (
  id text,
  email citext,
  name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  p_tenant_id := btrim(p_tenant_id);

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if not is_active_tenant_member(p_tenant_id) then
    raise exception 'active tenant membership required for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  return query
    select users.id, users.email, users.name, users.created_at
      from tenant_memberships memberships
      join users on users.id = memberships.user_id
     where memberships.tenant_id = p_tenant_id
       and memberships.invite_status = 'active'
     order by users.name asc, users.id asc;
end;
$$;

revoke execute on function assign_task(text, text, text, text, text)
  from public, anonymous;
grant execute on function assign_task(text, text, text, text, text)
  to authenticated;

revoke execute on function add_task_note(text, text, text, text)
  from public, anonymous;
grant execute on function add_task_note(text, text, text, text)
  to authenticated;

revoke execute on function list_active_tenant_members(text)
  from public, anonymous;
grant execute on function list_active_tenant_members(text)
  to authenticated;
