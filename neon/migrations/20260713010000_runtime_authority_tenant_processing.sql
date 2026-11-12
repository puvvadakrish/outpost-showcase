-- Establish least-privilege job runtime authority and a fail-closed tenant
-- processing stop. This does not enable provider ingress, provider secrets,
-- outbound delivery, invites, public self-serve, billing, POS, access-control,
-- or member-ledger writes.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tenant_processing_state') then
    create type tenant_processing_state as enum ('stopped', 'enabled');
  end if;
end
$$;

create table tenant_runtime_controls (
  tenant_id text primary key references tenants(id),
  processing_state tenant_processing_state not null default 'stopped',
  pause_generation bigint not null default 0 check (pause_generation >= 0),
  updated_by_user_id text references users(id),
  updated_at timestamptz not null default now()
);

create table tenant_runtime_control_operations (
  id text primary key default ('runtime_operation_' || gen_random_uuid()::text),
  tenant_id text not null references tenants(id),
  operation_key text not null,
  requested_state tenant_processing_state not null,
  expected_pause_generation bigint,
  previous_state tenant_processing_state not null,
  resulting_state tenant_processing_state not null,
  previous_pause_generation bigint not null,
  resulting_pause_generation bigint not null,
  actor_user_id text not null references users(id),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, operation_key),
  constraint tenant_runtime_operation_key_shape
    check (operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  constraint tenant_runtime_operation_reason_length
    check (char_length(reason) between 3 and 500)
);

alter table jobs
  add column claimed_pause_generation bigint
  check (claimed_pause_generation is null or claimed_pause_generation >= 0);

insert into tenant_runtime_controls (tenant_id, processing_state)
select id, 'stopped'::tenant_processing_state
from tenants
on conflict (tenant_id) do nothing;

alter table tenant_runtime_controls enable row level security;
alter table tenant_runtime_control_operations enable row level security;

create policy "members read tenant runtime controls" on tenant_runtime_controls
  for select using (is_active_tenant_member(tenant_id));

revoke all on tenant_runtime_controls from public, anonymous, authenticated;
revoke all on tenant_runtime_control_operations from public, anonymous, authenticated;
grant select on tenant_runtime_controls to authenticated;

create or replace function ensure_tenant_runtime_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into tenant_runtime_controls (tenant_id, processing_state)
  values (new.id, 'stopped')
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

create trigger tenants_create_runtime_control
after insert on tenants
for each row execute function ensure_tenant_runtime_control();

create or replace function stop_runtime_for_tenant_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('paused', 'disabled') and old.status is distinct from new.status then
    update tenant_runtime_controls
       set processing_state = 'stopped',
           pause_generation = case
             when processing_state = 'enabled' then pause_generation + 1
             else pause_generation
           end,
           updated_by_user_id = null,
           updated_at = now()
     where tenant_id = new.id;
  end if;
  return new;
end;
$$;

create trigger tenants_stop_runtime_on_lifecycle
after update of status on tenants
for each row execute function stop_runtime_for_tenant_lifecycle();

create or replace function prevent_tenant_runtime_operation_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'tenant runtime control operations are immutable'
    using errcode = '55000';
end;
$$;

create trigger tenant_runtime_operations_immutable
before update or delete on tenant_runtime_control_operations
for each row execute function prevent_tenant_runtime_operation_mutation();

