#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-handoff-scheduling-packet.json";
const DEFAULT_RECORD_PATH =
  "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json";

const REQUIRED_CONFIRMATIONS = [
  ["OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT", "owner_present"],
  ["OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED", "protected_preview_observed"],
  [
    "OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_WORKSPACE_OBSERVED",
    "owner_workspace_observed",
  ],
  [
    "OUTPOST_ADMIN_CUSTOMER_SESSION_STAFF_HANDOFF_OBSERVED",
    "staff_handoff_path_observed",
  ],
  ["OUTPOST_ADMIN_CUSTOMER_SESSION_RESET_ROLLBACK_REVIEWED", "reset_rollback_reviewed"],
  [
    "OUTPOST_ADMIN_CUSTOMER_SESSION_UNEXPECTED_DATA_NOT_OBSERVED",
    "unexpected_data_not_observed",
  ],
  [
    "OUTPOST_ADMIN_CUSTOMER_SESSION_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED",
    "live_provider_claims_not_observed",
  ],
  [
    "OUTPOST_ADMIN_CUSTOMER_SESSION_INVITE_DELIVERY_NOT_OBSERVED",
    "invite_delivery_not_observed",
  ],
  [
    "OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED",
    "billing_pos_member_writes_not_observed",
  ],
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      text,
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretShapedKeys(entry, `${label}[${index}]`));
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

