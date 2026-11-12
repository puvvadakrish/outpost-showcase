#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PARENT_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-evidence-acquisition-batch.json";
const DEFAULT_RUNWAY_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-runway-batch.json";

const BLOCKED_GATES = [
  "Customer-observed completion claim until the real owner attends",
  "Hosted customer-session proof until hosted digest import is verified",
  "First-gym go/no-go approval until hosted and customer proof exist",
  "First-gym operator run until go/no-go bundle is green",
  "Limited beta review until first-gym run evidence is recorded",
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

const COMMAND_SEQUENCE = [
  {
    command: "npm run admin:public-request-hosted-rehearsal:evidence",
    detail: "Record hosted rehearsal evidence only after operator/browser observation.",
    id: "hosted_rehearsal_evidence",
    state: "blocked",
    title: "Record hosted rehearsal evidence",
  },
  {
    command: "npm run admin:customer-session:record",
    detail: "Record customer-observed session only after the real owner attends.",
    id: "customer_observed_session",
    state: "blocked",
    title: "Record customer-observed session",
  },
  {
    command: "npm run admin:customer-session:record-hosted",
    detail: "Import sanitized customer-session digest metadata into hosted Neon.",
    id: "customer_session_hosted_import",
    state: "blocked",
    title: "Import hosted customer-session digest",
  },
  {
    command: "npm run hosted:customer-session-record:proof",
    detail: "Verify founder-admin can read the hosted customer-session digest.",
    id: "hosted_customer_session_proof",
    state: "blocked",
    title: "Verify hosted customer-session proof",
  },
  {
    command: "npm run admin:public-request-first-gym:go-no-go:bundle",
    detail: "Prepare first-gym go/no-go only after hosted rehearsal and customer proof.",
    id: "first_gym_go_no_go_bundle",
    state: "blocked",
    title: "Prepare first-gym go/no-go bundle",
  },
  {
    command: "npm run admin:public-request-first-gym:run",
    detail: "Record the operator-assisted first-gym run only after go/no-go is green.",
    id: "first_gym_operator_run",
    state: "blocked",
    title: "Record first-gym operator run",
  },
  {
    command: "npm run admin:public-request:limited-beta:operator-review",
    detail: "Review the first-gym run before expanding to another approved beta gym.",
    id: "limited_beta_operator_review",
    state: "blocked",
    title: "Prepare limited beta operator review",
  },
  {
    command: "npm run admin:public-request:self-serve:launch-preflight",
    detail: "Package public self-serve prerequisites without enabling launch.",
    id: "public_request_self_serve_preflight",
    state: "blocked",
    title: "Prepare public-request self-serve preflight",
  },
  {
    command: "npm run admin:public-launch-controls:batch",
    detail: "Package launch controls from the current-chain preflight; launch remains blocked.",
    id: "public_launch_controls",
    state: "blocked",
    title: "Prepare public launch controls",
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
      !/(password|token|cookie|apikey|authorization|credential|privatekey|secret|bypass|signature|jwt)/u.test(normalizedKey),
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

function runEvidenceAcquisitionInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-first-gym-evidence-acquisition-batch.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
          path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Public request first-gym evidence acquisition inspection failed.\n${result.stderr || result.stdout}`,
    );
  }
}

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function validateParent(parent) {
  invariant(
    parent.artifact_kind === "admin_public_request_first_gym_evidence_acquisition_batch",
    "Public request first-gym evidence acquisition kind mismatch.",
  );
  invariant(
    parent.public_request_first_gym_evidence_acquisition_batch_ready === true,
    "Evidence acquisition batch must be ready.",
  );
  invariant(
    parent.evidence_acquisition?.mode === "current_chain_command_packet_only",
    "Evidence acquisition parent must be command-packet only.",
  );
  for (const key of [
    "approved_gym_hosted_rehearsal_recorded",
    "customer_observed_session_recorded",
    "customer_session_hosted_import_recorded",
    "first_gym_go_no_go_bundle_ready",
    "first_gym_operator_run_recorded",
    "ready_for_public_self_serve_launch",
    "public_launch_decision_allowed",
  ]) {
    assertFalse(parent.evidence_acquisition, key, `${key} must remain unrecorded in parent.`);
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
    assertFalse(parent, `${key}`, `${key} must remain blocked.`);
  }
}

function main() {
  const parentPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH ??
      DEFAULT_PARENT_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH",
    { mustExist: true },
  );
  const runwayPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH ??
      DEFAULT_RUNWAY_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH",
  );

  runEvidenceAcquisitionInspect(parentPath.relativePath);
  const { artifact: parent, sha256: parentSha256 } = readJsonArtifact(
    parentPath.resolved,
    "public request first-gym evidence acquisition batch",
  );
  validateParent(parent);

  const runway = {
    artifact_kind: "admin_public_request_first_gym_proof_runway_batch",
    status: "admin_public_request_first_gym_proof_runway_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_first_gym_evidence_acquisition_batch",
    public_request_first_gym_evidence_acquisition_batch_path:
      parentPath.relativePath,
    public_request_first_gym_evidence_acquisition_batch_sha256: parentSha256,
    candidate_gym_label: parent.candidate_gym_label,
    public_request_first_gym_proof_runway_batch_ready: true,
    proof_runway: {
      mode: "terminal_execution_plan_only",
      hosted_rehearsal_evidence_recorded: false,
      customer_observed_session_recorded: false,
      customer_session_hosted_import_recorded: false,
      hosted_customer_session_proof_recorded: false,
      first_gym_go_no_go_bundle_ready: false,
      first_gym_operator_run_recorded: false,
      limited_beta_operator_review_ready: false,
      public_request_self_serve_launch_preflight_ready: false,
      public_launch_controls_batch_ready: false,
      ready_for_public_self_serve_launch: false,
      public_launch_decision_allowed: false,
    },
    command_sequence: COMMAND_SEQUENCE,
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
    next_readiness_batches: [
      {
        command: "Run the real proof commands in order when hosted/customer evidence exists.",
        detail: "Do not mark completion from this runway artifact.",
        id: "real_first_gym_proof_execution",
        state: "blocked",
        title: "Real first-gym proof execution",
      },
      {
        command: "Review first-gym run before expanding to another approved gym.",
        detail: "Owner access remains operator-managed.",
        id: "limited_beta_operator_review",
        state: "blocked",
        title: "Limited beta operator review",
      },
      {
        command: "Keep public self-serve and live-provider/revenue gates separate.",
        detail: "No public launch decision is authorized by this runway.",
        id: "public_live_provider_revenue_gates",
        state: "blocked",
        title: "Public/live-provider gates",
      },
    ],
  };

  assertNoSecretShapedKeys(runway, "public request first-gym proof runway batch");
  mkdirSync(dirname(runwayPath.resolved), { recursive: true });
  writeFileSync(runwayPath.resolved, `${JSON.stringify(runway, null, 2)}\n`, {
    flag: "wx",
  });

  console.log("Admin public request first-gym proof runway batch prepared");
  console.log(`Artifact: ${runwayPath.relativePath}`);
  console.log("Runway mode: terminal execution plan only");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
