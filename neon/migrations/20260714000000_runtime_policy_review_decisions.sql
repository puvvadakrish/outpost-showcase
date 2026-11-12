-- Record append-only owner review decisions for immutable runtime-policy
-- candidates without adding activation, evaluation, provider, or outbound authority.

create table runtime_policy_review_decisions (
  id text primary key default ('runtime_policy_review_' || gen_random_uuid()::text),
  tenant_id text not null references tenants(id),
  location_id text not null,
  candidate_id text not null,
  decision text not null check (decision in ('accepted', 'rejected')),
  decision_sequence bigint not null check (decision_sequence > 0),
  decided_by_user_id text not null,
  candidate_was_latest boolean not null,
  previous_decision_id text,
  creation_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, location_id, candidate_id, decision_sequence),
  unique (tenant_id, decided_by_user_id, creation_key),
  unique (tenant_id, location_id, candidate_id, id),
  foreign key (tenant_id, location_id, candidate_id)
    references runtime_policy_snapshots(tenant_id, location_id, id),
  foreign key (tenant_id, decided_by_user_id)
    references tenant_memberships(tenant_id, user_id),
  foreign key (tenant_id, location_id, candidate_id, previous_decision_id)
    references runtime_policy_review_decisions(tenant_id, location_id, candidate_id, id),
  constraint runtime_policy_review_creation_key_shape
    check (creation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$')
);

create index runtime_policy_review_decisions_candidate_created_idx
  on runtime_policy_review_decisions (
    tenant_id, location_id, candidate_id, decision_sequence desc
  );

alter table runtime_policy_review_decisions enable row level security;

create policy "owners read runtime policy review decisions"
on runtime_policy_review_decisions
  for select using (is_active_tenant_owner(tenant_id));

revoke all on runtime_policy_review_decisions
  from public, anonymous, authenticated;

create or replace function prevent_runtime_policy_review_decision_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception 'runtime policy review decisions are immutable'
    using errcode = '55000';
end;
$$;

create trigger runtime_policy_review_decisions_immutable
before update or delete on runtime_policy_review_decisions
for each row execute function prevent_runtime_policy_review_decision_mutation();

revoke execute on function prevent_runtime_policy_review_decision_mutation()
  from public, anonymous, authenticated;

create or replace function runtime_policy_review_decision_summary(
  p_decision runtime_policy_review_decisions
)
returns jsonb
language sql
stable
set search_path = pg_catalog, pg_temp
as $$
  select jsonb_build_object(
    'id', p_decision.id,
    'tenant_id', p_decision.tenant_id,
    'location_id', p_decision.location_id,
    'candidate_id', p_decision.candidate_id,
    'snapshot_version', snapshot.snapshot_version,
    'decision', p_decision.decision,
    'decision_sequence', p_decision.decision_sequence,
    'decision_count', (
      select count(*)
        from public.runtime_policy_review_decisions candidate_decision
       where candidate_decision.tenant_id = p_decision.tenant_id
         and candidate_decision.location_id = p_decision.location_id
         and candidate_decision.candidate_id = p_decision.candidate_id
    ),
    'created_at', p_decision.created_at
  )
    from public.runtime_policy_snapshots snapshot
   where snapshot.tenant_id = p_decision.tenant_id
     and snapshot.location_id = p_decision.location_id
     and snapshot.id = p_decision.candidate_id;
$$;

revoke execute on function runtime_policy_review_decision_summary(
  runtime_policy_review_decisions
) from public, anonymous, authenticated;

