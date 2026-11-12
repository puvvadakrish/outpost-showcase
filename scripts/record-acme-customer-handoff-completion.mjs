#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const REQUIRED_CONFIRMATIONS = [
  [
    "OUTPOST_ACME_CUSTOMER_CONFIRMED_PREVIEW",
    "protected Preview URL was confirmed with the customer"
  ],
  [
    "OUTPOST_ACME_CUSTOMER_OWNER_SIGNIN",
    "owner sign-in was observed through the protected Preview"
  ],
  [
    "OUTPOST_ACME_CUSTOMER_OWNER_WORKSPACE",
    "owner workspace rendered for the dry-run tenant"
  ],
  [
    "OUTPOST_ACME_CUSTOMER_STAFF_HANDOFF",
    "manual source to answer review to staff task handoff was observed"
  ],
  [
    "OUTPOST_ACME_CUSTOMER_RESET_REVIEWED",
    "reset and rollback checklist was reviewed"
  ],
  [
    "OUTPOST_ACME_CUSTOMER_LIVE_GATES_BLOCKED",
    "phone/email providers, invites, notifications, billing, POS, and member-ledger writes remained blocked"
  ],
  [
    "OUTPOST_ACME_CUSTOMER_NO_UNEXPECTED_DATA",
    "no unexpected tenant data or account access behavior appeared"
  ]
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeArtifactPath(rawPath, label) {
  invariant(rawPath?.trim(), `${label} is required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);

  const resolvedPath = resolve(rawPath.trim());
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo =
    repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(
    !isInsideRepo || isIgnoredArtifactPath,
    `${label} must live under gitignored artifacts/ when it is repo-local.`
  );

  return rawPath.trim();
}

function readPacket(path) {
  invariant(existsSync(path), `customer handoff packet was not found at ${path}.`);
  const packet = readFileSync(path, "utf8");
  assertNoSecretShapedValue(packet, "customer handoff packet");
  return packet;
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedKeys(item, label, [...trail, String(index)]));
    return;
  }

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

    invariant(!secretKey, `${label} contains a secret-shaped key at ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session");

  invariant(!secretValue, `${label} contains a secret-shaped value.`);
}

function requireString(value, label) {
  invariant(typeof value === "string" && value.trim().length > 0, `${label} is required.`);
  const trimmed = value.trim();
  assertNoSecretShapedValue(trimmed, label);
  return trimmed;
}

function requireConfirmation(envName, description) {
  const rawValue = process.env[envName]?.trim().toLowerCase();
  const confirmed = rawValue === "1" || rawValue === "true" || rawValue === "yes";
  invariant(confirmed, `${envName}=1 is required to confirm ${description}.`);
  return { description, env: envName, confirmed: true };
}

function requireNoStopConcerns() {
  const value = requireString(process.env.OUTPOST_ACME_CUSTOMER_STOP_CONCERNS, "OUTPOST_ACME_CUSTOMER_STOP_CONCERNS");
  invariant(
    value.toLowerCase() === "none",
    "OUTPOST_ACME_CUSTOMER_STOP_CONCERNS must be exactly 'none' for a green completion record."
  );
  return value;
}

function extractPacketField(packet, field) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = packet.match(new RegExp(`\\|\\s*${escapedField}\\s*\\|\\s*([^|]+?)\\s*\\|`, "u"));
  invariant(match, `customer handoff packet is missing ${field}.`);
  return match[1].replaceAll("\\|", "|").trim();
}

