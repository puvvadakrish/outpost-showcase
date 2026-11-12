#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_COMPLETION_PATH =
  "artifacts/admin-launch-readiness/admin-owner-access-completion-proof.json";
const REQUIRED_BLOCKED_GATES = [
  "Product Auth admin API",
  "Automatic owner grant",
  "Browser approval buttons",
  "Invite delivery send",
  "Notification sending",
  "Phone/email provider activation",
  "Billing, POS, access control, member-ledger writes",
  "Customer-observed completion claim",
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeArtifactPath(value, label) {
  invariant(value && typeof value === "string", `${label} required.`);
  invariant(!value.includes("\0"), `${label} cannot contain NUL.`);
  const resolved = resolve(value);
  const cwd = resolve(process.cwd());
  const relativePath = relative(cwd, resolved);
  invariant(
    !isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`),
    `${label} must stay inside repository.`,
  );
  invariant(relativePath.startsWith(`artifacts${sep}`), `${label} must be under artifacts/.`);
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  return { relativePath, resolved };
}

function assertNoSecretShapedValue(value, label) {
  if (typeof value !== "string") return;
  const lower = value.toLowerCase();
  const secretLike =
    lower.includes("napi_") ||
    lower.includes("vercel_automation_bypass") ||
    lower.includes("supabase") ||
    lower.includes("bearer ") ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(value) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/u.test(value);
  invariant(!secretLike, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (!value || typeof value !== "object") return;
  for (const [key, nestedValue] of Object.entries(value)) {
    const path = [...trail, key].join(".");
    const normalizedKey = key.toLowerCase();
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("key") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("signature") ||
      normalizedKey.includes("jwt");
    invariant(!secretKey, `${label} contains secret-shaped key: ${path}`);
    assertNoSecretShapedValue(nestedValue, `${label}.${path}`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function readJsonArtifact(path, label) {
  const source = readFileSync(path, "utf8");
  const artifact = JSON.parse(source);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: createHash("sha256").update(source).digest("hex") };
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function assertObserved(proof, key) {
  invariant(proof.observed?.[key] === true, `Observed check ${key} must be true.`);
}

function main() {
  const completionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH ?? DEFAULT_COMPLETION_PATH,
    "OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH",
  );
  const { artifact: proof } = readJsonArtifact(completionPath.resolved, "owner access completion proof");
  invariant(proof.artifact_kind === "admin_owner_access_completion_proof", "Owner access completion proof kind mismatch.");
  invariant(proof.status === "admin_owner_access_completion_proof_recorded", "Owner access completion proof status mismatch.");
  invariant(proof.evidence_basis === "admin_owner_access_fulfillment_evidence", "Owner access completion evidence basis mismatch.");
  invariant(proof.owner_access_completion_recorded === true, "Owner access completion must be recorded.");
  invariant(proof.owner_access_verified_by_browser === true, "Owner access browser proof required.");
  assertFalse(proof, "customer_observed_completion_recorded", "Customer-observed completion must remain blocked.");
  assertFalse(proof, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(proof, "automatic_owner_grant_allowed", "Automatic owner grant blocked.");
  assertFalse(proof, "browser_approval_buttons_allowed", "Browser approval blocked.");
  assertFalse(proof, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(proof, "notification_sending_allowed", "Notification sending blocked.");
  assertFalse(proof, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(proof, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
  assertObserved(proof, "protected_preview_sign_in_observed");
  assertObserved(proof, "owner_workspace_observed");
  assertObserved(proof, "support_handoff_packet_reviewed");
  assertObserved(proof, "reset_rollback_reviewed");
  assertObserved(proof, "unexpected_data_not_observed");
  assertObserved(proof, "live_provider_claims_not_observed");
  for (const gate of REQUIRED_BLOCKED_GATES) assertIncludes(proof.blocked_gates, gate, "blocked gates");

  const parentPath = normalizeArtifactPath(proof.owner_access_fulfillment_evidence_path, "owner access parent path");
  const { artifact: parent, sha256: parentSha256 } = readJsonArtifact(parentPath.resolved, "owner access parent");
  invariant(parent.artifact_kind === "admin_owner_access_fulfillment_evidence", "Owner access parent kind mismatch.");
  invariant(parentSha256 === proof.owner_access_fulfillment_evidence_sha256, "Owner access parent SHA256 mismatch.");
  console.log("Owner access completion proof OK");
  console.log(`Artifact: ${completionPath.relativePath}`);
  console.log("Customer-observed completion, live providers, invite delivery, billing/POS/member writes remain blocked.");
}

main();
