#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BUNDLE_PATH =
  "artifacts/admin-launch-readiness/admin-launch-evidence-bundle.json";

const SOURCE_GATES = [
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

const EMAIL_GATES = [
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
  return { artifact, sha256: createHash("sha256").update(raw).digest("hex") };
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values) && values.includes(expected), `${label} must include ${expected}.`);
}

function assertBlockedGates(artifact, label, gates) {
  for (const gate of gates) {
    invariant(artifact.blocked_gates?.includes(gate), `${label} must block ${gate}.`);
  }
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertChildHash(pathValue, expectedSha, expectedKind, label) {
  invariant(/^[a-f0-9]{64}$/u.test(String(expectedSha ?? "")), `${label} SHA256 missing.`);
  const childPath = normalizeArtifactPath(pathValue, `${label} path`);
  const { artifact, sha256 } = readJsonArtifact(childPath.resolved, label);
  invariant(sha256 === expectedSha, `${label} SHA256 does not match child artifact.`);
  invariant(artifact.artifact_kind === expectedKind, `${label} kind mismatch.`);
  invariant(artifact.customer_observed_handoff_claimed === false, `${label} must not claim customer handoff.`);
  return artifact;
}

function assertGrandparentHash(pathValue, expectedSha, label) {
  invariant(/^[a-f0-9]{64}$/u.test(String(expectedSha ?? "")), `${label} SHA256 missing.`);
  const parentPath = normalizeArtifactPath(pathValue, `${label} path`);
  const raw = readFileSync(parentPath.resolved, "utf8");
  assertNoSecretShapedValue(raw, label);
  invariant(createHash("sha256").update(raw).digest("hex") === expectedSha, `${label} SHA256 does not match.`);
}

function assertSameLaunchSubject(sourceCompletion, emailCompletion) {
  invariant(sourceCompletion.gym_name, "Source completion gym name is required.");
  invariant(emailCompletion.gym_name, "Email completion gym name is required.");
  invariant(sourceCompletion.owner_email, "Source completion owner email is required.");
  invariant(emailCompletion.owner_email, "Email completion owner email is required.");
  invariant(sourceCompletion.gym_name === emailCompletion.gym_name, "Source and email completions must target the same gym.");
  invariant(sourceCompletion.owner_email === emailCompletion.owner_email, "Source and email completions must target the same owner.");
}

function main() {
  const bundlePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH ?? DEFAULT_BUNDLE_PATH,
    "OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH"
  );
  const { artifact: bundle } = readJsonArtifact(bundlePath.resolved, "admin launch evidence bundle");

  invariant(bundle.artifact_kind === "admin_launch_evidence_bundle", "Launch evidence bundle kind mismatch.");
  invariant(bundle.status === "admin_launch_evidence_bundle_prepared", "Launch evidence bundle status mismatch.");
  invariant(bundle.evidence_basis === "operator_observed_source_apply_and_email_task_completion_records", "Launch evidence basis mismatch.");
  invariant(bundle.operator_evidence_ready === true, "Operator evidence must be ready.");
  assertFalse(bundle, "public_self_serve_launch_allowed", "Public self-serve launch must remain blocked.");
  assertFalse(bundle, "customer_observed_handoff_claimed", "Customer-observed handoff must not be claimed.");
  assertFalse(bundle, "source_import_automation_allowed", "Source import automation must remain blocked.");
  assertFalse(bundle, "automatic_answer_approval_allowed", "Automatic answer approval must remain blocked.");
  assertFalse(bundle, "automatic_task_generation_allowed", "Automatic task generation must remain blocked.");
  assertFalse(bundle, "email_ingress_allowed", "Email ingress must remain blocked.");
  assertFalse(bundle, "outbound_email_allowed", "Outbound email must remain blocked.");
  assertFalse(bundle, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(bundle, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(bundle, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");

  const sourceCompletion = assertChildHash(
    bundle.source_apply_completion_path,
    bundle.source_apply_completion_sha256,
    "admin_source_apply_completion",
    "source apply completion"
  );
  const emailCompletion = assertChildHash(
    bundle.email_task_completion_path,
    bundle.email_task_completion_sha256,
    "admin_email_task_completion",
    "email task completion"
  );
  invariant(sourceCompletion.status === "source_apply_completion_recorded", "Source completion status mismatch.");
  invariant(sourceCompletion.observed?.owner_workspace_observed === true, "Source completion must observe owner workspace.");
  invariant(sourceCompletion.observed?.manual_source_saved === true, "Source completion must observe manual source saved.");
  invariant(sourceCompletion.observed?.answer_review_staged === true, "Source completion must observe answer review staged.");
  invariant(sourceCompletion.observed?.automatic_approval_not_observed === true, "Source completion must observe automatic approval absent.");
  invariant(sourceCompletion.observed?.live_provider_copy_blocked === true, "Source completion must observe live provider copy blocked.");
  invariant(sourceCompletion.existing_owner_manual_intake_allowed === true, "Source manual intake must be the only allowed path.");
  invariant(sourceCompletion.artifact_runtime_write_allowed === false, "Source artifact runtime writes must remain blocked.");
  invariant(sourceCompletion.public_self_serve_launch_allowed === false, "Source public self-serve must remain blocked.");
  invariant(sourceCompletion.source_import_automation_allowed === false, "Source import automation must remain blocked.");
  invariant(sourceCompletion.automatic_answer_approval_allowed === false, "Source automatic approval must remain blocked.");
  invariant(sourceCompletion.automatic_task_generation_allowed === false, "Source automatic task generation must remain blocked.");
  invariant(sourceCompletion.email_or_notification_allowed === false, "Source email/notifications must remain blocked.");
  invariant(sourceCompletion.live_provider_enablement_allowed === false, "Source live providers must remain blocked.");
  invariant(sourceCompletion.billing_pos_member_writes_allowed === false, "Source billing/POS/member writes must remain blocked.");
  assertBlockedGates(sourceCompletion, "Source completion", SOURCE_GATES);
  invariant(emailCompletion.status === "email_task_completion_recorded", "Email completion status mismatch.");
  invariant(emailCompletion.observed?.owner_review_observed === true, "Email completion must observe owner review.");
  invariant(emailCompletion.observed?.manual_task_decision_observed === true, "Email completion must observe manual task decision.");
  invariant(emailCompletion.observed?.email_ingress_not_observed === true, "Email completion must observe email ingress absent.");
  invariant(emailCompletion.observed?.outbound_delivery_not_observed === true, "Email completion must observe outbound delivery absent.");
  invariant(emailCompletion.observed?.notification_not_observed === true, "Email completion must observe notifications absent.");
  invariant(emailCompletion.observed?.live_provider_copy_blocked === true, "Email completion must observe live provider copy blocked.");
  invariant(emailCompletion.existing_manual_task_entry_allowed === true, "Email manual task entry must be the only allowed path.");
  invariant(emailCompletion.artifact_runtime_write_allowed === false, "Email artifact runtime writes must remain blocked.");
  invariant(emailCompletion.public_self_serve_launch_allowed === false, "Email public self-serve must remain blocked.");
  invariant(emailCompletion.automatic_task_creation_allowed === false, "Email automatic task creation must remain blocked.");
  invariant(emailCompletion.email_ingress_allowed === false, "Email ingress must remain blocked.");
  invariant(emailCompletion.outbound_email_allowed === false, "Email outbound delivery must remain blocked.");
  invariant(emailCompletion.notification_sending_allowed === false, "Email notifications must remain blocked.");
  invariant(emailCompletion.live_provider_enablement_allowed === false, "Email live providers must remain blocked.");
  invariant(emailCompletion.billing_pos_member_writes_allowed === false, "Email billing/POS/member writes must remain blocked.");
  assertBlockedGates(emailCompletion, "Email completion", EMAIL_GATES);
  assertGrandparentHash(
    sourceCompletion.source_apply_rehearsal_path,
    sourceCompletion.source_apply_rehearsal_sha256,
    "source apply rehearsal parent"
  );
  assertGrandparentHash(
    emailCompletion.email_task_rehearsal_path,
    emailCompletion.email_task_rehearsal_sha256,
    "email task rehearsal parent"
  );
  assertSameLaunchSubject(sourceCompletion, emailCompletion);

  assertIncludes(bundle.ready_gates, "Operator-observed source apply completion", "ready gates");
  assertIncludes(bundle.ready_gates, "Operator-observed email task completion", "ready gates");
  assertIncludes(bundle.ready_gates, "Parent artifact SHA chain", "ready gates");
  assertIncludes(bundle.blocked_gates, "Public self-serve launch", "blocked gates");
  assertIncludes(bundle.blocked_gates, "Customer-observed handoff claim", "blocked gates");
  assertIncludes(bundle.blocked_gates, "Inbound email, outbound delivery, and notifications", "blocked gates");
  assertIncludes(bundle.blocked_gates, "Billing, POS, access control, and member-ledger writes", "blocked gates");
  assertIncludes(bundle.command_sequence, "npm run admin:launch-evidence:inspect", "command sequence");

  console.log("Admin launch evidence bundle inspection passed");
  console.log(`Artifact: ${bundlePath.relativePath}`);
  console.log("Operator evidence is bundled; customer-observed handoff, public self-serve, live providers, and billing/POS/member writes remain blocked.");
}

main();
