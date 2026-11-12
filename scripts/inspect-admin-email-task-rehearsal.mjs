#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const ARTIFACT_PATH =
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

function normalizeArtifactPath(rawPath) {
  const normalizedPath = rawPath?.trim();
  assertNoSecretShapedValue(normalizedPath, "OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH");
  const resolved = resolve(process.cwd(), normalizedPath);
  const relativePath = isAbsolute(normalizedPath) ? normalizedPath : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(!normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"), "Email task rehearsal must live under artifacts/.");
  invariant(existsSync(resolved), `Email task rehearsal not found at ${relativePath}.`);
  return { relativePath, resolved };
}

function assertArtifactShape(artifact) {
  invariant(artifact.artifact_kind === "admin_email_task_rehearsal", "Artifact kind mismatch.");
  invariant(artifact.status === "email_task_rehearsal_prepared", "Artifact status mismatch.");
  invariant(/^[a-f0-9]{64}$/u.test(artifact.email_triage_rehearsal_sha256 ?? ""), "Email triage digest required.");
  invariant(artifact.manual_task_payload?.title, "Manual task title required.");
  invariant(artifact.manual_task_payload?.body, "Manual task body required.");
  invariant(Array.isArray(artifact.browser_steps) && artifact.browser_steps.length >= 4, "Browser steps required.");
  invariant(artifact.artifact_runtime_write_allowed === false, "Artifact runtime writes must remain blocked.");
  invariant(artifact.existing_manual_task_entry_allowed === true, "Existing manual task entry should be the only allowed task path.");
  invariant(artifact.automatic_task_creation_allowed === false, "Automatic task creation must remain blocked.");
  invariant(artifact.email_ingress_allowed === false, "Email ingress must remain blocked.");
  invariant(artifact.outbound_email_allowed === false, "Outbound email must remain blocked.");
  invariant(artifact.notification_sending_allowed === false, "Notification sending must remain blocked.");
  invariant(artifact.live_provider_enablement_allowed === false, "Live providers must remain blocked.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Public self-serve must remain blocked.");
  for (const gate of REQUIRED_GATES) {
    invariant(artifact.blocked_gates?.includes(gate), `${gate} gate must be blocked.`);
  }
}

function main() {
  const { relativePath, resolved } = normalizeArtifactPath(ARTIFACT_PATH);
  const raw = readFileSync(resolved, "utf8");
  assertNoSecretShapedValue(raw, "email task rehearsal");
  const artifact = JSON.parse(raw);
  assertArtifactShape(artifact);
  console.log("Admin email task rehearsal inspected");
  console.log(`Artifact: ${relativePath}`);
  console.log(`Manual task draft: ${artifact.manual_task_payload.title}`);
  console.log("No inbox connection, outbound email, notification sending, automatic task creation, or providers enabled.");
}

main();
