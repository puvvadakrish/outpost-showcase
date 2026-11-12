-- Manual source intake for existing tenants and locations.
-- This does not scrape websites, import Google data, approve answers, create
-- tasks, send notifications, or enable provider ingress.

revoke all on source_documents, source_facts from anonymous, authenticated;
grant select on source_documents, source_facts to authenticated;

create or replace function upsert_manual_source_document(
  p_tenant_id text,
  p_location_id text,
  p_source_document_id text,
  p_label text,
  p_facts jsonb default '[]'::jsonb
)
returns source_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_conflicts_found integer := 0;
  v_fact jsonb;
  v_fact_confidence numeric;
  v_fact_conflict_group text;
  v_fact_id text;
  v_fact_topic text;
  v_fact_value text;
  v_facts_found integer := 0;
  v_source_document source_documents;
  v_source_document_id text;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_location_id := btrim(p_location_id);
  p_source_document_id := nullif(btrim(coalesce(p_source_document_id, '')), '');
  p_label := btrim(p_label);
  p_facts := coalesce(p_facts, '[]'::jsonb);

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_location_id, '') is null then
    raise exception 'location identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_label, '') is null then
    raise exception 'source label is required'
      using errcode = '22023';
  end if;

  if length(p_label) > 160 then
    raise exception 'source label is too long'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_facts) <> 'array' then
    raise exception 'source facts must be a JSON array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_facts) > 20 then
    raise exception 'manual source intake accepts 20 facts or fewer'
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
      and id = p_location_id
    for update;

  if not found then
    raise exception 'location not found'
      using errcode = 'P0002';
  end if;

  if p_source_document_id is not null then
    perform 1
      from source_documents
      where id = p_source_document_id
        and tenant_id <> p_tenant_id;

    if found then
      raise exception 'manual source document not found for tenant location'
        using errcode = 'P0002';
    end if;

    perform 1
      from source_documents
      where tenant_id = p_tenant_id
        and id = p_source_document_id
      for update;

    if found then
      perform 1
        from source_documents
        where tenant_id = p_tenant_id
          and id = p_source_document_id
          and location_id = p_location_id
          and source_type = 'manual';

      if not found then
        raise exception 'manual source document not found for tenant location'
          using errcode = 'P0002';
      end if;
    end if;
  end if;

  for v_fact in select value from jsonb_array_elements(p_facts)
  loop
    if jsonb_typeof(v_fact) <> 'object' then
      raise exception 'source fact must be a JSON object'
        using errcode = '22023';
    end if;

    v_fact_topic := btrim(coalesce(v_fact->>'topic', ''));
    v_fact_value := btrim(coalesce(v_fact->>'value', ''));
    v_fact_confidence := nullif(v_fact->>'confidence', '')::numeric;
    v_fact_conflict_group := nullif(btrim(coalesce(v_fact->>'conflictGroup', '')), '');

    if nullif(v_fact_topic, '') is null then
      raise exception 'source fact topic is required'
        using errcode = '22023';
    end if;

    if nullif(v_fact_value, '') is null then
      raise exception 'source fact value is required'
        using errcode = '22023';
    end if;

    if v_fact_confidence is null or v_fact_confidence < 0 or v_fact_confidence > 1 then
      raise exception 'source fact confidence must be between 0 and 1'
        using errcode = '22023';
    end if;

    if length(v_fact_topic) > 120 then
      raise exception 'source fact topic is too long'
        using errcode = '22023';
    end if;

    if length(v_fact_value) > 1200 then
      raise exception 'source fact value is too long'
        using errcode = '22023';
    end if;

    if v_fact_conflict_group is not null and length(v_fact_conflict_group) > 160 then
      raise exception 'source fact conflict group is too long'
        using errcode = '22023';
    end if;
  end loop;

  v_source_document_id := coalesce(
    p_source_document_id,
    'source_manual_' || replace(gen_random_uuid()::text, '-', '')
  );
  v_facts_found := jsonb_array_length(p_facts);

  for v_fact in select value from jsonb_array_elements(p_facts)
  loop
    if nullif(btrim(coalesce(v_fact->>'conflictGroup', '')), '') is not null then
      v_conflicts_found := v_conflicts_found + 1;
    end if;
  end loop;

  insert into source_documents (
    id,
    tenant_id,
    location_id,
    source_type,
    label,
    status,
    facts_found,
    conflicts_found,
    last_checked_at,
    updated_at
  ) values (
    v_source_document_id,
    p_tenant_id,
    p_location_id,
    'manual',
    p_label,
    case when v_facts_found > 0 then 'needs_review'::source_document_status else 'missing'::source_document_status end,
    v_facts_found,
    v_conflicts_found,
    now(),
    now()
  )
  on conflict (id) do update set
    label = excluded.label,
    status = excluded.status,
    facts_found = excluded.facts_found,
    conflicts_found = excluded.conflicts_found,
    last_checked_at = excluded.last_checked_at,
    updated_at = excluded.updated_at
    where source_documents.tenant_id = excluded.tenant_id
      and source_documents.location_id = excluded.location_id
      and source_documents.source_type = 'manual'
  returning * into v_source_document;

  if v_source_document.id is null then
    raise exception 'manual source document not found for tenant location'
      using errcode = 'P0002';
  end if;

  delete from source_facts
  where tenant_id = p_tenant_id
    and source_document_id = v_source_document_id;

  for v_fact in select value from jsonb_array_elements(p_facts)
  loop
    v_fact_id := 'fact_' || replace(gen_random_uuid()::text, '-', '');

    insert into source_facts (
      id,
      tenant_id,
      location_id,
      source_document_id,
      topic,
      value,
      confidence,
      conflict_group,
      review_status
    ) values (
      v_fact_id,
      p_tenant_id,
      p_location_id,
      v_source_document_id,
      btrim(v_fact->>'topic'),
      btrim(v_fact->>'value'),
      (v_fact->>'confidence')::numeric,
      nullif(btrim(coalesce(v_fact->>'conflictGroup', '')), ''),
      'proposed'
    );
  end loop;

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
    v_source_document_id,
    'source_document.manual_intake_upserted',
    jsonb_build_object(
      'location_id', p_location_id,
      'source_type', 'manual',
      'facts_found', v_facts_found,
      'conflicts_found', v_conflicts_found,
      'fact_count', v_facts_found
    )
  );

  return v_source_document;
end;
$$;

revoke execute on function upsert_manual_source_document(text, text, text, text, jsonb)
  from public, anonymous;
grant execute on function upsert_manual_source_document(text, text, text, text, jsonb)
  to authenticated;
