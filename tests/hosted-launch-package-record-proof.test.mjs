import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const script = readFileSync("scripts/verify-hosted-launch-package-record-proof.mjs", "utf8");

describe("hosted launch package record proof", () => {
  it("registers a guarded hosted package proof command", () => {
    expect(packageJson).toContain('"hosted:launch-package:record-proof"');
    expect(packageJson).toContain("verify-hosted-launch-package-record-proof.mjs");
    expect(script).toContain("readHostedReadinessConfig");
    expect(script).toContain("hosted:readiness");
    expect(script).toContain("hosted:admin-portal-readiness");
    expect(script).toContain("hosted:owner-handoff:prepare");
    expect(script).toContain("beta:owner-handoff:message");
    expect(script).toContain("admin:launch-readiness:bundle");
    expect(script).toContain("admin:launch-package:record");
    expect(script).toContain("admin_launch_package_records");
    expect(script).toContain("hosted_proof_runs");
    expect(script).toContain("customer_handoff_gate_records");
    expect(script).toContain("owner_beta_access_fulfillment_receipts");
    expect(script).toContain("rollback_ready_owner");
    expect(script).toContain("tenants.name like '% Dry Run %'");
    expect(script).toContain("owner_memberships.role = 'owner'");
    expect(script).toContain("customer_observed_beta_handoff_gate_passed");
    expect(script).toContain("public_self_serve_launch_allowed = false");
    expect(script).toContain("OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF");
    expect(script).not.toMatch(/submit_owner_beta_access_request|bootstrap_owner_tenant|sendInvite|sendEmail|provider_connections\s+set/iu);
  });

  it("fails closed before hosted writes when required hosted env is missing", () => {
    const result = spawnSync("node", ["scripts/verify-hosted-launch-package-record-proof.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test"
      }
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/OUTPOST_NEON_PROJECT_ID|NEXT_PUBLIC_NEON_AUTH_URL|NEXT_PUBLIC_NEON_DATA_API_URL/u);
    expect(result.stdout).toBe("");
  });

  it("keeps production, spike, local, and secret-shaped guardrails in the script", () => {
    expect(script).toContain("Refusing hosted launch package proof against the Neon production branch");
    expect(script).toContain("Refusing hosted launch package proof against the migration spike branch");
    expect(script).toContain("Hosted launch package proof refuses local app origins");
    expect(script).toContain("Hosted launch package proof refuses production-like Vercel origins");
    expect(script).toContain("Hosted launch package Preview URL must not include credentials");
    expect(script).toContain("assertNoSecretShapedValue(output");
    expect(script).toContain("assertEvidenceReady(evidence)");
    expect(script).toContain("Hosted launch package record proof is blocked: missing");
    expect(script).toContain("rollback-ready disposable owner workspace");
    expect(script).toContain("Rollback-ready owner workspace did not match the fulfilled owner email");
    expect(script).toContain("Fulfillment receipt owner email");
    expect(script).toContain("Admin launch package record was not found after import");
    expect(script).not.toContain("existing_launch_package_count");
  });
});
