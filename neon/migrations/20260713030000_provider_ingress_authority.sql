-- Add a separately authorized, rehearsal-only provider ingress transaction.
-- No live provider state exists here. The browser has no access to ingress keys,
-- rehearsal mode, receipts, jobs, secrets, or the ingress capability.

alter table provider_connections
  add column ingress_key uuid not null default gen_random_uuid(),
  add column provider_ingress_mode text not null default 'blocked',
  add constraint provider_connections_ingress_key_unique unique (ingress_key),
  add constraint provider_connections_ingress_mode_shape
    check (provider_ingress_mode in ('blocked', 'rehearsal')),
  add constraint provider_connections_rehearsal_shape check (
    provider_ingress_mode <> 'rehearsal'
    or (
      status = 'disabled'
      and location_id is not null
      and secret_ref is not null
    )
  );

create table provider_ingress_receipts (
  id text primary key default ('provider_receipt_' || gen_random_uuid()::text),
  tenant_id text not null references tenants(id),
  location_id text not null,
  provider_connection_id text not null,
  provider_key text not null check (provider_key in ('retell', 'resend')),
  provider_event_id text not null,
  event_type text not null check (event_type in ('call_ended', 'email.received')),
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  sanitized_payload_digest text not null check (sanitized_payload_digest ~ '^[a-f0-9]{64}$'),
  accepted_pause_generation bigint not null check (accepted_pause_generation >= 0),
  job_id text not null references jobs(id),
  received_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (provider_connection_id, provider_event_id),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, provider_connection_id)
    references provider_connections(tenant_id, id),
  constraint provider_ingress_receipt_event_id_shape check (
    char_length(provider_event_id) between 1 and 200
    and provider_event_id !~ '[[:cntrl:]]'
  )
);

create index provider_ingress_receipts_tenant_created_idx
  on provider_ingress_receipts (tenant_id, created_at desc, id desc);

alter table provider_ingress_receipts enable row level security;
revoke all on provider_ingress_receipts from public, anonymous, authenticated;

create or replace function prevent_provider_ingress_receipt_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception 'provider ingress receipts are immutable'
    using errcode = '55000';
end;
$$;

create trigger provider_ingress_receipts_immutable
before update or delete on provider_ingress_receipts
for each row execute function prevent_provider_ingress_receipt_mutation();

create or replace function resolve_provider_ingress_connection(
  p_ingress_key text,
  p_provider_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_ingress_key uuid;
  v_connection record;
begin
  p_ingress_key := btrim(coalesce(p_ingress_key, ''));
  p_provider_key := lower(btrim(coalesce(p_provider_key, '')));

  begin
    v_ingress_key := p_ingress_key::uuid;
  exception when invalid_text_representation then
    raise exception 'provider ingress connection is unavailable' using errcode = '22023';
  end;

  if p_provider_key not in ('retell', 'resend') then
    raise exception 'provider ingress connection is unavailable' using errcode = '22023';
  end if;

  select connection.*,
         tenant.status as tenant_status,
         location.status as location_status
    into v_connection
    from public.provider_connections connection
    join public.tenants tenant on tenant.id = connection.tenant_id
    join public.locations location
      on location.tenant_id = connection.tenant_id
     and location.id = connection.location_id
   where connection.ingress_key = v_ingress_key
     and connection.provider_key = p_provider_key;

  if not found
     or v_connection.provider_ingress_mode <> 'rehearsal'
     or v_connection.status <> 'disabled'
     or v_connection.secret_ref is null
     or v_connection.tenant_status not in ('setup', 'active')
     or v_connection.location_status <> 'active'
     or (p_provider_key = 'retell' and v_connection.channel <> 'phone')
     or (p_provider_key = 'resend' and v_connection.channel <> 'email') then
    raise exception 'provider ingress connection is unavailable' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'tenantId', v_connection.tenant_id,
    'locationId', v_connection.location_id,
    'providerConnectionId', v_connection.id,
    'providerKey', v_connection.provider_key,
    'channel', v_connection.channel,
    'secretRef', v_connection.secret_ref
  );