function validatePacket(packet) {
  invariant(packet.includes("# Acme Fitness Customer Handoff Packet"), "customer handoff packet has the wrong title.");
  invariant(
    packet.includes("No claim that Acme Fitness has completed customer onboarding"),
    "customer handoff packet must preserve the no-completion-claim boundary."
  );
  invariant(packet.includes("No invite email delivery."), "customer handoff packet must block invite delivery.");
  invariant(
    packet.includes("No phone or email provider activation."),
    "customer handoff packet must block phone/email provider activation."
  );

  const liveProviderStatus = extractPacketField(packet, "Live-provider status");
  const rollbackStatus = extractPacketField(packet, "Rollback status");
  const dryRunId = extractPacketField(packet, "Dry-run id");
  const dryRunOwner = extractPacketField(packet, "Dry-run owner");
  const dryRunTenant = extractPacketField(packet, "Dry-run tenant");
  const dryRunTenantId = extractPacketField(packet, "Dry-run tenant id");
  const previewOrigin = extractPacketField(packet, "Preview origin");
  const neonProofBranch = extractPacketField(packet, "Neon proof branch");

  invariant(liveProviderStatus === "blocked", "customer handoff packet must show blocked live-provider status.");
  invariant(
    rollbackStatus === "rollback-only cleanup complete",
    "customer handoff packet must show rollback-only cleanup complete."
  );
  invariant(dryRunTenant.startsWith("Acme Fitness Dry Run"), "customer handoff packet must use a dry-run tenant.");
  invariant(dryRunTenantId !== "tenant_acme_fitness", "customer handoff packet must not target the seeded tenant.");
  invariant(
    dryRunOwner.includes("+dry-run") || dryRunOwner.endsWith("@owner.outpost.local"),
    "customer handoff packet must use a dry-run owner email."
  );

  return {
    dryRunId,
    dryRunOwner,
    dryRunTenant,
    dryRunTenantId,
    liveProviderStatus,
    neonProofBranch,
    previewOrigin,
    rollbackStatus
  };
}

function readCompletionInput() {
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ACME_CUSTOMER_PACKET_PATH,
    "OUTPOST_ACME_CUSTOMER_PACKET_PATH"
  );
  const packet = readPacket(packetPath);
  const packetSummary = validatePacket(packet);
  const completionPath = normalizeArtifactPath(
    process.env.OUTPOST_ACME_CUSTOMER_COMPLETION_PATH ??
      `artifacts/acme-customer-handoff/${packetSummary.dryRunId}-customer-observed-completion.json`,
    "OUTPOST_ACME_CUSTOMER_COMPLETION_PATH"
  );
  const sessionAt = requireString(process.env.OUTPOST_ACME_CUSTOMER_SESSION_AT, "OUTPOST_ACME_CUSTOMER_SESSION_AT");
  invariant(!Number.isNaN(Date.parse(sessionAt)), "OUTPOST_ACME_CUSTOMER_SESSION_AT must be an ISO-like date string.");

  const record = {
    status: "customer_observed_handoff_recorded",
    evidence_basis: "operator_attested_from_customer_handoff_packet",
    generated_at: new Date().toISOString(),
    session_at: new Date(sessionAt).toISOString(),
    observer: requireString(process.env.OUTPOST_ACME_CUSTOMER_OBSERVER, "OUTPOST_ACME_CUSTOMER_OBSERVER"),
    participant: requireString(process.env.OUTPOST_ACME_CUSTOMER_PARTICIPANT, "OUTPOST_ACME_CUSTOMER_PARTICIPANT"),
    stop_concerns: requireNoStopConcerns(),
    packet: {
      path: packetPath,
      ...packetSummary
    },
    confirmations: REQUIRED_CONFIRMATIONS.map(([envName, description]) => requireConfirmation(envName, description)),
    live_provider_gate: "blocked",
    verification_boundary:
      "This record re-checks the generated packet fields and records operator-observed confirmations; it does not re-read hosted Neon evidence JSON.",
    non_goals: [
      "invite_delivery",
      "phone_provider_activation",
      "email_provider_activation",
      "notification_sending",
      "billing",
      "pos",
      "access_control",
      "member_ledger_writes"
    ],
    next_gate:
      "Review the completion record before any self-serve onboarding, invite delivery, phone/email provider, billing, POS, or member-ledger slice."
  };

  assertNoSecretShapedKeys(record, "customer-observed completion record");
  assertNoSecretShapedValue(JSON.stringify(record), "customer-observed completion record");
  return { completionPath, record };
}

const { completionPath, record } = readCompletionInput();

mkdirSync(dirname(completionPath), { recursive: true });
writeFileSync(completionPath, `${JSON.stringify(record, null, 2)}\n`);
console.log(`Acme Fitness customer-observed handoff completion wrote ${completionPath}`);
