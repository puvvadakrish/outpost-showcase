#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_WALKTHROUGH_PATH =
  "artifacts/admin-launch-readiness/admin-protected-preview-walkthrough.json";

const REQUIRED_OBSERVATION_KEYS = [
  "admin_portal_observed",
  "owner_workspace_observed",
  "staff_workboard_observed",
  "reset_rollback_reviewed",
  "unexpected_data_not_observed",
  "live_provider_claims_blocked",
  "public_self_serve_blocked",
  "invite_delivery_blocked",
  "billing_pos_member_writes_blocked",
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
  invariant(relativePath.startsWith(`artifacts${sep}`), `${label} must be under artifacts/.`);
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
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoSecretShapedKeys(entry, label, [...trail, String(index)]),
    );
    return;
  }
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

function assertParentBatch(batch) {
  invariant(
    batch.artifact_kind === "admin_continuous_readiness_batch",
    "Continuous readiness parent kind mismatch.",
  );
  invariant(
    batch.status === "admin_continuous_readiness_batch_prepared",
    "Continuous readiness parent status mismatch.",
  );
  invariant(
    batch.ready_for_protected_preview_walkthrough === true,
    "Continuous readiness parent must be ready for walkthrough.",
  );
  assertFalse(batch, "ready_for_customer_observed_handoff", "Parent customer handoff readiness must remain blocked.");
  assertFalse(batch, "customer_observed_completion_recorded", "Parent customer completion must remain blocked.");
  assertFalse(batch, "public_self_serve_launch_allowed", "Parent public self-serve must remain blocked.");
  assertFalse(batch, "invite_delivery_allowed", "Parent invite delivery must remain blocked.");
  assertFalse(batch, "notification_sending_allowed", "Parent notifications must remain blocked.");
  assertFalse(batch, "live_provider_enablement_allowed", "Parent live providers must remain blocked.");
  assertFalse(batch, "product_auth_admin_api_allowed", "Parent product Auth admin API must remain blocked.");
  assertFalse(batch, "automatic_owner_staff_grants_allowed", "Parent automatic grants must remain blocked.");
  assertFalse(batch, "billing_pos_member_writes_allowed", "Parent billing/POS/member writes must remain blocked.");
  assertSafeBranch(batch.hosted_neon_branch, "Continuous readiness parent");
  assertHttpsPreview(batch.protected_preview_url, "Continuous readiness parent");
}

function assertWalkthrough(walkthrough) {
  invariant(
    walkthrough.artifact_kind === "admin_protected_preview_walkthrough",
    "Protected Preview walkthrough kind mismatch.",
  );
  invariant(
    walkthrough.status === "admin_protected_preview_walkthrough_recorded",
    "Protected Preview walkthrough status mismatch.",
  );
  invariant(
    walkthrough.evidence_basis === "admin_continuous_readiness_batch",
    "Protected Preview walkthrough evidence basis mismatch.",
  );
  invariant(
    walkthrough.internal_protected_preview_walkthrough_recorded === true,
    "Internal protected Preview walkthrough must be recorded.",
  );
  invariant(
    walkthrough.ready_to_schedule_customer_observed_handoff === true,
    "Customer handoff scheduling readiness required.",
  );
  assertFalse(walkthrough, "customer_observed_completion_recorded", "Customer completion must remain blocked.");
  assertFalse(walkthrough, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(walkthrough, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(walkthrough, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(walkthrough, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(walkthrough, "product_auth_admin_api_allowed", "Product Auth admin API must remain blocked.");
  assertFalse(walkthrough, "automatic_owner_staff_grants_allowed", "Automatic grants must remain blocked.");
  assertFalse(walkthrough, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  assertSafeBranch(walkthrough.hosted_neon_branch, "Protected Preview walkthrough");
  assertHttpsPreview(walkthrough.protected_preview_url, "Protected Preview walkthrough");
  for (const key of REQUIRED_OBSERVATION_KEYS) {
    invariant(walkthrough.observations?.[key] === true, `Observation ${key} must be true.`);
  }
  for (const gate of BLOCKED_GATES) {
    assertIncludes(walkthrough.blocked_gates, gate, "walkthrough blocked gates");
  }
  assertIncludes(
    walkthrough.replay_commands,
    "npm run admin:readiness-batch:inspect",
    "walkthrough replay commands",
  );
  assertIncludes(
    walkthrough.replay_commands,
    "npm run admin:preview-walkthrough:inspect",
    "walkthrough replay commands",
  );
}

function main() {
  const walkthroughPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH ??
      DEFAULT_WALKTHROUGH_PATH,
    "OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH",
  );

  const { artifact: walkthrough } = readJsonArtifact(
    walkthroughPath.resolved,
    "protected Preview walkthrough",
  );
  assertWalkthrough(walkthrough);

  const batchPath = normalizeArtifactPath(
    walkthrough.continuous_readiness_batch_path,
    "continuous readiness parent path",
  );
  const { artifact: batch, sha256: batchSha256 } = readJsonArtifact(
    batchPath.resolved,
    "continuous readiness parent",
  );
  assertParentBatch(batch);
  invariant(
    batchSha256 === walkthrough.continuous_readiness_batch_sha256,
    "Continuous readiness parent SHA mismatch.",
  );
  invariant(
    batch.hosted_neon_branch === walkthrough.hosted_neon_branch,
    "Protected Preview walkthrough branch mismatch.",
  );
  invariant(
    batch.protected_preview_url === walkthrough.protected_preview_url,
    "Protected Preview walkthrough URL mismatch.",
  );

  console.log("Admin protected Preview walkthrough OK");
  console.log(`Artifact: ${walkthroughPath.relativePath}`);
  console.log("Internal protected Preview walkthrough: recorded");
  console.log("Customer-observed handoff: not recorded");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
