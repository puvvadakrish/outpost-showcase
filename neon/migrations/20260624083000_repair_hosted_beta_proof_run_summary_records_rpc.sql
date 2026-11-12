-- Repair founder-admin hosted beta proof-run summary projection for branches
-- that already applied 20260624080000 before the users/tenant_memberships
-- schema names were corrected. This remains read-only and does not approve
-- public self-serve, providers, billing, POS, access control, or member-ledger
-- writes.
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
        ),
        '[]'::jsonb
      )
    )
    from summary_rows
  );
end;
$$;

revoke all on function list_founder_admin_beta_proof_run_summary_records() from public, anonymous;
grant execute on function list_founder_admin_beta_proof_run_summary_records() to authenticated;
