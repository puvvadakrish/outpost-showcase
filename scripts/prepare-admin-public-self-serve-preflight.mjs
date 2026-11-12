#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_LIMITED_BETA_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-limited-beta-onboarding-packet.json";
const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-public-self-serve-preflight.json";

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
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoSecretShapedKeys(item, label, [...trail, String(index)]),
    );
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

    invariant(!secretKey, `${label} contains secret-shaped key: ${path}`);
    assertNoSecretShapedValue(nestedValue, `${label}.${path}`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);

  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);

  return {
    artifact,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function assertLimitedBetaPacket(packet) {
  invariant(
    packet.artifact_kind === "admin_limited_beta_onboarding_packet",
    "Limited beta onboarding packet artifact kind mismatch.",
  );
  invariant(
    packet.status === "admin_limited_beta_onboarding_packet_prepared",
    "Limited beta onboarding packet status mismatch.",
  );
  invariant(
    packet.evidence_basis === "admin_customer_demo_gate_packet",
    "Limited beta onboarding packet evidence basis mismatch.",
  );
  invariant(
    packet.owner_access_mode === "operator_managed",
    "Owner access must remain operator-managed.",
  );
  invariant(packet.request_triage_required === true, "Request triage required.");
  invariant(packet.followthrough_required === true, "Follow-through required.");

  assertFalse(
    packet,
    "customer_observed_completion_recorded",
    "Limited beta packet must not record customer completion.",
  );
  assertFalse(
    packet,
    "public_self_serve_launch_allowed",
    "Public self-serve must remain blocked.",
  );
  assertFalse(packet, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(
    packet,
    "browser_approval_buttons_allowed",
    "Browser approval buttons must remain blocked.",
  );
  assertFalse(
    packet,
    "source_import_automation_allowed",
    "Source import automation must remain blocked.",
  );
  assertFalse(
    packet,
    "automatic_answer_approval_allowed",
    "Automatic answer approval must remain blocked.",
  );
  assertFalse(
    packet,
    "automatic_task_generation_allowed",
    "Automatic task generation must remain blocked.",
  );
  assertFalse(packet, "email_ingress_allowed", "Email ingress must remain blocked.");
  assertFalse(packet, "outbound_email_allowed", "Outbound email must remain blocked.");
  assertFalse(
    packet,
    "notification_sending_allowed",
    "Notifications must remain blocked.",
  );
  assertFalse(
    packet,
    "live_provider_enablement_allowed",
    "Live providers must remain blocked.",
  );
  assertFalse(
    packet,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );

  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(packet.blocked_gates, gate, "limited beta blocked gates");
  }
}

function main() {
  const limitedBetaPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH ??
      DEFAULT_LIMITED_BETA_PACKET_PATH,
    "OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH",
    { mustExist: true },
  );
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH ??
      DEFAULT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH",
  );

  invariant(
    !existsSync(preflightPath.resolved),
    "OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH already exists.",
  );

  const { artifact: limitedBetaPacket, sha256: limitedBetaPacketSha256 } =
    readJsonArtifact(limitedBetaPath.resolved, "limited beta onboarding packet");
  assertLimitedBetaPacket(limitedBetaPacket);

  const preflight = {
    artifact_kind: "admin_public_self_serve_preflight",
    status: "admin_public_self_serve_preflight_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_limited_beta_onboarding_packet",
    limited_beta_onboarding_packet_path: limitedBetaPath.relativePath,
    limited_beta_onboarding_packet_sha256: limitedBetaPacketSha256,
    candidate_gym_label: limitedBetaPacket.candidate_gym_label,
    owner_access_mode: "operator_managed_until_launch_gate_green",
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
    required_green_before_launch: [
      "Real customer-observed demo gate recorded and imported into hosted Neon.",
      "At least one limited operator-assisted beta onboarding completed for a non-House-of-Fitness gym.",
      "Reset and rollback checklist exercised after the beta onboarding.",
      "Support handoff packet verified with no unexpected tenant data.",
      "Security review confirms invite delivery, provider ingress, and billing remain separately gated.",
    ],
    allowed_next_work: [
      "Design public owner request intake as request-only, not approval.",
      "Design invite-delivery preflight without sending invites.",
      "Design provider-activation checklist as a separate gated launch slice.",
    ],
    inspect_command: "npm run admin:public-self-serve:inspect",
  };

  assertNoSecretShapedKeys(preflight, "public self-serve preflight");
  assertNoSecretShapedValue(JSON.stringify(preflight), "public self-serve preflight");

  mkdirSync(dirname(preflightPath.resolved), { recursive: true });
  writeFileSync(preflightPath.resolved, `${JSON.stringify(preflight, null, 2)}\n`);

  console.log(`Public self-serve preflight wrote ${preflightPath.relativePath}`);
  console.log("Public self-serve launch: blocked");
  console.log("Invite delivery: blocked");
  console.log("Live providers: blocked");
}

main();
