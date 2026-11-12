-- Founder-admin beta access request preflight projection.
-- This remains read-only: it does not approve, decline, fulfill, reset,
-- rollback, send invites, enable providers, or expose raw notes/secrets.

create or replace function list_founder_admin_beta_access_requests()
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
    with request_rows as (
      select
        requests.created_at,
        requests.email,
        requests.fulfilled_at,
        requests.fulfilled_grant_id,
        requests.fulfillment_note,
        requests.gym_name,
        requests.id,
        requests.last_requested_at,
        requests.location_hint,
        requests.note,
        requests.owner_name,
        requests.request_count,
        requests.status,
        requests.updated_at,
        grants.id as grant_id,
        grants.status::text as grant_status,
        app_users.id as user_id,
        app_users.external_auth_id is not null as auth_linked,
        owner_memberships.tenant_id,
        tenants.name as tenant_name,
        (
          select count(*)
            from provider_connections providers
            where providers.tenant_id = owner_memberships.tenant_id
              and (
                providers.status not in ('not_configured', 'disabled', 'pending_review')
                or providers.secret_ref is not null
                or nullif(providers.external_account_label, '') is not null
              )
        ) as unexpected_live_provider_records
      from owner_beta_access_requests requests
      left join owner_beta_access_grants grants
        on lower(grants.email::text) = lower(requests.email::text)
      left join users app_users
        on lower(app_users.email::text) = lower(requests.email::text)
      left join tenant_memberships owner_memberships
        on owner_memberships.user_id = app_users.id
       and owner_memberships.role = 'owner'
       and owner_memberships.invite_status = 'active'
      left join tenants
        on tenants.id = owner_memberships.tenant_id
      order by requests.last_requested_at desc, requests.email asc
      limit 50
    )
    select jsonb_build_object(
      'authorized', true,
      'generated_at', now(),
      'rows', coalesce(jsonb_agg(jsonb_build_object(
        'id', id,
        'email', lower(email::text),
        'owner_name', owner_name,
        'gym_name', gym_name,
        'location_hint', location_hint,
        'note_present', nullif(note, '') is not null,
        'status', status,
        'request_count', request_count,
        'created_at', created_at,
        'updated_at', updated_at,
        'last_requested_at', last_requested_at,
        'fulfillment', jsonb_build_object(
          'fulfilled', fulfilled_at is not null,
          'fulfilled_at', fulfilled_at,
          'grant_linked', fulfilled_grant_id is not null,
          'note_present', nullif(fulfillment_note, '') is not null
        ),
        'grant', jsonb_build_object(
          'present', grant_id is not null,
          'status', grant_status
        ),
        'owner_account', jsonb_build_object(
          'app_user_present', user_id is not null,
          'auth_linked', coalesce(auth_linked, false)
        ),
        'tenant_bootstrap', jsonb_build_object(
          'tenant_id', tenant_id,
          'tenant_name', tenant_name
        ),
        'provider_gate', jsonb_build_object(
          'unexpected_live_records', coalesce(unexpected_live_provider_records, 0)
        )
      ) order by last_requested_at desc, lower(email::text) asc), '[]'::jsonb)
    )
    from request_rows
  );
end;
$$;

revoke execute on function list_founder_admin_beta_access_requests() from public, anonymous;
grant execute on function list_founder_admin_beta_access_requests() to authenticated;
