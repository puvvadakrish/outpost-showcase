#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_COMPLETION_PATH =
  "artifacts/admin-launch-readiness/admin-demo-onboarding-completion.json";
const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-customer-demo-gate-packet.json";

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

function optionalText(name, maxLength) {
  const value = process.env[name]?.trim() ?? "";
  invariant(value.length <= maxLength, `${name} must be ${maxLength} chars or fewer.`);
  assertNoSecretShapedValue(value, name);
  return value;
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

function assertCompletion(completion) {
  invariant(
    completion.artifact_kind === "admin_demo_onboarding_completion",
    "Completion artifact kind mismatch.",
  );
  invariant(
    completion.status === "admin_demo_onboarding_completion_recorded",
    "Completion status mismatch.",
  );
  invariant(
    completion.operator_led_demo_completed === true,
    "Operator demo completion must be recorded before customer gate packet.",
  );
  invariant(completion.gym_name, "Completion gym name required.");
  invariant(completion.owner_email, "Completion owner email required.");
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
    "Live providers must remain blocked.",
  );
  assertFalse(
    completion,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );
  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(completion.blocked_gates, gate, "completion blocked gates");
  }
}

function main() {
  const completionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH ??
      DEFAULT_COMPLETION_PATH,
    "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH",
    { mustExist: true },
  );
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH ??
      DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH",
  );
  invariant(
    !existsSync(packetPath.resolved),
    "OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH already exists.",
  );

  const { artifact: completion, sha256: completionSha256 } = readJsonArtifact(
    completionPath.resolved,
    "admin demo onboarding completion",
  );
  assertCompletion(completion);

  const sessionWindow = optionalText(
    "OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_WINDOW",
    160,
  );
  const operatorLabel = optionalText(
    "OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_OPERATOR",
    120,
  );

  const packet = {
    artifact_kind: "admin_customer_demo_gate_packet",
    status: "admin_customer_demo_gate_packet_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_demo_onboarding_completion",
    demo_onboarding_completion_path: completionPath.relativePath,
    demo_onboarding_completion_sha256: completionSha256,
    gym_name: completion.gym_name,
    owner_email: completion.owner_email,
    owner_label: completion.owner_label ?? "",
    operator_label: operatorLabel || completion.completion_operator_label,
    session_window: sessionWindow || "Schedule with real gym owner",
    agenda: [
      "Open protected Preview and confirm expected gym tenant only.",
      "Review owner workspace source, answer review, and staff-task proof path.",
      "Review staff handoff path without sending invites or notifications.",
      "Review reset/rollback checklist and support escalation path.",
      "Confirm no unexpected data, live-provider claims, billing, POS, access-control, or member-ledger writes.",
    ],
    required_customer_observed_confirmations: [
      "owner_present",
      "protected_preview_observed",
      "owner_workspace_observed",
      "staff_handoff_path_observed",
      "reset_rollback_reviewed",
      "unexpected_data_not_observed",
      "live_provider_claims_not_observed",
      "invite_delivery_not_observed",
      "billing_pos_member_writes_not_observed",
    ],
    customer_observed_completion_recorded: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    source_import_automation_allowed: false,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: REQUIRED_BLOCKED_GATES,
    next_two_slices: [
      {
        id: "limited_operator_assisted_beta_onboarding",
        title: "Limited operator-assisted beta onboarding",
        state: "next",
        command:
          "npm run admin:beta-request:triage-packet && npm run admin:beta-request:followthrough",
        detail:
          "Use the beta request triage/follow-through path for the next gym after customer-observed demo gate completion.",
      },
      {
        id: "public_self_serve_preflight",
        title: "Public self-serve preflight",
        state: "queued",
        command: "npm run admin:self-serve-rehearsal:packet",
        detail:
          "Only prepare public self-serve after the real customer gate and limited operator-assisted onboarding evidence are green.",
      },
    ],
  };

  assertNoSecretShapedKeys(packet, "admin customer demo gate packet");
  mkdirSync(dirname(packetPath.resolved), { recursive: true });
  writeFileSync(packetPath.resolved, `${JSON.stringify(packet, null, 2)}\n`);

  console.log("Admin customer demo gate packet prepared.");
  console.log(`Artifact: ${packetPath.relativePath}`);
  console.log(`Completion SHA256: ${completionSha256}`);
  console.log("Customer-observed completion recorded: false");
  console.log(
    "Public self-serve, invites, providers, billing/POS/member writes: blocked",
  );
}

main();
