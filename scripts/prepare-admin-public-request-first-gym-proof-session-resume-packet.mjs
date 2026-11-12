#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PROGRESS_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-progress-batch.json";
const DEFAULT_RESUME_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-resume-packet.json";

const BLOCKED_FLAGS = [
  "public_self_serve_launch_allowed",
  "public_request_form_allowed",
  "public_request_form_submission_allowed",
  "public_submission_accepted",
  "browser_approval_buttons_allowed",
  "automatic_approval_allowed",
  "owner_provisioning_allowed",
  "product_auth_admin_api_allowed",
  "auth_user_created",
  "magic_link_created",
  "automatic_owner_staff_grants_allowed",
  "invite_delivery_allowed",
  "staff_invite_delivery_allowed",
  "outbound_email_allowed",
  "notification_sending_allowed",
  "gmail_resend_smtp_provider_allowed",
  "phone_email_provider_activation_allowed",
  "live_provider_enablement_allowed",
  "billing_pos_member_writes_allowed",
  "access_control_writes_allowed",
  "member_ledger_writes_allowed",
  "provider_ingress_allowed",
  "provider_egress_allowed",
  "public_launch_decision_allowed",
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretShapedValue(value, label) {
  if (typeof value !== "string") return;
  const secretLike =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(value) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(value) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(value) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(value) ||
    value.includes("__Secure-neon-auth") ||
    value.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(value);
  invariant(!secretLike, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const path = [...trail, String(index)].join(".");
      assertNoSecretShapedValue(entry, `${label}.${path}`);
      assertNoSecretShapedKeys(entry, label, [...trail, String(index)]);
    });
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    invariant(
      !/(password|token|cookie|apikey|authorization|credential|privatekey|secret|bypass|signature|jwt)/u.test(
        normalizedKey,
      ),
      `${label} contains secret-shaped key ${path}.`,
    );
    assertNoSecretShapedValue(entry, `${label}.${path}`);
    assertNoSecretShapedKeys(entry, label, [...trail, key]);
  }
}

