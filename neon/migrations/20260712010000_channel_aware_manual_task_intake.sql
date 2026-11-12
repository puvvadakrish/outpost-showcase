-- Channel-aware human-entered intake through the existing atomic manual task RPC.
-- The created event remains manual provenance; channel records the request medium.

create or replace function create_manual_task(
  p_tenant_id text,
  p_location_id text,
  p_requester_name text,
  p_requester_contact text,
  p_intent text,
  p_summary text,
  p_suggested_next_step text,
  p_confidence numeric,
  p_channel text
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel task_channel;
  v_created tasks;
begin
  p_channel := btrim(p_channel);

  if nullif(p_channel, '') is null then
    raise exception 'task channel is required' using errcode = '22023';
  end if;

  begin
    v_channel := p_channel::task_channel;
  exception
    when invalid_text_representation then
      raise exception 'task channel is invalid' using errcode = '22023';
  end;

  -- The product task boundary intentionally excludes social intake in v1.
  if v_channel not in ('phone', 'email', 'manual') then
    raise exception 'task channel is invalid' using errcode = '22023';
  end if;

  v_created := create_manual_task(
    p_tenant_id,
    p_location_id,
    p_requester_name,
    p_requester_contact,
    p_intent,
    p_summary,
    p_suggested_next_step,
    p_confidence
  );

  update tasks
  set channel = v_channel
  where tenant_id = v_created.tenant_id
    and id = v_created.id
  returning * into v_created;

  update audit_events
  set metadata = jsonb_set(metadata, '{channel}', to_jsonb(v_channel::text), true)
  where tenant_id = v_created.tenant_id
    and subject_type = 'task'
    and subject_id = v_created.id
    and action = 'task.created';

  return v_created;
end;
$$;

revoke execute on function create_manual_task(text, text, text, text, text, text, text, numeric, text)
  from public, anonymous;
grant execute on function create_manual_task(text, text, text, text, text, text, text, numeric, text)
  to authenticated;
