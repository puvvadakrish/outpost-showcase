#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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
  if (options.mustExist !== false) {
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
  const runbookPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH ??
      DEFAULT_RUNBOOK_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH",
  );
  const { artifact: runbook } = readJsonArtifact(
    runbookPath.resolved,
    "public request first-gym proof session runbook",
  );
  invariant(
    runbook.artifact_kind === "admin_public_request_first_gym_proof_session_runbook",
    "Proof session runbook kind mismatch.",
  );
  invariant(
    runbook.status === "admin_public_request_first_gym_proof_session_runbook_prepared",
    "Proof session runbook status mismatch.",
  );
  invariant(
    runbook.evidence_basis ===
      "admin_public_request_first_gym_missing_proof_packet_and_completion_gate",
    "Proof session runbook basis mismatch.",
  );

  const packetPath = normalizeArtifactPath(
    runbook.public_request_first_gym_missing_proof_packet_path,
    "missing proof packet path",
  );
  const gatePath = normalizeArtifactPath(
    runbook.public_request_first_gym_completion_gate_path,
    "completion gate path",
  );
  const { artifact: packet, sha256: packetSha256 } = readJsonArtifact(
    packetPath.resolved,
    "public request first-gym missing proof packet",
  );
  const { artifact: gate, sha256: gateSha256 } = readJsonArtifact(
    gatePath.resolved,
    "public request first-gym completion gate",
  );
  invariant(
    packetSha256 === runbook.public_request_first_gym_missing_proof_packet_sha256,
    "Missing proof packet SHA256 does not match.",
  );
  invariant(
    gateSha256 === runbook.public_request_first_gym_completion_gate_sha256,
    "Completion gate SHA256 does not match.",
  );
  invariant(
    packet.public_request_first_gym_execution_ledger_sha256 ===
      gate.public_request_first_gym_execution_ledger_sha256,
    "Missing proof packet and completion gate must use the same execution ledger SHA.",
  );
  invariant(
    runbook.public_request_first_gym_execution_ledger_sha256 ===
      gate.public_request_first_gym_execution_ledger_sha256,
    "Runbook execution ledger SHA256 mismatch.",
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

  const missingCommands = packet.missing_command_sequence ?? [];
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
    ledgerSha256 === packet.public_request_first_gym_execution_ledger_sha256,
    "Missing proof packet execution ledger SHA mismatch.",
  );
  const expectedAllInspectable =
    gate.completion_gate?.all_required_artifacts_inspectable === true &&
    missingCommands.length === 0;
  const expectedNextCommand = missingCommands[0]?.command ?? null;
  invariant(
    runbook.proof_session_runbook?.mode === "customer_safe_operator_runbook_only",
    "Proof session runbook must remain customer-safe and operator-only.",
  );
  invariant(
    runbook.proof_session_runbook.missing_count ===
      (packet.missing_proof_packet?.missing_count ?? 0),
    "Runbook missing count mismatch.",
  );
  invariant(
    runbook.proof_session_runbook.inspectable_count ===
      (packet.missing_proof_packet?.inspectable_count ?? 0),
    "Runbook inspectable count mismatch.",
  );
  invariant(
    runbook.proof_session_runbook.completion_gate_status === gate.status,
    "Runbook completion gate status mismatch.",
  );
  invariant(
    runbook.proof_session_runbook.all_required_artifacts_inspectable ===
      expectedAllInspectable,
    "Runbook all-required-artifacts-inspectable state mismatch.",
  );
  invariant(
    runbook.proof_session_runbook.next_required_command === expectedNextCommand,
    "Runbook next required command mismatch.",
  );
  invariant(
    runbook.command_sequence?.length === missingCommands.length,
    "Runbook command sequence length mismatch.",
  );
  missingCommands.forEach((step, index) => {
    const command = runbook.command_sequence[index];
    invariant(command.id === step.id, `Runbook command ${index + 1} id mismatch.`);
    invariant(command.command === step.command, `${step.id} command mismatch.`);
    invariant(
      command.artifact_path === step.artifact_path,
      `${step.id} artifact path mismatch.`,
    );
  });
  invariant(
    Array.isArray(runbook.evidence_status_rows),
    "Runbook evidence status rows required.",
  );
  invariant(
    runbook.evidence_status_rows.length === (ledger.steps ?? []).length,
    "Runbook evidence status row count mismatch.",
  );
  (ledger.steps ?? []).forEach((step, index) => {
    const row = runbook.evidence_status_rows[index];
    invariant(row.id === step.id, `Runbook evidence row ${index + 1} id mismatch.`);
    invariant(row.order === index + 1, `${step.id} evidence row order mismatch.`);
    invariant(row.command === step.command, `${step.id} evidence row command mismatch.`);
    invariant(
      row.artifact_path === step.artifact_path,
      `${step.id} evidence row artifact path mismatch.`,
    );
    invariant(row.state === step.state, `${step.id} evidence row state mismatch.`);
    invariant(
      (row.artifact_sha256 ?? null) === (step.artifact_sha256 ?? null),
      `${step.id} evidence row SHA mismatch.`,
    );
  });
  invariant(
    runbook.proof_session_runbook.customer_observed_completion_recorded === false,
    "Runbook cannot record customer-observed completion.",
  );
  invariant(
    runbook.proof_session_runbook.first_gym_operator_run_recorded === false,
    "Runbook cannot record first-gym operator run.",
  );
  invariant(
    runbook.proof_session_runbook.limited_beta_review_recorded === false,
    "Runbook cannot record limited beta review.",
  );
  invariant(
    runbook.proof_session_runbook.ready_for_public_self_serve_launch === false,
    "Runbook cannot mark public self-serve launch ready.",
  );
  invariant(
    runbook.proof_session_runbook.public_launch_decision_allowed === false,
    "Runbook cannot allow public launch decision.",
  );
  invariant((runbook.stop_conditions ?? []).length >= 5, "Stop conditions required.");
  assertFalseFlags(runbook, "Proof session runbook");

  console.log("Admin public request first-gym proof session runbook inspection passed");
}

main();
