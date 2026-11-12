#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_COMPLETION_PATH =
  "artifacts/admin-launch-readiness/admin-source-apply-completion.json";

const REQUIRED_GATES = [
  "public_owner_self_signup",
  "website_scraping",
  "google_profile_api_import",
  "automatic_answer_approval",
  "task_generation",
  "notification_sending",
  "phone_email_provider_activation",
  "billing",
  "pos_access_control_member_ledger_writes",
  "email_ingress",
  "outbound_email_delivery",
  "provider_webhooks"
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
    process.env.OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH ?? DEFAULT_COMPLETION_PATH,
    "OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH"
  );
  const artifact = readJsonArtifact(completionPath.resolved, "source apply completion");

  invariant(artifact.artifact_kind === "admin_source_apply_completion", "Source apply completion kind mismatch.");
  invariant(artifact.status === "source_apply_completion_recorded", "Source apply completion status mismatch.");
  invariant(
    /^[a-f0-9]{64}$/u.test(String(artifact.source_apply_rehearsal_sha256 ?? "")),
    "Source apply rehearsal SHA256 missing."
  );
  const rehearsalPath = normalizeArtifactPath(
    artifact.source_apply_rehearsal_path,
    "source_apply_rehearsal_path"
  );
  const rehearsalRaw = readFileSync(rehearsalPath.resolved, "utf8");
  assertNoSecretShapedValue(rehearsalRaw, "source apply rehearsal parent");
  invariant(
    createHash("sha256").update(rehearsalRaw).digest("hex") === artifact.source_apply_rehearsal_sha256,
    "Source apply rehearsal SHA256 does not match parent artifact."
  );
  invariant(artifact.observed?.owner_workspace_observed === true, "Owner workspace observation required.");
  invariant(artifact.observed?.manual_source_saved === true, "Manual source save observation required.");
  invariant(artifact.observed?.answer_review_staged === true, "Answer review staging observation required.");
  invariant(
    artifact.observed?.automatic_approval_not_observed === true,
    "Automatic approval must be observed absent."
  );
  invariant(artifact.observed?.live_provider_copy_blocked === true, "Live-provider copy must be observed blocked.");
  invariant(artifact.existing_owner_manual_intake_allowed === true, "Existing owner manual intake must be the only allowed path.");
  assertFalse(artifact, "artifact_runtime_write_allowed", "Artifact runtime writes must remain blocked.");
  assertFalse(artifact, "source_import_automation_allowed", "Source import automation must remain blocked.");
  assertFalse(artifact, "automatic_answer_approval_allowed", "Automatic answer approval must remain blocked.");
  assertFalse(artifact, "automatic_task_generation_allowed", "Automatic task generation must remain blocked.");
  assertFalse(artifact, "email_or_notification_allowed", "Email/notifications must remain blocked.");
  assertFalse(artifact, "live_provider_enablement_allowed", "Live provider enablement must remain blocked.");
  assertFalse(artifact, "public_self_serve_launch_allowed", "Public self-serve launch must remain blocked.");
  assertFalse(artifact, "customer_observed_handoff_claimed", "Customer-observed handoff must not be claimed.");
  assertFalse(artifact, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  assertBlockedGates(artifact, "Source apply completion");

  console.log("Admin source apply completion inspection passed");
  console.log(`Artifact: ${completionPath.relativePath}`);
  console.log("Observed source completion recorded with live-provider and self-serve gates blocked.");
}

main();
