#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_REHEARSAL_PATH =
  "artifacts/admin-launch-readiness/admin-operator-onboarding-rehearsal.json";
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

function assertRehearsal(rehearsal) {
  invariant(rehearsal.artifact_kind === "admin_operator_assisted_onboarding_rehearsal", "Operator rehearsal kind mismatch.");
  invariant(rehearsal.status === "admin_operator_assisted_onboarding_rehearsal_recorded", "Operator rehearsal status mismatch.");
  invariant(rehearsal.ready_for_internal_end_to_end_test === true, "Internal end-to-end readiness required.");
  assertFalse(rehearsal, "customer_observed_completion_recorded", "Customer-observed completion blocked.");
  assertFalse(rehearsal, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(rehearsal, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(rehearsal, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(rehearsal, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(rehearsal, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(rehearsal, "automatic_owner_staff_grants_allowed", "Automatic owner/staff grants blocked.");
  assertFalse(rehearsal, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
}

function main() {
  const rehearsalPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH ?? DEFAULT_REHEARSAL_PATH,
    "OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH",
    { mustExist: true },
  );
  const bundlePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH ?? DEFAULT_BUNDLE_PATH,
    "OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH",
  );
  invariant(!existsSync(bundlePath.resolved), "OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH already exists.");
  const { artifact: rehearsal, sha256: rehearsalSha256 } = readJsonArtifact(rehearsalPath.resolved, "operator onboarding rehearsal");
  assertRehearsal(rehearsal);

  const bundle = {
    artifact_kind: "admin_handoff_proof_bundle",
    status: "admin_handoff_proof_bundle_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_operator_assisted_onboarding_rehearsal",
    operator_onboarding_rehearsal_path: rehearsalPath.relativePath,
    operator_onboarding_rehearsal_sha256: rehearsalSha256,
    reviewed_owner_email: rehearsal.reviewed_owner_email,
    staff_email: rehearsal.staff_email,
    protected_preview_url: rehearsal.protected_preview_url,
    hosted_neon_branch: rehearsal.hosted_neon_branch,
    ready_for_internal_end_to_end_test: true,
    customer_observed_completion_recorded: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    ready_gates: READY_GATES,
    blocked_gates: BLOCKED_GATES,
    replay_commands: [
      "npm run admin:owner-access:completion-proof:inspect",
      "npm run admin:staff-roster:handoff-evidence:inspect",
      "npm run admin:operator-onboarding:rehearsal:inspect",
      "npm run admin:handoff-proof:bundle:inspect",
    ],
    next_recommended_slice:
      "Run the protected Preview owner/staff browser walkthrough against this bundle, then schedule the customer-observed gym handoff.",
  };

  assertNoSecretShapedKeys(bundle, "handoff proof bundle");
  const serialized = `${JSON.stringify(bundle, null, 2)}\n`;
  mkdirSync(dirname(bundlePath.resolved), { recursive: true });
  writeFileSync(bundlePath.resolved, serialized);
  console.log(`Admin handoff proof bundle wrote ${bundlePath.relativePath}`);
  console.log(`Bundle sha256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Ready for internal end-to-end test; customer/public/live-provider gates remain blocked.");
}

main();
