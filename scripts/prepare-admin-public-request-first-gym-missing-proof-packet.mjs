#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_LEDGER_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-execution-ledger.json";
const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-missing-proof-packet.json";

const BLOCKED_GATES = [
  "Public owner self-signup",
  "Public request form submission",
  "Browser approval buttons",
  "Automatic approval",
  "Owner provisioning",
  "Invite delivery",
  "Notification sending",
  "Product Auth admin API",
  "Auth user creation",
  "Magic link creation",
  "Automatic owner/staff grants",
  "Phone/email provider activation",
  "Provider ingress/egress",
  "Billing, POS, access control, member-ledger writes",
  "Public launch decision",
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

function assertLedger(ledger) {
  invariant(
    ledger.artifact_kind === "admin_public_request_first_gym_execution_ledger",
    "Execution ledger kind mismatch.",
  );
  invariant(
    ledger.execution_ledger?.mode === "status_only_reinspect_existing_artifacts",
    "Execution ledger must remain status-only.",
  );
}

function main() {
  const ledgerPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH ??
      DEFAULT_LEDGER_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH",
    { mustExist: true },
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-execution-ledger.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH",
    ledgerPath.relativePath,
    "Public request first-gym execution ledger",
  );
  const { artifact: ledger, sha256: ledgerSha256 } = readJsonArtifact(
    ledgerPath.resolved,
    "public request first-gym execution ledger",
  );
  assertLedger(ledger);

  const missingSteps = (ledger.steps ?? []).filter((step) => step.state === "missing");
  const inspectableSteps = (ledger.steps ?? []).filter(
    (step) => step.state === "inspectable",
  );
  const nextStep = missingSteps[0] ?? null;
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH ??
      DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH",
  );

  const artifact = {
    artifact_kind: "admin_public_request_first_gym_missing_proof_packet",
    status: "admin_public_request_first_gym_missing_proof_packet_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_first_gym_execution_ledger",
    public_request_first_gym_execution_ledger_path: ledgerPath.relativePath,
    public_request_first_gym_execution_ledger_sha256: ledgerSha256,
    missing_proof_packet: {
      mode: "terminal_command_packet_only",
      missing_count: missingSteps.length,
      inspectable_count: inspectableSteps.length,
      all_required_artifacts_inspectable: missingSteps.length === 0,
      next_required_step_id: nextStep?.id ?? null,
      next_required_command: nextStep?.command ?? null,
      first_gym_proof_recorded: false,
      ready_for_limited_beta_operator_review: false,
      public_launch_decision_allowed: false,
    },
    missing_command_sequence: missingSteps.map((step, index) => ({
      artifact_path: step.artifact_path,
      command: step.command,
      id: step.id,
      order: index + 1,
      title: step.title,
    })),
    blocked_gates: BLOCKED_GATES,
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    public_request_form_submission_allowed: false,
    public_submission_accepted: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    owner_provisioning_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_user_created: false,
    magic_link_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    phone_email_provider_activation_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    access_control_writes_allowed: false,
    member_ledger_writes_allowed: false,
    provider_ingress_allowed: false,
    provider_egress_allowed: false,
    public_launch_decision_allowed: false,
  };

  assertNoSecretShapedKeys(artifact, "public request first-gym missing proof packet");
  mkdirSync(dirname(packetPath.resolved), { recursive: true });
  writeFileSync(packetPath.resolved, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log("Admin public request first-gym missing proof packet prepared");
  console.log(`Artifact: ${packetPath.relativePath}`);
  console.log(`Missing commands: ${missingSteps.length}`);
  if (nextStep) console.log(`Next required command: ${nextStep.command}`);
}

main();
