#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_INTAKE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-intake-artifact.json";

const REQUIRED_NEXT_IDS = [
  "invite_auth_no_send_no_create_records",
  "live_provider_revenue_member_system_runbooks",
  "limited_beta_operator_onboarding_review",
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
  const intakePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH ??
      DEFAULT_INTAKE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH",
  );
  const { artifact } = readJsonArtifact(
    intakePath.resolved,
    "public request intake artifact",
  );

  invariant(
    artifact.artifact_kind === "admin_public_request_intake_artifact",
    "Public request intake artifact kind mismatch.",
  );
  invariant(
    artifact.status === "admin_public_request_intake_artifact_prepared",
    "Public request intake artifact status mismatch.",
  );
  invariant(
    artifact.evidence_basis === "admin_public_launch_next_readiness_batch",
    "Public request intake artifact evidence basis mismatch.",
  );
  invariant(
    artifact.request_only_intake_artifact_ready === true,
    "Request-only intake artifact must be ready.",
  );
  const parent = assertParentHash(
    artifact.public_launch_next_readiness_batch_path,
    artifact.public_launch_next_readiness_batch_sha256,
    "admin_public_launch_next_readiness_batch",
    "public launch next readiness batch",
  );
  invariant(
    parent.candidate_gym_label === artifact.candidate_gym_label,
    "Parent candidate gym mismatch.",
  );

  invariant(
    artifact.intake_mode === "request_only_human_reviewed_no_persistence",
    "Intake mode must remain request-only/no-persistence.",
  );
  invariant(artifact.request_preview?.label, "Request preview label required.");
  invariant(artifact.request_preview?.contact, "Request preview contact required.");
  invariant(
    artifact.request_preview?.operator_review_required === true,
    "Operator review must remain required.",
  );
  assertFalse(
    artifact.request_preview,
    "persisted_public_request_allowed",
    "Persisted public request blocked.",
  );
  assertFalse(
    artifact.request_preview,
    "public_submission_accepted",
    "Public submission accepted blocked.",
  );
  invariant(
    artifact.admin_preview?.mode === "read_only_operator_preview",
    "Admin preview must remain read-only.",
  );
  for (const key of [
    "browser_approval_buttons_allowed",
    "public_submit_button_allowed",
    "owner_provisioning_button_allowed",
    "invite_send_button_allowed",
  ]) {
    assertFalse(artifact.admin_preview, key, `${key} blocked.`);
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
    assertFalse(artifact, key, `${key} blocked.`);
  }

  const ids = artifact.next_readiness_batches?.map((slice) => slice.id) ?? [];
  invariant(ids.length === REQUIRED_NEXT_IDS.length, "Next readiness batch list mismatch.");
  for (const id of REQUIRED_NEXT_IDS) {
    invariant(ids.includes(id), `Next readiness batch missing ${id}.`);
  }

  console.log("Admin public request intake artifact inspection passed");
}

main();
