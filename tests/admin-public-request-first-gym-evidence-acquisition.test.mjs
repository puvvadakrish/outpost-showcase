import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { founderAdminPublicRequestFirstGymEvidenceAcquisitionBatch } from "../src/domain/founder-admin-readiness";

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
  const dir = "artifacts/admin-public-request-first-gym-evidence-tests";
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

function writeFirstGymGoNoGoReadiness(prefix, overrides = {}) {
  const hostedPath = artifactPath(`${prefix}-hosted.json`);
  const goNoGoPath = artifactPath(`${prefix}-go-no-go.json`);
  removeIfExists(hostedPath);
  removeIfExists(goNoGoPath);

  writeJsonArtifact(hostedPath, {
    artifact_kind: "admin_public_request_hosted_rehearsal_readiness_batch",
    candidate_gym_label: "Second Gym",
  });
  writeJsonArtifact(goNoGoPath, {
    artifact_kind: "admin_public_request_first_gym_go_no_go_readiness_batch",
    status: "admin_public_request_first_gym_go_no_go_readiness_batch_prepared",
    generated_at: "2026-06-30T19:00:00.000Z",
    evidence_basis: "admin_public_request_hosted_rehearsal_readiness_batch",
    public_request_hosted_rehearsal_readiness_batch_path: hostedPath,
    public_request_hosted_rehearsal_readiness_batch_sha256:
      sha256File(hostedPath),
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
    ...overrides,
  });

  return goNoGoPath;
}

describe("admin public request first-gym evidence acquisition", () => {
  it("prepares and inspects the current-chain evidence acquisition packet", () => {
    const parentPath = writeFirstGymGoNoGoReadiness("evidence-happy");
    const batchPath = artifactPath("evidence-happy-batch.json");
    removeIfExists(batchPath);

    let result = run(
      "scripts/prepare-admin-public-request-first-gym-evidence-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
          parentPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym evidence acquisition batch prepared",
    );

    result = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym evidence acquisition batch inspection passed",
    );

    const artifact = JSON.parse(readFileSync(batchPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_public_request_first_gym_evidence_acquisition_batch",
      evidence_basis: "admin_public_request_first_gym_go_no_go_readiness_batch",
      public_request_first_gym_evidence_acquisition_batch_ready: true,
      evidence_acquisition: {
        mode: "current_chain_command_packet_only",
        hosted_rehearsal_evidence_command_required: true,
        customer_observed_session_command_required: true,
        customer_session_hosted_import_required: true,
        first_gym_go_no_go_bundle_command_required: true,
        first_gym_operator_run_command_required_after_bundle: true,
        approved_gym_hosted_rehearsal_recorded: false,
        customer_observed_session_recorded: false,
        customer_session_hosted_import_recorded: false,
        first_gym_go_no_go_bundle_ready: false,
        first_gym_operator_run_recorded: false,
        ready_for_public_self_serve_launch: false,
      },
      public_request_form_submission_allowed: false,
      auth_user_created: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      public_launch_decision_allowed: false,
    });
    expect(artifact.command_sequence.map((slice) => slice.id)).toEqual([
      "approved_gym_hosted_rehearsal_evidence",
      "customer_observed_handoff_gate",
      "hosted_customer_session_proof",
      "first_gym_go_no_go_bundle",
      "first_gym_operator_assisted_run",
    ]);

    writeJsonArtifact(batchPath, {
      ...artifact,
      evidence_acquisition: {
        ...artifact.evidence_acquisition,
        first_gym_operator_run_recorded: true,
      },
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("first_gym_operator_run_recorded blocked");

    writeJsonArtifact(batchPath, {
      ...artifact,
      public_request_first_gym_go_no_go_readiness_batch_sha256: "0".repeat(64),
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "public request first-gym go/no-go readiness batch SHA256 does not match",
    );

    writeJsonArtifact(batchPath, {
      ...artifact,
      live_provider_enablement_allowed: true,
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-evidence-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("live_provider_enablement_allowed blocked");
  }, 120000);

  it("fails closed on unsafe parent and exposes Admin portal guidance", () => {
    const parentPath = writeFirstGymGoNoGoReadiness("evidence-fail", {
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
        first_gym_go_no_go_bundle_ready: true,
        ready_for_first_gym_operator_assisted_run: false,
        public_launch_decision_allowed: false,
      },
    });
    const batchPath = artifactPath("evidence-fail-batch.json");
    removeIfExists(batchPath);

    const result = run(
      "scripts/prepare-admin-public-request-first-gym-evidence-acquisition-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
          parentPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Public request first-gym go/no-go readiness inspection failed",
    );

    expect(packageJson).toContain(
      "admin:public-request-first-gym:evidence-acquisition",
    );
    expect(packageJson).toContain(
      "admin:public-request-first-gym:evidence-acquisition:inspect",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymEvidenceAcquisitionBatch",
    );
    expect(founderAdminComponent).toContain(
      "Public request first gym evidence acquisition",
    );

    const packet = founderAdminPublicRequestFirstGymEvidenceAcquisitionBatch({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-30T19:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(packet.title).toBe("Public request first-gym evidence acquisition");
    expect(packet.commands[0].command).toContain(
      "admin:public-request-first-gym:evidence-acquisition",
    );
    expect(packet.commands[1].command).toContain(
      "admin:public-request-first-gym:evidence-acquisition:inspect",
    );
  }, 120000);
});
