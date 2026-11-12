#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_APPROVED_EXPANSION_PATH =
  "artifacts/admin-launch-readiness/admin-approved-beta-expansion-readiness-batch.json";
const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-request-intake-invite-auth-readiness-batch.json";

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
      "npm run admin:owner-access-fulfillment:evidence && npm run admin:staff-invite:no-send",
    detail:
      "Link operator-managed owner access to reviewed request metadata, then prepare staff handoff without sending invites.",
    id: "owner_access_fulfillment_evidence",
    state: "blocked",
    title: "Owner and staff handoff evidence",
  },
  {
    command:
      "npm run hosted:beta-request-chain-proof && npm run hosted:beta-request-browser-proof",
    detail:
      "Rerun hosted request chain and browser proof for the approved non-House-of-Fitness gym before customer-facing walkthrough.",
    id: "operator_assisted_onboarding_rehearsal",
    state: "pending",
    title: "Approved-gym hosted rehearsal",
  },
  {
    command:
      "Package public self-serve launch criteria only after operator-assisted beta proof is green.",
    detail:
      "Public owner self-signup, browser approvals, automatic grants, and invite delivery remain blocked until a separate launch gate.",
    id: "public_self_serve_preflight",
    state: "blocked",
    title: "Public self-serve launch gate",
  },
  {
    command:
      "Keep phone/email providers, notifications, billing, POS, access control, member-ledger writes blocked until separately proven.",
    detail:
      "Live-provider and revenue/member-system work stays outside this request-intake/invite/Auth dry-run batch.",
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

function assertApprovedExpansion(batch) {
  invariant(
    batch.artifact_kind === "admin_approved_beta_expansion_readiness_batch",
    "Approved beta expansion batch kind mismatch.",
  );
  invariant(
    batch.status === "admin_approved_beta_expansion_readiness_batch_prepared",
    "Approved beta expansion batch status mismatch.",
  );
  invariant(
    batch.evidence_basis === "admin_post_customer_proof_and_owner_beta_followthrough",
    "Approved beta expansion evidence basis mismatch.",
  );
  invariant(
    batch.approved_gym_non_acme_fitness === true,
    "Approved gym must be explicitly non-House-of-Fitness.",
  );
  invariant(
    !isUnsafeCustomerLabel(batch.approved_gym_label) &&
      !isUnsafeCustomerLabel(batch.request?.gym_name),
    "Approved gym label must be a real non-House-of-Fitness gym.",
  );
  invariant(
    batch.owner_access_mode === "operator_managed",
    "Owner access must remain operator-managed.",
  );
  invariant(
    batch.approved_gym_operator_fulfillment_ready === true,
    "Approved gym operator fulfillment readiness missing.",
  );
  invariant(
    batch.public_request_intake_dry_run_ready === true,
    "Public request intake dry-run readiness missing.",
  );
  assertFalse(
    batch,
    "invite_auth_dry_run_ready",
    "Invite/Auth dry-run must not be marked complete by approved expansion.",
  );
  assertFalse(batch, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(batch, "browser_approval_buttons_allowed", "Browser approvals blocked.");
  assertFalse(batch, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(batch, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(batch, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(batch, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(
    batch,
    "automatic_owner_staff_grants_allowed",
    "Automatic owner/staff grants blocked.",
  );
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
  const approvedExpansionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH ??
      DEFAULT_APPROVED_EXPANSION_PATH,
    "OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH",
  );
  invariant(
    !existsSync(batchPath.resolved),
    "OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH already exists.",
  );

  runInspector(
    "scripts/inspect-admin-approved-beta-expansion-readiness-batch.mjs",
    "Approved beta expansion readiness inspection",
    {
      OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH:
        approvedExpansionPath.relativePath,
    },
  );

  const { artifact: approvedExpansion, sha256: approvedExpansionSha256 } =
    readJsonArtifact(
      approvedExpansionPath.resolved,
      "approved beta expansion readiness batch",
    );
  assertApprovedExpansion(approvedExpansion);

  const approvedGymLabel = optionalText(
    "OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_GYM_LABEL",
    approvedExpansion.approved_gym_label,
    160,
  );
  invariant(
    !isUnsafeCustomerLabel(approvedGymLabel),
    "Request-intake invite/Auth batch gym label must be a real non-House-of-Fitness gym.",
  );

  const ownerEmail = optionalText(
    "OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_OWNER_EMAIL",
    approvedExpansion.request?.owner_email,
    180,
  );

  const batch = {
    artifact_kind: "admin_request_intake_invite_auth_readiness_batch",
    status: "admin_request_intake_invite_auth_readiness_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_approved_beta_expansion_readiness_batch",
    approved_beta_expansion_readiness_batch_path:
      approvedExpansionPath.relativePath,
    approved_beta_expansion_readiness_batch_sha256: approvedExpansionSha256,
    protected_preview_url: approvedExpansion.protected_preview_url,
    hosted_neon_branch: approvedExpansion.hosted_neon_branch,
    approved_gym_label: approvedGymLabel,
    approved_gym_non_acme_fitness: true,
    request: {
      id: approvedExpansion.request?.id,
      gym_name: approvedExpansion.request?.gym_name,
      owner_email: ownerEmail,
      status: approvedExpansion.request?.status,
    },
    operator_fulfillment_mode: "operator_managed_owner_access_only",
    public_request_intake_mode: "request_only_review_only_no_persistence",
    invite_preflight_mode: "review_only_no_send",
    auth_admin_dry_run_mode: "operator_review_only_no_user_created",
    approved_gym_operator_fulfillment_ready: true,
    public_request_intake_dry_run_ready: true,
    invite_delivery_preflight_ready: true,
    auth_admin_provisioning_dry_run_ready: true,
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
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: BLOCKED_GATES,
    current_batch_set: [
      "Operator-managed approved gym owner access readiness",
      "Public request intake as request-only review-only dry-run",
      "Invite delivery as no-send preflight",
      "Auth admin provisioning as no-create dry-run",
      "Live-provider and revenue/member-system gates remain blocked",
    ],
    next_readiness_batches: NEXT_BATCHES,
    replay_commands: [
      "npm run admin:approved-beta-expansion:inspect",
      "npm run admin:request-intake-invite-auth:inspect",
    ],
  };

  assertNoSecretShapedKeys(batch, "request intake invite/Auth readiness batch");
  mkdirSync(dirname(batchPath.resolved), { recursive: true });
  writeFileSync(batchPath.resolved, `${JSON.stringify(batch, null, 2)}\n`);

  console.log(
    `Admin request-intake invite/Auth readiness batch written: ${batchPath.relativePath}`,
  );
}

main();
