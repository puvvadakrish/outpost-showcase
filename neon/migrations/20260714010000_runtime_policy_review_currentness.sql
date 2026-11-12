-- Observe whether accepted owner review evidence still matches current source.
-- The result is transient, privacy-minimal, and cannot select or execute policy.

create or replace function check_runtime_policy_review_currentness(
  p_candidate_id text,
  p_policy_body jsonb,
  p_source_state jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_actor_user_id text;
  v_candidate public.runtime_policy_snapshots;
  v_checked_at timestamptz := statement_timestamp();
  v_current_source_state jsonb;
  v_latest_decision text;
  v_location_status public.location_status;
  v_source_digest text;
begin
  p_candidate_id := btrim(coalesce(p_candidate_id, ''));
  if p_candidate_id = '' then
    raise exception 'runtime policy candidate identifier is required'
      using errcode = '22023';
  end if;
  if not public.runtime_policy_candidate_body_is_valid(p_policy_body) then
    raise exception 'runtime policy candidate body is invalid'
      using errcode = '22023';
  end if;
  if p_source_state is null
     or jsonb_typeof(p_source_state) <> 'object'
     or octet_length(p_source_state::text) > 4194304 then
    raise exception 'runtime policy source state is invalid'
      using errcode = '22023';
  end if;

  v_actor_user_id := public.current_app_user_id();
  select *
    into v_candidate
    from public.runtime_policy_snapshots candidate
   where candidate.id = p_candidate_id;
  if not found
     or v_actor_user_id is null
     or not public.is_active_tenant_owner(v_candidate.tenant_id)
     or not exists (
       select 1
         from public.tenant_memberships membership
        where membership.tenant_id = v_candidate.tenant_id
          and membership.user_id = v_actor_user_id
          and membership.role = 'owner'
          and membership.invite_status = 'active'
     ) then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  select location.status
    into v_location_status
    from public.locations location
   where location.tenant_id = v_candidate.tenant_id
     and location.id = v_candidate.location_id;

  if not found
     or v_location_status <> 'active'
     or exists (
       select 1
         from public.runtime_policy_snapshots newer
        where newer.tenant_id = v_candidate.tenant_id
          and newer.location_id = v_candidate.location_id
          and newer.snapshot_version > v_candidate.snapshot_version
     ) then
    return jsonb_build_object(
      'candidate_id', v_candidate.id,
      'location_id', v_candidate.location_id,
      'outcome', 'review_required',
      'reason', 'source_or_candidate_changed',
      'checked_at', v_checked_at
    );
  end if;

  select latest_decision.decision
    into v_latest_decision
    from public.runtime_policy_review_decisions latest_decision
   where latest_decision.tenant_id = v_candidate.tenant_id
     and latest_decision.location_id = v_candidate.location_id
     and latest_decision.candidate_id = v_candidate.id
   order by latest_decision.decision_sequence desc
   limit 1;
  if not found or v_latest_decision <> 'accepted' then
    return jsonb_build_object(
      'candidate_id', v_candidate.id,
      'location_id', v_candidate.location_id,
      'outcome', 'review_required',
      'reason', 'not_accepted',
      'checked_at', v_checked_at
    );
  end if;

  v_current_source_state := public.runtime_policy_current_source_state(
    v_candidate.tenant_id,
    v_candidate.location_id
  );
  v_source_digest := encode(public.digest(p_source_state::text, 'sha256'), 'hex');
  if v_candidate.compiler_revision <> 1
     or v_candidate.policy_body <> p_policy_body
     or v_candidate.policy_digest <>
       encode(public.digest(p_policy_body::text, 'sha256'), 'hex')
     or v_current_source_state is null
     or v_current_source_state <> p_source_state
     or v_candidate.source_digest <> v_source_digest then
    return jsonb_build_object(
      'candidate_id', v_candidate.id,
      'location_id', v_candidate.location_id,
      'outcome', 'review_required',
      'reason', 'source_or_candidate_changed',
      'checked_at', v_checked_at
    );
  end if;

  return jsonb_build_object(
    'candidate_id', v_candidate.id,
    'location_id', v_candidate.location_id,
    'outcome', 'matches_current_source',
    'reason', 'accepted_exact',
    'checked_at', v_checked_at
  );
end;
$$;

revoke execute on function check_runtime_policy_review_currentness(text, jsonb, jsonb)
  from public, anonymous, outpost_policy_compiler;
grant execute on function check_runtime_policy_review_currentness(text, jsonb, jsonb)
  to authenticated;
