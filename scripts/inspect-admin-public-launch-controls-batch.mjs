#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-public-launch-controls-batch.json";

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
    process.env.OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH ?? DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH",
  );
  const { artifact: batch } = readJsonArtifact(batchPath.resolved, "public launch controls batch");

  invariant(batch.artifact_kind === "admin_public_launch_controls_batch", "Public launch controls kind mismatch.");
  invariant(batch.status === "admin_public_launch_controls_batch_prepared", "Public launch controls status mismatch.");
  invariant(
    [
      "admin_public_self_serve_launch_preflight",
      "admin_public_request_self_serve_launch_preflight",
    ].includes(batch.evidence_basis),
    "Public launch controls evidence basis mismatch.",
  );
  invariant(batch.public_launch_controls_batch_ready === true, "Public launch controls batch must be ready.");
  invariant(batch.owner_access_mode === "operator_managed_until_launch_gate_green", "Owner access must remain operator-managed.");
  const parent = assertParentHash(
    batch.public_self_serve_launch_preflight_path,
    batch.public_self_serve_launch_preflight_sha256,
    batch.evidence_basis,
    "public self-serve launch preflight",
  );
  invariant(parent.candidate_gym_label === batch.candidate_gym_label, "Parent candidate gym mismatch.");

  invariant(batch.public_request_intake?.mode === "request_only_human_reviewed", "Public request intake must be request-only/human-reviewed.");
  assertFalse(batch.public_request_intake, "request_form_allowed", "Public request form blocked.");
  assertFalse(batch.public_request_intake, "browser_approval_buttons_allowed", "Browser approval buttons blocked.");
  assertFalse(batch.public_request_intake, "automatic_approval_allowed", "Automatic approval blocked.");
  assertFalse(batch.public_request_intake, "automatic_owner_staff_grants_allowed", "Automatic grants blocked.");

  invariant(batch.invite_auth_no_send?.mode === "no_send_no_create_dry_run", "Invite/Auth must be no-send/no-create.");
  assertFalse(batch.invite_auth_no_send, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(batch.invite_auth_no_send, "staff_invite_delivery_allowed", "Staff invite delivery blocked.");
  assertFalse(batch.invite_auth_no_send, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(batch.invite_auth_no_send, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(batch.invite_auth_no_send, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(batch.invite_auth_no_send, "auth_user_created", "Auth user creation blocked.");

  invariant(batch.live_provider_revenue_member_systems?.mode === "separate_blocked_proof_tracks", "Live/revenue/member tracks must remain separate.");
  assertFalse(batch.live_provider_revenue_member_systems, "gmail_resend_smtp_provider_allowed", "Gmail/Resend/SMTP providers blocked.");
  assertFalse(batch.live_provider_revenue_member_systems, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(batch.live_provider_revenue_member_systems, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
  assertFalse(batch.live_provider_revenue_member_systems, "access_control_writes_allowed", "Access control writes blocked.");
  assertFalse(batch.live_provider_revenue_member_systems, "member_ledger_writes_allowed", "Member-ledger writes blocked.");

  assertFalse(batch, "public_self_serve_launch_allowed", "Public self-serve launch blocked.");
  assertFalse(batch, "public_request_form_allowed", "Public request form blocked.");
  assertFalse(batch, "browser_approval_buttons_allowed", "Browser approvals blocked.");
  assertFalse(batch, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(batch, "notification_sending_allowed", "Notifications blocked.");
  assertFalse(batch, "product_auth_admin_api_allowed", "Product Auth admin API blocked.");
  assertFalse(batch, "auth_user_created", "Auth user creation blocked.");
  assertFalse(batch, "live_provider_enablement_allowed", "Live providers blocked.");
  assertFalse(batch, "billing_pos_member_writes_allowed", "Billing/POS/member writes blocked.");
  assertFalse(batch, "access_control_writes_allowed", "Access control writes blocked.");
  assertFalse(batch, "member_ledger_writes_allowed", "Member-ledger writes blocked.");
  invariant(Array.isArray(batch.next_readiness_batches) && batch.next_readiness_batches.length === 3, "Next readiness batch list mismatch.");

  console.log("Admin public launch controls batch inspection passed");
}

main();
