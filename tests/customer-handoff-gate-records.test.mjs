import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const recordScript = readFileSync("scripts/record-customer-handoff-gate-proof.mjs", "utf8");
const hostedFounderAdminScript = readFileSync("scripts/verify-hosted-founder-admin-readiness.mjs", "utf8");
const customerPacketLinkMigration = readFileSync("neon/migrations/20260625020000_customer_handoff_admin_packet_link.sql", "utf8");

function gateRecord(overrides = {}) {
  return {
    status: "customer_observed_beta_handoff_gate_passed",
    evidence_basis: "validated_packet_and_customer_observed_completion_artifacts",
    generated_at: "2026-06-22T22:00:00.000Z",
    session_at: "2026-06-22T21:00:00.000Z",
    gym: "Summit Strength",
    beta_owner: "Jordan Owner <owner@summitstrength.example>",
    preview_url: "https://outpost-preview-20260610-example.vercel.app",
    neon_proof_branch: "outpost-beta-access-scoped-20260622120000",
    observer: "Outpost operator",
    participant: "Summit Strength owner",
    gates: {
      customer_observed: "passed",
      protected_preview: "observed",
      owner_sign_in: "observed",
      owner_workspace: "observed",
      manual_source_answer_staff_task_flow: "observed",
      reset_rollback_review: "observed",
      unexpected_data: "none_reported",
      live_providers: "blocked",
      self_serve: "blocked",
      invite_delivery: "blocked",
      notifications: "blocked",
      phone_email_providers: "blocked",
      billing_pos_member_ledger: "blocked"
    },
    non_goals: [
      "public_self_signup",
      "invite_delivery",
      "notification_sending",
      "phone_provider_activation",
      "email_provider_activation",
      "billing",
      "pos",
      "access_control",
      "member_ledger_writes"
    ],
    ...overrides
  };
}

function writeGate(gate = gateRecord()) {
  const dir = mkdtempSync(join(tmpdir(), "outpost-customer-handoff-record-test-"));
  const gatePath = join(dir, "gate.json");
  writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);
  return gatePath;
}

function writeGateWith(overrides) {
  return writeGate(gateRecord(overrides));
}

function runRecord(gatePath, extraEnv = {}) {
  return spawnSync("node", ["scripts/record-customer-handoff-gate-proof.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-proof.neonauth.neon.tech/neondb/auth",
      NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-proof.apirest.neon.tech/neondb/rest/v1",
      NEXT_PUBLIC_OUTPOST_APP_URL: "https://outpost-preview-20260610-example.vercel.app",
      OUTPOST_BETA_HANDOFF_GATE_PATH: gatePath,
      OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-20260622120000",
      OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
      OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-proof-password",
      ...extraEnv
    }
  });
}

describe("customer handoff gate proof records", () => {
  it("registers a hosted customer-observed proof import command", () => {
    expect(packageJson).toContain('"beta:owner-handoff:record"');
    expect(packageJson).toContain("record-customer-handoff-gate-proof.mjs");
  });

  it("fails closed before Neon writes for unsafe hosted env or mismatched gate evidence", () => {
    let result = runRecord(writeGate(), {
      OUTPOST_NEON_BRANCH_NAME: "production"
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Refusing customer handoff proof import against the Neon production branch");

    result = runRecord(writeGateWith({ neon_proof_branch: "outpost-other-branch" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gate Neon proof branch must match OUTPOST_NEON_BRANCH_NAME");

    result = runRecord(writeGateWith({ preview_url: "https://different-preview.vercel.app" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gate Preview URL");
    expect(result.stderr).toContain("import Preview origin");

    result = runRecord(writeGateWith({ gates: { ...gateRecord().gates, live_providers: "enabled" } }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gate live_providers must be blocked");

    result = runRecord(writeGateWith({ beta_owner: "Jordan Owner api_key: nope" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");

    result = runRecord(writeGateWith({ participant: "Outpost internal dry-run operator" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("external beta owner or customer");

    result = runRecord(writeGateWith({ observer: "Summit Strength owner" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("participant must be distinct");
  });

  it("imports only a sanitized append-only record shape", () => {
    expect(recordScript).toContain("customer_handoff_gate_records");
    expect(recordScript).toContain("customer_observed_beta_handoff_gate_passed");
    expect(recordScript).toContain("createHash");
    expect(recordScript).toContain("sourceArtifactSha256");
    expect(recordScript).toContain("adminHandoffPacketSha256");
expect(recordScript).toContain("admin_handoff_packet_sha256");
expect(recordScript).toContain("validated_admin_handoff_packet_customer_packet_and_completion_artifacts");
expect(recordScript).toContain("assertNoSecretShapedValue(output, label)");
expect(recordScript).toContain("on conflict (id) do nothing");
    expect(recordScript).toContain("summary: {");
    expect(recordScript).toContain("member_ledger_writes");
    expect(recordScript).toContain("Refusing customer handoff proof import against the Neon production branch");
    expect(recordScript).toContain("gate participant must be the external beta owner or customer");
    expect(recordScript).toContain("must live under gitignored artifacts/ when repo-local");
    expect(recordScript).not.toContain("service_role");
    expect(recordScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(recordScript).not.toMatch(/summary[\s\S]{0,260}(password|api[_-]?key|cookie|token)/iu);
  });

  it("extends hosted admin portal proof to cover the customer handoff gate projection", () => {
    expect(hostedFounderAdminScript).toContain("list_founder_admin_customer_handoff_gate_records");
    expect(hostedFounderAdminScript).toContain("assertAuthorizedCustomerHandoffGateReport");
    expect(hostedFounderAdminScript).toContain("assertAnonymousCustomerHandoffGateRecordsDenied");
    expect(hostedFounderAdminScript).toContain("customer_handoff_gate_projection");
    expect(hostedFounderAdminScript).toContain("owner, staff, and anonymous sessions cannot read proof records");
    expect(customerPacketLinkMigration).toContain("alter table customer_handoff_gate_records");
    expect(customerPacketLinkMigration).toContain("admin_handoff_packet_sha256");
    expect(customerPacketLinkMigration).toContain("references admin_handoff_packet_records(packet_sha256)");
    expect(customerPacketLinkMigration).toContain("customer_handoff_gate_records_admin_packet_sha_shape");
    expect(customerPacketLinkMigration).toContain("app_admins.status = 'active'");
    expect(customerPacketLinkMigration).toContain("memberships.role = 'founder_admin'");
  });
});
