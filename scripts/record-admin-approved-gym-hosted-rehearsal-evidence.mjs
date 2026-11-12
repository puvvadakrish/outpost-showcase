#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_READINESS_PATH =
  "artifacts/admin-launch-readiness/admin-approved-gym-hosted-rehearsal-readiness-batch.json";
const DEFAULT_EVIDENCE_PATH =
  "artifacts/admin-launch-readiness/admin-approved-gym-hosted-rehearsal-evidence.json";

const REQUIRED_OBSERVATIONS = [
  ["OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_OWNER_WORKSPACE_OBSERVED", "owner_workspace_observed"],
  ["OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_STAFF_WORKBOARD_OBSERVED", "staff_workboard_observed"],
  ["OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_RESET_ROLLBACK_REVIEWED", "reset_rollback_reviewed"],
  ["OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_UNEXPECTED_DATA_NOT_OBSERVED", "unexpected_data_not_observed"],
  ["OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED", "live_provider_claims_not_observed"],
  ["OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_INVITE_DELIVERY_NOT_OBSERVED", "invite_delivery_not_observed"],
  ["OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED", "billing_pos_member_writes_not_observed"],
];

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

function assertReadinessBatch(batch) {
  invariant(
    batch.artifact_kind === "admin_approved_gym_hosted_rehearsal_readiness_batch",
    "Approved-gym hosted rehearsal readiness kind mismatch.",
  );
  invariant(
    batch.status === "admin_approved_gym_hosted_rehearsal_readiness_batch_prepared",
    "Approved-gym hosted rehearsal readiness status mismatch.",
  );
  invariant(
    batch.hosted_rehearsal_mode === "approved_gym_browser_rehearsal_required",
    "Hosted rehearsal must remain required.",
  );
  invariant(batch.approved_gym_non_acme_fitness === true, "Approved gym must be non-House-of-Fitness.");
  invariant(batch.owner_workspace_rehearsal_required === true, "Owner workspace check required.");
  invariant(batch.staff_workboard_rehearsal_required === true, "Staff workboard check required.");
  invariant(batch.reset_rollback_checklist_required === true, "Reset/rollback check required.");
  invariant(batch.no_unexpected_data_claim_required === true, "No unexpected data check required.");
  invariant(batch.no_live_provider_claim_required === true, "No live-provider claim check required.");
  assertFalse(batch, "customer_observed_handoff_recorded", "Customer-observed handoff must remain blocked.");
  assertFalse(batch, "first_gym_go_no_go_bundle_ready", "First-gym go/no-go must remain blocked.");
  assertFalse(batch, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(batch, "browser_approval_buttons_allowed", "Browser approval buttons must remain blocked.");
  assertFalse(batch, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(batch, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(batch, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(batch, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
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
    process.env.OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH ??
      DEFAULT_READINESS_PATH,
    "OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const evidencePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH ??
      DEFAULT_EVIDENCE_PATH,
    "OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH",
  );
  const { artifact: readiness, sha256: readinessSha256 } = readJsonArtifact(
    readinessPath.resolved,
    "approved-gym hosted rehearsal readiness batch",
  );
  assertReadinessBatch(readiness);

  const observed = Object.fromEntries(
    REQUIRED_OBSERVATIONS.map(([envName, key]) => [key, requiredYes(envName)]),
  );
  const operatorLabel = optionalText(
    "OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_OPERATOR",
    "operator-reviewed-approved-gym-rehearsal",
    140,
  );
  const rehearsalWindow = optionalText(
    "OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_WINDOW",
    "not-recorded",
    160,
  );
  const notes = optionalText(
    "OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_NOTES",
    "internal approved-gym hosted rehearsal evidence only",
    500,
  );

  const evidence = {
    artifact_kind: "admin_approved_gym_hosted_rehearsal_evidence",
    status: "admin_approved_gym_hosted_rehearsal_recorded",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_approved_gym_hosted_rehearsal_readiness_batch",
    approved_gym_hosted_rehearsal_readiness_batch_path: readinessPath.relativePath,
    approved_gym_hosted_rehearsal_readiness_batch_sha256: readinessSha256,
    protected_preview_url: readiness.protected_preview_url,
    hosted_neon_branch: readiness.hosted_neon_branch,
    approved_gym_label: readiness.approved_gym_label,
    approved_gym_non_acme_fitness: true,
    operator_label: operatorLabel,
    rehearsal_window: rehearsalWindow,
    notes,
    approved_gym_hosted_rehearsal_recorded: true,
    customer_observed_handoff_recorded: false,
    customer_observed_handoff_claimed: false,
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
    observed,
    ready_gates: [
      "Approved-gym owner workspace observed on protected Preview",
      "Approved-gym staff workboard observed on protected Preview",
      "Reset/rollback checklist reviewed",
      "No unexpected tenant data observed",
      "No live-provider claims observed",
    ],
    blocked_gates: BLOCKED_GATES,
    next_readiness_batches: [
      {
        command: "npm run admin:customer-session:record",
        detail:
          "Only record after the real gym owner observes the protected Preview and all required confirmations are true.",
        id: "customer_observed_handoff_gate",
        state: "pending",
        title: "Customer-observed approved-gym walkthrough",
      },
      {
        command: "npm run admin:first-gym:go-no-go",
        detail:
          "Bundle hosted rehearsal evidence with real customer-observed session proof before any broader launch gate.",
        id: "first_gym_go_no_go_bundle",
        state: "blocked",
        title: "First-gym go/no-go bundle",
      },
      {
        command:
          "Keep public signup, invites, providers, billing, POS, access control, member-ledger writes blocked until separately proven.",
        detail:
          "Public self-serve and live-provider/revenue work remains outside this first-gym operator-assisted run.",
        id: "live_provider_revenue_gates",
        state: "blocked",
        title: "Public/live-provider gates",
      },
    ],
    replay_commands: [
      "npm run admin:approved-gym-hosted-rehearsal:inspect",
      "npm run admin:approved-gym-hosted-rehearsal:evidence:inspect",
    ],
  };

  assertNoSecretShapedKeys(evidence, "approved-gym hosted rehearsal evidence");
  mkdirSync(dirname(evidencePath.resolved), { recursive: true });
  writeFileSync(evidencePath.resolved, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log("Admin approved-gym hosted rehearsal evidence recorded");
  console.log(`Artifact: ${evidencePath.relativePath}`);
  console.log("Customer-observed handoff: not recorded");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
