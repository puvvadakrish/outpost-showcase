import "server-only";

import { Pool } from "@neondatabase/serverless";
import {
  RUNTIME_DATABASE_AUTHORITY_SQL,
  RUNTIME_FUNCTION_ALLOWLIST,
  RUNTIME_ROLE,
} from "./runtime-database-authority.mjs";

export interface SystemDbQueryResult<Row> {
  rows: Row[];
}

export interface SystemDbClient {
  query<Row = unknown>(text: string, values?: unknown[]): Promise<SystemDbQueryResult<Row>>;
}

interface RuntimeAuthorityRow {
  session_user: string;
  has_runtime_role: boolean;
  has_elevated_attributes: boolean;
  has_direct_table_authority: boolean;
  has_schema_creation: boolean;
  owns_runtime_function: boolean;
  has_exact_security_definer_functions: boolean;
  has_exact_role_memberships: boolean;
}

export const OUTPOST_JOB_RUNTIME_ROLE = RUNTIME_ROLE;
export const OUTPOST_RUNTIME_FUNCTION_ALLOWLIST = RUNTIME_FUNCTION_ALLOWLIST;

let sharedPool: Pool | undefined;

export function getOutpostRuntimeDatabaseUrl(env: Record<string, string | undefined> = process.env) {
  return env.OUTPOST_RUNTIME_DATABASE_URL;
}

export function getSystemDbClient(env: Record<string, string | undefined> = process.env): SystemDbClient {
  const connectionString = getOutpostRuntimeDatabaseUrl(env);

  if (!connectionString) {
    throw new Error("System database is not configured. Set OUTPOST_RUNTIME_DATABASE_URL.");
  }

  sharedPool ??= new Pool({ connectionString });
  return sharedPool;
}

export async function assertSystemDbRuntimeAuthority(client: SystemDbClient) {
  const result = await client.query<RuntimeAuthorityRow>(
    RUNTIME_DATABASE_AUTHORITY_SQL,
    [OUTPOST_JOB_RUNTIME_ROLE, [...OUTPOST_RUNTIME_FUNCTION_ALLOWLIST]]
  );
  const authority = result.rows[0];

  if (
    !authority?.has_runtime_role ||
    authority.has_elevated_attributes ||
    authority.has_direct_table_authority ||
    authority.has_schema_creation ||
    authority.owns_runtime_function ||
    !authority.has_exact_role_memberships ||
    !authority.has_exact_security_definer_functions
  ) {
    throw new Error("System database connection lacks job runtime authority.");
  }

  return authority.session_user;
}
