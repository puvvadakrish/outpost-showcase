-- Append-only owner beta request follow-through outcomes.
-- Records the operator's final handling of a prepared follow-through packet.
-- This does not invite users, provision Auth accounts, enable providers,
-- approve public self-serve, billing, POS, or member-ledger writes.

create table owner_beta_access_request_followthrough_outcomes (
  id text primary key,
  request_id text not null references owner_beta_access_requests(id),
  owner_email citext not null,
  app_origin text not null,
  neon_branch_name text not null,
  outcome text not null check (
    outcome in ('operator_handoff_completed', 'followup_required', 'deferred_not_ready')
  ),
  followthrough_packet_path text not null,
  followthrough_packet_sha256 text not null check (followthrough_packet_sha256 ~ '^[a-f0-9]{64}$'),
  reviewer_label text not null,
  status text not null check (status = 'owner_beta_request_followthrough_outcome_recorded'),
  public_self_serve_launch_allowed boolean not null default false,
  launch_enablement_allowed boolean not null default false,
  review_note_present boolean not null default false,
  summary jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint owner_beta_access_request_followthrough_outcomes_email_shape check (
    owner_email::text ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint owner_beta_access_request_followthrough_outcomes_origin_shape check (
    app_origin ~* '^https://[^/]+\.vercel\.app$'
  ),
  constraint owner_beta_access_request_followthrough_outcomes_no_launch check (
    public_self_serve_launch_allowed = false and launch_enablement_allowed = false
  ),
  constraint owner_beta_access_request_followthrough_outcomes_no_secret_text check (
    id || ' ' || request_id || ' ' || owner_email::text || ' ' || app_origin || ' ' ||
    neon_branch_name || ' ' || outcome || ' ' || followthrough_packet_path || ' ' ||
    followthrough_packet_sha256 || ' ' || reviewer_label || ' ' || status !~*
    '(napi_[a-z0-9]{20,}|NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service[_-]?role|password|secret|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|jwt)'
  ),
  constraint owner_beta_access_request_followthrough_outcomes_no_secret_summary check (
    summary::text !~*
    '(napi_[a-z0-9]{20,}|NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service[_-]?role|password|secret|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|jwt)'
  )
);

create index owner_beta_access_request_followthrough_outcomes_request_idx
  on owner_beta_access_request_followthrough_outcomes (request_id, recorded_at desc);

alter table owner_beta_access_request_followthrough_outcomes enable row level security;

revoke all on table owner_beta_access_request_followthrough_outcomes from public, anonymous, authenticated;

create or replace function list_founder_admin_beta_access_request_followthrough_outcomes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_app_admin_id text;
begin
  if auth.uid() is null then
    return jsonb_build_object('authorized', false, 'generated_at', now(), 'rows', '[]'::jsonb);
  end if;

  select app_admins.id
  into v_app_admin_id
  from app_admins
  join users on users.id = app_admins.user_id
  where users.external_auth_id = auth.uid()
    and app_admins.status = 'active'
    and exists (
      select 1
      from tenant_memberships memberships
      where memberships.user_id = users.id
        and memberships.role = 'founder_admin'
        and memberships.invite_status = 'active'
    )
  limit 1;

  if v_app_admin_id is null then
    return jsonb_build_object('authorized', false, 'generated_at', now(), 'rows', '[]'::jsonb);
  end if;

  return (
    with outcome_rows as (
      select
        outcomes.id,
        outcomes.request_id,
        lower(outcomes.owner_email::text) as owner_email,
        outcomes.app_origin,
        outcomes.neon_branch_name,
        outcomes.outcome,
        outcomes.followthrough_packet_path,
        outcomes.followthrough_packet_sha256,
        outcomes.reviewer_label,
        outcomes.status,
        outcomes.public_self_serve_launch_allowed,
        outcomes.launch_enablement_allowed,
        outcomes.review_note_present,
        outcomes.summary,
        outcomes.recorded_at,
        outcomes.created_at
      from owner_beta_access_request_followthrough_outcomes outcomes
      order by outcomes.recorded_at desc, outcomes.id desc
      limit 100
    )
    select jsonb_build_object(
      'authorized', true,
      'generated_at', now(),
      'rows', coalesce(jsonb_agg(jsonb_build_object(
        'id', id,
        'request_id', request_id,
        'owner_email', owner_email,
        'app_origin', app_origin,
        'neon_branch_name', neon_branch_name,
        'outcome', outcome,
        'followthrough_packet_path', followthrough_packet_path,
        'followthrough_packet_sha256', followthrough_packet_sha256,
        'reviewer_label', reviewer_label,
        'status', status,
        'public_self_serve_launch_allowed', public_self_serve_launch_allowed,
        'launch_enablement_allowed', launch_enablement_allowed,
        'review_note_present', review_note_present,
        'summary', summary,
        'recorded_at', recorded_at,
        'created_at', created_at
      ) order by recorded_at desc, id desc), '[]'::jsonb)
    )
    from outcome_rows
  );
end;
$$;

revoke execute on function list_founder_admin_beta_access_request_followthrough_outcomes() from public, anonymous;
grant execute on function list_founder_admin_beta_access_request_followthrough_outcomes() to authenticated;
