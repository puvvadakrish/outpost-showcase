#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_READINESS_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-evidence-execution-readiness.json";
const DEFAULT_COORDINATOR_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-evidence-run-coordinator.json";

const REGENERATE_SESSION_LEDGER_AND_READINESS_COMMAND =
  "npm run admin:public-request-first-gym:proof-evidence-session-ledger && npm run admin:public-request-first-gym:proof-evidence-session-ledger:inspect && npm run admin:public-request-first-gym:evidence-execution-readiness && npm run admin:public-request-first-gym:evidence-execution-readiness:inspect";

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

function expectedRunLanes(readiness) {
  const execution = readiness.evidence_execution_readiness;
  const hostedInspectable =
    execution.hosted_rehearsal_evidence_state === "inspectable";
  const customerInspectable =
    execution.customer_observed_session_state === "inspectable";
  const evidenceReady = execution.go_no_go_allowed_by_evidence === true;

  return [
    {
      command:
        "npm run admin:public-request-hosted-rehearsal:evidence && npm run admin:public-request-hosted-rehearsal:evidence:inspect",
      id: "hosted_rehearsal_evidence_lane",
      regenerate_after_command: REGENERATE_SESSION_LEDGER_AND_READINESS_COMMAND,
      state: hostedInspectable
        ? "inspectable_regenerate_before_customer_session"
        : "blocked_on_protected_preview_hosted_rehearsal",
      title: "Record protected Preview hosted rehearsal evidence",
    },
    {
      command:
        "npm run admin:customer-session:record && npm run admin:customer-session:inspect && npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
      id: "customer_observed_session_and_hosted_digest_lane",
      regenerate_after_command: REGENERATE_SESSION_LEDGER_AND_READINESS_COMMAND,
      state: customerInspectable
        ? "inspectable_requires_hosted_digest_confirmation"
        : "blocked_on_customer_observed_session",
      title: "Record customer-observed session and hosted digest proof",
    },
    {
      command: REGENERATE_SESSION_LEDGER_AND_READINESS_COMMAND,
      id: "session_ledger_and_readiness_regeneration_lane",
      regenerate_after_command: REGENERATE_SESSION_LEDGER_AND_READINESS_COMMAND,
      state: "required_after_each_evidence_change",
      title: "Regenerate session ledger and evidence execution readiness",
    },
    {
      command:
        "npm run admin:public-request-first-gym:go-no-go:bundle && npm run admin:public-request-first-gym:go-no-go:bundle:inspect",
      id: "first_gym_go_no_go_bundle_lane",
      regenerate_after_command: REGENERATE_SESSION_LEDGER_AND_READINESS_COMMAND,
      state: evidenceReady
        ? "ready_after_hosted_digest_confirmation"
        : "blocked_until_hosted_and_customer_evidence_inspectable",
      title: "Prepare first-gym go/no-go bundle",
    },
    {
      command:
        "npm run admin:public-request-first-gym:run && npm run admin:public-request-first-gym:run:inspect",
      id: "first_gym_operator_run_lane",
      regenerate_after_command: REGENERATE_SESSION_LEDGER_AND_READINESS_COMMAND,
      state: "blocked_until_go_no_go_bundle_inspectable",
      title: "Record first-gym operator run",
    },
    {
      command:
        "npm run admin:public-request:limited-beta:operator-review && npm run admin:public-request:limited-beta:operator-review:inspect",
      id: "limited_beta_operator_review_lane",
      regenerate_after_command: REGENERATE_SESSION_LEDGER_AND_READINESS_COMMAND,
      state: "blocked_until_first_gym_run_inspectable",
      title: "Prepare limited beta operator review",
    },
    {
      command:
        "npm run admin:public-request:self-serve:launch-preflight && npm run admin:public-request:self-serve:launch-preflight:inspect",
      id: "public_self_serve_launch_preflight_lane",
      regenerate_after_command: REGENERATE_SESSION_LEDGER_AND_READINESS_COMMAND,
      state: "blocked_until_limited_beta_review_inspectable",
      title: "Keep public self-serve launch preflight separate",
    },
  ];
}

