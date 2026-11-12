-- Owner answer-review task creation for existing answer-bank rows.
-- This does not ingest provider traffic, send notifications, compute billing,
-- approve answers, or enable live phone/email behavior.

create or replace function create_task_from_answer_bank_entry(
  p_tenant_id text,
  p_answer_bank_entry_id text
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_answer answer_bank_entries;
  v_audit_event_id text := gen_random_uuid()::text;
  v_created tasks;
  v_existing_open_task tasks;
  v_location_id text;
  v_task_event_id text := gen_random_uuid()::text;
  v_task_id text := 'task_' || replace(gen_random_uuid()::text, '-', '');
  v_usage_event_id text := gen_random_uuid()::text;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_answer_bank_entry_id := btrim(p_answer_bank_entry_id);

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_answer_bank_entry_id, '') is null then
    raise exception 'answer identifier is required'
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
    into v_answer
    from answer_bank_entries
    where tenant_id = p_tenant_id
      and id = p_answer_bank_entry_id
    for update;

  if not found then
    raise exception 'answer not found'
      using errcode = 'P0002';
  end if;

  if v_answer.approval_status in ('approved', 'retired') then
    raise exception 'only draft, conflict, or routed answers can create staff tasks'
      using errcode = '22023';
  end if;

  if v_answer.runtime_behavior = 'answer_live' then
    raise exception 'live-answer rows cannot create staff tasks'
      using errcode = '22023';
  end if;

  v_location_id := v_answer.location_id;

  if v_location_id is null then
    select location_id
      into v_location_id
      from source_documents
      where tenant_id = p_tenant_id
        and id = v_answer.source_document_id;
  end if;

  if v_location_id is null then
    select id
      into v_location_id
      from locations
      where tenant_id = p_tenant_id
      order by created_at asc
      limit 1;
  end if;

  if v_location_id is null then
    raise exception 'answer has no tenant location for task creation'
      using errcode = 'P0002';
  end if;

  select t.*
    into v_existing_open_task
    from audit_events ae
    join tasks t
      on t.tenant_id = ae.tenant_id
     and t.id = ae.subject_id
     and t.status in ('new', 'needs_human', 'in_progress')
    where ae.tenant_id = p_tenant_id
      and ae.subject_type = 'task'
      and ae.action = 'task.created_from_answer'
      and ae.metadata->>'answer_bank_entry_id' = v_answer.id
    order by t.created_at asc
    limit 1;

  if found then
    return v_existing_open_task;
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
    v_location_id,
    'manual',
    'Owner review',
    left(coalesce(v_answer.source_label, v_answer.source_document_id, 'answer bank'), 200),
    left('Answer follow-up: ' || v_answer.topic, 120),
    left(
      'Owner requested staff follow-up for answer "' || v_answer.question ||
      '". Current draft: ' || v_answer.answer,
      1200
    ),
    0.9,
    left(
      coalesce(nullif(v_answer.review_note, ''), 'Review this answer-bank item with staff before live use.'),
      800
    ),
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
    v_location_id,
    v_created.id,
    v_actor_user_id,
    'created',
    'new',
    'Task created from owner answer-bank review item ' || v_answer.id || '.'
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
    v_location_id,
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
    'task.created_from_answer',
    jsonb_build_object(
      'location_id', v_location_id,
      'answer_bank_entry_id', v_answer.id,
      'answer_topic', v_answer.topic,
      'answer_status', v_answer.approval_status,
      'runtime_behavior', v_answer.runtime_behavior,
      'task_event_id', v_task_event_id,
      'usage_event_id', v_usage_event_id
    )
  );

  return v_created;
end;
$$;

revoke execute on function create_task_from_answer_bank_entry(text, text)
  from public, anonymous;
grant execute on function create_task_from_answer_bank_entry(text, text)
  to authenticated;
