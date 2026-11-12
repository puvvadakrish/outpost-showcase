\set ON_ERROR_STOP on

begin;

-- Disposable-contract authority only; rolled back with the fixture.
grant outpost_job_runtime to current_user;

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select ''00000000-0000-0000-0000-000000000201''::uuid';

insert into plans (
  id, name, included_locations, included_voice_minutes, included_emails,
  included_users, overage_voice_minute_cents
) values ('plan_runtime_contract', 'Runtime contract', 1, 0, 0, 2, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values
  ('tenant_runtime_contract', 'Runtime Contract', 'runtime-contract', 'active',
   'plan_runtime_contract', 'pilot', 'concierge'),
  ('tenant_runtime_other', 'Runtime Other', 'runtime-other', 'active',
   'plan_runtime_contract', 'pilot', 'concierge');

insert into locations (id, tenant_id, name, address, timezone, status)
values
  ('location_runtime_contract', 'tenant_runtime_contract', 'Runtime Contract', 'Test', 'UTC', 'active'),
  ('location_runtime_other', 'tenant_runtime_other', 'Runtime Other', 'Test', 'UTC', 'active');

insert into neon_auth."user" (id)
values ('00000000-0000-0000-0000-000000000201');

insert into users (id, external_auth_id, email, name)
values (
  'user_runtime_owner',
  '00000000-0000-0000-0000-000000000201',
  'runtime-owner@example.com',
  'Runtime Owner'
);

insert into tenant_memberships (
  id, tenant_id, user_id, role, invite_status
) values (
  'membership_runtime_owner',
  'tenant_runtime_contract',
  'user_runtime_owner',
  'owner',
  'active'
);

do $$
begin
  if exists (
    select 1 from pg_roles
     where rolname = 'outpost_job_runtime'
       and (
         rolcanlogin
         or rolsuper
         or rolcreatedb
         or rolcreaterole
         or rolinherit
         or rolreplication
         or rolbypassrls
       )
  ) then
    raise exception 'runtime capability role has elevated attributes';
  end if;
  if (select processing_state from tenant_runtime_controls
      where tenant_id = 'tenant_runtime_contract') <> 'stopped' then
    raise exception 'new tenant runtime control did not default stopped';
  end if;

  if not has_function_privilege('outpost_job_runtime', 'claim_jobs(integer,text)', 'execute')
     or not has_function_privilege('outpost_job_runtime', 'mark_job_succeeded(text,text)', 'execute')
     or not has_function_privilege('outpost_job_runtime', 'mark_job_failed(text,text,text,timestamptz)', 'execute')
     or not has_function_privilege('outpost_job_runtime', 'defer_job_for_tenant_stop(text,text)', 'execute')
     or not has_function_privilege(
       'outpost_job_runtime',
       'persist_normalized_provider_event(jsonb,text,text)',
       'execute'
     ) then
    raise exception 'runtime role is missing required execute authority';
  end if;

  if has_function_privilege(
       'outpost_job_runtime',
       'enqueue_job(text,jsonb,integer,text,text,timestamptz,integer)',
       'execute'
     ) then
    raise exception 'runtime role can enqueue arbitrary jobs';
  end if;
  if has_function_privilege(
       'outpost_job_runtime',
       'persist_normalized_provider_event_private(jsonb)',
       'execute'
     ) then
    raise exception 'runtime role can bypass the processing guard';
  end if;
  if has_table_privilege('outpost_job_runtime', 'jobs', 'select')
     or has_table_privilege('outpost_job_runtime', 'jobs', 'insert')
     or has_table_privilege('outpost_job_runtime', 'tenant_runtime_controls', 'select')
     or has_table_privilege('outpost_job_runtime', 'tasks', 'insert') then
    raise exception 'runtime role has direct application-table authority';
  end if;
end;
$$;

insert into jobs (id, tenant_id, kind, payload, dedupe_key)
values (
  'job_runtime_tenant',
  'tenant_runtime_contract',
  'provider.resend.email_received.normalize',
  '{"context":{"tenant_id":"tenant_runtime_contract","location_id":"location_runtime_contract","provider_connection_id":""}}'::jsonb,
  'provider:runtime-tenant'
);

update jobs
   set status = 'running',
       attempts = 1,
       locked_at = now(),
       locked_by = 'runtime-worker-stopped',
       claimed_pause_generation = 0
 where id = 'job_runtime_tenant';

set local role outpost_job_runtime;

create temporary table jobs (id text);
create temporary table tenants (id text);
create temporary table tenant_runtime_controls (tenant_id text);
create temporary table conversations (id text);
create temporary table channel_events (id text);

do $$
begin
  if (select count(*) from claim_jobs(5, 'runtime-worker-stopped')) <> 0 then
    raise exception 'stopped tenant job was claimed';
  end if;

  begin
    perform persist_normalized_provider_event(
      '{"providerKey":"resend","conversation":{"tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract"}}'::jsonb,
      'job_runtime_tenant',
      'runtime-worker-stopped'
    );
    raise exception 'stopped tenant persistence unexpectedly succeeded';
  exception
    when sqlstate 'OP001' then
      if sqlerrm <> 'tenant runtime processing is stopped' then raise; end if;
  end;
end;
$$;

reset role;

drop table pg_temp.jobs;
drop table pg_temp.tenants;
drop table pg_temp.tenant_runtime_controls;
drop table pg_temp.conversations;
drop table pg_temp.channel_events;

update jobs
   set status = 'queued',
       attempts = 0,
       locked_at = null,
       locked_by = null,
       claimed_pause_generation = null
 where id = 'job_runtime_tenant';

set local role authenticated;

select set_tenant_runtime_processing_state(
  'tenant_runtime_contract',
  'runtime-enable-001',
  'enabled',
  0,
  'Enable protected processing rehearsal'
);
select set_tenant_runtime_processing_state(
  'tenant_runtime_contract',
  'runtime-enable-001',
  'enabled',
  0,
  'Enable protected processing rehearsal'
);

reset role;

do $$
begin
  if (select count(*) from tenant_runtime_control_operations
      where tenant_id = 'tenant_runtime_contract'
        and operation_key = 'runtime-enable-001') <> 1 then
    raise exception 'runtime operation replay duplicated its receipt';
  end if;
  if (select count(*) from audit_events
      where tenant_id = 'tenant_runtime_contract'
        and action = 'tenant.runtime_processing_enabled') <> 1 then
    raise exception 'runtime operation replay duplicated audit evidence';
  end if;

end;
$$;

set local role authenticated;

do $$
begin
  begin
    perform set_tenant_runtime_processing_state(
      'tenant_runtime_contract', 'runtime-enable-001', 'stopped',
      null,
      'Conflicting protected processing rehearsal'
    );
    raise exception 'changed runtime replay unexpectedly succeeded';
  exception when unique_violation then null;
  end;

  begin
    perform set_tenant_runtime_processing_state(
      'tenant_runtime_other', 'runtime-cross-tenant-001', 'enabled',
      0,
      'Cross tenant attempt'
    );
    raise exception 'cross-tenant runtime change unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;

insert into conversations (
  id, tenant_id, location_id, channel, requester_label, status, started_at, last_event_at
) values (
  'conversation_runtime_other', 'tenant_runtime_other', 'location_runtime_other', 'email',
  'Other tenant requester', 'open', now(), now()
);

insert into channel_events (
  id, tenant_id, location_id, conversation_id, channel, event_type,
  processing_status, received_at
) values (
  'event_runtime_other', 'tenant_runtime_other', 'location_runtime_other',
  'conversation_runtime_other', 'email', 'resend.email_received',
  'normalized', now()
);

insert into tasks (
  id, tenant_id, location_id, channel, requester_name, requester_contact,
  intent, summary, confidence, suggested_next_step, status
) values
  (
    'task_runtime_other', 'tenant_runtime_other', 'location_runtime_other',
    'email', 'Other requester', 'other@example.com', 'other',
    'Other tenant task', 0.8, 'Review other task', 'new'
  ),
  (
    'task_runtime_same', 'tenant_runtime_contract', 'location_runtime_contract',
    'email', 'Same requester', 'same@example.com', 'same',
    'Same tenant task', 0.8, 'Review same task', 'new'
  );

insert into task_events (
  id, tenant_id, location_id, task_id, event_type, note
) values (
  'task_event_source_task_runtime_new', 'tenant_runtime_contract',
  'location_runtime_contract', 'task_runtime_same', 'source_linked',
  'Conflicting source event fixture'
);

insert into usage_events (
  id, tenant_id, location_id, meter, quantity, source_type, source_id, period_key, occurred_at
) values (
  'usage_runtime_other', 'tenant_runtime_other', 'location_runtime_other', 'email_received', 1,
  'channel_event', 'event_runtime_other', '2026-07', now()
);

set local role outpost_job_runtime;

do $$
begin
  if (select count(*) from claim_jobs(5, 'runtime-worker-enabled')) <> 1 then
    raise exception 'enabled tenant job was not claimed';
  end if;

  begin
    perform persist_normalized_provider_event(
      '{"providerKey":"resend","conversation":{"tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract"}}'::jsonb,
      'job_runtime_tenant',
      'runtime-worker-enabled'
    );
    raise exception 'incomplete enabled event unexpectedly persisted';
  exception
    when raise_exception then
      if sqlerrm <> 'conversation.id required' then raise; end if;
  end;

  begin
    perform persist_normalized_provider_event(
      '{"providerKey":"resend","conversation":{"id":"conversation_runtime_other","tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract","channel":"email"},"channelEvent":{"id":"event_runtime_cross_tenant"}}'::jsonb,
      'job_runtime_tenant',
      'runtime-worker-enabled'
    );
    raise exception 'cross-tenant conversation conflict unexpectedly persisted';
  exception when unique_violation then null;
  end;

  begin
    perform persist_normalized_provider_event(
      '{"providerKey":"resend","conversation":{"id":"conversation_runtime_channel_new","tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract","channel":"email"},"channelEvent":{"id":"event_runtime_other"}}'::jsonb,
      'job_runtime_tenant',
      'runtime-worker-enabled'
    );
    raise exception 'cross-tenant channel event conflict unexpectedly persisted';
  exception when unique_violation then null;
  end;

  begin
    perform persist_normalized_provider_event(
      '{"providerKey":"resend","conversation":{"id":"conversation_runtime_task_new","tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract","channel":"email"},"channelEvent":{"id":"event_runtime_task_new"},"proposedTask":{"id":"task_runtime_other","tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract","channel":"email","requesterName":"Requester","requesterContact":"requester@example.com","intent":"test","summary":"Test task","confidence":0.8,"suggestedNextStep":"Review task"}}'::jsonb,
      'job_runtime_tenant',
      'runtime-worker-enabled'
    );
    raise exception 'cross-tenant task conflict unexpectedly persisted';
  exception when unique_violation then null;
  end;

  begin
    perform persist_normalized_provider_event(
      '{"providerKey":"resend","conversation":{"id":"conversation_runtime_task_event_new","tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract","channel":"email"},"channelEvent":{"id":"event_runtime_task_event_new"},"proposedTask":{"id":"task_runtime_new","tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract","channel":"email","requesterName":"Requester","requesterContact":"requester@example.com","intent":"test","summary":"Test task","confidence":0.8,"suggestedNextStep":"Review task"}}'::jsonb,
      'job_runtime_tenant',
      'runtime-worker-enabled'
    );
    raise exception 'task source event conflict unexpectedly persisted';
  exception when unique_violation then null;
  end;

  begin
    perform persist_normalized_provider_event(
      '{"providerKey":"resend","conversation":{"id":"conversation_runtime_new","tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract","channel":"email"},"channelEvent":{"id":"event_runtime_new"},"usageEvents":[{"id":"usage_runtime_other","tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract","meter":"email_received","quantity":1,"sourceType":"channel_event","sourceId":"event_runtime_new","periodKey":"2026-07"}]}'::jsonb,
      'job_runtime_tenant',
      'runtime-worker-enabled'
    );
    raise exception 'cross-tenant usage event conflict unexpectedly persisted';
  exception when unique_violation then null;
  end;

  begin
    perform defer_job_for_tenant_stop('job_runtime_tenant', 'runtime-worker-enabled');
    raise exception 'deferral without a newer stop generation unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_tenant_runtime_processing_state(
  'tenant_runtime_contract',
  'runtime-stop-001',
  'stopped',
  null,
  'Stop protected processing rehearsal'
);
reset role;
set local role outpost_job_runtime;

