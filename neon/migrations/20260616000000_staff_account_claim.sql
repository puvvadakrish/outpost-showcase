-- Staff account claim for owner-managed roster rows.
-- This links an authenticated Neon Auth user to an existing active staff roster
-- row. It does not send invites, create Auth users, enable providers, or grant
-- owner/admin roles.

create or replace function claim_staff_roster_membership()
returns table (
  tenant_id text,
  tenant_name text,
  membership_id text,
  user_id text,
  email citext,
  name text,
  role membership_role,
  invite_status invite_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_auth_id uuid := auth.uid();
  v_auth_email_verified boolean;
  v_audit_event_id text := gen_random_uuid()::text;
  v_claimed_membership tenant_memberships;
  v_jwt_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_tenant tenants;
  v_user users;
begin
  if v_actor_auth_id is null then
    raise exception 'authenticated user is required'
      using errcode = '42501';
  end if;

  if v_jwt_email is null then
    raise exception 'authenticated email claim is required'
      using errcode = '42501';
  end if;

  select auth_users."emailVerified"
    into v_auth_email_verified
    from neon_auth."user" as auth_users
    where auth_users.id = v_actor_auth_id
      and lower(auth_users.email) = v_jwt_email;

  if v_auth_email_verified is not true then
    raise exception 'confirmed authenticated email claim is required'
      using errcode = '42501';
  end if;

  select *
    into v_user
    from users
    where users.email = v_jwt_email
    for update;

  if not found then
    raise exception 'staff roster membership is required before sign-in'
      using errcode = '42501';
  end if;

  if v_user.external_auth_id is not null and v_user.external_auth_id <> v_actor_auth_id then
    raise exception 'staff roster user is already linked to another authenticated account'
      using errcode = '42501';
  end if;

  select *
    into v_claimed_membership
    from tenant_memberships
    where tenant_memberships.user_id = v_user.id
      and tenant_memberships.role = 'staff'
      and tenant_memberships.invite_status = 'active'
    order by tenant_memberships.created_at asc
    limit 1
    for update;

  if not found then
    raise exception 'active staff roster membership is required before sign-in'
      using errcode = '42501';
  end if;

  update users
     set external_auth_id = v_actor_auth_id,
         updated_at = now()
   where id = v_user.id
     and (external_auth_id is null or external_auth_id = v_actor_auth_id)
  returning * into v_user;

  if not found then
    raise exception 'staff roster user is already linked to another authenticated account'
      using errcode = '42501';
  end if;

  select *
    into v_tenant
    from tenants
    where id = v_claimed_membership.tenant_id;

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
    v_claimed_membership.tenant_id,
    v_user.id,
    'tenant_membership',
    v_claimed_membership.id,
    'tenant_membership.staff_claimed',
    jsonb_build_object(
      'user_id', v_user.id,
      'email', v_user.email,
      'auth_user_id', v_actor_auth_id
    )
  );

  return query
    select
      v_claimed_membership.tenant_id,
      v_tenant.name,
      v_claimed_membership.id,
      v_user.id,
      v_user.email,
      v_user.name,
      v_claimed_membership.role,
      v_claimed_membership.invite_status;
end;
$$;

revoke execute on function claim_staff_roster_membership()
  from public, anonymous;
grant execute on function claim_staff_roster_membership()
  to authenticated;
