#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_CUSTOMER_DEMO_GATE_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-customer-demo-gate-packet.json";
const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-limited-beta-onboarding-packet.json";

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
  invariant(
    relativePath.endsWith(".json"),
    `${label} must point to JSON artifact.`,
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
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function assertCustomerDemoGatePacket(packet) {
  invariant(
    packet.artifact_kind === "admin_customer_demo_gate_packet",
    "Customer demo gate packet artifact kind mismatch.",
  );
  invariant(
    packet.status === "admin_customer_demo_gate_packet_prepared",
    "Customer demo gate packet status mismatch.",
  );
  invariant(
    packet.evidence_basis === "admin_demo_onboarding_completion",
    "Customer demo gate packet evidence basis mismatch.",
  );
  invariant(packet.gym_name, "Customer demo gate packet gym name required.");
  invariant(packet.owner_email, "Customer demo gate packet owner email required.");
  invariant(
    packet.customer_observed_completion_recorded === false,
    "Customer demo gate packet must not record customer completion.",
  );

  assertFalse(
    packet,
    "public_self_serve_launch_allowed",
    "Public self-serve must remain blocked.",
  );
  assertFalse(packet, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(
    packet,
    "source_import_automation_allowed",
    "Source import automation must remain blocked.",
  );
  assertFalse(
    packet,
    "automatic_answer_approval_allowed",
    "Automatic answer approval must remain blocked.",
  );
  assertFalse(
    packet,
    "automatic_task_generation_allowed",
    "Automatic task generation must remain blocked.",
  );
  assertFalse(packet, "email_ingress_allowed", "Email ingress must remain blocked.");
  assertFalse(packet, "outbound_email_allowed", "Outbound email must remain blocked.");
  assertFalse(
    packet,
    "notification_sending_allowed",
    "Notifications must remain blocked.",
  );
  assertFalse(
    packet,
    "live_provider_enablement_allowed",
    "Live providers must remain blocked.",
  );
  assertFalse(
    packet,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );

  for (const gate of REQUIRED_BLOCKED_GATES) {
    assertIncludes(packet.blocked_gates, gate, "customer demo gate blocked gates");
  }
}

function optionalText(envName, maxLength) {
  const value = process.env[envName]?.trim() ?? "";
  if (!value) {
    return "";
  }

  assertNoSecretShapedValue(value, envName);
  invariant(value.length <= maxLength, `${envName} must be <= ${maxLength} chars.`);
  return value;
}

function main() {
  const customerDemoGatePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH ??
      DEFAULT_CUSTOMER_DEMO_GATE_PACKET_PATH,
    "OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH",
    { mustExist: true },
  );
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH ??
      DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH",
  );

  invariant(
    !existsSync(packetPath.resolved),
    "OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH already exists.",
  );

  const { artifact: customerDemoGate, sha256: customerDemoGateSha256 } =
    readJsonArtifact(customerDemoGatePath.resolved, "customer demo gate packet");
  assertCustomerDemoGatePacket(customerDemoGate);

  const operatorLabel =
    optionalText("OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_OPERATOR", 120) ||
    customerDemoGate.operator_label ||
    "Operator";
  const candidateGymLabel = optionalText(
    "OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_CANDIDATE_GYM",
    160,
  );

  const packet = {
    artifact_kind: "admin_limited_beta_onboarding_packet",
    status: "admin_limited_beta_onboarding_packet_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_customer_demo_gate_packet",
    customer_demo_gate_packet_path: customerDemoGatePath.relativePath,
    customer_demo_gate_packet_sha256: customerDemoGateSha256,
    source_gym_name: customerDemoGate.gym_name,
    source_owner_email: customerDemoGate.owner_email,
    candidate_gym_label: candidateGymLabel || "Next approved beta gym",
    operator_label: operatorLabel,
    owner_access_mode: "operator_managed",
    request_triage_required: true,
    followthrough_required: true,
    customer_observed_completion_recorded: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    browser_approval_buttons_allowed: false,
    source_import_automation_allowed: false,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: REQUIRED_BLOCKED_GATES,
    operator_checklist: [
      "Review latest customer demo gate packet before contacting the next gym.",
      "Use beta request triage packet for human approval; do not approve from the browser.",
      "Provision owner access only through the operator-managed owner access CLI path.",
      "Use protected Preview owner sign-in and workspace bootstrap with the approved owner.",
      "Walk owner through manual source, answer review, staff task handoff, and rollback checklist.",
      "Record follow-through outcome with customer-safe labels only; store no passwords, cookies, tokens, or bypass secrets.",
    ],
    inspect_command: "npm run admin:limited-beta-onboarding:inspect",
    next_preflight_command: "npm run admin:public-self-serve:preflight",
  };

  assertNoSecretShapedKeys(packet, "limited beta onboarding packet");
  assertNoSecretShapedValue(
    JSON.stringify(packet),
    "limited beta onboarding packet",
  );

  mkdirSync(dirname(packetPath.resolved), { recursive: true });
  writeFileSync(packetPath.resolved, `${JSON.stringify(packet, null, 2)}\n`);

  console.log(`Limited beta onboarding packet wrote ${packetPath.relativePath}`);
  console.log(`Candidate gym: ${packet.candidate_gym_label}`);
  console.log("Owner access: operator-managed");
  console.log("Public self-serve launch: blocked");
  console.log("Live providers: blocked");
}

main();
