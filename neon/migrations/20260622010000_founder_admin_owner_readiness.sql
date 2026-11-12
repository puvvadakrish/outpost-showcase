-- Founder-admin beta owner readiness projection.
-- This is a read-only support console projection. It does not create accounts,
-- send invites, enable providers, execute rollback, or expose raw grant notes.

create or replace function list_founder_admin_owner_readiness()
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
    with target_grants as (
      select
        grants.email,
        grants.id,
        grants.status,
        nullif(grants.display_name, '') is not null as display_name_present,
        nullif(grants.note, '') is not null as note_present,
        grants.created_at,
        grants.updated_at
      from owner_beta_access_grants grants
      order by grants.updated_at desc, grants.email asc
      limit 25
    ),
    owner_rows as (
      select distinct on (target_grants.id)
        lower(target_grants.email::text) as owner_email,
        target_grants.id as grant_id,
        target_grants.status::text as grant_status,
        target_grants.display_name_present,
        target_grants.note_present,
        target_grants.created_at as grant_created_at,
        target_grants.updated_at as grant_updated_at,
        app_users.id as user_id,
        app_users.external_auth_id is not null as auth_linked,
        app_users.created_at as app_user_created_at,
        memberships.tenant_id,
        memberships.invite_status::text as owner_membership_status,
        tenants.name as tenant_name,
        tenants.status::text as tenant_status,
        tenants.billing_mode::text as billing_mode,
        tenants.created_at as tenant_created_at,
        (
          select count(*)
          from tenant_memberships all_memberships
          where all_memberships.user_id = app_users.id
        ) as owner_membership_count
      from target_grants
      left join users app_users
        on lower(app_users.email::text) = lower(target_grants.email::text)
      left join tenant_memberships memberships
        on memberships.user_id = app_users.id
       and memberships.role = 'owner'
       and memberships.invite_status = 'active'
      left join tenants
        on tenants.id = memberships.tenant_id
      order by target_grants.id, tenants.created_at desc nulls last
    )
    select jsonb_build_object(
      'authorized', true,
      'generated_at', now(),
      'rows', coalesce(jsonb_agg(jsonb_build_object(
        'owner_email', owner_email,
        'grant', jsonb_build_object(
          'present', grant_id is not null,
          'status', coalesce(grant_status, 'missing'),
          'display_name_present', coalesce(display_name_present, false),
          'note_present', coalesce(note_present, false),
          'created_at', grant_created_at,
          'updated_at', grant_updated_at
        ),
        'owner_account', jsonb_build_object(
          'app_user_present', user_id is not null,
          'auth_linked', coalesce(auth_linked, false),
          'created_at', app_user_created_at
        ),
        'tenant_bootstrap', jsonb_build_object(
          'tenant_id', tenant_id,
          'tenant_name', tenant_name,
          'tenant_status', tenant_status,
          'billing_mode', billing_mode,
          'owner_membership_status', owner_membership_status,
          'created_at', tenant_created_at,
          'locations_count', coalesce((select count(*) from locations where locations.tenant_id = owner_rows.tenant_id), 0),
          'manual_sources_count', coalesce((select count(*) from source_documents where source_documents.tenant_id = owner_rows.tenant_id and source_type = 'manual'), 0),
          'review_answers_count', coalesce((select count(*) from answer_bank_entries where answer_bank_entries.tenant_id = owner_rows.tenant_id and approval_status in ('draft', 'conflict')), 0),
          'open_tasks_count', coalesce((select count(*) from tasks where tasks.tenant_id = owner_rows.tenant_id and status in ('new', 'needs_human', 'in_progress')), 0)
        ),
        'provider_gate', jsonb_build_object(
          'state',
            case
              when tenant_id is null then 'blocked'
              when exists (
                select 1
                from provider_connections providers
                where providers.tenant_id = owner_rows.tenant_id
                  and (providers.secret_ref is not null or nullif(providers.external_account_label, '') is not null)
              ) then 'attention'
              else 'blocked'
            end,
          'unexpected_live_records', coalesce((
            select count(*)
            from provider_connections providers
            where providers.tenant_id = owner_rows.tenant_id
              and (providers.secret_ref is not null or nullif(providers.external_account_label, '') is not null)
          ), 0)
        ),
        'rollback_readiness', jsonb_build_object(
          'state',
            case
              when tenant_id is null then 'not_applicable'
              when tenant_id in ('tenant_acme_fitness', 'tenant_crossfit_north') then 'blocked_seeded_tenant'
              when tenant_name not like '% Dry Run %' then 'manual_review_required'
              when owner_membership_count <> 1 then 'manual_review_required'
              else 'dry_run_rollback_ready'
            end,
          'reason',
            case
              when tenant_id is null then 'No tenant has been bootstrapped for this beta owner.'
              when tenant_id in ('tenant_acme_fitness', 'tenant_crossfit_north') then 'Seeded proof tenants are never auto-rollback targets.'
              when tenant_name not like '% Dry Run %' then 'Only disposable dry-run tenants can be rollback-ready without manual review.'
              when owner_membership_count <> 1 then 'Owner has additional memberships, so rollback requires manual review.'
              else 'Disposable dry-run tenant shape matches the guarded rollback path.'
            end
        )
      ) order by grant_updated_at desc nulls last, owner_email asc), '[]'::jsonb)
    )
    from owner_rows
  );
end;
$$;

revoke execute on function list_founder_admin_owner_readiness() from public, anonymous;
grant execute on function list_founder_admin_owner_readiness() to authenticated;
