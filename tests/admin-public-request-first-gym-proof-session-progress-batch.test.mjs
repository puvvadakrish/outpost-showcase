import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { founderAdminPublicRequestFirstGymProofSessionProgressBatch } from "../src/domain/founder-admin-readiness";

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
    "artifacts/admin-public-request-first-gym-proof-session-progress-tests";
  mkdirSync(dir, { recursive: true });
  return `${dir}/${name}`;
}

function removeIfExists(path) {
  rmSync(path, { force: true, recursive: true });
}

function removeExpectedChildArtifacts(prefix) {
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

function writeJsonArtifact(path, value) {
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
    generated_at: "2026-07-02T15:00:00.000Z",
    evidence_basis: "admin_public_request_hosted_rehearsal_readiness_batch",
    public_request_hosted_rehearsal_readiness_batch_path: hostedPath,
    public_request_hosted_rehearsal_readiness_batch_sha256: sha256File(hostedPath),
    candidate_gym_label: "Second Gym",
    public_request_first_gym_go_no_go_readiness_batch_ready: true,
    first_gym_go_no_go_readiness: {
      mode: "requires_hosted_rehearsal_evidence_and_customer_observed_session",
      hosted_rehearsal_evidence_required: true,
      customer_observed_session_required: true,
      owner_workspace_check_required: true,
      staff_workboard_check_required: true,
      reset_rollback_check_required: true,
      no_unexpected_data_check_required: true,
      no_live_provider_claim_required: true,
      approved_gym_hosted_rehearsal_recorded: false,
      customer_observed_handoff_recorded: false,
      customer_observed_session_recorded: false,
      first_gym_go_no_go_bundle_ready: false,
      ready_for_first_gym_operator_assisted_run: false,
      public_launch_decision_allowed: false,
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
    status: "admin_limited_beta_operator_review_packet_prepared",
    candidate_gym_label: "Second Gym",
  });
  writeJsonArtifact(preflightPath, {
    artifact_kind: "admin_public_self_serve_launch_preflight",
    status: "admin_public_self_serve_launch_preflight_prepared",
    generated_at: "2026-07-02T16:00:00.000Z",
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

function observationEnv(hostedPath, evidencePath) {
  return {
    OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
      hostedPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH: evidencePath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_STAFF_WORKBOARD_OBSERVED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_RESET_ROLLBACK_REVIEWED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED:
      "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_INVITE_DELIVERY_NOT_OBSERVED:
      "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED:
      "yes",
  };
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
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
        readinessPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
        acquisitionPath,
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

function writeExecutionLedger(prefix) {
  removeExpectedChildArtifacts(prefix);
  const runwayPath = writeProofRunway(prefix);
  const ledgerPath = artifactPath(`${prefix}-execution-ledger.json`);
  removeIfExists(ledgerPath);
  const result = run("scripts/prepare-admin-public-request-first-gym-execution-ledger.mjs", {
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH: runwayPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
  });
  expect(result.status, result.stderr).toBe(0);
  return ledgerPath;
}

function writeExecutionPack(prefix) {
  const ledgerPath = writeExecutionLedger(prefix);
  const packetPath = artifactPath(`${prefix}-missing-proof-packet.json`);
  const gatePath = artifactPath(`${prefix}-completion-gate.json`);
  const runbookPath = artifactPath(`${prefix}-proof-session-runbook.json`);
  const packPath = artifactPath(`${prefix}-proof-session-execution-pack.json`);
  removeIfExists(packetPath);
  removeIfExists(gatePath);
  removeIfExists(runbookPath);
  removeIfExists(packPath);
  let result = run("scripts/prepare-admin-public-request-first-gym-missing-proof-packet.mjs", {
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH: packetPath,
  });
  expect(result.status, result.stderr).toBe(0);
  result = run("scripts/prepare-admin-public-request-first-gym-completion-gate.mjs", {
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH: gatePath,
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
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH:
        runbookPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH:
        packPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return packPath;
}

function writeProgressBatch(prefix) {
  const packPath = writeExecutionPack(prefix);
  const progressPath = artifactPath(`${prefix}-proof-session-progress-batch.json`);
  removeIfExists(progressPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-session-progress-batch.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH:
        packPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH:
        progressPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { packPath, progressPath, result };
}

describe("admin public request first-gym proof session progress batch", () => {
  it("writes a status-only progress ledger, next-step packet, and completion check from the execution pack", () => {
    const { progressPath, result } = writeProgressBatch("blocked");
    expect(result.stdout).toContain(
      "Admin public request first-gym proof session progress batch prepared",
    );
    expect(result.stdout).toContain("Inspectable evidence: 0");
    expect(result.stdout).toContain("Missing evidence: 7");

    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-progress-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH:
          progressPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym proof session progress batch inspection passed",
    );

    const progress = readJsonArtifact(progressPath);
    expect(progress.artifact_kind).toBe(
      "admin_public_request_first_gym_proof_session_progress_batch",
    );
    expect(progress.proof_session_progress).toMatchObject({
      all_expected_evidence_inspectable: false,
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      inspectable_count: 0,
      limited_beta_review_recorded: false,
      missing_count: 7,
      mode: "status_only_reinspect_expected_evidence",
      next_required_step_id: "hosted_rehearsal_evidence",
      public_launch_decision_allowed: false,
      total_expected_evidence_count: 7,
    });
    expect(progress.progress_ledger.map((step) => step.id)).toEqual([
      "hosted_rehearsal_evidence",
      "customer_observed_session",
      "first_gym_go_no_go_bundle",
      "first_gym_operator_run",
      "limited_beta_operator_review",
      "public_request_self_serve_preflight",
      "public_launch_controls",
    ]);
    expect(progress.progress_ledger.every((step) => step.state === "missing")).toBe(
      true,
    );
    expect(progress.progress_ledger.every((step) => step.artifact_sha256 === null)).toBe(
      true,
    );
    expect(progress.next_step_packet.missing_command_sequence).toHaveLength(7);
    expect(progress.completion_check.state).toBe("blocked");
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(progress[key]).toBe(value);
    }
  });

  it("rejects stale parent SHA and launch-enabling edits", () => {
    const { packPath, progressPath } = writeProgressBatch("tampered");
    const progress = readJsonArtifact(progressPath);
    writeJsonArtifact(progressPath, {
      ...progress,
      public_request_first_gym_proof_session_execution_pack_sha256: "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-progress-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH:
          progressPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof session execution pack SHA256 does not match.",
    );

    writeJsonArtifact(progressPath, {
      ...progress,
      public_launch_decision_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-progress-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH:
          progressPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof session progress batch public_launch_decision_allowed blocked.",
    );

    const pack = readJsonArtifact(packPath);
    writeJsonArtifact(packPath, {
      ...pack,
      customer_safe_worksheet: [],
      expected_evidence_manifest: [],
    });
    const prepare = run(
      "scripts/prepare-admin-public-request-first-gym-proof-session-progress-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH:
          packPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH:
          artifactPath("tampered-empty-manifest-progress-batch.json"),
      },
    );
    expect(prepare.status).not.toBe(0);
    expect(prepare.stderr).toContain(
      "Execution pack evidence manifest count mismatch.",
    );
  });

  it("marks present expected evidence inspectable only after its dedicated inspector passes", () => {
    const packPath = writeExecutionPack("inspectable");
    const pack = readJsonArtifact(packPath);
    const hostedEvidencePath = pack.expected_evidence_manifest.find(
      (step) => step.id === "hosted_rehearsal_evidence",
    ).artifact_path;
    removeIfExists(hostedEvidencePath);
    const hostedReadinessPath = writeHostedReadiness("inspectable");
    const record = run(
      "scripts/record-admin-public-request-hosted-rehearsal-evidence.mjs",
      observationEnv(hostedReadinessPath, hostedEvidencePath),
    );
    expect(record.status, record.stderr).toBe(0);

    const progressPath = artifactPath(
      "inspectable-proof-session-progress-batch.json",
    );
    removeIfExists(progressPath);
    const prepare = run(
      "scripts/prepare-admin-public-request-first-gym-proof-session-progress-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH:
          packPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH:
          progressPath,
      },
    );
    expect(prepare.status, prepare.stderr).toBe(0);

    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-progress-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH:
          progressPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);

    const progress = readJsonArtifact(progressPath);
    const hostedStep = progress.progress_ledger.find(
      (step) => step.id === "hosted_rehearsal_evidence",
    );
    expect(progress.proof_session_progress.inspectable_count).toBe(1);
    expect(progress.proof_session_progress.missing_count).toBe(6);
    expect(progress.proof_session_progress.next_required_step_id).toBe(
      "customer_observed_session",
    );
    expect(hostedStep).toMatchObject({
      artifact_path: hostedEvidencePath,
      inspector_env: "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
      inspector_script:
        "scripts/inspect-admin-public-request-hosted-rehearsal-evidence.mjs",
      recorded_by_progress_batch: false,
      state: "inspectable",
    });
    expect(hostedStep.artifact_sha256).toBe(sha256File(hostedEvidencePath));
  });

  it("wires package scripts, domain guidance, and Admin portal read-only card", () => {
    const packet = founderAdminPublicRequestFirstGymProofSessionProgressBatch({
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
      '"admin:public-request-first-gym:proof-session-progress"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-session-progress:inspect"',
    );
    expect(packet.title).toBe("Public request first-gym proof session progress");
    expect(packet.summary).toContain("without recording proof");
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Status-only progress",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymProofSessionProgressBatch",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym proof session progress"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });
});
