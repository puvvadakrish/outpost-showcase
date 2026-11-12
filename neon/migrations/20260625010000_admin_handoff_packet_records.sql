-- Append-only Admin handoff readiness packet records.
-- Stores sanitized packet digest metadata for Admin portal visibility.
-- This does not approve public self-serve, invite delivery, provider
-- activation, billing, POS, access control, or member-ledger writes.

create table admin_handoff_packet_records (
  id text primary key,
  status text not null check (status = 'admin_handoff_packet_recorded'),
  app_origin text not null,
  neon_branch_name text not null,
  packet_path text not null,
  packet_sha256 text not null unique check (packet_sha256 ~ '^[a-f0-9]{64}$'),
  readiness_state text not null check (readiness_state in ('action_required', 'ready')),
  proof_freshness_sha256 text not null check (proof_freshness_sha256 ~ '^[a-f0-9]{64}$'),
  next_actions_sha256 text not null check (next_actions_sha256 ~ '^[a-f0-9]{64}$'),
  launch_readiness_sha256 text not null check (launch_readiness_sha256 ~ '^[a-f0-9]{64}$'),
  public_self_serve_launch_allowed boolean not null default false,
  live_provider_enablement_allowed boolean not null default false,
  replay_verified boolean not null default false,
  reviewer_label text not null,
  review_note_present boolean not null default false,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint admin_handoff_packet_records_origin_shape check (
    app_origin ~* '^https://[^/]+\.vercel\.app$'
  ),
  constraint admin_handoff_packet_records_no_launch check (
    public_self_serve_launch_allowed = false
    and live_provider_enablement_allowed = false
  ),
  constraint admin_handoff_packet_records_no_secret_labels check (
    id !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and app_origin !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and neon_branch_name !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and packet_path !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and reviewer_label !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
  )
);

create index admin_handoff_packet_records_recorded_at_idx
  on admin_handoff_packet_records (recorded_at desc, id desc);

alter table admin_handoff_packet_records enable row level security;

revoke all on admin_handoff_packet_records from public, anonymous, authenticated;

create or replace function list_founder_admin_handoff_packet_records()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_app_admin_id text;
begin
  if v_auth_user_id is null then
    return jsonb_build_object(
      'authorized', false,
      'generated_at', now(),
      'rows', '[]'::jsonb
    );
  end if;

  select app_admins.id
    into v_app_admin_id
  from app_admins
  join users
    on users.id = app_admins.user_id
  where users.external_auth_id = v_auth_user_id
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
    return jsonb_build_object(
      'authorized', false,
      'generated_at', now(),
      'rows', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'authorized', true,
    'generated_at', now(),
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', recent_records.id,
          'status', recent_records.status,
          'app_origin', recent_records.app_origin,
          'neon_branch_name', recent_records.neon_branch_name,
          'packet_path', recent_records.packet_path,
          'packet_sha256', recent_records.packet_sha256,
          'readiness_state', recent_records.readiness_state,
          'proof_freshness_sha256', recent_records.proof_freshness_sha256,
          'next_actions_sha256', recent_records.next_actions_sha256,
          'launch_readiness_sha256', recent_records.launch_readiness_sha256,
          'public_self_serve_launch_allowed', recent_records.public_self_serve_launch_allowed,
          'live_provider_enablement_allowed', recent_records.live_provider_enablement_allowed,
          'replay_verified', recent_records.replay_verified,
          'reviewer_label', recent_records.reviewer_label,
          'review_note_present', recent_records.review_note_present,
          'recorded_at', recent_records.recorded_at,
          'created_at', recent_records.created_at
        )
        order by recent_records.recorded_at desc, recent_records.id desc
      )
      from (
        select *
        from admin_handoff_packet_records
        order by recorded_at desc, id desc
        limit 20
      ) recent_records
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function list_founder_admin_handoff_packet_records() from public, anonymous;
grant execute on function list_founder_admin_handoff_packet_records() to authenticated;
