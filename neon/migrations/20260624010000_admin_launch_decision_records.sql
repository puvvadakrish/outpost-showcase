-- Durable admin launch decision records.
-- Operator scripts append sanitized human-review metadata for launch decision
-- packets. This table does not approve public launch or enable live providers.

create table admin_launch_decision_records (
  id text primary key,
  status text not null check (status in ('admin_launch_decision_recorded')),
  decision text not null check (decision in ('reviewed_for_next_launch_slice', 'changes_requested', 'deferred')),
  reviewer_label text not null,
  review_note text not null,
  app_origin text not null,
  neon_branch_name text not null,
  launch_package_record_id text not null references admin_launch_package_records(id),
  launch_bundle_sha256 text not null check (launch_bundle_sha256 ~ '^[a-f0-9]{64}$'),
  decision_packet_sha256 text not null check (decision_packet_sha256 ~ '^[a-f0-9]{64}$'),
  decision_packet_path text not null,
  public_self_serve_launch_allowed boolean not null default false,
  launch_enablement_allowed boolean not null default false,
  summary jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint admin_launch_decision_records_public_self_serve_blocked check (
    public_self_serve_launch_allowed = false
  ),
  constraint admin_launch_decision_records_launch_enablement_blocked check (
    launch_enablement_allowed = false
  ),
  constraint admin_launch_decision_records_no_secret_labels check (
    reviewer_label !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    review_note !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    app_origin !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    neon_branch_name !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    decision_packet_path !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)'
  ),
  constraint admin_launch_decision_records_no_secret_summary check (
    summary::text !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass|signature)'
  ),
  constraint admin_launch_decision_records_unique_packet_review unique (
    decision_packet_sha256,
    reviewer_label,
    decision
  )
);

alter table admin_launch_decision_records enable row level security;

revoke all on table admin_launch_decision_records from public, anonymous, authenticated;

create or replace function list_founder_admin_launch_decision_records()
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
        'decision', decision,
        'reviewer_label', reviewer_label,
        'review_note_present', review_note <> '',
        'app_origin', app_origin,
        'neon_branch_name', neon_branch_name,
        'launch_package_record_id', launch_package_record_id,
        'launch_bundle_sha256', launch_bundle_sha256,
        'decision_packet_sha256', decision_packet_sha256,
        'decision_packet_path', decision_packet_path,
        'public_self_serve_launch_allowed', public_self_serve_launch_allowed,
        'launch_enablement_allowed', launch_enablement_allowed,
        'summary', summary,
        'recorded_at', recorded_at
      ) order by recorded_at desc, id desc), '[]'::jsonb)
    )
    from (
      select *
      from admin_launch_decision_records
      order by recorded_at desc, id desc
      limit 20
    ) recent_records
  );
end;
$$;

revoke execute on function list_founder_admin_launch_decision_records() from public, anonymous;
grant execute on function list_founder_admin_launch_decision_records() to authenticated;
