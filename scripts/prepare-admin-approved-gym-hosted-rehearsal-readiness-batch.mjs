#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PARENT_PATH =
  "artifacts/admin-launch-readiness/admin-owner-staff-handoff-readiness-batch.json";
const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-approved-gym-hosted-rehearsal-readiness-batch.json";

const BLOCKED_GATES = [
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

const NEXT_BATCHES = [
  {
    command:
      "Run approved-gym protected Preview browser rehearsal, then record only non-secret hosted evidence.",
    detail:
      "Hosted rehearsal proof should verify owner workspace, staff path, reset checklist, and blocked live-provider claims.",
    id: "operator_assisted_onboarding_rehearsal",
    state: "pending",
    title: "Record approved-gym hosted rehearsal",
  },
  {
    command:
      "Schedule customer-observed approved-gym walkthrough after hosted rehearsal proof is recorded.",
    detail:
      "The real gym must see the protected Preview before customer-observed completion can be recorded.",
    id: "customer_observed_handoff_gate",
    state: "blocked",
    title: "Approved-gym customer walkthrough",
  },
  {
    command:
      "Prepare first-gym go/no-go evidence bundle after customer-observed walkthrough passes.",
    detail:
      "Bundle the run evidence and support checklist before any broader launch gate.",
    id: "first_gym_go_no_go_bundle",
    state: "blocked",
    title: "First-gym go/no-go bundle",
  },
  {
    command:
      "Keep public signup, invites, providers, billing, POS, access control, member-ledger writes blocked until separately proven.",
    detail:
      "Public self-serve and live-provider/revenue work remains outside the first-gym operator-assisted run.",
    id: "live_provider_revenue_gates",
    state: "blocked",
    title: "Public/live-provider gates",
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
    batch.artifact_kind === "admin_owner_staff_handoff_readiness_batch",
    "Owner/staff handoff parent kind mismatch.",
  );
  invariant(
    batch.status === "admin_owner_staff_handoff_readiness_batch_prepared",
    "Owner/staff handoff parent status mismatch.",
  );
  invariant(
    batch.evidence_basis === "admin_request_intake_invite_auth_readiness_batch",
    "Owner/staff handoff parent evidence basis mismatch.",
  );
  invariant(
    batch.approved_gym_non_acme_fitness === true,
    "Approved gym must be non-House-of-Fitness.",
  );
  invariant(
    !isUnsafeCustomerLabel(batch.approved_gym_label) &&
      !isUnsafeCustomerLabel(batch.request?.gym_name),
    "Hosted rehearsal batch must target a real non-House-of-Fitness gym.",
  );
  invariant(
    batch.owner_access_fulfillment_evidence_required === true,
    "Owner access evidence must be required by parent.",
  );
  assertFalse(
    batch,
    "owner_access_fulfillment_evidence_recorded",
    "Parent must not record owner access evidence.",
  );
  invariant(
    batch.staff_invite_no_send_preflight_required === true,
    "Staff no-send preflight must be required by parent.",
  );
  assertFalse(
    batch,
    "staff_invite_no_send_preflight_recorded",
    "Parent must not record staff no-send preflight.",
  );
  invariant(
    batch.approved_gym_hosted_rehearsal_required === true,
    "Hosted rehearsal must be required by parent.",
  );
  assertFalse(
    batch,
    "approved_gym_hosted_rehearsal_recorded",
    "Parent must not record hosted rehearsal.",
  );
  assertFalse(batch, "customer_observed_handoff_recorded", "Customer proof blocked.");
  assertFalse(batch, "public_self_serve_launch_allowed", "Public self-serve blocked.");
  assertFalse(batch, "browser_approval_buttons_allowed", "Browser approvals blocked.");
  assertFalse(batch, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(batch, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(batch, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(batch, "auth_user_created", "Auth user creation blocked.");
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
    process.env.OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH ??
      DEFAULT_PARENT_PATH,
    "OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH",
  );
  invariant(
    !existsSync(batchPath.resolved),
    "OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH already exists.",
  );

  runInspector(
    "scripts/inspect-admin-owner-staff-handoff-readiness-batch.mjs",
    "Owner/staff handoff readiness inspection",
    {
      OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
        parentPath.relativePath,
    },
  );

  const { artifact: parent, sha256: parentSha256 } = readJsonArtifact(
    parentPath.resolved,
    "owner/staff handoff readiness batch",
  );
  assertParentBatch(parent);

  const approvedGymLabel = optionalText(
    "OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_LABEL",
    parent.approved_gym_label,
    160,
  );
  invariant(
    !isUnsafeCustomerLabel(approvedGymLabel),
    "Hosted rehearsal batch gym label must be a real non-House-of-Fitness gym.",
  );

  const batch = {
    artifact_kind: "admin_approved_gym_hosted_rehearsal_readiness_batch",
    status: "admin_approved_gym_hosted_rehearsal_readiness_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_owner_staff_handoff_readiness_batch",
    owner_staff_handoff_readiness_batch_path: parentPath.relativePath,
    owner_staff_handoff_readiness_batch_sha256: parentSha256,
    protected_preview_url: parent.protected_preview_url,
    hosted_neon_branch: parent.hosted_neon_branch,
    approved_gym_label: approvedGymLabel,
    approved_gym_non_acme_fitness: true,
    request: parent.request,
    hosted_rehearsal_mode: "approved_gym_browser_rehearsal_required",
    owner_workspace_rehearsal_required: true,
    staff_workboard_rehearsal_required: true,
    reset_rollback_checklist_required: true,
    no_unexpected_data_claim_required: true,
    no_live_provider_claim_required: true,
    owner_access_fulfillment_evidence_recorded: false,
    staff_invite_no_send_preflight_recorded: false,
    approved_gym_hosted_rehearsal_recorded: false,
    customer_observed_handoff_recorded: false,
    first_gym_go_no_go_bundle_ready: false,
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
      "Approved-gym hosted browser rehearsal command path prepared",
      "Owner workspace rehearsal remains required",
      "Staff workboard rehearsal remains required",
      "Reset rollback checklist remains required",
      "Customer-observed walkthrough remains blocked",
      "Public self-serve and live-provider gates remain blocked",
    ],
    next_readiness_batches: NEXT_BATCHES,
    replay_commands: [
      "npm run admin:owner-staff-handoff:inspect",
      "npm run admin:approved-gym-hosted-rehearsal:inspect",
    ],
  };

  assertNoSecretShapedKeys(batch, "approved-gym hosted rehearsal readiness batch");
  mkdirSync(dirname(batchPath.resolved), { recursive: true });
  writeFileSync(batchPath.resolved, `${JSON.stringify(batch, null, 2)}\n`);

  console.log(
    `Admin approved-gym hosted rehearsal readiness batch written: ${batchPath.relativePath}`,
  );
}

main();
