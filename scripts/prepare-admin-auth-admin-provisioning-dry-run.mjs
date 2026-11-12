#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_INVITE_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-invite-delivery-preflight.json";
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
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON artifact.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  }
  return { relativePath, resolved };
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(
      text,
    ) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text,
    );
  invariant(!secretValue, `${label} contains secret-shaped material.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("privatekey") ||
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
  assertNoSecretShapedValue(source, label);
  const artifact = JSON.parse(source);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: sha256(source) };
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertInvitePreflight(preflight) {
  invariant(
    preflight.artifact_kind === "admin_invite_delivery_preflight",
    "Invite delivery preflight artifact kind mismatch.",
  );
  invariant(
    preflight.status === "admin_invite_delivery_preflight_prepared",
    "Invite delivery preflight status mismatch.",
  );
  invariant(
    preflight.invite_mode === "review_only_no_send",
    "Invite preflight must remain review-only/no-send.",
  );
  invariant(preflight.invite_audience, "Invite audience required.");
  assertFalse(
    preflight,
    "browser_send_button_allowed",
    "Browser send button blocked.",
  );
  assertFalse(preflight, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(
    preflight,
    "notification_sending_allowed",
    "Notification sending blocked.",
  );
  assertFalse(preflight, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(
    preflight,
    "gmail_resend_smtp_provider_allowed",
    "Provider send path blocked.",
  );
  assertFalse(
    preflight,
    "live_provider_enablement_allowed",
    "Live providers blocked.",
  );
  assertFalse(
    preflight,
    "auth_admin_product_api_allowed",
    "Auth admin product API blocked.",
  );
  assertFalse(
    preflight,
    "owner_provisioning_allowed",
    "Owner provisioning blocked.",
  );
  assertFalse(
    preflight,
    "owner_grant_automatic",
    "Automatic owner grant blocked.",
  );
  assertFalse(
    preflight,
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
  const invitePreflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH ??
      DEFAULT_INVITE_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH",
    { mustExist: true },
  );
  const dryRunPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH ??
      DEFAULT_AUTH_DRY_RUN_PATH,
    "OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH",
  );
  invariant(
    !existsSync(dryRunPath.resolved),
    "OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH already exists.",
  );

  const { artifact: invitePreflight, sha256: invitePreflightSha256 } =
    readJsonArtifact(invitePreflightPath.resolved, "invite delivery preflight");
  assertInvitePreflight(invitePreflight);

  const ownerEmail = optionalText(
    "OUTPOST_ADMIN_AUTH_ADMIN_DRY_RUN_OWNER_EMAIL",
    invitePreflight.invite_audience,
    180,
  );

  const dryRun = {
    artifact_kind: "admin_auth_admin_provisioning_dry_run",
    status: "admin_auth_admin_provisioning_dry_run_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_invite_delivery_preflight",
    invite_delivery_preflight_path: invitePreflightPath.relativePath,
    invite_delivery_preflight_sha256: invitePreflightSha256,
    provisioning_mode: "operator_review_only_no_user_created",
    reviewed_owner_email: ownerEmail,
    auth_user_created: false,
    product_auth_admin_api_allowed: false,
    auth_admin_product_api_allowed: false,
    owner_grant_automatic: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    browser_approval_buttons_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: REQUIRED_BLOCKED_GATES,
    operator_checklist: [
      "Confirm owner email matches the reviewed invite preflight.",
      "Create or verify any Neon Auth user only through the operator runbook.",
      "Do not expose an Auth admin product API or browser provisioning button.",
      "Keep invite delivery and notifications blocked until no-send proof is reviewed.",
    ],
    next_recommended_slice:
      "Build owner-access fulfillment evidence that links invite review to operator-created access without productized Auth admin APIs.",
  };

  assertNoSecretShapedKeys(dryRun, "Auth admin provisioning dry-run");
  const serialized = `${JSON.stringify(dryRun, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "Auth admin provisioning dry-run");
  mkdirSync(dirname(dryRunPath.resolved), { recursive: true });
  writeFileSync(dryRunPath.resolved, serialized, { flag: "wx" });

  console.log(`Auth admin provisioning dry-run wrote ${dryRunPath.relativePath}`);
  console.log(`Reviewed owner email: ${ownerEmail}`);
  console.log("Auth user created: false");
  console.log("Product Auth admin API: blocked");
  console.log("Invite delivery: blocked");
  console.log(`Dry-run sha256: ${sha256(serialized)}`);
}

main();
