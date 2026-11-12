-- Project a fixed, privacy-minimal routing outline for one exact latest
-- immutable runtime-policy candidate without creating review or runtime authority.

create or replace function get_runtime_policy_candidate_review_manifest(
  p_candidate_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_actor_user_id text;
  v_answer_topic_count integer;
  v_answer_topics jsonb;
  v_answer_topics_has_more boolean;
  v_candidate_id text;
  v_handoff_count integer;
  v_handoffs jsonb;
  v_handoffs_has_more boolean;
  v_location_id text;
  v_policy_body jsonb;
  v_snapshot_version bigint;
begin
  p_candidate_id := btrim(coalesce(p_candidate_id, ''));
  if p_candidate_id = '' then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  v_actor_user_id := public.current_app_user_id();
  select candidate.id,
         candidate.location_id,
         candidate.snapshot_version,
         candidate.answer_topic_count,
         candidate.handoff_count,
         candidate.policy_body
    into v_candidate_id,
         v_location_id,
         v_snapshot_version,
         v_answer_topic_count,
         v_handoff_count,
         v_policy_body
    from public.runtime_policy_snapshots candidate
    join public.locations location
      on location.tenant_id = candidate.tenant_id
     and location.id = candidate.location_id
   where candidate.id = p_candidate_id
     and location.status = 'active'
     and v_actor_user_id is not null
     and public.is_active_tenant_owner(candidate.tenant_id)
     and exists (
       select 1
         from public.tenant_memberships membership
        where membership.tenant_id = candidate.tenant_id
          and membership.user_id = v_actor_user_id
          and membership.role = 'owner'
          and membership.invite_status = 'active'
     )
     and not exists (
       select 1
         from public.runtime_policy_snapshots newer
        where newer.tenant_id = candidate.tenant_id
          and newer.location_id = candidate.location_id
          and newer.snapshot_version > candidate.snapshot_version
     );
  if not found then
    raise exception 'active tenant owner required' using errcode = '42501';
  end if;

  with sampled as materialized (
    select answer.value,
           row_number() over (
             order by (answer.value->>'topicKey') collate "C", answer.ordinality
           ) as position
      from jsonb_array_elements(v_policy_body->'answerTopics')
           with ordinality answer(value, ordinality)
     order by (answer.value->>'topicKey') collate "C", answer.ordinality
     limit 11
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'topic', sampled.value->>'topic',
               'behavior', sampled.value->>'kind'
             )
             order by sampled.position
           ) filter (where sampled.position <= 10),
           '[]'::jsonb
         ),
         coalesce(bool_or(sampled.position = 11), false)
    into v_answer_topics, v_answer_topics_has_more
    from sampled;

  with sampled as materialized (
    select handoff.value,
           row_number() over (
             order by (handoff.value->>'priority')::integer, handoff.ordinality
           ) as position
      from jsonb_array_elements(v_policy_body->'handoffs')
           with ordinality handoff(value, ordinality)
     order by (handoff.value->>'priority')::integer, handoff.ordinality
     limit 11
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'priority', (sampled.value->>'priority')::integer,
               'topic', sampled.value->>'topic',
               'trigger', sampled.value->>'trigger',
               'action', sampled.value->>'action'
             )
             order by sampled.position
           ) filter (where sampled.position <= 10),
           '[]'::jsonb
         ),
         coalesce(bool_or(sampled.position = 11), false)
    into v_handoffs, v_handoffs_has_more
    from sampled;

  return jsonb_build_object(
    'candidate_id', v_candidate_id,
    'location_id', v_location_id,
    'snapshot_version', v_snapshot_version,
    'answer_topic_count', v_answer_topic_count,
    'handoff_count', v_handoff_count,
    'answer_topics', v_answer_topics,
    'answer_topics_has_more', v_answer_topics_has_more,
    'handoffs', v_handoffs,
    'handoffs_has_more', v_handoffs_has_more,
    'default_behavior', v_policy_body->'defaultPolicy'->>'kind'
  );
end;
$$;

revoke execute on function get_runtime_policy_candidate_review_manifest(text)
  from public, anonymous, outpost_policy_compiler;
grant execute on function get_runtime_policy_candidate_review_manifest(text)
  to authenticated;
