-- Link provider-normalized tasks to sanitized provider event provenance.
-- This does not store raw payloads, send replies, enable live providers,
-- compute billing, touch POS/access-control, or write member ledgers.

create or replace function persist_normalized_provider_event(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation jsonb := p_event -> 'conversation';
  v_channel_event jsonb := p_event -> 'channelEvent';
  v_task jsonb := p_event -> 'proposedTask';
  v_usage_event jsonb;
  v_tenant_id text := v_conversation ->> 'tenantId';
  v_location_id text := nullif(v_conversation ->> 'locationId', '');
  v_provider_connection_id text := nullif(v_conversation ->> 'providerConnectionId', '');
  v_conversation_id text := v_conversation ->> 'id';
  v_channel_event_id text := v_channel_event ->> 'id';
  v_channel channel := (v_conversation ->> 'channel')::channel;
  v_provider_channel channel;
  v_provider_location_id text;
  v_upserted_conversations integer := 0;
  v_upserted_channel_events integer := 0;
  v_inserted_tasks integer := 0;
  v_inserted_usage_events integer := 0;
  v_row_count integer := 0;
begin
  if v_tenant_id is null or v_tenant_id = '' then
    raise exception 'conversation.tenantId required';
  end if;

  if v_conversation_id is null or v_conversation_id = '' then
    raise exception 'conversation.id required';
  end if;

  if v_channel_event_id is null or v_channel_event_id = '' then
    raise exception 'channelEvent.id required';
  end if;

  if v_provider_connection_id is null then
    raise exception 'conversation.providerConnectionId required';
  end if;

  if v_channel_event ->> 'tenantId' <> v_tenant_id then
    raise exception 'channelEvent tenant mismatch';
  end if;

  if v_channel_event ->> 'conversationId' <> v_conversation_id then
    raise exception 'channelEvent conversation mismatch';
  end if;

  if v_channel_event ->> 'providerConnectionId' <> v_provider_connection_id then
    raise exception 'channelEvent provider connection mismatch';
  end if;

  if (v_channel_event ->> 'channel')::channel <> v_channel then
    raise exception 'channelEvent channel mismatch';
  end if;

  if (v_channel_event ? 'locationId') and nullif(v_channel_event ->> 'locationId', '') is distinct from v_location_id then
    raise exception 'channelEvent location mismatch';
  end if;

  select channel, location_id
    into v_provider_channel, v_provider_location_id
    from provider_connections
   where tenant_id = v_tenant_id
     and id = v_provider_connection_id;

  if not found then
    raise exception 'provider connection not found for tenant';
  end if;

  if v_provider_channel <> v_channel then
    raise exception 'provider connection channel mismatch';
  end if;

  if v_provider_location_id is not null and v_provider_location_id is distinct from v_location_id then
    raise exception 'provider connection location mismatch';
  end if;

  insert into conversations (
    id,
    tenant_id,
    location_id,
    provider_connection_id,
    channel,
    external_conversation_id,
    requester_label,
    status,
    started_at,
    last_event_at
  )
  values (
    v_conversation_id,
    v_tenant_id,
    v_location_id,
    v_provider_connection_id,
    v_channel,
    nullif(v_conversation ->> 'externalConversationId', ''),
    v_conversation ->> 'requesterLabel',
    (v_conversation ->> 'status')::conversation_status,
    (v_conversation ->> 'startedAt')::timestamptz,
    (v_conversation ->> 'lastEventAt')::timestamptz
  )
  on conflict (id) do update
    set last_event_at = greatest(conversations.last_event_at, excluded.last_event_at);
  get diagnostics v_upserted_conversations = row_count;

  insert into channel_events (
    id,
    tenant_id,
    location_id,
    provider_connection_id,
    conversation_id,
    channel,
    provider_event_id,
    event_type,
    payload_digest,
    payload_ref,
    processing_status,
    received_at
  )
  values (
    v_channel_event_id,
    v_tenant_id,
    v_location_id,
    v_provider_connection_id,
    v_conversation_id,
    v_channel,
    nullif(v_channel_event ->> 'providerEventId', ''),
    v_channel_event ->> 'eventType',
    nullif(v_channel_event ->> 'payloadDigest', ''),
    nullif(v_channel_event ->> 'payloadRef', ''),
    (v_channel_event ->> 'processingStatus')::channel_event_processing_status,
    (v_channel_event ->> 'receivedAt')::timestamptz
  )
  on conflict (id) do update
    set processing_status = excluded.processing_status,
        received_at = least(channel_events.received_at, excluded.received_at);
  get diagnostics v_upserted_channel_events = row_count;

  if v_task is not null and v_task <> 'null'::jsonb then
    if v_task ->> 'tenantId' <> v_tenant_id then
      raise exception 'task tenant mismatch';
    end if;

    if v_task ->> 'locationId' is distinct from v_location_id then
      raise exception 'task location mismatch';
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
      status,
      created_at,
      updated_at
    )
    values (
      v_task ->> 'id',
      v_tenant_id,
      v_location_id,
      (v_task ->> 'channel')::task_channel,
      v_task ->> 'requesterName',
      v_task ->> 'requesterContact',
      v_task ->> 'intent',
      v_task ->> 'summary',
      (v_task ->> 'confidence')::numeric,
      v_task ->> 'suggestedNextStep',
      (v_task ->> 'status')::task_status,
      (v_task ->> 'createdAt')::timestamptz,
      (v_task ->> 'updatedAt')::timestamptz
    )
    on conflict (id) do nothing;
    get diagnostics v_inserted_tasks = row_count;

    if v_inserted_tasks = 1 then
      insert into task_events (
        id,
        tenant_id,
        location_id,
        task_id,
        event_type,
        note,
        created_at
      )
      values (
        'task_event_source_' || (v_task ->> 'id'),
        v_tenant_id,
        v_location_id,
        v_task ->> 'id',
        'source_linked',
        concat(
          'Provider normalized source: ',
          v_channel_event ->> 'eventType',
          '; reference: ',
          coalesce(nullif(v_channel_event ->> 'payloadRef', ''), v_channel_event_id),
          '; live providers remain blocked.'
        ),
        (v_task ->> 'createdAt')::timestamptz
      )
      on conflict (id) do nothing;
    end if;
  end if;

  for v_usage_event in select * from jsonb_array_elements(coalesce(p_event -> 'usageEvents', '[]'::jsonb))
  loop
    if v_usage_event ->> 'tenantId' <> v_tenant_id then
      raise exception 'usage event tenant mismatch';
    end if;

    if (v_usage_event ? 'locationId') and nullif(v_usage_event ->> 'locationId', '') is distinct from v_location_id then
      raise exception 'usage event location mismatch';
    end if;

    insert into usage_events (
      id,
      tenant_id,
      location_id,
      meter,
      quantity,
      source_type,
      source_id,
      period_key,
      occurred_at
    )
    values (
      v_usage_event ->> 'id',
      v_tenant_id,
      nullif(v_usage_event ->> 'locationId', ''),
      (v_usage_event ->> 'meter')::usage_meter,
      (v_usage_event ->> 'quantity')::numeric,
      v_usage_event ->> 'sourceType',
      v_usage_event ->> 'sourceId',
      v_usage_event ->> 'periodKey',
      (v_usage_event ->> 'occurredAt')::timestamptz
    )
    on conflict (id) do nothing;
    get diagnostics v_row_count = row_count;
    v_inserted_usage_events := v_inserted_usage_events + v_row_count;
  end loop;

  return jsonb_build_object(
    'conversationId', v_conversation_id,
    'channelEventId', v_channel_event_id,
    'proposedTaskId', v_task ->> 'id',
    'usageEventCount', jsonb_array_length(coalesce(p_event -> 'usageEvents', '[]'::jsonb)),
    'upsertedConversations', v_upserted_conversations,
    'upsertedChannelEvents', v_upserted_channel_events,
    'insertedTasks', v_inserted_tasks,
    'insertedUsageEvents', v_inserted_usage_events
  );
end;
$$;

revoke all on function persist_normalized_provider_event(jsonb) from public, anonymous, authenticated;
