#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-request-intake-invite-auth-readiness-batch.json";

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
    process.env.OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const { artifact: batch } = readJsonArtifact(
    batchPath.resolved,
    "request-intake invite/Auth readiness batch",
  );

  invariant(
    batch.artifact_kind === "admin_request_intake_invite_auth_readiness_batch",
    "Request-intake invite/Auth readiness batch kind mismatch.",
  );
  invariant(
    batch.status === "admin_request_intake_invite_auth_readiness_batch_prepared",
    "Request-intake invite/Auth readiness batch status mismatch.",
  );
  invariant(
    batch.evidence_basis === "admin_approved_beta_expansion_readiness_batch",
    "Request-intake invite/Auth evidence basis mismatch.",
  );
  invariant(
    batch.approved_gym_non_acme_fitness === true,
    "Approved gym must be explicitly non-House-of-Fitness.",
  );
  invariant(
    !isUnsafeCustomerLabel(batch.approved_gym_label) &&
      !isUnsafeCustomerLabel(batch.request?.gym_name),
    "Request-intake invite/Auth batch must target a real non-House-of-Fitness gym.",
  );
  invariant(
    batch.operator_fulfillment_mode === "operator_managed_owner_access_only",
    "Operator fulfillment must remain owner-access-only.",
  );
  invariant(
    batch.public_request_intake_mode === "request_only_review_only_no_persistence",
    "Public request intake must remain request-only review-only.",
  );
  invariant(
    batch.invite_preflight_mode === "review_only_no_send",
    "Invite delivery must remain no-send.",
  );
  invariant(
    batch.auth_admin_dry_run_mode === "operator_review_only_no_user_created",
    "Auth admin dry-run must not create users.",
  );
  invariant(
    batch.approved_gym_operator_fulfillment_ready === true,
    "Approved gym operator fulfillment readiness missing.",
  );
  invariant(
    batch.public_request_intake_dry_run_ready === true,
    "Public request intake dry-run readiness missing.",
  );
  invariant(
    batch.invite_delivery_preflight_ready === true,
    "Invite delivery preflight readiness missing.",
  );
  invariant(
    batch.auth_admin_provisioning_dry_run_ready === true,
    "Auth admin provisioning dry-run readiness missing.",
  );

  assertFalse(batch, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(batch, "public_request_form_allowed", "Public request form blocked.");
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
    "Public request intake as request-only review-only dry-run",
    "current_batch_set",
  );
  assertIncludes(
    batch.current_batch_set,
    "Invite delivery as no-send preflight",
    "current_batch_set",
  );
  assertIncludes(
    batch.current_batch_set,
    "Auth admin provisioning as no-create dry-run",
    "current_batch_set",
  );

  const approvedExpansionPath = normalizeArtifactPath(
    batch.approved_beta_expansion_readiness_batch_path,
    "approved_beta_expansion_readiness_batch_path",
    { mustExist: true },
  );
  const { sha256: approvedExpansionSha256 } = readJsonArtifact(
    approvedExpansionPath.resolved,
    "approved beta expansion readiness batch",
  );
  invariant(
    approvedExpansionSha256 === batch.approved_beta_expansion_readiness_batch_sha256,
    "Approved beta expansion readiness batch SHA256 does not match.",
  );

  runInspector(
    "scripts/inspect-admin-approved-beta-expansion-readiness-batch.mjs",
    "Approved beta expansion readiness inspection",
    {
      OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH:
        approvedExpansionPath.relativePath,
    },
  );

  console.log("Admin request-intake invite/Auth readiness batch OK.");
}

main();
