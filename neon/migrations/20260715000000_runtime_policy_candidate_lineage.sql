-- Project a fixed, privacy-minimal predecessor window for one exact latest
-- immutable runtime-policy candidate without creating review or runtime authority.

create or replace function get_runtime_policy_candidate_lineage(
  p_anchor_candidate_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_actor_user_id text;
  v_anchor_candidate_id text;
  v_anchor_snapshot_version bigint;
  v_entries jsonb;
  v_has_more boolean;
  v_location_id text;
  v_tenant_id text;
begin
  p_anchor_candidate_id := btrim(coalesce(p_anchor_candidate_id, ''));
  if p_anchor_candidate_id = '' then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  v_actor_user_id := public.current_app_user_id();
  select anchor.id,
         anchor.tenant_id,
         anchor.location_id,
         anchor.snapshot_version
    into v_anchor_candidate_id,
         v_tenant_id,
         v_location_id,
         v_anchor_snapshot_version
    from public.runtime_policy_snapshots anchor
    join public.locations location
      on location.tenant_id = anchor.tenant_id
     and location.id = anchor.location_id
   where anchor.id = p_anchor_candidate_id
     and location.status = 'active'
     and v_actor_user_id is not null
     and public.is_active_tenant_owner(anchor.tenant_id)
     and exists (
       select 1
         from public.tenant_memberships membership
        where membership.tenant_id = anchor.tenant_id
          and membership.user_id = v_actor_user_id
          and membership.role = 'owner'
          and membership.invite_status = 'active'
     )
     and not exists (
       select 1
         from public.runtime_policy_snapshots newer
        where newer.tenant_id = anchor.tenant_id
          and newer.location_id = anchor.location_id
          and newer.snapshot_version > anchor.snapshot_version
     );
  if not found then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  with sampled as materialized (
    select predecessor.snapshot_version,
           predecessor.compiler_revision,
           predecessor.created_at
      from public.runtime_policy_snapshots predecessor
     where predecessor.tenant_id = v_tenant_id
       and predecessor.location_id = v_location_id
       and predecessor.snapshot_version < v_anchor_snapshot_version
     order by predecessor.snapshot_version desc
     limit 6
  ), numbered as (
    select sampled.snapshot_version,
           sampled.compiler_revision,
           sampled.created_at,
           row_number() over (order by sampled.snapshot_version desc) as position
      from sampled
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'snapshot_version', numbered.snapshot_version,
               'compiler_revision', numbered.compiler_revision,
               'created_at', numbered.created_at
             )
             order by numbered.snapshot_version desc
           ) filter (where numbered.position <= 5),
           '[]'::jsonb
         ),
         coalesce(bool_or(numbered.position = 6), false)
    into v_entries, v_has_more
    from numbered;

  return jsonb_build_object(
    'anchor_candidate_id', v_anchor_candidate_id,
    'location_id', v_location_id,
    'anchor_snapshot_version', v_anchor_snapshot_version,
    'has_more', v_has_more,
    'entries', v_entries
  );
end;
$$;

revoke execute on function get_runtime_policy_candidate_lineage(text)
  from public, anonymous, outpost_policy_compiler;
grant execute on function get_runtime_policy_candidate_lineage(text)
  to authenticated;
