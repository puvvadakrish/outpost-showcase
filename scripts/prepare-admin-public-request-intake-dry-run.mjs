#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_APPROVED_FOLLOWTHROUGH_PATH =
  "artifacts/admin-launch-readiness/admin-approved-gym-followthrough-packet.json";
const DEFAULT_DRY_RUN_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-intake-dry-run.json";

const REQUIRED_BLOCKED_GATES = [
  "Public owner self-signup",
  "Browser approval buttons",
  "Automatic approval",
  "Owner provisioning",
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

function assertFalse(packet, key, message) {
  invariant(packet[key] === false, message);
}

function assertApprovedFollowthrough(packet) {
  invariant(
    packet.artifact_kind === "admin_approved_gym_request_followthrough_packet",
    "Approved gym follow-through artifact kind mismatch.",
  );
  invariant(
    packet.status === "admin_approved_gym_request_followthrough_prepared",
    "Approved gym follow-through status mismatch.",
  );
  invariant(
    packet.owner_access_mode === "operator_managed",
    "Owner access must remain operator-managed.",
  );
  invariant(
    packet.approved_gym_non_acme_fitness === true,
    "Approved gym must be explicitly non-House-of-Fitness.",
  );
  assertFalse(
    packet,
    "owner_grant_automatic",
    "Owner grant must not be automatic.",
  );
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
  invariant(packet.request?.id, "Approved packet request id required.");
  invariant(packet.request?.owner_email, "Approved packet owner email required.");
  invariant(packet.request?.gym_name, "Approved packet gym name required.");
  invariant(
    packet.public_self_serve_preflight_sha256?.match(/^[a-f0-9]{64}$/u),
    "Approved packet public preflight digest missing.",
  );
  invariant(
    packet.owner_beta_request_followthrough_sha256?.match(/^[a-f0-9]{64}$/u),
    "Approved packet owner follow-through digest missing.",
  );
}

function optionalText(envName, fallback, maxLength) {
  const value = process.env[envName]?.trim() || fallback;
  invariant(value && value.length <= maxLength, `${envName} is invalid.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function main() {
  const followthroughPacketPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH ??
      DEFAULT_APPROVED_FOLLOWTHROUGH_PATH,
    "OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH",
    { mustExist: true },
  );
  const dryRunPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH ??
      DEFAULT_DRY_RUN_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH",
  );
  invariant(
    !existsSync(dryRunPath.resolved),
    "OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH already exists.",
  );

  const { artifact: followthroughPacket, sha256: followthroughPacketSha256 } =
    readJsonArtifact(
      followthroughPacketPath.resolved,
      "approved gym follow-through packet",
    );
  assertApprovedFollowthrough(followthroughPacket);
  const publicPreflightPath = normalizeArtifactPath(
    followthroughPacket.public_self_serve_preflight_path,
    "approved packet public self-serve preflight path",
    { mustExist: true },
  );
  const ownerFollowthroughPath = normalizeArtifactPath(
    followthroughPacket.owner_beta_request_followthrough_path,
    "approved packet owner beta follow-through path",
    { mustExist: true },
  );
  const { sha256: publicPreflightSha256 } = readJsonArtifact(
    publicPreflightPath.resolved,
    "approved packet public self-serve preflight parent",
  );
  const { sha256: ownerFollowthroughSha256 } = readJsonArtifact(
    ownerFollowthroughPath.resolved,
    "approved packet owner beta follow-through parent",
  );
  invariant(
    followthroughPacket.public_self_serve_preflight_sha256 ===
      publicPreflightSha256,
    "Approved packet public self-serve preflight digest mismatch.",
  );
  invariant(
    followthroughPacket.owner_beta_request_followthrough_sha256 ===
      ownerFollowthroughSha256,
    "Approved packet owner beta follow-through digest mismatch.",
  );

  const dryRunGym = optionalText(
    "OUTPOST_ADMIN_PUBLIC_REQUEST_DRY_RUN_GYM",
    followthroughPacket.approved_gym_label,
    160,
  );
  const dryRunOwnerEmail = optionalText(
    "OUTPOST_ADMIN_PUBLIC_REQUEST_DRY_RUN_OWNER_EMAIL",
    followthroughPacket.request.owner_email,
    180,
  );

  const dryRun = {
    artifact_kind: "admin_public_request_intake_dry_run",
    status: "admin_public_request_intake_dry_run_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_approved_gym_request_followthrough_packet",
    approved_gym_followthrough_packet_path: followthroughPacketPath.relativePath,
    approved_gym_followthrough_packet_sha256: followthroughPacketSha256,
    dry_run_request: {
      gym_label: dryRunGym,
      owner_email: dryRunOwnerEmail,
      source: "operator-entered public request dry-run",
      persisted_request_allowed: false,
    },
    intake_mode: "request_only_review_only",
    public_request_form_allowed: false,
    public_self_serve_launch_allowed: false,
    automatic_approval_allowed: false,
    owner_provisioning_allowed: false,
    owner_grant_automatic: false,
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
    operator_review_steps: [
      "Capture request intent without creating owner access.",
      "Review gym fit manually before any approval.",
      "Use existing operator-managed access commands only after approval.",
      "Keep invite delivery and public approval buttons disabled.",
      "Do not activate providers, billing, POS, or member-ledger writes.",
    ],
    next_recommended_slices: [
      "Invite delivery preflight after public request intake dry-run is green.",
      "Auth admin provisioning dry-run after invite delivery remains explicitly blocked.",
    ],
  };

  assertNoSecretShapedKeys(dryRun, "public request intake dry-run");
  const serialized = `${JSON.stringify(dryRun, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "public request intake dry-run");

  mkdirSync(dirname(dryRunPath.resolved), { recursive: true });
  writeFileSync(dryRunPath.resolved, serialized, { flag: "wx" });

  console.log(`Public request intake dry-run wrote ${dryRunPath.relativePath}`);
  console.log(`Dry-run gym: ${dryRunGym}`);
  console.log("Intake mode: request-only/review-only");
  console.log("Automatic approval: blocked");
  console.log("Owner provisioning: blocked");
  console.log("Invite delivery: blocked");
  console.log(`Packet sha256: ${sha256(serialized)}`);
}

main();
