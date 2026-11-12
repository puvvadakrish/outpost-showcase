#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_RUNBOOK_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-runbook.json";
const DEFAULT_PACK_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-execution-pack.json";

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

const REQUIRED_OBSERVATIONS = [
  "Protected Preview URL opened in browser.",
  "Hosted Neon branch name matches the current proof chain.",
  "Owner workspace is visible without unexpected tenant data.",
  "Staff workboard is visible without unexpected tenant data.",
  "Reset/rollback checklist is available to the operator.",
  "No screen claims invite delivery, live provider activation, billing, POS, access-control, or member-ledger writes.",
  "Owner/customer is present before any customer-observed proof command is run.",
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
      const path = [...trail, String(index)].join(".");
      assertNoSecretShapedValue(entry, `${label}.${path}`);
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

function main() {
  const runbookPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH ??
      DEFAULT_RUNBOOK_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH",
    { mustExist: true },
  );
  const packPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH ??
      DEFAULT_PACK_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH",
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-session-runbook.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH",
    runbookPath.relativePath,
    "Public request first-gym proof session runbook",
  );

  const { artifact: runbook, sha256: runbookSha256 } = readJsonArtifact(
    runbookPath.resolved,
    "public request first-gym proof session runbook",
  );
  invariant(
    runbook.proof_session_runbook?.mode === "customer_safe_operator_runbook_only",
    "Proof session runbook must remain customer-safe and operator-only.",
  );
  assertFalseFlags(runbook, "Proof session runbook");

  const commandSequence = runbook.command_sequence ?? [];
  const evidenceStatusRows = runbook.evidence_status_rows ?? commandSequence;
  const pack = {
    artifact_kind: "admin_public_request_first_gym_proof_session_execution_pack",
    status: "admin_public_request_first_gym_proof_session_execution_pack_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_first_gym_proof_session_runbook",
    public_request_first_gym_proof_session_runbook_path: runbookPath.relativePath,
    public_request_first_gym_proof_session_runbook_sha256: runbookSha256,
    public_request_first_gym_execution_ledger_sha256:
      runbook.public_request_first_gym_execution_ledger_sha256,
    proof_session_execution_pack: {
      mode: "operator_session_packet_only",
      preflight_ready_for_operator_session: commandSequence.length > 0,
      worksheet_step_count: evidenceStatusRows.length,
      expected_evidence_count: evidenceStatusRows.length,
      customer_observed_completion_recorded: false,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      public_launch_decision_allowed: false,
    },
    session_preflight: {
      mode: "operator_checks_before_customer_observed_proof",
      required_observations: REQUIRED_OBSERVATIONS,
      stop_conditions: runbook.stop_conditions ?? [],
      first_required_command:
        runbook.proof_session_runbook?.next_required_command ?? null,
    },
    customer_safe_worksheet: evidenceStatusRows.map((step, index) => ({
      expected_state_before_session:
        step.state === "inspectable"
          ? "inspectable_from_dedicated_command"
          : "missing_until_dedicated_command_runs",
      id: step.id,
      order: index + 1,
      operator_action: step.title,
      terminal_command: step.command,
    })),
    expected_evidence_manifest: evidenceStatusRows.map((step, index) => ({
      artifact_path: step.artifact_path,
      expected_after_command: "inspectable_after_dedicated_command_only",
      id: step.id,
      order: index + 1,
      recorded_by_execution_pack: false,
    })),
    blocked_gates: runbook.blocked_gates ?? [],
  };

  for (const key of BLOCKED_FLAGS) pack[key] = false;
  assertNoSecretShapedKeys(pack, "public request first-gym proof session execution pack");
  mkdirSync(dirname(packPath.resolved), { recursive: true });
  writeFileSync(packPath.resolved, `${JSON.stringify(pack, null, 2)}\n`);
  console.log("Admin public request first-gym proof session execution pack prepared");
  console.log(`Artifact: ${packPath.relativePath}`);
  console.log(`Worksheet steps: ${evidenceStatusRows.length}`);
}

main();