function main() {
  const readinessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH ??
      DEFAULT_READINESS_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH",
    { mustExist: true },
  );
  const coordinatorPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH ??
      DEFAULT_COORDINATOR_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH",
    { mustNotExist: true },
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-evidence-execution-readiness.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH",
    readinessPath.relativePath,
    "Public request first-gym evidence execution readiness",
  );
  const { artifact: readiness, sha256: readinessSha256 } = readJsonArtifact(
    readinessPath.resolved,
    "public request first-gym evidence execution readiness",
  );
  assertFalseFlags(readiness, "Evidence execution readiness");

  const execution = readiness.evidence_execution_readiness;
  const coordinator = {
    artifact_kind: "admin_public_request_first_gym_evidence_run_coordinator",
    status: "admin_public_request_first_gym_evidence_run_coordinator_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "admin_public_request_first_gym_evidence_execution_readiness",
    public_request_first_gym_evidence_execution_readiness_path:
      readinessPath.relativePath,
    public_request_first_gym_evidence_execution_readiness_sha256:
      readinessSha256,
    verified_evidence_execution_readiness: {
      go_no_go_allowed_by_evidence: execution.go_no_go_allowed_by_evidence,
      hosted_rehearsal_evidence_state:
        execution.hosted_rehearsal_evidence_state,
      customer_observed_session_state:
        execution.customer_observed_session_state,
      next_missing_step_id: execution.next_missing_step_id,
      path: readinessPath.relativePath,
      sha256: readinessSha256,
    },
    evidence_run_coordinator: {
      coordinator_state: execution.go_no_go_allowed_by_evidence
        ? "ready_for_hosted_digest_confirmation_before_go_no_go"
        : "blocked_on_real_hosted_or_customer_evidence",
      first_gym_go_no_go_approval_recorded: false,
      first_gym_operator_run_recorded: false,
      go_no_go_allowed_by_evidence: execution.go_no_go_allowed_by_evidence,
      hosted_customer_session_digest_proof_claimed: false,
      hosted_rehearsal_evidence_state:
        execution.hosted_rehearsal_evidence_state,
      customer_observed_session_state:
        execution.customer_observed_session_state,
      limited_beta_review_recorded: false,
      mode: "operator_run_coordinator_only",
      next_missing_step_id: execution.next_missing_step_id,
      public_launch_decision_allowed: false,
    },
    run_lanes: expectedRunLanes(readiness),
    operator_stop_conditions: [
      "Stop if hosted rehearsal evidence is not produced by the dedicated protected Preview evidence command.",
      "Stop if customer-observed session evidence was not observed with the customer present.",
      "Stop if hosted customer-session digest proof is missing before first-gym go/no-go.",
      "Stop if unexpected tenant data, invite delivery, live-provider claims, billing, POS, access-control, or member-ledger writes appear.",
      "Stop if any regenerated ledger or readiness artifact fails inspection.",
    ],
    regeneration_sequence: [
      "npm run admin:public-request-first-gym:proof-evidence-session-ledger",
      "npm run admin:public-request-first-gym:proof-evidence-session-ledger:inspect",
      "npm run admin:public-request-first-gym:evidence-execution-readiness",
      "npm run admin:public-request-first-gym:evidence-execution-readiness:inspect",
      "npm run admin:public-request-first-gym:evidence-run-coordinator",
      "npm run admin:public-request-first-gym:evidence-run-coordinator:inspect",
    ],
    blocked_gates: [
      "Public owner self-signup",
      "Public request form submission",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email provider activation",
      "Live provider enablement",
      "Billing, POS, access control, member-ledger writes",
      "Public launch decision",
    ],
  };

  for (const key of BLOCKED_FLAGS) coordinator[key] = false;
  assertNoSecretShapedKeys(
    coordinator,
    "public request first-gym evidence run coordinator",
  );
  mkdirSync(dirname(coordinatorPath.resolved), { recursive: true });
  writeFileSync(
    coordinatorPath.resolved,
    `${JSON.stringify(coordinator, null, 2)}\n`,
    { flag: "wx" },
  );

  console.log("Admin public request first-gym evidence run coordinator prepared");
  console.log(`Artifact: ${coordinatorPath.relativePath}`);
  console.log(
    `Coordinator state: ${coordinator.evidence_run_coordinator.coordinator_state}`,
  );
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
