#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BUNDLE_PATH =
  "artifacts/admin-launch-readiness/admin-handoff-proof-bundle.json";
const BLOCKED_GATES = [
  "Public owner self-signup",
  "Invite delivery",
  "Notification sending",
  "Phone/email provider activation",
  "Product Auth admin API",
  "Automatic owner/staff grants",
  "Billing, POS, access control, member-ledger writes",
  "Customer-observed completion claim",
];
const READY_GATES = [
  "Owner access browser proof",
  "Staff roster claim proof",
  "Operator-assisted onboarding rehearsal",
  "Reset and rollback reviewed",
  "No unexpected data observed",
  "No live-provider claims observed",
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

function assertOwnerCompletion(proof) {
  invariant(
    proof.artifact_kind === "admin_owner_access_completion_proof",
    "Owner completion proof kind mismatch.",
  );
  invariant(
    proof.owner_access_completion_recorded === true,
    "Owner access completion required.",
  );
  assertFalse(
    proof,
    "customer_observed_completion_recorded",
    "Customer-observed completion blocked.",
  );
  assertFalse(proof, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(
    proof,
    "live_provider_enablement_allowed",
    "Live providers blocked.",
  );
  assertFalse(
    proof,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes blocked.",
  );
}

function assertStaffHandoff(evidence) {
  invariant(
    evidence.artifact_kind === "admin_staff_roster_claim_handoff_evidence",
    "Staff handoff evidence kind mismatch.",
  );
  invariant(
    evidence.staff_roster_claim_handoff_recorded === true,
    "Staff handoff required.",
  );
  assertFalse(evidence, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(
    evidence,
    "notification_sending_allowed",
    "Notifications blocked.",
  );
  assertFalse(
    evidence,
    "live_provider_enablement_allowed",
    "Live providers blocked.",
  );
  assertFalse(
    evidence,
    "product_auth_admin_api_allowed",
    "Product Auth admin API blocked.",
  );
  assertFalse(
    evidence,
    "staff_grant_automatic",
    "Automatic staff grant blocked.",
  );
  assertFalse(
    evidence,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes blocked.",
  );
}

function main() {
  const bundlePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH ?? DEFAULT_BUNDLE_PATH,
    "OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH",
  );
  const { artifact: bundle } = readJsonArtifact(bundlePath.resolved, "handoff proof bundle");
  invariant(bundle.artifact_kind === "admin_handoff_proof_bundle", "Handoff proof bundle kind mismatch.");
  invariant(bundle.status === "admin_handoff_proof_bundle_prepared", "Handoff proof bundle status mismatch.");
  invariant(bundle.ready_for_internal_end_to_end_test === true, "Internal end-to-end readiness required.");
  assertFalse(bundle, "customer_observed_completion_recorded", "Customer-observed completion blocked.");
  assertFalse(bundle, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(bundle, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(bundle, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(bundle, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(bundle, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(bundle, "automatic_owner_staff_grants_allowed", "Automatic owner/staff grants blocked.");
  assertFalse(bundle, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
  for (const gate of BLOCKED_GATES) assertIncludes(bundle.blocked_gates, gate, "blocked gates");
  for (const gate of READY_GATES) assertIncludes(bundle.ready_gates, gate, "ready gates");
  assertIncludes(bundle.replay_commands, "npm run admin:handoff-proof:bundle:inspect", "replay commands");

  const rehearsalPath = normalizeArtifactPath(bundle.operator_onboarding_rehearsal_path, "operator rehearsal parent path");
  const { artifact: rehearsal, sha256: rehearsalSha } = readJsonArtifact(rehearsalPath.resolved, "operator rehearsal parent");
  invariant(rehearsal.artifact_kind === "admin_operator_assisted_onboarding_rehearsal", "Operator rehearsal parent kind mismatch.");
  invariant(rehearsalSha === bundle.operator_onboarding_rehearsal_sha256, "Operator rehearsal parent SHA mismatch.");
  invariant(rehearsal.ready_for_internal_end_to_end_test === true, "Operator rehearsal must be ready for internal test.");

  const ownerCompletionPath = normalizeArtifactPath(
    rehearsal.owner_access_completion_proof_path,
    "owner completion grandparent path",
  );
  const { artifact: ownerCompletion, sha256: ownerCompletionSha } =
    readJsonArtifact(ownerCompletionPath.resolved, "owner completion grandparent");
  assertOwnerCompletion(ownerCompletion);
  invariant(
    ownerCompletionSha === rehearsal.owner_access_completion_proof_sha256,
    "Owner completion grandparent SHA mismatch.",
  );

  const ownerAccessPath = normalizeArtifactPath(
    ownerCompletion.owner_access_fulfillment_evidence_path,
    "owner access root path",
  );
  const { artifact: ownerAccess, sha256: ownerAccessSha } = readJsonArtifact(
    ownerAccessPath.resolved,
    "owner access root",
  );
  invariant(
    ownerAccess.artifact_kind === "admin_owner_access_fulfillment_evidence",
    "Owner access root kind mismatch.",
  );
  invariant(
    ownerAccessSha === ownerCompletion.owner_access_fulfillment_evidence_sha256,
    "Owner access root SHA mismatch.",
  );

  const staffHandoffPath = normalizeArtifactPath(
    rehearsal.staff_roster_handoff_evidence_path,
    "staff handoff grandparent path",
  );
  const { artifact: staffHandoff, sha256: staffHandoffSha } = readJsonArtifact(
    staffHandoffPath.resolved,
    "staff handoff grandparent",
  );
  assertStaffHandoff(staffHandoff);
  invariant(
    staffHandoffSha === rehearsal.staff_roster_handoff_evidence_sha256,
    "Staff handoff grandparent SHA mismatch.",
  );
  invariant(
    ownerCompletion.reviewed_owner_email === staffHandoff.reviewed_owner_email,
    "Owner completion and staff handoff owner email mismatch.",
  );
  invariant(
    ownerCompletion.reviewed_owner_email === bundle.reviewed_owner_email,
    "Bundle owner email mismatch.",
  );

  console.log("Admin handoff proof bundle OK");
  console.log(`Artifact: ${bundlePath.relativePath}`);
  console.log("Ready for internal end-to-end test; customer/public/live-provider gates remain blocked.");
}

main();
