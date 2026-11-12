import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { founderAdminPostCustomerProofReadinessBatch } from "../src/domain/founder-admin-readiness";

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
  const dir = "artifacts/admin-post-customer-proof-readiness-tests";
  mkdirSync(dir, { recursive: true });
  return `${dir}/${name}`;
}

function removeIfExists(path) {
  rmSync(path, { force: true, recursive: true });
}

function writeJsonArtifact(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
}

function validProtectedPreviewWalkthrough(overrides = {}) {
  return {
    artifact_kind: "admin_protected_preview_walkthrough",
    status: "admin_protected_preview_walkthrough_recorded",
    generated_at: "2026-06-29T12:00:00.000Z",
    evidence_basis: "admin_continuous_readiness_batch",
    continuous_readiness_batch_path:
      "artifacts/admin-post-customer-proof-readiness-tests/continuous.json",
    continuous_readiness_batch_sha256: "a".repeat(64),
    protected_preview_url: "https://outpost-preview.example.vercel.app",
    hosted_neon_branch: "outpost-proof-branch",
    reviewed_owner_email: "owner@proof.example",
    staff_email: "coach@proof.example",
    operator_label: "Krish",
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
    observations: {
      admin_portal_observed: true,
      billing_pos_member_writes_blocked: true,
      invite_delivery_blocked: true,
      live_provider_claims_blocked: true,
      owner_workspace_observed: true,
      public_self_serve_blocked: true,
      reset_rollback_reviewed: true,
      staff_workboard_observed: true,
      unexpected_data_not_observed: true,
    },
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
    ...overrides,
  };
}

function validSchedulingBatch(walkthroughPath, overrides = {}) {
  return {
    artifact_kind: "admin_customer_handoff_scheduling_batch",
    status: "admin_customer_handoff_scheduling_batch_prepared",
    generated_at: "2026-06-29T12:05:00.000Z",
    evidence_basis: "admin_protected_preview_walkthrough",
    protected_preview_walkthrough_path: walkthroughPath,
    protected_preview_walkthrough_sha256: sha256File(walkthroughPath),
    protected_preview_url: "https://outpost-preview.example.vercel.app",
    hosted_neon_branch: "outpost-proof-branch",
    gym_name: "Proof Gym",
    owner_email: "owner@proof.example",
    operator_label: "Krish",
    support_window: "Tuesday 10am",
    customer_handoff_scheduling_ready: true,
    ready_to_schedule_customer_observed_handoff: true,
    customer_observed_completion_recorded: false,
    customer_observed_handoff_claimed: false,
    public_self_serve_launch_allowed: false,
    browser_approval_buttons_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    customer_session_agenda: [
      "Confirm owner can access protected Preview.",
      "Walk through owner workspace current beta readiness state.",
      "Walk through the owner workspace and current beta readiness state.",
      "Review staff handoff path.",
      "Review reset and rollback support checklist.",
      "Confirm no live-provider, invite delivery, billing, POS, access control, or member-ledger claims.",
    ],
    support_checklist: [
      "Keep rotated owner credential shared outside artifact.",
      "Do not record customer-observed completion until the owner completes the session.",
      "Stop handoff if owner sees unexpected tenant data or live-provider claims.",
      "Do not record customer-observed completion until owner completes session.",
      "Retain reset/rollback path before reusing hosted proof branch.",
    ],
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
      "npm run admin:preview-walkthrough:inspect",
      "npm run admin:customer-handoff:schedule:inspect",
    ],
    ...overrides,
  };
}

function writeLimitedBetaGateChain(label = "proof") {
  const walkthroughPath = artifactPath(`${label}-walkthrough.json`);
  const schedulingPath = artifactPath(`${label}-scheduling.json`);
  const gatePreflightPath = artifactPath(`${label}-gate-preflight.json`);
  const importReadinessPath = artifactPath(`${label}-import-readiness.json`);
  const limitedBetaGatePath = artifactPath(`${label}-limited-beta-gate.json`);
  for (const path of [
    walkthroughPath,
    schedulingPath,
    gatePreflightPath,
    importReadinessPath,
    limitedBetaGatePath,
  ]) {
    removeIfExists(path);
  }
  writeJsonArtifact(walkthroughPath, validProtectedPreviewWalkthrough());
  writeJsonArtifact(schedulingPath, validSchedulingBatch(walkthroughPath));
  const gatePreflight = run("scripts/prepare-admin-customer-handoff-gate-preflight.mjs", {
    OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: gatePreflightPath,
    OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
  });
  expect(gatePreflight.status, gatePreflight.stderr).toBe(0);
  const importReadiness = run(
    "scripts/prepare-admin-customer-session-hosted-import-readiness.mjs",
    {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: gatePreflightPath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH:
        importReadinessPath,
    },
  );
  expect(importReadiness.status, importReadiness.stderr).toBe(0);
  const limitedBetaGate = run("scripts/prepare-admin-limited-beta-readiness-gate.mjs", {
    OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH:
      importReadinessPath,
    OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: limitedBetaGatePath,
  });
  expect(limitedBetaGate.status, limitedBetaGate.stderr).toBe(0);
  return { limitedBetaGatePath, schedulingPath };
}

