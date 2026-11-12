-- Restore the independent active app-admin revocation gate and deterministic
-- ordering for the founder-admin beta proof summary projection. This remains
-- read-only and does not approve public self-serve, providers, outbound
-- delivery, billing, POS, access control, or member-ledger writes.

create or replace function list_founder_admin_beta_proof_run_summary_records()
returns jsonb
language plpgsql
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

revoke all on function list_founder_admin_beta_proof_run_summary_records()
  from public, anonymous;
grant execute on function list_founder_admin_beta_proof_run_summary_records()
  to authenticated;
