-- Durable hosted proof run records.
-- Operator scripts append sanitized success evidence after hosted proof checks
-- pass. The product reads only the founder-admin-gated projection below.

create table hosted_proof_runs (
  id text primary key,
  proof_kind text not null check (proof_kind in (
    'hosted_founder_admin_readiness',
    'vercel_preview_verify'
  )),
  status text not null check (status in ('passed')),
  neon_branch_name text not null,
  app_origin text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint hosted_proof_runs_no_secret_summary check (
    summary::text !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role)'
  )
);

alter table hosted_proof_runs enable row level security;

revoke all on table hosted_proof_runs from public, anonymous, authenticated;

create or replace function list_founder_admin_proof_runs()
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
        'proof_kind', proof_kind,
        'status', status,
        'neon_branch_name', neon_branch_name,
        'app_origin', app_origin,
        'started_at', started_at,
        'completed_at', completed_at,
        'summary', summary
      ) order by completed_at desc, id desc), '[]'::jsonb)
    )
    from (
      select *
      from hosted_proof_runs
      order by completed_at desc, id desc
      limit 20
    ) recent_runs
  );
end;
$$;

revoke execute on function list_founder_admin_proof_runs() from public, anonymous;
grant execute on function list_founder_admin_proof_runs() to authenticated;
