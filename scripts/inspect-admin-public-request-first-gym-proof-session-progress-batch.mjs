#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PROGRESS_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-progress-batch.json";

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

const STEP_INSPECTORS = {
  customer_observed_session: {
    envName: "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    script: "scripts/inspect-admin-customer-observed-session.mjs",
  },
  first_gym_go_no_go_bundle: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
    script: "scripts/inspect-admin-public-request-first-gym-go-no-go-bundle.mjs",
  },
  first_gym_operator_run: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH",
    script: "scripts/inspect-admin-public-request-first-gym-operator-run.mjs",
  },
  hosted_rehearsal_evidence: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
    script: "scripts/inspect-admin-public-request-hosted-rehearsal-evidence.mjs",
  },
  limited_beta_operator_review: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH",
    script:
      "scripts/inspect-admin-public-request-limited-beta-operator-review-packet.mjs",
  },
  public_launch_controls: {
    envName: "OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH",
    script: "scripts/inspect-admin-public-launch-controls-batch.mjs",
  },
  public_request_self_serve_preflight: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH",
    script: "scripts/inspect-admin-public-request-self-serve-launch-preflight.mjs",
  },
};
const REQUIRED_STEP_IDS = [
  "hosted_rehearsal_evidence",
  "customer_observed_session",
  "first_gym_go_no_go_bundle",
  "first_gym_operator_run",
  "limited_beta_operator_review",
  "public_request_self_serve_preflight",
  "public_launch_controls",
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
  if (options.mustExist !== false) {
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

function validateExecutionPack(pack) {
  invariant(
    pack.artifact_kind ===
      "admin_public_request_first_gym_proof_session_execution_pack",
    "Proof session execution pack kind mismatch.",
  );
  invariant(
    pack.status ===
      "admin_public_request_first_gym_proof_session_execution_pack_prepared",
    "Proof session execution pack status mismatch.",
  );
  invariant(
    pack.evidence_basis === "admin_public_request_first_gym_proof_session_runbook",
    "Proof session execution pack basis mismatch.",
  );
  invariant(
    pack.proof_session_execution_pack?.mode === "operator_session_packet_only",
    "Proof session execution pack must remain operator-session-only.",
  );
  invariant(
    pack.proof_session_execution_pack.customer_observed_completion_recorded ===
      false,
    "Execution pack cannot record customer-observed completion.",
  );
  invariant(
    pack.proof_session_execution_pack.first_gym_operator_run_recorded === false,
    "Execution pack cannot record first-gym operator run.",
  );
  invariant(
    pack.proof_session_execution_pack.limited_beta_review_recorded === false,
    "Execution pack cannot record limited beta review.",
  );
  invariant(
    pack.proof_session_execution_pack.public_launch_decision_allowed === false,
    "Execution pack cannot allow public launch decision.",
  );
  invariant(
    Array.isArray(pack.customer_safe_worksheet),
    "Execution pack worksheet required.",
  );
  invariant(
    Array.isArray(pack.expected_evidence_manifest),
    "Execution pack evidence manifest required.",
  );
  invariant(
    pack.customer_safe_worksheet.length ===
      pack.expected_evidence_manifest.length,
    "Execution pack worksheet/evidence length mismatch.",
  );
  invariant(
    pack.expected_evidence_manifest.length === REQUIRED_STEP_IDS.length,
    "Execution pack evidence manifest count mismatch.",
  );
  REQUIRED_STEP_IDS.forEach((id, index) => {
    invariant(
      pack.expected_evidence_manifest[index]?.id === id,
      `Execution pack evidence manifest step ${index + 1} must be ${id}.`,
    );
    invariant(
      pack.customer_safe_worksheet[index]?.id === id,
      `Execution pack worksheet step ${index + 1} must be ${id}.`,
    );
  });
  assertFalseFlags(pack, "Proof session execution pack");
}

function inspectProgressStep(step) {
  invariant(Object.hasOwn(STEP_INSPECTORS, step.id), `Unexpected progress step ${step.id}.`);
  invariant(["missing", "inspectable"].includes(step.state), `Invalid progress state for ${step.id}.`);
  invariant(step.recorded_by_progress_batch === false, `${step.id} cannot be recorded by progress batch.`);
  const artifactPath = normalizeArtifactPath(step.artifact_path, `${step.id} artifact path`, {
    mustExist: step.state === "inspectable",
  });
  if (step.state === "missing") {
    invariant(!existsSync(artifactPath.resolved), `${step.id} marked missing but artifact exists.`);
    invariant(step.artifact_sha256 === null, `${step.id} missing step cannot pin artifact SHA.`);
    return;
  }

  const { envName, script } = STEP_INSPECTORS[step.id];
  invariant(step.inspector_env === envName, `${step.id} inspector env mismatch.`);
  invariant(step.inspector_script === script, `${step.id} inspector script mismatch.`);
  runInspect(script, envName, artifactPath.relativePath, step.title ?? step.id);
  const { sha256 } = readJsonArtifact(artifactPath.resolved, step.id);
  invariant(sha256 === step.artifact_sha256, `${step.id} SHA256 does not match artifact.`);
}

function main() {
  const progressPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH ??
      DEFAULT_PROGRESS_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH",
  );
  const { artifact: progress } = readJsonArtifact(
    progressPath.resolved,
    "public request first-gym proof session progress batch",
  );
  invariant(
    progress.artifact_kind ===
      "admin_public_request_first_gym_proof_session_progress_batch",
    "Proof session progress batch kind mismatch.",
  );
  invariant(
    progress.status ===
      "admin_public_request_first_gym_proof_session_progress_batch_prepared",
    "Proof session progress batch status mismatch.",
  );
  invariant(
    progress.evidence_basis ===
      "admin_public_request_first_gym_proof_session_execution_pack",
    "Proof session progress batch basis mismatch.",
  );
  const packPath = normalizeArtifactPath(
    progress.public_request_first_gym_proof_session_execution_pack_path,
    "proof session execution pack path",
  );
  const { artifact: pack, sha256: packSha256 } = readJsonArtifact(
    packPath.resolved,
    "public request first-gym proof session execution pack",
  );
  invariant(
    packSha256 ===
      progress.public_request_first_gym_proof_session_execution_pack_sha256,
    "Proof session execution pack SHA256 does not match.",
  );
  validateExecutionPack(pack);
  invariant(
    progress.public_request_first_gym_execution_ledger_sha256 ===
      pack.public_request_first_gym_execution_ledger_sha256,
    "Progress batch execution ledger SHA256 mismatch.",
  );
  invariant(
    progress.proof_session_progress?.mode ===
      "status_only_reinspect_expected_evidence",
    "Proof session progress must remain status-only.",
  );
  invariant(
    progress.proof_session_progress.customer_observed_completion_recorded === false,
    "Progress batch cannot record customer-observed completion.",
  );
  invariant(
    progress.proof_session_progress.first_gym_operator_run_recorded === false,
    "Progress batch cannot record first-gym operator run.",
  );
  invariant(
    progress.proof_session_progress.limited_beta_review_recorded === false,
    "Progress batch cannot record limited beta review.",
  );
  invariant(
    progress.proof_session_progress.public_launch_decision_allowed === false,
    "Progress batch cannot allow public launch decision.",
  );

  const ledger = progress.progress_ledger ?? [];
  const manifest = pack.expected_evidence_manifest ?? [];
  invariant(ledger.length === manifest.length, "Progress ledger count mismatch.");
  ledger.forEach((step, index) => {
    invariant(
      step.id === manifest[index]?.id,
      `Progress ledger step ${index + 1} must match execution pack manifest.`,
    );
    inspectProgressStep(step);
  });
  const inspectableCount = ledger.filter((step) => step.state === "inspectable").length;
  const missingSteps = ledger.filter((step) => step.state === "missing");
  const missingCount = missingSteps.length;
  invariant(
    progress.proof_session_progress.inspectable_count === inspectableCount,
    "Inspectable count mismatch.",
  );
  invariant(
    progress.proof_session_progress.missing_count === missingCount,
    "Missing count mismatch.",
  );
  invariant(
    progress.proof_session_progress.total_expected_evidence_count === ledger.length,
    "Total expected evidence count mismatch.",
  );
  invariant(
    progress.proof_session_progress.all_expected_evidence_inspectable ===
      (missingCount === 0),
    "All expected evidence flag mismatch.",
  );
  invariant(
    progress.proof_session_progress.next_required_step_id ===
      (missingSteps[0]?.id ?? null),
    "Next required step mismatch.",
  );
  invariant(
    progress.proof_session_progress.next_required_command ===
      (missingSteps[0]?.terminal_command ?? null),
    "Next required command mismatch.",
  );
  invariant(
    (progress.next_step_packet?.missing_command_sequence ?? []).length === missingCount,
    "Missing command sequence count mismatch.",
  );
  invariant(
    progress.completion_check?.state ===
      (missingCount === 0 ? "ready_for_dedicated_followup_commands" : "blocked"),
    "Completion check state mismatch.",
  );
  assertFalseFlags(progress, "Proof session progress batch");

  console.log("Admin public request first-gym proof session progress batch inspection passed");
}

main();
