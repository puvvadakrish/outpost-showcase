#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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
  assertFalse(walkthrough, "customer_observed_completion_recorded", "Parent customer completion must remain blocked.");
  assertFalse(walkthrough, "public_self_serve_launch_allowed", "Parent public self-serve must remain blocked.");
  assertFalse(walkthrough, "invite_delivery_allowed", "Parent invite delivery must remain blocked.");
  assertFalse(walkthrough, "notification_sending_allowed", "Parent notifications must remain blocked.");
  assertFalse(walkthrough, "live_provider_enablement_allowed", "Parent live providers must remain blocked.");
  assertFalse(walkthrough, "product_auth_admin_api_allowed", "Parent product Auth admin API must remain blocked.");
  assertFalse(walkthrough, "automatic_owner_staff_grants_allowed", "Parent automatic grants must remain blocked.");
  assertFalse(walkthrough, "billing_pos_member_writes_allowed", "Parent billing/POS/member writes must remain blocked.");
  assertSafeBranch(walkthrough.hosted_neon_branch, "Protected Preview walkthrough");
  assertHttpsPreview(walkthrough.protected_preview_url, "Protected Preview walkthrough");
  for (const key of REQUIRED_OBSERVATION_KEYS) {
    invariant(walkthrough.observations?.[key] === true, `Observation ${key} must be true.`);
  }
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
  invariant(
    scheduling.evidence_basis === "admin_protected_preview_walkthrough",
    "Customer handoff scheduling evidence basis mismatch.",
  );
  invariant(
    scheduling.customer_handoff_scheduling_ready === true,
    "Customer handoff scheduling must be ready.",
  );
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
  invariant(scheduling.gym_name, "Gym name is required.");
  invariant(scheduling.owner_email, "Owner email is required.");
  invariant(scheduling.operator_label, "Operator label is required.");
  invariant(scheduling.support_window, "Support window is required.");
  invariant(Array.isArray(scheduling.customer_session_agenda) && scheduling.customer_session_agenda.length >= 5, "Customer session agenda is incomplete.");
  invariant(Array.isArray(scheduling.support_checklist) && scheduling.support_checklist.length >= 4, "Support checklist is incomplete.");
  assertIncludes(scheduling.customer_session_agenda, "Walk through the owner workspace and current beta readiness state.", "customer session agenda");
  assertIncludes(scheduling.support_checklist, "Do not record customer-observed completion until the owner completes the session.", "support checklist");
  for (const gate of BLOCKED_GATES) {
    assertIncludes(scheduling.blocked_gates, gate, "scheduling blocked gates");
  }
  assertIncludes(scheduling.replay_commands, "npm run admin:preview-walkthrough:inspect", "scheduling replay commands");
  assertIncludes(scheduling.replay_commands, "npm run admin:customer-handoff:schedule:inspect", "scheduling replay commands");
}

function main() {
  const schedulingPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH ??
      DEFAULT_SCHEDULING_PATH,
    "OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH",
  );

  const { artifact: scheduling } = readJsonArtifact(
    schedulingPath.resolved,
    "customer handoff scheduling batch",
  );
  assertScheduling(scheduling);

  const walkthroughPath = normalizeArtifactPath(
    scheduling.protected_preview_walkthrough_path,
    "protected Preview walkthrough parent path",
  );
  const { artifact: walkthrough, sha256: walkthroughSha256 } = readJsonArtifact(
    walkthroughPath.resolved,
    "protected Preview walkthrough parent",
  );
  assertWalkthrough(walkthrough);
  invariant(
    walkthroughSha256 === scheduling.protected_preview_walkthrough_sha256,
    "Protected Preview walkthrough parent SHA mismatch.",
  );
  invariant(
    walkthrough.protected_preview_url === scheduling.protected_preview_url,
    "Customer handoff scheduling Preview URL mismatch.",
  );
  invariant(
    walkthrough.hosted_neon_branch === scheduling.hosted_neon_branch,
    "Customer handoff scheduling branch mismatch.",
  );
  invariant(
    walkthrough.reviewed_owner_email === scheduling.owner_email,
    "Customer handoff scheduling owner email mismatch.",
  );

  console.log("Admin customer handoff scheduling batch OK");
  console.log(`Artifact: ${schedulingPath.relativePath}`);
  console.log("Customer handoff scheduling: ready");
  console.log("Customer-observed completion: not recorded");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
