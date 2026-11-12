#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-customer-handoff-gate-preflight.json";
const DEFAULT_READINESS_PATH =
  "artifacts/admin-launch-readiness/admin-customer-session-hosted-import-readiness.json";

const BLOCKED_GATES = [
  "Customer-observed completion claim until real owner session record exists",
  "Hosted customer-session import without record artifact",
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery",
  "Notification sending",
  "Phone/email provider activation",
  "Product Auth admin API",
  "Automatic owner/staff grants",
  "Billing, POS, access control, member-ledger writes",
];

const REQUIRED_RECORD_STEPS = [
  "admin:customer-session:record",
  "admin:customer-session:inspect",
  "admin:customer-session:record-hosted",
  "hosted:customer-session-record:proof",
];

const NEXT_BATCHES = [
  {
    command: "npm run admin:customer-session:record",
    detail:
      "Run only during the real owner-observed handoff after every customer observation is true.",
    id: "customer_observed_handoff_gate",
    state: "pending",
    title: "Real customer-observed handoff gate",
  },
  {
    command:
      "npm run admin:customer-session:inspect && npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
    detail:
      "Import and prove the customer-session digest only after the real record exists.",
    id: "hosted_customer_session_proof",
    state: "blocked",
    title: "Hosted customer-session proof",
  },
  {
    command: "npm run admin:beta-request:followthrough",
    detail:
      "Use operator-managed access for the next approved gym after customer-session proof is imported and reviewed.",
    id: "limited_operator_assisted_beta_onboarding",
    state: "blocked",
    title: "Limited operator-assisted beta onboarding",
  },
  {
    command: "npm run admin:public-self-serve:preflight",
    detail:
      "Public self-serve remains blocked until customer proof and operator-assisted beta evidence are green.",
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

function normalizeArtifactPath(value, label, options = {}) {
  invariant(value && typeof value === "string", `${label} required.`);
  assertNoSecretShapedValue(value, label);
  invariant(!value.includes("\0"), `${label} cannot contain NUL.`);
  const resolved = resolve(value);
  const cwd = resolve(process.cwd());
  const relativePath = relative(cwd, resolved);
  invariant(
    !isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`),
    `${label} must stay under artifacts/.`,
  );
  invariant(relativePath.startsWith(`artifacts${sep}`), `${label} must be under artifacts/.`);
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  invariant(value === relativePath, `${label} must be normalized.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  } else {
    invariant(!existsSync(resolved), `${label} already exists: ${relativePath}`);
  }
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, label);
  const artifact = JSON.parse(source);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: createHash("sha256").update(source).digest("hex") };
}

function runPreflightInspect(preflightPath) {
  const result = spawnSync("node", ["scripts/inspect-admin-customer-handoff-gate-preflight.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: preflightPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, "customer handoff gate preflight inspection output");
  if (result.status !== 0) {
    throw new Error(`Customer handoff gate preflight inspection failed.\n${output}`);
  }
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertPreflight(preflight) {
  invariant(
    preflight.artifact_kind === "admin_customer_handoff_gate_preflight",
    "Customer handoff gate preflight kind mismatch.",
  );
  invariant(
    preflight.status === "admin_customer_handoff_gate_preflight_prepared",
    "Customer handoff gate preflight status mismatch.",
  );
  invariant(preflight.customer_handoff_gate_preflight_ready === true, "Customer handoff gate preflight must be ready.");
  assertFalse(
    preflight,
    "customer_session_recording_allowed_without_owner",
    "Customer-session recording must require owner presence.",
  );
  assertFalse(preflight, "customer_observed_completion_recorded", "Customer completion must remain blocked.");
  assertFalse(preflight, "customer_observed_handoff_claimed", "Customer handoff claim must remain blocked.");
  assertFalse(preflight, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(preflight, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(preflight, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(preflight, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(preflight, "product_auth_admin_api_allowed", "Product Auth admin API must remain blocked.");
  assertFalse(preflight, "automatic_owner_staff_grants_allowed", "Automatic grants must remain blocked.");
  assertFalse(preflight, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  invariant(preflight.protected_preview_url, "Protected Preview URL required.");
  invariant(preflight.hosted_neon_branch, "Hosted Neon branch required.");
  invariant(preflight.gym_name, "Gym name required.");
  invariant(preflight.owner_email, "Owner email required.");
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
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH ?? DEFAULT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH",
    { mustExist: true },
  );
  const readinessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH ??
      DEFAULT_READINESS_PATH,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH",
  );
  runPreflightInspect(preflightPath.relativePath);
  const { artifact: preflight, sha256: preflightSha256 } = readJsonArtifact(
    preflightPath.resolved,
    "customer handoff gate preflight",
  );
  assertPreflight(preflight);

  const notes = optionalText(
    "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_NOTES",
    "hosted import readiness only; waiting for real customer-observed session record",
    500,
  );

  const readiness = {
    artifact_kind: "admin_customer_session_hosted_import_readiness",
    status: "admin_customer_session_hosted_import_readiness_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_customer_handoff_gate_preflight",
    customer_handoff_gate_preflight_path: preflightPath.relativePath,
    customer_handoff_gate_preflight_sha256: preflightSha256,
    protected_preview_url: preflight.protected_preview_url,
    hosted_neon_branch: preflight.hosted_neon_branch,
    gym_name: preflight.gym_name,
    owner_email: preflight.owner_email,
    owner_label: preflight.owner_label ?? "",
    staff_email: preflight.staff_email,
    notes,
    customer_session_hosted_import_readiness_ready: true,
    customer_session_record_required: true,
    hosted_customer_session_import_allowed_without_record: false,
    hosted_customer_session_proof_allowed_without_record: false,
    customer_observed_completion_recorded: false,
    customer_observed_handoff_claimed: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    required_record_steps: REQUIRED_RECORD_STEPS,
    command_sequence: [
      "npm run admin:customer-handoff:gate-preflight:inspect",
      "npm run admin:customer-session:record",
      "npm run admin:customer-session:inspect",
      "npm run admin:customer-session:record-hosted",
      "npm run hosted:customer-session-record:proof",
    ],
    stop_conditions: [
      "Stop if the real owner-observed customer-session record artifact does not exist.",
      "Stop if the session record inspect command fails.",
      "Stop if hosted Neon branch or protected Preview URL differs from the preflight chain.",
      "Stop if any live-provider, invite delivery, notification, billing, POS, access-control, or member-ledger claim appears.",
    ],
    blocked_gates: BLOCKED_GATES,
    next_batches: NEXT_BATCHES,
  };

  assertNoSecretShapedKeys(readiness, "customer session hosted import readiness");
  mkdirSync(dirname(readinessPath.resolved), { recursive: true });
  writeFileSync(readinessPath.resolved, `${JSON.stringify(readiness, null, 2)}\n`);

  console.log("Admin customer session hosted import readiness prepared");
  console.log(`Artifact: ${readinessPath.relativePath}`);
  console.log("Hosted customer-session import: blocked until record exists");
  console.log("Customer-observed completion: not recorded");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
