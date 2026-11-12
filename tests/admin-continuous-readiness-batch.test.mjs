import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { founderAdminContinuousReadinessBatch } from "../src/domain/founder-admin-readiness";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminComponent = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);

function run(script, env = {}) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function artifactPath(name) {
  const dir = "artifacts/admin-continuous-readiness-batch-tests";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return `${dir}/${name}`;
}

function removeIfExists(path) {
  rmSync(path, { force: true, recursive: true });
}

function writeJsonArtifact(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function validHandoffProofBundle(overrides = {}) {
  return {
    artifact_kind: "admin_handoff_proof_bundle",
    status: "admin_handoff_proof_bundle_prepared",
    generated_at: "2026-06-28T12:00:00.000Z",
    evidence_basis: "admin_operator_assisted_onboarding_rehearsal",
    operator_onboarding_rehearsal_path:
      "artifacts/admin-continuous-readiness-batch-tests/operator-rehearsal.json",
    operator_onboarding_rehearsal_sha256: "a".repeat(64),
    reviewed_owner_email: "owner@proof.example",
    staff_email: "coach@proof.example",
    protected_preview_url: "https://outpost-preview.example.vercel.app",
    hosted_neon_branch: "outpost-beta-access-scoped-proof",
    ready_for_internal_end_to_end_test: true,
    customer_observed_completion_recorded: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    ready_gates: [
      "Owner access browser proof",
      "Staff roster claim proof",
      "Operator-assisted onboarding rehearsal",
      "Reset and rollback reviewed",
      "No unexpected data observed",
      "No live-provider claims observed",
    ],
    blocked_gates: [
      "Public owner self-signup",
      "Invite delivery",
      "Notification sending",
      "Phone/email provider activation",
      "Product Auth admin API",
      "Automatic owner/staff grants",
      "Billing, POS, access control, member-ledger writes",
      "Customer-observed completion claim",
    ],
    replay_commands: [
      "npm run admin:owner-access:completion-proof:inspect",
      "npm run admin:staff-roster:handoff-evidence:inspect",
      "npm run admin:operator-onboarding:rehearsal:inspect",
      "npm run admin:handoff-proof:bundle:inspect",
    ],
    ...overrides,
  };
}

function validHandoffReadinessPacket(overrides = {}) {
  return {
    artifact_kind: "admin_handoff_readiness_packet",
    status: "admin_handoff_readiness_packet_exported",
    generated_at: "2026-06-28T12:05:00.000Z",
    readiness_state: "ready",
    preview_url: "https://outpost-preview.example.vercel.app",
    neon_branch_name: "outpost-beta-access-scoped-proof",
    public_self_serve_launch_allowed: false,
    live_provider_enablement_allowed: false,
    packet_inputs: {
      proof_freshness_export:
        "artifacts/admin-continuous-readiness-batch-tests/proof-freshness.json",
      next_actions_export:
        "artifacts/admin-continuous-readiness-batch-tests/next-actions.json",
      launch_readiness_export:
        "artifacts/admin-continuous-readiness-batch-tests/launch-readiness.json",
    },
    blocked_gates: [
      "browser_approval_buttons",
      "public_owner_self_signup",
      "invite_delivery",
      "notification_sending",
      "phone_email_provider_activation",
      "billing",
      "pos_access_control_member_ledger_writes",
    ],
    ...overrides,
  };
}

describe("admin continuous readiness batch", () => {
  it("wires package scripts, domain packet, and Admin portal panel", () => {
    expect(packageJson).toContain("admin:readiness-batch:prepare");
    expect(packageJson).toContain("admin:readiness-batch:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminContinuousReadinessBatch",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Continuous SaaS readiness batch"',
    );

    const packet = founderAdminContinuousReadinessBatch({
      branchName: "outpost-beta-access-scoped-proof",
      previewUrl: "https://outpost-preview.example.vercel.app",
    });
    expect(packet.title).toBe("Continuous SaaS readiness batch");
    expect(packet.commands.map((step) => step.command).join("\n")).toContain(
      "npm run admin:readiness-batch:prepare",
    );
    expect(packet.commands.map((step) => step.command).join("\n")).toContain(
      "npm run admin:readiness-batch:inspect",
    );
    expect(packet.gates.every((gate) => gate.state !== "ready")).toBe(true);
    expect(packet.nextTwoSlices.map((slice) => slice.id)).toEqual([
      "protected_preview_walkthrough",
      "customer_observed_handoff_gate",
    ]);
  });

  it("prepares and inspects a continuous readiness batch manifest", () => {
    const handoffProofPath = artifactPath("handoff-proof-bundle.json");
    const handoffReadinessPath = artifactPath("handoff-readiness-packet.json");
    const batchPath = artifactPath("continuous-readiness-batch.json");
    for (const path of [handoffProofPath, handoffReadinessPath, batchPath]) {
      removeIfExists(path);
    }
    writeJsonArtifact(handoffProofPath, validHandoffProofBundle());
    writeJsonArtifact(handoffReadinessPath, validHandoffReadinessPacket());

    const prepare = run("scripts/prepare-admin-continuous-readiness-batch.mjs", {
      OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: handoffProofPath,
      OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: handoffReadinessPath,
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
    });
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(prepare.stdout).toContain("Protected Preview walkthrough: ready");
    expect(prepare.stdout).toContain("Customer-observed handoff: blocked");

    const inspect = run("scripts/inspect-admin-continuous-readiness-batch.mjs", {
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain("Admin continuous readiness batch OK");

    const artifact = JSON.parse(readFileSync(batchPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_continuous_readiness_batch",
      ready_for_protected_preview_walkthrough: true,
      ready_for_customer_observed_handoff: false,
      customer_observed_completion_recorded: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      product_auth_admin_api_allowed: false,
      automatic_owner_staff_grants_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
  });

  it("fails closed on parent branch mismatch, live-gate flips, and production branch", () => {
    const handoffProofPath = artifactPath("unsafe-handoff-proof-bundle.json");
    const handoffReadinessPath = artifactPath("unsafe-handoff-readiness.json");
    const batchPath = artifactPath("unsafe-continuous-batch.json");
    for (const path of [handoffProofPath, handoffReadinessPath, batchPath]) {
      removeIfExists(path);
    }

    writeJsonArtifact(handoffProofPath, validHandoffProofBundle());
    writeJsonArtifact(
      handoffReadinessPath,
      validHandoffReadinessPacket({ neon_branch_name: "different-branch" }),
    );
    const mismatch = run("scripts/prepare-admin-continuous-readiness-batch.mjs", {
      OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: handoffProofPath,
      OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: handoffReadinessPath,
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
    });
    expect(mismatch.status).not.toBe(0);
    expect(mismatch.stderr).toContain("Parent hosted Neon branches must match");

    writeJsonArtifact(
      handoffReadinessPath,
      validHandoffReadinessPacket({ live_provider_enablement_allowed: true }),
    );
    const liveGate = run("scripts/prepare-admin-continuous-readiness-batch.mjs", {
      OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: handoffProofPath,
      OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: handoffReadinessPath,
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
    });
    expect(liveGate.status).not.toBe(0);
    expect(liveGate.stderr).toContain("Live providers must remain blocked");

    writeJsonArtifact(
      handoffProofPath,
      validHandoffProofBundle({ hosted_neon_branch: "Production" }),
    );
    writeJsonArtifact(handoffReadinessPath, validHandoffReadinessPacket());
  const production = run("scripts/prepare-admin-continuous-readiness-batch.mjs", {
    OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: handoffProofPath,
    OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: handoffReadinessPath,
    OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
  });
  expect(production.status).not.toBe(0);
  expect(production.stderr).toContain("production branch");

  writeJsonArtifact(
    handoffProofPath,
    validHandoffProofBundle({ hosted_neon_branch: "outpost-neon-spike" }),
  );
  const spike = run("scripts/prepare-admin-continuous-readiness-batch.mjs", {
    OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: handoffProofPath,
    OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: handoffReadinessPath,
    OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
  });
  expect(spike.status).not.toBe(0);
  expect(spike.stderr).toContain("migration spike branch");

  writeJsonArtifact(handoffProofPath, validHandoffProofBundle());
  writeJsonArtifact(handoffReadinessPath, validHandoffReadinessPacket());
  writeJsonArtifact(batchPath, { existing: true });
  const existingBatch = run("scripts/prepare-admin-continuous-readiness-batch.mjs", {
    OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: handoffProofPath,
    OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: handoffReadinessPath,
    OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
  });
  expect(existingBatch.status).not.toBe(0);
  expect(existingBatch.stderr).toContain("already exists");
});

  it("inspector fails closed on parent tampering and secret-shaped values", () => {
    const handoffProofPath = artifactPath("tamper-handoff-proof-bundle.json");
    const handoffReadinessPath = artifactPath("tamper-handoff-readiness.json");
    const batchPath = artifactPath("tamper-continuous-batch.json");
    for (const path of [handoffProofPath, handoffReadinessPath, batchPath]) {
      removeIfExists(path);
    }
    writeJsonArtifact(handoffProofPath, validHandoffProofBundle());
    writeJsonArtifact(handoffReadinessPath, validHandoffReadinessPacket());
    const prepare = run("scripts/prepare-admin-continuous-readiness-batch.mjs", {
      OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: handoffProofPath,
      OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: handoffReadinessPath,
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
    });
    expect(prepare.status, prepare.stderr).toBe(0);

    writeJsonArtifact(
      handoffProofPath,
      validHandoffProofBundle({ reviewed_owner_email: "changed@proof.example" }),
    );
    const tamper = run("scripts/inspect-admin-continuous-readiness-batch.mjs", {
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
    });
    expect(tamper.status).not.toBe(0);
    expect(tamper.stderr).toContain("Handoff proof bundle parent SHA mismatch");

    writeJsonArtifact(batchPath, {
      artifact_kind: "admin_continuous_readiness_batch",
      status: "admin_continuous_readiness_batch_prepared",
      protected_preview_url:
        "https://outpost-preview.example.vercel.app?note=napi_test_fake_key_0000000000000000000000000000000000000000000000000000",
    });
    const secret = run("scripts/inspect-admin-continuous-readiness-batch.mjs", {
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
    });
    expect(secret.status).not.toBe(0);
    expect(secret.stderr).toContain("secret-shaped value");
  });
});
