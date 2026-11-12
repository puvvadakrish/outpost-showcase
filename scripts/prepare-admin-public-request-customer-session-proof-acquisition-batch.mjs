#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_EVIDENCE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-hosted-rehearsal-evidence.json";
const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-customer-session-proof-acquisition-batch.json";

const BLOCKED_GATES = [
  "Customer-observed completion claim until the real owner attends",
  "Hosted customer-session digest import until customer session record exists",
  "First-gym go/no-go bundle until hosted rehearsal and customer-session proof exist",
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

function runHostedEvidenceInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-hosted-rehearsal-evidence.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH: path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Public request hosted rehearsal evidence inspection failed.\n${result.stderr || result.stdout}`,
    );
  }
}

function validateHostedEvidence(evidence) {
  invariant(
    evidence.artifact_kind === "admin_public_request_hosted_rehearsal_evidence",
    "Public request hosted rehearsal evidence kind mismatch.",
  );
  invariant(
    evidence.status === "admin_public_request_hosted_rehearsal_evidence_recorded",
    "Public request hosted rehearsal evidence status mismatch.",
  );
  invariant(
    evidence.public_request_hosted_rehearsal_evidence_recorded === true,
    "Public request hosted rehearsal evidence must be recorded.",
  );
  for (const key of [
    "customer_observed_handoff_recorded",
    "customer_observed_handoff_claimed",
    "customer_observed_session_recorded",
    "customer_session_hosted_import_recorded",
    "first_gym_go_no_go_bundle_ready",
    "first_gym_operator_run_recorded",
    "public_launch_decision_allowed",
  ]) {
    assertFalse(evidence, key, `${key} blocked.`);
  }
  for (const key of [
    "owner_workspace_observed",
    "staff_workboard_observed",
    "reset_rollback_reviewed",
    "unexpected_data_not_observed",
    "live_provider_claims_not_observed",
    "invite_delivery_not_observed",
    "billing_pos_member_writes_not_observed",
  ]) {
    invariant(evidence.observed?.[key] === true, `${key} required.`);
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
  ]) {
    assertFalse(evidence, key, `${key} must remain blocked.`);
  }
}

function main() {
  const evidencePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH ??
      DEFAULT_EVIDENCE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
    { mustExist: true },
  );
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH",
  );

  runHostedEvidenceInspect(evidencePath.relativePath);
  const { artifact: evidence, sha256: evidenceSha256 } = readJsonArtifact(
    evidencePath.resolved,
    "public request hosted rehearsal evidence",
  );
  validateHostedEvidence(evidence);

  const batch = {
    artifact_kind:
      "admin_public_request_customer_session_proof_acquisition_batch",
    status:
      "admin_public_request_customer_session_proof_acquisition_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_hosted_rehearsal_evidence",
    public_request_hosted_rehearsal_evidence_path: evidencePath.relativePath,
    public_request_hosted_rehearsal_evidence_sha256: evidenceSha256,
    candidate_gym_label: evidence.candidate_gym_label,
    public_request_customer_session_proof_acquisition_batch_ready: true,
    proof_acquisition: {
      mode: "current_chain_customer_session_command_packet_only",
      customer_observed_session_command_required: true,
      customer_session_hosted_import_required: true,
      hosted_customer_session_proof_required: true,
      first_gym_go_no_go_bundle_required_after_customer_proof: true,
      customer_observed_session_recorded: false,
      customer_observed_handoff_claimed: false,
      customer_session_hosted_import_recorded: false,
      hosted_customer_session_proof_recorded: false,
      first_gym_go_no_go_bundle_ready: false,
      first_gym_operator_run_recorded: false,
      public_launch_decision_allowed: false,
    },
    command_sequence: [
      {
        command: "npm run admin:customer-session:record",
        detail:
          "Run only after the real owner attends and observes the protected Preview, owner workspace, staff handoff path, reset/rollback checklist, and blocked live-provider claims.",
        id: "customer_observed_handoff_gate",
        state: "blocked",
        title: "Record customer-observed session",
      },
      {
        command: "npm run admin:customer-session:inspect",
        detail:
          "Inspect the local non-secret customer session record before hosted import.",
        id: "customer_observed_handoff_gate",
        state: "blocked",
        title: "Inspect customer-observed session",
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
          "Prepare the first-gym go/no-go bundle only after hosted rehearsal evidence and customer-session proof are both recorded.",
        id: "first_gym_go_no_go_bundle",
        state: "blocked",
        title: "Prepare first-gym go/no-go bundle",
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
      "Hosted rehearsal evidence exists for the current public-request chain",
      "Customer-observed session remains unrecorded",
      "Hosted customer-session proof remains unrecorded",
      "First-gym go/no-go bundle remains blocked",
      "Public launch and live-provider gates remain blocked",
    ],
    next_readiness_batches: [
      {
        command:
          "Run the real customer-observed session record and hosted digest proof when the owner attends.",
        detail:
          "This packet only prepares the command path; it does not claim customer attendance.",
        id: "customer_observed_handoff_gate",
        state: "blocked",
        title: "Customer-observed session proof",
      },
      {
        command:
          "Import and verify the sanitized customer-session digest in hosted Neon after the record exists.",
        detail:
          "Hosted proof remains blocked until the customer session record is real.",
        id: "hosted_customer_session_proof",
        state: "blocked",
        title: "Hosted customer-session proof",
      },
      {
        command:
          "Prepare the first-gym go/no-go bundle and first operator-assisted run record only after customer proof exists.",
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

  assertNoSecretShapedKeys(
    batch,
    "public request customer-session proof acquisition batch",
  );
  mkdirSync(dirname(batchPath.resolved), { recursive: true });
  writeFileSync(batchPath.resolved, `${JSON.stringify(batch, null, 2)}\n`, {
    flag: "wx",
  });
  console.log(
    `Admin public request customer-session proof acquisition batch prepared: ${batchPath.relativePath}`,
  );
}

main();
