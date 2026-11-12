import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  founderAdminApprovedBetaExpansionReadinessBatch,
  founderAdminApprovedGymHostedRehearsalEvidence,
  founderAdminApprovedGymHostedRehearsalReadinessBatch,
  founderAdminFirstGymGoNoGoBundle,
  founderAdminFirstGymOperatorRunRecord,
  founderAdminLimitedBetaOperatorReviewPacket,
  founderAdminOwnerStaffHandoffReadinessBatch,
  founderAdminPublicLaunchControlsBatch,
  founderAdminPublicSelfServeLaunchPreflight,
  founderAdminRequestIntakeInviteAuthReadinessBatch,
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
  const dir = "artifacts/admin-approved-beta-expansion-tests";
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
      "artifacts/admin-approved-beta-expansion-tests/continuous.json",
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

function writeFirstGymGoNoGoFixture(prefix) {
  const rehearsalPath = artifactPath(`${prefix}-rehearsal-evidence.json`);
  const customerSessionPath = artifactPath(`${prefix}-customer-session.json`);
  const goNoGoPath = artifactPath(`${prefix}-go-no-go.json`);
  removeIfExists(rehearsalPath);
  removeIfExists(customerSessionPath);
  removeIfExists(goNoGoPath);

  writeJsonArtifact(rehearsalPath, {
    artifact_kind: "admin_approved_gym_hosted_rehearsal_evidence",
    status: "admin_approved_gym_hosted_rehearsal_recorded",
    approved_gym_label: "North Loop Strength",
    protected_preview_url: "https://outpost-preview.example.vercel.app",
    hosted_neon_branch: "outpost-proof-branch",
  });
  writeJsonArtifact(customerSessionPath, {
    artifact_kind: "admin_customer_observed_session_record",
    status: "admin_customer_observed_session_recorded",
    gym_name: "North Loop Strength",
    owner_email: "owner@northloop.example",
  });
  writeJsonArtifact(goNoGoPath, {
    artifact_kind: "admin_first_gym_go_no_go_bundle",
    status: "admin_first_gym_go_no_go_bundle_prepared",
    generated_at: "2026-06-30T12:00:00.000Z",
    evidence_basis: "approved_gym_hosted_rehearsal_and_customer_observed_session",
    approved_gym_hosted_rehearsal_evidence_path: rehearsalPath,
    approved_gym_hosted_rehearsal_evidence_sha256: sha256File(rehearsalPath),
    customer_session_record_path: customerSessionPath,
    customer_session_record_sha256: sha256File(customerSessionPath),
    gym_name: "North Loop Strength",
    owner_email: "owner@northloop.example",
    protected_preview_url: "https://outpost-preview.example.vercel.app",
    hosted_neon_branch: "outpost-proof-branch",
    approved_gym_hosted_rehearsal_recorded: true,
    customer_observed_session_recorded: true,
    customer_observed_handoff_claimed: true,
    first_gym_go_no_go_bundle_ready: true,
    ready_for_first_gym_operator_assisted_run: true,
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_admin_product_api_allowed: false,
    auth_user_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    ready_gates: [
      "Approved-gym hosted rehearsal evidence recorded",
      "Real customer-observed session record present",
      "Parent artifact SHA chain verified",
    ],
    blocked_gates: [
      "Public owner self-signup",
      "Invite delivery send",
      "Phone/email provider activation",
      "Billing, POS, access control, member-ledger writes",
    ],
  });

  return { customerSessionPath, goNoGoPath, rehearsalPath };
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
    generated_at: "2026-06-30T12:30:00.000Z",
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
      "Invite delivery",
      "Phone/email provider activation",
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

  return { preflightPath, reviewPath };
}

function writePostCustomerProofChain(label = "proof") {
  const walkthroughPath = artifactPath(`${label}-walkthrough.json`);
  const schedulingPath = artifactPath(`${label}-scheduling.json`);
  const gatePreflightPath = artifactPath(`${label}-gate-preflight.json`);
  const importReadinessPath = artifactPath(`${label}-import-readiness.json`);
  const limitedBetaGatePath = artifactPath(`${label}-limited-beta-gate.json`);
  const recordPath = artifactPath(`${label}-customer-session-record.json`);
  const postProofPath = artifactPath(`${label}-post-proof.json`);
  for (const path of [
    walkthroughPath,
    schedulingPath,
    gatePreflightPath,
    importReadinessPath,
    limitedBetaGatePath,
    recordPath,
    postProofPath,
  ]) {
    removeIfExists(path);
  }

  writeJsonArtifact(walkthroughPath, validProtectedPreviewWalkthrough());
  writeJsonArtifact(schedulingPath, validSchedulingBatch(walkthroughPath));
  expect(
    run("scripts/prepare-admin-customer-handoff-gate-preflight.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: gatePreflightPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
    }).status,
  ).toBe(0);
  expect(
    run("scripts/prepare-admin-customer-session-hosted-import-readiness.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: gatePreflightPath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH:
        importReadinessPath,
    }).status,
  ).toBe(0);
  expect(
    run("scripts/prepare-admin-limited-beta-readiness-gate.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH:
        importReadinessPath,
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: limitedBetaGatePath,
    }).status,
  ).toBe(0);
  expect(
    run("scripts/record-admin-customer-observed-session.mjs", {
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
      OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED:
        "yes",
      OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_LABEL: "Proof Owner",
      OUTPOST_ADMIN_CUSTOMER_SESSION_OPERATOR: "Krish",
    }).status,
  ).toBe(0);
  const postProof = run("scripts/prepare-admin-post-customer-proof-readiness-batch.mjs", {
    OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: limitedBetaGatePath,
    OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
    OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: postProofPath,
    OUTPOST_ADMIN_POST_CUSTOMER_PROOF_HOSTED_PROOF_OBSERVED: "yes",
  });
  expect(postProof.status, postProof.stderr).toBe(0);
  return postProofPath;
}

