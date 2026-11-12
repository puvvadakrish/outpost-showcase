import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { founderAdminPublicRequestHostedRehearsalReadinessBatch } from "../src/domain/founder-admin-readiness";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminComponent = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);

vi.setConfig({ testTimeout: 120000 });

function run(script, env = {}) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function artifactPath(name) {
  const dir = "artifacts/admin-public-request-hosted-rehearsal-tests";
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

function writePublicLaunchPreflightFixture(prefix) {
  const reviewPath = artifactPath(`${prefix}-limited-beta-review.json`);
  const preflightPath = artifactPath(`${prefix}-public-launch-preflight.json`);
  removeIfExists(reviewPath);
  removeIfExists(preflightPath);

  writeJsonArtifact(reviewPath, {
    artifact_kind: "admin_limited_beta_operator_review_packet",
    status: "admin_limited_beta_operator_review_packet_prepared",
    candidate_gym_label: "Second Gym",
  });
  writeJsonArtifact(preflightPath, {
    artifact_kind: "admin_public_self_serve_launch_preflight",
    status: "admin_public_self_serve_launch_preflight_prepared",
    generated_at: "2026-06-30T18:00:00.000Z",
    evidence_basis: "admin_limited_beta_operator_review_packet",
    limited_beta_operator_review_packet_path: reviewPath,
    limited_beta_operator_review_packet_sha256: sha256File(reviewPath),
    candidate_gym_label: "Second Gym",
    owner_access_mode: "operator_managed_until_public_launch_gate_green",
    public_self_serve_launch_preflight_ready: true,
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_user_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: [
      "Public owner self-signup",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email provider activation",
      "Product Auth admin API",
      "Auth user creation",
      "Automatic owner/staff grants",
      "Billing, POS, access control, member-ledger writes",
    ],
    required_green_before_public_launch: [
      "At least one limited operator-assisted beta onboarding completed and reviewed.",
      "Owner access fulfillment remains operator-managed until launch gate approval.",
      "Public request intake is request-only and human-reviewed, not browser-approved.",
      "Invite delivery has no-send preflight plus separate send-provider proof.",
      "Phone/email providers, billing, POS, access control, and member-ledger writes have separate proof tracks.",
    ],
    allowed_next_work: [
      "Design public request intake as pending review only.",
      "Prepare invite-delivery no-send preflight.",
      "Prepare Auth admin dry-run without creating users.",
      "Prepare live-provider/revenue gate documents without enabling providers.",
    ],
  });

  return preflightPath;
}

function writePublicRequestOwnerStaff(prefix) {
  const preflightPath = writePublicLaunchPreflightFixture(prefix);
  const controlsPath = artifactPath(`${prefix}-controls.json`);
  const nextPath = artifactPath(`${prefix}-next.json`);
  const intakePath = artifactPath(`${prefix}-intake.json`);
  const followupPath = artifactPath(`${prefix}-followup.json`);
  const ownerStaffPath = artifactPath(`${prefix}-owner-staff.json`);
  for (const path of [controlsPath, nextPath, intakePath, followupPath, ownerStaffPath]) {
    removeIfExists(path);
  }

  let result = run("scripts/prepare-admin-public-launch-controls-batch.mjs", {
    OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH: preflightPath,
    OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
  });
  expect(result.status, result.stderr).toBe(0);
  result = run("scripts/prepare-admin-public-launch-next-readiness-batch.mjs", {
    OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
    OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
  });
  expect(result.status, result.stderr).toBe(0);
  result = run("scripts/prepare-admin-public-request-intake-artifact.mjs", {
    OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_LABEL: "Second Gym public request",
    OUTPOST_ADMIN_PUBLIC_REQUEST_CONTACT: "owner@second.example",
  });
  expect(result.status, result.stderr).toBe(0);
  result = run(
    "scripts/prepare-admin-public-request-followup-readiness-batch.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FOLLOWUP_READINESS_BATCH_PATH: followupPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  result = run(
    "scripts/prepare-admin-public-request-owner-staff-handoff-readiness-batch.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FOLLOWUP_READINESS_BATCH_PATH: followupPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
        ownerStaffPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);

  return ownerStaffPath;
}

describe("admin public request hosted rehearsal readiness", () => {
  it("prepares and inspects the current-chain hosted rehearsal bridge", () => {
    const ownerStaffPath = writePublicRequestOwnerStaff("hosted-rehearsal-happy");
    const batchPath = artifactPath("hosted-rehearsal-happy-batch.json");
    removeIfExists(batchPath);

    let result = run(
      "scripts/prepare-admin-public-request-hosted-rehearsal-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          ownerStaffPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request hosted rehearsal readiness batch prepared",
    );

    result = run(
      "scripts/inspect-admin-public-request-hosted-rehearsal-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request hosted rehearsal readiness batch inspection passed",
    );

    const artifact = JSON.parse(readFileSync(batchPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_public_request_hosted_rehearsal_readiness_batch",
      evidence_basis:
        "admin_public_request_owner_staff_handoff_readiness_batch",
      public_request_hosted_rehearsal_readiness_batch_ready: true,
      hosted_rehearsal_readiness: {
        mode: "browser_rehearsal_required_not_recorded",
        owner_workspace_check_required: true,
        staff_workboard_check_required: true,
        reset_rollback_check_required: true,
        no_unexpected_data_check_required: true,
        owner_access_evidence_recorded: false,
        staff_no_send_preflight_recorded: false,
        customer_observed_handoff_recorded: false,
        approved_gym_hosted_rehearsal_recorded: false,
        first_gym_go_no_go_bundle_ready: false,
        public_launch_decision_allowed: false,
      },
      public_request_form_submission_allowed: false,
      auth_user_created: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      public_launch_decision_allowed: false,
    });
    expect(artifact.next_readiness_batches.map((slice) => slice.id)).toEqual([
      "first_gym_go_no_go_bundle",
      "public_self_serve_preflight",
      "live_provider_revenue_gates",
    ]);

    writeJsonArtifact(batchPath, {
      ...artifact,
      hosted_rehearsal_readiness: {
        ...artifact.hosted_rehearsal_readiness,
        approved_gym_hosted_rehearsal_recorded: true,
      },
    });
    result = run(
      "scripts/inspect-admin-public-request-hosted-rehearsal-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "approved_gym_hosted_rehearsal_recorded blocked",
    );

    writeJsonArtifact(batchPath, {
      ...artifact,
      public_request_owner_staff_handoff_readiness_batch_sha256: "0".repeat(64),
    });
    result = run(
      "scripts/inspect-admin-public-request-hosted-rehearsal-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "public request owner/staff handoff readiness batch SHA256 does not match",
    );
  }, 120000);

  it("fails closed on unsafe parent and exposes Admin portal guidance", () => {
    const ownerStaffPath = writePublicRequestOwnerStaff("hosted-rehearsal-fail");
    const batchPath = artifactPath("hosted-rehearsal-fail-batch.json");
    const ownerStaff = JSON.parse(readFileSync(ownerStaffPath, "utf8"));
    writeJsonArtifact(ownerStaffPath, {
      ...ownerStaff,
      hosted_rehearsal_prerequisites: {
        ...ownerStaff.hosted_rehearsal_prerequisites,
        approved_gym_hosted_rehearsal_recorded: true,
      },
    });
    removeIfExists(batchPath);

    const result = run(
      "scripts/prepare-admin-public-request-hosted-rehearsal-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          ownerStaffPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Public request owner/staff handoff readiness inspection failed",
    );

    expect(packageJson).toContain("admin:public-request-hosted-rehearsal:batch");
    expect(packageJson).toContain("admin:public-request-hosted-rehearsal:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestHostedRehearsalReadinessBatch",
    );
    expect(founderAdminComponent).toContain(
      "Public request hosted rehearsal readiness",
    );

    const packet = founderAdminPublicRequestHostedRehearsalReadinessBatch({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-30T18:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(packet.title).toBe("Public request hosted rehearsal readiness");
    expect(packet.commands[0].command).toContain(
      "admin:public-request-hosted-rehearsal:batch",
    );
    expect(packet.commands[1].command).toContain(
      "admin:public-request-hosted-rehearsal:inspect",
    );
  }, 120000);
});
