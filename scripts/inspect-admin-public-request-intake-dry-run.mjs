#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_DRY_RUN_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-intake-dry-run.json";
const REQUIRED_BLOCKED_GATES = [
  "Public owner self-signup",
  "Browser approval buttons",
  "Automatic approval",
  "Owner provisioning",
  "Invite delivery",
  "Website scraping Google API import",
  "Automatic answer approval",
  "Automatic task generation",
  "Gmail, Resend, SMTP, provider webhooks",
  "Inbound email outbound email",
  "Notification sending",
  "Phone/email provider activation",
  "Billing, POS, access control, member-ledger writes",
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
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
  invariant(relativePath.endsWith(".json"), `${label} must point JSON artifact.`);
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
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
  invariant(!secretValue, `${label} contains secret-shaped value.`);
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

function assertFalse(packet, key, message) {
  invariant(packet[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function main() {
  const dryRunPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH ??
      DEFAULT_DRY_RUN_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH",
  );
  const raw = readFileSync(dryRunPath.resolved, "utf8");
  assertNoSecretShapedValue(raw, "public request intake dry-run");
  const dryRun = JSON.parse(raw);
  assertNoSecretShapedKeys(dryRun, "public request intake dry-run");

  invariant(
    dryRun.artifact_kind === "admin_public_request_intake_dry_run",
    "Public request intake dry-run artifact kind mismatch.",
  );
  invariant(
    dryRun.status === "admin_public_request_intake_dry_run_prepared",
    "Public request intake dry-run status mismatch.",
  );
  invariant(
    dryRun.evidence_basis === "admin_approved_gym_request_followthrough_packet",
    "Public request intake dry-run evidence basis mismatch.",
  );
  invariant(
    dryRun.intake_mode === "request_only_review_only",
    "Intake mode must stay request-only/review-only.",
  );
  invariant(dryRun.dry_run_request?.gym_label, "Dry-run gym label required.");
  invariant(dryRun.dry_run_request?.owner_email, "Dry-run owner email required.");
  assertFalse(
    dryRun.dry_run_request,
    "persisted_request_allowed",
    "Dry-run must not persist a public request.",
  );
  assertFalse(
    dryRun,
    "public_request_form_allowed",
    "Public request form must not be enabled.",
  );
  assertFalse(
    dryRun,
    "public_self_serve_launch_allowed",
    "Public self-serve must remain blocked.",
  );
  assertFalse(
    dryRun,
    "automatic_approval_allowed",
    "Automatic approval must remain blocked.",
  );
  assertFalse(
    dryRun,
    "owner_provisioning_allowed",
    "Owner provisioning must remain blocked.",
  );
  assertFalse(
    dryRun,
    "owner_grant_automatic",
    "Owner grant must not be automatic.",
  );
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
  assertFalse(dryRun, "email_ingress_allowed", "Email ingress blocked.");
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
  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(dryRun.blocked_gates, gate, "blocked gates");
  }

  console.log(`Public request intake dry-run OK: ${dryRunPath.relativePath}`);
  console.log(`Dry-run gym: ${dryRun.dry_run_request.gym_label}`);
  console.log("Intake mode: request-only/review-only");
  console.log("Automatic approval: blocked");
  console.log("Owner provisioning: blocked");
  console.log("Invite delivery: blocked");
}

main();
