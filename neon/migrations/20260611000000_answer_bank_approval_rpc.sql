-- Owner answer-bank approval persistence.
-- Keeps approval as a single PostgreSQL RPC transaction: current answer row,
-- revision evidence, and audit event are written together.

create or replace function approve_answer_bank_entry(
  p_tenant_id text,
  p_answer_bank_entry_id text,
  p_note text default 'Owner approved answer through Outpost.'
)
returns answer_bank_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_existing answer_bank_entries;
  v_revision_id text := gen_random_uuid()::text;
  v_updated answer_bank_entries;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_answer_bank_entry_id := btrim(p_answer_bank_entry_id);
  p_note := coalesce(nullif(btrim(p_note), ''), 'Owner approved answer through Outpost.');

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_answer_bank_entry_id, '') is null then
    raise exception 'answer identifier is required'
      using errcode = '22023';
  end if;

  if not is_active_tenant_owner(p_tenant_id) then
    raise exception 'owner membership required for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  select current_app_user_id() into v_actor_user_id;

  select *
    into v_existing
    from answer_bank_entries
    where tenant_id = p_tenant_id
      and id = p_answer_bank_entry_id
    for update;

  if not found then
    raise exception 'answer bank entry not found'
      using errcode = 'P0002';
  end if;

  if v_existing.approval_status not in ('draft', 'conflict') then
    raise exception 'only draft or conflict answers can be approved'
      using errcode = '22023';
  end if;

  update answer_bank_entries
     set approval_status = 'approved',
         approved_by_user_id = v_actor_user_id,
         approved_at = now(),
         retired_at = null,
         owner_action = 'approve',
         runtime_behavior = 'answer_live',
         review_note = p_note,
         updated_at = now()
   where tenant_id = p_tenant_id
     and id = p_answer_bank_entry_id
   returning * into v_updated;

  insert into answer_bank_revisions (
    id,
    tenant_id,
    location_id,
    answer_bank_entry_id,
    actor_user_id,
    revision_intent,
    previous_status,
    next_status,
    source_document_id,
    source_label,
    note
  ) values (
    v_revision_id,
    p_tenant_id,
    v_updated.location_id,
    v_updated.id,
    v_actor_user_id,
    'approval',
    v_existing.approval_status,
    v_updated.approval_status,
    v_updated.source_document_id,
    v_updated.source_label,
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
    'answer_bank_entry',
    v_updated.id,
    'answer_bank_entry.approved',
    jsonb_build_object(
      'previous_status', v_existing.approval_status,
      'next_status', v_updated.approval_status,
      'revision_id', v_revision_id
    )
  );

  return v_updated;
end;
$$;

revoke execute on function approve_answer_bank_entry(text, text, text) from public, anonymous;
grant execute on function approve_answer_bank_entry(text, text, text) to authenticated;
