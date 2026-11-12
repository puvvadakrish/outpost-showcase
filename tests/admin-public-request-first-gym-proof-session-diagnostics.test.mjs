import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  founderAdminPublicRequestFirstGymProofSessionDiagnostics,
  founderAdminPublicRequestFirstGymProofSessionFollowupPreflight,
  founderAdminPublicRequestFirstGymProofSessionLaunchCheckpoint,
  founderAdminPublicRequestFirstGymProofCommandExecutionEnvelope,
  founderAdminPublicRequestFirstGymProofEvidenceIntakeManifest,
  founderAdminPublicRequestFirstGymProofEvidenceSessionHandoff,
  founderAdminPublicRequestFirstGymProofEvidenceSessionLedger,
  founderAdminPublicRequestFirstGymEvidenceExecutionReadiness,
  founderAdminPublicRequestFirstGymEvidenceRunCoordinator,
  founderAdminPublicRequestFirstGymProtectedPreviewEvidencePreflight,
  founderAdminPublicRequestFirstGymRealEvidenceExecutionGuard,
  founderAdminPublicRequestFirstGymRealEvidenceExecutionPacket,
  founderAdminPublicRequestFirstGymRealEvidenceRefreshCoordinator,
  founderAdminPublicRequestFirstGymRealEvidenceAttemptReadiness,
} from "../src/domain/founder-admin-readiness";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminComponent = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);

vi.setConfig({ testTimeout: 600000 });

function run(script, env = {}) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function artifactPath(name) {
  const dir =
    "artifacts/admin-public-request-first-gym-proof-session-diagnostics-tests";
  mkdirSync(dir, { recursive: true });
  return `${dir}/${name}`;
}

function removeIfExists(path) {
  rmSync(path, { force: true, recursive: true });
}

