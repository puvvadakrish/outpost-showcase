-- Durable admin launch package records.
-- Operator scripts append sanitized evidence only after launch-readiness bundle
-- and owner handoff message artifacts have been reviewed. The product reads
-- only the founder-admin-gated projection.

create table admin_launch_package_records (
  id text primary key,
  status text not null check (status in ('admin_launch_package_recorded')),
  app_origin text not null,
  neon_branch_name text not null,
  gym_name text not null,
  owner_label text not null,
  launch_bundle_sha256 text not null check (launch_bundle_sha256 ~ '^[a-f0-9]{64}$'),
  owner_message_sha256 text not null check (owner_message_sha256 ~ '^[a-f0-9]{64}$'),
  launch_bundle_path text not null,
  owner_message_path text not null,
  customer_handoff_recorded boolean not null,
  public_self_serve_launch_allowed boolean not null default false,
  summary jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint admin_launch_package_records_public_self_serve_blocked check (
    public_self_serve_launch_allowed = false
  ),
  constraint admin_launch_package_records_no_secret_labels check (
    app_origin !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    neon_branch_name !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    gym_name !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    owner_label !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    launch_bundle_path !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    owner_message_path !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)'
  ),
  constraint admin_launch_package_records_no_secret_summary check (
    summary::text !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass|signature)'
  ),
  constraint admin_launch_package_records_unique_artifact_pair unique (
    launch_bundle_sha256,
    owner_message_sha256
  )
);

alter table admin_launch_package_records enable row level security;

revoke all on table admin_launch_package_records from public, anonymous, authenticated;

create or replace function list_founder_admin_launch_package_records()
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
    return jsonb_build_object(
      'authorized', false,
      'generated_at', now(),
      'rows', '[]'::jsonb
    );
  end if;

  return (
    select jsonb_build_object(
      'authorized', true,
      'generated_at', now(),
      'rows', coalesce(jsonb_agg(jsonb_build_object(
        'id', id,
        'status', status,
        'app_origin', app_origin,
        'neon_branch_name', neon_branch_name,
        'gym_name', gym_name,
        'owner_label', owner_label,
        'launch_bundle_sha256', launch_bundle_sha256,
        'owner_message_sha256', owner_message_sha256,
        'launch_bundle_path', launch_bundle_path,
        'owner_message_path', owner_message_path,
        'customer_handoff_recorded', customer_handoff_recorded,
        'public_self_serve_launch_allowed', public_self_serve_launch_allowed,
        'summary', summary,
        'recorded_at', recorded_at
      ) order by recorded_at desc, id desc), '[]'::jsonb)
    )
    from (
      select *
      from admin_launch_package_records
      order by recorded_at desc, id desc
      limit 20
    ) recent_records
  );
end;
$$;

revoke execute on function list_founder_admin_launch_package_records() from public, anonymous;
grant execute on function list_founder_admin_launch_package_records() to authenticated;
