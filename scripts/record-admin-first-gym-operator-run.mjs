#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BUNDLE_PATH =
  "artifacts/admin-launch-readiness/admin-first-gym-go-no-go-bundle.json";
const DEFAULT_RECORD_PATH =
  "artifacts/admin-launch-readiness/admin-first-gym-operator-run-record.json";

const REQUIRED_CONFIRMATIONS = [
  ["OUTPOST_ADMIN_FIRST_GYM_OWNER_WORKSPACE_COMPLETED", "owner_workspace_completed"],
  ["OUTPOST_ADMIN_FIRST_GYM_STAFF_WORKBOARD_COMPLETED", "staff_workboard_completed"],
  ["OUTPOST_ADMIN_FIRST_GYM_SOURCE_TO_ANSWER_TO_TASK_COMPLETED", "source_answer_task_flow_completed"],
  ["OUTPOST_ADMIN_FIRST_GYM_RESET_ROLLBACK_EXERCISED", "reset_rollback_exercised"],
  ["OUTPOST_ADMIN_FIRST_GYM_SUPPORT_HANDOFF_REVIEWED", "support_handoff_reviewed"],
  ["OUTPOST_ADMIN_FIRST_GYM_UNEXPECTED_DATA_NOT_OBSERVED", "unexpected_data_not_observed"],
  ["OUTPOST_ADMIN_FIRST_GYM_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED", "live_provider_claims_not_observed"],
  ["OUTPOST_ADMIN_FIRST_GYM_INVITE_DELIVERY_NOT_OBSERVED", "invite_delivery_not_observed"],
  ["OUTPOST_ADMIN_FIRST_GYM_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED", "billing_pos_member_writes_not_observed"],
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

function runGoNoGoInspect(path) {
  const result = spawnSync("node", ["scripts/inspect-admin-first-gym-go-no-go-bundle.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH: path,
    },
  });
  if (result.status !== 0) {
    throw new Error(`First-gym go/no-go inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function requireYes(name) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  invariant(value === "yes", `${name} must be yes.`);
  return true;
}

function requireText(name, maxLength) {
  const value = String(process.env[name] ?? "").trim();
  invariant(value, `${name} required.`);
  invariant(value.length <= maxLength, `${name} too long.`);
  assertNoSecretShapedValue(value, name);
  return value;
}

function optionalText(name, maxLength) {
  const value = String(process.env[name] ?? "").trim();
  invariant(value.length <= maxLength, `${name} too long.`);
  assertNoSecretShapedValue(value, name);
  return value;
}

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function validateBundle(bundle) {
  invariant(bundle.artifact_kind === "admin_first_gym_go_no_go_bundle", "First-gym bundle kind mismatch.");
  invariant(bundle.status === "admin_first_gym_go_no_go_bundle_prepared", "First-gym bundle status mismatch.");
  invariant(bundle.ready_for_first_gym_operator_assisted_run === true, "First-gym run must be ready.");
  invariant(bundle.customer_observed_handoff_claimed === true, "Customer-observed proof required.");
  assertFalse(bundle, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(bundle, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(bundle, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(bundle, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(bundle, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
}

function main() {
  const bundlePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH ?? DEFAULT_BUNDLE_PATH,
    "OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
    { mustExist: true },
  );
  const recordPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_FIRST_GYM_OPERATOR_RUN_RECORD_PATH ?? DEFAULT_RECORD_PATH,
    "OUTPOST_ADMIN_FIRST_GYM_OPERATOR_RUN_RECORD_PATH",
  );
  runGoNoGoInspect(bundlePath.relativePath);
  const { artifact: bundle, sha256: bundleSha256 } = readJsonArtifact(
    bundlePath.resolved,
    "first-gym go/no-go bundle",
  );
  validateBundle(bundle);

  const observed = Object.fromEntries(
    REQUIRED_CONFIRMATIONS.map(([envName, key]) => [key, requireYes(envName)]),
  );
  const operatorLabel = requireText("OUTPOST_ADMIN_FIRST_GYM_OPERATOR", 120);
  const runWindow = optionalText("OUTPOST_ADMIN_FIRST_GYM_RUN_WINDOW", 160);
  const notes = optionalText("OUTPOST_ADMIN_FIRST_GYM_RUN_NOTES", 500);

  const record = {
    artifact_kind: "admin_first_gym_operator_run_record",
    status: "admin_first_gym_operator_run_recorded",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_first_gym_go_no_go_bundle",
    first_gym_go_no_go_bundle_path: bundlePath.relativePath,
    first_gym_go_no_go_bundle_sha256: bundleSha256,
    gym_name: bundle.gym_name,
    owner_email: bundle.owner_email,
    protected_preview_url: bundle.protected_preview_url,
    hosted_neon_branch: bundle.hosted_neon_branch,
    operator_label: operatorLabel,
    run_window: runWindow,
    notes,
    first_gym_operator_assisted_run_recorded: true,
    first_gym_operator_assisted_run_successful: true,
    ready_for_limited_beta_review: true,
    observed,
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    product_auth_admin_api_allowed: false,
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
      "First gym operator-assisted owner workspace completed",
      "Staff workboard completed",
      "Manual source to answer review to staff task flow completed",
      "Reset and rollback exercised",
      "Support handoff reviewed",
      "No unexpected data or live-provider claims observed",
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
        command: "Prepare limited beta review and operator-assisted onboarding packet.",
        detail: "Use the first gym run evidence before inviting another approved gym.",
        id: "limited_operator_assisted_beta_onboarding",
        state: "pending",
        title: "Limited beta operator review",
      },
      {
        command: "Prepare public self-serve preflight after limited beta review.",
        detail: "Public signup and live-provider/revenue work stay blocked until separately proven.",
        id: "public_self_serve_preflight",
        state: "blocked",
        title: "Public self-serve launch preflight",
      },
      {
        command: "Plan live-provider and revenue/member-system gates as separate proof tracks.",
        detail: "Phone/email providers, billing, POS, access control, and member-ledger writes remain blocked.",
        id: "live_provider_revenue_gates",
        state: "blocked",
        title: "Live-provider and revenue gates",
      },
    ],
  };

  assertNoSecretShapedKeys(record, "first-gym operator run record");
  mkdirSync(dirname(recordPath.resolved), { recursive: true });
  writeFileSync(recordPath.resolved, `${JSON.stringify(record, null, 2)}\n`);

  console.log("Admin first-gym operator-assisted run recorded");
  console.log(`Artifact: ${recordPath.relativePath}`);
  console.log("Limited beta review: ready");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
