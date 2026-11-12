#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_OWNER_COMPLETION_PATH =
  "artifacts/admin-launch-readiness/admin-owner-access-completion-proof.json";
const DEFAULT_STAFF_HANDOFF_PATH =
  "artifacts/admin-launch-readiness/admin-staff-roster-handoff-evidence.json";
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

function normalizeArtifactPath(value, label, options = {}) {
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
  if (options.mustExist) invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
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

function requiredYes(envName) {
  const value = String(process.env[envName] ?? "").trim().toLowerCase();
  invariant(value === "yes" || value === "true" || value === "1", `${envName}=yes is required.`);
  return true;
}

function optionalText(envName, fallback, maxLength) {
  const value = String(process.env[envName] ?? fallback).trim();
  invariant(value && value.length <= maxLength, `${envName} invalid.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function assertOwnerCompletion(proof) {
  invariant(proof.artifact_kind === "admin_owner_access_completion_proof", "Owner completion proof kind mismatch.");
  invariant(proof.owner_access_completion_recorded === true, "Owner access completion required.");
  assertFalse(proof, "customer_observed_completion_recorded", "Customer-observed completion blocked.");
  assertFalse(proof, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(proof, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(proof, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
}

function assertStaffHandoff(evidence) {
  invariant(evidence.artifact_kind === "admin_staff_roster_claim_handoff_evidence", "Staff handoff evidence kind mismatch.");
  invariant(evidence.staff_roster_claim_handoff_recorded === true, "Staff handoff required.");
  assertFalse(evidence, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(evidence, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(evidence, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(evidence, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(evidence, "staff_grant_automatic", "Automatic staff grant blocked.");
  assertFalse(evidence, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
}

function main() {
  const ownerCompletionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH ?? DEFAULT_OWNER_COMPLETION_PATH,
    "OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH",
    { mustExist: true },
  );
  const staffHandoffPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH ?? DEFAULT_STAFF_HANDOFF_PATH,
    "OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH",
    { mustExist: true },
  );
  const rehearsalPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH ?? DEFAULT_REHEARSAL_PATH,
    "OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH",
  );
  invariant(!existsSync(rehearsalPath.resolved), "OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH already exists.");

  const { artifact: ownerCompletion, sha256: ownerCompletionSha256 } = readJsonArtifact(ownerCompletionPath.resolved, "owner completion proof");
  const { artifact: staffHandoff, sha256: staffHandoffSha256 } = readJsonArtifact(staffHandoffPath.resolved, "staff roster handoff evidence");
  assertOwnerCompletion(ownerCompletion);
  assertStaffHandoff(staffHandoff);
  invariant(ownerCompletion.reviewed_owner_email === staffHandoff.reviewed_owner_email, "Owner email mismatch.");

  const rehearsal = {
    artifact_kind: "admin_operator_assisted_onboarding_rehearsal",
    status: "admin_operator_assisted_onboarding_rehearsal_recorded",
    generated_at: new Date().toISOString(),
    evidence_basis: "owner_access_completion_and_staff_roster_handoff",
    owner_access_completion_proof_path: ownerCompletionPath.relativePath,
    owner_access_completion_proof_sha256: ownerCompletionSha256,
    staff_roster_handoff_evidence_path: staffHandoffPath.relativePath,
    staff_roster_handoff_evidence_sha256: staffHandoffSha256,
    reviewed_owner_email: ownerCompletion.reviewed_owner_email,
    staff_email: staffHandoff.staff_email,
    protected_preview_url: ownerCompletion.protected_preview_url,
    hosted_neon_branch: ownerCompletion.hosted_neon_branch,
    operator_label: optionalText("OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_OPERATOR", "operator-assisted-onboarding-rehearsal", 140),
    operator_assisted_onboarding_rehearsed: true,
    ready_for_internal_end_to_end_test: true,
    customer_observed_completion_recorded: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    observed: {
      owner_workspace_rehearsed: requiredYes("OUTPOST_ADMIN_OPERATOR_ONBOARDING_OWNER_WORKSPACE_REHEARSED"),
      staff_workboard_rehearsed: requiredYes("OUTPOST_ADMIN_OPERATOR_ONBOARDING_STAFF_WORKBOARD_REHEARSED"),
      manual_source_answer_task_flow_rehearsed: requiredYes("OUTPOST_ADMIN_OPERATOR_ONBOARDING_MANUAL_SOURCE_FLOW_REHEARSED"),
      reset_rollback_rehearsed: requiredYes("OUTPOST_ADMIN_OPERATOR_ONBOARDING_RESET_ROLLBACK_REHEARSED"),
      support_handoff_packet_rehearsed: requiredYes("OUTPOST_ADMIN_OPERATOR_ONBOARDING_SUPPORT_PACKET_REHEARSED"),
      live_provider_claims_not_observed: requiredYes("OUTPOST_ADMIN_OPERATOR_ONBOARDING_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED"),
    },
    blocked_gates: REQUIRED_BLOCKED_GATES,
    next_recommended_slice: "Prepare replayable handoff proof bundle before customer-observed gym handoff.",
  };

  assertNoSecretShapedKeys(rehearsal, "operator onboarding rehearsal");
  const serialized = `${JSON.stringify(rehearsal, null, 2)}\n`;
  mkdirSync(dirname(rehearsalPath.resolved), { recursive: true });
  writeFileSync(rehearsalPath.resolved, serialized);
  console.log(`Operator-assisted onboarding rehearsal wrote ${rehearsalPath.relativePath}`);
  console.log(`Rehearsal sha256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Internal end-to-end test readiness: prepared");
  console.log("Customer completion, public self-serve, invites, providers, member writes: blocked");
}

main();
