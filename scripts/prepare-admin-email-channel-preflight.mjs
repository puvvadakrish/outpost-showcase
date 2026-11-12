#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

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
    "Email channel preflight must write under gitignored artifacts/."
  );
  invariant(relativePath.endsWith(".json"), "Email channel preflight must be a JSON artifact.");
  return { relativePath, resolved };
}

function optionalEnv(name) {
  const value = process.env[name]?.trim() ?? "";
  assertNoSecretShapedValue(value, name);
  return value;
}

function requireEnv(name) {
  const value = optionalEnv(name);
  invariant(value, `${name} required.`);
  return value;
}

function main() {
  const { relativePath, resolved } = normalizeArtifactPath(EXPORT_PATH);
  const gymName = requireEnv("OUTPOST_ADMIN_EMAIL_CHANNEL_GYM_NAME");
  const ownerEmail = requireEnv("OUTPOST_ADMIN_EMAIL_CHANNEL_OWNER_EMAIL").toLowerCase();
  invariant(/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(ownerEmail), "Owner email must be valid.");
  const mailboxLabel = requireEnv("OUTPOST_ADMIN_EMAIL_CHANNEL_MAILBOX_LABEL");
  const forwardingPlan = optionalEnv("OUTPOST_ADMIN_EMAIL_CHANNEL_FORWARDING_PLAN") || "manual-forwarding-review";
  invariant(!/@/u.test(mailboxLabel), "Use a mailbox label, not a full email address or credential.");

  const artifact = {
    artifact_kind: "admin_email_channel_preflight",
    status: "email_channel_preflight_prepared",
    generated_at: new Date().toISOString(),
    gym_name: gymName,
    owner_email: ownerEmail,
    mailbox_label: mailboxLabel,
    forwarding_plan: forwardingPlan,
    public_self_serve_launch_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    checklist: [
      "Confirm owner-approved shared mailbox label and escalation owner before provider setup.",
      "Map inbound email categories to existing answer-review or staff-task paths before any live ingestion.",
      "Keep replies and notifications manual until delivery providers are explicitly productized.",
      "Do not connect Gmail, Resend, SMTP, webhooks, or notification delivery in this preflight."
    ],
    blocked_gates: [
      "gmail_connection",
      "public_owner_self_signup",
      "resend_connection",
      "smtp_connection",
      "provider_webhooks",
      "email_ingress",
      "outbound_email_delivery",
      "notification_sending",
      "billing",
      "pos_access_control_member_ledger_writes"
    ]
  };

  assertNoSecretShapedKeys(artifact, "email channel preflight");
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "email channel preflight");
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, serialized);
  console.log("Admin email channel preflight prepared");
  console.log(`Artifact: ${relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Email ingress, outbound delivery, and notifications remain blocked.");
}

main();
