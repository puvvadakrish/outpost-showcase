import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { providerConnectionReadiness } from "@/domain/channels";
import {
  providerConnections,
  supportAccessGrants,
  usageEvents
} from "@/domain/seed";
import { supportAccessReadiness } from "@/domain/tenancy";
import { usagePlaceholderSummary } from "@/domain/usage";
import { readMigrationSource } from "./helpers/migration-source";

const schema = readMigrationSource();
const ownerRoute = readFileSync("src/app/owner/page.tsx", "utf8");
const answerClient = readFileSync("src/components/owner/AnswerBankReviewClient.tsx", "utf8");

describe("Slice 2 architecture foundation", () => {
  it("keeps provider connections blocked and not configured", () => {
    expect(providerConnectionReadiness(providerConnections)).toMatchObject({
      disabled: 1,
      notConfigured: 2,
      readyForLivePhone: false,
      readyForLiveEmail: false
    });
  });

  it("keeps usage events as placeholders without billing behavior", () => {
    expect(usagePlaceholderSummary(usageEvents)).toEqual({
      events: 1,
      quantity: 1,
      computesBilling: false,
      computesOverage: false
    });
  });

  it("separates support access grants from tenant membership authority", () => {
    expect(supportAccessReadiness(supportAccessGrants)).toEqual({
      active: 1,
      auditReady: true,
      hasTenantMembershipAuthority: false,
      readyForLiveSupport: false
    });
  });

  it("stubs the approved Slice 2 tables", () => {
    for (const table of [
      "answer_bank_revisions",
      "source_facts",
      "location_revisions",
      "handoff_rule_revisions",
      "notification_destination_revisions",
      "task_events",
      "domain_events",
      "audit_events",
      "provider_connections",
      "channel_events",
      "conversations",
      "usage_events",
      "jobs",
      "support_access_grants"
    ]) {
      expect(schema).toContain(`create table ${table}`);
    }
  });

  it("represents answer audit fields and revision evidence in SQL", () => {
    expect(schema).toContain("source_document_id text");
    expect(schema).toContain("source_label text");
    expect(schema).toContain("approved_by_user_id text");
    expect(schema).toContain("foreign key (tenant_id, approved_by_user_id) references tenant_memberships(tenant_id, user_id)");
    expect(schema).toContain("approved_at timestamptz");
    expect(schema).toContain("retired_at timestamptz");
    expect(schema).toContain("create table answer_bank_revisions");
    expect(schema).toContain("foreign key (tenant_id, actor_user_id) references tenant_memberships(tenant_id, user_id)");
  });

  it("enforces tenant/location integrity through composite references", () => {
    expect(schema).toContain("unique (tenant_id, id)");
    expect(schema.match(/foreign key \(tenant_id, location_id\) references locations\(tenant_id, id\)/g)).toHaveLength(19);
    expect(schema).toContain("foreign key (tenant_id, provider_connection_id) references provider_connections(tenant_id, id)");
    expect(schema).toContain("foreign key (tenant_id, location_id, task_id) references tasks(tenant_id, location_id, id)");
  });

  it("keeps raw provider payloads out of audit and domain events", () => {
    expect(schema).toContain("create table domain_events");
    expect(schema).toContain("create table audit_events");
    expect(schema).toContain("create table channel_events");
    expect(schema).toContain("payload_ref text");
    expect(schema).not.toContain("raw_payload");
  });

  it("keeps owner route data aggregation server-side and answer forms in client leaves", () => {
    expect(ownerRoute.startsWith("\"use client\"")).toBe(false);
    expect(ownerRoute).toContain("getCustomerZeroTenant()");
    expect(ownerRoute).not.toContain("useState");
    expect(answerClient.startsWith("\"use client\"")).toBe(true);
    expect(answerClient).toContain("useActionState");
    expect(answerClient).toContain("editFormAction");
    expect(answerClient).toContain("approveFormAction");
  });
});
