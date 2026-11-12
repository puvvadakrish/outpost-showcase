#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const REQUIRED_CONFIRMATIONS = [
  ["OUTPOST_BETA_HANDOFF_CONFIRMED_PREVIEW", "protected Preview URL was confirmed with the beta owner"],
  ["OUTPOST_BETA_HANDOFF_OWNER_SIGNIN", "owner sign-in was observed through the protected Preview"],
  ["OUTPOST_BETA_HANDOFF_OWNER_WORKSPACE", "owner workspace was observed"],
  ["OUTPOST_BETA_HANDOFF_FIRST_WORKFLOW", "manual source to answer review to staff task workflow was observed"],
  ["OUTPOST_BETA_HANDOFF_RESET_REVIEWED", "reset and rotate support checklist was reviewed"],
  [
    "OUTPOST_BETA_HANDOFF_LIVE_GATES_BLOCKED",
    "self-serve, invites, notifications, phone/email providers, billing, POS, access control, and member-ledger writes remained blocked"
  ],
  ["OUTPOST_BETA_HANDOFF_NO_UNEXPECTED_DATA", "no unexpected tenant data or account access behavior appeared"]
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeArtifactPath(rawPath, label) {
  invariant(rawPath?.trim(), `${label} is required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(rawPath, label);

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
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text
    );

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
  return { confirmed: true, description, env: envName };
}

function requireNoStopConcerns() {
  const value = requireString(process.env.OUTPOST_BETA_HANDOFF_STOP_CONCERNS, "OUTPOST_BETA_HANDOFF_STOP_CONCERNS");
  invariant(
    value.toLowerCase() === "none",
    "OUTPOST_BETA_HANDOFF_STOP_CONCERNS must be exactly 'none' for a green completion record."
  );
  return value;
}

function requireCustomerObserved() {
  const rawValue = process.env.OUTPOST_BETA_HANDOFF_CUSTOMER_OBSERVED?.trim().toLowerCase();
  const confirmed = rawValue === "1" || rawValue === "true" || rawValue === "yes";
  invariant(
    confirmed,
    "OUTPOST_BETA_HANDOFF_CUSTOMER_OBSERVED=1 is required before recording a green customer-observed beta owner handoff."
  );
  return true;
}

function readPacket(path) {
  invariant(existsSync(path), `beta owner handoff packet was not found at ${path}.`);
  const packet = readFileSync(path, "utf8");
  assertNoSecretShapedValue(packet, "beta owner handoff packet");
  return packet;
}

function extractPacketField(packet, field) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = packet.match(new RegExp(`\\|\\s*${escapedField}\\s*\\|\\s*([^|]+?)\\s*\\|`, "u"));
  invariant(match, `beta owner handoff packet is missing ${field}.`);
  return match[1].replaceAll("\\|", "|").trim();
}

function validatePacket(packet) {
  invariant(/# .+ Beta Owner Handoff Packet/u.test(packet), "beta owner handoff packet has the wrong title.");
  invariant(packet.includes("Public self-signup is not open."), "packet must block public self-signup.");
  invariant(packet.includes("No invite email delivery."), "packet must block invite delivery.");
  invariant(packet.includes("No phone or email provider activation."), "packet must block phone/email providers.");
  invariant(
    packet.includes("No claim that a customer-observed handoff has completed"),
    "packet must preserve the no-completion-claim boundary."
  );

  const gym = extractPacketField(packet, "Gym");
  const betaOwner = extractPacketField(packet, "Beta owner");
  const previewUrl = extractPacketField(packet, "Preview URL");
  const neonProofBranch = extractPacketField(packet, "Neon proof branch");
  const betaState = extractPacketField(packet, "Beta state");
  const liveProviderStatus = extractPacketField(packet, "Live-provider status");

  invariant(betaState === "operator-assisted beta", "packet must show operator-assisted beta state.");
  invariant(liveProviderStatus === "blocked", "packet must show blocked live-provider status.");

  return { betaOwner, betaState, gym, liveProviderStatus, neonProofBranch, previewUrl };
}

function readCompletionInput() {
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_HANDOFF_PACKET_PATH,
    "OUTPOST_BETA_HANDOFF_PACKET_PATH"
  );
  const packet = readPacket(packetPath);
  const packetSummary = validatePacket(packet);
  const completionPath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_HANDOFF_COMPLETION_PATH ??
      `artifacts/beta-owner-handoff/${packetSummary.gym.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-completion.json`,
    "OUTPOST_BETA_HANDOFF_COMPLETION_PATH"
  );
  const sessionAt = requireString(process.env.OUTPOST_BETA_HANDOFF_SESSION_AT, "OUTPOST_BETA_HANDOFF_SESSION_AT");
  invariant(!Number.isNaN(Date.parse(sessionAt)), "OUTPOST_BETA_HANDOFF_SESSION_AT must be an ISO-like date string.");

  const record = {
    status: "beta_owner_handoff_recorded",
    evidence_basis: "customer_observed_operator_attested_from_beta_owner_handoff_packet",
    customer_observed: requireCustomerObserved(),
    generated_at: new Date().toISOString(),
    session_at: new Date(sessionAt).toISOString(),
    observer: requireString(process.env.OUTPOST_BETA_HANDOFF_OBSERVER, "OUTPOST_BETA_HANDOFF_OBSERVER"),
    participant: requireString(process.env.OUTPOST_BETA_HANDOFF_PARTICIPANT, "OUTPOST_BETA_HANDOFF_PARTICIPANT"),
    stop_concerns: requireNoStopConcerns(),
    packet: {
      path: packetPath,
      ...packetSummary
    },
    confirmations: REQUIRED_CONFIRMATIONS.map(([envName, description]) => requireConfirmation(envName, description)),
    beta_access_gate: "operator_assisted",
    live_provider_gate: "blocked",
    verification_boundary:
      "This record re-checks the generated packet fields and records operator-observed confirmations; it does not mutate hosted data or re-read Neon/Vercel state.",
    non_goals: [
      "public_self_signup",
      "invite_delivery",
      "notification_sending",
      "phone_provider_activation",
      "email_provider_activation",
      "billing",
      "pos",
      "access_control",
      "member_ledger_writes"
    ],
    next_gate:
      "Review this completion record before any public self-serve, invite delivery, phone/email provider, billing, POS, access-control, or member-ledger slice."
  };

  assertNoSecretShapedKeys(record, "beta owner completion record");
  assertNoSecretShapedValue(JSON.stringify(record), "beta owner completion record");
  return { completionPath, record };
}

const { completionPath, record } = readCompletionInput();

mkdirSync(dirname(completionPath), { recursive: true });
writeFileSync(completionPath, `${JSON.stringify(record, null, 2)}\n`);
console.log(`Beta owner handoff completion wrote ${completionPath}`);