function writeCustomerSessionRecord(label, schedulingPath, overrides = {}) {
  const recordPath = artifactPath(`${label}-customer-session-record.json`);
  removeIfExists(recordPath);
  const record = run("scripts/record-admin-customer-observed-session.mjs", {
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: schedulingPath,
    OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
    OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_WORKSPACE_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_STAFF_HANDOFF_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_RESET_ROLLBACK_REVIEWED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_INVITE_DELIVERY_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_LABEL: "Proof Owner",
    OUTPOST_ADMIN_CUSTOMER_SESSION_OPERATOR: "Krish",
  });
  expect(record.status, record.stderr).toBe(0);
  if (Object.keys(overrides).length > 0) {
    const artifact = JSON.parse(readFileSync(recordPath, "utf8"));
    writeJsonArtifact(recordPath, { ...artifact, ...overrides });
  }
  return recordPath;
}

describe("admin post-customer-proof readiness batch", () => {
  it("prepares and inspects the continuous post-customer-proof readiness batch", () => {
    const { limitedBetaGatePath, schedulingPath } =
      writeLimitedBetaGateChain("happy");
    const recordPath = writeCustomerSessionRecord("happy", schedulingPath);
    const batchPath = artifactPath("happy-post-customer-proof-batch.json");
    removeIfExists(batchPath);

    const prepare = run("scripts/prepare-admin-post-customer-proof-readiness-batch.mjs", {
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: limitedBetaGatePath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: batchPath,
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_HOSTED_PROOF_OBSERVED: "yes",
    });
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(prepare.stdout).toContain(
      "Limited operator-assisted beta onboarding: ready for operator review",
    );

    const inspect = run("scripts/inspect-admin-post-customer-proof-readiness-batch.mjs", {
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: batchPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain("Admin post-customer-proof readiness batch OK");

    const artifact = JSON.parse(readFileSync(batchPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_post_customer_proof_readiness_batch",
      hosted_customer_session_proof_observed: true,
      limited_operator_assisted_beta_onboarding_ready: true,
      public_self_serve_preflight_ready: true,
      public_self_serve_launch_allowed: false,
      browser_approval_buttons_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      product_auth_admin_api_allowed: false,
      automatic_owner_staff_grants_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(artifact.next_batches.map((slice) => slice.id)).toEqual([
      "limited_operator_assisted_beta_onboarding",
      "public_self_serve_preflight",
      "live_provider_revenue_gates",
    ]);
  }, 30000);

  it("fails closed without hosted proof attestation, real customer participant, and untampered parent SHA", () => {
    const { limitedBetaGatePath, schedulingPath } =
      writeLimitedBetaGateChain("fail");
    const recordPath = writeCustomerSessionRecord("fail", schedulingPath);
    const batchPath = artifactPath("fail-post-customer-proof-batch.json");
    removeIfExists(batchPath);

    let result = run("scripts/prepare-admin-post-customer-proof-readiness-batch.mjs", {
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: limitedBetaGatePath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: batchPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "OUTPOST_ADMIN_POST_CUSTOMER_PROOF_HOSTED_PROOF_OBSERVED=yes is required",
    );

    const dryRunRecordPath = writeCustomerSessionRecord("dry-run", schedulingPath, {
      owner_label: "Dry Run Owner",
    });
    result = run("scripts/prepare-admin-post-customer-proof-readiness-batch.mjs", {
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: limitedBetaGatePath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: dryRunRecordPath,
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: batchPath,
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_HOSTED_PROOF_OBSERVED: "yes",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "must not use internal, fixture, or dry-run participant labels",
    );

    result = run("scripts/prepare-admin-post-customer-proof-readiness-batch.mjs", {
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: limitedBetaGatePath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: batchPath,
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_HOSTED_PROOF_OBSERVED: "yes",
    });
    expect(result.status, result.stderr).toBe(0);
    const batch = JSON.parse(readFileSync(batchPath, "utf8"));
    writeJsonArtifact(batchPath, {
      ...batch,
      customer_session_record_sha256: "0".repeat(64),
    });
    result = run("scripts/inspect-admin-post-customer-proof-readiness-batch.mjs", {
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: batchPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Customer session record SHA256 does not match");
  }, 30000);

  it("exposes npm scripts and Admin console commands", () => {
    expect(packageJson).toContain("admin:post-customer-proof:batch");
    expect(packageJson).toContain("admin:post-customer-proof:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminPostCustomerProofReadinessBatch",
    );
    expect(founderAdminComponent).toContain("Post-customer-proof readiness batch");

    const packet = founderAdminPostCustomerProofReadinessBatch({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-29T12:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(packet.title).toBe("Post-customer-proof readiness batch");
    expect(packet.commands[0].command).toContain("admin:post-customer-proof:batch");
    expect(packet.commands[0].command).toContain(
      "OUTPOST_ADMIN_POST_CUSTOMER_PROOF_HOSTED_PROOF_OBSERVED='yes'",
    );
    expect(packet.nextReadinessBatches.map((slice) => slice.id)).toEqual([
      "limited_operator_assisted_beta_onboarding",
      "public_self_serve_preflight",
      "live_provider_revenue_gates",
    ]);
  });
});