select defer_job_for_tenant_stop('job_runtime_tenant', 'runtime-worker-enabled');

reset role;

set local role authenticated;
do $$
begin
  begin
    perform set_tenant_runtime_processing_state(
      'tenant_runtime_contract', 'runtime-stale-enable-001', 'enabled', 0,
      'Stale enable must not override a newer stop'
    );
    raise exception 'stale runtime enable unexpectedly succeeded';
  exception when serialization_failure then null;
  end;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from jobs
     where id = 'job_runtime_tenant'
       and status = 'queued'
       and attempts = 0
       and locked_at is null
       and locked_by is null
  ) then
    raise exception 'stop deferral did not restore queued work and retry budget';
  end if;
end;
$$;

delete from jobs where id = 'job_runtime_tenant';

set local role authenticated;
select set_tenant_runtime_processing_state(
  'tenant_runtime_contract', 'runtime-enable-after-stop-001', 'enabled', 1,
  'Enable after observing the current stop generation'
);
reset role;

insert into jobs (id, tenant_id, kind, payload, dedupe_key)
values (
  'job_runtime_stale_lease', 'tenant_runtime_contract',
  'provider.resend.email_received.normalize',
  '{"context":{"tenant_id":"tenant_runtime_contract","location_id":"location_runtime_contract","provider_connection_id":""}}'::jsonb,
  'provider:runtime-stale-lease'
);