create or replace function set_tenant_runtime_processing_state(
  p_tenant_id text,
  p_operation_key text,
  p_requested_state text,
  p_expected_pause_generation bigint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_user_id text;
  v_tenant_status tenant_status;
  v_requested_state tenant_processing_state;
  v_control tenant_runtime_controls;
  v_previous_state tenant_processing_state;
  v_previous_pause_generation bigint;
  v_existing tenant_runtime_control_operations;
  v_operation tenant_runtime_control_operations;
begin
  p_tenant_id := btrim(coalesce(p_tenant_id, ''));
  p_operation_key := btrim(coalesce(p_operation_key, ''));
  p_reason := btrim(coalesce(p_reason, ''));

  if p_tenant_id = '' then
    raise exception 'tenant id is required' using errcode = '22023';
  end if;
  if p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'operation key is invalid' using errcode = '22023';
  end if;
  if char_length(p_reason) < 3 or char_length(p_reason) > 500 then
    raise exception 'reason must be between 3 and 500 characters' using errcode = '22023';
  end if;

  begin
    v_requested_state := p_requested_state::tenant_processing_state;
  exception
    when invalid_text_representation then
      raise exception 'requested state must be stopped or enabled' using errcode = '22023';
  end;

  v_actor_user_id := current_app_user_id();
  if v_actor_user_id is null or not is_active_tenant_owner(p_tenant_id) then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  select status
    into v_tenant_status
    from tenants
   where id = p_tenant_id
   for update;

  if not found then
    raise exception 'tenant not found' using errcode = '22023';
  end if;

  insert into tenant_runtime_controls (tenant_id, processing_state)
  values (p_tenant_id, 'stopped')
  on conflict (tenant_id) do nothing;

  select *
    into v_control
    from tenant_runtime_controls
   where tenant_id = p_tenant_id
   for update;

  select *
    into v_existing
    from tenant_runtime_control_operations
   where tenant_id = p_tenant_id
     and operation_key = p_operation_key;

  if found then
    if v_existing.requested_state <> v_requested_state
       or v_existing.expected_pause_generation is distinct from p_expected_pause_generation
       or v_existing.reason <> p_reason then
      raise exception 'operation key conflicts with different runtime request'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'operationId', v_existing.id,
      'tenantId', v_existing.tenant_id,
      'previousState', v_existing.previous_state,
      'resultingState', v_existing.resulting_state,
      'previousPauseGeneration', v_existing.previous_pause_generation,
      'resultingPauseGeneration', v_existing.resulting_pause_generation,
      'currentState', v_control.processing_state,
      'currentPauseGeneration', v_control.pause_generation,
      'replayed', true,
      'createdAt', v_existing.created_at
    );
  end if;

  if v_requested_state = 'enabled'
     and v_tenant_status not in ('setup', 'active') then
    raise exception 'tenant lifecycle does not permit runtime processing'
      using errcode = '55000';
  end if;

  if v_requested_state = 'enabled'
     and p_expected_pause_generation is distinct from v_control.pause_generation then
    raise exception 'runtime enable generation is stale'
      using errcode = '40001';
  end if;

  v_previous_state := v_control.processing_state;
  v_previous_pause_generation := v_control.pause_generation;

  update tenant_runtime_controls
     set processing_state = v_requested_state,
         pause_generation = case
           when v_requested_state = 'stopped' and processing_state <> 'stopped'
             then pause_generation + 1
           else pause_generation
         end,
         updated_by_user_id = v_actor_user_id,
         updated_at = now()
   where tenant_id = p_tenant_id
  returning * into v_control;

  insert into tenant_runtime_control_operations (
    tenant_id,
    operation_key,
    requested_state,
    expected_pause_generation,
    previous_state,
    resulting_state,
    previous_pause_generation,
    resulting_pause_generation,
    actor_user_id,
    reason
  ) values (
    p_tenant_id,
    p_operation_key,
    v_requested_state,
    p_expected_pause_generation,
    v_previous_state,
    v_requested_state,
    v_previous_pause_generation,
    v_control.pause_generation,
    v_actor_user_id,
    p_reason
  ) returning * into v_operation;

  if v_previous_state <> v_control.processing_state then
    insert into audit_events (
    id,
    tenant_id,
    actor_user_id,
    action,
    subject_type,
    subject_id,
    metadata
  ) values (
    'audit_runtime_' || gen_random_uuid()::text,
    p_tenant_id,
    v_actor_user_id,
    case when v_requested_state = 'stopped'
      then 'tenant.runtime_processing_stopped'
      else 'tenant.runtime_processing_enabled'
    end,
    'tenant_runtime_control',
    p_tenant_id,
    jsonb_build_object(
      'operationId', v_operation.id,
      'previousState', v_operation.previous_state,
      'resultingState', v_operation.resulting_state,
      'previousPauseGeneration', v_operation.previous_pause_generation,
      'resultingPauseGeneration', v_operation.resulting_pause_generation,
      'reason', p_reason
    )
    );
  end if;

  return jsonb_build_object(
    'operationId', v_operation.id,
    'tenantId', v_operation.tenant_id,
    'previousState', v_operation.previous_state,
    'resultingState', v_operation.resulting_state,
    'previousPauseGeneration', v_operation.previous_pause_generation,
    'resultingPauseGeneration', v_operation.resulting_pause_generation,
    'currentState', v_control.processing_state,
    'currentPauseGeneration', v_control.pause_generation,
    'replayed', false,
    'createdAt', v_operation.created_at
  );
