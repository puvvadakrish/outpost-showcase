import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

import {
  INGRESS_DATABASE_AUTHORITY_SQL,
  INGRESS_FUNCTION_ALLOWLIST,
  INGRESS_ROLE,
} from "../../src/server/ingress-database-authority.mjs";
import {
  POLICY_COMPILER_ROLE,
  POLICY_DATABASE_AUTHORITY_SQL,
  POLICY_FUNCTION_ALLOWLIST,
  hasExactPolicyRuntimeMembers,
} from "../../src/server/policy-database-authority.mjs";
import {
  RUNTIME_DATABASE_AUTHORITY_SQL,
  RUNTIME_FUNCTION_ALLOWLIST,
  RUNTIME_ROLE,
} from "../../src/server/runtime-database-authority.mjs";

const ADMIN_PASSWORD = process.env.PGPASSWORD ?? "postgres";
const DATABASE = process.env.PGDATABASE ?? "outpost_test";
const HOST = process.env.PGHOST ?? "localhost";
const PORT = process.env.PGPORT ?? "5432";
const TEST_SUFFIX = `${process.pid}_${randomBytes(10).toString("hex")}`;
const TEST_PASSWORD = randomBytes(18).toString("base64url");
const TEST_FUNCTION = `outpost_relation_function_${TEST_SUFFIX}`;
const TEST_ROLES = {
  ingress: `outpost_ingress_relation_${TEST_SUFFIX}`,
  policy: `outpost_policy_relation_${TEST_SUFFIX}`,
  runtime: `outpost_runtime_relation_${TEST_SUFFIX}`,
};
const TEST_SEQUENCE = `outpost_relation_sequence_${TEST_SUFFIX}`;

