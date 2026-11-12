import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  founderAdminPublicRequestFirstGymCompletionGate,
  founderAdminPublicRequestFirstGymMissingProofPacket,
} from "../src/domain/founder-admin-readiness";

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
  const dir = "artifacts/admin-public-request-first-gym-execution-control-tests";
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

function writeGoNoGoReadiness(prefix) {
  const hostedPath = artifactPath(`${prefix}-hosted.json`);
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
    generated_at: "2026-07-01T15:00:00.000Z",
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
    next_readiness_batches: [
      { id: "first_gym_go_no_go_bundle" },
      { id: "public_self_serve_preflight" },
      { id: "live_provider_revenue_gates" },
    ],
  });
  return readinessPath;
}

function writeExecutionLedger(prefix) {
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

function writeProofRunway(prefix) {
  const readinessPath = writeGoNoGoReadiness(prefix);
  const evidencePath = artifactPath(`${prefix}-evidence-acquisition.json`);
  const runwayPath = artifactPath(
    `${prefix}-public-request-first-gym-proof-runway-batch.json`,
  );
  removeIfExists(evidencePath);
  removeIfExists(runwayPath);
  let result = run(
    "scripts/prepare-admin-public-request-first-gym-evidence-acquisition-batch.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
        readinessPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
        evidencePath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  result = run("scripts/prepare-admin-public-request-first-gym-proof-runway-batch.mjs", {
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
      evidencePath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH: runwayPath,
  });
  expect(result.status, result.stderr).toBe(0);
  return runwayPath;
}

function writeHostedRehearsalEvidence(prefix, overrides = {}) {
  const ownerStaffPath = artifactPath(`${prefix}-owner-staff.json`);
  const readinessPath = artifactPath(`${prefix}-hosted-readiness.json`);
  const evidencePath = artifactPath(`${prefix}-hosted-evidence.json`);
  removeIfExists(ownerStaffPath);
  removeIfExists(readinessPath);
  removeIfExists(evidencePath);
  writeJsonArtifact(ownerStaffPath, {
    artifact_kind: "admin_public_request_owner_staff_handoff_readiness_batch",
    candidate_gym_label: "Second Gym",
  });
  writeJsonArtifact(readinessPath, {
    artifact_kind: "admin_public_request_hosted_rehearsal_readiness_batch",
    status: "admin_public_request_hosted_rehearsal_readiness_batch_prepared",
    generated_at: "2026-07-01T12:00:00.000Z",
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
    next_readiness_batches: [
      { id: "first_gym_go_no_go_bundle" },
      { id: "public_self_serve_preflight" },
      { id: "live_provider_revenue_gates" },
    ],
  });
  writeJsonArtifact(evidencePath, {
    artifact_kind: "admin_public_request_hosted_rehearsal_evidence",
    status: "admin_public_request_hosted_rehearsal_evidence_recorded",
    generated_at: "2026-07-01T12:05:00.000Z",
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
    ...overrides,
  });
  return evidencePath;
}

function writeCustomerSessionRecord(prefix, overrides = {}) {
  const walkthroughPath = artifactPath(`${prefix}-walkthrough.json`);
  const schedulingPath = artifactPath(`${prefix}-scheduling.json`);
  const recordPath = artifactPath(`${prefix}-customer-session.json`);
  removeIfExists(walkthroughPath);
  removeIfExists(schedulingPath);
  removeIfExists(recordPath);
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
    ...overrides,
  });
  return recordPath;
}