function normalizeArtifactPath(value, label, options = {}) {
  invariant(value && typeof value === "string", `${label} required.`);
  invariant(!value.includes("\0"), `${label} cannot contain NUL.`);
  const resolved = resolve(value);
  const cwd = resolve(process.cwd());
  const relativePath = relative(cwd, resolved);
  invariant(
    !isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`),
    `${label} must stay inside repository.`,
  );
  invariant(
    relativePath.startsWith(`artifacts${sep}`) || relativePath === "artifacts",
    `${label} must be under artifacts/.`,
  );
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  }
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return {
    artifact,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

function runInspect(script, envName, path, label) {
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, [envName]: path },
  });
  if (result.status !== 0) {
    throw new Error(`${label} inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function assertFalseFlags(object, label) {
  for (const key of BLOCKED_FLAGS) {
    invariant(object?.[key] === false, `${label} ${key} blocked.`);
  }
}

function validateProgress(progress) {
  invariant(
    progress.artifact_kind ===
      "admin_public_request_first_gym_proof_session_progress_batch",
    "Proof session progress kind mismatch.",
  );
  invariant(
    progress.status ===
      "admin_public_request_first_gym_proof_session_progress_batch_prepared",
    "Proof session progress status mismatch.",
  );
  invariant(
    progress.proof_session_progress?.mode ===
      "status_only_reinspect_expected_evidence",
    "Proof session progress must remain status-only.",
  );
  invariant(
    Array.isArray(progress.progress_ledger),
    "Proof session progress ledger required.",
  );
  invariant(
    progress.progress_ledger.length ===
      progress.proof_session_progress.total_expected_evidence_count,
    "Proof session progress ledger count mismatch.",
  );
  assertFalseFlags(progress, "Proof session progress");
}

function main() {
  const progressPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH ??
      DEFAULT_PROGRESS_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH",
    { mustExist: true },
  );
  const resumePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH ??
      DEFAULT_RESUME_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH",
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-session-progress-batch.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH",
    progressPath.relativePath,
    "Public request first-gym proof session progress",
  );
  const { artifact: progress, sha256: progressSha256 } = readJsonArtifact(
    progressPath.resolved,
    "public request first-gym proof session progress",
  );
  validateProgress(progress);

  const missingSteps = progress.progress_ledger.filter((step) => step.state === "missing");
  const inspectableSteps = progress.progress_ledger.filter(
    (step) => step.state === "inspectable",
  );
  const nextMissing = missingSteps[0] ?? null;
  const allExpectedEvidenceInspectable = missingSteps.length === 0;

  const resume = {
    artifact_kind: "admin_public_request_first_gym_proof_session_resume_packet",
    status: "admin_public_request_first_gym_proof_session_resume_packet_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_first_gym_proof_session_progress_batch",
    public_request_first_gym_proof_session_progress_batch_path:
      progressPath.relativePath,
    public_request_first_gym_proof_session_progress_batch_sha256: progressSha256,
    public_request_first_gym_proof_session_execution_pack_sha256:
      progress.public_request_first_gym_proof_session_execution_pack_sha256,
    proof_session_resume_packet: {
      all_expected_evidence_inspectable: allExpectedEvidenceInspectable,
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      inspectable_count: inspectableSteps.length,
      limited_beta_review_recorded: false,
      missing_count: missingSteps.length,
      mode: "operator_resume_and_recovery_only",
      next_required_command: nextMissing?.terminal_command ?? null,
      next_required_step_id: nextMissing?.id ?? null,
      public_launch_decision_allowed: false,
      total_expected_evidence_count: progress.progress_ledger.length,
    },
    evidence_inventory: progress.progress_ledger.map((step) => ({
      artifact_path: step.artifact_path,
      artifact_sha256: step.artifact_sha256 ?? null,
      id: step.id,
      order: step.order,
      state: step.state,
      title: step.title,
    })),
    resume_command_sequence: [
      {
        command:
          "npm run admin:public-request-first-gym:proof-session-progress:inspect",
        id: "inspect_current_progress_snapshot",
        order: 1,
        title: "Inspect the current progress snapshot",
      },
      ...(nextMissing
        ? [
            {
              command: nextMissing.terminal_command,
              id: "run_next_missing_dedicated_proof_command",
              order: 2,
              title: nextMissing.title,
            },
            {
              command:
                "npm run admin:public-request-first-gym:proof-session-progress",
              id: "regenerate_progress_after_proof_command",
              order: 3,
              title: "Regenerate proof-session progress",
            },
            {
              command:
                "npm run admin:public-request-first-gym:proof-session-resume",
              id: "regenerate_resume_packet_after_progress",
              order: 4,
              title: "Regenerate this resume packet",
            },
          ]
        : [
            {
              command:
                "Run dedicated first-gym follow-up commands; this packet does not record them.",
              id: "ready_for_dedicated_followup_commands",
              order: 2,
              title: "Move to dedicated follow-up commands",
            },
          ]),
    ],
    support_recovery_checklist: [
      "If expected evidence appears after this packet, regenerate progress and resume before relying on this snapshot.",
      "If an artifact appears unexpectedly, inspect it with its dedicated command before treating it as evidence.",
      "If any inspector fails, stop the proof session and preserve the artifact path plus terminal output for support review.",
      "Do not delete, rotate, or replace customer-observed proof artifacts without copying the failing artifact and reason into operator notes.",
      "Do not claim public launch, invite delivery, live-provider activation, billing, POS, access-control, or member-ledger readiness from this packet.",
    ],
    completion_handoff_guard: {
      allowed_next_action: allExpectedEvidenceInspectable
        ? "Use the dedicated first-gym go/no-go, operator-run, and limited-beta review commands; this packet only confirms the progress snapshot is complete."
        : "Run the next missing dedicated proof command, then regenerate progress and resume.",
      state: allExpectedEvidenceInspectable
        ? "ready_for_dedicated_followup_commands"
        : "blocked",
    },
  };

  for (const key of BLOCKED_FLAGS) resume[key] = false;
  assertNoSecretShapedKeys(resume, "public request first-gym proof session resume packet");
  mkdirSync(dirname(resumePath.resolved), { recursive: true });
  writeFileSync(resumePath.resolved, `${JSON.stringify(resume, null, 2)}\n`);
  console.log("Admin public request first-gym proof session resume packet prepared");
  console.log(`Artifact: ${resumePath.relativePath}`);
  console.log(`Inspectable evidence: ${inspectableSteps.length}`);
  console.log(`Missing evidence: ${missingSteps.length}`);
}

main();
