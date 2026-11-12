#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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

function assertIncludes(values, expected, label) {
  invariant(
    Array.isArray(values) && values.includes(expected),
    `${label} missing ${expected}.`,
  );
}

function main() {
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH ??
      DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH",
  );
  const { artifact: packet } = readJsonArtifact(
    packetPath.resolved,
    "admin customer demo gate packet",
  );

  invariant(
    packet.artifact_kind === "admin_customer_demo_gate_packet",
    "Customer demo gate packet kind mismatch.",
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
    /^[a-f0-9]{64}$/u.test(
      String(packet.demo_onboarding_completion_sha256 ?? ""),
    ),
    "Completion SHA256 missing.",
  );
  invariant(
    Array.isArray(packet.agenda) && packet.agenda.length >= 5,
    "Customer demo gate packet agenda incomplete.",
  );
  invariant(
    Array.isArray(packet.required_customer_observed_confirmations) &&
      packet.required_customer_observed_confirmations.includes("owner_present") &&
      packet.required_customer_observed_confirmations.includes(
        "live_provider_claims_not_observed",
      ),
    "Customer demo gate packet confirmations incomplete.",
  );
  assertFalse(
    packet,
    "customer_observed_completion_recorded",
    "Packet must not record customer-observed completion.",
  );
  assertFalse(
    packet,
    "public_self_serve_launch_allowed",
    "Public self-serve must remain blocked.",
  );
  assertFalse(
    packet,
    "invite_delivery_allowed",
    "Invite delivery must remain blocked.",
  );
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
  assertFalse(
    packet,
    "outbound_email_allowed",
    "Outbound email must remain blocked.",
  );
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
    assertIncludes(packet.blocked_gates, gate, "packet blocked gates");
  }
  invariant(
    Array.isArray(packet.next_two_slices) && packet.next_two_slices.length === 2,
    "Packet must contain exactly next two slices.",
  );
  invariant(
    packet.next_two_slices[0]?.id === "limited_operator_assisted_beta_onboarding",
    "First packet next slice must be limited operator-assisted beta onboarding.",
  );

  const completionPath = normalizeArtifactPath(
    packet.demo_onboarding_completion_path,
    "demo onboarding completion path",
  );
  const { artifact: completion, sha256: completionSha256 } = readJsonArtifact(
    completionPath.resolved,
    "admin demo onboarding completion",
  );
  invariant(
    completionSha256 === packet.demo_onboarding_completion_sha256,
    "Completion SHA256 does not match.",
  );
  invariant(
    completion.gym_name === packet.gym_name,
    "Completion gym name mismatch.",
  );
  invariant(
    completion.owner_email === packet.owner_email,
    "Completion owner email mismatch.",
  );

  console.log("Admin customer demo gate packet inspection passed.");
  console.log(`Artifact: ${packetPath.relativePath}`);
  console.log(`Gym: ${packet.gym_name}`);
  console.log("Customer-observed completion recorded: false");
  console.log(
    "Public self-serve, invites, providers, billing/POS/member writes: blocked",
  );
}

main();
