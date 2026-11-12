#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-customer-session-proof-acquisition-batch.json";

const REQUIRED_COMMAND_IDS = [
  "customer_observed_handoff_gate",
  "customer_observed_handoff_gate",
  "hosted_customer_session_proof",
  "first_gym_go_no_go_bundle",
];

const REQUIRED_NEXT_IDS = [
  "customer_observed_handoff_gate",
  "hosted_customer_session_proof",
  "first_gym_go_no_go_bundle",
  "live_provider_revenue_gates",
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

function runHostedEvidenceInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-hosted-rehearsal-evidence.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH: path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Public request hosted rehearsal evidence inspection failed.\n${result.stderr || result.stdout}`,
    );
  }
}

function assertParentHash(pathValue, expectedSha) {
  invariant(/^[a-f0-9]{64}$/u.test(String(expectedSha ?? "")), "Parent SHA256 missing.");
  const parentPath = normalizeArtifactPath(
    pathValue,
    "public request hosted rehearsal evidence path",
  );
  const { artifact, sha256 } = readJsonArtifact(
    parentPath.resolved,
    "public request hosted rehearsal evidence",
  );
  invariant(
    sha256 === expectedSha,
    "Public request hosted rehearsal evidence SHA256 does not match.",
  );
  invariant(
    artifact.artifact_kind === "admin_public_request_hosted_rehearsal_evidence",
    "Public request hosted rehearsal evidence parent kind mismatch.",
  );
  runHostedEvidenceInspect(pathValue);
  return artifact;
}

function main() {
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH",
  );
  const { artifact: batch } = readJsonArtifact(
    batchPath.resolved,
    "public request customer-session proof acquisition batch",
  );

  invariant(
    batch.artifact_kind ===
      "admin_public_request_customer_session_proof_acquisition_batch",
    "Public request customer-session proof acquisition kind mismatch.",
  );
  invariant(
    batch.status ===
      "admin_public_request_customer_session_proof_acquisition_batch_prepared",
    "Public request customer-session proof acquisition status mismatch.",
  );
  invariant(
    batch.evidence_basis === "admin_public_request_hosted_rehearsal_evidence",
    "Public request customer-session proof acquisition basis mismatch.",
  );
  invariant(
    batch.public_request_customer_session_proof_acquisition_batch_ready === true,
    "Public request customer-session proof acquisition batch must be ready.",
  );
  const parent = assertParentHash(
    batch.public_request_hosted_rehearsal_evidence_path,
    batch.public_request_hosted_rehearsal_evidence_sha256,
  );
  invariant(
    parent.candidate_gym_label === batch.candidate_gym_label,
    "Parent candidate gym mismatch.",
  );

  invariant(
    batch.proof_acquisition?.mode ===
      "current_chain_customer_session_command_packet_only",
    "Proof acquisition must remain command-packet only.",
  );
  for (const key of [
    "customer_observed_session_command_required",
    "customer_session_hosted_import_required",
    "hosted_customer_session_proof_required",
    "first_gym_go_no_go_bundle_required_after_customer_proof",
  ]) {
    invariant(batch.proof_acquisition?.[key] === true, `${key} required.`);
  }
  for (const key of [
    "customer_observed_session_recorded",
    "customer_observed_handoff_claimed",
    "customer_session_hosted_import_recorded",
    "hosted_customer_session_proof_recorded",
    "first_gym_go_no_go_bundle_ready",
    "first_gym_operator_run_recorded",
    "public_launch_decision_allowed",
  ]) {
    assertFalse(batch.proof_acquisition, key, `${key} blocked.`);
  }

  const commandIds = batch.command_sequence?.map((slice) => slice.id) ?? [];
  invariant(commandIds.length === REQUIRED_COMMAND_IDS.length, "Command sequence mismatch.");
  REQUIRED_COMMAND_IDS.forEach((id, index) => {
    invariant(commandIds[index] === id, `Command sequence ${index} must be ${id}.`);
  });

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
    assertFalse(batch, key, `${key} blocked.`);
  }

  const nextIds = batch.next_readiness_batches?.map((slice) => slice.id) ?? [];
  invariant(nextIds.length === REQUIRED_NEXT_IDS.length, "Next readiness batch list mismatch.");
  for (const id of REQUIRED_NEXT_IDS) {
    invariant(nextIds.includes(id), `Next readiness batch missing ${id}.`);
  }

  console.log(
    "Admin public request customer-session proof acquisition batch inspection passed",
  );
}

main();
