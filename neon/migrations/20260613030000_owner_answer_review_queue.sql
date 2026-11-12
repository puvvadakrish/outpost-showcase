-- Owner answer review queue completion.
-- Adds retirement and refreshes existing draft/conflict manual-source proposals
-- instead of creating duplicate review rows for the same source/topic.

create or replace function edit_answer_bank_draft(
  p_tenant_id text,
  p_answer_bank_entry_id text,
  p_topic text,
  p_question text,
  p_answer text,
  p_note text default 'Owner edited draft answer through Outpost.'
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
  v_revision_intent answer_revision_intent;
  v_updated answer_bank_entries;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_answer_bank_entry_id := btrim(p_answer_bank_entry_id);
  p_topic := btrim(p_topic);
  p_question := btrim(p_question);
  p_answer := btrim(p_answer);
  p_note := coalesce(nullif(btrim(p_note), ''), 'Owner edited draft answer through Outpost.');

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_answer_bank_entry_id, '') is null then
    raise exception 'answer identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_topic, '') is null then
    raise exception 'answer topic is required'
      using errcode = '22023';
  end if;

  if nullif(p_question, '') is null then
    raise exception 'answer question is required'
      using errcode = '22023';
  end if;

  if nullif(p_answer, '') is null then
    raise exception 'answer text is required'
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
    raise exception 'only draft or conflict answers can be edited'
      using errcode = '22023';
  end if;

  v_revision_intent := case
    when v_existing.approval_status = 'conflict' then 'conflict_resolution'::answer_revision_intent
    else 'edit'::answer_revision_intent
  end;

  update answer_bank_entries
     set topic = p_topic,
         question = p_question,
         answer = p_answer,
         approval_status = 'draft',
         approved_by_user_id = null,
         approved_at = null,
         retired_at = null,
         owner_action = 'edit',
         runtime_behavior = 'needs_owner_review',
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
    v_revision_intent,
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
    case
      when v_revision_intent = 'conflict_resolution' then 'answer_bank_entry.conflict_resolved'
      else 'answer_bank_entry.draft_edited'
    end,
    jsonb_build_object(
      'previous_status', v_existing.approval_status,
      'next_status', v_updated.approval_status,
      'revision_id', v_revision_id
    )
  );

  return v_updated;
end;
$$;

create or replace function retire_answer_bank_entry(
  p_tenant_id text,
  p_answer_bank_entry_id text,
  p_note text default 'Owner retired answer through Outpost.'
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
  p_note := coalesce(nullif(btrim(p_note), ''), 'Owner retired answer through Outpost.');

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
    raise exception 'only draft or conflict answers can be retired in owner review'
      using errcode = '22023';
  end if;

  update answer_bank_entries
     set approval_status = 'retired',
         approved_by_user_id = null,
         approved_at = null,
         retired_at = now(),
         owner_action = 'retire',
         runtime_behavior = 'blocked_until_resolved',
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
    'retirement',
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
    'answer_bank_entry.retired',
    jsonb_build_object(
      'previous_status', v_existing.approval_status,
      'next_status', v_updated.approval_status,
      'revision_id', v_revision_id
    )
  );

  return v_updated;
end;
$$;

revoke execute on function retire_answer_bank_entry(text, text, text) from public, anonymous;
grant execute on function retire_answer_bank_entry(text, text, text) to authenticated;

