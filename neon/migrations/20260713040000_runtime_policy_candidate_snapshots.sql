-- Persist owner-reviewable runtime policy candidates without adding review
-- decisions, activation, evaluation, provider execution, or outbound behavior.

create or replace function runtime_policy_candidate_body_is_valid(p_body jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  v_item jsonb;
  v_source_id jsonb;
begin
  if p_body is null
     or jsonb_typeof(p_body) <> 'object'
     or octet_length(p_body::text) > 2097152
     or not (p_body ?& array['answerTopics', 'defaultPolicy', 'handoffs', 'warnings'])
     or p_body - array['answerTopics', 'defaultPolicy', 'handoffs', 'warnings']::text[] <> '{}'::jsonb
     or p_body->'defaultPolicy' <> '{"kind":"create_staff_task"}'::jsonb
     or jsonb_typeof(p_body->'answerTopics') <> 'array'
     or jsonb_typeof(p_body->'handoffs') <> 'array'
     or jsonb_typeof(p_body->'warnings') <> 'array'
     or jsonb_array_length(p_body->'answerTopics') > 1000
     or jsonb_array_length(p_body->'handoffs') > 1000
     or jsonb_array_length(p_body->'warnings') > 1000 then
    return false;
  end if;

  for v_item in select value from jsonb_array_elements(p_body->'answerTopics') loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ?& array['kind', 'sourceAnswerId', 'topic', 'topicKey'])
       or jsonb_typeof(v_item->'kind') <> 'string'
       or v_item->>'kind' not in ('answer', 'create_staff_task')
       or jsonb_typeof(v_item->'sourceAnswerId') <> 'string'
       or char_length(btrim(v_item->>'sourceAnswerId')) < 1
       or char_length(v_item->>'sourceAnswerId') > 200
       or jsonb_typeof(v_item->'topic') <> 'string'
       or char_length(btrim(v_item->>'topic')) < 1
       or char_length(v_item->>'topic') > 160
       or jsonb_typeof(v_item->'topicKey') <> 'string'
       or char_length(btrim(v_item->>'topicKey')) < 1
       or char_length(v_item->>'topicKey') > 160 then
      return false;
    end if;

    if v_item->>'kind' = 'answer' then
      if not (v_item ? 'answer')
         or v_item - array['answer', 'kind', 'sourceAnswerId', 'topic', 'topicKey']::text[] <> '{}'::jsonb
         or jsonb_typeof(v_item->'answer') <> 'string'
         or char_length(btrim(v_item->>'answer')) < 1
         or char_length(v_item->>'answer') > 4000 then
        return false;
      end if;
    elsif v_item ? 'answer'
       or v_item - array['kind', 'sourceAnswerId', 'topic', 'topicKey']::text[] <> '{}'::jsonb then
      return false;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_body->'handoffs') loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ?& array[
         'action', 'activeWindow', 'destination', 'priority',
         'sourceRuleId', 'topic', 'trigger'
       ])
       or v_item - array[
         'action', 'activeWindow', 'destination', 'priority',
         'sourceRuleId', 'topic', 'trigger'
       ]::text[] <> '{}'::jsonb
       or jsonb_typeof(v_item->'action') <> 'string'
       or v_item->>'action' not in ('create_task', 'notify_staff', 'transfer_when_live', 'block_automation')
       or jsonb_typeof(v_item->'activeWindow') <> 'string'
       or char_length(btrim(v_item->>'activeWindow')) < 1
       or char_length(v_item->>'activeWindow') > 120
       or jsonb_typeof(v_item->'destination') <> 'string'
       or char_length(btrim(v_item->>'destination')) < 1
       or char_length(v_item->>'destination') > 240
       or jsonb_typeof(v_item->'priority') <> 'number'
       or (v_item->>'priority')::numeric <> trunc((v_item->>'priority')::numeric)
       or (v_item->>'priority')::numeric not between 1 and 1000
       or jsonb_typeof(v_item->'sourceRuleId') <> 'string'
       or char_length(btrim(v_item->>'sourceRuleId')) < 1
       or char_length(v_item->>'sourceRuleId') > 200
       or jsonb_typeof(v_item->'topic') <> 'string'
       or char_length(btrim(v_item->>'topic')) < 1
       or char_length(v_item->>'topic') > 160
       or jsonb_typeof(v_item->'trigger') <> 'string'
       or v_item->>'trigger' not in (
         'topic', 'low_confidence', 'always_human',
         'explicit_human_request', 'missing_fact', 'conflict'
       ) then
      return false;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_body->'warnings') loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ?& array['code', 'severity', 'sourceIds', 'topicKey'])
       or v_item - array['code', 'severity', 'sourceIds', 'topicKey']::text[] <> '{}'::jsonb
       or jsonb_typeof(v_item->'code') <> 'string'
       or v_item->>'code' <> 'answer_handoff_overlap'
       or jsonb_typeof(v_item->'severity') <> 'string'
       or v_item->>'severity' <> 'warning'
       or jsonb_typeof(v_item->'sourceIds') <> 'array'
       or jsonb_array_length(v_item->'sourceIds') > 200
       or jsonb_typeof(v_item->'topicKey') <> 'string'
       or char_length(btrim(v_item->>'topicKey')) < 1
       or char_length(v_item->>'topicKey') > 160 then
      return false;
    end if;

    for v_source_id in select value from jsonb_array_elements(v_item->'sourceIds') loop
      if jsonb_typeof(v_source_id) <> 'string'
         or char_length(btrim(v_source_id #>> '{}')) < 1
         or char_length(v_source_id #>> '{}') > 200 then
        return false;
      end if;
    end loop;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

revoke execute on function runtime_policy_candidate_body_is_valid(jsonb)
  from public, anonymous, authenticated;

create or replace function runtime_policy_current_source_state(
  p_tenant_id text,
  p_location_id text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select jsonb_build_object(
    'answers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'answer', answer.answer,
          'approvalStatus', answer.approval_status,
          'id', answer.id,
          'locationId', answer.location_id,
          'runtimeBehavior', answer.runtime_behavior,
          'topic', answer.topic
        ) order by answer.id
      )
        from public.answer_bank_entries answer
       where answer.tenant_id = location.tenant_id
         and answer.approval_status <> 'retired'
         and (answer.location_id is null or answer.location_id = location.id)
    ), '[]'::jsonb),
    'handoffs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'action', handoff.action,
          'activeWindow', handoff.active_window,
          'destination', handoff.destination,
          'id', handoff.id,
          'locationId', handoff.location_id,
          'priority', handoff.priority,
          'topic', handoff.topic,
          'trigger', handoff.trigger
        ) order by handoff.priority, handoff.id
      )
        from public.handoff_rules handoff
       where handoff.tenant_id = location.tenant_id
         and handoff.status = 'active'
         and (handoff.location_id is null or handoff.location_id = location.id)
    ), '[]'::jsonb),
    'location', jsonb_build_object(
      'id', location.id,
      'status', location.status,
      'tenantId', location.tenant_id
    ),
    'tenantId', location.tenant_id
  )
    from public.locations location
   where location.tenant_id = p_tenant_id
     and location.id = p_location_id;
