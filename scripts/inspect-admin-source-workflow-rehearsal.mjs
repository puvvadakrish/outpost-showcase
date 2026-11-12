#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const ARTIFACT_PATH =
  process.env.OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH ??
  "artifacts/admin-launch-readiness/admin-source-workflow-rehearsal.json";

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
  assertNoSecretShapedValue(rawPath, "OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH");
  const resolved = resolve(process.cwd(), rawPath);
  const relativePath = isAbsolute(rawPath) ? rawPath : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(!normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"), "Source workflow rehearsal must live under artifacts/.");
  invariant(existsSync(resolved), `Source workflow rehearsal not found at ${relativePath}.`);
  return { relativePath, resolved };
}

function assertArtifactShape(artifact) {
  invariant(artifact.artifact_kind === "admin_source_workflow_rehearsal", "Artifact kind mismatch.");
  invariant(artifact.status === "source_workflow_rehearsal_prepared", "Artifact status mismatch.");
  invariant(/^[a-f0-9]{64}$/u.test(artifact.source_facts_packet_sha256 ?? ""), "Source facts packet digest required.");
  invariant(Array.isArray(artifact.manual_source_payload?.facts) && artifact.manual_source_payload.facts.length > 0, "Manual source facts required.");
  invariant(Array.isArray(artifact.operator_steps) && artifact.operator_steps.length >= 3, "Operator steps required.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Public self-serve must remain blocked.");
  invariant(artifact.source_runtime_write_allowed === false, "Source runtime writes must remain blocked.");
  invariant(artifact.automatic_answer_approval_allowed === false, "Automatic answer approval must remain blocked.");
  invariant(artifact.task_generation_allowed === false, "Task generation must remain blocked.");
  invariant(artifact.email_or_notification_allowed === false, "Email or notification sending must remain blocked.");
  invariant(artifact.live_provider_enablement_allowed === false, "Live providers must remain blocked.");
  for (const gate of REQUIRED_GATES) {
    invariant(artifact.blocked_gates?.includes(gate), `${gate} gate must be blocked.`);
  }
}

function main() {
  const { relativePath, resolved } = normalizeArtifactPath(ARTIFACT_PATH);
  const raw = readFileSync(resolved, "utf8");
  assertNoSecretShapedValue(raw, "source workflow rehearsal");
  const artifact = JSON.parse(raw);
  assertArtifactShape(artifact);
  console.log("Admin source workflow rehearsal inspected");
  console.log(`Artifact: ${relativePath}`);
  console.log(`Facts ready for manual source intake: ${artifact.manual_source_payload.facts.length}`);
  console.log("No runtime imports, automatic approval, task generation, email, notifications, or providers enabled.");
}

main();
