#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BUNDLE_PATH =
  "artifacts/admin-launch-readiness/admin-first-gym-go-no-go-bundle.json";

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

function assertChildHash(pathValue, expectedSha, expectedKind, label) {
  invariant(/^[a-f0-9]{64}$/u.test(String(expectedSha ?? "")), `${label} SHA256 missing.`);
  const childPath = normalizeArtifactPath(pathValue, `${label} path`);
  const { artifact, sha256 } = readJsonArtifact(childPath.resolved, label);
  invariant(sha256 === expectedSha, `${label} SHA256 does not match child artifact.`);
  invariant(artifact.artifact_kind === expectedKind, `${label} kind mismatch.`);
  return artifact;
}

function main() {
  const bundlePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH ?? DEFAULT_BUNDLE_PATH,
    "OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
  );
  const { artifact: bundle } = readJsonArtifact(
    bundlePath.resolved,
    "first-gym go/no-go bundle",
  );

  invariant(bundle.artifact_kind === "admin_first_gym_go_no_go_bundle", "First-gym bundle kind mismatch.");
  invariant(bundle.status === "admin_first_gym_go_no_go_bundle_prepared", "First-gym bundle status mismatch.");
  invariant(
    bundle.evidence_basis === "approved_gym_hosted_rehearsal_and_customer_observed_session",
    "First-gym bundle evidence basis mismatch.",
  );
  invariant(bundle.approved_gym_hosted_rehearsal_recorded === true, "Hosted rehearsal must be recorded.");
  invariant(bundle.customer_observed_session_recorded === true, "Customer session must be recorded.");
  invariant(bundle.customer_observed_handoff_claimed === true, "Customer handoff must be claimed by session proof.");
  invariant(bundle.first_gym_go_no_go_bundle_ready === true, "First-gym go/no-go bundle must be ready.");
  invariant(bundle.ready_for_first_gym_operator_assisted_run === true, "First-gym operator-assisted run must be ready.");
  assertFalse(bundle, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(bundle, "browser_approval_buttons_allowed", "Browser approvals blocked.");
  assertFalse(bundle, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(bundle, "staff_invite_delivery_allowed", "Staff invite delivery blocked.");
  assertFalse(bundle, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(bundle, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(bundle, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(bundle, "auth_user_created", "Auth user creation blocked.");
  assertFalse(bundle, "automatic_owner_staff_grants_allowed", "Automatic grants blocked.");
  assertFalse(bundle, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(bundle, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");

  const rehearsal = assertChildHash(
    bundle.approved_gym_hosted_rehearsal_evidence_path,
    bundle.approved_gym_hosted_rehearsal_evidence_sha256,
    "admin_approved_gym_hosted_rehearsal_evidence",
    "approved-gym hosted rehearsal evidence",
  );
  const customerSession = assertChildHash(
    bundle.customer_session_record_path,
    bundle.customer_session_record_sha256,
    "admin_customer_observed_session_record",
    "customer-observed session record",
  );
  invariant(
    rehearsal.approved_gym_label === customerSession.gym_name,
    "Hosted rehearsal and customer-observed session must target the same gym.",
  );
  assertIncludes(bundle.ready_gates, "Approved-gym hosted rehearsal evidence recorded", "ready_gates");
  assertIncludes(bundle.ready_gates, "Real customer-observed session record present", "ready_gates");
  assertIncludes(bundle.ready_gates, "Parent artifact SHA chain verified", "ready_gates");
  assertIncludes(bundle.blocked_gates, "Public owner self-signup", "blocked_gates");
  assertIncludes(bundle.blocked_gates, "Invite delivery send", "blocked_gates");
  assertIncludes(bundle.blocked_gates, "Phone/email provider activation", "blocked_gates");
  assertIncludes(bundle.blocked_gates, "Billing, POS, access control, member-ledger writes", "blocked_gates");

  console.log("Admin first-gym go/no-go bundle inspection passed");
}

main();
