-- Founder-admin read-only digest for persisted normalized provider rows.
-- This exposes sanitized normalized metadata only. Raw provider payloads,
-- transcripts, requester contacts, provider secrets, delivery controls,
-- billing/POS, access-control, and member-ledger writes remain unavailable.

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
        null::text as task_id,
        null::text as task_status,
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
      left join usage_events
        on usage_events.tenant_id = events.tenant_id
       and (
         usage_events.source_id = events.id
         or usage_events.source_id = events.conversation_id
       )
      where events.event_type in ('retell.call_ended', 'resend.email_received')
      group by
        events.id,
        tenants.name,
        locations.name,
        provider_connections.provider_key
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
