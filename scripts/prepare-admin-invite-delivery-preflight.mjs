#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PUBLIC_REQUEST_DRY_RUN_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-intake-dry-run.json";
const DEFAULT_INVITE_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-invite-delivery-preflight.json";

const REQUIRED_BLOCKED_GATES = [
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery send",
  "Notification sending",
  "Gmail, Resend, SMTP, provider webhooks",
  "Phone/email provider activation",
  "Auth admin product API",
  "Automatic owner grant",
  "Billing, POS, access control, member-ledger writes",
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
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
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON artifact.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  }
  return { relativePath, resolved };
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(
      text,
    ) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text,
    );
  invariant(!secretValue, `${label} contains secret-shaped material.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("privatekey") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("signature") ||
      normalizedKey.includes("jwt");
    invariant(!secretKey, `${label} contains secret-shaped key: ${path}`);
    assertNoSecretShapedValue(nestedValue, `${label}.${path}`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJsonArtifact(path, label) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, label);
  const artifact = JSON.parse(source);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: sha256(source) };
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertPublicRequestIntakeDryRun(dryRun) {
  invariant(
    dryRun.artifact_kind === "admin_public_request_intake_dry_run",
    "Public request intake dry-run artifact kind mismatch.",
  );
  invariant(
    dryRun.status === "admin_public_request_intake_dry_run_prepared",
    "Public request intake dry-run status mismatch.",
  );
  invariant(
    dryRun.intake_mode === "request_only_review_only",
    "Public request intake must remain request-only/review-only.",
  );
  invariant(dryRun.dry_run_request?.gym_label, "Dry-run gym label required.");
  invariant(dryRun.dry_run_request?.owner_email, "Dry-run owner email required.");
  assertFalse(
    dryRun.dry_run_request,
    "persisted_request_allowed",
    "Public request persistence must remain blocked.",
  );
  assertFalse(dryRun, "public_request_form_allowed", "Public form blocked.");
  assertFalse(
    dryRun,
    "public_self_serve_launch_allowed",
    "Public self-serve blocked.",
  );
  assertFalse(dryRun, "automatic_approval_allowed", "Automatic approval blocked.");
  assertFalse(dryRun, "owner_provisioning_allowed", "Owner provisioning blocked.");
  assertFalse(dryRun, "owner_grant_automatic", "Owner grant automatic blocked.");
  assertFalse(dryRun, "invite_delivery_allowed", "Invite delivery blocked.");
  assertFalse(
    dryRun,
    "browser_approval_buttons_allowed",
    "Browser approval buttons blocked.",
  );
  assertFalse(
    dryRun,
    "auth_admin_product_api_allowed",
    "Auth admin product API blocked.",
  );
  assertFalse(dryRun, "outbound_email_allowed", "Outbound email blocked.");
  assertFalse(
    dryRun,
    "notification_sending_allowed",
    "Notification sending blocked.",
  );
  assertFalse(
    dryRun,
    "live_provider_enablement_allowed",
    "Live providers blocked.",
  );
  assertFalse(
    dryRun,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes blocked.",
  );
}

function optionalText(envName, fallback, maxLength) {
  const value = process.env[envName]?.trim() || fallback;
  invariant(value && value.length <= maxLength, `${envName} is invalid.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function main() {
  const dryRunPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH ??
      DEFAULT_PUBLIC_REQUEST_DRY_RUN_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH",
    { mustExist: true },
  );
  const invitePreflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH ??
      DEFAULT_INVITE_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH",
  );
  invariant(
    !existsSync(invitePreflightPath.resolved),
    "OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH already exists.",
  );

  const { artifact: dryRun, sha256: dryRunSha256 } = readJsonArtifact(
    dryRunPath.resolved,
    "public request intake dry-run",
  );
  assertPublicRequestIntakeDryRun(dryRun);

  const inviteSubject = optionalText(
    "OUTPOST_ADMIN_INVITE_PREFLIGHT_SUBJECT",
    `Outpost beta access for ${dryRun.dry_run_request.gym_label}`,
    180,
  );
  const inviteAudience = optionalText(
    "OUTPOST_ADMIN_INVITE_PREFLIGHT_AUDIENCE",
    dryRun.dry_run_request.owner_email,
    180,
  );

  const preflight = {
    artifact_kind: "admin_invite_delivery_preflight",
    status: "admin_invite_delivery_preflight_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_intake_dry_run",
    public_request_intake_dry_run_path: dryRunPath.relativePath,
    public_request_intake_dry_run_sha256: dryRunSha256,
    invite_mode: "review_only_no_send",
    invite_audience: inviteAudience,
    invite_subject: inviteSubject,
    invite_body_preview:
      "Operator-reviewed invite copy placeholder. Sending remains blocked.",
    browser_send_button_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    outbound_email_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    auth_admin_product_api_allowed: false,
    owner_provisioning_allowed: false,
    owner_grant_automatic: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: REQUIRED_BLOCKED_GATES,
    operator_checklist: [
      "Confirm the requested gym and owner email were reviewed.",
      "Confirm invite copy is customer-safe and contains no secrets.",
      "Do not send email or notification from this preflight.",
      "Keep owner provisioning and Auth admin product APIs blocked.",
    ],
    next_recommended_slice:
      "Run Auth admin provisioning dry-run without creating users from product code.",
  };

  assertNoSecretShapedKeys(preflight, "invite delivery preflight");
  const serialized = `${JSON.stringify(preflight, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "invite delivery preflight");
  mkdirSync(dirname(invitePreflightPath.resolved), { recursive: true });
  writeFileSync(invitePreflightPath.resolved, serialized, { flag: "wx" });

  console.log(
    `Invite delivery preflight wrote ${invitePreflightPath.relativePath}`,
  );
  console.log(`Invite audience: ${inviteAudience}`);
  console.log("Invite delivery: blocked");
  console.log("Notifications: blocked");
  console.log("Auth admin product API: blocked");
  console.log(`Preflight sha256: ${sha256(serialized)}`);
}

main();
