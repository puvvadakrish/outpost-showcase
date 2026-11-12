-- Append-only Admin customer-observed session digest records.
-- Stores sanitized artifact metadata for Admin portal visibility.
-- Does not approve public self-serve, invite delivery, providers,
-- notifications, billing, POS, access control, or member-ledger writes.

create table admin_customer_session_records (
  id text primary key,
  status text not null check (status = 'admin_customer_session_record_imported'),
  app_origin text not null,
  neon_branch_name text not null,
  gym_name text not null,
  owner_email text not null,
  owner_label text not null default '',
  operator_label text not null,
  session_record_path text not null,
  session_record_sha256 text not null unique check (session_record_sha256 ~ '^[a-f0-9]{64}$'),
  handoff_scheduling_packet_sha256 text not null check (handoff_scheduling_packet_sha256 ~ '^[a-f0-9]{64}$'),
  customer_observed_session_recorded boolean not null default true,
  customer_observed_handoff_claimed boolean not null default true,
  public_self_serve_launch_allowed boolean not null default false,
  invite_delivery_allowed boolean not null default false,
  live_provider_enablement_allowed boolean not null default false,
  billing_pos_member_writes_allowed boolean not null default false,
  observed_checks jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint admin_customer_session_records_origin_shape check (
    app_origin ~* '^https://[^/]+\.vercel\.app$'
  ),
  constraint admin_customer_session_records_customer_observed check (
    customer_observed_session_recorded = true
    and customer_observed_handoff_claimed = true
  ),
  constraint admin_customer_session_records_no_launch check (
    public_self_serve_launch_allowed = false
    and invite_delivery_allowed = false
    and live_provider_enablement_allowed = false
    and billing_pos_member_writes_allowed = false
  ),
  constraint admin_customer_session_records_no_secret_labels check (
    id !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and app_origin !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and gym_name !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and owner_email !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and owner_label !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and operator_label !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and session_record_path !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
  ),
  constraint admin_customer_session_records_no_secret_summary check (
    observed_checks::text !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass|signature)'
    and summary::text !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass|signature)'
  )
);

create index admin_customer_session_records_recorded_at_idx
  on admin_customer_session_records (recorded_at desc, id desc);

alter table admin_customer_session_records enable row level security;

revoke all on admin_customer_session_records from public, anonymous, authenticated;

create or replace function list_founder_admin_customer_session_records()
returns jsonb
language plpgsql
stable
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
  join users on users.id = app_admins.user_id
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
          'gym_name', recent_records.gym_name,
          'owner_email', recent_records.owner_email,
          'owner_label', recent_records.owner_label,
          'operator_label', recent_records.operator_label,
          'session_record_path', recent_records.session_record_path,
          'session_record_sha256', recent_records.session_record_sha256,
          'handoff_scheduling_packet_sha256', recent_records.handoff_scheduling_packet_sha256,
          'customer_observed_session_recorded', recent_records.customer_observed_session_recorded,
          'customer_observed_handoff_claimed', recent_records.customer_observed_handoff_claimed,
          'public_self_serve_launch_allowed', recent_records.public_self_serve_launch_allowed,
          'invite_delivery_allowed', recent_records.invite_delivery_allowed,
          'live_provider_enablement_allowed', recent_records.live_provider_enablement_allowed,
          'billing_pos_member_writes_allowed', recent_records.billing_pos_member_writes_allowed,
          'observed_checks', recent_records.observed_checks,
          'summary', recent_records.summary,
          'recorded_at', recent_records.recorded_at,
          'created_at', recent_records.created_at
        )
        order by recent_records.recorded_at desc, recent_records.id desc
      )
      from (
        select *
        from admin_customer_session_records
        order by recorded_at desc, id desc
        limit 20
      ) recent_records
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function list_founder_admin_customer_session_records() from public, anonymous;
grant execute on function list_founder_admin_customer_session_records() to authenticated;
