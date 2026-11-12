#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_HANDOFF_PROOF_BUNDLE_PATH =
  "artifacts/admin-launch-readiness/admin-handoff-proof-bundle.json";
const DEFAULT_HANDOFF_READINESS_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-handoff-readiness-packet.json";
const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-continuous-readiness-batch.json";

const BLOCKED_GATES = [
  "Customer-observed completion claim",
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery",
  "Notification sending",
  "Phone/email provider activation",
  "Product Auth admin API",
  "Automatic owner/staff grants",
  "Billing, POS, access control, member-ledger writes",
];

const NEXT_BATCHES = [
  {
    id: "protected_preview_walkthrough",
    title: "Protected Preview walkthrough",
    state: "pending",
    command: "npm run admin:readiness-batch:inspect",
    detail:
      "Use this batch manifest as the checklist for Admin, owner, and staff browser walkthrough proof.",
  },
  {
    id: "customer_observed_handoff_gate",
    title: "Customer-observed handoff gate",
    state: "blocked",
    command: "npm run admin:customer-session:record",
    detail:
      "Only record after the real gym owner sees the protected Preview, owner workspace, staff path, reset/rollback checklist, and blocked live-provider claims.",
  },
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
  invariant(relativePath.startsWith(`artifacts${sep}`), `${label} must under artifacts/.`);
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  } else {
    invariant(!existsSync(resolved), `${label} already exists: ${relativePath}`);
  }
  return { relativePath, resolved };
}

function assertNoSecretShapedValue(value, label) {
  if (typeof value !== "string") return;
  const secretLike =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(value) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(value) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(value) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(value) ||
    value.includes("__Secure-neon-auth") ||
    value.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      value,
    );
  invariant(!secretLike, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (!value || typeof value !== "object") return;
  for (const [key, nestedValue] of Object.entries(value)) {
    const path = [...trail, key].join(".");
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
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
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, label);
  const artifact = JSON.parse(source);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: createHash("sha256").update(source).digest("hex") };
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function assertSafeBranch(branchName, label) {
  invariant(branchName && typeof branchName === "string", `${label} branch required.`);
  invariant(!/^production$/iu.test(branchName), `${label} must not target production branch.`);
  invariant(!/outpost-neon-spike/iu.test(branchName), `${label} must not target migration spike branch.`);
}

function assertHttpsPreview(value, label) {
  invariant(value && typeof value === "string", `${label} Preview URL required.`);
  const parsed = new URL(value);
  invariant(parsed.protocol === "https:", `${label} Preview URL must use https.`);
  invariant(!parsed.username && !parsed.password, `${label} Preview URL must not include credentials.`);
  invariant(
    !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname),
    `${label} Preview URL must not be local.`,
  );
}

function assertHandoffProofBundle(bundle) {
  invariant(
    bundle.artifact_kind === "admin_handoff_proof_bundle",
    "Handoff proof bundle kind mismatch.",
  );
  invariant(
    bundle.status === "admin_handoff_proof_bundle_prepared",
    "Handoff proof bundle status mismatch.",
  );
  invariant(
    bundle.ready_for_internal_end_to_end_test === true,
    "Handoff proof bundle must be ready for internal end-to-end test.",
  );
  assertFalse(bundle, "customer_observed_completion_recorded", "Customer completion must remain blocked.");
  assertFalse(bundle, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(bundle, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(bundle, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(bundle, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(bundle, "product_auth_admin_api_allowed", "Product Auth admin API must remain blocked.");
  assertFalse(bundle, "automatic_owner_staff_grants_allowed", "Automatic grants must remain blocked.");
  assertFalse(bundle, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  assertSafeBranch(bundle.hosted_neon_branch, "Handoff proof bundle");
  assertHttpsPreview(bundle.protected_preview_url, "Handoff proof bundle");
}

function assertHandoffReadinessPacket(packet) {
  invariant(
    packet.artifact_kind === "admin_handoff_readiness_packet",
    "Handoff readiness packet kind mismatch.",
  );
  invariant(
    packet.status === "admin_handoff_readiness_packet_exported",
    "Handoff readiness packet status mismatch.",
  );
  invariant(["ready", "action_required"].includes(packet.readiness_state), "Handoff readiness state invalid.");
  assertFalse(packet, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(packet, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertIncludes(packet.blocked_gates, "public_owner_self_signup", "handoff readiness blocked gates");
  assertIncludes(packet.blocked_gates, "phone_email_provider_activation", "handoff readiness blocked gates");
  assertIncludes(packet.blocked_gates, "pos_access_control_member_ledger_writes", "handoff readiness blocked gates");
  assertSafeBranch(packet.neon_branch_name, "Handoff readiness packet");
  assertHttpsPreview(packet.preview_url, "Handoff readiness packet");
}

function main() {
  const handoffProofPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH ?? DEFAULT_HANDOFF_PROOF_BUNDLE_PATH,
    "OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH",
    { mustExist: true },
  );
  const handoffReadinessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH ?? DEFAULT_HANDOFF_READINESS_PACKET_PATH,
    "OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH",
    { mustExist: true },
  );
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH ?? DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH",
  );

  const { artifact: handoffProof, sha256: handoffProofSha256 } = readJsonArtifact(
    handoffProofPath.resolved,
    "handoff proof bundle",
  );
  const { artifact: handoffReadiness, sha256: handoffReadinessSha256 } =
    readJsonArtifact(handoffReadinessPath.resolved, "handoff readiness packet");

  assertHandoffProofBundle(handoffProof);
  assertHandoffReadinessPacket(handoffReadiness);
  invariant(
    handoffProof.hosted_neon_branch === handoffReadiness.neon_branch_name,
    "Parent hosted Neon branches must match.",
  );
  invariant(
    handoffProof.protected_preview_url === handoffReadiness.preview_url,
    "Parent protected Preview URLs must match.",
  );

  const batch = {
    artifact_kind: "admin_continuous_readiness_batch",
    status: "admin_continuous_readiness_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "handoff_proof_bundle_and_handoff_readiness_packet",
    handoff_proof_bundle_path: handoffProofPath.relativePath,
    handoff_proof_bundle_sha256: handoffProofSha256,
    handoff_readiness_packet_path: handoffReadinessPath.relativePath,
    handoff_readiness_packet_sha256: handoffReadinessSha256,
    protected_preview_url: handoffReadiness.preview_url,
    hosted_neon_branch: handoffReadiness.neon_branch_name,
    reviewed_owner_email: handoffProof.reviewed_owner_email,
    staff_email: handoffProof.staff_email,
    ready_for_protected_preview_walkthrough: true,
    ready_for_customer_observed_handoff: false,
    customer_observed_completion_recorded: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: BLOCKED_GATES,
    next_batches: NEXT_BATCHES,
    replay_commands: [
      "npm run admin:handoff-proof:bundle:inspect",
      "npm run admin:handoff-readiness:replay",
      "npm run admin:readiness-batch:inspect",
    ],
  };

  assertNoSecretShapedKeys(batch, "continuous readiness batch");
  const serialized = `${JSON.stringify(batch, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "continuous readiness batch");
  mkdirSync(dirname(batchPath.resolved), { recursive: true });
  writeFileSync(batchPath.resolved, serialized);
  console.log("Admin continuous readiness batch wrote");
  console.log(`Artifact: ${batchPath.relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Protected Preview walkthrough: ready");
  console.log("Customer-observed handoff: blocked");
  console.log("Public self-serve/live-provider gates: blocked");
}

main();
