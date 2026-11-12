#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const ARTIFACT_PATH =
  process.env.OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH ??
  "artifacts/admin-launch-readiness/admin-source-apply-rehearsal.json";

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

function normalizeArtifactPath(rawPath) {
  const normalizedPath = rawPath?.trim();
  assertNoSecretShapedValue(normalizedPath, "OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH");
  const resolved = resolve(process.cwd(), normalizedPath);
  const relativePath = isAbsolute(normalizedPath) ? normalizedPath : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(!normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"), "Source apply rehearsal must live under artifacts/.");
  invariant(existsSync(resolved), `Source apply rehearsal not found at ${relativePath}.`);
  return { relativePath, resolved };
}

function assertArtifactShape(artifact) {
  invariant(artifact.artifact_kind === "admin_source_apply_rehearsal", "Artifact kind mismatch.");
  invariant(artifact.status === "source_apply_rehearsal_prepared", "Artifact status mismatch.");
  invariant(/^[a-f0-9]{64}$/u.test(artifact.source_workflow_rehearsal_sha256 ?? ""), "Source workflow digest required.");
  invariant(Array.isArray(artifact.manual_source_payload?.facts) && artifact.manual_source_payload.facts.length > 0, "Manual source facts required.");
  invariant(Array.isArray(artifact.browser_steps) && artifact.browser_steps.length >= 4, "Browser steps required.");
  invariant(artifact.artifact_runtime_write_allowed === false, "Artifact runtime writes must remain blocked.");
  invariant(artifact.existing_owner_manual_intake_allowed === true, "Existing owner manual intake should be the only allowed write path.");
  invariant(artifact.automatic_answer_approval_allowed === false, "Automatic answer approval must remain blocked.");
  invariant(artifact.automatic_task_generation_allowed === false, "Automatic task generation must remain blocked.");
  invariant(artifact.email_or_notification_allowed === false, "Email or notification sending must remain blocked.");
  invariant(artifact.live_provider_enablement_allowed === false, "Live providers must remain blocked.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Public self-serve must remain blocked.");
  for (const gate of REQUIRED_GATES) {
    invariant(artifact.blocked_gates?.includes(gate), `${gate} gate must be blocked.`);
  }
}

function main() {
  const { relativePath, resolved } = normalizeArtifactPath(ARTIFACT_PATH);
  const raw = readFileSync(resolved, "utf8");
  assertNoSecretShapedValue(raw, "source apply rehearsal");
  const artifact = JSON.parse(raw);
  assertArtifactShape(artifact);
  console.log("Admin source apply rehearsal inspected");
  console.log(`Artifact: ${relativePath}`);
  console.log(`Facts ready for owner manual source intake: ${artifact.manual_source_payload.facts.length}`);
  console.log("No automatic import, answer approval, task generation, email, notifications, or providers enabled.");
}

main();
