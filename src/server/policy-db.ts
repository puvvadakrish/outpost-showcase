import "server-only";

import { Pool } from "@neondatabase/serverless";
import {
  hasExactPolicyRuntimeMembers,
  POLICY_COMPILER_ROLE,
  POLICY_DATABASE_AUTHORITY_SQL,
  POLICY_FUNCTION_ALLOWLIST,
  type PolicyCapabilityMembership,
} from "./policy-database-authority.mjs";

export interface PolicyDbQueryResult<Row> {
  rows: Row[];
}

export interface PolicyDbClient {
  query<Row = unknown>(
    text: string,
    values?: unknown[],
  ): Promise<PolicyDbQueryResult<Row>>;
}

interface PolicyAuthorityRow {
  session_user: string;
  has_policy_role: boolean;
  has_exact_policy_role_attributes: boolean;
  has_elevated_attributes: boolean;
  has_direct_table_authority: boolean;
  has_schema_creation: boolean;
  owns_policy_function: boolean;
  has_exact_security_definer_functions: boolean;
  has_exact_policy_function_acl: boolean;
  has_exact_role_memberships: boolean;
  has_exact_runtime_role_members: boolean;
  database_owner_name: string;
  policy_role_members: PolicyCapabilityMembership[];
}

export const OUTPOST_POLICY_COMPILER_ROLE = POLICY_COMPILER_ROLE;
export const OUTPOST_POLICY_FUNCTION_ALLOWLIST = POLICY_FUNCTION_ALLOWLIST;
export const OUTPOST_POLICY_DATABASE_TIMEOUT_MS = 2_000;

let sharedPool: Pool | undefined;

export function getOutpostPolicyDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
) {
  return env.OUTPOST_POLICY_DATABASE_URL;
}

export function isPolicyDbConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return Boolean(getOutpostPolicyDatabaseUrl(env));
}

export function neonEndpointId(value: string | undefined) {
  if (!value) return undefined;
  try {
    const endpoint = new URL(value).hostname.split(".")[0];
    if (!endpoint?.startsWith("ep-")) return undefined;
    return endpoint.endsWith("-pooler")
      ? endpoint.slice(0, -"-pooler".length)
      : endpoint;
  } catch {
    return undefined;
  }
}

export function assertPolicyDatabaseMatchesDataApi(
  env: Record<string, string | undefined> = process.env,
) {
  const dataApiEndpoint = neonEndpointId(env.NEXT_PUBLIC_NEON_DATA_API_URL);
  const policyEndpoint = neonEndpointId(env.OUTPOST_POLICY_DATABASE_URL);
  if (!dataApiEndpoint || !policyEndpoint || dataApiEndpoint !== policyEndpoint) {
    throw new Error("Policy database must match the configured Neon Data API branch.");
  }
  return policyEndpoint;
}

export function getPolicyDbClient(
  env: Record<string, string | undefined> = process.env,
): PolicyDbClient {
  const connectionString = getOutpostPolicyDatabaseUrl(env);
  if (!connectionString) {
    throw new Error(
      "Policy database is not configured. Set OUTPOST_POLICY_DATABASE_URL.",
    );
  }

  sharedPool ??= new Pool({
    connectionString,
    connectionTimeoutMillis: OUTPOST_POLICY_DATABASE_TIMEOUT_MS,
    query_timeout: OUTPOST_POLICY_DATABASE_TIMEOUT_MS,
    statement_timeout: OUTPOST_POLICY_DATABASE_TIMEOUT_MS,
  });
  return sharedPool;
}

export async function assertPolicyDbAuthority(client: PolicyDbClient) {
  const result = await client.query<PolicyAuthorityRow>(
    POLICY_DATABASE_AUTHORITY_SQL,
    [OUTPOST_POLICY_COMPILER_ROLE, [...OUTPOST_POLICY_FUNCTION_ALLOWLIST]],
  );
  const authority = result.rows[0];
  const hasExactRuntimeMembers = authority && hasExactPolicyRuntimeMembers({
    databaseOwnerName: authority.database_owner_name,
    members: authority.policy_role_members,
    sessionUser: authority.session_user,
  });

  if (
    !authority?.has_policy_role ||
    !authority.has_exact_policy_role_attributes ||
    authority.has_elevated_attributes ||
    authority.has_direct_table_authority ||
    authority.has_schema_creation ||
    authority.owns_policy_function ||
    !authority.has_exact_role_memberships ||
    !authority.has_exact_runtime_role_members ||
    !hasExactRuntimeMembers ||
    !authority.has_exact_security_definer_functions ||
    !authority.has_exact_policy_function_acl
  ) {
    throw new Error("Policy database connection lacks compiler authority.");
  }

  return authority.session_user;
}

export async function assertPolicyDbAuthorityWithTimeout(
  client: PolicyDbClient,
  options: {
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
  } = {},
) {
  assertPolicyDatabaseMatchesDataApi(options.env);
  const timeoutMs = options.timeoutMs ?? OUTPOST_POLICY_DATABASE_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      assertPolicyDbAuthority(client),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Policy database authority verification timed out.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
