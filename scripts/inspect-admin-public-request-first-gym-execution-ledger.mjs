#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_LEDGER_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-execution-ledger.json";

const STEP_INSPECTORS = {
  customer_observed_session: {
    envName: "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    script: "scripts/inspect-admin-customer-observed-session.mjs",
  },
  first_gym_go_no_go_bundle: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
    script: "scripts/inspect-admin-public-request-first-gym-go-no-go-bundle.mjs",
  },
  first_gym_operator_run: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH",
    script: "scripts/inspect-admin-public-request-first-gym-operator-run.mjs",
  },
  hosted_rehearsal_evidence: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
    script: "scripts/inspect-admin-public-request-hosted-rehearsal-evidence.mjs",
  },
  limited_beta_operator_review: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH",
    script:
      "scripts/inspect-admin-public-request-limited-beta-operator-review-packet.mjs",
  },
  public_launch_controls: {
    envName: "OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH",
    script: "scripts/inspect-admin-public-launch-controls-batch.mjs",
  },
  public_request_self_serve_preflight: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH",
    script: "scripts/inspect-admin-public-request-self-serve-launch-preflight.mjs",
  },
};

const REQUIRED_STEP_IDS = Object.keys(STEP_INSPECTORS);

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

function inspectStep(step) {
  invariant(REQUIRED_STEP_IDS.includes(step.id), `Unexpected ledger step ${step.id}.`);
  invariant(["missing", "inspectable"].includes(step.state), `Invalid state for ${step.id}.`);
  invariant(typeof step.command === "string" && step.command.includes("npm run "), `${step.id} command missing.`);
  const path = normalizeArtifactPath(step.artifact_path, `${step.id} artifact path`, {
    mustExist: step.state === "inspectable",
  });
  if (step.state === "missing") {
    invariant(!existsSync(path.resolved), `${step.id} is marked missing but artifact exists.`);
    invariant(!step.artifact_sha256, `${step.id} missing step cannot pin artifact SHA.`);
    return;
  }

  const { envName, script } = STEP_INSPECTORS[step.id];
  runInspect(script, envName, path.relativePath, step.title ?? step.id);
  const { sha256 } = readJsonArtifact(path.resolved, step.id);
  invariant(sha256 === step.artifact_sha256, `${step.id} SHA256 does not match artifact.`);
}

function main() {
  const ledgerPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH ??
      DEFAULT_LEDGER_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH",
  );
  const { artifact: ledger } = readJsonArtifact(
    ledgerPath.resolved,
    "public request first-gym execution ledger",
  );

  invariant(
    ledger.artifact_kind === "admin_public_request_first_gym_execution_ledger",
    "Execution ledger kind mismatch.",
  );
  invariant(
    ledger.status === "admin_public_request_first_gym_execution_ledger_prepared",
    "Execution ledger status mismatch.",
  );
  invariant(
    ledger.evidence_basis === "admin_public_request_first_gym_proof_runway_batch",
    "Execution ledger basis mismatch.",
  );
  const runwayPath = normalizeArtifactPath(
    ledger.public_request_first_gym_proof_runway_batch_path,
    "proof runway path",
  );
  const { artifact: runway, sha256: runwaySha256 } = readJsonArtifact(
    runwayPath.resolved,
    "public request first-gym proof runway",
  );
  invariant(
    runwaySha256 === ledger.public_request_first_gym_proof_runway_batch_sha256,
    "Proof runway SHA256 does not match parent artifact.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-runway-batch.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH",
    runwayPath.relativePath,
    "Public request first-gym proof runway",
  );

  invariant(
    ledger.execution_ledger?.mode === "status_only_reinspect_existing_artifacts",
    "Execution ledger must remain status-only.",
  );
  const runwayCommandIds = runway.command_sequence?.map((slice) => slice.id) ?? [];
  const steps = ledger.steps ?? [];
  invariant(steps.length === REQUIRED_STEP_IDS.length, "Execution ledger step count mismatch.");
  for (const id of REQUIRED_STEP_IDS) {
    invariant(steps.some((step) => step.id === id), `Execution ledger missing ${id}.`);
    invariant(runwayCommandIds.includes(id), `Proof runway command sequence missing ${id}.`);
  }
  for (const step of steps) inspectStep(step);

  const inspectableCount = steps.filter((step) => step.state === "inspectable").length;
  const missingCount = steps.filter((step) => step.state === "missing").length;
  invariant(
    ledger.execution_ledger.inspectable_count === inspectableCount,
    "Inspectable count mismatch.",
  );
  invariant(ledger.execution_ledger.missing_count === missingCount, "Missing count mismatch.");
  invariant(
    ledger.execution_ledger.all_required_artifacts_inspectable === (missingCount === 0),
    "All-required-artifacts flag mismatch.",
  );
  invariant(
    ledger.execution_ledger.ready_for_public_self_serve_launch === false,
    "Execution ledger cannot mark public self-serve launch ready.",
  );
  invariant(
    ledger.execution_ledger.public_launch_decision_allowed === false,
    "Execution ledger cannot allow public launch decision.",
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
    assertFalse(ledger, key, `${key} blocked.`);
  }

  console.log("Admin public request first-gym execution ledger inspection passed");
}

main();
