import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { founderAdminPublicRequestFirstGymProofSessionResumePacket } from "../src/domain/founder-admin-readiness";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminComponent = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);

vi.setConfig({ testTimeout: 120000 });

const STEP_IDS = [
  "hosted_rehearsal_evidence",
  "customer_observed_session",
  "first_gym_go_no_go_bundle",
  "first_gym_operator_run",
  "limited_beta_operator_review",
  "public_request_self_serve_preflight",
  "public_launch_controls",
];

function run(script, env = {}) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function artifactPath(name) {
  const dir = "artifacts/admin-public-request-first-gym-proof-session-resume-tests";
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

function inspectorMeta(id) {
  const map = {
    customer_observed_session: [
      "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
      "scripts/inspect-admin-customer-observed-session.mjs",
    ],
    first_gym_go_no_go_bundle: [
      "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
      "scripts/inspect-admin-public-request-first-gym-go-no-go-bundle.mjs",
    ],
    first_gym_operator_run: [
      "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH",
      "scripts/inspect-admin-public-request-first-gym-operator-run.mjs",
    ],
    hosted_rehearsal_evidence: [
      "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
      "scripts/inspect-admin-public-request-hosted-rehearsal-evidence.mjs",
    ],
    limited_beta_operator_review: [
      "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH",
      "scripts/inspect-admin-public-request-limited-beta-operator-review-packet.mjs",
    ],
    public_launch_controls: [
      "OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH",
      "scripts/inspect-admin-public-launch-controls-batch.mjs",
    ],
    public_request_self_serve_preflight: [
      "OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH",
      "scripts/inspect-admin-public-request-self-serve-launch-preflight.mjs",
    ],
  };
  return map[id];
}

function writeProgressSnapshot(prefix) {
  const packPath = artifactPath(`${prefix}-execution-pack.json`);
  const progressPath = artifactPath(`${prefix}-progress.json`);
  removeIfExists(packPath);
  removeIfExists(progressPath);
  const worksheet = STEP_IDS.map((id, index) => ({
    expected_state_before_session: "missing_until_dedicated_command_runs",
    id,
    order: index + 1,
    operator_action: `Run ${id}`,
    terminal_command: `npm run ${id.replaceAll("_", "-")}`,
  }));
  const manifest = STEP_IDS.map((id, index) => ({
    artifact_path: artifactPath(`${prefix}-${id}.json`),
    expected_after_command: "inspectable_after_dedicated_command_only",
    id,
    order: index + 1,
    recorded_by_execution_pack: false,
  }));
  for (const step of manifest) removeIfExists(step.artifact_path);
  writeJsonArtifact(packPath, {
    artifact_kind: "admin_public_request_first_gym_proof_session_execution_pack",
    status: "admin_public_request_first_gym_proof_session_execution_pack_prepared",
    generated_at: "2026-07-02T18:00:00.000Z",
    evidence_basis: "admin_public_request_first_gym_proof_session_runbook",
    public_request_first_gym_execution_ledger_sha256: "a".repeat(64),
    proof_session_execution_pack: {
      customer_observed_completion_recorded: false,
      expected_evidence_count: STEP_IDS.length,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      mode: "operator_session_packet_only",
      public_launch_decision_allowed: false,
      worksheet_step_count: STEP_IDS.length,
    },
    customer_safe_worksheet: worksheet,
    expected_evidence_manifest: manifest,
    ...blockedFlags(),
  });
  const progressLedger = STEP_IDS.map((id, index) => {
    const [inspectorEnv, inspectorScript] = inspectorMeta(id);
    return {
      artifact_path: manifest[index].artifact_path,
      artifact_sha256: null,
      expected_after_command: "inspectable_after_dedicated_command_only",
      id,
      inspector_env: inspectorEnv,
      inspector_script: inspectorScript,
      order: index + 1,
      recorded_by_progress_batch: false,
      state: "missing",
      terminal_command: worksheet[index].terminal_command,
      title: worksheet[index].operator_action,
    };
  });
  writeJsonArtifact(progressPath, {
    artifact_kind: "admin_public_request_first_gym_proof_session_progress_batch",
    status: "admin_public_request_first_gym_proof_session_progress_batch_prepared",
    generated_at: "2026-07-02T18:01:00.000Z",
    evidence_basis: "admin_public_request_first_gym_proof_session_execution_pack",
    public_request_first_gym_proof_session_execution_pack_path: packPath,
    public_request_first_gym_proof_session_execution_pack_sha256:
      sha256File(packPath),
    public_request_first_gym_execution_ledger_sha256: "a".repeat(64),
    proof_session_progress: {
      all_expected_evidence_inspectable: false,
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      inspectable_count: 0,
      limited_beta_review_recorded: false,
      missing_count: STEP_IDS.length,
      mode: "status_only_reinspect_expected_evidence",
      next_required_command: worksheet[0].terminal_command,
      next_required_step_id: STEP_IDS[0],
      public_launch_decision_allowed: false,
      total_expected_evidence_count: STEP_IDS.length,
    },
    progress_ledger: progressLedger,
    next_step_packet: {
      mode: "ordered_missing_evidence_commands",
      missing_command_sequence: progressLedger.map((step) => ({
        artifact_path: step.artifact_path,
        command: step.terminal_command,
        id: step.id,
        order: step.order,
        title: step.title,
      })),
    },
    completion_check: {
      allowed_next_action:
        "Run the next missing dedicated proof command with the owner/operator context available, then regenerate this progress batch.",
      state: "blocked",
    },
    ...blockedFlags(),
  });
  return { packPath, progressPath };
}

function writeResumePacket(prefix) {
  const { progressPath } = writeProgressSnapshot(prefix);
  const resumePath = artifactPath(`${prefix}-resume.json`);
  removeIfExists(resumePath);
  const result = run(
    "scripts/prepare-admin-public-request-first-gym-proof-session-resume-packet.mjs",
    {
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH:
        progressPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH:
        resumePath,
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return { progressPath, resumePath, result };
}

describe("admin public request first-gym proof session resume packet", () => {
  it("prepares and inspects an operator resume snapshot from current progress", () => {
    const { progressPath, resumePath, result } = writeResumePacket("blocked");
    expect(result.stdout).toContain(
      "Admin public request first-gym proof session resume packet prepared",
    );
    expect(result.stdout).toContain("Missing evidence: 7");

    const inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-resume-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH:
          resumePath,
      },
    );
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin public request first-gym proof session resume packet inspection passed",
    );

    const resume = readJsonArtifact(resumePath);
    expect(resume).toMatchObject({
      artifact_kind: "admin_public_request_first_gym_proof_session_resume_packet",
      evidence_basis: "admin_public_request_first_gym_proof_session_progress_batch",
      public_request_first_gym_proof_session_progress_batch_path: progressPath,
    });
    expect(resume.proof_session_resume_packet).toMatchObject({
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      inspectable_count: 0,
      limited_beta_review_recorded: false,
      missing_count: 7,
      mode: "operator_resume_and_recovery_only",
      next_required_step_id: "hosted_rehearsal_evidence",
      public_launch_decision_allowed: false,
    });
    expect(resume.evidence_inventory).toHaveLength(7);
    expect(resume.resume_command_sequence.map((step) => step.id)).toEqual([
      "inspect_current_progress_snapshot",
      "run_next_missing_dedicated_proof_command",
      "regenerate_progress_after_proof_command",
      "regenerate_resume_packet_after_progress",
    ]);
    expect(resume.support_recovery_checklist.length).toBeGreaterThanOrEqual(5);
    for (const [key, value] of Object.entries(blockedFlags())) {
      expect(resume[key]).toBe(value);
    }
  });

  it("rejects stale parent SHA and launch-enabling edits", () => {
    const { resumePath } = writeResumePacket("tampered");
    const resume = readJsonArtifact(resumePath);
    writeJsonArtifact(resumePath, {
      ...resume,
      public_request_first_gym_proof_session_progress_batch_sha256:
        "0".repeat(64),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-resume-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH:
          resumePath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof session progress SHA256 does not match.",
    );

    writeJsonArtifact(resumePath, {
      ...resume,
      public_launch_decision_allowed: true,
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-resume-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH:
          resumePath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "Proof session resume packet public_launch_decision_allowed blocked.",
    );
  });

  it("rejects operator-facing resume command and inventory tampering", () => {
    const { resumePath } = writeResumePacket("operator-command-tampered");
    const resume = readJsonArtifact(resumePath);
    writeJsonArtifact(resumePath, {
      ...resume,
      resume_command_sequence: resume.resume_command_sequence.map((step) =>
        step.id === "run_next_missing_dedicated_proof_command"
          ? { ...step, command: "npm run unsafe-public-launch" }
          : step,
      ),
    });
    let inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-resume-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH:
          resumePath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Resume command sequence 2 command mismatch.");

    writeJsonArtifact(resumePath, {
      ...resume,
      evidence_inventory: resume.evidence_inventory.map((item) =>
        item.id === "hosted_rehearsal_evidence"
          ? { ...item, title: "Different operator-facing title" }
          : item,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-resume-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH:
          resumePath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("hosted_rehearsal_evidence inventory title mismatch.");

    writeJsonArtifact(resumePath, {
      ...resume,
      resume_command_sequence: resume.resume_command_sequence.map((step) =>
        step.id === "run_next_missing_dedicated_proof_command"
          ? { ...step, public_launch_decision_allowed: true }
          : step,
      ),
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-resume-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH:
          resumePath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Resume command sequence 2 keys mismatch.");

    writeJsonArtifact(resumePath, {
      ...resume,
      completion_handoff_guard: {
        ...resume.completion_handoff_guard,
        allowed_next_action: "Approve public launch",
      },
    });
    inspect = run(
      "scripts/inspect-admin-public-request-first-gym-proof-session-resume-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH:
          resumePath,
      },
    );
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Resume completion handoff action mismatch.");
  });

  it("wires package scripts, domain guidance, and Admin portal read-only card", () => {
    const packet = founderAdminPublicRequestFirstGymProofSessionResumePacket({
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
      '"admin:public-request-first-gym:proof-session-resume"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-first-gym:proof-session-resume:inspect"',
    );
    expect(packet.title).toBe("Public request first-gym proof session resume");
    expect(packet.summary).toContain("without recording proof");
    expect(packet.gates.map((gate) => gate.label)).toContain("Resume only");
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestFirstGymProofSessionResumePacket",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request first gym proof session resume"',
    );
    expect(founderAdminComponent).not.toContain("Approve public launch");
  });
});
