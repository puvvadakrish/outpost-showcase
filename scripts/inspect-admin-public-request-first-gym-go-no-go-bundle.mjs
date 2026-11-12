#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_BUNDLE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-go-no-go-bundle.json";

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

function assertChildHash(pathValue, expectedSha, expectedKind, label) {
  invariant(/^[a-f0-9]{64}$/u.test(String(expectedSha ?? "")), `${label} SHA256 missing.`);
  const childPath = normalizeArtifactPath(pathValue, `${label} path`);
  const { artifact, sha256 } = readJsonArtifact(childPath.resolved, label);
  invariant(sha256 === expectedSha, `${label} SHA256 does not match child artifact.`);
  invariant(artifact.artifact_kind === expectedKind, `${label} kind mismatch.`);
  return artifact;
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

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function main() {
  const bundlePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH ??
      DEFAULT_BUNDLE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
  );
  const { artifact: bundle } = readJsonArtifact(
    bundlePath.resolved,
    "public request first-gym go/no-go bundle",
  );

  invariant(bundle.artifact_kind === "admin_public_request_first_gym_go_no_go_bundle", "Public request first-gym bundle kind mismatch.");
  invariant(bundle.status === "admin_public_request_first_gym_go_no_go_bundle_prepared", "Public request first-gym bundle status mismatch.");
  invariant(
    bundle.evidence_basis === "public_request_hosted_rehearsal_customer_session_and_hosted_digest_proof",
    "Public request first-gym bundle evidence basis mismatch.",
  );
  invariant(bundle.public_request_hosted_rehearsal_evidence_recorded === true, "Hosted rehearsal evidence must be recorded.");
  invariant(bundle.customer_observed_session_recorded === true, "Customer session must be recorded.");
  invariant(bundle.customer_observed_handoff_claimed === true, "Customer handoff must be claimed.");
  invariant(bundle.hosted_customer_session_proof_recorded === true, "Hosted customer-session proof must be recorded.");
  invariant(bundle.first_gym_go_no_go_bundle_ready === true, "First-gym bundle must be ready.");
  invariant(bundle.ready_for_first_gym_operator_assisted_run === true, "First-gym run must be ready.");
  const previewUrl = new URL(bundle.protected_preview_url);
  invariant(previewUrl.protocol === "https:", "Protected Preview URL required.");
  invariant(previewUrl.hostname.endsWith(".vercel.app"), "Protected Preview URL must be a Vercel Preview origin.");
  invariant(
    bundle.hosted_neon_branch &&
      bundle.hosted_neon_branch !== "production" &&
      bundle.hosted_neon_branch !== "outpost-neon-spike",
    "Hosted Neon branch required.",
  );

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
    "public_launch_decision_allowed",
  ]) {
    assertFalse(bundle, key, `${key} blocked.`);
  }

  const rehearsal = assertChildHash(
    bundle.public_request_hosted_rehearsal_evidence_path,
    bundle.public_request_hosted_rehearsal_evidence_sha256,
    "admin_public_request_hosted_rehearsal_evidence",
    "public request hosted rehearsal evidence",
  );
  runInspect(
    "scripts/inspect-admin-public-request-hosted-rehearsal-evidence.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
    bundle.public_request_hosted_rehearsal_evidence_path,
    "Public request hosted rehearsal evidence",
  );
  const customerSession = assertChildHash(
    bundle.customer_session_record_path,
    bundle.customer_session_record_sha256,
    "admin_customer_observed_session_record",
    "customer-observed session record",
  );
  runInspect(
    "scripts/inspect-admin-customer-observed-session.mjs",
    "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    bundle.customer_session_record_path,
    "Customer-observed session",
  );
  invariant(rehearsal.candidate_gym_label === customerSession.gym_name, "Hosted rehearsal and customer session must target same gym.");
  invariant(bundle.gym_name === customerSession.gym_name, "Bundle gym mismatch.");
  invariant(bundle.owner_email === customerSession.owner_email, "Bundle owner mismatch.");

  assertIncludes(bundle.ready_gates, "Public-request hosted rehearsal evidence recorded", "ready_gates");
  assertIncludes(bundle.ready_gates, "Real customer-observed session record present", "ready_gates");
  assertIncludes(bundle.ready_gates, "Hosted customer-session digest proof confirmed by operator", "ready_gates");
  assertIncludes(bundle.blocked_gates, "Public owner self-signup", "blocked_gates");
  assertIncludes(bundle.blocked_gates, "Invite delivery", "blocked_gates");
  assertIncludes(bundle.blocked_gates, "Phone/email provider activation", "blocked_gates");
  assertIncludes(bundle.blocked_gates, "Billing, POS, access control, member-ledger writes", "blocked_gates");

  console.log("Admin public request first-gym go/no-go bundle inspection passed");
}

main();
