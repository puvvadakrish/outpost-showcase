-- Generic append-only real evidence records.
-- Stores sanitized operator-recorded evidence metadata without approving public
-- self-serve, delivery, providers, billing, POS, access-control, or member-ledger writes.

create table real_evidence_records (
  id text primary key,
  kind text not null check (kind ~ '^[a-z][a-z0-9_.:-]{1,120}$'),
  status text not null check (status ~ '^[a-z][a-z0-9_.:-]{1,120}$'),
  artifact_path text not null,
  artifact_sha256 text not null unique check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  parent_sha256 text check (parent_sha256 is null or parent_sha256 ~ '^[a-f0-9]{64}$'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  public_self_serve_launch_allowed boolean not null default false,
  invite_delivery_allowed boolean not null default false,
  live_provider_enablement_allowed boolean not null default false,
  billing_pos_member_writes_allowed boolean not null default false,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint real_evidence_records_artifact_path_shape check (
    artifact_path ~ '^artifacts/.+\.json$'
    and artifact_path !~ '(^|/)\.\.(/|$)'
  ),
  constraint real_evidence_records_blocked_gates check (
    public_self_serve_launch_allowed = false
    and invite_delivery_allowed = false
    and live_provider_enablement_allowed = false
    and billing_pos_member_writes_allowed = false
  ),
  constraint real_evidence_records_no_secret_text check (
    id !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass|signature)'
    and kind !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass|signature)'
    and status !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass|signature)'
    and artifact_path !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass|signature)'
  ),
  constraint real_evidence_records_no_secret_payload check (
    payload::text !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass|signature)'
  )
);

create index real_evidence_records_recorded_at_idx
  on real_evidence_records (recorded_at desc, id desc);

create index real_evidence_records_kind_recorded_at_idx
  on real_evidence_records (kind, recorded_at desc, id desc);

alter table real_evidence_records enable row level security;
revoke all on real_evidence_records from public, anonymous, authenticated;

create or replace function prevent_real_evidence_record_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'real_evidence_records are append-only'
    using errcode = '55000';
end;
$$;

create trigger real_evidence_records_append_only
before update or delete on real_evidence_records
for each row execute function prevent_real_evidence_record_mutation();

create or replace function list_real_evidence_records()
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
        'kind', kind,
        'status', status,
        'artifact_path', artifact_path,
        'artifact_sha256', artifact_sha256,
        'parent_sha256', parent_sha256,
        'payload', payload,
        'public_self_serve_launch_allowed', public_self_serve_launch_allowed,
        'invite_delivery_allowed', invite_delivery_allowed,
        'live_provider_enablement_allowed', live_provider_enablement_allowed,
        'billing_pos_member_writes_allowed', billing_pos_member_writes_allowed,
        'recorded_at', recorded_at,
        'created_at', created_at
      ) order by recorded_at desc, id desc), '[]'::jsonb)
    )
    from (
      select *
      from real_evidence_records
      order by recorded_at desc, id desc
      limit 50
    ) recent_records
  );
end;
$$;

revoke execute on function prevent_real_evidence_record_mutation() from public, anonymous, authenticated;
revoke execute on function list_real_evidence_records() from public, anonymous;
grant execute on function list_real_evidence_records() to authenticated;
