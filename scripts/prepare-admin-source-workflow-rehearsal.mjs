#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const EXPORT_PATH =
  process.env.OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH ??
  "artifacts/admin-launch-readiness/admin-source-workflow-rehearsal.json";

const REQUIRED_PACKET_GATES = [
  "public_owner_self_signup",
  "website_scraping",
  "google_profile_api_import",
  "automatic_answer_approval",
  "task_generation",
  "notification_sending",
  "phone_email_provider_activation",
  "billing",
  "pos_access_control_member_ledger_writes"
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
      text
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedKeys(item, label, [...trail, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("jwt");
    invariant(!secretKey, `${label} contains secret-shaped key ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function normalizeArtifactPath(rawPath, label, { mustExist }) {
  const normalizedPath = rawPath?.trim();
  invariant(normalizedPath, `${label} required.`);
  assertNoSecretShapedValue(normalizedPath, label);
  const resolved = resolve(process.cwd(), normalizedPath);
  const relativePath = isAbsolute(normalizedPath) ? normalizedPath : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(!normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"), `${label} must live under artifacts/.`);
  invariant(relativePath.endsWith(".json"), `${label} must be a JSON file.`);
  invariant(
    mustExist ? existsSync(resolved) : !existsSync(resolved),
    `${label} ${mustExist ? "not found" : "already exists"} at ${relativePath}.`
  );
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: createHash("sha256").update(raw).digest("hex") };
}

function assertBlockedGates(artifact, gates, label) {
  for (const gate of gates) {
    invariant(artifact.blocked_gates?.includes(gate), `${label} must block ${gate}.`);
  }
}

function requireText(name, maxLength) {
  const value = String(process.env[name] ?? "").trim();
  invariant(value, `${name} required.`);
  invariant(value.length <= maxLength, `${name} too long.`);
  assertNoSecretShapedValue(value, name);
  return value;
}

function main() {
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH,
    "OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH",
    { mustExist: true }
  );
  const exportPath = normalizeArtifactPath(EXPORT_PATH, "OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH", {
    mustExist: false
  });
  const { artifact: packet, sha256: packetSha256 } = readJsonArtifact(packetPath.resolved, "source facts packet");

  invariant(packet.artifact_kind === "admin_source_facts_packet", "Source facts packet kind mismatch.");
  invariant(packet.public_self_serve_launch_allowed === false, "Source packet must keep public self-serve blocked.");
  invariant(packet.source_runtime_write_allowed === false, "Source packet must keep runtime writes blocked.");
  invariant(packet.automatic_answer_approval_allowed === false, "Source packet must keep automatic answer approval blocked.");
  invariant(packet.task_generation_allowed === false, "Source packet must keep task generation blocked.");
  assertBlockedGates(packet, REQUIRED_PACKET_GATES, "Source facts packet");
  invariant(Array.isArray(packet.facts) && packet.facts.length > 0, "Source facts packet must contain facts.");

  const locationLabel = requireText("OUTPOST_ADMIN_SOURCE_WORKFLOW_LOCATION_LABEL", 120);
  const ownerReviewer = requireText("OUTPOST_ADMIN_SOURCE_WORKFLOW_OWNER_REVIEWER", 120);

  const rehearsal = {
    artifact_kind: "admin_source_workflow_rehearsal",
    status: "source_workflow_rehearsal_prepared",
    generated_at: new Date().toISOString(),
    gym_name: packet.gym_name,
    owner_email: packet.owner_email,
    source_label: packet.source_label,
    location_label: locationLabel,
    owner_reviewer: ownerReviewer,
    source_facts_packet_path: packetPath.relativePath,
    source_facts_packet_sha256: packetSha256,
    manual_source_payload: {
      title: `${packet.source_label} reviewed facts`,
      facts: packet.facts.map((fact) => ({
        topic: fact.topic,
        value: fact.value,
        confidence: fact.confidence,
        ...(fact.conflict_group ? { conflict_group: fact.conflict_group } : {})
      }))
    },
    operator_steps: [
      "Open the owner workspace for this gym and location.",
      "Use existing manual source intake to paste these reviewed facts.",
      "Stage source facts into answer review; do not approve automatically.",
      "Only after owner review, use the existing answer-derived staff task path for one unresolved follow-up if needed."
    ],
    public_self_serve_launch_allowed: false,
    source_runtime_write_allowed: false,
    automatic_answer_approval_allowed: false,
    task_generation_allowed: false,
    email_or_notification_allowed: false,
    live_provider_enablement_allowed: false,
    blocked_gates: [
      ...REQUIRED_PACKET_GATES,
      "email_ingress",
      "outbound_email_delivery",
      "provider_webhooks"
    ]
  };

  assertNoSecretShapedKeys(rehearsal, "source workflow rehearsal");
  const serialized = `${JSON.stringify(rehearsal, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "source workflow rehearsal");
  mkdirSync(dirname(exportPath.resolved), { recursive: true });
  writeFileSync(exportPath.resolved, serialized);
  console.log("Admin source workflow rehearsal prepared");
  console.log(`Artifact: ${exportPath.relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Manual source application remains operator-mediated; runtime imports and task generation remain blocked.");
}

main();
