export const INGRESS_ROLE = "outpost_provider_ingress";
export const INGRESS_FUNCTION_ALLOWLIST = [
  "accept_provider_ingress_event(text,text,text,text,text,jsonb,timestamp with time zone)",
  "resolve_provider_ingress_connection(text,text)",
];

export const INGRESS_DATABASE_AUTHORITY_SQL = `select
  session_user,
  pg_has_role(session_user, $1, 'member') as has_ingress_role,
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
             session_user,
             relation.oid,
             'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
           )
           or has_any_column_privilege(
             session_user,
             relation.oid,
             'SELECT,INSERT,UPDATE,REFERENCES'
           )
         ))
         or (relation.relkind = 'S' and has_sequence_privilege(
           session_user,
           relation.oid,
           'USAGE,SELECT,UPDATE'
         ))
       )
  ) as has_direct_table_authority,
  (
    has_database_privilege(session_user, current_database(), 'CREATE')
    or exists (
      select 1
        from pg_namespace writable_namespace
       where writable_namespace.nspname not like 'pg_temp_%'
         and writable_namespace.nspname not like 'pg_toast%'
         and has_schema_privilege(session_user, writable_namespace.oid, 'CREATE')
    )
  ) as has_schema_creation,
  exists (
    select 1
      from pg_proc owned_function
      join pg_namespace owned_namespace
        on owned_namespace.oid = owned_function.pronamespace
     where owned_function.proowner = roles.oid
       and owned_namespace.nspname not in ('pg_catalog', 'information_schema')
       and owned_namespace.nspname not like 'pg_toast%'
       and owned_namespace.nspname not like 'pg_temp_%'
  ) as owns_ingress_function,
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
    with recursive memberships(roleid) as (
      select membership.roleid
        from pg_auth_members membership
       where membership.member = roles.oid
      union
      select parent.roleid
        from pg_auth_members parent
        join memberships child on child.roleid = parent.member
    )
    select count(*) = 1 and bool_and(granted.rolname = $1)
      from memberships
      join pg_roles granted on granted.oid = memberships.roleid
  ), false) as has_exact_role_memberships
from pg_roles roles
where roles.rolname = session_user`;
