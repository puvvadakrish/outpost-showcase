#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_COMPLETION_PATH =
  "artifacts/admin-launch-readiness/admin-demo-onboarding-completion.json";

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
  if (!condition) throw new Error(message);
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
    `${label} must stay inside the repository.`,
  );
  invariant(
    relativePath.startsWith(`artifacts${sep}`) ||
      relativePath === "artifacts",
    `${label} must be under artifacts/.`,
  );
  invariant(
    relativePath.endsWith(".json"),
    `${label} must point to a JSON artifact.`,
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
      `${label} contains secret-shaped key: ${key}`,
    );
    assertNoSecretShapedValue(entry, `${label}.${key}`);
    assertNoSecretShapedKeys(entry, `${label}.${key}`);
  }
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

function assertTrue(artifact, key, message) {
  invariant(artifact[key] === true, message);
}

function assertIncludes(values, expected, label) {
  invariant(
    Array.isArray(values) && values.includes(expected),
    `${label} missing ${expected}.`,
  );
}

function main() {
  const completionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH ??
      DEFAULT_COMPLETION_PATH,
    "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH",
  );
  const { artifact: completion } = readJsonArtifact(
    completionPath.resolved,
    "admin demo onboarding completion",
  );

  invariant(
    completion.artifact_kind === "admin_demo_onboarding_completion",
    "Completion artifact kind mismatch.",
  );
  invariant(
    completion.status === "admin_demo_onboarding_completion_recorded",
    "Completion status mismatch.",
  );
  invariant(
    completion.evidence_basis === "admin_demo_onboarding_runway",
    "Completion evidence basis mismatch.",
  );
  invariant(
    completion.operator_led_demo_completed === true,
    "Operator-led demo completion must be true.",
  );
  invariant(
    completion.customer_observed_session_recorded === true,
    "Customer-observed session must remain recorded.",
  );
  invariant(
    completion.customer_observed_handoff_claimed === true,
    "Customer-observed handoff claim must remain explicit.",
  );
  invariant(completion.gym_name, "Completion gym name required.");
  invariant(completion.owner_email, "Completion owner email required.");
  invariant(
    completion.completion_operator_label,
    "Completion operator label required.",
  );
  invariant(
    /^[a-f0-9]{64}$/u.test(
      String(completion.demo_onboarding_runway_sha256 ?? ""),
    ),
    "Runway SHA256 missing.",
  );

  assertTrue(
    completion.observed,
    "protected_preview_reviewed",
    "Protected Preview review confirmation missing.",
  );
  assertTrue(
    completion.observed,
    "owner_workspace_reviewed",
    "Owner workspace review confirmation missing.",
  );
  assertTrue(
    completion.observed,
    "staff_handoff_path_reviewed",
    "Staff handoff path review confirmation missing.",
  );
  assertTrue(
    completion.observed,
    "reset_rollback_reviewed",
    "Reset/rollback review confirmation missing.",
  );
  assertTrue(
    completion.observed,
    "hosted_customer_session_proof_reviewed",
    "Hosted customer-session proof review confirmation missing.",
  );
  assertTrue(
    completion.observed,
    "no_unexpected_customer_data",
    "Unexpected customer-data confirmation missing.",
  );
  assertTrue(
    completion.observed,
    "no_live_provider_claims",
    "Live-provider claim confirmation missing.",
  );

  assertFalse(
    completion,
    "public_self_serve_launch_allowed",
    "Public self-serve must remain blocked.",
  );
  assertFalse(
    completion,
    "invite_delivery_allowed",
    "Invite delivery must remain blocked.",
  );
  assertFalse(
    completion,
    "source_import_automation_allowed",
    "Source import automation must remain blocked.",
  );
  assertFalse(
    completion,
    "automatic_answer_approval_allowed",
    "Automatic answer approval must remain blocked.",
  );
  assertFalse(
    completion,
    "automatic_task_generation_allowed",
    "Automatic task generation must remain blocked.",
  );
  assertFalse(
    completion,
    "email_ingress_allowed",
    "Email ingress must remain blocked.",
  );
  assertFalse(
    completion,
    "outbound_email_allowed",
    "Outbound email must remain blocked.",
  );
  assertFalse(
    completion,
    "notification_sending_allowed",
    "Notifications must remain blocked.",
  );
  assertFalse(
    completion,
    "live_provider_enablement_allowed",
    "Live provider enablement must remain blocked.",
  );
  assertFalse(
    completion,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );

  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(completion.blocked_gates, gate, "completion blocked gates");
  }

  invariant(
    Array.isArray(completion.next_two_slices) &&
      completion.next_two_slices.length === 2,
    "Completion must contain exactly next two slices.",
  );
  invariant(
    completion.next_two_slices[0]?.id === "customer_observed_gym_demo_gate",
    "First completion next slice must be customer-observed gym demo gate.",
  );
  invariant(
    completion.next_two_slices[1]?.id ===
      "limited_operator_assisted_beta_onboarding",
    "Second completion next slice must be limited operator-assisted beta onboarding.",
  );

  const runwayPath = normalizeArtifactPath(
    completion.demo_onboarding_runway_path,
    "demo onboarding runway path",
  );
  const { artifact: runway, sha256: runwaySha256 } = readJsonArtifact(
    runwayPath.resolved,
    "admin demo onboarding runway",
  );
  invariant(
    runwaySha256 === completion.demo_onboarding_runway_sha256,
    "Runway SHA256 does not match.",
  );
  invariant(
    runway.gym_name === completion.gym_name,
    "Runway gym name mismatch.",
  );
  invariant(
    runway.owner_email === completion.owner_email,
    "Runway owner email mismatch.",
  );

  console.log("Admin demo onboarding completion inspection passed.");
  console.log(`Artifact: ${completionPath.relativePath}`);
  console.log(`Gym: ${completion.gym_name}`);
  console.log("Next two slices: customer demo gate, limited operator beta");
  console.log(
    "Public self-serve, invites, providers, billing/POS/member writes: blocked",
  );
}

main();
