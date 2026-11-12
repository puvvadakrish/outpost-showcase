export const POLICY_COMPILER_ROLE = "outpost_policy_compiler";
export const POLICY_FUNCTION_ALLOWLIST = [
  "record_runtime_policy_candidate(text,jsonb,jsonb)",
];

export const POLICY_DATABASE_AUTHORITY_SQL = `select
  session_user,
  pg_has_role(session_user, $1, 'member') as has_policy_role,
  coalesce((
    select not capability_role.rolcanlogin
           and not capability_role.rolsuper
           and not capability_role.rolcreatedb
           and not capability_role.rolcreaterole
           and not capability_role.rolinherit
           and not capability_role.rolreplication
           and not capability_role.rolbypassrls
      from pg_roles capability_role
     where capability_role.rolname = $1
  ), false) as has_exact_policy_role_attributes,
  (roles.rolsuper or roles.rolcreatedb or roles.rolcreaterole or
   roles.rolreplication or roles.rolbypassrls) as has_elevated_attributes,
  exists (
    select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
     where namespace.nspname not in ('pg_catalog', 'information_schema')
       and namespace.nspname not like 'pg_toast%'
       and namespace.nspname not like 'pg_temp_%'
       and (
         (relation.relkind in ('r', 'p', 'v', 'm', 'f') and (
           has_table_privilege(
             session_user, relation.oid,
             'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
           )
           or has_any_column_privilege(
             session_user, relation.oid,
             'SELECT,INSERT,UPDATE,REFERENCES'
           )
         ))
         or (relation.relkind = 'S' and has_sequence_privilege(
           session_user, relation.oid, 'USAGE,SELECT,UPDATE'
         ))
       )
  ) as has_direct_table_authority,
  (
    has_database_privilege(session_user, current_database(), 'CREATE')
    or exists (
      select 1 from pg_namespace writable_namespace
       where writable_namespace.nspname not like 'pg_temp_%'
         and writable_namespace.nspname not like 'pg_toast%'
         and has_schema_privilege(session_user, writable_namespace.oid, 'CREATE')
    )
  ) as has_schema_creation,
  exists (
    select 1
      from pg_proc owned_function
      join pg_namespace owned_namespace on owned_namespace.oid = owned_function.pronamespace
     where owned_function.proowner = roles.oid
       and owned_namespace.nspname not in ('pg_catalog', 'information_schema')
       and owned_namespace.nspname not like 'pg_toast%'
       and owned_namespace.nspname not like 'pg_temp_%'
  ) as owns_policy_function,
  coalesce((
    select count(*) = cardinality($2::text[])
           and bool_and(p.oid::regprocedure::text = any($2::text[]))
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname not in ('pg_catalog', 'information_schema')
       and n.nspname not like 'pg_toast%'
       and n.nspname not like 'pg_temp_%'
       and p.prosecdef
       and has_function_privilege(session_user, p.oid, 'execute')
  ), false) as has_exact_security_definer_functions,
  coalesce((
    with expected_functions as (
      select p.oid, p.proowner, p.proacl
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where p.oid::regprocedure::text = any($2::text[])
         and n.nspname not in ('pg_catalog', 'information_schema')
         and n.nspname not like 'pg_toast%'
         and n.nspname not like 'pg_temp_%'
    ), execute_acl as (
      select expected.oid, expected.proowner, acl.grantee, acl.is_grantable
        from expected_functions expected
        cross join lateral aclexplode(
          coalesce(expected.proacl, acldefault('f', expected.proowner))
        ) acl
       where acl.privilege_type = 'EXECUTE'
    )
    select (select count(*) from expected_functions) = cardinality($2::text[])
           and count(*) = cardinality($2::text[]) * 2
           and bool_and(
             execute_acl.grantee = execute_acl.proowner
             or (
               execute_acl.grantee = (
                 select capability_role.oid from pg_roles capability_role where capability_role.rolname = $1
               )
               and not execute_acl.is_grantable
             )
           )
      from execute_acl
  ), false) as has_exact_policy_function_acl,
  coalesce((
    with recursive memberships(roleid) as (
      select membership.roleid from pg_auth_members membership where membership.member = roles.oid
      union
      select parent.roleid from pg_auth_members parent join memberships child on child.roleid = parent.member
    )
    select count(*) = 1 and bool_and(granted.rolname = $1)
      from memberships join pg_roles granted on granted.oid = memberships.roleid
  ), false) as has_exact_role_memberships,
  coalesce((
    select count(*) = 0 or (
             count(*) = 1 and bool_and(
               runtime_member_role.rolname = database_owner.rolname
               and runtime_member.admin_option
               and not runtime_member.inherit_option
               and not runtime_member.set_option
               and runtime_member_grantor.rolname = 'cloud_admin'
             )
           )
      from pg_auth_members runtime_member
      join pg_roles runtime_member_role on runtime_member_role.oid = runtime_member.member
      join pg_roles runtime_member_grantor on runtime_member_grantor.oid = runtime_member.grantor
     where runtime_member.roleid = roles.oid
  ), false) as has_exact_runtime_role_members,
  database_owner.rolname as database_owner_name,
  coalesce((
    select jsonb_agg(jsonb_build_object(
             'memberName', capability_member.member_name,
             'adminOption', capability_member.admin_option,
             'inheritOption', capability_member.inherit_option,
             'setOption', capability_member.set_option,
             'grantorName', capability_member.grantor_name
           ) order by capability_member.member_name, capability_member.grantor_name)
      from (
        select member_role.rolname as member_name,
               membership.admin_option,
               membership.inherit_option,
               membership.set_option,
               grantor_role.rolname as grantor_name
          from pg_auth_members membership
          join pg_roles capability_role on capability_role.oid = membership.roleid
          join pg_roles member_role on member_role.oid = membership.member
          join pg_roles grantor_role on grantor_role.oid = membership.grantor
         where capability_role.rolname = $1
         order by member_role.rolname, grantor_role.rolname
         limit 3
      ) capability_member
  ), '[]'::jsonb) as policy_role_members
from pg_roles roles
join pg_database database on database.datname = current_database()
join pg_roles database_owner on database_owner.oid = database.datdba
where roles.rolname = session_user`;

function isMembership(value) {
  return value !== null && typeof value === "object" &&
    typeof value.memberName === "string" &&
    typeof value.adminOption === "boolean" &&
    typeof value.inheritOption === "boolean" &&
    typeof value.setOption === "boolean" &&
    typeof value.grantorName === "string";
}

export function hasExactPolicyRuntimeMembers({
  databaseOwnerName,
  members,
  sessionUser,
}) {
  if (
    typeof databaseOwnerName !== "string" ||
    typeof sessionUser !== "string" ||
    !Array.isArray(members) ||
    members.length < 1 ||
    members.length > 2 ||
    !members.every(isMembership)
  ) {
    return false;
  }

  const runtimeMembers = members.filter((member) => member.memberName === sessionUser);
  if (
    runtimeMembers.length !== 1 ||
    runtimeMembers[0].adminOption ||
    !runtimeMembers[0].inheritOption
  ) {
    return false;
  }

  const managementMembers = members.filter((member) => member.memberName !== sessionUser);
  if (managementMembers.length === 0) return true;

  const managementMember = managementMembers[0];
  return managementMember.memberName === databaseOwnerName &&
    managementMember.grantorName === "cloud_admin" &&
    managementMember.adminOption &&
    !managementMember.inheritOption &&
    !managementMember.setOption;
}
