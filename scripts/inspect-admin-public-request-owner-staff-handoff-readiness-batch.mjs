#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-owner-staff-handoff-readiness-batch.json";

const REQUIRED_NEXT_IDS = [
  "approved_gym_hosted_rehearsal_readiness_batch",
  "first_gym_go_no_go_bundle",
  "public_self_serve_preflight",
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
  const batchPath = normalizeArtifactPath(
    process.env
      .OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH",
  );
  const { artifact: batch } = readJsonArtifact(
    batchPath.resolved,
    "public request owner/staff handoff readiness batch",
  );

  invariant(
    batch.artifact_kind ===
      "admin_public_request_owner_staff_handoff_readiness_batch",
    "Public request owner/staff handoff readiness kind mismatch.",
  );
  invariant(
    batch.status ===
      "admin_public_request_owner_staff_handoff_readiness_batch_prepared",
    "Public request owner/staff handoff readiness status mismatch.",
  );
  invariant(
    batch.evidence_basis === "admin_public_request_followup_readiness_batch",
    "Public request owner/staff handoff evidence basis mismatch.",
  );
  invariant(
    batch.public_request_owner_staff_handoff_readiness_batch_ready === true,
    "Public request owner/staff handoff readiness batch must be ready.",
  );
  const parent = assertParentHash(
    batch.public_request_followup_readiness_batch_path,
    batch.public_request_followup_readiness_batch_sha256,
    "admin_public_request_followup_readiness_batch",
    "public request follow-up readiness batch",
  );
  invariant(
    parent.candidate_gym_label === batch.candidate_gym_label,
    "Parent candidate gym mismatch.",
  );

  invariant(
    batch.owner_access_fulfillment?.mode ===
      "operator_managed_evidence_required",
    "Owner access must remain operator-managed evidence.",
  );
  assertFalse(
    batch.owner_access_fulfillment,
    "owner_access_evidence_recorded",
    "Owner access evidence must not be recorded by this batch.",
  );
  for (const key of [
    "owner_provisioning_allowed",
    "product_auth_admin_api_allowed",
    "auth_user_created",
    "magic_link_created",
    "automatic_owner_staff_grants_allowed",
  ]) {
    assertFalse(batch.owner_access_fulfillment, key, `${key} blocked.`);
  }

  invariant(
    batch.staff_handoff?.mode === "reviewed_roster_no_invite_send",
    "Staff handoff must remain no-send.",
  );
  for (const key of [
    "staff_invite_delivery_allowed",
    "outbound_email_allowed",
    "notification_sending_allowed",
    "auth_user_created",
    "automatic_owner_staff_grants_allowed",
  ]) {
    assertFalse(batch.staff_handoff, key, `${key} blocked.`);
  }

  invariant(
    batch.hosted_rehearsal_prerequisites?.mode ===
      "approved_gym_hosted_rehearsal_pending",
    "Hosted rehearsal must remain pending.",
  );
  assertFalse(
    batch.hosted_rehearsal_prerequisites,
    "customer_observed_handoff_recorded",
    "Customer-observed handoff must not be recorded.",
  );
  assertFalse(
    batch.hosted_rehearsal_prerequisites,
    "approved_gym_hosted_rehearsal_recorded",
    "Approved-gym hosted rehearsal must not be recorded.",
  );
  assertFalse(
    batch.hosted_rehearsal_prerequisites,
    "first_gym_go_no_go_bundle_ready",
    "First-gym go/no-go bundle blocked.",
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
    assertFalse(batch, key, `${key} blocked.`);
  }

  const ids = batch.next_readiness_batches?.map((slice) => slice.id) ?? [];
  invariant(ids.length === REQUIRED_NEXT_IDS.length, "Next readiness batch list mismatch.");
  for (const id of REQUIRED_NEXT_IDS) {
    invariant(ids.includes(id), `Next readiness batch missing ${id}.`);
  }

  console.log(
    "Admin public request owner/staff handoff readiness batch inspection passed",
  );
}

main();
