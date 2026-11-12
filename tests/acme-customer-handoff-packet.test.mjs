import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const packetScript = readFileSync("scripts/prepare-acme-customer-handoff-packet.mjs", "utf8");
const runbook = readFileSync("docs/setup/acme-dry-run-onboarding-handoff.md", "utf8");

function baseEvidence() {
  return {
    retained: {
      app_origin: "https://outpost-preview-20260610-example.vercel.app",
      checks: [
        "hosted_readiness",
        "operator_owner_access",
        "owner_beta_access_visible",
        "owner_bootstrap",
        "manual_source_to_answer_review",
        "answer_review_to_staff_task",
        "protected_preview_owner_route",
        "live_provider_gate_blocked"
      ],
      generated_at: "2026-06-21T20:00:00.000Z",
      live_provider_gate: "blocked",
      mode: {
        keep_data: true,
        rollback_only: false,
        vercel_curl: true
      },
      neon: {
        branch_name: "outpost-beta-access-scoped-20260621102658",
        database_name: "neondb",
        project_id: "outpost-test-project"
      },
      owner_email: "acme+dry-run-packet@owner.outpost.local",
      rollback: "retained_for_browser_smoke",
      run_id: "acme_packet_001",
      status: "passed_retained_data",
      tenant: {
        id: "tenant_packet_001",
        name: "Acme Fitness Dry Run acme_packet_001"
      }
    },
    browser: {
      app_origin: "https://outpost-preview-20260610-example.vercel.app",
      browser: {
        headless: true,
        isolated_profile: true
      },
      generated_at: "2026-06-21T20:01:00.000Z",
      live_provider_gate: "blocked",
      owner_email: "acme+dry-run-packet@owner.outpost.local",
      retained_evidence_status: "passed_retained_data",
      retained_setup_origin: "https://outpost-preview-20260610-example.vercel.app",
      run_id: "acme_packet_001",
      smoke: {
        hasHostedProofCopy: true,
        hasLiveProviderBoundary: true,
        hasOwnerWorkspace: true,
        hasTenantName: true,
        location: "https://outpost-preview-20260610-example.vercel.app/owner",
        title: "Outpost"
      },
      status: "browser_handoff_smoke_passed",
      tenant: {
        id: "tenant_packet_001",
        name: "Acme Fitness Dry Run acme_packet_001"
      }
    },
    rollback: {
      app_origin: "https://outpost-preview-20260610-example.vercel.app",
      checks: ["rollback_only_cleanup"],
      generated_at: "2026-06-21T20:02:00.000Z",
      live_provider_gate: "blocked",
      mode: {
        keep_data: false,
        rollback_only: true,
        vercel_curl: true
      },
      neon: {
        branch_name: "outpost-beta-access-scoped-20260621102658",
        database_name: "neondb",
        project_id: "outpost-test-project"
      },
      owner_email: "acme+dry-run-packet@owner.outpost.local",
      rollback: "rollback_only_cleanup_complete",
      run_id: "acme_packet_001",
      status: "rollback_only_cleaned",
      tenant: {
        id: "tenant_packet_001",
        name: "Acme Fitness Dry Run acme_packet_001"
      }
    }
  };
}

function writeEvidenceFiles(evidence) {
  const dir = mkdtempSync(join(tmpdir(), "outpost-acme-packet-test-"));
  const retainedPath = join(dir, "retained.json");
  const browserPath = join(dir, "browser.json");
  const rollbackPath = join(dir, "rollback.json");
  const packetPath = join(dir, "packet.md");

  writeFileSync(retainedPath, `${JSON.stringify(evidence.retained, null, 2)}\n`);
  writeFileSync(browserPath, `${JSON.stringify(evidence.browser, null, 2)}\n`);
  writeFileSync(rollbackPath, `${JSON.stringify(evidence.rollback, null, 2)}\n`);

  return { browserPath, packetPath, retainedPath, rollbackPath };
}

function runPacket(paths, extraEnv = {}) {
  return spawnSync("node", ["scripts/prepare-acme-customer-handoff-packet.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ACME_BROWSER_EVIDENCE_PATH: paths.browserPath,
      OUTPOST_ACME_CUSTOMER_PACKET_PATH: paths.packetPath,
      OUTPOST_ACME_RETAINED_EVIDENCE_PATH: paths.retainedPath,
      OUTPOST_ACME_ROLLBACK_EVIDENCE_PATH: paths.rollbackPath,
      ...extraEnv
    }
  });
}