function writeInspectableExecutionLedger(prefix) {
  const runwayPath = writeProofRunway(prefix);
  const evidencePath = writeHostedRehearsalEvidence(prefix);
  const customerSessionPath = writeCustomerSessionRecord(prefix);
  const bundlePath = artifactPath(`${prefix}-bundle.json`);
  const runPath = artifactPath(`${prefix}-run.json`);
  const limitedBetaPath = artifactPath(`${prefix}-limited-beta.json`);
  const selfServePath = artifactPath(`${prefix}-self-serve.json`);
  const controlsPath = artifactPath(`${prefix}-controls.json`);
  const ledgerPath = artifactPath(`${prefix}-inspectable-execution-ledger.json`);
  [
    bundlePath,
    runPath,
    limitedBetaPath,
    selfServePath,
    controlsPath,
    ledgerPath,
  ].forEach(removeIfExists);

  let result = run(
    "scripts/prepare-admin-public-request-first-gym-go-no-go-bundle.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH: evidencePath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: customerSessionPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH:
        bundlePath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PREVIEW_URL:
        "https://outpost-preview.example.vercel.app/path?ignored=1",
      OUTPOST_NEON_BRANCH_NAME: "outpost-proof-branch",
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_PASSED: "yes",
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_OPERATOR: "Krish",
    },
  );
  expect(result.status, result.stderr).toBe(0);

  result = run("scripts/record-admin-public-request-first-gym-operator-run.mjs", {
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH: bundlePath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH: runPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR: "Krish",
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OWNER_WORKSPACE_COMPLETED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_STAFF_WORKBOARD_COMPLETED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_SOURCE_TO_ANSWER_TO_TASK_COMPLETED:
      "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_RESET_ROLLBACK_EXERCISED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_SUPPORT_HANDOFF_REVIEWED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED:
      "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_INVITE_DELIVERY_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED:
      "yes",
  });
  expect(result.status, result.stderr).toBe(0);

  result = run(
    "scripts/prepare-admin-public-request-limited-beta-operator-review-packet.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH: runPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH:
        limitedBetaPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_REVIEWED_FIRST_GYM_RUN: "yes",
      OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR: "Krish",
      OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_CANDIDATE_GYM:
        "Second Gym Beta",
    },
  );
  expect(result.status, result.stderr).toBe(0);

  result = run(
    "scripts/prepare-admin-public-request-self-serve-launch-preflight.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH:
        limitedBetaPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH:
        selfServePath,
    },
  );
  expect(result.status, result.stderr).toBe(0);

  result = run("scripts/prepare-admin-public-launch-controls-batch.mjs", {
    OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH:
      selfServePath,
    OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
  });
  expect(result.status, result.stderr).toBe(0);

  result = run("scripts/prepare-admin-public-request-first-gym-execution-ledger.mjs", {
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH: runwayPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH: evidencePath,
    OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: customerSessionPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH: bundlePath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH: runPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH:
      limitedBetaPath,
    OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH:
      selfServePath,
    OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
  });
  expect(result.status, result.stderr).toBe(0);
  return ledgerPath;
}

