#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PARENT_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-go-no-go-readiness-batch.json";
const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-evidence-acquisition-batch.json";

const BLOCKED_GATES = [
  "Hosted rehearsal evidence recording until operator browser proof exists",
  "Customer-observed completion claim until the real owner attends",
  "First-gym go/no-go bundle until hosted rehearsal and customer records exist",
  "First-gym operator-assisted run until go/no-go bundle is green",
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

function runGoNoGoReadinessInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-first-gym-go-no-go-readiness-batch.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH:
          path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Public request first-gym go/no-go readiness inspection failed.\n${result.stderr || result.stdout}`,
    );
  }
}

function validateGoNoGoReadiness(batch) {
  invariant(
    batch.artifact_kind ===
      "admin_public_request_first_gym_go_no_go_readiness_batch",
    "Public request first-gym go/no-go readiness batch kind mismatch.",
  );
  invariant(
    batch.public_request_first_gym_go_no_go_readiness_batch_ready === true,
    "Public request first-gym go/no-go readiness must be ready.",
  );
  invariant(
    batch.first_gym_go_no_go_readiness?.mode ===
      "requires_hosted_rehearsal_evidence_and_customer_observed_session",
    "First-gym go/no-go readiness must require real evidence.",
  );
  for (const key of [
    "hosted_rehearsal_evidence_required",
    "customer_observed_session_required",
    "owner_workspace_check_required",
    "staff_workboard_check_required",
    "reset_rollback_check_required",
    "no_unexpected_data_check_required",
    "no_live_provider_claim_required",
  ]) {
    invariant(batch.first_gym_go_no_go_readiness?.[key] === true, `${key} required.`);
  }
  for (const key of [
    "approved_gym_hosted_rehearsal_recorded",
    "customer_observed_handoff_recorded",
    "customer_observed_session_recorded",
    "first_gym_go_no_go_bundle_ready",
    "ready_for_first_gym_operator_assisted_run",
    "public_launch_decision_allowed",
  ]) {
    assertFalse(batch.first_gym_go_no_go_readiness, key, `${key} blocked.`);
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
    assertFalse(batch, key, `${key} must remain blocked.`);
  }
}

function main() {
  const parentPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH ??
      DEFAULT_PARENT_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH",
  );

  runGoNoGoReadinessInspect(parentPath.relativePath);
  const { artifact: parent, sha256: parentSha256 } = readJsonArtifact(
    parentPath.resolved,
    "public request first-gym go/no-go readiness batch",
  );
  validateGoNoGoReadiness(parent);

  const batch = {
    artifact_kind: "admin_public_request_first_gym_evidence_acquisition_batch",
    status: "admin_public_request_first_gym_evidence_acquisition_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_first_gym_go_no_go_readiness_batch",
    public_request_first_gym_go_no_go_readiness_batch_path:
      parentPath.relativePath,
    public_request_first_gym_go_no_go_readiness_batch_sha256: parentSha256,
    candidate_gym_label: parent.candidate_gym_label,
    public_request_first_gym_evidence_acquisition_batch_ready: true,
    evidence_acquisition: {
      mode: "current_chain_command_packet_only",
      hosted_rehearsal_evidence_command_required: true,
      customer_observed_session_command_required: true,
      customer_session_hosted_import_required: true,
      first_gym_go_no_go_bundle_command_required: true,
      first_gym_operator_run_command_required_after_bundle: true,
      approved_gym_hosted_rehearsal_recorded: false,
      customer_observed_session_recorded: false,
      customer_session_hosted_import_recorded: false,
      first_gym_go_no_go_bundle_ready: false,
      first_gym_operator_run_recorded: false,
      ready_for_public_self_serve_launch: false,
      public_launch_decision_allowed: false,
    },
    command_sequence: [
      {
        command: "npm run admin:public-request-hosted-rehearsal:evidence",
        detail:
          "Record non-secret hosted rehearsal evidence only after operator/browser checks pass.",
        id: "approved_gym_hosted_rehearsal_evidence",
        state: "blocked",
        title: "Record hosted rehearsal evidence",
      },
      {
        command: "npm run admin:customer-session:record",
        detail:
          "Record customer-observed session only after the real owner sees the protected Preview.",
        id: "customer_observed_handoff_gate",
        state: "blocked",
        title: "Record customer-observed session",
      },
      {
        command:
          "npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
        detail:
          "Import and prove the sanitized customer-session digest in hosted Neon after the real record exists.",
        id: "hosted_customer_session_proof",
        state: "blocked",
        title: "Prove hosted customer-session digest",
      },
      {
        command: "npm run admin:first-gym:go-no-go",
        detail:
          "Bundle hosted rehearsal evidence and customer-observed session proof before the first gym run.",
        id: "first_gym_go_no_go_bundle",
        state: "blocked",
        title: "Prepare first-gym go/no-go bundle",
      },
      {
        command: "npm run admin:first-gym:run",
        detail:
          "Record the first operator-assisted gym run only after the go/no-go bundle is green.",
        id: "first_gym_operator_assisted_run",
        state: "blocked",
        title: "Record first-gym operator run",
      },
    ],
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
      "Current-chain evidence acquisition packet prepared",
      "Hosted rehearsal evidence remains unrecorded",
      "Customer-observed session remains unrecorded",
      "Hosted customer-session import remains unrecorded",
      "First-gym go/no-go bundle remains blocked",
      "First-gym operator-assisted run remains blocked",
      "Public launch and live-provider gates remain blocked",
    ],
    next_readiness_batches: [
      {
        command:
          "Run the real hosted rehearsal evidence command after operator/browser proof.",
        detail:
          "This packet only prepares the command path; it does not record evidence.",
        id: "approved_gym_hosted_rehearsal_evidence",
        state: "blocked",
        title: "Hosted rehearsal evidence",
      },
      {
        command:
          "Run the real customer-observed session record and hosted digest proof when the owner attends.",
        detail:
          "Customer-observed completion stays outside this packet.",
        id: "customer_observed_handoff_gate",
        state: "blocked",
        title: "Customer-observed session proof",
      },
      {
        command:
          "Prepare the first-gym go/no-go bundle and first operator-assisted run record only after both evidence records exist.",
        detail:
          "This remains operator-assisted beta, not public self-serve launch.",
        id: "first_gym_go_no_go_bundle",
        state: "blocked",
        title: "First-gym run evidence",
      },
      {
        command:
          "Keep public self-serve, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked.",
        detail:
          "Live-provider and revenue/member-system work remains separate proof.",
        id: "live_provider_revenue_gates",
        state: "blocked",
        title: "Public/live-provider gates",
      },
    ],
  };

  assertNoSecretShapedKeys(batch, "public request first-gym evidence acquisition batch");
  mkdirSync(dirname(batchPath.resolved), { recursive: true });
  writeFileSync(batchPath.resolved, `${JSON.stringify(batch, null, 2)}\n`, {
    flag: "wx",
  });
  console.log(
    `Admin public request first-gym evidence acquisition batch prepared: ${batchPath.relativePath}`,
  );
}

main();
