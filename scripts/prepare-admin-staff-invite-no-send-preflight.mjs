#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_OWNER_ACCESS_PATH =
  "artifacts/admin-launch-readiness/admin-owner-access-fulfillment-evidence.json";
const DEFAULT_STAFF_INVITE_PATH =
  "artifacts/admin-launch-readiness/admin-staff-invite-no-send-preflight.json";
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

function assertOwnerAccessEvidence(evidence) {
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
    "automatic_owner_grant_allowed",
    "Automatic owner grant blocked.",
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
}

function optionalText(envName, fallback, maxLength) {
  const value = process.env[envName]?.trim() || fallback;
  invariant(value && value.length <= maxLength, `${envName} is invalid.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function main() {
  const ownerAccessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH ??
      DEFAULT_OWNER_ACCESS_PATH,
    "OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH",
    { mustExist: true },
  );
  const staffInvitePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH ??
      DEFAULT_STAFF_INVITE_PATH,
    "OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH",
  );
  invariant(
    !existsSync(staffInvitePath.resolved),
    "OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH already exists.",
  );

  const { artifact: ownerAccess, sha256: ownerAccessSha256 } = readJsonArtifact(
    ownerAccessPath.resolved,
    "owner access fulfillment evidence",
  );
  assertOwnerAccessEvidence(ownerAccess);

  const staffEmail = optionalText(
    "OUTPOST_ADMIN_STAFF_INVITE_AUDIENCE",
    "staff@example.invalid",
    180,
  );
  const staffRole = optionalText("OUTPOST_ADMIN_STAFF_INVITE_ROLE", "staff", 80);
  const locationLabel = optionalText(
    "OUTPOST_ADMIN_STAFF_INVITE_LOCATION_LABEL",
    "reviewed location",
    120,
  );
  const subject = optionalText(
    "OUTPOST_ADMIN_STAFF_INVITE_SUBJECT",
    `Outpost staff access for ${locationLabel}`,
    180,
  );

  const preflight = {
    artifact_kind: "admin_staff_invite_no_send_preflight",
    status: "admin_staff_invite_no_send_preflight_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_owner_access_fulfillment_evidence",
    owner_access_fulfillment_evidence_path: ownerAccessPath.relativePath,
    owner_access_fulfillment_evidence_sha256: ownerAccessSha256,
    staff_invite_mode: "review_only_no_send",
    reviewed_owner_email: ownerAccess.reviewed_owner_email,
    staff_invite_audience: staffEmail,
    staff_role: staffRole,
    location_label: locationLabel,
    staff_invite_subject: subject,
    staff_invite_body_preview:
      "Operator-reviewed staff invite copy placeholder. Sending remains blocked.",
    browser_send_button_allowed: false,
    staff_invite_delivery_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    outbound_email_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    staff_auth_user_created: false,
    staff_grant_automatic: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: REQUIRED_BLOCKED_GATES,
    operator_checklist: [
      "Confirm owner access evidence has been reviewed before preparing staff invite metadata.",
      "Confirm staff email, role, and location label are customer-safe.",
      "Do not send email, notifications, magic links, or provider traffic.",
      "Do not create staff Auth users or grants from product code.",
    ],
    next_recommended_slice:
      "Create customer-visible owner access completion proof before enabling staff invite delivery.",
  };

  mkdirSync(dirname(staffInvitePath.resolved), { recursive: true });
  writeFileSync(staffInvitePath.resolved, `${JSON.stringify(preflight, null, 2)}\n`);

  console.log(`Staff invite no-send preflight written: ${staffInvitePath.relativePath}`);
  console.log(`Staff invite audience: ${staffEmail}`);
  console.log("Staff invite delivery: blocked");
  console.log("Notification sending: blocked");
}

main();