set local role outpost_job_runtime;
do $$
begin
  if (select count(*) from claim_jobs(1, 'runtime-worker-before-pause')) <> 1 then
    raise exception 'stale-lease fixture was not claimed';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_tenant_runtime_processing_state(
  'tenant_runtime_contract', 'runtime-stop-002', 'stopped', null,
  'Stop while a worker lease remains active'
);
select set_tenant_runtime_processing_state(
  'tenant_runtime_contract', 'runtime-enable-after-stop-002', 'enabled', 2,
  'Resume after the worker lease crossed a stop generation'
);
reset role;

set local role outpost_job_runtime;
do $$
begin
  begin
    perform persist_normalized_provider_event(
      '{"providerKey":"resend","conversation":{"tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract"}}'::jsonb,
      'job_runtime_stale_lease',
      'runtime-worker-before-pause'
    );
    raise exception 'pre-stop generation crossed stop and resume';
  exception
    when sqlstate 'OP001' then
      if sqlerrm <> 'tenant runtime processing is stopped' then raise; end if;
  end;
end;
$$;
reset role;

update jobs
   set locked_at = now() - interval '6 minutes'
 where id = 'job_runtime_stale_lease';

set local role outpost_job_runtime;
do $$
begin
  if (select count(*) from claim_jobs(1, 'runtime-worker-after-pause')) <> 1 then
    raise exception 'generation-restored stale lease was not reclaimed';
  end if;
end;
$$;
reset role;

set local role outpost_job_runtime;
do $$
begin
  begin
    perform persist_normalized_provider_event(
      '{"providerKey":"resend","conversation":{"tenantId":"tenant_runtime_contract","locationId":"location_runtime_contract"}}'::jsonb,
      'job_runtime_stale_lease',
      'runtime-worker-before-pause'
    );
    raise exception 'recovered lease unexpectedly retained persistence authority';
  exception
    when sqlstate 'OP002' then
      if sqlerrm <> 'provider persistence job lease is no longer authoritative' then raise; end if;
  end;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from jobs
     where id = 'job_runtime_stale_lease'
       and status = 'running'
       and attempts = 1
       and claimed_pause_generation = 2
       and locked_by = 'runtime-worker-after-pause'
  ) then
    raise exception 'stale recovery consumed a retry across stop and resume';
  end if;
end;
$$;

update tenants set status = 'paused' where id = 'tenant_runtime_contract';
set local role authenticated;

do $$
begin
  begin
    perform set_tenant_runtime_processing_state(
      'tenant_runtime_contract', 'runtime-enable-002', 'enabled',
      2,
      'Attempt enable while lifecycle paused'
    );
    raise exception 'lifecycle-paused tenant was enabled';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

rollback;
