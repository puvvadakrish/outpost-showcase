#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-self-serve-launch-preflight.json";

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

function runLimitedBetaReviewInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-limited-beta-operator-review-packet.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH: path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(`Public request limited beta operator review inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function main() {
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH ?? DEFAULT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH",
  );
  const { artifact: preflight } = readJsonArtifact(
    preflightPath.resolved,
    "public request self-serve launch preflight",
  );

  invariant(preflight.artifact_kind === "admin_public_request_self_serve_launch_preflight", "Public request self-serve launch preflight kind mismatch.");
  invariant(preflight.status === "admin_public_request_self_serve_launch_preflight_prepared", "Public request self-serve launch preflight status mismatch.");
  invariant(preflight.evidence_basis === "admin_public_request_limited_beta_operator_review_packet", "Public request self-serve preflight evidence basis mismatch.");
  invariant(preflight.public_self_serve_launch_preflight_ready === true, "Public self-serve launch preflight must be ready.");
  invariant(
    preflight.owner_access_mode === "operator_managed_until_public_launch_gate_green",
    "Owner access must remain operator-managed until public launch gate is green.",
  );
  assertFalse(preflight, "public_self_serve_launch_allowed", "Public self-serve launch blocked.");
  assertFalse(preflight, "browser_approval_buttons_allowed", "Browser approvals blocked.");
  assertFalse(preflight, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(preflight, "staff_invite_delivery_allowed", "Staff invite delivery blocked.");
  assertFalse(preflight, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(preflight, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(preflight, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(preflight, "auth_user_created", "Auth user creation blocked.");
  assertFalse(preflight, "automatic_owner_staff_grants_allowed", "Automatic grants blocked.");
  assertFalse(preflight, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(preflight, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
  runLimitedBetaReviewInspect(preflight.public_request_limited_beta_operator_review_packet_path);
  const parent = assertParentHash(
    preflight.public_request_limited_beta_operator_review_packet_path,
    preflight.public_request_limited_beta_operator_review_packet_sha256,
    "admin_public_request_limited_beta_operator_review_packet",
    "public request limited beta operator review packet",
  );
  invariant(parent.candidate_gym_label === preflight.candidate_gym_label, "Parent candidate gym mismatch.");
  assertIncludes(preflight.blocked_gates, "Public owner self-signup", "blocked_gates");
  assertIncludes(preflight.blocked_gates, "Invite delivery", "blocked_gates");
  assertIncludes(preflight.blocked_gates, "Phone/email provider activation", "blocked_gates");
  assertIncludes(preflight.blocked_gates, "Billing, POS, access control, member-ledger writes", "blocked_gates");
  invariant(
    Array.isArray(preflight.required_green_before_public_launch) &&
      preflight.required_green_before_public_launch.length >= 5,
    "Public launch requirements incomplete.",
  );
  invariant(
    Array.isArray(preflight.allowed_next_work) &&
      preflight.allowed_next_work.length >= 4,
    "Allowed next work incomplete.",
  );

  console.log("Admin public request self-serve launch preflight inspection passed");
}

main();
