#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_ATTEMPT_READINESS_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-real-evidence-attempt-readiness.json";
const DEFAULT_EXECUTION_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-real-evidence-execution-packet.json";

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

function executionRunLanes(attempt) {
  const groups = new Map(
    (attempt.operator_input_groups ?? []).map((group) => [group.id, group]),
  );
  const sequence = new Map(
    (attempt.real_evidence_attempt_sequence ?? []).map((step) => [step.id, step]),
  );
  const hostedGroup = groups.get("hosted_rehearsal_real_observations");
  const customerGroup = groups.get("customer_observed_session_real_observations");
  const digestGroup = groups.get("hosted_customer_session_digest_inputs");
  const hostedStep = sequence.get("attempt_hosted_rehearsal_evidence");
  const customerStep = sequence.get("attempt_customer_observed_session_and_hosted_digest");
  const refreshAfterHosted = sequence.get("regenerate_after_hosted_attempt");
  const refreshAfterCustomer = sequence.get("regenerate_after_customer_attempt");
  invariant(hostedGroup && customerGroup && digestGroup, "Attempt readiness input groups missing.");
  invariant(
    hostedStep && customerStep && refreshAfterHosted && refreshAfterCustomer,
    "Attempt readiness sequence rows missing.",
  );
  return [
    {
      command: hostedStep.command,
      id: "hosted_rehearsal_evidence_lane",
      required_inputs: hostedGroup.required_before_command,
      source_attempt_step_id: hostedStep.id,
      state: hostedStep.state === "next_real_evidence_command" ? "next" : "blocked_or_done",
      title: "Hosted rehearsal evidence lane",
    },
    {
      command: refreshAfterHosted.command,
      id: "refresh_after_hosted_lane",
      required_inputs: [
        "Hosted rehearsal evidence artifact must inspect before refresh.",
        "Do not edit existing proof artifacts in place; create a replacement path when rerunning proof writers.",
      ],
      source_attempt_step_id: refreshAfterHosted.id,
      state: refreshAfterHosted.state,
      title: "Refresh after hosted evidence lane",
    },
    {
      command: customerStep.command,
      id: "customer_session_and_digest_lane",
      required_inputs: [
        ...customerGroup.required_before_command,
        ...digestGroup.required_before_command,
      ],
      source_attempt_step_id: customerStep.id,
      state: customerStep.state === "next_real_evidence_command" ? "next" : "blocked_or_done",
      title: "Customer session and hosted digest lane",
    },
    {
      command: refreshAfterCustomer.command,
      id: "refresh_after_customer_lane",
      required_inputs: [
        "Customer-observed session record and hosted digest proof must inspect before refresh.",
        "Regenerate every status/control artifact before go/no-go preparation.",
      ],
      source_attempt_step_id: refreshAfterCustomer.id,
      state: refreshAfterCustomer.state,
      title: "Refresh after customer evidence lane",
    },
  ];
}

function executionChecklist(attempt) {
  return [
    {
      command:
        "npm run admin:public-request-first-gym:real-evidence-attempt-readiness:inspect",
      id: "inspect_attempt_readiness",
      requirement:
        "Start only from an inspected attempt-readiness artifact with a fresh parent SHA.",
      state: "required",
    },
    {
      command: attempt.real_evidence_attempt_readiness.next_real_command,
      id: "run_next_real_command",
      requirement:
        "Run the next real command only when every listed real observation or hosted digest input is available.",
      state: "blocked_until_operator_confirms_real_inputs",
    },
    {
      command:
        "Run the dedicated inspector paired with the proof writer that was just executed.",
      id: "inspect_new_evidence",
      requirement:
        "The new proof artifact must inspect before any readiness regeneration.",
      state: "blocked_until_real_command_runs",
    },
    {
      command:
        "npm run admin:public-request-first-gym:proof-evidence-session-ledger && npm run admin:public-request-first-gym:proof-evidence-session-ledger:inspect && npm run admin:public-request-first-gym:evidence-execution-readiness && npm run admin:public-request-first-gym:evidence-execution-readiness:inspect && npm run admin:public-request-first-gym:evidence-run-coordinator && npm run admin:public-request-first-gym:evidence-run-coordinator:inspect && npm run admin:public-request-first-gym:protected-preview-evidence-preflight && npm run admin:public-request-first-gym:protected-preview-evidence-preflight:inspect && npm run admin:public-request-first-gym:real-evidence-attempt-readiness && npm run admin:public-request-first-gym:real-evidence-attempt-readiness:inspect && npm run admin:public-request-first-gym:real-evidence-execution-packet && npm run admin:public-request-first-gym:real-evidence-execution-packet:inspect",
      id: "regenerate_full_chain",
      requirement:
        "Regenerate the whole evidence status chain after every hosted/customer evidence change.",
      state: "required_after_any_evidence_change",
    },
  ];
}

