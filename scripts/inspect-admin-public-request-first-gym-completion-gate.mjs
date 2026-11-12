#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_GATE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-completion-gate.json";

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
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(value);
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
    `${label} must be under artifacts/.`,
  );
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  if (options.mustExist !== false) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  }
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return {
    artifact,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

function runInspect(script, envName, path, label) {
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, [envName]: path },
  });
  if (result.status !== 0) {
    throw new Error(`${label} inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function isInspectable(ledger, id) {
  return (ledger.steps ?? []).some((step) => step.id === id && step.state === "inspectable");
}

function main() {
  const gatePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH ??
      DEFAULT_GATE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH",
  );
  const { artifact: gate } = readJsonArtifact(
    gatePath.resolved,
    "public request first-gym completion gate",
  );
  invariant(
    gate.artifact_kind === "admin_public_request_first_gym_completion_gate",
    "Completion gate kind mismatch.",
  );
  invariant(
    [
      "admin_public_request_first_gym_completion_gate_blocked",
      "admin_public_request_first_gym_completion_gate_ready",
    ].includes(gate.status),
    "Completion gate status mismatch.",
  );
  invariant(
    gate.evidence_basis === "admin_public_request_first_gym_execution_ledger",
    "Completion gate basis mismatch.",
  );

  const ledgerPath = normalizeArtifactPath(
    gate.public_request_first_gym_execution_ledger_path,
    "execution ledger path",
  );
  const { artifact: ledger, sha256: ledgerSha256 } = readJsonArtifact(
    ledgerPath.resolved,
    "public request first-gym execution ledger",
  );
  invariant(
    ledgerSha256 === gate.public_request_first_gym_execution_ledger_sha256,
    "Execution ledger SHA256 does not match parent artifact.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-execution-ledger.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH",
    ledgerPath.relativePath,
    "Public request first-gym execution ledger",
  );

  const missingIds = (ledger.steps ?? [])
    .filter((step) => step.state === "missing")
    .map((step) => step.id);
  const inspectableIds = (ledger.steps ?? [])
    .filter((step) => step.state === "inspectable")
    .map((step) => step.id);
  const allInspectable = missingIds.length === 0;
  invariant(
    gate.status ===
      (allInspectable
        ? "admin_public_request_first_gym_completion_gate_ready"
        : "admin_public_request_first_gym_completion_gate_blocked"),
    "Completion gate status does not match ledger.",
  );
  invariant(
    gate.completion_gate?.mode === "derived_from_execution_ledger_only",
    "Completion gate must be derived from execution ledger only.",
  );
  invariant(gate.completion_gate.missing_count === missingIds.length, "Missing count mismatch.");
  invariant(
    gate.completion_gate.inspectable_count === inspectableIds.length,
    "Inspectable count mismatch.",
  );
  invariant(
    gate.completion_gate.all_required_artifacts_inspectable === allInspectable,
    "All-required-artifacts flag mismatch.",
  );
  invariant(
    JSON.stringify(gate.missing_step_ids ?? []) === JSON.stringify(missingIds),
    "Missing step ids mismatch.",
  );
  invariant(
    JSON.stringify(gate.inspectable_step_ids ?? []) === JSON.stringify(inspectableIds),
    "Inspectable step ids mismatch.",
  );
  invariant(
    gate.completion_gate.hosted_rehearsal_evidence_recorded ===
      isInspectable(ledger, "hosted_rehearsal_evidence"),
    "Hosted rehearsal evidence state mismatch.",
  );
  invariant(
    gate.completion_gate.customer_observed_session_recorded ===
      isInspectable(ledger, "customer_observed_session"),
    "Customer-observed session state mismatch.",
  );
  invariant(
    gate.completion_gate.first_gym_go_no_go_bundle_ready ===
      isInspectable(ledger, "first_gym_go_no_go_bundle"),
    "First-gym go/no-go bundle state mismatch.",
  );
  invariant(
    gate.completion_gate.first_gym_operator_run_recorded ===
      isInspectable(ledger, "first_gym_operator_run"),
    "First-gym operator run state mismatch.",
  );
  invariant(
    gate.completion_gate.limited_beta_operator_review_ready ===
      isInspectable(ledger, "limited_beta_operator_review"),
    "Limited beta operator review state mismatch.",
  );
  invariant(
    gate.completion_gate.public_request_self_serve_launch_preflight_ready ===
      isInspectable(ledger, "public_request_self_serve_preflight"),
    "Public-request self-serve launch preflight state mismatch.",
  );
  invariant(
    gate.completion_gate.public_launch_controls_batch_ready ===
      isInspectable(ledger, "public_launch_controls"),
    "Public launch controls batch state mismatch.",
  );
  invariant(
    gate.completion_gate.ready_for_public_self_serve_launch === false,
    "Completion gate cannot mark public self-serve launch ready.",
  );
  invariant(
    gate.completion_gate.public_launch_decision_allowed === false,
    "Completion gate cannot allow public launch decision.",
  );

  for (const key of [
    "public_self_serve_launch_allowed",
    "public_request_form_allowed",
    "public_request_form_submission_allowed",
    "public_submission_accepted",
    "browser_approval_buttons_allowed",
    "automatic_approval_allowed",
    "owner_provisioning_allowed",
    "product_auth_admin_api_allowed",
    "auth_user_created",
    "magic_link_created",
    "automatic_owner_staff_grants_allowed",
    "invite_delivery_allowed",
    "staff_invite_delivery_allowed",
    "outbound_email_allowed",
    "notification_sending_allowed",
    "gmail_resend_smtp_provider_allowed",
    "phone_email_provider_activation_allowed",
    "live_provider_enablement_allowed",
    "billing_pos_member_writes_allowed",
    "access_control_writes_allowed",
    "member_ledger_writes_allowed",
    "provider_ingress_allowed",
    "provider_egress_allowed",
    "public_launch_decision_allowed",
  ]) {
    assertFalse(gate, key, `${key} blocked.`);
  }

  console.log("Admin public request first-gym completion gate inspection passed");
}

main();
