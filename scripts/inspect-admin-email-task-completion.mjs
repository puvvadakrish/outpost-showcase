#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";

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

function normalizeArtifactPath(rawPath, label) {
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
  invariant(existsSync(resolved), `${label} does not exist.`);
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return artifact;
}

function assertBlockedGates(artifact, label) {
  for (const gate of REQUIRED_GATES) {
    invariant(artifact.blocked_gates?.includes(gate), `${label} must block ${gate}.`);
  }
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function main() {
  const completionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH ?? DEFAULT_COMPLETION_PATH,
    "OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH"
  );
  const artifact = readJsonArtifact(completionPath.resolved, "email task completion");

  invariant(artifact.artifact_kind === "admin_email_task_completion", "Email task completion kind mismatch.");
  invariant(artifact.status === "email_task_completion_recorded", "Email task completion status mismatch.");
  invariant(
    /^[a-f0-9]{64}$/u.test(String(artifact.email_task_rehearsal_sha256 ?? "")),
    "Email task rehearsal SHA256 missing."
  );
  const rehearsalPath = normalizeArtifactPath(
    artifact.email_task_rehearsal_path,
    "email_task_rehearsal_path"
  );
  const rehearsalRaw = readFileSync(rehearsalPath.resolved, "utf8");
  assertNoSecretShapedValue(rehearsalRaw, "email task rehearsal parent");
  invariant(
    createHash("sha256").update(rehearsalRaw).digest("hex") === artifact.email_task_rehearsal_sha256,
    "Email task rehearsal SHA256 does not match parent artifact."
  );
  invariant(artifact.observed?.owner_review_observed === true, "Owner review observation required.");
  invariant(artifact.observed?.manual_task_decision_observed === true, "Manual task decision observation required.");
  invariant(artifact.observed?.email_ingress_not_observed === true, "Email ingress must be observed absent.");
  invariant(artifact.observed?.outbound_delivery_not_observed === true, "Outbound delivery must be observed absent.");
  invariant(artifact.observed?.notification_not_observed === true, "Notifications must be observed absent.");
  invariant(artifact.observed?.live_provider_copy_blocked === true, "Live-provider copy must be observed blocked.");
  invariant(artifact.existing_manual_task_entry_allowed === true, "Existing manual task entry must be the only task path.");
  assertFalse(artifact, "artifact_runtime_write_allowed", "Artifact runtime writes must remain blocked.");
  assertFalse(artifact, "automatic_task_creation_allowed", "Automatic task creation must remain blocked.");
  assertFalse(artifact, "email_ingress_allowed", "Email ingress must remain blocked.");
  assertFalse(artifact, "outbound_email_allowed", "Outbound email must remain blocked.");
  assertFalse(artifact, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(artifact, "live_provider_enablement_allowed", "Live provider enablement must remain blocked.");
  assertFalse(artifact, "public_self_serve_launch_allowed", "Public self-serve launch must remain blocked.");
  assertFalse(artifact, "customer_observed_handoff_claimed", "Customer-observed handoff must not be claimed.");
  assertFalse(artifact, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  assertBlockedGates(artifact, "Email task completion");

  console.log("Admin email task completion inspection passed");
  console.log(`Artifact: ${completionPath.relativePath}`);
  console.log("Observed email task completion recorded with inbox, outbound, notification, and self-serve gates blocked.");
}

main();
