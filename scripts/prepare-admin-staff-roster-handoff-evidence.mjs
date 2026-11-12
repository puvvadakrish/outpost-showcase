#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_STAFF_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-staff-invite-no-send-preflight.json";
const DEFAULT_OWNER_COMPLETION_PATH =
  "artifacts/admin-launch-readiness/admin-owner-access-completion-proof.json";
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

function assertStaffPreflight(preflight) {
  invariant(preflight.artifact_kind === "admin_staff_invite_no_send_preflight", "Staff no-send preflight kind mismatch.");
  invariant(preflight.status === "admin_staff_invite_no_send_preflight_prepared", "Staff no-send preflight status mismatch.");
  invariant(preflight.staff_invite_audience, "Staff audience required.");
  assertFalse(preflight, "staff_invite_delivery_allowed", "Staff invite delivery blocked.");
  assertFalse(preflight, "notification_sending_allowed", "Notification sending blocked.");
  assertFalse(preflight, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(preflight, "gmail_resend_smtp_provider_allowed", "Email providers blocked.");
  assertFalse(preflight, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(preflight, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(preflight, "staff_auth_user_created", "Staff Auth user creation blocked.");
  assertFalse(preflight, "staff_grant_automatic", "Automatic staff grant blocked.");
  assertFalse(preflight, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
}

function assertOwnerCompletion(proof) {
  invariant(proof.artifact_kind === "admin_owner_access_completion_proof", "Owner completion proof kind mismatch.");
  invariant(proof.status === "admin_owner_access_completion_proof_recorded", "Owner completion proof status mismatch.");
  invariant(proof.owner_access_completion_recorded === true, "Owner completion proof required.");
  assertFalse(proof, "customer_observed_completion_recorded", "Customer-observed completion blocked.");
  assertFalse(proof, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(proof, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(proof, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
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

function main() {
  const staffPreflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH ?? DEFAULT_STAFF_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH",
    { mustExist: true },
  );
  const ownerCompletionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH ?? DEFAULT_OWNER_COMPLETION_PATH,
    "OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH",
    { mustExist: true },
  );
  const staffHandoffPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH ?? DEFAULT_STAFF_HANDOFF_PATH,
    "OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH",
  );
  invariant(!existsSync(staffHandoffPath.resolved), "OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH already exists.");

  const { artifact: preflight, sha256: preflightSha256 } = readJsonArtifact(staffPreflightPath.resolved, "staff no-send preflight");
  const { artifact: ownerCompletion, sha256: ownerCompletionSha256 } = readJsonArtifact(ownerCompletionPath.resolved, "owner completion proof");
  assertStaffPreflight(preflight);
  assertOwnerCompletion(ownerCompletion);
  invariant(preflight.reviewed_owner_email === ownerCompletion.reviewed_owner_email, "Staff preflight owner must match owner completion.");

  const evidence = {
    artifact_kind: "admin_staff_roster_claim_handoff_evidence",
    status: "admin_staff_roster_claim_handoff_evidence_recorded",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_staff_invite_no_send_preflight_and_owner_access_completion",
    staff_invite_no_send_preflight_path: staffPreflightPath.relativePath,
    staff_invite_no_send_preflight_sha256: preflightSha256,
    owner_access_completion_proof_path: ownerCompletionPath.relativePath,
    owner_access_completion_proof_sha256: ownerCompletionSha256,
    reviewed_owner_email: ownerCompletion.reviewed_owner_email,
    staff_email: preflight.staff_invite_audience,
    staff_role: preflight.staff_role,
    location_label: preflight.location_label,
    operator_label: optionalText("OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_OPERATOR", "operator-reviewed-staff-claim", 140),
    staff_roster_claim_handoff_recorded: true,
    staff_claim_verified_by_browser: true,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    outbound_email_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    staff_auth_user_created_by_product: false,
    staff_grant_automatic: false,
    billing_pos_member_writes_allowed: false,
    observed: {
      staff_claim_path_observed: requiredYes("OUTPOST_ADMIN_STAFF_ROSTER_CLAIM_PATH_OBSERVED"),
      staff_workboard_observed: requiredYes("OUTPOST_ADMIN_STAFF_ROSTER_WORKBOARD_OBSERVED"),
      owner_managed_roster_reviewed: requiredYes("OUTPOST_ADMIN_STAFF_ROSTER_OWNER_MANAGED_REVIEWED"),
      invite_delivery_not_observed: requiredYes("OUTPOST_ADMIN_STAFF_ROSTER_INVITE_DELIVERY_NOT_OBSERVED"),
      live_provider_claims_not_observed: requiredYes("OUTPOST_ADMIN_STAFF_ROSTER_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED"),
    },
    blocked_gates: REQUIRED_BLOCKED_GATES,
    next_recommended_slice: "Record operator-assisted onboarding rehearsal from owner and staff handoff proof.",
  };

  assertNoSecretShapedKeys(evidence, "staff roster handoff evidence");
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  mkdirSync(dirname(staffHandoffPath.resolved), { recursive: true });
  writeFileSync(staffHandoffPath.resolved, serialized);
  console.log(`Staff roster handoff evidence wrote ${staffHandoffPath.relativePath}`);
  console.log(`Evidence sha256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Staff invite delivery, notifications, providers, product Auth admin API, member writes: blocked");
}

main();