create or replace function propose_answers_from_manual_source(
  p_tenant_id text,
  p_source_document_id text,
  p_note text default 'Staged from manual source facts for owner review.'
)
returns table (
  proposed_count integer,
  conflict_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_answer_id text;
  v_conflict_count integer := 0;
  v_entry answer_bank_entries;
  v_existing_proposal answer_bank_entries;
  v_fact source_facts;
  v_proposed_count integer := 0;
  v_revision_id text;
  v_revision_intent answer_revision_intent;
  v_runtime_behavior answer_runtime_behavior;
  v_source_document source_documents;
  v_status answer_approval_status;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_source_document_id := btrim(p_source_document_id);
  p_note := coalesce(nullif(btrim(p_note), ''), 'Staged from manual source facts for owner review.');

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_source_document_id, '') is null then
    raise exception 'source document identifier is required'
      using errcode = '22023';
  end if;

  if not is_active_tenant_owner(p_tenant_id) then
    raise exception 'owner membership required for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  select current_app_user_id() into v_actor_user_id;

  if v_actor_user_id is null then
    raise exception 'authenticated application user is required'
      using errcode = '42501';
  end if;

  select *
    into v_source_document
    from source_documents
    where tenant_id = p_tenant_id
      and id = p_source_document_id
      and source_type = 'manual'
    for update;

  if not found then
    raise exception 'manual source document not found'
      using errcode = 'P0002';
  end if;

  for v_fact in
    select *
      from source_facts
      where tenant_id = p_tenant_id
        and source_document_id = p_source_document_id
        and review_status = 'proposed'
        and proposed_answer_entry_id is null
      order by created_at, id
      for update
  loop
    v_revision_id := gen_random_uuid()::text;
    v_status := case
      when v_fact.conflict_group is not null then 'conflict'::answer_approval_status
      else 'draft'::answer_approval_status
    end;
    v_runtime_behavior := case
      when v_fact.conflict_group is not null then 'blocked_until_resolved'::answer_runtime_behavior
      else 'needs_owner_review'::answer_runtime_behavior
    end;

    select *
      into v_existing_proposal
      from answer_bank_entries
      where tenant_id = p_tenant_id
        and source_document_id = p_source_document_id
        and approval_status in ('draft', 'conflict')
        and lower(btrim(topic)) = lower(btrim(v_fact.topic))
      order by updated_at desc, id desc
      limit 1
      for update;

    if found then
      v_revision_intent := case
        when v_existing_proposal.approval_status = 'conflict' and v_status = 'draft'
          then 'conflict_resolution'::answer_revision_intent
        else 'import_proposal'::answer_revision_intent
      end;

      update answer_bank_entries
         set topic = v_fact.topic,
             question = 'What should staff say about ' || v_fact.topic || '?',
             answer = v_fact.value,
             approval_status = v_status,
             approved_by_user_id = null,
             approved_at = null,
             retired_at = null,
             owner_action = 'edit',
             runtime_behavior = v_runtime_behavior,
             review_note = p_note,
             updated_at = now()
       where tenant_id = p_tenant_id
         and id = v_existing_proposal.id
       returning * into v_entry;
    else
      v_answer_id := 'answer_proposal_' || replace(gen_random_uuid()::text, '-', '');
      v_revision_intent := 'import_proposal'::answer_revision_intent;

      insert into answer_bank_entries (
        id,
        tenant_id,
        location_id,
        topic,
        question,
        answer,
        approval_status,
        source_document_id,
        source_label,
        owner_action,
        runtime_behavior,
        review_note,
        updated_at
      ) values (
        v_answer_id,
        p_tenant_id,
        coalesce(v_fact.location_id, v_source_document.location_id),
        v_fact.topic,
        'What should staff say about ' || v_fact.topic || '?',
        v_fact.value,
        v_status,
        v_source_document.id,
        v_source_document.label,
        'edit',
        v_runtime_behavior,
        p_note,
        now()
      )
      returning * into v_entry;
    end if;

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
      v_entry.location_id,
      v_entry.id,
      v_actor_user_id,
      v_revision_intent,
      v_existing_proposal.approval_status,
      v_entry.approval_status,
      v_source_document.id,
      v_source_document.label,
      p_note
    );

    update source_facts
       set proposed_answer_entry_id = v_entry.id,
           review_status = case
             when v_fact.conflict_group is not null then 'conflict'::source_fact_status
             else 'needs_review'::source_fact_status
           end
     where tenant_id = p_tenant_id
       and id = v_fact.id;

    v_proposed_count := v_proposed_count + 1;

    if v_entry.approval_status = 'conflict' then
      v_conflict_count := v_conflict_count + 1;
    end if;

    v_existing_proposal := null;
  end loop;

  if v_proposed_count = 0 then
    raise exception 'no proposed manual source facts are available'
      using errcode = 'P0002';
  end if;

  update source_documents
     set status = case
           when v_conflict_count > 0 then 'conflict'::source_document_status
           else 'needs_review'::source_document_status
         end,
         updated_at = now()
   where tenant_id = p_tenant_id
     and id = p_source_document_id;

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
    'source_document',
    p_source_document_id,
    'source_document.answer_proposals_staged',
    jsonb_build_object(
      'source_type', 'manual',
      'proposed_count', v_proposed_count,
      'conflict_count', v_conflict_count
    )
  );

  proposed_count := v_proposed_count;
  conflict_count := v_conflict_count;
  return next;
end;
$$;
