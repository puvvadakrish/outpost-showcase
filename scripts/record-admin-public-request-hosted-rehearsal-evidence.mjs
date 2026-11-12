#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_READINESS_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-hosted-rehearsal-readiness-batch.json";
const DEFAULT_EVIDENCE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-hosted-rehearsal-evidence.json";

const REQUIRED_OBSERVATIONS = [
  ["OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED", "owner_workspace_observed"],
  ["OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_STAFF_WORKBOARD_OBSERVED", "staff_workboard_observed"],
  ["OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_RESET_ROLLBACK_REVIEWED", "reset_rollback_reviewed"],
  ["OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_UNEXPECTED_DATA_NOT_OBSERVED", "unexpected_data_not_observed"],
  ["OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED", "live_provider_claims_not_observed"],
  ["OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_INVITE_DELIVERY_NOT_OBSERVED", "invite_delivery_not_observed"],
  ["OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED", "billing_pos_member_writes_not_observed"],
];

const BLOCKED_GATES = [
  "Customer-observed completion claim",
  "Hosted customer-session digest proof",
  "First-gym go/no-go bundle",
  "First-gym operator-assisted run",
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
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(value);
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

function runHostedReadinessInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-hosted-rehearsal-readiness-batch.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Public request hosted rehearsal readiness inspection failed.\n${result.stderr || result.stdout}`,
    );
  }
}

function validateReadiness(batch) {
  invariant(
    batch.artifact_kind === "admin_public_request_hosted_rehearsal_readiness_batch",
    "Public request hosted rehearsal readiness kind mismatch.",
  );
  invariant(
    batch.public_request_hosted_rehearsal_readiness_batch_ready === true,
    "Public request hosted rehearsal readiness must be ready.",
  );
  invariant(
    batch.hosted_rehearsal_readiness?.mode === "browser_rehearsal_required_not_recorded",
    "Hosted rehearsal readiness must require browser rehearsal.",
  );
  for (const key of [
    "owner_workspace_check_required",
    "staff_workboard_check_required",
    "reset_rollback_check_required",
    "no_unexpected_data_check_required",
    "no_live_provider_claim_required",
    "owner_access_evidence_required",
    "staff_no_send_preflight_required",
  ]) {
    invariant(batch.hosted_rehearsal_readiness?.[key] === true, `${key} required.`);
  }
  for (const key of [
    "owner_access_evidence_recorded",
    "staff_no_send_preflight_recorded",
    "customer_observed_handoff_recorded",
    "approved_gym_hosted_rehearsal_recorded",
    "first_gym_go_no_go_bundle_ready",
    "public_launch_decision_allowed",
  ]) {
    assertFalse(batch.hosted_rehearsal_readiness, key, `${key} blocked.`);
  }
}

function requiredYes(envName) {
  const value = String(process.env[envName] ?? "").trim().toLowerCase();
  invariant(value === "yes", `${envName}=yes is required.`);
  return true;
}

function optionalText(envName, fallback, maxLength) {
  const value = String(process.env[envName] ?? fallback).trim();
  invariant(value && value.length <= maxLength, `${envName} invalid.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function main() {
  const readinessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH ??
      DEFAULT_READINESS_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const evidencePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH ??
      DEFAULT_EVIDENCE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
  );

  runHostedReadinessInspect(readinessPath.relativePath);
  const { artifact: readiness, sha256: readinessSha256 } = readJsonArtifact(
    readinessPath.resolved,
    "public request hosted rehearsal readiness batch",
  );
  validateReadiness(readiness);

  const observed = Object.fromEntries(
    REQUIRED_OBSERVATIONS.map(([envName, key]) => [key, requiredYes(envName)]),
  );
  const operatorLabel = optionalText(
    "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OPERATOR",
    "operator-reviewed-public-request-hosted-rehearsal",
    140,
  );
  const rehearsalWindow = optionalText(
    "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_WINDOW",
    "not-recorded",
    160,
  );
  const notes = optionalText(
    "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_NOTES",
    "current-chain hosted rehearsal evidence only",
    500,
  );

  const evidence = {
    artifact_kind: "admin_public_request_hosted_rehearsal_evidence",
    status: "admin_public_request_hosted_rehearsal_evidence_recorded",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_hosted_rehearsal_readiness_batch",
    public_request_hosted_rehearsal_readiness_batch_path:
      readinessPath.relativePath,
    public_request_hosted_rehearsal_readiness_batch_sha256: readinessSha256,
    candidate_gym_label: readiness.candidate_gym_label,
    operator_label: operatorLabel,
    rehearsal_window: rehearsalWindow,
    notes,
    public_request_hosted_rehearsal_evidence_recorded: true,
    customer_observed_handoff_recorded: false,
    customer_observed_handoff_claimed: false,
    customer_observed_session_recorded: false,
    customer_session_hosted_import_recorded: false,
    first_gym_go_no_go_bundle_ready: false,
    first_gym_operator_run_recorded: false,
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
    observed,
    blocked_gates: BLOCKED_GATES,
    next_readiness_batches: [
      {
        command: "npm run admin:customer-session:record",
        detail:
          "Only record after the real gym owner observes the protected Preview and all required confirmations are true.",
        id: "customer_observed_handoff_gate",
        state: "blocked",
        title: "Customer-observed session",
      },
      {
        command:
          "npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
        detail:
          "Import and prove the customer-session digest only after the real customer record exists.",
        id: "hosted_customer_session_proof",
        state: "blocked",
        title: "Hosted customer-session proof",
      },
      {
        command: "npm run admin:first-gym:go-no-go",
        detail:
          "Bundle hosted rehearsal evidence with real customer-observed session proof before the first gym run.",
        id: "first_gym_go_no_go_bundle",
        state: "blocked",
        title: "First-gym go/no-go bundle",
      },
      {
        command: "npm run admin:first-gym:run",
        detail:
          "Record the first operator-assisted gym run only after the go/no-go bundle is green.",
        id: "first_gym_operator_assisted_run",
        state: "blocked",
        title: "First-gym operator run",
      },
    ],
  };

  assertNoSecretShapedKeys(evidence, "public request hosted rehearsal evidence");
  mkdirSync(dirname(evidencePath.resolved), { recursive: true });
  writeFileSync(evidencePath.resolved, `${JSON.stringify(evidence, null, 2)}\n`, {
    flag: "wx",
  });
  console.log(
    `Admin public request hosted rehearsal evidence recorded: ${evidencePath.relativePath}`,
  );
}

main();
