#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PARENT_PATH =
  "artifacts/admin-launch-readiness/admin-request-intake-invite-auth-readiness-batch.json";
const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-owner-staff-handoff-readiness-batch.json";

const BLOCKED_GATES = [
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery send",
  "Notification sending",
  "Phone/email provider activation",
  "Product Auth admin API",
  "Automatic owner/staff grants",
  "Billing, POS, access control, member-ledger writes",
];

const NEXT_BATCHES = [
  {
    command:
      "Run owner/staff handoff evidence commands, then package approved-gym browser rehearsal.",
    detail:
      "Convert prepared owner/staff handoff readiness into hosted browser proof without enabling invite delivery.",
    id: "operator_assisted_onboarding_rehearsal",
    state: "pending",
    title: "Approved-gym hosted rehearsal",
  },
  {
    command:
      "Record customer-observed owner/staff walkthrough only after the approved gym sees the protected Preview.",
    detail:
      "Customer-observed proof remains separate from this operator-readiness batch.",
    id: "customer_observed_handoff_gate",
    state: "blocked",
    title: "Approved-gym customer walkthrough",
  },
  {
    command:
      "Package public self-serve launch criteria only after operator-assisted beta proof is green.",
    detail:
      "Public signup, browser approvals, automatic grants, and invite delivery stay blocked.",
    id: "public_self_serve_preflight",
    state: "blocked",
    title: "Public self-serve launch gate",
  },
  {
    command:
      "Keep phone/email providers, notifications, billing, POS, access control, member-ledger writes blocked until separately proven.",
    detail:
      "Live-provider and revenue/member-system work remains outside owner/staff handoff readiness.",
    id: "live_provider_revenue_gates",
    state: "blocked",
    title: "Live-provider and revenue gates",
  },
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

function assertParentBatch(batch) {
  invariant(
    batch.artifact_kind === "admin_request_intake_invite_auth_readiness_batch",
    "Request-intake invite/Auth parent kind mismatch.",
  );
  invariant(
    batch.status === "admin_request_intake_invite_auth_readiness_batch_prepared",
    "Request-intake invite/Auth parent status mismatch.",
  );
  invariant(
    batch.evidence_basis === "admin_approved_beta_expansion_readiness_batch",
    "Request-intake invite/Auth parent evidence basis mismatch.",
  );
  invariant(
    batch.approved_gym_non_acme_fitness === true,
    "Approved gym must be non-House-of-Fitness.",
  );
  invariant(
    !isUnsafeCustomerLabel(batch.approved_gym_label) &&
      !isUnsafeCustomerLabel(batch.request?.gym_name),
    "Owner/staff handoff batch must target a real non-House-of-Fitness gym.",
  );
  invariant(
    batch.operator_fulfillment_mode === "operator_managed_owner_access_only",
    "Operator fulfillment must remain owner-access-only.",
  );
  invariant(
    batch.invite_preflight_mode === "review_only_no_send",
    "Invite preflight must remain no-send.",
  );
  invariant(
    batch.auth_admin_dry_run_mode === "operator_review_only_no_user_created",
    "Auth admin dry-run must remain no-create.",
  );
  assertFalse(batch, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(batch, "browser_approval_buttons_allowed", "Browser approvals blocked.");
  assertFalse(batch, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(batch, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(batch, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(batch, "auth_user_created", "Auth user creation blocked.");
  assertFalse(batch, "owner_grant_automatic", "Automatic owner grants blocked.");
  assertFalse(
    batch,
    "automatic_owner_staff_grants_allowed",
    "Automatic owner/staff grants blocked.",
  );
  assertFalse(batch, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(
    batch,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes blocked.",
  );
}

function optionalText(envName, fallback, maxLength) {
  const value = process.env[envName]?.trim();
  if (!value) return fallback;
  assertNoSecretShapedValue(value, envName);
  invariant(value.length <= maxLength, `${envName} too long.`);
  return value;
}

function main() {
  const parentPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH ??
      DEFAULT_PARENT_PATH,
    "OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH",
  );
  invariant(
    !existsSync(batchPath.resolved),
    "OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH already exists.",
  );

  runInspector(
    "scripts/inspect-admin-request-intake-invite-auth-readiness-batch.mjs",
    "Request-intake invite/Auth readiness inspection",
    {
      OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH:
        parentPath.relativePath,
    },
  );

  const { artifact: parent, sha256: parentSha256 } = readJsonArtifact(
    parentPath.resolved,
    "request-intake invite/Auth readiness batch",
  );
  assertParentBatch(parent);

  const approvedGymLabel = optionalText(
    "OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_GYM_LABEL",
    parent.approved_gym_label,
    160,
  );
  invariant(
    !isUnsafeCustomerLabel(approvedGymLabel),
    "Owner/staff handoff batch gym label must be a real non-House-of-Fitness gym.",
  );
  const ownerEmail = optionalText(
    "OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_OWNER_EMAIL",
    parent.request?.owner_email,
    180,
  );

  const batch = {
    artifact_kind: "admin_owner_staff_handoff_readiness_batch",
    status: "admin_owner_staff_handoff_readiness_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_request_intake_invite_auth_readiness_batch",
    request_intake_invite_auth_readiness_batch_path: parentPath.relativePath,
    request_intake_invite_auth_readiness_batch_sha256: parentSha256,
    protected_preview_url: parent.protected_preview_url,
    hosted_neon_branch: parent.hosted_neon_branch,
    approved_gym_label: approvedGymLabel,
    approved_gym_non_acme_fitness: true,
    request: {
      id: parent.request?.id,
      gym_name: parent.request?.gym_name,
      owner_email: ownerEmail,
      status: parent.request?.status,
    },
    owner_access_fulfillment_mode: "operator_managed_evidence_required",
    staff_handoff_mode: "reviewed_roster_no_invite_send",
    approved_gym_rehearsal_mode: "hosted_browser_rehearsal_pending",
    owner_access_fulfillment_evidence_required: true,
    owner_access_fulfillment_evidence_recorded: false,
    staff_invite_no_send_preflight_required: true,
    staff_invite_no_send_preflight_recorded: false,
    approved_gym_hosted_rehearsal_required: true,
    approved_gym_hosted_rehearsal_recorded: false,
    customer_observed_handoff_recorded: false,
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    owner_provisioning_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_admin_product_api_allowed: false,
    auth_user_created: false,
    owner_grant_automatic: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: BLOCKED_GATES,
    current_batch_set: [
      "Operator-managed owner access fulfillment evidence path prepared",
      "Staff handoff no-send preflight path prepared",
      "Approved-gym hosted browser rehearsal remains pending",
      "Public self-serve launch gate remains blocked",
      "Live-provider and revenue/member-system gates remain blocked",
    ],
    next_readiness_batches: NEXT_BATCHES,
    replay_commands: [
      "npm run admin:request-intake-invite-auth:inspect",
      "npm run admin:owner-staff-handoff:inspect",
    ],
  };

  assertNoSecretShapedKeys(batch, "owner/staff handoff readiness batch");
  mkdirSync(dirname(batchPath.resolved), { recursive: true });
  writeFileSync(batchPath.resolved, `${JSON.stringify(batch, null, 2)}\n`);

  console.log(
    `Admin owner/staff handoff readiness batch written: ${batchPath.relativePath}`,
  );
}

main();
