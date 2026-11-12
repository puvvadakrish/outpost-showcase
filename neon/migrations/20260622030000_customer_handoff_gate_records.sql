-- Durable customer-observed beta handoff gate records.
-- Operator scripts append sanitized evidence only after the final handoff gate
-- artifact passes. The product reads only the founder-admin-gated projection.

create table customer_handoff_gate_records (
  id text primary key,
  status text not null check (status in ('customer_observed_beta_handoff_gate_passed')),
  gym_name text not null,
  beta_owner_label text not null,
  participant_label text not null,
  observer_label text not null,
  app_origin text not null,
  neon_branch_name text not null,
  session_at timestamptz not null,
  gate_generated_at timestamptz not null,
  source_artifact_sha256 text not null unique check (source_artifact_sha256 ~ '^[a-f0-9]{64}$'),
  summary jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint customer_handoff_gate_records_no_secret_labels check (
    gym_name !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    beta_owner_label !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    participant_label !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)' and
    observer_label !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)'
  ),
  constraint customer_handoff_gate_records_no_secret_summary check (
    summary::text !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|authorization|credential|private[_-]?key|jwt|bypass|signature)'
  )
);

alter table customer_handoff_gate_records enable row level security;

revoke all on table customer_handoff_gate_records from public, anonymous, authenticated;

create or replace function list_founder_admin_customer_handoff_gate_records()
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
        'gym_name', gym_name,
        'beta_owner_label', beta_owner_label,
        'participant_label', participant_label,
        'observer_label', observer_label,
        'app_origin', app_origin,
        'neon_branch_name', neon_branch_name,
        'session_at', session_at,
        'gate_generated_at', gate_generated_at,
        'recorded_at', recorded_at,
        'source_artifact_sha256', source_artifact_sha256,
        'summary', summary
      ) order by recorded_at desc, id desc), '[]'::jsonb)
    )
    from (
      select *
      from customer_handoff_gate_records
      order by recorded_at desc, id desc
      limit 20
    ) recent_records
  );
end;
$$;

revoke execute on function list_founder_admin_customer_handoff_gate_records() from public, anonymous;
grant execute on function list_founder_admin_customer_handoff_gate_records() to authenticated;
