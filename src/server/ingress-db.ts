import "server-only";

import { Pool } from "@neondatabase/serverless";
import {
  INGRESS_DATABASE_AUTHORITY_SQL,
  INGRESS_FUNCTION_ALLOWLIST,
  INGRESS_ROLE,
} from "./ingress-database-authority.mjs";

export interface IngressDbQueryResult<Row> {
  rows: Row[];
}

export interface IngressDbClient {
  query<Row = unknown>(text: string, values?: unknown[]): Promise<IngressDbQueryResult<Row>>;
}

interface IngressAuthorityRow {
  session_user: string;
  has_ingress_role: boolean;
  has_elevated_attributes: boolean;
  has_direct_table_authority: boolean;
  has_schema_creation: boolean;
  owns_ingress_function: boolean;
  has_exact_security_definer_functions: boolean;
  has_exact_role_memberships: boolean;
}

export interface ProviderIngressConnection {
  tenantId: string;
  locationId: string;
  providerConnectionId: string;
  providerKey: "retell" | "resend";
  channel: "phone" | "email";
  secretRef: string;
}

export interface AcceptProviderIngressEventInput {
  ingressKey: string;
  providerKey: "retell" | "resend";
  providerEventId: string;
  eventType: "call_ended" | "email.received";
  payloadDigest: string;
  sanitizedPayload: Record<string, unknown>;
  receivedAt: string;
}

export interface ProviderIngressReceipt {
  receiptId: string;
  jobId: string;
  pauseGeneration: number;
  replayed: boolean;
}

export const OUTPOST_PROVIDER_INGRESS_ROLE = INGRESS_ROLE;
export const OUTPOST_PROVIDER_INGRESS_FUNCTION_ALLOWLIST =
  INGRESS_FUNCTION_ALLOWLIST;

let sharedPool: Pool | undefined;

export function getOutpostIngressDatabaseUrl(
  env: Record<string, string | undefined> = process.env
) {
  return env.OUTPOST_INGRESS_DATABASE_URL;
}

export function getIngressDbClient(
  env: Record<string, string | undefined> = process.env
): IngressDbClient {
  const connectionString = getOutpostIngressDatabaseUrl(env);

  if (!connectionString) {
    throw new Error("Provider ingress database is not configured. Set OUTPOST_INGRESS_DATABASE_URL.");
  }

  sharedPool ??= new Pool({ connectionString });
  return sharedPool;
}

export async function assertIngressDbAuthority(client: IngressDbClient) {
  const result = await client.query<IngressAuthorityRow>(
    INGRESS_DATABASE_AUTHORITY_SQL,
    [OUTPOST_PROVIDER_INGRESS_ROLE, [...OUTPOST_PROVIDER_INGRESS_FUNCTION_ALLOWLIST]]
  );
  const authority = result.rows[0];

  if (
    !authority?.has_ingress_role ||
    authority.has_elevated_attributes ||
    authority.has_direct_table_authority ||
    authority.has_schema_creation ||
    authority.owns_ingress_function ||
    !authority.has_exact_role_memberships ||
    !authority.has_exact_security_definer_functions
  ) {
    throw new Error("Provider ingress database connection lacks exact authority.");
  }

  return authority.session_user;
}

export async function resolveProviderIngressConnection(
  client: IngressDbClient,
  ingressKey: string,
  providerKey: "retell" | "resend"
) {
  const result = await client.query<{ connection: unknown }>(
    "select resolve_provider_ingress_connection($1, $2) as connection",
    [ingressKey, providerKey]
  );
  return parseConnection(result.rows[0]?.connection);
}

export async function acceptProviderIngressEvent(
  client: IngressDbClient,
  input: AcceptProviderIngressEventInput
) {
  const result = await client.query<{ receipt: unknown }>(
    `select accept_provider_ingress_event($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
       as receipt`,
    [
      input.ingressKey,
      input.providerKey,
      input.providerEventId,
      input.eventType,
      input.payloadDigest,
      JSON.stringify(input.sanitizedPayload),
      input.receivedAt
    ]
  );
  return parseReceipt(result.rows[0]?.receipt);
}

function parseConnection(value: unknown): ProviderIngressConnection {
  if (!isRecord(value)) throw new Error("Provider ingress connection was not resolved.");
  const providerKey = value.providerKey;
  const channel = value.channel;
  if ((providerKey !== "retell" && providerKey !== "resend") ||
      (channel !== "phone" && channel !== "email")) {
    throw new Error("Provider ingress connection was not resolved.");
  }
  return {
    tenantId: requiredString(value.tenantId),
    locationId: requiredString(value.locationId),
    providerConnectionId: requiredString(value.providerConnectionId),
    providerKey,
    channel,
    secretRef: requiredString(value.secretRef)
  };
}

function parseReceipt(value: unknown): ProviderIngressReceipt {
  if (!isRecord(value) || !Number.isSafeInteger(value.pauseGeneration) ||
      typeof value.replayed !== "boolean") {
    throw new Error("Provider ingress receipt was not returned.");
  }
  return {
    receiptId: requiredString(value.receiptId),
    jobId: requiredString(value.jobId),
    pauseGeneration: value.pauseGeneration as number,
    replayed: value.replayed
  };
}

function requiredString(value: unknown) {
  if (typeof value !== "string" || !value) {
    throw new Error("Provider ingress database returned invalid data.");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
