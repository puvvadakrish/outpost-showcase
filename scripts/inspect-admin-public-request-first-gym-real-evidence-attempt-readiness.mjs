#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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

function expectedInputGroups() {
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

function sequenceById(sequence, id) {
  const step = sequence.find((entry) => entry.id === id);
  invariant(step, `Preflight sequence missing ${id}.`);
  return step;
}

function expectedAttemptSequence(preflight) {
  const sequence = preflight.evidence_capture_sequence ?? [];
  const hostedStep = sequenceById(sequence, "record_hosted_rehearsal_evidence");
  const customerStep = sequenceById(
    sequence,
    "record_customer_observed_session_and_hosted_digest",
  );
  const goNoGoStep = sequenceById(sequence, "hold_first_gym_go_no_go");
  const hostedInspectable =
    hostedStep.state === "already_inspectable_refresh_before_customer_session";
  const customerInspectable =
    customerStep.state === "already_inspectable_confirm_hosted_digest";
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

function expectedStopConditions() {
  return [
    "Stop if the real protected Preview hosted rehearsal has not happened.",
    "Stop if any required observation cannot honestly be confirmed yes.",
    "Stop if the customer-observed session has not happened with customer visibility.",
    "Stop if hosted customer-session digest proof cannot be generated by the dedicated hosted command.",
    "Stop if any proof artifact path would overwrite inspected evidence.",
    "Stop if any preflight, ledger, readiness, coordinator, or attempt-readiness inspector fails.",
    "Stop if invite delivery, notifications, live providers, billing, POS, access-control, or member-ledger writes are claimed.",
  ];
}

function main() {
  const attemptPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH ??
      DEFAULT_ATTEMPT_READINESS_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH",
  );
  const { artifact: attempt } = readJsonArtifact(
    attemptPath.resolved,
    "public request first-gym real evidence attempt readiness",
  );

  invariant(
    attempt.artifact_kind ===
      "admin_public_request_first_gym_real_evidence_attempt_readiness",
    "Real evidence attempt readiness kind mismatch.",
  );
  invariant(
    attempt.status ===
      "admin_public_request_first_gym_real_evidence_attempt_readiness_prepared",
    "Real evidence attempt readiness status mismatch.",
  );
  invariant(
    attempt.evidence_basis ===
      "admin_public_request_first_gym_protected_preview_evidence_preflight",
    "Real evidence attempt readiness basis mismatch.",
  );

  const preflightPath = normalizeArtifactPath(
    attempt.public_request_first_gym_protected_preview_evidence_preflight_path,
    "protected Preview evidence preflight path",
  );
  const { artifact: preflight, sha256: preflightSha256 } = readJsonArtifact(
    preflightPath.resolved,
    "public request first-gym protected Preview evidence preflight",
  );
  invariant(
    preflightSha256 ===
      attempt.public_request_first_gym_protected_preview_evidence_preflight_sha256,
    "Protected Preview evidence preflight SHA256 does not match.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-protected-preview-evidence-preflight.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH",
    preflightPath.relativePath,
    "Public request first-gym protected Preview evidence preflight",
  );

  invariant(
    attempt.verified_protected_preview_evidence_preflight?.path ===
      preflightPath.relativePath,
    "Verified protected Preview preflight path mismatch.",
  );
  invariant(
    attempt.verified_protected_preview_evidence_preflight?.sha256 ===
      preflightSha256,
    "Verified protected Preview preflight SHA mismatch.",
  );
  invariant(
    attempt.verified_protected_preview_evidence_preflight?.preflight_state ===
      preflight.protected_preview_evidence_preflight.preflight_state,
    "Verified protected Preview preflight state mismatch.",
  );

  const expected = expectedAttemptSequence(preflight);
  const control = attempt.real_evidence_attempt_readiness;
  invariant(
    control?.mode === "operator_attempt_readiness_only",
    "Real evidence attempt readiness must remain operator-only.",
  );
  for (const [key, message] of [
    ["hosted_rehearsal_proof_recorded", "cannot record hosted rehearsal proof"],
    ["customer_observed_completion_recorded", "cannot record customer completion"],
    ["hosted_customer_session_digest_proof_claimed", "cannot claim hosted digest proof"],
    ["first_gym_go_no_go_approval_recorded", "cannot record go/no-go approval"],
    ["first_gym_operator_run_recorded", "cannot record first-gym run"],
    ["limited_beta_review_recorded", "cannot record limited beta review"],
    ["public_launch_decision_allowed", "cannot allow public launch decision"],
  ]) {
    invariant(control[key] === false, `Real evidence attempt readiness ${message}.`);
  }
  invariant(
    control.readiness_state === expected.readinessState,
    "Real evidence attempt readiness state mismatch.",
  );
  invariant(
    control.next_real_command === expected.nextStep.command,
    "Real evidence attempt next command mismatch.",
  );
  invariant(
    control.next_real_step_id === expected.nextStep.id,
    "Real evidence attempt next step mismatch.",
  );

  invariant(
    JSON.stringify(attempt.operator_input_groups) ===
      JSON.stringify(expectedInputGroups()),
    "Operator input groups mismatch.",
  );
  invariant(
    JSON.stringify(attempt.real_evidence_attempt_sequence) ===
      JSON.stringify(expected.rows),
    "Real evidence attempt sequence mismatch.",
  );
  invariant(
    JSON.stringify(attempt.stop_conditions) ===
      JSON.stringify(expectedStopConditions()),
    "Real evidence attempt stop conditions mismatch.",
  );
  invariant(
    attempt.blocked_gates.includes("Phone/email provider activation"),
    "Blocked gates must include phone/email provider activation.",
  );
  invariant(
    attempt.blocked_gates.includes(
      "Billing, POS, access control, member-ledger writes",
    ),
    "Blocked gates must include revenue/member-system writes.",
  );
  assertFalseFlags(preflight, "Protected Preview evidence preflight");
  assertFalseFlags(attempt, "Real evidence attempt readiness");

  console.log(
    "Admin public request first-gym real evidence attempt readiness inspection passed",
  );
}

main();