create or replace function append_runtime_policy_review_decision(
  p_candidate_id text,
  p_actor_user_id text,
  p_decision text,
  p_creation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_candidate public.runtime_policy_snapshots;
  v_existing public.runtime_policy_review_decisions;
  v_inserted public.runtime_policy_review_decisions;
  v_latest public.runtime_policy_review_decisions;
  v_candidate_was_latest boolean;
  v_next_sequence bigint;
begin
  p_candidate_id := btrim(coalesce(p_candidate_id, ''));
  p_actor_user_id := btrim(coalesce(p_actor_user_id, ''));
  p_decision := lower(btrim(coalesce(p_decision, '')));
  p_creation_key := btrim(coalesce(p_creation_key, ''));
  if p_candidate_id = '' or p_actor_user_id = '' then
    raise exception 'runtime policy review scope is required' using errcode = '22023';
  end if;
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'runtime policy review decision is invalid' using errcode = '22023';
  end if;
  if p_creation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'runtime policy review retry key is invalid' using errcode = '22023';
  end if;

  select *
    into v_candidate
    from public.runtime_policy_snapshots snapshot
   where snapshot.id = p_candidate_id
     and exists (
       select 1
         from public.tenant_memberships membership
        where membership.tenant_id = snapshot.tenant_id
          and membership.user_id = p_actor_user_id
          and membership.role = 'owner'
          and membership.invite_status = 'active'
     );
  if not found then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  perform 1
    from public.locations location
   where location.tenant_id = v_candidate.tenant_id
     and location.id = v_candidate.location_id
   for update;

  select *
    into v_candidate
    from public.runtime_policy_snapshots snapshot
   where snapshot.tenant_id = v_candidate.tenant_id
     and snapshot.location_id = v_candidate.location_id
     and snapshot.id = p_candidate_id
   for update;

  v_candidate_was_latest := not exists (
    select 1
      from public.runtime_policy_snapshots newer
     where newer.tenant_id = v_candidate.tenant_id
       and newer.location_id = v_candidate.location_id
       and newer.snapshot_version > v_candidate.snapshot_version
  );

  if not exists (
    select 1
      from public.tenant_memberships membership
     where membership.tenant_id = v_candidate.tenant_id
       and membership.user_id = p_actor_user_id
       and membership.role = 'owner'
       and membership.invite_status = 'active'
  ) then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  select *
    into v_existing
    from public.runtime_policy_review_decisions decision_row
   where decision_row.tenant_id = v_candidate.tenant_id
     and decision_row.decided_by_user_id = p_actor_user_id
     and decision_row.creation_key = p_creation_key;
  if found then
    if v_existing.location_id <> v_candidate.location_id
       or v_existing.candidate_id <> v_candidate.id
       or v_existing.decision <> p_decision then
      raise exception 'runtime policy review retry key conflicts with different work'
        using errcode = '23505';
    end if;
    return public.runtime_policy_review_decision_summary(v_existing);
  end if;

  select *
    into v_latest
    from public.runtime_policy_review_decisions decision_row
   where decision_row.tenant_id = v_candidate.tenant_id
     and decision_row.location_id = v_candidate.location_id
     and decision_row.candidate_id = v_candidate.id
   order by decision_row.decision_sequence desc
   limit 1;

  if found
     and v_latest.decided_by_user_id = p_actor_user_id
     and v_latest.decision = p_decision then
    return public.runtime_policy_review_decision_summary(v_latest);
  end if;

  v_next_sequence := coalesce(v_latest.decision_sequence, 0) + 1;
  insert into public.runtime_policy_review_decisions (
    tenant_id,
    location_id,
    candidate_id,
    decision,
    decision_sequence,
    decided_by_user_id,
    candidate_was_latest,
    previous_decision_id,
    creation_key
  ) values (
    v_candidate.tenant_id,
    v_candidate.location_id,
    v_candidate.id,
    p_decision,
    v_next_sequence,
    p_actor_user_id,
    v_candidate_was_latest,
    v_latest.id,
    p_creation_key
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
    'audit_runtime_policy_review_' || gen_random_uuid()::text,
    v_candidate.tenant_id,
    p_actor_user_id,
    'runtime_policy_review_decision',
    v_inserted.id,
    'runtime_policy.review_' || p_decision,
    jsonb_build_object(
      'candidate_id', v_candidate.id,
      'location_id', v_candidate.location_id,
      'snapshot_version', v_candidate.snapshot_version,
      'decision', v_inserted.decision,
      'decision_sequence', v_inserted.decision_sequence,
      'candidate_was_latest', v_inserted.candidate_was_latest,
      'has_previous_decision', v_inserted.previous_decision_id is not null,
      'execution_authority', 'not_available',
      'visibility', 'owner_only'
    )
  );

  return public.runtime_policy_review_decision_summary(v_inserted);
end;
$$;

revoke execute on function append_runtime_policy_review_decision(
  text, text, text, text
) from public, anonymous, authenticated, outpost_policy_compiler;

create or replace function record_runtime_policy_rejection(
  p_candidate_id text,
  p_creation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_actor_user_id text;
begin
  v_actor_user_id := public.current_app_user_id();
  if v_actor_user_id is null then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;
  return public.append_runtime_policy_review_decision(
    p_candidate_id,
    v_actor_user_id,
    'rejected',
    p_creation_key
  );
end;
$$;

revoke execute on function record_runtime_policy_rejection(text, text)
  from public, anonymous;
grant execute on function record_runtime_policy_rejection(text, text)
  to authenticated;

create or replace function record_runtime_policy_acceptance(
  p_candidate_id text,
  p_policy_body jsonb,
  p_source_state jsonb,
  p_creation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_candidate public.runtime_policy_snapshots;
  v_current_source_state jsonb;
  v_actor_user_id text;
  v_location_status public.location_status;
  v_source_digest text;
begin
  p_candidate_id := btrim(coalesce(p_candidate_id, ''));
  p_creation_key := btrim(coalesce(p_creation_key, ''));
  if p_candidate_id = '' then
    raise exception 'runtime policy candidate identifier is required' using errcode = '22023';
  end if;
  if p_creation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'runtime policy review retry key is invalid' using errcode = '22023';
  end if;
  if not public.runtime_policy_candidate_body_is_valid(p_policy_body) then
    raise exception 'runtime policy candidate body is invalid' using errcode = '22023';
  end if;
  if p_source_state is null
     or jsonb_typeof(p_source_state) <> 'object'
     or octet_length(p_source_state::text) > 4194304 then
    raise exception 'runtime policy source state is invalid' using errcode = '22023';
  end if;

  v_actor_user_id := public.current_app_user_id();
  select *
    into v_candidate
    from public.runtime_policy_snapshots snapshot
   where snapshot.id = p_candidate_id;
  if not found
     or v_actor_user_id is null
     or not public.is_active_tenant_owner(v_candidate.tenant_id) then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  select status
    into v_location_status
    from public.locations location
   where location.tenant_id = v_candidate.tenant_id
     and location.id = v_candidate.location_id
   for update;
  if not found or v_location_status <> 'active' then
    raise exception 'runtime policy acceptance location is unavailable'
      using errcode = '55000';
  end if;

  select *
    into v_candidate
    from public.runtime_policy_snapshots snapshot
   where snapshot.tenant_id = v_candidate.tenant_id
     and snapshot.location_id = v_candidate.location_id
     and snapshot.id = p_candidate_id
   for update;
  if not found
     or v_candidate.compiler_revision <> 1
     or v_candidate.policy_body <> p_policy_body
     or v_candidate.policy_digest <>
       encode(public.digest(p_policy_body::text, 'sha256'), 'hex') then
    raise exception 'runtime policy acceptance candidate changed or mismatched'
      using errcode = '40001';
  end if;
  if exists (
    select 1
      from public.runtime_policy_snapshots newer
     where newer.tenant_id = v_candidate.tenant_id
       and newer.location_id = v_candidate.location_id
       and newer.snapshot_version > v_candidate.snapshot_version
  ) then
    raise exception 'runtime policy acceptance requires the latest candidate'
      using errcode = '40001';
  end if;
  if not exists (
    select 1
      from public.tenant_memberships membership
     where membership.tenant_id = v_candidate.tenant_id
       and membership.user_id = v_actor_user_id
       and membership.role = 'owner'
       and membership.invite_status = 'active'
  ) then
    raise exception 'runtime policy acceptance owner is unavailable'
      using errcode = '42501';
  end if;

  v_current_source_state := public.runtime_policy_current_source_state(
    v_candidate.tenant_id,
    v_candidate.location_id
  );
  v_source_digest := encode(public.digest(p_source_state::text, 'sha256'), 'hex');
  if v_current_source_state <> p_source_state
     or v_candidate.source_digest <> v_source_digest then
    raise exception 'runtime policy source changed before acceptance'
      using errcode = '40001';
  end if;

  return public.append_runtime_policy_review_decision(
    v_candidate.id,
    v_actor_user_id,
    'accepted',
    p_creation_key
  );
end;
$$;

revoke execute on function record_runtime_policy_acceptance(text, jsonb, jsonb, text)
  from public, anonymous;
grant execute on function record_runtime_policy_acceptance(text, jsonb, jsonb, text)
  to authenticated;

create or replace function get_runtime_policy_candidate_summary(
  p_candidate_id text
)
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
  latest_decision text,
  latest_decision_at timestamptz,
  decision_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
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
         (select count(*) from public.runtime_policy_snapshots location_snapshot
           where location_snapshot.tenant_id = snapshot.tenant_id
             and location_snapshot.location_id = snapshot.location_id),
         latest_decision.decision,
         latest_decision.created_at,
         (select count(*) from public.runtime_policy_review_decisions candidate_decision
           where candidate_decision.tenant_id = snapshot.tenant_id
             and candidate_decision.location_id = snapshot.location_id
             and candidate_decision.candidate_id = snapshot.id),
         snapshot.created_at
    from public.runtime_policy_snapshots snapshot
    left join lateral (
      select decision_row.decision, decision_row.created_at
        from public.runtime_policy_review_decisions decision_row
       where decision_row.tenant_id = snapshot.tenant_id
         and decision_row.location_id = snapshot.location_id
         and decision_row.candidate_id = snapshot.id
       order by decision_row.decision_sequence desc
       limit 1
    ) latest_decision on true
   where snapshot.id = p_candidate_id
     and public.is_active_tenant_owner(snapshot.tenant_id);
$$;

revoke execute on function get_runtime_policy_candidate_summary(text)
  from public, anonymous;
grant execute on function get_runtime_policy_candidate_summary(text)
  to authenticated;

drop function list_runtime_policy_candidate_summaries(text);

create function list_runtime_policy_candidate_summaries(p_tenant_id text)
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
  latest_decision text,
  latest_decision_at timestamptz,
  decision_count bigint,
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
         latest_decision.decision,
         latest_decision.created_at,
         (select count(*) from public.runtime_policy_review_decisions candidate_decision
           where candidate_decision.tenant_id = ranked.tenant_id
             and candidate_decision.location_id = ranked.location_id
             and candidate_decision.candidate_id = ranked.id),
         ranked.created_at
    from ranked
    left join lateral (
      select decision_row.decision, decision_row.created_at
        from public.runtime_policy_review_decisions decision_row
       where decision_row.tenant_id = ranked.tenant_id
         and decision_row.location_id = ranked.location_id
         and decision_row.candidate_id = ranked.id
       order by decision_row.decision_sequence desc
       limit 1
    ) latest_decision on true
   where ranked.location_rank = 1
   order by ranked.location_id;
$$;

revoke execute on function list_runtime_policy_candidate_summaries(text)
  from public, anonymous;
grant execute on function list_runtime_policy_candidate_summaries(text)
  to authenticated;
