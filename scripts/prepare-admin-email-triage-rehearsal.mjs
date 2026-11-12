#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const EXPORT_PATH =
  process.env.OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH ??
  "artifacts/admin-launch-readiness/admin-email-triage-rehearsal.json";

const REQUIRED_PACKET_GATES = [
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
];

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

function normalizeArtifactPath(rawPath, label, { mustExist }) {
  const normalizedPath = rawPath?.trim();
  invariant(normalizedPath, `${label} required.`);
  assertNoSecretShapedValue(normalizedPath, label);
  const resolved = resolve(process.cwd(), normalizedPath);
  const relativePath = isAbsolute(normalizedPath) ? normalizedPath : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(!normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"), `${label} must live under artifacts/.`);
  invariant(relativePath.endsWith(".json"), `${label} must be a JSON file.`);
  invariant(
    mustExist ? existsSync(resolved) : !existsSync(resolved),
    `${label} ${mustExist ? "not found" : "already exists"} at ${relativePath}.`
  );
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
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH,
    "OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH",
    { mustExist: true }
  );
  const exportPath = normalizeArtifactPath(EXPORT_PATH, "OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH", {
    mustExist: false
  });
  const { artifact: packet, sha256: packetSha256 } = readJsonArtifact(packetPath.resolved, "email sample packet");

  invariant(packet.artifact_kind === "admin_email_sample_packet", "Email sample packet kind mismatch.");
  invariant(packet.public_self_serve_launch_allowed === false, "Email packet must keep public self-serve blocked.");
  invariant(packet.email_ingress_allowed === false, "Email packet must keep email ingress blocked.");
  invariant(packet.outbound_email_allowed === false, "Email packet must keep outbound email blocked.");
  invariant(packet.notification_sending_allowed === false, "Email packet must keep notifications blocked.");
  invariant(packet.task_creation_allowed === false, "Email packet must keep task creation blocked.");
  assertBlockedGates(packet, REQUIRED_PACKET_GATES, "Email sample packet");

  const triageCategory = requireText("OUTPOST_ADMIN_EMAIL_TRIAGE_CATEGORY", 120);
  const ownerReviewLabel = requireText("OUTPOST_ADMIN_EMAIL_TRIAGE_OWNER_REVIEW_LABEL", 120);
  const staffTaskDraft = requireText("OUTPOST_ADMIN_EMAIL_TRIAGE_STAFF_TASK_DRAFT", 240);

  const rehearsal = {
    artifact_kind: "admin_email_triage_rehearsal",
    status: "email_triage_rehearsal_prepared",
    generated_at: new Date().toISOString(),
    gym_name: packet.gym_name,
    owner_email: packet.owner_email,
    mailbox_label: packet.mailbox_label,
    email_sample_packet_path: packetPath.relativePath,
    email_sample_packet_sha256: packetSha256,
    sample: packet.sample,
    triage_category: triageCategory,
    owner_review_label: ownerReviewLabel,
    staff_task_draft: staffTaskDraft,
    operator_steps: [
      "Review this pasted sample with the owner before creating any task taxonomy.",
      "Use the category and staff-task draft as planning notes only.",
      "If a real follow-up is needed today, create it manually through the existing human-entered task workflow.",
      "Do not connect inboxes, ingest mail, send replies, or notify staff from this artifact."
    ],
    public_self_serve_launch_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    task_creation_allowed: false,
    live_provider_enablement_allowed: false,
    blocked_gates: REQUIRED_PACKET_GATES
  };

  assertNoSecretShapedKeys(rehearsal, "email triage rehearsal");
  const serialized = `${JSON.stringify(rehearsal, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "email triage rehearsal");
  mkdirSync(dirname(exportPath.resolved), { recursive: true });
  writeFileSync(exportPath.resolved, serialized);
  console.log("Admin email triage rehearsal prepared");
  console.log(`Artifact: ${exportPath.relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Email ingress, outbound delivery, notifications, and task creation remain blocked.");
}

main();