describe("Acme Fitness customer handoff packet", () => {
  it("registers an operator packet command", () => {
    expect(packageJson).toContain('"acme:customer-handoff:packet"');
    expect(packageJson).toContain("prepare-acme-customer-handoff-packet.mjs");
  });

  it("writes a customer-safe packet from retained browser and rollback evidence", () => {
    const paths = writeEvidenceFiles(baseEvidence());
    const result = runPacket(paths);

    expect(result.status, result.stderr).toBe(0);
    const packet = readFileSync(paths.packetPath, "utf8");
    expect(packet).toContain("# Acme Fitness Customer Handoff Packet");
    expect(packet).toContain("outpost-beta-access-scoped-20260621102658");
    expect(packet).toContain("acme+dry-run-packet@owner.outpost.local");
    expect(packet).toContain("manual_source_to_answer_review");
    expect(packet).toContain("rollback-only cleanup complete");
    expect(packet).toContain("No phone or email provider activation");
    expect(packet).not.toContain("do-not-store");
    expect(packet).not.toContain("napi_");
    expect(packet).not.toContain("Bearer ");
    expect(packet).not.toContain("__Secure-neon-auth");
  });

  it("fails closed without rollback evidence", () => {
    const paths = writeEvidenceFiles(baseEvidence());
    const result = runPacket(paths, { OUTPOST_ACME_ROLLBACK_EVIDENCE_PATH: "" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OUTPOST_ACME_ROLLBACK_EVIDENCE_PATH is required");
  });

  it("fails closed when evidence contains secret-shaped keys", () => {
    const evidence = baseEvidence();
    evidence.retained.private_key = "do-not-store";
    const paths = writeEvidenceFiles(evidence);
    const result = runPacket(paths);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped key");
  });

  it("fails closed when rendered evidence contains secret-shaped values", () => {
    const evidence = baseEvidence();
    evidence.retained.checks.push("operator copied Bearer abcdefghijklmnopqrstuvwxyz012345 into notes");
    const paths = writeEvidenceFiles(evidence);
    const result = runPacket(paths);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");
  });

  it("fails closed on seeded tenants non-dry-run owners and cross-evidence mismatches", () => {
    const seededEvidence = baseEvidence();
    seededEvidence.retained.tenant.id = "tenant_acme_fitness";
    let paths = writeEvidenceFiles(seededEvidence);
    let result = runPacket(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("seeded Acme Fitness tenant");

    const customerOwnerEvidence = baseEvidence();
    customerOwnerEvidence.retained.owner_email = "owner@acmefitness.example";
    paths = writeEvidenceFiles(customerOwnerEvidence);
    result = runPacket(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("dry-run owner email");

    const mismatchedEvidence = baseEvidence();
    mismatchedEvidence.browser.tenant.id = "tenant_other";
    paths = writeEvidenceFiles(mismatchedEvidence);
    result = runPacket(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("tenant id mismatch");
  });

  it("fails closed when live-provider gates or repo-local output paths are unsafe", () => {
    const liveGateEvidence = baseEvidence();
    liveGateEvidence.browser.live_provider_gate = "enabled";
    let paths = writeEvidenceFiles(liveGateEvidence);
    let result = runPacket(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("live_provider_gate blocked");

    paths = writeEvidenceFiles(baseEvidence());
    result = runPacket(paths, { OUTPOST_ACME_CUSTOMER_PACKET_PATH: "docs/not-ignored-packet.md" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gitignored artifacts");
  });

  it("pins the customer-safe proof boundaries in code and docs", () => {
    expect(packetScript).toContain("live_provider_gate");
    expect(packetScript).toContain("blocked");
    expect(packetScript).toContain("assertNoSecretShapedValue");
    expect(packetScript).toContain("privatekey");
    expect(packetScript).toContain("authorization");
    expect(packetScript).toContain("OUTPOST_ACME_CUSTOMER_PACKET_PATH");
    expect(packetScript).toContain("artifacts/acme-customer-handoff");
    expect(packetScript).toContain("No invite email delivery");
    expect(packetScript).not.toContain("service_role");
    expect(packetScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(runbook).toContain("Customer Handoff Packet");
    expect(runbook).toContain("acme:customer-handoff:packet");
  });
});
