#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-customer-handoff-gate-preflight.json";

const REQUIRED_CUSTOMER_OBSERVATIONS = [
  "owner_present",
  "protected_preview_observed",
  "owner_workspace_observed",
  "staff_handoff_path_observed",
  "reset_rollback_reviewed",
  "unexpected_data_not_observed",
  "live_provider_claims_not_observed",
  "invite_delivery_not_observed",
  "billing_pos_member_writes_not_observed",
];

const REQUIRED_CUSTOMER_SESSION_ENV_NAMES = [
  "OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT",
  "OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED",
  "OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_WORKSPACE_OBSERVED",
  "OUTPOST_ADMIN_CUSTOMER_SESSION_STAFF_HANDOFF_OBSERVED",
  "OUTPOST_ADMIN_CUSTOMER_SESSION_RESET_ROLLBACK_REVIEWED",
  "OUTPOST_ADMIN_CUSTOMER_SESSION_UNEXPECTED_DATA_NOT_OBSERVED",
  "OUTPOST_ADMIN_CUSTOMER_SESSION_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED",
  "OUTPOST_ADMIN_CUSTOMER_SESSION_INVITE_DELIVERY_NOT_OBSERVED",
  "OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED",
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

function assertScheduling(scheduling) {
  invariant(
    scheduling.artifact_kind === "admin_customer_handoff_scheduling_batch",
    "Customer handoff scheduling batch kind mismatch.",
  );
  invariant(
    scheduling.status === "admin_customer_handoff_scheduling_batch_prepared",
    "Customer handoff scheduling batch status mismatch.",
  );
  invariant(scheduling.customer_handoff_scheduling_ready === true, "Scheduling batch must be ready.");
  assertFalse(scheduling, "customer_observed_completion_recorded", "Parent customer completion must remain blocked.");
  assertFalse(scheduling, "public_self_serve_launch_allowed", "Parent public self-serve must remain blocked.");
  assertFalse(scheduling, "invite_delivery_allowed", "Parent invite delivery must remain blocked.");
  assertFalse(scheduling, "notification_sending_allowed", "Parent notifications must remain blocked.");
  assertFalse(scheduling, "live_provider_enablement_allowed", "Parent live providers must remain blocked.");
  assertFalse(scheduling, "product_auth_admin_api_allowed", "Parent product Auth admin API must remain blocked.");
  assertFalse(scheduling, "automatic_owner_staff_grants_allowed", "Parent automatic grants must remain blocked.");
  assertFalse(scheduling, "billing_pos_member_writes_allowed", "Parent billing/POS/member writes must remain blocked.");
  assertSafeBranch(scheduling.hosted_neon_branch, "Customer handoff scheduling batch");
  assertHttpsPreview(scheduling.protected_preview_url, "Customer handoff scheduling batch");
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
  invariant(preflight.evidence_basis === "admin_customer_handoff_scheduling_batch", "Preflight evidence basis mismatch.");
  invariant(preflight.customer_handoff_gate_preflight_ready === true, "Preflight must be ready.");
  assertFalse(
    preflight,
    "customer_session_recording_allowed_without_owner",
    "Customer recording must require real owner presence.",
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
  assertSafeBranch(preflight.hosted_neon_branch, "Customer handoff gate preflight");
  assertHttpsPreview(preflight.protected_preview_url, "Customer handoff gate preflight");
  invariant(preflight.gym_name, "Preflight gym name required.");
  invariant(preflight.owner_email, "Preflight owner email required.");
  for (const observation of REQUIRED_CUSTOMER_OBSERVATIONS) {
    assertIncludes(preflight.required_customer_observations, observation, "required customer observations");
  }
  for (const envName of REQUIRED_CUSTOMER_SESSION_ENV_NAMES) {
    invariant(
      String(preflight.record_command_template).includes(envName),
      `Record command template missing ${envName}.`,
    );
  }
  for (const gate of BLOCKED_GATES) {
    assertIncludes(preflight.blocked_gates, gate, "preflight blocked gates");
  }
  assertIncludes(preflight.customer_stop_conditions, "Stop if the real owner is not present.", "stop conditions");
  assertIncludes(preflight.replay_commands, "npm run admin:customer-handoff:schedule:inspect", "replay commands");
  assertIncludes(preflight.replay_commands, "npm run admin:customer-handoff:gate-preflight:inspect", "replay commands");
  invariant(
    String(preflight.record_command_template).includes("npm run admin:customer-session:record"),
    "Record command template missing customer-session record command.",
  );
  invariant(
    String(preflight.inspect_command_template).includes("npm run admin:customer-session:inspect"),
    "Inspect command template missing customer-session inspect command.",
  );
}

function main() {
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH ?? DEFAULT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH",
  );
  const { artifact: preflight } = readJsonArtifact(
    preflightPath.resolved,
    "customer handoff gate preflight",
  );
  assertPreflight(preflight);

  const schedulingPath = normalizeArtifactPath(
    preflight.customer_handoff_scheduling_batch_path,
    "customer handoff scheduling parent path",
  );
  const { artifact: scheduling, sha256: schedulingSha256 } = readJsonArtifact(
    schedulingPath.resolved,
    "customer handoff scheduling parent",
  );
  assertScheduling(scheduling);
  invariant(
    schedulingSha256 === preflight.customer_handoff_scheduling_batch_sha256,
    "Customer handoff scheduling parent SHA mismatch.",
  );
  invariant(
    scheduling.protected_preview_url === preflight.protected_preview_url,
    "Customer handoff gate preflight Preview URL mismatch.",
  );
  invariant(
    scheduling.hosted_neon_branch === preflight.hosted_neon_branch,
    "Customer handoff gate preflight branch mismatch.",
  );
  invariant(
    scheduling.owner_email === preflight.owner_email,
    "Customer handoff gate preflight owner email mismatch.",
  );

  console.log("Admin customer handoff gate preflight OK");
  console.log(`Artifact: ${preflightPath.relativePath}`);
  console.log("Customer gate preflight: ready");
  console.log("Customer-observed completion: not recorded");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
