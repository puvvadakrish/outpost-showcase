#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function assertGate(gate) {
  invariant(
    gate.artifact_kind === "admin_limited_beta_readiness_gate",
    "Limited beta readiness gate kind mismatch.",
  );
  invariant(
    gate.status === "admin_limited_beta_readiness_gate_prepared",
    "Limited beta readiness gate status mismatch.",
  );
  invariant(gate.evidence_basis === "admin_customer_session_hosted_import_readiness", "Limited beta readiness evidence basis mismatch.");
  invariant(gate.limited_beta_readiness_gate_ready === true, "Limited beta readiness gate must be ready.");
  invariant(gate.customer_session_proof_required === true, "Customer-session proof must be required.");
  assertFalse(
    gate,
    "limited_beta_onboarding_allowed_without_customer_proof",
    "Limited beta onboarding without customer proof must remain blocked.",
  );
  assertFalse(gate, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(gate, "browser_approval_buttons_allowed", "Browser approval buttons must remain blocked.");
  assertFalse(gate, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(gate, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(gate, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(gate, "product_auth_admin_api_allowed", "Product Auth admin API must remain blocked.");
  assertFalse(gate, "automatic_owner_staff_grants_allowed", "Automatic grants must remain blocked.");
  assertFalse(gate, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  invariant(gate.operator_managed_access_only === true, "Operator-managed access must be required.");
  invariant(gate.source_gym_name, "Source gym name required.");
  invariant(gate.source_owner_email, "Source owner email required.");
  invariant(gate.candidate_gym_label, "Candidate gym label required.");
  invariant(Array.isArray(gate.beta_expansion_checklist) && gate.beta_expansion_checklist.length >= 5, "Beta expansion checklist incomplete.");
  for (const gateLabel of BLOCKED_GATES) {
    assertIncludes(gate.blocked_gates, gateLabel, "blocked gates");
  }
  assertIncludes(gate.command_sequence, "npm run admin:beta-request:followthrough", "command sequence");
}

function main() {
  const gatePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH ?? DEFAULT_GATE_PATH,
    "OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH",
  );
  const { artifact: gate } = readJsonArtifact(gatePath.resolved, "limited beta readiness gate");
  assertGate(gate);

  const importReadinessPath = normalizeArtifactPath(
    gate.customer_session_hosted_import_readiness_path,
    "customer session hosted import readiness parent path",
  );
  const { artifact: importReadiness, sha256: importReadinessSha256 } = readJsonArtifact(
    importReadinessPath.resolved,
    "customer session hosted import readiness parent",
  );
  runImportReadinessInspect(importReadinessPath.relativePath);
  invariant(
    importReadinessSha256 === gate.customer_session_hosted_import_readiness_sha256,
    "Customer session hosted import readiness parent SHA mismatch.",
  );
  invariant(importReadiness.gym_name === gate.source_gym_name, "Limited beta source gym mismatch.");
  invariant(importReadiness.owner_email === gate.source_owner_email, "Limited beta source owner mismatch.");
  invariant(importReadiness.hosted_neon_branch === gate.hosted_neon_branch, "Limited beta hosted Neon branch mismatch.");

  console.log("Admin limited beta readiness gate OK");
  console.log(`Artifact: ${gatePath.relativePath}`);
  console.log("Limited beta onboarding: blocked until hosted customer-session proof exists");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
