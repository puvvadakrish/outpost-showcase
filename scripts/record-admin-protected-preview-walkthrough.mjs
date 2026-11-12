#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-continuous-readiness-batch.json";
const DEFAULT_WALKTHROUGH_PATH =
  "artifacts/admin-launch-readiness/admin-protected-preview-walkthrough.json";

const REQUIRED_OBSERVATIONS = [
  [
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_ADMIN_OBSERVED",
    "admin_portal_observed",
  ],
  [
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_OWNER_OBSERVED",
    "owner_workspace_observed",
  ],
  [
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_STAFF_OBSERVED",
    "staff_workboard_observed",
  ],
  [
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_RESET_ROLLBACK_REVIEWED",
    "reset_rollback_reviewed",
  ],
  [
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_UNEXPECTED_DATA_NOT_OBSERVED",
    "unexpected_data_not_observed",
  ],
  [
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_LIVE_PROVIDER_CLAIMS_BLOCKED",
    "live_provider_claims_blocked",
  ],
  [
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_PUBLIC_SELF_SERVE_BLOCKED",
    "public_self_serve_blocked",
  ],
  [
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_INVITE_DELIVERY_BLOCKED",
    "invite_delivery_blocked",
  ],
  [
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_BILLING_POS_MEMBER_WRITES_BLOCKED",
    "billing_pos_member_writes_blocked",
  ],
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
      "Schedule only when the real gym owner can observe the protected Preview, owner workspace, staff path, reset/rollback checklist, and blocked live-provider claims.",
    id: "customer_observed_handoff_gate",
    state: "pending",
    title: "Customer-observed handoff gate",
  },
  {
    command: "npm run admin:beta-request:followthrough",
    detail:
      "Use the same operator-managed owner/staff access pattern for the next approved gym; no public self-serve or invite delivery.",
    id: "limited_operator_assisted_beta_onboarding",
    state: "blocked",
    title: "Limited operator-assisted beta onboarding",
  },
  {
    command: "npm run admin:public-self-serve:preflight",
    detail:
      "Design and prove public signup separately after real customer handoff evidence is recorded.",
    id: "public_self_serve_preflight",
    state: "blocked",
    title: "Public self-serve preflight",
  },
  {
    command: "Keep live providers, billing, POS, access control, and member-ledger writes blocked until separately proven.",
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

function assertContinuousBatch(batch) {
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
    "Continuous readiness batch must be ready for protected Preview walkthrough.",
  );
  assertFalse(batch, "ready_for_customer_observed_handoff", "Customer handoff readiness must remain blocked before walkthrough.");
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
    assertIncludes(batch.blocked_gates, gate, "continuous batch blocked gates");
  }
}

function requiredYes(envName) {
  const value = String(process.env[envName] ?? "").trim().toLowerCase();
  invariant(
    value === "yes" || value === "true" || value === "1",
    `${envName}=yes is required.`,
  );
  return true;
}

function optionalText(envName, fallback, maxLength) {
  const value = String(process.env[envName] ?? fallback).trim();
  invariant(value && value.length <= maxLength, `${envName} invalid.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function main() {
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH ?? DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const walkthroughPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH ??
      DEFAULT_WALKTHROUGH_PATH,
    "OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH",
  );

  const { artifact: batch, sha256: batchSha256 } = readJsonArtifact(
    batchPath.resolved,
    "continuous readiness batch",
  );
  assertContinuousBatch(batch);

  const observations = Object.fromEntries(
    REQUIRED_OBSERVATIONS.map(([envName, key]) => [key, requiredYes(envName)]),
  );
  const operatorLabel = optionalText(
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_OPERATOR",
    "operator-reviewed-protected-preview",
    140,
  );
  const walkthroughWindow = optionalText(
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_WINDOW",
    "not-recorded",
    160,
  );
  const notes = optionalText(
    "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_NOTES",
    "internal protected Preview walkthrough evidence only",
    500,
  );

  const walkthrough = {
    artifact_kind: "admin_protected_preview_walkthrough",
    status: "admin_protected_preview_walkthrough_recorded",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_continuous_readiness_batch",
    continuous_readiness_batch_path: batchPath.relativePath,
    continuous_readiness_batch_sha256: batchSha256,
    protected_preview_url: batch.protected_preview_url,
    hosted_neon_branch: batch.hosted_neon_branch,
    reviewed_owner_email: batch.reviewed_owner_email,
    staff_email: batch.staff_email,
    operator_label: operatorLabel,
    walkthrough_window: walkthroughWindow,
    notes,
    internal_protected_preview_walkthrough_recorded: true,
    ready_to_schedule_customer_observed_handoff: true,
    customer_observed_completion_recorded: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    observations,
    ready_gates: [
      "Admin portal observed on protected Preview",
      "Owner workspace observed on protected Preview",
      "Staff workboard observed on protected Preview",
      "Reset/rollback checklist reviewed",
      "No unexpected data observed",
      "No live-provider claims observed",
    ],
    blocked_gates: BLOCKED_GATES,
    next_batches: NEXT_BATCHES,
    replay_commands: [
      "npm run admin:readiness-batch:inspect",
      "npm run admin:preview-walkthrough:inspect",
    ],
  };

  assertNoSecretShapedKeys(walkthrough, "protected Preview walkthrough");
  mkdirSync(dirname(walkthroughPath.resolved), { recursive: true });
  writeFileSync(walkthroughPath.resolved, `${JSON.stringify(walkthrough, null, 2)}\n`);

  console.log("Admin protected Preview walkthrough recorded");
  console.log(`Artifact: ${walkthroughPath.relativePath}`);
  console.log("Internal walkthrough: recorded");
  console.log("Customer-observed handoff: not recorded");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
