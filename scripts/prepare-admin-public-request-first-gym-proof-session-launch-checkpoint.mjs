#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-followup-preflight.json";
const DEFAULT_CHECKPOINT_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-launch-checkpoint.json";

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

function operatorInputRequirements() {
  return [
    {
      command:
        "npm run admin:public-request-first-gym:go-no-go:bundle",
      id: "first_gym_go_no_go_bundle_inputs",
      order: 1,
      required_env: [
        "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_PASSED=yes",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_OPERATOR",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PREVIEW_URL",
        "OUTPOST_NEON_BRANCH_NAME",
      ],
      title: "First-gym go/no-go bundle inputs",
    },
    {
      command: "npm run admin:public-request-first-gym:run",
      id: "first_gym_operator_run_inputs",
      order: 2,
      required_env: [
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OWNER_WORKSPACE_COMPLETED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_STAFF_WORKBOARD_COMPLETED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_SOURCE_TO_ANSWER_TO_TASK_COMPLETED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_RESET_ROLLBACK_EXERCISED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_SUPPORT_HANDOFF_REVIEWED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_UNEXPECTED_DATA_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_INVITE_DELIVERY_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR",
      ],
      title: "First-gym operator-run inputs",
    },
    {
      command: "npm run admin:public-request:limited-beta:operator-review",
      id: "limited_beta_operator_review_inputs",
      order: 3,
      required_env: [
        "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_REVIEWED_FIRST_GYM_RUN=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR",
      ],
      title: "Limited beta review inputs",
    },
  ];
}

function checkpointCommandSequence(preflight) {
  const ready =
    preflight.proof_session_followup_preflight.ready_for_dedicated_followup_commands ===
    true;
  if (!ready) {
    return [
      ...preflight.operator_command_sequence,
      {
        command:
          "npm run admin:public-request-first-gym:proof-session-launch-checkpoint",
        id: "regenerate_launch_checkpoint_after_preflight",
        order: preflight.operator_command_sequence.length + 1,
        title: "Regenerate proof-session launch checkpoint",
      },
    ];
  }
  return [
    {
      command:
        "npm run admin:public-request-first-gym:go-no-go:bundle && npm run admin:public-request-first-gym:go-no-go:bundle:inspect",
      id: "run_first_gym_go_no_go_bundle",
      order: 1,
      title: "Run and inspect first-gym go/no-go bundle",
    },
    {
      command:
        "npm run admin:public-request-first-gym:run && npm run admin:public-request-first-gym:run:inspect",
      id: "run_first_gym_operator_run",
      order: 2,
      title: "Run and inspect first-gym operator run",
    },
    {
      command:
        "npm run admin:public-request:limited-beta:operator-review && npm run admin:public-request:limited-beta:operator-review:inspect",
      id: "run_limited_beta_operator_review",
      order: 3,
      title: "Run and inspect limited beta review",
    },
  ];
}

function main() {
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH ??
      DEFAULT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH",
    { mustExist: true },
  );
  const checkpointPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH ??
      DEFAULT_CHECKPOINT_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH",
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-session-followup-preflight.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH",
    preflightPath.relativePath,
    "Public request first-gym proof session follow-up preflight",
  );
  const { artifact: preflight, sha256: preflightSha256 } = readJsonArtifact(
    preflightPath.resolved,
    "public request first-gym proof session follow-up preflight",
  );
  assertFalseFlags(preflight, "Proof session follow-up preflight");

  const summary = preflight.proof_session_followup_preflight;
  const readyForProofCommands = summary.ready_for_dedicated_followup_commands === true;
  const checkpoint = {
    artifact_kind:
      "admin_public_request_first_gym_proof_session_launch_checkpoint",
    status:
      "admin_public_request_first_gym_proof_session_launch_checkpoint_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "admin_public_request_first_gym_proof_session_followup_preflight",
    public_request_first_gym_proof_session_followup_preflight_path:
      preflightPath.relativePath,
    public_request_first_gym_proof_session_followup_preflight_sha256:
      preflightSha256,
    verified_followup_preflight: {
      followup_guard_state: preflight.followup_guard.state,
      inspectable_count: summary.inspectable_count,
      missing_count: summary.missing_count,
      next_required_command: summary.next_required_command,
      next_required_step_id: summary.next_required_step_id,
      path: preflightPath.relativePath,
      ready_for_dedicated_followup_commands: readyForProofCommands,
      sha256: preflightSha256,
      total_expected_evidence_count: summary.total_expected_evidence_count,
    },
    proof_session_launch_checkpoint: {
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      mode: "real_proof_command_launch_checkpoint_only",
      public_launch_decision_allowed: false,
      ready_for_real_proof_command_run: readyForProofCommands,
      still_missing_evidence_count: summary.missing_count,
    },
    evidence_summary: preflight.evidence_summary,
    operator_input_requirements: operatorInputRequirements(),
    operator_command_sequence: checkpointCommandSequence(preflight),
    checkpoint_guard: {
      allowed_next_action: readyForProofCommands
        ? "Run the dedicated first-gym proof commands with real hosted/customer evidence; this checkpoint still records no proof."
        : "Run the next missing dedicated proof command, then regenerate progress, resume, diagnostics, follow-up preflight, and this launch checkpoint.",
      state: readyForProofCommands
        ? "ready_for_real_proof_command_run"
        : "blocked",
    },
  };

  for (const key of BLOCKED_FLAGS) checkpoint[key] = false;
  assertNoSecretShapedKeys(
    checkpoint,
    "public request first-gym proof session launch checkpoint",
  );
  mkdirSync(dirname(checkpointPath.resolved), { recursive: true });
  writeFileSync(checkpointPath.resolved, `${JSON.stringify(checkpoint, null, 2)}\n`);
  console.log("Admin public request first-gym proof session launch checkpoint prepared");
  console.log(`Artifact: ${checkpointPath.relativePath}`);
  console.log(`State: ${checkpoint.checkpoint_guard.state}`);
  console.log(`Missing evidence: ${summary.missing_count}`);
}

main();
