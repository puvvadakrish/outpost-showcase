#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

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

function normalizeArtifactPath(rawPath, label, { mustExist }) {
  const value = rawPath?.trim();
  invariant(value, `${label} required.`);
  assertNoSecretShapedValue(value, label);
  const resolved = resolve(process.cwd(), value);
  const relativePath = isAbsolute(value) ? value : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(!normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"), `${label} must be under artifacts/.`);
  invariant(relativePath.endsWith(".json"), `${label} must be a JSON artifact.`);
  invariant(mustExist ? existsSync(resolved) : !existsSync(resolved), `${label} ${mustExist ? "not found" : "already exists"} at ${relativePath}.`);
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: createHash("sha256").update(raw).digest("hex") };
}

function assertBlockedGates(artifact, gates, label) {
  for (const gate of gates) {
    invariant(artifact.blocked_gates?.includes(gate), `${label} must block ${gate}.`);
  }
}

function requireText(name, maxLength) {
  const value = String(process.env[name] ?? "").trim();
  invariant(value, `${name} required.`);
  invariant(value.length <= maxLength, `${name} too long.`);
  assertNoSecretShapedValue(value, name);
  return value;
}

function main() {
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_EMAIL_CHANNEL_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_EMAIL_CHANNEL_PREFLIGHT_PATH",
    { mustExist: true }
  );
  const packetPath = normalizeArtifactPath(PACKET_PATH, "OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH", { mustExist: false });
  const { artifact: preflight, sha256: preflightSha256 } = readJsonArtifact(preflightPath.resolved, "email channel preflight");
  invariant(preflight.artifact_kind === "admin_email_channel_preflight", "Email channel preflight kind mismatch.");
  invariant(preflight.public_self_serve_launch_allowed === false, "Preflight must keep public self-serve blocked.");
  invariant(preflight.email_ingress_allowed === false, "Preflight must keep email ingress blocked.");
  invariant(preflight.outbound_email_allowed === false, "Preflight must keep outbound email blocked.");
  invariant(preflight.notification_sending_allowed === false, "Preflight must keep notifications blocked.");
  invariant(preflight.live_provider_enablement_allowed === false, "Preflight must keep live providers blocked.");
  assertBlockedGates(
    preflight,
    [
      "public_owner_self_signup",
      "gmail_connection",
      "resend_connection",
      "smtp_connection",
      "provider_webhooks",
      "email_ingress",
      "outbound_email_delivery",
      "notification_sending",
      "billing",
      "pos_access_control_member_ledger_writes"
    ],
    "Email channel preflight"
  );

  const subject = requireText("OUTPOST_ADMIN_EMAIL_SAMPLE_SUBJECT", 180);
  const senderLabel = requireText("OUTPOST_ADMIN_EMAIL_SAMPLE_SENDER_LABEL", 120);
  invariant(!/@/u.test(senderLabel), "Use a sender label, not a full email address.");
  const body = requireText("OUTPOST_ADMIN_EMAIL_SAMPLE_BODY", 2000);
  const suggestedIntent = requireText("OUTPOST_ADMIN_EMAIL_SAMPLE_INTENT", 120);
  const suggestedNextStep = requireText("OUTPOST_ADMIN_EMAIL_SAMPLE_NEXT_STEP", 240);

  const packet = {
    artifact_kind: "admin_email_sample_packet",
    status: "email_sample_packet_prepared",
    generated_at: new Date().toISOString(),
    gym_name: preflight.gym_name,
    owner_email: preflight.owner_email,
    mailbox_label: preflight.mailbox_label,
    preflight_path: preflightPath.relativePath,
    preflight_sha256: preflightSha256,
    sample: {
      subject,
      sender_label: senderLabel,
      body,
      suggested_intent: suggestedIntent,
      suggested_next_step: suggestedNextStep
    },
    public_self_serve_launch_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    task_creation_allowed: false,
    checklist: [
      "Use this sample to design manual email triage categories before provider connection.",
      "Create any staff task manually through existing human-entered task flow only after review.",
      "Keep inbox connection, outbound replies, notifications, and provider webhooks blocked."
    ],
    blocked_gates: [
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
    ]
  };

  assertNoSecretShapedKeys(packet, "email sample packet");
  const serialized = `${JSON.stringify(packet, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "email sample packet");
  mkdirSync(dirname(packetPath.resolved), { recursive: true });
  writeFileSync(packetPath.resolved, serialized);
  console.log("Admin email sample packet prepared");
  console.log(`Artifact: ${packetPath.relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Email ingress, outbound delivery, notifications, and task generation remain blocked.");
}

main();
