#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_RECORD_PATH =
  "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json";

const REQUIRED_OBSERVED_FLAGS = [
  "owner_present",
  "protected_preview_observed",
  "owner_workspace_observed",
  "staff_handoff_path_observed",
  "reset_rollback_reviewed",
  "unexpected_data_not_observed",
  "live_provider_claims_not_observed",
  "invite_delivery_not_observed",
  "billing_pos_member_writes_not_observed",
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

function normalizeArtifactPath(rawPath, label) {
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
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
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

function runSchedulingInspect(packetPath, packetKind) {
  const script =
    packetKind === "admin_customer_handoff_scheduling_batch"
      ? "scripts/inspect-admin-customer-handoff-scheduling-batch.mjs"
      : "scripts/inspect-admin-handoff-scheduling-packet.mjs";
  const envName =
    packetKind === "admin_customer_handoff_scheduling_batch"
      ? "OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH"
      : "OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH";
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      [envName]: packetPath,
    },
  });

  if (result.status !== 0) {
    throw new Error(`Handoff scheduling inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function assertFalse(record, key, message) {
  invariant(record[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values) && values.includes(expected), `${label} missing ${expected}.`);
}

function assertObserved(record) {
  invariant(
    record.observed && typeof record.observed === "object" && !Array.isArray(record.observed),
    "Observed checks required.",
  );
  for (const key of REQUIRED_OBSERVED_FLAGS) {
    invariant(record.observed[key] === true, `Observed check ${key} must be true.`);
  }
}

function main() {
  const recordPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH ?? DEFAULT_RECORD_PATH,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
  );
  const { artifact: record } = readJsonArtifact(
    recordPath.resolved,
    "admin customer-observed session record",
  );

  invariant(record.artifact_kind === "admin_customer_observed_session_record", "Customer session record kind mismatch.");
  invariant(record.status === "admin_customer_observed_session_recorded", "Customer session record status mismatch.");
  invariant(
    record.evidence_basis === "admin_handoff_scheduling_packet" ||
      record.evidence_basis === "admin_customer_handoff_scheduling_batch",
    "Customer session evidence basis mismatch.",
  );
  invariant(record.customer_observed_session_recorded === true, "Customer-observed session must be recorded.");
  invariant(record.customer_observed_handoff_claimed === true, "Customer-observed handoff claim must be explicit.");
  assertObserved(record);
  assertFalse(record, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(record, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(record, "source_import_automation_allowed", "Source import automation must remain blocked.");
  assertFalse(record, "automatic_answer_approval_allowed", "Automatic answer approval must remain blocked.");
  assertFalse(record, "automatic_task_generation_allowed", "Automatic task generation must remain blocked.");
  assertFalse(record, "email_ingress_allowed", "Email ingress must remain blocked.");
  assertFalse(record, "outbound_email_allowed", "Outbound email must remain blocked.");
  assertFalse(record, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(record, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(record, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  invariant(record.operator_label, "Operator label is required.");
  invariant(record.gym_name, "Gym name is required.");
  invariant(record.owner_email, "Owner email is required.");
  invariant(/^[a-f0-9]{64}$/u.test(String(record.handoff_scheduling_packet_sha256)), "Parent SHA256 is required.");
  assertIncludes(record.command_sequence, "npm run admin:customer-session:record", "command sequence");
  assertIncludes(record.command_sequence, "npm run admin:customer-session:inspect", "command sequence");

  const packetPath = normalizeArtifactPath(record.handoff_scheduling_packet_path, "handoff scheduling packet path");
  const { artifact: packet, sha256: packetSha256 } = readJsonArtifact(
    packetPath.resolved,
    "admin handoff scheduling packet",
  );
  invariant(packetSha256 === record.handoff_scheduling_packet_sha256, "Handoff scheduling packet SHA256 does not match.");
  invariant(packet.artifact_kind === record.evidence_basis, "Customer session parent kind mismatch.");
  runSchedulingInspect(packetPath.relativePath, packet.artifact_kind);
  invariant(packet.gym_name === record.gym_name, "Customer session record gym does not match scheduling packet.");
  invariant(packet.owner_email === record.owner_email, "Customer session record owner does not match scheduling packet.");

  console.log("Admin customer-observed session inspection passed");
  console.log(`Artifact: ${recordPath.relativePath}`);
  console.log(
    "Customer-observed session recorded; public self-serve, invite delivery, providers, billing/POS/member writes remain blocked.",
  );
}

main();
