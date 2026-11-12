#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-protected-preview-evidence-preflight.json";
const DEFAULT_ATTEMPT_READINESS_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-real-evidence-attempt-readiness.json";

const REFRESH_AFTER_EVIDENCE_COMMAND =
  "npm run admin:public-request-first-gym:proof-evidence-session-ledger && npm run admin:public-request-first-gym:proof-evidence-session-ledger:inspect && npm run admin:public-request-first-gym:evidence-execution-readiness && npm run admin:public-request-first-gym:evidence-execution-readiness:inspect && npm run admin:public-request-first-gym:evidence-run-coordinator && npm run admin:public-request-first-gym:evidence-run-coordinator:inspect && npm run admin:public-request-first-gym:protected-preview-evidence-preflight && npm run admin:public-request-first-gym:protected-preview-evidence-preflight:inspect && npm run admin:public-request-first-gym:real-evidence-attempt-readiness && npm run admin:public-request-first-gym:real-evidence-attempt-readiness:inspect";

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
  } else if (options.mustNotExist) {
    invariant(!existsSync(resolved), `${label} already exists: ${relativePath}`);
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

function inputGroups() {
  return [
    {
      command:
        "npm run admin:public-request-hosted-rehearsal:evidence && npm run admin:public-request-hosted-rehearsal:evidence:inspect",
      id: "hosted_rehearsal_real_observations",
      required_before_command: [
        "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH points at the inspected hosted rehearsal readiness artifact.",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_STAFF_WORKBOARD_OBSERVED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_RESET_ROLLBACK_REVIEWED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_UNEXPECTED_DATA_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_INVITE_DELIVERY_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OPERATOR identifies the operator or support window.",
        "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_WINDOW identifies the real hosted rehearsal window.",
      ],
      title: "Hosted rehearsal evidence inputs",
    },
    {
      command:
        "npm run admin:customer-session:record && npm run admin:customer-session:inspect",
      id: "customer_observed_session_real_observations",
      required_before_command: [
        "OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH points at the inspected customer handoff scheduling artifact.",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT=yes",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED=yes",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_WORKSPACE_OBSERVED=yes",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_STAFF_HANDOFF_OBSERVED=yes",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_RESET_ROLLBACK_REVIEWED=yes",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_UNEXPECTED_DATA_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_INVITE_DELIVERY_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED=yes",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_OPERATOR identifies the real session operator.",
        "OUTPOST_ADMIN_CUSTOMER_SESSION_WINDOW identifies the real customer session window.",
      ],
      title: "Customer-observed session inputs",
    },
    {
      command:
        "npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
      id: "hosted_customer_session_digest_inputs",
      required_before_command: [
        "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH points at the inspected customer-observed session record.",
        "Hosted Preview readiness config points at the protected Preview origin and hosted Neon branch.",
        "Neon CLI authentication is available to the operator without storing credentials in artifacts.",
      ],
      title: "Hosted customer-session digest inputs",
    },
  ];
}

function expectedAttemptSequence(preflight) {
  const sequence = preflight.evidence_capture_sequence ?? [];
  const stepById = new Map(sequence.map((step) => [step.id, step]));
  const hostedStep = stepById.get("record_hosted_rehearsal_evidence");
  const customerStep = stepById.get("record_customer_observed_session_and_hosted_digest");
  const goNoGoStep = stepById.get("hold_first_gym_go_no_go");
  invariant(hostedStep, "Preflight hosted evidence step missing.");
  invariant(customerStep, "Preflight customer evidence step missing.");
  invariant(goNoGoStep, "Preflight go/no-go step missing.");

  const hostedInspectable = hostedStep.state === "already_inspectable_refresh_before_customer_session";
  const customerInspectable = customerStep.state === "already_inspectable_confirm_hosted_digest";
  const nextStep = hostedInspectable
    ? customerInspectable
      ? goNoGoStep
      : customerStep
    : hostedStep;
  const readinessState = hostedInspectable
    ? customerInspectable
      ? "held_until_hosted_digest_and_go_no_go_confirmation"
      : "ready_to_record_customer_observed_session_and_hosted_digest"
    : "ready_to_record_hosted_rehearsal_evidence";

  return {
    nextStep,
    readinessState,
    rows: [
      {
        command: hostedStep.command,
        id: "attempt_hosted_rehearsal_evidence",
        required_before_next_step:
          "Run only with real protected Preview hosted rehearsal observations.",
        source_preflight_step_id: hostedStep.id,
        state: hostedInspectable
          ? "already_inspectable_regenerate_before_customer_session"
          : "next_real_evidence_command",
        title: "Attempt hosted rehearsal evidence",
      },
      {
        command: REFRESH_AFTER_EVIDENCE_COMMAND,
        id: "regenerate_after_hosted_attempt",
        required_before_next_step:
          "Regenerate ledger, readiness, coordinator, preflight, and attempt readiness after hosted evidence changes.",
        source_preflight_step_id: "refresh_after_hosted_evidence",
        state: hostedInspectable
          ? "required_before_customer_session"
          : "blocked_until_hosted_evidence_attempt_records_proof",
        title: "Regenerate after hosted evidence",
      },
      {
        command: customerStep.command,
        id: "attempt_customer_observed_session_and_hosted_digest",
        required_before_next_step:
          "Run only after the customer-observed session happens and hosted digest proof can be generated.",
        source_preflight_step_id: customerStep.id,
        state: hostedInspectable
          ? customerInspectable
            ? "already_inspectable_confirm_go_no_go_inputs"
            : "next_real_evidence_command"
          : "blocked_until_hosted_evidence_inspectable",
        title: "Attempt customer session and hosted digest",
      },
      {
        command: REFRESH_AFTER_EVIDENCE_COMMAND,
        id: "regenerate_after_customer_attempt",
        required_before_next_step:
          "Regenerate the whole evidence status chain after customer session or hosted digest proof changes.",
        source_preflight_step_id: "refresh_after_customer_evidence",
        state: customerInspectable
          ? "required_before_go_no_go"
          : "blocked_until_customer_evidence_attempt_records_proof",
        title: "Regenerate after customer evidence",
      },
      {
        command: goNoGoStep.command,
        id: "hold_first_gym_go_no_go_until_evidence_inspectable",
        required_before_next_step:
          "Do not run go/no-go until hosted rehearsal, customer session, and hosted digest proof are inspectable.",
        source_preflight_step_id: goNoGoStep.id,
        state: goNoGoStep.state,
        title: "Hold first-gym go/no-go",
      },
    ],
  };
}

function main() {
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH ??
      DEFAULT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH",
    { mustExist: true },
  );
  const attemptReadinessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH ??
      DEFAULT_ATTEMPT_READINESS_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH",
    { mustNotExist: true },
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-protected-preview-evidence-preflight.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH",
    preflightPath.relativePath,
    "Public request first-gym protected Preview evidence preflight",
  );
  const { artifact: preflight, sha256: preflightSha256 } = readJsonArtifact(
    preflightPath.resolved,
    "public request first-gym protected Preview evidence preflight",
  );
  assertFalseFlags(preflight, "Protected Preview evidence preflight");

  const attempt = expectedAttemptSequence(preflight);
  const artifact = {
    artifact_kind: "admin_public_request_first_gym_real_evidence_attempt_readiness",
    status:
      "admin_public_request_first_gym_real_evidence_attempt_readiness_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "admin_public_request_first_gym_protected_preview_evidence_preflight",
    public_request_first_gym_protected_preview_evidence_preflight_path:
      preflightPath.relativePath,
    public_request_first_gym_protected_preview_evidence_preflight_sha256:
      preflightSha256,
    candidate_gym_label: preflight.candidate_gym_label,
    verified_protected_preview_evidence_preflight: {
      path: preflightPath.relativePath,
      preflight_state:
        preflight.protected_preview_evidence_preflight.preflight_state,
      sha256: preflightSha256,
    },
    real_evidence_attempt_readiness: {
      customer_observed_completion_recorded: false,
      first_gym_go_no_go_approval_recorded: false,
      first_gym_operator_run_recorded: false,
      hosted_customer_session_digest_proof_claimed: false,
      hosted_rehearsal_proof_recorded: false,
      limited_beta_review_recorded: false,
      mode: "operator_attempt_readiness_only",
      next_real_command: attempt.nextStep.command,
      next_real_step_id: attempt.nextStep.id,
      public_launch_decision_allowed: false,
      readiness_state: attempt.readinessState,
    },
    operator_input_groups: inputGroups(),
    real_evidence_attempt_sequence: attempt.rows,
    stop_conditions: [
      "Stop if the real protected Preview hosted rehearsal has not happened.",
      "Stop if any required observation cannot honestly be confirmed yes.",
      "Stop if the customer-observed session has not happened with customer visibility.",
      "Stop if hosted customer-session digest proof cannot be generated by the dedicated hosted command.",
      "Stop if any proof artifact path would overwrite inspected evidence.",
      "Stop if any preflight, ledger, readiness, coordinator, or attempt-readiness inspector fails.",
      "Stop if invite delivery, notifications, live providers, billing, POS, access-control, or member-ledger writes are claimed.",
    ],
    blocked_gates: [
      "First-gym go/no-go approval",
      "First-gym operator run",
      "Limited beta operator review",
      "Public owner self-signup",
      "Public request form submission",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email provider activation",
      "Provider ingress/egress",
      "Billing, POS, access control, member-ledger writes",
      "Public launch decision",
    ],
    ...Object.fromEntries(BLOCKED_FLAGS.map((key) => [key, false])),
  };

  assertNoSecretShapedKeys(artifact, "real evidence attempt readiness");
  mkdirSync(dirname(attemptReadinessPath.resolved), { recursive: true });
  writeFileSync(
    attemptReadinessPath.resolved,
    `${JSON.stringify(artifact, null, 2)}\n`,
    { flag: "wx" },
  );

  console.log(
    "Admin public request first-gym real evidence attempt readiness prepared",
  );
  console.log(`Artifact: ${attemptReadinessPath.relativePath}`);
  console.log(`Readiness state: ${attempt.readinessState}`);
  console.log(`Next real step: ${attempt.nextStep.id}`);
}

main();
