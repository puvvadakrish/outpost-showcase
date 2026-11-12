-- Server-only jobs/outbox substrate.
-- This adds durable internal work tracking without enabling public routes,
-- provider ingress/egress, invite delivery, billing, POS, access-control, or
-- member-ledger writes.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('queued', 'running', 'succeeded', 'failed', 'dead');
  end if;
end
$$;

create table jobs (
  id text primary key default ('job_' || gen_random_uuid()::text),
  tenant_id text references tenants(id),
  kind text not null,
  payload_version integer not null default 1 check (payload_version > 0),
  payload jsonb not null default '{}'::jsonb,
  status job_status not null default 'queued',
  dedupe_key text not null unique,
  run_after timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0 and max_attempts <= 25),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_kind_shape check (kind ~ '^[a-z][a-z0-9_.:-]{1,120}$'),
  constraint jobs_dedupe_key_shape check (dedupe_key ~ '^[a-z][a-z0-9_.:-]{1,180}$'),
  constraint jobs_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint jobs_no_secret_payload check (
    payload::text !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass)'
  ),
  constraint jobs_running_lock check (
    (status = 'running' and locked_at is not null and locked_by is not null)
    or (status <> 'running')
  ),
  constraint jobs_completed_state check (
    (status = 'succeeded' and completed_at is not null)
    or (status <> 'succeeded')
  )
);

create index jobs_claim_idx
  on jobs (status, run_after, created_at, id)
  where status in ('queued', 'failed');

create index jobs_tenant_created_at_idx
  on jobs (tenant_id, created_at desc, id desc)
  where tenant_id is not null;

alter table jobs enable row level security;
revoke all on jobs from public, anonymous, authenticated;

create or replace function enqueue_job(
  p_kind text,
  p_payload jsonb,
  p_payload_version integer,
  p_dedupe_key text,
  p_tenant_id text default null,
  p_run_after timestamptz default now(),
  p_max_attempts integer default 5
)
returns jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job jobs;
begin
  p_kind := btrim(p_kind);
  p_dedupe_key := btrim(p_dedupe_key);
  p_tenant_id := nullif(btrim(coalesce(p_tenant_id, '')), '');
  p_payload := coalesce(p_payload, '{}'::jsonb);
  p_run_after := coalesce(p_run_after, now());
  p_max_attempts := coalesce(p_max_attempts, 5);

  if nullif(p_kind, '') is null then
    raise exception 'job kind is required'
      using errcode = '22023';
  end if;

  if nullif(p_dedupe_key, '') is null then
    raise exception 'job dedupe key is required'
      using errcode = '22023';
  end if;

  if p_payload_version is null or p_payload_version <= 0 then
    raise exception 'job payload version must be positive'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'job payload must be a json object'
      using errcode = '22023';
  end if;

  if p_tenant_id is not null and not exists (select 1 from tenants where id = p_tenant_id) then
    raise exception 'tenant % does not exist', p_tenant_id
      using errcode = '23503';
  end if;

  insert into jobs (
    tenant_id,
    kind,
    payload,
    payload_version,
    dedupe_key,
    run_after,
    max_attempts
  ) values (
    p_tenant_id,
    p_kind,
    p_payload,
    p_payload_version,
    p_dedupe_key,
    p_run_after,
    p_max_attempts
  )
  on conflict (dedupe_key) do nothing
  returning * into v_job;

  if v_job.id is not null then
    return v_job;
  end if;

  select *
    into v_job
    from jobs
    where dedupe_key = p_dedupe_key;

  if not found then
    raise exception 'job dedupe key % was not found after conflict', p_dedupe_key
      using errcode = '23505';
  end if;

  if v_job.tenant_id is distinct from p_tenant_id
     or v_job.kind <> p_kind
     or v_job.payload_version <> p_payload_version
     or v_job.payload <> p_payload then
    raise exception 'job dedupe key % conflicts with different work', p_dedupe_key
      using errcode = '23505';
  end if;

  return v_job;
end;
$$;

create or replace function claim_jobs(
  p_limit integer,
  p_worker_id text
)
returns setof jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  p_limit := least(greatest(coalesce(p_limit, 1), 1), 25);
  p_worker_id := btrim(coalesce(p_worker_id, ''));

  if nullif(p_worker_id, '') is null then
    raise exception 'worker id is required'
      using errcode = '22023';
  end if;

  update jobs
     set status = case when attempts >= max_attempts then 'dead'::job_status else 'failed'::job_status end,
         locked_at = null,
         locked_by = null,
         last_error = 'job lock expired before completion',
         run_after = now(),
         updated_at = now()
   where status = 'running'
     and locked_at < now() - interval '5 minutes';

  return query
    with next_jobs as (
      select jobs.id
      from jobs
      where jobs.status in ('queued', 'failed')
        and jobs.run_after <= now()
        and jobs.attempts < jobs.max_attempts
      order by jobs.run_after asc, jobs.created_at asc, jobs.id asc
      for update skip locked
      limit p_limit
    )
    update jobs
       set status = 'running',
           attempts = jobs.attempts + 1,
           locked_at = now(),
           locked_by = p_worker_id,
           last_error = null,
           updated_at = now()
      from next_jobs
     where jobs.id = next_jobs.id
    returning jobs.*;
end;
$$;

create or replace function mark_job_succeeded(
  p_job_id text,
  p_worker_id text
)
returns jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job jobs;
begin
  p_worker_id := btrim(coalesce(p_worker_id, ''));

  if nullif(p_worker_id, '') is null then
    raise exception 'worker id is required'
      using errcode = '22023';
  end if;

  update jobs
     set status = 'succeeded',
         locked_at = null,
         locked_by = null,
         completed_at = now(),
         updated_at = now()
   where id = btrim(p_job_id)
     and status = 'running'
     and locked_by = p_worker_id
  returning * into v_job;

  if not found then
    raise exception 'running job % was not found for worker %', p_job_id, p_worker_id
      using errcode = '22023';
  end if;

  return v_job;
end;
$$;

create or replace function mark_job_failed(
  p_job_id text,
  p_worker_id text,
  p_error text,
  p_retry_after timestamptz default null
)
returns jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job jobs;
begin
  p_worker_id := btrim(coalesce(p_worker_id, ''));

  if nullif(p_worker_id, '') is null then
    raise exception 'worker id is required'
      using errcode = '22023';
  end if;

  update jobs
     set status = case when attempts >= max_attempts then 'dead'::job_status else 'failed'::job_status end,
         locked_at = null,
         locked_by = null,
         last_error = left(coalesce(nullif(btrim(p_error), ''), 'unknown job failure'), 1000),
         run_after = coalesce(p_retry_after, now() + interval '30 seconds'),
         updated_at = now()
   where id = btrim(p_job_id)
     and status = 'running'
     and locked_by = p_worker_id
  returning * into v_job;

  if not found then
    raise exception 'running job % was not found for worker %', p_job_id, p_worker_id
      using errcode = '22023';
  end if;

  return v_job;
end;
$$;

revoke execute on function enqueue_job(text, jsonb, integer, text, text, timestamptz, integer)
  from public, anonymous, authenticated;
revoke execute on function claim_jobs(integer, text)
  from public, anonymous, authenticated;
revoke execute on function mark_job_succeeded(text, text)
  from public, anonymous, authenticated;
revoke execute on function mark_job_failed(text, text, text, timestamptz)
  from public, anonymous, authenticated;