function normalizeArtifactPath(rawPath, label, { mustExist }) {
  const value = String(rawPath ?? "").trim();
  invariant(value, `${label} required.`);
  assertNoSecretShapedValue(value, label);
  invariant(!isAbsolute(value), `${label} must be repository-relative.`);
  invariant(!value.includes("\0"), `${label} cannot contain NUL.`);
  const resolved = resolve(value);
  const cwd = resolve(process.cwd());
  const relativePath = relative(cwd, resolved);
  invariant(
    !isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`),
    `${label} must stay under artifacts/.`,
  );
  invariant(relativePath.startsWith(`artifacts${sep}`), `${label} must be under artifacts/.`);
  invariant(value === relativePath, `${label} must be normalized.`);
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  if (mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  } else {
    invariant(!existsSync(resolved), `${label} already exists: ${relativePath}`);
  }
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

function runSchedulingInspect(packet) {
  const script =
    packet.artifact_kind === "admin_customer_handoff_scheduling_batch"
      ? "scripts/inspect-admin-customer-handoff-scheduling-batch.mjs"
      : "scripts/inspect-admin-handoff-scheduling-packet.mjs";
  const envName =
    packet.artifact_kind === "admin_customer_handoff_scheduling_batch"
      ? "OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH"
      : "OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH";
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      [envName]: packet.relativePath,
    },
  });

  if (result.status !== 0) {
    throw new Error(`Handoff scheduling inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function requireText(name, maxLength) {
  const value = String(process.env[name] ?? "").trim();
  invariant(value, `${name} required.`);
  invariant(value.length <= maxLength, `${name} too long.`);
  assertNoSecretShapedValue(value, name);
  return value;
}

function optionalText(name, maxLength) {
  const value = String(process.env[name] ?? "").trim();
  invariant(value.length <= maxLength, `${name} too long.`);
  assertNoSecretShapedValue(value, name);
  return value;
}

function requireYes(name) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  invariant(value === "yes", `${name} must be yes.`);
  return true;
}

function assertFalse(packet, key, message) {
  invariant(packet[key] === false, message);
}

function assertSchedulingPacket(packet) {
  const legacyPacket = packet.artifact_kind === "admin_handoff_scheduling_packet";
  const batchPacket = packet.artifact_kind === "admin_customer_handoff_scheduling_batch";
  invariant(legacyPacket || batchPacket, "Handoff scheduling packet kind mismatch.");

  if (legacyPacket) {
    invariant(
      packet.status === "admin_handoff_scheduling_packet_prepared",
      "Handoff scheduling packet status mismatch.",
    );
    invariant(packet.handoff_scheduling_ready === true, "Handoff scheduling packet must be ready.");
    assertFalse(packet, "source_import_automation_allowed", "Source import automation must remain blocked.");
    assertFalse(packet, "automatic_answer_approval_allowed", "Automatic answer approval must remain blocked.");
    assertFalse(packet, "automatic_task_generation_allowed", "Automatic task generation must remain blocked.");
    assertFalse(packet, "email_ingress_allowed", "Email ingress must remain blocked.");
    assertFalse(packet, "outbound_email_allowed", "Outbound email must remain blocked.");
  } else {
    invariant(
      packet.status === "admin_customer_handoff_scheduling_batch_prepared",
      "Customer handoff scheduling batch status mismatch.",
    );
    invariant(packet.customer_handoff_scheduling_ready === true, "Customer handoff scheduling batch must be ready.");
    assertFalse(packet, "product_auth_admin_api_allowed", "Product Auth admin API must remain blocked.");
    assertFalse(packet, "automatic_owner_staff_grants_allowed", "Automatic owner/staff grants must remain blocked.");
  }

  if (batchPacket || Object.hasOwn(packet, "customer_observed_completion_recorded")) {
    assertFalse(packet, "customer_observed_completion_recorded", "Customer completion must remain blocked before session.");
  }
  assertFalse(packet, "public_self_serve_launch_allowed", "Public self-serve launch must remain blocked.");
  assertFalse(packet, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(packet, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(packet, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(packet, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  invariant(packet.gym_name, "Scheduling packet gym name is required.");
  invariant(packet.owner_email, "Scheduling packet owner email is required.");
  invariant(packet.operator_label, "Scheduling packet operator label required.");
}

function main() {
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH ?? DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH",
    { mustExist: true },
  );
  const recordPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH ?? DEFAULT_RECORD_PATH,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    { mustExist: false },
  );

  const { artifact: packet, sha256: packetSha256 } = readJsonArtifact(
    packetPath.resolved,
    "admin handoff scheduling packet",
  );
  assertSchedulingPacket(packet);
  runSchedulingInspect({ ...packet, relativePath: packetPath.relativePath });

  const observed = Object.fromEntries(
    REQUIRED_CONFIRMATIONS.map(([envName, key]) => [key, requireYes(envName)]),
  );
  const operatorLabel = requireText("OUTPOST_ADMIN_CUSTOMER_SESSION_OPERATOR", 120);
  const ownerSessionWindow = optionalText("OUTPOST_ADMIN_CUSTOMER_SESSION_WINDOW", 160);
  const notes = optionalText("OUTPOST_ADMIN_CUSTOMER_SESSION_NOTES", 500);

  const record = {
    artifact_kind: "admin_customer_observed_session_record",
    status: "admin_customer_observed_session_recorded",
    generated_at: new Date().toISOString(),
    evidence_basis: packet.artifact_kind,
    handoff_scheduling_packet_path: packetPath.relativePath,
    handoff_scheduling_packet_sha256: packetSha256,
    gym_name: packet.gym_name,
    owner_email: packet.owner_email,
    owner_label: packet.owner_label ?? "",
    scheduling_operator_label: packet.operator_label,
    operator_label: operatorLabel,
    owner_session_window: ownerSessionWindow,
    notes,
    customer_observed_session_recorded: true,
    customer_observed_handoff_claimed: true,
    observed,
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
    blocked_gates: [
      "Public self-serve launch",
      "Invite delivery",
      "Website scraping Google API import",
      "Automatic answer approval",
      "Automatic task generation",
      "Gmail, Resend, SMTP, provider webhooks",
      "Inbound email, outbound email, notification sending",
      "Phone/email provider activation",
      "Billing, POS, access control, member-ledger writes",
    ],
    command_sequence: [
      packet.artifact_kind === "admin_customer_handoff_scheduling_batch"
        ? "npm run admin:customer-handoff:schedule:inspect"
        : "npm run admin:handoff-scheduling:inspect",
      "npm run admin:customer-session:record",
      "npm run admin:customer-session:inspect",
    ],
  };

  assertNoSecretShapedKeys(record, "admin customer-observed session record");
  mkdirSync(dirname(recordPath.resolved), { recursive: true });
  writeFileSync(recordPath.resolved, `${JSON.stringify(record, null, 2)}\n`);

  console.log("Admin customer-observed session recorded");
  console.log(`Artifact: ${recordPath.relativePath}`);
  console.log("Customer-observed handoff: recorded");
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
