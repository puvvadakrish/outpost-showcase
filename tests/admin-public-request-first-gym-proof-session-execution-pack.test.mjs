import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { founderAdminPublicRequestFirstGymProofSessionExecutionPack } from "../src/domain/founder-admin-readiness";

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
    "artifacts/admin-public-request-first-gym-proof-session-execution-pack-tests";
  mkdirSync(dir, { recursive: true });
  return `${dir}/${name}`;
}

function removeIfExists(path) {
  rmSync(path, { force: true, recursive: true });
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
    ...blockedFlags(),
    next_readiness_batches: [
      { id: "first_gym_go_no_go_bundle" },
      { id: "public_self_serve_preflight" },
      { id: "live_provider_revenue_gates" },
    ],
  });
  return readinessPath;
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

function writeRunbook(prefix) {
  const ledgerPath = writeExecutionLedger(prefix);
  const packetPath = artifactPath(`${prefix}-missing-proof-packet.json`);
  const gatePath = artifactPath(`${prefix}-completion-gate.json`);
  const runbookPath = artifactPath(`${prefix}-proof-session-runbook.json`);
  removeIfExists(packetPath);
  removeIfExists(gatePath);
  removeIfExists(runbookPath);
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
  return runbookPath;
}

function writeExecutionPack(prefix) {
  const runbookPath = writeRunbook(prefix);
  const packPath = artifactPath(`${prefix}-proof-session-execution-pack.json`);
  removeIfExists(packPath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-session-execution-pack.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH:
        runbookPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH:
        packPath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { packPath, result, runbookPath };
}

describe("admin public request first-gym proof session execution pack", () => {
  it("prepares and inspects an operator preflight, worksheet, and evidence manifest from the runbook", () => {
    const { packPath, result } = writeExecutionPack("blocked");
    expect(result.stdout).toContain(
      "Admin public request first-gym proof session execution pack prepared",
    );
    expect(result.stdout).toContain("Worksheet steps: 7");

    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-execution-pack.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH:
          packPath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym proof session execution pack inspection passed",
    );

    const pack = readJsonArtifact(packPath);
    expect(pack.artifact_kind).toBe(
      "admin_public_request_first_gym_proof_session_execution_pack",
    );
    expect(pack.proof_session_execution_pack).toMatchObject({
      customer_observed_completion_recorded: false,
      expected_evidence_count: 7,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      mode: "operator_session_packet_only",
      public_launch_decision_allowed: false,
      worksheet_step_count: 7,
    });
    expect(pack.session_preflight.required_observations.length).toBeGreaterThanOrEqual(
      7,
    );
    expect(pack.customer_safe_worksheet.map((step) => step.id)).toEqual([
      "hosted_rehearsal_evidence",
      "customer_observed_session",
      "first_gym_go_no_go_bundle",
      "first_gym_operator_run",
      "limited_beta_operator_review",
      "public_request_self_serve_preflight",
      "public_launch_controls",
    ]);
    expect(
      pack.expected_evidence_manifest.every(
        (step) => step.recorded_by_execution_pack === false,
      ),
    ).toBe(true);
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(pack[key]).toBe(value);
    }
  });

  it("rejects stale parent SHA and launch-enabling edits", () => {
    const { packPath } = writeExecutionPack("tampered");
    const pack = readJsonArtifact(packPath);
    writeJsonArtifact(packPath, {
      ...pack,
      public_request_first_gym_proof_session_runbook_sha256: "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-execution-pack.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH:
          packPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Proof session runbook SHA256 does not match.");

    writeJsonArtifact(packPath, {
      ...pack,
      public_launch_decision_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-execution-pack.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH:
          packPath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof session execution pack public_launch_decision_allowed blocked.",
    );
  });

  it("wires package scripts, domain guidance, and Admin portal read-only card", () => {
    const packet = founderAdminPublicRequestFirstGymProofSessionExecutionPack({
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
      '"admin:public-request-first-gym:proof-session-execution-pack"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-session-execution-pack:inspect"',
    );
    expect(packet.title).toBe(
      "Public request first-gym proof session execution pack",
    );
    expect(packet.summary).toContain("without recording proof");
    expect(packet.gates.map((gate) => gate.label)).toContain(
      "Execution pack only",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymProofSessionExecutionPack",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym proof session execution pack"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });
});
