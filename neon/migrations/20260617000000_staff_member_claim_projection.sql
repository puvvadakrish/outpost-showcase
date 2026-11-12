-- Owner-only staff-access roster projection for local beta claim handoff UI.
-- This does not grant direct users-table visibility; owners read this through
-- a tenant-scoped security-definer RPC.

create or replace function list_tenant_staff_access_members(
  p_tenant_id text
)
returns table (
  membership_id text,
  user_id text,
  email citext,
  name text,
  role membership_role,
  invite_status invite_status,
  auth_linked boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  p_tenant_id := btrim(p_tenant_id);

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if not is_active_tenant_owner(p_tenant_id) then
    raise exception 'active owner membership required for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  return query
    select
      memberships.id,
      users.id,
      users.email,
      users.name,
      memberships.role,
      memberships.invite_status,
      users.external_auth_id is not null,
      memberships.created_at,
      memberships.updated_at
    from tenant_memberships memberships
    join users on users.id = memberships.user_id
    where memberships.tenant_id = p_tenant_id
      and memberships.role = 'staff'
    order by users.name asc, users.id asc;
end;
$$;

revoke execute on function list_tenant_staff_access_members(text)
  from public, anonymous;
grant execute on function list_tenant_staff_access_members(text)
  to authenticated;

