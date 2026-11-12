#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_REHEARSAL_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-hosted-rehearsal-evidence.json";
const DEFAULT_CUSTOMER_SESSION_PATH =
  "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json";
const DEFAULT_BUNDLE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-go-no-go-bundle.json";

const BLOCKED_GATES = [
  "Public owner self-signup",
  "Public request form submission",
  "Browser approval buttons",
  "Automatic approval",
  "Product Auth admin API",
  "Auth user creation",
  "Magic link creation",
  "Automatic owner/staff grants",
  "Invite delivery",
  "Notification sending",
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

function runInspect(script, envName, path, label) {
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, [envName]: path },
  });
  if (result.status !== 0) {
    throw new Error(`${label} inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function requireYes(name) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  invariant(value === "yes", `${name}=yes required.`);
  return true;
}

function requireText(name, maxLength) {
  const value = String(process.env[name] ?? "").trim();
  invariant(value, `${name} required.`);
  invariant(value.length <= maxLength, `${name} too long.`);
  assertNoSecretShapedValue(value, name);
  return value;
}

function normalizePreviewOrigin() {
  const url = new URL(requireText("OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PREVIEW_URL", 250));
  invariant(url.protocol === "https:", "Preview URL must use https.");
  invariant(!url.username && !url.password, "Preview URL cannot include credentials.");
  invariant(!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname), "Preview URL cannot be local.");
  invariant(url.hostname.endsWith(".vercel.app"), "Preview URL must be a Vercel Preview origin.");
  url.pathname = "";
  url.search = "";
  url.hash = "";
  assertNoSecretShapedValue(url.toString(), "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PREVIEW_URL");
  return url.toString().replace(/\/$/u, "");
}

function validateRehearsal(evidence) {
  invariant(
    evidence.artifact_kind === "admin_public_request_hosted_rehearsal_evidence",
    "Public request hosted rehearsal evidence kind mismatch.",
  );
  invariant(
    evidence.status === "admin_public_request_hosted_rehearsal_evidence_recorded",
    "Public request hosted rehearsal evidence status mismatch.",
  );
  invariant(evidence.public_request_hosted_rehearsal_evidence_recorded === true, "Hosted rehearsal evidence required.");
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
    "customer_observed_handoff_claimed",
    "first_gym_go_no_go_bundle_ready",
    "first_gym_operator_run_recorded",
    "public_launch_decision_allowed",
  ]) {
    assertFalse(evidence, key, `${key} must remain blocked before bundle.`);
  }
}

function validateCustomerSession(record) {
  invariant(record.artifact_kind === "admin_customer_observed_session_record", "Customer session kind mismatch.");
  invariant(record.status === "admin_customer_observed_session_recorded", "Customer session status mismatch.");
  invariant(record.customer_observed_session_recorded === true, "Customer session must be recorded.");
  invariant(record.customer_observed_handoff_claimed === true, "Customer-observed handoff must be explicit.");
  invariant(record.observed?.owner_present === true, "Owner presence required.");
  invariant(record.observed?.protected_preview_observed === true, "Protected Preview observation required.");
  invariant(record.observed?.owner_workspace_observed === true, "Owner workspace observation required.");
  invariant(record.observed?.staff_handoff_path_observed === true, "Staff handoff observation required.");
  invariant(record.observed?.reset_rollback_reviewed === true, "Reset/rollback observation required.");
  invariant(record.observed?.unexpected_data_not_observed === true, "Unexpected-data check required.");
  invariant(record.observed?.live_provider_claims_not_observed === true, "Live-provider claim check required.");
  assertFalse(record, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(record, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(record, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(record, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(record, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
}

function main() {
  const rehearsalPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH ??
      DEFAULT_REHEARSAL_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
    { mustExist: true },
  );
  const customerSessionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH ??
      DEFAULT_CUSTOMER_SESSION_PATH,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    { mustExist: true },
  );
  const bundlePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH ??
      DEFAULT_BUNDLE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
  );

  runInspect(
    "scripts/inspect-admin-public-request-hosted-rehearsal-evidence.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
    rehearsalPath.relativePath,
    "Public request hosted rehearsal evidence",
  );
  runInspect(
    "scripts/inspect-admin-customer-observed-session.mjs",
    "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    customerSessionPath.relativePath,
    "Customer-observed session",
  );

  const { artifact: rehearsal, sha256: rehearsalSha256 } = readJsonArtifact(
    rehearsalPath.resolved,
    "public request hosted rehearsal evidence",
  );
  const { artifact: customerSession, sha256: customerSessionSha256 } =
    readJsonArtifact(customerSessionPath.resolved, "customer session record");
  validateRehearsal(rehearsal);
  validateCustomerSession(customerSession);
  invariant(
    rehearsal.candidate_gym_label === customerSession.gym_name,
    "Hosted rehearsal and customer session must target the same gym.",
  );

  requireYes("OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_PASSED");
  const hostedProofOperator = requireText(
    "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_OPERATOR",
    120,
  );
  const previewUrl = normalizePreviewOrigin();
  const branchName = requireText("OUTPOST_NEON_BRANCH_NAME", 120);
  invariant(branchName !== "production", "Refusing production branch.");
  invariant(branchName !== "outpost-neon-spike", "Refusing migration spike branch.");

  const bundle = {
    artifact_kind: "admin_public_request_first_gym_go_no_go_bundle",
    status: "admin_public_request_first_gym_go_no_go_bundle_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "public_request_hosted_rehearsal_customer_session_and_hosted_digest_proof",
    public_request_hosted_rehearsal_evidence_path: rehearsalPath.relativePath,
    public_request_hosted_rehearsal_evidence_sha256: rehearsalSha256,
    customer_session_record_path: customerSessionPath.relativePath,
    customer_session_record_sha256: customerSessionSha256,
    hosted_customer_session_proof_command:
      "npm run hosted:customer-session-record:proof",
    hosted_customer_session_proof_operator: hostedProofOperator,
    hosted_customer_session_proof_recorded: true,
    gym_name: customerSession.gym_name,
    owner_email: customerSession.owner_email,
    candidate_gym_label: rehearsal.candidate_gym_label,
    protected_preview_url: previewUrl,
    hosted_neon_branch: branchName,
    public_request_hosted_rehearsal_evidence_recorded: true,
    customer_observed_session_recorded: true,
    customer_observed_handoff_claimed: true,
    first_gym_go_no_go_bundle_ready: true,
    ready_for_first_gym_operator_assisted_run: true,
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_user_created: false,
    magic_link_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    access_control_writes_allowed: false,
    member_ledger_writes_allowed: false,
    provider_ingress_allowed: false,
    provider_egress_allowed: false,
    public_launch_decision_allowed: false,
    ready_gates: [
      "Public-request hosted rehearsal evidence recorded",
      "Real customer-observed session record present",
      "Hosted customer-session digest proof confirmed by operator",
      "Parent artifact SHA chain verified",
    ],
    blocked_gates: BLOCKED_GATES,
    next_readiness_batches: [
      {
        command: "npm run admin:public-request-first-gym:run",
        detail:
          "Record the first operator-assisted gym run only after the session is actually completed.",
        id: "public_request_first_gym_operator_assisted_run",
        state: "pending",
        title: "Public-request first-gym operator run",
      },
      {
        command: "npm run admin:limited-beta:operator-review",
        detail:
          "Prepare limited beta review from the first-gym run before adding another gym.",
        id: "limited_operator_assisted_beta_onboarding",
        state: "blocked",
        title: "Limited beta operator review",
      },
      {
        command:
          "Keep public signup, invites, providers, billing, POS, access control, and member-ledger writes blocked.",
        id: "public_self_serve_and_live_provider_gates",
        state: "blocked",
        title: "Public/live-provider gates",
      },
    ],
    replay_commands: [
      "npm run admin:public-request-hosted-rehearsal:evidence:inspect",
      "npm run admin:customer-session:inspect",
      "npm run hosted:customer-session-record:proof",
      "npm run admin:public-request-first-gym:go-no-go:bundle:inspect",
    ],
  };

  assertNoSecretShapedKeys(bundle, "public request first-gym go/no-go bundle");
  mkdirSync(dirname(bundlePath.resolved), { recursive: true });
  writeFileSync(bundlePath.resolved, `${JSON.stringify(bundle, null, 2)}\n`, {
    flag: "wx",
  });

  console.log("Admin public request first-gym go/no-go bundle prepared");
  console.log(`Artifact: ${bundlePath.relativePath}`);
  console.log("First gym operator-assisted run: ready");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
