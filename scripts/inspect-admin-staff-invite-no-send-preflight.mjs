#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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
  const staffInvitePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH ??
      DEFAULT_STAFF_INVITE_PATH,
    "OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH",
  );
  const { artifact: preflight } = readJsonArtifact(
    staffInvitePath.resolved,
    "staff invite no-send preflight",
  );

  invariant(
    preflight.artifact_kind === "admin_staff_invite_no_send_preflight",
    "Staff invite no-send preflight artifact kind mismatch.",
  );
  invariant(
    preflight.status === "admin_staff_invite_no_send_preflight_prepared",
    "Staff invite no-send preflight status mismatch.",
  );
  invariant(
    preflight.staff_invite_mode === "review_only_no_send",
    "Staff invite preflight must remain review-only/no-send.",
  );
  invariant(preflight.staff_invite_audience, "Staff invite audience required.");
  assertFalse(
    preflight,
    "browser_send_button_allowed",
    "Browser send button blocked.",
  );
  assertFalse(
    preflight,
    "staff_invite_delivery_allowed",
    "Staff invite delivery blocked.",
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
    "product_auth_admin_api_allowed",
    "Product Auth admin API blocked.",
  );
  assertFalse(
    preflight,
    "staff_auth_user_created",
    "Staff Auth user creation blocked.",
  );
  assertFalse(
    preflight,
    "staff_grant_automatic",
    "Automatic staff grant blocked.",
  );
  assertFalse(
    preflight,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes blocked.",
  );
  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(preflight.blocked_gates, gate, "staff invite blocked gates");
  }

  console.log(`Staff invite no-send preflight OK: ${staffInvitePath.relativePath}`);
  console.log(`Staff invite audience: ${preflight.staff_invite_audience}`);
  console.log("Staff invite delivery: blocked");
  console.log("Notification sending: blocked");
}

main();
