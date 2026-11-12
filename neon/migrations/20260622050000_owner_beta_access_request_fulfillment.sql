-- Operator-only owner beta access request fulfillment metadata.
-- The app remains read-only for this state; mutation is performed by hosted
-- operator CLI using Neon project credentials outside the web runtime.

alter table owner_beta_access_requests
  add column fulfilled_at timestamptz,
  add column fulfilled_grant_id text references owner_beta_access_grants(id),
  add column fulfillment_note text not null default '',
  add constraint owner_beta_access_requests_fulfillment_state check (
    (
      fulfilled_at is null
      and fulfilled_grant_id is null
    )
    or (
      fulfilled_at is not null
      and fulfilled_grant_id is not null
      and status in ('approved', 'superseded')
    )
  ),
  add constraint owner_beta_access_requests_fulfillment_note_no_secret check (
    fulfillment_note !~*
      '(napi_[a-z0-9]{20,}|NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password\s*[:=]|secret\s*[:=]|token\s*[:=])'
  );

create or replace function preserve_fulfilled_owner_beta_access_request_details()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.fulfilled_at is not null then
    new.email := old.email;
    new.owner_name := old.owner_name;
    new.gym_name := old.gym_name;
    new.location_hint := old.location_hint;
    new.note := old.note;
    new.fulfilled_at := old.fulfilled_at;
    new.fulfilled_grant_id := old.fulfilled_grant_id;
    new.fulfillment_note := old.fulfillment_note;
  end if;

  return new;
end;
$$;

create trigger preserve_fulfilled_owner_beta_access_request_details
before update on owner_beta_access_requests
for each row
execute function preserve_fulfilled_owner_beta_access_request_details();

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
        tenants.name as tenant_name
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
        )
      ) order by last_requested_at desc, lower(email::text) asc), '[]'::jsonb)
    )
    from request_rows
  );
end;
$$;

revoke execute on function list_founder_admin_beta_access_requests() from public, anonymous;
grant execute on function list_founder_admin_beta_access_requests() to authenticated;
