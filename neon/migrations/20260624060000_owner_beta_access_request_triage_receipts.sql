-- Append-only owner beta access request triage receipts.
-- Records human review before any separate operator fulfillment. This does not
-- approve, decline, fulfill, invite, provision Auth users, or enable providers.

create table owner_beta_access_request_triage_receipts (
  id text primary key,
  request_id text not null references owner_beta_access_requests(id),
  owner_email citext not null,
  app_origin text not null,
  neon_branch_name text not null,
  decision text not null check (decision in ('ready_for_operator_fulfillment', 'needs_followup', 'not_a_fit')),
  packet_path text not null,
  packet_sha256 text not null check (packet_sha256 ~ '^[a-f0-9]{64}$'),
  reviewer_label text not null,
  status text not null check (status = 'owner_beta_request_triage_recorded'),
  public_self_serve_launch_allowed boolean not null default false,
  launch_enablement_allowed boolean not null default false,
  review_note_present boolean not null default false,
  summary jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint owner_beta_access_request_triage_receipts_email_shape
    check (owner_email::text ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint owner_beta_access_request_triage_receipts_origin_shape
    check (app_origin ~* '^https://[^/]+\.vercel\.app$'),
  constraint owner_beta_access_request_triage_receipts_no_launch
    check (public_self_serve_launch_allowed = false and launch_enablement_allowed = false),
  constraint owner_beta_access_request_triage_receipts_no_secret_text
    check (
      (id || ' ' || request_id || ' ' || owner_email::text || ' ' || app_origin || ' ' ||
       neon_branch_name || ' ' || decision || ' ' || packet_path || ' ' || reviewer_label ||
       ' ' || summary::text) !~*
      '(napi_[a-z0-9]{20,}|NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service[_-]?role|password\s*[:=]|secret\s*[:=]|token\s*[:=]|cookie\s*[:=]|api[_-]?key\s*[:=]|authorization\s*[:=]|credential\s*[:=]|private[_-]?key\s*[:=]|jwt\s*[:=])'
    )
);

create index owner_beta_access_request_triage_receipts_request_idx
  on owner_beta_access_request_triage_receipts (request_id, recorded_at desc);

alter table owner_beta_access_request_triage_receipts enable row level security;

revoke all on table owner_beta_access_request_triage_receipts from public, anonymous, authenticated;

create or replace function list_founder_admin_beta_access_request_triage_receipts()
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
    with receipt_rows as (
      select
        receipts.id,
        receipts.request_id,
        lower(receipts.owner_email::text) as owner_email,
        receipts.app_origin,
        receipts.neon_branch_name,
        receipts.decision,
        receipts.packet_path,
        receipts.packet_sha256,
        receipts.reviewer_label,
        receipts.status,
        receipts.public_self_serve_launch_allowed,
        receipts.launch_enablement_allowed,
        receipts.review_note_present,
        receipts.summary,
        receipts.recorded_at,
        receipts.created_at
      from owner_beta_access_request_triage_receipts receipts
      order by receipts.recorded_at desc, receipts.id desc
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
        'decision', decision,
        'packet_path', packet_path,
        'packet_sha256', packet_sha256,
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
    from receipt_rows
  );
end;
$$;

revoke execute on function list_founder_admin_beta_access_request_triage_receipts() from public, anonymous;
grant execute on function list_founder_admin_beta_access_request_triage_receipts() to authenticated;
