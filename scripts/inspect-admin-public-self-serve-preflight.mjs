#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-public-self-serve-preflight.json";

const REQUIRED_BLOCKED_GATES = [
  "Public owner self-signup",
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
  invariant(
    relativePath.endsWith(".json"),
    `${label} must point to JSON artifact.`,
  );
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
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoSecretShapedKeys(item, label, [...trail, String(index)]),
    );
    return;
  }

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

function assertFalse(preflight, key, message) {
  invariant(preflight[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function main() {
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH ??
      DEFAULT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH",
  );
  const raw = readFileSync(preflightPath.resolved, "utf8");
  assertNoSecretShapedValue(raw, "public self-serve preflight");

  const preflight = JSON.parse(raw);
  assertNoSecretShapedKeys(preflight, "public self-serve preflight");

  invariant(
    preflight.artifact_kind === "admin_public_self_serve_preflight",
    "Public self-serve preflight artifact kind mismatch.",
  );
  invariant(
    preflight.status === "admin_public_self_serve_preflight_prepared",
    "Public self-serve preflight status mismatch.",
  );
  invariant(
    preflight.evidence_basis === "admin_limited_beta_onboarding_packet",
    "Public self-serve preflight evidence basis mismatch.",
  );
  invariant(
    preflight.owner_access_mode === "operator_managed_until_launch_gate_green",
    "Owner access must remain operator-managed until launch gate is green.",
  );

  assertFalse(
    preflight,
    "public_self_serve_launch_allowed",
    "Public self-serve launch must remain blocked.",
  );
  assertFalse(
    preflight,
    "invite_delivery_allowed",
    "Invite delivery must remain blocked.",
  );
  assertFalse(
    preflight,
    "browser_approval_buttons_allowed",
    "Browser approval buttons must remain blocked.",
  );
  assertFalse(
    preflight,
    "auth_admin_product_api_allowed",
    "Auth admin product API must remain blocked.",
  );
  assertFalse(
    preflight,
    "source_import_automation_allowed",
    "Source import automation must remain blocked.",
  );
  assertFalse(
    preflight,
    "automatic_answer_approval_allowed",
    "Automatic answer approval must remain blocked.",
  );
  assertFalse(
    preflight,
    "automatic_task_generation_allowed",
    "Automatic task generation must remain blocked.",
  );
  assertFalse(preflight, "email_ingress_allowed", "Email ingress must remain blocked.");
  assertFalse(
    preflight,
    "outbound_email_allowed",
    "Outbound email must remain blocked.",
  );
  assertFalse(
    preflight,
    "notification_sending_allowed",
    "Notifications must remain blocked.",
  );
  assertFalse(
    preflight,
    "live_provider_enablement_allowed",
    "Live providers must remain blocked.",
  );
  assertFalse(
    preflight,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );

  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(preflight.blocked_gates, gate, "public self-serve blocked gates");
  }

  invariant(
    Array.isArray(preflight.required_green_before_launch) &&
      preflight.required_green_before_launch.length >= 5,
    "Public self-serve preflight launch requirements incomplete.",
  );
  invariant(
    Array.isArray(preflight.allowed_next_work) &&
      preflight.allowed_next_work.length >= 3,
    "Public self-serve preflight allowed next work incomplete.",
  );

  console.log(`Public self-serve preflight inspected ${preflightPath.relativePath}`);
  console.log("Public self-serve launch: blocked");
  console.log("Invite delivery: blocked");
  console.log("Live providers: blocked");
}

main();
