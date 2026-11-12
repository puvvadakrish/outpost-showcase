#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_RUNWAY_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-runway-batch.json";

const REQUIRED_COMMAND_IDS = [
  "hosted_rehearsal_evidence",
  "customer_observed_session",
  "customer_session_hosted_import",
  "hosted_customer_session_proof",
  "first_gym_go_no_go_bundle",
  "first_gym_operator_run",
  "limited_beta_operator_review",
  "public_request_self_serve_preflight",
  "public_launch_controls",
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
      !/(password|token|cookie|apikey|authorization|credential|privatekey|secret|bypass|signature|jwt)/u.test(normalizedKey),
      `${label} contains secret-shaped key ${path}.`,
    );
    assertNoSecretShapedValue(entry, `${label}.${path}`);
    assertNoSecretShapedKeys(entry, label, [...trail, key]);
  }
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
  invariant(
    relativePath.startsWith(`artifacts${sep}`) || relativePath === "artifacts",
    `${label} must be under artifacts/.`,
  );
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  return { resolved };
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

function runEvidenceAcquisitionInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-first-gym-evidence-acquisition-batch.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH:
          path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Public request first-gym evidence acquisition inspection failed.\n${result.stderr || result.stdout}`,
    );
  }
}

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function assertParentHash(pathValue, expectedSha, expectedKind, label) {
  invariant(/^[a-f0-9]{64}$/u.test(String(expectedSha ?? "")), `${label} SHA256 missing.`);
  const parentPath = normalizeArtifactPath(pathValue, `${label} path`);
  const { artifact, sha256 } = readJsonArtifact(parentPath.resolved, label);
  invariant(sha256 === expectedSha, `${label} SHA256 does not match parent artifact.`);
  invariant(artifact.artifact_kind === expectedKind, `${label} kind mismatch.`);
  return artifact;
}

function main() {
  const runwayPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH ??
      DEFAULT_RUNWAY_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH",
  );
  const { artifact: runway } = readJsonArtifact(
    runwayPath.resolved,
    "public request first-gym proof runway batch",
  );

  invariant(
    runway.artifact_kind === "admin_public_request_first_gym_proof_runway_batch",
    "Public request first-gym proof runway kind mismatch.",
  );
  invariant(
    runway.status === "admin_public_request_first_gym_proof_runway_batch_prepared",
    "Public request first-gym proof runway status mismatch.",
  );
  invariant(
    runway.evidence_basis === "admin_public_request_first_gym_evidence_acquisition_batch",
    "Public request first-gym proof runway basis mismatch.",
  );
  invariant(
    runway.public_request_first_gym_proof_runway_batch_ready === true,
    "Proof runway batch must be ready.",
  );
  const parent = assertParentHash(
    runway.public_request_first_gym_evidence_acquisition_batch_path,
    runway.public_request_first_gym_evidence_acquisition_batch_sha256,
    "admin_public_request_first_gym_evidence_acquisition_batch",
    "public request first-gym evidence acquisition batch",
  );
  runEvidenceAcquisitionInspect(
    runway.public_request_first_gym_evidence_acquisition_batch_path,
  );
  invariant(parent.candidate_gym_label === runway.candidate_gym_label, "Parent candidate gym mismatch.");
  invariant(runway.proof_runway?.mode === "terminal_execution_plan_only", "Proof runway must remain terminal-only.");

  for (const key of [
    "hosted_rehearsal_evidence_recorded",
    "customer_observed_session_recorded",
    "customer_session_hosted_import_recorded",
    "hosted_customer_session_proof_recorded",
    "first_gym_go_no_go_bundle_ready",
    "first_gym_operator_run_recorded",
    "limited_beta_operator_review_ready",
    "public_request_self_serve_launch_preflight_ready",
    "public_launch_controls_batch_ready",
    "ready_for_public_self_serve_launch",
    "public_launch_decision_allowed",
  ]) {
    assertFalse(runway.proof_runway, key, `${key} blocked.`);
  }

  const commandIds = runway.command_sequence?.map((slice) => slice.id) ?? [];
  invariant(commandIds.length === REQUIRED_COMMAND_IDS.length, "Command sequence mismatch.");
  for (const id of REQUIRED_COMMAND_IDS) {
    invariant(commandIds.includes(id), `Command sequence missing ${id}.`);
  }
  for (const slice of runway.command_sequence ?? []) {
    invariant(slice.state === "blocked", `Command sequence ${slice.id} must stay blocked.`);
  }

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
    assertFalse(runway, key, `${key} blocked.`);
  }

  console.log("Admin public request first-gym proof runway batch inspection passed");
}

main();
