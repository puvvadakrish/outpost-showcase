#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-owner-staff-handoff-readiness-batch.json";

const REQUIRED_BLOCKED_GATES = [
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
    process.env.OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const { artifact: batch } = readJsonArtifact(
    batchPath.resolved,
    "owner/staff handoff readiness batch",
  );

  invariant(
    batch.artifact_kind === "admin_owner_staff_handoff_readiness_batch",
    "Owner/staff handoff readiness batch kind mismatch.",
  );
  invariant(
    batch.status === "admin_owner_staff_handoff_readiness_batch_prepared",
    "Owner/staff handoff readiness batch status mismatch.",
  );
  invariant(
    batch.evidence_basis === "admin_request_intake_invite_auth_readiness_batch",
    "Owner/staff handoff evidence basis mismatch.",
  );
  invariant(
    batch.approved_gym_non_acme_fitness === true,
    "Approved gym must be explicitly non-House-of-Fitness.",
  );
  invariant(
    !isUnsafeCustomerLabel(batch.approved_gym_label) &&
      !isUnsafeCustomerLabel(batch.request?.gym_name),
    "Owner/staff handoff batch must target a real non-House-of-Fitness gym.",
  );
  invariant(
    batch.owner_access_fulfillment_mode === "operator_managed_evidence_required",
    "Owner access fulfillment must remain operator-managed evidence.",
  );
  invariant(
    batch.staff_handoff_mode === "reviewed_roster_no_invite_send",
    "Staff handoff must remain no-send.",
  );
  invariant(
    batch.approved_gym_rehearsal_mode === "hosted_browser_rehearsal_pending",
    "Approved gym hosted rehearsal must remain pending.",
  );
  invariant(
    batch.owner_access_fulfillment_evidence_required === true,
    "Owner access evidence requirement missing.",
  );
  assertFalse(
    batch,
    "owner_access_fulfillment_evidence_recorded",
    "Owner access evidence must not be recorded by this batch.",
  );
  invariant(
    batch.staff_invite_no_send_preflight_required === true,
    "Staff no-send preflight requirement missing.",
  );
  assertFalse(
    batch,
    "staff_invite_no_send_preflight_recorded",
    "Staff no-send preflight must not be recorded by this batch.",
  );
  invariant(
    batch.approved_gym_hosted_rehearsal_required === true,
    "Approved gym hosted rehearsal requirement missing.",
  );
  assertFalse(
    batch,
    "approved_gym_hosted_rehearsal_recorded",
    "Approved gym hosted rehearsal must remain pending.",
  );
  assertFalse(
    batch,
    "customer_observed_handoff_recorded",
    "Customer-observed handoff must not be recorded by this batch.",
  );

  assertFalse(batch, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(batch, "browser_approval_buttons_allowed", "Browser approvals blocked.");
  assertFalse(batch, "automatic_approval_allowed", "Automatic approval blocked.");
  assertFalse(batch, "owner_provisioning_allowed", "Owner provisioning blocked.");
  assertFalse(batch, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(batch, "auth_admin_product_api_allowed", "Auth admin product API blocked.");
  assertFalse(batch, "auth_user_created", "Auth user creation blocked.");
  assertFalse(batch, "owner_grant_automatic", "Automatic owner grants blocked.");
  assertFalse(
    batch,
    "automatic_owner_staff_grants_allowed",
    "Automatic owner/staff grants blocked.",
  );
  assertFalse(batch, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(batch, "staff_invite_delivery_allowed", "Staff invite delivery blocked.");
  assertFalse(batch, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(batch, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(
    batch,
    "gmail_resend_smtp_provider_allowed",
    "Provider send path blocked.",
  );
  assertFalse(batch, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(
    batch,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes blocked.",
  );

  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(batch.blocked_gates, gate, "blocked_gates");
  }
  assertIncludes(
    batch.current_batch_set,
    "Operator-managed owner access fulfillment evidence path prepared",
    "current_batch_set",
  );
  assertIncludes(
    batch.current_batch_set,
    "Staff handoff no-send preflight path prepared",
    "current_batch_set",
  );
  assertIncludes(
    batch.current_batch_set,
    "Approved-gym hosted browser rehearsal remains pending",
    "current_batch_set",
  );

  const parentPath = normalizeArtifactPath(
    batch.request_intake_invite_auth_readiness_batch_path,
    "request_intake_invite_auth_readiness_batch_path",
    { mustExist: true },
  );
  const { sha256: parentSha256 } = readJsonArtifact(
    parentPath.resolved,
    "request-intake invite/Auth readiness batch",
  );
  invariant(
    parentSha256 === batch.request_intake_invite_auth_readiness_batch_sha256,
    "Request-intake invite/Auth readiness batch SHA256 does not match.",
  );

  runInspector(
    "scripts/inspect-admin-request-intake-invite-auth-readiness-batch.mjs",
    "Request-intake invite/Auth readiness inspection",
    {
      OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
        parentPath.relativePath,
    },
  );

  console.log("Admin owner/staff handoff readiness batch OK.");
}

main();
