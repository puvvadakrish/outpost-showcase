#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-limited-beta-operator-review-packet.json";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoSecretShapedKeys(entry, label, [...trail, String(index)]),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    invariant(
      !/(password|token|cookie|apikey|authorization|credential|privatekey|secret|bypass|signature|jwt)/u.test(
        normalizedKey,
      ),
      `${label} contains secret-shaped key ${path}.`,
    );
    assertNoSecretShapedValue(entry, `${label}.${path}`);
    assertNoSecretShapedKeys(entry, label, [...trail, key]);
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
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  return { relativePath, resolved };
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

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function assertParentHash(pathValue, expectedSha, expectedKind, label) {
  invariant(/^[a-f0-9]{64}$/u.test(String(expectedSha ?? "")), `${label} SHA256 missing.`);
  const parentPath = normalizeArtifactPath(pathValue, `${label} path`);
  const { artifact, sha256 } = readJsonArtifact(parentPath.resolved, label);
  invariant(sha256 === expectedSha, `${label} SHA256 does not match parent artifact.`);
  invariant(artifact.artifact_kind === expectedKind, `${label} kind mismatch.`);
  return artifact;
}

function main() {
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH ?? DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH",
  );
  const { artifact: packet } = readJsonArtifact(
    packetPath.resolved,
    "limited beta operator review packet",
  );

  invariant(packet.artifact_kind === "admin_limited_beta_operator_review_packet", "Limited beta review kind mismatch.");
  invariant(packet.status === "admin_limited_beta_operator_review_packet_prepared", "Limited beta review status mismatch.");
  invariant(packet.evidence_basis === "admin_first_gym_operator_run_record", "Limited beta review evidence basis mismatch.");
  invariant(packet.first_gym_run_reviewed === true, "First gym run review required.");
  invariant(packet.limited_beta_operator_review_ready === true, "Limited beta review must be ready.");
  invariant(packet.owner_access_mode === "operator_managed", "Owner access must remain operator-managed.");
  invariant(packet.request_triage_required === true, "Request triage required.");
  invariant(packet.followthrough_required === true, "Follow-through required.");
  assertFalse(packet, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(packet, "browser_approval_buttons_allowed", "Browser approvals blocked.");
  assertFalse(packet, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(packet, "staff_invite_delivery_allowed", "Staff invite delivery blocked.");
  assertFalse(packet, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(packet, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(packet, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(packet, "auth_user_created", "Auth user creation blocked.");
  assertFalse(packet, "automatic_owner_staff_grants_allowed", "Automatic grants blocked.");
  assertFalse(packet, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(packet, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
  const parent = assertParentHash(
    packet.first_gym_operator_run_record_path,
    packet.first_gym_operator_run_record_sha256,
    "admin_first_gym_operator_run_record",
    "first-gym operator run record",
  );
  invariant(parent.gym_name === packet.first_gym_name, "Parent gym and limited beta review gym mismatch.");
  assertIncludes(packet.blocked_gates, "Public owner self-signup", "blocked_gates");
  assertIncludes(packet.blocked_gates, "Invite delivery", "blocked_gates");
  assertIncludes(packet.blocked_gates, "Billing, POS, access control, member-ledger writes", "blocked_gates");
  invariant(Array.isArray(packet.operator_checklist) && packet.operator_checklist.length >= 5, "Operator checklist incomplete.");

  console.log("Admin limited beta operator review inspection passed");
}

main();
