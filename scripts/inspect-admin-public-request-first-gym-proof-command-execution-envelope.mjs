#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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

function normalizeArtifactPath(value, label) {
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
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
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

function assertObjectKeys(object, keys, label) {
  invariant(object && typeof object === "object" && !Array.isArray(object), `${label} required.`);
  invariant(
    JSON.stringify(Object.keys(object).sort()) === JSON.stringify([...keys].sort()),
    `${label} keys mismatch.`,
  );
}

function assertObjectArrayEqual(actual, expected, label) {
  invariant(Array.isArray(actual), `${label} required.`);
  invariant(actual.length === expected.length, `${label} count mismatch.`);
  expected.forEach((expectedEntry, index) => {
    const actualEntry = actual[index];
    assertObjectKeys(actualEntry, Object.keys(expectedEntry), `${label} ${index + 1}`);
    for (const [key, value] of Object.entries(expectedEntry)) {
      invariant(
        JSON.stringify(actualEntry[key]) === JSON.stringify(value),
        `${label} ${index + 1} ${key} mismatch.`,
      );
    }
  });
}

function expectedCommandTemplates() {
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

function expectedCommandSequence(checkpoint) {
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
  return [
    {
      command:
        "Use first_gym_go_no_go_bundle_template with real hosted/customer evidence.",
      id: "first_gym_go_no_go_bundle_command",
      order: 1,
      title: "Prepare and inspect first-gym go/no-go bundle",
    },
    {
      command:
        "Use first_gym_operator_run_template only after the go/no-go bundle inspects clean.",
      id: "first_gym_operator_run_command",
      order: 2,
      title: "Record and inspect first-gym operator run",
    },
    {
      command:
        "Use limited_beta_operator_review_template only after the first-gym operator run inspects clean.",
      id: "limited_beta_operator_review_command",
      order: 3,
      title: "Prepare and inspect limited beta operator review",
    },
  ];
}

function main() {
  const envelopePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH ??
      DEFAULT_ENVELOPE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH",
  );
  const { artifact: envelope } = readJsonArtifact(
    envelopePath.resolved,
    "public request first-gym proof-command execution envelope",
  );
  invariant(
    envelope.artifact_kind ===
      "admin_public_request_first_gym_proof_command_execution_envelope",
    "Proof-command execution envelope kind mismatch.",
  );
  invariant(
    envelope.status ===
      "admin_public_request_first_gym_proof_command_execution_envelope_prepared",
    "Proof-command execution envelope status mismatch.",
  );
  invariant(
    envelope.evidence_basis ===
      "admin_public_request_first_gym_proof_session_launch_checkpoint",
    "Proof-command execution envelope basis mismatch.",
  );

  const checkpointPath = normalizeArtifactPath(
    envelope.public_request_first_gym_proof_session_launch_checkpoint_path,
    "proof session launch checkpoint path",
  );
  const { artifact: checkpoint, sha256: checkpointSha256 } = readJsonArtifact(
    checkpointPath.resolved,
    "public request first-gym proof session launch checkpoint",
  );
  invariant(
    checkpointSha256 ===
      envelope.public_request_first_gym_proof_session_launch_checkpoint_sha256,
    "Proof session launch checkpoint SHA256 does not match.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-session-launch-checkpoint.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH",
    checkpointPath.relativePath,
    "Public request first-gym proof session launch checkpoint",
  );

  const ready =
    checkpoint.proof_session_launch_checkpoint.ready_for_real_proof_command_run ===
    true;
  const missing =
    checkpoint.proof_session_launch_checkpoint.still_missing_evidence_count;
  assertObjectKeys(
    envelope.verified_launch_checkpoint,
    [
      "checkpoint_guard_state",
      "path",
      "ready_for_real_proof_command_run",
      "sha256",
      "still_missing_evidence_count",
    ],
    "Verified launch checkpoint",
  );
  invariant(
    envelope.verified_launch_checkpoint.path === checkpointPath.relativePath,
    "Verified launch checkpoint path mismatch.",
  );
  invariant(
    envelope.verified_launch_checkpoint.sha256 === checkpointSha256,
    "Verified launch checkpoint SHA256 mismatch.",
  );
  invariant(
    envelope.verified_launch_checkpoint.checkpoint_guard_state ===
      checkpoint.checkpoint_guard.state,
    "Verified launch checkpoint guard state mismatch.",
  );
  invariant(
    envelope.verified_launch_checkpoint.ready_for_real_proof_command_run === ready,
    "Verified launch checkpoint readiness mismatch.",
  );
  invariant(
    envelope.verified_launch_checkpoint.still_missing_evidence_count === missing,
    "Verified launch checkpoint missing evidence mismatch.",
  );

  invariant(
    envelope.proof_command_execution_envelope?.mode ===
      "operator_execution_envelope_only",
    "Proof-command execution envelope must remain envelope-only.",
  );
  invariant(
    envelope.proof_command_execution_envelope.customer_observed_completion_recorded ===
      false,
    "Proof-command execution envelope cannot record customer-observed completion.",
  );
  invariant(
    envelope.proof_command_execution_envelope.first_gym_operator_run_recorded ===
      false,
    "Proof-command execution envelope cannot record first-gym operator run.",
  );
  invariant(
    envelope.proof_command_execution_envelope.limited_beta_review_recorded ===
      false,
    "Proof-command execution envelope cannot record limited beta review.",
  );
  invariant(
    envelope.proof_command_execution_envelope.public_launch_decision_allowed ===
      false,
    "Proof-command execution envelope cannot allow public launch decision.",
  );
  invariant(
    envelope.proof_command_execution_envelope.ready_for_real_proof_command_run === ready,
    "Proof-command execution envelope readiness mismatch.",
  );
  invariant(
    envelope.proof_command_execution_envelope.still_missing_evidence_count ===
      missing,
    "Proof-command execution envelope missing evidence mismatch.",
  );
  assertObjectArrayEqual(
    envelope.evidence_summary.missing_evidence,
    checkpoint.evidence_summary.missing_evidence,
    "Missing evidence summary",
  );
  assertObjectArrayEqual(
    envelope.evidence_summary.inspectable_evidence,
    checkpoint.evidence_summary.inspectable_evidence,
    "Inspectable evidence summary",
  );
  assertObjectArrayEqual(
    envelope.operator_input_requirements,
    checkpoint.operator_input_requirements,
    "Operator input requirements",
  );
  assertObjectArrayEqual(
    envelope.operator_command_templates,
    expectedCommandTemplates(),
    "Operator command templates",
  );
  assertObjectArrayEqual(
    envelope.operator_command_sequence,
    expectedCommandSequence(checkpoint),
    "Operator command sequence",
  );
  invariant(
    envelope.execution_envelope_guard?.state ===
      (ready ? "ready_for_real_proof_command_run" : "blocked"),
    "Execution envelope guard state mismatch.",
  );
  invariant(
    envelope.execution_envelope_guard?.allowed_next_action ===
      (ready
        ? "Use the command templates with real protected Preview, hosted Neon branch, and customer-observed evidence; this envelope still records no proof."
        : "Run the next missing dedicated proof command, then regenerate progress, resume, diagnostics, follow-up preflight, launch checkpoint, and this execution envelope."),
    "Execution envelope guard action mismatch.",
  );
  assertFalseFlags(envelope, "Proof-command execution envelope");

  console.log(
    "Admin public request first-gym proof-command execution envelope inspection passed",
  );
}

main();
