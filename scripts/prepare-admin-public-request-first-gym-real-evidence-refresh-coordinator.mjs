#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_GUARD_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-real-evidence-execution-guard.json";
const DEFAULT_COORDINATOR_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-real-evidence-refresh-coordinator.json";

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

const CONTROL_FALSE_FLAGS = [
  "real_evidence_command_executed",
  "hosted_rehearsal_proof_recorded",
  "customer_observed_completion_recorded",
  "hosted_customer_session_digest_proof_claimed",
  "first_gym_go_no_go_approval_recorded",
  "first_gym_operator_run_recorded",
  "limited_beta_review_recorded",
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

function manualProofCommand(control) {
  if (control.next_real_step_id === "record_customer_observed_session_and_hosted_digest") {
    return "npm run admin:customer-session:record && npm run admin:customer-session:inspect";
  }
  return control.next_real_command;
}

function postManualVerificationCommands(nextStepId) {
  if (nextStepId === "record_hosted_rehearsal_evidence") {
    return [
      {
        command: "npm run admin:public-request-hosted-rehearsal:evidence:inspect",
        id: "inspect_hosted_rehearsal_evidence",
        order: 1,
        requirement:
          "Hosted rehearsal evidence must inspect before refreshing control artifacts.",
        state: "required_after_manual_command",
      },
    ];
  }
  if (nextStepId === "record_customer_observed_session_and_hosted_digest") {
    return [
      {
        command:
          "npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
        id: "verify_hosted_customer_session_digest",
        order: 1,
        requirement:
          "Hosted customer-session digest proof must complete once before refreshing control artifacts.",
        state: "required_after_customer_session_inspects",
      },
    ];
  }
  return [];
}

function refreshSequence() {
  return [
    {
      command:
        "npm run admin:public-request-first-gym:proof-session-runbook && npm run admin:public-request-first-gym:proof-session-runbook:inspect",
      id: "refresh_proof_session_runbook",
      order: 1,
      state: "required_after_proof_inspects",
      title: "Refresh proof session runbook",
    },
    {
      command:
        "npm run admin:public-request-first-gym:proof-session-execution-pack && npm run admin:public-request-first-gym:proof-session-execution-pack:inspect",
      id: "refresh_proof_session_execution_pack",
      order: 2,
      state: "required_after_runbook_inspects",
      title: "Refresh proof session execution pack",
    },
    {
      command:
        "npm run admin:public-request-first-gym:proof-session-progress && npm run admin:public-request-first-gym:proof-session-progress:inspect",
      id: "refresh_proof_session_progress",
      order: 3,
      state: "required_after_execution_pack_inspects",
      title: "Refresh proof session progress",
    },
    {
      command:
        "npm run admin:public-request-first-gym:proof-session-resume && npm run admin:public-request-first-gym:proof-session-resume:inspect",
      id: "refresh_proof_session_resume",
      order: 4,
      state: "required_after_progress_inspects",
      title: "Refresh proof session resume",
    },
    {
      command:
        "npm run admin:public-request-first-gym:proof-session-diagnostics && npm run admin:public-request-first-gym:proof-session-diagnostics:inspect",
      id: "refresh_proof_session_diagnostics",
      order: 5,
      state: "required_after_resume_inspects",
      title: "Refresh proof session diagnostics",
    },
    {
      command:
        "npm run admin:public-request-first-gym:proof-session-followup-preflight && npm run admin:public-request-first-gym:proof-session-followup-preflight:inspect",
      id: "refresh_proof_session_followup_preflight",
      order: 6,
      state: "required_after_diagnostics_inspects",
      title: "Refresh proof session follow-up preflight",
    },
    {
      command:
        "npm run admin:public-request-first-gym:proof-session-launch-checkpoint && npm run admin:public-request-first-gym:proof-session-launch-checkpoint:inspect",
      id: "refresh_proof_session_launch_checkpoint",
      order: 7,
      state: "required_after_followup_preflight_inspects",
      title: "Refresh proof session launch checkpoint",
    },
    {
      command:
        "npm run admin:public-request-first-gym:proof-command-execution-envelope && npm run admin:public-request-first-gym:proof-command-execution-envelope:inspect",
      id: "refresh_proof_command_execution_envelope",
      order: 8,
      state: "required_after_launch_checkpoint_inspects",
      title: "Refresh proof command execution envelope",
    },
    {
      command:
        "npm run admin:public-request-first-gym:proof-evidence-intake-manifest && npm run admin:public-request-first-gym:proof-evidence-intake-manifest:inspect",
      id: "refresh_proof_evidence_intake_manifest",
      order: 9,
      state: "required_after_execution_envelope_inspects",
      title: "Refresh proof evidence intake manifest",
    },
    {
      command:
        "npm run admin:public-request-first-gym:proof-evidence-session-handoff && npm run admin:public-request-first-gym:proof-evidence-session-handoff:inspect",
      id: "refresh_proof_evidence_session_handoff",
      order: 10,
      state: "required_after_intake_manifest_inspects",
      title: "Refresh proof evidence session handoff",
    },
    {
      command:
        "npm run admin:public-request-first-gym:proof-evidence-session-ledger && npm run admin:public-request-first-gym:proof-evidence-session-ledger:inspect",
      id: "refresh_proof_evidence_session_ledger",
      order: 11,
      state: "required_after_handoff_inspects",
      title: "Refresh proof evidence session ledger",
    },
    {
      command:
        "npm run admin:public-request-first-gym:evidence-execution-readiness && npm run admin:public-request-first-gym:evidence-execution-readiness:inspect",
      id: "refresh_evidence_execution_readiness",
      order: 12,
      state: "required_after_ledger_inspects",
      title: "Refresh evidence execution readiness",
    },
    {
      command:
        "npm run admin:public-request-first-gym:evidence-run-coordinator && npm run admin:public-request-first-gym:evidence-run-coordinator:inspect",
      id: "refresh_evidence_run_coordinator",
      order: 13,
      state: "required_after_readiness_inspects",
      title: "Refresh evidence run coordinator",
    },
    {
      command:
        "npm run admin:public-request-first-gym:protected-preview-evidence-preflight && npm run admin:public-request-first-gym:protected-preview-evidence-preflight:inspect",
      id: "refresh_protected_preview_evidence_preflight",
      order: 14,
      state: "required_after_coordinator_inspects",
      title: "Refresh protected Preview evidence preflight",
    },
    {
      command:
        "npm run admin:public-request-first-gym:real-evidence-attempt-readiness && npm run admin:public-request-first-gym:real-evidence-attempt-readiness:inspect",
      id: "refresh_real_evidence_attempt_readiness",
      order: 15,
      state: "required_after_preflight_inspects",
      title: "Refresh real evidence attempt readiness",
    },
    {
      command:
        "npm run admin:public-request-first-gym:real-evidence-execution-packet && npm run admin:public-request-first-gym:real-evidence-execution-packet:inspect",
      id: "refresh_real_evidence_execution_packet",
      order: 16,
      state: "required_after_attempt_readiness_inspects",
      title: "Refresh real evidence execution packet",
    },
    {
      command:
        "npm run admin:public-request-first-gym:real-evidence-execution-guard && npm run admin:public-request-first-gym:real-evidence-execution-guard:inspect",
      id: "refresh_real_evidence_execution_guard",
      order: 17,
      state: "required_after_execution_packet_inspects",
      title: "Refresh real evidence execution guard",
    },
    {
      command:
        "npm run admin:public-request-first-gym:real-evidence-refresh-coordinator && npm run admin:public-request-first-gym:real-evidence-refresh-coordinator:inspect",
      id: "refresh_real_evidence_refresh_coordinator",
      order: 18,
      state: "required_after_execution_guard_inspects",
      title: "Refresh this real evidence refresh coordinator",
    },
  ];
}

function stopConditions() {
  return [
    "Stop if the real evidence execution guard inspector fails.",
    "Stop if guard_state is not ready_to_run_next_real_command.",
    "Stop if the manual proof command cannot be run immediately with real observations.",
    "Stop if any post-manual verification command fails after the manual command.",
    "Stop if any refresh command fails after proof inspection.",
    "Stop if invite delivery, notifications, live providers, billing, POS, access-control, or member-ledger writes are requested.",
  ];
}

function main() {
  const guardPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH ??
      DEFAULT_GUARD_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH",
    { mustExist: true },
  );
  const coordinatorPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH ??
      DEFAULT_COORDINATOR_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH",
    { mustNotExist: true },
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-guard.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH",
    guardPath.relativePath,
    "Public request first-gym real evidence execution guard",
  );
  const { artifact: guard, sha256: guardSha256 } = readJsonArtifact(
    guardPath.resolved,
    "public request first-gym real evidence execution guard",
  );
  assertFalseFlags(guard, "Real evidence execution guard");

  const control = guard.real_evidence_execution_guard;
  const ready = control.guard_state === "ready_to_run_next_real_command";
  const manualCommand = manualProofCommand(control);
  const verificationCommands = postManualVerificationCommands(control.next_real_step_id);
  invariant(
    verificationCommands.length > 0,
    "Refresh coordinator post-manual verification commands missing.",
  );

  const artifact = {
    artifact_kind:
      "admin_public_request_first_gym_real_evidence_refresh_coordinator",
    status:
      "admin_public_request_first_gym_real_evidence_refresh_coordinator_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "admin_public_request_first_gym_real_evidence_execution_guard",
    public_request_first_gym_real_evidence_execution_guard_path:
      guardPath.relativePath,
    public_request_first_gym_real_evidence_execution_guard_sha256:
      guardSha256,
    verified_real_evidence_execution_guard: {
      guard_state: control.guard_state,
      next_real_command: control.next_real_command,
      next_real_step_id: control.next_real_step_id,
      output_path_state: guard.evidence_output_policy.output_path_state,
      path: guardPath.relativePath,
      sha256: guardSha256,
    },
    real_evidence_refresh_coordinator: {
      ...Object.fromEntries(CONTROL_FALSE_FLAGS.map((key) => [key, false])),
      guard_state: control.guard_state,
      mode: "operator_refresh_coordinator_only",
      next_real_command: manualCommand,
      next_real_step_id: control.next_real_step_id,
      ready_to_run_manual_command: ready,
      ready_to_refresh_after_proof: false,
    },
    manual_proof_command: {
      command: manualCommand,
      requirement:
        "Run manually only when guard_state is ready_to_run_next_real_command and real observations were just confirmed.",
      state: ready ? "ready_for_manual_operator_run" : "blocked_until_guard_ready",
    },
    post_manual_verification_commands: verificationCommands,
    post_evidence_refresh_sequence: refreshSequence(),
    refresh_coordinator_guard: {
      allowed_next_action: ready
        ? "Run the manual proof command, run every post-manual verification command once, then run the refresh sequence in order."
        : "Do not run proof. Fix the execution guard blockers, regenerate this coordinator, and inspect again.",
      state: ready ? "ready_for_manual_proof_then_refresh" : "blocked",
    },
    stop_conditions: stopConditions(),
    blocked_gates: guard.blocked_gates,
    ...Object.fromEntries(BLOCKED_FLAGS.map((key) => [key, false])),
  };

  assertNoSecretShapedKeys(artifact, "real evidence refresh coordinator");
  mkdirSync(dirname(coordinatorPath.resolved), { recursive: true });
  writeFileSync(coordinatorPath.resolved, `${JSON.stringify(artifact, null, 2)}\n`, {
    flag: "wx",
  });
  console.log("Admin public request first-gym real evidence refresh coordinator prepared");
  console.log(`Artifact: ${coordinatorPath.relativePath}`);
  console.log(`State: ${artifact.refresh_coordinator_guard.state}`);
  console.log(`Next real step: ${control.next_real_step_id}`);
}

main();
