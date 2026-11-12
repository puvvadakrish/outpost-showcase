#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_AUTH_DRY_RUN_PATH =
  "artifacts/admin-launch-readiness/admin-auth-admin-provisioning-dry-run.json";
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
    `${label} must under artifacts/.`,
  );
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON artifact.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  }
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

function assertAuthAdminDryRun(dryRun) {
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
    "Auth admin dry-run must remain operator-review-only.",
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
  assertFalse(dryRun, "owner_grant_automatic", "Automatic owner grant blocked.");
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
}

function optionalText(envName, fallback, maxLength) {
  const value = process.env[envName]?.trim() || fallback;
  invariant(value && value.length <= maxLength, `${envName} is invalid.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function main() {
  const authDryRunPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH ??
      DEFAULT_AUTH_DRY_RUN_PATH,
    "OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH",
    { mustExist: true },
  );
  const ownerAccessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH ??
      DEFAULT_OWNER_ACCESS_PATH,
    "OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH",
  );
  invariant(
    !existsSync(ownerAccessPath.resolved),
    "OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH already exists.",
  );

  const { artifact: authDryRun, sha256: authDryRunSha256 } = readJsonArtifact(
    authDryRunPath.resolved,
    "Auth admin provisioning dry-run",
  );
  assertAuthAdminDryRun(authDryRun);

  const ownerEmail = optionalText(
    "OUTPOST_ADMIN_OWNER_ACCESS_EMAIL",
    authDryRun.reviewed_owner_email,
    180,
  );
  const operatorMethod = optionalText(
    "OUTPOST_ADMIN_OWNER_ACCESS_METHOD",
    "operator-runbook-reviewed-neon-auth-and-owner-grant",
    180,
  );

  const evidence = {
    artifact_kind: "admin_owner_access_fulfillment_evidence",
    status: "admin_owner_access_fulfillment_evidence_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_auth_admin_provisioning_dry_run",
    auth_admin_provisioning_dry_run_path: authDryRunPath.relativePath,
    auth_admin_provisioning_dry_run_sha256: authDryRunSha256,
    fulfillment_mode: "operator_managed_review_only",
    reviewed_owner_email: ownerEmail,
    operator_access_method: operatorMethod,
    owner_access_verified_by_artifact: false,
    owner_access_created_by_product: false,
    product_auth_admin_api_allowed: false,
    auth_admin_product_api_allowed: false,
    automatic_owner_grant_allowed: false,
    browser_approval_buttons_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: REQUIRED_BLOCKED_GATES,
    operator_checklist: [
      "Confirm owner email matches reviewed invite and Auth dry-run metadata.",
      "Create or verify owner access only through the operator runbook.",
      "Record customer-visible completion separately after owner sign-in proof.",
      "Do not expose product Auth admin APIs or browser approval buttons.",
    ],
    next_recommended_slice:
      "Prepare staff invite no-send preflight after owner access evidence is reviewed.",
  };

  mkdirSync(dirname(ownerAccessPath.resolved), { recursive: true });
  writeFileSync(ownerAccessPath.resolved, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log(`Owner access fulfillment evidence written: ${ownerAccessPath.relativePath}`);
  console.log(`Reviewed owner email: ${ownerEmail}`);
  console.log("Product Auth admin API: blocked");
  console.log("Automatic owner grant: blocked");
}

main();
