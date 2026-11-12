#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const EXPORT_PATH =
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
    process.env.OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH,
    "OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH",
    { mustExist: true }
  );
  const exportPath = normalizeArtifactPath(EXPORT_PATH, "OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH", {
    mustExist: false
  });
  const { artifact: rehearsal, sha256: rehearsalSha256 } = readJsonArtifact(
    rehearsalPath.resolved,
    "source workflow rehearsal"
  );

  invariant(rehearsal.artifact_kind === "admin_source_workflow_rehearsal", "Source workflow rehearsal kind mismatch.");
  invariant(rehearsal.public_self_serve_launch_allowed === false, "Source workflow must keep public self-serve blocked.");
  invariant(rehearsal.source_runtime_write_allowed === false, "Source workflow must keep direct runtime writes blocked.");
  invariant(rehearsal.automatic_answer_approval_allowed === false, "Source workflow must keep automatic answer approval blocked.");
  invariant(rehearsal.task_generation_allowed === false, "Source workflow must keep task generation blocked.");
  invariant(rehearsal.email_or_notification_allowed === false, "Source workflow must keep email/notifications blocked.");
  invariant(rehearsal.live_provider_enablement_allowed === false, "Source workflow must keep live providers blocked.");
  assertBlockedGates(rehearsal, "Source workflow rehearsal");
  invariant(Array.isArray(rehearsal.manual_source_payload?.facts) && rehearsal.manual_source_payload.facts.length > 0, "Manual source facts required.");

  const ownerWorkspaceUrl = requireText("OUTPOST_ADMIN_SOURCE_APPLY_OWNER_WORKSPACE_URL", 240);
  const operatorLabel = requireText("OUTPOST_ADMIN_SOURCE_APPLY_OPERATOR_LABEL", 120);

  const artifact = {
    artifact_kind: "admin_source_apply_rehearsal",
    status: "source_apply_rehearsal_prepared",
    generated_at: new Date().toISOString(),
    gym_name: rehearsal.gym_name,
    owner_email: rehearsal.owner_email,
    source_label: rehearsal.source_label,
    location_label: rehearsal.location_label,
    operator_label: operatorLabel,
    owner_workspace_url: ownerWorkspaceUrl,
    source_workflow_rehearsal_path: rehearsalPath.relativePath,
    source_workflow_rehearsal_sha256: rehearsalSha256,
    manual_source_payload: rehearsal.manual_source_payload,
    browser_steps: [
      "Sign in as the operator-provisioned owner.",
      "Open the owner workspace and select the listed location.",
      "Paste the manual source payload through existing manual source intake.",
      "Stage proposals into answer review and verify no answer is approved automatically.",
      "Create an answer-derived staff task only through the existing owner review action if the owner approves the handoff."
    ],
    observed_completion_required: [
      "manual_source_saved",
      "answer_review_staged",
      "automatic_approval_not_observed",
      "live_provider_copy_still_blocked"
    ],
    artifact_runtime_write_allowed: false,
    existing_owner_manual_intake_allowed: true,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_or_notification_allowed: false,
    live_provider_enablement_allowed: false,
    public_self_serve_launch_allowed: false,
    blocked_gates: REQUIRED_GATES
  };

  assertNoSecretShapedKeys(artifact, "source apply rehearsal");
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "source apply rehearsal");
  mkdirSync(dirname(exportPath.resolved), { recursive: true });
  writeFileSync(exportPath.resolved, serialized);
  console.log("Admin source apply rehearsal prepared");
  console.log(`Artifact: ${exportPath.relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Artifact writes nothing; existing owner manual intake remains the only allowed write path.");
}

main();
