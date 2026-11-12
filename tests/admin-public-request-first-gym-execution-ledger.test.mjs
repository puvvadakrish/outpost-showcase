import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { founderAdminPublicRequestFirstGymExecutionLedger } from "../src/domain/founder-admin-readiness";

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
  const dir = "artifacts/admin-public-request-first-gym-execution-ledger-tests";
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

function writeEvidenceAcquisition(prefix) {
  const readinessPath = writeGoNoGoReadiness(prefix);
  const evidencePath = artifactPath(`${prefix}-evidence-acquisition.json`);
  removeIfExists(evidencePath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-evidence-acquisition-batch.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
        readinessPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
        evidencePath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return evidencePath;
}

function writeProofRunway(prefix) {
  const evidencePath = writeEvidenceAcquisition(prefix);
  const runwayPath = artifactPath(
    `${prefix}-public-request-first-gym-proof-runway-batch.json`,
  );
  removeIfExists(runwayPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-runway-batch.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
        evidencePath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH:
        runwayPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return runwayPath;
}

describe("admin public request first-gym execution ledger", () => {
  it("prepares and inspects a status-only ledger from the proof runway", () => {
    const runwayPath = writeProofRunway("ledger-happy");
    const ledgerPath = artifactPath("ledger-happy-execution-ledger.json");
    removeIfExists(ledgerPath);

    let result = run(
      "scripts/prepare-admin-public-request-first-gym-execution-ledger.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH:
          runwayPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH:
          ledgerPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym execution ledger prepared",
    );
    expect(result.stdout).toContain("Missing artifacts: 7");

    result = run(
      "scripts/inspect-admin-public-request-first-gym-execution-ledger.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH:
          ledgerPath,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request first-gym execution ledger inspection passed",
    );

    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    expect(ledger).toMatchObject({
      artifact_kind: "admin_public_request_first_gym_execution_ledger",
      evidence_basis: "admin_public_request_first_gym_proof_runway_batch",
      execution_ledger: {
        mode: "status_only_reinspect_existing_artifacts",
        inspectable_count: 0,
        missing_count: 7,
        all_required_artifacts_inspectable: false,
        ready_for_public_self_serve_launch: false,
        public_launch_decision_allowed: false,
      },
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(ledger.steps.map((step) => step.id)).toEqual([
      "hosted_rehearsal_evidence",
      "customer_observed_session",
      "first_gym_go_no_go_bundle",
      "first_gym_operator_run",
      "limited_beta_operator_review",
      "public_request_self_serve_preflight",
      "public_launch_controls",
    ]);
    expect(ledger.steps[0].artifact_path).toContain(
      "ledger-happy-public-request-hosted-rehearsal-evidence.json",
    );
    expect(ledger.steps.every((step) => step.state === "missing")).toBe(true);

    writeJsonArtifact(ledgerPath, {
      ...ledger,
      public_launch_decision_allowed: true,
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-execution-ledger.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH:
          ledgerPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("public_launch_decision_allowed blocked");

    writeJsonArtifact(ledgerPath, {
      ...ledger,
      steps: ledger.steps.map((step) =>
        step.id === "first_gym_operator_run"
          ? { ...step, artifact_sha256: "0".repeat(64), state: "inspectable" }
          : step,
      ),
    });
    result = run(
      "scripts/inspect-admin-public-request-first-gym-execution-ledger.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH:
          ledgerPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "first_gym_operator_run artifact path does not exist",
    );
  });

  it("wires scripts and Admin portal guidance without browser write paths", () => {
    expect(packageJson).toContain(
      "admin:public-request-first-gym:execution-ledger",
    );
    expect(packageJson).toContain(
      "admin:public-request-first-gym:execution-ledger:inspect",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymExecutionLedger",
    );
    expect(founderAdminComponent).toContain(
      "Public request first gym execution ledger",
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");

    const packet = founderAdminPublicRequestFirstGymExecutionLedger({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.vercel.app",
    });
    expect(packet.title).toBe("Public request first-gym execution ledger");
    expect(packet.commands.map((command) => command.command).join("\n")).toContain(
      "npm run admin:public-request-first-gym:execution-ledger",
    );
    expect(packet.summary).toContain("missing or inspectable");
    expect(packet.nextReadinessBatches.map((batch) => batch.state)).toEqual([
      "blocked",
      "blocked",
      "blocked",
    ]);
  });
});
