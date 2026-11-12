#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-approved-gym-followthrough-packet.json";
const REQUIRED_BLOCKED_GATES = [
  "Public owner self-signup",
  "Invite delivery",
  "Website scraping Google API import",
  "Automatic answer approval",
  "Automatic task generation",
  "Gmail, Resend, SMTP, provider webhooks",
  "Inbound email outbound email",
  "Notification sending",
  "Phone/email provider activation",
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
  invariant(relativePath.endsWith(".json"), `${label} must point JSON artifact.`);
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
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
  invariant(!secretValue, `${label} contains secret-shaped value.`);
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

function assertFalse(packet, key, message) {
  invariant(packet[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function main() {
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH ??
      DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH",
  );
  const raw = readFileSync(packetPath.resolved, "utf8");
  assertNoSecretShapedValue(raw, "approved gym follow-through packet");
  const packet = JSON.parse(raw);
  assertNoSecretShapedKeys(packet, "approved gym follow-through packet");

  invariant(
    packet.artifact_kind === "admin_approved_gym_request_followthrough_packet",
    "Approved gym follow-through packet artifact kind mismatch.",
  );
  invariant(
    packet.status === "admin_approved_gym_request_followthrough_prepared",
    "Approved gym follow-through packet status mismatch.",
  );
  invariant(
    packet.evidence_basis ===
      "admin_public_self_serve_preflight_and_owner_beta_request_followthrough",
    "Approved gym follow-through evidence basis mismatch.",
  );
  invariant(packet.approved_gym_label, "Approved gym label required.");
  invariant(
    packet.approved_gym_non_acme_fitness === true,
    "Approved gym must be explicitly non-House-of-Fitness.",
  );
  invariant(
    packet.owner_access_mode === "operator_managed",
    "Owner access must remain operator-managed.",
  );
  invariant(
    packet.operator_fulfillment_command ===
      "npm run beta:operator:request-fulfillment",
    "Operator fulfillment command mismatch.",
  );
  invariant(packet.request?.id, "Request id required.");
  invariant(packet.request?.owner_email, "Request owner email required.");
  invariant(packet.triage_receipt?.id, "Triage receipt id required.");
  assertFalse(packet, "owner_grant_automatic", "Owner grant must not be automatic.");
  assertFalse(
    packet,
    "public_self_serve_launch_allowed",
    "Public self-serve must remain blocked.",
  );
  assertFalse(packet, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(
    packet,
    "browser_approval_buttons_allowed",
    "Browser approval buttons blocked.",
  );
  assertFalse(
    packet,
    "auth_admin_product_api_allowed",
    "Auth admin product API blocked.",
  );
  assertFalse(packet, "email_ingress_allowed", "Email ingress blocked.");
  assertFalse(packet, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(
    packet,
    "notification_sending_allowed",
    "Notification sending blocked.",
  );
  assertFalse(
    packet,
    "live_provider_enablement_allowed",
    "Live providers blocked.",
  );
  assertFalse(
    packet,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes blocked.",
  );
  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(packet.blocked_gates, gate, "blocked gates");
  }

  console.log(`Approved gym follow-through packet OK: ${packetPath.relativePath}`);
  console.log(`Approved gym: ${packet.approved_gym_label}`);
  console.log("Owner access: operator-managed");
  console.log("Public self-serve launch: blocked");
  console.log("Invite delivery: blocked");
  console.log("Live providers: blocked");
}

main();
