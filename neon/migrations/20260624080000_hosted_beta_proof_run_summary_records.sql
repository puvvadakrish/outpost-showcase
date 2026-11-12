-- Append-only hosted beta proof-run summary records.
-- Stores sanitized browser+request-chain proof digests for Admin portal
-- visibility. This does not approve self-serve launch, invite delivery,
-- provider activation, billing, POS, access control, or member-ledger writes.

create table hosted_beta_proof_run_summary_records (
  id text primary key,
  status text not null check (status = 'hosted_beta_proof_run_summary_recorded'),
  app_origin text not null,
  neon_branch_name text not null,
  summary_sha256 text not null unique check (summary_sha256 ~ '^[a-f0-9]{64}$'),
  browser_artifact_sha256 text not null check (browser_artifact_sha256 ~ '^[a-f0-9]{64}$'),
  chain_artifact_sha256 text not null check (chain_artifact_sha256 ~ '^[a-f0-9]{64}$'),
  browser_cleanup text not null check (browser_cleanup in ('cleanup_requested', 'retained')),
  chain_cleanup text not null check (chain_cleanup in ('cleanup_requested', 'retained')),
  public_self_serve_launch_allowed boolean not null default false,
  live_provider_enablement_allowed boolean not null default false,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint hosted_beta_proof_run_summary_records_origin_shape check (
    app_origin ~* '^https://[^/]+\.vercel\.app$'
  ),
  constraint hosted_beta_proof_run_summary_records_no_launch check (
    public_self_serve_launch_allowed = false
    and live_provider_enablement_allowed = false
  ),
  constraint hosted_beta_proof_run_summary_records_no_secret_labels check (
    id !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and app_origin !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
    and neon_branch_name !~* '(secret|token|password|api[_-]?key|cookie|service[_-]?role|bypass|jwt)'
  )
);

alter table hosted_beta_proof_run_summary_records enable row level security;
revoke all on table hosted_beta_proof_run_summary_records from public, anonymous, authenticated;

create or replace function list_founder_admin_beta_proof_run_summary_records()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  is_founder_admin boolean;
begin
  select exists (
    select 1
    from users
    join tenant_memberships memberships on memberships.user_id = users.id
    where users.external_auth_id = auth.uid()
      and memberships.role = 'founder_admin'
      and memberships.invite_status = 'active'
  )
  into is_founder_admin;

  if not coalesce(is_founder_admin, false) then
    return jsonb_build_object(
      'authorized', false,
      'generated_at', now(),
      'rows', '[]'::jsonb
    );
  end if;

  return (
    with summary_rows as (
      select
        records.id,
        records.status,
        records.app_origin,
        records.neon_branch_name,
        records.summary_sha256,
        records.browser_artifact_sha256,
        records.chain_artifact_sha256,
        records.browser_cleanup,
        records.chain_cleanup,
        records.public_self_serve_launch_allowed,
        records.live_provider_enablement_allowed,
        records.recorded_at,
        records.created_at
      from hosted_beta_proof_run_summary_records records
      order by records.recorded_at desc, records.id desc
      limit 50
    )
    select jsonb_build_object(
      'authorized', true,
      'generated_at', now(),
      'rows', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'status', status,
            'app_origin', app_origin,
            'neon_branch_name', neon_branch_name,
            'summary_sha256', summary_sha256,
            'browser_artifact_sha256', browser_artifact_sha256,
            'chain_artifact_sha256', chain_artifact_sha256,
            'browser_cleanup', browser_cleanup,
            'chain_cleanup', chain_cleanup,
            'public_self_serve_launch_allowed', public_self_serve_launch_allowed,
            'live_provider_enablement_allowed', live_provider_enablement_allowed,
            'recorded_at', recorded_at,
            'created_at', created_at
          )
          order by recorded_at desc, id desc
        ),
        '[]'::jsonb
      )
    )
    from summary_rows
  );
end;
$$;

revoke execute on function list_founder_admin_beta_proof_run_summary_records() from public, anonymous;
grant execute on function list_founder_admin_beta_proof_run_summary_records() to authenticated;
