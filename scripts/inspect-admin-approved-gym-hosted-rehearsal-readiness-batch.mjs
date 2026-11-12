#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-approved-gym-hosted-rehearsal-readiness-batch.json";

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
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(
      value,
    ) ||
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

function isUnsafeCustomerLabel(value) {
  return /\b(house\s*of\s*fitness|acme|dry[-\s]?run|internal|sample|fixture|fake)\b/iu.test(
    String(value ?? ""),
  );
}

function runInspector(script, label, env = {}) {
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`${label} failed.\n${output}`);
  }
}

function main() {
  const batchPath = normalizeArtifactPath(
    process.env
      .OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const { artifact: batch } = readJsonArtifact(
    batchPath.resolved,
    "approved-gym hosted rehearsal readiness batch",
  );

  invariant(
    batch.artifact_kind === "admin_approved_gym_hosted_rehearsal_readiness_batch",
    "Approved-gym hosted rehearsal readiness batch kind mismatch.",
  );
  invariant(
    batch.status === "admin_approved_gym_hosted_rehearsal_readiness_batch_prepared",
    "Approved-gym hosted rehearsal readiness batch status mismatch.",
  );
  invariant(
    batch.evidence_basis === "admin_owner_staff_handoff_readiness_batch",
    "Approved-gym hosted rehearsal evidence basis mismatch.",
  );
  invariant(
    batch.approved_gym_non_acme_fitness === true,
    "Approved gym must be explicitly non-House-of-Fitness.",
  );
  invariant(
    !isUnsafeCustomerLabel(batch.approved_gym_label) &&
      !isUnsafeCustomerLabel(batch.request?.gym_name),
    "Approved-gym hosted rehearsal batch must target a real non-House-of-Fitness gym.",
  );
  invariant(
    batch.hosted_rehearsal_mode === "approved_gym_browser_rehearsal_required",
    "Hosted rehearsal must remain required.",
  );
  invariant(batch.owner_workspace_rehearsal_required === true, "Owner workspace rehearsal required.");
  invariant(batch.staff_workboard_rehearsal_required === true, "Staff workboard rehearsal required.");
  invariant(batch.reset_rollback_checklist_required === true, "Reset rollback checklist required.");
  invariant(batch.no_unexpected_data_claim_required === true, "Unexpected data claim required.");
  invariant(batch.no_live_provider_claim_required === true, "No-live-provider claim required.");
  assertFalse(batch, "owner_access_fulfillment_evidence_recorded", "Owner access evidence must remain unrecorded.");
  assertFalse(batch, "staff_invite_no_send_preflight_recorded", "Staff no-send preflight must remain unrecorded.");
  assertFalse(batch, "approved_gym_hosted_rehearsal_recorded", "Hosted rehearsal must not be recorded by this batch.");
  assertFalse(batch, "customer_observed_handoff_recorded", "Customer-observed handoff blocked.");
  assertFalse(batch, "first_gym_go_no_go_bundle_ready", "First gym go/no-go bundle blocked.");

  assertFalse(batch, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(batch, "browser_approval_buttons_allowed", "Browser approvals blocked.");
  assertFalse(batch, "automatic_approval_allowed", "Automatic approval blocked.");
  assertFalse(batch, "owner_provisioning_allowed", "Owner provisioning blocked.");
  assertFalse(batch, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(batch, "auth_admin_product_api_allowed", "Auth admin product API blocked.");
  assertFalse(batch, "auth_user_created", "Auth user creation blocked.");
  assertFalse(batch, "owner_grant_automatic", "Automatic owner grants blocked.");
  assertFalse(batch, "automatic_owner_staff_grants_allowed", "Automatic owner/staff grants blocked.");
  assertFalse(batch, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(batch, "staff_invite_delivery_allowed", "Staff invite delivery blocked.");
  assertFalse(batch, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(batch, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(batch, "gmail_resend_smtp_provider_allowed", "Provider send path blocked.");
  assertFalse(batch, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(batch, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");

  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(batch.blocked_gates, gate, "blocked_gates");
  }
  assertIncludes(
    batch.current_batch_set,
    "Approved-gym hosted browser rehearsal command path prepared",
    "current_batch_set",
  );
  assertIncludes(
    batch.current_batch_set,
    "Customer-observed walkthrough remains blocked",
    "current_batch_set",
  );

  const parentPath = normalizeArtifactPath(
    batch.owner_staff_handoff_readiness_batch_path,
    "owner_staff_handoff_readiness_batch_path",
    { mustExist: true },
  );
  const { sha256: parentSha256 } = readJsonArtifact(
    parentPath.resolved,
    "owner/staff handoff readiness batch",
  );
  invariant(
    parentSha256 === batch.owner_staff_handoff_readiness_batch_sha256,
    "Owner/staff handoff readiness batch SHA256 does not match.",
  );

  runInspector(
    "scripts/inspect-admin-owner-staff-handoff-readiness-batch.mjs",
    "Owner/staff handoff readiness inspection",
    {
      OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
        parentPath.relativePath,
    },
  );

  console.log("Admin approved-gym hosted rehearsal readiness batch OK.");
}

main();
