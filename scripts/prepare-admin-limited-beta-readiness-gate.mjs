#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_IMPORT_READINESS_PATH =
  "artifacts/admin-launch-readiness/admin-customer-session-hosted-import-readiness.json";
const DEFAULT_GATE_PATH =
  "artifacts/admin-launch-readiness/admin-limited-beta-readiness-gate.json";

const BLOCKED_GATES = [
  "Limited beta onboarding before hosted customer-session proof",
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
      "Still the hard gate: real owner must observe the protected Preview before beta expansion.",
    id: "customer_observed_handoff_gate",
    state: "pending",
    title: "Real customer-observed handoff gate",
  },
  {
    command:
      "npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
    detail:
      "Import and prove customer-session digest after the real session record exists.",
    id: "hosted_customer_session_proof",
    state: "blocked",
    title: "Hosted customer-session proof",
  },
  {
    command: "npm run admin:beta-request:followthrough",
    detail:
      "Use operator-managed access for one approved gym only after customer proof is green.",
    id: "limited_operator_assisted_beta_onboarding",
    state: "blocked",
    title: "Limited operator-assisted beta onboarding",
  },
  {
    command: "npm run admin:public-self-serve:preflight",
    detail:
      "Public self-serve remains blocked until limited beta evidence is reviewed.",
    id: "public_self_serve_preflight",
    state: "blocked",
    title: "Public self-serve preflight",
  },
  {
    command:
      "Keep live providers, billing, POS, access control, member-ledger writes blocked until separately proven.",
    detail:
      "Phone/email providers, notifications, revenue systems, and member-system writes remain outside this gate.",
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

function runImportReadinessInspect(importReadinessPath) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-customer-session-hosted-import-readiness.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH:
          importReadinessPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, "customer session hosted import readiness inspection output");
  if (result.status !== 0) {
    throw new Error(`Customer session hosted import readiness inspection failed.\n${output}`);
  }
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertImportReadiness(readiness) {
  invariant(
    readiness.artifact_kind === "admin_customer_session_hosted_import_readiness",
    "Customer session hosted import readiness kind mismatch.",
  );
  invariant(
    readiness.status === "admin_customer_session_hosted_import_readiness_prepared",
    "Customer session hosted import readiness status mismatch.",
  );
  invariant(readiness.customer_session_record_required === true, "Customer session record must be required.");
  assertFalse(
    readiness,
    "hosted_customer_session_import_allowed_without_record",
    "Hosted customer-session import must remain blocked without record.",
  );
  assertFalse(
    readiness,
    "hosted_customer_session_proof_allowed_without_record",
    "Hosted customer-session proof must remain blocked without record.",
  );
  assertFalse(readiness, "customer_observed_completion_recorded", "Customer completion must remain blocked.");
  assertFalse(readiness, "customer_observed_handoff_claimed", "Customer handoff claim must remain blocked.");
  assertFalse(readiness, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(readiness, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(readiness, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(readiness, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(readiness, "product_auth_admin_api_allowed", "Product Auth admin API must remain blocked.");
  assertFalse(readiness, "automatic_owner_staff_grants_allowed", "Automatic grants must remain blocked.");
  assertFalse(readiness, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  invariant(readiness.gym_name, "Source gym name required.");
  invariant(readiness.owner_email, "Source owner email required.");
  invariant(readiness.protected_preview_url, "Protected Preview URL required.");
  invariant(readiness.hosted_neon_branch, "Hosted Neon branch required.");
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
  const importReadinessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH ??
      DEFAULT_IMPORT_READINESS_PATH,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH",
    { mustExist: true },
  );
  const gatePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH ?? DEFAULT_GATE_PATH,
    "OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH",
  );
  runImportReadinessInspect(importReadinessPath.relativePath);
  const { artifact: importReadiness, sha256: importReadinessSha256 } = readJsonArtifact(
    importReadinessPath.resolved,
    "customer session hosted import readiness",
  );
  assertImportReadiness(importReadiness);

  const candidateGymLabel = optionalText(
    "OUTPOST_ADMIN_LIMITED_BETA_READINESS_CANDIDATE_GYM",
    "Next approved beta gym",
    160,
  );
  const operatorLabel = optionalText(
    "OUTPOST_ADMIN_LIMITED_BETA_READINESS_OPERATOR",
    "Operator",
    140,
  );
  const notes = optionalText(
    "OUTPOST_ADMIN_LIMITED_BETA_READINESS_NOTES",
    "limited beta readiness gate only; waiting for customer-session proof",
    500,
  );

  const gate = {
    artifact_kind: "admin_limited_beta_readiness_gate",
    status: "admin_limited_beta_readiness_gate_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_customer_session_hosted_import_readiness",
    customer_session_hosted_import_readiness_path: importReadinessPath.relativePath,
    customer_session_hosted_import_readiness_sha256: importReadinessSha256,
    protected_preview_url: importReadiness.protected_preview_url,
    hosted_neon_branch: importReadiness.hosted_neon_branch,
    source_gym_name: importReadiness.gym_name,
    source_owner_email: importReadiness.owner_email,
    candidate_gym_label: candidateGymLabel,
    operator_label: operatorLabel,
    notes,
    limited_beta_readiness_gate_ready: true,
    customer_session_proof_required: true,
    limited_beta_onboarding_allowed_without_customer_proof: false,
    public_self_serve_launch_allowed: false,
    browser_approval_buttons_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    operator_managed_access_only: true,
    beta_expansion_checklist: [
      "Confirm real customer-observed session record exists and passes inspect.",
      "Confirm hosted customer-session import and founder-admin proof pass.",
      "Confirm next gym request has human triage and follow-through artifacts.",
      "Use operator-managed owner/staff access only; do not enable public signup.",
      "Keep invite delivery, notifications, providers, billing, POS, access control, and member-ledger writes blocked.",
    ],
    command_sequence: [
      "npm run admin:customer-session:hosted-import-readiness:inspect",
      "npm run admin:customer-session:record-hosted",
      "npm run hosted:customer-session-record:proof",
      "npm run admin:beta-request:followthrough",
    ],
    blocked_gates: BLOCKED_GATES,
    next_batches: NEXT_BATCHES,
  };

  assertNoSecretShapedKeys(gate, "limited beta readiness gate");
  mkdirSync(dirname(gatePath.resolved), { recursive: true });
  writeFileSync(gatePath.resolved, `${JSON.stringify(gate, null, 2)}\n`);

  console.log("Admin limited beta readiness gate prepared");
  console.log(`Artifact: ${gatePath.relativePath}`);
  console.log("Limited beta onboarding: blocked until hosted customer-session proof exists");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
