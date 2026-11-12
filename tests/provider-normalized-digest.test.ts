import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  emptyProviderNormalizedDigestReport,
  providerNormalizedDigestSummary,
} from "@/domain/provider-normalized-digest";

const migration = readFileSync(
  "neon/migrations/20260708010000_provider_normalized_digest.sql",
  "utf8",
);
const taskProvenanceMigration = readFileSync(
  "neon/migrations/20260708040000_provider_normalized_digest_task_provenance.sql",
  "utf8",
);
const adminPage = readFileSync("src/app/admin/page.tsx", "utf8");
const repository = readFileSync(
  "src/infrastructure/neon/founder-admin-readiness-repository.ts",
  "utf8",
);

describe("provider normalized digest", () => {
  it("adds a founder-admin-only read RPC over sanitized normalized rows", () => {
    expect(migration).toContain(
      "create or replace function list_founder_admin_provider_normalized_digest()",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("users.external_auth_id = auth.uid()");
    expect(migration).toContain("memberships.role = 'founder_admin'");
    expect(migration).toContain("app_admins.status = 'active'");
    expect(migration).toContain(
      "revoke execute on function list_founder_admin_provider_normalized_digest() from public, anonymous",
    );
    expect(migration).toContain(
      "grant execute on function list_founder_admin_provider_normalized_digest() to authenticated",
    );
    expect(taskProvenanceMigration).toContain(
      "create or replace function list_founder_admin_provider_normalized_digest()",
    );
    expect(taskProvenanceMigration).toContain(
      "users.external_auth_id = auth.uid()",
    );
    expect(taskProvenanceMigration).toContain(
      "memberships.role = 'founder_admin'",
    );
  });

  it("exposes digest metadata without raw provider payloads or contacts", () => {
    const executableMigration = migration.replace(/^--.*$/gmu, "");

    expect(migration).toContain("events.payload_digest");
    expect(migration).toContain("events.payload_ref");
    expect(migration).toContain("usage_meters");
    expect(taskProvenanceMigration).toContain(
      "source_linked_task_event_id",
    );
    expect(taskProvenanceMigration).not.toContain(
      "source_linked_task_event_note",
    );
    expect(taskProvenanceMigration).toContain("left join lateral");
    expect(taskProvenanceMigration).toContain(
      "'task_retell_' || left(encode(digest(",
    );
    expect(taskProvenanceMigration).toContain(
      "'task_resend_' || left(encode(digest(",
    );
    expect(taskProvenanceMigration).toContain(
      "task_usage_events.source_type = 'task'",
    );
    expect(taskProvenanceMigration).toContain(
      "tasks.id = task_usage_events.source_id",
    );
    expect(taskProvenanceMigration).toContain(
      "usage_events.source_id = tasks.id",
    );
    expect(
      `${executableMigration}\n${taskProvenanceMigration.replace(/^--.*$/gmu, "")}`,
    ).not.toMatch(
      /provider_payload|transcript|requester_contact|caller_phone|from_email/iu,
    );
  });

  it("wires only the authorized sanitized digest into the admin page", () => {
    expect(repository).toContain("loadProviderNormalizedDigest");
    expect(repository).toContain(
      "list_founder_admin_provider_normalized_digest",
    );
    expect(adminPage).toContain("Provider fixture digest");
    expect(adminPage).toContain("providerNormalizedDigestSummary");
    expect(adminPage).toContain("provider-digest-metrics");
    expect(adminPage).toContain("Task provenance");
    expect(adminPage).toContain("sourceLinkedTaskCount");
    expect(adminPage).toContain("repository.loadProviderNormalizedDigest()");
    expect(adminPage).toContain("subordinateReportsAreAuthorized");
    expect(adminPage).toContain("{authorizedReports ? (");
    expect(adminPage).toContain(
      "live providers, and outbound delivery stay unavailable",
    );
    expect(adminPage).not.toContain("row.payload_ref");
    expect(adminPage).not.toContain("@/domain/seed");
    expect(adminPage).not.toContain("taskProofOriginSummaries");
    expect(adminPage).not.toContain("getCustomerZeroTenant");
  });

  it("summarizes rows without assuming launch or live-provider readiness", () => {
    expect(
      providerNormalizedDigestSummary(emptyProviderNormalizedDigestReport),
    ).toEqual({
      eventCount: 0,
      meterCount: 0,
      providerCount: 0,
      sourceLinkedTaskCount: 0,
      taskCount: 0,
    });
    expect(
      providerNormalizedDigestSummary({
        authorized: true,
        generated_at: "2026-07-08T00:00:00.000Z",
        rows: [
          {
            channel: "email",
            channel_event_id: "evt_1",
            conversation_id: "conv_1",
            event_type: "resend.email_received",
            location_id: "loc_1",
            location_name: "Main",
            payload_digest: "a".repeat(64),
            payload_ref: "fixture/example",
            processing_status: "normalized",
            provider_connection_id: "provider_1",
            provider_event_id: "email_1",
            provider_key: "resend",
            received_at: "2026-07-08T00:00:00.000Z",
            source_linked_task_event_id: "task_event_source_task_1",
            task_id: "task_1",
            task_status: "needs_human",
            tenant_id: "tenant_1",
            tenant_name: "Gym",
            usage_meters: ["email_received", "task_created"],
          },
        ],
      }),
    ).toEqual({
      eventCount: 1,
      meterCount: 2,
      providerCount: 1,
      sourceLinkedTaskCount: 1,
      taskCount: 1,
    });
  });
});
