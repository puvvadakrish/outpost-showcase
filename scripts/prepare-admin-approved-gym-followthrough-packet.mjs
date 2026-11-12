#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PUBLIC_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-public-self-serve-preflight.json";
const DEFAULT_FOLLOWTHROUGH_PATH =
  "artifacts/admin-launch-readiness/owner-beta-request-followthrough.json";
const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-approved-gym-followthrough-packet.json";

const REQUIRED_BLOCKED_GATES = [
  "Public owner self-signup",
  "Browser approval buttons",
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

function normalizeArtifactPath(value, label, options = {}) {
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
  invariant(
    relativePath.endsWith(".json"),
    `${label} must point to JSON artifact.`,
  );
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  }

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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJsonArtifact(path, label) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, label);
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

function assertPublicSelfServePreflight(preflight) {
  invariant(
    preflight.artifact_kind === "admin_public_self_serve_preflight",
    "Public self-serve preflight artifact kind mismatch.",
  );
  invariant(
    preflight.status === "admin_public_self_serve_preflight_prepared",
    "Public self-serve preflight status mismatch.",
  );
  invariant(
    preflight.evidence_basis === "admin_limited_beta_onboarding_packet",
    "Public self-serve preflight evidence basis mismatch.",
  );
  assertFalse(
    preflight,
    "public_self_serve_launch_allowed",
    "Public self-serve must remain blocked.",
  );
  assertFalse(
    preflight,
    "invite_delivery_allowed",
    "Invite delivery must remain blocked.",
  );
  assertFalse(
    preflight,
    "browser_approval_buttons_allowed",
    "Browser approval buttons must remain blocked.",
  );
  assertFalse(
    preflight,
    "auth_admin_product_api_allowed",
    "Auth admin product API must remain blocked.",
  );
  assertFalse(
    preflight,
    "live_provider_enablement_allowed",
    "Live providers must remain blocked.",
  );
  assertFalse(
    preflight,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );
  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(preflight.blocked_gates, gate, "public preflight gates");
  }
}

function assertOwnerBetaFollowthrough(packet) {
  invariant(
    packet.packet_kind === "owner_beta_request_followthrough",
    "Owner beta request follow-through packet kind mismatch.",
  );
  invariant(
    packet.status === "owner_beta_request_followthrough_prepared",
    "Owner beta request follow-through status mismatch.",
  );
  invariant(packet.requires_human_review === true, "Human review required.");
  assertFalse(
    packet,
    "public_self_serve_launch_allowed",
    "Follow-through packet must keep public self-serve blocked.",
  );
  assertFalse(
    packet,
    "launch_enablement_allowed",
    "Follow-through packet must keep launch enablement blocked.",
  );
  invariant(packet.request?.id, "Follow-through request id required.");
  invariant(packet.request?.owner_email, "Follow-through owner email required.");
  invariant(packet.request?.gym_name, "Follow-through gym name required.");
  invariant(
    packet.triage_receipt?.decision === "ready_for_operator_fulfillment",
    "Follow-through triage decision must be ready_for_operator_fulfillment.",
  );
  invariant(
    packet.triage_receipt?.packet_sha256?.match(/^[a-f0-9]{64}$/u),
    "Follow-through triage packet digest missing.",
  );
}

function isAcmeFitness(value) {
  const normalized = String(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "");
  return (
    normalized.includes("acmefitness") ||
    normalized.includes("acmefitness") ||
    normalized === "acme" ||
    /\bh[\s._-]*o[\s._-]*g\b/iu.test(String(value))
  );
}

function optionalText(envName, maxLength) {
  const value = process.env[envName]?.trim();
  if (!value) {
    return undefined;
  }
  invariant(value.length <= maxLength, `${envName} too long.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function main() {
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH ??
      DEFAULT_PUBLIC_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH",
    { mustExist: true },
  );
  const followthroughPath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH ??
      DEFAULT_FOLLOWTHROUGH_PATH,
    "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH",
    { mustExist: true },
  );
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH ??
      DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH",
  );
  invariant(
    !existsSync(packetPath.resolved),
    "OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH already exists.",
  );

  const { artifact: preflight, sha256: preflightSha256 } = readJsonArtifact(
    preflightPath.resolved,
    "public self-serve preflight",
  );
  const { artifact: followthrough, sha256: followthroughSha256 } =
    readJsonArtifact(
      followthroughPath.resolved,
      "owner beta request follow-through",
    );

  assertPublicSelfServePreflight(preflight);
  assertOwnerBetaFollowthrough(followthrough);
  invariant(
    followthrough.triage_receipt.packet_sha256 === preflightSha256,
    "Follow-through triage digest must match public self-serve preflight artifact.",
  );

  const approvedGymLabel =
    optionalText("OUTPOST_ADMIN_APPROVED_GYM_LABEL", 160) ??
    followthrough.request.gym_name;

  invariant(
    !isAcmeFitness(approvedGymLabel) &&
      !isAcmeFitness(followthrough.request.gym_name),
    "Approved gym follow-through must be for a non-House-of-Fitness gym.",
  );

  const packet = {
    artifact_kind: "admin_approved_gym_request_followthrough_packet",
    status: "admin_approved_gym_request_followthrough_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "admin_public_self_serve_preflight_and_owner_beta_request_followthrough",
    public_self_serve_preflight_path: preflightPath.relativePath,
    public_self_serve_preflight_sha256: preflightSha256,
    owner_beta_request_followthrough_path: followthroughPath.relativePath,
    owner_beta_request_followthrough_sha256: followthroughSha256,
    approved_gym_label: approvedGymLabel,
    approved_gym_non_acme_fitness: true,
    request: {
      id: followthrough.request.id,
      owner_email: followthrough.request.owner_email,
      owner_name: followthrough.request.owner_name,
      gym_name: followthrough.request.gym_name,
      location_hint: followthrough.request.location_hint,
      status: followthrough.request.status,
    },
    triage_receipt: {
      id: followthrough.triage_receipt.id,
      decision: followthrough.triage_receipt.decision,
      packet_sha256: followthrough.triage_receipt.packet_sha256,
    },
    owner_access_mode: "operator_managed",
    operator_fulfillment_command: "npm run beta:operator:request-fulfillment",
    request_triage_required: true,
    request_followthrough_required: true,
    owner_grant_automatic: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    browser_approval_buttons_allowed: false,
    auth_admin_product_api_allowed: false,
    source_import_automation_allowed: false,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: REQUIRED_BLOCKED_GATES,
    handoff_checklist: [
      "Confirm the approved gym is not Acme Fitness.",
      "Use the existing operator request-fulfillment command for owner access.",
      "Do not send invites or notifications.",
      "Record only customer-safe follow-through metadata after operator review.",
      "Keep public self-serve approval blocked after fulfillment.",
    ],
    next_recommended_slice:
      "Run public request intake dry-run as request-only/review-only, without automatic approval or provisioning.",
  };

  assertNoSecretShapedKeys(packet, "approved gym follow-through packet");
  const serialized = `${JSON.stringify(packet, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "approved gym follow-through packet");

  mkdirSync(dirname(packetPath.resolved), { recursive: true });
  writeFileSync(packetPath.resolved, serialized, { flag: "wx" });

  console.log(
    `Approved gym follow-through packet wrote ${packetPath.relativePath}`,
  );
  console.log(`Approved gym: ${approvedGymLabel}`);
  console.log("Owner access: operator-managed");
  console.log("Public self-serve launch: blocked");
  console.log("Invite delivery: blocked");
  console.log("Live providers: blocked");
  console.log(`Packet sha256: ${sha256(serialized)}`);
}

main();
