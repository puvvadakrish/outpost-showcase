#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_EVIDENCE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-hosted-rehearsal-evidence.json";

const REQUIRED_NEXT_IDS = [
  "customer_observed_handoff_gate",
  "hosted_customer_session_proof",
  "first_gym_go_no_go_bundle",
  "first_gym_operator_assisted_run",
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
      !/(password|token|cookie|apikey|authorization|credential|privatekey|secret|bypass|signature|jwt)/u.test(
        normalizedKey,
      ),
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

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function runHostedReadinessInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-hosted-rehearsal-readiness-batch.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH:
          path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Public request hosted rehearsal readiness inspection failed.\n${result.stderr || result.stdout}`,
    );
  }
}

function assertParentHash(pathValue, expectedSha) {
  invariant(/^[a-f0-9]{64}$/u.test(String(expectedSha ?? "")), "Parent SHA256 missing.");
  const parentPath = normalizeArtifactPath(
    pathValue,
    "public_request_hosted_rehearsal_readiness_batch_path",
  );
  const { artifact, sha256 } = readJsonArtifact(
    parentPath.resolved,
    "public request hosted rehearsal readiness batch",
  );
  invariant(sha256 === expectedSha, "Public request hosted rehearsal readiness SHA256 does not match.");
  invariant(
    artifact.artifact_kind === "admin_public_request_hosted_rehearsal_readiness_batch",
    "Public request hosted rehearsal readiness parent kind mismatch.",
  );
  runHostedReadinessInspect(pathValue);
  return artifact;
}

function main() {
  const evidencePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH ??
      DEFAULT_EVIDENCE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
  );
  const { artifact: evidence } = readJsonArtifact(
    evidencePath.resolved,
    "public request hosted rehearsal evidence",
  );

  invariant(
    evidence.artifact_kind === "admin_public_request_hosted_rehearsal_evidence",
    "Public request hosted rehearsal evidence kind mismatch.",
  );
  invariant(
    evidence.status === "admin_public_request_hosted_rehearsal_evidence_recorded",
    "Public request hosted rehearsal evidence status mismatch.",
  );
  invariant(
    evidence.evidence_basis === "admin_public_request_hosted_rehearsal_readiness_batch",
    "Public request hosted rehearsal evidence basis mismatch.",
  );
  const parent = assertParentHash(
    evidence.public_request_hosted_rehearsal_readiness_batch_path,
    evidence.public_request_hosted_rehearsal_readiness_batch_sha256,
  );
  invariant(parent.candidate_gym_label === evidence.candidate_gym_label, "Parent candidate gym mismatch.");

  invariant(evidence.public_request_hosted_rehearsal_evidence_recorded === true, "Hosted rehearsal evidence must be recorded.");
  for (const key of [
    "owner_workspace_observed",
    "staff_workboard_observed",
    "reset_rollback_reviewed",
    "unexpected_data_not_observed",
    "live_provider_claims_not_observed",
    "invite_delivery_not_observed",
    "billing_pos_member_writes_not_observed",
  ]) {
    invariant(evidence.observed?.[key] === true, `${key} required.`);
  }

  for (const key of [
    "customer_observed_handoff_recorded",
    "customer_observed_handoff_claimed",
    "customer_observed_session_recorded",
    "customer_session_hosted_import_recorded",
    "first_gym_go_no_go_bundle_ready",
    "first_gym_operator_run_recorded",
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
    assertFalse(evidence, key, `${key} blocked.`);
  }

  const ids = evidence.next_readiness_batches?.map((slice) => slice.id) ?? [];
  invariant(ids.length === REQUIRED_NEXT_IDS.length, "Next readiness batch list mismatch.");
  for (const id of REQUIRED_NEXT_IDS) {
    invariant(ids.includes(id), `Next readiness batch missing ${id}.`);
  }

  console.log("Admin public request hosted rehearsal evidence inspection passed");
}

main();
