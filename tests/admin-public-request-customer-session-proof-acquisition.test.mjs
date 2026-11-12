import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { founderAdminPublicRequestCustomerSessionProofAcquisitionBatch } from "../src/domain/founder-admin-readiness";

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
  const dir =
    "artifacts/admin-public-request-customer-session-proof-acquisition-tests";
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
    generated_at: "2026-06-30T21:00:00.000Z",
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

function writeHostedReadiness(prefix) {
  const preflightPath = writePublicLaunchPreflightFixture(prefix);
  const controlsPath = artifactPath(`${prefix}-controls.json`);
  const nextPath = artifactPath(`${prefix}-next.json`);
  const intakePath = artifactPath(`${prefix}-intake.json`);
  const followupPath = artifactPath(`${prefix}-followup.json`);
  const ownerStaffPath = artifactPath(`${prefix}-owner-staff.json`);
  const hostedPath = artifactPath(`${prefix}-hosted.json`);
  for (const path of [
    controlsPath,
    nextPath,
    intakePath,
    followupPath,
    ownerStaffPath,
    hostedPath,
  ]) {
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
  result = run(
    "scripts/prepare-admin-public-request-hosted-rehearsal-readiness-batch.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
        ownerStaffPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
        hostedPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);

  return hostedPath;
}

function writeHostedEvidence(prefix) {
  const hostedPath = writeHostedReadiness(prefix);
  const evidencePath = artifactPath(`${prefix}-evidence.json`);
  removeIfExists(evidencePath);
  const result = run(
    "scripts/record-admin-public-request-hosted-rehearsal-evidence.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
        hostedPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH: evidencePath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED: "yes",
      OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_STAFF_WORKBOARD_OBSERVED: "yes",
      OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_RESET_ROLLBACK_REVIEWED: "yes",
      OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_UNEXPECTED_DATA_NOT_OBSERVED:
        "yes",
      OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED:
        "yes",
      OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_INVITE_DELIVERY_NOT_OBSERVED:
        "yes",
      OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED:
        "yes",
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return evidencePath;
}

describe("admin public request customer-session proof acquisition", () => {
  it("prepares and inspects the current-chain customer-session proof acquisition packet", () => {
    const evidencePath = writeHostedEvidence("customer-session-happy");
    const batchPath = artifactPath("customer-session-happy-batch.json");
    removeIfExists(batchPath);

    let result = run(
      "scripts/prepare-admin-public-request-customer-session-proof-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH:
          evidencePath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request customer-session proof acquisition batch prepared",
    );

    result = run(
      "scripts/inspect-admin-public-request-customer-session-proof-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request customer-session proof acquisition batch inspection passed",
    );

    const artifact = JSON.parse(readFileSync(batchPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind:
        "admin_public_request_customer_session_proof_acquisition_batch",
      evidence_basis: "admin_public_request_hosted_rehearsal_evidence",
      public_request_customer_session_proof_acquisition_batch_ready: true,
      proof_acquisition: {
        mode: "current_chain_customer_session_command_packet_only",
        customer_observed_session_command_required: true,
        customer_session_hosted_import_required: true,
        hosted_customer_session_proof_required: true,
        customer_observed_session_recorded: false,
        customer_observed_handoff_claimed: false,
        customer_session_hosted_import_recorded: false,
        hosted_customer_session_proof_recorded: false,
        first_gym_go_no_go_bundle_ready: false,
        first_gym_operator_run_recorded: false,
      },
      public_request_form_submission_allowed: false,
      auth_user_created: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      public_launch_decision_allowed: false,
    });
    expect(artifact.command_sequence.map((slice) => slice.id)).toEqual([
      "customer_observed_handoff_gate",
      "customer_observed_handoff_gate",
      "hosted_customer_session_proof",
      "first_gym_go_no_go_bundle",
    ]);

    writeJsonArtifact(batchPath, {
      ...artifact,
      public_request_hosted_rehearsal_evidence_sha256: "0".repeat(64),
    });
    result = run(
      "scripts/inspect-admin-public-request-customer-session-proof-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Public request hosted rehearsal evidence SHA256 does not match.",
    );

    writeJsonArtifact(batchPath, {
      ...artifact,
      proof_acquisition: {
        ...artifact.proof_acquisition,
        customer_observed_session_recorded: true,
      },
    });
    result = run(
      "scripts/inspect-admin-public-request-customer-session-proof-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "customer_observed_session_recorded blocked",
    );

    writeJsonArtifact(batchPath, {
      ...artifact,
      live_provider_enablement_allowed: true,
    });
    result = run(
      "scripts/inspect-admin-public-request-customer-session-proof-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("live_provider_enablement_allowed blocked");
  });

  it("fails closed on unsafe parent and exposes Admin portal guidance", () => {
    const evidencePath = writeHostedEvidence("customer-session-fail");
    const unsafeEvidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    writeJsonArtifact(evidencePath, {
      ...unsafeEvidence,
      customer_observed_session_recorded: true,
    });
    const batchPath = artifactPath("customer-session-fail-batch.json");
    removeIfExists(batchPath);

    const result = run(
      "scripts/prepare-admin-public-request-customer-session-proof-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH:
          evidencePath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Public request hosted rehearsal evidence inspection failed",
    );

    expect(packageJson).toContain(
      "admin:public-request-customer-session:proof-acquisition",
    );
    expect(packageJson).toContain(
      "admin:public-request-customer-session:proof-acquisition:inspect",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestCustomerSessionProofAcquisitionBatch",
    );
    expect(founderAdminComponent).toContain(
      "Public request customer session proof acquisition",
    );

    const packet = founderAdminPublicRequestCustomerSessionProofAcquisitionBatch(
      {
        branchName: "outpost-proof-branch",
        previewUrl: "https://outpost-preview.example.vercel.app",
        generatedAt: "2026-06-30T21:00:00.000Z",
        gates: [],
        proofRuns: [],
        state: "pending",
        summary: "proof",
      },
    );
    expect(packet.title).toBe(
      "Public request customer-session proof acquisition",
    );
    expect(packet.commands[0].command).toContain(
      "admin:public-request-customer-session:proof-acquisition",
    );
    expect(packet.commands[1].command).toContain(
      "admin:public-request-customer-session:proof-acquisition:inspect",
    );
    expect(packet.nextReadinessBatches.map((slice) => slice.id)).toEqual([
      "customer_observed_handoff_gate",
      "hosted_customer_session_proof",
      "first_gym_go_no_go_bundle",
      "live_provider_revenue_gates",
    ]);
  });
});
