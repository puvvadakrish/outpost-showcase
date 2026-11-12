#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_OWNER_ACCESS_PATH =
  "artifacts/admin-launch-readiness/admin-owner-access-fulfillment-evidence.json";
const REQUIRED_BLOCKED_GATES = [
  "Product Auth admin API",
  "Automatic owner grant",
  "Browser approval buttons",
  "Invite delivery send",
  "Notification sending",
  "Phone/email provider activation",
  "Billing, POS, access control, member-ledger writes",
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
  invariant(
    relativePath.startsWith(`artifacts${sep}`) || relativePath === "artifacts",
    `${label} must under artifacts/.`,
  );
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON artifact.`);
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  return { relativePath, resolved };
}

function assertNoSecretShapedValue(value, label) {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    const secretLike =
      lower.includes("napi_") ||
      lower.includes("vercel_automation_bypass") ||
      lower.includes("supabase") ||
      lower.includes("bearer ");
    invariant(!secretLike, `${label} contains secret-shaped value.`);
  }
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (!value || typeof value !== "object") {
    return;
  }
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

function main() {
  const ownerAccessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH ??
      DEFAULT_OWNER_ACCESS_PATH,
    "OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH",
  );
  const { artifact: evidence } = readJsonArtifact(
    ownerAccessPath.resolved,
    "owner access fulfillment evidence",
  );

  invariant(
    evidence.artifact_kind === "admin_owner_access_fulfillment_evidence",
    "Owner access fulfillment evidence artifact kind mismatch.",
  );
  invariant(
    evidence.status === "admin_owner_access_fulfillment_evidence_prepared",
    "Owner access fulfillment evidence status mismatch.",
  );
  invariant(
    evidence.fulfillment_mode === "operator_managed_review_only",
    "Owner access fulfillment must remain operator-managed.",
  );
  invariant(evidence.reviewed_owner_email, "Reviewed owner email required.");
  assertFalse(
    evidence,
    "owner_access_verified_by_artifact",
    "Customer-visible owner access proof remains separate.",
  );
  assertFalse(
    evidence,
    "owner_access_created_by_product",
    "Product owner access creation blocked.",
  );
  assertFalse(
    evidence,
    "product_auth_admin_api_allowed",
    "Product Auth admin API blocked.",
  );
  assertFalse(
    evidence,
    "auth_admin_product_api_allowed",
    "Auth admin product API blocked.",
  );
  assertFalse(
    evidence,
    "automatic_owner_grant_allowed",
    "Automatic owner grant blocked.",
  );
  assertFalse(
    evidence,
    "browser_approval_buttons_allowed",
    "Browser approval buttons blocked.",
  );
  assertFalse(evidence, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(
    evidence,
    "notification_sending_allowed",
    "Notification sending blocked.",
  );
  assertFalse(
    evidence,
    "live_provider_enablement_allowed",
    "Live providers blocked.",
  );
  assertFalse(
    evidence,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes blocked.",
  );
  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(evidence.blocked_gates, gate, "owner access blocked gates");
  }

  console.log(`Owner access fulfillment evidence OK: ${ownerAccessPath.relativePath}`);
  console.log(`Reviewed owner email: ${evidence.reviewed_owner_email}`);
  console.log("Product Auth admin API: blocked");
  console.log("Automatic owner grant: blocked");
}

main();
