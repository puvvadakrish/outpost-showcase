#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_WALKTHROUGH_PATH =
  "artifacts/admin-launch-readiness/admin-protected-preview-walkthrough.json";
const DEFAULT_SCHEDULING_PATH =
  "artifacts/admin-launch-readiness/admin-customer-handoff-scheduling-batch.json";

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

const NEXT_BATCHES = [
  {
    command: "npm run admin:customer-session:record",
    detail:
      "Run only during the real owner-observed session after the owner sees protected Preview, owner workspace, staff path, reset/rollback checklist, and blocked live-provider claims.",
    id: "customer_observed_handoff_gate",
    state: "pending",
    title: "Customer-observed handoff gate",
  },
  {
    command: "npm run admin:beta-request:followthrough",
    detail:
      "Use the same operator-managed access path for the next approved gym; still no public self-serve or invite delivery.",
    id: "limited_operator_assisted_beta_onboarding",
    state: "blocked",
    title: "Limited operator-assisted beta onboarding",
  },
  {
    command: "npm run admin:public-self-serve:preflight",
    detail:
      "Only design public owner signup after customer-observed handoff and operator-assisted onboarding evidence are green.",
    id: "public_self_serve_preflight",
    state: "blocked",
    title: "Public self-serve preflight",
  },
  {
    command:
      "Keep live providers, billing, POS, access control, and member-ledger writes blocked until separately proven.",
    detail:
      "Phone/email providers, notifications, revenue systems, and member-system writes remain outside this scheduling batch.",
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
    walkthrough.ready_to_schedule_customer_observed_handoff === true,
    "Protected Preview walkthrough must be ready to schedule customer handoff.",
  );
  invariant(
    walkthrough.internal_protected_preview_walkthrough_recorded === true,
    "Internal protected Preview walkthrough must be recorded.",
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
    assertIncludes(walkthrough.blocked_gates, gate, "protected Preview walkthrough blocked gates");
  }
}

function requiredText(envName, maxLength) {
  const value = String(process.env[envName] ?? "").trim();
  invariant(value && value.length <= maxLength, `${envName} required.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function optionalText(envName, fallback, maxLength) {
  const value = String(process.env[envName] ?? fallback).trim();
  invariant(value.length <= maxLength, `${envName} invalid.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function main() {
  const walkthroughPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH ??
      DEFAULT_WALKTHROUGH_PATH,
    "OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH",
    { mustExist: true },
  );
  const schedulingPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH ??
      DEFAULT_SCHEDULING_PATH,
    "OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH",
  );

  const { artifact: walkthrough, sha256: walkthroughSha256 } = readJsonArtifact(
    walkthroughPath.resolved,
    "protected Preview walkthrough",
  );
  assertWalkthrough(walkthrough);

  const gymName = requiredText("OUTPOST_ADMIN_CUSTOMER_HANDOFF_GYM_NAME", 160);
  const operatorLabel = requiredText("OUTPOST_ADMIN_CUSTOMER_HANDOFF_OPERATOR", 140);
  const supportWindow = requiredText("OUTPOST_ADMIN_CUSTOMER_HANDOFF_SUPPORT_WINDOW", 180);
  const ownerLabel = optionalText("OUTPOST_ADMIN_CUSTOMER_HANDOFF_OWNER_LABEL", "", 140);
  const notes = optionalText(
    "OUTPOST_ADMIN_CUSTOMER_HANDOFF_NOTES",
    "customer scheduling packet only; no customer-observed completion recorded",
    500,
  );

  const scheduling = {
    artifact_kind: "admin_customer_handoff_scheduling_batch",
    status: "admin_customer_handoff_scheduling_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_protected_preview_walkthrough",
    protected_preview_walkthrough_path: walkthroughPath.relativePath,
    protected_preview_walkthrough_sha256: walkthroughSha256,
    protected_preview_url: walkthrough.protected_preview_url,
    hosted_neon_branch: walkthrough.hosted_neon_branch,
    gym_name: gymName,
    owner_email: walkthrough.reviewed_owner_email,
    owner_label: ownerLabel,
    staff_email: walkthrough.staff_email,
    operator_label: operatorLabel,
    support_window: supportWindow,
    notes,
    customer_handoff_scheduling_ready: true,
    customer_observed_completion_recorded: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    customer_session_agenda: [
      "Confirm the protected Preview URL and expected gym tenant with the owner.",
      "Walk through the owner workspace and current beta readiness state.",
      "Walk through the staff workboard and owner-to-staff handoff path.",
      "Review reset/rollback checklist before and after the session.",
      "Confirm no unexpected data, live-provider claims, invite delivery, billing, POS, access control, or member-ledger writes are present.",
    ],
    support_checklist: [
      "Use operator-managed access details shared outside this artifact.",
      "Stop the handoff if the owner sees unexpected tenant data or live-provider claims.",
      "Do not record customer-observed completion until the owner completes the session.",
      "Retain the reset/rollback path before reusing the hosted proof branch.",
    ],
    blocked_gates: BLOCKED_GATES,
    next_batches: NEXT_BATCHES,
    replay_commands: [
      "npm run admin:preview-walkthrough:inspect",
      "npm run admin:customer-handoff:schedule:inspect",
    ],
  };

  assertNoSecretShapedKeys(scheduling, "customer handoff scheduling batch");
  mkdirSync(dirname(schedulingPath.resolved), { recursive: true });
  writeFileSync(schedulingPath.resolved, `${JSON.stringify(scheduling, null, 2)}\n`);

  console.log("Admin customer handoff scheduling batch prepared");
  console.log(`Artifact: ${schedulingPath.relativePath}`);
  console.log("Customer handoff scheduling: ready");
  console.log("Customer-observed completion: not recorded");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
