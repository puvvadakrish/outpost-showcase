import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { founderAdminPublicRequestFirstGymGoNoGoReadinessBatch } from "../src/domain/founder-admin-readiness";

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
  const dir = "artifacts/admin-public-request-first-gym-tests";
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

function writeHostedRehearsalReadiness(prefix, overrides = {}) {
  const ownerStaffPath = artifactPath(`${prefix}-owner-staff.json`);
  const hostedPath = artifactPath(`${prefix}-hosted-rehearsal.json`);
  removeIfExists(ownerStaffPath);
  removeIfExists(hostedPath);

  writeJsonArtifact(ownerStaffPath, {
    artifact_kind: "admin_public_request_owner_staff_handoff_readiness_batch",
    candidate_gym_label: "Second Gym",
  });
  writeJsonArtifact(hostedPath, {
    artifact_kind: "admin_public_request_hosted_rehearsal_readiness_batch",
    status: "admin_public_request_hosted_rehearsal_readiness_batch_prepared",
    generated_at: "2026-06-30T18:00:00.000Z",
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
    ...overrides,
  });

  return hostedPath;
}

describe("admin public request first-gym go/no-go readiness", () => {
  it("prepares and inspects the current-chain first-gym go/no-go bridge", () => {
    const hostedPath = writeHostedRehearsalReadiness("first-gym-happy");
    const batchPath = artifactPath("first-gym-happy-batch.json");
    removeIfExists(batchPath);

    let result = run(
      "scripts/prepare-admin-public-request-first-gym-go-no-go-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          hostedPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym go/no-go readiness batch prepared",
    );

    result = run(
      "scripts/inspect-admin-public-request-first-gym-go-no-go-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym go/no-go readiness batch inspection passed",
    );

    const artifact = JSON.parse(readFileSync(batchPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind:
        "admin_public_request_first_gym_go_no_go_readiness_batch",
      evidence_basis: "admin_public_request_hosted_rehearsal_readiness_batch",
      public_request_first_gym_go_no_go_readiness_batch_ready: true,
      first_gym_go_no_go_readiness: {
        mode: "requires_hosted_rehearsal_evidence_and_customer_observed_session",
        hosted_rehearsal_evidence_required: true,
        customer_observed_session_required: true,
        approved_gym_hosted_rehearsal_recorded: false,
        customer_observed_handoff_recorded: false,
        customer_observed_session_recorded: false,
        first_gym_go_no_go_bundle_ready: false,
        ready_for_first_gym_operator_assisted_run: false,
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
      first_gym_go_no_go_readiness: {
        ...artifact.first_gym_go_no_go_readiness,
        first_gym_go_no_go_bundle_ready: true,
      },
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-go-no-go-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("first_gym_go_no_go_bundle_ready blocked");

    writeJsonArtifact(batchPath, {
      ...artifact,
      public_request_hosted_rehearsal_readiness_batch_sha256: "0".repeat(64),
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-go-no-go-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "public request hosted rehearsal readiness batch SHA256 does not match",
    );
  }, 120000);

  it("fails closed on unsafe parent and exposes Admin portal guidance", () => {
    const hostedPath = writeHostedRehearsalReadiness("first-gym-fail", {
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
        approved_gym_hosted_rehearsal_recorded: true,
        first_gym_go_no_go_bundle_ready: false,
        public_launch_decision_allowed: false,
      },
    });
    const batchPath = artifactPath("first-gym-fail-batch.json");
    removeIfExists(batchPath);

    const result = run(
      "scripts/prepare-admin-public-request-first-gym-go-no-go-readiness-batch.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          hostedPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
          batchPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Public request hosted rehearsal readiness inspection failed",
    );

    expect(packageJson).toContain("admin:public-request-first-gym:go-no-go:batch");
    expect(packageJson).toContain("admin:public-request-first-gym:go-no-go:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymGoNoGoReadinessBatch",
    );
    expect(founderAdminComponent).toContain(
      "Public request first gym go no go readiness",
    );

    const packet = founderAdminPublicRequestFirstGymGoNoGoReadinessBatch({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-30T18:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(packet.title).toBe("Public request first-gym go/no-go readiness");
    expect(packet.commands[0].command).toContain(
      "admin:public-request-first-gym:go-no-go:batch",
    );
    expect(packet.commands[1].command).toContain(
      "admin:public-request-first-gym:go-no-go:inspect",
    );
  }, 120000);
});
