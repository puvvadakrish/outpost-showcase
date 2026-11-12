#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const PACKET_PATH =
  process.env.OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH ??
  "artifacts/admin-launch-readiness/admin-email-sample-packet.json";

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
  for (const [key, nested] of Object.entries(value)) {
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
    assertNoSecretShapedKeys(nested, label, [...trail, key]);
  }
}

function normalizeArtifactPath(rawPath) {
  const resolved = resolve(process.cwd(), rawPath);
  const relativePath = isAbsolute(rawPath) ? rawPath : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(!normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"), "Email sample packet must live under artifacts/.");
  invariant(existsSync(resolved), `Email sample packet not found at ${relativePath}.`);
  return { relativePath, resolved };
}

function assertArtifactShape(artifact) {
  invariant(artifact.artifact_kind === "admin_email_sample_packet", "Artifact kind mismatch.");
  invariant(artifact.status === "email_sample_packet_prepared", "Artifact status mismatch.");
  invariant(/^[a-f0-9]{64}$/u.test(artifact.preflight_sha256 ?? ""), "Preflight digest required.");
  invariant(artifact.sample?.subject, "Sample subject required.");
  invariant(artifact.sample?.sender_label && !/@/u.test(artifact.sample.sender_label), "Sample sender label required.");
  invariant(artifact.sample?.body, "Sample body required.");
  invariant(artifact.sample?.suggested_intent, "Suggested intent required.");
  invariant(artifact.sample?.suggested_next_step, "Suggested next step required.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Public self-serve must remain blocked.");
  invariant(artifact.email_ingress_allowed === false, "Email ingress must remain blocked.");
  invariant(artifact.outbound_email_allowed === false, "Outbound email must remain blocked.");
  invariant(artifact.notification_sending_allowed === false, "Notification sending must remain blocked.");
  invariant(artifact.task_creation_allowed === false, "Task creation must remain blocked.");
  for (const gate of [
    "public_owner_self_signup",
    "gmail_connection",
    "resend_connection",
    "smtp_connection",
    "provider_webhooks",
    "email_ingress",
    "outbound_email_delivery",
    "notification_sending",
    "task_generation",
    "billing",
    "pos_access_control_member_ledger_writes"
  ]) {
    invariant(artifact.blocked_gates?.includes(gate), `${gate} gate must be blocked.`);
  }
}

function main() {
  const { relativePath, resolved } = normalizeArtifactPath(PACKET_PATH);
  const raw = readFileSync(resolved, "utf8");
  assertNoSecretShapedValue(raw, "email sample packet");
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, "email sample packet");
  assertArtifactShape(artifact);
  console.log("Admin email sample packet inspection");
  console.log(`Artifact: ${relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(raw).digest("hex")}`);
  console.log("Email ingress, outbound delivery, notifications, and task generation remain blocked.");
}

main();