$$;

revoke execute on function runtime_policy_current_source_state(text, text)
  from public, anonymous, authenticated;

create table runtime_policy_snapshots (
  id text primary key default ('runtime_policy_snapshot_' || gen_random_uuid()::text),
  tenant_id text not null references tenants(id),
  location_id text not null,
  schema_version integer not null check (schema_version = 1),
  compiler_revision integer not null check (compiler_revision = 1),
  snapshot_version bigint not null check (snapshot_version > 0),
  source_digest text not null check (source_digest ~ '^[a-f0-9]{64}$'),
  policy_body jsonb not null check (runtime_policy_candidate_body_is_valid(policy_body)),
  policy_digest text generated always as (
    encode(public.digest(policy_body::text, 'sha256'), 'hex')
  ) stored,
  answer_topic_count integer generated always as (
    jsonb_array_length(policy_body->'answerTopics')
  ) stored,
  handoff_count integer generated always as (
    jsonb_array_length(policy_body->'handoffs')
  ) stored,
  warning_count integer generated always as (
    jsonb_array_length(policy_body->'warnings')
  ) stored,
  compiled_by_user_id text not null,
  creation_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, location_id, snapshot_version),
  unique (tenant_id, location_id, id),
  unique (tenant_id, creation_key),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, compiled_by_user_id)
    references tenant_memberships(tenant_id, user_id),
  constraint runtime_policy_creation_key_shape
    check (creation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$')
);

create index runtime_policy_snapshots_location_created_idx
  on runtime_policy_snapshots (tenant_id, location_id, created_at desc);

alter table runtime_policy_snapshots enable row level security;

create policy "owners read runtime policy candidates" on runtime_policy_snapshots
  for select using (is_active_tenant_owner(tenant_id));

revoke all on runtime_policy_snapshots from public, anonymous, authenticated;

