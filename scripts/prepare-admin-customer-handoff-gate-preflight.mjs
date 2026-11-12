#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_SCHEDULING_PATH =
  "artifacts/admin-launch-readiness/admin-customer-handoff-scheduling-batch.json";
const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-customer-handoff-gate-preflight.json";

const REQUIRED_CUSTOMER_OBSERVATIONS = [
  "owner_present",
  "protected_preview_observed",
  "owner_workspace_observed",
  "staff_handoff_path_observed",
  "reset_rollback_reviewed",
  "unexpected_data_not_observed",
  "live_provider_claims_not_observed",
  "invite_delivery_not_observed",
  "billing_pos_member_writes_not_observed",
];

const BLOCKED_GATES = [
  "Customer-observed completion claim",
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery",
  "Notification sending",
  "Phone/email provider activation",
  "Product Auth admin API",
  "Automatic owner/staff grants",
  "Billing, POS, access control, member-ledger writes",
];

const NEXT_BATCHES = [
  {
    command: "npm run admin:customer-session:record",
    detail:
      "Run only during the real owner-observed session after every required observation is true.",
    id: "real_customer_observed_handoff_gate",
    state: "pending",
    title: "Real customer-observed handoff gate",
  },
  {
    command: "npm run admin:customer-session:inspect",
    detail:
      "Inspect the customer-observed record and then import hosted proof before any customer completion claim is used downstream.",
    id: "customer_session_record_inspection",
    state: "blocked",
    title: "Customer session record inspection",
  },
  {
    command: "npm run admin:beta-request:followthrough",
    detail:
      "Use operator-managed owner and staff access for the next approved gym only after the real customer gate is green.",
    id: "limited_operator_assisted_beta_onboarding",
    state: "blocked",
    title: "Limited operator-assisted beta onboarding",
  },
  {
    command: "npm run admin:public-self-serve:preflight",
    detail:
      "Public self-serve remains blocked until customer-observed and operator-assisted beta evidence are reviewed.",
    id: "public_self_serve_preflight",
    state: "blocked",
    title: "Public self-serve preflight",
  },
  {
    command:
      "Keep live providers, billing, POS, access control, member-ledger writes blocked until separately proven.",
    detail:
      "Phone/email providers, notifications, revenue systems, and member-system writes remain outside this batch.",
    id: "live_provider_revenue_gates",
    state: "blocked",
    title: "Live-provider and revenue gates",
  },
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
  invariant(relativePath.startsWith(`artifacts${sep}`), `${label} must be under artifacts/.`);
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  } else {
    invariant(!existsSync(resolved), `${label} already exists: ${relativePath}`);
  }
  return { relativePath, resolved };
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

function assertNoSecretShapedKeys(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretShapedKeys(entry, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    invariant(
      !/(password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)/iu.test(
        key,
      ),
      `${label} contains secret-shaped key ${key}.`,
    );
    assertNoSecretShapedKeys(entry, `${label}.${key}`);
  }
}

function readJsonArtifact(path, label) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, label);
  const artifact = JSON.parse(source);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: createHash("sha256").update(source).digest("hex") };
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function assertSafeBranch(branchName, label) {
  invariant(branchName && typeof branchName === "string", `${label} branch required.`);
  invariant(!/^production$/iu.test(branchName), `${label} must not target production branch.`);
  invariant(!/outpost-neon-spike/iu.test(branchName), `${label} must not target migration spike branch.`);
}

function assertHttpsPreview(value, label) {
  invariant(value && typeof value === "string", `${label} Preview URL required.`);
  const parsed = new URL(value);
  invariant(parsed.protocol === "https:", `${label} Preview URL must use https.`);
  invariant(!parsed.username && !parsed.password, `${label} Preview URL must not include credentials.`);
  invariant(
    !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname),
    `${label} Preview URL must not be local.`,
  );
}