function writeJsonArtifact(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonArtifact(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
}

function blockedFlags() {
  return {
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    public_request_form_submission_allowed: false,
    public_submission_accepted: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    owner_provisioning_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_user_created: false,
    magic_link_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    phone_email_provider_activation_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    access_control_writes_allowed: false,
    member_ledger_writes_allowed: false,
    provider_ingress_allowed: false,
    provider_egress_allowed: false,
    public_launch_decision_allowed: false,
  };
}

function writeGoNoGoReadiness(prefix) {
  const hostedPath = artifactPath(`${prefix}-hosted-rehearsal-readiness.json`);
  const readinessPath = artifactPath(`${prefix}-go-no-go-readiness.json`);
  removeIfExists(hostedPath);
  removeIfExists(readinessPath);
  writeJsonArtifact(hostedPath, {
    artifact_kind: "admin_public_request_hosted_rehearsal_readiness_batch",
    candidate_gym_label: "Second Gym",
  });
  writeJsonArtifact(readinessPath, {
    artifact_kind: "admin_public_request_first_gym_go_no_go_readiness_batch",
    status: "admin_public_request_first_gym_go_no_go_readiness_batch_prepared",
    generated_at: "2026-07-02T19:00:00.000Z",
    evidence_basis: "admin_public_request_hosted_rehearsal_readiness_batch",
    public_request_hosted_rehearsal_readiness_batch_path: hostedPath,
    public_request_hosted_rehearsal_readiness_batch_sha256: sha256File(hostedPath),
    candidate_gym_label: "Second Gym",
    public_request_first_gym_go_no_go_readiness_batch_ready: true,
    first_gym_go_no_go_readiness: {
      approved_gym_hosted_rehearsal_recorded: false,
      customer_observed_handoff_recorded: false,
      customer_observed_session_recorded: false,
      customer_observed_session_required: true,
      first_gym_go_no_go_bundle_ready: false,
      hosted_rehearsal_evidence_required: true,
      mode: "requires_hosted_rehearsal_evidence_and_customer_observed_session",
      no_live_provider_claim_required: true,
      no_unexpected_data_check_required: true,
      owner_workspace_check_required: true,
      public_launch_decision_allowed: false,
      ready_for_first_gym_operator_assisted_run: false,
      reset_rollback_check_required: true,
      staff_workboard_check_required: true,
    },
    ...blockedFlags(),
    next_readiness_batches: [
      { id: "first_gym_go_no_go_bundle" },
      { id: "public_self_serve_preflight" },
      { id: "live_provider_revenue_gates" },
    ],
  });
  return readinessPath;
}

function writePublicLaunchPreflightFixture(prefix) {
  const reviewPath = artifactPath(`${prefix}-limited-beta-review.json`);
  const preflightPath = artifactPath(`${prefix}-public-launch-preflight.json`);
  removeIfExists(reviewPath);
  removeIfExists(preflightPath);
  writeJsonArtifact(reviewPath, {
    artifact_kind: "admin_limited_beta_operator_review_packet",
    candidate_gym_label: "Second Gym",
    status: "admin_limited_beta_operator_review_packet_prepared",
  });
  writeJsonArtifact(preflightPath, {
    artifact_kind: "admin_public_self_serve_launch_preflight",
    status: "admin_public_self_serve_launch_preflight_prepared",
    generated_at: "2026-07-02T19:01:00.000Z",
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
    OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
    OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH: preflightPath,
  });
  expect(result.status, result.stderr).toBe(0);
  result = run("scripts/prepare-admin-public-launch-next-readiness-batch.mjs", {
    OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
    OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
  });
  expect(result.status, result.stderr).toBe(0);
  result = run("scripts/prepare-admin-public-request-intake-artifact.mjs", {
    OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_CONTACT: "owner@second.example",
    OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_LABEL: "Second Gym public request",
  });
  expect(result.status, result.stderr).toBe(0);
  result = run(
    "scripts/prepare-admin-public-request-followup-readiness-batch.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FOLLOWUP_READINESS_BATCH_PATH: followupPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
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
      OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
        hostedPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
        ownerStaffPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return hostedPath;
}

function writeProofRunway(prefix) {
  const readinessPath = writeGoNoGoReadiness(prefix);
  const acquisitionPath = artifactPath(`${prefix}-evidence-acquisition.json`);
  const runwayPath = artifactPath(
    `${prefix}-public-request-first-gym-proof-runway-batch.json`,
  );
  removeIfExists(acquisitionPath);
  removeIfExists(runwayPath);
  let result = run(
    "scripts/prepare-admin-public-request-first-gym-evidence-acquisition-batch.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
        acquisitionPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
        readinessPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  result = run("scripts/prepare-admin-public-request-first-gym-proof-runway-batch.mjs", {
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
      acquisitionPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH: runwayPath,
  });
  expect(result.status, result.stderr).toBe(0);
  return runwayPath;
}

function removeDefaultExecutionChildArtifacts(prefix) {
  for (const suffix of [
    "public-request-hosted-rehearsal-evidence.json",
    "customer-observed-session-record.json",
    "public-request-first-gym-go-no-go-bundle.json",
    "public-request-first-gym-operator-run-record.json",
    "public-request-limited-beta-operator-review-packet.json",
    "public-request-self-serve-launch-preflight.json",
    "public-launch-controls-batch.json",
  ]) {
    removeIfExists(artifactPath(`${prefix}-${suffix}`));
  }
}

function writeExecutionLedger(prefix, options = {}) {
  const runwayPath = writeProofRunway(prefix);
  const ledgerPath = artifactPath(`${prefix}-execution-ledger.json`);
  if (!options.preserveDefaultChildArtifacts) {
    removeDefaultExecutionChildArtifacts(prefix);
  }
  removeIfExists(ledgerPath);
  const result = run("scripts/prepare-admin-public-request-first-gym-execution-ledger.mjs", {
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH: runwayPath,
  });
  expect(result.status, result.stderr).toBe(0);
  return ledgerPath;
}

function writeProofSessionDiagnostics(prefix, options = {}) {
  const ledgerPath = writeExecutionLedger(prefix, options);
  const packetPath = artifactPath(`${prefix}-missing-proof-packet.json`);
  const gatePath = artifactPath(`${prefix}-completion-gate.json`);
  const runbookPath = artifactPath(`${prefix}-proof-session-runbook.json`);
  const packPath = artifactPath(`${prefix}-proof-session-execution-pack.json`);
  const progressPath = artifactPath(`${prefix}-proof-session-progress.json`);
  const resumePath = artifactPath(`${prefix}-proof-session-resume.json`);
  const diagnosticsPath = artifactPath(`${prefix}-proof-session-diagnostics.json`);
  for (const path of [
    packetPath,
    gatePath,
    runbookPath,
    packPath,
    progressPath,
    resumePath,
    diagnosticsPath,
  ]) {
    removeIfExists(path);
  }
  let result = run("scripts/prepare-admin-public-request-first-gym-missing-proof-packet.mjs", {
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH: packetPath,
  });
  expect(result.status, result.stderr).toBe(0);
  result = run("scripts/prepare-admin-public-request-first-gym-completion-gate.mjs", {
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH: gatePath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
  });
  expect(result.status, result.stderr).toBe(0);
  result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-session-runbook.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH: gatePath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH:
        runbookPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-session-execution-pack.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH:
        packPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH:
        runbookPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-session-progress-batch.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH:
        packPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH:
        progressPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-session-resume-packet.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH:
        progressPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH:
        resumePath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-session-diagnostics.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH:
        diagnosticsPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH:
        resumePath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { diagnosticsPath, result, resumePath };
}

function writeProofSessionFollowupPreflight(prefix, options = {}) {
  const { diagnosticsPath } = writeProofSessionDiagnostics(prefix, options);
  const preflightPath = artifactPath(`${prefix}-proof-session-followup-preflight.json`);
  removeIfExists(preflightPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-session-followup-preflight.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH:
        diagnosticsPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH:
        preflightPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { diagnosticsPath, preflightPath, result };
}

function writeProofSessionLaunchCheckpoint(prefix, options = {}) {
  const { preflightPath } = writeProofSessionFollowupPreflight(prefix, options);
  const checkpointPath = artifactPath(`${prefix}-proof-session-launch-checkpoint.json`);
  removeIfExists(checkpointPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-session-launch-checkpoint.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH:
        preflightPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH:
        checkpointPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { checkpointPath, preflightPath, result };
}

function writeProofCommandExecutionEnvelope(prefix, options = {}) {
  const { checkpointPath } = writeProofSessionLaunchCheckpoint(prefix, options);
  const envelopePath = artifactPath(`${prefix}-proof-command-execution-envelope.json`);
  removeIfExists(envelopePath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-command-execution-envelope.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH:
        checkpointPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH:
        envelopePath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { checkpointPath, envelopePath, result };
}

function writeProofEvidenceIntakeManifest(prefix, options = {}) {
  const { envelopePath } = writeProofCommandExecutionEnvelope(prefix, options);
  const manifestPath = artifactPath(`${prefix}-proof-evidence-intake-manifest.json`);
  removeIfExists(manifestPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-evidence-intake-manifest.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH:
        envelopePath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH:
        manifestPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { envelopePath, manifestPath, result };
}

function writeProofEvidenceSessionHandoff(prefix, options = {}) {
  const { manifestPath } = writeProofEvidenceIntakeManifest(prefix, options);
  const handoffPath = artifactPath(`${prefix}-proof-evidence-session-handoff.json`);
  removeIfExists(handoffPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-evidence-session-handoff.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH:
        manifestPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH:
        handoffPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { handoffPath, manifestPath, result };
}

function writeProofEvidenceSessionLedger(prefix) {
  const { handoffPath } = writeProofEvidenceSessionHandoff(prefix);
  const ledgerPath = artifactPath(`${prefix}-proof-evidence-session-ledger.json`);
  removeIfExists(ledgerPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-evidence-session-ledger.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH:
        handoffPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
        ledgerPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { handoffPath, ledgerPath, result };
}

function writeEvidenceExecutionReadiness(prefix) {
  const { ledgerPath } = writeProofEvidenceSessionLedger(prefix);
  const readinessPath = artifactPath(`${prefix}-evidence-execution-readiness.json`);
  removeIfExists(readinessPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-evidence-execution-readiness.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
        ledgerPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
        readinessPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { ledgerPath, readinessPath, result };
}

function writeEvidenceRunCoordinator(prefix) {
  const { readinessPath } = writeEvidenceExecutionReadiness(prefix);
  const coordinatorPath = artifactPath(`${prefix}-evidence-run-coordinator.json`);
  removeIfExists(coordinatorPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-evidence-run-coordinator.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
        readinessPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH:
        coordinatorPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { coordinatorPath, readinessPath, result };
}

function writeEvidenceRunCoordinatorWithHostedAndCustomerProof(prefix) {
  const written = writeEvidenceExecutionReadinessWithHostedAndCustomerProof(prefix);
  const coordinatorPath = artifactPath(`${prefix}-evidence-run-coordinator.json`);
  removeIfExists(coordinatorPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-evidence-run-coordinator.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
        written.readinessPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH:
        coordinatorPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { ...written, coordinatorPath, result };
}

function writeEvidenceExecutionReadinessWithHostedProof(prefix) {
  const initialHandoff = writeProofEvidenceSessionHandoff(prefix);
  let handoff = readJsonArtifact(initialHandoff.handoffPath);
  const hostedEvidencePath = handoff.session_handoff_rows.find(
    (row) => row.id === "hosted_rehearsal_evidence",
  ).expected_artifact_path;
  writeHostedRehearsalEvidenceAtPath(prefix, hostedEvidencePath);
  const { handoffPath } = writeProofEvidenceSessionHandoff(prefix, {
    preserveDefaultChildArtifacts: true,
  });
  handoff = readJsonArtifact(handoffPath);

  const ledgerPath = artifactPath(`${prefix}-proof-evidence-session-ledger.json`);
  const readinessPath = artifactPath(`${prefix}-evidence-execution-readiness.json`);
  for (const path of [ledgerPath, readinessPath]) removeIfExists(path);
  let result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-evidence-session-ledger.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH:
        handoffPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
        ledgerPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  result = run(
    "scripts/prepare-admin-public-request-first-gym-evidence-execution-readiness.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
        ledgerPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
        readinessPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { handoffPath, hostedEvidencePath, ledgerPath, readinessPath, result };
}

function writeEvidenceRunCoordinatorWithHostedProof(prefix) {
  const written = writeEvidenceExecutionReadinessWithHostedProof(prefix);
  const coordinatorPath = artifactPath(`${prefix}-evidence-run-coordinator.json`);
  removeIfExists(coordinatorPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-evidence-run-coordinator.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
        written.readinessPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH:
        coordinatorPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { ...written, coordinatorPath, result };
}

function writeProtectedPreviewEvidencePreflight(prefix) {
  const { coordinatorPath } = writeEvidenceRunCoordinator(prefix);
  return writeProtectedPreviewEvidencePreflightFromCoordinator(
    prefix,
    coordinatorPath,
  );
}

function writeProtectedPreviewEvidencePreflightFromCoordinator(
  prefix,
  coordinatorPath,
) {
  const preflightPath = artifactPath(
    `${prefix}-protected-preview-evidence-preflight.json`,
  );
  removeIfExists(preflightPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-protected-preview-evidence-preflight.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH:
        coordinatorPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH:
        preflightPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { coordinatorPath, preflightPath, result };
}

function writeRealEvidenceAttemptReadiness(prefix) {
  const { preflightPath } = writeProtectedPreviewEvidencePreflight(prefix);
  const attemptPath = artifactPath(
    `${prefix}-real-evidence-attempt-readiness.json`,
  );
  removeIfExists(attemptPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-real-evidence-attempt-readiness.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH:
        preflightPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH:
        attemptPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { attemptPath, preflightPath, result };
}

function writeRealEvidenceExecutionPacket(prefix) {
  const { attemptPath, preflightPath } = writeRealEvidenceAttemptReadiness(prefix);
  const packetPath = artifactPath(
    `${prefix}-real-evidence-execution-packet.json`,
  );
  removeIfExists(packetPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-real-evidence-execution-packet.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH:
        attemptPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH:
        packetPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { attemptPath, packetPath, preflightPath, result };
}

function readyHostedRehearsalGuardEnv(evidencePath) {
  return {
    OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH: evidencePath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
      artifactPath("guard-ready-hosted-readiness-placeholder.json"),
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED:
      "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_INVITE_DELIVERY_NOT_OBSERVED:
      "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED:
      "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OPERATOR: "operator-reviewed-session",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_RESET_ROLLBACK_REVIEWED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_STAFF_WORKBOARD_OBSERVED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_UNEXPECTED_DATA_NOT_OBSERVED:
      "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_WINDOW: "2026-07-07 hosted rehearsal",
  };
}

function writeRealEvidenceExecutionGuard(prefix, env = {}) {
  const { packetPath, attemptPath, preflightPath } =
    writeRealEvidenceExecutionPacket(prefix);
  const guardPath = artifactPath(`${prefix}-real-evidence-execution-guard.json`);
  removeIfExists(guardPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH:
        packetPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
        guardPath,
      ...env,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { attemptPath, guardPath, packetPath, preflightPath, result };
}

function writeRealEvidenceExecutionPacketWithHostedProof(prefix) {
  const { coordinatorPath, hostedEvidencePath } =
    writeEvidenceRunCoordinatorWithHostedProof(prefix);
  const { preflightPath } = writeProtectedPreviewEvidencePreflightFromCoordinator(
    prefix,
    coordinatorPath,
  );
  const attemptPath = artifactPath(
    `${prefix}-real-evidence-attempt-readiness.json`,
  );
  const packetPath = artifactPath(
    `${prefix}-real-evidence-execution-packet.json`,
  );
  for (const path of [attemptPath, packetPath]) removeIfExists(path);
  let result = run(
    "scripts/prepare-admin-public-request-first-gym-real-evidence-attempt-readiness.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH:
        preflightPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH:
        attemptPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  result = run(
    "scripts/prepare-admin-public-request-first-gym-real-evidence-execution-packet.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH:
        attemptPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH:
        packetPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { attemptPath, hostedEvidencePath, packetPath, preflightPath, result };
}

function customerDigestGuardEnv(recordPath, schedulingPath) {
  return {
    OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED:
      "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_INVITE_DELIVERY_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_OPERATOR: "operator-reviewed-customer-session",
    OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_WORKSPACE_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
    OUTPOST_ADMIN_CUSTOMER_SESSION_RESET_ROLLBACK_REVIEWED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_STAFF_HANDOFF_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_WINDOW: "2026-07-07 customer session",
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: schedulingPath,
  };
}

function writeRealEvidenceExecutionGuardWithHostedProof(prefix, env = {}) {
  const { packetPath, attemptPath, hostedEvidencePath, preflightPath } =
    writeRealEvidenceExecutionPacketWithHostedProof(prefix);
  const guardPath = artifactPath(`${prefix}-real-evidence-execution-guard.json`);
  removeIfExists(guardPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH:
        packetPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
        guardPath,
      ...env,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return {
    attemptPath,
    guardPath,
    hostedEvidencePath,
    packetPath,
    preflightPath,
    result,
  };
}

function writeRealEvidenceRefreshCoordinator(prefix, env = {}) {
  const { guardPath, packetPath, preflightPath, attemptPath } =
    writeRealEvidenceExecutionGuard(prefix, env);
  const coordinatorPath = artifactPath(
    `${prefix}-real-evidence-refresh-coordinator.json`,
  );
  removeIfExists(coordinatorPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
        guardPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
        coordinatorPath,
      ...env,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return {
    attemptPath,
    coordinatorPath,
    guardPath,
    packetPath,
    preflightPath,
    result,
  };
}

function writeRealEvidenceRefreshCoordinatorWithHostedProof(prefix, env = {}) {
  const { guardPath, packetPath, preflightPath, attemptPath } =
    writeRealEvidenceExecutionGuardWithHostedProof(prefix, env);
  const coordinatorPath = artifactPath(
    `${prefix}-real-evidence-refresh-coordinator.json`,
  );
  removeIfExists(coordinatorPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
        guardPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
        coordinatorPath,
      ...env,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return {
    attemptPath,
    coordinatorPath,
    guardPath,
    packetPath,
    preflightPath,
    result,
  };
}

function writeHostedRehearsalEvidenceAtPath(prefix, evidencePath) {
  const ownerStaffPath = artifactPath(`${prefix}-ready-owner-staff.json`);
  const readinessPath = artifactPath(`${prefix}-ready-hosted-readiness.json`);
  for (const path of [ownerStaffPath, readinessPath, evidencePath]) {
    removeIfExists(path);
  }
  writeJsonArtifact(ownerStaffPath, {
    artifact_kind: "admin_public_request_owner_staff_handoff_readiness_batch",
    candidate_gym_label: "Second Gym",
  });
  writeJsonArtifact(readinessPath, {
    artifact_kind: "admin_public_request_hosted_rehearsal_readiness_batch",
    status: "admin_public_request_hosted_rehearsal_readiness_batch_prepared",
    generated_at: "2026-07-03T12:00:00.000Z",
    evidence_basis: "admin_public_request_owner_staff_handoff_readiness_batch",
    public_request_owner_staff_handoff_readiness_batch_path: ownerStaffPath,
    public_request_owner_staff_handoff_readiness_batch_sha256:
      sha256File(ownerStaffPath),
    candidate_gym_label: "Second Gym",
    public_request_hosted_rehearsal_readiness_batch_ready: true,
    hosted_rehearsal_readiness: {
      mode: "browser_rehearsal_required_not_recorded",
      owner_workspace_check_required: true,
      staff_workboard_check_required: true,
      reset_rollback_check_required: true,
      no_unexpected_data_check_required: true,
      no_live_provider_claim_required: true,
      owner_access_evidence_required: true,
      owner_access_evidence_recorded: false,
      staff_no_send_preflight_required: true,
      staff_no_send_preflight_recorded: false,
      customer_observed_handoff_recorded: false,
      approved_gym_hosted_rehearsal_recorded: false,
      first_gym_go_no_go_bundle_ready: false,
      public_launch_decision_allowed: false,
    },
    ...blockedFlags(),
    next_readiness_batches: [
      { id: "first_gym_go_no_go_bundle" },
      { id: "public_self_serve_preflight" },
      { id: "live_provider_revenue_gates" },
    ],
  });
  writeJsonArtifact(evidencePath, {
    artifact_kind: "admin_public_request_hosted_rehearsal_evidence",
    status: "admin_public_request_hosted_rehearsal_evidence_recorded",
    generated_at: "2026-07-03T12:05:00.000Z",
    evidence_basis: "admin_public_request_hosted_rehearsal_readiness_batch",
    public_request_hosted_rehearsal_readiness_batch_path: readinessPath,
    public_request_hosted_rehearsal_readiness_batch_sha256:
      sha256File(readinessPath),
    candidate_gym_label: "Second Gym",
    operator_label: "Krish",
    public_request_hosted_rehearsal_evidence_recorded: true,
    customer_observed_handoff_recorded: false,
    customer_observed_handoff_claimed: false,
    customer_observed_session_recorded: false,
    customer_session_hosted_import_recorded: false,
    first_gym_go_no_go_bundle_ready: false,
    first_gym_operator_run_recorded: false,
    ...blockedFlags(),
    observed: {
      owner_workspace_observed: true,
      staff_workboard_observed: true,
      reset_rollback_reviewed: true,
      unexpected_data_not_observed: true,
      live_provider_claims_not_observed: true,
      invite_delivery_not_observed: true,
      billing_pos_member_writes_not_observed: true,
    },
    next_readiness_batches: [
      { id: "customer_observed_handoff_gate" },
      { id: "hosted_customer_session_proof" },
      { id: "first_gym_go_no_go_bundle" },
      { id: "first_gym_operator_assisted_run" },
    ],
  });
}

function writeCustomerSessionRecordAtPath(prefix, recordPath) {
  const walkthroughPath = artifactPath(`${prefix}-ready-walkthrough.json`);
  const schedulingPath = artifactPath(`${prefix}-ready-scheduling.json`);
  for (const path of [walkthroughPath, schedulingPath, recordPath]) {
    removeIfExists(path);
  }
  writeJsonArtifact(walkthroughPath, {
    artifact_kind: "admin_protected_preview_walkthrough",
    status: "admin_protected_preview_walkthrough_recorded",
    protected_preview_url: "https://outpost-preview.example.vercel.app",
    hosted_neon_branch: "outpost-proof-branch",
    reviewed_owner_email: "owner@second.example",
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
      owner_workspace_observed: true,
      staff_workboard_observed: true,
      reset_rollback_reviewed: true,
      unexpected_data_not_observed: true,
      live_provider_claims_blocked: true,
      public_self_serve_blocked: true,
      invite_delivery_blocked: true,
      billing_pos_member_writes_blocked: true,
    },
  });
  writeJsonArtifact(schedulingPath, {
    artifact_kind: "admin_customer_handoff_scheduling_batch",
    status: "admin_customer_handoff_scheduling_batch_prepared",
    evidence_basis: "admin_protected_preview_walkthrough",
    protected_preview_walkthrough_path: walkthroughPath,
    protected_preview_walkthrough_sha256: sha256File(walkthroughPath),
    protected_preview_url: "https://outpost-preview.example.vercel.app",
    hosted_neon_branch: "outpost-proof-branch",
    gym_name: "Second Gym",
    owner_email: "owner@second.example",
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
      "Walk through the owner workspace and current beta readiness state.",
      "Review staff handoff path.",
      "Review reset and rollback support checklist.",
      "Confirm no live-provider, invite delivery, billing, POS, access control, or member-ledger claims.",
    ],
    support_checklist: [
      "Keep rotated owner credential shared outside artifact.",
      "Do not record customer-observed completion until the owner completes the session.",
      "Stop handoff if owner sees unexpected tenant data or live-provider claims.",
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
  });
  writeJsonArtifact(recordPath, {
    artifact_kind: "admin_customer_observed_session_record",
    status: "admin_customer_observed_session_recorded",
    evidence_basis: "admin_customer_handoff_scheduling_batch",
    handoff_scheduling_packet_path: schedulingPath,
    handoff_scheduling_packet_sha256: sha256File(schedulingPath),
    gym_name: "Second Gym",
    owner_email: "owner@second.example",
    owner_label: "",
    scheduling_operator_label: "Krish",
    operator_label: "Krish",
    customer_observed_session_recorded: true,
    customer_observed_handoff_claimed: true,
    observed: {
      owner_present: true,
      protected_preview_observed: true,
      owner_workspace_observed: true,
      staff_handoff_path_observed: true,
      reset_rollback_reviewed: true,
      unexpected_data_not_observed: true,
      live_provider_claims_not_observed: true,
      invite_delivery_not_observed: true,
      billing_pos_member_writes_not_observed: true,
    },
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    source_import_automation_allowed: false,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: [
      "Public self-serve launch",
      "Invite delivery",
      "Phone/email provider activation",
      "Billing, POS, access control, member-ledger writes",
    ],
    command_sequence: [
      "npm run admin:customer-handoff:schedule:inspect",
      "npm run admin:customer-session:record",
      "npm run admin:customer-session:inspect",
    ],
  });
}

function writeEvidenceExecutionReadinessWithHostedAndCustomerProof(prefix) {
  const initialHandoff = writeProofEvidenceSessionHandoff(prefix);
  let handoff = readJsonArtifact(initialHandoff.handoffPath);
  const hostedEvidencePath = handoff.session_handoff_rows.find(
    (row) => row.id === "hosted_rehearsal_evidence",
  ).expected_artifact_path;
  const customerSessionPath = handoff.session_handoff_rows.find(
    (row) => row.id === "customer_observed_session",
  ).expected_artifact_path;
  writeHostedRehearsalEvidenceAtPath(prefix, hostedEvidencePath);
  writeCustomerSessionRecordAtPath(prefix, customerSessionPath);
  const { handoffPath } = writeProofEvidenceSessionHandoff(prefix, {
    preserveDefaultChildArtifacts: true,
  });
  handoff = readJsonArtifact(handoffPath);

  const ledgerPath = artifactPath(`${prefix}-proof-evidence-session-ledger.json`);
  const readinessPath = artifactPath(`${prefix}-evidence-execution-readiness.json`);
  for (const path of [ledgerPath, readinessPath]) removeIfExists(path);
  let result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-evidence-session-ledger.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH:
        handoffPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
        ledgerPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  result = run(
    "scripts/prepare-admin-public-request-first-gym-evidence-execution-readiness.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
        ledgerPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
        readinessPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return {
    customerSessionPath,
    hostedEvidencePath,
    ledgerPath,
    readinessPath,
    result,
  };
}

describe("admin public request first-gym proof session diagnostics", () => {
  it("prepares and inspects chain diagnostics from the current resume packet", () => {
    const { diagnosticsPath, result } = writeProofSessionDiagnostics("blocked");
    expect(result.stdout).toContain(
      "Admin public request first-gym proof session diagnostics prepared",
    );
    expect(result.stdout).toContain("Missing evidence: 7");

    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-diagnostics.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH:
          diagnosticsPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym proof session diagnostics inspection passed",
    );

    const diagnostics = readJsonArtifact(diagnosticsPath);
    expect(diagnostics).toMatchObject({
      artifact_kind: "admin_public_request_first_gym_proof_session_diagnostics",
      evidence_basis: "admin_public_request_first_gym_proof_session_resume_packet",
    });
    expect(diagnostics.proof_session_diagnostics).toMatchObject({
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      inspectable_count: 0,
      limited_beta_review_recorded: false,
      missing_count: 7,
      mode: "resume_chain_diagnostics_only",
      public_launch_decision_allowed: false,
      verified_parent_inspector_count: 4,
    });
    expect(diagnostics.verified_chain.map((entry) => entry.artifact_kind)).toEqual([
      "admin_public_request_first_gym_proof_session_runbook",
      "admin_public_request_first_gym_proof_session_execution_pack",
      "admin_public_request_first_gym_proof_session_progress_batch",
      "admin_public_request_first_gym_proof_session_resume_packet",
    ]);
    expect(diagnostics.operator_next_actions.map((step) => step.id)).toEqual([
      "inspect_current_diagnostics",
      "run_next_missing_dedicated_proof_command",
      "regenerate_progress_after_proof_command",
      "regenerate_resume_after_progress",
      "regenerate_diagnostics_after_resume",
    ]);
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(diagnostics[key]).toBe(value);
    }
  });

  it("rejects stale lineage and diagnostics-only gate tampering", () => {
    const { diagnosticsPath } = writeProofSessionDiagnostics("tampered");
    const diagnostics = readJsonArtifact(diagnosticsPath);
    writeJsonArtifact(diagnosticsPath, {
      ...diagnostics,
      public_request_first_gym_proof_session_resume_packet_sha256:
        "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-diagnostics.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH:
          diagnosticsPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Proof session resume SHA256 does not match.");

    writeJsonArtifact(diagnosticsPath, {
      ...diagnostics,
      public_launch_decision_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-diagnostics.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH:
          diagnosticsPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof session diagnostics public_launch_decision_allowed blocked.",
    );

    writeJsonArtifact(diagnosticsPath, {
      ...diagnostics,
      operator_next_actions: diagnostics.operator_next_actions.map((step) =>
        step.id === "run_next_missing_dedicated_proof_command"
          ? { ...step, command: "npm run unsafe-public-launch" }
          : step,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-diagnostics.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH:
          diagnosticsPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Operator next actions 2 command mismatch.");

    writeJsonArtifact(diagnosticsPath, {
      ...diagnostics,
      evidence_summary: {
        ...diagnostics.evidence_summary,
        missing_evidence: diagnostics.evidence_summary.missing_evidence.map((item) =>
          item.id === "hosted_rehearsal_evidence"
            ? { ...item, artifact_path: "artifacts/admin-launch-readiness/wrong.json" }
            : item,
        ),
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-diagnostics.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH:
          diagnosticsPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Missing evidence summary 1 artifact_path mismatch.");

    writeJsonArtifact(diagnosticsPath, {
      ...diagnostics,
      evidence_summary: {
        ...diagnostics.evidence_summary,
        public_launch_decision_allowed: true,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-diagnostics.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH:
          diagnosticsPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Evidence summary keys mismatch.");
  });

  it("wires package scripts, domain guidance, and Admin portal read-only card", () => {
    const packet = founderAdminPublicRequestFirstGymProofSessionDiagnostics({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-session-diagnostics"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-session-diagnostics:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym proof session diagnostics",
    );
    expect(packet.summary).toContain("without recording proof");
    expect(packet.gates.map((gate) => gate.label)).toContain("Diagnostics only");
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymProofSessionDiagnostics",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym proof session diagnostics"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects follow-up preflight from diagnostics", () => {
    const { preflightPath, result } =
      writeProofSessionFollowupPreflight("followup-blocked");
    expect(result.stdout).toContain(
      "Admin public request first-gym proof session follow-up preflight prepared",
    );
    expect(result.stdout).toContain("State: blocked");
    expect(result.stdout).toContain("Missing evidence: 7");

    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-followup-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym proof session follow-up preflight inspection passed",
    );

    const preflight = readJsonArtifact(preflightPath);
    expect(preflight).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_proof_session_followup_preflight",
      evidence_basis: "admin_public_request_first_gym_proof_session_diagnostics",
    });
    expect(preflight.proof_session_followup_preflight).toMatchObject({
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      inspectable_count: 0,
      limited_beta_review_recorded: false,
      missing_count: 7,
      mode: "dedicated_followup_preflight_only",
      public_launch_decision_allowed: false,
      ready_for_dedicated_followup_commands: false,
    });
    expect(preflight.operator_command_sequence.map((step) => step.id)).toEqual([
      "inspect_current_diagnostics",
      "run_next_missing_dedicated_proof_command",
      "regenerate_progress_after_proof_command",
      "regenerate_resume_after_progress",
      "regenerate_diagnostics_after_resume",
      "regenerate_followup_preflight_after_diagnostics",
    ]);
    expect(preflight.followup_guard).toEqual({
      allowed_next_action:
        "Run the next missing dedicated proof command, then regenerate progress, resume, diagnostics, and this follow-up preflight.",
      state: "blocked",
    });
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(preflight[key]).toBe(value);
    }
  });

  it("rejects stale diagnostics and follow-up preflight gate tampering", () => {
    const { preflightPath } =
      writeProofSessionFollowupPreflight("followup-tampered");
    const preflight = readJsonArtifact(preflightPath);
    writeJsonArtifact(preflightPath, {
      ...preflight,
      public_request_first_gym_proof_session_diagnostics_sha256:
        "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-followup-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof session diagnostics SHA256 does not match.",
    );

    writeJsonArtifact(preflightPath, {
      ...preflight,
      public_launch_decision_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-followup-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof session follow-up preflight public_launch_decision_allowed blocked.",
    );

    writeJsonArtifact(preflightPath, {
      ...preflight,
      operator_command_sequence: preflight.operator_command_sequence.map((step) =>
        step.id === "regenerate_followup_preflight_after_diagnostics"
          ? { ...step, command: "npm run unsafe-public-launch" }
          : step,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-followup-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Operator command sequence 6 command mismatch.");

    writeJsonArtifact(preflightPath, {
      ...preflight,
      evidence_summary: {
        ...preflight.evidence_summary,
        missing_evidence: preflight.evidence_summary.missing_evidence.map((item) =>
          item.id === "hosted_rehearsal_evidence"
            ? { ...item, artifact_path: "artifacts/admin-launch-readiness/wrong.json" }
            : item,
        ),
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-followup-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Missing evidence summary 1 artifact_path mismatch.");
  });

  it("wires follow-up preflight package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymProofSessionFollowupPreflight({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-session-followup-preflight"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-session-followup-preflight:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym proof session follow-up preflight",
    );
    expect(packet.summary).toContain("without recording proof");
    expect(packet.gates.map((gate) => gate.label)).toContain("Preflight only");
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymProofSessionFollowupPreflight",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym proof session follow-up preflight"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects proof-session launch checkpoint from follow-up preflight", () => {
    const { checkpointPath, result } =
      writeProofSessionLaunchCheckpoint("launch-checkpoint-blocked");
    expect(result.stdout).toContain(
      "Admin public request first-gym proof session launch checkpoint prepared",
    );
    expect(result.stdout).toContain("State: blocked");
    expect(result.stdout).toContain("Missing evidence: 7");

    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-launch-checkpoint.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH:
          checkpointPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym proof session launch checkpoint inspection passed",
    );

    const checkpoint = readJsonArtifact(checkpointPath);
    expect(checkpoint).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_proof_session_launch_checkpoint",
      evidence_basis:
        "admin_public_request_first_gym_proof_session_followup_preflight",
    });
    expect(checkpoint.proof_session_launch_checkpoint).toMatchObject({
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      mode: "real_proof_command_launch_checkpoint_only",
      public_launch_decision_allowed: false,
      ready_for_real_proof_command_run: false,
      still_missing_evidence_count: 7,
    });
    expect(checkpoint.operator_input_requirements.map((row) => row.id)).toEqual([
      "first_gym_go_no_go_bundle_inputs",
      "first_gym_operator_run_inputs",
      "limited_beta_operator_review_inputs",
    ]);
    expect(checkpoint.operator_command_sequence.map((row) => row.id)).toEqual([
      "inspect_current_diagnostics",
      "run_next_missing_dedicated_proof_command",
      "regenerate_progress_after_proof_command",
      "regenerate_resume_after_progress",
      "regenerate_diagnostics_after_resume",
      "regenerate_followup_preflight_after_diagnostics",
      "regenerate_launch_checkpoint_after_preflight",
    ]);
    expect(checkpoint.checkpoint_guard).toEqual({
      allowed_next_action:
        "Run the next missing dedicated proof command, then regenerate progress, resume, diagnostics, follow-up preflight, and this launch checkpoint.",
      state: "blocked",
    });
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(checkpoint[key]).toBe(value);
    }
  });

  it("rejects stale follow-up preflight and launch checkpoint command tampering", () => {
    const { checkpointPath } =
      writeProofSessionLaunchCheckpoint("launch-checkpoint-tampered");
    const checkpoint = readJsonArtifact(checkpointPath);
    writeJsonArtifact(checkpointPath, {
      ...checkpoint,
      public_request_first_gym_proof_session_followup_preflight_sha256:
        "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-launch-checkpoint.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH:
          checkpointPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof session follow-up preflight SHA256 does not match.",
    );

    writeJsonArtifact(checkpointPath, {
      ...checkpoint,
      public_launch_decision_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-launch-checkpoint.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH:
          checkpointPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof session launch checkpoint public_launch_decision_allowed blocked.",
    );

    writeJsonArtifact(checkpointPath, {
      ...checkpoint,
      operator_command_sequence: checkpoint.operator_command_sequence.map((row) =>
        row.id === "regenerate_launch_checkpoint_after_preflight"
          ? { ...row, command: "npm run unsafe-public-launch" }
          : row,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-launch-checkpoint.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH:
          checkpointPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Operator command sequence 7 command mismatch.");

    writeJsonArtifact(checkpointPath, {
      ...checkpoint,
      operator_input_requirements:
        checkpoint.operator_input_requirements.map((row) =>
          row.id === "first_gym_go_no_go_bundle_inputs"
            ? { ...row, required_env: [...row.required_env, "OUTPOST_SECRET_TOKEN"] }
            : row,
        ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-launch-checkpoint.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH:
          checkpointPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Operator input requirements 1 required_env mismatch.",
    );
  });

  it("wires launch checkpoint package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymProofSessionLaunchCheckpoint({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-session-launch-checkpoint"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-session-launch-checkpoint:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym proof session launch checkpoint",
    );
    expect(packet.summary).toContain("without recording proof");
    expect(packet.gates.map((gate) => gate.label)).toContain("Checkpoint only");
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymProofSessionLaunchCheckpoint",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym proof session launch checkpoint"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects proof-command execution envelope from launch checkpoint", () => {
    const { envelopePath, result } =
      writeProofCommandExecutionEnvelope("proof-command-envelope-blocked");
    expect(result.stdout).toContain(
      "Admin public request first-gym proof-command execution envelope prepared",
    );
    expect(result.stdout).toContain("State: blocked");
    expect(result.stdout).toContain("Missing evidence: 7");

    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-command-execution-envelope.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH:
          envelopePath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym proof-command execution envelope inspection passed",
    );

    const envelope = readJsonArtifact(envelopePath);
    expect(envelope).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_proof_command_execution_envelope",
      evidence_basis:
        "admin_public_request_first_gym_proof_session_launch_checkpoint",
    });
    expect(envelope.proof_command_execution_envelope).toMatchObject({
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      mode: "operator_execution_envelope_only",
      public_launch_decision_allowed: false,
      ready_for_real_proof_command_run: false,
      still_missing_evidence_count: 7,
    });
    expect(envelope.operator_command_templates.map((row) => row.id)).toEqual([
      "first_gym_go_no_go_bundle_template",
      "first_gym_operator_run_template",
      "limited_beta_operator_review_template",
    ]);
    expect(envelope.operator_command_templates[0].command).toContain(
      "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PREVIEW_URL='<protected-vercel-preview-url>'",
    );
    expect(envelope.operator_command_sequence.map((row) => row.id)).toEqual([
      "inspect_current_diagnostics",
      "run_next_missing_dedicated_proof_command",
      "regenerate_progress_after_proof_command",
      "regenerate_resume_after_progress",
      "regenerate_diagnostics_after_resume",
      "regenerate_followup_preflight_after_diagnostics",
      "regenerate_launch_checkpoint_after_preflight",
      "regenerate_execution_envelope_after_launch_checkpoint",
    ]);
    expect(envelope.execution_envelope_guard).toEqual({
      allowed_next_action:
        "Run the next missing dedicated proof command, then regenerate progress, resume, diagnostics, follow-up preflight, launch checkpoint, and this execution envelope.",
      state: "blocked",
    });
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(envelope[key]).toBe(value);
    }
  });

  it("rejects stale launch checkpoint and proof-command envelope tampering", () => {
    const { envelopePath } =
      writeProofCommandExecutionEnvelope("proof-command-envelope-tampered");
    const envelope = readJsonArtifact(envelopePath);
    writeJsonArtifact(envelopePath, {
      ...envelope,
      public_request_first_gym_proof_session_launch_checkpoint_sha256:
        "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-command-execution-envelope.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH:
          envelopePath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof session launch checkpoint SHA256 does not match.",
    );

    writeJsonArtifact(envelopePath, {
      ...envelope,
      public_launch_decision_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-command-execution-envelope.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH:
          envelopePath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof-command execution envelope public_launch_decision_allowed blocked.",
    );

    writeJsonArtifact(envelopePath, {
      ...envelope,
      live_provider_enablement_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-command-execution-envelope.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH:
          envelopePath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof-command execution envelope live_provider_enablement_allowed blocked.",
    );

    writeJsonArtifact(envelopePath, {
      ...envelope,
      operator_command_templates:
        envelope.operator_command_templates.map((row) =>
          row.id === "first_gym_operator_run_template"
            ? { ...row, command: "npm run unsafe-public-launch" }
            : row,
        ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-command-execution-envelope.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH:
          envelopePath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Operator command templates 2 command mismatch.");

    writeJsonArtifact(envelopePath, {
      ...envelope,
      operator_input_requirements:
        envelope.operator_input_requirements.map((row) =>
          row.id === "first_gym_go_no_go_bundle_inputs"
            ? { ...row, title: "Changed title" }
            : row,
        ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-command-execution-envelope.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH:
          envelopePath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Operator input requirements 1 title mismatch.",
    );
  });

  it("wires proof-command execution envelope package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymProofCommandExecutionEnvelope({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-command-execution-envelope"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-command-execution-envelope:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym proof-command execution envelope",
    );
    expect(packet.summary).toContain("without recording proof");
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Execution envelope only",
    );
    expect(founderAdminComponent).toContain("Execution envelope");
    expect(readFileSync(
      "scripts/prepare-admin-public-request-first-gym-proof-command-execution-envelope.mjs",
      "utf8",
    )).toContain(
      "Use first_gym_go_no_go_bundle_template with real hosted/customer evidence.",
    );
    expect(readFileSync(
      "scripts/inspect-admin-public-request-first-gym-proof-command-execution-envelope.mjs",
      "utf8",
    )).toContain(
      "Use first_gym_go_no_go_bundle_template with real hosted/customer evidence.",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymProofCommandExecutionEnvelope",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym proof command execution envelope"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects proof evidence intake manifest from execution envelope", () => {
    const { manifestPath, result } =
      writeProofEvidenceIntakeManifest("proof-evidence-intake-blocked");
    expect(result.stdout).toContain(
      "Admin public request first-gym proof evidence intake manifest prepared",
    );
    expect(result.stdout).toContain("State: blocked");
    expect(result.stdout).toContain("Missing evidence: 7");

    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-intake-manifest.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH:
          manifestPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym proof evidence intake manifest inspection passed",
    );

    const manifest = readJsonArtifact(manifestPath);
    expect(manifest).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_proof_evidence_intake_manifest",
      evidence_basis:
        "admin_public_request_first_gym_proof_command_execution_envelope",
    });
    expect(manifest.proof_evidence_intake_manifest).toMatchObject({
      customer_observed_completion_recorded: false,
      evidence_recorded: false,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      missing_evidence_count: 7,
      mode: "operator_evidence_intake_manifest_only",
      public_launch_decision_allowed: false,
      ready_for_real_proof_command_run: false,
    });
    expect(manifest.evidence_intake_rows.map((row) => row.id)).toEqual([
      "hosted_rehearsal_evidence",
      "customer_observed_session",
      "first_gym_go_no_go_bundle",
      "first_gym_operator_run",
      "limited_beta_operator_review",
      "public_request_self_serve_preflight",
      "public_launch_controls",
    ]);
    expect(manifest.evidence_intake_rows[0]).toMatchObject({
      collection_status: "not_recorded",
      proof_recorded: false,
      operator_instruction:
        "Record only from the protected Preview on the hosted Neon proof branch; do not use local or spike evidence.",
    });
    expect(manifest.operator_command_sequence.map((row) => row.id)).toEqual([
      "inspect_current_diagnostics",
      "run_next_missing_dedicated_proof_command",
      "regenerate_progress_after_proof_command",
      "regenerate_resume_after_progress",
      "regenerate_diagnostics_after_resume",
      "regenerate_followup_preflight_after_diagnostics",
      "regenerate_launch_checkpoint_after_preflight",
      "regenerate_execution_envelope_after_launch_checkpoint",
      "regenerate_evidence_intake_manifest_after_envelope",
    ]);
    expect(manifest.evidence_intake_guard).toEqual({
      allowed_next_action:
        "Collect the next missing evidence item, regenerate progress, resume, diagnostics, follow-up preflight, launch checkpoint, execution envelope, and this intake manifest.",
      state: "blocked",
    });
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(manifest[key]).toBe(value);
    }
  });

  it("rejects stale execution envelope and proof evidence intake manifest tampering", () => {
    const { manifestPath } =
      writeProofEvidenceIntakeManifest("proof-evidence-intake-tampered");
    const manifest = readJsonArtifact(manifestPath);
    writeJsonArtifact(manifestPath, {
      ...manifest,
      public_request_first_gym_proof_command_execution_envelope_sha256:
        "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-intake-manifest.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH:
          manifestPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof-command execution envelope SHA256 does not match.",
    );

    writeJsonArtifact(manifestPath, {
      ...manifest,
      live_provider_enablement_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-intake-manifest.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH:
          manifestPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof evidence intake manifest live_provider_enablement_allowed blocked.",
    );

    writeJsonArtifact(manifestPath, {
      ...manifest,
      evidence_intake_rows: manifest.evidence_intake_rows.map((row) =>
        row.id === "hosted_rehearsal_evidence"
          ? { ...row, collection_status: "recorded" }
          : row,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-intake-manifest.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH:
          manifestPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Evidence intake rows 1 collection_status mismatch.",
    );

    writeJsonArtifact(manifestPath, {
      ...manifest,
      operator_command_sequence: manifest.operator_command_sequence.map((row) =>
        row.id === "regenerate_evidence_intake_manifest_after_envelope"
          ? { ...row, command: "npm run unsafe-public-launch" }
          : row,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-intake-manifest.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH:
          manifestPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Operator command sequence 9 command mismatch.");
  });

  it("wires proof evidence intake manifest package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymProofEvidenceIntakeManifest({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-evidence-intake-manifest"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-evidence-intake-manifest:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym proof evidence intake manifest",
    );
    expect(packet.summary).toContain("without recording proof");
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Evidence intake only",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymProofEvidenceIntakeManifest",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym proof evidence intake manifest"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects proof evidence session handoff from intake manifest", () => {
    const { handoffPath, result } =
      writeProofEvidenceSessionHandoff("proof-evidence-session-handoff-blocked");
    expect(result.stdout).toContain(
      "Admin public request first-gym proof evidence session handoff prepared",
    );
    expect(result.stdout).toContain("State: blocked");
    expect(result.stdout).toContain("Missing evidence: 7");

    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-handoff.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH:
          handoffPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym proof evidence session handoff inspection passed",
    );

    const handoff = readJsonArtifact(handoffPath);
    expect(handoff).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_proof_evidence_session_handoff",
      evidence_basis:
        "admin_public_request_first_gym_proof_evidence_intake_manifest",
    });
    expect(handoff.proof_evidence_session_handoff).toMatchObject({
      customer_observed_completion_recorded: false,
      evidence_recorded: false,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      missing_evidence_count: 7,
      mode: "operator_evidence_session_handoff_only",
      public_launch_decision_allowed: false,
      ready_for_real_proof_command_run: false,
    });
    expect(handoff.session_handoff_rows.map((row) => row.id)).toEqual([
      "hosted_rehearsal_evidence",
      "customer_observed_session",
      "first_gym_go_no_go_bundle",
      "first_gym_operator_run",
      "limited_beta_operator_review",
      "public_request_self_serve_preflight",
      "public_launch_controls",
    ]);
    expect(handoff.session_handoff_rows[0]).toMatchObject({
      handoff_status: "pending_real_session",
      proof_recorded: false,
      source_requirement: "protected_preview_hosted_neon_branch_only",
    });
    expect(handoff.operator_command_sequence.map((row) => row.id)).toEqual([
      "inspect_current_diagnostics",
      "run_next_missing_dedicated_proof_command",
      "regenerate_progress_after_proof_command",
      "regenerate_resume_after_progress",
      "regenerate_diagnostics_after_resume",
      "regenerate_followup_preflight_after_diagnostics",
      "regenerate_launch_checkpoint_after_preflight",
      "regenerate_execution_envelope_after_launch_checkpoint",
      "regenerate_evidence_intake_manifest_after_envelope",
      "regenerate_evidence_session_handoff_after_manifest",
    ]);
    expect(handoff.session_handoff_guard).toEqual({
      allowed_next_action:
        "Run the protected Preview/customer-observed evidence session, record the next missing evidence artifact, regenerate progress, resume, diagnostics, follow-up preflight, launch checkpoint, execution envelope, intake manifest, and this session handoff.",
      state: "blocked",
    });
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(handoff[key]).toBe(value);
    }
  });

  it("rejects stale intake manifest and proof evidence session handoff tampering", () => {
    const { handoffPath } =
      writeProofEvidenceSessionHandoff("proof-evidence-session-handoff-tampered");
    const handoff = readJsonArtifact(handoffPath);
    writeJsonArtifact(handoffPath, {
      ...handoff,
      public_request_first_gym_proof_evidence_intake_manifest_sha256:
        "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-handoff.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH:
          handoffPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof evidence intake manifest SHA256 does not match.",
    );

    writeJsonArtifact(handoffPath, {
      ...handoff,
      live_provider_enablement_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-handoff.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH:
          handoffPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof evidence session handoff live_provider_enablement_allowed blocked.",
    );

    writeJsonArtifact(handoffPath, {
      ...handoff,
      session_handoff_rows: handoff.session_handoff_rows.map((row) =>
        row.id === "hosted_rehearsal_evidence"
          ? { ...row, handoff_status: "recorded" }
          : row,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-handoff.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH:
          handoffPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Session handoff rows 1 handoff_status mismatch.",
    );

    writeJsonArtifact(handoffPath, {
      ...handoff,
      operator_command_sequence: handoff.operator_command_sequence.map((row) =>
        row.id === "regenerate_evidence_session_handoff_after_manifest"
          ? { ...row, command: "npm run unsafe-public-launch" }
          : row,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-handoff.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH:
          handoffPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Operator command sequence 10 command mismatch.");
  });

  it("wires proof evidence session handoff package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymProofEvidenceSessionHandoff({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-evidence-session-handoff"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-evidence-session-handoff:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym proof evidence session handoff",
    );
    expect(packet.summary).toContain("without recording proof");
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Session handoff only",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymProofEvidenceSessionHandoff",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym proof evidence session handoff"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects proof evidence session ledger from handoff", () => {
    const { ledgerPath, result } =
      writeProofEvidenceSessionLedger("proof-evidence-session-ledger-blocked");
    expect(result.stdout).toContain(
      "Admin public request first-gym proof evidence session ledger prepared",
    );
    expect(result.stdout).toContain("Inspectable evidence: 0");
    expect(result.stdout).toContain("Missing evidence: 7");

    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-ledger.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
          ledgerPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym proof evidence session ledger inspection passed",
    );

    const ledger = readJsonArtifact(ledgerPath);
    expect(ledger).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_proof_evidence_session_ledger",
      evidence_basis:
        "admin_public_request_first_gym_proof_evidence_session_handoff",
    });
    expect(ledger.proof_evidence_session_ledger).toMatchObject({
      all_session_evidence_inspectable: false,
      customer_observed_completion_recorded: false,
      evidence_recorded: false,
      first_gym_operator_run_recorded: false,
      inspectable_count: 0,
      limited_beta_review_recorded: false,
      missing_count: 7,
      mode: "status_only_reinspect_session_handoff_artifacts",
      next_missing_step_id: "hosted_rehearsal_evidence",
      public_launch_decision_allowed: false,
    });
    expect(ledger.session_evidence_ledger.map((row) => row.id)).toEqual([
      "hosted_rehearsal_evidence",
      "customer_observed_session",
      "first_gym_go_no_go_bundle",
      "first_gym_operator_run",
      "limited_beta_operator_review",
      "public_request_self_serve_preflight",
      "public_launch_controls",
    ]);
    expect(ledger.session_evidence_ledger[0]).toMatchObject({
      artifact_sha256: null,
      proof_recorded_by_ledger: false,
      state: "missing",
    });
    expect(ledger.session_evidence_completion).toEqual({
      ready_for_first_gym_go_no_go: false,
      ready_for_limited_beta_review: false,
      ready_for_public_launch_controls: false,
    });
    expect(ledger.session_evidence_guard).toEqual({
      allowed_next_action:
        "Record the next missing evidence item with its dedicated proof command, then regenerate the session ledger.",
      state: "blocked",
    });
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(ledger[key]).toBe(value);
    }
  });

  it("rejects stale handoff and proof evidence session ledger tampering", () => {
    const { ledgerPath } =
      writeProofEvidenceSessionLedger("proof-evidence-session-ledger-tampered");
    const ledger = readJsonArtifact(ledgerPath);
    writeJsonArtifact(ledgerPath, {
      ...ledger,
      public_request_first_gym_proof_evidence_session_handoff_sha256:
        "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-ledger.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
          ledgerPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof evidence session handoff SHA256 does not match.",
    );

    writeJsonArtifact(ledgerPath, {
      ...ledger,
      verified_evidence_session_handoff: {
        ...ledger.verified_evidence_session_handoff,
        missing_evidence_count: 0,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-ledger.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
          ledgerPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Verified evidence session handoff missing evidence count mismatch.",
    );

    writeJsonArtifact(ledgerPath, {
      ...ledger,
      live_provider_enablement_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-ledger.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
          ledgerPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof evidence session ledger live_provider_enablement_allowed blocked.",
    );

    writeJsonArtifact(ledgerPath, {
      ...ledger,
      session_evidence_ledger: ledger.session_evidence_ledger.map((row) =>
        row.id === "hosted_rehearsal_evidence"
          ? { ...row, state: "inspectable" }
          : row,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-ledger.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
          ledgerPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "hosted_rehearsal_evidence artifact path does not exist",
    );

    writeJsonArtifact(ledgerPath, {
      ...ledger,
      proof_evidence_session_ledger: {
        ...ledger.proof_evidence_session_ledger,
        evidence_recorded: true,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-ledger.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH:
          ledgerPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof evidence session ledger cannot record evidence.",
    );
  });

  it("wires proof evidence session ledger package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymProofEvidenceSessionLedger({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-evidence-session-ledger"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-evidence-session-ledger:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym proof evidence session ledger",
    );
    expect(packet.summary).toContain("without recording proof");
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Session ledger only",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymProofEvidenceSessionLedger",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym proof evidence session ledger"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects evidence execution readiness from the session ledger", () => {
    const { readinessPath, result } = writeEvidenceExecutionReadiness(
      "evidence-execution-readiness-blocked",
    );
    expect(result.stdout).toContain(
      "Admin public request first-gym evidence execution readiness prepared",
    );
    expect(result.stdout).toContain("Go/no-go allowed by evidence: false");

    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-execution-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
          readinessPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym evidence execution readiness inspection passed",
    );

    const readiness = readJsonArtifact(readinessPath);
    expect(readiness).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_evidence_execution_readiness",
      evidence_basis:
        "admin_public_request_first_gym_proof_evidence_session_ledger",
    });
    expect(readiness.evidence_execution_readiness).toMatchObject({
      customer_observed_session_state: "missing",
      go_no_go_allowed_by_evidence: false,
      hosted_customer_session_digest_proof_claimed: false,
      hosted_rehearsal_evidence_state: "missing",
      mode: "ledger_derived_execution_readiness_only",
      next_missing_step_id: "hosted_rehearsal_evidence",
      public_launch_decision_allowed: false,
    });
    expect(readiness.next_operator_action).toMatchObject({
      command: "npm run admin:public-request-hosted-rehearsal:evidence",
      id: "hosted_rehearsal_evidence",
      state: "blocked_on_real_evidence",
    });
    expect(readiness.evidence_execution_steps.map((step) => step.id)).toEqual([
      "hosted_rehearsal_evidence",
      "customer_observed_session_and_hosted_digest",
      "regenerate_session_ledger_after_evidence_change",
      "first_gym_go_no_go_bundle",
      "first_gym_operator_run",
      "limited_beta_operator_review",
    ]);
    expect(
      readiness.evidence_execution_steps.find(
        (step) => step.id === "first_gym_go_no_go_bundle",
      ).state,
    ).toBe("blocked");
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(readiness[key]).toBe(value);
    }
  });

  it("allows first-gym go/no-go evidence readiness only after hosted and customer evidence inspect", () => {
    const written = writeEvidenceExecutionReadinessWithHostedAndCustomerProof(
      "evidence-execution-readiness-ready",
    );
    try {
      const inspect = run(
        "scripts/inspect-admin-public-request-first-gym-evidence-execution-readiness.mjs",
        {
          OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
            written.readinessPath,
        },
      );
      expect(inspect.status, inspect.stderr).toBe(0);
      expect(inspect.stdout).toContain(
        "Admin public request first-gym evidence execution readiness inspection passed",
      );

      const readiness = readJsonArtifact(written.readinessPath);
      expect(readiness.evidence_execution_readiness).toMatchObject({
        customer_observed_session_state: "inspectable",
        go_no_go_allowed_by_evidence: true,
        hosted_customer_session_digest_proof_claimed: false,
        hosted_rehearsal_evidence_state: "inspectable",
        next_missing_step_id: "first_gym_go_no_go_bundle",
        public_launch_decision_allowed: false,
      });
      expect(readiness.next_operator_action).toMatchObject({
        command: "npm run admin:public-request-first-gym:go-no-go:bundle",
        id: "first_gym_go_no_go_bundle",
        state: "blocked_on_real_evidence",
      });
      expect(readiness.evidence_execution_steps).toContainEqual(
        expect.objectContaining({
          id: "customer_observed_session_and_hosted_digest",
          state: "inspectable_requires_hosted_digest_confirmation",
        }),
      );
      for (const [key, value] of Object.entries(blockedFlags())) {
        expect(readiness[key]).toBe(value);
      }
    } finally {
      removeIfExists(written.hostedEvidencePath);
      removeIfExists(written.customerSessionPath);
    }
  });

  it("rejects stale session ledger and unsafe evidence execution readiness", () => {
    const { readinessPath } = writeEvidenceExecutionReadiness(
      "evidence-execution-readiness-tampered",
    );
    const readiness = readJsonArtifact(readinessPath);
    writeJsonArtifact(readinessPath, {
      ...readiness,
      public_request_first_gym_proof_evidence_session_ledger_sha256:
        "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-execution-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
          readinessPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof evidence session ledger SHA256 does not match.",
    );

    writeJsonArtifact(readinessPath, {
      ...readiness,
      evidence_execution_readiness: {
        ...readiness.evidence_execution_readiness,
        hosted_customer_session_digest_proof_claimed: true,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-execution-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
          readinessPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Evidence execution readiness cannot claim hosted digest proof.",
    );

    writeJsonArtifact(readinessPath, {
      ...readiness,
      live_provider_enablement_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-execution-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
          readinessPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Evidence execution readiness live_provider_enablement_allowed blocked.",
    );

    writeJsonArtifact(readinessPath, {
      ...readiness,
      evidence_execution_steps: readiness.evidence_execution_steps.map((step) =>
        step.id === "hosted_rehearsal_evidence"
          ? { ...step, command: "npm run admin:public-request-hosted-rehearsal:evidence --unsafe" }
          : step,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-execution-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
          readinessPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Hosted rehearsal execution command mismatch.",
    );

    writeJsonArtifact(readinessPath, {
      ...readiness,
      evidence_execution_steps: [
        ...readiness.evidence_execution_steps,
        {
          command: "npm run admin:public-request-first-gym:go-no-go:bundle --extra",
          id: "extra_operator_step",
          state: "blocked",
          title: "Extra operator step",
        },
      ],
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-execution-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH:
          readinessPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Evidence execution steps length mismatch.",
    );
  });

  it("wires evidence execution readiness package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymEvidenceExecutionReadiness({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:evidence-execution-readiness"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:evidence-execution-readiness:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym evidence execution readiness",
    );
    expect(packet.summary).toContain("without recording proof");
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Inspectable evidence gate",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymEvidenceExecutionReadiness",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym evidence execution readiness"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects evidence run coordinator from evidence execution readiness", () => {
    const { coordinatorPath, result } = writeEvidenceRunCoordinator(
      "evidence-run-coordinator-blocked",
    );
    expect(result.stdout).toContain(
      "Admin public request first-gym evidence run coordinator prepared",
    );
    expect(result.stdout).toContain(
      "Coordinator state: blocked_on_real_hosted_or_customer_evidence",
    );

    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-run-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH:
          coordinatorPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym evidence run coordinator inspection passed",
    );

    const coordinator = readJsonArtifact(coordinatorPath);
    expect(coordinator).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_evidence_run_coordinator",
      evidence_basis:
        "admin_public_request_first_gym_evidence_execution_readiness",
    });
    expect(coordinator.evidence_run_coordinator).toMatchObject({
      coordinator_state: "blocked_on_real_hosted_or_customer_evidence",
      first_gym_go_no_go_approval_recorded: false,
      first_gym_operator_run_recorded: false,
      hosted_customer_session_digest_proof_claimed: false,
      limited_beta_review_recorded: false,
      mode: "operator_run_coordinator_only",
      public_launch_decision_allowed: false,
    });
    expect(coordinator.run_lanes.map((lane) => lane.id)).toEqual([
      "hosted_rehearsal_evidence_lane",
      "customer_observed_session_and_hosted_digest_lane",
      "session_ledger_and_readiness_regeneration_lane",
      "first_gym_go_no_go_bundle_lane",
      "first_gym_operator_run_lane",
      "limited_beta_operator_review_lane",
      "public_self_serve_launch_preflight_lane",
    ]);
    expect(
      coordinator.run_lanes.find(
        (lane) => lane.id === "public_self_serve_launch_preflight_lane",
      ).state,
    ).toBe("blocked_until_limited_beta_review_inspectable");
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(coordinator[key]).toBe(value);
    }
  });

  it("updates evidence run coordinator state when hosted and customer evidence are inspectable", () => {
    const written = writeEvidenceRunCoordinatorWithHostedAndCustomerProof(
      "evidence-run-coordinator-ready",
    );
    try {
      const inspect = run(
        "scripts/inspect-admin-public-request-first-gym-evidence-run-coordinator.mjs",
        {
          OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH:
            written.coordinatorPath,
        },
      );
      expect(inspect.status, inspect.stderr).toBe(0);

      const coordinator = readJsonArtifact(written.coordinatorPath);
      expect(coordinator.evidence_run_coordinator).toMatchObject({
        coordinator_state: "ready_for_hosted_digest_confirmation_before_go_no_go",
        go_no_go_allowed_by_evidence: true,
        hosted_customer_session_digest_proof_claimed: false,
      });
      expect(coordinator.run_lanes).toContainEqual(
        expect.objectContaining({
          id: "first_gym_go_no_go_bundle_lane",
          state: "ready_after_hosted_digest_confirmation",
        }),
      );
    } finally {
      removeIfExists(written.hostedEvidencePath);
      removeIfExists(written.customerSessionPath);
    }
  });

  it("rejects stale parent and unsafe evidence run coordinator changes", () => {
    const { coordinatorPath } = writeEvidenceRunCoordinator(
      "evidence-run-coordinator-tampered",
    );
    const coordinator = readJsonArtifact(coordinatorPath);
    writeJsonArtifact(coordinatorPath, {
      ...coordinator,
      public_request_first_gym_evidence_execution_readiness_sha256:
        "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-run-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH:
          coordinatorPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Evidence execution readiness SHA256 does not match.",
    );

    writeJsonArtifact(coordinatorPath, {
      ...coordinator,
      evidence_run_coordinator: {
        ...coordinator.evidence_run_coordinator,
        hosted_customer_session_digest_proof_claimed: true,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-run-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH:
          coordinatorPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Evidence run coordinator cannot claim hosted digest proof.",
    );

    writeJsonArtifact(coordinatorPath, {
      ...coordinator,
      run_lanes: coordinator.run_lanes.map((lane) =>
        lane.id === "first_gym_operator_run_lane"
          ? { ...lane, command: "npm run admin:public-request-first-gym:run --unsafe" }
          : lane,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-run-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH:
          coordinatorPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Run lane first_gym_operator_run_lane command mismatch.",
    );

    writeJsonArtifact(coordinatorPath, {
      ...coordinator,
      run_lanes: [
        ...coordinator.run_lanes,
        {
          command: "npm run admin:public-request-first-gym:go-no-go:bundle --extra",
          id: "extra_run_lane",
          regenerate_after_command:
            "npm run admin:public-request-first-gym:proof-evidence-session-ledger",
          state: "blocked",
          title: "Extra run lane",
        },
      ],
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-run-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH:
          coordinatorPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Evidence run lanes length mismatch.");

    writeJsonArtifact(coordinatorPath, {
      ...coordinator,
      live_provider_enablement_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-run-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH:
          coordinatorPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Evidence run coordinator live_provider_enablement_allowed blocked.",
    );
  });

  it("wires evidence run coordinator package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymEvidenceRunCoordinator({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:evidence-run-coordinator"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:evidence-run-coordinator:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym evidence run coordinator",
    );
    expect(packet.summary).toContain("full real-evidence run path");
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Coordinator only",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymEvidenceRunCoordinator",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym evidence run coordinator"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects protected Preview evidence preflight from evidence run coordinator", () => {
    const { preflightPath, result } = writeProtectedPreviewEvidencePreflight(
      "protected-preview-evidence-preflight-blocked",
    );
    expect(result.stdout).toContain(
      "Admin public request first-gym protected Preview evidence preflight prepared",
    );
    expect(result.stdout).toContain(
      "Preflight state: ready_to_record_real_hosted_rehearsal_then_customer_session",
    );

    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-protected-preview-evidence-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym protected Preview evidence preflight inspection passed",
    );

    const preflight = readJsonArtifact(preflightPath);
    expect(preflight).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_protected_preview_evidence_preflight",
      evidence_basis: "admin_public_request_first_gym_evidence_run_coordinator",
    });
    expect(preflight.protected_preview_evidence_preflight).toMatchObject({
      customer_observed_completion_recorded: false,
      first_gym_go_no_go_approval_recorded: false,
      first_gym_operator_run_recorded: false,
      hosted_customer_session_digest_proof_claimed: false,
      hosted_rehearsal_proof_recorded: false,
      limited_beta_review_recorded: false,
      mode: "operator_evidence_preflight_only",
      preflight_state:
        "ready_to_record_real_hosted_rehearsal_then_customer_session",
      public_launch_decision_allowed: false,
    });
    expect(preflight.evidence_capture_sequence.map((step) => step.id)).toEqual([
      "confirm_protected_preview_context",
      "record_hosted_rehearsal_evidence",
      "refresh_after_hosted_evidence",
      "record_customer_observed_session_and_hosted_digest",
      "refresh_after_customer_evidence",
      "hold_first_gym_go_no_go",
      "hold_operator_run_and_limited_beta_review",
      "hold_public_self_serve_preflight",
    ]);
    expect(preflight.artifact_replacement_policy.map((row) => row.id)).toEqual([
      "derived_control_artifact_regeneration",
      "real_proof_artifact_preservation",
      "post_change_refresh",
    ]);
    expect(
      preflight.stop_conditions.some((condition) =>
        condition.includes("overwrite inspected proof evidence"),
      ),
    ).toBe(true);
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(preflight[key]).toBe(value);
    }

    writeJsonArtifact(preflightPath, {
      ...preflight,
      public_request_first_gym_evidence_run_coordinator_sha256: "0".repeat(64),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-protected-preview-evidence-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Evidence run coordinator SHA256 does not match.",
    );

    writeJsonArtifact(preflightPath, {
      ...preflight,
      protected_preview_evidence_preflight: {
        ...preflight.protected_preview_evidence_preflight,
        hosted_rehearsal_proof_recorded: true,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-protected-preview-evidence-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Protected Preview evidence preflight cannot record hosted rehearsal proof.",
    );

    writeJsonArtifact(preflightPath, {
      ...preflight,
      evidence_capture_sequence: preflight.evidence_capture_sequence.map((step) =>
        step.id === "hold_first_gym_go_no_go"
          ? {
              ...step,
              command:
                "npm run admin:public-request-first-gym:go-no-go:bundle --unsafe",
            }
          : step,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-protected-preview-evidence-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Evidence preflight sequence hold_first_gym_go_no_go command mismatch.",
    );

    writeJsonArtifact(preflightPath, {
      ...preflight,
      evidence_capture_sequence: [
        ...preflight.evidence_capture_sequence,
        {
          command: "npm run admin:public-request-first-gym:run --extra",
          id: "extra_evidence_step",
          required_before_next_step: "Extra step",
          state: "blocked",
          title: "Extra evidence step",
        },
      ],
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-protected-preview-evidence-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Evidence capture sequence length mismatch.");

    writeJsonArtifact(preflightPath, {
      ...preflight,
      artifact_replacement_policy: preflight.artifact_replacement_policy.map(
        (row) =>
          row.id === "real_proof_artifact_preservation"
            ? { ...row, requirement: "Overwrite the proof artifact." }
            : row,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-protected-preview-evidence-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Artifact replacement policy mismatch.");

    writeJsonArtifact(preflightPath, {
      ...preflight,
      live_provider_enablement_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-protected-preview-evidence-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH:
          preflightPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Protected Preview evidence preflight live_provider_enablement_allowed blocked.",
    );
  });

  it("wires protected Preview evidence preflight package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymProtectedPreviewEvidencePreflight({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:protected-preview-evidence-preflight"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:protected-preview-evidence-preflight:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym protected Preview evidence preflight",
    );
    expect(packet.summary).toContain("artifact replacement guidance");
    expect(packet.gates.map((gate) => gate.label)).toContain("Preflight only");
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymProtectedPreviewEvidencePreflight",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym protected Preview evidence preflight"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects real evidence attempt readiness from protected Preview preflight", () => {
    const { attemptPath, result } = writeRealEvidenceAttemptReadiness(
      "real-evidence-attempt-readiness-blocked",
    );
    expect(result.stdout).toContain(
      "Admin public request first-gym real evidence attempt readiness prepared",
    );
    expect(result.stdout).toContain(
      "Readiness state: ready_to_record_hosted_rehearsal_evidence",
    );
    expect(result.stdout).toContain(
      "Next real step: record_hosted_rehearsal_evidence",
    );

    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-attempt-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH:
          attemptPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym real evidence attempt readiness inspection passed",
    );

    const attempt = readJsonArtifact(attemptPath);
    expect(attempt).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_real_evidence_attempt_readiness",
      evidence_basis:
        "admin_public_request_first_gym_protected_preview_evidence_preflight",
    });
    expect(attempt.real_evidence_attempt_readiness).toMatchObject({
      customer_observed_completion_recorded: false,
      first_gym_go_no_go_approval_recorded: false,
      first_gym_operator_run_recorded: false,
      hosted_customer_session_digest_proof_claimed: false,
      hosted_rehearsal_proof_recorded: false,
      limited_beta_review_recorded: false,
      mode: "operator_attempt_readiness_only",
      next_real_step_id: "record_hosted_rehearsal_evidence",
      public_launch_decision_allowed: false,
      readiness_state: "ready_to_record_hosted_rehearsal_evidence",
    });
    expect(attempt.operator_input_groups.map((group) => group.id)).toEqual([
      "hosted_rehearsal_real_observations",
      "customer_observed_session_real_observations",
      "hosted_customer_session_digest_inputs",
    ]);
    expect(attempt.real_evidence_attempt_sequence.map((step) => step.id)).toEqual([
      "attempt_hosted_rehearsal_evidence",
      "regenerate_after_hosted_attempt",
      "attempt_customer_observed_session_and_hosted_digest",
      "regenerate_after_customer_attempt",
      "hold_first_gym_go_no_go_until_evidence_inspectable",
    ]);
    expect(
      attempt.operator_input_groups
        .find((group) => group.id === "hosted_rehearsal_real_observations")
        .required_before_command,
    ).toContain(
      "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED=yes",
    );
    expect(
      attempt.stop_conditions.some((condition) =>
        condition.includes("cannot honestly be confirmed yes"),
      ),
    ).toBe(true);
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(attempt[key]).toBe(value);
    }

    writeJsonArtifact(attemptPath, {
      ...attempt,
      public_request_first_gym_protected_preview_evidence_preflight_sha256:
        "0".repeat(64),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-attempt-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH:
          attemptPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Protected Preview evidence preflight SHA256 does not match.",
    );

    writeJsonArtifact(attemptPath, {
      ...attempt,
      real_evidence_attempt_readiness: {
        ...attempt.real_evidence_attempt_readiness,
        hosted_rehearsal_proof_recorded: true,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-attempt-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH:
          attemptPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence attempt readiness cannot record hosted rehearsal proof.",
    );

    writeJsonArtifact(attemptPath, {
      ...attempt,
      real_evidence_attempt_sequence: attempt.real_evidence_attempt_sequence.map(
        (step) =>
          step.id === "attempt_hosted_rehearsal_evidence"
            ? {
                ...step,
                command:
                  "npm run admin:public-request-hosted-rehearsal:evidence --fake",
              }
            : step,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-attempt-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH:
          attemptPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Real evidence attempt sequence mismatch.");

    writeJsonArtifact(attemptPath, {
      ...attempt,
      operator_input_groups: attempt.operator_input_groups.map((group) =>
        group.id === "hosted_rehearsal_real_observations"
          ? {
              ...group,
              required_before_command: group.required_before_command.filter(
                (requirement) =>
                  requirement !==
                  "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED=yes",
              ),
            }
          : group,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-attempt-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH:
          attemptPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Operator input groups mismatch.");

    writeJsonArtifact(attemptPath, {
      ...attempt,
      live_provider_enablement_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-attempt-readiness.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH:
          attemptPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence attempt readiness live_provider_enablement_allowed blocked.",
    );
  });

  it("wires real evidence attempt readiness package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymRealEvidenceAttemptReadiness({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:real-evidence-attempt-readiness"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:real-evidence-attempt-readiness:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym real evidence attempt readiness",
    );
    expect(packet.summary).toContain("next safe real evidence command");
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Attempt-readiness only",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymRealEvidenceAttemptReadiness",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym real evidence attempt readiness"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects real evidence execution packet from attempt readiness", () => {
    const { packetPath, result } = writeRealEvidenceExecutionPacket(
      "real-evidence-execution-packet-blocked",
    );
    expect(result.stdout).toContain(
      "Admin public request first-gym real evidence execution packet prepared",
    );
    expect(result.stdout).toContain(
      "Readiness state: ready_to_record_hosted_rehearsal_evidence",
    );
    expect(result.stdout).toContain(
      "Next real step: record_hosted_rehearsal_evidence",
    );

    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH:
          packetPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym real evidence execution packet inspection passed",
    );

    const packet = readJsonArtifact(packetPath);
    expect(packet).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_real_evidence_execution_packet",
      evidence_basis:
        "admin_public_request_first_gym_real_evidence_attempt_readiness",
    });
    expect(packet.real_evidence_execution_packet).toMatchObject({
      customer_observed_completion_recorded: false,
      first_gym_go_no_go_approval_recorded: false,
      first_gym_operator_run_recorded: false,
      hosted_customer_session_digest_proof_claimed: false,
      hosted_rehearsal_proof_recorded: false,
      limited_beta_review_recorded: false,
      mode: "operator_execution_packet_only",
      next_real_step_id: "record_hosted_rehearsal_evidence",
      public_launch_decision_allowed: false,
      readiness_state: "ready_to_record_hosted_rehearsal_evidence",
    });
    expect(packet.execution_run_lanes.map((lane) => lane.id)).toEqual([
      "hosted_rehearsal_evidence_lane",
      "refresh_after_hosted_lane",
      "customer_session_and_digest_lane",
      "refresh_after_customer_lane",
    ]);
    expect(packet.execution_checklist.map((row) => row.id)).toEqual([
      "inspect_attempt_readiness",
      "run_next_real_command",
      "inspect_new_evidence",
      "regenerate_full_chain",
    ]);
    expect(packet.artifact_write_policy.map((row) => row.id)).toEqual([
      "create_only_evidence_artifacts",
      "no_secret_storage",
      "no_observation_values_in_packet",
    ]);
    expect(
      packet.execution_run_lanes
        .find((lane) => lane.id === "hosted_rehearsal_evidence_lane")
        .required_inputs,
    ).toContain(
      "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED=yes",
    );
    expect(
      packet.execution_checklist.find((row) => row.id === "regenerate_full_chain")
        .command,
    ).toContain(
      "admin:public-request-first-gym:real-evidence-execution-packet:inspect",
    );
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(packet[key]).toBe(value);
    }

    writeJsonArtifact(packetPath, {
      ...packet,
      public_request_first_gym_real_evidence_attempt_readiness_sha256:
        "0".repeat(64),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH:
          packetPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence attempt readiness SHA256 does not match.",
    );

    writeJsonArtifact(packetPath, {
      ...packet,
      real_evidence_execution_packet: {
        ...packet.real_evidence_execution_packet,
        hosted_rehearsal_proof_recorded: true,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH:
          packetPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence execution packet cannot record hosted rehearsal proof.",
    );

    writeJsonArtifact(packetPath, {
      ...packet,
      execution_run_lanes: packet.execution_run_lanes.map((lane) =>
        lane.id === "hosted_rehearsal_evidence_lane"
          ? {
              ...lane,
              command:
                "npm run admin:public-request-hosted-rehearsal:evidence --fake",
            }
          : lane,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH:
          packetPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Real evidence execution lanes mismatch.");

    writeJsonArtifact(packetPath, {
      ...packet,
      execution_checklist: packet.execution_checklist.map((row) =>
        row.id === "run_next_real_command"
          ? { ...row, requirement: "Run it anyway." }
          : row,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH:
          packetPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence execution checklist mismatch.",
    );

    writeJsonArtifact(packetPath, {
      ...packet,
      live_provider_enablement_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH:
          packetPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence execution packet live_provider_enablement_allowed blocked.",
    );
  });

  it("wires real evidence execution packet package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymRealEvidenceExecutionPacket({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:real-evidence-execution-packet"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:real-evidence-execution-packet:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym real evidence execution packet",
    );
    expect(packet.summary).toContain("inspectable run lanes");
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Execution-packet only",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymRealEvidenceExecutionPacket",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym real evidence execution packet"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("prepares and inspects real evidence execution guard from execution packet", () => {
    const blocked = writeRealEvidenceExecutionGuard(
      "real-evidence-execution-guard-blocked",
    );
    expect(blocked.result.stdout).toContain(
      "Admin public request first-gym real evidence execution guard prepared",
    );
    expect(blocked.result.stdout).toContain(
      "Guard state: blocked_until_real_inputs_or_output_path_ready",
    );

    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
          blocked.guardPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym real evidence execution guard inspection passed",
    );

    const blockedGuard = readJsonArtifact(blocked.guardPath);
    expect(blockedGuard).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_real_evidence_execution_guard",
      evidence_basis:
        "admin_public_request_first_gym_real_evidence_execution_packet",
    });
    expect(blockedGuard.real_evidence_execution_guard).toMatchObject({
      first_gym_go_no_go_approval_recorded: false,
      guard_state: "blocked_until_real_inputs_or_output_path_ready",
      hosted_rehearsal_proof_recorded: false,
      mode: "operator_pre_run_guard_only",
      next_real_step_id: "record_hosted_rehearsal_evidence",
      real_evidence_command_executed: false,
    });
    expect(blockedGuard.required_input_checks.map((row) => row.env_name)).toContain(
      "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED",
    );
    expect(blockedGuard.required_input_checks).toContainEqual(
      expect.objectContaining({
        env_name:
          "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED",
        state: "missing_or_not_yes",
        value_stored: false,
      }),
    );
    expect(blockedGuard.execution_blockers.map((row) => row.id)).toContain(
      "missing_input:OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED",
    );
    expect(blockedGuard.evidence_output_policy).toMatchObject({
      output_path_env_name:
        "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
      output_path_state: "create_only_path_available",
      proof_writer_must_create_only: true,
    });
    expect(blockedGuard.manual_run_instruction.command).toContain(
      "admin:public-request-hosted-rehearsal:evidence",
    );
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(blockedGuard[key]).toBe(value);
    }

    const readyEvidencePath = artifactPath(
      "real-evidence-execution-guard-ready-hosted-evidence.json",
    );
    removeIfExists(readyEvidencePath);
    const readyEnv = readyHostedRehearsalGuardEnv(readyEvidencePath);
    const ready = writeRealEvidenceExecutionGuard(
      "real-evidence-execution-guard-ready",
      readyEnv,
    );
    expect(ready.result.stdout).toContain(
      "Guard state: ready_to_run_next_real_command",
    );
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
          ready.guardPath,
        ...readyEnv,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    const readyGuard = readJsonArtifact(ready.guardPath);
    expect(readyGuard.real_evidence_execution_guard.guard_state).toBe(
      "ready_to_run_next_real_command",
    );
    expect(readyGuard.execution_blockers).toEqual([]);
    expect(
      readyGuard.required_input_checks
        .filter((row) => row.expected === "yes")
        .every((row) => row.state === "confirmed_yes"),
    ).toBe(true);
    expect(
      readyGuard.required_input_checks
        .filter((row) => row.expected === "present")
        .every((row) => row.state === "present_not_stored"),
    ).toBe(true);

    writeJsonArtifact(ready.guardPath, {
      ...readyGuard,
      required_input_checks: readyGuard.required_input_checks.map((row) =>
        row.env_name ===
        "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED"
          ? { ...row, state: "missing_or_not_yes" }
          : row,
      ),
      execution_blockers: [
        {
          id: "missing_input:OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED",
          requirement:
            "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED=yes",
          state: "blocked",
        },
      ],
      real_evidence_execution_guard: {
        ...readyGuard.real_evidence_execution_guard,
        guard_state: "blocked_until_real_inputs_or_output_path_ready",
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
          ready.guardPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence execution guard input checks mismatch.",
    );

    const existingEvidencePath = artifactPath(
      "real-evidence-execution-guard-existing-hosted-evidence.json",
    );
    writeJsonArtifact(existingEvidencePath, {
      artifact_kind: "already_existing_hosted_evidence",
    });
    const existingOutput = writeRealEvidenceExecutionGuard(
      "real-evidence-execution-guard-existing-output",
      readyHostedRehearsalGuardEnv(existingEvidencePath),
    );
    const existingOutputGuard = readJsonArtifact(existingOutput.guardPath);
    expect(existingOutputGuard.real_evidence_execution_guard.guard_state).toBe(
      "blocked_until_real_inputs_or_output_path_ready",
    );
    expect(existingOutputGuard.evidence_output_policy.output_path_state).toBe(
      "blocked_existing_artifact",
    );
    expect(existingOutputGuard.execution_blockers).toContainEqual(
      expect.objectContaining({ id: "existing_output_artifact" }),
    );
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
          existingOutput.guardPath,
        ...readyHostedRehearsalGuardEnv(existingEvidencePath),
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);

    writeJsonArtifact(ready.guardPath, {
      ...readyGuard,
      public_request_first_gym_real_evidence_execution_packet_sha256:
        "0".repeat(64),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
          ready.guardPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence execution packet SHA256 does not match.",
    );

    writeJsonArtifact(ready.guardPath, {
      ...readyGuard,
      required_input_checks: readyGuard.required_input_checks.map((row) =>
        row.env_name ===
        "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED"
          ? { ...row, expected: "present" }
          : row,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
          ready.guardPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence execution guard input checks mismatch.",
    );

    writeJsonArtifact(ready.guardPath, {
      ...readyGuard,
      evidence_output_policy: {
        ...readyGuard.evidence_output_policy,
        proof_writer_must_create_only: false,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
          ready.guardPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence execution guard output policy mismatch.",
    );

    writeJsonArtifact(ready.guardPath, {
      ...readyGuard,
      real_evidence_execution_guard: {
        ...readyGuard.real_evidence_execution_guard,
        hosted_rehearsal_proof_recorded: true,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
          ready.guardPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence execution guard hosted_rehearsal_proof_recorded blocked.",
    );
  });

  it("prepares and inspects real evidence execution guard for customer digest lane after hosted proof", () => {
    const recordPath = artifactPath(
      "real-evidence-execution-guard-customer-digest-record.json",
    );
    const schedulingPath = artifactPath(
      "real-evidence-execution-guard-customer-digest-scheduling.json",
    );
    removeIfExists(recordPath);
    const env = customerDigestGuardEnv(recordPath, schedulingPath);
    const ready = writeRealEvidenceExecutionGuardWithHostedProof(
      "real-evidence-execution-guard-customer-digest-ready",
      env,
    );
    expect(ready.result.stdout).toContain(
      "Guard state: ready_to_run_next_real_command",
    );
    expect(ready.result.stdout).toContain(
      "Next real step: record_customer_observed_session_and_hosted_digest",
    );

    const packet = readJsonArtifact(ready.packetPath);
    expect(packet.real_evidence_execution_packet).toMatchObject({
      next_real_step_id: "record_customer_observed_session_and_hosted_digest",
      readiness_state:
        "ready_to_record_customer_observed_session_and_hosted_digest",
    });
    expect(
      packet.execution_run_lanes.find(
        (lane) => lane.id === "customer_session_and_digest_lane",
      ).command,
    ).toBe(
      "npm run admin:customer-session:record && npm run admin:customer-session:inspect && npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
    );

    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
          ready.guardPath,
        ...env,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym real evidence execution guard inspection passed",
    );
    const guard = readJsonArtifact(ready.guardPath);
    expect(guard.real_evidence_execution_guard).toMatchObject({
      guard_state: "ready_to_run_next_real_command",
      hosted_customer_session_digest_proof_claimed: false,
      mode: "operator_pre_run_guard_only",
      next_real_step_id: "record_customer_observed_session_and_hosted_digest",
      real_evidence_command_executed: false,
    });
    expect(guard.next_command_lane).toMatchObject({
      id: "customer_session_and_digest_lane",
      source_attempt_step_id:
        "attempt_customer_observed_session_and_hosted_digest",
    });
    expect(guard.evidence_output_policy).toMatchObject({
      output_path_env_name: "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
      output_path_state: "create_only_path_available",
      path: recordPath,
      proof_writer_must_create_only: true,
    });
    expect(guard.required_input_checks).toContainEqual(
      expect.objectContaining({
        env_name: "OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT",
        expected: "yes",
        state: "confirmed_yes",
        value_stored: false,
      }),
    );
    expect(guard.required_input_checks).toContainEqual(
      expect.objectContaining({
        env_name: "OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH",
        expected: "present",
        state: "present_not_stored",
        value_stored: false,
      }),
    );
    expect(guard.execution_blockers).toEqual([]);
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(guard[key]).toBe(value);
    }

    writeJsonArtifact(recordPath, {
      artifact_kind: "already_existing_customer_session_record",
    });
    const existing = writeRealEvidenceExecutionGuardWithHostedProof(
      "real-evidence-execution-guard-customer-digest-existing-record",
      env,
    );
    const existingGuard = readJsonArtifact(existing.guardPath);
    expect(existingGuard.real_evidence_execution_guard.guard_state).toBe(
      "blocked_until_real_inputs_or_output_path_ready",
    );
    expect(existingGuard.evidence_output_policy).toMatchObject({
      output_path_env_name: "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
      output_path_state: "blocked_existing_artifact",
      path: recordPath,
    });
    expect(existingGuard.execution_blockers).toContainEqual(
      expect.objectContaining({
        id: "existing_output_artifact",
        requirement:
          "Choose a new OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH before running the next proof writer.",
      }),
    );
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH:
          existing.guardPath,
        ...env,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
  });

  it("prepares and inspects real evidence refresh coordinator from blocked and ready hosted guards", () => {
    const blocked = writeRealEvidenceRefreshCoordinator(
      "real-evidence-refresh-coordinator-blocked",
    );
    expect(blocked.result.stdout).toContain(
      "Admin public request first-gym real evidence refresh coordinator prepared",
    );
    expect(blocked.result.stdout).toContain("State: blocked");

    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          blocked.coordinatorPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym real evidence refresh coordinator inspection passed",
    );

    const blockedCoordinator = readJsonArtifact(blocked.coordinatorPath);
    expect(blockedCoordinator).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_real_evidence_refresh_coordinator",
      evidence_basis:
        "admin_public_request_first_gym_real_evidence_execution_guard",
    });
    expect(blockedCoordinator.real_evidence_refresh_coordinator).toMatchObject({
      guard_state: "blocked_until_real_inputs_or_output_path_ready",
      mode: "operator_refresh_coordinator_only",
      next_real_step_id: "record_hosted_rehearsal_evidence",
      ready_to_run_manual_command: false,
      ready_to_refresh_after_proof: false,
      real_evidence_command_executed: false,
    });
    expect(blockedCoordinator.manual_proof_command).toMatchObject({
      state: "blocked_until_guard_ready",
    });
    expect(blockedCoordinator.refresh_coordinator_guard).toMatchObject({
      state: "blocked",
    });
    expect(blockedCoordinator.paired_proof_inspector_commands).toBeUndefined();
    expect(blockedCoordinator.post_manual_verification_commands).toEqual([
      expect.objectContaining({
        command: "npm run admin:public-request-hosted-rehearsal:evidence:inspect",
        id: "inspect_hosted_rehearsal_evidence",
      }),
    ]);
    expect(
      blockedCoordinator.post_evidence_refresh_sequence.map((row) => row.id),
    ).toEqual([
      "refresh_proof_session_runbook",
      "refresh_proof_session_execution_pack",
      "refresh_proof_session_progress",
      "refresh_proof_session_resume",
      "refresh_proof_session_diagnostics",
      "refresh_proof_session_followup_preflight",
      "refresh_proof_session_launch_checkpoint",
      "refresh_proof_command_execution_envelope",
      "refresh_proof_evidence_intake_manifest",
      "refresh_proof_evidence_session_handoff",
      "refresh_proof_evidence_session_ledger",
      "refresh_evidence_execution_readiness",
      "refresh_evidence_run_coordinator",
      "refresh_protected_preview_evidence_preflight",
      "refresh_real_evidence_attempt_readiness",
      "refresh_real_evidence_execution_packet",
      "refresh_real_evidence_execution_guard",
      "refresh_real_evidence_refresh_coordinator",
    ]);
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(blockedCoordinator[key]).toBe(value);
    }

    const hostedEvidencePath = artifactPath(
      "real-evidence-refresh-coordinator-ready-hosted-evidence.json",
    );
    removeIfExists(hostedEvidencePath);
    const readyEnv = readyHostedRehearsalGuardEnv(hostedEvidencePath);
    const ready = writeRealEvidenceRefreshCoordinator(
      "real-evidence-refresh-coordinator-ready-hosted",
      readyEnv,
    );
    expect(ready.result.stdout).toContain(
      "State: ready_for_manual_proof_then_refresh",
    );
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    const readyCoordinator = readJsonArtifact(ready.coordinatorPath);
    expect(readyCoordinator.real_evidence_refresh_coordinator).toMatchObject({
      guard_state: "ready_to_run_next_real_command",
      next_real_step_id: "record_hosted_rehearsal_evidence",
      ready_to_run_manual_command: true,
      ready_to_refresh_after_proof: false,
    });
    expect(readyCoordinator.manual_proof_command).toMatchObject({
      command:
        "npm run admin:public-request-hosted-rehearsal:evidence && npm run admin:public-request-hosted-rehearsal:evidence:inspect",
      state: "ready_for_manual_operator_run",
    });

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      public_request_first_gym_real_evidence_execution_guard_sha256:
        "0".repeat(64),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence execution guard SHA256 does not match.",
    );

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      verified_real_evidence_execution_guard: {
        ...readyCoordinator.verified_real_evidence_execution_guard,
        output_path_state: "tampered",
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Verified real evidence execution guard mismatch.",
    );

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      manual_proof_command: {
        ...readyCoordinator.manual_proof_command,
        command: "npm run unsafe-public-launch",
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Manual proof command mismatch.");

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      post_manual_verification_commands:
        readyCoordinator.post_manual_verification_commands.map((row) =>
          row.id === "inspect_hosted_rehearsal_evidence"
            ? { ...row, command: "npm run unsafe-public-launch" }
            : row,
        ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Post-manual verification commands mismatch.",
    );

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      paired_proof_inspector_commands: [
        {
          command: "npm run admin:public-request-hosted-rehearsal:evidence:inspect",
          id: "inspect_hosted_rehearsal_evidence",
          order: 1,
          requirement:
            "Hosted rehearsal evidence must inspect before refreshing control artifacts.",
          state: "required_after_manual_command",
        },
      ],
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Paired proof inspector commands field is deprecated.",
    );

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      post_evidence_refresh_sequence:
        readyCoordinator.post_evidence_refresh_sequence.map((row) =>
          row.id === "refresh_real_evidence_execution_guard"
            ? { ...row, command: "npm run unsafe-public-launch" }
            : row,
        ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Post-evidence refresh sequence mismatch.",
    );

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      blocked_gates: [
        ...readyCoordinator.blocked_gates,
        {
          label: "Tampered gate",
          state: "ready",
        },
      ],
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence refresh coordinator blocked gates mismatch.",
    );

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      real_evidence_refresh_coordinator: {
        ...readyCoordinator.real_evidence_refresh_coordinator,
        hosted_rehearsal_proof_recorded: true,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence refresh coordinator hosted_rehearsal_proof_recorded blocked.",
    );

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      real_evidence_refresh_coordinator: {
        ...readyCoordinator.real_evidence_refresh_coordinator,
        ready_to_refresh_after_proof: true,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence refresh coordinator cannot mark refresh complete.",
    );

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      real_evidence_refresh_coordinator: {
        ...readyCoordinator.real_evidence_refresh_coordinator,
        ready_to_run_manual_command: false,
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence refresh coordinator ready state mismatch.",
    );

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      refresh_coordinator_guard: {
        ...readyCoordinator.refresh_coordinator_guard,
        state: "blocked",
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence refresh coordinator guard mismatch.",
    );

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      stop_conditions: [
        ...readyCoordinator.stop_conditions,
        "Tampered stop condition.",
      ],
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence refresh coordinator stop conditions mismatch.",
    );

    writeJsonArtifact(ready.coordinatorPath, {
      ...readyCoordinator,
      member_ledger_writes_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...readyEnv,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Real evidence refresh coordinator member_ledger_writes_allowed blocked.",
    );
  });

  it("prepares real evidence refresh coordinator for customer digest lane after hosted proof", () => {
    const recordPath = artifactPath(
      "real-evidence-refresh-coordinator-customer-digest-record.json",
    );
    const schedulingPath = artifactPath(
      "real-evidence-refresh-coordinator-customer-digest-scheduling.json",
    );
    removeIfExists(recordPath);
    const env = customerDigestGuardEnv(recordPath, schedulingPath);
    const ready = writeRealEvidenceRefreshCoordinatorWithHostedProof(
      "real-evidence-refresh-coordinator-customer-digest-ready",
      env,
    );
    expect(ready.result.stdout).toContain(
      "Next real step: record_customer_observed_session_and_hosted_digest",
    );
    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-real-evidence-refresh-coordinator.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH:
          ready.coordinatorPath,
        ...env,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    const coordinator = readJsonArtifact(ready.coordinatorPath);
    expect(coordinator.real_evidence_refresh_coordinator).toMatchObject({
      guard_state: "ready_to_run_next_real_command",
      hosted_customer_session_digest_proof_claimed: false,
      mode: "operator_refresh_coordinator_only",
      next_real_step_id: "record_customer_observed_session_and_hosted_digest",
      ready_to_run_manual_command: true,
      real_evidence_command_executed: false,
    });
    expect(coordinator.manual_proof_command.command).toBe(
      "npm run admin:customer-session:record && npm run admin:customer-session:inspect",
    );
    expect(coordinator.paired_proof_inspector_commands).toBeUndefined();
    expect(
      coordinator.post_manual_verification_commands.map((row) => row.id),
    ).toEqual(["verify_hosted_customer_session_digest"]);
    expect(
      coordinator.post_manual_verification_commands.map((row) => row.command),
    ).toEqual([
      "npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
    ]);
    const operatorCommands = [
      coordinator.manual_proof_command.command,
      ...coordinator.post_manual_verification_commands.map((row) => row.command),
      ...coordinator.post_evidence_refresh_sequence.map((row) => row.command),
    ].join(" ");
    expect(
      operatorCommands.match(/hosted:customer-session-record:proof/g),
    ).toHaveLength(1);
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(coordinator[key]).toBe(value);
    }
  });

  it("wires real evidence execution guard package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymRealEvidenceExecutionGuard({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:real-evidence-execution-guard"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:real-evidence-execution-guard:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym real evidence execution guard",
    );
    expect(packet.summary).toContain("input names and create-only output path");
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Pre-run guard only",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymRealEvidenceExecutionGuard",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym real evidence execution guard"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });

  it("wires real evidence refresh coordinator package scripts, domain guidance, and Admin portal card", () => {
    const packet = founderAdminPublicRequestFirstGymRealEvidenceRefreshCoordinator({
      appOrigin: "https://outpost-preview.example",
      betaAccessRequestFollowThroughOutcomes: [],
      betaAccessRequestTriageReceipts: [],
      betaProofRunSummaryRecords: [],
      branchName: "outpost-beta-access-scoped",
      customerHandoffGateRecords: [],
      customerSessionRecords: [],
      handoffPacketRecords: [],
      launchDecisionRecords: [],
      launchPackageRecords: [],
      operatorSelfServeRehearsalRecords: [],
      previewUrl: "https://outpost-preview.example",
      proofRuns: [],
      source: "empty",
    });

    expect(packageJson).toContain(
      '"admin:public-request-first-gym:real-evidence-refresh-coordinator"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:real-evidence-refresh-coordinator:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym real evidence refresh coordinator",
    );
    expect(packet.summary).toContain(
      "manual proof, post-manual verification, and refresh sequence",
    );
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Refresh coordinator only",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymRealEvidenceRefreshCoordinator",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym real evidence refresh coordinator"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });
});
