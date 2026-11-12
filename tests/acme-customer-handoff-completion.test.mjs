import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const completionScript = readFileSync("scripts/record-acme-customer-handoff-completion.mjs", "utf8");
const runbook = readFileSync("docs/setup/acme-dry-run-onboarding-handoff.md", "utf8");

function packetMarkdown(overrides = {}) {
  const values = {
    dryRunId: "acme_customer_001",
    dryRunOwner: "acme+dry-run-customer@owner.outpost.local",
    dryRunTenant: "Acme Fitness Dry Run acme_customer_001",
    dryRunTenantId: "tenant_acme_customer_001",
    liveProviderStatus: "blocked",
    previewOrigin: "https://outpost-preview-20260610-example.vercel.app",
    proofBranch: "outpost-beta-access-scoped-20260621102658",
    rollbackStatus: "rollback-only cleanup complete",
    ...overrides
  };

  return `# Acme Fitness Customer Handoff Packet

## Proof Summary

| Field | Value |
| --- | --- |
| Preview origin | ${values.previewOrigin} |
| Neon proof branch | ${values.proofBranch} |
| Dry-run id | ${values.dryRunId} |
| Dry-run owner | ${values.dryRunOwner} |
| Dry-run tenant | ${values.dryRunTenant} |
| Dry-run tenant id | ${values.dryRunTenantId} |
| Live-provider status | ${values.liveProviderStatus} |
| Rollback status | ${values.rollbackStatus} |

## Completed Proof Checks

- hosted_readiness
- operator_owner_access
- manual_source_to_answer_review
- answer_review_to_staff_task
- live_provider_gate_blocked

## Explicit Non-Goals

- No invite email delivery.
- No phone or email provider activation.
- No notification sending.
- No claim that Acme Fitness has completed customer onboarding until the actual customer-observed session is done.
`;
}

function writePacket(packet = packetMarkdown()) {
  const dir = mkdtempSync(join(tmpdir(), "outpost-acme-completion-test-"));
  const packetPath = join(dir, "packet.md");
  const completionPath = join(dir, "completion.json");
  writeFileSync(packetPath, packet);
  return { completionPath, packetPath };
}

function baseEnv(paths, extraEnv = {}) {
  return {
    ...process.env,
    OUTPOST_ACME_CUSTOMER_COMPLETION_PATH: paths.completionPath,
    OUTPOST_ACME_CUSTOMER_CONFIRMED_PREVIEW: "1",
    OUTPOST_ACME_CUSTOMER_LIVE_GATES_BLOCKED: "1",
    OUTPOST_ACME_CUSTOMER_NO_UNEXPECTED_DATA: "1",
    OUTPOST_ACME_CUSTOMER_OBSERVER: "Outpost operator",
    OUTPOST_ACME_CUSTOMER_OWNER_SIGNIN: "1",
    OUTPOST_ACME_CUSTOMER_OWNER_WORKSPACE: "1",
    OUTPOST_ACME_CUSTOMER_PACKET_PATH: paths.packetPath,
    OUTPOST_ACME_CUSTOMER_PARTICIPANT: "Acme Fitness owner",
    OUTPOST_ACME_CUSTOMER_RESET_REVIEWED: "1",
    OUTPOST_ACME_CUSTOMER_SESSION_AT: "2026-06-21T21:00:00.000Z",
    OUTPOST_ACME_CUSTOMER_STAFF_HANDOFF: "1",
    OUTPOST_ACME_CUSTOMER_STOP_CONCERNS: "none",
    ...extraEnv
  };
}

function runCompletion(paths, extraEnv = {}) {
  return spawnSync("node", ["scripts/record-acme-customer-handoff-completion.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: baseEnv(paths, extraEnv)
  });
}

describe("Acme Fitness customer-observed handoff completion", () => {
  it("registers a dedicated customer-observed completion command", () => {
    expect(packageJson).toContain('"acme:customer-handoff:complete"');
    expect(packageJson).toContain("record-acme-customer-handoff-completion.mjs");
  });

  it("writes a non-secret completion record after all observed gates are confirmed", () => {
    const paths = writePacket();
    const result = runCompletion(paths);

    expect(result.status, result.stderr).toBe(0);
    const record = JSON.parse(readFileSync(paths.completionPath, "utf8"));
    expect(record.status).toBe("customer_observed_handoff_recorded");
    expect(record.evidence_basis).toBe("operator_attested_from_customer_handoff_packet");
    expect(record.verification_boundary).toContain("operator-observed confirmations");
    expect(record.packet.dryRunId).toBe("acme_customer_001");
    expect(record.packet.liveProviderStatus).toBe("blocked");
    expect(record.live_provider_gate).toBe("blocked");
    expect(record.confirmations).toHaveLength(7);
    expect(record.non_goals).toContain("invite_delivery");
    expect(JSON.stringify(record)).not.toContain("napi_");
    expect(JSON.stringify(record)).not.toContain("Bearer ");
    expect(JSON.stringify(record)).not.toContain("__Secure-neon-auth");
  });

  it("fails closed when an observed checklist gate is missing", () => {
    const paths = writePacket();
    const result = runCompletion(paths, { OUTPOST_ACME_CUSTOMER_STAFF_HANDOFF: "" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OUTPOST_ACME_CUSTOMER_STAFF_HANDOFF=1 is required");
  });

  it("fails closed when stop concerns are not explicitly none", () => {
    const paths = writePacket();
    const result = runCompletion(paths, { OUTPOST_ACME_CUSTOMER_STOP_CONCERNS: "customer saw unexpected data" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must be exactly 'none'");
  });

  it("fails closed when packet boundaries are not green", () => {
    let paths = writePacket(packetMarkdown({ liveProviderStatus: "enabled" }));
    let result = runCompletion(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("blocked live-provider status");

    paths = writePacket(packetMarkdown({ dryRunTenantId: "tenant_acme_fitness" }));
    result = runCompletion(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must not target the seeded tenant");
  });

  it("fails closed on secret-shaped values and unsafe repo-local output paths", () => {
    let paths = writePacket(`${packetMarkdown()}\nBearer abcdefghijklmnopqrstuvwxyz012345`);
    let result = runCompletion(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");

    paths = writePacket();
    result = runCompletion(paths, { OUTPOST_ACME_CUSTOMER_COMPLETION_PATH: "docs/customer-completion.json" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gitignored artifacts");
  });

  it("pins the completion gate boundaries in code and docs", () => {
    expect(completionScript).toContain("OUTPOST_ACME_CUSTOMER_STOP_CONCERNS");
    expect(completionScript).toContain("customer_observed_handoff_recorded");
    expect(completionScript).toContain("operator_attested_from_customer_handoff_packet");
    expect(completionScript).toContain("live_provider_gate");
    expect(completionScript).toContain("blocked");
    expect(completionScript).toContain("assertNoSecretShapedKeys");
    expect(completionScript).toContain("No invite email delivery.");
    expect(completionScript).not.toContain("service_role");
    expect(completionScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(runbook).toContain("acme:customer-handoff:complete");
    expect(runbook).toContain("Customer-Observed Completion Record");
  });
});
