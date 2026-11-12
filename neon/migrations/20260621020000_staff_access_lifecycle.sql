-- Owner-managed staff access lifecycle controls.
-- This disables roster memberships only. It does not delete users, create or
-- remove Neon Auth users, send invite email, enable providers, or grant roles.

create or replace function disable_tenant_staff_member(
  p_tenant_id text,
  p_membership_id text
)
returns table (
  membership_id text,
  user_id text,
  email citext,
  name text,
  role membership_role,
  invite_status invite_status,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_existing_membership tenant_memberships;
  v_membership tenant_memberships;
  v_user users;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_membership_id := btrim(p_membership_id);

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_membership_id, '') is null then
    raise exception 'staff membership identifier is required'
      using errcode = '22023';
  end if;

  if not is_active_tenant_owner(p_tenant_id) then
    raise exception 'active tenant owner membership required for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  select current_app_user_id() into v_actor_user_id;

  if v_actor_user_id is null then
    raise exception 'authenticated application user is required'
      using errcode = '42501';
  end if;

  select *
    into v_existing_membership
    from tenant_memberships
    where tenant_memberships.tenant_id = p_tenant_id
      and tenant_memberships.id = p_membership_id
    for update;

  if not found or v_existing_membership.role <> 'staff' then
    raise exception 'tenant staff membership is required'
      using errcode = '42501';
  end if;

  select *
    into v_user
    from users
    where users.id = v_existing_membership.user_id
    for update;

  if not found then
    raise exception 'staff user row is required'
      using errcode = '23503';
  end if;

  if v_existing_membership.invite_status = 'disabled' then
    return query
      select
        v_existing_membership.id as membership_id,
        v_user.id as user_id,
        v_user.email as email,
        v_user.name as name,
        v_existing_membership.role as role,
        v_existing_membership.invite_status as invite_status,
        v_existing_membership.created_at as created_at,
        v_existing_membership.updated_at as updated_at;
    return;
  end if;

  update tenant_memberships
     set invite_status = 'disabled',
         updated_at = now()
   where id = v_existing_membership.id
  returning * into v_membership;

  insert into audit_events (
    id,
    tenant_id,
    actor_user_id,
    subject_type,
    subject_id,
    action,
    metadata
  ) values (
    v_audit_event_id,
    p_tenant_id,
    v_actor_user_id,
    'tenant_membership',
    v_membership.id,
    'tenant_membership.staff_disabled',
    jsonb_build_object(
      'user_id', v_user.id,
      'email', v_user.email,
      'previous_invite_status', v_existing_membership.invite_status,
      'next_invite_status', v_membership.invite_status,
      'role', v_membership.role
    )
  );

  return query
    select
      v_membership.id as membership_id,
      v_user.id as user_id,
      v_user.email as email,
      v_user.name as name,
      v_membership.role as role,
      v_membership.invite_status as invite_status,
      v_membership.created_at as created_at,
      v_membership.updated_at as updated_at;
end;
$$;

revoke execute on function disable_tenant_staff_member(text, text)
  from public, anonymous;
grant execute on function disable_tenant_staff_member(text, text)
  to authenticated;