create or replace function prevent_runtime_policy_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception 'runtime policy snapshots are immutable'
    using errcode = '55000';
end;
$$;

create trigger runtime_policy_snapshots_immutable
before update or delete on runtime_policy_snapshots
for each row execute function prevent_runtime_policy_snapshot_mutation();

revoke execute on function prevent_runtime_policy_snapshot_mutation()
  from public, anonymous, authenticated;

create or replace function runtime_policy_snapshot_summary(p_snapshot runtime_policy_snapshots)
returns jsonb
language sql
stable
set search_path = pg_catalog, pg_temp
as $$
  select jsonb_build_object(
    'id', p_snapshot.id,
    'tenant_id', p_snapshot.tenant_id,
    'location_id', p_snapshot.location_id,
    'schema_version', p_snapshot.schema_version,
    'compiler_revision', p_snapshot.compiler_revision,
    'snapshot_version', p_snapshot.snapshot_version,
    'source_digest', p_snapshot.source_digest,
    'policy_digest', p_snapshot.policy_digest,
    'answer_topic_count', p_snapshot.answer_topic_count,
    'handoff_count', p_snapshot.handoff_count,
    'warning_count', p_snapshot.warning_count,
    'created_at', p_snapshot.created_at
  );
$$;

revoke execute on function runtime_policy_snapshot_summary(runtime_policy_snapshots)
  from public, anonymous, authenticated;

create or replace function list_runtime_policy_candidate_summaries(p_tenant_id text)
returns table (
  id text,
  tenant_id text,
  location_id text,
  schema_version integer,
  compiler_revision integer,
  snapshot_version bigint,
  source_digest text,
  policy_digest text,
  answer_topic_count integer,
  handoff_count integer,
  warning_count integer,
  candidate_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  with ranked as (
    select snapshot.id,
           snapshot.tenant_id,
           snapshot.location_id,
           snapshot.schema_version,
           snapshot.compiler_revision,
           snapshot.snapshot_version,
           snapshot.source_digest,
           snapshot.policy_digest,
           snapshot.answer_topic_count,
           snapshot.handoff_count,
           snapshot.warning_count,
           snapshot.created_at,
           count(*) over (partition by snapshot.location_id) as candidate_count,
           row_number() over (
             partition by snapshot.location_id
             order by snapshot.snapshot_version desc
           ) as location_rank
     from public.runtime_policy_snapshots snapshot
     where snapshot.tenant_id = p_tenant_id
       and public.is_active_tenant_owner(p_tenant_id)
  )
  select ranked.id,
         ranked.tenant_id,
         ranked.location_id,
         ranked.schema_version,
         ranked.compiler_revision,
         ranked.snapshot_version,
         ranked.source_digest,
         ranked.policy_digest,
         ranked.answer_topic_count,
         ranked.handoff_count,
         ranked.warning_count,
         ranked.candidate_count,
         ranked.created_at
    from ranked
   where ranked.location_rank = 1
   order by ranked.location_id;
$$;

revoke execute on function list_runtime_policy_candidate_summaries(text)
  from public, anonymous;
grant execute on function list_runtime_policy_candidate_summaries(text)
  to authenticated;

create table runtime_policy_candidate_intents (
  id text primary key default ('runtime_policy_intent_' || gen_random_uuid()::text),
  tenant_id text not null references tenants(id),
  location_id text not null,
  actor_user_id text not null,
  compiler_revision integer not null check (compiler_revision = 1),
  source_digest text not null check (source_digest ~ '^[a-f0-9]{64}$'),
  policy_digest text not null check (policy_digest ~ '^[a-f0-9]{64}$'),
  token_digest text not null unique check (token_digest ~ '^[a-f0-9]{64}$'),
  snapshot_id text,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, actor_user_id) references tenant_memberships(tenant_id, user_id),
  foreign key (tenant_id, location_id, snapshot_id)
    references runtime_policy_snapshots(tenant_id, location_id, id),
  unique (tenant_id, location_id, actor_user_id),
  check ((snapshot_id is null) = (consumed_at is null))
);

create index runtime_policy_candidate_intents_expiry_idx
  on runtime_policy_candidate_intents (expires_at)
  where snapshot_id is null;

alter table runtime_policy_candidate_intents enable row level security;
revoke all on runtime_policy_candidate_intents from public, anonymous, authenticated;

