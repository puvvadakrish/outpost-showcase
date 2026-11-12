#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_INVITE_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-invite-delivery-preflight.json";
const REQUIRED_BLOCKED_GATES = [
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery send",
  "Notification sending",
  "Gmail, Resend, SMTP, provider webhooks",
  "Phone/email provider activation",
  "Auth admin product API",
  "Automatic owner grant",
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
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH ??
      DEFAULT_INVITE_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH",
  );
  const { artifact: preflight } = readJsonArtifact(
    preflightPath.resolved,
    "invite delivery preflight",
  );
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
  invariant(preflight.invite_subject, "Invite subject required.");
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
  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(preflight.blocked_gates, gate, "invite blocked gates");
  }

  console.log(`Invite delivery preflight OK: ${preflightPath.relativePath}`);
  console.log(`Invite audience: ${preflight.invite_audience}`);
  console.log("Invite delivery: blocked");
  console.log("Auth admin product API: blocked");
}

main();