end;
$$;

-- Replace claim authority so tenant work is invisible while processing is
-- stopped or the tenant lifecycle is paused/disabled. Null-tenant maintenance
-- work retains the established behavior.
create or replace function claim_jobs(
  p_limit integer,
  p_worker_id text
)
returns setof jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  p_limit := least(greatest(coalesce(p_limit, 1), 1), 25);
  p_worker_id := btrim(coalesce(p_worker_id, ''));

  if nullif(p_worker_id, '') is null then
    raise exception 'worker id is required' using errcode = '22023';
  end if;

  -- Serialize stale-lease recovery with lifecycle and owner stops. Locking
  -- tenant, then control, then job matches every stop/persistence path.
  perform 1
    from public.tenants tenant
   where tenant.id in (
     select distinct expired.tenant_id
       from public.jobs expired
      where expired.tenant_id is not null
        and expired.status = 'running'
        and expired.locked_at < now() - interval '5 minutes'
   )
   order by tenant.id
   for update;

  perform 1
    from public.tenant_runtime_controls controls
   where controls.tenant_id in (
     select distinct expired.tenant_id
       from public.jobs expired
      where expired.tenant_id is not null
        and expired.status = 'running'
        and expired.locked_at < now() - interval '5 minutes'
   )
   order by controls.tenant_id
   for update;

  with expired_jobs as (
    select expired.id,
           controls.pause_generation > coalesce(expired.claimed_pause_generation, -1) as pause_advanced
      from jobs expired
      left join tenant_runtime_controls controls on controls.tenant_id = expired.tenant_id
     where expired.status = 'running'
       and expired.locked_at < now() - interval '5 minutes'
     for update of expired
  )
  update jobs
     set status = case
           when expired_jobs.pause_advanced then 'queued'::job_status
           when jobs.attempts >= jobs.max_attempts then 'dead'::job_status
           else 'failed'::job_status
         end,
         attempts = case
           when expired_jobs.pause_advanced then greatest(jobs.attempts - 1, 0)
           else jobs.attempts
         end,
         locked_at = null,
         locked_by = null,
         claimed_pause_generation = null,
         last_error = case
           when expired_jobs.pause_advanced
             then 'tenant runtime processing stopped before lease recovery'
           else 'job lock expired before completion'
         end,
         run_after = now(),
         updated_at = now()
    from expired_jobs
   where jobs.id = expired_jobs.id;

  return query
    with next_jobs as (
      select candidate.id, controls.pause_generation
        from jobs candidate
        left join tenants on tenants.id = candidate.tenant_id
        left join tenant_runtime_controls controls on controls.tenant_id = candidate.tenant_id
       where candidate.status in ('queued', 'failed')
         and candidate.run_after <= now()
         and candidate.attempts < candidate.max_attempts
         and (
           candidate.tenant_id is null
           or (
             tenants.status in ('setup', 'active')
             and controls.processing_state = 'enabled'
           )
         )
       order by candidate.run_after asc, candidate.created_at asc, candidate.id asc
       for update of candidate skip locked
       limit p_limit
    )
    update jobs
       set status = 'running',
           attempts = jobs.attempts + 1,
           locked_at = now(),
           locked_by = p_worker_id,
           claimed_pause_generation = next_jobs.pause_generation,
           last_error = null,
           updated_at = now()
      from next_jobs
     where jobs.id = next_jobs.id
    returning jobs.*;
