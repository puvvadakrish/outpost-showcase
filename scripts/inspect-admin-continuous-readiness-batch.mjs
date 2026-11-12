#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-continuous-readiness-batch.json";

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

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeArtifactPath(value, label) {
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
  invariant(relativePath.startsWith(`artifacts${sep}`), `${label} must under artifacts/.`);
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
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

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (!value || typeof value !== "object") return;
  for (const [key, nestedValue] of Object.entries(value)) {
    const path = [...trail, key].join(".");
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("privatekey") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("signature") ||
      normalizedKey.includes("jwt");
    invariant(!secretKey, `${label} contains secret-shaped key: ${path}`);
    assertNoSecretShapedValue(nestedValue, `${label}.${path}`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
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

function assertBatch(batch) {
  invariant(
    batch.artifact_kind === "admin_continuous_readiness_batch",
    "Continuous readiness batch kind mismatch.",
  );
  invariant(
    batch.status === "admin_continuous_readiness_batch_prepared",
    "Continuous readiness batch status mismatch.",
  );
  invariant(
    batch.ready_for_protected_preview_walkthrough === true,
    "Protected Preview walkthrough readiness required.",
  );
  assertFalse(batch, "ready_for_customer_observed_handoff", "Customer handoff readiness must remain blocked.");
  assertFalse(batch, "customer_observed_completion_recorded", "Customer completion must remain blocked.");
  assertFalse(batch, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(batch, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(batch, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(batch, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(batch, "product_auth_admin_api_allowed", "Product Auth admin API must remain blocked.");
  assertFalse(batch, "automatic_owner_staff_grants_allowed", "Automatic grants must remain blocked.");
  assertFalse(batch, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  assertSafeBranch(batch.hosted_neon_branch, "Continuous readiness batch");
  assertHttpsPreview(batch.protected_preview_url, "Continuous readiness batch");
  for (const gate of BLOCKED_GATES) {
    assertIncludes(batch.blocked_gates, gate, "blocked gates");
  }
  assertIncludes(batch.replay_commands, "npm run admin:readiness-batch:inspect", "replay commands");
}

function main() {
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH ?? DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH",
  );
  const { artifact: batch } = readJsonArtifact(batchPath.resolved, "continuous readiness batch");
  assertBatch(batch);

  const handoffProofPath = normalizeArtifactPath(
    batch.handoff_proof_bundle_path,
    "handoff proof bundle parent path",
  );
  const { artifact: handoffProof, sha256: handoffProofSha256 } = readJsonArtifact(
    handoffProofPath.resolved,
    "handoff proof bundle parent",
  );
  invariant(
    handoffProof.artifact_kind === "admin_handoff_proof_bundle",
    "Handoff proof bundle parent kind mismatch.",
  );
  invariant(
    handoffProofSha256 === batch.handoff_proof_bundle_sha256,
    "Handoff proof bundle parent SHA mismatch.",
  );
  invariant(
    handoffProof.hosted_neon_branch === batch.hosted_neon_branch,
    "Handoff proof branch mismatch.",
  );
invariant(
  handoffProof.protected_preview_url === batch.protected_preview_url,
  "Handoff proof Preview URL mismatch.",
);
assertFalse(
  handoffProof,
  "customer_observed_completion_recorded",
  "Parent customer completion must remain blocked.",
);
assertFalse(
  handoffProof,
  "public_self_serve_launch_allowed",
  "Parent public self-serve must remain blocked.",
);
assertFalse(
  handoffProof,
  "invite_delivery_allowed",
  "Parent invite delivery must remain blocked.",
);
assertFalse(
  handoffProof,
  "notification_sending_allowed",
  "Parent notifications must remain blocked.",
);
assertFalse(
  handoffProof,
  "live_provider_enablement_allowed",
  "Parent live providers must remain blocked.",
);
assertFalse(
  handoffProof,
  "product_auth_admin_api_allowed",
  "Parent product Auth admin API must remain blocked.",
);
assertFalse(
  handoffProof,
  "automatic_owner_staff_grants_allowed",
  "Parent automatic grants must remain blocked.",
);
assertFalse(
  handoffProof,
  "billing_pos_member_writes_allowed",
  "Parent billing/POS/member writes must remain blocked.",
);

const readinessPath = normalizeArtifactPath(
    batch.handoff_readiness_packet_path,
    "handoff readiness parent path",
  );
  const { artifact: readiness, sha256: readinessSha256 } = readJsonArtifact(
    readinessPath.resolved,
    "handoff readiness parent",
  );
  invariant(
    readiness.artifact_kind === "admin_handoff_readiness_packet",
    "Handoff readiness parent kind mismatch.",
  );
  invariant(
    readinessSha256 === batch.handoff_readiness_packet_sha256,
    "Handoff readiness parent SHA mismatch.",
  );
  invariant(
    readiness.neon_branch_name === batch.hosted_neon_branch,
    "Handoff readiness branch mismatch.",
  );
  invariant(
    readiness.preview_url === batch.protected_preview_url,
    "Handoff readiness Preview URL mismatch.",
  );
  assertFalse(readiness, "public_self_serve_launch_allowed", "Parent public self-serve must remain blocked.");
  assertFalse(readiness, "live_provider_enablement_allowed", "Parent live providers must remain blocked.");

  console.log("Admin continuous readiness batch OK");
  console.log(`Artifact: ${batchPath.relativePath}`);
  console.log("Protected Preview walkthrough: ready");
  console.log("Customer-observed handoff: blocked");
  console.log("Public self-serve/live-provider gates: blocked");
}

main();
