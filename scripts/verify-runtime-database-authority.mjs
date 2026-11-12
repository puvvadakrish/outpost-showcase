#!/usr/bin/env node

import { Pool } from "@neondatabase/serverless";
import {
  RUNTIME_DATABASE_AUTHORITY_SQL,
  RUNTIME_FUNCTION_ALLOWLIST,
  RUNTIME_ROLE,
} from "../src/server/runtime-database-authority.mjs";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export async function verifyRuntimeDatabaseAuthority({
  connectionString = process.env.OUTPOST_RUNTIME_DATABASE_URL,
} = {}) {
  invariant(connectionString, "OUTPOST_RUNTIME_DATABASE_URL is required.");
  const pool = new Pool({ connectionString });

  try {
    const authority = await pool.query(RUNTIME_DATABASE_AUTHORITY_SQL, [
      RUNTIME_ROLE,
      RUNTIME_FUNCTION_ALLOWLIST,
    ]);
    const role = authority.rows[0];

    invariant(role, "Runtime database login role was not found.");
    invariant(
      role.has_runtime_role,
      "Runtime database login lacks the capability role.",
    );
    invariant(
      !role.has_elevated_attributes,
      "Runtime database login has elevated role attributes.",
    );
    invariant(
      !role.has_schema_creation,
      "Runtime database login can create database schemas or schema objects.",
    );
    invariant(
      !role.owns_runtime_function,
      "Runtime database login owns a protected runtime function.",
    );
    invariant(
      role.has_exact_role_memberships,
      "Runtime database login has unexpected role memberships.",
    );
    invariant(
      !role.has_direct_table_authority,
      "Runtime database login has direct application-table authority.",
    );
    invariant(
      role.has_exact_security_definer_functions,
      "Runtime security-definer allowlist mismatch.",
    );

    return {
      currentUser: role.session_user,
      verifiedFunctionCount: RUNTIME_FUNCTION_ALLOWLIST.length,
    };
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    const result = await verifyRuntimeDatabaseAuthority();
    process.stdout.write(
      `Runtime database authority verified for ${result.currentUser} (${result.verifiedFunctionCount} functions).\n`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
