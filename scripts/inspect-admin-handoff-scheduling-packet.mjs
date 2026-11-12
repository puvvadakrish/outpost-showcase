#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-handoff-scheduling-packet.json";

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
      text
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
        key
      ),
      `${label} contains secret-shaped key ${key}.`
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
  const relativePath = relative(process.cwd(), resolved);
  const relativeToRoot = relative(root, resolved);
  invariant(
    relativeToRoot && !relativeToRoot.startsWith("..") && !relativeToRoot.split(sep).includes(".."),
    `${label} must stay under artifacts/.`
  );
  invariant(relativePath === value, `${label} must be normalized.`);
  invariant(existsSync(resolved), `${label} does not exist.`);
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: createHash("sha256").update(raw).digest("hex") };
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values) && values.includes(expected), `${label} must include ${expected}.`);
}

function runLaunchEvidenceInspect(bundlePath) {
  const result = spawnSync("node", ["scripts/inspect-admin-launch-evidence-bundle.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath
    }
  });
  if (result.status !== 0) {
    throw new Error(`Launch evidence bundle inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function main() {
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH ?? DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH"
  );
  const { artifact: packet } = readJsonArtifact(packetPath.resolved, "admin handoff scheduling packet");
  invariant(packet.artifact_kind === "admin_handoff_scheduling_packet", "Handoff scheduling packet kind mismatch.");
  invariant(packet.status === "admin_handoff_scheduling_packet_prepared", "Handoff scheduling packet status mismatch.");
  invariant(packet.evidence_basis === "admin_launch_evidence_bundle", "Handoff scheduling evidence basis mismatch.");
  invariant(packet.operator_evidence_ready === true, "Operator evidence must be ready.");
  invariant(packet.handoff_scheduling_ready === true, "Handoff scheduling must be ready.");
  assertFalse(packet, "customer_observed_handoff_claimed", "Customer-observed handoff must remain pending.");
  assertFalse(packet, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(packet, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(packet, "source_import_automation_allowed", "Source import automation must remain blocked.");
  assertFalse(packet, "automatic_answer_approval_allowed", "Automatic answer approval must remain blocked.");
  assertFalse(packet, "automatic_task_generation_allowed", "Automatic task generation must remain blocked.");
  assertFalse(packet, "email_ingress_allowed", "Email ingress must remain blocked.");
  assertFalse(packet, "outbound_email_allowed", "Outbound email must remain blocked.");
  assertFalse(packet, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(packet, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(packet, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
  invariant(packet.operator_label, "Operator label is required.");
  invariant(packet.support_window, "Support window is required.");
  invariant(Array.isArray(packet.customer_session_agenda) && packet.customer_session_agenda.length >= 5, "Customer agenda is incomplete.");
  invariant(Array.isArray(packet.support_checklist) && packet.support_checklist.length >= 4, "Support checklist is incomplete.");
  assertIncludes(packet.customer_session_agenda, "Confirm protected Preview workspace is the expected gym tenant.", "customer agenda");
  assertIncludes(packet.support_checklist, "Keep customer-observed completion pending until the owner observes the protected Preview flow.", "support checklist");
  assertIncludes(packet.blocked_gates, "Customer-observed handoff claim", "blocked gates");
  assertIncludes(packet.blocked_gates, "Invite delivery", "blocked gates");
  assertIncludes(packet.blocked_gates, "Inbound email, outbound delivery, and notifications", "blocked gates");
  assertIncludes(packet.command_sequence, "npm run admin:handoff-scheduling:inspect", "command sequence");

  invariant(/^[a-f0-9]{64}$/u.test(String(packet.launch_evidence_bundle_sha256 ?? "")), "Launch evidence SHA256 missing.");
  const bundlePath = normalizeArtifactPath(packet.launch_evidence_bundle_path, "launch evidence bundle path");
  const { artifact: launchEvidence, sha256: launchEvidenceSha256 } = readJsonArtifact(
    bundlePath.resolved,
    "admin launch evidence bundle"
  );
  invariant(launchEvidenceSha256 === packet.launch_evidence_bundle_sha256, "Launch evidence bundle SHA256 does not match.");
  runLaunchEvidenceInspect(bundlePath.relativePath);
  invariant(launchEvidence.gym_name === packet.gym_name, "Scheduling packet gym does not match launch evidence.");
  invariant(launchEvidence.owner_email === packet.owner_email, "Scheduling packet owner does not match launch evidence.");

  console.log("Admin handoff scheduling packet inspection passed");
  console.log(`Artifact: ${packetPath.relativePath}`);
  console.log("Scheduling packet is customer-safe; observed completion, invite delivery, providers, and billing/POS/member writes remain blocked.");
}

main();
