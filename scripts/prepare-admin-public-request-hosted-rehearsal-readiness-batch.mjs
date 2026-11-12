#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PARENT_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-owner-staff-handoff-readiness-batch.json";
const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-hosted-rehearsal-readiness-batch.json";

const BLOCKED_GATES = [
  "Customer-observed completion claim",
  "Public owner self-signup",
  "Public request form submission",
  "Browser approval buttons",
  "Automatic approval",
  "Owner provisioning",
  "Invite delivery",
  "Notification sending",
  "Product Auth admin API",
  "Auth user creation",
  "Magic link creation",
  "Automatic owner/staff grants",
  "Phone/email provider activation",
  "Provider ingress/egress",
  "Billing, POS, access control, member-ledger writes",
  "Public launch decision",
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
  } else {
    invariant(!existsSync(resolved), `${label} already exists: ${relativePath}`);
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

function runOwnerStaffInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-owner-staff-handoff-readiness-batch.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH:
          path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Public request owner/staff handoff readiness inspection failed.\n${result.stderr || result.stdout}`,
    );
  }
}

function validateOwnerStaff(batch) {
  invariant(
    batch.artifact_kind ===
      "admin_public_request_owner_staff_handoff_readiness_batch",
    "Public request owner/staff handoff batch kind mismatch.",
  );
  invariant(
    batch.public_request_owner_staff_handoff_readiness_batch_ready === true,
    "Public request owner/staff handoff readiness must be ready.",
  );
  invariant(
    batch.owner_access_fulfillment?.mode ===
      "operator_managed_evidence_required",
    "Owner access must remain operator-managed evidence.",
  );
  assertFalse(
    batch.owner_access_fulfillment,
    "owner_access_evidence_recorded",
    "Owner access evidence must not be recorded.",
  );
  for (const key of [
    "owner_provisioning_allowed",
    "product_auth_admin_api_allowed",
    "auth_user_created",
    "magic_link_created",
    "automatic_owner_staff_grants_allowed",
  ]) {
    assertFalse(batch.owner_access_fulfillment, key, `${key} blocked.`);
  }

  invariant(
    batch.staff_handoff?.mode === "reviewed_roster_no_invite_send",
    "Staff handoff must remain no-send.",
  );
  for (const key of [
    "staff_invite_delivery_allowed",
    "outbound_email_allowed",
    "notification_sending_allowed",
    "auth_user_created",
    "automatic_owner_staff_grants_allowed",
  ]) {
    assertFalse(batch.staff_handoff, key, `${key} blocked.`);
  }

  invariant(
    batch.hosted_rehearsal_prerequisites?.mode ===
      "approved_gym_hosted_rehearsal_pending",
    "Hosted rehearsal prerequisites must remain pending.",
  );
  for (const key of [
    "customer_observed_handoff_recorded",
    "approved_gym_hosted_rehearsal_recorded",
    "first_gym_go_no_go_bundle_ready",
  ]) {
    assertFalse(batch.hosted_rehearsal_prerequisites, key, `${key} blocked.`);
  }

  for (const key of [
    "public_self_serve_launch_allowed",
    "public_request_form_allowed",
    "public_request_form_submission_allowed",
    "public_submission_accepted",
    "browser_approval_buttons_allowed",
    "automatic_approval_allowed",
    "owner_provisioning_allowed",
    "product_auth_admin_api_allowed",
    "auth_user_created",
    "magic_link_created",
    "automatic_owner_staff_grants_allowed",
    "invite_delivery_allowed",
    "staff_invite_delivery_allowed",
    "outbound_email_allowed",
    "notification_sending_allowed",
    "gmail_resend_smtp_provider_allowed",
    "phone_email_provider_activation_allowed",
    "live_provider_enablement_allowed",
    "billing_pos_member_writes_allowed",
    "access_control_writes_allowed",
    "member_ledger_writes_allowed",
    "provider_ingress_allowed",
    "provider_egress_allowed",
    "public_launch_decision_allowed",
  ]) {
    assertFalse(batch, `${key}`, `${key} must remain blocked.`);
  }
}

function main() {
  const parentPath = normalizeArtifactPath(
    process.env
      .OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH ??
      DEFAULT_PARENT_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH",
  );

  runOwnerStaffInspect(parentPath.relativePath);
  const { artifact: parent, sha256: parentSha256 } = readJsonArtifact(
    parentPath.resolved,
    "public request owner/staff handoff readiness batch",
  );
  validateOwnerStaff(parent);

  const batch = {
    artifact_kind: "admin_public_request_hosted_rehearsal_readiness_batch",
    status: "admin_public_request_hosted_rehearsal_readiness_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_owner_staff_handoff_readiness_batch",
    public_request_owner_staff_handoff_readiness_batch_path:
      parentPath.relativePath,
    public_request_owner_staff_handoff_readiness_batch_sha256: parentSha256,
    candidate_gym_label: parent.candidate_gym_label,
    public_request_hosted_rehearsal_readiness_batch_ready: true,
    hosted_rehearsal_readiness: {
      mode: "browser_rehearsal_required_not_recorded",
      owner_workspace_check_required: true,
      staff_workboard_check_required: true,
      reset_rollback_check_required: true,
      no_unexpected_data_check_required: true,
      no_live_provider_claim_required: true,
      owner_access_evidence_required: true,
      owner_access_evidence_recorded: false,
      staff_no_send_preflight_required: true,
      staff_no_send_preflight_recorded: false,
      customer_observed_handoff_recorded: false,
      approved_gym_hosted_rehearsal_recorded: false,
      first_gym_go_no_go_bundle_ready: false,
      public_launch_decision_allowed: false,
    },
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    public_request_form_submission_allowed: false,
    public_submission_accepted: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    owner_provisioning_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_user_created: false,
    magic_link_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    phone_email_provider_activation_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    access_control_writes_allowed: false,
    member_ledger_writes_allowed: false,
    provider_ingress_allowed: false,
    provider_egress_allowed: false,
    public_launch_decision_allowed: false,
    blocked_gates: BLOCKED_GATES,
    current_batch_set: [
      "Current-chain hosted rehearsal readiness prepared",
      "Owner workspace browser check remains required",
      "Staff workboard browser check remains required",
      "Reset rollback checklist remains required",
      "Customer-observed walkthrough remains blocked",
      "Public launch and live-provider gates remain blocked",
    ],
    next_readiness_batches: [
      {
        command:
          "Record first-gym go/no-go only after hosted rehearsal and real customer-observed evidence.",
        detail:
          "Bundle owner workspace, staff handoff, reset/rollback, no unexpected data, and no-live-provider proof before any gym onboarding decision.",
        id: "first_gym_go_no_go_bundle",
        state: "blocked",
        title: "First-gym go/no-go bundle",
      },
      {
        command:
          "Keep public self-serve launch preflight blocked until limited beta review is green.",
        detail:
          "Public signup, browser approvals, Auth creation, automatic grants, and invite delivery remain blocked.",
        id: "public_self_serve_preflight",
        state: "blocked",
        title: "Public self-serve launch gate",
      },
      {
        command:
          "Keep phone/email providers, revenue systems, POS, access control, and member-ledger writes blocked.",
        detail:
          "Live provider and revenue-member-system work remains outside this readiness batch.",
        id: "live_provider_revenue_gates",
        state: "blocked",
        title: "Live-provider and revenue gates",
      },
    ],
    replay_commands: [
      "npm run admin:public-request-owner-staff:inspect",
      "npm run admin:public-request-hosted-rehearsal:inspect",
    ],
  };

  assertNoSecretShapedKeys(batch, "public request hosted rehearsal readiness batch");
  mkdirSync(dirname(batchPath.resolved), { recursive: true });
  writeFileSync(batchPath.resolved, `${JSON.stringify(batch, null, 2)}\n`, {
    flag: "wx",
  });
  console.log(
    `Admin public request hosted rehearsal readiness batch prepared: ${batchPath.relativePath}`,
  );
}

main();
