import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatchJob } from "@/server/jobs/registry";
import { persistNormalizedProviderEvent } from "@/server/providers/persistence";
import type { NormalizedProviderEvent } from "@/server/providers/normalized";
import type { JobRow } from "@/server/jobs/types";
import type { SystemDbClient } from "@/server/system-db";
import resendFixture from "./fixtures/resend/inbound-gym-freeze-request.json";
import { readMigrationSource } from "./helpers/migration-source";

const migration = readFileSync(
  "neon/migrations/20260707030000_provider_normalized_persistence.sql",
  "utf8"
);
const sourceLinkMigration = readFileSync(
  "neon/migrations/20260708020000_provider_task_source_link_events.sql",
  "utf8"
);
const replaySafeSourceLinkMigration = readFileSync(
  "neon/migrations/20260708030000_provider_task_source_link_replay_idempotency.sql",
  "utf8"
);
const schema = readMigrationSource();
const route = readFileSync("src/app/api/internal/jobs/drain/route.ts", "utf8");

function jobRow(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "job_1",
    tenant_id: "tenant_acme_fitness",
    kind: "provider.resend.email_received.normalize",
    payload_version: 1,
    payload: {
      context: {
        tenant_id: "tenant_acme_fitness",
        location_id: "loc_acme_fitness_main",
        provider_connection_id: "provider_resend_acme_fitness_preview"
      },
      payload_ref: "sha256/redacted-resend-inbound-gym-freeze-request",
      provider_payload: resendFixture,
      received_at: "2026-07-07T15:26:00.000Z"
    },
    status: "running",
    dedupe_key: "provider.resend.email_received.normalize:email_preview_001",
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

describe("provider normalized persistence", () => {
  it("defines one atomic RPC over existing normalized domain tables", () => {
    expect(migration).toContain("create or replace function persist_normalized_provider_event");
    expect(migration).toContain("insert into conversations");
    expect(migration).toContain("insert into channel_events");
    expect(migration).toContain("insert into tasks");
    expect(migration).toContain("insert into usage_events");
    expect(migration).toContain("on conflict (id) do update");
    expect(migration).toContain("on conflict (id) do nothing");
    expect(sourceLinkMigration).toContain("insert into task_events");
    expect(sourceLinkMigration).toContain("'source_linked'");
    expect(sourceLinkMigration).toContain("Provider normalized source:");
    expect(sourceLinkMigration).toContain("live providers remain blocked");
    expect(sourceLinkMigration).toContain("if v_inserted_tasks = 1 then");
    expect(replaySafeSourceLinkMigration).toContain("Keep provider-normalized task provenance idempotent on replay");
    expect(replaySafeSourceLinkMigration).toContain("insert into task_events");
    expect(replaySafeSourceLinkMigration).toContain("'source_linked'");
    expect(replaySafeSourceLinkMigration).not.toContain("if v_inserted_tasks = 1 then");
    expect(schema).toContain("insert into task_events");
    expect(migration).toContain("revoke all on function persist_normalized_provider_event(jsonb) from public, anonymous, authenticated");
    expect(schema).toContain("create or replace function persist_normalized_provider_event");
  });

  it("keeps tenant, provider, location, and channel consistency inside SQL", () => {
    expect(migration).toContain("channelEvent tenant mismatch");
    expect(migration).toContain("channelEvent conversation mismatch");
    expect(migration).toContain("provider connection not found for tenant");
    expect(migration).toContain("provider connection channel mismatch");
    expect(migration).toContain("provider connection location mismatch");
    expect(migration).toContain("task tenant mismatch");
    expect(migration).toContain("usage event tenant mismatch");
    expect(migration).toContain("usage event location mismatch");
  });

  it("does not add live provider, delivery, billing, POS, access-control, or ledger behavior", () => {
    const executableMigration = `${migration}\n${sourceLinkMigration}\n${replaySafeSourceLinkMigration}`.replace(/^--.*$/gmu, "");

    expect(route).toContain("dispatchJob(job, { db: client, workerId: leaseWorkerId })");
    expect(executableMigration).not.toMatch(/webhook|retell\s+sdk|resend\s+sdk|send\s+email|invite|billing|invoice|access-control|member\s+ledger/iu);
    expect(executableMigration).not.toMatch(/\bpos\b/iu);
  });

  it("calls the persistence RPC with sanitized normalized event JSON", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const client: SystemDbClient = {
      async query<Row>(sql: string, values?: unknown[]) {
        calls.push({ sql, values });
        return {
          rows: [
            {
              result: {
                channelEventId: "evt_resend_1",
                conversationId: "conv_resend_1",
                insertedTasks: 1,
                insertedUsageEvents: 2,
                proposedTaskId: "task_resend_1",
                upsertedChannelEvents: 1,
                upsertedConversations: 1,
                usageEventCount: 2
              }
            } as Row
          ]
        };
      }
    };
    const event: NormalizedProviderEvent = {
      providerKey: "resend",
      conversation: {
        id: "conv_resend_1",
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_fitness_main",
        channel: "email",
        providerConnectionId: "provider_resend_acme_fitness_preview",
        externalConversationId: "email_preview_001",
        requesterLabel: "Gym member",
        status: "needs_human",
        startedAt: "2026-07-07T15:25:00.000Z",
        lastEventAt: "2026-07-07T15:25:00.000Z"
      },
      channelEvent: {
        id: "evt_resend_1",
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_fitness_main",
        channel: "email",
        providerConnectionId: "provider_resend_acme_fitness_preview",
        conversationId: "conv_resend_1",
        providerEventId: "email_preview_001:email.received",
        eventType: "resend.email_received",
        payloadDigest: "a".repeat(64),
        payloadRef: "sha256/redacted-resend-inbound-gym-freeze-request",
        processingStatus: "normalized",
        receivedAt: "2026-07-07T15:26:00.000Z"
      },
      usageEvents: [],
      warnings: []
    };

    await expect(persistNormalizedProviderEvent(client, event, {
      jobId: "job_1",
      workerId: "worker_test"
    })).resolves.toMatchObject({
      conversationId: "conv_resend_1",
      insertedUsageEvents: 2
    });
    expect(calls).toEqual([
      {
        sql: "select persist_normalized_provider_event($1::jsonb, $2, $3) as result",
        values: [JSON.stringify(event), "job_1", "worker_test"]
      }
    ]);
  });

  it("persists provider normalization jobs through the supplied drain database client", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const client: SystemDbClient = {
      async query<Row>(sql: string, values?: unknown[]) {
        calls.push({ sql, values });
        return {
          rows: [
            {
              result: {
                channelEventId: "evt_resend_1",
                conversationId: "conv_resend_1",
                insertedTasks: 1,
                insertedUsageEvents: 2,
                proposedTaskId: "task_resend_1",
                upsertedChannelEvents: 1,
                upsertedConversations: 1,
                usageEventCount: 2
              }
            } as Row
          ]
        };
      }
    };

    const result = await dispatchJob(jobRow(), { db: client, workerId: "worker_test" });

    expect(result).toMatchObject({
      ok: true,
      details: {
        providerKey: "resend",
        persisted: {
          insertedTasks: 1,
          insertedUsageEvents: 2
        },
        usageEventMeters: ["email_received", "task_created"],
        warnings: []
      }
    });
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("provider_payload");
    expect(JSON.stringify(result)).not.toContain("text_body");
  });
});
