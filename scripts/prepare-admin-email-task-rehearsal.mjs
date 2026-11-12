#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const EXPORT_PATH =
  process.env.OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH ??
  "artifacts/admin-launch-readiness/admin-email-task-rehearsal.json";

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

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedKeys(item, label, [...trail, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("jwt");
    invariant(!secretKey, `${label} contains secret-shaped key ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function normalizeArtifactPath(rawPath, label, { mustExist }) {
  const normalizedPath = rawPath?.trim();
  invariant(normalizedPath, `${label} required.`);
  assertNoSecretShapedValue(normalizedPath, label);
  const resolved = resolve(process.cwd(), normalizedPath);
  const relativePath = isAbsolute(normalizedPath) ? normalizedPath : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(!normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"), `${label} must live under artifacts/.`);
  invariant(relativePath.endsWith(".json"), `${label} must be JSON file.`);
  invariant(
    mustExist ? existsSync(resolved) : !existsSync(resolved),
    `${label} ${mustExist ? "not found" : "already exists"} at ${relativePath}.`
  );
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

function requireText(name, maxLength) {
  const value = String(process.env[name] ?? "").trim();
  invariant(value, `${name} required.`);
  invariant(value.length <= maxLength, `${name} too long.`);
  assertNoSecretShapedValue(value, name);
  return value;
}

function main() {
  const rehearsalPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH,
    "OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH",
    { mustExist: true }
  );
  const exportPath = normalizeArtifactPath(EXPORT_PATH, "OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH", {
    mustExist: false
  });
  const { artifact: rehearsal, sha256: rehearsalSha256 } = readJsonArtifact(
    rehearsalPath.resolved,
    "email triage rehearsal"
  );

  invariant(rehearsal.artifact_kind === "admin_email_triage_rehearsal", "Email triage rehearsal kind mismatch.");
  invariant(rehearsal.email_ingress_allowed === false, "Email triage must keep email ingress blocked.");
  invariant(rehearsal.outbound_email_allowed === false, "Email triage must keep outbound email blocked.");
  invariant(rehearsal.notification_sending_allowed === false, "Email triage must keep notifications blocked.");
  invariant(rehearsal.task_creation_allowed === false, "Email triage must keep automatic task creation blocked.");
  invariant(rehearsal.live_provider_enablement_allowed === false, "Email triage must keep live providers blocked.");
  assertBlockedGates(rehearsal, "Email triage rehearsal");
  invariant(rehearsal.triage_category, "Email triage rehearsal must include triage category.");
  invariant(rehearsal.staff_task_draft, "Email triage rehearsal must include staff task draft.");

  const staffWorkspaceUrl = requireText("OUTPOST_ADMIN_EMAIL_TASK_STAFF_WORKSPACE_URL", 240);
  const operatorLabel = requireText("OUTPOST_ADMIN_EMAIL_TASK_OPERATOR_LABEL", 120);

  const artifact = {
    artifact_kind: "admin_email_task_rehearsal",
    status: "email_task_rehearsal_prepared",
    generated_at: new Date().toISOString(),
    gym_name: rehearsal.gym_name,
    owner_email: rehearsal.owner_email,
    mailbox_label: rehearsal.mailbox_label,
    operator_label: operatorLabel,
    staff_workspace_url: staffWorkspaceUrl,
    email_triage_rehearsal_path: rehearsalPath.relativePath,
    email_triage_rehearsal_sha256: rehearsalSha256,
    manual_task_payload: {
      title: rehearsal.triage_category,
      body: rehearsal.staff_task_draft,
      owner_review_label: rehearsal.owner_review_label,
      source_sample_subject: rehearsal.sample?.subject,
      source_sample_sender_label: rehearsal.sample?.sender_label
    },
    browser_steps: [
      "Review the pasted email sample with the owner.",
      "Open the staff workboard only if owner agrees the sample should become a follow-up.",
      "Create a manual staff task from the draft text through the existing human-entered task flow.",
      "Verify no inbox connection, outbound email, notification, or provider setup occurs."
    ],
    observed_completion_required: [
      "owner_review_completed",
      "manual_task_entered_if_needed",
      "email_ingress_not_observed",
      "outbound_delivery_not_observed",
      "live_provider_copy_still_blocked"
    ],
    artifact_runtime_write_allowed: false,
    existing_manual_task_entry_allowed: true,
    automatic_task_creation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    public_self_serve_launch_allowed: false,
    blocked_gates: REQUIRED_GATES
  };

  assertNoSecretShapedKeys(artifact, "email task rehearsal");
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "email task rehearsal");
  mkdirSync(dirname(exportPath.resolved), { recursive: true });
  writeFileSync(exportPath.resolved, serialized);
  console.log("Admin email task rehearsal prepared");
  console.log(`Artifact: ${exportPath.relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Artifact writes nothing; existing manual task entry remains the only allowed task path.");
}

main();
