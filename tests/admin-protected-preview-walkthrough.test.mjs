import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { founderAdminProtectedPreviewWalkthrough } from "../src/domain/founder-admin-readiness";

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
  const dir = "artifacts/admin-protected-preview-walkthrough-tests";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return `${dir}/${name}`;
}

function removeIfExists(path) {
  rmSync(path, { force: true, recursive: true });
}

function writeJsonArtifact(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function validContinuousReadinessBatch(overrides = {}) {
  return {
    artifact_kind: "admin_continuous_readiness_batch",
    status: "admin_continuous_readiness_batch_prepared",
    generated_at: "2026-06-28T12:00:00.000Z",
    evidence_basis: "handoff_proof_bundle_and_handoff_readiness_packet",
    handoff_proof_bundle_path:
      "artifacts/admin-protected-preview-walkthrough-tests/handoff-proof.json",
    handoff_proof_bundle_sha256: "a".repeat(64),
    handoff_readiness_packet_path:
      "artifacts/admin-protected-preview-walkthrough-tests/readiness.json",
    handoff_readiness_packet_sha256: "b".repeat(64),
    protected_preview_url: "https://outpost-preview.example.vercel.app",
    hosted_neon_branch: "outpost-beta-access-scoped-proof",
    reviewed_owner_email: "owner@proof.example",
    staff_email: "coach@proof.example",
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
    blocked_gates: [
      "Customer-observed completion claim",
      "Public owner self-signup",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email provider activation",
      "Product Auth admin API",
      "Automatic owner/staff grants",
      "Billing, POS, access control, member-ledger writes",
    ],
    replay_commands: [
      "npm run admin:handoff-proof:bundle:inspect",
      "npm run admin:handoff-readiness:inspect",
      "npm run admin:readiness-batch:inspect",
    ],
    ...overrides,
  };
}

function requiredObservationEnv() {
  return {
    OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_ADMIN_OBSERVED: "yes",
    OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_OWNER_OBSERVED: "yes",
    OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_STAFF_OBSERVED: "yes",
    OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_RESET_ROLLBACK_REVIEWED: "yes",
    OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_LIVE_PROVIDER_CLAIMS_BLOCKED: "yes",
    OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_PUBLIC_SELF_SERVE_BLOCKED: "yes",
    OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_INVITE_DELIVERY_BLOCKED: "yes",
    OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_BILLING_POS_MEMBER_WRITES_BLOCKED: "yes",
    OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_OPERATOR: "operator-proof",
  };
}

describe("admin protected Preview walkthrough batch", () => {
  it("wires package scripts, domain packet, and Admin portal panel", () => {
    expect(packageJson).toContain("admin:preview-walkthrough:record");
    expect(packageJson).toContain("admin:preview-walkthrough:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminProtectedPreviewWalkthrough",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Protected Preview walkthrough batch"',
    );

    const packet = founderAdminProtectedPreviewWalkthrough({
      branchName: "outpost-beta-access-scoped-proof",
      previewUrl: "https://outpost-preview.example.vercel.app",
    });
    expect(packet.title).toBe("Protected Preview walkthrough batch");
    expect(packet.commands.map((step) => step.command).join("\n")).toContain(
      "npm run admin:preview-walkthrough:record",
    );
    expect(packet.commands.map((step) => step.command).join("\n")).toContain(
      "npm run admin:preview-walkthrough:inspect",
    );
    expect(packet.nextReadinessBatches).toHaveLength(4);
    expect(packet.nextReadinessBatches.map((slice) => slice.id)).toEqual([
      "customer_observed_handoff_gate",
      "limited_operator_assisted_beta_onboarding",
      "public_self_serve_preflight",
      "live_provider_revenue_gates",
    ]);
  });

  it("records and inspects protected Preview walkthrough artifact", () => {
    const batchPath = artifactPath("continuous-readiness-batch.json");
    const walkthroughPath = artifactPath("protected-preview-walkthrough.json");
    for (const path of [batchPath, walkthroughPath]) removeIfExists(path);

    writeJsonArtifact(batchPath, validContinuousReadinessBatch());
    const record = run("scripts/record-admin-protected-preview-walkthrough.mjs", {
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      ...requiredObservationEnv(),
    });
    expect(record.status, record.stderr).toBe(0);
    expect(record.stdout).toContain("Internal walkthrough: recorded");
    expect(record.stdout).toContain("Customer-observed handoff: not recorded");

    const inspect = run("scripts/inspect-admin-protected-preview-walkthrough.mjs", {
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain("Admin protected Preview walkthrough OK");

    const artifact = JSON.parse(readFileSync(walkthroughPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_protected_preview_walkthrough",
      internal_protected_preview_walkthrough_recorded: true,
      ready_to_schedule_customer_observed_handoff: true,
      customer_observed_completion_recorded: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      product_auth_admin_api_allowed: false,
      automatic_owner_staff_grants_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(artifact.next_batches).toHaveLength(4);
  });

  it("fails closed on missing observation, unsafe branch, and existing output", () => {
    const batchPath = artifactPath("unsafe-continuous-readiness-batch.json");
    const walkthroughPath = artifactPath("unsafe-protected-preview.json");
    for (const path of [batchPath, walkthroughPath]) removeIfExists(path);

    writeJsonArtifact(batchPath, validContinuousReadinessBatch());
    const missing = run("scripts/record-admin-protected-preview-walkthrough.mjs", {
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      ...requiredObservationEnv(),
      OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_STAFF_OBSERVED: "",
    });
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain(
      "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_STAFF_OBSERVED=yes is required",
    );

    writeJsonArtifact(
      batchPath,
      validContinuousReadinessBatch({ hosted_neon_branch: "outpost-neon-spike" }),
    );
    const spike = run("scripts/record-admin-protected-preview-walkthrough.mjs", {
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      ...requiredObservationEnv(),
    });
    expect(spike.status).not.toBe(0);
    expect(spike.stderr).toContain("migration spike branch");

    writeJsonArtifact(
      batchPath,
      validContinuousReadinessBatch({ protected_preview_url: "http://localhost:3000" }),
    );
    const localPreview = run(
      "scripts/record-admin-protected-preview-walkthrough.mjs",
      {
        OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
        OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
        ...requiredObservationEnv(),
      },
    );
    expect(localPreview.status).not.toBe(0);
    expect(localPreview.stderr).toContain("Preview URL must use https");

    writeJsonArtifact(batchPath, validContinuousReadinessBatch());
    writeJsonArtifact(walkthroughPath, { existing: true });
    const existing = run("scripts/record-admin-protected-preview-walkthrough.mjs", {
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      ...requiredObservationEnv(),
    });
    expect(existing.status).not.toBe(0);
    expect(existing.stderr).toContain("already exists");
  });

  it("inspector fails closed on parent tampering and secret-shaped values", () => {
    const batchPath = artifactPath("tamper-continuous-readiness-batch.json");
    const walkthroughPath = artifactPath("tamper-protected-preview.json");
    for (const path of [batchPath, walkthroughPath]) removeIfExists(path);

    writeJsonArtifact(batchPath, validContinuousReadinessBatch());
    const record = run("scripts/record-admin-protected-preview-walkthrough.mjs", {
      OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH: batchPath,
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      ...requiredObservationEnv(),
    });
    expect(record.status, record.stderr).toBe(0);

    writeJsonArtifact(
      batchPath,
      validContinuousReadinessBatch({ reviewed_owner_email: "changed@proof.example" }),
    );
    const tamper = run("scripts/inspect-admin-protected-preview-walkthrough.mjs", {
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
    });
    expect(tamper.status).not.toBe(0);
    expect(tamper.stderr).toContain("Continuous readiness parent SHA mismatch");

    writeJsonArtifact(batchPath, validContinuousReadinessBatch());
    const withFalseObservation = JSON.parse(readFileSync(walkthroughPath, "utf8"));
    writeJsonArtifact(walkthroughPath, {
      ...withFalseObservation,
      continuous_readiness_batch_sha256: withFalseObservation.continuous_readiness_batch_sha256,
      observations: {
        ...withFalseObservation.observations,
        owner_workspace_observed: false,
      },
    });
    const falseObservation = run(
      "scripts/inspect-admin-protected-preview-walkthrough.mjs",
      {
        OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      },
    );
    expect(falseObservation.status).not.toBe(0);
    expect(falseObservation.stderr).toContain(
      "Observation owner_workspace_observed must be true",
    );

    const artifact = JSON.parse(readFileSync(walkthroughPath, "utf8"));
    writeJsonArtifact(walkthroughPath, {
      ...artifact,
      notes:
        "napi_test_fake_key_0000000000000000000000000000000000000000000000000000",
    });
    const secret = run("scripts/inspect-admin-protected-preview-walkthrough.mjs", {
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
    });
    expect(secret.status).not.toBe(0);
    expect(secret.stderr).toContain("secret-shaped value");
  });
});
