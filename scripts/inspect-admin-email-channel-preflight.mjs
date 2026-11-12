#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const EXPORT_PATH =
  process.env.OUTPOST_ADMIN_EMAIL_CHANNEL_PREFLIGHT_PATH ??
  "artifacts/admin-launch-readiness/admin-email-channel-preflight.json";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      text
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedKeys(item, label, [...trail, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("jwt");
    invariant(!secretKey, `${label} contains secret-shaped key ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function normalizeArtifactPath(rawPath) {
  assertNoSecretShapedValue(rawPath, "OUTPOST_ADMIN_EMAIL_CHANNEL_PREFLIGHT_PATH");
  const resolved = resolve(process.cwd(), rawPath);
  const relativePath = isAbsolute(rawPath) ? rawPath : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(
    !normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"),
    "Email channel preflight must read under gitignored artifacts/."
  );
  invariant(existsSync(resolved), `Email channel preflight not found at ${relativePath}.`);
  return { relativePath, resolved };
}

function assertArtifactShape(artifact) {
  invariant(artifact.artifact_kind === "admin_email_channel_preflight", "Artifact kind mismatch.");
  invariant(artifact.status === "email_channel_preflight_prepared", "Artifact status mismatch.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Public self-serve must remain blocked.");
  invariant(artifact.email_ingress_allowed === false, "Email ingress must remain blocked.");
  invariant(artifact.outbound_email_allowed === false, "Outbound email must remain blocked.");
  invariant(artifact.notification_sending_allowed === false, "Notification sending must remain blocked.");
  invariant(artifact.live_provider_enablement_allowed === false, "Live providers must remain blocked.");
  invariant(artifact.mailbox_label && !/@/u.test(artifact.mailbox_label), "Artifact must use a mailbox label only.");
  invariant(artifact.blocked_gates?.includes("gmail_connection"), "Gmail connection gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("public_owner_self_signup"), "Public owner self-signup gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("resend_connection"), "Resend connection gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("smtp_connection"), "SMTP connection gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("provider_webhooks"), "Provider webhook gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("email_ingress"), "Email ingress gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("outbound_email_delivery"), "Outbound delivery gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("notification_sending"), "Notification sending gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("billing"), "Billing gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("pos_access_control_member_ledger_writes"), "POS/member-ledger gate must be blocked.");
}

function main() {
  const { relativePath, resolved } = normalizeArtifactPath(EXPORT_PATH);
  const raw = readFileSync(resolved, "utf8");
  assertNoSecretShapedValue(raw, "email channel preflight");
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, "email channel preflight");
  assertArtifactShape(artifact);
  console.log("Admin email channel preflight inspection");
  console.log(`Artifact: ${relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(raw).digest("hex")}`);
  console.log("Email ingress, outbound delivery, and notifications remain blocked.");
}

main();
