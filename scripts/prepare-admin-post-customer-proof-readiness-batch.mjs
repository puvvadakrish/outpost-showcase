#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_LIMITED_BETA_GATE_PATH =
  "artifacts/admin-launch-readiness/admin-limited-beta-readiness-gate.json";
const DEFAULT_CUSTOMER_SESSION_RECORD_PATH =
  "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json";
const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-post-customer-proof-readiness-batch.json";

const BLOCKED_GATES = [
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
    command: "npm run admin:beta-request:triage-packet && npm run admin:beta-request:followthrough",
    detail:
      "Run one approved-gym operator-managed beta onboarding path after hosted proof review.",
    id: "limited_operator_assisted_beta_onboarding",
    state: "pending",
    title: "Limited operator-assisted beta onboarding",
  },
  {
    command: "npm run admin:public-self-serve:preflight && npm run admin:public-self-serve:inspect",
    detail:
      "Package public self-serve prerequisites after limited beta evidence; launch remains blocked.",
    id: "public_self_serve_preflight",
    state: "blocked",
    title: "Public self-serve preflight",
  },
  {
    command:
      "Keep phone/email providers, notifications, billing, POS, access control, member-ledger writes blocked until separately proven.",
    detail:
      "Live provider and revenue/member-system work needs separate proof, review, and customer approval.",
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
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(
      value,
    ) ||
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
  assertNoSecretShapedValue(value, label);
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
    `${label} must stay under artifacts/.`,
  );
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  }
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, label);
  const artifact = JSON.parse(source);
  assertNoSecretShapedKeys(artifact, label);
  return {
    artifact,
    sha256: createHash("sha256").update(source).digest("hex"),
  };
}

