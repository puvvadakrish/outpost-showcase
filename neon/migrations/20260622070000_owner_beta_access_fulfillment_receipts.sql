-- Append-only beta access fulfillment receipts.
-- Receipts are written only by the hosted operator CLI after request
-- fulfillment succeeds. The web app reads them only through the existing
-- admin-gated request projection.

create table owner_beta_access_fulfillment_receipts (
  id text primary key,
  request_id text not null references owner_beta_access_requests(id),
  owner_email citext not null,
  fulfilled_grant_id text not null references owner_beta_access_grants(id),
  command_name text not null check (command_name = 'beta:operator:request-fulfillment'),
  neon_branch_name text not null,
  status text not null check (status = 'recorded'),
  completed_at timestamptz not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint owner_beta_access_fulfillment_receipts_email_shape check (
    owner_email::text ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint owner_beta_access_fulfillment_receipts_no_secret_summary check (
    summary::text !~*
      '(napi_[a-z0-9]{20,}|NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service[_-]?role|password|secret|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|jwt)'
  )
);

create index owner_beta_access_fulfillment_receipts_request_idx
  on owner_beta_access_fulfillment_receipts (request_id, completed_at desc);

alter table owner_beta_access_fulfillment_receipts enable row level security;

revoke all on table owner_beta_access_fulfillment_receipts from public, anonymous, authenticated;

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
        latest_receipt.id as receipt_id,
        latest_receipt.command_name as receipt_command_name,
        latest_receipt.neon_branch_name as receipt_neon_branch_name,
        latest_receipt.status as receipt_status,
        latest_receipt.completed_at as receipt_completed_at,
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
      left join lateral (
        select
          receipts.id,
          receipts.command_name,
          receipts.neon_branch_name,
          receipts.status,
          receipts.completed_at
        from owner_beta_access_fulfillment_receipts receipts
        where receipts.request_id = requests.id
        order by receipts.completed_at desc, receipts.id desc
        limit 1
      ) latest_receipt on true
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
        'fulfillment_receipt', case
          when receipt_id is null then null
          else jsonb_build_object(
            'present', true,
            'id', receipt_id,
            'command_name', receipt_command_name,
            'neon_branch_name', receipt_neon_branch_name,
            'status', receipt_status,
            'completed_at', receipt_completed_at
          )
        end,
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
