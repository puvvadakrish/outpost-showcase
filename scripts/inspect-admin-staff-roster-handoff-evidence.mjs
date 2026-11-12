#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_STAFF_HANDOFF_PATH =
  "artifacts/admin-launch-readiness/admin-staff-roster-handoff-evidence.json";
const REQUIRED_BLOCKED_GATES = [
  "Staff invite delivery send",
  "Notification sending",
  "Gmail, Resend, SMTP, provider webhooks",
  "Phone/email provider activation",
  "Product Auth admin API",
  "Automatic staff grant",
  "Billing, POS, access control, member-ledger writes",
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

function assertObserved(evidence, key) {
  invariant(evidence.observed?.[key] === true, `Observed check ${key} must be true.`);
}

function main() {
  const staffHandoffPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH ?? DEFAULT_STAFF_HANDOFF_PATH,
    "OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH",
  );
  const { artifact: evidence } = readJsonArtifact(staffHandoffPath.resolved, "staff roster handoff evidence");
  invariant(evidence.artifact_kind === "admin_staff_roster_claim_handoff_evidence", "Staff roster handoff evidence kind mismatch.");
  invariant(evidence.status === "admin_staff_roster_claim_handoff_evidence_recorded", "Staff roster handoff status mismatch.");
  invariant(evidence.staff_roster_claim_handoff_recorded === true, "Staff roster claim handoff must be recorded.");
  invariant(evidence.staff_claim_verified_by_browser === true, "Staff browser claim proof required.");
  assertFalse(evidence, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(evidence, "notification_sending_allowed", "Notification sending blocked.");
  assertFalse(evidence, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(evidence, "gmail_resend_smtp_provider_allowed", "Email providers blocked.");
  assertFalse(evidence, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(evidence, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(evidence, "staff_auth_user_created_by_product", "Staff Auth user product creation blocked.");
  assertFalse(evidence, "staff_grant_automatic", "Automatic staff grant blocked.");
  assertFalse(evidence, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
  assertObserved(evidence, "staff_claim_path_observed");
  assertObserved(evidence, "staff_workboard_observed");
  assertObserved(evidence, "owner_managed_roster_reviewed");
  assertObserved(evidence, "invite_delivery_not_observed");
  assertObserved(evidence, "live_provider_claims_not_observed");
  for (const gate of REQUIRED_BLOCKED_GATES) assertIncludes(evidence.blocked_gates, gate, "blocked gates");

  const staffParentPath = normalizeArtifactPath(evidence.staff_invite_no_send_preflight_path, "staff preflight parent path");
  const ownerParentPath = normalizeArtifactPath(evidence.owner_access_completion_proof_path, "owner completion parent path");
  const { artifact: staffParent, sha256: staffParentSha256 } = readJsonArtifact(staffParentPath.resolved, "staff preflight parent");
  const { artifact: ownerParent, sha256: ownerParentSha256 } = readJsonArtifact(ownerParentPath.resolved, "owner completion parent");
  invariant(staffParent.artifact_kind === "admin_staff_invite_no_send_preflight", "Staff preflight parent kind mismatch.");
  invariant(ownerParent.artifact_kind === "admin_owner_access_completion_proof", "Owner completion parent kind mismatch.");
  invariant(staffParentSha256 === evidence.staff_invite_no_send_preflight_sha256, "Staff preflight parent SHA256 mismatch.");
  invariant(ownerParentSha256 === evidence.owner_access_completion_proof_sha256, "Owner completion parent SHA256 mismatch.");
  invariant(staffParent.reviewed_owner_email === ownerParent.reviewed_owner_email, "Parent owner emails must match.");
  console.log("Staff roster handoff evidence OK");
  console.log(`Artifact: ${staffHandoffPath.relativePath}`);
  console.log("Staff invite delivery, notifications, providers, product Auth admin API, member writes remain blocked.");
}

main();
