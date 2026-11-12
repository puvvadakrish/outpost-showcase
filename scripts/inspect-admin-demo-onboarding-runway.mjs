#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_RUNWAY_PATH =
  "artifacts/admin-launch-readiness/admin-demo-onboarding-runway.json";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      text,
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoSecretShapedKeys(entry, `${label}[${index}]`),
    );
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, entry] of Object.entries(value)) {
    invariant(
      !/(password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)/iu.test(
        key,
      ),
      `${label} contains secret-shaped key ${key}.`,
    );
    assertNoSecretShapedKeys(entry, `${label}.${key}`);
  }
}

function normalizeArtifactPath(rawPath, label) {
  const value = String(rawPath ?? "").trim();
  invariant(value, `${label} required.`);
  assertNoSecretShapedValue(value, label);
  invariant(!isAbsolute(value), `${label} must be relative.`);
  invariant(value.endsWith(".json"), `${label} must end with .json.`);
  const root = resolve(process.cwd(), "artifacts");
  const resolved = resolve(process.cwd(), value);
  const fromRoot = relative(root, resolved);
  invariant(
    fromRoot && !fromRoot.startsWith("..") && !isAbsolute(fromRoot),
    `${label} must stay inside artifacts/.`,
  );
  invariant(
    value === relative(process.cwd(), resolved).split(sep).join("/"),
    `${label} must be normalized relative path.`,
  );
  invariant(existsSync(resolved), `${label} not found.`);
  return { relativePath: value, resolved };
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

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(
    Array.isArray(values) && values.includes(expected),
    `${label} missing ${expected}.`,
  );
}

const REQUIRED_BLOCKED_GATES = [
  "Public owner self-signup",
  "Invite delivery",
  "Website scraping and Google API import",
  "Automatic answer approval",
  "Automatic task generation",
  "Gmail, Resend, SMTP, provider webhooks",
  "Inbound email and outbound email",
  "Notification sending",
  "Phone/email provider activation",
  "Billing, POS, access control, member-ledger writes",
];

function main() {
  const runwayPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH ??
      DEFAULT_RUNWAY_PATH,
    "OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH",
  );
  const { artifact: runway } = readJsonArtifact(
    runwayPath.resolved,
    "admin demo onboarding runway",
  );

  invariant(
    runway.artifact_kind === "admin_demo_onboarding_runway",
    "Runway artifact kind mismatch.",
  );
  invariant(
    runway.status === "admin_demo_onboarding_runway_prepared",
    "Runway status mismatch.",
  );
  invariant(
    runway.evidence_basis === "admin_customer_observed_session_record",
    "Runway evidence basis mismatch.",
  );
  invariant(
    runway.operator_led_demo_ready === true,
    "Operator-led demo readiness must be true.",
  );
  invariant(
    runway.customer_observed_session_recorded === true,
    "Customer-observed session must be recorded.",
  );
  invariant(
    runway.customer_observed_handoff_claimed === true,
    "Customer-observed handoff claim must be explicit.",
  );
  assertFalse(
    runway,
    "public_self_serve_launch_allowed",
    "Public self-serve must remain blocked.",
  );
  assertFalse(
    runway,
    "invite_delivery_allowed",
    "Invite delivery must remain blocked.",
  );
  assertFalse(
    runway,
    "source_import_automation_allowed",
    "Source import automation must remain blocked.",
  );
  assertFalse(
    runway,
    "automatic_answer_approval_allowed",
    "Automatic answer approval must remain blocked.",
  );
  assertFalse(
    runway,
    "automatic_task_generation_allowed",
    "Automatic task generation must remain blocked.",
  );
  assertFalse(
    runway,
    "email_ingress_allowed",
    "Email ingress must be blocked.",
  );
  assertFalse(
    runway,
    "outbound_email_allowed",
    "Outbound email must be blocked.",
  );
  assertFalse(
    runway,
    "notification_sending_allowed",
    "Notifications must be blocked.",
  );
  assertFalse(
    runway,
    "live_provider_enablement_allowed",
    "Live providers must remain blocked.",
  );
  assertFalse(
    runway,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );
  invariant(
    Array.isArray(runway.next_two_slices) &&
      runway.next_two_slices.length === 2,
    "Runway must contain exactly next two slices.",
  );
  invariant(
    runway.next_two_slices[0]?.id === "hosted_customer_session_proof",
    "First next slice must be hosted customer-session proof.",
  );
  invariant(
    runway.next_two_slices[1]?.id === "operator_demo_onboarding_rehearsal",
    "Second next slice must be operator demo onboarding rehearsal.",
  );
  for (const blockedGate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(runway.blocked_gates, blockedGate, "blocked gates");
  }

  const sessionPath = normalizeArtifactPath(
    runway.customer_session_record_path,
    "customer session record path",
  );
  const { artifact: sessionRecord, sha256: sessionRecordSha256 } =
    readJsonArtifact(
      sessionPath.resolved,
      "admin customer-observed session record",
    );
  invariant(
    sessionRecordSha256 === runway.customer_session_record_sha256,
    "Customer session record SHA256 does not match.",
  );
  invariant(
    sessionRecord.gym_name === runway.gym_name,
    "Customer session gym name mismatch.",
  );
  invariant(
    sessionRecord.owner_email === runway.owner_email,
    "Customer session owner email mismatch.",
  );

  console.log("Admin demo onboarding runway inspection passed.");
  console.log(`Artifact: ${runwayPath.relativePath}`);
  console.log(`Gym: ${runway.gym_name}`);
  console.log("Next two slices: hosted proof, operator demo onboarding");
  console.log(
    "Public self-serve, invites, providers, billing/POS/member writes: blocked",
  );
}

main();
