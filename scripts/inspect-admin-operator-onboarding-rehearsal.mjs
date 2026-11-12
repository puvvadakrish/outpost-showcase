#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_REHEARSAL_PATH =
  "artifacts/admin-launch-readiness/admin-operator-onboarding-rehearsal.json";
const REQUIRED_BLOCKED_GATES = [
  "Public owner self-signup",
  "Invite delivery",
  "Notification sending",
  "Phone/email provider activation",
  "Product Auth admin API",
  "Automatic owner/staff grants",
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

function assertObserved(rehearsal, key) {
  invariant(rehearsal.observed?.[key] === true, `Observed check ${key} must be true.`);
}

function main() {
  const rehearsalPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH ?? DEFAULT_REHEARSAL_PATH,
    "OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH",
  );
  const { artifact: rehearsal } = readJsonArtifact(rehearsalPath.resolved, "operator onboarding rehearsal");
  invariant(rehearsal.artifact_kind === "admin_operator_assisted_onboarding_rehearsal", "Operator rehearsal kind mismatch.");
  invariant(rehearsal.status === "admin_operator_assisted_onboarding_rehearsal_recorded", "Operator rehearsal status mismatch.");
  invariant(rehearsal.operator_assisted_onboarding_rehearsed === true, "Operator onboarding must be rehearsed.");
  invariant(rehearsal.ready_for_internal_end_to_end_test === true, "Internal end-to-end readiness required.");
  assertFalse(rehearsal, "customer_observed_completion_recorded", "Customer-observed completion blocked.");
  assertFalse(rehearsal, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(rehearsal, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(rehearsal, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(rehearsal, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(rehearsal, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(rehearsal, "automatic_owner_staff_grants_allowed", "Automatic owner/staff grants blocked.");
  assertFalse(rehearsal, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
  assertObserved(rehearsal, "owner_workspace_rehearsed");
  assertObserved(rehearsal, "staff_workboard_rehearsed");
  assertObserved(rehearsal, "manual_source_answer_task_flow_rehearsed");
  assertObserved(rehearsal, "reset_rollback_rehearsed");
  assertObserved(rehearsal, "support_handoff_packet_rehearsed");
  assertObserved(rehearsal, "live_provider_claims_not_observed");
  for (const gate of REQUIRED_BLOCKED_GATES) assertIncludes(rehearsal.blocked_gates, gate, "blocked gates");

  const ownerPath = normalizeArtifactPath(rehearsal.owner_access_completion_proof_path, "owner completion parent path");
  const staffPath = normalizeArtifactPath(rehearsal.staff_roster_handoff_evidence_path, "staff handoff parent path");
  const { artifact: ownerParent, sha256: ownerSha } = readJsonArtifact(ownerPath.resolved, "owner completion parent");
  const { artifact: staffParent, sha256: staffSha } = readJsonArtifact(staffPath.resolved, "staff handoff parent");
  invariant(ownerParent.artifact_kind === "admin_owner_access_completion_proof", "Owner parent kind mismatch.");
  invariant(staffParent.artifact_kind === "admin_staff_roster_claim_handoff_evidence", "Staff parent kind mismatch.");
  invariant(ownerSha === rehearsal.owner_access_completion_proof_sha256, "Owner parent SHA mismatch.");
  invariant(staffSha === rehearsal.staff_roster_handoff_evidence_sha256, "Staff parent SHA mismatch.");
  console.log("Operator-assisted onboarding rehearsal OK");
  console.log(`Artifact: ${rehearsalPath.relativePath}`);
  console.log("Ready for internal end-to-end test; public/customer/live-provider gates remain blocked.");
}

main();
