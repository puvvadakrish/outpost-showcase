#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_RUN_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-operator-run-record.json";
const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-limited-beta-operator-review-packet.json";

const REQUIRED_BLOCKED_GATES = [
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery",
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

function runFirstGymInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-first-gym-operator-run.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH: path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(`Public request first-gym operator run inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function requireYes(name) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  invariant(value === "yes", `${name} must be yes.`);
  return true;
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

function validateRun(record) {
  invariant(record.artifact_kind === "admin_public_request_first_gym_operator_run_record", "Public request first-gym run record kind mismatch.");
  invariant(record.status === "admin_public_request_first_gym_operator_run_recorded", "Public request first-gym run record status mismatch.");
  invariant(record.first_gym_operator_assisted_run_successful === true, "First-gym run must be successful.");
  invariant(record.ready_for_limited_beta_review === true, "First-gym run must be ready for limited beta review.");
  assertFalse(record, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(record, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(record, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(record, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(record, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
}

function main() {
  const runPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH ?? DEFAULT_RUN_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH",
    { mustExist: true },
  );
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH ?? DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH",
  );
  const { artifact: runRecord, sha256: runSha256 } = readJsonArtifact(
    runPath.resolved,
    "first-gym operator run record",
  );
  runFirstGymInspect(runPath.relativePath);
  validateRun(runRecord);
  requireYes("OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_REVIEWED_FIRST_GYM_RUN");

  const operatorLabel =
    optionalText("OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR", 120) ||
    runRecord.operator_label ||
    "Operator";
  const candidateGymLabel =
    optionalText("OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_CANDIDATE_GYM", 160) ||
    "Next approved beta gym";

  const packet = {
    artifact_kind: "admin_public_request_limited_beta_operator_review_packet",
    status: "admin_public_request_limited_beta_operator_review_packet_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_first_gym_operator_run_record",
    public_request_first_gym_operator_run_record_path: runPath.relativePath,
    public_request_first_gym_operator_run_record_sha256: runSha256,
    first_gym_name: runRecord.gym_name,
    first_gym_owner_email: runRecord.owner_email,
    candidate_gym_label: candidateGymLabel,
    operator_label: operatorLabel,
    first_gym_run_reviewed: true,
    limited_beta_operator_review_ready: true,
    owner_access_mode: "operator_managed",
    request_triage_required: true,
    followthrough_required: true,
    customer_observed_completion_recorded: false,
    public_self_serve_launch_allowed: false,
    browser_approval_buttons_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_user_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: REQUIRED_BLOCKED_GATES,
    operator_checklist: [
      "Review public-request first-gym run record before contacting the next approved gym.",
      "Use request triage and owner access fulfillment; do not expose browser approval buttons.",
      "Provision owner access only through the operator-managed CLI path.",
      "Walk the next gym through protected Preview owner workspace, staff handoff, support, and rollback.",
      "Record a new customer-observed session before claiming customer completion for the next gym.",
    ],
    next_readiness_batches: [
      {
        command: "Prepare public self-serve launch preflight from this limited beta review.",
        detail: "Preflight is not launch permission; public signup, invites, and live providers remain blocked.",
        id: "public_self_serve_preflight",
        state: "pending",
        title: "Public self-serve launch preflight",
      },
      {
        command: "Run limited beta with one more approved gym before public self-serve launch.",
        detail: "Operator-managed owner access remains the only allowed path.",
        id: "limited_operator_assisted_beta_onboarding",
        state: "pending",
        title: "Next approved gym limited beta",
      },
      {
        command: "Keep provider, revenue, POS, and member-ledger gates separate.",
        detail: "Those gates need dedicated proof and review after beta evidence.",
        id: "live_provider_revenue_gates",
        state: "blocked",
        title: "Live-provider and revenue gates",
      },
    ],
  };

  assertNoSecretShapedKeys(packet, "public request limited beta operator review packet");
  mkdirSync(dirname(packetPath.resolved), { recursive: true });
  writeFileSync(packetPath.resolved, `${JSON.stringify(packet, null, 2)}\n`);

  console.log("Admin public request limited beta operator review packet prepared");
  console.log(`Artifact: ${packetPath.relativePath}`);
  console.log("Owner access: operator-managed");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