describe("admin public request first-gym execution control batch", () => {
  it("builds missing proof packet and completion gate from the execution ledger", () => {
    const ledgerPath = writeExecutionLedger("control-happy");
    const packetPath = artifactPath("control-happy-missing-proof-packet.json");
    const gatePath = artifactPath("control-happy-completion-gate.json");
    removeIfExists(packetPath);
    removeIfExists(gatePath);

    let result = run(
      "scripts/prepare-admin-public-request-first-gym-missing-proof-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH:
          packetPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym missing proof packet prepared",
    );
    expect(result.stdout).toContain("Missing commands: 7");

    result = run(
      "scripts/inspect-admin-public-request-first-gym-missing-proof-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH:
          packetPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym missing proof packet inspection passed",
    );

    result = run("scripts/prepare-admin-public-request-first-gym-completion-gate.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH: gatePath,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym completion gate prepared",
    );
    expect(result.stdout).toContain(
      "Status: admin_public_request_first_gym_completion_gate_blocked",
    );

    result = run("scripts/inspect-admin-public-request-first-gym-completion-gate.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH: gatePath,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym completion gate inspection passed",
    );

    const packet = JSON.parse(readFileSync(packetPath, "utf8"));
    expect(packet).toMatchObject({
      artifact_kind: "admin_public_request_first_gym_missing_proof_packet",
      evidence_basis: "admin_public_request_first_gym_execution_ledger",
      missing_proof_packet: {
        mode: "terminal_command_packet_only",
        missing_count: 7,
        inspectable_count: 0,
        all_required_artifacts_inspectable: false,
        next_required_step_id: "hosted_rehearsal_evidence",
        first_gym_proof_recorded: false,
        ready_for_limited_beta_operator_review: false,
        public_launch_decision_allowed: false,
      },
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(packet.missing_command_sequence.map((step) => step.id)).toEqual([
      "hosted_rehearsal_evidence",
      "customer_observed_session",
      "first_gym_go_no_go_bundle",
      "first_gym_operator_run",
      "limited_beta_operator_review",
      "public_request_self_serve_preflight",
      "public_launch_controls",
    ]);

    const gate = JSON.parse(readFileSync(gatePath, "utf8"));
    expect(gate).toMatchObject({
      artifact_kind: "admin_public_request_first_gym_completion_gate",
      status: "admin_public_request_first_gym_completion_gate_blocked",
      completion_gate: {
        mode: "derived_from_execution_ledger_only",
        missing_count: 7,
        inspectable_count: 0,
        all_required_artifacts_inspectable: false,
        first_gym_operator_run_recorded: false,
        ready_for_public_self_serve_launch: false,
        public_launch_decision_allowed: false,
      },
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });

    writeJsonArtifact(packetPath, {
      ...packet,
      missing_command_sequence: packet.missing_command_sequence.slice().reverse(),
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-missing-proof-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH:
          packetPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing command 1 id mismatch");

    writeJsonArtifact(gatePath, {
      ...gate,
      public_self_serve_launch_allowed: true,
    });
    result = run("scripts/inspect-admin-public-request-first-gym-completion-gate.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH: gatePath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("public_self_serve_launch_allowed blocked");
  });

  it("fails closed when the execution ledger SHA drifts after packet creation", () => {
    const ledgerPath = writeExecutionLedger("control-sha-drift");
    const packetPath = artifactPath("control-sha-drift-missing-proof-packet.json");
    removeIfExists(packetPath);

    let result = run(
      "scripts/prepare-admin-public-request-first-gym-missing-proof-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH:
          packetPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);

    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    writeJsonArtifact(ledgerPath, {
      ...ledger,
      generated_at: "2026-07-01T23:59:59.000Z",
    });

    result = run(
      "scripts/inspect-admin-public-request-first-gym-missing-proof-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH:
          packetPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Execution ledger SHA256 does not match parent artifact",
    );
  });

  it("fails closed when the execution ledger SHA drifts after completion gate creation", () => {
    const ledgerPath = writeExecutionLedger("control-gate-sha-drift");
    const gatePath = artifactPath("control-gate-sha-drift-completion-gate.json");
    removeIfExists(gatePath);

    let result = run("scripts/prepare-admin-public-request-first-gym-completion-gate.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH: gatePath,
    });
    expect(result.status, result.stderr).toBe(0);

    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    writeJsonArtifact(ledgerPath, {
      ...ledger,
      generated_at: "2026-07-01T23:58:58.000Z",
    });

    result = run("scripts/inspect-admin-public-request-first-gym-completion-gate.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH: gatePath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Execution ledger SHA256 does not match parent artifact",
    );
  });

  it("marks the completion gate ready only when every ledger child artifact is inspectable", () => {
    const ledgerPath = writeInspectableExecutionLedger("control-ready");
    const gatePath = artifactPath("control-ready-completion-gate.json");
    removeIfExists(gatePath);

    let result = run("scripts/prepare-admin-public-request-first-gym-completion-gate.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH: ledgerPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH: gatePath,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Status: admin_public_request_first_gym_completion_gate_ready",
    );

    result = run("scripts/inspect-admin-public-request-first-gym-completion-gate.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH: gatePath,
    });
    expect(result.status, result.stderr).toBe(0);

    const gate = JSON.parse(readFileSync(gatePath, "utf8"));
    expect(gate).toMatchObject({
      status: "admin_public_request_first_gym_completion_gate_ready",
      completion_gate: {
        missing_count: 0,
        inspectable_count: 7,
        all_required_artifacts_inspectable: true,
        hosted_rehearsal_evidence_recorded: true,
        customer_observed_session_recorded: true,
        first_gym_go_no_go_bundle_ready: true,
        first_gym_operator_run_recorded: true,
        limited_beta_operator_review_ready: true,
        public_request_self_serve_launch_preflight_ready: true,
        public_launch_controls_batch_ready: true,
        ready_for_public_self_serve_launch: false,
        public_launch_decision_allowed: false,
      },
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });

    writeJsonArtifact(gatePath, {
      ...gate,
      completion_gate: {
        ...gate.completion_gate,
        limited_beta_operator_review_ready: false,
      },
    });
    result = run("scripts/inspect-admin-public-request-first-gym-completion-gate.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH: gatePath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Limited beta operator review state mismatch");
  }, 240000);

  it("wires scripts and Admin portal guidance without browser approval paths", () => {
    expect(packageJson).toContain(
      "admin:public-request-first-gym:missing-proof",
    );
    expect(packageJson).toContain(
      "admin:public-request-first-gym:completion-gate",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymMissingProofPacket",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymCompletionGate",
    );
    expect(founderAdminComponent).toContain(
      "Public request first gym missing proof packet",
    );
    expect(founderAdminComponent).toContain(
      "Public request first gym completion gate",
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");

    const packet = founderAdminPublicRequestFirstGymMissingProofPacket({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.vercel.app",
    });
    expect(packet.title).toBe("Public request first-gym missing proof packet");
    expect(packet.commands.map((command) => command.command).join("\n")).toContain(
      "npm run admin:public-request-first-gym:missing-proof",
    );
    expect(packet.summary).toContain("ordered terminal command queue");

    const gate = founderAdminPublicRequestFirstGymCompletionGate({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.vercel.app",
    });
    expect(gate.title).toBe("Public request first-gym completion gate");
    expect(gate.commands.map((command) => command.command).join("\n")).toContain(
      "npm run admin:public-request-first-gym:completion-gate",
    );
    expect(gate.summary).toContain("public/live-provider gates remain blocked");
  });
});
