#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_REHEARSAL_PATH =
  "artifacts/admin-launch-readiness/admin-approved-gym-hosted-rehearsal-evidence.json";
const DEFAULT_CUSTOMER_SESSION_PATH =
  "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json";
const DEFAULT_BUNDLE_PATH =
  "artifacts/admin-launch-readiness/admin-first-gym-go-no-go-bundle.json";

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

function validateRehearsal(evidence) {
  invariant(
    evidence.artifact_kind === "admin_approved_gym_hosted_rehearsal_evidence",
    "Hosted rehearsal evidence kind mismatch.",
  );
  invariant(
    evidence.status === "admin_approved_gym_hosted_rehearsal_recorded",
    "Hosted rehearsal evidence status mismatch.",
  );
  invariant(evidence.approved_gym_hosted_rehearsal_recorded === true, "Hosted rehearsal must be recorded.");
  invariant(evidence.approved_gym_non_acme_fitness === true, "Approved gym must be non-House-of-Fitness.");
  invariant(evidence.observed?.owner_workspace_observed === true, "Owner workspace observation required.");
  invariant(evidence.observed?.staff_workboard_observed === true, "Staff workboard observation required.");
  invariant(evidence.observed?.reset_rollback_reviewed === true, "Reset/rollback observation required.");
  invariant(evidence.observed?.unexpected_data_not_observed === true, "No unexpected data observation required.");
  invariant(evidence.observed?.live_provider_claims_not_observed === true, "No live-provider observation required.");
  assertFalse(evidence, "customer_observed_handoff_claimed", "Hosted rehearsal alone must not claim customer handoff.");
  assertFalse(evidence, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(evidence, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(evidence, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(evidence, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(evidence, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
}

function validateCustomerSession(record) {
  invariant(
    record.artifact_kind === "admin_customer_observed_session_record",
    "Customer-observed session record kind mismatch.",
  );
  invariant(
    record.status === "admin_customer_observed_session_recorded",
    "Customer-observed session record status mismatch.",
  );
  invariant(record.customer_observed_session_recorded === true, "Customer-observed session must be recorded.");
  invariant(record.customer_observed_handoff_claimed === true, "Customer-observed handoff must be claimed by the session record.");
  invariant(record.observed?.owner_present === true, "Owner presence observation required.");
  invariant(record.observed?.protected_preview_observed === true, "Protected Preview observation required.");
  invariant(record.observed?.owner_workspace_observed === true, "Owner workspace observation required.");
  invariant(record.observed?.staff_handoff_path_observed === true, "Staff handoff observation required.");
  invariant(record.observed?.reset_rollback_reviewed === true, "Reset/rollback observation required.");
  invariant(record.observed?.unexpected_data_not_observed === true, "No unexpected data observation required.");
  invariant(record.observed?.live_provider_claims_not_observed === true, "No live-provider observation required.");
  assertFalse(record, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(record, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(record, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(record, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(record, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
}

function main() {
  const rehearsalPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH ??
      DEFAULT_REHEARSAL_PATH,
    "OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH",
    { mustExist: true },
  );
  const customerSessionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH ??
      DEFAULT_CUSTOMER_SESSION_PATH,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    { mustExist: true },
  );
  const bundlePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH ??
      DEFAULT_BUNDLE_PATH,
    "OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
  );
  const { artifact: rehearsal, sha256: rehearsalSha256 } = readJsonArtifact(
    rehearsalPath.resolved,
    "approved-gym hosted rehearsal evidence",
  );
  const { artifact: customerSession, sha256: customerSessionSha256 } =
    readJsonArtifact(customerSessionPath.resolved, "customer-observed session record");
  validateRehearsal(rehearsal);
  validateCustomerSession(customerSession);
  invariant(
    rehearsal.approved_gym_label === customerSession.gym_name,
    "Hosted rehearsal and customer-observed session must target the same gym.",
  );

  const bundle = {
    artifact_kind: "admin_first_gym_go_no_go_bundle",
    status: "admin_first_gym_go_no_go_bundle_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "approved_gym_hosted_rehearsal_and_customer_observed_session",
    approved_gym_hosted_rehearsal_evidence_path: rehearsalPath.relativePath,
    approved_gym_hosted_rehearsal_evidence_sha256: rehearsalSha256,
    customer_session_record_path: customerSessionPath.relativePath,
    customer_session_record_sha256: customerSessionSha256,
    gym_name: customerSession.gym_name,
    owner_email: customerSession.owner_email,
    protected_preview_url: rehearsal.protected_preview_url,
    hosted_neon_branch: rehearsal.hosted_neon_branch,
    approved_gym_hosted_rehearsal_recorded: true,
    customer_observed_session_recorded: true,
    customer_observed_handoff_claimed: true,
    first_gym_go_no_go_bundle_ready: true,
    ready_for_first_gym_operator_assisted_run: true,
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_admin_product_api_allowed: false,
    auth_user_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    ready_gates: [
      "Approved-gym hosted rehearsal evidence recorded",
      "Real customer-observed session record present",
      "Owner workspace, staff path, reset/rollback, no unexpected data, and no live-provider observations recorded",
      "Parent artifact SHA chain verified",
    ],
    blocked_gates: [
      "Public owner self-signup",
      "Browser approval buttons",
      "Invite delivery send",
      "Notification sending",
      "Phone/email provider activation",
      "Product Auth admin API",
      "Automatic owner/staff grants",
      "Billing, POS, access control, member-ledger writes",
    ],
    next_readiness_batches: [
      {
        command: "Run the first gym operator-assisted end-to-end session using this bundle as the checklist.",
        detail:
          "This is ready for the observed operator-assisted run, not public self-serve or live-provider launch.",
        id: "first_gym_operator_assisted_run",
        state: "pending",
        title: "First gym operator-assisted E2E run",
      },
      {
        command: "After the first gym run is reviewed, prepare limited beta onboarding for the next approved gym.",
        detail:
          "Keep owner access operator-managed until limited beta proof is reviewed.",
        id: "limited_operator_assisted_beta_onboarding",
        state: "blocked",
        title: "Limited operator-assisted beta onboarding",
      },
      {
        command:
          "Only after limited beta evidence, prepare public self-serve preflight and live-provider/revenue gates separately.",
        detail:
          "Public signup, invites, providers, billing, POS, access control, and member-ledger writes remain blocked.",
        id: "public_self_serve_preflight",
        state: "blocked",
        title: "Public self-serve and live-provider gates",
      },
    ],
    replay_commands: [
      "npm run admin:approved-gym-hosted-rehearsal:evidence:inspect",
      "npm run admin:customer-session:inspect",
      "npm run admin:first-gym:go-no-go:inspect",
    ],
  };

  assertNoSecretShapedKeys(bundle, "first-gym go/no-go bundle");
  mkdirSync(dirname(bundlePath.resolved), { recursive: true });
  writeFileSync(bundlePath.resolved, `${JSON.stringify(bundle, null, 2)}\n`);

  console.log("Admin first-gym go/no-go bundle prepared");
  console.log(`Artifact: ${bundlePath.relativePath}`);
  console.log("First gym operator-assisted run: ready");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