function assertScheduling(scheduling) {
  invariant(
    scheduling.artifact_kind === "admin_customer_handoff_scheduling_batch",
    "Customer handoff scheduling batch kind mismatch.",
  );
  invariant(
    scheduling.status === "admin_customer_handoff_scheduling_batch_prepared",
    "Customer handoff scheduling batch status mismatch.",
  );
  invariant(scheduling.customer_handoff_scheduling_ready === true, "Scheduling batch must be ready.");
  assertFalse(scheduling, "customer_observed_completion_recorded", "Customer completion must remain blocked.");
  assertFalse(scheduling, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(scheduling, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(scheduling, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(scheduling, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(scheduling, "product_auth_admin_api_allowed", "Product Auth admin API must remain blocked.");
  assertFalse(scheduling, "automatic_owner_staff_grants_allowed", "Automatic grants must remain blocked.");
  assertFalse(scheduling, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  assertSafeBranch(scheduling.hosted_neon_branch, "Customer handoff scheduling batch");
  assertHttpsPreview(scheduling.protected_preview_url, "Customer handoff scheduling batch");
  invariant(scheduling.gym_name, "Scheduling gym name required.");
  invariant(scheduling.owner_email, "Scheduling owner email required.");
  invariant(scheduling.operator_label, "Scheduling operator label required.");
  assertIncludes(scheduling.blocked_gates, "Customer-observed completion claim", "scheduling blocked gates");
}

function optionalText(envName, fallback, maxLength) {
  const raw = process.env[envName];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = raw.trim();
  invariant(value.length <= maxLength, `${envName} too long.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function main() {
  const schedulingPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH ?? DEFAULT_SCHEDULING_PATH,
    "OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH",
    { mustExist: true },
  );
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH ?? DEFAULT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH",
  );
  const { artifact: scheduling, sha256: schedulingSha256 } = readJsonArtifact(
    schedulingPath.resolved,
    "customer handoff scheduling batch",
  );
  assertScheduling(scheduling);

  const notes = optionalText(
    "OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_NOTES",
    "customer gate preflight only; no customer-observed completion recorded",
    500,
  );

  const recordCommand = [
    `OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH=${JSON.stringify(schedulingPath.relativePath)}`,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT='yes'",
    "OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED='yes'",
    "OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_WORKSPACE_OBSERVED='yes'",
    "OUTPOST_ADMIN_CUSTOMER_SESSION_STAFF_HANDOFF_OBSERVED='yes'",
    "OUTPOST_ADMIN_CUSTOMER_SESSION_RESET_ROLLBACK_REVIEWED='yes'",
    "OUTPOST_ADMIN_CUSTOMER_SESSION_UNEXPECTED_DATA_NOT_OBSERVED='yes'",
    "OUTPOST_ADMIN_CUSTOMER_SESSION_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED='yes'",
    "OUTPOST_ADMIN_CUSTOMER_SESSION_INVITE_DELIVERY_NOT_OBSERVED='yes'",
    "OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED='yes'",
    "OUTPOST_ADMIN_CUSTOMER_SESSION_OPERATOR='<operator-label>'",
    "npm run admin:customer-session:record",
  ].join(" \\\n  ");

  const preflight = {
    artifact_kind: "admin_customer_handoff_gate_preflight",
    status: "admin_customer_handoff_gate_preflight_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_customer_handoff_scheduling_batch",
    customer_handoff_scheduling_batch_path: schedulingPath.relativePath,
    customer_handoff_scheduling_batch_sha256: schedulingSha256,
    protected_preview_url: scheduling.protected_preview_url,
    hosted_neon_branch: scheduling.hosted_neon_branch,
    gym_name: scheduling.gym_name,
    owner_email: scheduling.owner_email,
    owner_label: scheduling.owner_label ?? "",
    staff_email: scheduling.staff_email,
    scheduling_operator_label: scheduling.operator_label,
    support_window: scheduling.support_window,
    notes,
    customer_handoff_gate_preflight_ready: true,
    customer_session_recording_allowed_without_owner: false,
    customer_observed_completion_recorded: false,
    customer_observed_handoff_claimed: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    required_customer_observations: REQUIRED_CUSTOMER_OBSERVATIONS,
    customer_stop_conditions: [
      "Stop if the real owner is not present.",
      "Stop if protected Preview auth or owner workspace cannot be shown live.",
      "Stop if staff handoff path cannot be shown from existing proof data.",
      "Stop if reset/rollback checklist is not reviewed before completion.",
      "Stop if unexpected tenant data or live-provider claims appear.",
      "Stop if invite delivery, notification sending, billing, POS, access control, or member-ledger writes are implied.",
    ],
    record_command_template: recordCommand,
    inspect_command_template: [
      `OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH=${JSON.stringify(
        "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json",
      )}`,
      "npm run admin:customer-session:inspect",
    ].join(" \\\n  "),
    blocked_gates: BLOCKED_GATES,
    next_batches: NEXT_BATCHES,
    replay_commands: [
      "npm run admin:customer-handoff:schedule:inspect",
      "npm run admin:customer-handoff:gate-preflight:inspect",
    ],
  };

  assertNoSecretShapedKeys(preflight, "customer handoff gate preflight");
  mkdirSync(dirname(preflightPath.resolved), { recursive: true });
  writeFileSync(preflightPath.resolved, `${JSON.stringify(preflight, null, 2)}\n`);

  console.log("Admin customer handoff gate preflight prepared");
  console.log(`Artifact: ${preflightPath.relativePath}`);
  console.log("Customer gate preflight: ready");
  console.log("Customer-observed completion: not recorded");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
