-- Durable operator-assisted self-serve rehearsal records.
-- Operator scripts append sanitized completion evidence only after a reviewed
-- launch follow-through artifact has been rehearsed. This table does not
-- approve public self-serve or enable live providers.

create table operator_self_serve_rehearsal_records (
  id text primary key,
  status text not null check (status in ('operator_self_serve_rehearsal_recorded')),
  app_origin text not null,
  neon_branch_name text not null,
  launch_decision_record_id text not null references admin_launch_decision_records(id),
  followthrough_artifact_sha256 text not null unique check (followthrough_artifact_sha256 ~ '^[a-f0-9]{64}$'),
  rehearsal_packet_sha256 text not null unique check (rehearsal_packet_sha256 ~ '^[a-f0-9]{64}$'),
  rehearsal_packet_path text not null,
  operator_label text not null,
  owner_label text not null,
  gym_name text not null,
  observed_at timestamptz not null,
  public_self_serve_launch_allowed boolean not null default false,
  launch_enablement_allowed boolean not null default false,
  summary jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint operator_self_serve_rehearsal_public_self_serve_blocked check (
    public_self_serve_launch_allowed = false
  ),
  constraint operator_self_serve_rehearsal_launch_enablement_blocked check (
    launch_enablement_allowed = false
  ),
  constraint operator_self_serve_rehearsal_no_secret_labels check (
    app_origin !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)'
    and neon_branch_name !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)'
    and rehearsal_packet_path !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)'
    and operator_label !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)'
    and owner_label !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)'
    and gym_name !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)'
  ),
  constraint operator_self_serve_rehearsal_no_secret_summary check (
    summary::text !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass|signature)'
  )
);

alter table operator_self_serve_rehearsal_records enable row level security;

revoke all on table operator_self_serve_rehearsal_records from public, anonymous, authenticated;

create or replace function list_founder_admin_operator_self_serve_rehearsal_records()
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
        'launch_decision_record_id', launch_decision_record_id,
        'followthrough_artifact_sha256', followthrough_artifact_sha256,
        'rehearsal_packet_sha256', rehearsal_packet_sha256,
        'rehearsal_packet_path', rehearsal_packet_path,
        'operator_label', operator_label,
        'owner_label', owner_label,
        'gym_name', gym_name,
        'observed_at', observed_at,
        'public_self_serve_launch_allowed', public_self_serve_launch_allowed,
        'launch_enablement_allowed', launch_enablement_allowed,
        'summary', summary,
        'recorded_at', recorded_at
      ) order by recorded_at desc, id desc), '[]'::jsonb)
    )
    from (
      select *
      from operator_self_serve_rehearsal_records
      order by recorded_at desc, id desc
      limit 20
    ) recent_records
  );
end;
$$;

revoke execute on function list_founder_admin_operator_self_serve_rehearsal_records() from public, anonymous;
grant execute on function list_founder_admin_operator_self_serve_rehearsal_records() to authenticated;
