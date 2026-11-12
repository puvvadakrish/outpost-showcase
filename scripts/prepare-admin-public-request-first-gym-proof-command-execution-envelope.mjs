#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_CHECKPOINT_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-launch-checkpoint.json";
const DEFAULT_ENVELOPE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-command-execution-envelope.json";

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
      assertNoSecretShapedValue(entry, `${label}.${[...trail, String(index)].join(".")}`);
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

function operatorCommandTemplates() {
  return [
    {
      command: [
        "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH='<hosted-rehearsal-evidence-artifact.json>'",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH='<customer-observed-session-record.json>'",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_PASSED='yes'",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_OPERATOR='<operator-name>'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PREVIEW_URL='<protected-vercel-preview-url>'",
        "OUTPOST_NEON_BRANCH_NAME='<hosted-neon-proof-branch>'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH='<first-gym-go-no-go-bundle.json>'",
        "npm run admin:public-request-first-gym:go-no-go:bundle",
        "npm run admin:public-request-first-gym:go-no-go:bundle:inspect",
      ].join(" \\\n  "),
      id: "first_gym_go_no_go_bundle_template",
      order: 1,
      title: "Prepare and inspect first-gym go/no-go bundle",
    },
    {
      command: [
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH='<first-gym-go-no-go-bundle.json>'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH='<first-gym-operator-run-record.json>'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OWNER_WORKSPACE_COMPLETED='yes'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_STAFF_WORKBOARD_COMPLETED='yes'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_SOURCE_TO_ANSWER_TO_TASK_COMPLETED='yes'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_RESET_ROLLBACK_EXERCISED='yes'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_SUPPORT_HANDOFF_REVIEWED='yes'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_UNEXPECTED_DATA_NOT_OBSERVED='yes'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED='yes'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_INVITE_DELIVERY_NOT_OBSERVED='yes'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED='yes'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR='<operator-name>'",
        "npm run admin:public-request-first-gym:run",
        "npm run admin:public-request-first-gym:run:inspect",
      ].join(" \\\n  "),
      id: "first_gym_operator_run_template",
      order: 2,
      title: "Record and inspect first-gym operator run",
    },
    {
      command: [
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH='<first-gym-operator-run-record.json>'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_REVIEW_PATH='<limited-beta-review-packet.json>'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_REVIEWED_FIRST_GYM_RUN='yes'",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR='<operator-name>'",
        "npm run admin:public-request:limited-beta:operator-review",
        "npm run admin:public-request:limited-beta:operator-review:inspect",
      ].join(" \\\n  "),
      id: "limited_beta_operator_review_template",
      order: 3,
      title: "Prepare and inspect limited beta operator review",
    },
  ];
}

function executionCommandSequence(checkpoint) {
  const ready =
    checkpoint.proof_session_launch_checkpoint.ready_for_real_proof_command_run ===
    true;
  if (!ready) {
    return [
      ...checkpoint.operator_command_sequence,
      {
        command:
          "npm run admin:public-request-first-gym:proof-command-execution-envelope",
        id: "regenerate_execution_envelope_after_launch_checkpoint",
        order: checkpoint.operator_command_sequence.length + 1,
        title: "Regenerate proof-command execution envelope",
      },
    ];
  }
  return operatorCommandTemplates().map(({ id, order, title }) => ({
    command:
      id === "first_gym_go_no_go_bundle_template"
        ? "Use first_gym_go_no_go_bundle_template with real hosted/customer evidence."
        : id === "first_gym_operator_run_template"
          ? "Use first_gym_operator_run_template only after the go/no-go bundle inspects clean."
          : "Use limited_beta_operator_review_template only after the first-gym operator run inspects clean.",
    id: id.replace("_template", "_command"),
    order,
    title,
  }));
}

function main() {
  const checkpointPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH ??
      DEFAULT_CHECKPOINT_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH",
    { mustExist: true },
  );
  const envelopePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH ??
      DEFAULT_ENVELOPE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH",
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-session-launch-checkpoint.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH",
    checkpointPath.relativePath,
    "Public request first-gym proof session launch checkpoint",
  );
  const { artifact: checkpoint, sha256: checkpointSha256 } = readJsonArtifact(
    checkpointPath.resolved,
    "public request first-gym proof session launch checkpoint",
  );
  assertFalseFlags(checkpoint, "Proof session launch checkpoint");

  const ready =
    checkpoint.proof_session_launch_checkpoint.ready_for_real_proof_command_run ===
    true;
  const envelope = {
    artifact_kind:
      "admin_public_request_first_gym_proof_command_execution_envelope",
    status:
      "admin_public_request_first_gym_proof_command_execution_envelope_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "admin_public_request_first_gym_proof_session_launch_checkpoint",
    public_request_first_gym_proof_session_launch_checkpoint_path:
      checkpointPath.relativePath,
    public_request_first_gym_proof_session_launch_checkpoint_sha256:
      checkpointSha256,
    verified_launch_checkpoint: {
      checkpoint_guard_state: checkpoint.checkpoint_guard.state,
      path: checkpointPath.relativePath,
      ready_for_real_proof_command_run: ready,
      sha256: checkpointSha256,
      still_missing_evidence_count:
        checkpoint.proof_session_launch_checkpoint.still_missing_evidence_count,
    },
    proof_command_execution_envelope: {
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      mode: "operator_execution_envelope_only",
      public_launch_decision_allowed: false,
      ready_for_real_proof_command_run: ready,
      still_missing_evidence_count:
        checkpoint.proof_session_launch_checkpoint.still_missing_evidence_count,
    },
    evidence_summary: checkpoint.evidence_summary,
    operator_input_requirements: checkpoint.operator_input_requirements,
    operator_command_templates: operatorCommandTemplates(),
    operator_command_sequence: executionCommandSequence(checkpoint),
    execution_envelope_guard: {
      allowed_next_action: ready
        ? "Use the command templates with real protected Preview, hosted Neon branch, and customer-observed evidence; this envelope still records no proof."
        : "Run the next missing dedicated proof command, then regenerate progress, resume, diagnostics, follow-up preflight, launch checkpoint, and this execution envelope.",
      state: ready ? "ready_for_real_proof_command_run" : "blocked",
    },
  };

  for (const key of BLOCKED_FLAGS) envelope[key] = false;
  assertNoSecretShapedKeys(
    envelope,
    "public request first-gym proof-command execution envelope",
  );
  mkdirSync(dirname(envelopePath.resolved), { recursive: true });
  writeFileSync(envelopePath.resolved, `${JSON.stringify(envelope, null, 2)}\n`);
  console.log("Admin public request first-gym proof-command execution envelope prepared");
  console.log(`Artifact: ${envelopePath.relativePath}`);
  console.log(`State: ${envelope.execution_envelope_guard.state}`);
  console.log(`Missing evidence: ${envelope.verified_launch_checkpoint.still_missing_evidence_count}`);
}

main();