end;
$$;

create or replace function accept_provider_ingress_event(
  p_ingress_key text,
  p_provider_key text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_digest text,
  p_sanitized_payload jsonb,
  p_received_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_ingress_key uuid;
  v_tenant_id text;
  v_connection public.provider_connections;
  v_tenant_status public.tenant_status;
  v_location_status public.location_status;
  v_control public.tenant_runtime_controls;
  v_existing public.provider_ingress_receipts;
  v_receipt public.provider_ingress_receipts;
  v_job public.jobs;
  v_job_kind text;
  v_sanitized_digest text;
  v_dedupe_key text;
  v_value jsonb;
begin
  p_ingress_key := btrim(coalesce(p_ingress_key, ''));
  p_provider_key := lower(btrim(coalesce(p_provider_key, '')));
  p_provider_event_id := btrim(coalesce(p_provider_event_id, ''));
  p_event_type := btrim(coalesce(p_event_type, ''));
  p_payload_digest := lower(btrim(coalesce(p_payload_digest, '')));
  p_sanitized_payload := coalesce(p_sanitized_payload, '{}'::jsonb);
  p_received_at := coalesce(p_received_at, now());

  begin
    v_ingress_key := p_ingress_key::uuid;
  exception when invalid_text_representation then
    raise exception 'provider ingress event is invalid' using errcode = '22023';
  end;

  if p_provider_key not in ('retell', 'resend')
     or char_length(p_provider_event_id) not between 1 and 200
     or p_provider_event_id ~ '[[:cntrl:]]'
     or p_payload_digest !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_sanitized_payload) <> 'object'
     or octet_length(p_sanitized_payload::text) > 4096
     or p_received_at < now() - interval '10 minutes'
     or p_received_at > now() + interval '1 minute' then
    raise exception 'provider ingress event is invalid' using errcode = '22023';
  end if;

  if p_provider_key = 'retell' then
    v_job_kind := 'provider.retell.call_ended.normalize';
    if p_event_type <> 'call_ended'
       or p_sanitized_payload ->> 'event' <> 'call_ended'
       or nullif(p_sanitized_payload ->> 'call_id', '') is null
       or nullif(p_sanitized_payload ->> 'agent_id', '') is null
       or char_length(p_sanitized_payload ->> 'call_id') > 200
       or char_length(p_sanitized_payload ->> 'agent_id') > 200
       or jsonb_typeof(p_sanitized_payload -> 'transcript_present') is distinct from 'boolean'
       or (
         p_sanitized_payload ? 'start_timestamp'
         and jsonb_typeof(p_sanitized_payload -> 'start_timestamp') not in ('number', 'null')
       )
       or (
         p_sanitized_payload ? 'end_timestamp'
         and jsonb_typeof(p_sanitized_payload -> 'end_timestamp') not in ('number', 'null')
       )
       or (
         p_sanitized_payload ? 'duration_ms'
         and jsonb_typeof(p_sanitized_payload -> 'duration_ms') not in ('number', 'null')
       )
       or (
         p_sanitized_payload ? 'caller_phone'
         and jsonb_typeof(p_sanitized_payload -> 'caller_phone') not in ('string', 'null')
       )
       or coalesce(p_sanitized_payload -> 'caller_name', 'null'::jsonb) <> 'null'::jsonb
       or coalesce(p_sanitized_payload -> 'call_summary', 'null'::jsonb) <> 'null'::jsonb
       or coalesce(p_sanitized_payload -> 'intent', 'null'::jsonb) <> 'null'::jsonb
       or coalesce(p_sanitized_payload -> 'recommended_next_step', 'null'::jsonb) <> 'null'::jsonb
       or coalesce(p_sanitized_payload -> 'confidence', 'null'::jsonb) <> 'null'::jsonb
       or p_sanitized_payload - array[
         'event', 'agent_id', 'call_id', 'start_timestamp', 'end_timestamp',
         'transcript_present', 'duration_ms', 'caller_phone', 'caller_name',
         'call_summary', 'intent', 'recommended_next_step', 'confidence'
       ] <> '{}'::jsonb then
      raise exception 'provider ingress event is invalid' using errcode = '22023';
    end if;
  else
    v_job_kind := 'provider.resend.email_received.normalize';
    if p_event_type <> 'email.received'
       or p_sanitized_payload ->> 'event' <> 'email.received'
       or nullif(p_sanitized_payload ->> 'message_id', '') is null
       or char_length(p_sanitized_payload ->> 'message_id') > 200
       or p_sanitized_payload -> 'body_available' is distinct from 'false'::jsonb
       or (
         p_sanitized_payload ? 'received_at'
         and jsonb_typeof(p_sanitized_payload -> 'received_at') not in ('string', 'null')
       )
       or (
         p_sanitized_payload ? 'from_email'
         and jsonb_typeof(p_sanitized_payload -> 'from_email') not in ('string', 'null')
       )
       or (
         p_sanitized_payload ? 'subject'
         and jsonb_typeof(p_sanitized_payload -> 'subject') not in ('string', 'null')
       )
       or (
         p_sanitized_payload ? 'mailbox_label'
         and jsonb_typeof(p_sanitized_payload -> 'mailbox_label') not in ('string', 'null')
       )
       or coalesce(p_sanitized_payload -> 'from_label', 'null'::jsonb) <> 'null'::jsonb
       or coalesce(p_sanitized_payload -> 'suggested_intent', 'null'::jsonb) <> 'null'::jsonb
       or coalesce(p_sanitized_payload -> 'suggested_next_step', 'null'::jsonb) <> 'null'::jsonb
       or coalesce(p_sanitized_payload -> 'confidence', 'null'::jsonb) <> 'null'::jsonb
       or p_sanitized_payload - array[
         'event', 'message_id', 'received_at', 'from_label', 'from_email',
         'subject', 'body_available', 'mailbox_label', 'suggested_intent',
         'suggested_next_step', 'confidence'
       ] <> '{}'::jsonb then
      raise exception 'provider ingress event is invalid' using errcode = '22023';
    end if;
  end if;

  for v_value in select value from jsonb_each(p_sanitized_payload)
  loop
    if jsonb_typeof(v_value) not in ('string', 'number', 'boolean', 'null')
       or (jsonb_typeof(v_value) = 'string' and char_length(v_value #>> '{}') > 320) then
      raise exception 'provider ingress event is invalid' using errcode = '22023';
    end if;
  end loop;

  v_sanitized_digest := encode(public.digest(p_sanitized_payload::text, 'sha256'), 'hex');

  select tenant_id
    into v_tenant_id
    from public.provider_connections
   where ingress_key = v_ingress_key
     and provider_key = p_provider_key;

  if not found then
    raise exception 'provider ingress connection is unavailable' using errcode = '55000';
  end if;

  -- Match the runtime lock order: tenant, control, provider connection, then
  -- receipt/job. A concurrent stop therefore linearizes before or after accept.
  select status into v_tenant_status
    from public.tenants
   where id = v_tenant_id
   for share;

  select * into v_control
    from public.tenant_runtime_controls
   where tenant_id = v_tenant_id
   for share;

  select * into v_connection
    from public.provider_connections
   where ingress_key = v_ingress_key
     and provider_key = p_provider_key
     and tenant_id = v_tenant_id
   for share;

  if not found then
    raise exception 'provider ingress connection is unavailable' using errcode = '55000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'outpost:provider-ingress:' || v_connection.id || ':' || p_provider_event_id,
    0
  ));

  select * into v_existing
    from public.provider_ingress_receipts
   where provider_connection_id = v_connection.id
     and provider_event_id = p_provider_event_id;

  if found then
    if v_existing.provider_key <> p_provider_key
       or v_existing.event_type <> p_event_type
       or v_existing.payload_digest <> p_payload_digest
       or v_existing.sanitized_payload_digest <> v_sanitized_digest then
      raise exception 'provider event id conflicts with different ingress payload'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'receiptId', v_existing.id,
      'jobId', v_existing.job_id,
      'pauseGeneration', v_existing.accepted_pause_generation,
      'replayed', true
    );
  end if;

  select status into v_location_status
    from public.locations
   where tenant_id = v_connection.tenant_id
     and id = v_connection.location_id;

  if v_connection.provider_ingress_mode <> 'rehearsal'
     or v_connection.status <> 'disabled'
     or v_connection.secret_ref is null
     or v_tenant_status not in ('setup', 'active')
     or v_location_status <> 'active'
     or v_control.processing_state is distinct from 'enabled'
     or (p_provider_key = 'retell' and v_connection.channel <> 'phone')
     or (p_provider_key = 'resend' and v_connection.channel <> 'email') then
    raise exception 'provider ingress is stopped' using errcode = 'OP001';
  end if;

  v_dedupe_key := 'provider-ingress:' || encode(public.digest(
    v_connection.id || ':' || p_provider_event_id,
    'sha256'
  ), 'hex');

  v_job := public.enqueue_job(
    v_job_kind,
    jsonb_build_object(
      'context', jsonb_build_object(
        'tenant_id', v_connection.tenant_id,
        'location_id', v_connection.location_id,
        'provider_connection_id', v_connection.id
      ),
      'provider_payload', p_sanitized_payload,
      'received_at', p_received_at
    ),
    1,
    v_dedupe_key,
    v_connection.tenant_id,
    now(),
    5
  );

  insert into public.provider_ingress_receipts (
    tenant_id,
    location_id,
    provider_connection_id,
    provider_key,
    provider_event_id,
    event_type,
    payload_digest,
    sanitized_payload_digest,
    accepted_pause_generation,
    job_id,
    received_at
  ) values (
    v_connection.tenant_id,
    v_connection.location_id,
    v_connection.id,
    p_provider_key,
    p_provider_event_id,
    p_event_type,
    p_payload_digest,
    v_sanitized_digest,
    v_control.pause_generation,
    v_job.id,
    p_received_at
  ) returning * into v_receipt;

  return jsonb_build_object(
    'receiptId', v_receipt.id,
    'jobId', v_receipt.job_id,
    'pauseGeneration', v_receipt.accepted_pause_generation,
    'replayed', false
  );
