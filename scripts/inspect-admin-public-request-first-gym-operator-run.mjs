#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_RECORD_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-operator-run-record.json";

const REQUIRED_OBSERVED = [
  "owner_workspace_completed",
  "staff_workboard_completed",
  "source_answer_task_flow_completed",
  "reset_rollback_exercised",
  "support_handoff_reviewed",
  "unexpected_data_not_observed",
  "live_provider_claims_not_observed",
  "invite_delivery_not_observed",
  "billing_pos_member_writes_not_observed",
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

function runGoNoGoInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-first-gym-go-no-go-bundle.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH: path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(`Public request first-gym go/no-go inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function main() {
  const recordPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH ??
      DEFAULT_RECORD_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH",
  );
  const { artifact: record } = readJsonArtifact(
    recordPath.resolved,
    "public request first-gym operator run record",
  );
  invariant(record.artifact_kind === "admin_public_request_first_gym_operator_run_record", "Public request first-gym run kind mismatch.");
  invariant(record.status === "admin_public_request_first_gym_operator_run_recorded", "Public request first-gym run status mismatch.");
  invariant(record.evidence_basis === "admin_public_request_first_gym_go_no_go_bundle", "Public request first-gym run basis mismatch.");
  invariant(record.public_request_first_gym_operator_run_recorded === true, "Public request first-gym run must be recorded.");
  invariant(record.first_gym_operator_assisted_run_successful === true, "First-gym run must be successful.");
  invariant(record.ready_for_limited_beta_review === true, "Limited beta review must be ready.");

  const bundlePath = normalizeArtifactPath(
    record.public_request_first_gym_go_no_go_bundle_path,
    "public request first-gym go/no-go bundle path",
  );
  runGoNoGoInspect(record.public_request_first_gym_go_no_go_bundle_path);
  const { artifact: bundle, sha256 } = readJsonArtifact(
    bundlePath.resolved,
    "public request first-gym go/no-go bundle",
  );
  invariant(sha256 === record.public_request_first_gym_go_no_go_bundle_sha256, "Public request first-gym go/no-go bundle SHA256 does not match.");
  invariant(bundle.artifact_kind === "admin_public_request_first_gym_go_no_go_bundle", "Parent bundle kind mismatch.");
  invariant(bundle.gym_name === record.gym_name, "Run record gym mismatch.");
  invariant(bundle.owner_email === record.owner_email, "Run record owner mismatch.");

  for (const key of REQUIRED_OBSERVED) {
    invariant(record.observed?.[key] === true, `${key} required.`);
  }
  for (const key of [
    "public_self_serve_launch_allowed",
    "public_request_form_allowed",
    "browser_approval_buttons_allowed",
    "automatic_approval_allowed",
    "product_auth_admin_api_allowed",
    "auth_user_created",
    "magic_link_created",
    "automatic_owner_staff_grants_allowed",
    "invite_delivery_allowed",
    "staff_invite_delivery_allowed",
    "outbound_email_allowed",
    "notification_sending_allowed",
    "gmail_resend_smtp_provider_allowed",
    "live_provider_enablement_allowed",
    "billing_pos_member_writes_allowed",
    "access_control_writes_allowed",
    "member_ledger_writes_allowed",
    "provider_ingress_allowed",
    "provider_egress_allowed",
  ]) {
    assertFalse(record, key, `${key} blocked.`);
  }

  console.log("Admin public request first-gym operator run inspection passed");
}

main();