end;
$$;

create or replace function defer_job_for_tenant_stop(
  p_job_id text,
  p_worker_id text
)
returns jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job jobs;
begin
  p_worker_id := btrim(coalesce(p_worker_id, ''));
  if nullif(p_worker_id, '') is null then
    raise exception 'worker id is required' using errcode = '22023';
  end if;

  update jobs
     set status = 'queued',
         attempts = greatest(attempts - 1, 0),
         locked_at = null,
         locked_by = null,
         claimed_pause_generation = null,
         last_error = 'tenant runtime processing stopped',
         completed_at = null,
         updated_at = now()
    from tenant_runtime_controls controls
   where jobs.id = btrim(p_job_id)
     and jobs.tenant_id is not null
     and controls.tenant_id = jobs.tenant_id
     and controls.pause_generation > coalesce(jobs.claimed_pause_generation, -1)
     and jobs.status = 'running'
     and jobs.locked_by = p_worker_id
  returning * into v_job;

  if not found then
    raise exception 'running tenant job % was not found for worker %', p_job_id, p_worker_id
      using errcode = '22023';
  end if;

  return v_job;
end;
$$;

-- Preserve the existing atomic persistence body behind a private function,
-- then make the public runtime entrypoint acquire the tenant stop lock first.
alter function persist_normalized_provider_event(jsonb)
  rename to persist_normalized_provider_event_private;

revoke all on function persist_normalized_provider_event_private(jsonb)
  from public, anonymous, authenticated;