function runPsql({ password, sql, user }) {
  const commonArgs = [
    "--no-psqlrc",
    "--set",
    "ON_ERROR_STOP=1",
    "--quiet",
    "--tuples-only",
    "--no-align",
    "--dbname",
    DATABASE,
    "--username",
    user,
  ];
  const container = process.env.OUTPOST_PG_TEST_CONTAINER;
  const command = container ? "docker" : "psql";
  const args = container
    ? [
        "exec",
        "-i",
        "--env",
        `PGPASSWORD=${password}`,
        container,
        "psql",
        "--host",
        "127.0.0.1",
        "--port",
        "5432",
        ...commonArgs,
      ]
    : ["--host", HOST, "--port", PORT, ...commonArgs];
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: container ? process.env : { ...process.env, PGPASSWORD: password },
    input: sql,
  });

  if (result.status !== 0) {
    throw new Error(
      `psql failed for ${user}: ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }

  return result.stdout.trim();
}

function adminSql(sql) {
  return runPsql({
    password: ADMIN_PASSWORD,
    sql,
    user: process.env.PGUSER ?? "postgres",
  });
}

function assertDisposableDatabase() {
  assert.equal(
    process.env.OUTPOST_DISPOSABLE_DATABASE_CONFIRMATION,
    "capability-relation-authority",
    "Refusing relation-authority role mutation without disposable-database confirmation.",
  );
  const databaseName = adminSql("select current_database();");
  assert.match(
    databaseName,
    /(?:^test_|_test(?:_|$))/,
    `Refusing relation-authority contract against non-test database: ${databaseName}`,
  );
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function renderAuthorityQuery(query, role, functionAllowlist) {
  const allowlist = `array[${functionAllowlist.map(sqlLiteral).join(",")}]`;
  return query
    .replaceAll(/\$1\b/g, sqlLiteral(role))
    .replaceAll(/\$2\b/g, allowlist);
}

function queryAuthority({ functionAllowlist, password, query, role, user }) {
  const renderedQuery = renderAuthorityQuery(query, role, functionAllowlist);
  const output = runPsql({
    password,
    sql: `select row_to_json(authority)::text from (${renderedQuery}) authority;`,
    user,
  });
  assert.notEqual(output, "", `${user} authority query returned no row`);
  return JSON.parse(output);
}

function assertCommonAuthority(row, { capabilityField, user }) {
  assert.equal(row.session_user, user);
  assert.equal(row[capabilityField], true);
  assert.equal(row.has_elevated_attributes, false);
  assert.equal(row.has_direct_table_authority, false);
  assert.equal(row.has_schema_creation, false);
  assert.equal(row.has_exact_security_definer_functions, true);
  assert.equal(row.has_exact_role_memberships, true);
}

function queryRuntimeAuthority() {
  return queryAuthority({
    functionAllowlist: RUNTIME_FUNCTION_ALLOWLIST,
    password: TEST_PASSWORD,
    query: RUNTIME_DATABASE_AUTHORITY_SQL,
    role: RUNTIME_ROLE,
    user: TEST_ROLES.runtime,
  });
}

function queryIngressAuthority() {
  return queryAuthority({
    functionAllowlist: INGRESS_FUNCTION_ALLOWLIST,
    password: TEST_PASSWORD,
    query: INGRESS_DATABASE_AUTHORITY_SQL,
    role: INGRESS_ROLE,
    user: TEST_ROLES.ingress,
  });
}

function queryPolicyAuthority() {
  return queryAuthority({
    functionAllowlist: POLICY_FUNCTION_ALLOWLIST,
    password: TEST_PASSWORD,
    query: POLICY_DATABASE_AUTHORITY_SQL,
    role: POLICY_COMPILER_ROLE,
    user: TEST_ROLES.policy,
  });
}

function assertCleanAuthority() {
  const ingress = queryIngressAuthority();
  assertCommonAuthority(ingress, {
    capabilityField: "has_ingress_role",
    user: TEST_ROLES.ingress,
  });
  assert.equal(ingress.owns_ingress_function, false);

  const runtime = queryRuntimeAuthority();
  assertCommonAuthority(runtime, {
    capabilityField: "has_runtime_role",
    user: TEST_ROLES.runtime,
  });
  assert.equal(runtime.owns_runtime_function, false);

  const policy = queryPolicyAuthority();
  assertCommonAuthority(policy, {
    capabilityField: "has_policy_role",
    user: TEST_ROLES.policy,
  });
  assert.equal(policy.has_exact_policy_role_attributes, true);
  assert.equal(policy.owns_policy_function, false);
  assert.equal(policy.has_exact_policy_function_acl, true);
  assert.equal(policy.has_exact_runtime_role_members, true);
  assert.equal(
    hasExactPolicyRuntimeMembers({
      databaseOwnerName: policy.database_owner_name,
      members: policy.policy_role_members,
      sessionUser: policy.session_user,
    }),
    true,
  );
}

function assertRelationProbe({ anyColumn, table, user }) {
  const output = runPsql({
    password: TEST_PASSWORD,
    sql: `select json_build_object(
      'table', has_table_privilege(session_user, 'public.users', 'SELECT'),
      'anyColumn', has_any_column_privilege(session_user, 'public.users', 'SELECT')
    )::text;`,
    user,
  });
  assert.deepEqual(JSON.parse(output), { anyColumn, table });
}

function assertMaintainProbe({ maintain, user }) {
  const output = runPsql({
    password: TEST_PASSWORD,
    sql: `select has_table_privilege(
      session_user,
      'public.users',
      'MAINTAIN'
    )::text;`,
    user,
  });
  assert.equal(output, maintain ? "true" : "false");
}

function assertProductionQueriesRejectRelationAuthority() {
  assert.equal(queryIngressAuthority().has_direct_table_authority, true);
  assert.equal(queryRuntimeAuthority().has_direct_table_authority, true);
  assert.equal(queryPolicyAuthority().has_direct_table_authority, true);
}

function assertProductionQueriesRejectFunctionAuthority() {
  assert.equal(
    queryIngressAuthority().has_exact_security_definer_functions,
    false,
  );
  assert.equal(
    queryRuntimeAuthority().has_exact_security_definer_functions,
    false,
  );
  assert.equal(
    queryPolicyAuthority().has_exact_security_definer_functions,
    false,
  );
}

function cleanupRoles() {
  adminSql(`
  drop function if exists public.${TEST_FUNCTION}();
  drop sequence if exists public.${TEST_SEQUENCE};
  do $$
  declare test_role text;
  begin
    foreach test_role in array array[
      '${TEST_ROLES.ingress}',
      '${TEST_ROLES.runtime}',
      '${TEST_ROLES.policy}'
    ] loop
      if exists (select 1 from pg_roles where rolname = test_role) then
        execute format('drop owned by %I', test_role);
        execute format('drop role %I', test_role);
      end if;
    end loop;
  end
  $$;`);
}

assertDisposableDatabase();
let rolesProvisioned = false;
try {
  adminSql(`
    begin;
    create role ${TEST_ROLES.runtime}
      login password '${TEST_PASSWORD}'
      nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls;
    create role ${TEST_ROLES.policy}
      login password '${TEST_PASSWORD}'
      nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls;
    create role ${TEST_ROLES.ingress}
      login password '${TEST_PASSWORD}'
      nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls;
    grant ${INGRESS_ROLE} to ${TEST_ROLES.ingress};
    grant ${RUNTIME_ROLE} to ${TEST_ROLES.runtime};
    grant ${POLICY_COMPILER_ROLE} to ${TEST_ROLES.policy};
    commit;
  `);
  rolesProvisioned = true;
  assertCleanAuthority();

  adminSql(`
    grant select on public.users
      to ${TEST_ROLES.ingress}, ${TEST_ROLES.runtime}, ${TEST_ROLES.policy};
  `);
  assertRelationProbe({ anyColumn: true, table: true, user: TEST_ROLES.ingress });
  assertRelationProbe({ anyColumn: true, table: true, user: TEST_ROLES.runtime });
  assertRelationProbe({ anyColumn: true, table: true, user: TEST_ROLES.policy });
  assertProductionQueriesRejectRelationAuthority();

  adminSql(`
    revoke select on public.users
      from ${TEST_ROLES.ingress}, ${TEST_ROLES.runtime}, ${TEST_ROLES.policy};
  `);
  assertCleanAuthority();

  adminSql(`
    grant maintain on public.users
      to ${TEST_ROLES.ingress}, ${TEST_ROLES.runtime}, ${TEST_ROLES.policy};
  `);
  assertRelationProbe({ anyColumn: false, table: false, user: TEST_ROLES.ingress });
  assertRelationProbe({ anyColumn: false, table: false, user: TEST_ROLES.runtime });
  assertRelationProbe({ anyColumn: false, table: false, user: TEST_ROLES.policy });
  assertMaintainProbe({ maintain: true, user: TEST_ROLES.ingress });
  assertMaintainProbe({ maintain: true, user: TEST_ROLES.runtime });
  assertMaintainProbe({ maintain: true, user: TEST_ROLES.policy });
  assertProductionQueriesRejectRelationAuthority();
  adminSql(`
    revoke maintain on public.users
      from ${TEST_ROLES.ingress}, ${TEST_ROLES.runtime}, ${TEST_ROLES.policy};
  `);
  assertCleanAuthority();

  adminSql(`
    grant select (id) on public.users
      to ${TEST_ROLES.ingress}, ${TEST_ROLES.runtime}, ${TEST_ROLES.policy};
  `);
  assertRelationProbe({ anyColumn: true, table: false, user: TEST_ROLES.ingress });
  assertRelationProbe({ anyColumn: true, table: false, user: TEST_ROLES.runtime });
  assertRelationProbe({ anyColumn: true, table: false, user: TEST_ROLES.policy });
  assertProductionQueriesRejectRelationAuthority();

  adminSql(`
    revoke select (id) on public.users
      from ${TEST_ROLES.ingress}, ${TEST_ROLES.runtime}, ${TEST_ROLES.policy};
  `);
  assertCleanAuthority();

  adminSql(`
    create sequence public.${TEST_SEQUENCE};
    grant select on sequence public.${TEST_SEQUENCE}
      to ${TEST_ROLES.ingress}, ${TEST_ROLES.runtime}, ${TEST_ROLES.policy};
  `);
  assertProductionQueriesRejectRelationAuthority();
  adminSql(`
    revoke select on sequence public.${TEST_SEQUENCE}
      from ${TEST_ROLES.ingress}, ${TEST_ROLES.runtime}, ${TEST_ROLES.policy};
    drop sequence public.${TEST_SEQUENCE};
  `);
  assertCleanAuthority();

  adminSql(`
    create function public.${TEST_FUNCTION}()
    returns void
    language plpgsql
    security definer
    set search_path = pg_catalog
    as $function$
    begin
      null;
    end;
    $function$;
    revoke all on function public.${TEST_FUNCTION}() from public;
    grant execute on function public.${TEST_FUNCTION}()
      to ${TEST_ROLES.ingress}, ${TEST_ROLES.runtime}, ${TEST_ROLES.policy};
  `);
  assertProductionQueriesRejectFunctionAuthority();
  adminSql(`
    revoke execute on function public.${TEST_FUNCTION}()
      from ${TEST_ROLES.ingress}, ${TEST_ROLES.runtime}, ${TEST_ROLES.policy};
    drop function public.${TEST_FUNCTION}();
  `);
  assertCleanAuthority();
} finally {
  if (rolesProvisioned) cleanupRoles();
}

process.stdout.write(
  "Runtime, policy, and ingress production authority queries reject direct relation and function grants.\n",
);
