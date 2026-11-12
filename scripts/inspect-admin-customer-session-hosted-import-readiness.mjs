#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_READINESS_PATH =
  "artifacts/admin-launch-readiness/admin-customer-session-hosted-import-readiness.json";

const REQUIRED_RECORD_STEPS = [
  "admin:customer-session:record",
  "admin:customer-session:inspect",
  "admin:customer-session:record-hosted",
  "hosted:customer-session-record:proof",
];

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

function normalizeArtifactPath(value, label) {
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
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
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

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function assertReadiness(readiness) {
  invariant(
    readiness.artifact_kind === "admin_customer_session_hosted_import_readiness",
    "Customer session hosted import readiness kind mismatch.",
  );
  invariant(
    readiness.status === "admin_customer_session_hosted_import_readiness_prepared",
    "Customer session hosted import readiness status mismatch.",
  );
  invariant(
    readiness.evidence_basis === "admin_customer_handoff_gate_preflight",
    "Customer session hosted import readiness evidence basis mismatch.",
  );
  invariant(
    readiness.customer_session_hosted_import_readiness_ready === true,
    "Customer session hosted import readiness must be ready.",
  );
  invariant(readiness.customer_session_record_required === true, "Customer session record must be required.");
  assertFalse(
    readiness,
    "hosted_customer_session_import_allowed_without_record",
    "Hosted import without customer record must remain blocked.",
  );
  assertFalse(
    readiness,
    "hosted_customer_session_proof_allowed_without_record",
    "Hosted proof without customer record must remain blocked.",
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
  invariant(readiness.protected_preview_url, "Protected Preview URL required.");
  invariant(readiness.hosted_neon_branch, "Hosted Neon branch required.");
  invariant(readiness.gym_name, "Gym name required.");
  invariant(readiness.owner_email, "Owner email required.");
  for (const step of REQUIRED_RECORD_STEPS) {
    assertIncludes(readiness.required_record_steps, step, "required record steps");
    assertIncludes(readiness.command_sequence, `npm run ${step}`, "command sequence");
  }
  for (const gate of BLOCKED_GATES) {
    assertIncludes(readiness.blocked_gates, gate, "blocked gates");
  }
  assertIncludes(
    readiness.stop_conditions,
    "Stop if the real owner-observed customer-session record artifact does not exist.",
    "stop conditions",
  );
}

function main() {
  const readinessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH ??
      DEFAULT_READINESS_PATH,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH",
  );
  const { artifact: readiness } = readJsonArtifact(
    readinessPath.resolved,
    "customer session hosted import readiness",
  );
  assertReadiness(readiness);

  const preflightPath = normalizeArtifactPath(
    readiness.customer_handoff_gate_preflight_path,
    "customer handoff gate preflight parent path",
  );
  const { artifact: preflight, sha256: preflightSha256 } = readJsonArtifact(
    preflightPath.resolved,
    "customer handoff gate preflight parent",
  );
  runPreflightInspect(preflightPath.relativePath);
  invariant(
    preflightSha256 === readiness.customer_handoff_gate_preflight_sha256,
    "Customer handoff gate preflight parent SHA mismatch.",
  );
  invariant(
    preflight.protected_preview_url === readiness.protected_preview_url,
    "Hosted import readiness Preview URL mismatch.",
  );
  invariant(
    preflight.hosted_neon_branch === readiness.hosted_neon_branch,
    "Hosted import readiness branch mismatch.",
  );
  invariant(preflight.owner_email === readiness.owner_email, "Hosted import readiness owner email mismatch.");
  invariant(preflight.gym_name === readiness.gym_name, "Hosted import readiness gym name mismatch.");
  invariant(preflight.staff_email === readiness.staff_email, "Hosted import readiness staff email mismatch.");

  console.log("Admin customer session hosted import readiness OK");
  console.log(`Artifact: ${readinessPath.relativePath}`);
  console.log("Hosted customer-session import: blocked until record exists");
  console.log("Customer-observed completion: not recorded");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