create or replace function persist_normalized_provider_event(
  p_event jsonb,
  p_job_id text,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id text := p_event -> 'conversation' ->> 'tenantId';
  v_location_id text := nullif(p_event -> 'conversation' ->> 'locationId', '');
  v_provider_connection_id text := nullif(
    p_event -> 'conversation' ->> 'providerConnectionId',
    ''
  );
  v_conversation_id text := p_event -> 'conversation' ->> 'id';
  v_channel_event_id text := p_event -> 'channelEvent' ->> 'id';
  v_task_id text := nullif(p_event -> 'proposedTask' ->> 'id', '');
  v_usage_event jsonb;
  v_channel channel := (p_event -> 'conversation' ->> 'channel')::channel;
  v_tenant_status tenant_status;
  v_processing_state tenant_processing_state;
  v_pause_generation bigint;
  v_job jobs;
begin
  p_job_id := btrim(coalesce(p_job_id, ''));
  p_worker_id := btrim(coalesce(p_worker_id, ''));

  if nullif(v_tenant_id, '') is null then
    raise exception 'conversation.tenantId required' using errcode = '22023';
  end if;
  if p_job_id = '' or p_worker_id = '' then
    raise exception 'job lease identity required' using errcode = '22023';
  end if;

  select status
    into v_tenant_status
    from public.tenants
   where id = v_tenant_id
   for share;

  if not found or v_tenant_status not in ('setup', 'active') then
    raise exception 'tenant runtime processing is stopped'
      using errcode = 'OP001';
  end if;

  select processing_state, pause_generation
    into v_processing_state, v_pause_generation
    from public.tenant_runtime_controls
   where tenant_id = v_tenant_id
   for share;

  select *
    into v_job
    from public.jobs
   where id = p_job_id
   for update;

  if not found
     or v_job.status <> 'running'
     or v_job.locked_by is distinct from p_worker_id
     or v_job.locked_at is null
     or v_job.locked_at < now() - interval '5 minutes'
     or v_job.tenant_id is distinct from v_tenant_id
     or v_job.kind not in (
       'provider.retell.call_ended.normalize',
       'provider.resend.email_received.normalize'
     )
     or v_job.claimed_pause_generation is null then
    raise exception 'provider persistence job lease is no longer authoritative'
      using errcode = 'OP002';
  end if;

  if v_job.payload -> 'context' ->> 'tenant_id' is distinct from v_tenant_id
     or nullif(v_job.payload -> 'context' ->> 'location_id', '')
       is distinct from v_location_id
     or nullif(v_job.payload -> 'context' ->> 'provider_connection_id', '')
       is distinct from v_provider_connection_id
     or (
       v_job.kind = 'provider.retell.call_ended.normalize'
       and p_event ->> 'providerKey' is distinct from 'retell'
     )
     or (
       v_job.kind = 'provider.resend.email_received.normalize'
       and p_event ->> 'providerKey' is distinct from 'resend'
     ) then
    raise exception 'provider persistence event does not match the claimed job'
      using errcode = 'OP002';
  end if;

  if v_processing_state is null
     or v_processing_state <> 'enabled'
     or v_pause_generation is distinct from v_job.claimed_pause_generation then
    raise exception 'tenant runtime processing is stopped'
      using errcode = 'OP001';
  end if;

  if nullif(v_conversation_id, '') is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('outpost:conversation:' || v_conversation_id, 0)
    );
  end if;
  if nullif(v_channel_event_id, '') is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('outpost:channel-event:' || v_channel_event_id, 0)
    );
  end if;
  if v_task_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('outpost:task:' || v_task_id, 0)
    );
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('outpost:task-event:task_event_source_' || v_task_id, 0)
    );
  end if;
  for v_usage_event in
    select value
      from jsonb_array_elements(coalesce(p_event -> 'usageEvents', '[]'::jsonb))
     order by value ->> 'id'
  loop
    if nullif(v_usage_event ->> 'id', '') is not null then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('outpost:usage-event:' || (v_usage_event ->> 'id'), 0)
      );
    end if;
  end loop;

  if exists (
    select 1
      from public.conversations existing
     where existing.id = v_conversation_id
       and (
         existing.tenant_id is distinct from v_tenant_id
         or existing.location_id is distinct from v_location_id
         or existing.provider_connection_id is distinct from v_provider_connection_id
         or existing.channel is distinct from v_channel
         or existing.external_conversation_id is distinct from nullif(
           p_event -> 'conversation' ->> 'externalConversationId',
           ''
         )
       )
  ) then
    raise exception 'conversation id conflicts with different tenant provenance'
      using errcode = '23505';
  end if;

  if exists (
    select 1
      from public.channel_events existing
     where existing.id = v_channel_event_id
       and (
         existing.tenant_id is distinct from v_tenant_id
         or existing.location_id is distinct from v_location_id
         or existing.provider_connection_id is distinct from v_provider_connection_id
         or existing.conversation_id is distinct from v_conversation_id
         or existing.channel is distinct from v_channel
         or existing.provider_event_id is distinct from nullif(
           p_event -> 'channelEvent' ->> 'providerEventId',
           ''
         )
         or existing.event_type is distinct from p_event -> 'channelEvent' ->> 'eventType'
         or existing.payload_digest is distinct from nullif(
           p_event -> 'channelEvent' ->> 'payloadDigest',
           ''
         )
       )
  ) then
    raise exception 'channel event id conflicts with different tenant provenance'
      using errcode = '23505';
  end if;

  if v_task_id is not null and exists (
    select 1
      from public.tasks existing
     where existing.id = v_task_id
       and (
         existing.tenant_id is distinct from v_tenant_id
         or existing.location_id is distinct from v_location_id
         or existing.channel is distinct from (p_event -> 'proposedTask' ->> 'channel')::task_channel
         or existing.requester_name is distinct from p_event -> 'proposedTask' ->> 'requesterName'
         or existing.requester_contact is distinct from p_event -> 'proposedTask' ->> 'requesterContact'
         or existing.intent is distinct from p_event -> 'proposedTask' ->> 'intent'
         or existing.summary is distinct from p_event -> 'proposedTask' ->> 'summary'
         or existing.confidence is distinct from (p_event -> 'proposedTask' ->> 'confidence')::numeric
         or existing.suggested_next_step is distinct from p_event -> 'proposedTask' ->> 'suggestedNextStep'
       )
  ) then
    raise exception 'task id conflicts with different tenant provenance'
      using errcode = '23505';
  end if;

  if v_task_id is not null and exists (
    select 1
      from public.task_events existing
     where existing.id = 'task_event_source_' || v_task_id
       and (
         existing.tenant_id is distinct from v_tenant_id
         or existing.location_id is distinct from v_location_id
         or existing.task_id is distinct from v_task_id
         or existing.event_type is distinct from 'source_linked'
       )
  ) then
    raise exception 'task source event id conflicts with different tenant provenance'
      using errcode = '23505';
  end if;

  for v_usage_event in
    select value
      from jsonb_array_elements(coalesce(p_event -> 'usageEvents', '[]'::jsonb))
     order by value ->> 'id'
  loop
    if exists (
      select 1
        from public.usage_events existing
       where existing.id = v_usage_event ->> 'id'
         and (
           existing.tenant_id is distinct from v_tenant_id
           or existing.location_id is distinct from nullif(v_usage_event ->> 'locationId', '')
           or existing.meter is distinct from (v_usage_event ->> 'meter')::usage_meter
           or existing.quantity is distinct from (v_usage_event ->> 'quantity')::numeric
           or existing.source_type is distinct from v_usage_event ->> 'sourceType'
           or existing.source_id is distinct from v_usage_event ->> 'sourceId'
           or existing.period_key is distinct from v_usage_event ->> 'periodKey'
         )
    ) then
      raise exception 'usage event id conflicts with different tenant provenance'
        using errcode = '23505';
    end if;
  end loop;

  return public.persist_normalized_provider_event_private(p_event);
