import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  drainJobs,
  isAuthorizedDrainRequest,
  isJobLeaseLostError,
  isTenantRuntimeStoppedError
} from "@/app/api/internal/jobs/drain/route";
import { dispatchJob, listRegisteredJobKinds } from "@/server/jobs/registry";
import type { JobRow } from "@/server/jobs/types";
import {
  assertSystemDbRuntimeAuthority,
  OUTPOST_JOB_RUNTIME_ROLE,
  OUTPOST_RUNTIME_FUNCTION_ALLOWLIST,
  type SystemDbClient
} from "@/server/system-db";
import { RUNTIME_DATABASE_AUTHORITY_SQL } from "@/server/runtime-database-authority.mjs";
import resendFixture from "./fixtures/resend/inbound-gym-freeze-request.json";
import retellFixture from "./fixtures/retell/call-ended-gym-follow-up.json";
import { readMigrationSource } from "./helpers/migration-source";

const migration = readFileSync("neon/migrations/20260707010000_jobs_outbox.sql", "utf8");
const schema = readMigrationSource();
const route = readFileSync("src/app/api/internal/jobs/drain/route.ts", "utf8");
const systemDb = readFileSync("src/server/system-db.ts", "utf8");
const registry = readFileSync("src/server/jobs/registry.ts", "utf8");

function jobRow(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "job_1",
    tenant_id: null,
    kind: "noop",
    payload_version: 1,
    payload: {},
    status: "running",
    dedupe_key: "noop:test",
    run_after: "2026-07-07T00:00:00.000Z",
    attempts: 1,
    max_attempts: 5,
    locked_at: "2026-07-07T00:00:00.000Z",
    locked_by: "worker_test",
    last_error: null,
    completed_at: null,
    created_at: "2026-07-07T00:00:00.000Z",
    updated_at: "2026-07-07T00:00:00.000Z",
    ...overrides
  };
}