function artifactWritePolicy() {
  return [
    {
      id: "create_only_evidence_artifacts",
      requirement:
        "Dedicated proof writers use create-only artifact paths; if rerunning, choose a new output path instead of overwriting inspected evidence.",
    },
    {
      id: "no_secret_storage",
      requirement:
        "Do not store cookies, tokens, Neon credentials, provider credentials, or private customer notes in artifacts.",
    },
    {
      id: "no_observation_values_in_packet",
      requirement:
        "This execution packet stores input names and commands only; real observation values belong only in dedicated proof artifacts created during the session.",
    },
  ];
}

function stopConditions() {
  return [
    "Stop if the attempt-readiness inspector fails.",
    "Stop if any required real observation cannot honestly be confirmed.",
    "Stop if a proof writer would overwrite an existing inspected artifact.",
    "Stop if the dedicated proof inspector fails after a real evidence command.",
    "Stop if the full regeneration chain fails after evidence changes.",
    "Stop if invite delivery, notifications, live providers, billing, POS, access-control, or member-ledger writes are requested.",
  ];
}

function main() {
  const attemptPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH ??
      DEFAULT_ATTEMPT_READINESS_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH",
    { mustExist: true },
  );
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH ??
      DEFAULT_EXECUTION_PACKET_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH",
    { mustNotExist: true },
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-real-evidence-attempt-readiness.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH",
    attemptPath.relativePath,
    "Public request first-gym real evidence attempt readiness",
  );
  const { artifact: attempt, sha256: attemptSha256 } = readJsonArtifact(
    attemptPath.resolved,
    "public request first-gym real evidence attempt readiness",
  );
  assertFalseFlags(attempt, "Real evidence attempt readiness");

  const readiness = attempt.real_evidence_attempt_readiness;
  const artifact = {
    artifact_kind: "admin_public_request_first_gym_real_evidence_execution_packet",
    status: "admin_public_request_first_gym_real_evidence_execution_packet_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "admin_public_request_first_gym_real_evidence_attempt_readiness",
    public_request_first_gym_real_evidence_attempt_readiness_path:
      attemptPath.relativePath,
    public_request_first_gym_real_evidence_attempt_readiness_sha256:
      attemptSha256,
    candidate_gym_label: attempt.candidate_gym_label,
    verified_real_evidence_attempt_readiness: {
      next_real_command: readiness.next_real_command,
      next_real_step_id: readiness.next_real_step_id,
      path: attemptPath.relativePath,
      readiness_state: readiness.readiness_state,
      sha256: attemptSha256,
    },
    real_evidence_execution_packet: {
      customer_observed_completion_recorded: false,
      first_gym_go_no_go_approval_recorded: false,
      first_gym_operator_run_recorded: false,
      hosted_customer_session_digest_proof_claimed: false,
      hosted_rehearsal_proof_recorded: false,
      limited_beta_review_recorded: false,
      mode: "operator_execution_packet_only",
      next_real_command: readiness.next_real_command,
      next_real_step_id: readiness.next_real_step_id,
      public_launch_decision_allowed: false,
      readiness_state: readiness.readiness_state,
    },
    execution_run_lanes: executionRunLanes(attempt),
    execution_checklist: executionChecklist(attempt),
    artifact_write_policy: artifactWritePolicy(),
    stop_conditions: stopConditions(),
    blocked_gates: attempt.blocked_gates,
    ...Object.fromEntries(BLOCKED_FLAGS.map((key) => [key, false])),
  };

  assertNoSecretShapedKeys(artifact, "real evidence execution packet");
  mkdirSync(dirname(packetPath.resolved), { recursive: true });
  writeFileSync(packetPath.resolved, `${JSON.stringify(artifact, null, 2)}\n`, {
    flag: "wx",
  });

  console.log("Admin public request first-gym real evidence execution packet prepared");
  console.log(`Artifact: ${packetPath.relativePath}`);
  console.log(`Readiness state: ${readiness.readiness_state}`);
  console.log(`Next real step: ${readiness.next_real_step_id}`);
}

main();
