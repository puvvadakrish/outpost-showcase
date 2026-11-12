#!/usr/bin/env node

import { Pool } from "@neondatabase/serverless";
import {
  INGRESS_DATABASE_AUTHORITY_SQL,
  INGRESS_FUNCTION_ALLOWLIST,
  INGRESS_ROLE,
} from "../src/server/ingress-database-authority.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export async function verifyIngressDatabaseAuthority({
  connectionString = process.env.OUTPOST_INGRESS_DATABASE_URL,
} = {}) {
  invariant(connectionString, "OUTPOST_INGRESS_DATABASE_URL is required.");
  const pool = new Pool({ connectionString });

  try {
    const result = await pool.query(
      INGRESS_DATABASE_AUTHORITY_SQL,
      [INGRESS_ROLE, INGRESS_FUNCTION_ALLOWLIST],
    );
    const authority = result.rows[0];

    invariant(authority, "Provider ingress database login role was not found.");
    invariant(
      authority.has_ingress_role &&
        !authority.has_elevated_attributes &&
        !authority.has_direct_table_authority &&
        !authority.has_schema_creation &&
        !authority.owns_ingress_function &&
        authority.has_exact_role_memberships &&
        authority.has_exact_security_definer_functions,
      "Provider ingress database connection lacks exact authority.",
    );

    return {
      currentUser: authority.session_user,
      verifiedFunctionCount: INGRESS_FUNCTION_ALLOWLIST.length,
    };
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    const result = await verifyIngressDatabaseAuthority();
    process.stdout.write(
      `Provider ingress database authority verified for ${result.currentUser} (${result.verifiedFunctionCount} functions).\n`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
