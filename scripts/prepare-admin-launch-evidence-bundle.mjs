#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_SOURCE_COMPLETION_PATH =
  "artifacts/admin-launch-readiness/admin-source-apply-completion.json";
const DEFAULT_EMAIL_COMPLETION_PATH =
  "artifacts/admin-launch-readiness/admin-email-task-completion.json";
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

function assertBlockedGates(artifact, label, gates) {
  for (const gate of gates) {
    invariant(artifact.blocked_gates?.includes(gate), `${label} must block ${gate}.`);
  }
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function verifyParentHash(pathValue, expectedSha, label) {
  invariant(/^[a-f0-9]{64}$/u.test(String(expectedSha ?? "")), `${label} parent SHA missing.`);
  const parentPath = normalizeArtifactPath(pathValue, `${label} parent path`, { mustExist: true });
  const parentRaw = readFileSync(parentPath.resolved, "utf8");
  assertNoSecretShapedValue(parentRaw, `${label} parent`);
  invariant(
    createHash("sha256").update(parentRaw).digest("hex") === expectedSha,
    `${label} parent SHA does not match.`
  );
}

function validateSourceCompletion(artifact) {
  invariant(artifact.artifact_kind === "admin_source_apply_completion", "Source completion kind mismatch.");
  invariant(artifact.status === "source_apply_completion_recorded", "Source completion status mismatch.");
  verifyParentHash(
    artifact.source_apply_rehearsal_path,
    artifact.source_apply_rehearsal_sha256,
    "Source apply completion"
  );
  invariant(artifact.observed?.owner_workspace_observed === true, "Source owner workspace observation required.");
  invariant(artifact.observed?.manual_source_saved === true, "Source manual save observation required.");
  invariant(artifact.observed?.answer_review_staged === true, "Source answer review observation required.");
  invariant(artifact.observed?.automatic_approval_not_observed === true, "Source automatic approval must be absent.");
  invariant(artifact.observed?.live_provider_copy_blocked === true, "Source live provider copy must be blocked.");
  invariant(artifact.existing_owner_manual_intake_allowed === true, "Source manual intake must be the only allowed path.");
  assertFalse(artifact, "artifact_runtime_write_allowed", "Source artifact runtime writes must remain blocked.");
  assertFalse(artifact, "source_import_automation_allowed", "Source import automation must remain blocked.");
  assertFalse(artifact, "automatic_answer_approval_allowed", "Source automatic approval must remain blocked.");
  assertFalse(artifact, "automatic_task_generation_allowed", "Source automatic task generation must remain blocked.");
  assertFalse(artifact, "email_or_notification_allowed", "Source email/notifications must remain blocked.");
  assertFalse(artifact, "live_provider_enablement_allowed", "Source live providers must remain blocked.");
  assertFalse(artifact, "public_self_serve_launch_allowed", "Source public self-serve must remain blocked.");
  assertFalse(artifact, "customer_observed_handoff_claimed", "Source customer handoff must not be claimed.");
  assertFalse(artifact, "billing_pos_member_writes_allowed", "Source billing/POS/member writes must remain blocked.");
  assertBlockedGates(artifact, "Source completion", SOURCE_GATES);
}

function validateEmailCompletion(artifact) {
  invariant(artifact.artifact_kind === "admin_email_task_completion", "Email completion kind mismatch.");
  invariant(artifact.status === "email_task_completion_recorded", "Email completion status mismatch.");
  verifyParentHash(
    artifact.email_task_rehearsal_path,
    artifact.email_task_rehearsal_sha256,
    "Email task completion"
  );
  invariant(artifact.observed?.owner_review_observed === true, "Email owner review observation required.");
  invariant(artifact.observed?.manual_task_decision_observed === true, "Email manual task decision observation required.");
  invariant(artifact.observed?.email_ingress_not_observed === true, "Email ingress must be absent.");
  invariant(artifact.observed?.outbound_delivery_not_observed === true, "Email outbound delivery must be absent.");
  invariant(artifact.observed?.notification_not_observed === true, "Email notifications must be absent.");
  invariant(artifact.observed?.live_provider_copy_blocked === true, "Email live provider copy must be blocked.");
  invariant(artifact.existing_manual_task_entry_allowed === true, "Email manual task entry must be the only allowed path.");
  assertFalse(artifact, "artifact_runtime_write_allowed", "Email artifact runtime writes must remain blocked.");
  assertFalse(artifact, "automatic_task_creation_allowed", "Email automatic task creation must remain blocked.");
  assertFalse(artifact, "email_ingress_allowed", "Email ingress must remain blocked.");
  assertFalse(artifact, "outbound_email_allowed", "Email outbound delivery must remain blocked.");
  assertFalse(artifact, "notification_sending_allowed", "Email notifications must remain blocked.");
  assertFalse(artifact, "live_provider_enablement_allowed", "Email live providers must remain blocked.");
  assertFalse(artifact, "public_self_serve_launch_allowed", "Email public self-serve must remain blocked.");
  assertFalse(artifact, "customer_observed_handoff_claimed", "Email customer handoff must not be claimed.");
  assertFalse(artifact, "billing_pos_member_writes_allowed", "Email billing/POS/member writes must remain blocked.");
  assertBlockedGates(artifact, "Email completion", EMAIL_GATES);
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
  const sourcePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH ?? DEFAULT_SOURCE_COMPLETION_PATH,
    "OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH",
    { mustExist: true }
  );
  const emailPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH ?? DEFAULT_EMAIL_COMPLETION_PATH,
    "OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH",
    { mustExist: true }
  );
  const bundlePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH ?? DEFAULT_BUNDLE_PATH,
    "OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH",
    { mustExist: false }
  );

  const { artifact: sourceCompletion, sha256: sourceSha256 } = readJsonArtifact(
    sourcePath.resolved,
    "source apply completion"
  );
  const { artifact: emailCompletion, sha256: emailSha256 } = readJsonArtifact(
    emailPath.resolved,
    "email task completion"
  );
  validateSourceCompletion(sourceCompletion);
  validateEmailCompletion(emailCompletion);
  assertSameLaunchSubject(sourceCompletion, emailCompletion);

  const artifact = {
    artifact_kind: "admin_launch_evidence_bundle",
    status: "admin_launch_evidence_bundle_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "operator_observed_source_apply_and_email_task_completion_records",
    source_apply_completion_path: sourcePath.relativePath,
    source_apply_completion_sha256: sourceSha256,
    email_task_completion_path: emailPath.relativePath,
    email_task_completion_sha256: emailSha256,
    gym_name: sourceCompletion.gym_name ?? emailCompletion.gym_name ?? null,
    owner_email: sourceCompletion.owner_email ?? emailCompletion.owner_email ?? null,
    source_evidence: {
      source_label: sourceCompletion.source_label,
      location_label: sourceCompletion.location_label,
      observed: sourceCompletion.observed
    },
    email_evidence: {
      mailbox_label: emailCompletion.mailbox_label,
      triage_category: emailCompletion.triage_category,
      observed: emailCompletion.observed
    },
    operator_evidence_ready: true,
    public_self_serve_launch_allowed: false,
    customer_observed_handoff_claimed: false,
    source_import_automation_allowed: false,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    ready_gates: [
      "Operator-observed source apply completion",
      "Operator-observed email task completion",
      "Parent artifact SHA chain"
    ],
    blocked_gates: [
      "Public self-serve launch",
      "Customer-observed handoff claim",
      "Website scraping and Google API import",
      "Automatic answer approval",
      "Automatic task generation",
      "Gmail, Resend, SMTP, and provider webhooks",
      "Inbound email, outbound delivery, and notifications",
      "Phone/email provider activation",
      "Billing, POS, access control, and member-ledger writes"
    ],
    command_sequence: [
      "npm run admin:source-apply:record",
      "npm run admin:source-apply:record-inspect",
      "npm run admin:email-task:record",
      "npm run admin:email-task:record-inspect",
      "npm run admin:launch-evidence:bundle",
      "npm run admin:launch-evidence:inspect"
    ]
  };

  assertNoSecretShapedKeys(artifact, "admin launch evidence bundle");
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "admin launch evidence bundle");
  mkdirSync(dirname(bundlePath.resolved), { recursive: true });
  writeFileSync(bundlePath.resolved, serialized);
  console.log("Admin launch evidence bundle prepared");
  console.log(`Artifact: ${bundlePath.relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Bundle is pre-self-serve evidence only; customer-observed handoff and live-provider gates remain blocked.");
}

main();
