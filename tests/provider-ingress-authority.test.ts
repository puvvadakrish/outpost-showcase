import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  acceptProviderIngressEvent,
  assertIngressDbAuthority,
  getOutpostIngressDatabaseUrl,
  OUTPOST_PROVIDER_INGRESS_FUNCTION_ALLOWLIST,
  OUTPOST_PROVIDER_INGRESS_ROLE,
  resolveProviderIngressConnection,
  type IngressDbClient
} from "@/server/ingress-db";
import { INGRESS_DATABASE_AUTHORITY_SQL } from "@/server/ingress-database-authority.mjs";

const migration = readFileSync(
  "neon/migrations/20260713030000_provider_ingress_authority.sql",
  "utf8"
);
const verifier = readFileSync("scripts/verify-ingress-database-authority.mjs", "utf8");
const concurrencyContract = readFileSync(
  "tests/sql/provider-ingress-authority-concurrency.sh",
  "utf8"
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

describe("provider ingress database authority", () => {
  it("uses a distinct server-only database credential and exact authority contract", async () => {
    expect(getOutpostIngressDatabaseUrl({ OUTPOST_INGRESS_DATABASE_URL: "postgres://ingress" })).toBe(
      "postgres://ingress"
    );
    expect(getOutpostIngressDatabaseUrl({ OUTPOST_RUNTIME_DATABASE_URL: "postgres://runtime" })).toBeUndefined();
    expect(OUTPOST_PROVIDER_INGRESS_ROLE).toBe("outpost_provider_ingress");
    expect(OUTPOST_PROVIDER_INGRESS_FUNCTION_ALLOWLIST).toEqual([
      "accept_provider_ingress_event(text,text,text,text,text,jsonb,timestamp with time zone)",
      "resolve_provider_ingress_connection(text,text)"
    ]);

    const client: IngressDbClient = {
      async query<Row>(sql: string, values?: unknown[]) {
        expect(sql).toBe(INGRESS_DATABASE_AUTHORITY_SQL);
        expect(values).toEqual([
          OUTPOST_PROVIDER_INGRESS_ROLE,
          [...OUTPOST_PROVIDER_INGRESS_FUNCTION_ALLOWLIST]
        ]);
        return {
          rows: [{
            session_user: "outpost_ingress_preview_v1",
            has_ingress_role: true,
            has_elevated_attributes: false,
            has_direct_table_authority: false,
            has_schema_creation: false,
            owns_ingress_function: false,
            has_exact_role_memberships: true,
            has_exact_security_definer_functions: true
          } as Row]
        };
      }
    };

    await expect(assertIngressDbAuthority(client)).resolves.toBe("outpost_ingress_preview_v1");
  });

  it("rejects owner, elevated, direct-table, and over-capable database sessions", async () => {
    for (const authority of [
      { has_ingress_role: false },
      { has_ingress_role: true, has_elevated_attributes: true },
      { has_ingress_role: true, has_direct_table_authority: true },
      { has_ingress_role: true, has_schema_creation: true },
      { has_ingress_role: true, owns_ingress_function: true },
      { has_ingress_role: true, has_exact_role_memberships: false },
      { has_ingress_role: true, has_exact_security_definer_functions: false }
    ]) {
      const client: IngressDbClient = {
        async query<Row>() {
          return {
            rows: [Object.assign({
              session_user: "neondb_owner",
              has_ingress_role: false,
              has_elevated_attributes: false,
              has_direct_table_authority: false,
              has_schema_creation: false,
              owns_ingress_function: false,
              has_exact_role_memberships: true,
              has_exact_security_definer_functions: true
            }, authority) as Row]
          };
        }
      };

      await expect(assertIngressDbAuthority(client)).rejects.toThrow(
        "Provider ingress database connection lacks exact authority."
      );
    }
  });

  it("resolves only opaque ingress provenance and accepts only sanitized event input", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const client: IngressDbClient = {
      async query<Row>(sql: string, values?: unknown[]) {
        calls.push({ sql, values });
        if (sql.includes("resolve_provider_ingress_connection")) {
          return {
            rows: [{ connection: {
              tenantId: "tenant_test",
              locationId: "location_test",
              providerConnectionId: "provider_test",
              providerKey: "resend",
              channel: "email",
              secretRef: "outpost-secret://provider/provider_test/webhook-signing/v1"
            } } as Row]
          };
        }
        return {
          rows: [{ receipt: {
            receiptId: "provider_receipt_1",
            jobId: "job_1",
            pauseGeneration: 4,
            replayed: false
          } } as Row]
        };
      }
    };

    await expect(resolveProviderIngressConnection(client, "d4ac846d-1886-4ea6-a842-2d2f727d10d8", "resend"))
      .resolves.toMatchObject({ providerConnectionId: "provider_test", secretRef: expect.any(String) });
    await expect(acceptProviderIngressEvent(client, {
      ingressKey: "d4ac846d-1886-4ea6-a842-2d2f727d10d8",
      providerKey: "resend",
      providerEventId: "email_123",
      eventType: "email.received",
      payloadDigest: "a".repeat(64),
      sanitizedPayload: {
        event: "email.received",
        message_id: "email_123",
        body_available: false
      },
      receivedAt: "2026-07-13T12:00:00.000Z"
    })).resolves.toEqual({
      receiptId: "provider_receipt_1",
      jobId: "job_1",
      pauseGeneration: 4,
      replayed: false
    });

    expect(calls[0]).toEqual({
      sql: "select resolve_provider_ingress_connection($1, $2) as connection",
      values: ["d4ac846d-1886-4ea6-a842-2d2f727d10d8", "resend"]
    });
    expect(calls[1]?.sql).toContain("accept_provider_ingress_event($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)");
    expect(calls[1]?.values).toEqual([
      "d4ac846d-1886-4ea6-a842-2d2f727d10d8",
      "resend",
      "email_123",
      "email.received",
      "a".repeat(64),
      JSON.stringify({ event: "email.received", message_id: "email_123", body_available: false }),
      "2026-07-13T12:00:00.000Z"
    ]);
  });

  it("keeps rehearsal hidden, defaults blocked, and denies direct ingress relation authority", () => {
    expect(migration).toContain("provider_ingress_mode text not null default 'blocked'");
    expect(migration).toContain("ingress_key uuid not null default gen_random_uuid()");
    expect(migration).toContain("create table provider_ingress_receipts");
    expect(migration).toContain("unique (provider_connection_id, provider_event_id)");
    expect(migration).toContain("create role outpost_provider_ingress");
    expect(migration).toContain("revoke all on all tables in schema public from outpost_provider_ingress");
    expect(migration).not.toMatch(/grant\s+(select|insert|update|delete|all)\s+on\s+provider_ingress_receipts/iu);
    expect(migration).not.toMatch(/grant\s+execute\s+on\s+function\s+enqueue_job[^;]+outpost_provider_ingress/iu);
    expect(migration).not.toMatch(/grant\s+execute\s+on\s+function\s+(claim_jobs|mark_job_|persist_normalized)/iu);
  });

  it("ships an operator verifier for the separately provisioned login", () => {
    expect(packageJson.scripts["verify:ingress-database-authority"]).toBe(
      "node scripts/verify-ingress-database-authority.mjs"
    );
    expect(verifier).toContain("OUTPOST_INGRESS_DATABASE_URL is required.");
    expect(verifier).toContain("INGRESS_ROLE");
    expect(verifier).toContain("has_exact_security_definer_functions");
    expect(verifier).toContain("has_exact_role_memberships");
    expect(verifier).toContain("INGRESS_DATABASE_AUTHORITY_SQL");
    expect(INGRESS_DATABASE_AUTHORITY_SQL).toContain("has_any_column_privilege");
    expect(INGRESS_DATABASE_AUTHORITY_SQL).toContain("MAINTAIN");
    expect(verifier).not.toContain("OUTPOST_DATABASE_URL");
    expect(verifier).not.toContain("OUTPOST_RUNTIME_DATABASE_URL");
  });

  it("ships a disposable accept-versus-stop concurrency contract", () => {
    expect(concurrencyContract).toContain("provider-ingress-authority-concurrency");
    expect(concurrencyContract).toContain("ingress-accept-first");
    expect(concurrencyContract).toContain("ingress-stop-first");
    expect(concurrencyContract).toContain("provider ingress unexpectedly crossed a committed tenant stop");
  });
});
