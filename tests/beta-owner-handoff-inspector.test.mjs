import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const inspectorScript = readFileSync("scripts/inspect-beta-owner-handoff-bundle.mjs", "utf8");
const runbook = readFileSync("docs/setup/hosted-beta-operator-access.md", "utf8");

function paths() {
  const dir = mkdtempSync(join(tmpdir(), "outpost-beta-handoff-inspector-test-"));
  return {
    bundle: join(dir, "bundle.json"),
    checklist: join(dir, "checklist.md"),
    completion: join(dir, "completion.json"),
    gate: join(dir, "gate.json"),
    packet: join(dir, "packet.md")
  };
}

function writePreparedBundle(overrides = {}) {
  const artifactPaths = paths();
  mkdirSync(dirname(artifactPaths.bundle), { recursive: true });
  writeFileSync(artifactPaths.checklist, "# Summit Strength Beta Handoff Execution Checklist\n");
  writeFileSync(
    artifactPaths.packet,
    "# Summit Strength Beta Owner Handoff Packet\n\nNo claim that a customer-observed handoff has completed until recorded separately.\n"
  );
  const manifest = {
    status: "beta_owner_handoff_prepared",
    evidence_basis: "operator_generated_checklist_and_packet",
    customer_observed: false,
    generated_at: "2026-06-22T00:00:00.000Z",
    gym: "Summit Strength",
    beta_owner: {
      email: "owner@summitstrength.example",
      name: "Jordan Owner"
    },
    preview_url: "https://outpost-preview-20260610-example.vercel.app",
    neon_proof_branch: "outpost-beta-access-scoped-20260622120000",
    operator: "Outpost operator",
    support_window: "June beta proof window",
    artifacts: {
      manifest_path: artifactPaths.bundle,
      checklist_path: artifactPaths.checklist,
      packet_path: artifactPaths.packet,
      completion_path: artifactPaths.completion,
      gate_path: artifactPaths.gate
    },
    prepared_steps: ["checklist", "packet"],
    pending_steps: ["customer_observed_completion", "final_gate_validation", "hosted_record_import"],
    live_provider_gate: "blocked",
    verification_boundary:
      "This manifest records artifact preparation only; it does not record customer-observed completion or mutate hosted data.",
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
    next_command: "npm run beta:owner-handoff:complete",
    ...overrides,
    artifacts: {
      manifest_path: artifactPaths.bundle,
      checklist_path: artifactPaths.checklist,
      packet_path: artifactPaths.packet,
      completion_path: artifactPaths.completion,
      gate_path: artifactPaths.gate,
      ...(overrides.artifacts ?? {})
    }
  };
  writeFileSync(artifactPaths.bundle, `${JSON.stringify(manifest, null, 2)}\n`);

  return artifactPaths;
}

function runInspector(bundlePath) {
  return spawnSync(process.execPath, ["scripts/inspect-beta-owner-handoff-bundle.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_BETA_HANDOFF_BUNDLE_PATH: bundlePath
    }
  });
}

describe("beta owner handoff bundle inspector", () => {
  it("registers a generic handoff bundle inspection command", () => {
    expect(packageJson).toContain('"beta:owner-handoff:inspect"');
    expect(packageJson).toContain("inspect-beta-owner-handoff-bundle.mjs");
  });

  it("prints a non-secret summary for a prepared bundle", () => {
    const artifactPaths = writePreparedBundle();
    const result = runInspector(artifactPaths.bundle);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Beta owner handoff bundle inspection");
    expect(result.stdout).toContain("Status: beta_owner_handoff_prepared");
    expect(result.stdout).toContain("Customer observed: false");
    expect(result.stdout).toContain("Live-provider gate: blocked");
    expect(result.stdout).toContain("Gym: Summit Strength");
    expect(result.stdout).toContain("Owner email: owner@summitstrength.example");
    expect(result.stdout).toContain("Next: run beta:owner-handoff:complete only after a real external owner observes");
    expect(result.stdout).not.toContain("napi_");
    expect(result.stdout).not.toContain("Bearer ");
    expect(result.stdout).not.toMatch(/password\s*[:=]/iu);
  });

  it("fails closed for completed, unblocked, missing-artifact, and secret-shaped manifests", () => {
    let artifactPaths = writePreparedBundle({ customer_observed: true });
    let result = runInspector(artifactPaths.bundle);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must not be customer-observed");

    artifactPaths = writePreparedBundle({ live_provider_gate: "enabled" });
    result = runInspector(artifactPaths.bundle);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must keep the live-provider gate blocked");

    artifactPaths = writePreparedBundle({ artifacts: { checklist_path: "" } });
    result = runInspector(artifactPaths.bundle);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("bundle checklist artifact path is required");

    artifactPaths = writePreparedBundle({ operator: "api_key: nope" });
    result = runInspector(artifactPaths.bundle);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");
  });

  it("accepts equivalent inspected manifest path spellings", () => {
    const artifactPaths = writePreparedBundle();
    const equivalentBundlePath = join(dirname(artifactPaths.bundle), ".", "bundle.json");
    const result = runInspector(equivalentBundlePath);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Beta owner handoff bundle inspection");
  });

  it("pins read-only boundaries in code and docs", () => {
    expect(inspectorScript).toContain("readFileSync");
    expect(inspectorScript).not.toContain("writeFileSync");
    expect(inspectorScript).not.toMatch(
      /record-beta-owner-handoff-completion|verify-beta-owner-handoff-gate|record-customer-handoff-gate-proof|bootstrap_owner_tenant|sign-in\/email/iu
    );
    expect(inspectorScript).not.toMatch(/send.*invite|invite.*send|provider_connections|member_ledger|billing/iu);
    expect(runbook).toContain("npm run beta:owner-handoff:inspect");
  });
});