describe("jobs outbox substrate", () => {
  it("defines server-only jobs storage without public or authenticated table grants", () => {
    expect(migration).toContain("create type job_status as enum");
    expect(migration).toContain("create table jobs");
    expect(migration).toContain("dedupe_key text not null unique");
    expect(migration).toContain("payload_version integer not null default 1");
    expect(migration).toContain("alter table jobs enable row level security");
    expect(migration).toContain("revoke all on jobs from public, anonymous, authenticated");
    expect(migration).not.toMatch(/grant\s+(insert|update|delete|all)\s+on\s+jobs\s+to\s+(anonymous|authenticated)/iu);
    expect(schema).toContain("create type job_status as enum");
    expect(schema).toContain("create table jobs");
  });

  it("claims jobs with skip-locked at-least-once semantics", () => {
    expect(migration).toContain("create or replace function claim_jobs");
    expect(migration.toLowerCase()).toContain("for update skip locked");
    expect(migration).toContain("attempts = jobs.attempts + 1");
    expect(migration).toContain("status = 'running'");
    expect(migration).toContain("locked_at < now() - interval '5 minutes'");
    expect(migration).toContain("job lock expired before completion");
    expect(migration).toContain("create or replace function mark_job_succeeded");
    expect(migration).toContain("create or replace function mark_job_failed");
    expect(migration).toContain("and locked_by = p_worker_id");
    expect(migration).toContain("case when attempts >= max_attempts then 'dead'::job_status else 'failed'::job_status end");
  });

  it("rejects dedupe-key reuse for different work instead of silently collapsing jobs", () => {
    expect(migration).toContain("on conflict (dedupe_key) do nothing");
    expect(migration).toContain("v_job.tenant_id is distinct from p_tenant_id");
    expect(migration).toContain("v_job.kind <> p_kind");
    expect(migration).toContain("v_job.payload_version <> p_payload_version");
    expect(migration).toContain("v_job.payload <> p_payload");
    expect(migration).toContain("conflicts with different work");
  });

  it("keeps system database credentials server-only", () => {
    expect(systemDb).toContain('import "server-only"');
    expect(systemDb).toContain("OUTPOST_RUNTIME_DATABASE_URL");
    expect(systemDb).not.toContain("env.OUTPOST_DATABASE_URL");
    expect(systemDb).toContain("@neondatabase/serverless");
    expect(systemDb).not.toContain("NEXT_PUBLIC_OUTPOST_DATABASE_URL");
    expect(systemDb).not.toContain("NEXT_PUBLIC_NEON_DATABASE_URL");
  });

  it("rejects system database connections outside the runtime capability role", async () => {
    const denied: SystemDbClient = {
      async query<Row>() {
        return { rows: [{ session_user: "neondb_owner", has_runtime_role: false } as Row] };
      }
    };
    const allowed: SystemDbClient = {
      async query<Row>(sql: string, values?: unknown[]) {
        expect(sql).toBe(RUNTIME_DATABASE_AUTHORITY_SQL);
        expect(values).toEqual([
          OUTPOST_JOB_RUNTIME_ROLE,
          [...OUTPOST_RUNTIME_FUNCTION_ALLOWLIST]
        ]);
        return {
          rows: [{
            session_user: "outpost_runtime_login",
            has_runtime_role: true,
            has_elevated_attributes: false,
            has_direct_table_authority: false,
            has_schema_creation: false,
            owns_runtime_function: false,
            has_exact_role_memberships: true,
            has_exact_security_definer_functions: true
          } as Row]
        };
      }
    };

    await expect(assertSystemDbRuntimeAuthority(denied)).rejects.toThrow(
      "lacks job runtime authority"
    );
    await expect(assertSystemDbRuntimeAuthority(allowed)).resolves.toBe("outpost_runtime_login");
  });

  it("rejects a runtime login with an extra security-definer capability", async () => {
    const client: SystemDbClient = {
      async query<Row>() {
        return {
          rows: [{
            session_user: "outpost_runtime_login",
            has_runtime_role: true,
            has_elevated_attributes: false,
            has_direct_table_authority: false,
            has_schema_creation: false,
            owns_runtime_function: false,
            has_exact_role_memberships: true,
            has_exact_security_definer_functions: false
          } as Row]
        };
      }
    };

    await expect(assertSystemDbRuntimeAuthority(client)).rejects.toThrow(
      "lacks job runtime authority"
    );
  });

  it.each([
    ["elevated attributes", { has_elevated_attributes: true }],
    ["direct relation authority", { has_direct_table_authority: true }],
    ["schema creation", { has_schema_creation: true }],
    ["runtime function ownership", { owns_runtime_function: true }],
    ["an extra role", { has_exact_role_memberships: false }]
  ])("rejects runtime authority with %s", async (_label, override) => {
    const client: SystemDbClient = {
      async query<Row>() {
        return {
          rows: [{
            session_user: "outpost_runtime_login",
            has_runtime_role: true,
            has_elevated_attributes: false,
            has_direct_table_authority: false,
            has_schema_creation: false,
            owns_runtime_function: false,
            has_exact_role_memberships: true,
            has_exact_security_definer_functions: true,
            ...override
          } as Row]
        };
      }
    };

    await expect(assertSystemDbRuntimeAuthority(client)).rejects.toThrow(
      "lacks job runtime authority"
    );
  });

  it("guards the internal drain route and avoids public provider behavior", () => {
    expect(route).toContain('export const runtime = "nodejs"');
    expect(route).toContain("OUTPOST_INTERNAL_JOB_DRAIN_TOKEN");
    expect(route).toContain("timingSafeEqual");
    expect(route).not.toContain("Retell");
    expect(route).not.toContain("Resend");
    expect(route).not.toContain("billing");
  });

  it("authorizes drain requests with a constant-time internal token check", () => {
    expect(isAuthorizedDrainRequest(new Headers(), { OUTPOST_INTERNAL_JOB_DRAIN_TOKEN: "secret" })).toBe(false);
    expect(
      isAuthorizedDrainRequest(new Headers({ authorization: "Bearer wrong" }), {
        OUTPOST_INTERNAL_JOB_DRAIN_TOKEN: "secret"
      })
    ).toBe(false);
    expect(
      isAuthorizedDrainRequest(new Headers({ "x-outpost-job-drain-token": "secret" }), {
        OUTPOST_INTERNAL_JOB_DRAIN_TOKEN: "secret"
      })
    ).toBe(true);
  });

  it("registers offline provider normalization handlers without adding provider behavior to the route", () => {
    expect(listRegisteredJobKinds()).toEqual([
      "noop",
      "provider.retell.call_ended.normalize",
      "provider.resend.email_received.normalize"
    ]);
    expect(registry).not.toContain("notification");
    expect(registry).not.toContain("invite");
    expect(route).not.toContain("Retell");
    expect(route).not.toContain("Resend");
  });

  it("dispatches no-op jobs successfully", async () => {
    await expect(dispatchJob(jobRow())).resolves.toMatchObject({
      ok: true,
      message: "No-op job acknowledged."
    });
  });

  it("dispatches Retell fixture normalization jobs without live provider calls", async () => {
    const result = await dispatchJob(
      jobRow({
        tenant_id: "tenant_acme_fitness",
        kind: "provider.retell.call_ended.normalize",
        dedupe_key: "provider.retell.call_ended.normalize:retell_call_preview_001",
        payload: {
          context: {
            tenant_id: "tenant_acme_fitness",
            location_id: "loc_acme_fitness_main",
            provider_connection_id: "provider_retell_acme_fitness_preview"
          },
          payload_ref: "sha256/redacted-retell-call-ended-gym-follow-up",
          provider_payload: retellFixture,
          received_at: "2026-07-07T12:00:00.000Z"
        }
      })
    );

    expect(result).toMatchObject({
      ok: true,
      details: {
        providerKey: "retell",
        usageEventMeters: ["call_completed", "task_created", "voice_seconds"],
        warnings: []
      }
    });
    expect(JSON.stringify(result)).not.toContain("provider_payload");
    expect(JSON.stringify(result)).not.toContain("transcript");
  });

  it("dispatches Resend fixture normalization jobs without live provider calls", async () => {
    await expect(
      dispatchJob(
        jobRow({
          tenant_id: "tenant_acme_fitness",
          kind: "provider.resend.email_received.normalize",
          dedupe_key: "provider.resend.email_received.normalize:email_preview_001",
          payload: {
            context: {
              tenant_id: "tenant_acme_fitness",
              location_id: "loc_acme_fitness_main",
              provider_connection_id: "provider_resend_acme_fitness_preview"
            },
            payload_ref: "sha256/redacted-resend-inbound-gym-freeze-request",
            provider_payload: resendFixture,
            received_at: "2026-07-07T15:26:00.000Z"
          }
        })
      )
    ).resolves.toMatchObject({
      ok: true,
      details: {
        providerKey: "resend",
        usageEventMeters: ["email_received", "task_created"],
        warnings: []
      }
    });
  });

  it("rejects provider normalization jobs with mismatched tenant context", async () => {
    await expect(
      dispatchJob(
        jobRow({
          tenant_id: "tenant_acme_fitness",
          kind: "provider.retell.call_ended.normalize",
          payload: {
            context: {
              tenant_id: "tenant_other",
              location_id: "loc_acme_fitness_main",
              provider_connection_id: "provider_retell_acme_fitness_preview"
            },
            provider_payload: retellFixture
          }
        })
      )
    ).rejects.toThrow("tenant_id does not match context.tenant_id");
  });

  it("marks claimed jobs succeeded through the SQL boundary", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const client: SystemDbClient = {
      async query<Row>(sql: string, values?: unknown[]) {
        calls.push({ sql, values });
        if (sql.includes("claim_jobs")) {
          return { rows: [jobRow() as Row] };
        }
        return { rows: [] };
      }
    };

    await expect(drainJobs(client, { batchSize: 3, workerId: "worker_test" })).resolves.toMatchObject({
      claimed: 1,
      failed: 0,
      succeeded: 1
    });
    expect(calls.map((call) => call.sql)).toEqual([
      "select * from claim_jobs($1, $2)",
      "select * from mark_job_succeeded($1, $2)"
    ]);
    expect(calls[1].values).toEqual(["job_1", "worker_test"]);
  });

  it("marks unknown job kinds failed without crashing the batch", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const client: SystemDbClient = {
      async query<Row>(sql: string, values?: unknown[]) {
        calls.push({ sql, values });
        if (sql.includes("claim_jobs")) {
          return { rows: [jobRow({ kind: "missing_handler" }) as Row] };
        }
        return { rows: [] };
      }
    };

    await expect(drainJobs(client, { batchSize: 1, workerId: "worker_test" })).resolves.toMatchObject({
      claimed: 1,
      failed: 1,
      succeeded: 0
    });
    expect(calls.map((call) => call.sql)).toEqual([
      "select * from claim_jobs($1, $2)",
      "select * from mark_job_failed($1, $2, $3)"
    ]);
    expect(calls[1].values?.[1]).toBe("worker_test");
    expect(String(calls[1].values?.[2])).toContain("No handler registered");
  });

  it("does not mark a successfully handled job failed when success settlement fails", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const client: SystemDbClient = {
      async query<Row>(sql: string, values?: unknown[]) {
        calls.push({ sql, values });
        if (sql.includes("claim_jobs")) {
          return { rows: [jobRow() as Row] };
        }
        if (sql.includes("mark_job_succeeded")) {
          throw new Error("transient settlement failure");
        }
        return { rows: [] };
      }
    };

    await expect(drainJobs(client, { batchSize: 1, workerId: "worker_test" })).resolves.toMatchObject({
      claimed: 1,
      failed: 0,
      settlementFailed: 1,
      succeeded: 0
    });
    expect(calls.map((call) => call.sql)).toEqual([
      "select * from claim_jobs($1, $2)",
      "select * from mark_job_succeeded($1, $2)"
    ]);
  });

  it("defers stop-rejected tenant work without routing it through ordinary failure", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const stoppedError = Object.assign(new Error("tenant runtime processing is stopped"), {
      code: "OP001"
    });
    const claimedJob = jobRow({
      tenant_id: "tenant_acme_fitness",
      kind: "provider.resend.email_received.normalize",
      payload: {
        context: {
          tenant_id: "tenant_acme_fitness",
          location_id: "loc_acme_fitness_main",
          provider_connection_id: "provider_resend_acme_fitness_preview"
        },
        provider_payload: resendFixture
      }
    });
    const client: SystemDbClient = {
      async query<Row>(sql: string, values?: unknown[]) {
        calls.push({ sql, values });
        if (sql.includes("claim_jobs")) return { rows: [claimedJob as Row] };
        if (sql.includes("persist_normalized_provider_event")) throw stoppedError;
        return { rows: [] };
      }
    };

    await expect(drainJobs(client, { batchSize: 1, workerId: "worker_test" })).resolves.toMatchObject({
      claimed: 1,
      deferred: 1,
      failed: 0,
      settlementFailed: 0,
      succeeded: 0
    });
    expect(calls.map((call) => call.sql)).toEqual([
      "select * from claim_jobs($1, $2)",
      "select persist_normalized_provider_event($1::jsonb, $2, $3) as result",
      "select * from defer_job_for_tenant_stop($1, $2)"
    ]);
    expect(isTenantRuntimeStoppedError(stoppedError)).toBe(true);
    expect(isTenantRuntimeStoppedError(Object.assign(new Error(stoppedError.message), { code: "XX000" }))).toBe(false);
  });

  it("leaves settlement to the authoritative worker after a lease is lost", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const leaseError = Object.assign(new Error("job lease is no longer authoritative"), {
      code: "OP002"
    });
    const claimedJob = jobRow({
      tenant_id: "tenant_acme_fitness",
      kind: "provider.resend.email_received.normalize",
      payload: {
        context: {
          tenant_id: "tenant_acme_fitness",
          location_id: "loc_acme_fitness_main",
          provider_connection_id: "provider_resend_acme_fitness_preview"
        },
        provider_payload: resendFixture
      }
    });
    const client: SystemDbClient = {
      async query<Row>(sql: string, values?: unknown[]) {
        calls.push({ sql, values });
        if (sql.includes("claim_jobs")) return { rows: [claimedJob as Row] };
        if (sql.includes("persist_normalized_provider_event")) throw leaseError;
        return { rows: [] };
      }
    };

    await expect(drainJobs(client, { batchSize: 1, workerId: "worker_test" })).resolves.toMatchObject({
      claimed: 1,
      failed: 0,
      leaseLost: 1,
      settlementFailed: 0,
      succeeded: 0
    });
    expect(calls).toHaveLength(2);
    expect(isJobLeaseLostError(leaseError)).toBe(true);
  });
});
