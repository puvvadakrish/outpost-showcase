#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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

function expectedExecutionRunLanes(attempt) {
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

function expectedExecutionChecklist(attempt) {
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

function expectedArtifactWritePolicy() {
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

function expectedStopConditions() {
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
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH ??
      DEFAULT_EXECUTION_PACKET_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH",
  );
  const { artifact: packet } = readJsonArtifact(
    packetPath.resolved,
    "public request first-gym real evidence execution packet",
  );

  invariant(
    packet.artifact_kind ===
      "admin_public_request_first_gym_real_evidence_execution_packet",
    "Real evidence execution packet kind mismatch.",
  );
  invariant(
    packet.status ===
      "admin_public_request_first_gym_real_evidence_execution_packet_prepared",
    "Real evidence execution packet status mismatch.",
  );
  invariant(
    packet.evidence_basis ===
      "admin_public_request_first_gym_real_evidence_attempt_readiness",
    "Real evidence execution packet basis mismatch.",
  );

  const attemptPath = normalizeArtifactPath(
    packet.public_request_first_gym_real_evidence_attempt_readiness_path,
    "real evidence attempt readiness path",
  );
  const { artifact: attempt, sha256: attemptSha256 } = readJsonArtifact(
    attemptPath.resolved,
    "public request first-gym real evidence attempt readiness",
  );
  invariant(
    attemptSha256 ===
      packet.public_request_first_gym_real_evidence_attempt_readiness_sha256,
    "Real evidence attempt readiness SHA256 does not match.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-real-evidence-attempt-readiness.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH",
    attemptPath.relativePath,
    "Public request first-gym real evidence attempt readiness",
  );

  const readiness = attempt.real_evidence_attempt_readiness;
  invariant(
    packet.verified_real_evidence_attempt_readiness?.path === attemptPath.relativePath,
    "Verified attempt-readiness path mismatch.",
  );
  invariant(
    packet.verified_real_evidence_attempt_readiness?.sha256 === attemptSha256,
    "Verified attempt-readiness SHA mismatch.",
  );
  invariant(
    packet.verified_real_evidence_attempt_readiness?.readiness_state ===
      readiness.readiness_state,
    "Verified attempt-readiness state mismatch.",
  );
  invariant(
    packet.verified_real_evidence_attempt_readiness?.next_real_command ===
      readiness.next_real_command,
    "Verified attempt-readiness command mismatch.",
  );
  invariant(
    packet.verified_real_evidence_attempt_readiness?.next_real_step_id ===
      readiness.next_real_step_id,
    "Verified attempt-readiness step mismatch.",
  );

  const control = packet.real_evidence_execution_packet;
  invariant(
    control?.mode === "operator_execution_packet_only",
    "Real evidence execution packet must remain operator-only.",
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
    invariant(control[key] === false, `Real evidence execution packet ${message}.`);
  }
  invariant(
    control.readiness_state === readiness.readiness_state,
    "Real evidence execution packet state mismatch.",
  );
  invariant(
    control.next_real_command === readiness.next_real_command,
    "Real evidence execution packet next command mismatch.",
  );
  invariant(
    control.next_real_step_id === readiness.next_real_step_id,
    "Real evidence execution packet next step mismatch.",
  );

  invariant(
    JSON.stringify(packet.execution_run_lanes) ===
      JSON.stringify(expectedExecutionRunLanes(attempt)),
    "Real evidence execution lanes mismatch.",
  );
  invariant(
    JSON.stringify(packet.execution_checklist) ===
      JSON.stringify(expectedExecutionChecklist(attempt)),
    "Real evidence execution checklist mismatch.",
  );
  invariant(
    JSON.stringify(packet.artifact_write_policy) ===
      JSON.stringify(expectedArtifactWritePolicy()),
    "Real evidence execution artifact write policy mismatch.",
  );
  invariant(
    JSON.stringify(packet.stop_conditions) ===
      JSON.stringify(expectedStopConditions()),
    "Real evidence execution stop conditions mismatch.",
  );
  invariant(
    JSON.stringify(packet.blocked_gates) === JSON.stringify(attempt.blocked_gates),
    "Real evidence execution blocked gates mismatch.",
  );
  assertFalseFlags(attempt, "Real evidence attempt readiness");
  assertFalseFlags(packet, "Real evidence execution packet");

  console.log(
    "Admin public request first-gym real evidence execution packet inspection passed",
  );
}

main();
