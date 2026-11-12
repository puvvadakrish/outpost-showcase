#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-missing-proof-packet.json";
const DEFAULT_GATE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-completion-gate.json";
const DEFAULT_RUNBOOK_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-runbook.json";

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

const STOP_CONDITIONS = [
  "Stop if the owner is not present for any customer-observed step.",
  "Stop if the protected Preview, owner workspace, staff workboard, or reset/rollback checklist cannot be shown.",
  "Stop if unexpected tenant data appears.",
  "Stop if any screen implies invite delivery, live provider activation, billing, POS, access-control, or member-ledger writes.",
  "Do not record customer-observed completion unless the dedicated proof command succeeds and inspects cleanly.",
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
    value.forEach((entry, index) =>
      assertNoSecretShapedKeys(entry, label, [...trail, String(index)]),
    );
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

function main() {
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH ??
      DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH",
    { mustExist: true },
  );
  const gatePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH ??
      DEFAULT_GATE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH",
    { mustExist: true },
  );
  const runbookPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH ??
      DEFAULT_RUNBOOK_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH",
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-missing-proof-packet.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH",
    packetPath.relativePath,
    "Public request first-gym missing proof packet",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-completion-gate.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH",
    gatePath.relativePath,
    "Public request first-gym completion gate",
  );

  const { artifact: packet, sha256: packetSha256 } = readJsonArtifact(
    packetPath.resolved,
    "public request first-gym missing proof packet",
  );
  const { artifact: gate, sha256: gateSha256 } = readJsonArtifact(
    gatePath.resolved,
    "public request first-gym completion gate",
  );
  const ledgerPath = normalizeArtifactPath(
    packet.public_request_first_gym_execution_ledger_path,
    "public request first-gym execution ledger path",
    { mustExist: true },
  );
  const { artifact: ledger, sha256: ledgerSha256 } = readJsonArtifact(
    ledgerPath.resolved,
    "public request first-gym execution ledger",
  );
  invariant(
    packet.public_request_first_gym_execution_ledger_sha256 ===
      gate.public_request_first_gym_execution_ledger_sha256,
    "Missing proof packet and completion gate must use the same execution ledger SHA.",
  );
  invariant(
    ledgerSha256 === packet.public_request_first_gym_execution_ledger_sha256,
    "Missing proof packet execution ledger SHA mismatch.",
  );
  assertFalseFlags(packet, "Missing proof packet");
  assertFalseFlags(gate, "Completion gate");

  const missingCommands = packet.missing_command_sequence ?? [];
  const nextCommand = missingCommands[0]?.command ?? null;
  const allInspectable =
    gate.completion_gate?.all_required_artifacts_inspectable === true &&
    missingCommands.length === 0;
  const runbook = {
    artifact_kind: "admin_public_request_first_gym_proof_session_runbook",
    status: "admin_public_request_first_gym_proof_session_runbook_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "admin_public_request_first_gym_missing_proof_packet_and_completion_gate",
    public_request_first_gym_missing_proof_packet_path: packetPath.relativePath,
    public_request_first_gym_missing_proof_packet_sha256: packetSha256,
    public_request_first_gym_completion_gate_path: gatePath.relativePath,
    public_request_first_gym_completion_gate_sha256: gateSha256,
    public_request_first_gym_execution_ledger_sha256:
      gate.public_request_first_gym_execution_ledger_sha256,
    proof_session_runbook: {
      mode: "customer_safe_operator_runbook_only",
      missing_count: packet.missing_proof_packet?.missing_count ?? 0,
      inspectable_count: packet.missing_proof_packet?.inspectable_count ?? 0,
      completion_gate_status: gate.status,
      all_required_artifacts_inspectable: allInspectable,
      next_required_command: nextCommand,
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      ready_for_public_self_serve_launch: false,
      public_launch_decision_allowed: false,
    },
    prerequisites: [
      "Use the protected Preview and hosted Neon branch from the current proof chain.",
      "Keep rotated credentials and bypass secrets outside artifacts.",
      "Have the owner available before recording customer-observed proof.",
      "Regenerate the execution ledger after each missing proof command succeeds.",
      "Regenerate this runbook before the customer-observed session.",
    ],
    command_sequence: missingCommands.map((step) => ({
      artifact_path: step.artifact_path,
      command: step.command,
      id: step.id,
      order: step.order,
      title: step.title,
    })),
    evidence_status_rows: (ledger.steps ?? []).map((step, index) => ({
      artifact_path: step.artifact_path,
      artifact_sha256: step.artifact_sha256 ?? null,
      command: step.command,
      id: step.id,
      order: index + 1,
      state: step.state,
      title: step.title,
    })),
    stop_conditions: STOP_CONDITIONS,
    blocked_gates: [
      "Public owner self-signup",
      "Public request form submission",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email provider activation",
      "Product Auth admin API",
      "Auth user creation",
      "Magic link creation",
      "Automatic owner/staff grants",
      "Billing, POS, access control, member-ledger writes",
      "Public launch decision",
    ],
  };

  for (const key of BLOCKED_FLAGS) runbook[key] = false;
  assertNoSecretShapedKeys(runbook, "public request first-gym proof session runbook");
  mkdirSync(dirname(runbookPath.resolved), { recursive: true });
  writeFileSync(runbookPath.resolved, `${JSON.stringify(runbook, null, 2)}\n`);
  console.log("Admin public request first-gym proof session runbook prepared");
  console.log(`Artifact: ${runbookPath.relativePath}`);
  console.log(`Missing commands: ${missingCommands.length}`);
  if (nextCommand) console.log(`Next required command: ${nextCommand}`);
}

main();
