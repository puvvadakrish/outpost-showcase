#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_RUNWAY_PATH =
  "artifacts/admin-launch-readiness/admin-demo-onboarding-runway.json";
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

const RUNWAY_BLOCKED_GATES = [
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

function requireYes(name) {
  const rawValue = process.env[name]?.trim().toLowerCase();
  invariant(
    rawValue === "yes" || rawValue === "true" || rawValue === "1",
    `${name}=yes is required.`,
  );
  return true;
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

function assertRunway(runway) {
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
    "Customer-observed session must be recorded before demo completion.",
  );
  invariant(
    runway.customer_observed_handoff_claimed === true,
    "Customer-observed handoff claim must be explicit before demo completion.",
  );
  invariant(runway.gym_name, "Runway gym name required.");
  invariant(runway.owner_email, "Runway owner email required.");
  invariant(runway.operator_label, "Runway operator label required.");
  invariant(
    /^[a-f0-9]{64}$/u.test(String(runway.customer_session_record_sha256 ?? "")),
    "Runway customer-session SHA256 missing.",
  );
  invariant(
    Array.isArray(runway.next_two_slices) && runway.next_two_slices.length === 2,
    "Runway must contain exactly next two slices.",
  );
  invariant(
    runway.next_two_slices[0]?.id === "hosted_customer_session_proof",
    "First runway slice must be hosted customer-session proof.",
  );
  invariant(
    runway.next_two_slices[1]?.id === "operator_demo_onboarding_rehearsal",
    "Second runway slice must be operator demo onboarding rehearsal.",
  );

  assertFalse(
    runway,
    "public_self_serve_launch_allowed",
    "Public self-serve must remain blocked.",
  );
  assertFalse(runway, "invite_delivery_allowed", "Invite delivery must remain blocked.");
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
  assertFalse(runway, "email_ingress_allowed", "Email ingress must remain blocked.");
  assertFalse(runway, "outbound_email_allowed", "Outbound email must remain blocked.");
  assertFalse(
    runway,
    "notification_sending_allowed",
    "Notifications must remain blocked.",
  );
  assertFalse(
    runway,
    "live_provider_enablement_allowed",
    "Live provider enablement must remain blocked.",
  );
  assertFalse(
    runway,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );

  for (const gate of RUNWAY_BLOCKED_GATES) {
    assertIncludes(runway.blocked_gates, gate, "runway blocked gates");
  }
}

function main() {
  const runwayPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH ?? DEFAULT_RUNWAY_PATH,
    "OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH",
    { mustExist: true },
  );
  const completionPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH ??
      DEFAULT_COMPLETION_PATH,
    "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH",
  );
  invariant(
    !existsSync(completionPath.resolved),
    "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH already exists.",
  );

  const { artifact: runway, sha256: runwaySha256 } = readJsonArtifact(
    runwayPath.resolved,
    "admin demo onboarding runway",
  );
  assertRunway(runway);

  const operatorLabel = optionalText(
    "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_OPERATOR",
    120,
  );
  invariant(
    operatorLabel,
    "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_OPERATOR required.",
  );
  const notes = optionalText(
    "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_NOTES",
    500,
  );

  const observed = {
    protected_preview_reviewed: requireYes(
      "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PREVIEW_REVIEWED",
    ),
    owner_workspace_reviewed: requireYes(
      "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_OWNER_WORKSPACE_REVIEWED",
    ),
    staff_handoff_path_reviewed: requireYes(
      "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_STAFF_HANDOFF_REVIEWED",
    ),
    reset_rollback_reviewed: requireYes(
      "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_RESET_ROLLBACK_REVIEWED",
    ),
    hosted_customer_session_proof_reviewed: requireYes(
      "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_HOSTED_PROOF_REVIEWED",
    ),
    no_unexpected_customer_data: requireYes(
      "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_NO_UNEXPECTED_DATA",
    ),
    no_live_provider_claims: requireYes(
      "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_NO_LIVE_PROVIDER_CLAIMS",
    ),
  };

  const completion = {
    artifact_kind: "admin_demo_onboarding_completion",
    status: "admin_demo_onboarding_completion_recorded",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_demo_onboarding_runway",
    demo_onboarding_runway_path: runwayPath.relativePath,
    demo_onboarding_runway_sha256: runwaySha256,
    customer_session_record_path: runway.customer_session_record_path,
    customer_session_record_sha256: runway.customer_session_record_sha256,
    handoff_scheduling_packet_sha256: runway.handoff_scheduling_packet_sha256,
    gym_name: runway.gym_name,
    owner_email: runway.owner_email,
    owner_label: runway.owner_label ?? "",
    runway_operator_label: runway.operator_label,
    completion_operator_label: operatorLabel,
    observed,
    notes,
    operator_led_demo_completed: true,
    customer_observed_session_recorded: true,
    customer_observed_handoff_claimed: true,
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
        id: "customer_observed_gym_demo_gate",
        title: "Customer-observed gym demo gate",
        state: "next",
        command: "npm run beta:owner-handoff:message",
        detail:
          "Schedule the real owner-observed gym demo and record completion only after the owner sees the protected Preview, workspace, staff path, reset/rollback checklist, and blocked live-provider claims.",
      },
      {
        id: "limited_operator_assisted_beta_onboarding",
        title: "Limited operator-assisted beta onboarding",
        state: "queued",
        command:
          "npm run admin:beta-request:triage-packet && npm run admin:beta-request:followthrough",
        detail:
          "Prepare a repeatable operator-assisted owner request path for the next gym without opening public self-serve, invite delivery, providers, billing, POS, or member-ledger writes.",
      },
    ],
  };

  assertNoSecretShapedKeys(completion, "admin demo onboarding completion");
  mkdirSync(dirname(completionPath.resolved), { recursive: true });
  writeFileSync(completionPath.resolved, `${JSON.stringify(completion, null, 2)}\n`);

  console.log("Admin demo onboarding completion recorded.");
  console.log(`Artifact: ${completionPath.relativePath}`);
  console.log(`Runway SHA256: ${runwaySha256}`);
  console.log("Next two slices: customer demo gate, limited operator-assisted beta");
  console.log(
    "Public self-serve, invites, providers, billing/POS/member writes: blocked",
  );
}

main();