end;
$$;

alter function public.persist_normalized_provider_event_private(jsonb)
  set search_path = public, pg_temp;
alter function public.mark_job_succeeded(text, text)
  set search_path = public, pg_temp;
alter function public.mark_job_failed(text, text, text, timestamptz)
  set search_path = public, pg_temp;

revoke all on function ensure_tenant_runtime_control() from public, anonymous, authenticated;
revoke all on function stop_runtime_for_tenant_lifecycle() from public, anonymous, authenticated;
revoke all on function prevent_tenant_runtime_operation_mutation() from public, anonymous, authenticated;
revoke all on function set_tenant_runtime_processing_state(text, text, text, bigint, text)
  from public, anonymous;
grant execute on function set_tenant_runtime_processing_state(text, text, text, bigint, text)
  to authenticated;
revoke all on function defer_job_for_tenant_stop(text, text)
  from public, anonymous, authenticated;
revoke all on function persist_normalized_provider_event(jsonb, text, text)
  from public, anonymous, authenticated;

do $$
declare
  v_role record;
begin
  if not exists (select 1 from pg_roles where rolname = 'outpost_job_runtime') then
    create role outpost_job_runtime
      nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;

  select *
    into v_role
    from pg_roles
   where rolname = 'outpost_job_runtime';

  if v_role.rolcanlogin
     or v_role.rolsuper
     or v_role.rolcreatedb
     or v_role.rolcreaterole
     or v_role.rolinherit
     or v_role.rolreplication
     or v_role.rolbypassrls then
    raise exception 'outpost_job_runtime capability role has unsafe attributes'
      using errcode = '42501';
  end if;
end
$$;

revoke all on all tables in schema public from outpost_job_runtime;
revoke all on all sequences in schema public from outpost_job_runtime;
grant usage on schema public to outpost_job_runtime;
grant execute on function claim_jobs(integer, text) to outpost_job_runtime;
grant execute on function mark_job_succeeded(text, text) to outpost_job_runtime;
grant execute on function mark_job_failed(text, text, text, timestamptz) to outpost_job_runtime;
grant execute on function defer_job_for_tenant_stop(text, text) to outpost_job_runtime;
grant execute on function persist_normalized_provider_event(jsonb, text, text)
  to outpost_job_runtime;

revoke execute on function enqueue_job(text, jsonb, integer, text, text, timestamptz, integer)
  from outpost_job_runtime;
revoke execute on function persist_normalized_provider_event_private(jsonb)
  from outpost_job_runtime;
