-- Optional current-actor ownership composed atomically with human-entered intake.
-- The client submits only intent; authenticated application identity remains authoritative.

create or replace function create_manual_task(
  p_tenant_id text,
  p_location_id text,
  p_requester_name text,
  p_requester_contact text,
  p_intent text,
  p_summary text,
  p_suggested_next_step text,
  p_confidence numeric,
  p_channel text,
  p_claim_for_actor boolean
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_created tasks;
begin
  v_created := create_manual_task(
    p_tenant_id,
    p_location_id,
    p_requester_name,
    p_requester_contact,
    p_intent,
    p_summary,
    p_suggested_next_step,
    p_confidence,
    p_channel
  );

  if coalesce(p_claim_for_actor, false) then
    select current_app_user_id() into v_actor_user_id;
    if v_actor_user_id is null then
      raise exception 'authenticated application user is required' using errcode = '42501';
    end if;

    v_created := assign_task(
      v_created.tenant_id,
      v_created.location_id,
      v_created.id,
      v_actor_user_id,
      'Task claimed during human-entered intake.'
    );
  end if;

  return v_created;
end;
$$;

revoke execute on function create_manual_task(text, text, text, text, text, text, text, numeric, text, boolean)
  from public, anonymous;
grant execute on function create_manual_task(text, text, text, text, text, text, text, numeric, text, boolean)
  to authenticated;
