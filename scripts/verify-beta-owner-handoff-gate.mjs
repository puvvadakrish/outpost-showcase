#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const REQUIRED_NON_GOALS = [
  "public_self_signup",
  "invite_delivery",
  "notification_sending",
  "phone_provider_activation",
  "email_provider_activation",
  "billing",
  "pos",
  "access_control",
  "member_ledger_writes"
];

const REQUIRED_CONFIRMATION_ENVS = [
  "OUTPOST_BETA_HANDOFF_CONFIRMED_PREVIEW",
  "OUTPOST_BETA_HANDOFF_OWNER_SIGNIN",
  "OUTPOST_BETA_HANDOFF_OWNER_WORKSPACE",
  "OUTPOST_BETA_HANDOFF_FIRST_WORKFLOW",
  "OUTPOST_BETA_HANDOFF_RESET_REVIEWED",
  "OUTPOST_BETA_HANDOFF_LIVE_GATES_BLOCKED",
  "OUTPOST_BETA_HANDOFF_NO_UNEXPECTED_DATA"
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
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

function normalizeArtifactPath(rawPath, label) {
  invariant(rawPath?.trim(), `${label} is required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(rawPath, label);

  const artifactPath = rawPath.trim();
  const resolvedPath = resolve(artifactPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo =
    repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);

  return artifactPath;
}

function readTextArtifact(path, label) {
  invariant(existsSync(path), `${label} was not found at ${path}.`);
  const content = readFileSync(path, "utf8");
  assertNoSecretShapedValue(content, label);
  return content;
}

function readJsonArtifact(path, label) {
  const content = readTextArtifact(path, label);

  try {
    const parsed = JSON.parse(content);
    assertNoSecretShapedKeys(parsed, label);
    return parsed;
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function extractPacketField(packet, field) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = packet.match(new RegExp(`\\|\\s*${escapedField}\\s*\\|\\s*([^|]+?)\\s*\\|`, "u"));
  invariant(match, `beta owner handoff packet is missing ${field}.`);
  return match[1].replaceAll("\\|", "|").trim();
}

function validateUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  invariant(parsed.protocol === "https:", `${label} must use https.`);
  invariant(!parsed.username && !parsed.password, `${label} must not include embedded credentials.`);
  return parsed.toString().replace(/\/$/u, "");
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

  const summary = {
    betaOwner: extractPacketField(packet, "Beta owner"),
    betaState: extractPacketField(packet, "Beta state"),
    gym: extractPacketField(packet, "Gym"),
    liveProviderStatus: extractPacketField(packet, "Live-provider status"),
    neonProofBranch: extractPacketField(packet, "Neon proof branch"),
    previewUrl: validateUrl(extractPacketField(packet, "Preview URL"), "packet Preview URL")
  };

  invariant(summary.betaState === "operator-assisted beta", "packet must show operator-assisted beta state.");
  invariant(summary.liveProviderStatus === "blocked", "packet must show blocked live-provider status.");
  return summary;
}

function validateCompletion(completion, packetSummary) {
  invariant(completion.status === "beta_owner_handoff_recorded", "completion record must be recorded.");
  invariant(completion.customer_observed === true, "completion record must be explicitly customer-observed.");
  invariant(
    completion.evidence_basis === "customer_observed_operator_attested_from_beta_owner_handoff_packet",
    "completion evidence basis must be customer-observed."
  );
  invariant(completion.stop_concerns === "none", "completion stop concerns must be exactly 'none'.");
  invariant(completion.beta_access_gate === "operator_assisted", "completion beta access gate must stay operator-assisted.");
  invariant(completion.live_provider_gate === "blocked", "completion live-provider gate must stay blocked.");
  invariant(!Number.isNaN(Date.parse(completion.session_at)), "completion session_at must be a valid date.");
  invariant(!Number.isNaN(Date.parse(completion.generated_at)), "completion generated_at must be a valid date.");
  invariant(completion.packet?.gym === packetSummary.gym, "completion packet gym must match the packet.");
  invariant(completion.packet?.previewUrl === packetSummary.previewUrl, "completion packet Preview URL must match the packet.");
  invariant(
    completion.packet?.neonProofBranch === packetSummary.neonProofBranch,
    "completion packet Neon proof branch must match the packet."
  );
  invariant(Array.isArray(completion.confirmations), "completion record must include observed handoff confirmations.");

  const confirmedEnvs = new Set(
    completion.confirmations
      .filter((confirmation) => confirmation?.confirmed === true && typeof confirmation.env === "string")
      .map((confirmation) => confirmation.env)
  );

  for (const envName of REQUIRED_CONFIRMATION_ENVS) {
    invariant(confirmedEnvs.has(envName), `completion record is missing confirmed ${envName}.`);
  }

  for (const nonGoal of REQUIRED_NON_GOALS) {
    invariant(completion.non_goals?.includes(nonGoal), `completion record must keep ${nonGoal} blocked.`);
  }

  const participant = requireCustomerParticipant(completion.participant);
  const observer = requireSafeString(completion.observer, "completion observer");
  invariant(
    participant.toLowerCase() !== observer.toLowerCase(),
    "completion participant must be distinct from the internal observer."
  );
  return { observer, participant };
}

function requireSafeString(value, label) {
  invariant(typeof value === "string" && value.trim().length > 0, `${label} is required.`);
  const trimmed = value.trim();
  assertNoSecretShapedValue(trimmed, label);
  return trimmed;
}

function requireCustomerParticipant(value) {
  const participant = requireSafeString(value, "completion participant");
  // This intentionally fails closed for obvious internal/test labels; operators can use the real owner or customer name.
  const internalPattern = /\b(?:dry[-\s]?run|internal|smoke|test|disposable|throwaway|operator|founder[-\s]?admin|outpost)\b/iu;
  invariant(
    !internalPattern.test(participant),
    "completion participant must be the external beta owner or customer, not an internal dry-run label."
  );
  return participant;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 72);
}

function validateAdminHandoffPacket(rawPath, packetSummary) {
  if (!rawPath?.trim()) {
    return null;
  }
  const adminPacketPath = normalizeArtifactPath(rawPath, "OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH");
  const raw = readTextArtifact(adminPacketPath, "Admin handoff readiness packet");
  const packet = JSON.parse(raw);
  assertNoSecretShapedKeys(packet, "Admin handoff readiness packet");
  invariant(packet.artifact_kind === "admin_handoff_readiness_packet", "Admin handoff packet kind mismatch.");
  invariant(packet.status === "admin_handoff_readiness_packet_exported", "Admin handoff packet status mismatch.");
  invariant(packet.preview_url === packetSummary.previewUrl, "Admin handoff packet Preview URL must match customer packet.");
  invariant(packet.neon_branch_name === packetSummary.neonProofBranch, "Admin handoff packet Neon branch must match customer packet.");
  invariant(packet.public_self_serve_launch_allowed === false, "Admin handoff packet public self-serve must stay blocked.");
  invariant(packet.live_provider_enablement_allowed === false, "Admin handoff packet live providers must stay blocked.");
  return {
    path: adminPacketPath,
    sha256: createHash("sha256").update(raw).digest("hex")
  };
}

function readGateInput() {
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_HANDOFF_PACKET_PATH,
    "OUTPOST_BETA_HANDOFF_PACKET_PATH"
  );
  const completionPath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_HANDOFF_COMPLETION_PATH,
    "OUTPOST_BETA_HANDOFF_COMPLETION_PATH"
  );
  const packetSummary = validatePacket(readTextArtifact(packetPath, "beta owner handoff packet"));
  const completion = readJsonArtifact(completionPath, "beta owner handoff completion");
  const completionSummary = validateCompletion(completion, packetSummary);
  const adminHandoffPacket = validateAdminHandoffPacket(
    process.env.OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH,
    packetSummary
  );
  const gatePath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_HANDOFF_GATE_PATH ??
      `artifacts/beta-owner-handoff/${slugify(packetSummary.gym)}-customer-observed-gate.json`,
    "OUTPOST_BETA_HANDOFF_GATE_PATH"
  );
  const artifacts = {
    packet_path: packetPath,
    completion_path: completionPath
  };
  if (adminHandoffPacket) {
    artifacts.admin_handoff_packet_path = adminHandoffPacket.path;
  }
  return {
    gatePath,
    gate: {
      status: "customer_observed_beta_handoff_gate_passed",
      evidence_basis: adminHandoffPacket
        ? "validated_admin_handoff_packet_customer_packet_and_completion_artifacts"
        : "validated_packet_and_customer_observed_completion_artifacts",
      generated_at: new Date().toISOString(),
      session_at: completion.session_at,
      gym: packetSummary.gym,
      beta_owner: packetSummary.betaOwner,
      preview_url: packetSummary.previewUrl,
      neon_proof_branch: packetSummary.neonProofBranch,
      observer: completionSummary.observer,
      participant: completionSummary.participant,
      admin_handoff_packet_sha256: adminHandoffPacket?.sha256 ?? null,
      artifacts,
      confirmations: REQUIRED_CONFIRMATION_ENVS,
      gates: {
        customer_observed: "passed",
        protected_preview: "observed",
        owner_sign_in: "observed",
        owner_workspace: "observed",
        manual_source_answer_staff_task_flow: "observed",
        reset_rollback_review: "observed",
        unexpected_data: "none_reported",
        live_providers: "blocked",
        self_serve: "blocked",
        invite_delivery: "blocked",
        notifications: "blocked",
        phone_email_providers: "blocked",
        billing_pos_member_ledger: "blocked"
      },
      non_goals: REQUIRED_NON_GOALS,
      summary: {
        customer_observed: true,
        admin_handoff_packet_linked: Boolean(adminHandoffPacket),
        live_provider_status: "blocked",
        reset_reviewed: true,
        unexpected_data: "none_reported"
      },
      next_gate:
        "Only after reviewed artifact accepted should Outpost plan public self-serve, invite delivery, live providers, billing, POS, access-control, or member-ledger slices."
    }
  };
}
const { gatePath, gate } = readGateInput();

assertNoSecretShapedKeys(gate, "beta owner handoff gate");
assertNoSecretShapedValue(JSON.stringify(gate), "beta owner handoff gate");
mkdirSync(dirname(gatePath), { recursive: true });
writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);
console.log(`Beta owner handoff gate wrote ${gatePath}`);
