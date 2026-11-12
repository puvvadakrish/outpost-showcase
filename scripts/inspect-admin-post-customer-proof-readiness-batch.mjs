#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-post-customer-proof-readiness-batch.json";

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

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function main() {
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const { artifact: batch } = readJsonArtifact(
    batchPath.resolved,
    "post customer proof readiness batch",
  );

  invariant(
    batch.artifact_kind === "admin_post_customer_proof_readiness_batch",
    "Post customer proof readiness batch kind mismatch.",
  );
  invariant(
    batch.status === "admin_post_customer_proof_readiness_batch_prepared",
    "Post customer proof readiness batch status mismatch.",
  );
  invariant(
    batch.evidence_basis ===
      "admin_limited_beta_readiness_gate_and_customer_session_record",
    "Post customer proof readiness evidence basis mismatch.",
  );
  invariant(batch.hosted_customer_session_proof_observed === true, "Hosted proof must be observed.");
  invariant(
    batch.limited_operator_assisted_beta_onboarding_ready === true,
    "Limited operator-assisted beta onboarding must be ready.",
  );
  invariant(
    batch.public_self_serve_preflight_ready === true,
    "Public self-serve preflight packaging must be ready.",
  );
  assertFalse(batch, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(batch, "browser_approval_buttons_allowed", "Browser approval buttons must remain blocked.");
  assertFalse(batch, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(batch, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(batch, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(batch, "product_auth_admin_api_allowed", "Product Auth admin API must remain blocked.");
  assertFalse(batch, "automatic_owner_staff_grants_allowed", "Automatic grants must remain blocked.");
  assertFalse(
    batch,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );

  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(batch.blocked_gates, gate, "blocked gates");
  }

  const limitedBetaGatePath = normalizeArtifactPath(
    batch.limited_beta_readiness_gate_path,
    "limited_beta_readiness_gate_path",
    { mustExist: true },
  );
  const customerSessionRecordPath = normalizeArtifactPath(
    batch.customer_session_record_path,
    "customer_session_record_path",
    { mustExist: true },
  );
  const { sha256: limitedBetaGateSha256 } = readJsonArtifact(
    limitedBetaGatePath.resolved,
    "limited beta readiness gate",
  );
  const { sha256: customerSessionRecordSha256 } = readJsonArtifact(
    customerSessionRecordPath.resolved,
    "customer session observed record",
  );
  invariant(
    limitedBetaGateSha256 === batch.limited_beta_readiness_gate_sha256,
    "Limited beta readiness gate SHA256 does not match.",
  );
  invariant(
    customerSessionRecordSha256 === batch.customer_session_record_sha256,
    "Customer session record SHA256 does not match.",
  );
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

  console.log("Admin post-customer-proof readiness batch OK.");
}

main();
