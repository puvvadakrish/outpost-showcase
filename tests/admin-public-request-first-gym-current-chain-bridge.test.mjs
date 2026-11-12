import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  founderAdminPublicRequestFirstGymGoNoGoBundle,
  founderAdminPublicRequestFirstGymOperatorRunRecord,
  founderAdminPublicRequestLimitedBetaOperatorReviewPacket,
  founderAdminPublicRequestSelfServeLaunchPreflight,
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
  const dir = "artifacts/admin-public-request-first-gym-current-chain-tests";
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

describe("admin public request first-gym current-chain bridge", () => {
  it("prepares and inspects public-request go/no-go and run artifacts", () => {
    const evidencePath = writeHostedRehearsalEvidence("bridge-happy");
    const customerSessionPath = writeCustomerSessionRecord("bridge-happy");
    const bundlePath = artifactPath("bridge-happy-bundle.json");
    const runPath = artifactPath("bridge-happy-run.json");
    const limitedBetaPath = artifactPath("bridge-happy-limited-beta.json");
    const selfServePath = artifactPath("bridge-happy-self-serve.json");
    const controlsPath = artifactPath("bridge-happy-controls.json");
    const nextPath = artifactPath("bridge-happy-next.json");
    const intakePath = artifactPath("bridge-happy-intake.json");
    const followupPath = artifactPath("bridge-happy-followup.json");
    removeIfExists(bundlePath);
    removeIfExists(runPath);
    removeIfExists(limitedBetaPath);
    removeIfExists(selfServePath);
    removeIfExists(controlsPath);
    removeIfExists(nextPath);
    removeIfExists(intakePath);
    removeIfExists(followupPath);

    let result = run(
      "scripts/prepare-admin-public-request-first-gym-go-no-go-bundle.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH:
          evidencePath,
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
    expect(result.stdout).toContain(
      "Admin public request first-gym go/no-go bundle prepared",
    );

    result = run(
      "scripts/inspect-admin-public-request-first-gym-go-no-go-bundle.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH:
          bundlePath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym go/no-go bundle inspection passed",
    );
    const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
    expect(bundle).toMatchObject({
      artifact_kind: "admin_public_request_first_gym_go_no_go_bundle",
      hosted_customer_session_proof_recorded: true,
      first_gym_go_no_go_bundle_ready: true,
      ready_for_first_gym_operator_assisted_run: true,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });

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
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_UNEXPECTED_DATA_NOT_OBSERVED:
        "yes",
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED:
        "yes",
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_INVITE_DELIVERY_NOT_OBSERVED:
        "yes",
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED:
        "yes",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym operator-assisted run recorded",
    );

    result = run("scripts/inspect-admin-public-request-first-gym-operator-run.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH: runPath,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym operator run inspection passed",
    );

    const runRecord = JSON.parse(readFileSync(runPath, "utf8"));
    expect(runRecord).toMatchObject({
      artifact_kind: "admin_public_request_first_gym_operator_run_record",
      public_request_first_gym_operator_run_recorded: true,
      ready_for_limited_beta_review: true,
      public_request_form_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
    });

    result = run(
      "scripts/prepare-admin-public-request-limited-beta-operator-review-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH:
          runPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH:
          limitedBetaPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_REVIEWED_FIRST_GYM_RUN:
          "yes",
        OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR: "Krish",
        OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_CANDIDATE_GYM:
          "Second Gym Beta",
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request limited beta operator review packet prepared",
    );

    result = run(
      "scripts/inspect-admin-public-request-limited-beta-operator-review-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH:
          limitedBetaPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request limited beta operator review inspection passed",
    );

    const limitedBeta = JSON.parse(readFileSync(limitedBetaPath, "utf8"));
    expect(limitedBeta).toMatchObject({
      artifact_kind: "admin_public_request_limited_beta_operator_review_packet",
      evidence_basis: "admin_public_request_first_gym_operator_run_record",
      limited_beta_operator_review_ready: true,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
    });

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
    expect(result.stdout).toContain(
      "Admin public request self-serve launch preflight prepared",
    );

    result = run(
      "scripts/inspect-admin-public-request-self-serve-launch-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH:
          selfServePath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request self-serve launch preflight inspection passed",
    );

    const selfServe = JSON.parse(readFileSync(selfServePath, "utf8"));
    expect(selfServe).toMatchObject({
      artifact_kind: "admin_public_request_self_serve_launch_preflight",
      evidence_basis: "admin_public_request_limited_beta_operator_review_packet",
      public_self_serve_launch_preflight_ready: true,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });

    result = run("scripts/prepare-admin-public-launch-controls-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH:
        selfServePath,
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Preflight artifact: ${selfServePath}`);
    expect(result.stdout).toContain(
      "Evidence basis: admin_public_request_self_serve_launch_preflight",
    );
    result = run("scripts/inspect-admin-public-launch-controls-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
    });
    expect(result.status, result.stderr).toBe(0);
    const controls = JSON.parse(readFileSync(controlsPath, "utf8"));
    expect(controls).toMatchObject({
      artifact_kind: "admin_public_launch_controls_batch",
      evidence_basis: "admin_public_request_self_serve_launch_preflight",
      public_launch_controls_batch_ready: true,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
    });

    result = run("scripts/prepare-admin-public-launch-next-readiness-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
    });
    expect(result.status, result.stderr).toBe(0);
    result = run("scripts/inspect-admin-public-launch-next-readiness-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
    });
    expect(result.status, result.stderr).toBe(0);
    const next = JSON.parse(readFileSync(nextPath, "utf8"));
    expect(next).toMatchObject({
      artifact_kind: "admin_public_launch_next_readiness_batch",
      evidence_basis: "admin_public_launch_controls_batch",
      public_launch_next_readiness_batch_ready: true,
      public_request_form_submission_allowed: false,
      auth_user_created: false,
      provider_ingress_allowed: false,
    });

    result = run("scripts/prepare-admin-public-request-intake-artifact.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_LABEL: "Second Gym public request",
      OUTPOST_ADMIN_PUBLIC_REQUEST_CONTACT: "owner@second.example",
    });
    expect(result.status, result.stderr).toBe(0);
    result = run("scripts/inspect-admin-public-request-intake-artifact.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
    });
    expect(result.status, result.stderr).toBe(0);
    const intake = JSON.parse(readFileSync(intakePath, "utf8"));
    expect(intake).toMatchObject({
      artifact_kind: "admin_public_request_intake_artifact",
      evidence_basis: "admin_public_launch_next_readiness_batch",
      request_only_intake_artifact_ready: true,
      public_submission_accepted: false,
      invite_delivery_allowed: false,
    });

    result = run("scripts/prepare-admin-public-request-followup-readiness-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FOLLOWUP_READINESS_BATCH_PATH: followupPath,
    });
    expect(result.status, result.stderr).toBe(0);
    result = run("scripts/inspect-admin-public-request-followup-readiness-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FOLLOWUP_READINESS_BATCH_PATH: followupPath,
    });
    expect(result.status, result.stderr).toBe(0);
    const followup = JSON.parse(readFileSync(followupPath, "utf8"));
    expect(followup).toMatchObject({
      artifact_kind: "admin_public_request_followup_readiness_batch",
      evidence_basis: "admin_public_request_intake_artifact",
      public_request_followup_readiness_batch_ready: true,
      invite_delivery_allowed: false,
      product_auth_admin_api_allowed: false,
      auth_user_created: false,
      provider_ingress_allowed: false,
    });

    writeJsonArtifact(selfServePath, {
      ...selfServe,
      public_request_limited_beta_operator_review_packet_sha256:
        "0".repeat(64),
    });
    result = run(
      "scripts/inspect-admin-public-request-self-serve-launch-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH:
          selfServePath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "public request limited beta operator review packet SHA256 does not match",
    );

    writeJsonArtifact(controlsPath, {
      ...controls,
      public_self_serve_launch_preflight_sha256: "0".repeat(64),
    });
    result = run("scripts/inspect-admin-public-launch-controls-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "public self-serve launch preflight SHA256 does not match",
    );

    result = run("scripts/prepare-admin-public-launch-controls-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH:
        "../outside-current-chain.json",
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH",
    );

    writeJsonArtifact(limitedBetaPath, {
      ...limitedBeta,
      public_request_first_gym_operator_run_record_sha256: "0".repeat(64),
    });
    result = run(
      "scripts/inspect-admin-public-request-limited-beta-operator-review-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH:
          limitedBetaPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "public request first-gym operator run record SHA256 does not match",
    );
  }, 120000);

  it("fails closed on tampered proof and exposes Admin portal guidance", () => {
    const evidencePath = writeHostedRehearsalEvidence("bridge-fail");
    const customerSessionPath = writeCustomerSessionRecord("bridge-fail");
    const bundlePath = artifactPath("bridge-fail-bundle.json");
    removeIfExists(bundlePath);

    let result = run(
      "scripts/prepare-admin-public-request-first-gym-go-no-go-bundle.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH:
          evidencePath,
        OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: customerSessionPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH:
          bundlePath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PREVIEW_URL:
          "https://outpost-preview.example.vercel.app",
        OUTPOST_NEON_BRANCH_NAME: "outpost-proof-branch",
        OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_PASSED: "no",
        OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_OPERATOR: "Krish",
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_PASSED=yes required",
    );

    result = run(
      "scripts/prepare-admin-public-request-first-gym-go-no-go-bundle.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH:
          evidencePath,
        OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: customerSessionPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH:
          bundlePath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PREVIEW_URL:
          "https://outpost-preview.example.vercel.app",
        OUTPOST_NEON_BRANCH_NAME: "outpost-proof-branch",
        OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_PASSED: "yes",
        OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_OPERATOR: "Krish",
      },
    );
    expect(result.status, result.stderr).toBe(0);
    const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
    writeJsonArtifact(bundlePath, {
      ...bundle,
      public_request_hosted_rehearsal_evidence_sha256: "0".repeat(64),
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-go-no-go-bundle.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH:
          bundlePath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "public request hosted rehearsal evidence SHA256 does not match",
    );

    writeJsonArtifact(bundlePath, {
      ...bundle,
      protected_preview_url: "https://outpost-preview.example.com",
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-go-no-go-bundle.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH:
          bundlePath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Protected Preview URL must be a Vercel Preview origin",
    );

    writeJsonArtifact(bundlePath, {
      ...bundle,
      hosted_neon_branch: "outpost-neon-spike",
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-go-no-go-bundle.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH:
          bundlePath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Hosted Neon branch required");

    const originalEvidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    writeJsonArtifact(evidencePath, {
      ...originalEvidence,
      invite_delivery_allowed: true,
    });
    writeJsonArtifact(bundlePath, {
      ...bundle,
      public_request_hosted_rehearsal_evidence_sha256:
        sha256File(evidencePath),
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-go-no-go-bundle.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH:
          bundlePath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Public request hosted rehearsal evidence inspection failed",
    );

    expect(packageJson).toContain(
      "admin:public-request-first-gym:go-no-go:bundle",
    );
    expect(packageJson).toContain("admin:public-request-first-gym:run");
    expect(packageJson).toContain(
      "admin:public-request:limited-beta:operator-review",
    );
    expect(packageJson).toContain(
      "admin:public-request:self-serve:launch-preflight",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymGoNoGoBundle",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymOperatorRunRecord",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestLimitedBetaOperatorReviewPacket",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestSelfServeLaunchPreflight",
    );
    expect(founderAdminComponent).toContain(
      "Public request first gym go no go bundle",
    );
    expect(founderAdminComponent).toContain(
      "Public request self serve launch preflight",
    );

    const packet = founderAdminPublicRequestFirstGymGoNoGoBundle({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-07-01T12:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(packet.title).toBe("Public request first-gym go/no-go bundle");
    expect(packet.commands[0].command).toContain(
      "admin:public-request-first-gym:go-no-go:bundle",
    );
    const runPacket = founderAdminPublicRequestFirstGymOperatorRunRecord({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-07-01T12:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(runPacket.title).toBe("Public request first-gym operator run");
    expect(runPacket.commands[0].command).toContain(
      "admin:public-request-first-gym:run",
    );
    const limitedBetaPacket =
      founderAdminPublicRequestLimitedBetaOperatorReviewPacket({
        branchName: "outpost-proof-branch",
        previewUrl: "https://outpost-preview.example.vercel.app",
        generatedAt: "2026-07-01T12:00:00.000Z",
        gates: [],
        proofRuns: [],
        state: "pending",
        summary: "proof",
      });
    expect(limitedBetaPacket.title).toBe(
      "Public request limited beta review",
    );
    expect(limitedBetaPacket.commands[0].command).toContain(
      "admin:public-request:limited-beta:operator-review",
    );
    const selfServePacket = founderAdminPublicRequestSelfServeLaunchPreflight({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-07-01T12:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(selfServePacket.title).toBe(
      "Public request self-serve launch preflight",
    );
    expect(selfServePacket.commands[0].command).toContain(
      "admin:public-request:self-serve:launch-preflight",
    );
  }, 120000);
});
