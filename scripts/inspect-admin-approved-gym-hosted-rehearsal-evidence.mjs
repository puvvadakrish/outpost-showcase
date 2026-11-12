#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_EVIDENCE_PATH =
  "artifacts/admin-launch-readiness/admin-approved-gym-hosted-rehearsal-evidence.json";

const REQUIRED_BLOCKED_GATES = [
  "Customer-observed completion claim",
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery send",
  "Notification sending",
  "Phone/email provider activation",
  "Product Auth admin API",
  "Automatic owner/staff grants",
  "Billing, POS, access control, member-ledger writes",
];

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
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  }
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

function main() {
  const evidencePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH ??
      DEFAULT_EVIDENCE_PATH,
    "OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH",
    { mustExist: true },
  );
  const { artifact: evidence } = readJsonArtifact(
    evidencePath.resolved,
    "approved-gym hosted rehearsal evidence",
  );

  invariant(
    evidence.artifact_kind === "admin_approved_gym_hosted_rehearsal_evidence",
    "Approved-gym hosted rehearsal evidence kind mismatch.",
  );
  invariant(
    evidence.status === "admin_approved_gym_hosted_rehearsal_recorded",
    "Approved-gym hosted rehearsal evidence status mismatch.",
  );
  invariant(
    evidence.evidence_basis === "admin_approved_gym_hosted_rehearsal_readiness_batch",
    "Approved-gym hosted rehearsal evidence basis mismatch.",
  );
  invariant(evidence.approved_gym_non_acme_fitness === true, "Approved gym must be non-House-of-Fitness.");
  invariant(evidence.approved_gym_hosted_rehearsal_recorded === true, "Hosted rehearsal evidence must be recorded.");
  invariant(evidence.observed?.owner_workspace_observed === true, "Owner workspace observation required.");
  invariant(evidence.observed?.staff_workboard_observed === true, "Staff workboard observation required.");
  invariant(evidence.observed?.reset_rollback_reviewed === true, "Reset/rollback observation required.");
  invariant(evidence.observed?.unexpected_data_not_observed === true, "No unexpected data observation required.");
  invariant(evidence.observed?.live_provider_claims_not_observed === true, "No live-provider claim observation required.");
  invariant(evidence.observed?.invite_delivery_not_observed === true, "No invite delivery observation required.");
  invariant(
    evidence.observed?.billing_pos_member_writes_not_observed === true,
    "No billing/POS/member write observation required.",
  );

  assertFalse(evidence, "customer_observed_handoff_recorded", "Customer-observed handoff must remain blocked.");
  assertFalse(evidence, "customer_observed_handoff_claimed", "Customer-observed handoff must not be claimed.");
  assertFalse(evidence, "first_gym_go_no_go_bundle_ready", "First-gym go/no-go must remain blocked.");
  assertFalse(evidence, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(evidence, "browser_approval_buttons_allowed", "Browser approvals blocked.");
  assertFalse(evidence, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(evidence, "staff_invite_delivery_allowed", "Staff invite delivery blocked.");
  assertFalse(evidence, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(evidence, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(evidence, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(evidence, "auth_user_created", "Auth user creation blocked.");
  assertFalse(evidence, "automatic_owner_staff_grants_allowed", "Automatic grants blocked.");
  assertFalse(evidence, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(evidence, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");

  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(evidence.blocked_gates, gate, "blocked_gates");
  }

  const readinessPath = normalizeArtifactPath(
    evidence.approved_gym_hosted_rehearsal_readiness_batch_path,
    "approved_gym_hosted_rehearsal_readiness_batch_path",
    { mustExist: true },
  );
  const { artifact: readiness, sha256: readinessSha256 } = readJsonArtifact(
    readinessPath.resolved,
    "approved-gym hosted rehearsal readiness batch",
  );
  invariant(
    readinessSha256 === evidence.approved_gym_hosted_rehearsal_readiness_batch_sha256,
    "Approved-gym hosted rehearsal readiness batch SHA256 does not match.",
  );
  invariant(
    readiness.artifact_kind === "admin_approved_gym_hosted_rehearsal_readiness_batch",
    "Approved-gym hosted rehearsal readiness parent kind mismatch.",
  );

  console.log("Admin approved-gym hosted rehearsal evidence OK.");
}

main();
