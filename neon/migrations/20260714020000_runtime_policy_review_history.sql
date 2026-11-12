-- Project a fixed, privacy-minimal window of append-only owner review evidence
-- for one exact immutable candidate without creating runtime authority.

create or replace function get_runtime_policy_review_history(
  p_candidate_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_candidate_id text;
  v_entries jsonb;
  v_location_id text;
  v_snapshot_version bigint;
  v_tenant_id text;
  v_total_decision_count bigint;
begin
  p_candidate_id := btrim(coalesce(p_candidate_id, ''));
  if p_candidate_id = '' then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  select candidate.id,
         candidate.tenant_id,
         candidate.location_id,
         candidate.snapshot_version
    into v_candidate_id,
         v_tenant_id,
         v_location_id,
         v_snapshot_version
    from public.runtime_policy_snapshots candidate
   where candidate.id = p_candidate_id
     and public.is_active_tenant_owner(candidate.tenant_id);
  if not found then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  select count(*),
         coalesce(
           (
             select jsonb_agg(
                      jsonb_build_object(
                        'decision', recent.decision,
                        'decision_sequence', recent.decision_sequence,
                        'created_at', recent.created_at
                      )
                      order by recent.decision_sequence desc
                    )
               from (
                 select decision_row.decision,
                        decision_row.decision_sequence,
                        decision_row.created_at
                   from public.runtime_policy_review_decisions decision_row
                  where decision_row.tenant_id = v_tenant_id
                    and decision_row.location_id = v_location_id
                    and decision_row.candidate_id = v_candidate_id
                  order by decision_row.decision_sequence desc
                  limit 5
               ) recent
           ),
           '[]'::jsonb
         )
    into v_total_decision_count, v_entries
    from public.runtime_policy_review_decisions decision_row
   where decision_row.tenant_id = v_tenant_id
     and decision_row.location_id = v_location_id
     and decision_row.candidate_id = v_candidate_id;

  return jsonb_build_object(
    'candidate_id', v_candidate_id,
    'location_id', v_location_id,
    'snapshot_version', v_snapshot_version,
    'total_decision_count', v_total_decision_count,
    'has_more', v_total_decision_count > 5,
    'entries', v_entries
  );
end;
$$;

revoke execute on function get_runtime_policy_review_history(text)
  from public, anonymous, outpost_policy_compiler;
grant execute on function get_runtime_policy_review_history(text)
  to authenticated;
