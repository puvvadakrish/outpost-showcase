#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_RECORD_PATH =
  "artifacts/admin-launch-readiness/admin-first-gym-operator-run-record.json";

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
  const recordPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_FIRST_GYM_OPERATOR_RUN_RECORD_PATH ?? DEFAULT_RECORD_PATH,
    "OUTPOST_ADMIN_FIRST_GYM_OPERATOR_RUN_RECORD_PATH",
  );
  const { artifact: record } = readJsonArtifact(
    recordPath.resolved,
    "first-gym operator run record",
  );

  invariant(record.artifact_kind === "admin_first_gym_operator_run_record", "First-gym run record kind mismatch.");
  invariant(record.status === "admin_first_gym_operator_run_recorded", "First-gym run record status mismatch.");
  invariant(record.evidence_basis === "admin_first_gym_go_no_go_bundle", "First-gym run evidence basis mismatch.");
  invariant(record.first_gym_operator_assisted_run_recorded === true, "First-gym run must be recorded.");
  invariant(record.first_gym_operator_assisted_run_successful === true, "First-gym run must be successful.");
  invariant(record.ready_for_limited_beta_review === true, "Limited beta review must be ready.");
  invariant(record.observed?.owner_workspace_completed === true, "Owner workspace completion required.");
  invariant(record.observed?.staff_workboard_completed === true, "Staff workboard completion required.");
  invariant(record.observed?.source_answer_task_flow_completed === true, "Source/answer/task flow required.");
  invariant(record.observed?.reset_rollback_exercised === true, "Reset/rollback exercise required.");
  invariant(record.observed?.support_handoff_reviewed === true, "Support handoff review required.");
  invariant(record.observed?.unexpected_data_not_observed === true, "No unexpected data observation required.");
  invariant(record.observed?.live_provider_claims_not_observed === true, "No live-provider claims observation required.");
  invariant(record.observed?.invite_delivery_not_observed === true, "No invite delivery observation required.");
  invariant(record.observed?.billing_pos_member_writes_not_observed === true, "No billing/POS/member writes observation required.");
  assertFalse(record, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(record, "public_request_form_allowed", "Public request form blocked.");
  assertFalse(record, "browser_approval_buttons_allowed", "Browser approvals blocked.");
  assertFalse(record, "automatic_approval_allowed", "Automatic approvals blocked.");
  assertFalse(record, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(record, "staff_invite_delivery_allowed", "Staff invite delivery blocked.");
  assertFalse(record, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(record, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(record, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(record, "auth_user_created", "Auth user creation blocked.");
  assertFalse(record, "automatic_owner_staff_grants_allowed", "Automatic grants blocked.");
  assertFalse(record, "gmail_resend_smtp_provider_allowed", "Gmail/Resend/SMTP provider blocked.");
  assertFalse(record, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(record, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
  const parent = assertParentHash(
    record.first_gym_go_no_go_bundle_path,
    record.first_gym_go_no_go_bundle_sha256,
    "admin_first_gym_go_no_go_bundle",
    "first-gym go/no-go bundle",
  );
  invariant(parent.gym_name === record.gym_name, "Parent gym and run record gym mismatch.");
  invariant(parent.owner_email === record.owner_email, "Parent owner and run record owner mismatch.");
  assertIncludes(record.ready_gates, "Staff workboard completed", "ready_gates");
  assertIncludes(record.blocked_gates, "Public owner self-signup", "blocked_gates");
  assertIncludes(record.blocked_gates, "Invite delivery send", "blocked_gates");
  assertIncludes(record.blocked_gates, "Billing, POS, access control, member-ledger writes", "blocked_gates");

  console.log("Admin first-gym operator-assisted run inspection passed");
}

main();
