#!/usr/bin/env node

import { Pool } from "@neondatabase/serverless";
import {
  hasExactPolicyRuntimeMembers,
  POLICY_COMPILER_ROLE,
  POLICY_DATABASE_AUTHORITY_SQL,
  POLICY_FUNCTION_ALLOWLIST,
} from "../src/server/policy-database-authority.mjs";

const POLICY_DATABASE_TIMEOUT_MS = 2_000;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export async function verifyPolicyDatabaseAuthority({
  connectionString = process.env.OUTPOST_POLICY_DATABASE_URL,
} = {}) {
  invariant(connectionString, "OUTPOST_POLICY_DATABASE_URL is required.");
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: POLICY_DATABASE_TIMEOUT_MS,
    query_timeout: POLICY_DATABASE_TIMEOUT_MS,
    statement_timeout: POLICY_DATABASE_TIMEOUT_MS,
  });

  try {
    const authority = await pool.query(
      POLICY_DATABASE_AUTHORITY_SQL,
      [POLICY_COMPILER_ROLE, POLICY_FUNCTION_ALLOWLIST],
    );
    const role = authority.rows[0];

    invariant(role, "Policy database login role was not found.");
    invariant(
      role.has_policy_role,
      "Policy database login lacks the compiler capability role.",
    );
    invariant(
      role.has_exact_policy_role_attributes,
      "Policy compiler capability role has unsafe attributes.",
    );
    invariant(
      !role.has_elevated_attributes,
      "Policy database login has elevated role attributes.",
    );
    invariant(
      !role.has_direct_table_authority,
      "Policy database login has direct application-table authority.",
    );
    invariant(
      !role.has_schema_creation,
      "Policy database login can create database schemas or schema objects.",
    );
    invariant(
      !role.owns_policy_function,
      "Policy database login owns a protected policy function.",
    );
    invariant(
      role.has_exact_role_memberships,
      "Policy database login has unexpected role memberships.",
    );
    invariant(
      role.has_exact_runtime_role_members,
      "Policy database login has unexpected or executable members.",
    );
    invariant(
      hasExactPolicyRuntimeMembers({
        databaseOwnerName: role.database_owner_name,
        members: role.policy_role_members,
        sessionUser: role.session_user,
      }),
      "Policy compiler capability has unexpected or executable members.",
    );
    invariant(
      role.has_exact_security_definer_functions,
      "Policy security-definer allowlist mismatch.",
    );
    invariant(
      role.has_exact_policy_function_acl,
      "Policy security-definer function ACL mismatch.",
    );

    return {
      currentUser: role.session_user,
      verifiedFunctionCount: POLICY_FUNCTION_ALLOWLIST.length,
    };
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    const result = await verifyPolicyDatabaseAuthority();
    process.stdout.write(
      `Policy database authority verified for ${result.currentUser} (${result.verifiedFunctionCount} function).\n`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
