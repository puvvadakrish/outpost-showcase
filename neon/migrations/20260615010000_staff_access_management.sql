-- Owner-managed staff access roster persistence.
-- This creates or reactivates tenant staff roster rows only. It does not send
-- invite email, create Neon Auth users, enable providers, or grant owner/admin roles.

create or replace function upsert_tenant_staff_member(
  p_tenant_id text,
  p_staff_email text,
  p_staff_name text
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
  p_staff_email := lower(btrim(p_staff_email));
  p_staff_name := btrim(p_staff_name);

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_staff_email, '') is null then
    raise exception 'staff email is required'
      using errcode = '22023';
  end if;

  if position('@' in p_staff_email) <= 1 then
    raise exception 'staff email must be valid'
      using errcode = '22023';
  end if;

  if nullif(p_staff_name, '') is null then
    raise exception 'staff name is required'
      using errcode = '22023';
  end if;

  if length(p_staff_email) > 254 then
    raise exception 'staff email must be 254 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_staff_name) > 120 then
    raise exception 'staff name must be 120 characters or fewer'
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
    into v_user
    from users
    where users.email = p_staff_email
    for update;

  if not found then
    insert into users (
      id,
      email,
      name
    ) values (
      'user_' || gen_random_uuid()::text,
      p_staff_email,
      p_staff_name
    )
    returning * into v_user;
  end if;

  select *
    into v_existing_membership
    from tenant_memberships
    where tenant_memberships.tenant_id = p_tenant_id
      and tenant_memberships.user_id = v_user.id
    for update;

  if found and v_existing_membership.role <> 'staff' then
    raise exception 'only staff memberships can be managed through staff access'
      using errcode = '42501';
  end if;

  if found then
    update users
       set name = p_staff_name,
           updated_at = now()
     where id = v_user.id
    returning * into v_user;

    update tenant_memberships
       set role = 'staff',
           invite_status = 'active',
           updated_at = now()
     where id = v_existing_membership.id
    returning * into v_membership;
  else
    insert into tenant_memberships (
      id,
      tenant_id,
      user_id,
      role,
      invite_status
    ) values (
      'member_' || gen_random_uuid()::text,
      p_tenant_id,
      v_user.id,
      'staff',
      'active'
    )
    returning * into v_membership;
  end if;

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
    'tenant_membership.staff_upserted',
    jsonb_build_object(
      'user_id', v_user.id,
      'email', v_user.email,
      'previous_invite_status', v_existing_membership.invite_status,
      'next_invite_status', v_membership.invite_status,
      'previous_role', v_existing_membership.role,
      'next_role', v_membership.role
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

revoke execute on function upsert_tenant_staff_member(text, text, text)
  from public, anonymous;
grant execute on function upsert_tenant_staff_member(text, text, text)
  to authenticated;