function writeOwnerFollowthrough(path, overrides = {}) {
  writeJsonArtifact(path, {
    status: "owner_beta_request_followthrough_prepared",
    packet_kind: "owner_beta_request_followthrough",
    generated_at: "2026-06-29T12:10:00.000Z",
    preview_url: "https://outpost-preview.example.vercel.app",
    neon_proof_branch: "outpost-proof-branch",
    request: {
      id: "owner_beta_request_north_loop",
      gym_name: "North Loop Strength",
      email: "owner@northloop.example",
      status: "ready_for_triage",
    },
    triage_receipt: {
      id: "owner_beta_triage_north_loop",
      decision: "ready_for_operator_fulfillment",
      packet_sha256: "b".repeat(64),
      reviewer_label: "Krish",
    },
    public_self_serve_launch_allowed: false,
    launch_enablement_allowed: false,
    requires_human_review: true,
    next_operator_commands: [
      "npm run beta:operator:request-preflight",
      "npm run beta:operator:request-fulfillment",
      "npm run hosted:request-fulfillment-proof",
    ],
    ...overrides,
  });
}

describe("admin approved beta expansion readiness batch", () => {
  it("prepares and inspects approved beta expansion from post-proof and owner follow-through", () => {
    const postProofPath = writePostCustomerProofChain("happy");
    const followthroughPath = artifactPath("happy-followthrough.json");
    const batchPath = artifactPath("happy-approved-beta-expansion.json");
    removeIfExists(followthroughPath);
    removeIfExists(batchPath);
    writeOwnerFollowthrough(followthroughPath);

    const prepare = run("scripts/prepare-admin-approved-beta-expansion-readiness-batch.mjs", {
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: postProofPath,
      OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: followthroughPath,
      OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH: batchPath,
      OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_GYM_LABEL: "North Loop Strength",
    });
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(prepare.stdout).toContain(
      "Approved gym operator fulfillment: ready for operator review",
    );

    const inspect = run("scripts/inspect-admin-approved-beta-expansion-readiness-batch.mjs", {
      OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH: batchPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin approved beta expansion readiness batch OK",
    );

    const artifact = JSON.parse(readFileSync(batchPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_approved_beta_expansion_readiness_batch",
      approved_gym_non_acme_fitness: true,
      owner_access_mode: "operator_managed",
      approved_gym_operator_fulfillment_ready: true,
      public_request_intake_dry_run_ready: true,
      invite_auth_dry_run_ready: false,
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
      "approved_gym_operator_fulfillment",
      "public_request_intake_dry_run",
      "invite_auth_dry_run_gates",
      "live_provider_revenue_gates",
    ]);
  }, 120000);

  it("fails closed for Acme Fitness labels and tampered follow-through SHA", () => {
    const postProofPath = writePostCustomerProofChain("fail");
    const followthroughPath = artifactPath("fail-followthrough.json");
    const batchPath = artifactPath("fail-approved-beta-expansion.json");
    removeIfExists(followthroughPath);
    removeIfExists(batchPath);
    writeOwnerFollowthrough(followthroughPath, {
      request: {
        id: "owner_beta_request_acme",
        gym_name: "Acme Fitness",
        email: "owner@acme.example",
        status: "ready_for_triage",
      },
    });

    let result = run("scripts/prepare-admin-approved-beta-expansion-readiness-batch.mjs", {
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: postProofPath,
      OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: followthroughPath,
      OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH: batchPath,
      OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_GYM_LABEL: "Acme Fitness",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("non-House-of-Fitness real gym");

    writeOwnerFollowthrough(followthroughPath);
    result = run("scripts/prepare-admin-approved-beta-expansion-readiness-batch.mjs", {
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: postProofPath,
      OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: followthroughPath,
      OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH: batchPath,
      OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_GYM_LABEL: "North Loop Strength",
    });
    expect(result.status, result.stderr).toBe(0);
    const batch = JSON.parse(readFileSync(batchPath, "utf8"));
    writeJsonArtifact(batchPath, {
      ...batch,
      owner_beta_request_followthrough_sha256: "0".repeat(64),
    });
    result = run("scripts/inspect-admin-approved-beta-expansion-readiness-batch.mjs", {
      OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH: batchPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Owner beta request follow-through SHA256 does not match",
    );

    writeJsonArtifact(batchPath, {
      ...batch,
      approved_gym_label: "Acme Fitness",
    });
    result = run("scripts/inspect-admin-approved-beta-expansion-readiness-batch.mjs", {
      OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH: batchPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("non-House-of-Fitness real gym");
  }, 120000);

  it("exposes scripts and Admin console command guidance", () => {
    expect(packageJson).toContain("admin:approved-beta-expansion:batch");
    expect(packageJson).toContain("admin:approved-beta-expansion:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminApprovedBetaExpansionReadinessBatch",
    );
    expect(founderAdminComponent).toContain(
      "Approved beta expansion readiness batch",
    );

    const packet = founderAdminApprovedBetaExpansionReadinessBatch({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-29T12:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(packet.title).toBe("Approved beta expansion readiness batch");
    expect(packet.commands[0].command).toContain(
      "admin:approved-beta-expansion:batch",
    );
    expect(packet.nextReadinessBatches.map((slice) => slice.id)).toEqual([
      "approved_gym_operator_fulfillment",
      "public_request_intake_dry_run",
      "invite_auth_dry_run_gates",
      "live_provider_revenue_gates",
    ]);
  });
});

describe("admin request intake invite/Auth readiness batch", () => {
  it("packages approved expansion into request intake, invite no-send, and Auth no-create readiness", () => {
    const postProofPath = writePostCustomerProofChain("request-batch");
    const followthroughPath = artifactPath("request-batch-followthrough.json");
    const approvedPath = artifactPath("request-batch-approved-expansion.json");
    const batchPath = artifactPath("request-batch-intake-invite-auth.json");

    removeIfExists(followthroughPath);
    removeIfExists(approvedPath);
    removeIfExists(batchPath);
    writeOwnerFollowthrough(followthroughPath);

    expect(
      run("scripts/prepare-admin-approved-beta-expansion-readiness-batch.mjs", {
        OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: postProofPath,
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: followthroughPath,
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH:
          approvedPath,
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_GYM_LABEL:
          "North Loop Strength",
      }).status,
    ).toBe(0);

    const prepare = run(
      "scripts/prepare-admin-request-intake-invite-auth-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH:
          approvedPath,
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
          batchPath,
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_GYM_LABEL:
          "North Loop Strength",
      },
    );
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(prepare.stdout).toContain(
      "Admin request-intake invite/Auth readiness batch written",
    );

    const inspect = run(
      "scripts/inspect-admin-request-intake-invite-auth-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin request-intake invite/Auth readiness batch OK",
    );

    const artifact = JSON.parse(readFileSync(batchPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_request_intake_invite_auth_readiness_batch",
      evidence_basis: "admin_approved_beta_expansion_readiness_batch",
      operator_fulfillment_mode: "operator_managed_owner_access_only",
      public_request_intake_mode: "request_only_review_only_no_persistence",
      invite_preflight_mode: "review_only_no_send",
      auth_admin_dry_run_mode: "operator_review_only_no_user_created",
      approved_gym_operator_fulfillment_ready: true,
      public_request_intake_dry_run_ready: true,
      invite_delivery_preflight_ready: true,
      auth_admin_provisioning_dry_run_ready: true,
      public_self_serve_launch_allowed: false,
      public_request_form_allowed: false,
      browser_approval_buttons_allowed: false,
      auth_user_created: false,
      invite_delivery_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      product_auth_admin_api_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(artifact.current_batch_set).toContain(
      "Auth admin provisioning as no-create dry-run",
    );
    expect(artifact.next_readiness_batches.map((slice) => slice.id)).toEqual([
      "owner_access_fulfillment_evidence",
      "operator_assisted_onboarding_rehearsal",
      "public_self_serve_preflight",
      "live_provider_revenue_gates",
    ]);
  }, 120000);

  it("fails closed on parent tamper unsafe labels and exposes Admin guidance", () => {
    const postProofPath = writePostCustomerProofChain("request-fail");
    const followthroughPath = artifactPath("request-fail-followthrough.json");
    const approvedPath = artifactPath("request-fail-approved-expansion.json");
    const batchPath = artifactPath("request-fail-intake-invite-auth.json");

    removeIfExists(followthroughPath);
    removeIfExists(approvedPath);
    removeIfExists(batchPath);
    writeOwnerFollowthrough(followthroughPath);

    expect(
      run("scripts/prepare-admin-approved-beta-expansion-readiness-batch.mjs", {
        OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: postProofPath,
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: followthroughPath,
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH:
          approvedPath,
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_GYM_LABEL:
          "North Loop Strength",
      }).status,
    ).toBe(0);

    let result = run(
      "scripts/prepare-admin-request-intake-invite-auth-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH:
          approvedPath,
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
          batchPath,
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_GYM_LABEL: "Acme Fitness",
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("non-House-of-Fitness");

    result = run(
      "scripts/prepare-admin-request-intake-invite-auth-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH:
          approvedPath,
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
          batchPath,
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_GYM_LABEL:
          "North Loop Strength",
      },
    );
    expect(result.status, result.stderr).toBe(0);

    const batch = JSON.parse(readFileSync(batchPath, "utf8"));
    writeJsonArtifact(batchPath, {
      ...batch,
      approved_beta_expansion_readiness_batch_sha256: "0".repeat(64),
    });
    result = run(
      "scripts/inspect-admin-request-intake-invite-auth-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Approved beta expansion readiness batch SHA256 does not match",
    );

    expect(packageJson).toContain("admin:request-intake-invite-auth:batch");
    expect(packageJson).toContain("admin:request-intake-invite-auth:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminRequestIntakeInviteAuthReadinessBatch",
    );
    expect(founderAdminComponent).toContain("Request batch");

    const packet = founderAdminRequestIntakeInviteAuthReadinessBatch({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-29T12:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(packet.title).toBe("Request intake invite/Auth readiness batch");
    expect(packet.commands[0].command).toContain(
      "admin:request-intake-invite-auth:batch",
    );
    expect(packet.nextReadinessBatches.map((slice) => slice.id)).toEqual([
      "owner_access_fulfillment_evidence",
      "operator_assisted_onboarding_rehearsal",
      "public_self_serve_preflight",
      "live_provider_revenue_gates",
    ]);
  }, 120000);
});

describe("admin owner/staff handoff readiness batch", () => {
  function writeRequestIntakeInviteAuthParent(label) {
    const postProofPath = writePostCustomerProofChain(`${label}-post`);
    const followthroughPath = artifactPath(`${label}-followthrough.json`);
    const approvedPath = artifactPath(`${label}-approved-expansion.json`);
    const requestBatchPath = artifactPath(`${label}-request-intake-auth.json`);

    for (const path of [followthroughPath, approvedPath, requestBatchPath]) {
      removeIfExists(path);
    }
    writeOwnerFollowthrough(followthroughPath);

    expect(
      run("scripts/prepare-admin-approved-beta-expansion-readiness-batch.mjs", {
        OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: postProofPath,
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: followthroughPath,
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH:
          approvedPath,
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_GYM_LABEL:
          "North Loop Strength",
      }).status,
    ).toBe(0);

    expect(
      run("scripts/prepare-admin-request-intake-invite-auth-readiness-batch.mjs", {
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH:
          approvedPath,
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
          requestBatchPath,
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_GYM_LABEL:
          "North Loop Strength",
      }).status,
    ).toBe(0);

    return requestBatchPath;
  }

  it("packages owner access staff no-send and approved-gym rehearsal readiness", () => {
    const requestBatchPath = writeRequestIntakeInviteAuthParent("handoff");
    const handoffBatchPath = artifactPath("handoff-owner-staff.json");
    removeIfExists(handoffBatchPath);

    const prepare = run(
      "scripts/prepare-admin-owner-staff-handoff-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
          requestBatchPath,
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          handoffBatchPath,
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_GYM_LABEL: "North Loop Strength",
      },
    );
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(prepare.stdout).toContain(
      "Admin owner/staff handoff readiness batch written",
    );

    const inspect = run(
      "scripts/inspect-admin-owner-staff-handoff-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          handoffBatchPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin owner/staff handoff readiness batch OK",
    );

    const artifact = JSON.parse(readFileSync(handoffBatchPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_owner_staff_handoff_readiness_batch",
      evidence_basis: "admin_request_intake_invite_auth_readiness_batch",
      owner_access_fulfillment_mode: "operator_managed_evidence_required",
      staff_handoff_mode: "reviewed_roster_no_invite_send",
      approved_gym_rehearsal_mode: "hosted_browser_rehearsal_pending",
      owner_access_fulfillment_evidence_required: true,
      owner_access_fulfillment_evidence_recorded: false,
      staff_invite_no_send_preflight_required: true,
      staff_invite_no_send_preflight_recorded: false,
      approved_gym_hosted_rehearsal_required: true,
      approved_gym_hosted_rehearsal_recorded: false,
      customer_observed_handoff_recorded: false,
      public_self_serve_launch_allowed: false,
      browser_approval_buttons_allowed: false,
      auth_user_created: false,
      staff_invite_delivery_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      product_auth_admin_api_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(artifact.current_batch_set).toContain(
      "Staff handoff no-send preflight path prepared",
    );
    expect(artifact.next_readiness_batches.map((slice) => slice.id)).toEqual([
      "operator_assisted_onboarding_rehearsal",
      "customer_observed_handoff_gate",
      "public_self_serve_preflight",
      "live_provider_revenue_gates",
    ]);
  }, 120000);

  it("fails closed on unsafe labels parent SHA tamper and exposes Admin guidance", () => {
    const requestBatchPath = writeRequestIntakeInviteAuthParent("handoff-fail");
    const handoffBatchPath = artifactPath("handoff-fail-owner-staff.json");
    removeIfExists(handoffBatchPath);

    let result = run(
      "scripts/prepare-admin-owner-staff-handoff-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
          requestBatchPath,
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          handoffBatchPath,
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_GYM_LABEL: "Acme Fitness",
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("non-House-of-Fitness");

    result = run("scripts/prepare-admin-owner-staff-handoff-readiness-batch.mjs", {
      OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
        requestBatchPath,
      OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
        handoffBatchPath,
      OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_GYM_LABEL: "North Loop Strength",
    });
    expect(result.status, result.stderr).toBe(0);

    const batch = JSON.parse(readFileSync(handoffBatchPath, "utf8"));
    writeJsonArtifact(handoffBatchPath, {
      ...batch,
      request_intake_invite_auth_readiness_batch_sha256: "0".repeat(64),
    });
    result = run(
      "scripts/inspect-admin-owner-staff-handoff-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          handoffBatchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Request-intake invite/Auth readiness batch SHA256 does not match",
    );

    expect(packageJson).toContain("admin:owner-staff-handoff:batch");
    expect(packageJson).toContain("admin:owner-staff-handoff:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminOwnerStaffHandoffReadinessBatch",
    );
    expect(founderAdminComponent).toContain("Handoff batch");

    const packet = founderAdminOwnerStaffHandoffReadinessBatch({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-29T12:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(packet.title).toBe("Owner/staff handoff readiness batch");
    expect(packet.commands[0].command).toContain(
      "admin:owner-staff-handoff:batch",
    );
    expect(packet.nextReadinessBatches.map((slice) => slice.id)).toEqual([
      "operator_assisted_onboarding_rehearsal",
      "customer_observed_handoff_gate",
      "public_self_serve_preflight",
      "live_provider_revenue_gates",
    ]);
  }, 120000);
});

describe("admin approved-gym hosted rehearsal readiness batch", () => {
  function writeOwnerStaffHandoffParent(label) {
    const postProofPath = writePostCustomerProofChain(`${label}-post`);
    const followthroughPath = artifactPath(`${label}-followthrough.json`);
    const approvedPath = artifactPath(`${label}-approved-expansion.json`);
    const requestBatchPath = artifactPath(`${label}-request-intake-auth.json`);
    const handoffBatchPath = artifactPath(`${label}-owner-staff.json`);

    for (const path of [
      followthroughPath,
      approvedPath,
      requestBatchPath,
      handoffBatchPath,
    ]) {
      removeIfExists(path);
    }
    writeOwnerFollowthrough(followthroughPath);

    expect(
      run("scripts/prepare-admin-approved-beta-expansion-readiness-batch.mjs", {
        OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH: postProofPath,
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: followthroughPath,
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH:
          approvedPath,
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_GYM_LABEL:
          "North Loop Strength",
      }).status,
    ).toBe(0);
    expect(
      run("scripts/prepare-admin-request-intake-invite-auth-readiness-batch.mjs", {
        OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH:
          approvedPath,
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
          requestBatchPath,
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_GYM_LABEL:
          "North Loop Strength",
      }).status,
    ).toBe(0);
    expect(
      run("scripts/prepare-admin-owner-staff-handoff-readiness-batch.mjs", {
        OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
          requestBatchPath,
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          handoffBatchPath,
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_GYM_LABEL: "North Loop Strength",
      }).status,
    ).toBe(0);

    return handoffBatchPath;
  }

  it("packages hosted rehearsal command path without recording proof", () => {
    const handoffBatchPath = writeOwnerStaffHandoffParent("hosted-rehearsal");
    const rehearsalBatchPath = artifactPath("hosted-rehearsal.json");
    removeIfExists(rehearsalBatchPath);

    const prepare = run(
      "scripts/prepare-admin-approved-gym-hosted-rehearsal-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          handoffBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          rehearsalBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_LABEL:
          "North Loop Strength",
      },
    );
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(prepare.stdout).toContain(
      "Admin approved-gym hosted rehearsal readiness batch written",
    );

    const inspect = run(
      "scripts/inspect-admin-approved-gym-hosted-rehearsal-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          rehearsalBatchPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin approved-gym hosted rehearsal readiness batch OK",
    );

    const artifact = JSON.parse(readFileSync(rehearsalBatchPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_approved_gym_hosted_rehearsal_readiness_batch",
      evidence_basis: "admin_owner_staff_handoff_readiness_batch",
      hosted_rehearsal_mode: "approved_gym_browser_rehearsal_required",
      owner_workspace_rehearsal_required: true,
      staff_workboard_rehearsal_required: true,
      reset_rollback_checklist_required: true,
      no_unexpected_data_claim_required: true,
      no_live_provider_claim_required: true,
      approved_gym_hosted_rehearsal_recorded: false,
      customer_observed_handoff_recorded: false,
      first_gym_go_no_go_bundle_ready: false,
      public_self_serve_launch_allowed: false,
      browser_approval_buttons_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      product_auth_admin_api_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(artifact.next_readiness_batches.map((slice) => slice.id)).toEqual([
      "operator_assisted_onboarding_rehearsal",
      "customer_observed_handoff_gate",
      "first_gym_go_no_go_bundle",
      "live_provider_revenue_gates",
    ]);
  }, 120000);

  it("fails closed on unsafe labels parent SHA tamper and exposes Admin guidance", () => {
    const handoffBatchPath = writeOwnerStaffHandoffParent("hosted-rehearsal-fail");
    const rehearsalBatchPath = artifactPath("hosted-rehearsal-fail.json");
    removeIfExists(rehearsalBatchPath);

    let result = run(
      "scripts/prepare-admin-approved-gym-hosted-rehearsal-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          handoffBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          rehearsalBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_LABEL: "Acme Fitness",
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("non-House-of-Fitness");

    result = run(
      "scripts/prepare-admin-approved-gym-hosted-rehearsal-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          handoffBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          rehearsalBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_LABEL:
          "North Loop Strength",
      },
    );
    expect(result.status, result.stderr).toBe(0);

    const batch = JSON.parse(readFileSync(rehearsalBatchPath, "utf8"));
    writeJsonArtifact(rehearsalBatchPath, {
      ...batch,
      owner_staff_handoff_readiness_batch_sha256: "0".repeat(64),
    });
    result = run(
      "scripts/inspect-admin-approved-gym-hosted-rehearsal-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          rehearsalBatchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Owner/staff handoff readiness batch SHA256 does not match",
    );

    expect(packageJson).toContain("admin:approved-gym-hosted-rehearsal:batch");
    expect(packageJson).toContain("admin:approved-gym-hosted-rehearsal:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminApprovedGymHostedRehearsalReadinessBatch",
    );
    expect(founderAdminComponent).toContain("Rehearsal batch");

    const packet = founderAdminApprovedGymHostedRehearsalReadinessBatch({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-29T12:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(packet.title).toBe("Approved-gym hosted rehearsal readiness batch");
    expect(packet.commands[0].command).toContain(
      "admin:approved-gym-hosted-rehearsal:batch",
    );
    expect(packet.nextReadinessBatches.map((slice) => slice.id)).toEqual([
      "operator_assisted_onboarding_rehearsal",
      "customer_observed_handoff_gate",
      "first_gym_go_no_go_bundle",
      "live_provider_revenue_gates",
    ]);
  }, 120000);

  it("records hosted rehearsal evidence and bundles first-gym go/no-go only after customer session proof", () => {
    const handoffBatchPath = writeOwnerStaffHandoffParent("first-gym");
    const rehearsalBatchPath = artifactPath("first-gym-rehearsal-readiness.json");
    const rehearsalEvidencePath = artifactPath("first-gym-rehearsal-evidence.json");
    const walkthroughPath = artifactPath("first-gym-walkthrough.json");
    const schedulingPath = artifactPath("first-gym-scheduling.json");
    const customerSessionPath = artifactPath("first-gym-customer-session.json");
    const goNoGoPath = artifactPath("first-gym-go-no-go.json");
    for (const path of [
      rehearsalBatchPath,
      rehearsalEvidencePath,
      walkthroughPath,
      schedulingPath,
      customerSessionPath,
      goNoGoPath,
    ]) {
      removeIfExists(path);
    }

    expect(
      run("scripts/prepare-admin-approved-gym-hosted-rehearsal-readiness-batch.mjs", {
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          handoffBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          rehearsalBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_LABEL:
          "North Loop Strength",
      }).status,
    ).toBe(0);

    const evidence = run(
      "scripts/record-admin-approved-gym-hosted-rehearsal-evidence.mjs",
      {
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          rehearsalBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH:
          rehearsalEvidencePath,
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_OWNER_WORKSPACE_OBSERVED: "yes",
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_STAFF_WORKBOARD_OBSERVED: "yes",
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_RESET_ROLLBACK_REVIEWED: "yes",
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED:
          "yes",
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_INVITE_DELIVERY_NOT_OBSERVED:
          "yes",
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED:
          "yes",
      },
    );
    expect(evidence.status, evidence.stderr).toBe(0);
    expect(evidence.stdout).toContain(
      "Admin approved-gym hosted rehearsal evidence recorded",
    );
    expect(
      run("scripts/inspect-admin-approved-gym-hosted-rehearsal-evidence.mjs", {
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH:
          rehearsalEvidencePath,
      }).status,
    ).toBe(0);

    const readiness = JSON.parse(readFileSync(rehearsalBatchPath, "utf8"));
    writeJsonArtifact(
      walkthroughPath,
      validProtectedPreviewWalkthrough({
        protected_preview_url: readiness.protected_preview_url,
        hosted_neon_branch: readiness.hosted_neon_branch,
        reviewed_owner_email: "owner@northloop.example",
      }),
    );
    writeJsonArtifact(
      schedulingPath,
      validSchedulingBatch(walkthroughPath, {
        artifact_kind: "admin_customer_handoff_scheduling_batch",
        status: "admin_customer_handoff_scheduling_batch_prepared",
        evidence_basis: "admin_protected_preview_walkthrough",
        protected_preview_walkthrough_path: walkthroughPath,
        protected_preview_walkthrough_sha256: sha256File(walkthroughPath),
        protected_preview_url: readiness.protected_preview_url,
        hosted_neon_branch: readiness.hosted_neon_branch,
        gym_name: "North Loop Strength",
        owner_email: "owner@northloop.example",
      }),
    );
    const session = run("scripts/record-admin-customer-observed-session.mjs", {
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: schedulingPath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: customerSessionPath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT: "yes",
      OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED: "yes",
      OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_WORKSPACE_OBSERVED: "yes",
      OUTPOST_ADMIN_CUSTOMER_SESSION_STAFF_HANDOFF_OBSERVED: "yes",
      OUTPOST_ADMIN_CUSTOMER_SESSION_RESET_ROLLBACK_REVIEWED: "yes",
      OUTPOST_ADMIN_CUSTOMER_SESSION_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_CUSTOMER_SESSION_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_CUSTOMER_SESSION_INVITE_DELIVERY_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED:
        "yes",
      OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_LABEL: "North Loop Owner",
      OUTPOST_ADMIN_CUSTOMER_SESSION_OPERATOR: "Krish",
    });
    expect(session.status, session.stderr).toBe(0);

    const bundle = run("scripts/prepare-admin-first-gym-go-no-go-bundle.mjs", {
      OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH:
        rehearsalEvidencePath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: customerSessionPath,
      OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH: goNoGoPath,
    });
    expect(bundle.status, bundle.stderr).toBe(0);
    expect(bundle.stdout).toContain("Admin first-gym go/no-go bundle prepared");
    const inspect = run("scripts/inspect-admin-first-gym-go-no-go-bundle.mjs", {
      OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH: goNoGoPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin first-gym go/no-go bundle inspection passed",
    );

    const artifact = JSON.parse(readFileSync(goNoGoPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_first_gym_go_no_go_bundle",
      approved_gym_hosted_rehearsal_recorded: true,
      customer_observed_session_recorded: true,
      customer_observed_handoff_claimed: true,
      first_gym_go_no_go_bundle_ready: true,
      ready_for_first_gym_operator_assisted_run: true,
      public_self_serve_launch_allowed: false,
      browser_approval_buttons_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      product_auth_admin_api_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(artifact.next_readiness_batches.map((slice) => slice.id)).toEqual([
      "first_gym_operator_assisted_run",
      "limited_operator_assisted_beta_onboarding",
      "public_self_serve_preflight",
    ]);
  }, 120000);

  it("fails closed when hosted rehearsal evidence is tampered and exposes Admin first-gym guidance", () => {
    const handoffBatchPath = writeOwnerStaffHandoffParent("first-gym-fail");
    const rehearsalBatchPath = artifactPath("first-gym-fail-rehearsal-readiness.json");
    const rehearsalEvidencePath = artifactPath("first-gym-fail-rehearsal-evidence.json");
    removeIfExists(rehearsalBatchPath);
    removeIfExists(rehearsalEvidencePath);

    expect(
      run("scripts/prepare-admin-approved-gym-hosted-rehearsal-readiness-batch.mjs", {
        OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          handoffBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          rehearsalBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_LABEL:
          "North Loop Strength",
      }).status,
    ).toBe(0);
    let result = run(
      "scripts/record-admin-approved-gym-hosted-rehearsal-evidence.mjs",
      {
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          rehearsalBatchPath,
        OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH:
          rehearsalEvidencePath,
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_OWNER_WORKSPACE_OBSERVED: "yes",
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_STAFF_WORKBOARD_OBSERVED: "yes",
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_RESET_ROLLBACK_REVIEWED: "yes",
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED:
          "yes",
        OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_INVITE_DELIVERY_NOT_OBSERVED:
          "yes",
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED=yes is required",
    );

    result = run("scripts/record-admin-approved-gym-hosted-rehearsal-evidence.mjs", {
      OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
        rehearsalBatchPath,
      OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH:
        rehearsalEvidencePath,
      OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_OWNER_WORKSPACE_OBSERVED: "yes",
      OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_STAFF_WORKBOARD_OBSERVED: "yes",
      OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_RESET_ROLLBACK_REVIEWED: "yes",
      OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED:
        "yes",
      OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_INVITE_DELIVERY_NOT_OBSERVED:
        "yes",
      OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED:
        "yes",
    });
    expect(result.status, result.stderr).toBe(0);

    const evidence = JSON.parse(readFileSync(rehearsalEvidencePath, "utf8"));
    writeJsonArtifact(rehearsalEvidencePath, {
      ...evidence,
      approved_gym_hosted_rehearsal_readiness_batch_sha256: "0".repeat(64),
    });
    result = run("scripts/inspect-admin-approved-gym-hosted-rehearsal-evidence.mjs", {
      OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH:
        rehearsalEvidencePath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Approved-gym hosted rehearsal readiness batch SHA256 does not match",
    );

    expect(packageJson).toContain(
      "admin:approved-gym-hosted-rehearsal:evidence",
    );
    expect(packageJson).toContain("admin:first-gym:go-no-go");
    expect(founderAdminComponent).toContain(
      "founderAdminApprovedGymHostedRehearsalEvidence",
    );
    expect(founderAdminComponent).toContain("founderAdminFirstGymGoNoGoBundle");
    expect(founderAdminComponent).toContain("Go/no-go");

    const proofLedger = {
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-29T12:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    };
    const evidencePacket = founderAdminApprovedGymHostedRehearsalEvidence(
      proofLedger,
    );
    expect(evidencePacket.title).toBe("Approved-gym hosted rehearsal evidence");
    expect(evidencePacket.commands[0].command).toContain(
      "admin:approved-gym-hosted-rehearsal:evidence",
    );
    const goNoGoPacket = founderAdminFirstGymGoNoGoBundle(proofLedger);
    expect(goNoGoPacket.title).toBe("First-gym go/no-go bundle");
    expect(goNoGoPacket.commands[0].command).toContain(
      "admin:first-gym:go-no-go",
    );
    expect(goNoGoPacket.nextReadinessBatches.map((slice) => slice.id)).toEqual([
      "first_gym_operator_assisted_run",
      "limited_operator_assisted_beta_onboarding",
      "public_self_serve_preflight",
    ]);
  }, 120000);

  it("records first-gym run and prepares limited beta plus public self-serve preflight with gates blocked", () => {
    const { goNoGoPath } = writeFirstGymGoNoGoFixture("first-gym-runway");
    const runPath = artifactPath("first-gym-runway-run-record.json");
    const reviewPath = artifactPath("first-gym-runway-limited-beta-review.json");
    const preflightPath = artifactPath("first-gym-runway-public-launch-preflight.json");
    removeIfExists(runPath);
    removeIfExists(reviewPath);
    removeIfExists(preflightPath);

    let result = run("scripts/record-admin-first-gym-operator-run.mjs", {
      OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH: goNoGoPath,
      OUTPOST_ADMIN_FIRST_GYM_OPERATOR_RUN_RECORD_PATH: runPath,
      OUTPOST_ADMIN_FIRST_GYM_OPERATOR: "Krish",
      OUTPOST_ADMIN_FIRST_GYM_OWNER_WORKSPACE_COMPLETED: "yes",
      OUTPOST_ADMIN_FIRST_GYM_STAFF_WORKBOARD_COMPLETED: "yes",
      OUTPOST_ADMIN_FIRST_GYM_SOURCE_TO_ANSWER_TO_TASK_COMPLETED: "yes",
      OUTPOST_ADMIN_FIRST_GYM_RESET_ROLLBACK_EXERCISED: "yes",
      OUTPOST_ADMIN_FIRST_GYM_SUPPORT_HANDOFF_REVIEWED: "yes",
      OUTPOST_ADMIN_FIRST_GYM_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_FIRST_GYM_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_FIRST_GYM_INVITE_DELIVERY_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_FIRST_GYM_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED: "yes",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin first-gym operator-assisted run recorded",
    );
    result = run("scripts/inspect-admin-first-gym-operator-run.mjs", {
      OUTPOST_ADMIN_FIRST_GYM_OPERATOR_RUN_RECORD_PATH: runPath,
    });
    expect(result.status, result.stderr).toBe(0);

    result = run("scripts/prepare-admin-limited-beta-operator-review-packet.mjs", {
      OUTPOST_ADMIN_FIRST_GYM_OPERATOR_RUN_RECORD_PATH: runPath,
      OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH: reviewPath,
      OUTPOST_ADMIN_LIMITED_BETA_REVIEWED_FIRST_GYM_RUN: "yes",
      OUTPOST_ADMIN_LIMITED_BETA_OPERATOR: "Krish",
      OUTPOST_ADMIN_LIMITED_BETA_CANDIDATE_GYM: "Second Gym",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin limited beta operator review packet prepared",
    );
    result = run("scripts/inspect-admin-limited-beta-operator-review-packet.mjs", {
      OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH: reviewPath,
    });
    expect(result.status, result.stderr).toBe(0);

    result = run("scripts/prepare-admin-public-self-serve-launch-preflight.mjs", {
      OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH: reviewPath,
      OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH: preflightPath,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public self-serve launch preflight prepared",
    );
    result = run("scripts/inspect-admin-public-self-serve-launch-preflight.mjs", {
      OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH: preflightPath,
    });
    expect(result.status, result.stderr).toBe(0);

    const runRecord = JSON.parse(readFileSync(runPath, "utf8"));
    const review = JSON.parse(readFileSync(reviewPath, "utf8"));
    const preflight = JSON.parse(readFileSync(preflightPath, "utf8"));
    expect(runRecord).toMatchObject({
      artifact_kind: "admin_first_gym_operator_run_record",
      first_gym_operator_assisted_run_recorded: true,
      first_gym_operator_assisted_run_successful: true,
      ready_for_limited_beta_review: true,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(review).toMatchObject({
      artifact_kind: "admin_limited_beta_operator_review_packet",
      first_gym_run_reviewed: true,
      limited_beta_operator_review_ready: true,
      owner_access_mode: "operator_managed",
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(preflight).toMatchObject({
      artifact_kind: "admin_public_self_serve_launch_preflight",
      public_self_serve_launch_preflight_ready: true,
      public_self_serve_launch_allowed: false,
      browser_approval_buttons_allowed: false,
      invite_delivery_allowed: false,
      product_auth_admin_api_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });

    const tamperedReview = {
      ...review,
      first_gym_operator_run_record_sha256: "0".repeat(64),
    };
    writeJsonArtifact(reviewPath, tamperedReview);
    result = run("scripts/inspect-admin-limited-beta-operator-review-packet.mjs", {
      OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH: reviewPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "first-gym operator run record SHA256 does not match",
    );

    expect(packageJson).toContain("admin:first-gym:run");
    expect(packageJson).toContain("admin:limited-beta:operator-review");
    expect(packageJson).toContain("admin:public-self-serve:launch-preflight");
    expect(founderAdminComponent).toContain(
      "founderAdminFirstGymOperatorRunRecord",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminLimitedBetaOperatorReviewPacket",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicSelfServeLaunchPreflight",
    );

    const proofLedger = {
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-30T12:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    };
    expect(
      founderAdminFirstGymOperatorRunRecord(proofLedger).commands[0].command,
    ).toContain("admin:first-gym:run");
    expect(
      founderAdminLimitedBetaOperatorReviewPacket(proofLedger).commands[0]
        .command,
    ).toContain("admin:limited-beta:operator-review");
    expect(
      founderAdminPublicSelfServeLaunchPreflight(proofLedger).commands[0]
        .command,
    ).toContain("admin:public-self-serve:launch-preflight");
  }, 120000);

  it("prepares public launch controls with request-only no-send and live-provider gates blocked", () => {
    const { preflightPath } = writePublicLaunchPreflightFixture(
      "public-launch-controls",
    );
    const batchPath = artifactPath("public-launch-controls-batch.json");
    removeIfExists(batchPath);

    let result = run("scripts/prepare-admin-public-launch-controls-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH: preflightPath,
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: batchPath,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Admin public launch controls batch prepared");

    result = run("scripts/inspect-admin-public-launch-controls-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: batchPath,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public launch controls batch inspection passed",
    );

    const artifact = JSON.parse(readFileSync(batchPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_public_launch_controls_batch",
      evidence_basis: "admin_public_self_serve_launch_preflight",
      owner_access_mode: "operator_managed_until_launch_gate_green",
      public_launch_controls_batch_ready: true,
      public_request_intake: {
        mode: "request_only_human_reviewed",
        request_form_allowed: false,
        browser_approval_buttons_allowed: false,
        automatic_approval_allowed: false,
        automatic_owner_staff_grants_allowed: false,
      },
      invite_auth_no_send: {
        mode: "no_send_no_create_dry_run",
        invite_delivery_allowed: false,
        staff_invite_delivery_allowed: false,
        outbound_email_allowed: false,
        notification_sending_allowed: false,
        product_auth_admin_api_allowed: false,
        auth_user_created: false,
      },
      live_provider_revenue_member_systems: {
        mode: "separate_blocked_proof_tracks",
        gmail_resend_smtp_provider_allowed: false,
        live_provider_enablement_allowed: false,
        billing_pos_member_writes_allowed: false,
        access_control_writes_allowed: false,
        member_ledger_writes_allowed: false,
      },
      public_self_serve_launch_allowed: false,
      public_request_form_allowed: false,
      browser_approval_buttons_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      product_auth_admin_api_allowed: false,
      auth_user_created: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      access_control_writes_allowed: false,
      member_ledger_writes_allowed: false,
    });
    expect(artifact.next_readiness_batches.map((slice) => slice.id)).toEqual([
      "public_request_intake_dry_run",
      "invite_auth_dry_run_gates",
      "live_provider_revenue_gates",
    ]);

    writeJsonArtifact(batchPath, {
      ...artifact,
      live_provider_enablement_allowed: true,
    });
    result = run("scripts/inspect-admin-public-launch-controls-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: batchPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Live providers blocked");

    writeJsonArtifact(batchPath, {
      ...artifact,
      public_self_serve_launch_preflight_sha256: "0".repeat(64),
    });
    result = run("scripts/inspect-admin-public-launch-controls-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: batchPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "public self-serve launch preflight SHA256 does not match",
    );

    const preflight = JSON.parse(readFileSync(preflightPath, "utf8"));
    writeJsonArtifact(preflightPath, {
      ...preflight,
      public_request_form_allowed: true,
    });
    removeIfExists(batchPath);
    result = run("scripts/prepare-admin-public-launch-controls-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH: preflightPath,
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: batchPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Public request form must remain blocked");

    expect(packageJson).toContain("admin:public-launch-controls:batch");
    expect(packageJson).toContain("admin:public-launch-controls:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminPublicLaunchControlsBatch",
    );
    expect(founderAdminComponent).toContain("Public launch controls batch");

    const proofLedger = {
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-30T12:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    };
    const packet = founderAdminPublicLaunchControlsBatch(proofLedger);
    expect(packet.title).toBe("Public launch controls batch");
    expect(packet.commands[0].command).toContain(
      "admin:public-launch-controls:batch",
    );
    expect(packet.commands[1].command).toContain(
      "admin:public-launch-controls:inspect",
    );
    expect(packet.nextReadinessBatches.map((slice) => slice.id)).toEqual([
      "public_request_intake_dry_run",
      "invite_auth_dry_run_gates",
      "live_provider_revenue_gates",
    ]);
  }, 120000);
});