function runInspector(script, label, env) {
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, `${label} output`);
  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertLimitedBetaGate(gate) {
  invariant(
    gate.artifact_kind === "admin_limited_beta_readiness_gate",
    "Limited beta readiness gate kind mismatch.",
  );
  invariant(
    gate.status === "admin_limited_beta_readiness_gate_prepared",
    "Limited beta readiness gate status mismatch.",
  );
  invariant(gate.customer_session_proof_required === true, "Customer proof must be required.");
  assertFalse(
    gate,
    "limited_beta_onboarding_allowed_without_customer_proof",
    "Limited beta onboarding without proof must remain blocked.",
  );
  assertFalse(gate, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(gate, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(gate, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(gate, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(gate, "product_auth_admin_api_allowed", "Product Auth admin API must remain blocked.");
  assertFalse(gate, "automatic_owner_staff_grants_allowed", "Automatic grants must remain blocked.");
  assertFalse(
    gate,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );
}

function assertCustomerSessionRecord(record) {
  invariant(
    record.artifact_kind === "admin_customer_observed_session_record",
    "Customer session record kind mismatch.",
  );
  invariant(
    record.status === "admin_customer_observed_session_recorded",
    "Customer session record status mismatch.",
  );
  invariant(
    record.customer_observed_session_recorded === true,
    "Customer session must be observed.",
  );
  invariant(
    record.customer_observed_handoff_claimed === true,
    "Customer handoff claim must be explicit.",
  );
  const participantText = [
    record.gym_name,
    record.owner_email,
    record.owner_label,
    record.operator_label,
  ]
    .filter(Boolean)
    .join(" ");
  invariant(
    !/\b(dry[-\s]?run|internal|sample|fixture|fake)\b/iu.test(participantText),
    "Customer session record must not use internal, fixture, or dry-run participant labels.",
  );
  assertFalse(record, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(record, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(record, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(record, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(
    record,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );
}

function assertParentAgreement(gate, record) {
  if (record.hosted_neon_branch || record.neon_branch_name) {
    invariant(
      gate.hosted_neon_branch === record.hosted_neon_branch ||
        gate.hosted_neon_branch === record.neon_branch_name,
      "Hosted Neon branch mismatch between limited beta gate and customer session record.",
    );
  }
  if (record.protected_preview_url || record.app_origin) {
    invariant(
      gate.protected_preview_url === record.protected_preview_url ||
        gate.protected_preview_url === record.app_origin,
      "Protected Preview URL mismatch between limited beta gate and customer session record.",
    );
  }
  invariant(
    String(gate.source_owner_email).toLowerCase() ===
      String(record.owner_email).toLowerCase(),
    "Owner email mismatch between limited beta gate and customer session record.",
  );
}

function requireYes(envName) {
  invariant(process.env[envName] === "yes", `${envName}=yes is required.`);
}

function main() {
  const limitedBetaGatePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH ??
      DEFAULT_LIMITED_BETA_GATE_PATH,
    "OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH",
    { mustExist: true },
  );
  const customerSessionRecordPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH ??
      DEFAULT_CUSTOMER_SESSION_RECORD_PATH,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    { mustExist: true },
  );
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH",
  );
  invariant(
    !existsSync(batchPath.resolved),
    "OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH already exists.",
  );
  requireYes("OUTPOST_ADMIN_POST_CUSTOMER_PROOF_HOSTED_PROOF_OBSERVED");

  runInspector(
    "scripts/inspect-admin-limited-beta-readiness-gate.mjs",
    "Limited beta readiness gate inspection",
    {
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH:
        limitedBetaGatePath.relativePath,
    },
  );
  runInspector(
    "scripts/inspect-admin-customer-observed-session.mjs",
    "Customer session record inspection",
    {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH:
        customerSessionRecordPath.relativePath,
    },
  );

  const { artifact: limitedBetaGate, sha256: limitedBetaGateSha256 } =
    readJsonArtifact(limitedBetaGatePath.resolved, "limited beta readiness gate");
  const { artifact: customerSessionRecord, sha256: customerSessionRecordSha256 } =
    readJsonArtifact(
      customerSessionRecordPath.resolved,
      "customer session observed record",
    );

  assertLimitedBetaGate(limitedBetaGate);
  assertCustomerSessionRecord(customerSessionRecord);
  assertParentAgreement(limitedBetaGate, customerSessionRecord);

  const batch = {
    artifact_kind: "admin_post_customer_proof_readiness_batch",
    status: "admin_post_customer_proof_readiness_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_limited_beta_readiness_gate_and_customer_session_record",
    limited_beta_readiness_gate_path: limitedBetaGatePath.relativePath,
    limited_beta_readiness_gate_sha256: limitedBetaGateSha256,
    customer_session_record_path: customerSessionRecordPath.relativePath,
    customer_session_record_sha256: customerSessionRecordSha256,
    protected_preview_url:
      customerSessionRecord.protected_preview_url ??
      customerSessionRecord.app_origin ??
      limitedBetaGate.protected_preview_url,
    hosted_neon_branch:
      customerSessionRecord.hosted_neon_branch ??
      customerSessionRecord.neon_branch_name ??
      limitedBetaGate.hosted_neon_branch,
    gym_name: customerSessionRecord.gym_name,
    owner_email: customerSessionRecord.owner_email,
    operator_label: customerSessionRecord.operator_label,
    hosted_customer_session_proof_observed: true,
    limited_operator_assisted_beta_onboarding_ready: true,
    public_self_serve_preflight_ready: true,
    public_self_serve_launch_allowed: false,
    browser_approval_buttons_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: BLOCKED_GATES,
    next_batches: NEXT_BATCHES,
    operator_checklist: [
      "Review hosted customer-session proof output before onboarding the next approved gym.",
      "Use operator-managed owner access and staff roster claim only.",
      "Run reset/rollback checklist before reusing hosted proof data.",
      "Keep public self-serve, invite delivery, providers, notifications, and billing/POS/member writes blocked.",
    ],
  };

  assertNoSecretShapedKeys(batch, "post customer proof readiness batch");
  mkdirSync(dirname(batchPath.resolved), { recursive: true });
  writeFileSync(batchPath.resolved, `${JSON.stringify(batch, null, 2)}\n`);
  console.log(`Admin post-customer-proof readiness batch: ${batchPath.relativePath}`);
  console.log("Limited operator-assisted beta onboarding: ready for operator review");
  console.log("Public self-serve and live-provider/revenue gates: blocked");
}

main();
