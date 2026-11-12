-- Owner beta access request queue.
-- This collects customer-safe interest from the owner sign-in page. It does
-- not create Auth users, send invites, grant access, or enable live providers.

create type owner_beta_access_request_status as enum ('new', 'reviewing', 'approved', 'declined', 'superseded');

create table owner_beta_access_requests (
  id text primary key,
  email citext not null unique,
  owner_name text not null,
  gym_name text not null,
  location_hint text not null default '',
  note text not null default '',
  status owner_beta_access_request_status not null default 'new',
  request_count integer not null default 1 check (request_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  constraint owner_beta_access_requests_email_shape check (
    email::text ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint owner_beta_access_requests_no_secret_content check (
    (owner_name || ' ' || gym_name || ' ' || location_hint || ' ' || note) !~*
      '(napi_[a-z0-9]{20,}|NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password\s*[:=]|secret\s*[:=]|token\s*[:=])'
  )
);

alter table owner_beta_access_requests enable row level security;

revoke all on table owner_beta_access_requests from public, anonymous, authenticated;

create or replace function submit_owner_beta_access_request(
  p_owner_email text,
  p_owner_name text,
  p_gym_name text,
  p_location_hint text default '',
  p_note text default '',
  p_company_website text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_owner_email, '')));
  v_gym_name text := btrim(coalesce(p_gym_name, ''));
  v_location_hint text := btrim(coalesce(p_location_hint, ''));
  v_note text := btrim(coalesce(p_note, ''));
  v_owner_name text := btrim(coalesce(p_owner_name, ''));
  v_request_id text;
begin
  if nullif(btrim(coalesce(p_company_website, '')), '') is not null then
    return jsonb_build_object('ok', true, 'status', 'received');
  end if;

  if nullif(v_email, '') is null then
    raise exception 'owner email is required'
      using errcode = '22023';
  end if;

  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'owner email must be valid'
      using errcode = '22023';
  end if;

  if nullif(v_owner_name, '') is null then
    raise exception 'owner name is required'
      using errcode = '22023';
  end if;

  if nullif(v_gym_name, '') is null then
    raise exception 'gym name is required'
      using errcode = '22023';
  end if;

  if length(v_email) > 254 then
    raise exception 'owner email must be 254 characters or fewer'
      using errcode = '22023';
  end if;

  if length(v_owner_name) > 120 then
    raise exception 'owner name must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  if length(v_gym_name) > 140 then
    raise exception 'gym name must be 140 characters or fewer'
      using errcode = '22023';
  end if;

  if length(v_location_hint) > 160 then
    raise exception 'location must be 160 characters or fewer'
      using errcode = '22023';
  end if;

  if length(v_note) > 500 then
    raise exception 'note must be 500 characters or fewer'
      using errcode = '22023';
  end if;

  if (v_owner_name || ' ' || v_gym_name || ' ' || v_location_hint || ' ' || v_note) ~*
    '(napi_[a-z0-9]{20,}|NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password\s*[:=]|secret\s*[:=]|token\s*[:=])'
  then
    raise exception 'request cannot include secrets or credentials'
      using errcode = '22023';
  end if;

  v_request_id := 'owner_beta_request_' || encode(digest(v_email, 'sha256'), 'hex');

  insert into owner_beta_access_requests (
    id,
    email,
    owner_name,
    gym_name,
    location_hint,
    note,
    status
  ) values (
    v_request_id,
    v_email::citext,
    v_owner_name,
    v_gym_name,
    v_location_hint,
    v_note,
    'new'
  )
  on conflict (email) do update
    set owner_name = excluded.owner_name,
        gym_name = excluded.gym_name,
        location_hint = excluded.location_hint,
        note = excluded.note,
        request_count = owner_beta_access_requests.request_count + 1,
        updated_at = now(),
        last_requested_at = now();

  return jsonb_build_object('ok', true, 'status', 'received');
end;
$$;

revoke execute on function submit_owner_beta_access_request(text, text, text, text, text, text) from public;
grant execute on function submit_owner_beta_access_request(text, text, text, text, text, text) to anonymous, authenticated;

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
