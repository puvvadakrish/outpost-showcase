#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_AUTH_DRY_RUN_PATH =
  "artifacts/admin-launch-readiness/admin-auth-admin-provisioning-dry-run.json";
const REQUIRED_BLOCKED_GATES = [
  "Product Auth admin API",
  "Automatic owner grant",
  "Invite delivery send",
  "Notification sending",
  "Browser approval buttons",
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
    `${label} must be under artifacts/.`,
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
  const dryRunPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH ??
      DEFAULT_AUTH_DRY_RUN_PATH,
    "OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH",
  );
  const { artifact: dryRun } = readJsonArtifact(
    dryRunPath.resolved,
    "Auth admin provisioning dry-run",
  );
  invariant(
    dryRun.artifact_kind === "admin_auth_admin_provisioning_dry_run",
    "Auth admin provisioning dry-run artifact kind mismatch.",
  );
  invariant(
    dryRun.status === "admin_auth_admin_provisioning_dry_run_prepared",
    "Auth admin provisioning dry-run status mismatch.",
  );
  invariant(
    dryRun.provisioning_mode === "operator_review_only_no_user_created",
    "Provisioning mode must remain operator-review-only.",
  );
  invariant(dryRun.reviewed_owner_email, "Reviewed owner email required.");
  assertFalse(dryRun, "auth_user_created", "Auth user creation blocked.");
  assertFalse(
    dryRun,
    "product_auth_admin_api_allowed",
    "Product Auth admin API blocked.",
  );
  assertFalse(
    dryRun,
    "auth_admin_product_api_allowed",
    "Auth admin product API blocked.",
  );
  assertFalse(
    dryRun,
    "owner_grant_automatic",
    "Automatic owner grant blocked.",
  );
  assertFalse(dryRun, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(
    dryRun,
    "notification_sending_allowed",
    "Notification sending blocked.",
  );
  assertFalse(
    dryRun,
    "browser_approval_buttons_allowed",
    "Browser approval buttons blocked.",
  );
  assertFalse(
    dryRun,
    "live_provider_enablement_allowed",
    "Live providers blocked.",
  );
  assertFalse(
    dryRun,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes blocked.",
  );
  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(dryRun.blocked_gates, gate, "auth admin blocked gates");
  }

  console.log(`Auth admin provisioning dry-run OK: ${dryRunPath.relativePath}`);
  console.log(`Reviewed owner email: ${dryRun.reviewed_owner_email}`);
  console.log("Auth user created: false");
  console.log("Product Auth admin API: blocked");
}

main();
