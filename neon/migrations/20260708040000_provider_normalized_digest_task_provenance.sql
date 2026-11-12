-- Add task provenance visibility to the founder-admin provider digest.
-- This is a read-only projection over sanitized normalized metadata and
-- source-linked task events. It does not expose raw provider payloads,
-- transcripts, requester contacts, secrets, live provider controls, delivery,
-- billing/POS, access-control, or member-ledger writes.

create or replace function list_founder_admin_provider_normalized_digest()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_app_admin_id text;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'authorized', false,
      'generated_at', now(),
      'rows', '[]'::jsonb
    );
  end if;

  select app_admins.id
    into v_app_admin_id
    from app_admins
    join users on users.id = app_admins.user_id
    where users.external_auth_id = auth.uid()
      and app_admins.status = 'active'
      and exists (
        select 1
          from tenant_memberships memberships
          where memberships.user_id = users.id
            and memberships.role = 'founder_admin'
            and memberships.invite_status = 'active'
      )
    limit 1;

  if v_app_admin_id is null then
    return jsonb_build_object(
      'authorized', false,
      'generated_at', now(),
      'rows', '[]'::jsonb
    );
  end if;

  return (
    with recent_events as (
      select
        events.id as channel_event_id,
        events.tenant_id,
        tenants.name as tenant_name,
        events.location_id,
        locations.name as location_name,
        events.provider_connection_id,
        provider_connections.provider_key,
        events.conversation_id,
        events.channel,
        events.provider_event_id,
        events.event_type,
        events.payload_digest,
        events.payload_ref,
        events.processing_status,
        events.received_at,
        source_task_events.id as source_linked_task_event_id,
        tasks.id as task_id,
        tasks.status as task_status,
        coalesce(
          array_agg(distinct usage_events.meter::text order by usage_events.meter::text)
            filter (where usage_events.id is not null),
          '{}'::text[]
        ) as usage_meters
      from channel_events events
      join tenants on tenants.id = events.tenant_id
      left join locations
        on locations.tenant_id = events.tenant_id
       and locations.id = events.location_id
      left join provider_connections
        on provider_connections.tenant_id = events.tenant_id
       and provider_connections.id = events.provider_connection_id
      left join lateral (
        select
          case
            when events.event_type = 'retell.call_ended'
              and events.provider_event_id like '%:call_ended'
            then 'task_retell_' || left(encode(digest(
              concat(
                events.tenant_id,
                ':',
                events.provider_connection_id,
                ':',
                regexp_replace(events.provider_event_id, ':call_ended$', ''),
                ':staff_follow_up'
              ),
              'sha256'
            ), 'hex'), 24)
            when events.event_type = 'resend.email_received'
              and events.provider_event_id like '%:email.received'
            then 'task_resend_' || left(encode(digest(
              concat(
                events.tenant_id,
                ':',
                events.provider_connection_id,
                ':',
                regexp_replace(events.provider_event_id, ':email\\.received$', ''),
                ':staff_follow_up'
              ),
              'sha256'
            ), 'hex'), 24)
            else null
          end as task_id
      ) expected_task on true
      left join usage_events task_usage_events
        on task_usage_events.tenant_id = events.tenant_id
       and task_usage_events.location_id is not distinct from events.location_id
       and task_usage_events.meter = 'task_created'::usage_meter
       and task_usage_events.source_type = 'task'
       and task_usage_events.source_id = expected_task.task_id
      left join tasks
        on tasks.tenant_id = events.tenant_id
       and tasks.location_id is not distinct from events.location_id
       and tasks.id = task_usage_events.source_id
       and tasks.channel = events.channel::task_channel
      left join task_events source_task_events
        on source_task_events.tenant_id = tasks.tenant_id
       and source_task_events.location_id = tasks.location_id
       and source_task_events.task_id = tasks.id
       and source_task_events.event_type = 'source_linked'
       and source_task_events.note = concat(
         'Provider normalized source: ',
         events.event_type,
         '; reference: ',
         coalesce(events.payload_ref, events.id),
         '; live providers remain blocked.'
       )
      left join usage_events
        on usage_events.tenant_id = events.tenant_id
       and (
         usage_events.source_id = events.id
         or usage_events.source_id = events.conversation_id
         or usage_events.source_id = tasks.id
       )
      where events.event_type in ('retell.call_ended', 'resend.email_received')
      group by
        events.id,
        tenants.name,
        locations.name,
        provider_connections.provider_key,
        source_task_events.id,
        tasks.id,
        tasks.status
      order by events.received_at desc, events.id desc
      limit 50
    )
    select jsonb_build_object(
      'authorized', true,
      'generated_at', now(),
      'rows', coalesce(jsonb_agg(jsonb_build_object(
        'channel_event_id', channel_event_id,
        'tenant_id', tenant_id,
        'tenant_name', tenant_name,
        'location_id', location_id,
        'location_name', location_name,
        'provider_connection_id', provider_connection_id,
        'provider_key', provider_key,
        'conversation_id', conversation_id,
        'channel', channel,
        'provider_event_id', provider_event_id,
        'event_type', event_type,
        'payload_digest', payload_digest,
        'payload_ref', payload_ref,
        'processing_status', processing_status,
        'received_at', received_at,
        'source_linked_task_event_id', source_linked_task_event_id,
        'task_id', task_id,
        'task_status', task_status,
        'usage_meters', usage_meters
      )), '[]'::jsonb)
    )
    from recent_events
  );
end;
$$;

revoke execute on function list_founder_admin_provider_normalized_digest() from public, anonymous;
grant execute on function list_founder_admin_provider_normalized_digest() to authenticated;