end;
$$;

revoke all on function prevent_provider_ingress_receipt_mutation()
  from public, anonymous, authenticated;
revoke all on function resolve_provider_ingress_connection(text, text)
  from public, anonymous, authenticated, outpost_job_runtime;
revoke all on function accept_provider_ingress_event(
  text, text, text, text, text, jsonb, timestamptz
) from public, anonymous, authenticated, outpost_job_runtime;

do $$
declare
  v_role record;
begin
  if not exists (select 1 from pg_roles where rolname = 'outpost_provider_ingress') then
    create role outpost_provider_ingress
      nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;

  select * into v_role from pg_roles where rolname = 'outpost_provider_ingress';
  if v_role.rolcanlogin
     or v_role.rolsuper
     or v_role.rolcreatedb
     or v_role.rolcreaterole
     or v_role.rolinherit
     or v_role.rolreplication
     or v_role.rolbypassrls then
    raise exception 'outpost_provider_ingress capability role has unsafe attributes'
      using errcode = '42501';
  end if;
end
$$;

revoke all on all tables in schema public from outpost_provider_ingress;
revoke all on all sequences in schema public from outpost_provider_ingress;
grant usage on schema public to outpost_provider_ingress;
grant execute on function resolve_provider_ingress_connection(text, text)
  to outpost_provider_ingress;
grant execute on function accept_provider_ingress_event(
  text, text, text, text, text, jsonb, timestamptz
) to outpost_provider_ingress;

revoke execute on function enqueue_job(
  text, jsonb, integer, text, text, timestamptz, integer
) from outpost_provider_ingress;