create or replace function issue_runtime_policy_candidate_intent(
  p_tenant_id text,
  p_location_id text,
  p_compiler_revision integer,
  p_policy_body jsonb
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_actor_user_id text;
  v_source_state jsonb;
  v_token text;
begin
  p_tenant_id := btrim(coalesce(p_tenant_id, ''));
  p_location_id := btrim(coalesce(p_location_id, ''));
  if p_tenant_id = '' or p_location_id = '' then
    raise exception 'runtime policy candidate intent scope is required'
      using errcode = '22023';
  end if;
  if p_compiler_revision <> 1 then
    raise exception 'runtime policy compiler revision must be 1'
      using errcode = '22023';
  end if;
  if not public.runtime_policy_candidate_body_is_valid(p_policy_body) then
    raise exception 'runtime policy candidate body is invalid' using errcode = '22023';
  end if;

  v_actor_user_id := public.current_app_user_id();
  if v_actor_user_id is null or not public.is_active_tenant_owner(p_tenant_id) then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  perform 1
    from public.locations
   where tenant_id = p_tenant_id
     and id = p_location_id
     and status = 'active'
   for share;
  if not found then
    raise exception 'active tenant location not found' using errcode = 'P0002';
  end if;

  v_source_state := public.runtime_policy_current_source_state(p_tenant_id, p_location_id);
  v_token := encode(public.gen_random_bytes(32), 'hex');

  insert into public.runtime_policy_candidate_intents (
    tenant_id,
    location_id,
    actor_user_id,
    compiler_revision,
    source_digest,
    policy_digest,
    token_digest,
    expires_at
  ) values (
    p_tenant_id,
    p_location_id,
    v_actor_user_id,
    p_compiler_revision,
    encode(public.digest(v_source_state::text, 'sha256'), 'hex'),
    encode(public.digest(p_policy_body::text, 'sha256'), 'hex'),
    encode(public.digest(v_token, 'sha256'), 'hex'),
    clock_timestamp() + interval '5 minutes'
  )
  on conflict (tenant_id, location_id, actor_user_id) do update
    set compiler_revision = excluded.compiler_revision,
        source_digest = excluded.source_digest,
        policy_digest = excluded.policy_digest,
        token_digest = excluded.token_digest,
        snapshot_id = null,
        expires_at = excluded.expires_at,
        consumed_at = null,
        created_at = clock_timestamp();

  return v_token;
end;
$$;

revoke execute on function issue_runtime_policy_candidate_intent(text, text, integer, jsonb)
  from public, anonymous;
grant execute on function issue_runtime_policy_candidate_intent(text, text, integer, jsonb)
  to authenticated;

create or replace function record_runtime_policy_candidate(
  p_intent_token text,
  p_policy_body jsonb,
  p_source_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_creation_key text;
  v_current_source_state jsonb;
  v_existing public.runtime_policy_snapshots;
  v_intent public.runtime_policy_candidate_intents;
  v_inserted public.runtime_policy_snapshots;
  v_location_status public.location_status;
  v_next_version bigint;
  v_source_digest text;
begin
  p_intent_token := lower(btrim(coalesce(p_intent_token, '')));
  if p_intent_token !~ '^[a-f0-9]{64}$' then
    raise exception 'runtime policy candidate intent is invalid' using errcode = '42501';
  end if;
  if not public.runtime_policy_candidate_body_is_valid(p_policy_body) then
    raise exception 'runtime policy candidate body is invalid' using errcode = '22023';
  end if;
  if p_source_state is null
     or jsonb_typeof(p_source_state) <> 'object'
     or octet_length(p_source_state::text) > 4194304 then
    raise exception 'runtime policy source state is invalid' using errcode = '22023';
  end if;

  select *
    into v_intent
    from public.runtime_policy_candidate_intents
   where token_digest = encode(public.digest(p_intent_token, 'sha256'), 'hex')
   for update;
  if not found or v_intent.expires_at <= clock_timestamp() then
    raise exception 'runtime policy candidate intent is unavailable' using errcode = '42501';
  end if;
  if v_intent.policy_digest <> encode(public.digest(p_policy_body::text, 'sha256'), 'hex') then
    raise exception 'runtime policy candidate body does not match its owner intent'
      using errcode = '22023';
  end if;

  select status
    into v_location_status
    from public.locations
   where tenant_id = v_intent.tenant_id
     and id = v_intent.location_id
   for update;
  if not found or v_location_status <> 'active' then
    raise exception 'runtime policy candidate location is unavailable'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
      from public.tenant_memberships membership
     where membership.tenant_id = v_intent.tenant_id
       and membership.user_id = v_intent.actor_user_id
       and membership.role = 'owner'
       and membership.invite_status = 'active'
  ) then
    raise exception 'runtime policy candidate owner is unavailable' using errcode = '42501';
  end if;

  v_current_source_state := public.runtime_policy_current_source_state(
    v_intent.tenant_id,
    v_intent.location_id
  );
  v_source_digest := encode(public.digest(p_source_state::text, 'sha256'), 'hex');
  if v_current_source_state <> p_source_state
     or v_intent.source_digest <> v_source_digest then
    raise exception 'runtime policy source state changed before persistence'
      using errcode = '40001';
  end if;
  v_creation_key := 'candidate:r' || v_intent.compiler_revision::text || ':' || v_source_digest;

  select *
    into v_existing
    from public.runtime_policy_snapshots
   where tenant_id = v_intent.tenant_id
     and creation_key = v_creation_key;

  if found then
    if v_existing.location_id <> v_intent.location_id
       or v_existing.schema_version <> 1
       or v_existing.compiler_revision <> v_intent.compiler_revision
       or v_existing.source_digest <> v_source_digest
       or v_existing.policy_body <> p_policy_body then
      raise exception 'creation key conflicts with different runtime policy candidate'
        using errcode = '23505';
    end if;

    update public.runtime_policy_candidate_intents
       set snapshot_id = v_existing.id,
           consumed_at = coalesce(consumed_at, now())
     where id = v_intent.id;
    return public.runtime_policy_snapshot_summary(v_existing);
  end if;

  select coalesce(max(snapshot_version), 0) + 1
    into v_next_version
    from public.runtime_policy_snapshots
   where tenant_id = v_intent.tenant_id
     and location_id = v_intent.location_id;

  insert into public.runtime_policy_snapshots (
    tenant_id,
    location_id,
    schema_version,
    compiler_revision,
    snapshot_version,
    source_digest,
    policy_body,
    compiled_by_user_id,
    creation_key
  ) values (
    v_intent.tenant_id,
    v_intent.location_id,
    1,
    v_intent.compiler_revision,
    v_next_version,
    v_source_digest,
    p_policy_body,
    v_intent.actor_user_id,
    v_creation_key
  ) returning * into v_inserted;

  insert into public.audit_events (
    id,
    tenant_id,
    actor_user_id,
    subject_type,
    subject_id,
    action,
    metadata
  ) values (
    'audit_runtime_policy_' || gen_random_uuid()::text,
    v_intent.tenant_id,
    v_intent.actor_user_id,
    'runtime_policy_snapshot',
    v_inserted.id,
    'runtime_policy.candidate_recorded',
    jsonb_build_object(
      'location_id', v_inserted.location_id,
      'schema_version', v_inserted.schema_version,
      'compiler_revision', v_inserted.compiler_revision,
      'snapshot_version', v_inserted.snapshot_version,
      'activation_state', 'not_available',
      'visibility', 'owner_only'
    )
  );

  update public.runtime_policy_candidate_intents
     set snapshot_id = v_inserted.id,
         consumed_at = now()
   where id = v_intent.id;

  return public.runtime_policy_snapshot_summary(v_inserted);
end;
$$;

revoke execute on function record_runtime_policy_candidate(text, jsonb, jsonb)
  from public, anonymous, authenticated;

do $$
declare
  v_role record;
begin
  if not exists (select 1 from pg_roles where rolname = 'outpost_policy_compiler') then
    create role outpost_policy_compiler
      nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;

  select * into v_role from pg_roles where rolname = 'outpost_policy_compiler';
  if v_role.rolcanlogin
     or v_role.rolsuper
     or v_role.rolcreatedb
     or v_role.rolcreaterole
     or v_role.rolinherit
     or v_role.rolreplication
     or v_role.rolbypassrls then
    raise exception 'outpost_policy_compiler capability role has unsafe attributes'
      using errcode = '42501';
  end if;
end
$$;

revoke all on all tables in schema public from outpost_policy_compiler;
revoke all on all sequences in schema public from outpost_policy_compiler;
grant usage on schema public to outpost_policy_compiler;
grant execute on function record_runtime_policy_candidate(text, jsonb, jsonb)
  to outpost_policy_compiler;

drop policy "members read audit events" on public.audit_events;
create policy "members read tenant-visible audit events" on public.audit_events
  for select using (
    public.is_active_tenant_owner(tenant_id)
    or (
      public.is_active_tenant_member(tenant_id)
      and coalesce(metadata->>'visibility', 'tenant') <> 'owner_only'
    )
  );
