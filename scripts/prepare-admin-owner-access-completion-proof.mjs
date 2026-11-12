#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_OWNER_ACCESS_PATH =
  "artifacts/admin-launch-readiness/admin-owner-access-fulfillment-evidence.json";
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
  invariant(
    relativePath.startsWith(`artifacts${sep}`) || relativePath === "artifacts",
    `${label} must be under artifacts/.`,
  );
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  }
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJsonArtifact(path, label) {
  const source = readFileSync(path, "utf8");
  const artifact = JSON.parse(source);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: sha256(source) };
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function assertOwnerAccessEvidence(evidence) {
  invariant(
    evidence.artifact_kind === "admin_owner_access_fulfillment_evidence",
    "Owner access evidence kind mismatch.",
  );
  invariant(
    evidence.status === "admin_owner_access_fulfillment_evidence_prepared",
    "Owner access evidence status mismatch.",
  );
  invariant(evidence.reviewed_owner_email, "Reviewed owner email required.");
  assertFalse(evidence, "owner_access_created_by_product", "Product owner access creation blocked.");
  assertFalse(evidence, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(evidence, "automatic_owner_grant_allowed", "Automatic owner grant blocked.");
  assertFalse(evidence, "browser_approval_buttons_allowed", "Browser approval blocked.");
  assertFalse(evidence, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(evidence, "notification_sending_allowed", "Notification sending blocked.");
  assertFalse(evidence, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(evidence, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
}

function requiredYes(envName) {
  const value = String(process.env[envName] ?? "").trim().toLowerCase();
  invariant(value === "yes" || value === "true" || value === "1", `${envName}=yes is required.`);
  return true;
}

function requiredText(envName, maxLength) {
  const value = String(process.env[envName] ?? "").trim();
  invariant(value && value.length <= maxLength, `${envName} required.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function optionalText(envName, fallback, maxLength) {
  const value = String(process.env[envName] ?? fallback).trim();
  invariant(value && value.length <= maxLength, `${envName} invalid.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function assertHttpsNonLocal(value, label) {
  invariant(value.startsWith("https://"), `${label} must use https.`);
  invariant(!/^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?/iu.test(value), `${label} must not be local.`);
}

function main() {
  const ownerAccessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH ?? DEFAULT_OWNER_ACCESS_PATH,
    "OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH",
    { mustExist: true },
  );
  const completionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH ?? DEFAULT_COMPLETION_PATH,
    "OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH",
  );
  invariant(!existsSync(completionPath.resolved), "OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH already exists.");

  const { artifact: ownerAccess, sha256: ownerAccessSha256 } = readJsonArtifact(
    ownerAccessPath.resolved,
    "owner access fulfillment evidence",
  );
  assertOwnerAccessEvidence(ownerAccess);

  const previewUrl = requiredText("OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PREVIEW_URL", 260);
  assertHttpsNonLocal(previewUrl, "OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PREVIEW_URL");
  const branchName = optionalText("OUTPOST_NEON_BRANCH_NAME", "reviewed-hosted-neon-branch", 180);
  const operatorLabel = optionalText("OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_OPERATOR", "operator-reviewed-browser-proof", 140);

  const proof = {
    artifact_kind: "admin_owner_access_completion_proof",
    status: "admin_owner_access_completion_proof_recorded",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_owner_access_fulfillment_evidence",
    owner_access_fulfillment_evidence_path: ownerAccessPath.relativePath,
    owner_access_fulfillment_evidence_sha256: ownerAccessSha256,
    reviewed_owner_email: ownerAccess.reviewed_owner_email,
    protected_preview_url: previewUrl,
    hosted_neon_branch: branchName,
    operator_label: operatorLabel,
    owner_access_completion_recorded: true,
    owner_access_verified_by_browser: true,
    customer_observed_completion_recorded: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_grant_allowed: false,
    browser_approval_buttons_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    observed: {
      protected_preview_sign_in_observed: requiredYes("OUTPOST_ADMIN_OWNER_ACCESS_PREVIEW_SIGN_IN_OBSERVED"),
      owner_workspace_observed: requiredYes("OUTPOST_ADMIN_OWNER_ACCESS_WORKSPACE_OBSERVED"),
      support_handoff_packet_reviewed: requiredYes("OUTPOST_ADMIN_OWNER_ACCESS_HANDOFF_PACKET_REVIEWED"),
      reset_rollback_reviewed: requiredYes("OUTPOST_ADMIN_OWNER_ACCESS_RESET_ROLLBACK_REVIEWED"),
      unexpected_data_not_observed: requiredYes("OUTPOST_ADMIN_OWNER_ACCESS_UNEXPECTED_DATA_NOT_OBSERVED"),
      live_provider_claims_not_observed: requiredYes("OUTPOST_ADMIN_OWNER_ACCESS_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED"),
    },
    blocked_gates: REQUIRED_BLOCKED_GATES,
    next_recommended_slice: "Record staff roster claim handoff evidence without invite delivery.",
  };

  assertNoSecretShapedKeys(proof, "owner access completion proof");
  const serialized = `${JSON.stringify(proof, null, 2)}\n`;
  mkdirSync(dirname(completionPath.resolved), { recursive: true });
  writeFileSync(completionPath.resolved, serialized);
  console.log(`Owner access completion proof wrote ${completionPath.relativePath}`);
  console.log(`Proof sha256: ${sha256(serialized)}`);
  console.log("Customer-observed completion: blocked");
  console.log("Live providers, invite delivery, billing/POS/member writes: blocked");
}

main();
