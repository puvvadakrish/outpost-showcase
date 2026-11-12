#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_REHEARSAL_PATH =
  "artifacts/admin-launch-readiness/admin-email-task-rehearsal.json";
const DEFAULT_COMPLETION_PATH =
  "artifacts/admin-launch-readiness/admin-email-task-completion.json";

const REQUIRED_GATES = [
  "public_owner_self_signup",
  "gmail_connection",
  "resend_connection",
  "smtp_connection",
  "provider_webhooks",
  "email_ingress",
  "outbound_email_delivery",
  "notification_sending",
  "task_generation",
  "billing",
  "pos_access_control_member_ledger_writes"
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      text
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretShapedKeys(entry, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    invariant(
      !/(password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)/iu.test(
        key
      ),
      `${label} contains secret-shaped key ${key}.`
    );
    assertNoSecretShapedKeys(entry, `${label}.${key}`);
  }
}

function normalizeArtifactPath(rawPath, label, { mustExist }) {
  const value = String(rawPath ?? "").trim();
  invariant(value, `${label} required.`);
  assertNoSecretShapedValue(value, label);
  invariant(!isAbsolute(value), `${label} must be relative.`);
  invariant(value.endsWith(".json"), `${label} must end with .json.`);
  const root = resolve(process.cwd(), "artifacts");
  const resolved = resolve(process.cwd(), value);
  const relativePath = relative(process.cwd(), resolved);
  const relativeToRoot = relative(root, resolved);
  invariant(
    relativeToRoot && !relativeToRoot.startsWith("..") && !relativeToRoot.split(sep).includes(".."),
    `${label} must stay under artifacts/.`
  );
  invariant(relativePath === value, `${label} must be normalized.`);
  invariant(existsSync(resolved) === mustExist, mustExist ? `${label} does not exist.` : `${label} already exists.`);
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: createHash("sha256").update(raw).digest("hex") };
}

function assertBlockedGates(artifact, label) {
  for (const gate of REQUIRED_GATES) {
    invariant(artifact.blocked_gates?.includes(gate), `${label} must block ${gate}.`);
  }
}

function requireYes(name) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  invariant(value === "yes", `${name} must be yes.`);
  return true;
}

function requireOptionalText(name, maxLength) {
  const value = String(process.env[name] ?? "").trim();
  invariant(value.length <= maxLength, `${name} too long.`);
  assertNoSecretShapedValue(value, name);
  return value;
}

function main() {
  const rehearsalPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH ?? DEFAULT_REHEARSAL_PATH,
    "OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH",
    { mustExist: true }
  );
  const completionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH ?? DEFAULT_COMPLETION_PATH,
    "OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH",
    { mustExist: false }
  );
  const { artifact: rehearsal, sha256: rehearsalSha256 } = readJsonArtifact(
    rehearsalPath.resolved,
    "email task rehearsal"
  );

  invariant(rehearsal.artifact_kind === "admin_email_task_rehearsal", "Email task rehearsal kind mismatch.");
  invariant(rehearsal.status === "email_task_rehearsal_prepared", "Email task rehearsal status mismatch.");
  invariant(rehearsal.artifact_runtime_write_allowed === false, "Artifact runtime writes must remain blocked.");
  invariant(rehearsal.existing_manual_task_entry_allowed === true, "Existing manual task entry must be the only task path.");
  invariant(rehearsal.automatic_task_creation_allowed === false, "Automatic task creation must remain blocked.");
  invariant(rehearsal.email_ingress_allowed === false, "Email ingress must remain blocked.");
  invariant(rehearsal.outbound_email_allowed === false, "Outbound email must remain blocked.");
  invariant(rehearsal.notification_sending_allowed === false, "Notifications must remain blocked.");
  invariant(rehearsal.live_provider_enablement_allowed === false, "Live provider enablement must remain blocked.");
  invariant(rehearsal.public_self_serve_launch_allowed === false, "Public self-serve launch must remain blocked.");
  assertBlockedGates(rehearsal, "Email task rehearsal");

  const operatorLabel = requireOptionalText("OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_OPERATOR", 120);
  invariant(operatorLabel, "OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_OPERATOR required.");
  const notes = requireOptionalText("OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_NOTES", 500);
  const observed = {
    owner_review_observed: requireYes("OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_OWNER_REVIEW_OBSERVED"),
    manual_task_decision_observed: requireYes("OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_MANUAL_TASK_DECISION_OBSERVED"),
    email_ingress_not_observed: requireYes("OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_EMAIL_INGRESS_NOT_OBSERVED"),
    outbound_delivery_not_observed: requireYes("OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_OUTBOUND_DELIVERY_NOT_OBSERVED"),
    notification_not_observed: requireYes("OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_NOTIFICATION_NOT_OBSERVED"),
    live_provider_copy_blocked: requireYes("OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_LIVE_PROVIDER_COPY_BLOCKED")
  };

  const artifact = {
    artifact_kind: "admin_email_task_completion",
    status: "email_task_completion_recorded",
    generated_at: new Date().toISOString(),
    gym_name: rehearsal.gym_name,
    owner_email: rehearsal.owner_email,
    mailbox_label: rehearsal.mailbox_label,
    triage_category: rehearsal.triage_category,
    operator_label: operatorLabel,
    email_task_rehearsal_path: rehearsalPath.relativePath,
    email_task_rehearsal_sha256: rehearsalSha256,
    observed,
    notes,
    manual_task_payload: rehearsal.manual_task_payload,
    browser_steps: rehearsal.browser_steps,
    artifact_runtime_write_allowed: false,
    existing_manual_task_entry_allowed: true,
    automatic_task_creation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    public_self_serve_launch_allowed: false,
    customer_observed_handoff_claimed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: REQUIRED_GATES
  };

  assertNoSecretShapedKeys(artifact, "email task completion");
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "email task completion");
  mkdirSync(dirname(completionPath.resolved), { recursive: true });
  writeFileSync(completionPath.resolved, serialized);
  console.log("Admin email task completion recorded");
  console.log(`Artifact: ${completionPath.relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Completion is operator-observed evidence only; no inbox, outbound, notification, or live-provider gate was opened.");
}

main();
